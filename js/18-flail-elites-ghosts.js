'use strict';
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
  const killed = damageEnemy(e, dmg, { weapon: 'flail', point: pt, knock: e.def.boss ? null : knock, pierce: v === 1, explosion: false, charge: k });
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
const ELITE_OK = new Set(['diver', 'siphon', 'grunt', 'shooter', 'flyer', 'heavy', 'shield', 'sniper', 'priest', 'ram', 'burrower', 'mender']);
const fireballs = [];
const fireballMat = new THREE.SpriteMaterial({ map: GLOW, color: 0xff6a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
function eliteChance() {
  if (G.mode === 'endless') return G.wave >= 6 ? Math.min(0.2, 0.025 * (G.wave - 4)) : 0;
  if (G.mode !== 'campaign' || !G.level || G.level.duel || G.level.prime) return 0;
  const ly = layerOf(G.level), num = Number(String(G.level.id).split('-')[1]) || 1;
  if (ly <= 0) return num >= 3 ? 0.05 : 0;
  return Math.min(0.14, 0.04 + ly * 0.015 + num * 0.004);
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
  statMet('elite_' + kind);
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
  if (statsLive()) { STATS.elites = (STATS.elites || 0) + 1; STATS.by['elite_' + e.elite] = (STATS.by['elite_' + e.elite] || 0) + 1; }
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
  ghostMat.color.setHex(golemGlowHex());
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
  if (all[GH.key] && t < all[GH.key].t && statsLive()) { STATS.ghostBeats = (STATS.ghostBeats || 0) + 1; pushFeed('YOU BEAT YOUR GHOST', 'cool'); }
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
