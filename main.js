import * as THREE from 'three';
import { buildEnemyModel, buildBossModel, buildTrainerModel, buildForge, buildPortal, buildVariantModel, buildDuelistModel, animateEnemy, buildViewmodels } from './models.js';
import { LEVELS, SCENES, DUELS, buildLevel } from './levels.js';
import { createMusic } from './music.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { settings, saveSettings, ACTIONS, DIFFS, keyLabel, initSettingsUI } from './settings.js';

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
}

const A = 36; // arena half-size
const WALL_H = 12;
function buildArena() {
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
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t); src.stop(t + dur);
}
function tone(f1, f2, dur, vol, type = 'square', delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(sfxBus);
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
const down = (a) => bound(a).some((c) => c && keys.has(c));
const hit = (a) => bound(a).some((c) => c && pressed.has(c));
const isBound = (code) => ACTIONS.some(([id]) => bound(id).includes(code));

addEventListener('keydown', (e) => {
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
addEventListener('mousedown', (e) => { if (G.state !== 'play') return; const c = 'Mouse' + e.button; keys.add(c); pressed.add(c); if (e.button > 2) e.preventDefault(); });
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
  if (parts.length < 450) {
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
const fresh = { revolver: 1, shotgun: 1, nailgun: 1, punch: 1, slam: 1, blade: 1, shock: 1, grapple: 1 };
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
  G.score += gained * (1 + ST.idx * 0.25);
  if (label) pushFeed('+' + label, cls);
}
function loseStyle(n) {
  ST.points = Math.max(0, ST.points - n);
}

// ---------------------------------------------------------------- viewmodel
const VM = buildViewmodels(GLOW);
const { revolver, shotgun, arm, revFlash, shotFlash, chargeMat, pump: pumpMesh } = VM;
vmScene.add(revolver, shotgun, VM.nailgun, ...Object.values(VM.arms));
const guns = [revolver, shotgun, VM.nailgun];
const WNAMES = ['REVOLVER', 'SHOTGUN', 'NAILGUN'];

const W = { variant: [0, 0, 0], arm: 'fist', heat: 0, nailCD: 0, shockCharge: 0, coins: 4, pump: 0, sawCD: 0, cur: 0, cd: 0, switchT: 0, lastSwitch: -9, charge: 0, charging: false, punchCD: 0, punchT: 0, kick: 0, coreCD: 0, flashT: 0 };
function switchWeapon(i) {
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
const DIFF = () => DIFFS[settings.difficulty] || DIFFS.normal;
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
  heavy: { hp: 340, speed: 3.6, r: 1.0, h: 3.25, color: 0xa07a4a, mass: 3.5, kill: 160, label: 'BIG KILL' },
};
const enemies = [];
function makeEnemy(type, x, z, y = 0) {
  const def = DEFS[type];
  const model = def.duelist ? buildDuelistModel(type) : def.variantModel ? buildVariantModel(type) : def.trainer ? buildTrainerModel(type) : def.boss ? buildBossModel(type) : buildEnemyModel(type, def.color);
  const g = model.root;
  g.position.set(x, def.fly ? y : y - def.h, z);
  const baseScale = g.scale.x;
  if (def.fly) g.scale.setScalar(0.001);
  scene.add(g);
  const e = {
    type, def, mesh: g, mats: model.mats, extraMats: model.extraMats, hit: model.hit, rig: model.rig, orb: model.orb,
    hp: def.hp * (DIFF().hp || 1), vel: new V3(), state: 'chase', t: 0, cd: rand(0.8, 2), flash: 0,
    grounded: true, strafe: Math.random() < 0.5 ? -1 : 1, strafeT: rand(1, 3), spawnT: def.boss ? 1.6 : 0.7, spawnMax: def.boss ? 1.6 : 0.7, spawnY: y, baseScale, home: new V3(x, y + 1, z), animType: { boss1: 'heavy', boss2: 'shooter', bulwark: 'grunt', sweeper: 'heavy', roost: 'flyer', kiln: 'heavy', shield: 'grunt', sniper: 'shooter', bomber: 'grunt', priest: 'shooter', shard: 'grunt', bertha: 'heavy', kite: 'grunt' }[type] || null, shieldUp: !!def.shielded, shieldHP: 80, maxHp: def.hp * (DIFF().hp || 1), mv: new V3(), orbit: rand(0, 6.28), alt: rand(4, 6.5), dead: false, walk: rand(0, 6),
  };
  for (const m of model.hit) m.userData.enemy = e;
  maybeIntro(type);
  enemies.push(e);
  // spawn fx
  const pos = new V3(x, def.fly ? y : 0.2 + y, z);
  ringFx(pos, 2.5, 0xff3a2a);
  burst(pos, 14, 0xff4a2a, 7, 0.15, 0.6, true, 0.3, 1.2);
  sfx.spawn(distVol(pos));
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
  sfx.orb(distVol(from));
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
    if (e.type === 'flyer') { updateFlyer(e, dt); continue; }
    if (e.type === 'boss1') { updateBoss1(e, dt); continue; }
    if (e.type === 'boss2') { updateBoss2(e, dt); continue; }
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
        if (dist < 2.0 && e.cd <= 0 && Math.abs(P.pos.y - p.y) < 2) { e.state = 'windup'; e.t = 0.42; sfx.windup(distVol(p)); }
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
        if (dist < 3.8 && e.cd <= 0) { e.state = 'windup'; e.t = 0.85; sfx.windup(distVol(p)); }
      } else if (e.state === 'windup') {
        windupGlow = 1 - e.t / 0.85;
       
        if (e.t <= 0) {
          const center = new V3(p.x + nx * 1.4, p.y, p.z + nz * 1.4);
          ringFx(center, 5, 0xff6a2a);
          burst(center, 18, 0x8a7a6a, 9, 0.25, 0.8);
          sfx.heavySlam(distVol(p));
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
  if (e.dead || e.spawnT > 0) return false;
  if (e.state === 'stun') dmg *= 1.5;
  if (e.wardT > G.time) dmg *= 0.5;
  if (e.shieldUp && !info.combo && !info.parry && !info.explosion && info.weapon !== 'slam') {
    const f = new V3(Math.sin(e.mesh.rotation.y), 0, Math.cos(e.mesh.rotation.y));
    const to = camera.position.clone().sub(e.mesh.position).setY(0).normalize();
    if (f.dot(to) > 0.3) { e.shieldHP -= dmg; blockedFx(e, info.point); if (e.shieldHP <= 0) breakShield(e, to.clone().negate()); return false; }
  }
  if (info.combo && e.shieldUp) breakShield(e, null);
  if (e.type === 'shard' && e.state === 'stance' && !info.parry && !info.combo && !info.explosion) {
    blockedFx(e, info.point);
    if (G.time - (e.reflT || 0) > 0.3) { e.reflT = G.time; hurtPlayer(8, null); pushFeed('REFLECTED', 'bad'); }
    return false;
  }
  if (e.def.canHurt && !e.def.canHurt(info)) { blockedFx(e, info.point); return false; }
  e.hp -= dmg;
  e.flash = 0.07;
  e.flinch = Math.min(1.2, (e.flinch || 0) + dmg / 35);
  if (settings.gore && info.point && Math.random() < 0.6) bloodSpray(info.point);
  if (e.def.onHurt) e.def.onHurt(e);
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
  sfx.kill();
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

function hurtPlayer(dmg, knock) {
  if (G.state !== 'play' || P.invuln > 0 || P.dashT > 0) return false;
  dmg = Math.round(dmg * DIFF().dmg);
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
  if (P.hp <= 0) { P.hp = 0; gameOver(); }
  return true;
}
function heal(n) {
  P.hp = Math.min(100, P.hp + n);
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
      damageEnemy(e, head ? 180 : 120, { weapon: 'revolver', head, point: h.point, knock: dir.clone().multiplyScalar(10).setY(3) });
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
  if (weapon === 'enemy') {
    blastFx(pos, radius, 0xb8543a); burst(pos, 18, 0x5a5048, 9, 0.2, 0.9); sfx.explode();
    const pc = new V3(P.pos.x, P.pos.y + 0.9, P.pos.z);
    if (pc.distanceTo(pos) < radius) hurtPlayer(18, pc.sub(pos).normalize().multiplyScalar(10).setY(6));
    return;
  }
  if (camera.position.distanceTo(pos) < radius * 2.5) fxShift(weapon === 'combo' ? 0.02 : 0.01);
  blastFx(pos, radius, weapon === 'combo' ? 0xffd04a : 0xff7a2a);
  burst(pos, 26, 0xff8a3a, 14, 0.18, 0.6, true, 0.4);
  burst(pos, 16, 0x5a5048, 10, 0.25, 1.2);
  sfx.explode();
  G.shake = Math.max(G.shake, weapon === 'combo' ? 0.7 : 0.45);
  let hitAny = 0;
  for (const e of enemies.slice()) {
    if (e.dead || e.spawnT > 0) continue;
    const c = e.mesh.position.clone(); c.y += e.def.h * 0.5;
    const d = c.distanceTo(pos);
    if (d > radius) continue;
    const k = 1 - (d / radius) * 0.6;
    const away = c.clone().sub(pos).setY(0).normalize().multiplyScalar(9 * k).setY(9 * k);
    damageEnemy(e, dmg * k, { weapon: weapon === 'combo' || weapon === 'bomb' ? null : 'shotgun', explosion: true, combo: weapon === 'combo', point: c, knock: away });
    hitAny++;
  }
  if (hitAny && weapon !== 'combo') useWeapon('shotgun');
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
  let did = false;
  for (const e of enemies) {
    if (e.dead || e.def.ai !== 'sniper' || e.state !== 'aim' || e.t > 0.45) continue;
    const hp = new V3(); e.rig.head.getWorldPosition(hp);
    if (!lineOfSight(origin, hp)) continue;
    tracer(origin, hp, 0xffffff, 0.08, 0.3);
    e.state = 'recover'; e.t = 1; if (e.beam) e.beam.visible = false;
    damageEnemy(e, 400, { weapon: null, parry: true, head: true, point: hp });
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
  const ix = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
  const iz = (down('forward') ? 1 : 0) - (down('back') ? 1 : 0);
  const wish = fwd.clone().multiplyScalar(iz).addScaledVector(right, ix);
  if (wish.lengthSq() > 0) wish.normalize();
  const crouchHeld = down('slide');
  const crouchPressed = hit('slide');

  P.invuln -= dt;
  P.pips = Math.min(3, P.pips + dt * 0.85);

  // dash
  if (hit('dash') && P.pips >= 1) {
    P.pips -= 1;
    P.dashDir.copy(wish.lengthSq() ? wish : fwd);
    P.dashT = 0.17; P.invuln = Math.max(P.invuln, 0.22);
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
    } else if (P.wallJumps > 0) {
      const n = wallNormal();
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
    P.vel.set(P.dashDir.x * 32, 0, P.dashDir.z * 32);
    if (P.dashT <= 0) { P.vel.x *= 0.5; P.vel.z *= 0.5; }
    if (Math.random() < 0.6) spawnPart(P.pos.clone().setY(P.pos.y + rand(0.3, 1.5)), new V3(), 0x6ad8ff, 0.06, 0.25, true, 0);
  } else if (P.sliding) {
    if (P.grounded) { P.vel.x = P.slideDir.x * 16; P.vel.z = P.slideDir.z * 16; }
    P.vel.y -= 32 * dt;
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
    P.vel.y -= 32 * dt;
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
    P.wallJumps = 3;
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
  P.slideDir.copy(wish.lengthSq() ? wish : fwd);
  sfx.slide();
}

function updateWeapons(dt) {
  W.cd -= dt; W.punchCD -= dt; W.coreCD -= dt; W.sawCD -= dt; W.switchT = Math.max(0, W.switchT - dt);
  W.coins = Math.min(4, W.coins + dt / 1.6);
  if (hit('weapon1')) switchWeapon(0);
  if (hit('weapon2')) switchWeapon(1);
  if (hit('swap')) switchWeapon(nextGun());
  if (hit('arm')) cycleArm();
  if (hit('weapon3')) switchWeapon(2);
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
  } else {
    updateNailgun(dt);
  }
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
  const list = [];
  const grunts = Math.min(16, 3 + n * 2);
  const shooters = Math.min(10, n === 1 ? 1 : n);
  const heavies = Math.min(5, Math.floor((n - 1) / 2));
  for (let i = 0; i < grunts; i++) list.push('grunt');
  for (let i = 0; i < shooters; i++) list.push('shooter');
  for (let i = 0; i < heavies; i++) list.push('heavy');
  for (let i = 0; i < (n >= 2 ? Math.min(6, n - 1) : 0); i++) list.push('flyer');
  list.sort(() => Math.random() - 0.5);
  G.toSpawn = list;
  G.spawnT = 0.8;
  banner(`WAVE ${n}`);
  $('wave').textContent = `WAVE ${n}`;
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
  if (!G.toSpawn.length && enemies.length === 0) {
    G.waveActive = false;
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
  if (W.arm === 'shock' && W.shockCharge > 0) alt = 'CHARGE ' + '▮'.repeat(Math.round(W.shockCharge * 5));
  if (alt !== ui.alt) { ui.alt = alt; $('altInfo').textContent = alt; }
  const fi = freshInfo(fresh[['revolver', 'shotgun', 'nailgun'][W.cur]]);
  if (fi.name !== ui.fresh) { ui.fresh = fi.name; const f = $('fresh'); f.textContent = fi.name; f.className = fi.name; }
  // charge bar
  $('charge').style.opacity = W.charging ? 1 : 0;
  $('chargeFill').style.width = `${W.charge * 100}%`;
  $('chargeFill').style.background = W.charge >= 1 ? '#ffffff' : '#6ad8ff';
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
  updateBurning(dt);
  updateForge();
  if (G.mode === 'endless') updateWaves(dt); else updateCampaign(dt);
  updateShockwaves(dt);
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
  } else if (menuish()) {
    updateMenuScene(dt, now / 1000);
  }
  updateAmbient(dt, now / 1000);
  pressed.clear(); released.clear();
  updateFPS(now);
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
}
function resetGame() {
  clearWorld();
  Object.assign(P, { hp: 100, grounded: false, wallJumps: 3, pips: 3, dashT: 0, sliding: false, slamming: false, invuln: 0, camH: 1.6, roll: 0, hurtFlash: 0, yaw: 0, pitch: 0 });
  P.pos.set(0, 0, 12); P.vel.set(0, 0, 0);
  Object.assign(G, { wave: 0, toSpawn: [], score: 0, time: 0, kills: 0, hitstop: 0, shake: 0, bestRank: 0, waveActive: false, breakT: 1.2 });
  ST.points = 0;
  Object.assign(G, { styleTotal: 0, dmgTaken: 0, levelTime: 0, boss: null, portal: null });
  for (const s of shocks) { scene.remove(s.m); s.m.material.dispose(); }
  shocks.length = 0;
  clearProjectiles();
  clearNails();
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
  lockKeyboard();
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
  document.exitPointerLock?.();
  hideBeam();
  if (G.mode === 'endless') {
    const score = Math.floor(G.score);
    const best = loadBest();
    const isBest = !best || score > best.score;
    if (isBest) saveBest({ score, wave: G.wave, rank: G.bestRank });
    $('overStats').innerHTML = `RUBBLE PIT<br>SCORE ${score.toLocaleString()}${isBest ? ' — NEW BEST!' : ''}<br>WAVE ${G.wave} · ${G.kills} KILLS<br>HIGHEST STYLE: ${RANKS[G.bestRank].l}`;
    const earned = Math.floor(score / 40);
    if (earned) { awardScrap(earned); $('overStats').innerHTML += `<br><span class="scrap">+${earned} ◆ SCRAP</span>`; }
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
  if (G.state === 'play') { G.state = 'pause'; show('pause', true); }
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
  if (k === 'quality') { applyQuality(); resizeFX(); }
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
    if (e.cd <= 0 && dist < 32 && lineOfSight(p.clone().setY(p.y + 0.5), eye)) { e.state = 'windup'; e.t = 0.55; sfx.screech(distVol(p)); }
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
  const type = room.boss;
  const def = DEFS[type];
  const e = makeEnemy(type, room.cx, room.cz, def.fly ? (def.trainer ? 5 : 2.2) : 0);
  e.room = room;
  G.boss = e;
  $('bossName').textContent = def.name;
  show('bossBar', true);
  showIntro(type);
  setTimeout(() => { if (def.hint && G.boss === e) showHint(def.hint); }, 2400);
  sfx.bossRoar();
  G.shake = Math.max(G.shake, 0.6);
}
function updateBossBar() {
  if (!G.boss) return;
  $('bossFill').style.width = `${clamp(G.boss.hp / G.boss.def.hp, 0, 1) * 100}%`;
}
function bossDefeated(e) {
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
  banner(`${e.def.short} DESTROYED`);
}

// ================================================================ CAMPAIGN
const levelCtx = {
  THREE, box, torch, candle, makeWindow,
  decor: (o) => levelGroup.add(o),
  blocked: (x, z) => !!overlapBox(x - 0.9, 0.1, z - 0.9, x + 0.9, 2.2, z + 0.9),
  mats: { hidden: new THREE.MeshBasicMaterial({ visible: false }), brick: brickMat, cobble: cobbleMat, floor: floorMat, wood: woodMat, iron: ironMat, ironDark, water: waterMat, doorGlow: doorGlowMat },
};
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
const GRADES = ['D', 'C', 'B', 'A', 'S', 'RUBBLEMAKER'];
const GRADE_SHORT = ['D', 'C', 'B', 'A', 'S', 'R'];

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
  const gDmg = dmg <= 40 ? 4 : dmg <= 120 ? 3 : dmg <= 250 ? 2 : dmg <= 450 ? 1 : 0;
  const perfect = gTime === 4 && gStyle === 4 && gDmg === 4;
  const overall = Math.max(0, (perfect && !G.deaths ? 5 : Math.min(4, Math.round((gTime + gStyle + gDmg) / 3))) - G.deaths);
  const prog = loadProgress();
  if (!lv.duel) prog.unlocked = Math.max(prog.unlocked, G.levelIdx + 1);
  const bk = bestKey(lv);
  const best = prog.best[bk];
  const newBest = !best || overall > best.rank || (overall === best.rank && t < best.time);
  if (newBest) prog.best[bk] = { rank: overall, time: t };
  const earned = Math.round((100 + Math.floor(G.styleTotal / 10) + [0, 25, 50, 100, 150, 300][overall]) * (DIFF().scrap || 1));
  prog.scrap = (prog.scrap || 0) + earned;
  saveProgress(prog);
  const g = (i) => `<span class="g g${GRADE_SHORT[i]}">${GRADE_SHORT[i]}</span>`;
  $('completeLevel').textContent = `${lv.scene.name} · ${lv.id} · ${lv.name}`;
  $('completeStats').innerHTML =
    `<span>TIME</span><span>${fmtTime(t)} <small style="opacity:.5">/ ${fmtTime(lv.par)}</small></span>${g(gTime)}` +
    `<span>STYLE</span><span>${Math.floor(G.styleTotal).toLocaleString()}</span>${g(gStyle)}` +
    `<span>DAMAGE TAKEN</span><span>${dmg}</span>${g(gDmg)}` +
    `<span>KILLS</span><span>${G.kills}</span><span></span>` +
    `<span>DEATHS</span><span>${G.deaths}${G.deaths ? ' <small style="opacity:.6">(-' + G.deaths + ' rank)</small>' : ''}</span><span></span>` +
    `<span>SCRAP EARNED</span><span class="scrap">+${earned} ◆</span><span></span>`;
  const rk = $('completeRank');
  rk.textContent = GRADES[overall] + (newBest ? '' : '');
  rk.className = `g${GRADE_SHORT[overall]}${overall === 5 ? ' top' : ''}`;
  const hasNext = !lv.duel && G.levelIdx + 1 < LEVELS.length && !LEVELS[G.levelIdx + 1].duel;
  show('nextBtn', hasNext);
  if (hasNext) $('nextBtn').textContent = `NEXT: ${LEVELS[G.levelIdx + 1].id} ${LEVELS[G.levelIdx + 1].name}`;
  setTimeout(() => { show('complete', true); sfx.rankUp(); }, 300);
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
  G.styleTarget = Math.max(500, layout.rooms.reduce((s, r) => s + r.waves.reduce((a, w) => a + w.length, 0) * 80 + (r.boss ? 1200 : 0), 0));
  $('wave').textContent = lv.id;
  enterPlay();
  banner(`${lv.id} ${lv.name}`);
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
  return G.state === 'menu' || G.state === 'levels' || (G.state === 'settings' && settingsFrom === 'menu');
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
  let theme = 'menu', int = 0;
  const inGame = G.state === 'play' || G.state === 'pause' || G.state === 'shop' || (G.state === 'settings' && settingsFrom === 'pause');
  if (inGame) {
    theme = G.boss ? 'boss' : G.mode === 'endless' ? 'pit' : G.level ? G.level.theme : 'cellar';
    const fighting = enemies.length > 0 || !!G.boss;
    int = fighting ? 2 + (ST.idx >= 2 ? 1 : 0) + (ST.idx >= 4 ? 1 : 0) : 1;
    if (G.boss) int = Math.max(3, int);
    if (G.state !== 'play') int = Math.min(int, 1);
  } else if (G.state === 'complete') {
    theme = G.level ? G.level.theme : 'menu'; int = 1;
  }
  music.setTheme(theme);
  music.setIntensity(int);
  music.update();
}

// ================================================================ LOADOUT, SHOP & ECONOMY
const VARIANTS = [
  [{ name: 'LANCE', hex: 0x3ac8ff, css: '#6ad8ff' }, { name: 'CHAINLINK', hex: 0x4aff6a, css: '#6dff8f' }, { name: 'COINSHOT', hex: 0xff4a3a, css: '#ff6a5a' }],
  [{ name: 'FURNACE', hex: 0xff7a2a, css: '#ffa04a' }, { name: 'OVERPRESSURE', hex: 0x4aff6a, css: '#6dff8f' }, { name: 'SAWBLADE', hex: 0xff3a4a, css: '#ff6a5a' }],
];
const SHOP = [
  { id: 'shotgun', gun: 1, v: 0, price: 250, desc: 'Unlocks the SHOTGUN. FURNACE alt-fire lobs an explosive core: shoot it with the revolver for a COMBO BLAST.' },
  { id: 'rev1', gun: 0, v: 1, price: 450, desc: 'Revolver variant. Charge ALT to fire a shot that CHAINS between up to 5 enemies and BANKS off walls.' },
  { id: 'shot1', gun: 1, v: 1, price: 550, req: 'shotgun', desc: 'Shotgun variant. Tap ALT to PUMP up to 3 times for a bigger blast. Three pumps detonates in your face (worth it).' },
  { id: 'rev2', gun: 0, v: 2, price: 700, desc: 'Revolver variant. ALT flips a COIN. Shoot it and the bullet redirects into the nearest head. Coins chain.' },
  { id: 'shot2', gun: 1, v: 2, price: 800, req: 'shotgun', desc: 'Shotgun variant. ALT launches a SAWBLADE that grinds through enemies and bounces off walls.' },
];
let PROGC = null;
function prog() { return PROGC || (PROGC = loadProgress()); }
function owns(id) { return (prog().owned || []).includes(id); }
function ownsVariant(gun, v) { return v === 0 ? gun === 0 || owns(['', 'shotgun', 'nailgun'][gun]) : owns(['rev', 'shot', 'nail'][gun] + v); }
function applyVariantLook() {
  chargeMat.emissive.setHex(VARIANTS[0][W.variant[0]].hex);
  VM.shotAccent.emissive.setHex(VARIANTS[1][W.variant[1]].hex);
  if (VARIANTS[2]) VM.nailAccent.emissive.setHex(VARIANTS[2][W.variant[2]].hex);
  const s3 = document.querySelector('#weaponSlots span[data-w="2"]');
  if (s3) s3.textContent = owns('nailgun') ? '3 NAILGUN' : '3 LOCKED';
  const slot = document.querySelector('#weaponSlots span[data-w="1"]');
  if (slot) slot.textContent = owns('shotgun') ? '2 SHOTGUN' : '2 LOCKED';
}
function normalizeLoadout() {
  for (const g of [0, 1, 2]) if (!ownsVariant(g, W.variant[g])) W.variant[g] = 0;
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
    const k = settings.binds.interact.filter(Boolean).map(keyLabel)[0] || 'E';
    $('prompt').textContent = `[${k}] OPEN THE FORGE`;
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
}
function buy(id) {
  const it = SHOP.find((x) => x.id === id);
  const p = prog();
  if (!it || owns(id) || (p.scrap || 0) < it.price) return;
  p.scrap -= it.price;
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
  damageEnemy(target, dmg, { weapon: 'revolver', head: true, point: tp, knock: tp.clone().sub(from).normalize().multiplyScalar(4) });
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
  damageEnemy(e, head ? 70 : 45, { weapon: 'revolver', head, point: pt, knock: dir.clone().multiplyScalar(4) });
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
    damageEnemy(best.e, 40, { weapon: 'revolver', point: best.c });
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
  if (e.type === 'roost') { updateRoost(e, dt); return; }
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
      if (k === 'bulwark') e.atk = dist < def.r + 2.4 ? 'bash' : 'throw';
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
      e.atk = Math.random() < 0.45 ? 'land' : 'rain';
      e.wt = e.atk === 'land' ? 0.6 : 0.7;
      e.state = 'windup'; e.t = e.wt;
      sfx.screech(1);
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      if (e.atk === 'rain') {
        for (let i = -1; i <= 1; i++) {
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
      e.state = 'perch'; e.t = 2.6;
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
  const showVM = !menuish();
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
  if (decals.length > 220) scene.remove(decals.shift());
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
  while (debris.length > 90) removeDebris(debris[0]);
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
  for (let k = 1; k <= 3; k++) { const g = (W.cur + k) % 3; if (g === 0 || (g === 1 && owns('shotgun')) || (g === 2 && owns('nailgun'))) return g; }
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
    damageEnemy(e, 9 * dt, { weapon: 'nailgun' });
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
function updateArmSlot() { const el = $('armSlot'); if (el) el.textContent = `${keyLabel(settings.binds.punch[0])} ${ARM_NAMES[W.arm]}`; }
function slash() {
  W.punchCD = 0.28; W.punchT = 0.22;
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
      damageEnemy(e, 30 + 60 * c, { weapon: 'shock', point: ctr, explosion: true, knock: dir.clone().multiplyScalar(10 + 14 * c).setY(5 + 4 * c) });
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
        if (lineOfSight(from, eye)) { e.state = 'aim'; e.t = 1.5; e.aimAt = eye.clone(); sfx.windup(distVol(p)); }
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
    } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(2.5, 4) * DIFF().fire; }
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
  if (e.state !== 'dash' && e.state !== 'charge') e.mesh.rotation.y = Math.atan2(dx, dz);
  const sp = def.speed * rage * DIFF().speed;
  if (e.state === 'chase') {
    if (k === 'shard') {
      e.strafeT -= dt;
      if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rand(1, 2.5); }
      const want = dist > 10 ? 1 : dist < 6 ? -1 : 0;
      mx = (nx * want - nz * e.strafe) * sp; mz = (nz * want + nx * e.strafe) * sp;
    } else { mx = nx * sp; mz = nz * sp; }
    if (e.cd <= 0) {
      const r = Math.random();
      if (k === 'shard') e.atk = r < 0.4 ? 'dash' : r < 0.75 ? 'shards' : 'stance';
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
  sayLine(e.def.short, DUEL_LINES[e.type].win);
  const id = 'arm_' + lv.duel;
  const p = loadProgress();
  p.owned = p.owned || [];
  const fresh = !p.owned.includes(id);
  if (fresh) { p.owned.push(id); saveProgress(p); }
  setTimeout(() => {
    banner(fresh ? `NEW ARM: ${ARM_NAMES[lv.duel]}` : 'DUEL WON');
    if (fresh) { showHint(`Press ${keyLabel(settings.binds.arm[0])} to switch arms · ${ARM_NAMES[lv.duel]} is now yours`); W.arm = lv.duel; updateArmSlot(); }
  }, 1800);
}

// ================================================================ LEVEL SELECT (difficulty + duels)
function bestKey(lv) { return settings.difficulty === 'normal' ? lv.id : `${lv.id}:${settings.difficulty}`; }
function duelUnlocked(lv, prog) {
  const idx = LEVELS.findIndex((x) => x.id === lv.unlockAfter);
  return prog.unlocked > idx;
}
function renderLevels() {
  const prog = loadProgress();
  const diffRow = `<div class="diffRow">${Object.entries(DIFFS).map(([k, d]) => `<button data-diff="${k}" class="${settings.difficulty === k ? 'on' : ''}">${d.label}</button>`).join('')}<span>best ranks are kept per difficulty · scrap ×${DIFF().scrap}</span></div>`;
  const card = (l) => {
    const idx = LEVELS.findIndex((x) => x.id === l.id);
    const locked = l.duel ? !duelUnlocked(l, prog) : idx > prog.unlocked;
    const b = prog.best[bestKey(l)];
    const won = l.duel && (prog.owned || []).includes('arm_' + l.duel);
    return `<button class="lvl ${l.boss ? 'boss' : ''} ${l.duel ? 'duel' : ''}" data-idx="${idx}" ${locked ? 'disabled' : ''}><b>${l.id}</b><i>${locked ? (l.duel ? 'BEAT ' + l.unlockAfter : 'LOCKED') : l.name}</i>${b ? `<em class="g${GRADE_SHORT[b.rank]}">${GRADE_SHORT[b.rank]}</em><small>BEST ${fmtTime(b.time)}</small>` : ''}${l.duel ? `<small>${won ? 'ARM EARNED' : 'REWARD: ' + ARM_NAMES[l.duel] + ' ARM'}</small>` : ''}</button>`;
  };
  $('sceneList').innerHTML = `<div class="scrapLine">◆ ${prog.scrap || 0} SCRAP · spend it at the FORGE in any level's start room</div>` + diffRow +
    SCENES.map((sc) => `<div class="scene"><h3><span>SCENE ${sc.id}</span>${sc.name}</h3><div class="grid">${sc.levels.map(card).join('')}</div></div>`).join('') +
    `<div class="scene"><h3><span>SECRET</span>DUELS</h3><div class="grid">${DUELS.map(card).join('')}</div></div>`;
  $('sceneList').querySelectorAll('.lvl').forEach((b) => b.addEventListener('click', () => startLevel(Number(b.dataset.idx))));
  $('sceneList').querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => { settings.difficulty = b.dataset.diff; saveSettings(); renderLevels(); }));
}
updateArmSlot();

Object.assign(EPITHETS, { shard: ['DUEL', 'THE STAINED-GLASS SAINT'], bertha: ['DUEL', 'CHAMPION OF THE CELLAR RING'], kite: ['DUEL', 'TERROR OF THE ROOFTOPS'] });
applyVariantLook();
