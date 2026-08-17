# AB Store 服务端方案（Cloudflare Worker + KV）

> 暂定域名：`ab-store.lhl.one`
> 目标：提供一个面向公众的「AB Store 插件仓库分享站」，核心功能是**用户分享 Typecho 插件**。
> 前端风格：Material Design 3（响应式，移动端适配）。
>
> **本期范围**：仅 Cloudflare Worker 服务端，Typecho 插件端暂不动工。

---

## 0. 已确认决策（定稿）

| 项 | 决策 |
|---|---|
| 账号体系 | 邮箱 + 密码注册（强制邮箱验证码）；GitHub 仅支持注册后**绑定**，绑定后可快捷登录 |
| 忘记密码 | 本期实现：邮箱验证码重置 |
| SMTP | **465 端口 + SSL 隐式 TLS**（`cloudflare:sockets` `connect({ secureTransport: 'on' })`），非 STARTTLS |
| 审核 | 复用用户登录；`ADMIN_USERS = "lhl"`；管理员登录后导航多出「审核」入口；**管理员还可管理已上架插件（编辑信息 / 下架归档）** |
| 管理员通知邮箱 | `ADMIN_EMAILS = "admin@lhl.one"` |
| 分享口令 | 6 位随机字符串（字母+数字，去掉易混淆字符 `0O1Il`） |
| 待审核详情页 | 持口令访客可见完整信息 + 顶部「待审核」徽章 |
| GitHub 存储仓库 | `lhl77/Typecho-Plugin-AdminBeautifyStore` 的 **`share` 分支** |
| ZIP 存储路径结构 | `<插件dir>/<用户id>/<插件id>/<zip文件名>.zip`（用户id 即用户名，唯一） |
| 下载直链 | `https://gh1.lhl.one/https://raw.githubusercontent.com/lhl77/Typecho-Plugin-AdminBeautifyStore/share/<路径>` |
| 配置存放 | 非敏感项写 `wrangler.toml` `[vars]`；敏感项用 `wrangler secret put` + 本地 `.dev.vars`（gitignore）；另建 `server/CONFIG.md` 逐项说明 |
| Typecho 端 | 本期不做，仅预留 `/api/plugins` 接口 |

---

## 1. 总体架构

```
用户浏览器
    │  HTTPS
    ▼
ab-store.lhl.one  (Cloudflare Worker)
    ├─ 静态页面（首页 / 登录页 / 分享页 / 插件详情 / 我的分享 / 审核管理）
    │     ← Worker 内嵌 HTML（MD3 风格，无框架依赖）
    ├─ REST API（/api/*）
    │     ├─ Cloudflare KV          ← 主数据库（插件元数据、用户、会话、口令映射、邮箱验证码）
    │     ├─ Cloudflare Turnstile   ← 人机验证（登录 + 注册 + 发验证码 + 分享均校验）
    │     ├─ GitHub OAuth           ← 仅用于注册后「绑定 GitHub」+ 快捷登录，不能直接注册
    │     ├─ SMTP（465+SSL）        ← 验证码邮件 + 审核通知（提交时通知管理员、审核后通知用户）
    │     └─ OpenList (WebDAV)      ← 插件 ZIP 上传入口（< 2MB；OpenList 侧挂载 GitHub 由你自行配置）
    ▼
gh1.lhl.one  (已有 GitHub 镜像 Worker，代码见 ../worker.js)
    └─ 提供最终下载直链
```

### 技术选型理由
| 组件 | 选择 | 理由 |
|---|---|---|
| 计算 | Cloudflare Workers | 免费额度足够、全球边缘、天然 HTTPS |
| 数据库 | Workers KV | 读多写少（插件列表读多），免费 100k 读/天；写少符合「分享仓库」场景 |
| 文件存储 | WebDAV → OpenList → GitHub(share 分支) | Worker 仅需一个 WebDAV PUT；OpenList 侧挂载由你自行维护；下载走已有 gh1.lhl.one 镜像 |
| 人机验证 | Cloudflare Turnstile | 免费、无感、与 Worker 同生态，`siteverify` 服务端校验 |
| 邮件通知 | SMTP 465+SSL | Worker 通过 `cloudflare:sockets` 直连；凭证全部走 Secret |
| 前端 | 原生 HTML/CSS/JS + Material Design 3 规范 | Worker 直出，零构建，体积小加载快；MD3 用 CSS 自定义（不引 Material Web Components，避免体积） |

---

## 2. 目录结构（本文件夹 `server/`）

```
server/
├── PLAN.md              ← 本文件
├── CONFIG.md            ← 全部配置项说明（哪个放 vars、哪个放 secret、怎么填）
├── README.md            ← 部署步骤
├── wrangler.toml        ← Worker 配置（路由、KV 绑定、非敏感 vars）
├── .dev.vars.example    ← 本地开发密钥模板（实际 .dev.vars 加入 .gitignore）
├── src/
│   ├── index.js         ← Worker 入口：路由分发
│   ├── pages/
│   │   ├── layout.js    ← MD3 页面骨架（顶部栏/底部导航/主题切换）
│   │   ├── home.js      ← 首页（介绍 + 插件列表）
│   │   ├── login.js     ← 登录/注册/忘记密码页（含 Turnstile）
│   │   ├── share.js     ← 分享插件页（表单）
│   │   ├── plugin.js    ← 插件详情页（公开/口令访问两种模式）
│   │   ├── my.js        ← 我的分享 + 账号设置（绑定 GitHub）
│   │   └── review.js    ← 审核 + 已上架插件管理（仅管理员，复用用户会话）
│   ├── api/
│   │   ├── auth.js      ← 注册 / 登录 / 验证码 / 重置密码 / 会话校验 / GitHub 绑定回调
│   │   ├── plugins.js   ← 插件 CRUD / 列表（未来供 Typecho 端拉取）
│   │   ├── review.js    ← 审核操作 + 已上架插件管理（仅管理员）
│   │   └── upload.js    ← ZIP 上传 → WebDAV(OpenList) → GitHub(share 分支)
│   └── lib/
│       ├── kv.js        ← KV 读写封装
│       ├── turnstile.js ← siteverify 校验
│       ├── webdav.js    ← WebDAV PUT（指向 OpenList WebDAV 入口）
│       ├── smtp.js      ← SMTP 465+SSL 发信（验证码 + 审核通知）
│       └── md3.css.js   ← Material Design 3 样式（模板字符串导出）
└── ...
```

---

## 3. 页面设计（Material Design 3，响应式）

### 3.1 首页 `GET /`
- **Hero 区**：站点名称「AB Store」+ 一句话介绍（「Typecho 插件的分享仓库，人人皆可分享」）+ CTA 按钮（「分享我的插件」→ 未登录跳登录页）。
- **介绍区**：三张 MD3 Card（Material Symbols 图标）——什么是 AB Store / 如何分享 / 如何在 Typecho 后台安装。
- **插件列表区**：已通过审核插件的 Card 网格（名称、简介、支持版本、下载量），搜索框（前端过滤）。数据来自 `/api/plugins`。
- **移动端**：单列布局、底部 Navigation Bar（首页 / 分享 / 我的），桌面端为顶部 App Bar。
- **配色**：MD3 动态色系（主色 #6750A4），亮/暗主题跟随系统 + 手动切换。

### 3.2 登录页 `GET /login`
- **注册**：邮箱 + 用户名 + 密码 + 邮箱验证码 + Turnstile。验证码验证通过才创建账号——确保邮箱真实可用（后续审核通知依赖它）。
- **登录**：邮箱（或用户名）+ 密码 + Turnstile。
- **忘记密码**：输入邮箱 → 发重置验证码 → 验证后设置新密码。
- **GitHub 不能直接注册**。登录后在「我的 → 账号设置」里可**绑定 GitHub**（OAuth 回调绑定到当前账号），绑定后登录页可用 GitHub 快捷登录。
- 登录成功签发会话 Token（KV 存 `session:<token>`，HttpOnly Cookie，7 天有效）。

### 3.3 分享页 `GET /share`（需登录）
表单字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| 插件名称 | ✅ | 显示名，如 `AdminBeautify` |
| 插件目录（dir） | ✅ | 插件文件夹名，如 `AdminBeautifyStore`；需符合 `^[A-Za-z0-9_-]+$`；同一用户下同 dir 不可重复提交 |
| 下载方式 | ✅ 二选一 | ① 填写**插件下载地址**（外链 URL，如 GitHub Release 或直链）；② **上传 ZIP**（≤ 2MB，Worker → WebDAV(OpenList) → GitHub `share` 分支，生成 `gh1.lhl.one` 下载直链） |
| 支持 Typecho 最低版本 | ⭕ 二者至少填一个 | 如 `1.2.0` |
| 支持 Typecho 最高版本 | ⭕ 二者至少填一个 | 如 `1.2.1` |
| 插件简介 | ❌ | 多行文本，≤ 200 字 |

- 提交前客户端 + 服务端双重校验（字段、ZIP 大小、URL 格式、版本号格式）。
- 分享页提交也带 Turnstile（防止滥用上传）。
- **提交成功响应**：返回 `{ id, shareToken, shareUrl }`，其中 `shareToken` 为 **6 位**随机字符串，`shareUrl` 为 `https://ab-store.lhl.one/plugin/<id>?token=<shareToken>`。审核通过前，可通过该 URL 分享预览。
- 提交成功后触发 SMTP 邮件：通知**管理员**（`admin@lhl.one`）「有新插件待审核」。

### 3.4 插件详情页 `GET /plugin/<id>`
- **已审核（approved）**：完全公开，无需口令，直接展示全部信息 + 下载按钮。
- **待审核（pending）**：必须带正确 `?token=` 参数才能查看；无 token 或 token 错误则返回 MD3 风格 404/无权限页面。持口令访客看到**完整信息 + 顶部「待审核」徽章**（方便分享预览，下载按钮保留）。
- 页面展示：插件名、简介、支持版本、上传者、下载量、下载按钮。
- 移动端与桌面端均为单卡片居中布局，适配窄屏。

### 3.5 我的分享页 `GET /my`（需登录）
- 列出当前用户提交的所有插件（含待审核 / 已通过 / 已拒绝）。
- 每项显示：状态徽章、6 位分享口令、公开链接、编辑按钮（仅限待审核状态可修改）。
- 支持复制分享口令 / 公开链接到剪贴板。
- **账号设置子页**：显示绑定邮箱；提供「绑定 GitHub」按钮（跳转 OAuth，回调后写入 `githubId` 到当前用户），绑定后可改用 GitHub 快捷登录。

### 3.6 审核管理页 `GET /review`（复用用户登录，仅管理员可见）
- **不单独设管理后台路径/密码**：管理员就是普通用户，其用户名列入 wrangler 变量 `ADMIN_USERS`（默认 `lhl`）。
- 管理员登录后，导航栏自动多出「审核」入口；普通用户访问 `/review` 返回 403。
- **待审核 Tab**：列出所有 `pending` 插件（插件信息、上传者、下载链接/口令预览），操作「通过」/「拒绝」（拒绝时可填写理由，随邮件发给用户）。
- **已上架 Tab**：列出所有 `approved` 插件，管理员可**编辑元数据**（名称/简介/版本范围/下载地址）或**下架归档**（`archived`，从公开列表移除）。
- 审核完成后触发 SMTP 邮件：通知**上传者**审核结果（通过则附公开链接）。

---

## 4. KV 数据模型

| Key | Value | 说明 |
|---|---|---|
| `user:<username>` | `{ email, passHash, salt, githubId?, githubLogin?, createdAt }` | 用户（密码 PBKDF2/SHA-256 加盐哈希，Web Crypto；GitHub 绑定后补 `githubId`） |
| `user:email:<email>` | `username` | 邮箱 → 用户名映射（登录/找回用） |
| `user:github:<githubId>` | `username` | GitHub ID → 用户名映射（绑定后快捷登录用） |
| `verify:<email>` | `{ code, purpose, expiresAt }` | 验证码（purpose: `register` / `reset`；TTL 10 分钟） |
| `session:<token>` | `{ username, expiresAt }` | 会话，TTL 7 天 |
| `plugin:<id>` | `{ name, dir, desc, minVer, maxVer, url, webdavPath, uploader, downloads, shareToken, createdAt, status, reviewNote? }` | 插件元数据（id 为 `crypto.randomUUID()` 前 8 位） |
| `index:plugins:approved` | `[id, ...]` | 已通过插件 ID 列表（首页/接口用） |
| `index:plugins:pending` | `[id, ...]` | 待审核插件 ID 列表（审核页用） |
| `token:<shareToken>` | `pluginId` | 分享口令 → 插件 ID 映射，用于详情页鉴权 |
| `rate:<ip>` | `count` | 简单限流（TTL 1h），防分享/登录爆破 |

> `status` 枚举：`pending` / `approved` / `rejected` / `archived`。
> 审核通过后将 `id` 从 `index:plugins:pending` 移除并加入 `index:plugins:approved`；下架则反向移除。

---

## 5. API 设计（均返回 JSON，统一 CORS 白名单）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| `GET` | `/api/plugins` | 无 | 已通过插件列表（供首页 + 未来 Typecho 插件端拉取） |
| `GET` | `/api/plugin/<id>` | 可选 token | 单个插件详情；待审核状态需 `?token=` 或管理员会话 |
| `POST` | `/api/register/send-code` | Turnstile | 发送注册邮箱验证码（SMTP） |
| `POST` | `/api/register` | Turnstile + 验证码 | 邮箱 + 用户名 + 密码注册 |
| `POST` | `/api/login` | Turnstile | 登录（邮箱或用户名 + 密码），Set-Cookie 会话 |
| `POST` | `/api/password/send-code` | Turnstile | 发送重置密码验证码 |
| `POST` | `/api/password/reset` | Turnstile + 验证码 | 重置密码 |
| `GET` | `/auth/github` | 视模式 | `?mode=login` 免会话（快捷登录）；无参数为绑定模式，需会话，state 绑定当前会话 |
| `GET` | `/auth/github/callback` | 无 | GitHub 回调：绑定模式写入 `githubId`；登录模式查到已绑定账号直接建立会话 |
| `POST` | `/api/logout` | 会话 | 退出 |
| `GET` | `/api/me` | 会话 | 当前用户信息 + 我分享的插件 |
| `POST` | `/api/share` | 会话 + Turnstile | 提交分享（JSON 或 multipart 含 ZIP） |
| `PUT` | `/api/plugin/<id>` | 会话 + 本人（pending）或管理员（任意状态） | 编辑插件 |
| `GET` | `/api/download/<id>` | 无 | 下载计数 +1，302 到最终下载地址 |
| `GET` | `/api/review/pending` | 管理员会话 | 待审核列表 |
| `GET` | `/api/review/approved` | 管理员会话 | 已上架列表（管理用） |
| `POST` | `/api/review/<id>` | 管理员会话 | 审核通过/拒绝（可附理由），触发 SMTP 通知用户 |
| `POST` | `/api/review/<id>/archive` | 管理员会话 | 下架归档已上架插件 |

### 上传流程（≤ 2MB）
1. 前端 multipart 提交 ZIP。
2. Worker 校验 `content-length` / 实际字节 ≤ 2MB、后缀 `.zip`、Magic bytes `PK\x03\x04`。
3. 生成插件 id，构造存储路径：`<dir>/<username>/<pluginId>/<原始文件名净化后>.zip`。
4. `webdav.js`：`PUT {WEBDAV_BASE}/<上述路径>`（OpenList 的 WebDAV 入口，Basic Auth 存 Secret；OpenList 侧将该目录挂载到 GitHub 仓库 `share` 分支，由你自行配置；上级目录不存在时先递归 `MKCOL`）。
5. 上传成功后拼接下载直链：
   `https://gh1.lhl.one/https://raw.githubusercontent.com/lhl77/Typecho-Plugin-AdminBeautifyStore/share/<上述路径>`
   （注意：需在 gh1.lhl.one 的白名单中包含 `lhl77/Typecho-Plugin-AdminBeautifyStore`，或走其 `/d/` 免白名单路径，届时二选一调整拼接格式）。
6. 保存下载地址到插件元数据；失败则回滚并报错。

### GitHub 绑定/登录流程
1. **绑定**（已登录状态）：「我的 → 账号设置 → 绑定 GitHub」→ `/auth/github`（state 中携带绑定会话标记）→ 授权回调 → 写入 `user:github:<githubId>` 映射 + 用户记录。
2. **快捷登录**：登录页「使用 GitHub 登录」→ `/auth/github?mode=login` → 回调查到已绑定账号 → 直接建立会话；未绑定则提示「请先用邮箱注册并绑定」。
3. GitHub **不作为注册入口**；所有账号必须先邮箱注册。

### SMTP 邮件（465 + SSL）
- **实现**：`smtp.js` 使用 `cloudflare:sockets` 的 `connect(host, { secureTransport: 'on' })` 建立 **465 端口隐式 TLS** 连接（不是 STARTTLS）。流程：`EHLO` → `AUTH LOGIN`（base64 用户名/密码）→ `MAIL FROM` / `RCPT TO` / `DATA`。多个收件人时逐个 `RCPT TO`。
- **触发点**：① 注册验证码；② 重置密码验证码；③ 用户提交分享 → 通知 `ADMIN_EMAILS`；④ 审核通过/拒绝 → 通知上传者（含结果、理由、链接）。
- 邮件模板：简洁 HTML（MD3 配色）+ 纯文本兜底；所有用户输入内容转义。
- SMTP_HOST / SMTP_PORT(465) / SMTP_USER / SMTP_PASS / MAIL_FROM 全部走配置（见第 7 节）。

---

## 6. 安全要点

- **Turnstile**：登录、注册、发验证码、分享四处服务端 `siteverify` 校验，密钥存 Secret。
- **密码**：PBKDF2（100k 迭代）+ 随机盐，绝不明文。
- **邮箱验证码**：6 位数字，10 分钟有效，一次性使用；发送频率限流（同邮箱 1 分钟 1 次）。
- **GitHub OAuth**：仅用于绑定/快捷登录；`client_secret` 存 Secret；state 参数防 CSRF 并区分绑定/登录模式；只请求 `read:user` 最小权限。
- **会话**：`crypto.randomUUID()` Token，HttpOnly + Secure + SameSite=Lax Cookie。
- **管理员**：`ADMIN_USERS` 变量指定用户名列表（默认 `lhl`），审核/管理接口服务端逐个校验 `isAdmin(session)`。
- **限流**：按 IP 对登录/分享/审核/发验证码接口限流（KV 计数 + TTL）。
- **输入**：所有字段服务端校验 + 输出转义（防 XSS，插件简介纯文本展示）。
- **上传**：仅 ZIP、≤ 2MB、文件名净化重命名（杜绝路径穿越：剔除 `..`、斜杠、非安全字符），WebDAV 凭证只在服务端。
- **SMTP**：凭证存 Secret；邮件内容中的用户输入（插件名、理由）全部转义。
- **分享口令**：6 位随机字符串（字母+数字，去掉易混淆字符 `0O1Il`），每个插件提交后自动分配，审核前可通过 `?token=` 访问详情页。

---

## 7. 配置方案（抉择说明）

**抉择结论**：
- **非敏感配置** → 直接写 `wrangler.toml` 的 `[vars]`（可入库、方便审查）。
- **敏感密钥** → 生产环境用 `wrangler secret put <NAME>`；本地开发用 `server/.dev.vars`（已加入 `.gitignore`）。
- **`server/CONFIG.md`** → 单独的配置说明文件，逐项列出名称、用途、示例值、存放位置（vars / secret），部署时照着填即可。
- **`server/.dev.vars.example`** → 密钥模板文件（可入库），复制为 `.dev.vars` 后填真实值。

### wrangler.toml

```toml
name = "ab-store"
main = "src/index.js"
compatibility_date = "2025-01-01"

[[kv_namespaces]]
binding = "KV"
id = "<kv-namespace-id>"

# ===== 非敏感 vars（可入库） =====
[vars]
TURNSTILE_SITEKEY = "<site-key>"
GH1_BASE = "https://gh1.lhl.one"
GITHUB_REPO = "lhl77/Typecho-Plugin-AdminBeautifyStore"
GITHUB_BRANCH = "share"
ADMIN_USERS = "lhl"
ADMIN_EMAILS = "admin@lhl.one"
MAIL_FROM = "AB Store <noreply@lhl.one>"
SMTP_HOST = "smtp.qq.com"        # 示例，实际按服务商改
SMTP_PORT = "465"
SMTP_USER = ""                   # 邮箱账号（半敏感，也可挪到 secret）
WEBDAV_BASE = ""                 # OpenList WebDAV 入口，如 https://openlist.lhl.one/dav/github
WEBDAV_USER = ""                 # 半敏感，也可挪到 secret
GITHUB_CLIENT_ID = ""            # GitHub OAuth App Client ID（本身公开）

# ===== 敏感 secrets（wrangler secret put / .dev.vars，不入库） =====
# TURNSTILE_SECRET
# WEBDAV_PASS
# SMTP_PASS
# GITHUB_CLIENT_SECRET

# 路由：ab-store.lhl.one/*（自定义域，Cloudflare Dashboard 绑定）
```

---

## 8. 实施步骤（迭代顺序）

1. **M1 骨架**：wrangler 项目初始化、KV 绑定、路由分发、MD3 样式基座 + 首页静态版 + CONFIG.md / .dev.vars.example。
2. **M2 账号体系**：SMTP(465+SSL) 发信打通 → 邮箱验证码注册 → 登录/会话 + Turnstile → 忘记密码重置 → GitHub 绑定与快捷登录。
3. **M3 分享闭环（外链）**：分享表单（外链方式）→ 写入 KV → 分配 6 位 shareToken → 详情页（含口令访问）→ 我的分享列表 → 提交时邮件通知管理员。
4. **M4 上传**：WebDAV(OpenList) 上传（≤ 2MB，路径 `<dir>/<username>/<pluginId>/<file>.zip`）+ 下载计数 + gh1.lhl.one 直链拼接。
5. **M5 审核管理**：`/review` 审核页（待审核 Tab：通过/拒绝 + 邮件通知用户；已上架 Tab：编辑/下架）、公开列表自动更新。
6. **M6 打磨**：移动端适配细节、暗色主题、限流、错误页、部署到 `ab-store.lhl.one`。

---

## 9. 实施 Prompt（可直接粘贴给其他模型）

> 以下内容已包含全部已定稿决策，可直接交给任意编码模型按 M1→M6 顺序实施。

````text
请在 Cloudflare Workers 上实现一个名为 "AB Store" 的 Typecho 插件分享站（域名 ab-store.lhl.one），技术栈：原生 JavaScript（无框架、无构建步骤），Workers KV 作为唯一数据库，所有页面由 Worker 直接返回 HTML 字符串。

# 总体要求
- 前端为 Material Design 3 风格（手写 CSS，不引入 Material Web Components 等重型依赖），主色 #6750A4，支持亮/暗主题（跟随系统 + 手动切换），完整移动端响应式（移动端底部导航栏：首页/分享/我的；桌面端顶部 App Bar）。
- 所有页面共享 layout.js 骨架；图标使用 Material Symbols（CDN 引入）。
- 所有用户输入服务端校验 + 输出 HTML 转义，防 XSS。

# 页面（Worker 路由直出 HTML）
1. GET /            首页：Hero（介绍 AB Store 是 Typecho 插件分享仓库，重点强调"分享"）+ CTA「分享我的插件」+ 三张介绍卡片 + 已通过审核插件卡片网格（数据来自 GET /api/plugins）+ 前端搜索过滤。
2. GET /login       登录/注册/忘记密码 三 Tab：
   - 注册：邮箱 + 用户名 + 密码 + 邮箱验证码 + Turnstile（先 POST /api/register/send-code 发验证码，再 POST /api/register）。
   - 登录：邮箱或用户名 + 密码 + Turnstile（POST /api/login），另提供「使用 GitHub 登录」按钮（/auth/github?mode=login）。
   - 忘记密码：邮箱 + 验证码 + 新密码（/api/password/send-code + /api/password/reset）。
3. GET /share       分享插件表单（需登录，未登录 302 到 /login），字段：
   - 必填：插件名称；插件目录 dir（^[A-Za-z0-9_-]+$）；下载方式二选一（外链 URL 或上传 ZIP≤2MB）；Typecho 最低/最高版本至少填一个。
   - 选填：插件简介（≤200字）。
   - 表单带 Turnstile，POST /api/share（有文件时 multipart，否则 JSON）。
   - 成功后展示返回的 { id, shareToken, shareUrl }，提供复制按钮。
4. GET /plugin/<id> 插件详情页：approved 状态完全公开；pending 状态必须带正确 ?token=（6 位分享口令）才能看，否则返回 MD3 风格 404 页；pending 可见时顶部显示「待审核」徽章。展示名称/简介/版本范围/上传者/下载量/下载按钮（下载走 /api/download/<id>）。
5. GET /my          我的分享（需登录）：我提交的全部插件（pending/approved/rejected 状态徽章、分享口令、链接、复制按钮、pending 可编辑）；子页「账号设置」：显示邮箱、「绑定 GitHub」按钮（跳转 /auth/github）。
6. GET /review      审核管理页（需登录且用户名在 ADMIN_USERS 列表中，否则 403）：
   - 待审核 Tab：pending 列表，可「通过」/「拒绝」（拒绝可填理由）。
   - 已上架 Tab：approved 列表，可编辑元数据 / 下架归档。
   - 管理员登录后全站导航多出「审核」入口。

# API（全部返回 JSON）
- GET  /api/plugins                 公开：approved 插件列表
- GET  /api/plugin/<id>             详情；pending 需 ?token= 或管理员会话
- POST /api/register/send-code      Turnstile；发 6 位数字注册验证码（SMTP）
- POST /api/register                Turnstile+验证码；邮箱+用户名+密码注册（密码 PBKDF2 100k 迭代+随机盐，Web Crypto）
- POST /api/login                   Turnstile；邮箱或用户名+密码；Set-Cookie 会话（HttpOnly+Secure+SameSite=Lax，7 天）
- POST /api/password/send-code      Turnstile；发重置验证码
- POST /api/password/reset          Turnstile+验证码；重置密码
- GET  /auth/github                 无参数=绑定模式（需登录，state 绑定会话）；?mode=login=快捷登录
- GET  /auth/github/callback        OAuth 回调：换 token（client_id+secret，scope=read:user）→ api.github.com/user；绑定模式写 user:github:<id> 映射；登录模式查到已绑定账号直接建会话，未绑定提示先注册绑定
- POST /api/logout                  退出
- GET  /api/me                      当前用户 + 我的插件
- POST /api/share                   会话+Turnstile；校验字段；ZIP 校验（≤2MB、.zip、PK\x03\x04 magic）；上传走 WebDAV；生成 8 位插件 id + 6 位分享口令（字母数字，排除 0O1Il）；写 KV；SMTP 通知管理员
- PUT  /api/plugin/<id>             本人 pending 可编辑；管理员任意状态可编辑
- GET  /api/download/<id>           downloads+1，302 到下载地址
- GET  /api/review/pending          管理员：待审核列表
- GET  /api/review/approved         管理员：已上架列表
- POST /api/review/<id>             管理员：{action:'approve'|'reject', note?}；SMTP 通知上传者（通过附公开链接，拒绝附理由）
- POST /api/review/<id>/archive     管理员：下架归档

# KV 结构
- user:<username>        { email, passHash, salt, githubId?, githubLogin?, createdAt }
- user:email:<email>     username
- user:github:<githubId> username
- verify:<email>         { code, purpose('register'|'reset'), expiresAt }（KV TTL 600 秒）
- session:<token>        { username, expiresAt }（KV TTL 7 天）
- plugin:<id>            { name, dir, desc, minVer, maxVer, url, webdavPath, uploader, downloads, shareToken, createdAt, status, reviewNote? }（status: pending/approved/rejected/archived）
- index:plugins:approved [id,...]
- index:plugins:pending  [id,...]
- token:<shareToken>     pluginId
- rate:<ip>              计数（TTL 1h，登录/分享/发验证码限流；验证码同邮箱 1 分钟 1 次）

# 上传（WebDAV → OpenList → GitHub）
- 存储路径：<dir>/<username>/<pluginId>/<净化后的文件名>.zip（文件名剔除 ..、斜杠、非 [A-Za-z0-9._-] 字符）。
- lib/webdav.js：PUT 到 {WEBDAV_BASE}/<路径>，Basic Auth（WEBDAV_USER/WEBDAV_PASS）；上级目录不存在时先逐级 MKCOL。
- 成功后下载直链拼接为：{GH1_BASE}/https://raw.githubusercontent.com/{GITHUB_REPO}/{GITHUB_BRANCH}/<路径>

# SMTP（465 端口 + SSL 隐式 TLS，非 STARTTLS）
- lib/smtp.js：import { connect } from 'cloudflare:sockets'，connect(host, { secureTransport: 'on' }) 连 SMTP_HOST:SMTP_PORT(465)。
- 流程：读 220 → EHLO → AUTH LOGIN（base64 user/pass 两步）→ MAIL FROM → RCPT TO（支持多收件人）→ DATA → QUIT；每步校验响应码（235/250/354）。
- 触发点：注册验证码、重置验证码、新插件提交通知 ADMIN_EMAILS、审核结果通知上传者。
- 邮件为 HTML（MD3 配色）+ 纯文本兜底，用户输入内容全部转义。

# Turnstile
- lib/turnstile.js：POST https://challenges.cloudflare.com/turnstile/v0/siteverify，校验 secret + response + 客户端 IP。

# 配置（wrangler.toml [vars] 非敏感；敏感项 wrangler secret / .dev.vars）
- vars: TURNSTILE_SITEKEY, GH1_BASE=https://gh1.lhl.one, GITHUB_REPO=lhl77/Typecho-Plugin-AdminBeautifyStore, GITHUB_BRANCH=share, ADMIN_USERS=lhl, ADMIN_EMAILS=admin@lhl.one, MAIL_FROM, SMTP_HOST, SMTP_PORT=465, SMTP_USER, WEBDAV_BASE, WEBDAV_USER, GITHUB_CLIENT_ID
- secrets: TURNSTILE_SECRET, WEBDAV_PASS, SMTP_PASS, GITHUB_CLIENT_SECRET

# 工程
- wrangler.toml：name=ab-store, main=src/index.js, compatibility_date=2025-01-01, [[kv_namespaces]] binding=KV
- 目录：src/index.js（路由）、src/pages/*、src/api/*、src/lib/{kv,turnstile,webdav,smtp,md3.css}.js、CONFIG.md（配置逐项说明）、.dev.vars.example、README.md（部署步骤）
- 按 M1 骨架 → M2 账号 → M3 分享闭环 → M4 上传 → M5 审核管理 → M6 打磨 的顺序实现，每个里程碑保证可部署运行。
````
