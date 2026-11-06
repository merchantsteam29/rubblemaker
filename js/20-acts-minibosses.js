'use strict';
// ================================================================ BATCH 6.3: ACTS, LAYERS, MINI-BOSSES, WEAPON REWARDS
var LAYER_NAMES = { 0: 'FOUNDATIONS', 1: 'NAVE', 2: 'CHOIR', 3: 'SPIRE', 4: 'FIREBOX', 5: 'CHAMBER', 6: 'CHIMNEY' };
var ACT_NAMES = ['ACT I', 'ACT II', 'ACT III'];
function layerOf(lv) { const n = Number(String(lv.id).split('-')[0]); return Number.isFinite(n) ? n : -1; }
function levelActLabel(lv) {
  if (lv.race) return 'RACE COURSES';
  if (lv.duel || lv.prime) return lv.scene.name;
  const si = SCENES.indexOf(lv.scene);
  return `${ACT_NAMES[si] || ''} · ${lv.scene.name}${LAYER_NAMES[layerOf(lv)] ? ' · ' + LAYER_NAMES[layerOf(lv)] : ''}`;
}

// ---- mini-bosses: one at the end of layers 1, 2, 4 and 5. Each drops a weapon.
Object.assign(DEFS, {
  organist: { hp: 1500, speed: 4.2, r: 0.9, h: 4.2, color: 0x5a3a5a, mass: 40, kill: 500, label: 'MINI-BOSS DOWN', boss: true, mini: true, animAs: 'shooter', award: 'nailgun', name: 'THE ORGANIST · MINI-BOSS', short: 'THE ORGANIST', hint: 'THE ORGANIST plays volleys of nails · his big chord-orb can be PARRIED back for huge damage' },
  ringer: { hp: 1900, speed: 3.6, r: 1.4, h: 4.4, color: 0x6a5a48, mass: 50, kill: 500, label: 'MINI-BOSS DOWN', boss: true, mini: true, animAs: 'heavy', award: 'launcher', name: 'THE BELL-RINGER · MINI-BOSS', short: 'THE BELL-RINGER', hint: 'Lobbed bells explode where they land · DASH through the tall TOLL waves' },
  stoker: { hp: 2300, speed: 3.8, r: 1.5, h: 4.6, color: 0x3a2a22, mass: 60, kill: 500, label: 'MINI-BOSS DOWN', boss: true, mini: true, animAs: 'heavy', award: 'flail', name: 'THE STOKER · MINI-BOSS', short: 'THE STOKER', hint: 'Keep away while THE STOKER whirls his coal ball · hit him hard when he stops, dizzy' },
  glazier: { hp: 2100, speed: 6, r: 0.8, h: 4.0, color: 0x6ac8d8, mass: 40, kill: 500, label: 'MINI-BOSS DOWN', boss: true, mini: true, animAs: 'grunt', award: 'variant', name: 'THE GLAZIER · MINI-BOSS', short: 'THE GLAZIER', hint: 'THE GLAZIER blinks behind you · watch the floor for falling glass' },
});
DEFS.boss1.award = 'shotgun';
Object.assign(EPITHETS, {
  organist: ['MINI-BOSS · LAYER 1', 'KEEPER OF THE NAVE'],
  ringer: ['MINI-BOSS · LAYER 2', "THE CHOIR'S LAST BELL"],
  stoker: ['MINI-BOSS · LAYER 4', 'SHOVEL OF THE FIREBOX'],
  glazier: ['MINI-BOSS · LAYER 5', 'HE FIRES THE GLASS'],
});
Object.assign(VOICES, {
  organist: [110, 520, 1400, 0.2, 0.6, 'square'], ringer: [62, 420, 820, 0.7, 0.6], stoker: [50, 340, 700, 0.9, 0.7], glazier: [240, 900, 2600, 0.05, 0.4, 'triangle'],
});
CODEX_BEASTS.push(
  ['organist', 'THE ORGANIST', 'MINIBOSS', 'He played the great organ until the pipes rusted shut, then he started playing them at people. Beat him at the end of the NAVE for the NAILGUN.'],
  ['ringer', 'THE BELL-RINGER', 'MINIBOSS', 'Deaf for forty years and still ringing. He carries the choir bell like a club. Beat him at the end of the CHOIR for the BRICK LAUNCHER.'],
  ['stoker', 'THE STOKER', 'MINIBOSS', "The Foreman's best shoveller. He swings a ball of burning coal on a chain. Beat him at the end of the FIREBOX for the CHAIN FLAIL."],
  ['glazier', 'THE GLAZIER', 'MINIBOSS', 'He fires glass in the kiln chamber and blinks like light through a window. Beat him at the end of the CHAMBER for a free gun variant.'],
);
var AWARD_FROM = { shotgun: 'MORTIMER · 0-5', nailgun: 'THE ORGANIST · 1-5', launcher: 'THE BELL-RINGER · 2-5', flail: 'THE STOKER · 4-5' };
for (const it of SHOP) if (AWARD_FROM[it.id]) { it.from = AWARD_FROM[it.id]; it.desc = it.desc.replace(/^Unlocks the /, 'The '); }

// models: built on the regular rigs, dressed up with props
function buildMiniModel(type) {
  const def = DEFS[type];
  const base = { organist: 'shooter', ringer: 'heavy', stoker: 'heavy', glazier: 'grunt' }[type];
  const md = buildEnemyModel(base, def.color);
  const r = md.rig;
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4, ...o });
  const glow = (color) => new THREE.MeshBasicMaterial({ color });
  const add = (geo, mat, parent, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; (parent || md.root).add(m); return m; };
  if (type === 'organist') {
    const brass = std(0xc8a040, { metalness: 0.85, roughness: 0.3 }), g = glow(0xc08aff);
    for (let i = 0; i < 5; i++) { const h = 0.6 + (2 - Math.abs(i - 2)) * 0.28; add(new THREE.CylinderGeometry(0.06, 0.06, h, 8), brass, r.torso, (i - 2) * 0.14, 0.35 + h / 2, -0.32); add(new THREE.SphereGeometry(0.05, 6, 5), g, r.torso, (i - 2) * 0.14, 0.35 + h, -0.32); }
    add(new THREE.BoxGeometry(0.62, 0.08, 0.3), brass, r.torso, 0, 0.32, -0.3);
    add(new THREE.ConeGeometry(0.42, 0.7, 6), std(0x2a1a2a, { roughness: 0.9 }), r.head, 0, 0.2, -0.05);
    md.root.scale.setScalar(1.7);
  } else if (type === 'ringer') {
    const bronze = std(0xa0703a, { metalness: 0.9, roughness: 0.3 });
    const bell = new THREE.Group(); bell.position.set(0, -0.9, 0.2); r.elR.add(bell);
    add(new THREE.CylinderGeometry(0.28, 0.62, 0.9, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xa0703a, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }), bell, 0, 0, 0);
    add(new THREE.SphereGeometry(0.29, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), bronze, bell, 0, 0.44, 0);
    add(new THREE.SphereGeometry(0.12, 8, 6), std(0x3a3a3a), bell, 0, -0.42, 0);
    add(new THREE.TorusGeometry(0.62, 0.04, 5, 16), glow(0xffd04a), bell, 0, -0.45, 0, Math.PI / 2);
    r.bell = bell;
    md.root.scale.setScalar(1.35);
  } else if (type === 'stoker') {
    const iron = std(0x3a3a40, { metalness: 0.8 });
    const chain = new THREE.Group(); chain.position.set(0, -0.6, 0.1); r.elR.add(chain);
    for (let i = 0; i < 5; i++) add(new THREE.TorusGeometry(0.06, 0.02, 4, 8), iron, chain, 0, -i * 0.13, 0, 0, i % 2 ? Math.PI / 2 : 0);
    const ball = new THREE.Group(); ball.position.set(0, -0.8, 0); chain.add(ball);
    add(new THREE.IcosahedronGeometry(0.5, 0), std(0x1a1410, { emissive: 0xff4a0a, emissiveIntensity: 0.9, roughness: 0.9 }), ball, 0, 0, 0);
    for (let i = 0; i < 6; i++) add(new THREE.ConeGeometry(0.08, 0.3, 4), iron, ball, Math.cos(i) * 0.48, Math.sin(i * 2) * 0.3, Math.sin(i) * 0.48, i, i * 2, 0);
    add(new THREE.BoxGeometry(0.8, 0.12, 0.5), std(0x2a1a10), r.head, 0, 0.3, 0.02);
    r.chain = chain; r.ball = ball;
    md.root.scale.setScalar(1.4);
  } else if (type === 'glazier') {
    const glass = new THREE.MeshStandardMaterial({ color: 0x9ae8ff, emissive: 0x2a8aa8, emissiveIntensity: 0.6, transparent: true, opacity: 0.6, roughness: 0.05, metalness: 0.1 });
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) add(new THREE.OctahedronGeometry(0.16 + i * 0.04), glass, r.torso, sd * (0.36 + i * 0.05), 0.55 + i * 0.16, -0.05, i, 0, sd * 0.5);
    add(new THREE.BoxGeometry(0.5, 0.4, 0.06), glass, r.head, 0, 0.12, 0.27);
    add(new THREE.OctahedronGeometry(0.22), glass, r.elR, 0, -0.75, 0.1);
    md.root.scale.setScalar(1.6);
  }
  return md;
}

// one AI for all four, each with its own attack set
const MINI_ATK = {
  organist: { near: ['volley', 'chord'], far: ['volley', 'hymn', 'chord'], range: [9, 16] },
  ringer: { near: ['toll', 'charge'], far: ['bells', 'bells', 'charge'], range: [6, 13] },
  stoker: { near: ['whirl', 'smash'], far: ['coal', 'whirl', 'coal'], range: [4, 10] },
  glazier: { near: ['blink', 'shards'], far: ['shards', 'rain', 'blink'], range: [8, 15] },
};
const MINI_WIND = { volley: 0.55, hymn: 0.9, chord: 0.8, bells: 0.7, toll: 1.0, charge: 0.6, whirl: 0.5, coal: 0.6, smash: 0.85, shards: 0.5, blink: 0.35, rain: 0.7 };
function miniHead(e) { const h = new V3(); (e.rig.head || e.mesh).getWorldPosition(h); return h; }
function fanOrbs(e, n, spread, speed, dmg, color) {
  const head = miniHead(e), eye = playerEye();
  const base = Math.atan2(eye.x - head.x, eye.z - head.z);
  const dist = Math.hypot(eye.x - head.x, eye.z - head.z);
  const dy = (eye.y - 0.3 - head.y) / Math.max(1, dist);
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * spread;
    const v = new V3(Math.sin(a), dy, Math.cos(a)).normalize().multiplyScalar(speed);
    spawnOrb(head.clone().addScaledVector(v, 0.25), v, dmg, { color });
  }
  sfx.orb(1);
}
function updateMiniBoss(e, dt) {
  const p = e.mesh.position, def = e.def, k = e.type, A = MINI_ATK[k];
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  const rage = e.hp < e.maxHp * 0.5;
  if (rage && !e.raged) { e.raged = true; banner(def.short + ' IS FURIOUS'); sfx.bossRoar(); }
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0;
  e.mesh.rotation.y = Math.atan2(dx, dz);
  const sp = def.speed * DIFF().speed * (rage ? 1.2 : 1);
  if (e.state === 'chase') {
    const want = dist > A.range[1] ? 1 : dist < A.range[0] ? -0.6 : 0;
    e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rand(1.5, 3); }
    mx = nx * sp * want - nz * e.strafe * sp * 0.5; mz = nz * sp * want + nx * e.strafe * sp * 0.5;
    if (e.cd <= 0) {
      const list = dist < A.range[0] + 1 ? A.near : A.far;
      let atk = list[(Math.random() * list.length) | 0];
      if (atk === e.lastAtk && Math.random() < 0.6) atk = list[(list.indexOf(atk) + 1) % list.length];
      e.atk = e.lastAtk = atk;
      e.wt = MINI_WIND[atk] * (rage ? 0.8 : 1);
      e.state = 'windup'; e.t = e.wt;
      if (atk === 'toll' || atk === 'smash') ringFx(p.clone().setY(p.y + 0.05), atk === 'toll' ? 6 : 4, 0xff6a2a);
      sfxAt(p, 'windup', 1);
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (k === 'stoker' && e.rig.chain) e.rig.chain.rotation.x = -w * 2.5;
    if (e.t <= 0) { miniAttack(e, e.atk, dist, nx, nz, rage); if (e.state === 'windup') { e.state = 'recover'; e.t = rage ? 0.6 : 0.85; } }
  } else if (e.state === 'whirl') {
    e.whirlT -= dt;
    mx = nx * sp * 1.35; mz = nz * sp * 1.35;
    if (e.rig.chain) { e.rig.chain.rotation.z += dt * 18; e.rig.chain.rotation.x = -1.4; }
    if (dist < 4.6 && G.time > (e.whirlHit || 0)) { e.whirlHit = G.time + 0.45; if (hurtPlayer(14, new V3(nx * 12, 5, nz * 12))) sfx.flailHit(0.5); }
    if (Math.random() < 0.5) spawnPart(p.clone().add(new V3(rand(-3, 3), 2, rand(-3, 3))), new V3(0, 2, 0), 0xff7a2a, 0.1, 0.3, true, -0.1);
    if (e.whirlT <= 0) { e.state = 'stun'; e.t = 1.6; banner('DIZZY!'); if (e.rig.chain) e.rig.chain.rotation.set(0, 0, 0); }
  } else if (e.state === 'charge') {
    e.chargeT -= dt;
    mx = e.chargeDir.x * 19; mz = e.chargeDir.z * 19;
    if (dist < def.r + 1.4 && !e.chargeHit) { e.chargeHit = true; hurtPlayer(25, new V3(e.chargeDir.x * 16, 7, e.chargeDir.z * 16)); }
    if (e.chargeT <= 0) { e.state = 'recover'; e.t = 0.9; shockwave(p.clone(), 12, 10, 12); }
  } else if (e.state === 'stun') {
    w = 0.3;
    if (e.t <= 0) { e.state = 'chase'; e.cd = 1; }
  } else if (e.t <= 0) {
    e.state = 'chase';
    e.cd = (rage ? 1.5 : 2.0) * DIFF().fire;
  }
  if (e.rain) for (let i = e.rain.length - 1; i >= 0; i--) {
    const q = e.rain[i]; q.t -= dt;
    if (q.t <= 0) {
      e.rain.splice(i, 1);
      burst(new V3(q.x, 0.4, q.z), 14, 0x9ae8ff, 8, 0.1, 0.5, true);
      sfx.ting();
      if (Math.hypot(P.pos.x - q.x, P.pos.z - q.z) < 1.8 && P.pos.y < 2.5) hurtPlayer(20, null);
    }
  }
  if (k === 'stoker' && e.rig.ball && e.state !== 'whirl') e.rig.ball.rotation.y += dt;
  enemyPhysics(e, mx, mz, dt);
  const moving = Math.hypot(mx, mz) > 0.5;
  if (moving) e.walk += dt * 4;
  animateEnemy(e, dt, moving, w, G.time);
  applyFlash(e, w);
}
function miniAttack(e, atk, dist, nx, nz, rage) {
  const p = e.mesh.position;
  if (atk === 'volley') {
    fanOrbs(e, rage ? 9 : 7, 0.11, 19, 8, 0xc8a040);
    if (rage) setTimeout(() => { if (!e.dead && G.boss === e) fanOrbs(e, 8, 0.12, 19, 8, 0xc8a040); }, 350);
  } else if (atk === 'hymn') {
    const head = miniHead(e), eye = playerEye();
    const v = eye.clone().setY(eye.y - 0.3).sub(head).normalize().multiplyScalar(9);
    spawnOrb(head.clone().addScaledVector(v, 0.3), v, 30, { big: true, color: 0xc08aff });
    const o = orbs[orbs.length - 1]; o.big = true; o.m.scale.setScalar(2.4); o.glow.material.color.setHex(0xa06aff);
    sfx.orb(1); showHint('PUNCH the chord-orb back at THE ORGANIST');
  } else if (atk === 'chord') {
    for (let i = 0; i < (rage ? 3 : 2); i++) setTimeout(() => { if (!e.dead && G.boss === e) { shockwave(e.mesh.position.clone(), 13, 30, 20, i % 2 === 0); sfx.heavySlam(0.7); } }, i * 550);
  } else if (atk === 'bells') {
    const head = miniHead(e);
    for (let i = 0; i < (rage ? 4 : 3); i++) {
      const tx = P.pos.x + rand(-3.5, 3.5) + P.vel.x * 0.5, tz = P.pos.z + rand(-3.5, 3.5) + P.vel.z * 0.5;
      const d = Math.hypot(tx - head.x, tz - head.z), t = Math.max(0.7, d / 13);
      const v = new V3((tx - head.x) / t, (0 - head.y) / t + 7 * t, (tz - head.z) / t);
      spawnOrb(head.clone(), v, 15, { grav: 14, boom: 3.2, color: 0xa0703a });
      orbs[orbs.length - 1].m.scale.setScalar(1.8);
    }
    sfx.door();
  } else if (atk === 'toll') {
    shockwave(p.clone(), 12, 34, 25, true);
    G.shake = Math.max(G.shake, 0.6); sfx.bossRoar();
    tn(220, 218, 2.2, 0.5, 'sine'); tn(440, 436, 1.8, 0.25, 'sine');
    if (dist < 5) hurtPlayer(18, new V3(nx * 14, 7, nz * 14));
  } else if (atk === 'charge') {
    e.state = 'charge'; e.chargeT = 0.75; e.chargeHit = false; e.chargeDir = new V3(nx, 0, nz);
    sfx.bossRoar();
  } else if (atk === 'whirl') {
    e.state = 'whirl'; e.whirlT = rage ? 3 : 2.2;
    sfx.chain();
  } else if (atk === 'coal') {
    const head = miniHead(e);
    for (let i = 0; i < (rage ? 4 : 3); i++) setTimeout(() => { if (!e.dead && G.boss === e) throwFireball(miniHead(e), playerEye().add(new V3(rand(-2, 2), 0, rand(-2, 2)))); }, i * 220);
    void head;
  } else if (atk === 'smash') {
    const c = p.clone().addScaledVector(new V3(nx, 0, nz), 2.5);
    shockwave(c, 15, 22, 20);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; addFlame(c.x + Math.cos(a) * 2.5, c.z + Math.sin(a) * 2.5, 'cat', 3); }
    G.shake = Math.max(G.shake, 0.6); sfx.heavySlam(1); burst(c.clone().setY(0.3), 20, 0xff7a2a, 9, 0.2, 0.7, true);
    if (Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < 3.5 && P.pos.y < 1.5) hurtPlayer(25, new V3(nx * 10, 8, nz * 10));
  } else if (atk === 'shards') {
    fanOrbs(e, rage ? 7 : 5, 0.16, 22, 10, 0x9ae8ff);
  } else if (atk === 'blink') {
    burst(p.clone().setY(p.y + 2), 16, 0x9ae8ff, 8, 0.12, 0.5, true);
    const fwd = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    for (let tries = 0; tries < 6; tries++) {
      const a = rand(-0.9, 0.9), d = rand(5, 7);
      const back = fwd.clone().negate().applyAxisAngle(new V3(0, 1, 0), a);
      const x = P.pos.x + back.x * d, z = P.pos.z + back.z * d;
      if (overlapBox(x - 1, 0.1, z - 1, x + 1, 3, z + 1)) continue;
      p.x = x; p.z = z; break;
    }
    burst(p.clone().setY(p.y + 2), 16, 0x9ae8ff, 8, 0.12, 0.5, true);
    sfx.ting();
    setTimeout(() => { if (!e.dead && G.boss === e) fanOrbs(e, 3, 0.2, 20, 10, 0x9ae8ff); }, 300);
  } else if (atk === 'rain') {
    e.rain = e.rain || [];
    const n = rage ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const x = P.pos.x + (i === 0 ? 0 : rand(-6, 6)), z = P.pos.z + (i === 0 ? 0 : rand(-6, 6));
      e.rain.push({ x, z, t: 0.9 + i * 0.08 });
      ringFx(new V3(x, floorAt(x, z, 3) + 0.06, z), 1.8, 0x9ae8ff);
    }
    sfx.screech(0.6);
  }
}

// ---- rewards
function awardItem(id) {
  const p = loadProgress(); p.owned = p.owned || [];
  if (p.owned.includes(id)) return false;
  p.owned.push(id); saveProgress(p); PROGC = null;
  return true;
}
function miniReward(e) {
  const aw = e.def.award;
  if (!aw || G.mode !== 'campaign' || !G.level || G.level.prime || G.level.race || G.level.duel || (VS && VS.active) || e.prime) return;
  if (aw === 'variant') { const pp = loadProgress(); if (!pp.glazierGift) { pp.glazierGift = 1; pp.pendingVar = true; saveProgress(pp); PROGC = null; } return; }
  if (!awardItem(aw)) return;
  const gun = { shotgun: 1, nailgun: 2, launcher: 3, flail: 4 }[aw];
  applyVariantLook();
  setTimeout(() => {
    const el = $('achToast');
    el.innerHTML = `<small>NEW WEAPON</small><b>${WNAMES[gun]}</b><span>dropped by ${e.def.short} · press ${gun + 1} to equip</span>`;
    el.classList.add('show'); sfx.buy();
    setTimeout(() => el.classList.remove('show'), 4200);
    if (G.state === 'play') { switchWeapon(gun); showHint(`${WNAMES[gun]} ACQUIRED · its variants are now for sale at the FORGE`); }
  }, 1400);
}
function variantChoices() {
  return SHOP.filter((it) => it.v > 0 && !owns(it.id) && (!it.req || owns(it.req) || it.gun === 0));
}
function variantPickHTML() {
  const list = variantChoices();
  if (!list.length) return '<div class="varPick"><b>FREE VARIANT</b><p>You already own every variant you can use · +800 ◆ SCRAP instead</p></div>';
  return `<div class="varPick"><b>THE GLAZIER'S GIFT · PICK A FREE VARIANT</b><div>${list.map((it) => `<button data-freevar="${it.id}" style="border-color:${VARIANTS[it.gun][it.v].css}">${WNAMES[it.gun]} · ${VARIANTS[it.gun][it.v].name}</button>`).join('')}</div></div>`;
}
// shown on the level-clear screen while the Glazier's gift is unclaimed (kept in the save until you pick)
function showVariantPick() {
  document.querySelectorAll('.varPick').forEach((x) => x.remove());
  if ((VS && VS.active) || !loadProgress().pendingVar) return;
  $('completeStats').insertAdjacentHTML('afterend', variantPickHTML());
  const box = document.querySelector('.varPick');
  const done = (msg) => { const pp = loadProgress(); pp.pendingVar = false; saveProgress(pp); PROGC = null; box.innerHTML = msg; sfx.buy(); };
  if (!box.querySelector('[data-freevar]')) { awardScrap(800); done('<b>FREE VARIANT</b><p>You already own every variant you can use · +800 ◆ SCRAP instead</p>'); return; }
  box.querySelectorAll('[data-freevar]').forEach((b) => b.addEventListener('click', () => {
    if (!loadProgress().pendingVar) return;
    awardItem(b.dataset.freevar);
    done(`<b>CLAIMED</b><p>${b.textContent} is yours · swap to it by pressing the gun's number key again</p>`);
  }));
}

// ================================================================ BATCH 6.4: ELITES IN THE CODEX, NEW ACHIEVEMENTS + SKINS
// codex-only entries (never spawned directly; any regular enemy can roll elite)
Object.assign(DEFS, {
  elite_iron: { hp: 108, speed: 6.1, r: 0.5, h: 2.25, color: 0xb8452c, mass: 1, kill: 120, label: 'IRON ELITE', base: 'grunt', scale: 1.12, eliteKind: 'iron', hint: 'Body shots do about half damage · HEADSHOTS, explosions, slams, shockwaves and the SPIKE flail hit IRON in full · jump its floor-pound shockwave' },
  elite_ember: { hp: 105, speed: 6.5, r: 0.5, h: 2.45, color: 0x5c64b8, mass: 1, kill: 130, label: 'EMBER ELITE', base: 'shooter', scale: 1.12, eliteKind: 'ember', hint: 'Leaves burning floor and lobs fireballs · when it dies it blows up into fire, so do not finish it point-blank' },
});
CODEX_BEASTS.splice(CODEX_BEASTS.findIndex((x) => x[2] === 'TRAINER'), 0,
  ['elite_iron', 'IRON ELITE', 'ELITE', 'Any brick can come back from the forge plated in iron: almost twice as tough, a little slower, and it pounds the floor to send out shockwaves. Marked by a blue crest.'],
  ['elite_ember', 'EMBER ELITE', 'ELITE', 'Fired twice in the kiln and still glowing. EMBER elites run faster, burn the ground behind them and throw fire. Marked by an orange crest. They get more common the deeper you go.'],
);
function tintElite(mats, kind) {
  const X = ELITES[kind]; const tint = new THREE.Color(X.color);
  for (const mt of mats) {
    if (!mt || !mt.color) continue;
    mt.color.lerp(tint, kind === 'iron' ? 0.55 : 0.35);
    if (kind === 'iron' && 'metalness' in mt) { mt.metalness = 0.75; mt.roughness = 0.35; }
    if (mt.emissive) { mt.emissive.setHex(X.emissive); mt.emissiveIntensity = kind === 'ember' ? 0.9 : 0.4; }
  }
}

// race stats are kept even though races do not feed the normal lifetime stats
function raceStat(k, n = 1) {
  if (cheatsOn() || !STATS) return;
  STATS.race = STATS.race || {};
  STATS.race[k] = Math.max(0, (STATS.race[k] || 0) + n);
  saveStats();
}
const rs = (k) => ((STATS.race || {})[k] || 0);
const raceSecret = () => !vsUnlocked();

Object.assign(SKINS, {
  iron: { name: 'IRONCLAD', steel: 0x8a96a8, dsteel: 0x2a3444, brass: 0x8ac8ff, em: 0x0a1a2a },
  spectre: { name: 'SPECTRE', steel: 0xc8f0ff, dsteel: 0x5a8aa8, brass: 0x8ae8ff, em: 0x1a4a5a },
  champion: { name: 'CHAMPION', steel: 0xe8e8e8, dsteel: 0x1a1a1a, brass: 0xff3a2a, em: 0x2a0404 },
  stained: { name: 'STAINED GLASS', steel: 0x3a6aa8, dsteel: 0x1a2a4a, brass: 0xffc83a, em: 0x3a0a4a },
});
const MINIS = ['organist', 'ringer', 'stoker', 'glazier'];
ACHS.splice(ACHS.findIndex((a) => a.id === 'all'), 0,
  { id: 'flail100', name: 'CHAIN REACTION', desc: 'Kill 100 enemies with the CHAIN FLAIL', p: () => [STATS.wk.flail || 0, 100], scrap: 300 },
  { id: 'wreck', name: 'FULL SWING', desc: 'Land 50 fully wound WRECKING BALL hits', p: () => [statL('WRECKING BALL'), 50], scrap: 250 },
  { id: 'sweep', name: 'CLEAN SWEEP', desc: 'Pull off 25 DEMOLITION SWEEPS (3+ enemies in one swing)', p: () => [statL('DEMOLITION SWEEP'), 25], scrap: 300 },
  { id: 'elite25', name: 'ELITE SQUAD', desc: 'Kill 25 elite enemies', p: () => [STATS.elites || 0, 25], scrap: 250 },
  { id: 'iron50', name: 'IRON WILL', desc: 'Kill 50 IRON elites', p: () => [STATS.by.elite_iron || 0, 50], scrap: 300 },
  { id: 'ember50', name: 'FIRE BRIGADE', desc: 'Kill 50 EMBER elites', p: () => [STATS.by.elite_ember || 0, 50], scrap: 300 },
  { id: 'elite200', name: 'TOP BRASS', desc: 'Kill 200 elite enemies', p: () => [STATS.elites || 0, 200], skin: 'iron' },
  { id: 'ghost1', name: 'HAUNTED', desc: 'Beat your own ghost on any level', p: () => [STATS.ghostBeats || 0, 1], scrap: 150 },
  { id: 'ghost25', name: 'FASTER THAN YOURSELF', desc: 'Beat your own ghost 25 times', p: () => [STATS.ghostBeats || 0, 25], skin: 'spectre' },
  { id: 'ghosts20', name: 'GHOST TOWN', desc: 'Have a ghost run saved on 20 levels', p: () => [new Set(Object.keys(loadGhosts()).map((k) => k.split(':')[0])).size, 20], scrap: 300 },
  { id: 'minis', name: 'LAYER BREAKER', desc: 'Beat every mini-boss', p: () => [MINIS.filter((t) => STATS.bosses[t]).length, MINIS.length], skin: 'stained' },
  { id: 'armed', name: 'FULLY ARMED', desc: 'Own all five guns', p: () => [1 + ['shotgun', 'nailgun', 'launcher', 'flail'].filter((id) => (prog().owned || []).includes(id)).length, 5], scrap: 400 },
  { id: 'race1', name: 'FIRST PAST THE POST', desc: 'Win a RUBBLE RACE', p: () => [rs('wins'), 1], scrap: 200, secret: raceSecret },
  { id: 'set5', name: 'SET AND MATCH', desc: 'Win 5 best-of-3 race sets', p: () => [rs('sets'), 5], skin: 'champion', secret: raceSecret },
  { id: 'runes', name: 'SHORTCUT SAVANT', desc: 'Take 25 shortcut runes in races', p: () => [rs('shortcuts'), 25], scrap: 250, secret: raceSecret },
  { id: 'hex', name: 'HEX BOMB', desc: 'Fire 25 curses at rivals', p: () => [rs('curses'), 25], scrap: 200, secret: raceSecret },
  { id: 'deliver', name: 'SPECIAL DELIVERY', desc: 'Send 50 enemies into rivals’ levels', p: () => [rs('sent'), 50], scrap: 250, secret: raceSecret },
);
