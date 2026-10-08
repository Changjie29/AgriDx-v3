/**
 * DeepSeek provider（国内直连可用，无需代理）
 */
import { createOpenAICompatibleProvider } from './openai-compatible';
import type { Provider } from './types';

export function createDeepSeekProvider(): Provider {
  // 在工厂调用时读取，确保 server/index.ts 的 dotenv.config() 已执行。
  const model = process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-v4-flash';
  const baseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com/v1';
  return createOpenAICompatibleProvider({
    name: 'deepseek',
    model,
    apiUrl: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    timeoutMs: 20_000,
    selfIntro: `【模型信息】你当前由 DeepSeek 提供支持，配置的模型名称：${model}。当用户询问"你是什么模型/用的是什么模型/背后是哪个大模型"时，请如实告知配置名称；模型别名可能由服务商映射，不能推断未返回的内部版本。`,
  });
}
