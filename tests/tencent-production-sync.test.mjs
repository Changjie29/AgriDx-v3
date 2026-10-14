import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { verifyPublicSite } from '../scripts/tencent-deploy/verify-public.mjs';

const commit = 'a'.repeat(40);
const other = 'b'.repeat(40);
const linuxOnly = process.platform !== 'linux' ? 'SSH/systemd 部署入口需要 Linux' : false;

function shellFixture(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'agridx-production-sync-'));
  const bin = path.join(directory, 'bin');
  const log = path.join(directory, 'calls.jsonl');
  mkdirSync(bin);
  writeFileSync(log, '');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const name of ['deploy-main.sh', 'ssh-entry.sh', 'deploy-over-ssh.sh']) {
    const source = readFileSync(new URL(`../scripts/tencent-deploy/${name}`, import.meta.url), 'utf8');
    writeFileSync(path.join(directory, name), source.replace(
      '/usr/local/lib/agridx-deploy/deploy-main.sh', path.join(directory, 'deploy-main.sh')));
  }
  writeFileSync(path.join(directory, 'update-existing.sh'), `#!/bin/bash\nexec '${process.execPath}' '${path.join(bin, 'update')}' "$@"\n`);
  const mock = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const name = path.basename(process.argv[1]), args = process.argv.slice(2);
const record = { name, args };
if (name === 'ssh') {
  const key = args[args.indexOf('-i') + 1];
  const known = args.find(arg => arg.startsWith('UserKnownHostsFile=')).slice('UserKnownHostsFile='.length);
  record.keyDirectory = path.dirname(key);
  record.keyMode = fs.statSync(key).mode & 0o777;
  record.knownMode = fs.statSync(known).mode & 0o777;
  record.privateEnvRemoved = !process.env.TENCENT_SSH_PRIVATE_KEY && !process.env.TENCENT_SSH_KNOWN_HOSTS;
}
fs.appendFileSync(process.env.SYNC_FIXTURE_LOG, JSON.stringify(record) + '\\n');
if (name === 'id') console.log(process.env.SYNC_FIXTURE_UID || '0');
else if (name === 'git') {
  if (process.env.SYNC_FIXTURE_GIT_FAILURE) process.exit(1);
  console.log((process.env.SYNC_FIXTURE_MAIN || '${commit}') + '\\trefs/heads/main');
} else if (name === 'sudo') {
  if (args[0] !== '-n') process.exit(90);
  const result = spawnSync('/bin/bash', args.slice(1), { env: process.env, stdio: 'inherit' });
  process.exit(result.status ?? 1);
} else if (name === 'ssh-keygen') process.exit(process.env.SYNC_FIXTURE_UNKNOWN_HOST ? 1 : 0);
else if (name === 'ssh') process.exit(process.env.SYNC_FIXTURE_SSH_FAILURE ? 1 : 0);
`;
  for (const name of ['id', 'git', 'sudo', 'ssh-keygen', 'ssh', 'update']) {
    const file = path.join(bin, name);
    writeFileSync(file, mock);
    chmodSync(file, 0o755);
  }
  return {
    run(script, args = [], extra = {}) {
      writeFileSync(log, '');
      return spawnSync('/bin/bash', [path.join(directory, script), ...args], {
        encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`,
          SYNC_FIXTURE_LOG: log, RUNNER_TEMP: directory,
          TENCENT_SSH_PRIVATE_KEY: 'test-only-private-key', TENCENT_SSH_KNOWN_HOSTS: 'test-only-host-key',
          ...extra },
      });
    },
    calls: () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)),
  };
}

test('受限 SSH 入口拒绝交互、注入和任意命令，仅传递固定 sudo 入口及完整 SHA', { skip: linuxOnly }, t => {
  const fixture = shellFixture(t);
  for (const command of ['', 'bash', 'deploy main', `deploy ${commit}; id`, `deploy ${commit} extra`]) {
    const result = fixture.run('ssh-entry.sh', [], { SSH_ORIGINAL_COMMAND: command });
    assert.equal(result.status, 2);
    assert.equal(fixture.calls().length, 0);
  }
  assert.equal(fixture.run('ssh-entry.sh', [], { SSH_ORIGINAL_COMMAND: `deploy ${commit}` }).status, 0);
  assert.deepEqual(fixture.calls().find(call => call.name === 'update').args, ['--deploy', commit]);
  assert.equal(fixture.run('ssh-entry.sh', [], { SSH_ORIGINAL_COMMAND: 'check' }).status, 0);
  assert.deepEqual(fixture.calls().find(call => call.name === 'update').args, ['--check']);
});

test('特权部署入口在主干变化、远端失败或非root时拒绝启动更新', { skip: linuxOnly }, t => {
  const fixture = shellFixture(t);
  for (const extra of [{ SYNC_FIXTURE_MAIN: other }, { SYNC_FIXTURE_GIT_FAILURE: '1' }, { SYNC_FIXTURE_UID: '1000' }]) {
    assert.equal(fixture.run('deploy-main.sh', ['--deploy', commit], extra).status, 1);
    assert.ok(!fixture.calls().some(call => call.name === 'update'));
  }
  assert.equal(fixture.run('deploy-main.sh', ['--check']).status, 0);
  assert.ok(!fixture.calls().some(call => call.name === 'git'));
});

test('SSH 成功与失败均清理临时密钥，强制主机校验且不把密钥环境传给 SSH', { skip: linuxOnly }, t => {
  const fixture = shellFixture(t);
  for (const failure of ['', '1']) {
    const result = fixture.run('deploy-over-ssh.sh', [commit], { SYNC_FIXTURE_SSH_FAILURE: failure });
    assert.equal(result.status, failure ? 1 : 0);
    const ssh = fixture.calls().find(call => call.name === 'ssh');
    assert.ok(ssh);
    assert.equal(ssh.keyMode, 0o600);
    assert.equal(ssh.knownMode, 0o600);
    assert.equal(ssh.privateEnvRemoved, true);
    assert.ok(ssh.args.includes('StrictHostKeyChecking=yes'));
    assert.ok(ssh.args.includes('BatchMode=yes'));
    assert.deepEqual(ssh.args.slice(-2), ['ubuntu@43.128.40.157', `deploy ${commit}`]);
    assert.equal(existsSync(ssh.keyDirectory), false);
    assert.ok(!(result.stdout + result.stderr).includes('test-only-private-key'));
  }
});

test('没有部署密钥、主机匹配失败或非法参数时不发起 SSH 连接', { skip: linuxOnly }, t => {
  const fixture = shellFixture(t);
  for (const extra of [{ TENCENT_SSH_PRIVATE_KEY: '' }, { SYNC_FIXTURE_UNKNOWN_HOST: '1' },
    { TENCENT_SSH_HOST: 'host;id' }, { TENCENT_SSH_USER: '-oProxyCommand' }, { TENCENT_SSH_PORT: '65536' }]) {
    assert.equal(fixture.run('deploy-over-ssh.sh', [commit], extra).status, 1);
    assert.ok(!fixture.calls().some(call => call.name === 'ssh'));
  }
  assert.equal(fixture.run('deploy-over-ssh.sh', [`${commit};id`]).status, 1);
  assert.equal(fixture.calls().length, 0);
});

function publicFixture() {
  const bodies = new Map([
    ['/', '<div id="root"></div><script src="/assets/app.js"></script>'],
    ['/assets/app.js', 'console.log("fixture")'], ['/theme-init.js', '// fixture theme'],
  ]);
  const files = [...bodies].map(([resource, body]) => ({ path: resource === '/' ? '/index.html' : resource,
    sha256: createHash('sha256').update(body).digest('hex') }));
  const health = { ok: true, version: '3.4.8', knowledge: { archivedEntries: 2, chunks: 3 } };
  const manifest = { commit, version: '3.4.8', files };
  const options = { commit, version: '3.4.8', entries: 2, baseUrl: 'https://fixture.example/', attempts: 1, retryMs: 0,
    fetchImpl: async url => {
      const resource = url.pathname;
      const body = resource === '/api/health' ? JSON.stringify(health)
        : resource === '/deployment.json' ? JSON.stringify(manifest) : bodies.get(resource);
      return new Response(body || 'missing', { status: body ? 200 : 404 });
    } };
  return { options, bodies, health, manifest };
}

test('公网验收核对后端版本、完整提交及所有首页资源摘要', async () => {
  const fixture = publicFixture();
  assert.deepEqual(await verifyPublicSite(fixture.options), { commit, version: '3.4.8', entries: 2, files: 3 });
});

test('公网200但旧后端、旧提交、旧首页或旧JS均不能判定同步完成', async () => {
  const mutations = [fixture => { fixture.health.version = '3.1.1'; },
    fixture => { fixture.manifest.commit = other; },
    fixture => { fixture.bodies.set('/', 'old homepage'); },
    fixture => { fixture.bodies.set('/assets/app.js', 'old JavaScript'); }];
  for (const mutate of mutations) {
    const fixture = publicFixture();
    mutate(fixture);
    await assert.rejects(verifyPublicSite(fixture.options), /不一致|旧版/);
  }
});

test('公网清单不能诱导访问外站或父目录，短暂缓存失败后重试并重新核对', async () => {
  for (const resource of ['https://other.example/x.js', '/assets/../private.js']) {
    const fixture = publicFixture();
    fixture.manifest.files[1].path = resource;
    await assert.rejects(verifyPublicSite(fixture.options), /格式错误/);
  }
  const fixture = publicFixture();
  const healthyFetch = fixture.options.fetchImpl;
  let transient = true;
  fixture.options.fetchImpl = async (url, options) => {
    if (url.pathname === '/deployment.json' && transient) {
      transient = false;
      return new Response('warming', { status: 404 });
    }
    return healthyFetch(url, options);
  };
  fixture.options.attempts = 2;
  assert.equal((await verifyPublicSite(fixture.options)).commit, commit);
});
