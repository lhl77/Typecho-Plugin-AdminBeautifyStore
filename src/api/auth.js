// 账号体系：注册（邮箱验证码）/ 登录 / 忘记密码 / 会话 / GitHub 绑定与快捷登录
import {
  json, getSession, createSession, destroySession, sessionCookie, clearSessionCookie,
  hashPassword, verifyPassword, randomDigits, clientIp, checkRate,
} from '../lib/kv.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { sendMail, mailTemplate } from '../lib/smtp.js';
import { esc, readPluginCache, writePluginCache, cacheMeKey } from '../lib/kv.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_-]{2,32}$/;

async function readJson(req) {
  return req.json().catch(() => null);
}

async function sendCodeMail(env, email, code, purpose) {
  const title = purpose === 'register' ? '注册验证码' : '重置密码验证码';
  await sendMail(env, {
    to: [email],
    subject: `【AB Store】${title}：${code}`,
    text: `您的${title}为：${code}，10 分钟内有效。若非本人操作请忽略本邮件。`,
    html: mailTemplate(title, `<p>您的验证码为：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#4682B4;text-align:center;margin:16px 0">${code}</p><p>验证码 10 分钟内有效，请勿泄露给他人。若非本人操作请忽略本邮件。</p>`),
  });
}

/** POST /api/register/send-code —— 发送注册验证码 */
export async function handleRegisterSendCode(req, env) {
  const body = await readJson(req);
  if (!body) return json({ ok: false, message: '请求格式错误' }, 400);
  if (!(await verifyTurnstile(env, body.turnstile, req, 'register'))) return json({ ok: false, message: '人机验证失败' }, 403);

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: false, message: '邮箱格式不正确' }, 400);
  if (await env.KV.get('user:email:' + email)) return json({ ok: false, message: '该邮箱已注册' }, 400);

  // 同邮箱 1 分钟 1 次
  if (await env.KV.get('vcode:rate:' + email)) return json({ ok: false, message: '发送太频繁，请 1 分钟后再试' }, 429);
  if (!(await checkRate(env, 'sendcode:' + clientIp(req), 20))) return json({ ok: false, message: '操作过于频繁' }, 429);

  const code = randomDigits(6);
  await env.KV.put('verify:' + email, JSON.stringify({ code, purpose: 'register', expiresAt: Date.now() + 600000 }), { expirationTtl: 600 });
  await env.KV.put('vcode:rate:' + email, '1', { expirationTtl: 60 });

  try {
    await sendCodeMail(env, email, code, 'register');
  } catch (e) {
    await env.KV.delete('verify:' + email);
    return json({ ok: false, message: '邮件发送失败：' + e.message }, 502);
  }
  return json({ ok: true });
}

/** POST /api/register —— 邮箱 + 验证码 + 用户名 + 密码注册（验证码已由带 Turnstile 的发送接口发出，此处不再验证人机） */
export async function handleRegister(req, env) {
  const body = await readJson(req);
  if (!body) return json({ ok: false, message: '请求格式错误' }, 400);
  if (!(await checkRate(env, 'register:' + clientIp(req), 20))) return json({ ok: false, message: '操作过于频繁' }, 429);

  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!EMAIL_RE.test(email)) return json({ ok: false, message: '邮箱格式不正确' }, 400);
  if (!USERNAME_RE.test(username)) return json({ ok: false, message: '用户名需为 2-32 位字母/数字/下划线/连字符' }, 400);
  if (password.length < 8) return json({ ok: false, message: '密码至少 8 位' }, 400);

  const v = await env.KV.get('verify:' + email, 'json');
  if (!v || v.purpose !== 'register' || v.code !== code || v.expiresAt < Date.now()) {
    return json({ ok: false, message: '验证码错误或已过期' }, 400);
  }
  if (await env.KV.get('user:email:' + email)) return json({ ok: false, message: '该邮箱已注册' }, 400);
  if (await env.KV.get('user:' + username)) return json({ ok: false, message: '用户名已被占用' }, 400);

  const { hash, salt } = await hashPassword(password);
  const user = { email, passHash: hash, salt, createdAt: Date.now() };
  await env.KV.put('user:' + username, JSON.stringify(user));
  await env.KV.put('user:email:' + email, username);
  await env.KV.delete('verify:' + email);

  // 注册成功自动登录
  const token = await createSession(env, username);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token) });
}

/** POST /api/login —— 邮箱或用户名 + 密码 */
export async function handleLogin(req, env) {
  const body = await readJson(req);
  if (!body) return json({ ok: false, message: '请求格式错误' }, 400);
  if (!(await verifyTurnstile(env, body.turnstile, req, 'login'))) return json({ ok: false, message: '人机验证失败' }, 403);
  if (!(await checkRate(env, 'login:' + clientIp(req), 30))) return json({ ok: false, message: '尝试过于频繁' }, 429);

  const identifier = String(body.identifier || '').trim();
  const password = String(body.password || '');
  if (!identifier || !password) return json({ ok: false, message: '请填写账号和密码' }, 400);

  let username = identifier;
  if (identifier.includes('@')) {
    username = (await env.KV.get('user:email:' + identifier.toLowerCase())) || '';
  }
  const user = username ? await env.KV.get('user:' + username, 'json') : null;
  if (user && user.disabled) return json({ ok: false, message: '账号已被禁用' }, 403);
  if (!(await verifyPassword(password, user))) {
    return json({ ok: false, message: '账号或密码错误' }, 401);
  }

  const token = await createSession(env, username);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token) });
}

/** POST /api/password/send-code —— 发送重置密码验证码 */
export async function handlePasswordSendCode(req, env) {
  const body = await readJson(req);
  if (!body) return json({ ok: false, message: '请求格式错误' }, 400);
  if (!(await verifyTurnstile(env, body.turnstile, req, 'password-reset'))) return json({ ok: false, message: '人机验证失败' }, 403);

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: false, message: '邮箱格式不正确' }, 400);
  if (!(await env.KV.get('user:email:' + email))) return json({ ok: false, message: '该邮箱未注册' }, 400);

  if (await env.KV.get('vcode:rate:' + email)) return json({ ok: false, message: '发送太频繁，请 1 分钟后再试' }, 429);
  if (!(await checkRate(env, 'sendcode:' + clientIp(req), 20))) return json({ ok: false, message: '操作过于频繁' }, 429);

  const code = randomDigits(6);
  await env.KV.put('verify:' + email, JSON.stringify({ code, purpose: 'reset', expiresAt: Date.now() + 600000 }), { expirationTtl: 600 });
  await env.KV.put('vcode:rate:' + email, '1', { expirationTtl: 60 });

  try {
    await sendCodeMail(env, email, code, 'reset');
  } catch (e) {
    await env.KV.delete('verify:' + email);
    return json({ ok: false, message: '邮件发送失败：' + e.message }, 502);
  }
  return json({ ok: true });
}

/** POST /api/password/reset —— 验证码重置密码（验证码已由带 Turnstile 的发送接口发出，此处不再验证人机） */
export async function handlePasswordReset(req, env) {
  const body = await readJson(req);
  if (!body) return json({ ok: false, message: '请求格式错误' }, 400);
  if (!(await checkRate(env, 'reset:' + clientIp(req), 20))) return json({ ok: false, message: '操作过于频繁' }, 429);

  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
  const password = String(body.password || '');
  if (password.length < 8) return json({ ok: false, message: '密码至少 8 位' }, 400);

  const v = await env.KV.get('verify:' + email, 'json');
  if (!v || v.purpose !== 'reset' || v.code !== code || v.expiresAt < Date.now()) {
    return json({ ok: false, message: '验证码错误或已过期' }, 400);
  }
  const username = await env.KV.get('user:email:' + email);
  const user = username ? await env.KV.get('user:' + username, 'json') : null;
  if (!user) return json({ ok: false, message: '该邮箱未注册' }, 400);

  const { hash, salt } = await hashPassword(password);
  user.passHash = hash;
  user.salt = salt;
  await env.KV.put('user:' + username, JSON.stringify(user));
  await env.KV.delete('verify:' + email);
  return json({ ok: true });
}

/** POST /api/logout */
export async function handleLogout(req, env) {
  const sess = await getSession(req, env);
  if (sess) await destroySession(env, sess.token);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}

/** GET /api/me —— 当前用户信息 + 我分享的插件（按用户缓存，插件变更后失效） */
export async function handleMe(req, env, username) {
  const { fresh, stale } = await readPluginCache(env, cacheMeKey(username));
  if (fresh) return json({ ok: true, ...fresh });
  if (stale) return json({ ok: true, ...stale, stale: true });

  const user = await env.KV.get('user:' + username, 'json');
  if (!user) return json({ ok: false, message: '用户不存在' }, 404);

  const ids = (await env.KV.get('uplugins:' + username, 'json')) || [];
  const plugins = [];
  for (const id of ids) {
    const p = await env.KV.get('plugin:' + id, 'json');
    if (p) {
      plugins.push({
        id: p.id, name: p.name, dir: p.dir, author: p.author || '',
        version: p.version || '', github: p.github || '', homepage: p.homepage || '', tags: p.tags || [], desc: p.desc,
        isPrivate: !!p.isPrivate,
        minVer: p.minVer, maxVer: p.maxVer, url: p.url,
        status: p.status, shareToken: p.shareToken,
        downloads: p.downloads || 0, createdAt: p.createdAt,
        reviewNote: p.reviewNote || '', hasPendingEdit: !!p.pendingEdit,
      });
    }
  }
  const data = {
    user: { username, email: user.email, github: user.githubLogin || null },
    plugins,
  };
  await writePluginCache(env, cacheMeKey(username), data);
  return json({ ok: true, ...data });
}

/** POST /api/github/unbind —— 解除 GitHub 绑定 */
export async function handleGithubUnbind(req, env, username) {
  const user = await env.KV.get('user:' + username, 'json');
  if (!user) return json({ ok: false, message: '用户不存在' }, 404);
  if (!user.githubId) return json({ ok: false, message: '当前账号未绑定 GitHub' }, 400);
  await env.KV.delete('user:github:' + user.githubId);
  delete user.githubId;
  delete user.githubLogin;
  await env.KV.put('user:' + username, JSON.stringify(user));
  await env.KV.delete(cacheMeKey(username));
  return json({ ok: true });
}

/** GET /auth/github —— 跳转 GitHub 授权（绑定模式需登录；?mode=login 为快捷登录） */
export async function handleGithubStart(req, env) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') === 'login' ? 'login' : 'bind';

  let username = null;
  if (mode === 'bind') {
    const sess = await getSession(req, env);
    if (!sess) return Response.redirect(url.origin + '/login', 302);
    username = sess.username;
  }

  const state = crypto.randomUUID();
  await env.KV.put('ghstate:' + state, JSON.stringify({ mode, username }), { expirationTtl: 600 });

  const gh =
    'https://github.com/login/oauth/authorize?client_id=' + encodeURIComponent(env.GITHUB_CLIENT_ID || '') +
    '&redirect_uri=' + encodeURIComponent(url.origin + '/auth/github/callback') +
    '&scope=read:user&state=' + encodeURIComponent(state);
  return Response.redirect(gh, 302);
}

/** GET /auth/github/callback */
export async function handleGithubCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const st = state ? await env.KV.get('ghstate:' + state, 'json') : null;
  if (!code || !st) return Response.redirect(url.origin + '/login?gh=fail', 302);
  await env.KV.delete('ghstate:' + state);

  // 换 access_token
  let accessToken = '';
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token || '';
  } catch {}
  if (!accessToken) return Response.redirect(url.origin + '/login?gh=fail', 302);

  // 取用户信息
  let ghUser = null;
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        authorization: 'Bearer ' + accessToken,
        'user-agent': 'ab-store',
        accept: 'application/vnd.github+json',
      },
    });
    ghUser = await userRes.json();
  } catch {}
  if (!ghUser || !ghUser.id) return Response.redirect(url.origin + '/login?gh=fail', 302);

  const ghId = String(ghUser.id);

  if (st.mode === 'bind') {
    const user = await env.KV.get('user:' + st.username, 'json');
    if (!user) return Response.redirect(url.origin + '/login', 302);
    const existing = await env.KV.get('user:github:' + ghId);
    if (existing && existing !== st.username) return Response.redirect(url.origin + '/my?gh=taken', 302);
    user.githubId = ghId;
    user.githubLogin = ghUser.login;
    await env.KV.put('user:' + st.username, JSON.stringify(user));
    await env.KV.put('user:github:' + ghId, st.username);
    return Response.redirect(url.origin + '/my?gh=bound', 302);
  }

  // 快捷登录模式
  const username = await env.KV.get('user:github:' + ghId);
  if (!username) return Response.redirect(url.origin + '/login?gh=unbound', 302);
  const token = await createSession(env, username);
  return new Response(null, {
    status: 302,
    headers: { location: '/', 'set-cookie': sessionCookie(token) },
  });
}
