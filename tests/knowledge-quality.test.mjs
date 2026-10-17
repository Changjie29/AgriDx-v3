import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { referenceVerification } from '../server/knowledge/evidence.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

test('offline archive validator: malformed data, formats, provenance, incremental invalidation and read-only reports', () => {
  const result = spawnSync(python, ['-B', 'tests/knowledge_quality_test.py', '-v'], {
    cwd: root, encoding: 'utf8', timeout: 60_000, shell: false,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});

test('quality classifications match the unchanged runtime parser for every existing and adversarial status', () => {
  const entries = readFileSync(new URL('../知识库/整理后的知识库/农用拖拉机知识库/entries.jsonl', import.meta.url), 'utf8')
    .trim().split(/\r?\n/).map(JSON.parse);
  const statuses = [...new Set(entries.map(x => x.status)), '', '未核验；已核验', '已核验；待核实',
    '计划已核验', '已核验？', '已核验；未厂家复核/实车验证', '部分核验', '证据页已核验',
    '核验失败；已核验', '证据不符', 'review_failed', '已核对证据页；未实车验证'];
  for (const legacyPipe of [false, true]) {
    const result = spawnSync(python, ['-B', '-c',
      'import sys,json; sys.stdin.reconfigure(encoding="utf-8"); sys.path.insert(0,"知识库/工具"); from knowledge_quality import reference_verification; print(json.dumps([reference_verification(s) for s in json.load(sys.stdin)]))'], {
      cwd: root, encoding: 'utf8', input: JSON.stringify(statuses), timeout: 10_000, shell: false,
      env: legacyPipe ? { ...process.env, PYTHONUTF8: '0', PYTHONIOENCODING: 'cp1252' } : process.env,
    });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), statuses.map(referenceVerification));
  }
});
