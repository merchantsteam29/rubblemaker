'use strict';
// ---------------------------------------------------------------- player
function slamImpact() {
  G.slamAt = G.time; G.slamPos = P.pos.clone();
  breakSecrets(P.pos, 5);
  rubble(P.pos, 6, 4);
  fxShift(0.012);
  P.landDip = 1;
  const fall = P.slamFall;
  const radius = 5 + Math.min(3, fall * 2);
  const dmg = 30 + Math.min(40, fall * 30);
  ringFx(P.pos, radius, 0xffb060);
  burst(P.pos.clone().setY(P.pos.y + 0.2), 22, 0x8a7a6a, 10, 0.2, 0.8);
  sfx.slam();
  G.shake = Math.max(G.shake, 0.5);
  let n = 0;
  for (const e of enemies.slice()) {
    if (e.dead || e.spawnT > 0) continue;
    const ep = e.mesh.position;
    const d = Math.hypot(ep.x - P.pos.x, ep.z - P.pos.z);
    if (d < radius && Math.abs(ep.y - P.pos.y) < 2) {
      const away = new V3(ep.x - P.pos.x, 0, ep.z - P.pos.z).normalize().multiplyScalar(4).setY(11);
      damageEnemy(e, dmg, { weapon: 'slam', knock: away });
      n++;
    }
  }
  if (n) { useWeapon('slam'); addStyle(40 + n * 15, 'GROUND SLAM', 'slam', 'cool'); }
}

function updatePlayer(dt) {
  const fwd = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  const right = new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  const ix = clamp((down('right') ? 1 : 0) - (down('left') ? 1 : 0) + AXIS.x, -1, 1);
  const iz = clamp((down('forward') ? 1 : 0) - (down('back') ? 1 : 0) + AXIS.y, -1, 1);
  const rv = VS && VS.fx && VS.fx.reverse ? -1 : 1;
  const wish = fwd.clone().multiplyScalar(iz * rv).addScaledVector(right, ix * rv);
  if (wish.lengthSq() > 1) wish.normalize();
  const crouchHeld = down('slide');
  const crouchPressed = hit('slide');

  P.invuln -= dt;
  P.pips = Math.min(maxPips(), P.pips + dt * 0.85);

  // dash
  if (hit('dash') && P.pips >= 1) {
    if (!CHEATS.infdash) P.pips -= 1;
    P.dashDir.copy(wish.lengthSq() ? wish : fwd).normalize();
    P.dashT = 0.17; P.invuln = Math.max(P.invuln, 0.22); P.dashHits = null;
    P.sliding = false; P.slamming = false;
    sfx.dash();
  }
  // slam / slide
  if (crouchPressed) {
    if (!P.grounded && !P.slamming && P.dashT <= 0) {
      P.slamming = true; P.slamFall = 0;
      P.vel.set(0, -55, 0);
      sfx.slamStart();
    } else if (P.grounded && !P.sliding) startSlide(wish, fwd);
  }
  if (P.grounded && crouchHeld && !P.sliding && P.dashT <= 0 && !crouchPressed && P.landedT < 0.05) startSlide(wish, fwd);
  if (P.sliding && (!crouchHeld)) P.sliding = false;

  // jump
  if (hit('jump')) {
    if (P.grounded) {
      if (P.sliding) {
        P.sliding = false;
        P.vel.x = P.slideDir.x * 17; P.vel.z = P.slideDir.z * 17;
      }
      P.vel.y = 11.5; P.grounded = false;
      sfx.jump();
    } else {
      const n = P.wallJumps > 0 ? wallNormal() : null;
      if (!n && P.airJumps > 0 && owns('up_djump')) {
        P.airJumps--; P.slamming = false;
        P.vel.y = 10.5;
        if (wish.lengthSq()) { const hs2 = Math.max(9, Math.hypot(P.vel.x, P.vel.z)); P.vel.x = wish.x * hs2; P.vel.z = wish.z * hs2; }
        sfx.jump(); tone(600, 900, 0.12, 0.12, 'triangle');
        ringFx(P.pos.clone().setY(P.pos.y + 0.05), 1.4, 0xffd04a);
        burst(P.pos.clone().setY(P.pos.y + 0.1), 10, 0xffd04a, 4, 0.08, 0.4, true, 0.3);
      }
      if (n) {
        P.wallJumps--;
        P.slamming = false;
        const h = n.multiplyScalar(10).addScaledVector(wish, 4);
        P.vel.set(h.x, 12, h.z);
        sfx.walljump();
        burst(P.pos.clone().addScaledVector(n, -0.4).setY(P.pos.y + 1), 6, 0x8a7a6a, 3, 0.1, 0.5);
      }
    }
  }

  // velocity
  if (P.dashT > 0) {
    P.dashT -= dt;
    if (owns('up_firedash')) fireDashTick(dt);
    P.vel.set(P.dashDir.x * 32, 0, P.dashDir.z * 32);
    if (P.dashT <= 0) { P.vel.x *= 0.5; P.vel.z *= 0.5; }
    if (Math.random() < 0.6) spawnPart(P.pos.clone().setY(P.pos.y + rand(0.3, 1.5)), new V3(), 0x6ad8ff, 0.06, 0.25, true, 0);
  } else if (P.sliding) {
    if (P.grounded) { P.vel.x = P.slideDir.x * 16; P.vel.z = P.slideDir.z * 16; }
    P.vel.y -= 32 * dt * (CHEATS.lowgrav ? 0.4 : G.lowgrav ? 0.55 : 1);
    if (Math.random() < 0.5) spawnPart(P.pos.clone().setY(P.pos.y + 0.1), new V3(rand(-1, 1), 2, rand(-1, 1)), 0x8a7a6a, 0.08, 0.4);
  } else if (P.slamming) {
    P.vel.x = 0; P.vel.z = 0; P.vel.y = -55;
    P.slamFall += dt;
  } else {
    const speed = 11 * (P.wet ? 0.75 : 1);
    if (P.grounded) {
      const k = 1 - Math.exp(-dt * 16);
      P.vel.x += (wish.x * speed - P.vel.x) * k;
      P.vel.z += (wish.z * speed - P.vel.z) * k;
    } else {
      const hs = Math.hypot(P.vel.x, P.vel.z);
      P.vel.x += wish.x * 32 * dt; P.vel.z += wish.z * 32 * dt;
      const ns = Math.hypot(P.vel.x, P.vel.z), cap = Math.max(hs, speed);
      if (ns > cap) { P.vel.x *= cap / ns; P.vel.z *= cap / ns; }
    }
    P.vel.y -= 32 * dt * (CHEATS.lowgrav ? 0.4 : G.lowgrav ? 0.55 : 1);
  }

  // move with substeps
  const wasGrounded = P.grounded;
  const vyBefore = P.vel.y;
  const dx = P.vel.x * dt, dy = P.vel.y * dt, dz = P.vel.z * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.25));
  let landed = false;
  for (let i = 0; i < steps; i++) {
    if (moveAxis('x', dx / steps) === 'wall') P.vel.x = P.dashT > 0 ? P.vel.x : 0;
    if (moveAxis('z', dz / steps) === 'wall') P.vel.z = P.dashT > 0 ? P.vel.z : 0;
    const ry = moveAxis('y', dy / steps);
    if (ry === 'floor') { landed = true; P.vel.y = 0; }
    else if (ry === 'ceil') P.vel.y = 0;
  }
  if (!landed && P.vel.y <= 0) {
    // ground probe
    const oy = P.pos.y;
    P.pos.y -= 0.05;
    if (playerOverlap(P.pos, 1.0)) landed = true;
    P.pos.y = oy;
  }
  P.grounded = landed;
  if (landed && !wasGrounded && vyBefore < -8) P.landDip = Math.min(1, -vyBefore / 30);
  P.landedT = P.grounded ? (wasGrounded ? (P.landedT || 0) + dt : 0) : 0;
  if (P.grounded) {
    P.wallJumps = 3; P.airJumps = 1;
    if (P.slamming) { P.slamming = false; slamImpact(); slamBounce(); }
  }
  if (P.pos.y < -15) { P.pos.copy(G.spawn); P.pos.y += 1; P.vel.set(0, 0, 0); }

  // camera
  const targetH = P.sliding ? 0.85 : 1.6;
  P.camH += (targetH - P.camH) * (1 - Math.exp(-dt * 18));
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (P.grounded && hs > 2 && !P.sliding) P.bob += dt * hs * 1.1;
  P.roll += (-ix * 0.025 + (P.sliding ? 0.04 : 0) - P.roll) * (1 - Math.exp(-dt * 10));
}
function startSlide(wish, fwd) {
  P.sliding = true;
  P.slideDir.copy(wish.lengthSq() ? wish : fwd).normalize();
  sfx.slide();
}

function updateWeapons(dt) {
  vsTauntInput();
  W.cd -= dt; W.punchCD -= dt; W.coreCD -= dt; W.sawCD -= dt; W.switchT = Math.max(0, W.switchT - dt);
  W.coins = Math.min(4, W.coins + dt / 1.6);
  flailTick(dt);
  if (hit('weapon1')) switchWeapon(0);
  if (hit('weapon2')) switchWeapon(1);
  if (hit('swap')) switchWeapon(nextGun());
  if (hit('arm')) cycleArm();
  if (hit('weapon3')) switchWeapon(2);
  if (hit('weapon4')) switchWeapon(3);
  if (hit('weapon5')) switchWeapon(4);
  if (W.arm === 'tide') tideArm(dt);
  else if (W.arm === 'shock') {
    if (down('punch') && W.punchCD <= 0) W.shockCharge = Math.min(1, W.shockCharge + dt / 0.7);
    else if (W.shockCharge > 0) { shockPunch(W.shockCharge); W.shockCharge = 0; }
  } else if (hit('punch') && W.punchCD <= 0) { if (W.arm === 'blade') slash(); else if (W.arm === 'grapple') fireGrapple(); else punch(); }
  if (hit('inspect') && !(W.inspectT > 0)) { W.inspectT = 1.6; if (W.cur === 0) W.revSpin = 3; sfx.pump(); }
  if (down('fire') || down('alt')) W.inspectT = 0;

  if (W.cur === 0) {
    const v = W.variant[0];
    if (v === 2) {
      if (hit('alt') && W.coins >= 1) tossCoin();
    } else {
      const need = v === 0 ? 0.9 : 0.6;
      if (down('alt') && W.cd <= 0) { W.charging = true; W.charge = Math.min(1, W.charge + dt / need); }
      if (!down('alt') && W.charging) {
        if (W.charge >= 1) { if (v === 0) fireCharged(); else fireChain(); W.cd = 0.5; }
        W.charging = false; W.charge = 0;
      }
    }
    if (down('fire') && !W.charging && W.cd <= 0) { fireRevolver(); W.cd = 0.36; W.revSpin = 1; }
  } else if (W.cur === 1) {
    const v = W.variant[1];
    if (down('fire') && W.cd <= 0) { fireShotgun(); W.cd = 0.9; }
    if (v === 0 && hit('alt') && W.coreCD <= 0 && W.cd <= 0.3) { throwCore(); W.coreCD = 1.1; W.cd = Math.max(W.cd, 0.35); }
    if (v === 1 && hit('alt') && W.cd <= 0.2 && W.pump < 3) {
      W.pump++; sfx.pump(); W.kick = 0.6; W.cd = Math.max(W.cd, 0.22);
      if (W.pump === 3) pushFeed('OVERPRESSURE READY', 'bad');
    }
    if (v === 2 && hit('alt') && W.sawCD <= 0) { launchSaw(); W.sawCD = 1.2; W.cd = Math.max(W.cd, 0.3); }
  } else if (W.cur === 2) {
    updateNailgun(dt);
  } else if (W.cur === 3) updateLauncher(dt);
  else updateFlail(dt);
}

function updateViewmodel(dt) {
  W.kick *= Math.exp(-dt * 12);
  W.flashT -= dt;
  swayX *= Math.exp(-dt * 10); swayY *= Math.exp(-dt * 10);
  const g = guns[W.cur];
  const b = g.userData.base;
  const bb = settings.viewBob ? 1 : 0;
  const bobX = Math.sin(P.bob) * 0.012 * bb, bobY = Math.abs(Math.cos(P.bob)) * 0.014 * bb;
  W.inspectT = Math.max(0, (W.inspectT || 0) - dt);
  const ip = W.inspectT > 0 ? Math.sin((1 - W.inspectT / 1.6) * Math.PI) : 0;
  const eq = clamp(W.switchT / 0.18, 0, 1);
  const pk = W.punchT > 0 ? Math.sin((1 - W.punchT / 0.26) * Math.PI) : 0;
  const breathe = Math.sin(G.time * 1.7) * 0.004;
  const dip = (P.landDip || 0);
  g.position.set(
    b.x + bobX - swayX * 0.0004 - ip * 0.12 + pk * 0.03,
    b.y - bobY - eq * 0.38 + swayY * 0.0004 - (P.sliding ? 0.03 : 0) + breathe - dip * 0.07 + ip * 0.05 - pk * 0.06,
    b.z + W.kick * 0.06 + ip * 0.06,
  );
  g.rotation.set(
    W.kick * 0.18 + eq * 1.1 - ip * 0.25 + dip * 0.15,
    -swayX * 0.0006 + ip * 1.3,
    (P.sliding ? 0.15 : 0) + eq * 0.7 + W.kick * (W.cur === 0 ? 0.09 : 0.03) + (P.dashT > 0 ? 0.22 : 0) + ip * 0.5 - pk * 0.25,
  );
  if (W.cur === 0 && W.charging) {
    g.position.x += rand(-1, 1) * 0.003 * W.charge;
    g.position.y += rand(-1, 1) * 0.003 * W.charge;
  }
  chargeMat.emissiveIntensity = 0.6 + W.charge * 5 + (W.charge >= 1 ? Math.sin(G.time * 30) * 1.5 : 0);
  VM.revVariants.forEach((g, i) => (g.visible = i === W.variant[0]));
  VM.shotVariants.forEach((g, i) => (g.visible = i === W.variant[1]));
  VM.nailVariants.forEach((g, i) => (g.visible = i === W.variant[2]));
  VM.launcherVariants.forEach((g, i) => (g.visible = i === W.variant[3]));
  flailVM(dt);
  VM.launcherFlash.material.opacity = W.cur === 3 && W.flashT > 0 ? 1 : 0;
  VM.launcherFlash.material.rotation = Math.random() * 6;
  VM.launcherHopper.position.y = 0.16 - (W.cur === 3 && W.cd > 0.3 ? 0.03 : 0);
  VM.launcherAccent.emissiveIntensity = 1.3 + (W.altCD > 0 ? 0 : Math.sin(G.time * 6) * 0.4 + 0.4);
  VM.nailAccent.emissiveIntensity = 1.2 + W.heat * 6;
  VM.nailFlash.material.opacity = W.cur === 2 && W.flashT > 0 ? 1 : 0;
  VM.nailFlash.material.rotation = Math.random() * 6;
  VM.pressureLights.forEach((l, i) => l.material.color.setHex(W.pump > i ? 0xff3a1a : 0x331a10));
  VM.needle.rotation.x = -0.8 + W.pump * 0.6 + (W.pump === 3 ? Math.sin(G.time * 40) * 0.1 : 0);
  VM.saw.rotation.x += dt * (W.sawCD > 0 ? 2 : 14);
  VM.shotAccent.emissiveIntensity = 1.4 + W.pump * 0.8;
  VM.coils.forEach((c, i) => { c.scale.setScalar(1 + (W.charge > i / 3 ? 0.25 : 0) * W.charge); });
  if (W.revSpin > 0) { const st = Math.min(W.revSpin, dt * 8); W.revSpin -= st; VM.cyl.rotation.z += st * Math.PI / 3; }
  VM.hammer.rotation.x = W.cur === 0 ? (W.cd > 0.2 ? 0.5 : W.charging ? 0.6 * W.charge : 0) : 0;
  pumpMesh.position.z = -0.3 + (W.cur === 1 && W.cd > 0.2 && W.cd < 0.6 ? Math.sin((0.6 - W.cd) / 0.4 * Math.PI) * 0.1 : 0);
  const fl = W.flashT > 0 ? 1 : 0;
  revFlash.material.opacity = W.cur === 0 ? fl : 0;
  shotFlash.material.opacity = W.cur === 1 ? fl : 0;
  revFlash.material.rotation = shotFlash.material.rotation = Math.random() * 6;
  vmFlash.intensity = fl * 3;
  // arm punch anim
  W.punchT -= dt;
  const k = W.punchT > 0 ? Math.sin((1 - W.punchT / 0.26) * Math.PI) : 0;
  const AM = VM.arms;
  for (const key in AM) if (key !== W.arm) AM[key].visible = false;
  const A = AM[W.arm] || AM.fist;
  const chg = W.arm === 'shock' ? W.shockCharge : W.arm === 'tide' ? (W.tideCharge || 0) : 0;
  const charging = chg > 0;
  if (charging) A.position.lerpVectors(A.userData.rest, A.userData.hit, 0.3).add(new V3(0.04, -0.04, 0.2 * chg));
  else A.position.lerpVectors(A.userData.rest, A.userData.hit, k);
  A.rotation.set(k * 0.25, k * 0.35, W.arm === 'blade' ? -k * 1.5 : -k * 0.55);
  A.visible = k > 0.01 || charging;
  VM.shockGlow.emissiveIntensity = 1.5 + W.shockCharge * 6;
}

// ---------------------------------------------------------------- waves
const SPAWNS = [];
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  SPAWNS.push([Math.cos(a) * 31, Math.sin(a) * 31]);
}
SPAWNS.push([0, 0], [10, -10], [-10, 10], [20, 20], [-20, -20]);
function startWave(n) {
  G.wave = n;
  G.waveActive = true;
  const shifted = pitWaveSetup(n);
  const bossWave = n % 10 === 0;
  const k = bossWave ? 0.3 : 1;
  const list = [];
  const grunts = Math.round(Math.min(16, 3 + n * 2) * k);
  const shooters = Math.round(Math.min(10, n === 1 ? 1 : n) * k);
  const heavies = Math.round(Math.min(5, Math.floor((n - 1) / 2)) * k);
  for (let i = 0; i < grunts; i++) list.push('grunt');
  for (let i = 0; i < shooters; i++) list.push('shooter');
  for (let i = 0; i < heavies; i++) list.push('heavy');
  for (let i = 0; i < Math.round((n >= 2 ? Math.min(6, n - 1) : 0) * k); i++) list.push('flyer');
  pitExtras(n, list, bossWave);
  list.sort(() => Math.random() - 0.5);
  G.toSpawn = list;
  G.spawnT = 0.8;
  G.pitBossT = bossWave ? 2.4 : 0;
  banner(`WAVE ${n}` + (shifted ? ' · ' + PIT_ARENAS[shifted].name : '') + (bossWave ? ' · BOSS' : ''));
  $('wave').textContent = `WAVE ${n}` + (G.mod ? ' · ' + G.mod.name : '');
  sfx.wave();
}
function spawnOne(type) {
  const ok = SPAWNS.filter(([x, z]) => Math.hypot(x - P.pos.x, z - P.pos.z) > 13);
  const [x, z] = ok[(Math.random() * ok.length) | 0] || SPAWNS[0];
  makeEnemy(type, x + rand(-1.5, 1.5), z + rand(-1.5, 1.5), type === 'flyer' ? rand(4, 6) : 0);
}
function updateWaves(dt) {
  if (!G.waveActive) {
    G.breakT -= dt;
    if (G.breakT <= 0) startWave(G.wave + 1);
    return;
  }
  G.spawnT -= dt;
  if (G.toSpawn.length && G.spawnT <= 0 && enemies.length < 8 + G.wave) {
    spawnOne(G.toSpawn.pop());
    G.spawnT = 0.45;
  }
  if (G.pitBossT > 0) { G.pitBossT -= dt; if (G.pitBossT <= 0) spawnPitBoss(); }
  if (!G.toSpawn.length && enemies.length === 0 && !G.boss && !(G.pitBossT > 0)) {
    G.waveActive = false;
    if (G.mod) { pushFeed(G.mod.name + ' CLEARED · ×' + G.mod.mult + ' SCORE', 'cool'); G.mod = null; G.modDiff = null; G.lowgrav = false; }
    G.breakT = 3.5;
    heal(30);
    addStyle(100, 'WAVE CLEAR', null, 'big');
    pushFeed('+30 HP', 'heal');
    banner('WAVE CLEAR');
    killCam(0.6, 0.3);
  }
}
let bannerT = 0;
function banner(text) {
  const b = $('banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(bannerT);
  bannerT = setTimeout(() => b.classList.remove('show'), 1600);
}

// ---------------------------------------------------------------- HUD
const ui = { hp: -1, rank: -1, pips: '', fresh: '', weapon: -1, score: -1 };
function updateHUD() {
  const hp = Math.ceil(P.hp);
  if (hp !== ui.hp) {
    ui.hp = hp;
    $('hpFill').style.width = `${P.hp}%`;
    $('hpText').textContent = hp;
  }
  const sc = Math.floor(G.score);
  if (sc !== ui.score) { ui.score = sc; $('score').textContent = sc.toLocaleString(); }
  // pips
  const pipEls = document.querySelectorAll('.pip');
  pipEls.forEach((el, i) => {
    if (i === 3) el.style.display = maxPips() > 3 ? '' : 'none';
    let f = el.firstElementChild;
    if (!f) { f = document.createElement('i'); el.appendChild(f); }
    f.style.width = `${clamp(P.pips - i, 0, 1) * 100}%`;
    f.style.opacity = P.pips - i >= 1 ? 1 : 0.45;
  });
  // style
  const idx = rankIndex(ST.points);
  ST.idx = idx;
  const R = RANKS[idx];
  const rankEl = $('rank');
  if (idx !== ui.rank) {
    if (idx > ui.rank && ui.rank >= 0) {
      sfx.rankUp();
      if (music && idx >= 4) music.stinger(idx === RANKS.length - 1 ? 2 : 1);
      vsRank(idx);
      rankEl.classList.remove('pop'); void rankEl.offsetWidth; rankEl.classList.add('pop');
      if (idx === RANKS.length - 1) banner('RUBBLEMAKER');
    }
    ui.rank = idx;
    rankEl.textContent = R.l;
    rankEl.classList.toggle('top', idx === RANKS.length - 1);
    $('rankName').textContent = R.n;
    G.bestRank = Math.max(G.bestRank, idx);
  }
  const col = idx === RANKS.length - 1 ? `hsl(${(G.time * 160) % 360},100%,62%)` : R.c;
  rankEl.style.color = col;
  $('style').style.color = col;
  $('rankName').style.color = col;
  const next = RANKS[idx + 1];
  const frac = next ? (ST.points - R.need) / (next.need - R.need) : (ST.points - R.need) / (STYLE_MAX - R.need);
  $('styleFill').style.width = `${clamp(frac, 0, 1) * 100}%`;
  $('style').style.opacity = ST.points > 1 || feedEl.children.length ? 1 : 0;
  // weapon + freshness
  if (W.cur !== ui.weapon || W.variant[W.cur] !== ui.variant) {
    ui.weapon = W.cur; ui.variant = W.variant[W.cur];
    const vd = VARIANTS[W.cur][W.variant[W.cur]];
    $('weaponName').innerHTML = `${WNAMES[W.cur]} <span style="color:${vd.css}">${vd.name}</span>`;
  }
  let alt = '';
  if (W.cur === 0 && W.variant[0] === 2) { const n = Math.floor(W.coins); alt = 'COINS ' + '●'.repeat(n) + '○'.repeat(4 - n); }
  else if (W.cur === 1 && W.variant[1] === 1) alt = 'PRESSURE ' + '▮'.repeat(W.pump) + '▯'.repeat(3 - W.pump);
  else if (W.cur === 1 && W.variant[1] === 2) alt = W.sawCD > 0 ? 'SAW ··· ' : 'SAW READY';
  else if (W.cur === 2 && W.variant[2] === 0) alt = 'MAGNETS ' + '◆'.repeat(3 - magnets.length) + '◇'.repeat(magnets.length);
  else if (W.cur === 2 && W.variant[2] === 1) { const n = Math.round(W.heat * 5); alt = (W.overheat > 0 ? 'OVERHEAT ' : 'HEAT ') + '▮'.repeat(n) + '▯'.repeat(5 - n); }
  else if (W.cur === 3) alt = W.variant[3] === 1 ? 'LIMPETS ' + bricks.filter((b) => b.kind === 'limpet').length + ' · ALT DETONATES' : (W.altCD > 0 ? (W.variant[3] ? 'FAN' : 'CLUSTER') + ' ···' : (W.variant[3] ? 'FAN' : 'CLUSTER') + ' READY');
  if (W.cur === 4) alt = flailAlt();
  if (W.arm === 'shock' && W.shockCharge > 0) alt = 'CHARGE ' + '▮'.repeat(Math.round(W.shockCharge * 5));
  if (alt !== ui.alt) { ui.alt = alt; $('altInfo').textContent = alt; }
  const fi = freshInfo(fresh[['revolver', 'shotgun', 'nailgun', 'launcher', 'flail'][W.cur]]);
  if (fi.name !== ui.fresh) { ui.fresh = fi.name; const f = $('fresh'); f.textContent = fi.name; f.className = fi.name; }
  // charge bar
  $('charge').style.opacity = W.charging || FLAIL.held ? 1 : 0;
  const chv = FLAIL.held ? FLAIL.wind : W.charge;
  $('chargeFill').style.width = `${chv * 100}%`;
  $('chargeFill').style.background = chv >= 1 ? '#ffffff' : FLAIL.held ? '#ffb03a' : '#6ad8ff';
  // hurt vignette
  P.hurtFlash = Math.max(0, P.hurtFlash - 0.04);
  $('hurt').style.opacity = Math.max(P.hurtFlash, P.hp < 30 ? 0.35 + Math.sin(G.time * 6) * 0.15 : 0);
}
