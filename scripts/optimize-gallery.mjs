// 帧栏目正文图片优化脚本：
// 读取 src/assets/gallery 的原图，生成 1440px 宽的渐进式 JPEG 到 public/gallery
// （文件名保持一致，Markdown 正文无需改动），构建/开发前自动执行。
// 若重编码后体积大于原图（原图已高度压缩），则保留原图。
import { readdir, stat, mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = path.resolve('src/assets/gallery');
const DEST = path.resolve('public/gallery');
const WIDTH = 1440;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (/\.(jpe?g|png|webp|avif)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const files = await walk(SRC);
console.log(`[optimize-gallery] ${files.length} 张照片 → public/gallery（宽 ${WIDTH}px）`);

let saved = 0;
for (const file of files) {
  const rel = path.relative(SRC, file);
  const out = path.join(DEST, rel);
  await mkdir(path.dirname(out), { recursive: true });

  try {
    const { size: before } = await stat(file);
    const buffer = await sharp(file, { failOn: 'none' })
      .rotate()
      .resize({ width: WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();

    if (buffer.length < before) {
      await writeFile(out, buffer);
    } else {
      await copyFile(file, out); // 重编码更大 → 保留原图
    }

    const finalSize = Math.min(buffer.length, before);
    saved += before - finalSize;
    console.log(`  ${rel}  ${(before / 1024).toFixed(0)}KB → ${(finalSize / 1024).toFixed(0)}KB`);
  } catch (err) {
    console.warn(`  ⚠️ ${rel} 处理失败，已跳过: ${err.message}`);
  }
}

console.log(`[optimize-gallery] 完成，共节省 ${(saved / 1024 / 1024).toFixed(1)}MB`);
