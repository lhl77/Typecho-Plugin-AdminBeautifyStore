// Material Design 3 样式（模板字符串导出，主色 #6750A4，亮/暗主题）
export const MD3_CSS = `
:root{
  --md-primary:#4682B4;--md-on-primary:#FFFFFF;--md-primary-container:#D1E4F6;--md-on-primary-container:#001D36;
  --md-surface:#F8FAFE;--md-surface-container-low:#F3F6FA;--md-surface-container:#EDF1F7;--md-surface-container-high:#E7EBF2;--md-surface-container-highest:#E1E5EC;
  --md-on-surface:#191C1F;--md-on-surface-variant:#42474E;--md-outline:#72787F;--md-outline-variant:#C2C7CF;
  --md-error:#B3261E;--md-error-container:#F9DEDC;--md-on-error-container:#410E0B;
  --md-tertiary-container:#FAD8FD;--md-on-tertiary-container:#2E122F;
  --md-featured-container:#FFF3CD;--md-on-featured-container:#5F4500;--md-featured-outline:#B78300;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --md-primary:#9CCAF0;--md-on-primary:#003258;--md-primary-container:#234B73;--md-on-primary-container:#D1E4F6;
  --md-surface:#111417;--md-surface-container-low:#171A1E;--md-surface-container:#1D2024;--md-surface-container-high:#272A2F;--md-surface-container-highest:#32353A;
  --md-on-surface:#E1E2E6;--md-on-surface-variant:#C2C7CF;--md-outline:#8C9198;--md-outline-variant:#42474E;
  --md-error:#F2B8B5;--md-error-container:#8C1D18;--md-on-error-container:#F9DEDC;
  --md-tertiary-container:#5A3A5E;--md-on-tertiary-container:#FAD8FD;
  --md-featured-container:#5C4813;--md-on-featured-container:#FFE08A;--md-featured-outline:#E7B94F;
}}
:root[data-theme="dark"]{
  --md-primary:#9CCAF0;--md-on-primary:#003258;--md-primary-container:#234B73;--md-on-primary-container:#D1E4F6;
  --md-surface:#111417;--md-surface-container-low:#171A1E;--md-surface-container:#1D2024;--md-surface-container-high:#272A2F;--md-surface-container-highest:#32353A;
  --md-on-surface:#E1E2E6;--md-on-surface-variant:#C2C7CF;--md-outline:#8C9198;--md-outline-variant:#42474E;
  --md-error:#F2B8B5;--md-error-container:#8C1D18;--md-on-error-container:#F9DEDC;
  --md-tertiary-container:#5A3A5E;--md-on-tertiary-container:#FAD8FD;
  --md-featured-container:#5C4813;--md-on-featured-container:#FFE08A;--md-featured-outline:#E7B94F;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:var(--md-surface);color:var(--md-on-surface);font-family:system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;line-height:1.6;min-height:100vh;display:flex;flex-direction:column;transition:background-color .3s,color .3s}
main.page{flex:1;width:100%}
a{color:var(--md-primary);text-decoration:none}
a:hover{text-decoration:underline}
.material-symbols-rounded{font-family:'Material Symbols Rounded';font-weight:normal;font-style:normal;font-size:22px;line-height:1;display:inline-block;vertical-align:middle;letter-spacing:normal;text-transform:none;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-smoothing:antialiased;user-select:none}
/* ===== 顶部栏（桌面端） ===== */
.topbar{position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:8px;padding:0 16px;height:64px;background:var(--md-surface-container);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.topbar .brand{display:inline-flex;align-items:center;gap:8px;font-size:18px;font-weight:600;color:var(--md-on-surface);margin-right:16px;margin-left:8px;white-space:nowrap}
.topbar .brand-icon{width:32px;height:32px;display:block;object-fit:contain;border-radius:8px}
.topbar .brand:hover{text-decoration:none}
.topnav{display:flex;gap:4px;flex:1}
.nav-item{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:20px;color:var(--md-on-surface-variant);font-size:14px;font-weight:500}
.nav-item:hover{background:var(--md-surface-container-high);text-decoration:none}
.nav-item.active{background:var(--md-primary-container);color:var(--md-on-primary-container)}
.topbar-right{display:flex;align-items:center;gap:8px}
.user-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:16px;background:var(--md-surface-container-high);color:var(--md-on-surface);font-size:13px}
.icon-btn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;border:0;background:transparent;color:var(--md-on-surface-variant);cursor:pointer}
.icon-btn:hover{background:var(--md-surface-container-high)}
/* ===== 底部导航（移动端） ===== */
.bottom-nav{display:none;position:fixed;left:0;right:0;bottom:0;z-index:100;background:var(--md-surface-container);padding:6px 8px calc(6px + env(safe-area-inset-bottom));box-shadow:0 -1px 3px rgba(0,0,0,.08)}
.bottom-nav .nav-item{flex:1;flex-direction:column;gap:2px;padding:6px 0;border-radius:0;background:transparent;font-size:12px}
.bottom-nav .nav-item .material-symbols-rounded{padding:4px 16px;border-radius:16px}
.bottom-nav .nav-item.active{background:transparent;color:var(--md-on-surface)}
.bottom-nav .nav-item.active .material-symbols-rounded{background:var(--md-primary-container);color:var(--md-on-primary-container)}
/* ===== 布局 ===== */
.page{max-width:960px;margin:0 auto;padding:24px 16px 48px;width:100%}
.container-narrow{max-width:560px;margin:0 auto}
/* ===== Hero（首页垂直居中，不溢出 footer） ===== */
.hero-home{display:flex;flex-direction:column;justify-content:center;flex:1;min-height:calc(100vh - 64px - 300px)}
.home-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.home-enter-item{animation:md3-home-enter .45s cubic-bezier(.2,0,0,1) both}
.home-enter-item:nth-child(1){animation-delay:40ms}
.home-enter-item:nth-child(2){animation-delay:100ms}
.home-enter-item:nth-child(3){animation-delay:160ms}
.home-enter-item:nth-child(4){animation-delay:220ms}
.plugin-detail-card{animation:md3-home-enter .4s cubic-bezier(.2,0,0,1) both}
.plugin-detail-enter{animation:md3-detail-enter .4s cubic-bezier(.2,0,0,1) both}
.plugin-detail-card .plugin-detail-enter:nth-child(1){animation-delay:80ms}
.plugin-detail-card .plugin-detail-enter:nth-child(2){animation-delay:140ms}
.plugin-detail-card .plugin-detail-enter:nth-child(3){animation-delay:200ms}
.plugin-detail-card .plugin-detail-enter:nth-child(4){animation-delay:260ms}
.plugin-detail-card .plugin-detail-enter:nth-child(5){animation-delay:320ms}
.plugin-detail-notice{animation-delay:20ms}
.hero{text-align:center;padding:48px 16px 32px}
.hero h1{font-size:clamp(28px,5vw,44px);font-weight:700;letter-spacing:-.5px;margin-bottom:12px}
.hero p{color:var(--md-on-surface-variant);font-size:clamp(14px,2vw,17px);max-width:560px;margin:0 auto 24px}
/* ===== 卡片 ===== */
.card{background:var(--md-surface-container);border-radius:16px;padding:20px;border:1px solid var(--md-outline-variant)}
.card-grid .card{margin-top:0}
.card h3{font-size:16px;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.card p{color:var(--md-on-surface-variant);font-size:14px}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:16px;align-items:stretch}
.card-grid .card{display:flex;flex-direction:column;height:100%;animation:md3-list-enter .28s cubic-bezier(.2,0,0,1) both}
.card-clickable{cursor:pointer;transition:transform .18s cubic-bezier(.2,0,0,1),box-shadow .18s cubic-bezier(.2,0,0,1),border-color .18s cubic-bezier(.2,0,0,1)}
.card-clickable:hover{border-color:var(--md-primary);box-shadow:0 3px 8px rgba(0,0,0,.12);transform:translateY(-2px)}
.card-clickable:active{transform:scale(.98);box-shadow:0 1px 3px rgba(0,0,0,.1)}
.card-clickable:focus-visible{outline:3px solid color-mix(in srgb,var(--md-primary) 45%,transparent);outline-offset:3px}
.card-grid .card:nth-child(2n){animation-delay:35ms}
.card-grid .card:nth-child(3n){animation-delay:70ms}
.card-grid .card p.desc-clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;flex:1}
.tag-chip{display:inline-block;padding:2px 10px;border-radius:10px;background:var(--md-primary-container);color:var(--md-on-primary-container);font-size:12px;margin:2px 4px 2px 0}
.intro-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:24px 0}
.intro-card{background:var(--md-surface-container);border-radius:16px;padding:20px;border:1px solid var(--md-outline-variant)}
.intro-card .material-symbols-rounded{font-size:32px;color:var(--md-primary);margin-bottom:8px}
.intro-card h3{font-size:15px;font-weight:600;margin-bottom:6px}
.intro-card p{font-size:13px;color:var(--md-on-surface-variant)}
/* ===== 按钮 ===== */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 24px;border-radius:20px;font-size:14px;font-weight:500;border:0;cursor:pointer;font-family:inherit;transition:filter .15s}
.btn:hover{text-decoration:none;filter:brightness(1.05)}
.btn:active{filter:brightness(.95)}
.btn-filled{background:var(--md-primary);color:var(--md-on-primary)}
.btn-tonal{background:var(--md-primary-container);color:var(--md-on-primary-container)}
.btn-outlined{background:transparent;color:var(--md-primary);border:1px solid var(--md-outline)}
.btn-text{background:transparent;color:var(--md-primary);padding:10px 12px}
.btn-danger{background:var(--md-error-container);color:var(--md-on-error-container)}
.btn[disabled]{opacity:.5;cursor:not-allowed}
.btn-block{width:100%}
.btn-sm{padding:6px 16px;font-size:13px;border-radius:16px}
/* ===== 表单 ===== */
.field{margin-bottom:16px}
.field label{display:block;font-size:13px;font-weight:500;color:var(--md-on-surface-variant);margin-bottom:6px}
.field .hint{font-size:12px;color:var(--md-on-surface-variant);margin-top:4px}
.input,textarea.input,select.input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--md-outline);background:var(--md-surface);color:var(--md-on-surface);font-size:15px;font-family:inherit;outline:none}
.input:focus{border-color:var(--md-primary);border-width:2px;padding:11px 13px}
textarea.input{resize:vertical;min-height:80px}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.radio-row{display:flex;gap:12px;margin-bottom:16px}
.radio-chip{flex:1;display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:12px;border:1px solid var(--md-outline);cursor:pointer;font-size:14px}
.radio-chip.active{border-color:var(--md-primary);background:var(--md-primary-container);color:var(--md-on-primary-container)}
/* ===== Tab ===== */
.tabs{display:flex;gap:4px;background:var(--md-surface-container);border-radius:24px;padding:4px;margin-bottom:20px}
.tab{flex:1;padding:10px;border:0;border-radius:20px;background:transparent;color:var(--md-on-surface-variant);font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;transition:background-color .2s cubic-bezier(.2,0,0,1),color .2s cubic-bezier(.2,0,0,1),transform .2s cubic-bezier(.2,0,0,1)}
.tab:hover{background:var(--md-surface-container-high)}
.tab:active{transform:scale(.97)}
.tab.active{background:var(--md-primary-container);color:var(--md-on-primary-container)}
.tabpane{display:none}
.tabpane.active{display:block;animation:md3-pane-enter .28s cubic-bezier(.2,0,0,1) both}
/* ===== 徽章 / 提示 ===== */
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:500}
.badge-pending{background:var(--md-tertiary-container);color:var(--md-on-tertiary-container)}
.badge-approved{background:var(--md-primary-container);color:var(--md-on-primary-container)}
.badge-rejected{background:var(--md-error-container);color:var(--md-on-error-container)}
.badge-archived{background:var(--md-surface-container-highest);color:var(--md-on-surface-variant)}
.msg{padding:12px 16px;border-radius:12px;font-size:14px;margin-bottom:16px;display:none}
.msg.show{display:block}
.msg-ok{background:var(--md-primary-container);color:var(--md-on-primary-container)}
.msg-err{background:var(--md-error-container);color:var(--md-on-error-container)}
.notice{padding:12px 16px;border-radius:12px;font-size:14px;background:var(--md-tertiary-container);color:var(--md-on-tertiary-container);margin-bottom:16px;display:flex;align-items:center;gap:8px}
.loading-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:28px 20px;border:0;border-radius:20px;background:var(--md-surface-container-low);color:var(--md-on-surface-variant);font-size:14px;animation:md3-loading-enter .25s cubic-bezier(.2,0,0,1) both}
.loading-placeholder{align-items:stretch;margin:12px 0 16px;overflow:hidden}
.loading-placeholder-head{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:6px 0 2px;font-size:13px;letter-spacing:.02em}
.loading-spinner{width:26px;height:26px;border-radius:50%;border:3px solid var(--md-surface-container-highest);border-top-color:var(--md-primary);animation:abs-spin .8s linear infinite}
.loading-skeletons{display:grid;gap:12px;width:100%;margin-top:10px}
.loading-skeletons-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.loading-skeletons-rows{grid-template-columns:1fr}
.loading-skeletons span{display:block;position:relative;overflow:hidden;min-height:80px;border-radius:20px;background:var(--md-surface-container-high)}
.loading-skeletons-rows span{min-height:64px}
.loading-skeletons span::after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--md-primary) 8%,transparent),transparent);animation:md3-skeleton-shimmer 1.4s cubic-bezier(.2,0,0,1) infinite}
.loading-skeletons span:nth-child(2)::after{animation-delay:140ms}
.loading-skeletons span:nth-child(3)::after{animation-delay:280ms}
.tag-chip.featured{background:var(--md-featured-container);color:var(--md-on-featured-container);border:1px solid color-mix(in srgb,var(--md-featured-outline) 55%,transparent)}
.tag-chip.pinned{background:var(--md-primary-container);color:var(--md-on-primary-container)}
.card.featured{border-color:color-mix(in srgb,var(--md-featured-outline) 60%,var(--md-outline-variant));background:linear-gradient(135deg,color-mix(in srgb,var(--md-featured-container) 32%,var(--md-surface-container)) 0%,var(--md-surface-container) 100%)}
@keyframes abs-spin{to{transform:rotate(360deg)}}
@keyframes md3-pane-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes md3-loading-enter{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)}}
@keyframes md3-list-enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes md3-skeleton-shimmer{to{transform:translateX(100%)}}
@keyframes md3-home-enter{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes md3-detail-enter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@media (max-width:720px){.loading-skeletons-grid{grid-template-columns:1fr}.loading-skeletons-grid span:not(:first-child){display:none}.plugin-detail-card .plugin-detail-enter:nth-child(4){animation-delay:280ms}}
@media (prefers-reduced-motion:reduce){.tab,.tabpane.active,.loading-state,.loading-spinner,.loading-skeletons span::after,.plugin-item,.card-grid .card,.card-clickable,.home-enter-item,.plugin-detail-card,.plugin-detail-enter{animation:none;transition:none}.tab:active,.card-clickable:hover,.card-clickable:active{transform:none}}
/* ===== 列表项 ===== */
.plugin-item{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:16px;background:var(--md-surface-container);border-radius:16px;border:1px solid var(--md-outline-variant);margin-bottom:12px;animation:md3-list-enter .28s cubic-bezier(.2,0,0,1) both}
.plugin-item:focus-within,.plugin-item:has(.menu-pop.show){z-index:20}
.plugin-item:nth-child(2n){animation-delay:35ms}
.plugin-item:nth-child(3n){animation-delay:70ms}
.plugin-item .info{flex:1;min-width:200px}
.plugin-item .info .name{font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.plugin-item .info .meta{font-size:13px;color:var(--md-on-surface-variant);margin-top:4px}
.plugin-item .actions{display:flex;gap:8px;flex-wrap:wrap}
.my-plugin-actions{width:100%;align-items:center;justify-content:flex-end;gap:8px;padding-top:12px;margin-top:6px;border-top:1px solid var(--md-outline-variant)}
.my-plugin-actions .btn{min-height:36px;white-space:nowrap;transition:background-color .18s cubic-bezier(.2,0,0,1),border-color .18s cubic-bezier(.2,0,0,1),box-shadow .18s cubic-bezier(.2,0,0,1),transform .18s cubic-bezier(.2,0,0,1)}
.my-plugin-actions .btn:hover{filter:none;box-shadow:0 1px 3px rgba(0,0,0,.14)}
.my-plugin-actions .btn:active{transform:scale(.96);box-shadow:none}
.my-plugin-actions .btn:focus-visible{outline:3px solid color-mix(in srgb,var(--md-primary) 40%,transparent);outline-offset:2px}
.my-plugin-actions .material-symbols-rounded{font-size:18px}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:13px;background:var(--md-surface-container-highest);padding:2px 8px;border-radius:6px;user-select:all}
/* ===== 筛选栏 / 友情链接 ===== */
.filter-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:16px 0}
.filter-bar .search-box{flex:1;min-width:220px}
.filter-selects{display:flex;gap:8px;flex-wrap:wrap}
.filter-selects .input{width:auto;min-width:130px;padding:10px 34px 10px 14px;border-radius:20px;background-color:var(--md-surface-container);font-size:13px}
@media (max-width:720px){.filter-bar{flex-direction:column;align-items:stretch}.filter-bar .search-box{min-width:0}.filter-selects .input{flex:1;min-width:0}}
/* ===== 搜索 ===== */
.search-box{position:relative;margin:16px 0}
.search-box .material-symbols-rounded{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--md-on-surface-variant)}
.search-box .input{padding-left:44px;border-radius:24px}
.search-box .input:focus{padding-left:43px}
/* ===== 空状态 / 错误页 ===== */
.empty{text-align:center;padding:48px 16px;color:var(--md-on-surface-variant)}
.empty .material-symbols-rounded{font-size:48px;margin-bottom:12px;opacity:.5}
/* ===== 结果框 ===== */
.result-box{background:var(--md-surface-container);border:1px solid var(--md-outline-variant);border-radius:16px;padding:20px;margin-top:20px}
.result-box .row{display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap}
/* ===== 页脚 ===== */
.footer{margin-top:40px;padding:32px 16px 20px;background:var(--md-surface-container);border-top:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);font-size:13px;flex-shrink:0}
.footer-inner{max-width:960px;margin:0 auto}
.footer-cols{display:grid;grid-template-columns:2fr 1fr 1fr;gap:24px;padding-bottom:20px}
.footer-brand{font-size:16px;font-weight:600;color:var(--md-on-surface);margin-bottom:6px}
.footer-tagline{font-size:13px;line-height:1.7;margin:0}
.footer-title{font-size:13px;font-weight:600;color:var(--md-on-surface);margin:0 0 10px}
.footer-col{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-width:0}
.footer-link{color:var(--md-on-surface-variant);text-decoration:none;font-size:13px;line-height:1.5}
.footer-link:hover{color:var(--md-primary);text-decoration:none}
.footer-bottom{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid var(--md-outline-variant);padding-top:14px}
.footer-copy{font-size:12px}
.footer-copy a{color:var(--md-primary);text-decoration:none}
.footer-copy a:hover{text-decoration:underline}
.footer-icp{font-size:12px;color:var(--md-on-surface-variant);text-decoration:none}
.footer-icp:hover{color:var(--md-primary);text-decoration:none}
@media(max-width:720px){
.footer{margin-top:24px;padding:24px 16px calc(84px + env(safe-area-inset-bottom))}
.footer-cols{grid-template-columns:1fr;gap:16px;padding-bottom:16px}
.footer-col{flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px 14px}
.footer-brand-col{flex-direction:column;align-items:flex-start;gap:6px}
.footer-brand{margin-bottom:0}
.footer-title{width:100%;margin:0}
.footer-bottom{flex-direction:column;align-items:center;gap:4px}
}
/* ===== 上传进度条 ===== */
.progress{display:none;margin:16px 0}
.progress.show{display:block}
.progress .track{height:6px;border-radius:3px;background:var(--md-surface-container-highest);overflow:hidden}
.progress .bar{height:100%;border-radius:3px;background:var(--md-primary);transition:width .2s;width:0%}
.progress .label{font-size:13px;color:var(--md-on-surface-variant);margin-top:6px;text-align:center}
/* ===== 主题切换按钮 ===== */
.icon-btn .material-symbols-rounded{transition:transform .4s ease,opacity .2s}
.icon-btn.spin .material-symbols-rounded{transform:rotate(360deg)}
/* ===== 弹窗 ===== */
.dialog-mask{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .2s}
.dialog-mask.show{opacity:1}
.dialog{background:var(--md-surface-container-high);border-radius:24px;padding:24px;max-width:420px;width:100%;box-shadow:0 8px 24px rgba(0,0,0,.2);transform:scale(.92);transition:transform .2s}
.dialog-mask.show .dialog{transform:scale(1)}
.dialog h3{font-size:18px;font-weight:600;margin-bottom:12px}
.dialog p{font-size:14px;color:var(--md-on-surface-variant);margin-bottom:20px;line-height:1.6}
.dialog .dialog-actions{display:flex;justify-content:flex-end;gap:8px}
/* ===== 响应式 ===== */
@media (max-width:720px){
  .topnav{display:none}
  .topbar .brand{margin-right:auto}
  .topbar-right{margin-left:auto}
  .bottom-nav{display:flex}
  .page{padding-bottom:120px}
  .field-row{grid-template-columns:1fr}
  .hero{padding:32px 8px 24px}
  .hero-home{min-height:calc(100vh - 64px - 140px)}
  .footer{display:block}
  .my-plugin-actions{justify-content:flex-end;flex-wrap:wrap}
  .my-plugin-actions .btn{padding-left:12px;padding-right:12px;font-size:12px}
}
/* 私密徽标 / 下拉菜单 */
.badge-private{background:var(--md-surface-container-highest);color:var(--md-on-surface-variant)}
.menu-wrap{position:relative;display:inline-block}
.menu-pop{position:absolute;right:0;top:calc(100% + 4px);z-index:50;min-width:160px;background:var(--md-surface-container-high);border:1px solid var(--md-outline-variant);border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:6px;display:none}
.menu-pop.show{display:block}
.menu-pop .menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;border:0;background:transparent;color:var(--md-on-surface);font-size:14px;border-radius:8px;cursor:pointer;text-align:left;font-family:inherit}
.menu-pop .menu-item:hover{background:var(--md-surface-container-highest)}
.menu-pop .menu-item.danger{color:var(--md-error)}
`;
