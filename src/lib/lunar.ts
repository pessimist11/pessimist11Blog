import * as THREE from 'three';
import albedoSmallUrl from '../assets/moon/lroc-albedo.webp?url';
import albedoLargeUrl from '../assets/moon/lroc-albedo-4k.webp?url';
import normalSmallUrl from '../assets/moon/lola-normal-2k.webp?url';
import normalLargeUrl from '../assets/moon/lola-normal-4k.webp?url';

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const ease = (start: number, end: number, value: number) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};
function randomSource(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// The surface and its grains share one release front, in world-space normals.
// This keeps every grain attached to the correct crater while the moon turns.
const releaseField = /* glsl */ `
  float surfaceOrder(vec3 normal, float albedo) {
    return 0.5 + dot(normal.xy, vec2(0.927, 0.375)) * 0.35 + (albedo - 0.6) * 0.18;
  }
  float erosionFront(float progress) {
    return mix(0.33, 1.23, smoothstep(0.04, 0.84, progress));
  }
  float releaseAt(vec3 normal, float albedo, float progress) {
    float order = surfaceOrder(normal, albedo);
    return smoothstep(order - 0.13, order + 0.13, erosionFront(progress));
  }
`;

const moonVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal, vPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 point = modelViewMatrix * vec4(position, 1.0);
    vPosition = point.xyz;
    gl_Position = projectionMatrix * point;
  }
`;
const moonFragment = /* glsl */ `
  uniform sampler2D uAlbedo, uNormal;
  uniform vec3 uPaper, uShade, uHighlight, uLight;
  uniform float uDark, uProgress;
  varying vec2 vUv;
  varying vec3 vNormal, vPosition;
  ${releaseField}
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 dx = dFdx(vPosition), dy = dFdy(vPosition);
    vec2 uvx = dFdx(vUv), uvy = dFdy(vUv);
    vec3 tangent = normalize(dx * uvy.y - dy * uvx.y);
    vec3 bitangent = normalize(-dx * uvy.x + dy * uvx.x);
    vec3 terrain = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
    terrain.xy *= 0.75;
    vec3 detail = normalize(mat3(tangent, bitangent, normal) * normalize(terrain));
    float albedo = pow(max(dot(texture2D(uAlbedo, vUv).rgb,
      vec3(0.2126, 0.7152, 0.0722)), 0.001), 0.4545);
    float sun = dot(normal, uLight), relief = dot(detail, uLight);
    float day = smoothstep(-0.04, 0.075, sun +
      clamp(relief - sun, -0.22, 0.22) * 0.12 * exp(-abs(sun) * 14.0));
    float pigment = clamp(0.18 + pow(1.0 - albedo, 1.3) * 0.76 +
      pow(1.0 - max(sun, 0.0), 1.7) * 0.12 + clamp((sun - relief) * 1.35, -0.22, 0.22), 0.10, 0.88);
    vec3 paperMoon = mix(uPaper, uShade, pigment);
    float brightness = clamp((0.32 + albedo * 0.76) *
      (0.44 + 0.56 * pow(max(relief, 0.0), 0.38)), 0.07, 1.0);
    vec3 inkMoon = mix(uShade, uHighlight, pow(brightness, 1.18));
    vec3 earthshine = mix(uPaper, mix(uShade, uHighlight, uDark), 0.008 + albedo * 0.014);
    vec3 color = mix(earthshine, mix(paperMoon, inkMoon, uDark), day);
    float opacity = 1.0 - releaseAt(normal, albedo, uProgress);
    if (opacity < 0.003) discard;
    gl_FragColor = vec4(color, opacity);
    #include <colorspace_fragment>
  }
`;


// Both pigment and moving grains settle along this spatial field. There is no
// clock in the reveal, so a paused or reversed scroll keeps the image stable.
const photoFormation = /* glsl */ `
  float photoHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float photoNoise(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(photoHash(cell), photoHash(cell + vec2(1.0, 0.0)), f.x),
      mix(photoHash(cell + vec2(0.0, 1.0)), photoHash(cell + 1.0), f.x), f.y);
  }
  float photoArrival(vec2 uv, float progress) {
    vec2 q = (uv - vec2(0.53, 0.51)) * vec2(0.92, 1.08);
    float order = clamp(length(q) * 1.25 + (photoNoise(uv * 5.4) - 0.5) * 0.22, 0.0, 1.0);
    return smoothstep(0.50 + order * 0.12, 0.84 + order * 0.12, progress);
  }
  float photoCoverage(float arrival) { return smoothstep(0.48, 0.99, arrival); }
  vec2 photoUv(vec2 uv, vec2 viewport, float aspect) {
    float frame = viewport.x / viewport.y;
    vec2 crop = vec2(min(1.0, frame / aspect), min(1.0, aspect / frame));
    return (uv - 0.5) * crop + 0.5;
  }
`;
const photoVertex = /* glsl */ `
  uniform vec2 uViewport;
  uniform float uPhotoScale;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 point = vec3(position.xy * uViewport * uPhotoScale, 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
  }
`;
const photoFragment = /* glsl */ `
  uniform sampler2D uPhoto;
  uniform vec2 uViewport;
  uniform float uProgress, uPhotoAspect;
  varying vec2 vUv;
  ${photoFormation}
  void main() {
    float coverage = photoCoverage(photoArrival(vUv, uProgress));
    float grain = photoHash(floor(vUv * uViewport * 1.3));
    float opacity = smoothstep(grain * 0.24, 0.60 + grain * 0.40, coverage);
    if (opacity < 0.002) discard;
    gl_FragColor = vec4(texture2D(uPhoto, photoUv(vUv, uViewport, uPhotoAspect)).rgb, opacity);
    #include <colorspace_fragment>
  }
`;

const particleVertex = /* glsl */ `
  uniform sampler2D uAlbedo, uPhoto;
  uniform float uPhotoReady, uPhotoAspect, uPhotoScale;
  uniform mat3 uRotation;
  uniform vec3 uCenter, uPaper, uShade, uHighlight, uLight;
  uniform vec2 uViewport;
  uniform float uRadius, uTime, uProgress, uDark, uDpr;
  attribute vec3 aSeed;
  attribute vec2 aUv;
  varying vec3 vColor;
  varying float vAlpha;
  ${releaseField}
  ${photoFormation}
  void main() {
    vec3 normal = normalize(uRotation * position);
    float albedo = pow(max(dot(texture2D(uAlbedo, aUv).rgb,
      vec3(0.2126, 0.7152, 0.0722)), 0.001), 0.4545);
    float release = releaseAt(normal, albedo, uProgress);
    float age = erosionFront(uProgress) - surfaceOrder(normal, albedo);
    float lift = smoothstep(0.02, 0.85, release);
    vec3 shell = uCenter + normal * uRadius * (1.003 + lift * 0.045);
    shell += vec3(-normal.y, normal.x, 0.25) * sin(lift * 3.14159) * uRadius * 0.045;

    // Peel locally first, then carry the same grains into horizontal cloud lanes.
    float travel = smoothstep(0.045, 0.46, age);
    float lane = floor(aSeed.z * 5.0);
    float flowX = aSeed.x * 1.2;
    vec3 stream = vec3(
      uCenter.x - uRadius * 0.48 - flowX * uViewport.x,
      (sin(flowX * 7.1 + lane * 0.38 + uTime * 0.018) * 0.055 +
        (lane - 2.0) * 0.032 + (aSeed.y - 0.5) * 0.08 - 0.09) * uViewport.y,
      (aSeed.z - 0.5) * uRadius * 0.65);
    vec3 point = mix(shell, stream, travel);
    float wind = fract(aSeed.z + uTime * 0.045);
    point.x -= wind * uRadius * 0.18 * release * (1.0 - travel);
    point.y += sin(aSeed.z * 6.28 + uTime * 0.12) * uRadius * 0.007 * release;

    float sun = max(dot(normal, uLight), 0.0);
    float pigment = clamp(0.18 + pow(1.0 - albedo, 1.3) * 0.76 + pow(1.0 - sun, 1.7) * 0.12, 0.1, 0.88);
    // Paper needs darker pigment than the lunar surface to keep tiny grains
    // legible against its bright background, including the first local peel.
    vec3 paperGrain = mix(uPaper, uShade, clamp(0.58 + pigment * 0.48, 0.62, 0.95));
    vec3 inkGrain = mix(uShade, uHighlight, clamp((0.32 + albedo * 0.76) * (0.44 + 0.56 * pow(sun, 0.38)), 0.07, 1.0));
    vColor = mix(paperGrain, inkGrain, uDark);
    float facing = mix(smoothstep(-0.05, 0.15, normal.z), 1.0, travel);
    float windFade = smoothstep(0.0, 0.07, wind) * (1.0 - smoothstep(0.88, 1.0, wind));
    vAlpha = smoothstep(0.0, 0.42, release) * mix(0.96, 0.82, uDark) * facing;
    vAlpha *= mix(1.0, windFade, release * (1.0 - travel));
    if (uPhotoReady > 0.5) {
      float arrival = photoArrival(aSeed.xy, uProgress);
      vec3 destination = vec3((aSeed.xy - 0.5) * uViewport * uPhotoScale, 1.0);
      point = mix(point, destination, arrival);
      point.xy += vec2(sin(aSeed.z * 6.283), cos(aSeed.z * 6.283)) *
        uRadius * 0.10 * sin(arrival * 3.14159);
      vec3 pigment = texture2D(uPhoto, photoUv(aSeed.xy, uViewport, uPhotoAspect)).rgb;
      vColor = mix(vColor, pigment, smoothstep(0.04, 0.72, arrival));
      vAlpha = mix(vAlpha, 0.88, smoothstep(0.0, 0.22, arrival));
      vAlpha *= 1.0 - photoCoverage(arrival);
    } else {
      vAlpha *= 1.0 - smoothstep(0.77, 0.99, uProgress);
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
    gl_PointSize = mix(1.0 + aSeed.y * 0.55, 0.72 + aSeed.y * 0.5, uDark) * uDpr;
    if (vAlpha < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const particleFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    if (radius > 1.0) discard;
    gl_FragColor = vec4(vColor, vAlpha * (1.0 - smoothstep(0.15, 1.0, radius)));
    #include <colorspace_fragment>
  }
`;

// A small repeating volume supplies continuous, grain-free cloud detail.
let noiseData: Uint8Array | undefined;
function cloudNoise() {
  const size = 48;
  if (!noiseData) {
    const random = randomSource(19720817);
    const coarse = Float32Array.from({ length: 16 ** 3 }, random);
    const sample = (x: number, y: number, z: number) => coarse[((x % 16 + 16) % 16) + ((y % 16 + 16) % 16) * 16 + ((z % 16 + 16) % 16) * 256];
    const noise = (x: number, y: number, z: number) => {
      const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
      const fx = ease(0, 1, x - ix), fy = ease(0, 1, y - iy), fz = ease(0, 1, z - iz);
      const mix = THREE.MathUtils.lerp;
      return mix(mix(mix(sample(ix, iy, iz), sample(ix + 1, iy, iz), fx), mix(sample(ix, iy + 1, iz), sample(ix + 1, iy + 1, iz), fx), fy),
        mix(mix(sample(ix, iy, iz + 1), sample(ix + 1, iy, iz + 1), fx), mix(sample(ix, iy + 1, iz + 1), sample(ix + 1, iy + 1, iz + 1), fx), fy), fz);
    };
    noiseData = new Uint8Array(size ** 3);
    for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      noiseData[x + y * size + z * size * size] = Math.round(noise(x / 3, y / 3, z / 3) * 255);
    }
  }
  const texture = new THREE.Data3DTexture(noiseData, size, size, size);
  texture.format = THREE.RedFormat;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

const cloudVertex = /* glsl */ `
  out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const cloudFragment = /* glsl */ `
  precision highp sampler3D;
  uniform sampler3D uNoise;
  uniform vec3 uInk;
  uniform float uTime, uProgress, uDark, uMobile;
  in vec2 vUv;
  out vec4 outColor;
  float density(vec3 point) {
    vec3 p = point * vec3(0.55, 0.7, 0.55) + vec3(uTime * 0.0015, 0.0, uTime * 0.0008);
    float cloud = texture(uNoise, p).r * 0.58 + texture(uNoise, p * 2.03 + 0.19).r * 0.28 +
      texture(uNoise, p * 4.07 - 0.37).r * 0.14;
    return smoothstep(0.32, 0.73, cloud);
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float gather = smoothstep(0.12, 0.68, uProgress);
    float spread = mix(0.10, 0.37, gather);
    float opacity = 0.0;
    for (int i = 0; i < 20; i++) {
      float z = (float(i) + 0.5) / 10.0 - 1.0;
      float curl = sin(p.x * 3.8 + z * 1.4 + uTime * 0.017) * 0.055;
      float upper = mix(-0.06 - uMobile * 0.14, -0.04, gather) + curl;
      float lower = mix(-0.69, -0.11, gather) + sin(p.x * 2.5 - z + uTime * 0.012) * 0.07;
      float ribbon = exp(-pow((p.y - upper) / spread, 2.0)) * 0.7 +
        exp(-pow((p.y - lower) / (spread * 1.4), 2.0)) * 0.52;
      float fade = exp(-z * z * 3.6) * smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x));
      float sampleAlpha = density(vec3(p.x * 1.1, p.y * 0.85, z)) * ribbon * fade * 0.085;
      opacity += (1.0 - opacity) * sampleAlpha;
    }
    opacity *= mix(0.50, 0.85, uDark) * (1.0 - smoothstep(0.72, 0.98, uProgress));
    outColor = vec4(uInk, opacity);
  }
`;

function particles(count: number) {
  const random = randomSource(19690720);
  const positions = new Float32Array(count * 3), uvs = new Float32Array(count * 2), seeds = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const u = random(), phi = Math.acos(random() * 2 - 1), theta = u * Math.PI * 2;
    positions.set([-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)], index * 3);
    uvs.set([u, 1 - phi / Math.PI], index * 2);
    seeds.set([random(), random(), random()], index * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  return geometry;
}

let live: { canvas: HTMLCanvasElement; dispose: () => void; sync: () => void } | null = null;
function teardown() { live?.dispose(); live = null; }

function boot() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-lunar]');
  const cover = document.querySelector<HTMLElement>('[data-cover]');
  const stage = cover?.querySelector<HTMLElement>('[data-lunar-stage]');
  const art = stage?.querySelector<HTMLElement>('.cover-art');
  const photoImage = stage?.querySelector<HTMLImageElement>('.cover-photo img');
  const cue = stage?.querySelector<HTMLElement>('.cover-cue');
  const nav = document.querySelector<HTMLElement>('nav[data-home-nav]');
  if (live?.canvas === canvas) return;
  teardown();
  if (!canvas || !cover || !stage || !art) return;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch { cover.dataset.renderer = 'fallback'; return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const controller = new AbortController(), { signal } = controller;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
  camera.position.z = 1800;
  const paper = new THREE.Color(), shade = new THREE.Color(), highlight = new THREE.Color(), ink = new THREE.Color();
  const uniforms = {
    uPhoto: { value: null as THREE.Texture | null }, uPhotoReady: { value: 0 },
    uPhotoAspect: { value: 1 }, uPhotoScale: { value: 1 },
    uAlbedo: { value: null as THREE.Texture | null }, uNormal: { value: null as THREE.Texture | null },
    uPaper: { value: paper }, uShade: { value: shade }, uHighlight: { value: highlight },
    uLight: { value: new THREE.Vector3(0.46, 0.15, 0.875).normalize() },
    uDark: { value: 0 }, uProgress: { value: 0 }, uTime: { value: 0 },
    uRotation: { value: new THREE.Matrix3() }, uCenter: { value: new THREE.Vector3() },
    uRadius: { value: 1 }, uViewport: { value: new THREE.Vector2() }, uDpr: { value: 1 },
  };
  const moonGeometry = new THREE.SphereGeometry(1, 160, 112);
  const moonMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: moonVertex, fragmentShader: moonFragment, transparent: true });
  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
  moon.renderOrder = 1;
  scene.add(moon);
  const particleGeometry = particles(128000);
  const particleMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: particleVertex, fragmentShader: particleFragment, transparent: true, depthWrite: false });
  const dust = new THREE.Points(particleGeometry, particleMaterial);
  dust.frustumCulled = false;
  dust.renderOrder = 4;
  scene.add(dust);
  const photoGeometry = new THREE.PlaneGeometry(1, 1);
  const photoMaterial = new THREE.ShaderMaterial({
    uniforms, vertexShader: photoVertex, fragmentShader: photoFragment,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const photograph = new THREE.Mesh(photoGeometry, photoMaterial);
  photograph.frustumCulled = false;
  photograph.renderOrder = 3;
  photograph.visible = false;
  scene.add(photograph);

  const noise = cloudNoise();
  const cloudUniforms = {
    uNoise: { value: noise }, uInk: { value: ink }, uTime: uniforms.uTime,
    uProgress: uniforms.uProgress, uDark: uniforms.uDark, uMobile: { value: 0 },
  };
  const cloudMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: cloudUniforms, vertexShader: cloudVertex, fragmentShader: cloudFragment,
    depthTest: false, depthWrite: false,
  });
  const cloudGeometry = new THREE.PlaneGeometry(2, 2);
  const cloudScene = new THREE.Scene(), cloudCamera = new THREE.Camera();
  cloudScene.add(new THREE.Mesh(cloudGeometry, cloudMaterial));
  const cloudTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
  const cloudComposite = new THREE.ShaderMaterial({
    uniforms: { uCloud: { value: cloudTarget.texture } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uCloud;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(uCloud, vUv);
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const clouds = new THREE.Mesh(cloudGeometry, cloudComposite);
  clouds.renderOrder = 0;
  scene.add(clouds);
  const textures: THREE.Texture[] = [];
  const rotation = new THREE.Matrix4();
  const pointer = new THREE.Vector2(), targetPointer = new THREE.Vector2();
  let disposed = false, ready = false, visible = true, raf = 0, last = 0;
  let photoTexture: THREE.Texture | undefined, photoBitmap: ImageBitmap | undefined;
  let photoRequest = 0;
  let progress = 0, targetProgress = 0, elapsed = 0, width = 1, height = 1, mobile = false;

  function stop() { cancelAnimationFrame(raf); raf = 0; last = 0; }
  function canDraw() { return ready && !disposed && visible && !document.hidden; }
  function requestFrame() { if (!raf && canDraw()) raf = requestAnimationFrame(frame); }
  function syncHeader() {
    if (!nav) return;
    const bounds = cover!.getBoundingClientRect();
    const overHero = !motion.matches && cover!.dataset.renderer === 'three' &&
      bounds.top <= nav.offsetHeight && bounds.bottom > nav.offsetHeight;
    if (overHero) {
      nav.dataset.heroTone = progress > 0.83 ? 'photo' : 'moon';
      nav.style.setProperty('--hero-photo', String(ease(0.72, 0.92, progress)));
    } else {
      delete nav.dataset.heroTone;
      nav.style.removeProperty('--hero-photo');
    }
  }
  function setProgress() {
    const distance = Math.max(1, cover!.offsetHeight - stage!.offsetHeight);
    const top = parseFloat(getComputedStyle(stage!).top) || 0;
    targetProgress = motion.matches ? 0 : clamp((top - cover!.getBoundingClientRect().top) / distance);
    syncHeader();
    requestFrame();
  }
  function render() {
    const radius = Math.min(width * (mobile ? 0.43 : 0.255), height * (mobile ? 0.255 : 0.35));
    const center = uniforms.uCenter.value.set(width * (mobile ? 0.08 : 0.19) + pointer.x * 7,
      height * (mobile ? -0.11 : 0.055) + pointer.y * 5, 0);
    moon.position.copy(center);
    moon.scale.setScalar(radius);
    // Slow axial rotation keeps the crater relief legible throughout the scene.
    moon.rotation.set(0, -Math.PI / 2 + 0.62 + elapsed * 0.0072, 0.11);
    uniforms.uRotation.value.setFromMatrix4(rotation.makeRotationFromEuler(moon.rotation));
    uniforms.uRadius.value = radius;
    uniforms.uTime.value = elapsed;
    uniforms.uProgress.value = progress;
    moon.visible = progress < 0.88;
    const photoReady = uniforms.uPhotoReady.value > 0;
    uniforms.uPhotoScale.value = 0.9 + ease(0.58, 0.98, progress) * 0.1;
    photograph.visible = photoReady && progress > 0.5;
    cover!.style.setProperty('--lunar-photo', String(photoReady ? ease(0.94, 0.98, progress) : ease(0.68, 0.98, progress)));
    cover!.style.setProperty('--lunar-grain', String(1 - ease(0.62, 0.94, progress)));
    if (cue) cue.inert = progress > 0.16;
    cover!.style.setProperty('--lunar-intro', String(1 - ease(0.2, 0.52, progress)));
    cover!.style.setProperty('--lunar-cue', String(1 - ease(0.02, 0.16, progress)));
    cover!.style.setProperty('--lunar-scene', String(1 - (photoReady ? ease(0.985, 1, progress) : ease(0.68, 0.98, progress))));
    cover!.dataset.lunarProgress = progress.toFixed(3);
    cover!.dataset.lunarState = progress < 0.2 ? 'surface' : progress < 0.65 ? 'release' : progress < 0.9 ? 'cloud' : 'photo';
    renderer.setRenderTarget(cloudTarget);
    renderer.setClearColor(0, 0);
    renderer.render(cloudScene, cloudCamera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(paper, 1);
    renderer.render(scene, camera);
    cover!.dataset.renderer = 'three';
    syncHeader();
  }
  function frame(now: number) {
    raf = 0;
    if (!canDraw()) return;
    if (!motion.matches && last && now - last < 1000 / (mobile ? 30 : 45)) { requestFrame(); return; }
    const delta = last ? Math.min(0.08, (now - last) / 1000) : 1 / 45;
    last = now;
    const blend = motion.matches ? 1 : 1 - Math.exp(-delta * 5);
    progress += (targetProgress - progress) * blend;
    if (Math.abs(progress - targetProgress) < 0.0001) progress = targetProgress;
    pointer.lerp(targetPointer, blend);
    if (!motion.matches) elapsed += delta;
    render();
    if (!motion.matches && (progress < 0.995 || Math.abs(progress - targetProgress) > 0.0001)) requestFrame();
  }
  function resize() {
    if (disposed) return;
    width = art!.clientWidth; height = art!.clientHeight;
    if (!width || !height) return;
    mobile = width <= 700;
    const ratio = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.85);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.left = -width / 2; camera.right = width / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    uniforms.uViewport.value.set(width, height);
    uniforms.uDpr.value = ratio;
    cloudUniforms.uMobile.value = Number(mobile);
    // Volumetric haze can be rendered softly; the lunar surface remains full resolution.
    cloudTarget.setSize(Math.max(1, Math.ceil(width * 0.55)), Math.max(1, Math.ceil(height * 0.55)));
    clouds.scale.set(width / 2, height / 2, 1);
    particleGeometry.setDrawRange(0, mobile ? 42000 : 128000);
    cover!.dataset.particleCount = String(mobile ? 42000 : 128000);
    setProgress();
  }
  function palette() {
    if (disposed) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    paper.set(getComputedStyle(cover!).getPropertyValue('--bg').trim());
    shade.set(dark ? '#252b29' : '#555653');
    highlight.set(dark ? '#d2d5cf' : '#f6f4ef');
    ink.set(dark ? '#8b918a' : '#66685f');
    uniforms.uDark.value = Number(dark);
    requestFrame();
  }
  function sync() { if (canDraw()) { setProgress(); requestFrame(); } else stop(); }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(art);
  const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  visibilityObserver.observe(cover);
  const themeObserver = new MutationObserver(palette);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  stage.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || motion.matches) return;
    const bounds = stage!.getBoundingClientRect();
    targetPointer.set((event.clientX - bounds.left) / bounds.width - 0.5, 0.5 - (event.clientY - bounds.top) / bounds.height);
    requestFrame();
  }, { signal, passive: true });
  stage.addEventListener('pointerleave', () => { targetPointer.set(0, 0); requestFrame(); }, { signal });
  window.addEventListener('scroll', setProgress, { signal, passive: true });
  document.addEventListener('visibilitychange', sync, { signal });
  motion.addEventListener('change', () => { stop(); resize(); }, { signal });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); dispose(); }, { signal });

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop(); controller.abort();
    resizeObserver.disconnect(); visibilityObserver.disconnect(); themeObserver.disconnect();
    moonGeometry.dispose(); moonMaterial.dispose(); particleGeometry.dispose(); particleMaterial.dispose();
    noise.dispose(); cloudGeometry.dispose(); cloudMaterial.dispose(); cloudComposite.dispose(); cloudTarget.dispose();
    photoGeometry.dispose(); photoMaterial.dispose();
    textures.forEach(texture => texture.dispose());
    photoTexture?.dispose(); photoBitmap?.close();
    renderer.dispose(); renderer.forceContextLoss();
    cover!.dataset.renderer = 'fallback';
    cover!.style.removeProperty('--lunar-intro'); cover!.style.removeProperty('--lunar-cue'); cover!.style.removeProperty('--lunar-scene');
    cover!.style.removeProperty('--lunar-photo');
    cover!.style.removeProperty('--lunar-grain');
    if (cue) cue.inert = false;
    delete cover!.dataset.photoReady;
    if (nav) { delete nav.dataset.heroTone; nav.style.removeProperty('--hero-photo'); }
  }
  // Upload the browser's decoded photo at its intrinsic pixel dimensions.
  // The displayed <img> has CSS dimensions (and srcset density correction),
  // which cannot size an immutable GPU texture. Reusing its bitmap avoids
  // another image request and preserves the exact object-fit crop at handoff.
  if (photoImage) {
    const updatePhoto = async () => {
      if (disposed || !photoImage.complete || !photoImage.naturalWidth) return;
      const request = ++photoRequest;
      let source: ImageBitmap | HTMLCanvasElement;
      let bitmap: ImageBitmap | undefined;
      try {
        bitmap = await createImageBitmap(photoImage, {
          imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none',
        });
        source = bitmap;
      } catch {
        const buffer = document.createElement('canvas');
        buffer.width = photoImage.naturalWidth; buffer.height = photoImage.naturalHeight;
        const context = buffer.getContext('2d');
        if (!context) return;
        context.drawImage(photoImage, 0, 0, buffer.width, buffer.height);
        source = buffer;
      }
      if (disposed || request !== photoRequest) { bitmap?.close(); return; }
      photoTexture?.dispose(); photoBitmap?.close();
      photoBitmap = bitmap;
      photoTexture = new THREE.Texture(source);
      photoTexture.colorSpace = THREE.SRGBColorSpace;
      photoTexture.flipY = !bitmap;
      photoTexture.minFilter = THREE.LinearFilter;
      photoTexture.generateMipmaps = false;
      photoTexture.needsUpdate = true;
      uniforms.uPhoto.value = photoTexture;
      uniforms.uPhotoAspect.value = source.width / source.height;
      uniforms.uPhotoReady.value = 1;
      cover!.dataset.photoReady = 'true';
      requestFrame();
    };
    photoImage.addEventListener('load', updatePhoto, { signal });
    if (photoImage.complete) void updatePhoto();
  }
  live = { canvas, dispose, sync };
  cover.dataset.renderer = 'loading';
  palette(); resize();
  const loader = new THREE.TextureLoader();
  let loaded = 0;
  function load(url: string, uniform: typeof uniforms.uAlbedo, color: boolean) {
    const texture = loader.load(url, value => {
      if (disposed) return;
      uniform.value = value;
      ready = ++loaded === 2;
      if (ready) { progress = targetProgress; requestFrame(); }
    }, undefined, dispose);
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.push(texture);
  }
  load(mobile ? albedoSmallUrl : albedoLargeUrl, uniforms.uAlbedo, true);
  load(mobile ? normalSmallUrl : normalLargeUrl, uniforms.uNormal, false);
  cover.dataset.moonResolution = mobile ? '2048' : '4096';
}

document.addEventListener('astro:page-load', boot);
document.addEventListener('astro:before-swap', teardown);
window.addEventListener('pagehide', event => { if (!event.persisted) teardown(); });
window.addEventListener('pageshow', event => { if (event.persisted) live?.sync(); });
boot();
