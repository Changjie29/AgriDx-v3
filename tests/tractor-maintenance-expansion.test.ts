import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadKnowledgeBase, retrieve, type KnowledgeChunk } from '../server/knowledge/retriever';

const isLearningReference = (chunk: KnowledgeChunk) => chunk.entryType === '通识学习' &&
  chunk.diagnosticEvidence === false && !chunk.indexedReference && chunk.applicability !== 'matched';

before(() => loadKnowledgeBase());

test('new repair evidence answers distinct 6B starting and hydraulic symptoms', () => {
  const scope = { machineType: '拖拉机', brand: '约翰迪尔', model: 'JD954' };
  for (const [query, entryId] of [
    ['起动机完全不转动', 'KB-JD-6B-L1-006'],
    ['三点悬挂无法提升或提升缓慢', 'KB-JD-6B-L1-027'],
    ['制动踏板持续下沉', 'KB-JD-6B-L1-022'],
  ]) {
    const found = retrieve(query, 6, scope);
    const entry = found.find((chunk) => chunk.entryId === entryId);
    assert.ok(entry, `${query}: ${found.map((chunk) => chunk.entryId).join(', ')}`);
    assert.match(entry.locator ?? '', /PDF第\d+.*印刷300-/);
    assert.match(entry.scopeBoundary ?? '', /不|先|停止/);
    assert.ok(found.every((chunk) => !chunk.entryId || chunk.sourceId === 'SRC-JD-6B-L1-OMSU54855' || isLearningReference(chunk)));
  }
  assert.ok(retrieve('国四 起动机不转', 100, scope).every(isLearningReference));
  assert.ok(retrieve('起动机不转', 100, { ...scope, model: 'JD954-X' }).every(isLearningReference));
});

test('5E front-drive maintenance excludes two-drive models and explicit configuration conflicts', () => {
  const scope = { machineType: '拖拉机', brand: '约翰迪尔', model: '5E-854' };
  const entryIds = new Set(['KB-JD-5E-D0-012', 'KB-JD-5E-D0-051', 'KB-JD-5E-D0-052', 'KB-JD-5E-D0-053']);
  assert.ok(retrieve('前驱轮毂和桥壳分别检查油位', 6, scope).some((chunk) => chunk.entryId === 'KB-JD-5E-D0-052'));
  for (const model of ['5E-850', '5E-1000', '5E-1100', '5E-1200']) {
    assert.ok(retrieve('前驱轮毂和桥壳油位润滑换油', 312, { ...scope, model }).every((chunk) => !entryIds.has(chunk.entryId ?? '')));
  }
  assert.ok(retrieve('两驱 前驱轮毂和桥壳油位', 312, scope).every((chunk) => !entryIds.has(chunk.entryId ?? '')));
  const filter = retrieve('发动机初级空气滤芯禁止用压缩空气清洁', 6, scope)
    .find((chunk) => chunk.entryId === 'KB-JD-5E-D0-018');
  assert.ok(filter);
  assert.match(filter.text, /禁止用压缩空气/);
  assert.match(filter.locator ?? '', /PDF第99页.*230-1/);
});
