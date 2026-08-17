// MD3 页面骨架：顶部 App Bar（桌面）/ 底部导航（移动）/ 主题切换
import { MD3_CSS } from '../lib/md3.css.js';
import { esc } from '../lib/kv.js';

const NAV = [
  { href: '/', label: '首页', icon: 'home', key: 'home' },
  { href: '/list', label: '列表', icon: 'apps', key: 'list' },
  { href: '/share', label: '分享', icon: 'upload', key: 'share' },
  { href: '/my', label: '我的', icon: 'person', key: 'my' },
];

const BRAND_ICON = 'data:image/png;base64,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';

export function renderPage(env, opts) {
  const { title = 'AB Store', description = '', user = null, admin = false, active = '', content = '', turnstile = false, script = '' } = opts;

  const pageDesc = String(description || 'AB Store 是一个开放的 Typecho 插件分享仓库：人人都可以分享自己开发的插件，供所有用户一键安装。').slice(0, 160);
  const pageTitle = esc(title) + ' - AB Store';

  const items = admin ? [...NAV, { href: '/manage', label: '管理', icon: 'settings', key: 'manage' }] : NAV;

  const navHtml = items
    .map(i => `<a class="nav-item${active === i.key ? ' active' : ''}" href="${i.href}"><span class="material-symbols-rounded">${i.icon}</span><span>${i.label}</span></a>`)
    .join('');

  const authHtml = user
    ? `<span class="user-chip"><span class="material-symbols-rounded">account_circle</span>${esc(user)}</span>` +
      `<button class="btn btn-text" type="button" onclick="absLogout()">退出</button>`
    : `<a class="btn btn-filled btn-sm" href="/login">登录 / 注册</a>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="${esc(pageDesc)}">
<meta name="keywords" content="Typecho,插件,插件仓库,AB Store,Typecho 插件">
<meta name="author" content="LHL">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AB Store">
<meta property="og:title" content="${pageTitle}">
<meta property="og:description" content="${esc(pageDesc)}">
<meta property="og:image" content="${BRAND_ICON}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${pageTitle}">
<meta name="twitter:description" content="${esc(pageDesc)}">
<link rel="icon" type="image/png" href="${BRAND_ICON}">
<title>${pageTitle}</title>
<script>!function(){var t=null;try{t=localStorage.getItem('abs-theme')}catch(e){}if(t){document.documentElement.setAttribute('data-theme',t)}}()</script>
<link rel="stylesheet" href="/fonts/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0">
${turnstile ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>' : ''}
<style>${MD3_CSS}</style>
</head>
<body>
<header class="topbar">
  <a class="brand" href="/"><span>AB Store Web</span></a>
  <nav class="topnav">${navHtml}</nav>
  <div class="topbar-right">
    <button class="icon-btn" type="button" onclick="absToggleTheme()" title="切换主题"><span class="material-symbols-rounded">dark_mode</span></button>
    ${authHtml}
  </div>
</header>
<main class="page">${content}</main>
<nav class="bottom-nav">${navHtml}</nav>
<footer class="footer">
  <div class="footer-inner">
    <div class="footer-cols">
      <div class="footer-col footer-brand-col">
        <div class="footer-brand">AB Store Web</div>
        <p class="footer-tagline">Typecho 插件分享仓库<br>人人可分享，一键安装</p>
      </div>
      <div class="footer-col">
        <h4 class="footer-title">相关链接</h4>
        <a class="footer-link" href="https://blog.lhl.one/artical/1326.html" target="_blank" rel="noopener">API 文档</a>
        <a class="footer-link" href="https://github.com/lhl77/Typecho-Plugin-AdminBeautify" target="_blank" rel="noopener">AB Admin · GitHub</a>
        <a class="footer-link" href="https://github.com/lhl77/Typecho-Plugin-AdminBeautifyStore" target="_blank" rel="noopener">AB Store · GitHub</a>
      </div>
      <div class="footer-col">
        <h4 class="footer-title">友情链接</h4>
        <a class="footer-link" href="https://blog.lhl.one" target="_blank" rel="noopener">LHL's Blog</a>
        <a class="footer-link" href="https://img.lhl.one" target="_blank" rel="noopener">聚合图床</a>
        <a class="footer-link" href="https://shop.lhl.one" target="_blank" rel="noopener">作者商店</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-copy">© 2026 <a href="https://lhl.one" target="_blank" rel="noopener">LHL</a> · 保留所有权利</span>
      <a class="footer-icp" href="https://icp.gov.moe/?keyword=20266077" target="_blank" rel="noopener">萌ICP备20266077号</a>
    </div>
  </div>
</footer>
<script>
(function(){var t=null;try{t=localStorage.getItem('abs-theme')}catch(e){}if(t){document.documentElement.setAttribute('data-theme',t)}absThemeIcon()})();
function absThemeIcon(){var b=document.querySelector('.icon-btn');if(!b)return;var d=document.documentElement;var dark=d.getAttribute('data-theme')==='dark'||(!d.getAttribute('data-theme')&&window.matchMedia('(prefers-color-scheme: dark)').matches);b.innerHTML='<span class="material-symbols-rounded">'+(dark?'light_mode':'dark_mode')+'</span>'}
function absToggleTheme(){var b=document.querySelector('.icon-btn');if(b)b.classList.add('spin');var d=document.documentElement;var cur=d.getAttribute('data-theme');var dark=cur==='dark'||(!cur&&window.matchMedia('(prefers-color-scheme: dark)').matches);var n=dark?'light':'dark';d.setAttribute('data-theme',n);try{localStorage.setItem('abs-theme',n)}catch(e){}setTimeout(absThemeIcon,150);setTimeout(function(){if(b)b.classList.remove('spin')},450)}
function absLogout(){fetch('/api/logout',{method:'POST'}).then(function(){location.href='/'})}
function absCopy(txt,btn){
  if(!btn) return;
  var original = btn.innerHTML;
  var done = '<span class="material-symbols-rounded">done</span>已复制';
  function restore(){ btn.innerHTML = original; }
  if(navigator.clipboard){
    navigator.clipboard.writeText(txt).then(function(){
      btn.innerHTML = done;
      setTimeout(restore, 1500);
    }).catch(function(){ restore(); });
    return;
  }
  var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
  btn.innerHTML = done; setTimeout(restore, 1500);
}
function absDialog(title,msg,actions){
  // actions 兼容旧版字符串 URL：默认一个「前往」按钮；数组支持多个操作 [{label,url,cls}]
  if(typeof actions==='string'){actions=[{label:'前往',url:actions,cls:'btn-filled'}]}
  actions=actions||[];
  var m=document.createElement('div');
  m.className='dialog-mask';
  var btns='<button class="btn btn-text" type="button" id="abs-d-cancel">取消</button>'+
    actions.map(function(a,i){return '<button class="btn '+(a.cls||'btn-filled')+'" type="button" data-abs-act="'+i+'">'+a.label+'</button>'}).join('');
  m.innerHTML='<div class="dialog"><h3>'+title+'</h3><p>'+msg+'</p><div class="dialog-actions">'+btns+'</div></div>';
  document.body.appendChild(m);
  requestAnimationFrame(function(){requestAnimationFrame(function(){m.classList.add('show')})});
  function close(){m.classList.remove('show');setTimeout(function(){if(m.parentNode)document.body.removeChild(m)},200)}
  m.addEventListener('click',function(e){if(e.target===m)close()});
  document.getElementById('abs-d-cancel').addEventListener('click',close);
  m.querySelectorAll('[data-abs-act]').forEach(function(b){
    b.addEventListener('click',function(){
      var a=actions[Number(b.getAttribute('data-abs-act'))];
      close();
      if(a&&a.url)location.href=a.url;
    });
  });
}
</script>
${script}
</body>
</html>`;
}
