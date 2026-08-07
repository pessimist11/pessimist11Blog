import type { ImageMetadata } from 'astro';

// 帧栏目照片已迁移到 src/assets/gallery，
// frontmatter 里保留 '/gallery/xxx.jpg' 作为稳定标识，运行时映射回可优化模块。
const galleryModules = import.meta.glob<ImageMetadata>(
  '/src/assets/gallery/**/*.{jpg,jpeg,png,webp,avif}',
  { eager: true, import: 'default' },
);

export function galleryImage(path?: string): ImageMetadata | undefined {
  if (!path) return undefined;
  const key = path.startsWith('/gallery/') ? `/src/assets${path}` : path;
  return galleryModules[key];
}
