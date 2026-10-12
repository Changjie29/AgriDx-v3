import { build } from './build.mjs';
import { checkVersion } from './check-version.mjs';
import { typecheck } from './typecheck.mjs';
import { runTests } from './run-tests.mjs';
import { main, runPackageBin } from './lib/process.mjs';

main(() => {
  checkVersion();
  typecheck();
  runTests();
  runPackageBin('eslint', 'eslint', [
    '.', '--cache', '--cache-location', 'node_modules/.eslintcache', '--report-unused-disable-directives',
  ]);
  build([]);
  console.log('[verify] 版本、前后端类型、测试、lint 和完整构建全部通过。');
}, 'verify');
