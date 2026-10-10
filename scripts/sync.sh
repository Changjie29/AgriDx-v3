#!/usr/bin/env sh
# 兼容旧入口；跨平台统一实现为 scripts/sync.mjs。
set -e
cd "$(dirname "$0")/.."
exec node scripts/sync.mjs "$@"
