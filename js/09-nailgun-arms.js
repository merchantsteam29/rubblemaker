'use strict';
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
function ownedArms() { return ['fist', ...['blade', 'shock', 'grapple', 'tide'].filter((a) => owns('arm_' + a))]; }
function cycleArm() {
  const list = ownedArms();
  if (list.length < 2) { pushFeed('Win DUELS to earn new arms', ''); return; }
  W.arm = list[(list.indexOf(W.arm) + 1) % list.length];
  pushFeed(ARM_NAMES[W.arm] + ' ARM', 'cool');
  sfx.pump();
  updateArmSlot();
}
function actLabel(a) {
  if (G.input === 'pad') return padLabel(settings.padBinds[a]);
  if (G.input === 'touch') return ({ interact: 'USE', punch: 'PUNCH', arm: 'ARM', jump: 'JUMP', dash: 'DASH', slide: 'SLIDE', fire: 'FIRE', alt: 'ALT', swap: 'SWAP' })[a] || a.toUpperCase();
  return keyLabel((settings.binds[a] || []).filter(Boolean)[0]);
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
