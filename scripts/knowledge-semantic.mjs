import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A separate OS process; never imported by the Express runtime or browser build.
const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const child = spawn(python, ['-B', path.join(root, '知识库/工具/语义去重.py'), ...process.argv.slice(2)], {
  cwd: root, stdio: 'inherit', shell: false,
  env: { ...process.env, OMP_NUM_THREADS: '1', MKL_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', TOKENIZERS_PARALLELISM: 'false' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => {
  console.error(`[knowledge-semantic] 无法运行Python 3.10+：${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
