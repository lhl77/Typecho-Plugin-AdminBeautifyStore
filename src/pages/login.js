// 登录页 /login：邮箱或用户名 + 密码 + Turnstile + GitHub 快捷登录
import { esc } from '../lib/kv.js';

export function loginPage(env, opts) {
  const query = opts.query || {};
  const sitekey = esc(env.TURNSTILE_SITEKEY || '');

  let notice = '';
  if (query.gh === 'unbound') {
    notice = `<div class="notice"><span class="material-symbols-rounded">info</span>该 GitHub 账号尚未绑定 AB Store 账号，请先注册 / 登录后在「我的 → 账号设置」中绑定。</div>`;
  } else if (query.gh === 'fail') {
    notice = `<div class="notice"><span class="material-symbols-rounded">error</span>GitHub 授权失败，请重试。</div>`;
  }

  const content = `
<div class="container-narrow">
  <h1 style="font-size:24px;font-weight:600;margin-bottom:20px;text-align:center">登录 AB Store</h1>
  ${notice}
  <div class="msg" id="msg"></div>
  <div class="card">
    <div class="field">
      <label>邮箱或用户名</label>
      <input class="input" id="login-id" type="text" autocomplete="username" placeholder="you@example.com 或 username">
    </div>
    <div class="field">
      <label>密码</label>
      <input class="input" id="login-pass" type="password" autocomplete="current-password" placeholder="密码">
    </div>
    <div class="field"><div id="ts-login"></div></div>
    <button class="btn btn-filled btn-block" id="btn-login" type="button">登录</button>
    <div style="text-align:center;margin:16px 0;color:var(--md-on-surface-variant);font-size:13px">或</div>
    <a class="btn btn-outlined btn-block" href="/auth/github?mode=login">
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:-3px"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
      使用 GitHub 登录
    </a>
    <div style="display:flex;justify-content:space-between;margin-top:16px;font-size:13px">
      <a href="/register">没有账号？去注册</a>
      <a href="/forget">忘记密码</a>
    </div>
  </div>
</div>
`;

  const script = `
<script>
(function(){
  var sitekey='${sitekey}';
  var tsWidget=null;
  function renderTs(){
    if(!window.turnstile){return setTimeout(renderTs,200)}
    if(!sitekey)return;
    tsWidget=turnstile.render('#ts-login',{sitekey:sitekey,action:'login'});
  }
  renderTs();

  var msg=document.getElementById('msg');
  function showMsg(t,ok){msg.textContent=t;msg.className='msg show '+(ok?'msg-ok':'msg-err')}
  function tsToken(){return tsWidget!==null?turnstile.getResponse(tsWidget):''}
  function tsReset(){if(tsWidget!==null)turnstile.reset(tsWidget)}

  document.getElementById('btn-login').addEventListener('click',function(){
    var id=document.getElementById('login-id').value.trim();
    var pass=document.getElementById('login-pass').value;
    if(!id||!pass){showMsg('请填写账号和密码');return}
    fetch('/api/login',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({identifier:id,password:pass,turnstile:tsToken()})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.ok){
        var r2=new URLSearchParams(location.search).get('r')||'/';
        if(!r2.startsWith('/')||r2.startsWith('//'))r2='/';
        location.href=r2;
      }else{showMsg(d.message||'登录失败');tsReset()}
    }).catch(function(){showMsg('网络错误');tsReset()});
  });
  document.getElementById('login-pass').addEventListener('keydown',function(e){
    if(e.key==='Enter')document.getElementById('btn-login').click();
  });
})();
</script>`;

  return { title: '登录', active: '', content, turnstile: true, script };
}
