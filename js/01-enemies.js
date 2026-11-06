'use strict';
// ---------------------------------------------------------------- enemies
const DIFF = () => G.modDiff || DIFFS[settings.difficulty] || DIFFS.normal;
const DEFS = {
  grunt: { hp: 60, speed: 6.8, r: 0.5, h: 2.25, color: 0xb8452c, mass: 1, kill: 60, label: 'KILL' },
  shooter: { hp: 70, speed: 5.2, r: 0.5, h: 2.45, color: 0x5c64b8, mass: 1, kill: 70, label: 'KILL' },
  flyer: { hp: 40, speed: 9, r: 0.6, h: 1.0, color: 0x7a7468, mass: 0.7, kill: 70, label: 'KILL', fly: true },
  boss1: { hp: 2600, speed: 4.2, r: 2.2, h: 6.8, color: 0x8c8478, mass: 60, kill: 600, label: 'BOSS KILL', boss: true, name: 'MORTIMER, WARDEN OF THE CELLAR', short: 'MORTIMER' },
  boss2: { hp: 3400, speed: 6, r: 1.6, h: 7.4, color: 0xd8c49a, mass: 60, kill: 800, label: 'BOSS KILL', boss: true, fly: true, name: 'THE HIGH MASON, ARCHITECT OF RUIN', short: 'THE HIGH MASON' },
  bulwark: { hp: 480, speed: 2.8, r: 1.0, h: 3.5, color: 0x6a7088, mass: 40, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE BULWARK · TRAINER', short: 'THE BULWARK', hint: 'Bullets glance off THE BULWARK · PUNCH his big orb to PARRY it back into him', canHurt: (i) => !!i.parry, onHurt: (e) => { e.state = 'recover'; e.t = 1.2; banner('CRACKED!'); } },
  sweeper: { hp: 650, speed: 3.4, r: 1.3, h: 4.2, color: 0x8a6a40, mass: 40, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE SWEEPER · TRAINER', short: 'THE SWEEPER', hint: 'His waves are too tall to jump · DASH straight through them' },
  roost: { hp: 400, speed: 10, r: 1.4, h: 2.4, color: 0x6a5a7a, mass: 30, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, fly: true, name: 'THE ROOST · TRAINER', short: 'THE ROOST', hint: 'THE ROOST only flinches when you are AIRBORNE · jump and shoot, or GROUND SLAM her when she lands', canHurt: (i) => !P.grounded || i.weapon === 'slam' },
  kiln: { hp: 560, speed: 2.6, r: 1.6, h: 5.2, color: 0x2e2622, mass: 40, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE KILN · TRAINER', short: 'THE KILN', hint: 'THE KILN only cracks when its own spit hits it · PUNCH the glowing spit back (PARRY)', canHurt: (i) => !!i.parry || !!i.combo },
  shield: { hp: 90, speed: 4.2, r: 0.55, h: 2.25, color: 0x8a5a3a, mass: 1.6, kill: 90, label: 'KILL', ai: 'grunt', variantModel: true, shielded: true, hint: 'SHIELDBEARERS block from the front · flank them, or break the shield with explosions, slams or the GRAPPLE' },
  sniper: { hp: 60, speed: 4.5, r: 0.5, h: 2.45, color: 0x3a4a3a, mass: 1, kill: 90, label: 'KILL', ai: 'sniper', variantModel: true },
  bomber: { hp: 25, speed: 9.5, r: 0.45, h: 1.8, color: 0x8a6a2a, mass: 0.8, kill: 50, label: 'KILL', ai: 'bomber', variantModel: true, bomber: true },
  priest: { hp: 90, speed: 4.5, r: 0.5, h: 2.45, color: 0xe8e0d0, mass: 1, kill: 110, label: 'EXCOMMUNICATED', ai: 'priest', variantModel: true },
  shard: { hp: 1600, speed: 7, r: 0.75, h: 3.0, color: 0x9ad8ff, mass: 40, kill: 600, label: 'DUEL WON', boss: true, duelist: true, name: 'SISTER SHARD', short: 'SISTER SHARD' },
  bertha: { hp: 2200, speed: 4.5, r: 1.3, h: 3.9, color: 0xc8784a, mass: 50, kill: 600, label: 'DUEL WON', boss: true, duelist: true, name: 'BIG BERTHA BRICKS', short: 'BIG BERTHA' },
  kite: { hp: 1300, speed: 12, r: 0.55, h: 1.9, color: 0x5a5a62, mass: 30, kill: 600, label: 'DUEL WON', boss: true, duelist: true, fly: true, name: 'KITE, THE CHIMNEY SWEEP', short: 'KITE' },
  swarmling: { hp: 12, speed: 11, r: 0.35, h: 0.7, color: 0x8a4a3a, mass: 0.4, kill: 25, label: 'KILL', fly: true, base: 'flyer', scale: 0.55 },
  mirror: { hp: 500, speed: 3, r: 1.0, h: 3.5, color: 0xb8d8f0, mass: 40, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE MIRROR KNIGHT · TRAINER', short: 'THE MIRROR KNIGHT', hint: 'Only RICOCHETS hurt the MIRROR KNIGHT · COINSHOT a coin into him or bank a CHAINLINK shot', canHurt: (i) => !!(i.coin || i.chain) || (!owns('rev1') && !owns('rev2') && !!i.lance) },
  marksman: { hp: 1000, speed: 4.5, r: 0.7, h: 3.4, color: 0x2a3a2a, mass: 40, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, ai: 'sniper', name: 'THE MARKSMAN · TRAINER', short: 'THE MARKSMAN', hint: 'THE MARKSMAN only falls to his own bullets · PUNCH the instant his laser flashes white', canHurt: (i) => !!i.countersnipe },
  fortress: { hp: 700, speed: 2.8, r: 1.4, h: 4.6, color: 0x5a5a6a, mass: 50, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, layers: 3, name: 'THE FORTRESS · TRAINER', short: 'THE FORTRESS', hint: 'THE FORTRESS hides behind 3 shield layers · strip them with explosions, slams, shockwaves or the GRAPPLE' },
  queen: { hp: 450, speed: 9, r: 1.4, h: 2.4, color: 0x7a3a5a, mass: 30, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, fly: true, name: 'THE SWARM QUEEN · TRAINER', short: 'THE SWARM QUEEN', hint: 'THE SWARM QUEEN only feels the NAILGUN · throw a LODESTONE magnet on her and spray', canHurt: (i) => i.weapon === 'nailgun' || !owns('nailgun') },
  boss3: { hp: 4200, speed: 3.6, r: 2.4, h: 7.8, color: 0x4a2216, mass: 70, kill: 1000, label: 'BOSS KILL', boss: true, name: 'THE MOLTEN FOREMAN', short: 'THE MOLTEN FOREMAN' },
  gilded: { hp: 2400, speed: 8.5, r: 0.75, h: 3.0, color: 0xffc040, mass: 40, kill: 900, label: 'DUEL WON', boss: true, duelist: true, name: 'THE GILDED ONE', short: 'THE GILDED ONE' },
  heavy: { hp: 340, speed: 3.6, r: 1.0, h: 3.25, color: 0xa07a4a, mass: 3.5, kill: 160, label: 'BIG KILL' },
};
const enemies = [];
function makeEnemy(type, x, z, y = 0) {
  const def = DEFS[type];
  const model = def.mini || def.custom ? buildMiniModel(type) : def.cat ? buildCatModel() : def.base ? buildEnemyModel(def.base, def.color) : def.duelist ? buildDuelistModel(type) : def.variantModel ? buildVariantModel(type) : def.trainer ? buildTrainerModel(type) : def.boss ? buildBossModel(type) : buildEnemyModel(type, def.color);
  const g = model.root;
  if (def.scale) g.scale.multiplyScalar(def.scale);
  if (CHEATS.bigheads && model.rig.head) model.rig.head.scale.multiplyScalar(2);
  g.position.set(x, def.fly ? y : y - def.h, z);
  const baseScale = g.scale.x;
  if (def.fly) g.scale.setScalar(0.001);
  scene.add(g);
  const e = {
    type, def, mesh: g, mats: model.mats, extraMats: model.extraMats, hit: model.hit, rig: model.rig, orb: model.orb,
    hp: def.hp * (DIFF().hp || 1), vel: new V3(), state: 'chase', t: 0, cd: rand(0.8, 2), flash: 0,
    grounded: true, strafe: Math.random() < 0.5 ? -1 : 1, strafeT: rand(1, 3), spawnT: def.boss ? 1.6 : 0.7, spawnMax: def.boss ? 1.6 : 0.7, spawnY: y, baseScale, home: new V3(x, y + 1, z), animType: { boss1: 'heavy', boss2: 'shooter', bulwark: 'grunt', sweeper: 'heavy', roost: 'flyer', kiln: 'heavy', shield: 'grunt', sniper: 'shooter', bomber: 'grunt', priest: 'shooter', shard: 'grunt', bertha: 'heavy', kite: 'grunt', swarmling: 'flyer', mirror: 'grunt', marksman: 'shooter', fortress: 'heavy', queen: 'flyer', boss3: 'heavy', gilded: 'grunt', ram: 'heavy', burrower: 'grunt', mender: 'shooter', tumble: 'grunt', twirl: 'grunt', anvil: 'heavy', bellows: 'heavy', crane: 'flyer' }[type] || def.animAs || null, layers: def.layers || 0, shieldUp: !!def.shielded, shieldHP: 80, maxHp: def.hp * (DIFF().hp || 1), mv: new V3(), orbit: rand(0, 6.28), alt: rand(4, 6.5), dead: false, walk: rand(0, 6),
  };
  for (const m of model.hit) m.userData.enemy = e;
  maybeIntro(type);
  statMet(type);
  enemies.push(e);
  // spawn fx
  const pos = new V3(x, def.fly ? y : 0.2 + y, z);
  ringFx(pos, 2.5, 0xff3a2a);
  burst(pos, 14, 0xff4a2a, 7, 0.15, 0.6, true, 0.3, 1.2);
  sfxAt(pos, 'spawn', distVol(pos));
  maybeElite(e);
  if (!def.boss) voiceSoon(e, 'alert', 0.9);
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
  sfxAt(from, 'orb', distVol(from));
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
    if (e.dummy) { updateDummy(e, dt); continue; }
    if (e.type === 'flyer' || e.type === 'swarmling') { updateFlyer(e, dt); continue; }
    if (e.type === 'boss3') { updateBoss3(e, e.prime ? dt * 1.25 : dt); if (e.prime && !e.dead) primeTick(e, dt); continue; }
    if (e.type === 'boss1') { updateBoss1(e, e.prime ? dt * 1.25 : dt); if (e.prime && !e.dead) primeTick(e, dt); continue; }
    if (e.type === 'boss2') { updateBoss2(e, e.prime ? dt * 1.25 : dt); if (e.prime && !e.dead) primeTick(e, dt); continue; }
    if (e.def.ai === 'ram' || e.def.ai === 'burrower' || e.def.ai === 'mender') { updateNewAI(e, dt); continue; }
    if (e.def.mini) { updateMiniBoss(e, e.prime ? dt * 1.2 : dt); if (e.prime && !e.dead) primeTick(e, dt); continue; }
    if (e.def.ai === 'siphon') { updateSiphon(e, dt); continue; }
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
        if (dist < 2.0 && e.cd <= 0 && Math.abs(P.pos.y - p.y) < 2) { e.state = 'windup'; e.t = 0.42; sfxAt(p, 'windup', distVol(p)); }
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
        if (dist < 3.8 && e.cd <= 0) { e.state = 'windup'; e.t = 0.85; sfxAt(p, 'windup', distVol(p)); }
      } else if (e.state === 'windup') {
        windupGlow = 1 - e.t / 0.85;
       
        if (e.t <= 0) {
          const center = new V3(p.x + nx * 1.4, p.y, p.z + nz * 1.4);
          ringFx(center, 5, 0xff6a2a);
          burst(center, 18, 0x8a7a6a, 9, 0.25, 0.8);
          sfxAt(p, 'heavySlam', distVol(p));
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
  if (e.dead || e.spawnT > 0 || e.buried) return false;
  if (e.state === 'stun') dmg *= 1.5;
  if (e.wardT > G.time) dmg *= 0.5;
  if (e.shieldUp && !info.combo && !info.parry && !info.explosion && info.weapon !== 'slam') {
    const f = new V3(Math.sin(e.mesh.rotation.y), 0, Math.cos(e.mesh.rotation.y));
    const to = camera.position.clone().sub(e.mesh.position).setY(0).normalize();
    if (f.dot(to) > 0.3) { e.shieldHP -= dmg; blockedFx(e, info.point); if (e.shieldHP <= 0) breakShield(e, to.clone().negate()); return false; }
  }
  if (info.combo && e.shieldUp) breakShield(e, null);
  if (e.layers > 0) {
    if (info.explosion || info.combo || info.weapon === 'slam' || info.weapon === 'shock') stripLayer(e); else blockedFx(e, info.point);
    return false;
  }
  if ((e.type === 'shard' || e.type === 'gilded') && e.state === 'stance' && !info.parry && !info.combo && !info.explosion) {
    blockedFx(e, info.point);
    if (G.time - (e.reflT || 0) > 0.3) { e.reflT = G.time; hurtPlayer(8, null); pushFeed('REFLECTED', 'bad'); }
    return false;
  }
  if (e.def.canHurt && !e.def.canHurt(info, e)) { blockedFx(e, info.point); return false; }
  dmg = swapChain(info, dmg);
  dmg = eliteDmg(e, dmg, info);
  e.hp -= dmg;
  if (G.mode === 'practice') practiceHit(e, dmg);
  e.flash = 0.07;
  e.flinch = Math.min(1.2, (e.flinch || 0) + dmg / 35);
  if (settings.gore && info.point && Math.random() < 0.6) bloodSpray(info.point);
  if (e.def.onHurt) e.def.onHurt(e);
  if (e.hp > 0 && Math.random() < 0.4) voice(e, 'hurt');
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
  statKill(e, info);
  voice(e, 'die');
  eliteKilled(e, info);
  if (!e.def.boss && !e.dummy && e.type !== 'swarmling' && e.type !== 'mender') RECENT_DEAD.push({ type: e.type, x: e.mesh.position.x, z: e.mesh.position.z, t: G.time });
  if (e.def.onKill) e.def.onKill(e, info || {});
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
  spatial(c, () => sfx.kill());
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

function hurtPlayer(dmg, knock, env) {
  if (G.state !== 'play' || P.invuln > 0 || P.dashT > 0) return false;
  if (G.mode === 'practice' && PRACTICE.god) return false;
  dmg = Math.round(dmg * (env ? Math.sqrt(DIFF().dmg) : DIFF().dmg));
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
  if (P.hp <= 0) { if (G.mode === 'practice') { P.hp = 100; banner('RUBBLED · HP REFILLED'); } else { P.hp = 0; gameOver(); } }
  return true;
}
function heal(n) {
  P.hp = Math.min(100, P.hp + n * (DIFF().heal || 1));
}
