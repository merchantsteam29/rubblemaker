// =====================================================================
//  Campaign: scenes, level specs, and the room-and-corridor generator
// =====================================================================

// waves: 'g' grunt, 's' shooter, 'h' heavy, 'f' flyer — e.g. 'g3 s1'
const R = (w, d, props, waves, hint) => ({ w, d, props, waves, hint });

export const SCENES = [
  {
    id: 0, name: 'THE CELLAR', theme: 'cellar',
    levels: [
      { id: '0-1', name: 'DAMP WELCOME', par: 120, startHint: 'WASD to move · MOUSE to aim · FIRE to shoot · Walk to the FORGE to spend SCRAP', rooms: [
        R(18, 18, ['crates'], ['g2', 'g3'], 'Hit enemies up close to heal'),
        R(22, 20, ['pillars', 'water'], ['g3', 's1 g2'], 'PUNCH the yellow orbs to PARRY them'),
        { w: 26, d: 26, props: ['pillars'], waves: [], boss: 'bulwark', hint: 'TRAINER: parry his big orb back into him' },
      ] },
      { id: '0-2', name: 'DRAINAGE', par: 150, startHint: 'DASH through attacks · SLIDE to keep your speed', rooms: [
        R(20, 24, ['water', 'ruins'], ['g4', 's2 g2']),
        R(26, 18, ['platforms'], ['g3 s1', 'g4 s2'], 'JUMP against a wall to WALL JUMP'),
        { w: 26, d: 26, props: ['pillars'], waves: [], boss: 'sweeper', hint: 'TRAINER: his waves are too tall to jump — DASH through' },
      ] },
      { id: '0-3', name: 'ROOT CELLAR', par: 170, startHint: 'Shoot gargoyles out of the air for AIRSHOTS', rooms: [
        R(22, 22, ['pillars'], ['f2', 'f2 g3']),
        R(18, 28, ['crates', 'water'], ['s2 g2', 'f3 s1'], 'SLIDE in mid-air to GROUND SLAM'),
        R(24, 24, ['platforms'], ['g5 f2']),
        { w: 26, d: 26, props: ['pillars'], waves: [], boss: 'roost', hint: 'TRAINER: get AIRBORNE or GROUND SLAM to hurt her' },
      ] },
      { id: '0-4', name: 'THE SUMP', par: 200, startHint: 'Need the SHOTGUN? Buy it at the FORGE. Lob a core (ALT) and shoot it: COMBO BLAST', rooms: [
        R(24, 24, ['ruins', 'water'], ['g5', 'h1 g2']),
        R(20, 30, ['pillars'], ['s3 f2', 'g4 s2 x2'], 'BOMBERS blow up near you · shoot them at range'),
        R(30, 26, ['platforms', 'crates'], ['h1 g3 f2', 'h1 s3']),
        { w: 26, d: 26, props: ['pillars'], waves: [], boss: 'kiln', hint: 'TRAINER: only a COMBO BLAST cracks the KILN' },
      ] },
      { id: '0-5', name: "WARDEN'S VAULT", par: 260, startHint: 'Something heavy stirs below...', boss: true, rooms: [
        R(22, 22, ['crates'], ['g4 s2', 'f3 g3']),
        { w: 40, d: 40, props: ['pillars'], waves: [], boss: 'boss1' },
      ] },
    ],
  },
  {
    id: 1, name: 'THE CATHEDRAL', theme: 'cathedral',
    levels: [
      { id: '1-1', name: 'NAVE OF ASH', par: 180, rooms: [
        R(24, 34, ['colonnade', 'pews'], ['g4 s2 k2', 'f3 g3'], 'SHIELDBEARERS block from the front · flank them or break the shield'),
        R(26, 26, ['altar'], ['s3 g4', 'h1 f2']),
      ] },
      { id: '1-2', name: 'PEWS OF THE PENITENT', par: 200, rooms: [
        R(22, 30, ['pews'], ['g4 k2', 's3 g3 x2']),
        R(20, 20, ['balcony'], ['f4', 'h1 g3']),
        R(28, 24, ['pews', 'altar'], ['s4 f2', 'g6 h1']),
      ] },
      { id: '1-3', name: 'BELL ROPE', par: 210, rooms: [
        R(20, 20, ['balcony'], ['f3 g2', 'f4']),
        R(18, 32, ['colonnade'], ['g5 n1', 'h1 s2 n1'], 'SNIPERS lock on with a red line · dash, or PUNCH right as it flashes'),
        R(26, 26, ['balcony'], ['f5 s2', 'h1 f3 g2']),
        { w: 28, d: 28, props: ['colonnade'], waves: [], boss: 'mirror', hint: 'TRAINER: only RICOCHETS hurt him' },
      ] },
      { id: '1-4', name: 'CLOISTER', par: 230, rooms: [
        R(18, 18, ['colonnade'], ['g4 s1']),
        R(18, 18, ['pews'], ['f3 g3']),
        R(18, 18, ['altar'], ['h1 s2 p1'], 'PRIESTS heal and ward their allies · kill them first'),
        R(22, 22, ['colonnade'], ['g6 f2', 's3 h1']),
      ] },
      { id: '1-5', name: 'CHOIR OF STONE', par: 220, rooms: [
        R(24, 24, ['pews'], ['s4 g2', 's3 f3']),
        R(28, 22, ['balcony'], ['s4 h1 p1', 'g6 k2 n1']),
        R(24, 30, ['altar'], ['h2', 's3 f3 g2']),
        { w: 28, d: 28, props: ['colonnade'], waves: [], boss: 'marksman', hint: 'TRAINER: punch his shot back' },
      ] },
      { id: '1-6', name: 'RELIQUARY', par: 230, rooms: [
        R(26, 26, ['colonnade'], ['h1 g4', 'h2']),
        R(22, 22, ['altar'], ['s3 f3', 'h1 s2 g3']),
        R(30, 30, ['balcony'], ['h2 g4 p1', 'h1 s3 f3 x3']),
      ] },
      { id: '1-7', name: 'THE TRANSEPT', par: 250, rooms: [
        R(36, 24, ['colonnade', 'pews'], ['g8 s2', 'f4 s3 n2', 'h2 g4 k2']),
        R(24, 36, ['colonnade'], ['s4 f4', 'h2 s2 g4']),
        { w: 28, d: 28, props: ['colonnade'], waves: [], boss: 'fortress', hint: 'TRAINER: strip the shield layers' },
      ] },
      { id: '1-8', name: 'STAINED GLASS', par: 240, rooms: [
        R(26, 26, ['balcony'], ['f6', 'f4 g4']),
        R(30, 24, ['pews'], ['f5 s3 p1', 'h1 f4 x3']),
        R(26, 30, ['colonnade'], ['f6 s2', 'h2 f4']),
      ] },
      { id: '1-9', name: 'CATACOMB DESCENT', par: 250, theme: 'cellar', rooms: [
        R(20, 26, ['pillars', 'water'], ['g7', 's3 f3']),
        R(24, 24, ['crates'], ['h1 g3 x4', 's3 f3 k2']),
        R(28, 28, ['platforms'], ['h2 s2', 'g6 f4']),
        { w: 28, d: 28, props: ['colonnade'], waves: [], boss: 'queen', hint: 'TRAINER: only nails hurt the queen' },
      ] },
      { id: '1-10', name: 'BUTTRESS', par: 260, rooms: [
        R(28, 28, ['balcony'], ['s5 g4', 'h2 f3']),
        R(24, 34, ['colonnade'], ['h2 s3 n2', 'g6 k3 p1']),
        R(30, 26, ['altar'], ['h3', 's4 f4 g3']),
      ] },
      { id: '1-11', name: 'THE SPIRE', par: 320, rooms: [
        R(20, 20, ['pews'], ['g6 s2']),
        R(22, 22, ['balcony'], ['f5 s2']),
        R(24, 24, ['colonnade'], ['h2 g4']),
        R(26, 26, ['altar'], ['s5 f4 n2 p1']),
        R(30, 30, ['balcony'], ['h2 s3 f4', 'g6 k2 x3 h1']),
      ] },
      { id: '1-12', name: 'THE HIGH MASON', par: 300, boss: true, rooms: [
        R(24, 24, ['pews'], ['g6 s3', 'f4 h1']),
        { w: 44, d: 44, props: ['colonnade'], waves: [], boss: 'boss2' },
      ] },
    ],
  },
];
export const DUEL_SCENE = { id: 'S', name: 'DUELS', theme: 'cathedral' };
export const DUELS = [
  { id: '0-S', name: 'SISTER SHARD', duel: 'blade', unlockAfter: '0-5', theme: 'cathedral', par: 150, boss: true, startHint: 'A duel of honor. Win it, and the BLADE ARM is yours.', rooms: [{ w: 32, d: 32, props: ['colonnade'], waves: [], boss: 'shard' }] },
  { id: '1-S', name: 'BIG BERTHA BRICKS', duel: 'shock', unlockAfter: '1-6', orArm: 'blade', theme: 'cellar', par: 170, boss: true, startHint: 'The crowd roars. Beat the champ for the SHOCKWAVE FIST.', rooms: [{ w: 34, d: 34, props: ['ruins'], waves: [], boss: 'bertha' }] },
  { id: '1-S2', name: 'KITE', duel: 'grapple', unlockAfter: '1-11', orArm: 'shock', theme: 'cathedral', par: 160, boss: true, startHint: 'Something is swinging up in the rafters... Catch it for the GRAPPLE HOOK.', rooms: [{ w: 34, d: 34, props: ['colonnade', 'balcony'], waves: [], boss: 'kite' }] },
  { id: '2-S', name: 'THE GILDED ONE', duel: 'gold', skulls: true, theme: 'kiln', par: 180, boss: true, startHint: 'Every skull found. The gilded one has been waiting for you.', rooms: [{ w: 34, d: 34, props: ['pillars'], waves: [], boss: 'gilded' }] },
];
SCENES.push({
  id: 2, name: 'THE KILN', theme: 'kiln',
  levels: [
    { id: '2-1', name: 'BRICKWORKS GATE', par: 200, startHint: 'The KILN. Lava burns and launches you · jump or dash across', rooms: [
      R(24, 26, ['lava', 'pillars'], ['g6 s2', 'x3 f3']),
      R(26, 24, ['lava', 'platforms'], ['h1 g4 s2', 'k2 n1 f2']),
    ] },
    { id: '2-2', name: 'FIRING LINE', par: 210, startHint: 'FLAME VENTS glow before they erupt · enemies burn too', rooms: [
      R(24, 30, ['vents', 'ruins'], ['g6 x2', 's3 n2 f2']),
      R(28, 24, ['vents', 'lava'], ['h2 g4', 'k3 p1 s2']),
    ] },
    { id: '2-3', name: 'THE PRESS', par: 220, startHint: 'CRUSHERS slam on a rhythm · lure enemies underneath for style', rooms: [
      R(26, 26, ['crushers'], ['g8', 'h1 k2 s2']),
      R(24, 32, ['crushers', 'vents'], ['x4 g4 f2', 'h2 n2 p1']),
    ] },
    { id: '2-4', name: 'SLAG CANALS', par: 230, rooms: [
      R(22, 32, ['lava', 'crates'], ['g6 s3', 'f5 x3']),
      R(30, 24, ['lava', 'platforms'], ['h2 k2 p1', 'n3 s3 g4']),
      R(24, 24, ['vents'], ['h1 x5 f3']),
    ] },
    { id: '2-5', name: 'BELLOWS HALL', par: 230, rooms: [
      R(30, 30, ['crushers', 'pillars'], ['g8 s2', 'h2 k3', 'f6 p1']),
      R(26, 22, ['vents', 'lava'], ['n3 x4 s2']),
    ] },
    { id: '2-6', name: 'CLINKER YARD', par: 240, rooms: [
      R(26, 26, ['ruins', 'lava'], ['g7 k2', 's4 f4 p1']),
      R(28, 28, ['crushers', 'platforms'], ['h3 x3', 'n3 s3 k2']),
      R(24, 24, ['vents'], ['f6 x4 p1']),
    ] },
    { id: '2-7', name: 'KILN No. 7', par: 250, rooms: [
      R(32, 26, ['lava', 'vents'], ['g8 s3', 'h2 n2 p2']),
      R(26, 32, ['crushers', 'lava'], ['k4 x4 f3', 'h2 s4 g4']),
    ] },
    { id: '2-8', name: 'ASH PITS', par: 250, rooms: [
      R(24, 24, ['vents', 'pillars'], ['f6 x3']),
      R(28, 28, ['lava', 'platforms'], ['h2 g6 p1', 'n4 k2 s2']),
      R(26, 26, ['crushers'], ['h3 x4 f3']),
    ] },
    { id: '2-9', name: 'MORTAR MILL', par: 260, rooms: [
      R(30, 30, ['crushers', 'vents'], ['g10 k2', 's4 n3 p1', 'h3 x4']),
      R(24, 28, ['lava'], ['f8 s3 p1']),
    ] },
    { id: '2-10', name: 'GLAZE ROOM', par: 260, rooms: [
      R(26, 26, ['lava', 'ruins'], ['h2 k3 s3', 'x6 f4']),
      R(28, 24, ['vents', 'crushers'], ['n4 p2 g6', 'h3 k2 s3']),
      R(24, 24, ['lava', 'platforms'], ['h2 x4 f4 p1']),
    ] },
    { id: '2-11', name: 'THE CHIMNEY STACK', par: 320, rooms: [
      R(22, 22, ['vents'], ['g8 x4']),
      R(24, 24, ['crushers'], ['h2 k3 p1']),
      R(26, 26, ['lava', 'platforms'], ['n4 s4 f4']),
      R(28, 28, ['vents', 'lava'], ['h3 x5 p2', 'k4 n3 g6']),
    ] },
    { id: '2-12', name: 'THE MOLTEN FOREMAN', par: 320, boss: true, startHint: 'The heat is unbearable. Something enormous is working the kiln...', rooms: [
      R(24, 24, ['vents'], ['g6 x3 s3', 'h2 n2 p1']),
      { w: 46, d: 46, props: ['platforms', 'pillars'], waves: [], boss: 'boss3' },
    ] },
  ],
});
export const LEVELS = [...SCENES.flatMap((s) => s.levels.map((l) => ({ ...l, scene: s, theme: l.theme || s.theme }))), ...DUELS.map((d) => ({ ...d, scene: DUEL_SCENE }))];

export const THEMES = {
  cellar: { wallH: 8, corrH: 6, doorH: 5, fog: 0x10140f, fogNear: 8, fogFar: 75, sky: 0x0b0e0b },
  kiln: { wallH: 12, corrH: 8, doorH: 6, fog: 0x2a0e06, fogNear: 14, fogFar: 100, sky: 0x1a0804 },
  cathedral: { wallH: 18, corrH: 10, doorH: 7, fog: 0x1d1210, fogNear: 20, fogFar: 130, sky: 0x150c0a },
};

const TYPES = { g: 'grunt', s: 'shooter', h: 'heavy', f: 'flyer', k: 'shield', n: 'sniper', x: 'bomber', p: 'priest' };
export function parseWave(str) {
  const out = [];
  for (const tok of str.trim().split(/\s+/)) {
    const t = TYPES[tok[0]];
    const n = Number(tok.slice(1)) || 1;
    for (let i = 0; i < n; i++) out.push(t);
  }
  return out;
}

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h; }

const DIRS = { N: [0, -1], E: [1, 0], W: [-1, 0], S: [0, 1] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const CW = 5; // corridor / door width

// ctx: { box(x,y,z,w,h,d,mat,tex,solid), decor(obj), torch(x,y,z,nx,nz), mats, makeWindow(), makeBanner(), candle(x,y,z) }
export function buildLevel(level, ctx) {
  const rng = mulberry(hashStr(level.id) ^ 0x9e3779b9);
  const rand = (a, b) => a + rng() * (b - a);
  const T = THEMES[level.theme];
  const M = ctx.mats;
  const wallMat = level.theme === 'cellar' ? M.cobble : M.brick;
  const isKiln = level.theme === 'kiln';
  const trimMat = level.theme === 'cellar' ? M.brick : M.cobble;

  const specs = [{ w: 14, d: 14, props: [], waves: [], hint: level.startHint, kind: 'start' }, ...level.rooms.map((r) => ({ ...r, kind: r.boss ? 'boss' : 'arena' }))];
  if (!level.boss) specs.push({ w: 14, d: 14, props: [], waves: [], kind: 'exit' });

  // ---- layout
  const rooms = [], corridors = [], occupied = [];
  const overlaps = (a) => occupied.some((b) => a.x0 < b.x1 + 2 && a.x1 > b.x0 - 2 && a.z0 < b.z1 + 2 && a.z1 > b.z0 - 2);
  let lastDir = 'N';
  specs.forEach((sp, i) => {
    if (i === 0) {
      const r = { ...sp, cx: 0, cz: 0, doors: [] };
      rect(r); rooms.push(r); occupied.push(pad(r, 1));
      return;
    }
    const prev = rooms[i - 1];
    const opts = shuffle(['N', 'N', 'E', 'W'].filter((d) => d !== OPP[lastDir]), rng);
    let placed = null;
    for (let tries = 0; tries < 12 && !placed; tries++) {
      const dir = opts[tries % opts.length];
      const len = Math.round(rand(7, 13)) + Math.floor(tries / opts.length) * 6;
      const [dx, dz] = DIRS[dir];
      const halfPrev = dx ? prev.w / 2 + 1 : prev.d / 2 + 1;
      const halfNew = dx ? sp.w / 2 + 1 : sp.d / 2 + 1;
      const ex = prev.cx + dx * halfPrev, ez = prev.cz + dz * halfPrev;
      const r = { ...sp, cx: ex + dx * (len + halfNew), cz: ez + dz * (len + halfNew), doors: [] };
      rect(r);
      const c = corridorRect(ex, ez, dir, len);
      if (!overlaps(pad(r, 1)) && !overlaps(c)) placed = { r, c, dir, len, ex, ez };
    }
    if (!placed) { // fallback: go far north
      const dir = 'N', len = 30, halfPrev = prev.d / 2 + 1, halfNew = sp.d / 2 + 1;
      const ex = prev.cx, ez = prev.cz - halfPrev;
      const r = { ...sp, cx: ex, cz: ez - len - halfNew, doors: [] };
      rect(r);
      placed = { r, c: corridorRect(ex, ez, dir, len), dir, len, ex, ez };
    }
    const { r, c, dir } = placed;
    const door = { a: prev, b: r, dir };
    prev.doors.push({ side: dir, door });
    r.doors.push({ side: OPP[dir], door });
    corridors.push({ ...c, dir, door, len: placed.len, ex: placed.ex, ez: placed.ez });
    rooms.push(r); occupied.push(pad(r, 1)); occupied.push(c);
    lastDir = dir;
  });

  // one arena room per level hides a secret wall (never in duels)
  if (!level.duel) {
    const cands = rooms.filter((x) => x.kind === 'arena');
    if (cands.length) cands[Math.floor(rng() * cands.length)].secret = true;
  }

  // ---- geometry
  const doors = [];
  for (const r of rooms) buildRoom(r);
  for (const c of corridors) buildCorridor(c);

  function rect(r) {
    r.x0 = r.cx - r.w / 2; r.x1 = r.cx + r.w / 2; r.z0 = r.cz - r.d / 2; r.z1 = r.cz + r.d / 2;
  }
  function pad(r, p) { return { x0: r.x0 - p, x1: r.x1 + p, z0: r.z0 - p, z1: r.z1 + p }; }
  function corridorRect(ex, ez, dir, len) {
    const [dx, dz] = DIRS[dir];
    const ax = ex, az = ez, bx = ex + dx * len, bz = ez + dz * len;
    const hw = CW / 2 + 1;
    return dx ? { x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: ez - hw, z1: ez + hw } : { x0: ex - hw, x1: ex + hw, z0: Math.min(az, bz), z1: Math.max(az, bz) };
  }

  function buildRoom(r) {
    const H = r.kind === 'boss' ? T.wallH + 4 : T.wallH;
    ctx.box(r.cx, -1, r.cz, r.w + 2, 1, r.d + 2, M.floor, 3.5);
    const doorSides = new Set(r.doors.map((d) => d.side));
    // N & S walls span full width incl. corners, E & W fill between
    for (const side of ['N', 'S', 'E', 'W']) {
      const horiz = side === 'N' || side === 'S';
      const fixed = side === 'N' ? r.z0 - 0.5 : side === 'S' ? r.z1 + 0.5 : side === 'W' ? r.x0 - 0.5 : r.x1 + 0.5;
      const a = horiz ? r.x0 - 1 : r.z0, b = horiz ? r.x1 + 1 : r.z1;
      const center = horiz ? r.cx : r.cz;
      const segs = doorSides.has(side) ? [[a, center - CW / 2], [center + CW / 2, b]] : [[a, b]];
      for (const [s0, s1] of segs) {
        const len = s1 - s0, mid = (s0 + s1) / 2;
        if (len <= 0.01) continue;
        if (horiz) ctx.box(mid, 0, fixed, len, H, 1, wallMat, level.theme === 'cellar' ? 3 : 4);
        else ctx.box(fixed, 0, mid, 1, H, len, wallMat, level.theme === 'cellar' ? 3 : 4);
      }
      // skirting trim + cap
      if (horiz) {
        ctx.box(r.cx, H, fixed, r.w + 2.6, 0.6, 1.6, trimMat, 3, false);
      } else {
        ctx.box(fixed, H, r.cz, 1.6, 0.6, r.d, trimMat, 3, false);
      }
      if (doorSides.has(side)) {
        // lintel above door + arch trim
        if (horiz) {
          ctx.box(center, T.doorH, fixed, CW, H - T.doorH, 1, wallMat, 3);
          ctx.box(center, T.doorH, fixed, CW + 1.6, 0.6, 1.4, trimMat, 3, false);
          for (const s of [-1, 1]) ctx.box(center + s * (CW / 2 + 0.4), 0, fixed, 0.8, T.doorH, 1.4, trimMat, 3, false);
        } else {
          ctx.box(fixed, T.doorH, center, 1, H - T.doorH, CW, wallMat, 3);
          ctx.box(fixed, T.doorH, center, 1.4, 0.6, CW + 1.6, trimMat, 3, false);
          for (const s of [-1, 1]) ctx.box(fixed, 0, center + s * (CW / 2 + 0.4), 1.4, T.doorH, 0.8, trimMat, 3, false);
        }
      }
    }
    // torches along walls (skip near doors)
    const torchY = Math.min(4.5, H - 2);
    const step = 9;
    for (const side of ['N', 'S', 'E', 'W']) {
      const horiz = side === 'N' || side === 'S';
      const len = horiz ? r.w : r.d;
      const n = Math.max(1, Math.floor(len / step));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        const along = (horiz ? r.cx : r.cz) + t * len;
        if (doorSides.has(side) && Math.abs(along - (horiz ? r.cx : r.cz)) < CW / 2 + 2) continue;
        if (side === 'N') ctx.torch(along, torchY, r.z0, 0, 1);
        if (side === 'S') ctx.torch(along, torchY, r.z1, 0, -1);
        if (side === 'W') ctx.torch(r.x0, torchY, along, 1, 0);
        if (side === 'E') ctx.torch(r.x1, torchY, along, -1, 0);
      }
    }
    // keep-clear lanes in front of doors and the room centre path
    const clear = r.doors.map(({ side }) => {
      const [dx, dz] = DIRS[side];
      const px = r.cx + dx * (r.w / 2 - 3), pz = r.cz + dz * (r.d / 2 - 3);
      return { x0: px - CW / 2 - 1.5, x1: px + CW / 2 + 1.5, z0: pz - CW / 2 - 1.5, z1: pz + CW / 2 + 1.5 };
    });
    const placedProps = [];
    const free = (q) => q.x0 > r.x0 + 1 && q.x1 < r.x1 - 1 && q.z0 > r.z0 + 1 && q.z1 < r.z1 - 1 &&
      !clear.some((c) => q.x0 < c.x1 && q.x1 > c.x0 && q.z0 < c.z1 && q.z1 > c.z0) &&
      !placedProps.some((c) => q.x0 < c.x1 + 1.2 && q.x1 > c.x0 - 1.2 && q.z0 < c.z1 + 1.2 && q.z1 > c.z0 - 1.2);
    const tryRect = (x, z, w, d) => { const q = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }; if (!free(q)) return false; placedProps.push(q); return true; };
    const ri = () => ({ x: rand(r.x0 + 3, r.x1 - 3), z: rand(r.z0 + 3, r.z1 - 3) });
    if (r.kind === 'boss') clear.push({ x0: r.cx - 6, x1: r.cx + 6, z0: r.cz - 6, z1: r.cz + 6 });

    if (r.secret) {
      const sides = ['N', 'S', 'E', 'W'].filter((sd) => !doorSides.has(sd));
      const side = sides[Math.floor(rng() * sides.length)] || 'N';
      const [dx, dz] = DIRS[side];
      const horiz = side === 'N' || side === 'S';
      const len = horiz ? r.w : r.d;
      const off = (rng() < 0.5 ? -1 : 1) * (len / 2 - 2.6);
      const depth = 1.4;
      const x = horiz ? r.cx + off : r.cx + dx * (r.w / 2 - depth / 2);
      const z = horiz ? r.cz + dz * (r.d / 2 - depth / 2) : r.cz + off;
      placedProps.push({ x0: x - 2, x1: x + 2, z0: z - 2, z1: z + 2 });
      ctx.secretWall(x, z, horiz ? 2.4 : depth, horiz ? depth : 2.4, 3.2, level.id);
    }
    for (const p of r.props || []) {
      if (p === 'lava') {
        const horiz = rng() < 0.5;
        for (let i = 0; i < 2; i++) {
          const t = (i === 0 ? -0.22 : 0.22) + rand(-0.05, 0.05);
          const x = horiz ? r.cx : r.cx + t * r.w, z = horiz ? r.cz + t * r.d : r.cz;
          ctx.hazard('lava', x, z, horiz ? r.w - 1 : 2.6, horiz ? 2.6 : r.d - 1);
        }
        continue;
      }
      if (p === 'vents') {
        for (let i = 0; i < 6; i++) { const { x, z } = ri(); if (tryRect(x, z, 1.8, 1.8)) ctx.hazard('vent', x, z, 1.6, 1.6, { phase: rng() * 4 }); }
        continue;
      }
      if (p === 'crushers') {
        for (let i = 0; i < 4; i++) { const { x, z } = ri(); if (tryRect(x, z, 3, 3)) ctx.hazard('crusher', x, z, 2.6, 2.6, { phase: rng() * 3.2, top: H - 1.5 }); }
        continue;
      }
      if (p === 'pillars') {
        const gap = r.kind === 'boss' ? 12 : 8;
        for (let x = r.x0 + gap / 2 + 1; x < r.x1 - 2; x += gap) for (let z = r.z0 + gap / 2 + 1; z < r.z1 - 2; z += gap) {
          if (!tryRect(x, z, 2.2, 2.2)) continue;
          ctx.box(x, 0, z, 2.2, H - 1, 2.2, M.cobble, 3);
          ctx.box(x, H - 1, z, 2.8, 0.7, 2.8, M.brick, 4);
          ctx.box(x, 0, z, 2.8, 0.6, 2.8, M.brick, 4);
        }
      } else if (p === 'crates') {
        for (let i = 0; i < Math.round(r.w * r.d / 70); i++) {
          const { x, z } = ri();
          const s = rand(1.1, 1.6);
          if (!tryRect(x, z, s * 2.1, s * 2.1)) continue;
          ctx.box(x, 0, z, s, s, s, M.wood, 1.5);
          for (const y of [0.04, s - 0.12]) ctx.box(x, y, z, s + 0.04, 0.08, s + 0.04, M.iron, 1, false);
          for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.box(x + ox * s * 0.48, 0, z + oz * s * 0.48, 0.08, s + 0.02, 0.08, M.iron, 1, false);
          if (rng() < 0.5) ctx.box(x + s * 0.55, 0, z + rand(-0.3, 0.3), s * 0.8, s * 0.8, s * 0.8, M.wood, 1.5);
          if (rng() < 0.4) ctx.box(x, s, z, s * 0.8, s * 0.8, s * 0.8, M.wood, 1.5);
        }
      } else if (p === 'platforms') {
        for (let i = 0; i < 3; i++) {
          const { x, z } = ri();
          const w = rand(4, 6.5), d = rand(4, 6.5), h = rand(1.6, 3);
          if (!tryRect(x, z, w + 3.5, d)) continue;
          ctx.box(x, 0, z, w, h, d, M.cobble, 3);
          ctx.box(x - w / 2 - 1.2, 0, z, 2.4, Math.min(1.3, h / 2), 2.4, M.cobble, 3);
          ctx.box(x, h, z, w, 0.2, d, M.brick, 4, false);
        }
      } else if (p === 'ruins') {
        for (let i = 0; i < Math.round(r.w * r.d / 120); i++) {
          const { x, z } = ri();
          const horiz = rng() < 0.5, len = rand(3.5, 6.5), h = rand(1.0, 2.2);
          if (!tryRect(x, z, horiz ? len : 1, horiz ? 1 : len)) continue;
          ctx.box(x, 0, z, horiz ? len : 0.9, h, horiz ? 0.9 : len, M.brick, 4);
          ctx.box(x + (horiz ? len * 0.3 : 0), h, z + (horiz ? 0 : len * 0.3), horiz ? len * 0.3 : 0.9, rand(0.4, 1), horiz ? 0.9 : len * 0.3, M.brick, 4);
        }
      } else if (p === 'water') {
        const horiz = r.w > r.d;
        const strip = new ctx.THREE.Mesh(new ctx.THREE.PlaneGeometry(horiz ? r.w - 0.2 : 3, horiz ? 3 : r.d - 0.2), M.water);
        strip.rotation.x = -Math.PI / 2;
        strip.position.set(r.cx + (horiz ? 0 : r.w * 0.25), 0.03, r.cz + (horiz ? r.d * 0.25 : 0));
        ctx.decor(strip);
        for (let i = -2; i <= 2; i++) ctx.box(strip.position.x + (horiz ? i * r.w * 0.2 : 0), 0, strip.position.z + (horiz ? 0 : i * r.d * 0.2), horiz ? 0.5 : 3.4, 0.06, horiz ? 3.4 : 0.5, M.iron, 1, false);
        // drain pipes on the wall
        const pipe = new ctx.THREE.Mesh(new ctx.THREE.CylinderGeometry(0.35, 0.35, horiz ? r.w : r.d, 10), M.iron);
        pipe.rotation.set(horiz ? 0 : Math.PI / 2, 0, horiz ? Math.PI / 2 : 0);
        pipe.position.set(horiz ? r.cx : r.x0 + 0.4, H - 2.2, horiz ? r.z0 + 0.4 : r.cz);
        ctx.decor(pipe);
      } else if (p === 'colonnade') {
        const along = r.d >= r.w;
        const gap = r.kind === 'boss' ? 10 : 7;
        const len = along ? r.d : r.w;
        for (const off of [-0.3, 0.3]) for (let t = -len / 2 + gap / 2 + 1; t < len / 2 - 2; t += gap) {
          const x = along ? r.cx + off * r.w : r.cx + t, z = along ? r.cz + t : r.cz + off * r.d;
          if (!tryRect(x, z, 2.4, 2.4)) continue;
          ctx.box(x, 0, z, 3, 1, 3, M.cobble, 3);
          ctx.box(x, 1, z, 2, H - 3, 2, M.brick, 4);
          ctx.box(x, H - 2, z, 3, 1, 3, M.cobble, 3);
        }
      } else if (p === 'pews') {
        const along = r.d >= r.w;
        const len = along ? r.d : r.w;
        for (const off of [-1, 1]) for (let t = -len / 2 + 4; t < len / 2 - 4; t += 3) {
          const across = (along ? r.w : r.d) * 0.22 * off;
          const x = along ? r.cx + across : r.cx + t, z = along ? r.cz + t : r.cz + across;
          const pw = Math.min(5, (along ? r.w : r.d) * 0.3);
          if (!tryRect(x, z, along ? pw : 0.9, along ? 0.9 : pw)) continue;
          ctx.box(x, 0, z, along ? pw : 0.8, 0.9, along ? 0.8 : pw, M.wood, 1.5);
          ctx.box(x + (along ? 0 : 0.35), 0.9, z + (along ? 0.35 : 0), along ? pw : 0.12, 0.6, along ? 0.12 : pw, M.wood, 1.5, false);
        }
      } else if (p === 'altar') {
        const sides = ['N', 'S', 'E', 'W'].filter((s) => !doorSides.has(s));
        const side = sides[0] || 'N';
        const [dx, dz] = DIRS[side];
        const horiz = side === 'N' || side === 'S';
        const w = horiz ? Math.min(10, r.w - 6) : 4, d = horiz ? 4 : Math.min(10, r.d - 6);
        const x = r.cx + dx * (r.w / 2 - 3), z = r.cz + dz * (r.d / 2 - 3);
        if (tryRect(x, z, w, d)) {
          ctx.box(x, 0, z, w, 1.2, d, M.cobble, 3);
          ctx.box(x - dx * 2.6, 0, z - dz * 2.6, horiz ? w * 0.6 : 1.2, 0.6, horiz ? 1.2 : d * 0.6, M.cobble, 3);
          ctx.box(x, 1.2, z, horiz ? 3 : 1.2, 1, horiz ? 1.2 : 3, M.brick, 4);
          for (const s of [-1, 1]) ctx.candle(x + (horiz ? s * 1.8 : 0), 1.2, z + (horiz ? 0 : s * 1.8));
        }
      } else if (p === 'balcony') {
        const sides = ['N', 'S', 'E', 'W'].filter((s) => !doorSides.has(s)).slice(0, 2);
        for (const side of sides) {
          const [dx, dz] = DIRS[side];
          const horiz = side === 'N' || side === 'S';
          const len = (horiz ? r.w : r.d) - 8;
          const x = r.cx + dx * (r.w / 2 - 1.8), z = r.cz + dz * (r.d / 2 - 1.8);
          if (!tryRect(x, z, horiz ? len : 3.2, horiz ? 3.2 : len)) continue;
          ctx.box(x, 0, z, horiz ? len : 3.2, 3.2, horiz ? 3.2 : len, M.cobble, 3);
          ctx.box(x - dx * 1.5, 3.2, z - dz * 1.5, horiz ? len : 0.3, 1, horiz ? 0.3 : len, M.brick, 4, false);
          // steps at one end
          const ax = horiz ? x - len / 2 - 1.3 : x, az = horiz ? z : z - len / 2 - 1.3;
          ctx.box(ax, 0, az, 2.4, 1.6, 2.4, M.cobble, 3);
        }
      }
    }
    if (isKiln) {
      for (const side of ['N', 'S', 'E', 'W']) {
        if (doorSides.has(side)) continue;
        const [dx, dz] = DIRS[side];
        const horiz = side === 'N' || side === 'S';
        const x = horiz ? r.cx + rand(-r.w / 4, r.w / 4) : r.cx + dx * (r.w / 2 - 0.05);
        const z = horiz ? r.cz + dz * (r.d / 2 - 0.05) : r.cz + rand(-r.d / 4, r.d / 4);
        ctx.furnace(x, z, side);
      }
    }
    // cathedral dressing: stained glass + banners
    if (level.theme === 'cathedral') {
      for (const side of ['N', 'S', 'E', 'W']) {
        const horiz = side === 'N' || side === 'S';
        const len = horiz ? r.w : r.d;
        const n = Math.max(1, Math.floor(len / 10));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n - 0.5;
          const along = (horiz ? r.cx : r.cz) + t * len;
          if (doorSides.has(side) && Math.abs(along - (horiz ? r.cx : r.cz)) < CW) continue;
          const win = ctx.makeWindow(Math.floor(rng() * 4));
          const y = H * 0.62;
          if (side === 'N') { win.position.set(along, y, r.z0 + 0.02); }
          if (side === 'S') { win.position.set(along, y, r.z1 - 0.02); win.rotation.y = Math.PI; }
          if (side === 'W') { win.position.set(r.x0 + 0.02, y, along); win.rotation.y = Math.PI / 2; }
          if (side === 'E') { win.position.set(r.x1 - 0.02, y, along); win.rotation.y = -Math.PI / 2; }
          ctx.decor(win);
        }
      }
    }
    // spawn points for waves
    r.spawns = [];
    for (let i = 0; i < 40 && r.spawns.length < 14; i++) {
      const x = rand(r.x0 + 2.5, r.x1 - 2.5), z = rand(r.z0 + 2.5, r.z1 - 2.5);
      if (ctx.blocked(x, z)) continue;
      r.spawns.push([x, z]);
    }
    if (!r.spawns.length) r.spawns.push([r.cx, r.cz]);
    r.waves = (r.waves || []).map(parseWave);
    r.state = r.waves.length || r.boss ? 'idle' : 'none';
  }

  function buildCorridor(c) {
    const horiz = c.dir === 'E' || c.dir === 'W';
    const len = c.len;
    const [dx, dz] = DIRS[c.dir];
    const mx = c.ex + dx * len / 2, mz = c.ez + dz * len / 2;
    ctx.box(mx, -1, mz, horiz ? len : CW + 2, 1, horiz ? CW + 2 : len, M.floor, 3.5);
    for (const s of [-1, 1]) {
      if (horiz) ctx.box(mx, 0, mz + s * (CW / 2 + 0.5), len, T.corrH, 1, wallMat, 3);
      else ctx.box(mx + s * (CW / 2 + 0.5), 0, mz, 1, T.corrH, len, wallMat, 3);
    }
    // arches every few metres
    for (let t = 2; t < len - 1; t += 4) {
      const x = c.ex + dx * t, z = c.ez + dz * t;
      if (horiz) ctx.box(x, T.doorH + 0.4, z, 0.8, T.corrH - T.doorH - 0.4, CW + 2, trimMat, 3, false);
      else ctx.box(x, T.doorH + 0.4, z, CW + 2, T.corrH - T.doorH - 0.4, 0.8, trimMat, 3, false);
    }
    const tx = c.ex + dx * len / 2, tz = c.ez + dz * len / 2;
    if (horiz) ctx.torch(tx, 3.5, tz - CW / 2, 0, 1);
    else ctx.torch(tx - CW / 2, 3.5, tz, 1, 0);
  }

  function makeDoor(room, side, open, forward) {
    const [dx, dz] = DIRS[side];
    const horiz = side === 'N' || side === 'S';
    const x = horiz ? room.cx : room.cx + dx * (room.w / 2 + 0.5);
    const z = horiz ? room.cz + dz * (room.d / 2 + 0.5) : room.cz;
    // invisible solid slab (blocks movement + bullets); the portcullis you see is its children
    const mesh = ctx.box(x, 0, z, horiz ? CW : 0.6, T.doorH, horiz ? 0.6 : CW, M.hidden, 2);
    const TH = ctx.THREE;
    const along = (o, v) => { if (horiz) o.position.x = v; else o.position.z = v; };
    const H = T.doorH;
    for (let i = -3; i <= 3; i++) {
      const bar = new TH.Mesh(new TH.CylinderGeometry(0.07, 0.07, H * 0.96, 6), M.ironDark);
      along(bar, i * CW * 0.135);
      mesh.add(bar);
      const spike = new TH.Mesh(new TH.ConeGeometry(0.1, 0.35, 4), M.iron);
      spike.position.y = -H / 2 - 0.05; spike.rotation.x = Math.PI;
      along(spike, i * CW * 0.135);
      mesh.add(spike);
    }
    for (const y of [-H * 0.25, H * 0.1, H * 0.42]) {
      const cross = new TH.Mesh(new TH.BoxGeometry(horiz ? CW * 0.96 : 0.22, 0.16, horiz ? 0.22 : CW * 0.96), M.iron);
      cross.position.y = y;
      mesh.add(cross);
      for (let i = -3; i <= 3; i++) {
        const rv = new TH.Mesh(new TH.SphereGeometry(0.06, 5, 4), M.iron);
        rv.position.y = y; along(rv, i * CW * 0.135);
        if (horiz) rv.position.z = 0.12; else rv.position.x = 0.12;
        mesh.add(rv);
      }
    }
    const strip = new TH.Mesh(new TH.BoxGeometry(horiz ? CW * 0.98 : 0.26, 0.12, horiz ? 0.26 : CW * 0.98), M.doorGlow.clone());
    strip.position.y = H * 0.5 - 0.2;
    mesh.add(strip);
    for (const c of mesh.children) c.castShadow = true;
    const door = { forward, mesh, strip, h: T.doorH, baseY: T.doorH / 2, solid: mesh.userData.solid, t: open ? 1 : 0, target: open ? 1 : 0 };
    room.doorObjs.push(door);
    doors.push(door);
    return door;
  }
  for (const r of rooms) r.doorObjs = [];
  rooms.forEach((r, i) => {
    const combat = r.state === 'idle';
    for (const { side, door } of r.doors) {
      const forward = door.a === r; // this doorway leads onward
      makeDoor(r, side, !(combat && forward), forward);
    }
  });

  // start position: centre of the start room, facing its exit
  const first = rooms[0];
  const exitSide = first.doors[0] ? first.doors[0].side : 'N';
  const yaw = { N: 0, W: Math.PI / 2, S: Math.PI, E: -Math.PI / 2 }[exitSide];
  return { rooms, doors, start: { x: first.cx, z: first.cz + 2 * (exitSide === 'N' ? 1 : 0), yaw }, theme: T };
}

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
