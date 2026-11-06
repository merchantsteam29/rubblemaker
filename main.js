import * as THREE from 'three';
import { buildEnemyModel, buildBossModel, buildTrainerModel, buildForge, buildPortal, buildVariantModel, buildDuelistModel, animateEnemy, buildViewmodels, buildCatModel } from './models.js';
import { LEVELS, SCENES, DUELS, PRIMES, buildLevel } from './levels.js';
import { createMusic } from './music.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { settings, saveSettings, ACTIONS, DIFFS, keyLabel, initSettingsUI, padLabel } from './settings.js';

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
  if (label) { pushFeed('+' + label, cls); statLabel(label); vsLabel(label); }
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
  if (i === 4 && !owns('flail')) { if (G.state === 'play') pushFeed('FLAIL LOCKED · visit the FORGE', 'bad'); return; }
  if (i === 3 && !owns('launcher')) { if (G.state === 'play') pushFeed('LAUNCHER LOCKED · visit the FORGE', 'bad'); return; }
  if (i === 2 && !owns('nailgun')) { if (G.state === 'play') pushFeed('NAILGUN LOCKED · visit the FORGE', 'bad'); return; }
  if (i === 1 && !owns('shotgun')) { if (G.state === 'play') pushFeed('SHOTGUN LOCKED · visit the FORGE', 'bad'); return; }
  if (i === W.cur) { cycleVariant(i); return; }
  W.cur = i; W.switchT = 0.18; W.lastSwitch = G.time; W.charging = false; W.charge = 0;
  W.cd = Math.max(W.cd, 0.12);
  guns.forEach((g, k) => (g.visible = k === i));
  document.querySelectorAll('#weaponSlots span[data-w]').forEach((s) => s.classList.toggle('on', Number(s.dataset.w) === i));
  sfx.pump();
  W.revSpin = 0;
}

// ---------------------------------------------------------------- enemies
const DIFF = () => G.modDiff || DIFFS[settings.difficulty] || DIFFS.normal;
const DEFS = {
  grunt: { hp: 60, speed: 6.8, r: 0.5, h: 2.25, color: 0xb8452c, mass: 1, kill: 60, label: 'KILL' },
  shooter: { hp: 70, speed: 5.2, r: 0.5, h: 2.45, color: 0x5c64b8, mass: 1, kill: 70, label: 'KILL' },
  flyer: { hp: 40, speed: 9, r: 0.6, h: 1.0, color: 0x7a7468, mass: 0.7, kill: 70, label: 'KILL', fly: true },
  boss1: { hp: 2600, speed: 4.2, r: 2.2, h: 6.8, color: 0x8c8478, mass: 60, kill: 600, label: 'BOSS KILL', boss: true, name: 'MORTIMER, WARDEN OF THE CELLAR', short: 'MORTIMER' },
  boss2: { hp: 3400, speed: 6, r: 1.6, h: 7.4, color: 0xd8c49a, mass: 60, kill: 800, label: 'BOSS KILL', boss: true, fly: true, name: 'THE HIGH MASON, ARCHITECT OF RUIN', short: 'THE HIGH MASON' },
  bulwark: { hp: 480, speed: 2.8, r: 1.0, h: 3.5, color: 0x6a7088, mass: 40, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE BULWARK · TRAINER', short: 'THE BULWARK', hint: 'Bullets glance off THE BULWARK · PUNCH his big orb to PARRY it back into him', canHurt: (i) => !!i.parry, onHurt: (e) => { e.state = 'recover'; e.t = 1.2; banner('CRACKED!'); } },
  sweeper: { hp: 650, speed: 3.4, r: 1.3, h: 4.2, color: 0x8a6a40, mass: 40, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE SWEEPER · TRAINER', short: 'THE SWEEPER', hint: 'His waves are too tall to jump · DASH straight through them' },
  roost: { hp: 400, speed: 10, r: 1.4, h: 2.4, color: 0x6a5a7a, mass: 30, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, fly: true, name: 'THE ROOST · TRAINER', short: 'THE ROOST', hint: 'THE ROOST only flinches when you are AIRBORNE · jump and shoot, or GROUND SLAM her when she lands', canHurt: (i) => !P.grounded || i.weapon === 'slam' },
  kiln: { hp: 560, speed: 2.6, r: 1.6, h: 5.2, color: 0x2e2622, mass: 40, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE KILN · TRAINER', short: 'THE KILN', hint: 'Only a COMBO BLAST cracks THE KILN · lob a core (shotgun ALT) and shoot it with the revolver', canHurt: (i) => !!i.combo || (!owns('shotgun') && !!i.parry) },
  shield: { hp: 90, speed: 4.2, r: 0.55, h: 2.25, color: 0x8a5a3a, mass: 1.6, kill: 90, label: 'KILL', ai: 'grunt', variantModel: true, shielded: true, hint: 'SHIELDBEARERS block from the front · flank them, or break the shield with explosions, slams or the GRAPPLE' },
  sniper: { hp: 60, speed: 4.5, r: 0.5, h: 2.45, color: 0x3a4a3a, mass: 1, kill: 90, label: 'KILL', ai: 'sniper', variantModel: true },
  bomber: { hp: 25, speed: 9.5, r: 0.45, h: 1.8, color: 0x8a6a2a, mass: 0.8, kill: 50, label: 'KILL', ai: 'bomber', variantModel: true, bomber: true },
  priest: { hp: 90, speed: 4.5, r: 0.5, h: 2.45, color: 0xe8e0d0, mass: 1, kill: 110, label: 'EXCOMMUNICATED', ai: 'priest', variantModel: true },
  shard: { hp: 1600, speed: 7, r: 0.75, h: 3.0, color: 0x9ad8ff, mass: 40, kill: 600, label: 'DUEL WON', boss: true, duelist: true, name: 'SISTER SHARD', short: 'SISTER SHARD' },
  bertha: { hp: 2200, speed: 4.5, r: 1.3, h: 3.9, color: 0xc8784a, mass: 50, kill: 600, label: 'DUEL WON', boss: true, duelist: true, name: 'BIG BERTHA BRICKS', short: 'BIG BERTHA' },
  kite: { hp: 1300, speed: 12, r: 0.55, h: 1.9, color: 0x5a5a62, mass: 30, kill: 600, label: 'DUEL WON', boss: true, duelist: true, fly: true, name: 'KITE, THE CHIMNEY SWEEP', short: 'KITE' },
  swarmling: { hp: 12, speed: 11, r: 0.35, h: 0.7, color: 0x8a4a3a, mass: 0.4, kill: 25, label: 'KILL', fly: true, base: 'flyer', scale: 0.55 },
  mirror: { hp: 500, speed: 3, r: 1.0, h: 3.5, color: 0xb8d8f0, mass: 40, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE MIRROR KNIGHT · TRAINER', short: 'THE MIRROR KNIGHT', hint: 'Only RICOCHETS hurt the MIRROR KNIGHT · COINSHOT a coin into him or bank a CHAINLINK shot', canHurt: (i) => !!(i.coin || i.chain) || (!owns('rev1') && !owns('rev2') && !!i.lance) },
  marksman: { hp: 1000, speed: 4.5, r: 0.7, h: 3.4, color: 0x2a3a2a, mass: 40, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, ai: 'sniper', name: 'THE MARKSMAN · TRAINER', short: 'THE MARKSMAN', hint: 'THE MARKSMAN only falls to his own bullets · PUNCH the instant his laser flashes white', canHurt: (i) => !!i.countersnipe },
  fortress: { hp: 700, speed: 2.8, r: 1.4, h: 4.6, color: 0x5a5a6a, mass: 50, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, layers: 3, name: 'THE FORTRESS · TRAINER', short: 'THE FORTRESS', hint: 'THE FORTRESS hides behind 3 shield layers · strip them with explosions, slams, shockwaves or the GRAPPLE' },
  queen: { hp: 450, speed: 9, r: 1.4, h: 2.4, color: 0x7a3a5a, mass: 30, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, fly: true, name: 'THE SWARM QUEEN · TRAINER', short: 'THE SWARM QUEEN', hint: 'THE SWARM QUEEN only feels the NAILGUN · throw a LODESTONE magnet on her and spray', canHurt: (i) => i.weapon === 'nailgun' || !owns('nailgun') },
  boss3: { hp: 4200, speed: 3.6, r: 2.4, h: 7.8, color: 0x4a2216, mass: 70, kill: 1000, label: 'BOSS KILL', boss: true, name: 'THE MOLTEN FOREMAN', short: 'THE MOLTEN FOREMAN' },
  gilded: { hp: 2400, speed: 8.5, r: 0.75, h: 3.0, color: 0xffc040, mass: 40, kill: 900, label: 'DUEL WON', boss: true, duelist: true, name: 'THE GILDED ONE', short: 'THE GILDED ONE' },
  heavy: { hp: 340, speed: 3.6, r: 1.0, h: 3.25, color: 0xa07a4a, mass: 3.5, kill: 160, label: 'BIG KILL' },
};
const enemies = [];
function makeEnemy(type, x, z, y = 0) {
  const def = DEFS[type];
  const model = def.cat ? buildCatModel() : def.base ? buildEnemyModel(def.base, def.color) : def.duelist ? buildDuelistModel(type) : def.variantModel ? buildVariantModel(type) : def.trainer ? buildTrainerModel(type) : def.boss ? buildBossModel(type) : buildEnemyModel(type, def.color);
  const g = model.root;
  if (def.scale) g.scale.multiplyScalar(def.scale);
  if (CHEATS.bigheads && model.rig.head) model.rig.head.scale.multiplyScalar(2);
  g.position.set(x, def.fly ? y : y - def.h, z);
  const baseScale = g.scale.x;
  if (def.fly) g.scale.setScalar(0.001);
  scene.add(g);
  const e = {
    type, def, mesh: g, mats: model.mats, extraMats: model.extraMats, hit: model.hit, rig: model.rig, orb: model.orb,
    hp: def.hp * (DIFF().hp || 1), vel: new V3(), state: 'chase', t: 0, cd: rand(0.8, 2), flash: 0,
    grounded: true, strafe: Math.random() < 0.5 ? -1 : 1, strafeT: rand(1, 3), spawnT: def.boss ? 1.6 : 0.7, spawnMax: def.boss ? 1.6 : 0.7, spawnY: y, baseScale, home: new V3(x, y + 1, z), animType: { boss1: 'heavy', boss2: 'shooter', bulwark: 'grunt', sweeper: 'heavy', roost: 'flyer', kiln: 'heavy', shield: 'grunt', sniper: 'shooter', bomber: 'grunt', priest: 'shooter', shard: 'grunt', bertha: 'heavy', kite: 'grunt', swarmling: 'flyer', mirror: 'grunt', marksman: 'shooter', fortress: 'heavy', queen: 'flyer', boss3: 'heavy', gilded: 'grunt', ram: 'heavy', burrower: 'grunt', mender: 'shooter', tumble: 'grunt', twirl: 'grunt', anvil: 'heavy', bellows: 'heavy', crane: 'flyer' }[type] || null, layers: def.layers || 0, shieldUp: !!def.shielded, shieldHP: 80, maxHp: def.hp * (DIFF().hp || 1), mv: new V3(), orbit: rand(0, 6.28), alt: rand(4, 6.5), dead: false, walk: rand(0, 6),
  };
  for (const m of model.hit) m.userData.enemy = e;
  maybeIntro(type);
  statMet(type);
  enemies.push(e);
  // spawn fx
  const pos = new V3(x, def.fly ? y : 0.2 + y, z);
  ringFx(pos, 2.5, 0xff3a2a);
  burst(pos, 14, 0xff4a2a, 7, 0.15, 0.6, true, 0.3, 1.2);
  sfxAt(pos, 'spawn', distVol(pos));
  maybeElite(e);
  if (!def.boss) voiceSoon(e, 'alert', 0.9);
  return e;
}

function enemyCollide(e) {
  const r = e.def.r, p = e.mesh.position;
  for (const s of solids) {
    if (!s.active) continue;
    if (s.max.y <= p.y + 0.4 || s.min.y >= p.y + e.def.h) continue;
    const cx = clamp(p.x, s.min.x, s.max.x), cz = clamp(p.z, s.min.z, s.max.z);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x += (dx / d) * (r - d); p.z += (dz / d) * (r - d);
    } else {
      const o = [p.x - s.min.x, s.max.x - p.x, p.z - s.min.z, s.max.z - p.z];
      const m = Math.min(...o);
      if (m === o[0]) p.x = s.min.x - r; else if (m === o[1]) p.x = s.max.x + r;
      else if (m === o[2]) p.z = s.min.z - r; else p.z = s.max.z + r;
    }
    e.vel.x *= 0.5; e.vel.z *= 0.5;
  }
}
function enemyFloor(e) {
  const p = e.mesh.position, r = e.def.r * 0.5;
  let fy = -50;
  for (const s of solids) {
    if (!s.active) continue;
    if (p.x + r > s.min.x && p.x - r < s.max.x && p.z + r > s.min.z && p.z - r < s.max.z && s.max.y <= p.y + 0.4) fy = Math.max(fy, s.max.y);
  }
  return fy;
}
function lineOfSight(a, b) {
  const dir = tmpV.copy(b).sub(a);
  const dist = dir.length();
  ray.set(a, dir.normalize()); ray.far = dist;
  return ray.intersectObjects(worldMeshes, false).length === 0;
}
const playerEye = () => new V3(P.pos.x, P.pos.y + P.camH, P.pos.z);

const orbs = [];
const orbGeo = new THREE.SphereGeometry(0.26, 14, 10);
function fireOrb(e) {
  const from = new V3();
  e.orb.getWorldPosition(from);
  const target = playerEye();
  target.y -= 0.3;
  const t = from.distanceTo(target) / 15;
  target.addScaledVector(P.vel, t * 0.5);
  const vel = target.sub(from).normalize().multiplyScalar(15);
  const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xffb02a }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff9a2a, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(1.6);
  m.add(glow);
  m.position.copy(from);
  scene.add(m);
  orbs.push({ m, glow, vel, dmg: 15, parried: false, life: 7, dodged: false });
  sfxAt(from, 'orb', distVol(from));
}

function updateEnemies(dt) {
  const eye = playerEye();
  for (const e of enemies) {
    if (e.dead) continue;
    const p = e.mesh.position;
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      const k = Math.max(0, e.spawnT / e.spawnMax);
      if (e.def.fly) e.mesh.scale.setScalar(e.baseScale * Math.max(0.001, 1 - k));
      else p.y = e.spawnY - e.def.h * k;
      continue;
    }
    if (e.dummy) { updateDummy(e, dt); continue; }
    if (e.type === 'flyer' || e.type === 'swarmling') { updateFlyer(e, dt); continue; }
    if (e.type === 'boss3') { updateBoss3(e, e.prime ? dt * 1.25 : dt); if (e.prime && !e.dead) primeTick(e, dt); continue; }
    if (e.type === 'boss1') { updateBoss1(e, e.prime ? dt * 1.25 : dt); if (e.prime && !e.dead) primeTick(e, dt); continue; }
    if (e.type === 'boss2') { updateBoss2(e, e.prime ? dt * 1.25 : dt); if (e.prime && !e.dead) primeTick(e, dt); continue; }
    if (e.def.ai === 'ram' || e.def.ai === 'burrower' || e.def.ai === 'mender') { updateNewAI(e, dt); continue; }
    if (e.def.trainer) { updateTrainer(e, dt); continue; }
    if (e.def.duelist) { updateDuelist(e, dt); continue; }
    if (e.def.ai && e.def.ai !== 'grunt') { updateVariantAI(e, dt); continue; }
    const dx = P.pos.x - p.x, dz = P.pos.z - p.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    e.mesh.rotation.y = Math.atan2(dx, dz);
    let mx = 0, mz = 0;
    e.cd -= dt; e.t -= dt;
    const def = e.def;
    let windupGlow = 0;

    if ((e.def.ai || e.type) === 'grunt') {
      if (e.state === 'chase') {
        mx = nx * def.speed * DIFF().speed; mz = nz * def.speed * DIFF().speed;
        if (dist < 2.0 && e.cd <= 0 && Math.abs(P.pos.y - p.y) < 2) { e.state = 'windup'; e.t = 0.42; sfxAt(p, 'windup', distVol(p)); }
      } else if (e.state === 'windup') {
        windupGlow = 1 - e.t / 0.42;
       
        mx = nx * 1.5; mz = nz * 1.5;
        if (e.t <= 0) {
          if (dist < 2.7 && Math.abs(P.pos.y - p.y) < 2) hurtPlayer(15, new V3(nx, 0.3, nz).multiplyScalar(8));
          e.state = 'recover'; e.t = 0.45;
        }
      } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(0.4, 0.9); }
    } else if (e.type === 'shooter') {
      e.strafeT -= dt;
      if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rand(1.2, 3); }
      let fwd = 0;
      if (dist > 19) fwd = 1; else if (dist < 10) fwd = -1;
      const sp = e.state === 'windup' ? 0.3 : 1;
      mx = (nx * fwd + -nz * e.strafe * 0.7) * def.speed * sp;
      mz = (nz * fwd + nx * e.strafe * 0.7) * def.speed * sp;
      if (e.state === 'chase' && e.cd <= 0 && dist < 45) {
        const from = new V3(p.x, p.y + 1.9, p.z);
        if (lineOfSight(from, eye)) { e.state = 'windup'; e.t = 0.7; }
        else e.cd = 0.5;
      } else if (e.state === 'windup') {
        windupGlow = 1 - e.t / 0.7;
        e.orb.scale.setScalar(0.08 + windupGlow * 0.22);
       
        if (e.t <= 0) {
          fireOrb(e);
          e.orb.scale.setScalar(0.08);
          e.state = 'chase'; e.cd = rand(2.0, 3.4) * DIFF().fire;
        }
      }
    } else { // heavy
      if (e.state === 'chase') {
        mx = nx * def.speed * DIFF().speed; mz = nz * def.speed * DIFF().speed;
        if (dist < 3.8 && e.cd <= 0) { e.state = 'windup'; e.t = 0.85; sfxAt(p, 'windup', distVol(p)); }
      } else if (e.state === 'windup') {
        windupGlow = 1 - e.t / 0.85;
       
        if (e.t <= 0) {
          const center = new V3(p.x + nx * 1.4, p.y, p.z + nz * 1.4);
          ringFx(center, 5, 0xff6a2a);
          burst(center, 18, 0x8a7a6a, 9, 0.25, 0.8);
          sfxAt(p, 'heavySlam', distVol(p));
          G.shake = Math.max(G.shake, 0.5 * distVol(p));
          const pd = Math.hypot(P.pos.x - center.x, P.pos.z - center.z);
          if (pd < 5 && P.pos.y - p.y < 1.6) hurtPlayer(30, new V3(nx * 10, 9, nz * 10));
          e.state = 'recover'; e.t = 0.9;
        }
      } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(0.6, 1.2); }
    }

    enemyPhysics(e, mx, mz, dt);

    // walk bob
    const moving = Math.hypot(mx, mz) > 0.5 && e.grounded;
    if (moving) e.walk += dt * def.speed * 1.6;
    animateEnemy(e, dt, moving || (e.type === 'shooter' && Math.hypot(mx, mz) > 0.5), windupGlow, G.time);

    // flash / telegraph
    e.flash -= dt;
    applyFlash(e, windupGlow);
  }
  // separation
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i]; if (a.dead || a.spawnT > 0) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j]; if (b.dead || b.spawnT > 0) continue;
      const pa = a.mesh.position, pb = b.mesh.position;
      const dx = pb.x - pa.x, dz = pb.z - pa.z, d = Math.hypot(dx, dz), min = a.def.r + b.def.r;
      if (d < min && d > 1e-4 && Math.abs(pa.y - pb.y) < 2) {
        const push = (min - d) / 2, ux = dx / d, uz = dz / d;
        const wa = b.def.mass / (a.def.mass + b.def.mass), wb = 1 - wa;
        pa.x -= ux * push * 2 * wa; pa.z -= uz * push * 2 * wa;
        pb.x += ux * push * 2 * wb; pb.z += uz * push * 2 * wb;
      }
    }
  }
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
}

function damageEnemy(e, dmg, info) {
  if (e.dead || e.spawnT > 0 || e.buried) return false;
  if (e.state === 'stun') dmg *= 1.5;
  if (e.wardT > G.time) dmg *= 0.5;
  if (e.shieldUp && !info.combo && !info.parry && !info.explosion && info.weapon !== 'slam') {
    const f = new V3(Math.sin(e.mesh.rotation.y), 0, Math.cos(e.mesh.rotation.y));
    const to = camera.position.clone().sub(e.mesh.position).setY(0).normalize();
    if (f.dot(to) > 0.3) { e.shieldHP -= dmg; blockedFx(e, info.point); if (e.shieldHP <= 0) breakShield(e, to.clone().negate()); return false; }
  }
  if (info.combo && e.shieldUp) breakShield(e, null);
  if (e.layers > 0) {
    if (info.explosion || info.combo || info.weapon === 'slam' || info.weapon === 'shock') stripLayer(e); else blockedFx(e, info.point);
    return false;
  }
  if ((e.type === 'shard' || e.type === 'gilded') && e.state === 'stance' && !info.parry && !info.combo && !info.explosion) {
    blockedFx(e, info.point);
    if (G.time - (e.reflT || 0) > 0.3) { e.reflT = G.time; hurtPlayer(8, null); pushFeed('REFLECTED', 'bad'); }
    return false;
  }
  if (e.def.canHurt && !e.def.canHurt(info, e)) { blockedFx(e, info.point); return false; }
  dmg = swapChain(info, dmg);
  dmg = eliteDmg(e, dmg, info);
  e.hp -= dmg;
  if (G.mode === 'practice') practiceHit(e, dmg);
  e.flash = 0.07;
  e.flinch = Math.min(1.2, (e.flinch || 0) + dmg / 35);
  if (settings.gore && info.point && Math.random() < 0.6) bloodSpray(info.point);
  if (e.def.onHurt) e.def.onHurt(e);
  if (e.hp > 0 && Math.random() < 0.4) voice(e, 'hurt');
  const pt = info.point || e.mesh.position.clone().setY(e.mesh.position.y + e.def.h * 0.6);
  burst(pt, Math.min(12, 3 + (dmg / 8) | 0), 0x9a0e0a, 6, 0.1, 0.5, false, 1, 0.6);
  if (info.knock) e.vel.addScaledVector(info.knock, 1 / e.def.mass);
  if (info.knock && info.knock.y > 2) e.grounded = false;
  // blood heal when up close
  const d = e.mesh.position.distanceTo(P.pos);
  if (d < 5.5) heal(dmg * 0.25);
  addStyle(Math.min(dmg, 40) * 0.25, null, info.weapon);
  if (e.hp <= 0) { killEnemy(e, info); return true; }
  return false;
}

const killBurst = { n: 0, t: -9 };
function killEnemy(e, info) {
  e.dead = true;
  G.kills++;
  statKill(e, info);
  voice(e, 'die');
  eliteKilled(e, info);
  if (!e.def.boss && !e.dummy && e.type !== 'swarmling' && e.type !== 'mender') RECENT_DEAD.push({ type: e.type, x: e.mesh.position.x, z: e.mesh.position.z, t: G.time });
  if (e.def.onKill) e.def.onKill(e, info || {});
  if (e.def.boss) bossDefeated(e);
  removeEnemyFx(e);
  if (e.def.bomber) detonateBomber(e, false);
  const c = e.mesh.position.clone(); c.y += e.def.h * 0.5;
  burst(c, e.type === 'heavy' ? 34 : 18, e.def.color, 10, 0.3, 1.4, false, 1, 0.6);
  burst(c, 16, 0x8a0a0a, 9, 0.16, 1.0, false, 1, 0.5);
  burst(c, 8, 0xffa04a, 6, 0.08, 0.4, true, 0.2);
  if (settings.gore) gibEnemy(e, info);
  else { scene.remove(e.mesh); for (const mt of [...e.mats, ...e.extraMats]) mt.dispose(); }
  fxFlash(0xffffff, info && info.head ? 0.2 : 0.1);
  spatial(c, () => sfx.kill());
  G.shake = Math.max(G.shake, e.type === 'heavy' ? 0.35 : 0.15);

  const w = info.weapon;
  addStyle(e.def.kill, e.def.label, w, e.type === 'heavy' ? 'big' : '');
  if (info.head) addStyle(50, 'HEADSHOT', w, 'big');
  if (!e.grounded) addStyle(60, 'AIRSHOT', w, 'cool');
  if (!P.grounded && P.dashT <= 0) addStyle(30, 'AIRBORNE', w, 'cool');
  if (P.sliding) addStyle(30, 'SLIDE KILL', w, 'cool');
  if (e.hp < -e.def.hp * 0.75) addStyle(25, 'OVERKILL', w);
  if ((w === 'revolver' || w === 'shotgun') && G.time - W.lastSwitch < 0.6) addStyle(45, 'QUICKDRAW', w, 'cool');
  if (P.hp < 25) addStyle(40, 'CLOSE CALL', null, 'bad');

  if (G.time - killBurst.t < 0.35) killBurst.n++; else killBurst.n = 1;
  killBurst.t = G.time;
  if (killBurst.n === 2) addStyle(80, 'DOUBLE KILL', null, 'big');
  else if (killBurst.n === 3) addStyle(120, 'TRIPLE KILL', null, 'big');
  else if (killBurst.n > 3) addStyle(150, 'MULTIKILL', null, 'big');

  heal(4 + ST.idx * 2);
}

function hurtPlayer(dmg, knock, env) {
  if (G.state !== 'play' || P.invuln > 0 || P.dashT > 0) return false;
  if (G.mode === 'practice' && PRACTICE.god) return false;
  dmg = Math.round(dmg * (env ? Math.sqrt(DIFF().dmg) : DIFF().dmg));
  P.hp -= dmg;
  G.dmgTaken += dmg;
  P.invuln = 0.15;
  P.hurtFlash = 1;
  fxShift(0.016); fxFlash(0xff2010, 0.18);
  if (knock) { P.vel.add(knock); if (knock.y > 1) P.grounded = false; }
  loseStyle(110 + dmg * 3);
  pushFeed('-OUCH', 'bad');
  G.shake = Math.max(G.shake, 0.35);
  sfx.hurt();
  if (P.hp <= 0) { if (G.mode === 'practice') { P.hp = 100; banner('RUBBLED · HP REFILLED'); } else { P.hp = 0; gameOver(); } }
  return true;
}
function heal(n) {
  P.hp = Math.min(100, P.hp + n * (DIFF().heal || 1));
}

// ---------------------------------------------------------------- shooting
const ray = new THREE.Raycaster();
function aim() {
  const dir = new V3(); camera.getWorldDirection(dir);
  return { origin: camera.position.clone(), dir };
}
function muzzle() {
  const q = camera.quaternion;
  return camera.position.clone()
    .add(new V3(0, 0, -1).applyQuaternion(q).multiplyScalar(0.8))
    .add(new V3(1, 0, 0).applyQuaternion(q).multiplyScalar(0.24))
    .add(new V3(0, 1, 0).applyQuaternion(q).multiplyScalar(-0.2));
}
function rayTargets() {
  const t = worldMeshes.slice();
  for (const e of enemies) if (!e.dead && e.spawnT <= 0) t.push(...e.hit);
  for (const c of cores) t.push(c.m);
  for (const c of coins) t.push(c.hit);
  return t;
}
function hitmarker(head) {
  statHit();
  if (!settings.hitmarkers) { head ? sfx.head() : sfx.hit(); return; }
  const h = $('hitmarker');
  h.className = head ? 'head' : '';
  h.style.opacity = 1;
  clearTimeout(hitmarker.t);
  hitmarker.t = setTimeout(() => (h.style.opacity = 0), 90);
  head ? sfx.head() : sfx.hit();
}
function impactFx(point, normal) {
  if (normal && settings.gore) decal(point, normal, rand(0.12, 0.2), holeMat);
  const n = normal || UP;
  for (let i = 0; i < 6; i++) {
    const v = n.clone().multiplyScalar(4).add(new V3(rand(-2, 2), rand(0, 3), rand(-2, 2)));
    spawnPart(point, v, 0x8a7a6a, rand(0.05, 0.12), 0.6);
  }
  spawnPart(point, n.clone().multiplyScalar(1), 0xffc070, 0.08, 0.08, true, 0);
}

function fireRevolver() {
  statShot();
  const { origin, dir } = aim();
  ray.set(origin, dir); ray.far = 250;
  const h = ray.intersectObjects(rayTargets(), false)[0];
  const end = h ? h.point : origin.clone().addScaledVector(dir, 250);
  tracer(muzzle(), end, 0xffe0a0, 0.025, 0.08);
  sfx.revolver();
  W.kick = 1; W.flashT = 0.05;
  if (!h) return;
  const o = h.object;
  if (o.userData.core) { detonateCore(o.userData.core, true); return; }
  if (o.userData.coin) { coinShot(o.userData.coin, 70, 0); return; }
  const e = o.userData.enemy;
  if (e) {
    const head = o.userData.part === 'head';
    useWeapon('revolver');
    damageEnemy(e, head ? 55 : 26, { weapon: 'revolver', head, point: h.point, knock: dir.clone().multiplyScalar(2) });
    hitmarker(head);
  } else impactFx(h.point, h.face ? h.face.normal.clone().transformDirection(o.matrixWorld) : null);
}

function fireCharged() {
  statShot();
  const { origin, dir } = aim();
  ray.set(origin, dir); ray.far = 250;
  const hits = ray.intersectObjects(rayTargets(), false);
  let end = origin.clone().addScaledVector(dir, 250);
  const hitE = new Set();
  let n = 0, anyHead = false;
  for (const h of hits) {
    const o = h.object;
    if (o.userData.core) { detonateCore(o.userData.core, true); continue; }
    if (o.userData.coin) { coinShot(o.userData.coin, 120, 0); continue; }
    const e = o.userData.enemy;
    if (e) {
      if (hitE.has(e)) continue;
      hitE.add(e);
      const head = o.userData.part === 'head';
      anyHead ||= head;
      damageEnemy(e, head ? 180 : 120, { weapon: 'revolver', lance: true, head, point: h.point, knock: dir.clone().multiplyScalar(10).setY(3) });
      n++;
      continue;
    }
    end = h.point;
    impactFx(h.point, null);
    burst(h.point, 10, 0x6ad8ff, 6, 0.08, 0.4, true, 0.2);
    break;
  }
  const m = muzzle();
  tracer(m, end, 0x6ad8ff, 0.12, 0.35);
  tracer(m, end, 0xffffff, 0.04, 0.25);
  sfx.charged();
  W.kick = 2.2; W.flashT = 0.08; G.shake = Math.max(G.shake, 0.25);
  if (n) { useWeapon('revolver'); hitmarker(anyHead); }
  if (n >= 2) addStyle(40 * n, `PIERCER x${n}`, 'revolver', 'cool');
}

function fireShotgun() {
  statShot();
  const { origin, dir } = aim();
  const right = new V3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new V3(0, 1, 0).applyQuaternion(camera.quaternion);
  const targets = rayTargets();
  const dmgMap = new Map();
  const m = muzzle();
  const pumpN = W.cur === 1 && W.variant[1] === 1 ? W.pump : 0;
  const pm = 1 + pumpN * 0.45;
  for (let i = 0; i < 11 + pumpN * 3; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.09 * (1 + pumpN * 0.25);
    const d = dir.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    ray.set(origin, d); ray.far = 80;
    const h = ray.intersectObjects(targets, false)[0];
    const end = h ? h.point : origin.clone().addScaledVector(d, 80);
    if (i % 2 === 0) tracer(m, end, 0xffc080, 0.015, 0.06);
    if (!h) continue;
    const o = h.object;
    if (o.userData.core) { detonateCore(o.userData.core, false); continue; }
    if (o.userData.coin) { removeCoin(o.userData.coin); continue; }
    const e = o.userData.enemy;
    if (e) {
      const head = o.userData.part === 'head';
      const falloff = clamp(1.4 - h.distance / 20, 0.25, 1);
      const rec = dmgMap.get(e) || { dmg: 0, head: false, point: h.point };
      rec.dmg += (head ? 13 : 9) * falloff * pm;
      rec.head ||= head;
      dmgMap.set(e, rec);
    } else if (i % 3 === 0) impactFx(h.point, null);
  }
  let anyHead = false;
  for (const [e, rec] of dmgMap) {
    anyHead ||= rec.head;
    damageEnemy(e, rec.dmg, { weapon: 'shotgun', head: rec.head && rec.dmg > 60, point: rec.point, knock: dir.clone().multiplyScalar(rec.dmg * 0.12).setY(1.5) });
  }
  if (dmgMap.size) { useWeapon('shotgun'); hitmarker(anyHead); }
  if (pumpN === 3) { explode(origin.clone().addScaledVector(dir, 1.6), 5, 90, 'shotgun'); addStyle(80, 'OVERPRESSURE', 'shotgun', 'big'); }
  else if (pumpN) P.vel.addScaledVector(dir, -4 * pumpN);
  W.pump = 0;
  sfx.shotgun();
  setTimeout(() => sfx.pump(), 380);
  W.kick = 2 + pumpN; W.flashT = 0.07; G.shake = Math.max(G.shake, 0.12);
}

// ---------------------------------------------------------------- shotgun cores
const cores = [];
const coreGeo = new THREE.IcosahedronGeometry(0.22, 0);
function throwCore() {
  const { origin, dir } = aim();
  const m = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff6a1a, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(1.4);
  m.add(glow);
  m.position.copy(origin).addScaledVector(dir, 0.8);
  scene.add(m);
  const c = { m, vel: dir.clone().multiplyScalar(24).add(new V3(0, 4, 0)).add(P.vel.clone().multiplyScalar(0.5)), life: 1.6, punched: false };
  m.userData.core = c;
  cores.push(c);
  sfx.throwCore();
  W.kick = 0.8;
}
function updateCores(dt) {
  for (let i = cores.length - 1; i >= 0; i--) {
    const c = cores[i];
    c.life -= dt;
    c.vel.y -= (c.punched ? 6 : 22) * dt;
    const p = c.m.position;
    for (const ax of ['x', 'y', 'z']) {
      p[ax] += c.vel[ax] * dt;
      if (overlapBox(p.x - 0.2, p.y - 0.2, p.z - 0.2, p.x + 0.2, p.y + 0.2, p.z + 0.2)) {
        p[ax] -= c.vel[ax] * dt;
        c.vel[ax] *= c.punched ? 0 : -0.45;
        if (c.punched) c.life = 0;
      }
    }
    c.m.rotation.x += dt * 8; c.m.rotation.y += dt * 6;
    let hitEnemy = false;
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const ep = e.mesh.position;
      if (Math.hypot(p.x - ep.x, p.z - ep.z) < e.def.r + 0.35 && p.y > ep.y && p.y < ep.y + e.def.h) { hitEnemy = true; break; }
    }
    if (c.life <= 0 || hitEnemy) detonateCore(c, false);
  }
}
function detonateCore(c, combo) {
  const i = cores.indexOf(c);
  if (i < 0) return;
  cores.splice(i, 1);
  scene.remove(c.m);
  c.m.material.dispose();
  if (combo) {
    explode(c.m.position, 8, 140, 'combo');
    addStyle(120, 'COMBO BLAST', null, 'big');
    G.hitstop = 0.06;
  } else explode(c.m.position, 5.5, 75, c.punched ? 'punchcore' : 'shotgun');
}

function explode(pos, radius, dmg, weapon) {
  rubble(pos, weapon === 'combo' ? 12 : 7);
  if (weapon !== 'enemy') breakSecrets(pos, radius);
  if (weapon === 'enemy') {
    blastFx(pos, radius, 0xb8543a); burst(pos, 18, 0x5a5048, 9, 0.2, 0.9); spatial(pos, () => sfx.explode());
    const pc = new V3(P.pos.x, P.pos.y + 0.9, P.pos.z);
    if (pc.distanceTo(pos) < radius) hurtPlayer(18, pc.sub(pos).normalize().multiplyScalar(10).setY(6));
    return;
  }
  if (camera.position.distanceTo(pos) < radius * 2.5) fxShift(weapon === 'combo' ? 0.02 : 0.01);
  blastFx(pos, radius, weapon === 'combo' ? 0xffd04a : 0xff7a2a);
  burst(pos, 26, 0xff8a3a, 14, 0.18, 0.6, true, 0.4);
  burst(pos, 16, 0x5a5048, 10, 0.25, 1.2);
  spatial(pos, () => sfx.explode());
  G.shake = Math.max(G.shake, weapon === 'combo' ? 0.7 : 0.45);
  let hitAny = 0;
  for (const e of enemies.slice()) {
    if (e.dead || e.spawnT > 0) continue;
    const c = e.mesh.position.clone(); c.y += e.def.h * 0.5;
    const d = c.distanceTo(pos);
    if (d > radius) continue;
    const k = 1 - (d / radius) * 0.6;
    const away = c.clone().sub(pos).setY(0).normalize().multiplyScalar(9 * k).setY(9 * k);
    damageEnemy(e, dmg * k, { weapon: weapon === 'combo' || weapon === 'bomb' ? null : weapon === 'brick' ? 'launcher' : weapon === 'flail' ? 'flail' : 'shotgun', explosion: true, combo: weapon === 'combo', point: c, knock: away });
    hitAny++;
  }
  if (hitAny && weapon !== 'combo') useWeapon(weapon === 'brick' ? 'launcher' : weapon === 'flail' ? 'flail' : 'shotgun');
  if (hitAny >= 3) addStyle(60, 'COLLATERAL', null, 'cool');
  if (weapon === 'punchcore' && hitAny) addStyle(80, 'HOMERUN', 'punch', 'big');
  if (weapon === 'bomb') {
    const pc2 = new V3(P.pos.x, P.pos.y + 0.9, P.pos.z);
    if (pc2.distanceTo(pos) < radius * 0.9) hurtPlayer(25, pc2.sub(pos).normalize().multiplyScalar(12).setY(8));
    if (hitAny >= 2) addStyle(60, 'FRIENDLY FIRE', null, 'cool');
    return;
  }
  // self damage + blast jump
  const pc = new V3(P.pos.x, P.pos.y + 0.9, P.pos.z);
  const pd = pc.distanceTo(pos);
  if (pd < radius * 0.75) {
    const away = pc.sub(pos).normalize();
    P.vel.addScaledVector(away, 12); P.vel.y = Math.max(P.vel.y, 11);
    P.grounded = false;
    if (P.invuln <= 0 && P.dashT <= 0) {
      P.hp -= 12; G.dmgTaken += 12; P.hurtFlash = 0.6;
      if (P.hp <= 0) { P.hp = 0; gameOver(); }
    }
    addStyle(30, 'BLAST JUMP', null, 'cool');
  }
}

// ---------------------------------------------------------------- punch / parry
function punch() {
  W.punchCD = 0.42; W.punchT = 0.26;
  const { origin, dir } = aim();
  let did = breakSecretsInFront(3.2);
  for (const e of enemies) {
    if (e.dead || e.def.ai !== 'sniper' || e.state !== 'aim' || e.t > 0.45) continue;
    const hp = new V3(); e.rig.head.getWorldPosition(hp);
    if (!lineOfSight(origin, hp)) continue;
    tracer(origin, hp, 0xffffff, 0.08, 0.3);
    e.state = 'recover'; e.t = 1; if (e.beam) e.beam.visible = false;
    damageEnemy(e, 400, { weapon: null, parry: true, countersnipe: true, head: true, point: hp });
    addStyle(150, 'COUNTERSNIPE', null, 'big');
    fxFlash(0xffffff, 0.35); G.hitstop = 0.12; sfx.parry();
    did = true;
  }
  // parry projectiles
  for (const o of orbs) {
    if (o.parried) continue;
    const to = o.m.position.clone().sub(origin);
    const d = to.length();
    if (d < 3.6 && to.normalize().dot(dir) > 0.45) {
      o.parried = true; o.dmg = o.big ? 170 : 90; o.life = 4;
      o.vel.copy(dir).multiplyScalar(42);
      o.m.material.color.set(0x9ae8ff); o.glow.material.color.set(0x3ac8ff);
      did = true;
      sfx.parry();
      G.hitstop = 0.11;
      heal(25);
      addStyle(100, 'PARRY', null, 'big');
      fxFlash(0x6ad8ff, 0.3); fxShift(0.01);
      pushFeed('+25 HP', 'heal');
    }
  }
  // punch cores
  for (const c of cores) {
    const to = c.m.position.clone().sub(origin);
    if (to.length() < 3.2 && to.normalize().dot(dir) > 0.4) {
      c.vel.copy(dir).multiplyScalar(40); c.punched = true; c.life = 2;
      did = true; sfx.parry(); G.hitstop = 0.06;
      addStyle(40, 'CORE PUNCH', 'punch', 'cool');
    }
  }
  // melee enemies
  for (const e of enemies.slice()) {
    if (e.dead || e.spawnT > 0) continue;
    const c = e.mesh.position.clone(); c.y += Math.min(e.def.h * 0.6, 1.4);
    const to = c.clone().sub(origin);
    const d = to.length() - e.def.r;
    if (d < 2.6 && to.normalize().dot(dir) > 0.55) {
      useWeapon('punch');
      damageEnemy(e, 28, { weapon: 'punch', point: c, knock: dir.clone().multiplyScalar(12).setY(5) });
      did = true;
      hitmarker(false);
    }
  }
  if (did) { sfx.punch(); G.shake = Math.max(G.shake, 0.15); }
  else sfx.whiff();
}

function updateOrbs(dt) {
  const eye = playerEye();
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.life -= dt;
    if (o.grav && !o.parried) o.vel.y -= o.grav * dt;
    o.m.position.addScaledVector(o.vel, dt);
    const p = o.m.position;
    let dead = o.life <= 0;
    if (overlapBox(p.x - 0.1, p.y - 0.1, p.z - 0.1, p.x + 0.1, p.y + 0.1, p.z + 0.1)) dead = true;
    if (!dead && !o.parried) {
      // segment distance to player body
      const py = clamp(p.y, P.pos.y + 0.2, P.pos.y + P.camH);
      const d = Math.hypot(p.x - P.pos.x, p.y - py, p.z - P.pos.z);
      if (d < 0.65) {
        if (P.dashT > 0 || P.invuln > 0) {
          if (!o.dodged) { o.dodged = true; addStyle(40, 'DODGE', null, 'cool'); }
        } else { hurtPlayer(o.dmg, o.vel.clone().normalize().multiplyScalar(4)); dead = true; }
      }
    }
    if (!dead && o.parried) {
      for (const e of enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const ep = e.mesh.position;
        if (Math.hypot(p.x - ep.x, p.z - ep.z) < e.def.r + 0.4 && p.y > ep.y && p.y < ep.y + e.def.h + 0.2) {
          damageEnemy(e, o.dmg, { weapon: null, parry: true, point: p.clone(), knock: o.vel.clone().normalize().multiplyScalar(8).setY(4) });
          dead = true; break;
        }
      }
    }
    if (dead) {
      if (o.boom) explode(o.m.position.clone(), o.boom, o.parried ? 80 : 0, o.parried ? 'bomb' : 'enemy');
      burst(p, 8, o.parried ? 0x6ad8ff : 0xffb02a, 5, 0.08, 0.35, true, 0.2);
      if (o.parried) blastFx(p, 1.8, 0x6ad8ff);
      scene.remove(o.m); o.m.material.dispose(); o.glow.material.dispose();
      orbs.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- player
function slamImpact() {
  G.slamAt = G.time; G.slamPos = P.pos.clone();
  breakSecrets(P.pos, 5);
  rubble(P.pos, 6, 4);
  fxShift(0.012);
  P.landDip = 1;
  const fall = P.slamFall;
  const radius = 5 + Math.min(3, fall * 2);
  const dmg = 30 + Math.min(40, fall * 30);
  ringFx(P.pos, radius, 0xffb060);
  burst(P.pos.clone().setY(P.pos.y + 0.2), 22, 0x8a7a6a, 10, 0.2, 0.8);
  sfx.slam();
  G.shake = Math.max(G.shake, 0.5);
  let n = 0;
  for (const e of enemies.slice()) {
    if (e.dead || e.spawnT > 0) continue;
    const ep = e.mesh.position;
    const d = Math.hypot(ep.x - P.pos.x, ep.z - P.pos.z);
    if (d < radius && Math.abs(ep.y - P.pos.y) < 2) {
      const away = new V3(ep.x - P.pos.x, 0, ep.z - P.pos.z).normalize().multiplyScalar(4).setY(11);
      damageEnemy(e, dmg, { weapon: 'slam', knock: away });
      n++;
    }
  }
  if (n) { useWeapon('slam'); addStyle(40 + n * 15, 'GROUND SLAM', 'slam', 'cool'); }
}

function updatePlayer(dt) {
  const fwd = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  const right = new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  const ix = clamp((down('right') ? 1 : 0) - (down('left') ? 1 : 0) + AXIS.x, -1, 1);
  const iz = clamp((down('forward') ? 1 : 0) - (down('back') ? 1 : 0) + AXIS.y, -1, 1);
  const rv = VS && VS.fx && VS.fx.reverse ? -1 : 1;
  const wish = fwd.clone().multiplyScalar(iz * rv).addScaledVector(right, ix * rv);
  if (wish.lengthSq() > 1) wish.normalize();
  const crouchHeld = down('slide');
  const crouchPressed = hit('slide');

  P.invuln -= dt;
  P.pips = Math.min(3, P.pips + dt * 0.85);

  // dash
  if (hit('dash') && P.pips >= 1) {
    if (!CHEATS.infdash) P.pips -= 1;
    P.dashDir.copy(wish.lengthSq() ? wish : fwd).normalize();
    P.dashT = 0.17; P.invuln = Math.max(P.invuln, 0.22); P.dashHits = null;
    P.sliding = false; P.slamming = false;
    sfx.dash();
  }
  // slam / slide
  if (crouchPressed) {
    if (!P.grounded && !P.slamming && P.dashT <= 0) {
      P.slamming = true; P.slamFall = 0;
      P.vel.set(0, -55, 0);
      sfx.slamStart();
    } else if (P.grounded && !P.sliding) startSlide(wish, fwd);
  }
  if (P.grounded && crouchHeld && !P.sliding && P.dashT <= 0 && !crouchPressed && P.landedT < 0.05) startSlide(wish, fwd);
  if (P.sliding && (!crouchHeld)) P.sliding = false;

  // jump
  if (hit('jump')) {
    if (P.grounded) {
      if (P.sliding) {
        P.sliding = false;
        P.vel.x = P.slideDir.x * 17; P.vel.z = P.slideDir.z * 17;
      }
      P.vel.y = 11.5; P.grounded = false;
      sfx.jump();
    } else {
      const n = P.wallJumps > 0 ? wallNormal() : null;
      if (!n && P.airJumps > 0 && owns('up_djump')) {
        P.airJumps--; P.slamming = false;
        P.vel.y = 10.5;
        if (wish.lengthSq()) { const hs2 = Math.max(9, Math.hypot(P.vel.x, P.vel.z)); P.vel.x = wish.x * hs2; P.vel.z = wish.z * hs2; }
        sfx.jump(); tone(600, 900, 0.12, 0.12, 'triangle');
        ringFx(P.pos.clone().setY(P.pos.y + 0.05), 1.4, 0xffd04a);
        burst(P.pos.clone().setY(P.pos.y + 0.1), 10, 0xffd04a, 4, 0.08, 0.4, true, 0.3);
      }
      if (n) {
        P.wallJumps--;
        P.slamming = false;
        const h = n.multiplyScalar(10).addScaledVector(wish, 4);
        P.vel.set(h.x, 12, h.z);
        sfx.walljump();
        burst(P.pos.clone().addScaledVector(n, -0.4).setY(P.pos.y + 1), 6, 0x8a7a6a, 3, 0.1, 0.5);
      }
    }
  }

  // velocity
  if (P.dashT > 0) {
    P.dashT -= dt;
    if (owns('up_firedash')) fireDashTick(dt);
    P.vel.set(P.dashDir.x * 32, 0, P.dashDir.z * 32);
    if (P.dashT <= 0) { P.vel.x *= 0.5; P.vel.z *= 0.5; }
    if (Math.random() < 0.6) spawnPart(P.pos.clone().setY(P.pos.y + rand(0.3, 1.5)), new V3(), 0x6ad8ff, 0.06, 0.25, true, 0);
  } else if (P.sliding) {
    if (P.grounded) { P.vel.x = P.slideDir.x * 16; P.vel.z = P.slideDir.z * 16; }
    P.vel.y -= 32 * dt * (CHEATS.lowgrav ? 0.4 : G.lowgrav ? 0.55 : 1);
    if (Math.random() < 0.5) spawnPart(P.pos.clone().setY(P.pos.y + 0.1), new V3(rand(-1, 1), 2, rand(-1, 1)), 0x8a7a6a, 0.08, 0.4);
  } else if (P.slamming) {
    P.vel.x = 0; P.vel.z = 0; P.vel.y = -55;
    P.slamFall += dt;
  } else {
    const speed = 11;
    if (P.grounded) {
      const k = 1 - Math.exp(-dt * 16);
      P.vel.x += (wish.x * speed - P.vel.x) * k;
      P.vel.z += (wish.z * speed - P.vel.z) * k;
    } else {
      const hs = Math.hypot(P.vel.x, P.vel.z);
      P.vel.x += wish.x * 32 * dt; P.vel.z += wish.z * 32 * dt;
      const ns = Math.hypot(P.vel.x, P.vel.z), cap = Math.max(hs, speed);
      if (ns > cap) { P.vel.x *= cap / ns; P.vel.z *= cap / ns; }
    }
    P.vel.y -= 32 * dt * (CHEATS.lowgrav ? 0.4 : G.lowgrav ? 0.55 : 1);
  }

  // move with substeps
  const wasGrounded = P.grounded;
  const vyBefore = P.vel.y;
  const dx = P.vel.x * dt, dy = P.vel.y * dt, dz = P.vel.z * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.25));
  let landed = false;
  for (let i = 0; i < steps; i++) {
    if (moveAxis('x', dx / steps) === 'wall') P.vel.x = P.dashT > 0 ? P.vel.x : 0;
    if (moveAxis('z', dz / steps) === 'wall') P.vel.z = P.dashT > 0 ? P.vel.z : 0;
    const ry = moveAxis('y', dy / steps);
    if (ry === 'floor') { landed = true; P.vel.y = 0; }
    else if (ry === 'ceil') P.vel.y = 0;
  }
  if (!landed && P.vel.y <= 0) {
    // ground probe
    const oy = P.pos.y;
    P.pos.y -= 0.05;
    if (playerOverlap(P.pos, 1.0)) landed = true;
    P.pos.y = oy;
  }
  P.grounded = landed;
  if (landed && !wasGrounded && vyBefore < -8) P.landDip = Math.min(1, -vyBefore / 30);
  P.landedT = P.grounded ? (wasGrounded ? (P.landedT || 0) + dt : 0) : 0;
  if (P.grounded) {
    P.wallJumps = 3; P.airJumps = 1;
    if (P.slamming) { P.slamming = false; slamImpact(); }
  }
  if (P.pos.y < -15) { P.pos.copy(G.spawn); P.pos.y += 1; P.vel.set(0, 0, 0); }

  // camera
  const targetH = P.sliding ? 0.85 : 1.6;
  P.camH += (targetH - P.camH) * (1 - Math.exp(-dt * 18));
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (P.grounded && hs > 2 && !P.sliding) P.bob += dt * hs * 1.1;
  P.roll += (-ix * 0.025 + (P.sliding ? 0.04 : 0) - P.roll) * (1 - Math.exp(-dt * 10));
}
function startSlide(wish, fwd) {
  P.sliding = true;
  P.slideDir.copy(wish.lengthSq() ? wish : fwd).normalize();
  sfx.slide();
}

function updateWeapons(dt) {
  vsTauntInput();
  W.cd -= dt; W.punchCD -= dt; W.coreCD -= dt; W.sawCD -= dt; W.switchT = Math.max(0, W.switchT - dt);
  W.coins = Math.min(4, W.coins + dt / 1.6);
  flailTick(dt);
  if (hit('weapon1')) switchWeapon(0);
  if (hit('weapon2')) switchWeapon(1);
  if (hit('swap')) switchWeapon(nextGun());
  if (hit('arm')) cycleArm();
  if (hit('weapon3')) switchWeapon(2);
  if (hit('weapon4')) switchWeapon(3);
  if (hit('weapon5')) switchWeapon(4);
  if (W.arm === 'shock') {
    if (down('punch') && W.punchCD <= 0) W.shockCharge = Math.min(1, W.shockCharge + dt / 0.7);
    else if (W.shockCharge > 0) { shockPunch(W.shockCharge); W.shockCharge = 0; }
  } else if (hit('punch') && W.punchCD <= 0) { if (W.arm === 'blade') slash(); else if (W.arm === 'grapple') fireGrapple(); else punch(); }
  if (hit('inspect') && !(W.inspectT > 0)) { W.inspectT = 1.6; if (W.cur === 0) W.revSpin = 3; sfx.pump(); }
  if (down('fire') || down('alt')) W.inspectT = 0;

  if (W.cur === 0) {
    const v = W.variant[0];
    if (v === 2) {
      if (hit('alt') && W.coins >= 1) tossCoin();
    } else {
      const need = v === 0 ? 0.9 : 0.6;
      if (down('alt') && W.cd <= 0) { W.charging = true; W.charge = Math.min(1, W.charge + dt / need); }
      if (!down('alt') && W.charging) {
        if (W.charge >= 1) { if (v === 0) fireCharged(); else fireChain(); W.cd = 0.5; }
        W.charging = false; W.charge = 0;
      }
    }
    if (down('fire') && !W.charging && W.cd <= 0) { fireRevolver(); W.cd = 0.36; W.revSpin = 1; }
  } else if (W.cur === 1) {
    const v = W.variant[1];
    if (down('fire') && W.cd <= 0) { fireShotgun(); W.cd = 0.9; }
    if (v === 0 && hit('alt') && W.coreCD <= 0 && W.cd <= 0.3) { throwCore(); W.coreCD = 1.1; W.cd = Math.max(W.cd, 0.35); }
    if (v === 1 && hit('alt') && W.cd <= 0.2 && W.pump < 3) {
      W.pump++; sfx.pump(); W.kick = 0.6; W.cd = Math.max(W.cd, 0.22);
      if (W.pump === 3) pushFeed('OVERPRESSURE READY', 'bad');
    }
    if (v === 2 && hit('alt') && W.sawCD <= 0) { launchSaw(); W.sawCD = 1.2; W.cd = Math.max(W.cd, 0.3); }
  } else if (W.cur === 2) {
    updateNailgun(dt);
  } else if (W.cur === 3) updateLauncher(dt);
  else updateFlail(dt);
}

function updateViewmodel(dt) {
  W.kick *= Math.exp(-dt * 12);
  W.flashT -= dt;
  swayX *= Math.exp(-dt * 10); swayY *= Math.exp(-dt * 10);
  const g = guns[W.cur];
  const b = g.userData.base;
  const bb = settings.viewBob ? 1 : 0;
  const bobX = Math.sin(P.bob) * 0.012 * bb, bobY = Math.abs(Math.cos(P.bob)) * 0.014 * bb;
  W.inspectT = Math.max(0, (W.inspectT || 0) - dt);
  const ip = W.inspectT > 0 ? Math.sin((1 - W.inspectT / 1.6) * Math.PI) : 0;
  const eq = clamp(W.switchT / 0.18, 0, 1);
  const pk = W.punchT > 0 ? Math.sin((1 - W.punchT / 0.26) * Math.PI) : 0;
  const breathe = Math.sin(G.time * 1.7) * 0.004;
  const dip = (P.landDip || 0);
  g.position.set(
    b.x + bobX - swayX * 0.0004 - ip * 0.12 + pk * 0.03,
    b.y - bobY - eq * 0.38 + swayY * 0.0004 - (P.sliding ? 0.03 : 0) + breathe - dip * 0.07 + ip * 0.05 - pk * 0.06,
    b.z + W.kick * 0.06 + ip * 0.06,
  );
  g.rotation.set(
    W.kick * 0.18 + eq * 1.1 - ip * 0.25 + dip * 0.15,
    -swayX * 0.0006 + ip * 1.3,
    (P.sliding ? 0.15 : 0) + eq * 0.7 + W.kick * (W.cur === 0 ? 0.09 : 0.03) + (P.dashT > 0 ? 0.22 : 0) + ip * 0.5 - pk * 0.25,
  );
  if (W.cur === 0 && W.charging) {
    g.position.x += rand(-1, 1) * 0.003 * W.charge;
    g.position.y += rand(-1, 1) * 0.003 * W.charge;
  }
  chargeMat.emissiveIntensity = 0.6 + W.charge * 5 + (W.charge >= 1 ? Math.sin(G.time * 30) * 1.5 : 0);
  VM.revVariants.forEach((g, i) => (g.visible = i === W.variant[0]));
  VM.shotVariants.forEach((g, i) => (g.visible = i === W.variant[1]));
  VM.nailVariants.forEach((g, i) => (g.visible = i === W.variant[2]));
  VM.launcherVariants.forEach((g, i) => (g.visible = i === W.variant[3]));
  flailVM(dt);
  VM.launcherFlash.material.opacity = W.cur === 3 && W.flashT > 0 ? 1 : 0;
  VM.launcherFlash.material.rotation = Math.random() * 6;
  VM.launcherHopper.position.y = 0.16 - (W.cur === 3 && W.cd > 0.3 ? 0.03 : 0);
  VM.launcherAccent.emissiveIntensity = 1.3 + (W.altCD > 0 ? 0 : Math.sin(G.time * 6) * 0.4 + 0.4);
  VM.nailAccent.emissiveIntensity = 1.2 + W.heat * 6;
  VM.nailFlash.material.opacity = W.cur === 2 && W.flashT > 0 ? 1 : 0;
  VM.nailFlash.material.rotation = Math.random() * 6;
  VM.pressureLights.forEach((l, i) => l.material.color.setHex(W.pump > i ? 0xff3a1a : 0x331a10));
  VM.needle.rotation.x = -0.8 + W.pump * 0.6 + (W.pump === 3 ? Math.sin(G.time * 40) * 0.1 : 0);
  VM.saw.rotation.x += dt * (W.sawCD > 0 ? 2 : 14);
  VM.shotAccent.emissiveIntensity = 1.4 + W.pump * 0.8;
  VM.coils.forEach((c, i) => { c.scale.setScalar(1 + (W.charge > i / 3 ? 0.25 : 0) * W.charge); });
  if (W.revSpin > 0) { const st = Math.min(W.revSpin, dt * 8); W.revSpin -= st; VM.cyl.rotation.z += st * Math.PI / 3; }
  VM.hammer.rotation.x = W.cur === 0 ? (W.cd > 0.2 ? 0.5 : W.charging ? 0.6 * W.charge : 0) : 0;
  pumpMesh.position.z = -0.3 + (W.cur === 1 && W.cd > 0.2 && W.cd < 0.6 ? Math.sin((0.6 - W.cd) / 0.4 * Math.PI) * 0.1 : 0);
  const fl = W.flashT > 0 ? 1 : 0;
  revFlash.material.opacity = W.cur === 0 ? fl : 0;
  shotFlash.material.opacity = W.cur === 1 ? fl : 0;
  revFlash.material.rotation = shotFlash.material.rotation = Math.random() * 6;
  vmFlash.intensity = fl * 3;
  // arm punch anim
  W.punchT -= dt;
  const k = W.punchT > 0 ? Math.sin((1 - W.punchT / 0.26) * Math.PI) : 0;
  const AM = VM.arms;
  for (const key in AM) if (key !== W.arm) AM[key].visible = false;
  const A = AM[W.arm] || AM.fist;
  const charging = W.arm === 'shock' && W.shockCharge > 0;
  if (charging) A.position.lerpVectors(A.userData.rest, A.userData.hit, 0.3).add(new V3(0.04, -0.04, 0.2 * W.shockCharge));
  else A.position.lerpVectors(A.userData.rest, A.userData.hit, k);
  A.rotation.set(k * 0.25, k * 0.35, W.arm === 'blade' ? -k * 1.5 : -k * 0.55);
  A.visible = k > 0.01 || charging;
  VM.shockGlow.emissiveIntensity = 1.5 + W.shockCharge * 6;
}

// ---------------------------------------------------------------- waves
const SPAWNS = [];
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  SPAWNS.push([Math.cos(a) * 31, Math.sin(a) * 31]);
}
SPAWNS.push([0, 0], [10, -10], [-10, 10], [20, 20], [-20, -20]);
function startWave(n) {
  G.wave = n;
  G.waveActive = true;
  const shifted = pitWaveSetup(n);
  const bossWave = n % 10 === 0;
  const k = bossWave ? 0.3 : 1;
  const list = [];
  const grunts = Math.round(Math.min(16, 3 + n * 2) * k);
  const shooters = Math.round(Math.min(10, n === 1 ? 1 : n) * k);
  const heavies = Math.round(Math.min(5, Math.floor((n - 1) / 2)) * k);
  for (let i = 0; i < grunts; i++) list.push('grunt');
  for (let i = 0; i < shooters; i++) list.push('shooter');
  for (let i = 0; i < heavies; i++) list.push('heavy');
  for (let i = 0; i < Math.round((n >= 2 ? Math.min(6, n - 1) : 0) * k); i++) list.push('flyer');
  pitExtras(n, list, bossWave);
  list.sort(() => Math.random() - 0.5);
  G.toSpawn = list;
  G.spawnT = 0.8;
  G.pitBossT = bossWave ? 2.4 : 0;
  banner(`WAVE ${n}` + (shifted ? ' · ' + PIT_ARENAS[shifted].name : '') + (bossWave ? ' · BOSS' : ''));
  $('wave').textContent = `WAVE ${n}` + (G.mod ? ' · ' + G.mod.name : '');
  sfx.wave();
}
function spawnOne(type) {
  const ok = SPAWNS.filter(([x, z]) => Math.hypot(x - P.pos.x, z - P.pos.z) > 13);
  const [x, z] = ok[(Math.random() * ok.length) | 0] || SPAWNS[0];
  makeEnemy(type, x + rand(-1.5, 1.5), z + rand(-1.5, 1.5), type === 'flyer' ? rand(4, 6) : 0);
}
function updateWaves(dt) {
  if (!G.waveActive) {
    G.breakT -= dt;
    if (G.breakT <= 0) startWave(G.wave + 1);
    return;
  }
  G.spawnT -= dt;
  if (G.toSpawn.length && G.spawnT <= 0 && enemies.length < 8 + G.wave) {
    spawnOne(G.toSpawn.pop());
    G.spawnT = 0.45;
  }
  if (G.pitBossT > 0) { G.pitBossT -= dt; if (G.pitBossT <= 0) spawnPitBoss(); }
  if (!G.toSpawn.length && enemies.length === 0 && !G.boss && !(G.pitBossT > 0)) {
    G.waveActive = false;
    if (G.mod) { pushFeed(G.mod.name + ' CLEARED · ×' + G.mod.mult + ' SCORE', 'cool'); G.mod = null; G.modDiff = null; G.lowgrav = false; }
    G.breakT = 3.5;
    heal(30);
    addStyle(100, 'WAVE CLEAR', null, 'big');
    pushFeed('+30 HP', 'heal');
    banner('WAVE CLEAR');
    killCam(0.6, 0.3);
  }
}
let bannerT = 0;
function banner(text) {
  const b = $('banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(bannerT);
  bannerT = setTimeout(() => b.classList.remove('show'), 1600);
}

// ---------------------------------------------------------------- HUD
const ui = { hp: -1, rank: -1, pips: '', fresh: '', weapon: -1, score: -1 };
function updateHUD() {
  const hp = Math.ceil(P.hp);
  if (hp !== ui.hp) {
    ui.hp = hp;
    $('hpFill').style.width = `${P.hp}%`;
    $('hpText').textContent = hp;
  }
  const sc = Math.floor(G.score);
  if (sc !== ui.score) { ui.score = sc; $('score').textContent = sc.toLocaleString(); }
  // pips
  const pipEls = document.querySelectorAll('.pip');
  pipEls.forEach((el, i) => {
    let f = el.firstElementChild;
    if (!f) { f = document.createElement('i'); el.appendChild(f); }
    f.style.width = `${clamp(P.pips - i, 0, 1) * 100}%`;
    f.style.opacity = P.pips - i >= 1 ? 1 : 0.45;
  });
  // style
  const idx = rankIndex(ST.points);
  ST.idx = idx;
  const R = RANKS[idx];
  const rankEl = $('rank');
  if (idx !== ui.rank) {
    if (idx > ui.rank && ui.rank >= 0) {
      sfx.rankUp();
      if (music && idx >= 4) music.stinger(idx === RANKS.length - 1 ? 2 : 1);
      vsRank(idx);
      rankEl.classList.remove('pop'); void rankEl.offsetWidth; rankEl.classList.add('pop');
      if (idx === RANKS.length - 1) banner('RUBBLEMAKER');
    }
    ui.rank = idx;
    rankEl.textContent = R.l;
    rankEl.classList.toggle('top', idx === RANKS.length - 1);
    $('rankName').textContent = R.n;
    G.bestRank = Math.max(G.bestRank, idx);
  }
  const col = idx === RANKS.length - 1 ? `hsl(${(G.time * 160) % 360},100%,62%)` : R.c;
  rankEl.style.color = col;
  $('style').style.color = col;
  $('rankName').style.color = col;
  const next = RANKS[idx + 1];
  const frac = next ? (ST.points - R.need) / (next.need - R.need) : (ST.points - R.need) / (STYLE_MAX - R.need);
  $('styleFill').style.width = `${clamp(frac, 0, 1) * 100}%`;
  $('style').style.opacity = ST.points > 1 || feedEl.children.length ? 1 : 0;
  // weapon + freshness
  if (W.cur !== ui.weapon || W.variant[W.cur] !== ui.variant) {
    ui.weapon = W.cur; ui.variant = W.variant[W.cur];
    const vd = VARIANTS[W.cur][W.variant[W.cur]];
    $('weaponName').innerHTML = `${WNAMES[W.cur]} <span style="color:${vd.css}">${vd.name}</span>`;
  }
  let alt = '';
  if (W.cur === 0 && W.variant[0] === 2) { const n = Math.floor(W.coins); alt = 'COINS ' + '●'.repeat(n) + '○'.repeat(4 - n); }
  else if (W.cur === 1 && W.variant[1] === 1) alt = 'PRESSURE ' + '▮'.repeat(W.pump) + '▯'.repeat(3 - W.pump);
  else if (W.cur === 1 && W.variant[1] === 2) alt = W.sawCD > 0 ? 'SAW ··· ' : 'SAW READY';
  else if (W.cur === 2 && W.variant[2] === 0) alt = 'MAGNETS ' + '◆'.repeat(3 - magnets.length) + '◇'.repeat(magnets.length);
  else if (W.cur === 2 && W.variant[2] === 1) { const n = Math.round(W.heat * 5); alt = (W.overheat > 0 ? 'OVERHEAT ' : 'HEAT ') + '▮'.repeat(n) + '▯'.repeat(5 - n); }
  else if (W.cur === 3) alt = W.variant[3] === 1 ? 'LIMPETS ' + bricks.filter((b) => b.kind === 'limpet').length + ' · ALT DETONATES' : (W.altCD > 0 ? (W.variant[3] ? 'FAN' : 'CLUSTER') + ' ···' : (W.variant[3] ? 'FAN' : 'CLUSTER') + ' READY');
  if (W.cur === 4) alt = flailAlt();
  if (W.arm === 'shock' && W.shockCharge > 0) alt = 'CHARGE ' + '▮'.repeat(Math.round(W.shockCharge * 5));
  if (alt !== ui.alt) { ui.alt = alt; $('altInfo').textContent = alt; }
  const fi = freshInfo(fresh[['revolver', 'shotgun', 'nailgun', 'launcher', 'flail'][W.cur]]);
  if (fi.name !== ui.fresh) { ui.fresh = fi.name; const f = $('fresh'); f.textContent = fi.name; f.className = fi.name; }
  // charge bar
  $('charge').style.opacity = W.charging || FLAIL.held ? 1 : 0;
  const chv = FLAIL.held ? FLAIL.wind : W.charge;
  $('chargeFill').style.width = `${chv * 100}%`;
  $('chargeFill').style.background = chv >= 1 ? '#ffffff' : FLAIL.held ? '#ffb03a' : '#6ad8ff';
  // hurt vignette
  P.hurtFlash = Math.max(0, P.hurtFlash - 0.04);
  $('hurt').style.opacity = Math.max(P.hurtFlash, P.hp < 30 ? 0.35 + Math.sin(G.time * 6) * 0.15 : 0);
}

// ---------------------------------------------------------------- main update
function update(dt) {
  G.time += dt;
  scene.updateMatrixWorld();
  updatePlayer(dt);
  // camera from player
  camera.position.set(P.pos.x, P.pos.y + P.camH + (settings.viewBob ? Math.abs(Math.sin(P.bob)) * 0.05 : 0), P.pos.z);
  G.shake *= Math.exp(-dt * 7);
  const sh = G.shake * 0.25 * settings.shake;
  camera.position.x += rand(-sh, sh); camera.position.y += rand(-sh, sh); camera.position.z += rand(-sh, sh);
  P.landDip = (P.landDip || 0) * Math.exp(-dt * 7);
  camera.position.y -= P.landDip * 0.28;
  camera.rotation.set(P.pitch - P.landDip * 0.05, P.yaw, P.roll);
  updateFov(dt);
  camera.updateMatrixWorld();

  updateWeapons(dt);
  updateEnemies(dt);
  updateOrbs(dt);
  updateCores(dt);
  updateCoins(dt);
  updateSaws(dt);
  updateNails(dt);
  updateBricks(dt);
  updateFlames(dt);
  updateElites(dt);
  updateBurning(dt);
  updateForge();
  if (G.mode === 'endless') updateWaves(dt); else if (G.mode === 'practice') updatePractice(dt); else updateCampaign(dt);
  updateShockwaves(dt);
  updateHazards(dt);
  updateSecrets(dt);
  updateDoors(dt);
  updateBossBar();
  moon.position.set(P.pos.x + 30, 55, P.pos.z + 18);
  moon.target.position.set(P.pos.x, 0, P.pos.z);

  // style decay + freshness recovery
  const decay = (12 + ST.idx * 10) * (enemies.length ? 1 : 0.35);
  ST.points = Math.max(0, ST.points - decay * dt);
  for (const k in fresh) fresh[k] = Math.min(1, fresh[k] + dt * 0.012);
}

function updateAmbient(dt, t) {
  const ref = G.state === 'play' || G.state === 'pause' ? P.pos : camera.position;
  updateLights(dt, t, ref);
  const a = emberGeo.attributes.position.array;
  for (let i = 0; i < EMBERS; i++) {
    a[i * 3 + 1] += dt * (0.4 + (i % 7) * 0.08);
    a[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.3;
    if (a[i * 3 + 1] > 15) a[i * 3 + 1] = 0;
    if (a[i * 3] - ref.x > 30) a[i * 3] -= 60; else if (a[i * 3] - ref.x < -30) a[i * 3] += 60;
    if (a[i * 3 + 2] - ref.z > 30) a[i * 3 + 2] -= 60; else if (a[i * 3 + 2] - ref.z < -30) a[i * 3 + 2] += 60;
  }
  emberGeo.attributes.position.needsUpdate = true;
  updateMusic();
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  pollInput(dt);
  if (G.state === 'play') {
    let gdt = dt;
    if (G.hitstop > 0) { G.hitstop -= dt; gdt = dt * 0.05; }
    if (G.slow.t > 0) { G.slow.t -= dt; gdt *= G.slow.scale; }
    update(gdt);
    updateParts(gdt);
    updateDebris(gdt);
    updateTracers(dt);
    updateBlasts(gdt);
    updateViewmodel(dt);
    updateHUD();
  } else if (G.state === 'vsSpectate') {
    vsSpectateTick(dt); updateParts(dt);
  } else if (G.state === 'cutscene') {
    updateCutscene(dt); updateParts(dt); updateBlasts(dt);
  } else if (menuish()) {
    updateMenuScene(dt, now / 1000);
  }
  updateAmbient(dt, now / 1000);
  pressed.clear(); released.clear(); VHIT.clear();
  updateFPS(now);
  autoQuality(now);
  renderFrame(dt);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- flow
function clearWorld() {
  for (const e of enemies) { scene.remove(e.mesh); removeEnemyFx(e); }
  enemies.length = 0;
  for (const o of orbs) scene.remove(o.m);
  orbs.length = 0;
  for (const c of cores) scene.remove(c.m);
  cores.length = 0;
  for (const p of parts) { p.life = 0; p.mesh.visible = false; }
  feedEl.innerHTML = '';
  clearFireballs();
}
function resetGame() {
  clearWorld();
  Object.assign(P, { hp: 100, grounded: false, wallJumps: 3, pips: 3, dashT: 0, sliding: false, slamming: false, invuln: 0, camH: 1.6, roll: 0, hurtFlash: 0, yaw: 0, pitch: 0 });
  P.pos.set(0, 0, 12); P.vel.set(0, 0, 0);
  Object.assign(G, { wave: 0, toSpawn: [], score: 0, time: 0, kills: 0, hitstop: 0, shake: 0, bestRank: 0, waveActive: false, breakT: 1.2 });
  ST.points = 0;
  Object.assign(G, { styleTotal: 0, dmgTaken: 0, levelTime: 0, boss: null, portal: null, mod: null, modDiff: null, lowgrav: false, pitBossT: 0 });
  for (const s of shocks) { scene.remove(s.m); s.m.material.dispose(); }
  shocks.length = 0;
  clearProjectiles();
  clearNails();
  ghostClear();
  RECENT_DEAD.length = 0; CHAIN.n = 0; CHAIN.t = -9;
  forge = null; promptShown = false; $('prompt').classList.remove('show');
  hideBeam();
  show('bossBar', false);
  $('hint').classList.remove('show');
  for (const k in fresh) fresh[k] = 1;
  clearGore();
  clearMenuCrowd();
  G.slow = { t: 0, scale: 1 };
  $('intro').classList.add('hidden');
  ui.rank = -1; ui.hp = -1;
  W.cur = 1; switchWeapon(0);
  normalizeLoadout();
  keys.clear();
  $('wave').textContent = 'GET READY';
}
// Fullscreen + Keyboard Lock lets the game receive Ctrl+W / Ctrl+T etc. instead of Chrome.
function lockKeyboard() {
  if (!settings.fullscreen) return;
  try {
    const go = () => { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().catch(() => {}); };
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(go).catch(() => {});
    } else go();
  } catch (_) {}
}
function unlockKeyboard() {
  try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch (_) {}
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
// last line of defence: ask before the tab closes mid-run
addEventListener('beforeunload', (e) => {
  const inRun = G.state === 'play' || G.state === 'pause' || G.state === 'shop' || (G.state === 'settings' && settingsFrom === 'pause');
  if (inRun) { e.preventDefault(); e.returnValue = ''; }
});
function requestLock() {
  if (G.input === 'pad') return;
  lockKeyboard();
  if (G.input === 'touch') return;
  try {
    const r = renderer.domElement.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch (_) {}
}
function show(id, on) { $(id).classList.toggle('hidden', !on); }

function loadBest() {
  try { return JSON.parse(localStorage.getItem('rubblemaker-best') || 'null'); } catch (_) { return null; }
}
function saveBest(b) {
  try { localStorage.setItem('rubblemaker-best', JSON.stringify(b)); } catch (_) {}
}
function renderBest() {
  const b = loadBest();
  $('best').textContent = b ? `RUBBLE PIT BEST: ${b.score.toLocaleString()} · WAVE ${b.wave} · ${RANKS[b.rank].l}` : '';
}
renderBest();

function gameOver() {
  if (G.state !== 'play') return;
  G.state = 'over';
  if (statsLive()) { STATS.deaths++; if (G.mode === 'endless' && G.wave > STATS.pitBestWave) STATS.pitBestWave = G.wave; saveStats(); }
  document.exitPointerLock?.();
  hideBeam();
  if (G.mode === 'endless') {
    const score = Math.floor(G.score);
    const best = loadBest();
    const isBest = !best || score > best.score;
    if (isBest && !cheatsOn()) saveBest({ score, wave: G.wave, rank: G.bestRank });
    const place = cheatsOn() ? -1 : addPitScore({ score, wave: G.wave, rank: G.bestRank, kills: G.kills, date: Date.now() });
    $('overStats').innerHTML = `RUBBLE PIT<br>SCORE ${score.toLocaleString()}${isBest ? ' — NEW BEST!' : ''}<br>WAVE ${G.wave} · ${G.kills} KILLS<br>HIGHEST STYLE: ${RANKS[G.bestRank].l}` + pitTableHTML(place, 5);
    const earned = Math.floor(score / 40);
    if (earned) { awardScrap(earned); if (statsLive()) STATS.scrapEarned += earned; $('overStats').innerHTML += `<br><span class="scrap">+${earned} ◆ SCRAP</span>`; }
    $('againBtn').textContent = 'TRY AGAIN';
  } else {
    G.deaths++;
    $('overStats').innerHTML = `${G.level.id} · ${G.level.name}<br>DEATHS: ${G.deaths} <span style="opacity:.6">(each one costs a rank)</span><br>${fmtTime(G.levelTime)} · ${G.kills} KILLS`;
    $('againBtn').textContent = 'RESPAWN AT CHECKPOINT';
  }
  show('restartBtn', G.mode === 'campaign');
  show('hud', false);
  setTimeout(() => show('over', true), 600);
  sfx.explode();
}

$('resumeBtn').addEventListener('click', () => {
  G.state = 'play';
  show('pause', false);
  last = performance.now();
  requestLock();
});

document.addEventListener('pointerlockchange', () => {
  if (!locked() && G.state === 'play') { G.state = 'pause'; show('pause', true); }
});
document.addEventListener('pointerlockerror', () => {
  if (G.state === 'play' && G.input === 'kbm') { G.state = 'pause'; show('pause', true); }
});

// ---------------------------------------------------------------- settings
let settingsFrom = 'menu';
const settingsUI = initSettingsUI($('settings'), applySetting, () => closeSettings());
function openSettings(from) {
  settingsFrom = from;
  G.state = 'settings';
  show(from, false);
  show('settings', true);
  settingsUI.render();
}
function closeSettings() {
  if (G.state !== 'settings') return;
  show('settings', false);
  G.state = settingsFrom;
  show(settingsFrom, true);
  renderControls();
}
$('menuSettingsBtn').addEventListener('click', () => openSettings('menu'));
$('pauseSettingsBtn').addEventListener('click', () => openSettings('pause'));
$('quitBtn').addEventListener('click', () => toMenu());

function applyQuality() {
  const q = settings.quality;
  renderer.setPixelRatio(q === 'low' ? 0.6 : q === 'medium' ? 1 : Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  const shadows = q !== 'low';
  if (renderer.shadowMap.enabled !== shadows) {
    renderer.shadowMap.enabled = shadows;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
  }
  const size = q === 'high' ? 2048 : 1024;
  if (moon.shadow.mapSize.x !== size) {
    moon.shadow.mapSize.set(size, size);
    if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; }
  }
  embers.visible = q !== 'low';
}
function applyCrosshair() {
  const c = $('crosshair');
  c.className = settings.crosshair;
  c.style.setProperty('--ch', settings.crossColor);
  c.style.setProperty('--chs', settings.crossSize);
}
function applySetting(k) {
  if (k === 'fov') { camera.fov = settings.fov; camera.updateProjectionMatrix(); }
  if (k === 'quality') { applyQuality(); resizeFX(); AQ.reset = true; }
  if (k === 'master' || k === 'sfx') { initAudio(); applyVolume(); sfx.hit(); }
  if (k.startsWith('cross')) applyCrosshair();
  if (k === 'showFPS') show('fps', settings.showFPS);
  if (k === 'binds') renderControls();
  if (k === 'fullscreen' && !settings.fullscreen) unlockKeyboard();
}
let fpsFrames = 0, fpsLast = performance.now();
function updateFPS(now) {
  if (!settings.showFPS) return;
  fpsFrames++;
  if (now - fpsLast >= 500) {
    $('fps').textContent = Math.round((fpsFrames * 1000) / (now - fpsLast)) + ' FPS';
    fpsFrames = 0; fpsLast = now;
  }
}
function renderControls() {
  if (G.input === 'pad') {
    const p = (id) => padLabel(settings.padBinds[id]);
    $('controlsList').innerHTML = [['L-STICK', 'move'], ['R-STICK', 'aim'], [p('fire'), 'fire'], [p('alt'), 'alt fire'], [`${p('weapon1')} ${p('weapon2')} ${p('weapon3')} / ${p('swap')}`, 'weapons'], [p('punch'), 'punch / parry'],
      [p('jump'), 'jump / wall jump'], [p('dash'), 'dash'], [p('slide'), 'slide · in air: slam'], ['MENU', 'pause']].map(([a, b]) => `<div><b>${a}</b> ${b}</div>`).join('');
    return;
  }
  const k = (id) => settings.binds[id].filter(Boolean).map(keyLabel).join(' / ') || '—';
  const rows = [
    [`${k('forward')} ${k('left')} ${k('back')} ${k('right')}`, 'move'], ['MOUSE', 'aim'],
    [k('fire'), 'fire'], [k('alt'), 'alt fire'],
    [`${k('weapon1')} / ${k('weapon2')} / ${k('swap')}`, 'weapons'], [k('punch'), 'punch / parry'],
    [k('jump'), 'jump / wall jump'], [k('dash'), 'dash'],
    [k('slide'), 'slide · in air: slam'], ['ESC', 'pause'],
  ];
  $('controlsList').innerHTML = rows.map(([a, b]) => `<div><b>${a}</b> ${b}</div>`).join('');
}
camera.fov = settings.fov; camera.updateProjectionMatrix();
applyQuality();
applyCrosshair();
show('fps', settings.showFPS);
renderControls();

// ================================================================ ENEMY HELPERS
function enemyPhysics(e, mx, mz, dt) {
  const p = e.mesh.position;
  if (!e.grounded) { mx *= 0.15; mz *= 0.15; }
  e.vel.y -= 30 * dt;
  if (e.grounded) { const f = Math.exp(-dt * 7); e.vel.x *= f; e.vel.z *= f; }
  p.x += (mx + e.vel.x) * dt;
  p.z += (mz + e.vel.z) * dt;
  p.y += e.vel.y * dt;
  const fy = enemyFloor(e);
  if (p.y <= fy) { p.y = fy; if (e.vel.y < 0) e.vel.y = 0; e.grounded = true; }
  else e.grounded = p.y - fy < 0.05;
  enemyCollide(e);
  if (p.y < -20) { p.copy(e.home); e.vel.set(0, 0, 0); }
}
function applyFlash(e, w) {
  for (const mt of e.mats) {
    if (e.flash > 0) { mt.emissive.setRGB(1, 1, 1); mt.emissiveIntensity = 1.1; }
    else if (w > 0) { mt.emissive.setRGB(1, 0.15, 0.05); mt.emissiveIntensity = w * (0.6 + 0.4 * Math.sin(G.time * 40)); }
    else { mt.emissive.setHex(mt.userData.baseEmissive); mt.emissiveIntensity = mt.userData.baseIntensity; }
  }
}
function spawnOrb(from, vel, dmg = 15, opts = {}) {
  const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: opts.color || 0xffb02a }));
  if (opts.big) m.scale.setScalar(1.5);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff9a2a, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(1.6);
  m.add(glow);
  m.position.copy(from);
  scene.add(m);
  orbs.push({ m, glow, vel, dmg, parried: false, life: 7, dodged: false, grav: opts.grav || 0, boom: opts.boom || 0 });
}
function segDist(p, a, b) {
  const ab = b.clone().sub(a);
  const t = clamp(p.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1);
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

// ---- GARGOYLE: circles overhead, screeches, then dives
function updateFlyer(e, dt) {
  const p = e.mesh.position, def = e.def;
  const eye = playerEye();
  const to = eye.clone().sub(p);
  const dist = to.length();
  e.cd -= dt; e.t -= dt;
  let w = 0;
  const fy = enemyFloor(e);
  if (e.state === 'chase') {
    e.orbit += dt * 0.8 * e.strafe;
    const R = 9;
    const tx = P.pos.x + Math.cos(e.orbit) * R, tz = P.pos.z + Math.sin(e.orbit) * R;
    const ty = Math.min(G.ceil, Math.max(fy, P.pos.y) + e.alt);
    const dir = new V3(tx - p.x, ty - p.y, tz - p.z);
    const dl = dir.length();
    if (dl > 0.01) dir.multiplyScalar((Math.min(1, dl / 3) * def.speed * DIFF().speed) / dl);
    e.mv.lerp(dir, 1 - Math.exp(-dt * 3));
    if (e.cd <= 0 && dist < 32 && lineOfSight(p.clone().setY(p.y + 0.5), eye)) { e.state = 'windup'; e.t = 0.55; sfxAt(p, 'screech', distVol(p)); }
  } else if (e.state === 'windup') {
    w = 1 - e.t / 0.55;
    e.mv.multiplyScalar(Math.exp(-dt * 6));
    if (e.t <= 0) { e.state = 'dive'; e.t = 1.1; e.diveDir = eye.clone().sub(p).normalize(); e.hitDone = false; }
  } else if (e.state === 'dive') {
    e.mv.copy(e.diveDir).multiplyScalar(24 * DIFF().speed);
    if (!e.hitDone) {
      const py = clamp(p.y + 0.5, P.pos.y + 0.2, P.pos.y + P.camH);
      if (Math.hypot(p.x - P.pos.x, p.y + 0.5 - py, p.z - P.pos.z) < 1.15) {
        e.hitDone = true;
        if (P.dashT > 0 || P.invuln > 0) addStyle(40, 'DODGE', null, 'cool');
        else hurtPlayer(12, e.diveDir.clone().multiplyScalar(6));
        e.state = 'recover'; e.t = 0.9;
      }
    }
    if (e.state === 'dive' && (e.t <= 0 || p.y <= fy + 0.35)) { e.state = 'recover'; e.t = 0.9; }
  } else {
    e.mv.set(e.mv.x * 0.95, 7, e.mv.z * 0.95);
    if (e.t <= 0) { e.state = 'chase'; e.cd = rand(2, 3.5) * DIFF().fire; }
  }
  e.vel.multiplyScalar(Math.exp(-dt * 3));
  p.addScaledVector(e.mv, dt).addScaledVector(e.vel, dt);
  if (p.y < fy + 0.3) p.y = fy + 0.3;
  if (p.y > G.ceil) p.y = G.ceil;
  enemyCollide(e);
  e.grounded = false;
  const face = e.state === 'dive' ? e.diveDir : to;
  e.mesh.rotation.y = Math.atan2(face.x, face.z);
  e.walk += dt;
  animateEnemy(e, dt, true, w, G.time);
  applyFlash(e, w);
}

// ================================================================ BOSSES
const shocks = [];
const shockGeo = new THREE.CylinderGeometry(1, 1, 0.9, 48, 1, true);
function shockwave(pos, speed, max, dmg, tall = false) {
  const m = new THREE.Mesh(shockGeo, new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.set(pos.x, pos.y + (tall ? 2.25 : 0.45), pos.z);
  if (tall) m.material.color.setHex(0xff3a6a);
  scene.add(m);
  shocks.push({ m, x: pos.x, z: pos.z, y: pos.y, r: 1, speed, max, dmg, hit: false, tall });
}
function updateShockwaves(dt) {
  for (let i = shocks.length - 1; i >= 0; i--) {
    const s = shocks[i];
    s.r += s.speed * dt;
    s.m.scale.set(s.r, s.tall ? 5 : 1, s.r);
    s.m.material.opacity = 0.85 * (1 - s.r / s.max);
    if (!s.hit) {
      const d = Math.hypot(P.pos.x - s.x, P.pos.z - s.z);
      if (Math.abs(d - s.r) < 0.8 && P.pos.y - s.y < (s.tall ? 4.5 : 0.8)) {
        s.hit = true;
        const away = new V3(P.pos.x - s.x, 0, P.pos.z - s.z).normalize();
        if (P.dashT > 0 || P.invuln > 0) addStyle(40, 'DODGE', null, 'cool');
        else hurtPlayer(s.dmg, away.multiplyScalar(8).setY(7));
      } else if (d < s.r - 0.8 && !s.cleared) {
        s.cleared = true;
        if (d < s.r && !s.hit && d > 2) addStyle(30, 'HURDLE', null, 'cool');
      }
    }
    if (s.r >= s.max) { scene.remove(s.m); s.m.material.dispose(); shocks.splice(i, 1); }
  }
}
function summonMinions(e, type, n) {
  const room = e.room;
  for (let i = 0; i < n; i++) {
    const pts = room ? room.spawns : SPAWNS;
    const [x, z] = pts[(Math.random() * pts.length) | 0];
    makeEnemy(type, x, z, type === 'flyer' ? rand(4, 6) : 0);
  }
}
function bossCommon(e) {
  if (!e.enraged && e.hp < e.def.hp * 0.5) {
    e.enraged = true;
    banner(`${e.def.short} IS ENRAGED`);
    sfx.bossRoar();
    G.shake = Math.max(G.shake, 0.6);
    e.summonT = 1.5;
  }
  return e.enraged ? 1.35 : 1;
}

// ---- MORTIMER: stomps shockwaves, sprays orbs, charges (and stuns itself on walls)
function updateBoss1(e, dt) {
  const p = e.mesh.position, def = e.def;
  const spd = bossCommon(e);
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0;
  if (e.state !== 'charge' && e.state !== 'stun') e.mesh.rotation.y = Math.atan2(dx, dz);
  if (e.state === 'chase') {
    mx = nx * def.speed * spd; mz = nz * def.speed * spd;
    if (e.cd <= 0) {
      const r = Math.random();
      e.atk = dist < 11 && r < 0.5 ? 'stomp' : r < 0.75 ? 'barrage' : 'charge';
      e.wt = { stomp: 0.9, barrage: 0.75, charge: 0.7 }[e.atk] / spd;
      e.state = 'windup'; e.t = e.wt;
      sfx.windup(1);
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      if (e.atk === 'stomp') {
        const c = p.clone();
        shockwave(c, 15 * spd, 38, 25);
        if (e.enraged) setTimeout(() => G.boss === e && shockwave(c, 11, 38, 25), 450);
        ringFx(c, 7, 0xff6a2a);
        burst(c.clone().setY(0.3), 30, 0x8a7a6a, 12, 0.35, 1);
        sfx.heavySlam(1);
        G.shake = Math.max(G.shake, 0.8);
        if (dist < 7 && P.pos.y - p.y < 2) hurtPlayer(35, new V3(nx * 14, 10, nz * 14));
        e.state = 'recover'; e.t = 1.0 / spd;
      } else if (e.atk === 'barrage') {
        const from = new V3();
        e.rig.head.getWorldPosition(from);
        const n = e.enraged ? 9 : 5;
        const eye = playerEye();
        const base = Math.atan2(eye.x - from.x, eye.z - from.z);
        const dy = (eye.y - 0.4 - from.y) / Math.max(1, dist);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.16;
          const v = new V3(Math.sin(a), dy, Math.cos(a)).normalize().multiplyScalar(17);
          spawnOrb(from.clone().addScaledVector(v, 0.15), v, 15);
        }
        sfx.orb(1);
        e.state = 'recover'; e.t = 0.7 / spd;
      } else {
        e.chargeDir = new V3(nx, 0, nz);
        e.state = 'charge'; e.t = 1.3; e.hitDone = false;
        sfx.bossRoar();
      }
    }
  } else if (e.state === 'charge') {
    e.mesh.rotation.y = Math.atan2(e.chargeDir.x, e.chargeDir.z);
    mx = e.chargeDir.x * 21 * spd; mz = e.chargeDir.z * 21 * spd;
    if (!e.hitDone && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < def.r + 0.9 && P.pos.y - p.y < 3) {
      e.hitDone = true;
      hurtPlayer(30, e.chargeDir.clone().multiplyScalar(16).setY(9));
    }
    if (Math.random() < 0.5) burst(p.clone().setY(0.2), 2, 0x8a7a6a, 4, 0.2, 0.5);
  } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(1.0, 2.0) / spd; }

  if (e.enraged) { e.summonT -= dt; if (e.summonT <= 0) { e.summonT = 13; summonMinions(e, 'grunt', 2); } }

  const bx = p.x, bz = p.z;
  enemyPhysics(e, mx, mz, dt);
  if (e.state === 'charge') {
    const moved = Math.hypot(p.x - bx, p.z - bz);
    if (e.t > 0 && dt > 0 && moved < Math.hypot(mx, mz) * dt * 0.3) {
      G.shake = Math.max(G.shake, 0.6);
      sfx.heavySlam(1);
      burst(p.clone().setY(3), 20, 0x8a7a6a, 10, 0.3, 0.9);
      banner('STUNNED');
      e.state = 'stun'; e.t = 1.8;
    } else if (e.t <= 0) { e.state = 'recover'; e.t = 0.5; }
  }
  const moving = Math.hypot(mx, mz) > 0.5;
  if (moving) e.walk += dt * (e.state === 'charge' ? 10 : 3.5);
  const real = e.state;
  if (real === 'stun') e.state = 'recover';
  animateEnemy(e, dt, moving, w, G.time);
  e.state = real;
  applyFlash(e, real === 'stun' ? 0 : w);
}

// ---- THE HIGH MASON: floats, fires orb rings, sweeps a beam, slams down, summons gargoyles
const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
const bossBeam = new THREE.Mesh(beamGeo, beamMat);
bossBeam.visible = false;
scene.add(bossBeam);
function hideBeam() { bossBeam.visible = false; }
function orbPos(e) { const v = new V3(); e.orb.getWorldPosition(v); return v; }
function showBeam(e, tele) {
  const o = orbPos(e);
  ray.set(o, e.beamDir); ray.far = 140;
  const h = ray.intersectObjects(worldMeshes, false)[0];
  const end = h ? h.point : o.clone().addScaledVector(e.beamDir, 140);
  const len = o.distanceTo(end);
  bossBeam.visible = true;
  bossBeam.position.copy(o).add(end).multiplyScalar(0.5);
  bossBeam.quaternion.setFromUnitVectors(UP, e.beamDir);
  const wdt = tele ? 0.03 + 0.03 * Math.sin(G.time * 40) : 0.4 + Math.sin(G.time * 50) * 0.08;
  bossBeam.scale.set(wdt, len, wdt);
  beamMat.color.setHex(tele ? 0xff4030 : 0xffe0b0);
  if (!tele && h && Math.random() < 0.5) burst(h.point, 2, 0xffc070, 5, 0.1, 0.3, true, 0.3);
  return { o, end };
}
function ringBurst(e, off) {
  const c = e.mesh.position;
  const y = playerEye().y - 0.3;
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    const v = new V3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(13);
    spawnOrb(new V3(c.x + Math.sin(a) * 2, y, c.z + Math.cos(a) * 2), v, 15);
  }
  sfx.orb(1);
}
function updateBoss2(e, dt) {
  const p = e.mesh.position, def = e.def;
  const spd = bossCommon(e);
  const eye = playerEye();
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  e.cd -= dt; e.t -= dt;
  let w = 0, mx = 0, mz = 0;
  let targetY = 2.2 + Math.sin(G.time * 1.3) * 0.5;
  e.mesh.rotation.y = Math.atan2(dx, dz);
  if (e.state === 'chase') {
    e.landed = false;
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rand(2, 4); }
    const want = dist > 18 ? 1 : dist < 11 ? -1 : 0;
    mx = (nx * want - nz * e.strafe * 0.8) * def.speed * spd;
    mz = (nz * want + nx * e.strafe * 0.8) * def.speed * spd;
    if (e.cd <= 0) {
      const opts = ['ring', 'beam', 'slam', 'ring', 'beam'];
      if (e.enraged || Math.random() < 0.35) opts.push('summon');
      e.atk = opts[(Math.random() * opts.length) | 0];
      e.wt = { ring: 0.8, beam: 1.1, slam: 0.6, summon: 0.8 }[e.atk] / spd;
      e.state = 'windup'; e.t = e.wt;
      sfx.windup(1);
      if (e.atk === 'beam') { e.beamDir = eye.clone().sub(orbPos(e)).normalize(); e.beamDodged = false; }
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    e.orb.scale.setScalar(0.08 + w * 0.3);
    if (e.atk === 'beam') {
      e.beamDir.lerp(eye.clone().sub(orbPos(e)).normalize(), Math.min(1, dt * 4)).normalize();
      showBeam(e, true);
    }
    if (e.t <= 0) {
      e.orb.scale.setScalar(0.08);
      if (e.atk === 'ring') { ringBurst(e, 0); if (e.enraged) e.pendingRing = 0.45; e.state = 'recover'; e.t = 0.8 / spd; }
      else if (e.atk === 'beam') { e.state = 'beam'; e.t = e.enraged ? 2.2 : 1.6; e.beamTick = 0; sfx.charged(); }
      else if (e.atk === 'summon') { summonMinions(e, 'flyer', e.enraged ? 4 : 3); e.state = 'recover'; e.t = 0.6; }
      else { e.state = 'rise'; e.t = 1.1; sfx.slamStart(); }
    }
  } else if (e.state === 'beam') {
    const want = eye.clone().sub(orbPos(e)).normalize();
    e.beamDir.lerp(want, Math.min(1, dt * (e.enraged ? 1.6 : 1.1))).normalize();
    const { o, end } = showBeam(e, false);
    e.beamTick -= dt;
    const body = new V3(P.pos.x, P.pos.y + 1, P.pos.z);
    if (segDist(body, o, end) < 1.0 && e.beamTick <= 0) {
      if (P.dashT > 0 || P.invuln > 0) { if (!e.beamDodged) { e.beamDodged = true; addStyle(40, 'DODGE', null, 'cool'); } }
      else if (hurtPlayer(14, null)) e.beamTick = 0.3;
    }
    if (e.t <= 0) { hideBeam(); e.state = 'recover'; e.t = 0.8; }
  } else if (e.state === 'rise') {
    targetY = 10;
    const sp = Math.min(16, dist * 2.5);
    mx = nx * sp; mz = nz * sp;
    if (e.t <= 0) { e.state = 'drop'; e.t = 3; }
  } else if (e.state === 'drop') {
    p.y -= 36 * dt;
    if (p.y <= 0.05) {
      p.y = 0;
      const c = p.clone();
      shockwave(c, 16 * spd, 36, 25);
      ringFx(c, 8, 0xffd04a);
      burst(c.clone().setY(0.3), 34, 0x8a7a6a, 13, 0.35, 1);
      sfx.heavySlam(1); sfx.explode();
      G.shake = Math.max(G.shake, 0.9);
      if (dist < 7) hurtPlayer(35, new V3(nx * 14, 10, nz * 14));
      e.state = 'recover'; e.t = 1.5; e.landed = true;
    }
  } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(1.0, 1.8) / spd; }
  if (e.pendingRing > 0) { e.pendingRing -= dt; if (e.pendingRing <= 0) ringBurst(e, Math.PI / 16); }
  if (e.enraged) { e.summonT -= dt; if (e.summonT <= 0) { e.summonT = 16; summonMinions(e, 'flyer', 2); } }

  if (e.state !== 'drop') {
    if (e.landed) targetY = 0;
    p.y += (targetY - p.y) * (1 - Math.exp(-dt * (e.state === 'rise' ? 3 : 2)));
  }
  e.vel.multiplyScalar(Math.exp(-dt * 4));
  p.x += (mx + e.vel.x) * dt;
  p.z += (mz + e.vel.z) * dt;
  enemyCollide(e);
  e.grounded = p.y < 0.4;
  const real = e.state;
  if (real !== 'windup') e.state = 'chase';
  animateEnemy(e, dt, false, w, G.time);
  e.state = real;
  e.rig.extraHalos.forEach((h, i) => (h.rotation.z += dt * (i ? -1.4 : 1.1)));
  e.rig.bricks.rotation.y += dt * (e.enraged ? 2 : 0.8);
  applyFlash(e, w);
}

function spawnBoss(room) {
  if (bossCutscene(room)) return;
  const type = room.boss;
  if (type === 'twins') { spawnTwins(room); return; }
  const def = DEFS[type];
  const e = makeEnemy(type, room.cx, room.cz, def.fly ? (def.trainer ? 5 : 2.2) : 0);
  e.room = room;
  G.boss = e;
  if (G.mode === 'campaign' && G.level && G.level.prime) makePrime(e);
  $('bossName').textContent = e.prime ? def.short + ' PRIME' : def.name;
  show('bossBar', true);
  showIntro(type);
  if (e.prime) { const el = $('intro'); el.querySelector('.name').textContent = def.short + ' PRIME'; el.querySelector('.kind').textContent = 'PRIME REMATCH'; el.querySelector('.epi').textContent = 'REBUILT · RELENTLESS · FURIOUS'; }
  setTimeout(() => { if (def.hint && G.boss === e) showHint(def.hint); }, 2400);
  sfx.bossRoar();
  G.shake = Math.max(G.shake, 0.6);
}
function updateBossBar() {
  if (!G.boss) return;
  const b = G.boss, sib = b.def.twin && b.sib && !b.sib.dead ? b.sib : null;
  const frac = b.def.twin ? (b.hp + (sib ? sib.hp : 0)) / (b.maxHp * 2) : b.hp / b.maxHp;
  $('bossFill').style.width = `${clamp(frac, 0, 1) * 100}%`;
}
function bossDefeated(e) {
  if (e.def.twin && e.sib && !e.sib.dead) { twinDown(e); return; }
  duelReward(e);
  killCam(1.8, 0.12);
  fxShift(0.03);
  G.boss = null;
  hideBeam();
  show('bossBar', false);
  G.hitstop = 0.5;
  G.shake = 1;
  const c = e.mesh.position.clone(); c.y += e.def.h * 0.4;
  for (let i = 0; i < 6; i++) setTimeout(() => {
    if (G.state !== 'play') return;
    const q = c.clone().add(new V3(rand(-3, 3), rand(-2, 3), rand(-3, 3)));
    blastFx(q, 4, i % 2 ? 0xffd04a : 0xff7a2a);
    burst(q, 20, e.def.color, 12, 0.4, 1.4);
    sfx.explode();
  }, i * 160);
  banner(`${e.def.short}${e.prime ? ' PRIME' : ''} DESTROYED`);
}

// ================================================================ CAMPAIGN
const levelCtx = {
  THREE, box, torch, candle, makeWindow,
  hazard: (...a) => hazard(...a), secretWall: (...a) => secretWall(...a), furnace: (...a) => furnace(...a),
  decor: (o) => levelGroup.add(o),
  blocked: (x, z) => !!overlapBox(x - 0.9, 0.1, z - 0.9, x + 0.9, 2.2, z + 0.9),
  mats: { hidden: new THREE.MeshBasicMaterial({ visible: false }), brick: brickMat, cobble: cobbleMat, floor: floorMat, wood: woodMat, iron: ironMat, ironDark, water: waterMat, doorGlow: doorGlowMat },
};
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
const GRADES = ['D', 'C', 'B', 'A', 'S', 'RUBBLEMAKER', 'P'];
const GRADE_SHORT = ['D', 'C', 'B', 'A', 'S', 'R', 'P'];

function insideRoom(r, inset) {
  return P.pos.x > r.x0 + inset && P.pos.x < r.x1 - inset && P.pos.z > r.z0 + inset && P.pos.z < r.z1 - inset;
}
let hintT = 0;
function showHint(text) {
  const h = $('hint');
  h.textContent = text;
  h.classList.add('show');
  clearTimeout(hintT);
  hintT = setTimeout(() => h.classList.remove('show'), 5500);
}
function startRoom(r) {
  r.state = 'active';
  r.wave = 0;
  r.queue = r.waves[0] ? r.waves[0].slice() : [];
  r.spawnT = 0.5;
  r.bossT = r.boss ? 1.6 : 0;
  for (const d of r.doorObjs) d.target = 0;
  sfx.door();
}
function clearRoom(r) {
  r.state = 'clear';
  G.checkpoint = { x: r.cx, z: r.cz, yaw: P.yaw };
  for (const d of r.doorObjs) d.target = 1;
  sfx.door();
  if (r.boss && !G.layout.rooms.some((x) => x.kind === 'exit')) {
    spawnPortal(r.cx, r.cz);
  } else {
    addStyle(120, 'ROOM CLEAR', null, 'big');
    killCam(0.8, 0.22);
    heal(20);
    pushFeed('+20 HP', 'heal');
    banner('ROOM CLEAR');
  }
}
function spawnInRoom(r, type) {
  const far = r.spawns.filter(([x, z]) => Math.hypot(x - P.pos.x, z - P.pos.z) > 7);
  const pts = far.length ? far : r.spawns;
  const [x, z] = pts[(Math.random() * pts.length) | 0];
  makeEnemy(type, x + rand(-0.8, 0.8), z + rand(-0.8, 0.8), type === 'flyer' ? rand(4, 5.5) : 0);
}
let hudTimerT = 0;
function updateCampaign(dt) {
  const L = G.layout;
  if (!L) return;
  G.levelTime += dt;
  vsTick(dt);
  updateRunes(dt);
  ghostTick(dt);
  hudTimerT -= dt;
  if (hudTimerT <= 0) { hudTimerT = 0.2; $('wave').textContent = `${G.level.id} · ${fmtTime(G.levelTime)}`; }
  for (const r of L.rooms) {
    if (!r.visited && insideRoom(r, 0.5)) { r.visited = true; if (r.hint) showHint(r.hint); }
    if (r.state === 'idle' && insideRoom(r, 1.8)) startRoom(r);
    if (r.state !== 'active') continue;
    if (r.bossT > 0) { r.bossT -= dt; if (r.bossT <= 0) spawnBoss(r); continue; }
    r.spawnT -= dt;
    if (r.queue.length && r.spawnT <= 0) { spawnInRoom(r, r.queue.pop()); r.spawnT = 0.25; }
    if (!r.queue.length && enemies.length === 0 && !G.boss) {
      if (r.wave < r.waves.length - 1) { r.wave++; r.queue = r.waves[r.wave].slice(); r.spawnT = 0.7; }
      else clearRoom(r);
    }
  }
  if (G.portal) {
    const pt = G.portal;
    pt.ring.rotation.z += dt * 1.5;
    pt.ring2.rotation.z -= dt * 2.2;
    pt.stones.rotation.z += dt * 0.3;
    pt.disc.material.opacity = 0.35 + Math.sin(G.time * 4) * 0.12;
    pt.g.rotation.y = Math.atan2(P.pos.x - pt.x, P.pos.z - pt.z);
    if (Math.hypot(P.pos.x - pt.x, P.pos.z - pt.z) < 1.9 && P.pos.y < 4) completeLevel();
  }
}
function updateDoors(dt) {
  if (!G.layout) return;
  for (const d of G.layout.doors) {
    if (d.t !== d.target) d.t += Math.sign(d.target - d.t) * Math.min(Math.abs(d.target - d.t), dt * 2.2);
    d.mesh.position.y = d.baseY - (d.h + 0.3) * d.t;
    d.solid.active = d.t < 0.6;
    d.strip.material.color.setHex(d.target ? 0x3aff6a : 0xff3a1a);
  }
}
function spawnPortal(x, z) {
  const { g, ring, ring2, disc, stones } = buildPortal(GLOW);
  g.position.set(x, 2.1, z);
  levelGroup.add(g);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.3, 8), ironMat);
  base.position.set(x, 0.15, z);
  levelGroup.add(base);
  G.portal = { g, ring, ring2, disc, stones, x, z };
  if (G.state === 'play') { sfx.portal(); showHint('The way out is open — step into the portal'); }
}

function loadProgress() {
  try { return Object.assign({ unlocked: 0, best: {} }, JSON.parse(localStorage.getItem('rubblemaker-progress') || '{}')); } catch (_) { return { unlocked: 0, best: {} }; }
}
function saveProgress(p) { PROGC = p; try { localStorage.setItem('rubblemaker-progress', JSON.stringify(p)); } catch (_) {} }

function completeLevel() {
  if (G.state !== 'play') return;
  if (VS.active) { vsFinish(); return; }
  G.state = 'complete';
  document.exitPointerLock?.();
  show('hud', false);
  hideBeam();
  sfx.portal();
  const lv = G.level, t = G.levelTime;
  const gTime = t <= lv.par ? 4 : t <= lv.par * 1.3 ? 3 : t <= lv.par * 1.7 ? 2 : t <= lv.par * 2.3 ? 1 : 0;
  const sr = G.styleTotal / G.styleTarget;
  const gStyle = sr >= 1 ? 4 : sr >= 0.75 ? 3 : sr >= 0.5 ? 2 : sr >= 0.3 ? 1 : 0;
  const dmg = Math.round(G.dmgTaken);
  const dn = dmg / (DIFF().dmg || 1);
  const gDmg = dn <= 40 ? 4 : dn <= 120 ? 3 : dn <= 250 ? 2 : dn <= 450 ? 1 : 0;
  const perfect = gTime === 4 && gStyle === 4 && gDmg === 4;
  const pRank = !G.deaths && gTime === 4 && gStyle === 4 && G.bestRank >= RANKS.length - 1;
  const overall = pRank ? 6 : Math.max(0, (perfect && !G.deaths ? 5 : Math.min(4, Math.round((gTime + gStyle + gDmg) / 3))) - G.deaths);
  const prog = loadProgress();
  if (!lv.duel) prog.unlocked = Math.max(prog.unlocked, G.levelIdx + 1);
  const bk = bestKey(lv);
  const best = prog.best[bk];
  const newBest = !best || overall > best.rank || (overall === best.rank && t < best.time);
  if (newBest && !cheatsOn()) prog.best[bk] = { rank: overall, time: t };
  ghostSave(t);
  const earned = Math.round((100 + Math.floor(G.styleTotal / 10) + [0, 25, 50, 100, 150, 300, 500][overall]) * (DIFF().scrap || 1));
  prog.scrap = (prog.scrap || 0) + earned;
  saveProgress(prog);
  statLevelDone(overall, t, earned);
  const g = (i) => `<span class="g g${GRADE_SHORT[i]}">${GRADE_SHORT[i]}</span>`;
  $('completeLevel').textContent = `${lv.scene.name} · ${lv.id} · ${lv.name}`;
  $('completeStats').innerHTML =
    `<span>TIME</span><span>${fmtTime(t)} <small style="opacity:.5">/ ${fmtTime(lv.par)}</small></span>${g(gTime)}` +
    `<span>STYLE</span><span>${Math.floor(G.styleTotal).toLocaleString()}</span>${g(gStyle)}` +
    `<span>DAMAGE TAKEN</span><span>${dmg}</span>${g(gDmg)}` +
    `<span>KILLS</span><span>${G.kills}</span><span></span>` +
    `<span>DEATHS</span><span>${G.deaths}${G.deaths ? ' <small style="opacity:.6">(-' + G.deaths + ' rank)</small>' : ''}</span><span></span>` +
    `<span>SCRAP EARNED</span><span class="scrap">+${earned} ◆</span><span></span>` +
    (pRank ? `<span class="pLine">PERFECT RUN</span><span>no deaths · under par · style met · RUBBLEMAKER reached</span><span class="g gP">P</span>` : '');
  const rk = $('completeRank');
  rk.textContent = GRADES[overall] + (newBest ? '' : '');
  rk.className = `g${GRADE_SHORT[overall]}${overall >= 5 ? ' top' : ''}`;
  const hasNext = !lv.duel && G.levelIdx + 1 < LEVELS.length && !LEVELS[G.levelIdx + 1].duel;
  show('nextBtn', hasNext);
  if (hasNext) $('nextBtn').textContent = `NEXT: ${LEVELS[G.levelIdx + 1].id} ${LEVELS[G.levelIdx + 1].name}`;
  const fin = () => setTimeout(() => { show('complete', true); sfx.rankUp(); }, 300);
  if (lv.id === '2-12' && !cutsSeen().ending) playEnding(fin); else fin();
}

function openLevels() {
  initAudio();
  G.state = 'levels';
  show('menu', false); show('complete', false); show('over', false);
  renderLevels();
  show('levels', true);
}
function enterPlay() {
  G.state = 'play';
  for (const id of ['menu', 'over', 'pause', 'levels', 'complete', 'settings']) show(id, false);
  show('hud', true);
  last = performance.now();
  requestLock();
}
function startLevel(idx) {
  initAudio();
  const lv = LEVELS[idx];
  if (!lv) return;
  G.mode = 'campaign'; G.levelIdx = idx; G.level = lv;
  resetGame();
  clearLevelGeometry();
  setLook(lv.theme);
  const layout = buildLevel(lv, levelCtx);
  G.layout = layout;
  G.ceil = layout.theme.wallH - 0.8;
  for (const r of layout.rooms) if (r.kind === 'exit') spawnPortal(r.cx, r.cz);
  placeForgeInStart(layout);
  P.pos.set(layout.start.x, 0, layout.start.z);
  P.yaw = layout.start.yaw;
  G.spawn = P.pos.clone();
  G.deaths = 0;
  G.checkpoint = { x: P.pos.x, z: P.pos.z, yaw: P.yaw };
  ghostStart(lv);
  G.styleTarget = Math.max(500, layout.rooms.reduce((s, r) => s + r.waves.reduce((a, w) => a + w.length, 0) * 80 + (r.boss ? 1200 : 0), 0));
  $('wave').textContent = lv.id;
  const go = () => { enterPlay(); banner(`${lv.id} ${lv.name}`); };
  if (!maybeStory(lv, go)) go();
}
function startEndless() {
  initAudio();
  G.mode = 'endless'; G.level = null; G.layout = null;
  resetGame();
  clearLevelGeometry();
  buildArena();
  placeForge(0, 19.5, Math.PI);
  setLook('pit');
  G.ceil = 11;
  G.spawn = new V3(0, 0, 12);
  enterPlay();
}
function toMenu() {
  if (VS && VS.active) {
    if (!VS.myDone) vsSend({ t: 'quit' });
    show('vsSpec', false);
    VS.active = false; VS.result = null; VS.fx = {}; G.lowgrav = false;
    show('vsHud', false); show('vsCount', false); show('vsResult', false); $('vsCurseFx').className = 'hidden';
    if (VS.rival.mesh) { scene.remove(VS.rival.mesh); VS.rival.mesh = null; }
    normalizeLoadout();
  }
  clearWorld();
  resetGame();
  G.layout = null; G.level = null; G.mode = 'endless';
  clearLevelGeometry();
  buildArena();
  placeForge(0, 19.5, Math.PI);
  setLook('pit');
  G.state = 'menu';
  for (const id of ['pause', 'hud', 'over', 'complete', 'levels', 'settings']) show(id, false);
  show('menu', true);
  renderBest();
  spawnMenuCrowd();
}
function menuish() {
  return G.state === 'menu' || G.state === 'levels' || G.state === 'records' || G.state === 'codex' || G.state === 'versus' || (G.state === 'settings' && settingsFrom === 'menu');
}

$('startBtn').addEventListener('click', openLevels);
$('pitBtn').addEventListener('click', startEndless);
$('levelsBack').addEventListener('click', () => { G.state = 'menu'; show('levels', false); show('menu', true); });
$('againBtn').addEventListener('click', () => (G.mode === 'endless' ? startEndless() : respawnCheckpoint()));
$('restartBtn').addEventListener('click', () => startLevel(G.levelIdx));
$('overMenuBtn').addEventListener('click', toMenu);
$('nextBtn').addEventListener('click', () => startLevel(G.levelIdx + 1));
$('retryBtn').addEventListener('click', () => startLevel(G.levelIdx));
$('completeMenuBtn').addEventListener('click', () => { toMenu(); openLevels(); });
addEventListener('pointerdown', () => initAudio(), { once: true });

// ================================================================ MUSIC
let music = null, musicBus = null;
function ensureMusic() {
  if (music || !AC) return;
  musicBus = AC.createGain();
  musicBus.connect(master);
  music = createMusic(AC, musicBus, noiseBuf);
  applyVolume();
  music.start();
}
function updateMusic() {
  if (!music) return;
  let theme = 'menu', int = 0, hz = 18000;
  const inGame = G.state === 'play' || G.state === 'pause' || G.state === 'shop' || (G.state === 'settings' && settingsFrom === 'pause');
  if (inGame) {
    theme = G.boss ? 'boss' : G.mode === 'endless' ? ({ pit: 'pit', cellar: 'cellar', nave: 'cathedral', kiln: 'kiln' }[pitKind] || 'pit') : G.level ? G.level.theme : 'cellar';
    const fighting = enemies.length > 0 || !!G.boss;
    // the style rank drives the mix: D/C = groove, B/A = chug, S..SSS = lead, RUBBLEMAKER = everything
    int = fighting ? [2, 2, 3, 3, 4, 4, 4, 5][ST.idx] || 2 : 1;
    if (G.boss) int = Math.max(3, int);
    hz = 6000 + ST.idx * 2000;
    if (G.state !== 'play') { int = Math.min(int, 1); hz = 1500; }
    else if (P.hp < 30) hz = 700 + P.hp * 50;
  } else if (G.state === 'complete') {
    theme = G.level ? G.level.theme : 'menu'; int = 1;
  } else if (G.state === 'cutscene') {
    const bossCut = CUT && /^boss/.test(CUT.id);
    theme = bossCut ? 'boss' : G.level ? G.level.theme : 'menu'; int = bossCut ? 1 : 0; hz = 9000;
  }
  music.setTheme(theme);
  music.setIntensity(int);
  if (Math.abs(hz - (music.hz || 0)) > 40) { music.hz = hz; music.setTone(hz); }
  music.update();
  tickAudio(theme);
}

// ================================================================ LOADOUT, SHOP & ECONOMY
const VARIANTS = [
  [{ name: 'LANCE', hex: 0x3ac8ff, css: '#6ad8ff' }, { name: 'CHAINLINK', hex: 0x4aff6a, css: '#6dff8f' }, { name: 'COINSHOT', hex: 0xff4a3a, css: '#ff6a5a' }],
  [{ name: 'FURNACE', hex: 0xff7a2a, css: '#ffa04a' }, { name: 'OVERPRESSURE', hex: 0x4aff6a, css: '#6dff8f' }, { name: 'SAWBLADE', hex: 0xff3a4a, css: '#ff6a5a' }],
];
const SHOP = [
  { id: 'shotgun', gun: 1, v: 0, price: 200, desc: 'Unlocks the SHOTGUN. FURNACE alt-fire lobs an explosive core: shoot it with the revolver for a COMBO BLAST.' },
  { id: 'rev1', gun: 0, v: 1, price: 450, desc: 'Revolver variant. Charge ALT to fire a shot that CHAINS between up to 5 enemies and BANKS off walls.' },
  { id: 'shot1', gun: 1, v: 1, price: 550, req: 'shotgun', desc: 'Shotgun variant. Tap ALT to PUMP up to 3 times for a bigger blast. Three pumps detonates in your face (worth it).' },
  { id: 'rev2', gun: 0, v: 2, price: 700, desc: 'Revolver variant. ALT flips a COIN. Shoot it and the bullet redirects into the nearest head. Coins chain.' },
  { id: 'shot2', gun: 1, v: 2, price: 800, req: 'shotgun', desc: 'Shotgun variant. ALT launches a SAWBLADE that grinds through enemies and bounces off walls.' },
];
let PROGC = null;
function prog() { return PROGC || (PROGC = loadProgress()); }
function owns(id) { if ((G.mode === 'practice' || (VS && VS.active)) && !id.startsWith('skin_')) return true; return (prog().owned || []).includes(id); }
function ownsVariant(gun, v) { return v === 0 ? gun === 0 || owns(['', 'shotgun', 'nailgun', 'launcher', 'flail'][gun]) : owns(['rev', 'shot', 'nail', 'brick', 'flail'][gun] + v); }
function applyVariantLook() {
  chargeMat.emissive.setHex(VARIANTS[0][W.variant[0]].hex);
  VM.shotAccent.emissive.setHex(VARIANTS[1][W.variant[1]].hex);
  if (VARIANTS[2]) VM.nailAccent.emissive.setHex(VARIANTS[2][W.variant[2]].hex);
  if (VARIANTS[3]) VM.launcherAccent.emissive.setHex(VARIANTS[3][W.variant[3]].hex);
  const s5 = document.querySelector('#weaponSlots span[data-w="4"]');
  if (s5) s5.textContent = owns('flail') ? '5 FLAIL' : '5 LOCKED';
  const s4 = document.querySelector('#weaponSlots span[data-w="3"]');
  if (s4) s4.textContent = owns('launcher') ? '4 LAUNCHER' : '4 LOCKED';
  const s3 = document.querySelector('#weaponSlots span[data-w="2"]');
  if (s3) s3.textContent = owns('nailgun') ? '3 NAILGUN' : '3 LOCKED';
  const slot = document.querySelector('#weaponSlots span[data-w="1"]');
  if (slot) slot.textContent = owns('shotgun') ? '2 SHOTGUN' : '2 LOCKED';
}
function normalizeLoadout() {
  for (const g of [0, 1, 2, 3, 4]) if (!ownsVariant(g, W.variant[g])) W.variant[g] = 0;
  if (!ownedArms().includes(W.arm)) W.arm = 'fist';
  W.heat = 0; W.overheat = 0; W.shockCharge = 0;
  updateArmSlot();
  W.pump = 0; W.coins = 4; W.sawCD = 0;
  applyVariantLook();
}
function cycleVariant(gun) {
  if (gun === 1 && !owns('shotgun')) return;
  for (let k = 1; k <= 3; k++) {
    const v = (W.variant[gun] + k) % 3;
    if (ownsVariant(gun, v)) {
      if (v === W.variant[gun]) { pushFeed('More variants at the FORGE', ''); return; }
      W.variant[gun] = v;
      W.charging = false; W.charge = 0; W.pump = 0;
      W.switchT = 0.14;
      applyVariantLook();
      sfx.pump();
      pushFeed(VARIANTS[gun][v].name, 'cool');
      return;
    }
  }
}

// ---- THE FORGE station
let forge = null;
function placeForge(x, z, yaw) {
  const g = buildForge(GLOW);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  levelGroup.add(g);
  solids.push({ min: new V3(x - 1.4, 0, z - 1.4), max: new V3(x + 1.4, 1.0, z + 1.4), active: true });
  torches.push({ pos: new V3(x, 1.6, z), flame: new THREE.Object3D(), ph: 3, small: false });
  forge = { x, z };
}
function placeForgeInStart(layout) {
  const first = layout.rooms[0];
  const side = first.doors[0] ? first.doors[0].side : 'N';
  const D = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[side];
  const half = (D[0] ? first.w : first.d) / 2 - 2.2;
  placeForge(first.cx - D[0] * half, first.cz - D[1] * half, Math.atan2(D[0], D[1]));
}
let promptShown = false;
function updateForge() {
  if (!forge) return;
  const near = Math.hypot(P.pos.x - forge.x, P.pos.z - forge.z) < 3.4;
  if (near !== promptShown) {
    promptShown = near;
    $('prompt').textContent = `[${actLabel('interact')}] OPEN THE FORGE`;
    $('prompt').classList.toggle('show', near);
  }
  if (near && hit('interact')) openShop();
}
function openShop() {
  G.state = 'shop';
  keys.clear();
  document.exitPointerLock?.();
  renderShop();
  show('shop', true);
  sfx.door();
}
function closeShop() {
  if (G.state !== 'shop') return;
  show('shop', false);
  G.state = 'play';
  last = performance.now();
  requestLock();
}
function renderShop() {
  const p = prog();
  $('scrapTotal').textContent = `◆ ${p.scrap || 0} SCRAP`;
  $('shopList').innerHTML = SHOP.map((it) => {
    const vd = VARIANTS[it.gun][it.v];
    const have = owns(it.id);
    const blocked = it.req && !owns(it.req);
    const afford = (p.scrap || 0) >= it.price;
    const btn = have ? '<button disabled class="owned">OWNED</button>'
      : blocked ? `<button disabled>NEEDS ${it.req.toUpperCase()}</button>`
      : `<button data-buy="${it.id}" ${afford ? '' : 'disabled'}>◆ ${it.price}</button>`;
    return `<div class="item ${have ? 'have' : ''}"><div class="sw" style="background:${vd.css}"></div><div class="txt"><b>${WNAMES[it.gun]} · <span style="color:${vd.css}">${vd.name}</span></b><p>${it.desc}</p></div>${btn}</div>`;
  }).join('') + `<p class="hint">Swap variants in a fight by pressing the gun's number key again. Earn SCRAP by finishing levels (better rank = more) and in the RUBBLE PIT.</p>`;
  $('shopList').querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.buy)));
  renderSkins();
}
function buy(id) {
  const it = SHOP.find((x) => x.id === id);
  const p = prog();
  if (!it || owns(id) || (p.scrap || 0) < it.price) return;
  p.scrap -= it.price;
  STATS.scrapSpent += it.price;
  p.owned = [...(p.owned || []), id];
  saveProgress(p);
  sfx.buy();
  W.variant[it.gun] = it.v;
  applyVariantLook();
  renderShop();
}
function awardScrap(n) {
  const p = loadProgress();
  p.scrap = (p.scrap || 0) + n;
  saveProgress(p);
}
$('shopClose').addEventListener('click', closeShop);

// ================================================================ REVOLVER VARIANTS
// ---- COINSHOT
const coins = [];
const coinGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.03, 14);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xe8b040, metalness: 0.9, roughness: 0.25, emissive: 0x5a3a00, emissiveIntensity: 0.7 });
const coinHitGeo = new THREE.SphereGeometry(0.6, 8, 6);
const coinHitMat = new THREE.MeshBasicMaterial({ visible: false });
function tossCoin() {
  W.coins -= 1;
  const { origin, dir } = aim();
  const m = new THREE.Mesh(coinGeo, coinMat);
  const hm = new THREE.Mesh(coinHitGeo, coinHitMat);
  m.position.copy(origin).addScaledVector(dir, 0.7).add(new V3(0, -0.2, 0));
  hm.position.copy(m.position);
  scene.add(m, hm);
  const c = { m, hit: hm, vel: dir.clone().multiplyScalar(7).add(new V3(0, 9, 0)).addScaledVector(P.vel, 0.5), life: 3.2 };
  hm.userData.coin = c;
  coins.push(c);
  sfx.coin();
  W.kick = 0.4;
}
function removeCoin(c) {
  const i = coins.indexOf(c);
  if (i >= 0) coins.splice(i, 1);
  scene.remove(c.m, c.hit);
}
function updateCoins(dt) {
  for (const c of coins.slice()) {
    c.life -= dt;
    c.vel.y -= 16 * dt;
    c.m.position.addScaledVector(c.vel, dt);
    c.hit.position.copy(c.m.position);
    c.m.rotation.x += dt * 25;
    const p = c.m.position;
    if (c.life <= 0 || overlapBox(p.x - 0.1, p.y - 0.1, p.z - 0.1, p.x + 0.1, p.y + 0.1, p.z + 0.1)) removeCoin(c);
  }
}
function coinShot(c, dmg, depth) {
  const from = c.m.position.clone();
  removeCoin(c);
  sfx.coinHit();
  burst(from, 8, 0xffd04a, 6, 0.06, 0.3, true, 0.2);
  let best = null, bd = 30;
  for (const o of coins) { const d = o.m.position.distanceTo(from); if (d < bd && lineOfSight(from, o.m.position)) { bd = d; best = o; } }
  if (best) {
    tracer(from, best.m.position.clone(), 0xffd04a, 0.04, 0.22);
    addStyle(40 + depth * 20, 'COIN CHAIN', 'revolver', 'cool');
    coinShot(best, dmg * 1.5, depth + 1);
    return;
  }
  let target = null, td = 60, tp = null;
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const hp = new V3();
    e.rig.head.getWorldPosition(hp);
    const d = hp.distanceTo(from);
    if (d < td && lineOfSight(from, hp)) { td = d; target = e; tp = hp; }
  }
  if (!target) { tracer(from, from.clone().add(new V3(rand(-1, 1), 1, rand(-1, 1)).normalize().multiplyScalar(30)), 0xffd04a, 0.03, 0.2); return; }
  tracer(from, tp, 0xffd04a, 0.05, 0.25);
  useWeapon('revolver');
  addStyle(60 + depth * 30, 'COINSHOT', 'revolver', 'big');
  damageEnemy(target, dmg, { weapon: 'revolver', coin: true, head: true, point: tp, knock: tp.clone().sub(from).normalize().multiplyScalar(4) });
  hitmarker(true);
}

// ---- CHAINLINK
function fireChain() {
  const { origin, dir } = aim();
  const targets = rayTargets();
  const col = 0x6dff8f;
  ray.set(origin, dir); ray.far = 200;
  let h = ray.intersectObjects(targets, false)[0];
  let start = muzzle(), banked = false;
  sfx.charged(); W.kick = 1.8; W.flashT = 0.08;
  if (h && h.object.userData.solid && h.face) {
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    tracer(start, h.point, col, 0.06, 0.25);
    impactFx(h.point, n);
    const rd = dir.clone().reflect(n);
    start = h.point.clone().addScaledVector(n, 0.05);
    ray.set(start, rd); ray.far = 120;
    h = ray.intersectObjects(targets, false)[0];
    banked = true;
    if (!h) { tracer(start, start.clone().addScaledVector(rd, 60), col, 0.06, 0.25); return; }
  }
  if (!h) { tracer(start, start.clone().addScaledVector(dir, 100), col, 0.06, 0.25); return; }
  tracer(start, h.point, col, 0.06, 0.25);
  const o = h.object;
  if (o.userData.core) { detonateCore(o.userData.core, true); return; }
  if (o.userData.coin) { coinShot(o.userData.coin, 90, 0); return; }
  const e = o.userData.enemy;
  if (!e) { impactFx(h.point, null); return; }
  if (banked) addStyle(50, 'BANKSHOT', 'revolver', 'cool');
  const head = o.userData.part === 'head';
  const hitSet = new Set([e]);
  let pt = h.point.clone();
  damageEnemy(e, head ? 70 : 45, { weapon: 'revolver', chain: true, head, point: pt, knock: dir.clone().multiplyScalar(4) });
  hitmarker(head);
  useWeapon('revolver');
  let n = 1;
  for (let k = 0; k < 4; k++) {
    let best = null, bd = 16;
    for (const o2 of enemies) {
      if (o2.dead || o2.spawnT > 0 || hitSet.has(o2)) continue;
      const c = o2.mesh.position.clone(); c.y += o2.def.h * 0.55;
      const d = c.distanceTo(pt);
      if (d < bd && lineOfSight(pt, c)) { bd = d; best = { e: o2, c }; }
    }
    if (!best) break;
    tracer(pt, best.c, col, 0.04, 0.25);
    hitSet.add(best.e);
    damageEnemy(best.e, 40, { weapon: 'revolver', chain: true, point: best.c });
    pt = best.c; n++;
  }
  if (n >= 2) addStyle(35 * n, `CHAINLINK x${n}`, 'revolver', 'cool');
}

// ================================================================ SHOTGUN: SAWBLADE
const saws = [];
const sawMat = new THREE.MeshStandardMaterial({ color: 0xc8c8d0, metalness: 0.9, roughness: 0.25, flatShading: true });
const sawGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16);
const toothGeo = new THREE.ConeGeometry(0.06, 0.14, 3);
function launchSaw() {
  const { origin, dir } = aim();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(sawGeo, sawMat));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const t = new THREE.Mesh(toothGeo, sawMat);
    t.position.set(Math.cos(a) * 0.46, 0, Math.sin(a) * 0.46);
    t.rotation.set(0, -a, -Math.PI / 2);
    g.add(t);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff3a4a, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(1.4);
  g.add(glow);
  g.position.copy(origin).addScaledVector(dir, 1.0);
  scene.add(g);
  saws.push({ g, glow, vel: dir.clone().multiplyScalar(30), life: 2.6, bounces: 3, ticks: new Map(), scored: false });
  sfx.saw();
  W.kick = 1;
}
function removeSaw(s) {
  const i = saws.indexOf(s);
  if (i >= 0) saws.splice(i, 1);
  scene.remove(s.g);
  s.glow.material.dispose();
}
function updateSaws(dt) {
  for (const s of saws.slice()) {
    s.life -= dt;
    const p = s.g.position;
    for (const ax of ['x', 'y', 'z']) {
      p[ax] += s.vel[ax] * dt;
      if (overlapBox(p.x - 0.3, p.y - 0.05, p.z - 0.3, p.x + 0.3, p.y + 0.05, p.z + 0.3)) {
        p[ax] -= s.vel[ax] * dt;
        s.vel[ax] *= -1;
        s.bounces--;
        burst(p, 6, 0xffd090, 6, 0.05, 0.25, true, 0.3);
        sfx.ting();
      }
    }
    s.g.rotation.y += dt * 30;
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const ep = e.mesh.position;
      if (Math.hypot(p.x - ep.x, p.z - ep.z) < e.def.r + 0.5 && p.y > ep.y - 0.2 && p.y < ep.y + e.def.h + 0.3) {
        if (G.time >= (s.ticks.get(e) || 0)) {
          s.ticks.set(e, G.time + 0.12);
          damageEnemy(e, 14, { weapon: 'shotgun', point: p.clone(), knock: s.vel.clone().normalize().multiplyScalar(0.6) });
          if (!s.scored) { s.scored = true; useWeapon('shotgun'); addStyle(25, 'SAWED', 'shotgun', 'cool'); }
        }
      }
    }
    if (s.life <= 0 || s.bounces < 0) removeSaw(s);
  }
}
function clearProjectiles() {
  clearBricks();
  for (const c of coins.slice()) removeCoin(c);
  for (const s of saws.slice()) removeSaw(s);
}

// ================================================================ TRAINERS
function blockedFx(e, point) {
  const pt = point || e.mesh.position.clone().setY(e.mesh.position.y + e.def.h * 0.5);
  burst(pt, 6, 0xdfe8ff, 6, 0.06, 0.25, true, 0.2);
  sfx.ting();
  if (G.time - (e.blockHintT || -99) > 5) {
    e.blockHintT = G.time;
    pushFeed('BLOCKED', 'bad');
    if (e.def.hint) showHint(e.def.hint);
  }
}
function updateTrainer(e, dt) {
  if (e.type === 'roost' || e.type === 'crane') { updateRoost(e, dt); return; }
  if (e.type === 'queen') { updateRoost(e, dt); queenTick(e, dt); return; }
  if (e.def.ai === 'sniper') { updateVariantAI(e, dt); return; }
  if (e.type === 'fortress') fortressTick(e);
  const p = e.mesh.position, def = e.def, k = e.type;
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0;
  e.mesh.rotation.y = Math.atan2(dx, dz);
  if (e.state === 'chase') {
    let want = 1;
    if (k === 'sweeper') {
      want = dist > 14 ? 1 : dist < 9 ? -1 : 0;
      e.strafeT -= dt;
      if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rand(2, 4); }
    }
    const sp = def.speed * DIFF().speed;
    mx = nx * sp * want; mz = nz * sp * want;
    if (k === 'sweeper') { mx += -nz * e.strafe * sp * 0.6; mz += nx * e.strafe * sp * 0.6; }
    if (e.cd <= 0) {
      if (k === 'bulwark' || k === 'mirror') e.atk = dist < def.r + 2.4 ? 'bash' : 'throw';
      else if (k === 'sweeper') e.atk = dist < 5 ? 'stomp' : 'sweep';
      else e.atk = dist < 6 || Math.random() < 0.5 ? 'stomp' : 'spit';
      e.wt = { bash: 0.5, throw: 0.8, sweep: 0.9, stomp: 0.8, spit: 0.7 }[e.atk];
      e.state = 'windup'; e.t = e.wt;
      sfx.windup(1);
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      const head = new V3();
      e.rig.head.getWorldPosition(head);
      const eye = playerEye();
      if (e.atk === 'throw') {
        const v = eye.clone().setY(eye.y - 0.3).sub(head).normalize().multiplyScalar(10);
        spawnOrb(head.clone().addScaledVector(v, 0.15), v, 25);
        const o = orbs[orbs.length - 1];
        o.big = true;
        o.m.scale.setScalar(2.2);
        o.glow.material.color.setHex(0xff5a1a);
        sfx.orb(1);
      } else if (e.atk === 'bash') {
        ringFx(p.clone().addScaledVector(new V3(nx, 0, nz), 1.5), 3, 0xdfe8ff);
        sfx.punch();
        if (dist < def.r + 2.8) hurtPlayer(20, new V3(nx * 15, 6, nz * 15));
      } else if (e.atk === 'sweep') {
        const c = p.clone();
        shockwave(c, 12, 40, 25, true);
        if (e.hp < def.hp * 0.5) setTimeout(() => G.boss === e && shockwave(c, 12, 40, 25, true), 700);
        sfx.heavySlam(1);
        G.shake = Math.max(G.shake, 0.5);
      } else if (e.atk === 'stomp') {
        const c = p.clone();
        shockwave(c, 14, 26, 20, false);
        ringFx(c, 5, 0xff6a2a);
        burst(c.clone().setY(0.3), 18, 0x8a7a6a, 9, 0.25, 0.8);
        sfx.heavySlam(1);
        G.shake = Math.max(G.shake, 0.5);
        if (dist < 4.5 && P.pos.y - p.y < 1.6) hurtPlayer(25, new V3(nx * 10, 8, nz * 10));
      } else if (e.atk === 'spit') {
        const base = Math.atan2(eye.x - head.x, eye.z - head.z);
        const dy = (eye.y - 0.4 - head.y) / Math.max(1, dist);
        for (let i = 0; i < 3; i++) {
          const a = base + (i - 1) * 0.2;
          const v = new V3(Math.sin(a), dy, Math.cos(a)).normalize().multiplyScalar(15);
          spawnOrb(head.clone().addScaledVector(v, 0.2), v, 15);
        }
        sfx.orb(1);
      }
      e.state = 'recover'; e.t = 0.9;
    }
  } else if (e.t <= 0) {
    e.state = 'chase';
    e.cd = ({ bulwark: 2.2, sweeper: 2.4, kiln: 2.2 }[k] || 2.2) * DIFF().fire;
  }
  enemyPhysics(e, mx, mz, dt);
  const moving = Math.hypot(mx, mz) > 0.5;
  if (moving) e.walk += dt * 4;
  animateEnemy(e, dt, moving, w, G.time);
  applyFlash(e, w);
}
function updateRoost(e, dt) {
  const p = e.mesh.position, def = e.def, room = e.room;
  const cx = room ? room.cx : 0, cz = room ? room.cz : 0;
  const eye = playerEye();
  e.cd -= dt; e.t -= dt;
  let w = 0;
  const top = Math.min(G.ceil - 1, 6.5);
  const moveTo = (tx, ty, tz, sp) => {
    const d = new V3(tx - p.x, ty - p.y, tz - p.z);
    const l = d.length();
    if (l > 0.01) p.addScaledVector(d, Math.min(1, (sp * dt) / l));
  };
  if (e.state === 'chase') {
    e.orbit += dt * 0.6;
    moveTo(cx + Math.cos(e.orbit) * 8, top, cz + Math.sin(e.orbit) * 8, def.speed);
    if (e.cd <= 0) {
      e.atk = e.type === 'crane' ? 'rain' : Math.random() < 0.45 ? 'land' : 'rain';
      e.wt = e.atk === 'land' ? 0.6 : 0.7;
      e.state = 'windup'; e.t = e.wt;
      sfx.screech(1);
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      if (e.atk === 'rain') {
        for (let i = e.type === 'crane' ? -2 : -1; i <= (e.type === 'crane' ? 2 : 1); i++) {
          const tgt = eye.clone().add(new V3(i * 1.6, -0.4, 0));
          const v = tgt.sub(p).normalize().multiplyScalar(14);
          spawnOrb(p.clone().addScaledVector(v, 0.2), v, 15);
        }
        sfx.orb(1);
        e.state = 'recover'; e.t = 0.6;
      } else {
        e.state = 'dive';
        e.diveTarget = new V3(P.pos.x + rand(-2.5, 2.5), 0, P.pos.z + rand(-2.5, 2.5));
        e.hitDone = false;
      }
    }
  } else if (e.state === 'dive') {
    moveTo(e.diveTarget.x, 0, e.diveTarget.z, 20);
    if (!e.hitDone && p.distanceTo(new V3(P.pos.x, P.pos.y + 0.8, P.pos.z)) < 2.2) {
      e.hitDone = true;
      if (P.dashT > 0 || P.invuln > 0) addStyle(40, 'DODGE', null, 'cool');
      else hurtPlayer(15, new V3(P.pos.x - p.x, 0, P.pos.z - p.z).normalize().multiplyScalar(10).setY(6));
    }
    if (p.y <= 0.05) {
      p.y = 0;
      e.state = 'perch'; e.t = e.yanked ? 4 : 2.6;
      if (e.yanked) { e.yanked = false; burst(p.clone().setY(0.4), 24, 0x6a625a, 10, 0.3, 0.9); showHint('THE CRANE is grounded · hit it NOW'); }
      shockwave(p.clone(), 10, 12, 15, false);
      sfx.heavySlam(0.7);
      G.shake = Math.max(G.shake, 0.4);
    }
  } else if (e.state === 'perch') {
    if (e.t <= 0) { e.state = 'recover'; e.t = 1.0; }
  } else {
    moveTo(p.x, top, p.z, 6);
    if (e.t <= 0) { e.state = 'chase'; e.cd = rand(1.8, 2.8) * DIFF().fire; }
  }
  e.vel.multiplyScalar(Math.exp(-dt * 3));
  p.addScaledVector(e.vel, dt);
  if (p.y < 0) p.y = 0;
  enemyCollide(e);
  e.grounded = p.y < 0.3;
  e.mesh.rotation.y = Math.atan2(P.pos.x - p.x, P.pos.z - p.z);
  e.walk += dt;
  const real = e.state;
  if (real === 'perch') e.state = 'recover';
  animateEnemy(e, dt, true, w, G.time);
  e.state = real;
  applyFlash(e, w);
}

applyVariantLook();

// ================================================================ CHECKPOINTS
// Dying in a level respawns you outside the room you died in; that fight resets.
function respawnCheckpoint() {
  const L = G.layout;
  if (!L) { startLevel(G.levelIdx); return; }
  const room = L.rooms.find((r) => r.state === 'active');
  for (const e of enemies) { scene.remove(e.mesh); removeEnemyFx(e); for (const mt of [...e.mats, ...e.extraMats]) mt.dispose(); }
  enemies.length = 0;
  for (const o of orbs) scene.remove(o.m);
  orbs.length = 0;
  for (const c of cores) scene.remove(c.m);
  cores.length = 0;
  for (const sh of shocks) { scene.remove(sh.m); sh.m.material.dispose(); }
  shocks.length = 0;
  clearProjectiles();
  hideBeam();
  G.boss = null;
  show('bossBar', false);
  feedEl.innerHTML = '';
  let cp = G.checkpoint || { x: L.start.x, z: L.start.z, yaw: L.start.yaw };
  if (room) {
    room.state = 'idle'; room.queue = []; room.bossT = 0; room.wave = 0;
    for (const d of room.doorObjs) d.target = d.t = d.forward ? 0 : 1;
    const entry = room.doors.find((d) => d.door.b === room);
    if (entry) {
      const D = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[entry.side];
      const half = D[0] ? room.w / 2 : room.d / 2;
      cp = { x: room.cx + D[0] * (half + 2.4), z: room.cz + D[1] * (half + 2.4), yaw: Math.atan2(D[0], D[1]) };
    }
  }
  Object.assign(P, { hp: 100, grounded: false, wallJumps: 3, pips: 3, dashT: 0, sliding: false, slamming: false, invuln: 1.0, camH: 1.6, roll: 0, hurtFlash: 0, pitch: 0 });
  P.pos.set(cp.x, 0.05, cp.z); P.vel.set(0, 0, 0); P.yaw = cp.yaw;
  ST.points = 0;
  W.charging = false; W.charge = 0; W.pump = 0;
  keys.clear();
  enterPlay();
  banner('CHECKPOINT');
}

// ================================================================ POST FX (chromatic shake, flashes, kill-cam grade)
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
const mainPass = new RenderPass(scene, camera);
const vmPass = new RenderPass(vmScene, vmCam);
vmPass.clear = false; vmPass.clearDepth = true;
const FXPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uShift: { value: 0 }, uFlash: { value: new THREE.Vector4(1, 1, 1, 0) }, uDesat: { value: 0 }, uVig: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uShift, uDesat, uVig; uniform vec4 uFlash; varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5; vec2 off = d * uShift;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      c = min(c, vec3(1.15));
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, vec3(l) * vec3(1.05, 0.95, 0.85), uDesat);
      c *= 1.0 - uVig * smoothstep(0.2, 0.75, length(d));
      c = mix(c, uFlash.rgb, uFlash.a);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(mainPass); composer.addPass(vmPass); composer.addPass(FXPass); composer.addPass(new OutputPass());
const FXS = { shift: 0, flash: new THREE.Vector4(1, 1, 1, 0), desat: 0, vig: 0 };
function resizeFX() { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
resizeFX();
function fxShift(v) { if (settings.effects) FXS.shift = Math.max(FXS.shift, v); }
function fxFlash(hex, a) {
  if (!settings.effects) return;
  const c = new THREE.Color(hex);
  if (a >= FXS.flash.w) FXS.flash.set(c.r, c.g, c.b, a);
}
function renderFrame(dt) {
  FXS.shift *= Math.exp(-dt * 9);
  FXS.flash.w *= Math.exp(-dt * 9);
  const slow = G.slow.t > 0;
  FXS.desat += ((slow ? 0.6 : 0) - FXS.desat) * (1 - Math.exp(-dt * 10));
  FXS.vig += ((slow ? 0.7 : P.hp < 30 && G.state === 'play' ? 0.35 : 0.15) - FXS.vig) * (1 - Math.exp(-dt * 6));
  const showVM = !menuish() && G.state !== 'cutscene' && G.state !== 'vsSpectate' && G.state !== 'vsready';
  if (!settings.effects || settings.quality === 'low') {
    renderer.clear();
    renderer.render(scene, camera);
    if (showVM) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
    return;
  }
  vmPass.enabled = showVM;
  FXPass.uniforms.uShift.value = FXS.shift;
  FXPass.uniforms.uFlash.value.copy(FXS.flash);
  FXPass.uniforms.uDesat.value = FXS.desat;
  FXPass.uniforms.uVig.value = FXS.vig;
  composer.render();
}
function killCam(t, scale) {
  if (!settings.killcam) return;
  G.slow = { t, scale };
  fxFlash(0xffffff, 0.22);
}
function updateFov(dt) {
  const target = settings.fov + (P.dashT > 0 ? 10 : 0) + (P.sliding ? 6 : 0) + (G.slow.t > 0 ? -10 : 0);
  const nf = camera.fov + (target - camera.fov) * (1 - Math.exp(-dt * 10));
  if (Math.abs(nf - camera.fov) > 0.01) { camera.fov = nf; camera.updateProjectionMatrix(); }
}

// ================================================================ GORE, RUBBLE & DECALS
function splatTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  if (kind === 'hole') {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 60);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(20,16,14,.9)'); gr.addColorStop(1, 'rgba(20,16,14,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  } else {
    g.fillStyle = 'rgba(90,6,6,0.95)';
    g.beginPath(); g.arc(64, 64, 26 + Math.random() * 10, 0, 7); g.fill();
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 7, d = 20 + Math.random() * 38, r = 3 + Math.random() * 9;
      g.fillStyle = `rgba(${70 + Math.random() * 40},4,4,${0.7 + Math.random() * 0.3})`;
      g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const decalGeo = new THREE.PlaneGeometry(1, 1);
const mkDecal = (tex) => new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.4, metalness: 0.1 });
const bloodMats = [0, 1, 2].map(() => mkDecal(splatTexture('blood')));
const holeMat = mkDecal(splatTexture('hole'));
const decals = [];
function decal(point, normal, size, mat) {
  const m = new THREE.Mesh(decalGeo, mat);
  m.position.copy(point).addScaledVector(normal, 0.02 + decals.length * 0.00005);
  m.lookAt(tmpV.copy(point).add(normal));
  m.rotateZ(Math.random() * 6.28);
  m.scale.setScalar(size);
  m.receiveShadow = true;
  scene.add(m);
  decals.push(m);
  while (decals.length > QCAP(60, 140, 220)) scene.remove(decals.shift());
}
function bloodSpray(point, from) {
  const dir = point.clone().sub(from || camera.position).normalize();
  ray.set(point.clone().addScaledVector(dir, 0.3), dir); ray.far = 5;
  const h = ray.intersectObjects(worldMeshes, false)[0];
  if (h && h.face) decal(h.point, h.face.normal.clone().transformDirection(h.object.matrixWorld), rand(0.5, 1.2), bloodMats[(Math.random() * 3) | 0]);
}
function bloodPool(center, n, size) {
  for (let i = 0; i < n; i++) {
    const p = center.clone().add(new V3(rand(-1.2, 1.2), 0.5, rand(-1.2, 1.2)));
    ray.set(p, new V3(0, -1, 0)); ray.far = 12;
    const h = ray.intersectObjects(worldMeshes, false)[0];
    if (h) decal(h.point, UP, size * rand(0.6, 1.3), bloodMats[(Math.random() * 3) | 0]);
  }
}

// physics debris: detached enemy limbs, toppling bodies, and rubble chunks that stay on the floor
const debris = [];
const rubbleGeo = new THREE.DodecahedronGeometry(1, 0);
const rubbleMats = [0x6a625a, 0x7a3424, 0x4a4440].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
function floorAt(x, z, y) {
  let fy = -50;
  for (const s of solids) {
    if (!s.active) continue;
    if (x > s.min.x && x < s.max.x && z > s.min.z && z < s.max.z && s.max.y <= y + 0.4) fy = Math.max(fy, s.max.y);
  }
  return fy;
}
function addDebris(obj, vel, spin, owner, kind = 'piece', rad = 0.15) {
  scene.attach(obj);
  debris.push({ obj, vel, spin, owner, kind, rad, rest: false, tip: 0, tipDir: Math.random() < 0.5 ? -1 : 1 });
  if (owner) owner.refs++;
  while (debris.length > QCAP(30, 60, 90)) removeDebris(debris[0]);
}
function removeDebris(d) {
  const i = debris.indexOf(d);
  if (i >= 0) debris.splice(i, 1);
  scene.remove(d.obj);
  if (d.owner && --d.owner.refs <= 0) for (const mt of d.owner.mats) mt.dispose();
}
function updateDebris(dt) {
  for (const d of debris) {
    if (d.rest) continue;
    const o = d.obj;
    if (d.kind === 'body') {
      // a corpse: slides with its knockback and topples over around its feet
      d.vel.y -= 25 * dt;
      o.position.addScaledVector(d.vel, dt);
      const fy = floorAt(o.position.x, o.position.z, o.position.y);
      if (o.position.y <= fy) { o.position.y = fy; d.vel.y = 0; d.vel.x *= Math.exp(-dt * 5); d.vel.z *= Math.exp(-dt * 5); }
      d.tip = Math.min(1, d.tip + dt * (1.2 + d.tip * 3));
      o.rotation.x = d.baseX + d.tipDir * d.tip * Math.PI / 2;
      if (d.tip >= 1 && Math.hypot(d.vel.x, d.vel.z) < 0.3) { d.rest = true; burst(o.position.clone().setY(o.position.y + 0.2), 6, 0x6a625a, 3, 0.12, 0.6); }
      continue;
    }
    d.vel.y -= 25 * dt;
    o.position.addScaledVector(d.vel, dt);
    o.rotation.x += d.spin.x * dt; o.rotation.y += d.spin.y * dt; o.rotation.z += d.spin.z * dt;
    const p = o.position;
    if (overlapBox(p.x - 0.05, p.y + 0.05, p.z - 0.05, p.x + 0.05, p.y + 0.2, p.z + 0.05)) { d.vel.x *= -0.3; d.vel.z *= -0.3; }
    const fy = floorAt(p.x, p.z, p.y) + d.rad;
    if (p.y < fy) {
      p.y = fy;
      d.vel.y *= -0.3; d.vel.x *= 0.6; d.vel.z *= 0.6; d.spin.multiplyScalar(0.6);
      if (Math.abs(d.vel.y) < 1 && Math.hypot(d.vel.x, d.vel.z) < 0.4) d.rest = true;
    }
    if (p.y < -30) removeDebris(d);
  }
}
function rubble(pos, n, spread = 6) {
  if (!settings.gore) return;
  for (let i = 0; i < n; i++) {
    const s = rand(0.08, 0.26);
    const m = new THREE.Mesh(rubbleGeo, rubbleMats[(Math.random() * 3) | 0]);
    m.scale.setScalar(s);
    m.castShadow = true;
    m.position.copy(pos).add(new V3(rand(-0.6, 0.6), rand(0.2, 0.8), rand(-0.6, 0.6)));
    scene.add(m);
    addDebris(m, new V3(rand(-1, 1) * spread, rand(3, 9), rand(-1, 1) * spread), new V3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), null, 'piece', s * 0.7);
  }
}
function gibEnemy(e, info) {
  const owner = { mats: [...e.mats, ...e.extraMats], refs: 0 };
  for (const mt of e.mats) { mt.emissiveIntensity = 0.05; mt.color.multiplyScalar(0.6); }
  const knock = info && info.knock ? info.knock.clone() : new V3();
  const kd = knock.lengthSq() > 0 ? knock.normalize() : new V3();
  e.mesh.updateMatrixWorld(true);
  const r = e.rig;
  const pieces = ['head', 'elL', 'elR', 'kneeL', 'kneeR', 'w2L', 'w2R', 'tail2'].map((k) => r[k]).filter((p) => p && p.parent);
  const violent = info && (info.combo || info.weapon === 'shotgun' || info.weapon === 'slam' || e.hp < -e.def.hp * 0.5);
  const sc = e.baseScale || 1;
  for (const p of pieces) {
    if (!violent && Math.random() < 0.5 && p !== r.head) continue;
    const v = kd.clone().multiplyScalar(rand(3, 8)).add(new V3(rand(-3, 3), rand(4, 9), rand(-3, 3)));
    addDebris(p, v, new V3(rand(-12, 12), rand(-12, 12), rand(-12, 12)), owner, 'piece', 0.12 * sc);
  }
  const body = e.mesh;
  addDebris(body, kd.clone().multiplyScalar(4).setY(e.def.fly ? 0 : 2), new V3(), owner, 'body');
  const d = debris[debris.length - 1];
  d.baseX = body.rotation.x;
  if (e.def.fly) d.vel.y = 0;
  const c = body.position.clone(); c.y += e.def.h * 0.5;
  bloodPool(c, 3 + (violent ? 3 : 0), e.def.boss ? 3 : 1.4);
  for (let i = 0; i < 4; i++) bloodSpray(c, c.clone().add(new V3(rand(-1, 1), rand(-0.5, 0.5), rand(-1, 1))));
}
function clearGore() {
  for (const d of debris.slice()) removeDebris(d);
  for (const m of decals) scene.remove(m);
  decals.length = 0;
}

// ================================================================ BOSS INTRO CARDS
const EPITHETS = {
  boss1: ['SCENE 0 BOSS', 'WARDEN OF THE CELLAR'],
  boss2: ['SCENE 1 BOSS', 'ARCHITECT OF RUIN'],
  bulwark: ['TRAINER', 'LESSON I · THE PARRY'],
  sweeper: ['TRAINER', 'LESSON II · THE DASH'],
  roost: ['TRAINER', 'LESSON III · THE AIR'],
  kiln: ['TRAINER', 'LESSON IV · THE COMBO BLAST'],
};
let introT = 0;
function showIntro(type) {
  const def = DEFS[type];
  const [kind, epi] = EPITHETS[type] || ['', ''];
  const el = $('intro');
  el.querySelector('.kind').textContent = kind;
  el.querySelector('.name').textContent = def.short;
  el.querySelector('.epi').textContent = epi;
  el.classList.remove('hidden', 'play');
  void el.offsetWidth;
  el.classList.add('play');
  G.slow = { t: 2.0, scale: 0.15 };
  clearTimeout(introT);
  introT = setTimeout(() => el.classList.add('hidden'), 2600);
}

// ================================================================ TITLE SCREEN: logo + live attract scene
function buildLogo() {
  const h = document.querySelector('#menu h1');
  const text = h.textContent;
  h.innerHTML = [...text].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
  h.classList.add('logo');
}
const menuCrowd = [];
function clearMenuCrowd() {
  for (const c of menuCrowd) { scene.remove(c.mesh); for (const mt of c.mats) mt.dispose(); }
  menuCrowd.length = 0;
}
function spawnMenuCrowd() {
  clearMenuCrowd();
  ['grunt', 'grunt', 'shooter', 'heavy', 'flyer', 'flyer', 'grunt', 'shooter'].forEach((t, i) => {
    const md = buildEnemyModel(t, DEFS[t].color);
    const a = (i / 8) * Math.PI * 2;
    md.root.position.set(Math.cos(a) * 15, t === 'flyer' ? 5 : 0, Math.sin(a) * 15);
    scene.add(md.root);
    menuCrowd.push({ type: t, def: DEFS[t], mesh: md.root, rig: md.rig, mats: md.mats, orb: md.orb, walk: rand(0, 6), state: 'chase', t: rand(0, 2), wt: 0, target: new V3(rand(-20, 20), 0, rand(-20, 20)), animType: null, alt: rand(4, 7) });
  });
}
function updateMenuScene(dt, t) {
  camera.position.set(Math.sin(t * 0.06) * 25, 6 + Math.sin(t * 0.2) * 1.2, Math.cos(t * 0.06) * 25);
  camera.lookAt(Math.sin(t * 0.05) * 5, 2.4, Math.cos(t * 0.04) * 3);
  for (const c of menuCrowd) {
    c.t -= dt;
    if (c.t <= 0) {
      c.target.set(rand(-26, 26), 0, rand(-26, 26));
      c.t = rand(3, 7);
      if (Math.random() < 0.35) { c.state = 'windup'; c.wt = 0.8; }
    }
    let w = 0, moving = false;
    if (c.state === 'windup') { c.wt -= dt; w = 1 - c.wt / 0.8; if (c.wt <= 0) { c.state = 'recover'; c.wt = 0.5; } }
    else if (c.state === 'recover') { c.wt -= dt; if (c.wt <= 0) c.state = 'chase'; }
    else {
      const p = c.mesh.position;
      const dx = c.target.x - p.x, dz = c.target.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.5) {
        const sp = c.def.speed * 0.35;
        p.x += (dx / d) * sp * dt; p.z += (dz / d) * sp * dt;
        c.mesh.rotation.y = Math.atan2(dx, dz);
        moving = true;
      }
      if (c.def.fly) p.y = c.alt + Math.sin(t * 1.5 + c.walk) * 0.5;
    }
    c.walk += dt * c.def.speed * (moving ? 1.6 : 0.2);
    if (c.orb) c.orb.scale.setScalar(0.08 + w * 0.2);
    animateEnemy(c, dt, moving, w, t);
  }
}

buildLogo();
spawnMenuCrowd();

// ================================================================ BATCH 2: NAILGUN
VARIANTS.push([{ name: 'LODESTONE', hex: 0x3ac8ff, css: '#6ad8ff' }, { name: 'SCORCHER', hex: 0x4aff6a, css: '#6dff8f' }, { name: 'SKIPJACK', hex: 0xff3a4a, css: '#ff6a5a' }]);
SHOP.push(
  { id: 'nailgun', gun: 2, v: 0, price: 600, desc: 'Unlocks the NAILGUN: a rotary nail-spitter. LODESTONE alt-fire throws a MAGNET that nails orbit and home in on.' },
  { id: 'nail1', gun: 2, v: 1, price: 650, req: 'nailgun', desc: 'Nailgun variant. Firing builds HEAT; ALT dumps it as a blazing fan of burning nails.' },
  { id: 'nail2', gun: 2, v: 2, price: 750, req: 'nailgun', desc: 'Nailgun variant. Nails SKIP off walls twice, hitting harder each bounce. ALT fires a wide skipping fan.' },
);
const ARM_NAMES = { fist: 'PUNCH', blade: 'BLADE', shock: 'SHOCKWAVE', grapple: 'GRAPPLE' };
function nextGun() {
  for (let k = 1; k <= 5; k++) { const g = (W.cur + k) % 5; if (g === 0 || (g === 1 && owns('shotgun')) || (g === 2 && owns('nailgun')) || (g === 3 && owns('launcher')) || (g === 4 && owns('flail'))) return g; }
  return 0;
}

const nails = [], stuckNails = [], magnets = [];
const nailGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 4).rotateX(Math.PI / 2);
const nailMat = new THREE.MeshStandardMaterial({ color: 0xb8b8c4, metalness: 0.9, roughness: 0.3 });
const hotNailMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
const magnetGeo = new THREE.TorusGeometry(0.16, 0.05, 6, 12, Math.PI);
const magnetMat = new THREE.MeshStandardMaterial({ color: 0xc81e1e, emissive: 0x3a0606, emissiveIntensity: 1, metalness: 0.5 });
function spawnNail(dir, opts = {}) {
  const m = new THREE.Mesh(nailGeo, opts.burn ? hotNailMat : nailMat);
  const p = muzzle();
  m.position.copy(p);
  m.lookAt(p.clone().add(dir));
  scene.add(m);
  nails.push({ m, vel: dir.clone().multiplyScalar(opts.speed || 75), life: 1.6, dmg: opts.dmg || 7, bounces: opts.bounces || 0, burn: !!opts.burn });
}
function fireNails(n, spread, opts) {
  statShot();
  const { dir } = aim();
  const right = new V3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new V3(0, 1, 0).applyQuaternion(camera.quaternion);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    spawnNail(dir.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize(), opts);
  }
}
function updateNailgun(dt) {
  const v = W.variant[2];
  W.nailCD -= dt;
  W.heat = Math.max(0, W.heat - dt * (v === 1 ? 0.18 : 0.35));
  if (W.overheat > 0) W.overheat -= dt;
  if (down('fire') && W.nailCD <= 0 && !(W.overheat > 0)) {
    W.nailCD = 0.065;
    fireNails(1, 0.035, { bounces: v === 2 ? 2 : 0 });
    VM.nailSpin.rotation.z += 0.9;
    W.kick = Math.max(W.kick, 0.35); W.flashT = 0.03;
    if (Math.random() < 0.5) sfx.nail();
    if (v === 1) { W.heat = Math.min(1, W.heat + 0.03); if (W.heat >= 1) { W.overheat = 1.2; pushFeed('OVERHEATED', 'bad'); sfx.ting(); } }
  }
  if (v === 0 && hit('alt') && magnets.length < 3) throwMagnet();
  if (v === 1 && hit('alt') && W.heat >= 0.35) {
    fireNails(10 + Math.round(W.heat * 14), 0.16, { burn: true, dmg: 10, speed: 60 });
    sfx.shotgun(); W.kick = 2; W.flashT = 0.08; fxShift(0.008);
    if (W.heat > 0.8) addStyle(60, 'MELTDOWN', 'nailgun', 'big');
    W.heat = 0; W.overheat = 0;
  }
  if (v === 2 && hit('alt') && !(W.fanCD > 0)) { fireNails(9, 0.22, { bounces: 2, dmg: 8 }); W.fanCD = 1.0; sfx.shotgun(); W.kick = 1.5; }
  if (W.fanCD > 0) W.fanCD -= dt;
}
function throwMagnet() {
  const { origin, dir } = aim();
  const m = new THREE.Mesh(magnetGeo, magnetMat);
  m.position.copy(origin).addScaledVector(dir, 0.8);
  scene.add(m);
  magnets.push({ m, vel: dir.clone().multiplyScalar(30), life: 8, stuck: false, enemy: null, off: new V3() });
  sfx.throwCore();
}
function updateMagnets(dt) {
  for (const g of magnets.slice()) {
    g.life -= dt;
    if (!g.stuck) {
      const p = g.m.position.clone();
      const step = g.vel.clone().multiplyScalar(dt);
      ray.set(p, step.clone().normalize()); ray.far = step.length() + 0.2;
      const h = ray.intersectObjects(rayTargets(), false)[0];
      if (h) { g.stuck = true; g.m.position.copy(h.point); const e = h.object.userData.enemy; if (e) { g.enemy = e; g.off.copy(h.point).sub(e.mesh.position); } }
      else g.m.position.add(step);
      g.vel.y -= 6 * dt;
    } else if (g.enemy) {
      if (g.enemy.dead) g.enemy = null; else g.m.position.copy(g.enemy.mesh.position).add(g.off);
    }
    g.m.rotation.y += dt * 4;
    if (g.life <= 0) { scene.remove(g.m); magnets.splice(magnets.indexOf(g), 1); }
  }
}
function updateNails(dt) {
  updateMagnets(dt);
  if (!nails.length) return;
  const targets = rayTargets();
  for (const n of nails.slice()) {
    n.life -= dt;
    for (const g of magnets) {
      const to = g.m.position.clone().sub(n.m.position);
      const d = to.length();
      if (d < 14 && d > 0.3) { const sp = n.vel.length(); n.vel.addScaledVector(to.normalize(), 160 * dt).setLength(sp); }
    }
    const step = n.vel.clone().multiplyScalar(dt);
    const len = step.length();
    ray.set(n.m.position, step.clone().divideScalar(len)); ray.far = len;
    const h = ray.intersectObjects(targets, false)[0];
    if (h) {
      const o = h.object;
      if (o.userData.core) { detonateCore(o.userData.core, false); removeNail(n); continue; }
      if (o.userData.coin) { coinShot(o.userData.coin, 35, 0); removeNail(n); continue; }
      const e = o.userData.enemy;
      if (e) {
        const head = o.userData.part === 'head';
        damageEnemy(e, n.dmg * (head ? 1.6 : 1), { weapon: 'nailgun', head, point: h.point, knock: n.vel.clone().normalize().multiplyScalar(0.4) });
        if (n.burn) e.burnT = 3;
        if (Math.random() < 0.3) hitmarker(head);
        useWeaponThrottled();
        removeNail(n); continue;
      }
      if (n.bounces > 0 && h.face) {
        const nr = h.face.normal.clone().transformDirection(o.matrixWorld);
        n.vel.reflect(nr); n.bounces--; n.dmg *= 1.5;
        n.m.position.copy(h.point).addScaledVector(nr, 0.05);
        n.m.lookAt(n.m.position.clone().add(n.vel));
        burst(h.point, 2, 0xffd090, 4, 0.04, 0.2, true, 0.3);
        continue;
      }
      n.m.position.copy(h.point);
      nails.splice(nails.indexOf(n), 1);
      stuckNails.push(n.m);
      if (stuckNails.length > 140) scene.remove(stuckNails.shift());
      continue;
    }
    n.m.position.add(step);
    if (n.life <= 0) removeNail(n);
  }
}
let nailUseT = 0;
function useWeaponThrottled() { if (G.time - nailUseT > 0.25) { nailUseT = G.time; useWeapon('nailgun'); } }
function removeNail(n) { scene.remove(n.m); const i = nails.indexOf(n); if (i >= 0) nails.splice(i, 1); }
function updateBurning(dt) {
  for (const e of enemies) {
    if (!(e.burnT > 0) || e.dead) continue;
    e.burnT -= dt;
    if (Math.random() < 0.4) spawnPart(e.mesh.position.clone().add(new V3(rand(-0.4, 0.4), rand(0.5, e.def.h), rand(-0.4, 0.4))), new V3(0, 2.5, 0), 0xff8a2a, 0.1, 0.4, true, -0.1);
    damageEnemy(e, 9 * dt, { weapon: 'nailgun', dot: true });
  }
}
function clearNails() {
  for (const n of nails) scene.remove(n.m);
  nails.length = 0;
  for (const m of stuckNails) scene.remove(m);
  stuckNails.length = 0;
  for (const g of magnets) scene.remove(g.m);
  magnets.length = 0;
}

// ================================================================ ARMS
function ownedArms() { return ['fist', ...['blade', 'shock', 'grapple'].filter((a) => owns('arm_' + a))]; }
function cycleArm() {
  const list = ownedArms();
  if (list.length < 2) { pushFeed('Win DUELS to earn new arms', ''); return; }
  W.arm = list[(list.indexOf(W.arm) + 1) % list.length];
  pushFeed(ARM_NAMES[W.arm] + ' ARM', 'cool');
  sfx.pump();
  updateArmSlot();
}
function updateArmSlot() { const el = $('armSlot'); if (el) el.textContent = G.input === 'touch' ? ARM_NAMES[W.arm] : `${actLabel('punch')} ${ARM_NAMES[W.arm]}`; }
function slash() {
  W.punchCD = 0.28; W.punchT = 0.22;
  breakSecretsInFront(3.4);
  const { origin, dir } = aim();
  let n = 0;
  for (const o of orbs.slice()) {
    if (o.parried) continue;
    const to = o.m.position.clone().sub(origin);
    if (to.length() < 3.6 && to.normalize().dot(dir) > 0.3) {
      burst(o.m.position, 10, 0x9ae8ff, 6, 0.06, 0.3, true, 0.2);
      scene.remove(o.m); orbs.splice(orbs.indexOf(o), 1);
      addStyle(50, 'SLICED', 'blade', 'cool');
    }
  }
  for (const e of enemies.slice()) {
    if (e.dead || e.spawnT > 0) continue;
    const c = e.mesh.position.clone(); c.y += Math.min(e.def.h * 0.55, 1.4);
    const to = c.clone().sub(origin);
    if (to.length() - e.def.r < 3.2 && to.normalize().dot(dir) > 0.3) {
      damageEnemy(e, 35, { weapon: 'blade', point: c, knock: dir.clone().multiplyScalar(5).setY(2) });
      n++;
    }
  }
  if (n) { useWeapon('blade'); hitmarker(false); if (n >= 3) addStyle(40 * n, `CLEAVE x${n}`, 'blade', 'cool'); }
  tracer(origin.clone().add(new V3(-0.6, -0.3, 0).applyQuaternion(camera.quaternion)).addScaledVector(dir, 1.2), origin.clone().add(new V3(0.6, 0.2, 0).applyQuaternion(camera.quaternion)).addScaledVector(dir, 1.6), 0x9ae8ff, 0.05, 0.12);
  sfx.whiff(); sfx.ting();
}
function shockPunch(c) {
  W.punchCD = 0.9; W.punchT = 0.3;
  breakSecretsInFront(3 + c * 3.5);
  const { origin, dir } = aim();
  const radius = 3 + c * 3.5;
  blastFx(origin.clone().addScaledVector(dir, 1.6), 1.2 + c * 2, 0xff8a2a);
  sfx.slam(); fxShift(0.01 + c * 0.012); G.shake = Math.max(G.shake, 0.3 + c * 0.4);
  for (const o of orbs) {
    if (o.parried) continue;
    const to = o.m.position.clone().sub(origin);
    if (to.length() < radius && to.normalize().dot(dir) > 0.2) {
      o.parried = true; o.dmg = o.big ? 170 : 90; o.life = 4;
      o.vel.copy(dir).multiplyScalar(42);
      o.m.material.color.set(0x9ae8ff);
      addStyle(80, 'SHOCK PARRY', null, 'big');
      heal(15);
    }
  }
  let n = 0;
  for (const e of enemies.slice()) {
    if (e.dead || e.spawnT > 0) continue;
    const ctr = e.mesh.position.clone(); ctr.y += Math.min(e.def.h * 0.5, 1.4);
    const to = ctr.clone().sub(origin);
    if (to.length() - e.def.r < radius && to.normalize().dot(dir) > 0.2) {
      damageEnemy(e, 30 + 60 * c, { weapon: 'shock', charge: c, point: ctr, explosion: true, knock: dir.clone().multiplyScalar(10 + 14 * c).setY(5 + 4 * c) });
      n++;
    }
  }
  if (n) { useWeapon('shock'); addStyle(30 + n * 25, 'SHOCKWAVE', 'shock', 'cool'); }
}
let grappleLine = null;
function fireGrapple() {
  W.punchCD = 0.5; W.punchT = 0.3;
  const { origin, dir } = aim();
  ray.set(origin, dir); ray.far = 45;
  const h = ray.intersectObjects(rayTargets(), false)[0];
  sfx.throwCore();
  if (!h) { tracer(muzzle(), origin.clone().addScaledVector(dir, 45), 0x8a6a4a, 0.015, 0.2); return; }
  tracer(muzzle(), h.point, 0xc8a070, 0.02, 0.3);
  const e = h.object.userData.enemy;
  if (e && !e.dead) {
    if (e.type === 'crane' && e.state !== 'perch' && e.state !== 'dive') { craneYank(e); useWeapon('grapple'); return; }
    if (e.layers > 0) { stripLayer(e); useWeapon('grapple'); return; }
    if (e.shieldUp) { breakShield(e, dir.clone().negate()); addStyle(80, 'SHIELD RIP', 'grapple', 'big'); useWeapon('grapple'); return; }
    if (e.def.mass <= 1 && !e.def.boss) {
      const pull = P.pos.clone().sub(e.mesh.position);
      pull.y = 0;
      e.vel.copy(pull.multiplyScalar(2.2)).setY(7);
      e.grounded = false;
      if (e.state === 'dive') { e.state = 'recover'; e.t = 0.6; }
      addStyle(40, 'YANKED', 'grapple', 'cool');
      useWeapon('grapple');
      return;
    }
  }
  const to = h.point.clone().sub(P.pos);
  const d = to.length();
  P.vel.copy(to.normalize().multiplyScalar(Math.min(34, 12 + d * 1.1))).setY(Math.max(P.vel.y, 8 + Math.max(0, h.point.y - P.pos.y) * 0.8));
  P.grounded = false; P.sliding = false; P.slamming = false;
  if (P.wallJumps < 3) P.wallJumps++;
  if (!e) addStyle(10, null, 'grapple');
}

// ================================================================ NEW ENEMIES
const SEEN = new Set();
const ENEMY_INTRO = {
  shield: 'SHIELDBEARER · blocks from the front. Flank it, or break the shield with explosions, slams or the GRAPPLE',
  sniper: 'SNIPER · watch for the red line. DASH, hide, or PUNCH the moment it flashes white',
  bomber: 'BOMBER · explodes when it reaches you. Pop it at range and it hurts its friends instead',
  priest: 'PRIEST · heals and wards nearby enemies (they take half damage). Kill it first',
};
function maybeIntro(type) {
  if (ENEMY_INTRO[type] && !SEEN.has(type)) { SEEN.add(type); setTimeout(() => showHint(ENEMY_INTRO[type]), 500); }
}
function removeEnemyFx(e) { if (e.beam) { scene.remove(e.beam); e.beam.material.dispose(); e.beam = null; } }
function enemyBeam(e, color) {
  if (!e.beam) {
    e.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(e.beam);
  }
  return e.beam;
}
function setBeam(b, a, c, w) {
  const len = a.distanceTo(c);
  b.visible = len > 0.01;
  b.position.copy(a).add(c).multiplyScalar(0.5);
  b.quaternion.setFromUnitVectors(UP, tmpV.copy(c).sub(a).normalize());
  b.scale.set(w, len, w);
}
function breakShield(e, dir) {
  if (!e.shieldUp) return;
  e.shieldUp = false;
  const sh = e.rig.shield;
  if (sh && sh.parent) {
    e.mesh.updateMatrixWorld(true);
    const owner = { mats: [], refs: 0 };
    addDebris(sh, (dir || new V3(0, 0, 1)).clone().multiplyScalar(6).setY(5), new V3(rand(-6, 6), rand(-6, 6), rand(-6, 6)), owner, 'piece', 0.2);
  }
  sfx.explode(); burst(e.mesh.position.clone().setY(1.2), 16, 0x8a6a4a, 8, 0.15, 0.6);
  addStyle(60, 'SHIELD BREAK', null, 'cool');
}
function updateVariantAI(e, dt) {
  const ai = e.def.ai;
  const p = e.mesh.position, def = e.def;
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0;
  e.mesh.rotation.y = Math.atan2(dx, dz);
  const sp = def.speed * DIFF().speed;
  const eye = playerEye();
  if (ai === 'sniper') {
    if (e.state === 'chase') {
      e.strafeT -= dt;
      if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rand(2, 4); }
      const want = dist < 16 ? -1 : dist > 32 ? 1 : 0;
      mx = (nx * want - nz * e.strafe * 0.5) * sp; mz = (nz * want + nx * e.strafe * 0.5) * sp;
      if (e.cd <= 0) {
        const from = new V3(); e.rig.muzzle.getWorldPosition(from);
        if (lineOfSight(from, eye)) { e.state = 'aim'; e.t = 1.5; e.aimAt = eye.clone(); sfxAt(p, 'windup', distVol(p)); }
        else e.cd = 0.6;
      }
      if (e.beam) e.beam.visible = false;
    } else if (e.state === 'aim') {
      const from = new V3(); e.rig.muzzle.getWorldPosition(from);
      e.aimAt.lerp(eye, Math.min(1, dt * (e.t > 0.45 ? 5 : 0.5)));
      w = 1 - e.t / 1.5;
      const b = enemyBeam(e, 0xff2020);
      const flash = e.t < 0.45;
      b.material.color.setHex(flash ? 0xffffff : 0xff2020);
      setBeam(b, from, from.clone().add(e.aimAt.clone().sub(from).normalize().multiplyScalar(60)), flash ? 0.04 : 0.015);
      if (e.t <= 0) {
        b.visible = false;
        const dirv = e.aimAt.clone().sub(from).normalize();
        ray.set(from, dirv); ray.far = 120;
        const wh = ray.intersectObjects(worldMeshes, false)[0];
        const end = wh ? wh.point : from.clone().addScaledVector(dirv, 120);
        tracer(from, end, 0xff4040, 0.12, 0.25);
        sfx.charged();
        const body = new V3(P.pos.x, P.pos.y + 1, P.pos.z);
        if (segDist(body, from, end) < 0.9) {
          if (P.dashT > 0 || P.invuln > 0) addStyle(60, 'DODGE', null, 'cool');
          else hurtPlayer(32, dirv.clone().multiplyScalar(6));
        }
        e.state = 'recover'; e.t = 0.8;
      }
    } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(2.5, 4) * DIFF().fire * (e.def.trainer ? 0.4 : 1); }
  } else if (ai === 'bomber') {
    if (e.state === 'chase') {
      mx = nx * sp; mz = nz * sp;
      if (dist < 2.4 && Math.abs(P.pos.y - p.y) < 2.5) { e.state = 'windup'; e.t = 0.45; sfx.windup(1); }
    } else if (e.state === 'windup') {
      w = 1 - e.t / 0.45;
      mx = nx * sp * 0.3; mz = nz * sp * 0.3;
      if (e.t <= 0) { detonateBomber(e, true); return; }
    }
    if (e.rig.fuse) e.rig.fuse.scale.setScalar(1 + Math.sin(G.time * (e.state === 'windup' ? 40 : 12)) * 0.4);
  } else if (ai === 'priest') {
    let want = dist < 14 ? -1 : dist > 24 ? 1 : 0;
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rand(2, 4); }
    mx = (nx * want - nz * e.strafe * 0.6) * sp; mz = (nz * want + nx * e.strafe * 0.6) * sp;
    e.linkT = (e.linkT || 0) - dt;
    if (e.linkT <= 0) {
      e.linkT = 0.5;
      let best = null, bd = 16;
      for (const o of enemies) {
        if (o === e || o.dead || o.spawnT > 0 || o.def.ai === 'priest') continue;
        const d = o.mesh.position.distanceTo(p) - (o.hp < o.maxHp ? 6 : 0);
        if (d < bd) { bd = d; best = o; }
      }
      e.link = best;
    }
    const b = enemyBeam(e, 0x6ad8ff);
    if (e.link && !e.link.dead) {
      const o = e.link;
      o.wardT = G.time + 0.25;
      o.hp = Math.min(o.maxHp, o.hp + 22 * dt);
      const from = new V3(); e.rig.head.getWorldPosition(from);
      const to = o.mesh.position.clone(); to.y += o.def.h * 0.6;
      setBeam(b, from, to, 0.03 + Math.sin(G.time * 20) * 0.01);
      w = 0.3;
    } else b.visible = false;
  }
  enemyPhysics(e, mx, mz, dt);
  const moving = Math.hypot(mx, mz) > 0.5;
  if (moving) e.walk += dt * def.speed * 1.6;
  const real = e.state;
  if (ai === 'sniper' && real === 'aim') e.state = 'windup';
  animateEnemy(e, dt, moving, w, G.time);
  e.state = real;
  applyFlash(e, ai === 'priest' ? 0 : w);
}
function detonateBomber(e, self) {
  if (e.boomed) return;
  e.boomed = true;
  const c = e.mesh.position.clone(); c.y += 0.8;
  if (self) {
    e.dead = true;
    removeEnemyFx(e);
    if (settings.gore) gibEnemy(e, { knock: new V3(0, 6, 0), combo: true });
    else { scene.remove(e.mesh); for (const mt of e.mats) mt.dispose(); }
  }
  explode(c, 4.5, 70, 'bomb');
}

// ================================================================ DUELISTS + DIALOG
const DUEL_LINES = {
  shard: { intro: 'Oh! A visitor! Shall we dance, darling?', 75: 'Ow, rude! Lovely footwork though.', 50: "I'm... cracking up! Hah!", 25: 'Every pane has its limit, it seems...', win: 'Take my blade, dear. Mind the edges.' },
  bertha: { intro: 'IN THIS CORNER... THE CHAMP! Let\'s RUMBLE!', 75: 'HAH! That tickled!', 50: "NOW we're WRESTLING!", 25: 'Ooh, the crowd LOVES you!', win: 'What a MATCH! Here, you earned the FIST!' },
  kite: { intro: 'Oi, bricky! Too slow to catch me!', 75: 'Lucky shot. Bet you can\'t do it again!', 50: 'Okay okay, you\'re kinda good!', 25: 'Hey! Watch the hat!', win: "Fine! Take the hook. Don't fall off anything." },
};
let dlgT = 0;
function sayLine(who, text) {
  const d = $('dialog');
  d.querySelector('b').textContent = who;
  const span = d.querySelector('span');
  span.textContent = '';
  d.classList.add('show');
  let i = 0;
  clearInterval(d._typer);
  d._typer = setInterval(() => { span.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(d._typer); }, 22);
  clearTimeout(dlgT);
  dlgT = setTimeout(() => d.classList.remove('show'), 3600);
  sfx.ting();
}
function duelChatter(e) {
  const lines = DUEL_LINES[e.type];
  if (!lines) return;
  e.said = e.said || {};
  const pct = (e.hp / e.maxHp) * 100;
  for (const th of [75, 50, 25]) if (pct < th && !e.said[th]) { e.said[th] = true; sayLine(e.def.short, lines[th]); }
}
function updateDuelist(e, dt) {
  const p = e.mesh.position, def = e.def, k = e.type;
  if (!e.said) { e.said = {}; setTimeout(() => { if (!e.dead) sayLine(def.short, DUEL_LINES[k].intro); }, 2200); }
  duelChatter(e);
  const rage = e.hp < e.maxHp * 0.5 ? 1.3 : 1;
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  const eye = playerEye();
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0;
  if (k === 'kite') { updateKite(e, dt, rage); return; }
  if (k === 'tumble' || k === 'twirl') { updateTwin(e, dt, rage); return; }
  if (k === 'cat') { updateCat(e, dt, rage); return; }
  if (e.state !== 'dash' && e.state !== 'charge') e.mesh.rotation.y = Math.atan2(dx, dz);
  const sp = def.speed * rage * DIFF().speed;
  if (e.state === 'chase') {
    if (k === 'shard' || k === 'gilded') {
      e.strafeT -= dt;
      if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rand(1, 2.5); }
      const want = dist > 10 ? 1 : dist < 6 ? -1 : 0;
      mx = (nx * want - nz * e.strafe) * sp; mz = (nz * want + nx * e.strafe) * sp;
    } else { mx = nx * sp; mz = nz * sp; }
    if (e.cd <= 0) {
      const r = Math.random();
      if (k === 'shard' || k === 'gilded') e.atk = r < 0.35 ? 'dash' : r < 0.65 ? 'shards' : r < 0.85 || k === 'shard' ? 'stance' : 'pound';
      else e.atk = dist < 3.5 ? 'grab' : r < 0.35 ? 'charge' : r < 0.7 ? 'pound' : 'brick';
      e.wt = { dash: 0.4, shards: 0.6, stance: 0.3, grab: 0.45, charge: 0.6, pound: 0.5, brick: 0.6 }[e.atk] / rage;
      e.state = 'windup'; e.t = e.wt;
      sfx.windup(1);
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      const head = new V3(); e.rig.head.getWorldPosition(head);
      if (e.atk === 'dash' || e.atk === 'charge') {
        e.dashDir = new V3(nx, 0, nz); e.state = e.atk; e.t = e.atk === 'dash' ? 0.4 : 1.2; e.hitDone = false;
        if (e.atk === 'dash') { sfx.dash(); e.dashes = (e.dashes || 0) + 1; } else sfx.bossRoar();
      } else if (e.atk === 'shards') {
        const n = rage > 1 ? 9 : 7;
        const base = Math.atan2(eye.x - head.x, eye.z - head.z);
        const dy = (eye.y - 0.3 - head.y) / Math.max(1, dist);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.13;
          spawnOrb(head.clone(), new V3(Math.sin(a), dy, Math.cos(a)).normalize().multiplyScalar(19), 12, { color: 0x9ae8ff });
        }
        sfx.orb(1);
        e.state = 'recover'; e.t = 0.5;
      } else if (e.atk === 'stance') {
        e.state = 'stance'; e.t = 1.4;
        sayLine(def.short, Math.random() < 0.5 ? 'En garde!' : 'Go on, shoot me. I dare you.');
      } else if (e.atk === 'grab') {
        if (dist < 3.8 && P.pos.y - p.y < 2.5) { hurtPlayer(30, new V3(nx * 6, 16, nz * 6)); sayLine(def.short, 'SUPLEX!'); }
        e.state = 'recover'; e.t = 0.8;
      } else if (e.atk === 'pound') {
        e.state = 'rise'; e.t = 0.9;
      } else if (e.atk === 'brick') {
        for (let i = -1; i <= 1; i++) {
          const tgt = P.pos.clone().add(new V3(i * 2.5, 0, rand(-1, 1)));
          const fl = 1.1;
          const v = tgt.sub(head).divideScalar(fl); v.y += 0.5 * 20 * fl;
          spawnOrb(head.clone(), v, 15, { grav: 20, boom: 2.6, color: 0xb8543a, big: true });
        }
        sfx.throwCore();
        e.state = 'recover'; e.t = 0.7;
      }
    }
  } else if (e.state === 'dash' || e.state === 'charge') {
    const speed = e.state === 'dash' ? 26 : 20;
    e.mesh.rotation.y = Math.atan2(e.dashDir.x, e.dashDir.z);
    mx = e.dashDir.x * speed * rage; mz = e.dashDir.z * speed * rage;
    if (!e.hitDone && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < def.r + 1.2 && P.pos.y - p.y < 3) {
      e.hitDone = true;
      if (P.dashT > 0 || P.invuln > 0) addStyle(50, 'DODGE', null, 'cool');
      else hurtPlayer(e.state === 'dash' ? 20 : 28, e.dashDir.clone().multiplyScalar(14).setY(7));
    }
    if (e.t <= 0) {
      if (e.state === 'dash' && rage > 1 && e.dashes % 2 === 1) { e.state = 'windup'; e.atk = 'dash'; e.wt = e.t = 0.25; }
      else { e.state = 'recover'; e.t = 0.6; }
    }
  } else if (e.state === 'stance') {
    w = 0.5 + Math.sin(G.time * 20) * 0.5;
    if (e.t <= 0) { e.state = 'chase'; e.cd = rand(1, 2); }
  } else if (e.state === 'rise') {
    e.vel.y = Math.max(e.vel.y, 0);
    p.y += dt * 9;
    mx = nx * Math.min(18, dist * 3); mz = nz * Math.min(18, dist * 3);
    if (e.t <= 0) { e.state = 'drop'; }
  } else if (e.state === 'drop') {
    p.y -= dt * 30;
    if (p.y <= 0.05) {
      p.y = 0;
      shockwave(p.clone(), 15, 30, 25, false);
      ringFx(p.clone(), 6, 0xff8a2a); burst(p.clone().setY(0.3), 26, 0x8a7a6a, 11, 0.3, 0.9); rubble(p, 8);
      sfx.heavySlam(1); G.shake = Math.max(G.shake, 0.8);
      if (dist < 5.5) hurtPlayer(30, new V3(nx * 12, 9, nz * 12));
      e.state = 'recover'; e.t = 0.9;
    }
  } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(0.6, 1.4) / rage; }
  if (e.state === 'rise' || e.state === 'drop') {
    p.x += mx * dt; p.z += mz * dt; enemyCollide(e);
  } else enemyPhysics(e, mx, mz, dt);
  const moving = Math.hypot(mx, mz) > 0.5;
  if (moving) e.walk += dt * (e.state === 'dash' ? 14 : 5);
  const real = e.state;
  if (real === 'stance') e.state = 'windup'; else if (real !== 'windup' && real !== 'recover') e.state = 'chase';
  animateEnemy(e, dt, moving, real === 'stance' ? 0.9 : w, G.time);
  e.state = real;
  applyFlash(e, real === 'stance' ? 0.6 : w);
  if (e.rig.sword) e.rig.sword.rotation.x = real === 'stance' ? -1.4 : 0;
}
function updateKite(e, dt, rage) {
  const p = e.mesh.position, room = e.room;
  const cx = room ? room.cx : 0, cz = room ? room.cz : 0, R = room ? Math.min(room.w, room.d) / 2 - 3 : 12;
  if (!e.anchor) { e.anchor = p.clone(); e.state = 'perch'; e.t = 1.5; }
  const eye = playerEye();
  let w = 0;
  if (e.state === 'perch') {
    p.lerp(e.anchor, 1 - Math.exp(-dt * 8));
    if (e.t <= 0) {
      const r = Math.random();
      if (r < 0.45) { e.state = 'windup'; e.atk = 'soot'; e.wt = e.t = 0.5 / rage; }
      else if (r < 0.75) { e.state = 'windup'; e.atk = 'dive'; e.wt = e.t = 0.45 / rage; sfx.screech(1); }
      else e.state = 'swing';
      if (e.state === 'swing') startSwing(e, cx, cz, R);
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      if (e.atk === 'soot') {
        for (let i = 0; i < (rage > 1 ? 3 : 2); i++) {
          const tgt = P.pos.clone().add(new V3(rand(-2, 2), 0, rand(-2, 2)));
          const fl = 0.9; const v = tgt.sub(p).divideScalar(fl); v.y += 0.5 * 20 * fl;
          spawnOrb(p.clone(), v, 12, { grav: 20, boom: 3, color: 0x2a2a2a });
        }
        sfx.throwCore();
        startSwing(e, cx, cz, R);
      } else { e.state = 'dive'; e.diveDir = eye.clone().sub(p).normalize(); e.t = 1.0; e.hitDone = false; }
    }
  } else if (e.state === 'swing') {
    e.st += dt / (e.dur / rage);
    const t = Math.min(1, e.st);
    const a = e.from, b = e.to;
    p.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 3.5, a.z + (b.z - a.z) * t);
    const bm = enemyBeam(e, 0xc8a070);
    setBeam(bm, p.clone().setY(p.y + 1.2), e.pivotPt, 0.02);
    if (t >= 1) { bm.visible = false; e.anchor = b.clone(); e.state = 'perch'; e.t = rand(0.6, 1.2) / rage; }
  } else if (e.state === 'dive') {
    p.addScaledVector(e.diveDir, dt * 24 * rage);
    if (!e.hitDone && p.distanceTo(new V3(P.pos.x, P.pos.y + 0.9, P.pos.z)) < 1.6) {
      e.hitDone = true;
      if (P.dashT > 0 || P.invuln > 0) addStyle(50, 'DODGE', null, 'cool');
      else hurtPlayer(18, e.diveDir.clone().multiplyScalar(10).setY(5));
    }
    if (e.t <= 0 || p.y < 0.4) { p.y = Math.max(p.y, 0.4); e.state = 'grounded'; e.t = 1.0; sayLine('KITE', Math.random() < 0.5 ? 'Whoops!' : 'Ow, my knees!'); }
  } else if (e.state === 'grounded') {
    p.y = Math.max(0, p.y - dt * 4);
    if (e.t <= 0) startSwing(e, cx, cz, R);
  }
  enemyCollide(e);
  e.grounded = e.state === 'grounded';
  e.mesh.rotation.y = Math.atan2(P.pos.x - p.x, P.pos.z - p.z);
  e.walk += dt * 6;
  const real = e.state;
  e.state = real === 'windup' ? 'windup' : 'chase';
  animateEnemy(e, dt, real === 'swing', w, G.time);
  e.state = real;
  applyFlash(e, w);
}
function startSwing(e, cx, cz, R) {
  const a = Math.random() * Math.PI * 2;
  e.from = e.mesh.position.clone();
  e.to = new V3(cx + Math.cos(a) * R * rand(0.5, 1), rand(4.5, 6.5), cz + Math.sin(a) * R * rand(0.5, 1));
  e.pivotPt = e.from.clone().add(e.to).multiplyScalar(0.5).setY(14);
  e.st = 0; e.dur = 1.2;
  e.state = 'swing';
  sfx.dash();
}
function duelReward(e) {
  const lv = G.level;
  if (!lv || !lv.duel) return;
  if (DUEL_LINES[e.type]) sayLine(e.def.short, DUEL_LINES[e.type].win);
  const id = duelPrize(lv.duel);
  const p = loadProgress();
  p.owned = p.owned || [];
  const fresh = !p.owned.includes(id);
  if (fresh) { p.owned.push(id); saveProgress(p); }
  setTimeout(() => {
    banner(fresh ? prizeBanner(lv.duel) : 'DUEL WON');
    if (fresh && UPGRADE_HINT[lv.duel]) showHint(UPGRADE_HINT[lv.duel]());
    const skinK = lv.duel === 'gold' ? 'gold' : lv.duel.startsWith('skin:') ? lv.duel.slice(5) : null;
    if (fresh && skinK) { settings.skin = skinK; saveSettings(); applySkin(); showHint(`Your guns now wear ${SKINS[skinK].name} · change skins at the FORGE`); }
    if (fresh && ARM_NAMES[lv.duel]) { showHint(`Press ${actLabel('arm')} to switch arms · ${ARM_NAMES[lv.duel]} is now yours`); W.arm = lv.duel; updateArmSlot(); }
  }, 1800);
}

// ================================================================ LEVEL SELECT (difficulty + duels)
function bestKey(lv) { return settings.difficulty === 'normal' ? lv.id : `${lv.id}:${settings.difficulty}`; }
function duelUnlocked(lv, prog) {
  if (lv.skulls) return skullCount(prog) >= TOTAL_SKULLS;
  const idx = LEVELS.findIndex((x) => x.id === lv.unlockAfter);
  return prog.unlocked > idx || (!!lv.orArm && (prog.owned || []).includes(duelPrize(lv.orArm)));
}
function renderLevels() {
  const prog = loadProgress();
  const diffRow = `<div class="diffRow">${Object.entries(DIFFS).map(([k, d]) => `<button data-diff="${k}" class="${settings.difficulty === k ? 'on' : ''}">${d.label}</button>`).join('')}<span>best ranks are kept per difficulty · scrap ×${DIFF().scrap}</span></div>`;
  const card = (l) => {
    const idx = LEVELS.findIndex((x) => x.id === l.id);
    const locked = l.duel ? !duelUnlocked(l, prog) : idx > prog.unlocked;
    const b = prog.best[bestKey(l)];
    const won = l.duel && (prog.owned || []).includes(duelPrize(l.duel));
    return `<button class="lvl ${l.boss ? 'boss' : ''} ${l.duel ? 'duel' : ''}" data-idx="${idx}" ${locked ? 'disabled' : ''}><b>${l.id}${prog.skulls && prog.skulls[l.id] ? ' <u title="skull found">☠</u>' : ''}</b><i>${locked ? (l.duel ? (l.skulls ? `FIND ALL SKULLS (${skullCount(prog)}/${TOTAL_SKULLS})` : 'BEAT ' + l.unlockAfter + (l.orArm ? ' OR THE LAST DUEL' : '')) : 'LOCKED') : l.name}</i>${b ? `<em class="g${GRADE_SHORT[b.rank]}">${GRADE_SHORT[b.rank]}</em><small>BEST ${fmtTime(b.time)}</small>` : ''}${l.duel ? `<small>${won ? 'REWARD EARNED' : 'REWARD: ' + prizeName(l.duel)}</small>` : ''}</button>`;
  };
  $('sceneList').innerHTML = `<div class="scrapLine">◆ ${prog.scrap || 0} SCRAP · spend it at the FORGE in any level's start room</div>` + diffRow +
    SCENES.map((sc) => `<div class="scene"><h3><span>SCENE ${sc.id}</span>${sc.name}</h3><div class="grid">${sc.levels.map(card).join('')}</div></div>`).join('') +
    `<div class="scene"><h3><span>SECRET</span>DUELS</h3><div class="grid">${DUELS.map(card).join('')}</div></div>` +
    `<div class="scene prime"><h3><span>PRIME</span>BOSS REMATCHES</h3><div class="grid">${PRIMES.map(card).join('')}</div></div>` +
    `<div class="scene lore"><h3><span>SECRETS</span>☠ ${skullCount(prog)} / ${TOTAL_SKULLS} SKULLS · LORE ${Object.keys(prog.lore || {}).length} / ${Object.keys(LORE).length}</h3>${Object.keys(LORE).filter((k) => (prog.lore || {})[k]).map((k) => `<p><b>${k}</b> ${LORE[k]}</p>`).join('') || '<p>Cracked walls hide skulls, notes and gun skins. Blow them open.</p>'}</div>`;
  $('sceneList').querySelectorAll('.lvl').forEach((b) => b.addEventListener('click', () => startLevel(Number(b.dataset.idx))));
  $('sceneList').querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => { settings.difficulty = b.dataset.diff; saveSettings(); renderLevels(); }));
}
updateArmSlot();

Object.assign(EPITHETS, { shard: ['DUEL', 'THE STAINED-GLASS SAINT'], bertha: ['DUEL', 'CHAMPION OF THE CELLAR RING'], kite: ['DUEL', 'TERROR OF THE ROOFTOPS'] });
applyVariantLook();

// ================================================================ BATCH 3: KILN HAZARDS
const hazards = [];
function lavaTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b8300a'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 128, y = Math.random() * 128, r = 4 + Math.random() * 16;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const hot = Math.random() < 0.5;
    gr.addColorStop(0, hot ? 'rgba(255,220,90,.95)' : 'rgba(40,8,2,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) { g.save(); g.translate(ox, oy); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function stripeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1612'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#e8b020';
  for (let i = -64; i < 64; i += 16) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 8, 64); g.lineTo(i + 72, 0); g.lineTo(i + 64, 0); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const LAVA_TEX = lavaTexture();
const lavaMat = new THREE.MeshBasicMaterial({ map: LAVA_TEX });
const stripeMat = new THREE.MeshBasicMaterial({ map: stripeTexture() });
const flameColMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const flameGeo = new THREE.ConeGeometry(0.75, 4.2, 10, 1, true);
flameGeo.translate(0, 2.1, 0);
flameGeo.userData.shared = true;
function lavaPlane(x, z, w, d, y = 0.04) {
  const geo = new THREE.PlaneGeometry(w, d);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * d / 3);
  const m = new THREE.Mesh(geo, lavaMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  levelGroup.add(m);
  return m;
}
function hazard(kind, x, z, w, d, o = {}) {
  if (kind === 'lava') {
    const mesh = lavaPlane(x, z, w, d);
    for (const s2 of [-1, 1]) {
      if (w > d) box(x, 0, z + s2 * (d / 2 + 0.15), w, 0.12, 0.3, cobbleMat, 3, false);
      else box(x + s2 * (w / 2 + 0.15), 0, z, 0.3, 0.12, d, cobbleMat, 3, false);
    }
    torches.push({ pos: new V3(x, 0.8, z), flame: new THREE.Object3D(), ph: 0, small: true });
    hazards.push({ kind, x, z, w, d, mesh, dmg: 10, bounce: 12 });
  } else if (kind === 'vent') {
    box(x, 0, z, w, 0.1, d, ironMat, 1, false);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, d * 0.8), new THREE.MeshBasicMaterial({ color: 0x331008 }));
    plate.rotation.x = -Math.PI / 2; plate.position.set(x, 0.11, z);
    levelGroup.add(plate);
    for (let i = -2; i <= 2; i++) box(x + i * w * 0.18, 0.1, z, 0.06, 0.04, d * 0.85, ironDark, 1, false);
    const flame = new THREE.Mesh(flameGeo, flameColMat);
    flame.position.set(x, 0.1, z); flame.visible = false;
    levelGroup.add(flame);
    hazards.push({ kind, x, z, r: 1.1, t: o.phase || 0, plate, flame, hit: false });
  } else if (kind === 'crusher') {
    const top = o.top || 8;
    const base = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, d + 0.6), stripeMat);
    base.rotation.x = -Math.PI / 2; base.position.set(x, 0.03, z);
    levelGroup.add(base);
    const head = new THREE.Group();
    const hm = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), ironDark); hm.position.y = 0.6; hm.castShadow = true;
    head.add(hm);
    for (let i = 0; i < 4; i++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.12, 0.12), ironMat); pl.position.set(0, 0.2 + i * 0.28, d / 2); head.add(pl); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), ironMat); sp.position.set(sx * w * 0.3, -0.12, sz * d * 0.3); sp.rotation.x = Math.PI; head.add(sp); }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 8), ironMat);
    head.add(shaft);
    head.position.set(x, top, z);
    levelGroup.add(head);
    const solid = { min: new V3(x - w / 2, top, z - d / 2), max: new V3(x + w / 2, top + 1.2, z + d / 2), active: false };
    solids.push(solid);
    hazards.push({ kind, x, z, w, d, top, head, shaft, solid, t: o.phase || 0, y: top, slammed: false });
  }
}
function furnace(x, z, side) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 112;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 100, 10, 64, 80, 90);
  gr.addColorStop(0, '#fff0a0'); gr.addColorStop(0.35, '#ff8a20'); gr.addColorStop(1, '#5a1004');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(8, 112); g.lineTo(8, 56); g.arc(64, 56, 56, Math.PI, 0); g.lineTo(120, 112); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.6), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  m.position.set(x, 1.3, z);
  m.rotation.y = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }[side];
  levelGroup.add(m);
  const D = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[side];
  torches.push({ pos: new V3(x + D[0] * 1.2, 1.4, z + D[1] * 1.2), flame: new THREE.Object3D(), ph: Math.random() * 9, small: true });
}
function floodRoom(r) {
  if (!r) return;
  // safe pedestals rise out of the lava (skipped if the player is standing there)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
    const x = r.cx + sx * r.w * 0.28, z = r.cz + sz * r.d * 0.28;
    if (Math.abs(P.pos.x - x) < 2.4 && Math.abs(P.pos.z - z) < 2.4) continue;
    if (overlapBox(x - 1.75, 0.1, z - 1.75, x + 1.75, 1.6, z + 1.75)) continue;
    box(x, 0, z, 3.5, 1.4, 3.5, cobbleMat, 3);
    box(x, 1.4, z, 3.7, 0.15, 3.7, brickMat, 4, false);
    burst(new V3(x, 0.5, z), 14, 0x6a625a, 6, 0.2, 0.7);
  }
  const mesh = lavaPlane(r.cx, r.cz, r.w - 0.4, r.d - 0.4, 0.02);
  mesh.scale.set(0.01, 0.01, 1);
  hazards.push({ kind: 'lava', x: r.cx, z: r.cz, w: r.w - 0.4, d: r.d - 0.4, mesh, dmg: 8, bounce: 8, grow: 0 });
}
function inRect(px, pz, h, pad = 0) { return Math.abs(px - h.x) < h.w / 2 + pad && Math.abs(pz - h.z) < h.d / 2 + pad; }
function updateHazards(dt) {
  LAVA_TEX.offset.x += dt * 0.04; LAVA_TEX.offset.y += dt * 0.025;
  for (const h of hazards) {
    if (h.kind === 'lava') {
      if (h.grow !== undefined && h.grow < 1) { h.grow = Math.min(1, h.grow + dt * 0.4); h.mesh.scale.set(h.grow, h.grow, 1); if (h.grow < 0.6) continue; }
      if (inRect(P.pos.x, P.pos.z, h) && P.pos.y < 0.3 && G.time > (P.lavaT || 0)) {
        P.lavaT = G.time + 0.55;
        if (hurtPlayer(h.dmg, null, true)) { P.vel.y = h.bounce; P.grounded = false; sfx.sizzle(); burst(P.pos.clone().setY(0.2), 10, 0xff8a2a, 6, 0.1, 0.4, true, 0.4); }
      }
      for (const e of enemies) {
        if (e.dead || e.def.fly || e.def.boss || e.spawnT > 0 || e.mesh.position.y > 0.3) continue;
        if (inRect(e.mesh.position.x, e.mesh.position.z, h)) {
          damageEnemy(e, 35 * dt, { weapon: null });
          if (Math.random() < 0.2) spawnPart(e.mesh.position.clone().setY(0.4), new V3(0, 3, 0), 0xff8a2a, 0.1, 0.4, true, -0.1);
          if (e.dead) addStyle(60, 'MELTED', null, 'cool');
        }
      }
    } else if (h.kind === 'vent') {
      h.t += dt;
      const ph = h.t % 4;
      const warn = ph > 2.2 && ph < 3, burn = ph >= 3;
      h.plate.material.color.setHex(burn ? 0xffc060 : warn ? (Math.sin(G.time * 30) > 0 ? 0xff5a10 : 0x8a2008) : 0x331008);
      h.flame.visible = burn;
      if (burn) { h.flame.scale.set(1 + Math.sin(G.time * 40) * 0.1, 0.8 + Math.random() * 0.4, 1 + Math.cos(G.time * 37) * 0.1); h.flame.rotation.y += dt * 6; }
      if (!burn) h.hit = false;
      if (burn && !h.hit) {
        h.hit = true;
        sfx.flame();
        if (Math.hypot(P.pos.x - h.x, P.pos.z - h.z) < h.r + 0.4 && P.pos.y < 4) hurtPlayer(15, new V3(0, 10, 0), true);
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0 || e.def.boss) continue;
          const ep = e.mesh.position;
          if (Math.hypot(ep.x - h.x, ep.z - h.z) < h.r + e.def.r && ep.y < 4) { damageEnemy(e, 45, { weapon: null }); e.burnT = 2; if (e.dead) addStyle(70, 'TORCHED', null, 'cool'); }
        }
      }
      if (burn && Math.random() < 0.5) spawnPart(new V3(h.x + rand(-0.4, 0.4), rand(0.5, 3), h.z + rand(-0.4, 0.4)), new V3(0, 6, 0), 0xffb040, 0.12, 0.3, true, -0.2);
    } else if (h.kind === 'crusher') {
      h.t += dt;
      const ph = h.t % 3.6;
      let y = h.top, shake = 0;
      if (ph < 1.7) y = h.top;
      else if (ph < 2.5) { y = h.top; shake = 0.03 + (ph - 1.7) * 0.06; }
      else if (ph < 2.62) y = h.top * (1 - (ph - 2.5) / 0.12);
      else if (ph < 3.0) y = 0;
      else y = h.top * ((ph - 3.0) / 0.6);
      if (ph < 2.5) h.slammed = false;
      if (ph >= 2.62 && ph < 3.0 && !h.slammed) {
        h.slammed = true;
        sfxAt(new V3(h.x, 0, h.z), 'heavySlam', distVol(new V3(h.x, 0, h.z)));
        G.shake = Math.max(G.shake, 0.4 * distVol(new V3(h.x, 0, h.z)));
        burst(new V3(h.x, 0.2, h.z), 14, 0x6a625a, 8, 0.2, 0.7);
        if (inRect(P.pos.x, P.pos.z, h, PR) && P.pos.y < 1.4) {
          const away = new V3(P.pos.x - h.x, 0, P.pos.z - h.z);
          if (away.lengthSq() < 1e-4) away.set(1, 0, 0);
          away.normalize();
          if (Math.abs(P.pos.x - h.x) / h.w > Math.abs(P.pos.z - h.z) / h.d) P.pos.x = h.x + Math.sign(away.x || 1) * (h.w / 2 + PR + 0.05);
          else P.pos.z = h.z + Math.sign(away.z || 1) * (h.d / 2 + PR + 0.05);
          hurtPlayer(30, away.multiplyScalar(12).setY(6), true);
        }
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0 || e.def.boss) continue;
          const ep = e.mesh.position;
          if (inRect(ep.x, ep.z, h, e.def.r * 0.5) && ep.y < 1.4) { damageEnemy(e, 9999, { weapon: null, knock: new V3(0, -2, 0) }); addStyle(90, 'CRUSHED', null, 'big'); }
        }
      }
      h.y = y;
      h.head.position.set(h.x + (shake ? rand(-shake, shake) : 0), y, h.z + (shake ? rand(-shake, shake) : 0));
      const shaftLen = Math.max(0.1, h.top + 4 - y);
      h.shaft.scale.y = shaftLen; h.shaft.position.y = 1.2 + shaftLen / 2;
      h.solid.min.y = y; h.solid.max.y = y + 1.2;
      h.solid.active = y < 1.6;
    }
  }
}

// ================================================================ SECRETS: skulls, lore notes, gun skins
const secrets = [];
const crackMat = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5a2818'; g.fillRect(0, 0, 256, 256);
  for (let r2 = 0; r2 < 8; r2++) for (let i = -1; i < 4; i++) {
    const x = i * 64 + (r2 % 2) * 32, y = r2 * 32;
    g.fillStyle = `rgb(${110 + Math.random() * 30 | 0},${44 + Math.random() * 14 | 0},${30 + Math.random() * 10 | 0})`;
    g.fillRect(x + 3, y + 3, 58, 26);
  }
  const e = document.createElement('canvas'); e.width = e.height = 256;
  const eg = e.getContext('2d');
  eg.fillStyle = '#000'; eg.fillRect(0, 0, 256, 256);
  eg.strokeStyle = '#ff9a3a'; eg.lineWidth = 3;
  for (let k = 0; k < 5; k++) { eg.beginPath(); let x = 128, y = 128; eg.moveTo(x, y); for (let j = 0; j < 7; j++) { x += (Math.random() - 0.5) * 70; y += (Math.random() - 0.5) * 70; eg.lineTo(x, y); } eg.stroke(); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const em = new THREE.CanvasTexture(e);
  return new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.9 });
})();
function secretWall(x, z, w, d, h, levelId) {
  const mesh = box(x, 0, z, w, h, d, crackMat, 3);
  secrets.push({ mesh, solid: mesh.userData.solid, x, z, levelId, broken: false, pickup: null });
}
function breakSecrets(pos, radius) {
  for (const s2 of secrets) {
    if (s2.broken) continue;
    if (Math.hypot(pos.x - s2.x, pos.z - s2.z) < radius + 1.4 && pos.y < 4.5) breakSecret(s2);
  }
}
function breakSecretsInFront(range) {
  const { origin, dir } = aim();
  let any = false;
  for (const s2 of secrets) {
    if (s2.broken) continue;
    const to = new V3(s2.x, 1.4, s2.z).sub(origin);
    if (to.length() < range + 1.4 && to.normalize().dot(dir) > 0.45) { breakSecret(s2); any = true; }
  }
  return any;
}
function breakSecret(s2) {
  s2.broken = true;
  s2.solid.active = false;
  levelGroup.remove(s2.mesh);
  const wi = worldMeshes.indexOf(s2.mesh);
  if (wi >= 0) worldMeshes.splice(wi, 1);
  const c = new V3(s2.x, 1.4, s2.z);
  rubble(c, 16, 5);
  burst(c, 30, 0x7a3424, 10, 0.25, 1);
  sfx.explode(); sfx.rankUp();
  banner('SECRET!');
  const g = new THREE.Group();
  const bone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, emissive: 0x5a4a20, emissiveIntensity: 0.6, roughness: 0.5, flatShading: true });
  const already = (loadProgress().skulls || {})[s2.levelId];
  if (already) { bone.transparent = true; bone.opacity = 0.35; }
  const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), bone); g.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.3), bone); jaw.position.set(0, -0.3, 0.05); g.add(jaw);
  for (const sx of [-0.12, 0.12]) { const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); eye.position.set(sx, 0.02, 0.29); g.add(eye); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(2.2); g.add(glow);
  g.position.copy(c);
  levelGroup.add(g);
  s2.pickup = g;
}
function updateSecrets(dt) {
  for (const s2 of secrets) {
    if (!s2.pickup) continue;
    s2.pickup.rotation.y += dt * 2;
    s2.pickup.position.y = 1.3 + Math.sin(G.time * 3) * 0.15;
    if (Math.hypot(P.pos.x - s2.x, P.pos.z - s2.z) < 1.8 && Math.abs(P.pos.y + 1 - s2.pickup.position.y) < 2) collectSecret(s2);
  }
}
const TOTAL_SKULLS = LEVELS.filter((l) => !l.duel && !l.race).length;
const skullCount = (p) => Object.keys(p.skulls || {}).length;
const LORE = {
  '0-1': "WORK ORDER #1 · Dig the cellar deep. Deeper than the river. The Foreman wants room for what's coming. · M.",
  '0-2': 'The drains carry more than water. Something mortar-thick crawls up through the grates at night. We stopped asking.',
  '0-4': 'Mortimer used to be one of us. A bricklayer. Then the Foreman offered him a crown and a key to the vault.',
  '1-1': "They built the Cathedral to keep the Kiln's heat down below. Every brick was blessed. Every blessing failed.",
  '1-4': "The High Mason drew plans for a city with no doors. 'Walls,' he said, 'are the only honest prayer.'",
  '1-8': 'Sister Shard swears the stained glass sings when the furnaces below run hot. Lately it never stops singing.',
  '1-10': "The buttresses aren't holding the roof up. They're holding something DOWN.",
  '2-1': 'KILN SAFETY NOTICE · Do not touch the lava. Do not feed the Foreman. Do not let him see you idle.',
  '2-7': 'Kiln No. 7 was meant to fire bricks. The Foreman fires workers now. Same heat. Better walls, he says.',
  '2-11': "If you're reading this, you made it up the stack. He's waiting at the top. Bring something that burns hotter than him.",
};
const SKIN_AT = { '0-3': 'bone', '1-8': 'obsidian', '2-6': 'ember' };
const SKINS = {
  steel: { name: 'STEEL', steel: 0xa8a8b4, dsteel: 0x4a4a56, brass: 0xd0a24a, em: 0x000000 },
  bone: { name: 'BONE', steel: 0xe0d4b8, dsteel: 0x8a7a60, brass: 0x5a4a30, em: 0x000000 },
  obsidian: { name: 'OBSIDIAN', steel: 0x2a2234, dsteel: 0x120e18, brass: 0x8a5ac8, em: 0x1a0a2a },
  ember: { name: 'EMBER', steel: 0x8a3a1a, dsteel: 0x3a1408, brass: 0xffa040, em: 0x5a1a04 },
  gold: { name: 'GILDED', steel: 0xffd060, dsteel: 0xc89a30, brass: 0xfff0b0, em: 0x3a2a00 },
  rust: { name: 'RUSTED', steel: 0x8a4a2a, dsteel: 0x3a1e10, brass: 0xb07a3a, em: 0x0a0300 },
  marble: { name: 'MARBLE', steel: 0xeae6de, dsteel: 0x9a948a, brass: 0x5a8ab0, em: 0x141414 },
  magma: { name: 'MAGMA', steel: 0x2a1410, dsteel: 0x140806, brass: 0xff7a1a, em: 0x8a2604 },
};
function applySkin() {
  const k = SKINS[settings.skin] && (settings.skin === 'steel' || owns('skin_' + settings.skin)) ? settings.skin : 'steel';
  const sk = SKINS[k];
  const M = VM.skinMats;
  M.steel.color.setHex(sk.steel); M.dsteel.color.setHex(sk.dsteel); M.brass.color.setHex(sk.brass);
  for (const mt of [M.steel, M.dsteel]) { mt.emissive.setHex(sk.em); mt.emissiveIntensity = 1; }
}
function collectSecret(s2) {
  levelGroup.remove(s2.pickup);
  s2.pickup = null;
  const p = loadProgress();
  p.skulls = p.skulls || {};
  const fresh = !p.skulls[s2.levelId];
  p.skulls[s2.levelId] = true;
  const skin = SKIN_AT[s2.levelId];
  let skinNew = false;
  if (skin) { p.owned = p.owned || []; if (!p.owned.includes('skin_' + skin)) { p.owned.push('skin_' + skin); skinNew = true; } }
  if (LORE[s2.levelId]) { p.lore = p.lore || {}; p.lore[s2.levelId] = true; }
  saveProgress(p);
  sfx.buy();
  if (fresh) addStyle(200, 'SKULL FOUND', null, 'big');
  const n = skullCount(p);
  showHint(fresh ? `BRICK SKULL ${n} / ${TOTAL_SKULLS}${skinNew ? ` · ${SKINS[skin].name} gun skin unlocked (equip at the FORGE)` : ''}` : 'You already have this skull');
  if (LORE[s2.levelId]) setTimeout(() => showNote(LORE[s2.levelId]), 900);
  if (fresh && n >= TOTAL_SKULLS) setTimeout(() => { banner('ALL SKULLS FOUND'); showHint('A golden DUEL has opened... and the menu remembers an old code.'); }, 2500);
}
let noteT = 0;
function showNote(text) {
  const n = $('note');
  n.querySelector('p').textContent = text;
  n.classList.add('show');
  clearTimeout(noteT);
  noteT = setTimeout(() => n.classList.remove('show'), 8000);
}

// ================================================================ CHEATS (Konami code, needs every skull)
let CHEATS = { bigheads: false, infdash: false, lowgrav: false };
try { CHEATS = Object.assign(CHEATS, JSON.parse(localStorage.getItem('rubblemaker-cheats') || '{}')); } catch (_) {}
const cheatsOn = () => CHEATS.bigheads || CHEATS.infdash || CHEATS.lowgrav;
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let konamiI = 0;
addEventListener('keydown', (e) => {
  konamiI = e.code === KONAMI[konamiI] ? konamiI + 1 : e.code === KONAMI[0] ? 1 : 0;
  if (konamiI < KONAMI.length) return;
  konamiI = 0;
  if (!(G.state === 'menu' || G.state === 'levels')) return;
  if (skullCount(loadProgress()) < TOTAL_SKULLS) {
    $('best').textContent = `The bones rattle... but they are incomplete (${skullCount(loadProgress())} / ${TOTAL_SKULLS} skulls).`;
    return;
  }
  openCheats();
});
function openCheats() {
  const el = $('cheats');
  const row = (k, label) => `<div class="opt"><label>${label}</label><button class="tog ${CHEATS[k] ? 'on' : ''}" data-ch="${k}">${CHEATS[k] ? 'ON' : 'OFF'}</button></div>`;
  el.querySelector('.panel').innerHTML = row('bigheads', 'BIG HEADS (bigger headshot targets)') + row('infdash', 'INFINITE DASH') + row('lowgrav', 'LOW GRAVITY') + '<p class="hint">Cheats stop best ranks from being saved.</p>';
  el.querySelectorAll('[data-ch]').forEach((b) => b.addEventListener('click', () => {
    CHEATS[b.dataset.ch] = !CHEATS[b.dataset.ch];
    try { localStorage.setItem('rubblemaker-cheats', JSON.stringify(CHEATS)); } catch (_) {}
    openCheats();
  }));
  show('cheats', true);
  sfx.rankUp();
}
$('cheatsClose').addEventListener('click', () => show('cheats', false));

// ================================================================ SCENE 1 TRAINERS
function stripLayer(e) {
  e.layers--;
  const ring = e.rig.layerMeshes && e.rig.layerMeshes[e.layers];
  if (ring) ring.visible = false;
  burst(e.mesh.position.clone().setY(2), 24, 0x7ad8ff, 10, 0.12, 0.6, true, 0.3);
  sfx.explode(); fxFlash(0x7ad8ff, 0.2);
  if (e.layers > 0) { banner(`LAYER BROKEN · ${e.layers} LEFT`); addStyle(60, 'LAYER BREAK', null, 'cool'); }
  else { banner('EXPOSED!'); addStyle(120, 'EXPOSED', null, 'big'); e.vulnT = G.time + 5; }
}
function fortressTick(e) {
  if (e.layers === 0 && e.vulnT && G.time > e.vulnT) {
    e.layers = 1; e.vulnT = 0;
    if (e.rig.layerMeshes) e.rig.layerMeshes[0].visible = true;
    banner('SHIELD REFORMED'); sfx.door();
  }
  if (e.rig.layerMeshes) e.rig.layerMeshes.forEach((r2, i) => (r2.rotation.z += 0.02 * (i % 2 ? -1 : 1)));
}
function queenTick(e, dt) {
  e.swarmT = (e.swarmT ?? 1.5) - dt;
  if (e.swarmT <= 0 && enemies.length < 16) {
    e.swarmT = 3.5;
    for (let i = 0; i < 3; i++) makeEnemy('swarmling', e.mesh.position.x + rand(-2, 2), e.mesh.position.z + rand(-2, 2), Math.max(2, e.mesh.position.y + rand(-1, 1)));
    sfx.screech(1);
  }
}

// ================================================================ THE MOLTEN FOREMAN
function updateBoss3(e, dt) {
  const p = e.mesh.position, def = e.def;
  const spd = bossCommon(e);
  if (e.enraged && !e.flooded) { e.flooded = true; floodRoom(e.room); setTimeout(() => banner('THE KILN FLOODS · GET TO HIGH GROUND'), 1200); }
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  const eye = playerEye();
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0;
  if (e.state !== 'breath') e.mesh.rotation.y = Math.atan2(dx, dz);
  if (e.state === 'chase') {
    mx = nx * def.speed * spd; mz = nz * def.speed * spd;
    if (e.cd <= 0) {
      const r = Math.random();
      e.atk = dist < 10 && r < 0.45 ? 'stomp' : r < 0.45 ? 'rain' : r < 0.8 ? 'breath' : 'stomp';
      e.wt = { stomp: 0.9, rain: 0.8, breath: 1.0 }[e.atk] / spd;
      e.state = 'windup'; e.t = e.wt;
      sfx.windup(1);
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      if (e.atk === 'stomp') {
        const c = p.clone();
        shockwave(c, 14 * spd, 40, 25);
        if (e.enraged) setTimeout(() => G.boss === e && shockwave(c, 10, 40, 25), 500);
        ringFx(c, 8, 0xff6a10); burst(c.clone().setY(0.3), 34, 0xff8a2a, 13, 0.3, 1, true, 0.6); rubble(c, 10);
        sfx.heavySlam(1); G.shake = Math.max(G.shake, 0.9);
        if (dist < 8 && P.pos.y - p.y < 2) hurtPlayer(35, new V3(nx * 14, 10, nz * 14));
        e.state = 'recover'; e.t = 1.0 / spd;
      } else if (e.atk === 'rain') {
        const n = e.enraged ? 18 : 12;
        for (let i = 0; i < n; i++) {
          const tx = P.pos.x + rand(-8, 8), tz = P.pos.z + rand(-8, 8);
          setTimeout(() => {
            if (G.boss !== e) return;
            ringFx(new V3(tx, 0.05, tz), 2.4, 0xff4a10);
            spawnOrb(new V3(tx, 16, tz), new V3(0, -4, 0), 15, { grav: 24, boom: 2.6, color: 0xff6a10, big: true });
          }, i * 70);
        }
        sfx.bossRoar();
        e.state = 'recover'; e.t = 1.2 / spd;
      } else {
        e.state = 'breath'; e.t = e.enraged ? 2.6 : 2.0; e.beamTick = 0;
        const from = new V3(); e.rig.head.getWorldPosition(from);
        e.beamDir = eye.clone().sub(from).normalize();
        sfx.flame();
      }
    }
  } else if (e.state === 'breath') {
    const from = new V3(); e.rig.head.getWorldPosition(from);
    const want = eye.clone().sub(from).normalize();
    e.beamDir.lerp(want, Math.min(1, dt * 0.9 * spd)).normalize();
    e.mesh.rotation.y = Math.atan2(e.beamDir.x, e.beamDir.z);
    ray.set(from, e.beamDir); ray.far = 120;
    const hh = ray.intersectObjects(worldMeshes, false)[0];
    const end = hh ? hh.point : from.clone().addScaledVector(e.beamDir, 120);
    const b = enemyBeam(e, 0xff8a2a);
    setBeam(b, from, end, 0.55 + Math.sin(G.time * 40) * 0.1);
    if (Math.random() < 0.7) spawnPart(end.clone(), new V3(rand(-3, 3), rand(2, 6), rand(-3, 3)), 0xffb040, 0.15, 0.5, true, 0.2);
    e.beamTick -= dt;
    const body = new V3(P.pos.x, P.pos.y + 1, P.pos.z);
    if (segDist(body, from, end) < 1.2 && e.beamTick <= 0) {
      if (P.dashT > 0 || P.invuln > 0) { if (!e.dodgedBeam) { e.dodgedBeam = true; addStyle(50, 'DODGE', null, 'cool'); } }
      else if (hurtPlayer(14, null)) e.beamTick = 0.3;
    }
    if (e.t <= 0) { b.visible = false; e.dodgedBeam = false; e.state = 'recover'; e.t = 0.8; }
  } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(1.0, 1.8) / spd; }
  if (e.enraged) { e.summonT -= dt; if (e.summonT <= 0) { e.summonT = 12; summonMinions(e, 'bomber', 2); } }
  enemyPhysics(e, mx, mz, dt);
  const moving = Math.hypot(mx, mz) > 0.5;
  if (moving) e.walk += dt * 3;
  const real = e.state;
  if (real === 'breath') e.state = 'windup';
  animateEnemy(e, dt, moving, real === 'breath' ? 0.4 : w, G.time);
  e.state = real;
  applyFlash(e, w);
}

// ================================================================ wiring for duels / UI
Object.assign(DUEL_LINES, { gilded: { intro: 'Every skull, returned to me. You have earned a real fight.', 75: 'Gold does not dent, little brick.', 50: 'Ha! You shine brighter than I do!', 25: 'Is this... what losing feels like?', win: 'Take my shine. Wear it well.' } });
Object.assign(EPITHETS, {
  boss3: ['SCENE 2 BOSS', 'LORD OF THE KILN'], gilded: ['SECRET DUEL', 'KEEPER OF THE SKULLS'],
  mirror: ['TRAINER', 'LESSON V · THE RICOCHET'], marksman: ['TRAINER', 'LESSON VI · THE COUNTERSNIPE'],
  fortress: ['TRAINER', 'LESSON VII · THE SHIELD BREAK'], queen: ['TRAINER', 'LESSON VIII · THE SWARM'],
});
function renderSkins() {
  const el = $('skinRow');
  if (!el) return;
  const owned = Object.keys(SKINS).filter((k) => k === 'steel' || owns('skin_' + k));
  el.innerHTML = '<b>GUN SKIN</b>' + owned.map((k) => `<button data-skin="${k}" class="${(settings.skin || 'steel') === k ? 'on' : ''}">${SKINS[k].name}</button>`).join('') + `<span>${Object.keys(SKINS).length - owned.length} hidden in secret rooms, duels, PRIME rematches & achievements</span>`;
  el.querySelectorAll('[data-skin]').forEach((b) => b.addEventListener('click', () => { settings.skin = b.dataset.skin; saveSettings(); applySkin(); renderSkins(); }));
}
applySkin();

// ================================================================ BATCH 4·1: CONTROLLER, TOUCH, PRACTICE ROOM
const IS_TOUCH = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
  (navigator.maxTouchPoints > 0 && !(typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches));
function touchActive() { return settings.touchControls === 'on' || (settings.touchControls === 'auto' && IS_TOUCH); }
let lastTouch = 0;
G.input = 'kbm';
function setInput(mode) {
  if (G.input === mode) return;
  if (mode === 'touch' && !touchActive()) return;
  G.input = mode;
  document.body.classList.toggle('touch', mode === 'touch');
  document.body.classList.toggle('pad', mode === 'pad');
  $('resumeBtn').textContent = mode === 'kbm' ? 'CLICK TO RESUME' : 'RESUME';
  if (mode !== 'pad' && navFocus) { navFocus.classList.remove('padfocus'); navFocus = null; }
  renderControls();
  updateArmSlot();
  promptShown = null; PRACTICE.near = undefined; // re-label any open prompt
}
function actLabel(a) {
  if (G.input === 'pad') return padLabel(settings.padBinds[a]);
  if (G.input === 'touch') return ({ interact: 'USE', punch: 'PUNCH', arm: 'ARM', jump: 'JUMP', dash: 'DASH', slide: 'SLIDE', fire: 'FIRE', alt: 'ALT', swap: 'SWAP' })[a] || a.toUpperCase();
  return keyLabel((settings.binds[a] || []).filter(Boolean)[0]);
}
function pauseGame() {
  if (G.state !== 'play') return;
  document.exitPointerLock?.();
  G.state = 'pause';
  show('pause', true);
}

// ---------------------------------------------------------------- gamepad
const PADS = { prev: [], navT: 0, navDir: '', rumbleT: 0 };
function getPad() {
  if (!navigator.getGamepads) return null;
  let any = null;
  for (const p of navigator.getGamepads()) {
    if (!p || !p.connected) continue;
    if (p.mapping === 'standard') return p;
    any = any || p;
  }
  return any;
}
function deadzone(v) {
  const d = settings.padDeadzone, a = Math.abs(v || 0);
  return a < d ? 0 : Math.sign(v) * Math.min(1, (a - d) / (1 - d));
}
const curve = (v) => Math.sign(v) * Math.abs(v) ** 1.7;

function pollInput(dt) {
  VDOWN.clear(); AXIS.x = 0; AXIS.y = 0;
  // touch
  const playing = G.state === 'play';
  const showT = G.input === 'touch' && playing;
  if (tui.classList.contains('hidden') === showT) {
    tui.classList.toggle('hidden', !showT);
    if (!showT) resetTouch();
  }
  if (showT) {
    tui.style.setProperty('--top', settings.touchOpacity);
    for (const a of TOUCH.held.values()) VDOWN.add(a);
    AXIS.x = TOUCH.mx; AXIS.y = TOUCH.my;
    aimPull(dt, TOUCH.looks.size > 0 || VDOWN.has('fire') || Math.hypot(AXIS.x, AXIS.y) > 0.2);
  }
  $('rotate').classList.toggle('hidden', !(G.input === 'touch' && innerHeight > innerWidth && (playing || G.state === 'pause')));
  // pad
  const gp = getPad();
  if (!gp) { PADS.prev = []; return; }
  const now = gp.buttons.map((b) => b.pressed || b.value > 0.45);
  const was = PADS.prev;
  const edge = (i) => !!now[i] && !was[i];
  const ax = gp.axes;
  const lx = deadzone(ax[0]), ly = deadzone(ax[1]), rx = deadzone(ax[2]), ry = deadzone(ax[3]);
  if (now.some((b, i) => b && !was[i]) || Math.hypot(lx, ly) > 0.35 || Math.hypot(rx, ry) > 0.35) setInput('pad');
  if (G.input === 'pad') {
    if (playing) {
      for (const a in settings.padBinds) {
        const b = settings.padBinds[a];
        if (b == null) continue;
        if (now[b]) VDOWN.add(a);
        if (edge(b)) VHIT.add(a);
      }
      AXIS.x = lx; AXIS.y = -ly;
      const fr = aimFriction();
      const cx = curve(rx), cy = curve(ry);
      P.yaw -= cx * 3.4 * settings.padSens * fr * dt;
      P.pitch = clamp(P.pitch - cy * 2.5 * settings.padSens * fr * (settings.padInvert ? -1 : 1) * dt, -1.55, 1.55);
      swayX += cx * 6; swayY += cy * 6;
      aimPull(dt, Math.hypot(lx, ly) + Math.hypot(rx, ry) > 0.1 || VDOWN.has('fire'));
      if (edge(9)) pauseGame();
      rumble(gp, dt);
    } else if (!settingsUI.isCapturing()) padMenu(now, edge, lx, ly, dt);
  }
  PADS.prev = now;
}
function rumble(gp, dt) {
  PADS.rumbleT -= dt;
  const act = gp.vibrationActuator;
  if (!settings.rumble || !act || !act.playEffect || PADS.rumbleT > 0) return;
  const strong = Math.min(1, G.shake * 0.9 + (P.hurtFlash > 0.9 ? 0.6 : 0));
  const weak = Math.min(1, G.shake * 1.2 + (W.kick > 0.4 ? 0.3 : 0));
  if (strong < 0.1 && weak < 0.15) return;
  PADS.rumbleT = 0.09;
  try { act.playEffect('dual-rumble', { duration: 110, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {}); } catch (_) {}
}

// ---- aim assist (pad + touch only): a little friction over targets and a gentle pull
let aimTarget = null;
const aimFwd = new V3();
function findAimTarget() {
  if (!settings.aimAssist || G.input === 'kbm') return null;
  const cp = camera.position;
  aimFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  let best = null;
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0 || e.buried) continue;
    const t = e.mesh.position.clone();
    t.y += e.def.fly ? 0 : e.def.h * 0.62;
    const d = t.clone().sub(cp);
    const len = d.length();
    if (len > 70 || len < 1.2) continue;
    const ang = aimFwd.angleTo(d);
    const lim = 0.05 + 0.07 * settings.aimAssist + Math.atan(e.def.r / len);
    if (ang < lim && (!best || ang < best.ang) && lineOfSight(cp, t)) best = { e, t, ang };
  }
  return best;
}
function aimPull(dt, active) {
  aimTarget = findAimTarget();
  if (!aimTarget || !active) return;
  const d = aimTarget.t.clone().sub(camera.position);
  const yawT = Math.atan2(-d.x, -d.z), pitchT = Math.atan2(d.y, Math.hypot(d.x, d.z));
  let dy = yawT - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const k = Math.min(1, dt * 4.5 * settings.aimAssist);
  P.yaw += dy * k;
  P.pitch += (pitchT - P.pitch) * k * 0.6;
}
function aimFriction() { return aimTarget ? 1 - 0.45 * settings.aimAssist : 1; }

// ---- menu navigation with the pad
let navFocus = null;
function activeScreen() {
  const l = [...document.querySelectorAll('.screen')].filter((s) => !s.classList.contains('hidden') && s.getClientRects().length);
  return l[l.length - 1] || null;
}
function navItems(scr) {
  return [...scr.querySelectorAll('button, input[type=range]')].filter((b) => !b.disabled && b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden');
}
function setNavFocus(el) {
  if (navFocus) navFocus.classList.remove('padfocus');
  navFocus = el;
  if (el) { el.classList.add('padfocus'); try { el.focus({ preventScroll: true }); } catch (_) {} el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}
function navMove(dir, items) {
  const cur = navFocus;
  if (cur.type === 'range' && (dir === 'left' || dir === 'right')) {
    const st = Number(cur.step) || 1, span = Number(cur.max) - Number(cur.min);
    const inc = Math.max(st, Math.round(span / 30 / st) * st);
    cur.value = clamp(Number(cur.value) + (dir === 'right' ? inc : -inc), Number(cur.min), Number(cur.max));
    cur.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const a = cur.getBoundingClientRect();
  const ax0 = a.left + a.width / 2, ay0 = a.top + a.height / 2;
  const V = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  let best = null, bs = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax0, dy = b.top + b.height / 2 - ay0;
    const along = dx * V[0] + dy * V[1];
    if (along <= 4) continue;
    const across = Math.abs(dx * V[1] - dy * V[0]);
    const sc = along + across * 2.2;
    if (sc < bs) { bs = sc; best = el; }
  }
  if (best) { setNavFocus(best); tone(520, 560, 0.04, 0.05, 'square'); }
}
function padBack(scr) {
  if (scr.id === 'settings') { const b = scr.querySelector('.back'); if (b) b.click(); return; }
  const map = { shop: 'shopClose', levels: 'levelsBack', pitRecords: 'pitRecordsBack', codex: 'codexBack', versus: 'vsBack', vsResult: 'vsLobbyBtn', cheats: 'cheatsClose', pause: 'resumeBtn' };
  if (map[scr.id]) $(map[scr.id]).click();
}
function padMenu(now, edge, lx, ly, dt) {
  const scr = activeScreen();
  if (!scr) return;
  // the Konami code works on the D-pad too (B, A at the end)
  for (const [b, code] of [[12, 'ArrowUp'], [13, 'ArrowDown'], [14, 'ArrowLeft'], [15, 'ArrowRight'], [1, 'KeyB'], [0, 'KeyA']]) {
    if (edge(b)) dispatchEvent(new KeyboardEvent('keydown', { code }));
  }
  if (activeScreen() !== scr) return; // the code opened the cheats panel
  const items = navItems(scr);
  if (!items.length) return;
  if (!navFocus || !items.includes(navFocus)) setNavFocus(items[0]);
  let dir = '';
  if (now[12] || ly < -0.5) dir = 'up';
  else if (now[13] || ly > 0.5) dir = 'down';
  else if (now[14] || lx < -0.5) dir = 'left';
  else if (now[15] || lx > 0.5) dir = 'right';
  if (dir) {
    if (dir !== PADS.navDir) { PADS.navDir = dir; PADS.navT = 0.38; navMove(dir, items); }
    else { PADS.navT -= dt; if (PADS.navT <= 0) { PADS.navT = 0.1; navMove(dir, items); } }
  } else PADS.navDir = '';
  if (edge(0) && navFocus && navFocus.type !== 'range') { initAudio(); navFocus.click(); }
  else if (edge(1) || (edge(9) && G.state === 'pause')) padBack(scr);
}

// ---------------------------------------------------------------- touch
const tui = document.createElement('div');
tui.id = 'touchUI';
tui.className = 'hidden';
tui.innerHTML = `<div id="tLook"></div><div id="tStick"><i></i></div>
  <button data-act="fire" class="tb fire">FIRE</button><button data-act="alt" class="tb alt">ALT</button>
  <button data-act="jump" class="tb jump">JUMP</button><button data-act="slide" class="tb slide">SLIDE</button>
  <button data-act="dash" class="tb dash">DASH</button><button data-act="punch" class="tb punch">PUNCH</button>
  <button data-act="swap" class="tb swap">SWAP</button><button data-act="arm" class="tb arm">ARM</button>
  <button data-act="interact" class="tb use">USE</button>
  <button data-act="weapon1" class="tb w w1">1 REV</button><button data-act="weapon2" class="tb w w2">2 SHOT</button><button data-act="weapon3" class="tb w w3">3 NAIL</button><button data-act="weapon4" class="tb w w4">4 BRICK</button>
  <button data-act="pause" class="tb pause">II</button>`;
document.body.appendChild(tui);
const rot = document.createElement('div');
rot.id = 'rotate'; rot.className = 'hidden';
rot.innerHTML = '<b>⟳</b><span>TURN YOUR PHONE SIDEWAYS</span><small>RUBBLEMAKER plays in landscape</small>';
document.body.appendChild(rot);
const stickEl = $('tStick'), knobEl = stickEl.firstElementChild;
const TOUCH = { held: new Map(), looks: new Map(), stick: null, mx: 0, my: 0 };
function resetTouch() {
  TOUCH.held.clear(); TOUCH.looks.clear(); TOUCH.stick = null; TOUCH.mx = TOUCH.my = 0;
  stickEl.classList.remove('on');
  tui.querySelectorAll('.tb.on').forEach((b) => b.classList.remove('on'));
}
function touchLook(t, prev) {
  const k = 0.0052 * settings.touchSens * aimFriction();
  const dx = t.clientX - prev.x, dy = t.clientY - prev.y;
  P.yaw -= dx * k;
  P.pitch = clamp(P.pitch - dy * k, -1.55, 1.55);
  swayX += dx * 0.6; swayY += dy * 0.6;
  prev.x = t.clientX; prev.y = t.clientY;
}
tui.addEventListener('touchstart', (ev) => {
  ev.preventDefault();
  lastTouch = Date.now();
  setInput('touch');
  if (G.state !== 'play') return;
  for (const t of ev.changedTouches) {
    const btn = t.target.closest ? t.target.closest('[data-act]') : null;
    if (btn) {
      const a = btn.dataset.act;
      if (a === 'pause') { pauseGame(); continue; }
      TOUCH.held.set(t.identifier, a);
      VHIT.add(a);
      btn.classList.add('on');
      if (a === 'fire' || a === 'alt') TOUCH.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
    } else if (t.clientX < innerWidth * 0.42 && !TOUCH.stick) {
      TOUCH.stick = { id: t.identifier, x: t.clientX, y: t.clientY };
      stickEl.style.left = t.clientX + 'px'; stickEl.style.top = t.clientY + 'px';
      knobEl.style.transform = '';
      stickEl.classList.add('on');
    } else TOUCH.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
  }
}, { passive: false });
tui.addEventListener('touchmove', (ev) => {
  ev.preventDefault();
  lastTouch = Date.now();
  if (G.state !== 'play') return;
  for (const t of ev.changedTouches) {
    if (TOUCH.stick && t.identifier === TOUCH.stick.id) {
      const R = Math.min(innerWidth, innerHeight) * 0.11;
      let dx = (t.clientX - TOUCH.stick.x) / R, dy = (t.clientY - TOUCH.stick.y) / R;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      TOUCH.mx = Math.abs(dx) < 0.12 ? 0 : dx; TOUCH.my = Math.abs(dy) < 0.12 ? 0 : -dy;
      knobEl.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
    } else if (TOUCH.looks.has(t.identifier)) touchLook(t, TOUCH.looks.get(t.identifier));
  }
}, { passive: false });
function touchEnd(ev) {
  ev.preventDefault();
  lastTouch = Date.now();
  for (const t of ev.changedTouches) {
    if (TOUCH.held.has(t.identifier)) {
      const a = TOUCH.held.get(t.identifier);
      TOUCH.held.delete(t.identifier);
      if (![...TOUCH.held.values()].includes(a)) { const b = tui.querySelector(`[data-act="${a}"]`); if (b) b.classList.remove('on'); }
    }
    TOUCH.looks.delete(t.identifier);
    if (TOUCH.stick && t.identifier === TOUCH.stick.id) { TOUCH.stick = null; TOUCH.mx = TOUCH.my = 0; stickEl.classList.remove('on'); }
  }
}
tui.addEventListener('touchend', touchEnd, { passive: false });
tui.addEventListener('touchcancel', touchEnd, { passive: false });
// any tap on a menu also flips into touch mode (so the first level starts with on-screen controls)
addEventListener('touchstart', () => { lastTouch = Date.now(); setInput('touch'); }, { passive: true });
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement && G.input === 'touch') { try { screen.orientation.lock('landscape').catch(() => {}); } catch (_) {} }
});

// ---------------------------------------------------------------- PRACTICE ROOM
const PRACTICE = { god: false, slots: [], pads: [], hits: [], last: 0, near: undefined, cd: 0, hudT: 0 };
const PRACTICE_PADS = [
  ['grunt', 'GRUNTS', 0xff7a3a], ['shooter', 'SHOOTERS', 0xff7a3a], ['flyer', 'GARGOYLES', 0xff7a3a], ['heavy', 'HEAVY', 0xff7a3a],
  ['shield', 'SHIELDBEARERS', 0xff7a3a], ['sniper', 'SNIPER', 0xff7a3a], ['bomber', 'BOMBERS', 0xff7a3a], ['priest', 'PRIEST', 0xff7a3a],
  ['wave', 'MIXED WAVE', 0xffd04a], ['clear', 'CLEAR ALL', 0x9a9aa8], ['god', 'GOD MODE', 0x4aff6a],
];
function labelTexture(text, color, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(12,6,4,0.82)'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = color; g.lineWidth = 8; g.strokeRect(6, 6, 500, 148);
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 54px Rubik, sans-serif'; g.fillText(text, 256, sub ? 62 : 80);
  if (sub) { g.fillStyle = '#d8c4b0'; g.font = '700 30px Rubik, sans-serif'; g.fillText(sub, 256, 118); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function wallSign(x, y, z, rotY, title, lines) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1a0e09'; g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = '#ff4a1c'; g.lineWidth = 12; g.strokeRect(10, 10, 1004, 492);
  g.fillStyle = '#ff6a3a'; g.font = '900 72px Rubik, sans-serif'; g.textAlign = 'center';
  g.fillText(title, 512, 108);
  g.fillStyle = '#f2e6d8'; g.font = '700 40px Rubik, sans-serif';
  lines.forEach((l, i) => { let fs2 = 40; g.font = `700 ${fs2}px Rubik, sans-serif`; while (g.measureText(l).width > 960 && fs2 > 20) { fs2 -= 2; g.font = `700 ${fs2}px Rubik, sans-serif`; } g.fillText(l, 512, 200 + i * 84); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: t }));
  m.position.set(x, y, z); m.rotation.y = rotY;
  levelGroup.add(m);
}
function buildPractice() {
  const X = 30, Z = 24, H = 12;
  box(0, -1, 0, 2 * X + 4, 1, 2 * Z + 4, floorMat, 3.5);
  box(0, 0, -Z - 1, 2 * X + 4, H, 2, brickMat); box(0, 0, Z + 1, 2 * X + 4, H, 2, brickMat);
  box(-X - 1, 0, 0, 2, H, 2 * Z, brickMat); box(X + 1, 0, 0, 2, H, 2 * Z, brickMat);
  box(0, 0, -Z + 0.2, 2 * X, 1.1, 0.4, cobbleMat, 3); box(0, 0, Z - 0.2, 2 * X, 1.1, 0.4, cobbleMat, 3);
  box(-X + 0.2, 0, 0, 0.4, 1.1, 2 * Z - 0.8, cobbleMat, 3); box(X - 0.2, 0, 0, 0.4, 1.1, 2 * Z - 0.8, cobbleMat, 3);
  // east: steps + a wall-jump shaft up to a high ledge
  box(26, 0, 14, 5, 1.5, 5, cobbleMat, 3);
  box(26, 0, 8.5, 5, 3, 5, cobbleMat, 3);
  box(26, 0, 3, 5, 4.5, 5, cobbleMat, 3);
  box(21.5, 0, -9.5, 1, 10, 7, brickMat);
  box(25.5, 0, -9.5, 1, 10, 7, brickMat);
  box(23.5, 0, -15, 7, 7.5, 4, cobbleMat, 3);
  // west: the Kiln's toys
  hazard('lava', -23, 3, 12, 3.2);
  hazard('vent', -23, 13, 2.2, 2.2, { phase: 0 });
  hazard('crusher', -23, -8, 3, 3, { top: 7, phase: 1 });
  // a few cover blocks between the lanes
  box(-10, 0, 4, 3, 1.4, 1, brickMat); box(10, 0, 4, 3, 1.4, 1, brickMat);
  for (const t of [-18, 0, 18]) { torch(t, 4.5, -Z, 0, 1); torch(t, 4.5, Z, 0, -1); }
  for (const t of [-12, 12]) { torch(-X, 4.5, t, 1, 0); torch(X, 4.5, t, -1, 0); }
  // signs (labels follow whatever you're playing with right now)
  const L = (a) => `[${actLabel(a)}]`;
  wallSign(0, 6, -Z + 0.05, 0, 'TARGET DUMMIES', ['They never fight back, and stand up again when broken.', 'Mix your weapons: FRESH weapons earn more style.', 'Your HIT and DPS show at the top of the screen.']);
  wallSign(-15, 6, -Z + 0.05, 0, 'PARRY & COMBOS', [`${L('punch')} a glowing orb to PARRY it back.`, 'Shotgun FURNACE: ALT lobs a core. Shoot it!', 'Spawn SHOOTERS behind you to practise parries.']);
  wallSign(X - 0.05, 6.5, 8, -Math.PI / 2, 'MOVEMENT', [`${L('jump')} against a wall to WALL JUMP (3 per air).`, `Hold ${L('slide')} while running to SLIDE, jump out fast.`, `${L('slide')} in the air SLAMS · ${L('dash')} has i-frames.`]);
  wallSign(-X + 0.05, 6.5, 3, Math.PI / 2, "THE KILN'S TOYS", [`${L('dash')} across lava: it burns and bounces you.`, 'Vents flicker before they erupt.', 'Crushers shake before they drop. Lure enemies under!']);
  wallSign(0, 6, Z - 0.05, Math.PI, 'SPAWN PADS', [`Stand on a pad and press ${L('interact')}.`, 'Every gun, variant and arm is unlocked in here.', `Press a weapon key again for its variant · ${L('arm')} swaps arms.`]);
  // spawn pads along the south wall
  PRACTICE.pads = PRACTICE_PADS.map(([id, label, col], i) => {
    const x = -26 + i * (52 / (PRACTICE_PADS.length - 1)), z = 20.6;
    box(x, 0, z, 3.2, 0.08, 3.2, ironMat, 1, false);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 }));
    plate.rotation.x = -Math.PI / 2; plate.position.set(x, 0.1, z);
    levelGroup.add(plate);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(label, '#' + col.toString(16).padStart(6, '0'), id === 'god' ? 'OFF' : null), depthWrite: false }));
    spr.position.set(x, 2.4, z); spr.scale.set(3.2, 1, 1);
    levelGroup.add(spr);
    return { id, label, col, x, z, plate, spr, verb: id === 'clear' ? 'CLEAR ALL ENEMIES' : id === 'god' ? 'TOGGLE GOD MODE' : id === 'wave' ? 'SPAWN A MIXED WAVE' : 'SPAWN ' + label };
  });
}
const DUMMY_SPOTS = [['grunt', -12, -12], ['shooter', -6, -12], ['heavy', 0, -13], ['shield', 6, -12], ['priest', 12, -12], ['flyer', -7, -17, 4.5], ['flyer', 7, -17, 4.5]];
function spawnDummy(slot) {
  const e = makeEnemy(slot.type, slot.x, slot.z, slot.y || 0);
  e.dummy = true;
  slot.e = e; slot.t = 0;
}
function updateDummy(e, dt) {
  const p = e.mesh.position;
  const ty = Math.atan2(P.pos.x - p.x, P.pos.z - p.z);
  let d = ty - e.mesh.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  e.mesh.rotation.y += d * Math.min(1, dt * 3);
  if (e.def.fly) {
    p.addScaledVector(e.vel, dt); e.vel.multiplyScalar(Math.exp(-dt * 3));
    const k = Math.min(1, dt * 1.5);
    p.x += (e.home.x - p.x) * k; p.z += (e.home.z - p.z) * k;
    p.y += (e.home.y - 1 + Math.sin(G.time * 1.6 + e.orbit) * 0.35 - p.y) * Math.min(1, dt * 2);
    e.grounded = false;
  } else enemyPhysics(e, (e.home.x - p.x) * 2, (e.home.z - p.z) * 2, dt);
  animateEnemy(e, dt, false, 0, G.time);
  e.flash -= dt;
  applyFlash(e, 0);
}
function practiceHit(e, dmg) {
  PRACTICE.last = dmg;
  PRACTICE.hits.push([G.time, dmg]);
}
function practiceSpawn(type, n) {
  for (let i = 0; i < n; i++) {
    let x = 0, z = 0;
    for (let k = 0; k < 12; k++) { x = rand(-15, 15); z = rand(-6, 6); if (Math.hypot(x - P.pos.x, z - P.pos.z) > 9 && !levelCtx.blocked(x, z)) break; }
    makeEnemy(type, x, z, type === 'flyer' ? rand(4, 5.5) : 0);
  }
}
function padAction(pd) {
  PRACTICE.cd = 0.35;
  sfx.door();
  if (pd.id === 'clear') {
    for (const e of enemies) if (!e.dummy && !e.dead) { e.dead = true; scene.remove(e.mesh); removeEnemyFx(e); for (const mt of [...e.mats, ...e.extraMats]) mt.dispose(); }
    for (const o of orbs) scene.remove(o.m);
    orbs.length = 0;
    G.boss = null; show('bossBar', false); hideBeam();
    banner('CLEARED');
  } else if (pd.id === 'god') {
    PRACTICE.god = !PRACTICE.god;
    pd.spr.material.map.dispose();
    pd.spr.material.map = labelTexture(pd.label, '#4aff6a', PRACTICE.god ? 'ON' : 'OFF');
    banner(PRACTICE.god ? 'GOD MODE ON' : 'GOD MODE OFF');
  } else if (pd.id === 'wave') {
    for (const t of ['grunt', 'grunt', 'shooter', 'flyer', 'heavy', 'bomber']) practiceSpawn(t, 1);
  } else practiceSpawn(pd.id, { heavy: 1, sniper: 1, priest: 1, shield: 2, ram: 1, mender: 1, burrower: 2 }[pd.id] || 3);
}
function updatePractice(dt) {
  for (const slot of PRACTICE.slots) {
    if (slot.e && !slot.e.dead) continue;
    slot.t += dt;
    if (slot.t > 1.5) spawnDummy(slot);
  }
  while (PRACTICE.hits.length && G.time - PRACTICE.hits[0][0] > 3) PRACTICE.hits.shift();
  PRACTICE.hudT -= dt;
  if (PRACTICE.hudT <= 0) {
    PRACTICE.hudT = 0.2;
    const dps = PRACTICE.hits.reduce((s, h) => s + h[1], 0) / 3;
    $('wave').textContent = `PRACTICE · HIT ${Math.round(PRACTICE.last)} · DPS ${Math.round(dps)}${PRACTICE.god ? ' · GOD' : ''}`;
  }
  PRACTICE.cd -= dt;
  let near = null;
  for (const pd of PRACTICE.pads) {
    const on = Math.abs(P.pos.x - pd.x) < 1.7 && Math.abs(P.pos.z - pd.z) < 1.7 && P.pos.y < 1.2;
    pd.plate.material.opacity = on ? 0.65 + Math.sin(G.time * 8) * 0.2 : 0.35;
    if (on) near = pd;
  }
  if (near !== PRACTICE.near) {
    PRACTICE.near = near;
    if (near) $('prompt').textContent = `[${actLabel('interact')}] ${near.verb}`;
    $('prompt').classList.toggle('show', !!near);
  }
  if (near && PRACTICE.cd <= 0 && hit('interact')) padAction(near);
}
function startPractice() {
  initAudio();
  G.mode = 'practice'; G.level = null; G.layout = null;
  resetGame();
  clearLevelGeometry();
  setLook('pit');
  buildPractice();
  G.ceil = 11;
  G.spawn = new V3(0, 0, 16);
  P.pos.copy(G.spawn); P.yaw = 0;
  PRACTICE.god = false; PRACTICE.hits.length = 0; PRACTICE.last = 0; PRACTICE.near = undefined;
  PRACTICE.slots = DUMMY_SPOTS.map(([type, x, z, y]) => ({ type, x, z, y, e: null, t: 0 }));
  for (const s2 of PRACTICE.slots) spawnDummy(s2);
  enterPlay();
  banner('PRACTICE ROOM');
  showHint(`Spawn pads are behind you · press ${actLabel('interact')} on one`);
}
$('practiceBtn').addEventListener('click', startPractice);
if (touchActive()) setInput('touch');

// ================================================================ BATCH 4·2: BRICK LAUNCHER, SWAP CHAINS, NEW ENEMIES, NEW DUELS
var bricks = [], flames = [], RECENT_DEAD = [];
var CHAIN = { n: 0, last: null, t: -9, used: new Set(), arsenal: false };

VARIANTS.push([{ name: 'MORTAR', hex: 0xffd04a, css: '#ffd04a' }, { name: 'LIMPET', hex: 0x4aff3a, css: '#6dff8f' }, { name: 'SKIPSTONE', hex: 0x3ac8ff, css: '#6ad8ff' }]);
SHOP.push(
  { id: 'launcher', gun: 3, v: 0, price: 900, desc: 'Unlocks the BRICK LAUNCHER: lobs a brick that bounces once, then blows into rubble. MORTAR alt-fire splits a cluster brick into 5 bomblets.' },
  { id: 'brick1', gun: 3, v: 1, price: 750, req: 'launcher', desc: 'Launcher variant. Bricks STICK to enemies and walls. ALT detonates every limpet at once.' },
  { id: 'brick2', gun: 3, v: 2, price: 850, req: 'launcher', desc: 'Launcher variant. Flat bricks SKIP across the floor, exploding on every bounce. ALT fires a fan of three.' },
);
sfx.brick = () => { noise(0.22, 700, 0.6, 'lowpass', 90); tone(140, 45, 0.22, 0.45, 'sine'); };
sfx.thunk = (v = 1) => { tone(220, 90, 0.08, 0.12 * v, 'triangle'); };

// ---------------------------------------------------------------- SWAP CHAIN: hit with a different weapon inside 1.1s
const CHAIN_W = new Set(['revolver', 'shotgun', 'nailgun', 'launcher', 'punch', 'blade', 'shock', 'grapple', 'slam']);
function swapChain(info, dmg) {
  const w = info.weapon;
  if (!w || info.dot || !CHAIN_W.has(w)) return dmg;
  const tok = ['punch', 'blade', 'shock', 'grapple', 'slam'].includes(w) ? 'melee' : w;
  if (G.time - CHAIN.t > 1.1) { CHAIN.n = 1; CHAIN.used = new Set([tok]); CHAIN.arsenal = false; CHAIN.last = tok; }
  else if (tok !== CHAIN.last) {
    CHAIN.n++; CHAIN.last = tok; CHAIN.used.add(tok);
    addStyle(10 + CHAIN.n * 12, `SWAP CHAIN ×${CHAIN.n}`, null, CHAIN.n >= 4 ? 'big' : 'cool');
    if (!CHAIN.arsenal && ['revolver', 'shotgun', 'nailgun', 'launcher'].every((k) => CHAIN.used.has(k))) { CHAIN.arsenal = true; addStyle(250, 'FULL ARSENAL', null, 'big'); }
  }
  CHAIN.t = G.time;
  return dmg * (1 + Math.min(0.5, 0.1 * (CHAIN.n - 1)));
}

// ---------------------------------------------------------------- BRICK LAUNCHER
const brickGeo = new THREE.BoxGeometry(0.36, 0.17, 0.18);
const skipGeo = new THREE.BoxGeometry(0.42, 0.08, 0.3);
const bombletGeo = new THREE.BoxGeometry(0.16, 0.1, 0.1);
const brickProjMat = new THREE.MeshStandardMaterial({ color: 0x9a3a24, roughness: 0.85, flatShading: true, emissive: 0x3a0a00, emissiveIntensity: 0.5 });
const limpetProjMat = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.4, flatShading: true, emissive: 0x4aff3a, emissiveIntensity: 0.8 });
const bombletMat = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.6, flatShading: true, emissive: 0xffa02a, emissiveIntensity: 0.8 });
function spawnBrick(kind, pos, vel) {
  const geo = kind === 'bomblet' ? bombletGeo : kind === 'skip' ? skipGeo : brickGeo;
  const m = new THREE.Mesh(geo, kind === 'limpet' ? limpetProjMat : kind === 'bomblet' ? bombletMat : brickProjMat);
  m.position.copy(pos); m.castShadow = true;
  scene.add(m);
  const b = { m, kind, vel: vel.clone(), life: kind === 'limpet' ? 8 : kind === 'bomblet' ? 1.6 : 2.4, bounces: 0, spin: new V3(rand(-12, 12), rand(-12, 12), rand(-12, 12)), stuck: false, stuckE: null, off: null };
  if (kind === 'skip') b.spin.set(0, rand(14, 20), 0);
  bricks.push(b);
  return b;
}
function launchBrick(kind, dir, speed, up) {
  statShot();
  const v = dir.clone().multiplyScalar(speed); v.y += up;
  v.add(new V3(P.vel.x * 0.3, 0, P.vel.z * 0.3));
  if (kind === 'limpet') {
    const lim = bricks.filter((b) => b.kind === 'limpet');
    if (lim.length >= 8) popBrick(bricks.indexOf(lim[0]));
  }
  return spawnBrick(kind, muzzle(), v);
}
function removeBrick(i) { const b = bricks[i]; if (!b) return; scene.remove(b.m); bricks.splice(i, 1); }
function clearBricks() {
  for (const b of bricks) scene.remove(b.m);
  bricks.length = 0;
  for (const f of flames) scene.remove(f.s);
  flames.length = 0;
}
function popBrick(i, hitE) {
  const b = bricks[i];
  if (!b) return;
  const p = b.m.position.clone();
  removeBrick(i);
  if (hitE) {
    damageEnemy(hitE, b.kind === 'bomblet' ? 8 : 20, { weapon: 'launcher', point: p.clone() });
    if (b.kind === 'brick') addStyle(40, 'BRICKED', 'launcher', 'cool');
  }
  if (b.kind === 'brick') { explode(p, 3.6, 60, 'brick'); rubble(p, 5, 4); }
  else if (b.kind === 'cluster') {
    explode(p, 2.6, 25, 'brick');
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + rand(-0.3, 0.3); spawnBrick('bomblet', p.clone().setY(p.y + 0.3), new V3(Math.cos(a) * rand(4, 7), rand(7, 10), Math.sin(a) * rand(4, 7))); }
    addStyle(20, 'CLUSTER', 'launcher');
  } else if (b.kind === 'bomblet') explode(p, 2.5, 28, 'brick');
  else if (b.kind === 'limpet') { explode(p, 3.2, 70, 'brick'); rubble(p, 3, 3); }
  else explode(p, 2.8, 32, 'brick');
}
function detonateLimpets() {
  const idx = [];
  bricks.forEach((b, i) => { if (b.kind === 'limpet') idx.push(i); });
  if (!idx.length) { pushFeed('NO LIMPETS OUT', ''); return; }
  sfx.coin();
  const n = idx.length;
  for (let k = idx.length - 1; k >= 0; k--) popBrick(idx[k]);
  if (n >= 3) addStyle(40 + n * 15, 'DEMOLITION', 'launcher', 'big');
}
function updateLauncher(dt) {
  W.altCD = Math.max(0, W.altCD - dt);
  const v = W.variant[3];
  const { dir } = aim();
  if (down('fire') && W.cd <= 0) {
    if (v === 0) launchBrick('brick', dir, 27, 4.5);
    else if (v === 1) launchBrick('limpet', dir, 32, 3);
    else launchBrick('skip', new V3(dir.x, Math.min(dir.y, 0.12), dir.z).normalize(), 30, 2.5);
    W.cd = v === 1 ? 0.5 : 0.8; W.kick = 1; W.flashT = 0.07;
    sfx.brick(); G.shake = Math.max(G.shake, 0.12);
  }
  if (hit('alt')) {
    if (v === 0 && W.altCD <= 0) { launchBrick('cluster', dir, 24, 6); W.altCD = 2.2; W.cd = Math.max(W.cd, 0.4); W.kick = 1.2; W.flashT = 0.08; sfx.brick(); }
    else if (v === 1) detonateLimpets();
    else if (v === 2 && W.altCD <= 0) {
      const flat = new V3(dir.x, Math.min(dir.y, 0.12), dir.z).normalize();
      for (const a of [-0.22, 0, 0.22]) launchBrick('skip', flat.clone().applyAxisAngle(UP, a), 30, 2.5);
      W.altCD = 2.4; W.cd = Math.max(W.cd, 0.4); W.kick = 1.2; W.flashT = 0.08; sfx.brick();
    }
  }
}
function brickHitsEnemy(p) {
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0 || e.buried) continue;
    const c = e.mesh.position;
    if (Math.hypot(p.x - c.x, p.z - c.z) > e.def.r + 0.3) continue;
    const base = e.def.fly ? c.y - e.def.h * 0.7 : c.y, top = base + e.def.h * (e.def.fly ? 1.4 : 1) + 0.2;
    if (p.y > base - 0.1 && p.y < top) return e;
  }
  return null;
}
function updateBricks(dt) {
  limpetProjMat.emissiveIntensity = 0.6 + Math.sin(G.time * 10) * 0.4;
  for (let i = bricks.length - 1; i >= 0; i--) {
    const b = bricks[i];
    if (!b) continue;
    const p = b.m.position;
    b.life -= dt;
    if (b.stuck) {
      if (b.stuckE) { if (b.stuckE.dead) b.stuckE = null; else p.copy(b.stuckE.mesh.position).add(b.off); }
      if (b.life <= 0) popBrick(i);
      continue;
    }
    b.vel.y -= (b.kind === 'skip' ? 26 : 22) * dt;
    const stepV = b.vel.clone().multiplyScalar(dt);
    p.add(stepV);
    b.m.rotation.x += b.spin.x * dt; b.m.rotation.y += b.spin.y * dt; b.m.rotation.z += b.spin.z * dt;
    const e = brickHitsEnemy(p);
    if (e) {
      if (b.kind === 'limpet') { b.stuck = true; b.stuckE = e; b.off = p.clone().sub(e.mesh.position); damageEnemy(e, 8, { weapon: 'launcher', point: p.clone() }); sfx.thunk(); }
      else if (b.kind === 'skip') { b.bounces++; popBrickInPlace(b, e); if (b.bounces >= 4) removeBrick(i); }
      else popBrick(i, e);
      continue;
    }
    const fy = floorAt(p.x, p.z, p.y + 0.3);
    if (p.y <= fy + 0.09 && b.vel.y < 0) {
      p.y = fy + 0.09;
      if (b.kind === 'limpet') { b.stuck = true; sfx.thunk(0.6); continue; }
      if (b.kind === 'skip') {
        b.bounces++;
        popBrickInPlace(b, null);
        if (b.bounces >= 4) { removeBrick(i); continue; }
        b.vel.y = 7.5; b.vel.x *= 0.93; b.vel.z *= 0.93;
        continue;
      }
      if (b.kind === 'brick' && b.bounces < 1) { b.bounces++; b.vel.y = Math.abs(b.vel.y) * 0.4; b.vel.x *= 0.6; b.vel.z *= 0.6; sfx.thunk(); continue; }
      popBrick(i); continue;
    }
    if (overlapBox(p.x - 0.1, p.y - 0.08, p.z - 0.1, p.x + 0.1, p.y + 0.08, p.z + 0.1)) {
      p.sub(stepV);
      if (b.kind === 'limpet') { b.stuck = true; sfx.thunk(0.6); continue; }
      popBrick(i); continue;
    }
    if (b.life <= 0 || p.y < -20) popBrick(i);
  }
}
// skipstones keep flying after each blast
function popBrickInPlace(b, e) {
  const p = b.m.position.clone();
  if (e) damageEnemy(e, 14, { weapon: 'launcher', point: p.clone() });
  explode(p, 2.4, 24, 'brick');
  if (b.bounces >= 3) addStyle(15, 'SKIP', 'launcher');
}

// ---------------------------------------------------------------- FIRE PATCHES (Cinder's trail + the FIRE DASH)
const flameMatCat = new THREE.SpriteMaterial({ map: GLOW, color: 0xff5a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const flameMatPlayer = new THREE.SpriteMaterial({ map: GLOW, color: 0xffb03a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
function addFlame(x, z, owner, life = 3) {
  while (flames.length > QCAP(35, 60, 80)) { scene.remove(flames[0].s); flames.shift(); }
  const s2 = new THREE.Sprite(owner === 'player' ? flameMatPlayer : flameMatCat);
  const fy = Math.max(0, floorAt(x, z, 20));
  s2.position.set(x, fy + 0.55, z); s2.scale.set(1.5, 1.7, 1);
  scene.add(s2);
  flames.push({ s: s2, x, z, y: fy, life, owner, tick: 0, ph: Math.random() * 9 });
}
function updateFlames(dt) {
  for (let i = flames.length - 1; i >= 0; i--) {
    const f = flames[i];
    f.life -= dt;
    const k = Math.min(1, f.life / 0.6);
    f.s.scale.set((1.4 + Math.sin(G.time * 20 + f.ph) * 0.15) * k, (1.6 + Math.random() * 0.4) * k, 1);
    if (Math.random() < 0.12) spawnPart(new V3(f.x + rand(-0.4, 0.4), f.y + 0.3, f.z + rand(-0.4, 0.4)), new V3(0, 3, 0), 0xffa040, 0.08, 0.4, true, -0.1);
    f.tick -= dt;
    if (f.tick <= 0) {
      f.tick = 0.25;
      if (f.owner === 'cat') {
        if (Math.hypot(P.pos.x - f.x, P.pos.z - f.z) < 1.0 && P.pos.y - f.y < 0.8 && G.time > (P.fireT || 0)) { P.fireT = G.time + 0.5; if (hurtPlayer(7, null, true)) sfx.sizzle(); }
      } else {
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0 || e.buried || e.def.fly) continue;
          const ep = e.mesh.position;
          if (Math.hypot(ep.x - f.x, ep.z - f.z) < 1.1 + e.def.r && ep.y - f.y < 1.5) { damageEnemy(e, 8, { weapon: null, dot: true }); e.burnT = Math.max(e.burnT || 0, 1.5); }
        }
      }
    }
    if (f.life <= 0) { scene.remove(f.s); flames.splice(i, 1); }
  }
}
function fireDashTick(dt) {
  P.fdT = (P.fdT || 0) - dt;
  if (P.fdT <= 0) { P.fdT = 0.035; addFlame(P.pos.x, P.pos.z, 'player', 2.5); }
  P.dashHits = P.dashHits || new Set();
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0 || e.buried || P.dashHits.has(e)) continue;
    const ep = e.mesh.position;
    if (Math.hypot(ep.x - P.pos.x, ep.z - P.pos.z) < e.def.r + 1.0 && Math.abs(ep.y - P.pos.y) < 2.5) {
      P.dashHits.add(e);
      e.burnT = 2.5;
      damageEnemy(e, 25, { weapon: null, point: ep.clone().setY(ep.y + 1) });
      addStyle(35, 'SCORCHED', null, 'cool');
    }
  }
}

// ---------------------------------------------------------------- NEW ENEMIES: RAM, BURROWER, MENDER
Object.assign(DEFS, {
  ram: { hp: 220, speed: 4.6, r: 0.85, h: 2.65, color: 0x7a5a3a, mass: 3, kill: 130, label: 'KILL', ai: 'ram', variantModel: true,
    onKill: (e, info) => { if (e.state === 'stun') addStyle(80, 'MATADOR', info.weapon, 'big'); } },
  burrower: { hp: 90, speed: 6.2, r: 0.5, h: 2.15, color: 0x6a5a48, mass: 1, kill: 90, label: 'KILL', ai: 'burrower', variantModel: true,
    onKill: (e, info) => { if (G.time - (e.unearthT || -9) < 2.5) addStyle(60, 'DUG UP', info.weapon, 'cool'); } },
  mender: { hp: 55, speed: 5.2, r: 0.5, h: 2.2, color: 0x8ab89a, mass: 0.8, kill: 110, label: 'KILL', ai: 'mender', variantModel: true,
    onKill: (e, info) => { addStyle(50, e.link ? 'MALPRACTICE' : 'NO MORE STITCHES', info.weapon, 'cool'); } },
});
Object.assign(ENEMY_INTRO, {
  ram: "RAM · paws the ground, then CHARGES. Sidestep or dash so it slams into a wall, then hit it while it's dazed (+50% damage)",
  burrower: 'BURROWER · tunnels under the floor, so follow the dust. GROUND SLAM near it to dig it out',
  mender: 'MENDER · beams health into its friends and STITCHES fallen ones back to life. Kill it first',
});
function updateNewAI(e, dt) {
  const ai = e.def.ai, p = e.mesh.position, def = e.def;
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0, physics = true;
  const sp = def.speed * DIFF().speed;
  if (ai === 'ram') {
    if (e.state === 'chase') {
      e.mesh.rotation.y = Math.atan2(dx, dz);
      mx = nx * sp; mz = nz * sp;
      if (dist < 2.6 && e.cd <= 0) { e.state = 'butt'; e.t = 0.4; sfxAt(p, 'windup', distVol(p)); }
      else if (dist < 22 && dist > 4.5 && e.cd <= 0 && lineOfSight(p.clone().setY(p.y + 1.4), playerEye())) { e.state = 'windup'; e.t = 0.85; sfxAt(p, 'windup', distVol(p)); }
    } else if (e.state === 'windup') {
      e.mesh.rotation.y = Math.atan2(dx, dz);
      w = 1 - e.t / 0.85;
      if (Math.random() < 0.5) spawnPart(p.clone().setY(p.y + 0.1), new V3(rand(-2, 2), 2.5, rand(-2, 2)), 0x8a7a6a, 0.1, 0.4);
      if (e.t <= 0) { e.state = 'charge'; e.t = 1.7; e.chargeDir = new V3(nx, 0, nz); e.hitDone = false; e.bowled = new Set(); sfx.dash(); }
    } else if (e.state === 'charge') {
      const spd = 22 * DIFF().speed;
      e.mesh.rotation.y = Math.atan2(e.chargeDir.x, e.chargeDir.z);
      if (Math.random() < 0.7) spawnPart(p.clone().setY(p.y + 0.2), new V3(-e.chargeDir.x * 3, 2, -e.chargeDir.z * 3), 0x8a7a6a, 0.12, 0.4);
      if (!e.hitDone && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < def.r + 0.9 && Math.abs(P.pos.y - p.y) < 2) {
        e.hitDone = true;
        if (P.dashT > 0 || P.invuln > 0) addStyle(45, 'OLÉ!', null, 'cool');
        else hurtPlayer(28, e.chargeDir.clone().multiplyScalar(16).setY(8));
      }
      for (const o of enemies) {
        if (o === e || o.dead || o.spawnT > 0 || o.def.boss || o.buried || e.bowled.has(o)) continue;
        if (o.mesh.position.distanceTo(p) < def.r + o.def.r + 0.4) { e.bowled.add(o); damageEnemy(o, 40, { weapon: null, knock: e.chargeDir.clone().multiplyScalar(10).setY(6) }); if (o.dead) addStyle(50, 'BOWLED OVER', null, 'cool'); }
      }
      const before = p.clone();
      enemyPhysics(e, e.chargeDir.x * spd, e.chargeDir.z * spd, dt);
      physics = false;
      const moved = Math.hypot(p.x - before.x, p.z - before.z);
      if (e.t < 1.55 && moved < spd * dt * 0.3) {
        e.state = 'stun'; e.t = 2.4;
        sfxAt(p, 'heavySlam', distVol(p)); G.shake = Math.max(G.shake, 0.35 * distVol(p));
        burst(p.clone().setY(p.y + 1.5).addScaledVector(e.chargeDir, 0.8), 18, 0x8a7a6a, 8, 0.2, 0.8);
        rubble(p.clone().addScaledVector(e.chargeDir, 1), 4, 2);
        breakSecrets(p.clone().addScaledVector(e.chargeDir, 1.2), 2.5);
        addStyle(30, 'WALLED', null, 'cool');
      } else if (e.t <= 0) { e.state = 'recover'; e.t = 0.7; }
    } else if (e.state === 'stun') {
      if (Math.random() < 0.3) spawnPart(p.clone().setY(p.y + def.h * 0.85 + 0.3).add(new V3(Math.cos(G.time * 8) * 0.5, 0, Math.sin(G.time * 8) * 0.5)), new V3(0, 0.5, 0), 0xffe04a, 0.08, 0.3, true, 0);
      if (e.t <= 0) { e.state = 'chase'; e.cd = rand(1.4, 2.4); }
    } else if (e.state === 'butt') {
      w = 1 - e.t / 0.4;
      e.mesh.rotation.y = Math.atan2(dx, dz);
      if (e.t <= 0) { if (dist < 3 && Math.abs(P.pos.y - p.y) < 2) hurtPlayer(16, new V3(nx * 12, 6, nz * 12)); e.state = 'recover'; e.t = 0.5; e.cd = rand(0.8, 1.4); }
    } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(1.0, 2.0); }
  } else if (ai === 'burrower') {
    if (e.state === 'chase' && !e.bInit) { e.bInit = true; e.state = 'surface'; e.t = 1.2; }
    const groundAt = () => { const g = floorAt(p.x, p.z, (e.gy === undefined ? p.y : e.gy) + 1.2); if (g > -10) e.gy = g; return e.gy === undefined ? 0 : e.gy; };
    // a ground slam nearby digs it out
    if (e.buried && G.slamAt && G.time - G.slamAt < 0.1 && G.slamPos && Math.hypot(G.slamPos.x - p.x, G.slamPos.z - p.z) < 7.5) {
      e.buried = false; e.mesh.visible = true; p.y = groundAt(); e.vel.set(0, 9, 0); e.grounded = false;
      e.state = 'stun'; e.t = 1.8; e.unearthT = G.time;
      burst(p.clone().setY(p.y + 0.4), 20, 0x6a5a48, 8, 0.2, 0.7); ringFx(p.clone(), 2.5, 0xffd04a);
      addStyle(40, 'UNEARTHED', 'slam', 'cool');
    }
    if (e.state === 'surface') {
      e.mesh.rotation.y = Math.atan2(dx, dz);
      mx = nx * sp * 0.7; mz = nz * sp * 0.7;
      if (dist < 2.2 && e.cd <= 0) { e.state = 'swipe'; e.t = 0.38; sfxAt(p, 'windup', distVol(p)); }
      else if (e.t <= 0) { e.state = 'dig'; e.t = 0.6; e.gy = p.y; sfx.slamStart(); }
    } else if (e.state === 'swipe') {
      w = 1 - e.t / 0.38;
      if (e.t <= 0) { if (dist < 2.8 && Math.abs(P.pos.y - p.y) < 2) hurtPlayer(14, new V3(nx * 8, 3, nz * 8)); e.state = 'surface'; e.t = Math.max(e.t, 1.2); e.cd = 1.0; }
    } else if (e.state === 'dig') {
      physics = false;
      p.y -= dt * 4.5;
      if (Math.random() < 0.8) spawnPart(p.clone().setY(e.gy + 0.1), new V3(rand(-3, 3), 4, rand(-3, 3)), 0x6a5a48, 0.12, 0.5);
      if (e.t <= 0) { e.buried = true; e.mesh.visible = false; e.state = 'under'; e.t = rand(2.5, 4); }
    } else if (e.state === 'under') {
      physics = false;
      const fy = groundAt();
      p.x += nx * sp * 1.25 * dt; p.z += nz * sp * 1.25 * dt;
      p.y = fy + 0.05; enemyCollide(e); // collide with walls at ground level, not with the floor slab
      p.y = fy - 3;
      if (Math.random() < 0.6) spawnPart(new V3(p.x + rand(-0.4, 0.4), fy + 0.08, p.z + rand(-0.4, 0.4)), new V3(rand(-1, 1), 1.5, rand(-1, 1)), 0x7a6a58, 0.1, 0.5);
      if (dist < 1.6 || e.t <= 0) { e.state = 'crack'; e.t = 0.7; ringFx(new V3(p.x, fy + 0.05, p.z), 2.3, 0xffa040); sfxAt(p, 'windup', distVol(p)); }
    } else if (e.state === 'crack') {
      physics = false;
      const fy = groundAt();
      if (Math.random() < 0.9) spawnPart(new V3(p.x + rand(-1, 1), fy + 0.1, p.z + rand(-1, 1)), new V3(0, rand(2, 5), 0), Math.random() < 0.5 ? 0x7a6a58 : 0xffa040, 0.1, 0.4, Math.random() < 0.3);
      if (e.t <= 0) {
        e.buried = false; e.mesh.visible = true; p.y = fy; e.vel.set(0, 10, 0); e.grounded = false;
        burst(p.clone().setY(fy + 0.3), 26, 0x6a5a48, 11, 0.25, 0.8); rubble(p.clone().setY(fy), 5, 3);
        sfxAt(p, 'heavySlam', distVol(p)); G.shake = Math.max(G.shake, 0.3 * distVol(p));
        if (Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 2.4 && P.pos.y - fy < 1.5) hurtPlayer(24, new V3(nx * 4, 13, nz * 4));
        e.state = 'surface'; e.t = rand(3, 4.5);
      }
    } else if (e.state === 'stun') {
      if (e.t <= 0) { e.state = 'surface'; e.t = 2.5; }
    } else if (e.t <= 0) e.state = 'surface';
  } else if (ai === 'mender') {
    const want = dist < 12 ? -1 : dist > 22 ? 0.6 : 0;
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rand(1.5, 3); }
    mx = (nx * want - nz * e.strafe * 0.7) * sp; mz = (nz * want + nx * e.strafe * 0.7) * sp;
    e.mesh.rotation.y = Math.atan2(dx, dz);
    e.linkT = (e.linkT || 0) - dt;
    if (e.linkT <= 0) {
      e.linkT = 0.4;
      let best = null, bs = 0.97;
      for (const o of enemies) {
        if (o === e || o.dead || o.spawnT > 0 || o.buried || o.def.boss || o.def.ai === 'mender' || o.dummy) continue;
        if (o.mesh.position.distanceTo(p) > 18) continue;
        const f = o.hp / o.maxHp;
        if (f < bs) { bs = f; best = o; }
      }
      e.link = best;
    }
    const tip = new V3();
    (e.rig.staffTip || e.rig.head).getWorldPosition(tip);
    const b = enemyBeam(e, 0x6aff9a);
    if (e.link && !e.link.dead) {
      const o = e.link;
      o.hp = Math.min(o.maxHp, o.hp + 32 * dt);
      const to = o.mesh.position.clone(); to.y += o.def.fly ? 0 : o.def.h * 0.6;
      setBeam(b, tip, to, 0.04 + Math.sin(G.time * 18) * 0.015);
      if (Math.random() < 0.3) spawnPart(to.clone().add(new V3(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4))), new V3(0, 2, 0), 0x6aff9a, 0.08, 0.4, true, -0.1);
      w = 0.3;
    } else if (!(e.reviveFx > 0)) b.visible = false;
    e.reviveFx = (e.reviveFx || 0) - dt;
    e.reviveT = (e.reviveT === undefined ? 5 : e.reviveT) - dt;
    if (e.reviveT <= 0) {
      e.reviveT = 2;
      for (let i = RECENT_DEAD.length - 1; i >= 0; i--) {
        const d = RECENT_DEAD[i];
        if (G.time - d.t > 9 || G.time < d.t) { RECENT_DEAD.splice(i, 1); continue; }
        if (Math.hypot(d.x - p.x, d.z - p.z) > 20) continue;
        RECENT_DEAD.splice(i, 1);
        const n = makeEnemy(d.type, d.x, d.z, d.type === 'flyer' ? 4.5 : 0);
        n.room = e.room;
        setBeam(b, tip, new V3(d.x, 1, d.z), 0.08); e.reviveFx = 0.4;
        ringFx(new V3(d.x, 0.2, d.z), 2.5, 0x6aff9a);
        pushFeed('STITCHED BACK TOGETHER', 'bad');
        e.reviveT = 9;
        break;
      }
    }
  }
  if (physics) enemyPhysics(e, mx, mz, dt);
  const moving = Math.hypot(mx, mz) > 0.5 && e.grounded;
  if (moving) e.walk += dt * def.speed * 1.6;
  const real = e.state;
  if (real === 'charge') { e.state = 'chase'; e.walk += dt * 14; }
  else if (real === 'butt' || real === 'swipe' || real === 'crack') e.state = 'windup';
  animateEnemy(e, dt, moving || real === 'charge', w, G.time);
  e.state = real;
  e.flash -= dt;
  applyFlash(e, w);
}

// ---------------------------------------------------------------- DUEL PRIZES
function duelPrize(d) { return d.startsWith('skin:') ? 'skin_' + d.slice(5) : d === 'gold' ? 'skin_gold' : d === 'djump' || d === 'firedash' ? 'up_' + d : 'arm_' + d; }
function prizeName(d) { return d.startsWith('skin:') ? SKINS[d.slice(5)].name + ' GUN SKIN' : d === 'gold' ? 'GILDED GUN SKIN' : d === 'djump' ? 'DOUBLE JUMP' : d === 'firedash' ? 'FIRE DASH' : ARM_NAMES[d] + ' ARM'; }
function prizeBanner(d) { return d.startsWith('skin:') ? SKINS[d.slice(5)].name + ' SKIN UNLOCKED' : d === 'gold' ? 'GILDED SKIN UNLOCKED' : d === 'djump' || d === 'firedash' ? `NEW MOVE: ${prizeName(d)}` : `NEW ARM: ${ARM_NAMES[d]}`; }
const UPGRADE_HINT = {
  djump: () => `DOUBLE JUMP: press ${actLabel('jump')} again in mid-air (away from walls)`,
  firedash: () => `FIRE DASH: your ${actLabel('dash')} now leaves a blazing trail and scorches anything you pass through`,
};

// ---------------------------------------------------------------- TUMBLE & TWIRL, THE TWIN ACROBATS
Object.assign(DEFS, {
  tumble: { hp: 1100, speed: 9, r: 0.55, h: 2.4, color: 0xd83a2a, mass: 25, kill: 400, label: 'DUEL WON', boss: true, duelist: true, twin: true, name: 'TUMBLE & TWIRL, THE TWIN ACROBATS', short: 'TUMBLE' },
  twirl: { hp: 1100, speed: 9, r: 0.55, h: 2.4, color: 0x2a6ad8, mass: 25, kill: 400, label: 'DUEL WON', boss: true, duelist: true, twin: true, name: 'TUMBLE & TWIRL, THE TWIN ACROBATS', short: 'TWIRL' },
  cat: { hp: 2600, speed: 11, r: 1.3, h: 2.6, color: 0xff6a1a, mass: 50, kill: 900, label: 'DUEL WON', boss: true, duelist: true, cat: true, name: 'CINDER, THE KILN-CAT', short: 'CINDER' },
});
Object.assign(DUEL_LINES, {
  tumble: { intro: 'Ladies and gentlebricks! The amazing TUMBLE...', 75: 'Hup! Hah! Too slow!', 50: 'Twirl! Do the thing! THE THING!', 25: 'This is not in the routine!', win: 'Bravo... bravo. Take our bounce. You earned it.' },
  twirl: { intro: '...and the astonishing TWIRL! Please hold your applause!', 75: 'Ooh, that one stung!', 50: 'Tumble, catch me!', 25: 'I think I pulled something...', win: 'Our best audience ever. Keep the double jump!' },
  cat: { intro: 'Mrrrrow. Another brick-thing in MY kiln?', 75: 'Hsss! You singed my whiskers!', 50: 'Okay. ZOOMIES TIME.', 25: '...I am NOT tired. *yawn*', win: 'Fine. FINE. Take my fire. ...Scratch behind the ears? No? Okay.' },
});
Object.assign(EPITHETS, { tumble: ['SECRET DUEL', 'STARS OF THE KILN CIRCUS'], twirl: ['SECRET DUEL', 'STARS OF THE KILN CIRCUS'], cat: ['SECRET DUEL', 'QUEEN OF THE WARM BRICKS'] });
function spawnTwins(room) {
  const a = makeEnemy('tumble', room.cx - 4, room.cz);
  const b = makeEnemy('twirl', room.cx + 4, room.cz);
  a.room = b.room = room; a.sib = b; b.sib = a; b.strafe = -a.strafe; b.orbit = a.orbit + Math.PI;
  G.boss = a;
  $('bossName').textContent = a.def.name;
  show('bossBar', true);
  showIntro('tumble');
  setTimeout(() => { if (G.boss && G.boss.def.twin) showHint('Two acrobats, one health bar · beat BOTH, and watch out: the survivor gets FURIOUS'); }, 2400);
  sfx.bossRoar();
  G.shake = Math.max(G.shake, 0.6);
}
function twinDown(e) {
  const s2 = e.sib;
  G.boss = s2;
  killCam(0.9, 0.2);
  G.hitstop = 0.25;
  banner(`${e.def.short} IS DOWN`);
  sayLine(s2.def.short, s2.type === 'tumble' ? 'TWIRL?! Oh, you are in SO much trouble!' : 'TUMBLE!! Nobody squashes my brother!');
  s2.state = 'chase'; s2.cd = 0.6;
}
function startLeap(e, target, vy, stage) {
  const T = (2 * vy) / 30;
  const p = e.mesh.position;
  e.lv = new V3((target.x - p.x) / T, 0, (target.z - p.z) / T);
  const hs = Math.hypot(e.lv.x, e.lv.z);
  if (hs > 26) e.lv.multiplyScalar(26 / hs);
  e.vy = vy; e.state = 'air'; e.vaultStage = stage || 0;
  e.grounded = false;
  sfx.jump();
}
function updateTwin(e, dt, rage0) {
  const p = e.mesh.position, def = e.def;
  const sibAlive = !!(e.sib && !e.sib.dead);
  const rage = sibAlive ? rage0 : 1.45;
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0, air = false;
  const sp = def.speed * rage * DIFF().speed;
  if (e.state !== 'air' && e.state !== 'wheel') e.mesh.rotation.y = Math.atan2(dx, dz);
  if (e.state === 'air') {
    air = true;
    e.vy -= 30 * dt;
    p.x += e.lv.x * dt; p.z += e.lv.z * dt; p.y += e.vy * dt;
    e.mesh.rotation.x += dt * (e.vaultStage === 2 ? 9 : 13);
    enemyCollide(e);
    const fy = enemyFloor(e);
    if (e.vy < 0 && p.y <= fy) {
      p.y = fy; e.mesh.rotation.x = 0; e.grounded = true;
      if (e.vaultStage === 1 && sibAlive) {
        startLeap(e, P.pos.clone().addScaledVector(P.vel, 0.3), 19, 2);
        sayLine(def.short, 'ALLEY-OOP!');
        e.sib.state = 'recover'; e.sib.t = 0.4;
      } else {
        const big = e.vaultStage === 2;
        shockwave(p.clone(), big ? 15 : 12, big ? 16 : 10, big ? 24 : 15, false);
        ringFx(p.clone(), big ? 5 : 3, 0xffd04a);
        burst(p.clone().setY(p.y + 0.3), 16, 0x8a7a6a, 9, 0.2, 0.7);
        sfxAt(p, 'heavySlam', distVol(p));
        G.shake = Math.max(G.shake, big ? 0.6 : 0.3);
        if (Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < (big ? 4.5 : 3) && P.pos.y - p.y < 1.5) hurtPlayer(big ? 26 : 18, new V3(nx * 10, 8, nz * 10));
        e.vaultStage = 0; e.state = 'recover'; e.t = big ? 0.9 : 0.45;
      }
    }
  } else if (e.state === 'chase') {
    e.orbit += dt * 0.9 * e.strafe * rage;
    const tx = P.pos.x + Math.cos(e.orbit) * 9 - p.x, tz = P.pos.z + Math.sin(e.orbit) * 9 - p.z;
    const tl = Math.hypot(tx, tz) || 1;
    const spd = Math.min(sp, tl * 3);
    mx = (tx / tl) * spd; mz = (tz / tl) * spd;
    if (e.cd <= 0) {
      if (sibAlive && rage0 === 1 && e.sib.state !== 'chase' && e.sib.state !== 'recover') e.cd = 0.4; // take turns
      else {
        const r = Math.random();
        if (sibAlive && e.type === 'tumble' && e.sib.state === 'chase' && r < 0.25) {
          e.atk = 'vault'; e.state = 'windup'; e.wt = e.t = 0.3;
          e.sib.state = 'brace'; e.sib.t = 1.6;
          sayLine(e.sib.def.short, 'Up you go!');
        } else {
          e.atk = r < 0.45 ? 'leap' : r < 0.75 ? 'pins' : 'wheel';
          e.state = 'windup'; e.wt = e.t = { leap: 0.35, pins: 0.4, wheel: 0.35 }[e.atk] / rage;
        }
        sfx.windup(1);
      }
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      if (e.atk === 'vault' && sibAlive) startLeap(e, e.sib.mesh.position.clone(), 9, 1);
      else if (e.atk === 'leap' || e.atk === 'vault') startLeap(e, P.pos.clone().addScaledVector(P.vel, 0.35), 12, 0);
      else if (e.atk === 'pins') {
        const head = new V3(); e.rig.head.getWorldPosition(head);
        for (let i = -1; i <= 1; i++) {
          const tgt = P.pos.clone().add(new V3(i * 2.2, 0, rand(-1, 1)));
          const fl = 0.9;
          const v = tgt.sub(head).divideScalar(fl); v.y += 0.5 * 20 * fl;
          spawnOrb(head.clone(), v, 12, { grav: 20, color: i ? 0xffd04a : def.color });
        }
        sfx.throwCore();
        e.state = 'recover'; e.t = 0.5;
      } else { e.state = 'wheel'; e.t = 0.8; e.dashDir = new V3(nx, 0, nz); e.hitDone = false; sfx.dash(); }
    }
  } else if (e.state === 'wheel') {
    mx = e.dashDir.x * 21 * rage; mz = e.dashDir.z * 21 * rage;
    e.mesh.rotation.y = Math.atan2(e.dashDir.x, e.dashDir.z);
    e.mesh.rotation.z += dt * 16;
    if (!e.hitDone && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < def.r + 1.2 && P.pos.y - p.y < 2.5) {
      e.hitDone = true;
      if (P.dashT > 0 || P.invuln > 0) addStyle(50, 'DODGE', null, 'cool');
      else hurtPlayer(18, e.dashDir.clone().multiplyScalar(12).setY(6));
    }
    if (e.t <= 0) { e.mesh.rotation.z = 0; e.state = 'recover'; e.t = 0.5; }
  } else if (e.state === 'brace') {
    w = 0.5;
    if (e.t <= 0) e.state = 'chase';
  } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(0.7, 1.5) / rage; }
  if (!air) enemyPhysics(e, mx, mz, dt);
  const moving = Math.hypot(mx, mz) > 0.5;
  if (moving) e.walk += dt * 9;
  const real = e.state;
  e.state = real === 'windup' || real === 'brace' ? 'windup' : real === 'recover' ? 'recover' : 'chase';
  animateEnemy(e, dt, moving || air, w, G.time);
  e.state = real;
  applyFlash(e, w);
}

// ---------------------------------------------------------------- CINDER, THE KILN-CAT
function catLeap(e, target, vy) {
  const T = (2 * vy) / 30, p = e.mesh.position;
  e.lv = new V3((target.x - p.x) / T, 0, (target.z - p.z) / T);
  const hs = Math.hypot(e.lv.x, e.lv.z);
  if (hs > 30) e.lv.multiplyScalar(30 / hs);
  e.vy = vy; e.state = 'air'; e.grounded = false;
  sfx.screech(1);
}
function updateCat(e, dt, rage0) {
  const p = e.mesh.position, def = e.def;
  const rage = e.napped ? 1.35 : rage0;
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0, crouch = 0, air = false;
  const sp = def.speed * rage * DIFF().speed;
  const room = e.room, cx = room ? room.cx : p.x, cz = room ? room.cz : p.z;
  const face = (x, z) => { let d = Math.atan2(x, z) - e.mesh.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); e.mesh.rotation.y += d * Math.min(1, dt * 10); };
  if (!e.napped && e.hp < e.maxHp * 0.3 && e.state !== 'air') { e.napped = true; e.state = 'stun'; e.t = 3; sayLine(def.short, '...mrrr... just... five minutes... *purrrr*'); }
  e.trailT = (e.trailT || 0) - dt;
  if (e.state === 'chase') {
    e.orbit += dt * 0.75 * e.strafe * rage;
    const tx = P.pos.x + Math.cos(e.orbit) * 11 - p.x, tz = P.pos.z + Math.sin(e.orbit) * 11 - p.z;
    const tl = Math.hypot(tx, tz) || 1;
    mx = (tx / tl) * sp; mz = (tz / tl) * sp;
    face(mx, mz);
    if (e.trailT <= 0) { e.trailT = 0.22; addFlame(p.x, p.z, 'cat', 3.2); }
    if (e.cd <= 0) {
      const r = Math.random();
      if (dist < 5) { e.state = 'windup'; e.atk = 'swipe'; e.wt = e.t = 0.32; }
      else if (r < 0.45) { e.state = 'crouch'; e.wt = e.t = 0.6 / rage; }
      else if (r < 0.75) { e.state = 'windup'; e.atk = 'spit'; e.wt = e.t = 0.45; }
      else { e.state = 'zoom'; e.t = 2.4; e.zoomA = Math.atan2(p.z - cz, p.x - cx); sayLine(def.short, Math.random() < 0.5 ? 'NYOOOM!' : 'Can\'t catch me!'); }
    }
  } else if (e.state === 'crouch') {
    face(dx, dz);
    crouch = 1 - e.t / e.wt; w = crouch;
    if (e.t <= 0) catLeap(e, P.pos.clone().addScaledVector(P.vel, 0.4), 11);
  } else if (e.state === 'air') {
    air = true;
    e.vy -= 30 * dt;
    p.x += e.lv.x * dt; p.z += e.lv.z * dt; p.y += e.vy * dt;
    face(e.lv.x, e.lv.z);
    enemyCollide(e);
    if (!e.hitDone && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < def.r + 0.8 && Math.abs(P.pos.y + 0.9 - (p.y + 1.3)) < 1.6) {
      e.hitDone = true;
      if (P.dashT > 0 || P.invuln > 0) addStyle(50, 'DODGE', null, 'cool'); else hurtPlayer(22, new V3(nx * 12, 8, nz * 12));
    }
    const fy = enemyFloor(e);
    if (e.vy < 0 && p.y <= fy) {
      p.y = fy; e.grounded = true; e.hitDone = false;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; addFlame(p.x + Math.cos(a) * 2, p.z + Math.sin(a) * 2, 'cat', 3); }
      ringFx(p.clone(), 3.5, 0xff6a1a); burst(p.clone().setY(p.y + 0.3), 20, 0xff8a2a, 9, 0.15, 0.6, true, 0.4);
      sfxAt(p, 'heavySlam', distVol(p)); G.shake = Math.max(G.shake, 0.35);
      if (Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 3.6 && P.pos.y - p.y < 1.5) hurtPlayer(20, new V3(nx * 12, 8, nz * 12));
      if (rage > 1 && !e.second) { e.second = true; e.state = 'crouch'; e.wt = e.t = 0.3; }
      else { e.second = false; e.state = 'recover'; e.t = 0.8; }
    }
  } else if (e.state === 'windup') {
    face(dx, dz);
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      if (e.atk === 'spit') {
        const head = new V3(); e.rig.head.getWorldPosition(head);
        const eye = playerEye();
        const n = rage > 1 ? 5 : 3;
        const base = Math.atan2(eye.x - head.x, eye.z - head.z), dy = (eye.y - 0.3 - head.y) / Math.max(1, dist);
        for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.16; spawnOrb(head.clone(), new V3(Math.sin(a), dy, Math.cos(a)).normalize().multiplyScalar(20), 12, { color: 0xff6a1a }); }
        sfx.flame();
      } else {
        burst(p.clone().setY(p.y + 1.2).add(new V3(nx * 2, 0, nz * 2)), 12, 0xffd0a0, 8, 0.06, 0.25, true, 0);
        if (dist < def.r + 3.2 && Math.abs(P.pos.y - p.y) < 2.5) hurtPlayer(22, new V3(nx * 13, 6, nz * 13));
        sfx.whiff();
      }
      e.state = 'recover'; e.t = 0.5;
    }
  } else if (e.state === 'zoom') {
    e.zoomA += dt * 1.7 * rage;
    const R = room ? Math.min(room.w, room.d) / 2 - 4 : 12;
    const tx = cx + Math.cos(e.zoomA) * R - p.x, tz = cz + Math.sin(e.zoomA) * R - p.z;
    const tl = Math.hypot(tx, tz) || 1;
    mx = (tx / tl) * 20 * rage; mz = (tz / tl) * 20 * rage;
    face(mx, mz);
    if (e.trailT <= 0) { e.trailT = 0.08; addFlame(p.x, p.z, 'cat', 3.5); }
    if (!e.hitDone && dist < def.r + 1) { e.hitDone = true; if (P.dashT > 0 || P.invuln > 0) addStyle(40, 'DODGE', null, 'cool'); else hurtPlayer(15, new V3(mx * 0.5, 6, mz * 0.5)); }
    if (e.t <= 0) { e.hitDone = false; e.state = 'crouch'; e.wt = e.t = 0.45; }
  } else if (e.state === 'stun') {
    crouch = 1.3;
    if (Math.random() < 0.04) spawnPart(p.clone().setY(p.y + 2.4), new V3(0.3, 1, 0), 0xd8e0ff, 0.12, 1.2, true, -0.05);
    if (e.t <= 0) { e.state = 'chase'; e.cd = 0.5; sayLine(def.short, 'HSSSS! Who woke me?!'); }
  } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(0.8, 1.6) / rage; }
  if (!air) enemyPhysics(e, mx, mz, dt);
  animateCat(e, dt, Math.hypot(mx, mz), crouch, air);
  e.flash -= dt;
  applyFlash(e, w);
}
function animateCat(e, dt, spd, crouch, air) {
  const r = e.rig;
  e.walk += dt * spd * 0.9;
  const sw = spd > 0.5 ? Math.sin(e.walk) : 0, amp = Math.min(1, spd / 10) * 0.8;
  const [FL, FR, BL, BR] = r.legs;
  const k = 1 - Math.exp(-dt * 16);
  const set = (o, v) => { o.rotation.x += (v - o.rotation.x) * k; };
  if (air) { set(FL, -1.0); set(FR, -1.0); set(BL, 0.9); set(BR, 0.9); }
  else if (crouch > 1) { set(FL, -1.3); set(FR, -1.3); set(BL, 1.3); set(BR, 1.3); }
  else { set(FL, sw * amp - crouch * 0.5); set(BR, sw * amp + crouch * 0.6); set(FR, -sw * amp - crouch * 0.5); set(BL, -sw * amp + crouch * 0.6); }
  const by = 1.35 - Math.min(1, crouch) * 0.45 - (crouch > 1 ? 0.35 : 0) + (spd > 0.5 && !air ? Math.abs(Math.sin(e.walk)) * 0.08 : 0);
  r.body.position.y += (by - r.body.position.y) * k;
  r.body.rotation.x += ((air ? -0.15 : Math.min(1, crouch) * 0.12) - r.body.rotation.x) * k;
  r.tail.forEach((t, i) => { t.rotation.y = Math.sin(G.time * (crouch > 0.3 && crouch <= 1 ? 9 : 3) + i * 0.7) * (0.25 + Math.min(1, crouch) * 0.3); t.rotation.x = i === 0 ? -0.5 : -0.1; });
  r.head.rotation.x += ((crouch > 1 ? 0.4 : Math.min(1, crouch) * 0.2) - r.head.rotation.x) * k;
  r.jaw.rotation.x = e.state === 'windup' ? 0.5 : 0.05;
}

// ---------------------------------------------------------------- practice pads for the new enemies
PRACTICE_PADS.splice(8, 0, ['ram', 'RAM', 0xff7a3a], ['burrower', 'BURROWERS', 0xff7a3a], ['mender', 'MENDER', 0xff7a3a]);
applyVariantLook();

// ================================================================ BATCH 4.3: KILN TRAINERS
Object.assign(DEFS, {
  anvil: { hp: 560, speed: 2.7, r: 1.3, h: 4.0, color: 0x3a3a44, mass: 50, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE ANVIL · TRAINER', short: 'THE ANVIL', hint: 'Bullets ring off THE ANVIL · switch to the BLADE arm and cut him up close', canHurt: (i) => i.weapon === 'blade' || !owns('arm_blade') },
  bellows: { hp: 650, speed: 2.4, r: 1.5, h: 4.2, color: 0x6a4028, mass: 50, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE BELLOWS · TRAINER', short: 'THE BELLOWS', hint: 'Only a CHARGED SHOCKWAVE cracks THE BELLOWS · hold the SHOCKWAVE fist to 3+ bars, then let go up close', canHurt: (i) => (i.weapon === 'shock' && (i.charge || 0) >= 0.6) || !owns('arm_shock') },
  crane: { hp: 450, speed: 9, r: 1.4, h: 2.4, color: 0x2a2a30, mass: 30, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, fly: true, name: 'THE CRANE · TRAINER', short: 'THE CRANE', hint: 'THE CRANE is out of reach · GRAPPLE it to drag it to the ground, then unload', canHurt: (i, e) => !owns('arm_grapple') || !!(e && (e.state === 'perch' || e.mesh.position.y < 1.2)) },
});
Object.assign(EPITHETS, {
  anvil: ['TRAINER', 'LESSON IX · THE BLADE'],
  bellows: ['TRAINER', 'LESSON X · THE CHARGED SHOCKWAVE'],
  crane: ['TRAINER', 'LESSON XI · THE GRAPPLE'],
});
function craneYank(e) {
  const p = e.mesh.position;
  e.state = 'dive'; e.yanked = true; e.hitDone = true;
  e.diveTarget = new V3(p.x + (P.pos.x - p.x) * 0.45, 0, p.z + (P.pos.z - p.z) * 0.45);
  e.flash = 0.1;
  addStyle(90, 'DRAGGED DOWN', 'grapple', 'big');
  sfx.screech(1);
}

// ================================================================ BATCH 4.3: PRIME BOSSES
const PRIME_MINIONS = { boss1: ['shield', 'grunt'], boss2: ['sniper', 'shooter'], boss3: ['bomber', 'heavy'] };
function makePrime(e) {
  e.prime = true;
  e.maxHp *= 1.4; e.hp = e.maxHp;
  e.novaT = 4;
  for (const mt of e.mats) {
    if (!mt.userData || mt.userData.baseEmissive) continue;
    mt.userData.baseEmissive = 0x6a0a04;
    mt.userData.baseIntensity = 0.75;
  }
  e.mesh.scale.multiplyScalar(1.08); e.baseScale *= 1.08;
}
function primeTick(e, dt) {
  if (e.spawnT > 0) return;
  if (!e.fury && e.hp < e.maxHp * 0.3) {
    e.fury = true;
    banner(`${e.def.short} PRIME · FURY`);
    sfx.bossRoar(); G.shake = Math.max(G.shake, 0.8); fxShift(0.03);
    const [a, b] = PRIME_MINIONS[e.type] || ['grunt', 'shooter'];
    summonMinions(e, a, 2); summonMinions(e, b, 2);
    e.novaT = 1.2;
  }
  e.novaT -= dt;
  if (e.novaT <= 0) {
    e.novaT = e.fury ? 3.5 : 6;
    const p = e.mesh.position, off = Math.random() * Math.PI;
    for (let i = 0; i < 18; i++) {
      const a = off + (i / 18) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      spawnOrb(new V3(p.x + cx * 2.4, 1.2, p.z + cz * 2.4), new V3(cx * 11, 0, cz * 11), 12, { color: 0xff3a2a });
    }
    ringFx(p.clone().setY(0.2), 4, 0xff3a2a);
    sfx.orb(1);
  }
}

// ================================================================ BATCH 4.3: RUBBLE PIT — shifting arenas, modifiers, boss waves, records
Object.assign(LOOKS, {
  pitCellar: { ...LOOKS.cellar, near: 20, far: 95 },
  pitNave: { ...LOOKS.cathedral, near: 30, far: 130 },
  pitKiln: { ...LOOKS.kiln, near: 22, far: 110, hemiI: 0.75, moon: 0.5 },
});
const PIT_ORDER = ['pit', 'cellar', 'nave', 'kiln'];
const PIT_ARENAS = {
  pit: { name: 'THE PIT', look: 'pit' },
  cellar: { name: 'THE FLOODED CELLAR', look: 'pitCellar' },
  nave: { name: 'THE BROKEN NAVE', look: 'pitNave' },
  kiln: { name: 'THE KILN FLOOR', look: 'pitKiln' },
};
const PIT_MODS = [
  { name: 'SWIFT', desc: 'enemies move 30% faster', mult: 1.25, diff: { speed: 1.3 } },
  { name: 'ARMORED', desc: 'enemies have 50% more health', mult: 1.3, diff: { hp: 1.5 } },
  { name: 'GLASS CANNON', desc: 'enemies hit 50% harder but break easily', mult: 1.2, diff: { dmg: 1.5, hp: 0.6 } },
  { name: 'TRIGGER HAPPY', desc: 'enemies attack much more often', mult: 1.25, diff: { fire: 0.65 } },
  { name: 'DOUBLE BOMBERS', desc: 'a bomber swarm joins the wave', mult: 1.2, add: [['bomber', 5]] },
  { name: 'HEALER SWARM', desc: 'menders and a priest keep them alive', mult: 1.3, add: [['mender', 3], ['priest', 1]] },
  { name: 'STAMPEDE', desc: 'rams charge in from every side', mult: 1.25, add: [['ram', 4]] },
  { name: 'UNDERGROUND', desc: 'burrowers tunnel under the floor', mult: 1.2, add: [['burrower', 4]] },
  { name: 'LOW GRAVITY', desc: 'you float · enemies do not', mult: 1.15, lowgrav: true },
];
const PIT_BOSS_POOL = ['bulwark', 'sweeper', 'roost', 'kiln', 'mirror', 'fortress', 'queen', 'anvil', 'bellows', 'crane', 'shard', 'bertha', 'kite', 'twins', 'cat'];
function pitWaveSetup(n) {
  const kind = PIT_ORDER[Math.floor((n - 1) / 5) % PIT_ORDER.length];
  let shifted = null;
  if (kind !== pitKind) { rebuildPit(kind); shifted = kind; }
  G.mod = null; G.modDiff = null; G.lowgrav = false;
  if (n >= 3 && n % 10 !== 0 && (n >= 15 || Math.random() < 0.6)) {
    const m = PIT_MODS[(Math.random() * PIT_MODS.length) | 0];
    G.mod = m;
    if (m.diff) {
      const b = DIFFS[settings.difficulty] || DIFFS.normal;
      G.modDiff = { ...b };
      for (const k in m.diff) G.modDiff[k] = b[k] * m.diff[k];
    }
    if (m.lowgrav) G.lowgrav = true;
    pushFeed('MODIFIER: ' + m.name, 'big');
    setTimeout(() => { if (G.mod === m && G.state === 'play') showHint(`MODIFIER · ${m.name}: ${m.desc} · score ×${m.mult}`); }, 900);
  }
  return shifted;
}
function pitExtras(n, list, bossWave) {
  const k = bossWave ? 0.3 : 1;
  const add = (t, c) => { for (let i = 0; i < Math.round(c * k); i++) list.push(t); };
  if (n >= 4) add('shield', Math.min(3, Math.floor((n - 2) / 3)));
  if (n >= 5) add('bomber', Math.min(3, Math.floor((n - 3) / 3)));
  if (n >= 6) add('sniper', Math.min(2, Math.floor((n - 2) / 4)));
  if (n >= 7) add('ram', Math.min(3, Math.floor((n - 4) / 3)));
  if (n >= 8) add('priest', n >= 16 ? 2 : 1);
  if (n >= 9) add('burrower', Math.min(3, Math.floor((n - 6) / 3)));
  if (n >= 11) add('mender', Math.min(2, Math.floor((n - 6) / 5)));
  if (G.mod && G.mod.add) for (const [t, c] of G.mod.add) add(t, c + Math.floor(n / 8));
}
function spawnPitBoss() {
  const n = G.wave;
  const fixed = { 20: 'boss1', 30: 'boss2', 40: 'boss3' }[n];
  const pool = n > 40 ? [...PIT_BOSS_POOL, 'boss1', 'boss2', 'boss3'] : PIT_BOSS_POOL;
  const type = fixed || pool[(Math.random() * pool.length) | 0];
  const room = { boss: type, cx: 0, cz: 0, w: 44, d: 44, x0: -22, x1: 22, z0: -22, z1: 22, spawns: SPAWNS, doorObjs: [], doors: [], waves: [] };
  const before = new Set(enemies);
  spawnBoss(room);
  const hpK = 1 + Math.max(0, n - 10) / 30;
  for (const e of enemies) if (!before.has(e) && e.def.boss) { e.maxHp *= hpK; e.hp = e.maxHp; if (e.type === 'boss3') e.flooded = true; }
}
function rebuildPit(kind) {
  clearLevelGeometry();
  clearProjectiles();
  clearNails();
  buildArena(kind);
  placeForge(0, 19.5, Math.PI);
  setLook(PIT_ARENAS[kind].look);
  const q = P.pos;
  const stuck = overlapBox(q.x - 0.5, q.y + 0.1, q.z - 0.5, q.x + 0.5, q.y + 1.7, q.z + 0.5) || hazards.some((h) => h.kind === 'lava' && inRect(q.x, q.z, h, 1));
  if (stuck) { P.pos.set(0, 0, 12); P.vel.set(0, 0, 0); }
  P.grounded = false;
  G.shake = Math.max(G.shake, 0.8); fxShift(0.03);
  sfx.heavySlam(1); sfx.door();
}
function buildArenaAlt(kind) {
  box(0, -1, 0, 2 * A + 6, 1, 2 * A + 6, floorMat, 3.5);
  const wallMat = kind === 'cellar' ? cobbleMat : brickMat;
  box(0, 0, -A - 1, 2 * A + 4, WALL_H, 2, wallMat, kind === 'cellar' ? 3 : undefined);
  box(0, 0, A + 1, 2 * A + 4, WALL_H, 2, wallMat, kind === 'cellar' ? 3 : undefined);
  box(-A - 1, 0, 0, 2, WALL_H, 2 * A, wallMat, kind === 'cellar' ? 3 : undefined);
  box(A + 1, 0, 0, 2, WALL_H, 2 * A, wallMat, kind === 'cellar' ? 3 : undefined);
  const wallTorches = () => {
    for (const t of [-18, 18]) {
      torch(t, 4.5, -A, 0, 1); torch(t, 4.5, A, 0, -1);
      torch(-A, 4.5, t, 1, 0); torch(A, 4.5, t, -1, 0);
    }
  };
  if (kind === 'cellar') {
    // squat columns holding up rotten beams, crate stacks and high ledges
    for (const [x, z] of [[15, 0], [-15, 0], [0, -15], [15, 15], [-15, 15], [15, -15], [-15, -15]]) {
      box(x, 0, z, 2.6, 6.2, 2.6, cobbleMat, 3);
      box(x, 0, z, 3.2, 0.8, 3.2, brickMat);
    }
    for (const x of [-15, 15]) box(x, 6.2, 0, 1.2, 0.7, 31.5, woodMat);
    box(0, 6.2, -15, 31.5, 0.7, 1.2, woodMat);
    for (const [x, z] of [[24, 8], [-24, 8], [24, -8], [-24, -8], [8, 25], [-8, 25], [8, -25], [-8, -25]]) {
      box(x, 0, z, 2.2, 2.2, 2.2, woodMat);
      box(x + 0.3, 2.2, z - 0.2, 1.4, 1.4, 1.4, woodMat);
    }
    for (const sd of [-1, 1]) {
      box(sd * (A - 1.5), 4, 0, 3, 0.6, 22, cobbleMat, 3);
      box(0, 4, sd * (A - 1.5), 22, 0.6, 3, cobbleMat, 3);
    }
    box(-6, 0, 6, 1, 1.2, 5, brickMat); box(6, 0, -6, 1, 1.2, 5, brickMat);
    wallTorches();
  } else if (kind === 'nave') {
    // twin colonnades, pews, an altar dais and high balconies
    for (const x of [-13, 13]) {
      for (let z = -24; z <= 24; z += 8) {
        box(x, 0, z, 3, 1, 3, cobbleMat, 3);
        box(x, 1, z, 2.2, 9, 2.2, brickMat);
      }
      box(x, 10, 0, 1.8, 0.9, 51, brickMat);
    }
    for (const sx of [-1, 1]) for (const z of [-16, -10, 8, 14]) box(sx * 5, 0, z, 6, 0.9, 0.8, woodMat);
    box(0, 0, -27, 12, 1.2, 6, cobbleMat, 3);
    box(0, 0, -23.4, 8, 0.6, 1.2, cobbleMat, 3);
    box(0, 1.2, -28, 4, 1.3, 1.6, brickMat);
    for (const sd of [-1, 1]) {
      box(sd * (A - 2), 4.5, 0, 4, 0.5, 30, cobbleMat, 3);
      box(sd * (A - 2), 5, -15, 4, 1, 0.4, brickMat); box(sd * (A - 2), 5, 15, 4, 1, 0.4, brickMat);
      box(sd * (A - 5), 0, 18, 2, 1.5, 2, cobbleMat, 3);
      box(sd * (A - 5), 0, 20.5, 2, 3, 2, cobbleMat, 3);
    }
    wallTorches();
    torch(-3, 2.8, -28, 0, 1); torch(3, 2.8, -28, 0, 1);
  } else if (kind === 'kiln') {
    // lava pools, flame vents, chimneys and furnace platforms
    hazard('lava', 19, 0, 6, 14); hazard('lava', -19, 0, 6, 14); hazard('lava', 0, -19, 14, 6);
    [[8, -24], [-8, -24], [24, 12], [-24, 12], [12, 6], [-12, 6]].forEach(([x, z], i) => hazard('vent', x, z, 2.2, 2.2, { phase: i * 0.7 }));
    for (const [x, z] of [[14, 14], [-14, 14], [14, -14], [-14, -14]]) {
      box(x, 0, z, 3, 9, 3, brickMat);
      box(x, 3, z, 3.3, 0.4, 3.3, ironDark, 1);
      box(x, 6.5, z, 3.3, 0.4, 3.3, ironDark, 1);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(sx * 28, 0, sz * 28, 9, 3.5, 9, brickMat);
      box(sx * 22, 0, sz * 28, 3, 1.7, 3, cobbleMat, 3);
    }
    for (const x of [-10, 10]) { furnace(x, -A + 0.06, 'N'); furnace(x, A - 0.06, 'S'); }
    for (const z of [-10, 10]) { furnace(-A + 0.06, z, 'W'); furnace(A - 0.06, z, 'E'); }
    box(0, 0, 16, 8, 1.4, 1, brickMat);
    box(16, 0, -10, 1, 1.4, 6, brickMat); box(-16, 0, -10, 1, 1.4, 6, brickMat);
    wallTorches();
  }
}
const PIT_KEY = 'rubblemaker-pit-scores';
function loadPitScores() {
  try { const a = JSON.parse(localStorage.getItem(PIT_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
function addPitScore(rec) {
  if (!(rec.score > 0)) return -1;
  const a = loadPitScores();
  a.push(rec);
  a.sort((x, y) => y.score - x.score);
  const top = a.slice(0, 10);
  try { localStorage.setItem(PIT_KEY, JSON.stringify(top)); } catch (_) {}
  return top.indexOf(rec);
}
function pitTableHTML(place, n) {
  const a = loadPitScores();
  if (!a.length) return '';
  const rows = a.slice(0, n).map((x, i) => `<tr class="${i === place ? 'me' : ''}"><td>#${i + 1}</td><td>${Math.floor(x.score).toLocaleString()}</td><td>WAVE ${x.wave}</td><td>${(RANKS[x.rank] || RANKS[0]).l}</td><td>${x.date ? new Date(x.date).toLocaleDateString() : ''}</td></tr>`).join('');
  const extra = place >= n ? `<tr class="me"><td>#${place + 1}</td><td colspan="4">your run · see PIT RECORDS</td></tr>` : '';
  return `<table class="pitTable"><tr><th></th><th>SCORE</th><th>WAVE</th><th>STYLE</th><th>DATE</th></tr>${rows}${extra}</table>`;
}
$('pitRecordsBtn').addEventListener('click', () => {
  initAudio();
  G.state = 'records';
  show('menu', false);
  $('pitRecordsList').innerHTML = pitTableHTML(-1, 10) || '<p>No runs yet. Survive the RUBBLE PIT to set a record.</p>';
  show('pitRecords', true);
});
$('pitRecordsBack').addEventListener('click', () => { G.state = 'menu'; show('pitRecords', false); show('menu', true); });

// ================================================================ BATCH 4.4a: LIFETIME STATS
var STATS = null;
const STATS_KEY = 'rubblemaker-stats';
function freshStats() { return { v: 1, kills: 0, by: {}, wk: {}, time: 0, deaths: 0, shots: 0, hits: 0, labels: {}, bosses: {}, met: {}, pRanks: 0, levels: 0, scrapEarned: 0, scrapSpent: 0, bestChain: 0, pitBestWave: 0, maxRank: 0, flags: {}, ach: {} }; }
function loadStats() {
  try { STATS = Object.assign(freshStats(), JSON.parse(localStorage.getItem(STATS_KEY) || '{}')); } catch (_) { STATS = freshStats(); }
  return STATS;
}
function saveStats() { try { localStorage.setItem(STATS_KEY, JSON.stringify(STATS)); } catch (_) {} }
loadStats();
const statsLive = () => G.mode !== 'practice' && !cheatsOn() && !(VS && VS.active);
function statLabel(label) {
  if (!statsLive()) return;
  const k = String(label).replace(/ x\d+$/, '');
  STATS.labels[k] = (STATS.labels[k] || 0) + 1;
  if (CHAIN.n > STATS.bestChain) STATS.bestChain = CHAIN.n;
  if (ST.idx > STATS.maxRank) STATS.maxRank = ST.idx;
}
function statKill(e, info) {
  if (!statsLive() || e.dummy) return;
  STATS.kills++;
  STATS.by[e.type] = (STATS.by[e.type] || 0) + 1;
  const w = (info && info.weapon) || 'world';
  STATS.wk[w] = (STATS.wk[w] || 0) + 1;
  if (e.def.boss) STATS.bosses[e.type] = (STATS.bosses[e.type] || 0) + 1;
}
function statMet(type) { if (G.mode === 'practice' || STATS.met[type]) return; STATS.met[type] = 1; }
let shotTok = 0, hitTok = -1;
function statShot() { if (!statsLive()) return; STATS.shots++; shotTok++; }
function statHit() { if (!statsLive() || hitTok === shotTok) return; hitTok = shotTok; STATS.hits++; }
function statLevelDone(overall, t, earned) {
  if (!statsLive()) return;
  STATS.levels++;
  STATS.scrapEarned += earned;
  if (overall === 6) STATS.pRanks++;
  if (G.dmgTaken === 0) STATS.flags.untouched = true;
  if (settings.difficulty === 'brutal') STATS.flags.brutal = true;
  saveStats(); checkAch();
}
setInterval(() => {
  if (G.state === 'play' && statsLive()) {
    STATS.time++;
    if (G.mode === 'endless' && G.wave > STATS.pitBestWave) STATS.pitBestWave = G.wave;
  }
  if (STATS.time % 10 === 0) saveStats();
  checkAch();
}, 1000);
addEventListener('pagehide', saveStats);

// ================================================================ BATCH 4.4a: ACHIEVEMENTS
Object.assign(SKINS, {
  chrome: { name: 'CHROME', steel: 0xe8eef8, dsteel: 0x9aa4b8, brass: 0x6ad8ff, em: 0x0a1420 },
  void: { name: 'VOID', steel: 0x16101e, dsteel: 0x08060c, brass: 0xb04aff, em: 0x2a0a4a },
  mason: { name: 'MASTER MASON', steel: 0xb8402a, dsteel: 0x6a2414, brass: 0xe8dcc0, em: 0x200804 },
});
applySkin();
const statL = (k) => (STATS.labels[k] || 0);
const beaten = (id) => Object.keys(prog().best || {}).some((k) => k === id || k.startsWith(id + ':'));
const TRAINERS = ['bulwark', 'sweeper', 'roost', 'kiln', 'mirror', 'marksman', 'fortress', 'queen', 'anvil', 'bellows', 'crane'];
const ACHS = [
  { id: 'first', name: 'FIRST BRICK', desc: 'Kill your first enemy', p: () => [STATS.kills, 1], scrap: 50 },
  { id: 'k500', name: 'RUBBLE RUBBLE', desc: 'Kill 500 enemies', p: () => [STATS.kills, 500], scrap: 250 },
  { id: 'k2500', name: 'DEMOLITION CREW', desc: 'Kill 2,500 enemies', p: () => [STATS.kills, 2500], scrap: 600 },
  { id: 'parry100', name: 'RETURN TO SENDER', desc: 'Parry 100 orbs', p: () => [statL('PARRY') + statL('SHOCK PARRY'), 100], scrap: 300 },
  { id: 'parry500', name: 'MIRROR MIRROR', desc: 'Parry 500 orbs', p: () => [statL('PARRY') + statL('SHOCK PARRY'), 500], skin: 'chrome' },
  { id: 'head', name: 'HEADHUNTER', desc: 'Land 250 headshot kills', p: () => [statL('HEADSHOT'), 250], scrap: 300 },
  { id: 'combo', name: 'COMBO ARTIST', desc: 'Set off 50 COMBO BLASTS', p: () => [statL('COMBO BLAST'), 50], scrap: 300 },
  { id: 'coin', name: 'COIN OPERATED', desc: '50 coin tricks (COINSHOT, BANKSHOT, COIN CHAIN)', p: () => [statL('COINSHOT') + statL('BANKSHOT') + statL('COIN CHAIN'), 50], scrap: 300 },
  { id: 'arsenal', name: 'FULL ARSENAL', desc: 'Hit the same target with every gun in one swap chain', p: () => [statL('FULL ARSENAL'), 1], scrap: 200 },
  { id: 'chain8', name: 'CHAIN GANG', desc: 'Build a swap chain of 8', p: () => [STATS.bestChain, 8], scrap: 300 },
  { id: 'rubble', name: 'STYLE ICON', desc: 'Reach the RUBBLEMAKER style rank', p: () => [STATS.maxRank >= RANKS.length - 1 ? 1 : 0, 1], scrap: 200 },
  { id: 'p1', name: 'PERFECTIONIST', desc: 'Earn a P-rank', p: () => [STATS.pRanks, 1], scrap: 300 },
  { id: 'p10', name: 'P FOR PERFECT', desc: 'Earn 10 P-ranks', p: () => [STATS.pRanks, 10], scrap: 800 },
  { id: 's0', name: 'CELLAR CLEARED', desc: 'Beat SCENE 0: THE CELLAR', p: () => [beaten('0-5') ? 1 : 0, 1], scrap: 200 },
  { id: 's1', name: 'CATHEDRAL CLEARED', desc: 'Beat SCENE 1: THE CATHEDRAL', p: () => [beaten('1-12') ? 1 : 0, 1], scrap: 400 },
  { id: 's2', name: 'KILN CLEARED', desc: 'Beat SCENE 2: THE KILN', p: () => [beaten('2-12') ? 1 : 0, 1], scrap: 600 },
  { id: 'trainers', name: 'SCHOOLED', desc: 'Beat all 11 trainers', p: () => [TRAINERS.filter((t) => STATS.bosses[t]).length, TRAINERS.length], scrap: 500 },
  { id: 'duels', name: 'DUELIST', desc: 'Win every duel reward', p: () => [DUELS.filter((d) => (prog().owned || []).includes(duelPrize(d.duel))).length, DUELS.length], scrap: 600 },
  { id: 'primes', name: 'PRIME TIME', desc: 'Beat all three PRIME rematches', p: () => [PRIMES.filter((d) => beaten(d.id)).length, PRIMES.length], skin: 'void' },
  { id: 'pit10', name: 'PIT DWELLER', desc: 'Reach wave 10 in the RUBBLE PIT', p: () => [STATS.pitBestWave, 10], scrap: 200 },
  { id: 'pit20', name: 'PIT BOSS', desc: 'Reach wave 20 in the RUBBLE PIT', p: () => [STATS.pitBestWave, 20], scrap: 400 },
  { id: 'pit30', name: 'BOTTOMLESS', desc: 'Reach wave 30 in the RUBBLE PIT', p: () => [STATS.pitBestWave, 30], scrap: 800 },
  { id: 'skull10', name: 'GRAVE ROBBER', desc: 'Find 10 secret skulls', p: () => [skullCount(prog()), 10], scrap: 300 },
  { id: 'skulls', name: 'ARCHAEOLOGIST', desc: 'Find every secret skull', p: () => [skullCount(prog()), TOTAL_SKULLS], scrap: 600 },
  { id: 'slam', name: 'GROUND POUNDER', desc: 'Land 100 GROUND SLAM hits', p: () => [statL('GROUND SLAM'), 100], scrap: 200 },
  { id: 'env', name: 'HOME HAZARD', desc: 'Kill 25 enemies with lava, vents or crushers', p: () => [statL('MELTED') + statL('TORCHED') + statL('CRUSHED'), 25], scrap: 250 },
  { id: 'brick', name: 'BRICKLAYER', desc: 'Kill 200 enemies with the LAUNCHER', p: () => [STATS.wk.launcher || 0, 200], scrap: 300 },
  { id: 'arms', name: 'WRECKING BALL', desc: 'Kill 100 enemies with your arms', p: () => [['punch', 'blade', 'shock', 'grapple', 'slam'].reduce((a, k) => a + (STATS.wk[k] || 0), 0), 100], scrap: 300 },
  { id: 'untouched', name: 'UNTOUCHABLE', desc: 'Clear a level without taking damage', p: () => [STATS.flags.untouched ? 1 : 0, 1], scrap: 300 },
  { id: 'brutal', name: 'BRUTAL HONESTY', desc: 'Clear a level on BRUTAL', p: () => [STATS.flags.brutal ? 1 : 0, 1], scrap: 400 },
  { id: 'shop', name: 'FULLY STOCKED', desc: 'Buy everything at the FORGE', p: () => [SHOP.filter((it) => (prog().owned || []).includes(it.id)).length, SHOP.length], scrap: 500 },
  { id: 'all', name: 'MASTER MASON', desc: 'Unlock every other achievement', p: () => [ACHS.filter((a) => a.id !== 'all' && STATS.ach[a.id]).length, ACHS.length - 1], skin: 'mason' },
];
const achQueue = [];
let achShowing = false;
function checkAch() {
  if (!STATS || cheatsOn()) return;
  let any = false;
  for (const a of ACHS) {
    if (STATS.ach[a.id]) continue;
    let ok = false;
    try { const [c, m] = a.p(); ok = c >= m; } catch (_) {}
    if (!ok) continue;
    STATS.ach[a.id] = Date.now(); any = true;
    if (a.scrap) { awardScrap(a.scrap); STATS.scrapEarned += a.scrap; }
    if (a.skin) { const p = loadProgress(); p.owned = p.owned || []; if (!p.owned.includes('skin_' + a.skin)) p.owned.push('skin_' + a.skin); saveProgress(p); }
    achQueue.push(a);
  }
  if (any) { saveStats(); showAchToast(); }
}
function showAchToast() {
  if (achShowing || !achQueue.length) return;
  const a = achQueue.shift();
  achShowing = true;
  const el = $('achToast');
  el.innerHTML = `<small>ACHIEVEMENT UNLOCKED</small><b>${a.name}</b><span>${a.desc}</span><em>${a.scrap ? '+' + a.scrap + ' ◆ SCRAP' : SKINS[a.skin].name + ' GUN SKIN'}</em>`;
  el.classList.add('show');
  try { sfx.rankUp(); } catch (_) {}
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => { achShowing = false; showAchToast(); }, 500); }, 3600);
}

// ================================================================ BATCH 4.4a: CODEX
const CODEX_BEASTS = [
  ['grunt', 'BRICK GRUNT', 'ENEMY', 'Kiln workers the Foreman fired one time too many. Their mortar hearts beat on out of spite. They come in crowds.'],
  ['shooter', 'SPITTER', 'ENEMY', 'Grunts whose throats were packed with live coals. They lob glowing orbs. Punch the orbs back.'],
  ['flyer', 'GARGOYLE', 'ENEMY', 'Roof gargoyles shaken loose by the Architect. They circle, they screech, then they dive. Shoot them on the way down.'],
  ['heavy', 'HEAVY', 'ENEMY', 'Foundation stones given legs. Slow, but each stomp sends a shockwave along the floor. Jump it.'],
  ['shield', 'SHIELDBEARER', 'ENEMY', 'Carries a cathedral door as a shield. Flank it, or break the door with explosions, slams or the GRAPPLE.'],
  ['sniper', 'SNIPER', 'ENEMY', 'A surveyor still sighting along his theodolite. When the red line flashes white, PUNCH it and his shot goes back to him.'],
  ['bomber', 'BOMBER', 'ENEMY', 'A walking kiln charge. Pop it at range and the blast hurts its friends instead of you.'],
  ['priest', 'PRIEST', 'ENEMY', 'He blesses the rubble so it keeps fighting, and his wards halve the damage they take. Kill him first.'],
  ['ram', 'RAM', 'ENEMY', 'It paws the ground and then charges. Dash aside and let it plough into a wall, or into its friends.'],
  ['burrower', 'BURROWER', 'ENEMY', 'It tunnels under the floor and bursts up under you. A GROUND SLAM digs it out.'],
  ['mender', 'MENDER', 'ENEMY', 'An apprentice that still repairs bricks, even living ones. It beams health into its allies and can stitch the dead back together.'],
  ['swarmling', 'SWARMLING', 'ENEMY', 'A brick-chip wasp, bred by the Swarm Queen. Alone it is nothing. They never come alone.'],
  ['bulwark', 'THE BULWARK', 'TRAINER', 'LESSON I · THE PARRY. Bullets glance off him. Punch his big orb back into his face.'],
  ['sweeper', 'THE SWEEPER', 'TRAINER', 'LESSON II · THE DASH. His waves are too tall to jump over. Dash straight through them.'],
  ['roost', 'THE ROOST', 'TRAINER', 'LESSON III · THE AIR. She only flinches when you are airborne, or when a slam lands under her.'],
  ['kiln', 'THE KILN', 'TRAINER', 'LESSON IV · THE COMBO BLAST. Lob a core with the shotgun and shoot it with the revolver.'],
  ['mirror', 'THE MIRROR KNIGHT', 'TRAINER', 'LESSON V · THE RICOCHET. Only bounced shots hurt him: coins and chainlink banks.'],
  ['marksman', 'THE MARKSMAN', 'TRAINER', 'LESSON VI · THE COUNTERSNIPE. He only falls to his own bullets. Punch the moment his laser flashes.'],
  ['fortress', 'THE FORTRESS', 'TRAINER', 'LESSON VII · THE SHIELD BREAK. Three layers of shield. Strip them with explosions, slams, shockwaves or the grapple.'],
  ['queen', 'THE SWARM QUEEN', 'TRAINER', 'LESSON VIII · THE SWARM. Only the nailgun reaches her. Stick a LODESTONE magnet on her and spray.'],
  ['anvil', 'THE ANVIL', 'TRAINER', 'LESSON IX · THE BLADE. An iron smith-golem. Bullets ring off him; only the BLADE arm cuts.'],
  ['bellows', 'THE BELLOWS', 'TRAINER', 'LESSON X · THE CHARGED SHOCKWAVE. A furnace lung on legs. Charge the SHOCKWAVE fist to 3+ bars.'],
  ['crane', 'THE CRANE', 'TRAINER', 'LESSON XI · THE GRAPPLE. It hangs out of reach. Hook it, drag it down, then unload.'],
  ['shard', 'SISTER SHARD', 'DUELIST', 'A stained-glass saint who still guards the chapel. Strike her while she is in her stance and she reflects the blow. She duels with honour.'],
  ['bertha', 'BIG BERTHA', 'DUELIST', 'Champion of the cellar fight ring. Her fist hits like a shockwave, and she will teach you how.'],
  ['kite', 'KITE', 'DUELIST', 'A chimney sweep who swings through the rafters on a hook and line. Catch him to earn it.'],
  ['tumble', 'TUMBLE', 'DUELIST', 'One half of the kiln circus act. The heavy half.'],
  ['twirl', 'TWIRL', 'DUELIST', 'The other half of the act. The fast half. Beat both of them.'],
  ['cat', 'CINDER', 'DUELIST', 'The kiln-cat. She sleeps on the warmest bricks and leaves a trail of fire wherever she runs.'],
  ['gilded', 'THE GILDED ONE', 'DUELIST', 'He waits for whoever finds every skull. Nobody knows what he was before the gold.'],
  ['boss1', 'MORTIMER', 'BOSS', 'WARDEN OF THE CELLAR. The guild\'s old gaoler, mortared into his own vault. He let the Foreman in.'],
  ['boss2', 'THE HIGH MASON', 'BOSS', 'ARCHITECT OF RUIN. He drew up the guild\'s plans and then sold them. The cathedral is his blueprint, and he rearranges it as you fight.'],
  ['boss3', 'THE MOLTEN FOREMAN', 'BOSS', 'MASTER OF THE KILN. He fires bricks, then workers, then the whole city. He is the reason you were made.'],
];
const ARSENAL = () => {
  const gunDesc = (g, v) => (g === 0 && v === 0 ? 'Your starting sidearm. Hold ALT to charge a piercing LANCE shot through a whole line of enemies.' : (SHOP.find((it) => it.gun === g && it.v === v) || {}).desc || '');
  const guns = [0, 1, 2, 3, 4].map((g) => ({ head: WNAMES[g], rows: VARIANTS[g].map((vd, v) => ({ name: vd.name, css: vd.css, owned: ownsVariant(g, v), desc: gunDesc(g, v) })) }));
  const arms = { head: 'ARMS', rows: [
    { name: 'PUNCH', css: '#ffd04a', owned: true, desc: `${actLabel('punch')} punches. Punch a glowing orb to PARRY it back, or punch a shotgun core for a CORE PUNCH.` },
    { name: 'BLADE', css: '#9ae8ff', owned: owns('arm_blade'), desc: 'Slices orbs out of the air and CLEAVES groups of enemies. Won from SISTER SHARD.' },
    { name: 'SHOCKWAVE', css: '#ff8a2a', owned: owns('arm_shock'), desc: 'Hold to charge, release for a cone blast that throws enemies and parries orbs. Won from BIG BERTHA.' },
    { name: 'GRAPPLE', css: '#c8a070', owned: owns('arm_grapple'), desc: 'Hook walls to swing, yank light enemies to you, rip shields away. Won from KITE.' },
  ] };
  const moves = { head: 'MOVES', rows: [
    { name: 'DASH', css: '#6ad8ff', owned: true, desc: `${actLabel('dash')}: invulnerable burst, 3 charges. Dash through attacks for DODGE style.` },
    { name: 'SLIDE', css: '#6ad8ff', owned: true, desc: `${actLabel('slide')} on the ground: fast and low. Kills while sliding earn SLIDE KILL.` },
    { name: 'GROUND SLAM', css: '#6ad8ff', owned: true, desc: `${actLabel('slide')} in mid-air: crash down with a shockwave. It digs out burrowers.` },
    { name: 'WALL JUMP', css: '#6ad8ff', owned: true, desc: `${actLabel('jump')} against a wall. 3 in a row before you need to touch the floor.` },
    { name: 'SWAP CHAIN', css: '#6ad8ff', owned: true, desc: 'Hit the same enemy with different weapons in quick succession for bonus damage. Use all of them for FULL ARSENAL.' },
    { name: 'DOUBLE JUMP', css: '#ffd04a', owned: owns('up_djump'), desc: 'A second jump in mid-air. Won from TUMBLE & TWIRL.' },
    { name: 'FIRE DASH', css: '#ff6a2a', owned: owns('up_firedash'), desc: 'Your dash leaves a blazing trail that scorches enemies. Won from CINDER.' },
  ] };
  return [...guns, arms, moves];
};
let codexTab = 'beasts', codexSel = null;
const CX = { r: null, scene: null, cam: null, model: null, raf: 0, t: 0 };
function codexModel(type) {
  const def = DEFS[type];
  const md = def.cat ? buildCatModel() : def.base ? buildEnemyModel(def.base, def.color) : def.duelist ? buildDuelistModel(type) : def.variantModel ? buildVariantModel(type) : def.trainer ? buildTrainerModel(type) : def.boss ? buildBossModel(type) : buildEnemyModel(type, def.color);
  if (def.scale) md.root.scale.multiplyScalar(def.scale);
  return md;
}
function codexShow(type) {
  if (!CX.r) {
    const cv = $('codexCanvas');
    CX.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    CX.r.setPixelRatio(Math.min(2, devicePixelRatio));
    CX.r.outputColorSpace = THREE.SRGBColorSpace;
    CX.scene = new THREE.Scene();
    CX.scene.add(new THREE.HemisphereLight(0xffe0c0, 0x2a1a10, 1.4));
    const d = new THREE.DirectionalLight(0xffc89a, 2.2); d.position.set(3, 6, 5); CX.scene.add(d);
    const rim = new THREE.DirectionalLight(0x6a8aff, 1.2); rim.position.set(-4, 3, -5); CX.scene.add(rim);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.25, 10), cobbleMat);
    plinth.position.y = -0.125; CX.scene.add(plinth);
    CX.cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  }
  if (CX.model) { CX.scene.remove(CX.model.root); CX.model.root.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); }
  const md = codexModel(type);
  CX.model = md;
  const box3 = new THREE.Box3().setFromObject(md.root);
  const size = box3.getSize(new V3()), h = Math.max(size.y, size.x * 0.8, size.z * 0.8, 0.5);
  const k = 2.6 / h;
  md.root.scale.multiplyScalar(k);
  const b2 = new THREE.Box3().setFromObject(md.root);
  md.root.position.y -= b2.min.y;
  const c = b2.getCenter(new V3());
  md.root.position.x -= c.x; md.root.position.z -= c.z;
  CX.scene.add(md.root);
  CX.cam.position.set(0, 1.9, 6.2); CX.cam.lookAt(0, 1.2, 0);
  if (!CX.raf) codexLoop();
}
function codexLoop() {
  CX.raf = requestAnimationFrame(codexLoop);
  if (G.state !== 'codex' || !CX.model) return;
  const cv = $('codexCanvas'), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * CX.r.getPixelRatio())) { CX.r.setSize(w, h, false); CX.cam.aspect = w / h; CX.cam.updateProjectionMatrix(); }
  CX.t += 1 / 60;
  CX.model.root.rotation.y = CX.t * 0.7;
  CX.r.render(CX.scene, CX.cam);
}
function fmtPlay(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`; }
function topOf(o) { let best = null, n = 0; for (const k in o) if (o[k] > n) { n = o[k]; best = k; } return best ? [best, n] : null; }
function renderCodex() {
  const body = $('codexBody');
  document.querySelectorAll('#codexTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === codexTab));
  if (codexTab === 'beasts') {
    const met = CODEX_BEASTS.filter(([t]) => STATS.met[t] || STATS.by[t]);
    if (!codexSel || !met.some(([t]) => t === codexSel)) codexSel = met.length ? met[0][0] : null;
    const cats = ['ENEMY', 'TRAINER', 'DUELIST', 'BOSS'];
    body.innerHTML = `<div class="cxBeasts"><div class="cxList">${cats.map((c) => `<h4>${{ ENEMY: 'ENEMIES', TRAINER: 'TRAINERS', DUELIST: 'DUELISTS', BOSS: 'BOSSES' }[c]}</h4><div>${CODEX_BEASTS.filter((x) => x[2] === c).map(([t, n]) => { const seen = STATS.met[t] || STATS.by[t]; return `<button data-beast="${t}" class="${t === codexSel ? 'on' : ''}" ${seen ? '' : 'disabled'}>${seen ? n : '???'}</button>`; }).join('')}</div>`).join('')}</div>` +
      `<div class="cxDetail">${codexSel ? (() => { const [t, n, c, lore] = CODEX_BEASTS.find((x) => x[0] === codexSel); const d = DEFS[t]; return `<canvas id="codexCanvas"></canvas><h3>${n}</h3><small>${c} · ${Math.round(d.hp)} HP · KILLED ${STATS.by[t] || 0}×</small><p>${lore}</p>${d.hint || ENEMY_INTRO[t] ? `<p class="tip">${d.hint || ENEMY_INTRO[t]}</p>` : ''}`; })() : '<p>You haven\'t met anything yet. Go break something.</p>'}</div></div>` +
      `<p class="cxCount">${met.length} / ${CODEX_BEASTS.length} DISCOVERED</p>`;
    body.querySelectorAll('[data-beast]').forEach((b) => b.addEventListener('click', () => { codexSel = b.dataset.beast; renderCodex(); }));
    if (CX.r) { CX.r.dispose(); CX.r.forceContextLoss(); CX.r = null; CX.model = null; }
    if (codexSel) codexShow(codexSel);
  } else if (codexTab === 'arsenal') {
    body.innerHTML = `<div class="cxArsenal">${ARSENAL().map((g) => `<div class="cxGun"><h4>${g.head}</h4>${g.rows.map((r) => `<div class="cxRow ${r.owned ? '' : 'locked'}"><b style="color:${r.owned ? r.css : '#666'}">${r.name}</b><p>${r.owned ? r.desc : 'LOCKED · ' + r.desc}</p></div>`).join('')}</div>`).join('')}</div>`;
  } else if (codexTab === 'stats') {
    const acc = STATS.shots ? Math.round((STATS.hits / STATS.shots) * 100) : 0;
    const fw = topOf(STATS.wk), fv = topOf(STATS.by);
    const wname = (k) => ({ world: 'THE ENVIRONMENT', slam: 'GROUND SLAM', shock: 'SHOCKWAVE', punch: 'PUNCH' }[k] || k.toUpperCase());
    const beastName = (k) => (CODEX_BEASTS.find((x) => x[0] === k) || [k, k.toUpperCase()])[1];
    const rows = [
      ['TIME PLAYED', fmtPlay(STATS.time)], ['KILLS', STATS.kills.toLocaleString()], ['DEATHS', STATS.deaths],
      ['ACCURACY', `${acc}% <small>(${STATS.hits.toLocaleString()} / ${STATS.shots.toLocaleString()} shots)</small>`],
      ['FAVOURITE WEAPON', fw ? `${wname(fw[0])} <small>(${fw[1]} kills)</small>` : '-'], ['FAVOURITE VICTIM', fv ? `${beastName(fv[0])} <small>(${fv[1]})</small>` : '-'],
      ['PARRIES', statL('PARRY') + statL('SHOCK PARRY')], ['HEADSHOTS', statL('HEADSHOT')], ['COMBO BLASTS', statL('COMBO BLAST')],
      ['BEST SWAP CHAIN', STATS.bestChain], ['HIGHEST STYLE', RANKS[STATS.maxRank].l], ['LEVELS CLEARED', STATS.levels], ['P-RANKS', STATS.pRanks],
      ['BOSSES BEATEN', Object.values(STATS.bosses).reduce((a, b) => a + b, 0)], ['PIT BEST WAVE', STATS.pitBestWave],
      ['SCRAP EARNED', STATS.scrapEarned.toLocaleString() + ' ◆'], ['SCRAP SPENT', STATS.scrapSpent.toLocaleString() + ' ◆'],
      ['ACHIEVEMENTS', `${Object.keys(STATS.ach).length} / ${ACHS.length}`],
    ];
    body.innerHTML = `<div class="cxStats">${rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div>`;
  } else if (codexTab === 'story') {
    const seen = cutsSeen();
    const order = ['prologue', 'boss1', 'scene1', 'boss2', 'scene2', 'boss3', 'ending'];
    body.innerHTML = `<div class="cxStory">${order.map((k) => seen[k] ? `<div class="ch"><h4>${STORY[k].title}</h4>${STORY[k].lines.map(([w, t]) => `<p><b>${w}</b> ${t}</p>`).join('')}</div>` : `<div class="ch locked"><h4>???</h4><p>Keep playing to uncover this chapter.</p></div>`).join('')}</div>`;
  } else {
    body.innerHTML = `<p class="cxCount">${Object.keys(STATS.ach).length} / ${ACHS.length} UNLOCKED</p><div class="cxAch">${ACHS.map((a) => { const [c, m] = a.p(); const got = !!STATS.ach[a.id]; const f = Math.min(1, c / m); return `<div class="ach ${got ? 'got' : ''}"><b>${a.name}</b><p>${a.desc}</p><em>${a.scrap ? '+' + a.scrap + ' ◆' : SKINS[a.skin].name + ' SKIN'}</em><div class="bar"><i style="width:${(got ? 1 : f) * 100}%"></i></div><small>${got ? 'UNLOCKED' : `${Math.min(c, m).toLocaleString()} / ${m.toLocaleString()}`}</small></div>`; }).join('')}</div>`;
  }
}
function openCodex() {
  initAudio();
  checkAch();
  G.state = 'codex';
  show('menu', false);
  renderCodex();
  show('codex', true);
}
$('codexBtn').addEventListener('click', openCodex);
$('codexBack').addEventListener('click', () => { G.state = 'menu'; show('codex', false); show('menu', true); if (CX.raf) { cancelAnimationFrame(CX.raf); CX.raf = 0; } });
document.querySelectorAll('#codexTabs button').forEach((b) => b.addEventListener('click', () => { codexTab = b.dataset.tab; renderCodex(); }));

// ================================================================ BATCH 4.4b: STORY + CUTSCENES
const STORY = {
  prologue: { title: 'PROLOGUE', card: 'SCENE 0 · THE CELLAR', lines: [
    ['THE GUILD', 'Before the fire, there was the GUILD. Masons. Bricklayers. The builders of this city.'],
    ['THE GUILD', 'Then came the MOLTEN FOREMAN. He took the kilns, fired the workers, and turned every brick against us.'],
    ['THE GUILD', 'With the last of our mortar, the dead guild raised one more pair of hands.'],
    ['THE GUILD', 'You do not speak. You do not tire. You were made to tear it all down.'],
  ] },
  scene1: { title: 'SCENE 1', card: 'SCENE 1 · THE CATHEDRAL', lines: [
    ['THE GUILD', 'The cellar is quiet now. The Warden\'s keys are rust.'],
    ['THE GUILD', 'Above it stands the CATHEDRAL, drawn by the HIGH MASON: our guildmaster, who sold our plans to the fire.'],
    ['THE GUILD', 'Every arch he laid is a lie. Bring them down.'],
  ] },
  scene2: { title: 'SCENE 2', card: 'SCENE 2 · THE KILN', lines: [
    ['THE GUILD', 'The cathedral has fallen, and the roof of the city has fallen in with it.'],
    ['THE GUILD', 'Below, the kilns roar. The Foreman is waiting for the last brick he hasn\'t fired.'],
    ['THE GUILD', 'Go into the heat. Make rubble of the rest.'],
  ] },
  boss1: { title: 'THE WARDEN', lines: [
    ['MORTIMER', 'Another guild brick come knocking? I let the fire in, little golem.'],
    ['MORTIMER', 'I\'ll let it into you too.'],
  ] },
  boss2: { title: 'THE ARCHITECT', lines: [
    ['THE HIGH MASON', 'You\'re built from MY plans, golem. Every brick in you, I drew.'],
    ['THE HIGH MASON', 'Allow me a revision.'],
  ] },
  boss3: { title: 'THE FOREMAN', lines: [
    ['THE MOLTEN FOREMAN', 'The guild\'s last batch. Underfired. Cracked. Look at you.'],
    ['THE MOLTEN FOREMAN', 'Back in the kiln with you. I\'ll do it myself.'],
  ] },
  ending: { title: 'EPILOGUE', card: 'THANK YOU FOR PLAYING', sub: 'PRIME rematches, duels and the RUBBLE PIT still wait for you', lines: [
    ['THE GUILD', 'The kiln is cold. The Foreman is slag.'],
    ['THE GUILD', 'The city is rubble now. And from rubble, we build again.'],
    ['THE GUILD', 'Rest, golem. Or don\'t. There are always more walls.'],
  ] },
};
const STORY_AT = { '0-1': 'prologue', '1-1': 'scene1', '2-1': 'scene2' };
const CUTS_KEY = 'rubblemaker-cuts';
function cutsSeen() { try { return JSON.parse(localStorage.getItem(CUTS_KEY) || '{}'); } catch (_) { return {}; } }
function markCut(id) { const s2 = cutsSeen(); s2[id] = 1; try { localStorage.setItem(CUTS_KEY, JSON.stringify(s2)); } catch (_) {} }
var CUT = null;
const lerpV = (a, b, t) => new V3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const ease = (t) => t * t * (3 - 2 * t);
function buildGolem() {
  // the hero: a brick golem with a glowing mortar core and eyes
  const md = buildEnemyModel('heavy', 0x9a4a2a);
  const glow = new THREE.MeshBasicMaterial({ color: 0x8ae8ff });
  const r = md.rig;
  for (const sd of [-1, 1]) { const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.04), glow); eye.position.set(sd * 0.12, 0.18, 0.3); r.head.add(eye); }
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glow); core.position.set(0, 0.8, 0.5); r.torso.add(core);
  const light = new THREE.PointLight(0x6ad8ff, 3, 6); light.position.set(0, 1, 1); r.torso.add(light);
  md.core = core;
  return md;
}
// Plays a list of shots: { from, to, look, lookTo, line: [who, text], card, dur }
function playCutscene(id, shots, done, opts = {}) {
  markCut(id);
  document.exitPointerLock?.();
  for (const s2 of ['menu', 'levels', 'complete', 'over', 'pause', 'codex']) show(s2, false);
  show('hud', false);
  show('cutscene', true);
  $('cutscene').classList.remove('out');
  CUT = { id, shots, i: -1, t: 0, done, props: opts.props || [], prevState: G.state, typed: 0, pad: {} };
  G.state = 'cutscene';
  nextShot();
  $('cutSkip').textContent = G.input === 'pad' ? 'Ⓐ NEXT · Ⓑ SKIP' : G.input === 'touch' ? 'TAP: NEXT · HOLD: SKIP' : 'SPACE / CLICK: NEXT · ESC: SKIP';
}
function nextShot() {
  if (!CUT) return;
  CUT.i++;
  if (CUT.i >= CUT.shots.length) { endCutscene(); return; }
  const sh = CUT.shots[CUT.i];
  CUT.t = 0; CUT.typed = 0;
  const txt = sh.line ? sh.line[1] : '';
  sh.dur = sh.dur || Math.max(3.2, txt.length / 24 + 1.6);
  $('cutWho').textContent = sh.line ? sh.line[0] : '';
  $('cutText').textContent = '';
  $('cutCap').classList.toggle('hidden', !sh.line);
  const card = $('cutCard');
  if (sh.card) { card.innerHTML = `<b>${sh.card}</b>${sh.sub ? `<small>${sh.sub}</small>` : ''}`; card.classList.remove('show'); void card.offsetWidth; card.classList.add('show'); }
  else card.classList.remove('show');
  if (sh.onStart) sh.onStart();
}
function endCutscene() {
  if (!CUT) return;
  const c = CUT;
  CUT = null;
  for (const p of c.props) scene.remove(p);
  $('cutscene').classList.add('out');
  setTimeout(() => { if (!CUT) show('cutscene', false); }, 400);
  G.state = c.prevState === 'complete' ? 'complete' : 'play';
  last = performance.now();
  c.done && c.done();
}
function updateCutscene(dt) {
  if (!CUT) return;
  const sh = CUT.shots[CUT.i];
  if (!sh) return;
  CUT.t += dt;
  const k = ease(Math.min(1, CUT.t / sh.dur));
  const pos = sh.orbit ? new V3(sh.orbit.x + Math.sin(sh.a0 + (sh.a1 - sh.a0) * k) * sh.r, sh.y, sh.orbit.z + Math.cos(sh.a0 + (sh.a1 - sh.a0) * k) * sh.r) : lerpV(sh.from, sh.to || sh.from, k);
  const look = sh.orbit ? new V3(sh.orbit.x, sh.lookY, sh.orbit.z) : lerpV(sh.look, sh.lookTo || sh.look, k);
  camera.position.copy(pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  scene.updateMatrixWorld();
  if (sh.tick) sh.tick(dt, k);
  if (sh.line) {
    const n = Math.min(sh.line[1].length, Math.floor(CUT.t * 42));
    if (n !== CUT.typed) { CUT.typed = n; $('cutText').textContent = sh.line[1].slice(0, n); if (n % 3 === 0) try { tone(900 + Math.random() * 200, 700, 0.025, 0.03, 'square'); } catch (_) {} }
  }
  // gamepad: A = next, B/START = skip
  for (const gp of navigator.getGamepads ? navigator.getGamepads() : []) {
    if (!gp) continue;
    for (const [b, act] of [[0, 'next'], [1, 'skip'], [9, 'skip']]) {
      const down = !!(gp.buttons[b] && gp.buttons[b].pressed);
      const key = gp.index + ':' + b;
      if (down && !CUT.pad[key]) { CUT.pad[key] = true; act === 'next' ? cutAdvance() : endCutscene(); if (!CUT) return; }
      else if (!down) CUT.pad[key] = false;
    }
  }
  if (CUT && CUT.t >= sh.dur + (sh.hold || 0.6)) nextShot();
}
function cutAdvance() {
  if (!CUT) return;
  const sh = CUT.shots[CUT.i];
  if (sh && sh.line && CUT.typed < sh.line[1].length) { CUT.t = Math.max(CUT.t, sh.line[1].length / 42); return; }
  nextShot();
}
addEventListener('keydown', (e) => {
  if (G.state !== 'cutscene') return;
  e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'Backspace') endCutscene(); else cutAdvance();
}, true);
let cutHold = 0;
addEventListener('pointerdown', () => { if (G.state === 'cutscene') { cutHold = setTimeout(() => endCutscene(), 700); } });
addEventListener('pointerup', () => { if (G.state === 'cutscene' && cutHold) { clearTimeout(cutHold); cutHold = 0; cutAdvance(); } });

// ---- scripted shots
function storyShots(id, L) {
  const st = STORY[id];
  const sx = L.start.x, sz = L.start.z, yaw = L.start.yaw;
  const f = new V3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const at = (fw, up, side = 0) => new V3(sx + f.x * fw - f.z * side, up, sz + f.z * fw + f.x * side);
  const lines = st.lines;
  const shots = [];
  const props = [];
  if (id === 'prologue') {
    const g = buildGolem();
    g.root.position.set(sx, 0, sz);
    g.root.rotation.y = Math.atan2(f.x, f.z);
    g.root.scale.multiplyScalar(0.65);
    scene.add(g.root);
    props.push(g.root);
    const spin = (dt) => { g.core.rotation.y += dt * 2; g.core.rotation.x += dt; };
    shots.push({ from: at(5, 5, 2.5), to: at(3.5, 3.8, -1.5), look: at(0, 1.2, 0), line: lines[0], tick: spin });
    shots.push({ from: at(5.5, 2.2, -3), to: at(5, 2.6, 2.5), look: at(0, 1.6, 0), line: lines[1], tick: spin });
    shots.push({ orbit: at(0, 0, 0), r: 4.2, y: 1.9, lookY: 1.4, a0: yaw + Math.PI - 0.8, a1: yaw + Math.PI + 0.5, line: lines[2], tick: spin });
    shots.push({ from: at(2.8, 1.6, 0.5), to: at(2.0, 1.7, 0), look: at(0, 1.5, 0), line: lines[3], tick: spin });
    shots.push({ from: at(-1.6, 2.4, 0), to: at(0, 1.6, 0), look: at(10, 1.6, 0), card: st.card, dur: 3.2, hold: 0.4, tick: (dt, k) => { spin(dt); g.root.visible = k < 0.35; }, onStart: () => sfx.bossRoar() });
  } else {
    shots.push({ from: at(5, 6.5, 3), to: at(3, 5, -2), look: at(-2, 1, 0), line: lines[0] });
    shots.push({ from: at(-1.5, 3.5, -3), to: at(-1, 2.6, 3), look: at(8, 2, 0), line: lines[1] });
    if (lines[2]) shots.push({ from: at(-1, 2.4, 0), to: at(1, 2, 0), look: at(12, 1.8, 0), line: lines[2] });
    shots.push({ from: at(-1, 2, 0), to: at(0, 1.6, 0), look: at(10, 1.6, 0), card: st.card, dur: 3, hold: 0.3 });
  }
  return { shots, props };
}
function maybeStory(lv, go) {
  if (VS && VS.active) return false;
  const id = STORY_AT[lv.id];
  if (!id || cutsSeen()[id] || !G.layout) return false;
  const { shots, props } = storyShots(id, G.layout);
  playCutscene(id, shots, go, { props });
  return true;
}
function bossCutscene(room) {
  const type = room.boss;
  if ((VS && VS.active) || G.mode !== 'campaign' || !STORY[type] || (G.level && G.level.prime) || cutsSeen()[type] || G.state !== 'play') return false;
  const def = DEFS[type];
  const md = codexModel(type);
  md.root.position.set(room.cx, 0, room.cz);
  md.root.rotation.y = Math.atan2(P.pos.x - room.cx, P.pos.z - room.cz);
  scene.add(md.root);
  const c = new V3(room.cx, 0, room.cz);
  const to = new V3(P.pos.x - room.cx, 0, P.pos.z - room.cz).normalize();
  const a = Math.atan2(to.x, to.z);
  const h = def.h || 4;
  const lines = STORY[type].lines;
  const shots = [
    { from: c.clone().addScaledVector(to, 10).setY(1.5), to: c.clone().addScaledVector(to, 6.5).setY(2), look: c.clone().setY(h * 0.9), line: lines[0], onStart: () => { sfx.bossRoar(); G.shake = 0.5; } },
    { orbit: c, r: Math.max(6, h * 1.6), y: h * 0.75, lookY: h * 0.7, a0: a - 0.7, a1: a + 0.5, line: lines[1] },
  ];
  playCutscene(type, shots, () => { scene.remove(md.root); requestLock(); spawnBoss(room); }, { props: [md.root] });
  return true;
}
function playEnding(done) {
  const L = G.layout, st = STORY.ending;
  const r = L.rooms.find((x) => x.boss) || L.rooms[0];
  const c = new V3(r.cx, 0, r.cz);
  const shots = [
    { orbit: c, r: r.w * 0.45, y: 9, lookY: 0.5, a0: 0, a1: 1.2, line: st.lines[0] },
    { from: c.clone().add(new V3(-r.w * 0.4, 2.5, r.d * 0.4)), to: c.clone().add(new V3(r.w * 0.3, 4, r.d * 0.3)), look: c.clone().setY(1), line: st.lines[1] },
    { orbit: c, r: r.w * 0.3, y: 14, lookY: 0, a0: 2, a1: 2.8, line: st.lines[2] },
    { orbit: c, r: r.w * 0.3, y: 20, lookY: 0, a0: 2.8, a1: 3.2, card: st.card, sub: st.sub, dur: 4.5, hold: 1 },
  ];
  playCutscene('ending', shots, done);
}

// ================================================================ SOUND OVERHAUL (batch 4.4c)
//  room reverb · 3D panning + wall occlusion · layered weapons · enemy voices · music ducking
var OUT = null;                 // when set, noise()/tone() route here (a spatial chain) instead of sfxBus
var LAYER = 0.5; // overall level of the layered one-shots below
var REV = null, revWet = null, revKey = '', crunch = null, comp = null, voicesLive = 0, chatterT = 3, beatT = 0;
const sRay = new THREE.Raycaster();
const REVERBS = { menu: [1.3, 0.1], cellar: [1.7, 0.2], cathedral: [3.6, 0.36], kiln: [1.1, 0.14], boss: [2.5, 0.26], pit: [2.0, 0.22] };

function audioFX() {
  if (!AC || REV) return;
  REV = AC.createConvolver();
  revWet = AC.createGain(); revWet.gain.value = 0;
  sfxBus.connect(revWet); revWet.connect(REV); REV.connect(master);
  // glue compressor so stacked gunfire punches instead of clipping
  comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.18;
  sfxBus.disconnect(); sfxBus.connect(comp); comp.connect(master); sfxBus.connect(revWet);
  // soft-clip bus that gives gunshots their crunch
  crunch = AC.createWaveShaper();
  const c = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; c[i] = Math.tanh(x * 3.2) * 0.85; }
  crunch.curve = c; crunch.oversample = '2x';
  crunch.connect(sfxBus);
  setReverb('menu');
}
function makeIR(sec) {
  const n = Math.floor(AC.sampleRate * sec), ir = AC.createBuffer(2, n, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3.2;
    // a few early reflections off the brick walls
    for (let k = 0; k < 6; k++) { const at = Math.floor(AC.sampleRate * (0.008 + k * 0.013 + Math.random() * 0.01)); if (at < n) d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.7 - k * 0.09); }
  }
  return ir;
}
function setReverb(key) {
  if (!REV || key === revKey) return;
  revKey = key;
  const [sec, wet] = REVERBS[key] || REVERBS.menu;
  REV.buffer = makeIR(sec);
  revWet.gain.cancelScheduledValues(AC.currentTime);
  revWet.gain.setTargetAtTime(wet, AC.currentTime, 0.4);
}
function setListener() {
  if (!AC) return;
  const L = AC.listener, p = camera.position, f = new V3(); camera.getWorldDirection(f);
  const u = new V3(0, 1, 0).applyQuaternion(camera.quaternion);
  if (L.positionX) {
    const t = AC.currentTime;
    L.positionX.setValueAtTime(p.x, t); L.positionY.setValueAtTime(p.y, t); L.positionZ.setValueAtTime(p.z, t);
    L.forwardX.setValueAtTime(f.x, t); L.forwardY.setValueAtTime(f.y, t); L.forwardZ.setValueAtTime(f.z, t);
    L.upX.setValueAtTime(u.x, t); L.upY.setValueAtTime(u.y, t); L.upZ.setValueAtTime(u.z, t);
  } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
}
// run fn with its sounds placed at world position p (panned, muffled behind walls / with distance)
function spatial(p, fn) {
  if (!AC || !p || !sfxBus || G.state === 'menu') return fn();
  const prev = OUT;
  const pos = p.clone ? p : new V3(p.x, p.y || 0, p.z);
  const d = camera.position.distanceTo(pos);
  if (d < 1.2) return fn();
  const pan = AC.createPanner();
  pan.panningModel = 'equalpower'; pan.distanceModel = 'linear'; pan.rolloffFactor = 0;
  if (pan.positionX) { pan.positionX.value = pos.x; pan.positionY.value = pos.y; pan.positionZ.value = pos.z; } else pan.setPosition(pos.x, pos.y, pos.z);
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass';
  let hz = Math.max(2600, 19000 - d * 260), gain = 1;
  if (d > 3 && worldMeshes.length) {
    const dir = pos.clone().sub(camera.position);
    sRay.set(camera.position, dir.normalize()); sRay.far = Math.max(0.1, d - 1.2);
    if (sRay.intersectObjects(worldMeshes, false).length) { hz = 750; gain = 0.6; }
  }
  lp.frequency.value = hz;
  const g = AC.createGain(); g.gain.value = gain;
  lp.connect(g); g.connect(pan); pan.connect(sfxBus);
  OUT = lp;
  try { fn(); } finally { OUT = prev; }
  setTimeout(() => { try { pan.disconnect(); } catch (_) {} }, 4000);
}
function sfxAt(p, name, ...args) { spatial(p, () => sfx[name](...args)); }

// richer one-shot helpers (delay, own destination)
function nz(dur, freq, vol, o = {}) {
  if (!AC || vol <= 0) return;
  vol *= LAYER;
  const t = AC.currentTime + (o.delay || 0);
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = o.q || 0.8;
  if (o.end) f.frequency.exponentialRampToValueAtTime(o.end, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.002)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(OUT || o.dest || sfxBus);
  src.start(t, Math.random() * 0.6); src.stop(t + dur + 0.02);
}
function tn(f1, f2, dur, vol, type = 'sine', o = {}) {
  if (!AC || vol <= 0) return;
  vol *= LAYER;
  const t = AC.currentTime + (o.delay || 0);
  const osc = AC.createOscillator(); osc.type = type;
  osc.frequency.setValueAtTime(f1, t); osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.003)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g); g.connect(OUT || o.dest || sfxBus);
  osc.start(t); osc.stop(t + dur + 0.02);
}
// music ducks under big hits so they land
function duck(a, hold = 0.12) {
  if (!musicBus) return;
  const g = musicBus.gain, t = AC.currentTime, base = settings.music;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(base * (1 - a), t + 0.025);
  g.setTargetAtTime(base, t + hold, 0.3);
}
const crumble = (n, vol, spread = 0.5, base = 0) => { for (let i = 0; i < n; i++) nz(0.05 + Math.random() * 0.08, 1200 + Math.random() * 3500, vol * (0.5 + Math.random() * 0.5), { type: 'bandpass', q: 3, delay: base + Math.random() * spread }); };

Object.assign(sfx, {
  revolver() {
    nz(0.025, 6500, 0.55, { type: 'highpass' });
    nz(0.14, 3000, 0.9, { end: 600, dest: crunch });
    tn(170, 45, 0.2, 0.75, 'sine');
    tn(240, 90, 0.08, 0.25, 'square', { dest: crunch });
    nz(0.5, 1000, 0.2, { end: 180, delay: 0.025 });
    nz(0.03, 3800, 0.13, { type: 'bandpass', q: 7, delay: 0.17 });
    duck(0.12, 0.05);
  },
  charged() {
    nz(0.03, 7000, 0.7, { type: 'highpass' });
    nz(0.55, 5200, 1.0, { end: 300, dest: crunch });
    tn(1700, 70, 0.5, 0.35, 'sawtooth', { dest: crunch });
    tn(110, 28, 0.8, 1.0, 'sine');
    nz(1.1, 1200, 0.32, { end: 120, delay: 0.04 });
    duck(0.35, 0.15);
  },
  shotgun() {
    nz(0.03, 5000, 0.7, { type: 'highpass' });
    nz(0.38, 2000, 1.2, { end: 220, dest: crunch });
    tn(95, 28, 0.5, 1.0, 'sine');
    tn(130, 50, 0.22, 0.45, 'sawtooth', { dest: crunch });
    nz(0.9, 750, 0.34, { end: 110, delay: 0.04 });
    // spent shells hitting the floor
    tn(3300, 2700, 0.05, 0.05, 'triangle', { delay: 0.42 }); tn(2900, 2500, 0.04, 0.04, 'triangle', { delay: 0.5 });
    duck(0.3, 0.1);
  },
  pump() { nz(0.05, 2200, 0.32, { type: 'bandpass', q: 3 }); tn(400, 200, 0.04, 0.12, 'square'); nz(0.06, 1500, 0.3, { type: 'bandpass', q: 3, delay: 0.09 }); tn(300, 160, 0.05, 0.12, 'square', { delay: 0.09 }); },
  punch() { nz(0.02, 5000, 0.35, { type: 'highpass' }); nz(0.14, 1000, 0.75, { end: 200, dest: crunch }); tn(150, 40, 0.16, 0.8, 'sine'); crumble(3, 0.12, 0.08); },
  parry() { tn(1300, 1900, 0.35, 0.35, 'triangle'); tn(2000, 2600, 0.3, 0.2, 'sine', { delay: 0.04 }); tn(3950, 3900, 0.6, 0.06, 'sine'); nz(0.15, 6000, 0.3, { type: 'highpass' }); tn(90, 40, 0.3, 0.6); duck(0.4, 0.2); },
  explode() {
    nz(0.04, 6000, 0.8, { type: 'highpass' });
    nz(0.6, 1800, 1.3, { end: 120, dest: crunch });
    tn(70, 20, 1.2, 1.1, 'sine');
    tn(120, 35, 0.4, 0.5, 'sawtooth', { dest: crunch });
    nz(1.8, 420, 0.55, { end: 40, delay: 0.05, a: 0.05 });
    crumble(9, 0.16, 0.9, 0.15);
    duck(0.55, 0.25);
  },
  kill() {
    nz(0.22, 2000, 0.5, { end: 300, dest: crunch });
    tn(200, 55, 0.22, 0.45, 'sine');
    crumble(6, 0.17, 0.35);
    nz(0.5, 600, 0.2, { end: 90, delay: 0.05 });
  },
  slam() {
    nz(0.05, 4000, 0.7, { type: 'highpass' });
    nz(0.7, 700, 1.3, { end: 45, dest: crunch });
    tn(65, 20, 0.8, 1.1, 'sine');
    crumble(8, 0.15, 0.6, 0.08);
    duck(0.5, 0.2);
  },
  heavySlam(v) { nz(0.65, 450, 1.0 * v, { end: 40, dest: crunch }); tn(55, 22, 0.6, 0.9 * v); crumble(4, 0.1 * v, 0.4, 0.05); },
  nail() { nz(0.045, 4200, 0.2, { type: 'bandpass', q: 3 }); tn(1500, 900, 0.035, 0.05, 'square'); tn(180, 80, 0.04, 0.12); },
  hurt() { tn(190, 80, 0.3, 0.55, 'sawtooth', { dest: crunch }); nz(0.22, 600, 0.45); tn(60, 30, 0.3, 0.6); duck(0.3, 0.1); },
  heartbeat(v) { tn(70, 40, 0.12, 0.5 * v); tn(60, 35, 0.14, 0.4 * v, 'sine', { delay: 0.17 }); },
});

// ---------------------------------------------------------------- enemy voices
// [pitch Hz, formant 1, formant 2, growl 0..1, length s, waveform]
const VOICES = {
  grunt: [92, 620, 1080, 0.55, 0.34], shooter: [138, 720, 1500, 0.35, 0.3], flyer: [430, 1000, 2700, 0.2, 0.24, 'sawtooth'],
  heavy: [52, 380, 760, 0.85, 0.55], shield: [84, 560, 980, 0.5, 0.36], sniper: [122, 480, 1700, 0.15, 0.3],
  bomber: [104, 900, 2200, 0.7, 0.3], priest: [128, 520, 860, 0.05, 0.6, 'square'], ram: [68, 420, 820, 0.9, 0.45],
  burrower: [76, 340, 1200, 0.7, 0.36], mender: [190, 680, 2100, 0.05, 0.3, 'sawtooth'], swarmling: [640, 1500, 3200, 0, 0.1, 'square'],
  cat: [560, 900, 2200, 0, 0.32, 'sawtooth'], boss1: [46, 330, 680, 0.9, 0.8], boss2: [70, 520, 900, 0.4, 0.7, 'square'], boss3: [40, 300, 640, 1, 0.9],
  shard: [260, 820, 2600, 0, 0.4, 'square'], bertha: [80, 600, 1000, 0.6, 0.45], kite: [210, 760, 1900, 0.2, 0.3],
};
function voiceOf(e) { return VOICES[e.type] || VOICES[e.animType] || (e.def.boss ? VOICES.boss1 : VOICES.grunt); }
function voice(e, kind) {
  if (!AC || !e || !e.mesh || e.dummy || G.state !== 'play' && G.state !== 'cutscene') return;
  if (voicesLive >= 4 && kind !== 'die') return;
  if (kind !== 'die' && G.time - (e.vT || -9) < (kind === 'hurt' ? 0.7 : 1.5)) return;
  if (e.type === 'swarmling' && Math.random() < (kind === 'die' ? 0.6 : 0.9)) return;
  const pos = e.mesh.position.clone(); pos.y += (e.def.h || 1.8) * 0.8;
  const v = distVol(pos); if (v < 0.12) return;
  e.vT = G.time;
  const [f0, f1, f2, growl, len0, wave] = voiceOf(e);
  const jit = 0.9 + Math.random() * 0.2;
  const len = len0 * ({ alert: 1, hurt: 0.55, die: 1.7, idle: 0.9 }[kind] || 1);
  // pitch contour per kind: [start, peak, end] multipliers
  const C = { alert: [1, 1.35, 0.85], hurt: [1.7, 1.5, 1.05], die: [1.45, 1.2, 0.62], idle: [0.95, 1.08, 0.9] }[kind] || [1, 1, 1];
  voicesLive++;
  setTimeout(() => { voicesLive--; }, len * 1000 + 50);
  spatial(pos, () => {
    const t = AC.currentTime, out = OUT || sfxBus;
    const o = AC.createOscillator(); o.type = wave || 'sawtooth';
    o.frequency.setValueAtTime(f0 * C[0] * jit, t);
    o.frequency.linearRampToValueAtTime(f0 * C[1] * jit, t + len * 0.3);
    o.frequency.exponentialRampToValueAtTime(f0 * C[2] * jit, t + len);
    // vibrato makes it sound alive
    const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 5 + Math.random() * 3; lg.gain.value = f0 * 0.04;
    lfo.connect(lg); lg.connect(o.frequency);
    const amp = AC.createGain(); const peak = 0.3 * v * LAYER * 1.6 * (kind === 'die' ? 1.4 : 1);
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + 0.02); amp.gain.setValueAtTime(peak, t + len * 0.6); amp.gain.exponentialRampToValueAtTime(0.001, t + len);
    // growl: amplitude flutter
    if (growl > 0) {
      const gl = AC.createOscillator(), gg = AC.createGain(); gl.type = 'square'; gl.frequency.value = 24 + Math.random() * 14; gg.gain.value = peak * growl * 0.5;
      gl.connect(gg); gg.connect(amp.gain); gl.start(t); gl.stop(t + len + 0.05);
    }
    // two vowel formants (they slide a little for a 'word')
    const fbank = [];
    for (const [ff, q, gv] of [[f1, 5, 1], [f2, 7, 0.6]]) {
      const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(ff * jit, t); bp.frequency.linearRampToValueAtTime(ff * jit * (kind === 'die' ? 0.7 : 1.15), t + len);
      const fg = AC.createGain(); fg.gain.value = gv * 2.2;
      o.connect(bp); bp.connect(fg); fg.connect(amp); fbank.push(bp);
    }
    if (growl > 0.3) nz(len, f1, 0.12 * v * growl, { type: 'bandpass', q: 2 });
    amp.connect(out);
    // octave-up double so deep voices keep their body
    const o2 = AC.createOscillator(); o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(f0 * C[0] * jit * 2, t); o2.frequency.linearRampToValueAtTime(f0 * C[1] * jit * 2, t + len * 0.3); o2.frequency.exponentialRampToValueAtTime(f0 * C[2] * jit * 2, t + len);
    const o2g = AC.createGain(); o2g.gain.value = f0 < 120 ? 0.6 : 0.2; o2.connect(o2g);
    for (const bp of fbank) o2g.connect(bp);
    o.start(t); o.stop(t + len + 0.05); lfo.start(t); lfo.stop(t + len + 0.05); o2.start(t); o2.stop(t + len + 0.05);
  });
}
function voiceSoon(e, kind, delay) { setTimeout(() => { if (!e.dead) voice(e, kind); }, delay * 1000 * (0.6 + Math.random() * 0.8)); }

// per-frame: listener, reverb per room, idle chatter, low-HP heartbeat
var tickLast = 0;
function tickAudio(theme) {
  const now = performance.now(), dt = Math.min(0.1, (now - (tickLast || now)) / 1000); tickLast = now;
  if (!AC) return;
  audioFX();
  setListener();
  setReverb(theme);
  if (G.state !== 'play') return;
  chatterT -= dt;
  if (chatterT <= 0) {
    chatterT = 4 + Math.random() * 4;
    const near = enemies.filter((e) => !e.dead && e.spawnT <= 0 && e.mesh.position.distanceTo(P.pos) < 32);
    if (near.length) voice(near[(Math.random() * near.length) | 0], 'idle');
  }
  if (P.hp > 0 && P.hp < 30) {
    beatT -= dt;
    if (beatT <= 0) { beatT = 0.55 + P.hp / 60; sfx.heartbeat(1 - P.hp / 40); }
  } else beatT = 0;
}

// ================================================================ BATCH 5a: THE CHAIN FLAIL (weapon 5)
const HALF_PI = Math.PI / 2;
VARIANTS.push([{ name: 'HOOK', hex: 0xffb03a, css: '#ffc04a' }, { name: 'SPIKE', hex: 0xff3a4a, css: '#ff6a5a' }, { name: 'MAGNET', hex: 0x3ac8ff, css: '#6ad8ff' }]);
SHOP.push(
  { id: 'flail', gun: 4, v: 0, price: 1000, desc: 'Unlocks the CHAIN FLAIL: HOLD FIRE to whirl a wrecking ball around you, RELEASE to sweep everything in front. HOOK alt-fire hurls the ball to yank an enemy in.' },
  { id: 'flail1', gun: 4, v: 1, price: 900, req: 'flail', desc: 'Flail variant. The spiked ball PIERCES shields, shield layers and IRON armor. ALT brings it crashing down where you aim.' },
  { id: 'flail2', gun: 4, v: 2, price: 950, req: 'flail', desc: 'Flail variant. The whirling ball DRAGS nearby enemies into its path. Flail kills pack RUBBLE into it; ALT hurls the rubble as a blast.' },
);
WNAMES.push('FLAIL');
W.variant.push(0);
fresh.flail = 1;
CHAIN_W.add('flail');
var FLAIL = { held: false, wind: 0, ang: 0, swingT: 0, swingC: 0, swingA: 0, altCD: 0, rubble: 0, whooshT: 0, smash: [] };

const FLVM = (() => {
  const M = VM.skinMats;
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.95 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x442211, emissive: 0xffb03a, emissiveIntensity: 1.2 });
  const mk = (geo, mat, parent, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
  mk(new THREE.CylinderGeometry(0.032, 0.038, 0.4, 8), wood, g, 0, 0, 0);
  for (const y of [-0.14, -0.08, -0.02]) mk(new THREE.CylinderGeometry(0.041, 0.041, 0.035, 8), leather, g, 0, y, 0);
  mk(new THREE.SphereGeometry(0.05, 8, 6), M.brass, g, 0, -0.22, 0);
  mk(new THREE.CylinderGeometry(0.045, 0.04, 0.05, 8), M.steel, g, 0, 0.21, 0);
  mk(new THREE.BoxGeometry(0.1, 0.09, 0.1), leather, g, 0.0, -0.08, 0.04);                     // glove
  const pivot = new THREE.Group(); pivot.position.set(0, 0.24, 0); g.add(pivot);
  const link = new THREE.TorusGeometry(0.022, 0.007, 4, 8);
  const links = [];
  for (let i = 0; i < 6; i++) links.push(mk(link, M.dsteel, pivot, 0, 0.03 + i * 0.035, 0, 0, i % 2 ? HALF_PI : 0, 0));
  const ball = new THREE.Group(); ball.position.set(0, 0.29, 0); pivot.add(ball);
  mk(new THREE.SphereGeometry(0.085, 12, 9), M.dsteel, ball, 0, 0, 0);
  mk(new THREE.TorusGeometry(0.087, 0.012, 4, 14), accent, ball, 0, 0, 0, HALF_PI, 0, 0);
  const hookG = new THREE.Group(); ball.add(hookG);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; mk(new THREE.ConeGeometry(0.02, 0.09, 5), M.brass, hookG, Math.cos(a) * 0.08, 0.05, Math.sin(a) * 0.08, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
  const spikeG = new THREE.Group(); ball.add(spikeG);
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, 0.7, 0], [0.7, -0.7, 0], [-0.7, -0.7, 0], [0, 0.7, 0.7], [0, -0.7, -0.7]];
  for (const [x, y, z] of dirs) { const c = mk(new THREE.ConeGeometry(0.018, 0.07, 5), M.steel, spikeG, x * 0.1, y * 0.1, z * 0.1); c.lookAt(x * 2, y * 2, z * 2); c.rotateX(HALF_PI); }
  const magG = new THREE.Group(); ball.add(magG);
  const magMat = new THREE.MeshStandardMaterial({ color: 0xc81e1e, emissive: 0x3a0606, metalness: 0.5 });
  mk(new THREE.TorusGeometry(0.07, 0.025, 6, 12, Math.PI), magMat, magG, 0, 0.09, 0);
  for (const sd of [-1, 1]) mk(new THREE.BoxGeometry(0.05, 0.03, 0.05), M.steel, magG, sd * 0.07, 0.09, 0);
  g.userData.base = new V3(0.27, -0.21, -0.55);
  g.scale.setScalar(0.72);
  g.rotation.order = 'YXZ';
  g.visible = false;
  return { g, pivot, ball, links, accent, variants: [hookG, spikeG, magG] };
})();
vmScene.add(FLVM.g);
guns.push(FLVM.g);

// the real ball in the world (whirl + sweep) with its chain
const flailBall = new THREE.Group();
{
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.8, roughness: 0.35 }));
  flailBall.add(core);
  const sp = new THREE.ConeGeometry(0.07, 0.3, 5), spm = new THREE.MeshStandardMaterial({ color: 0x8a8a94, metalness: 0.9, roughness: 0.3 });
  for (let i = 0; i < 10; i++) { const c = new THREE.Mesh(sp, spm); const a = i * 2.4, b = Math.acos(1 - 2 * (i + 0.5) / 10); c.position.set(Math.sin(b) * Math.cos(a) * 0.38, Math.cos(b) * 0.38, Math.sin(b) * Math.sin(a) * 0.38); c.lookAt(c.position.clone().multiplyScalar(3)); c.rotateX(HALF_PI); flailBall.add(c); }
  flailBall.userData.glow = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 5, 16), new THREE.MeshBasicMaterial({ color: 0xffb03a }));
  flailBall.userData.glow.rotation.x = HALF_PI; flailBall.add(flailBall.userData.glow);
}
flailBall.scale.setScalar(1.3);
flailBall.visible = false;
scene.add(flailBall);
const flailChain = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]), new THREE.LineBasicMaterial({ color: 0x9a9aa4 }));
flailChain.frustumCulled = false; flailChain.visible = false;
scene.add(flailChain);

Object.assign(sfx, {
  flailSpin(k) { nz(0.28, 500 + k * 1800, 0.35 + k * 0.3, { type: 'bandpass', q: 1.4, end: 260, a: 0.08 }); },
  flailSweep(k) { nz(0.35, 2600, 0.6 + k * 0.4, { type: 'bandpass', q: 1, end: 400, a: 0.03 }); tn(120, 50, 0.25, 0.3 + k * 0.3); },
  flailHit(k) { nz(0.25, 1600, 0.9, { end: 200, dest: crunch }); tn(90, 30, 0.35, 0.7 + k * 0.4); crumble(5, 0.18, 0.25); },
  chain() { for (let i = 0; i < 4; i++) tn(2400 + Math.random() * 1600, 1800, 0.04, 0.08, 'triangle', { delay: i * 0.035 }); },
});

const fwdOf = (yaw) => new V3(-Math.sin(yaw), 0, -Math.cos(yaw));
function flailHand() { return camera.position.clone().add(new V3(0.35, -0.45, -0.3).applyQuaternion(camera.quaternion)); }
function flailHitEnemy(e, dmg, k, dir, v, label) {
  if (e.dead || e.spawnT > 0 || e.buried) return false;
  if (v === 1) { if (e.layers > 0) stripLayer(e); if (e.shieldUp) breakShield(e, dir.clone().negate()); }
  const pt = e.mesh.position.clone(); pt.y += e.def.h * 0.55;
  const knock = dir.clone().multiplyScalar((8 + 18 * k) / Math.max(0.6, Math.sqrt(e.def.mass))).setY(4 + 5 * k);
  const killed = damageEnemy(e, dmg, { weapon: 'flail', point: pt, knock: e.def.boss ? null : knock, pierce: v === 1, explosion: false });
  burst(pt, 8, 0x8a6a4a, 7, 0.14, 0.5);
  if (killed && v === 2 && FLAIL.rubble < 6) FLAIL.rubble++;
  if (label) addStyle(30, label, 'flail', 'cool');
  return true;
}
function whirl(dt, v) {
  const k = FLAIL.wind;
  FLAIL.ang += dt * (6 + k * 10);
  const r = 2.1 + k * 0.6;
  const c = new V3(P.pos.x + Math.cos(FLAIL.ang) * r, P.pos.y + 1.2 + Math.sin(FLAIL.ang * 2) * 0.15, P.pos.z + Math.sin(FLAIL.ang) * r);
  flailBall.position.copy(c); flailBall.visible = true; flailBall.rotation.y += dt * 9;
  FLAIL.whooshT -= dt;
  if (FLAIL.whooshT <= 0) { FLAIL.whooshT = Math.PI * 2 / (6 + k * 10) * 0.5; sfx.flailSpin(k); }
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0 || e.buried) continue;
    const ep = e.mesh.position;
    const dy = (ep.y + (e.def.fly ? 0 : e.def.h * 0.5)) - c.y;
    const d = Math.hypot(ep.x - c.x, ep.z - c.z);
    if (v === 2 && !e.def.boss && e.def.mass <= 1.6) {
      const dp = Math.hypot(ep.x - P.pos.x, ep.z - P.pos.z);
      if (dp < 8 && dp > r) { e.vel.x += (P.pos.x - ep.x) / dp * 22 * dt; e.vel.z += (P.pos.z - ep.z) / dp * 22 * dt; }
    }
    if (d < 0.6 + e.def.r && Math.abs(dy) < e.def.h * 0.6 + 0.5 && G.time > (e.flT || 0)) {
      e.flT = G.time + 0.3;
      const out = new V3(ep.x - P.pos.x, 0, ep.z - P.pos.z).normalize();
      flailHitEnemy(e, 7 + k * 9, 0.3, out, v);
      sfx.flailHit(0.2);
    }
  }
}
function flailSweep(k, v) {
  const fwd = fwdOf(P.yaw);
  const range = 3.4 + k * 2.8, arc = 1.25, dmg = k < 0.2 ? 28 : 30 + 95 * k;
  FLAIL.swingT = 0.24; FLAIL.swingC = k; FLAIL.swingA = 0;
  sfx.flailSweep(k);
  let n = 0;
  for (const e of enemies.slice()) {
    if (e.dead || e.spawnT > 0 || e.buried) continue;
    const to = e.mesh.position.clone().sub(P.pos); const dy = to.y; to.y = 0;
    const d = to.length() - e.def.r;
    if (d > range || dy > 3.2 || dy < -2.4 - e.def.h) continue;
    if (d > 0.4 && Math.acos(clamp(to.normalize().dot(fwd), -1, 1)) > arc) continue;
    if (flailHitEnemy(e, dmg, k, d > 0.4 ? to : fwd, v)) n++;
  }
  // knock orbs back like a parry
  for (const o of orbs) {
    if (!o.m || o.parried) continue;
    const to = o.m.position.clone().sub(P.pos); if (to.length() > range + 0.5) continue;
    if (to.clone().setY(0).normalize().dot(fwd) < 0.2) continue;
    const { dir } = aim();
    o.parried = true; o.dmg = o.big ? 170 : 90; o.life = 4; o.vel.copy(dir).multiplyScalar(42);
    o.m.material.color.set(0x9ae8ff); o.glow.material.color.set(0x3ac8ff);
    sfx.parry(); heal(25); addStyle(100, 'FLAIL PARRY', 'flail', 'big'); pushFeed('+25 HP', 'heal');
  }
  if (k >= 0.6) breakSecretsInFront(range);
  if (n) {
    sfx.flailHit(k);
    G.hitstop = Math.max(G.hitstop, 0.04 + k * 0.05);
    G.shake = Math.max(G.shake, 0.2 + k * 0.4);
    useWeapon('flail');
    if (k >= 1) addStyle(60, 'WRECKING BALL', 'flail', 'big');
    if (n >= 3) addStyle(40 + n * 20, 'DEMOLITION SWEEP', 'flail', 'big');
    else addStyle(10 * n, null, 'flail');
  }
}
function flailAltFire(v) {
  if (v === 0) {                                   // HOOK: throw the ball, yank what it catches
    FLAIL.altCD = 1.3;
    const { origin, dir } = aim();
    ray.set(origin, dir); ray.far = 28;
    const h = ray.intersectObjects(rayTargets(), false)[0];
    sfx.chain();
    const end = h ? h.point : origin.clone().addScaledVector(dir, 28);
    tracer(flailHand(), end, 0x9a9aa4, 0.03, 0.25);
    const e = h && h.object.userData.enemy;
    if (!e || e.dead) return;
    damageEnemy(e, 15, { weapon: 'flail', point: h.point.clone() });
    if (e.dead) return;
    if (!e.def.boss && e.def.mass <= 1.6) {
      const pull = P.pos.clone().sub(e.mesh.position); pull.y = 0;
      e.vel.copy(pull.multiplyScalar(2.4)).setY(6); e.grounded = false;
      if (e.state === 'dive') { e.state = 'recover'; e.t = 0.6; }
      addStyle(40, 'HOOKED', 'flail', 'cool');
    } else {
      const to = h.point.clone().sub(P.pos); const d = to.length();
      P.vel.copy(to.normalize().multiplyScalar(Math.min(30, 10 + d))).setY(Math.max(P.vel.y, 7)); P.grounded = false;
      addStyle(20, 'REELED IN', 'flail');
    }
    useWeapon('flail');
  } else if (v === 1) {                            // SPIKE: overhead smash where you aim
    FLAIL.altCD = 1.6;
    const { origin, dir } = aim();
    ray.set(origin, dir); ray.far = 16;
    const h = ray.intersectObjects(worldMeshes, false)[0];
    const p = h ? h.point.clone() : origin.clone().addScaledVector(dir, 16);
    p.y = Math.max(0, floorAt(p.x, p.z, p.y + 0.5));
    FLAIL.smash.push({ p, t: 0.32 });
    ringFx(p.clone().setY(p.y + 0.05), 3.4, 0xff5a3a);
    sfx.chain();
  } else {                                         // MAGNET: hurl the packed rubble
    if (FLAIL.rubble <= 0) { pushFeed('NO RUBBLE · kill with the flail to pack it', 'bad'); FLAIL.altCD = 0.4; return; }
    FLAIL.altCD = 0.9;
    const n = 4 + FLAIL.rubble * 2;
    const { origin, dir } = aim();
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.11)).normalize();
      ray.set(origin, d); ray.far = 40;
      const h = ray.intersectObjects(rayTargets(), false)[0];
      tracer(muzzle(), h ? h.point : origin.clone().addScaledVector(d, 40), 0xc8784a, 0.035, 0.12);
      const e = h && h.object.userData.enemy;
      if (e && !e.dead) damageEnemy(e, 11, { weapon: 'flail', point: h.point.clone(), knock: d.clone().multiplyScalar(3) });
      else if (h) burst(h.point, 3, 0x8a5a3a, 4, 0.1, 0.4);
    }
    statShot();
    sfx.shotgun(); W.kick = 1;
    if (FLAIL.rubble >= 6) addStyle(60, 'LANDSLIDE', 'flail', 'big'); else addStyle(20, 'RUBBLE BLAST', 'flail', 'cool');
    FLAIL.rubble = 0;
    useWeapon('flail');
  }
}
function updateFlail(dt) {
  const v = W.variant[4];
  if (down('fire') && W.cd <= 0 && FLAIL.swingT <= 0) {
    if (!FLAIL.held) { FLAIL.held = true; FLAIL.wind = 0; sfx.chain(); statShot(); }
    FLAIL.wind = Math.min(1, FLAIL.wind + dt / 0.85);
    whirl(dt, v);
  } else if (FLAIL.held) {
    FLAIL.held = false;
    flailSweep(FLAIL.wind, v);
    FLAIL.wind = 0; W.cd = 0.42;
  }
  if (hit('alt') && FLAIL.altCD <= 0 && !FLAIL.held) flailAltFire(v);
}
// runs every frame whatever is equipped: swing animation, smashes, cooldowns
function flailTick(dt) {
  FLAIL.altCD -= dt;
  if (W.cur !== 4 && FLAIL.held) { FLAIL.held = false; FLAIL.wind = 0; }
  if (FLAIL.swingT > 0) {
    FLAIL.swingT -= dt;
    const u = 1 - Math.max(0, FLAIL.swingT) / 0.24;
    const a = P.yaw + 1.3 - u * 2.6, r = 2.6 + FLAIL.swingC * 2.2;
    flailBall.position.set(P.pos.x - Math.sin(a) * r, P.pos.y + 1.3 - u * 0.3, P.pos.z - Math.cos(a) * r);
    flailBall.visible = true;
  } else if (!FLAIL.held) flailBall.visible = false;
  for (let i = FLAIL.smash.length - 1; i >= 0; i--) {
    const s = FLAIL.smash[i];
    s.t -= dt;
    if (s.t <= 0) {
      FLAIL.smash.splice(i, 1);
      explode(s.p, 3.6, 70, 'flail');
      shockwave(s.p, 16, 7, 0);
      addStyle(20, 'SPIKE DROP', 'flail', 'cool');
    }
  }
  flailChain.visible = flailBall.visible;
  if (flailChain.visible) {
    const pa = flailChain.geometry.attributes.position;
    const h = flailHand();
    pa.setXYZ(0, h.x, h.y, h.z); pa.setXYZ(1, flailBall.position.x, flailBall.position.y, flailBall.position.z); pa.needsUpdate = true;
    flailBall.userData.glow.material.color.setHex(VARIANTS[4][W.variant[4]].hex);
  }
}
function flailVM(dt) {
  FLVM.variants.forEach((g, i) => (g.visible = i === W.variant[4]));
  FLVM.accent.emissive.setHex(VARIANTS[4][W.variant[4]].hex);
  FLVM.accent.emissiveIntensity = 1.1 + FLAIL.wind * 3 + (FLAIL.rubble ? Math.sin(G.time * 8) * 0.4 : 0);
  // ball hangs and sways; while whirling it leaves the viewmodel (the world ball takes over)
  FLVM.ball.visible = !(flailBall.visible && W.cur === 4);
  FLVM.links.forEach((l) => (l.visible = FLVM.ball.visible));
  FLVM.pivot.rotation.z = Math.PI - 0.75 + Math.sin(G.time * 2.2) * 0.12 - swayX * 0.001;
  FLVM.pivot.rotation.x = Math.sin(G.time * 1.7) * 0.1 + (P.vel.y || 0) * 0.01;
  FLVM.g.rotation.x += (FLAIL.held ? -0.6 : 0) - 0.35;
  FLVM.g.rotation.z += 0.3;
}
function flailAlt() {
  const v = W.variant[4];
  if (FLAIL.held) return FLAIL.wind >= 1 ? 'WRECKING BALL READY' : 'WINDING ' + '▮'.repeat(Math.round(FLAIL.wind * 5)) + '▯'.repeat(5 - Math.round(FLAIL.wind * 5));
  if (v === 2) return 'RUBBLE ' + '■'.repeat(FLAIL.rubble) + '□'.repeat(6 - FLAIL.rubble);
  return (v === 0 ? 'HOOK' : 'SPIKE DROP') + (FLAIL.altCD > 0 ? ' ···' : ' READY');
}

// ================================================================ BATCH 5b: ELITE ENEMIES
const ELITES = {
  iron: { name: 'IRON', hp: 1.8, speed: 0.9, color: 0x9aa4b4, emissive: 0x2a3a5a, glow: 0x8ac8ff, style: 120 },
  ember: { name: 'EMBER', hp: 1.5, speed: 1.25, color: 0xff7a3a, emissive: 0xff4a0a, glow: 0xff7a2a, style: 100 },
};
const ELITE_OK = new Set(['grunt', 'shooter', 'flyer', 'heavy', 'shield', 'sniper', 'priest', 'ram', 'burrower', 'mender']);
const fireballs = [];
const fireballMat = new THREE.SpriteMaterial({ map: GLOW, color: 0xff6a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
function eliteChance() {
  if (G.mode === 'endless') return G.wave >= 6 ? Math.min(0.2, 0.025 * (G.wave - 4)) : 0;
  if (G.mode !== 'campaign' || !G.level || G.level.duel || G.level.prime) return 0;
  const si = SCENES.indexOf(G.level.scene), num = Number(String(G.level.id).split('-')[1]) || 1;
  if (si <= 0) return num >= 3 ? 0.05 : 0;
  return 0.04 + si * 0.03 + num * 0.003;
}
function maybeElite(e) {
  if (e.def.boss || e.dummy || !ELITE_OK.has(e.type) || e.sent === 'never') return;
  if (Math.random() >= eliteChance()) return;
  makeElite(e, e.type === 'heavy' || e.type === 'shield' || e.type === 'ram' ? (Math.random() < 0.7 ? 'iron' : 'ember') : e.def.fly ? 'ember' : Math.random() < 0.5 ? 'iron' : 'ember');
}
function makeElite(e, kind) {
  if (e.elite) return;
  const X = ELITES[kind];
  e.elite = kind;
  e.def = Object.assign(Object.create(e.def), { speed: e.def.speed * X.speed, kill: e.def.kill + 60, label: X.name + ' ELITE' });
  e.hp *= X.hp; e.maxHp *= X.hp;
  e.baseScale *= 1.12;
  if (!e.def.fly) e.mesh.scale.setScalar(e.baseScale);
  const tint = new THREE.Color(X.color);
  for (const mt of e.mats) {
    if (!mt.color) continue;
    mt.color.lerp(tint, kind === 'iron' ? 0.55 : 0.35);
    if (kind === 'iron' && 'metalness' in mt) { mt.metalness = 0.75; mt.roughness = 0.35; }
    if (mt.emissive) { mt.emissive.setHex(X.emissive); mt.emissiveIntensity = kind === 'ember' ? 0.9 : 0.4; mt.userData.baseEmissive = X.emissive; mt.userData.baseIntensity = mt.emissiveIntensity; }
  }
  const crest = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: X.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  crest.scale.set(0.9, 0.9, 1); crest.position.y = (e.def.h + 0.4) / Math.max(0.01, e.baseScale);
  e.mesh.add(crest); e.crest = crest;
  e.eT = rand(2.5, 4.5); e.fT = 0;
  try { if (!localStorage.getItem('rubblemaker-elite-seen')) { localStorage.setItem('rubblemaker-elite-seen', '1'); showHint('ELITES · IRON ones shrug off bullets (use explosions, headshots or the SPIKE flail) and pound the floor. EMBER ones burn the ground, throw fire and BLOW UP when they die.'); } } catch (_) {}
}
// IRON armor: half damage unless it is the right tool
function eliteDmg(e, dmg, info) {
  if (e.elite !== 'iron') return dmg;
  if (info.explosion || info.head || info.combo || info.parry || info.pierce || info.weapon === 'slam' || info.weapon === 'shock' || info.countersnipe) return dmg;
  if (G.time - (e.tingT || 0) > 0.2) { e.tingT = G.time; sfx.ting(); if (info.point) burst(info.point, 4, 0xc8d8ff, 5, 0.06, 0.25, true); }
  return dmg * 0.55;
}
function eliteKilled(e, info) {
  if (!e.elite) return;
  addStyle(ELITES[e.elite].style, ELITES[e.elite].name + ' ELITE', info && info.weapon, 'big');
  if (e.elite === 'ember') {
    const p = e.mesh.position.clone(); p.y += 0.6;
    setTimeout(() => { if (G.state === 'play' || G.state === 'pause') { explode(p, 3.4, 0, 'enemy'); for (let i = 0; i < 5; i++) addFlame(p.x + rand(-2, 2), p.z + rand(-2, 2), 'cat', 3); } }, 450);
    ringFx(p.clone().setY(0.1), 3.4, 0xff4a0a);
  }
  if (statsLive()) { STATS.elites = (STATS.elites || 0) + 1; }
}
function updateElites(dt) {
  for (const e of enemies) {
    if (!e.elite || e.dead || e.spawnT > 0 || e.buried) continue;
    const p = e.mesh.position;
    if (e.crest) e.crest.material.opacity = 0.6 + Math.sin(G.time * 6 + p.x) * 0.3;
    const dist = Math.hypot(P.pos.x - p.x, P.pos.z - p.z);
    e.eT -= dt;
    if (e.elite === 'iron') {
      if (e.slamT > 0) {
        e.slamT -= dt;
        if (e.slamT <= 0) { shockwave(new V3(p.x, e.def.fly ? 0 : p.y, p.z), 15, 13, 16); sfxAt(p, 'heavySlam', distVol(p)); G.shake = Math.max(G.shake, 0.3 * distVol(p)); burst(p.clone().setY(p.y + 0.2), 14, 0x8a8a94, 8, 0.15, 0.6); }
      } else if (e.eT <= 0 && dist < 11 && !e.def.fly) {
        e.eT = rand(4.5, 6.5); e.slamT = 0.65;
        ringFx(new V3(p.x, p.y + 0.06, p.z), 3, 0x8ac8ff);
        sfxAt(p, 'windup', distVol(p));
      }
    } else {
      e.fT -= dt;
      if (e.fT <= 0 && !e.def.fly && e.vel.lengthSq() + 1 > 0) { e.fT = 0.45; addFlame(p.x, p.z, 'cat', 2.4); }
      if (Math.random() < 0.3) spawnPart(new V3(p.x + rand(-0.4, 0.4), p.y + e.def.h * rand(0.2, 0.9) * (e.def.fly ? 0.3 : 1), p.z + rand(-0.4, 0.4)), new V3(0, 2.5, 0), 0xffa040, 0.07, 0.35, true, -0.1);
      if (e.eT <= 0 && dist > 5 && dist < 26) {
        e.eT = rand(3.2, 4.8);
        const from = p.clone(); from.y += e.def.fly ? 0 : e.def.h * 0.8;
        if (lineOfSight(from, playerEye())) throwFireball(from, playerEye());
      }
    }
  }
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const f = fireballs[i];
    f.life -= dt; f.vel.y -= 9 * dt;
    const prev = f.s.position.clone();
    f.s.position.addScaledVector(f.vel, dt);
    f.s.scale.setScalar(0.9 + Math.sin(G.time * 30) * 0.1);
    if (Math.random() < 0.6) spawnPart(prev, new V3(0, 1, 0), 0xff8a2a, 0.08, 0.3, true, -0.05);
    const pe = playerEye(); pe.y -= 0.5;
    let end = false;
    if (f.s.position.distanceTo(pe) < 0.9) { if (hurtPlayer(12, f.vel.clone().setY(0).normalize().multiplyScalar(5).setY(3))) sfx.sizzle(); end = true; }
    else if (f.life <= 0 || f.s.position.y < Math.max(0, floorAt(f.s.position.x, f.s.position.z, f.s.position.y + 1)) || !lineOfSight(prev, f.s.position)) end = true;
    if (end) { addFlame(f.s.position.x, f.s.position.z, 'cat', 2.5); burst(f.s.position, 8, 0xff7a2a, 5, 0.1, 0.4, true); scene.remove(f.s); fireballs.splice(i, 1); }
  }
}
function throwFireball(from, to) {
  const s = new THREE.Sprite(fireballMat); s.position.copy(from); s.scale.setScalar(0.9);
  scene.add(s);
  const d = to.clone().sub(from); const t = d.length() / 17;
  const vel = d.multiplyScalar(1 / t); vel.y += 4.5 * t;
  fireballs.push({ s, vel, life: 3 });
  sfxAt(from, 'orb', distVol(from));
}
function clearFireballs() { for (const f of fireballs) scene.remove(f.s); fireballs.length = 0; FLAIL.smash.length = 0; FLAIL.rubble = 0; }

// ================================================================ BATCH 5c: GHOST REPLAYS
var GH = { rec: null, recT: 0, play: null, mesh: null, key: '' };
const GHOST_KEY = 'rubblemaker-ghosts';
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x8ae8ff, transparent: true, opacity: 0.32, depthWrite: false });
function loadGhosts() { try { return JSON.parse(localStorage.getItem(GHOST_KEY) || '{}'); } catch (_) { return {}; } }
function ghostModel(mat) {
  const md = buildGolem();
  md.root.traverse((o) => { if (o.isMesh) o.material = mat; if (o.isLight) o.visible = false; });
  md.root.scale.multiplyScalar(0.55);
  md.root.userData.md = md;
  scene.add(md.root);
  return md.root;
}
function ghostClear() {
  if (GH.mesh) { scene.remove(GH.mesh); GH.mesh = null; }
  GH.rec = null; GH.play = null;
}
function encodeFrames(arr) {
  const a = new Int16Array(arr), b = new Uint8Array(a.buffer);
  let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function decodeFrames(str) {
  const s = atob(str), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return new Int16Array(b.buffer);
}
function ghostStart(lv) {
  ghostClear();
  GH.key = bestKey(lv);
  GH.rec = []; GH.recT = 0;
  if (!settings.ghost || (VS && VS.active)) return;
  const g = loadGhosts()[GH.key];
  if (!g) return;
  try { GH.play = { f: decodeFrames(g.d), t: g.t }; } catch (_) { return; }
  GH.mesh = ghostModel(ghostMat);
  GH.mesh.position.set(P.pos.x, P.pos.y, P.pos.z);
}
function ghostTick(dt) {
  if (GH.rec) {
    GH.recT -= dt;
    if (GH.recT <= 0 && GH.rec.length < 4 * 10 * 900) { GH.recT += 0.1; GH.rec.push(Math.round(P.pos.x * 10), Math.round(P.pos.y * 10), Math.round(P.pos.z * 10), Math.round(((P.yaw % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) * 1000 - 3142)); }
  }
  if (GH.play && GH.mesh) {
    const f = GH.play.f, n = f.length / 4;
    const u = G.levelTime * 10, i = Math.min(n - 1, Math.floor(u)), j = Math.min(n - 1, i + 1), k = Math.min(1, u - i);
    const L = (o) => (f[i * 4 + o] + (f[j * 4 + o] - f[i * 4 + o]) * k) / 10;
    const x = L(0), y = L(1), z = L(2);
    const moved = Math.hypot(x - GH.mesh.position.x, z - GH.mesh.position.z);
    GH.mesh.position.set(x, y, z);
    let ya = (f[i * 4 + 3] + 3142) / 1000, yb = (f[j * 4 + 3] + 3142) / 1000;
    if (yb - ya > Math.PI) ya += Math.PI * 2; else if (ya - yb > Math.PI) yb += Math.PI * 2;
    GH.mesh.rotation.y = ya + (yb - ya) * k + Math.PI;
    const md = GH.mesh.userData.md;
    if (md && md.rig) { GH.walk = (GH.walk || 0) + moved * 2.2; const sw = Math.sin(GH.walk) * Math.min(1, moved / dt / 6) * 0.7; if (md.rig.hipL) { md.rig.hipL.rotation.x = sw; md.rig.hipR.rotation.x = -sw; } if (md.rig.shL) { md.rig.shL.rotation.x = -sw; md.rig.shR.rotation.x = sw; } }
    GH.mesh.visible = u < n + 10 && Math.hypot(x - P.pos.x, z - P.pos.z) > 1.2;
    ghostMat.opacity = 0.22 + Math.sin(G.time * 3) * 0.06;
  }
}
function ghostSave(t) {
  if (!GH.rec || GH.rec.length < 8 || cheatsOn() || (VS && VS.active)) return;
  const all = loadGhosts();
  if (all[GH.key] && all[GH.key].t <= t) return;
  all[GH.key] = { t, d: encodeFrames(GH.rec), at: Date.now() };
  for (let tries = 0; tries < 12; tries++) {
    try { localStorage.setItem(GHOST_KEY, JSON.stringify(all)); break; } catch (_) {
      const keys = Object.keys(all).filter((k) => k !== GH.key).sort((a, b) => (all[a].at || 0) - (all[b].at || 0));
      if (!keys.length) break; delete all[keys[0]];
    }
  }
  pushFeed('NEW GHOST SAVED', 'cool');
}

// ================================================================ BATCH 5d: RUBBLE RACE (secret 1v1 versus over PeerJS)
var VS = {
  active: false, peer: null, conn: null, host: false, code: '', level: 0, meReady: false, rivalReady: false, freeze: 0,
  rival: { prog: 0, done: false, t: 0, pos: null, yaw: 0, tgt: null, mesh: null, rooms: 0 },
  sendT: 0, sendCD: 0, curses: 0, styleBank: 0, clearedSeen: 0, fx: {}, result: null, connected: false,
};
const VS_PREFIX = 'rubblemaker-race-';
const rivalMat = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.4, depthWrite: false });
const vsUnlocked = () => { try { return localStorage.getItem('rubblemaker-vs') === '1'; } catch (_) { return false; } };
function vsReveal() { show('vsBtn', vsUnlocked()); }
// the secret: type R A C E on the title screen
var raceBuf = '';
addEventListener('keydown', (e) => {
  if (G.state !== 'menu' || !e.code.startsWith('Key')) return;
  raceBuf = (raceBuf + e.code.slice(3)).slice(-4);
  if (raceBuf !== 'RACE') return;
  raceBuf = '';
  const first = !vsUnlocked();
  try { localStorage.setItem('rubblemaker-vs', '1'); } catch (_) {}
  vsReveal();
  const el = $('achToast');
  el.innerHTML = `<small>${first ? 'SECRET FOUND' : 'SECRET'}</small><b>RUBBLE RACE</b><span>1v1 versus is open · race a friend through the same level</span>`;
  el.classList.add('show'); sfx.portal();
  setTimeout(() => el.classList.remove('show'), 3200);
});
function vsMsg(t, bad) { const m = $('vsMsg'); m.textContent = t; m.classList.toggle('bad', !!bad); }
function vsLevels() { return LEVELS.map((l, i) => [l, i]).filter(([l]) => !l.duel && !l.prime); }
function openVersus() {
  initAudio();
  G.state = 'versus';
  show('menu', false); show('vsResult', false);
  show('versus', true);
  const sel = $('vsLevel');
  if (!sel.options.length) { const opt = ([l, i]) => `<option value="${i}">${l.id} · ${l.name}</option>`; const all = vsLevels(); sel.innerHTML = `<optgroup label="RACE COURSES">${all.filter(([l]) => l.race).map(opt).join('')}</optgroup><optgroup label="CAMPAIGN LEVELS">${all.filter(([l]) => !l.race).map(opt).join('')}</optgroup>`; }
  vsLobbyUI();
}
function vsLobbyUI() {
  const inLobby = !!VS.peer;
  show('vsHome', !inLobby); show('vsLobby', inLobby);
  if (!inLobby) { vsMsg(window.Peer ? '' : 'Loading the network library… if this stays, check your connection.'); return; }
  $('vsCodeShow').innerHTML = VS.host ? `ROOM CODE <b>${VS.code}</b><small>send this to your rival</small>` : `JOINED <b>${VS.code}</b>`;
  $('vsStatus').textContent = VS.connected ? 'RIVAL CONNECTED' : VS.host ? 'WAITING FOR A RIVAL…' : 'CONNECTING…';
  $('vsStatus').className = VS.connected ? 'ok' : '';
  $('vsLevel').disabled = !VS.host;
  show('vsStart', VS.host);
  $('vsStart').disabled = !VS.connected;
  $('vsLevel').value = String(VS.level);
  if (!VS.host) vsMsg(VS.connected ? 'The host picks the level and starts the race.' : '');
  $('vsScore').textContent = VS.connected ? scoreLine() : '';
  wireTauntRows();
  show('vsTauntLobby', VS.connected);
}
function newCode() { return 'BRICK-' + String(1000 + Math.floor(Math.random() * 9000)); }
function vsHost(tries = 0) {
  if (!window.Peer) { vsMsg('Network library not loaded. Are you online?', true); return; }
  vsLeave(true);
  VS.host = true; VS.code = newCode(); VS.level = Number($('vsLevel').value || vsLevels()[0][1]);
  const peer = new window.Peer(VS_PREFIX + VS.code);
  VS.peer = peer;
  peer.on('open', () => vsLobbyUI());
  peer.on('connection', (c) => { if (VS.conn && VS.conn.open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; } vsAttach(c); });
  peer.on('error', (er) => {
    if (er.type === 'unavailable-id' && tries < 4) { vsHost(tries + 1); return; }
    vsMsg('Network error: ' + (er.type || er.message), true);
  });
  vsLobbyUI();
}
function vsJoin() {
  if (!window.Peer) { vsMsg('Network library not loaded. Are you online?', true); return; }
  let code = $('vsCode').value.trim().toUpperCase().replace(/\s+/g, '');
  if (/^\d{4}$/.test(code)) code = 'BRICK-' + code;
  if (/^BRICK\d{4}$/.test(code)) code = 'BRICK-' + code.slice(5);
  if (!/^BRICK-\d{4}$/.test(code)) { vsMsg('Codes look like BRICK-1234', true); return; }
  vsLeave(true);
  VS.host = false; VS.code = code;
  const peer = new window.Peer();
  VS.peer = peer;
  peer.on('open', () => { vsAttach(peer.connect(VS_PREFIX + code, { reliable: true })); });
  peer.on('error', (er) => { vsMsg(er.type === 'peer-unavailable' ? 'No race with that code. Check it with the host.' : 'Network error: ' + (er.type || er.message), true); if (er.type === 'peer-unavailable') { vsLeave(true); vsLobbyUI(); } });
  vsLobbyUI();
}
function vsAttach(c) {
  VS.conn = c;
  c.on('open', () => { VS.connected = true; vsSend({ t: 'hi', v: 1 }); if (VS.host) vsSend({ t: 'lvl', idx: VS.level }); vsLobbyUI(); sfx.door(); });
  c.on('data', (m) => vsRecv(m));
  c.on('close', () => vsLost());
  c.on('error', () => vsLost());
}
function vsSend(m) { try { if (VS.conn && VS.conn.open) VS.conn.send(m); } catch (_) {} }
function vsLost() {
  if (!VS.connected) return;
  VS.connected = false; VS.conn = null;
  if (VS.active) { vsEndRace(true, 'RIVAL DISCONNECTED · WIN BY FORFEIT'); return; }
  if (G.state === 'versus') { vsMsg('Your rival left.', true); vsLobbyUI(); }
}
function vsLeave(quiet) {
  vsSend({ t: 'bye' });
  try { if (VS.conn) VS.conn.close(); } catch (_) {}
  try { if (VS.peer) VS.peer.destroy(); } catch (_) {}
  VS.conn = null; VS.peer = null; VS.connected = false;
  if (!quiet) vsLobbyUI();
}
function vsRecv(m) {
  if (!m || typeof m !== 'object') return;
  const R = VS.rival;
  switch (m.t) {
    case 'hi': VS.connected = true; vsLobbyUI(); break;
    case 'full': vsMsg('That race already has two players.', true); vsLeave(); break;
    case 'lvl': VS.level = m.idx | 0; vsLobbyUI(); break;
    case 'go': vsBegin(m.idx | 0); break;
    case 'ready': R.ready = true; VS.rivalReady = true; if (VS.meReady) vsCountdown(); vsReadyUI(); break;
    case 'p':
      R.tgt = new V3(+m.x || 0, +m.y || 0, +m.z || 0); R.yaw = +m.yaw || 0; R.prog = clamp(+m.prog || 0, 0, 1); R.rooms = m.rooms | 0; R.lt = +m.lt || 0; R.ltAt = performance.now();
      if (!R.pos) R.pos = R.tgt.clone();
      break;
    case 'send': vsReceiveEnemies(Array.isArray(m.types) ? m.types.slice(0, 3) : []); break;
    case 'curse': vsApplyCurse(String(m.k)); break;
    case 'done':
      R.done = true; R.t = +m.time || 0;
      if (!VS.active) break;
      if (VS.myDone) { if (VS.result === 'win' && R.t < VS.myT) vsFlip(); vsShowResult(); }
      else if (!VS.result) { vsDecide(false, 'YOUR RIVAL REACHED THE PORTAL FIRST'); banner('RIVAL FINISHED'); showHint('Your rival reached the portal first. Finish for your time, or quit from the pause menu.'); }
      break;
    case 'taunt': tauntPop('RIVAL', TAUNTS[m.i | 0] || 'GG'); break;
    case 'lobby': if (G.state === 'vsResult' || G.state === 'versus') { vsMsg('Host is back in the lobby.'); } break;
    case 'quit': if (VS.active) vsEndRace(true, 'YOUR RIVAL GAVE UP'); break;
    case 'bye': vsLost(); break;
  }
}
function vsStartRace() {
  if (!VS.host || !VS.connected) return;
  VS.level = Number($('vsLevel').value);
  vsSend({ t: 'go', idx: VS.level });
  vsBegin(VS.level);
}
function vsBegin(idx) {
  VS.active = true; VS.level = idx; VS.result = null; VS.myDone = false; VS.myT = 0;
  VS.meReady = false; VS.rivalReady = false; VS.freeze = 0;
  VS.rival = { prog: 0, done: false, t: 0, pos: null, yaw: 0, tgt: null, mesh: VS.rival.mesh, rooms: 0, ready: false };
  VS.curses = 0; VS.styleBank = 0; VS.clearedSeen = 0; VS.sendCD = 0; VS.fx = {};
  show('versus', false); show('vsResult', false);
  normalizeLoadout();
  startLevel(idx);
  placeRunes();
  show('vsSpec', false);
  G.state = 'vsready';
  camera.position.set(P.pos.x, P.pos.y + P.camH, P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0); camera.updateMatrixWorld();
  show('hud', true); show('vsHud', true);
  if (!VS.rival.mesh) VS.rival.mesh = ghostModel(rivalMat);
  VS.rival.mesh.visible = false;
  show('vsCount', true);
  vsReadyUI();
}
function vsReadyUI() {
  const el = $('vsCount');
  if (G.state !== 'vsready') return;
  el.innerHTML = `<b>${LEVELS[VS.level].id} · ${LEVELS[VS.level].name}</b><button id="vsReadyBtn" ${VS.meReady ? 'disabled' : ''}>${VS.meReady ? 'READY ✔' : 'CLICK WHEN READY'}</button><small>RIVAL: ${VS.rivalReady ? 'READY ✔' : 'getting ready…'}</small><small class="keys">first to the portal wins · [T] fires a curse when you have one</small>`;
  $('vsReadyBtn').onclick = vsSetReady;
}
function vsSetReady() {
  if (VS.meReady || G.state !== 'vsready') return;
  VS.meReady = true;
  requestLock();
  vsSend({ t: 'ready' });
  if (VS.rivalReady) vsCountdown(); else vsReadyUI();
}
function vsCountdown() {
  if (G.state !== 'vsready') return;
  G.state = 'play';
  last = performance.now();
  VS.freeze = 3; VS.goAt = performance.now() + 3000;
  requestLock();
}
// progress through the level, 0..1
function vsProgress() {
  const L = G.layout; if (!L) return 0;
  const fights = L.rooms.filter((r) => (r.waves && r.waves.length) || r.boss);
  const done = fights.filter((r) => r.state === 'clear').length;
  return fights.length ? Math.min(0.95, done / fights.length * 0.95) : 0;
}
function vsTick(dt) {
  if (!VS.active) return;
  const R = VS.rival;
  if (VS.freeze > 0) {
    const before = Math.ceil(VS.freeze);
    VS.freeze = (VS.goAt - performance.now()) / 1000;
    P.pos.x = G.spawn.x; P.pos.z = G.spawn.z; P.vel.set(0, 0, 0); W.cd = Math.max(W.cd, 0.15);
    G.levelTime = 0;
    const el = $('vsCount');
    if (VS.freeze <= 0) { el.innerHTML = '<b class="go">GO!</b>'; sfx.wave(); setTimeout(() => { if (VS.freeze <= 0) show('vsCount', false); }, 700); }
    else if (Math.ceil(VS.freeze) !== before || !el.querySelector('.num')) { el.innerHTML = `<b class="num">${Math.ceil(VS.freeze)}</b>`; tone(440, 440, 0.15, 0.2, 'square'); }
  }
  // stream my position + progress
  VS.sendT -= dt;
  if (VS.sendT <= 0) {
    VS.sendT = 1 / 12;
    vsSend({ t: 'p', x: Math.round(P.pos.x * 100) / 100, y: Math.round(P.pos.y * 100) / 100, z: Math.round(P.pos.z * 100) / 100, yaw: Math.round(P.yaw * 100) / 100, prog: vsProgress(), rooms: G.layout ? G.layout.rooms.filter((r) => r.state === 'clear').length : 0, lt: Math.round(G.levelTime * 10) / 10 });
  }
  // rival ghost
  if (R.mesh && R.tgt) {
    R.pos.lerp(R.tgt, Math.min(1, dt * 10));
    const moved = Math.hypot(R.pos.x - R.mesh.position.x, R.pos.z - R.mesh.position.z);
    R.mesh.position.copy(R.pos);
    R.mesh.rotation.y = R.yaw + Math.PI;
    R.mesh.visible = Math.hypot(R.pos.x - P.pos.x, R.pos.z - P.pos.z) > 1.2;
    const md = R.mesh.userData.md;
    if (md && md.rig && md.rig.hipL) { R.walk = (R.walk || 0) + moved * 2.2; const sw = Math.sin(R.walk) * Math.min(1, moved / Math.max(dt, 1e-3) / 6) * 0.7; md.rig.hipL.rotation.x = sw; md.rig.hipR.rotation.x = -sw; }
  }
  // curse charges: every room cleared and every 900 style
  const cleared = G.layout ? G.layout.rooms.filter((r) => r.state === 'clear').length : 0;
  if (cleared > VS.clearedSeen) { VS.clearedSeen = cleared; vsGainCurse(); }
  if (G.styleTotal - VS.styleBank >= 900) { VS.styleBank += 900; vsGainCurse(); }
  if (hit('curse')) vsFireCurse();
  VS.sendCD -= dt;
  // curse effects on me
  const F = VS.fx;
  for (const k in F) { F[k] -= dt; if (F[k] <= 0) { delete F[k]; if (k === 'lowgrav') G.lowgrav = false; } }
  if (F.jam) { W.cd = Math.max(W.cd, 0.1); if (FLAIL.held) { FLAIL.held = false; FLAIL.wind = 0; } }
  if (F.lowgrav) G.lowgrav = true;
  const fx = $('vsCurseFx');
  fx.className = F.fog ? 'fog' : F.reverse ? 'rev' : F.jam ? 'jam' : F.lowgrav ? 'grav' : 'hidden';
  fx.textContent = F.reverse ? 'CONTROLS REVERSED' : F.jam ? 'WEAPONS JAMMED' : F.lowgrav ? 'LOW GRAVITY' : '';
  // HUD
  $('vsMe').style.width = `${vsProgress() * 100}%`;
  $('vsRiv').style.width = `${R.prog * 100}%`;
  $('vsCurse').innerHTML = VS.curses ? `CURSE ×${VS.curses} <b>[${keyLabel(bound('curse')[0] || 'KeyT')}]</b>` : '<span>clear rooms / earn style for curses</span>';
}
function vsGainCurse() { if (VS.curses >= 3) return; VS.curses++; pushFeed('CURSE READY', 'cool'); sfx.coin(); }
const CURSES = { fog: ['FOG', 5], reverse: ['REVERSED CONTROLS', 3], jam: ['WEAPON JAM', 2.5], lowgrav: ['LOW GRAVITY', 6] };
function vsFireCurse() {
  if (!VS.curses || VS.freeze > 0) return;
  VS.curses--;
  const k = Object.keys(CURSES)[(Math.random() * 4) | 0];
  vsSend({ t: 'curse', k });
  pushFeed('CURSE SENT · ' + CURSES[k][0], 'cool');
  addStyle(30, null, null);
  tone(300, 90, 0.5, 0.25, 'sawtooth');
}
function vsApplyCurse(k) {
  if (!CURSES[k] || !VS.active || VS.result) return;
  VS.fx[k] = CURSES[k][1];
  banner('CURSED: ' + CURSES[k][0]);
  tone(200, 60, 0.7, 0.3, 'sawtooth'); fxFlash(0x8a2aff, 0.25);
}
// sabotage: your style milestones send enemies into your rival's level
const SEND_POOL = [['grunt', 'shooter', 'flyer'], ['grunt', 'shooter', 'shield', 'flyer', 'bomber'], ['grunt', 'shooter', 'ram', 'bomber', 'flyer']];
function vsSendEnemies(n, why) {
  if (!VS.active || VS.result || VS.sendCD > 0 || VS.freeze > 0) return;
  VS.sendCD = 9;
  const pool = SEND_POOL[Math.max(0, SCENES.indexOf(G.level.scene))] || SEND_POOL[0];
  const types = []; for (let i = 0; i < n; i++) types.push(pool[(Math.random() * pool.length) | 0]);
  vsSend({ t: 'send', types });
  pushFeed(`${why} · SENT ${n} TO RIVAL`, 'cool');
}
function vsLabel(label) {
  if (!VS.active) return;
  if (label === 'TRIPLE KILL' || label === 'MULTIKILL') vsSendEnemies(2, label);
}
function vsRank(idx) { if (VS.active && idx >= 4) vsSendEnemies(idx >= 6 ? 2 : 1, RANKS[idx].l + ' RANK'); }
function vsReceiveEnemies(types) {
  if (!VS.active || VS.result || G.state === 'vsready' || VS.freeze > 0) return;
  if (enemies.filter((e) => e.sent && !e.dead).length >= 5) return;
  let n = 0;
  for (const t of types) {
    if (!DEFS[t]) continue;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2, d = rand(6, 11);
      const x = P.pos.x + Math.cos(a) * d, z = P.pos.z + Math.sin(a) * d;
      const fy = DEFS[t].fly ? P.pos.y + rand(3, 4.5) : 0;
      if (overlapBox(x - 0.7, 0.1, z - 0.7, x + 0.7, 2.4, z + 0.7)) continue;
      if (!lineOfSight(playerEye(), new V3(x, 1.2, z))) continue;
      const e = makeEnemy(t, x, z, fy); e.sent = true; n++;
      break;
    }
  }
  if (n) { banner(`RIVAL SENT ${n} ${n > 1 ? 'ENEMIES' : 'ENEMY'}`); fxFlash(0xff3a1a, 0.15); }
}
// someone reached the portal
function vsFinish() {
  VS.myDone = true; VS.myT = G.levelTime;
  vsSend({ t: 'done', time: VS.myT });
  if (VS.rival.done) { if (!VS.result) vsDecide(VS.myT < VS.rival.t); vsShowResult(); return; }
  vsDecide(true);
  if (VS.connected && VS.rival.tgt) vsSpectate(); else vsShowResult();
}
function vsEndRace(win, note) { vsDecide(win, note); vsShowResult(); }
function vsShowResult() {
  const again = G.state === 'vsResult';
  const win = VS.result === 'win';
  G.state = 'vsResult';
  document.exitPointerLock?.();
  show('hud', false); show('vsHud', false); show('vsCount', false); show('pause', false); show('over', false); show('vsSpec', false);
  $('vsTauntPick').classList.add('hidden');
  G.lowgrav = false; VS.fx = {};
  $('vsCurseFx').className = 'hidden';
  if (VS.rival.mesh) VS.rival.mesh.visible = false;
  $('vsResTitle').textContent = win ? 'YOU WIN' : 'YOU LOSE';
  $('vsResTitle').className = 'title ' + (win ? 'win' : 'lose');
  const lv = LEVELS[VS.level];
  $('vsResStats').innerHTML = `<span>LEVEL</span><b>${lv.id} · ${lv.name}</b>` +
    `<span>YOUR TIME</span><b>${VS.myDone ? fmtTime(VS.myT) : 'DNF'}</b>` +
    `<span>RIVAL</span><b>${VS.rival.done ? fmtTime(VS.rival.t) : 'DNF'}</b>` +
    `<span>KILLS</span><b>${G.kills}</b>` + (VS.note ? `<p>${VS.note}</p>` : '');
  const sc = VS.score;
  $('vsResSet').innerHTML = sc.over ? `<b class="${sc.me > sc.riv ? 'win' : 'lose'}">${sc.me > sc.riv ? 'SET WON' : 'SET LOST'} ${sc.me} – ${sc.riv}</b><small>next race starts a new set</small>` : `<b>${scoreLine()}</b>`;
  wireTauntRows();
  show('vsRematch', VS.host && VS.connected);
  show('vsResult', true);
  if (!again) { if (win) sfx.rankUp(); else sfx.hurt(); }
}
function vsToLobby() {
  VS.active = false; VS.result = null;
  G.lowgrav = false;
  if (VS.rival.mesh) { scene.remove(VS.rival.mesh); VS.rival.mesh = null; }
  show('vsHud', false); show('vsCount', false); show('vsResult', false); show('vsSpec', false);
  toMenu();
  normalizeLoadout();
  if (VS.host) vsSend({ t: 'lobby' });
  openVersus();
}
function vsToLobbyMenu() {
  VS.active = false; VS.result = null;
  if (VS.rival.mesh) { scene.remove(VS.rival.mesh); VS.rival.mesh = null; }
  show('vsHud', false); show('vsCount', false); show('vsResult', false); show('versus', false);
  toMenu(); normalizeLoadout();
}
$('vsBtn').addEventListener('click', openVersus);
$('vsHost').addEventListener('click', () => vsHost());
$('vsJoin').addEventListener('click', vsJoin);
$('vsCode').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.code === 'Enter') vsJoin(); });
$('vsLevel').addEventListener('change', () => { VS.level = Number($('vsLevel').value); vsSend({ t: 'lvl', idx: VS.level }); });
$('vsStart').addEventListener('click', vsStartRace);
$('vsLeave').addEventListener('click', () => { vsLeave(); vsLobbyUI(); });
$('vsBack').addEventListener('click', () => { G.state = 'menu'; show('versus', false); show('menu', true); });
$('vsRematch').addEventListener('click', () => { vsSend({ t: 'go', idx: VS.level }); VS.active = false; if (VS.rival.mesh) VS.rival.mesh.visible = false; toMenu(); vsBegin(VS.level); });
$('vsLobbyBtn').addEventListener('click', vsToLobby);
vsReveal();

// ================================================================ BATCH 6.1: PERFORMANCE
function QCAP(lo, med, hi) { return settings.quality === 'low' ? lo : settings.quality === 'medium' ? med : hi; }
// auto quality: if play runs under ~40 FPS for two 3-second windows in a row, step the graphics down one notch
var AQ = { t0: 0, frames: 0, slow: 0, grace: 0, reset: true, last: 'menu' };
function autoQuality(now) {
  if (!settings.autoQuality) return;
  if (G.state !== 'play' || AQ.last !== 'play' || AQ.reset) { AQ.last = G.state; AQ.reset = false; AQ.t0 = now; AQ.frames = 0; AQ.grace = now + 5000; AQ.slow = 0; return; }
  if (now < AQ.grace) { AQ.t0 = now; AQ.frames = 0; return; }
  AQ.frames++;
  if (now - AQ.t0 < 3000) return;
  const fps = AQ.frames * 1000 / (now - AQ.t0);
  AQ.t0 = now; AQ.frames = 0;
  AQ.slow = fps < 40 ? AQ.slow + 1 : 0;
  if (AQ.slow < 2 || settings.quality === 'low') return;
  settings.quality = settings.quality === 'high' ? 'medium' : 'low';
  saveSettings(); applyQuality(); resizeFX();
  AQ.slow = 0; AQ.grace = now + 6000;
  showHint(`AUTO QUALITY · ${Math.round(fps)} FPS, graphics lowered to ${settings.quality.toUpperCase()} (Settings → Video)`);
}

// ================================================================ BATCH 6.2: RACE EXTRAS
// ---- shortcut runes: in race maps, some rooms hide a glowing rune up high. Touch it and the doors open (the fight follows you).
const runeMat = new THREE.MeshBasicMaterial({ color: 0x6affd8 });
const runeGlowMat = new THREE.SpriteMaterial({ map: GLOW, color: 0x3affc8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
var RUNES = [];
function placeRunes() {
  RUNES = [];
  if (!G.layout || !G.level || !G.level.race) return;
  for (const r of G.layout.rooms) {
    if (!r.shortcut) continue;
    const used = new Set(r.doors.map((d) => d.side));
    const side = ['N', 'E', 'S', 'W'].find((s2) => !used.has(s2)) || 'E';
    // off the wall and off-centre, clear of furnaces / banners / torches hung mid-wall
    const inset = 1.5, y = 4.4, sg = G.layout.rooms.indexOf(r) % 2 ? 1 : -1;
    let x = r.cx + (r.x1 - r.x0) * 0.3 * sg, z = r.cz + (r.z1 - r.z0) * 0.3 * sg;
    if (side === 'N') z = r.z0 + inset; else if (side === 'S') z = r.z1 - inset; else if (side === 'E') x = r.x1 - inset; else x = r.x0 + inset;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), runeMat); g.add(m);
    const s2 = new THREE.Sprite(runeGlowMat); s2.scale.set(2.6, 2.6, 1); g.add(s2);
    levelGroup.add(g);
    RUNES.push({ r, g, m, used: false });
  }
}
function updateRunes(dt) {
  for (const u of RUNES) {
    if (u.used) continue;
    u.m.rotation.y += dt * 2; u.g.position.y += Math.sin(G.time * 3) * dt * 0.15;
    if (u.r.state === 'clear') { u.used = true; u.g.visible = false; continue; }
    const d = Math.hypot(P.pos.x - u.g.position.x, (P.pos.y + 1) - u.g.position.y, P.pos.z - u.g.position.z);
    if (d < 1.7) {
      u.used = true; u.g.visible = false;
      const r = u.r;
      r.state = 'clear'; r.queue = [];
      G.checkpoint = { x: r.cx, z: r.cz, yaw: P.yaw };
      for (const dr of r.doorObjs) dr.target = 1;
      sfx.door(); sfx.portal();
      burst(u.g.position.clone(), 20, 0x6affd8, 8, 0.12, 0.6, true);
      banner('SHORTCUT!');
      addStyle(60, 'SHORTCUT', null, 'cool');
    }
  }
}

// ---- taunts
const TAUNTS = ['GG', 'TOO SLOW!', 'GET BRICKED', 'NICE ONE', 'SEE YOU AT THE PORTAL', 'OOPS'];
var tauntT = 0, tauntOpenT = 0, tauntPopT = 0;
function vsTaunt(i) {
  if (!VS.connected || performance.now() < tauntT || !TAUNTS[i]) return;
  tauntT = performance.now() + 1500;
  vsSend({ t: 'taunt', i });
  tauntPop('YOU', TAUNTS[i], true);
}
function tauntPop(who, text, mine) {
  const el = $('vsTauntPop');
  el.innerHTML = `<b>${who}</b> ${text}`;
  el.className = 'show' + (mine ? ' mine' : '');
  clearTimeout(tauntPopT);
  tauntPopT = setTimeout(() => (el.className = ''), 2600);
  if (!mine) tone(700, 900, 0.08, 0.12, 'square');
}
function tauntRowsHTML() { return TAUNTS.map((t, i) => `<button class="sub" data-taunt="${i}">${t}</button>`).join(''); }
function wireTauntRows() {
  document.querySelectorAll('.vsTauntRow').forEach((row) => {
    if (!row.dataset.wired) { row.innerHTML = tauntRowsHTML(); row.dataset.wired = '1'; row.addEventListener('click', (e) => { const b = e.target.closest('[data-taunt]'); if (b) vsTaunt(Number(b.dataset.taunt)); }); }
  });
}
// in a race: press the taunt key, then 1-4 (instead of switching weapon)
function vsTauntInput() {
  if (!VS.active) return;
  const now = performance.now();
  if (hit('taunt')) {
    tauntOpenT = now + 2500;
    const pk = $('vsTauntPick');
    pk.innerHTML = TAUNTS.slice(0, 4).map((t, i) => `<span><b>${i + 1}</b> ${t}</span>`).join('');
    pk.classList.remove('hidden');
  }
  if (now > tauntOpenT) { $('vsTauntPick').classList.add('hidden'); return; }
  for (let i = 0; i < 4; i++) {
    const a = 'weapon' + (i + 1);
    if (!hit(a)) continue;
    for (const c of bound(a)) if (c) pressed.delete(c);
    VHIT.delete(a);
    vsTaunt(i);
    tauntOpenT = 0; $('vsTauntPick').classList.add('hidden');
  }
}

// ---- best of 3
VS.score = { me: 0, riv: 0, over: false };
function vsDecide(win, note) {
  if (VS.result) return;
  VS.result = win ? 'win' : 'lose'; VS.note = note || '';
  if (VS.score.over) VS.score = { me: 0, riv: 0, over: false };
  if (win) VS.score.me++; else VS.score.riv++;
  if (VS.score.me >= 2 || VS.score.riv >= 2) VS.score.over = true;
}
function vsFlip() { // both crossed the line before hearing about each other: the faster time wins
  if (VS.result === 'win') { VS.result = 'lose'; VS.score.me--; VS.score.riv++; }
  VS.score.over = VS.score.me >= 2 || VS.score.riv >= 2;
}
function scoreLine() { return `SET ${VS.score.me} – ${VS.score.riv} · FIRST TO 2`; }

// ---- spectate your rival after you finish
function vsSpectate() {
  G.state = 'vsSpectate';
  document.exitPointerLock?.();
  show('hud', false); show('vsHud', false);
  show('vsSpec', true);
  $('vsSpec').innerHTML = `<b>YOU WIN</b><span id="vsSpecT">your rival is still racing…</span><button id="vsSpecSkip">SEE RESULTS</button><small>1–6: taunt · SPACE: results</small>`;
  $('vsSpecSkip').onclick = vsShowResult;
  if (VS.rival.mesh) VS.rival.mesh.visible = true;
  VS.specCam = null;
}
function vsSpectateTick(dt) {
  const R = VS.rival;
  if (!R.mesh || !R.tgt) return;
  R.pos.lerp(R.tgt, Math.min(1, dt * 10));
  const moved = Math.hypot(R.pos.x - R.mesh.position.x, R.pos.z - R.mesh.position.z);
  R.mesh.position.copy(R.pos); R.mesh.rotation.y = R.yaw + Math.PI; R.mesh.visible = true;
  const md = R.mesh.userData.md;
  if (md && md.rig && md.rig.hipL) { R.walk = (R.walk || 0) + moved * 2.2; const sw = Math.sin(R.walk) * Math.min(1, moved / Math.max(dt, 1e-3) / 6) * 0.7; md.rig.hipL.rotation.x = sw; md.rig.hipR.rotation.x = -sw; }
  const back = new V3(Math.sin(R.yaw), 0, Math.cos(R.yaw));
  const want = R.pos.clone().addScaledVector(back, 4).setY(R.pos.y + 2.6);
  if (!VS.specCam) VS.specCam = want.clone(); else VS.specCam.lerp(want, Math.min(1, dt * 4));
  camera.position.copy(VS.specCam);
  camera.lookAt(R.pos.x, R.pos.y + 1.2, R.pos.z);
  camera.updateMatrixWorld();
  const el = $('vsSpecT');
  if (el) el.textContent = `RIVAL ${fmtTime((R.lt || 0) + (performance.now() - (R.ltAt || performance.now())) / 1000)} · ${Math.round(R.prog * 100)}%`;
}
addEventListener('keydown', (e) => {
  if (G.state !== 'vsSpectate') return;
  if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); vsShowResult(); }
  const n = Number(e.code.replace('Digit', '')); if (n >= 1 && n <= 6) vsTaunt(n - 1);
});
