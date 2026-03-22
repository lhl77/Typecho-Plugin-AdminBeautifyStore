/**
 * AB-Store 后台自动更新检测
 * 每次加载后台页脚时运行，若有更新则通过 AdminBeautify 的通知系统（abShowUpdateToast）告知用户
 *
 * 服务端 handleCheckUpdates() 实现 stale-while-revalidate：
 *   - 立即返回缓存结果（非阻塞）
 *   - 若缓存已过期，则在连接关闭后后台异步续期
 *   - 前端收到 cache_stale=true 时，15s 后再发一次请求获取刷新后的结果
 */
(function () {
    'use strict';

    var CFG = window.__ABS_CFG__;
    if (!CFG || !CFG.ajaxUrl) return;

    // ── 向 action 发送请求 ──
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

    // ── 执行检测 ──
    function runCheck(isRetry) {
        var installed = CFG.installedMap || {};
        if (Object.keys(installed).length === 0) return;

        absPost('checkUpdates', {}, function (res) {
            if (res && res.code === 0 && res.data) {
                if (res.data.hasUpdates) {
                    notifyUpdates(res.data.updates || [], res.data.count || 0);
                }
                // 缓存刚刚被后台续期，15s 后重新拉取最新更新状态（只重试一次）
                if (res.data.cache_stale && !isRetry) {
                    setTimeout(function () { runCheck(true); }, 15000);
                }
            }
        });
    }

    // ── 显示更新通知（复用 AdminBeautify 的 abShowUpdateToast）──
    function notifyUpdates(updates, count) {
        var names = updates.slice(0, 3).map(function (u) { return u.name; }).join('、');
        var more  = count > 3 ? ' 等 ' + count + ' 个' : '';
        var storeLink = CFG.storeUrl
            ? ' &nbsp;<a href="' + CFG.storeUrl + '" style="color:inherit;font-weight:600;text-decoration:underline">前往商店 →</a>'
            : '';
        var msg = '🔔 发现 ' + count + ' 个插件更新：' + names + more + storeLink;

        if (typeof window.abShowUpdateToast === 'function') {
            window.abShowUpdateToast('update', msg);
        }
        // AdminBeautify 未加载时静默，不自造横幅
    }

    // ── 延迟执行，不阻塞页面加载 ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(runCheck, 2000);
        });
    } else {
        setTimeout(runCheck, 2000);
    }
})();
