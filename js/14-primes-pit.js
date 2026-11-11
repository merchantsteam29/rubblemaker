'use strict';
// ================================================================ BATCH 4.3: KILN TRAINERS
Object.assign(DEFS, {
  anvil: { hp: 560, speed: 2.7, r: 1.3, h: 4.0, color: 0x3a3a44, mass: 50, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE ANVIL · TRAINER', short: 'THE ANVIL', hint: 'Bullets ring off THE ANVIL · switch to the BLADE arm and cut him up close', canHurt: (i) => i.weapon === 'blade' || !owns('arm_blade') },
  bellows: { hp: 650, speed: 2.4, r: 1.5, h: 4.2, color: 0x6a4028, mass: 50, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, name: 'THE BELLOWS · TRAINER', short: 'THE BELLOWS', hint: 'Only a CHARGED SHOCKWAVE cracks THE BELLOWS · hold the SHOCKWAVE fist to 3+ bars, then let go up close', canHurt: (i) => (i.weapon === 'shock' && (i.charge || 0) >= 0.6) || !owns('arm_shock') },
  crane: { hp: 450, speed: 9, r: 1.4, h: 2.4, color: 0x2a2a30, mass: 30, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, fly: true, name: 'THE CRANE · TRAINER', short: 'THE CRANE', hint: 'THE CRANE is out of reach · GRAPPLE it to drag it to the ground, then unload', canHurt: (i, e) => !owns('arm_grapple') || !!(e && (e.state === 'perch' || e.mesh.position.y < 1.2)) },
});
Object.assign(EPITHETS, {
  anvil: ['TRAINER', 'LESSON IX · THE BLADE'],
  bellows: ['TRAINER', 'LESSON X · THE CHARGED SHOCKWAVE'],
  crane: ['TRAINER', 'LESSON XI · THE GRAPPLE'],
});
function craneYank(e) {
  const p = e.mesh.position;
  e.state = 'dive'; e.yanked = true; e.hitDone = true;
  e.diveTarget = new V3(p.x + (P.pos.x - p.x) * 0.45, 0, p.z + (P.pos.z - p.z) * 0.45);
  e.flash = 0.1;
  addStyle(90, 'DRAGGED DOWN', 'grapple', 'big');
  sfx.screech(1);
}

// ================================================================ BATCH 4.3: PRIME BOSSES
const PRIME_MINIONS = { boss1: ['shield', 'grunt'], boss2: ['sniper', 'shooter'], boss3: ['bomber', 'heavy'] };
function makePrime(e) {
  e.prime = true;
  e.maxHp *= 1.4; e.hp = e.maxHp;
  e.novaT = 4;
  for (const mt of e.mats) {
    if (!mt.userData || mt.userData.baseEmissive) continue;
    mt.userData.baseEmissive = 0x6a0a04;
    mt.userData.baseIntensity = 0.75;
  }
  e.mesh.scale.multiplyScalar(1.08); e.baseScale *= 1.08;
}
function primeTick(e, dt) {
  if (e.spawnT > 0) return;
  if (!e.fury && e.hp < e.maxHp * 0.3) {
    e.fury = true;
    banner(`${e.def.short} PRIME · FURY`);
    sfx.bossRoar(); G.shake = Math.max(G.shake, 0.8); fxShift(0.03);
    const [a, b] = PRIME_MINIONS[e.type] || ['grunt', 'shooter'];
    summonMinions(e, a, 2); summonMinions(e, b, 2);
    e.novaT = 1.2;
  }
  e.novaT -= dt;
  if (e.novaT <= 0) {
    e.novaT = e.fury ? 3.5 : 6;
    const p = e.mesh.position, off = Math.random() * Math.PI;
    for (let i = 0; i < 18; i++) {
      const a = off + (i / 18) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      spawnOrb(new V3(p.x + cx * 2.4, 1.2, p.z + cz * 2.4), new V3(cx * 11, 0, cz * 11), 12, { color: 0xff3a2a });
    }
    ringFx(p.clone().setY(0.2), 4, 0xff3a2a);
    sfx.orb(1);
  }
}

// ================================================================ BATCH 4.3: RUBBLE PIT — shifting arenas, modifiers, boss waves, records
Object.assign(LOOKS, {
  pitCellar: { ...LOOKS.cellar, near: 20, far: 95 },
  pitNave: { ...LOOKS.cathedral, near: 30, far: 130 },
  pitKiln: { ...LOOKS.kiln, near: 22, far: 110, hemiI: 0.75, moon: 0.5 },
});
const PIT_ORDER = ['pit', 'cellar', 'nave', 'kiln'];
const PIT_ARENAS = {
  pit: { name: 'THE PIT', look: 'pit' },
  cellar: { name: 'THE FLOODED CELLAR', look: 'pitCellar' },
  nave: { name: 'THE BROKEN NAVE', look: 'pitNave' },
  kiln: { name: 'THE KILN FLOOR', look: 'pitKiln' },
};
const PIT_MODS = [
  { name: 'SWIFT', desc: 'enemies move 30% faster', mult: 1.25, diff: { speed: 1.3 } },
  { name: 'ARMORED', desc: 'enemies have 50% more health', mult: 1.3, diff: { hp: 1.5 } },
  { name: 'GLASS CANNON', desc: 'enemies hit 50% harder but break easily', mult: 1.2, diff: { dmg: 1.5, hp: 0.6 } },
  { name: 'TRIGGER HAPPY', desc: 'enemies attack much more often', mult: 1.25, diff: { fire: 0.65 } },
  { name: 'DOUBLE BOMBERS', desc: 'a bomber swarm joins the wave', mult: 1.2, add: [['bomber', 5]] },
  { name: 'HEALER SWARM', desc: 'menders and a priest keep them alive', mult: 1.3, add: [['mender', 3], ['priest', 1]] },
  { name: 'STAMPEDE', desc: 'rams charge in from every side', mult: 1.25, add: [['ram', 4]] },
  { name: 'UNDERGROUND', desc: 'burrowers tunnel under the floor', mult: 1.2, add: [['burrower', 4]] },
  { name: 'LOW GRAVITY', desc: 'you float · enemies do not', mult: 1.15, lowgrav: true },
];
const PIT_BOSS_POOL = ['organist', 'ringer', 'stoker', 'glazier', 'bulwark', 'sweeper', 'roost', 'kiln', 'mirror', 'fortress', 'queen', 'anvil', 'bellows', 'crane', 'shard', 'bertha', 'kite', 'twins', 'cat'];
function pitWaveSetup(n) {
  const kind = PIT_ORDER[Math.floor((n - 1) / 5) % PIT_ORDER.length];
  let shifted = null;
  if (kind !== pitKind) { rebuildPit(kind); shifted = kind; }
  G.mod = null; G.modDiff = null; G.lowgrav = false;
  const m = G.daily ? (n >= 2 && n % 10 !== 0 ? G.daily.mod : null)
    : (n >= 3 && n % 10 !== 0 && (n >= 15 || Math.random() < 0.6)) ? PIT_MODS[(Math.random() * PIT_MODS.length) | 0] : null;
  if (m) {
    G.mod = m;
    if (m.diff) {
      const b = DIFFS[settings.difficulty] || DIFFS.normal;
      G.modDiff = { ...b };
      for (const k in m.diff) G.modDiff[k] = b[k] * m.diff[k];
    }
    if (m.lowgrav) G.lowgrav = true;
    pushFeed('MODIFIER: ' + m.name, 'big');
    setTimeout(() => { if (G.mod === m && G.state === 'play') showHint(`MODIFIER · ${m.name}: ${m.desc} · score ×${m.mult}`); }, 900);
  }
  return shifted;
}
function pitExtras(n, list, bossWave) {
  const k = bossWave ? 0.3 : 1;
  const add = (t, c) => { for (let i = 0; i < Math.round(c * k); i++) list.push(t); };
  if (n >= 4) add('shield', Math.min(3, Math.floor((n - 2) / 3)));
  if (n >= 5) add('bomber', Math.min(3, Math.floor((n - 3) / 3)));
  if (n >= 6) add('sniper', Math.min(2, Math.floor((n - 2) / 4)));
  if (n >= 7) add('ram', Math.min(3, Math.floor((n - 4) / 3)));
  if (n >= 8) add('priest', n >= 16 ? 2 : 1);
  if (n >= 9) add('burrower', Math.min(3, Math.floor((n - 6) / 3)));
  if (n >= 11) add('mender', Math.min(2, Math.floor((n - 6) / 5)));
  if (G.mod && G.mod.add) for (const [t, c] of G.mod.add) add(t, c + Math.floor(n / 8));
}
function spawnPitBoss() {
  const n = G.wave;
  const fixed = { 20: 'boss1', 30: 'boss2', 40: 'boss3' }[n];
  const pool = n > 40 ? [...PIT_BOSS_POOL, 'boss1', 'boss2', 'boss3'] : PIT_BOSS_POOL;
  const type = fixed || pool[((G.daily ? G.daily.rng() : Math.random()) * pool.length) | 0];
  const room = { boss: type, cx: 0, cz: 0, w: 44, d: 44, x0: -22, x1: 22, z0: -22, z1: 22, spawns: SPAWNS, doorObjs: [], doors: [], waves: [] };
  const before = new Set(enemies);
  spawnBoss(room);
  const hpK = 1 + Math.max(0, n - 10) / 30;
  for (const e of enemies) if (!before.has(e) && e.def.boss) { e.maxHp *= hpK; e.hp = e.maxHp; if (e.type === 'boss3') e.flooded = true; }
}
function rebuildPit(kind) {
  clearLevelGeometry();
  clearProjectiles();
  clearNails();
  buildArena(kind);
  placeForge(0, 19.5, Math.PI);
  setLook(PIT_ARENAS[kind].look);
  const q = P.pos;
  const stuck = overlapBox(q.x - 0.5, q.y + 0.1, q.z - 0.5, q.x + 0.5, q.y + 1.7, q.z + 0.5) || hazards.some((h) => h.kind === 'lava' && inRect(q.x, q.z, h, 1));
  if (stuck) { P.pos.set(0, 0, 12); P.vel.set(0, 0, 0); }
  P.grounded = false;
  G.shake = Math.max(G.shake, 0.8); fxShift(0.03);
  sfx.heavySlam(1); sfx.door();
}
function buildArenaAlt(kind) {
  box(0, -1, 0, 2 * A + 6, 1, 2 * A + 6, floorMat, 3.5);
  const wallMat = kind === 'cellar' ? cobbleMat : brickMat;
  box(0, 0, -A - 1, 2 * A + 4, WALL_H, 2, wallMat, kind === 'cellar' ? 3 : undefined);
  box(0, 0, A + 1, 2 * A + 4, WALL_H, 2, wallMat, kind === 'cellar' ? 3 : undefined);
  box(-A - 1, 0, 0, 2, WALL_H, 2 * A, wallMat, kind === 'cellar' ? 3 : undefined);
  box(A + 1, 0, 0, 2, WALL_H, 2 * A, wallMat, kind === 'cellar' ? 3 : undefined);
  const wallTorches = () => {
    for (const t of [-18, 18]) {
      torch(t, 4.5, -A, 0, 1); torch(t, 4.5, A, 0, -1);
      torch(-A, 4.5, t, 1, 0); torch(A, 4.5, t, -1, 0);
    }
  };
  if (kind === 'cellar') {
    // squat columns holding up rotten beams, crate stacks and high ledges
    for (const [x, z] of [[15, 0], [-15, 0], [0, -15], [15, 15], [-15, 15], [15, -15], [-15, -15]]) {
      box(x, 0, z, 2.6, 6.2, 2.6, cobbleMat, 3);
      box(x, 0, z, 3.2, 0.8, 3.2, brickMat);
    }
    for (const x of [-15, 15]) box(x, 6.2, 0, 1.2, 0.7, 31.5, woodMat);
    box(0, 6.2, -15, 31.5, 0.7, 1.2, woodMat);
    for (const [x, z] of [[24, 8], [-24, 8], [24, -8], [-24, -8], [8, 25], [-8, 25], [8, -25], [-8, -25]]) {
      box(x, 0, z, 2.2, 2.2, 2.2, woodMat);
      box(x + 0.3, 2.2, z - 0.2, 1.4, 1.4, 1.4, woodMat);
    }
    for (const sd of [-1, 1]) {
      box(sd * (A - 1.5), 4, 0, 3, 0.6, 22, cobbleMat, 3);
      box(0, 4, sd * (A - 1.5), 22, 0.6, 3, cobbleMat, 3);
    }
    box(-6, 0, 6, 1, 1.2, 5, brickMat); box(6, 0, -6, 1, 1.2, 5, brickMat);
    wallTorches();
  } else if (kind === 'nave') {
    // twin colonnades, pews, an altar dais and high balconies
    for (const x of [-13, 13]) {
      for (let z = -24; z <= 24; z += 8) {
        box(x, 0, z, 3, 1, 3, cobbleMat, 3);
        box(x, 1, z, 2.2, 9, 2.2, brickMat);
      }
      box(x, 10, 0, 1.8, 0.9, 51, brickMat);
    }
    for (const sx of [-1, 1]) for (const z of [-16, -10, 8, 14]) box(sx * 5, 0, z, 6, 0.9, 0.8, woodMat);
    box(0, 0, -27, 12, 1.2, 6, cobbleMat, 3);
    box(0, 0, -23.4, 8, 0.6, 1.2, cobbleMat, 3);
    box(0, 1.2, -28, 4, 1.3, 1.6, brickMat);
    for (const sd of [-1, 1]) {
      box(sd * (A - 2), 4.5, 0, 4, 0.5, 30, cobbleMat, 3);
      box(sd * (A - 2), 5, -15, 4, 1, 0.4, brickMat); box(sd * (A - 2), 5, 15, 4, 1, 0.4, brickMat);
      box(sd * (A - 5), 0, 18, 2, 1.5, 2, cobbleMat, 3);
      box(sd * (A - 5), 0, 20.5, 2, 3, 2, cobbleMat, 3);
    }
    wallTorches();
    torch(-3, 2.8, -28, 0, 1); torch(3, 2.8, -28, 0, 1);
  } else if (kind === 'kiln') {
    // lava pools, flame vents, chimneys and furnace platforms
    hazard('lava', 19, 0, 6, 14); hazard('lava', -19, 0, 6, 14); hazard('lava', 0, -19, 14, 6);
    [[8, -24], [-8, -24], [24, 12], [-24, 12], [12, 6], [-12, 6]].forEach(([x, z], i) => hazard('vent', x, z, 2.2, 2.2, { phase: i * 0.7 }));
    for (const [x, z] of [[14, 14], [-14, 14], [14, -14], [-14, -14]]) {
      box(x, 0, z, 3, 9, 3, brickMat);
      box(x, 3, z, 3.3, 0.4, 3.3, ironDark, 1);
      box(x, 6.5, z, 3.3, 0.4, 3.3, ironDark, 1);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(sx * 28, 0, sz * 28, 9, 3.5, 9, brickMat);
      box(sx * 22, 0, sz * 28, 3, 1.7, 3, cobbleMat, 3);
    }
    for (const x of [-10, 10]) { furnace(x, -A + 0.06, 'N'); furnace(x, A - 0.06, 'S'); }
    for (const z of [-10, 10]) { furnace(-A + 0.06, z, 'W'); furnace(A - 0.06, z, 'E'); }
    box(0, 0, 16, 8, 1.4, 1, brickMat);
    box(16, 0, -10, 1, 1.4, 6, brickMat); box(-16, 0, -10, 1, 1.4, 6, brickMat);
    wallTorches();
  }
}
const PIT_KEY = 'rubblemaker-pit-scores';
function loadPitScores() {
  try { const a = JSON.parse(localStorage.getItem(PIT_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
function addPitScore(rec) {
  if (!(rec.score > 0)) return -1;
  const a = loadPitScores();
  a.push(rec);
  a.sort((x, y) => y.score - x.score);
  const top = a.slice(0, 10);
  try { localStorage.setItem(PIT_KEY, JSON.stringify(top)); } catch (_) {}
  return top.indexOf(rec);
}
function pitTableHTML(place, n) {
  const a = loadPitScores();
  if (!a.length) return '';
  const rows = a.slice(0, n).map((x, i) => `<tr class="${i === place ? 'me' : ''}"><td>#${i + 1}</td><td>${Math.floor(x.score).toLocaleString()}</td><td>WAVE ${x.wave}</td><td>${(RANKS[x.rank] || RANKS[0]).l}</td><td>${x.date ? new Date(x.date).toLocaleDateString() : ''}</td></tr>`).join('');
  const extra = place >= n ? `<tr class="me"><td>#${place + 1}</td><td colspan="4">your run · see PIT RECORDS</td></tr>` : '';
  return `<table class="pitTable"><tr><th></th><th>SCORE</th><th>WAVE</th><th>STYLE</th><th>DATE</th></tr>${rows}${extra}</table>`;
}
$('pitRecordsBtn').addEventListener('click', () => {
  initAudio();
  G.state = 'records';
  show('menu', false);
  $('pitRecordsList').innerHTML = pitTableHTML(-1, 10) || '<p>No runs yet. Survive the RUBBLE PIT to set a record.</p>';
  show('pitRecords', true);
});
$('pitRecordsBack').addEventListener('click', () => { G.state = 'menu'; show('pitRecords', false); show('menu', true); });

// ================================================================ DAILY PIT
// Today's date (UTC, so it's the same day for everyone) picks the modifier and seeds the bosses.
const DAILY_KEY = 'rubblemaker-daily';
function dailyToday() {
  const d = new Date().toISOString().slice(0, 10);
  let h = 2166136261; for (const c of 'rubble:' + d) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  const rng = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { date: d, mod: PIT_MODS[(h >>> 0) % PIT_MODS.length], rng };
}
function loadDaily() { try { const v = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
function dailyInfo() {
  const t = dailyToday(), d = loadDaily();
  const best = d.date === t.date ? d.best : 0;
  return `${t.mod.name}${best ? ' · today ' + Math.floor(best).toLocaleString() : ''}${d.streak > 1 && (d.date === t.date || d.prev === t.date) ? ' · ' + d.streak + ' day streak' : ''}`;
}
function startDaily() { G.daily = dailyToday(); startEndless(); setTimeout(() => { if (G.daily) showHint(`DAILY PIT · ${G.daily.date} · ${G.daily.mod.name} every wave: ${G.daily.mod.desc}`); }, 1200); }
// called when a daily run ends: today's best and the streak (played yesterday too = streak + 1)
function recordDaily(score, wave) {
  const t = G.daily.date, d = loadDaily();
  const y = new Date(Date.parse(t + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  if (d.date !== t) { d.streak = d.date === y ? (d.streak || 1) + 1 : 1; d.date = t; d.best = 0; d.wave = 0; }
  const isBest = score > (d.best || 0);
  if (isBest) { d.best = score; d.wave = wave; }
  d.runs = (d.runs || 0) + 1;
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(d)); } catch (_) {}
  return { isBest, d };
}
$('dailyBtn').addEventListener('click', startDaily);
$('pitBtn').addEventListener('click', () => { G.daily = null; }, true); // the normal pit is never the daily
const refreshDailyBtn = () => { const el = $('dailyInfo'); if (el) el.textContent = dailyInfo(); };
refreshDailyBtn();
new MutationObserver(refreshDailyBtn).observe($('menu'), { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
