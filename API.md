# AB Store API 文档

> Base URL：`https://ab-store.lhl.one`
> 所有接口返回 JSON：`{ ok: boolean, ... }`。鉴权方式：HttpOnly Cookie 会话（`abs_session`）或分享口令（`?token=`）。
> 人机验证：部分接口需在请求体携带 `turnstile`（前端 widget token，字段名对应 `cf-turnstile-response`）。

## 状态码约定

| HTTP | 含义 |
|---|---|
| 200 | 成功 |
| 400 | 参数错误 |
| 401 | 未登录 |
| 403 | 无权访问 / 人机验证失败 |
| 404 | 资源不存在 |
| 409 | 冲突（如同目录重复提交） |
| 429 | 频率超限 |

## 插件状态枚举

| status | 含义 |
|---|---|
| `pending` | 审核中（新提交 / 更新审核） |
| `approved` | 已通过（上架） |
| `rejected` | 已拒绝 |
| `archived` | 已下架 |

> 私密插件（`isPrivate: true`）不进入公共列表，详情页仅上传者/管理员/持口令可访问。

---

## 公开接口

### 获取插件列表
```
GET /api/plugins
```
无需鉴权。返回所有**已通过且非私密**的插件。
> 公开插件不返回 `shareToken`；其完整详情链接只带 id：`https://ab-store.lhl.one/plugin/<id>`。

**响应**
```json
{
  "ok": true,
  "plugins": [
    {
      "id": "a1b2c3d4",
      "name": "AdminBeautify",
      "dir": "AdminBeautifyStore",
      "author": "LHL",
      "version": "1.0.21",
      "github": "https://github.com/...",
      "homepage": "https://...",
      "tags": ["editor", "md3"],
      "desc": "简介",
      "minVer": "1.2.0",
      "maxVer": "1.2.1",
      "uploader": "lhl",
      "downloads": 128,
      "createdAt": 1755300000000
    }
  ]
}
```

### 获取单个插件详情
```
GET /api/plugin/<id>
GET /api/plugin/<id>?token=<shareToken>   # 待审核 / 私密插件
```
- `approved` 且非私密：公开访问
- `pending` / 私密 / 其他状态：需正确 `token` 或登录（上传者/管理员）

### 下载插件（计数并跳转）
```
GET /api/download/<id>
GET /api/download/<id>?token=<shareToken>
```
`302` 重定向到最终下载地址，下载计数 +1。鉴权同详情接口。

---

## 账号接口

### 发送注册验证码
```
POST /api/register/send-code
Content-Type: application/json

{ "email": "you@example.com", "turnstile": "<token>" }
```
需 Turnstile（action: `register`）。同邮箱 1 分钟 1 次。

### 注册
```
POST /api/register
{ "email": "...", "code": "123456", "username": "...", "password": "...", "turnstile": "<token>" }
```
注册成功自动登录（Set-Cookie）。密码至少 8 位，用户名 2-32 位字母/数字/`_`/`-`。

### 登录
```
POST /api/login
{ "identifier": "邮箱或用户名", "password": "...", "turnstile": "<token>" }
```
Turnstile action: `login`。成功 Set-Cookie 会话（7 天）。

### 发送重置密码验证码
```
POST /api/password/send-code
{ "email": "...", "turnstile": "<token>" }
```
Turnstile action: `password-reset`。

### 重置密码
```
POST /api/password/reset
{ "email": "...", "code": "123456", "password": "新密码", "turnstile": "<token>" }
```

### 退出登录
```
POST /api/logout
```

### 当前用户信息 + 我的插件
```
GET /api/me
```
需登录。响应：
```json
{
  "ok": true,
  "user": { "username": "lhl", "email": "...", "github": "LHL77" },
  "plugins": [ { "id": "...", "name": "...", "status": "approved", "isPrivate": false, "shareToken": "...", "hasPendingEdit": false, "...": "..." } ]
}
```

---

## GitHub OAuth

### 绑定（已登录）
```
GET /auth/github
```
跳转 GitHub 授权，回调后绑定到当前账号。

### 快捷登录
```
GET /auth/github?mode=login
```
已绑定账号直接登录；未绑定提示先注册绑定。GitHub 不能直接注册。

### 回调（内部）
```
GET /auth/github/callback?code=...&state=...
```

### 解除绑定
```
POST /api/github/unbind
```
需登录。解除当前账号的 GitHub 绑定，解绑后无法使用 GitHub 快捷登录。

---

## 分享与编辑

### 提交分享
```
POST /api/share
Content-Type: application/json  或  multipart/form-data（含文件）
```
需登录 + Turnstile（action: `share`）。

| 字段 | 必填 | 说明 |
|---|---|---|
| name | ✅ | 插件名称（≤60字） |
| dir | ✅ | 插件目录（`^[A-Za-z0-9_-]{1,60}$`） |
| version | ✅ | 插件版本（如 1.0.0） |
| tags | ✅ | 标签，英文逗号分隔，至少 1 个 |
| url / file | ✅ 二选一 | 外链 https 直链，或上传 ZIP（≤10MB，magic `PK\x03\x04`） |
| author | ❌ | 插件作者（独立于上传者） |
| github | ❌ | Github 链接（https） |
| homepage | ❌ | 插件主页 |
| desc | ❌ | 简介（≤200字） |
| minVer / maxVer | ⭕ 至少一个 | 支持 Typecho 版本范围 |
| isPrivate | ❌ | `1` 表示私密插件 |
| turnstile | ✅ | Turnstile token |

**响应**
```json
{
  "ok": true,
  "id": "a1b2c3d4",
  "status": "pending",
  "shareToken": "Ab3xK9",
  "shareUrl": "https://ab-store.lhl.one/plugin/a1b2c3d4?token=Ab3xK9"
}
```
> 管理员提交直接 `status: approved` 免审核。ZIP 上传至 WebDAV → GitHub `share` 分支，路径 `<dir>/<username>/<pluginId>/<file>.zip`。

### 编辑插件
```
PUT /api/plugin/<id>
{ "name": "...", "author": "...", "version": "...", "github": "...", "homepage": "...", "tags": "a,b", "desc": "...", "minVer": "...", "maxVer": "...", "url": "...", "isPrivate": "1" }
```
鉴权与行为：
- **管理员**：任意状态直接生效（`mode: direct`）
- **上传者 · pending**：直接生效
- **上传者 · approved**：写入 `pendingEdit` 进入更新审核（`mode: pending_review`），线上内容不变，审核通过才应用，并邮件通知管理员
- **上传者 · rejected / archived**：直接生效并转入 `pending` 重新审核

---

## 管理接口（仅管理员，`ADMIN_USERS`）

### 待审核列表（含更新审核）
```
GET /api/review/pending
```

### 已上架列表
```
GET /api/review/approved
```

### 全部插件（含所有状态）
```
GET /api/review/all
```

### 审核通过 / 拒绝
```
POST /api/review/<id>
{ "action": "approve", "note": "" }
{ "action": "reject", "note": "拒绝理由" }
```
- approve：应用 `pendingEdit`（若有）并上架，邮件通知用户
- reject：新插件转 `rejected`；更新审核则仅丢弃 `pendingEdit`（线上不变），邮件通知用户（附理由）

### 下架 / 重新启用
```
POST /api/review/<id>/archive    # approved → archived
POST /api/review/<id>/restore    # rejected/archived → approved
```

### 管理员直接添加插件（免审核）
```
POST /api/review/add
{ "name": "...", "dir": "...", "version": "...", "tags": "...", "url": "...", "author": "...", "...": "..." }
```
直接 `approved` 上架。

### 用户列表
```
GET /api/review/users
```

### 用户操作
```
POST /api/review/user/<username>
{ "action": "set-password", "password": "新密码" }
{ "action": "disable" }
{ "action": "enable" }
{ "action": "delete" }
```
- `disable`：禁止登录
- `delete`：删除账号及其映射，其全部插件下架（`archived`）

---

## 前端页面路由

| 路径 | 鉴权 | 说明 |
|---|---|---|
| `/` | 无 | 首页 |
| `/list` | 无 | 插件列表（搜索 + 版本/标签筛选） |
| `/login` `/register` `/forget` | 无 | 登录 / 注册 / 忘记密码 |
| `/share` | 登录 | 分享插件 |
| `/plugin/<id>` | 视状态 | 插件详情 |
| `/my` | 登录 | 我的分享 + 账号设置 |
| `/manage` | 管理员 | 插件管理 + 用户管理 |

---

## 其他

### Google Fonts 代理
```
GET /fonts/css2?family=...     # → fonts.googleapis.com
GET /fonts/<path>              # → fonts.gstatic.com
```
供前端字体加速，CSS 内字体 URL 自动重写为本站代理。

### 限流
- 登录：30 次/IP/小时
- 分享 / 注册 / 重置：20 次/IP/小时
- 验证码：同邮箱 1 分钟 1 次
