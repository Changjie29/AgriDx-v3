/** Cloudflare HTTP adapter. Knowledge and LLM behavior remain in the main server modules. */
import packageJson from '../package.json';
import release from '../.openai/release.json';
import { loadKnowledgeBase, stats as kbStats } from '../server/knowledge/retriever';
import { buildSystemPrompt } from '../server/knowledge/systemPrompt';
import { generateLocalKnowledgeReply } from '../server/knowledge/fallbackDiagnosis';
import { resolveDiagnosticContext } from '../server/knowledge/conversation';
import { getLlmRouter } from '../server/llm/router';
import { ProviderError, type ChatMessage } from '../server/llm/types';
import { getKnowledgeCatalog, loadKnowledgeCatalog } from '../server/knowledge/catalog';
import type { CatalogFilters } from '../shared/knowledge-catalog';

declare const __KB_SOURCE_COUNT__: number;

interface WorkerEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

interface ChatRequestBody {
  messages?: ChatMessage[];
  machineType?: string;
  brand?: string;
  model?: string;
}

// The build replaces only the filesystem loader with the validated main-branch snapshot.
loadKnowledgeBase();
loadKnowledgeCatalog();

const MAX_BODY_BYTES = 256 * 1024;
const rateBucket = new Map<string, { count: number; reset: number }>();
const ROLES = new Set(['system', 'user', 'assistant']);

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function error(message: string, code: string, status = 400): Response {
  return json({ error: message, code }, status);
}

function withHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  headers.set('Access-Control-Allow-Origin', '*');
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
    if (requestedHeaders) headers.set('Access-Control-Allow-Headers', requestedHeaders);
    headers.append('Vary', 'Access-Control-Request-Headers');
  }
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

class RequestBodyError extends Error {
  constructor(readonly response: Response) {
    super('Invalid request body');
  }
}

async function readJson(request: Request): Promise<unknown> {
  // Match express.json(): other media types leave the JSON body unset.
  const mediaType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') return undefined;

  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RequestBodyError(error('请求体过大（上限 256 KB）', 'too_large', 413));
  }

  const reader = request.body?.getReader();
  const pieces: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BODY_BYTES) {
          await reader.cancel().catch(() => undefined);
          throw new RequestBodyError(error('请求体过大（上限 256 KB）', 'too_large', 413));
        }
        pieces.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  if (length === 0) return {};
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const piece of pieces) {
    bytes.set(piece, offset);
    offset += piece.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestBodyError(error('请求体必须为有效的 JSON 对象', 'bad_request'));
  }
}

function rateLimit(request: Request): Response | undefined {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  // Bound memory without changing the original per-isolate, one-minute limit.
  for (const [key, bucket] of rateBucket) {
    if (bucket.reset < now) rateBucket.delete(key);
  }
  const bucket = rateBucket.get(ip);
  if (!bucket || bucket.reset < now) {
    rateBucket.set(ip, { count: 1, reset: now + 60_000 });
  } else {
    bucket.count++;
    if (bucket.count > 30) {
      return error('请求过于频繁，请稍后再试', 'rate_limited', 429);
    }
  }
}

async function chat(request: Request): Promise<Response> {
  const value = await readJson(request);
  const limited = rateLimit(request);
  if (limited) return limited;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return error('请求体必须为 JSON 对象', 'bad_request');
  }
  const body = value as ChatRequestBody;
  if ([body.machineType, body.brand, body.model].some((field) =>
    field !== undefined && (typeof field !== 'string' || field.length > 100),
  )) {
    return error('农机类型、品牌和型号必须为字符串（各上限 100 字符）', 'bad_request');
  }
  const { messages } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return error('messages 参数缺失或格式错误', 'bad_request');
  }
  if (messages.length > 40) return error('对话轮次过多，请新开对话', 'too_long');
  for (const message of messages) {
    if (!message || typeof message !== 'object' || !ROLES.has(message.role) || typeof message.content !== 'string') {
      return error('消息格式错误', 'bad_request');
    }
    const maxLength = message.role === 'assistant' ? 16_000 : 2000;
    if (message.content.length > maxLength) {
      return error(`单条消息过长（上限 ${maxLength} 字符）`, 'too_long');
    }
  }

  const context = {
    machineType: body.machineType?.trim(),
    brand: body.brand?.trim(),
    model: body.model?.trim(),
  };
  const history = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-20)
    .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content }));
  if (history.at(-1)?.role !== 'user' || !history.at(-1)?.content.trim()) {
    return error('请提供非空的当前用户问题', 'bad_request');
  }
  const { query, scope, currentQuery, clarificationNeeded } = resolveDiagnosticContext(history, context);
  const { message: systemMessage, retrieved, answerMode } = buildSystemPrompt({ query, currentQuery, clarificationNeeded, ...scope });
  const knowledgeSources = retrieved.map((chunk) => ({
    entryId: chunk.entryId, sourceId: chunk.sourceId, source: chunk.source,
    heading: chunk.heading, locator: chunk.locator, version: chunk.version,
    applicability: chunk.applicability,
  }));
  const fullMessages: ChatMessage[] = [systemMessage, ...history];
  const llm = getLlmRouter();

  const localReply = (model: string, fallbackReason: 'not_configured' | 'provider_unavailable') => json({
    choices: [{ message: { role: 'assistant', content: generateLocalKnowledgeReply(query, retrieved, scope, fallbackReason, currentQuery, clarificationNeeded) } }],
    model,
    provider: 'knowledge-base',
    fellBack: true,
    knowledgeChunks: retrieved.length,
    knowledgeSources,
    answerMode: 'local-evidence',
    fallbackReason,
  });

  try {
    if (!llm.hasAnyConfigured()) return localReply('kb-rag-engine (本地知识引擎)', 'not_configured');
    const outcome = await llm.chat(fullMessages);
    return json({
      choices: [{ message: { role: 'assistant', content: outcome.result.content } }],
      model: outcome.result.model,
      provider: outcome.result.provider,
      fellBack: outcome.fellBack,
      knowledgeChunks: retrieved.length,
      knowledgeSources,
      answerMode,
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      console.warn(`[chat] provider error: ${err.provider}/${err.kind}`);
      return localReply('kb-rag-fallback (本地备用引擎)', 'provider_unavailable');
    }
    console.error('[chat] unexpected provider error');
    return error('智能诊断服务暂时无法连接，请稍后重试。', 'llm_unavailable', 502);
  }
}

async function route(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '').toLowerCase() || '/';
  const readOnly = request.method === 'GET' || request.method === 'HEAD';
  if (pathname === '/api/health' && readOnly) {
    return json({
      ok: true,
      version: packageJson.version,
      timestamp: new Date().toISOString(),
      knowledge: { ...kbStats(), sources: __KB_SOURCE_COUNT__ },
      llm: getLlmRouter().getStatus(),
      release: {
        sourceRepository: release.source_repository,
        sourceBranch: release.source_branch,
        sourceCommit: release.source_commit,
      },
    });
  }
  if (pathname === '/api/chat' && request.method === 'POST') return chat(request);
  if (pathname === '/api/knowledge/catalog' && readOnly) {
    const filters: CatalogFilters = {};
    for (const field of ['brand', 'model', 'component', 'part'] as const) {
      const values = url.searchParams.getAll(field);
      // Express rejects repeated and structured query values; preserve that contract.
      if (values.length > 1 || [...url.searchParams.keys()].some((key) => key.startsWith(field + '[')) ||
          (values.length === 1 && (!values[0].trim() || values[0].length > 100))) {
        return error('目录筛选须为非空文本（各上限100字符）', 'bad_request');
      }
      if (values.length) filters[field] = values[0].trim();
    }
    if ((filters.model && !filters.brand) || (filters.component && !filters.model) || (filters.part && !filters.component)) {
      return error('请依次选择品牌、完整型号、组件和零部件', 'bad_request');
    }
    try {
      return json(getKnowledgeCatalog(filters));
    } catch (err) {
      if (err instanceof RangeError) return error(err.message, 'knowledge_not_found', 404);
      console.error('[catalog] unexpected error');
      return error('知识目录暂时无法读取，请稍后重试', 'catalog_unavailable', 500);
    }
  }
  if (pathname === '/api/model/tractor' && readOnly) {
    url.pathname = '/models/tractor-detailed-v1.glb';
    const response = await env.ASSETS.fetch(new Request(url, request));
    if (!response.ok || response.headers.get('Content-Type')?.includes('text/html')) {
      return json({ error: '模型文件不存在' }, 404);
    }
    return response;
  }
  // Unknown API paths must never receive the SPA's index.html.
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return error('接口不存在', 'not_found', 404);
  }
  // Resolve the client route explicitly: Sites asset bindings may return 404
  // for /chat even when the build declares SPA not_found_handling.
  if (pathname === '/chat' && readOnly) {
    url.pathname = '/';
    return env.ASSETS.fetch(new Request(url, request));
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    try {
      return withHeaders(await route(request, env), request);
    } catch (err) {
      if (err instanceof RequestBodyError) return withHeaders(err.response, request);
      console.error('[server] unhandled request error');
      return withHeaders(json({ error: '服务器内部错误' }, 500), request);
    }
  },
};
