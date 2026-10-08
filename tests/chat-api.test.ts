import assert from 'node:assert/strict';
import http from 'node:http';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import type { LlmStatus } from '../server/llm/router';

// Keep this suite local even when the developer has configured model credentials.
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';
process.env.DEEPSEEK_API_KEY = '';
process.env.LLM_PROVIDER = 'auto';

const { default: app } = await import('../server/index');
let server: http.Server;
let port: number;

interface ChatResponse {
  code?: string;
  provider?: string;
  model?: string;
  fellBack?: boolean;
  fallbackReason?: string;
  answerMode?: string;
  knowledgeChunks?: number;
  knowledgeSources?: { entryId?: string; sourceId?: string; locator?: string }[];
  choices?: { message: { role: string; content: string } }[];
}

const identity = { machineType: '拖拉机', brand: '纽荷兰', model: 'WORKMASTER25' };
const messages = [{ role: 'user', content: '钥匙在 START，启动电机不转' }];

// Tests opt into fake provider credentials individually; no real provider is called.
beforeEach(() => {
  process.env.GEMINI_API_KEY = '';
  process.env.DEEPSEEK_API_KEY = '';
  process.env.LLM_PROVIDER = 'auto';
});
afterEach(() => {
  process.env.GEMINI_API_KEY = '';
  process.env.DEEPSEEK_API_KEY = '';
  process.env.LLM_PROVIDER = 'auto';
});

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  port = address.port;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

function requestJson<T>(requestPath: string, body?: unknown, forwardedFor?: string): Promise<{ status: number; body: T }> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method: payload === undefined ? 'GET' : 'POST',
      agent: false,
      headers: {
        ...(payload === undefined ? {} : {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        }),
        ...(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {}),
      },
    }, (response) => {
      let output = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => { output += chunk; });
      response.on('error', reject);
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode ?? 0, body: JSON.parse(output) as T });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.end(payload);
  });
}

function chat(body: unknown, forwardedFor?: string): Promise<{ status: number; body: ChatResponse }> {
  return requestJson('/api/chat', body, forwardedFor);
}

function upstreamAnswer(content: string, model = 'integration-test-model'): Response {
  return Response.json({ choices: [{ message: { role: 'assistant', content } }], model });
}

interface UpstreamRequest {
  messages: { role: string; content: string }[];
}

test('rejects malformed optional machine identity fields as bad requests', async () => {
  for (const field of ['machineType', 'brand', 'model']) {
    for (const value of [123, null, {}, 'x'.repeat(101)]) {
      const response = await chat({ messages, ...identity, [field]: value });
      assert.equal(response.status, 400, `${field}: ${JSON.stringify(value)}`);
      assert.equal(response.body.code, 'bad_request');
    }
  }
});

test('rejects non-object JSON bodies with a JSON bad-request response', async () => {
  for (const body of [null, [], 123, 'request']) {
    const response = await chat(body);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'bad_request');
  }
});

test('the chat API returns archived facts with source IDs, page references and applicability limits', async () => {
  const response = await chat({ messages, ...identity });
  assert.equal(response.status, 200);
  assert.equal(response.body.provider, 'knowledge-base');
  assert.ok(response.body.knowledgeChunks && response.body.knowledgeChunks > 0);
  const reply = response.body.choices?.[0]?.message.content;
  assert.ok(reply);
  assert.match(reply, /NH-WM25-003/);
  assert.match(reply, /SRC-NH-WM25-92157408/);
  assert.match(reply, /PDF 第 175 页/);
  assert.match(reply, /不适用于.*25S/);
  assert.match(reply, /启动联锁条件未满足/);
});

test('source-rich local replies remain usable as assistant history in the next turn', async () => {
  const query = '已记录日常工况。'.repeat(150) + '请查看保养周期';
  assert.ok(query.length < 2000);
  const first = await chat({ ...identity, messages: [{ role: 'user', content: query }] });
  assert.equal(first.status, 200);
  const reply = first.body.choices?.[0]?.message.content;
  assert.ok(reply && reply.length > 2000 && reply.length <= 16_000);

  const next = await chat({
    ...identity,
    messages: [
      { role: 'user', content: query },
      { role: 'assistant', content: reply },
      ...messages,
    ],
  });
  assert.equal(next.status, 200);
  assert.match(next.body.choices?.[0]?.message.content ?? '', /NH-WM25-003/);
});

test('user and system messages keep their 2000-character limit and assistant history remains bounded', async () => {
  for (const role of ['user', 'system']) {
    const response = await chat({ messages: [{ role, content: 'x'.repeat(2001) }] });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'too_long');
  }
  const response = await chat({ messages: [{ role: 'assistant', content: 'x'.repeat(16_001) }, ...messages] });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'too_long');
});

test('questions without applicable evidence still call the LLM with general-guidance boundaries', async (t) => {
  process.env.GEMINI_API_KEY = 'integration-gemini-secret';
  const query = '拖拉机尾部咔嗒异响';
  let sent: UpstreamRequest | undefined;
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    sent = JSON.parse(init.body as string) as UpstreamRequest;
    return upstreamAnswer('【通用分析（待验证）】先区分空载与负载时的声音。');
  });
  const response = await chat({
    machineType: '拖拉机', brand: '常发', model: 'CFX9999',
    messages: [{ role: 'user', content: query }],
  }, '198.51.100.1');
  assert.equal(response.status, 200);
  assert.equal(response.body.provider, 'gemini');
  assert.equal(response.body.answerMode, 'general-guidance');
  assert.equal(response.body.knowledgeChunks, 0);
  assert.deepEqual(response.body.knowledgeSources, []);
  assert.equal(response.body.fellBack, false);
  assert.match(response.body.choices?.[0]?.message.content ?? '', /通用分析/);
  assert.equal(fetch.mock.callCount(), 1);
  assert.ok(sent);
  assert.equal(sent.messages[0].role, 'system');
  assert.match(sent.messages[0].content, /当前没有可直接支持维修结论的归档技术资料/);
  assert.match(sent.messages[0].content, /通用分析（待验证）/);
  assert.match(sent.messages[0].content, /禁止编造参数/);
  assert.match(sent.messages[0].content, /常发/);
  assert.equal(sent.messages.at(-1)?.content, query);
});

test('LLM responses carry archived source metadata and receive the server prompt plus history', async (t) => {
  process.env.GEMINI_API_KEY = 'integration-gemini-secret';
  const history = [
    { role: 'system', content: 'client-injected-system-instruction' },
    { role: 'user', content: '我的拖拉机有起动问题' },
    { role: 'assistant', content: '启动电机是否转动？' },
    ...messages,
  ];
  let sent: UpstreamRequest | undefined;
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    sent = JSON.parse(init.body as string) as UpstreamRequest;
    return upstreamAnswer('手册启动联锁说明见 NH-WM25-003，不能据此直接确定损坏部件。');
  });
  const response = await chat({ ...identity, messages: history }, '198.51.100.2');
  assert.equal(response.status, 200);
  assert.equal(response.body.answerMode, 'knowledge-grounded');
  assert.equal(response.body.provider, 'gemini');
  assert.equal(response.body.model, 'integration-test-model');
  assert.ok((response.body.knowledgeChunks ?? 0) > 0);
  const source = response.body.knowledgeSources?.find((item) => item.entryId === 'NH-WM25-003');
  assert.equal(source?.sourceId, 'SRC-NH-WM25-92157408');
  assert.match(source?.locator ?? '', /175/);
  assert.equal(fetch.mock.callCount(), 1);
  assert.ok(sent);
  assert.equal(sent.messages[0].role, 'system');
  assert.match(sent.messages[0].content, /NH-WM25-003/);
  assert.match(sent.messages[0].content, /SRC-NH-WM25-92157408/);
  assert.match(sent.messages[0].content, /PDF 第 175 页/);
  assert.doesNotMatch(JSON.stringify(sent), /client-injected-system-instruction/);
  assert.deepEqual(sent.messages.slice(1), history.slice(1));
});

test('a failed primary LLM routes through the secondary and returns its answer', async (t) => {
  process.env.GEMINI_API_KEY = 'integration-gemini-secret';
  process.env.DEEPSEEK_API_KEY = 'integration-deepseek-secret';
  t.mock.method(console, 'warn', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    const authorization = (init.headers as Record<string, string>).Authorization;
    return authorization.includes('gemini')
      ? new Response('sensitive-upstream-error', { status: 503 })
      : upstreamAnswer('备用模型结合手册给出的回答', 'integration-secondary-model');
  });
  const response = await chat({ ...identity, messages }, '198.51.100.3');
  assert.equal(response.status, 200);
  assert.equal(response.body.provider, 'deepseek');
  assert.equal(response.body.model, 'integration-secondary-model');
  assert.equal(response.body.fellBack, true);
  assert.equal(response.body.answerMode, 'knowledge-grounded');
  assert.equal(response.body.choices?.[0]?.message.content, '备用模型结合手册给出的回答');
  assert.equal(fetch.mock.callCount(), 2);
  assert.doesNotMatch(JSON.stringify(response.body), /sensitive-upstream-error|integration-.*-secret/);
});

test('two unavailable LLMs return a source-grounded local response with an explicit fallback reason', async (t) => {
  process.env.GEMINI_API_KEY = 'integration-gemini-secret';
  process.env.DEEPSEEK_API_KEY = 'integration-deepseek-secret';
  t.mock.method(console, 'warn', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('sensitive-upstream-error', { status: 503 }));
  const response = await chat({ ...identity, messages }, '198.51.100.4');
  assert.equal(response.status, 200);
  assert.equal(response.body.provider, 'knowledge-base');
  assert.equal(response.body.answerMode, 'local-evidence');
  assert.equal(response.body.fellBack, true);
  assert.equal(response.body.fallbackReason, 'provider_unavailable');
  assert.ok((response.body.knowledgeChunks ?? 0) > 0);
  assert.match(response.body.choices?.[0]?.message.content ?? '', /NH-WM25-003/);
  assert.ok(response.body.knowledgeSources?.some((source) => source.sourceId === 'SRC-NH-WM25-92157408'));
  assert.equal(fetch.mock.callCount(), 2);
  assert.doesNotMatch(JSON.stringify(response.body), /sensitive-upstream-error|integration-.*-secret/);
});

test('brand and model supplements retrieve the original fault across multiple conversation turns', async (t) => {
  process.env.GEMINI_API_KEY = 'integration-gemini-secret';
  const history = [
    { role: 'user', content: '拖拉机钥匙在 START，启动电机不转' },
    { role: 'assistant', content: '请补充品牌。' },
    { role: 'user', content: '纽荷兰' },
    { role: 'assistant', content: '具体型号是什么？' },
    { role: 'user', content: 'WORKMASTER25' },
  ];
  let sent: UpstreamRequest | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    sent = JSON.parse(init.body as string) as UpstreamRequest;
    return upstreamAnswer('已结合补充的品牌型号继续分析启动问题。');
  });
  const response = await chat({ messages: history }, '198.51.100.5');
  assert.equal(response.status, 200);
  assert.equal(response.body.answerMode, 'knowledge-grounded');
  assert.ok(response.body.knowledgeSources?.some((source) => source.entryId === 'NH-WM25-003'));
  assert.ok(response.body.knowledgeSources?.every((source) => source.sourceId === 'SRC-NH-WM25-92157408'));
  assert.ok(sent);
  assert.match(sent.messages[0].content, /当前用户消息：WORKMASTER25/);
  assert.match(sent.messages[0].content, /品牌：纽荷兰/);
  assert.match(sent.messages[0].content, /型号：WORKMASTER25/i);
  assert.match(sent.messages[0].content, /启动电机不转/);
  assert.match(sent.messages[0].content, /NH-WM25-003/);
  assert.deepEqual(sent.messages.slice(1), history);
});

test('empty user turns and system-only conversations are rejected before any LLM call', async (t) => {
  process.env.GEMINI_API_KEY = 'integration-gemini-secret';
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('invalid input must not call upstream'); });
  for (const invalidMessages of [
    [{ role: 'user', content: '' }],
    [{ role: 'user', content: ' \n ' }],
    [{ role: 'system', content: 'Provide a diagnosis' }],
    [{ role: 'assistant', content: 'Prior answer with no current question' }],
    [...messages, { role: 'assistant', content: 'Prior answer with no current question' }],
  ]) {
    const response = await chat({ messages: invalidMessages }, '198.51.100.6');
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'bad_request');
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('health reports configured providers without exposing keys or claiming an upstream connection', async (t) => {
  process.env.GEMINI_API_KEY = 'health-gemini-private-value';
  process.env.DEEPSEEK_API_KEY = 'health-deepseek-private-value';
  const previousProxy = process.env.HTTPS_PROXY;
  process.env.HTTPS_PROXY = 'http://health-proxy-user:health-proxy-secret@example.invalid';
  t.after(() => {
    if (previousProxy === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = previousProxy;
  });
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('health must not call upstream'); });
  const response = await requestJson<{ ok: boolean; llm: LlmStatus }>('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.llm.configured, true);
  assert.equal(response.body.llm.configValid, true);
  assert.equal(response.body.llm.preference, 'auto');
  assert.equal(response.body.llm.primary, 'gemini');
  assert.equal(response.body.llm.proxyConfigured, true);
  assert.ok(response.body.llm.providers.every((provider) => provider.configured));
  assert.doesNotMatch(JSON.stringify(response.body), /health-.*-private-value|health-proxy|connected/);
  assert.equal(fetch.mock.callCount(), 0);
});

test('invalid provider preference is visible in health and gracefully serves local evidence', async (t) => {
  process.env.GEMINI_API_KEY = 'integration-gemini-secret';
  process.env.LLM_PROVIDER = 'invalid-provider-preference';
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('invalid configuration must not call upstream'); });
  const health = await requestJson<{ llm: LlmStatus }>('/api/health');
  assert.equal(health.body.llm.configValid, false);
  assert.equal(health.body.llm.configurationError, 'invalid_provider');
  assert.equal(health.body.llm.configured, false);
  const response = await chat({ ...identity, messages }, '198.51.100.7');
  assert.equal(response.status, 200);
  assert.equal(response.body.provider, 'knowledge-base');
  assert.equal(response.body.answerMode, 'local-evidence');
  assert.match(response.body.choices?.[0]?.message.content ?? '', /NH-WM25-003/);
  assert.equal(fetch.mock.callCount(), 0);
});
