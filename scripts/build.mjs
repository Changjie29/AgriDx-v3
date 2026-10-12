import { isMain, main, runPackageBin } from './lib/process.mjs';

export function build(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length === 1 && !['--client', '--server'].includes(args[0]))) {
    throw new Error('用法：node scripts/build.mjs [--client | --server]；默认构建前后端。');
  }
  if (args[0] !== '--server') {
    console.log('[build] 构建前端 → dist/');
    runPackageBin('typescript', 'tsc', ['-b', 'tsconfig.app.json']);
    runPackageBin('vite', 'vite', ['build']);
  }
  if (args[0] !== '--client') {
    console.log('[build] 编译后端 → dist-server/');
    runPackageBin('typescript', 'tsc', ['-p', 'tsconfig.server.json']);
  }
  console.log('[build] 完成本地构建。');
}

if (isMain(import.meta.url)) main(() => build(), 'build');
