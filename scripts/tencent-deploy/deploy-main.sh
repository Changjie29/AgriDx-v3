#!/usr/bin/env bash
# Install root-owned beside update-existing.sh. sudo allows only this entry.
set -euo pipefail
readonly REPOSITORY=https://github.com/srt2777/AgriDx-v3.git
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

fail() { printf '[deploy-main] %s\n' "$*" >&2; exit 1; }
[[ "$(id -u)" == 0 ]] || fail '部署入口必须由 root 执行。'
if [[ $# == 1 && "$1" == --check ]]; then
  exec /bin/bash "$SCRIPT_DIR/update-existing.sh" --check
fi
[[ $# == 2 && "$1" == --deploy && "$2" =~ ^[0-9a-f]{40}$ ]] ||
  fail '只允许 --check 或 --deploy <40位main提交SHA>。'

# Do not let an older CI completion or a stolen deployment key select arbitrary
# branches/history. The normal workflow separately requires successful main CI.
latest=$(git ls-remote --exit-code "$REPOSITORY" refs/heads/main)
[[ "$latest" =~ ^([0-9a-f]{40})[[:space:]]refs/heads/main$ ]] || fail '无法确认仓库最新 main。'
[[ "$2" == "${BASH_REMATCH[1]}" ]] || fail '该提交已不是最新 main，未开始部署。'
exec /bin/bash "$SCRIPT_DIR/update-existing.sh" --deploy "$2"
