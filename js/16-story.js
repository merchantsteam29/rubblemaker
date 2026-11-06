'use strict';
// ================================================================ BATCH 4.4b: STORY + CUTSCENES
const STORY = {
  prologue: { title: 'PROLOGUE', card: 'ACT I · THE CELLAR', lines: [
    ['THE GUILD', 'Before the fire, there was the GUILD. Masons. Bricklayers. The builders of this city.'],
    ['THE GUILD', 'Then came the MOLTEN FOREMAN. He took the kilns, fired the workers, and turned every brick against us.'],
    ['THE GUILD', 'With the last of our mortar, the dead guild raised one more pair of hands.'],
    ['THE GUILD', 'You do not speak. You do not tire. You were made to tear it all down.'],
  ] },
  scene1: { title: 'ACT II', card: 'ACT II · THE CATHEDRAL', lines: [
    ['THE GUILD', 'The cellar is quiet now. The Warden\'s keys are rust.'],
    ['THE GUILD', 'Above it stands the CATHEDRAL, drawn by the HIGH MASON, our chief architect, who sold our plans to the fire.'],
    ['THE GUILD', 'Every arch he laid is a lie. Bring them down.'],
  ] },
  scene2: { title: 'ACT III', card: 'ACT III · THE KILN', lines: [
    ['THE GUILD', 'The cathedral has fallen, and the roof of the city has fallen in with it.'],
    ['THE GUILD', 'Below, the kilns roar. The Foreman is waiting for the last brick he hasn\'t fired.'],
    ['THE GUILD', 'Go into the heat. Make rubble of the rest.'],
  ] },
  boss1: { title: 'THE WARDEN', lines: [
    ['MORTIMER', 'Another guild brick come knocking? I let the fire in, little golem.'],
    ['MORTIMER', 'I\'ll let it into you too.'],
  ] },
  boss2: { title: 'THE ARCHITECT', lines: [
    ['THE HIGH MASON', 'You\'re built from MY plans, golem. Every brick in you, I drew.'],
    ['THE HIGH MASON', 'Allow me a revision.'],
  ] },
  boss3: { title: 'THE FOREMAN', lines: [
    ['THE MOLTEN FOREMAN', 'The guild\'s last batch. Underfired. Cracked. Look at you.'],
    ['THE MOLTEN FOREMAN', 'Back in the kiln with you. I\'ll do it myself.'],
  ] },
  ending: { title: 'EPILOGUE', card: 'THANK YOU FOR PLAYING', sub: 'PRIME rematches, duels and the RUBBLE PIT still wait for you', lines: [
    ['THE GUILD', 'The kiln is cold. The Foreman is slag.'],
    ['THE GUILD', 'The city is rubble now. And from rubble, we build again.'],
    ['THE GUILD', 'Rest, golem. Or don\'t. There are always more walls.'],
  ] },
};
const STORY_AT = { '0-1': 'prologue', '1-1': 'scene1', '4-1': 'scene2' };
const CUTS_KEY = 'rubblemaker-cuts';
function cutsSeen() { try { return JSON.parse(localStorage.getItem(CUTS_KEY) || '{}'); } catch (_) { return {}; } }
function markCut(id) { const s2 = cutsSeen(); s2[id] = 1; try { localStorage.setItem(CUTS_KEY, JSON.stringify(s2)); } catch (_) {} }
var CUT = null;
const lerpV = (a, b, t) => new V3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const ease = (t) => t * t * (3 - 2 * t);
function buildGolem() {
  // the hero: a brick golem with a glowing mortar core and eyes
  const md = buildEnemyModel('heavy', 0x9a4a2a);
  const glow = new THREE.MeshBasicMaterial({ color: 0x8ae8ff });
  const r = md.rig;
  for (const sd of [-1, 1]) { const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.04), glow); eye.position.set(sd * 0.12, 0.18, 0.3); r.head.add(eye); }
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glow); core.position.set(0, 0.8, 0.5); r.torso.add(core);
  const light = new THREE.PointLight(0x6ad8ff, 3, 6); light.position.set(0, 1, 1); r.torso.add(light);
  md.core = core;
  return md;
}
// Plays a list of shots: { from, to, look, lookTo, line: [who, text], card, dur }
function playCutscene(id, shots, done, opts = {}) {
  markCut(id);
  document.exitPointerLock?.();
  for (const s2 of ['menu', 'levels', 'complete', 'over', 'pause', 'codex']) show(s2, false);
  show('hud', false);
  show('cutscene', true);
  $('cutscene').classList.remove('out');
  CUT = { id, shots, i: -1, t: 0, done, props: opts.props || [], prevState: G.state, typed: 0, pad: {} };
  G.state = 'cutscene';
  nextShot();
  $('cutSkip').textContent = G.input === 'pad' ? 'Ⓐ NEXT · Ⓑ SKIP' : G.input === 'touch' ? 'TAP: NEXT · HOLD: SKIP' : 'SPACE / CLICK: NEXT · ESC: SKIP';
}
function nextShot() {
  if (!CUT) return;
  CUT.i++;
  if (CUT.i >= CUT.shots.length) { endCutscene(); return; }
  const sh = CUT.shots[CUT.i];
  CUT.t = 0; CUT.typed = 0;
  const txt = sh.line ? sh.line[1] : '';
  sh.dur = sh.dur || Math.max(3.2, txt.length / 24 + 1.6);
  $('cutWho').textContent = sh.line ? sh.line[0] : '';
  $('cutText').textContent = '';
  $('cutCap').classList.toggle('hidden', !sh.line);
  const card = $('cutCard');
  if (sh.card) { card.innerHTML = `<b>${sh.card}</b>${sh.sub ? `<small>${sh.sub}</small>` : ''}`; card.classList.remove('show'); void card.offsetWidth; card.classList.add('show'); }
  else card.classList.remove('show');
  if (sh.onStart) sh.onStart();
}
function endCutscene() {
  if (!CUT) return;
  const c = CUT;
  CUT = null;
  for (const p of c.props) scene.remove(p);
  $('cutscene').classList.add('out');
  setTimeout(() => { if (!CUT) show('cutscene', false); }, 400);
  G.state = c.prevState === 'complete' ? 'complete' : 'play';
  last = performance.now();
  c.done && c.done();
}
function updateCutscene(dt) {
  if (!CUT) return;
  const sh = CUT.shots[CUT.i];
  if (!sh) return;
  CUT.t += dt;
  const k = ease(Math.min(1, CUT.t / sh.dur));
  const pos = sh.orbit ? new V3(sh.orbit.x + Math.sin(sh.a0 + (sh.a1 - sh.a0) * k) * sh.r, sh.y, sh.orbit.z + Math.cos(sh.a0 + (sh.a1 - sh.a0) * k) * sh.r) : lerpV(sh.from, sh.to || sh.from, k);
  const look = sh.orbit ? new V3(sh.orbit.x, sh.lookY, sh.orbit.z) : lerpV(sh.look, sh.lookTo || sh.look, k);
  camera.position.copy(pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  scene.updateMatrixWorld();
  if (sh.tick) sh.tick(dt, k);
  if (sh.line) {
    const n = Math.min(sh.line[1].length, Math.floor(CUT.t * 42));
    if (n !== CUT.typed) { CUT.typed = n; $('cutText').textContent = sh.line[1].slice(0, n); if (n % 3 === 0) try { tone(900 + Math.random() * 200, 700, 0.025, 0.03, 'square'); } catch (_) {} }
  }
  // gamepad: A = next, B/START = skip
  const cutPad = getPad();
  for (const gp of cutPad ? [cutPad] : []) {
    for (const [b, act] of [[0, 'next'], [1, 'skip'], [9, 'skip']]) {
      const down = !!(gp.buttons[b] && gp.buttons[b].pressed);
      const key = gp.index + ':' + b;
      if (down && !CUT.pad[key]) { CUT.pad[key] = true; act === 'next' ? cutAdvance() : endCutscene(); if (!CUT) return; }
      else if (!down) CUT.pad[key] = false;
    }
  }
  if (CUT && CUT.t >= sh.dur + (sh.hold || 0.6)) nextShot();
}
function cutAdvance() {
  if (!CUT) return;
  const sh = CUT.shots[CUT.i];
  if (sh && sh.line && CUT.typed < sh.line[1].length) { CUT.t = Math.max(CUT.t, sh.line[1].length / 42); return; }
  nextShot();
}
addEventListener('keydown', (e) => {
  if (G.state !== 'cutscene') return;
  e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'Backspace') endCutscene(); else cutAdvance();
}, true);
let cutHold = 0;
addEventListener('pointerdown', () => { if (G.state === 'cutscene') { cutHold = setTimeout(() => endCutscene(), 700); } });
addEventListener('pointerup', () => { if (G.state === 'cutscene' && cutHold) { clearTimeout(cutHold); cutHold = 0; cutAdvance(); } });

// ---- scripted shots
function storyShots(id, L) {
  const st = STORY[id];
  const sx = L.start.x, sz = L.start.z, yaw = L.start.yaw;
  const f = new V3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const at = (fw, up, side = 0) => new V3(sx + f.x * fw - f.z * side, up, sz + f.z * fw + f.x * side);
  const lines = st.lines;
  const shots = [];
  const props = [];
  if (id === 'prologue') {
    const g = buildGolem();
    g.root.position.set(sx, 0, sz);
    g.root.rotation.y = Math.atan2(f.x, f.z);
    g.root.scale.multiplyScalar(0.65);
    scene.add(g.root);
    props.push(g.root);
    const spin = (dt) => { g.core.rotation.y += dt * 2; g.core.rotation.x += dt; };
    shots.push({ from: at(5, 5, 2.5), to: at(3.5, 3.8, -1.5), look: at(0, 1.2, 0), line: lines[0], tick: spin });
    shots.push({ from: at(5.5, 2.2, -3), to: at(5, 2.6, 2.5), look: at(0, 1.6, 0), line: lines[1], tick: spin });
    shots.push({ orbit: at(0, 0, 0), r: 4.2, y: 1.9, lookY: 1.4, a0: yaw + Math.PI - 0.8, a1: yaw + Math.PI + 0.5, line: lines[2], tick: spin });
    shots.push({ from: at(2.8, 1.6, 0.5), to: at(2.0, 1.7, 0), look: at(0, 1.5, 0), line: lines[3], tick: spin });
    shots.push({ from: at(-1.6, 2.4, 0), to: at(0, 1.6, 0), look: at(10, 1.6, 0), card: st.card, dur: 3.2, hold: 0.4, tick: (dt, k) => { spin(dt); g.root.visible = k < 0.35; }, onStart: () => sfx.bossRoar() });
  } else {
    shots.push({ from: at(5, 6.5, 3), to: at(3, 5, -2), look: at(-2, 1, 0), line: lines[0] });
    shots.push({ from: at(-1.5, 3.5, -3), to: at(-1, 2.6, 3), look: at(8, 2, 0), line: lines[1] });
    if (lines[2]) shots.push({ from: at(-1, 2.4, 0), to: at(1, 2, 0), look: at(12, 1.8, 0), line: lines[2] });
    shots.push({ from: at(-1, 2, 0), to: at(0, 1.6, 0), look: at(10, 1.6, 0), card: st.card, dur: 3, hold: 0.3 });
  }
  return { shots, props };
}
function maybeStory(lv, go) {
  if (VS && VS.active) return false;
  const id = STORY_AT[lv.id];
  if (!id || cutsSeen()[id] || !G.layout) return false;
  const { shots, props } = storyShots(id, G.layout);
  playCutscene(id, shots, go, { props });
  return true;
}
function bossCutscene(room) {
  const type = room.boss;
  if ((VS && VS.active) || G.mode !== 'campaign' || !STORY[type] || (G.level && G.level.prime) || cutsSeen()[type] || G.state !== 'play') return false;
  const def = DEFS[type];
  const md = codexModel(type);
  md.root.position.set(room.cx, 0, room.cz);
  md.root.rotation.y = Math.atan2(P.pos.x - room.cx, P.pos.z - room.cz);
  scene.add(md.root);
  const c = new V3(room.cx, 0, room.cz);
  const to = new V3(P.pos.x - room.cx, 0, P.pos.z - room.cz).normalize();
  const a = Math.atan2(to.x, to.z);
  const h = def.h || 4;
  const lines = STORY[type].lines;
  const shots = [
    { from: c.clone().addScaledVector(to, 10).setY(1.5), to: c.clone().addScaledVector(to, 6.5).setY(2), look: c.clone().setY(h * 0.9), line: lines[0], onStart: () => { sfx.bossRoar(); G.shake = 0.5; } },
    { orbit: c, r: Math.max(6, h * 1.6), y: h * 0.75, lookY: h * 0.7, a0: a - 0.7, a1: a + 0.5, line: lines[1] },
  ];
  playCutscene(type, shots, () => { scene.remove(md.root); requestLock(); spawnBoss(room); }, { props: [md.root] });
  return true;
}
function playEnding(done) {
  const L = G.layout, st = STORY.ending;
  const r = L.rooms.find((x) => x.boss) || L.rooms[0];
  const c = new V3(r.cx, 0, r.cz);
  const shots = [
    { orbit: c, r: r.w * 0.45, y: 9, lookY: 0.5, a0: 0, a1: 1.2, line: st.lines[0] },
    { from: c.clone().add(new V3(-r.w * 0.4, 2.5, r.d * 0.4)), to: c.clone().add(new V3(r.w * 0.3, 4, r.d * 0.3)), look: c.clone().setY(1), line: st.lines[1] },
    { orbit: c, r: r.w * 0.3, y: 14, lookY: 0, a0: 2, a1: 2.8, line: st.lines[2] },
    { orbit: c, r: r.w * 0.3, y: 20, lookY: 0, a0: 2.8, a1: 3.2, card: st.card, sub: st.sub, dur: 4.5, hold: 1 },
  ];
  playCutscene('ending', shots, done);
}
