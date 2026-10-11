import { isMain, main, runPackageBin } from './lib/process.mjs';

export function typecheck() {
  for (const config of ['tsconfig.app.json', 'tsconfig.node.json', 'tsconfig.server.json']) {
    console.log(`[typecheck] ${config}`);
    runPackageBin('typescript', 'tsc', ['-p', config, '--noEmit']);
  }
}

if (isMain(import.meta.url)) main(typecheck, 'typecheck');
