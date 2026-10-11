# 腾讯云现有服务器配置

2026-10-11（上海）。用户授权配置已经运行的网站，并提供服务器控制台诊断。目标源码为 `srt2777/AgriDx-v3`，新版 UI 已通过 PR #8 合入 main；不改动 v2。

## 已确认的服务器环境

| 项目 | 用户网页终端输出 |
| --- | --- |
| 公网 IP | 43.128.40.157 |
| 系统 / 架构 | Ubuntu 24.04.4 LTS / x86_64 |
| Node / npm | /usr/local/bin/node，24.21.0 / 11.19.0 |
| 服务 | agridx.service，User=agridx，WorkingDirectory=/opt/agridx/current，active |
| 当前目录 | 软链接指向 /opt/agridx/releases/20261010-v3-87d169f |
| 运行环境文件 | /etc/agridx.env，ignore_errors=no；未读取密钥内容 |
| Nginx | agridx.xyz 和 www.agridx.xyz 的 HTTPS 已配置；另有公网 IP 的 HTTP 站点，保留默认站点 |
| 静态目录 / API | /opt/agridx/current/dist / http://127.0.0.1:8787 |
| 更新前本机健康 | version=3.0.0，knowledge.archivedEntries=212，knowledge.chunks=221 |

本任务环境不能直接连接服务器 IP：HTTP 代理拒绝该目标，TCP 白名单为空、未配置 SSH 身份。服务器操作由用户在腾讯云网页终端执行并回传结果。独立只读请求 `https://agridx.xyz/api/health` 成功返回同样的 3.0.0 / 212 / 221，首页 HTTP 200；没有把网络代理拒绝当作服务器故障。

## 手动更新方式

使用 [update-existing.sh](../../scripts/tencent-deploy/update-existing.sh)，仅适用于以上已有软链接、systemd 和 Nginx 部署。必须以 root 执行；`--check` 只检查条件，不构建、切换或重启。

```bash
sudo bash update-existing.sh --check
sudo bash update-existing.sh --deploy <经审阅的40位提交SHA>
```

不提供 SHA 时固定使用已合入新版 UI 的 `9be3056878c6519851ea2f9f7b4924c62601fa3e`（3.1.0）。3.1.1 是本轮部署工具的仓库版本，实际服务版本取决于传入的源码提交；发布时使用明确 SHA，不跟随移动的 main。

脚本克隆指定仓库到新的版本目录，以 agridx 用户安装锁定依赖、完整构建并裁剪开发依赖。保留 TypeScript 服务源码、知识库、public 和 dist，避免仅上传前端后接口缺失。已有根 .env / server/.env 如存在会安全复制，不输出内容；现有 systemd EnvironmentFile 保留，/etc/agridx.env 不改写。

新目录先在独立网络命名空间的临时服务中通过健康与静态页面检查，避免临时接口监听公网。检查通过后安装本脚本专用 systemd drop-in，用可被运行用户执行的 Node 路径运行 `--import tsx server.ts`，保持工作目录和 8787 端口。入口使用相对路径，让 Node 从真实工作目录解析模块；绝对 current/server.ts 软链接路径会与原有主模块判断不一致，已实际复现并补充启动回归。current 通过新软链接原子切换，重启 agridx 后再次校验源码版本、212 条归档及 221 片段，并检查 Nginx 首页与入口 JavaScript 和构建文件一致。失败则恢复旧软链接和原有 drop-in，并重启旧版。旧版本目录不删除。

脚本不修改 Nginx、证书、DNS、防火墙、其他服务、cloud-pull 或 cron。旧 `scripts/hk-deploy/setup-server.sh` / `update.sh` 指向其他仓库，并有覆盖现有 HTTPS 的风险，不适用于本台现有服务器。

## 验证与执行状态

已完成环境诊断和更新前线上只读检查。部署工具的 Bash 语法、差异检查、本地文档链接及完整 npm run verify 通过：122 项测试通过，2 项 Windows 专用测试在 Linux 跳过，前后端及 Vite 配置类型、Lint、前后端构建通过；保留既有 Fast Refresh 和 Three.js 包体积提示。9 项部署检查实际执行隔离的 Bash 流程，覆盖只读、构建及 stage 失败不影响旧服务、正式失败恢复有/无既有 drop-in、Nginx 旧页面回退、完整 SHA 成功路径，以及从工作目录软链接启动真实 TypeScript 服务。

本地生产命令 node --import tsx server.ts 另行启动成功，健康为 3.1.1 / 212 / 221，首页及模型 HEAD HTTP 200，模型大小 646,792 字节；测试明确清空模型 Key，没有真实外部模型请求，临时进程已停止。verify 对 loopback HTTP 使用既有本地请求调度，外部请求仍沿用环境代理。

服务器尚未执行新版切换，不能记录更新完成。下一步将已验证脚本保存到 GitHub，使用固定提交 SHA 的下载和手动执行命令；实际执行结果回传后再验收线上版本及界面。

切换后应分别确认：本机及域名 /api/health 的预期版本与 212 / 221、首页及 JS/CSS、工学院徽章、GLB、知识目录，以及新旧版切换。健康响应的 configured 状态仅证明密钥设置，真实外部模型调用需独立检查，不能用健康接口代替模型问答验收。
