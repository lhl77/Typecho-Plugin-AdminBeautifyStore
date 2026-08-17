# AB Store 配置说明

> 所有配置通过环境变量注入 Worker。本文件逐项说明每个变量的用途、示例值与存放位置。
>
> **存放规则**：
> - **非敏感项** → 写入 `wrangler.toml` 的 `[vars]`（可提交入库）。
> - **敏感密钥** → 生产环境执行 `wrangler secret put <NAME>`；本地开发复制 `.dev.vars.example` 为 `.dev.vars`（已 gitignore）后填真实值。

---

## 非敏感配置（wrangler.toml `[vars]`）

| 变量 | 用途 | 示例值 |
|---|---|---|
| `TURNSTILE_SITEKEY` | Turnstile 站点密钥（前端 widget 用，本身公开） | `0x4AAAAAAA...` |
| `GH1_BASE` | GitHub 镜像 Worker 域名，用于拼接下载直链 | `https://gh1.lhl.one` |
| `GITHUB_REPO` | OpenList 挂载的 GitHub 仓库 | `lhl77/Typecho-Plugin-AdminBeautifyStore` |
| `GITHUB_BRANCH` | 存储 ZIP 的分支 | `share` |
| `ADMIN_USERS` | 管理员用户名列表（逗号分隔），决定谁能看到「审核」入口 | `lhl` |
| `ADMIN_EMAILS` | 接收「新插件待审核」通知的邮箱（逗号分隔） | `admin@lhl.one` |
| `MAIL_FROM` | 邮件发件人（含显示名） | `AB Store <noreply@lhl.one>` |
| `SMTP_HOST` | SMTP 服务器主机 | `smtp.qq.com` |
| `SMTP_PORT` | SMTP 端口（465 = SSL 隐式 TLS） | `465` |
| `SMTP_USER` | SMTP 登录账号（半敏感，不放心可挪 secret） | `noreply@lhl.one` |
| `WEBDAV_BASE` | OpenList 的 WebDAV 入口（指向挂载 GitHub 的目录） | `https://openlist.lhl.one/dav/github` |
| `WEBDAV_USER` | WebDAV 用户名（半敏感，不放心可挪 secret） | `abstore` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App 的 Client ID（本身公开） | `Ov23li...` |

## 敏感密钥（secret / .dev.vars，**不入库**）

| 变量 | 用途 | 获取方式 |
|---|---|---|
| `TURNSTILE_SECRET` | Turnstile 服务端校验密钥 | Cloudflare Dashboard → Turnstile |
| `WEBDAV_PASS` | WebDAV 密码 | OpenList 用户密码 |
| `SMTP_PASS` | SMTP 密码 / 授权码 | 邮箱服务商（QQ/163 用授权码） |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret | GitHub → Developer settings → OAuth Apps |

---

## 上传路径与下载直链约定

- **WebDAV 上传路径**：`{WEBDAV_BASE}/<插件dir>/<用户名>/<插件id>/<文件名>.zip`
- **下载直链拼接**：`{GH1_BASE}/https://raw.githubusercontent.com/{GITHUB_REPO}/{GITHUB_BRANCH}/<插件dir>/<用户名>/<插件id>/<文件名>.zip`
- **前提**：gh1.lhl.one 的白名单中需包含 `lhl77/Typecho-Plugin-AdminBeautifyStore`（在 gh1 管理后台添加），否则改用其 `/d/` 免白名单路径格式。

## 部署速查

```bash
# 1. 创建 KV 命名空间，把 id 填入 wrangler.toml
wrangler kv namespace create KV

# 2. 设置密钥
wrangler secret put TURNSTILE_SECRET
wrangler secret put WEBDAV_PASS
wrangler secret put SMTP_PASS
wrangler secret put GITHUB_CLIENT_SECRET

# 3. 本地开发
cp .dev.vars.example .dev.vars   # 填入真实值
wrangler dev

# 4. 部署 + 绑定自定义域 ab-store.lhl.one（Cloudflare Dashboard）
wrangler deploy
```
