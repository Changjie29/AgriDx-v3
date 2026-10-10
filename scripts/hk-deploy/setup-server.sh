#!/usr/bin/env bash
# =============================================================
# AgriDx（耕知·耘诊）香港服务器一键部署脚本
#
# 适用：Ubuntu 22.04 / 24.04（香港轻量服务器，免备案、境内可直连）
# 用法：sudo bash setup-server.sh [域名] [邮箱(可选，用于Let's Encrypt通知)]
#   默认域名 agridx.xyz；重复执行安全（已装步骤自动跳过）。
#
# 前置条件（先做，否则证书步骤会失败）：
#   1) 服务器安全组/防火墙放行 22、80、443；
#   2) 域名 A 记录已指向本机公网 IP（改完 DNS 再跑本脚本）。
#
# 完成后验证：
#   curl -s https://agridx.xyz/api/health          # 应返回 package.json 当前版本与知识库计数
#   curl -s -o /dev/null -w '%{http_code}\n' https://agridx.xyz/   # 200
# =============================================================
set -euo pipefail

DOMAIN="${1:-agridx.xyz}"
EMAIL="${2:-}"

APP_DIR="/opt/agridx"
APP_USER="agridx"
REPO_URL="https://github.com/Changjie29/AgriDx-v3.git"
# 若 GitHub 直连不稳，可改用镜像：
REPO_MIRROR="https://ghfast.top/https://github.com/Changjie29/AgriDx-v3.git"
PORT=3000

[ "$(id -u)" -eq 0 ] || { echo "请用 sudo 运行：sudo bash $0 $DOMAIN"; exit 1; }

say() { echo; echo "==> $*"; }

# ---------- 1. 基础包 ----------
say "安装基础软件包"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg nginx certbot python3-certbot-nginx ufw

# ---------- 2. Node.js ≥ 22.19 ----------
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 22 ]; then
  say "安装 Node.js 22（NodeSource）"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  say "Node.js 已存在：$(node -v)（要求 ≥22.19.0）"
fi
node -v
# 国内/香港访问 npm 官方源慢时可改用 npmmirror（如需切回官方，删除本行重跑）
npm config set registry https://registry.npmmirror.com || true

# ---------- 3. 运行用户 ----------
if ! id "$APP_USER" >/dev/null 2>&1; then
  say "创建运行用户 $APP_USER"
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi

# ---------- 4. 拉取代码 ----------
if [ -d "$APP_DIR/.git" ]; then
  say "仓库已存在，更新到最新"
  git -C "$APP_DIR" pull --quiet origin main || git -C "$APP_DIR" pull --quiet "$REPO_MIRROR" main
else
  say "克隆仓库到 $APP_DIR"
  mkdir -p "$APP_DIR"
  git clone --quiet "$REPO_URL" "$APP_DIR" || git clone --quiet "$REPO_MIRROR" "$APP_DIR"
fi

# ---------- 5. 安装依赖 + 构建 ----------
say "安装依赖并构建前端"
cd "$APP_DIR"
npm install --include=dev
npm run build
# 构建后只保留运行依赖（tsx 已在运行依赖中），与生产验收流程一致
npm prune --omit=dev

# ---------- 6. 环境变量（API Key，不提交 Git） ----------
if [ ! -f "$APP_DIR/server/.env" ]; then
  say "创建 server/.env（Key 留空 = 本地知识库模式，可随时编辑补填）"
  cat > "$APP_DIR/server/.env" <<EOF
# 不配置 Key 也能跑：未配置或调用失败时返回本地知识库回答
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
PORT=$PORT

# 香港服务器上 DeepSeek 可直连；Gemini 需要能访问 Google（如需代理在此填写）
# HTTPS_PROXY=
# HTTP_PROXY=
EOF
  echo "已生成 $APP_DIR/server/.env，请稍后用编辑器填入 API Key。"
fi

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ---------- 7. systemd 服务 ----------
say "配置 systemd 服务 agridx.service"
NPM_BIN="$(command -v npm)"
cat > /etc/systemd/system/agridx.service <<EOF
[Unit]
Description=AgriDx (耕知·耘诊) agricultural machinery fault diagnosis service
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$PORT
ExecStart=$NPM_BIN start
Restart=always
RestartSec=3
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable agridx
systemctl restart agridx

# ---------- 8. Nginx 反代 ----------
say "配置 Nginx 反向代理 $DOMAIN -> 127.0.0.1:$PORT"
cat > "/etc/nginx/sites-available/agridx" <<EOF
# AgriDx 反代配置（certbot --nginx 会自动追加 443 与跳转）
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
EOF
ln -sf "/etc/nginx/sites-available/agridx" /etc/nginx/sites-enabled/agridx
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ---------- 9. HTTPS 证书（需 DNS 已指向本机） ----------
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  say "已有 $DOMAIN 证书，跳过签发"
else
  say "签发 Let's Encrypt 证书"
  CERT_ARGS=(--nginx -d "$DOMAIN" -n --agree-tos)
  if [ -n "$EMAIL" ]; then CERT_ARGS+=(-m "$EMAIL"); else CERT_ARGS+=(--register-unsafely-without-email); fi
  if ! certbot "${CERT_ARGS[@]}"; then
    echo "!!! 证书签发失败：请确认域名 A 记录已指向本机公网 IP 且已全球生效（dig +short $DOMAIN），然后重跑本脚本。"
    exit 1
  fi
fi

# ---------- 10. 防火墙 ----------
say "配置 ufw（放行 22/80/443）"
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true
ufw status

say "部署完成"
echo "  站点:     https://$DOMAIN/"
echo "  对话页:   https://$DOMAIN/#/chat"
echo "  健康检查: https://$DOMAIN/api/health"
echo "  服务日志: journalctl -u agridx -f"
echo "  代码更新: bash $APP_DIR/scripts/hk-deploy/update.sh"
echo ""
echo "请现在从境内网络验证："
echo "  curl -s https://$DOMAIN/api/health"
