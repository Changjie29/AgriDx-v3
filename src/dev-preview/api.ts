/// <reference types="node" />
import { loadKnowledgeBase, stats } from '../../server/knowledge/retriever';
import { getKnowledgeCatalog, loadKnowledgeCatalog } from '../../server/knowledge/catalog';
import { createDiagnosticService } from '../../server/diagnosis/service';
import { DiagnosticInputError, parseDiagnosticRequest } from '../../server/diagnosis/request';
import type { CatalogFilters } from '../../shared/knowledge-catalog';

let ready = false;
const diagnose = createDiagnosticService({
  hasAnyConfigured: () => false,
  chat: async () => { throw new Error('External providers are disabled in the development preview.'); },
});
function initialize() {
  if (ready) return;
  loadKnowledgeBase();
  loadKnowledgeCatalog();
  ready = true;
}
const json = (payload: unknown, status = 200) => Response.json(payload, { status });

/** Reuse the actual catalog and local RAG without sending preview traffic to production. */
export async function previewFetch(input: string, options: RequestInit = {}): Promise<Response> {
  options.signal?.throwIfAborted();
  initialize();
  const url = new URL(input, 'https://dev-preview.invalid');
  const method = options.method?.toUpperCase() ?? 'GET';
  try {
    let response: Response;
    if (url.pathname === '/api/health' && method === 'GET') {
      response = json({
        ok: true,
        ...(typeof __AGRIDX_PREVIEW_RELEASE__ === 'undefined' ? {} : __AGRIDX_PREVIEW_RELEASE__),
        environment: 'development-preview', timestamp: new Date().toISOString(),
        knowledge: stats(), llm: { configured: false, primary: null },
      });
    } else if (url.pathname === '/api/knowledge/catalog' && method === 'GET') {
      const filters: CatalogFilters = {};
      for (const key of ['brand', 'model', 'component', 'part'] as const) {
        const values = url.searchParams.getAll(key);
        if (values.length > 1 || (values.length && (!values[0].trim() || values[0].length > 100))) {
          return json({ error: '目录筛选须为非空文本（各上限100字符）', code: 'bad_request' }, 400);
        }
        if (values.length) filters[key] = values[0].trim();
      }
      if ((filters.model && !filters.brand) || (filters.component && !filters.model) || (filters.part && !filters.component)) {
        return json({ error: '请依次选择品牌、完整型号、组件和零部件', code: 'bad_request' }, 400);
      }
      response = json(getKnowledgeCatalog(filters));
    } else if (url.pathname === '/api/chat' && method === 'POST') {
      let body: unknown;
      try { body = JSON.parse(String(options.body ?? '')); }
      catch { return json({ error: '请求体必须为有效的 JSON 对象', code: 'bad_request' }, 400); }
      response = json(await diagnose(parseDiagnosticRequest(body)));
    } else {
      return json({ error: '接口不存在', code: 'not_found' }, 404);
    }
    options.signal?.throwIfAborted();
    return response;
  } catch (error) {
    options.signal?.throwIfAborted();
    if (error instanceof DiagnosticInputError) return json({ error: error.message, code: error.code }, 400);
    if (error instanceof RangeError) return json({ error: error.message, code: 'knowledge_not_found' }, 404);
    throw error;
  }
}
