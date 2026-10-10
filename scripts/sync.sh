#!/bin/bash
# 推送已提交的协作分支；先按 CONTRIBUTING.md 选择文件、验证并提交。
# 用法：在 AgriDx-v3 根目录执行 bash scripts/sync.sh
set -euo pipefail

cd "$(dirname "$0")/.."

BRANCH=$(git symbolic-ref --quiet --short HEAD) || {
  echo "[sync] 请先切换到协作分支。" >&2
  exit 1
}
case "$BRANCH" in
  main|master)
    echo "[sync] 请在个人分支开发，并通过 PR 合入 main。" >&2
    exit 1
    ;;
esac
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[sync] 请先验证并提交本次选定的改动；脚本不会自动暂存。" >&2
  exit 1
fi

git push --set-upstream origin "$BRANCH"
echo "[sync] 已推送 $BRANCH，请创建指向 main 的 PR。"
