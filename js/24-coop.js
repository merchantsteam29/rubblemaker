'use strict';
// ================================================================ BATCH 9.3: MASON'S LODGE · CO-OP CAMPAIGN
// Two golems, one level, over the race's PeerJS link (VS.conn).
//  · The HOST runs the fight: rooms, waves, bosses. Every enemy it makes gets a network id (nid) and is announced.
//  · The PARTNER mirrors it: its own room logic is off, enemies only appear when the host says so, and they are
//    pulled towards the host's positions ~10× a second. Each side still runs the enemy AI locally, so attacks feel live.
//  · Enemies chase whichever golem is closer. A copy chasing the other golem is only for show: damage to a player is
//    always worked out on that player's own machine.
//  · Hits are reported both ways (hp lost, shield broken, layers stripped); a kill on either side kills it on both.
//  · At 0 HP you go DOWN instead of dying: your partner stands over you to lift you. Both down = the room resets.
CO = {
  active: false, host: false, level: 0, diff: 'normal', nid: 1, allow: 0, quiet: 0, noEcho: 0, swap: false, batch: null, nidQ: [],
  down: false, downT: 0, revT: 0, wipeT: 0, sendT: 0, snapT: 0, enterCD: 0, flash: 0, shots: 0, remoteDone: false,
  mate: null,
};
const CO_BLEED = 20, CO_REVIVE = 2, CO_REACH = 2.6;
const coMat = new THREE.MeshStandardMaterial({ color: 0x7c7268, roughness: 0.9, metalness: 0.05, emissive: 0x000000 });
const coBeaconMat = new THREE.SpriteMaterial({ map: GLOW, color: 0x6ad8ff, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true });
const r2 = (v) => Math.round(v * 100) / 100;
const coEligible = (l) => !!l && !l.duel && !l.prime && !l.race;
function coSend(m) { vsSend(m); }
function coFind(n) { if (!n) return null; for (const e of enemies) if (e.nid === n) return e; return null; }
function coQuiet(fn) { CO.quiet++; const k = G.kills; try { fn(); } finally { CO.quiet--; G.kills = k; } }
function coNewMate() { return { pos: null, tgt: null, yaw: 0, pitch: 0, hp: 100, down: false, rv: 0, bo: 0, ps: false, f: 0, mesh: null, beacon: null, walk: 0, seen: 0 }; }
CO.mate = coNewMate();

// ---------------------------------------------------------------- starting / ending
function coLevels(all) {
  const un = loadProgress().unlocked || 0;
  return LEVELS.map((l, i) => [l, i]).filter(([l, i]) => coEligible(l) && (all || i <= un));
}
function coStart() { // host, from the lodge
  if (!VS.host || !VS.connected) return;
  VS.level = Number($('vsLevel').value);
  coGo(VS.level);
}
function coGo(idx) {
  coSend({ t: 'co.go', idx, diff: settings.difficulty });
  coBegin(idx, settings.difficulty, true);
}
function coBegin(idx, diff, host) {
  if (!LEVELS[idx]) return;
  coClearMate();
  Object.assign(CO, { active: true, host: !!host, level: idx, diff: diff || 'normal', nid: 1, allow: 0, quiet: 0, noEcho: 0, swap: false, batch: null, nidQ: [],
    down: false, downT: 0, revT: 0, wipeT: 0, sendT: 0, snapT: 0, enterCD: 0, flash: W.flashT, shots: 0, remoteDone: false, mate: coNewMate() });
  VS.active = false;
  for (const id of ['versus', 'vsResult', 'complete', 'over', 'pause', 'shop', 'settings', 'levels', 'menu']) show(id, false);
  startLevel(idx);
  G.modDiff = DIFFS[CO.diff] || DIFFS.normal; // the host's difficulty for both
  coMakeMate();
  show('coHud', true); show('coDown', false);
  coHud();
  banner(`CO-OP · ${LEVELS[idx].id} ${LEVELS[idx].name}`);
  if (!CO.host) showHint('CO-OP · the host leads the fight · walk into a room together, or you get pulled in');
}
function coMakeMate() {
  if (CO.mate.mesh) return;
  coMat.emissive.setHex(RIVAL_GLOW || 0x3ac8ff); coMat.emissiveIntensity = 0.16;
  const m = ghostModel(coMat);
  m.visible = false;
  const b = new THREE.Sprite(coBeaconMat.clone());
  b.material.color.setHex(RIVAL_GLOW || 0x6ad8ff);
  b.scale.set(0.9, 0.9, 1); b.renderOrder = 20;
  scene.add(b);
  CO.mate.mesh = m; CO.mate.beacon = b;
}
function coClearMate() {
  const M = CO.mate;
  if (M && M.mesh) scene.remove(M.mesh);
  if (M && M.beacon) { scene.remove(M.beacon); M.beacon.material.dispose(); }
  if (M) { M.mesh = null; M.beacon = null; }
}
function coCleanup() {
  CO.active = false; CO.down = false; CO.swap = false; CO.allow = 0; CO.quiet = 0; CO.noEcho = 0; CO.batch = null;
  coClearMate();
  for (const id of ['coHud', 'coDown', 'coPauseNote']) show(id, false);
  coResultsUI(false);
}
// the partner left mid-level: keep going alone (the room logic just switches back on)
function coSolo(msg) {
  if (!CO.active) return;
  const inLevel = G.state === 'play' || G.state === 'pause' || G.state === 'shop' || G.state === 'settings';
  if (CO.down) coStandUp(30);
  coCleanup();
  if (inLevel) { banner('PARTNER LEFT'); showHint(msg + ' · you carry on solo'); }
  else if (G.state === 'complete') { $('completeLevel').textContent = msg; }
}
// both back to the lodge, link kept
function coToLodge(tell) {
  if (tell) coSend({ t: 'co.lobby' });
  coCleanup();
  toMenu();
  openVersus();
}

// ---------------------------------------------------------------- enemies: spawning
const _co_makeEnemy = makeEnemy;
makeEnemy = function (type, x, z, y = 0) {
  if (CO.active && !CO.host && !CO.allow) {
    // the partner never spawns on its own (boss summons etc.): the host's copy will be announced
    const e = _co_makeEnemy(type, x, z, y);
    e.dead = true; scene.remove(e.mesh); removeEnemyFx(e);
    return e;
  }
  const e = _co_makeEnemy(type, x, z, y);
  if (!CO.active) return e;
  if (CO.host) {
    e.nid = CO.nid++;
    if (CO.batch) CO.batch.push(e.nid);
    else coSend({ t: 'co.sp', n: e.nid, ty: type, x: r2(x), z: r2(z), y: r2(y), el: e.elite || 0 });
  } else e.nid = CO.nidQ.length ? CO.nidQ.shift() : 0;
  return e;
};
const _co_maybeElite = maybeElite;
maybeElite = function (e) { if (CO.active && !CO.host) return; _co_maybeElite(e); };
const _co_spawnBoss = spawnBoss;
spawnBoss = function (room) {
  if (!CO.active) return _co_spawnBoss(room);
  if (!CO.host) { if (CO.allow) _co_spawnBoss(room); return; }
  CO.batch = [];
  try { _co_spawnBoss(room); } finally {
    const n = CO.batch; CO.batch = null;
    coSend({ t: 'co.boss', r: G.layout.rooms.indexOf(room), n });
  }
};

// ---------------------------------------------------------------- enemies: who do they chase
const _co_updateEnemies = updateEnemies;
updateEnemies = function (dt) {
  const M = CO.mate;
  if (!CO.active || !M.pos || !enemies.length) { _co_updateEnemies(dt); coCorrect(dt); return; }
  const mine = [], theirs = [];
  for (const e of enemies) {
    if (e.dead) { mine.push(e); continue; }
    const p = e.mesh.position;
    const dMe = Math.hypot(P.pos.x - p.x, P.pos.z - p.z), dMate = Math.hypot(M.pos.x - p.x, M.pos.z - p.z);
    let t = e.coT || 'me';
    if (CO.down && !M.down) t = 'mate';
    else if (M.down && !CO.down) t = 'me';
    else if (t === 'me' && dMate < dMe - 3) t = 'mate';
    else if (t === 'mate' && dMe < dMate - 3) t = 'me';
    e.coT = t;
    (t === 'mate' ? theirs : mine).push(e);
  }
  if (!theirs.length) { _co_updateEnemies(dt); coCorrect(dt); return; }
  enemies.length = 0; enemies.push(...mine);
  _co_updateEnemies(dt);
  const a = enemies.slice();
  enemies.length = 0; enemies.push(...theirs);
  // run these with the partner standing where the player is; nothing they do can touch the real player
  const sv = { pos: P.pos.clone(), vel: P.vel.clone(), hp: P.hp, gr: P.grounded, dash: P.dashT, inv: P.invuln, sl: P.sliding };
  P.pos.copy(M.pos); P.vel.set(0, 0, 0); CO.swap = true;
  try { _co_updateEnemies(dt); } finally {
    CO.swap = false;
    P.pos.copy(sv.pos); P.vel.copy(sv.vel); P.hp = sv.hp; P.grounded = sv.gr; P.dashT = sv.dash; P.invuln = sv.inv; P.sliding = sv.sl;
  }
  const b = enemies.slice();
  enemies.length = 0; enemies.push(...a, ...b);
  coCorrect(dt);
};
// the partner's enemies slide towards where the host has them
function coCorrect(dt) {
  if (!CO.active || CO.host) return;
  const k = 1 - Math.exp(-dt * 7);
  for (const e of enemies) {
    if (e.dead || !e.coTgt || e.spawnT > 0) continue;
    const p = e.mesh.position, t = e.coTgt;
    const far = Math.hypot(t[0] - p.x, t[2] - p.z) > 7;
    if (far) { p.x = t[0]; p.z = t[2]; p.y = t[1]; }
    else { p.x += (t[0] - p.x) * k; p.z += (t[2] - p.z) * k; if (e.def.fly || Math.abs(t[1] - p.y) > 1.5) p.y += (t[1] - p.y) * k; }
  }
}

// ---------------------------------------------------------------- enemies: damage + kills, both ways
const _co_damageEnemy = damageEnemy;
damageEnemy = function (e, dmg, info) {
  if (!CO.active || CO.quiet || !e || !e.nid) return _co_damageEnemy(e, dmg, info);
  const hp0 = e.hp, sh0 = e.shieldUp, ly0 = e.layers, dead0 = e.dead;
  const r = _co_damageEnemy(e, dmg, info);
  if (!dead0 && !e.dead) {
    const d = hp0 - e.hp, sb = sh0 && !e.shieldUp ? 1 : 0, ls = Math.max(0, ly0 - e.layers);
    if (d > 0 || sb || ls) coSend({ t: 'co.dmg', n: e.nid, d: Math.round(d * 10) / 10, sb, ls });
  }
  return r;
};
const _co_killEnemy = killEnemy;
killEnemy = function (e, info) {
  _co_killEnemy(e, info || {});
  if (CO.active && e.nid && !CO.noEcho) coSend({ t: 'co.kill', n: e.nid });
};
function coRemoteDamage(m) {
  const e = coFind(m.n);
  if (!e || e.dead) return;
  coQuiet(() => {
    if (m.sb && e.shieldUp) breakShield(e, null);
    for (let k = 0; k < (m.ls | 0) && e.layers > 0; k++) stripLayer(e);
    const d = +m.d || 0;
    if (d > 0) {
      e.hp -= d; e.flash = 0.07;
      const pt = e.mesh.position.clone(); pt.y += e.def.h * 0.6;
      burst(pt, Math.min(8, 2 + (d / 10) | 0), 0x9a0e0a, 5, 0.1, 0.4, false, 1, 0.6);
    }
    if (e.hp <= 0) killEnemy(e, { weapon: null, remote: true }); // echoes, so the sender's copy dies too
  });
}
function coRemoteKill(m) {
  const e = coFind(m.n);
  if (!e || e.dead) return;
  CO.noEcho++;
  try { coQuiet(() => killEnemy(e, { weapon: null, remote: true })); } finally { CO.noEcho--; }
}
function coVanish(e) { // silently remove an enemy the host no longer has
  e.dead = true; scene.remove(e.mesh); removeEnemyFx(e);
  if (G.boss === e) { G.boss = null; show('bossBar', false); hideBeam(); }
}
// partner credit stays with the partner: no style, heal, stats or kill count for the other golem's work
const _co_addStyle = addStyle;
addStyle = function (...a) { if (CO.quiet) return; return _co_addStyle(...a); };
const _co_heal = heal;
heal = function (n) { if (CO.quiet) return; return _co_heal(n); };
const _co_statKill = statKill;
statKill = function (e, info) { if (CO.quiet) return; return _co_statKill(e, info); };

// ---------------------------------------------------------------- rooms
function coRoomIdx(r) { return G.layout ? G.layout.rooms.indexOf(r) : -1; }
const _co_startRoom = startRoom;
startRoom = function (r) {
  _co_startRoom(r);
  if (CO.active && CO.host) { coSend({ t: 'co.room', i: coRoomIdx(r), s: 'a' }); coPullIn(r); }
};
const _co_clearRoom = clearRoom;
clearRoom = function (r) {
  _co_clearRoom(r);
  if (CO.active && CO.host) coSend({ t: 'co.room', i: coRoomIdx(r), s: 'c' });
};
function coPullIn(r) {
  if (insideRoom(r, 1.0)) return;
  const entry = r.doors.find((d) => d.door && d.door.b === r) || r.doors[0];
  if (!entry) return;
  const D = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[entry.side];
  const half = D[0] ? r.w / 2 : r.d / 2;
  P.pos.set(r.cx + D[0] * (half - 2.5), 0.05, r.cz + D[1] * (half - 2.5));
  P.vel.set(0, 0, 0); P.yaw = Math.atan2(D[0], D[1]);
  fxFlash(0x6ad8ff, 0.2); sfx.portal();
  banner('PULLED INTO THE FIGHT');
}
// the partner's level loop: everything but starting rooms and spawning
const _co_updateCampaign = updateCampaign;
updateCampaign = function (dt) {
  if (!CO.active || CO.host) return _co_updateCampaign(dt);
  const L = G.layout;
  if (!L) return;
  G.levelTime += dt;
  srTick();
  hudTimerT -= dt;
  if (hudTimerT <= 0) { hudTimerT = 0.2; $('wave').textContent = `${G.level.id} · ${fmtTime(G.levelTime)}`; }
  CO.enterCD -= dt;
  const busy = L.rooms.some((r) => r.state === 'active');
  for (const r of L.rooms) {
    if (!r.visited && insideRoom(r, 0.5)) { r.visited = true; if (r.hint) showHint(r.hint); }
    if (r.state === 'idle' && !busy && CO.enterCD <= 0 && insideRoom(r, 1.8)) { coSend({ t: 'co.enter', i: coRoomIdx(r) }); CO.enterCD = 0.5; }
  }
  if (G.portal) {
    const pt = G.portal;
    pt.ring.rotation.z += dt * 1.5; pt.ring2.rotation.z -= dt * 2.2; pt.stones.rotation.z += dt * 0.3;
    pt.disc.material.opacity = 0.35 + Math.sin(G.time * 4) * 0.12;
    pt.g.rotation.y = Math.atan2(P.pos.x - pt.x, P.pos.z - pt.z);
    if (Math.hypot(P.pos.x - pt.x, P.pos.z - pt.z) < 1.9 && P.pos.y < 4) completeLevel();
  }
};

// ---------------------------------------------------------------- going down, getting up
const _co_gameOver = gameOver;
gameOver = function () {
  if (CO.active && CO.down) return;
  if (CO.active && G.mode === 'campaign' && G.state === 'play') { coGoDown(); return; }
  _co_gameOver();
};
const _co_hurtPlayer = hurtPlayer;
hurtPlayer = function (dmg, knock, env) {
  if (CO.active && (CO.swap || CO.down)) return false;
  return _co_hurtPlayer(dmg, knock, env);
};
const _co_updatePlayer = updatePlayer;
updatePlayer = function (dt) {
  if (!CO.active || !CO.down) return _co_updatePlayer(dt);
  // no input while down, but gravity and walls still apply
  keys.clear(); pressed.clear(); VDOWN.clear(); VHIT.clear(); AXIS.x = 0; AXIS.y = 0;
  P.vel.x = 0; P.vel.z = 0;
  _co_updatePlayer(dt);
  P.vel.x = 0; P.vel.z = 0; P.sliding = false; P.slamming = false; P.dashT = 0;
  P.camH += (0.5 - P.camH) * Math.min(1, dt * 6);
  P.roll += (0.35 - P.roll) * Math.min(1, dt * 4);
};
const _co_updateForge = updateForge;
updateForge = function () { if (CO.active && CO.down) { if (promptShown) { promptShown = false; $('prompt').classList.remove('show'); } return; } _co_updateForge(); };
const _co_updateWeapons = updateWeapons;
updateWeapons = function (dt) { if (CO.active && CO.down) { W.charging = false; W.charge = 0; return; } _co_updateWeapons(dt); };
function coGoDown() {
  CO.down = true; CO.downT = CO_BLEED; CO.revT = 0; CO.wipeT = 0;
  P.hp = 0; P.vel.set(0, 0, 0);
  if (typeof FLAIL !== 'undefined' && FLAIL) { FLAIL.held = false; FLAIL.wind = 0; }
  sfx.explode(); fxFlash(0xff2010, 0.35); G.shake = Math.max(G.shake, 0.6);
  banner('YOU ARE DOWN');
  coSend({ t: 'co.st' });
}
function coStandUp(hp) {
  CO.down = false; CO.revT = 0; CO.wipeT = 0;
  Object.assign(P, { hp, invuln: 1.6, camH: 1.6, roll: 0, hurtFlash: 0 });
  show('coDown', false);
}
function coRevived() {
  coStandUp(40);
  banner('BACK ON YOUR FEET');
  sfx.rankUp(); fxFlash(0x6affa0, 0.2);
  coSend({ t: 'co.rev' });
}
function coBleedOut() {
  const M = CO.mate;
  G.deaths++;
  if (statsLive()) { STATS.deaths++; saveStats(); }
  coStandUp(50);
  if (M.pos) { P.pos.set(M.pos.x + 1.2, M.pos.y + 0.1, M.pos.z + 1.2); P.vel.set(0, 0, 0); }
  banner('REBUILT BESIDE YOUR PARTNER');
  showHint('You crumbled before your partner could reach you · +1 death (costs a rank)');
  sfx.portal();
}
// both down: the host resets the room for both
function coWipe() {
  if (!CO.active) return;
  coSend({ t: 'co.wipe' });
  coWipeLocal();
}
function coWipeLocal() {
  G.deaths++;
  if (statsLive()) { STATS.deaths++; saveStats(); }
  coStandUp(100);
  respawnCheckpoint();
  banner('BOTH GOLEMS CRUMBLED · ROOM RESET');
}

// ---------------------------------------------------------------- finishing a level
const _co_completeLevel = completeLevel;
completeLevel = function () {
  if (!CO.active || G.state !== 'play') return _co_completeLevel();
  if (!CO.remoteDone) coSend({ t: 'co.done' });
  if (CO.down) coStandUp(1);
  show('coHud', false); show('coDown', false); show('coPauseNote', false);
  if (CO.mate.mesh) CO.mate.mesh.visible = false;
  if (CO.mate.beacon) CO.mate.beacon.visible = false;
  _co_completeLevel();
  coResultsUI(true);
};
function coNextIdx(i) { for (let j = i + 1; j < LEVELS.length; j++) if (coEligible(LEVELS[j])) return j; return -1; }
function coResultsUI(on) {
  const nx = $('nextBtn'), rt = $('retryBtn'), mb = $('completeMenuBtn');
  if (!mb.dataset.solo) mb.dataset.solo = mb.textContent;
  let note = $('coNote');
  if (!note) { note = document.createElement('p'); note.id = 'coNote'; $('complete').insertBefore(note, nx.parentNode); }
  if (!on) { mb.textContent = mb.dataset.solo; note.textContent = ''; show('coNote', false); show('retryBtn', true); return; }
  const n = coNextIdx(CO.level);
  show('coNote', true);
  if (CO.host) {
    show('nextBtn', n >= 0); if (n >= 0) nx.textContent = `NEXT: ${LEVELS[n].id} ${LEVELS[n].name}`;
    show('retryBtn', true);
    note.textContent = 'CO-OP · you pick what comes next';
    mb.textContent = 'BACK TO THE LODGE';
  } else {
    show('nextBtn', false); show('retryBtn', false);
    note.textContent = 'CO-OP · waiting for the host to pick the next level…';
    mb.textContent = 'LEAVE · BACK TO THE LODGE';
  }
}
// in co-op these buttons talk to the partner instead (capture listeners run before the solo ones)
$('nextBtn').addEventListener('click', (ev) => { if (!CO.active) return; ev.stopImmediatePropagation(); if (CO.host && VS.connected) { const n = coNextIdx(CO.level); if (n >= 0) coGo(n); } }, true);
$('retryBtn').addEventListener('click', (ev) => { if (!CO.active) return; ev.stopImmediatePropagation(); if (CO.host && VS.connected) coGo(CO.level); }, true);
$('completeMenuBtn').addEventListener('click', (ev) => { if (!CO.active) return; ev.stopImmediatePropagation(); coToLodge(true); }, true);

// quitting from the pause menu goes back to the lodge (and tells the partner)
const _co_toMenu = toMenu;
toMenu = function () {
  if (CO.active) { coSend({ t: 'co.lobby' }); coCleanup(); _co_toMenu(); if (VS.peer) openVersus(); return; }
  _co_toMenu();
};
// story cutscenes, ghost runs and HARD MODE stay solo things
const _co_maybeStory = maybeStory;
maybeStory = function (lv, go) { if (CO.active) return false; return _co_maybeStory(lv, go); };
const _co_bossCutscene = bossCutscene;
bossCutscene = function (room) { if (CO.active) return false; return _co_bossCutscene(room); };
const _co_ngActive = ngActive;
ngActive = function () { return !CO.active && _co_ngActive(); };
const _co_ghostStart = ghostStart;
ghostStart = function (lv) { _co_ghostStart(lv); if (CO.active) { GH.rec = null; GH.play = null; } };
const _co_playStoryEnd = playStoryEnd;
playStoryEnd = function (id, fin) { if (CO.active) { fin(); return; } _co_playStoryEnd(id, fin); };

// ---------------------------------------------------------------- the link
const _co_vsRecv = vsRecv;
vsRecv = function (m) {
  if (!m || typeof m.t !== 'string' || !m.t.startsWith('co.')) return _co_vsRecv(m);
  coRecv(m);
};
const _co_vsLost = vsLost;
vsLost = function () {
  if (CO.active && VS.connected) { VS.connected = false; VS.conn = null; coSolo('YOUR PARTNER DISCONNECTED'); return; }
  _co_vsLost();
};
function coRecv(m) {
  const M = CO.mate, L = G.layout;
  switch (m.t) {
    case 'co.go': coBegin(m.idx | 0, String(m.diff || 'normal'), false); return;
    case 'co.lobby': if (CO.active || G.state === 'complete') { coToLodge(false); vsMsg('Your partner went back to the lodge.'); } return;
  }
  if (!CO.active) return;
  switch (m.t) {
    case 'co.p': {
      M.tgt = new V3(+m.x || 0, +m.y || 0, +m.z || 0); M.yaw = +m.yw || 0; M.pitch = +m.pt || 0;
      M.hp = +m.hp || 0; M.rv = +m.rv || 0; M.bo = +m.bo || 0; M.ps = !!m.ps; M.seen = performance.now();
      if (!M.down && m.dn) { showHint('YOUR PARTNER IS DOWN · stand over them to lift them back up'); tone(220, 110, 0.5, 0.2, 'sawtooth'); }
      M.down = !!m.dn;
      if (!M.pos) M.pos = M.tgt.clone();
      if ((m.f | 0) > M.f) coMateShot(); M.f = m.f | 0;
      break;
    }
    case 'co.sp': {
      if (!DEFS[m.ty]) break;
      CO.allow++; CO.nidQ = [m.n | 0];
      try { const e = makeEnemy(String(m.ty), +m.x || 0, +m.z || 0, +m.y || 0); if (m.el && typeof makeElite === 'function') makeElite(e, String(m.el)); } finally { CO.allow--; CO.nidQ = []; }
      break;
    }
    case 'co.boss': {
      const r = L && L.rooms[m.r | 0];
      if (!r) break;
      CO.allow++; CO.nidQ = Array.isArray(m.n) ? m.n.map((x) => x | 0) : [];
      try { _co_spawnBoss(r); } finally { CO.allow--; CO.nidQ = []; }
      break;
    }
    case 'co.s': { // host snapshot
      if (CO.host || !Array.isArray(m.e)) break;
      const seen = new Set();
      for (const s of m.e) {
        const e = coFind(s[0]); seen.add(s[0]);
        if (!e || e.dead) continue;
        e.coTgt = [s[1], s[2], s[3]];
        if (s[5] < e.hp) e.hp = s[5];
        const fl = s[6] | 0;
        if (!(fl & 1) && e.shieldUp) coQuiet(() => breakShield(e, null));
        while (e.layers > (fl >> 1)) coQuiet(() => stripLayer(e));
      }
      // anything the host no longer has, for a few snapshots running, goes quietly
      for (const e of enemies) {
        if (e.dead || !e.nid) continue;
        if (seen.has(e.nid)) { e.coMiss = 0; continue; }
        if ((e.coMiss = (e.coMiss || 0) + 1) >= 4) coVanish(e);
      }
      break;
    }
    case 'co.dmg': coRemoteDamage(m); break;
    case 'co.kill': coRemoteKill(m); break;
    case 'co.room': {
      const r = L && L.rooms[m.i | 0];
      if (!r || CO.host) break;
      if (m.s === 'a' && r.state === 'idle') { _co_startRoom(r); coPullIn(r); }
      if (m.s === 'c' && r.state !== 'clear') {
        if (r.state === 'idle') r.state = 'active';
        for (const e of enemies) if (!e.dead && e.nid) coVanish(e);
        _co_clearRoom(r);
      }
      break;
    }
    case 'co.enter': {
      const r = L && L.rooms[m.i | 0];
      if (!CO.host || !r || r.state !== 'idle' || G.state !== 'play' || L.rooms.some((x) => x.state === 'active')) break;
      startRoom(r);
      break;
    }
    case 'co.wipe': if (!CO.host) coWipeLocal(); break;
    case 'co.rev': M.down = false; banner('PARTNER BACK UP'); break;
    case 'co.st': break;
    case 'co.done': {
      if (G.state === 'complete') break;
      for (const id of ['pause', 'shop', 'settings']) show(id, false);
      if (G.state === 'pause' || G.state === 'shop' || G.state === 'settings') G.state = 'play';
      CO.remoteDone = true;
      try { completeLevel(); } finally { CO.remoteDone = false; }
      break;
    }
  }
}
function coMateShot() {
  const M = CO.mate;
  if (!M.pos || !M.mesh || !M.mesh.visible) return;
  const eye = new V3(M.pos.x, M.pos.y + 1.45, M.pos.z);
  const dir = new V3(-Math.sin(M.yaw) * Math.cos(M.pitch), Math.sin(M.pitch), -Math.cos(M.yaw) * Math.cos(M.pitch));
  ray.set(eye, dir); ray.far = 60;
  const h = ray.intersectObjects(worldMeshes, false)[0];
  const end = h ? h.point : eye.clone().addScaledVector(dir, 60);
  tracer(eye.clone().addScaledVector(dir, 0.6), end, RIVAL_GLOW || 0x9ad8ff, 0.025, 0.09);
  noise(0.07, 1600, 0.06 * distVol(eye), 'bandpass');
}

// ---------------------------------------------------------------- every frame (runs in any state)
const _co_update = update;
update = function (dt) {
  if (CO.active && CO.mate.ps && G.state === 'play') { show('coPauseNote', true); return; } // partner paused: hold still together
  if (CO.active) show('coPauseNote', false);
  _co_update(dt);
  if (CO.active) coPlayTick(dt);
};
const _co_updateAmbient = updateAmbient;
updateAmbient = function (dt, t) { _co_updateAmbient(dt, t); if (CO.active) coFrame(dt); };
function coMyPause() { return G.state === 'pause' || G.state === 'shop' || G.state === 'settings'; }
function coFrame(dt) {
  const M = CO.mate;
  if (W.flashT > CO.flash + 1e-4) CO.shots++;
  CO.flash = W.flashT;
  CO.sendT -= dt;
  if (CO.sendT <= 0 && G.layout) {
    CO.sendT = 1 / 15;
    coSend({ t: 'co.p', x: r2(P.pos.x), y: r2(P.pos.y), z: r2(P.pos.z), yw: r2(P.yaw), pt: r2(P.pitch), hp: Math.max(0, Math.round(P.hp)),
      dn: CO.down ? 1 : 0, rv: r2(CO.revT / CO_REVIVE), bo: Math.ceil(CO.downT), f: CO.shots, ps: coMyPause() ? 1 : 0 });
  }
  // the partner's golem
  if (M.mesh && M.tgt && G.layout && G.state !== 'complete') {
    M.pos.lerp(M.tgt, Math.min(1, dt * 12));
    const moved = Math.hypot(M.pos.x - M.mesh.position.x, M.pos.z - M.mesh.position.z);
    M.mesh.position.copy(M.pos);
    M.mesh.rotation.set(M.down ? -Math.PI / 2 : 0, M.yaw + Math.PI, 0, 'YXZ');
    if (M.down) M.mesh.position.y += 0.35;
    M.mesh.visible = Math.hypot(M.pos.x - P.pos.x, M.pos.z - P.pos.z) > 0.9;
    const md = M.mesh.userData.md;
    if (md && md.rig && md.rig.hipL && !M.down) { M.walk += moved * 2.2; const sw = Math.sin(M.walk) * Math.min(1, moved / Math.max(dt, 1e-3) / 6) * 0.7; md.rig.hipL.rotation.x = sw; md.rig.hipR.rotation.x = -sw; }
    const b = M.beacon;
    b.visible = true;
    b.position.set(M.pos.x, M.pos.y + (M.down ? 1.3 : 2.35), M.pos.z);
    const pulse = M.down ? 1.3 + Math.sin(G.time * 8) * 0.35 : 0.75;
    b.scale.set(pulse, pulse, 1);
    b.material.color.setHex(M.down ? 0xff4a2a : RIVAL_GLOW || 0x6ad8ff);
  }
  coHud();
}
// gameplay-only bits: revive, bleed-out, host snapshots
function coPlayTick(dt) {
  const M = CO.mate;
  const near = M.pos && Math.hypot(M.pos.x - P.pos.x, M.pos.z - P.pos.z) < CO_REACH && Math.abs(M.pos.y - P.pos.y) < 2.2;
  if (CO.down) {
    if (near && !M.down) CO.revT += dt; else CO.revT = Math.max(0, CO.revT - dt * 0.5);
    if (CO.revT >= CO_REVIVE) coRevived();
    else if (!M.down) { CO.downT -= dt; if (CO.downT <= 0) coBleedOut(); }
    if (CO.host && M.down) { CO.wipeT += dt; if (CO.wipeT > 1.4) coWipe(); }
  }
  if (CO.host) {
    CO.snapT -= dt;
    if (CO.snapT <= 0) {
      CO.snapT = 1 / 10;
      const list = [];
      for (const e of enemies) {
        if (e.dead || !e.nid) continue;
        const p = e.mesh.position;
        list.push([e.nid, r2(p.x), r2(p.y), r2(p.z), r2(e.mesh.rotation.y), Math.round(e.hp * 10) / 10, (e.shieldUp ? 1 : 0) | ((e.layers | 0) << 1)]);
      }
      coSend({ t: 'co.s', e: list });
    }
  }
}
let coHudT = 0;
function coHud() {
  if (!CO.active) return;
  if ((coHudT -= 1) > 0) return; coHudT = 6;
  const M = CO.mate;
  const lost = M.seen && performance.now() - M.seen > 2500;
  $('coMateHp').style.width = `${clamp(M.hp, 0, 100)}%`;
  $('coHud').classList.toggle('down', !!M.down);
  const near = M.pos && Math.hypot(M.pos.x - P.pos.x, M.pos.z - P.pos.z) < CO_REACH;
  $('coMateSt').textContent = !M.seen ? 'joining…' : lost ? 'signal lost…' : M.ps ? 'PAUSED' : M.down ? (near && !CO.down ? `LIFTING ${Math.round(M.rv * 100)}%` : `DOWN · ${M.bo}s`) : Math.round(M.hp);
  const el = $('coDown');
  if (CO.down) {
    show('coDown', true);
    el.innerHTML = `<b>YOU ARE DOWN</b><span>${M.down ? 'your partner is down too…' : 'your partner can lift you · stand together'}</span><div class="tr"><i style="width:${clamp(CO.revT / CO_REVIVE, 0, 1) * 100}%"></i></div><small>${M.down ? '' : `crumbling in ${Math.ceil(CO.downT)}s`}</small>`;
  } else show('coDown', false);
}
