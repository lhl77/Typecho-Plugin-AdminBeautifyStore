// Cloudflare Turnstile 服务端校验（canonical siteverify）
import { clientIp } from './kv.js';

/**
 * 校验 Turnstile token
 * @param env Worker env（TURNSTILE_SECRET / TURNSTILE_HOSTNAMES）
 * @param token 前端 cf-turnstile-response
 * @param req 原始请求（取 remoteip）
 * @param expectedAction 该端点期望的 widget action（如 'login'）
 */
export async function verifyTurnstile(env, token, req, expectedAction) {
  // 未配置 secret 时跳过（本地开发）
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;

  // URLSearchParams + 显式 User-Agent，避免被安全检查误判为异常请求
  const body = new URLSearchParams();
  body.append('secret', env.TURNSTILE_SECRET);
  body.append('response', token);
  if (req) body.append('remoteip', clientIp(req));
  body.append('idempotency_key', crypto.randomUUID());

  let result;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'ab-store/1.0',
        accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return false;
    result = await res.json();
  } catch {
    return false;
  }

  if (!result.success) return false;

  // action 一致性校验
  if (expectedAction && result.action && result.action !== expectedAction) return false;

  // hostname 白名单校验（配置后强制；生产环境不得包含 localhost）
  const hostnames = String(env.TURNSTILE_HOSTNAMES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (hostnames.length && result.hostname && !hostnames.includes(result.hostname)) return false;

  return true;
}
