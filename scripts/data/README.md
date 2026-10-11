# 地图数据

用于 `scripts/build-worldmap.mjs`，所有生成输入均保存在本目录，运行时不下载数据。

| 文件 | 当前用途 |
| --- | --- |
| `countries-10m.json` | Natural Earth 1:10m 的 world-atlas TopoJSON；`land` 生成陆地轮廓，`countries` 提取内部国界 |
| `lakes-50m.json` | Natural Earth 1:50m 湖泊 GeoJSON |
| `rivers-50m.json` | Natural Earth 1:50m 河流 GeoJSON，保留 `scalerank ≤ 4` 的主要河流 |
| `countries-50m.json`、`world-110m.json` | 历史精度版本，目前生成脚本不使用，可供对比 |

来源：[world-atlas](https://github.com/topojson/world-atlas)、[Natural Earth Vector](https://github.com/nvkelso/natural-earth-vector)。Natural Earth 数据为公有领域。

## 生成

在仓库根目录运行：

```bash
npm run worldmap
# 参数：简化容差、最小岛屿跨度、输出路径
npm run worldmap -- 0.3 2 /tmp/worldmap.svg
```

默认输出 `src/assets/worldmap.svg`，等距圆柱投影，viewBox 为 `2000 × 1000`。坐标保留一位小数，陆地简化容差 `0.3`、最小跨度 `2`；线图层容差 `0.8`，湖泊最小跨度 `3`。经纬网间隔 10°。

SVG 同时用于平面视图及地球 Canvas 纹理。浏览器按视口、设备像素比、缩放与 GPU 上限选择纹理分辨率，数据精度与纹理分辨率需要分别维护。

## 跨界轮廓

±180° 是同一条经线。多边形先在连续经度空间展开，再给超出图幅的岛屿生成平移副本；南极洲绕极点的环通过极点闭合。不能直接连接图幅左右边缘，否则斐济、北极岛屿会产生横贯整张地图的线。

修改算法或数据后重新生成并提交 SVG，检查大陆、跨界岛屿、南极、正常经纬线，以及地球和平面视图中的放大效果。
