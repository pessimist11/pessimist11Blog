// 生成地球与平面视图共用的 SVG（等距圆柱投影，2000×1000）。
// 陆地与国界：Natural Earth 1:10m；湖泊与河流：1:50m。数据与来源见 data/README.md。
// 用法：npm run worldmap -- [容差] [最小岛尺寸] [输出路径]
// 坐标保留一位小数，Douglas-Peucker 抽稀后以隐式 lineto 输出；
// 日期变更线附近轮廓展开并补平移副本，绕极点的环沿极点闭合。
// 产物内联进 /zhen/ 并用来生成地球纹理，维护精度时同时关注页面体积。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { feature, mesh } from 'topojson-client';

const W = 2000;
const H = 1000;
// 同一份 TopoJSON 提供 land 填充轮廓与 countries 内部国界。
const DATA = path.resolve('scripts/data/countries-10m.json');

// 默认值；可用命令行覆盖以便对比不同激进程度
const [argTol, argMinSpan, argOut] = process.argv.slice(2);
const TOLERANCE = argTol !== undefined ? Number(argTol) : 0.3;
const MIN_SPAN = argMinSpan !== undefined ? Number(argMinSpan) : 2;
const OUT = path.resolve(argOut ?? 'src/assets/worldmap.svg');

// 国界和河流都只是一根发丝细线，不需要海岸线那么高的精度，容差可以放宽
const LINE_TOLERANCE = 0.8;

// 湖泊与河流数据（Natural Earth 1:50m，公有领域），只保留几何、去掉几十个属性字段。
// 下载自：
//   https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_lakes.geojson
//   https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_rivers_lake_centerlines.geojson
// 河流另外按 scalerank ≤ 4 筛掉了小支流：全量 462 条会多花一倍体积，而且在 1000px 宽的图上只是噪点
const LAKES = path.resolve('scripts/data/lakes-50m.json');
const RIVERS = path.resolve('scripts/data/rivers-50m.json');
// 湖泊使用稍高的最小跨度，过滤显示尺寸下过小的湖面。
const LAKES_MIN_SPAN = 3;
// 湖的形状简单，容差可以比海岸线松
const LAKES_TOLERANCE = 0.8;

const topo = JSON.parse(await readFile(DATA, 'utf8'));
// 陆地填充取 land 对象：这张图渲染的是「整块陆地剪影」（所有环合并成一个 path 同色填充），
// 用 countries 会把每一条国界也写进填充路径，两倍的点数。国界另外用 mesh 单独描边（见下）。
const OBJECT = 'land';
const geo = feature(topo, topo.objects[OBJECT]);

// 坐标保留一位小数，避免放大后海岸线出现整数取整的台阶。
const project = ([lng, lat]) => [
  Number((((lng + 180) / 360) * W).toFixed(1)),
  Number((((90 - lat) / 180) * H).toFixed(1)),
];

/** Douglas-Peucker：用显式栈代替递归，避免上千点的环把调用栈压爆 */
function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const tol2 = tolerance * tolerance;
  const stack = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop();
    if (last - first < 2) continue;
    const [x1, y1] = points[first];
    const [x2, y2] = points[last];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const segLen2 = dx * dx + dy * dy;

    let maxD2 = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      let ex;
      let ey;
      if (segLen2 === 0) {
        // 首尾重合时退化成到点的距离
        ex = px - x1;
        ey = py - y1;
      } else {
        // 投影到线段上并夹到 [0,1]：用「到线段的距离」而不是到直线的距离，
        // 否则闭合环的首尾那一段会把远处的点算成很近，抽出错误的形状
        let t = ((px - x1) * dx + (py - y1) * dy) / segLen2;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        ex = px - (x1 + t * dx);
        ey = py - (y1 + t * dy);
      }
      const d2 = ex * ex + ey * ey;
      if (d2 > maxD2) {
        maxD2 = d2;
        index = i;
      }
    }

    if (maxD2 > tol2 && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/** 去掉相邻重复点，以及首尾重复（GeoJSON 的环末点等于首点） */
function dedupe(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  while (
    out.length > 1 &&
    out[0][0] === out[out.length - 1][0] &&
    out[0][1] === out[out.length - 1][1]
  ) {
    out.pop();
  }
  return out;
}

/**
 * 在连续的经度空间展开多边形。±180° 是同一条经线；即使两端坐标恰好
 * 落在图幅边缘，也不能直接跨整张图相连（斐济和北极岛屿会因此产生横线）。
 * 超出图幅的部分由 buildPolygonLayer 的平移副本补到另一侧。
 */
function unroll(points) {
  if (!points.length) return [];
  const out = [points[0]];
  let offset = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    let x = points[i][0] + offset;
    while (x - prev[0] > W / 2) { offset -= W; x -= W; }
    while (prev[0] - x > W / 2) { offset += W; x += W; }
    out.push([x, points[i][1]]);
  }

  // 围绕极点一周的环（南极洲）展开后首尾相差一整个图幅。沿极点闭合，
  // 避免 Z 在海岸之间连出横线；球面上的这条图幅边界会收敛为同一个极点。
  const first = out[0], last = out[out.length - 1];
  if (Math.abs(last[0] - first[0]) > W / 2) {
    const pole = out.reduce((sum, point) => sum + point[1], 0) / out.length > H / 2 ? H : 0;
    const wrappedFirstX = first[0] + Math.round((last[0] - first[0]) / W) * W;
    out.push([wrappedFirstX, first[1]], [wrappedFirstX, pole], [first[0], pole]);
  }
  return out;
}

/** 环的外接矩形长边：太小的岛在 920px 宽的显示尺寸下不足 1px，画出来只是脏点 */
function ringSpan(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.max(maxX - minX, maxY - minY);
}

/** 一次遍历拼路径：M 后面直接跟坐标对，后续坐标对是隐式 lineto，省掉每个 L */
function ringToPath(points, shiftX = 0) {
  let d = `M${points[0][0] + shiftX} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) d += ` ${points[i][0] + shiftX} ${points[i][1]}`;
  return `${d}Z`;
}

/**
 * 把一批多边形环加工成一条 path 的 d。
 * 陆地与湖泊共用这条流水线：投影取整 → 展开跨接缝环 → Douglas-Peucker 抽稀 → 隐式 lineto。
 */
function buildPolygonLayer(rings, minSpan, tolerance) {
  const stat = { rawPoints: 0, keptPoints: 0, keptRings: 0, droppedRings: 0, wrappedCopies: 0 };
  let d = '';

  for (const ring of rings) {
    stat.rawPoints += ring.length;
    const unrolled = unroll(dedupe(ring.map(project)));
    const simplified = dedupe(simplify(unrolled, tolerance));
    // 少于 3 个点围不成面；外接矩形太小的环在显示尺寸下不足 1px
    if (simplified.length < 3 || ringSpan(simplified) < minSpan) {
      stat.droppedRings++;
      continue;
    }
    d += ringToPath(simplified);
    stat.keptRings++;
    stat.keptPoints += simplified.length;

    // 跨过图幅边缘的岛屿在另一侧补平移副本，保留日期变更线两侧轮廓。
    let minX = Infinity;
    let maxX = -Infinity;
    for (const [x] of simplified) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    if (maxX > W) {
      d += ringToPath(simplified, -W);
      stat.wrappedCopies++;
    }
    if (minX < 0) {
      d += ringToPath(simplified, W);
      stat.wrappedCopies++;
    }
  }

  return { d, stat };
}

/** 取出 GeoJSON 里所有的多边形环（topojson 的 feature() 结果与纯 GeoJSON 都适用） */
function ringsOf(geo) {
  const rings = [];
  const features = geo.type === 'FeatureCollection' ? geo.features : [geo];
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const polygon of polygons) for (const ring of polygon) rings.push(ring);
  }
  return rings;
}

/**
 * 取出 GeoJSON 里所有的开放折线（河流是 LineString / MultiLineString）
 */
function linesOf(geo) {
  const lines = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'LineString') lines.push(g.coordinates);
    else if (g.type === 'MultiLineString') for (const line of g.coordinates) lines.push(line);
  }
  return lines;
}

/**
 * 把一批开放折线（国界、河流）加工成一条 stroke 用的 d。
 * 和陆地不同：描边不需要闭合，所以跨接缝处直接断成独立子路径就行 —— 不用 Z、不用展开，
 * 也就不会碰上「展开还是保留」那类坑。
 */
function buildLineLayer(lines, tolerance) {
  const stat = { rawPoints: 0, keptPoints: 0, keptLines: 0, droppedLines: 0 };
  let d = '';

  for (const line of lines) {
    stat.rawPoints += line.length;
    const simplified = dedupe(simplify(dedupe(line.map(project)), tolerance));
    if (simplified.length < 2) {
      stat.droppedLines++;
      continue;
    }
    let current = [simplified[0]];
    for (let i = 1; i < simplified.length; i++) {
      // 跨 180° 的点之间会连出一条横贯全图的线，断开
      if (Math.abs(simplified[i][0] - simplified[i - 1][0]) > W / 2) {
        if (current.length > 1) {
          d += `M${current.map((p) => `${p[0]} ${p[1]}`).join(' ')}`;
          stat.keptLines++;
        }
        current = [simplified[i]];
      } else {
        current.push(simplified[i]);
      }
    }
    if (current.length > 1) {
      d += `M${current.map((p) => `${p[0]} ${p[1]}`).join(' ')}`;
      stat.keptLines++;
    }
    stat.keptPoints += simplified.length;
  }

  return { d, stat };
}

const land = buildPolygonLayer(ringsOf(geo), MIN_SPAN, TOLERANCE);
// 国界：只要「相邻两国共享的那条边」（a !== b），海岸线已经由 land 图层画了。
// mesh 返回的每条共享弧只出现一次，不会重复描一遍导致颜色加深。
const borders = buildLineLayer(
  mesh(topo, topo.objects.countries, (a, b) => a !== b).coordinates,
  LINE_TOLERANCE,
);
// 湖泊：1:50m 独立图层，以湖面颜色填充陆地中的内陆水域。
const lakes = buildPolygonLayer(
  ringsOf(JSON.parse(await readFile(LAKES, 'utf8'))),
  LAKES_MIN_SPAN,
  LAKES_TOLERANCE,
);
// 河流：同样只描边，且已按 scalerank 筛过，只留主要河流
const rivers = buildLineLayer(linesOf(JSON.parse(await readFile(RIVERS, 'utf8'))), LINE_TOLERANCE);

// 经纬网格（10° 间隔）：经线 + 纬线
let grid = '';
for (let lng = -180; lng <= 180; lng += 10) {
  const x = (((lng + 180) / 360) * W).toFixed(1);
  grid += `M${x} 0V${H}`;
}
for (let lat = -80; lat <= 80; lat += 10) {
  const y = (((90 - lat) / 180) * H).toFixed(1);
  grid += `M0 ${y}H${W}`;
}

// 顺序即图层顺序：网格在最下，陆地压在网格上，国界压在陆地上，
// 最后是湖泊（湖面用页面底色，看起来就是把陆地挖开），和参考站的做法一致。
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill-rule="evenodd" aria-hidden="true">\n` +
  `<path class="worldmap-grid" d="${grid}"/>\n` +
  `<path class="worldmap-land" d="${land.d}"/>\n` +
  `<path class="worldmap-borders" d="${borders.d}"/>\n` +
  `<path class="worldmap-lakes" d="${lakes.d}"/>\n` +
  `<path class="worldmap-rivers" d="${rivers.d}"/>\n` +
  `</svg>\n`;

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, svg, 'utf8');

const pct = (kept, raw) => `${(100 - (kept / raw) * 100).toFixed(1)}%`;
console.log(
  `[build-worldmap] 容差 ${TOLERANCE}、最小环 ${MIN_SPAN}/${LAKES_MIN_SPAN}：` +
    `陆地 ${land.stat.keptRings} 环（丢 ${land.stat.droppedRings}，接缝副本 ${land.stat.wrappedCopies}）` +
    ` 点 ${land.stat.rawPoints} → ${land.stat.keptPoints}（抽掉 ${pct(land.stat.keptPoints, land.stat.rawPoints)}）；` +
    `湖泊 ${lakes.stat.keptRings} 环 点 ${lakes.stat.rawPoints} → ${lakes.stat.keptPoints}；` +
    `国界 ${borders.stat.keptLines} 段、河流 ${rivers.stat.keptLines} 段（容差 ${LINE_TOLERANCE}）`,
);
console.log(
  `[build-worldmap] 已生成 ${path.relative(process.cwd(), OUT)}（${(svg.length / 1024).toFixed(0)}KB，` +
    `其中 land ${(land.d.length / 1024).toFixed(0)}KB、borders ${(borders.d.length / 1024).toFixed(1)}KB、` +
    `lakes ${(lakes.d.length / 1024).toFixed(1)}KB、rivers ${(rivers.d.length / 1024).toFixed(1)}KB）`,
);
