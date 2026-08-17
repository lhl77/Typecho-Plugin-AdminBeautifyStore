# AB Store 服务端（Cloudflare Worker）

Typecho 插件分享仓库「AB Store」的服务端，部署于 Cloudflare Workers，域名 `ab-store.lhl.one`。
方案细节见 [PLAN.md](./PLAN.md)，配置项逐项说明见 [CONFIG.md](./CONFIG.md)。

## 功能

- 首页（MD3 响应式）：介绍 + 已上架插件列表
- 账号：邮箱 + 密码注册（强制邮箱验证码）、忘记密码、GitHub 绑定与快捷登录（GitHub 不能直接注册）
- 分享：外链 URL 或上传 ZIP（≤2MB，WebDAV → OpenList → GitHub share 分支），自动分配 6 位分享口令
- 审核：管理员（`ADMIN_USERS`）登录后可见「审核」入口，通过 / 拒绝 / 编辑 / 下架，全程 SMTP 邮件通知
- 下载：`/api/download/<id>` 计数后 302 到 gh1.lhl.one 镜像直链

## 部署

```bash
# 1. 安装依赖（仅需 wrangler）
npm i -g wrangler

# 2. 创建 KV 命名空间，把返回的 id 填入 wrangler.toml
wrangler kv namespace create KV

# 3. 填写 wrangler.toml 的 [vars]（见 CONFIG.md）

# 4. 设置密钥
wrangler secret put TURNSTILE_SECRET
wrangler secret put WEBDAV_PASS
wrangler secret put SMTP_PASS
wrangler secret put GITHUB_CLIENT_SECRET

# 5. 本地开发
cp .dev.vars.example .dev.vars   # 填入真实密钥
wrangler dev

# 6. 部署
wrangler deploy
# 然后在 Cloudflare Dashboard 为该 Worker 绑定自定义域 ab-store.lhl.one
```

## 前置条件

- OpenList 已挂载 GitHub 仓库 `lhl77/Typecho-Plugin-AdminBeautifyStore` 的 `share` 分支，且 WebDAV 入口（`WEBDAV_BASE`）指向该挂载目录。
- gh1.lhl.one 白名单中包含 `lhl77/Typecho-Plugin-AdminBeautifyStore`（或使用其 `/d/` 免白名单路径，届时调整 `src/lib/webdav.js` 的 `buildDownloadUrl`）。
- GitHub OAuth App 的回调地址配置为 `https://ab-store.lhl.one/auth/github/callback`。
