import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { before, test } from 'node:test';
import { loadArchive } from '../server/knowledge/archive';
import { getKnowledgeCatalog, loadKnowledgeCatalog } from '../server/knowledge/catalog';
import { formatForPrompt, loadKnowledgeBase, retrieve } from '../server/knowledge/retriever';

const indexRoot = '知识库/整理后的知识库/农用拖拉机知识库';
const batchMarker = '-20261014-R100-';
const fields = ['故障现象', '可能原因', '诊断步骤', '维修建议', '资料来源', '验证状态'];
// The maintenance-branch baseline (c6a40ab) is kept independently of checkout depth.
const baselineLines = 1213;
const baselineSha256 = '466814d7c01b799ee33cbc8c63276dc67abb83c00664cd1be3f472d67b43a760';

interface Entry {
  entry_id: string;
  source_id: string;
  brand: string;
  model: string;
  models?: string[];
  title: string;
  knowledge_path: string;
  locator: string;
  status: string;
  scope_boundary?: string;
  emission_stage?: string;
  configuration?: 'CAB' | 'ROPS';
  drive_configuration?: '2WD' | '4WD';
  entry_type: string;
  summary?: string;
}

interface Source {
  source_id: string;
  path: string;
  url: string;
  version: string;
  scope_boundary: string;
  pdf_pages?: number;
  manual_pdf_pages?: number;
  models?: string[];
  verified_pdf_pages?: Record<string, string>;
  sha256?: string;
  bytes?: number;
  emission_stage?: string;
  emission_stage_unknown?: boolean;
  edition_warning?: string;
  emissions_evidence?: string;
}

interface Hierarchy {
  components: { id: string; parts: { id: string; evidence_terms: string[] }[] }[];
  entries: { entry_id: string; components: { component_id: string; part_ids: string[] }[] }[];
}

const indexText = fs.readFileSync(`${indexRoot}/entries.jsonl`, 'utf8');
const entries = indexText.trim().split(/\r?\n/).map((line) => JSON.parse(line) as Entry);
const batch = entries.filter((entry) => entry.entry_id.includes(batchMarker));
const sources = new Map((JSON.parse(fs.readFileSync(`${indexRoot}/sources.json`, 'utf8')) as Source[])
  .map((source) => [source.source_id, source]));
const hierarchy = JSON.parse(fs.readFileSync(`${indexRoot}/hierarchy.json`, 'utf8')) as Hierarchy;
const chunks = new Map(loadArchive().chunks.map((chunk) => [chunk.entryId, chunk]));
const ledger = JSON.parse(fs.readFileSync(`${indexRoot}/采集记录/20261014_新增维修知识100条.json`, 'utf8')) as {
  added_entries: number;
  distinct_original_symptoms: number;
  baseline_index_sha256: string;
  entries: { entry_id: string; source_id: string; case_key: string; title: string; models: string[]; pdf_pages: number[] }[];
};

function getField(text: string, field: string): string {
  const matches = text.split(/\r?\n/).filter((line) => line.startsWith(`- ${field}：`));
  assert.equal(matches.length, 1, `${field}: require exactly one field`);
  const value = matches[0].slice(`- ${field}：`.length).trim();
  assert.ok(value, `${field}: missing value`);
  return value;
}

function expectVerificationBoundary(status: string, entryId: string): void {
  assert.match(status, /(?:已|完成).*(?:图像|目视|视觉)/, entryId);
  assert.match(status, /未.*厂家/, entryId);
  assert.match(status, /未.*实车/, entryId);
  assert.match(status, /未.*全书/, entryId);
  assert.doesNotMatch(status, /实车(?:已验证|验证通过)|厂家(?:已验证|验证通过)/, entryId);
}

before(() => {
  loadKnowledgeBase();
  loadKnowledgeCatalog();
});

test('20261014 repair addition preserves the complete baseline and adds 100 unique factual entries', () => {
  const originalPrefix = indexText.split(/(?<=\n)/).slice(0, baselineLines).join('');
  assert.equal(crypto.createHash('sha256').update(originalPrefix).digest('hex'), baselineSha256,
    'the original 1213 JSONL entries must remain byte-for-byte unchanged');
  assert.equal(batch.length, 100);
  assert.equal(new Set(entries.map((entry) => entry.entry_id)).size, entries.length);
  for (const entry of batch) {
    assert.equal(entry.entry_type, '维护/故障知识', entry.entry_id);
    assert.equal(entry.summary, undefined, 'factual bodies must only be maintained in Markdown');
    assert.ok(!entries.slice(0, baselineLines).some((old) => old.entry_id === entry.entry_id), entry.entry_id);
  }
});

test('every new repair paragraph retains six fields, actual source pages and honest verification limits', () => {
  for (const entry of batch) {
    const chunk = chunks.get(entry.entry_id);
    const source = sources.get(entry.source_id);
    assert.ok(chunk && source, entry.entry_id);
    assert.equal(chunk.heading, `${entry.entry_id}｜${entry.title}`);
    for (const field of fields) getField(chunk.text, field);
    const citation = getField(chunk.text, '资料来源');
    for (const value of [entry.source_id, entry.locator, source.version, source.url]) {
      assert.ok(citation.includes(value), `${entry.entry_id}: citation missing ${value}`);
    }
    const pages = /PDF第([\d、—–-]+)页/.exec(entry.locator)?.[1];
    assert.ok(pages, `${entry.entry_id}: no physical PDF page locator`);
    const pageNumbers = pages.split('、').flatMap((part) => {
      const [first, last = first] = part.split(/[—–-]/).map(Number);
      assert.ok(first > 0 && last >= first, entry.entry_id);
      return Array.from({ length: last - first + 1 }, (_, i) => first + i);
    });
    for (const page of pageNumbers) {
      assert.ok(page <= (source.pdf_pages ?? source.manual_pdf_pages ?? 0), `${entry.entry_id}: PDF page outside manual`);
      assert.ok(source.verified_pdf_pages?.[String(page)], `${entry.entry_id}: cited page not visually checked`);
    }
    assert.match(entry.locator, /印刷/, entry.entry_id);
    expectVerificationBoundary(getField(chunk.text, '验证状态'), entry.entry_id);
    expectVerificationBoundary(entry.status, entry.entry_id);
    const prompt = formatForPrompt([chunk]);
    assert.ok(prompt.endsWith(chunk.text), `${entry.entry_id}: truncation must not hide citation or status`);
    for (const value of [entry.source_id, entry.locator, source.url, source.version, chunk.scopeBoundary, entry.status]) {
      assert.ok(value && prompt.includes(value), `${entry.entry_id}: prompt lost evidence metadata`);
    }
    if (entry.models) {
      assert.equal(new Set(entry.models).size, entry.models.length, entry.entry_id);
      assert.ok(entry.models.length > 0 && entry.models.every((model) => source.models?.includes(model)), entry.entry_id);
    }
  }
});

test('new navigation links have direct paragraph evidence and return the sole source body', () => {
  const components = new Map(hierarchy.components.map((component) => [component.id, component]));
  for (const entry of batch) {
    const links = hierarchy.entries.filter((record) => record.entry_id === entry.entry_id);
    const chunk = chunks.get(entry.entry_id)!;
    assert.equal(links.length, 1, entry.entry_id);
    assert.ok(links[0].components.length > 0, entry.entry_id);
    const model = entry.models?.[0] ?? sources.get(entry.source_id)?.models?.[0] ?? entry.model;
    for (const link of links[0].components) {
      const definition = components.get(link.component_id);
      assert.ok(definition, entry.entry_id);
      for (const partId of link.part_ids) {
        const part = definition.parts.find((candidate) => candidate.id === partId);
        assert.ok(part?.evidence_terms.some((term) => `${chunk.heading}\n${chunk.text}`.includes(term)),
          `${entry.entry_id}/${partId}: no direct textual evidence`);
      }
      const selected = getKnowledgeCatalog({ brand: entry.brand, model, component: link.component_id }).selected;
      const found = selected?.entries.find((candidate) => candidate.entryId === entry.entry_id);
      assert.ok(found, `${entry.entry_id}: missing from its component browser`);
      assert.equal(found.content, chunk.text, 'catalogue must not create a second factual body');
      assert.equal(found.locator, entry.locator);
      assert.equal(found.scopeBoundary, chunk.scopeBoundary);
    }
  }
});

test('new evidence is retrievable for its documented identity and refuses undocumented model or emission claims', () => {
  for (const entry of batch) {
    const source = sources.get(entry.source_id)!;
    const model = entry.models?.[0] ?? source.models?.[0] ?? entry.model;
    const context = { machineType: '拖拉机', brand: entry.brand, model };
    assert.ok(retrieve(entry.title, entries.length, context).some((chunk) => chunk.entryId === entry.entry_id),
      `${entry.entry_id}: missing for ${model}`);
    assert.ok(retrieve(entry.title, entries.length, { ...context, model: `${model}-UNSUPPORTED` })
      .every((chunk) => chunk.entryId !== entry.entry_id), `${entry.entry_id}: accepted an undocumented model`);
    if (!entry.emission_stage) {
      for (const stage of ['国三', '国四']) {
        assert.ok(retrieve(`${stage} ${entry.title}`, entries.length, context)
          .every((chunk) => chunk.entryId !== entry.entry_id), `${entry.entry_id}: established an unsupported ${stage} claim`);
      }
    }
  }
});

test('100 distinct manual cause-to-remedy pairs are published with their original table coordinates', () => {
  assert.equal(ledger.added_entries, 100);
  assert.equal(ledger.baseline_index_sha256, baselineSha256);
  assert.equal(ledger.entries.length, 100);
  assert.equal(new Set(ledger.entries.map((entry) => entry.entry_id)).size, 100);
  assert.equal(new Set(ledger.entries.map((entry) => entry.case_key)).size, 100,
    'different titles must not recount the same original cause-to-remedy pair');
  assert.deepEqual(new Set(ledger.entries.map((entry) => entry.entry_id)), new Set(batch.map((entry) => entry.entry_id)));
  const symptoms = new Set<string>();
  for (const published of ledger.entries) {
    const entry = batch.find((candidate) => candidate.entry_id === published.entry_id)!;
    const chunk = chunks.get(entry.entry_id)!;
    assert.equal(published.source_id, entry.source_id);
    assert.equal(published.title, entry.title);
    assert.deepEqual(published.models, entry.models);
    const coordinates = /^SRC-WT-TRACTOR-MANUAL\/(2-\d+)\/现象(\d+)\/原因\((\d+)\)→排除\((\d+)\)$/.exec(published.case_key);
    assert.ok(coordinates, published.case_key);
    assert.equal(coordinates[3], coordinates[4], `${published.case_key}: cause and remedy row mismatch`);
    for (const coordinate of [`表${coordinates[1]}`, `现象行${coordinates[2]}`, `原因(${coordinates[3]})对应排除(${coordinates[4]})`]) {
      assert.ok(entry.locator.includes(coordinate), `${entry.entry_id}: locator missing ${coordinate}`);
    }
    symptoms.add(getField(chunk.text, '故障现象').split('；')[0]);
    assert.match(getField(chunk.text, '可能原因'), /候选.*尚非确诊/, entry.entry_id);
    assert.match(getField(chunk.text, '诊断步骤'), /整理核对步骤.*原表.*未给独立检查程序/, entry.entry_id);
    assert.match(getField(chunk.text, '维修建议'), /确认这一候选原因后/, entry.entry_id);
  }
  assert.equal(symptoms.size, 46, '100 branch entries must not be reported as 100 distinct symptoms');
  assert.equal(ledger.distinct_original_symptoms, symptoms.size);
});

test('Weitai evidence keeps its original file and unresolved edition, emission and starting boundaries', () => {
  const source = sources.get('SRC-WT-TRACTOR-MANUAL')!;
  const manual = fs.readFileSync(source.path);
  assert.equal(source.bytes, 18415359);
  assert.equal(manual.length, source.bytes);
  assert.equal(source.pdf_pages, 107);
  assert.equal(source.sha256, 'a3218a10f3c156fa2db1db46153ea7f4aa06bfd9697db2c1e2679edbb4da4eed');
  assert.equal(crypto.createHash('sha256').update(manual).digest('hex'), source.sha256);
  assert.equal(source.emission_stage, undefined, 'a mixed source must not become a national-four manual');
  assert.equal(source.emission_stage_unknown, true,
    'the mixed original must explicitly prevent implicit emission inference from a G4-only subset');
  assert.match(source.version, /WT-SM-4\.1.*2020年05月第2版/);
  assert.match(source.scope_boundary, /2020年01月/);
  assert.match(source.scope_boundary, /GB20891-2014第三阶段/);
  assert.match(source.scope_boundary, /不对整册统一标记国四/);
  assert.match(source.scope_boundary, /PDF生成2023年.*不标成2023新版/);
  assert.match(source.scope_boundary, /起动安全章节.*用词差异.*不能拼接通用流程/);
  assert.match(source.edition_warning ?? '', /待厂家核实/);
  assert.match(source.emissions_evidence ?? '', /第三阶段.*不对整册统一标记国四/);
  assert.equal(source.models?.length, 24);
  for (const entry of batch) {
    assert.equal(entry.source_id, source.source_id);
    assert.equal(entry.emission_stage, undefined, entry.entry_id);
    assert.equal(chunks.get(entry.entry_id)!.emissionStageUnknown, true, entry.entry_id);
    assert.match(chunks.get(entry.entry_id)!.scopeBoundary!, /内部日期关系待核实/);
  }
});

test('manual steering wording remains searchable while actual unmanned and documented G4 scopes stay isolated', () => {
  const context = { machineType: '拖拉机', brand: '潍泰', model: 'TT804(G4)' };
  const found = retrieve('无人力转向', entries.length, context);
  for (const number of [52, 53]) {
    const entryId = `KB-WT-TT-20261014-R100-${String(number).padStart(3, '0')}`;
    assert.ok(found.some((chunk) => chunk.entryId === entryId),
      `${entryId}: original table phrase must not be interpreted as an unmanned tractor`);
  }
  for (const query of ['无人驾驶 人力转向失效', '无人驾驶 无人力转向', '无人农机 人力转向失效', '电动拖拉机 人力转向失效']) {
    assert.ok(retrieve(query, entries.length, context).every((chunk) => chunk.sourceId !== 'SRC-WT-TRACTOR-MANUAL'), query);
  }
  assert.ok(retrieve('无人作业失联，定位失效', entries.length,
    { machineType: '无人农机', brand: '鸿鹄', model: 'T70' })
    .some((chunk) => chunk.entryId === 'HH-T70-002'), 'genuine unmanned-machine knowledge remains available');
  const jd = retrieve('国四 不能起动', entries.length,
    { machineType: '拖拉机', brand: '约翰迪尔', model: '6E-1204(G4)' })
    .find((chunk) => chunk.entryId === 'KB-JD-6E-G4-OMTR115296-004');
  assert.ok(jd, 'a documented G4 source still answers matching national-four questions');
  assert.equal(jd.emissionStage, undefined, 'the original 6E entry relies on its source-declared G4 models');
  assert.equal(jd.applicability, 'matched', 'implicit G4 recognition stays available for a source without an unknown-stage flag');
  assert.notEqual(jd.emissionStageUnknown, true);
  const explicitG4 = retrieve('国四 启动电机转动过慢', entries.length,
    { machineType: '拖拉机', brand: '约翰迪尔', model: '6E-1204(G4)' })
    .find((chunk) => chunk.entryId === 'KB-JD-6E-G4-OMTR115296-049');
  assert.ok(explicitG4, 'existing explicit national-four evidence remains searchable');
  assert.equal(explicitG4.emissionStage, '国四');
});

test('the five Weitai front-drive branches only apply to 19 documented four-drive models', () => {
  const frontDrive = batch.filter((entry) => entry.drive_configuration === '4WD');
  assert.deepEqual(frontDrive.map((entry) => entry.entry_id), [40, 41, 42, 43, 44]
    .map((number) => `KB-WT-TT-20261014-R100-${String(number).padStart(3, '0')}`));
  const twoDriveModels = ['TT1600(G4)', 'TT1600-D(G4)', 'TT1400(G4)', 'TT1400-D(G4)', 'TT500-D'];
  const sourceModels = sources.get('SRC-WT-TRACTOR-MANUAL')!.models!;
  const fourDriveModels = sourceModels.filter((model) => !twoDriveModels.includes(model));
  for (const entry of batch.filter((candidate) => !frontDrive.includes(candidate))) {
    assert.deepEqual(entry.models, sourceModels, entry.entry_id);
  }
  for (const entry of frontDrive) {
    assert.deepEqual(entry.models, fourDriveModels, entry.entry_id);
    assert.match(entry.locator, /PDF第42、77页.*印刷第34、69页/, entry.entry_id);
    assert.equal(chunks.get(entry.entry_id)!.requiresExactModel, true);
    for (const model of twoDriveModels) {
      assert.ok(retrieve(entry.title, entries.length, { machineType: '拖拉机', brand: '潍泰', model })
        .every((chunk) => chunk.entryId !== entry.entry_id), `${entry.entry_id}: used for ${model}`);
    }
    for (const query of [entry.title, `2WD 两驱 ${entry.title}`]) {
      assert.ok(retrieve(query, entries.length, { machineType: '拖拉机', brand: '潍泰',
        ...(query === entry.title ? {} : { model: 'TT804(G4)' }) })
        .every((chunk) => chunk.entryId !== entry.entry_id), `${entry.entry_id}: unresolved/conflicting drive scope`);
    }
  }
});
