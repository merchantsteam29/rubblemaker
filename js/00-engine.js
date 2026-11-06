'use strict';
// Globals declared with `var` in later parts. They must exist (as undefined) from the start,
// because earlier code checks them before their part has run (e.g. `VS && VS.active`).
// Add a name here if you add a top-level `var` that earlier code reads.
var bricks, flames, RECENT_DEAD, CHAIN, STATS, CUT, OUT, LAYER, REV, revWet, revKey, crunch, comp, voicesLive, chatterT, beatT, tickLast, FLAIL, GH, VS, raceBuf, AQ, RUNES, tauntT, tauntOpenT, tauntPopT, LAYER_NAMES, ACT_NAMES, AWARD_FROM, GOLEM_BODY, GOLEM_GLOW, RIVAL_GLOW, SR, TUT, CO;

// =====================================================================
//  RUBBLEMAKER — brick & cobblestone arena shooter with a style meter
// =====================================================================

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const UP = new V3(0, 1, 0);

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.autoClear = false;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a0f0b);
scene.fog = new THREE.Fog(0x1a0f0b, 35, 120);
const camera = new THREE.PerspectiveCamera(95, innerWidth / innerHeight, 0.05, 300);
camera.rotation.order = 'YXZ';
scene.add(camera);

// viewmodel is drawn in its own pass so guns never clip into walls
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.01, 10);
vmScene.add(new THREE.HemisphereLight(0xffe8d0, 0x2a1a10, 1.6));
const vmSun = new THREE.DirectionalLight(0xfff0e0, 1.8);
vmSun.position.set(1, 2, 1.5);
vmScene.add(vmSun);
const vmFlash = new THREE.PointLight(0xffaa55, 0, 3, 2);
vmFlash.position.set(0.25, -0.1, -0.9);
vmScene.add(vmFlash);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = vmCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  vmCam.updateProjectionMatrix();
  resizeFX();
});

// ---------------------------------------------------------------- textures
function makeCanvas(S) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return [c, c.getContext('2d')];
}
function toTex(c, srgb) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function speckle(g, S, n, alpha) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    const s = rand(1, 3);
    g.fillRect(Math.random() * S, Math.random() * S, s, s);
  }
}

function brickTextures() {
  const S = 512;
  const [c, g] = makeCanvas(S);
  const [b, bg] = makeCanvas(S);
  g.fillStyle = '#5a534c'; g.fillRect(0, 0, S, S);
  bg.fillStyle = '#1c1c1c'; bg.fillRect(0, 0, S, S);
  speckle(g, S, 4000, 0.25);
  const rows = 8, bh = S / rows, bw = S / 4, m = 7;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw / 2;
    const cols = [], bumps = [];
    for (let k = 0; k < 4; k++) {
      const v = rand(-24, 24);
      cols.push(`rgb(${(128 + v + rand(-12, 12)) | 0},${(50 + v * 0.5) | 0},${(36 + v * 0.4) | 0})`);
      const l = (200 + rand(-35, 35)) | 0;
      bumps.push(`rgb(${l},${l},${l})`);
    }
    for (let i = -1; i < 4; i++) {
      const k = (i + 4) % 4; // same colour for the wrapped half-brick
      const x = i * bw + off, y = r * bh;
      g.fillStyle = cols[k]; g.fillRect(x + m / 2, y + m / 2, bw - m, bh - m);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + m / 2, y + bh - m / 2 - 6, bw - m, 6);
      g.fillStyle = 'rgba(255,220,200,.08)'; g.fillRect(x + m / 2, y + m / 2, bw - m, 4);
      bg.fillStyle = bumps[k]; bg.fillRect(x + m / 2, y + m / 2, bw - m, bh - m);
    }
  }
  speckle(g, S, 9000, 0.2);
  speckle(bg, S, 7000, 0.35);
  return { map: toTex(c, true), bump: toTex(b, false) };
}

function cobbleTextures() {
  const S = 512;
  const [c, g] = makeCanvas(S);
  const [b, bg] = makeCanvas(S);
  g.fillStyle = '#26221f'; g.fillRect(0, 0, S, S);
  bg.fillStyle = '#000'; bg.fillRect(0, 0, S, S);
  speckle(g, S, 3000, 0.3);
  const N = 7, cell = S / N;
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
    const cx = (gx + 0.5 + rand(-0.18, 0.18)) * cell;
    const cy = (gy + 0.5 + rand(-0.18, 0.18)) * cell;
    const r = cell * rand(0.43, 0.5);
    const pts = [];
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * Math.PI * 2 + rand(-0.12, 0.12);
      const rr = r * rand(0.8, 1.0);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr * rand(0.85, 1.05)]);
    }
    const sh = rand(-20, 20);
    const warm = rand(-6, 10);
    const light = `rgb(${(150 + sh + warm) | 0},${(144 + sh) | 0},${(134 + sh - warm) | 0})`;
    const dark = `rgb(${(70 + sh * 0.5) | 0},${(66 + sh * 0.5) | 0},${(60 + sh * 0.5) | 0})`;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const x = cx + ox, y = cy + oy;
      if (x + r < 0 || x - r > S || y + r < 0 || y - r > S) continue;
      const path = () => {
        const p = new Path2D();
        const n = pts.length;
        const mid = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2 + x, (pts[i][1] + pts[(i + 1) % n][1]) / 2 + y];
        const m0 = mid(n - 1);
        p.moveTo(m0[0], m0[1]);
        for (let i = 0; i < n; i++) {
          const mm = mid(i);
          p.quadraticCurveTo(pts[i][0] + x, pts[i][1] + y, mm[0], mm[1]);
        }
        return p;
      };
      const p = path();
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.1);
      gr.addColorStop(0, light); gr.addColorStop(1, dark);
      g.fillStyle = gr; g.fill(p);
      const br = bg.createRadialGradient(x, y, r * 0.15, x, y, r);
      br.addColorStop(0, '#fff'); br.addColorStop(1, '#555');
      bg.fillStyle = br; bg.fill(p);
    }
  }
  speckle(g, S, 9000, 0.18);
  speckle(bg, S, 5000, 0.3);
  return { map: toTex(c, true), bump: toTex(b, false) };
}

function glowTexture() {
  const [c, g] = makeCanvas(64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const brick = brickTextures();
const cobble = cobbleTextures();
const GLOW = glowTexture();
const brickMat = new THREE.MeshStandardMaterial({ map: brick.map, bumpMap: brick.bump, bumpScale: 2, roughness: 0.92 });
const cobbleMat = new THREE.MeshStandardMaterial({ map: cobble.map, bumpMap: cobble.bump, bumpScale: 2.5, roughness: 0.88 });
const floorMat = new THREE.MeshStandardMaterial({ map: cobble.map, bumpMap: cobble.bump, bumpScale: 2.5, roughness: 0.95, color: 0x8a7e76 });

// ---------------------------------------------------------------- world
const solids = [];      // AABBs {min, max, active}
const worldMeshes = []; // raycast targets
let levelGroup = new THREE.Group();
scene.add(levelGroup);

function woodTexture() {
  const S = 256;
  const [c, g] = makeCanvas(S);
  for (let i = 0; i < 4; i++) {
    const v = rand(-15, 15);
    g.fillStyle = `rgb(${(110 + v) | 0},${(66 + v * 0.6) | 0},${(34 + v * 0.4) | 0})`;
    g.fillRect(0, i * 64, S, 64);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, i * 64, S, 3);
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = `rgba(40,20,8,${rand(0.1, 0.35)})`;
      g.beginPath();
      const y = i * 64 + rand(6, 60);
      g.moveTo(0, y);
      g.bezierCurveTo(S * 0.3, y + rand(-4, 4), S * 0.6, y + rand(-4, 4), S, y);
      g.stroke();
    }
    for (const x of [16, S - 16]) { g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(x, i * 64 + 32, 4, 0, 7); g.fill(); }
  }
  speckle(g, S, 2000, 0.15);
  return toTex(c, true);
}
const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.8 });
const ironMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.8, roughness: 0.45 });
const ironDark = new THREE.MeshStandardMaterial({ color: 0x1e1e22, metalness: 0.7, roughness: 0.5 });
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1f4a40, emissive: 0x0a2a22, emissiveIntensity: 0.7, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.88 });
const doorGlowMat = new THREE.MeshBasicMaterial({ color: 0xff3a1a });

// a box whose UVs are in world space, so textures tile evenly at any size. y = bottom.
function box(x, y, z, w, h, d, mat, texSize = 4, solid = true) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) + x, py = pos.getY(i) + y + h / 2, pz = pos.getZ(i) + z;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (nx > 0.5) uv.setXY(i, pz / texSize, py / texSize);
    else if (ny > 0.5) uv.setXY(i, px / texSize, pz / texSize);
    else uv.setXY(i, px / texSize, py / texSize);
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  levelGroup.add(m);
  if (solid) {
    worldMeshes.push(m);
    const s = { min: new V3(x - w / 2, y, z - d / 2), max: new V3(x + w / 2, y + h, z + d / 2), active: true };
    solids.push(s);
    m.userData.solid = s;
  }
  return m;
}

// ---- torches: many flame sprites, but only a fixed pool of 8 real lights that follow the player
const torches = [];
const bracketMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.5 });
const bracketGeo = new THREE.BoxGeometry(0.25, 0.6, 0.25);
const waxGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.3, 8);
const waxMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 });
const flameMat = new THREE.SpriteMaterial({ map: GLOW, color: 0xff8a2a, blending: THREE.AdditiveBlending, depthWrite: false });
bracketGeo.userData.shared = waxGeo.userData.shared = true;
const SCONCE = [
  [new THREE.BoxGeometry(0.3, 0.5, 0.06), 0, 0, 0.03],
  [new THREE.BoxGeometry(0.06, 0.06, 0.3), 0, -0.05, 0.18],
  [new THREE.CylinderGeometry(0.16, 0.07, 0.14, 8), 0, 0.06, 0.34],
  [new THREE.BoxGeometry(0.03, 0.32, 0.03), 0.13, 0.26, 0.34],
  [new THREE.BoxGeometry(0.03, 0.32, 0.03), -0.13, 0.26, 0.34],
  [new THREE.BoxGeometry(0.03, 0.32, 0.03), 0, 0.26, 0.47],
  [new THREE.BoxGeometry(0.03, 0.32, 0.03), 0, 0.26, 0.21],
  [new THREE.TorusGeometry(0.14, 0.015, 4, 12).rotateX(Math.PI / 2), 0, 0.42, 0.34],
];
for (const [g] of SCONCE) g.userData.shared = true;
function torch(x, y, z, nx, nz, small = false) {
  if (!small) {
    const sc = new THREE.Group();
    sc.position.set(x, y, z);
    sc.rotation.y = Math.atan2(nx, nz);
    for (const [geo, px, py, pz] of SCONCE) { const p = new THREE.Mesh(geo, bracketMat); p.position.set(px, py, pz); p.castShadow = true; sc.add(p); }
    levelGroup.add(sc);
  }
  const flame = new THREE.Sprite(flameMat);
  flame.position.set(x + nx * 0.34, y + (small ? 0.2 : 0.42), z + nz * 0.34);
  flame.scale.setScalar(small ? 0.5 : 1.1);
  levelGroup.add(flame);
  torches.push({ pos: new V3(x + nx * 0.9, y + 0.6, z + nz * 0.9), flame, ph: rand(0, 100), small });
}
function candle(x, y, z) {
  const w = new THREE.Mesh(waxGeo, waxMat);
  w.position.set(x, y + 0.15, z);
  levelGroup.add(w);
  torch(x, y + 0.15, z, 0, 0, true);
}
const LIGHT_POOL = [];
for (let i = 0; i < 8; i++) {
  const l = new THREE.PointLight(0xff7a2a, 0, 26, 1.7);
  scene.add(l);
  LIGHT_POOL.push({ light: l, torch: null });
}
let lightT = 0;
function updateLights(dt, t, ref) {
  lightT -= dt;
  if (lightT <= 0) {
    lightT = 0.25;
    const sorted = torches.slice().sort((a, b) => a.pos.distanceToSquared(ref) - b.pos.distanceToSquared(ref));
    const n = settings.quality === 'low' ? 4 : 8;
    LIGHT_POOL.forEach((L, i) => {
      L.torch = i < n ? sorted[i] || null : null;
      if (L.torch) L.light.position.copy(L.torch.pos);
    });
  }
  for (const L of LIGHT_POOL) {
    const tc = L.torch;
    if (!tc) { L.light.intensity = 0; continue; }
    const f = 0.8 + Math.sin(t * 9 + tc.ph) * 0.1 + Math.sin(t * 23 + tc.ph * 2) * 0.08 + Math.random() * 0.05;
    L.light.intensity = (tc.small ? 10 : 40) * f;
  }
  for (const tc of torches) tc.flame.scale.setScalar((tc.small ? 0.45 : 1.0) + Math.sin(t * 11 + tc.ph) * 0.08 + Math.random() * 0.05);
}

// ---- stained glass for the cathedral
const winGeo = new THREE.PlaneGeometry(3, 5.25);
winGeo.userData.shared = true;
const winMats = [];
const WIN_PALETTES = [
  ['#b3121e', '#e8a020', '#1e3ea8', '#f2e2b0'],
  ['#5a1aa0', '#c81e5a', '#e8c040', '#1a6a8a'],
  ['#1a7a4a', '#d8b030', '#a01a1a', '#3a5ac8'],
  ['#c84a10', '#f0d060', '#6a1a6a', '#20408a'],
];
function makeWindow(v) {
  if (!winMats[v]) {
    const [c, g] = makeCanvas(256);
    const W2 = 256, H2 = 448;
    c.height = H2;
    const arch = () => { g.beginPath(); g.moveTo(16, H2 - 8); g.lineTo(16, 128); g.arc(W2 / 2, 128, W2 / 2 - 16, Math.PI, 0); g.lineTo(W2 - 16, H2 - 8); g.closePath(); };
    g.clearRect(0, 0, W2, H2);
    arch(); g.save(); g.clip();
    const pal = WIN_PALETTES[v % WIN_PALETTES.length];
    for (let y = 0; y < H2; y += 32) for (let x = 0; x < W2; x += 32) {
      g.fillStyle = pal[(Math.random() * pal.length) | 0];
      g.globalAlpha = rand(0.75, 1);
      g.fillRect(x, y, 32, 32);
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,240,200,.85)';
    g.beginPath(); g.arc(W2 / 2, 140, 44, 0, 7); g.fill();
    g.fillStyle = pal[0];
    g.beginPath(); g.arc(W2 / 2, 140, 30, 0, 7); g.fill();
    g.strokeStyle = '#140c08'; g.lineWidth = 5;
    for (let y = 0; y < H2; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W2, y + 10); g.stroke(); }
    for (let x = 0; x < W2; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H2); g.stroke(); }
    g.restore();
    arch(); g.lineWidth = 14; g.strokeStyle = '#2a1e16'; g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    winMats[v] = new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false });
  }
  const m = new THREE.Mesh(winGeo, winMats[v]);
  m.renderOrder = 1;
  return m;
}

function clearLevelGeometry() {
  scene.remove(levelGroup);
  levelGroup.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  levelGroup = new THREE.Group();
  scene.add(levelGroup);
  solids.length = 0;
  worldMeshes.length = 0;
  torches.length = 0;
  hazards.length = 0;
  secrets.length = 0;
}

const A = 36; // arena half-size
const WALL_H = 12;
let pitKind = 'pit';
function buildArena(kind = 'pit') {
  pitKind = kind;
  if (kind !== 'pit') { buildArenaAlt(kind); return; }
  box(0, -1, 0, 2 * A + 6, 1, 2 * A + 6, floorMat, 3.5);
  // outer brick walls
  box(0, 0, -A - 1, 2 * A + 4, WALL_H, 2, brickMat);
  box(0, 0, A + 1, 2 * A + 4, WALL_H, 2, brickMat);
  box(-A - 1, 0, 0, 2, WALL_H, 2 * A, brickMat);
  box(A + 1, 0, 0, 2, WALL_H, 2 * A, brickMat);
  // cobblestone skirting
  box(0, 0, -A + 0.2, 2 * A, 1.1, 0.4, cobbleMat, 3);
  box(0, 0, A - 0.2, 2 * A, 1.1, 0.4, cobbleMat, 3);
  box(-A + 0.2, 0, 0, 0.4, 1.1, 2 * A - 0.8, cobbleMat, 3);
  box(A - 0.2, 0, 0, 0.4, 1.1, 2 * A - 0.8, cobbleMat, 3);
  // cobblestone pillars with brick caps
  const pillars = [[14, 14], [-14, 14], [14, -14], [-14, -14], [26, 0], [-26, 0], [0, 26], [0, -26]];
  for (const [x, z] of pillars) {
    box(x, 0, z, 3, 8, 3, cobbleMat, 3);
    box(x, 8, z, 3.6, 0.8, 3.6, brickMat);
  }
  // broken brick ring in the middle
  box(-4.5, 0, -7, 6, 3.5, 1, brickMat);
  box(5, 0, 7, 5, 2.4, 1, brickMat);
  box(-7, 0, 4, 1, 3, 5, brickMat);
  box(7, 0, -4, 1, 4.2, 5, brickMat);
  box(-1.5, 0, -7, 1.2, 5, 1, brickMat);
  // corner platforms with steps
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(sx * 28, 0, sz * 28, 9, 3, 9, cobbleMat, 3);
    box(sx * 22, 0, sz * 28, 3, 1.5, 3, cobbleMat, 3);
    box(sx * 28, 3, sz * 31.5, 9, 1.2, 1, brickMat);
  }
  // low cover walls
  box(0, 0, 16, 8, 1.4, 1, brickMat);
  box(0, 0, -16, 8, 1.4, 1, brickMat);
  box(16, 0, 0, 1, 1.4, 8, brickMat);
  box(-16, 0, 0, 1, 1.4, 8, brickMat);
  // floating cobble ledges for wall-jumping fun
  box(-A + 1.5, 5, 10, 3, 0.8, 6, cobbleMat, 3);
  box(A - 1.5, 5, -10, 3, 0.8, 6, cobbleMat, 3);
  for (const t of [-18, 18]) {
    torch(t, 4.5, -A, 0, 1); torch(t, 4.5, A, 0, -1);
    torch(-A, 4.5, t, 1, 0); torch(A, 4.5, t, -1, 0);
  }
}

// lights
const hemi = new THREE.HemisphereLight(0x9a90b8, 0x3a2414, 1.0);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xb8c0ff, 1.1);
moon.position.set(30, 55, 18);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
moon.shadow.bias = -0.0006;
scene.add(moon, moon.target);

const LOOKS = {
  pit: { fog: 0x1a0f0b, near: 35, far: 120, sky: 0x1a0f0b, hemiSky: 0x9a90b8, hemiGround: 0x3a2414, hemiI: 1.0, moon: 1.1 },
  cellar: { fog: 0x0d120e, near: 6, far: 70, sky: 0x090c09, hemiSky: 0x7a9a88, hemiGround: 0x2a2014, hemiI: 0.85, moon: 0.55 },
  kiln: { fog: 0x240b05, near: 12, far: 95, sky: 0x140603, hemiSky: 0xb86a40, hemiGround: 0x2a1006, hemiI: 0.55, moon: 0.35 },
  cathedral: { fog: 0x1d1210, near: 22, far: 140, sky: 0x150c0a, hemiSky: 0xb8a090, hemiGround: 0x3a2014, hemiI: 1.0, moon: 1.0 },
};
function setLook(name) {
  const L = LOOKS[name] || LOOKS.pit;
  scene.fog.color.setHex(L.fog); scene.fog.near = L.near; scene.fog.far = L.far;
  scene.background.setHex(L.sky);
  hemi.color.setHex(L.hemiSky); hemi.groundColor.setHex(L.hemiGround); hemi.intensity = L.hemiI;
  moon.intensity = L.moon;
  embers.material.color.setHex(name === 'aqueduct' ? 0x8ad8ff : 0xff7a30);
}

// drifting embers (wrap around the player)
const EMBERS = 260;
const emberGeo = new THREE.BufferGeometry();
const emberPos = new Float32Array(EMBERS * 3);
for (let i = 0; i < EMBERS; i++) {
  emberPos[i * 3] = rand(-A, A); emberPos[i * 3 + 1] = rand(0, 14); emberPos[i * 3 + 2] = rand(-A, A);
}
emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xff7a30, size: 0.12, map: GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
embers.frustumCulled = false;
scene.add(embers);
buildArena();

// a reusable flash light for explosions/muzzle in the world
const worldFlash = new THREE.PointLight(0xffa050, 0, 18, 2);
scene.add(worldFlash);

// ---------------------------------------------------------------- audio
let AC = null, master = null, sfxBus = null, noiseBuf = null;
function initAudio() {
  if (AC) { AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain();
  master.connect(AC.destination);
  sfxBus = AC.createGain();
  sfxBus.connect(master);
  applyVolume();
  ensureMusic();
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function noise(dur, freq, vol, type = 'lowpass', freqEnd = null, q = 0.8) {
  if (!AC) return;
  const t = AC.currentTime;
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(OUT || sfxBus);
  src.start(t); src.stop(t + dur);
}
function tone(f1, f2, dur, vol, type = 'square', delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(OUT || sfxBus);
  o.start(t); o.stop(t + dur);
}
function applyVolume() {
  if (!AC) return;
  master.gain.value = settings.master * 0.6;
  sfxBus.gain.value = settings.sfx;
  if (musicBus) musicBus.gain.value = settings.music;
}
const sfx = {
  revolver() { noise(0.22, 2800, 0.7); tone(220, 60, 0.14, 0.35, 'triangle'); },
  charged() { noise(0.5, 5000, 0.8, 'lowpass', 300); tone(1600, 80, 0.5, 0.35, 'sawtooth'); },
  shotgun() { noise(0.5, 1300, 1.0, 'lowpass', 200); tone(110, 35, 0.3, 0.6, 'sawtooth'); },
  pump() { noise(0.06, 2000, 0.25, 'bandpass', null, 3); noise(0.06, 1500, 0.25, 'bandpass', null, 3); },
  throwCore() { tone(300, 700, 0.15, 0.2, 'triangle'); },
  punch() { noise(0.12, 900, 0.6); tone(140, 50, 0.1, 0.5, 'square'); },
  whiff() { noise(0.15, 2500, 0.15, 'bandpass', 600, 2); },
  parry() { tone(1300, 1900, 0.3, 0.35, 'triangle'); tone(2000, 2600, 0.25, 0.2, 'sine', 0.04); noise(0.15, 6000, 0.3, 'highpass'); },
  explode() { noise(1.0, 900, 1.2, 'lowpass', 60); tone(90, 28, 0.7, 0.8, 'sine'); },
  kill() { noise(0.3, 1800, 0.45, 'lowpass', 300); tone(260, 70, 0.22, 0.3, 'square'); },
  hit() { tone(900, 650, 0.05, 0.1, 'square'); },
  head() { tone(1500, 1200, 0.08, 0.18, 'square'); },
  hurt() { tone(200, 90, 0.3, 0.5, 'sawtooth'); noise(0.2, 600, 0.4); },
  dash() { noise(0.25, 3500, 0.4, 'bandpass', 700, 1.5); },
  jump() { tone(260, 420, 0.08, 0.12, 'sine'); },
  walljump() { tone(320, 620, 0.1, 0.16, 'triangle'); noise(0.08, 1500, 0.2); },
  slide() { noise(0.35, 1200, 0.25, 'bandpass', 500, 1); },
  slamStart() { tone(500, 120, 0.25, 0.25, 'sawtooth'); },
  slam() { noise(0.6, 500, 1.1, 'lowpass', 50); tone(70, 25, 0.5, 0.9, 'sine'); },
  orb(v) { tone(650, 300, 0.3, 0.18 * v, 'sine'); },
  windup(v) { tone(150, 300, 0.4, 0.15 * v, 'sawtooth'); },
  heavySlam(v) { noise(0.6, 400, 1.0 * v, 'lowpass', 40); tone(55, 25, 0.5, 0.8 * v, 'sine'); },
  rankUp() { tone(600, 900, 0.12, 0.18, 'triangle'); tone(900, 1350, 0.16, 0.18, 'triangle', 0.08); },
  wave() { tone(200, 200, 0.25, 0.25, 'sawtooth'); tone(300, 300, 0.4, 0.25, 'sawtooth', 0.2); },
  screech(v) { tone(1900, 600, 0.35, 0.16 * v, 'sawtooth'); noise(0.3, 4000, 0.2 * v, 'bandpass', 1500, 3); },
  bossRoar() { tone(90, 42, 1.2, 0.6, 'sawtooth'); noise(1.0, 500, 0.7, 'lowpass', 90); tone(140, 60, 1.0, 0.35, 'square'); },
  door() { noise(0.6, 320, 0.55, 'lowpass', 80); tone(70, 40, 0.5, 0.35, 'square'); },
  portal() { tone(400, 1600, 0.8, 0.22, 'sine'); tone(600, 2400, 0.8, 0.14, 'triangle', 0.1); },
  coin() { tone(1800, 2600, 0.12, 0.12, 'triangle'); },
  coinHit() { tone(2600, 3400, 0.1, 0.2, 'square'); tone(3400, 2200, 0.15, 0.12, 'triangle', 0.04); },
  saw() { noise(0.5, 3500, 0.35, 'bandpass', 2000, 4); tone(900, 1400, 0.4, 0.08, 'sawtooth'); },
  sizzle() { noise(0.35, 3000, 0.35, 'highpass'); tone(200, 90, 0.2, 0.15, 'sawtooth'); },
  flame() { noise(0.7, 900, 0.5, 'lowpass', 300); },
  nail() { noise(0.05, 4000, 0.18, 'bandpass', 2500, 3); tone(1400, 900, 0.04, 0.05, 'square'); },
  ting() { tone(2400, 1800, 0.07, 0.12, 'triangle'); },
  buy() { tone(500, 1000, 0.12, 0.2, 'triangle'); tone(1000, 1500, 0.2, 0.2, 'triangle', 0.1); noise(0.2, 6000, 0.15, 'highpass'); },
  spawn(v) { noise(0.5, 300, 0.4 * v, 'lowpass', 2000); },
};
const distVol = (p) => clamp(1 - p.distanceTo(P.pos) / 55, 0.05, 1);

// ---------------------------------------------------------------- input
const keys = new Set(), pressed = new Set(), released = new Set();
const locked = () => document.pointerLockElement === renderer.domElement;
const bound = (a) => settings.binds[a] || [];
const VDOWN = new Set(), VHIT = new Set(); // actions held / pressed this frame by gamepad or touch
const AXIS = { x: 0, y: 0 };                // analog move (x = strafe, y = forward)
const down = (a) => VDOWN.has(a) || bound(a).some((c) => c && keys.has(c));
const hit = (a) => VHIT.has(a) || bound(a).some((c) => c && pressed.has(c));
const isBound = (code) => ACTIONS.some(([id]) => bound(id).includes(code));

addEventListener('keydown', (e) => {
  if (e.isTrusted) setInput('kbm');
  if (G.state === 'play' && (isBound(e.code) || e.code === 'Tab' || e.code === 'Space' || e.ctrlKey || e.altKey || e.metaKey)) e.preventDefault();
  // with keyboard lock on, Escape reaches the page instead of releasing the mouse, so pause manually
  if (e.code === 'Escape' && G.state === 'play') { document.exitPointerLock?.(); if (G.state === 'play') { G.state = 'pause'; show('pause', true); } return; }
  if (e.code === 'Escape' && G.state === 'settings') { closeSettings(); return; }
  if (e.code === 'Escape' && G.state === 'shop') { closeShop(); return; }
  if (!e.repeat) pressed.add(e.code);
  keys.add(e.code);
});
addEventListener('keyup', (e) => { keys.delete(e.code); released.add(e.code); });
addEventListener('blur', () => keys.clear());
addEventListener('mousedown', (e) => { if (G.state !== 'play' || Date.now() - lastTouch < 900) return; setInput('kbm'); if (!locked()) requestLock(); const c = 'Mouse' + e.button; keys.add(c); pressed.add(c); if (e.button > 2) e.preventDefault(); });
addEventListener('mouseup', (e) => { const c = 'Mouse' + e.button; keys.delete(c); released.add(c); if (e.button > 2 && G.state === 'play') e.preventDefault(); });
addEventListener('auxclick', (e) => { if (G.state === 'play') e.preventDefault(); });
addEventListener('contextmenu', (e) => e.preventDefault());
let swayX = 0, swayY = 0;
addEventListener('mousemove', (e) => {
  if (!locked() || G.state !== 'play') return;
  P.yaw -= e.movementX * 0.0022 * settings.sens;
  P.pitch = clamp(P.pitch - e.movementY * 0.0022 * settings.sens * (settings.invertY ? -1 : 1), -1.55, 1.55);
  swayX += e.movementX; swayY += e.movementY;
});
addEventListener('wheel', () => { if (G.state === 'play' && settings.wheelSwap) switchWeapon(nextGun()); });

// ---------------------------------------------------------------- game state
const G = { slow: { t: 0, scale: 1 }, mode: 'endless', level: null, levelIdx: 0, layout: null, portal: null, boss: null, styleTotal: 0, dmgTaken: 0, levelTime: 0, styleTarget: 1, spawn: new V3(0, 0, 12), ceil: 11, state: 'menu', wave: 0, toSpawn: [], spawnT: 0, breakT: 0, score: 0, time: 0, kills: 0, hitstop: 0, shake: 0, bestRank: 0, waveActive: false };
const P = {
  pos: new V3(0, 0, 12), vel: new V3(), yaw: 0, pitch: 0, hp: 100, grounded: false,
  wallJumps: 3, pips: 3, dashT: 0, dashDir: new V3(), sliding: false, slideDir: new V3(),
  slamming: false, slamFall: 0, invuln: 0, camH: 1.6, roll: 0, bob: 0, hurtFlash: 0,
};
const PR = 0.4, PH = 1.8;

// ---------------------------------------------------------------- collisions
function overlapBox(minx, miny, minz, maxx, maxy, maxz) {
  for (const s of solids) {
    if (!s.active) continue;
    if (minx < s.max.x && maxx > s.min.x && miny < s.max.y && maxy > s.min.y && minz < s.max.z && maxz > s.min.z) return s;
  }
  return null;
}
function playerOverlap(p, h = PH) {
  return overlapBox(p.x - PR, p.y, p.z - PR, p.x + PR, p.y + h, p.z + PR);
}
// moves the player along one axis; returns 'floor' | 'ceil' | 'wall' | null
function moveAxis(axis, delta) {
  const p = P.pos;
  p[axis] += delta;
  const h = P.sliding ? 1.0 : PH;
  const s = playerOverlap(p, h);
  if (!s) return null;
  if (axis === 'y') {
    if (delta < 0) { p.y = s.max.y; return 'floor'; }
    p.y = s.min.y - h - 0.001; return 'ceil';
  }
  // auto step-up for small ledges
  if (P.grounded && s.max.y - p.y <= 0.6) {
    const oy = p.y; p.y = s.max.y + 0.001;
    if (!playerOverlap(p, h)) return null;
    p.y = oy;
  }
  p[axis] = delta > 0 ? s.min[axis] - PR - 0.001 : s.max[axis] + PR + 0.001;
  return 'wall';
}
function wallNormal() {
  const p = P.pos;
  let best = null, bd = PR + 0.35;
  for (const s of solids) {
    if (!s.active) continue;
    if (p.y + PH <= s.min.y || p.y >= s.max.y - 0.1) continue;
    const cx = clamp(p.x, s.min.x, s.max.x), cz = clamp(p.z, s.min.z, s.max.z);
    const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d < bd && d > 1e-4) { bd = d; best = new V3(dx / d, 0, dz / d); }
  }
  return best;
}

// ---------------------------------------------------------------- particles & fx
const partGeo = new THREE.BoxGeometry(1, 1, 1);
const partMats = {};
function pmat(color, basic) {
  const k = color + (basic ? 'b' : 's');
  if (!partMats[k]) partMats[k] = basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  return partMats[k];
}
const parts = [];
let partCursor = 0;
function spawnPart(pos, vel, color, size, life, basic = false, grav = 1) {
  let p;
  if (parts.length < QCAP(160, 300, 450)) {
    p = { mesh: new THREE.Mesh(partGeo, pmat(color, basic)), vel: new V3(), spin: new V3() };
    p.mesh.castShadow = false;
    scene.add(p.mesh);
    parts.push(p);
  } else {
    p = parts[partCursor++ % parts.length];
    p.mesh.material = pmat(color, basic);
  }
  p.mesh.visible = true;
  p.mesh.position.copy(pos);
  p.vel.copy(vel);
  p.spin.set(rand(-10, 10), rand(-10, 10), rand(-10, 10));
  p.size = size; p.life = p.max = life; p.grav = grav;
  p.mesh.scale.setScalar(size);
}
function burst(pos, n, color, speed, size, life, basic = false, grav = 1, upBias = 0.4) {
  for (let i = 0; i < n; i++) {
    const v = new V3(rand(-1, 1), rand(-0.3, 1) + upBias, rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1));
    spawnPart(pos, v, color, size * rand(0.6, 1.3), life * rand(0.7, 1.2), basic, grav);
  }
}
function updateParts(dt) {
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    p.vel.y -= 25 * p.grav * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    const half = p.size * 0.5;
    if (p.mesh.position.y < half) { p.mesh.position.y = half; p.vel.y *= -0.3; p.vel.x *= 0.7; p.vel.z *= 0.7; }
    p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.y += p.spin.y * dt;
    p.mesh.scale.setScalar(p.size * Math.min(1, (p.life / p.max) * 3));
  }
}

const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
const tracers = [];
function tracer(a, b, color = 0xffd9a0, width = 0.02, life = 0.08) {
  const len = a.distanceTo(b);
  if (len < 0.01) return;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(beamGeo, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, tmpV.copy(b).sub(a).normalize());
  m.scale.set(width, len, width);
  scene.add(m);
  tracers.push({ m, life, max: life, w: width });
}
const tmpV = new V3();
function updateTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    const k = Math.max(0, t.life / t.max);
    t.m.material.opacity = k;
    t.m.scale.x = t.m.scale.z = t.w * (0.4 + 0.6 * k);
    if (t.life <= 0) { scene.remove(t.m); t.m.material.dispose(); tracers.splice(i, 1); }
  }
}

const blasts = [];
const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
function blastFx(pos, radius, color = 0xff8a3a) {
  const m = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(pos);
  scene.add(m);
  blasts.push({ m, life: 0.35, max: 0.35, r: radius });
  worldFlash.position.copy(pos); worldFlash.intensity = 120; worldFlash.color.set(color);
}
const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
function ringFx(pos, radius, color = 0xffb060) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(pos); m.position.y += 0.1;
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  blasts.push({ m, life: 0.4, max: 0.4, r: radius, ring: true });
}
function updateBlasts(dt) {
  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i];
    b.life -= dt;
    const k = 1 - b.life / b.max;
    b.m.scale.setScalar(b.r * (b.ring ? k : 0.3 + 0.7 * Math.sqrt(k)));
    b.m.material.opacity = (1 - k) * 0.9;
    if (b.life <= 0) { scene.remove(b.m); b.m.material.dispose(); blasts.splice(i, 1); }
  }
  worldFlash.intensity *= Math.exp(-dt * 14);
}

// ---------------------------------------------------------------- style meter
const RANKS = [
  { l: 'D', n: 'DUSTY', c: '#a0a4a8', need: 0 },
  { l: 'C', n: 'CRUMBLING', c: '#5ecbff', need: 120 },
  { l: 'B', n: 'BRUTAL', c: '#6dff8f', need: 280 },
  { l: 'A', n: 'ANNIHILATING', c: '#ffe14a', need: 480 },
  { l: 'S', n: 'SAVAGE', c: '#ff9a3a', need: 720 },
  { l: 'SS', n: 'SHATTERING', c: '#ff5a3a', need: 1000 },
  { l: 'SSS', n: 'SEISMIC', c: '#ff2a6a', need: 1320 },
  { l: 'RUBBLEMAKER', n: '', c: '#ffd23a', need: 1700 },
];
const STYLE_MAX = 2150;
const ST = { points: 0, idx: 0, lastIdx: 0 };
const fresh = { launcher: 1, revolver: 1, shotgun: 1, nailgun: 1, punch: 1, slam: 1, blade: 1, shock: 1, grapple: 1 };
function freshInfo(v) {
  if (v > 0.7) return { name: 'FRESH', mult: 1.5 };
  if (v > 0.45) return { name: 'USED', mult: 1.0 };
  if (v > 0.2) return { name: 'STALE', mult: 0.5 };
  return { name: 'DULL', mult: 0.15 };
}
function useWeapon(w) {
  if (fresh[w] === undefined) return;
  fresh[w] = Math.max(0, fresh[w] - 0.08);
  for (const k in fresh) if (k !== w) fresh[k] = Math.min(1, fresh[k] + 0.03);
}
function rankIndex(p) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (p >= RANKS[k].need) i = k;
  return i;
}
const feedEl = $('feed');
function pushFeed(text, cls = '') {
  const last = feedEl.lastElementChild;
  if (last && last.dataset.label === text && performance.now() - Number(last.dataset.t) < 1200) {
    const n = Number(last.dataset.n) + 1;
    last.dataset.n = n; last.dataset.t = performance.now();
    last.textContent = `${text} x${n}`;
    return;
  }
  const d = document.createElement('div');
  d.textContent = text; d.className = cls;
  d.dataset.label = text; d.dataset.n = 1; d.dataset.t = performance.now();
  feedEl.appendChild(d);
  while (feedEl.children.length > 7) feedEl.firstElementChild.remove();
  setTimeout(() => d.classList.add('fade'), 2300);
  setTimeout(() => d.remove(), 2850);
}
function addStyle(pts, label, weapon = null, cls = '') {
  const m = weapon && fresh[weapon] !== undefined ? freshInfo(fresh[weapon]).mult : 1;
  const gained = pts * m;
  ST.points = Math.min(STYLE_MAX, ST.points + gained);
  G.styleTotal += gained;
  G.score += gained * (1 + ST.idx * 0.25) * (G.mod ? G.mod.mult : 1);
  if (label) { pushFeed('+' + label, cls); statLabel(label); vsLabel(label); tutLabel(label); }
}
function loseStyle(n) {
  ST.points = Math.max(0, ST.points - n);
}

// ---------------------------------------------------------------- viewmodel
const VM = buildViewmodels(GLOW);
const { revolver, shotgun, arm, revFlash, shotFlash, chargeMat, pump: pumpMesh } = VM;
vmScene.add(revolver, shotgun, VM.nailgun, VM.launcher, ...Object.values(VM.arms));
const guns = [revolver, shotgun, VM.nailgun, VM.launcher];
const WNAMES = ['REVOLVER', 'SHOTGUN', 'NAILGUN', 'LAUNCHER'];

const W = { altCD: 0, variant: [0, 0, 0, 0], arm: 'fist', heat: 0, nailCD: 0, shockCharge: 0, coins: 4, pump: 0, sawCD: 0, cur: 0, cd: 0, switchT: 0, lastSwitch: -9, charge: 0, charging: false, punchCD: 0, punchT: 0, kick: 0, coreCD: 0, flashT: 0 };
function switchWeapon(i) {
  if (i === 4 && !owns('flail')) { if (G.state === 'play') pushFeed('FLAIL LOCKED · beat THE STOKER (4-5)', 'bad'); return; }
  if (i === 3 && !owns('launcher')) { if (G.state === 'play') pushFeed('LAUNCHER LOCKED · beat THE BELL-RINGER (2-5)', 'bad'); return; }
  if (i === 2 && !owns('nailgun')) { if (G.state === 'play') pushFeed('NAILGUN LOCKED · beat THE ORGANIST (1-5)', 'bad'); return; }
  if (i === 1 && !owns('shotgun')) { if (G.state === 'play') pushFeed('SHOTGUN LOCKED · beat MORTIMER (0-5)', 'bad'); return; }
  if (i === W.cur) { cycleVariant(i); return; }
  W.cur = i; W.switchT = 0.18; W.lastSwitch = G.time; W.charging = false; W.charge = 0;
  W.cd = Math.max(W.cd, 0.12);
  guns.forEach((g, k) => (g.visible = k === i));
  document.querySelectorAll('#weaponSlots span[data-w]').forEach((s) => s.classList.toggle('on', Number(s.dataset.w) === i));
  sfx.pump();
  W.revSpin = 0;
}
