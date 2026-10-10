import type { ChatResponse } from '../../shared/chat';
import { resolveDiagnosticContext } from '../knowledge/conversation';
import { generateLocalKnowledgeReply } from '../knowledge/fallbackDiagnosis';
import { buildSystemPrompt } from '../knowledge/systemPrompt';
import type { LlmRouter } from '../llm/router';
import { ProviderError } from '../llm/types';
import type { DiagnosticRequest } from './request';

export type DiagnosticProvider = Pick<LlmRouter, 'hasAnyConfigured' | 'chat'>;
export type DiagnosticService = (request: DiagnosticRequest) => Promise<ChatResponse>;

/** The diagnostic use case preserves retrieval scope, sources and provider fallback. */
export function createDiagnosticService(llm: DiagnosticProvider): DiagnosticService {
  return async ({ history, machineType, brand, model }) => {
    const { query, scope, currentQuery, clarificationNeeded } = resolveDiagnosticContext(history, { machineType, brand, model });
    const { message: systemMessage, retrieved, answerMode } = buildSystemPrompt({
      query, currentQuery, clarificationNeeded, ...scope,
    });
    const knowledgeSources = retrieved.map((chunk) => ({
      entryId: chunk.entryId,
      sourceId: chunk.sourceId,
      source: chunk.source,
      heading: chunk.heading,
      locator: chunk.locator,
      version: chunk.version,
      applicability: chunk.applicability,
    }));
    const metadata = { knowledgeChunks: retrieved.length, knowledgeSources };
    const localResponse = (reason: 'not_configured' | 'provider_unavailable'): ChatResponse => ({
      choices: [{ message: {
        role: 'assistant',
        content: generateLocalKnowledgeReply(query, retrieved, scope, reason, currentQuery, clarificationNeeded),
      } }],
      model: reason === 'not_configured' ? 'kb-rag-engine (本地知识引擎)' : 'kb-rag-fallback (本地备用引擎)',
      provider: 'knowledge-base',
      fellBack: true,
      ...metadata,
      answerMode: 'local-evidence',
      fallbackReason: reason,
    });

    if (!llm.hasAnyConfigured()) return localResponse('not_configured');
    try {
      const outcome = await llm.chat([systemMessage, ...history]);
      return {
        choices: [{ message: { role: 'assistant', content: outcome.result.content } }],
        model: outcome.result.model,
        provider: outcome.result.provider,
        fellBack: outcome.fellBack,
        ...metadata,
        answerMode,
      };
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      console.warn(`[chat] provider error: ${error.provider}/${error.kind}`);
      return localResponse('provider_unavailable');
    }
  };
}
