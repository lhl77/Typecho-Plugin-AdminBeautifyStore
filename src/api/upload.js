// 分享提交：字段校验 → ZIP 校验 → WebDAV 上传 → 写 KV → 邮件通知管理员
import {
  json, esc, clientIp, checkRate, newPluginId, shareToken, indexAdd, adminEmails, invalidatePluginCaches,
} from '../lib/kv.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { webdavPut, buildDownloadUrl } from '../lib/webdav.js';
import { sendMail, mailTemplate } from '../lib/smtp.js';

const DIR_RE = /^[A-Za-z0-9_-]{1,60}$/;
const VER_RE = /^\d+(\.\d+){0,2}$/;
const MAX_ZIP = 10 * 1024 * 1024;

/** 净化文件名：剔除路径穿越与非安全字符 */
function sanitizeFilename(name) {
  let s = String(name || 'plugin.zip').replace(/[^\w.-]/g, '_').replace(/\.{2,}/g, '_');
  if (!s.toLowerCase().endsWith('.zip')) s += '.zip';
  return s.slice(0, 80);
}

/** POST /api/share —— JSON（外链）或 multipart（含 ZIP） */
export async function handleShare(req, env, username, ctx) {
  const ct = req.headers.get('content-type') || '';
  let fields = {};
  let file = null;

  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData();
    for (const [k, v] of fd.entries()) {
      if (v instanceof File) file = v;
      else fields[k] = v;
    }
  } else {
    fields = await req.json().catch(() => ({}));
  }

  // Turnstile + 限流
  if (!(await verifyTurnstile(env, fields.turnstile, req, 'share'))) {
    return json({ ok: false, message: '人机验证失败' }, 403);
  }
  if (!(await checkRate(env, 'share:' + clientIp(req), 20))) {
    return json({ ok: false, message: '操作过于频繁' }, 429);
  }

  const name = String(fields.name || '').trim();
  const dir = String(fields.dir || '').trim();
  const author = String(fields.author || '').trim().slice(0, 60);
  const version = String(fields.version || '').trim().slice(0, 30);
  const github = String(fields.github || '').trim().slice(0, 200);
  const homepage = String(fields.homepage || '').trim().slice(0, 200);
  const tagsRaw = String(fields.tags || '').trim();
  const desc = String(fields.desc || '').trim().slice(0, 200);
  const isPrivate = String(fields.isPrivate || '') === '1' || fields.isPrivate === true;
  const minVer = String(fields.minVer || '').trim();
  const maxVer = String(fields.maxVer || '').trim();
  const url = String(fields.url || '').trim();

  const tags = tagsRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);

  if (!name || name.length > 60) return json({ ok: false, message: '请填写插件名称（≤60字）' }, 400);
  if (!version) return json({ ok: false, message: '请填写插件版本' }, 400);
  if (!tags.length) return json({ ok: false, message: '请填写至少一个标签' }, 400);
  if (!DIR_RE.test(dir)) return json({ ok: false, message: '插件目录仅限字母、数字、下划线、连字符' }, 400);
  if (github && !/^https:\/\//i.test(github)) return json({ ok: false, message: 'Github 地址需为 https 链接' }, 400);
  if (homepage && !/^https?:\/\//i.test(homepage)) return json({ ok: false, message: '主页地址需为 http(s) 链接' }, 400);
  if (!minVer && !maxVer) return json({ ok: false, message: '最低/最高支持版本至少填一个' }, 400);
  if (minVer && !VER_RE.test(minVer)) return json({ ok: false, message: '最低版本格式不正确，如 1.2.0' }, 400);
  if (maxVer && !VER_RE.test(maxVer)) return json({ ok: false, message: '最高版本格式不正确，如 1.2.1' }, 400);

  // 同用户同 dir 不重复提交
  const myIds = (await env.KV.get('uplugins:' + username, 'json')) || [];
  for (const pid of myIds) {
    const p = await env.KV.get('plugin:' + pid, 'json');
    if (p && p.dir === dir && (p.status === 'pending' || p.status === 'approved')) {
      return json({ ok: false, message: '你已分享过同目录（' + dir + '）的插件' }, 409);
    }
  }

  const id = newPluginId();
  let finalUrl = '';
  let webdavPath = '';

  if (file && file.size > 0) {
    // ZIP 校验：大小 / magic bytes PK\x03\x04
    if (file.size > MAX_ZIP) return json({ ok: false, message: '文件超过 10MB 限制' }, 400);
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) {
      return json({ ok: false, message: '仅支持 ZIP 格式' }, 400);
    }
    const fname = sanitizeFilename(file.name);
    webdavPath = `${dir}/${username}/${id}/${fname}`;
    try {
      await webdavPut(env, webdavPath, await file.arrayBuffer());
    } catch (e) {
      return json({ ok: false, message: '文件上传失败：' + e.message }, 502);
    }
    finalUrl = buildDownloadUrl(env, webdavPath);
  } else {
    if (!/^https:\/\//i.test(url)) {
      return json({ ok: false, message: '请填写合法的 https 下载地址，或上传 ZIP' }, 400);
    }
    finalUrl = url;
  }

  const token = shareToken(6);
  // 管理员分享直接上架免审核
  const isAdm = String(env.ADMIN_USERS || '').split(',').map(s => s.trim()).includes(username);
  const plugin = {
    id, name, dir, author, version, github, homepage, tags, desc, minVer, maxVer,
    url: finalUrl, webdavPath, isPrivate,
    uploader: username, downloads: 0,
    shareToken: token, createdAt: Date.now(), status: isAdm ? 'approved' : 'pending',
  };
  await env.KV.put('plugin:' + id, JSON.stringify(plugin));
  await env.KV.put('token:' + token, id);
  await indexAdd(env, isAdm ? 'approved' : 'pending', id);
  await env.KV.put('uplugins:' + username, JSON.stringify([...myIds, id]));

  // 插件数据变更：异步失效公开列表与该用户 my 缓存
  if (ctx && ctx.waitUntil) ctx.waitUntil(invalidatePluginCaches(env, [username]));
  else await invalidatePluginCaches(env, [username]);

  // 邮件通知管理员（仅非管理员提交才需审核通知）
  const admins = adminEmails(env);
  if (admins.length && !isAdm) {
    const previewUrl = `https://ab-store.lhl.one/plugin/${id}?token=${token}`;
    try {
      await sendMail(env, {
        to: admins,
        subject: `【AB Store】新插件待审核：${name}`,
        text: `${username} 分享了插件「${name}」（${dir}）。\n预览：${previewUrl}\n审核：https://ab-store.lhl.one/review`,
        html: mailTemplate(
          '新插件待审核',
          `<p>用户 <b>${esc(username)}</b> 分享了新插件 <b>${esc(name)}</b>（目录 <code>${esc(dir)}</code>，版本 <code>${esc(version)}</code>）。</p>` +
            `<p>支持版本：Typecho ${minVer ? '≥ ' + esc(minVer) : ''}${minVer && maxVer ? ' 且 ' : ''}${maxVer ? '≤ ' + esc(maxVer) : ''}${isPrivate ? ' · <b>私密插件</b>' : ''}</p>` +
            `<p><a href="${previewUrl}">预览插件</a> ｜ <a href="https://ab-store.lhl.one/manage">前往审核管理</a></p>`
        ),
      });
    } catch {}
  }

  return json({
    ok: true,
    id,
    status: plugin.status,
    shareToken: token,
    shareUrl: `https://ab-store.lhl.one/plugin/${id}?token=${token}`,
  });
}
