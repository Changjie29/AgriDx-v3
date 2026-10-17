#!/usr/bin/env python3
"""Evaluate offline candidates against declared pair labels, never model labels.

The bundled corpus is a assistant-authored provisional synthetic regression set awaiting
domain review. Its scores must not be presented as real-world repair accuracy.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import time
import tracemalloc

sys.dont_write_bytecode = True
from knowledge_semantic_test import ArchiveFixture
from knowledge_quality import atomic_write, safe_output
from semantic_embedding import LocalEmbedder

REPO = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = Path(__file__).parent / 'fixtures/semantic-pairs.json'
RELATIONS = ('exact_duplicate', 'semantic_duplicate', 'partial_overlap',
             'complementary', 'scope_variant', 'uncertain')
DUPLICATES = {'exact_duplicate', 'semantic_duplicate'}
NOT_RETRIEVED = 'not_retrieved'


def ratio(numerator, denominator):
    return round(numerator / denominator, 6) if denominator else None


def load_dataset(path):
    raw = Path(path).read_bytes()
    dataset = json.loads(raw.decode('utf8'))
    if not isinstance(dataset, dict) or dataset.get('schema_version') != 1:
        raise ValueError('评估集须为schema_version=1的对象')
    if not isinstance(dataset.get('provenance'), dict):
        raise ValueError('评估集必须声明provenance，不能把模型输出当作真实标签')
    pairs = dataset.get('pairs')
    if not isinstance(pairs, list) or not pairs:
        raise ValueError('评估集pairs须为非空数组')
    identifiers = set()
    for pair in pairs:
        if not isinstance(pair, dict) or not isinstance(pair.get('id'), str) or not pair['id'].strip():
            raise ValueError('每对样本须有非空id')
        if pair['id'] in identifiers:
            raise ValueError('评估集样本id重复：' + pair['id'])
        identifiers.add(pair['id'])
        if pair.get('expected_relation') not in RELATIONS or not isinstance(pair.get('candidate_expected'), bool):
            raise ValueError(pair['id'] + '：须显式声明关系标签和candidate_expected布尔值')
        for side in ('left', 'right'):
            value = pair.get(side)
            if not isinstance(value, dict) or any(
                    not isinstance(value.get(key), str) or not value[key].strip() for key in ('title', 'model', 'body')):
                raise ValueError(pair['id'] + '：双方须有非空title/model/body；未知信息不可推测补齐')
    return dataset, hashlib.sha256(raw).hexdigest()


def process_peak_rss():
    try:
        import resource
        amount = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return int(amount if sys.platform == 'darwin' else amount * 1024)
    except (ImportError, AttributeError, OSError):
        return None


def evaluate(dataset, embedder):
    """Each pair goes through the real archive validator and scan candidate path."""
    rows = []
    confusion = {label: {predicted: 0 for predicted in (*RELATIONS, NOT_RETRIEVED)}
                 for label in RELATIONS}
    scan_elapsed = 0.0
    for pair in dataset['pairs']:
        with tempfile.TemporaryDirectory(prefix='agridx-semantic-evaluation-') as temporary:
            fixture = ArchiveFixture(temporary)
            fixture.add(pair['left'])
            fixture.add(pair['right'])
            started = time.perf_counter()
            report = fixture.scan(full=True, embedder=embedder)
            elapsed = (time.perf_counter() - started) * 1000
            scan_elapsed += elapsed
            if report['blocked']:
                raise ValueError(pair['id'] + '：合成归档未通过质量检查，不能据此计算语义指标')
            relation = next((item for item in report['relations']
                             if {item['left_entry_id'], item['right_entry_id']} == {'SYNTH-0', 'SYNTH-1'}), None)
            predicted = relation['relation'] if relation else NOT_RETRIEVED
            expected = pair['expected_relation']
            confusion[expected][predicted] += 1
            rows.append({'id': pair['id'], 'category': pair.get('category'),
                         'expected_relation': expected,
                         'candidate_expected': pair['candidate_expected'],
                         'candidate_retrieved': bool(relation),
                         'predicted_relation': predicted,
                         'matches_declared_relation': expected == predicted,
                         'semantic_similarity': relation['semantic_similarity'] if relation else None,
                         'candidate_generators': relation['candidate_generators'] if relation else [],
                         'reasons': relation['reasons'] if relation else [],
                         'elapsed_ms': round(elapsed, 3)})
    expected_candidates = sum(row['candidate_expected'] for row in rows)
    retrieved_expected = sum(row['candidate_expected'] and row['candidate_retrieved'] for row in rows)
    per_class = {}
    for label in RELATIONS:
        expected = sum(row['expected_relation'] == label for row in rows)
        predicted = sum(row['predicted_relation'] == label for row in rows)
        true_positive = confusion[label][label]
        per_class[label] = {'expected': expected, 'predicted': predicted, 'true_positive': true_positive,
                            'precision_against_declared_labels': ratio(true_positive, predicted),
                            'recall_against_declared_labels': ratio(true_positive, expected)}
    negatives = sum(row['expected_relation'] not in DUPLICATES for row in rows)
    false_positive = sum(row['expected_relation'] not in DUPLICATES and
                         row['predicted_relation'] in DUPLICATES for row in rows)
    negative_candidates = sum(not row['candidate_expected'] for row in rows)
    retrieved_negative = sum(not row['candidate_expected'] and row['candidate_retrieved'] for row in rows)
    return {'pairs': rows,
            'metrics_against_declared_labels': {
                'candidate_recall': {'retrieved': retrieved_expected, 'expected': expected_candidates,
                                     'value': ratio(retrieved_expected, expected_candidates)},
                'candidate_false_positive_rate': {'retrieved_negative': retrieved_negative, 'negative_pairs': negative_candidates,
                                                  'value': ratio(retrieved_negative, negative_candidates)},
                'classification': {'per_class': per_class, 'confusion': confusion,
                                   'not_retrieved': sum(not row['candidate_retrieved'] for row in rows),
                                   'declared_relation_match_rate': ratio(sum(row['matches_declared_relation'] for row in rows), len(rows)),
                                   'denominator': len(rows)},
                'duplicate_false_positive_rate': {'false_positive': false_positive, 'nonduplicate_pairs': negatives,
                                                   'value': ratio(false_positive, negatives)}},
            'metric_definitions': {
                'basis': 'against_declared_labels',
                'candidate_recall_denominator': '全部candidate_expected=true的样本，包括未召回样本；不按候选结果缩小分母。',
                'classification': '全部pairs进入confusion；未召回单列not_retrieved，仍进入逐类recall分母。没有预测的类别precision为null。',
                'duplicate_relations': sorted(DUPLICATES),
                'duplicate_false_positive_denominator': '全部expected_relation不是exact_duplicate或semantic_duplicate的样本。',
                'partial_overlap': '保留部分重叠供审核，不计为已确定重复。',
                'unrelated_control': 'candidate_expected=false的负对照仍列入分类矩阵，未召回会列not_retrieved。'},
            'scan_elapsed_ms': round(scan_elapsed, 3)}


def main():
    parser = argparse.ArgumentParser(description='离线评估语义候选；指标仅对照声明标签，不代表真实维修准确率')
    parser.add_argument('--dataset', type=Path, default=DEFAULT_DATASET)
    parser.add_argument('--mode', choices=('rules', 'auto', 'local'), default='rules')
    parser.add_argument('--model-dir', type=Path)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    dataset_path = args.dataset.resolve()
    target = safe_output(args.report, REPO) if args.report else None
    if target and (target == dataset_path or (args.model_dir and target.is_relative_to(args.model_dir.expanduser().resolve()))):
        raise ValueError('评估报告不得覆盖评估集或本地模型目录')
    dataset, dataset_hash = load_dataset(dataset_path)
    total_started = time.perf_counter()
    tracemalloc.start()
    try:
        model_started = time.perf_counter()
        embedder = LocalEmbedder(args.model_dir, mode=args.mode, batch_size=args.batch_size)
        model_ms = (time.perf_counter() - model_started) * 1000
        initial_identity = dict(embedder.identity)
        evaluation = evaluate(dataset, embedder)
        if dict(embedder.identity) != initial_identity:
            # Auto fallback invalidates earlier local-model rows as well.
            evaluation = evaluate(dataset, embedder)
        _, python_peak = tracemalloc.get_traced_memory()
        rss = process_peak_rss()
    finally:
        tracemalloc.stop()
    provenance = dataset['provenance']
    kind = ('provisional_synthetic_regression'
            if provenance.get('label_source') == 'assistant_authored_synthetic'
            else 'evaluation_against_declared_labels')
    result = {'schema_version': 1, 'evaluation_kind': kind,
              'label_provenance': provenance, 'label_verification': 'dataset_self_declared_not_independently_verified',
              'limitations': ['标签由评估集声明，脚本不使用模型判断生成expected，不验证标签来源真实性。',
                             '合成样本指标不是真实语料、领域专家标注或维修正确率；模型效果需独立人工标注集评估。',
                             '默认每对独立扫描，衡量声明样本对的候选和分类，不能代表全库top-k竞争或生产规模召回。',
                             'tracemalloc仅统计Python分配；进程峰值RSS如可用含本进程生命周期及原生依赖内存。'],
              'dataset': {'path': str(dataset_path), 'sha256': dataset_hash, 'pairs': len(dataset['pairs'])},
              'model': dict(embedder.identity), **evaluation,
              'performance': {'total_elapsed_ms': round((time.perf_counter() - total_started) * 1000, 3),
                              'model_load_elapsed_ms': round(model_ms, 3),
                              'scan_elapsed_ms': evaluation['scan_elapsed_ms'],
                              'python_tracemalloc_peak_bytes': python_peak,
                              'process_peak_rss_bytes': rss,
                              'process_peak_rss_available': rss is not None}}
    result.pop('scan_elapsed_ms')
    text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if target:
        atomic_write(target, text)
    print(text, end='')
    return 0


if __name__ == '__main__':
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding='utf-8')
    try:
        sys.exit(main())
    except (ValueError, OSError, RuntimeError) as error:
        print(f'评估失败：{error}', file=sys.stderr)
        sys.exit(1)
