import { readdirSync } from 'node:fs';
import path from 'node:path';
import { isMain, main, rootDir, run } from './lib/process.mjs';

export function runTests() {
  const testsDir = path.join(rootDir, 'tests');
  const files = readdirSync(testsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map((entry) => path.join(testsDir, entry.name))
    .sort();
  if (files.length === 0) throw new Error('tests/ 中没有找到 *.test.ts 文件。');
  // 显式传文件列表，Windows/Unix 都不依赖 shell 展开通配符。
  run(process.execPath, ['--import', 'tsx', '--test', ...files]);
}

if (isMain(import.meta.url)) main(runTests, 'test');
