// 插件管理页 /manage（仅管理员）：搜索 + 状态筛选 + 审核（通过/拒绝）+ 编辑/下架/恢复 + 添加
export function managePage(env, opts) {
  const content = `
<div class="container-narrow">
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
    <h1 style="font-size:24px;font-weight:600">管理后台</h1>
    <a class="btn btn-filled btn-sm" href="/share"><span class="material-symbols-rounded">add</span>添加插件</a>
  </div>
  <div class="tabs" id="module-tabs" role="tablist" style="margin-bottom:16px">
    <button class="tab active" data-module="plugins" role="tab" aria-selected="true" type="button">插件管理</button>
    <button class="tab" data-module="users" role="tab" aria-selected="false" type="button">用户管理</button>
  </div>
  <div id="pane-plugins" class="tabpane active">
  <div class="search-box">
    <span class="material-symbols-rounded">search</span>
    <input class="input" id="search" type="search" placeholder="搜索名称 / 目录 / 作者 / 上传者...">
  </div>
  <div class="tabs" id="status-tabs" style="margin-bottom:16px">
    <button class="tab active" data-status="" type="button">全部</button>
    <button class="tab" data-status="approved" type="button">已通过</button>
    <button class="tab" data-status="pending" type="button">审核中</button>
    <button class="tab" data-status="rejected" type="button">已拒绝</button>
    <button class="tab" data-status="archived" type="button">已下架</button>
  </div>
  <div class="msg" id="msg"></div>
  <div id="plugin-loading" class="loading-state loading-placeholder" style="display:flex">
    <div class="loading-placeholder-head"><span class="loading-spinner"></span><span>正在加载</span></div>
    <div class="loading-skeletons loading-skeletons-rows" aria-hidden="true"><span></span><span></span><span></span></div>
  </div>
  <div id="list"></div>
  <div class="empty" id="empty" style="display:none">
    <span class="material-symbols-rounded">inventory_2</span>
    <p>暂无插件</p>
  </div>
  </div>
  <div id="pane-users" class="tabpane">
    <div class="search-box">
      <span class="material-symbols-rounded">search</span>
      <input class="input" id="user-search" type="search" placeholder="搜索用户名 / 邮箱...">
    </div>
    <div id="user-loading" class="loading-state loading-placeholder" style="display:none">
      <div class="loading-placeholder-head"><span class="loading-spinner"></span><span>正在加载</span></div>
      <div class="loading-skeletons loading-skeletons-rows" aria-hidden="true"><span></span><span></span><span></span></div>
    </div>
    <div id="user-list"></div>
    <div class="empty" id="user-empty" style="display:none">
      <span class="material-symbols-rounded">group</span>
      <p>暂无用户</p>
    </div>
  </div>

  <div class="card" id="edit-card" style="display:none;margin-top:16px">
    <h3><span class="material-symbols-rounded">edit</span><span id="form-title">编辑插件</span></h3>
    <input type="hidden" id="e-id">
    <div class="field"><label>插件名称 <b style="color:var(--md-error)">*</b></label><input class="input" id="e-name" type="text" maxlength="60"></div>
    <div class="field"><label>插件作者</label><input class="input" id="e-author" type="text" maxlength="60"></div>
    <div class="field" id="e-dir-row"><label>插件目录 <b style="color:var(--md-error)">*</b></label><input class="input" id="e-dir" type="text" maxlength="60"></div>
    <div class="field"><label>插件版本 <b style="color:var(--md-error)">*</b></label><input class="input" id="e-version" type="text" maxlength="30" placeholder="如 1.0.0"></div>
    <div class="field"><label>标签（英文逗号分隔）</label><input class="input" id="e-tags" type="text" maxlength="100"></div>
    <div class="field"><label>插件 Github（选填）</label><input class="input" id="e-github" type="url" placeholder="https://github.com/..."></div>
    <div class="field"><label>插件主页（选填）</label><input class="input" id="e-homepage" type="url" placeholder="https://..."></div>
    <div class="field"><label>插件简介</label><textarea class="input" id="e-desc" maxlength="200"></textarea></div>
    <div class="field-row">
      <div class="field"><label>最低版本</label><input class="input" id="e-min" type="text"></div>
      <div class="field"><label>最高版本</label><input class="input" id="e-max" type="text"></div>
    </div>
    <div class="field"><label>下载地址 <b style="color:var(--md-error)">*</b></label><input class="input" id="e-url" type="url"></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-filled" id="btn-save" type="button">保存</button>
      <button class="btn btn-text" id="btn-cancel" type="button">取消</button>
    </div>
  </div>
</div>
`;

  const script = `
<script>
(function(){
  var msg=document.getElementById('msg');
  function showMsg(t,ok){msg.textContent=t;msg.className='msg show '+(ok?'msg-ok':'msg-err')}

  function post(url,body){
    return fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})})
      .then(function(r){return r.json().catch(function(){return{ok:false,message:'服务异常'}})});
  }

  function statusBadge(s, isUpdate, isPrivate, isPinned){
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
    if(isPinned){
      var pin=document.createElement('span');
      pin.className='badge badge-approved';
      pin.textContent='置顶';
      frag.appendChild(pin);
    }
    if(isUpdate){
      var eb=document.createElement('span');
      eb.className='badge badge-pending';
      eb.textContent='更新审核';
      frag.appendChild(eb);
    }
    return frag;
  }
  function field(label,value){
    var d=document.createElement('div');
    d.className='meta';
    d.textContent=label+'：'+value;
    return d;
  }

  var all=[];
  var searchEl=document.getElementById('search');
  var statusFilter='';

  // 模块切换：插件 / 用户
  var moduleTabs=document.querySelectorAll('#module-tabs .tab');
  moduleTabs.forEach(function(t){
    t.addEventListener('click',function(){
      moduleTabs.forEach(function(x){x.classList.remove('active')});
      t.classList.add('active');
      moduleTabs.forEach(function(x){x.setAttribute('aria-selected',x===t?'true':'false')});
      var mod=t.getAttribute('data-module');
      document.getElementById('pane-plugins').classList.toggle('active',mod==='plugins');
      document.getElementById('pane-users').classList.toggle('active',mod==='users');
      if(mod==='users')loadUsers();
    });
  });

  var userLoaded=false;
  function loadUsers(){
    if(userLoaded)return;
    userLoaded=true;
    document.getElementById('user-loading').style.display='flex';
    fetch('/api/review/users').then(function(r){return r.json()}).then(function(d){
      document.getElementById('user-loading').style.display='none';
      var box=document.getElementById('user-list');
      var users=(d&&d.users)||[];
      function renderUsers(){
        box.innerHTML='';
        var q=(document.getElementById('user-search').value||'').toLowerCase();
        var list=q?users.filter(function(u){return (u.username||'').toLowerCase().indexOf(q)>=0||(u.email||'').toLowerCase().indexOf(q)>=0}):users;
        document.getElementById('user-empty').style.display=list.length?'none':'block';
      list.forEach(function(u){
          var item=document.createElement('div');
          item.className='plugin-item';
          var info=document.createElement('div');
          info.className='info';
          var nm=document.createElement('div');
          nm.className='name';
          nm.textContent=u.username;
          if(u.disabled){
            var db=document.createElement('span');
            db.className='badge badge-rejected';
            db.textContent='已禁用';
            nm.appendChild(db);
          }
          info.appendChild(nm);
          var meta=document.createElement('div');
          meta.className='meta';
          meta.textContent=u.email+(u.github?(' · GitHub: '+u.github):'')+' · 插件 '+u.pluginCount+' 个 · 注册于 '+(u.createdAt?new Date(u.createdAt).toLocaleDateString('zh-CN'):'—');
          info.appendChild(meta);
          item.appendChild(info);

          // 操作下拉菜单
          var wrap=document.createElement('div');
          wrap.className='menu-wrap';
          var btn=document.createElement('button');
          btn.className='btn btn-outlined btn-sm';
          btn.innerHTML='<span class="material-symbols-rounded">more_vert</span>操作';
          var pop=document.createElement('div');
          pop.className='menu-pop';
          pop.innerHTML='';

          function addItem(icon,text,danger,fn){
            var it=document.createElement('button');
            it.className='menu-item'+(danger?' danger':'');
            it.innerHTML='<span class="material-symbols-rounded">'+icon+'</span>'+text;
            it.addEventListener('click',function(){pop.classList.remove('show');fn()});
            pop.appendChild(it);
          }
          addItem('lock','更改密码',false,function(){
            var pwd=prompt('为用户「'+u.username+'」设置新密码（至少 8 位）：','');
            if(pwd===null)return;
            if(pwd.length<8){alert('密码至少 8 位');return}
            post('/api/review/user/'+encodeURIComponent(u.username),{action:'set-password',password:pwd}).then(function(r){
              if(r.ok)alert('密码已重置');else alert(r.message||'失败');
            });
          });
          if(u.disabled){
            addItem('check_circle','解除禁用',false,function(){
              post('/api/review/user/'+encodeURIComponent(u.username),{action:'enable'}).then(function(r){
                if(r.ok){userLoaded=false;loadUsers();setTimeout(loadUsers,50)}else alert(r.message||'失败');
              });
            });
          }else{
            addItem('block','禁用',false,function(){
              if(!confirm('确认禁用「'+u.username+'」？禁用后无法登录。'))return;
              post('/api/review/user/'+encodeURIComponent(u.username),{action:'disable'}).then(function(r){
                if(r.ok){userLoaded=false;loadUsers();setTimeout(loadUsers,50)}else alert(r.message||'失败');
              });
            });
          }
          addItem('delete','删除用户',true,function(){
            if(!confirm('确认删除「'+u.username+'」？其全部插件将下架，此操作不可恢复！'))return;
            post('/api/review/user/'+encodeURIComponent(u.username),{action:'delete'}).then(function(r){
              if(r.ok){userLoaded=false;loadUsers();setTimeout(loadUsers,50)}else alert(r.message||'失败');
            });
          });

          btn.addEventListener('click',function(e){
            e.stopPropagation();
            document.querySelectorAll('.menu-pop.show').forEach(function(x){x.classList.remove('show')});
            pop.classList.toggle('show');
          });
          wrap.appendChild(btn);
          wrap.appendChild(pop);
          item.appendChild(wrap);
          box.appendChild(item);
        });
      }
      document.getElementById('user-search').addEventListener('input',renderUsers);
      renderUsers();
    }).catch(function(){
      userLoaded=false;
      document.getElementById('user-loading').style.display='none';
      showMsg('用户列表加载失败');
    });
  }

  // 点击空白关闭菜单
  document.addEventListener('click',function(){
    document.querySelectorAll('.menu-pop.show').forEach(function(x){x.classList.remove('show')});
  });

  var tabs=document.querySelectorAll('#status-tabs .tab');
  tabs.forEach(function(t){
    t.addEventListener('click',function(){
      tabs.forEach(function(x){x.classList.remove('active')});
      t.classList.add('active');
      statusFilter=t.getAttribute('data-status');
      render();
    });
  });

  function load(){
    document.getElementById('plugin-loading').style.display='flex';
    fetch('/api/review/all').then(function(r){return r.json()}).then(function(d){
      document.getElementById('plugin-loading').style.display='none';
      all=(d&&d.plugins)||[];
      all.sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0)});
      render();
    }).catch(function(){
      document.getElementById('plugin-loading').style.display='none';
      showMsg('加载失败');
    });
  }

  function render(){
    var box=document.getElementById('list');
    box.innerHTML='';
    var q=(searchEl.value||'').toLowerCase();
    var list=all.filter(function(p){
      if(statusFilter){
        if(statusFilter==='pending'){
          if(p.status!=='pending' && !p.pendingEdit) return false;
        }else if(p.status!==statusFilter) return false;
      }
      if(!q)return true;
      return (p.name||'').toLowerCase().indexOf(q)>=0||(p.dir||'').toLowerCase().indexOf(q)>=0||(p.author||'').toLowerCase().indexOf(q)>=0||(p.uploader||'').toLowerCase().indexOf(q)>=0;
    });
    document.getElementById('empty').style.display=list.length?'none':'block';
    list.forEach(function(p){
      var item=document.createElement('div');
      item.className='plugin-item';
      var info=document.createElement('div');
      info.className='info';
      var nm=document.createElement('div');
      nm.className='name';
      var a=document.createElement('a');
      a.href='/plugin/'+p.id+((p.status==='pending')?('?token='+encodeURIComponent(p.shareToken)):'');
      a.textContent=p.name;
      a.target='_blank';
      nm.appendChild(a);
      nm.appendChild(statusBadge(p.status, !!p.pendingEdit, p.isPrivate, p.isPinned));
      info.appendChild(nm);
      info.appendChild(field('目录',p.dir));
      info.appendChild(field('版本',p.version||'—'));
      info.appendChild(field('标签',(p.tags||[]).join(', ')||'—'));
      info.appendChild(field('作者',p.author||'—'));
      info.appendChild(field('上传者',p.uploader));
      info.appendChild(field('下载次数',String(p.downloads||0)));

      var actions=document.createElement('div');
      actions.className='actions';

      // 待审核（含更新审核）：通过 / 拒绝
      if(p.status==='pending'||p.pendingEdit){
        var ok=document.createElement('button');
        ok.className='btn btn-filled btn-sm';
        ok.textContent='通过';
        ok.addEventListener('click',function(){
          post('/api/review/'+p.id,{action:'approve'}).then(function(r){
            if(r.ok){showMsg('已通过：'+p.name,true);load()}else{showMsg(r.message||'操作失败')}
          });
        });
        var no=document.createElement('button');
        no.className='btn btn-danger btn-sm';
        no.textContent='拒绝';
        no.addEventListener('click',function(){
          var note=prompt('拒绝理由（将随邮件发送给用户，可留空）：','');
          if(note===null)return;
          post('/api/review/'+p.id,{action:'reject',note:note}).then(function(r){
            if(r.ok){showMsg('已拒绝：'+p.name,true);load()}else{showMsg(r.message||'操作失败')}
          });
        });
        actions.appendChild(ok);
        actions.appendChild(no);
      }

      var edit=document.createElement('button');
      edit.className='btn btn-tonal btn-sm';
      edit.textContent='编辑';
      edit.addEventListener('click',function(){openEdit(p)});
      actions.appendChild(edit);

      // 公开/私密切换
      var pv=document.createElement('button');
      pv.className='btn btn-text btn-sm';
      pv.textContent=p.isPrivate?'转为公开':'转为私密';
      pv.addEventListener('click',function(){
        fetch('/api/plugin/'+encodeURIComponent(p.id),{
          method:'PUT',headers:{'content-type':'application/json'},
          body:JSON.stringify({isPrivate:!p.isPrivate})
        }).then(function(r){return r.json()}).then(function(d){
          if(d.ok){showMsg(p.isPrivate?'已转为公开':'已转为私密',true);load()}else{showMsg(d.message||'操作失败')}
        });
      });
      actions.appendChild(pv);

      var pinBtn=document.createElement('button');
      pinBtn.className='btn btn-tonal btn-sm';
      pinBtn.textContent=p.isPinned?'取消置顶':'置顶';
      pinBtn.addEventListener('click',function(){
        fetch('/api/plugin/'+encodeURIComponent(p.id),{
          method:'PUT',headers:{'content-type':'application/json'},
          body:JSON.stringify({isPinned:!p.isPinned})
        }).then(function(r){return r.json()}).then(function(d){
          if(d.ok){showMsg(p.isPinned?'已取消置顶':'已置顶',true);load()}else{showMsg(d.message||'操作失败')}
        });
      });
      actions.appendChild(pinBtn);

      if(p.status==='approved'){
        var arch=document.createElement('button');
        arch.className='btn btn-danger btn-sm';
        arch.textContent='下架';
        arch.addEventListener('click',function(){
          if(!confirm('确认下架「'+p.name+'」？将从公开列表移除。'))return;
          post('/api/review/'+p.id+'/archive',{}).then(function(r){
            if(r.ok){showMsg('已下架：'+p.name,true);load()}else{showMsg(r.message||'操作失败')}
          });
        });
        actions.appendChild(arch);
      }
      if(p.status==='archived'||p.status==='rejected'){
        var restore=document.createElement('button');
        restore.className='btn btn-filled btn-sm';
        restore.textContent='重新启用';
        restore.addEventListener('click',function(){
          if(!confirm('确认重新启用「'+p.name+'」？将直接恢复上架。'))return;
          post('/api/review/'+p.id+'/restore',{}).then(function(r){
            if(r.ok){showMsg('已恢复上架：'+p.name,true);load()}else{showMsg(r.message||'操作失败')}
          });
        });
        actions.appendChild(restore);
      }

      item.appendChild(info);
      item.appendChild(actions);
      box.appendChild(item);
    });
  }
  searchEl.addEventListener('input',render);

  // 编辑（管理员直接生效，免审核）；添加跳分享页
  var editCard=document.getElementById('edit-card');
  function openEdit(p){
    document.getElementById('form-title').textContent='编辑插件';
    document.getElementById('e-id').value=p.id;
    document.getElementById('e-dir-row').style.display='none';
    document.getElementById('e-name').value=p.name||'';
    document.getElementById('e-author').value=p.author||'';
    document.getElementById('e-version').value=p.version||'';
    document.getElementById('e-tags').value=(p.tags||[]).join(',');
    document.getElementById('e-github').value=p.github||'';
    document.getElementById('e-homepage').value=p.homepage||'';
    document.getElementById('e-desc').value=p.desc||'';
    document.getElementById('e-min').value=p.minVer||'';
    document.getElementById('e-max').value=p.maxVer||'';
    document.getElementById('e-url').value=p.url||'';
    editCard.style.display='block';
    editCard.scrollIntoView({behavior:'smooth'});
  }
  document.getElementById('btn-cancel').addEventListener('click',function(){editCard.style.display='none'});
  document.getElementById('btn-save').addEventListener('click',function(){
    var id=document.getElementById('e-id').value;
    if(!id)return;
    var payload={
      name:document.getElementById('e-name').value.trim(),
      author:document.getElementById('e-author').value.trim(),
      version:document.getElementById('e-version').value.trim(),
      tags:document.getElementById('e-tags').value.trim(),
      github:document.getElementById('e-github').value.trim(),
      homepage:document.getElementById('e-homepage').value.trim(),
      desc:document.getElementById('e-desc').value.trim(),
      minVer:document.getElementById('e-min').value.trim(),
      maxVer:document.getElementById('e-max').value.trim(),
      url:document.getElementById('e-url').value.trim()
    };
    fetch('/api/plugin/'+encodeURIComponent(id),{
      method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
    }).then(function(r){return r.json()}).then(function(d){
      if(d.ok){showMsg('已保存',true);editCard.style.display='none';load()}else{showMsg(d.message||'保存失败')}
    });
  });

  load();
})();
</script>`;

  return { title: '插件管理', active: 'manage', content, script };
}
