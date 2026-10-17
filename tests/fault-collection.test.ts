import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { test } from 'node:test';
import { loadArchive } from '../server/knowledge/archive';
import { getKnowledgeCatalog, loadKnowledgeCatalog } from '../server/knowledge/catalog';
import { formatForPrompt, loadKnowledgeBase, retrieve, stats } from '../server/knowledge/retriever';
import { resolveScope } from '../server/knowledge/scope';
import { createKnowledgeSnapshot } from '../scripts/lib/dev-preview.mjs';

const root = '知识库/整理后的知识库/农用拖拉机知识库';
const collectionId = 'tractor-fault-1000-20261014';
interface Entry {
  entry_id: string; source_id: string; brand: string; model: string; title: string;
  knowledge_path: string; locator: string; entry_type: string; status: string;
  scope_boundary: string; collection_id?: string; case_key?: string; models?: string[];
}
interface Source {
  source_id: string; path: string; url: string; version: string; scope_boundary: string;
  model: string; models?: string[]; pdf_pages: number; verified_pdf_pages: Record<string, string>;
}
interface Link { component_id: string; part_ids: string[] }
interface Component { id: string; name: string; parts: { id: string; evidence_terms: string[] }[] }
interface ManifestSource {
  source_id: string; original_pdf_path: string; selected_rows: number; pdf_pages: number[]; entry_ids: string[];
}
const entries = fs.readFileSync(`${root}/entries.jsonl`, 'utf8').split(/\r?\n/)
  .filter((line) => line.trim()).map((line) => JSON.parse(line) as Entry);
const batch = entries.filter((entry) => entry.collection_id === collectionId);
const sources = new Map((JSON.parse(fs.readFileSync(`${root}/sources.json`, 'utf8')) as Source[])
  .map((source) => [source.source_id, source]));
const hierarchy = JSON.parse(fs.readFileSync(`${root}/hierarchy.json`, 'utf8')) as {
  components: Component[]; entries: { entry_id: string; components: Link[] }[];
};
const components = new Map(hierarchy.components.map((component) => [component.id, component]));
const links = new Map(hierarchy.entries.map((entry) => [entry.entry_id, entry.components]));
const chunks = new Map(loadArchive().chunks.map((chunk) => [chunk.entryId, chunk]));
const manifest = JSON.parse(fs.readFileSync(`${root}/采集记录/20261014_故障处理1000条.json`, 'utf8')) as {
  collection_id: string; added_fault_cases: number; sources: ManifestSource[];
};
const normalize = (value: string) => value.replace(/[\s，。；：、,.!！?？:;]/g, '').toLowerCase();

function field(text: string, label: string, id: string): string {
  const matches = text.split(/\r?\n/).filter((line) => line.startsWith(`- ${label}：`));
  assert.equal(matches.length, 1, `${id}: exactly one ${label} field`);
  const value = matches[0].slice(`- ${label}：`.length).trim();
  assert.ok(value && !/^(?:待补|待整理|暂无|TODO|TBD|N\/A|[-—])(?:[。.]|$)/i.test(value), `${id}: ${label} is substantive`);
  return value;
}

function identity(entry: Entry) {
  const chunk = chunks.get(entry.entry_id)!;
  const symptom = field(chunk.text, '故障现象', entry.entry_id);
  const cause = field(chunk.text, '原表可能原因', entry.entry_id);
  // A few source-backed cases cite a prose fault explanation rather than a table.
  // Recover the primary component from the digest and its actual hierarchy link.
  const component = links.get(entry.entry_id)?.map((link) => components.get(link.component_id)!)
    .find((item) => createHash('sha256').update([
      entry.source_id, item.id, normalize(symptom), normalize(cause),
    ].join('|')).digest('hex') === entry.case_key);
  assert.ok(component, `${entry.entry_id}: case identity matches a real component link`);
  const componentName = entry.locator.match(/^故障表\/([^；]+)；/)?.[1];
  // Locators may retain an original source section name such as 电气与仪表.
  // When they use the catalog's component name, that name must agree too.
  const locatorComponent = hierarchy.components.find((item) => item.name === componentName);
  if (locatorComponent) assert.equal(component.id, locatorComponent.id, entry.entry_id);
  return { symptom, cause, component };
}

test('the fault collection contains 1000 distinct source-scoped cases with actual symptoms, candidates and remedies', () => {
  assert.equal(batch.length, 1000);
  assert.equal(new Set(batch.map((entry) => entry.entry_id)).size, 1000);
  assert.equal(new Set(batch.map((entry) => entry.case_key)).size, 1000);
  const cases = new Set<string>();
  for (const entry of batch) {
    assert.match(entry.entry_id, /^TF1000-[A-Z0-9]+-\d{3}$/);
    assert.match(entry.case_key!, /^[a-f0-9]{64}$/);
    assert.equal(entry.entry_type, '维护/故障知识');
    assert.equal('summary' in entry, false, `${entry.entry_id}: facts have one Markdown owner`);
    const chunk = chunks.get(entry.entry_id);
    assert.ok(chunk, entry.entry_id);
    assert.equal(chunk.heading, `${entry.entry_id}｜${entry.title}`);
    const { symptom, cause, component } = identity(entry);
    const key = [entry.source_id, component.id, normalize(symptom), normalize(cause)].join('|');
    assert.equal(entry.case_key, createHash('sha256').update(key).digest('hex'), entry.entry_id);
    assert.equal(cases.has(key), false, `${entry.entry_id}: duplicate case`);
    cases.add(key);
    const title = `${symptom.replace(/。$/, '')}：${cause.replace(/。$/, '')}`.replaceAll('｜', '/');
    assert.equal(entry.title, title);
    const remedy = field(chunk.text, '针对处理', entry.entry_id);
    field(chunk.text, '适用条件', entry.entry_id);
    assert.match(field(chunk.text, '整理边界', entry.entry_id), /候选|检验确认/);
    assert.ok(formatForPrompt([chunk]).includes(remedy), `${entry.entry_id}: remedy survives prompt formatting`);
    assert.match(entry.status, /页面图像已核(?:对|验)/);
    assert.match(entry.status, /未全书(?:审校)?、厂家(?:复核)?或实车验证/);
  }
});

test('each case retains the matching source, verified physical page and printed locator in its only fact body', () => {
  for (const entry of batch) {
    const source = sources.get(entry.source_id);
    assert.ok(source, entry.entry_id);
    const chunk = chunks.get(entry.entry_id)!;
    const evidence = field(chunk.text, '证据', entry.entry_id);
    assert.equal(evidence, `${entry.source_id}；${entry.locator}。`);
    const locator = entry.locator.match(/；PDF物理第(\d+)页；印刷(.+)$/);
    assert.ok(locator, `${entry.entry_id}: physical and printed pages both recorded`);
    const page = Number(locator[1]);
    assert.ok(page > 0 && page <= source.pdf_pages, `${entry.entry_id}: page is inside the source`);
    assert.ok(source.verified_pdf_pages[String(page)]?.trim(), `${entry.entry_id}: cited page has a verification record`);
    assert.equal(chunk.source, entry.knowledge_path);
    assert.equal(chunk.sourceId, entry.source_id);
    assert.equal(chunk.sourceUrl, source.url);
    assert.equal(chunk.originalPath, source.path);
    assert.equal(chunk.version, source.version);
    assert.equal(chunk.locator, entry.locator);
    assert.ok(chunk.scopeBoundary!.includes(source.scope_boundary));
    assert.ok(chunk.scopeBoundary!.includes(entry.scope_boundary), `${entry.entry_id}: indexed scope survives loading`);
    const applicableScope = field(chunk.text, '适用条件', entry.entry_id);
    assert.ok(chunk.scopeBoundary!.includes(applicableScope) ||
      applicableScope === '仅用于上述完整型号、版次及与本行相符的配置，须先核对铭牌和装置。',
    `${entry.entry_id}: the card retains its explicit scope or its source-scoped default`);
    assert.deepEqual(chunk.models, entry.models ?? source.models);
  }
  assert.equal(manifest.collection_id, collectionId);
  assert.equal(manifest.added_fault_cases, 1000);
  assert.equal(manifest.sources.reduce((sum, source) => sum + source.selected_rows, 0), 1000);
  assert.deepEqual(new Set(manifest.sources.flatMap((source) => source.entry_ids)), new Set(batch.map((entry) => entry.entry_id)));
  for (const record of manifest.sources) {
    const selected = batch.filter((entry) => entry.source_id === record.source_id);
    assert.equal(record.selected_rows, selected.length);
    assert.equal(record.original_pdf_path, sources.get(record.source_id)!.path);
    assert.deepEqual(new Set(record.entry_ids), new Set(selected.map((entry) => entry.entry_id)));
    const pages = selected.map((entry) => Number(entry.locator.match(/PDF物理第(\d+)页/)![1]));
    assert.deepEqual(record.pdf_pages, [...new Set(pages)].sort((a, b) => a - b));
  }
});

test('every new case is reachable through its source model and evidence-backed component and part links', () => {
  loadKnowledgeCatalog();
  const selections = new Map<string, ReturnType<typeof getKnowledgeCatalog>>();
  for (const entry of batch) {
    const { symptom, cause, component } = identity(entry);
    const entryLinks = links.get(entry.entry_id);
    assert.ok(entryLinks?.some((link) => link.component_id === component.id), entry.entry_id);
    assert.equal(new Set(entryLinks.map((link) => link.component_id)).size, entryLinks.length);
    const factText = [symptom, cause, field(chunks.get(entry.entry_id)!.text, '针对处理', entry.entry_id)].join('\n');
    for (const link of entryLinks) {
      const definition = components.get(link.component_id);
      assert.ok(definition, entry.entry_id);
      assert.equal(new Set(link.part_ids).size, link.part_ids.length);
      for (const id of link.part_ids) {
        const part = definition.parts.find((item) => item.id === id);
        assert.ok(part?.evidence_terms.some((term) => factText.includes(term)), `${entry.entry_id}: part ${id} has actual fact evidence`);
      }
    }
    const source = sources.get(entry.source_id)!;
    const model = (entry.models ?? source.models)?.[0] ?? source.model;
    const filters = { brand: entry.brand, model, component: component.id };
    const cacheKey = JSON.stringify(filters);
    if (!selections.has(cacheKey)) selections.set(cacheKey, getKnowledgeCatalog(filters));
    const displayed = selections.get(cacheKey)!.selected!.entries.find((item) => item.entryId === entry.entry_id);
    assert.ok(displayed, `${entry.entry_id}: reachable in the four-level browser`);
    assert.equal(displayed.content, chunks.get(entry.entry_id)!.text);
    assert.equal(displayed.locator, entry.locator);
    assert.equal(displayed.sourceId, entry.source_id);
  }
});

test('health and the development website snapshot include all 1000 cases and their original Markdown cards', () => {
  loadKnowledgeBase();
  assert.equal(stats().archivedEntries, entries.length);
  const snapshot = createKnowledgeSnapshot();
  const snapshotEntries = snapshot[`/${root}/entries.jsonl`].split(/\r?\n/).filter((line: string) => line.trim())
    .map((line: string) => JSON.parse(line) as Entry);
  assert.equal(snapshotEntries.filter((entry: Entry) => entry.collection_id === collectionId).length, 1000);
  assert.deepEqual(snapshotEntries, entries);
  for (const file of new Set(batch.map((entry) => entry.knowledge_path))) {
    assert.equal(snapshot[`/${file}`], fs.readFileSync(file, 'utf8'), file);
  }
  assert.equal(snapshot[`/${root}/hierarchy.json`], fs.readFileSync(`${root}/hierarchy.json`, 'utf8'));
  assert.equal(snapshot[`/${root}/sources.json`], fs.readFileSync(`${root}/sources.json`, 'utf8'));
});

test('registered collection references never become machine identities or hide a real model conflict', () => {
  loadKnowledgeBase();
  const context = { machineType: '拖拉机', brand: '约翰迪尔', model: 'JD954' };
  const references = manifest.sources.map((source) => source.entry_ids[0]);
  references.push('TF1000-JD6B-002', 'tf1000-jd6b-002');
  for (const id of references) {
    const query = `参考资料${id}；起动机不转`;
    const scope = resolveScope(query, context);
    assert.equal(scope.identityConflict, false, id);
    assert.deepEqual(scope.models, ['jd954']);
    const found = retrieve(query, 100, context);
    assert.ok(found.some((chunk) => chunk.entryId === 'TF1000-JD6B-002'), id);
    assert.ok(found.every((chunk) => chunk.sourceId === 'SRC-JD-6B-L1-OMSU54855' ||
      chunk.entryType === '通识学习' && chunk.diagnosticEvidence === false && !chunk.sourceId), id);
  }
  for (const model of ['JD1104', '6E-1204(G4)', 'LX2620', 'JD9999']) {
    const query = `参考资料TF1000-JD6B-002；实际型号${model}，起动机不转`;
    assert.equal(resolveScope(query, context).identityConflict, true, model);
    assert.equal(retrieve(query, 100, context).length, 0, model);
  }
});
