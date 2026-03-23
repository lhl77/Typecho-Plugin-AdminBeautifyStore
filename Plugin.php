<?php
/**
 * AB-Store — AdminBeautify 插件仓库
 * 在 Typecho 后台浏览、安装、升级、卸载插件，适配 AdminBeautify MD3 主题
 *
 * @package   AB-Store
 * @author    LHL
 * @version   1.0.17
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
        Utils\Helper::addPanel(1, 'AdminBeautifyStore/Panel.php', 'AB插件仓库', '插件仓库', 'administrator');

        // 注入脚部 JS（更新检测）
        Typecho_Plugin::factory('admin/footer.php')->begin = array(__CLASS__, 'injectFooter');

        // 初始化插件配置，避免访问"设置"页时抛出"配置信息没有找到"
        Utils\Helper::configPlugin('AdminBeautifyStore', array('_v' => '1', 'cdnMode' => 'github'));

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
        // 隐藏字段：确保 DB 选项始终非空（防止"配置信息没有找到"）
        $hidden = new Typecho_Widget_Helper_Form_Element_Hidden('_v', null, '1');
        $form->addInput($hidden);

        // CDN 模式设置
        $cdnMode = new Typecho_Widget_Helper_Form_Element_Radio(
            'cdnMode',
            array(
                'github'    => '直接连接 GitHub（默认）',
                'jsdelivr'  => '通过 jsDelivr CDN（访问 raw.githubusercontent.com 受限时推荐）',
            ),
            'github',
            '插件列表获取方式',
            '仅影响「刷新列表」时的 plugins.json 拉取地址；插件安装/升级仍通过 GitHub 直接下载 ZIP。'
        );
        $form->addInput($cdnMode);

        // 提示用户通过侧边栏访问
        $panelUrl = Typecho_Widget::widget('Widget_Options')->adminUrl
            . 'extending.php?panel=' . urlencode('AdminBeautifyStore/Panel.php');
        echo '<p style="margin:8px 0 0;color:var(--md-on-surface-variant,#49454f)">'
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

        // 读取缓存时间戳，供前端判断是否需要自动刷新
        $cacheFile = self::cacheFile();
        $cachedAt  = 0;
        if (file_exists($cacheFile)) {
            $cacheData = @json_decode(file_get_contents($cacheFile), true);
            $cachedAt  = isset($cacheData['_cached_at']) ? intval($cacheData['_cached_at']) : 0;
        }

        echo '<script>';
        echo 'window.__ABS_CFG__=' . json_encode(array(
            'ajaxUrl'       => $ajaxUrl,
            'token'         => $token,
            'pluginUrl'     => Typecho_Common::url('AdminBeautifyStore/', $options->pluginUrl),
            'installedMap'  => $installedMap,
            'activatedMap'  => self::buildActivatedMap(),
            'storeUrl'      => $options->adminUrl . 'extending.php?panel=' . urlencode('AdminBeautifyStore/Panel.php'),
            'cachedAt'      => $cachedAt,
        ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ';';
        // 所有后台页面：缓存超过 10 分钟时静默刷新；Store 页额外触发页面重载以更新展示
        echo <<<'JS'
(function(){
    // 前端自动刷新已移至 update-check.js（调用 checkUpdates，服务端 stale-while-revalidate 负责后台续期缓存）
    // 此处仅保留空函数，以防旧版 JS 引用
})();
JS;
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
        $pluginsUrl = $options->adminUrl . 'plugins.php';

        // 读取缓存的 JSON
        $registry = self::loadCachedRegistry();
        $plugins  = isset($registry['plugins']) ? $registry['plugins'] : array();

        // 已安装插件目录列表
        $installedDirs = self::getInstalledPluginDirs();
        $installedMap  = self::buildInstalledVersionMap();
        $activatedMap  = self::buildActivatedMap();

        // 统计
        $totalCount     = count($plugins);
        $installedCount = 0;
        $activeCount    = 0;
        $disabledCount  = 0;
        $updateCount    = 0;
        foreach ($plugins as $p) {
            $dir = isset($p['directory']) ? $p['directory'] : '';
            if ($dir && in_array($dir, $installedDirs)) {
                $installedCount++;
                if (isset($activatedMap[$dir])) {
                    $activeCount++;
                } else {
                    $disabledCount++;
                }
                $remoteVer  = isset($p['version']) ? $p['version'] : '';
                $localVer   = isset($installedMap[$dir]) ? $installedMap[$dir] : '';
                if ($remoteVer && $localVer && version_compare($remoteVer, $localVer, '>')) {
                    $updateCount++;
                }
            }
        }

        $cachedAt  = isset($registry['_cached_at']) ? intval($registry['_cached_at']) : 0;

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
<div id="abs-root" data-ajax="<?php echo htmlspecialchars($ajaxUrl); ?>" data-token="<?php echo htmlspecialchars($token); ?>" data-cached-at="<?php echo $cachedAt; ?>">

    <!-- 顶部工具栏 -->
    <div class="abs-toolbar">
        <div class="abs-toolbar-left">
            <span class="abs-toolbar-title">
                <span class="abs-icon">store</span>AB插件仓库
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
            <a href="https://github.com/lhl77/Typecho-Plugin-AdminBeautifyStore" target="_blank" rel="noopener" class="abs-btn abs-btn-text" title="向 AB插件仓库 提交插件">
                <span class="abs-icon">add_circle_outline</span>投稿
            </a>
            <a href="<?php echo htmlspecialchars($pluginsUrl); ?>" class="abs-btn abs-btn-text" title="前往 Typecho 插件管理页">
                <span class="abs-icon">extension</span>插件管理
            </a>
            <select id="abs-sort-sel" class="abs-sort-sel" title="排序方式">
                <option value="alpha-asc">名称 A→Z</option>
                <option value="alpha-desc">名称 Z→A</option>
                <option value="default">默认顺序</option>
            </select>
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
            <button class="abs-tab" data-filter="active">启用中 <span class="abs-tab-count"><?php echo $activeCount; ?></span></button>
            <?php if ($disabledCount > 0): ?>
            <button class="abs-tab" data-filter="disabled">已禁用 <span class="abs-tab-count"><?php echo $disabledCount; ?></span></button>
            <?php endif; ?>
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
        <?php $pIdx = 0; foreach ($plugins as $p): $pIdx++;
            $pid      = isset($p['id'])          ? $p['id']          : '';
            $pname    = isset($p['name'])         ? $p['name']        : $pid;
            $pdesc    = isset($p['description'])  ? $p['description'] : '';
            $pauthor  = isset($p['author'])       ? $p['author']      : '';
            $pauthorU = isset($p['authorUrl'])    ? $p['authorUrl']   : '';
            $pver     = isset($p['version'])      ? $p['version']     : '';
            $prepo    = isset($p['repo'])         ? $p['repo']        : '';
            $pdir     = isset($p['directory'])    ? $p['directory']   : '';
            $psubDir      = isset($p['subDirectory']) ? $p['subDirectory'] : '';
            $pdownloadUrl = isset($p['downloadUrl'])  ? $p['downloadUrl']  : '';
            $phome    = isset($p['homepage'])     ? $p['homepage']    : '';
            $ptags    = isset($p['tags'])         ? (array)$p['tags'] : array();
            $pbranch  = isset($p['branch'])       ? $p['branch']      : 'main';

            $isInstalled  = $pdir && in_array($pdir, $installedDirs);
            $isActivated  = $isInstalled && isset($activatedMap[$pdir]);
            $localVer     = $isInstalled && isset($installedMap[$pdir]) ? $installedMap[$pdir] : '';
            $hasUpdate    = $isInstalled && $pver && $localVer && version_compare($pver, $localVer, '>');
            // 是否为自身（禁用/卸载自身会产生循环依赖，需特殊处理）
            $isSelf       = ($pdir === 'AdminBeautifyStore');
            // 只对已激活且插件具有 config() 方法的插件显示"设置"按钮
            // 使用 \Typecho\Plugin::parseInfo() 做 token 分析而非 class_exists()：
            //   1. Typecho 1.3+ 插件使用命名空间（TypechoPlugin\{Dir}\Plugin），class_exists('{Dir}_Plugin') 恒为 false
            //   2. 插件类在渲染页面时未被 require，Plugin::init() 只加载钩子数据，不加载插件文件
            $hasConfig    = false;
            if ($isActivated && $pdir) {
                $pluginFile = defined('__TYPECHO_PLUGIN_DIR__')
                    ? __TYPECHO_ROOT_DIR__ . '/' . __TYPECHO_PLUGIN_DIR__ . '/' . $pdir . '/Plugin.php'
                    : __DIR__ . '/../' . $pdir . '/Plugin.php';
                if (file_exists($pluginFile)) {
                    try {
                        $pluginInfo = \Typecho\Plugin::parseInfo($pluginFile);
                        $hasConfig  = !empty($pluginInfo['config']);
                    } catch (\Exception $e) {
                        $hasConfig = false;
                    }
                }
            }
            $settingsUrl  = $hasConfig
                ? $options->adminUrl . 'options-plugin.php?config=' . urlencode($pdir)
                : '';
            $cardClass = 'abs-card';
            if ($isInstalled && $isActivated) $cardClass .= ' abs-card-active';
            if ($isInstalled && !$isActivated) $cardClass .= ' abs-card-disabled';
            if ($hasUpdate)   $cardClass .= ' abs-card-update';
        ?>
        <div class="<?php echo $cardClass; ?>"
             data-index="<?php echo $pIdx; ?>"
             data-id="<?php echo htmlspecialchars($pid); ?>"
             data-dir="<?php echo htmlspecialchars($pdir); ?>"
             data-installed="<?php echo $isInstalled ? '1' : '0'; ?>"
             data-activated="<?php echo $isActivated ? '1' : '0'; ?>"
             data-has-update="<?php echo $hasUpdate ? '1' : '0'; ?>"
             data-filter-tags="<?php echo htmlspecialchars(implode(' ', $ptags)); ?>">

            <div class="abs-card-header">
                <div class="abs-card-avatar<?php echo $isInstalled && !$isActivated ? ' abs-avatar-disabled' : ''; ?>">
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
                <div class="abs-card-badge-wrap">
                    <?php if ($hasUpdate): ?>
                    <span class="abs-badge abs-badge-update">新版本 <?php echo htmlspecialchars($pver); ?></span>
                    <?php elseif ($isActivated): ?>
                    <span class="abs-badge abs-badge-active"><span class="abs-icon" style="font-size:.75rem">check_circle</span>启用中</span>
                    <?php elseif ($isInstalled): ?>
                    <span class="abs-badge abs-badge-disabled">已禁用</span>
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
                            data-subdir="<?php echo htmlspecialchars($psubDir); ?>"
                            data-downloadurl="<?php echo htmlspecialchars($pdownloadUrl); ?>">
                        <span class="abs-icon">system_update</span>升级
                    </button>
                    <?php if ($isActivated): ?>
                    <?php if ($settingsUrl): ?>
                    <a href="<?php echo htmlspecialchars($settingsUrl); ?>" class="abs-btn abs-btn-text" title="插件设置">
                        <span class="abs-icon">settings</span>设置
                    </a>
                    <?php endif; ?>
                    <?php if ($isSelf): ?>
                    <a href="<?php echo htmlspecialchars($pluginsUrl); ?>" class="abs-btn abs-btn-text" title="在 Typecho 插件管理页禁用或卸载">
                        <span class="abs-icon">open_in_new</span>管理
                    </a>
                    <?php else: ?>
                    <button class="abs-btn abs-btn-text abs-action-btn"
                            data-action="disable"
                            data-id="<?php echo htmlspecialchars($pid); ?>"
                            data-dir="<?php echo htmlspecialchars($pdir); ?>">
                        <span class="abs-icon">pause_circle_outline</span>禁用
                    </button>
                    <?php endif; ?>
                    <?php endif; ?>
                    <?php if (!$isActivated && !$isSelf): ?>
                    <button class="abs-btn abs-btn-text abs-action-btn abs-btn-danger-text"
                            data-action="uninstall"
                            data-id="<?php echo htmlspecialchars($pid); ?>"
                            data-dir="<?php echo htmlspecialchars($pdir); ?>">
                        <span class="abs-icon">delete_outline</span>卸载
                    </button>
                    <?php endif; ?>
                    <?php elseif ($isInstalled): ?>
                    <?php if ($isActivated): ?>
                    <?php if ($settingsUrl): ?>
                    <a href="<?php echo htmlspecialchars($settingsUrl); ?>" class="abs-btn abs-btn-text" title="插件设置">
                        <span class="abs-icon">settings</span>设置
                    </a>
                    <?php endif; ?>
                    <?php if ($isSelf): ?>
                    <a href="<?php echo htmlspecialchars($pluginsUrl); ?>" class="abs-btn abs-btn-text" title="在 Typecho 插件管理页禁用或卸载">
                        <span class="abs-icon">open_in_new</span>管理
                    </a>
                    <?php else: ?>
                    <button class="abs-btn abs-btn-tonal abs-action-btn"
                            data-action="disable"
                            data-id="<?php echo htmlspecialchars($pid); ?>"
                            data-dir="<?php echo htmlspecialchars($pdir); ?>">
                        <span class="abs-icon">pause_circle_outline</span>禁用
                    </button>
                    <?php endif; ?>
                    <?php else: ?>
                    <button class="abs-btn abs-btn-filled abs-action-btn"
                            data-action="enable"
                            data-id="<?php echo htmlspecialchars($pid); ?>"
                            data-dir="<?php echo htmlspecialchars($pdir); ?>">
                        <span class="abs-icon">play_circle_outline</span>启用
                    </button>
                    <?php if (!$isSelf): ?>
                    <button class="abs-btn abs-btn-text abs-action-btn abs-btn-danger-text"
                            data-action="uninstall"
                            data-id="<?php echo htmlspecialchars($pid); ?>"
                            data-dir="<?php echo htmlspecialchars($pdir); ?>">
                        <span class="abs-icon">delete_outline</span>卸载
                    </button>
                    <?php endif; ?>
                    <?php endif; ?>
                    <?php else: ?>
                    <button class="abs-btn abs-btn-filled abs-action-btn"
                            data-action="install"
                            data-id="<?php echo htmlspecialchars($pid); ?>"
                            data-dir="<?php echo htmlspecialchars($pdir); ?>"
                            data-repo="<?php echo htmlspecialchars($prepo); ?>"
                            data-branch="<?php echo htmlspecialchars($pbranch); ?>"
                            data-subdir="<?php echo htmlspecialchars($psubDir); ?>"
                            data-downloadurl="<?php echo htmlspecialchars($pdownloadUrl); ?>">
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

    // ── 将 overlay 移到 body，避免祖先 transform 破坏 position:fixed 定位 ──
    ['abs-progress', 'abs-uninstall-dialog'].forEach(function(id){
        var el = document.getElementById(id);
        if (el && el.parentNode !== document.body) document.body.appendChild(el);
    });

    // ── 工具函数 ──
    function absNavigate(url){
        // extending.php 面板页含复杂内联脚本，AJAX innerHTML 替换后脚本不会重新执行，
        // 故强制走全页跳转；AdminBeautify 本身也将 extending.php 排除出 AJAX 导航。
        var isExtending = (url || '').indexOf('extending.php') !== -1;
        if(!isExtending && window.AdminBeautify && typeof AdminBeautify._navigateTo === 'function' && AdminBeautify._ajaxNavActive){
            AdminBeautify._navigateTo(url, url === location.href);
        } else {
            location.href = url;
        }
    }

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
        absPost('refresh', {force: '1'}, function(res){
            hideProgress();
            if(res.code === 0){
                absToast('插件列表已更新', 'success');
                setTimeout(function(){ location.reload(); }, 800);
            } else {
                absToast(res.message || '刷新失败', 'error');
            }
        });
    });

    // ── 排序 ──
    var sortSel = document.getElementById('abs-sort-sel');
    var savedSort = (typeof localStorage !== 'undefined' && localStorage.getItem('abs-sort')) || 'alpha-asc';
    sortSel.value = savedSort;

    function sortCards(order) {
        var grid = document.getElementById('abs-grid');
        var cards = Array.prototype.slice.call(grid.querySelectorAll('.abs-card'));
        cards.sort(function(a, b) {
            if (order === 'default') {
                return parseInt(a.dataset.index || 0, 10) - parseInt(b.dataset.index || 0, 10);
            }
            var na = ((a.querySelector('.abs-card-name') || {}).textContent || '').trim();
            var nb = ((b.querySelector('.abs-card-name') || {}).textContent || '').trim();
            var cmp = na.localeCompare(nb, 'zh-CN');
            return order === 'alpha-asc' ? cmp : -cmp;
        });
        cards.forEach(function(c) { grid.appendChild(c); });
    }

    sortCards(savedSort);

    sortSel.addEventListener('change', function() {
        var v = sortSel.value;
        try { localStorage.setItem('abs-sort', v); } catch(e) {}
        sortCards(v);
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
            if(activeFilter === 'active')       matchF = card.dataset.activated === '1';
            if(activeFilter === 'disabled')     matchF = card.dataset.installed === '1' && card.dataset.activated !== '1';
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
        var downloadUrl = btn.dataset.downloadurl || '';
        var cardEl  = btn.closest('.abs-card');
        var name    = cardEl && cardEl.querySelector('.abs-card-name')
                      ? cardEl.querySelector('.abs-card-name').textContent
                      : (dir || id || '');

        if(action === 'install'){
            showProgress('正在安装 ' + name + '…');
            absPost('install', {id:id, dir:dir, repo:repo, branch:branch, subdir:subdir, downloadUrl:downloadUrl}, function(res){
                hideProgress();
                if(res.code === 0){
                    absToast('安装成功：' + name, 'success');
                    setTimeout(function(){ absNavigate(location.href); }, 800);
                } else {
                    absToast('安装失败：' + (res.message || '未知错误'), 'error');
                }
            });
        } else if(action === 'upgrade'){
            showProgress('正在升级 ' + name + '…');
            absPost('upgrade', {id:id, dir:dir, repo:repo, branch:branch, subdir:subdir, downloadUrl:downloadUrl}, function(res){
                hideProgress();
                if(res.code === 0){
                    absToast('升级成功：' + name, 'success');
                    setTimeout(function(){ absNavigate(location.href); }, 800);
                } else {
                    absToast('升级失败：' + (res.message || '未知错误'), 'error');
                }
            });
        } else if(action === 'enable'){
            showProgress('正在启用 ' + name + '…');
            absPost('togglePlugin', {dir:dir, enable:'1'}, function(res){
                hideProgress();
                if(res.code === 0){
                    absToast(res.message || '已启用：' + name, 'success');
                    setTimeout(function(){ absNavigate(location.href); }, 800);
                } else {
                    absToast('启用失败：' + (res.message || '未知错误'), 'error');
                }
            });
        } else if(action === 'disable'){
            showProgress('正在禁用 ' + name + '…');
            absPost('togglePlugin', {dir:dir, enable:'0'}, function(res){
                hideProgress();
                if(res.code === 0){
                    absToast(res.message || '已禁用：' + name, 'success');
                    var redirectUrl = res.data && res.data.redirect ? res.data.redirect : null;
                    setTimeout(function(){ absNavigate(redirectUrl || location.href); }, 800);
                } else {
                    absToast('禁用失败：' + (res.message || '未知错误'), 'error');
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
        // 先快照，closeUninstallDialog 内的 setTimeout 会将 pendingUninstall 置 null（250ms后）
        // 而 AJAX 回调通常在 250ms 之后才触发，届时 pendingUninstall 已为 null，故必须提前保存
        var pName = pendingUninstall.name;
        var pId   = pendingUninstall.id;
        var pDir  = pendingUninstall.dir;
        closeUninstallDialog();
        showProgress('正在卸载 ' + pName + '（移入备份）…');
        absPost('uninstall', {id: pId, dir: pDir, permanent:'0'}, function(res){
            hideProgress();
            if(res.code === 0){
                absToast('已卸载并备份：' + pName, 'success');
                setTimeout(function(){ absNavigate(location.href); }, 800);
            } else {
                absToast('卸载失败：' + (res.message || '未知错误'), 'error');
            }
        });
    });

    document.getElementById('abs-uninstall-delete').addEventListener('click', function(){
        if(!pendingUninstall) return;
        // 同上，提前快照防止异步回调时 pendingUninstall 已被置 null
        var pName = pendingUninstall.name;
        var pId   = pendingUninstall.id;
        var pDir  = pendingUninstall.dir;
        closeUninstallDialog();
        showProgress('正在彻底删除 ' + pName + '…');
        absPost('uninstall', {id: pId, dir: pDir, permanent:'1'}, function(res){
            hideProgress();
            if(res.code === 0){
                absToast('已彻底删除：' + pName, 'success');
                setTimeout(function(){ absNavigate(location.href); }, 800);
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
            // 无缓存时返回空结构，由后台 stale-while-revalidate 异步填充，避免阻塞页面
            return array('plugins' => array());
        }
        $data = @json_decode(file_get_contents($file), true);
        return is_array($data) ? $data : array('plugins' => array());
    }

    /**
     * 根据 CDN 设置返回 plugins.json 的拉取地址
     */
    public static function getRegistryUrl()
    {
        try {
            $opts = Typecho_Widget::widget('Widget_Options')->plugin('AdminBeautifyStore');
            $mode = isset($opts->cdnMode) ? $opts->cdnMode : 'github';
        } catch (Exception $e) {
            $mode = 'github';
        }
        if ($mode === 'jsdelivr') {
            return 'https://cdn.jsdelivr.net/gh/lhl77/Typecho-Plugin-AdminBeautifyStore@main/plugins.json';
        }
        return self::REMOTE_JSON_URL;
    }

    /**
     * 从远端拉取最新 JSON（支持 GitHub 镜像兜底，每节点 8s 超时）
     */
    public static function fetchRemoteRegistry()
    {
        $baseUrl = self::getRegistryUrl();

        // jsDelivr CDN 无需镜像，直接请求（timeout 适当放宽到 16s）
        if (strpos($baseUrl, 'jsdelivr.net') !== false) {
            return self::_httpGetJson($baseUrl, 16);
        }

        // raw.githubusercontent.com → 依次尝试直连 + 镜像代理
        $mirrors = array(
            '',                       // 直连（优先）
            'https://gh-proxy.top/',
            'https://ghfast.top/',
            'https://ghproxy.com/',
        );
        foreach ($mirrors as $prefix) {
            $data = self::_httpGetJson($prefix . $baseUrl, 8);
            if ($data !== null) return $data;
        }
        return null;
    }

    /**
     * 内部工具：HTTP GET 拉取 JSON，失败返回 null
     */
    private static function _httpGetJson($url, $timeout = 8)
    {
        $ctx = stream_context_create(array(
            'http' => array(
                'timeout'    => $timeout,
                'user_agent' => 'AB-Store/1.0 Typecho-Plugin (+https://github.com/lhl77/Typecho-Plugin-AdminBeautifyStore)',
                'header'     => "Accept: application/json\r\nCache-Control: no-cache\r\n",
            ),
            'ssl' => array(
                'verify_peer'      => false,
                'verify_peer_name' => false,
            ),
        ));
        $raw = @file_get_contents($url, false, $ctx);
        if (!$raw || strlen($raw) < 10) return null;
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

    /**
     * 构建 [目录名 => bool] 的激活状态映射
     * 依赖 Typecho 1.3+ 的 \Typecho\Plugin::export()
     */
    public static function buildActivatedMap()
    {
        $map = array();
        try {
            if (class_exists('Typecho\\Plugin')) {
                $state     = \Typecho\Plugin::export();
                $activated = isset($state['activated']) ? $state['activated'] : array();
                foreach (array_keys($activated) as $pluginName) {
                    $map[$pluginName] = true;
                }
            }
        } catch (Exception $e) {
            // 静默失败，返回空映射
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
.abs-badge-active{background:var(--md-tertiary-container,#c4eed0);color:var(--md-on-tertiary-container,#002114);display:inline-flex;align-items:center;gap:3px}
.abs-badge-disabled{background:var(--md-surface-container,#ece6f0);color:var(--md-on-surface-variant,#49454f)}
.abs-filter-bar{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px}
.abs-search-wrap{position:relative;flex:1;min-width:200px;max-width:340px}
.abs-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:1.1rem;color:var(--md-on-surface-variant,#49454f);pointer-events:none;z-index:1}
#abs-root .abs-search{display:block!important;width:100%!important;box-sizing:border-box!important;padding:8px 12px 8px 36px!important;border:1px solid var(--md-outline-variant,#cac4d0)!important;border-radius:28px!important;background:var(--md-surface-container-low,#f7f2fa)!important;color:var(--md-on-surface,#1c1b1f)!important;font-size:.9rem!important;font-family:inherit!important;line-height:1.5!important;height:auto!important;outline:none!important;box-shadow:none!important;-webkit-appearance:none!important;appearance:none!important;transition:border-color .2s,box-shadow .2s}
#abs-root .abs-search:focus{border-color:var(--md-primary,#6750a4)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--md-primary,#6750a4) 20%,transparent)!important}
.abs-tabs{display:flex;gap:4px;flex-wrap:wrap}
.abs-tab{padding:6px 14px;border:1px solid var(--md-outline-variant,#cac4d0);border-radius:20px;background:transparent;color:var(--md-on-surface-variant,#49454f);font-size:.85rem;cursor:pointer;transition:background .15s,color .15s,border-color .15s;display:flex;align-items:center;gap:5px}
.abs-tab:hover{background:var(--md-surface-container,#ece6f0);border-color:var(--md-outline-variant,#cac4d0)}
.abs-tab-active{background:var(--md-primary-container,#eaddff);color:var(--md-on-primary-container,#21005d);border-color:transparent;font-weight:600}
.abs-tab-count{min-width:18px;height:18px;padding:0 5px;background:var(--md-surface-container,#ece6f0);color:var(--md-on-surface-variant,#49454f);border-radius:9px;font-size:.72rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
.abs-tab-active .abs-tab-count{background:var(--md-on-primary-container,#21005d);color:var(--md-primary-container,#eaddff)}
.abs-count-update{background:var(--md-primary,#6750a4)!important;color:#fff!important}
.abs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.abs-card{background:var(--md-surface-container-low,#f7f2fa);border:1.5px solid var(--md-outline-variant,#cac4d0);border-radius:20px;padding:16px 18px 14px;display:flex;flex-direction:column;gap:8px;transition:box-shadow .2s,transform .15s,border-color .2s;position:relative;overflow:hidden}
.abs-card:hover{box-shadow:0 3px 12px color-mix(in srgb,var(--md-primary,#6750a4) 14%,transparent);transform:translateY(-1px);border-color:color-mix(in srgb,var(--md-outline-variant,#cac4d0) 70%,var(--md-primary,#6750a4))}
.abs-card-installed{border-color:var(--md-secondary-container,#e8def8);background:color-mix(in srgb,var(--md-secondary-container,#e8def8) 30%,var(--md-surface-container-low,#f7f2fa))}
.abs-card-update{border-color:var(--md-primary,#6750a4);background:color-mix(in srgb,var(--md-primary-container,#eaddff) 40%,var(--md-surface-container-low,#f7f2fa))}
.abs-card-active{border-color:color-mix(in srgb,var(--md-tertiary-container,#c4eed0) 80%,var(--md-tertiary,#006e42));background:color-mix(in srgb,var(--md-tertiary-container,#c4eed0) 28%,var(--md-surface-container-low,#f7f2fa))}
.abs-card-disabled{border-color:var(--md-outline-variant,#cac4d0);background:var(--md-surface-container-lowest,#fffbfe);opacity:.75}
.abs-avatar-disabled{background:var(--md-surface-container-highest,#e6e0e9)!important;color:var(--md-on-surface-variant,#49454f)!important}
.abs-card-header{display:flex;align-items:center;gap:12px}
.abs-card-avatar{width:46px;height:46px;flex-shrink:0;background:var(--md-primary-container,#eaddff);color:var(--md-on-primary-container,#21005d);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;line-height:1;letter-spacing:-.02em}
.abs-card-meta{flex:1;min-width:0}
.abs-card-name{font-size:.97rem;font-weight:600;color:var(--md-on-surface,#1c1b1f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}
.abs-card-author{font-size:.78rem;color:var(--md-on-surface-variant,#49454f);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.abs-card-author a{color:var(--md-primary,#6750a4);text-decoration:none}
.abs-card-author a:hover{text-decoration:underline}
.abs-card-badge-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0}
.abs-card-desc{font-size:.84rem;color:var(--md-on-surface-variant,#49454f);line-height:1.55;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.6em}
.abs-card-tags{display:flex;flex-wrap:wrap;gap:4px}
.abs-tag{padding:2px 9px;background:var(--md-surface-container,#ece6f0);color:var(--md-on-surface-variant,#49454f);border-radius:999px;font-size:.7rem;font-weight:500;letter-spacing:.01em}
.abs-card-footer{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:10px;border-top:1px solid var(--md-outline-variant,#cac4d0);flex-wrap:wrap}
.abs-card-ver{display:flex;align-items:center;gap:4px;font-size:.76rem;color:var(--md-on-surface-variant,#49454f);flex-shrink:0;min-width:0;max-width:50%}
.abs-card-ver span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.abs-ver-new{color:var(--md-primary,#6750a4);font-weight:600}
.abs-card-repo{display:inline-flex;align-items:center;color:var(--md-on-surface-variant,#49454f);text-decoration:none;opacity:.6;transition:opacity .15s}
.abs-card-repo:hover{opacity:1}
.abs-card-actions{display:flex;gap:4px;flex-wrap:nowrap;align-items:center;flex-shrink:0}
.abs-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:20px;font-size:.82rem;font-weight:500;cursor:pointer;border:none;transition:background .15s,box-shadow .15s,opacity .15s;white-space:nowrap}
.abs-btn:disabled{opacity:.5;cursor:not-allowed}
.abs-btn .abs-icon{font-size:1rem}
.abs-btn-filled{background:var(--md-primary,#6750a4);color:var(--md-on-primary,#fff)}
.abs-btn-filled:hover:not(:disabled){background:color-mix(in srgb,var(--md-primary,#6750a4) 90%,#000);box-shadow:0 2px 8px color-mix(in srgb,var(--md-primary,#6750a4) 40%,transparent)}
.abs-btn-danger{background:var(--md-error,#b3261e)!important;color:var(--md-on-error,#fff)!important}
.abs-btn-danger:hover:not(:disabled){background:color-mix(in srgb,var(--md-error,#b3261e) 85%,#000)!important}
.abs-btn-tonal{background:var(--md-secondary-container,#e8def8);color:var(--md-on-secondary-container,#1d192b)}
.abs-btn-tonal:hover:not(:disabled){background:color-mix(in srgb,var(--md-secondary-container,#e8def8) 80%,#000)}
.abs-sort-sel{padding:5px 28px 5px 10px;border:1px solid var(--md-outline-variant,#cac4d0);border-radius:20px;background:var(--md-surface-container-low,#f7f2fa) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2349454f' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;color:var(--md-on-surface,#1c1b1f);font-size:.82rem;font-weight:500;cursor:pointer;outline:none;-webkit-appearance:none;appearance:none;transition:border-color .15s;height:auto;line-height:1.5}
.abs-sort-sel:focus{border-color:var(--md-primary,#6750a4);box-shadow:0 0 0 2px color-mix(in srgb,var(--md-primary,#6750a4) 18%,transparent)}
.abs-btn-text{background:transparent;color:var(--md-primary,#6750a4);padding:6px 8px}
.abs-btn-text:hover:not(:disabled){background:color-mix(in srgb,var(--md-primary,#6750a4) 8%,transparent)}
.abs-btn-danger-text{background:transparent;color:var(--md-error,#b3261e);padding:6px 8px}
.abs-btn-danger-text:hover:not(:disabled){background:color-mix(in srgb,var(--md-error,#b3261e) 8%,transparent)}
.abs-icon{font-family:'Material Icons Round','Material Icons',sans-serif;font-style:normal;font-weight:normal;font-size:1.25rem;line-height:1;vertical-align:middle;display:inline-block;-webkit-font-smoothing:antialiased;user-select:none}
.abs-icon-sm{font-size:.95rem}
.abs-icon-lg{font-size:3rem;display:block;margin-bottom:8px;opacity:.4}
.abs-empty{grid-column:1/-1;padding:48px 24px;text-align:center;color:var(--md-on-surface-variant,#49454f)}
.abs-empty p{margin:0;font-size:.95rem}
.abs-progress-overlay{position:fixed;inset:0;z-index:9999;background:color-mix(in srgb,var(--md-surface,#fffbfe) 70%,transparent);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.abs-progress-card{background:var(--md-surface-container,#ece6f0);border-radius:28px;padding:32px 40px;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);min-width:220px;max-width:90vw;box-sizing:border-box}
.abs-progress-card p{margin:0;font-size:.95rem;color:var(--md-on-surface,#1c1b1f);text-align:center}
.abs-spinner{width:44px;height:44px;border:4px solid var(--md-surface-container-highest,#e6e0e9);border-top-color:var(--md-primary,#6750a4);border-radius:50%;animation:abs-spin .7s linear infinite}
@keyframes abs-spin{to{transform:rotate(360deg)}}
.abs-dialog-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s;padding:16px;box-sizing:border-box}
.abs-dialog-overlay.abs-dialog-open{opacity:1}
.abs-dialog{background:var(--md-surface-container-low,#f7f2fa);border-radius:28px;padding:28px 32px;width:100%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,.22);transform:scale(.92);transition:transform .25s;display:flex;flex-direction:column;gap:14px;box-sizing:border-box}
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
.abs-dialog-overlay{padding:12px;align-items:flex-end}
.abs-dialog{border-radius:24px 24px 16px 16px;padding:24px 18px;max-width:100%;transform:translateY(20px) scale(1)}
.abs-dialog-overlay.abs-dialog-open .abs-dialog{transform:translateY(0) scale(1)}
.abs-dialog-footer{flex-direction:column-reverse;align-items:stretch}
.abs-dialog-footer .abs-btn{width:100%;justify-content:center}
.abs-progress-card{padding:28px 24px;border-radius:24px}
.abs-toast{bottom:16px;padding:10px 18px;font-size:.85rem}
}
        <?php
    }
}
