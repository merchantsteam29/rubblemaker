'use strict';
// ================================================================ CAMPAIGN
const levelCtx = {
  THREE, box, torch, candle, makeWindow,
  hazard: (...a) => hazard(...a), secretWall: (...a) => secretWall(...a), furnace: (...a) => furnace(...a),
  decor: (o) => levelGroup.add(o),
  blocked: (x, z) => !!overlapBox(x - 0.9, 0.1, z - 0.9, x + 0.9, 2.2, z + 0.9),
  mats: { hidden: new THREE.MeshBasicMaterial({ visible: false }), brick: brickMat, ashlar: (() => { const m = brickMat.clone(); m.color.setHex(0xb8c8cc); return m; })(), cobble: cobbleMat, floor: floorMat, wood: woodMat, iron: ironMat, ironDark, water: waterMat, doorGlow: doorGlowMat },
};
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
const GRADES = ['D', 'C', 'B', 'A', 'S', 'RUBBLEMAKER', 'P'];
const GRADE_SHORT = ['D', 'C', 'B', 'A', 'S', 'R', 'P'];

function insideRoom(r, inset) {
  return P.pos.x > r.x0 + inset && P.pos.x < r.x1 - inset && P.pos.z > r.z0 + inset && P.pos.z < r.z1 - inset;
}
let hintT = 0;
function showHint(text) {
  const h = $('hint');
  h.textContent = text;
  h.classList.add('show');
  clearTimeout(hintT);
  hintT = setTimeout(() => h.classList.remove('show'), 5500);
}
function startRoom(r) {
  r.state = 'active';
  r.wave = 0;
  r.queue = ngWave(r.waves[0] ? r.waves[0].slice() : []);
  r.spawnT = 0.5;
  r.bossT = r.boss ? 1.6 : 0;
  for (const d of r.doorObjs) d.target = 0;
  sfx.door();
}
function clearRoom(r) {
  r.state = 'clear';
  srSplit();
  G.checkpoint = { x: r.cx, z: r.cz, yaw: P.yaw };
  for (const d of r.doorObjs) d.target = 1;
  sfx.door();
  if (r.boss && !G.layout.rooms.some((x) => x.kind === 'exit')) {
    spawnPortal(r.cx, r.cz);
  } else {
    addStyle(120, 'ROOM CLEAR', null, 'big');
    killCam(0.8, 0.22);
    heal(20);
    pushFeed('+20 HP', 'heal');
    banner('ROOM CLEAR');
  }
}
function spawnInRoom(r, type) {
  const far = r.spawns.filter(([x, z]) => Math.hypot(x - P.pos.x, z - P.pos.z) > 7);
  const pts = far.length ? far : r.spawns;
  const [x, z] = pts[(Math.random() * pts.length) | 0];
  makeEnemy(type, x + rand(-0.8, 0.8), z + rand(-0.8, 0.8), type === 'flyer' ? rand(4, 5.5) : 0);
}
let hudTimerT = 0;
function updateCampaign(dt) {
  const L = G.layout;
  if (!L) return;
  G.levelTime += dt;
  vsTick(dt);
  updateRunes(dt);
  ghostTick(dt);
  srTick();
  hudTimerT -= dt;
  if (hudTimerT <= 0) { hudTimerT = 0.2; $('wave').textContent = `${G.level.id} · ${fmtTime(G.levelTime)}`; }
  for (const r of L.rooms) {
    if (!r.visited && insideRoom(r, 0.5)) { r.visited = true; if (r.hint) showHint(r.hint); }
    if (r.state === 'idle' && insideRoom(r, 1.8)) startRoom(r);
    if (r.state !== 'active') continue;
    if (r.bossT > 0) { r.bossT -= dt; if (r.bossT <= 0) spawnBoss(r); continue; }
    r.spawnT -= dt;
    if (r.queue.length && r.spawnT <= 0) { spawnInRoom(r, r.queue.pop()); r.spawnT = 0.25; }
    if (!r.queue.length && enemies.length === 0 && !G.boss) {
      if (r.wave < r.waves.length - 1) { r.wave++; r.queue = ngWave(r.waves[r.wave].slice()); r.spawnT = 0.7; }
      else clearRoom(r);
    }
  }
  if (G.portal) {
    const pt = G.portal;
    pt.ring.rotation.z += dt * 1.5;
    pt.ring2.rotation.z -= dt * 2.2;
    pt.stones.rotation.z += dt * 0.3;
    pt.disc.material.opacity = 0.35 + Math.sin(G.time * 4) * 0.12;
    pt.g.rotation.y = Math.atan2(P.pos.x - pt.x, P.pos.z - pt.z);
    if (Math.hypot(P.pos.x - pt.x, P.pos.z - pt.z) < 1.9 && P.pos.y < 4) completeLevel();
  }
}
function updateDoors(dt) {
  if (!G.layout) return;
  for (const d of G.layout.doors) {
    if (d.t !== d.target) d.t += Math.sign(d.target - d.t) * Math.min(Math.abs(d.target - d.t), dt * 2.2);
    d.mesh.position.y = d.baseY - (d.h + 0.3) * d.t;
    d.solid.active = d.t < 0.6;
    d.strip.material.color.setHex(d.target ? 0x3aff6a : 0xff3a1a);
  }
}
function spawnPortal(x, z) {
  const { g, ring, ring2, disc, stones } = buildPortal(GLOW);
  g.position.set(x, 2.1, z);
  levelGroup.add(g);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.3, 8), ironMat);
  base.position.set(x, 0.15, z);
  levelGroup.add(base);
  G.portal = { g, ring, ring2, disc, stones, x, z };
  if (G.state === 'play') { sfx.portal(); showHint('The way out is open — step into the portal'); }
}

function loadProgress() {
  try { return Object.assign({ unlocked: 0, best: {} }, JSON.parse(localStorage.getItem('rubblemaker-progress') || '{}')); } catch (_) { return { unlocked: 0, best: {} }; }
}
function saveProgress(p) { PROGC = p; try { localStorage.setItem('rubblemaker-progress', JSON.stringify(p)); } catch (_) {} }

function completeLevel() {
  if (G.state !== 'play') return;
  if (VS.active) { vsFinish(); return; }
  G.state = 'complete';
  document.exitPointerLock?.();
  show('hud', false);
  hideBeam();
  sfx.portal();
  const lv = G.level, t = G.levelTime;
  const gTime = t <= lv.par ? 4 : t <= lv.par * 1.3 ? 3 : t <= lv.par * 1.7 ? 2 : t <= lv.par * 2.3 ? 1 : 0;
  const sr = G.styleTotal / G.styleTarget;
  const gStyle = sr >= 1 ? 4 : sr >= 0.75 ? 3 : sr >= 0.5 ? 2 : sr >= 0.3 ? 1 : 0;
  const dmg = Math.round(G.dmgTaken);
  const dn = dmg / (DIFF().dmg || 1);
  const gDmg = dn <= 40 ? 4 : dn <= 120 ? 3 : dn <= 250 ? 2 : dn <= 450 ? 1 : 0;
  const perfect = gTime === 4 && gStyle === 4 && gDmg === 4;
  const pRank = !G.deaths && gTime === 4 && gStyle === 4 && G.bestRank >= RANKS.length - 1;
  const overall = pRank ? 6 : Math.max(0, (perfect && !G.deaths ? 5 : Math.min(4, Math.round((gTime + gStyle + gDmg) / 3))) - G.deaths);
  const prog = loadProgress();
  if (!lv.duel) prog.unlocked = Math.max(prog.unlocked, G.levelIdx + 1);
  const bk = bestKey(lv);
  const best = prog.best[bk];
  const newBest = !best || overall > best.rank || (overall === best.rank && t < best.time);
  if (newBest && !cheatsOn()) prog.best[bk] = { rank: overall, time: t };
  ghostSave(t);
  const earned = Math.round((100 + Math.floor(G.styleTotal / 10) + [0, 25, 50, 100, 150, 300, 500][overall]) * (DIFF().scrap || 1));
  prog.scrap = (prog.scrap || 0) + earned;
  saveProgress(prog);
  statLevelDone(overall, t, earned);
  const runLine = srFinish(lv, t);
  const g = (i) => `<span class="g g${GRADE_SHORT[i]}">${GRADE_SHORT[i]}</span>`;
  $('completeLevel').textContent = `${levelActLabel(lv)} · ${lv.id} · ${lv.name}`;
  $('completeStats').innerHTML =
    `<span>TIME</span><span>${fmtTime(t)} <small style="opacity:.5">/ ${fmtTime(lv.par)}</small></span>${g(gTime)}` +
    `<span>STYLE</span><span>${Math.floor(G.styleTotal).toLocaleString()}</span>${g(gStyle)}` +
    `<span>DAMAGE TAKEN</span><span>${dmg}</span>${g(gDmg)}` +
    `<span>KILLS</span><span>${G.kills}</span><span></span>` +
    `<span>DEATHS</span><span>${G.deaths}${G.deaths ? ' <small style="opacity:.6">(-' + G.deaths + ' rank)</small>' : ''}</span><span></span>` +
    `<span>SCRAP EARNED</span><span class="scrap">+${earned} ◆</span><span></span>` +
    runLine + (pRank ? `<span class="pLine">PERFECT RUN</span><span>no deaths · under par · style met · RUBBLEMAKER reached</span><span class="g gP">P</span>` : '');
  const rk = $('completeRank');
  rk.textContent = GRADES[overall] + (newBest ? '' : '');
  rk.className = `g${GRADE_SHORT[overall]}${overall >= 5 ? ' top' : ''}`;
  const hasNext = !lv.duel && G.levelIdx + 1 < LEVELS.length && !LEVELS[G.levelIdx + 1].duel;
  show('nextBtn', hasNext);
  if (hasNext) $('nextBtn').textContent = `NEXT: ${LEVELS[G.levelIdx + 1].id} ${LEVELS[G.levelIdx + 1].name}`;
  const fin = () => setTimeout(() => { show('complete', true); sfx.rankUp(); }, 300);
  showVariantPick();
  if (lv.id === '6-2' && !cutsSeen().twist) playStoryEnd('twist', fin);
  else if (lv.id === '9-2' && !cutsSeen().finale) playStoryEnd('finale', fin);
  else fin();
}

function openLevels() {
  initAudio();
  G.state = 'levels';
  show('menu', false); show('complete', false); show('over', false);
  renderLevels();
  show('levels', true);
}
function enterPlay() {
  G.state = 'play';
  for (const id of ['menu', 'over', 'pause', 'levels', 'complete', 'settings']) show(id, false);
  show('hud', true);
  last = performance.now();
  requestLock();
}
function startLevel(idx) {
  initAudio();
  const lv = LEVELS[idx];
  if (!lv) return;
  G.mode = 'campaign'; G.levelIdx = idx; G.level = lv;
  resetGame();
  clearLevelGeometry();
  setLook(lv.theme);
  const layout = buildLevel(lv, levelCtx);
  G.layout = layout;
  G.ceil = layout.theme.wallH - 0.8;
  for (const r of layout.rooms) if (r.kind === 'exit') spawnPortal(r.cx, r.cz);
  placeForgeInStart(layout);
  P.pos.set(layout.start.x, 0, layout.start.z);
  P.yaw = layout.start.yaw;
  G.spawn = P.pos.clone();
  G.deaths = 0;
  G.checkpoint = { x: P.pos.x, z: P.pos.z, yaw: P.yaw };
  ghostStart(lv);
  srStart(lv, idx);
  G.styleTarget = Math.max(500, layout.rooms.reduce((s, r) => s + r.waves.reduce((a, w) => a + w.length, 0) * 80 + (r.boss ? 1200 : 0), 0));
  $('wave').textContent = lv.id;
  const go = () => { enterPlay(); banner(`${lv.id} ${lv.name}`); };
  if (!maybeStory(lv, go)) go();
}
function startEndless() {
  initAudio();
  G.mode = 'endless'; G.level = null; G.layout = null;
  resetGame();
  clearLevelGeometry();
  buildArena();
  placeForge(0, 19.5, Math.PI);
  setLook('pit');
  G.ceil = 11;
  G.spawn = new V3(0, 0, 12);
  enterPlay();
}
function toMenu() {
  show('tut', false); show('srTimer', false); TUT = null;
  if (VS && VS.active) {
    if (!VS.myDone) vsSend({ t: 'quit' });
    show('vsSpec', false);
    VS.active = false; VS.result = null; VS.fx = {}; G.lowgrav = false;
    show('vsHud', false); show('vsCount', false); show('vsResult', false); $('vsCurseFx').className = 'hidden';
    if (VS.rival.mesh) { scene.remove(VS.rival.mesh); VS.rival.mesh = null; }
    normalizeLoadout();
  }
  clearWorld();
  resetGame();
  G.layout = null; G.level = null; G.mode = 'endless';
  clearLevelGeometry();
  buildArena();
  placeForge(0, 19.5, Math.PI);
  setLook('pit');
  G.state = 'menu';
  for (const id of ['pause', 'hud', 'over', 'complete', 'levels', 'settings']) show(id, false);
  show('menu', true);
  renderBest();
  spawnMenuCrowd();
}
function menuish() {
  return G.state === 'menu' || G.state === 'levels' || G.state === 'records' || G.state === 'codex' || G.state === 'versus' || (G.state === 'settings' && settingsFrom === 'menu');
}

$('startBtn').addEventListener('click', openLevels);
$('pitBtn').addEventListener('click', startEndless);
$('levelsBack').addEventListener('click', () => { G.state = 'menu'; show('levels', false); show('menu', true); });
$('againBtn').addEventListener('click', () => (G.mode === 'endless' ? startEndless() : respawnCheckpoint()));
$('restartBtn').addEventListener('click', () => startLevel(G.levelIdx));
$('overMenuBtn').addEventListener('click', toMenu);
$('nextBtn').addEventListener('click', () => { SR.nextOk = true; startLevel(G.levelIdx + 1); });
$('retryBtn').addEventListener('click', () => startLevel(G.levelIdx));
$('completeMenuBtn').addEventListener('click', () => { toMenu(); openLevels(); });
addEventListener('pointerdown', () => initAudio(), { once: true });

// ================================================================ MUSIC
let music = null, musicBus = null;
function ensureMusic() {
  if (music || !AC) return;
  musicBus = AC.createGain();
  musicBus.connect(master);
  music = createMusic(AC, musicBus, noiseBuf);
  applyVolume();
  music.start();
}
function updateMusic() {
  if (!music) return;
  let theme = 'menu', int = 0, hz = 18000;
  const inGame = G.state === 'play' || G.state === 'pause' || G.state === 'shop' || (G.state === 'settings' && settingsFrom === 'pause');
  if (inGame) {
    theme = G.boss ? 'boss' : G.mode === 'endless' ? ({ pit: 'pit', cellar: 'cellar', nave: 'cathedral', kiln: 'kiln', aqueduct: 'aqueduct' }[pitKind] || 'pit') : G.level ? G.level.theme : 'cellar';
    const fighting = enemies.length > 0 || !!G.boss;
    // the style rank drives the mix: D/C = groove, B/A = chug, S..SSS = lead, RUBBLEMAKER = everything
    int = fighting ? [2, 2, 3, 3, 4, 4, 4, 5][ST.idx] || 2 : 1;
    if (G.boss) int = Math.max(3, int);
    hz = 6000 + ST.idx * 2000;
    if (G.state !== 'play') { int = Math.min(int, 1); hz = 1500; }
    else if (P.hp < 30) hz = 700 + P.hp * 50;
  } else if (G.state === 'complete') {
    theme = G.level ? G.level.theme : 'menu'; int = 1;
  } else if (G.state === 'cutscene') {
    const bossCut = CUT && /^boss/.test(CUT.id);
    theme = bossCut ? 'boss' : G.level ? G.level.theme : 'menu'; int = bossCut ? 1 : 0; hz = 9000;
  }
  music.setTheme(theme);
  music.setIntensity(int);
  if (Math.abs(hz - (music.hz || 0)) > 40) { music.hz = hz; music.setTone(hz); }
  music.update();
  tickAudio(theme);
}

// ================================================================ LOADOUT, SHOP & ECONOMY
const VARIANTS = [
  [{ name: 'LANCE', hex: 0x3ac8ff, css: '#6ad8ff' }, { name: 'CHAINLINK', hex: 0x4aff6a, css: '#6dff8f' }, { name: 'COINSHOT', hex: 0xff4a3a, css: '#ff6a5a' }],
  [{ name: 'FURNACE', hex: 0xff7a2a, css: '#ffa04a' }, { name: 'OVERPRESSURE', hex: 0x4aff6a, css: '#6dff8f' }, { name: 'SAWBLADE', hex: 0xff3a4a, css: '#ff6a5a' }],
];
const SHOP = [
  { id: 'shotgun', gun: 1, v: 0, price: 200, desc: 'Unlocks the SHOTGUN. FURNACE alt-fire lobs an explosive core: shoot it with the revolver for a COMBO BLAST.' },
  { id: 'rev1', gun: 0, v: 1, price: 450, desc: 'Revolver variant. Charge ALT to fire a shot that CHAINS between up to 5 enemies and BANKS off walls.' },
  { id: 'shot1', gun: 1, v: 1, price: 550, req: 'shotgun', desc: 'Shotgun variant. Tap ALT to PUMP up to 3 times for a bigger blast. Three pumps detonates in your face (worth it).' },
  { id: 'rev2', gun: 0, v: 2, price: 700, desc: 'Revolver variant. ALT flips a COIN. Shoot it and the bullet redirects into the nearest head. Coins chain.' },
  { id: 'shot2', gun: 1, v: 2, price: 800, req: 'shotgun', desc: 'Shotgun variant. ALT launches a SAWBLADE that grinds through enemies and bounces off walls.' },
];
let PROGC = null;
function prog() { return PROGC || (PROGC = loadProgress()); }
function owns(id) { if ((G.mode === 'practice' || (VS && VS.active)) && !id.startsWith('skin_')) return true; return (prog().owned || []).includes(id); }
function ownsVariant(gun, v) { return v === 0 ? gun === 0 || owns(['', 'shotgun', 'nailgun', 'launcher', 'flail'][gun]) : owns(['rev', 'shot', 'nail', 'brick', 'flail'][gun] + v); }
function applyVariantLook() {
  chargeMat.emissive.setHex(VARIANTS[0][W.variant[0]].hex);
  VM.shotAccent.emissive.setHex(VARIANTS[1][W.variant[1]].hex);
  if (VARIANTS[2]) VM.nailAccent.emissive.setHex(VARIANTS[2][W.variant[2]].hex);
  if (VARIANTS[3]) VM.launcherAccent.emissive.setHex(VARIANTS[3][W.variant[3]].hex);
  const s5 = document.querySelector('#weaponSlots span[data-w="4"]');
  if (s5) s5.textContent = owns('flail') ? '5 FLAIL' : '5 LOCKED';
  const s4 = document.querySelector('#weaponSlots span[data-w="3"]');
  if (s4) s4.textContent = owns('launcher') ? '4 LAUNCHER' : '4 LOCKED';
  const s3 = document.querySelector('#weaponSlots span[data-w="2"]');
  if (s3) s3.textContent = owns('nailgun') ? '3 NAILGUN' : '3 LOCKED';
  const slot = document.querySelector('#weaponSlots span[data-w="1"]');
  if (slot) slot.textContent = owns('shotgun') ? '2 SHOTGUN' : '2 LOCKED';
}
function normalizeLoadout() {
  for (const g of [0, 1, 2, 3, 4]) if (!ownsVariant(g, W.variant[g])) W.variant[g] = 0;
  if (!ownedArms().includes(W.arm)) W.arm = 'fist';
  W.heat = 0; W.overheat = 0; W.shockCharge = 0;
  updateArmSlot();
  W.pump = 0; W.coins = 4; W.sawCD = 0;
  applyVariantLook();
}
function cycleVariant(gun) {
  if (gun === 1 && !owns('shotgun')) return;
  for (let k = 1; k <= 3; k++) {
    const v = (W.variant[gun] + k) % 3;
    if (ownsVariant(gun, v)) {
      if (v === W.variant[gun]) { pushFeed('More variants at the FORGE', ''); return; }
      W.variant[gun] = v;
      W.charging = false; W.charge = 0; W.pump = 0;
      W.switchT = 0.14;
      applyVariantLook();
      sfx.pump();
      pushFeed(VARIANTS[gun][v].name, 'cool');
      return;
    }
  }
}

// ---- THE FORGE station
let forge = null;
function placeForge(x, z, yaw) {
  const g = buildForge(GLOW);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  levelGroup.add(g);
  solids.push({ min: new V3(x - 1.4, 0, z - 1.4), max: new V3(x + 1.4, 1.0, z + 1.4), active: true });
  torches.push({ pos: new V3(x, 1.6, z), flame: new THREE.Object3D(), ph: 3, small: false });
  forge = { x, z };
}
function placeForgeInStart(layout) {
  const first = layout.rooms[0];
  const side = first.doors[0] ? first.doors[0].side : 'N';
  const D = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[side];
  const half = (D[0] ? first.w : first.d) / 2 - 2.2;
  placeForge(first.cx - D[0] * half, first.cz - D[1] * half, Math.atan2(D[0], D[1]));
}
let promptShown = false;
function updateForge() {
  if (!forge) return;
  const near = Math.hypot(P.pos.x - forge.x, P.pos.z - forge.z) < 3.4;
  if (near !== promptShown) {
    promptShown = near;
    $('prompt').textContent = `[${actLabel('interact')}] OPEN THE FORGE`;
    $('prompt').classList.toggle('show', near);
  }
  if (near && hit('interact')) openShop();
}
function openShop() {
  G.state = 'shop';
  keys.clear();
  document.exitPointerLock?.();
  renderShop();
  show('shop', true);
  sfx.door();
}
function closeShop() {
  if (G.state !== 'shop') return;
  show('shop', false);
  G.state = 'play';
  last = performance.now();
  requestLock();
}
function renderShop() {
  const p = prog();
  $('scrapTotal').textContent = `◆ ${p.scrap || 0} SCRAP`;
  $('shopList').innerHTML = SHOP.map((it) => {
    const vd = VARIANTS[it.gun][it.v];
    const have = owns(it.id);
    const blocked = it.req && !owns(it.req);
    const afford = (p.scrap || 0) >= it.price;
    const btn = have ? '<button disabled class="owned">OWNED</button>'
      : it.from ? `<button disabled class="from">WIN IT FROM ${it.from}</button>`
      : blocked ? `<button disabled>NEEDS ${it.req.toUpperCase()}</button>`
      : `<button data-buy="${it.id}" ${afford ? '' : 'disabled'}>◆ ${it.price}</button>`;
    return `<div class="item ${have ? 'have' : ''}"><div class="sw" style="background:${vd.css}"></div><div class="txt"><b>${WNAMES[it.gun]} · <span style="color:${vd.css}">${vd.name}</span></b><p>${it.desc}</p></div>${btn}</div>`;
  }).join('') + `<p class="hint">Swap variants in a fight by pressing the gun's number key again. Earn SCRAP by finishing levels (better rank = more) and in the RUBBLE PIT.</p>`;
  $('shopList').querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.buy)));
  renderSkins();
}
function buy(id) {
  const it = SHOP.find((x) => x.id === id);
  const p = prog();
  if (!it || it.from || owns(id) || (p.scrap || 0) < it.price) return;
  p.scrap -= it.price;
  STATS.scrapSpent += it.price;
  p.owned = [...(p.owned || []), id];
  saveProgress(p);
  sfx.buy();
  W.variant[it.gun] = it.v;
  applyVariantLook();
  renderShop();
}
function awardScrap(n) {
  const p = loadProgress();
  p.scrap = (p.scrap || 0) + n;
  saveProgress(p);
}
$('shopClose').addEventListener('click', closeShop);
