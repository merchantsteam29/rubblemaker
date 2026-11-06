'use strict';
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
