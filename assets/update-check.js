/**
 * AB-Store 后台自动更新检测
 * 每次加载后台页脚时运行，若有更新则通过 AdminBeautify 的 Banner API 通知
 */
(function () {
    'use strict';

    var CFG = window.__ABS_CFG__;
    if (!CFG || !CFG.ajaxUrl) return;

    // ── 工具：向 action 发送请求 ──
    function absPost(doName, data, cb) {
        var body = new FormData();
        body.append('do', doName);
        body.append('_', CFG.token);
        if (data) {
            Object.keys(data).forEach(function (k) {
                body.append(k, data[k]);
            });
        }
        fetch(CFG.ajaxUrl, { method: 'POST', body: body })
            .then(function (r) { return r.json(); })
            .then(cb)
            .catch(function () { /* 静默失败 */ });
    }

    // ── 从前端已知的 installedMap 和 remote 缓存中快速比较 ──
    // 若 PHP 侧已注入了 installedMap，先在前端本地比较；
    // 若没有，则请求 /action/abs?do=checkUpdates
    function runCheck() {
        var installed = CFG.installedMap || {};
        var hasInstalled = Object.keys(installed).length > 0;

        if (hasInstalled) {
            // 请求服务端比对（使用缓存，不重新拉取）
            absPost('checkUpdates', {}, function (res) {
                if (res && res.code === 0 && res.data && res.data.hasUpdates) {
                    notifyUpdates(res.data.updates || [], res.data.count || 0);
                }
            });
        }
    }

    // ── 显示更新通知 Banner ──
    function notifyUpdates(updates, count) {
        // 防止重复显示
        if (document.getElementById('abs-update-banner')) return;

        var names = updates.slice(0, 3).map(function (u) { return u.name; }).join('、');
        var more  = count > 3 ? ' 等 ' + count + ' 个' : '';
        var msg   = '插件更新：' + names + more + ' 有新版本可用';

        // ① 优先尝试调用 AdminBeautify 的 mkBanner（若已加载）
        if (typeof window.mkBanner === 'function') {
            var listHtml = updates.slice(0, 8).map(function (u) {
                return '• ' + u.name + '  ' + u.localVer + ' → ' + u.remoteVer;
            }).join('\n');

            window.mkBanner({
                id: 'abs-update-banner',
                title: '🔔 发现 ' + count + ' 个插件更新',
                pills: [{ text: count + ' 个更新', key: '' }],
                body: listHtml,
                links: [
                    { text: '前往商店', href: CFG.storeUrl || '#' },
                ],
            });
            return;
        }

        // ② AdminBeautify 未加载时，自己创建一个简单横幅
        var banner = document.createElement('div');
        banner.id  = 'abs-update-banner';
        banner.style.cssText = [
            'position:fixed', 'bottom:20px', 'right:20px', 'z-index:9998',
            'background:var(--md-primary-container,#eaddff)',
            'color:var(--md-on-primary-container,#21005d)',
            'border-radius:16px', 'padding:14px 20px',
            'max-width:320px', 'box-shadow:0 4px 20px rgba(0,0,0,.18)',
            'font-size:.9rem', 'line-height:1.5',
            'display:flex', 'flex-direction:column', 'gap:10px',
            'animation:abs-slide-in .3s ease',
        ].join(';');

        // 注入简单动画（只注入一次）
        if (!document.getElementById('abs-update-banner-style')) {
            var style = document.createElement('style');
            style.id  = 'abs-update-banner-style';
            style.textContent = '@keyframes abs-slide-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}';
            document.head.appendChild(style);
        }

        var msgEl = document.createElement('div');
        msgEl.innerHTML = '<strong>🔔 ' + count + ' 个插件有更新</strong><br>' + escHtml(names) + more;

        var actEl = document.createElement('div');
        actEl.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

        if (CFG.storeUrl) {
            var goBtn = document.createElement('a');
            goBtn.href  = CFG.storeUrl;
            goBtn.style.cssText = 'padding:5px 14px;background:var(--md-primary,#6750a4);color:#fff;border-radius:14px;text-decoration:none;font-size:.82rem;font-weight:600;';
            goBtn.textContent = '前往商店';
            actEl.appendChild(goBtn);
        }

        var closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'padding:5px 12px;background:transparent;border:1px solid currentColor;border-radius:14px;cursor:pointer;font-size:.82rem;color:inherit;';
        closeBtn.textContent = '关闭';
        closeBtn.addEventListener('click', function () {
            banner.parentNode && banner.parentNode.removeChild(banner);
        });
        actEl.appendChild(closeBtn);

        banner.appendChild(msgEl);
        banner.appendChild(actEl);
        document.body.appendChild(banner);
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ── 延迟执行，不阻塞页面加载 ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(runCheck, 1500);
        });
    } else {
        setTimeout(runCheck, 1500);
    }
})();
