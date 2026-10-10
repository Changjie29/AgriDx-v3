#!/usr/bin/env bash
# =============================================================
# AgriDx（耕知·耘诊）香港服务器代码更新脚本
# 用法：sudo bash update.sh（在服务器上执行）
# 更新 GitHub main -> 装依赖 -> 构建 -> 重启服务
# =============================================================
set -euo pipefail

APP_DIR="/opt/agridx"
REPO_MIRROR="https://ghfast.top/https://github.com/Changjie29/AgriDx-v3.git"

cd "$APP_DIR"

echo "==> 拉取最新代码"
git pull --quiet origin main || git pull --quiet "$REPO_MIRROR" main

echo "==> 安装依赖并构建"
npm install --include=dev
npm run build
npm prune --omit=dev

chown -R agridx:agridx "$APP_DIR"

echo "==> 重启服务"
systemctl restart agridx
sleep 2
systemctl is-active agridx

echo "==> 健康检查"
curl -s "http://127.0.0.1:3000/api/health" || true
echo
echo "更新完成。"
