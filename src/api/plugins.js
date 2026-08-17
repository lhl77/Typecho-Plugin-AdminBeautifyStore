// 插件：列表 / 详情 / 编辑 / 下载计数
import { json, esc, getIndex, isAdmin, indexAdd, indexRemove, adminEmails, CACHE_PLUGINS_KEY, readPluginCache, writePluginCache, invalidatePluginCaches } from '../lib/kv.js';
import { sendMail, mailTemplate } from '../lib/smtp.js';

const VER_RE = /^\d+(\.\d+){0,2}$/;

function publicPlugin(p) {
  return {
    id: p.id, name: p.name, dir: p.dir, author: p.author || '', version: p.version || '',
    github: p.github || '', homepage: p.homepage || '', tags: p.tags || [], desc: p.desc || '',
    minVer: p.minVer || '', maxVer: p.maxVer || '',
    uploader: p.uploader, downloads: p.downloads || 0, createdAt: p.createdAt,
    isPinned: !!p.isPinned,
  };
}

/** GET /api/plugins —— 已通过插件列表（公开，排除私密），KV 缓存 5 分钟，写操作主动失效 */
export async function handleListPlugins(req, env) {
  const { fresh, stale } = await readPluginCache(env, CACHE_PLUGINS_KEY);
  if (fresh) return json({ ok: true, plugins: fresh }, 200, { 'access-control-allow-origin': '*' });
  if (stale) return json({ ok: true, plugins: stale, stale: true }, 200, { 'access-control-allow-origin': '*' });

  const ids = await getIndex(env, 'approved');
  const out = [];
  for (const id of ids) {
    const p = await env.KV.get('plugin:' + id, 'json');
    if (p && p.status === 'approved' && !p.isPrivate) out.push(publicPlugin(p));
  }
  out.sort((a, b) => {
    if (Number(b.isPinned) !== Number(a.isPinned)) return Number(b.isPinned) - Number(a.isPinned);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  await writePluginCache(env, CACHE_PLUGINS_KEY, out);
  return json({ ok: true, plugins: out }, 200, { 'access-control-allow-origin': '*' });
}

/**
 * 读取插件并判定可见性
 * @returns {{plugin:object|null, canView:boolean, isOwner:boolean, admin:boolean, pending:boolean}}
 */
export async function loadPluginForView(req, env, id, sess) {
  const p = await env.KV.get('plugin:' + id, 'json');
  if (!p) return { plugin: null, canView: false, isOwner: false, admin: false, pending: false };

  const admin = !!(sess && isAdmin(env, sess.username));
  const isOwner = !!(sess && sess.username === p.uploader);
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';

  if (p.status === 'approved') {
    // 私密插件：仅上传者本人 / 管理员 / 持口令可访问
    if (p.isPrivate) {
      const token = url.searchParams.get('token') || '';
      if (!admin && !isOwner && token !== p.shareToken) {
        return { plugin: p, canView: false, isOwner, admin, pending: false };
      }
    }
    return { plugin: p, canView: true, isOwner, admin, pending: false };
  }
  if (p.status === 'pending' && ((token && token === p.shareToken) || admin || isOwner)) {
    return { plugin: p, canView: true, isOwner, admin, pending: true };
  }
  return { plugin: p, canView: false, isOwner, admin, pending: p.status === 'pending' };
}

/** GET /api/plugin/<id> —— 单个插件详情 */
export async function handleGetPlugin(req, env, id, sess) {
  const { plugin: p, canView, pending } = await loadPluginForView(req, env, id, sess);
  if (!p || !canView) return json({ ok: false, message: '插件不存在或未通过审核' }, 404);
  return json(
    { ok: true, plugin: { ...publicPlugin(p), status: p.status } },
    200,
    { 'access-control-allow-origin': '*' }
  );
}

/** PUT /api/plugin/<id> —— 编辑：管理员直接生效；上传者对 pending 直接生效，对已上架插件则写入 pendingEdit 待审核（不影响线上） */
export async function handleUpdatePlugin(req, env, id, sess, ctx) {
  const p = await env.KV.get('plugin:' + id, 'json');
  if (!p) return json({ ok: false, message: '插件不存在' }, 404);

  const admin = isAdmin(env, sess.username);
  const isOwner = sess.username === p.uploader;
  if (!admin && !isOwner) {
    return json({ ok: false, message: '无权编辑该插件' }, 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return json({ ok: false, message: '请求格式错误' }, 400);

  const name = String(body.name == null ? p.name : body.name).trim();
  const author = String(body.author == null ? (p.author || '') : body.author).trim().slice(0, 60);
  const version = String(body.version == null ? (p.version || '') : body.version).trim().slice(0, 30);
  const github = String(body.github == null ? (p.github || '') : body.github).trim().slice(0, 200);
  const homepage = String(body.homepage == null ? (p.homepage || '') : body.homepage).trim().slice(0, 200);
  const desc = String(body.desc == null ? p.desc : body.desc).trim().slice(0, 200);
  const tagsRaw = body.tags == null ? null : String(body.tags);
  const minVer = String(body.minVer == null ? p.minVer : body.minVer).trim();
  const maxVer = String(body.maxVer == null ? p.maxVer : body.maxVer).trim();
  const url = String(body.url == null ? p.url : body.url).trim();
  const nextPinned = body.isPinned !== undefined ? (body.isPinned === true || body.isPinned === '1' || body.isPinned === 1) : !!p.isPinned;

  const tags = tagsRaw == null ? (p.tags || []) : tagsRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);

  if (!name || name.length > 60) return json({ ok: false, message: '插件名称不能为空（≤60字）' }, 400);
  if (!version) return json({ ok: false, message: '插件版本不能为空' }, 400);
  if (!tags.length) return json({ ok: false, message: '至少填写一个标签' }, 400);
  if (!minVer && !maxVer) return json({ ok: false, message: '最低/最高支持版本至少填一个' }, 400);
  if (minVer && !VER_RE.test(minVer)) return json({ ok: false, message: '最低版本格式不正确，如 1.2.0' }, 400);
  if (maxVer && !VER_RE.test(maxVer)) return json({ ok: false, message: '最高版本格式不正确，如 1.2.1' }, 400);
  if (!/^https:\/\//i.test(url)) return json({ ok: false, message: '下载地址必须为 https 直链' }, 400);
  if (github && !/^https:\/\//i.test(github)) return json({ ok: false, message: 'Github 地址需为 https 链接' }, 400);
  if (homepage && !/^https?:\/\//i.test(homepage)) return json({ ok: false, message: '主页地址需为 http(s) 链接' }, 400);

  const edit = { name, author, version, github, homepage, tags, desc, minVer, maxVer, url };
  // 公开/私密切换
  if (body.isPrivate !== undefined) {
    edit.isPrivate = body.isPrivate === true || body.isPrivate === '1';
  }

  // 管理员直接生效
  if (admin) {
    Object.assign(p, edit, { isPinned: nextPinned });
    await env.KV.put('plugin:' + id, JSON.stringify(p));
    if (ctx && ctx.waitUntil) ctx.waitUntil(invalidatePluginCaches(env, [p.uploader]));
    else await invalidatePluginCaches(env, [p.uploader]);
    return json({ ok: true, mode: 'direct' });
  }

  // 上传者：pending 状态直接改；approved 状态写 pendingEdit 待审核（不动线上）
  if (p.status === 'pending') {
    Object.assign(p, edit);
    await env.KV.put('plugin:' + id, JSON.stringify(p));
    if (ctx && ctx.waitUntil) ctx.waitUntil(invalidatePluginCaches(env, [p.uploader]));
    else await invalidatePluginCaches(env, [p.uploader]);
    return json({ ok: true, mode: 'direct' });
  }
  if (p.status === 'approved') {
    p.pendingEdit = edit;
    await env.KV.put('plugin:' + id, JSON.stringify(p));
    // 确保进入待审核索引（审核通过后才应用 pendingEdit 到线上字段）
    await indexAdd(env, 'pending', id);
    // 通知管理员有新的修改待审核
    const admins = adminEmails(env);
    if (admins.length) {
      try {
        await sendMail(env, {
          to: admins,
          subject: `【AB Store】插件修改待审核：${p.name}`,
          text: `${sess.username} 提交了插件「${p.name}」的修改申请。\n审核：https://ab-store.lhl.one/manage`,
          html: mailTemplate(
            '插件修改待审核',
            `<p><b>${esc(sess.username)}</b> 提交了插件 <b>${esc(p.name)}</b> 的修改申请（更新审核）。</p>` +
              `<p><a href="https://ab-store.lhl.one/manage">前往审核管理</a></p>`
          ),
        });
      } catch {}
    }
    return json({ ok: true, mode: 'pending_review' });
  }
  // 已下架/已拒绝插件编辑后自动重新进入审核状态
  if (p.status === 'archived' || p.status === 'rejected') {
    Object.assign(p, edit);
    delete p.pendingEdit;
    p.status = 'pending';
    await env.KV.put('plugin:' + id, JSON.stringify(p));
    await indexRemove(env, 'approved', id);
    await indexAdd(env, 'pending', id);
    if (ctx && ctx.waitUntil) ctx.waitUntil(invalidatePluginCaches(env, [p.uploader]));
    else await invalidatePluginCaches(env, [p.uploader]);
    return json({ ok: true, mode: 'pending_review' });
  }

  return json({ ok: false, message: '当前状态不可编辑' }, 400);
}

/** GET /api/download/<id> —— 下载计数 +1 并 302 到下载地址 */
export async function handleDownload(req, env, id, sess) {
  const { plugin: p, canView } = await loadPluginForView(req, env, id, sess);
  if (!p || !canView) return json({ ok: false, message: '插件不存在或未通过审核' }, 404);

  p.downloads = (p.downloads || 0) + 1;
  await env.KV.put('plugin:' + id, JSON.stringify(p));
  return Response.redirect(p.url, 302);
}
