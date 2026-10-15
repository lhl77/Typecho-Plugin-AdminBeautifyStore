/**
 * AB-Store 后台自动更新检测
 * 每次加载后台页脚时运行；若有更新则写入 AdminBeautify 的通知中心（不再弹顶部横条）
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

    // 用户已关闭更新通知，则不检测也不弹出横幅
    if (CFG.notifyOptOut === '1' || CFG.notifyOptOut === 1) return;

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

    // ── 写入 AdminBeautify 的通知中心（不再弹顶部横条）──
    function notifyUpdates(updates, count) {
        if (!window.AdminBeautify || typeof AdminBeautify.request !== 'function') {
            return;   // AdminBeautify 未启用：静默，不自造横幅
        }
        var names = updates.slice(0, 3).map(function (u) { return u.name; }).join('、');
        var more  = count > 3 ? ' 等 ' + count + ' 个' : '';

        // 去重键带上「插件 id + 远程版本」：同一批更新当天只记 1 条；
        // 换了版本 / 换了组合才算新的一条。
        var sig = updates.map(function (u) { return u.id + '@' + u.remoteVer; }).sort().join(',');

        var detail = '## 可更新的插件\n\n' + updates.map(function (u) {
            return '- **' + u.name + '**  ' + u.localVer + ' → ' + u.remoteVer;
        }).join('\n');

        AdminBeautify.request('notice-push', {
            title:  '发现 ' + count + ' 个插件更新',
            body:   names + more,
            level:  'info',
            src:    '插件仓库',
            dedup:  'store:updates:' + sig,
            link:   CFG.storeUrl || '',
            act:    'open-self',   // 商店是站内页面：同标签页跳转，别开新窗口
            detail: detail,
        }, 'POST').then(function () {
            if (AdminBeautify.noticeCenter) AdminBeautify.noticeCenter.refresh();
        }).catch(function () { /* 静默 */ });
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
