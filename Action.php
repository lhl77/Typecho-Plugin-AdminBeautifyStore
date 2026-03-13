<?php
/**
 * AB-Store AJAX Action 处理器
 *
 * 处理：install / uninstall / upgrade / refresh / checkUpdates
 */

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class AdminBeautifyStore_Action extends Typecho_Widget implements Widget_Interface_Do
{
    private $db;
    private $options;
    private $pluginOptions;

    public function __construct($request, $response, $params = NULL)
    {
        parent::__construct($request, $response, $params);
        $this->db      = Typecho_Db::get();
        $this->options = Typecho_Widget::widget('Widget_Options');
        try {
            $this->pluginOptions = $this->options->plugin('AdminBeautifyStore');
        } catch (Exception $e) {
            $this->pluginOptions = null;
        }
    }

    public function execute() {}

    // ================================================================
    //  入口路由
    // ================================================================

    public function action()
    {
        $this->checkAuth();

        $do = $this->request->get('do', '');
        switch ($do) {
            case 'install':
                $this->handleInstall();
                break;
            case 'uninstall':
                $this->handleUninstall();
                break;
            case 'upgrade':
                $this->handleUpgrade();
                break;
            case 'refresh':
                $this->handleRefresh();
                break;
            case 'checkUpdates':
                $this->handleCheckUpdates();
                break;
            case 'togglePlugin':
                $this->handleTogglePlugin();
                break;
            default:
                $this->jsonError('未知操作', 400);
        }
    }

    // ================================================================
    //  具体操作
    // ================================================================

    /**
     * 安装插件：下载 GitHub ZIP → 解压到 plugins 目录
     */
    private function handleInstall()
    {
        $this->checkAdmin();

        $repo    = trim($this->request->get('repo', ''));
        $branch  = trim($this->request->get('branch', 'main'));
        $dir     = trim($this->request->get('dir', ''));
        $subdir  = trim($this->request->get('subdir', ''));
        $downloadUrl = trim($this->request->get('downloadUrl', ''));

        if (empty($repo) || empty($dir)) {
            $this->jsonError('缺少参数 repo / dir', 400);
        }

        $targetDir = $this->pluginsRoot() . $dir;
        if (is_dir($targetDir)) {
            $this->jsonError('插件目录已存在，请先卸载', 409);
        }

        // 优先使用 downloadUrl（如 monorepo 的 Release 直链），否则回退到 GitHub archive
        $isDirect = !empty($downloadUrl);
        $zipUrl   = $isDirect ? $downloadUrl : "https://github.com/{$repo}/archive/refs/heads/{$branch}.zip";
        $result = $this->downloadAndExtract($zipUrl, $repo, $branch, $dir, $subdir, $targetDir, $isDirect);

        if ($result !== true) {
            $this->jsonError($result, 500);
        }

        $this->jsonSuccess(array('dir' => $dir), '安装成功');
    }

    /**
     * 卸载插件
     * permanent=1 → 彻底删除；permanent=0 → 移入 backup 目录
     */
    private function handleUninstall()
    {
        $this->checkAdmin();

        $dir       = trim($this->request->get('dir', ''));
        $permanent = $this->request->get('permanent', '0') === '1';

        if (empty($dir)) {
            $this->jsonError('缺少参数 dir', 400);
        }

        // 安全检查：不允许路径穿越
        if (strpos($dir, '..') !== false || strpos($dir, '/') !== false || strpos($dir, '\\') !== false) {
            $this->jsonError('非法目录名', 400);
        }

        $targetDir = $this->pluginsRoot() . $dir;
        if (!is_dir($targetDir)) {
            $this->jsonError('插件目录不存在', 404);
        }

        if ($permanent) {
            $ok = $this->deleteDirectory($targetDir);
            if (!$ok) {
                $this->jsonError('彻底删除失败，请检查文件权限', 500);
            }
        } else {
            // 移入 backup 目录
            $backupBase = AdminBeautifyStore_Plugin::backupDir();
            if (!is_dir($backupBase)) {
                @mkdir($backupBase, 0755, true);
            }
            $dest = $backupBase . $dir . '_' . date('Ymd_His');
            $ok   = @rename($targetDir, $dest);
            if (!$ok) {
                // rename 跨分区时会失败，尝试复制+删除
                if ($this->copyDirectory($targetDir, $dest)) {
                    $this->deleteDirectory($targetDir);
                    $ok = true;
                }
            }
            if (!$ok) {
                $this->jsonError('移入备份失败，请检查文件权限', 500);
            }
        }

        $this->jsonSuccess(array('dir' => $dir, 'permanent' => $permanent), '卸载成功');
    }

    /**
     * 升级插件：备份旧版本 → 下载新版本
     */
    private function handleUpgrade()
    {
        $this->checkAdmin();

        $repo   = trim($this->request->get('repo', ''));
        $branch = trim($this->request->get('branch', 'main'));
        $dir    = trim($this->request->get('dir', ''));
        $subdir = trim($this->request->get('subdir', ''));
        $downloadUrl = trim($this->request->get('downloadUrl', ''));

        if (empty($repo) || empty($dir)) {
            $this->jsonError('缺少参数 repo / dir', 400);
        }

        $targetDir = $this->pluginsRoot() . $dir;

        // 1. 备份旧版本
        if (is_dir($targetDir)) {
            // 升级 AdminBeautifyStore 自身时，backupDir() 在插件目录内部，
            // 无法将父目录 rename/copy 到其子目录，改为直接放在 plugins 根目录下
            if ($dir === 'AdminBeautifyStore') {
                $backupDest = $this->pluginsRoot() . $dir . '_bak_' . date('Ymd_His');
            } else {
                $backupBase = AdminBeautifyStore_Plugin::backupDir();
                if (!is_dir($backupBase)) {
                    @mkdir($backupBase, 0755, true);
                }
                $backupDest = $backupBase . $dir . '_bak_' . date('Ymd_His');
            }
            if (!@rename($targetDir, $backupDest)) {
                if (!$this->copyDirectory($targetDir, $backupDest)) {
                    $this->jsonError('备份旧版本失败', 500);
                }
                $this->deleteDirectory($targetDir);
            }
        }

        // 2. 下载新版本（优先使用 downloadUrl 直链，否则回退到 GitHub archive）
        $isDirect = !empty($downloadUrl);
        $zipUrl   = $isDirect ? $downloadUrl : "https://github.com/{$repo}/archive/refs/heads/{$branch}.zip";
        $result = $this->downloadAndExtract($zipUrl, $repo, $branch, $dir, $subdir, $targetDir, $isDirect);

        if ($result !== true) {
            $this->jsonError($result, 500);
        }

        $this->jsonSuccess(array('dir' => $dir), '升级成功');
    }

    /**
     * 强制刷新远程 JSON 缓存
     */
    private function handleRefresh()
    {
        $this->checkAdmin();

        $data = AdminBeautifyStore_Plugin::fetchRemoteRegistry();
        if (!$data) {
            $this->jsonError('无法获取远程数据，请检查服务器网络或 GitHub 是否可访问', 502);
        }
        $data['_cached_at'] = time();
        $cacheFile = AdminBeautifyStore_Plugin::cacheFile();
        $saved = @file_put_contents($cacheFile, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        if ($saved === false) {
            $this->jsonError('缓存写入失败，请检查 plugins/AdminBeautifyStore 目录写权限', 500);
        }
        $count = isset($data['plugins']) ? count($data['plugins']) : 0;
        $this->jsonSuccess(array('count' => $count, 'updated' => $data['updated'] ?? ''), "已拉取 {$count} 个插件");
    }

    /**
     * 检测更新（供 footer JS 调用，返回有更新的插件列表）
     * 使用缓存，不重新拉取
     */
    private function handleCheckUpdates()
    {
        $this->checkAuth();

        $registry = AdminBeautifyStore_Plugin::loadCachedRegistry();
        $plugins  = isset($registry['plugins']) ? $registry['plugins'] : array();
        $installedMap = AdminBeautifyStore_Plugin::buildInstalledVersionMap();

        $updates = array();
        foreach ($plugins as $p) {
            $dir      = isset($p['directory']) ? $p['directory'] : '';
            $remoteVer = isset($p['version'])  ? $p['version']   : '';
            if (!$dir || !isset($installedMap[$dir])) continue;
            $localVer = $installedMap[$dir];
            if ($remoteVer && $localVer && version_compare($remoteVer, $localVer, '>')) {
                $updates[] = array(
                    'id'         => $p['id']   ?? $dir,
                    'name'       => $p['name'] ?? $dir,
                    'localVer'   => $localVer,
                    'remoteVer'  => $remoteVer,
                );
            }
        }

        $this->jsonSuccess(array(
            'updates'    => $updates,
            'hasUpdates' => count($updates) > 0,
            'count'      => count($updates),
        ), count($updates) > 0 ? '发现 ' . count($updates) . ' 个插件有更新' : '已是最新版本');
    }

    /**
     * 启用 / 禁用插件（toggle）
     * do=togglePlugin & dir={目录名} & enable=1|0
     *
     * 依赖 Typecho 1.3+ 的命名空间类；
     * 若在 1.2 下运行（Typecho_Plugin 别名体系），会通过 class_exists 判断后降级为跳转方案。
     */
    private function handleTogglePlugin()
    {
        $this->checkAdmin();

        $dir    = trim($this->request->get('dir', ''));
        $enable = $this->request->get('enable', '1') === '1';

        if (empty($dir)) {
            $this->jsonError('缺少参数 dir', 400);
        }
        // 安全：不允许路径穿越
        if (strpos($dir, '..') !== false || strpos($dir, '/') !== false || strpos($dir, '\\') !== false) {
            $this->jsonError('非法目录名', 400);
        }

        // 检查插件目录是否存在
        $pluginsRoot  = $this->pluginsRoot();
        $pluginDir    = $pluginsRoot . $dir;
        if (!is_dir($pluginDir)) {
            $this->jsonError('插件目录不存在', 404);
        }

        // 开始输出缓冲，防止插件的 activate/deactivate/config 方法中的 echo 污染 JSON 响应
        $obLevel = ob_get_level();
        ob_start();

        try {
            // Typecho 1.3+ 使用命名空间 Plugin 类
            if (!class_exists('Typecho\\Plugin')) {
                while (ob_get_level() > $obLevel) ob_end_clean();
                $this->jsonError('当前 Typecho 版本不支持此操作，请在插件管理页手动操作', 501);
            }

            $pluginState   = \Typecho\Plugin::export();
            $activated     = isset($pluginState['activated']) ? $pluginState['activated'] : array();
            $isActivated   = array_key_exists($dir, $activated);

            if ($enable && $isActivated) {
                while (ob_get_level() > $obLevel) ob_end_clean();
                $this->jsonError('插件已处于启用状态', 409);
            }
            if (!$enable && !$isActivated) {
                while (ob_get_level() > $obLevel) ob_end_clean();
                $this->jsonError('插件已处于禁用状态', 409);
            }

            // 找到插件入口文件
            [$pluginFileName, $className] = \Typecho\Plugin::portal($dir, $this->options->pluginDir);

            if ($enable) {
                // ── 启用 ──
                $info = \Typecho\Plugin::parseInfo($pluginFileName);
                if (!\Typecho\Plugin::checkDependence($info['since'])) {
                    while (ob_get_level() > $obLevel) ob_end_clean();
                    $this->jsonError('插件不兼容当前 Typecho 版本', 400);
                }
                require_once $pluginFileName;
                if (!class_exists($className) || !method_exists($className, 'activate')) {
                    while (ob_get_level() > $obLevel) ob_end_clean();
                    $this->jsonError('插件类或 activate() 方法不存在', 500);
                }
                $result = call_user_func([$className, 'activate']);
                \Typecho\Plugin::activate($dir);

                // 持久化
                $this->db->query(
                    $this->db->update('table.options')
                        ->rows(['value' => json_encode(\Typecho\Plugin::export())])
                        ->where('name = ?', 'plugins')
                );

                // 初始化默认配置（若插件有 config 且 DB 中无记录）
                // 使用独立的输出缓冲，防止 config() 的 echo 被外层缓冲吃掉后混入响应
                if (method_exists($className, 'config')) {
                    ob_start();
                    try {
                        $form = new \Typecho\Widget\Helper\Form();
                        call_user_func([$className, 'config'], $form);
                        $opts = $form->getValues();
                    } catch (\Exception $ce) {
                        $opts = array();
                    } finally {
                        ob_end_clean();
                    }
                    if ($opts) {
                        try {
                            $this->options->plugin($dir);
                        } catch (\Typecho\Plugin\Exception $e) {
                            $this->db->query(
                                $this->db->insert('table.options')
                                    ->rows(['name' => 'plugin:' . $dir, 'value' => serialize($opts), 'user' => 0])
                            );
                        }
                    }
                }

                $msg = is_string($result) ? $result : '插件已启用';
                while (ob_get_level() > $obLevel) ob_end_clean();
                $this->jsonSuccess(array('dir' => $dir, 'activated' => true), $msg);

            } else {
                // ── 禁用 ──
                require_once $pluginFileName;
                if (class_exists($className) && method_exists($className, 'deactivate')) {
                    $result = call_user_func([$className, 'deactivate']);
                }
                \Typecho\Plugin::deactivate($dir);

                // 持久化
                $this->db->query(
                    $this->db->update('table.options')
                        ->rows(['value' => json_encode(\Typecho\Plugin::export())])
                        ->where('name = ?', 'plugins')
                );

                $msg = isset($result) && is_string($result) ? $result : '插件已禁用';

                // 若禁用的是 AdminBeautifyStore 本身，前端需跳转到 plugins.php
                // 因为 deactivate() 已从 DB 移除了 panel，reload 回原 panel URL 会 404
                $data = array('dir' => $dir, 'activated' => false);
                if ($dir === 'AdminBeautifyStore') {
                    $data['redirect'] = Typecho_Common::url('/admin/plugins.php', $this->options->index);
                }

                while (ob_get_level() > $obLevel) ob_end_clean();
                $this->jsonSuccess($data, $msg);
            }

        } catch (\Typecho\Plugin\Exception $e) {
            while (ob_get_level() > $obLevel) ob_end_clean();
            $this->jsonError($e->getMessage(), 500);
        } catch (\Typecho\Widget\Exception $e) {
            while (ob_get_level() > $obLevel) ob_end_clean();
            $this->jsonError($e->getMessage(), 500);
        } catch (\Exception $e) {
            while (ob_get_level() > $obLevel) ob_end_clean();
            $this->jsonError($e->getMessage(), 500);
        }
    }

    // ================================================================
    //  内部工具
    // ================================================================

    /**
     * 下载 GitHub ZIP 并解压到目标目录
     *
     * @param string $zipUrl    下载 URL
     * @param string $repo      owner/repo 格式
     * @param string $branch    分支名
     * @param string $dir       目标目录名（不含路径）
     * @param string $subdir    ZIP 内子目录名（为空则直接解压）
     * @param string $targetDir 完整目标路径
     * @param bool   $isDirect  true = 直链 ZIP（Release），自动探测内部目录结构；false = GitHub archive ZIP
     * @return true|string      成功返回 true，失败返回错误消息
     */
    private function downloadAndExtract($zipUrl, $repo, $branch, $dir, $subdir, $targetDir, $isDirect = false)
    {
        if (!class_exists('ZipArchive')) {
            return 'PHP ZipArchive 扩展未安装，无法解压 ZIP';
        }

        // 下载 ZIP 到临时文件
        $tmpFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'abs_' . md5($zipUrl . time()) . '.zip';

        $ctx = stream_context_create(array(
            'http' => array(
                'timeout'         => 60,
                'follow_location' => 1,
                'max_redirects'   => 5,
                'user_agent'      => 'AB-Store/1.0 (+https://github.com/lhl77/Typecho-Plugin-AdminBeautifyStore)',
                'header'          => "Accept: application/zip\r\n",
            ),
            'ssl' => array(
                'verify_peer'      => false,
                'verify_peer_name' => false,
            ),
        ));

        $zipContent = @file_get_contents($zipUrl, false, $ctx);
        if ($zipContent === false || strlen($zipContent) < 100) {
            return "下载失败：{$zipUrl}";
        }

        if (@file_put_contents($tmpFile, $zipContent) === false) {
            return '无法写入临时文件：' . $tmpFile;
        }

        // 解压
        $zip = new ZipArchive();
        if ($zip->open($tmpFile) !== true) {
            @unlink($tmpFile);
            return 'ZIP 文件损坏或无法打开';
        }

        // GitHub ZIP 内根目录名通常为 "{repo_name}-{branch}"
        $repoParts   = explode('/', $repo);
        $repoName    = end($repoParts);
        $zipRootDir  = $repoName . '-' . $branch . '/';

        if ($isDirect) {
            // 直链 ZIP（Release 包）：自动探测公共根目录
            // 若所有条目均以同一目录开头则剥离该前缀，否则直接解压到根
            $srcPrefix = '';
            if ($zip->numFiles > 0) {
                $first    = $zip->getNameIndex(0);
                $slashPos = strpos($first, '/');
                if ($slashPos !== false) {
                    $potentialRoot = substr($first, 0, $slashPos + 1); // e.g. "Sitemap/"
                    $allMatch = true;
                    for ($j = 1; $j < $zip->numFiles; $j++) {
                        if (strpos($zip->getNameIndex($j), $potentialRoot) !== 0) {
                            $allMatch = false;
                            break;
                        }
                    }
                    if ($allMatch) {
                        $srcPrefix = $potentialRoot;
                    }
                }
            }
        } else {
            // GitHub archive ZIP：前缀为 "{repoName}-{branch}[/{subdir}]/"
            // 如果有 subDirectory，源路径前缀为 "{zipRootDir}{subdir}/"
            $srcPrefix = $zipRootDir;
            if (!empty($subdir)) {
                $srcPrefix .= trim($subdir, '/') . '/';
            }
        }

        // 创建目标目录
        if (!is_dir($targetDir)) {
            @mkdir($targetDir, 0755, true);
        }

        $extracted = false;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $entry = $zip->getNameIndex($i);

            // 必须以 $srcPrefix 开头
            if (strpos($entry, $srcPrefix) !== 0) continue;

            // 相对于 $srcPrefix 的路径
            $relative = substr($entry, strlen($srcPrefix));
            if ($relative === '' || $relative === false) continue;

            // 安全检查：防路径穿越
            if (strpos($relative, '..') !== false) continue;

            $destPath = $targetDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative);

            if (substr($entry, -1) === '/') {
                // 目录
                if (!is_dir($destPath)) {
                    @mkdir($destPath, 0755, true);
                }
            } else {
                // 文件
                $destDirPath = dirname($destPath);
                if (!is_dir($destDirPath)) {
                    @mkdir($destDirPath, 0755, true);
                }
                @file_put_contents($destPath, $zip->getFromIndex($i));
                $extracted = true;
            }
        }

        $zip->close();
        @unlink($tmpFile);

        if (!$extracted) {
            // 尝试不带 subdir 前缀直接解压（兜底）
            return "ZIP 解压失败：未在前缀 [{$srcPrefix}] 下找到有效文件，请检查 subDirectory / downloadUrl 配置";
        }

        return true;
    }

    /**
     * 递归删除目录
     */
    private function deleteDirectory($dir)
    {
        if (!is_dir($dir)) return true;
        $items = scandir($dir);
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $path = $dir . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                $this->deleteDirectory($path);
            } else {
                @unlink($path);
            }
        }
        return @rmdir($dir);
    }

    /**
     * 递归复制目录
     */
    private function copyDirectory($src, $dest)
    {
        if (!is_dir($dest)) {
            if (!@mkdir($dest, 0755, true)) return false;
        }
        $items = @scandir($src);
        if (!$items) return false;
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $s = $src  . DIRECTORY_SEPARATOR . $item;
            $d = $dest . DIRECTORY_SEPARATOR . $item;
            if (is_dir($s)) {
                if (!$this->copyDirectory($s, $d)) return false;
            } else {
                if (!@copy($s, $d)) return false;
            }
        }
        return true;
    }

    /**
     * Typecho plugins 根目录（含末尾分隔符）
     */
    private function pluginsRoot()
    {
        return rtrim(__DIR__, '/\\') . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR;
    }

    // ================================================================
    //  Auth / JSON 响应工具
    // ================================================================

    private function checkAuth()
    {
        try {
            if (!Typecho_Widget::widget('Widget_User')->hasLogin()) {
                $this->jsonError('请先登录', 401);
            }
        } catch (Exception $e) {
            $this->jsonError('认证失败', 401);
        }
    }

    private function checkAdmin()
    {
        try {
            $user = Typecho_Widget::widget('Widget_User');
            if (!$user->hasLogin()) {
                $this->jsonError('请先登录', 401);
            }
            // 仅管理员可操作
            if ($user->pass('administrator', true) === false) {
                $this->jsonError('权限不足，仅管理员可操作', 403);
            }
        } catch (Exception $e) {
            $this->jsonError('认证失败：' . $e->getMessage(), 403);
        }
    }

    private function jsonSuccess($data = array(), $message = 'OK')
    {
        $this->response->throwJson(array(
            'code'    => 0,
            'message' => $message,
            'data'    => $data,
        ));
    }

    private function jsonError($message = 'Error', $code = 500)
    {
        $this->response->throwJson(array(
            'code'    => $code,
            'message' => $message,
            'data'    => null,
        ));
    }
}
