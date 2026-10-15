"""Offline adapter regressions with deterministic fake models, not accuracy claims."""
import copy
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '知识库/工具'))
from semantic_embedding import EmbeddingUnavailable, LocalEmbedder


class FakeTokenizer:
    def num_special_tokens_to_add(self, pair=False):
        return 2

    def encode(self, text, **kwargs):
        assert kwargs == {'add_special_tokens': False, 'truncation': False}
        return [ord(character) for character in text]

    def decode(self, tokens, **kwargs):
        assert kwargs == {'skip_special_tokens': False, 'clean_up_tokenization_spaces': False}
        return ''.join(chr(token) for token in tokens)


class FakeModel:
    max_seq_length = 6

    def __init__(self):
        self.tokenizer = FakeTokenizer()
        self.seen = []
        self.batches = []
        self.result = None

    def encode(self, texts, **kwargs):
        self.batches.append(kwargs)
        self.seen.extend(texts)
        assert all(len(text) <= self.max_seq_length - 2 for text in texts)
        return self.result if self.result is not None else [[len(text), 1] for text in texts]


class EmbeddingTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='agridx-embed-')
        self.addCleanup(temporary.cleanup)
        self.path = Path(temporary.name)
        (self.path / 'modules.json').write_text(json.dumps([
            {'type': 'sentence_transformers.models.Transformer', 'path': ''},
            {'type': 'sentence_transformers.models.Pooling', 'path': '1_Pooling'},
        ]), encoding='utf8')
        (self.path / 'model.safetensors').write_bytes(b'fake test weights')
        (self.path / '1_Pooling').mkdir()
        (self.path / '1_Pooling/config.json').write_text('{}', encoding='utf8')
        self.model = FakeModel()
        self.constructor_calls = []

        def constructor(*args, **kwargs):
            self.constructor_calls.append((args, kwargs))
            self.assertEqual(os.environ['HF_HUB_OFFLINE'], '1')
            return self.model

        self.package = types.SimpleNamespace(SentenceTransformer=constructor)

    def adapter(self, mode='local', **kwargs):
        with patch('semantic_embedding.importlib.metadata.version', return_value='test-1'), \
                patch('semantic_embedding.importlib.import_module', return_value=self.package):
            return LocalEmbedder(self.path, mode=mode, **kwargs)

    def test_default_and_explicit_rules_do_not_import_or_download(self):
        with patch('semantic_embedding.importlib.metadata.version') as version, \
                patch('semantic_embedding.importlib.import_module') as importer:
            auto = LocalEmbedder()
            rules = LocalEmbedder(self.path, mode='rules')
            self.assertIsNone(auto.encode(['维修知识']))
            self.assertIsNone(rules.encode(['维修知识']))
            self.assertEqual(auto.identity['mode'], 'rules')
            self.assertIn('不自动下载', auto.identity['reason'])
            importer.assert_not_called()
            version.assert_not_called()

    def test_explicit_local_missing_model_is_actionable_error(self):
        with self.assertRaises(EmbeddingUnavailable):
            LocalEmbedder(mode='local')

    def test_load_flags_cpu_offline_safe_weights_and_environment_restored(self):
        before = dict(os.environ)
        adapter = self.adapter()
        self.assertEqual(dict(os.environ), before)
        args, kwargs = self.constructor_calls[0]
        self.assertEqual(args, (str(self.path.resolve()),))
        self.assertEqual(kwargs['device'], 'cpu')
        self.assertTrue(kwargs['local_files_only'])
        self.assertFalse(kwargs['trust_remote_code'])
        self.assertEqual(kwargs['model_kwargs'], {'use_safetensors': True})
        self.assertEqual(kwargs['tokenizer_kwargs'], {'local_files_only': True, 'trust_remote_code': False})
        self.assertEqual(adapter.identity['mode'], 'local')
        self.assertFalse(adapter.identity['chunking']['truncation'])

    def test_identity_hashes_all_files_content_not_mtime(self):
        first = self.adapter().identity
        asset = self.path / '1_Pooling/config.json'
        original = asset.stat()
        asset.write_text('[]', encoding='utf8')
        os.utime(asset, ns=(original.st_atime_ns, original.st_mtime_ns))
        second = self.adapter().identity
        self.assertNotEqual(first['hash'], second['hash'])
        self.assertEqual(len(first['files']), 3)
        self.assertEqual(second, self.adapter().identity)
        with patch('semantic_embedding.importlib.metadata.version', return_value='test-2'), \
                patch('semantic_embedding.importlib.import_module', return_value=self.package):
            self.assertNotEqual(second['hash'], LocalEmbedder(self.path, mode='local').identity['hash'])

    def test_model_snapshot_change_fails_closed_even_in_auto_mode(self):
        adapter = self.adapter(mode='auto')
        self.assertEqual(adapter.path, self.path.resolve())
        adapter.assert_unchanged()
        asset = self.path / '1_Pooling/config.json'
        original = asset.stat()
        asset.write_text('[]', encoding='utf8')
        os.utime(asset, ns=(original.st_atime_ns, original.st_mtime_ns))
        with self.assertRaisesRegex(EmbeddingUnavailable, '快照不稳定'):
            adapter.assert_unchanged()
        self.assertEqual(adapter.identity['mode'], 'local')
        LocalEmbedder(mode='rules').assert_unchanged()

    def test_pickle_and_custom_modules_refused_before_dependency_import(self):
        for file, body in [('model.bin', b'unsafe'),
                           ('modules.json', b'[{"type":"remote.Custom","path":""}]'),
                           ('modules.json', b'[{"type":"sentence_transformers.models.Dense","path":""}]')]:
            with self.subTest(file=file):
                previous = (self.path / file).read_bytes() if (self.path / file).exists() else None
                (self.path / file).write_bytes(body)
                with patch('semantic_embedding.importlib.import_module') as importer:
                    adapter = LocalEmbedder(self.path)
                    self.assertEqual(adapter.identity['mode'], 'rules')
                    importer.assert_not_called()
                if previous is None:
                    (self.path / file).unlink()
                else:
                    (self.path / file).write_bytes(previous)

    def test_symlink_and_traversal_refused(self):
        (self.path / 'modules.json').write_text(
            '[{"type":"sentence_transformers.models.Transformer","path":"../outside"}]', encoding='utf8')
        with self.assertRaises(EmbeddingUnavailable):
            self.adapter()
        # Windows runners can lack symlink privileges; traversal still runs.
        link = self.path / 'alias.safetensors'
        try:
            link.symlink_to(self.path / 'model.safetensors')
        except OSError:
            return
        with self.assertRaises(EmbeddingUnavailable):
            self.adapter()

    def test_long_input_is_chunked_without_loss_and_normalized_cpu_batches(self):
        adapter = self.adapter(batch_size=2)
        texts = ['维修安全禁止启动拖拉机', '油温']
        vectors = adapter.encode(texts)
        self.assertEqual(''.join(self.model.seen), ''.join(texts))
        self.assertEqual(len(vectors), 2)
        self.assertTrue(all(abs(math.sqrt(sum(value * value for value in vector)) - 1) < 1e-12
                            for vector in vectors))
        self.assertTrue(all(item['device'] == 'cpu' and item['batch_size'] == 2
                            for item in self.model.batches))
        self.assertTrue(all(item['prompt'] == '' for item in self.model.batches))
        self.assertEqual(len(self.model.batches), 2)
        self.assertEqual(adapter.encode([]), [])

    def test_malformed_vectors_fail_local_and_auto_falls_back_entire_batch(self):
        for invalid in [[[math.nan, 1]], [[math.inf, 1]], [[0, 0]], [[]], [[True, 1]], []]:
            with self.subTest(invalid=invalid):
                self.model.result = invalid
                with self.assertRaises(EmbeddingUnavailable):
                    self.adapter().encode(['维修'])
                auto = self.adapter(mode='auto')
                original = copy.deepcopy(auto.identity)
                self.assertIsNone(auto.encode(['维修']))
                self.assertEqual(auto.identity['mode'], 'rules')
                self.assertNotEqual(original['hash'], auto.identity['hash'])
                self.assertTrue(auto.identity['reason'])

    def test_inconsistent_dimensions_are_not_silently_zipped(self):
        adapter = self.adapter()
        self.model.result = [[1, 1], [1, 1, 1]]
        with self.assertRaisesRegex(EmbeddingUnavailable, '维度'):
            adapter.encode(['维修', '油温'])

    def test_invalid_inputs_and_batch_size(self):
        for value in ['text', [None], [' '], [42]]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                LocalEmbedder().encode(value)
        for size in [0, -1, True, 1.5]:
            with self.subTest(size=size), self.assertRaises(ValueError):
                LocalEmbedder(batch_size=size)
        with self.assertRaises(ValueError):
            LocalEmbedder(mode='remote')


if __name__ == '__main__':
    unittest.main()
