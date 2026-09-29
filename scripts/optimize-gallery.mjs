// 正文图片流水线（构建 / 开发前自动执行，见 package.json 的 prebuild 与 dev）：
//   src/assets/gallery/**  →  public/gallery/**
//   src/assets/images/**   →  public/images/**   （「馥」栏目的配图）
//
// 正文栏宽 680px（global.css 的 --content-width），据此定两档宽度：
//   720  —— 移动端 2x（390 × 0.92 ≈ 359 CSS px）与桌面 1x
//   1440 —— 桌面 2x
// 每张图产出 4 个文件（源图本身更窄时自动少一档）：
//   <name>.jpg          1440 JPEG —— 也是 Markdown 里引用的回退地址（路径不变）
//   <name>.720.jpg       720 JPEG
//   <name>.1440.avif    1440 AVIF
//   <name>.720.avif      720 AVIF
//
// 为什么是 AVIF 而不是 WebP：实测 q50 的 AVIF 比 q80 的 JPEG 省约 44%，
// 而 WebP（q78）只省约 11%，部分图反而更大，不值得多存一份。
// AVIF 用 effort 2：与 effort 4 体积几乎相同（相差 <1%），但编码快约 5 倍。
//
// manifest.json 记录正文图需要的尺寸（消除 CLS）、两档 srcset、源图指纹
// （指纹一致即整张跳过，所以 npm run dev 从第二次起几乎不花时间）。
import { readdir, stat, mkdir, copyFile, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const TREES = [
  { src: 'src/assets/gallery', dest: 'public/gallery', url: '/gallery' },
  { src: 'src/assets/images', dest: 'public/images', url: '/images' },
];

const MAIN_W = 1440; // 桌面 2x
const SMALL_W = 720; // 移动端 2x / 桌面 1x
const JPEG_Q = 80;
const AVIF_Q = 50;
const AVIF_EFFORT = 2;

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // 「馥」还没配图时目录可能不存在
  }
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(jpe?g|png|webp|avif)$/i.test(entry.name)) files.push(full);
  }
  return files;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** 源图尺寸（按 EXIF 方向换算成实际显示尺寸） */
async function sourceSize(file) {
  const meta = await sharp(file, { failOn: 'none' }).metadata();
  let { width, height, orientation } = meta;
  if (orientation >= 5 && orientation <= 8) [width, height] = [height, width];
  if (!width || !height) throw new Error('读不到图片尺寸');
  return { width, height };
}

async function processTree(tree) {
  const srcRoot = path.resolve(tree.src);
  const destRoot = path.resolve(tree.dest);
  const files = await walk(srcRoot);
  if (files.length === 0) return { count: 0, generated: 0, reused: 0, bytes: 0 };

  let prev = {};
  try {
    prev = JSON.parse(await readFile(path.join(destRoot, 'manifest.json'), 'utf8'));
  } catch {
    // 首次构建或清单被删：全部重新生成
  }

  const manifest = {};
  let generated = 0;
  let reused = 0;

  for (const file of files) {
    const rel = path.relative(srcRoot, file);
    const posixRel = rel.split(path.sep).join('/');
    const url = `${tree.url}/${posixRel}`;
    const dirPosix = path.posix.dirname(posixRel);
    const dir = path.join(destRoot, path.dirname(rel));
    const ext = path.extname(rel);
    const base = path.basename(rel, ext);
    const urlOf = (name) => (dirPosix === '.' ? `${tree.url}/${name}` : `${tree.url}/${dirPosix}/${name}`);
    await mkdir(dir, { recursive: true });

    try {
      const { size, mtimeMs } = await stat(file);
      const fp = `${size}-${Math.round(mtimeMs)}`;
      const { width: srcW, height: srcH } = await sourceSize(file);

      const mainW = Math.min(MAIN_W, srcW);
      const smallW = srcW > SMALL_W && SMALL_W < mainW ? SMALL_W : null;
      const mainH = Math.round((srcH * mainW) / srcW);

      // 两档 × 两种格式；宽度升序 —— srcset 最后一档是最大的那张，
      // BaseLayout 的 Lightbox 取的就是 srcset 末项，所以顺序不能反。
      const plan = [
        ...(smallW ? [{ name: `${base}.${smallW}${ext}`, w: smallW, format: 'jpg' }] : []),
        { name: `${base}${ext}`, w: mainW, format: 'jpg' },
        ...(smallW ? [{ name: `${base}.${smallW}.avif`, w: smallW, format: 'avif' }] : []),
        { name: `${base}.${mainW}.avif`, w: mainW, format: 'avif' },
      ].map((item) => ({ ...item, file: path.join(dir, item.name), url: urlOf(item.name) }));

      // 源图没变且产物都在 → 直接复用上次的清单条目（dev 反复启动时省下全部编码）
      if (prev[url]?.fp === fp && (await Promise.all(plan.map((item) => exists(item.file)))).every(Boolean)) {
        manifest[url] = prev[url];
        reused++;
        continue;
      }

      for (const item of plan) {
        const pipeline = sharp(file, { failOn: 'none' })
          .rotate()
          .resize({ width: item.w, withoutEnlargement: true });

        if (item.format === 'avif') {
          const buffer = await pipeline.avif({ quality: AVIF_Q, effort: AVIF_EFFORT }).toBuffer();
          await writeFile(item.file, buffer);
          continue;
        }

        const buffer = await pipeline.jpeg({ quality: JPEG_Q, progressive: true }).toBuffer();
        // 主档若与源图同宽、而重编码反而更大（源图已高度压缩），就保留原图。
        // 注意只在 item.w >= srcW 时成立：源图宽于 1440 时必须缩，不能再原样上线
        // （旧逻辑会因此把 4032px 的原图直接发到 680px 的正文栏里）。
        if (item.w >= srcW && buffer.length >= size) await copyFile(file, item.file);
        else await writeFile(item.file, buffer);
      }

      const srcsetOf = (format) =>
        plan
          .filter((item) => item.format === format)
          .map((item) => `${item.url} ${item.w}w`)
          .join(', ');

      manifest[url] = {
        fp,
        width: mainW,
        height: mainH,
        avif: srcsetOf('avif'),
        jpg: srcsetOf('jpg'),
      };
      generated++;
      console.log(`  ${posixRel}  ${srcW}×${srcH} → ${mainW}px${smallW ? ` + ${smallW}px` : ''}  ${plan.length} 个文件`);
    } catch (err) {
      console.warn(`  ⚠️ ${posixRel} 处理失败，已跳过: ${err.message}`);
    }
  }

  await writeFile(path.join(destRoot, 'manifest.json'), JSON.stringify(manifest));

  let bytes = 0;
  for (const entry of Object.values(manifest)) {
    for (const url of [entry.jpg, entry.avif]) {
      for (const part of url.split(', ')) {
        const file = path.join('public', part.split(' ')[0]);
        try {
          bytes += (await stat(file)).size;
        } catch {}
      }
    }
  }

  const count = files.length;
  const summary = `${count} 张（新生成 ${generated}、跳过 ${reused}）`;
  console.log(`[optimize-gallery] ${tree.src} → ${tree.dest}：${summary}，产物 ${(bytes / 1024 / 1024).toFixed(1)}MB`);
  return { count, generated, reused, bytes };
}

const results = [];
for (const tree of TREES) results.push(await processTree(tree));

const total = results.reduce((acc, r) => acc + r.count, 0);
const bytes = results.reduce((acc, r) => acc + r.bytes, 0);
console.log(`[optimize-gallery] 完成：共 ${total} 张，产物合计 ${(bytes / 1024 / 1024).toFixed(1)}MB，已生成尺寸与 srcset 清单`);
