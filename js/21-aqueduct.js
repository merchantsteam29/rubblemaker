'use strict';
// ================================================================ BATCH 7: ACT IV · THE AQUEDUCT
LOOKS.aqueduct = { fog: 0x0e1c22, near: 14, far: 110, sky: 0x08141a, hemiSky: 0x8ac8d8, hemiGround: 0x1a2a2a, hemiI: 0.95, moon: 0.75 };
REVERBS.aqueduct = [3.0, 0.32];
LAYER_NAMES[7] = 'SLUICE'; LAYER_NAMES[8] = 'ARCHES'; LAYER_NAMES[9] = 'CISTERN';
ACT_NAMES.push('ACT IV');

// ---- water hazards: currents, sluice-gate jets, rising floods
const waterTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#1f5a72'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(160,220,255,${0.12 + Math.random() * 0.18})`; g.fillRect(0, (i * 6.4 + Math.random() * 3) | 0, 64, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const waterHazMat = new THREE.MeshStandardMaterial({ color: 0x5ab0d8, map: waterTex, transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.1, emissive: 0x0a2a3a, emissiveIntensity: 0.6 });
const floodMat = new THREE.MeshStandardMaterial({ color: 0x3a8ab0, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2, emissive: 0x06202a, emissiveIntensity: 0.5, depthWrite: false });
const jetTex = waterTex.clone(); jetTex.needsUpdate = true; jetTex.repeat.set(2, 6);
const jetMat = new THREE.MeshBasicMaterial({ color: 0x9adcff, map: jetTex, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
function waterHazard(kind, x, z, w, d, o) {
  if (kind === 'current') {
    const tex = waterTex.clone(); tex.needsUpdate = true; tex.repeat.set(w / 3, d / 3);
    const mat = waterHazMat.clone(); mat.map = tex;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z);
    levelGroup.add(m);
    for (const s2 of [-1, 1]) {
      if (w > d) box(x, 0, z + s2 * (d / 2 + 0.15), w, 0.14, 0.3, cobbleMat, 3, false);
      else box(x + s2 * (w / 2 + 0.15), 0, z, 0.3, 0.14, d, cobbleMat, 3, false);
    }
    hazards.push({ kind, x, z, w, d, dir: o.dir || [1, 0], tex, mesh: m });
  } else if (kind === 'jet') {
    const [dx, dz] = o.dir || [1, 0];
    const gate = new THREE.Group(); gate.position.set(x, 1.4, z); gate.rotation.y = Math.atan2(dx, dz);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.5), ironDark); gate.add(frame);
    const grate = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1), new THREE.MeshBasicMaterial({ color: 0x0a2030 })); grate.position.z = 0.27; gate.add(grate);
    for (let i = -2; i <= 2; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 0.14), ironMat); bar.position.set(i * 0.4, 0, 0.3); gate.add(bar); }
    levelGroup.add(gate);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 1, 12, 1, true), jetMat);
    beam.rotation.set(Math.PI / 2, 0, 0); beam.visible = false;
    const holder = new THREE.Group(); holder.position.set(x, 1.1, z); holder.rotation.y = Math.atan2(dx, dz); holder.add(beam);
    levelGroup.add(holder);
    hazards.push({ kind, x, z, len: w, width: d, dir: [dx, dz], t: o.phase || 0, grate, beam, hit: false });
  } else if (kind === 'flood') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floodMat); m.rotation.x = -Math.PI / 2; m.position.set(x, -0.2, z); m.visible = false;
    m.renderOrder = 2;
    levelGroup.add(m);
    hazards.push({ kind, x, z, w, d, room: o.room, max: o.max || 0.85, level: -0.2, mesh: m });
  }
}
function inBeam(px, pz, h) {
  const rx = px - h.x, rz = pz - h.z;
  const along = rx * h.dir[0] + rz * h.dir[1], side = Math.abs(rx * h.dir[1] - rz * h.dir[0]);
  return along > 0 && along < h.len && side < h.width / 2;
}
function updateWaterHazards(dt) {
  P.wet = false;
  for (const h of hazards) {
    if (h.kind === 'current') {
      h.tex.offset.x -= h.dir[0] * dt * 0.9; h.tex.offset.y += h.dir[1] * dt * 0.9;
      if (inRect(P.pos.x, P.pos.z, h) && P.pos.y < 0.6 && P.dashT <= 0) {
        moveAxis('x', h.dir[0] * 4.2 * dt); moveAxis('z', h.dir[1] * 4.2 * dt);
        P.wet = true;
        if (Math.random() < 0.3) spawnPart(P.pos.clone().setY(0.15), new V3(h.dir[0] * 3, 1.5, h.dir[1] * 3), 0xbfeaff, 0.06, 0.3, true);
      }
      for (const e of enemies) {
        if (e.dead || e.def.fly || e.def.boss || e.spawnT > 0 || e.buried) continue;
        if (inRect(e.mesh.position.x, e.mesh.position.z, h) && e.mesh.position.y < 0.6) { e.mesh.position.x += h.dir[0] * 3.4 * dt; e.mesh.position.z += h.dir[1] * 3.4 * dt; }
      }
    } else if (h.kind === 'jet') {
      h.t += dt; jetTex.offset.y -= dt * 0.6;
      const ph = h.t % 4.5, warn = ph > 2.6 && ph < 3.6, fire = ph >= 3.6 && ph < 4.4;
      h.grate.material.color.setHex(fire ? 0xbfeaff : warn ? (Math.sin(G.time * 28) > 0 ? 0x3ab0ff : 0x0a3050) : 0x0a2030);
      h.beam.visible = fire;
      if (fire) { const k = Math.min(1, (ph - 3.6) / 0.12); h.beam.scale.set(1 + Math.sin(G.time * 40) * 0.08, h.len * k, 1); h.beam.position.set(0, 0, h.len * k / 2); }
      if (warn && Math.random() < 0.4) spawnPart(new V3(h.x + rand(-1, 1), rand(0.5, 2.4), h.z + rand(-1, 1)), new V3(h.dir[0] * 2, -1, h.dir[1] * 2), 0x8ad8ff, 0.06, 0.4, true);
      if (!fire) { h.hit = false; continue; }
      if (!h.hit) { h.hit = true; sfxAt(new V3(h.x, 1, h.z), 'flame', distVol(new V3(h.x, 1, h.z))); nz(0.8, 1400, 0.5, { type: 'bandpass', q: 0.7, end: 500 }); }
      if (inBeam(P.pos.x, P.pos.z, h) && P.pos.y < 3 && P.dashT <= 0) {
        P.vel.x = h.dir[0] * 14; P.vel.z = h.dir[1] * 14; P.vel.y = Math.max(P.vel.y, 4); P.grounded = false;
        if (G.time > (P.jetT || 0)) { P.jetT = G.time + 0.8; hurtPlayer(6, null, true); }
      }
      for (const e of enemies) {
        if (e.dead || e.spawnT > 0 || e.def.boss || e.buried) continue;
        const ep = e.mesh.position;
        if (inBeam(ep.x, ep.z, h) && ep.y < 3 && G.time > (e.jetT || 0)) {
          e.jetT = G.time + 0.8;
          e.vel.x += h.dir[0] * 16 / Math.sqrt(e.def.mass); e.vel.z += h.dir[1] * 16 / Math.sqrt(e.def.mass); e.vel.y = 5; e.grounded = false;
          if (e.elite === 'ember') { e.doused = true; }
          if (damageEnemy(e, 25, { weapon: null })) addStyle(70, 'WASHED OUT', null, 'cool');
        }
      }
    } else if (h.kind === 'flood') {
      const st = h.room && h.room.state;
      const target = st === 'active' || (h.boss && G.boss) ? h.max : -0.2;
      h.level += Math.sign(target - h.level) * Math.min(Math.abs(target - h.level), dt * (target > h.level ? 0.11 : 0.4));
      h.mesh.visible = h.level > -0.15;
      h.mesh.position.y = h.level;
      if (h.level > 0.25 && inRect(P.pos.x, P.pos.z, h) && P.pos.y < h.level - 0.05) {
        P.wet = true;
        if (Math.random() < 0.15 && Math.hypot(P.vel.x, P.vel.z) > 2) spawnPart(P.pos.clone().setY(h.level), new V3(rand(-1, 1), 2, rand(-1, 1)), 0xbfeaff, 0.06, 0.3, true);
      }
      if (h.level > 0.25) for (const e of enemies) if (e.elite === 'ember' && !e.doused && inRect(e.mesh.position.x, e.mesh.position.z, h)) { e.doused = true; burst(e.mesh.position.clone().setY(h.level + 0.5), 10, 0xdddddd, 4, 0.15, 0.8); }
    }
  }
}

// ---- new enemies
Object.assign(DEFS, {
  diver: { hp: 70, speed: 7.2, r: 0.5, h: 2.1, color: 0x2a5a6a, mass: 1, kill: 90, label: 'KILL', ai: 'burrower', custom: true, animAs: 'grunt' },
  siphon: { hp: 120, speed: 3.4, r: 0.6, h: 2.5, color: 0x4a6a7a, mass: 1.6, kill: 110, label: 'DRAINED', ai: 'siphon', custom: true, animAs: 'shooter' },
  buoy: { hp: 620, speed: 2.8, r: 1.4, h: 4.2, color: 0xc83a2a, mass: 50, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, custom: true, animAs: 'heavy', name: 'THE BUOY · TRAINER', short: 'THE BUOY', hint: 'Bullets bounce off THE BUOY · wind the FLAIL up fully and SWING to sink him', canHurt: (i) => (i.weapon === 'flail' && (i.charge || 0) >= 0.6) || !owns('flail') },
  lockkeeper: { hp: 700, speed: 2.6, r: 1.4, h: 4.4, color: 0x3a4a44, mass: 60, kill: 300, label: 'TRAINER DOWN', boss: true, trainer: true, custom: true, animAs: 'heavy', name: 'THE LOCK-KEEPER · TRAINER', short: 'THE LOCK-KEEPER', hint: 'THE LOCK-KEEPER is bolted to the floor · only the TIDE arm moves him: tap for a WAVE, hold for the UNDERTOW', canHurt: (i) => i.weapon === 'tide' || !owns('arm_tide') },
  dredger: { hp: 2600, speed: 3.4, r: 1.6, h: 4.8, color: 0x4a5a40, mass: 60, kill: 500, label: 'MINI-BOSS DOWN', boss: true, mini: true, animAs: 'heavy', award: 'arm_tide', name: 'THE DREDGER · MINI-BOSS', short: 'THE DREDGER', hint: 'He hurls buckets of silt and sends up geysers · the TOLL waves are tall, DASH through' },
  siren: { hp: 2500, speed: 6.5, r: 0.8, h: 4.0, color: 0x3a8aa8, mass: 40, kill: 500, label: 'MINI-BOSS DOWN', boss: true, mini: true, animAs: 'grunt', award: 'skin:tidal', name: 'THE SIREN · MINI-BOSS', short: 'THE SIREN', hint: 'Her song PULLS you in · dash out of it, and watch for geysers' },
  guildmaster: { hp: 6200, speed: 4.4, r: 2.0, h: 7.4, color: 0x5a4a7a, mass: 80, kill: 1500, label: 'BOSS KILL', boss: true, mini: true, finalBoss: true, animAs: 'shooter', name: 'THE GUILDMASTER', short: 'THE GUILDMASTER', hint: 'He floods the hall at half health · PARRY his seal-orbs, DASH his waves, kill his apprentices fast' },
});
Object.assign(EPITHETS, {
  buoy: ['TRAINER', 'LESSON XII · THE WRECKING BALL'],
  lockkeeper: ['TRAINER', 'LESSON XIII · THE TIDE'],
  dredger: ['MINI-BOSS · LAYER 7', 'SCOURER OF THE SLUICE'],
  siren: ['MINI-BOSS · LAYER 8', 'THE VOICE UNDER THE ARCHES'],
  guildmaster: ['ACT IV BOSS', 'HE WHO LAID THE FIRST BRICK'],
});
Object.assign(VOICES, {
  diver: [100, 480, 980, 0.4, 0.3], siphon: [78, 300, 640, 0.6, 0.45], buoy: [66, 380, 720, 0.5, 0.5], lockkeeper: [58, 340, 700, 0.8, 0.55],
  dredger: [48, 320, 640, 0.9, 0.7], siren: [480, 1100, 2900, 0, 0.6, 'triangle'], guildmaster: [56, 380, 780, 0.4, 0.9, 'square'],
});
Object.assign(ENEMY_INTRO, {
  diver: 'DIVER · swims under the floor and surfaces under you. GROUND SLAM to drag it out',
  siphon: 'SIPHON · sucks you toward it, then sprays water. Kill it before it finishes, or DASH out of the pull',
});
TRAINERS.push('buoy', 'lockkeeper');
MINIS.push('dredger', 'siren');
PIT_BOSS_POOL.push('dredger', 'siren', 'buoy');
SEND_POOL.push(['grunt', 'shooter', 'diver', 'flyer', 'siphon']);
CODEX_BEASTS.splice(CODEX_BEASTS.findIndex((x) => x[2] === 'ELITE'), 0,
  ['diver', 'DIVER', 'ENEMY', 'Aqueduct workers who never came up for air. They swim under the flagstones and burst out beneath your feet. A GROUND SLAM drags them up.'],
  ['siphon', 'SIPHON', 'ENEMY', 'A walking pump. It drinks the air around it, and you with it, then sprays the lot back at you. Kill it mid-breath for a DRAINED.'],
);
CODEX_BEASTS.splice(CODEX_BEASTS.findIndex((x) => x[2] === 'DUELIST'), 0,
  ['buoy', 'THE BUOY', 'TRAINER', 'LESSON XII · THE WRECKING BALL. A cork-and-iron float the size of a cart. Only a fully wound FLAIL swing sinks him.'],
  ['lockkeeper', 'THE LOCK-KEEPER', 'TRAINER', 'LESSON XIII · THE TIDE. He is bolted to his lock gate. Only the TIDE arm, wave or undertow, can shift him.'],
);
CODEX_BEASTS.splice(CODEX_BEASTS.findIndex((x) => x[2] === 'BOSS'), 0,
  ['dredger', 'THE DREDGER', 'MINIBOSS', 'He scrapes the sluice clean of silt, bones and whatever else falls in. Beat him at the end of the SLUICE for the TIDE arm.'],
  ['siren', 'THE SIREN', 'MINIBOSS', 'Her song carries down the arches and pulls swimmers under. Beat her at the end of the ARCHES for the TIDAL gun skin.'],
);
CODEX_BEASTS.push(['guildmaster', 'THE GUILDMASTER', 'BOSS', 'MASTER OF THE GUILD. The voice that built you and sent you down. He let you clear away every rival so the city would have only one builder left: him.']);
for (const k of ['buoy', 'lockkeeper']) if (!DEFS[k].hp) DEFS[k].hp = 600;

// models for the new cast (built on the regular rigs)
const _bmm = buildMiniModel;
buildMiniModel = function (type) {
  const extra = { diver: 'grunt', siphon: 'shooter', buoy: 'heavy', lockkeeper: 'heavy', dredger: 'heavy', siren: 'grunt', guildmaster: 'shooter' }[type];
  if (!extra) return _bmm(type);
  const def = DEFS[type];
  const md = buildEnemyModel(extra, def.color);
  const r = md.rig;
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4, ...o });
  const glow = (color) => new THREE.MeshBasicMaterial({ color });
  const add = (geo, mat, parent, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; (parent || md.root).add(m); return m; };
  const brass = std(0xc8a040, { metalness: 0.85, roughness: 0.3 }), iron = std(0x3a3a40, { metalness: 0.8 });
  if (type === 'diver') {
    add(new THREE.SphereGeometry(0.34, 12, 9), brass, r.head, 0, 0.12, 0);
    add(new THREE.CircleGeometry(0.16, 12), glow(0x6ad8ff), r.head, 0, 0.14, 0.33);
    add(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), iron, r.torso, 0, 0.5, -0.3);
  } else if (type === 'siphon') {
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), brass, r.torso, 0, 0.55, -0.35);
    add(new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass, r.torso, 0, 1.0, -0.35);
    add(new THREE.CylinderGeometry(0.08, 0.18, 0.7, 8), iron, r.head, 0, 0, 0.45, Math.PI / 2);
    add(new THREE.TorusGeometry(0.18, 0.04, 6, 12), glow(0x6ad8ff), r.head, 0, 0, 0.8);
    md.root.scale.setScalar(1.15);
  } else if (type === 'buoy') {
    for (let i = 0; i < 4; i++) add(new THREE.TorusGeometry(0.75, 0.22, 8, 16), std(i % 2 ? 0xe8e0d0 : 0xc83a2a, { roughness: 0.7, metalness: 0.1 }), r.torso, 0, 0.3 + i * 0.001, 0, Math.PI / 2, 0, i * Math.PI / 2);
    add(new THREE.ConeGeometry(0.3, 0.7, 8), std(0xffd04a, { emissive: 0xffa020, emissiveIntensity: 0.8 }), r.head, 0, 0.55, 0);
    md.root.scale.setScalar(1.4);
  } else if (type === 'lockkeeper') {
    const key = new THREE.Group(); key.position.set(0, 0.6, -0.4); r.torso.add(key);
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), brass, key, 0, 0, 0);
    add(new THREE.TorusGeometry(0.28, 0.07, 6, 14), brass, key, 0, 0.9, 0);
    add(new THREE.BoxGeometry(0.4, 0.12, 0.08), brass, key, 0.18, -0.7, 0);
    const gate = new THREE.Group(); gate.position.set(0, -0.6, 0.35); r.elL.add(gate);
    for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.08, 1.4, 0.08), iron, gate, i * 0.22, 0, 0);
    for (const y of [-0.5, 0.5]) add(new THREE.BoxGeometry(1.0, 0.1, 0.1), iron, gate, 0, y, 0);
    md.root.scale.setScalar(1.5);
  } else if (type === 'dredger') {
    const bucket = new THREE.Group(); bucket.position.set(0, -0.9, 0.3); r.elR.add(bucket);
    add(new THREE.BoxGeometry(0.9, 0.6, 0.8), iron, bucket, 0, 0, 0);
    for (let i = -1; i <= 1; i++) add(new THREE.ConeGeometry(0.1, 0.3, 4), iron, bucket, i * 0.3, -0.4, 0.3, Math.PI, 0, 0);
    add(new THREE.BoxGeometry(0.8, 0.15, 0.7), std(0x4a3a20, { roughness: 1 }), bucket, 0, 0.3, 0);
    add(new THREE.SphereGeometry(0.42, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(0x5a6a4a, { roughness: 0.9 }), r.head, 0, 0.18, 0);
    md.root.scale.setScalar(1.5);
  } else if (type === 'siren') {
    const fin = std(0x6ad8ff, { emissive: 0x1a6a8a, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.07, 0.5 + i * 0.08, 4), fin, r.head, (i - 2) * 0.09, 0.4, -0.12, -0.3, 0, (i - 2) * 0.2);
    add(new THREE.SphereGeometry(0.2, 12, 9), glow(0xe8fbff), r.elR, 0, -0.75, 0.1);
    for (const sd of [-1, 1]) add(new THREE.ConeGeometry(0.12, 0.6, 4), fin, r.torso, sd * 0.38, 0.4, -0.15, 0, 0, sd * 0.9);
    md.root.scale.setScalar(1.6);
  } else if (type === 'guildmaster') {
    const robe = std(0x3a2a4a, { roughness: 0.9, metalness: 0 }), gold = std(0xd8b040, { metalness: 0.9, roughness: 0.25 }), g = glow(0x8ae8ff);
    add(new THREE.ConeGeometry(0.9, 1.6, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2a4a, roughness: 0.9, side: THREE.DoubleSide }), r.torso, 0, -0.35, 0);
    add(new THREE.CylinderGeometry(0.22, 0.32, 0.6, 8), gold, r.head, 0, 0.45, 0);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(new THREE.ConeGeometry(0.05, 0.22, 4), gold, r.head, Math.sin(a) * 0.25, 0.85, Math.cos(a) * 0.25); }
    const ham = new THREE.Group(); ham.position.set(0, -0.8, 0.1); r.elR.add(ham);
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), std(0x5a3a22), ham, 0, -0.3, 0);
    add(new THREE.BoxGeometry(0.9, 0.42, 0.42), gold, ham, 0, -1.1, 0);
    add(new THREE.BoxGeometry(0.94, 0.06, 0.46), g, ham, 0, -1.1, 0);
    const comp = new THREE.Group(); comp.position.set(0, 0.8, -0.45); r.torso.add(comp);
    add(new THREE.TorusGeometry(0.7, 0.05, 6, 24, Math.PI * 1.4), g, comp, 0, 0, 0, 0, 0, -Math.PI * 0.2);
    for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.07, 1.3, 0.07), gold, comp, sd * 0.25, -0.2, 0, 0, 0, sd * 0.35);
    add(new THREE.OctahedronGeometry(0.16), g, comp, 0, 0.35, 0);
    md.root.scale.setScalar(2.3);
    r.compass = comp;
    void robe;
  }
  return md;
};

// ---- SIPHON AI: walk in, suck the player toward it, then spray
function updateSiphon(e, dt) {
  const p = e.mesh.position, def = e.def;
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0;
  e.mesh.rotation.y = Math.atan2(dx, dz);
  if (e.state === 'chase') {
    const want = dist > 11 ? 1 : dist < 7 ? -0.5 : 0;
    mx = nx * def.speed * want; mz = nz * def.speed * want;
    if (e.cd <= 0 && dist < 17 && lineOfSight(p.clone().setY(p.y + 1.6), playerEye())) { e.state = 'suck'; e.t = 1.9; sfxAt(p, 'windup', distVol(p)); }
  } else if (e.state === 'suck') {
    w = 0.6 + Math.sin(G.time * 30) * 0.2;
    if (P.dashT <= 0 && G.state === 'play') { moveAxis('x', -nx * 6 * dt); moveAxis('z', -nz * 6 * dt); }
    if (Math.random() < 0.7) { const q = P.pos.clone().setY(P.pos.y + 1).lerp(p.clone().setY(p.y + 1.6), Math.random()); spawnPart(q, new V3(-nx * 6, 0, -nz * 6), 0xbfeaff, 0.06, 0.25, true, 0); }
    if (dist < 2.4) { hurtPlayer(14, new V3(nx * 14, 6, nz * 14)); e.state = 'recover'; e.t = 1.2; sfxAt(p, 'punch'); }
    else if (e.t <= 0) { fanOrbs(e, 5, 0.14, 17, 9, 0x8ad8ff); e.state = 'recover'; e.t = 1.1; }
  } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(3.5, 5) * DIFF().fire; }
  enemyPhysics(e, mx, mz, dt);
  const moving = Math.hypot(mx, mz) > 0.5;
  if (moving) e.walk += dt * 4;
  animateEnemy(e, dt, moving, w, G.time);
  applyFlash(e, w);
}

// ---- mini-boss + final boss attack sets (shared mini-boss AI)
Object.assign(MINI_ATK, {
  dredger: { near: ['toll', 'charge'], far: ['bells', 'geyser', 'charge'], range: [6, 13] },
  siren: { near: ['blink', 'pull'], far: ['shards', 'pull', 'geyser'], range: [8, 15] },
  guildmaster: { near: ['smash', 'toll', 'blink'], far: ['volley', 'summon', 'bells', 'hymn'], range: [8, 18] },
});
Object.assign(MINI_WIND, { geyser: 0.6, pull: 0.5, summon: 0.8 });
const _miniAttack = miniAttack;
miniAttack = function (e, atk, dist, nx, nz, rage) {
  const p = e.mesh.position;
  if (atk === 'geyser') {
    e.rain = e.rain || [];
    const n = rage ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const x = P.pos.x + (i === 0 ? P.vel.x * 0.4 : rand(-5, 5)), z = P.pos.z + (i === 0 ? P.vel.z * 0.4 : rand(-5, 5));
      e.rain.push({ x, z, t: 0.85 + i * 0.1, geyser: true });
      ringFx(new V3(x, floorAt(x, z, 3) + 0.06, z), 1.8, 0x6ad8ff);
    }
    sfx.windup(0.8);
    return;
  }
  if (atk === 'pull') {
    e.state = 'pull'; e.t = rage ? 2.2 : 1.7;
    sfx.screech(0.7); tn(520, 760, 1.6, 0.25, 'triangle'); tn(780, 1040, 1.6, 0.15, 'sine');
    return;
  }
  if (atk === 'summon') {
    const types = e.type === 'guildmaster' ? (e.hp < e.maxHp * 0.3 ? ['shield', 'diver', 'siphon'] : ['grunt', 'diver', 'grunt']) : ['grunt', 'grunt'];
    for (const t of types) {
      const a = rand(0, Math.PI * 2), x = p.x + Math.cos(a) * 4, z = p.z + Math.sin(a) * 4;
      if (overlapBox(x - 0.7, 0.1, z - 0.7, x + 0.7, 2.4, z + 0.7)) continue;
      const m = makeEnemy(t, x, z);
      if (e.hp < e.maxHp * 0.3) makeElite(m, Math.random() < 0.5 ? 'iron' : 'ember');
    }
    banner('APPRENTICES!'); sfx.bossRoar();
    return;
  }
  return _miniAttack(e, atk, dist, nx, nz, rage);
};
// geysers launch you, pull drags you in, the Guildmaster has phases
const _umb = updateMiniBoss;
updateMiniBoss = function (e, dt) {
  if (e.rain) for (const q of e.rain) if (q.geyser && q.t - dt <= 0 && !q.done) {
    q.done = true; q.t = -1;
    burst(new V3(q.x, 0.5, q.z), 22, 0xbfeaff, 12, 0.12, 0.8, true);
    nz(0.6, 900, 0.5, { type: 'bandpass', q: 0.8, end: 300 });
    if (Math.hypot(P.pos.x - q.x, P.pos.z - q.z) < 1.9 && P.pos.y < 3) { hurtPlayer(16, null); P.vel.y = 15; P.grounded = false; }
  }
  if (e.rain) e.rain = e.rain.filter((q) => !q.done);
  if (e.state === 'pull') {
    const p = e.mesh.position, dx = P.pos.x - p.x, dz = P.pos.z - p.z, d = Math.hypot(dx, dz) || 1;
    e.t -= dt;
    if (P.dashT <= 0) { moveAxis('x', -dx / d * 7.5 * dt); moveAxis('z', -dz / d * 7.5 * dt); }
    if (Math.random() < 0.6) spawnPart(P.pos.clone().setY(P.pos.y + 1).lerp(p.clone().setY(p.y + 2.5), Math.random()), new V3(), 0xbfeaff, 0.07, 0.3, true, 0);
    if (d < e.def.r + 2) { hurtPlayer(18, new V3(dx / d * 14, 7, dz / d * 14)); e.state = 'recover'; e.t = 1; }
    else if (e.t <= 0) { e.state = 'recover'; e.t = 0.6; fanOrbs(e, 5, 0.16, 18, 10, 0x8ad8ff); }
    animateEnemy(e, dt, false, 0.5, G.time); applyFlash(e, 0.5);
    return;
  }
  if (e.type === 'guildmaster') guildPhases(e, dt);
  _umb(e, dt);
  // phase 3: he chains attacks back to back
  if (e.type === 'guildmaster' && e.phase >= 3 && e.state === 'recover' && e.t > 0.5) e.t = 0.5;
};
const GUILD_BASE = { near: MINI_ATK.guildmaster.near.slice(), far: MINI_ATK.guildmaster.far.slice() };
function guildPhases(e, dt) {
  const f = e.hp / e.maxHp;
  if (!e.phase) { e.phase = 1; MINI_ATK.guildmaster.near = GUILD_BASE.near.slice(); MINI_ATK.guildmaster.far = GUILD_BASE.far.slice(); }
  if (e.rig.compass) e.rig.compass.rotation.z += dt * (e.phase >= 3 ? 3 : 1);
  if (e.phase === 1 && f < 0.6) {
    e.phase = 2;
    banner('THE CISTERN RISES'); sfx.bossRoar(); G.shake = 0.8;
    const room = G.layout && G.layout.rooms.find((r) => r.boss === 'guildmaster');
    if (room) { waterHazard('flood', room.cx, room.cz, room.w - 0.6, room.d - 0.6, { room, max: 0.6 }); hazards[hazards.length - 1].boss = true; }
    MINI_ATK.guildmaster.far.push('geyser'); MINI_ATK.guildmaster.near.push('geyser');
    sayLine('THE GUILDMASTER', 'You were built to obey the water, golem. Kneel in it.');
  } else if (e.phase === 2 && f < 0.3) {
    e.phase = 3;
    banner('THE FIRST BRICK'); sfx.bossRoar(); G.shake = 1; fxFlash(0x8ae8ff, 0.4);
    MINI_ATK.guildmaster.far.push('summon', 'pull'); MINI_ATK.guildmaster.near.push('chord');
    sayLine('THE GUILDMASTER', 'I laid the first brick of this city. I will lay the last one on you.');
  }
}

// ---- TIDE arm: tap = WAVE (push + parry + douse), hold = UNDERTOW (pull), release after a hold = RIPTIDE
ARM_NAMES.tide = 'TIDE';
fresh.tide = 1; CHAIN_W.add('tide');
{
  const fist = VM.arms.fist;
  const t = fist.clone(true);
  t.userData.rest = fist.userData.rest.clone(); t.userData.hit = fist.userData.hit.clone();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 6, 16), new THREE.MeshBasicMaterial({ color: 0x6ad8ff }));
  ring.position.set(0, 0, 0.12); t.add(ring);
  const orbM = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.8 }));
  orbM.position.set(0, 0.02, -0.12); t.add(orbM);
  t.visible = false;
  VM.arms.tide = t; vmScene.add(t);
}
Object.assign(sfx, {
  splash(k) { nz(0.5, 1800, 0.7 + k * 0.4, { type: 'bandpass', q: 0.7, end: 400 }); nz(0.25, 5000, 0.3, { type: 'highpass' }); tn(180, 60, 0.3, 0.4); },
  undertow() { nz(0.3, 500, 0.25, { type: 'bandpass', q: 2, end: 260, a: 0.1 }); },
});
function tideArm(dt) {
  if (down('punch') && W.punchCD <= 0) {
    W.tideCharge = Math.min(1, (W.tideCharge || 0) + dt / 0.6);
    if (W.tideCharge > 0.3) undertow(dt);
  } else if (W.tideCharge > 0) {
    const c = W.tideCharge; W.tideCharge = 0;
    tideWave(c);
  }
}
function undertow(dt) {
  const { origin, dir } = aim();
  W.utT = (W.utT || 0) - dt;
  if (W.utT <= 0) { W.utT = 0.3; sfx.undertow(); }
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0 || e.buried) continue;
    const c = e.mesh.position.clone(); c.y += Math.min(e.def.h * 0.5, 1.4);
    const to = c.clone().sub(origin), d = to.length();
    if (d > 18 || to.normalize().dot(dir) < 0.8) continue;
    if (e.def.boss && e.type !== 'lockkeeper') continue;
    const k = e.type === 'lockkeeper' ? 1.2 : 9 / Math.max(0.7, Math.sqrt(e.def.mass));
    e.vel.x -= to.x * k * dt * 6; e.vel.z -= to.z * k * dt * 6;
    e.tideT = G.time;
    if (e.type === 'lockkeeper' && G.time > (e.utHit || 0)) { e.utHit = G.time + 0.4; damageEnemy(e, 22, { weapon: 'tide', point: c }); }
    if (Math.random() < 0.3) spawnPart(c, to.clone().multiplyScalar(-6), 0xbfeaff, 0.06, 0.3, true, 0);
  }
}
function tideWave(c) {
  W.punchCD = 0.6; W.punchT = 0.26;
  const riptide = c > 0.3;
  const { origin, dir } = aim();
  const range = riptide ? 6 + c * 4 : 7.5, dmg = riptide ? 20 + c * 35 : 18;
  blastFx(origin.clone().addScaledVector(dir, 2), riptide ? 2.4 : 1.8, 0x6ad8ff);
  for (let i = 0; i < 26; i++) { const v = dir.clone().add(new V3(rand(-0.4, 0.4), rand(-0.2, 0.3), rand(-0.4, 0.4))).normalize().multiplyScalar(rand(10, 18)); spawnPart(origin.clone().addScaledVector(dir, 1), v, 0xbfeaff, 0.08, 0.5, true, 0.6); }
  sfx.splash(riptide ? c : 0.3);
  breakSecretsInFront(range * 0.6);
  for (const o of orbs) {
    if (o.parried) continue;
    const to = o.m.position.clone().sub(origin);
    if (to.length() < range && to.normalize().dot(dir) > 0.3) {
      o.parried = true; o.dmg = o.big ? 170 : 90; o.life = 4; o.vel.copy(dir).multiplyScalar(40);
      o.m.material.color.set(0xbfeaff); addStyle(80, 'TIDE PARRY', 'tide', 'big'); heal(15);
    }
  }
  let n = 0;
  for (const e of enemies.slice()) {
    if (e.dead || e.spawnT > 0 || e.buried) continue;
    const ctr = e.mesh.position.clone(); ctr.y += Math.min(e.def.h * 0.5, 1.4);
    const to = ctr.clone().sub(origin);
    if (to.length() - e.def.r > range || to.normalize().dot(dir) < 0.45) continue;
    if (e.elite === 'ember' && !e.doused) { e.doused = true; addStyle(40, 'DOUSED', 'tide', 'cool'); }
    const knock = dir.clone().multiplyScalar((riptide ? 10 : 16) / Math.max(0.7, Math.sqrt(e.def.mass))).setY(riptide ? 9 : 4);
    damageEnemy(e, dmg, { weapon: 'tide', point: ctr, knock: e.def.boss && e.type !== 'lockkeeper' ? null : knock });
    n++;
  }
  if (n) { useWeapon('tide'); hitmarker(false); if (riptide && n >= 2) addStyle(40 * n, 'RIPTIDE', 'tide', 'cool'); else if (n >= 3) addStyle(30 * n, 'WASHOUT', 'tide', 'cool'); }
}

// ---- rewards: the arm and the skin
Object.assign(SKINS, {
  tidal: { name: 'TIDAL', steel: 0x6ac8d8, dsteel: 0x1a4a5a, brass: 0xe8fbff, em: 0x0a3a4a },
  verdigris: { name: 'VERDIGRIS', steel: 0x5aa890, dsteel: 0x2a4a3a, brass: 0xc8a050, em: 0x0a2a1a },
});
SKIN_AT['7-4'] = 'verdigris';
Object.assign(LORE, {
  '7-2': 'SLUICE LOG · Gate 1 jammed again. Something in the intake keeps holding it shut. It has hands.',
  '8-2': "The arches were the guild's proudest work. The Guildmaster laid the keystone himself, and he never let anyone forget it.",
  '9-1': "We built the golem to his drawings. He said it would free us. He never said from what. · the last mason",
});
const _miniReward = miniReward;
miniReward = function (e) {
  // when the Guildmaster falls, his apprentices crumble with him (so the portal can open)
  if (e.def.finalBoss) setTimeout(() => { for (const o of enemies.slice()) if (!o.dead && o !== e) { o.spawnT = 0; o.buried = false; damageEnemy(o, 1e6, { weapon: null, explosion: true, combo: true, parry: true }); } }, 600);
  const aw = e.def.award;
  if (!aw || !(aw.startsWith('arm_') || aw.startsWith('skin:'))) return _miniReward(e);
  if (G.mode !== 'campaign' || !G.level || G.level.prime || G.level.race || G.level.duel || (VS && VS.active)) return;
  const id = aw.startsWith('skin:') ? 'skin_' + aw.slice(5) : aw;
  if (!awardItem(id)) return;
  setTimeout(() => {
    const el = $('achToast');
    if (aw.startsWith('arm_')) {
      el.innerHTML = `<small>NEW ARM</small><b>TIDE</b><span>dropped by ${e.def.short} · press ${actLabel('arm')} to switch arms</span>`;
      if (G.state === 'play') { W.arm = 'tide'; updateArmSlot(); showHint(`TIDE ARM · tap ${actLabel('punch')} for a WAVE that pushes, parries and douses · HOLD to drag enemies in, release for a RIPTIDE`); }
    } else {
      el.innerHTML = `<small>NEW GUN SKIN</small><b>${SKINS[aw.slice(5)].name}</b><span>dropped by ${e.def.short} · equip it at the FORGE</span>`;
    }
    el.classList.add('show'); sfx.buy();
    setTimeout(() => el.classList.remove('show'), 4200);
  }, 1400);
};

// ---- story: the twist after the Foreman, the Aqueduct intro, the Guildmaster, the real ending
Object.assign(STORY, {
  twist: { title: 'THE GUILD', card: 'TO BE CONTINUED', sub: 'ACT IV · THE AQUEDUCT is open', lines: [
    ['THE GUILD', 'The kiln is cold. The Foreman is slag. Good.'],
    ['THE GUILD', 'Mortimer. The High Mason. The Foreman. Every rival to the guild, rubble. Exactly as I drew it.'],
    ['THE GUILDMASTER', 'Did you think the guild was dead, golem? I AM the guild. I always was.'],
    ['THE GUILDMASTER', 'Now climb the AQUEDUCT. I have one last wall to set you into.'],
  ] },
  scene3: { title: 'ACT IV', card: 'ACT IV · THE AQUEDUCT', lines: [
    ['THE GUILDMASTER', 'The water runs from my cistern to every house in the city. Whoever holds the water holds the city.'],
    ['THE GUILDMASTER', 'Turn back, and I will let you crumble somewhere quiet.'],
    ['THE GUILDMASTER', 'Come up, and I will take you apart brick by brick.'],
  ] },
  guildmaster: { title: 'THE GUILDMASTER', lines: [
    ['THE GUILDMASTER', 'I laid the first brick of this city. I laid the first brick of YOU.'],
    ['THE GUILDMASTER', 'A builder does not fear his own wall.'],
  ] },
  finale: { title: 'EPILOGUE', card: 'THANK YOU FOR PLAYING', sub: 'PRIME rematches, duels, races and the RUBBLE PIT still wait for you', lines: [
    ['THE MASONS', 'The cistern is broken. The water runs free through every street.'],
    ['THE MASONS', 'He used our name to bind you. Now it is yours.'],
    ['THE MASONS', 'No foreman. No master. Just rubble, and whatever you choose to build from it.'],
  ] },
});
STORY_AT['7-1'] = 'scene3';
function playStoryEnd(id, done) {
  const L = G.layout, st = STORY[id];
  const r = L.rooms.find((x) => x.boss) || L.rooms[0];
  const c = new V3(r.cx, 0, r.cz);
  const lines = st.lines;
  const shots = [
    { orbit: c, r: r.w * 0.45, y: 9, lookY: 0.5, a0: 0, a1: 1.2, line: lines[0] },
    { from: c.clone().add(new V3(-r.w * 0.4, 2.5, r.d * 0.4)), to: c.clone().add(new V3(r.w * 0.3, 4, r.d * 0.3)), look: c.clone().setY(1), line: lines[1] },
    { orbit: c, r: r.w * 0.3, y: 14, lookY: 0, a0: 2, a1: 2.8, line: lines[2] },
  ];
  if (lines[3]) shots.push({ orbit: c, r: r.w * 0.25, y: 6, lookY: 3, a0: 2.8, a1: 3.4, line: lines[3] });
  shots.push({ orbit: c, r: r.w * 0.3, y: 20, lookY: 0, a0: 3.2, a1: 3.6, card: st.card, sub: st.sub, dur: 4.5, hold: 1 });
  playCutscene(id, shots, done);
}
ACHS.splice(ACHS.findIndex((a) => a.id === 's2') + 1, 0, { id: 's3', name: 'AQUEDUCT CLEARED', desc: 'Beat ACT IV: THE AQUEDUCT', p: () => [beaten('9-2') ? 1 : 0, 1], scrap: 800 });
