import * as THREE from 'three';
import albedoUrl from '../assets/moon/lroc-albedo.webp?url';
import heightUrl from '../assets/moon/lola-height.jpg?url';

const MOON_ROTATION_SECONDS = 180;

// 固定种子让月海、环形山和浮尘在切页后保持一致。
function randomSource(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function noise(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(0, 1, x - ix), fy = smooth(0, 1, y - iy), fz = smooth(0, 1, z - iz);
  const hash = (a: number, b: number, c: number) => {
    let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return mix(
    mix(mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy),
    mix(mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx), mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy),
    fz,
  );
}

function terrain(x: number, y: number, z: number) {
  let sum = 0, weight = 0.5;
  for (let i = 0; i < 4; i++) {
    sum += weight * noise(x, y, z);
    x *= 2.03; y *= 2.03; z *= 2.03;
    weight *= 0.5;
  }
  return sum / 0.9375;
}

const SURFACE_W = 512, SURFACE_H = 256;
let surfaceData: Uint8Array | undefined;

function moonTexture() {
  if (!surfaceData) {
    const heights = new Float32Array(SURFACE_W * SURFACE_H);
    const seas = new Float32Array(heights.length);
    const craterTones = new Float32Array(heights.length);
    for (let y = 0; y < SURFACE_H; y++) {
      const theta = ((y + 0.5) / SURFACE_H) * Math.PI;
      for (let x = 0; x < SURFACE_W; x++) {
        const phi = ((x + 0.5) / SURFACE_W) * Math.PI * 2;
        const nx = Math.sin(theta) * Math.cos(phi), ny = Math.cos(theta), nz = Math.sin(theta) * Math.sin(phi);
        const i = y * SURFACE_W + x;
        // 在球面上采样，避免经度接缝，也避免把极点拉成条纹。
        seas[i] = smooth(0.40, 0.67, terrain(nx * 2.5 + 3, ny * 2.5, nz * 2.5 + 7));
        heights[i] = 0.5 + (noise(nx * 26, ny * 26, nz * 26) - 0.5) * 0.025;
      }
    }
    const random = randomSource(19710807);
    for (let crater = 0; crater < 240; crater++) {
      const cx = random() * SURFACE_W;
      const cy = Math.acos(random() * 1.9 - 0.95) / Math.PI * SURFACE_H;
      const radius = crater < 3 ? 14 + random() * 3 : 1.75 + Math.pow(random(), 3.5) * 10.5;
      const stretch = Math.max(0.28, Math.sin((cy / SURFACE_H) * Math.PI));
      const reach = radius * 1.4;
      for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(SURFACE_H - 1, Math.ceil(cy + reach)); y++) {
        for (let x = Math.floor(cx - reach / stretch); x <= Math.ceil(cx + reach / stretch); x++) {
          const q = Math.hypot((x - cx) * stretch, y - cy) / radius;
          if (q > 1.4) continue;
          const i = y * SURFACE_W + ((x % SURFACE_W) + SURFACE_W) % SURFACE_W;
          const bowl = q < 1 ? (1 - q * q) ** 2 : 0;
          const rim = Math.exp(-Math.pow((q - 0.96) / 0.10, 2));
          const ejecta = Math.exp(-Math.pow((q - 1.12) / 0.20, 2));
          const strength = 1 - seas[i] * 0.4;
          heights[i] += (rim * 0.075 - bowl * 0.105 + ejecta * 0.008) * strength;
          craterTones[i] += (bowl * 0.24 - rim * 0.17 + ejecta * 0.03) * strength;
        }
      }
    }
    surfaceData = new Uint8Array(heights.length * 4);
    for (let i = 0; i < heights.length; i++) {
      surfaceData[i * 4] = Math.round(Math.min(1, Math.max(0, heights[i])) * 255);
      surfaceData[i * 4 + 1] = Math.round(seas[i] * 255);
      surfaceData[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, 0.5 + craterTones[i] * 0.7)) * 255);
      surfaceData[i * 4 + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(surfaceData, SURFACE_W, SURFACE_H);
  texture.wrapS = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

let cloudData: Uint8Array | undefined;
function cloudTexture() {
  const w = 256, h = 128;
  if (!cloudData) {
    cloudData = new Uint8Array(w * h * 4);
    const tileNoise = (x: number, y: number, px: number, py: number) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = smooth(0, 1, x - ix), fy = smooth(0, 1, y - iy);
      const sample = (a: number, b: number) => noise(((a % px) + px) % px, ((b % py) + py) % py, 11);
      const a = sample(ix, iy) * (1 - fx) + sample(ix + 1, iy) * fx;
      const b = sample(ix, iy + 1) * (1 - fx) + sample(ix + 1, iy + 1) * fx;
      return a * (1 - fy) + b * fy;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const value = tileNoise(x / w * 8, y / h * 4, 8, 4) * 0.65 + tileNoise(x / w * 16, y / h * 8, 16, 8) * 0.35;
        const i = (y * w + x) * 4;
        cloudData[i] = cloudData[i + 1] = cloudData[i + 2] = Math.round(value * 255);
        cloudData[i + 3] = 255;
      }
    }
  }
  const texture = new THREE.DataTexture(cloudData, w, h);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const moonVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal, vPosition, vPoint;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPoint = normalize(mat3(modelMatrix) * position);
    vec4 pos = modelViewMatrix * vec4(position, 1.0);
    vPosition = pos.xyz;
    gl_Position = projectionMatrix * pos;
  }
`;

const moonFragment = /* glsl */ `
  uniform sampler2D uSurface, uAlbedo, uHeight;
  uniform vec3 uPaper, uMoonShade, uMoonLight, uLight, uCameraLight;
  uniform float uDark, uMapsReady, uProgress;
  varying vec2 vUv;
  varying vec3 vNormal, vPosition, vPoint;
  void main() {
    vec3 fallback = texture2D(uSurface, vUv).rgb;
    vec3 map = texture2D(uAlbedo, vUv).rgb;
    float albedo = mix(0.85 - fallback.g * 0.45, pow(max(dot(map, vec3(0.2126, 0.7152, 0.0722)), 0.001), 0.4545), uMapsReady);
    float height = mix(fallback.r, texture2D(uHeight, vUv).r, uMapsReady);
    vec2 dx = dFdx(vUv), dy = dFdy(vUv);
    float hx = mix(texture2D(uSurface, vUv + dx).r, texture2D(uHeight, vUv + dx).r, uMapsReady);
    float hy = mix(texture2D(uSurface, vUv + dy).r, texture2D(uHeight, vUv + dy).r, uMapsReady);
    vec2 slope = vec2(hx - height, hy - height) * mix(0.035, 0.012, uMapsReady);
    vec3 normal = normalize(vNormal);
    vec3 sx = dFdx(vPosition), sy = dFdy(vPosition);
    vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1);
    vec3 relief = normalize(normal - sign(det) * (slope.x * r1 + slope.y * r2) / max(abs(det), 0.0000001));
    float sun = dot(normalize(vPoint), uLight);
    float detail = dot(relief, uCameraLight);
    float daylight = smoothstep(-0.045, 0.060, sun + clamp(detail - sun, -0.2, 0.2) * 0.05);
    float pigment = clamp(0.12 + pow(1.0 - albedo, 1.15) * 0.68 + (1.0 - max(detail, 0.0)) * 0.10, 0.08, 0.78);
    vec3 day = mix(uPaper, uMoonShade, pigment);
    vec3 dayShadow = mix(uPaper, uMoonShade, 0.012 + (1.0 - albedo) * 0.018);
    float focus = 1.0 - smoothstep(0.25, 0.90, length(vPoint.xy));
    float brightness = (0.14 + albedo * 0.82) * (0.4 + 0.6 * sqrt(max(detail, 0.0)));
    brightness *= 1.0 - focus * 0.55;
    vec3 night = mix(uPaper, uMoonLight, clamp(brightness, 0.02, 0.9));
    vec3 nightShadow = mix(uPaper, uMoonLight, 0.008 + albedo * 0.012);
    vec3 color = mix(mix(dayShadow, day, daylight), mix(nightShadow, night, daylight), uDark);
    // 左侧的墨粒先松开，滚动时逐步释放到云带里。
    float front = 0.46 + vPoint.x * 0.34 + vPoint.y * 0.12 + (albedo - 0.5) * 0.06;
    float erosion = mix(0.18, 1.15, smoothstep(0.04, 0.90, uProgress));
    float opacity = smoothstep(erosion - 0.08, erosion + 0.08, front);
    if (opacity < 0.004) discard;
    gl_FragColor = vec4(color, opacity);
    #include <colorspace_fragment>
  }
`;

const dustVertex = /* glsl */ `
  uniform float uTime, uPixelRatio, uCamZ, uProgress, uMapsReady, uDark;
  uniform mat3 uMoonRotation;
  uniform sampler2D uAlbedo;
  uniform vec3 uPaper, uMoonShade, uMoonLight, uInk, uLight;
  attribute float aSize, aPhase, aKind;
  attribute vec2 aUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec3 p;
    if (aKind > 0.5) {
      float a = uTime * 0.009 * (aPhase < 3.14159 ? 1.0 : -1.0);
      p = vec3(position.x * cos(a) + position.z * sin(a), position.y, -position.x * sin(a) + position.z * cos(a));
      p.y += sin(uTime * 0.08 + aPhase) * 0.025;
      vAlpha = (0.10 + aSize * 0.05) * (0.75 + 0.25 * sin(uTime * 0.14 + aPhase));
      vColor = uInk;
    } else {
      vec3 n = normalize(uMoonRotation * position);
      float albedo = mix(0.6, pow(max(dot(texture2D(uAlbedo, aUv).rgb, vec3(0.2126, 0.7152, 0.0722)), 0.001), 0.4545), uMapsReady);
      float front = 0.46 + n.x * 0.34 + n.y * 0.12 + (albedo - 0.5) * 0.06;
      float erosion = mix(0.18, 1.15, smoothstep(0.04, 0.90, uProgress));
      float release = 1.0 - smoothstep(erosion - 0.08, erosion + 0.08, front);
      float age = clamp((erosion - front) * 1.8, 0.0, 1.0);
      float lift = smoothstep(0.0, 0.3, age);
      p = n * (1.004 + lift * 0.055);
      // 同一批表面粒子先离开月面，再流向横向的低云；回滚时沿原路收拢。
      p.x += age * (1.4 + 0.5 * sin(aPhase * 2.0));
      p.y += lift * sin(aPhase + uTime * 0.07) * 0.04 + age * sin(p.x * 2.0 + aPhase) * 0.22;
      p.z += lift * 0.08 + age * sin(aPhase * 3.0) * 0.18;
      float sun = max(dot(n, uLight), 0.0);
      float visibility = smoothstep(-0.05, 0.15, dot(n, uLight));
      float pigment = clamp(0.12 + pow(1.0 - albedo, 1.15) * 0.68 + (1.0 - sun) * 0.1, 0.08, 0.78);
      vec3 day = mix(uPaper, uMoonShade, pigment);
      vec3 night = mix(uPaper, uMoonLight, (0.14 + albedo * 0.82) * (0.4 + 0.6 * sqrt(sun)));
      vColor = mix(day, night, uDark);
      vAlpha = release * visibility * (0.52 + 0.14 * sin(aPhase + uTime * 0.10)) * (1.0 - smoothstep(0.50, 1.0, age));
    }
    vec4 pos = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * pos;
    gl_PointSize = clamp(aSize * uPixelRatio * uCamZ / -pos.z, 1.0, 4.0 * uPixelRatio);
  }
`;

const dustFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    if (vAlpha < 0.002) discard;
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float grain = 1.0 - smoothstep(0.18, 0.5, r);
    gl_FragColor = vec4(vColor, grain * vAlpha);
    #include <colorspace_fragment>
  }
`;

const veilVertex = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const veilFragment = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uCamZ;
  uniform vec3 uInk;
  uniform float uDark;
  void main() {
    vec2 p = gl_FragCoord.xy / uRes * 2.0 - 1.0;
    p.x *= uRes.x / uRes.y;
    vec2 q = p * vec2(0.28, 1.6);
    float a = texture2D(uClouds, q + vec2(uTime * 0.002, 0.3)).r;
    float b = texture2D(uClouds, q * vec2(0.7, 1.3) - vec2(uTime * 0.0013, 0.6)).r;
    float cloud = smoothstep(0.36, 0.75, a * 0.65 + b * 0.35);
    float band = exp(-pow((p.y + 0.15) * 3.2, 2.0));
    float radius = 1.0 / (tan(radians(16.0)) * sqrt(uCamZ * uCamZ - 1.0));
    float ring = exp(-pow((length(p) / radius - 1.08) / 0.16, 2.0));
    float alpha = cloud * band * mix(0.060, 0.085, uDark) + ring * mix(0.008, 0.009, uDark);
    gl_FragColor = vec4(uInk, alpha);
    #include <colorspace_fragment>
  }
`;

function dustGeometry() {
  const ambient = 420, count = ambient + 14000;
  const random = randomSource(19690720);
  const positions = new Float32Array(count * 3), sizes = new Float32Array(count), phases = new Float32Array(count);
  const kinds = new Float32Array(count), uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const u = random(), v = Math.acos(random() * 2 - 1) / Math.PI;
    const theta = u * Math.PI * 2, phi = v * Math.PI;
    const radius = i < ambient ? 1.12 + Math.pow(random(), 1.7) * 0.72 : 1;
    positions[i * 3] = -Math.sin(phi) * Math.cos(theta) * radius;
    positions[i * 3 + 1] = Math.cos(phi) * radius;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    uvs[i * 2] = u; uvs[i * 2 + 1] = 1 - v;
    sizes[i] = i < ambient ? 0.85 + random() * 1.2 : 1.0 + random() * 0.95;
    phases[i] = random() * Math.PI * 2;
    kinds[i] = i < ambient ? 1 : 0;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
  geometry.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2));
  return geometry;
}

function cssColor(name: string) {
  return new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
}

let live: { canvas: HTMLCanvasElement; dispose: () => void; sync: () => void } | null = null;
function teardown() {
  live?.dispose();
  live = null;
}

function boot() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-lunar]');
  const cover = document.querySelector<HTMLElement>('[data-cover]');
  if (live?.canvas === canvas) return;
  teardown();
  if (!canvas || !cover) return;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch {
    document.documentElement.classList.add('no-webgl');
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const controller = new AbortController();
  const { signal } = controller;
  const surface = moonTexture(), clouds = cloudTexture();
  const uniforms = {
    uSurface: { value: surface }, uClouds: { value: clouds },
    uPaper: { value: cssColor('--bg') }, uInk: { value: cssColor('--text') },
    uMoonShade: { value: new THREE.Color('#625b53') }, uMoonLight: { value: new THREE.Color('#c7c7be') },
    uLight: { value: new THREE.Vector3(0.46, 0.15, 0.875).normalize() },
    uCameraLight: { value: new THREE.Vector3() }, uMoonRotation: { value: new THREE.Matrix3() },
    uAlbedo: { value: surface as THREE.Texture }, uHeight: { value: surface as THREE.Texture },
    uMapsReady: { value: 0 }, uProgress: { value: 0 },
    uDark: { value: document.documentElement.dataset.theme === 'dark' ? 1 : 0 },
    uTime: { value: 0 }, uPixelRatio: { value: 1 }, uCamZ: { value: 5.2 },
    uRes: { value: new THREE.Vector2(1, 1) },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  const moonGeometry = new THREE.SphereGeometry(1, 64, 48);
  const moonMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: moonVertex, fragmentShader: moonFragment, transparent: true });
  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
  // 先倾斜转轴，再绕月球自身的轴旋转；表面粒子共享这个矩阵。
  moon.rotation.order = 'ZYX';
  moon.rotation.z = 0.08;
  moon.renderOrder = 0;
  scene.add(moon);

  // 三维表面墨粒和少量环境浮尘，共用月球的深度遮挡。窄屏减少表面采样。
  const particleGeometry = dustGeometry();
  const particleMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: dustVertex, fragmentShader: dustFragment, transparent: true, depthWrite: false });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  particles.renderOrder = 1;
  scene.add(particles);

  const veilGeometry = new THREE.PlaneGeometry(2, 2);
  const veilMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: veilVertex, fragmentShader: veilFragment, transparent: true, depthTest: false, depthWrite: false });
  const veil = new THREE.Mesh(veilGeometry, veilMaterial);
  veil.frustumCulled = false;
  veil.renderOrder = 2;
  scene.add(veil);

  let disposed = false, lost = false, raf = 0, last = 0, elapsed = 0, spin = 0;
  let progress = 0, targetProgress = 0, mapsLoaded = 0;
  const pointer = new THREE.Vector2(), targetPointer = new THREE.Vector2();
  const loadedTextures: THREE.Texture[] = [];
  const rect = cover.getBoundingClientRect();
  let inView = rect.bottom > 0 && rect.top < innerHeight;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  function render() {
    uniforms.uTime.value = elapsed;
    moon.rotation.y = -Math.PI / 2 + 0.10 - spin;
    moon.updateMatrixWorld();
    uniforms.uMoonRotation.value.setFromMatrix4(moon.matrixWorld);
    const phase = 0.48 + Math.sin(elapsed * 0.035) * 0.10 + progress * 0.45;
    uniforms.uLight.value.set(Math.sin(phase), Math.sin(phase) * 0.28, Math.cos(phase)).normalize();
    pointer.lerp(targetPointer, 0.07);
    camera.position.x = pointer.x * 0.055;
    camera.position.y = pointer.y * 0.035;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    uniforms.uCameraLight.value.copy(uniforms.uLight.value).transformDirection(camera.matrixWorldInverse);
    uniforms.uProgress.value = motion.matches ? 0 : progress;
    if (mapsLoaded === 2) uniforms.uMapsReady.value = motion.matches || !raf ? 1 : Math.min(1, uniforms.uMapsReady.value + 0.10);
    cover!.style.setProperty('--lunar-intro', (1 - smooth(0.08, 0.45, uniforms.uProgress.value)).toFixed(3));
    renderer.render(scene, camera);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }
  function frame(now: number) {
    const delta = last ? Math.max(0, (now - last) / 1000) : 0;
    last = now;
    elapsed += delta;
    progress += (targetProgress - progress) * 0.12;
    // 用实际帧间隔保持自转速度一致，消散时渐停，避免云带跟着月球转动。
    // stop() 会重置上一帧时间，恢复可见或关闭减少动态效果时不会突然跳转。
    const rotationSpeed = 1 - smooth(0.02, 0.18, progress);
    spin = (spin + delta * Math.PI * 2 / MOON_ROTATION_SECONDS * rotationSpeed) % (Math.PI * 2);
    render();
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    if (disposed || lost || document.hidden || !inView || motion.matches) stop();
    else if (!raf) raf = requestAnimationFrame(frame);
  }
  function resize() {
    const w = cover!.clientWidth, h = cover!.clientHeight;
    if (!w || !h) return;
    const ratio = Math.min(devicePixelRatio || 1, w < 768 ? 1.5 : 1.75);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = (w < 768 ? 4.85 : 5.2) / Math.min(w / h, 1);
    particleGeometry.setDrawRange(0, w < 768 ? 5000 : 14420);
    camera.updateProjectionMatrix();
    uniforms.uCamZ.value = camera.position.z;
    uniforms.uPixelRatio.value = ratio;
    uniforms.uRes.value.set(w * ratio, h * ratio);
    if (!lost && !document.hidden) render();
  }
  function theme() {
    uniforms.uPaper.value.copy(cssColor('--bg'));
    uniforms.uInk.value.copy(cssColor('--text'));
    uniforms.uDark.value = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
    renderer.setClearColor(uniforms.uPaper.value);
    if (!lost && !document.hidden) render();
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    if (disposed) return;
    lost = true;
    stop();
    document.documentElement.classList.add('no-webgl');
  }, { signal });
  function onScroll() {
    targetProgress = motion.matches ? 0 : Math.min(1, Math.max(0, -cover!.getBoundingClientRect().top) / (cover!.clientHeight * 0.72));
    if (motion.matches) { progress = 0; if (!lost && !document.hidden) render(); }
  }
  cover.addEventListener('pointermove', (event) => {
    if (motion.matches) return;
    const box = cover.getBoundingClientRect();
    targetPointer.set((event.clientX - box.left) / box.width * 2 - 1, 1 - (event.clientY - box.top) / box.height * 2);
  }, { passive: true, signal });
  cover.addEventListener('pointerleave', () => targetPointer.set(0, 0), { signal });
  window.addEventListener('scroll', onScroll, { passive: true, signal });
  window.addEventListener('resize', () => { resize(); onScroll(); }, { passive: true, signal });
  motion.addEventListener('change', () => {
    sync();
    onScroll();
    if (motion.matches && !lost && !document.hidden) render();
  }, { signal });
  const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); });
  io.observe(cover);
  const themeObserver = new MutationObserver(theme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  document.documentElement.classList.remove('no-webgl');
  theme();
  resize();
  onScroll();
  progress = targetProgress;
  sync();
  const loader = new THREE.TextureLoader();
  function loadMap(url: string, uniform: typeof uniforms.uAlbedo, color: boolean) {
    const texture = loader.load(url, (loaded) => {
      if (disposed) { loaded.dispose(); return; }
      uniform.value = loaded;
      mapsLoaded++;
      if (!lost && !document.hidden) render();
    });
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    loadedTextures.push(texture);
  }
  loadMap(albedoUrl, uniforms.uAlbedo, true);
  loadMap(heightUrl, uniforms.uHeight, false);
  live = {
    canvas, sync,
    dispose() {
      disposed = true;
      stop();
      controller.abort();
      io.disconnect();
      themeObserver.disconnect();
      moonGeometry.dispose(); particleGeometry.dispose(); veilGeometry.dispose();
      moonMaterial.dispose(); particleMaterial.dispose(); veilMaterial.dispose();
      surface.dispose(); clouds.dispose();
      loadedTextures.forEach(texture => texture.dispose());
      scene.clear();
      renderer.forceContextLoss();
      renderer.dispose();
    },
  };
}

document.addEventListener('visibilitychange', () => live?.sync());
document.addEventListener('astro:before-swap', teardown);
document.addEventListener('astro:page-load', boot);
boot();
