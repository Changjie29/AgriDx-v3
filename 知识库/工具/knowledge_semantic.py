"""Offline review candidates, reusing the 3.4.9 validator and verified cache primitives."""
import collections
import datetime
import hashlib
import importlib
import itertools
import json
import math
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
from knowledge_quality import IncrementalCache, atomic_write, fingerprint, safe_output
from semantic_relations import extract_features, candidate_tokens, classify
from semantic_embedding import LocalEmbedder

validator = importlib.import_module('校验索引')
SCHEMA_VERSION = 1
RULES_VERSION = '1.0.0'


def implementation_hash():
    return fingerprint([RULES_VERSION, sys.version, *[
        validator.digest(Path(__file__).with_name(name)) for name in
        ('knowledge_semantic.py', 'semantic_relations.py', 'semantic_embedding.py')]])


class SemanticCache(IncrementalCache):
    """Reuse checksum/dependency validation; retain unfinished records on checkpoints."""
    def __init__(self, path, engine, full=False):
        super().__init__(path, engine, full)
        self.manifest = {}
        if path and Path(path).exists():
            try:
                data = json.loads(Path(path).read_text('utf8'))
                if (isinstance(data, dict) and isinstance(data.get('manifest'), dict) and
                        data.get('manifest_checksum') == fingerprint(data['manifest'])):
                    self.manifest = data['manifest']
            except (ValueError, OSError, TypeError):
                pass

    def checkpoint(self, manifest, complete=False):
        if not self.path:
            return
        records = self.current if complete else {**self.previous, **self.current}
        atomic_write(self.path, json.dumps({
            'schema_version': SCHEMA_VERSION, 'engine': self.engine,
            'records': records, 'manifest': manifest,
            'manifest_checksum': fingerprint(manifest), 'complete': complete,
        }, ensure_ascii=False) + '\n')


def lexical_candidates(features, top_k):
    """Bound common lexical buckets; exact/case/symptom buckets remain exhaustive."""
    pairs = collections.defaultdict(set)
    buckets = collections.defaultdict(list)
    postings = collections.defaultdict(set)
    for identity, f in features.items():
        for key, value in [('normalized_hash', f.get('normalized_hash') if f.get('normalized') else None), ('case_key', f.get('case_key')),
                           ('symptom', f.get('symptom'))]:
            if value:
                buckets[key, value].append(identity)
        for token in candidate_tokens(f):
            postings[token].add(identity)
    for (kind, _), ids in buckets.items():
        for pair in itertools.combinations(sorted(ids), 2):
            pairs[pair].add(kind)
    scores = collections.defaultdict(collections.Counter)
    for token, ids in postings.items():
        # Common boilerplate is not useful retrieval evidence. No pair is inferred
        # negative from being outside this top-k; reports are review candidates.
        if not 2 <= len(ids) <= 128:
            continue
        weight = 1 / len(ids)
        for a, b in itertools.combinations(sorted(ids), 2):
            scores[a][b] += weight
            scores[b][a] += weight
    for a, score in scores.items():
        for b, _ in sorted(score.items(), key=lambda x: (-x[1], x[0]))[:top_k]:
            pairs[tuple(sorted((a, b)))].add('lexical_top_k')
    return pairs


def embedding_candidates(vectors, pairs, top_k, threshold):
    if not vectors:
        return
    ids = sorted(vectors)
    dimension = len(vectors[ids[0]])
    if dimension == 0 or any(len(v) != dimension or not all(math.isfinite(x) for x in v)
                             for v in vectors.values()):
        raise ValueError('embedding维度不一致或包含非有限值')
    # Sentence-transformers already requires numpy; optional import keeps rules mode
    # standard-library-only. Blocked products avoid an N*N resident similarity matrix.
    try:
        import numpy as np
    except ImportError:
        # This path also lets injected/test adapters run on a stdlib-only host.
        # Real Sentence Transformers installations already include numpy.
        for identity in ids:
            scores = [(other, cosine(vectors[identity], vectors[other])) for other in ids if other != identity]
            for other, score in sorted(scores, key=lambda pair: (-pair[1], pair[0]))[:top_k]:
                if score >= threshold:
                    pairs[tuple(sorted((identity, other)))].add('embedding_top_k')
        return
    matrix = np.asarray([vectors[i] for i in ids], dtype=np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    if np.any(norms == 0):
        raise ValueError('embedding不得为零向量')
    matrix /= norms
    for offset in range(0, len(ids), 128):
        block = matrix[offset:offset + 128] @ matrix.T
        for local, scores in enumerate(block):
            row = offset + local
            valid = [i for i in range(len(ids)) if i != row and scores[i] >= threshold]
            for other in sorted(valid, key=lambda i: (-float(scores[i]), ids[i]))[:top_k]:
                pairs[tuple(sorted((ids[row], ids[other])))].add('embedding_top_k')


def cosine(a, b):
    if a is None or b is None:
        return None
    denominator = math.sqrt(sum(x*x for x in a) * sum(x*x for x in b))
    if not denominator:
        raise ValueError('embedding不得为零向量')
    return round(max(-1., min(1., sum(x*y for x, y in zip(a, b)) / denominator)), 6)


def assert_stable(audit, hash_content=False):
    for path, before in audit.file_stats.items():
        if not path.exists() or audit.stat(path) != before:
            raise ValueError('snapshot.changed：输入在语义扫描期间变化；未发布完成报告')
        if hash_content and validator.digest(path) != audit.files[path]:
            raise ValueError('snapshot.changed：语义扫描内容哈希变化')


def provenance(entry, source, section, position, features):
    return {'entry_id': entry['entry_id'], 'source_id': entry['source_id'],
            'title': entry['title'], 'scope': features['scope'],
            'verification': validator.reference_verification(entry['status']),
            'status_original': entry['status'], 'source_version': source.get('version'),
            'source_url': source.get('url'), 'source_boundary': source.get('scope_boundary'),
            'scope_original': {side: {key: record[key] for key in (
                'brand', 'model', 'models', 'configuration', 'drive_configuration',
                'emission_stage', 'scope_boundary', 'use') if key in record}
                               for side, record in [('entry', entry), ('source', source)]},
            'evidence': {'path': entry['knowledge_path'], 'line': section['line'] + 1,
                         'locator': entry['locator'],
                         'index_path': (validator.INDEX_PATH / 'entries.jsonl').as_posix(),
                         'index_line': position}}


def scan(repo=validator.REPO, cache_path=None, quality_cache_path=None, full=False,
         embedder=None, checkpoint_every=100, top_k=12, threshold=0.75):
    started = time.perf_counter()
    if checkpoint_every < 1 or top_k < 1 or not -1 <= threshold <= 1:
        raise ValueError('checkpoint_every/top_k须为正整数，threshold须在[-1,1]')
    repo = Path(repo).resolve()
    paths = [safe_output(p, repo) if p else None for p in (cache_path, quality_cache_path)]
    cache_path, quality_cache_path = paths
    if cache_path and cache_path == quality_cache_path:
        raise ValueError('语义缓存与质量缓存不得互相覆盖')
    embedder = embedder if embedder is not None else LocalEmbedder(mode='rules')
    model_path = getattr(embedder, 'path', None) or embedder.identity.get('path')
    if model_path and any(p and p.is_relative_to(Path(model_path).resolve()) for p in paths):
        raise ValueError('输出不得覆盖本地模型目录')
    audit = validator.ArchiveAudit(repo, {}, quality_cache_path, full)
    quality = audit.run()
    report = {'schema_version': SCHEMA_VERSION, 'rules_version': RULES_VERSION,
              'generated_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'snapshot': quality['snapshot'], 'quality': quality,
              'model': dict(embedder.identity), 'records': {}, 'relations': [], 'duplicate_groups': [],
              'review_state': 'pending', 'blocked': bool(quality['summary']['errors'])}
    if report['blocked']:
        report['summary'] = {'entries': quality['summary']['entries'], 'new': 0, 'modified': 0,
                             'reused': 0, 'removed': 0, 'candidates': 0, 'by_relation': {}}
        report['notes'] = ['存在质量error；请先人工处理索引/来源/输入错误后重跑。']
        return report
    model_identity = dict(embedder.identity)
    engine = fingerprint([implementation_hash(), audit.cache.engine, model_identity, top_k, threshold])
    cache = SemanticCache(cache_path, engine, full)
    sources, entries = audit.read_indices()
    source_map = {s['source_id']: s for s in sources}
    features, vectors, metadata, manifest, dependencies = {}, {}, {}, {}, {}
    pending = []
    for position, entry in entries:
        source = source_map[entry['source_id']]
        section = audit.document(entry['knowledge_path'])[entry['entry_id']]
        identity = entry['entry_id']
        dependency = fingerprint([entry, source, section['body'],
                                  audit.files[(repo / source['path']).resolve()]])
        manifest[identity] = dependency
        dependencies[identity] = dependency
        # Section text, not the whole Markdown hash: appending a new card in the
        # same file must not re-encode all its unmodified neighbours.
        result = cache.run('features', 'feature:' + identity, dependency,
                           lambda e=entry, s=source, c=section: {
                               'feature': extract_features(e, s, c), 'vector': None, 'encoded': False})
        features[identity] = result['feature']
        metadata[identity] = provenance(entry, source, section, position, result['feature'])
        if result.get('encoded'):
            if result['vector'] is not None:
                vectors[identity] = result['vector']
        else:
            pending.append((identity, result))
    # Inference is batched and only runs for cache misses; checkpoint only fully
    # encoded features. A restarted process validates every dependency anew.
    encoded_count = 0
    for offset in range(0, len(pending), checkpoint_every):
        batch = pending[offset:offset + checkpoint_every]
        output = embedder.encode([(result['feature']['canonical'] or result['feature']['title']) for _, result in batch])
        if dict(embedder.identity) != model_identity:
            # Auto fallback must never publish a mixture of old model and rules
            # features. Start afresh using the adapter's reported rules identity.
            return scan(repo, cache_path, quality_cache_path, True, embedder,
                        checkpoint_every, top_k, threshold)
        if output is not None and len(output) != len(batch):
            raise ValueError('embedding返回条数不一致')
        for index, (identity, result) in enumerate(batch):
            vector = output[index] if output is not None else None
            if vector is not None:
                if (not vector or not all(isinstance(x, (float, int)) and math.isfinite(x) for x in vector)
                        or not any(vector)):
                    raise ValueError('embedding含空/零/非有限向量')
                vectors[identity] = vector
                encoded_count += 1
            result.update(vector=vector, encoded=True)
            # run() copies results and records checksums before inference.
            record = cache.current['feature:' + identity]
            record['result'] = result
            record['checksum'] = fingerprint(result)
        assert_stable(audit)
        if hasattr(embedder, 'assert_unchanged'):
            embedder.assert_unchanged()
        cache.checkpoint(manifest)
    pairs = lexical_candidates(features, top_k)
    embedding_candidates(vectors, pairs, top_k, threshold)
    relations = []
    for (left, right), generators in sorted(pairs.items()):
        similarity = cosine(vectors.get(left), vectors.get(right))
        result = cache.run('relations', 'pair:' + fingerprint([left, right]),
                           [left, right, dependencies[left], dependencies[right], similarity],
                           lambda a=left, b=right, v=similarity: classify(features[a], features[b], v))
        relations.append({**result, 'relation_id': 'KR-' + fingerprint([left, right, result['relation']])[:20],
                          'left_entry_id': left, 'right_entry_id': right,
                          'left': {'entry_id': left, 'source_id': metadata[left]['source_id']},
                          'right': {'entry_id': right, 'source_id': metadata[right]['source_id']},
                          'semantic_similarity': similarity, 'candidate_generators': sorted(generators),
                          'evidence': {side: {key: metadata[identity]['evidence'][key] for key in ('path', 'line')}
                                       for side, identity in [('left', left), ('right', right)]},
                          'review_state': 'pending'})
    assert_stable(audit, hash_content=True)
    if hasattr(embedder, 'assert_unchanged'):
        embedder.assert_unchanged()
    cache.checkpoint(manifest, complete=True)
    counts = collections.Counter(r['relation'] for r in relations)
    previous = cache.manifest
    report.update(model=dict(embedder.identity), records=metadata, relations=relations,
                  duplicate_groups=[{'group_id': r['relation_id'].replace('KR-', 'KG-'),
                                     'relation': r['relation'], 'members': [r['left_entry_id'], r['right_entry_id']],
                                     'relation_ids': [r['relation_id']], 'review_state': 'pending'} for r in relations
                                    if r['relation'] in ('exact_duplicate', 'semantic_duplicate', 'partial_overlap')],
                  summary={'entries': len(entries), 'new': len(manifest.keys() - previous.keys()),
                           'modified': sum(previous.get(k) != v for k, v in manifest.items() if k in previous),
                           'reused': cache.stats['features_reused'],
                           'removed': len(previous.keys() - manifest.keys()),
                           'candidates': len(relations), 'by_relation': dict(sorted(counts.items()))},
                  incremental={'enabled': bool(cache_path), 'full': full, **dict(cache.stats),
                               'features_encoded': encoded_count, 'checkpoint_every': checkpoint_every},
                  notes=[cache.note] if cache.note else [],
                  performance={'elapsed_ms': round((time.perf_counter() - started)*1000, 3)})
    return report


def markdown_report(report):
    def cell(value):
        if not isinstance(value, str):
            value = json.dumps(value, ensure_ascii=False, sort_keys=True)
        return value.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('|', '\\|').replace('\n', '<br>').replace('\r', '')
    lines = ['# 维修知识语义去重审核报告', '',
             '只读候选建议；全部待人工审核。分数不是事实正确率，不自动合并/删除/修改验证状态。', '',
             f"快照：`{report['snapshot']['sha256']}`", '',
             '```json', json.dumps({k: report.get(k) for k in ('summary', 'model', 'incremental', 'performance', 'blocked', 'notes')},
                                  ensure_ascii=False, indent=2), '```', '',
             '重复组仅记录直接关系，不把相似性传递成可合并关系。', '',
             '| 关系编号 / 分类 | 双方条目 / 来源 | 车型与适用条件 | 语义相似度 | 判断依据 | 原文位置 | 建议 / 状态 |',
             '|---|---|---|---|---|---|---|']
    for r in report['relations']:
        lines.append('| ' + ' | '.join(cell(x) for x in [
            r['relation_id'] + ' / ' + r['relation'],
            [r['left_entry_id'], r['left']['source_id'], r['right_entry_id'], r['right']['source_id']],
            [{'record_id': identity, 'models': report['records'][identity]['scope']['models']}
             for identity in (r['left_entry_id'], r['right_entry_id'])], r['semantic_similarity'], r['reasons'],
            r['evidence'], [r['recommended_action'], r['review_state']]]) + ' |')
    lines += ['', '## 条目范围与完整证据', '',
              '关系通过条目编号引用本表，范围和来源限制只列一次，避免报告重复膨胀。', '',
              '| 条目 / 来源 | 完整适用条件 | 原始核验状态 | 完整证据位置 |', '|---|---|---|---|']
    for identity, record in sorted(report.get('records', {}).items()):
        lines.append('| ' + ' | '.join(cell(x) for x in [
            [identity, record['source_id']], {'original': record['scope_original'], 'effective': record['scope']}, record['status_original'], record['evidence']]) + ' |')
    return '\n'.join(lines) + '\n'
