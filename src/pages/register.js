// 注册页 /register：邮箱 + 验证码 + 用户名 + 密码 + Turnstile
import { esc } from '../lib/kv.js';

export function registerPage(env, opts) {
  const sitekey = esc(env.TURNSTILE_SITEKEY || '');

  const content = `
<div class="container-narrow">
  <h1 style="font-size:24px;font-weight:600;margin-bottom:20px;text-align:center">注册 AB Store</h1>
  <div class="msg" id="msg"></div>
  <div class="card">
    <div class="field">
      <label>邮箱</label>
      <div style="display:flex;gap:8px">
        <input class="input" id="reg-email" type="email" autocomplete="email" placeholder="you@example.com" style="flex:1">
        <button class="btn btn-tonal" id="btn-reg-code" type="button">发验证码</button>
      </div>
      <div class="hint">注册需验证邮箱，审核结果将通知到该邮箱</div>
    </div>
    <div class="field"><div id="ts-register"></div></div>
    <div class="field">
      <label>邮箱验证码</label>
      <input class="input" id="reg-code" type="text" inputmode="numeric" maxlength="6" placeholder="6 位数字">
    </div>
    <div class="field">
      <label>用户名</label>
      <input class="input" id="reg-user" type="text" autocomplete="username" maxlength="32" placeholder="字母/数字/下划线/连字符，2-32 位">
    </div>
    <div class="field">
      <label>密码</label>
      <input class="input" id="reg-pass" type="password" autocomplete="new-password" placeholder="至少 8 位">
    </div>
    <button class="btn btn-filled btn-block" id="btn-register" type="button">注册并登录</button>
    <div style="text-align:center;margin-top:16px;font-size:13px">
      <a href="/login">已有账号？去登录</a>
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
    tsWidget=turnstile.render('#ts-register',{sitekey:sitekey,action:'register'});
  }
  renderTs();

  var msg=document.getElementById('msg');
  function showMsg(t,ok){msg.textContent=t;msg.className='msg show '+(ok?'msg-ok':'msg-err')}
  function tsToken(){return tsWidget!==null?turnstile.getResponse(tsWidget):''}
  function tsReset(){if(tsWidget!==null)turnstile.reset(tsWidget)}

  function post(url,body){
    return fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json().catch(function(){return{ok:false,message:'服务异常'}})});
  }

  // 发验证码（60s 倒计时）
  var btnCode=document.getElementById('btn-reg-code');
  btnCode.addEventListener('click',function(){
    var email=document.getElementById('reg-email').value.trim();
    if(!email){showMsg('请先填写邮箱');return}
    btnCode.disabled=true;
    post('/api/register/send-code',{email:email,turnstile:tsToken()}).then(function(d){
      if(d.ok){
        showMsg('验证码已发送，10 分钟内有效',true);
        var n=60;
        var timer=setInterval(function(){
          btnCode.textContent=n+'s';
          if(--n<0){clearInterval(timer);btnCode.textContent='发验证码';btnCode.disabled=false}
        },1000);
      }else{
        showMsg(d.message||'发送失败');
        btnCode.disabled=false;
        tsReset();
      }
    }).catch(function(){showMsg('网络错误');btnCode.disabled=false;tsReset()});
  });

  document.getElementById('btn-register').addEventListener('click',function(){
    post('/api/register',{
      email:document.getElementById('reg-email').value.trim(),
      code:document.getElementById('reg-code').value.trim(),
      username:document.getElementById('reg-user').value.trim(),
      password:document.getElementById('reg-pass').value
    }).then(function(d){
      if(d.ok){location.href='/'}else{showMsg(d.message||'注册失败')}
    });
  });
})();
</script>`;

  return { title: '注册', active: '', content, turnstile: true, script };
}
