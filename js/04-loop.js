'use strict';
// ---------------------------------------------------------------- main update
function update(dt) {
  G.time += dt;
  scene.updateMatrixWorld();
  updatePlayer(dt);
  // camera from player
  camera.position.set(P.pos.x, P.pos.y + P.camH + (settings.viewBob ? Math.abs(Math.sin(P.bob)) * 0.05 : 0), P.pos.z);
  G.shake *= Math.exp(-dt * 7);
  const sh = G.shake * 0.25 * settings.shake;
  camera.position.x += rand(-sh, sh); camera.position.y += rand(-sh, sh); camera.position.z += rand(-sh, sh);
  P.landDip = (P.landDip || 0) * Math.exp(-dt * 7);
  camera.position.y -= P.landDip * 0.28;
  camera.rotation.set(P.pitch - P.landDip * 0.05, P.yaw, P.roll);
  updateFov(dt);
  camera.updateMatrixWorld();

  updateWeapons(dt);
  updateEnemies(dt);
  updateOrbs(dt);
  updateCores(dt);
  updateCoins(dt);
  updateSaws(dt);
  updateNails(dt);
  updateBricks(dt);
  updateFlames(dt);
  updateElites(dt);
  updateBurning(dt);
  updateForge();
  if (G.mode === 'endless') updateWaves(dt); else if (G.mode === 'practice') updatePractice(dt); else if (G.mode === 'tutorial') updateTutorial(dt); else updateCampaign(dt);
  updateShockwaves(dt);
  updateHazards(dt);
  updateWaterHazards(dt);
  updateSecrets(dt);
  updateDoors(dt);
  updateBossBar();
  moon.position.set(P.pos.x + 30, 55, P.pos.z + 18);
  moon.target.position.set(P.pos.x, 0, P.pos.z);

  // style decay + freshness recovery
  const decay = (12 + ST.idx * 10) * (enemies.length ? 1 : 0.35);
  ST.points = Math.max(0, ST.points - decay * dt);
  for (const k in fresh) fresh[k] = Math.min(1, fresh[k] + dt * 0.012);
}

function updateAmbient(dt, t) {
  const ref = G.state === 'play' || G.state === 'pause' ? P.pos : camera.position;
  updateLights(dt, t, ref);
  const a = emberGeo.attributes.position.array;
  for (let i = 0; i < EMBERS; i++) {
    a[i * 3 + 1] += dt * (0.4 + (i % 7) * 0.08);
    a[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.3;
    if (a[i * 3 + 1] > 15) a[i * 3 + 1] = 0;
    if (a[i * 3] - ref.x > 30) a[i * 3] -= 60; else if (a[i * 3] - ref.x < -30) a[i * 3] += 60;
    if (a[i * 3 + 2] - ref.z > 30) a[i * 3 + 2] -= 60; else if (a[i * 3 + 2] - ref.z < -30) a[i * 3 + 2] += 60;
  }
  emberGeo.attributes.position.needsUpdate = true;
  updateMusic();
}

let last = performance.now();
// static level meshes get merged into a few draw calls (batch.js); ?nobatch turns it off to compare
let BATCH = null;
const NO_BATCH = /[?&]nobatch/.test(location.search);
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  pollInput(dt);
  if (G.state === 'play') {
    let gdt = dt;
    if (G.hitstop > 0) { G.hitstop -= dt; gdt = dt * 0.05; }
    if (G.slow.t > 0) { G.slow.t -= dt; gdt *= G.slow.scale; }
    update(gdt);
    updateParts(gdt);
    updateDebris(gdt);
    updateTracers(dt);
    updateBlasts(gdt);
    updateViewmodel(dt);
    updateHUD();
  } else if (G.state === 'vsSpectate') {
    vsSpectateTick(dt); updateParts(dt);
  } else if (G.state === 'cutscene') {
    updateCutscene(dt); updateParts(dt); updateBlasts(dt);
  } else if (menuish()) {
    updateMenuScene(dt, now / 1000);
  }
  updateAmbient(dt, now / 1000);
  pressed.clear(); released.clear(); VHIT.clear();
  updateFPS(now);
  autoQuality(now);
  if (!NO_BATCH) {
    if (!BATCH || BATCH.root !== levelGroup) { if (BATCH) BATCH.dispose(); BATCH = createBatcher(levelGroup); }
    BATCH.update(dt);
  }
  renderFrame(dt);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- flow
function clearWorld() {
  for (const e of enemies) { scene.remove(e.mesh); removeEnemyFx(e); }
  enemies.length = 0;
  for (const o of orbs) scene.remove(o.m);
  orbs.length = 0;
  for (const c of cores) scene.remove(c.m);
  cores.length = 0;
  for (const p of parts) { p.life = 0; p.mesh.visible = false; }
  feedEl.innerHTML = '';
  clearFireballs();
}
function resetGame() {
  clearWorld();
  Object.assign(P, { hp: 100, grounded: false, wallJumps: 3, pips: 3, dashT: 0, sliding: false, slamming: false, invuln: 0, camH: 1.6, roll: 0, hurtFlash: 0, yaw: 0, pitch: 0 });
  P.pos.set(0, 0, 12); P.vel.set(0, 0, 0);
  Object.assign(G, { wave: 0, toSpawn: [], score: 0, time: 0, kills: 0, hitstop: 0, shake: 0, bestRank: 0, waveActive: false, breakT: 1.2 });
  ST.points = 0;
  Object.assign(G, { styleTotal: 0, dmgTaken: 0, levelTime: 0, boss: null, portal: null, mod: null, modDiff: null, lowgrav: false, pitBossT: 0 });
  for (const s of shocks) { scene.remove(s.m); s.m.material.dispose(); }
  shocks.length = 0;
  clearProjectiles();
  clearNails();
  ghostClear();
  RECENT_DEAD.length = 0; CHAIN.n = 0; CHAIN.t = -9;
  forge = null; promptShown = false; $('prompt').classList.remove('show');
  hideBeam();
  show('bossBar', false);
  $('hint').classList.remove('show');
  for (const k in fresh) fresh[k] = 1;
  clearGore();
  clearMenuCrowd();
  G.slow = { t: 0, scale: 1 };
  $('intro').classList.add('hidden');
  ui.rank = -1; ui.hp = -1;
  W.cur = 1; switchWeapon(0);
  normalizeLoadout();
  keys.clear();
  $('wave').textContent = 'GET READY';
}
// Fullscreen + Keyboard Lock lets the game receive Ctrl+W / Ctrl+T etc. instead of Chrome.
function lockKeyboard() {
  if (!settings.fullscreen) return;
  try {
    const go = () => { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().catch(() => {}); };
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(go).catch(() => {});
    } else go();
  } catch (_) {}
}
function unlockKeyboard() {
  try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch (_) {}
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
// last line of defence: ask before the tab closes mid-run
addEventListener('beforeunload', (e) => {
  const inRun = G.state === 'play' || G.state === 'pause' || G.state === 'shop' || (G.state === 'settings' && settingsFrom === 'pause');
  if (inRun) { e.preventDefault(); e.returnValue = ''; }
});
function requestLock() {
  if (G.input === 'pad') return;
  lockKeyboard();
  if (G.input === 'touch') return;
  try {
    const r = renderer.domElement.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch (_) {}
}
function show(id, on) { $(id).classList.toggle('hidden', !on); }

function loadBest() {
  try { return JSON.parse(localStorage.getItem('rubblemaker-best') || 'null'); } catch (_) { return null; }
}
function saveBest(b) {
  try { localStorage.setItem('rubblemaker-best', JSON.stringify(b)); } catch (_) {}
}
function renderBest() {
  const b = loadBest();
  $('best').textContent = b ? `RUBBLE PIT BEST: ${b.score.toLocaleString()} · WAVE ${b.wave} · ${RANKS[b.rank].l}` : '';
}
renderBest();

function gameOver() {
  if (G.state !== 'play') return;
  G.state = 'over';
  if (statsLive()) { STATS.deaths++; if (G.mode === 'endless' && G.wave > STATS.pitBestWave) STATS.pitBestWave = G.wave; saveStats(); }
  document.exitPointerLock?.();
  hideBeam();
  if (G.mode === 'endless') {
    const score = Math.floor(G.score);
    const best = loadBest();
    const isBest = !best || score > best.score;
    if (isBest && !cheatsOn()) saveBest({ score, wave: G.wave, rank: G.bestRank });
    const place = cheatsOn() ? -1 : addPitScore({ score, wave: G.wave, rank: G.bestRank, kills: G.kills, date: Date.now() });
    $('overStats').innerHTML = `RUBBLE PIT<br>SCORE ${score.toLocaleString()}${isBest ? ' — NEW BEST!' : ''}<br>WAVE ${G.wave} · ${G.kills} KILLS<br>HIGHEST STYLE: ${RANKS[G.bestRank].l}` + pitTableHTML(place, 5);
    if (G.daily && !cheatsOn()) { const r = recordDaily(score, G.wave); $('overStats').innerHTML = `DAILY PIT · ${G.daily.date} · ${G.daily.mod.name}<br>TODAY'S BEST ${Math.floor(r.d.best).toLocaleString()} (WAVE ${r.d.wave})${r.isBest ? ' — NEW!' : ''}${r.d.streak > 1 ? ' · ' + r.d.streak + ' DAY STREAK' : ''}<br><br>` + $('overStats').innerHTML; }
    const earned = Math.floor(score / 40);
    if (earned) { awardScrap(earned); if (statsLive()) STATS.scrapEarned += earned; $('overStats').innerHTML += `<br><span class="scrap">+${earned} ◆ SCRAP</span>`; }
    $('againBtn').textContent = 'TRY AGAIN';
  } else {
    G.deaths++;
    $('overStats').innerHTML = `${G.level.id} · ${G.level.name}<br>DEATHS: ${G.deaths} <span style="opacity:.6">(each one costs a rank)</span><br>${fmtTime(G.levelTime)} · ${G.kills} KILLS`;
    $('againBtn').textContent = 'RESPAWN AT CHECKPOINT';
  }
  show('restartBtn', G.mode === 'campaign');
  show('hud', false);
  setTimeout(() => show('over', true), 600);
  sfx.explode();
}

$('resumeBtn').addEventListener('click', () => {
  G.state = 'play';
  show('pause', false);
  last = performance.now();
  requestLock();
});

document.addEventListener('pointerlockchange', () => {
  if (!locked() && G.state === 'play') { G.state = 'pause'; show('pause', true); }
});
document.addEventListener('pointerlockerror', () => {
  if (G.state === 'play' && G.input === 'kbm') { G.state = 'pause'; show('pause', true); }
});

// ---------------------------------------------------------------- settings
let settingsFrom = 'menu';
const settingsUI = initSettingsUI($('settings'), applySetting, () => closeSettings());
function openSettings(from) {
  settingsFrom = from;
  G.state = 'settings';
  show(from, false);
  show('settings', true);
  settingsUI.render();
}
function closeSettings() {
  if (G.state !== 'settings') return;
  show('settings', false);
  G.state = settingsFrom;
  show(settingsFrom, true);
  renderControls();
}
$('menuSettingsBtn').addEventListener('click', () => openSettings('menu'));
$('pauseSettingsBtn').addEventListener('click', () => openSettings('pause'));
$('quitBtn').addEventListener('click', () => toMenu());

function applyQuality() {
  const q = settings.quality;
  renderer.setPixelRatio(q === 'low' ? 0.6 : q === 'medium' ? 1 : Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  const shadows = q !== 'low';
  if (renderer.shadowMap.enabled !== shadows) {
    renderer.shadowMap.enabled = shadows;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
  }
  const size = q === 'high' ? 2048 : 1024;
  if (moon.shadow.mapSize.x !== size) {
    moon.shadow.mapSize.set(size, size);
    if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; }
  }
  embers.visible = q !== 'low';
}
function applyCrosshair() {
  const c = $('crosshair');
  c.className = settings.crosshair;
  c.style.setProperty('--ch', settings.crossColor);
  c.style.setProperty('--chs', settings.crossSize);
}
function applySetting(k) {
  if (k === 'fov') { camera.fov = settings.fov; camera.updateProjectionMatrix(); }
  if (k === 'quality') { applyQuality(); resizeFX(); AQ.reset = true; }
  if (k === 'master' || k === 'sfx') { initAudio(); applyVolume(); sfx.hit(); }
  if (k.startsWith('cross')) applyCrosshair();
  if (k === 'showFPS') show('fps', settings.showFPS);
  if (k === 'binds') renderControls();
  if (k === 'fullscreen' && !settings.fullscreen) unlockKeyboard();
}
let fpsFrames = 0, fpsLast = performance.now();
function updateFPS(now) {
  if (!settings.showFPS) return;
  fpsFrames++;
  if (now - fpsLast >= 500) {
    $('fps').textContent = Math.round((fpsFrames * 1000) / (now - fpsLast)) + ' FPS';
    fpsFrames = 0; fpsLast = now;
  }
}
function renderControls() {
  if (G.input === 'pad') {
    const p = (id) => padLabel(settings.padBinds[id]);
    $('controlsList').innerHTML = [['L-STICK', 'move'], ['R-STICK', 'aim'], [p('fire'), 'fire'], [p('alt'), 'alt fire'], [`${p('weapon1')} ${p('weapon2')} ${p('weapon3')} / ${p('swap')}`, 'weapons'], [p('punch'), 'punch / parry'],
      [p('jump'), 'jump / wall jump'], [p('dash'), 'dash'], [p('slide'), 'slide · in air: slam'], ['MENU', 'pause']].map(([a, b]) => `<div><b>${a}</b> ${b}</div>`).join('');
    return;
  }
  const k = (id) => settings.binds[id].filter(Boolean).map(keyLabel).join(' / ') || '—';
  const rows = [
    [`${k('forward')} ${k('left')} ${k('back')} ${k('right')}`, 'move'], ['MOUSE', 'aim'],
    [k('fire'), 'fire'], [k('alt'), 'alt fire'],
    [`${k('weapon1')} / ${k('weapon2')} / ${k('swap')}`, 'weapons'], [k('punch'), 'punch / parry'],
    [k('jump'), 'jump / wall jump'], [k('dash'), 'dash'],
    [k('slide'), 'slide · in air: slam'], ['ESC', 'pause'],
  ];
  $('controlsList').innerHTML = rows.map(([a, b]) => `<div><b>${a}</b> ${b}</div>`).join('');
}
camera.fov = settings.fov; camera.updateProjectionMatrix();
applyQuality();
applyCrosshair();
show('fps', settings.showFPS);
renderControls();
