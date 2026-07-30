# pessimist11Blog

> 个人博客

个人博客，基于 [Astro](https://astro.build) 5 构建，部署于 Cloudflare Pages。

## 内容栏目

| 栏目 | 分类 | 说明 |
|------|------|------|
| **知** (TECH) | 技术分享 | 编程、框架、工程实践 |
| **思** (THINKING) | 随笔感悟 | 生活记录与随想 |
| **帧** (TRAVEL) | 旅行摄影 | 城市漫步与风光 |
| **馥** (SCENT) | 香气笔记 | 香水试香与评价 |

## 技术栈

- **框架**: [Astro](https://astro.build) 5 (静态生成)
- **字体**: Noto Serif SC (汉字) + EB Garamond (拉丁字母)
- **部署**: [Cloudflare Pages](https://pages.cloudflare.com)
- **RSS**: 内置 `/rss.xml` 订阅

## 功能特性

- 🎨 极简纸媒风格设计，暖白米色背景
- 🌗 深色/浅色主题切换
- 🖼️ 摄影画廊 Lightbox 预览
- 🎲 首页随机展示精选照片
- 🎞️ 滚动渐入动画
- 💧 首页背景水印
- 📱 响应式布局

## 开发

```bash
# 安装依赖
npm install

# 本地开发（热更新）
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 部署

推送 `master` 分支到 GitHub 仓库，Cloudflare Pages 自动构建部署。

```bash
git add -A
git commit -m "your message"
git push origin master
```

## 许可

MIT
