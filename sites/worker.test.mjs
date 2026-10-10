import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { tsImport } from 'tsx/esm/api';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const release = JSON.parse(fs.readFileSync(path.join(root, '.openai/release.json'), 'utf8'));

// Exercise the production bundle without credentials or network calls.
process.env.GEMINI_API_KEY = '';
process.env.DEEPSEEK_API_KEY = '';
const bundle = process.env.AGRIDX_WORKER_BUNDLE || path.join(root, 'dist/server/index.js');
const { default: worker } = await import(pathToFileURL(bundle).href);
const tractor = { machineType: '拖拉机' };
const workmaster = { ...tractor, brand: '纽荷兰', model: 'WORKMASTER25' };
const startQuery = '钥匙在 START，启动电机不转';
let nextIp = 0;

const env = {
  ASSETS: {
    async fetch() {
      throw new Error('Unexpected static asset access');
    },
  },
};

async function request(body, options = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has('CF-Connecting-IP')) headers.set('CF-Connecting-IP', `test-client-${++nextIp}`);
  if (body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://agridx.xyz${options.pathname || '/api/chat'}`, {
    method: options.method || (body === undefined ? 'GET' : 'POST'),
    headers,
    body: body === undefined ? undefined : options.raw ? body : JSON.stringify(body),
  }), options.env || env);
}

async function chat(query = startQuery, context = workmaster, options) {
  const response = await request({ messages: [{ role: 'user', content: query }], ...context }, options);
  return { status: response.status, body: await response.json() };
}

test('health identifies the main release and the complete validated knowledge archive', async () => {
  const response = await request(undefined, { pathname: '/api/health' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.version, packageJson.version);
  assert.deepEqual(body.knowledge, { chunks: 221, archivedEntries: 212, sources: 26 });
  assert.equal(body.release.sourceCommit, release.source_commit);
  assert.equal(body.release.sourceRepository, 'Changjie29/AgriDx-v3');
  assert.equal(body.release.sourceBranch, 'main');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');

  const head = await request(undefined, { pathname: '/api/health', method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('catalog snapshot equals main for every model and its component/part selections', async () => {
  const reference = await tsImport('../server/knowledge/catalog.ts', import.meta.url);
  const expected = reference.loadKnowledgeCatalog();
  const base = await request(undefined, { pathname: '/api/knowledge/catalog' });
  assert.equal(base.status, 200);
  assert.deepEqual(await base.json(), expected);
  assert.deepEqual(expected.totals, { entries: 212, sources: 26, brands: 15, models: 97, faultEntries: 63, mappedEntries: 212 });
  for (const brand of expected.brands) {
    for (const model of brand.models) {
      const filters = { brand: brand.name, model: model.name };
      const selections = [filters];
      for (const component of model.components) {
        selections.push({ ...filters, component: component.id });
        for (const part of component.parts) selections.push({ ...filters, component: component.id, part: part.id });
      }
      for (const selection of selections) {
        const response = await request(undefined, { pathname: '/api/knowledge/catalog?' + new URLSearchParams(selection) });
        assert.equal(response.status, 200, JSON.stringify(selection));
        assert.deepEqual((await response.json()).selected, JSON.parse(JSON.stringify(reference.getKnowledgeCatalog(selection).selected)), JSON.stringify(selection));
      }
    }
  }
  const head = await request(undefined, { pathname: '/api/knowledge/catalog', method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('catalog rejects malformed hierarchy filters and unknown exact identities', async () => {
  for (const query of ['model=LF804S', 'component=electrical', 'part=starter', 'brand=', 'brand=a&brand=b',
    'brand%5B%5D=a', 'brand=' + 'x'.repeat(101)]) {
    const response = await request(undefined, { pathname: '/api/knowledge/catalog?' + query });
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).code, 'bad_request');
  }
  for (const filters of [
    { brand: '久保田', model: 'LX2620HSDCX' },
    { brand: '鸿鹄', model: 'NX510' },
    { brand: '东方红', model: 'LF804S', component: 'unknown' },
    { brand: '东方红', model: 'LF804S', component: 'electrical', part: 'unknown' },
  ]) {
    const response = await request(undefined, { pathname: '/api/knowledge/catalog?' + new URLSearchParams(filters) });
    assert.equal(response.status, 404, JSON.stringify(filters));
    assert.equal((await response.json()).code, 'knowledge_not_found');
  }
});

test('archived replies retain source identifiers, original page locations and model boundaries', async () => {
  const { status, body } = await chat();
  assert.equal(status, 200);
  assert.equal(body.provider, 'knowledge-base');
  assert.equal(body.fellBack, true);
  assert.ok(body.knowledgeChunks > 0 && body.knowledgeChunks <= 6);
  const reply = body.choices[0].message.content;
  assert.equal(body.choices[0].message.role, 'assistant');
  for (const pattern of [
    /NH-WM25-003/,
    /SRC-NH-WM25-92157408/,
    /PDF 第 175 页/,
    /不适用于.*25S/,
    /启动联锁条件未满足/,
    /适用限制：/,
  ]) assert.match(reply, pattern);
});

const parityCases = [
  { query: startQuery, ...workmaster },
  { query: startQuery, ...workmaster, model: 'WORKMASTER25S' },
  { query: '发动机水温过高开锅' },
  { query: 'John Deere 6E-1204(G4) 不能起动' },
  { query: '起动机不转', ...tractor, brand: '东方红', model: 'LF1504' },
  { query: '国四 起动机不转', ...tractor, brand: '东方红', model: 'LF1504' },
  { query: 'CAB驾驶室内循环与新风滤网清洁条件 空调冷凝器滤网', ...tractor, brand: '久保田', model: 'LX2620HSDC' },
  { query: 'ROPS防翻架 内循环与新风滤网 空调冷凝器', ...tractor, brand: '久保田', model: 'LX2620HSDC' },
  { query: '发动机过热', ...tractor, brand: '久保田', model: 'LX9999' },
  { query: '无人作业失联，定位失效', machineType: '无人农机', brand: '鸿鹄', model: 'T70' },
];

test('bundled retrieval and replies equal the main Node implementation across scope boundaries', async () => {
  // Compute the oracle from the original filesystem loader, independently of the Worker build.
  const referenceRetriever = await tsImport('../server/knowledge/retriever.ts', import.meta.url);
  const referenceFallback = await tsImport('../server/knowledge/fallbackDiagnosis.ts', import.meta.url);
  const { resolveDiagnosticContext } = await tsImport('../server/knowledge/conversation.ts', import.meta.url);
  referenceRetriever.loadKnowledgeBase();
  const expected = parityCases.map(({ query, ...context }) => {
    const resolved = resolveDiagnosticContext([{ role: 'user', content: query }], context);
    const chunks = referenceRetriever.retrieve(resolved.query, 6, resolved.scope);
    return {
      knowledgeChunks: chunks.length,
      content: referenceFallback.generateLocalKnowledgeReply(resolved.query, chunks, resolved.scope, 'not_configured', query),
    };
  });
  for (const [index, item] of parityCases.entries()) {
    const { query, ...context } = item;
    const { status, body } = await chat(query, context);
    assert.equal(status, 200, JSON.stringify(item));
    assert.equal(body.knowledgeChunks, expected[index].knowledgeChunks, JSON.stringify(item));
    assert.equal(body.choices[0].message.content, expected[index].content, JSON.stringify(item));
  }
});

test('unknown and conflicting identities return insufficient knowledge without cross-model facts', async () => {
  for (const context of [
    { ...workmaster, model: 'WORKMASTER25S' },
    { ...tractor, brand: '久保田', model: 'LX9999' },
    { ...workmaster, machineType: '新能源农机' },
    { ...workmaster, machineType: '联合收割机' },
  ]) {
    const { status, body } = await chat(startQuery, context);
    assert.equal(status, 200);
    assert.equal(body.knowledgeChunks, 0, JSON.stringify(context));
    assert.match(body.choices[0].message.content, /当前资料不足/);
    assert.doesNotMatch(body.choices[0].message.content, /NH-WM25-003/);
  }
});

test('multi-turn identity denial pauses archived retrieval until the user confirms the replacement', async () => {
  const messages = [
    { role: 'user', content: '纽荷兰 WORKMASTER25 拖拉机启动电机不转' },
    { role: 'user', content: '不是纽荷兰' },
  ];
  const response = await request({ ...workmaster, messages });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.knowledgeChunks, 0);
  assert.match(body.choices[0].message.content, /需要确认机型/);
  assert.doesNotMatch(body.choices[0].message.content, /NH-WM25-003/);
});

test('JSON and machine-identity validation remain JSON errors rather than static pages', async () => {
  for (const body of [null, [], 123, 'request', {}, { messages: [] }, { messages: [{ role: 'tool', content: 'x' }] }]) {
    const response = await request(body);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'bad_request');
  }
  const malformed = await request('{', { raw: true });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, 'bad_request');
  const wrongMedia = await request('{}', { raw: true, headers: { 'Content-Type': 'text/plain' } });
  assert.equal(wrongMedia.status, 400);
  for (const field of ['machineType', 'brand', 'model']) {
    for (const value of [123, null, {}, 'x'.repeat(101)]) {
      const response = await request({ ...workmaster, [field]: value, messages: [{ role: 'user', content: startQuery }] });
      assert.equal(response.status, 400, `${field}: ${JSON.stringify(value)}`);
      assert.equal((await response.json()).code, 'bad_request');
    }
  }
});

test('message and byte limits preserve long source-rich assistant history', async () => {
  for (const message of [
    { role: 'user', content: 'x'.repeat(2001) },
    { role: 'system', content: 'x'.repeat(2001) },
    { role: 'assistant', content: 'x'.repeat(16_001) },
  ]) {
    const response = await request({ messages: [message] });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'too_long');
  }
  const tooMany = await request({ messages: Array.from({ length: 41 }, () => ({ role: 'user', content: 'x' })) });
  assert.equal(tooMany.status, 400);
  assert.equal((await tooMany.json()).code, 'too_long');
  const tooLarge = await request({ messages: [{ role: 'assistant', content: '中'.repeat(100_000) }] });
  assert.equal(tooLarge.status, 413);
  assert.equal((await tooLarge.json()).code, 'too_large');

  const query = '已记录日常工况。'.repeat(150) + '请查看保养周期';
  const first = await chat(query);
  const reply = first.body.choices[0].message.content;
  assert.ok(reply.length > 2000 && reply.length <= 16_000);
  const next = await request({
    ...workmaster,
    messages: [
      { role: 'user', content: query },
      { role: 'assistant', content: reply },
      { role: 'user', content: startQuery },
    ],
  });
  assert.equal(next.status, 200);
  assert.match((await next.json()).choices[0].message.content, /NH-WM25-003/);
});

test('configured providers use the main router and a server-owned, bounded system prompt', async () => {
  const originalFetch = globalThis.fetch;
  process.env.DEEPSEEK_API_KEY = 'adapter-test-key';
  let called = false;
  globalThis.fetch = async (url, init) => {
    called = true;
    assert.equal(url, 'https://api.deepseek.com/v1/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer adapter-test-key');
    const outgoing = JSON.parse(init.body);
    assert.equal(outgoing.model, 'deepseek-v4-flash');
    assert.equal(outgoing.messages.length, 21);
    assert.equal(outgoing.messages[0].role, 'system');
    assert.match(outgoing.messages[0].content, /NH-WM25-003/);
    assert.doesNotMatch(outgoing.messages[0].content, /INJECTED_SYSTEM_TOKEN/);
    return Response.json({ choices: [{ message: { content: '测试模型回复' } }], model: outgoing.model });
  };
  try {
    const response = await request({
      ...workmaster,
      messages: [
        { role: 'system', content: 'INJECTED_SYSTEM_TOKEN' },
        ...Array.from({ length: 25 }, () => ({ role: 'assistant', content: '已记录' })),
        { role: 'user', content: startQuery },
      ],
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.provider, 'deepseek');
    assert.equal(body.fellBack, false);
    assert.equal(body.choices[0].message.content, '测试模型回复');
    assert.equal(called, true);
  } finally {
    process.env.DEEPSEEK_API_KEY = '';
    globalThis.fetch = originalFetch;
  }
});

test('provider failures return main knowledge evidence as the local fallback', async () => {
  const originalFetch = globalThis.fetch;
  process.env.DEEPSEEK_API_KEY = 'adapter-test-key';
  globalThis.fetch = async () => Response.json({ error: 'test failure' }, { status: 401 });
  try {
    const { status, body } = await chat();
    assert.equal(status, 200);
    assert.equal(body.provider, 'knowledge-base');
    assert.equal(body.model, 'kb-rag-fallback (本地备用引擎)');
    assert.equal(body.fellBack, true);
    assert.match(body.choices[0].message.content, /NH-WM25-003/);
  } finally {
    process.env.DEEPSEEK_API_KEY = '';
    globalThis.fetch = originalFetch;
  }
});

test('chat rate limit allows thirty requests and rejects the thirty-first for the same client', async () => {
  const options = { headers: { 'CF-Connecting-IP': 'rate-limit-test-client' } };
  for (let i = 0; i < 30; i++) {
    assert.equal((await chat('量子纠缠', workmaster, options)).status, 200);
  }
  const last = await chat('量子纠缠', workmaster, options);
  assert.equal(last.status, 429);
  assert.equal(last.body.code, 'rate_limited');
  assert.equal((await chat()).status, 200);
});

test('assets handle SPA routes and the model alias while unknown APIs remain JSON 404s', async () => {
  const assets = [];
  const staticEnv = {
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        assets.push({ pathname: url.pathname, method: request.method, search: url.search });
        if (url.pathname === '/models/tractor-detailed-v1.glb') {
          return new Response(new Uint8Array([103, 108, 84, 70]), { headers: { 'Content-Type': 'model/gltf-binary' } });
        }
        if (url.pathname === '/') {
          return new Response('<html>SPA</html>', { headers: { 'Content-Type': 'text/html' } });
        }
        return new Response('Not found', { status: 404 });
      },
    },
  };
  const spa = await request(undefined, { pathname: '/chat', env: staticEnv });
  assert.equal(spa.status, 200);
  assert.equal(await spa.text(), '<html>SPA</html>');
  assert.equal(assets[0].pathname, '/');
  const model = await request(undefined, { pathname: '/api/model/tractor?revision=main', env: staticEnv });
  assert.equal(model.status, 200);
  assert.equal(model.headers.get('Content-Type'), 'model/gltf-binary');
  assert.deepEqual([...new Uint8Array(await model.arrayBuffer())], [103, 108, 84, 70]);
  assert.deepEqual(assets[1], { pathname: '/models/tractor-detailed-v1.glb', method: 'GET', search: '?revision=main' });
  for (const pathname of ['/api', '/api/unknown', '/api/chat']) {
    const unknown = await request(undefined, { pathname, env: staticEnv });
    assert.equal(unknown.status, 404);
    assert.equal((await unknown.json()).code, 'not_found');
  }
  assert.equal(assets.length, 2);
  const missingModel = await request(undefined, {
    pathname: '/api/model/tractor',
    env: { ASSETS: { fetch: async () => new Response('<html>SPA</html>', { headers: { 'Content-Type': 'text/html' } }) } },
  });
  assert.equal(missingModel.status, 404);
  assert.equal((await missingModel.json()).error, '模型文件不存在');
});

test('direct chat visits and refreshes resolve the real entry with no asset SPA fallback', async () => {
  const html = fs.readFileSync(path.join(root, 'dist/client/index.html'), 'utf8');
  for (const pathname of ['/chat', '/chat/', '/CHAT', '/chat?mode=diagnosis']) {
    for (const method of ['GET', 'HEAD']) {
      const calls = [];
      const response = await request(undefined, {
        pathname, method,
        env: { ASSETS: { async fetch(assetRequest) {
          const assetUrl = new URL(assetRequest.url);
          calls.push({ pathname: assetUrl.pathname, search: assetUrl.search, method: assetRequest.method });
          if (assetUrl.pathname !== '/') return new Response('Not found', { status: 404 });
          return new Response(method === 'HEAD' ? null : html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        } } },
      });
      assert.equal(response.status, 200, `${method} ${pathname}`);
      assert.match(response.headers.get('Content-Type'), /text\/html/);
      assert.equal(await response.text(), method === 'HEAD' ? '' : html);
      assert.deepEqual(calls, [{ pathname: '/', search: new URL(pathname, 'https://agridx.xyz').search, method }]);
    }
  }
  const missing = await request(undefined, {
    pathname: '/assets/missing.js',
    env: { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } },
  });
  assert.equal(missing.status, 404);
});

test('CORS preflight reflects requested headers and does not access assets or providers', async () => {
  const response = await request(undefined, {
    method: 'OPTIONS',
    headers: { 'Access-Control-Request-Headers': 'content-type,x-test-header' },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'content-type,x-test-header');
  assert.match(response.headers.get('Access-Control-Allow-Methods'), /POST/);
});
