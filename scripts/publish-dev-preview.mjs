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
  // Dispatch only the current main workflow. Never mirror a personal branch or push Git refs.
  const result = spawnSync('gh', ['workflow', 'run', 'dev-preview.yml', '--repo', 'srt2777/AgriDx-v3', '--ref', 'main'], {
    cwd: directory, encoding: 'utf8', shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || '主干预览工作流派发失败。');
  console.log('已派发 main 主干预览构建；个人分支内容不会发布。请查看 Development preview 工作流和线上版本。');
}

if (isMain(import.meta.url)) main(publishDevelopmentPreview, 'preview:publish');
