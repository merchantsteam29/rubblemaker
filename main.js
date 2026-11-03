import * as THREE from 'three';
import { buildEnemyModel, animateEnemy, buildViewmodels } from './models.js';
import { settings, ACTIONS, DIFFS, keyLabel, initSettingsUI } from './settings.js';

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
const solids = [];      // AABBs {min, max}
const worldMeshes = []; // raycast targets

// a box whose UVs are in world space, so textures tile evenly at any size. y = bottom.
function box(x, y, z, w, h, d, mat, texSize = 4) {
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
  scene.add(m);
  worldMeshes.push(m);
  solids.push({ min: new V3(x - w / 2, y, z - d / 2), max: new V3(x + w / 2, y + h, z + d / 2) });
  return m;
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
  box(-1.5, 0, -7, 1.2, 5, 1, brickMat); // taller broken stub
  // corner platforms with steps
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(sx * 28, 0, sz * 28, 9, 3, 9, cobbleMat, 3);
    box(sx * 22, 0, sz * 28, 3, 1.5, 3, cobbleMat, 3);
    box(sx * 28, 3, sz * 31.5, 9, 1.2, 1, brickMat); // parapet
  }
  // low cover walls
  box(0, 0, 16, 8, 1.4, 1, brickMat);
  box(0, 0, -16, 8, 1.4, 1, brickMat);
  box(16, 0, 0, 1, 1.4, 8, brickMat);
  box(-16, 0, 0, 1, 1.4, 8, brickMat);
  // floating cobble ledges for wall-jumping fun
  box(-A + 1.5, 5, 10, 3, 0.8, 6, cobbleMat, 3);
  box(A - 1.5, 5, -10, 3, 0.8, 6, cobbleMat, 3);
}
buildArena();

// lights
scene.add(new THREE.HemisphereLight(0x9a90b8, 0x3a2414, 1.0));
const moon = new THREE.DirectionalLight(0xb8c0ff, 1.1);
moon.position.set(30, 55, 18);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
moon.shadow.bias = -0.0006;
scene.add(moon);

const torches = [];
const bracketMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.5 });
function torch(x, z, nx, nz) {
  const y = 4.5;
  const br = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), bracketMat);
  br.position.set(x + nx * 0.2, y, z + nz * 0.2);
  scene.add(br);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff8a2a, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.set(x + nx * 0.25, y + 0.55, z + nz * 0.25);
  flame.scale.setScalar(1.1);
  scene.add(flame);
  const light = new THREE.PointLight(0xff7a2a, 40, 26, 1.7);
  light.position.set(x + nx * 0.9, y + 0.6, z + nz * 0.9);
  scene.add(light);
  torches.push({ light, flame, ph: rand(0, 100) });
}
for (const t of [-18, 18]) {
  torch(t, -A, 0, 1); torch(t, A, 0, -1);
  torch(-A, t, 1, 0); torch(A, t, -1, 0);
}

// drifting embers
const EMBERS = 260;
const emberGeo = new THREE.BufferGeometry();
const emberPos = new Float32Array(EMBERS * 3);
for (let i = 0; i < EMBERS; i++) {
  emberPos[i * 3] = rand(-A, A); emberPos[i * 3 + 1] = rand(0, 14); emberPos[i * 3 + 2] = rand(-A, A);
}
emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xff7a30, size: 0.12, map: GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(embers);

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
  if (G.state === 'play' && (isBound(e.code) || e.code === 'Tab' || e.code === 'Space')) e.preventDefault();
  if (e.code === 'Escape' && G.state === 'settings') { closeSettings(); return; }
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
addEventListener('wheel', () => { if (G.state === 'play' && settings.wheelSwap) switchWeapon(W.cur === 0 ? 1 : 0); });

// ---------------------------------------------------------------- game state
const G = { state: 'menu', wave: 0, toSpawn: [], spawnT: 0, breakT: 0, score: 0, time: 0, kills: 0, hitstop: 0, shake: 0, bestRank: 0, waveActive: false };
const P = {
  pos: new V3(0, 0, 12), vel: new V3(), yaw: 0, pitch: 0, hp: 100, grounded: false,
  wallJumps: 3, pips: 3, dashT: 0, dashDir: new V3(), sliding: false, slideDir: new V3(),
  slamming: false, slamFall: 0, invuln: 0, camH: 1.6, roll: 0, bob: 0, hurtFlash: 0,
};
const PR = 0.4, PH = 1.8;

// ---------------------------------------------------------------- collisions
function overlapBox(minx, miny, minz, maxx, maxy, maxz) {
  for (const s of solids) {
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
const fresh = { revolver: 1, shotgun: 1, punch: 1, slam: 1 };
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
  G.score += gained * (1 + ST.idx * 0.25);
  if (label) pushFeed('+' + label, cls);
}
function loseStyle(n) {
  ST.points = Math.max(0, ST.points - n);
}

// ---------------------------------------------------------------- viewmodel
const VM = buildViewmodels(GLOW);
const { revolver, shotgun, arm, revFlash, shotFlash, chargeMat, pump: pumpMesh } = VM;
vmScene.add(revolver, shotgun, arm);
const guns = [revolver, shotgun];
const WNAMES = ['REVOLVER', 'SHOTGUN'];

const W = { cur: 0, cd: 0, switchT: 0, lastSwitch: -9, charge: 0, charging: false, punchCD: 0, punchT: 0, kick: 0, coreCD: 0, flashT: 0 };
function switchWeapon(i) {
  if (i === W.cur) return;
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
  heavy: { hp: 340, speed: 3.6, r: 1.0, h: 3.25, color: 0xa07a4a, mass: 3.5, kill: 160, label: 'BIG KILL' },
};
const enemies = [];
function makeEnemy(type, x, z) {
  const def = DEFS[type];
  const model = buildEnemyModel(type, def.color);
  const g = model.root;
  g.position.set(x, -def.h, z);
  scene.add(g);
  const e = {
    type, def, mesh: g, mats: model.mats, extraMats: model.extraMats, hit: model.hit, rig: model.rig, orb: model.orb,
    hp: def.hp, vel: new V3(), state: 'chase', t: 0, cd: rand(0.8, 2), flash: 0,
    grounded: true, strafe: Math.random() < 0.5 ? -1 : 1, strafeT: rand(1, 3), spawnT: 0.7, dead: false, walk: rand(0, 6),
  };
  for (const m of model.hit) m.userData.enemy = e;
  enemies.push(e);
  // spawn fx
  const pos = new V3(x, 0.2, z);
  ringFx(pos, 2.5, 0xff3a2a);
  burst(pos, 14, 0xff4a2a, 7, 0.15, 0.6, true, 0.3, 1.2);
  sfx.spawn(distVol(pos));
  return e;
}

function enemyCollide(e) {
  const r = e.def.r, p = e.mesh.position;
  for (const s of solids) {
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
      p.y = -e.def.h * Math.max(0, e.spawnT / 0.7);
      continue;
    }
    const dx = P.pos.x - p.x, dz = P.pos.z - p.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    e.mesh.rotation.y = Math.atan2(dx, dz);
    let mx = 0, mz = 0;
    e.cd -= dt; e.t -= dt;
    const def = e.def;
    let windupGlow = 0;

    if (e.type === 'grunt') {
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

    // physics
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
    if (p.y < -20) { p.set(0, 1, 0); e.vel.set(0, 0, 0); }

    // walk bob
    const moving = Math.hypot(mx, mz) > 0.5 && e.grounded;
    if (moving) e.walk += dt * def.speed * 1.6;
    animateEnemy(e, dt, moving || (e.type === 'shooter' && Math.hypot(mx, mz) > 0.5), windupGlow, G.time);

    // flash / telegraph
    e.flash -= dt;
    for (const mt of e.mats) {
      if (e.flash > 0) { mt.emissive.setRGB(1, 1, 1); mt.emissiveIntensity = 1.1; }
      else if (windupGlow > 0) { mt.emissive.setRGB(1, 0.15, 0.05); mt.emissiveIntensity = windupGlow * (0.6 + 0.4 * Math.sin(G.time * 40)); }
      else { mt.emissive.setHex(mt.userData.baseEmissive); mt.emissiveIntensity = mt.userData.baseIntensity; }
    }
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
  e.hp -= dmg;
  e.flash = 0.07;
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
  const c = e.mesh.position.clone(); c.y += e.def.h * 0.5;
  burst(c, e.type === 'heavy' ? 34 : 18, e.def.color, 10, 0.3, 1.4, false, 1, 0.6);
  burst(c, 16, 0x8a0a0a, 9, 0.16, 1.0, false, 1, 0.5);
  burst(c, 8, 0xffa04a, 6, 0.08, 0.4, true, 0.2);
  scene.remove(e.mesh);
  for (const mt of [...e.mats, ...e.extraMats]) mt.dispose();
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
  P.invuln = 0.15;
  P.hurtFlash = 1;
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
  for (let i = 0; i < 11; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.09;
    const d = dir.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    ray.set(origin, d); ray.far = 80;
    const h = ray.intersectObjects(targets, false)[0];
    const end = h ? h.point : origin.clone().addScaledVector(d, 80);
    if (i % 2 === 0) tracer(m, end, 0xffc080, 0.015, 0.06);
    if (!h) continue;
    const o = h.object;
    if (o.userData.core) { detonateCore(o.userData.core, false); continue; }
    const e = o.userData.enemy;
    if (e) {
      const head = o.userData.part === 'head';
      const falloff = clamp(1.4 - h.distance / 20, 0.25, 1);
      const rec = dmgMap.get(e) || { dmg: 0, head: false, point: h.point };
      rec.dmg += (head ? 13 : 9) * falloff;
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
  sfx.shotgun();
  setTimeout(() => sfx.pump(), 380);
  W.kick = 2; W.flashT = 0.07; G.shake = Math.max(G.shake, 0.12);
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
    damageEnemy(e, dmg * k, { weapon: weapon === 'combo' ? null : 'shotgun', point: c, knock: away });
    hitAny++;
  }
  if (hitAny && weapon !== 'combo') useWeapon('shotgun');
  if (hitAny >= 3) addStyle(60, 'COLLATERAL', null, 'cool');
  if (weapon === 'punchcore' && hitAny) addStyle(80, 'HOMERUN', 'punch', 'big');
  // self damage + blast jump
  const pc = new V3(P.pos.x, P.pos.y + 0.9, P.pos.z);
  const pd = pc.distanceTo(pos);
  if (pd < radius * 0.75) {
    const away = pc.sub(pos).normalize();
    P.vel.addScaledVector(away, 12); P.vel.y = Math.max(P.vel.y, 11);
    P.grounded = false;
    if (P.invuln <= 0 && P.dashT <= 0) {
      P.hp -= 12; P.hurtFlash = 0.6;
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
  // parry projectiles
  for (const o of orbs) {
    if (o.parried) continue;
    const to = o.m.position.clone().sub(origin);
    const d = to.length();
    if (d < 3.6 && to.normalize().dot(dir) > 0.45) {
      o.parried = true; o.dmg = 90; o.life = 4;
      o.vel.copy(dir).multiplyScalar(42);
      o.m.material.color.set(0x9ae8ff); o.glow.material.color.set(0x3ac8ff);
      did = true;
      sfx.parry();
      G.hitstop = 0.11;
      heal(25);
      addStyle(100, 'PARRY', null, 'big');
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
          damageEnemy(e, o.dmg, { weapon: null, point: p.clone(), knock: o.vel.clone().normalize().multiplyScalar(8).setY(4) });
          dead = true; break;
        }
      }
    }
    if (dead) {
      burst(p, 8, o.parried ? 0x6ad8ff : 0xffb02a, 5, 0.08, 0.35, true, 0.2);
      if (o.parried) blastFx(p, 1.8, 0x6ad8ff);
      scene.remove(o.m); o.m.material.dispose(); o.glow.material.dispose();
      orbs.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- player
function slamImpact() {
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
  P.landedT = P.grounded ? (wasGrounded ? (P.landedT || 0) + dt : 0) : 0;
  if (P.grounded) {
    P.wallJumps = 3;
    if (P.slamming) { P.slamming = false; slamImpact(); }
  }
  if (P.pos.y < -15) { P.pos.set(0, 1, 12); P.vel.set(0, 0, 0); }

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
  W.cd -= dt; W.punchCD -= dt; W.coreCD -= dt; W.switchT = Math.max(0, W.switchT - dt);
  if (hit('weapon1')) switchWeapon(0);
  if (hit('weapon2')) switchWeapon(1);
  if (hit('swap')) switchWeapon(W.cur === 0 ? 1 : 0);
  if (hit('punch') && W.punchCD <= 0) punch();

  if (W.cur === 0) {
    if (down('alt') && W.cd <= 0) { W.charging = true; W.charge = Math.min(1, W.charge + dt / 0.9); }
    if (!down('alt') && W.charging) {
      if (W.charge >= 1) { fireCharged(); W.cd = 0.5; }
      W.charging = false; W.charge = 0;
    }
    if (down('fire') && !W.charging && W.cd <= 0) { fireRevolver(); W.cd = 0.36; W.revSpin = 1; }
  } else {
    if (down('fire') && W.cd <= 0) { fireShotgun(); W.cd = 0.9; }
    if (hit('alt') && W.coreCD <= 0 && W.cd <= 0.3) { throwCore(); W.coreCD = 1.1; W.cd = Math.max(W.cd, 0.35); }
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
  g.position.set(
    b.x + bobX - swayX * 0.0004,
    b.y - bobY - W.switchT * 2 + swayY * 0.0004 - (P.sliding ? 0.03 : 0),
    b.z + W.kick * 0.06,
  );
  g.rotation.set(W.kick * 0.18, -swayX * 0.0006, P.sliding ? 0.15 : 0);
  if (W.cur === 0 && W.charging) {
    g.position.x += rand(-1, 1) * 0.003 * W.charge;
    g.position.y += rand(-1, 1) * 0.003 * W.charge;
  }
  chargeMat.emissiveIntensity = 0.6 + W.charge * 5 + (W.charge >= 1 ? Math.sin(G.time * 30) * 1.5 : 0);
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
  arm.position.lerpVectors(arm.userData.rest, arm.userData.hit, k);
  arm.rotation.set(k * 0.2, k * 0.25, 0);
  arm.visible = k > 0.01;
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
  makeEnemy(type, x + rand(-1.5, 1.5), z + rand(-1.5, 1.5));
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
  if (W.cur !== ui.weapon) { ui.weapon = W.cur; $('weaponName').textContent = WNAMES[W.cur]; }
  const fi = freshInfo(fresh[W.cur === 0 ? 'revolver' : 'shotgun']);
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
  camera.rotation.set(P.pitch, P.yaw, P.roll);
  camera.updateMatrixWorld();

  updateWeapons(dt);
  updateEnemies(dt);
  updateOrbs(dt);
  updateCores(dt);
  updateWaves(dt);

  // style decay + freshness recovery
  const decay = (12 + ST.idx * 10) * (enemies.length ? 1 : 0.35);
  ST.points = Math.max(0, ST.points - decay * dt);
  for (const k in fresh) fresh[k] = Math.min(1, fresh[k] + dt * 0.012);
}

function updateAmbient(dt, t) {
  for (const tc of torches) {
    const f = 0.8 + Math.sin(t * 9 + tc.ph) * 0.1 + Math.sin(t * 23 + tc.ph * 2) * 0.08 + Math.random() * 0.05;
    tc.light.intensity = 40 * f;
    tc.flame.scale.setScalar(1.0 + f * 0.3);
  }
  const a = emberGeo.attributes.position.array;
  for (let i = 0; i < EMBERS; i++) {
    a[i * 3 + 1] += dt * (0.4 + (i % 7) * 0.08);
    a[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.3;
    if (a[i * 3 + 1] > 15) a[i * 3 + 1] = 0;
  }
  emberGeo.attributes.position.needsUpdate = true;
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (G.state === 'play') {
    let gdt = dt;
    if (G.hitstop > 0) { G.hitstop -= dt; gdt = dt * 0.05; }
    update(gdt);
    updateParts(gdt);
    updateTracers(dt);
    updateBlasts(gdt);
    updateViewmodel(dt);
    updateHUD();
  } else if (G.state === 'menu' || (G.state === 'settings' && settingsFrom === 'menu')) {
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.1) * 22, 7, Math.cos(t * 0.1) * 22);
    camera.lookAt(0, 2, 0);
  }
  updateAmbient(dt, now / 1000);
  pressed.clear(); released.clear();
  updateFPS(now);
  renderer.clear();
  renderer.render(scene, camera);
  if (G.state !== 'menu' && !(G.state === 'settings' && settingsFrom === 'menu')) {
    renderer.clearDepth();
    renderer.render(vmScene, vmCam);
  }
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- flow
function clearWorld() {
  for (const e of enemies) scene.remove(e.mesh);
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
  for (const k in fresh) fresh[k] = 1;
  ui.rank = -1; ui.hp = -1;
  W.cur = 1; switchWeapon(0);
  keys.clear();
  $('wave').textContent = 'GET READY';
}
function requestLock() {
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
  $('best').textContent = b ? `BEST: ${b.score.toLocaleString()} · WAVE ${b.wave} · ${RANKS[b.rank].l}` : '';
}
renderBest();

function startGame() {
  initAudio();
  resetGame();
  G.state = 'play';
  show('menu', false); show('over', false); show('pause', false); show('hud', true);
  requestLock();
}
function gameOver() {
  if (G.state !== 'play') return;
  G.state = 'over';
  document.exitPointerLock?.();
  const score = Math.floor(G.score);
  const best = loadBest();
  const isBest = !best || score > best.score;
  if (isBest) saveBest({ score, wave: G.wave, rank: G.bestRank });
  $('overStats').innerHTML =
    `SCORE ${score.toLocaleString()}${isBest ? ' — NEW BEST!' : ''}<br>WAVE ${G.wave} · ${G.kills} KILLS<br>HIGHEST STYLE: ${RANKS[G.bestRank].l}`;
  show('hud', false);
  setTimeout(() => show('over', true), 600);
  sfx.explode();
}

$('startBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', () => { startGame(); renderBest(); });
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
$('quitBtn').addEventListener('click', () => {
  clearWorld();
  G.state = 'menu';
  show('pause', false); show('hud', false); show('menu', true);
  renderBest();
});

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
  torches.forEach((t, i) => (t.light.visible = q !== 'low' || i % 2 === 0));
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
  if (k === 'quality') applyQuality();
  if (k === 'master' || k === 'sfx') { initAudio(); applyVolume(); sfx.hit(); }
  if (k.startsWith('cross')) applyCrosshair();
  if (k === 'showFPS') show('fps', settings.showFPS);
  if (k === 'binds') renderControls();
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
