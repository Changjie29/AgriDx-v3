import { realpathSync } from 'node:fs';
import { isMain, main, rootDir, run } from './lib/process.mjs';

function git(args, options = {}) {
  return run('git', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...options });
}

export function assertSyncState({ branch, status, defaultBranch }) {
  if (!branch) throw new Error('当前为 detached HEAD，请先切换到个人协作分支。');
  if (['main', 'master', defaultBranch].includes(branch)) {
    throw new Error(`不能推送稳定主线 ${branch}；请使用个人协作分支并通过 PR 合入。`);
  }
  if (status.trim()) {
    throw new Error('工作区有未提交或未跟踪的文件，请先验证并提交选定改动；sync 不会自动暂存或提交。');
  }
}

export function pushArguments(branch) {
  return ['push', '--no-follow-tags', '--set-upstream', 'origin', `HEAD:refs/heads/${branch}`];
}

export function sync(args = process.argv.slice(2)) {
  if (args.length) throw new Error('用法：node scripts/sync.mjs；只推送当前已提交的协作分支。');
  const topLevel = git(['rev-parse', '--show-toplevel']).stdout.trim();
  if (realpathSync(topLevel) !== realpathSync(rootDir)) {
    throw new Error('脚本所在目录不是独立的 Git 仓库根目录。');
  }
  const branch = git(['branch', '--show-current']).stdout.trim();
  const status = git(['status', '--porcelain=v1', '--untracked-files=all']).stdout;
  let defaultBranch;
  try {
    defaultBranch = git(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
      .stdout.trim().replace(/^origin\//, '');
  } catch {
    // 未缓存 origin/HEAD 时仍保护 main/master；不在此处触发网络查询。
  }
  assertSyncState({ branch, status, defaultBranch });
  git(['remote', 'get-url', '--push', 'origin']);
  console.log(`[sync] 推送已提交的 ${branch} 分支。`);
  git(pushArguments(branch), { stdio: 'inherit' });
  console.log('[sync] GitHub 保存完成；请创建代码 PR。不会创建标签、Release 或部署网站。');
}

if (isMain(import.meta.url)) main(sync, 'sync');
