import * as THREE from 'three';

// =====================================================================
//  Detailed low-poly models: rigged enemies + first-person viewmodels
// =====================================================================

const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
const B = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const C = (rt, rb, h, s = 8) => cached(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const K = (r, h, s = 5) => cached(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const T = (r, t, rs = 6, ts = 16, arc = Math.PI * 2) => cached(`t${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const S = (r, w = 12, h = 8) => cached(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const O = (r) => cached(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));

function m(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  parent.add(o);
  return o;
}
function pivot(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
const HALF_PI = Math.PI / 2;

// ---------------------------------------------------------------- enemies
// Every enemy faces local +Z. Returns { root, rig, mats, hit, orb, headPivot }.
export function buildEnemyModel(type, color) {
  const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, emissive: color, emissiveIntensity: 0.18 });
  const armor = new THREE.MeshStandardMaterial({ color: type === 'heavy' ? 0x4a4038 : type === 'shooter' ? 0x2a2838 : 0x3a3a42, roughness: 0.45, metalness: 0.7, emissive: 0x000000, emissiveIntensity: 0 });
  const glowCol = type === 'shooter' ? 0xffd04a : type === 'heavy' ? 0xff5a1a : 0xffa02a;
  const glow = new THREE.MeshBasicMaterial({ color: glowCol });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141218, roughness: 0.9 });
  for (const mt of [skin, armor]) { mt.userData.baseEmissive = mt.emissive.getHex(); mt.userData.baseIntensity = mt.emissiveIntensity; }

  const root = new THREE.Group();
  const rig = {};
  let orb = null;

  if (type === 'grunt') {
    // ---- HUSK: hunched clawed brawler
    const hips = rig.hips = pivot(root, 0, 0.95, 0);
    m(B(0.62, 0.25, 0.38), skin, hips);
    m(B(0.68, 0.1, 0.44), armor, hips, 0, 0.08, 0);
    m(B(0.26, 0.28, 0.06), armor, hips, 0, -0.08, 0.21, -0.1); // loin plate
    for (const s of [-1, 1]) {
      const hip = rig[s < 0 ? 'hipL' : 'hipR'] = pivot(hips, s * 0.2, -0.05, 0);
      m(B(0.24, 0.48, 0.26), skin, hip, 0, -0.22, 0);
      const knee = rig[s < 0 ? 'kneeL' : 'kneeR'] = pivot(hip, 0, -0.45, 0);
      m(B(0.2, 0.45, 0.22), skin, knee, 0, -0.22, 0);
      m(B(0.23, 0.3, 0.07), armor, knee, 0, -0.18, 0.12);
      m(B(0.12, 0.12, 0.06), armor, knee, 0, 0.0, 0.13); // knee cap
      m(B(0.25, 0.1, 0.38), armor, knee, 0, -0.45, 0.07);
      for (const t of [-0.07, 0.07]) m(K(0.03, 0.1, 4), dark, knee, t, -0.47, 0.28, HALF_PI);
    }
    const torso = rig.torso = pivot(hips, 0, 0.12, 0);
    torso.rotation.x = 0.28;
    m(B(0.5, 0.3, 0.32), skin, torso, 0, 0.18, 0);
    for (let i = 0; i < 3; i++) m(B(0.42 - i * 0.04, 0.05, 0.04), armor, torso, 0, 0.1 + i * 0.08, 0.17); // ab plates
    m(B(0.82, 0.48, 0.48), skin, torso, 0, 0.55, 0);
    m(B(0.7, 0.36, 0.08), armor, torso, 0, 0.6, 0.26, -0.1);
    m(B(0.3, 0.06, 0.02), glow, torso, 0, 0.62, 0.305, -0.1); // chest vent glow
    for (let i = 0; i < 4; i++) m(K(0.06, 0.18, 4), armor, torso, 0, 0.35 + i * 0.15, -0.27, -HALF_PI - 0.4); // spine spikes
    for (const s of [-1, 1]) {
      m(B(0.34, 0.14, 0.38), armor, torso, s * 0.52, 0.82, 0, 0, 0, -s * 0.35);
      m(K(0.05, 0.16, 4), armor, torso, s * 0.6, 0.93, 0, 0, 0, -s * 0.5);
    }
    const head = rig.head = pivot(torso, 0, 0.82, 0.1);
    m(C(0.1, 0.12, 0.14, 6), skin, head, 0, 0.04, 0);
    m(B(0.42, 0.36, 0.44), skin, head, 0, 0.22, 0);
    rig.jaw = pivot(head, 0, 0.08, 0.02);
    m(B(0.36, 0.1, 0.36), armor, rig.jaw, 0, -0.04, 0.06);
    for (const t of [-0.1, -0.03, 0.04, 0.11]) m(K(0.018, 0.06, 3), glow, rig.jaw, t, 0.03, 0.23, Math.PI);
    m(B(0.46, 0.12, 0.1), armor, head, 0, 0.27, 0.22);
    for (const s of [-1, 1]) {
      m(B(0.1, 0.035, 0.02), glow, head, s * 0.1, 0.25, 0.275);
      m(K(0.05, 0.26, 5), armor, head, s * 0.18, 0.45, -0.02, -0.3, 0, -s * 0.55);
    }
    for (const s of [-1, 1]) {
      const sh = rig[s < 0 ? 'shL' : 'shR'] = pivot(torso, s * 0.52, 0.7, 0);
      sh.rotation.z = -s * 0.15;
      m(B(0.2, 0.42, 0.22), skin, sh, 0, -0.2, 0);
      const el = rig[s < 0 ? 'elL' : 'elR'] = pivot(sh, 0, -0.4, 0);
      m(B(0.18, 0.4, 0.2), skin, el, 0, -0.18, 0);
      m(B(0.23, 0.26, 0.24), armor, el, 0, -0.16, 0);
      m(B(0.24, 0.03, 0.25), glow, el, 0, -0.04, 0);
      m(B(0.2, 0.12, 0.18), skin, el, 0, -0.42, 0);
      for (const t of [-0.065, 0, 0.065]) m(K(0.03, 0.2, 4), armor, el, t, -0.57, 0.04, Math.PI + 0.25);
    }
  } else if (type === 'shooter') {
    // ---- CASTER: floating robed orb-thrower with a halo
    const hips = rig.hips = pivot(root, 0, 0, 0);
    m(C(0.28, 0.55, 1.1, 7), skin, hips, 0, 0.78, 0);
    m(C(0.56, 0.6, 0.08, 7), armor, hips, 0, 0.25, 0);
    m(C(0.4, 0.44, 0.06, 7), armor, hips, 0, 0.75, 0);
    m(C(0.44, 0.5, 0.04, 7), glow, hips, 0, 0.2, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      m(K(0.07, 0.26, 3), dark, hips, Math.sin(a) * 0.5, 0.1, Math.cos(a) * 0.5, Math.PI);
    }
    const torso = rig.torso = pivot(hips, 0, 1.3, 0);
    m(B(0.56, 0.52, 0.34), skin, torso, 0, 0.2, 0);
    m(B(0.62, 0.12, 0.4), armor, torso, 0, 0.45, 0);
    m(O(0.09), glow, torso, 0, 0.24, 0.19);
    for (const s of [-1, 1]) m(S(0.13, 8, 6), armor, torso, s * 0.36, 0.42, 0);
    const head = rig.head = pivot(torso, 0, 0.52, 0);
    m(K(0.32, 0.6, 6), armor, head, 0, 0.26, -0.02);
    m(B(0.26, 0.26, 0.1), dark, head, 0, 0.14, 0.17);
    m(B(0.06, 0.06, 0.02), glow, head, -0.07, 0.17, 0.225);
    m(B(0.06, 0.06, 0.02), glow, head, 0.07, 0.17, 0.225);
    m(B(0.05, 0.05, 0.02), glow, head, 0, 0.08, 0.225);
    rig.halo = m(T(0.36, 0.025, 6, 24), glow, head, 0, 0.32, -0.26);
    for (const s of [-1, 1]) {
      const sh = rig[s < 0 ? 'shL' : 'shR'] = pivot(torso, s * 0.36, 0.38, 0);
      sh.rotation.z = -s * 0.25;
      m(B(0.13, 0.38, 0.14), skin, sh, 0, -0.18, 0);
      const el = rig[s < 0 ? 'elL' : 'elR'] = pivot(sh, 0, -0.36, 0);
      m(C(0.07, 0.13, 0.36, 6), skin, el, 0, -0.16, 0);
      m(C(0.14, 0.14, 0.04, 6), armor, el, 0, -0.34, 0);
      m(B(0.1, 0.1, 0.1), dark, el, 0, -0.42, 0);
      if (s > 0) {
        orb = new THREE.Group();
        orb.position.set(0, -0.6, 0.05);
        el.add(orb);
        const core = m(S(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffc23a }), orb);
        core.userData.noHit = true;
        rig.orbRings = [];
        for (let k = 0; k < 2; k++) {
          const r = m(T(1.5, 0.08, 4, 20), glow, orb, 0, 0, 0, k * 1.2, k * 0.8);
          r.userData.noHit = true;
          rig.orbRings.push(r);
        }
        orb.scale.setScalar(0.08);
      }
    }
  } else {
    // ---- BRUTE: armored furnace with hammer fists
    const hips = rig.hips = pivot(root, 0, 1.0, 0);
    m(B(1.2, 0.4, 0.8), skin, hips);
    m(B(0.6, 0.5, 0.1), armor, hips, 0, -0.2, 0.43, -0.1);
    for (const s of [-1, 1]) m(B(0.1, 0.5, 0.6), armor, hips, s * 0.64, -0.15, 0, 0, 0, s * 0.12);
    for (const s of [-1, 1]) {
      const hip = rig[s < 0 ? 'hipL' : 'hipR'] = pivot(hips, s * 0.4, -0.1, 0);
      m(B(0.5, 0.5, 0.55), skin, hip, 0, -0.25, 0);
      const knee = rig[s < 0 ? 'kneeL' : 'kneeR'] = pivot(hip, 0, -0.5, 0);
      m(B(0.46, 0.42, 0.5), armor, knee, 0, -0.2, 0);
      m(B(0.3, 0.2, 0.08), armor, knee, 0, 0.0, 0.28);
      m(B(0.62, 0.16, 0.78), armor, knee, 0, -0.42, 0.08);
      for (const t of [-0.2, 0, 0.2]) m(K(0.05, 0.12, 4), dark, knee, t, -0.44, 0.52, HALF_PI);
    }
    const torso = rig.torso = pivot(hips, 0, 0.2, 0);
    m(B(1.3, 0.6, 0.9), skin, torso, 0, 0.3, 0);
    m(B(1.9, 0.9, 1.15), skin, torso, 0, 1.0, 0);
    m(B(1.4, 0.62, 0.12), armor, torso, 0, 1.02, 0.6);
    m(C(0.22, 0.22, 0.1, 8), glow, torso, 0, 1.02, 0.67, HALF_PI);
    m(T(0.25, 0.04, 4, 12), armor, torso, 0, 1.02, 0.68);
    for (const [x, y] of [[-0.6, 1.25], [0.6, 1.25], [-0.6, 0.78], [0.6, 0.78]]) m(C(0.04, 0.04, 0.05, 6), dark, torso, x, y, 0.67, HALF_PI);
    for (let i = 0; i < 3; i++) m(B(1.1 - i * 0.12, 0.08, 0.06), armor, torso, 0, 0.12 + i * 0.16, 0.46);
    for (const s of [-1, 1]) {
      m(C(0.13, 0.16, 0.7, 8), armor, torso, s * 0.4, 1.65, -0.45);
      m(C(0.11, 0.11, 0.06, 8), glow, torso, s * 0.4, 2.01, -0.45);
    }
    for (const s of [-1, 1]) {
      m(B(0.85, 0.42, 0.95), armor, torso, s * 1.05, 1.48, 0, 0, 0, -s * 0.18);
      for (const z of [-0.25, 0.25]) m(K(0.09, 0.3, 4), dark, torso, s * 1.15, 1.78, z, 0, 0, -s * 0.35);
    }
    const head = rig.head = pivot(torso, 0, 1.45, 0.38);
    m(B(0.6, 0.5, 0.6), skin, head, 0, 0.15, 0);
    m(B(0.64, 0.32, 0.12), armor, head, 0, 0.12, 0.31);
    m(B(0.42, 0.05, 0.02), glow, head, 0, 0.18, 0.375);
    m(B(0.66, 0.1, 0.62), armor, head, 0, 0.42, 0);
    for (const s of [-1, 1]) m(K(0.07, 0.3, 4), armor, head, s * 0.3, 0.45, 0, 0, 0, -s * 1.1);
    for (const s of [-1, 1]) {
      const sh = rig[s < 0 ? 'shL' : 'shR'] = pivot(torso, s * 1.15, 1.2, 0);
      sh.rotation.z = -s * 0.12;
      m(B(0.5, 0.7, 0.55), skin, sh, 0, -0.3, 0);
      const el = rig[s < 0 ? 'elL' : 'elR'] = pivot(sh, 0, -0.65, 0);
      m(B(0.55, 0.6, 0.6), armor, el, 0, -0.25, 0);
      m(B(0.6, 0.06, 0.65), glow, el, 0, -0.05, 0);
      m(B(0.78, 0.6, 0.78), armor, el, 0, -0.78, 0);
      m(B(0.8, 0.08, 0.1), glow, el, 0, -0.62, 0.4);
      for (const x of [-0.25, 0, 0.25]) m(B(0.12, 0.12, 0.1), dark, el, x, -0.72, 0.42);
    }
  }

  // shadows + hit parts
  const hit = [];
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  rig.head.traverse((o) => { if (o.isMesh && !o.userData.noHit) o.userData.part = 'head'; });
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noHit) return;
    if (!o.userData.part) o.userData.part = 'body';
    hit.push(o);
  });
  return { root, rig, mats: [skin, armor], extraMats: [glow, dark], hit, orb, glow };
}

// pose an enemy each frame. e.rig, e.type, e.state; w = windup 0..1
export function animateEnemy(e, dt, moving, w, time) {
  const r = e.rig;
  const k = 1 - Math.exp(-dt * 14);
  const lerp = (o, prop, v) => { o.rotation[prop] += (v - o.rotation[prop]) * k; };
  const ph = e.walk;
  const sw = moving ? Math.sin(ph) : 0;
  const breathe = Math.sin(time * 2 + e.walk) * 0.03;

  if (e.type === 'grunt') {
    lerp(r.hipL, 'x', -sw * 0.75); lerp(r.hipR, 'x', sw * 0.75);
    lerp(r.kneeL, 'x', moving ? Math.max(0, Math.sin(ph + 1.2)) * 1.1 : 0.1);
    lerp(r.kneeR, 'x', moving ? Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * 1.1 : 0.1);
    r.hips.position.y = 0.95 - (moving ? Math.abs(Math.cos(ph)) * 0.06 : 0);
    let shx = sw * 0.6, elx = -0.4, tor = 0.28 + breathe, jaw = 0.05;
    if (e.state === 'windup') { shx = -2.7 * w; elx = -0.7 * w; tor = 0.28 - 0.35 * w; jaw = 0.5 * w; }
    else if (e.state === 'recover') { shx = -0.8; elx = -0.1; tor = 0.6; jaw = 0.2; }
    lerp(r.shL, 'x', e.state === 'chase' ? shx : shx); lerp(r.shR, 'x', e.state === 'chase' ? -shx : shx);
    lerp(r.elL, 'x', elx); lerp(r.elR, 'x', elx);
    lerp(r.torso, 'x', tor);
    lerp(r.jaw, 'x', jaw);
  } else if (e.type === 'shooter') {
    r.hips.position.y = 0.25 + Math.sin(time * 2.4 + e.walk) * 0.12;
    r.hips.rotation.x = moving ? 0.12 : 0;
    r.halo.rotation.z += dt * 1.5;
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
    let shx = sw * 0.35, elx = -0.3, tor = 0.1 + breathe, rz = 0;
    if (e.state === 'windup') { shx = -2.9 * w; elx = -0.5 * w; tor = -0.25 * w; }
    else if (e.state === 'recover') { shx = -0.9; elx = 0; tor = 0.55; }
    lerp(r.shL, 'x', e.state === 'chase' ? shx : shx); lerp(r.shR, 'x', e.state === 'chase' ? -shx : shx);
    lerp(r.elL, 'x', elx); lerp(r.elR, 'x', elx);
    lerp(r.torso, 'x', tor);
    r.torso.rotation.z = moving ? Math.sin(ph) * 0.05 : rz;
  }
}

// ---------------------------------------------------------------- viewmodels
export function buildViewmodels(GLOW) {
  const steel = new THREE.MeshStandardMaterial({ color: 0xa2a2ae, metalness: 0.75, roughness: 0.28 });
  const dsteel = new THREE.MeshStandardMaterial({ color: 0x4a4a54, metalness: 0.7, roughness: 0.4 });
  const black = new THREE.MeshStandardMaterial({ color: 0x18181c, metalness: 0.4, roughness: 0.6 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4424, roughness: 0.55 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a2814, roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc89a44, metalness: 0.85, roughness: 0.3 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x2e2622, roughness: 0.85 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x3a1410, roughness: 0.7, metalness: 0.2 });
  const armorRed = new THREE.MeshStandardMaterial({ color: 0x7a2418, metalness: 0.55, roughness: 0.35 });
  const chargeMat = new THREE.MeshStandardMaterial({ color: 0x113344, emissive: 0x3ac8ff, emissiveIntensity: 0.6 });
  const coreGlow = new THREE.MeshStandardMaterial({ color: 0x442211, emissive: 0xff7a2a, emissiveIntensity: 1.4 });

  const flashSprite = (z) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.position.set(0, 0.03, z); s.scale.setScalar(0.38);
    return s;
  };
  const gripHand = (parent, x, y, z, tilt) => {
    const h = pivot(parent, x, y, z);
    h.rotation.x = tilt;
    m(B(0.075, 0.085, 0.08), glove, h, 0.006, 0, 0.012);
    for (let i = 0; i < 4; i++) m(B(0.08, 0.02, 0.028), glove, h, -0.004, 0.03 - i * 0.022, -0.035);
    m(B(0.024, 0.024, 0.07), glove, h, 0.04, 0.035, -0.01, 0, 0.2, 0);
    m(C(0.045, 0.055, 0.32, 8), sleeve, h, 0.01, -0.05, 0.2, 1.15);
    m(C(0.048, 0.048, 0.03, 8), brass, h, 0.01, -0.0, 0.07, 1.15);
  };

  // ---- REVOLVER
  const revolver = new THREE.Group();
  m(B(0.055, 0.085, 0.15), steel, revolver, 0, 0, 0);
  m(B(0.045, 0.02, 0.22), steel, revolver, 0, 0.052, -0.05);
  m(C(0.019, 0.021, 0.3, 12), steel, revolver, 0, 0.03, -0.27, HALF_PI);
  m(B(0.014, 0.016, 0.3), dsteel, revolver, 0, 0.055, -0.27);
  m(C(0.024, 0.024, 0.025, 12), black, revolver, 0, 0.03, -0.42, HALF_PI);
  m(B(0.008, 0.022, 0.016), steel, revolver, 0, 0.072, -0.405);
  m(B(0.02, 0.012, 0.02), black, revolver, 0, 0.07, 0.03); // rear sight
  m(C(0.008, 0.008, 0.18, 6), dsteel, revolver, 0, 0.002, -0.2, HALF_PI);
  const cyl = pivot(revolver, 0, 0.014, -0.065);
  m(C(0.046, 0.046, 0.1, 6), dsteel, cyl, 0, 0, 0, HALF_PI);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    m(B(0.012, 0.012, 0.09), black, cyl, Math.cos(a) * 0.044, Math.sin(a) * 0.044, 0, 0, 0, a);
    m(C(0.009, 0.009, 0.01, 6), brass, cyl, Math.cos(a) * 0.026, Math.sin(a) * 0.026, -0.05, HALF_PI);
  }
  const hammer = pivot(revolver, 0, 0.045, 0.07);
  m(B(0.016, 0.045, 0.024), dsteel, hammer, 0, 0.02, 0, -0.3);
  m(B(0.03, 0.01, 0.03), dsteel, hammer, 0, 0.045, 0.012, -0.3);
  m(T(0.03, 0.005, 4, 10, Math.PI), dsteel, revolver, 0, -0.045, -0.01, 0, HALF_PI, Math.PI);
  m(B(0.008, 0.03, 0.01), black, revolver, 0, -0.05, -0.005, 0.3);
  m(B(0.05, 0.15, 0.07), wood, revolver, 0, -0.1, 0.085, -0.35);
  m(B(0.054, 0.1, 0.04), woodDark, revolver, 0, -0.09, 0.07, -0.35);
  m(B(0.054, 0.02, 0.075), brass, revolver, 0, -0.17, 0.115, -0.35);
  const coils = [];
  for (const z of [-0.17, -0.24, -0.31]) coils.push(m(T(0.028, 0.006, 6, 16), chargeMat, revolver, 0, 0.03, z));
  m(B(0.01, 0.014, 0.12), chargeMat, revolver, 0, 0.064, -0.05);
  gripHand(revolver, 0, -0.09, 0.09, -0.35);
  const revFlash = flashSprite(-0.46); revolver.add(revFlash);
  revolver.userData.base = new THREE.Vector3(0.24, -0.24, -0.55);

  // ---- SHOTGUN
  const shotgun = new THREE.Group();
  for (const x of [-0.028, 0.028]) {
    m(C(0.026, 0.026, 0.64, 12), steel, shotgun, x, 0.03, -0.36, HALF_PI);
    m(C(0.03, 0.03, 0.04, 12), dsteel, shotgun, x, 0.03, -0.67, HALF_PI);
    m(C(0.016, 0.016, 0.01, 10), black, shotgun, x, 0.03, -0.69, HALF_PI);
  }
  m(B(0.02, 0.012, 0.64), dsteel, shotgun, 0, 0.06, -0.36);
  m(B(0.008, 0.012, 0.01), brass, shotgun, 0, 0.072, -0.67);
  m(B(0.1, 0.1, 0.22), dsteel, shotgun, 0, 0.0, 0.02);
  for (const s of [-1, 1]) m(B(0.004, 0.06, 0.13), brass, shotgun, s * 0.052, 0.005, 0.02);
  m(B(0.104, 0.028, 0.07), coreGlow, shotgun, 0, -0.012, -0.05);
  for (const x of [-0.02, 0.02]) m(B(0.012, 0.03, 0.02), black, shotgun, x, 0.06, 0.1, -0.4);
  const pump = pivot(shotgun, 0, -0.035, -0.3);
  m(B(0.09, 0.07, 0.22), wood, pump);
  for (let i = 0; i < 4; i++) m(B(0.092, 0.008, 0.012), woodDark, pump, 0, -0.036, -0.08 + i * 0.05);
  m(C(0.012, 0.012, 0.3, 6), dsteel, shotgun, 0, -0.02, -0.18, HALF_PI);
  m(B(0.07, 0.11, 0.32), wood, shotgun, 0, -0.05, 0.27, 0.14);
  m(B(0.074, 0.06, 0.1), woodDark, shotgun, 0, -0.02, 0.15, 0.14);
  m(B(0.076, 0.125, 0.03), black, shotgun, 0, -0.072, 0.43, 0.14);
  m(T(0.03, 0.005, 4, 10, Math.PI), dsteel, shotgun, 0, -0.055, 0.07, 0, HALF_PI, Math.PI);
  gripHand(shotgun, 0, -0.07, 0.13, 0.1);
  const shotFlash = flashSprite(-0.74); shotgun.add(shotFlash);
  shotFlash.scale.setScalar(0.5);
  shotgun.userData.base = new THREE.Vector3(0.27, -0.29, -0.56);
  shotgun.visible = false;

  // ---- GAUNTLET (left punch arm)
  const arm = new THREE.Group();
  m(C(0.075, 0.08, 0.3, 8), sleeve, arm, 0, 0, 0.36, HALF_PI);
  for (let i = 0; i < 3; i++) {
    const sc = 1 - i * 0.07;
    m(B(0.135 * sc, 0.125 * sc, 0.11), armorRed, arm, 0, 0.005, 0.22 - i * 0.095);
    m(B(0.137 * sc, 0.012, 0.012), brass, arm, 0, 0.065 * sc, 0.17 - i * 0.095);
  }
  m(B(0.03, 0.03, 0.22), coreGlow, arm, 0, 0.07, 0.12);
  m(C(0.075, 0.075, 0.04, 8), brass, arm, 0, 0, -0.06, HALF_PI);
  const fist = pivot(arm, 0, 0, -0.14);
  m(B(0.13, 0.12, 0.1), glove, fist);
  for (let i = 0; i < 4; i++) {
    m(B(0.03, 0.055, 0.05), glove, fist, -0.047 + i * 0.031, 0.015, -0.065);
    m(B(0.03, 0.03, 0.03), glove, fist, -0.047 + i * 0.031, -0.025, -0.05);
  }
  m(B(0.145, 0.035, 0.055), armorRed, fist, 0, 0.055, -0.065);
  for (let i = 0; i < 4; i++) m(K(0.012, 0.035, 4), steel, fist, -0.047 + i * 0.031, 0.08, -0.075, -0.3);
  m(B(0.13, 0.01, 0.01), coreGlow, fist, 0, 0.045, -0.095);
  m(B(0.035, 0.035, 0.08), glove, fist, 0.072, -0.02, -0.03, 0, 0, 0.3);
  arm.userData.rest = new THREE.Vector3(-0.32, -0.8, -0.3);
  arm.userData.hit = new THREE.Vector3(-0.1, -0.17, -0.6);
  arm.position.copy(arm.userData.rest);

  return { revolver, shotgun, arm, revFlash, shotFlash, chargeMat, coils, cyl, hammer, pump };
}
