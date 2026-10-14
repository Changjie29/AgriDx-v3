import type { CatalogFilters, KnowledgeCatalog } from '../../shared/knowledge-catalog';
import { loadKnowledgeSnapshot } from './snapshot';

/** Compatibility entry; initialization is shared with retrieval and statistics. */
export function loadKnowledgeCatalog(): KnowledgeCatalog {
  return loadKnowledgeSnapshot().getCatalog();
}

export function getKnowledgeCatalog(filters: CatalogFilters = {}): KnowledgeCatalog {
  return loadKnowledgeSnapshot().getCatalog(filters);
}
