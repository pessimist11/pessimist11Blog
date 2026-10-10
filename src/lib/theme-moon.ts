import * as THREE from 'three';
import albedoUrl from '../assets/moon/lroc-albedo.webp?url';
import heightUrl from '../assets/moon/lola-height.jpg?url';

const vertexShader = /* glsl */ `
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

const fragmentShader = /* glsl */ `
  uniform sampler2D uAlbedo, uHeight;
  uniform vec3 uPaper, uShadow, uHighlight, uLight;
  uniform float uDark;
  varying vec2 vUv;
  varying vec3 vNormal, vPosition;
  void main() {
    vec3 normal = normalize(vNormal);
    vec2 dx = dFdx(vUv), dy = dFdy(vUv);
    float height = texture2D(uHeight, vUv).r;
    vec2 slope = vec2(texture2D(uHeight, vUv + dx).r - height,
                      texture2D(uHeight, vUv + dy).r - height) * 0.014;
    vec3 px = dFdx(vPosition), py = dFdy(vPosition);
    vec3 tx = cross(py, normal), ty = cross(normal, px);
    float determinant = dot(px, tx);
    vec3 relief = normalize(normal - sign(determinant) *
      (slope.x * tx + slope.y * ty) / max(abs(determinant), 0.0000001));
    float surfaceLight = dot(relief, uLight);
    float sun = dot(normal, uLight);
    float day = smoothstep(-0.035, 0.075,
      sun + clamp(surfaceLight - sun, -0.22, 0.22) * 0.10 * exp(-abs(sun) * 14.0));
    float albedo = pow(max(dot(texture2D(uAlbedo, vUv).rgb,
      vec3(0.2126, 0.7152, 0.0722)), 0.001), 0.4545);
    float shading = clamp(0.18 + pow(1.0 - albedo, 1.3) * 0.76 +
      pow(1.0 - max(sun, 0.0), 1.7) * 0.12 +
      clamp((sun - surfaceLight) * 1.1, -0.2, 0.2), 0.1, 0.88);
    vec3 paperMoon = mix(uPaper, uShadow, shading);
    float brightness = clamp((0.32 + albedo * 0.76) *
      (0.44 + 0.56 * pow(max(surfaceLight, 0.0), 0.38)), 0.07, 1.0);
    vec3 inkMoon = mix(uShadow, uHighlight, pow(brightness, 1.35));
    vec3 earthshine = mix(uPaper, mix(uShadow, uHighlight, uDark), 0.008 + albedo * 0.012);
    gl_FragColor = vec4(mix(earthshine, mix(paperMoon, inkMoon, uDark), day), 1.0);
    #include <colorspace_fragment>
  }
`;

const dustVertex = /* glsl */ `
  uniform float uTime, uPulse, uHover, uDpr, uShape;
  varying float vOpacity;
  void main() {
    float angle = position.x * 6.2831853 + uTime * 0.15;
    float radius = 0.83 + position.y * 0.15;
    vec2 orbit = vec2(cos(angle), sin(angle)) * radius;
    // 内页的浮尘逐渐收成椭圆，与月相一起过渡。
    orbit.y *= mix(1.0, 0.44, uShape);
    orbit.y -= uShape * 0.36;
    orbit *= 1.0 + uPulse * 0.10;
    orbit += vec2(sin(angle * 3.0 + uTime * 0.4),
                  cos(angle * 2.0 - uTime * 0.3)) * 0.014;
    vOpacity = (0.14 + position.z * 0.38) * smoothstep(0.69, 0.81, length(orbit));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(orbit, -0.15, 1.0);
    gl_PointSize = (0.62 + position.z * 0.46 + uHover * 0.10) * uDpr;
  }
`;

const dustFragment = /* glsl */ `
  uniform float uDark;
  varying float vOpacity;
  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    if (radius > 1.0) discard;
    gl_FragColor = vec4(vec3(mix(0.075, 0.58, uDark)),
      vOpacity * (1.0 - smoothstep(0.2, 1.0, radius)));
    #include <colorspace_fragment>
  }
`;

function pagePhase() {
  if (/^\/(zhi|si)(\/|$)/.test(location.pathname)) return { angle: -2.32, shape: 1 };
  if (/^\/works(\/|$)/.test(location.pathname)) return { angle: -1.12, shape: 0.5 };
  if (/^\/fu(\/|$)/.test(location.pathname)) return { angle: 2.18, shape: 0.7 };
  if (/^\/about(\/|$)/.test(location.pathname)) return { angle: 2.62, shape: 1 };
  return { angle: 0.28, shape: 0 };
}

let live: { element: HTMLElement; sync: () => void; stop: () => void; dispose: () => void } | null = null;
let elapsed = 0;
let phase = 0.28;

export function initThemeMoon() {
  const element = document.querySelector<HTMLElement>('[data-theme-moon]');
  if (live?.element === element) { live.sync(); return; }
  live?.dispose();
  live = null;
  if (!element) return;
  const button = element.closest('button')!;
  const controller = new AbortController();
  const { signal } = controller;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    element.dataset.renderer = 'fallback';
    return;
  }
  renderer.setClearColor(0, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  element.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.12, 1.12, 1.12, -1.12, 0.1, 10);
  camera.position.z = 3;
  let dark = Number(document.documentElement.dataset.theme === 'dark');
  let target = pagePhase(), shape = target.shape, pulse = 0, hover = false;
  let disposed = false, paused = false, lost = false, ready = false, raf = 0, last = 0;
  let visible = element.getBoundingClientRect().bottom > 0;
  const paper = new THREE.Color();
  const shadow = new THREE.Color();
  const highlight = new THREE.Color();
  const uniforms = {
    uAlbedo: { value: null as THREE.Texture | null },
    uHeight: { value: null as THREE.Texture | null },
    uPaper: { value: paper.clone() }, uShadow: { value: shadow.clone() },
    uHighlight: { value: highlight.clone() }, uLight: { value: new THREE.Vector3() },
    uDark: { value: dark },
  };
  const geometry = new THREE.SphereGeometry(0.71, 48, 32);
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true });
  const moon = new THREE.Mesh(geometry, material);
  scene.add(moon);

  const positions = new Float32Array(220 * 3);
  for (let index = 0; index < 220; index++) {
    positions.set([index * 0.618033989 % 1, index * 0.754877666 % 1, index * 0.569840296 % 1], index * 3);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustUniforms = {
    uTime: { value: elapsed }, uPulse: { value: 0 }, uHover: { value: 0 },
    uDpr: { value: 1 }, uShape: { value: shape }, uDark: { value: dark },
  };
  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: dustUniforms, vertexShader: dustVertex, fragmentShader: dustFragment,
    transparent: true, depthWrite: false,
  });
  scene.add(new THREE.Points(dustGeometry, dustMaterial));
  const textures: THREE.Texture[] = [];

  function canRender() { return ready && !disposed && !paused && !lost && visible && !document.hidden; }
  function stop() { cancelAnimationFrame(raf); raf = 0; last = 0; }
  function requestFrame() { if (!raf && canRender()) raf = requestAnimationFrame(frame); }
  function draw(delta: number) {
    const blend = motion.matches ? 1 : 1 - Math.exp(-delta * 2.6);
    phase += Math.atan2(Math.sin(target.angle - phase), Math.cos(target.angle - phase)) * blend;
    dark += (Number(document.documentElement.dataset.theme === 'dark') - dark) * blend;
    shape += (target.shape - shape) * blend;
    if (!motion.matches) elapsed += delta;
    pulse = motion.matches ? 0 : pulse * Math.exp(-delta * 3);
    uniforms.uPaper.value.lerp(paper, blend);
    uniforms.uShadow.value.lerp(shadow, blend);
    uniforms.uHighlight.value.lerp(highlight, blend);
    uniforms.uDark.value = dark;
    uniforms.uLight.value.set(Math.sin(phase) * Math.cos(0.32), Math.sin(phase) * Math.sin(0.32), Math.cos(phase));
    moon.rotation.set(0, -Math.PI / 2 + elapsed * 0.0072, 0.11);
    moon.scale.setScalar(1 + pulse * 0.035);
    dustUniforms.uTime.value = elapsed;
    dustUniforms.uDark.value = dark;
    dustUniforms.uShape.value = shape;
    dustUniforms.uHover.value = Number(hover);
    dustUniforms.uPulse.value = pulse;
    renderer.render(scene, camera);
    element!.dataset.renderer = 'three';
  }
  function frame(now: number) {
    raf = 0;
    if (!canRender()) return;
    // 小画布限制为 30fps，后台和减少动态效果时停止循环。
    if (last && now - last < 1000 / 30) { requestFrame(); return; }
    const delta = last ? Math.min(0.1, (now - last) / 1000) : 1 / 30;
    last = now;
    draw(delta);
    if (!motion.matches) requestFrame();
  }
  function colors() {
    const isDark = document.documentElement.dataset.theme === 'dark';
    paper.set(getComputedStyle(button).getPropertyValue('--theme-paper').trim());
    shadow.set(isDark ? '#252b29' : '#515650');
    highlight.set(isDark ? '#d2d5cf' : '#f6f4ef');
    pulse = motion.matches ? 0 : 1;
    requestFrame();
  }
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(element!.clientWidth, element!.clientHeight, false);
    dustUniforms.uDpr.value = ratio;
    requestFrame();
  }
  function sync() {
    if (disposed) return;
    paused = false;
    target = pagePhase();
    colors(); resize();
    if (canRender()) requestFrame(); else stop();
  }
  function focus(value: boolean) { hover = value; requestFrame(); }
  button.addEventListener('pointerenter', () => focus(true), { signal });
  button.addEventListener('pointerleave', () => focus(false), { signal });
  button.addEventListener('focus', () => focus(true), { signal });
  button.addEventListener('blur', () => focus(false), { signal });
  document.addEventListener('visibilitychange', () => { if (canRender()) requestFrame(); else stop(); }, { signal });
  motion.addEventListener('change', () => { stop(); requestFrame(); }, { signal });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; stop(); element!.dataset.renderer = 'fallback';
  }, { signal });
  renderer.domElement.addEventListener('webglcontextrestored', () => { lost = false; sync(); }, { signal });
  const themeObserver = new MutationObserver(colors);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(element);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (canRender()) requestFrame(); else stop();
  });
  observer.observe(element);

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop(); controller.abort();
    themeObserver.disconnect(); resizeObserver.disconnect(); observer.disconnect();
    geometry.dispose(); material.dispose(); dustGeometry.dispose(); dustMaterial.dispose();
    textures.forEach(texture => texture.dispose());
    renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    element!.dataset.renderer = 'fallback';
  }
  live = { element, sync, stop: () => { paused = true; stop(); }, dispose };
  sync();
  uniforms.uPaper.value.copy(paper);
  uniforms.uShadow.value.copy(shadow);
  uniforms.uHighlight.value.copy(highlight);
  const loader = new THREE.TextureLoader();
  let loaded = 0;
  function load(url: string, uniform: typeof uniforms.uAlbedo, color: boolean) {
    const texture = loader.load(url, value => {
      if (disposed) return;
      uniform.value = value;
      loaded++;
      ready = loaded === 2;
      requestFrame();
    }, undefined, () => { if (!disposed) dispose(); });
    texture.wrapS = THREE.RepeatWrapping;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
  }
  load(albedoUrl, uniforms.uAlbedo, true);
  load(heightUrl, uniforms.uHeight, false);
}

document.addEventListener('astro:before-swap', () => live?.stop());
window.addEventListener('pagehide', event => {
  if (event.persisted) live?.stop(); else { live?.dispose(); live = null; }
});
window.addEventListener('pageshow', event => { if (event.persisted) live?.sync(); });
