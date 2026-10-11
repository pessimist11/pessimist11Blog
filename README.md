# pessimist11Blog

个人博客，基于 Astro 5 静态生成，记录「无意义的生命中可能有意义的瞬间」。

[访问网站](https://pessimist11.pages.dev/) · [RSS 订阅](https://pessimist11.pages.dev/rss.xml)

## 内容栏目

| 栏目 | 路径 | 内容 |
| --- | --- | --- |
| **知** · TECH | `/zhi/` | 编程、框架与工程实践 |
| **思** · THINKING | `/si/` | 生活记录、随笔与感悟 |
| **帧** · TRAVEL | `/zhen/` | 旅行摄影、行旅地图与相册 |
| **馥** · SCENT | `/fu/` | 香水试香与香气笔记 |

另外提供 [作品](https://pessimist11.pages.dev/works/) 与 [关于](https://pessimist11.pages.dev/about/) 页面。

作品页将本站作为一个完整项目展示，包含月亮首页、行旅图集与相册的真实界面图片、体验入口、源码链接和设计实现说明。展示图源文件位于 `src/assets/works/`，由本站实际页面截取，构建时由 Astro 优化。

## 视觉与交互

- **月亮首页**：左侧 Caveat 手写署名，右侧使用 NASA 月面与地形数据的自转月球；桌面使用 4K 贴图，窄屏使用 2K 贴图。
- **滚动过渡**：粒子从月面局部逐渐扩展到整体，月亮消散后带着照片色彩聚合成像，再衔接完整摄影画面；照片顶部与导航采用透明渐变。
- **首页相册入口**：随机精选照片保留所属相册，完整照片呈现后显示地点、相册名称与「浏览相册」链接；静态回退与减少动态效果时也可进入相册。
- **加载体验**：按屏幕宽度预加载月面贴图，避免刷新时先闪出静态兜底月亮；浅色主题使用更清晰的粒子对比度。
- **动态主题按钮**：导航中的小月亮与浮尘切换浅色、深色主题；首次访问跟随系统，手动选择保存在本地。深色主题的导航、日期、摘要与栏目入口使用更明亮的次级文字颜色。
- **行旅图集**：三维地球与平面地图可切换，地点联动照片、坐标与相册；支持拖动、缩放、触控与键盘操作。
- **地图细节**：Natural Earth 1:10m 陆地和国界、1:50m 湖泊和河流；地球按设备能力与缩放级别使用 4K 至 8K 纹理，并正确处理日期变更线与极点闭合。
- **阅读与摄影**：首页文字栏目采用紧凑间距，摄影到正文保留更宽的衔接留白；列表悬停仅改变文字颜色，不缩放。配合按年份分组的列表、轻分隔线、低对比水印、阅读进度条、渐入动效、响应式照片及 Lightbox。
- **降级与节能**：减少动态效果时简化动画；无 JavaScript、无 WebGL 或上下文丢失时保留可读内容与静态回退。页面切换释放图形资源，离开视口或切入后台时暂停动画。

## 技术栈

- Astro 5、TypeScript、Three.js、CSS 自定义属性。
- Noto Serif SC（中文）、EB Garamond（拉丁文字）、Caveat（首页署名）。中英文字体按站点实际字符生成子集。
- Sharp 图片处理、`subset-font` 字体子集化、`topojson-client` 地图数据转换。
- Astro ClientRouter 页面切换、静态 RSS 与 sitemap。
- Cloudflare Pages 托管。

## 本地开发

使用 Node.js 22 或更新版本，以及 npm。仓库已提供 `package-lock.json`。

```bash
npm ci
npm run dev
```

默认开发地址为 `http://localhost:4321/`；端口占用时以终端输出为准。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 生成字体、正文图片后启动开发服务器 |
| `npm run build` | 通过 `prebuild` 生成字体、正文图片，再构建静态站点 |
| `npm run preview` | 预览已构建的 `dist/`，运行前需先构建 |
| `npm run fonts` | 单独生成字体子集 |
| `npm run gallery` | 单独生成正文图片与清单 |
| `npm run worldmap` | 从仓库内地图数据重新生成 SVG |

依赖安装后，字体、图片和地图生成均使用本地资源，无需下载远程素材。

## 项目结构

```text
src/
  assets/
    fonts/          # 首页署名字体与许可
    gallery/        # 帧栏目照片源文件
    images/         # 其他正文配图源文件
    moon/           # 月面、地形贴图与来源说明
    works/          # 作品页使用的本站界面图片
    worldmap.svg    # 地球与平面地图共用的生成产物
  components/       # 主题按钮、行旅地图、列表日期
  content/          # 知 / 思 / 帧 / 馥的 Markdown 与 schema
  layouts/          # 全站布局、文章布局
  lib/              # 月球、导航月亮、地图交互、照片资源映射
  pages/            # 页面、栏目路由、RSS
  styles/           # 全站样式
scripts/            # 字体、图片、地图构建及 Markdown 图片处理
  data/             # 本地 Natural Earth 地图数据
public/             # 图标、OG 图、robots.txt、llms.txt
AGENTS.md           # 编码助手的维护、写作与验证规范
```

`public/fonts/`、`public/gallery/`、`public/images/` 为自动生成资源，不提交到 Git。地图 SVG 则保存在 `src/assets/`，修改生成算法后需一起提交。

## 新增内容

在 `src/content/<栏目>/` 新建 Markdown，页面、列表、首页摘要及 RSS 会自动生成。文件名作为文章 slug，推荐英文小写、连字符分隔，不以下划线开头。

```yaml
---
title: '文章标题'
pubDate: 2026-10-11
description: '一句话摘要'
tags: ['随笔']
---
```

`pubDate` 使用不带引号的 YAML 日期。其他字段以 `src/content/config.ts` 为准：

- 帧：`coverImage`、`coverImages`、`location`、`camera`、`lat`、`lng`。地图需要有效经纬度；照片源文件放在 `src/assets/gallery/`，文中和 frontmatter 用 `/gallery/...` 引用。
- 馥：`brand`、`notes`、`rating`（1–5）；正文配图放在 `src/assets/images/`，用 `/images/...` 引用。

新增文章或 UI 文字后重新运行开发命令或构建，让字体子集包含新字符。详细规则见 [AGENTS.md](AGENTS.md)。

## 地图与月面资源

地图生成参数为简化容差、最小岛屿跨度、输出路径，默认分别为 `0.3`、`2`、`src/assets/worldmap.svg`：

```bash
npm run worldmap
# 自定义参数示例
npm run worldmap -- 0.3 2 /tmp/worldmap.svg
```

修改后需检查日期变更线附近岛屿、南极闭合、大陆完整性，以及地球和平面视图。数据说明见 [scripts/data/README.md](scripts/data/README.md)。

月面贴图来源与处理方式见 [src/assets/moon/README.md](src/assets/moon/README.md)；署名字体许可见 [src/assets/fonts/README.md](src/assets/fonts/README.md)。

## 发布

当前站点 URL 配置在 `astro.config.mjs`，为 `https://pessimist11.pages.dev`。更换域名时同步 `public/robots.txt`、`public/llms.txt`，并核对构建后的 canonical、RSS 和 sitemap。

Cloudflare Pages 使用 `npm run build`，输出目录为 `dist`；推送 `master` 触发已配置的自动部署。

```bash
npm run build
git diff --check
git add <本次改动的文件>
git commit -m "feat: 描述本次修改"
git push origin master
```

提交前查看 diff，只暂存本次文件。预览截图、缓存和生成目录留在本地。推送成功与线上部署成功应分别确认。

## 资源来源与许可

文章与摄影内容引用请注明作者和出处。仓库当前未提供整个项目的 `LICENSE` 文件；第三方资源按各自的来源说明和许可使用。Natural Earth 地图数据为公有领域，Caveat 字体附有 SIL Open Font License。
