// 首页：Hero 介绍 + 三张介绍卡片（不含插件列表，列表见 /list）
export function homePage(env, opts) {
  const content = `
<div class="hero-home home-enter">
<section class="hero">
  <h1 class="home-enter-item">AB Store</h1>
  <p class="home-enter-item">Typecho 插件的分享仓库。这里以「分享」为核心——人人都可以把自己开发的 Typecho 插件分享出来，供所有 AB Store 用户一键安装。</p>
  <div class="home-actions home-enter-item">
    <a class="btn btn-filled" href="/share"><span class="material-symbols-rounded">upload</span>分享我的插件</a>
    <a class="btn btn-tonal" href="/list"><span class="material-symbols-rounded">apps</span>浏览插件列表</a>
    <button class="btn btn-outlined" type="button" onclick="absDialog('安装 AB Store','AB Store 是 AB Admin 自带的插件仓库，是否跳转到 AB Admin 详情页？',[{label:'前往',url:'https://ab-store.lhl.one/plugin/c3238849',cls:'btn-filled'},{label:'直接安装 AB Store',url:'https://ab-store.lhl.one/plugin/a34adb99',cls:'btn-tonal'}])"><span class="material-symbols-rounded">install_desktop</span>安装 AB Store</button>
  </div>
</section>

<section class="intro-grid">
  <div class="intro-card home-enter-item">
    <span class="material-symbols-rounded">storefront</span>
    <h3>什么是 AB Store</h3>
    <p>一个开放的 Typecho 插件仓库。所有插件由社区用户分享，经管理员审核后公开展示。</p>
  </div>
  <div class="intro-card home-enter-item">
    <span class="material-symbols-rounded">ios_share</span>
    <h3>如何分享</h3>
    <p>注册账号后进入分享页，填写插件名称、目录与下载地址（或直接上传 ≤10MB 的 ZIP），提交后获得分享口令，审核通过即上架。</p>
  </div>
  <div class="intro-card home-enter-item">
    <span class="material-symbols-rounded">download</span>
    <h3>如何安装</h3>
    <p>在 Typecho 后台安装 AB Store 插件，即可浏览本仓库并一键安装、升级插件。</p>
  </div>
</section>
</div>
`;

  return { title: '首页', active: 'home', description: 'AB Store — Typecho 插件的分享仓库。人人都可以把自己开发的 Typecho 插件分享出来，供所有 AB Store 用户一键安装。', content };
}
