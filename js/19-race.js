'use strict';
// ================================================================ BATCH 5d: RUBBLE RACE (secret 1v1 versus over PeerJS)
var VS = {
  active: false, peer: null, conn: null, host: false, code: '', level: 0, meReady: false, rivalReady: false, freeze: 0,
  rival: { prog: 0, done: false, t: 0, pos: null, yaw: 0, tgt: null, mesh: null, rooms: 0 },
  sendT: 0, sendCD: 0, curses: 0, styleBank: 0, clearedSeen: 0, fx: {}, result: null, connected: false,
};
const VS_PREFIX = 'rubblemaker-race-';
const rivalMat = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.4, depthWrite: false });
const vsUnlocked = () => { try { return localStorage.getItem('rubblemaker-vs') === '1'; } catch (_) { return false; } };
function vsReveal() { show('vsBtn', vsUnlocked()); }
// the secret: type R A C E on the title screen
var raceBuf = '';
addEventListener('keydown', (e) => {
  if (G.state !== 'menu' || !e.code.startsWith('Key')) return;
  raceBuf = (raceBuf + e.code.slice(3)).slice(-4);
  if (raceBuf !== 'RACE') return;
  raceBuf = '';
  const first = !vsUnlocked();
  try { localStorage.setItem('rubblemaker-vs', '1'); } catch (_) {}
  vsReveal();
  const el = $('achToast');
  el.innerHTML = `<small>${first ? 'SECRET FOUND' : 'SECRET'}</small><b>RUBBLE RACE</b><span>1v1 versus is open · race a friend through the same level</span>`;
  el.classList.add('show'); sfx.portal();
  setTimeout(() => el.classList.remove('show'), 3200);
});
function vsMsg(t, bad) { const m = $('vsMsg'); m.textContent = t; m.classList.toggle('bad', !!bad); }
function vsLevels() { return LEVELS.map((l, i) => [l, i]).filter(([l]) => !l.duel && !l.prime); }
function openVersus() {
  initAudio();
  G.state = 'versus';
  show('menu', false); show('vsResult', false);
  show('versus', true);
  const sel = $('vsLevel');
  if (!sel.options.length) { const opt = ([l, i]) => `<option value="${i}">${l.id} · ${l.name}</option>`; const all = vsLevels(); sel.innerHTML = `<optgroup label="RACE COURSES">${all.filter(([l]) => l.race).map(opt).join('')}</optgroup><optgroup label="CAMPAIGN LEVELS">${all.filter(([l]) => !l.race).map(opt).join('')}</optgroup>`; }
  vsLobbyUI();
}
function vsLobbyUI() {
  const inLobby = !!VS.peer;
  show('vsHome', !inLobby); show('vsLobby', inLobby);
  if (!inLobby) { vsMsg(window.Peer ? '' : 'Loading the network library… if this stays, check your connection.'); return; }
  $('vsCodeShow').innerHTML = VS.host ? `ROOM CODE <b>${VS.code}</b><small>send this to your rival</small>` : `JOINED <b>${VS.code}</b>`;
  $('vsStatus').textContent = VS.connected ? 'RIVAL CONNECTED' : VS.host ? 'WAITING FOR A RIVAL…' : 'CONNECTING…';
  $('vsStatus').className = VS.connected ? 'ok' : '';
  $('vsLevel').disabled = !VS.host;
  show('vsStart', VS.host);
  $('vsStart').disabled = !VS.connected;
  $('vsLevel').value = String(VS.level);
  if (!VS.host) vsMsg(VS.connected ? 'The host picks the level and starts the race.' : '');
  $('vsScore').textContent = VS.connected ? scoreLine() : '';
  wireTauntRows();
  show('vsTauntLobby', VS.connected);
}
function newCode() { return 'BRICK-' + String(1000 + Math.floor(Math.random() * 9000)); }
function vsHost(tries = 0) {
  if (!window.Peer) { vsMsg('Network library not loaded. Are you online?', true); return; }
  vsLeave(true);
  VS.host = true; VS.code = newCode(); VS.level = Number($('vsLevel').value || vsLevels()[0][1]);
  const peer = new window.Peer(VS_PREFIX + VS.code);
  VS.peer = peer;
  peer.on('open', () => vsLobbyUI());
  peer.on('connection', (c) => { if (VS.conn && VS.conn.open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; } vsAttach(c); });
  peer.on('error', (er) => {
    if (er.type === 'unavailable-id' && tries < 4) { vsHost(tries + 1); return; }
    vsMsg('Network error: ' + (er.type || er.message), true);
  });
  vsLobbyUI();
}
function vsJoin() {
  if (!window.Peer) { vsMsg('Network library not loaded. Are you online?', true); return; }
  let code = $('vsCode').value.trim().toUpperCase().replace(/\s+/g, '');
  if (/^\d{4}$/.test(code)) code = 'BRICK-' + code;
  if (/^BRICK\d{4}$/.test(code)) code = 'BRICK-' + code.slice(5);
  if (!/^BRICK-\d{4}$/.test(code)) { vsMsg('Codes look like BRICK-1234', true); return; }
  vsLeave(true);
  VS.host = false; VS.code = code;
  const peer = new window.Peer();
  VS.peer = peer;
  peer.on('open', () => { vsAttach(peer.connect(VS_PREFIX + code, { reliable: true })); });
  peer.on('error', (er) => { vsMsg(er.type === 'peer-unavailable' ? 'No race with that code. Check it with the host.' : 'Network error: ' + (er.type || er.message), true); if (er.type === 'peer-unavailable') { vsLeave(true); vsLobbyUI(); } });
  vsLobbyUI();
}
function vsAttach(c) {
  VS.conn = c;
  c.on('open', () => { VS.connected = true; vsSend({ t: 'hi', v: 1, glow: golemGlowHex() }); if (VS.host) vsSend({ t: 'lvl', idx: VS.level }); vsLobbyUI(); sfx.door(); });
  c.on('data', (m) => vsRecv(m));
  c.on('close', () => vsLost());
  c.on('error', () => vsLost());
}
function vsSend(m) { try { if (VS.conn && VS.conn.open) VS.conn.send(m); } catch (_) {} }
function vsLost() {
  if (!VS.connected) return;
  VS.connected = false; VS.conn = null;
  if (VS.active) { vsEndRace(true, 'RIVAL DISCONNECTED · WIN BY FORFEIT'); return; }
  if (G.state === 'versus') { vsMsg('Your rival left.', true); vsLobbyUI(); }
}
function vsLeave(quiet) {
  vsSend({ t: 'bye' });
  try { if (VS.conn) VS.conn.close(); } catch (_) {}
  try { if (VS.peer) VS.peer.destroy(); } catch (_) {}
  VS.conn = null; VS.peer = null; VS.connected = false;
  if (!quiet) vsLobbyUI();
}
function vsRecv(m) {
  if (!m || typeof m !== 'object') return;
  const R = VS.rival;
  switch (m.t) {
    case 'hi': VS.connected = true; if (m.glow) RIVAL_GLOW = m.glow | 0; vsLobbyUI(); break;
    case 'full': vsMsg('That race already has two players.', true); vsLeave(); break;
    case 'lvl': VS.level = m.idx | 0; vsLobbyUI(); break;
    case 'go': vsBegin(m.idx | 0); break;
    case 'ready': R.ready = true; VS.rivalReady = true; if (VS.meReady) vsCountdown(); vsReadyUI(); break;
    case 'p':
      R.tgt = new V3(+m.x || 0, +m.y || 0, +m.z || 0); R.yaw = +m.yaw || 0; R.prog = clamp(+m.prog || 0, 0, 1); R.rooms = m.rooms | 0; R.lt = +m.lt || 0; R.ltAt = performance.now();
      if (!R.pos) R.pos = R.tgt.clone();
      break;
    case 'send': vsReceiveEnemies(Array.isArray(m.types) ? m.types.slice(0, 3) : []); break;
    case 'curse': vsApplyCurse(String(m.k)); break;
    case 'done':
      R.done = true; R.t = +m.time || 0;
      if (!VS.active) break;
      if (VS.myDone) { if (VS.result === 'win' && R.t < VS.myT) vsFlip(); vsShowResult(); }
      else if (!VS.result) { vsDecide(false, 'YOUR RIVAL REACHED THE PORTAL FIRST'); banner('RIVAL FINISHED'); showHint('Your rival reached the portal first. Finish for your time, or quit from the pause menu.'); }
      break;
    case 'taunt': tauntPop('RIVAL', TAUNTS[m.i | 0] || 'GG'); break;
    case 'lobby': if (G.state === 'vsResult' || G.state === 'versus') { vsMsg('Host is back in the lobby.'); } break;
    case 'quit': if (VS.active) vsEndRace(true, 'YOUR RIVAL GAVE UP'); break;
    case 'bye': vsLost(); break;
  }
}
function vsStartRace() {
  if (!VS.host || !VS.connected) return;
  VS.level = Number($('vsLevel').value);
  vsSend({ t: 'go', idx: VS.level });
  vsBegin(VS.level);
}
function vsBegin(idx) {
  VS.active = true; VS.level = idx; VS.result = null; VS.myDone = false; VS.myT = 0;
  VS.meReady = false; VS.rivalReady = false; VS.freeze = 0;
  VS.rival = { prog: 0, done: false, t: 0, pos: null, yaw: 0, tgt: null, mesh: VS.rival.mesh, rooms: 0, ready: false };
  VS.curses = 0; VS.styleBank = 0; VS.clearedSeen = 0; VS.sendCD = 0; VS.fx = {};
  show('versus', false); show('vsResult', false);
  normalizeLoadout();
  startLevel(idx);
  placeRunes();
  show('vsSpec', false);
  G.state = 'vsready';
  camera.position.set(P.pos.x, P.pos.y + P.camH, P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0); camera.updateMatrixWorld();
  show('hud', true); show('vsHud', true);
  rivalMat.color.setHex(RIVAL_GLOW || 0xff5a3a);
  if (!VS.rival.mesh) VS.rival.mesh = ghostModel(rivalMat);
  VS.rival.mesh.visible = false;
  show('vsCount', true);
  vsReadyUI();
}
function vsReadyUI() {
  const el = $('vsCount');
  if (G.state !== 'vsready') return;
  el.innerHTML = `<b>${LEVELS[VS.level].id} · ${LEVELS[VS.level].name}</b><button id="vsReadyBtn" ${VS.meReady ? 'disabled' : ''}>${VS.meReady ? 'READY ✔' : 'CLICK WHEN READY'}</button><small>RIVAL: ${VS.rivalReady ? 'READY ✔' : 'getting ready…'}</small><small class="keys">first to the portal wins · [T] fires a curse when you have one</small>`;
  $('vsReadyBtn').onclick = vsSetReady;
}
function vsSetReady() {
  if (VS.meReady || G.state !== 'vsready') return;
  VS.meReady = true;
  requestLock();
  vsSend({ t: 'ready' });
  if (VS.rivalReady) vsCountdown(); else vsReadyUI();
}
function vsCountdown() {
  if (G.state !== 'vsready') return;
  G.state = 'play';
  last = performance.now();
  VS.freeze = 3; VS.goAt = performance.now() + 3000;
  requestLock();
}
// progress through the level, 0..1
function vsProgress() {
  const L = G.layout; if (!L) return 0;
  const fights = L.rooms.filter((r) => (r.waves && r.waves.length) || r.boss);
  const done = fights.filter((r) => r.state === 'clear').length;
  return fights.length ? Math.min(0.95, done / fights.length * 0.95) : 0;
}
function vsTick(dt) {
  if (!VS.active) return;
  const R = VS.rival;
  if (VS.freeze > 0) {
    const before = Math.ceil(VS.freeze);
    VS.freeze = (VS.goAt - performance.now()) / 1000;
    P.pos.x = G.spawn.x; P.pos.z = G.spawn.z; P.vel.set(0, 0, 0); W.cd = Math.max(W.cd, 0.15);
    G.levelTime = 0;
    const el = $('vsCount');
    if (VS.freeze <= 0) { el.innerHTML = '<b class="go">GO!</b>'; sfx.wave(); setTimeout(() => { if (VS.freeze <= 0) show('vsCount', false); }, 700); }
    else if (Math.ceil(VS.freeze) !== before || !el.querySelector('.num')) { el.innerHTML = `<b class="num">${Math.ceil(VS.freeze)}</b>`; tone(440, 440, 0.15, 0.2, 'square'); }
  }
  // stream my position + progress
  VS.sendT -= dt;
  if (VS.sendT <= 0) {
    VS.sendT = 1 / 12;
    vsSend({ t: 'p', x: Math.round(P.pos.x * 100) / 100, y: Math.round(P.pos.y * 100) / 100, z: Math.round(P.pos.z * 100) / 100, yaw: Math.round(P.yaw * 100) / 100, prog: vsProgress(), rooms: G.layout ? G.layout.rooms.filter((r) => r.state === 'clear').length : 0, lt: Math.round(G.levelTime * 10) / 10 });
  }
  // rival ghost
  if (R.mesh && R.tgt) {
    R.pos.lerp(R.tgt, Math.min(1, dt * 10));
    const moved = Math.hypot(R.pos.x - R.mesh.position.x, R.pos.z - R.mesh.position.z);
    R.mesh.position.copy(R.pos);
    R.mesh.rotation.y = R.yaw + Math.PI;
    R.mesh.visible = Math.hypot(R.pos.x - P.pos.x, R.pos.z - P.pos.z) > 1.2;
    const md = R.mesh.userData.md;
    if (md && md.rig && md.rig.hipL) { R.walk = (R.walk || 0) + moved * 2.2; const sw = Math.sin(R.walk) * Math.min(1, moved / Math.max(dt, 1e-3) / 6) * 0.7; md.rig.hipL.rotation.x = sw; md.rig.hipR.rotation.x = -sw; }
  }
  // curse charges: every room cleared and every 900 style
  const cleared = G.layout ? G.layout.rooms.filter((r) => r.state === 'clear').length : 0;
  if (cleared > VS.clearedSeen) { VS.clearedSeen = cleared; vsGainCurse(); }
  if (G.styleTotal - VS.styleBank >= 900) { VS.styleBank += 900; vsGainCurse(); }
  if (hit('curse')) vsFireCurse();
  VS.sendCD -= dt;
  // curse effects on me
  const F = VS.fx;
  for (const k in F) { F[k] -= dt; if (F[k] <= 0) { delete F[k]; if (k === 'lowgrav') G.lowgrav = false; } }
  if (F.jam) { W.cd = Math.max(W.cd, 0.1); if (FLAIL.held) { FLAIL.held = false; FLAIL.wind = 0; } }
  if (F.lowgrav) G.lowgrav = true;
  const fx = $('vsCurseFx');
  fx.className = F.fog ? 'fog' : F.reverse ? 'rev' : F.jam ? 'jam' : F.lowgrav ? 'grav' : 'hidden';
  fx.textContent = F.reverse ? 'CONTROLS REVERSED' : F.jam ? 'WEAPONS JAMMED' : F.lowgrav ? 'LOW GRAVITY' : '';
  // HUD
  $('vsMe').style.width = `${vsProgress() * 100}%`;
  $('vsRiv').style.width = `${R.prog * 100}%`;
  $('vsCurse').innerHTML = VS.curses ? `CURSE ×${VS.curses} <b>[${keyLabel(bound('curse')[0] || 'KeyT')}]</b>` : '<span>clear rooms / earn style for curses</span>';
}
function vsGainCurse() { if (VS.curses >= 3) return; VS.curses++; pushFeed('CURSE READY', 'cool'); sfx.coin(); }
const CURSES = { fog: ['FOG', 5], reverse: ['REVERSED CONTROLS', 3], jam: ['WEAPON JAM', 2.5], lowgrav: ['LOW GRAVITY', 6] };
function vsFireCurse() {
  if (!VS.curses || VS.freeze > 0) return;
  VS.curses--;
  const k = Object.keys(CURSES)[(Math.random() * 4) | 0];
  vsSend({ t: 'curse', k }); raceStat('curses');
  pushFeed('CURSE SENT · ' + CURSES[k][0], 'cool');
  addStyle(30, null, null);
  tone(300, 90, 0.5, 0.25, 'sawtooth');
}
function vsApplyCurse(k) {
  if (!CURSES[k] || !VS.active || VS.result) return;
  VS.fx[k] = CURSES[k][1];
  banner('CURSED: ' + CURSES[k][0]);
  tone(200, 60, 0.7, 0.3, 'sawtooth'); fxFlash(0x8a2aff, 0.25);
}
// sabotage: your style milestones send enemies into your rival's level
const SEND_POOL = [['grunt', 'shooter', 'flyer'], ['grunt', 'shooter', 'shield', 'flyer', 'bomber'], ['grunt', 'shooter', 'ram', 'bomber', 'flyer']];
function vsSendEnemies(n, why) {
  if (!VS.active || VS.result || VS.sendCD > 0 || VS.freeze > 0) return;
  VS.sendCD = 9;
  const pool = SEND_POOL[Math.max(0, SCENES.indexOf(G.level.scene))] || SEND_POOL[0];
  const types = []; for (let i = 0; i < n; i++) types.push(pool[(Math.random() * pool.length) | 0]);
  vsSend({ t: 'send', types }); raceStat('sent', n);
  pushFeed(`${why} · SENT ${n} TO RIVAL`, 'cool');
}
function vsLabel(label) {
  if (!VS.active) return;
  if (label === 'TRIPLE KILL' || label === 'MULTIKILL') vsSendEnemies(2, label);
}
function vsRank(idx) { if (VS.active && idx >= 4) vsSendEnemies(idx >= 6 ? 2 : 1, RANKS[idx].l + ' RANK'); }
function vsReceiveEnemies(types) {
  if (!VS.active || VS.result || G.state === 'vsready' || VS.freeze > 0) return;
  if (enemies.filter((e) => e.sent && !e.dead).length >= 5) return;
  let n = 0;
  for (const t of types) {
    if (!DEFS[t]) continue;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2, d = rand(6, 11);
      const x = P.pos.x + Math.cos(a) * d, z = P.pos.z + Math.sin(a) * d;
      const fy = DEFS[t].fly ? P.pos.y + rand(3, 4.5) : 0;
      if (overlapBox(x - 0.7, 0.1, z - 0.7, x + 0.7, 2.4, z + 0.7)) continue;
      if (!lineOfSight(playerEye(), new V3(x, 1.2, z))) continue;
      const e = makeEnemy(t, x, z, fy); e.sent = true; n++;
      break;
    }
  }
  if (n) { banner(`RIVAL SENT ${n} ${n > 1 ? 'ENEMIES' : 'ENEMY'}`); fxFlash(0xff3a1a, 0.15); }
}
// someone reached the portal
function vsFinish() {
  VS.myDone = true; VS.myT = G.levelTime;
  vsSend({ t: 'done', time: VS.myT });
  if (VS.rival.done) { if (!VS.result) vsDecide(VS.myT < VS.rival.t); vsShowResult(); return; }
  vsDecide(true);
  if (VS.connected && VS.rival.tgt) vsSpectate(); else vsShowResult();
}
function vsEndRace(win, note) { vsDecide(win, note); vsShowResult(); }
function vsShowResult() {
  const again = G.state === 'vsResult';
  const win = VS.result === 'win';
  G.state = 'vsResult';
  document.exitPointerLock?.();
  show('hud', false); show('vsHud', false); show('vsCount', false); show('pause', false); show('over', false); show('vsSpec', false);
  $('vsTauntPick').classList.add('hidden');
  G.lowgrav = false; VS.fx = {};
  $('vsCurseFx').className = 'hidden';
  if (VS.rival.mesh) VS.rival.mesh.visible = false;
  $('vsResTitle').textContent = win ? 'YOU WIN' : 'YOU LOSE';
  $('vsResTitle').className = 'title ' + (win ? 'win' : 'lose');
  const lv = LEVELS[VS.level];
  $('vsResStats').innerHTML = `<span>LEVEL</span><b>${lv.id} · ${lv.name}</b>` +
    `<span>YOUR TIME</span><b>${VS.myDone ? fmtTime(VS.myT) : 'DNF'}</b>` +
    `<span>RIVAL</span><b>${VS.rival.done ? fmtTime(VS.rival.t) : 'DNF'}</b>` +
    `<span>KILLS</span><b>${G.kills}</b>` + (VS.note ? `<p>${VS.note}</p>` : '');
  const sc = VS.score;
  $('vsResSet').innerHTML = sc.over ? `<b class="${sc.me > sc.riv ? 'win' : 'lose'}">${sc.me > sc.riv ? 'SET WON' : 'SET LOST'} ${sc.me} – ${sc.riv}</b><small>next race starts a new set</small>` : `<b>${scoreLine()}</b>`;
  wireTauntRows();
  show('vsRematch', VS.host && VS.connected);
  show('vsResult', true);
  if (!again) { if (win) sfx.rankUp(); else sfx.hurt(); }
}
function vsToLobby() {
  VS.active = false; VS.result = null;
  G.lowgrav = false;
  if (VS.rival.mesh) { scene.remove(VS.rival.mesh); VS.rival.mesh = null; }
  show('vsHud', false); show('vsCount', false); show('vsResult', false); show('vsSpec', false);
  toMenu();
  normalizeLoadout();
  if (VS.host) vsSend({ t: 'lobby' });
  openVersus();
}
function vsToLobbyMenu() {
  VS.active = false; VS.result = null;
  if (VS.rival.mesh) { scene.remove(VS.rival.mesh); VS.rival.mesh = null; }
  show('vsHud', false); show('vsCount', false); show('vsResult', false); show('versus', false);
  toMenu(); normalizeLoadout();
}
$('vsBtn').addEventListener('click', openVersus);
$('vsHost').addEventListener('click', () => vsHost());
$('vsJoin').addEventListener('click', vsJoin);
$('vsCode').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.code === 'Enter') vsJoin(); });
$('vsLevel').addEventListener('change', () => { VS.level = Number($('vsLevel').value); vsSend({ t: 'lvl', idx: VS.level }); });
$('vsStart').addEventListener('click', vsStartRace);
$('vsLeave').addEventListener('click', () => { vsLeave(); vsLobbyUI(); });
$('vsBack').addEventListener('click', () => { G.state = 'menu'; show('versus', false); show('menu', true); });
$('vsRematch').addEventListener('click', () => { vsSend({ t: 'go', idx: VS.level }); VS.active = false; if (VS.rival.mesh) VS.rival.mesh.visible = false; toMenu(); vsBegin(VS.level); });
$('vsLobbyBtn').addEventListener('click', vsToLobby);
vsReveal();

// ================================================================ BATCH 6.1: PERFORMANCE
function QCAP(lo, med, hi) { return settings.quality === 'low' ? lo : settings.quality === 'medium' ? med : hi; }
// auto quality: if play runs under ~40 FPS for two 3-second windows in a row, step the graphics down one notch
var AQ = { t0: 0, frames: 0, slow: 0, grace: 0, reset: true, last: 'menu' };
function autoQuality(now) {
  if (!settings.autoQuality) return;
  if (G.state !== 'play' || AQ.last !== 'play' || AQ.reset) { AQ.last = G.state; AQ.reset = false; AQ.t0 = now; AQ.frames = 0; AQ.grace = now + 5000; AQ.slow = 0; return; }
  if (now < AQ.grace) { AQ.t0 = now; AQ.frames = 0; return; }
  AQ.frames++;
  if (now - AQ.t0 < 3000) return;
  const fps = AQ.frames * 1000 / (now - AQ.t0);
  AQ.t0 = now; AQ.frames = 0;
  AQ.slow = fps < 40 ? AQ.slow + 1 : 0;
  if (AQ.slow < 2 || settings.quality === 'low') return;
  settings.quality = settings.quality === 'high' ? 'medium' : 'low';
  saveSettings(); applyQuality(); resizeFX();
  AQ.slow = 0; AQ.grace = now + 6000;
  showHint(`AUTO QUALITY · ${Math.round(fps)} FPS, graphics lowered to ${settings.quality.toUpperCase()} (Settings → Video)`);
}

// ================================================================ BATCH 6.2: RACE EXTRAS
// ---- shortcut runes: in race maps, some rooms hide a glowing rune up high. Touch it and the doors open (the fight follows you).
const runeMat = new THREE.MeshBasicMaterial({ color: 0x6affd8 });
const runeGlowMat = new THREE.SpriteMaterial({ map: GLOW, color: 0x3affc8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
var RUNES = [];
function placeRunes() {
  RUNES = [];
  if (!G.layout || !G.level || !G.level.race) return;
  for (const r of G.layout.rooms) {
    if (!r.shortcut) continue;
    const used = new Set(r.doors.map((d) => d.side));
    const side = ['N', 'E', 'S', 'W'].find((s2) => !used.has(s2)) || 'E';
    // off the wall and off-centre, clear of furnaces / banners / torches hung mid-wall
    const inset = 1.5, y = 4.4, sg = G.layout.rooms.indexOf(r) % 2 ? 1 : -1;
    let x = r.cx + (r.x1 - r.x0) * 0.3 * sg, z = r.cz + (r.z1 - r.z0) * 0.3 * sg;
    if (side === 'N') z = r.z0 + inset; else if (side === 'S') z = r.z1 - inset; else if (side === 'E') x = r.x1 - inset; else x = r.x0 + inset;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), runeMat); g.add(m);
    const s2 = new THREE.Sprite(runeGlowMat); s2.scale.set(2.6, 2.6, 1); g.add(s2);
    levelGroup.add(g);
    RUNES.push({ r, g, m, used: false });
  }
}
function updateRunes(dt) {
  for (const u of RUNES) {
    if (u.used) continue;
    u.m.rotation.y += dt * 2; u.g.position.y += Math.sin(G.time * 3) * dt * 0.15;
    if (u.r.state === 'clear') { u.used = true; u.g.visible = false; continue; }
    const d = Math.hypot(P.pos.x - u.g.position.x, (P.pos.y + 1) - u.g.position.y, P.pos.z - u.g.position.z);
    if (d < 1.7) {
      u.used = true; u.g.visible = false;
      const r = u.r;
      r.state = 'clear'; r.queue = [];
      G.checkpoint = { x: r.cx, z: r.cz, yaw: P.yaw };
      for (const dr of r.doorObjs) dr.target = 1;
      sfx.door(); sfx.portal();
      burst(u.g.position.clone(), 20, 0x6affd8, 8, 0.12, 0.6, true);
      banner('SHORTCUT!'); raceStat('shortcuts');
      addStyle(60, 'SHORTCUT', null, 'cool');
    }
  }
}

// ---- taunts
const TAUNTS = ['GG', 'TOO SLOW!', 'GET BRICKED', 'NICE ONE', 'SEE YOU AT THE PORTAL', 'OOPS'];
var tauntT = 0, tauntOpenT = 0, tauntPopT = 0;
function vsTaunt(i) {
  if (!VS.connected || performance.now() < tauntT || !TAUNTS[i]) return;
  tauntT = performance.now() + 1500;
  vsSend({ t: 'taunt', i });
  tauntPop('YOU', TAUNTS[i], true);
}
function tauntPop(who, text, mine) {
  const el = $('vsTauntPop');
  el.innerHTML = `<b>${who}</b> ${text}`;
  el.className = 'show' + (mine ? ' mine' : '');
  clearTimeout(tauntPopT);
  tauntPopT = setTimeout(() => (el.className = ''), 2600);
  if (!mine) tone(700, 900, 0.08, 0.12, 'square');
}
function tauntRowsHTML() { return TAUNTS.map((t, i) => `<button class="sub" data-taunt="${i}">${t}</button>`).join(''); }
function wireTauntRows() {
  document.querySelectorAll('.vsTauntRow').forEach((row) => {
    if (!row.dataset.wired) { row.innerHTML = tauntRowsHTML(); row.dataset.wired = '1'; row.addEventListener('click', (e) => { const b = e.target.closest('[data-taunt]'); if (b) vsTaunt(Number(b.dataset.taunt)); }); }
  });
}
// in a race: press the taunt key, then 1-4 (instead of switching weapon)
function vsTauntInput() {
  if (!VS.active) return;
  const now = performance.now();
  if (hit('taunt')) {
    tauntOpenT = now + 2500;
    const pk = $('vsTauntPick');
    pk.innerHTML = TAUNTS.slice(0, 4).map((t, i) => `<span><b>${i + 1}</b> ${t}</span>`).join('');
    pk.classList.remove('hidden');
  }
  if (now > tauntOpenT) { $('vsTauntPick').classList.add('hidden'); return; }
  for (let i = 0; i < 4; i++) {
    const a = 'weapon' + (i + 1);
    if (!hit(a)) continue;
    for (const c of bound(a)) if (c) pressed.delete(c);
    VHIT.delete(a);
    vsTaunt(i);
    tauntOpenT = 0; $('vsTauntPick').classList.add('hidden');
  }
}

// ---- best of 3
VS.score = { me: 0, riv: 0, over: false };
function vsDecide(win, note) {
  if (VS.result) return;
  VS.result = win ? 'win' : 'lose'; VS.note = note || '';
  if (VS.score.over) VS.score = { me: 0, riv: 0, over: false };
  if (win) VS.score.me++; else VS.score.riv++;
  if (VS.score.me >= 2 || VS.score.riv >= 2) VS.score.over = true;
  raceStat(win ? 'wins' : 'losses');
  if (VS.score.over && VS.score.me > VS.score.riv) raceStat('sets');
}
function vsFlip() { // both crossed the line before hearing about each other: the faster time wins
  if (VS.result === 'win') { const wasSet = VS.score.over && VS.score.me > VS.score.riv; VS.result = 'lose'; VS.score.me--; VS.score.riv++; raceStat('wins', -1); raceStat('losses'); if (wasSet) raceStat('sets', -1); }
  VS.score.over = VS.score.me >= 2 || VS.score.riv >= 2;
}
function scoreLine() { return `SET ${VS.score.me} – ${VS.score.riv} · FIRST TO 2`; }

// ---- spectate your rival after you finish
function vsSpectate() {
  G.state = 'vsSpectate';
  document.exitPointerLock?.();
  show('hud', false); show('vsHud', false);
  show('vsSpec', true);
  $('vsSpec').innerHTML = `<b>YOU WIN</b><span id="vsSpecT">your rival is still racing…</span><button id="vsSpecSkip">SEE RESULTS</button><small>1–6: taunt · SPACE: results</small>`;
  $('vsSpecSkip').onclick = vsShowResult;
  if (VS.rival.mesh) VS.rival.mesh.visible = true;
  VS.specCam = null;
}
function vsSpectateTick(dt) {
  const R = VS.rival;
  if (!R.mesh || !R.tgt) return;
  R.pos.lerp(R.tgt, Math.min(1, dt * 10));
  const moved = Math.hypot(R.pos.x - R.mesh.position.x, R.pos.z - R.mesh.position.z);
  R.mesh.position.copy(R.pos); R.mesh.rotation.y = R.yaw + Math.PI; R.mesh.visible = true;
  const md = R.mesh.userData.md;
  if (md && md.rig && md.rig.hipL) { R.walk = (R.walk || 0) + moved * 2.2; const sw = Math.sin(R.walk) * Math.min(1, moved / Math.max(dt, 1e-3) / 6) * 0.7; md.rig.hipL.rotation.x = sw; md.rig.hipR.rotation.x = -sw; }
  const back = new V3(Math.sin(R.yaw), 0, Math.cos(R.yaw));
  const want = R.pos.clone().addScaledVector(back, 4).setY(R.pos.y + 2.6);
  if (!VS.specCam) VS.specCam = want.clone(); else VS.specCam.lerp(want, Math.min(1, dt * 4));
  camera.position.copy(VS.specCam);
  camera.lookAt(R.pos.x, R.pos.y + 1.2, R.pos.z);
  camera.updateMatrixWorld();
  const el = $('vsSpecT');
  if (el) el.textContent = `RIVAL ${fmtTime((R.lt || 0) + (performance.now() - (R.ltAt || performance.now())) / 1000)} · ${Math.round(R.prog * 100)}%`;
}
addEventListener('keydown', (e) => {
  if (G.state !== 'vsSpectate') return;
  if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); vsShowResult(); }
  const n = Number(e.code.replace('Digit', '')); if (n >= 1 && n <= 6) vsTaunt(n - 1);
});
