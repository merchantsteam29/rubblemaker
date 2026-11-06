'use strict';
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
