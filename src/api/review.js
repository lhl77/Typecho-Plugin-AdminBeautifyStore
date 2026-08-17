// 审核操作 + 已上架插件管理（仅管理员）
import { json, getIndex, indexAdd, indexRemove, esc, newPluginId, shareToken, hashPassword, invalidatePluginCaches } from '../lib/kv.js';
import { sendMail, mailTemplate } from '../lib/smtp.js';

function fullPlugin(p) {
  const out = {
    id: p.id, name: p.name, dir: p.dir, author: p.author || '', version: p.version || '',
    github: p.github || '', homepage: p.homepage || '', tags: p.tags || [], desc: p.desc || '',
    minVer: p.minVer || '', maxVer: p.maxVer || '', url: p.url,
    isPrivate: !!p.isPrivate,
    isPinned: !!p.isPinned,
    uploader: p.uploader, downloads: p.downloads || 0,
    shareToken: p.shareToken, createdAt: p.createdAt, status: p.status,
  };
  // 已上架插件存在待审核修改时，审核列表展示 pendingEdit 内容并标记为「修改申请」
  if (p.pendingEdit) {
    out.isUpdate = true;
    out.pendingEdit = p.pendingEdit;
    out.name = p.pendingEdit.name;
    out.author = p.pendingEdit.author || '';
    out.version = p.pendingEdit.version || '';
    out.github = p.pendingEdit.github || '';
    out.homepage = p.pendingEdit.homepage || '';
    out.tags = p.pendingEdit.tags || [];
    out.desc = p.pendingEdit.desc;
    out.minVer = p.pendingEdit.minVer;
    out.maxVer = p.pendingEdit.maxVer;
    out.url = p.pendingEdit.url;
  }
  return out;
}

async function listByStatus(env, status) {
  const ids = await getIndex(env, status);
  const out = [];
  for (const id of ids) {
    const p = await env.KV.get('plugin:' + id, 'json');
    if (p && p.status === status) out.push(fullPlugin(p));
  }
  return out;
}

/** GET /api/review/pending —— 待审核列表（含已上架插件的修改申请） */
export async function handlePendingList(req, env) {
  const ids = await getIndex(env, 'pending');
  const out = [];
  for (const id of ids) {
    const p = await env.KV.get('plugin:' + id, 'json');
    if (p && (p.status === 'pending' || p.pendingEdit)) out.push(fullPlugin(p));
  }
  return json({ ok: true, plugins: out });
}

/** GET /api/review/all —— 全部插件（管理页用，含所有状态） */
export async function handleAllList(req, env) {
  const out = [];
  const seen = new Set();
  for (const name of ['approved', 'pending', 'archived', 'rejected']) {
    for (const id of await getIndex(env, name)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const p = await env.KV.get('plugin:' + id, 'json');
      if (p) out.push(fullPlugin(p));
    }
  }
  // 兼容旧数据：历史上 rejected / archived 可能未写入索引，退回扫描所有用户的 uplugins
  const userKeys = await env.KV.list({ prefix: 'uplugins:' });
  for (const k of userKeys.keys) {
    const ids = (await env.KV.get(k.name, 'json')) || [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      const p = await env.KV.get('plugin:' + id, 'json');
      if (p && (p.status === 'rejected' || p.status === 'archived')) {
        seen.add(id);
        out.push(fullPlugin(p));
      }
    }
  }
  return json({ ok: true, plugins: out });
}

/** GET /api/review/approved —— 已上架列表（管理用） */
export async function handleApprovedList(req, env) {
  return json({ ok: true, plugins: await listByStatus(env, 'approved') });
}

/** 给上传者发审核结果邮件 */
async function mailUploader(env, p, approved, note) {
  const user = await env.KV.get('user:' + p.uploader, 'json');
  if (!user || !user.email) return;
  const publicUrl = `https://ab-store.lhl.one/plugin/${p.id}`;
  const subject = approved
    ? `【AB Store】你的插件已通过审核：${p.name}`
    : `【AB Store】你的插件未通过审核：${p.name}`;
  const text = approved
    ? `你的插件「${p.name}」已通过审核并上架。\n公开链接：${publicUrl}`
    : `你的插件「${p.name}」未通过审核。${note ? '理由：' + note : ''}\n可修改后重新分享。`;
  const html = mailTemplate(
    approved ? '插件审核通过' : '插件审核未通过',
    approved
      ? `<p>恭喜！你的插件 <b>${esc(p.name)}</b> 已通过审核并正式上架。</p><p><a href="${publicUrl}">查看插件公开页面</a></p><p>其他用户现在可以在插件列表中找到并安装它了。</p>`
      : `<p>很遗憾，你的插件 <b>${esc(p.name)}</b> 未通过审核。</p>${note ? `<p>审核意见：${esc(note)}</p>` : ''}<p>你可以修改后在「我的分享」中重新提交。</p>`
  );
  await sendMail(env, { to: [user.email], subject, text, html });
}

/** POST /api/review/<id> —— {action:'approve'|'reject', note?}；pending 或存在 pendingEdit（更新审核）均可 */
export async function handleReview(req, env, id, ctx) {
  const p = await env.KV.get('plugin:' + id, 'json');
  if (!p) return json({ ok: false, message: '插件不存在' }, 404);
  if (p.status !== 'pending' && !p.pendingEdit) {
    return json({ ok: false, message: '该插件不在待审核状态' }, 400);
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const note = String(body.note || '').trim().slice(0, 500);

  if (action === 'approve') {
    // 若存在待审核修改（已上架插件的编辑），应用到线上字段
    if (p.pendingEdit) {
      Object.assign(p, p.pendingEdit);
      delete p.pendingEdit;
    }
    p.status = 'approved';
    await env.KV.put('plugin:' + id, JSON.stringify(p));
    await indexRemove(env, 'pending', id);
    await indexAdd(env, 'approved', id);
    try { await mailUploader(env, p, true); } catch {}
    if (ctx && ctx.waitUntil) ctx.waitUntil(invalidatePluginCaches(env, [p.uploader]));
    else await invalidatePluginCaches(env, [p.uploader]);
    return json({ ok: true });
  }

  if (action === 'reject') {
    // 修改申请被拒：仅丢弃 pendingEdit，线上内容不动；新插件则标记 rejected
    if (p.pendingEdit) {
      delete p.pendingEdit;
      await env.KV.put('plugin:' + id, JSON.stringify(p));
      await indexRemove(env, 'pending', id);
      await indexRemove(env, 'approved', id);
    } else {
      p.status = 'rejected';
      p.reviewNote = note;
      await env.KV.put('plugin:' + id, JSON.stringify(p));
      await indexRemove(env, 'pending', id);
      await indexRemove(env, 'approved', id);
      await indexAdd(env, 'rejected', id);
    }
    try { await mailUploader(env, p, false, note); } catch {}
    if (ctx && ctx.waitUntil) ctx.waitUntil(invalidatePluginCaches(env, [p.uploader]));
    else await invalidatePluginCaches(env, [p.uploader]);
    return json({ ok: true });
  }

  return json({ ok: false, message: '无效的 action' }, 400);
}

/** POST /api/review/<id>/archive —— 下架归档已上架插件 */
export async function handleArchive(req, env, id, ctx) {
  const p = await env.KV.get('plugin:' + id, 'json');
  if (!p) return json({ ok: false, message: '插件不存在' }, 404);
  if (p.status !== 'approved') return json({ ok: false, message: '该插件不在已上架状态' }, 400);

  p.status = 'archived';
  await env.KV.put('plugin:' + id, JSON.stringify(p));
  await indexRemove(env, 'approved', id);
  await indexAdd(env, 'archived', id);
  if (ctx && ctx.waitUntil) ctx.waitUntil(invalidatePluginCaches(env, [p.uploader]));
  else await invalidatePluginCaches(env, [p.uploader]);
  return json({ ok: true });
}

/** POST /api/review/<id>/restore —— 重新恢复已拒绝/已下架插件 */
export async function handleRestore(req, env, id, ctx) {
  const p = await env.KV.get('plugin:' + id, 'json');
  if (!p) return json({ ok: false, message: '插件不存在' }, 404);
  if (p.status !== 'rejected' && p.status !== 'archived') {
    return json({ ok: false, message: '仅已拒绝/已下架的插件可恢复上架' }, 400);
  }

  p.status = 'approved';
  await env.KV.put('plugin:' + id, JSON.stringify(p));
  await indexRemove(env, 'rejected', id);
  await indexRemove(env, 'archived', id);
  await indexAdd(env, 'approved', id);
  if (ctx && ctx.waitUntil) ctx.waitUntil(invalidatePluginCaches(env, [p.uploader]));
  else await invalidatePluginCaches(env, [p.uploader]);
  return json({ ok: true });
}

/** GET /api/review/users —— 用户列表（仅管理员） */
export async function handleUserList(req, env) {
  const out = [];
  const keys = await env.KV.list({ prefix: 'user:' });
  for (const k of keys.keys) {
    // 跳过映射键
    if (k.name.startsWith('user:email:') || k.name.startsWith('user:github:')) continue;
    const u = await env.KV.get(k.name, 'json');
    if (!u) continue;
    const username = k.name.slice(5);
    const pids = (await env.KV.get('uplugins:' + username, 'json')) || [];
    out.push({
      username,
      email: u.email || '',
      github: u.githubLogin || null,
      disabled: !!u.disabled,
      createdAt: u.createdAt || 0,
      pluginCount: pids.length,
    });
  }
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return json({ ok: true, users: out });
}

/** POST /api/review/user/<username> —— 用户操作：{action:'set-password'|'disable'|'enable'|'delete', password?} */
export async function handleUserAction(req, env, username, ctx) {
  const user = await env.KV.get('user:' + username, 'json');
  if (!user) return json({ ok: false, message: '用户不存在' }, 404);
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === 'set-password') {
    const pwd = String(body.password || '');
    if (pwd.length < 8) return json({ ok: false, message: '密码至少 8 位' }, 400);
    const { hash, salt } = await hashPassword(pwd);
    user.passHash = hash;
    user.salt = salt;
    await env.KV.put('user:' + username, JSON.stringify(user));
    return json({ ok: true });
  }
  if (action === 'disable') {
    user.disabled = true;
    await env.KV.put('user:' + username, JSON.stringify(user));
    return json({ ok: true });
  }
  if (action === 'enable') {
    delete user.disabled;
    await env.KV.put('user:' + username, JSON.stringify(user));
    return json({ ok: true });
  }
  if (action === 'delete') {
    // 删除用户 + 其映射；插件归档
    await env.KV.delete('user:' + username);
    if (user.email) await env.KV.delete('user:email:' + user.email);
    if (user.githubId) await env.KV.delete('user:github:' + user.githubId);
    const pids = (await env.KV.get('uplugins:' + username, 'json')) || [];
    for (const pid of pids) {
      const p = await env.KV.get('plugin:' + pid, 'json');
      if (p) {
        p.status = 'archived';
        await env.KV.put('plugin:' + pid, JSON.stringify(p));
        await indexRemove(env, 'approved', pid);
        await indexRemove(env, 'pending', pid);
        await indexAdd(env, 'archived', pid);
      }
    }
    await env.KV.delete('uplugins:' + username);
    if (ctx && ctx.waitUntil) ctx.waitUntil(invalidatePluginCaches(env, [username]));
    else await invalidatePluginCaches(env, [username]);
    return json({ ok: true });
  }
  return json({ ok: false, message: '无效的 action' }, 400);
}

/** POST /api/review/add —— 管理员直接添加插件（免审核，直接上架） */
export async function handleAdminAdd(req, env, sess, ctx) {
  const body = await req.json().catch(() => null);
  if (!body) return json({ ok: false, message: '请求格式错误' }, 400);

  const name = String(body.name || '').trim();
  const dir = String(body.dir || '').trim();
  const author = String(body.author || '').trim().slice(0, 60);
  const version = String(body.version || '').trim().slice(0, 30);
  const github = String(body.github || '').trim().slice(0, 200);
  const homepage = String(body.homepage || '').trim().slice(0, 200);
  const desc = String(body.desc || '').trim().slice(0, 200);
  const minVer = String(body.minVer || '').trim();
  const maxVer = String(body.maxVer || '').trim();
  const url = String(body.url || '').trim();

  if (!name || name.length > 60) return json({ ok: false, message: '请填写插件名称（≤60字）' }, 400);
  if (!version) return json({ ok: false, message: '请填写插件版本' }, 400);
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(dir)) return json({ ok: false, message: '插件目录仅限字母、数字、下划线、连字符' }, 400);
  if (!minVer && !maxVer) return json({ ok: false, message: '最低/最高支持版本至少填一个' }, 400);
  if (!/^https:\/\//i.test(url)) return json({ ok: false, message: '下载地址必须为 https 直链' }, 400);

  const id = newPluginId();
  const token = shareToken(6);
  const plugin = {
    id, name, dir, author, version, github, homepage, desc, minVer, maxVer,
    url, webdavPath: '',
    uploader: sess.username, downloads: 0,
    shareToken: token, createdAt: Date.now(), status: 'approved',
  };
  await env.KV.put('plugin:' + id, JSON.stringify(plugin));
  await env.KV.put('token:' + token, id);
  await indexAdd(env, 'approved', id);
  const myIds = (await env.KV.get('uplugins:' + sess.username, 'json')) || [];
  await env.KV.put('uplugins:' + sess.username, JSON.stringify([...myIds, id]));

  if (ctx && ctx.waitUntil) ctx.waitUntil(invalidatePluginCaches(env, [sess.username]));
  else await invalidatePluginCaches(env, [sess.username]);
  return json({ ok: true, id });
}
