export interface KnowledgeChunk {
  /** 通用文档相对 server/knowledge；归档文档相对仓库根目录 */
  source: string;
  /** 该块所属章节标题（## 级） */
  heading: string;
  /** 块正文 */
  text: string;
  entryId?: string;
  sourceId?: string;
  /** Bound by the archive loader after checking the entry, source and section. */
  indexedReference?: Readonly<{ entryId: string; sourceId: string }>;
  brand?: string;
  model?: string;
  models?: string[];
  /** Entry-specific subsets require an exact identity rather than a brand-only match. */
  requiresExactModel?: boolean;
  configuration?: 'CAB' | 'ROPS';
  driveConfiguration?: '2WD' | '4WD';
  emissionStage?: '国三' | '国四';
  sourceUrl?: string;
  originalPath?: string;
  locator?: string;
  version?: string;
  scopeBoundary?: string;
  status?: string;
  entryType?: string;
  applicability?: 'matched' | 'pending';
}

