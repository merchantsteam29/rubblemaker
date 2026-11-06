'use strict';
// ================================================================ DUELISTS + DIALOG
const DUEL_LINES = {
  shard: { intro: 'Oh! A visitor! Shall we dance, darling?', 75: 'Ow, rude! Lovely footwork though.', 50: "I'm... cracking up! Hah!", 25: 'Every pane has its limit, it seems...', win: 'Take my blade, dear. Mind the edges.' },
  bertha: { intro: 'IN THIS CORNER... THE CHAMP! Let\'s RUMBLE!', 75: 'HAH! That tickled!', 50: "NOW we're WRESTLING!", 25: 'Ooh, the crowd LOVES you!', win: 'What a MATCH! Here, you earned the FIST!' },
  kite: { intro: 'Oi, bricky! Too slow to catch me!', 75: 'Lucky shot. Bet you can\'t do it again!', 50: 'Okay okay, you\'re kinda good!', 25: 'Hey! Watch the hat!', win: "Fine! Take the hook. Don't fall off anything." },
};
let dlgT = 0;
function sayLine(who, text) {
  const d = $('dialog');
  d.querySelector('b').textContent = who;
  const span = d.querySelector('span');
  span.textContent = '';
  d.classList.add('show');
  let i = 0;
  clearInterval(d._typer);
  d._typer = setInterval(() => { span.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(d._typer); }, 22);
  clearTimeout(dlgT);
  dlgT = setTimeout(() => d.classList.remove('show'), 3600);
  sfx.ting();
}
function duelChatter(e) {
  const lines = DUEL_LINES[e.type];
  if (!lines) return;
  e.said = e.said || {};
  const pct = (e.hp / e.maxHp) * 100;
  for (const th of [75, 50, 25]) if (pct < th && !e.said[th]) { e.said[th] = true; sayLine(e.def.short, lines[th]); }
}
function updateDuelist(e, dt) {
  const p = e.mesh.position, def = e.def, k = e.type;
  if (!e.said) { e.said = {}; setTimeout(() => { if (!e.dead) sayLine(def.short, DUEL_LINES[k].intro); }, 2200); }
  duelChatter(e);
  const rage = e.hp < e.maxHp * 0.5 ? 1.3 : 1;
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  const eye = playerEye();
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0;
  if (k === 'kite') { updateKite(e, dt, rage); return; }
  if (k === 'tumble' || k === 'twirl') { updateTwin(e, dt, rage); return; }
  if (k === 'cat') { updateCat(e, dt, rage); return; }
  if (e.state !== 'dash' && e.state !== 'charge') e.mesh.rotation.y = Math.atan2(dx, dz);
  const sp = def.speed * rage * DIFF().speed;
  if (e.state === 'chase') {
    if (k === 'shard' || k === 'gilded') {
      e.strafeT -= dt;
      if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rand(1, 2.5); }
      const want = dist > 10 ? 1 : dist < 6 ? -1 : 0;
      mx = (nx * want - nz * e.strafe) * sp; mz = (nz * want + nx * e.strafe) * sp;
    } else { mx = nx * sp; mz = nz * sp; }
    if (e.cd <= 0) {
      const r = Math.random();
      if (k === 'shard' || k === 'gilded') e.atk = r < 0.35 ? 'dash' : r < 0.65 ? 'shards' : r < 0.85 || k === 'shard' ? 'stance' : 'pound';
      else e.atk = dist < 3.5 ? 'grab' : r < 0.35 ? 'charge' : r < 0.7 ? 'pound' : 'brick';
      e.wt = { dash: 0.4, shards: 0.6, stance: 0.3, grab: 0.45, charge: 0.6, pound: 0.5, brick: 0.6 }[e.atk] / rage;
      e.state = 'windup'; e.t = e.wt;
      sfx.windup(1);
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      const head = new V3(); e.rig.head.getWorldPosition(head);
      if (e.atk === 'dash' || e.atk === 'charge') {
        e.dashDir = new V3(nx, 0, nz); e.state = e.atk; e.t = e.atk === 'dash' ? 0.4 : 1.2; e.hitDone = false;
        if (e.atk === 'dash') { sfx.dash(); e.dashes = (e.dashes || 0) + 1; } else sfx.bossRoar();
      } else if (e.atk === 'shards') {
        const n = rage > 1 ? 9 : 7;
        const base = Math.atan2(eye.x - head.x, eye.z - head.z);
        const dy = (eye.y - 0.3 - head.y) / Math.max(1, dist);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.13;
          spawnOrb(head.clone(), new V3(Math.sin(a), dy, Math.cos(a)).normalize().multiplyScalar(19), 12, { color: 0x9ae8ff });
        }
        sfx.orb(1);
        e.state = 'recover'; e.t = 0.5;
      } else if (e.atk === 'stance') {
        e.state = 'stance'; e.t = 1.4;
        sayLine(def.short, Math.random() < 0.5 ? 'En garde!' : 'Go on, shoot me. I dare you.');
      } else if (e.atk === 'grab') {
        if (dist < 3.8 && P.pos.y - p.y < 2.5) { hurtPlayer(30, new V3(nx * 6, 16, nz * 6)); sayLine(def.short, 'SUPLEX!'); }
        e.state = 'recover'; e.t = 0.8;
      } else if (e.atk === 'pound') {
        e.state = 'rise'; e.t = 0.9;
      } else if (e.atk === 'brick') {
        for (let i = -1; i <= 1; i++) {
          const tgt = P.pos.clone().add(new V3(i * 2.5, 0, rand(-1, 1)));
          const fl = 1.1;
          const v = tgt.sub(head).divideScalar(fl); v.y += 0.5 * 20 * fl;
          spawnOrb(head.clone(), v, 15, { grav: 20, boom: 2.6, color: 0xb8543a, big: true });
        }
        sfx.throwCore();
        e.state = 'recover'; e.t = 0.7;
      }
    }
  } else if (e.state === 'dash' || e.state === 'charge') {
    const speed = e.state === 'dash' ? 26 : 20;
    e.mesh.rotation.y = Math.atan2(e.dashDir.x, e.dashDir.z);
    mx = e.dashDir.x * speed * rage; mz = e.dashDir.z * speed * rage;
    if (!e.hitDone && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < def.r + 1.2 && P.pos.y - p.y < 3) {
      e.hitDone = true;
      if (P.dashT > 0 || P.invuln > 0) addStyle(50, 'DODGE', null, 'cool');
      else hurtPlayer(e.state === 'dash' ? 20 : 28, e.dashDir.clone().multiplyScalar(14).setY(7));
    }
    if (e.t <= 0) {
      if (e.state === 'dash' && rage > 1 && e.dashes % 2 === 1) { e.state = 'windup'; e.atk = 'dash'; e.wt = e.t = 0.25; }
      else { e.state = 'recover'; e.t = 0.6; }
    }
  } else if (e.state === 'stance') {
    w = 0.5 + Math.sin(G.time * 20) * 0.5;
    if (e.t <= 0) { e.state = 'chase'; e.cd = rand(1, 2); }
  } else if (e.state === 'rise') {
    e.vel.y = Math.max(e.vel.y, 0);
    p.y += dt * 9;
    mx = nx * Math.min(18, dist * 3); mz = nz * Math.min(18, dist * 3);
    if (e.t <= 0) { e.state = 'drop'; }
  } else if (e.state === 'drop') {
    p.y -= dt * 30;
    if (p.y <= 0.05) {
      p.y = 0;
      shockwave(p.clone(), 15, 30, 25, false);
      ringFx(p.clone(), 6, 0xff8a2a); burst(p.clone().setY(0.3), 26, 0x8a7a6a, 11, 0.3, 0.9); rubble(p, 8);
      sfx.heavySlam(1); G.shake = Math.max(G.shake, 0.8);
      if (dist < 5.5) hurtPlayer(30, new V3(nx * 12, 9, nz * 12));
      e.state = 'recover'; e.t = 0.9;
    }
  } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(0.6, 1.4) / rage; }
  if (e.state === 'rise' || e.state === 'drop') {
    p.x += mx * dt; p.z += mz * dt; enemyCollide(e);
  } else enemyPhysics(e, mx, mz, dt);
  const moving = Math.hypot(mx, mz) > 0.5;
  if (moving) e.walk += dt * (e.state === 'dash' ? 14 : 5);
  const real = e.state;
  if (real === 'stance') e.state = 'windup'; else if (real !== 'windup' && real !== 'recover') e.state = 'chase';
  animateEnemy(e, dt, moving, real === 'stance' ? 0.9 : w, G.time);
  e.state = real;
  applyFlash(e, real === 'stance' ? 0.6 : w);
  if (e.rig.sword) e.rig.sword.rotation.x = real === 'stance' ? -1.4 : 0;
}
function updateKite(e, dt, rage) {
  const p = e.mesh.position, room = e.room;
  const cx = room ? room.cx : 0, cz = room ? room.cz : 0, R = room ? Math.min(room.w, room.d) / 2 - 3 : 12;
  if (!e.anchor) { e.anchor = p.clone(); e.state = 'perch'; e.t = 1.5; }
  const eye = playerEye();
  let w = 0;
  if (e.state === 'perch') {
    p.lerp(e.anchor, 1 - Math.exp(-dt * 8));
    if (e.t <= 0) {
      const r = Math.random();
      if (r < 0.45) { e.state = 'windup'; e.atk = 'soot'; e.wt = e.t = 0.5 / rage; }
      else if (r < 0.75) { e.state = 'windup'; e.atk = 'dive'; e.wt = e.t = 0.45 / rage; sfx.screech(1); }
      else e.state = 'swing';
      if (e.state === 'swing') startSwing(e, cx, cz, R);
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      if (e.atk === 'soot') {
        for (let i = 0; i < (rage > 1 ? 3 : 2); i++) {
          const tgt = P.pos.clone().add(new V3(rand(-2, 2), 0, rand(-2, 2)));
          const fl = 0.9; const v = tgt.sub(p).divideScalar(fl); v.y += 0.5 * 20 * fl;
          spawnOrb(p.clone(), v, 12, { grav: 20, boom: 3, color: 0x2a2a2a });
        }
        sfx.throwCore();
        startSwing(e, cx, cz, R);
      } else { e.state = 'dive'; e.diveDir = eye.clone().sub(p).normalize(); e.t = 1.0; e.hitDone = false; }
    }
  } else if (e.state === 'swing') {
    e.st += dt / (e.dur / rage);
    const t = Math.min(1, e.st);
    const a = e.from, b = e.to;
    p.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 3.5, a.z + (b.z - a.z) * t);
    const bm = enemyBeam(e, 0xc8a070);
    setBeam(bm, p.clone().setY(p.y + 1.2), e.pivotPt, 0.02);
    if (t >= 1) { bm.visible = false; e.anchor = b.clone(); e.state = 'perch'; e.t = rand(0.6, 1.2) / rage; }
  } else if (e.state === 'dive') {
    p.addScaledVector(e.diveDir, dt * 24 * rage);
    if (!e.hitDone && p.distanceTo(new V3(P.pos.x, P.pos.y + 0.9, P.pos.z)) < 1.6) {
      e.hitDone = true;
      if (P.dashT > 0 || P.invuln > 0) addStyle(50, 'DODGE', null, 'cool');
      else hurtPlayer(18, e.diveDir.clone().multiplyScalar(10).setY(5));
    }
    if (e.t <= 0 || p.y < 0.4) { p.y = Math.max(p.y, 0.4); e.state = 'grounded'; e.t = 1.0; sayLine('KITE', Math.random() < 0.5 ? 'Whoops!' : 'Ow, my knees!'); }
  } else if (e.state === 'grounded') {
    p.y = Math.max(0, p.y - dt * 4);
    if (e.t <= 0) startSwing(e, cx, cz, R);
  }
  enemyCollide(e);
  e.grounded = e.state === 'grounded';
  e.mesh.rotation.y = Math.atan2(P.pos.x - p.x, P.pos.z - p.z);
  e.walk += dt * 6;
  const real = e.state;
  e.state = real === 'windup' ? 'windup' : 'chase';
  animateEnemy(e, dt, real === 'swing', w, G.time);
  e.state = real;
  applyFlash(e, w);
}
function startSwing(e, cx, cz, R) {
  const a = Math.random() * Math.PI * 2;
  e.from = e.mesh.position.clone();
  e.to = new V3(cx + Math.cos(a) * R * rand(0.5, 1), rand(4.5, 6.5), cz + Math.sin(a) * R * rand(0.5, 1));
  e.pivotPt = e.from.clone().add(e.to).multiplyScalar(0.5).setY(14);
  e.st = 0; e.dur = 1.2;
  e.state = 'swing';
  sfx.dash();
}
function duelReward(e) {
  const lv = G.level;
  if (!lv || !lv.duel) return;
  if (DUEL_LINES[e.type]) sayLine(e.def.short, DUEL_LINES[e.type].win);
  const id = duelPrize(lv.duel);
  const p = loadProgress();
  p.owned = p.owned || [];
  const fresh = !p.owned.includes(id);
  if (fresh) { p.owned.push(id); saveProgress(p); }
  setTimeout(() => {
    banner(fresh ? prizeBanner(lv.duel) : 'DUEL WON');
    if (fresh && UPGRADE_HINT[lv.duel]) showHint(UPGRADE_HINT[lv.duel]());
    const skinK = lv.duel === 'gold' ? 'gold' : lv.duel.startsWith('skin:') ? lv.duel.slice(5) : null;
    if (fresh && skinK) { settings.skin = skinK; saveSettings(); applySkin(); showHint(`Your guns now wear ${SKINS[skinK].name} · change skins at the FORGE`); }
    if (fresh && ARM_NAMES[lv.duel]) { showHint(`Press ${actLabel('arm')} to switch arms · ${ARM_NAMES[lv.duel]} is now yours`); W.arm = lv.duel; updateArmSlot(); }
  }, 1800);
}

// ================================================================ LEVEL SELECT (difficulty + duels)
function bestKey(lv) { return settings.difficulty === 'normal' ? lv.id : `${lv.id}:${settings.difficulty}`; }
function duelUnlocked(lv, prog) {
  if (lv.skulls) return skullCount(prog) >= TOTAL_SKULLS;
  const idx = LEVELS.findIndex((x) => x.id === lv.unlockAfter);
  return prog.unlocked > idx || (!!lv.orArm && (prog.owned || []).includes(duelPrize(lv.orArm)));
}
function renderLevels() {
  const prog = loadProgress();
  const diffRow = `<div class="diffRow">${Object.entries(DIFFS).map(([k, d]) => `<button data-diff="${k}" class="${settings.difficulty === k ? 'on' : ''}">${d.label}</button>`).join('')}<span>best ranks are kept per difficulty · scrap ×${DIFF().scrap}</span>${ngUnlocked() ? `<button data-ng class="ng ${settings.ngplus ? 'on' : ''}">HARD MODE ${settings.ngplus ? 'ON' : 'OFF'}</button>` : ''}</div>`;
  const card = (l) => {
    const idx = LEVELS.findIndex((x) => x.id === l.id);
    const locked = l.duel ? !duelUnlocked(l, prog) : idx > prog.unlocked;
    const b = prog.best[bestKey(l)];
    const won = l.duel && (prog.owned || []).includes(duelPrize(l.duel));
    return `<button class="lvl ${l.boss ? 'boss' : ''} ${l.duel ? 'duel' : ''}" data-idx="${idx}" ${locked ? 'disabled' : ''}><b>${l.id}${prog.skulls && prog.skulls[l.id] ? ' <u title="skull found">☠</u>' : ''}</b><i>${locked ? (l.duel ? (l.skulls ? `FIND ALL SKULLS (${skullCount(prog)}/${TOTAL_SKULLS})` : 'BEAT ' + l.unlockAfter + (l.orArm ? ' OR THE LAST DUEL' : '')) : 'LOCKED') : l.name}</i>${b ? `<em class="g${GRADE_SHORT[b.rank]}">${GRADE_SHORT[b.rank]}</em><small>BEST ${fmtTime(b.time)}</small>` : ''}${l.duel ? `<small>${won ? 'REWARD EARNED' : 'REWARD: ' + prizeName(l.duel)}</small>` : ''}</button>`;
  };
  $('sceneList').innerHTML = `<div class="scrapLine">◆ ${prog.scrap || 0} SCRAP · spend it at the FORGE in any level's start room</div>` + diffRow +
    SCENES.map((sc, si) => `<div class="scene act"><h3><span>${ACT_NAMES[si]}</span>${sc.name}</h3>` + [...new Set(sc.levels.map(layerOf))].map((ln) => `<div class="layer"><h4><span>LAYER ${ln}</span>${LAYER_NAMES[ln] || ''}</h4><div class="grid">${sc.levels.filter((l) => layerOf(l) === ln).map(card).join('')}</div></div>`).join('') + '</div>').join('') +
    `<div class="scene"><h3><span>SECRET</span>DUELS</h3><div class="grid">${DUELS.map(card).join('')}</div></div>` +
    `<div class="scene prime"><h3><span>PRIME</span>BOSS REMATCHES</h3><div class="grid">${PRIMES.map(card).join('')}</div></div>` +
    `<div class="scene lore"><h3><span>SECRETS</span>☠ ${skullCount(prog)} / ${TOTAL_SKULLS} SKULLS · LORE ${Object.keys(prog.lore || {}).length} / ${Object.keys(LORE).length}</h3>${Object.keys(LORE).filter((k) => (prog.lore || {})[k]).map((k) => `<p><b>${k}</b> ${LORE[k]}</p>`).join('') || '<p>Cracked walls hide skulls, notes and gun skins. Blow them open.</p>'}</div>`;
  $('sceneList').querySelectorAll('.lvl').forEach((b) => b.addEventListener('click', () => startLevel(Number(b.dataset.idx))));
  $('sceneList').querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => { settings.difficulty = b.dataset.diff; saveSettings(); renderLevels(); }));
  $('sceneList').querySelectorAll('[data-ng]').forEach((b) => b.addEventListener('click', () => { settings.ngplus = !settings.ngplus; saveSettings(); renderLevels(); }));
}
updateArmSlot();

Object.assign(EPITHETS, { shard: ['DUEL', 'THE STAINED-GLASS SAINT'], bertha: ['DUEL', 'CHAMPION OF THE CELLAR RING'], kite: ['DUEL', 'TERROR OF THE ROOFTOPS'] });
applyVariantLook();
