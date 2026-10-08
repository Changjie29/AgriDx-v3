/**
 * Gemini provider（通过 OpenAI 兼容接口访问）
 * - 需要网络可达 Google（有代理时通常可用）
 */
import { createOpenAICompatibleProvider } from './openai-compatible';
import type { Provider } from './types';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export function createGeminiProvider(): Provider {
  // ESM 静态 import 会先于入口 dotenv.config()，不能在模块顶层捕获模型配置。
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
  return createOpenAICompatibleProvider({
    name: 'gemini',
    model,
    apiUrl: GEMINI_API_URL,
    apiKeyEnv: 'GEMINI_API_KEY',
    timeoutMs: 20_000,
    selfIntro: `【模型信息】你当前由 Gemini 提供支持，配置的模型名称：${model}。当用户询问"你是什么模型/用的是什么模型/背后是哪个大模型"时，请如实告知配置名称；模型别名可能由服务商映射，不能推断未返回的内部版本。`,
  });
}
