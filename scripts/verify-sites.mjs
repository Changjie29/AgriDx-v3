import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

const origin = new URL(process.argv[2] || 'https://agridx.xyz');
if (origin.protocol !== 'https:' || origin.hostname !== 'agridx.xyz' || origin.username || origin.password) {
  throw new Error('Verification target must be https://agridx.xyz');
}
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));
const release = JSON.parse(await readFile('.openai/release.json', 'utf8'));
const cases = JSON.parse(await readFile('sites/verification-cases.json', 'utf8'));
const report = { target: origin.origin, checkedAt: new Date().toISOString(), sourceCommit: release.source_commit, checks: [], passed: false };

async function request(path, init = {}) {
  return fetch(new URL(path, origin), { ...init, signal: AbortSignal.timeout(20_000), headers: { 'Cache-Control': 'no-cache', ...init.headers } });
}
try {
  const healthResponse = await request('/api/health');
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.version, release.version);
  assert.equal(health.knowledge.chunks, 221);
  assert.equal(health.knowledge.archivedEntries, 212);
  assert.equal(health.knowledge.sources, 26);
  assert.equal(health.release.sourceCommit, release.source_commit);
  assert.equal(health.release.sourceRepository, release.source_repository);
  assert.equal(health.release.sourceBranch, release.source_branch);
  report.checks.push({ name: 'health', status: healthResponse.status, health });

  const home = await request('/');
  assert.equal(home.status, 200);
  const html = await home.text();
  const entry = html.match(/<script[^>]+src="([^"]+)"/);
  assert.ok(entry, 'Production entry script missing');
  const entryResponse = await request(entry[1]);
  assert.equal(entryResponse.status, 200);
  const remoteEntry = await entryResponse.text();
  const localEntry = await readFile('dist/client' + new URL(entry[1], origin).pathname, 'utf8');
  assert.equal(remoteEntry, localEntry, 'Online frontend does not match this build');
  // The displayed version can live in a lazy-loaded page rather than the entry.
  let contentName;
  for (const name of await readdir('dist/client/assets')) {
    if (name.endsWith('.js') && (await readFile('dist/client/assets/' + name, 'utf8')).includes(release.version)) {
      contentName = name;
      break;
    }
  }
  assert.ok(contentName, 'Product metadata chunk missing');
  const contentResponse = await request('/assets/' + contentName);
  assert.equal(contentResponse.status, 200);
  const remoteContent = await contentResponse.text();
  assert.equal(remoteContent, await readFile('dist/client/assets/' + contentName, 'utf8'));
  assert.ok(remoteContent.includes(release.version));
  report.checks.push({ name: 'frontend', status: home.status, entry: entry[1], exactBuildMatch: true });

  for (const path of ['/chat', '/chat/', '/chat?mode=diagnosis']) {
    for (const method of ['GET', 'HEAD']) {
      const chatPage = await request(path, { method });
      assert.equal(chatPage.status, 200, `${method} ${path}`);
      assert.ok(chatPage.headers.get('Content-Type')?.includes('text/html'));
      const pageHtml = await chatPage.text();
      if (method === 'HEAD') assert.equal(pageHtml, '');
      else {
        // Edge protection may append per-request scripts; verify the actual app.
        assert.ok(pageHtml.includes('<div id="root"></div>'));
        assert.equal(pageHtml.match(/<script[^>]+src="([^"]+)"/)?.[1], entry[1]);
      }
      report.checks.push({ name: `spa-chat-page ${method} ${path}`, status: chatPage.status });
    }
  }
  for (const path of ['/models/tractor.glb', '/models/tractor-detailed-v1.glb', '/api/model/tractor']) {
    const response = await request(path, { method: 'HEAD' });
    assert.equal(response.status, 200, path);
    assert.ok(!response.headers.get('Content-Type')?.includes('text/html'), path);
    report.checks.push({ name: path, status: response.status, contentType: response.headers.get('Content-Type') });
  }

  for (const testCase of cases) {
    const response = await request('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(testCase.request),
    });
    assert.equal(response.status, testCase.expected.status, testCase.id);
    const body = await response.json();
    assert.equal(body.knowledgeChunks, testCase.expected.knowledgeChunks, testCase.id);
    assert.equal(body.provider, 'knowledge-base', testCase.id);
    const reply = body.choices?.[0]?.message?.content;
    assert.equal(typeof reply, 'string', testCase.id);
    for (const term of testCase.expected.replyMustContainForKnowledgeProvider || []) {
      assert.ok(reply.includes(term), testCase.id + ': missing ' + term);
    }
    for (const entryId of testCase.expected.forbiddenEntries || []) {
      assert.ok(!reply.includes(entryId), testCase.id + ': wrong source ' + entryId);
    }
    report.checks.push({ name: testCase.id, status: response.status, knowledgeChunks: body.knowledgeChunks, provider: body.provider });
  }
  const invalid = await request('/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [] }),
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'bad_request');
  report.checks.push({ name: 'invalid-input', status: invalid.status });
  report.passed = true;
} catch (error) {
  report.failure = { message: error.message, cause: error.cause?.message || error.cause?.code };
  process.exitCode = 1;
} finally {
  await mkdir('.outputs', { recursive: true });
  await writeFile(`.outputs/verify-sites-${release.version}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
