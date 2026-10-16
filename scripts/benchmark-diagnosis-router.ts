/**
 * Reproducible local diagnosis benchmark; no real provider, credentials or user data.
 * node --import tsx scripts/benchmark-diagnosis-router.ts --root /path/to/tree \
 *   --phase baseline --out docs/performance/2026-10-13-diagnosis-router/baseline.json
 * --root can point to an immutable detached worktree, so baseline and after use
 * the identical runner/scenarios without changing either checkout.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
function argument(name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1] ?? fallback;
}
function optionalSystemFile(file: string): string | null {
  try { return fs.readFileSync(file, 'utf8').trim(); } catch { return null; }
}
const launchDirectory = process.cwd();
const root = path.resolve(argument('--root', launchDirectory));
const phase = argument('--phase', 'after');
const output = path.resolve(launchDirectory, argument('--out', `docs/performance/2026-10-13-diagnosis-router/${phase}.json`));
const iterations = Number(argument('--iterations', '120'));
const warmup = Number(argument('--warmup', '20'));
if (!Number.isInteger(iterations) || iterations < 100 || !Number.isInteger(warmup) || warmup < 1) {
  throw new Error('Use at least 100 measured iterations and a positive warmup.');
}
process.chdir(root);
// These values affect deterministic routing only. Provider calls below are stubs.
process.env.DIAGNOSIS_MODE = 'auto';
process.env.ALLOW_EXTERNAL_AI = 'true';
process.env.NODE_ENV = 'test';
process.env.DIAGNOSIS_LOG_DECISIONS = 'false';
const load = (relative: string): Promise<any> => import(pathToFileURL(path.join(root, relative)).href);
const [{ loadKnowledgeBase, retrieve, stats }, { resolveDiagnosticContext }, coordination, { createDiagnosticService }, { createApp }, catalog] = await Promise.all([
  load('server/knowledge/retriever.ts'), load('server/knowledge/conversation.ts'), load('server/knowledge/coordination.ts'),
  load('server/diagnosis/service.ts'), load('server/app.ts'), load('server/knowledge/catalog.ts'),
]);
const pureRouter = phase === 'after' ? await load('server/diagnosis/router.ts') : undefined;
const retrievalTools = phase === 'after' ? await load('server/knowledge/retriever.ts') : undefined;
loadKnowledgeBase();
catalog.loadKnowledgeCatalog();

type Scenario = { id: string; question: string; mode: 'auto' | 'knowledge_only' | 'ai_assisted'; brand?: string; model?: string };
const scenarios: Scenario[] = [
  { id: 'matched-start-auto', question: '发动机启动困难或不能启动', mode: 'auto', brand: '久保田', model: 'LX2620' },
  { id: 'yto-starter-auto', question: '起动机不转', mode: 'auto', brand: '东方红', model: 'LF1504' },
  { id: 'matched-runaway-auto', question: '发动机自行加速失控', mode: 'auto', brand: '东方红', model: 'LX1004' },
  { id: 'matched-start-local', question: '发动机启动困难或不能启动', mode: 'knowledge_only', brand: '久保田', model: 'LX2620' },
  { id: 'matched-start-assisted', question: '发动机启动困难或不能启动', mode: 'ai_assisted', brand: '久保田', model: 'LX2620' },
  { id: 'unknown-brake-risk', question: '拖拉机制动失灵，刹不住', mode: 'auto' },
  { id: 'missing-code-identity', question: '故障码是什么意思', mode: 'auto' },
  { id: 'real-reference-lookup', question: '查看原文 KB-LX2620-003 发动机启动困难或不能启动', mode: 'auto', brand: '久保田', model: 'LX2620' },
];
const status = { preference: 'deepseek', configValid: true, configured: true, primary: 'deepseek', proxyConfigured: false,
  providers: [{ provider: 'deepseek', model: 'benchmark-stub', configured: true }, { provider: 'gemini', model: 'benchmark-stub', configured: false }] };
let providerCalls = 0;
let providerSamples: number[] = [];
let retrievalCalls = 0;
const provider = {
  hasAnyConfigured: () => true,
  getStatus: () => status,
  async chat() {
    const start = performance.now();
    providerCalls++;
    // A zero-network, immediate successful generation isolates local overhead.
    const outcome = { result: { content: '性能测试模拟回答；不是维修资料。', model: 'benchmark-stub', provider: 'deepseek' }, primary: 'deepseek', fellBack: false };
    await Promise.resolve();
    providerSamples.push(performance.now() - start);
    return outcome;
  },
};
const diagnose = createDiagnosticService(provider, phase === 'after' ? {
  retrieve: (...parameters: any[]) => { retrievalCalls++; return retrieve(...parameters); },
  config: { logDecisions: false },
} : undefined);
function distribution(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (ratio: number) => sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
  return { samples: samples.length, p50Ms: percentile(0.50) ?? null, p95Ms: percentile(0.95) ?? null,
    minMs: sorted[0] ?? null, maxMs: sorted.at(-1) ?? null, meanMs: samples.length ? samples.reduce((sum, n) => sum + n, 0) / samples.length : null };
}
function measured<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
}
function requestFor(scenario: Scenario) {
  return { history: [{ role: 'user', content: scenario.question }], machineType: '拖拉机', brand: scenario.brand, model: scenario.model, diagnosisMode: scenario.mode };
}
function httpBody(scenario: Scenario) {
  const { history, ...identity } = requestFor(scenario);
  return { ...identity, messages: history };
}
const results: any[] = [];
const executionPaths: any[] = [];
const prepared = scenarios.map((scenario) => {
  const request = requestFor(scenario);
  const context = resolveDiagnosticContext(request.history, request);
  return { scenario, request, context, docs: retrieve(context.query, 5, context.scope) };
});
for (const { scenario, request, context, docs } of prepared) {
  for (let i = 0; i < warmup; i++) await diagnose(request);
  providerCalls = 0; providerSamples = []; retrievalCalls = 0;
  const retrieval: number[] = [], coldRetrieval: number[] = [], decisions: number[] = [], pureDecisions: number[] = [], service: number[] = [];
  const traced: Record<string, number[]> = { retrievalMs: [], decisionMs: [], externalAiMs: [], totalMs: [] };
  let last: any;
  for (let i = 0; i < iterations; i++) {
    retrieval.push(measured(() => retrieve(context.query, 5, context.scope)).ms);
    const decisionInput = { ...context, retrieved: docs, requestedMode: scenario.mode, llmConfigured: true, llmConfigValid: true };
    decisions.push(measured(() => coordination.decideCoordination(decisionInput)).ms);
    if (pureRouter) pureDecisions.push(measured(() => pureRouter.DiagnosisRouter.decide(decisionInput)).ms);
    const start = performance.now();
    last = await diagnose(request);
    service.push(performance.now() - start);
    for (const [stage, samples] of Object.entries(traced)) {
      if (typeof last.diagnosisTrace?.timings?.[stage] === 'number') samples.push(last.diagnosisTrace.timings[stage]);
    }
  }
  if (retrievalTools?.clearRetrievalCache) {
    for (let i = 0; i < iterations; i++) {
      retrievalTools.clearRetrievalCache();
      coldRetrieval.push(measured(() => retrieve(context.query, 5, context.scope)).ms);
    }
  }
  results.push({ ...scenario, retrieval: distribution(retrieval), coordinationCompatibility: distribution(decisions), serviceTotal: distribution(service),
    ...(pureRouter ? { coldRetrieval: distribution(coldRetrieval), pureDecision: distribution(pureDecisions), instrumentedServiceRetrievals: retrievalCalls,
      serviceRetrievalsPerRequest: retrievalCalls / iterations, serviceTraceTimings: Object.fromEntries(Object.entries(traced).map(([stage, samples]) => [stage, distribution(samples)])),
      lastServiceTrace: last.diagnosisTrace ?? null } : {}),
    providerStub: distribution(providerSamples), successfulMockGenerations: providerCalls, mockGenerationsPerRequest: providerCalls / iterations,
    route: last.coordination?.route, reason: last.coordination?.reason, coordination: last.coordination ?? null,
    knowledgeIds: last.knowledgeSources?.map((source: any) => source.entryId).filter(Boolean) ?? [], responseChars: last.choices[0].message.content.length });
}
if (retrievalTools?.clearRetrievalCache) {
  for (const result of results) {
    const scenario = scenarios.find((candidate) => candidate.id === result.id)!;
    const samples: number[] = [];
    providerCalls = 0; providerSamples = []; retrievalCalls = 0;
    for (let i = 0; i < iterations; i++) {
      retrievalTools.clearRetrievalCache();
      const start = performance.now();
      await diagnose(requestFor(scenario));
      samples.push(performance.now() - start);
    }
    result.coldServiceTotal = distribution(samples);
    result.coldServiceSuccessfulMockGenerations = providerCalls;
    result.instrumentedColdServiceRetrievals = retrievalCalls;
  }
}

// An isolated, fully reviewed synthetic original-reference fixture exercises
// the old fast path. It is deliberately not injected into real service evidence.
const fixture = { source: 'fixture.md', heading: 'TEST-001｜测试资料章节', text: '测试数据，不用于维修。',
  entryId: 'TEST-001', sourceId: 'SOURCE-001', entryType: '维护/故障知识', applicability: 'matched', locator: '测试页1',
  indexedReference: { entryId: 'TEST-001', sourceId: 'SOURCE-001' }, version: '测试版', status: '已核验', scopeBoundary: '仅适用于测试车型LF904S' };
const directInput = { query: '查看测试资料章节', currentQuery: '查看测试资料章节', scope: { machineType: '拖拉机', brand: '东方红', model: 'LF904S' },
  retrieved: [fixture], clarificationNeeded: false, llmConfigured: true };
const directSamples: number[] = [];
for (let i = 0; i < warmup; i++) coordination.decideCoordination(directInput);
for (let i = 0; i < iterations; i++) directSamples.push(measured(() => coordination.decideCoordination(directInput)).ms);
const directReferenceFixture = { provenance: 'Synthetic test fixture, not real maintenance knowledge',
  timing: distribution(directSamples), decision: coordination.decideCoordination(directInput) };

const app = createApp({ rootDirectory: root, version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
  diagnose, getKnowledgeStats: stats, getLlmStatus: () => status, getCatalog: catalog.getKnowledgeCatalog });
const listener = await new Promise<http.Server>((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
const address = listener.address();
if (!address || typeof address === 'string') throw new Error('Missing localhost port');
let serial = 0;
async function post(scenario: Scenario) {
  const body = JSON.stringify(httpBody(scenario));
  // Each independent test client has a unique IP to avoid measuring rejection.
  // This is confined to a localhost app, not an externally deployed server.
  const fakeClientIp = `198.18.${Math.floor(serial / 250)}.${++serial % 250 + 1}`;
  return new Promise<any>((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port: address.port, path: '/api/chat', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Forwarded-For': fakeClientIp } }, (response) => {
      const parts: Buffer[] = [];
      response.on('data', (chunk) => parts.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}: ${Buffer.concat(parts)}`));
        resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));
      });
    });
    request.on('error', reject); request.end(body);
  });
}
try {
  for (const result of results) {
    const scenario = scenarios.find((candidate) => candidate.id === result.id)!;
    for (let i = 0; i < warmup; i++) await post(scenario);
    providerCalls = 0; providerSamples = []; retrievalCalls = 0;
    const samples: number[] = [];
    let lastHttpResponse: any;
    for (let i = 0; i < iterations; i++) { const start = performance.now(); lastHttpResponse = await post(scenario); samples.push(performance.now() - start); }
    result.httpTotal = distribution(samples);
    result.httpSuccessfulMockGenerations = providerCalls;
    if (pureRouter) result.instrumentedHttpRetrievals = retrievalCalls;
    if (retrievalTools?.clearRetrievalCache) {
      providerCalls = 0; providerSamples = []; retrievalCalls = 0;
      const coldSamples: number[] = [];
      for (let i = 0; i < iterations; i++) {
        retrievalTools.clearRetrievalCache();
        const start = performance.now();
        await post(scenario);
        coldSamples.push(performance.now() - start);
      }
      result.coldHttpTotal = distribution(coldSamples);
      result.coldHttpSuccessfulMockGenerations = providerCalls;
      result.instrumentedColdHttpRetrievals = retrievalCalls;
    }
    if (pureRouter) {
      const preparedScenario = prepared.find(candidate => candidate.scenario.id === scenario.id)!;
      executionPaths.push({ scenario: scenario.id, request: httpBody(scenario),
        execution: ['Express POST /api/chat', 'parseDiagnosticRequest', 'resolveDiagnosticContext', 'One retrieve(query, topK=5, scope)',
          'DiagnosisRouter.decide with already retrieved metadata', lastHttpResponse.coordination?.route === 'ai' ? 'One successful in-process provider stub generation' : 'Local structured response; zero provider generations', 'HTTP 200 JSON response'],
        retrievalContext: preparedScenario.context,
        retrievedKnowledge: preparedScenario.docs.map(({ entryId, sourceId, heading, text, status, applicability, relevance, diagnosticMetadata, locator, version, scopeBoundary }: any) =>
          ({ entryId, sourceId, heading, text, status, applicability, relevance, diagnosticMetadata, locator, version, scopeBoundary })),
        response: lastHttpResponse });
    }
  }
} finally { await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve())); }

const report = {
  schemaVersion: 1, phase, capturedAt: new Date().toISOString(), rootCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  scenarioSha256: createHash('sha256').update(JSON.stringify(scenarios)).digest('hex'),
  measuredSourceSha256: Object.fromEntries(['server/diagnosis/service.ts', 'server/diagnosis/router.ts', 'server/diagnosis/config.ts',
    'server/knowledge/retriever.ts', 'server/knowledge/scope.ts', 'server/knowledge/coordination.ts', 'server/knowledge/evidence.ts',
    'server/knowledge/systemPrompt.ts', 'server/knowledge/fallbackDiagnosis.ts', 'server/app.ts', 'server/routes/chat.ts']
    .filter(relative => fs.existsSync(path.join(root, relative)))
    .map(relative => [relative, createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex')])),
  projectVersion: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
  environment: { node: process.version, platform: os.platform(), architecture: os.arch(), osRelease: os.release(), cpuModel: os.cpus()[0]?.model,
    logicalCpuCount: os.cpus().length, memoryBytes: os.totalmem(), loadAverage: os.loadavg(),
    cgroupCpuMax: optionalSystemFile('/sys/fs/cgroup/cpu.max'), cgroupMemoryMax: optionalSystemFile('/sys/fs/cgroup/memory.max') },
  knowledge: stats(), method: { iterationsPerScenario: iterations, warmupPerScenario: warmup, concurrency: 1, retrievalTopK: 5,
    serviceRetrievalTopK: phase === 'baseline' ? 6 : 5, retrievalCache: phase === 'after' ? 'Warm cache after scenario warmup; coldRetrieval/coldServiceTotal/coldHttpTotal clear only cached results before every measured same-input request' : 'No retrieval cache in baseline',
    logging: phase === 'after' ? 'Routing decision logs disabled using the documented config; response tracing remains enabled' : 'No routing decision logs in baseline',
    provider: 'Immediate in-process stub; zero external API calls', http: 'Actual Express /api/chat over localhost; unique simulated client IPs',
    percentiles: 'Nearest rank on sorted durations', scope: 'Warm-process local overhead, not production load capacity or real AI/network latency',
    stageIsolation: 'Retrieval/compatibility-decision measured independently; service/HTTP measured end to end, not their sum',
    fixture: 'Pure synthetic direct-reference fixture is measured separately from real indexed knowledge',
  }, scenarios: results, directReferenceFixture,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
if (phase === 'after') fs.writeFileSync(path.join(path.dirname(output), 'execution-paths.json'), JSON.stringify({
  capturedAt: report.capturedAt, rootCommit: report.rootCommit, measuredSourceSha256: report.measuredSourceSha256,
  provider: 'Immediate in-process successful stub, not DeepSeek or Gemini; no real API calls or credentials',
  scope: 'Actual Express localhost requests using fixed synthetic questions and real public archived knowledge; not real user records',
  scenarios: executionPaths,
}, null, 2) + '\n');
console.log(JSON.stringify({ output, phase, knowledge: report.knowledge, scenarios: results.map(({ id, serviceTotal, httpTotal, successfulMockGenerations, route, reason }) =>
  ({ id, serviceP50Ms: serviceTotal.p50Ms, serviceP95Ms: serviceTotal.p95Ms, httpP95Ms: httpTotal.p95Ms, successfulMockGenerations, route, reason })) }, null, 2));
