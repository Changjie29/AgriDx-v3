"""Regression tests for failures found by the independent read-only review."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
from knowledge_semantic_test import ArchiveFixture, FakeEmbedder, BASE, TOOLS, content
import knowledge_semantic as semantic


class ReviewRegressions(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='agridx-semantic-review-')
        self.addCleanup(self.temporary.cleanup)
        self.fixture = ArchiveFixture(self.temporary.name)
        self.fixture.add()
        self.fixture.add()

    def test_non_object_json_cache_is_a_safe_miss(self):
        for value in [[], None, 42, 'string']:
            with self.subTest(value=value):
                self.fixture.cache.parent.mkdir(parents=True, exist_ok=True)
                self.fixture.cache.write_text(json.dumps(value), encoding='utf8')
                report = self.fixture.scan(cached=True)
                self.assertEqual(report['summary']['reused'], 0)
                self.assertEqual(report['summary']['candidates'], 1)

    def test_quality_rule_identity_change_invalidates_semantic_features(self):
        self.fixture.scan(cached=True, embedder=FakeEmbedder())
        with patch.object(semantic.validator, 'RULES_VERSION', 'changed-quality-rule'):
            embedder = FakeEmbedder()
            report = self.fixture.scan(cached=True, embedder=embedder)
        self.assertEqual(report['summary']['reused'], 0)
        self.assertEqual(len(embedder.texts), 2)

    def test_model_change_before_checkpoint_cannot_publish_vectors(self):
        class ChangingModel(FakeEmbedder):
            def assert_unchanged(self):
                raise RuntimeError('model files changed during encoding')
        with self.assertRaisesRegex(RuntimeError, 'model files changed'):
            self.fixture.scan(cached=True, embedder=ChangingModel(), checkpoint_every=1)
        self.assertFalse(self.fixture.cache.exists())

    def test_legacy_evidence_only_card_has_no_invented_fields(self):
        self.fixture.body(1, '- 资料来源：SRC-SYNTH-1')
        report = self.fixture.scan()
        self.assertFalse(report['blocked'])
        for relation in report['relations']:
            self.assertNotIn(relation['relation'], ['exact_duplicate', 'semantic_duplicate'])

    def test_cli_default_legacy_pipe_does_not_write_even_bytecode(self):
        import os
        tools = self.fixture.root / '知识库/工具'
        tools.mkdir()
        for name in ['校验索引.py', 'knowledge_quality.py', 'knowledge_semantic.py',
                     'semantic_relations.py', 'semantic_embedding.py', '语义去重.py']:
            (tools / name).write_bytes((TOOLS / name).read_bytes())
        before = content(self.fixture.root)
        result = subprocess.run([sys.executable, str(tools / '语义去重.py')], capture_output=True,
                                env={**os.environ, 'PYTHONUTF8': '0', 'PYTHONIOENCODING': 'cp1252'}, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf8'))
        summary = json.loads(result.stdout.decode('utf8'))
        self.assertEqual(summary['model_mode'], 'rules')
        self.assertEqual(before, content(self.fixture.root))

    def test_cli_expands_model_tilde_before_protecting_report(self):
        spec = importlib.util.spec_from_file_location('semantic_cli', TOOLS / '语义去重.py')
        cli = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cli)
        model_dir = self.fixture.root / 'model'
        model_dir.mkdir()
        target = model_dir / 'config.json'
        with patch.object(sys, 'argv', ['语义去重.py', '--model-dir', '~/model', '--report', str(target)]), \
                patch.object(Path, 'expanduser', return_value=model_dir):
            with self.assertRaisesRegex(ValueError, '模型目录'):
                cli.main()
        self.assertFalse(target.exists())

    def test_lexical_ties_are_independent_of_token_iteration_order(self):
        import itertools
        features = {identity: {'tokens': []} for identity in ['a', 'b', 'c', 'd', 'e', *[f'f{i}' for i in range(8)]]}
        groups = {
            'b_half': ['a', 'b'],
            'b_tenth': ['a', 'b', *[f'f{i}' for i in range(8)]],
            'b_fifth1': ['a', 'b', 'f0', 'f1', 'f2'],
            'b_fifth2': ['a', 'b', 'f3', 'f4', 'f5'],
            'c_half1': ['a', 'c'], 'c_half2': ['a', 'c'],
            **{f'bd{i}': ['b', 'd'] for i in range(3)},
            **{f'ce{i}': ['c', 'e'] for i in range(3)},
        }
        for token, members in groups.items():
            for identity in members:
                features[identity]['tokens'].append(token)
        signatures = set()
        for order in itertools.permutations(['b_half', 'b_tenth', 'b_fifth1', 'b_fifth2']):
            features['a']['tokens'] = [*order, 'c_half1', 'c_half2']
            with patch.object(semantic, 'candidate_tokens', side_effect=lambda feature: feature['tokens']):
                pairs = semantic.lexical_candidates(features, 1)
            signatures.add(tuple(sorted(pairs)))
        self.assertEqual(len(signatures), 1, 'tied candidates must not depend on set/hash order')

    def test_unparsed_title_condition_difference_is_not_a_duplicate(self):
        from semantic_relations import extract_features, classify
        source = self.fixture.sources[0]
        left = {**self.fixture.entries[0], 'title': '冷态检查'}
        right = {**self.fixture.entries[0], 'title': '热态检查'}
        a = extract_features(left, source, {'body': BASE['body']})
        b = extract_features(right, source, {'body': BASE['body']})
        self.assertNotIn(classify(a, b, 0.9999)['relation'], ['exact_duplicate', 'semantic_duplicate'])

    def test_unit_prefix_case_and_unicode_negative_sign_cannot_be_duplicates(self):
        from semantic_relations import extract_features, classify
        for left, right in [('压力5MPa', '压力5mPa'), ('温度−5°C', '温度5°C'), ('扭矩5N·m', '长度5nm')]:
            with self.subTest(left=left, right=right):
                entry, source = self.fixture.entries[0], self.fixture.sources[0]
                a = extract_features(entry, source, {'body': left})
                b = extract_features(entry, source, {'body': right})
                self.assertEqual(classify(a, b, 0.9999)['relation'], 'uncertain')

    def test_registry_retains_original_scope_and_resolves_every_relationship(self):
        self.fixture.entries[0]['use'] = '仅冷态；必须停机。'
        self.fixture.write()
        report = self.fixture.scan()
        for relation in report['relations']:
            for side in ['left', 'right']:
                identity = relation[side]['entry_id']
                self.assertIn(identity, report['records'])
                self.assertEqual(report['records'][identity]['source_id'], relation[side]['source_id'])
        self.assertEqual(report['records']['SYNTH-0']['scope_original']['entry']['use'], '仅冷态；必须停机。')


if __name__ == '__main__':
    unittest.main()
