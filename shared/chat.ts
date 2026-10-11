/** Public chat protocol. Provider prompts and credentials remain server-only. */
export type ChatProvider = 'gemini' | 'deepseek' | 'knowledge-base';
export type AnswerMode = 'knowledge-grounded' | 'general-guidance' | 'local-evidence';
export type FallbackReason = 'not_configured' | 'provider_unavailable';

export interface ChatApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MachineContext {
  machineType: string;
  brand: string;
  model: string;
}

export interface ChatRequest {
  messages: ChatApiMessage[];
  machineType?: string;
  brand?: string;
  model?: string;
}

export interface ChatKnowledgeSource {
  entryId?: string;
  sourceId?: string;
  source: string;
  heading: string;
  locator?: string;
  version?: string;
  applicability?: 'matched' | 'pending';
}

export interface ChatResponse {
  choices: { message: { role: 'assistant'; content: string } }[];
  model: string;
  provider: ChatProvider;
  answerMode: AnswerMode;
  fellBack: boolean;
  knowledgeChunks: number;
  knowledgeSources: ChatKnowledgeSource[];
  fallbackReason?: FallbackReason;
}

export interface LlmHealth {
  configured: boolean;
  primary: 'gemini' | 'deepseek' | null;
}
