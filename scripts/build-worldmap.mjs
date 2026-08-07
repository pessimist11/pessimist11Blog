// 生成自建世界地图 SVG（等距圆柱投影，2000×1000，viewBox 2:1）
// 数据源：Natural Earth 110m（world-atlas，公共领域）
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { feature } from 'topojson-client';

const W = 2000;
const H = 1000;
const DATA = path.resolve('scripts/data/world-110m.json');
const OUT = path.resolve('src/assets/worldmap.svg');

const topo = JSON.parse(await readFile(DATA, 'utf8'));
const geo = feature(topo, topo.objects.countries);

const project = ([lng, lat]) => [
  ((lng + 180) / 360) * W,
  ((90 - lat) / 180) * H,
];

function ringToPaths(ring) {
  const pts = ring.map(project);
  const segs = [];
  let cur = [];
  for (const p of pts) {
    // 跨过 180° 日期变更线的点会产生贯穿全图的撕裂线，在这里断开
    if (cur.length && Math.abs(p[0] - cur[cur.length - 1][0]) > W / 2) {
      segs.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length) segs.push(cur);
  return segs
    .map(seg => seg.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') + 'Z')
    .join('');
}

let d = '';
for (const f of geo.features) {
  const g = f.geometry;
  if (!g) continue;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      d += ringToPaths(ring);
    }
  }
}

// 经纬网格（10° 间隔）：经线 + 纬线
let grid = '';
for (let lng = -180; lng <= 180; lng += 10) {
  const x = ((lng + 180) / 360) * W;
  grid += `M${x.toFixed(1)} 0V${H}`;
}
for (let lat = -80; lat <= 80; lat += 10) {
  const y = ((90 - lat) / 180) * H;
  grid += `M0 ${y.toFixed(1)}H${W}`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill-rule="evenodd" aria-hidden="true">\n<path class="worldmap-grid" d="${grid}"/>\n<path class="worldmap-land" d="${d}"/>\n</svg>\n`;

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, svg, 'utf8');
console.log(`[build-worldmap] 已生成 ${OUT}（${(svg.length / 1024).toFixed(0)}KB，${geo.features.length} 个国家）`);
