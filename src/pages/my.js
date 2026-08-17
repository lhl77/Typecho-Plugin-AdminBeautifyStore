// 我的分享 + 账号设置（绑定 GitHub）
import { esc } from '../lib/kv.js';

export function myPage(env, opts) {
  const query = opts.query || {};

  let notice = '';
  if (query.gh === 'bound') {
    notice = `<div class="notice"><span class="material-symbols-rounded">check_circle</span>GitHub 绑定成功！下次可直接使用 GitHub 登录。</div>`;
  } else if (query.gh === 'taken') {
    notice = `<div class="notice"><span class="material-symbols-rounded">error</span>该 GitHub 账号已绑定其他账户。</div>`;
  }

  const content = `
<div class="container-narrow">
  <h1 style="font-size:24px;font-weight:600;margin-bottom:20px">我的分享</h1>
  ${notice}
  <div class="msg" id="msg"></div>

  <div id="my-main">
  <div class="tabs" role="tablist">
    <button class="tab active" data-tab="plugins" role="tab" aria-selected="true" type="button">我的插件</button>
    <button class="tab" data-tab="account" role="tab" aria-selected="false" type="button">账号设置</button>
  </div>

  <div class="tabpane active" id="pane-plugins">
    <div id="loading" class="loading-state loading-placeholder" style="display:flex">
      <div class="loading-placeholder-head"><span class="loading-spinner"></span><span>正在加载</span></div>
      <div class="loading-skeletons loading-skeletons-rows" aria-hidden="true"><span></span><span></span><span></span></div>
    </div>
    <div id="list"></div>
    <div class="empty" id="empty" style="display:none">
      <span class="material-symbols-rounded">inventory_2</span>
      <p>还没有分享过插件</p>
      <p style="margin-top:12px"><a class="btn btn-filled" href="/share">去分享</a></p>
    </div>
  </div>

  <div class="tabpane" id="pane-account">
    <div class="card">
      <h3><span class="material-symbols-rounded">mail</span>邮箱</h3>
      <p id="acc-email">加载中...</p>
    </div>
    <div class="card" style="margin-top:10px;">
      <h3><span class="material-symbols-rounded">lock</span>修改密码</h3>
      <p>修改密码需要先退出登录，然后在登录页点击「忘记密码」通过邮箱验证码重置。</p>
      <p style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-outlined btn-sm" type="button" onclick="absLogout();location.href='/forget'">退出并前往重置</button>
      </p>
    </div>
    <div class="card" style="margin-top:10px;">
      <h3><span class="material-symbols-rounded">link</span>GitHub 绑定</h3>
      <p id="acc-github">加载中...</p>
      <p style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn-outlined btn-sm" href="/auth/github" id="btn-bind">绑定 GitHub</a>
        <button class="btn btn-outlined btn-sm" id="btn-unbind" type="button" style="display:none">解除绑定</button>
      </p>
      <p style="margin-top:8px;font-size:12px">绑定后可使用 GitHub 快捷登录。GitHub 不能直接注册账号。</p>
    </div>
  </div>
  </div>

  <div class="card" id="edit-card" style="display:none;margin-top:16px">
    <h3><span class="material-symbols-rounded">edit</span>编辑插件</h3>
    <div class="hint" style="margin-bottom:12px;color:var(--md-on-surface-variant);font-size:13px">已上架插件修改后将提交审核，审核通过前线上内容保持不变。</div>
    <input type="hidden" id="e-id">
    <div class="field"><label>插件名称</label><input class="input" id="e-name" type="text" maxlength="60"></div>
    <div class="field"><label>插件作者</label><input class="input" id="e-author" type="text" maxlength="60"></div>
    <div class="field"><label>插件版本</label><input class="input" id="e-version" type="text" maxlength="30"></div>
    <div class="field"><label>标签（英文逗号分隔）</label><input class="input" id="e-tags" type="text" maxlength="100"></div>
    <div class="field" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="e-private" style="width:18px;height:18px;accent-color:var(--md-primary)">
      <label for="e-private" style="margin:0;font-size:14px;color:var(--md-on-surface)">设为私密插件（不进入公共列表）</label>
    </div>
    <div class="field"><label>插件 Github（选填）</label><input class="input" id="e-github" type="url"></div>
    <div class="field"><label>插件主页（选填）</label><input class="input" id="e-homepage" type="url"></div>
    <div class="field"><label>插件简介</label><textarea class="input" id="e-desc" maxlength="200"></textarea></div>
    <div class="field-row">
      <div class="field"><label>最低版本</label><input class="input" id="e-min" type="text"></div>
      <div class="field"><label>最高版本</label><input class="input" id="e-max" type="text"></div>
    </div>
    <div class="field"><label>下载地址</label><input class="input" id="e-url" type="url"></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-filled" id="btn-save" type="button">保存</button>
      <button class="btn btn-text" id="btn-cancel" type="button">取消</button>
    </div>
  </div>

  <div class="card" id="view-success" style="display:none;margin-top:16px;text-align:center;padding:32px 20px">
    <span class="material-symbols-rounded" style="font-size:44px;color:var(--md-primary)">check_circle</span><br/>
    <span style="font-size:18px;font-weight:600;margin:10px 0 6px" id="s-title">保存成功</span>
    <p style="font-size:14px;color:var(--md-on-surface-variant)" id="s-desc"></p>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-tonal" type="button" id="s-back">返回我的插件</button>
      <a class="btn btn-filled" id="s-view" href="#">查看插件</a>
    </div>
  </div>
</div>
`;

  const script = `
<script>
(function(){
  var msg=document.getElementById('msg');
  function showMsg(t,ok){msg.textContent=t;msg.className='msg show '+(ok?'msg-ok':'msg-err')}

  // GitHub 解除绑定
  document.getElementById('btn-unbind').addEventListener('click',function(){
    if(!confirm('确认解除 GitHub 绑定？解绑后将无法使用 GitHub 快捷登录。'))return;
    fetch('/api/github/unbind',{method:'POST'}).then(function(r){return r.json()}).then(function(d2){
      if(d2.ok){location.reload()}else{showMsg(d2.message||'解绑失败')}
    });
  });

  // Tab 切换
  var tabs=document.querySelectorAll('.tab');
  tabs.forEach(function(t){
    t.addEventListener('click',function(){
      tabs.forEach(function(x){x.classList.remove('active')});
      t.classList.add('active');
      document.querySelectorAll('.tabpane').forEach(function(p){p.classList.remove('active')});
      document.getElementById('pane-'+t.getAttribute('data-tab')).classList.add('active');
    });
  });

  function statusBadge(s, hasEdit, isPrivate){
    var map={pending:['审核中','badge-pending'],approved:['已通过','badge-approved'],rejected:['已拒绝','badge-rejected'],archived:['已下架','badge-archived']};
    var m=map[s]||[s,'badge-archived'];
    var frag=document.createDocumentFragment();
    var el=document.createElement('span');
    el.className='badge '+m[1];
    el.textContent=m[0];
    frag.appendChild(el);
    if(isPrivate){
      var pb=document.createElement('span');
      pb.className='badge badge-private';
      pb.textContent='私密';
      frag.appendChild(pb);
    }
    if(hasEdit){
      var eb=document.createElement('span');
      eb.className='badge badge-pending';
      eb.textContent='更新审核中';
      frag.appendChild(eb);
    }
    return frag;
  }

  fetch('/api/me').then(function(r){return r.json()}).then(function(d){
    var loading=document.getElementById('loading');
    if(loading)loading.style.display='none';
    if(!d.ok){showMsg(d.message||'加载失败');return}

    // 账号设置
    document.getElementById('acc-email').textContent=d.user.email||'';
    var gh=d.user.github;
    document.getElementById('acc-github').textContent=gh?('已绑定：'+gh):'未绑定';
    if(gh){document.getElementById('btn-bind').style.display='none';document.getElementById('btn-unbind').style.display='inline-flex'}

    // 插件列表
    var list=d.plugins||[];
    var box=document.getElementById('list');
    if(!list.length){document.getElementById('empty').style.display='block';return}
    list.sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0)});
    list.forEach(function(p){
      var item=document.createElement('div');
      item.className='plugin-item';

      var info=document.createElement('div');
      info.className='info';
      var nm=document.createElement('div');
      nm.className='name';
      var link=document.createElement('a');
      link.href='/plugin/'+encodeURIComponent(p.id)+(p.status==='pending'?('?token='+encodeURIComponent(p.shareToken)):'');
      link.textContent=p.name;
      nm.appendChild(link);
      nm.appendChild(statusBadge(p.status,p.hasPendingEdit,p.isPrivate));
      info.appendChild(nm);

      var meta=document.createElement('div');
      meta.className='meta';
      meta.textContent='目录 '+p.dir+(p.author?(' · 作者 '+p.author):'')+(p.version?(' · v'+p.version):'')+' · 下载 '+(p.downloads||0)+' 次'+(p.reviewNote?(' · 审核备注：'+p.reviewNote):'');
      info.appendChild(meta);

      var tokenRow=document.createElement('div');
      tokenRow.className='meta';
      tokenRow.textContent='插件口令（ID）：';
      var code=document.createElement('span');
      code.className='mono';
      code.textContent=p.id;
      tokenRow.appendChild(code);
      // 待审核 / 私密需完整链接
      if(p.status==='pending'||p.isPrivate){
        var fl=document.createElement('div');
        fl.className='meta';
        fl.textContent='完整链接：';
        var flc=document.createElement('span');
        flc.className='mono';
        flc.style.wordBreak='break-all';
        flc.textContent=location.origin+'/plugin/'+p.id+'?token='+p.shareToken;
        fl.appendChild(flc);
        info.appendChild(fl);
      }
      info.appendChild(tokenRow);

      var actions=document.createElement('div');
      actions.className='actions my-plugin-actions';

      var editBtn=document.createElement('button');
      editBtn.className='btn btn-tonal btn-sm';
      editBtn.innerHTML='<span class="material-symbols-rounded">edit</span><span>编辑</span>';
      editBtn.addEventListener('click',function(){openEdit(p)});
      actions.appendChild(editBtn);

      var copyBtn=document.createElement('button');
      copyBtn.className='btn btn-outlined btn-sm';
      copyBtn.innerHTML='<span class="material-symbols-rounded">key</span><span>复制口令</span>';
      copyBtn.addEventListener('click',function(){absCopy(p.id,copyBtn)});
      actions.appendChild(copyBtn);

      var copyLink=document.createElement('button');
      copyLink.className='btn btn-outlined btn-sm';
      copyLink.innerHTML='<span class="material-symbols-rounded">link</span><span>'+(p.status==='pending'||p.isPrivate?'复制完整链接':'复制链接')+'</span>';
      copyLink.addEventListener('click',function(){
        absCopy(location.origin+'/plugin/'+p.id+((p.status==='pending'||p.isPrivate)?('?token='+p.shareToken):''),copyLink);
      });
      actions.appendChild(copyLink);

      item.appendChild(info);
      item.appendChild(actions);
      box.appendChild(item);
    });
  }).catch(function(){
    var loading=document.getElementById('loading');
    if(loading)loading.style.display='none';
    showMsg('网络错误');
  });

  // 编辑（独立视图：隐藏主列表，保存后进入成功页）
  var editCard=document.getElementById('edit-card');
  var mainView=document.getElementById('my-main');
  var successView=document.getElementById('view-success');
  function openEdit(p){
    document.getElementById('e-id').value=p.id;
    document.getElementById('e-name').value=p.name||'';
    document.getElementById('e-author').value=p.author||'';
    document.getElementById('e-version').value=p.version||'';
    document.getElementById('e-tags').value=(p.tags||[]).join(',');
    document.getElementById('e-private').checked=!!p.isPrivate;
    document.getElementById('e-github').value=p.github||'';
    document.getElementById('e-homepage').value=p.homepage||'';
    document.getElementById('e-desc').value=p.desc||'';
    document.getElementById('e-min').value=p.minVer||'';
    document.getElementById('e-max').value=p.maxVer||'';
    document.getElementById('e-url').value=p.url||'';
    mainView.style.display='none';
    successView.style.display='none';
    editCard.style.display='block';
    window.scrollTo({top:0,behavior:'smooth'});
  }
  document.getElementById('btn-cancel').addEventListener('click',function(){
    editCard.style.display='none';
    mainView.style.display='block';
  });
  document.getElementById('btn-save').addEventListener('click',function(){
    var id=document.getElementById('e-id').value;
    fetch('/api/plugin/'+encodeURIComponent(id),{
      method:'PUT',headers:{'content-type':'application/json'},
      body:JSON.stringify({
        name:document.getElementById('e-name').value.trim(),
        author:document.getElementById('e-author').value.trim(),
        version:document.getElementById('e-version').value.trim(),
        tags:document.getElementById('e-tags').value.trim(),
        isPrivate:document.getElementById('e-private').checked?'1':'0',
        github:document.getElementById('e-github').value.trim(),
        homepage:document.getElementById('e-homepage').value.trim(),
        desc:document.getElementById('e-desc').value.trim(),
        minVer:document.getElementById('e-min').value.trim(),
        maxVer:document.getElementById('e-max').value.trim(),
        url:document.getElementById('e-url').value.trim()
      })
    }).then(function(r){return r.json()}).then(function(d){
      if(d.ok){
        // 进入成功视图：隐藏编辑表单，展示对应提示
        document.getElementById('s-title').textContent=d.mode==='pending_review'?'已提交修改，等待审核':'保存成功';
        document.getElementById('s-desc').textContent=d.mode==='pending_review'?'修改已提交管理员审核，审核通过前线上内容保持不变。':'修改已保存并立即生效。';
        document.getElementById('s-view').href='/plugin/'+encodeURIComponent(id);
        editCard.style.display='none';
        successView.style.display='block';
        window.scrollTo({top:0,behavior:'smooth'});
      }else{showMsg(d.message||'保存失败')}
    });
  });
  document.getElementById('s-back').addEventListener('click',function(){location.reload()});
})();
</script>`;

  return { title: '我的分享', active: 'my', content, script };
}
