/** Public diagnosis modes and decisions, without server initialization. */
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
