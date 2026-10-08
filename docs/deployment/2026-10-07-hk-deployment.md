# 香港服务器部署指南（境内免梯子访问）

2026-10-07（上海）。目的：`agridx.xyz` 从 ChatGPT Sites（OpenAI 边缘，拦截境内 IP）迁移到香港服务器，使境内任何设备免梯子打开。

## 为什么必须迁出 ChatGPT Sites

ChatGPT Sites 的自定义域名走 OpenAI 的 Cloudflare 边缘，对境内 IP 返回 403 拦截页（"unable to access chatgpt.site"）；开梯子（海外出口）才放行。该拦截发生在 OpenAI 入口，修改 DNS 无法绕过。香港服务器可被境内网络直连，且域名无需 ICP 备案。

## 一、购买服务器（二选一）

| 提供商 | 规格建议 | 系统 | 备注 |
| --- | --- | --- | --- |
| 腾讯云轻量应用服务器（香港） | 2核2G 起，约 ¥30/月起 | Ubuntu 22.04/24.04 | 控制台选"轻量应用服务器"→香港地域 |
| 阿里云 ECS/轻量（香港） | 2核2G 起 | Ubuntu 22.04/24.04 | 按量/包月均可 |

购买后**立即在控制台安全组/防火墙放行 22、80、443 端口**，记下公网 IP（下文用 `服务器IP` 代替）。

## 二、改域名解析（万网控制台）

1. 阿里云万网 DNS 控制台 → `agridx.xyz` 解析记录：
2. 删除现有两条指向 Cloudflare 的 A 记录（`172.66.3.26`、`162.159.143.30`）。
3. 新增：记录类型 `A`、主机记录 `@`、记录值 `服务器IP`、TTL 默认 600。
4. 可选再增一条：主机记录 `www`、同样指向 `服务器IP`。
5. 等待生效（约 10 分钟），本地确认：

```bash
dig +short agridx.xyz        # 应返回 服务器IP
```

## 三、在服务器上运行部署脚本

SSH 登录服务器（root），从 GitHub 拉取并执行：

```bash
curl -fsSL -o setup-server.sh https://raw.githubusercontent.com/Changjie29/AgriDx-v2/main/scripts/hk-deploy/setup-server.sh
sudo bash setup-server.sh agridx.xyz
```

脚本自动完成：基础包 → Node 22 → 专用运行用户 → 克隆仓库 → 装依赖/构建/裁剪 → 生成 `server/.env` → systemd 守护 → Nginx 反代 → Let's Encrypt 证书 → ufw 防火墙。

> 前提：DNS 已生效指向本机，否则证书签发会失败（脚本会提示重跑，重跑安全）。
> 若 GitHub 直连不稳，脚本会自动改走 `ghfast.top` 镜像克隆。

## 四、配置 API Key（可选）

编辑 `/opt/agridx/server/.env` 填入：

```
GEMINI_API_KEY=...
DEEPSEEK_API_KEY=...
```

留空也能运行（本地知识库回答模式）。填完重启：`sudo systemctl restart agridx`。香港服务器上 DeepSeek 直连可用；Gemini 需服务器可访问 Google。

## 五、验证清单（境内网络执行）

```bash
curl -s https://agridx.xyz/api/health      # 200，version 应为仓库当前版本（2.2.5），165条/174片段
curl -s -o /dev/null -w '%{http_code}\n' https://agridx.xyz/          # 200
curl -s -o /dev/null -w '%{http_code}\n' https://agridx.xyz/#/chat    # 200（#后路径由浏览器处理）
curl -s -X POST https://agridx.xyz/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"拖拉机水温过高怎么办？"}]}'  # 200 JSON
```

浏览器（不开梯子、手机流量、不同网络）打开 `https://agridx.xyz/` 与 `https://agridx.xyz/#/chat`。

## 六、解绑 ChatGPT Sites 上的域名（防冲突）

在 ChatGPT Sites 站点设置 → Custom domain 中移除 `agridx.xyz`，避免它再写入 OpenAI 的解析要求。Sites 上的部署可保留作海外备用（默认 `*.chatgpt.site` 地址）。

## 七、日常运维

```bash
journalctl -u agridx -f                        # 看日志
sudo systemctl restart agridx                  # 重启
sudo bash /opt/agridx/scripts/hk-deploy/update.sh   # 拉最新代码并重建重启
sudo certbot renew --dry-run                   # 证书自动续期检查（certbot 自带定时器）
```

## 八、回滚

把 DNS 的 A 记录改回 Cloudflare 两条 IP 即回到 ChatGPT Sites（注意：境内访问会再次被拦截）。

## 边界与如实说明

- 本指南与脚本为部署准备；截至编写时尚未在真实香港服务器执行，未声称已上线。
- 香港线路对境内不同运营商/地区的速度有差异；追求最低延迟需境内服务器 + ICP 备案（另行评估）。
- 域名未备案：香港服务器无需备案；若日后改用境内服务器，需先完成 ICP 备案。
- 未验证外部 LLM（Gemini/DeepSeek）在服务器的实际连通性；未配置 Key 时服务以本地知识库模式运行。
