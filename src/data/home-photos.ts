// 首页精选照片池：逐张查看原图及桌面、手机居中裁切后手工收录。
// 新增或替换「帧」照片时按同目录 README.md 的筛选规则更新；不自动收录相册封面。
// albumId 对应 src/content/zhen/ 的文件名（不含扩展名）。
export const homePhotos: ReadonlyArray<{
  albumId: string;
  path: string;
  alt: string;
  reason: string;
}> = [
  {
    albumId: 'chongqing',
    path: '/gallery/chongqing/cq08.jpg',
    alt: '重庆夜色中的红色跨江大桥、洪崖洞灯火与江面倒影',
    reason: '桥梁斜线与冷暖灯光有层次，居中裁切仍保留桥身、灯火和倒影。',
  },
  {
    albumId: 'chongqing',
    path: '/gallery/chongqing/cq12.jpg',
    alt: '夕光映在重庆江畔建筑上，背后是城市天际线',
    reason: '暖色建筑形成视觉重心，天空留白充足，宽窄画幅都能保留城市层次。',
  },
  {
    albumId: 'chongqing',
    path: '/gallery/chongqing/cq13.jpg',
    alt: '暮色与云层下的重庆跨江斜拉桥',
    reason: '桥塔靠近中央，云层与落日色彩舒展，适合全屏展示及手机裁切。',
  },
  {
    albumId: 'guizhou',
    path: '/gallery/guizhou/gz03.jpg',
    alt: '低云笼罩贵州山间的夜景，灯火延伸到远处',
    reason: '低云、屋顶与灯火形成前后层次，中央夜景在窄屏中仍然完整。',
  },
  {
    albumId: 'guizhou',
    path: '/gallery/guizhou/gz06.jpg',
    alt: '阳光穿过贵州山林，水流沿弧形堰坝倾泻而下',
    reason: '水流弧线贯穿画面，蓝绿色调统一，横向和居中竖向裁切都有明确景物。',
  },
  {
    albumId: 'nanjing',
    path: '/gallery/nanjing/DSCF1438.jpg',
    alt: '南京春日浅色天空下盛开的樱花与交错枝条',
    reason: '花枝主体清楚、背景轻盈，中央花簇能适应手机裁切。',
  },
  {
    albumId: 'qingdao',
    path: '/gallery/qingdao/qingdao_01.jpg',
    alt: '青岛平静的海面与淡蓝色天际线',
    reason: '海天留白干净，色调柔和，不依赖边缘的小景物，适合宽窄画幅。',
  },
  {
    albumId: 'qingdao',
    path: '/gallery/qingdao/qingdao_06.jpg',
    alt: '青岛近岸海面上的层层白浪',
    reason: '浪纹提供自然的横向节奏，居中裁切仍保留海浪与海天关系。',
  },
  {
    albumId: 'taian-zibo',
    path: '/gallery/taian_zibo/taian_zibo_04.jpg',
    alt: '从泰山眺望层叠山脊与远处薄雾',
    reason: '远近山脊层次清楚，中央视野开阔，能承受桌面和手机的不同裁切。',
  },
  {
    albumId: 'taian-zibo',
    path: '/gallery/taian_zibo/taian_zibo_08.jpg',
    alt: '山间微光下，穿黄色外套、背着背包的人背对镜头张开双臂',
    reason: '张开双臂的背影与山间微光带来舒展、自由的感受；保留暗调与颗粒，手机居中裁切仍可辨认背影和肩臂姿态。',
  },
];
