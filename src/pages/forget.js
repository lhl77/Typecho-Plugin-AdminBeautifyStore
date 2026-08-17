// 忘记密码页 /forget：邮箱 + 验证码 + 新密码 + Turnstile
import { esc } from '../lib/kv.js';

export function forgetPage(env, opts) {
  const sitekey = esc(env.TURNSTILE_SITEKEY || '');

  const content = `
<div class="container-narrow">
  <h1 style="font-size:24px;font-weight:600;margin-bottom:20px;text-align:center">重置密码</h1>
  <div class="msg" id="msg"></div>
  <div class="card">
    <div class="field">
      <label>注册邮箱</label>
      <div style="display:flex;gap:8px">
        <input class="input" id="rst-email" type="email" autocomplete="email" placeholder="you@example.com" style="flex:1">
        <button class="btn btn-tonal" id="btn-rst-code" type="button">发验证码</button>
      </div>
    </div>
    <div class="field"><div id="ts-reset"></div></div>
    <div class="field">
      <label>邮箱验证码</label>
      <input class="input" id="rst-code" type="text" inputmode="numeric" maxlength="6" placeholder="6 位数字">
    </div>
    <div class="field">
      <label>新密码</label>
      <input class="input" id="rst-pass" type="password" autocomplete="new-password" placeholder="至少 8 位">
    </div>
    <button class="btn btn-filled btn-block" id="btn-reset" type="button">重置密码</button>
    <div style="text-align:center;margin-top:16px;font-size:13px">
      <a href="/login">返回登录</a>
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
    tsWidget=turnstile.render('#ts-reset',{sitekey:sitekey,action:'password-reset'});
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

  var btnCode=document.getElementById('btn-rst-code');
  btnCode.addEventListener('click',function(){
    var email=document.getElementById('rst-email').value.trim();
    if(!email){showMsg('请先填写邮箱');return}
    btnCode.disabled=true;
    post('/api/password/send-code',{email:email,turnstile:tsToken()}).then(function(d){
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

  document.getElementById('btn-reset').addEventListener('click',function(){
    post('/api/password/reset',{
      email:document.getElementById('rst-email').value.trim(),
      code:document.getElementById('rst-code').value.trim(),
      password:document.getElementById('rst-pass').value
    }).then(function(d){
      if(d.ok){
        showMsg('密码已重置，正在跳转登录...',true);
        setTimeout(function(){location.href='/login'},1200);
      }else{showMsg(d.message||'重置失败')}
    });
  });
})();
</script>`;

  return { title: '忘记密码', active: '', content, turnstile: true, script };
}
