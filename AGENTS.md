# 项目维护与写作规范

本文件供 Codex 等编码助手维护本仓库时参考。用户在当前会话中的明确要求优先于本文；已有授权不重复询问。项目为 Astro 5 静态博客，默认分支 `master`，站点地址以 `astro.config.mjs` 为准。

## 一、工作方式与范围

- 先查看 `git status`、相关代码和配置，再修改。保留已有改动，不重置、不覆盖用户工作。
- 以当前仓库为事实依据；不要套用其他博客的框架、命令、域名或目录。
- 用户要求同步其他文件时，检查与变更相关的文档、脚本、页面说明及资源产物；不为凑齐文件数改写文章、批量格式化或升级无关依赖。
- 已授权的修复、文档更新和本地验证直接完成。提交、push 按用户指令执行；不把 Git push 成功表述为线上部署已完成。
- 文档只描述已经实现的行为。区分当前功能、建议方案和实际验证，不写未经复测的性能数字。
- README 面向访客，仅保留博客介绍、主要栏目与访问入口；开发、写作、资源处理及发布规范集中维护在本文件。

## 二、目录与运行

| 位置 | 职责 |
| --- | --- |
| `src/pages/` | 页面、栏目静态路由、RSS |
| `src/layouts/BaseLayout.astro` | SEO、字体、导航、主题与页面切换 |
| `src/layouts/PostLayout.astro` | 文章版式与阅读进度 |
| `src/styles/global.css` | 全站颜色、排版、列表与通用动效 |
| `src/lib/lunar.ts` | 首页月球、粒子消散和照片聚合 |
| `src/lib/theme-moon.ts` | 导航月亮按钮的图形效果 |
| `src/components/TravelMap.astro`、`src/lib/travel-atlas.ts` | 行旅图集、地球和平面地图 |
| `src/lib/gallery.ts` | 封面照片路径到 Astro 图片资源的映射 |
| `src/components/MusicRecord.astro`、`src/components/MusicPlayer.astro` | 唱片展示与按需加载的播放器 |
| `src/content/` | 各栏目 Markdown 与内容 schema |
| `src/assets/gallery/`、`src/assets/images/` | 摄影与正文配图源文件 |
| `src/assets/works/` | 作品页使用的本站实际界面截图 |
| `src/assets/fonts/`、`src/assets/moon/` | 署名字体、月面资源与许可说明 |
| `scripts/data/` | 本地地图数据与来源说明 |
| `public/` | 图标、OG 图、robots.txt、llms.txt 与生成资源 |
| `scripts/` | 字体、图片、地图生成与 Markdown 图片转换 |

使用 Node.js 22 或更新版本和 npm，依赖按锁文件安装：

```bash
npm ci
npm run dev
npm run build
npm run preview
```

`dev` 会先生成字体和正文图片，`build` 通过 npm 的 `prebuild` 执行同样的预处理。不要直接用 `astro build` 跳过资源生成，也不要在 `build` 中再次重复预处理。字体或图片源文件修改后，需要重新生成对应资源。

默认开发地址为 `http://localhost:4321/`，端口占用时以终端输出为准；`npm run preview` 预览已构建的 `dist/`。单独更新字体、正文图片、地图时分别运行 `npm run fonts`、`npm run gallery`、`npm run worldmap`。新增文章或 UI 文字后重新运行开发命令或构建，让字体子集包含新字符。依赖安装后，这些生成脚本使用本地素材。

技术栈为 Astro 5、TypeScript、Three.js 和 CSS 自定义属性；Sharp 处理图片，`subset-font` 生成字体子集，`topojson-client` 转换地图数据。正文使用 Noto Serif SC 与 EB Garamond，首页署名使用 Caveat。

## 三、栏目与文章

| 栏目 | collection | 目录 | 定位 |
| --- | --- | --- | --- |
| 知 | `zhi` | `src/content/zhi/` | 技术分享、编程与工程实践 |
| 思 | `si` | `src/content/si/` | 生活记录与随笔 |
| 帧 | `zhen` | `src/content/zhen/` | 旅行摄影 |
| 馥 | `fu` | `src/content/fu/` | 香水试香与评价 |
| 聆 | `ling` | `src/content/ling/` | 音乐分享与听后感 |

「作」为独立作品页 `src/pages/works.astro`，路径 `/works/`，不属于文章 collection。展示内容必须基于真实项目，界面截图放在 `src/assets/works/`，构建时由 Astro 优化。

新增文章通常只需在对应目录添加 Markdown；新增摄影或配图时同时加入源图。不手工登记列表、详情、首页、RSS 或 sitemap。

- 文件名为 slug，推荐英文小写 kebab-case。中文文件名会生成编码 URL；不擅自重命名现有文章，以免改变链接。
- 文件名不要以下划线 `_` 开头，避免被内容加载忽略。
- schema 以 `src/content/config.ts` 为准。必填 `title` 和 `pubDate`：

```yaml
---
title: '文章标题'
pubDate: 2026-10-11
description: '一句话摘要'
tags: ['随笔']
---
```

`pubDate` 必须是不带引号的 YAML 日期，当前 schema 使用 `z.date()`。标题沿用单引号风格。

可选通用字段为 `description`、`tags`、`coverImage`、`coverImages`。帧使用 `location`、`camera`、`lat`、`lng`；馥使用 `brand`、`notes`、`rating`（1–5）。知、思的文章布局不渲染封面，不必为它们配置封面字段。

帧的地图只收录有效坐标，纬度范围 −90 到 90，经度 −180 到 180。照片源文件放 `src/assets/gallery/`，frontmatter 和正文保留 `/gallery/...` 稳定路径；其他正文配图放 `src/assets/images/`，以 `/images/...` 引用。不要把生成图当成源图维护。

### 新增歌曲

在 `src/content/ling/` 新建 Markdown。必填 `title`、`artist`、`pubDate` 和 `musicUrl`；`pubDate` 为收录日期。可选 `description`、`album`、`releaseYear`、`genre`、`coverImage`、`embedUrl`。正文可写较长的听后感，在歌曲详情页展示。

```yaml
---
title: 'Runaway'
artist: 'Kanye West feat. Pusha T'
album: 'My Beautiful Dark Twisted Fantasy'
releaseYear: 2010
pubDate: 2026-10-13
description: '如果觉得很疲惫的话，就 Runaway 吧。'
musicUrl: 'https://music.apple.com/us/song/runaway-feat-pusha-t/1440742918'
embedUrl: 'https://embed.music.apple.com/us/album/my-beautiful-dark-twisted-fantasy/1440742903?i=1440742918'
---
```

当前播放器支持 Apple Music：在歌曲的分享菜单复制嵌入代码，将其中的 `src` 地址填入 `embedUrl`，不要粘贴整段 HTML。不填写 `embedUrl` 时仅显示平台链接。`coverImage` 使用有来源的封面 URL，不填写则显示文字唱片套。歌曲文件中的首张封面来自 Apple Music 官方 oEmbed 元数据，由访客浏览器远程加载，不下载进仓库。

试听长度、完整播放及地区可用性由音乐平台决定。播放器加载不出来时，可使用始终可见的平台链接。本站不托管音频、不自动播放，也不在切页后保留后台播放。

播放器关闭或切页时移除 iframe；无 JavaScript 时保留可访问的平台链接。字段校验以 `src/content/config.ts` 中聆的独立 schema 为准，仅接受 Apple Music 官方 HTTPS 歌曲与嵌入地址。

## 四、文章改稿

- 修正错别字、语病、搭配和标点，按语义分段，清除编辑器硬折行。
- 保持原意、第一人称与作者语气，不补写经历、结论、感想或未做过的工作。
- 中英混排适当加空格，专名使用 `Agent`、`LeetCode`、`Astro` 等正确大小写。
- 保留作者有意使用的个人表达。例如「羊导」指放养式管理的导师，不改为「杨导」。
- 疑似笔误或语义不清且会影响原意时，向作者确认；能确定的常规修正直接完成。
- 不为改稿顺手重排无关文件或修改代码。

## 五、视觉与动画

- 延续纸媒排版、克制分隔线和低对比水印。颜色优先使用 CSS 变量，检查浅色和深色主题；照片、头像保持原始颜色。
- 首页月亮为真实纹理球面与粒子系统，布局和降级在 `index.astro`，渲染在 `lunar.ts`；导航月亮是独立实例，不混用两者的生命周期。
- 正常加载时隐藏静态月亮，贴图就绪后显示 WebGL 画面；兜底只在无 JavaScript、无 WebGL 或渲染失败时出现，避免刷新和切页闪烁。
- 保持桌面 4K、窄屏 2K 月面贴图与匹配的预加载条件，勿让窄屏同时下载全部大贴图。
- 保留从局部月面到整体消散、照片粒子聚合、完整照片显示的连续衔接，检查顶部渐变与导航文字对比度。
- 保留 `prefers-reduced-motion`、键盘可用性和触控操作；降级时正文、照片、地图链接仍应可访问。
- 参考其他网站时复现交互和视觉方向，保留本站内容；第三方贴图和字体保留来源与许可。

## 六、图形资源与地图

- Astro ClientRouter 切页时，初始化挂到 `astro:page-load`，对同一元素保持幂等；`astro:before-swap` 清理旧实例。
- 清理动画帧、事件监听器、观察器、定时器、几何体、材质、纹理、ImageBitmap 和渲染器。异步贴图回调检查实例是否已销毁。
- 页面不可见或组件离开视口时暂停动画；主动销毁 WebGL 上下文不应触发全站失败状态。
- 地球纹理按设备能力和缩放升级，保持窄屏 4K、桌面最高 8K 的限制。改变画布尺寸后重建纹理并释放旧纹理，避免纹理存储尺寸不匹配。
- 地图陆地和国界用 `scripts/data/countries-10m.json`；湖泊、河流用 1:50m 数据。生成命令为 `npm run worldmap`；可选参数依次为简化容差、最小岛屿跨度、输出路径，默认 `0.3`、`2`、`src/assets/worldmap.svg`。对比生成示例：`npm run worldmap -- 0.3 2 /tmp/worldmap.svg`。数据与投影细节见 [地图数据说明](scripts/data/README.md)。
- 修改生成逻辑后同时更新 `src/assets/worldmap.svg`。保留精度、岛屿筛选和图层顺序，检查 ±180° 经线跨界、平移副本和极点闭合，防止横贯地图的错误连线。
- 不自动下载素材，不修改坐标来掩盖投影或轮廓错误。月面贴图处理依据 `src/assets/moon/README.md`。

## 七、验证与文档同步

- 提交前执行 `npm run build` 和 `git diff --check`；功能修改做与影响范围对应的验证，纯文档修改检查路径、命令和事实。
- 涉及首页、地图、主题或 ClientRouter 时，在浏览器实际运行，检查首次加载、切页后返回、深浅主题、窄屏和必要的降级场景。HTML 标记存在不代表 WebGL 已初始化。
- 地图修改检查地球与平面视图、缩放旋转、跨界岛屿及大陆完整性；检查控制台中的 JavaScript 和 WebGL 错误。
- 已通过的检查不无故反复运行；未验证的环境如实说明，不以构建通过代替视觉检查。
- 更新功能时同步本文件、作品页等实际受影响的说明；栏目名称或定位改变时同步 README；域名改变同步 `astro.config.mjs`、`robots.txt`、`llms.txt`，核对 canonical、RSS 和 sitemap。
- 保留资源来源说明。没有项目级 `LICENSE` 时，不把整个仓库宣称为 MIT。

## 八、提交与发布

- 查看 diff，明确列出本次文件再暂存，不使用 `git add -A` 混入缓存、截图或无关改动。
- 行尾遵循 `.gitattributes` 的 LF 规则；不为本次功能批量改写无关文件。
- `dist/`、`.astro/`、`node_modules/`、`public/fonts/`、`public/gallery/`、`public/images/`、本地预览截图和 `.env` 不提交。月面源资源、署名字体许可、地图 SVG 和锁文件按实际变更提交。
- 提交信息沿用 `feat:`、`fix:`、`docs:`、`chore:` 前缀；用户指定提交文案时优先使用。
- push 前核对分支、远端及提交范围，推送后验证远端提交。出现分支分歧时处理普通合并或变基，不擅自强推、改写历史。
- Cloudflare Pages 的构建命令为 `npm run build`，输出目录 `dist`。最终反馈说明提交、push 和部署各自的实际状态。

## 九、资源来源与许可

文章与摄影内容引用请注明作者和出处。仓库当前未提供整个项目的 `LICENSE` 文件；第三方资源按各自的来源说明和许可使用。

- [地图数据](scripts/data/README.md)：Natural Earth 地图数据为公有领域。
- [月面贴图](src/assets/moon/README.md)：来源、处理过程与使用说明。
- [署名字体](src/assets/fonts/README.md)：Caveat 附有 SIL Open Font License；正文的 Noto Serif SC 与 EB Garamond 由 Fontsource 包提供。
