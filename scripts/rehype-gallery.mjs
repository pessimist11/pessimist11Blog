// 正文图片优化：把 Markdown 渲染出的 <img> 升级成响应式 <picture>。
//
// 依据 optimize-gallery.mjs 生成的清单（public/gallery、public/images 各一份）：
//   1. 补 loading=lazy / decoding=async；
//   2. 补 width/height（清单里的真实尺寸）消除 CLS；
//   3. 有 AVIF 档时包一层 <picture>：AVIF 优先，原 JPEG 回退；
//   4. 补 720w / 1440w 两档 srcset 与 sizes（正文栏 680px）。
//
// 清单里没有的图（外链、未纳入流水线的图）只做第 1 步，保持原样。
//
// ⚠️ 改完这个文件后，Astro 不会重新渲染正文：Markdown 渲染结果被缓存在
//    node_modules/.astro/data-store.json 里，光删项目根的 .astro/ 不够。
//    不删的话构建一切正常、日志干净，产物却还是旧插件的输出（本次就踩了）。
//    验证改动前先：rm -rf node_modules/.astro .astro
import { readFileSync } from 'node:fs';
import path from 'node:path';

// 正文栏 680px（global.css 的 --content-width）；移动端 18px 内边距（768px 断点）
const SIZES = '(max-width: 768px) 92vw, 680px';

const manifest = {};
for (const name of ['gallery', 'images']) {
  try {
    Object.assign(manifest, JSON.parse(readFileSync(path.resolve(`public/${name}/manifest.json`), 'utf8')));
  } catch {
    // 清单缺失时静默降级：仍懒加载，但不注入尺寸与 srcset
  }
}

function upgrade(node) {
  const properties = node.properties ?? (node.properties = {});
  const src = String(properties.src || '').split('?')[0].split('#')[0];

  // 凡有真实 src 的正文图片都懒加载
  if (src) {
    properties.loading = 'lazy';
    properties.decoding = 'async';
  }

  const entry = manifest[src];
  if (!entry) return node;

  properties.width = entry.width;
  properties.height = entry.height;

  const jpg = entry.jpg || src;
  properties.srcset = jpg;
  properties.sizes = SIZES;

  // 没有 AVIF 档（清单来自旧版本产物）时保持单个 <img>
  if (!entry.avif) return node;

  return {
    type: 'element',
    tagName: 'picture',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'source',
        properties: { type: 'image/avif', srcset: entry.avif, sizes: SIZES },
        children: [],
      },
      node,
    ],
  };
}

function visit(node) {
  if (!node || !Array.isArray(node.children)) return;
  // 用 map 逐个替换：升级后的 <picture> 不再回访，避免里面那个 <img> 被二次包装
  node.children = node.children.map((child) => {
    if (child.type === 'element' && child.tagName === 'img') return upgrade(child);
    visit(child);
    return child;
  });
}

export default function rehypeGallery() {
  return (tree) => {
    visit(tree);
  };
}
