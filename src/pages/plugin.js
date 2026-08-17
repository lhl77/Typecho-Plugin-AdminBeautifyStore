// 插件详情页（公开 / 口令访问两种模式）
import { esc } from '../lib/kv.js';

export function pluginPage(env, opts) {
  const { plugin: p, pending = false, token = '' } = opts;

  const ver =
    p.minVer || p.maxVer
      ? `Typecho ${p.minVer ? '≥ ' + esc(p.minVer) : ''}${p.minVer && p.maxVer ? ' 且 ' : ''}${p.maxVer ? '≤ ' + esc(p.maxVer) : ''}`
      : '未标注';

  const downloadHref = `/api/download/${encodeURIComponent(p.id)}${token ? '?token=' + encodeURIComponent(token) : ''}`;
  const shareId = p.id;
  const fullLink = `https://ab-store.lhl.one/plugin/${p.id}?token=${p.shareToken || token}`;

  const badge = pending
    ? `<div class="notice"><span class="material-symbols-rounded">hourglass_top</span>该插件正在等待管理员审核，当前仅可通过完整链接访问。</div>`
    : '';

  const content = `
<div class="container-narrow plugin-detail-page">
  ${pending ? badge.replace('class="notice"', 'class="notice plugin-detail-enter plugin-detail-notice"') : ''}
  <div class="card plugin-detail-card">
    <h3 class="plugin-detail-enter" style="font-size:22px">${esc(p.name)}${pending ? ' <span class="badge badge-pending">待审核</span>' : ''}</h3>
    <p class="plugin-detail-enter" style="margin:8px 0">${esc(p.desc || '暂无简介')}</p>
    <div class="plugin-detail-enter" style="margin:16px 0;display:grid;gap:8px;font-size:14px">
      <div><span style="color:var(--md-on-surface-variant)">插件目录：</span><span class="mono">${esc(p.dir)}</span></div>
      <div><span style="color:var(--md-on-surface-variant)">插件版本：</span>${esc(p.version || '—')}</div>
      <div><span style="color:var(--md-on-surface-variant)">支持版本：</span>${ver}</div>
      <div><span style="color:var(--md-on-surface-variant)">插件作者：</span>${esc(p.author || p.uploader)}</div>
      ${p.github ? `<div><span style="color:var(--md-on-surface-variant)">Github：</span><a href="${esc(p.github)}" target="_blank" rel="noopener">${esc(p.github)}</a></div>` : ''}
      ${p.homepage ? `<div><span style="color:var(--md-on-surface-variant)">插件主页：</span><a href="${esc(p.homepage)}" target="_blank" rel="noopener">${esc(p.homepage)}</a></div>` : ''}
      <div><span style="color:var(--md-on-surface-variant)">下载次数：</span>${p.downloads || 0}</div>
      <div><span style="color:var(--md-on-surface-variant)">分享时间：</span>${new Date(p.createdAt).toLocaleString('zh-CN')}</div>
    </div>
    <a class="btn btn-filled btn-block plugin-detail-enter" href="${downloadHref}"><span class="material-symbols-rounded">download</span>下载插件</a>
    <div class="plugin-detail-enter" style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-outlined btn-block" type="button" onclick="absCopy('${esc(shareId)}',this)"><span class="material-symbols-rounded">key</span>复制插件口令（ID）</button>
      <button class="btn btn-outlined btn-block" type="button" onclick="absCopy('${esc(fullLink)}',this)"><span class="material-symbols-rounded">link</span>复制完整链接</button>
    </div>
    <p class="plugin-detail-enter" style="margin-top:12px;font-size:12px;color:var(--md-on-surface-variant)">公开插件用「口令（ID）」即可安装；待审核 / 私密插件需提供完整链接。也可在 Typecho 后台通过 AB Store 插件一键安装。</p>
  </div>
</div>
`;

  return { title: p.name, active: '', description: String(p.desc || p.name || ''), content };
}

/** 404 / 无权限页（MD3 风格） */
export function notFoundPage(env, opts) {
  const content = `
<div class="container-narrow">
  <div class="empty">
    <span class="material-symbols-rounded">search_off</span>
    <h1 style="font-size:20px;font-weight:600;color:var(--md-on-surface);margin-bottom:8px">${esc((opts && opts.title) || '页面不存在')}</h1>
    <p>${esc((opts && opts.message) || '你要找的插件不存在，或仍在等待审核。')}</p>
    <p style="margin-top:16px"><a class="btn btn-tonal" href="/">返回首页</a></p>
  </div>
</div>
`;
  return { title: '404', active: '', content };
}
