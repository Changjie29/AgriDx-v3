import type { CommonKnowledgeFramework } from './common-knowledge';
/** Knowledge browsing follows the archived index. Counts never imply full-machine validation. */
export interface CatalogCounts {
  entryCount: number;
  faultCount: number;
  sourceCount: number;
}

export interface CatalogPart extends CatalogCounts {
  id: string;
  name: string;
}

export interface CatalogComponent extends CatalogCounts {
  id: string;
  name: string;
  parts: CatalogPart[];
  /** Entries whose evidence does not identify a specific part. */
  unresolvedPartCount: number;
}

export interface CatalogModel extends CatalogCounts {
  id: string;
  name: string;
  scope: 'exact' | 'series' | 'pending';
  machineType: '拖拉机' | '配套导航系统' | '待核实';
  components: CatalogComponent[];
}

export interface CatalogBrand extends CatalogCounts {
  id: string;
  name: string;
  models: CatalogModel[];
}

export interface CatalogEntry {
  entryId: string;
  title: string;
  entryType: string;
  /** Read directly from the sole archived Markdown body; never a second knowledge copy. */
  content: string;
  sourceId: string;
  sourceUrl: string;
  locator: string;
  version: string;
  scopeBoundary: string;
  status: string;
  knowledgePath: string;
  configuration?: 'CAB' | 'ROPS';
  driveConfiguration?: '2WD' | '4WD';
  emissionStage?: '国三' | '国四';
}

export interface CatalogSelection {
  brand: string;
  model: string;
  component?: string;
  part?: string;
  entries: CatalogEntry[];
  gaps: string[];
  configuration?: 'CAB' | 'ROPS';
  driveConfiguration?: '2WD' | '4WD';
  emissionStage?: '国三' | '国四';
}

export interface LearningEntry {
  collection: 'learning';
  entryId: string;
  title: string;
  entryType: '通识学习';
  content: string;
  topic: string;
  status: string;
  knowledgePath: string;
  diagnosticEvidence: false;
}

export type LibraryEntry = LearningEntry | (CatalogEntry & {
  collection: 'archive';
  brand: string;
  models: string[];
});

export interface KnowledgeLibrary {
  collection: 'all' | 'archive' | 'learning';
  query: string;
  page: number;
  pageSize: number;
  total: number;
  entries: LibraryEntry[];
}

export interface KnowledgeCatalog {
  totals: {
    entries: number;
    archivedEntries: number;
    learningEntries: number;
    sources: number;
    brands: number;
    models: number;
    faultEntries: number;
    mappedEntries: number;
  };
  expansion: { targetLabel: '1w+'; countingUnit: 'indexed-entry'; status: 'planned' | 'reached' };
  brands: CatalogBrand[];
  selected?: CatalogSelection;
  library?: KnowledgeLibrary;
  limitations: string[];
  common?: CommonKnowledgeFramework;
}

export interface CatalogFilters {
  brand?: string;
  model?: string;
  component?: string;
  part?: string;
  symptom?: string;
  configuration?: 'CAB' | 'ROPS';
  driveConfiguration?: '2WD' | '4WD';
  emissionStage?: '国三' | '国四';
  collection?: KnowledgeLibrary['collection'];
  q?: string;
  page?: string;
}

export const CATALOG_FILTER_KEYS = ['brand', 'model', 'component', 'part', 'symptom', 'configuration', 'driveConfiguration', 'emissionStage', 'collection', 'q', 'page'] as const;
export function validCatalogCondition(key: typeof CATALOG_FILTER_KEYS[number], value: string): boolean {
  if (key === 'configuration') return ['CAB', 'ROPS'].includes(value);
  if (key === 'driveConfiguration') return ['2WD', '4WD'].includes(value);
  if (key === 'emissionStage') return ['国三', '国四'].includes(value);
  if (key === 'collection') return ['all', 'archive', 'learning'].includes(value);
  if (key === 'page') return /^[1-9]\d{0,5}$/.test(value);
  return true;
}
