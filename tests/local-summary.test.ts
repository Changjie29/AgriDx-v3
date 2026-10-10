import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localReplySummary } from '../server/knowledge/fallbackDiagnosis';

test('local summary keeps the symptom, acknowledges brand, asks two focused questions', () => {
  const text = localReplySummary('热车后动力不足', [], { brand: '东方红' }, 'not_configured');
  assert.match(text, /东方红/);
  assert.match(text, /热车后动力不足/);
  assert.match(text, /没有模型补充分析/);
  assert.match(text, /发动机转速/);
  assert.equal((text.match(/^\d\./gm) || []).length, 2);
  assert.ok(text.length < 650);
  assert.doesNotMatch(text, /MD5|原始资料|启动机/);
});

test('identity conflict pauses guidance and known model is not requested again', () => {
  const conflict = localReplySummary('热车后动力不足', [], {}, 'not_configured', true);
  assert.match(conflict, /暂停引用/);
  assert.doesNotMatch(conflict, /发动机转速/);
  const known = localReplySummary('热车后动力不足', [], { brand: '东方红', model: 'LF904S' }, 'provider_unavailable');
  assert.doesNotMatch(known, /能提供铭牌/);
  assert.match(known, /报警或故障码/);
});
