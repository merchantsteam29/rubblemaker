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
      { id: '0-4', name: 'THE SUMP', par: 200, startHint: 'The KILN spits fire · PUNCH its glowing spit straight back at it', rooms: [
        R(24, 24, ['ruins', 'water'], ['g5', 'h1 g2']),
        R(20, 30, ['pillars'], ['s3 f2', 'g4 s2 x2'], 'BOMBERS blow up near you · shoot them at range'),
        R(30, 26, ['platforms', 'crates'], ['h1 g3 f2', 'h1 s3']),
        { w: 26, d: 26, props: ['pillars'], waves: [], boss: 'kiln', hint: 'TRAINER: only its own spit, PARRIED back, cracks the KILN' },
      ] },
      { id: '0-5', name: "WARDEN'S VAULT", par: 260, startHint: 'Something heavy stirs below... beat MORTIMER to claim the SHOTGUN', boss: true, rooms: [
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
        { w: 28, d: 28, props: ['colonnade'], waves: [], boss: 'marksman', hint: 'TRAINER: punch his shot back' },
      ] },
      { id: '1-5', name: 'CHOIR OF STONE', par: 220, rooms: [
        R(24, 24, ['pews'], ['s4 g2', 's3 f3']),
        R(28, 22, ['balcony'], ['s4 h1 p1', 'g6 k2 n1']),
        R(24, 30, ['altar'], ['h2', 's3 f3 g2']),
        { w: 32, d: 32, props: ['colonnade'], waves: [], boss: 'organist', hint: 'MINI-BOSS · beat THE ORGANIST for the NAILGUN' },
      ] },
      { id: '2-1', seed: '1-6', name: 'RELIQUARY', par: 230, rooms: [
        R(26, 26, ['colonnade'], ['h1 g4', 'h2']),
        R(22, 22, ['altar'], ['s3 f3', 'h1 s2 g3']),
        R(30, 30, ['balcony'], ['h2 g4 p1', 'h1 s3 f3 x3']),
      ] },
      { id: '2-2', seed: '1-7', name: 'THE TRANSEPT', par: 250, rooms: [
        R(36, 24, ['colonnade', 'pews'], ['g8 s2', 'f4 s3 n2', 'h2 g4 k2']),
        R(24, 36, ['colonnade'], ['s4 f4', 'h2 s2 g4']),
        { w: 28, d: 28, props: ['colonnade'], waves: [], boss: 'fortress', hint: 'TRAINER: strip the shield layers' },
      ] },
      { id: '2-3', seed: '1-8', name: 'STAINED GLASS', par: 240, rooms: [
        R(26, 26, ['balcony'], ['f6', 'f4 g4']),
        R(30, 24, ['pews'], ['f5 s3 p1', 'h1 f4 x3']),
        R(26, 30, ['colonnade'], ['f6 s2', 'h2 f4']),
      ] },
      { id: '2-4', seed: '1-9', name: 'CATACOMB DESCENT', par: 250, theme: 'cellar', rooms: [
        R(20, 26, ['pillars', 'water'], ['g7', 's3 f3']),
        R(24, 24, ['crates'], ['h1 g3 x4', 's3 f3 k2']),
        R(28, 28, ['platforms'], ['h2 s2', 'g6 f4']),
        { w: 28, d: 28, props: ['colonnade'], waves: [], boss: 'queen', hint: 'TRAINER: only nails hurt the queen' },
      ] },
      { id: '2-5', seed: '1-10', name: 'BUTTRESS', par: 260, rooms: [
        R(28, 28, ['balcony'], ['s5 g4', 'h2 f3']),
        R(24, 34, ['colonnade'], ['h2 s3 n2', 'g6 k3 p1']),
        R(30, 26, ['altar'], ['h3', 's4 f4 g3']),
        { w: 32, d: 32, props: ['pews'], waves: [], boss: 'ringer', hint: 'MINI-BOSS · beat THE BELL-RINGER for the BRICK LAUNCHER' },
      ] },
      { id: '3-1', seed: '1-11', name: 'THE SPIRE', par: 320, rooms: [
        R(20, 20, ['pews'], ['g6 s2']),
        R(22, 22, ['balcony'], ['f5 s2']),
        R(24, 24, ['colonnade'], ['h2 g4']),
        R(26, 26, ['altar'], ['s5 f4 n2 p1']),
        R(30, 30, ['balcony'], ['h2 s3 f4', 'g6 k2 x3 h1']),
      ] },
      { id: '3-2', seed: '1-12', name: 'THE HIGH MASON', par: 300, boss: true, rooms: [
        R(24, 24, ['pews'], ['g6 s3', 'f4 h1']),
        { w: 44, d: 44, props: ['colonnade'], waves: [], boss: 'boss2' },
      ] },
    ],
  },
];
export const DUEL_SCENE = { id: 'S', name: 'DUELS', theme: 'cathedral' };
export const DUELS = [
  { id: '0-S', name: 'SISTER SHARD', duel: 'blade', unlockAfter: '0-5', theme: 'cathedral', par: 150, boss: true, startHint: 'A duel of honor. Win it, and the BLADE ARM is yours.', rooms: [{ w: 32, d: 32, props: ['colonnade'], waves: [], boss: 'shard' }] },
  { id: '2-S', seed: '1-S', name: 'BIG BERTHA BRICKS', duel: 'shock', unlockAfter: '2-1', orArm: 'blade', theme: 'cellar', par: 170, boss: true, startHint: 'The crowd roars. Beat the champ for the SHOCKWAVE FIST.', rooms: [{ w: 34, d: 34, props: ['ruins'], waves: [], boss: 'bertha' }] },
  { id: '3-S', seed: '1-S2', name: 'KITE', duel: 'grapple', unlockAfter: '3-1', orArm: 'shock', theme: 'cathedral', par: 160, boss: true, startHint: 'Something is swinging up in the rafters... Catch it for the GRAPPLE HOOK.', rooms: [{ w: 34, d: 34, props: ['colonnade', 'balcony'], waves: [], boss: 'kite' }] },
  { id: '4-S', seed: '2-S1', name: 'TUMBLE & TWIRL', duel: 'djump', unlockAfter: '4-4', orArm: 'grapple', theme: 'kiln', par: 170, boss: true, startHint: 'A drumroll echoes off the kiln walls... the TWIN ACROBATS are on. Beat BOTH for the DOUBLE JUMP.', rooms: [{ w: 36, d: 36, props: ['platforms', 'pillars'], waves: [], boss: 'twins' }] },
  { id: '5-S', seed: '2-S2', name: 'CINDER, THE KILN-CAT', duel: 'firedash', unlockAfter: '5-4', orArm: 'djump', theme: 'kiln', par: 170, boss: true, startHint: 'Something big is purring inside the furnace. Tame CINDER to earn the FIRE DASH.', rooms: [{ w: 38, d: 38, props: ['lava', 'platforms'], waves: [], boss: 'cat' }] },
  { id: '6-S', seed: '2-S', name: 'THE GILDED ONE', duel: 'gold', skulls: true, theme: 'kiln', par: 180, boss: true, startHint: 'Every skull found. The gilded one has been waiting for you.', rooms: [{ w: 34, d: 34, props: ['pillars'], waves: [], boss: 'gilded' }] },
];
SCENES.push({
  id: 2, name: 'THE KILN', theme: 'kiln',
  levels: [
    { id: '4-1', seed: '2-1', name: 'BRICKWORKS GATE', par: 200, startHint: 'The KILN. Lava burns and launches you · jump or dash across', rooms: [
      R(24, 26, ['lava', 'pillars'], ['g6 s2', 'x3 f3']),
      R(26, 24, ['lava', 'platforms'], ['h1 g4 s2', 'k2 n1 f2']),
    ] },
    { id: '4-2', seed: '2-2', name: 'FIRING LINE', par: 210, startHint: 'FLAME VENTS glow before they erupt · enemies burn too', rooms: [
      R(24, 30, ['vents', 'ruins'], ['g6 x2', 's3 n2 f2']),
      R(28, 24, ['vents', 'lava'], ['h2 g4', 'k3 p1 s2']),
    ] },
    { id: '4-3', seed: '2-3', name: 'THE PRESS', par: 270, startHint: 'CRUSHERS slam on a rhythm · lure enemies underneath for style', rooms: [
      R(26, 26, ['crushers'], ['g8', 'h1 k2 s2']),
      R(24, 32, ['crushers', 'vents'], ['x4 g4 f2', 'h2 n2 p1']),
      { w: 28, d: 28, props: ['pillars'], waves: [], boss: 'anvil', hint: 'TRAINER: only the BLADE cuts the ANVIL' },
    ] },
    { id: '4-4', seed: '2-4', name: 'SLAG CANALS', par: 230, rooms: [
      R(22, 32, ['lava', 'crates'], ['g6 s3 r1', 'f5 x3']),
      R(30, 24, ['lava', 'platforms'], ['h2 k2 p1', 'n3 s3 g4']),
      R(24, 24, ['vents'], ['h1 x5 f3']),
    ] },
    { id: '4-5', seed: '2-5', name: 'BELLOWS HALL', par: 230, rooms: [
      R(30, 30, ['crushers', 'pillars'], ['g8 s2', 'h2 k3', 'f6 p1']),
      R(26, 22, ['vents', 'lava'], ['n3 x4 s2 b3']),
      { w: 32, d: 32, props: ['pillars'], waves: [], boss: 'stoker', hint: 'MINI-BOSS · beat THE STOKER for the CHAIN FLAIL' },
    ] },
    { id: '5-1', seed: '2-6', name: 'CLINKER YARD', par: 290, rooms: [
      R(26, 26, ['ruins', 'lava'], ['g7 k2', 's4 f4 p1']),
      R(28, 28, ['crushers', 'platforms'], ['h3 x3', 'n3 s3 k2']),
      R(24, 24, ['vents'], ['f6 x4 m1 b2']),
      { w: 28, d: 28, props: ['pillars'], waves: [], boss: 'bellows', hint: 'TRAINER: only a CHARGED SHOCKWAVE cracks the BELLOWS' },
    ] },
    { id: '5-2', seed: '2-7', name: 'KILN No. 7', par: 250, rooms: [
      R(32, 26, ['lava', 'vents'], ['g8 s3', 'h2 n2 p2']),
      R(26, 32, ['crushers', 'lava'], ['k4 x4 f3 r2', 'h2 s4 g4']),
    ] },
    { id: '5-3', seed: '2-8', name: 'ASH PITS', par: 250, rooms: [
      R(24, 24, ['vents', 'pillars'], ['f6 x3']),
      R(28, 28, ['lava', 'platforms'], ['h2 g6 m1 b2', 'n4 k2 s2']),
      R(26, 26, ['crushers'], ['h3 x4 f3']),
    ] },
    { id: '5-4', seed: '2-9', name: 'MORTAR MILL', par: 310, rooms: [
      R(30, 30, ['crushers', 'vents'], ['g10 k2', 's4 n3 p1', 'h3 x4 r2 m1']),
      R(24, 28, ['lava'], ['f8 s3 p1']),
      { w: 30, d: 30, props: ['pillars'], waves: [], boss: 'crane', hint: 'TRAINER: GRAPPLE the CRANE to drag it down' },
    ] },
    { id: '5-5', seed: '2-10', name: 'GLAZE ROOM', par: 260, rooms: [
      R(26, 26, ['lava', 'ruins'], ['h2 k3 s3', 'x6 f4 b4']),
      R(28, 24, ['vents', 'crushers'], ['n4 p2 g6', 'h3 k2 s3']),
      R(24, 24, ['lava', 'platforms'], ['h2 x4 f4 p1']),
      { w: 32, d: 32, props: ['pillars'], waves: [], boss: 'glazier', hint: 'MINI-BOSS · beat THE GLAZIER for a free gun variant' },
    ] },
    { id: '6-1', seed: '2-11', name: 'THE CHIMNEY STACK', par: 320, rooms: [
      R(22, 22, ['vents'], ['g8 x4']),
      R(24, 24, ['crushers'], ['h2 k3 p1']),
      R(26, 26, ['lava', 'platforms'], ['n4 s4 f4']),
      R(28, 28, ['vents', 'lava'], ['h3 x5 p2', 'k4 n3 g6 r2 m1 b2']),
    ] },
    { id: '6-2', seed: '2-12', name: 'THE MOLTEN FOREMAN', par: 320, boss: true, startHint: 'The heat is unbearable. Something enormous is working the kiln...', rooms: [
      R(24, 24, ['vents'], ['g6 x3 s3', 'h2 n2 r1 m1']),
      { w: 46, d: 46, props: ['platforms', 'pillars'], waves: [], boss: 'boss3' },
    ] },
  ],
});
export const PRIME_SCENE = { id: 'P', name: 'BOSS REMATCHES', theme: 'cellar' };
export const PRIMES = [
  { id: '0-P', name: 'MORTIMER PRIME', duel: 'skin:rust', prime: true, unlockAfter: '0-5', theme: 'cellar', par: 200, boss: true, startHint: 'The Warden has been rebuilt: harder, faster, angrier. Beat him for the RUSTED gun skin.', rooms: [{ w: 42, d: 42, props: ['pillars'], waves: [], boss: 'boss1', prime: true }] },
  { id: '3-P', seed: '1-P', name: 'HIGH MASON PRIME', duel: 'skin:marble', prime: true, unlockAfter: '3-2', theme: 'cathedral', par: 260, boss: true, startHint: 'The Architect has redrawn his plans. Survive them for the MARBLE gun skin.', rooms: [{ w: 46, d: 46, props: ['colonnade'], waves: [], boss: 'boss2', prime: true }] },
  { id: '6-P', seed: '2-P', name: 'FOREMAN PRIME', duel: 'skin:magma', prime: true, unlockAfter: '6-2', theme: 'kiln', par: 300, boss: true, startHint: 'The kiln burns white-hot. The Foreman is back on shift. Win the MAGMA gun skin.', rooms: [{ w: 48, d: 48, props: ['platforms', 'pillars'], waves: [], boss: 'boss3', prime: true }] },
];
SCENES.push({
  id: 3, name: 'THE AQUEDUCT', theme: 'aqueduct',
  levels: [
    { id: '7-1', name: 'THE INTAKE', par: 200, startHint: 'The AQUEDUCT. CURRENTS drag you along · deep water slows you down', rooms: [
      R(24, 24, ['channel', 'pillars'], ['g5 s2', 'd2 g3'], 'DIVERS swim under the floor · GROUND SLAM to drag them up'),
      R(26, 22, ['channel', 'water'], ['d3 s3', 'f3 g3']),
      R(24, 28, ['flood'], ['g6 d2', 's3 y1'], 'The water RISES while you fight · it drains when the room is clear'),
    ] },
    { id: '7-2', name: 'SLUICE GATE No. 1', par: 220, startHint: 'SLUICE GATES glow blue, then blast water across the room · get out of the beam', rooms: [
      R(26, 26, ['sluice', 'pillars'], ['g5 k2', 's3 d3']),
      R(24, 30, ['sluice', 'channel'], ['y1 g4', 'n2 f3'], 'SIPHONS suck you in, then spray · kill them before they finish'),
      R(28, 24, ['flood', 'platforms'], ['d4 s2', 'h1 y1 g3']),
    ] },
    { id: '7-3', name: 'THE OVERFLOW', par: 250, rooms: [
      R(24, 24, ['channel'], ['g6 d2', 's3 x2']),
      R(26, 26, ['sluice', 'water'], ['k2 d3 s2', 'h1 g4']),
      { w: 30, d: 30, props: ['channel'], waves: [], boss: 'buoy', hint: 'TRAINER: only a fully wound FLAIL swing sinks THE BUOY' },
    ] },
    { id: '7-4', name: 'MILLRACE', par: 240, rooms: [
      R(30, 24, ['channel', 'pillars'], ['g6 r1 d2', 's3 y1 f2']),
      R(24, 30, ['sluice', 'flood'], ['d4 b2', 'h1 s3 m1']),
      R(26, 26, ['channel', 'platforms'], ['g8 k2', 'y2 n2 f3']),
    ] },
    { id: '7-5', name: 'THE DREDGE PIT', par: 260, rooms: [
      R(26, 26, ['flood', 'pillars'], ['g6 d3', 's4 y1 h1']),
      R(24, 28, ['sluice'], ['d4 x3', 'k3 n2']),
      { w: 34, d: 34, props: ['pillars'], waves: [], boss: 'dredger', hint: 'MINI-BOSS · beat THE DREDGER for the TIDE arm' },
    ] },
    { id: '8-1', name: 'HIGH ARCADE', par: 230, startHint: 'The ARCHES carry the water over the city · a long way down', rooms: [
      R(32, 22, ['colonnade', 'channel'], ['g6 s3', 'f4 n2']),
      R(22, 32, ['sluice', 'colonnade'], ['d4 k2', 'y2 g4']),
      R(28, 28, ['channel', 'platforms'], ['h2 s3 d2', 'f4 p1 g4']),
    ] },
    { id: '8-2', name: 'THE SPILLWAY', par: 250, rooms: [
      R(26, 30, ['flood', 'channel'], ['d5 g3', 's4 y1']),
      R(28, 24, ['sluice', 'pillars'], ['h2 k3', 'n3 f3 x2']),
      R(24, 24, ['flood'], ['y2 d4 m1']),
    ] },
    { id: '8-3', name: 'LOCK AND KEY', par: 280, rooms: [
      R(26, 26, ['sluice', 'channel'], ['g8 d3', 'h1 s3 y1']),
      R(24, 28, ['flood', 'pillars'], ['k3 n2 f2', 'd4 b2']),
      { w: 30, d: 30, props: ['pillars'], waves: [], boss: 'lockkeeper', hint: 'TRAINER: only the TIDE arm shifts THE LOCK-KEEPER' },
    ] },
    { id: '8-4', name: 'SIPHON WORKS', par: 260, rooms: [
      R(28, 28, ['channel', 'platforms'], ['y3 g6', 'h2 s3']),
      R(24, 32, ['sluice', 'flood'], ['y2 d4 k2', 'n3 x3 f2']),
      R(26, 26, ['channel', 'pillars'], ['h2 y2 p1', 'g8 d4 r2']),
    ] },
    { id: '8-5', name: 'THE SINGING ARCH', par: 280, rooms: [
      R(26, 26, ['colonnade', 'flood'], ['g8 d3', 's4 y2 f3']),
      R(28, 24, ['sluice', 'channel'], ['h2 k3 n2', 'd5 m1 b2']),
      { w: 34, d: 34, props: ['colonnade'], waves: [], boss: 'siren', hint: 'MINI-BOSS · beat THE SIREN for the TIDAL gun skin' },
    ] },
    { id: '9-1', name: 'THE DROWNED STAIR', par: 330, startHint: 'The CISTERN. Everything the city drinks passes through here.', rooms: [
      R(26, 26, ['flood', 'channel'], ['g8 d4', 's4 y2 n2']),
      R(24, 32, ['sluice', 'platforms'], ['h2 k3 d3', 'f6 x3']),
      R(30, 28, ['flood', 'pillars'], ['y3 h2 p1', 'd6 r2 m1']),
      R(28, 28, ['channel', 'sluice'], ['h3 s4 n3', 'g10 d4 k3 y2']),
    ] },
    { id: '9-2', name: 'THE GUILDMASTER', par: 340, boss: true, startHint: 'The guild hall stands on the cistern floor. He is waiting.', rooms: [
      R(26, 26, ['channel', 'pillars'], ['g6 d3 k2', 's4 y2 h1']),
      { w: 48, d: 48, props: ['pillars'], waves: [], boss: 'guildmaster' },
    ] },
  ],
});

// RUBBLE RACE courses: short, trap-heavy, light fights, rooms marked shortcut hide a rune that skips the fight
export const RACE_SCENE = { id: 'R', name: 'RACE COURSES', theme: 'cellar' };
const SC = (w, d, props, waves, extra = {}) => ({ w, d, props, waves, ...extra });
export const RACES = [
  { id: 'R-1', name: 'CELLAR SPRINT', theme: 'cellar', par: 90, race: true, startHint: 'RACE! Shortcut runes glow high on the walls · wall jump to reach them', rooms: [
    SC(18, 20, ['crates'], ['g3']),
    SC(22, 22, ['pillars', 'water'], ['g3 s1', 'f2'], { shortcut: true }),
    SC(16, 26, ['platforms'], ['f2 g2']),
    SC(24, 22, ['ruins', 'water'], ['g4', 's2 x2'], { shortcut: true }),
  ] },
  { id: 'R-2', name: 'NAVE DASH', theme: 'cathedral', par: 110, race: true, startHint: 'RACE! Snipers watch the long halls · keep moving', rooms: [
    SC(20, 30, ['colonnade'], ['g3 n1']),
    SC(24, 24, ['balcony'], ['f3 s1', 'k2 g2'], { shortcut: true }),
    SC(18, 34, ['pews'], ['g4 x2']),
    SC(26, 26, ['altar', 'balcony'], ['s2 n1 g2', 'h1'], { shortcut: true }),
  ] },
  { id: 'R-3', name: 'FURNACE RUN', theme: 'kiln', par: 120, race: true, startHint: 'RACE! Lava, vents and crushers · the floor is the real enemy', rooms: [
    SC(22, 26, ['lava', 'platforms'], ['g3 x2']),
    SC(24, 24, ['vents', 'crushers'], ['f3 g2'], { shortcut: true }),
    SC(20, 30, ['lava', 'crushers'], ['r1 g3', 's2 x2']),
    SC(26, 24, ['vents', 'lava'], ['k2 g3', 'h1 f2'], { shortcut: true }),
  ] },
  { id: 'R-4', name: 'THE GAUNTLET', theme: 'kiln', par: 170, race: true, startHint: 'RACE! The long one. Six rooms, three shortcuts, no mercy', rooms: [
    SC(22, 22, ['crushers'], ['g4']),
    SC(24, 26, ['lava', 'vents'], ['x3 f2', 's2 g3'], { shortcut: true }),
    SC(20, 28, ['crushers', 'platforms'], ['r1 g4']),
    SC(26, 26, ['vents', 'lava'], ['h1 k2', 'n2 x2'], { shortcut: true }),
    SC(22, 30, ['lava', 'crushers'], ['f4 s2']),
    SC(28, 28, ['vents', 'platforms', 'lava'], ['h1 g4 x2', 'p1 s3 f2'], { shortcut: true }),
  ] },
];
export const LEVELS = [...SCENES.flatMap((s) => s.levels.map((l) => ({ ...l, scene: s, theme: l.theme || s.theme }))), ...DUELS.map((d) => ({ ...d, scene: DUEL_SCENE })), ...PRIMES.map((d) => ({ ...d, scene: PRIME_SCENE })), ...RACES.map((d) => ({ ...d, scene: RACE_SCENE }))];

export const THEMES = {
  cellar: { wallH: 8, corrH: 6, doorH: 5, fog: 0x10140f, fogNear: 8, fogFar: 75, sky: 0x0b0e0b },
  kiln: { wallH: 12, corrH: 8, doorH: 6, fog: 0x2a0e06, fogNear: 14, fogFar: 100, sky: 0x1a0804 },
  cathedral: { wallH: 18, corrH: 10, doorH: 7, fog: 0x1d1210, fogNear: 20, fogFar: 130, sky: 0x150c0a },
  aqueduct: { wallH: 14, corrH: 8, doorH: 6, fog: 0x0e1c22, fogNear: 14, fogFar: 110, sky: 0x08141a },
};

const TYPES = { g: 'grunt', s: 'shooter', h: 'heavy', f: 'flyer', k: 'shield', n: 'sniper', x: 'bomber', p: 'priest', r: 'ram', b: 'burrower', m: 'mender', d: 'diver', y: 'siphon' };
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
export const VARIETY = {
  '0-4': ['bridge'], '1-2': ['mezzanine'], '1-4': ['towers'], '2-1': ['bridge'], '2-3': ['mezzanine'], '2-5': ['towers'],
  '4-2': ['mezzanine'], '4-5': ['bridge'], '5-2': ['towers'], '5-3': ['mezzanine'], '5-5': ['bridge'], '6-1': ['mezzanine'],
  '7-4': ['bridge'], '8-1': ['mezzanine'], '8-4': ['towers'], '9-1': ['mezzanine'],
};
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const CW = 5; // corridor / door width

// ctx: { box(x,y,z,w,h,d,mat,tex,solid), decor(obj), torch(x,y,z,nx,nz), mats, makeWindow(), makeBanner(), candle(x,y,z) }
export function buildLevel(level, ctx) {
  const rng = mulberry(hashStr(level.seed || level.id) ^ 0x9e3779b9);
  const rand = (a, b) => a + rng() * (b - a);
  const T = THEMES[level.theme];
  const M = ctx.mats;
  const wallMat = level.theme === 'cellar' ? M.cobble : level.theme === 'aqueduct' ? (M.ashlar || M.brick) : M.brick;
  const isKiln = level.theme === 'kiln';
  const trimMat = level.theme === 'cellar' ? M.brick : M.cobble;

  const specs = [{ w: 14, d: 14, props: [], waves: [], hint: level.startHint, kind: 'start' }, ...level.rooms.map((r) => ({ ...r, kind: r.boss ? 'boss' : 'arena' }))];
  if (VARIETY[level.id]) {
    const big = specs.filter((x) => x.kind === 'arena').sort((a, b) => b.w * b.d - a.w * a.d)[0];
    if (big) big.props = [...VARIETY[level.id], ...(big.props || [])];
  }
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
  if (!level.duel && !level.race) {
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
    // local wall coords: u = along the wall from room centre, v = inward distance from the wall
    const wallBox = (side, u, v, du, dv, y, h, mat, tex, solid = true) => {
      const [dx, dz] = DIRS[side];
      const horiz = side === 'N' || side === 'S';
      const wx = horiz ? r.cx + u : r.cx + dx * r.w / 2 - dx * v;
      const wz = horiz ? r.cz + dz * r.d / 2 - dz * v : r.cz + u;
      ctx.box(wx, y, wz, horiz ? du : dv, h, horiz ? dv : du, mat, tex, solid);
      return { x: wx, z: wz, w: horiz ? du : dv, d: horiz ? dv : du };
    };
    const wallRectFree = (side, u, v, du, dv) => {
      const [dx, dz] = DIRS[side];
      const horiz = side === 'N' || side === 'S';
      const wx = horiz ? r.cx + u : r.cx + dx * r.w / 2 - dx * v;
      const wz = horiz ? r.cz + dz * r.d / 2 - dz * v : r.cz + u;
      const near = Math.max(1.1, v - dv / 2), far = v + dv / 2;
      const v2 = (near + far) / 2, dv2 = Math.max(0.2, far - near);
      const wx2 = horiz ? wx : r.cx + dx * r.w / 2 - dx * v2;
      const wz2 = horiz ? r.cz + dz * r.d / 2 - dz * v2 : wz;
      return tryRect(wx2, wz2, horiz ? du : dv2, horiz ? dv2 : du);
    };
    for (const p of r.props || []) {
      if (p === 'mezzanine') {
        // a raised walkway along one wall, reached by a staircase of auto-step 0.5 m risers
        const sides = shuffle(['N', 'S', 'E', 'W'].filter((sd) => !doorSides.has(sd)), rng);
        const hy = level.theme === 'cellar' ? 3.5 : 4;
        const steps = Math.round(hy / 0.5), run = 0.8;
        for (const side of sides) {
          const horiz = side === 'N' || side === 'S';
          const wallLen = horiz ? r.w : r.d, across = horiz ? r.d : r.w;
          const dep = Math.min(6, across * 0.28);
          const L = wallLen - 3 - steps * run;
          if (L < 8) continue;
          const sg = rng() < 0.5 ? -1 : 1;
          const u0 = -sg * (steps * run) / 2;
          // deck + stairs as one footprint (they touch, so they can't be checked separately)
          if (!wallRectFree(side, 0, dep / 2 + 0.6, L + steps * run, dep + 1.2)) continue;
          wallBox(side, u0, dep / 2, L, dep, hy - 0.4, 0.4, M.cobble, 3);
          wallBox(side, u0, dep / 2, L, dep, hy, 0.12, M.brick, 4, false);
          const n = Math.max(2, Math.floor(L / 6));
          for (let i = 0; i < n; i++) wallBox(side, u0 + ((i + 0.5) / n - 0.5) * (L - 1), dep - 0.6, 0.8, 0.8, 0, hy - 0.4, M.brick, 4);
          for (const k of [-1, 1]) wallBox(side, u0 + k * L * 0.32, dep - 0.15, L * 0.28, 0.3, hy, 0.9, M.brick, 4);
          for (let i = 0; i < steps; i++) wallBox(side, u0 + sg * (L / 2 + (i + 0.5) * run), 1.4, run, 2.8, 0, hy - i * 0.5, M.cobble, 3);
          break;
        }
        continue;
      }
      if (p === 'bridge') {
        // a raised walkway crossing the room (you can walk underneath), stairs at both ends
        const hy = 3.4, steps = Math.round(hy / 0.5), run = 0.8;
        let alongX, deck, bx, bz, ok = false;
        const sg = rng() < 0.5 ? -1 : 1;
        for (const ax of r.w >= r.d ? [true, false] : [false, true]) {
          const long = ax ? r.w : r.d;
          const dk = long - 2 * steps * run - 8;
          if (dk < 4) continue;
          for (const k of [0.22, -0.22, 0.3, -0.3, 0.14, -0.14, 0]) {
            const off = (ax ? r.d : r.w) * k * sg;
            const x = ax ? r.cx : r.cx + off, z = ax ? r.cz + off : r.cz;
            const total = dk + 2 * steps * run;
            if (tryRect(x, z, ax ? total : 3.4, ax ? 3.4 : total)) { alongX = ax; deck = dk; bx = x; bz = z; ok = true; break; }
          }
          if (ok) break;
        }
        if (!ok) continue;
        ctx.box(bx, hy - 0.4, bz, alongX ? deck : 3, 0.4, alongX ? 3 : deck, M.cobble, 3);
        ctx.box(bx, hy, bz, alongX ? deck : 3, 0.12, alongX ? 3 : deck, M.brick, 4, false);
        for (const k of [-0.5, 0, 0.5]) ctx.box(bx + (alongX ? k * (deck - 1) : 0), 0, bz + (alongX ? 0 : k * (deck - 1)), 0.9, hy - 0.4, 0.9, M.brick, 4);
        for (const sd of [-1, 1]) {
          for (let i = 0; i < steps; i++) {
            const t = sd * (deck / 2 + (i + 0.5) * run);
            ctx.box(bx + (alongX ? t : 0), 0, bz + (alongX ? 0 : t), alongX ? run : 3, hy - i * 0.5, alongX ? 3 : run, M.cobble, 3);
          }
          ctx.box(bx + (alongX ? 0 : sd * 1.35), hy, bz + (alongX ? sd * 1.35 : 0), alongX ? deck * 0.6 : 0.25, 0.7, alongX ? 0.25 : deck * 0.6, M.iron, 1);
        }
        continue;
      }
      if (p === 'towers') {
        // tall brick towers to wall-jump or grapple up, with a climbable stack of blocks
        let made = 0;
        for (let i = 0; i < 14 && made < 2; i++) {
          const { x, z } = ri();
          if (!tryRect(x, z, 6.5, 3.4)) continue;
          const hy = 5.6;
          ctx.box(x, 0, z, 3, hy, 3, M.brick, 4);
          ctx.box(x, hy, z, 3.6, 0.4, 3.6, M.cobble, 3);
          for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.box(x + ox * 1.6, hy + 0.4, z + oz * 1.6, 0.5, 0.6, 0.5, M.cobble, 3);
          ctx.box(x - 2.4, 0, z, 1.8, 1.8, 1.8, M.cobble, 3);
          ctx.box(x - 2.4, 1.8, z + 0.9, 1.8, 1.8, 1.8 / 2 + 0.01, M.cobble, 3);
          ctx.box(x - 2.0, 3.6, z + 1.2, 1.0, 1.4, 1.0, M.cobble, 3);
          ctx.torch(x, 3, z + 1.5, 0, 1);
          made++;
        }
        continue;
      }
      if (p === 'lava') {
        const horiz = rng() < 0.5;
        for (let i = 0; i < 2; i++) {
          const t = (i === 0 ? -0.22 : 0.22) + rand(-0.05, 0.05);
          const x = horiz ? r.cx : r.cx + t * r.w, z = horiz ? r.cz + t * r.d : r.cz;
          ctx.hazard('lava', x, z, horiz ? r.w - 1 : 2.6, horiz ? 2.6 : r.d - 1);
        }
        continue;
      }
      if (p === 'channel') {
        // a strip of fast water that drags anything standing in it
        let made = 0;
        for (let i = 0; i < 8 && made < 2; i++) {
          const horiz = rng() < 0.5;
          const len = (horiz ? r.w : r.d) - 4, off = rand(-0.26, 0.26) * (horiz ? r.d : r.w);
          const x = horiz ? r.cx : r.cx + off, z = horiz ? r.cz + off : r.cz;
          if (!tryRect(x, z, horiz ? len : 3, horiz ? 3 : len)) continue;
          const sgn = rng() < 0.5 ? 1 : -1;
          ctx.hazard('current', x, z, horiz ? len : 3, horiz ? 3 : len, { dir: horiz ? [sgn, 0] : [0, sgn] });
          made++;
        }
        continue;
      }
      if (p === 'sluice') {
        // sluice gates on the walls blast water across the room
        const sides = ['N', 'S', 'E', 'W'].filter((sd) => !r.doors.some((d) => d.side === sd));
        let made = 0;
        for (const sd of sides) {
          if (made >= 2) break;
          const horiz = sd === 'N' || sd === 'S';
          const along = (horiz ? r.cx : r.cz) + rand(-0.2, 0.2) * (horiz ? r.w : r.d);
          const x = horiz ? along : sd === 'E' ? r.x1 - 0.4 : r.x0 + 0.4;
          const z = horiz ? (sd === 'S' ? r.z1 - 0.4 : r.z0 + 0.4) : along;
          const dir = { N: [0, 1], S: [0, -1], E: [-1, 0], W: [1, 0] }[sd];
          ctx.hazard('jet', x, z, horiz ? r.d - 1 : r.w - 1, 2.4, { dir, phase: rng() * 4.5 });
          made++;
        }
        continue;
      }
      if (p === 'flood') {
        ctx.hazard('flood', r.cx, r.cz, r.w - 0.6, r.d - 0.6, { room: r, max: 0.85 });
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
    if (level.theme === 'aqueduct') {
      for (const side of ['N', 'S', 'E', 'W']) {
        const horiz = side === 'N' || side === 'S';
        const len = horiz ? r.w : r.d;
        const n = Math.max(2, Math.floor(len / 7));
        for (let i = 0; i <= n; i++) {
          const along = (horiz ? r.cx : r.cz) + (i / n - 0.5) * (len - 2);
          if (doorSides.has(side) && Math.abs(along - (horiz ? r.cx : r.cz)) < CW) continue;
          const x = horiz ? along : side === 'E' ? r.x1 - 0.55 : r.x0 + 0.55;
          const z = horiz ? (side === 'S' ? r.z1 - 0.55 : r.z0 + 0.55) : along;
          ctx.box(x, 0, z, 1.1, H * 0.72, 1.1, trimMat, 3, false);
          ctx.box(x, H * 0.72, z, horiz ? 2.2 : 1.3, 0.6, horiz ? 1.3 : 2.2, trimMat, 3, false);
        }
        const x = horiz ? r.cx : side === 'E' ? r.x1 - 0.3 : r.x0 + 0.3, z = horiz ? (side === 'S' ? r.z1 - 0.3 : r.z0 + 0.3) : r.cz;
        ctx.box(x, H * 0.72 + 0.6, z, horiz ? len : 0.6, 0.35, horiz ? 0.6 : len, M.water, 1, false);
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
