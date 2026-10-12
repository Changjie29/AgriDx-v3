import type { KnowledgeCatalog } from '../../../shared/knowledge-catalog';
import { isRecord, requestJson } from '../../lib/api-client';

const isCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isStrings = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string');
const hasCounts = (value: Record<string, unknown>) =>
  ['entryCount', 'faultCount', 'sourceCount'].every(key => isCount(value[key]));
const hasIdentity = (value: Record<string, unknown>) => typeof value.id === 'string' && typeof value.name === 'string';

function isPart(value: unknown): boolean {
  return isRecord(value) && hasIdentity(value) && hasCounts(value);
}

function isComponent(value: unknown): boolean {
  return isRecord(value) && hasIdentity(value) && hasCounts(value) && isCount(value.unresolvedPartCount) &&
    Array.isArray(value.parts) && value.parts.every(isPart);
}

function isModel(value: unknown): boolean {
  return isRecord(value) && hasIdentity(value) && hasCounts(value) &&
    ['exact', 'series', 'pending'].includes(String(value.scope)) &&
    ['拖拉机', '配套导航系统', '待核实'].includes(String(value.machineType)) &&
    Array.isArray(value.components) && value.components.every(isComponent);
}

function isBrand(value: unknown): boolean {
  return isRecord(value) && hasIdentity(value) && hasCounts(value) &&
    Array.isArray(value.models) && value.models.every(isModel);
}

function isEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const fields = ['entryId', 'title', 'entryType', 'content', 'sourceId', 'sourceUrl', 'locator',
    'version', 'scopeBoundary', 'status', 'knowledgePath'];
  return fields.every(key => typeof value[key] === 'string') &&
    (value.configuration === undefined || value.configuration === 'CAB' || value.configuration === 'ROPS') &&
    (value.driveConfiguration === undefined || value.driveConfiguration === '2WD' || value.driveConfiguration === '4WD') &&
    (value.emissionStage === undefined || value.emissionStage === '国三' || value.emissionStage === '国四');
}

function isSelection(value: unknown): boolean {
  return isRecord(value) && typeof value.brand === 'string' && typeof value.model === 'string' &&
    (value.component === undefined || typeof value.component === 'string') &&
    (value.part === undefined || typeof value.part === 'string') &&
    Array.isArray(value.entries) && value.entries.every(isEntry) && isStrings(value.gaps);
}

/** Validate every nested collection consumed by the four-level browser before rendering it. */
export function parseKnowledgeCatalog(value: unknown): KnowledgeCatalog {
  if (!isRecord(value) || !isRecord(value.totals)) throw new Error('Invalid knowledge catalog');
  const totals = value.totals;
  if (!['entries', 'sources', 'brands', 'models', 'faultEntries', 'mappedEntries'].every(key => isCount(totals[key])) ||
    !Array.isArray(value.brands) || !value.brands.every(isBrand) || !isStrings(value.limitations) ||
    !isRecord(value.expansion) || value.expansion.targetLabel !== '1w+' ||
    value.expansion.countingUnit !== 'pending' || value.expansion.status !== 'planned' ||
    (value.selected !== undefined && !isSelection(value.selected))) {
    throw new Error('Invalid knowledge catalog');
  }
  return value as unknown as KnowledgeCatalog;
}

export async function requestKnowledgeCatalog(query: string, signal: AbortSignal): Promise<KnowledgeCatalog> {
  return parseKnowledgeCatalog(await requestJson(`/api/knowledge/catalog${query ? `?${query}` : ''}`, { signal }));
}
