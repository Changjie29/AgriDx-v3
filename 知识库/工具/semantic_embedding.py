"""Optional, offline CPU embeddings for the review-only deduplication tool.

No dependency import, model discovery or download occurs in rule mode. Local
models must use standard Sentence Transformers modules and safetensors weights.
Failure in auto mode is an explicit, inspectable fallback, never a zero vector.
"""
from contextlib import contextmanager
import hashlib
import importlib
import importlib.metadata
import json
import math
import os
from pathlib import Path


ADAPTER_VERSION = '1.0.0'
CHUNKING = {'version': 1, 'strategy': 'contiguous-token-chunks',
            'pooling': 'token-weighted-mean-of-unit-vectors',
            'normalization': 'l2', 'truncation': False, 'prompt': ''}
STANDARD_MODULES = {
    'sentence_transformers.models.Transformer',
    'sentence_transformers.models.Pooling',
    'sentence_transformers.models.Normalize',
}
UNSAFE_SUFFIXES = {'.bin', '.pt', '.pth', '.pkl', '.pickle', '.ckpt', '.joblib'}


class EmbeddingUnavailable(RuntimeError):
    """A model was explicitly requested but cannot safely be used offline."""


def _fingerprint(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(',', ':')).encode('utf8')).hexdigest()


def _model_files(path):
    """Hash every regular file, refusing external or unstable model assets."""
    records = []
    for root, directories, files in os.walk(path, followlinks=False):
        for name in sorted(directories + files):
            item = Path(root) / name
            if item.is_symlink():
                raise ValueError('本地模型不接受符号链接：' + item.relative_to(path).as_posix())
        for name in sorted(files):
            item = Path(root) / name
            if not item.is_file():
                raise ValueError('本地模型包含非普通文件')
            before = item.stat()
            digest = hashlib.sha256()
            with item.open('rb') as handle:
                for block in iter(lambda: handle.read(1024 * 1024), b''):
                    digest.update(block)
            after = item.stat()
            if (before.st_size, before.st_mtime_ns, before.st_ino) != (
                    after.st_size, after.st_mtime_ns, after.st_ino):
                raise ValueError('本地模型在哈希期间变化')
            records.append({'path': item.relative_to(path).as_posix(),
                            'bytes': after.st_size, 'sha256': digest.hexdigest()})
    return sorted(records, key=lambda item: item['path'])


def _safe_model(path, files):
    if not files:
        raise ValueError('本地模型目录为空')
    unsafe = [item['path'] for item in files if Path(item['path']).suffix.lower() in UNSAFE_SUFFIXES]
    if unsafe:
        raise ValueError('仅接受safetensors权重；不加载pickle/旧格式权重：' + ', '.join(unsafe))
    if not any(item['path'].endswith('.safetensors') for item in files):
        raise ValueError('未找到本地safetensors权重')
    modules = json.loads((path / 'modules.json').read_text('utf8'))
    if not isinstance(modules, list) or not modules:
        raise ValueError('本地模型需要标准Sentence Transformers modules.json')
    for module in modules:
        if not isinstance(module, dict) or module.get('type') not in STANDARD_MODULES:
            raise ValueError('拒绝自定义或远程Sentence Transformers模块')
        relative = module.get('path', '')
        if not isinstance(relative, str) or not (path / relative).resolve().is_relative_to(path):
            raise ValueError('模型模块路径越出本地目录')


@contextmanager
def _offline_environment():
    # The library's own local_files_only flag remains mandatory. These flags also
    # cover optional integrations during import and loading; restore the caller.
    names = ('HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE', 'HF_HUB_DISABLE_TELEMETRY', 'DO_NOT_TRACK')
    previous = {name: os.environ.get(name) for name in names}
    try:
        os.environ.update({name: '1' for name in names})
        yield
    finally:
        for name, value in previous.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value


def _unit(vector):
    if hasattr(vector, 'tolist'):
        vector = vector.tolist()
    if not isinstance(vector, (list, tuple)) or not vector:
        raise ValueError('嵌入向量为空或不是一维数组')
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) or
           not math.isfinite(value) for value in vector):
        raise ValueError('嵌入向量含非数值或NaN/Infinity')
    norm = math.sqrt(math.fsum(value * value for value in vector))
    if not math.isfinite(norm) or norm == 0:
        raise ValueError('嵌入向量范数为零或无效')
    return [value / norm for value in vector]


class LocalEmbedder:
    """Rule fallback or an explicitly supplied local, safe CPU model.

    ``identity`` must be read *after* encode: an auto-mode inference failure
    changes it to rule mode. The caller must then discard the run's semantic
    features and report the fallback, rather than mix model and rule caches.
    """
    def __init__(self, path=None, mode='auto', batch_size=16):
        if mode not in {'auto', 'local', 'rules'}:
            raise ValueError('embedding mode必须为auto、local或rules')
        if isinstance(batch_size, bool) or not isinstance(batch_size, int) or batch_size < 1:
            raise ValueError('batch_size必须为正整数')
        self.mode, self.batch_size, self.model = mode, batch_size, None
        self.path = None
        self.dimension = None
        self._base = {'adapter_version': ADAPTER_VERSION, 'chunking': dict(CHUNKING)}
        self.identity = {}
        if mode == 'rules':
            self._fallback('显式选择规则模式。')
            return
        if not path:
            self._fail('未指定本地模型目录；不自动下载模型。')
            return
        try:
            directory = Path(path).expanduser().resolve(strict=True)
            self.path = directory
            if not directory.is_dir():
                raise ValueError('本地模型路径必须为目录')
            files = _model_files(directory)
            _safe_model(directory, files)
            dependencies = {}
            for package in ('sentence-transformers', 'transformers', 'torch', 'tokenizers', 'safetensors'):
                dependencies[package] = importlib.metadata.version(package)
            with _offline_environment():
                sentence_transformers = importlib.import_module('sentence_transformers')
                self.model = sentence_transformers.SentenceTransformer(
                    str(directory), device='cpu', local_files_only=True,
                    trust_remote_code=False, model_kwargs={'use_safetensors': True},
                    tokenizer_kwargs={'local_files_only': True, 'trust_remote_code': False})
            if files != _model_files(directory):
                raise ValueError('模型文件在加载期间变化')
            self.max_tokens = int(self.model.max_seq_length)
            specials = self.model.tokenizer.num_special_tokens_to_add(pair=False)
            if isinstance(specials, bool) or not isinstance(specials, int) or specials < 0:
                raise ValueError('分词器特殊token数量无效')
            self.content_tokens = self.max_tokens - specials
            if self.content_tokens < 1 or self.max_tokens > 1000000:
                raise ValueError('模型最大token长度无效')
            self.identity = {**self._base, 'mode': 'local', 'id': directory.name,
                             'path': str(directory), 'files': files,
                             'dependencies': dependencies, 'device': 'cpu',
                             'max_tokens': self.max_tokens, 'content_tokens': self.content_tokens,
                             'reason': None}
            self.identity['hash'] = _fingerprint(self.identity)
        except Exception as error:
            self._fail(str(error))

    def _fallback(self, reason):
        self.model = None
        self.identity = {**self._base, 'mode': 'rules', 'id': 'rules-only', 'reason': reason}
        self.identity['hash'] = _fingerprint(self.identity)

    def _fail(self, reason):
        if self.mode == 'local':
            raise EmbeddingUnavailable('本地embedding不可用：' + reason)
        self._fallback('本地embedding不可用，已回退规则模式：' + reason)

    def assert_unchanged(self):
        """Refuse a completed report/cache if model files changed during a run.

        This is a snapshot error even in auto mode: fallback cannot make an
        already computed mixture of semantic features trustworthy.
        """
        if self.identity.get('mode') != 'local':
            return
        try:
            if _model_files(self.path) != self.identity['files']:
                raise ValueError('本地模型文件在扫描期间变化，请重新运行')
        except Exception as error:
            raise EmbeddingUnavailable('模型快照不稳定：' + str(error)) from error

    def _chunks(self, text):
        tokenizer = self.model.tokenizer
        tokens = tokenizer.encode(text, add_special_tokens=False, truncation=False)
        if not isinstance(tokens, list) or not tokens:
            raise ValueError('非空正文未产生有效token')
        if len(tokens) <= self.content_tokens:
            return [(text, len(tokens))]
        output = []

        def add(part):
            decoded = tokenizer.decode(part, skip_special_tokens=False, clean_up_tokenization_spaces=False)
            again = tokenizer.encode(decoded, add_special_tokens=False, truncation=False)
            if not decoded.strip() or not again:
                raise ValueError('分块无法保留非空token内容')
            if len(again) > self.content_tokens:
                if len(part) == 1:
                    raise ValueError('单token重编码仍超过模型窗口，拒绝静默截断')
                middle = len(part) // 2
                add(part[:middle])
                add(part[middle:])
            else:
                output.append((decoded, len(part)))

        for start in range(0, len(tokens), self.content_tokens):
            add(tokens[start:start + self.content_tokens])
        return output

    def encode(self, texts):
        """Return one unit vector per text, or None in inspectable rule mode."""
        if not isinstance(texts, (list, tuple)) or any(
                not isinstance(text, str) or not text.strip() for text in texts):
            raise ValueError('texts必须为非空字符串列表')
        if self.model is None:
            return None
        if not texts:
            return []
        try:
            chunks = [(owner, text, weight) for owner, original in enumerate(texts)
                      for text, weight in self._chunks(original)]
            sums = [None for _ in texts]
            for start in range(0, len(chunks), self.batch_size):
                batch = chunks[start:start + self.batch_size]
                vectors = self.model.encode([item[1] for item in batch], batch_size=self.batch_size,
                                            convert_to_numpy=True, normalize_embeddings=False,
                                            show_progress_bar=False, device='cpu', prompt='')
                if hasattr(vectors, 'tolist'):
                    vectors = vectors.tolist()
                if not isinstance(vectors, (list, tuple)) or len(vectors) != len(batch):
                    raise ValueError('模型返回向量数量与输入不一致')
                for (owner, _, weight), vector in zip(batch, vectors):
                    unit = _unit(vector)
                    if self.dimension is None:
                        self.dimension = len(unit)
                    if len(unit) != self.dimension:
                        raise ValueError('模型返回的向量维度不一致')
                    if sums[owner] is None:
                        sums[owner] = [0.0] * self.dimension
                    sums[owner] = [a + b * weight for a, b in zip(sums[owner], unit)]
            return [_unit(vector) for vector in sums]
        except Exception as error:
            self._fail(str(error))
            return None
