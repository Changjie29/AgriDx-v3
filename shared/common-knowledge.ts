/** Common organization is reusable; source-specific repair facts keep their original scope. */
export const KNOWLEDGE_STAGES = ['normal', 'symptom', 'cause', 'check', 'action', 'retest'] as const;
export type KnowledgeStage = typeof KNOWLEDGE_STAGES[number];
export interface PerformanceTarget { id: string; name: string }
export interface CommonSystem {
  id: string;
  name: string;
  componentIds: string[];
  configurationNotes: string;
  performanceTargets: PerformanceTarget[];
}
export interface CommonSymptom {
  id: string;
  name: string;
  aliases: string[];
  systemIds: string[];
  performanceIds: string[];
  questions: string[];
}
export interface CommonEvidenceLink {
  entryId: string;
  symptomIds: string[];
  performanceIds: string[];
  stages: { id: KnowledgeStage; evidenceTerms: string[] }[];
}
export interface CommonFrameworkDefinition {
  schemaVersion: 1;
  purpose: string;
  questions: string[];
  stages: { id: KnowledgeStage; name: string }[];
  systems: CommonSystem[];
  symptoms: CommonSymptom[];
  links: CommonEvidenceLink[];
}
export interface CommonCoverageCell {
  performanceId: string;
  stageId: KnowledgeStage;
  status: 'gap' | 'references';
  entryIds: string[];
}
export interface CommonKnowledgeFramework {
  schemaVersion: 1;
  scope: 'archive' | 'model';
  selectedSymptom?: string;
  questions: string[];
  stages: CommonFrameworkDefinition['stages'];
  systems: CommonSystem[];
  symptoms: CommonSymptom[];
  cells: CommonCoverageCell[];
  linkedEntries: number;
  gapCells: number;
}

/** Intake questions are prompts for missing facts, not confirmed machine conditions. */
export function buildCommonDiagnosisQuestion(symptom: Pick<CommonSymptom, 'name'>, configurationText?: string): string {
  return `${symptom.name}。${configurationText ? `已确认配置：${configurationText}。` : ''}请先核对本机资料和缺失的工况信息，再给出有来源的排查建议。`;
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text) && new Set(v).size === v.length;
const identity = (v: unknown): v is PerformanceTarget => record(v) && text(v.id) && text(v.name);
const stages = (v: unknown): v is CommonFrameworkDefinition['stages'] => Array.isArray(v) &&
  v.length === KNOWLEDGE_STAGES.length && new Set(v.map(x => record(x) ? x.id : undefined)).size === v.length &&
  v.every(x => identity(x) && KNOWLEDGE_STAGES.includes(x.id as KnowledgeStage));
const systems = (v: unknown): v is CommonSystem[] => Array.isArray(v) && v.length > 0 &&
  v.every(x => identity(x) && record(x) && strings(x.componentIds) && x.componentIds.length > 0 &&
    text(x.configurationNotes) && Array.isArray(x.performanceTargets) && x.performanceTargets.length > 0 && x.performanceTargets.every(identity));
const symptoms = (v: unknown): v is CommonSymptom[] => Array.isArray(v) && v.length > 0 &&
  v.every(x => identity(x) && record(x) && strings(x.aliases) && strings(x.systemIds) && x.systemIds.length > 0 &&
    strings(x.performanceIds) && x.performanceIds.length > 0 && strings(x.questions) && x.questions.length > 0);

export function isCommonDefinition(v: unknown): v is CommonFrameworkDefinition {
  return record(v) && v.schemaVersion === 1 && text(v.purpose) && strings(v.questions) &&
    stages(v.stages) && systems(v.systems) && symptoms(v.symptoms) && Array.isArray(v.links) && v.links.every(x =>
      record(x) && text(x.entryId) && strings(x.symptomIds) && strings(x.performanceIds) && x.performanceIds.length > 0 &&
      Array.isArray(x.stages) && x.stages.length > 0 && x.stages.every(s => record(s) &&
        KNOWLEDGE_STAGES.includes(s.id as KnowledgeStage) && strings(s.evidenceTerms) && s.evidenceTerms.length > 0));
}

/** Validate server data before rendering the matrix or constructing diagnosis prompts. */
export function isCommonFramework(v: unknown): v is CommonKnowledgeFramework {
  if (!record(v) || v.schemaVersion !== 1 || !['archive', 'model'].includes(String(v.scope)) ||
    (v.selectedSymptom !== undefined && !text(v.selectedSymptom)) || !strings(v.questions) ||
    !stages(v.stages) || !systems(v.systems) || !symptoms(v.symptoms) || !Array.isArray(v.cells) ||
    ![v.linkedEntries, v.gapCells].every(x => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0)) return false;
  const targets = new Set(v.systems.flatMap(x => x.performanceTargets.map(p => p.id)));
  if (new Set(v.systems.map(x => x.id)).size !== v.systems.length ||
    new Set(v.symptoms.map(x => x.id)).size !== v.symptoms.length ||
    targets.size !== v.systems.flatMap(x => x.performanceTargets).length) return false;
  const keys = new Set<string>();
  for (const cell of v.cells) {
    if (!record(cell) || !text(cell.performanceId) || !targets.has(cell.performanceId) ||
      !KNOWLEDGE_STAGES.includes(cell.stageId as KnowledgeStage) || !strings(cell.entryIds) ||
      cell.status !== (cell.entryIds.length ? 'references' : 'gap')) return false;
    const key = `${cell.performanceId}/${cell.stageId}`;
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return keys.size === targets.size * KNOWLEDGE_STAGES.length &&
    v.linkedEntries === new Set(v.cells.flatMap(cell => cell.entryIds)).size &&
    v.gapCells === v.cells.filter(cell => cell.status === 'gap').length &&
    (v.selectedSymptom === undefined || v.symptoms.some(x => x.id === v.selectedSymptom));
}
