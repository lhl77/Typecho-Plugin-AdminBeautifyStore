<h1 align="center">AB 插件仓库</h1>
<p align="center">
  <img src="https://img.shields.io/badge/Typecho->=1.3.0-orange?style=flat-square" alt="Typecho 1.3.0">
  <img src="https://img.shields.io/badge/PHP-%3E%3D7.2-777BB4?style=flat-square&logo=php&logoColor=white" alt="PHP >= 7.2">
  <img src="https://img.shields.io/badge/design-Material%20Design%203-6750A4?style=flat-square&logo=materialdesign&logoColor=white" alt="Material Design 3">
  <a href="https://github.com/lhl77/Typecho-Plugin-AdminBeautifyStore/stargazers"><img src="https://img.shields.io/github/stars/lhl77/Typecho-Plugin-AdminBeautifyStore?style=flat-square&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/lhl77/Typecho-Plugin-AdminBeautifyStore/network/members"><img src="https://img.shields.io/github/forks/lhl77/Typecho-Plugin-AdminBeautifyStore?style=flat-square&logo=github" alt="GitHub Forks"></a>
</p>

<p align="center">
  <strong>Admin Beautify 主题美化插件 - 专用插件库</strong><br/>
  Admin Beautify： <a href="https://github.com/lhl77/Typecho-Plugin-AdminBeautify">lhl77/Typecho-Plugin-AdminBeautify</a>
</p>

---

|![](https://i.see.you/2026/03/13/e0Tx/0e1e75b9b979f3b800dee577a9436ec8.jpg)|
|---|
|<p align="center">截图</p>|

<div align="center">
<h2>投稿</h2>

直接发issue或提交PR即可，修改`plugins.json`添加你的插件信息。

|字段|必填|说明|
|----|----|----|
|id|	✅	|唯一标识符（建议与 directory 一致）|
|name|	✅	|显示名称|
|repo|	✅	|owner/repo，用于构造下载 URL 和 GitHub 链接|
|directory|	✅	|安装到 plugins/ 下的目录名|
|version|	✅	|最新版本号（用于更新检测）|
|branch|	❌	|默认 main，需要时填 master 等|
|subDirectory|	❌|	downloadUrl解压后`Plugin.php`所在子目录名|
|downloadUrl|	❌	|有直链时优先用此 URL（monorepo 必填）|
|author|	❌|	作者名|
|authorUrl|	❌|	作者主页|
|description|	❌|	插件描述|
|homepage|	❌	|插件主页|
|tags|	❌	|标签数组，用于筛选|
|changelog|	❌	|更新日志链接（目前仅存储，未使用）|

</div>
### 注意事项
1.`downloadUrl`不填默认获取`repo`内`{branch}`分支的内容，不考虑版本号
2.如果按照版本号分发请填写`downloadUrl`,如:`https://github.com/lhl77/Typecho-Plugin-AdminBeautify/archive/refs/tags/v2.1.16.zip`
3.填写`downloadUrl`时,一般需要配置`subDirectory`
4.`subDirectory`仅支持一级目录,不支持添加子目录(不然你下载的`zip`存在冗余信息浪费带宽)
