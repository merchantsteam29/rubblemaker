'use strict';
// ================================================================ BATCH 8: ACT IV EXTRAS, HARD MODE, SPEEDRUNS, TRAINING, GOLEM COLOURS
// ---- secret duels 7-S / 8-S and their movement upgrades
const _duelPrize = duelPrize; duelPrize = (d) => (d === 'dash4' || d === 'slambounce' ? 'up_' + d : _duelPrize(d));
const _prizeName = prizeName; prizeName = (d) => (d === 'dash4' ? 'EXTRA DASH' : d === 'slambounce' ? 'SLAM BOUNCE' : _prizeName(d));
const _prizeBanner = prizeBanner; prizeBanner = (d) => (d === 'dash4' || d === 'slambounce' ? 'NEW MOVE: ' + prizeName(d) : _prizeBanner(d));
Object.assign(UPGRADE_HINT, {
  dash4: () => `EXTRA DASH: you now hold 4 ${actLabel('dash')} charges`,
  slambounce: () => `SLAM BOUNCE: hold ${actLabel('jump')} as a GROUND SLAM lands to bounce high into the air`,
});
function maxPips() { return owns('up_dash4') ? 4 : 3; }
function slamBounce() {
  if (!owns('up_slambounce') || !down('jump')) return;
  P.vel.y = 16; P.grounded = false; P.wallJumps = 3;
  addStyle(30, 'SLAM BOUNCE', 'slam', 'cool');
  tone(300, 700, 0.15, 0.2, 'triangle');
}
Object.assign(DEFS, {
  ferryman: { hp: 2400, speed: 7, r: 0.8, h: 4.2, color: 0x2a3a4a, mass: 40, kill: 700, label: 'DUEL WON', boss: true, duelist: true, mini: true, animAs: 'shooter', name: 'THE FERRYMAN', short: 'THE FERRYMAN', hint: 'He drags you across the water with his lantern · dash out of the pull and punish the charge' },
  keystone: { hp: 2800, speed: 4, r: 1.5, h: 4.6, color: 0xb8b0a0, mass: 60, kill: 700, label: 'DUEL WON', boss: true, duelist: true, mini: true, animAs: 'heavy', name: 'THE KEYSTONE', short: 'THE KEYSTONE', hint: 'Watch the floor for falling masonry · DASH through the tall waves' },
});
Object.assign(MINI_ATK, {
  ferryman: { near: ['charge', 'blink'], far: ['volley', 'geyser', 'pull'], range: [8, 15] },
  keystone: { near: ['smash', 'toll'], far: ['bells', 'rain', 'chord'], range: [6, 13] },
});
Object.assign(EPITHETS, { ferryman: ['SECRET DUEL', 'HE ROWS THE INTAKE'], keystone: ['SECRET DUEL', 'IT HOLDS THE ARCHES UP'] });
Object.assign(VOICES, { ferryman: [90, 420, 900, 0.3, 0.7, 'square'], keystone: [44, 300, 600, 1, 0.8] });
Object.assign(DUEL_LINES, {
  ferryman: { intro: 'Every swimmer pays the ferryman, golem.', 75: 'You float well for a brick.', 50: 'The water is patient. So am I.', 25: 'Row, then. Row away.', win: 'Take the oar. You row faster than I do.' },
  keystone: { intro: 'Pull me out and the arches fall. Try it.', 75: 'Stone does not bruise.', 50: 'You chip. I crack. We are both builders.', 25: 'The arch... is shaking...', win: 'Go on. The arch can stand on its own now.' },
});
CODEX_BEASTS.splice(CODEX_BEASTS.findIndex((x) => x[2] === 'MINIBOSS'), 0,
  ['ferryman', 'THE FERRYMAN', 'DUELIST', 'He rows the black water of the intake with a green lantern on his pole. Beat him in 7-S for an EXTRA DASH charge.'],
  ['keystone', 'THE KEYSTONE', 'DUELIST', 'The wedge at the top of the highest arch, tired of holding everything up. Beat it in 8-S for SLAM BOUNCE.'],
);
const _bmm2 = buildMiniModel;
buildMiniModel = function (type) {
  if (type !== 'ferryman' && type !== 'keystone') return _bmm2(type);
  const def = DEFS[type];
  const md = buildEnemyModel(type === 'ferryman' ? 'shooter' : 'heavy', def.color);
  const r = md.rig;
  const add = (geo, mat, parent, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; };
  if (type === 'ferryman') {
    const cloak = new THREE.MeshStandardMaterial({ color: 0x12161c, roughness: 1, side: THREE.DoubleSide });
    add(new THREE.ConeGeometry(0.5, 1.0, 8, 1, true), cloak, r.head, 0, 0.15, -0.05);
    add(new THREE.ConeGeometry(0.8, 1.6, 10, 1, true), cloak, r.torso, 0, -0.2, 0);
    const pole = new THREE.Group(); pole.position.set(0, -0.6, 0.1); r.elR.add(pole);
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0x4a3a22 }), pole, 0, 0.4, 0);
    add(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8aff9a }), pole, 0, 1.75, 0.15);
    const l = new THREE.PointLight(0x8aff9a, 2, 7); l.position.set(0, 1.75, 0.15); pole.add(l);
    md.root.scale.setScalar(1.6);
  } else {
    const stone = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.9 });
    add(new THREE.CylinderGeometry(0.55, 0.3, 0.7, 4), stone, r.head, 0, 0.35, 0, 0, Math.PI / 4, 0);
    for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.12, 1.1, 1.4), stone, r.torso, sd * 0.6, 0.6, -0.25, 0.3, 0, sd * 0.5);
    add(new THREE.BoxGeometry(0.6, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0x8ae8ff }), r.head, 0, 0.2, 0.32);
    md.root.scale.setScalar(1.5);
  }
  return md;
};

// ---- GUILDMASTER PRIME
PRIME_MINIONS.guildmaster = ['diver', 'siphon'];
Object.assign(SKINS, {
  cistern: { name: 'CISTERN', steel: 0x3a5a6a, dsteel: 0x14242c, brass: 0x8ae8ff, em: 0x0a2a3a },
  hellfire: { name: 'HELLFIRE', steel: 0x3a0a0a, dsteel: 0x140404, brass: 0xff2a1a, em: 0x6a0400 },
});

// ---- golem colours (cutscenes, your ghost runs, how your rival sees you)
var GOLEM_BODY = { brick: 0x9a4a2a, granite: 0x6a6a72, sandstone: 0xc8a070, marble: 0xd8d4cc, moss: 0x4a6a3a, copper: 0xb06a3a, obsidian: 0x2a2234 };
var GOLEM_GLOW = { cyan: 0x8ae8ff, ember: 0xff8a3a, gold: 0xffd04a, violet: 0xc08aff, lime: 0x8aff6a, white: 0xffffff, red: 0xff4a4a };
const golemGlowHex = () => GOLEM_GLOW[settings.golemGlow] || GOLEM_GLOW.cyan;
buildGolem = function () {
  const md = buildEnemyModel('heavy', GOLEM_BODY[settings.golemBody] || GOLEM_BODY.brick);
  const gc = golemGlowHex(), glow = new THREE.MeshBasicMaterial({ color: gc });
  const r = md.rig;
  for (const sd of [-1, 1]) { const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.04), glow); eye.position.set(sd * 0.12, 0.18, 0.3); r.head.add(eye); }
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glow); core.position.set(0, 0.8, 0.5); r.torso.add(core);
  const light = new THREE.PointLight(gc, 3, 6); light.position.set(0, 1, 1); r.torso.add(light);
  md.core = core;
  return md;
};
var RIVAL_GLOW = 0;

// ---- speedrun timer: per-room splits against your best, plus a run timer across levels
var SR = { splits: [], deltaT: 0, run: { t: 0, n: 0, from: '' }, lastDone: -9, nextOk: false };
const SPLIT_KEY = 'rubblemaker-splits', ACTRUN_KEY = 'rubblemaker-actruns';
const loadJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (_) { return {}; } };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const fmtSR = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t % 1) * 100)).padStart(2, '0')}`;
function srStart(lv, idx) {
  SR.splits = [];
  // the run continues if you came straight from the previous level's NEXT button
  if (!(SR.nextOk && SR.lastDone === idx - 1)) SR.run = { t: 0, n: 0, from: lv.id };
  SR.nextOk = false;
  show('srTimer', !!settings.speedrun && !(VS && VS.active));
  if (ngActive()) { const D = DIFFS[settings.difficulty] || DIFFS.normal; G.modDiff = { ...D, hp: (D.hp || 1) * 1.25, speed: (D.speed || 1) * 1.12, dmg: (D.dmg || 1) * 1.2, fire: (D.fire || 1) * 0.88, scrap: (D.scrap || 1) * 1.5 }; showHint('HARD MODE · remixed waves, more elites, tougher everything · ranks are kept separately'); }
}
function srTick() {
  if (!settings.speedrun || !G.level) return;
  const el = $('srTimer');
  el.innerHTML = `${fmtSR(G.levelTime)}<small>${SR.run.n ? 'RUN ' + fmtSR(SR.run.t + G.levelTime) + ' · ' : ''}${G.level.id}${ngActive() ? ' · HARD' : ''}</small>`;
  if (SR.deltaT > 0) { SR.deltaT -= 1 / 60; if (SR.deltaT <= 0) $('srDelta').classList.remove('show'); }
}
function srSplit() {
  if (!G.level || G.mode !== 'campaign') return;
  SR.splits.push(Math.round(G.levelTime * 100) / 100);
  if (!settings.speedrun) return;
  const pb = loadJSON(SPLIT_KEY)[bestKey(G.level)];
  const i = SR.splits.length - 1;
  if (!pb || pb.s[i] == null) return;
  const d = SR.splits[i] - pb.s[i];
  const el = $('srDelta');
  el.textContent = `${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`;
  el.className = 'show ' + (d <= 0 ? 'ahead' : 'behind');
  SR.deltaT = 2.5;
}
function srFinish(lv, t) {
  srSplit();
  const all = loadJSON(SPLIT_KEY), k = bestKey(lv);
  let newPB = false;
  if (!cheatsOn() && (!all[k] || t < all[k].t)) { all[k] = { t, s: SR.splits.slice() }; saveJSON(SPLIT_KEY, all); newPB = !!settings.speedrun; }
  SR.run.t += t; SR.run.n++;
  SR.lastDone = G.levelIdx;
  let line = '';
  if (settings.speedrun) {
    line = `<span class="runLine">${newPB ? 'NEW PERSONAL BEST · ' : ''}SPLITS ${SR.splits.length} · RUN ${fmtSR(SR.run.t)} over ${SR.run.n} level${SR.run.n > 1 ? 's' : ''} from ${SR.run.from}`;
    // a full act run, started at the act's first level, is saved as an act PB
    const sc = lv.scene, first = sc && sc.levels && sc.levels[0], last = sc && sc.levels && sc.levels[sc.levels.length - 1];
    if (first && last && last.id === lv.id && SR.run.from === first.id && !cheatsOn()) {
      const ar = loadJSON(ACTRUN_KEY), ak = sc.name + (ngActive() ? '+ng' : '');
      if (!ar[ak] || SR.run.t < ar[ak]) { ar[ak] = SR.run.t; saveJSON(ACTRUN_KEY, ar); line += ` · NEW ${sc.name} RUN RECORD`; }
      else line += ` · ${sc.name} RECORD ${fmtSR(ar[ak])}`;
    }
    line += '</span>';
  }
  return line;
}

// ---- HARD MODE (NG+): unlocked by beating the Guildmaster
function ngUnlocked() { return Object.keys(prog().best || {}).some((k) => k === '9-2' || k.startsWith('9-2:')); }
function ngActive() { return !!settings.ngplus && ngUnlocked() && G.mode === 'campaign' && !!G.level && !G.level.race && !G.level.duel && !(VS && VS.active); }
const _bestKey = bestKey;
bestKey = (lv) => { const k = _bestKey(lv); return settings.ngplus && ngUnlocked() && !lv.race && !lv.duel ? k + '+ng' : k; };
const NG_UP = { grunt: ['grunt', 'shield', 'shooter'], shooter: ['shooter', 'sniper'], flyer: ['flyer', 'bomber'], bomber: ['bomber', 'ram'], shield: ['shield', 'heavy'], diver: ['diver', 'siphon'], burrower: ['burrower', 'diver'] };
function ngWave(q) {
  if (!ngActive() || !q.length) return q;
  const out = q.map((t) => (NG_UP[t] && Math.random() < 0.4 ? NG_UP[t][(Math.random() * NG_UP[t].length) | 0] : t));
  const extra = Math.ceil(q.length * 0.35);
  for (let i = 0; i < extra; i++) out.push(q[(Math.random() * q.length) | 0]);
  return out;
}
const _eliteChance = eliteChance;
eliteChance = () => { const c = _eliteChance(); return ngActive() ? Math.min(0.35, c * 2.2 + 0.08) : c; };

// ---- TRAINING: a first-time obstacle course of lessons in the pit arena
const TUT_KEY = 'rubblemaker-tut';
var TUT = null;
const tutSeen = () => { try { return !!localStorage.getItem(TUT_KEY); } catch (_) { return true; } };
const LESSONS = [
  { id: 'move', name: 'MOVE', tip: () => `Walk around with ${actLabel('forward')} ${actLabel('left')} ${actLabel('back')} ${actLabel('right')} and aim with the mouse.` },
  { id: 'jump', name: 'JUMP', tip: () => `Press ${actLabel('jump')} to jump.` },
  { id: 'dash', name: 'DASH', tip: () => `Press ${actLabel('dash')} to DASH. You are invulnerable during it, and you have 3 charges.` },
  { id: 'slide', name: 'SLIDE', tip: () => `Hold ${actLabel('slide')} while running to SLIDE.` },
  { id: 'slam', name: 'GROUND SLAM', tip: () => `Jump, then press ${actLabel('slide')} in mid-air to GROUND SLAM.` },
  { id: 'wall', name: 'WALL JUMP', tip: () => `Jump at a wall and press ${actLabel('jump')} again while touching it to WALL JUMP.` },
  { id: 'shoot', name: 'SHOOT', tip: () => `Shoot the three training dummies with ${actLabel('fire')}. Headshots hit harder.` },
  { id: 'parry', name: 'PARRY', tip: () => `The turret spits glowing orbs. PUNCH one with ${actLabel('punch')} just before it hits you to PARRY it back.` },
  { id: 'style', name: 'STYLE', tip: () => 'Kill the dummies quickly with different moves to fill the STYLE meter (top right). Reach rank C.' },
];
function startTutorial() {
  initAudio();
  toMenu();
  G.mode = 'tutorial'; G.level = null; G.layout = null;
  resetGame(); clearLevelGeometry();
  buildArena('pit'); setLook('pit');
  G.ceil = 11; G.spawn = new V3(0, 0, 12);
  P.pos.copy(G.spawn); P.yaw = 0;
  TUT = { i: 0, start: P.pos.clone(), dummies: [], turret: null, turretT: 0, slamAt: G.slamAt || -1, done: false };
  show('menu', false);
  enterPlay();
  $('wave').textContent = 'TRAINING';
  show('tut', true);
  banner('TRAINING');
  tutRender();
}
function tutRender() {
  const el = $('tut');
  if (!TUT) return;
  const L = LESSONS[TUT.i];
  el.innerHTML = `<h4>TRAINING ${Math.min(TUT.i + 1, LESSONS.length)} / ${LESSONS.length}</h4><ol>${LESSONS.map((l, i) => `<li class="${i < TUT.i ? 'done' : i === TUT.i ? 'now' : ''}">${l.name}</li>`).join('')}</ol>` +
    (TUT.done ? `<p class="sub">TRAINING COMPLETE. The cellar is waiting.</p><button id="tutGo">START 0-1</button> <button id="tutMenu">MENU</button>` : `<p class="sub">${L.tip()}</p><button id="tutSkip">SKIP TRAINING</button>`);
  const go = $('tutGo'), sk = $('tutSkip'), mn = $('tutMenu');
  if (go) go.onclick = () => { show('tut', false); TUT = null; startLevel(0); };
  if (mn) mn.onclick = () => { toMenu(); };
  if (sk) sk.onclick = () => { try { localStorage.setItem(TUT_KEY, 'skipped'); } catch (_) {} toMenu(); openLevels(); };
}
function tutSpawnDummies(n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI - Math.PI / 2, x = Math.sin(a) * 10, z = -6 - Math.cos(a) * 4;
    const e = makeEnemy('grunt', x, z); e.dummy = true; e.hp = e.maxHp = 40;
    TUT.dummies.push(e);
  }
}
function tutNext() {
  TUT.i++;
  sfx.rankUp();
  if (TUT.i >= LESSONS.length) {
    TUT.done = true;
    try { localStorage.setItem(TUT_KEY, 'done'); } catch (_) {}
    if (STATS) { STATS.flags.trained = 1; saveStats(); }
    banner('TRAINING COMPLETE');
    document.exitPointerLock?.();
  } else {
    const id = LESSONS[TUT.i].id;
    if (id === 'shoot') { TUT.dummies = []; tutSpawnDummies(3); }
    if (id === 'parry' && !TUT.turret) {
      const t = new THREE.Group(); t.position.set(0, 0, -14);
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.6), brickMat); b.position.y = 1.1; t.add(b);
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb02a })); g.position.y = 2.5; t.add(g);
      levelGroup.add(t); TUT.turret = t;
    }
    if (id === 'style') { ST.points = 0; ST.idx = 0; TUT.dummies = []; tutSpawnDummies(6); }
  }
  tutRender();
}
function tutLabel(label) { if (TUT && !TUT.done && LESSONS[TUT.i].id === 'parry' && /PARRY/.test(label || '')) tutNext(); }
function updateTutorial(dt) {
  if (!TUT || TUT.done) return;
  P.hp = Math.max(P.hp, 70);
  const id = LESSONS[TUT.i].id;
  if (id === 'move' && Math.hypot(P.pos.x - TUT.start.x, P.pos.z - TUT.start.z) > 6) tutNext();
  else if (id === 'jump' && !P.grounded && P.vel.y > 6) tutNext();
  else if (id === 'dash' && P.dashT > 0) tutNext();
  else if (id === 'slide' && P.sliding) tutNext();
  else if (id === 'slam' && G.slamAt && G.slamAt !== TUT.slamAt) tutNext();
  else if (id === 'wall' && !P.grounded && P.wallJumps < 3) tutNext();
  else if (id === 'shoot' && TUT.dummies.length && TUT.dummies.every((e) => e.dead)) tutNext();
  else if (id === 'style') { if (rankIndex(ST.points) >= 1 && TUT.dummies.some((e) => e.dead)) tutNext(); else if (TUT.dummies.every((e) => e.dead)) { TUT.dummies = []; tutSpawnDummies(6); } }
  if (id === 'parry' && TUT.turret) {
    TUT.turretT -= dt;
    if (TUT.turretT <= 0) {
      TUT.turretT = 2.4;
      const from = new V3(0, 2.5, -13.4), to = playerEye().sub(from).normalize();
      spawnOrb(from, to.multiplyScalar(9), 4);
      sfx.orb(0.6);
    }
  }
}
// first press of CAMPAIGN with a fresh save goes through training first
$('startBtn').addEventListener('click', (e) => {
  const p = loadProgress();
  if (!tutSeen() && !p.unlocked && !Object.keys(p.best || {}).length) { e.stopImmediatePropagation(); startTutorial(); }
}, true);
$('trainingBtn').addEventListener('click', startTutorial);

// ---- RUBBLE PIT: the flooded cistern arena
PIT_ORDER.push('aqueduct');
PIT_ARENAS.aqueduct = { name: 'THE CISTERN FLOOR', look: 'pitAqueduct' };
LOOKS.pitAqueduct = { ...LOOKS.aqueduct, near: 24, far: 115 };
const _buildArenaAlt = buildArenaAlt;
buildArenaAlt = function (kind) {
  if (kind !== 'aqueduct') return _buildArenaAlt(kind);
  const ash = levelCtx.mats.ashlar;
  box(0, -1, 0, 2 * A + 6, 1, 2 * A + 6, floorMat, 3.5);
  box(0, 0, -A - 1, 2 * A + 4, WALL_H, 2, ash); box(0, 0, A + 1, 2 * A + 4, WALL_H, 2, ash);
  box(-A - 1, 0, 0, 2, WALL_H, 2 * A, ash); box(A + 1, 0, 0, 2, WALL_H, 2 * A, ash);
  for (const sd of [-1, 1]) for (let i = -3; i <= 3; i++) {
    box(i * 8, 0, sd * (A - 0.6), 1.2, 7, 1.2, cobbleMat, 3, false); box(sd * (A - 0.6), 0, i * 8, 1.2, 7, 1.2, cobbleMat, 3, false);
  }
  // a loop of currents round the middle, sluice gates on every wall, and a cistern that floods during waves
  hazard('current', 0, -12, 24, 3, { dir: [1, 0] }); hazard('current', 12, 0, 3, 24, { dir: [0, 1] });
  hazard('current', 0, 12, 24, 3, { dir: [-1, 0] }); hazard('current', -12, 0, 3, 24, { dir: [0, -1] });
  hazard('jet', 0, -A + 0.4, 2 * A - 2, 2.4, { dir: [0, 1], phase: 0 }); hazard('jet', 0, A - 0.4, 2 * A - 2, 2.4, { dir: [0, -1], phase: 2.2 });
  hazard('jet', -A + 0.4, 6, 2 * A - 2, 2.4, { dir: [1, 0], phase: 1.1 }); hazard('jet', A - 0.4, -6, 2 * A - 2, 2.4, { dir: [-1, 0], phase: 3.3 });
  hazard('flood', 0, 0, 2 * A, 2 * A, { room: { get state() { return G.waveActive ? 'active' : 'idle'; } }, max: 0.5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box(sx * 24, 0, sz * 24, 7, 2.4, 7, ash); box(sx * 19, 0, sz * 24, 3, 1.2, 3, cobbleMat, 3); }
  for (const [x, z] of [[6, 6], [-6, -6], [6, -6], [-6, 6]]) box(x, 0, z, 2, 5, 2, ash);
  for (const t of [-18, 18]) { torch(t, 4.5, -A, 0, 1); torch(t, 4.5, A, 0, -1); torch(-A, 4.5, t, 1, 0); torch(A, 4.5, t, -1, 0); }
};
// ---- achievements for the batch
ACHS.splice(ACHS.findIndex((a) => a.id === 'all'), 0,
  { id: 'trained', name: 'APPRENTICE', desc: 'Finish the TRAINING course', p: () => [STATS.flags.trained ? 1 : 0, 1], scrap: 100 },
  { id: 'ng', name: 'HARD AS BRICKS', desc: 'Beat THE GUILDMASTER in HARD MODE', p: () => [Object.keys(prog().best || {}).some((k) => k.startsWith('9-2') && k.endsWith('+ng')) ? 1 : 0, 1], skin: 'hellfire' },
);
