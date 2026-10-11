import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = fileURLToPath(new URL('../../', import.meta.url));

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} 执行失败 (${result.signal ?? result.status})`);
  }
  return result;
}

export function runNode(script, args = [], options = {}) {
  return run(process.execPath, [script, ...args], options);
}

export function runPackageBin(packageName, binName, args = []) {
  const packageDir = path.join(rootDir, 'node_modules', packageName);
  const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const relativeBin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[binName];
  if (!relativeBin) throw new Error(`找不到 ${packageName} 的 ${binName} 入口，请先运行 npm ci。`);
  return runNode(path.resolve(packageDir, relativeBin), args);
}

/** Node resolves entry aliases in import.meta.url but keeps the supplied argv path. */
export function samePath(first, second) {
  const normalize = (value) => {
    const actual = realpathSync(path.resolve(value));
    return process.platform === 'win32' ? actual.toLowerCase() : actual;
  };
  return normalize(first) === normalize(second);
}

export function isMain(moduleUrl) {
  return Boolean(process.argv[1]) && samePath(process.argv[1], fileURLToPath(moduleUrl));
}

export function main(task, name) {
  try {
    task();
  } catch (error) {
    console.error(`[${name}] ${error.message}`);
    process.exitCode = 1;
  }
}
