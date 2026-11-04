import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// =====================================================================
//  RUBBLEMAKER models — v3 total redesign.
//  Enemies are built once per type as a template, baked (parts merged per
//  pivot + material, so detail is cheap to draw), then cloned per spawn
//  with their own flash-able materials.
// =====================================================================

const geoCache = new Map();
const cached = (key, make) => { let g = geoCache.get(key); if (!g) { g = make(); geoCache.set(key, g); } return g; };
const B = (w, h, d) => cached(`b${w},${h},${d}`, () => { const r = Math.min(w, h, d) * 0.22; return r > 0.006 ? new RoundedBoxGeometry(w, h, d, 1, r) : new THREE.BoxGeometry(w, h, d); });
const C = (rt, rb, h, s = 8) => cached(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const K = (r, h, s = 5) => cached(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const T = (r, t, rs = 6, ts = 16, arc = Math.PI * 2) => cached(`t${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const S = (r, w = 10, h = 7) => cached(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const O = (r) => cached(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));
const HP = Math.PI / 2;

function m(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  if (sx !== 1 || sy !== 1 || sz !== 1) o.scale.set(sx, sy, sz);
  parent.add(o);
  return o;
}
function pivot(parent, name, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name || '';
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
const mirror = (fn) => { fn(-1); fn(1); };

// Merge every plain child mesh of each group by material. Meshes flagged keep/noHit or with children stay separate.
function bake(root) {
  const groups = [];
  root.traverse((o) => { if (o.isGroup || o === root) groups.push(o); });
  for (const g of groups) {
    const byMat = new Map();
    for (const c of g.children.slice()) {
      if (!c.isMesh || c.userData.keep || c.userData.noHit || c.children.length) continue;
      c.updateMatrix();
      const geo = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
      geo.applyMatrix4(c.matrix);
      for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      const key = c.material.uuid;
      if (!byMat.has(key)) byMat.set(key, { mat: c.material, geos: [] });
      byMat.get(key).geos.push(geo);
      g.remove(c);
    }
    for (const { mat, geos } of byMat.values()) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      g.add(mesh);
    }
  }
}

// ---------------------------------------------------------------- materials
const role = (r) => { const mt = new THREE.MeshStandardMaterial({ color: 0xffffff }); mt.userData.role = r; return mt; };
const ROLE = { skin: role('skin'), armor: role('armor'), bone: role('bone'), cloth: role('cloth') };
const DARK = new THREE.MeshStandardMaterial({ color: 0x120f12, roughness: 0.9, flatShading: true });
const glowMats = new Map();
const glowMat = (hex) => { if (!glowMats.has(hex)) glowMats.set(hex, new THREE.MeshBasicMaterial({ color: hex })); return glowMats.get(hex); };

const PALETTE = {
  grunt: { armor: 0x34323a, cloth: 0x3a160e, glow: 0xffa02a },
  shooter: { armor: 0x8a6e2e, cloth: 0x1e1a34, glow: 0xffd04a },
  heavy: { armor: 0x403630, cloth: 0x2a1c12, glow: 0xff5a1a },
  flyer: { armor: 0x2e2c34, cloth: 0x2a2228, glow: 0xff8a2a },
};

// ---------------------------------------------------------------- templates
function buildHusk(G) {
  const root = new THREE.Group();
  const hips = pivot(root, 'hips', 0, 0.95, 0);
  m(B(0.56, 0.24, 0.36), ROLE.skin, hips);
  m(B(0.64, 0.09, 0.44), ROLE.armor, hips, 0, 0.08, 0);
  m(S(0.065), ROLE.bone, hips, 0, 0.08, 0.23);                                   // skull buckle
  m(B(0.34, 0.5, 0.03), ROLE.cloth, hips, 0, -0.22, 0.2, -0.08);                 // loincloth
  m(B(0.44, 0.6, 0.03), ROLE.cloth, hips, 0, -0.26, -0.2, 0.1);
  for (const x of [-0.12, 0, 0.12]) m(K(0.05, 0.16, 3), ROLE.cloth, hips, x, -0.52, 0.2, Math.PI);
  mirror((s) => {
    m(B(0.14, 0.2, 0.3), ROLE.armor, hips, s * 0.33, -0.02, 0, 0, 0, s * 0.25);   // hip guards
    const hip = pivot(hips, s < 0 ? 'hipL' : 'hipR', s * 0.19, -0.04, 0);
    m(C(0.115, 0.09, 0.48, 6), ROLE.skin, hip, 0, -0.22, 0.02, 0.12);
    m(S(0.1, 6, 5), ROLE.skin, hip, 0, -0.1, 0.05);
    const knee = pivot(hip, s < 0 ? 'kneeL' : 'kneeR', 0, -0.45, 0);
    m(S(0.08, 6, 5), ROLE.bone, knee, 0, 0, 0.06);
    m(C(0.085, 0.06, 0.46, 6), ROLE.skin, knee, 0, -0.22, 0);
    m(B(0.12, 0.32, 0.05), ROLE.bone, knee, 0, -0.2, 0.08);
    m(K(0.035, 0.14, 4), ROLE.bone, knee, 0, 0.02, 0.15, HP);
    m(B(0.18, 0.08, 0.3), ROLE.armor, knee, 0, -0.46, 0.07);
    for (const t of [-0.06, 0, 0.06]) m(K(0.022, 0.12, 3), ROLE.bone, knee, t, -0.47, 0.26, HP);
  });
  const torso = pivot(root.getObjectByName('hips'), 'torso', 0, 0.12, 0);
  torso.rotation.x = 0.28;
  m(C(0.22, 0.27, 0.32, 7), ROLE.skin, torso, 0, 0.18, 0);
  m(B(0.66, 0.42, 0.42), ROLE.skin, torso, 0, 0.53, 0);
  for (let i = 0; i < 4; i++) m(T(0.27 - i * 0.02, 0.022, 4, 10, Math.PI), ROLE.bone, torso, 0, 0.36 + i * 0.09, 0.02, HP);
  m(B(0.06, 0.36, 0.05), ROLE.bone, torso, 0, 0.5, 0.28);
  m(B(0.34, 0.06, 0.02), G, torso, 0, 0.47, 0.205);                              // heart glow behind ribs
  for (let i = 0; i < 5; i++) {
    m(S(0.06, 6, 4), ROLE.bone, torso, 0, 0.25 + i * 0.13, -0.22);
    m(K(0.04, 0.16, 4), ROLE.bone, torso, 0, 0.28 + i * 0.13, -0.3, -HP - 0.5);
  }
  m(B(0.38, 0.17, 0.42), ROLE.armor, torso, -0.5, 0.8, 0, 0, 0, 0.35);           // left pauldron
  m(B(0.3, 0.1, 0.34), ROLE.armor, torso, -0.56, 0.9, 0, 0, 0, 0.45);
  for (const z of [-0.12, 0.12]) m(K(0.05, 0.22, 4), ROLE.armor, torso, -0.62, 0.98, z, 0, 0, 0.6);
  m(B(0.3, 0.1, 0.34), ROLE.bone, torso, 0.5, 0.82, 0, 0, 0, -0.3);              // right bone plate
  m(B(0.5, 0.1, 0.3), ROLE.armor, torso, 0, 0.8, 0.02);
  const head = pivot(torso, 'head', 0, 0.82, 0.12);
  m(C(0.08, 0.1, 0.16, 6), ROLE.skin, head, 0, 0.04, 0);
  m(B(0.34, 0.3, 0.46), ROLE.skin, head, 0, 0.21, 0.06);
  m(B(0.12, 0.06, 0.42), ROLE.bone, head, 0, 0.37, 0.04);
  m(B(0.38, 0.07, 0.1), ROLE.armor, head, 0, 0.29, 0.27);
  mirror((s) => m(B(0.07, 0.035, 0.02), G, head, s * 0.09, 0.245, 0.315));
  m(B(0.05, 0.03, 0.02), G, head, 0, 0.32, 0.305);
  for (let i = 0; i < 6; i++) m(K(0.016, 0.06, 3), ROLE.bone, head, -0.1 + i * 0.04, 0.1, 0.3, Math.PI);
  const jaw = pivot(head, 'jaw', 0, 0.1, 0.02);
  m(B(0.3, 0.09, 0.34), ROLE.skin, jaw, 0, -0.05, 0.12);
  for (let i = 0; i < 6; i++) m(K(0.015, 0.055, 3), ROLE.bone, jaw, -0.1 + i * 0.04, 0.0, 0.27);
  mirror((s) => {
    m(K(0.055, 0.22, 5), ROLE.bone, head, s * 0.15, 0.4, -0.02, -0.6, 0, -s * 0.4);
    m(K(0.035, 0.2, 5), ROLE.bone, head, s * 0.22, 0.5, -0.14, -1.4, 0, -s * 0.2);
  });
  mirror((s) => {
    const sh = pivot(torso, s < 0 ? 'shL' : 'shR', s * 0.46, 0.68, 0);
    sh.rotation.z = -s * 0.15;
    m(C(0.09, 0.08, 0.42, 6), ROLE.skin, sh, 0, -0.2, 0);
    m(S(0.1, 6, 5), ROLE.skin, sh, 0, -0.12, 0.03);
    const el = pivot(sh, s < 0 ? 'elL' : 'elR', 0, -0.4, 0);
    m(C(0.08, 0.07, 0.38, 6), ROLE.skin, el, 0, -0.17, 0);
    m(C(0.105, 0.095, 0.22, 6), ROLE.armor, el, 0, -0.14, 0);
    m(B(0.215, 0.025, 0.215), G, el, 0, -0.06, 0);
    m(K(0.03, 0.14, 4), ROLE.bone, el, 0, 0.02, -0.09, -HP);
    m(B(0.14, 0.1, 0.14), ROLE.skin, el, 0, -0.4, 0);
    if (s < 0) {
      for (let i = 0; i < 4; i++) m(K(0.022, 0.22, 3), ROLE.bone, el, -0.06 + i * 0.04, -0.56, 0.04, Math.PI + 0.25);
    } else {
      m(B(0.04, 0.6, 0.24), ROLE.bone, el, 0, -0.66, 0.1);                       // bone cleaver
      m(B(0.045, 0.56, 0.02), G, el, 0, -0.66, 0.23);
      m(B(0.06, 0.08, 0.08), ROLE.armor, el, 0, -0.38, 0.02);
    }
  });
  return root;
}

function buildCaster(G) {
  const root = new THREE.Group();
  const hips = pivot(root, 'hips', 0, 0, 0);
  m(C(0.3, 0.42, 0.5, 8), ROLE.cloth, hips, 0, 1.0, 0);
  m(C(0.42, 0.56, 0.52, 8), ROLE.cloth, hips, 0, 0.55, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    m(K(0.08, 0.32, 3), ROLE.cloth, hips, Math.sin(a) * 0.5, 0.18, Math.cos(a) * 0.5, Math.PI);
  }
  m(B(0.24, 0.92, 0.03), ROLE.armor, hips, 0, 0.75, 0.44, -0.13);
  for (let i = 0; i < 3; i++) m(O(0.04), G, hips, 0, 0.5 + i * 0.22, 0.47);
  m(T(0.33, 0.03, 4, 16), ROLE.armor, hips, 0, 1.16, 0, HP);
  mirror((s) => { m(C(0.006, 0.006, 0.3, 4), DARK, hips, s * 0.18, 1.0, 0.3); m(O(0.05), G, hips, s * 0.18, 0.83, 0.3); });
  const torso = pivot(hips, 'torso', 0, 1.3, 0);
  m(B(0.5, 0.48, 0.32), ROLE.cloth, torso, 0, 0.2, 0);
  m(C(0.25, 0.46, 0.26, 8), ROLE.cloth, torso, 0, 0.36, 0);
  m(C(0.2, 0.28, 0.2, 8), ROLE.armor, torso, 0, 0.5, 0);
  m(O(0.08), G, torso, 0, 0.24, 0.18);
  mirror((s) => {
    m(C(0.035, 0.035, 0.14, 6), ROLE.bone, torso, s * 0.34, 0.55, -0.04);
    m(O(0.035), G, torso, s * 0.34, 0.66, -0.04);
    m(K(0.05, 0.28, 4), ROLE.armor, torso, s * 0.42, 0.52, 0, 0, 0, -s * 0.7);
  });
  const head = pivot(torso, 'head', 0, 0.55, 0);
  m(K(0.3, 0.64, 7), ROLE.cloth, head, 0, 0.26, -0.02);
  m(B(0.24, 0.26, 0.12), DARK, head, 0, 0.12, 0.13);
  m(B(0.22, 0.17, 0.05), ROLE.bone, head, 0, 0.16, 0.2);
  m(K(0.07, 0.42, 4), ROLE.bone, head, 0, 0.07, 0.4, HP);
  mirror((s) => m(B(0.055, 0.025, 0.02), G, head, s * 0.06, 0.2, 0.226));
  const halo = m(T(0.38, 0.025, 6, 24), G, head, 0, 0.32, -0.26);
  halo.name = 'halo'; halo.userData.noHit = true;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    m(K(0.025, 0.14, 3), G, halo, Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0, 0, 0, a - HP);
  }
  mirror((s) => {
    const sh = pivot(torso, s < 0 ? 'shL' : 'shR', s * 0.34, 0.38, 0);
    sh.rotation.z = -s * 0.25;
    m(C(0.065, 0.06, 0.38, 6), ROLE.cloth, sh, 0, -0.18, 0);
    m(K(0.13, 0.24, 6), ROLE.cloth, sh, 0, -0.38, 0);
    const el = pivot(sh, s < 0 ? 'elL' : 'elR', 0, -0.36, 0);
    m(C(0.04, 0.035, 0.34, 5), ROLE.bone, el, 0, -0.16, 0);
    m(S(0.05, 6, 5), ROLE.bone, el, 0, -0.36, 0);
    for (let i = 0; i < 4; i++) m(K(0.012, 0.15, 3), ROLE.bone, el, -0.03 + i * 0.02, -0.46, 0.02, Math.PI + 0.2);
    if (s > 0) {
      const orb = pivot(el, 'orb', 0, -0.6, 0.05);
      const core = m(S(1, 14, 10), glowMat(0xffc23a), orb);
      core.userData.noHit = true;
      for (let k = 0; k < 2; k++) {
        const ring = m(T(1.5, 0.08, 4, 20), G, orb, 0, 0, 0, k * 1.2, k * 0.8);
        ring.name = 'orbRing' + k; ring.userData.noHit = true;
      }
      orb.scale.setScalar(0.08);
    }
  });
  return root;
}

function buildBrute(G) {
  const root = new THREE.Group();
  const hips = pivot(root, 'hips', 0, 1.0, 0);
  m(B(1.2, 0.42, 0.8), ROLE.skin, hips);
  m(B(1.32, 0.15, 0.92), ROLE.armor, hips, 0, 0.12, 0);
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    m(B(0.28, 0.5, 0.06), ROLE.armor, hips, Math.sin(a) * 0.62, -0.2, Math.cos(a) * 0.45, -0.15, a, 0);
  }
  for (let i = 0; i < 6; i++) m(C(0.03, 0.03, 0.05, 6), DARK, hips, -0.5 + i * 0.2, 0.12, 0.47, HP);
  mirror((s) => {
    const hip = pivot(hips, s < 0 ? 'hipL' : 'hipR', s * 0.42, -0.1, 0);
    m(C(0.27, 0.22, 0.5, 7), ROLE.skin, hip, 0, -0.25, 0);
    const knee = pivot(hip, s < 0 ? 'kneeL' : 'kneeR', 0, -0.5, 0);
    m(C(0.24, 0.29, 0.44, 7), ROLE.armor, knee, 0, -0.2, 0);
    m(B(0.32, 0.26, 0.12), ROLE.armor, knee, 0, 0.0, 0.26);
    m(K(0.06, 0.2, 4), ROLE.armor, knee, 0, 0.04, 0.36, HP);
    m(B(0.6, 0.18, 0.82), ROLE.armor, knee, 0, -0.42, 0.1);
    for (const t of [-0.2, 0, 0.2]) m(K(0.05, 0.14, 4), DARK, knee, t, -0.44, 0.56, HP);
  });
  const torso = pivot(hips, 'torso', 0, 0.2, 0);
  m(C(0.62, 0.68, 0.6, 8), ROLE.skin, torso, 0, 0.3, 0);
  m(B(1.9, 0.95, 1.15), ROLE.skin, torso, 0, 1.0, 0);
  mirror((s) => m(B(0.8, 0.48, 0.24), ROLE.skin, torso, s * 0.42, 1.1, 0.5));
  m(B(0.84, 0.52, 0.06), G, torso, 0, 0.36, 0.64);                                // furnace belly
  for (let i = 0; i < 5; i++) m(B(0.06, 0.58, 0.08), ROLE.armor, torso, -0.32 + i * 0.16, 0.36, 0.68);
  m(B(0.92, 0.08, 0.1), ROLE.armor, torso, 0, 0.66, 0.68);
  m(B(0.26, 1.45, 0.1), ROLE.armor, torso, 0, 1.0, 0.64, 0, 0, 0.6);              // chest strap
  for (let i = 0; i < 4; i++) m(C(0.035, 0.035, 0.05, 6), DARK, torso, -0.38 + i * 0.26, 0.68 + i * 0.2, 0.7, HP);
  m(B(1.4, 0.6, 0.6), ROLE.skin, torso, 0, 1.42, -0.35);
  for (const x of [-0.45, 0, 0.45]) {
    m(C(0.12, 0.15, 0.7, 8), ROLE.armor, torso, x, 1.8, -0.5, -0.2);
    m(C(0.1, 0.1, 0.06, 8), G, torso, x, 2.15, -0.57, -0.2);
  }
  mirror((s) => {
    for (let i = 0; i < 3; i++) m(B(0.9 - i * 0.12, 0.16, 1.0 - i * 0.12), ROLE.armor, torso, s * (1.02 + i * 0.03), 1.48 + i * 0.13, 0, 0, 0, -s * (0.18 + i * 0.06));
    for (const z of [-0.25, 0.25]) m(K(0.08, 0.32, 4), DARK, torso, s * 1.15, 1.9, z, 0, 0, -s * 0.35);
  });
  const head = pivot(torso, 'head', 0, 1.48, 0.42);
  m(B(0.55, 0.48, 0.55), ROLE.skin, head, 0, 0.15, 0);
  m(B(0.6, 0.32, 0.1), ROLE.armor, head, 0, 0.14, 0.3);
  mirror((s) => {
    m(B(0.14, 0.04, 0.02), G, head, s * 0.12, 0.2, 0.355);
    m(K(0.05, 0.24, 5), ROLE.bone, head, s * 0.2, 0.04, 0.34, -0.3, 0, s * 0.15);
    m(K(0.06, 0.28, 4), ROLE.armor, head, s * 0.28, 0.42, 0, 0, 0, -s * 1.0);
  });
  m(B(0.62, 0.1, 0.6), ROLE.armor, head, 0, 0.42, 0);
  mirror((s) => {
    const sh = pivot(torso, s < 0 ? 'shL' : 'shR', s * 1.15, 1.2, 0);
    sh.rotation.z = -s * 0.12;
    m(C(0.28, 0.24, 0.7, 7), ROLE.skin, sh, 0, -0.3, 0);
    const el = pivot(sh, s < 0 ? 'elL' : 'elR', 0, -0.65, 0);
    m(C(0.3, 0.34, 0.6, 7), ROLE.armor, el, 0, -0.25, 0);
    m(B(0.08, 0.3, 0.08), G, el, s * 0.3, -0.25, 0.18);
    for (let i = 0; i < 3; i++) m(T(0.33, 0.035, 4, 10), DARK, el, 0, -0.08 - i * 0.14, 0, HP + (i % 2) * 0.2, 0, 0);
    m(B(0.8, 0.62, 0.8), ROLE.armor, el, 0, -0.8, 0);
    m(B(0.82, 0.08, 0.1), G, el, 0, -0.63, 0.4);
    for (const x of [-0.25, 0, 0.25]) m(K(0.07, 0.2, 4), DARK, el, x, -0.75, 0.48, HP);
  });
  return root;
}

function buildGargoyle(G) {
  const root = new THREE.Group();
  const hips = pivot(root, 'hips', 0, 0.5, 0);
  m(C(0.2, 0.25, 0.64, 6), ROLE.skin, hips, 0, 0, 0, HP);
  m(B(0.38, 0.28, 0.12), ROLE.armor, hips, 0, 0, 0.3);
  m(B(0.22, 0.05, 0.3), G, hips, 0, -0.2, 0.05);
  for (let i = 0; i < 4; i++) m(K(0.045, 0.16, 4), ROLE.bone, hips, 0, 0.22, 0.22 - i * 0.16, -0.4);
  const head = pivot(hips, 'head', 0, 0.12, 0.38);
  m(B(0.28, 0.24, 0.3), ROLE.skin, head, 0, 0.02, 0.08);
  m(B(0.18, 0.1, 0.22), ROLE.armor, head, 0, 0.02, 0.28);
  m(B(0.16, 0.05, 0.2), ROLE.skin, head, 0, -0.09, 0.26, 0.15);
  for (let i = 0; i < 5; i++) { m(K(0.013, 0.05, 3), ROLE.bone, head, -0.06 + i * 0.03, -0.03, 0.37, Math.PI); m(K(0.012, 0.045, 3), ROLE.bone, head, -0.05 + i * 0.025, -0.08, 0.34); }
  mirror((s) => {
    m(B(0.065, 0.03, 0.02), G, head, s * 0.07, 0.08, 0.235);
    m(K(0.045, 0.28, 5), ROLE.bone, head, s * 0.11, 0.18, -0.02, -1.0, 0, -s * 0.35);
    m(K(0.03, 0.18, 5), ROLE.bone, head, s * 0.16, 0.24, -0.22, -1.9, 0, -s * 0.2);
  });
  mirror((s) => {
    const w = pivot(hips, s < 0 ? 'wL' : 'wR', s * 0.22, 0.1, 0);
    m(B(0.82, 0.06, 0.07), ROLE.bone, w, s * 0.41, 0, 0.04);
    m(B(0.8, 0.02, 0.56), ROLE.skin, w, s * 0.4, -0.01, -0.22);
    for (const [t, l] of [[0.25, 0.5], [0.55, 0.6]]) m(B(0.025, 0.025, l), ROLE.bone, w, s * t, 0, -l / 2 + 0.02);
    const w2 = pivot(w, s < 0 ? 'w2L' : 'w2R', s * 0.82, 0, 0.04);
    m(B(0.62, 0.05, 0.06), ROLE.bone, w2, s * 0.31, 0, 0);
    m(B(0.6, 0.02, 0.48), ROLE.skin, w2, s * 0.3, -0.01, -0.22);
    m(B(0.02, 0.02, 0.5), ROLE.bone, w2, s * 0.32, 0, -0.25);
    m(K(0.035, 0.2, 4), ROLE.bone, w2, s * 0.66, 0, 0, 0, 0, -s * HP);
    for (const z of [-0.18, -0.36]) m(K(0.022, 0.13, 3), DARK, w2, s * 0.5, -0.01, z - 0.04, -HP);
    m(C(0.04, 0.035, 0.22, 5), ROLE.skin, hips, s * 0.14, -0.28, 0.08);
    for (const t of [-0.03, 0.03]) m(K(0.02, 0.1, 3), ROLE.bone, hips, s * 0.14 + t, -0.42, 0.13, Math.PI - 0.4);
  });
  const tail = pivot(hips, 'tail', 0, 0, -0.32);
  m(C(0.08, 0.12, 0.4, 5), ROLE.skin, tail, 0, 0, -0.2, HP);
  for (let i = 0; i < 2; i++) m(K(0.03, 0.1, 3), ROLE.bone, tail, 0, 0.09, -0.1 - i * 0.16, -0.3);
  const tail2 = pivot(tail, 'tail2', 0, 0, -0.4);
  m(C(0.04, 0.08, 0.4, 5), ROLE.skin, tail2, 0, 0, -0.2, HP);
  m(O(0.09), G, tail2, 0, 0, -0.45);
  mirror((s) => m(K(0.025, 0.14, 3), ROLE.bone, tail2, s * 0.06, 0, -0.42, 0, 0, -s * 1.2));
  return root;
}

const BUILDERS = { grunt: buildHusk, shooter: buildCaster, heavy: buildBrute, flyer: buildGargoyle };
const RIG_KEYS = ['hips', 'torso', 'head', 'jaw', 'halo', 'orb', 'orbRing0', 'orbRing1', 'shL', 'shR', 'elL', 'elR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'wL', 'wR', 'w2L', 'w2R', 'tail', 'tail2'];
const templates = new Map();
function template(type) {
  if (!templates.has(type)) {
    const root = BUILDERS[type](glowMat(PALETTE[type].glow));
    bake(root);
    if (type === 'flyer') root.scale.setScalar(1.35);
    templates.set(type, root);
  }
  return templates.get(type);
}

// Every enemy faces local +Z. Returns { root, rig, mats, extraMats, hit, orb, glow }.
export function buildEnemyModel(type, color) {
  const pal = PALETTE[type];
  const flat = { flatShading: true };
  const mats = {
    skin: new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, emissive: color, emissiveIntensity: 0.16, ...flat }),
    armor: new THREE.MeshStandardMaterial({ color: pal.armor, roughness: 0.36, metalness: 0.75, ...flat }),
    bone: new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.6, metalness: 0.05, emissive: 0x2a2418, emissiveIntensity: 0.3, ...flat }),
    cloth: new THREE.MeshStandardMaterial({ color: pal.cloth, roughness: 0.95, ...flat, side: THREE.DoubleSide }),
  };
  for (const mt of Object.values(mats)) { mt.userData.baseEmissive = mt.emissive.getHex(); mt.userData.baseIntensity = mt.emissiveIntensity; }
  const root = template(type).clone(true);
  root.traverse((o) => { if (o.isMesh && o.material.userData.role) o.material = mats[o.material.userData.role]; });
  const rig = {};
  for (const k of RIG_KEYS) { const o = root.getObjectByName(k); if (o) rig[k] = o; }
  if (rig.orbRing0) rig.orbRings = [rig.orbRing0, rig.orbRing1];
  const md = { root, rig, mats: Object.values(mats), extraMats: [], hit: [], orb: rig.orb || null, glow: glowMat(pal.glow), armorMat: mats.armor, boneMat: mats.bone };
  finishHit(md);
  return md;
}
function finishHit(md) {
  md.hit.length = 0;
  md.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; delete o.userData.part; } });
  md.rig.head.traverse((o) => { if (o.isMesh && !o.userData.noHit) o.userData.part = 'head'; });
  md.root.traverse((o) => {
    if (!o.isMesh || o.userData.noHit) return;
    if (!o.userData.part) o.userData.part = 'body';
    md.hit.push(o);
  });
}

// pose an enemy each frame. w = windup 0..1
export function animateEnemy(e, dt, moving, w, time) {
  const r = e.rig;
  const k = 1 - Math.exp(-dt * 14);
  const lerp = (o, prop, v) => { o.rotation[prop] += (v - o.rotation[prop]) * k; };
  const ph = e.walk;
  const sw = moving ? Math.sin(ph) : 0;
  const breathe = Math.sin(time * 2 + e.walk) * 0.03;
  const type = e.animType || e.type;

  if (type === 'flyer') {
    const diving = e.state === 'dive';
    const flap = diving ? 0 : Math.sin(time * (e.state === 'windup' ? 22 : 13) + e.walk) * 0.75;
    const fold = diving ? -0.9 : 0;
    r.wL.rotation.z = flap + fold - 0.45; r.wR.rotation.z = -flap - fold + 0.45;
    r.wL.rotation.x = r.wR.rotation.x = diving ? 0 : 0.35;
    r.w2L.rotation.z = flap * 0.6 + (diving ? -0.6 : 0); r.w2R.rotation.z = -flap * 0.6 - (diving ? -0.6 : 0);
    r.hips.rotation.x = diving ? 0.6 : e.state === 'windup' ? -0.4 * w : 0.1;
    r.tail.rotation.x = Math.sin(time * 4 + e.walk) * 0.3;
    r.tail2.rotation.x = Math.sin(time * 4 + e.walk - 0.8) * 0.4;
    r.head.rotation.x = e.state === 'windup' ? -0.3 * w : 0;
    if (e.flinch) { r.hips.rotation.z = Math.sin(time * 60) * e.flinch * 0.3; e.flinch *= Math.exp(-dt * 7); }
    return;
  }
  if (type === 'grunt') {
    lerp(r.hipL, 'x', -sw * 0.75); lerp(r.hipR, 'x', sw * 0.75);
    lerp(r.kneeL, 'x', moving ? Math.max(0, Math.sin(ph + 1.2)) * 1.1 : 0.1);
    lerp(r.kneeR, 'x', moving ? Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * 1.1 : 0.1);
    r.hips.position.y = 0.95 - (moving ? Math.abs(Math.cos(ph)) * 0.06 : 0);
    let shx = sw * 0.6, elx = -0.4, tor = 0.28 + breathe, jaw = 0.05 + Math.max(0, Math.sin(time * 3 + ph)) * 0.08;
    if (e.state === 'windup') { shx = -2.7 * w; elx = -0.7 * w; tor = 0.28 - 0.35 * w; jaw = 0.55 * w; }
    else if (e.state === 'recover') { shx = -0.8; elx = -0.1; tor = 0.6; jaw = 0.2; }
    lerp(r.shL, 'x', shx); lerp(r.shR, 'x', e.state === 'chase' ? -shx : shx);
    lerp(r.elL, 'x', elx); lerp(r.elR, 'x', elx);
    lerp(r.torso, 'x', tor);
    if (r.jaw) lerp(r.jaw, 'x', jaw);
  } else if (type === 'shooter') {
    r.hips.position.y = 0.25 + Math.sin(time * 2.4 + e.walk) * 0.12;
    r.hips.rotation.x = moving ? 0.12 : 0;
    if (r.halo) r.halo.rotation.z += dt * 1.5;
    let shR = -0.2, elR = -0.3, shL = -0.25 + breathe * 2, elL = -0.4;
    if (e.state === 'windup') { shR = -0.3 - 1.3 * w; elR = -0.2; shL = -0.6 * w; elL = -1.2 * w; }
    lerp(r.shR, 'x', shR); lerp(r.elR, 'x', elR);
    lerp(r.shL, 'x', shL); lerp(r.elL, 'x', elL);
    lerp(r.torso, 'x', e.state === 'windup' ? -0.15 * w : breathe);
    if (r.orbRings) { r.orbRings[0].rotation.y += dt * 4; r.orbRings[1].rotation.x += dt * 5; }
  } else {
    lerp(r.hipL, 'x', -sw * 0.5); lerp(r.hipR, 'x', sw * 0.5);
    lerp(r.kneeL, 'x', moving ? Math.max(0, Math.sin(ph + 1.2)) * 0.7 : 0.05);
    lerp(r.kneeR, 'x', moving ? Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * 0.7 : 0.05);
    r.hips.position.y = 1.0 - (moving ? Math.abs(Math.cos(ph)) * 0.09 : 0);
    let shx = sw * 0.35, elx = -0.3, tor = 0.1 + breathe;
    if (e.state === 'windup') { shx = -2.9 * w; elx = -0.5 * w; tor = -0.25 * w; }
    else if (e.state === 'recover') { shx = -0.9; elx = 0; tor = 0.55; }
    lerp(r.shL, 'x', shx); lerp(r.shR, 'x', e.state === 'chase' ? -shx : shx);
    lerp(r.elL, 'x', elx); lerp(r.elR, 'x', elx);
    lerp(r.torso, 'x', tor);
    r.torso.rotation.z = moving ? Math.sin(ph) * 0.05 : 0;
  }
  // idle head look + hit flinch (shared by every walker)
  if (r.head && e.state !== 'windup') r.head.rotation.y = Math.sin(time * 0.8 + e.walk) * 0.18;
  if (e.flinch) {
    r.torso.rotation.x -= e.flinch * 0.5;
    if (r.head) r.head.rotation.x = -e.flinch * 0.5;
    e.flinch *= Math.exp(-dt * 7);
    if (e.flinch < 0.01) { e.flinch = 0; if (r.head) r.head.rotation.x = 0; }
  }
}

// ---------------------------------------------------------------- bosses
export function buildBossModel(kind) {
  if (kind === 'boss3') {
    const md = buildEnemyModel('heavy', 0x4a2216);
    const r = md.rig, A = md.armorMat, lava = glowMat(0xff6a10), hot = glowMat(0xffc040);
    for (let i = 0; i < 10; i++) m(B(0.06 + (i % 3) * 0.02, 0.4 + (i % 4) * 0.12, 0.04), i % 2 ? lava : hot, r.torso, -0.8 + i * 0.18, 0.6 + (i % 5) * 0.18, 0.62, 0, 0, ((i % 5) - 2) * 0.3);
    const kiln = pivot(r.torso, 'kiln', 0, 1.6, -0.8);
    m(B(1.4, 1.2, 0.9), md.mats[0], kiln, 0, 0, 0);
    m(T(0.4, 0.08, 4, 12, Math.PI), A, kiln, 0, -0.1, 0.46);
    m(B(0.7, 0.5, 0.06), lava, kiln, 0, -0.25, 0.46);
    for (const x of [-0.45, 0.45]) { m(C(0.16, 0.2, 1.2, 8), A, kiln, x, 1.0, 0); m(C(0.13, 0.13, 0.06, 8), hot, kiln, x, 1.62, 0); }
    mirror((s2) => { for (let i = 0; i < 3; i++) m(K(0.05, 0.3, 4), lava, s2 < 0 ? r.elL : r.elR, s2 * 0.2 - 0.1 + i * 0.1, -1.15, 0.2, Math.PI); });
    m(B(0.5, 0.12, 0.04), hot, r.head, 0, 0.2, 0.36);
    md.root.scale.setScalar(2.4);
    finishHit(md);
    return md;
  }
  if (kind === 'boss1') {
    const md = buildEnemyModel('heavy', 0x8c8478);
    const r = md.rig, A = md.armorMat, Gm = glowMat(0xffc040);
    for (let i = 0; i < 9; i++) {                                                // brick crown
      const a = (i / 9) * Math.PI * 2;
      m(B(0.16, 0.22, 0.1), A, r.head, Math.sin(a) * 0.34, 0.6, Math.cos(a) * 0.34, 0, a, 0);
      if (i % 3 === 0) m(O(0.05), Gm, r.head, Math.sin(a) * 0.36, 0.76, Math.cos(a) * 0.36);
    }
    const bell = pivot(r.torso, 'bell', 0, 1.6, -0.75);                         // bell cage on the back
    m(C(0.35, 0.6, 0.8, 8), A, bell, 0, 0, 0);
    m(S(0.22, 8, 6), Gm, bell, 0, -0.1, 0);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; m(B(0.04, 0.8, 0.04), md.mats[0], bell, Math.sin(a) * 0.6, 0, Math.cos(a) * 0.6); }
    const trowel = pivot(r.elR, 'trowel', 0, -1.0, 0.3);                        // giant trowel blade
    m(B(0.08, 1.2, 0.9), A, trowel, 0, -0.4, 0.2, 0.2);
    m(B(0.09, 1.1, 0.04), Gm, trowel, 0, -0.4, 0.66, 0.2);
    mirror((s) => { for (let i = 0; i < 6; i++) m(T(0.07, 0.02, 4, 8), A, r.torso, s * 0.75, 0.6 - i * 0.12, 0.66, 0, i % 2 ? HP : 0, 0); });
    md.root.scale.setScalar(2.1);
    finishHit(md);
    return md;
  }
  const md = buildEnemyModel('shooter', 0xd8c49a);
  const r = md.rig, A = md.armorMat, Gm = glowMat(0xfff0b0);
  m(K(0.2, 0.7, 4), A, r.head, 0, 0.8, -0.02);                                   // mitre
  m(B(0.03, 0.3, 0.02), Gm, r.head, 0, 0.8, 0.12);
  m(B(0.16, 0.03, 0.02), Gm, r.head, 0, 0.86, 0.12);
  r.extraHalos = [];
  for (let i = 0; i < 2; i++) {
    const h = m(T(0.55 + i * 0.22, 0.02, 4, 32), Gm, r.head, 0, 0.32, -0.3 - i * 0.05);
    h.userData.noHit = true;
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; m(B(0.08, 0.05, 0.04), A, h, Math.cos(a) * (0.55 + i * 0.22), Math.sin(a) * (0.55 + i * 0.22), 0, 0, 0, a); }
    r.extraHalos.push(h);
  }
  r.bricks = pivot(r.torso, 'bricks', 0, 0.2, 0);
  for (let i = 0; i < 4; i++) {                                                  // floating stone hands
    const a = (i / 4) * Math.PI * 2;
    const hand = pivot(r.bricks, '', Math.cos(a) * 1.15, Math.sin(i * 1.7) * 0.25, Math.sin(a) * 1.15);
    hand.rotation.y = -a;
    const palm = m(B(0.22, 0.28, 0.08), A, hand, 0, 0, 0); palm.userData.noHit = true;
    for (let f = 0; f < 4; f++) { const fi = m(B(0.04, 0.16, 0.04), A, hand, -0.075 + f * 0.05, 0.2, 0); fi.userData.noHit = true; }
    const gl = m(O(0.05), Gm, hand, 0, 0, 0.06); gl.userData.noHit = true;
  }
  md.root.scale.setScalar(3);
  finishHit(md);
  return md;
}

// ---------------------------------------------------------------- trainer mini-bosses
export function buildTrainerModel(kind) {
  let md;
  if (kind === 'bulwark') {
    md = buildEnemyModel('grunt', 0x6a7088);
    const r = md.rig, A = md.armorMat, Gm = glowMat(0x9ae8ff);
    const shield = pivot(r.elL, 'shield', -0.05, -0.25, 0.25);
    m(B(0.14, 1.5, 1.05), A, shield, 0, 0, 0, 0, 0.2, 0);
    m(B(0.16, 1.2, 0.08), Gm, shield, 0.02, 0, 0, 0, 0.2, 0);
    m(B(0.16, 0.08, 0.8), Gm, shield, 0.02, 0.15, 0, 0, 0.2, 0);
    m(S(0.16, 8, 6), md.boneMat, shield, 0.09, 0.15, 0.02);
    for (const y of [-0.6, 0.6]) m(K(0.06, 0.24, 4), A, shield, 0.1, y, 0, 0, 0, -HP);
    m(B(0.1, 0.32, 0.5), A, r.head, 0, 0.52, -0.02);
    m(B(0.48, 0.14, 0.5), A, r.head, 0, 0.38, 0.04);
    md.root.scale.setScalar(1.6);
  } else if (kind === 'sweeper') {
    md = buildEnemyModel('heavy', 0x8a6a40);
    const r = md.rig, A = md.armorMat, Gm = glowMat(0xff3a6a);
    const ham = pivot(r.elR, 'hammer', 0, -0.85, 0.2);
    m(C(0.07, 0.07, 2.3, 6), A, ham, 0, 0, 0.6, HP);
    m(B(1.2, 0.62, 0.62), A, ham, 0, 0, 1.8);
    m(B(1.24, 0.08, 0.66), Gm, ham, 0, 0, 1.8);
    for (const x of [-0.6, 0.6]) m(K(0.12, 0.3, 4), A, ham, x, 0, 1.8, 0, 0, Math.sign(x) * -HP);
    md.root.scale.setScalar(1.3);
  } else if (kind === 'roost') {
    md = buildEnemyModel('flyer', 0x6a5a7a);
    const r = md.rig, Gm = glowMat(0xc08aff);
    for (let i = 0; i < 5; i++) m(K(0.03, 0.2, 3), Gm, r.head, (i - 2) * 0.07, 0.26, -0.05, -0.4, 0, (i - 2) * 0.2);
    m(O(0.14), Gm, r.tail2, 0, 0, -0.55);
    md.root.scale.setScalar(2.4);
  } else if (kind === 'mirror') {
    md = buildEnemyModel('grunt', 0xb8d8f0);
    const r = md.rig, Gm = glowMat(0xdff6ff);
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, metalness: 1, roughness: 0.05, flatShading: true });
    md.extraMats.push(mirrorMat);
    const sh = pivot(r.elL, 'shield', -0.05, -0.25, 0.25);
    m(B(0.12, 1.4, 1.0), mirrorMat, sh, 0, 0, 0, 0, 0.2, 0);
    m(B(0.14, 1.44, 0.06), Gm, sh, 0.01, 0, 0.5, 0, 0.2, 0);
    m(B(0.14, 1.44, 0.06), Gm, sh, 0.01, 0, -0.5, 0, 0.2, 0);
    mirror((s2) => m(B(0.26, 0.36, 0.4), mirrorMat, r.torso, s2 * 0.5, 0.78, 0, 0, 0, -s2 * 0.3));
    m(B(0.44, 0.16, 0.5), mirrorMat, r.head, 0, 0.38, 0.04);
    m(B(0.06, 0.4, 0.06), Gm, r.head, 0, 0.6, 0);
    md.root.scale.setScalar(1.6);
  } else if (kind === 'marksman') {
    md = buildVariantModel('sniper');
    const r = md.rig;
    m(B(0.7, 1.1, 0.04), md.mats[3], r.torso, 0, 0.0, -0.22, 0.15);
    m(K(0.22, 0.4, 4), md.mats[3], r.head, 0, 0.62, -0.02);
    m(B(0.5, 0.05, 0.04), glowMat(0xff3030), r.head, 0, 0.2, 0.26);
    md.root.scale.setScalar(1.4);
  } else if (kind === 'fortress') {
    md = buildEnemyModel('heavy', 0x5a5a6a);
    const r = md.rig, Gm = glowMat(0x7ad8ff);
    r.layerMeshes = [];
    for (let i = 0; i < 3; i++) {
      const ring = m(T(1.5 + i * 0.25, 0.06, 4, 28), Gm, md.root, 0, 1.2 + i * 0.7, 0, HP);
      ring.userData.noHit = true;
      r.layerMeshes.push(ring);
    }
    mirror((s2) => m(B(0.3, 1.6, 1.2), md.armorMat, s2 < 0 ? r.elL : r.elR, s2 * 0.35, -0.6, 0.3));
    md.root.scale.setScalar(1.4);
  } else if (kind === 'queen') {
    md = buildEnemyModel('flyer', 0x7a3a5a);
    const r = md.rig, Gm = glowMat(0xff5ac8);
    for (let i = 0; i < 7; i++) m(K(0.03, 0.24, 3), Gm, r.head, (i - 3) * 0.06, 0.28, -0.05, -0.3, 0, (i - 3) * 0.18);
    m(S(0.18, 8, 6), Gm, r.hips, 0, -0.1, -0.2);
    md.root.scale.setScalar(2.6);
  } else {
    md = buildEnemyModel('heavy', 0x2e2622);
    const r = md.rig, A = md.armorMat, Gm = glowMat(0xff6a1a);
    m(B(1.0, 0.72, 0.14), Gm, r.torso, 0, 0.42, 0.66);
    for (let i = 0; i < 4; i++) m(B(1.04, 0.05, 0.16), A, r.torso, 0, 0.15 + i * 0.18, 0.7);
    mirror((s) => { m(C(0.16, 0.2, 1.4, 8), A, r.torso, s * 0.55, 2.0, -0.45); m(C(0.13, 0.13, 0.08, 8), Gm, r.torso, s * 0.55, 2.72, -0.45); });
    md.root.scale.setScalar(1.6);
  }
  finishHit(md);
  return md;
}

// ---------------------------------------------------------------- viewmodels
export function buildViewmodels(GLOW) {
  const f = { flatShading: true };
  const steel = new THREE.MeshStandardMaterial({ color: 0xa8a8b4, metalness: 0.78, roughness: 0.26, ...f });
  const dsteel = new THREE.MeshStandardMaterial({ color: 0x4a4a56, metalness: 0.72, roughness: 0.38, ...f });
  const black = new THREE.MeshStandardMaterial({ color: 0x16161a, metalness: 0.4, roughness: 0.6, ...f });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4424, roughness: 0.55, ...f });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a2814, roughness: 0.6, ...f });
  const leather = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.85, ...f });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd0a24a, metalness: 0.88, roughness: 0.28, ...f });
  const glove = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.85, ...f });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x3a1410, roughness: 0.75, metalness: 0.15, ...f });
  const armorRed = new THREE.MeshStandardMaterial({ color: 0x8a2a1a, metalness: 0.6, roughness: 0.32, ...f });
  const shell = new THREE.MeshStandardMaterial({ color: 0xa01a14, roughness: 0.5, ...f });
  const chargeMat = new THREE.MeshStandardMaterial({ color: 0x113344, emissive: 0x3ac8ff, emissiveIntensity: 0.6 });
  const coreGlow = new THREE.MeshStandardMaterial({ color: 0x442211, emissive: 0xff7a2a, emissiveIntensity: 1.4 });
  const shotAccent = new THREE.MeshStandardMaterial({ color: 0x442211, emissive: 0xff7a2a, emissiveIntensity: 1.4 });
  const keep = (o) => { o.userData.keep = true; return o; };

  const flashSprite = (z, s = 0.38) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    sp.position.set(0, 0.03, z); sp.scale.setScalar(s);
    return sp;
  };
  const gripHand = (parent, x, y, z, tilt) => {
    const h = pivot(parent, '', x, y, z);
    h.rotation.x = tilt;
    m(B(0.078, 0.09, 0.085), glove, h, 0.006, 0, 0.012);
    for (let i = 0; i < 4; i++) { m(B(0.082, 0.021, 0.03), glove, h, -0.004, 0.032 - i * 0.022, -0.036); m(B(0.084, 0.008, 0.012), armorRed, h, -0.004, 0.04 - i * 0.022, -0.045); }
    m(B(0.026, 0.026, 0.075), glove, h, 0.042, 0.036, -0.01, 0, 0.2, 0);
    m(B(0.07, 0.05, 0.05), armorRed, h, 0.03, 0.03, 0.05);
    m(C(0.05, 0.058, 0.08, 8), armorRed, h, 0.01, -0.02, 0.1, 1.15);
    m(C(0.052, 0.052, 0.02, 8), brass, h, 0.01, -0.0, 0.06, 1.15);
    m(C(0.048, 0.056, 0.3, 8), sleeve, h, 0.01, -0.07, 0.24, 1.15);
  };

  // ---- REVOLVER: brass-inlaid hand cannon
  const revolver = new THREE.Group();
  m(B(0.06, 0.09, 0.17), steel, revolver, 0, 0, 0);
  mirror((s) => { m(B(0.004, 0.05, 0.1), brass, revolver, s * 0.031, 0.0, 0.0); m(C(0.006, 0.006, 0.004, 6), brass, revolver, s * 0.033, -0.02, 0.05, 0, 0, HP); });
  m(B(0.05, 0.022, 0.24), steel, revolver, 0, 0.056, -0.05);
  m(C(0.022, 0.025, 0.32, 8), steel, revolver, 0, 0.03, -0.27, HP);
  m(B(0.05, 0.04, 0.24), dsteel, revolver, 0, 0.036, -0.25);
  for (let i = 0; i < 4; i++) m(B(0.03, 0.006, 0.02), black, revolver, 0, 0.057, -0.17 - i * 0.05);
  m(B(0.058, 0.048, 0.05), dsteel, revolver, 0, 0.032, -0.42);
  mirror((s) => m(B(0.004, 0.02, 0.03), black, revolver, s * 0.03, 0.032, -0.42));
  m(B(0.01, 0.024, 0.02), brass, revolver, 0, 0.07, -0.4);
  m(B(0.024, 0.014, 0.02), black, revolver, 0, 0.074, 0.03);
  const cyl = pivot(revolver, '', 0, 0.014, -0.065);
  m(C(0.05, 0.05, 0.11, 6), dsteel, cyl, 0, 0, 0, HP);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    m(B(0.013, 0.013, 0.1), black, cyl, Math.cos(a) * 0.048, Math.sin(a) * 0.048, 0, 0, 0, a);
    m(C(0.01, 0.01, 0.01, 6), brass, cyl, Math.cos(a) * 0.028, Math.sin(a) * 0.028, 0.055, HP);
  }
  const hammer = pivot(revolver, '', 0, 0.045, 0.075);
  m(B(0.016, 0.05, 0.026), dsteel, hammer, 0, 0.022, 0, -0.3);
  m(B(0.032, 0.012, 0.034), dsteel, hammer, 0, 0.05, 0.014, -0.3);
  m(T(0.032, 0.006, 4, 10, Math.PI), dsteel, revolver, 0, -0.047, -0.01, 0, HP, Math.PI);
  m(B(0.008, 0.032, 0.01), black, revolver, 0, -0.052, -0.005, 0.3);
  m(B(0.05, 0.075, 0.07), wood, revolver, 0, -0.07, 0.078, -0.25);
  m(B(0.052, 0.075, 0.075), wood, revolver, 0, -0.13, 0.098, -0.42);
  m(B(0.055, 0.03, 0.08), brass, revolver, 0, -0.178, 0.115, -0.45);
  mirror((s) => m(B(0.004, 0.08, 0.04), woodDark, revolver, s * 0.027, -0.1, 0.085, -0.35));
  const coils = [];
  for (const z of [-0.17, -0.24, -0.31]) coils.push(keep(m(T(0.031, 0.006, 6, 16), chargeMat, revolver, 0, 0.03, z)));
  m(B(0.01, 0.014, 0.12), chargeMat, revolver, 0, 0.068, -0.05);
  gripHand(revolver, 0, -0.09, 0.09, -0.35);
  const revFlash = flashSprite(-0.47); revolver.add(revFlash);
  revolver.userData.base = new THREE.Vector3(0.24, -0.24, -0.55);

  // ---- SHOTGUN: lever-pump street sweeper
  const shotgun = new THREE.Group();
  for (const x of [-0.029, 0.029]) {
    m(C(0.027, 0.027, 0.6, 10), steel, shotgun, x, 0.03, -0.37, HP);
    m(C(0.032, 0.032, 0.05, 10), dsteel, shotgun, x, 0.03, -0.66, HP);
    m(C(0.017, 0.017, 0.01, 10), black, shotgun, x, 0.03, -0.69, HP);
  }
  m(B(0.11, 0.03, 0.46), dsteel, shotgun, 0, 0.072, -0.36);
  for (let i = 0; i < 6; i++) m(B(0.05, 0.008, 0.03), black, shotgun, 0, 0.088, -0.18 - i * 0.07);
  for (const z of [-0.2, -0.5]) m(B(0.12, 0.08, 0.025), dsteel, shotgun, 0, 0.03, z);
  m(B(0.012, 0.016, 0.012), brass, shotgun, 0, 0.096, -0.6);
  m(B(0.11, 0.11, 0.24), dsteel, shotgun, 0, 0.0, 0.02);
  mirror((s) => { m(B(0.004, 0.065, 0.14), brass, shotgun, s * 0.057, 0.005, 0.02); m(C(0.006, 0.006, 0.004, 6), brass, shotgun, s * 0.06, -0.02, -0.04, 0, 0, HP); });
  m(B(0.05, 0.02, 0.06), black, shotgun, 0.045, 0.04, 0.0);
  m(B(0.112, 0.028, 0.07), shotAccent, shotgun, 0, -0.014, -0.05);
  mirror((sd) => m(B(0.012, 0.006, 0.16), shotAccent, shotgun, sd * 0.05, 0.056, 0.02));
  m(T(0.04, 0.008, 4, 10), steel, shotgun, 0, -0.09, 0.09, 0, HP, 0);
  m(B(0.012, 0.06, 0.012), steel, shotgun, 0, -0.06, 0.06);
  const pump = pivot(shotgun, '', 0, -0.035, -0.3);
  m(B(0.095, 0.075, 0.22), wood, pump);
  for (let i = 0; i < 4; i++) m(B(0.097, 0.01, 0.012), woodDark, pump, 0, -0.038, -0.08 + i * 0.05);
  m(C(0.012, 0.012, 0.3, 6), dsteel, shotgun, 0, -0.02, -0.18, HP);
  m(B(0.07, 0.12, 0.3), wood, shotgun, 0, -0.05, 0.27, 0.14);
  for (let i = 0; i < 3; i++) m(B(0.074, 0.124, 0.02), leather, shotgun, 0, -0.045, 0.18 + i * 0.05, 0.14);
  m(B(0.078, 0.13, 0.03), black, shotgun, 0, -0.072, 0.43, 0.14);
  for (let i = 0; i < 4; i++) { m(C(0.011, 0.011, 0.05, 8), shell, shotgun, 0.04, -0.03, 0.22 + i * 0.03, 0, 0, 0); m(C(0.012, 0.012, 0.012, 8), brass, shotgun, 0.04, -0.06, 0.22 + i * 0.03); }
  gripHand(shotgun, 0, -0.07, 0.13, 0.1);
  const shotFlash = flashSprite(-0.74, 0.5); shotgun.add(shotFlash);
  shotgun.userData.base = new THREE.Vector3(0.27, -0.29, -0.56);
  shotgun.visible = false;

  // ---- GAUNTLET: piston-driven armored fist
  const arm = new THREE.Group();
  m(C(0.075, 0.082, 0.3, 8), sleeve, arm, 0, 0, 0.38, HP);
  for (let i = 0; i < 4; i++) {
    const sc = 1 - i * 0.06;
    m(B(0.14 * sc, 0.13 * sc, 0.09), armorRed, arm, 0, 0.005, 0.25 - i * 0.075);
    m(B(0.142 * sc, 0.012, 0.012), brass, arm, 0, 0.068 * sc, 0.21 - i * 0.075);
  }
  mirror((s) => { m(C(0.012, 0.012, 0.26, 6), steel, arm, s * 0.08, -0.02, 0.12, HP); m(C(0.02, 0.02, 0.06, 6), dsteel, arm, s * 0.08, -0.02, 0.24, HP); });
  m(C(0.08, 0.08, 0.04, 8), brass, arm, 0, 0, -0.06, HP);
  const fist = pivot(arm, '', 0, 0, -0.14);
  m(B(0.135, 0.12, 0.1), glove, fist);
  m(C(0.035, 0.035, 0.02, 6), coreGlow, fist, 0, 0.065, 0.0);
  for (let i = 0; i < 4; i++) {
    const x = -0.048 + i * 0.032;
    m(B(0.03, 0.056, 0.05), glove, fist, x, 0.015, -0.066);
    m(B(0.03, 0.032, 0.03), glove, fist, x, -0.026, -0.05);
    m(B(0.032, 0.03, 0.04), armorRed, fist, x, 0.05, -0.07);
    m(K(0.012, 0.04, 4), steel, fist, x, 0.08, -0.08, -0.3);
  }
  m(B(0.13, 0.01, 0.01), coreGlow, fist, 0, 0.046, -0.097);
  m(B(0.036, 0.036, 0.08), glove, fist, 0.074, -0.02, -0.03, 0, 0, 0.3);
  arm.userData.rest = new THREE.Vector3(-0.32, -0.8, -0.3);
  arm.userData.hit = new THREE.Vector3(-0.1, -0.17, -0.6);
  arm.position.copy(arm.userData.rest);

  // ---- variant attachments
  const lanceG = pivot(revolver, 'lance');
  for (const c of coils) { revolver.remove(c); lanceG.add(c); }
  m(B(0.03, 0.02, 0.05), chargeMat, lanceG, 0, 0.074, -0.33);
  const chainG = pivot(revolver, 'chain');
  for (let i = 0; i < 5; i++) m(T(0.029, 0.007, 4, 8), dsteel, chainG, 0, 0.03, -0.15 - i * 0.05, 0, i % 2 ? HP : 0, 0);
  m(O(0.024), chargeMat, chainG, 0, 0.095, -0.1);
  m(B(0.032, 0.02, 0.04), steel, chainG, 0, 0.072, -0.1);
  const coinG = pivot(revolver, 'coin');
  m(B(0.03, 0.065, 0.055), dsteel, coinG, 0.046, -0.01, 0.0);
  for (let i = 0; i < 5; i++) m(C(0.022, 0.022, 0.006, 10), brass, coinG, 0.066, -0.032 + i * 0.008, 0.0, 0, 0, HP);
  m(C(0.013, 0.015, 0.09, 8), black, coinG, 0, 0.086, -0.02, HP);
  m(C(0.014, 0.014, 0.004, 8), chargeMat, coinG, 0, 0.086, -0.066, HP);
  const revVariants = [lanceG, chainG, coinG];

  const furnaceG = pivot(shotgun, 'furnace');
  m(C(0.015, 0.015, 0.12, 6), shotAccent, furnaceG, 0, -0.062, 0.0, HP);
  const overG = pivot(shotgun, 'over');
  m(C(0.034, 0.034, 0.016, 12), dsteel, overG, 0.062, 0.02, 0.02, 0, 0, HP);
  m(C(0.027, 0.027, 0.004, 12), new THREE.MeshBasicMaterial({ color: 0xe8e0c8 }), overG, 0.071, 0.02, 0.02, 0, 0, HP);
  const needle = keep(m(B(0.002, 0.022, 0.003), black, overG, 0.074, 0.02, 0.02));
  for (const y of [-0.01, 0.0]) m(C(0.006, 0.006, 0.3, 6), brass, overG, 0.057, y, -0.15, HP);
  const pressureLights = [];
  for (let i = 0; i < 3; i++) pressureLights.push(keep(m(B(0.016, 0.01, 0.02), new THREE.MeshBasicMaterial({ color: 0x331a10 }), overG, 0, 0.062, 0.07 + i * 0.026)));
  const sawG = pivot(shotgun, 'sawg');
  m(B(0.03, 0.03, 0.12), dsteel, sawG, 0, -0.045, -0.46);
  const saw = pivot(sawG, 'saw', 0, -0.075, -0.52);
  m(C(0.075, 0.075, 0.008, 16), steel, saw, 0, 0, 0, 0, 0, HP);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; m(K(0.012, 0.03, 3), steel, saw, 0, Math.cos(a) * 0.085, Math.sin(a) * 0.085, a, 0, 0); }
  m(C(0.02, 0.02, 0.012, 8), shotAccent, saw, 0, 0, 0, 0, 0, HP);
  const shotVariants = [furnaceG, overG, sawG];

  // ---- NAILGUN: triple-barrel rotary with a drum and heat vents
  const nailAccent = new THREE.MeshStandardMaterial({ color: 0x221a10, emissive: 0xffb02a, emissiveIntensity: 1.2 });
  const nailgun = new THREE.Group();
  m(B(0.1, 0.11, 0.26), dsteel, nailgun, 0, 0.0, 0.0);
  m(B(0.08, 0.03, 0.3), steel, nailgun, 0, 0.068, -0.04);
  for (let i = 0; i < 3; i++) m(B(0.104, 0.012, 0.03), nailAccent, nailgun, 0, 0.02 - i * 0.025, 0.06);
  m(C(0.06, 0.06, 0.06, 10), dsteel, nailgun, 0, 0.01, -0.15, HP);
  const nailSpin = pivot(nailgun, 'spin', 0, 0.01, -0.3);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    m(C(0.016, 0.016, 0.3, 8), steel, nailSpin, Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0, HP);
    m(C(0.02, 0.02, 0.02, 8), black, nailSpin, Math.cos(a) * 0.03, Math.sin(a) * 0.03, -0.15, HP);
  }
  m(C(0.05, 0.05, 0.02, 10), dsteel, nailSpin, 0, 0, -0.1, HP);
  m(C(0.07, 0.07, 0.07, 12), brass, nailgun, 0, -0.08, -0.05, 0, 0, HP);             // drum
  m(C(0.072, 0.072, 0.02, 12), dsteel, nailgun, 0, -0.08, -0.05, 0, 0, HP);
  m(B(0.05, 0.13, 0.07), wood, nailgun, 0, -0.1, 0.1, -0.3);
  m(B(0.06, 0.08, 0.18), dsteel, nailgun, 0, 0.0, 0.2, 0.1);
  gripHand(nailgun, 0, -0.1, 0.11, -0.3);
  const nailFlash = flashSprite(-0.48, 0.3); nailgun.add(nailFlash);
  const lodeG = pivot(nailgun, 'lode');
  const red = new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.4, metalness: 0.4 });
  m(T(0.035, 0.012, 6, 12, Math.PI), red, lodeG, 0, 0.1, -0.02, 0, HP, 0);
  mirror((sd) => m(B(0.024, 0.02, 0.024), steel, lodeG, 0, 0.088, -0.02 + sd * 0.035));
  const scorchG = pivot(nailgun, 'scorch');
  for (let i = 0; i < 5; i++) m(B(0.13, 0.04, 0.006), dsteel, scorchG, 0, 0.0, -0.12 - i * 0.018);
  m(T(0.06, 0.008, 4, 12), nailAccent, scorchG, 0, 0.01, -0.2);
  const skipG = pivot(nailgun, 'skip');
  mirror((sd) => m(B(0.008, 0.08, 0.18), steel, skipG, sd * 0.065, 0.02, -0.1, 0, sd * 0.15, 0));
  const nailVariants = [lodeG, scorchG, skipG];
  nailgun.userData.base = new THREE.Vector3(0.25, -0.26, -0.52);
  nailgun.visible = false;

  // ---- ARM VARIANTS (same rest / hit poses as the gauntlet)
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ae8ff, emissive: 0x2a8ac0, emissiveIntensity: 0.8, transparent: true, opacity: 0.8, metalness: 0.2, roughness: 0.1 });
  const shockGlow = new THREE.MeshStandardMaterial({ color: 0x442211, emissive: 0xff8a2a, emissiveIntensity: 1.5 });
  const mkArmBase = () => {
    const g = new THREE.Group();
    m(C(0.075, 0.082, 0.3, 8), sleeve, g, 0, 0, 0.38, HP);
    for (let i = 0; i < 3; i++) m(B(0.14, 0.13, 0.09), armorRed, g, 0, 0.005, 0.25 - i * 0.08);
    m(C(0.08, 0.08, 0.04, 8), brass, g, 0, 0, -0.03, HP);
    g.userData.rest = arm.userData.rest.clone(); g.userData.hit = arm.userData.hit.clone();
    g.position.copy(g.userData.rest);
    g.visible = false;
    return g;
  };
  const armBlade = mkArmBase();
  m(B(0.12, 0.1, 0.1), glove, armBlade, 0, 0, -0.1);
  m(B(0.03, 0.03, 0.12), brass, armBlade, 0, 0.06, -0.12);
  m(B(0.018, 0.07, 0.6), glass, armBlade, 0, 0.06, -0.45);
  m(K(0.035, 0.12, 4), glass, armBlade, 0, 0.06, -0.8, -HP, 0, Math.PI / 4);
  const armShock = mkArmBase();
  m(B(0.22, 0.2, 0.2), dsteel, armShock, 0, 0, -0.12);
  m(B(0.24, 0.06, 0.06), shockGlow, armShock, 0, 0.08, -0.2);
  for (let i = 0; i < 4; i++) m(B(0.05, 0.05, 0.06), armorRed, armShock, -0.075 + i * 0.05, 0.02, -0.24);
  m(C(0.05, 0.05, 0.03, 6), shockGlow, armShock, 0, 0.11, -0.08);
  mirror((sd) => m(C(0.02, 0.02, 0.2, 6), steel, armShock, sd * 0.11, -0.04, 0.05, HP));
  const armGrapple = mkArmBase();
  m(B(0.12, 0.1, 0.1), glove, armGrapple, 0, 0, -0.08);
  m(C(0.03, 0.035, 0.22, 8), dsteel, armGrapple, 0, 0.07, -0.08, HP);
  const hook = pivot(armGrapple, 'hook', 0, 0.07, -0.22);
  m(C(0.012, 0.012, 0.06, 6), steel, hook, 0, 0, 0, HP);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; m(K(0.012, 0.06, 3), steel, hook, Math.cos(a) * 0.02, Math.sin(a) * 0.02, -0.03, HP + 0.6, 0, a); }
  m(C(0.04, 0.04, 0.05, 10), leather, armGrapple, 0.06, 0.02, 0.05, 0, 0, HP);
  const arms = { fist: arm, blade: armBlade, shock: armShock, grapple: armGrapple };

  for (const g of [revolver, shotgun, arm, nailgun, armBlade, armShock, armGrapple]) bake(g);
  return { revolver, shotgun, arm, revFlash, shotFlash, chargeMat, shotAccent, coils, cyl, hammer, pump, revVariants, shotVariants, pressureLights, needle, saw, nailgun, nailSpin, nailAccent, nailFlash, nailVariants, arms, shockGlow, skinMats: { steel, dsteel, brass } };
}

// ---------------------------------------------------------------- props
const PROP = {
  stone: new THREE.MeshStandardMaterial({ color: 0x6a625a, roughness: 0.9, flatShading: true }),
  brick: new THREE.MeshStandardMaterial({ color: 0x7a3424, roughness: 0.85, flatShading: true }),
  iron: new THREE.MeshStandardMaterial({ color: 0x2c2c32, metalness: 0.8, roughness: 0.35, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.8, flatShading: true }),
  leather: new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.85, flatShading: true }),
  water: new THREE.MeshStandardMaterial({ color: 0x1a3a40, roughness: 0.1, metalness: 0.3, emissive: 0x0a2228, emissiveIntensity: 0.5 }),
  coal: glowMat(0xff6a1a), coal2: glowMat(0xffb03a), rune: glowMat(0x7ad8ff),
};
export function buildForge(GLOW) {
  const g = new THREE.Group();
  const P = PROP;
  // brick forge with an arched glowing mouth
  m(B(2.0, 1.4, 1.4), P.brick, g, -0.4, 0.7, 0);
  m(B(1.0, 0.6, 0.1), P.coal, g, -0.4, 0.75, 0.66);
  m(T(0.5, 0.08, 4, 12, Math.PI), P.stone, g, -0.4, 1.05, 0.7);
  for (let i = 0; i < 7; i++) m(O(0.12), i % 2 ? P.coal2 : P.coal, g, -0.85 + i * 0.15, 1.44, (i % 3 - 1) * 0.3);
  m(B(2.2, 0.16, 1.6), P.stone, g, -0.4, 1.42, 0);
  m(K(1.0, 0.9, 4), P.iron, g, -0.4, 2.05, 0, 0, Math.PI / 4, 0);
  m(C(0.22, 0.28, 1.4, 8), P.iron, g, -0.4, 3.1, 0);
  m(T(0.3, 0.04, 4, 10), P.iron, g, -0.4, 2.6, 0, HP);
  // bellows
  m(B(0.5, 0.18, 0.7), P.leather, g, -1.65, 0.9, 0.2, 0, 0, 0.3);
  m(B(0.06, 0.06, 0.5), P.wood, g, -1.85, 1.0, 0.55, 0, 0, 0.3);
  // anvil on a stump
  m(C(0.35, 0.42, 0.7, 8), P.wood, g, 1.1, 0.35, 0);
  const an = pivot(g, '', 1.1, 0.7, 0);
  m(B(0.32, 0.25, 0.28), P.iron, an, 0, 0.12, 0);
  m(B(0.85, 0.22, 0.38), P.iron, an, 0, 0.36, 0);
  m(K(0.11, 0.4, 4), P.iron, an, -0.6, 0.36, 0, 0, 0, HP);
  m(B(0.06, 0.06, 0.35), P.wood, an, 0.2, 0.5, 0.05, 0, 0.4, 0);               // hammer
  m(B(0.14, 0.1, 0.1), P.iron, an, 0.27, 0.5, 0.2, 0, 0.4, 0);
  // quench barrel
  m(C(0.32, 0.3, 0.7, 10), P.wood, g, 1.1, 0.35, -0.95);
  for (const y of [0.12, 0.58]) m(T(0.32, 0.02, 4, 12), P.iron, g, 1.1, y, -0.95, HP);
  m(C(0.29, 0.29, 0.02, 10), P.water, g, 1.1, 0.68, -0.95);
  // tool rack + sign
  m(B(2.6, 0.1, 0.1), P.wood, g, 0.2, 2.1, -0.7);
  for (const x of [-0.6, -0.2, 0.2, 0.6]) { m(B(0.04, 0.5, 0.04), P.iron, g, x, 1.82, -0.68); m(B(0.12, 0.1, 0.06), P.iron, g, x, 1.55, -0.68); }
  m(B(1.7, 0.6, 0.08), P.wood, g, 0.4, 3.05, 0.66);
  for (const x of [-0.4, 1.2]) m(C(0.01, 0.01, 0.4, 4), P.iron, g, x, 3.5, 0.66);
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const cg = c.getContext('2d');
  cg.fillStyle = '#2a160a'; cg.fillRect(0, 0, 256, 96);
  cg.strokeStyle = '#7a4a20'; cg.lineWidth = 6; cg.strokeRect(6, 6, 244, 84);
  cg.fillStyle = '#ffb35c'; cg.font = 'bold 54px Bungee, Impact, sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
  cg.fillText('FORGE', 128, 50);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  m(new THREE.PlaneGeometry(1.6, 0.55), new THREE.MeshBasicMaterial({ map: tex }), g, 0.4, 3.05, 0.705).userData.keep = true;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff7a2a, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(3.2); glow.position.set(-0.4, 1.1, 0.8);
  g.add(glow);
  bake(g);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// exit portal: a ring of runed stones around a swirling disc
export function buildPortal(GLOW) {
  const g = new THREE.Group();
  const ringG = pivot(g, 'ring');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    m(B(0.5, 0.36, 0.4), PROP.stone, ringG, Math.cos(a) * 1.75, Math.sin(a) * 1.75, 0, 0, 0, a);
    m(B(0.08, 0.2, 0.42), PROP.rune, ringG, Math.cos(a + 0.26) * 1.75, Math.sin(a + 0.26) * 1.75, 0, 0, 0, a + 0.26);
  }
  bake(ringG);
  const ring = new THREE.Mesh(T(1.45, 0.06, 4, 6), glowMat(0x9ae8ff));
  const ring2 = new THREE.Mesh(T(1.15, 0.04, 4, 5), glowMat(0xffffff));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.55, 40), new THREE.MeshBasicMaterial({ color: 0x3ac8ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x6ad8ff, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(6);
  g.add(ring, ring2, disc, glow);
  return { g, ring, ring2, disc, stones: ringG };
}

// ---------------------------------------------------------------- new enemy variants (batch 2)
export function buildVariantModel(kind) {
  let md;
  if (kind === 'shield') {
    md = buildEnemyModel('grunt', 0x8a5a3a);
    const r = md.rig, A = md.armorMat, Gm = glowMat(0xffd04a);
    const sh = pivot(r.elL, 'shield', -0.02, -0.3, 0.32);
    m(B(0.12, 1.4, 0.95), A, sh, 0, 0, 0, 0, 0.15, 0);
    m(B(0.14, 0.9, 0.12), md.boneMat, sh, 0.02, 0, 0, 0, 0.15, 0);
    m(B(0.14, 0.12, 0.6), md.boneMat, sh, 0.02, 0.18, 0, 0, 0.15, 0);
    m(S(0.08, 6, 5), Gm, sh, 0.08, 0.18, 0.02);
    for (const y of [-0.55, 0.55]) for (const z of [-0.35, 0.35]) m(K(0.04, 0.14, 4), A, sh, 0.08, y, z, 0, 0, -HP);
    m(B(0.4, 0.14, 0.5), A, r.head, 0, 0.38, 0.06);
    md.rig.shield = sh;
  } else if (kind === 'sniper') {
    md = buildEnemyModel('shooter', 0x3a4a3a);
    const r = md.rig, A = md.armorMat, Gm = glowMat(0xff3030);
    const rifle = pivot(r.elR, 'rifle', 0, -0.4, 0.1);
    m(C(0.03, 0.035, 1.3, 6), A, rifle, 0, 0, 0.45, HP);
    m(B(0.08, 0.12, 0.4), A, rifle, 0, -0.02, -0.05);
    m(C(0.04, 0.04, 0.25, 8), DARK, rifle, 0, 0.08, 0.15, HP);
    m(C(0.03, 0.03, 0.01, 8), Gm, rifle, 0, 0.08, 0.28, HP);
    md.rig.muzzle = pivot(rifle, 'muzzle', 0, 0, 1.1);
    m(B(0.3, 0.06, 0.04), Gm, r.head, 0, 0.2, 0.24);
    if (md.orb) md.orb.visible = false;
  } else if (kind === 'bomber') {
    md = buildEnemyModel('grunt', 0x8a6a2a);
    const r = md.rig, A = md.armorMat, Gm = glowMat(0xff3a1a);
    const bomb = pivot(r.torso, 'bomb', 0, 0.6, -0.42);
    m(C(0.28, 0.28, 0.55, 10), A, bomb, 0, 0, 0);
    for (const y of [-0.18, 0.18]) m(T(0.285, 0.025, 4, 12), DARK, bomb, 0, y, 0, HP);
    m(B(0.2, 0.2, 0.04), Gm, bomb, 0, 0, 0.27);
    m(C(0.015, 0.015, 0.25, 4), DARK, bomb, 0, 0.38, 0);
    const fuse = m(S(0.06, 6, 5), Gm, bomb, 0, 0.52, 0); fuse.userData.keep = true;
    md.rig.bomb = bomb; md.rig.fuse = fuse;
    md.root.scale.setScalar(0.8);
  } else {
    md = buildEnemyModel('shooter', 0xe8e0d0);
    const r = md.rig, A = md.armorMat, Gm = glowMat(0x6ad8ff);
    const censer = pivot(r.elL, 'censer', 0, -0.45, 0.05);
    m(C(0.006, 0.006, 0.4, 4), DARK, censer, 0, -0.2, 0);
    m(S(0.11, 8, 6), A, censer, 0, -0.45, 0);
    m(S(0.07, 6, 5), Gm, censer, 0, -0.45, 0);
    m(K(0.16, 0.4, 4), A, r.head, 0, 0.72, 0);
    m(B(0.03, 0.18, 0.02), Gm, r.head, 0, 0.7, 0.12);
    if (md.orb) md.orb.visible = false;
  }
  finishHit(md);
  return md;
}

// ---------------------------------------------------------------- duelists (batch 2)
export function buildDuelistModel(kind) {
  let md;
  if (kind === 'shard') {
    md = buildEnemyModel('grunt', 0x9ad8ff);
    const r = md.rig, Gm = glowMat(0xbff0ff);
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfefff, emissive: 0x3a9ad0, emissiveIntensity: 0.9, transparent: true, opacity: 0.75, roughness: 0.05 });
    md.extraMats.push(glass);
    m(K(0.34, 0.8, 7), md.mats[3], r.head, 0, 0.18, -0.12, 0.25);                 // veil
    m(T(0.3, 0.02, 4, 20), Gm, r.head, 0, 0.42, -0.24);
    const sword = pivot(r.elR, 'sword', 0, -0.4, 0.05);
    m(B(0.05, 0.16, 0.05), md.armorMat, sword, 0, 0, 0);
    m(B(0.3, 0.04, 0.06), md.armorMat, sword, 0, -0.1, 0);
    m(B(0.03, 1.3, 0.14), glass, sword, 0, -0.78, 0);
    m(K(0.08, 0.2, 4), glass, sword, 0, -1.52, 0, Math.PI, Math.PI / 4, 0);
    mirror((s) => m(B(0.2, 0.32, 0.36), glass, r.torso, s * 0.52, 0.78, 0, 0, 0, -s * 0.3));
    m(B(0.5, 0.5, 0.05), glass, r.torso, 0, 0.55, 0.26);
    md.rig.sword = sword;
    md.root.scale.setScalar(1.35);
  } else if (kind === 'bertha') {
    md = buildEnemyModel('heavy', 0xc8784a);
    const r = md.rig, gold = glowMat(0xffd04a);
    m(T(0.68, 0.08, 4, 20), gold, r.hips, 0, 0.12, 0, HP);
    m(B(0.6, 0.4, 0.1), gold, r.hips, 0, 0.12, 0.6);
    m(S(0.12, 8, 6), glowMat(0xff3a3a), r.hips, 0, 0.12, 0.67);
    const mask = m(B(0.62, 0.36, 0.12), glowMat(0x2a4ac8), r.head, 0, 0.2, 0.32);
    mask.userData.part = 'head';
    mirror((s) => m(B(0.14, 0.06, 0.02), glowMat(0xffffff), r.head, s * 0.13, 0.24, 0.39));
    m(B(0.06, 0.3, 0.02), glowMat(0xffd04a), r.head, 0, 0.24, 0.39);
    md.root.scale.setScalar(1.2);
  } else if (kind === 'gilded') {
    md = buildEnemyModel('grunt', 0xffc040);
    const r = md.rig, gold = glowMat(0xffe08a);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; m(K(0.04, 0.22, 4), gold, r.head, Math.sin(a) * 0.2, 0.5, Math.cos(a) * 0.2 + 0.05); }
    const sword = pivot(r.elR, 'sword', 0, -0.4, 0.05);
    m(B(0.3, 0.05, 0.06), md.armorMat, sword, 0, -0.1, 0);
    m(B(0.04, 1.4, 0.16), gold, sword, 0, -0.82, 0);
    md.rig.sword = sword;
    m(B(0.7, 1.2, 0.04), glowMat(0x8a1a1a), r.torso, 0, 0.2, -0.26, 0.12);
    md.root.scale.setScalar(1.4);
  } else {
    md = buildEnemyModel('grunt', 0x5a5a62);
    const r = md.rig, A = md.armorMat, Gm = glowMat(0xff8a2a);
    m(C(0.2, 0.22, 0.04, 10), DARK, r.head, 0, 0.42, 0.02);
    m(C(0.14, 0.14, 0.34, 10), DARK, r.head, 0, 0.6, 0.02);
    m(B(0.3, 0.04, 0.3), Gm, r.head, 0, 0.47, 0.02);
    m(B(0.4, 0.1, 0.12), glowMat(0xc81e1e), r.torso, 0, 0.82, 0.2);
    m(B(0.1, 0.5, 0.06), glowMat(0xc81e1e), r.torso, 0.12, 0.55, 0.26, 0, 0, 0.2);
    const brush = pivot(r.torso, 'brush', 0, 0.6, -0.35);
    m(C(0.025, 0.025, 1.3, 5), md.mats[3], brush, 0, 0.2, 0, 0.3);
    m(S(0.18, 8, 6), DARK, brush, 0, 0.85, 0.2);
    const hook = pivot(r.elL, 'hook', 0, -0.45, 0);
    m(T(0.08, 0.02, 4, 10, Math.PI * 1.3), A, hook, 0, -0.06, 0, 0, HP, 0);
    md.root.scale.setScalar(0.85);
  }
  finishHit(md);
  return md;
}
