import type { KnowledgeChunk } from './retriever';

/** IDs are exact index keys, not fuzzy search terms. */
export function isArchiveId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(value);
}

/** This describes reference review only, never manufacturer or vehicle validation. */
export function referenceVerification(status?: string): 'verified' | 'pending' | 'unverified' | 'unspecified' {
  if (!status?.trim()) return 'unspecified';
  if (/未核验|未经核验|未完成.*核验|核验未完成|未全部核验/.test(status)) return 'unverified';
  if (/待核验|待核实|待确认|部分核验|尚未完成/.test(status)) return 'pending';
  // An affirmative, complete clause is required. "计划已核验" and "已核验？"
  // must not be accepted just because they contain the same substring.
  return /(?:^|[；;。])\s*(?:原文(?:文本及页面图像|文本|图像)?|证据页(?:文本及图像)?)?已核验\s*(?:$|[；;。])/.test(status)
    ? 'verified' : 'unspecified';
}

export function hasIndexedReference(chunk: KnowledgeChunk): boolean {
  return isArchiveId(chunk.entryId) && isArchiveId(chunk.sourceId) &&
    chunk.indexedReference?.entryId === chunk.entryId &&
    chunk.indexedReference?.sourceId === chunk.sourceId &&
    chunk.heading.split('｜')[0].trim() === chunk.entryId;
}

export function mentionsEntryId(query: string, entryId: string): boolean {
  if (!isArchiveId(entryId)) return false;
  // Do not match TEST-001 inside TEST-0010 or SOME-TEST-001.
  return new RegExp(`(?<![A-Za-z0-9_-])${entryId}(?![A-Za-z0-9_-])`, 'i').test(query);
}
