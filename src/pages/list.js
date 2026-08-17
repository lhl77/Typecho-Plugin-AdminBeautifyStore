// 插件列表页 /list：已通过审核插件的卡片网格 + 搜索 + 版本/标签筛选
import { esc } from '../lib/kv.js';

export function listPage(env, opts) {
  const content = `
<div class="container-narrow" style="max-width:960px">
  <h1 style="font-size:24px;font-weight:600;margin-bottom:8px">插件列表</h1>
  <p style="color:var(--md-on-surface-variant);font-size:14px;margin-bottom:16px">所有已通过审核的 Typecho 插件</p>

  <div class="filter-bar">
    <div class="search-box" style="margin:0">
      <span class="material-symbols-rounded">search</span>
      <input class="input" id="search" type="search" placeholder="搜索插件名称 / 简介 / 目录 / 作者...">
    </div>
    <div class="filter-selects">
      <select class="input" id="f-ver">
        <option value="">全部 Typecho 版本</option>
        <option value="pre10">Typecho 1.0.0 以前</option>
        <option value="10x">Typecho 1.0.x</option>
        <option value="11x">Typecho 1.1.x</option>
        <option value="120">Typecho 1.2.0</option>
        <option value="12x">Typecho 1.2.x（高于 1.2.0）</option>
        <option value="130">Typecho 1.3.0</option>
      </select>
      <select class="input" id="f-tag">
        <option value="">全部标签</option>
      </select>
      <select class="input" id="f-sort">
        <option value="random">随机排序</option>
        <option value="az">名称 A-Z</option>
        <option value="za">名称 Z-A</option>
      </select>
    </div>
  </div>
  <div id="loading" class="loading-state loading-placeholder" style="display:flex">
    <div class="loading-placeholder-head"><span class="loading-spinner"></span><span>正在加载</span></div>
    <div class="loading-skeletons loading-skeletons-grid" aria-hidden="true"><span></span><span></span><span></span></div>
  </div>
  <div class="card-grid" id="grid"></div>
  <div class="empty" id="empty" style="display:none">
    <span class="material-symbols-rounded">inventory_2</span>
    <p>暂无插件，来分享第一个吧！</p>
  </div>
</div>
`;

  const script = `
<script>
(function(){
  var all=[];
  var grid=document.getElementById('grid');
  var empty=document.getElementById('empty');
  var search=document.getElementById('search');
  var fVer=document.getElementById('f-ver');
  var fTag=document.getElementById('f-tag');
  var verSet={},tagSet={};

  function badge(p){
    var v='';
    if(p.minVer||p.maxVer){v='Typecho '+(p.minVer?('≥'+p.minVer):'')+(p.minVer&&p.maxVer?' ':'')+(p.maxVer?('≤'+p.maxVer):'');}
    return v;
  }
  function render(list){
    grid.innerHTML='';
    if(!list){list=[];}
    if(!list.length){empty.style.display='block';return}
    empty.style.display='none';
    list.forEach(function(p){
      var card=document.createElement('div');
      card.className='card card-clickable';
      card.setAttribute('role','link');
      card.setAttribute('tabindex','0');
      card.setAttribute('aria-label','查看 '+p.name);
      if(p.isPinned || ((p.tags||[]).some(function(t){return String(t).toLowerCase()==='推荐';}))){
        card.classList.add('featured');
      }
      var h=document.createElement('h3');
      var a=document.createElement('a');
      a.href='/plugin/'+encodeURIComponent(p.id);
      a.textContent=p.name;
      h.appendChild(a);
      card.addEventListener('click',function(e){
        if(e.target.closest('a,button,input,select,textarea'))return;
        location.href=a.href;
      });
      card.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){
          e.preventDefault();
          location.href=a.href;
        }
      });
      if(p.isPinned){
        var pin=document.createElement('span');
        pin.className='tag-chip pinned';
        pin.textContent='置顶';
        h.appendChild(pin);
      }
      var isFeatured=(p.tags||[]).some(function(t){return String(t).toLowerCase()==='推荐';});
      if(isFeatured){
        var feat=document.createElement('span');
        feat.className='tag-chip featured';
        feat.textContent='推荐';
        h.appendChild(feat);
      }
      card.appendChild(h);
      var desc=document.createElement('p');
      desc.className='desc-clamp';
      desc.textContent=p.desc||'暂无简介';
      card.appendChild(desc);
      var restTags=(p.tags||[]).filter(function(t){return String(t).toLowerCase()!=='推荐';});
      if(restTags.length){
        var tagBox=document.createElement('div');
        tagBox.style.margin='8px 0';
        restTags.forEach(function(t){
          var chip=document.createElement('span');
          chip.className='tag-chip';
          chip.textContent=t;
          tagBox.appendChild(chip);
        });
        card.appendChild(tagBox);
      }
      var meta=document.createElement('p');
      meta.style.marginTop='8px';
      meta.style.fontSize='12px';
      var parts=[];
      if(p.version)parts.push('v'+p.version);
      if(p.author)parts.push('作者 '+p.author);
      parts.push('下载 '+(p.downloads||0)+' 次');
      meta.textContent=parts.join(' · ');
      card.appendChild(meta);
      grid.appendChild(card);
    });
  }
  var fSort=document.getElementById('f-sort');
  var randMap={};
  function sortList(list){
    var mode=fSort?fSort.value:'random';
    var pinned=[],normal=[];
    list.forEach(function(p){ (p.isPinned?pinned:normal).push(p); });
    pinned.sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0)});
    if(mode==='az'){
      normal.sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''),'zh-Hans-CN')});
    }else if(mode==='za'){
      normal.sort(function(a,b){return String(b.name||'').localeCompare(String(a.name||''),'zh-Hans-CN')});
    }else{
      // 稳定随机：每个插件一个随机种子，筛选时顺序保持一致
      normal.forEach(function(p){ if(randMap[p.id]===undefined) randMap[p.id]=Math.random(); });
      normal.sort(function(a,b){return randMap[a.id]-randMap[b.id]});
    }
    return pinned.concat(normal);
  }
  function filter(){
    var q=(search.value||'').toLowerCase();
    var sv=fVer.value, st=fTag.value;
    render(sortList(all.filter(function(p){
      if(q && !((p.name||'').toLowerCase().indexOf(q)>=0||(p.desc||'').toLowerCase().indexOf(q)>=0||(p.dir||'').toLowerCase().indexOf(q)>=0||(p.author||'').toLowerCase().indexOf(q)>=0))return false;
      if(sv){
        // 版本分组匹配：插件支持区间 [minVer,maxVer] 与分组区间有交集即视为支持
        var lo=p.minVer||'0.0.0',hi=p.maxVer||'99.99.99';
        var cmp=function(a,b){var x=a.split('.').map(Number),y=b.split('.').map(Number);for(var i=0;i<3;i++){var d=(x[i]||0)-(y[i]||0);if(d)return d}return 0};
        // 分组区间 [gLo, gHi)
        var groups={
          'pre10':['0.0.0','1.0.0'],
          '10x':['1.0.0','1.1.0'],
          '11x':['1.1.0','1.2.0'],
          '120':['1.2.0','1.2.1'],
          '12x':['1.2.1','1.3.0'],
          '130':['1.3.0','1.3.1']
        };
        var g=groups[sv];
        if(g){
          // 插件区间 [lo,hi] 与分组 [gLo,gHi) 有交集：lo < gHi && hi >= gLo
          if(cmp(lo,g[1])>=0 || cmp(hi,g[0])<0)return false;
        }
      }
      if(st && !(p.tags||[]).map(function(t){return t.toLowerCase()}).includes(st.toLowerCase()))return false;
      return true;
    })));
  }
  search.addEventListener('input',filter);
  fVer.addEventListener('change',filter);
  fTag.addEventListener('change',filter);
  if(fSort)fSort.addEventListener('change',filter);
  fetch('/api/plugins').then(function(r){return r.json()}).then(function(d){
    var loading=document.getElementById('loading');
    if(loading)loading.style.display='none';
    all=(d&&d.plugins)||[];
    // 收集标签
    all.forEach(function(p){
      (p.tags||[]).forEach(function(t){tagSet[t]=1});
    });
    Object.keys(tagSet).sort().forEach(function(t){
      var o=document.createElement('option');o.value=t;o.textContent=t;fTag.appendChild(o);
    });
    render(all);
  }).catch(function(){
    var loading=document.getElementById('loading');
    if(loading)loading.style.display='none';
    render([]);
  });
})();
</script>`;

  return { title: '插件列表', active: 'list', description: '浏览所有已通过审核的 Typecho 插件，支持搜索、版本与标签筛选。', content, script };
}
