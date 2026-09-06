// 正文图片可访问性/CLS 优化：给渲染出的 <img> 补 loading=lazy + decoding=async，
// 并依据 optimize-gallery.mjs 生成的尺寸清单为 /gallery/ 图片补 width/height 以消除 CLS。
import { readFileSync } from 'node:fs';

let manifest = {};
try {
  manifest = JSON.parse(readFileSync(new URL('../public/gallery/manifest.json', import.meta.url), 'utf8'));
} catch {
  // 清单缺失时静默降级：仍懒加载，但不注入宽高
}

function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'element' && node.tagName === 'img') {
    const src = String(node.properties?.src || '').split('?')[0].split('#')[0];
    // 凡有真实 src 的正文图片都懒加载
    if (src) {
      node.properties.loading = 'lazy';
      node.properties.decoding = 'async';
    }
    const dim = manifest[src];
    if (dim) {
      node.properties.width = dim.width;
      node.properties.height = dim.height;
    }
  }
  if (Array.isArray(node.children)) node.children.forEach(visit);
}

export default function rehypeGallery() {
  return (tree) => {
    visit(tree);
  };
}
