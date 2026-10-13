import type { KnowledgeChunk } from './retriever';
import { queryWithoutIdentity, resolveScope, type RetrievalContext } from './scope';
import { hasIndexedReference, mentionsEntryId, referenceVerification } from './evidence';

export const DIAGNOSIS_MODES = ['auto', 'knowledge_only', 'ai_assisted'] as const;
export type DiagnosisMode = typeof DIAGNOSIS_MODES[number];
export type RouteReason = 'identity_conflict' | 'identity_required' | 'server_local_only' | 'invalid_config' | 'local_requested' | 'direct_reference' | 'llm_not_configured' | 'insufficient_evidence' | 'synthesis_requested' | 'ai_requested' | 'provider_unavailable' | 'llm_config_invalid';
export interface CoordinationDecision {
  requestedMode: DiagnosisMode;
  effectiveMode: DiagnosisMode;
  route: 'local' | 'clarify' | 'ai';
  reason: RouteReason;
  evidenceLevel: 'none' | 'partial' | 'direct_reference';
  llmConfigured: boolean;
}
export function isDiagnosisMode(value: unknown): value is DiagnosisMode {
  return typeof value === 'string' && (DIAGNOSIS_MODES as readonly string[]).includes(value);
}
export function coordinationConfig() {
  const value = process.env.DIAGNOSIS_MODE?.trim() || 'auto';
  const external = process.env.ALLOW_EXTERNAL_AI?.trim() || 'true';
  const valid = isDiagnosisMode(value) && ['true', 'false'].includes(external);
  return { defaultMode: valid && isDiagnosisMode(value) ? value : 'knowledge_only' as DiagnosisMode, configValid: valid,
    allowExternalAi: valid && external === 'true' && value !== 'knowledge_only' };
}
const TECHNICAL = new Set(['维护/故障知识', '操作/维护知识', '安全操作', '系统安装/调试']);

/** Conservative direct lookup, not an estimate of diagnostic confidence. */
export function assessEvidence(query: string, currentQuery: string, found: KnowledgeChunk[], scope: RetrievalContext): CoordinationDecision['evidenceLevel'] {
  const diagnostic = found.filter(c => hasIndexedReference(c) && TECHNICAL.has(c.entryType ?? ''));
  if (!diagnostic.length) return 'none';
  // A concrete lookup can be answered by an exact quotation. Free-form diagnosis
  // and broad "what is wrong" questions must not become direct facts by score alone.
  const normalize = (s: string) => queryWithoutIdentity(s).toLowerCase().replace(/[\s\p{P}]/gu, '');
  const lookup = /查阅|查找|查看|原文|摘录|手册|资料|说明书/.test(currentQuery);
  if (!lookup || /为什么|原因|分析|比较|综合|诊断|怎么办/.test(currentQuery) || !scope.brand || !scope.model) return 'partial';
  const direct = diagnostic.filter(c => c.applicability === 'matched' && [c.locator, c.version, c.scopeBoundary].every(v => v?.trim()) &&
    referenceVerification(c.status) === 'verified' && !/待核实|待核验|待确认|未确认|未核实|未核验|未知|不明确/.test(`${c.status} ${c.scopeBoundary}`) &&
    (mentionsEntryId(currentQuery, c.entryId!) || (() => {
      const heading = c.heading.split('｜').at(-1) ?? c.heading;
      const normalized = normalize(heading);
      return normalized.length >= 4 && normalize(currentQuery).includes(normalized);
    })()));
  // Ambiguous multiple source matches are not automatically considered sufficient.
  return direct.length === 1 && direct[0] === found[0] && !resolveScope(query, scope).identityConflict ? 'direct_reference' : 'partial';
}

export function decideCoordination(input: {
  query: string; currentQuery: string; scope: RetrievalContext; retrieved: KnowledgeChunk[];
  clarificationNeeded: boolean; requestedMode?: DiagnosisMode; llmConfigured: boolean; llmConfigValid?: boolean;
}): CoordinationDecision {
  const config = coordinationConfig();
  const requestedMode = input.requestedMode ?? config.defaultMode;
  const effectiveMode = config.allowExternalAi ? requestedMode : 'knowledge_only';
  const evidenceLevel = assessEvidence(input.query, input.currentQuery, input.retrieved, input.scope);
  const decision = (route: CoordinationDecision['route'], reason: RouteReason): CoordinationDecision =>
    ({ requestedMode, effectiveMode, route, reason, evidenceLevel, llmConfigured: input.llmConfigured });
  if (input.clarificationNeeded || resolveScope(input.query, input.scope).identityConflict) return decision('clarify', 'identity_conflict');
  if ((!input.scope.brand || !input.scope.model) && /故障码.*(?:含义|意思|解释)|(?:压力|扭矩|间隙|电压|温度).*(?:标准|多少|参数)|(?:标准|规定).*(?:压力|扭矩|间隙|电压|温度)/.test(input.currentQuery)) return decision('clarify', 'identity_required');
  if (!config.configValid) return decision('local', 'invalid_config');
  if (!config.allowExternalAi) return decision('local', 'server_local_only');
  if (effectiveMode === 'knowledge_only') return decision('local', 'local_requested');
  if (effectiveMode === 'auto' && evidenceLevel === 'direct_reference') return decision('local', 'direct_reference');
  if (input.llmConfigValid === false) return decision('local', 'llm_config_invalid');
  if (!input.llmConfigured) return decision('local', 'llm_not_configured');
  return decision('ai', effectiveMode === 'ai_assisted' ? 'ai_requested' : evidenceLevel === 'none' ? 'insufficient_evidence' : 'synthesis_requested');
}

export const ROUTE_MESSAGES: Record<RouteReason, string> = {
  llm_config_invalid: '模型供应商配置无效，暂时返回本地资料，请管理员检查配置。',
  identity_conflict: '机型信息有冲突，先确认设备，本次不调用外部 AI。',
  identity_required: '解释专用故障码或参数需要品牌和完整型号，本次先追问。',
  server_local_only: '网站当前设置为仅使用本地知识库，不调用外部 AI。',
  invalid_config: '回答模式配置有误，已安全切换为仅本地资料。',
  local_requested: '按你的选择，仅使用本地知识库。',
  direct_reference: '找到可定位的匹配资料，直接展示原文及适用限制，不代表故障已确诊。',
  llm_not_configured: '本次需要进一步分析，但尚未配置外部 AI；先展示本地资料和追问。',
  insufficient_evidence: '未找到可直接支持诊断的资料，尝试外部 AI 提供待验证的通用分析。',
  synthesis_requested: '现有资料需要进一步综合或核对，尝试外部 AI 辅助分析。',
  ai_requested: '按你的选择，先检索资料，再使用外部 AI 辅助分析。',
  provider_unavailable: '外部 AI 本次调用失败，已退回本地资料。',
};
