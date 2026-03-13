<?php
/**
 * AB-Store — AdminBeautify 插件仓库
 * 在 Typecho 后台浏览、安装、升级、卸载插件，适配 AdminBeautify MD3 主题
 *
 * @package   AB-Store
 * @author    LHL
 * @version   1.0.0
 * @link      https://github.com/lhl77/Typecho-Plugin-AdminBeautifyStore
 */

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class AdminBeautifyStore_Plugin implements Typecho_Plugin_Interface
{
    /** 仓库 JSON 文件的 raw URL */
    const REMOTE_JSON_URL = 'https://raw.githubusercontent.com/lhl77/Typecho-Plugin-AdminBeautifyStore/main/plugins.json';

    /** 本地缓存文件 */
    const CACHE_FILE = 'cache.json';

    /** 缓存有效期（秒） */
    const CACHE_TTL = 3600;

    /** 插件自身目录 */
    public static function pluginDir()
    {
        return rtrim(__DIR__, '/\\') . DIRECTORY_SEPARATOR;
    }

    /** backup 目录 */
    public static function backupDir()
    {
        return self::pluginDir() . 'backup' . DIRECTORY_SEPARATOR;
    }

    /** 缓存文件路径 */
    public static function cacheFile()
    {
        return self::pluginDir() . self::CACHE_FILE;
    }

    /** 激活插件 */
    public static function activate()
    {
        // 注册 AJAX Action
        Utils\Helper::addAction('abs', 'AdminBeautifyStore_Action');

        // 在「控制台」菜单组下添加侧边栏面板
        Utils\Helper::addPanel(1, 'AdminBeautifyStore/Panel.php', 'AB-Store', '插件仓库', 'administrator');

        // 注入脚部 JS（更新检测）
        Typecho_Plugin::factory('admin/footer.php')->begin = array(__CLASS__, 'injectFooter');

        // 初始化插件配置，避免访问"设置"页时抛出"配置信息没有找到"
        Utils\Helper::configPlugin('AdminBeautifyStore', array('_v' => '1'));

        // 确保 backup 目录存在
        if (!is_dir(self::backupDir())) {
            @mkdir(self::backupDir(), 0755, true);
        }

        return _t('AB-Store 已启用');
    }

    /** 禁用插件 */
    public static function deactivate()
    {
        Utils\Helper::removePanel(1, 'AdminBeautifyStore/Panel.php');
        Utils\Helper::removeAction('abs');
        return _t('AB-Store 已禁用');
    }

    /** 插件配置面板（仅用于满足 Typecho 接口要求，实际 UI 在侧边栏 Panel.php 中） */
    public static function config(Typecho_Widget_Helper_Form $form)
    {
        // 必须添加与 configPlugin 初始化键名一致的字段，
        // 否则 Widget\Plugins\Config::config() 在尝试读取已存 options 时会报错。
        $hidden = new Typecho_Widget_Helper_Form_Element_Hidden('_v', null, '1');
        $form->addInput($hidden);

        // 提示用户通过侧边栏访问
        $panelUrl = Typecho_Common::url(
            '/admin/extending.php?panel=' . urlencode('AdminBeautifyStore/Panel.php'),
            Typecho_Widget::widget('Widget_Options')->index
        );
        echo '<p style="margin:0 0 12px;color:var(--md-on-surface-variant,#49454f)">'
            . 'AB-Store 商店界面已添加到控制台侧边栏。'
            . ' <a href="' . htmlspecialchars($panelUrl) . '">点此前往 AB-Store →</a>'
            . '</p>';
    }

    /** 个人配置（空） */
    public static function personalConfig(Typecho_Widget_Helper_Form $form) {}

    // ================================================================
    //  Hook 回调
    // ================================================================

    /**
     * 注入脚部 JS（登录后，每次进入后台都自动检测插件更新）
     */
    public static function injectFooter()
    {
        try {
            $user = Typecho_Widget::widget('Widget_User');
            if (!$user->hasLogin()) return;
        } catch (Exception $e) {
            return;
        }

        $options  = Typecho_Widget::widget('Widget_Options');
        $security = Typecho_Widget::widget('Widget_Security');
        $ajaxUrl  = Typecho_Common::url('/action/abs', $options->index);
        $token    = $security->getToken($ajaxUrl);

        // 将已安装的仓库内插件版本信息传递给前端
        $installedMap = self::buildInstalledVersionMap();

        echo '<script>';
        echo 'window.__ABS_CFG__=' . json_encode(array(
            'ajaxUrl'      => $ajaxUrl,
            'token'        => $token,
            'pluginUrl'    => Typecho_Common::url('AdminBeautifyStore/', $options->pluginUrl),
            'installedMap' => $installedMap,
            'storeUrl'     => Typecho_Common::url('/admin/plugins.php?config=AdminBeautifyStore', $options->index),
        ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ';';
        echo '</script>';

        $assetBase = Typecho_Common::url('AdminBeautifyStore/assets/', $options->pluginUrl);
        echo '<script src="' . $assetBase . 'update-check.js"></script>' . "\n";
    }

    // ================================================================
    //  商店 UI（config 页面输出）
    // ================================================================

    /**
     * 渲染商店主界面
     */
    public static function renderStorePage()
    {
        // ── 内联样式（MD3 风格，全部使用 var(--md-*) 变量）──
        echo '<style id="abs-inline-style">';
        self::outputCSS();
        echo '</style>';

        $options  = Typecho_Widget::widget('Widget_Options');
        $security = Typecho_Widget::widget('Widget_Security');
        $ajaxUrl  = Typecho_Common::url('/action/abs', $options->index);
        $token    = $security->getToken($ajaxUrl);
        $assetBase = Typecho_Common::url('AdminBeautifyStore/assets/', $options->pluginUrl);

        // 读取缓存的 JSON
        $registry = self::loadCachedRegistry();
        $plugins  = isset($registry['plugins']) ? $registry['plugins'] : array();

        // 已安装插件目录列表
        $installedDirs = self::getInstalledPluginDirs();
        $installedMap  = self::buildInstalledVersionMap();

        // 统计
        $totalCount   = count($plugins);
        $installedCount = 0;
        $updateCount  = 0;
        foreach ($plugins as $p) {
            $dir = isset($p['directory']) ? $p['directory'] : '';
            if ($dir && in_array($dir, $installedDirs)) {
                $installedCount++;
                $remoteVer  = isset($p['version']) ? $p['version'] : '';
                $localVer   = isset($installedMap[$dir]) ? $installedMap[$dir] : '';
                if ($remoteVer && $localVer && version_compare($remoteVer, $localVer, '>')) {
                    $updateCount++;
                }
            }
        }

        $updatedAt = isset($registry['updated']) ? $registry['updated'] : '';
        $cacheAge  = '';
        if ($updatedAt) {
            $ts = strtotime($updatedAt);
            $diff = time() - $ts;
            if ($diff < 60)        $cacheAge = '刚刚更新';
            elseif ($diff < 3600)  $cacheAge = intval($diff / 60) . ' 分钟前更新';
            elseif ($diff < 86400) $cacheAge = intval($diff / 3600) . ' 小时前更新';
            else                   $cacheAge = intval($diff / 86400) . ' 天前更新';
        }

        ?>
<div id="abs-root" data-ajax="<?php echo htmlspecialchars($ajaxUrl); ?>" data-token="<?php echo htmlspecialchars($token); ?>">

    <!-- 顶部工具栏 -->
    <div class="abs-toolbar">
        <div class="abs-toolbar-left">
            <span class="abs-toolbar-title">
                <span class="abs-icon">store</span>AB-Store
            </span>
            <?php if ($updateCount > 0): ?>
            <span class="abs-badge abs-badge-update"><?php echo $updateCount; ?> 个更新</span>
            <?php endif; ?>
        </div>
        <div class="abs-toolbar-right">
            <span class="abs-stat"><?php echo $totalCount; ?> 个插件</span>
            <?php if ($cacheAge): ?>
            <span class="abs-stat abs-stat-muted"><?php echo htmlspecialchars($cacheAge); ?></span>
            <?php endif; ?>
            <button class="abs-btn abs-btn-tonal" id="abs-refresh-btn" title="从 GitHub 重新拉取插件列表">
                <span class="abs-icon">refresh</span>刷新列表
            </button>
        </div>
    </div>

    <!-- 搜索 + 过滤 -->
    <div class="abs-filter-bar">
        <div class="abs-search-wrap">
            <span class="abs-icon abs-search-icon">search</span>
            <input type="text" id="abs-search" class="abs-search" placeholder="搜索插件名、作者或标签…">
        </div>
        <div class="abs-tabs" id="abs-tabs">
            <button class="abs-tab abs-tab-active" data-filter="all">全部 <span class="abs-tab-count"><?php echo $totalCount; ?></span></button>
            <button class="abs-tab" data-filter="installed">已安装 <span class="abs-tab-count"><?php echo $installedCount; ?></span></button>
            <?php if ($updateCount > 0): ?>
            <button class="abs-tab" data-filter="update">可更新 <span class="abs-tab-count abs-count-update"><?php echo $updateCount; ?></span></button>
            <?php endif; ?>
            <button class="abs-tab" data-filter="notinstalled">未安装</button>
        </div>
    </div>

    <!-- 插件卡片网格 -->
    <div class="abs-grid" id="abs-grid">
        <?php if (empty($plugins)): ?>
        <div class="abs-empty">
            <span class="abs-icon abs-icon-lg">inventory_2</span>
            <p>暂无插件数据，请点击「刷新列表」从 GitHub 拉取</p>
        </div>
        <?php else: ?>
        <?php foreach ($plugins as $p):
            $pid      = isset($p['id'])          ? $p['id']          : '';
            $pname    = isset($p['name'])         ? $p['name']        : $pid;
            $pdesc    = isset($p['description'])  ? $p['description'] : '';
            $pauthor  = isset($p['author'])       ? $p['author']      : '';
            $pauthorU = isset($p['authorUrl'])    ? $p['authorUrl']   : '';
            $pver     = isset($p['version'])      ? $p['version']     : '';
            $prepo    = isset($p['repo'])         ? $p['repo']        : '';
            $pdir     = isset($p['directory'])    ? $p['directory']   : '';
            $psubDir  = isset($p['subDirectory']) ? $p['subDirectory'] : '';
            $phome    = isset($p['homepage'])     ? $p['homepage']    : '';
            $ptags    = isset($p['tags'])         ? (array)$p['tags'] : array();
            $pbranch  = isset($p['branch'])       ? $p['branch']      : 'main';

            $isInstalled = $pdir && in_array($pdir, $installedDirs);
            $localVer    = $isInstalled && isset($installedMap[$pdir]) ? $installedMap[$pdir] : '';
            $hasUpdate   = $isInstalled && $pver && $localVer && version_compare($pver, $localVer, '>');

            $cardClass = 'abs-card';
            if ($isInstalled) $cardClass .= ' abs-card-installed';
            if ($hasUpdate)   $cardClass .= ' abs-card-update';
        ?>
        <div class="<?php echo $cardClass; ?>"
             data-id="<?php echo htmlspecialchars($pid); ?>"
             data-dir="<?php echo htmlspecialchars($pdir); ?>"
             data-installed="<?php echo $isInstalled ? '1' : '0'; ?>"
             data-has-update="<?php echo $hasUpdate ? '1' : '0'; ?>"
             data-filter-tags="<?php echo htmlspecialchars(implode(' ', $ptags)); ?>">

            <div class="abs-card-header">
                <div class="abs-card-avatar">
                    <?php echo htmlspecialchars(mb_substr($pname, 0, 1, 'UTF-8')); ?>
                </div>
                <div class="abs-card-meta">
                    <div class="abs-card-name"><?php echo htmlspecialchars($pname); ?></div>
                    <div class="abs-card-author">
                        <?php if ($pauthorU): ?>
                        <a href="<?php echo htmlspecialchars($pauthorU); ?>" target="_blank" rel="noopener"><?php echo htmlspecialchars($pauthor); ?></a>
                        <?php else: echo htmlspecialchars($pauthor); endif; ?>
                    </div>
                </div>
                <div class="abs-card-badges">
                    <?php if ($hasUpdate): ?>
                    <span class="abs-badge abs-badge-update">新版本 <?php echo htmlspecialchars($pver); ?></span>
                    <?php elseif ($isInstalled): ?>
                    <span class="abs-badge abs-badge-installed">已安装</span>
                    <?php endif; ?>
                </div>
            </div>

            <div class="abs-card-desc"><?php echo htmlspecialchars($pdesc); ?></div>

            <?php if (!empty($ptags)): ?>
            <div class="abs-card-tags">
                <?php foreach ($ptags as $tag): ?>
                <span class="abs-tag"><?php echo htmlspecialchars($tag); ?></span>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>

            <div class="abs-card-footer">
                <div class="abs-card-ver">
                    <?php if ($isInstalled && $localVer): ?>
                        <?php if ($hasUpdate): ?>
                        <span title="本地版本"><?php echo htmlspecialchars($localVer); ?></span>
                        <span class="abs-icon abs-icon-sm">arrow_forward</span>
                        <span class="abs-ver-new" title="最新版本"><?php echo htmlspecialchars($pver); ?></span>
                        <?php else: ?>
                        <span title="已安装版本"><?php echo htmlspecialchars($localVer); ?></span>
                        <?php endif; ?>
                    <?php elseif ($pver): ?>
                    <span><?php echo htmlspecialchars($pver); ?></span>
                    <?php endif; ?>
                    <?php if ($prepo): ?>
                    <a href="https://github.com/<?php echo htmlspecialchars($prepo); ?>" target="_blank" rel="noopener" class="abs-card-repo" title="GitHub 仓库">
                        <span class="abs-icon abs-icon-sm">code</span>
                    </a>
                    <?php endif; ?>
                    <?php if ($phome): ?>
                    <a href="<?php echo htmlspecialchars($phome); ?>" target="_blank" rel="noopener" class="abs-card-repo" title="插件主页">
                        <span class="abs-icon abs-icon-sm">open_in_new</span>
                    </a>
                    <?php endif; ?>
                </div>
                <div class="abs-card-actions">
                    <?php if ($hasUpdate): ?>
                    <button class="abs-btn abs-btn-filled abs-action-btn"
                            data-action="upgrade"
                            data-id="<?php echo htmlspecialchars($pid); ?>"
                            data-dir="<?php echo htmlspecialchars($pdir); ?>"
                            data-repo="<?php echo htmlspecialchars($prepo); ?>"
                            data-branch="<?php echo htmlspecialchars($pbranch); ?>"
                            data-subdir="<?php echo htmlspecialchars($psubDir); ?>">
                        <span class="abs-icon">system_update</span>升级
                    </button>
                    <button class="abs-btn abs-btn-text abs-action-btn"
                            data-action="uninstall"
                            data-id="<?php echo htmlspecialchars($pid); ?>"
                            data-dir="<?php echo htmlspecialchars($pdir); ?>">
                        <span class="abs-icon">delete_outline</span>卸载
                    </button>
                    <?php elseif ($isInstalled): ?>
                    <button class="abs-btn abs-btn-tonal abs-action-btn"
                            data-action="uninstall"
                            data-id="<?php echo htmlspecialchars($pid); ?>"
                            data-dir="<?php echo htmlspecialchars($pdir); ?>">
                        <span class="abs-icon">delete_outline</span>卸载
                    </button>
                    <?php else: ?>
                    <button class="abs-btn abs-btn-filled abs-action-btn"
                            data-action="install"
                            data-id="<?php echo htmlspecialchars($pid); ?>"
                            data-dir="<?php echo htmlspecialchars($pdir); ?>"
                            data-repo="<?php echo htmlspecialchars($prepo); ?>"
                            data-branch="<?php echo htmlspecialchars($pbranch); ?>"
                            data-subdir="<?php echo htmlspecialchars($psubDir); ?>">
                        <span class="abs-icon">download</span>安装
                    </button>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
        <?php endif; ?>
    </div>

    <!-- 操作进度遮罩 -->
    <div id="abs-progress" class="abs-progress-overlay" style="display:none">
        <div class="abs-progress-card">
            <div class="abs-spinner"></div>
            <p id="abs-progress-msg">处理中…</p>
        </div>
    </div>

    <!-- 卸载确认对话框 -->
    <div id="abs-uninstall-dialog" class="abs-dialog-overlay" style="display:none" role="dialog" aria-modal="true">
        <div class="abs-dialog">
            <h3 class="abs-dialog-title"><span class="abs-icon">warning</span>确认卸载</h3>
            <p class="abs-dialog-body">即将卸载 <strong id="abs-uninstall-name"></strong>，插件目录将移入 AB-Store 的 backup 目录。</p>
            <div class="abs-dialog-footer">
                <button class="abs-btn abs-btn-text" id="abs-uninstall-cancel">取消</button>
                <button class="abs-btn abs-btn-tonal" id="abs-uninstall-backup">移入备份</button>
                <button class="abs-btn abs-btn-filled abs-btn-danger" id="abs-uninstall-delete">彻底删除</button>
            </div>
        </div>
    </div>
</div>

<script>
(function(){
    var CFG = window.__ABS_CFG__ || {};
    var ajaxUrl = document.getElementById('abs-root').dataset.ajax;
    var token   = document.getElementById('abs-root').dataset.token;

    // ── 工具函数 ──
    function absPost(do_, data, cb){
        var body = new FormData();
        body.append('do', do_);
        body.append('_', token);
        for(var k in data) body.append(k, data[k]);
        fetch(ajaxUrl, {method:'POST', body: body})
            .then(function(r){ return r.json(); })
            .then(cb)
            .catch(function(e){ cb({code:500, message: e.message || '网络错误'}); });
    }

    function showProgress(msg){
        document.getElementById('abs-progress').style.display = 'flex';
        document.getElementById('abs-progress-msg').textContent = msg || '处理中…';
    }

    function hideProgress(){
        document.getElementById('abs-progress').style.display = 'none';
    }

    function absToast(msg, type){
        var el = document.createElement('div');
        el.className = 'abs-toast abs-toast-' + (type || 'info');
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(function(){ el.classList.add('abs-toast-show'); }, 10);
        setTimeout(function(){
            el.classList.remove('abs-toast-show');
            setTimeout(function(){ el.parentNode && el.parentNode.removeChild(el); }, 300);
        }, 3500);
    }

    // ── 刷新列表 ──
    document.getElementById('abs-refresh-btn').addEventListener('click', function(){
        showProgress('正在从 GitHub 拉取最新插件列表…');
        absPost('refresh', {}, function(res){
            hideProgress();
            if(res.code === 0){
                absToast('插件列表已更新', 'success');
                setTimeout(function(){ location.reload(); }, 800);
            } else {
                absToast(res.message || '刷新失败', 'error');
            }
        });
    });

    // ── 搜索 ──
    var searchEl = document.getElementById('abs-search');
    searchEl.addEventListener('input', function(){
        filterCards();
    });

    // ── Tab 切换 ──
    var activeFilter = 'all';
    document.getElementById('abs-tabs').addEventListener('click', function(e){
        var tab = e.target.closest('.abs-tab');
        if(!tab) return;
        document.querySelectorAll('.abs-tab').forEach(function(t){ t.classList.remove('abs-tab-active'); });
        tab.classList.add('abs-tab-active');
        activeFilter = tab.dataset.filter;
        filterCards();
    });

    function filterCards(){
        var query = searchEl.value.trim().toLowerCase();
        document.querySelectorAll('.abs-card').forEach(function(card){
            var name   = (card.querySelector('.abs-card-name')   || {}).textContent || '';
            var author = (card.querySelector('.abs-card-author') || {}).textContent || '';
            var tags   = card.dataset.filterTags || '';
            var text   = (name + ' ' + author + ' ' + tags).toLowerCase();
            var matchQ = !query || text.indexOf(query) !== -1;
            var matchF = true;
            if(activeFilter === 'installed')    matchF = card.dataset.installed === '1';
            if(activeFilter === 'notinstalled') matchF = card.dataset.installed !== '1';
            if(activeFilter === 'update')       matchF = card.dataset.hasUpdate === '1';
            card.style.display = (matchQ && matchF) ? '' : 'none';
        });
    }

    // ── 操作按钮 ──
    var pendingUninstall = null;

    document.getElementById('abs-grid').addEventListener('click', function(e){
        var btn = e.target.closest('.abs-action-btn');
        if(!btn) return;
        var action  = btn.dataset.action;
        var id      = btn.dataset.id;
        var dir     = btn.dataset.dir;
        var repo    = btn.dataset.repo    || '';
        var branch  = btn.dataset.branch  || 'main';
        var subdir  = btn.dataset.subdir  || '';
        var name    = btn.closest('.abs-card').querySelector('.abs-card-name').textContent;

        if(action === 'install'){
            showProgress('正在安装 ' + name + '…');
            absPost('install', {id:id, dir:dir, repo:repo, branch:branch, subdir:subdir}, function(res){
                hideProgress();
                if(res.code === 0){
                    absToast('安装成功：' + name, 'success');
                    setTimeout(function(){ location.reload(); }, 800);
                } else {
                    absToast('安装失败：' + (res.message || '未知错误'), 'error');
                }
            });
        } else if(action === 'upgrade'){
            showProgress('正在升级 ' + name + '…');
            absPost('upgrade', {id:id, dir:dir, repo:repo, branch:branch, subdir:subdir}, function(res){
                hideProgress();
                if(res.code === 0){
                    absToast('升级成功：' + name, 'success');
                    setTimeout(function(){ location.reload(); }, 800);
                } else {
                    absToast('升级失败：' + (res.message || '未知错误'), 'error');
                }
            });
        } else if(action === 'uninstall'){
            // 显示确认对话框
            pendingUninstall = {id:id, dir:dir, name:name};
            document.getElementById('abs-uninstall-name').textContent = name;
            var dlg = document.getElementById('abs-uninstall-dialog');
            dlg.style.display = 'flex';
            requestAnimationFrame(function(){ dlg.classList.add('abs-dialog-open'); });
        }
    });

    // 卸载对话框按钮
    function closeUninstallDialog(){
        var dlg = document.getElementById('abs-uninstall-dialog');
        dlg.classList.remove('abs-dialog-open');
        setTimeout(function(){ dlg.style.display = 'none'; pendingUninstall = null; }, 250);
    }

    document.getElementById('abs-uninstall-cancel').addEventListener('click', closeUninstallDialog);

    document.getElementById('abs-uninstall-backup').addEventListener('click', function(){
        if(!pendingUninstall) return;
        closeUninstallDialog();
        showProgress('正在卸载 ' + pendingUninstall.name + '（移入备份）…');
        absPost('uninstall', {id: pendingUninstall.id, dir: pendingUninstall.dir, permanent:'0'}, function(res){
            hideProgress();
            if(res.code === 0){
                absToast('已卸载并备份：' + pendingUninstall.name, 'success');
                setTimeout(function(){ location.reload(); }, 800);
            } else {
                absToast('卸载失败：' + (res.message || '未知错误'), 'error');
            }
        });
    });

    document.getElementById('abs-uninstall-delete').addEventListener('click', function(){
        if(!pendingUninstall) return;
        closeUninstallDialog();
        showProgress('正在彻底删除 ' + pendingUninstall.name + '…');
        absPost('uninstall', {id: pendingUninstall.id, dir: pendingUninstall.dir, permanent:'1'}, function(res){
            hideProgress();
            if(res.code === 0){
                absToast('已彻底删除：' + pendingUninstall.name, 'success');
                setTimeout(function(){ location.reload(); }, 800);
            } else {
                absToast('删除失败：' + (res.message || '未知错误'), 'error');
            }
        });
    });

    // 点击遮罩关闭对话框
    document.getElementById('abs-uninstall-dialog').addEventListener('click', function(e){
        if(e.target === this) closeUninstallDialog();
    });
})();
</script>
        <?php
    }

    // ================================================================
    //  数据工具方法
    // ================================================================

    /**
     * 加载缓存的插件注册表（若缓存过期则返回空数组，刷新由 Action 负责）
     */
    public static function loadCachedRegistry()
    {
        $file = self::cacheFile();
        if (!file_exists($file)) {
            // 首次访问时尝试立即拉取
            $remote = self::fetchRemoteRegistry();
            if ($remote) {
                $remote['_cached_at'] = time();
                @file_put_contents($file, json_encode($remote, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
                return $remote;
            }
            return array('plugins' => array());
        }
        $data = @json_decode(file_get_contents($file), true);
        return is_array($data) ? $data : array('plugins' => array());
    }

    /**
     * 从 GitHub 拉取最新 JSON
     */
    public static function fetchRemoteRegistry()
    {
        $ctx = stream_context_create(array(
            'http' => array(
                'timeout'    => 15,
                'user_agent' => 'AB-Store/1.0 Typecho-Plugin (+https://github.com/lhl77/Typecho-Plugin-AdminBeautifyStore)',
                'header'     => "Accept: application/json\r\nCache-Control: no-cache\r\n",
            ),
            'ssl' => array(
                'verify_peer'      => false,
                'verify_peer_name' => false,
            ),
        ));
        $raw = @file_get_contents(self::REMOTE_JSON_URL, false, $ctx);
        if (!$raw) return null;
        $data = @json_decode($raw, true);
        return is_array($data) ? $data : null;
    }

    /**
     * 获取 Typecho plugins 目录下已有的目录名列表
     */
    public static function getInstalledPluginDirs()
    {
        $pluginsRoot = rtrim(__DIR__, '/\\') . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR;
        $dirs = array();
        if ($handle = @opendir($pluginsRoot)) {
            while (($entry = readdir($handle)) !== false) {
                if ($entry === '.' || $entry === '..') continue;
                if (is_dir($pluginsRoot . $entry)) {
                    $dirs[] = $entry;
                }
            }
            closedir($handle);
        }
        return $dirs;
    }

    /**
     * 构建 [目录名 => 版本号] 的映射，用于比较是否有更新
     * 版本号从插件 Plugin.php 的 @version 注释中读取
     */
    public static function buildInstalledVersionMap()
    {
        $pluginsRoot = rtrim(__DIR__, '/\\') . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR;
        $map = array();
        $dirs = self::getInstalledPluginDirs();
        foreach ($dirs as $dir) {
            $pluginFile = $pluginsRoot . $dir . DIRECTORY_SEPARATOR . 'Plugin.php';
            if (!file_exists($pluginFile)) continue;
            // 只读前 30 行即可找到 @version
            $fh = @fopen($pluginFile, 'r');
            if (!$fh) continue;
            $i = 0;
            while ($i++ < 30 && ($line = fgets($fh)) !== false) {
                if (preg_match('/@version\s+([^\s\*]+)/i', $line, $m)) {
                    $map[$dir] = trim($m[1]);
                    break;
                }
            }
            fclose($fh);
        }
        return $map;
    }

    // ================================================================
    //  内联 CSS（MD3 风格，全部使用 AdminBeautify 的 var(--md-*) 变量）
    // ================================================================
    public static function outputCSS()
    {
        ?>
#abs-root{position:relative;padding:0 0 32px;font-family:inherit;color:var(--md-on-surface,#1c1b1f)}
.abs-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.abs-toolbar-left,.abs-toolbar-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.abs-toolbar-title{display:flex;align-items:center;gap:6px;font-size:1.35rem;font-weight:600;color:var(--md-on-surface,#1c1b1f);letter-spacing:.01em}
.abs-toolbar-title .abs-icon{font-size:1.5rem;color:var(--md-primary,#6750a4)}
.abs-stat{font-size:.8rem;color:var(--md-on-surface-variant,#49454f);padding:2px 6px;border-radius:4px;background:var(--md-surface-container-low,#f7f2fa)}
.abs-stat-muted{opacity:.7}
.abs-badge{display:inline-flex;align-items:center;padding:2px 10px;border-radius:999px;font-size:.72rem;font-weight:600;line-height:1.6}
.abs-badge-installed{background:var(--md-secondary-container,#e8def8);color:var(--md-on-secondary-container,#1d192b)}
.abs-badge-update{background:var(--md-primary,#6750a4);color:var(--md-on-primary,#fff)}
.abs-filter-bar{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px}
.abs-search-wrap{position:relative;flex:1;min-width:200px;max-width:340px}
.abs-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:1.1rem;color:var(--md-on-surface-variant,#49454f);pointer-events:none}
.abs-search{width:100%;box-sizing:border-box;padding:8px 12px 8px 36px;border:1px solid var(--md-outline-variant,#cac4d0);border-radius:28px;background:var(--md-surface-container-low,#f7f2fa);color:var(--md-on-surface,#1c1b1f);font-size:.9rem;outline:none;transition:border-color .2s,box-shadow .2s}
.abs-search:focus{border-color:var(--md-primary,#6750a4);box-shadow:0 0 0 2px color-mix(in srgb,var(--md-primary,#6750a4) 20%,transparent)}
.abs-tabs{display:flex;gap:4px;flex-wrap:wrap}
.abs-tab{padding:6px 14px;border:1px solid var(--md-outline-variant,#cac4d0);border-radius:20px;background:transparent;color:var(--md-on-surface-variant,#49454f);font-size:.85rem;cursor:pointer;transition:background .15s,color .15s,border-color .15s;display:flex;align-items:center;gap:5px}
.abs-tab:hover{background:var(--md-surface-container,#ece6f0);border-color:var(--md-outline-variant,#cac4d0)}
.abs-tab-active{background:var(--md-primary-container,#eaddff);color:var(--md-on-primary-container,#21005d);border-color:transparent;font-weight:600}
.abs-tab-count{min-width:18px;height:18px;padding:0 5px;background:var(--md-surface-container,#ece6f0);color:var(--md-on-surface-variant,#49454f);border-radius:9px;font-size:.72rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
.abs-tab-active .abs-tab-count{background:var(--md-on-primary-container,#21005d);color:var(--md-primary-container,#eaddff)}
.abs-count-update{background:var(--md-primary,#6750a4)!important;color:#fff!important}
.abs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.abs-card{background:var(--md-surface-container-low,#f7f2fa);border:1px solid var(--md-outline-variant,#cac4d0);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:10px;transition:box-shadow .2s,transform .15s;position:relative}
.abs-card:hover{box-shadow:0 4px 16px color-mix(in srgb,var(--md-primary,#6750a4) 12%,transparent);transform:translateY(-1px)}
.abs-card-installed{border-color:var(--md-secondary-container,#e8def8);background:color-mix(in srgb,var(--md-secondary-container,#e8def8) 30%,var(--md-surface-container-low,#f7f2fa))}
.abs-card-update{border-color:var(--md-primary,#6750a4);background:color-mix(in srgb,var(--md-primary-container,#eaddff) 40%,var(--md-surface-container-low,#f7f2fa))}
.abs-card-header{display:flex;align-items:flex-start;gap:12px}
.abs-card-avatar{width:44px;height:44px;flex-shrink:0;background:var(--md-primary-container,#eaddff);color:var(--md-on-primary-container,#21005d);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:700;line-height:1}
.abs-card-meta{flex:1;min-width:0}
.abs-card-name{font-size:1rem;font-weight:600;color:var(--md-on-surface,#1c1b1f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.abs-card-author{font-size:.8rem;color:var(--md-on-surface-variant,#49454f);margin-top:2px}
.abs-card-author a{color:var(--md-primary,#6750a4);text-decoration:none}
.abs-card-author a:hover{text-decoration:underline}
.abs-card-badges{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.abs-card-desc{font-size:.85rem;color:var(--md-on-surface-variant,#49454f);line-height:1.5;flex:1;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.abs-card-tags{display:flex;flex-wrap:wrap;gap:5px}
.abs-tag{padding:2px 8px;background:var(--md-surface-container,#ece6f0);color:var(--md-on-surface-variant,#49454f);border-radius:999px;font-size:.72rem}
.abs-card-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:6px;border-top:1px solid var(--md-outline-variant,#cac4d0)}
.abs-card-ver{display:flex;align-items:center;gap:4px;font-size:.78rem;color:var(--md-on-surface-variant,#49454f)}
.abs-ver-new{color:var(--md-primary,#6750a4);font-weight:600}
.abs-card-repo{display:inline-flex;align-items:center;color:var(--md-on-surface-variant,#49454f);text-decoration:none;opacity:.7;transition:opacity .15s}
.abs-card-repo:hover{opacity:1}
.abs-card-actions{display:flex;gap:6px;flex-wrap:wrap}
.abs-btn{display:inline-flex;align-items:center;gap:4px;padding:7px 16px;border-radius:20px;font-size:.85rem;font-weight:500;cursor:pointer;border:none;transition:background .15s,box-shadow .15s,opacity .15s;white-space:nowrap}
.abs-btn:disabled{opacity:.5;cursor:not-allowed}
.abs-btn .abs-icon{font-size:1rem}
.abs-btn-filled{background:var(--md-primary,#6750a4);color:var(--md-on-primary,#fff)}
.abs-btn-filled:hover:not(:disabled){background:color-mix(in srgb,var(--md-primary,#6750a4) 90%,#000);box-shadow:0 2px 8px color-mix(in srgb,var(--md-primary,#6750a4) 40%,transparent)}
.abs-btn-danger{background:var(--md-error,#b3261e)!important;color:var(--md-on-error,#fff)!important}
.abs-btn-danger:hover:not(:disabled){background:color-mix(in srgb,var(--md-error,#b3261e) 85%,#000)!important}
.abs-btn-tonal{background:var(--md-secondary-container,#e8def8);color:var(--md-on-secondary-container,#1d192b)}
.abs-btn-tonal:hover:not(:disabled){background:color-mix(in srgb,var(--md-secondary-container,#e8def8) 80%,#000)}
.abs-btn-text{background:transparent;color:var(--md-primary,#6750a4);padding:7px 10px}
.abs-btn-text:hover:not(:disabled){background:color-mix(in srgb,var(--md-primary,#6750a4) 8%,transparent)}
.abs-icon{font-family:'Material Icons Round','Material Icons',sans-serif;font-style:normal;font-weight:normal;font-size:1.25rem;line-height:1;vertical-align:middle;display:inline-block;-webkit-font-smoothing:antialiased;user-select:none}
.abs-icon-sm{font-size:.95rem}
.abs-icon-lg{font-size:3rem;display:block;margin-bottom:8px;opacity:.4}
.abs-empty{grid-column:1/-1;padding:48px 24px;text-align:center;color:var(--md-on-surface-variant,#49454f)}
.abs-empty p{margin:0;font-size:.95rem}
.abs-progress-overlay{position:fixed;inset:0;z-index:9999;background:color-mix(in srgb,var(--md-surface,#fffbfe) 70%,transparent);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.abs-progress-card{background:var(--md-surface-container,#ece6f0);border-radius:28px;padding:32px 40px;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);min-width:220px}
.abs-progress-card p{margin:0;font-size:.95rem;color:var(--md-on-surface,#1c1b1f);text-align:center}
.abs-spinner{width:44px;height:44px;border:4px solid var(--md-surface-container-highest,#e6e0e9);border-top-color:var(--md-primary,#6750a4);border-radius:50%;animation:abs-spin .7s linear infinite}
@keyframes abs-spin{to{transform:rotate(360deg)}}
.abs-dialog-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s}
.abs-dialog-overlay.abs-dialog-open{opacity:1}
.abs-dialog{background:var(--md-surface-container-low,#f7f2fa);border-radius:28px;padding:28px 32px;width:100%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,.22);transform:scale(.92);transition:transform .25s;display:flex;flex-direction:column;gap:14px}
.abs-dialog-overlay.abs-dialog-open .abs-dialog{transform:scale(1)}
.abs-dialog-title{display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:600;margin:0;color:var(--md-on-surface,#1c1b1f)}
.abs-dialog-title .abs-icon{color:var(--md-error,#b3261e)}
.abs-dialog-body{margin:0;font-size:.9rem;color:var(--md-on-surface-variant,#49454f);line-height:1.55}
.abs-dialog-body strong{color:var(--md-on-surface,#1c1b1f)}
.abs-dialog-footer{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.abs-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);z-index:11000;padding:12px 24px;border-radius:8px;font-size:.9rem;font-weight:500;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;white-space:nowrap;max-width:90vw;text-overflow:ellipsis;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.18)}
.abs-toast-show{opacity:1;transform:translateX(-50%) translateY(0)}
.abs-toast-success{background:var(--md-primary-container,#eaddff);color:var(--md-on-primary-container,#21005d);border-left:4px solid var(--md-primary,#6750a4)}
.abs-toast-error{background:var(--md-error-container,#f9dedc);color:var(--md-on-error-container,#410e0b);border-left:4px solid var(--md-error,#b3261e)}
.abs-toast-info{background:var(--md-surface-container,#ece6f0);color:var(--md-on-surface,#1c1b1f);border-left:4px solid var(--md-outline-variant,#cac4d0)}
@media(max-width:600px){
.abs-grid{grid-template-columns:1fr}
.abs-toolbar{flex-direction:column;align-items:flex-start}
.abs-filter-bar{flex-direction:column;align-items:stretch}
.abs-search-wrap{max-width:100%}
.abs-dialog{margin:16px;padding:22px 20px}
}
        <?php
    }
}
