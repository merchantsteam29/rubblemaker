'use strict';
// ================================================================ BATCH 4.4a: LIFETIME STATS
var STATS = null;
const STATS_KEY = 'rubblemaker-stats';
function freshStats() { return { v: 1, kills: 0, by: {}, wk: {}, time: 0, deaths: 0, shots: 0, hits: 0, labels: {}, bosses: {}, met: {}, pRanks: 0, levels: 0, scrapEarned: 0, scrapSpent: 0, bestChain: 0, pitBestWave: 0, maxRank: 0, flags: {}, ach: {} }; }
function loadStats() {
  try { STATS = Object.assign(freshStats(), JSON.parse(localStorage.getItem(STATS_KEY) || '{}')); } catch (_) { STATS = freshStats(); }
  return STATS;
}
function saveStats() { try { localStorage.setItem(STATS_KEY, JSON.stringify(STATS)); } catch (_) {} }
loadStats();
const statsLive = () => G.mode !== 'practice' && !cheatsOn() && !(VS && VS.active);
function statLabel(label) {
  if (!statsLive()) return;
  const k = String(label).replace(/ x\d+$/, '');
  STATS.labels[k] = (STATS.labels[k] || 0) + 1;
  if (CHAIN.n > STATS.bestChain) STATS.bestChain = CHAIN.n;
  if (ST.idx > STATS.maxRank) STATS.maxRank = ST.idx;
}
function statKill(e, info) {
  if (!statsLive() || e.dummy) return;
  STATS.kills++;
  STATS.by[e.type] = (STATS.by[e.type] || 0) + 1;
  const w = (info && info.weapon) || 'world';
  STATS.wk[w] = (STATS.wk[w] || 0) + 1;
  if (e.def.boss) STATS.bosses[e.type] = (STATS.bosses[e.type] || 0) + 1;
}
function statMet(type) { if (G.mode === 'practice' || STATS.met[type]) return; STATS.met[type] = 1; }
let shotTok = 0, hitTok = -1;
function statShot() { if (!statsLive()) return; STATS.shots++; shotTok++; }
function statHit() { if (!statsLive() || hitTok === shotTok) return; hitTok = shotTok; STATS.hits++; }
function statLevelDone(overall, t, earned) {
  if (!statsLive()) return;
  STATS.levels++;
  STATS.scrapEarned += earned;
  if (overall === 6) STATS.pRanks++;
  if (G.dmgTaken === 0) STATS.flags.untouched = true;
  if (settings.difficulty === 'brutal') STATS.flags.brutal = true;
  saveStats(); checkAch();
}
setInterval(() => {
  if (G.state === 'play' && statsLive()) {
    STATS.time++;
    if (G.mode === 'endless' && G.wave > STATS.pitBestWave) STATS.pitBestWave = G.wave;
  }
  if (STATS.time % 10 === 0) saveStats();
  checkAch();
}, 1000);
addEventListener('pagehide', saveStats);

// ================================================================ BATCH 4.4a: ACHIEVEMENTS
Object.assign(SKINS, {
  chrome: { name: 'CHROME', steel: 0xe8eef8, dsteel: 0x9aa4b8, brass: 0x6ad8ff, em: 0x0a1420 },
  void: { name: 'VOID', steel: 0x16101e, dsteel: 0x08060c, brass: 0xb04aff, em: 0x2a0a4a },
  mason: { name: 'MASTER MASON', steel: 0xb8402a, dsteel: 0x6a2414, brass: 0xe8dcc0, em: 0x200804 },
});
applySkin();
const statL = (k) => (STATS.labels[k] || 0);
const beaten = (id) => Object.keys(prog().best || {}).some((k) => k === id || k.startsWith(id + ':'));
const TRAINERS = ['bulwark', 'sweeper', 'roost', 'kiln', 'mirror', 'marksman', 'fortress', 'queen', 'anvil', 'bellows', 'crane'];
const ACHS = [
  { id: 'first', name: 'FIRST BRICK', desc: 'Kill your first enemy', p: () => [STATS.kills, 1], scrap: 50 },
  { id: 'k500', name: 'RUBBLE RUBBLE', desc: 'Kill 500 enemies', p: () => [STATS.kills, 500], scrap: 250 },
  { id: 'k2500', name: 'DEMOLITION CREW', desc: 'Kill 2,500 enemies', p: () => [STATS.kills, 2500], scrap: 600 },
  { id: 'parry100', name: 'RETURN TO SENDER', desc: 'Parry 100 orbs', p: () => [statL('PARRY') + statL('SHOCK PARRY'), 100], scrap: 300 },
  { id: 'parry500', name: 'MIRROR MIRROR', desc: 'Parry 500 orbs', p: () => [statL('PARRY') + statL('SHOCK PARRY'), 500], skin: 'chrome' },
  { id: 'head', name: 'HEADHUNTER', desc: 'Land 250 headshot kills', p: () => [statL('HEADSHOT'), 250], scrap: 300 },
  { id: 'combo', name: 'COMBO ARTIST', desc: 'Set off 50 COMBO BLASTS', p: () => [statL('COMBO BLAST'), 50], scrap: 300 },
  { id: 'coin', name: 'COIN OPERATED', desc: '50 coin tricks (COINSHOT, BANKSHOT, COIN CHAIN)', p: () => [statL('COINSHOT') + statL('BANKSHOT') + statL('COIN CHAIN'), 50], scrap: 300 },
  { id: 'arsenal', name: 'FULL ARSENAL', desc: 'Hit the same target with every gun in one swap chain', p: () => [statL('FULL ARSENAL'), 1], scrap: 200 },
  { id: 'chain8', name: 'CHAIN GANG', desc: 'Build a swap chain of 8', p: () => [STATS.bestChain, 8], scrap: 300 },
  { id: 'rubble', name: 'STYLE ICON', desc: 'Reach the RUBBLEMAKER style rank', p: () => [STATS.maxRank >= RANKS.length - 1 ? 1 : 0, 1], scrap: 200 },
  { id: 'p1', name: 'PERFECTIONIST', desc: 'Earn a P-rank', p: () => [STATS.pRanks, 1], scrap: 300 },
  { id: 'p10', name: 'P FOR PERFECT', desc: 'Earn 10 P-ranks', p: () => [STATS.pRanks, 10], scrap: 800 },
  { id: 's0', name: 'CELLAR CLEARED', desc: 'Beat ACT I: THE CELLAR', p: () => [beaten('0-5') ? 1 : 0, 1], scrap: 200 },
  { id: 's1', name: 'CATHEDRAL CLEARED', desc: 'Beat ACT II: THE CATHEDRAL', p: () => [beaten('3-2') ? 1 : 0, 1], scrap: 400 },
  { id: 's2', name: 'KILN CLEARED', desc: 'Beat ACT III: THE KILN', p: () => [beaten('6-2') ? 1 : 0, 1], scrap: 600 },
  { id: 'trainers', name: 'SCHOOLED', desc: 'Beat every trainer', p: () => [TRAINERS.filter((t) => STATS.bosses[t]).length, TRAINERS.length], scrap: 500 },
  { id: 'duels', name: 'DUELIST', desc: 'Win every duel reward', p: () => [DUELS.filter((d) => (prog().owned || []).includes(duelPrize(d.duel))).length, DUELS.length], scrap: 600 },
  { id: 'primes', name: 'PRIME TIME', desc: 'Beat all three PRIME rematches', p: () => [PRIMES.filter((d) => beaten(d.id)).length, PRIMES.length], skin: 'void' },
  { id: 'pit10', name: 'PIT DWELLER', desc: 'Reach wave 10 in the RUBBLE PIT', p: () => [STATS.pitBestWave, 10], scrap: 200 },
  { id: 'pit20', name: 'PIT BOSS', desc: 'Reach wave 20 in the RUBBLE PIT', p: () => [STATS.pitBestWave, 20], scrap: 400 },
  { id: 'pit30', name: 'BOTTOMLESS', desc: 'Reach wave 30 in the RUBBLE PIT', p: () => [STATS.pitBestWave, 30], scrap: 800 },
  { id: 'skull10', name: 'GRAVE ROBBER', desc: 'Find 10 secret skulls', p: () => [skullCount(prog()), 10], scrap: 300 },
  { id: 'skulls', name: 'ARCHAEOLOGIST', desc: 'Find every secret skull', p: () => [skullCount(prog()), TOTAL_SKULLS], scrap: 600 },
  { id: 'slam', name: 'GROUND POUNDER', desc: 'Land 100 GROUND SLAM hits', p: () => [statL('GROUND SLAM'), 100], scrap: 200 },
  { id: 'env', name: 'HOME HAZARD', desc: 'Kill 25 enemies with lava, vents or crushers', p: () => [statL('MELTED') + statL('TORCHED') + statL('CRUSHED'), 25], scrap: 250 },
  { id: 'brick', name: 'BRICKLAYER', desc: 'Kill 200 enemies with the LAUNCHER', p: () => [STATS.wk.launcher || 0, 200], scrap: 300 },
  { id: 'arms', name: 'WRECKING BALL', desc: 'Kill 100 enemies with your arms', p: () => [['punch', 'blade', 'shock', 'grapple', 'slam'].reduce((a, k) => a + (STATS.wk[k] || 0), 0), 100], scrap: 300 },
  { id: 'untouched', name: 'UNTOUCHABLE', desc: 'Clear a level without taking damage', p: () => [STATS.flags.untouched ? 1 : 0, 1], scrap: 300 },
  { id: 'brutal', name: 'BRUTAL HONESTY', desc: 'Clear a level on BRUTAL', p: () => [STATS.flags.brutal ? 1 : 0, 1], scrap: 400 },
  { id: 'shop', name: 'FULLY STOCKED', desc: 'Own every gun and variant the FORGE sells', p: () => [SHOP.filter((it) => (prog().owned || []).includes(it.id)).length, SHOP.length], scrap: 500 },
  { id: 'all', name: 'MASTER MASON', desc: 'Unlock every other achievement', p: () => [ACHS.filter((a) => a.id !== 'all' && STATS.ach[a.id]).length, ACHS.length - 1], skin: 'mason' },
];
const achQueue = [];
let achShowing = false;
function checkAch() {
  if (!STATS || cheatsOn()) return;
  let any = false;
  for (const a of ACHS) {
    if (STATS.ach[a.id]) continue;
    let ok = false;
    try { const [c, m] = a.p(); ok = c >= m; } catch (_) {}
    if (!ok) continue;
    STATS.ach[a.id] = Date.now(); any = true;
    if (a.scrap) { awardScrap(a.scrap); STATS.scrapEarned += a.scrap; }
    if (a.skin) { const p = loadProgress(); p.owned = p.owned || []; if (!p.owned.includes('skin_' + a.skin)) p.owned.push('skin_' + a.skin); saveProgress(p); }
    achQueue.push(a);
  }
  if (any) { saveStats(); showAchToast(); }
}
function showAchToast() {
  if (achShowing || !achQueue.length) return;
  const a = achQueue.shift();
  achShowing = true;
  const el = $('achToast');
  el.innerHTML = `<small>ACHIEVEMENT UNLOCKED</small><b>${a.name}</b><span>${a.desc}</span><em>${a.scrap ? '+' + a.scrap + ' ◆ SCRAP' : SKINS[a.skin].name + ' GUN SKIN'}</em>`;
  el.classList.add('show');
  try { sfx.rankUp(); } catch (_) {}
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => { achShowing = false; showAchToast(); }, 500); }, 3600);
}

// ================================================================ BATCH 4.4a: CODEX
const CODEX_BEASTS = [
  ['grunt', 'BRICK GRUNT', 'ENEMY', 'Kiln workers the Foreman fired one time too many. Their mortar hearts beat on out of spite. They come in crowds.'],
  ['shooter', 'SPITTER', 'ENEMY', 'Grunts whose throats were packed with live coals. They lob glowing orbs. Punch the orbs back.'],
  ['flyer', 'GARGOYLE', 'ENEMY', 'Roof gargoyles shaken loose by the Architect. They circle, they screech, then they dive. Shoot them on the way down.'],
  ['heavy', 'HEAVY', 'ENEMY', 'Foundation stones given legs. Slow, but each stomp sends a shockwave along the floor. Jump it.'],
  ['shield', 'SHIELDBEARER', 'ENEMY', 'Carries a cathedral door as a shield. Flank it, or break the door with explosions, slams or the GRAPPLE.'],
  ['sniper', 'SNIPER', 'ENEMY', 'A surveyor still sighting along his theodolite. When the red line flashes white, PUNCH it and his shot goes back to him.'],
  ['bomber', 'BOMBER', 'ENEMY', 'A walking kiln charge. Pop it at range and the blast hurts its friends instead of you.'],
  ['priest', 'PRIEST', 'ENEMY', 'He blesses the rubble so it keeps fighting, and his wards halve the damage they take. Kill him first.'],
  ['ram', 'RAM', 'ENEMY', 'It paws the ground and then charges. Dash aside and let it plough into a wall, or into its friends.'],
  ['burrower', 'BURROWER', 'ENEMY', 'It tunnels under the floor and bursts up under you. A GROUND SLAM digs it out.'],
  ['mender', 'MENDER', 'ENEMY', 'An apprentice that still repairs bricks, even living ones. It beams health into its allies and can stitch the dead back together.'],
  ['swarmling', 'SWARMLING', 'ENEMY', 'A brick-chip wasp, bred by the Swarm Queen. Alone it is nothing. They never come alone.'],
  ['bulwark', 'THE BULWARK', 'TRAINER', 'LESSON I · THE PARRY. Bullets glance off him. Punch his big orb back into his face.'],
  ['sweeper', 'THE SWEEPER', 'TRAINER', 'LESSON II · THE DASH. His waves are too tall to jump over. Dash straight through them.'],
  ['roost', 'THE ROOST', 'TRAINER', 'LESSON III · THE AIR. She only flinches when you are airborne, or when a slam lands under her.'],
  ['kiln', 'THE KILN', 'TRAINER', 'LESSON IV · THE RETURN TO SENDER. A walking furnace that spits fire. Only its own spit, punched back, cracks it.'],
  ['mirror', 'THE MIRROR KNIGHT', 'TRAINER', 'LESSON V · THE RICOCHET. Only bounced shots hurt him: coins and chainlink banks.'],
  ['marksman', 'THE MARKSMAN', 'TRAINER', 'LESSON VI · THE COUNTERSNIPE. He only falls to his own bullets. Punch the moment his laser flashes.'],
  ['fortress', 'THE FORTRESS', 'TRAINER', 'LESSON VII · THE SHIELD BREAK. Three layers of shield. Strip them with explosions, slams, shockwaves or the grapple.'],
  ['queen', 'THE SWARM QUEEN', 'TRAINER', 'LESSON VIII · THE SWARM. Only the nailgun reaches her. Stick a LODESTONE magnet on her and spray.'],
  ['anvil', 'THE ANVIL', 'TRAINER', 'LESSON IX · THE BLADE. An iron smith-golem. Bullets ring off him; only the BLADE arm cuts.'],
  ['bellows', 'THE BELLOWS', 'TRAINER', 'LESSON X · THE CHARGED SHOCKWAVE. A furnace lung on legs. Charge the SHOCKWAVE fist to 3+ bars.'],
  ['crane', 'THE CRANE', 'TRAINER', 'LESSON XI · THE GRAPPLE. It hangs out of reach. Hook it, drag it down, then unload.'],
  ['shard', 'SISTER SHARD', 'DUELIST', 'A stained-glass saint who still guards the chapel. Strike her while she is in her stance and she reflects the blow. She duels with honour.'],
  ['bertha', 'BIG BERTHA', 'DUELIST', 'Champion of the cellar fight ring. Her fist hits like a shockwave, and she will teach you how.'],
  ['kite', 'KITE', 'DUELIST', 'A chimney sweep who swings through the rafters on a hook and line. Catch him to earn it.'],
  ['tumble', 'TUMBLE', 'DUELIST', 'One half of the kiln circus act. The heavy half.'],
  ['twirl', 'TWIRL', 'DUELIST', 'The other half of the act. The fast half. Beat both of them.'],
  ['cat', 'CINDER', 'DUELIST', 'The kiln-cat. She sleeps on the warmest bricks and leaves a trail of fire wherever she runs.'],
  ['gilded', 'THE GILDED ONE', 'DUELIST', 'He waits for whoever finds every skull. Nobody knows what he was before the gold.'],
  ['boss1', 'MORTIMER', 'BOSS', 'WARDEN OF THE CELLAR. The guild\'s old gaoler, mortared into his own vault. He let the Foreman in.'],
  ['boss2', 'THE HIGH MASON', 'BOSS', 'ARCHITECT OF RUIN. He drew up the guild\'s plans and then sold them. The cathedral is his blueprint, and he rearranges it as you fight.'],
  ['boss3', 'THE MOLTEN FOREMAN', 'BOSS', 'MASTER OF THE KILN. He fires bricks, then workers, then the whole city. He is the reason you were made.'],
];
const ARSENAL = () => {
  const gunDesc = (g, v) => (g === 0 && v === 0 ? 'Your starting sidearm. Hold ALT to charge a piercing LANCE shot through a whole line of enemies.' : (SHOP.find((it) => it.gun === g && it.v === v) || {}).desc || '');
  const guns = [0, 1, 2, 3, 4].map((g) => ({ head: WNAMES[g], rows: VARIANTS[g].map((vd, v) => ({ name: vd.name, css: vd.css, owned: ownsVariant(g, v), desc: gunDesc(g, v) })) }));
  const arms = { head: 'ARMS', rows: [
    { name: 'PUNCH', css: '#ffd04a', owned: true, desc: `${actLabel('punch')} punches. Punch a glowing orb to PARRY it back, or punch a shotgun core for a CORE PUNCH.` },
    { name: 'BLADE', css: '#9ae8ff', owned: owns('arm_blade'), desc: 'Slices orbs out of the air and CLEAVES groups of enemies. Won from SISTER SHARD.' },
    { name: 'SHOCKWAVE', css: '#ff8a2a', owned: owns('arm_shock'), desc: 'Hold to charge, release for a cone blast that throws enemies and parries orbs. Won from BIG BERTHA.' },
    { name: 'GRAPPLE', css: '#c8a070', owned: owns('arm_grapple'), desc: 'Hook walls to swing, yank light enemies to you, rip shields away. Won from KITE.' },
    { name: 'TIDE', css: '#6ad8ff', owned: owns('arm_tide'), desc: 'Tap for a WAVE that pushes, parries orbs and douses EMBER elites. Hold to drag enemies in with the UNDERTOW, release for a RIPTIDE. Won from THE DREDGER.' },
  ] };
  const moves = { head: 'MOVES', rows: [
    { name: 'DASH', css: '#6ad8ff', owned: true, desc: `${actLabel('dash')}: invulnerable burst, 3 charges. Dash through attacks for DODGE style.` },
    { name: 'SLIDE', css: '#6ad8ff', owned: true, desc: `${actLabel('slide')} on the ground: fast and low. Kills while sliding earn SLIDE KILL.` },
    { name: 'GROUND SLAM', css: '#6ad8ff', owned: true, desc: `${actLabel('slide')} in mid-air: crash down with a shockwave. It digs out burrowers.` },
    { name: 'WALL JUMP', css: '#6ad8ff', owned: true, desc: `${actLabel('jump')} against a wall. 3 in a row before you need to touch the floor.` },
    { name: 'SWAP CHAIN', css: '#6ad8ff', owned: true, desc: 'Hit the same enemy with different weapons in quick succession for bonus damage. Use all of them for FULL ARSENAL.' },
    { name: 'DOUBLE JUMP', css: '#ffd04a', owned: owns('up_djump'), desc: 'A second jump in mid-air. Won from TUMBLE & TWIRL.' },
    { name: 'FIRE DASH', css: '#ff6a2a', owned: owns('up_firedash'), desc: 'Your dash leaves a blazing trail that scorches enemies. Won from CINDER.' },
    { name: 'WRECKING BALL', css: '#ffc04a', owned: owns('flail'), desc: 'FLAIL: hold FIRE until the wind-up bar is full, then release. The full sweep hits for over 120, breaks cracked walls and knocks enemies flying.' },
    { name: 'DEMOLITION SWEEP', css: '#ffc04a', owned: owns('flail'), desc: 'FLAIL: catch 3 or more enemies in one sweep for bonus style. The MAGNET variant drags them into range first.' },
    { name: 'FLAIL PARRY', css: '#ffc04a', owned: owns('flail'), desc: 'FLAIL: a sweep knocks glowing orbs straight back where you are aiming, just like a punch parry.' },
  ] };
  return [...guns, arms, moves];
};
let codexTab = 'beasts', codexSel = null;
const CX = { r: null, scene: null, cam: null, model: null, raf: 0, t: 0 };
function codexModel(type) {
  const def = DEFS[type];
  const md = def.mini || def.custom ? buildMiniModel(type) : def.cat ? buildCatModel() : def.base ? buildEnemyModel(def.base, def.color) : def.duelist ? buildDuelistModel(type) : def.variantModel ? buildVariantModel(type) : def.trainer ? buildTrainerModel(type) : def.boss ? buildBossModel(type) : buildEnemyModel(type, def.color);
  if (def.scale) md.root.scale.multiplyScalar(def.scale);
  if (def.eliteKind) tintElite(md.mats, def.eliteKind);
  return md;
}
function codexShow(type) {
  if (!CX.r) {
    const cv = $('codexCanvas');
    CX.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    CX.r.setPixelRatio(Math.min(2, devicePixelRatio));
    CX.r.outputColorSpace = THREE.SRGBColorSpace;
    CX.scene = new THREE.Scene();
    CX.scene.add(new THREE.HemisphereLight(0xffe0c0, 0x2a1a10, 1.4));
    const d = new THREE.DirectionalLight(0xffc89a, 2.2); d.position.set(3, 6, 5); CX.scene.add(d);
    const rim = new THREE.DirectionalLight(0x6a8aff, 1.2); rim.position.set(-4, 3, -5); CX.scene.add(rim);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.25, 10), cobbleMat);
    plinth.position.y = -0.125; CX.scene.add(plinth);
    CX.cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  }
  if (CX.model) { CX.scene.remove(CX.model.root); CX.model.root.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); }
  const md = codexModel(type);
  CX.model = md;
  const box3 = new THREE.Box3().setFromObject(md.root);
  const size = box3.getSize(new V3()), h = Math.max(size.y, size.x * 0.8, size.z * 0.8, 0.5);
  const k = 2.6 / h;
  md.root.scale.multiplyScalar(k);
  const b2 = new THREE.Box3().setFromObject(md.root);
  md.root.position.y -= b2.min.y;
  const c = b2.getCenter(new V3());
  md.root.position.x -= c.x; md.root.position.z -= c.z;
  CX.scene.add(md.root);
  CX.cam.position.set(0, 1.9, 6.2); CX.cam.lookAt(0, 1.2, 0);
  if (!CX.raf) codexLoop();
}
function codexLoop() {
  CX.raf = requestAnimationFrame(codexLoop);
  if (G.state !== 'codex' || !CX.model) return;
  const cv = $('codexCanvas'), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * CX.r.getPixelRatio())) { CX.r.setSize(w, h, false); CX.cam.aspect = w / h; CX.cam.updateProjectionMatrix(); }
  CX.t += 1 / 60;
  CX.model.root.rotation.y = CX.t * 0.7;
  CX.r.render(CX.scene, CX.cam);
}
function fmtPlay(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`; }
function topOf(o) { let best = null, n = 0; for (const k in o) if (o[k] > n) { n = o[k]; best = k; } return best ? [best, n] : null; }
function renderCodex() {
  const body = $('codexBody');
  document.querySelectorAll('#codexTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === codexTab));
  if (codexTab === 'beasts') {
    const met = CODEX_BEASTS.filter(([t]) => STATS.met[t] || STATS.by[t]);
    if (!codexSel || !met.some(([t]) => t === codexSel)) codexSel = met.length ? met[0][0] : null;
    const cats = ['ENEMY', 'ELITE', 'TRAINER', 'DUELIST', 'MINIBOSS', 'BOSS'];
    body.innerHTML = `<div class="cxBeasts"><div class="cxList">${cats.map((c) => `<h4>${{ ENEMY: 'ENEMIES', ELITE: 'ELITES', TRAINER: 'TRAINERS', DUELIST: 'DUELISTS', MINIBOSS: 'MINI-BOSSES', BOSS: 'BOSSES' }[c]}</h4><div>${CODEX_BEASTS.filter((x) => x[2] === c).map(([t, n]) => { const seen = STATS.met[t] || STATS.by[t]; return `<button data-beast="${t}" class="${t === codexSel ? 'on' : ''}" ${seen ? '' : 'disabled'}>${seen ? n : '???'}</button>`; }).join('')}</div>`).join('')}</div>` +
      `<div class="cxDetail">${codexSel ? (() => { const [t, n, c, lore] = CODEX_BEASTS.find((x) => x[0] === codexSel); const d = DEFS[t]; return `<canvas id="codexCanvas"></canvas><h3>${n}</h3><small>${c === 'MINIBOSS' ? 'MINI-BOSS' : c} · ${Math.round(d.hp)} HP · KILLED ${STATS.by[t] || 0}×</small><p>${lore}</p>${d.hint || ENEMY_INTRO[t] ? `<p class="tip">${d.hint || ENEMY_INTRO[t]}</p>` : ''}`; })() : '<p>You haven\'t met anything yet. Go break something.</p>'}</div></div>` +
      `<p class="cxCount">${met.length} / ${CODEX_BEASTS.length} DISCOVERED</p>`;
    body.querySelectorAll('[data-beast]').forEach((b) => b.addEventListener('click', () => { codexSel = b.dataset.beast; renderCodex(); }));
    if (CX.r) { CX.r.dispose(); CX.r.forceContextLoss(); CX.r = null; CX.model = null; }
    if (codexSel) codexShow(codexSel);
  } else if (codexTab === 'arsenal') {
    body.innerHTML = `<div class="cxArsenal">${ARSENAL().map((g) => `<div class="cxGun"><h4>${g.head}</h4>${g.rows.map((r) => `<div class="cxRow ${r.owned ? '' : 'locked'}"><b style="color:${r.owned ? r.css : '#666'}">${r.name}</b><p>${r.owned ? r.desc : 'LOCKED · ' + r.desc}</p></div>`).join('')}</div>`).join('')}</div>`;
  } else if (codexTab === 'stats') {
    const acc = STATS.shots ? Math.round((STATS.hits / STATS.shots) * 100) : 0;
    const fw = topOf(STATS.wk), fv = topOf(STATS.by);
    const wname = (k) => ({ world: 'THE ENVIRONMENT', slam: 'GROUND SLAM', shock: 'SHOCKWAVE', punch: 'PUNCH' }[k] || k.toUpperCase());
    const beastName = (k) => (CODEX_BEASTS.find((x) => x[0] === k) || [k, k.toUpperCase()])[1];
    const rows = [
      ['TIME PLAYED', fmtPlay(STATS.time)], ['KILLS', STATS.kills.toLocaleString()], ['DEATHS', STATS.deaths],
      ['ACCURACY', `${acc}% <small>(${STATS.hits.toLocaleString()} / ${STATS.shots.toLocaleString()} shots)</small>`],
      ['FAVOURITE WEAPON', fw ? `${wname(fw[0])} <small>(${fw[1]} kills)</small>` : '-'], ['FAVOURITE VICTIM', fv ? `${beastName(fv[0])} <small>(${fv[1]})</small>` : '-'],
      ['PARRIES', statL('PARRY') + statL('SHOCK PARRY')], ['HEADSHOTS', statL('HEADSHOT')], ['COMBO BLASTS', statL('COMBO BLAST')],
      ['BEST SWAP CHAIN', STATS.bestChain], ['HIGHEST STYLE', RANKS[STATS.maxRank].l], ['LEVELS CLEARED', STATS.levels], ['P-RANKS', STATS.pRanks],
      ['BOSSES BEATEN', Object.values(STATS.bosses).reduce((a, b) => a + b, 0)], ['PIT BEST WAVE', STATS.pitBestWave],
      ['SCRAP EARNED', STATS.scrapEarned.toLocaleString() + ' ◆'], ['SCRAP SPENT', STATS.scrapSpent.toLocaleString() + ' ◆'],
      ['ACHIEVEMENTS', `${Object.keys(STATS.ach).length} / ${ACHS.length}`],
    ];
    body.innerHTML = `<div class="cxStats">${rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div>`;
  } else if (codexTab === 'story') {
    const seen = cutsSeen();
    const order = ['prologue', 'boss1', 'scene1', 'boss2', 'scene2', 'boss3', 'twist', 'scene3', 'guildmaster', 'finale'];
    body.innerHTML = `<div class="cxStory">${order.map((k) => seen[k] ? `<div class="ch"><h4>${STORY[k].title}</h4>${STORY[k].lines.map(([w, t]) => `<p><b>${w}</b> ${t}</p>`).join('')}</div>` : `<div class="ch locked"><h4>???</h4><p>Keep playing to uncover this chapter.</p></div>`).join('')}</div>`;
  } else {
    body.innerHTML = `<p class="cxCount">${Object.keys(STATS.ach).length} / ${ACHS.length} UNLOCKED</p><div class="cxAch">${ACHS.map((a) => { const [c, m] = a.p(); const got = !!STATS.ach[a.id]; const f = Math.min(1, c / m); return `<div class="ach ${got ? 'got' : ''}"><b>${a.secret && a.secret() ? '???' : a.name}</b><p>${a.secret && a.secret() ? 'A secret. Keep exploring.' : a.desc}</p><em>${a.scrap ? '+' + a.scrap + ' ◆' : SKINS[a.skin].name + ' SKIN'}</em><div class="bar"><i style="width:${(got ? 1 : f) * 100}%"></i></div><small>${got ? 'UNLOCKED' : `${Math.min(c, m).toLocaleString()} / ${m.toLocaleString()}`}</small></div>`; }).join('')}</div>`;
  }
}
function openCodex() {
  initAudio();
  checkAch();
  G.state = 'codex';
  show('menu', false);
  renderCodex();
  show('codex', true);
}
$('codexBtn').addEventListener('click', openCodex);
$('codexBack').addEventListener('click', () => { G.state = 'menu'; show('codex', false); show('menu', true); if (CX.raf) { cancelAnimationFrame(CX.raf); CX.raf = 0; } });
document.querySelectorAll('#codexTabs button').forEach((b) => b.addEventListener('click', () => { codexTab = b.dataset.tab; renderCodex(); }));
