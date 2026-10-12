import { spawnSync } from 'node:child_process';
import { rootDir, isMain, main } from './lib/process.mjs';

export function publishDevelopmentPreview(directory = rootDir) {
  const git = (args, allowFailure = false) => {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8', shell: false });
    if (result.error) throw result.error;
    if (result.status !== 0 && !allowFailure) throw new Error(result.stderr.trim() || `git ${args[0]} failed`);
    return result;
  };
  const origin = git(['remote', 'get-url', 'origin']).stdout.trim();
  if (!['https://github.com/srt2777/AgriDx-v3.git', 'git@github.com:srt2777/AgriDx-v3.git'].includes(origin)) {
    throw new Error('开发预览仅允许 srt2777/AgriDx-v3，请先核对 origin。');
  }
  const branch = git(['branch', '--show-current']).stdout.trim();
  if (!branch || branch === 'main' || branch === 'master') throw new Error('请在已提交的个人开发分支发布预览。');
  if (git(['status', '--porcelain']).stdout.trim()) throw new Error('请先保存任务改动，预览只推送完整提交。');
  const remote = git(['ls-remote', '--exit-code', 'origin', 'refs/heads/dev-preview'], true);
  if (remote.status === 0) {
    git(['fetch', 'origin', 'dev-preview']);
    if (git(['merge-base', '--is-ancestor', 'FETCH_HEAD', 'HEAD'], true).status !== 0) {
      throw new Error('开发预览已有其他成果，请先对照差异合并 origin/dev-preview，再验证和推送；禁止覆盖历史。');
    }
  } else if (remote.status !== 2) throw new Error(remote.stderr.trim() || '无法检查开发预览分支。');
  console.log(git(['push', '--no-follow-tags', 'origin', 'HEAD:refs/heads/dev-preview']).stderr.trim());
  console.log('开发预览已进入 GitHub Actions；以 Development preview 工作流和线上版本为准。');
}

if (isMain(import.meta.url)) main(publishDevelopmentPreview, 'preview:publish');
