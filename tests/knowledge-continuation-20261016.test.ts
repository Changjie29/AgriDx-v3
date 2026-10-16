import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { loadArchive } from '../server/knowledge/archive';
import { loadKnowledgeBase, retrieve } from '../server/knowledge/retriever';
import { getKnowledgeCatalog, loadKnowledgeCatalog } from '../server/knowledge/catalog';
import { generateLocalKnowledgeReply } from '../server/knowledge/fallbackDiagnosis';

const index = '知识库/整理后的知识库/农用拖拉机知识库';
const manifest = JSON.parse(fs.readFileSync(`${index}/采集记录/20261016_LF1504与M5续补.json`, 'utf8')) as { entry_ids: string[] };
const all = loadArchive().chunks;
const batch = all.filter(c => manifest.entry_ids.includes(c.entryId ?? ''));
loadKnowledgeBase();
loadKnowledgeCatalog();

test('18条续补分别来自10条LF1504与8条M5，保留选页与市场/排放边界', () => {
  assert.equal(batch.length, 18);
  assert.equal(batch.filter(c => c.sourceId === 'SRC-YTO-LF1504-SMLF150449010').length, 10);
  assert.equal(batch.filter(c => c.sourceId === 'SRC-KB-M5-3B79199724').length, 8);
  for (const c of batch) {
    assert.match(c.locator ?? '', /PDF第(?:103|105|107|167|168|169)页／印刷/);
    assert.match(c.text, /整理边界：/);
    assert.match(c.text, /未全书审校、厂家复核或实车验证/);
    assert.equal(c.entryType, '维护/故障知识');
    assert.equal(c.models?.length, c.sourceId === 'SRC-KB-M5-3B79199724' ? 2 : 1);
    if (c.brand === '东方红') assert.equal(c.emissionStage, '国三');
    else {
      assert.equal(c.emissionStage, undefined, '美国版不补造中国排放阶段');
      assert.match(c.scopeBoundary ?? '', /美国|U\.S\.A/);
    }
  }
});

test('18条均可按原完整型号检索，目录展示同一份事实正文', () => {
  for (const c of batch) {
    for (const model of c.models!) {
      const ctx = { machineType: '拖拉机', brand: c.brand, model };
      assert.ok(retrieve(`${c.brand} ${model} ${c.entryId} ${c.heading}`, 100, ctx).some(x => x.entryId === c.entryId), `${c.entryId}/${model}`);
      const entry = getKnowledgeCatalog({ brand: c.brand, model }).selected!.entries.find(e => e.entryId === c.entryId);
      assert.ok(entry, c.entryId);
      assert.equal(entry.content, c.text);
      assert.equal(entry.locator, c.locator);
      assert.equal(entry.sourceId, c.sourceId);
    }
  }
});

test('国四LF1504、未知M5及品牌未定不套用新增条目', () => {
  assert.ok(!retrieve('东方红 LF1504 国四 转向失灵', 100, { machineType: '拖拉机', brand: '东方红', model: 'LF1504' }).some(c => manifest.entry_ids.includes(c.entryId ?? '')));
  assert.ok(!retrieve('久保田 M5-111X 黑烟', 100, { machineType: '拖拉机', brand: '久保田', model: 'M5-111X' }).some(c => manifest.entry_ids.includes(c.entryId ?? '')));
  assert.ok(!retrieve('久保田 发动机冒黑烟', 100, { machineType: '拖拉机', brand: '久保田' }).some(c => manifest.entry_ids.includes(c.entryId ?? '')));
});

test('保留蓝白烟原表分组与非过热警告前提，不把候选或代码当确诊', () => {
  assert.match(batch.find(c => c.entryId === 'KB-KB-M5-20261016-105')!.text, /蓝白烟合列/);
  assert.match(batch.find(c => c.entryId === 'KB-KB-M5-20261016-107')!.text, /未过热|并未过热/);
  assert.match(batch.find(c => c.entryId === 'KB-KB-M5-20261016-107')!.text, /不能重新起动或指示灯仍亮/);
  const code = batch.find(c => c.entryId === 'KB-KB-M5-20261016-108')!;
  assert.match(code.text, /ERROR-ENG（ERROR-41）/);
  assert.match(code.text, /立即联系经销商/);
  assert.match(code.text, /不能据此直接更换/);
  assert.match(batch.find(c => c.entryId === 'KB-YTO-LF1504-041')!.text, /内部极板短路/);
});

test('M5实际本地答复携带原版次、证据页和经销商边界', () => {
  const c = batch.find(c => c.entryId === 'KB-KB-M5-20261016-107')!;
  const reply = generateLocalKnowledgeReply('久保田 M5-091 未过热警告灯亮', [c], { machineType: '拖拉机', brand: '久保田', model: 'M5-091' });
  assert.match(reply, /SRC-KB-M5-3B79199724/);
  assert.match(reply, /168/);
  assert.match(reply, /3B791/);
  assert.match(reply, /美国|U\.S\.A/);
});
