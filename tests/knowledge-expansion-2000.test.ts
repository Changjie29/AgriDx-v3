import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { test } from 'node:test';
import { loadArchive } from '../server/knowledge/archive';
import { getKnowledgeCatalog, loadKnowledgeCatalog } from '../server/knowledge/catalog';
import { formatForPrompt, loadKnowledgeBase, retrieve, stats } from '../server/knowledge/retriever';
import { createKnowledgeSnapshot } from '../scripts/lib/dev-preview.mjs';

const index = '知识库/整理后的知识库/农用拖拉机知识库';
interface Entry {
  entry_id: string; source_id: string; brand: string; model: string; models?: string[];
  title: string; knowledge_path: string; locator: string; status: string; entry_type: string;
}
interface Source {
  source_id: string; models?: string[]; model: string; brand: string; version: string;
  scope_boundary: string; pdf_pages?: number; manual_pdf_pages?: number;
  verified_pdf_pages: Record<string, string>; sha256?: string; document_type?: string; role?: string;
}
interface Proof {
  entry_id: string; source_id: string; pdf_page: number; printed_page: string;
  component_id: string; fact_sha256: string; pdf_fragment_sha256: string;
  review_prompt_sha256: string;
  review_method?: string; body_sha256?: string; source_pdf_sha256?: string; page_image_sha256?: string;
  reviewed_physical_pages?: number[]; component_ids?: string[]; locator?: string;
}
interface Manifest {
  collection_id: string; baseline_entries: number; added_entries: number; total_entries: number;
  baseline_index_bytes: number; baseline_index_sha256: string;
  baseline_documents_sha256: Record<string, string>; entries: Proof[];
  additional_non_batch_entries?: number;
  scope_reconciliation: { retained_original_entries: number; reused_existing_tractor_entries: number; genuinely_new_entries: number; excluded_navigation_count: number; reused_entry_ids: string[]; new_entry_ids: string[] };
  sources_reviewed: { source_id: string; added_entries: number; entry_ids: string[] }[];
}
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
// Git stores LF text, while Windows checkout may materialize CRLF. Hash the
// repository representation so the baseline proof is independent of checkout.
const repositoryBytes = (file: string) => Buffer.from(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(`${index}/采集记录/20261015_新增2000条正文知识.json`, 'utf8')) as Manifest;
const entries = fs.readFileSync(`${index}/entries.jsonl`, 'utf8').trim().split(/\r?\n/).map((s) => JSON.parse(s) as Entry);
const sources = new Map((JSON.parse(fs.readFileSync(`${index}/sources.json`, 'utf8')) as Source[]).map((s) => [s.source_id, s]));
const batchIds = new Set(manifest.entries.map((p) => p.entry_id));
const batch = entries.filter((e) => batchIds.has(e.entry_id));
const chunks = new Map(loadArchive().chunks.map((chunk) => [chunk.entryId!, chunk]));

test('the 2000-entry expansion preserves the baseline repository bytes and all existing fact documents', () => {
  assert.equal(manifest.added_entries, 2000);
  assert.equal(batch.length, 2000);
  assert.equal(batchIds.size, 2000);
  assert.equal(manifest.baseline_entries, 2213);
  assert.equal(manifest.total_entries, manifest.baseline_entries + manifest.added_entries + (manifest.additional_non_batch_entries ?? 0));
  const bytes = repositoryBytes(`${index}/entries.jsonl`);
  assert.equal(digest(bytes.subarray(0, manifest.baseline_index_bytes)), manifest.baseline_index_sha256);
  for (const [file, sha] of Object.entries(manifest.baseline_documents_sha256)) {
    assert.equal(digest(repositoryBytes(file)), sha, `${file}: existing facts must remain unchanged`);
  }
  assert.equal(manifest.sources_reviewed.reduce((sum, s) => sum + s.added_entries, 0), 2000);
  assert.deepEqual(new Set(manifest.sources_reviewed.flatMap((s) => s.entry_ids)), batchIds);
});

test('each new fact retains an explicit source, original page, scope and truthful review status', () => {
  const facts = new Set<string>();
  for (const proof of manifest.entries) {
    const entry = batch.find((e) => e.entry_id === proof.entry_id)!;
    const source = sources.get(entry.source_id)!;
    const chunk = chunks.get(entry.entry_id)!;
    assert.equal(chunk.heading, `${entry.entry_id}｜${entry.title}`);
    const manual = proof.review_method === 'manual_selected_pages';
    const fact = manual
      ? chunk.text.split('\n').filter(line => !/^(?:- )?(?:适用条件|适用限制|整理边界|证据|状态|核验状态)：/.test(line)).join('\n').trim()
      : chunk.text.match(/^- 事实概述：(.+)$/m)?.[1];
    assert.ok(fact, entry.entry_id);
    if (manual) {
      assert.equal(digest(chunk.text.replace(/\r\n/g, '\n')), proof.body_sha256, entry.entry_id);
      assert.equal(proof.source_pdf_sha256, source.sha256, entry.entry_id);
      assert.match(proof.page_image_sha256 ?? '', /^[a-f0-9]{64}$/);
      assert.ok(proof.reviewed_physical_pages?.includes(proof.pdf_page), entry.entry_id);
      for (const page of proof.reviewed_physical_pages ?? []) assert.ok(source.verified_pdf_pages[String(page)]?.trim(), `${entry.entry_id}/${page}`);
      assert.equal(entry.locator, proof.locator);
      assert.match(entry.status, /目视/);
      assert.match(entry.status, /未全书/);
      assert.ok(entry.locator.includes(`第${proof.pdf_page}`), entry.entry_id);
    } else {
      assert.equal(digest(fact), proof.fact_sha256, entry.entry_id);
      assert.match(proof.pdf_fragment_sha256, /^[a-f0-9]{64}$/);
      assert.match(proof.review_prompt_sha256, /^[a-f0-9]{64}$/);
      assert.ok(source.verified_pdf_pages[String(proof.pdf_page)]?.includes('2026-10-15'), entry.entry_id);
      assert.ok(entry.locator.includes(`PDF物理第${proof.pdf_page}页`), entry.entry_id);
      assert.match(entry.status, /二次自动图像复核/);
      assert.match(entry.status, /未全书人工审校、厂家复核或实车验证/);
    }
    const unique = `${entry.source_id}:${fact.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()}`;
    assert.ok(!facts.has(unique), `${entry.entry_id}: same-source duplicate fact`);
    facts.add(unique);
    assert.ok(proof.pdf_page > 0 && proof.pdf_page <= (source.pdf_pages ?? source.manual_pdf_pages)!, entry.entry_id);
    assert.ok(entry.locator.includes(proof.printed_page), entry.entry_id);
    assert.ok(chunk.scopeBoundary?.includes(source.scope_boundary), entry.entry_id);
    assert.equal(chunk.version, source.version);
    assert.ok(!['资料索引', '资料缺口', '资料核验', '机型资料', '系统适用边界'].includes(entry.entry_type));
    assert.ok(formatForPrompt([chunk]).includes(manual ? chunk.text : fact), entry.entry_id);
  }
});

test('every added fact is reachable in its existing model and component without fabricating part associations', () => {
  loadKnowledgeCatalog();
  const hierarchy = JSON.parse(fs.readFileSync(`${index}/hierarchy.json`, 'utf8')) as {
    entries: { entry_id: string; components: { component_id: string; part_ids: string[] }[] }[];
  };
  const links = new Map(hierarchy.entries.map((e) => [e.entry_id, e.components]));
  const cached = new Map<string, Set<string>>();
  for (const proof of manifest.entries) {
    const entry = batch.find((e) => e.entry_id === proof.entry_id)!;
    const source = sources.get(entry.source_id)!;
    const model = (entry.models ?? source.models ?? [source.model])[0];
    const key = `${entry.brand}:${model}:${proof.component_id}`;
    if (!cached.has(key)) {
      const view = getKnowledgeCatalog({ brand: entry.brand, model, component: proof.component_id });
      cached.set(key, new Set(view.selected!.entries.map((e) => e.entryId)));
    }
    assert.ok(cached.get(key)!.has(entry.entry_id), entry.entry_id);
    if (proof.review_method === 'manual_selected_pages') {
      assert.deepEqual(links.get(entry.entry_id)?.map(link => link.component_id), proof.component_ids);
    } else assert.deepEqual(links.get(entry.entry_id), [{ component_id: proof.component_id, part_ids: [] }]);
  }
});

test('browser snapshots carry the same 2000 fact bodies as server retrieval and keep scope conflicts excluded', () => {
  const snapshot = createKnowledgeSnapshot();
  const browserEntries = snapshot[`/${index}/entries.jsonl`].trim().split(/\r?\n/).map((s: string) => JSON.parse(s) as Entry);
  assert.deepEqual(browserEntries.filter((e: Entry) => batchIds.has(e.entry_id)), batch);
  for (const path of new Set(batch.map((e) => e.knowledge_path))) {
    assert.equal(snapshot[`/${path}`], fs.readFileSync(path, 'utf8'), path);
  }
  loadKnowledgeBase();
  assert.equal(stats().archivedEntries, entries.length);
  for (const source of manifest.sources_reviewed) {
    const entry = batch.find((e) => e.entry_id === source.entry_ids[0])!;
    const metadata = sources.get(entry.source_id)!;
    const model = (entry.models ?? metadata.models ?? [metadata.model])[0];
    const matches = retrieve(entry.title, 100, { machineType: '拖拉机', brand: entry.brand, model });
    assert.ok(matches.some((chunk) => batchIds.has(chunk.entryId!)), `${entry.source_id}: new facts can be retrieved`);
  }
  const cabEntries = batch.filter((entry) => entry.source_id === 'SRC-KB-LX2620-6C82063118' && chunks.get(entry.entry_id)!.configuration === 'CAB');
  assert.ok(cabEntries.length > 0);
  for (const entry of cabEntries) {
    assert.ok(entry.models?.length, `${entry.entry_id}: CAB facts need an exact model subset`);
    assert.ok(entry.models.every((model) => ['LX2620HSDC', 'LX2620HSDCC'].includes(model)), entry.entry_id);
  }
  const cabIds = new Set(cabEntries.map((entry) => entry.entry_id));
  const su = getKnowledgeCatalog({ brand: '久保田', model: 'LX2620SUHSD', component: 'cab' });
  assert.ok(su.selected!.entries.every((entry) => !cabIds.has(entry.entryId)));
  for (const query of ['东方红 LF1504 国四 起动', '沃得 WF1404-3 国四 保养', '久保田 LX2620HSDCX 保养']) {
    const found = retrieve(query, 100);
    assert.ok(found.every(chunk => chunk.entryType === '通识学习' && chunk.diagnosticEvidence === false && !chunk.indexedReference), query);
  }
});


test('the reconciled collection has exactly 2000 tractor facts and excludes independent navigation systems', () => {
  assert.equal(manifest.scope_reconciliation.retained_original_entries, 1858);
  assert.equal(manifest.scope_reconciliation.reused_existing_tractor_entries, 135);
  assert.equal(manifest.scope_reconciliation.genuinely_new_entries, 7);
  assert.equal(manifest.scope_reconciliation.excluded_navigation_count, 142);
  assert.equal(batch.filter(entry => entry.entry_id.includes('-20261013-C3-')).length, 135);
  assert.equal(new Set(manifest.scope_reconciliation.reused_entry_ids).size, 135);
  assert.equal(new Set(manifest.scope_reconciliation.new_entry_ids).size, 7);
  assert.equal(manifest.entries.filter(proof => proof.review_method === 'manual_selected_pages').length, 142);
  for (const entry of batch) {
    const source = sources.get(entry.source_id)!;
    assert.ok(!/配套|导航|辅助转向/.test(`${source.document_type ?? ''} ${source.role ?? ''}`), entry.entry_id);
    assert.ok(!['SRC-CHC-NX510-FEB2024', 'SRC-QX-QY210PRO-V01'].includes(entry.source_id), entry.entry_id);
  }
  assert.ok(!entries.some(entry => entry.entry_id.startsWith('KB2000-') && ['SRC-CHC-NX510-FEB2024', 'SRC-QX-QY210PRO-V01'].includes(entry.source_id)));
});
