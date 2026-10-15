import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

test('offline semantic cleaning: labelled synthetic pairs, conservative guards, read-only outputs and incremental equivalence', () => {
  const result = spawnSync(python, ['-B', 'tests/knowledge_semantic_test.py', '-v'], {
    cwd: root, encoding: 'utf8', timeout: 90_000, shell: false,
    env: { ...process.env, PYTHONUTF8: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' },
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});

test('offline embedding adapter: CPU-only local loading, safe model files, chunking and explicit fallback', () => {
  const result = spawnSync(python, ['-B', 'tests/semantic_embedding_test.py', '-v'], {
    cwd: root, encoding: 'utf8', timeout: 60_000, shell: false,
    env: { ...process.env, PYTHONUTF8: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' },
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});

test('semantic review regressions: checkpoint safety, cache shapes, quality rule invalidation and legacy CLI encoding', () => {
  const result = spawnSync(python, ['-S', '-B', 'tests/semantic_safety_test.py', '-v'], {
    cwd: root, encoding: 'utf8', timeout: 60_000, shell: false,
    env: { ...process.env, PYTHONUTF8: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' },
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});

test('semantic evaluation keeps provisional label provenance and includes negative controls in its metrics', () => {
  const result = spawnSync(python, ['-S', '-B', 'tests/evaluate_semantic.py'], {
    cwd: root, encoding: 'utf8', timeout: 60_000, shell: false,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.evaluation_kind, 'provisional_synthetic_regression');
  assert.equal(report.label_provenance.review_state, 'pending_domain_review');
  assert.equal(report.metrics_against_declared_labels.classification.denominator, 20);
  assert.equal(report.metrics_against_declared_labels.candidate_recall.expected, 19);
  assert.equal(report.metrics_against_declared_labels.candidate_false_positive_rate.negative_pairs, 1);
  assert.equal(report.model.mode, 'rules');
});
