// AB Store Worker 入口：路由分发
import { getSession, isAdmin, json, esc, safeRedirectPath } from './lib/kv.js';
import { renderPage } from './pages/layout.js';
import { homePage } from './pages/home.js';
import { listPage } from './pages/list.js';
import { loginPage } from './pages/login.js';
import { registerPage } from './pages/register.js';
import { forgetPage } from './pages/forget.js';
import { sharePage } from './pages/share.js';
import { pluginPage, notFoundPage } from './pages/plugin.js';
import { myPage } from './pages/my.js';
import { managePage } from './pages/manage.js';
import {
  handleRegisterSendCode, handleRegister, handleLogin,
  handlePasswordSendCode, handlePasswordReset,
  handleLogout, handleMe, handleGithubStart, handleGithubCallback, handleGithubUnbind,
} from './api/auth.js';
import {
  handleListPlugins, handleGetPlugin, handleUpdatePlugin, handleDownload, loadPluginForView,
} from './api/plugins.js';
import {
  handlePendingList, handleApprovedList, handleAllList, handleUserList, handleUserAction, handleReview, handleArchive, handleRestore, handleAdminAdd,
} from './api/review.js';
import { handleShare } from './api/upload.js';

export default {
  async fetch(req, env, ctx) {
    try {
      return await route(req, env, ctx);
    } catch (err) {
      return errorPage(err);
    }
  },
};

function html(pageObj, env, sess, status = 200) {
  const body = renderPage(env, {
    ...pageObj,
    user: sess ? sess.username : null,
    admin: !!(sess && isAdmin(env, sess.username)),
  });
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html;charset=utf-8' },
  });
}

function errorPage(err) {
  const body = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>服务异常 - AB Store</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FEF7FF;color:#1D1B20">
<div style="max-width:480px;padding:32px;background:#fff;border-radius:16px;border:1px solid #E7E0EC;text-align:center">
<h1 style="font-size:20px;margin-bottom:12px">服务暂时异常</h1>
<p style="color:#49454F;font-size:14px;word-break:break-all">${esc(err && err.message ? err.message : String(err))}</p>
<p style="margin-top:16px"><a href="/" style="color:#6750A4">返回首页</a></p>
</div></body></html>`;
  return new Response(body, { status: 500, headers: { 'content-type': 'text/html;charset=utf-8' } });
}

async function route(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const sess = await getSession(req, env);
  const admin = !!(sess && isAdmin(env, sess.username));

  /* ================= API ================= */

  // 公开
  if (path === '/api/plugins' && method === 'GET') return handleListPlugins(req, env);
  if (path === '/api/plugins' && method === 'OPTIONS') return json({ ok: true }, 200, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET' });

  // 账号
  if (path === '/api/register/send-code' && method === 'POST') return handleRegisterSendCode(req, env);
  if (path === '/api/register' && method === 'POST') return handleRegister(req, env);
  if (path === '/api/login' && method === 'POST') return handleLogin(req, env);
  if (path === '/api/password/send-code' && method === 'POST') return handlePasswordSendCode(req, env);
  if (path === '/api/password/reset' && method === 'POST') return handlePasswordReset(req, env);
  if (path === '/api/logout' && method === 'POST') return handleLogout(req, env);

  // GitHub OAuth（绑定 / 快捷登录）
  if (path === '/auth/github' && method === 'GET') return handleGithubStart(req, env);
  if (path === '/auth/github/callback' && method === 'GET') return handleGithubCallback(req, env);

  // 需登录
  if (path === '/api/me' && method === 'GET') {
    if (!sess) return json({ ok: false, message: '未登录' }, 401);
    return handleMe(req, env, sess.username);
  }
  if (path === '/api/share' && method === 'POST') {
    if (!sess) return json({ ok: false, message: '请先登录' }, 401);
    return handleShare(req, env, sess.username, ctx);
  }

  // GitHub 解除绑定
  if (path === '/api/github/unbind' && method === 'POST') {
    if (!sess) return json({ ok: false, message: '请先登录' }, 401);
    return handleGithubUnbind(req, env, sess.username);
  }

  // 插件动态路由
  let m = path.match(/^\/api\/plugin\/([A-Za-z0-9]+)$/);
  if (m) {
    if (method === 'GET') return handleGetPlugin(req, env, m[1], sess);
    if (method === 'PUT') {
      if (!sess) return json({ ok: false, message: '请先登录' }, 401);
      return handleUpdatePlugin(req, env, m[1], sess, ctx);
    }
  }

  m = path.match(/^\/api\/download\/([A-Za-z0-9]+)$/);
  if (m && method === 'GET') return handleDownload(req, env, m[1], sess);

  // 审核管理（仅管理员）
  if (path === '/api/review/pending' && method === 'GET') {
    if (!admin) return json({ ok: false, message: '无权访问' }, 403);
    return handlePendingList(req, env);
  }
  if (path === '/api/review/approved' && method === 'GET') {
    if (!admin) return json({ ok: false, message: '无权访问' }, 403);
    return handleApprovedList(req, env);
  }
  if (path === '/api/review/all' && method === 'GET') {
    if (!admin) return json({ ok: false, message: '无权访问' }, 403);
    return handleAllList(req, env);
  }
  if (path === '/api/review/users' && method === 'GET') {
    if (!admin) return json({ ok: false, message: '无权访问' }, 403);
    return handleUserList(req, env);
  }
  m = path.match(/^\/api\/review\/user\/([A-Za-z0-9_-]+)$/);
  if (m && method === 'POST') {
    if (!admin) return json({ ok: false, message: '无权访问' }, 403);
    return handleUserAction(req, env, m[1], ctx);
  }
  m = path.match(/^\/api\/review\/([A-Za-z0-9]+)\/archive$/);
  if (m && method === 'POST') {
    if (!admin) return json({ ok: false, message: '无权访问' }, 403);
    return handleArchive(req, env, m[1], ctx);
  }
  m = path.match(/^\/api\/review\/([A-Za-z0-9]+)\/restore$/);
  if (m && method === 'POST') {
    if (!admin) return json({ ok: false, message: '无权访问' }, 403);
    return handleRestore(req, env, m[1], ctx);
  }
  if (path === '/api/review/add' && method === 'POST') {
    if (!admin) return json({ ok: false, message: '无权访问' }, 403);
    return handleAdminAdd(req, env, sess, ctx);
  }
  m = path.match(/^\/api\/review\/([A-Za-z0-9]+)$/);
  if (m && method === 'POST') {
    if (!admin) return json({ ok: false, message: '无权访问' }, 403);
    return handleReview(req, env, m[1], ctx);
  }

  /* ================= 页面 ================= */

  if (path === '/' && method === 'GET') {
    return html(homePage(env, {}), env, sess);
  }

  if (path === '/list' && method === 'GET') {
    return html(listPage(env, {}), env, sess);
  }

  if (path === '/login' && method === 'GET') {
    if (sess) return Response.redirect(url.origin + '/', 302);
    return html(loginPage(env, { query: Object.fromEntries(url.searchParams) }), env, sess);
  }

  if (path === '/register' && method === 'GET') {
    if (sess) return Response.redirect(url.origin + '/', 302);
    return html(registerPage(env, {}), env, sess);
  }

  if (path === '/forget' && method === 'GET') {
    if (sess) return Response.redirect(url.origin + '/', 302);
    return html(forgetPage(env, {}), env, sess);
  }

  if (path === '/share' && method === 'GET') {
    if (!sess) return Response.redirect(url.origin + '/login?r=' + encodeURIComponent('/share'), 302);
    return html(sharePage(env, {}), env, sess);
  }

  if (path === '/my' && method === 'GET') {
    if (!sess) return Response.redirect(url.origin + '/login?r=' + encodeURIComponent('/my'), 302);
    return html(myPage(env, { query: Object.fromEntries(url.searchParams) }), env, sess);
  }

  if (path === '/manage' && method === 'GET') {
    if (!sess) return Response.redirect(url.origin + '/login?r=' + encodeURIComponent('/manage'), 302);
    if (!admin) {
      return html(notFoundPage(env, { title: '无权访问', message: '该页面仅管理员可见。' }), env, sess, 403);
    }
    return html(managePage(env, {}), env, sess);
  }

  m = path.match(/^\/plugin\/([A-Za-z0-9]+)$/);
  if (m && method === 'GET') {
    const { plugin: p, canView, pending } = await loadPluginForView(req, env, m[1], sess);
    if (!p || !canView) {
      return html(notFoundPage(env, {}), env, sess, 404);
    }
    const token = url.searchParams.get('token') || '';
    return html(pluginPage(env, { plugin: p, pending, token }), env, sess);
  }

  // Google Fonts 代理（防国内访问慢）：/fonts/* → fonts.googleapis.com / fonts.gstatic.com
  if (path.startsWith('/fonts/')) {
    const sub = path.slice('/fonts/'.length);
    const isCss = sub.startsWith('css');
    const upstream = (isCss
      ? 'https://fonts.googleapis.com/' + sub
      : 'https://fonts.gstatic.com/' + sub) + (url.search || '');
    const res = await fetch(upstream, {
      headers: { 'user-agent': req.headers.get('user-agent') || 'Mozilla/5.0' },
    });
    const headers = new Headers(res.headers);
    headers.set('access-control-allow-origin', '*');
    headers.set('cache-control', 'public,max-age=86400');
    // CSS 里的字体文件 URL 重写为本站代理，确保字体文件也走 Worker
    if (isCss) {
      let text = await res.text();
      text = text.split('https://fonts.gstatic.com/').join(url.origin + '/fonts/');
      headers.set('content-type', 'text/css; charset=utf-8');
      return new Response(text, { status: res.status, headers });
    }
    return new Response(res.body, { status: res.status, headers });
  }

  return html(notFoundPage(env, {}), env, sess, 404);
}
