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

function ringPath(ring) {
  return ring
    .map((p, i) => {
      const [x, y] = project(p);
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join('');
}

let d = '';
for (const f of geo.features) {
  const g = f.geometry;
  if (!g) continue;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      d += ringPath(ring) + 'Z';
    }
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill-rule="evenodd" aria-hidden="true">\n<path class="worldmap-land" d="${d}"/>\n</svg>\n`;

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, svg, 'utf8');
console.log(`[build-worldmap] 已生成 ${OUT}（${(svg.length / 1024).toFixed(0)}KB，${geo.features.length} 个国家）`);
