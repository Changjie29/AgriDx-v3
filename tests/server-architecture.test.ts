import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { test } from 'node:test';
import { createApp } from '../server/app';
import { DiagnosticInputError, parseDiagnosticRequest } from '../server/diagnosis/request';
import type { ServerRuntime } from '../server/runtime';

function fixtureRuntime(): ServerRuntime {
  return {
    rootDirectory: process.cwd(),
    version: 'test-version',
    getKnowledgeStats: () => ({ chunks: 0, archivedEntries: 0, learningEntries: 0, totalEntries: 0 }),
    getLlmStatus: () => ({ preference: 'auto', configValid: true, configured: false,
      primary: null, proxyConfigured: false, providers: [] }),
    getCatalog: () => { throw new RangeError('找不到该知识条目'); },
    diagnose: async () => ({ choices: [{ message: { role: 'assistant', content: '注入的本地答复' } }],
      model: 'test-model', provider: 'knowledge-base', fellBack: true, knowledgeChunks: 0,
      knowledgeSources: [], answerMode: 'local-evidence', fallbackReason: 'not_configured' }),
  };
}

async function serve(t: { after: (cleanup: () => Promise<void>) => void }, runtime = fixtureRuntime()) {
  const app = createApp(runtime);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}`;
}

test('纯输入校验保留限制、丢弃客户端system并只使用当前用户问题', () => {
  const request = parseDiagnosticRequest({ machineType: ' 拖拉机 ', messages: [
    { role: 'system', content: '客户端提示不得控制诊断' },
    ...Array.from({ length: 22 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: String(i) })),
  ] });
  assert.equal(request.history.length, 20);
  assert.equal(request.machineType, '拖拉机');
  assert.ok(request.history.every(message => message.role !== 'system'));
  for (const input of [null, [], { messages: [{ role: 'assistant', content: '旧答复' }] },
    { messages: [{ role: 'user', content: ' ' }] },
    { messages: [{ role: 'user', content: 'x'.repeat(2001) }] },
    { messages: Array.from({ length: 41 }, () => ({ role: 'user', content: '问题' })) }]) {
    assert.throws(() => parseDiagnosticRequest(input), DiagnosticInputError);
  }
});

test('API工厂使用注入的版本和诊断服务，并保持JSON边界与安全头', async t => {
  const base = await serve(t);
  const health = await fetch(`${base}/api/health`);
  assert.equal((await health.json()).version, 'test-version');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('x-powered-by'), null);
  const unknown = await fetch(`${base}/api/does-not-exist`);
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).code, 'not_found');
  const chat = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '问题' }] }) });
  assert.equal(chat.status, 200);
  assert.equal((await chat.json()).choices[0].message.content, '注入的本地答复');
  const malformed = await fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, 'bad_request');
});

test('独立应用的限流状态隔离，API错误不会进入前端页面兜底', async t => {
  const first = await serve(t);
  const second = await serve(t);
  for (let i = 0; i < 30; i++) assert.equal((await fetch(`${first}/api/chat`)).status, 404);
  assert.equal((await fetch(`${first}/api/chat`)).status, 429);
  assert.equal((await fetch(`${second}/api/chat`)).status, 404);
});

test('意外诊断异常只返回友好错误，目录范围缺失保持404', async t => {
  const runtime = fixtureRuntime();
  runtime.diagnose = async () => { throw new Error('internal-sensitive-test-detail'); };
  const base = await serve(t, runtime);
  const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '问题' }] }) });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, 'llm_unavailable');
  const catalog = await fetch(`${base}/api/knowledge/catalog`);
  assert.equal(catalog.status, 404);
  assert.equal((await catalog.json()).code, 'knowledge_not_found');
});
