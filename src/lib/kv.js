// KV 读写封装 + 通用工具

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json;charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseCookies(req) {
  const obj = {};
  const raw = req.headers.get('cookie') || '';
  raw.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) obj[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return obj;
}

export async function getSession(req, env) {
  const token = parseCookies(req).abs_session;
  if (!token) return null;
  const sess = await env.KV.get('session:' + token, 'json');
  if (!sess || !sess.username) return null;
  if (sess.expiresAt && sess.expiresAt < Date.now()) return null;
  return { token, username: sess.username };
}

export async function createSession(env, username) {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 7 * 86400 * 1000;
  await env.KV.put('session:' + token, JSON.stringify({ username, expiresAt }), {
    expirationTtl: 7 * 86400,
  });
  return token;
}

export async function destroySession(env, token) {
  if (token) await env.KV.delete('session:' + token);
}

export function sessionCookie(token) {
  return `abs_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 86400}`;
}

/** ===== 插件数据缓存（加速公开列表与“我的插件”读取，变更后异步失效重建） ===== */

export const CACHE_PLUGINS_KEY = 'cache:plugins';
export const cacheMeKey = username => 'cache:me:' + username;
const PLUGIN_CACHE_TTL = 300; // 5 分钟 TTL + 写操作主动失效
const PLUGIN_CACHE_STALE = 86400; // 过期后仍允许回退的旧值窗口（1 天）

/** 读缓存：data 未过期直接用；stale 在窗口内允许回退供后续重建 */
export async function readPluginCache(env, key) {
  const raw = await env.KV.get(key, 'json');
  if (!raw || raw.t === undefined) return { fresh: null, stale: null };
  const age = Date.now() - raw.t;
  if (age < PLUGIN_CACHE_TTL * 1000) return { fresh: raw.d, stale: null };
  if (age < PLUGIN_CACHE_STALE * 1000) return { fresh: null, stale: raw.d };
  return { fresh: null, stale: null };
}

export async function writePluginCache(env, key, data) {
  await env.KV.put(key, JSON.stringify({ t: Date.now(), d: data }), { expirationTtl: PLUGIN_CACHE_STALE });
}

/** 失效相关缓存（异步由调用方 ctx.waitUntil 调度）：公开列表 + 受影响用户的 my 缓存 */
export async function invalidatePluginCaches(env, usernames = []) {
  const jobs = [env.KV.delete(CACHE_PLUGINS_KEY)];
  for (const u of new Set((usernames || []).filter(Boolean))) jobs.push(env.KV.delete(cacheMeKey(u)));
  await Promise.all(jobs);
}

export function clearSessionCookie() {
  return 'abs_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

/** 安全重定向：仅允许站内相对路径，防 open redirect */
export function safeRedirectPath(input) {
  const s = String(input || '');
  if (!s.startsWith('/') || s.startsWith('//')) return '/';
  return s.slice(0, 200);
}

export function isAdmin(env, username) {
  if (!username) return false;
  return String(env.ADMIN_USERS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .includes(username);
}

export function adminEmails(env) {
  return String(env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/** 6 位数字验证码 */
export function randomDigits(n) {
  let s = '';
  const buf = crypto.getRandomValues(new Uint8Array(n));
  for (const b of buf) s += String(b % 10);
  return s;
}

/** 分享口令：排除易混淆字符 0O1Il */
const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function shareToken(n = 6) {
  let s = '';
  const buf = crypto.getRandomValues(new Uint8Array(n));
  for (const b of buf) s += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
  return s;
}

export function newPluginId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export function clientIp(req) {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown';
}

/** 简单限流：key 在 ttl 秒内最多 max 次 */
export async function checkRate(env, key, max, ttl = 3600) {
  const k = 'rate:' + key;
  const cur = Number(await env.KV.get(k)) || 0;
  if (cur >= max) return false;
  await env.KV.put(k, String(cur + 1), { expirationTtl: ttl });
  return true;
}

/** 密码哈希（PBKDF2-SHA256，100k 迭代，Web Crypto） */
export async function hashPassword(password, saltB64) {
  const enc = new TextEncoder();
  const salt = saltB64
    ? Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
    key,
    256
  );
  const toB64 = a => btoa(Array.from(a, c => String.fromCharCode(c)).join(''));
  return { hash: toB64(new Uint8Array(bits)), salt: toB64(salt) };
}

export async function verifyPassword(password, user) {
  if (!user || !user.passHash || !user.salt) return false;
  const { hash } = await hashPassword(password, user.salt);
  return hash === user.passHash;
}

/** 插件索引维护 */
export async function getIndex(env, name) {
  return (await env.KV.get('index:plugins:' + name, 'json')) || [];
}

export async function indexAdd(env, name, id) {
  const list = await getIndex(env, name);
  if (!list.includes(id)) {
    list.push(id);
    await env.KV.put('index:plugins:' + name, JSON.stringify(list));
  }
}

export async function indexRemove(env, name, id) {
  const list = await getIndex(env, name);
  const next = list.filter(x => x !== id);
  if (next.length !== list.length) {
    await env.KV.put('index:plugins:' + name, JSON.stringify(next));
  }
}
