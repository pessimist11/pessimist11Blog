# 博客写作与发布规范

> 本文件供 AI 编码助手（DSH 等）参考，DSH 会自动加载项目根目录的 `AGENTS.md`。
> 站点：pessimist11 — Astro 5 静态站，部署于 Cloudflare Pages，推送 `master` 即自动构建。

## 一、栏目与目录

| 栏目 | collection | 目录 | 定位 |
|------|-----------|------|------|
| **知** | `zhi` | `src/content/zhi/` | 技术分享：编程、框架、工程实践 |
| **思** | `si` | `src/content/si/` | 随笔感悟：生活记录与随想 |
| **帧** | `zhen` | `src/content/zhen/` | 旅行摄影：城市漫步与风光 |
| **馥** | `fu` | `src/content/fu/` | 香气笔记：香水试香与评价 |

## 二、新增文章：只加一个 md 文件

1. 在 `src/content/<collection>/` 下新建 `<slug>.md`，**无需改动任何代码**。
2. `slug` 用英文小写 kebab-case（如 `beijing-first-impressions.md`）。中文文件名可用，但 URL 会被百分号编码、不便分享。
3. 文件名即 URL：`/si/<slug>/`。文件名**不能以下划线 `_` 开头**（Astro 会整份忽略，且构建不报错，极易误判成功）。
4. 以下页面全部由 `getCollection()` / `getStaticPaths()` 自动生成，不必手工登记：
   - 列表页 `src/pages/<collection>/index.astro`（按 `pubDate` 倒序、按年份分组）
   - 详情页 `src/pages/<collection>/[slug].astro`
   - 首页 `src/pages/index.astro`（各栏目取最新 3 篇）
   - `rss.xml` 与 sitemap

## 三、Frontmatter 规范

Schema 定义在 `src/content/config.ts`。

**必填**

```yaml
title: '文章标题'          # 用单引号包裹
pubDate: 2026-09-26        # 必须是不带引号的 YAML 日期！
```

> ⚠️ `pubDate` 一旦写成 `'2026-09-26'`（带引号），构建会直接失败：
> `InvalidContentEntryDataError: pubDate: Expected type "date", received "string"`。

**可选**：`description`（一句话摘要，显示在列表里）、`tags`（字符串数组）、`coverImage`、`coverImages`
**特定栏目才用**：`帧` 用 `coverImage` / `coverImages` / `location` / `camera` / `lat` / `lng`；`馥` 用 `brand` / `notes` / `rating`
**知 / 思** 用不到封面字段（`PostLayout.astro` 不渲染封面），不必配图。

## 四、改稿规范（核心）

用户提出「帮我改一下某篇文章」时，按以下原则处理。

### 要做的

- **改错别字**：如「该简历」→「改简历」、「呆在北京」→「待在北京」。
- **修语病**，重点盯这几类高频问题：

| 问题类型 | 反面例子 | 改法 |
|---|---|---|
| 句式杂糅 | 「由于北京太大，导致……」<br>「正是因为这次校车让我感受到……」 | 「北京太大，……都……」<br>「也正是这趟校车，让我见识了……」 |
| 搭配不当 | 「焦虑未来」 | 「对未来感到焦虑」 |
| 语义冲突 | 「还算是非常不错的」（还算＝勉强） | 「还算不错」 |
| 缺主语 / 成分残缺 | 「刚到北京南就安排了校车」<br>「甚至超过从家到合肥」 | 「我刚到北京南站，学校就安排了校车」<br>「甚至比从家到合肥还长」 |
| 量词、专名不规范 | 「这次校车」「刷lc」「agent八股」 | 「这趟校车」「刷 LeetCode」「Agent 八股」 |
| 并列名词误用逗号 | 「嘈杂的车厢，拥挤的人群就是……」 | 「嘈杂的车厢、拥挤的人群，这就是……」 |

- **顺生硬的书面表达**，保持口语化的第一人称语气，不要改成书面腔或新闻腔。
- **去掉编辑器硬折行**：md 正文按语义重新分段，一段一个意思，避免一屏一大块。
- **中英混排加空格**，专有名词用官方大小写（`Agent`、`LeetCode`、`Astro`）。

### 不要做的

- **不改变原意、不添加原文没有的内容**，也不要替作者升华主题或补写感想。
- **保留作者的个人用语**：例如「羊导」是作者有意为之，指**放养式管理**的导师，**不要**"纠正"成「杨导」。
- **拿不准的先问**：遇到疑似笔误但不确定的词、或语义含混的句子，先向作者确认，不要擅自改写。
- 不改标题的引号风格（frontmatter 统一用单引号）。
- 不为改稿而顺手重排无关文件或改动代码。

## 五、发布流程

```bash
npm run build                      # 1. 必须先验证构建通过
git add "src/content/si/xxx.md"    # 2. 只 add 本次涉及的文件
git commit -m "新增文章"            # 3. 提交
git push origin master             # 4. 推送，Cloudflare 自动部署
```

- **不要用 `git add -A`**：工作区可能残留无关改动（历史上曾因 CRLF/LF 差异产生 27 个文件的假改动），会污染提交。
- 提交信息沿用仓库风格，带前缀：`feat:` / `docs:` / `chore:`（若作者指定了文案，就照作者说的写）。
- 行尾符已由根目录 `.gitattributes`（`* text=auto eol=lf`）统一为 LF，无需再手动处理。
- `dist/`、`.astro/`、`node_modules/`、`public/gallery/` 均已在 `.gitignore` 中，不要提交。
