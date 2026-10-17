import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { loadArchive } from '../server/knowledge/archive';
import { loadKnowledgeBase, retrieve, stats } from '../server/knowledge/retriever';
import { getKnowledgeCatalog, loadKnowledgeCatalog } from '../server/knowledge/catalog';
import { generateLocalKnowledgeReply } from '../server/knowledge/fallbackDiagnosis';

const index = '知识库/整理后的知识库/农用拖拉机知识库';
const record = JSON.parse(fs.readFileSync(`${index}/采集记录/20261015_LF1504缺口补充.json`, 'utf8')) as { entry_ids: string[] };
const archive = loadArchive().chunks;
const batch = archive.filter(chunk => record.entry_ids.includes(chunk.entryId ?? ''));
const context = { machineType: '拖拉机', brand: '东方红', model: 'LF1504' };
loadKnowledgeBase();
loadKnowledgeCatalog();

test('20条去重LF1504缺口记录具有唯一正文、精确范围与实际页码，不拆分原因凑数', () => {
  assert.equal(batch.length, 20);
  assert.equal(new Set(batch.map(c => c.heading)).size, 20);
  for (const chunk of batch) {
    assert.equal(chunk.sourceId, 'SRC-YTO-LF1504-SMLF150449010');
    assert.deepEqual(chunk.models, ['LF1504']);
    assert.equal(chunk.emissionStage, '国三');
    assert.match(chunk.locator ?? '', /PDF第10[012](?:、10[12])?页／印刷4-[123]/);
    assert.match(chunk.text, /候选|对应|方向|保护/);
    assert.match(chunk.text, /整理边界：/);
    assert.match(chunk.text, /未厂家复核、实车验证或全书审校/);
    assert.match(chunk.version ?? '', /SM-LF1504\.49\.010/);
  }
  assert.equal(batch.filter(c => c.entryType === '维护/故障知识').length, 20);
  assert.equal(batch.filter(c => c.entryType === '操作/维护知识').length, 0);
  for (const id of ['KB-YTO-LF1504-011', 'KB-YTO-LF1504-012', 'KB-YTO-LF1504-027']) {
    assert.ok(!archive.some(c => c.entryId === id), '已由main覆盖的3条不重复加入');
  }
});

test('全部新增条目可按完整型号检索，保留原有10条与跨页引用', () => {
  for (const chunk of batch) {
    const results = retrieve(`东方红 LF1504 国三 ${chunk.entryId} ${chunk.heading}`, 100, context);
    assert.ok(results.some(c => c.entryId === chunk.entryId), chunk.entryId);
  }
  assert.equal(archive.filter(c => /^KB-YTO-LF1504-00\d$|^KB-YTO-LF1504-010$/.test(c.entryId ?? '')).length, 10);
  assert.match(batch.find(c => c.entryId === 'KB-YTO-LF1504-021')!.locator!, /100、101/);
  assert.match(batch.find(c => c.entryId === 'KB-YTO-LF1504-029')!.locator!, /101、102/);
});

test('国四、其他LF型号和品牌未定不召回本批，四驱漏油不用于明确两驱', () => {
  for (const query of ['东方红 LF1504 国四 制动不足', '东方红 LF1504 国四 自动脱挡']) {
    assert.ok(!retrieve(query, 100, context).some(c => record.entry_ids.includes(c.entryId ?? '')));
  }
  assert.ok(!retrieve('东方红 LF804S 制动不足', 100, { ...context, model: 'LF804S' }).some(c => record.entry_ids.includes(c.entryId ?? '')));
  assert.ok(!retrieve('东方红 变速箱异响', 100, { machineType: '拖拉机', brand: '东方红' }).some(c => record.entry_ids.includes(c.entryId ?? '')));
  assert.ok(!retrieve('东方红 LF1504 两驱 前箱端四驱花键漏油', 100, context).some(c => c.entryId === 'KB-YTO-LF1504-016'));
});

test('目录与检索展示同一正文，新增条目有导航且未知型号不回退', () => {
  const catalog = getKnowledgeCatalog({ brand: '东方红', model: 'LF1504' });
  const selected = catalog.selected!.entries;
  for (const chunk of batch) {
    const entry = selected.find(e => e.entryId === chunk.entryId);
    assert.ok(entry, chunk.entryId);
    assert.equal(entry.content, chunk.text);
    assert.equal(entry.locator, chunk.locator);
    assert.equal(entry.version, chunk.version);
  }
  assert.equal(catalog.totals.archivedEntries, stats().archivedEntries);
  assert.equal(catalog.totals.mappedEntries, stats().archivedEntries);
  assert.throws(() => getKnowledgeCatalog({ brand: '东方红', model: 'LF1504-X' }), RangeError);
});

test('本地问答保留版本、证据页与候选边界，操作保护不被描述成坏件确诊', () => {
  const chunk = batch.find(c => c.entryId === 'KB-YTO-LF1504-028')!;
  const reply = generateLocalKnowledgeReply('LF1504 国三 制动跑偏', [chunk], context);
  assert.match(reply, /SRC-YTO-LF1504-SMLF150449010/);
  assert.match(reply, /101/);
  assert.match(reply, /国三/);
  assert.match(reply, /SM-LF1504/);
  assert.match(chunk.text, /停用|停机|核实/);
  assert.ok(archive.find(c => c.entryId === 'KB2000-20261015-YTOLF1504-028'), '已有操作保护条目保留');
});
