import type { ChatResponse } from '../../shared/chat';
import type { SessionDetail, PriorDeviceReport } from '../../shared/memory';
import { resolveDiagnosticContext } from '../knowledge/conversation';
import { generateLocalKnowledgeReply, localReplySummary } from '../knowledge/fallbackDiagnosis';
import { buildSystemPrompt } from '../knowledge/systemPrompt';
import { decideCoordination, ROUTE_MESSAGES } from '../knowledge/coordination';
import { hasIndexedReference, referenceVerification } from '../knowledge/evidence';
import { memoryPrompt, recentMessages } from '../memory/context';
import type { LlmRouter } from '../llm/router';
import { ProviderError } from '../llm/types';
import type { DiagnosticRequest } from './request';

export interface DiagnosticMemory {
  session: SessionDetail;
  priorReports: PriorDeviceReport[];
}
export type DiagnosticProvider = Pick<LlmRouter, 'hasAnyConfigured' | 'chat'> & Partial<Pick<LlmRouter, 'getStatus'>>;
export type DiagnosticService = (request: DiagnosticRequest, memory?: DiagnosticMemory) => Promise<ChatResponse>;

/** Retrieval, coordination and provider fallback stay independent of HTTP and storage. */
export function createDiagnosticService(llm: DiagnosticProvider): DiagnosticService {
  return async ({ history, machineType, brand, model, diagnosisMode }, memory) => {
    const { query, scope, currentQuery, symptomQuery, clarificationNeeded } = resolveDiagnosticContext(history, { machineType, brand, model });
    const { message: systemMessage, retrieved, answerMode } = buildSystemPrompt({ query, currentQuery, clarificationNeeded, ...scope });
    const knowledgeSources = retrieved.map((chunk) => ({
      entryId: chunk.entryId, sourceId: chunk.sourceId, source: chunk.source, heading: chunk.heading,
      locator: chunk.locator, version: chunk.version, applicability: chunk.applicability, status: chunk.status,
      referenceVerification: referenceVerification(chunk.status), sourceIndexed: hasIndexedReference(chunk),
    }));
    const metadata = { knowledgeChunks: retrieved.length, knowledgeSources };
    const coordination = decideCoordination({ query, currentQuery, scope, retrieved, clarificationNeeded,
      requestedMode: diagnosisMode, llmConfigured: llm.hasAnyConfigured(), llmConfigValid: llm.getStatus?.().configValid });
    if (memory) systemMessage.content += memoryPrompt(memory.session, memory.priorReports);
    const localResponse = (failed = false): ChatResponse => {
      const route = failed ? { ...coordination, route: 'local' as const, reason: 'provider_unavailable' as const } : coordination;
      const fallbackReason = failed ? 'provider_unavailable' as const : route.reason === 'llm_not_configured' ? 'not_configured' as const : undefined;
      const clarification = route.reason === 'identity_required'
        ? '**【需要补充】** 请提供品牌和铭牌上的完整型号，再核对故障码或参数。不能用其他型号的数据代替。'
        : '**【需要确认机型】** 请确认本次设备的品牌和完整型号；确认前暂停引用冲突资料。';
      const needsClarification = route.route === 'clarify';
      const memoryNote = memory?.session.progress && !needsClarification
        ? `**【已记录的检查进度 · 用户报告，待核实】**\n${memory.session.progress}\n\n以下为资料排查清单，请优先处理未完成项目；已完成项目仅在结果变化或需要复核时再检查。\n\n` : '';
      const priorNote = memory?.priorReports.length && !needsClarification
        ? `**【同一设备的历史检查报告 · 待核实】**\n${memory.priorReports.map(r => `${r.updatedAt.slice(0, 10)}：${r.progress}`).join('\n')}\n\n以上是历史用户报告，不代表本次已检查或当前仍正常。\n\n` : '';
      const content = needsClarification ? clarification : generateLocalKnowledgeReply(query, retrieved, scope, fallbackReason, symptomQuery || currentQuery, false);
      return {
        choices: [{ message: { role: 'assistant', content: memoryNote + priorNote + content } }],
        model: failed ? 'kb-rag-fallback (本地备用引擎)' : 'kb-rag-engine (本地知识引擎)', provider: 'knowledge-base',
        fellBack: Boolean(fallbackReason), ...(fallbackReason ? { fallbackReason } : {}), ...metadata, answerMode: 'local-evidence',
        localSummary: (memoryNote + priorNote + (needsClarification ? clarification : localReplySummary(symptomQuery, retrieved, scope, fallbackReason ?? 'local_selected'))).slice(0, 4000),
        coordination: route, coordinationMessage: ROUTE_MESSAGES[route.reason],
      };
    };
    if (coordination.route !== 'ai') return localResponse();
    try {
      const outcome = await llm.chat([systemMessage, ...(memory ? recentMessages(history) : history)]);
      return { choices: [{ message: { role: 'assistant', content: outcome.result.content } }],
        model: outcome.result.model, provider: outcome.result.provider, fellBack: outcome.fellBack,
        ...metadata, answerMode, coordination, coordinationMessage: ROUTE_MESSAGES[coordination.reason] };
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      console.warn(`[chat] provider error: ${error.provider}/${error.kind}`);
      return localResponse(true);
    }
  };
}
