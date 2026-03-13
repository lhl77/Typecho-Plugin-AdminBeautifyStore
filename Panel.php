<?php
/**
 * AB-Store 插件仓库 - 侧边栏独立面板
 *
 * 通过 Helper::addPanel(1, 'AdminBeautifyStore/Panel.php', ...) 注册，
 * 在「控制台」菜单组下显示为独立侧边栏入口。
 */
if (!defined('__TYPECHO_ADMIN__')) {
    exit;
}

/* 引入后台公共布局 */
$adminPath = rtrim(__TYPECHO_ROOT_DIR__, '/') . __TYPECHO_ADMIN_DIR__;
include $adminPath . 'header.php';
include $adminPath . 'menu.php';
?>
<div class="main">
    <div class="body container">
        <?php include $adminPath . 'page-title.php'; ?>
        <div class="row typecho-page-main" role="main">
            <div class="col-mb-12">
                <?php AdminBeautifyStore_Plugin::renderStorePage(); ?>
            </div>
        </div>
    </div>
</div>
<?php include $adminPath . 'footer.php'; ?>
