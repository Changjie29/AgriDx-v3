/**
 * OpenAI 兼容 chat/completions 通用请求实现。
 * Gemini (v1beta/openai) 与 DeepSeek 都遵循此格式，差别只在 URL/Model/Key。
 */
import { fetchWithTimeout } from './http';
import {
  ProviderError,
  type ChatMessage,
  type ChatResult,
  type Provider,
  type ProviderName,
} from './types';

interface OpenAICompatibleOptions {
  name: ProviderName;
  model: string;
  apiUrl: string;
  apiKeyEnv: string;
  /** 超时毫秒 */
  timeoutMs?: number;
  /** system prompt 末尾追加的"模型自述"提示 */
  selfIntro?: string;
}

export function createOpenAICompatibleProvider(opts: OpenAICompatibleOptions): Provider {
  const { name, model, apiUrl, apiKeyEnv, timeoutMs = 25_000, selfIntro } = opts;

  function getKey(): string | undefined {
    return process.env[apiKeyEnv]?.trim() || undefined;
  }

  return {
    name,
    model,
    isConfigured() {
      const k = getKey();
      return Boolean(k && k.trim().length > 0);
    },
    async chat(messages: ChatMessage[]): Promise<ChatResult> {
      const apiKey = getKey();
      if (!apiKey) {
        throw new ProviderError(name, 'configuration', `missing ${apiKeyEnv}`);
      }

      // 追加模型自述（让模型被问到时如实回答自己是谁）
      const outgoing: ChatMessage[] = selfIntro
        ? (() => {
            const withIntro = [...messages];
            if (withIntro[0]?.role === 'system') {
              withIntro[0] = { ...withIntro[0], content: withIntro[0].content + '\n\n' + selfIntro };
            } else {
              withIntro.unshift({ role: 'system', content: selfIntro });
            }
            return withIntro;
          })()
        : messages;

      let data: unknown;
      try {
        data = await fetchWithTimeout(
          apiUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: outgoing,
              temperature: 0.3,
              stream: false,
            }),
          },
          timeoutMs,
          async (response): Promise<unknown> => {
            if (!response.ok) {
              // 上游错误体可能回显凭据或提示词，仅保留状态码。
              const detail = `HTTP ${response.status}`;
              if (response.status === 401 || response.status === 403) {
                throw new ProviderError(name, 'auth', detail);
              }
              if (response.status === 400 || response.status === 422) {
                throw new ProviderError(name, 'bad_request', detail);
              }
              if (response.status === 429) throw new ProviderError(name, 'rate_limit', detail);
              if (response.status >= 500) throw new ProviderError(name, 'server_error', detail);
              throw new ProviderError(name, 'unknown', detail);
            }
            try {
              return await response.json();
            } catch (error) {
              if (error instanceof Error && error.name === 'AbortError') throw error;
              throw new ProviderError(name, 'invalid_response', 'response is not valid JSON');
            }
          },
        );
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        // 网络层错误（含超时）
        const kind = err instanceof Error && err.message === 'timeout' ? 'timeout' : 'network';
        // 原始异常可能包含 URL、代理凭据或请求信息，不能向日志/调用方传播。
        throw new ProviderError(name, kind, kind === 'timeout' ? 'request timed out' : 'request failed');
      }

      const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      const choice = Array.isArray(record.choices) ? record.choices[0] : undefined;
      const message = choice && typeof choice === 'object' ? choice.message : undefined;
      const content = typeof message?.content === 'string' ? message.content.trim() : '';
      if (!content) {
        throw new ProviderError(name, 'invalid_response', 'missing assistant content');
      }
      const usage: ChatResult['usage'] = {};
      const rawUsage = record.usage;
      if (rawUsage && typeof rawUsage === 'object') {
        for (const field of ['prompt_tokens', 'completion_tokens', 'total_tokens'] as const) {
          const value = (rawUsage as Record<string, unknown>)[field];
          if (typeof value === 'number' && Number.isFinite(value) && value >= 0) usage[field] = value;
        }
      }
      return {
        content,
        provider: name,
        model: typeof record.model === 'string' && record.model.trim() ? record.model.trim() : model,
        usage: Object.keys(usage).length ? usage : undefined,
      };
    },
  };
}
