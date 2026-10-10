/**
 * SRT27 HTTP 服务入口
 *
 * 职责：
 * - Express 中间件（CORS、安全头、JSON 解析、限流）
 * - /api/health
 * - /api/chat：输入校验 → RAG → LLM Router → 统一错误响应
 * - /api/model/tractor：本地 GLB 文件
 *
 * 注意：
 * - API Key 仅从环境变量读取，绝不打印、绝不返回前端。
 * - 用户侧错误信息永远是友好的中文/英文提示，不暴露 ECONNRESET/502 等技术细节。
 */
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// 1) 必须先加载 server/.env，再读取任何代理/Key 环境变量。
//    这样即使 HTTPS_PROXY 等代理配置写在 .env 里，也能被后续 detectProxy() 正确识别。
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

// 2) Node fetch 默认不走系统代理；若配置了代理，全局启用（undici）。
//    此时 process.env.HTTPS_PROXY 等已包含 .env 中的值。
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import { pathToFileURL } from 'node:url';
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  console.log('[server] proxy enabled (redacted)');
}

// ---- 知识库 & LLM ----
import { loadKnowledgeBase, stats as kbStats } from './knowledge/retriever';
import { buildSystemPrompt } from './knowledge/systemPrompt';
import { decideCoordination, coordinationConfig, isDiagnosisMode, ROUTE_MESSAGES, type DiagnosisMode } from './knowledge/coordination';
import { hasIndexedReference, referenceVerification } from './knowledge/evidence';
import { generateLocalKnowledgeReply, localReplySummary } from './knowledge/fallbackDiagnosis';
import { resolveDiagnosticContext } from './knowledge/conversation';
import { getLlmRouter } from './llm/router';
import { ProviderError, type ChatMessage } from './llm/types';
import { getKnowledgeCatalog, loadKnowledgeCatalog } from './knowledge/catalog';
import type { CatalogFilters } from '../shared/knowledge-catalog';
import { memoryRouter, memoryOwner, memoryFailure, sameOrigin, revisionFrom } from './memory/routes';
import { getMemoryStore, MemoryError, validId, summarizeReports } from './memory/store';
import { recentMessages, memoryPrompt } from './memory/context';
import type { SessionDetail, MemoryMessage } from '../shared/memory';

loadKnowledgeBase();
loadKnowledgeCatalog();
const llm = getLlmRouter();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const APP_VERSION: string = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')).version;

// ---- 基础安全 ----
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(cors());

app.use(express.json({ limit: '256kb' }));
app.use('/api/memory', memoryRouter);

// ---- 限流：每 IP 每分钟 30 次 /api/chat ----
const rateBucket = new Map<string, { count: number; reset: number }>();
app.use('/api/chat', (req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const bucket = rateBucket.get(ip);
  if (!bucket || bucket.reset < now) {
    rateBucket.set(ip, { count: 1, reset: now + 60_000 });
  } else {
    bucket.count++;
    if (bucket.count > 30) {
      res.status(429).json({ error: '请求过于频繁，请稍后再试', code: 'rate_limited' });
      return;
    }
  }
  next();
});

// ---- 健康检查 ----
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    knowledge: kbStats(),
    llm: llm.getStatus(),
    coordination: coordinationConfig(),
  });
});

// ---- 可追溯分层知识目录（只读） ----
app.get('/api/knowledge/catalog', (req: Request, res: Response) => {
  const filters: CatalogFilters = {};
  for (const field of ['brand', 'model', 'component', 'part'] as const) {
    const value = req.query[field];
    if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > 100)) {
      res.status(400).json({ error: '目录筛选须为非空文本（各上限100字符）', code: 'bad_request' });
      return;
    }
    if (typeof value === 'string') filters[field] = value.trim();
  }
  if ((filters.model && !filters.brand) || (filters.component && !filters.model) || (filters.part && !filters.component)) {
    res.status(400).json({ error: '请依次选择品牌、完整型号、组件和零部件', code: 'bad_request' });
    return;
  }
  try {
    res.json(getKnowledgeCatalog(filters));
  } catch (error) {
    if (error instanceof RangeError) {
      res.status(404).json({ error: error.message, code: 'knowledge_not_found' });
      return;
    }
    console.error('[catalog] unexpected error:', error);
    res.status(500).json({ error: '知识目录暂时无法读取，请稍后重试', code: 'catalog_unavailable' });
  }
});

// ---- /api/chat ----
interface ChatRequestBody {
  sessionId?: string;
  revision?: number;
  diagnosisMode?: DiagnosisMode;
  messages?: ChatMessage[];
  machineType?: string;
  brand?: string;
  model?: string;
}
const activeMemoryRequests = new Set<string>();

app.post('/api/chat', sameOrigin, async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: '请求体必须为 JSON 对象', code: 'bad_request' });
    return;
  }
  const body = req.body as ChatRequestBody;
  if ([body.machineType, body.brand, body.model].some((value) =>
    value !== undefined && (typeof value !== 'string' || value.length > 100),
  )) {
    res.status(400).json({ error: '农机类型、品牌和型号必须为字符串（各上限 100 字符）', code: 'bad_request' });
    return;
  }
  if (body.diagnosisMode !== undefined && !isDiagnosisMode(body.diagnosisMode)) {
    res.status(400).json({ error: '回答模式无效', code: 'bad_request' });
    return;
  }
  const { messages } = body;
  let machineType = body.machineType?.trim();
  let brand = body.brand?.trim();
  let model = body.model?.trim();

  // 输入校验
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages 参数缺失或格式错误', code: 'bad_request' });
    return;
  }
  if (messages.length > 40) {
    res.status(400).json({ error: '对话轮次过多，请新开对话', code: 'too_long' });
    return;
  }
  const ROLES = new Set(['system', 'user', 'assistant']);
  for (const m of messages) {
    if (!m || typeof m !== 'object' || !ROLES.has(m.role) || typeof m.content !== 'string') {
      res.status(400).json({ error: '消息格式错误', code: 'bad_request' });
      return;
    }
    const maxMessageLength = m.role === 'assistant' ? 16_000 : 2000;
    if (m.content.length > maxMessageLength) {
      res.status(400).json({ error: `单条消息过长（上限 ${maxMessageLength} 字符）`, code: 'too_long' });
      return;
    }
  }

  // 前端不应发送 system；如发送，丢弃（后端拥有最终 system prompt）
  let history = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(body.sessionId ? -40 : -20) // 首轮迁移本地记录；后续以保存的记录为准
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // 取最近一条 user 问题用于 RAG 检索
  const lastUserMsg = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg?.content.trim() || history.at(-1)?.role !== 'user') {
    res.status(400).json({ error: '请提供非空的当前用户问题', code: 'bad_request' });
    return;
  }
  let remembered: SessionDetail | undefined;
  let owner = '';
  let diagnosticHistory = history;
  if (body.sessionId !== undefined) {
    try {
      if (!validId(body.sessionId)) throw new MemoryError(400, 'bad_request', '诊断记录编号格式错误');
      const revision = revisionFrom(body.revision);
      owner = memoryOwner(req, res);
      remembered = getMemoryStore().session(owner, body.sessionId);
      if (remembered.revision !== revision) throw new MemoryError(409, 'memory_conflict', '诊断记录已更新，请重新载入后继续');
      if (activeMemoryRequests.has(body.sessionId)) throw new MemoryError(409, 'memory_busy', '本次诊断正在回答，请等待后再继续');
      if (remembered.messages.length >= 2000) throw new MemoryError(409, 'memory_limit', '本次诊断记录已达上限，请新建诊断');
      if (remembered.messages.length && /换一台|另一台|另外一台|现在换成/.test(lastUserMsg.content)) {
        throw new MemoryError(409, 'memory_device_changed', '诊断另一台设备时，请选择或新建设备档案并新建诊断，避免混用检查结果');
      }
      for (const field of ['machineType', 'brand', 'model'] as const) {
        if (body[field] !== undefined && body[field]?.trim() !== remembered.device[field]) {
          throw new MemoryError(409, 'memory_device_changed', '设备信息已改变，请先保存设备档案或为另一台设备新建诊断');
        }
      }
      ({ machineType, brand, model } = remembered.device);
      // A saved session owns its history. Client-supplied old assistant turns
      // cannot rewrite it. The first turn can migrate the visible local history.
      diagnosticHistory = remembered.messages.length
        ? [...remembered.messages.map((m) => ({ role: m.role, content: m.content })), lastUserMsg]
        : history;
      history = recentMessages(diagnosticHistory) as typeof history;
      activeMemoryRequests.add(body.sessionId);
      res.set('Cache-Control', 'no-store');
    } catch (error) { memoryFailure(error, res); return; }
  }
  try {
    const { query, scope, currentQuery, symptomQuery, clarificationNeeded } = resolveDiagnosticContext(diagnosticHistory, { machineType, brand, model });

    // 构造 system prompt（含 RAG）
    const { message: systemMsg, retrieved, answerMode } = buildSystemPrompt({
      query,
      currentQuery,
      clarificationNeeded,
      ...scope,
    });

    const knowledgeSources = retrieved.map((chunk) => ({
      entryId: chunk.entryId,
      sourceId: chunk.sourceId,
      source: chunk.source,
      heading: chunk.heading,
      locator: chunk.locator,
      version: chunk.version,
      applicability: chunk.applicability,
      status: chunk.status,
      referenceVerification: referenceVerification(chunk.status),
      sourceIndexed: hasIndexedReference(chunk),
    }));

    const priorReports = remembered ? getMemoryStore().priorReports(owner, remembered.deviceId, remembered.id, symptomQuery) : [];
    if (remembered) systemMsg.content += memoryPrompt({ ...remembered, summary: summarizeReports(diagnosticHistory) }, priorReports);
    const fullMessages: ChatMessage[] = [systemMsg, ...history];
    const finish = (payload: Record<string, unknown>) => {
      // A stopped/disconnected request must not recreate or mutate forgotten data.
      if (res.destroyed) return;
      if (remembered) {
        const content = (payload.choices as { message: { content: string } }[])[0].message.content;
        const assistant: Omit<MemoryMessage, 'id' | 'role' | 'createdAt'> = { content };
        for (const field of ['model', 'provider', 'localSummary', 'coordinationMessage', 'answerMode', 'fallbackReason', 'knowledgeChunks'] as const) {
          if (payload[field] !== undefined) Object.assign(assistant, { [field]: payload[field] });
        }
        const imported = remembered.messages.length ? [] : diagnosticHistory.slice(0, -1);
        payload.memory = getMemoryStore().appendTurn(owner, remembered.id, remembered.revision, lastUserMsg.content, assistant, imported);
        payload.relatedMemoryReports = priorReports;
      }
      res.json(payload);
    };

    const coordination = decideCoordination({ query, currentQuery, scope, retrieved, clarificationNeeded,
      requestedMode: body.diagnosisMode, llmConfigured: llm.hasAnyConfigured(), llmConfigValid: llm.getStatus().configValid });
    const sendLocal = (providerFailed = false) => {
      const route = providerFailed ? { ...coordination, route: 'local' as const, reason: 'provider_unavailable' as const } : coordination;
      const fallbackReason = providerFailed ? 'provider_unavailable' : route.reason === 'llm_not_configured' ? 'not_configured' : undefined;
      const needsClarification = route.route === 'clarify';
      const clarification = route.reason === 'identity_required'
        ? '**【需要补充】** 请提供品牌和铭牌上的完整型号，再核对故障码或参数。不能用其他型号的数据代替。'
        : '**【需要确认机型】** 请确认本次设备的品牌和完整型号；确认前暂停引用冲突资料。';
      const localReply = needsClarification ? clarification : generateLocalKnowledgeReply(query, retrieved, scope, fallbackReason, symptomQuery || currentQuery, false);
      const memoryNote = remembered?.progress && !needsClarification
        ? `**【已记录的检查进度 · 用户报告，待核实】**\n${remembered.progress}\n\n以下为资料排查清单，请优先处理未完成项目；已完成项目仅在结果变化或需要复核时再检查。\n\n` : '';
      const priorNote = priorReports.length && !needsClarification
        ? `**【同一设备的历史检查报告 · 待核实】**\n${priorReports.map((r) => `${r.updatedAt.slice(0, 10)}：${r.progress}`).join('\n')}\n\n以上是历史用户报告，不代表本次已检查或当前仍正常。\n\n` : '';
      const summary = memoryNote + priorNote + (needsClarification ? clarification : localReplySummary(symptomQuery, retrieved, scope, fallbackReason ?? 'local_selected'));
      finish({
        choices: [{ message: { role: 'assistant', content: memoryNote + priorNote + localReply } }],
        model: 'kb-rag-engine (本地知识引擎)', provider: 'knowledge-base',
        fellBack: Boolean(fallbackReason), ...(fallbackReason ? { fallbackReason } : {}),
        knowledgeChunks: retrieved.length, knowledgeSources, answerMode: 'local-evidence',
        localSummary: summary.slice(0, 4000), coordination: route, coordinationMessage: ROUTE_MESSAGES[route.reason],
      });
    };
    if (coordination.route !== 'ai') {
      sendLocal();
      return;
    }
    let outcome;
    try { outcome = await llm.chat(fullMessages); }
    catch (err) {
      console.warn('[chat] model call failed:', err instanceof ProviderError ? err.kind : 'unknown');
      sendLocal(true);
      return;
    }
    finish({
      choices: [{ message: { role: 'assistant', content: outcome.result.content } }],
      model: outcome.result.model, provider: outcome.result.provider, fellBack: outcome.fellBack,
      knowledgeChunks: retrieved.length, knowledgeSources, answerMode,
      coordination, coordinationMessage: ROUTE_MESSAGES[coordination.reason],
    });
  } catch (error) {
    if (remembered) memoryFailure(error, res);
    else throw error;
  } finally {
    if (remembered) activeMemoryRequests.delete(remembered.id);
  }

});

// ---- 3D 模型 ----
app.get('/api/model/tractor', (_req: Request, res: Response) => {
  const modelPath = path.resolve(process.cwd(), 'public/models/tractor-detailed-v1.glb');
  res.sendFile(modelPath, (err) => {
    if (err) res.status(404).json({ error: '模型文件不存在' });
  });
});

// ---- 全局错误兜底 ----
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  if ((err as Error & { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: '请求体必须为有效的 JSON 对象', code: 'bad_request' });
    return;
  }
  console.error('[server] unhandled:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

const isDirectRun =
  process.argv[1] &&
  (pathToFileURL(process.argv[1]).href === import.meta.url ||
    process.argv[1].endsWith('server/index.ts') ||
    process.argv[1].endsWith('server/dev.ts'));

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] running on http://0.0.0.0:${PORT}`);
  });
  const shutdown = (signal: string) => {
    console.log(`[server] received ${signal}, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export default app;
