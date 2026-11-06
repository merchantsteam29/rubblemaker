'use strict';
// ================================================================ BATCH 3: KILN HAZARDS
const hazards = [];
function lavaTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b8300a'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 128, y = Math.random() * 128, r = 4 + Math.random() * 16;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const hot = Math.random() < 0.5;
    gr.addColorStop(0, hot ? 'rgba(255,220,90,.95)' : 'rgba(40,8,2,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) { g.save(); g.translate(ox, oy); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function stripeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1612'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#e8b020';
  for (let i = -64; i < 64; i += 16) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 8, 64); g.lineTo(i + 72, 0); g.lineTo(i + 64, 0); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const LAVA_TEX = lavaTexture();
const lavaMat = new THREE.MeshBasicMaterial({ map: LAVA_TEX });
const stripeMat = new THREE.MeshBasicMaterial({ map: stripeTexture() });
const flameColMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const flameGeo = new THREE.ConeGeometry(0.75, 4.2, 10, 1, true);
flameGeo.translate(0, 2.1, 0);
flameGeo.userData.shared = true;
function lavaPlane(x, z, w, d, y = 0.04) {
  const geo = new THREE.PlaneGeometry(w, d);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * d / 3);
  const m = new THREE.Mesh(geo, lavaMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  levelGroup.add(m);
  return m;
}
function hazard(kind, x, z, w, d, o = {}) {
  if (kind === 'current' || kind === 'jet' || kind === 'flood') { waterHazard(kind, x, z, w, d, o); return; }
  if (kind === 'lava') {
    const mesh = lavaPlane(x, z, w, d);
    for (const s2 of [-1, 1]) {
      if (w > d) box(x, 0, z + s2 * (d / 2 + 0.15), w, 0.12, 0.3, cobbleMat, 3, false);
      else box(x + s2 * (w / 2 + 0.15), 0, z, 0.3, 0.12, d, cobbleMat, 3, false);
    }
    torches.push({ pos: new V3(x, 0.8, z), flame: new THREE.Object3D(), ph: 0, small: true });
    hazards.push({ kind, x, z, w, d, mesh, dmg: 10, bounce: 12 });
  } else if (kind === 'vent') {
    box(x, 0, z, w, 0.1, d, ironMat, 1, false);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, d * 0.8), new THREE.MeshBasicMaterial({ color: 0x331008 }));
    plate.rotation.x = -Math.PI / 2; plate.position.set(x, 0.11, z);
    levelGroup.add(plate);
    for (let i = -2; i <= 2; i++) box(x + i * w * 0.18, 0.1, z, 0.06, 0.04, d * 0.85, ironDark, 1, false);
    const flame = new THREE.Mesh(flameGeo, flameColMat);
    flame.position.set(x, 0.1, z); flame.visible = false;
    levelGroup.add(flame);
    hazards.push({ kind, x, z, r: 1.1, t: o.phase || 0, plate, flame, hit: false });
  } else if (kind === 'crusher') {
    const top = o.top || 8;
    const base = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, d + 0.6), stripeMat);
    base.rotation.x = -Math.PI / 2; base.position.set(x, 0.03, z);
    levelGroup.add(base);
    const head = new THREE.Group();
    const hm = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), ironDark); hm.position.y = 0.6; hm.castShadow = true;
    head.add(hm);
    for (let i = 0; i < 4; i++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.12, 0.12), ironMat); pl.position.set(0, 0.2 + i * 0.28, d / 2); head.add(pl); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), ironMat); sp.position.set(sx * w * 0.3, -0.12, sz * d * 0.3); sp.rotation.x = Math.PI; head.add(sp); }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 8), ironMat);
    head.add(shaft);
    head.position.set(x, top, z);
    levelGroup.add(head);
    const solid = { min: new V3(x - w / 2, top, z - d / 2), max: new V3(x + w / 2, top + 1.2, z + d / 2), active: false };
    solids.push(solid);
    hazards.push({ kind, x, z, w, d, top, head, shaft, solid, t: o.phase || 0, y: top, slammed: false });
  }
}
function furnace(x, z, side) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 112;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 100, 10, 64, 80, 90);
  gr.addColorStop(0, '#fff0a0'); gr.addColorStop(0.35, '#ff8a20'); gr.addColorStop(1, '#5a1004');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(8, 112); g.lineTo(8, 56); g.arc(64, 56, 56, Math.PI, 0); g.lineTo(120, 112); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.6), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  m.position.set(x, 1.3, z);
  m.rotation.y = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }[side];
  levelGroup.add(m);
  const D = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[side];
  torches.push({ pos: new V3(x + D[0] * 1.2, 1.4, z + D[1] * 1.2), flame: new THREE.Object3D(), ph: Math.random() * 9, small: true });
}
function floodRoom(r) {
  if (!r) return;
  // safe pedestals rise out of the lava (skipped if the player is standing there)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
    const x = r.cx + sx * r.w * 0.28, z = r.cz + sz * r.d * 0.28;
    if (Math.abs(P.pos.x - x) < 2.4 && Math.abs(P.pos.z - z) < 2.4) continue;
    if (overlapBox(x - 1.75, 0.1, z - 1.75, x + 1.75, 1.6, z + 1.75)) continue;
    box(x, 0, z, 3.5, 1.4, 3.5, cobbleMat, 3);
    box(x, 1.4, z, 3.7, 0.15, 3.7, brickMat, 4, false);
    burst(new V3(x, 0.5, z), 14, 0x6a625a, 6, 0.2, 0.7);
  }
  const mesh = lavaPlane(r.cx, r.cz, r.w - 0.4, r.d - 0.4, 0.02);
  mesh.scale.set(0.01, 0.01, 1);
  hazards.push({ kind: 'lava', x: r.cx, z: r.cz, w: r.w - 0.4, d: r.d - 0.4, mesh, dmg: 8, bounce: 8, grow: 0 });
}
function inRect(px, pz, h, pad = 0) { return Math.abs(px - h.x) < h.w / 2 + pad && Math.abs(pz - h.z) < h.d / 2 + pad; }
function updateHazards(dt) {
  LAVA_TEX.offset.x += dt * 0.04; LAVA_TEX.offset.y += dt * 0.025;
  for (const h of hazards) {
    if (h.kind === 'lava') {
      if (h.grow !== undefined && h.grow < 1) { h.grow = Math.min(1, h.grow + dt * 0.4); h.mesh.scale.set(h.grow, h.grow, 1); if (h.grow < 0.6) continue; }
      if (inRect(P.pos.x, P.pos.z, h) && P.pos.y < 0.3 && G.time > (P.lavaT || 0)) {
        P.lavaT = G.time + 0.55;
        if (hurtPlayer(h.dmg, null, true)) { P.vel.y = h.bounce; P.grounded = false; sfx.sizzle(); burst(P.pos.clone().setY(0.2), 10, 0xff8a2a, 6, 0.1, 0.4, true, 0.4); }
      }
      for (const e of enemies) {
        if (e.dead || e.def.fly || e.def.boss || e.spawnT > 0 || e.mesh.position.y > 0.3) continue;
        if (inRect(e.mesh.position.x, e.mesh.position.z, h)) {
          damageEnemy(e, 35 * dt, { weapon: null });
          if (Math.random() < 0.2) spawnPart(e.mesh.position.clone().setY(0.4), new V3(0, 3, 0), 0xff8a2a, 0.1, 0.4, true, -0.1);
          if (e.dead) addStyle(60, 'MELTED', null, 'cool');
        }
      }
    } else if (h.kind === 'vent') {
      h.t += dt;
      const ph = h.t % 4;
      const warn = ph > 2.2 && ph < 3, burn = ph >= 3;
      h.plate.material.color.setHex(burn ? 0xffc060 : warn ? (Math.sin(G.time * 30) > 0 ? 0xff5a10 : 0x8a2008) : 0x331008);
      h.flame.visible = burn;
      if (burn) { h.flame.scale.set(1 + Math.sin(G.time * 40) * 0.1, 0.8 + Math.random() * 0.4, 1 + Math.cos(G.time * 37) * 0.1); h.flame.rotation.y += dt * 6; }
      if (!burn) h.hit = false;
      if (burn && !h.hit) {
        h.hit = true;
        sfx.flame();
        if (Math.hypot(P.pos.x - h.x, P.pos.z - h.z) < h.r + 0.4 && P.pos.y < 4) hurtPlayer(15, new V3(0, 10, 0), true);
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0 || e.def.boss) continue;
          const ep = e.mesh.position;
          if (Math.hypot(ep.x - h.x, ep.z - h.z) < h.r + e.def.r && ep.y < 4) { damageEnemy(e, 45, { weapon: null }); e.burnT = 2; if (e.dead) addStyle(70, 'TORCHED', null, 'cool'); }
        }
      }
      if (burn && Math.random() < 0.5) spawnPart(new V3(h.x + rand(-0.4, 0.4), rand(0.5, 3), h.z + rand(-0.4, 0.4)), new V3(0, 6, 0), 0xffb040, 0.12, 0.3, true, -0.2);
    } else if (h.kind === 'crusher') {
      h.t += dt;
      const ph = h.t % 3.6;
      let y = h.top, shake = 0;
      if (ph < 1.7) y = h.top;
      else if (ph < 2.5) { y = h.top; shake = 0.03 + (ph - 1.7) * 0.06; }
      else if (ph < 2.62) y = h.top * (1 - (ph - 2.5) / 0.12);
      else if (ph < 3.0) y = 0;
      else y = h.top * ((ph - 3.0) / 0.6);
      if (ph < 2.5) h.slammed = false;
      if (ph >= 2.62 && ph < 3.0 && !h.slammed) {
        h.slammed = true;
        sfxAt(new V3(h.x, 0, h.z), 'heavySlam', distVol(new V3(h.x, 0, h.z)));
        G.shake = Math.max(G.shake, 0.4 * distVol(new V3(h.x, 0, h.z)));
        burst(new V3(h.x, 0.2, h.z), 14, 0x6a625a, 8, 0.2, 0.7);
        if (inRect(P.pos.x, P.pos.z, h, PR) && P.pos.y < 1.4) {
          const away = new V3(P.pos.x - h.x, 0, P.pos.z - h.z);
          if (away.lengthSq() < 1e-4) away.set(1, 0, 0);
          away.normalize();
          if (Math.abs(P.pos.x - h.x) / h.w > Math.abs(P.pos.z - h.z) / h.d) P.pos.x = h.x + Math.sign(away.x || 1) * (h.w / 2 + PR + 0.05);
          else P.pos.z = h.z + Math.sign(away.z || 1) * (h.d / 2 + PR + 0.05);
          hurtPlayer(30, away.multiplyScalar(12).setY(6), true);
        }
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0 || e.def.boss) continue;
          const ep = e.mesh.position;
          if (inRect(ep.x, ep.z, h, e.def.r * 0.5) && ep.y < 1.4) { damageEnemy(e, 9999, { weapon: null, knock: new V3(0, -2, 0) }); addStyle(90, 'CRUSHED', null, 'big'); }
        }
      }
      h.y = y;
      h.head.position.set(h.x + (shake ? rand(-shake, shake) : 0), y, h.z + (shake ? rand(-shake, shake) : 0));
      const shaftLen = Math.max(0.1, h.top + 4 - y);
      h.shaft.scale.y = shaftLen; h.shaft.position.y = 1.2 + shaftLen / 2;
      h.solid.min.y = y; h.solid.max.y = y + 1.2;
      h.solid.active = y < 1.6;
    }
  }
}

// ================================================================ SECRETS: skulls, lore notes, gun skins
const secrets = [];
const crackMat = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5a2818'; g.fillRect(0, 0, 256, 256);
  for (let r2 = 0; r2 < 8; r2++) for (let i = -1; i < 4; i++) {
    const x = i * 64 + (r2 % 2) * 32, y = r2 * 32;
    g.fillStyle = `rgb(${110 + Math.random() * 30 | 0},${44 + Math.random() * 14 | 0},${30 + Math.random() * 10 | 0})`;
    g.fillRect(x + 3, y + 3, 58, 26);
  }
  const e = document.createElement('canvas'); e.width = e.height = 256;
  const eg = e.getContext('2d');
  eg.fillStyle = '#000'; eg.fillRect(0, 0, 256, 256);
  eg.strokeStyle = '#ff9a3a'; eg.lineWidth = 3;
  for (let k = 0; k < 5; k++) { eg.beginPath(); let x = 128, y = 128; eg.moveTo(x, y); for (let j = 0; j < 7; j++) { x += (Math.random() - 0.5) * 70; y += (Math.random() - 0.5) * 70; eg.lineTo(x, y); } eg.stroke(); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const em = new THREE.CanvasTexture(e);
  return new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.9 });
})();
function secretWall(x, z, w, d, h, levelId) {
  const mesh = box(x, 0, z, w, h, d, crackMat, 3);
  secrets.push({ mesh, solid: mesh.userData.solid, x, z, levelId, broken: false, pickup: null });
}
function breakSecrets(pos, radius) {
  for (const s2 of secrets) {
    if (s2.broken) continue;
    if (Math.hypot(pos.x - s2.x, pos.z - s2.z) < radius + 1.4 && pos.y < 4.5) breakSecret(s2);
  }
}
function breakSecretsInFront(range) {
  const { origin, dir } = aim();
  let any = false;
  for (const s2 of secrets) {
    if (s2.broken) continue;
    const to = new V3(s2.x, 1.4, s2.z).sub(origin);
    if (to.length() < range + 1.4 && to.normalize().dot(dir) > 0.45) { breakSecret(s2); any = true; }
  }
  return any;
}
function breakSecret(s2) {
  s2.broken = true;
  s2.solid.active = false;
  levelGroup.remove(s2.mesh);
  const wi = worldMeshes.indexOf(s2.mesh);
  if (wi >= 0) worldMeshes.splice(wi, 1);
  const c = new V3(s2.x, 1.4, s2.z);
  rubble(c, 16, 5);
  burst(c, 30, 0x7a3424, 10, 0.25, 1);
  sfx.explode(); sfx.rankUp();
  banner('SECRET!');
  const g = new THREE.Group();
  const bone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, emissive: 0x5a4a20, emissiveIntensity: 0.6, roughness: 0.5, flatShading: true });
  const already = (loadProgress().skulls || {})[s2.levelId];
  if (already) { bone.transparent = true; bone.opacity = 0.35; }
  const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), bone); g.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.3), bone); jaw.position.set(0, -0.3, 0.05); g.add(jaw);
  for (const sx of [-0.12, 0.12]) { const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); eye.position.set(sx, 0.02, 0.29); g.add(eye); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(2.2); g.add(glow);
  g.position.copy(c);
  levelGroup.add(g);
  s2.pickup = g;
}
function updateSecrets(dt) {
  for (const s2 of secrets) {
    if (!s2.pickup) continue;
    s2.pickup.rotation.y += dt * 2;
    s2.pickup.position.y = 1.3 + Math.sin(G.time * 3) * 0.15;
    if (Math.hypot(P.pos.x - s2.x, P.pos.z - s2.z) < 1.8 && Math.abs(P.pos.y + 1 - s2.pickup.position.y) < 2) collectSecret(s2);
  }
}
const TOTAL_SKULLS = LEVELS.filter((l) => !l.duel && !l.race).length;
const skullCount = (p) => Object.keys(p.skulls || {}).length;
const LORE = {
  '0-1': "WORK ORDER #1 · Dig the cellar deep. Deeper than the river. The Foreman wants room for what's coming. · M.",
  '0-2': 'The drains carry more than water. Something mortar-thick crawls up through the grates at night. We stopped asking.',
  '0-4': 'Mortimer used to be one of us. A bricklayer. Then the Foreman offered him a crown and a key to the vault.',
  '1-1': "They built the Cathedral to keep the Kiln's heat down below. Every brick was blessed. Every blessing failed.",
  '1-4': "The High Mason drew plans for a city with no doors. 'Walls,' he said, 'are the only honest prayer.'",
  '2-3': 'Sister Shard swears the stained glass sings when the furnaces below run hot. Lately it never stops singing.',
  '2-5': "The buttresses aren't holding the roof up. They're holding something DOWN.",
  '4-1': 'KILN SAFETY NOTICE · Do not touch the lava. Do not feed the Foreman. Do not let him see you idle.',
  '5-2': 'Kiln No. 7 was meant to fire bricks. The Foreman fires workers now. Same heat. Better walls, he says.',
  '6-1': "If you're reading this, you made it up the stack. He's waiting at the top. Bring something that burns hotter than him.",
};
const SKIN_AT = { '0-3': 'bone', '2-3': 'obsidian', '5-1': 'ember' };
const SKINS = {
  steel: { name: 'STEEL', steel: 0xa8a8b4, dsteel: 0x4a4a56, brass: 0xd0a24a, em: 0x000000 },
  bone: { name: 'BONE', steel: 0xe0d4b8, dsteel: 0x8a7a60, brass: 0x5a4a30, em: 0x000000 },
  obsidian: { name: 'OBSIDIAN', steel: 0x2a2234, dsteel: 0x120e18, brass: 0x8a5ac8, em: 0x1a0a2a },
  ember: { name: 'EMBER', steel: 0x8a3a1a, dsteel: 0x3a1408, brass: 0xffa040, em: 0x5a1a04 },
  gold: { name: 'GILDED', steel: 0xffd060, dsteel: 0xc89a30, brass: 0xfff0b0, em: 0x3a2a00 },
  rust: { name: 'RUSTED', steel: 0x8a4a2a, dsteel: 0x3a1e10, brass: 0xb07a3a, em: 0x0a0300 },
  marble: { name: 'MARBLE', steel: 0xeae6de, dsteel: 0x9a948a, brass: 0x5a8ab0, em: 0x141414 },
  magma: { name: 'MAGMA', steel: 0x2a1410, dsteel: 0x140806, brass: 0xff7a1a, em: 0x8a2604 },
};
function applySkin() {
  const k = SKINS[settings.skin] && (settings.skin === 'steel' || owns('skin_' + settings.skin)) ? settings.skin : 'steel';
  const sk = SKINS[k];
  const M = VM.skinMats;
  M.steel.color.setHex(sk.steel); M.dsteel.color.setHex(sk.dsteel); M.brass.color.setHex(sk.brass);
  for (const mt of [M.steel, M.dsteel]) { mt.emissive.setHex(sk.em); mt.emissiveIntensity = 1; }
}
function collectSecret(s2) {
  levelGroup.remove(s2.pickup);
  s2.pickup = null;
  const p = loadProgress();
  p.skulls = p.skulls || {};
  const fresh = !p.skulls[s2.levelId];
  p.skulls[s2.levelId] = true;
  const skin = SKIN_AT[s2.levelId];
  let skinNew = false;
  if (skin) { p.owned = p.owned || []; if (!p.owned.includes('skin_' + skin)) { p.owned.push('skin_' + skin); skinNew = true; } }
  if (LORE[s2.levelId]) { p.lore = p.lore || {}; p.lore[s2.levelId] = true; }
  saveProgress(p);
  sfx.buy();
  if (fresh) addStyle(200, 'SKULL FOUND', null, 'big');
  const n = skullCount(p);
  showHint(fresh ? `BRICK SKULL ${n} / ${TOTAL_SKULLS}${skinNew ? ` · ${SKINS[skin].name} gun skin unlocked (equip at the FORGE)` : ''}` : 'You already have this skull');
  if (LORE[s2.levelId]) setTimeout(() => showNote(LORE[s2.levelId]), 900);
  if (fresh && n >= TOTAL_SKULLS) setTimeout(() => { banner('ALL SKULLS FOUND'); showHint('A golden DUEL has opened... and the menu remembers an old code.'); }, 2500);
}
let noteT = 0;
function showNote(text) {
  const n = $('note');
  n.querySelector('p').textContent = text;
  n.classList.add('show');
  clearTimeout(noteT);
  noteT = setTimeout(() => n.classList.remove('show'), 8000);
}

// ================================================================ CHEATS (Konami code, needs every skull)
let CHEATS = { bigheads: false, infdash: false, lowgrav: false };
try { CHEATS = Object.assign(CHEATS, JSON.parse(localStorage.getItem('rubblemaker-cheats') || '{}')); } catch (_) {}
const cheatsOn = () => CHEATS.bigheads || CHEATS.infdash || CHEATS.lowgrav;
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let konamiI = 0;
addEventListener('keydown', (e) => {
  konamiI = e.code === KONAMI[konamiI] ? konamiI + 1 : e.code === KONAMI[0] ? 1 : 0;
  if (konamiI < KONAMI.length) return;
  konamiI = 0;
  if (!(G.state === 'menu' || G.state === 'levels')) return;
  if (skullCount(loadProgress()) < TOTAL_SKULLS) {
    $('best').textContent = `The bones rattle... but they are incomplete (${skullCount(loadProgress())} / ${TOTAL_SKULLS} skulls).`;
    return;
  }
  openCheats();
});
function openCheats() {
  const el = $('cheats');
  const row = (k, label) => `<div class="opt"><label>${label}</label><button class="tog ${CHEATS[k] ? 'on' : ''}" data-ch="${k}">${CHEATS[k] ? 'ON' : 'OFF'}</button></div>`;
  el.querySelector('.panel').innerHTML = row('bigheads', 'BIG HEADS (bigger headshot targets)') + row('infdash', 'INFINITE DASH') + row('lowgrav', 'LOW GRAVITY') + '<p class="hint">Cheats stop best ranks from being saved.</p>';
  el.querySelectorAll('[data-ch]').forEach((b) => b.addEventListener('click', () => {
    CHEATS[b.dataset.ch] = !CHEATS[b.dataset.ch];
    try { localStorage.setItem('rubblemaker-cheats', JSON.stringify(CHEATS)); } catch (_) {}
    openCheats();
  }));
  show('cheats', true);
  sfx.rankUp();
}
$('cheatsClose').addEventListener('click', () => show('cheats', false));

// ================================================================ SCENE 1 TRAINERS
function stripLayer(e) {
  e.layers--;
  const ring = e.rig.layerMeshes && e.rig.layerMeshes[e.layers];
  if (ring) ring.visible = false;
  burst(e.mesh.position.clone().setY(2), 24, 0x7ad8ff, 10, 0.12, 0.6, true, 0.3);
  sfx.explode(); fxFlash(0x7ad8ff, 0.2);
  if (e.layers > 0) { banner(`LAYER BROKEN · ${e.layers} LEFT`); addStyle(60, 'LAYER BREAK', null, 'cool'); }
  else { banner('EXPOSED!'); addStyle(120, 'EXPOSED', null, 'big'); e.vulnT = G.time + 5; }
}
function fortressTick(e) {
  if (e.layers === 0 && e.vulnT && G.time > e.vulnT) {
    e.layers = 1; e.vulnT = 0;
    if (e.rig.layerMeshes) e.rig.layerMeshes[0].visible = true;
    banner('SHIELD REFORMED'); sfx.door();
  }
  if (e.rig.layerMeshes) e.rig.layerMeshes.forEach((r2, i) => (r2.rotation.z += 0.02 * (i % 2 ? -1 : 1)));
}
function queenTick(e, dt) {
  e.swarmT = (e.swarmT ?? 1.5) - dt;
  if (e.swarmT <= 0 && enemies.length < 16) {
    e.swarmT = 3.5;
    for (let i = 0; i < 3; i++) makeEnemy('swarmling', e.mesh.position.x + rand(-2, 2), e.mesh.position.z + rand(-2, 2), Math.max(2, e.mesh.position.y + rand(-1, 1)));
    sfx.screech(1);
  }
}

// ================================================================ THE MOLTEN FOREMAN
function updateBoss3(e, dt) {
  const p = e.mesh.position, def = e.def;
  const spd = bossCommon(e);
  if (e.enraged && !e.flooded) { e.flooded = true; floodRoom(e.room); setTimeout(() => banner('THE KILN FLOODS · GET TO HIGH GROUND'), 1200); }
  const dx = P.pos.x - p.x, dz = P.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  const eye = playerEye();
  e.cd -= dt; e.t -= dt;
  let mx = 0, mz = 0, w = 0;
  if (e.state !== 'breath') e.mesh.rotation.y = Math.atan2(dx, dz);
  if (e.state === 'chase') {
    mx = nx * def.speed * spd; mz = nz * def.speed * spd;
    if (e.cd <= 0) {
      const r = Math.random();
      e.atk = dist < 10 && r < 0.45 ? 'stomp' : r < 0.45 ? 'rain' : r < 0.8 ? 'breath' : 'stomp';
      e.wt = { stomp: 0.9, rain: 0.8, breath: 1.0 }[e.atk] / spd;
      e.state = 'windup'; e.t = e.wt;
      sfx.windup(1);
    }
  } else if (e.state === 'windup') {
    w = 1 - e.t / e.wt;
    if (e.t <= 0) {
      if (e.atk === 'stomp') {
        const c = p.clone();
        shockwave(c, 14 * spd, 40, 25);
        if (e.enraged) setTimeout(() => G.boss === e && shockwave(c, 10, 40, 25), 500);
        ringFx(c, 8, 0xff6a10); burst(c.clone().setY(0.3), 34, 0xff8a2a, 13, 0.3, 1, true, 0.6); rubble(c, 10);
        sfx.heavySlam(1); G.shake = Math.max(G.shake, 0.9);
        if (dist < 8 && P.pos.y - p.y < 2) hurtPlayer(35, new V3(nx * 14, 10, nz * 14));
        e.state = 'recover'; e.t = 1.0 / spd;
      } else if (e.atk === 'rain') {
        const n = e.enraged ? 18 : 12;
        for (let i = 0; i < n; i++) {
          const tx = P.pos.x + rand(-8, 8), tz = P.pos.z + rand(-8, 8);
          setTimeout(() => {
            if (G.boss !== e) return;
            ringFx(new V3(tx, 0.05, tz), 2.4, 0xff4a10);
            spawnOrb(new V3(tx, 16, tz), new V3(0, -4, 0), 15, { grav: 24, boom: 2.6, color: 0xff6a10, big: true });
          }, i * 70);
        }
        sfx.bossRoar();
        e.state = 'recover'; e.t = 1.2 / spd;
      } else {
        e.state = 'breath'; e.t = e.enraged ? 2.6 : 2.0; e.beamTick = 0;
        const from = new V3(); e.rig.head.getWorldPosition(from);
        e.beamDir = eye.clone().sub(from).normalize();
        sfx.flame();
      }
    }
  } else if (e.state === 'breath') {
    const from = new V3(); e.rig.head.getWorldPosition(from);
    const want = eye.clone().sub(from).normalize();
    e.beamDir.lerp(want, Math.min(1, dt * 0.9 * spd)).normalize();
    e.mesh.rotation.y = Math.atan2(e.beamDir.x, e.beamDir.z);
    ray.set(from, e.beamDir); ray.far = 120;
    const hh = ray.intersectObjects(worldMeshes, false)[0];
    const end = hh ? hh.point : from.clone().addScaledVector(e.beamDir, 120);
    const b = enemyBeam(e, 0xff8a2a);
    setBeam(b, from, end, 0.55 + Math.sin(G.time * 40) * 0.1);
    if (Math.random() < 0.7) spawnPart(end.clone(), new V3(rand(-3, 3), rand(2, 6), rand(-3, 3)), 0xffb040, 0.15, 0.5, true, 0.2);
    e.beamTick -= dt;
    const body = new V3(P.pos.x, P.pos.y + 1, P.pos.z);
    if (segDist(body, from, end) < 1.2 && e.beamTick <= 0) {
      if (P.dashT > 0 || P.invuln > 0) { if (!e.dodgedBeam) { e.dodgedBeam = true; addStyle(50, 'DODGE', null, 'cool'); } }
      else if (hurtPlayer(14, null)) e.beamTick = 0.3;
    }
    if (e.t <= 0) { b.visible = false; e.dodgedBeam = false; e.state = 'recover'; e.t = 0.8; }
  } else if (e.t <= 0) { e.state = 'chase'; e.cd = rand(1.0, 1.8) / spd; }
  if (e.enraged) { e.summonT -= dt; if (e.summonT <= 0) { e.summonT = 12; summonMinions(e, 'bomber', 2); } }
  enemyPhysics(e, mx, mz, dt);
  const moving = Math.hypot(mx, mz) > 0.5;
  if (moving) e.walk += dt * 3;
  const real = e.state;
  if (real === 'breath') e.state = 'windup';
  animateEnemy(e, dt, moving, real === 'breath' ? 0.4 : w, G.time);
  e.state = real;
  applyFlash(e, w);
}

// ================================================================ wiring for duels / UI
Object.assign(DUEL_LINES, { gilded: { intro: 'Every skull, returned to me. You have earned a real fight.', 75: 'Gold does not dent, little brick.', 50: 'Ha! You shine brighter than I do!', 25: 'Is this... what losing feels like?', win: 'Take my shine. Wear it well.' } });
Object.assign(EPITHETS, {
  boss3: ['ACT III BOSS', 'LORD OF THE KILN'], gilded: ['SECRET DUEL', 'KEEPER OF THE SKULLS'],
  mirror: ['TRAINER', 'LESSON V · THE RICOCHET'], marksman: ['TRAINER', 'LESSON VI · THE COUNTERSNIPE'],
  fortress: ['TRAINER', 'LESSON VII · THE SHIELD BREAK'], queen: ['TRAINER', 'LESSON VIII · THE SWARM'],
});
function renderSkins() {
  const el = $('skinRow');
  if (!el) return;
  const owned = Object.keys(SKINS).filter((k) => k === 'steel' || owns('skin_' + k));
  el.innerHTML = '<b>GUN SKIN</b>' + owned.map((k) => `<button data-skin="${k}" class="${(settings.skin || 'steel') === k ? 'on' : ''}">${SKINS[k].name}</button>`).join('') + `<span>${Object.keys(SKINS).length - owned.length} hidden in secret rooms, duels, PRIME rematches & achievements</span>`;
  el.querySelectorAll('[data-skin]').forEach((b) => b.addEventListener('click', () => { settings.skin = b.dataset.skin; saveSettings(); applySkin(); renderSkins(); }));
}
applySkin();
