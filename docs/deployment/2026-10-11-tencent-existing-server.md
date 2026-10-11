# 腾讯云现有服务器配置

2026-10-11（上海）。用户授权配置已经运行的网站，并提供服务器控制台诊断。目标源码为 `srt2777/AgriDx-v3`，新版 UI 已通过 PR #8 合入 main；不改动 v2。

## 已确认的服务器环境

| 项目 | 用户网页终端输出 |
| --- | --- |
| 公网 IP | 43.128.40.157 |
| 系统 / 架构 | Ubuntu 24.04.4 LTS / x86_64 |
| Node / npm | /usr/local/bin/node，实际路径 /opt/agridx/node-v24.21.0/bin/node，24.21.0 / 11.19.0 |
| 服务 | agridx.service，User=agridx，WorkingDirectory=/opt/agridx/current，active |
| 更新前目录 | 软链接指向 /opt/agridx/releases/20261010-v3-87d169f |
| 更新后目录 | /opt/agridx/releases/20261011T115619Z-0b8a670a547f-682062；旧目录保留 |
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

脚本克隆指定仓库到新的版本目录，以 agridx 用户安装锁定依赖、完整构建并裁剪开发依赖。每个版本使用自己的 `.npm-cache`，由 agridx 拥有、权限为 0700；三步 npm 命令显式指定缓存路径，构建子进程继承同一路径，避免旧 `/opt/agridx/.npm` 的权限影响更新。不修改全局缓存、npm 配置或数字 UID/GID。保留 TypeScript 服务源码、知识库、public 和 dist，避免仅上传前端后接口缺失。已有根 .env / server/.env 如存在会安全复制，不输出内容；现有 systemd EnvironmentFile 保留，/etc/agridx.env 不改写。

新目录先在独立网络命名空间的临时服务中通过健康与静态页面检查，避免临时接口监听公网。检查通过后安装本脚本专用 systemd drop-in，用可被运行用户执行的 Node 路径运行 `--import tsx server.ts`，保持工作目录和 8787 端口。入口使用相对路径，让 Node 从真实工作目录解析模块；绝对 current/server.ts 软链接路径会与原有主模块判断不一致，已实际复现并补充启动回归。current 通过新软链接原子切换，重启 agridx 后再次校验源码版本、212 条归档及 221 片段，并检查 Nginx 首页与入口 JavaScript 和构建文件一致。失败则恢复旧软链接和原有 drop-in，并重启旧版。旧版本目录不删除。

脚本不修改 Nginx、证书、DNS、防火墙、其他服务、cloud-pull 或 cron。旧 `scripts/hk-deploy/setup-server.sh` / `update.sh` 指向其他仓库，并有覆盖现有 HTTPS 的风险，不适用于本台现有服务器。

## 验证与执行状态

已完成环境诊断和更新前线上只读检查。部署工具的 Bash 语法、差异检查、本地文档链接及完整 npm run verify 通过：123 项测试通过，2 项 Windows 专用测试在 Linux 跳过，前后端及 Vite 配置类型、Lint、前后端构建通过；保留既有 Fast Refresh 和 Three.js 包体积提示。10 项部署检查实际执行隔离的 Bash 流程，覆盖只读、构建及 stage 失败不影响旧服务、正式失败恢复有/无既有 drop-in、Nginx 旧页面回退、完整 SHA 成功路径、旧默认缓存不可写时三步 npm 使用独立缓存，以及从工作目录软链接启动真实 TypeScript 服务。

本地生产命令 node --import tsx server.ts 另行启动成功，健康为 3.1.1 / 212 / 221，首页及模型 HEAD HTTP 200，模型大小 646,792 字节；测试明确清空模型 Key，没有真实外部模型请求，临时进程已停止。verify 对 loopback HTTP 使用既有本地请求调度，外部请求仍沿用环境代理。

实现保存到独立分支 codex/tencent-existing-server-20261011，通过 [PR #9](https://github.com/srt2777/AgriDx-v3/pull/9) 审阅；初始代码提交为 [bcdcfcd](https://github.com/srt2777/AgriDx-v3/commit/bcdcfcd4ff4cff262932364f0051299d2cd99d88)。用户首次执行 [b570618](https://github.com/srt2777/AgriDx-v3/commit/b570618fdefe637333cb5e41cff013bb26ad8575) 的更新命令，完整终端记录确认 npm ci 报 `EACCES: permission denied, mkdir '/opt/agridx/.npm'`，未完成依赖安装。失败目录 `/opt/agridx/releases/20261011T112950Z-b570618fdefe-675811` 保留，当时 current 未切换，旧 3.0.0 服务继续运行。同一 3.1.1 迭代修复为独立缓存后，以新的固定提交重试，不复用未安装完成的目录。

## 已完成的部署与公网验收

用户要求 GitHub 最新版本与网站同步后，PR #9 已合入 main，部署源码为 [0b8a670](https://github.com/srt2777/AgriDx-v3/commit/0b8a670a547f89b1349e1f49b0d8a347e90d3367)，版本 3.1.1。该主线源码树与已验证修复完全一致，主线 [CI 38136829114](https://github.com/srt2777/AgriDx-v3/actions/runs/38136829114) 的 Ubuntu、Windows 和 ci-verify 全部成功。

用户腾讯终端回执确认：新版本依赖安装、前后端构建及生产依赖裁剪完成，临时及正式服务、Nginx 代理健康均为 3.1.1 / 212 / 221，最终输出 `手动部署完成：version=3.1.1 commit=0b8a670a547f89b1349e1f49b0d8a347e90d3367`。current 切换至 `/opt/agridx/releases/20261011T115619Z-0b8a670a547f-682062`，旧版本保留。Nginx、证书、DNS、防火墙、cron 和现有 EnvironmentFile 未修改。npm 的 install-scripts 提示及 Three.js 大包提示没有阻断构建或服务启动；未修改全局 npm 或启用额外安装脚本。

独立公网 HTTPS 请求验收 29/29 通过，全部 HTTP 200，外部请求沿用环境代理：

| 检查 | 实际结果 |
| --- | --- |
| /api/health | ok=true，version=3.1.1，archivedEntries=212，chunks=221 |
| 首页、20 个 JS、3 个 CSS | 与本地已验证构建逐字节一致 |
| 工学院徽章 | 57,322 字节，与本地资源逐字节一致 |
| 静态 GLB 与 /api/model/tractor | 均为 646,792 字节，与本地资源一致；SHA-256 为 605f35f76f58c0c03aaac3acc31fa271dccd0e111ab65fbda2dc70dc3145b56e |
| /api/knowledge/catalog | 212 条资料、26 来源、15 品牌、97 型号/系列目录，实际目录行数一致 |

公网浏览器另外完成 9 项界面检查：首次进入默认蓝色新版，页脚显示 3.1.1；新旧版左上角均有工学院徽章，新版徽章链接经 DOM 检查指向 https://coe.njau.edu.cn/；切到旧版、刷新保留，再切回新版、刷新仍保留。新版拖拉机示意正常显示，知识概览实际显示 212 / 26 / 15 / 97。浏览器报告未发现页面错误，结束时保持新版。图片检查工具未能单独解析院徽图像内容，但浏览器可见院徽，独立 HTTP 已确认图片和本地官方资源逐字节一致。未扩大为全部模型控制、其他浏览器或手机实机验收。

健康响应的 configured 状态仅证明密钥设置；本轮未发起真实外部模型问答，不能用健康接口代替模型问答验收。

## 用户网络直连问题（排查中）

以上 HTTP 验收使用托管代理出口，浏览器验收使用远程浏览器，不能证明用户当前网络直连可用。用户随后反馈不开代理时 `https://agridx.xyz/` 为 `ERR_CONNECTION_CLOSED`；`http://43.128.40.157/` 显示未发送数据，三个测试地址均打不开。该反馈保留为待解决问题，不能把服务部署成功写成所有网络均可访问。

代理出口继续返回 3.1.1，apex/www 的 HTTP 重定向及 HTTPS 页面可用；本环境 TLS 由托管代理终止，观测到的 Envoy 和代理 CA 不能用于认定原站证书或来源。IP 的 HTTP 直连也失败，暂不将问题归为单独 DNS 或 TLS 原因。等待用户回传服务器 80/443 监听、本机防火墙、本机 HTTPS 检查、腾讯实例地域及云防火墙来源规则，并用手机移动数据比较。未修改 DNS、Nginx、证书或防火墙；没有把代理网络可用当作用户直连验收完成。
