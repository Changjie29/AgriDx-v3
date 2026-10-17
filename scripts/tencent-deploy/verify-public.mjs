import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { isMain } from '../lib/process.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

export async function controllerConfigured(baseUrl, fetchImpl = fetch) {
  const url = new URL('/deployment-automation.json', baseUrl);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('必须使用HTTPS正式站。');
  url.searchParams.set('__agridx_check', String(Date.now()));
  const response = await fetchImpl(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' },
    redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`服务器接入状态请求失败：HTTP ${response.status}`);
  let value;
  try { value = await response.json(); } catch { return false; }
  return value?.controller === 'agridx-github-sync' && value?.repository === 'srt2777/AgriDx-v3' && value?.configured === true;
}

export async function verifyPublicSite({ commit, version, entries, baseUrl,
  fetchImpl = fetch, attempts = 5, retryMs = 2000, isCurrent = () => true }) {
  const origin = new URL(baseUrl);
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash ||
      origin.username || origin.password || !/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error('必须使用 HTTPS 网站根地址和40位提交 SHA。');
  }
  async function resource(path) {
    const url = new URL(path, origin);
    url.searchParams.set('__agridx_check', String(Date.now()));
    const response = await fetchImpl(url, {
      cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`公网资源请求失败：${path} HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  let failure;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (!await isCurrent()) return { obsolete: true, commit };
    try {
      const [healthData, manifestData] = await Promise.all([
        resource('/api/health'), resource('/deployment.json'),
      ]);
      const health = JSON.parse(healthData.toString());
      const manifest = JSON.parse(manifestData.toString());
      if (health.ok !== true || health.version !== version ||
          health.knowledge?.archivedEntries !== entries ||
          !Number.isSafeInteger(health.knowledge?.chunks) || health.knowledge.chunks < entries) {
        throw new Error('公网服务版本或知识条数与部署源码不一致。');
      }
      if (manifest.commit !== commit || manifest.version !== version ||
          !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 100 ||
          !manifest.files.some(file => file.path === '/index.html') ||
          !manifest.files.some(file => /^\/assets\/[^/]+\.js$/.test(file.path)) ||
          !manifest.files.some(file => file.path === '/theme-init.js') ||
          new Set(manifest.files.map(file => file.path)).size !== manifest.files.length ||
          manifest.files.some(file => typeof file.path !== 'string' || file.path.includes('..') ||
            !/^(\/index\.html|\/theme-init\.js|\/assets\/[A-Za-z0-9._/-]+\.(js|css))$/.test(file.path) ||
            !/^[0-9a-f]{64}$/.test(file.sha256))) {
        throw new Error('公网部署清单与目标提交不一致或格式错误。');
      }
      await Promise.all(manifest.files.map(async file => {
        const contents = await resource(file.path === '/index.html' ? '/' : file.path);
        if (digest(contents) !== file.sha256) throw new Error(`公网文件仍为旧版或内容不一致：${file.path}`);
      }));
      return { commit, version, entries, files: manifest.files.length };
    } catch (error) {
      failure = error;
      if (attempt + 1 < attempts) await delay(retryMs);
    }
  }
  throw failure;
}

if (isMain(import.meta.url)) {
  try {
    const [commit, baseUrl = 'https://agridx.xyz', ...extra] = process.argv.slice(2);
    if (extra.length) throw new Error('用法：node verify-public.mjs <SHA> [HTTPS网站根地址]');
    if (commit === '--controller') {
      const configured = await controllerConfigured(baseUrl);
      if (configured) {
        appendFileSync(process.env.GITHUB_OUTPUT, 'configured=true\n');
      } else console.log('[verify-public] 已发布部署请求，腾讯服务器尚未接入自动同步；未宣称部署完成。');
      process.exit(0);
    }
    const version = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
    const entries = readFileSync(new URL('../../知识库/整理后的知识库/农用拖拉机知识库/entries.jsonl', import.meta.url), 'utf8')
      .split(/\r?\n/).filter(line => line.trim()).length;
    const isCurrent = () => {
      if (process.env.GITHUB_ACTIONS !== 'true') return true;
      const result = spawnSync('gh', ['api', 'repos/srt2777/AgriDx-v3/git/ref/heads/main', '--jq', '.object.sha'],
        { encoding: 'utf8', shell: false, timeout: 15000 });
      if (result.status !== 0 || !/^[0-9a-f]{40}$/.test(result.stdout.trim())) throw new Error('无法重新确认最新main。');
      return result.stdout.trim() === commit;
    };
    const result = await verifyPublicSite({ commit, version, entries, baseUrl, isCurrent, attempts: 60, retryMs: 5000 });
    if (!result.obsolete && process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'verified=true\n');
    console.log(`[verify-public] ${JSON.stringify(result)}`);
  } catch (error) {
    console.error(`[verify-public] ${error.message}`);
    process.exitCode = 1;
  }
}
