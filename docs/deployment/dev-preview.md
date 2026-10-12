# 独立开发预览

用户于2026-10-12（上海）授权独立、自动更新的开发网址，并明确选择未合并的开发分支。

预览使用独立 Sites 项目作为访问入口，GitHub Actions 构建产物保存在本仓库 `dev-preview-built` 分支，与腾讯网站的服务器、域名、证书、密钥、部署流程和浏览器存储隔离。`dev-preview` 为固定预览分支；只有推送到该分支才执行 `Development preview` 工作流，`main` 和普通个人分支推送不会发布网页。腾讯及原 Sites 的发布约定保持各自独立。

首版以加载与导航优化分支 `90cb706`（3.1.1，已包含3.1.0知识扩充）为开发基线，不额外合入其他待审 PR。首页、新旧界面、模型工坊、四级资料和本地知识诊断可预览。预览重用服务端的知识目录、型号边界、会话解释和本地 RAG 代码，通过构建时只读资料快照在浏览器运行；不包含原始手册、环境文件和模型密钥。外部 Gemini / DeepSeek 服务未接入该开发网址；网页标明“本地知识检索”。

## 更新同一个地址

在已有预览成果上继续开发，提交个人任务分支并保留 PR 审阅入口。首次开发可从 `origin/dev-preview` 建立 `codex/` 分支；已有分支先对照差异合并预览分支，避免覆盖其他成果。

```bash
npm run verify
npm run build:dev-preview
# 先按仓库约定提交并推送个人任务分支；然后更新固定预览分支
npm run preview:publish
```

`preview:publish` 只将当前完整提交快进推送到本仓库 `dev-preview`，拒绝在 main、错误 origin、脏工作区和非快进状态执行；不强制推送。GitHub Actions 重新运行验证、构建并快进更新产物分支；独立 Sites 入口通过固定公开仓库读取最新构建，不需要反复手工发布 Sites。更新延迟取决于任务排队和构建，并非每次按键立即上线。已打开的网页每30秒检查新部署，显示“新版已就绪，刷新”，刷新后加载最新构建并保留浏览器中已保存的会话。

默认生产构建关闭开发适配，不加载快照、开发标记或预览检查。开发预览输出保存在忽略的 `dist-preview/`，与腾讯使用的 `dist/` 分开。公开图片和模型遵循 Vite 的 BASE_URL，兼容独立网址和子目录。

实际部署网址、提交、检查结果另记录于本轮交付记录；构建与 Git 推送不单独作为已上线的证据。

## 托管与权限

开发预览项目ID：`appgprj_6accea9518e08191ba29e1f8b0f8725e`，与原 Sites 的项目ID不同。预期固定网址： https://agridx-dev-preview.z3464715478.chatgpt.site 。新站按 Sites 默认保持仅所有者登录访问。旧项目的 `.openai/hosting.json` 保持原样，开发配置单独保存在 `.openai/dev-preview.json`。

GitHub 连接在 Pages 创建接口返回403（Resource not accessible by integration），未启用 Pages。改为 GitHub Actions 通过内容写权限生成独立产物分支；Site 的 Worker 只读固定仓库的产物，不代理腾讯，不转发访客登录凭据。Worker 源码及隔离测试在 `scripts/dev-preview-gateway/worker.js` 与 `tests/dev-preview-gateway.test.ts`。

## 首次入口发布与验证

2026-10-12，独立 Sites 入口原生部署回执成功：`appgdep_6accebf622a88191a74ac0b50a0320c3`，保存版本 `appgprj_6accea9518e08191ba29e1f8b0f8725e~appgver_b4b7ae4e4dfc8191a0774d8eaa189a5b`，入口源码提交 `81f6feb459306c2ecfd60e5ca01769ab3aa8af2f`。该回执证明入口已部署；开发应用还须由 dev-preview 工作流完成产物发布，线上源码提交以 `/dev-preview.json` 与 `/api/health` 为准。本轮最终工作流、HTTP 验证及 PR 链接记录于 PR 交付说明。

本地完整 verify：143 项测试通过、2 项 Windows 专用测试在 Linux 跳过，版本一致性、前后端/Vite类型、Lint和完整构建通过。开发构建通过；测试加载实际浏览器构建模块，对照全部97个型号及所有有证据零件目录、已知和未知机型诊断、取消和错误响应。412条归档/421片段/26来源保持一致。普通生产构建中未生成开发API快照或预览标记模块；未进行真实浏览器渲染或真实外部模型调用验收。
