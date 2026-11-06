'use strict';
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
      else if (k === 'kiln') e.atk = dist < 4 && Math.random() < 0.35 ? 'stomp' : 'spit';
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
