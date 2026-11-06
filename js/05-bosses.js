'use strict';
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
  miniReward(e);
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
