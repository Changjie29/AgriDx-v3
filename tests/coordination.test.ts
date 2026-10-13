import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { assessEvidence, coordinationConfig, decideCoordination, isDiagnosisMode } from '../server/knowledge/coordination';
import type { KnowledgeChunk } from '../server/knowledge/retriever';
const oldMode = process.env.DIAGNOSIS_MODE;
const oldAllow = process.env.ALLOW_EXTERNAL_AI;
beforeEach(() => { delete process.env.DIAGNOSIS_MODE; delete process.env.ALLOW_EXTERNAL_AI; });
afterEach(() => {
  if (oldMode === undefined) delete process.env.DIAGNOSIS_MODE; else process.env.DIAGNOSIS_MODE = oldMode;
  if (oldAllow === undefined) delete process.env.ALLOW_EXTERNAL_AI; else process.env.ALLOW_EXTERNAL_AI = oldAllow;
});
const scope = { brand: '东方红', model: 'LF904S', machineType: '拖拉机' };
// Synthetic fully-reviewed fixture, not a new real-world maintenance fact.
const source: KnowledgeChunk = { source: 'fixture.md', heading: 'TEST-001｜测试资料章节', text: '测试数据，不用于维修。',
  entryId: 'TEST-001', sourceId: 'SOURCE-001', entryType: '维护/故障知识', applicability: 'matched', locator: '测试页1',
  indexedReference: { entryId: 'TEST-001', sourceId: 'SOURCE-001' },
  version: '测试版', status: '已核验', scopeBoundary: '仅适用于测试车型LF904S' };
const input = { query: '查看测试资料章节', currentQuery: '查看测试资料章节', scope, retrieved: [source], clarificationNeeded: false, llmConfigured: true };
test('exact reviewed reference lookup uses local evidence even when a model is configured', () => {
  assert.equal(decideCoordination(input).reason, 'direct_reference');
  assert.equal(decideCoordination(input).route, 'local');
});
test('keyword hits and uncertain applicability cannot masquerade as sufficient evidence', () => {
  for (const change of [{ applicability: 'pending' as const }, { sourceId: undefined }, { locator: undefined }, { status: '未核验' }, { scopeBoundary: '市场待核实' }, { entryType: '资料索引' }]) {
    assert.notEqual(assessEvidence(input.query, input.currentQuery, [{ ...source, ...change }], scope), 'direct_reference');
  }
  assert.equal(assessEvidence('动力不足', '为什么动力不足', [source], scope), 'partial');
  assert.equal(assessEvidence(input.query, input.currentQuery, [source, { ...source, entryId: 'TEST-002', heading: 'TEST-002｜测试资料章节', indexedReference: { entryId: 'TEST-002', sourceId: 'SOURCE-001' } }], scope), 'partial');
});
test('knowledge-only never requests a model, with or without credentials', () => {
  for (const llmConfigured of [true, false]) assert.equal(decideCoordination({ ...input, requestedMode: 'knowledge_only', llmConfigured }).reason, 'local_requested');
});
test('AI assisted uses AI even for a direct lookup, but degrades when no key exists', () => {
  assert.equal(decideCoordination({ ...input, requestedMode: 'ai_assisted' }).route, 'ai');
  assert.equal(decideCoordination({ ...input, requestedMode: 'ai_assisted', llmConfigured: false }).reason, 'llm_not_configured');
});
test('auto requests synthesis for partial material and general analysis for no material', () => {
  const diagnostic = { ...input, currentQuery: '为什么热车后动力不足' };
  assert.equal(decideCoordination(diagnostic).reason, 'synthesis_requested');
  assert.equal(decideCoordination({ ...diagnostic, retrieved: [] }).reason, 'insufficient_evidence');
  assert.equal(decideCoordination({ ...diagnostic, llmConfigured: false }).route, 'local');
});
test('identity conflict blocks AI in all three modes', () => {
  for (const requestedMode of ['auto', 'knowledge_only', 'ai_assisted'] as const) {
    assert.equal(decideCoordination({ ...input, requestedMode, clarificationNeeded: true }).route, 'clarify');
  }
});
test('missing identity blocks specific parameter or fault-code interpretation, not general symptom discussion', () => {
  assert.equal(decideCoordination({ ...input, scope: {}, currentQuery: '故障码是什么意思' }).reason, 'identity_required');
  assert.equal(decideCoordination({ ...input, scope: {}, currentQuery: '压力标准是多少' }).route, 'clarify');
  assert.equal(decideCoordination({ ...input, scope: {}, currentQuery: '热车后没劲', retrieved: [] }).route, 'ai');
});
test('server kill switches and malformed configuration cannot be bypassed by a client', () => {
  for (const value of ['false', 'FALSE', 'typo']) {
    process.env.ALLOW_EXTERNAL_AI = value;
    assert.equal(decideCoordination({ ...input, requestedMode: 'ai_assisted' }).route, 'local');
  }
  delete process.env.ALLOW_EXTERNAL_AI;
  process.env.DIAGNOSIS_MODE = 'knowledge_only';
  assert.equal(decideCoordination({ ...input, requestedMode: 'ai_assisted' }).reason, 'server_local_only');
  process.env.DIAGNOSIS_MODE = 'invalid';
  assert.equal(coordinationConfig().configValid, false);
  assert.equal(decideCoordination(input).reason, 'invalid_config');
});
test('invalid request modes are rejected rather than coerced', () => {
  for (const mode of [null, {}, 1, 'AUTO', 'unknown']) assert.equal(isDiagnosisMode(mode), false);
});

test('unregistered or mismatched source and entry IDs never qualify as direct evidence', () => {
  for (const change of [
    { indexedReference: undefined }, { sourceId: 'SOURCE-999' }, { entryId: 'TEST-999' },
    { heading: 'TEST-999｜测试资料章节' }, { sourceId: 'SOURCE-001 ' },
    { entryType: undefined }, { entryType: 'unknown' }, { locator: ' ' }, { version: ' ' },
  ]) assert.notEqual(assessEvidence(input.query, input.currentQuery, [{ ...source, ...change }], scope), 'direct_reference');
});

test('entry lookups use a complete ID rather than matching a longer or prefixed ID', () => {
  for (const currentQuery of ['查看TEST-0010', '查看OTHER-TEST-001', '查看TEST-001-EXTRA']) {
    assert.equal(assessEvidence(currentQuery, currentQuery, [source], scope), 'partial');
  }
  for (const currentQuery of ['查看 TEST-001', '查看（TEST-001）', '查看test-001']) {
    assert.equal(assessEvidence(currentQuery, currentQuery, [source], scope), 'direct_reference');
  }
});

test('negative, partial or ambiguous review statements cannot trigger direct answers', () => {
  for (const status of ['未核验；已核验', '待核验；已核验', '部分核验', '计划已核验', '仅封面已核验', '已核验？', '核验未完成；已核验', '沿用既有原文核对条目']) {
    assert.equal(assessEvidence(input.query, input.currentQuery, [{ ...source, status }], scope), 'partial', status);
  }
  assert.equal(assessEvidence(input.query, input.currentQuery, [{ ...source, status: '原文文本及页面图像已核验；中文自行概述' }], scope), 'direct_reference');
  for (const scopeBoundary of ['配置待确认', '市场未知', '版本不明确']) {
    assert.equal(assessEvidence(input.query, input.currentQuery, [{ ...source, scopeBoundary }], scope), 'partial');
  }
});
