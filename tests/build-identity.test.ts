import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));

function javascriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const file = path.join(directory, item.name);
    return item.isDirectory() ? javascriptFiles(file) : item.name.endsWith('.js') ? [file] : [];
  });
}

test('实际生产网页携带当前完整提交并接入自动更新，且不包含开发知识快照', async () => {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  assert.match(commit, /^[0-9a-f]{40}$/);
  const temporaryRoot = path.resolve(tmpdir());
  const directory = mkdtempSync(path.join(temporaryRoot, 'agridx-build-identity-'));
  try {
    await build({
      root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent',
      build: { outDir: directory, emptyOutDir: true },
    });
    const html = readFileSync(path.join(directory, 'index.html'), 'utf8');
    const identityTags = [...html.matchAll(/<meta\b[^>]*\bname="agridx-build-commit"[^>]*>/g)];
    assert.equal(identityTags.length, 1, 'HTML must identify exactly one immutable build');
    assert.match(identityTags[0][0], new RegExp(`\\bcontent="${commit}"`));

    const entryScripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"?]+\.js)"[^>]*>/g)]
      .filter(match => /\btype="module"/.test(match[0]));
    assert.ok(entryScripts.length > 0, 'the actual app entry must be built');
    const entries = entryScripts.map(match => {
      assert.match(match[1], /^\/assets\/[A-Za-z0-9._-]+\.js$/);
      return readFileSync(path.join(directory, match[1]), 'utf8');
    }).join('\n');
    assert.ok(entries.includes(commit), 'the running app must use the same full commit as its HTML');
    for (const marker of ['deployment.json', 'agridx:release-transitions:v1', 'agridx-build-commit']) {
      assert.ok(entries.includes(marker), `production entry is missing automatic update wiring: ${marker}`);
    }
    assert.ok(entries.includes('检测到新版，安全时将自动更新'), 'the app must mount the automatic-update status');

    const allJavascript = javascriptFiles(directory).map(file => readFileSync(file, 'utf8')).join('\n');
    for (const marker of ['agridx-preview-filesystem', 'createReadOnlyFileSystem', '农用拖拉机知识库/entries.jsonl']) {
      assert.ok(!allJavascript.includes(marker), `production must not bundle the development snapshot: ${marker}`);
    }
    const archive = readFileSync(path.join(root, '知识库/整理后的知识库/农用拖拉机知识库/entries.jsonl'), 'utf8')
      .split(/\r?\n/).filter(line => line.trim());
    assert.ok(archive.length > 1);
    for (const line of [archive[0], archive[archive.length - 1]]) {
      const { entry_id: entryId } = JSON.parse(line) as { entry_id: string };
      assert.ok(entryId, 'the archive sample must have a real entry ID');
      assert.ok(!allJavascript.includes(entryId), `archived fact ${entryId} must stay behind the production API`);
    }
  } finally {
    // Only remove the exact private directory created above, never the system temp root.
    assert.equal(path.dirname(directory), temporaryRoot);
    assert.ok(path.basename(directory).startsWith('agridx-build-identity-'));
    rmSync(directory, { recursive: true, force: true });
  }
});
