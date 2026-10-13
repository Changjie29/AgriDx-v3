import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { loadArchive } from '../server/knowledge/archive';
import { hasIndexedReference, referenceVerification } from '../server/knowledge/evidence';

function fixture(t: { after: (fn: () => void) => void }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agridx-archive-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const index = path.join(root, '农用拖拉机知识库');
  fs.mkdirSync(index);
  const document = path.join(root, 'fixture.md');
  fs.writeFileSync(document, '## TEST-001｜测试章节\n测试数据，不用于维修。\n');
  const source = { source_id: 'SRC-TEST-001', path: 'fixture.pdf', url: 'https://example.invalid/fixture', version: '测试版', scope_boundary: '仅测试' };
  const entry = { entry_id: 'TEST-001', source_id: source.source_id, brand: '测试品牌', model: 'TESTMODEL', title: '测试章节', knowledge_path: document, locator: '测试页1', status: '已核验', entry_type: '维护/故障知识' };
  const write = (sources = [source], entries = [entry]) => {
    fs.writeFileSync(path.join(index, 'sources.json'), JSON.stringify(sources));
    fs.writeFileSync(path.join(index, 'entries.jsonl'), entries.map(x => JSON.stringify(x)).join('\n'));
  };
  write();
  return { root, source, entry, document, write };
}

test('archive binds provenance only after a source and exact entry section exist', t => {
  const f = fixture(t);
  const { chunks } = loadArchive(f.root);
  assert.equal(chunks.length, 1);
  assert.equal(hasIndexedReference(chunks[0]), true);
  assert.deepEqual(chunks[0].indexedReference, { entryId: f.entry.entry_id, sourceId: f.source.source_id });
  assert.equal(hasIndexedReference({ ...chunks[0], sourceId: 'SRC-TEST-999' }), false);
});

test('archive rejects duplicate, malformed and unknown source identifiers', t => {
  const f = fixture(t);
  f.write([f.source, f.source]);
  assert.throws(() => loadArchive(f.root), /来源编号重复/);
  for (const source_id of ['SRC-TEST-001 ', 'SRC/TEST', 'src-test', 'SRC_001']) {
    f.write([{ ...f.source, source_id }]);
    assert.throws(() => loadArchive(f.root), /来源编号无效/);
  }
  f.write([f.source], [{ ...f.entry, source_id: 'SRC-MISSING' }]);
  assert.throws(() => loadArchive(f.root), /来源不存在/);
});

test('archive rejects duplicate or malformed entry IDs and missing sections', t => {
  const f = fixture(t);
  f.write([f.source], [f.entry, f.entry]);
  assert.throws(() => loadArchive(f.root), /条目编号重复/);
  f.write([f.source], [{ ...f.entry, entry_id: 'TEST-001 ' }]);
  assert.throws(() => loadArchive(f.root), /条目编号无效/);
  f.write();
  fs.writeFileSync(f.document, '## TEST-0010｜其他章节\n不是匹配条目。\n');
  assert.throws(() => loadArchive(f.root), /知识章节缺失/);
});

test('reference review statuses preserve uncertainty and do not imply vehicle validation', () => {
  assert.equal(referenceVerification('已核验；未厂家复核/实车验证'), 'verified');
  assert.equal(referenceVerification('未核验；已核验'), 'unverified');
  assert.equal(referenceVerification('已核验；待核实'), 'pending');
  assert.equal(referenceVerification('沿用既有原文核对条目'), 'unspecified');
  assert.equal(referenceVerification(), 'unspecified');
});
