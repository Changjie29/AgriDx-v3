# 腾讯正式站跟随 GitHub 主干更新

2026-10-14（上海）。用户确认正式站已在腾讯云运行，要求 GitHub 最新版自动同步到正式域名，并补充现有登录用户为 `ubuntu`、系统为 Ubuntu Server 24.04 LTS 64bit。本约定覆盖此前腾讯自动发布暂停；原 Sites 仍沿用暂停约定。仓库为 `srt2777/AgriDx-v3`，正式域名为 `https://agridx.xyz`。

## 本次核查与实际状态

- 本次 HTTPS 只读请求：首页 HTTP 200，`/api/health` 返回 3.1.1、412 条归档与 421 个片段；用户已确认自己可以正常打开网站。
- 开始本任务时最新 main 为 `7a94ebf807b7dc7dd27b3707cdd6de3885eef33b`、3.4.7、2213 条归档。两边尚未同步；源码保存不代表正式站已更新。
- 已有部署结构见 [腾讯服务器历史记录](2026-10-11-tencent-existing-server.md)：服务器 `43.128.40.157`，`agridx.service`，`/opt/agridx/current`，API 8787。域名当前解析到 CDN 节点，SSH 使用服务器 IP，不使用域名的 CDN IP。
- 当前 Codex 云环境 TCP 授权列表为空、无 SSH 连接绑定；配置中指示的 TCP 代理 8088 也不可连接。没有尝试绕过代理或发送登录密码。GitHub 的仓库内容操作可用，Actions Secrets 管理接口实际返回 403，无法代替管理员填入部署密钥。
- 本次准备工作流与接入脚本，没有执行服务器配置、更新 DNS 或部署正式站。接入后以 Actions 和公网验收结果确认上线，不把本说明当作部署回执。登录密码不保存到仓库或本说明。

## 自动更新流程

[`Tencent production`](../../.github/workflows/tencent-production.yml) 等待 `CI` 在 main 上成功结束，仅接收本仓库的 main push / 手动 CI；个人分支与 PR 不发布。手动运行生产工作流必须选择 main，并在连接前完整运行 `npm run verify`。

工作流选择、连接前、服务器入口分别核对最新 main 的完整 SHA。过期提交不会覆盖后来的主干；正在执行的部署不因新 push 被取消，后续任务串行执行。仓库变量 `TENCENT_DEPLOY_ENABLED=true` 是接入开关，未配置时不会连接生产服务器。开关只是运维配置，不替代 CI 验证。

SSH 私钥仅进入部署步骤的临时 0600 文件，结束或失败后清理；必须匹配管理员从可信腾讯终端取得的主机密钥。使用无密码的部署专用 Ed25519 密钥，服务器端 `restrict,command=...` 将此密钥限制到 `check` 或 `deploy <SHA>`，不允许交互 shell、端口转发或任意 sudo 命令。

[`update-existing.sh`](../../scripts/tencent-deploy/update-existing.sh) 沿用现有分目录构建、临时私网服务检查、current 原子切换、正式检查和失败回退，保留旧版本、Nginx、证书、DNS 与 EnvironmentFile。新增 `dist/deployment.json` 只记录公开版本、提交和首页/入口资源摘要，并由本机 Nginx 比对；该本机检查失败也会回退。

最后从正式 HTTPS 域名核对后端版本、知识条数、完整 SHA 和首页/主题脚本/首页引用 JS、CSS 的 SHA-256，避免 CDN 返回旧页面时错误显示成功。公网验收可短暂重试，最终失败会让 Actions 报错；公网/CDN 验收失败不会擅自回滚本机已经健康的新版本。验收范围不包括完整交互或真实外部 LLM 问答。

## 一次性接入

以下由能登录腾讯服务器和管理仓库 Secrets 的管理员执行。先合入本 PR，核对服务器仍为以上部署结构。所有服务器脚本固定下载到**本次已审阅的完整提交 SHA**；后续部署源码按最新 main 选择，部署工具不随个人分支更新。

### 1. 在自己的电脑生成专用密钥

```bash
ssh-keygen -t ed25519 -N '' -C agridx-github-production -f ~/.ssh/agridx-github
scp ~/.ssh/agridx-github.pub ubuntu@43.128.40.157:~/agridx-github.pub
```

私钥 `~/.ssh/agridx-github` 只用于配置 GitHub Secret，不发进聊天、不提交 Git。现有服务器密码仅用于这次个人 SSH 登录，不用于 Actions。

### 2. 在腾讯云可信终端安装受限部署入口

将下面 `INSTALL_SHA` 改为合入后已审阅的40位提交 SHA；不要使用移动分支名。

```bash
INSTALL_SHA=填入已审阅的40位提交SHA
[[ "$INSTALL_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
deploy_workdir=$(mktemp -d)
for script in update-existing.sh deploy-main.sh ssh-entry.sh; do
  curl -fsSL "https://raw.githubusercontent.com/srt2777/AgriDx-v3/$INSTALL_SHA/scripts/tencent-deploy/$script" -o "$deploy_workdir/$script" || exit 1
  bash -n "$deploy_workdir/$script" || exit 1
done
sudo install -d -m 0755 -o root -g root /usr/local/lib/agridx-deploy
sudo install -m 0700 -o root -g root "$deploy_workdir/update-existing.sh" "$deploy_workdir/deploy-main.sh" /usr/local/lib/agridx-deploy/
sudo install -m 0755 -o root -g root "$deploy_workdir/ssh-entry.sh" /usr/local/lib/agridx-deploy/
printf '%s\n' 'ubuntu ALL=(root) NOPASSWD: /usr/local/lib/agridx-deploy/deploy-main.sh' > "$deploy_workdir/agridx-github-sudoers"
sudo visudo -cf "$deploy_workdir/agridx-github-sudoers" || exit 1
sudo install -m 0440 -o root -g root "$deploy_workdir/agridx-github-sudoers" /etc/sudoers.d/agridx-github-deploy
sudo /usr/local/lib/agridx-deploy/deploy-main.sh --check || exit 1
```

在 `ubuntu` 的 `~/.ssh/authorized_keys` 新增一行（保留所有原有密钥）。`ssh-ed25519 ...` 替换为 `~/agridx-github.pub` 的完整内容：

```text
restrict,command="/usr/local/lib/agridx-deploy/ssh-entry.sh" ssh-ed25519 ... agridx-github-production
```

`~/.ssh` 权限为 0700，`authorized_keys` 为 0600，均归 ubuntu 所有。部署脚本和 sudoers 必须归 root 所有且不可被 ubuntu/agridx 写入。没有必要启用 root SSH 登录或修改现有密码登录方式。后续变更部署工具时重新核对、安装这三个 root 文件。

从**已登录的腾讯终端**取得主机公钥与指纹，不从未经验证的公网扫描盲目信任：

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
sudo awk '{print "43.128.40.157 " $1 " " $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

### 3. 配置仓库 Secrets 和 Variables

在 [GitHub Actions 设置](https://github.com/srt2777/AgriDx-v3/settings/secrets/actions) 配置：

| 类型 | 名称 | 值 |
| --- | --- | --- |
| Secret | `TENCENT_SSH_PRIVATE_KEY` | 专用 Ed25519 私钥文件的完整内容 |
| Secret | `TENCENT_SSH_KNOWN_HOSTS` | 上一步可信终端输出的主机公钥行 |
| Variable | `TENCENT_DEPLOY_ENABLED` | 完成连接配置后设置 `true` |
| Variable，可选 | `TENCENT_SSH_HOST` | 默认 `43.128.40.157` |
| Variable，可选 | `TENCENT_SSH_USER` | 默认 `ubuntu` |
| Variable，可选 | `TENCENT_SSH_PORT` | 默认 `22`；其他端口的 known_hosts 使用 `[host]:port` |
| Variable，可选 | `TENCENT_PUBLIC_URL` | 默认 `https://agridx.xyz` |

若个人电脑的 GitHub CLI 已有 Secrets 管理权限，也可从文件输入，无需将私钥显示到终端：

```bash
gh secret set TENCENT_SSH_PRIVATE_KEY --repo srt2777/AgriDx-v3 < ~/.ssh/agridx-github
gh secret set TENCENT_SSH_KNOWN_HOSTS --repo srt2777/AgriDx-v3 < ./verified-known-hosts
gh variable set TENCENT_DEPLOY_ENABLED --repo srt2777/AgriDx-v3 --body true
gh workflow run tencent-production.yml --repo srt2777/AgriDx-v3 --ref main
```

确保腾讯实例防火墙允许 GitHub 托管 runner 访问 SSH；不能把当前开发环境的 HTTP 网络权限当作 GitHub runner 的 SSH 连通性。若使用组织既有 runner 或网关，按实际网络配置调整，不在脚本中改防火墙。

### 4. 第一次验收与后续停止

首次设置完成后手动运行 main 的 `Tencent production`，查看部署和公网验收步骤；设置开关本身不会补跑已经结束的历史 CI。之后 main 的 CI 成功会自动触发，耗时取决于检查、安装和构建，通常是分钟级更新。

暂停后续自动更新时将 `TENCENT_DEPLOY_ENABLED` 改为 `false`；已运行的部署应完成或通过现有失败回退结束。撤销密钥时删除 authorized_keys 的专用行及对应 Secret，不删除其他登录密钥。
