// 分享插件页（需登录）：外链 URL 或上传 ZIP（≤2MB）
import { esc } from '../lib/kv.js';

export function sharePage(env, opts) {
  const sitekey = esc(env.TURNSTILE_SITEKEY || '');

  const content = `
<div class="container-narrow">
  <h1 style="font-size:24px;font-weight:600;margin-bottom:8px">分享插件</h1>
  <p style="color:var(--md-on-surface-variant);font-size:14px;margin-bottom:20px">提交后需管理员审核；审核通过前可通过分享口令预览。</p>
  <div class="card" id="share-form">
    <div class="field">
      <label>插件名称 <b style="color:var(--md-error)">*</b></label>
      <input class="input" id="f-name" type="text" maxlength="60" placeholder="">
    </div>
    <div class="field">
      <label>插件作者（选填）</label>
      <input class="input" id="f-author" type="text" maxlength="60" placeholder="插件原作者，留空则显示上传者">
      <div class="hint">与上传者相互独立，填写插件的实际作者</div>
    </div>
    <div class="field">
      <label>插件版本 <b style="color:var(--md-error)">*</b></label>
      <input class="input" id="f-version" type="text" maxlength="30" placeholder="如 1.0.0">
    </div>
    <div class="field">
      <label>插件目录（dir） <b style="color:var(--md-error)">*</b></label>
      <input class="input" id="f-dir" type="text" maxlength="60" placeholder="">
      <div class="hint">插件在 usr/plugins 下的文件夹名，仅限字母、数字、下划线、连字符</div>
    </div>
    <div class="field">
      <label>插件 Github（选填）</label>
      <input class="input" id="f-github" type="url" placeholder="https://github.com/user/repo">
    </div>
    <div class="field">
      <label>插件主页（选填）</label>
      <input class="input" id="f-homepage" type="url" placeholder="https://...">
    </div>

    <label style="display:block;font-size:13px;font-weight:500;color:var(--md-on-surface-variant);margin-bottom:6px">下载方式 <b style="color:var(--md-error)">*</b></label>
    <div class="radio-row">
      <div class="radio-chip active" id="r-url"><span class="material-symbols-rounded">link</span>外链下载地址</div>
      <div class="radio-chip" id="r-upload"><span class="material-symbols-rounded">upload_file</span>上传 ZIP（≤10MB）</div>
    </div>
    <div class="field" id="pane-url">
      <input class="input" id="f-url" type="url" placeholder="https://github.com/.../releases/download/...">
      <div class="hint">插件 ZIP 的 https 直链（如 GitHub Release 附件）</div>
    </div>
    <div class="field" id="pane-upload" style="display:none">
      <input class="input" id="f-file" type="file" accept=".zip,application/zip">
      <div class="hint">≤ 10MB 的 ZIP，将上传到仓库并生成镜像下载直链</div>
    </div>
    <div class="hint" style="margin-bottom:16px;padding:10px 12px;background:var(--md-surface-container-high);border-radius:8px;font-size:13px">
      <b>ZIP 格式要求</b>（必须是 ZIP 文件）：压缩包解压后应<b>直接</b>是一个以「插件目录」命名的文件夹，该文件夹内必须包含插件入口 <code>Plugin.php</code>。<br>
      例如目录为 <code>AdminBeautifyStore</code>，则 ZIP 内结构应为：<br>
      <code style="display:block;margin-top:6px;padding:8px;background:var(--md-surface);border-radius:6px">AdminBeautifyStore.zip<br>└── AdminBeautifyStore/<br>&nbsp;&nbsp;&nbsp;&nbsp;├── Plugin.php<br>&nbsp;&nbsp;&nbsp;&nbsp;└── ...（其他文件）</code>
    </div>
    <div class="field">
      <label>标签 <b style="color:var(--md-error)">*</b></label>
      <input class="input" id="f-tags" type="text" maxlength="100" placeholder="用英文逗号分隔，如 editor,md3,admin">
      <div class="hint">至少一个标签，多个用英文逗号 , 分隔</div>
    </div>

    <div class="field-row">
      <div class="field">
        <label>支持 Typecho 最低版本</label>
        <input class="input" id="f-min" type="text" placeholder="如 1.2.0">
      </div>
      <div class="field">
        <label>支持 Typecho 最高版本</label>
        <input class="input" id="f-max" type="text" placeholder="如 1.2.1">
      </div>
    </div>
    <div class="hint" style="margin-top:-8px;margin-bottom:16px">最低 / 最高版本至少填写一个</div>

    <div class="field">
      <label>插件简介（选填）</label>
      <textarea class="input" id="f-desc" maxlength="200" placeholder="一句话介绍你的插件（≤200 字）"></textarea>
    </div>

    <div class="field" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="f-private" style="width:18px;height:18px;accent-color:var(--md-primary)">
      <label for="f-private" style="margin:0;font-size:14px;color:var(--md-on-surface)">设为私密插件（不进入公共列表，仅通过分享口令访问；仍需审核）</label>
    </div>

    <div class="field"><div id="ts-share"></div></div>
    <div class="progress" id="progress">
      <div class="track"><div class="bar" id="progress-bar"></div></div>
      <div class="label" id="progress-label">上传中...</div>
    </div>
    <button class="btn btn-filled btn-block" id="btn-share" type="button">提交分享</button>
    <div class="msg" id="msg" style="margin:12px 0 0"></div>
    <p style="text-align:center;margin-top:12px;font-size:13px;color:var(--md-on-surface-variant)">遇到问题？联系管理员 <a href="mailto:admin@lhl.one">admin@lhl.one</a></p>
  </div>

  <div class="card" id="result" style="display:none;text-align:center;padding:32px 20px">
    <span class="material-symbols-rounded" style="font-size:44px;color:var(--md-primary)">check_circle</span><br/>
    <span style="font-size:18px;font-weight:600;margin:10px 0 6px" id="r-title">提交成功，等待审核</span>
    <p style="font-size:14px;color:var(--md-on-surface-variant);margin-bottom:14px" id="r-hint">审核通过前，任何人可通过该完整链接查看该插件。审核通过后仅凭插件口令（ID）即可访问。</p>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap">
      <a class="btn btn-tonal" href="/my">前往我的分享</a>
      <button class="btn btn-text" type="button" onclick="window.location.href='/share'">继续分享</button>
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
    tsWidget=turnstile.render('#ts-share',{sitekey:sitekey,action:'share'});
  }
  renderTs();

  var msg=document.getElementById('msg');
  function showMsg(t,ok){msg.textContent=t;msg.className='msg show '+(ok?'msg-ok':'msg-err')}
  function tsToken(){return tsWidget!==null?turnstile.getResponse(tsWidget):''}
  function tsReset(){if(tsWidget!==null)turnstile.reset(tsWidget)}

  // 下载方式切换
  var mode='url';
  var rUrl=document.getElementById('r-url'),rUp=document.getElementById('r-upload');
  var pUrl=document.getElementById('pane-url'),pUp=document.getElementById('pane-upload');
  rUrl.addEventListener('click',function(){mode='url';rUrl.classList.add('active');rUp.classList.remove('active');pUrl.style.display='block';pUp.style.display='none'});
  rUp.addEventListener('click',function(){mode='upload';rUp.classList.add('active');rUrl.classList.remove('active');pUp.style.display='block';pUrl.style.display='none'});

  document.getElementById('btn-share').addEventListener('click',function(){
    var name=document.getElementById('f-name').value.trim();
    var author=document.getElementById('f-author').value.trim();
    var version=document.getElementById('f-version').value.trim();
    var github=document.getElementById('f-github').value.trim();
    var homepage=document.getElementById('f-homepage').value.trim();
    var dir=document.getElementById('f-dir').value.trim();
    var tags=document.getElementById('f-tags').value.trim();
    var minVer=document.getElementById('f-min').value.trim();
    var maxVer=document.getElementById('f-max').value.trim();
    var desc=document.getElementById('f-desc').value.trim();
    var isPrivate=document.getElementById('f-private').checked?'1':'';

    if(!name){showMsg('请填写插件名称');return}
    if(!version){showMsg('请填写插件版本');return}
    if(!dir){showMsg('请填写插件目录');return}
    if(!tags){showMsg('请填写至少一个标签');return}
    if(!minVer&&!maxVer){showMsg('最低 / 最高支持版本至少填一个');return}

    var btn=document.getElementById('btn-share');
    btn.disabled=true;

    var promise;
    if(mode==='upload'){
      var file=document.getElementById('f-file').files[0];
      if(!file){showMsg('请选择 ZIP 文件');btn.disabled=false;return}
      if(file.size>2*1024*1024){showMsg('文件超过 2MB 限制');btn.disabled=false;return}
      var fd=new FormData();
      fd.append('name',name);fd.append('author',author);fd.append('version',version);
      fd.append('github',github);fd.append('homepage',homepage);fd.append('dir',dir);
      fd.append('tags',tags);
      fd.append('minVer',minVer);fd.append('maxVer',maxVer);
      fd.append('desc',desc);fd.append('isPrivate',isPrivate);fd.append('turnstile',tsToken());
      fd.append('file',file);
      // 用 XHR 以便获取上传进度（上传到 Worker 为「上传中」，Worker 到 WebDAV 为「处理中」）
      promise=new Promise(function(resolve,reject){
        var xhr=new XMLHttpRequest();
        var prog=document.getElementById('progress');
        var bar=document.getElementById('progress-bar');
        var label=document.getElementById('progress-label');
        prog.classList.add('show');
        xhr.upload.addEventListener('progress',function(e){
          if(e.lengthComputable){
            var pct=Math.round(e.loaded/e.total*80);
            bar.style.width=pct+'%';
            label.textContent='上传中 '+Math.round(e.loaded/e.total*100)+'%';
          }
        });
        xhr.addEventListener('load',function(){
          try{resolve(JSON.parse(xhr.responseText))}catch(e){reject(new Error('服务异常'))}
        });
        xhr.addEventListener('error',function(){reject(new Error('网络错误'))});
        xhr.open('POST','/api/share');
        xhr.send(fd);
        // 上传完成后进入「处理中」阶段
        xhr.upload.addEventListener('load',function(){
          bar.style.width='90%';
          label.textContent='处理中（上传到仓库）...';
        });
      });
    }else{
      var url=document.getElementById('f-url').value.trim();
      if(!url){showMsg('请填写下载地址');btn.disabled=false;return}
      promise=fetch('/api/share',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({name:name,author:author,version:version,github:github,homepage:homepage,dir:dir,tags:tags,minVer:minVer,maxVer:maxVer,desc:desc,isPrivate:isPrivate,url:url,turnstile:tsToken()})
      }).then(function(r){return r.json()});
    }

    promise.then(function(d){
      btn.disabled=false;
      var prog=document.getElementById('progress');
      var bar=document.getElementById('progress-bar');
      if(d.ok){
        bar.style.width='100%';
        document.getElementById('progress-label').textContent='完成';
        var isAdmin=d.status==='approved';
        document.getElementById('r-title').textContent=isAdmin?'发布成功，已直接上架':'提交成功，等待审核';
        if(isAdmin){document.getElementById('r-hint').textContent='管理员提交免审核，插件已上架，公开可见。'}
        document.getElementById('r-url').textContent=d.shareUrl;
        // 进入成功视图：隐藏分享表单
        document.getElementById('share-form').style.display='none';
        document.getElementById('result').style.display='block';
        window.scrollTo({top:0,behavior:'smooth'});
      }else{
        prog.classList.remove('show');
        bar.style.width='0%';
        showMsg(d.message||'提交失败');
        tsReset();
      }
    }).catch(function(e){
      btn.disabled=false;
      document.getElementById('progress').classList.remove('show');
      document.getElementById('progress-bar').style.width='0%';
      showMsg(e&&e.message?e.message:'网络错误');
      tsReset();
    });
  });
})();
</script>`;

  return { title: '分享插件', active: 'share', content, turnstile: true, script };
}
