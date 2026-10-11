import * as THREE from 'three';

const W = 2000, H = 1000;
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const wrap = (n: number) => ((n + 180) % 360 + 360) % 360 - 180;
const coordinate = (lat: number, lng: number) => {
  const p = THREE.MathUtils.degToRad(lat), t = THREE.MathUtils.degToRad(lng);
  // 与现有等距圆柱 SVG、SphereGeometry 的 UV 对齐。
  return new THREE.Vector3(Math.cos(p) * Math.cos(t), Math.sin(p), -Math.cos(p) * Math.sin(t));
};

let live: { element: HTMLElement; dispose: () => void } | null = null;
function teardown() { live?.dispose(); live = null; }

function boot() {
  const element = document.querySelector<HTMLElement>('[data-atlas]');
  if (live?.element === element) return;
  teardown();
  if (!element) return;
  const stage = element.querySelector<HTMLElement>('.tm-stage')!;
  const canvas = element.querySelector<HTMLCanvasElement>('.tm-globe')!;
  const svg = element.querySelector<SVGSVGElement>('.tm-flat svg')!;
  const cards = [...element.querySelectorAll<HTMLElement>('[data-place-card]')];
  const links = [...element.querySelectorAll<HTMLAnchorElement>('[data-place]')];
  const pins = [...element.querySelectorAll<HTMLAnchorElement>('.tm-pin')].map(el => {
    const lat = Number(el.dataset.lat), lng = Number(el.dataset.lng);
    return { el, label: el.querySelector<HTMLElement>('.tm-pin-label')!, lat, lng, point: coordinate(lat, lng), x: (lng + 180) / 360 * W, y: (90 - lat) / 180 * H };
  });
  if (!pins.length) return;
  const controller = new AbortController(), { signal } = controller;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const modeButtons = [...element.querySelectorAll<HTMLButtonElement>('[data-mode-button]')];
  const toolIn = element.querySelector<HTMLButtonElement>('[data-map="in"]')!;
  const toolOut = element.querySelector<HTMLButtonElement>('[data-map="out"]')!;
  const interact = element.querySelector<HTMLButtonElement>('[data-interact]')!;
  const touchHint = element.querySelector<HTMLElement>('.tm-touch-hint')!;
  let width = 1, height = 1, selected = 0, mode: 'flat' | 'globe' = 'flat';
  let disposed = false, lost = false, inView = true, raf = 0, dragged = false;
  let baseFlat: number[] = [], flat: number[] = [];
  const center = { lat: pins.reduce((s, p) => s + p.lat, 0) / pins.length, lng: pins.reduce((s, p) => s + p.lng, 0) / pins.length, distance: 3.25 };
  let orbit = { ...center };
  let flight: { start: number; from: typeof orbit; to: typeof orbit } | null = null;
  let renderer: THREE.WebGLRenderer | undefined;
  let globeTexture: THREE.CanvasTexture | undefined;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
  const sphere = new THREE.SphereGeometry(1, 192, 128);
  const material = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: null } },
    vertexShader: `varying vec2 vUv; varying vec3 vNormal;
      void main() { vUv = uv; vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        float light = 0.76 + 0.24 * max(dot(n, normalize(vec3(-0.35, 0.6, 1.0))), 0.0);
        float edge = 1.0 - 0.18 * pow(1.0 - max(n.z, 0.0), 2.0);
        gl_FragColor = vec4(texture2D(uMap, vUv).rgb * light * edge, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  scene.add(new THREE.Mesh(sphere, material));
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 1; textureCanvas.height = 1;
  let textureUpgradeTimer = 0;
  // 路径只解析一次；主题切换时重绘纹理，不重新加载地图或创建 WebGL 上下文。
  const paths = new Map([...svg.querySelectorAll('path')].map(path => [path.getAttribute('class')!, new Path2D(path.getAttribute('d')!)]));

  // Match the front-facing map to its projected pixel density. Retina zoom
  // can use 8K; small screens stay within a 4K texture and GPU size limits.
  function textureResolution() {
    if (!renderer) return 1;
    const limit = Math.min(renderer.capabilities.maxTextureSize,
      matchMedia('(max-width: 760px)').matches ? 4096 : 8192);
    const distance = orbit.distance / Math.min(1, width / height);
    const focalLength = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const texels = focalLength / Math.max(0.1, distance - 1) *
      renderer.getPixelRatio() * Math.PI * 2 * 1.15;
    return Math.min(limit, Math.max(4096, 2 ** Math.ceil(Math.log2(Math.max(1, texels)))));
  }
  function scheduleTextureUpgrade() {
    const resolution = textureResolution();
    clearTimeout(textureUpgradeTimer);
    textureUpgradeTimer = 0;
    if (resolution <= textureCanvas.width) return;
    // Keep interaction immediate, then redraw vector paths once it settles.
    textureUpgradeTimer = window.setTimeout(() => {
      textureUpgradeTimer = 0;
      if (!disposed && !lost) paintGlobe(resolution);
    }, 150);
  }
  function paintGlobe(resolution = textureCanvas.width) {
    if (!renderer || lost) return;
    if (textureCanvas.width !== resolution) {
      // WebGL texture storage is immutable: replace it when dimensions change.
      globeTexture?.dispose(); globeTexture = undefined;
      textureCanvas.width = resolution; textureCanvas.height = resolution / 2;
    }
    const ctx = textureCanvas.getContext('2d')!;
    const dark = document.documentElement.dataset.theme === 'dark';
    const sea = dark ? '#25343b' : '#e9e2d4';
    const land = dark ? '#647e81' : '#bfb7a6';
    ctx.setTransform(textureCanvas.width / W, 0, 0, textureCanvas.height / H, 0, 0);
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.globalAlpha = 1; ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
    const draw = (name: string, fill: string | null, stroke: string | null, alpha: number, lineWidth: number) => {
      const path = paths.get(name);
      if (!path) return;
      ctx.globalAlpha = alpha; ctx.lineWidth = lineWidth;
      if (fill) { ctx.fillStyle = fill; ctx.fill(path, 'evenodd'); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(path); }
    };
    draw('worldmap-land', land, dark ? '#94a9a6' : '#999281', 1, .35);
    draw('worldmap-lakes', sea, null, 1, 0);
    draw('worldmap-borders', null, dark ? '#b5c1b8' : '#f4efe6', .5, .65);
    draw('worldmap-rivers', null, sea, .55, .65);
    draw('worldmap-grid', null, dark ? '#b1c1b8' : '#797363', .18, .55);
    if (!globeTexture) {
      globeTexture = new THREE.CanvasTexture(textureCanvas);
      globeTexture.colorSpace = THREE.SRGBColorSpace;
      globeTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      globeTexture.magFilter = THREE.LinearFilter;
      globeTexture.minFilter = THREE.LinearMipmapLinearFilter;
      material.uniforms.uMap.value = globeTexture;
    }
    globeTexture.needsUpdate = true;
    element!.dataset.textureResolution = String(textureCanvas.width);
    requestDraw();
  }

  function fitFlat() {
    const xs = pins.map(p => p.x), ys = pins.map(p => p.y);
    const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const w = Math.max(225, xmax - xmin + 125, (ymax - ymin + 105) * width / height);
    return [(xmin + xmax - w) / 2, (ymin + ymax - w * height / width) / 2, w, w * height / width];
  }
  function constrainFlat() {
    const maxWidth = Math.min(W, H * width / height);
    flat[2] = clamp(flat[2], 32, maxWidth); flat[3] = flat[2] * height / width;
    flat[0] = clamp(flat[0], 0, W - flat[2]); flat[1] = clamp(flat[1], 0, H - flat[3]);
  }
  function labels() {
    const box = stage.getBoundingClientRect(), placed: DOMRect[] = [];
    const dots = pins.filter(pin => !pin.el.hidden).map(pin => {
      const rect = pin.el.getBoundingClientRect();
      return { pin, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    const ordered = [...pins].sort((a, b) => Number(Number(a.el.dataset.place) !== selected) - Number(Number(b.el.dataset.place) !== selected));
    for (const pin of ordered) {
      if (pin.el.hidden) continue;
      const { label } = pin;
      let fits = false;
      const w = label.offsetWidth, h = label.offsetHeight;
      for (const [x, y] of [[14, -h / 2], [-w - 14, -h / 2], [-w / 2, -h - 14], [-w / 2, 14]]) {
        label.style.setProperty('--label-x', `${x}px`); label.style.setProperty('--label-y', `${y}px`);
        const r = label.getBoundingClientRect();
        const overlap = placed.some(other => !(r.right + 5 < other.left || r.left - 5 > other.right || r.bottom + 3 < other.top || r.top - 3 > other.bottom));
        const coversDot = dots.some(dot => dot.pin !== pin && dot.x > r.left - 6 && dot.x < r.right + 6 && dot.y > r.top - 6 && dot.y < r.bottom + 6);
        if (!overlap && !coversDot && r.left > box.left + 4 && r.right < box.right - 4 && r.top > box.top + 4 && r.bottom < box.bottom - 4) {
          placed.push(r); fits = true; break;
        }
      }
      pin.el.classList.toggle('is-label-hidden', !fits);
    }
  }
  function draw() {
    if (disposed) return;
    if (mode === 'globe' && renderer && !lost) {
      camera.position.copy(coordinate(orbit.lat, orbit.lng)).multiplyScalar(orbit.distance / Math.min(1, width / height));
      camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
      renderer.render(scene, camera);
      scheduleTextureUpgrade();
    } else {
      constrainFlat(); svg.setAttribute('viewBox', flat.join(' '));
    }
    const projected = new THREE.Vector3();
    for (const pin of pins) {
      let x: number, y: number, visible = true;
      if (mode === 'globe') {
        visible = pin.point.dot(camera.position) > 1.01;
        projected.copy(pin.point).multiplyScalar(1.003).project(camera);
        x = (projected.x + 1) * width / 2; y = (1 - projected.y) * height / 2;
      } else { x = (pin.x - flat[0]) / flat[2] * width; y = (pin.y - flat[1]) / flat[3] * height; }
      pin.el.hidden = !visible || x < 10 || x > width - 10 || y < 10 || y > height - 10;
      pin.el.style.left = `${x.toFixed(2)}px`; pin.el.style.top = `${y.toFixed(2)}px`;
    }
    labels();
    toolIn.disabled = mode === 'globe' ? orbit.distance <= 2.051 : flat[2] <= 32.01;
    toolOut.disabled = mode === 'globe' ? orbit.distance >= 6.999 : flat[2] >= Math.min(W, H * width / height) - .01;
  }
  function frame(now: number) {
    raf = 0;
    if (disposed || document.hidden || !inView) return;
    if (flight) {
      const t = motion.matches ? 1 : clamp((now - flight.start) / 650, 0, 1);
      const ease = 1 - (1 - t) ** 3;
      orbit = {
        lat: flight.from.lat + (flight.to.lat - flight.from.lat) * ease,
        lng: flight.from.lng + wrap(flight.to.lng - flight.from.lng) * ease,
        distance: flight.from.distance + (flight.to.distance - flight.from.distance) * ease,
      };
      if (t === 1) flight = null;
    }
    draw();
    if (flight) requestDraw();
  }
  function requestDraw() { if (!raf && !disposed && !document.hidden && inView) raf = requestAnimationFrame(frame); }
  function flyTo(target: typeof orbit) {
    if (motion.matches) { orbit = { ...target }; flight = null; }
    else flight = { start: performance.now(), from: { ...orbit }, to: target };
    requestDraw();
  }
  function select(index: number, focusMap = true) {
    selected = (index + pins.length) % pins.length;
    cards.forEach((card, i) => { card.hidden = i !== selected; });
    links.forEach(link => {
      const active = Number(link.dataset.place) === selected;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
    });
    element!.querySelector('[data-place-current]')!.textContent = String(selected + 1).padStart(2, '0');
    if (focusMap) {
      const pin = pins[selected];
      if (mode === 'globe') flyTo({ lat: pin.lat, lng: pin.lng, distance: clamp(orbit.distance, 2.8, 3.8) });
      else { flat[0] = pin.x - flat[2] / 2; flat[1] = pin.y - flat[3] / 2; }
    }
    requestDraw();
  }
  function setMode(next: 'flat' | 'globe') {
    if (next === 'globe' && (!renderer || lost)) return;
    mode = next; flight = null; element!.dataset.mode = mode;
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.modeButton === mode)));
    requestDraw();
  }
  function resize() {
    const oldWidth = width, oldHeight = height;
    width = stage.clientWidth; height = stage.clientHeight;
    if (!width || !height) return;
    const atDefault = !flat.length || (baseFlat.length && flat.every((n, i) => Math.abs(n - baseFlat[i]) < .1));
    baseFlat = fitFlat();
    if (atDefault) flat = [...baseFlat];
    else { const cy = flat[1] + flat[3] / 2; flat[3] = flat[2] * height / width; flat[1] = cy - flat[3] / 2; }
    if (renderer && !lost && (width !== oldWidth || height !== oldHeight)) {
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
    }
    requestDraw();
  }
  function zoom(factor: number, clientX?: number, clientY?: number) {
    flight = null;
    if (mode === 'globe') orbit.distance = clamp(orbit.distance / factor, 2.05, 7);
    else {
      const box = stage.getBoundingClientRect();
      const x = clientX === undefined ? .5 : (clientX - box.left) / width, y = clientY === undefined ? .5 : (clientY - box.top) / height;
      const anchorX = flat[0] + x * flat[2], anchorY = flat[1] + y * flat[3];
      flat[2] = clamp(flat[2] / factor, 32, Math.min(W, H * width / height)); flat[3] = flat[2] * height / width;
      flat[0] = anchorX - x * flat[2]; flat[1] = anchorY - y * flat[3];
    }
    requestDraw();
  }
  function reset() { flat = [...baseFlat]; if (mode === 'globe') flyTo({ ...center }); else requestDraw(); }
  function pan(dx: number, dy: number) {
    flight = null;
    if (mode === 'globe') { orbit.lng = wrap(orbit.lng - dx / width * 150); orbit.lat = clamp(orbit.lat + dy / height * 110, -80, 80); }
    else { flat[0] -= dx / width * flat[2]; flat[1] -= dy / height * flat[3]; }
    requestDraw();
  }
  function interaction(enabled: boolean) {
    stage.dataset.interactive = String(enabled); interact.setAttribute('aria-pressed', String(enabled));
    interact.textContent = enabled ? '完成' : '操作地图';
    touchHint.textContent = enabled ? '拖动探索 · 双指缩放' : '点选地点，查看这一程';
  }

  element.addEventListener('click', event => {
    const target = event.target as Element;
    const place = target.closest<HTMLAnchorElement>('[data-place]');
    if (place && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      if (!dragged || event.detail === 0 || !place.classList.contains('tm-pin')) select(Number(place.dataset.place));
      return;
    }
    const button = target.closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.dataset.modeButton) setMode(button.dataset.modeButton as 'flat' | 'globe');
    if (button.dataset.step) select(selected + Number(button.dataset.step));
    if (button.dataset.map === 'in') zoom(1.4);
    if (button.dataset.map === 'out') zoom(1 / 1.4);
    if (button.dataset.map === 'reset') reset();
    if (button.hasAttribute('data-interact')) interaction(stage.dataset.interactive !== 'true');
  }, { signal });
  stage.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoom(Math.exp(-clamp(event.deltaY, -250, 250) * .002), event.clientX, event.clientY);
  }, { passive: false, signal });
  stage.addEventListener('dblclick', event => {
    if ((event.target as Element).closest('.tm-pin')) return;
    event.preventDefault(); zoom(1.5, event.clientX, event.clientY);
  }, { signal });
  stage.addEventListener('keydown', event => {
    if (event.target !== stage) return;
    const moves: Record<string, number[]> = { ArrowLeft: [36, 0], ArrowRight: [-36, 0], ArrowUp: [0, 36], ArrowDown: [0, -36] };
    if (moves[event.key]) { event.preventDefault(); pan(...moves[event.key] as [number, number]); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.4); }
    else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.4); }
    else if (event.key === 'Home') { event.preventDefault(); reset(); }
    else if (event.key === 'Escape') interaction(false);
  }, { signal });

  const pointers = new Map<number, { x: number; y: number; startX: number; startY: number }>();
  let pinchDistance = 0;
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || (event.pointerType === 'touch' && stage.dataset.interactive !== 'true')) return;
    if (!pointers.size) dragged = false;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]; pinchDistance = Math.hypot(a.x - b.x, a.y - b.y); dragged = true;
      pointers.forEach((_, id) => stage.setPointerCapture(id));
    }
  }, { signal });
  stage.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    previous.x = event.clientX; previous.y = event.clientY;
    if (pointers.size > 1) {
      const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance > 1 && distance > 1) zoom(distance / pinchDistance, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchDistance = distance;
    } else {
      if (!dragged && Math.hypot(event.clientX - previous.startX, event.clientY - previous.startY) < 5) return;
      dragged = true; stage.setPointerCapture(event.pointerId); stage.classList.add('is-grabbing'); pan(dx, dy);
    }
  }, { signal });
  const endPointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId); pinchDistance = 0;
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    if (!pointers.size) stage.classList.remove('is-grabbing');
  };
  stage.addEventListener('pointerup', endPointer, { signal });
  stage.addEventListener('pointercancel', endPointer, { signal });
  stage.addEventListener('lostpointercapture', endPointer, { signal });
  window.addEventListener('pointerup', endPointer, { signal });
  stage.addEventListener('dragstart', event => event.preventDefault(), { signal });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; flight = null;
    modeButtons.find(button => button.dataset.modeButton === 'globe')!.disabled = true;
    setMode('flat');
  }, { signal });
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) requestDraw(); else { cancelAnimationFrame(raf); raf = 0; }
  });
  observer.observe(stage);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
  const themeObserver = new MutationObserver(() => paintGlobe());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else requestDraw();
  }, { signal });
  motion.addEventListener('change', requestDraw, { signal });

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    resize(); paintGlobe(textureResolution()); setMode('globe');
  } catch {
    modeButtons.find(button => button.dataset.modeButton === 'globe')!.disabled = true;
  }
  element.dataset.bound = '1';
  resize(); draw();
  document.fonts.ready.then(() => { if (!disposed) requestDraw(); });
  live = { element, dispose() {
    disposed = true; controller.abort(); cancelAnimationFrame(raf);
    clearTimeout(textureUpgradeTimer);
    observer.disconnect(); resizeObserver.disconnect(); themeObserver.disconnect();
    pointers.clear(); globeTexture?.dispose(); sphere.dispose(); material.dispose(); scene.clear();
    textureCanvas.width = textureCanvas.height = 1;
    renderer?.forceContextLoss(); renderer?.dispose();
    delete element.dataset.bound;
  } };
}

document.addEventListener('astro:before-swap', teardown);
document.addEventListener('astro:page-load', boot);
boot();
