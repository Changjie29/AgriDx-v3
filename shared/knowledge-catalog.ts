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
}

export interface KnowledgeCatalog {
  totals: {
    entries: number;
    sources: number;
    brands: number;
    models: number;
    faultEntries: number;
    mappedEntries: number;
  };
  expansion: { targetLabel: '1w+'; countingUnit: 'pending'; status: 'planned' };
  brands: CatalogBrand[];
  selected?: CatalogSelection;
  limitations: string[];
}

export interface CatalogFilters {
  brand?: string;
  model?: string;
  component?: string;
  part?: string;
}
