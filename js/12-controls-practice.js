'use strict';
// ================================================================ BATCH 4·1: CONTROLLER, TOUCH, PRACTICE ROOM
const IS_TOUCH = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
  (navigator.maxTouchPoints > 0 && !(typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches));
function touchActive() { return settings.touchControls === 'on' || (settings.touchControls === 'auto' && IS_TOUCH); }
let lastTouch = 0;
G.input = 'kbm';
function setInput(mode) {
  if (G.input === mode) return;
  if (mode === 'touch' && !touchActive()) return;
  G.input = mode;
  document.body.classList.toggle('touch', mode === 'touch');
  document.body.classList.toggle('pad', mode === 'pad');
  $('resumeBtn').textContent = mode === 'kbm' ? 'CLICK TO RESUME' : 'RESUME';
  if (mode !== 'pad' && navFocus) { navFocus.classList.remove('padfocus'); navFocus = null; }
  renderControls();
  updateArmSlot();
  promptShown = null; PRACTICE.near = undefined; // re-label any open prompt
}
function pauseGame() {
  if (G.state !== 'play') return;
  document.exitPointerLock?.();
  G.state = 'pause';
  show('pause', true);
}

// ---------------------------------------------------------------- gamepad
const PADS = { prev: [], navT: 0, navDir: '', rumbleT: 0, centered: {} };
addEventListener('gamepaddisconnected', (e) => { delete PADS.centered[e.gamepad.index]; });
function getPad() {
  // only real game pads: wheels, joysticks, pedals and tablets also report as "gamepads" and their
  // resting axes read as a held stick, which spun the camera on its own
  if (!navigator.getGamepads || settings.controllers === false) return null;
  for (const p of navigator.getGamepads()) {
    if (!p || !p.connected || p.mapping !== 'standard' || NOT_PADS.test(p.id || '')) continue;
    return p;
  }
  return null;
}
const NOT_PADS = /wheel|racing|steer|joystick|flight|hotas|throttle|pedal|rudder|tablet|wacom|stylus|pen |g29|g920|g923|t150|t300|tmx|fanatec|simucube|moza|extreme 3d|x52|x56/i;
function deadzone(v) {
  const d = settings.padDeadzone, a = Math.abs(v || 0);
  return a < d ? 0 : Math.sign(v) * Math.min(1, (a - d) / (1 - d));
}
const curve = (v) => Math.sign(v) * Math.abs(v) ** 1.7;

function pollInput(dt) {
  VDOWN.clear(); AXIS.x = 0; AXIS.y = 0;
  // touch
  const playing = G.state === 'play';
  const showT = G.input === 'touch' && playing;
  if (tui.classList.contains('hidden') === showT) {
    tui.classList.toggle('hidden', !showT);
    if (!showT) resetTouch();
  }
  if (showT) {
    tui.style.setProperty('--top', settings.touchOpacity);
    for (const a of TOUCH.held.values()) VDOWN.add(a);
    AXIS.x = TOUCH.mx; AXIS.y = TOUCH.my;
    aimPull(dt, TOUCH.looks.size > 0 || VDOWN.has('fire') || Math.hypot(AXIS.x, AXIS.y) > 0.2);
  }
  $('rotate').classList.toggle('hidden', !(G.input === 'touch' && innerHeight > innerWidth && (playing || G.state === 'pause')));
  // pad
  const gp = getPad();
  if (!gp) { PADS.prev = []; return; }
  const now = gp.buttons.map((b) => b.pressed || b.value > 0.45);
  const was = PADS.prev;
  const edge = (i) => !!now[i] && !was[i];
  const ax = gp.axes;
  // a stick only counts once it has been seen resting in the middle (a stuck or drifting axis never does)
  const cen = PADS.centered[gp.index] || (PADS.centered[gp.index] = []);
  const axv = (i) => { const v = ax[i] || 0; if (Math.abs(v) < 0.2) cen[i] = true; return cen[i] ? v : 0; };
  const lx = deadzone(axv(0)), ly = deadzone(axv(1)), rx = deadzone(axv(2)), ry = deadzone(axv(3));
  if (now.some((b, i) => b && !was[i]) || Math.hypot(lx, ly) > 0.35 || Math.hypot(rx, ry) > 0.35) setInput('pad');
  if (G.input === 'pad') {
    if (playing) {
      for (const a in settings.padBinds) {
        const b = settings.padBinds[a];
        if (b == null) continue;
        if (now[b]) VDOWN.add(a);
        if (edge(b)) VHIT.add(a);
      }
      AXIS.x = lx; AXIS.y = -ly;
      const fr = aimFriction();
      const cx = curve(rx), cy = curve(ry);
      P.yaw -= cx * 3.4 * settings.padSens * fr * dt;
      P.pitch = clamp(P.pitch - cy * 2.5 * settings.padSens * fr * (settings.padInvert ? -1 : 1) * dt, -1.55, 1.55);
      swayX += cx * 6; swayY += cy * 6;
      aimPull(dt, Math.hypot(lx, ly) + Math.hypot(rx, ry) > 0.1 || VDOWN.has('fire'));
      if (edge(9)) pauseGame();
      rumble(gp, dt);
    } else if (!settingsUI.isCapturing()) padMenu(now, edge, lx, ly, dt);
  }
  PADS.prev = now;
}
function rumble(gp, dt) {
  PADS.rumbleT -= dt;
  const act = gp.vibrationActuator;
  if (!settings.rumble || !act || !act.playEffect || PADS.rumbleT > 0) return;
  const strong = Math.min(1, G.shake * 0.9 + (P.hurtFlash > 0.9 ? 0.6 : 0));
  const weak = Math.min(1, G.shake * 1.2 + (W.kick > 0.4 ? 0.3 : 0));
  if (strong < 0.1 && weak < 0.15) return;
  PADS.rumbleT = 0.09;
  try { act.playEffect('dual-rumble', { duration: 110, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {}); } catch (_) {}
}

// ---- aim assist (pad + touch only): a little friction over targets and a gentle pull
let aimTarget = null;
const aimFwd = new V3();
function findAimTarget() {
  if (!settings.aimAssist || G.input === 'kbm') return null;
  const cp = camera.position;
  aimFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  let best = null;
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0 || e.buried) continue;
    const t = e.mesh.position.clone();
    t.y += e.def.fly ? 0 : e.def.h * 0.62;
    const d = t.clone().sub(cp);
    const len = d.length();
    if (len > 70 || len < 1.2) continue;
    const ang = aimFwd.angleTo(d);
    const lim = 0.05 + 0.07 * settings.aimAssist + Math.atan(e.def.r / len);
    if (ang < lim && (!best || ang < best.ang) && lineOfSight(cp, t)) best = { e, t, ang };
  }
  return best;
}
function aimPull(dt, active) {
  aimTarget = findAimTarget();
  if (!aimTarget || !active) return;
  const d = aimTarget.t.clone().sub(camera.position);
  const yawT = Math.atan2(-d.x, -d.z), pitchT = Math.atan2(d.y, Math.hypot(d.x, d.z));
  let dy = yawT - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const k = Math.min(1, dt * 4.5 * settings.aimAssist);
  P.yaw += dy * k;
  P.pitch += (pitchT - P.pitch) * k * 0.6;
}
function aimFriction() { return aimTarget ? 1 - 0.45 * settings.aimAssist : 1; }

// ---- menu navigation with the pad
let navFocus = null;
function activeScreen() {
  const l = [...document.querySelectorAll('.screen')].filter((s) => !s.classList.contains('hidden') && s.getClientRects().length);
  return l[l.length - 1] || null;
}
function navItems(scr) {
  return [...scr.querySelectorAll('button, input[type=range]')].filter((b) => !b.disabled && b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden');
}
function setNavFocus(el) {
  if (navFocus) navFocus.classList.remove('padfocus');
  navFocus = el;
  if (el) { el.classList.add('padfocus'); try { el.focus({ preventScroll: true }); } catch (_) {} el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}
function navMove(dir, items) {
  const cur = navFocus;
  if (cur.type === 'range' && (dir === 'left' || dir === 'right')) {
    const st = Number(cur.step) || 1, span = Number(cur.max) - Number(cur.min);
    const inc = Math.max(st, Math.round(span / 30 / st) * st);
    cur.value = clamp(Number(cur.value) + (dir === 'right' ? inc : -inc), Number(cur.min), Number(cur.max));
    cur.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const a = cur.getBoundingClientRect();
  const ax0 = a.left + a.width / 2, ay0 = a.top + a.height / 2;
  const V = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  let best = null, bs = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax0, dy = b.top + b.height / 2 - ay0;
    const along = dx * V[0] + dy * V[1];
    if (along <= 4) continue;
    const across = Math.abs(dx * V[1] - dy * V[0]);
    const sc = along + across * 2.2;
    if (sc < bs) { bs = sc; best = el; }
  }
  if (best) { setNavFocus(best); tone(520, 560, 0.04, 0.05, 'square'); }
}
function padBack(scr) {
  if (scr.id === 'settings') { const b = scr.querySelector('.back'); if (b) b.click(); return; }
  const map = { shop: 'shopClose', levels: 'levelsBack', pitRecords: 'pitRecordsBack', codex: 'codexBack', versus: 'vsBack', vsResult: 'vsLobbyBtn', cheats: 'cheatsClose', pause: 'resumeBtn' };
  if (map[scr.id]) $(map[scr.id]).click();
}
function padMenu(now, edge, lx, ly, dt) {
  const scr = activeScreen();
  if (!scr) return;
  // the Konami code works on the D-pad too (B, A at the end)
  for (const [b, code] of [[12, 'ArrowUp'], [13, 'ArrowDown'], [14, 'ArrowLeft'], [15, 'ArrowRight'], [1, 'KeyB'], [0, 'KeyA']]) {
    if (edge(b)) dispatchEvent(new KeyboardEvent('keydown', { code }));
  }
  if (activeScreen() !== scr) return; // the code opened the cheats panel
  const items = navItems(scr);
  if (!items.length) return;
  if (!navFocus || !items.includes(navFocus)) setNavFocus(items[0]);
  let dir = '';
  if (now[12] || ly < -0.5) dir = 'up';
  else if (now[13] || ly > 0.5) dir = 'down';
  else if (now[14] || lx < -0.5) dir = 'left';
  else if (now[15] || lx > 0.5) dir = 'right';
  if (dir) {
    if (dir !== PADS.navDir) { PADS.navDir = dir; PADS.navT = 0.38; navMove(dir, items); }
    else { PADS.navT -= dt; if (PADS.navT <= 0) { PADS.navT = 0.1; navMove(dir, items); } }
  } else PADS.navDir = '';
  if (edge(0) && navFocus && navFocus.type !== 'range') { initAudio(); navFocus.click(); }
  else if (edge(1) || (edge(9) && G.state === 'pause')) padBack(scr);
}

// ---------------------------------------------------------------- touch
const tui = document.createElement('div');
tui.id = 'touchUI';
tui.className = 'hidden';
tui.innerHTML = `<div id="tLook"></div><div id="tStick"><i></i></div>
  <button data-act="fire" class="tb fire">FIRE</button><button data-act="alt" class="tb alt">ALT</button>
  <button data-act="jump" class="tb jump">JUMP</button><button data-act="slide" class="tb slide">SLIDE</button>
  <button data-act="dash" class="tb dash">DASH</button><button data-act="punch" class="tb punch">PUNCH</button>
  <button data-act="swap" class="tb swap">SWAP</button><button data-act="arm" class="tb arm">ARM</button>
  <button data-act="interact" class="tb use">USE</button>
  <button data-act="weapon1" class="tb w w1">1 REV</button><button data-act="weapon2" class="tb w w2">2 SHOT</button><button data-act="weapon3" class="tb w w3">3 NAIL</button><button data-act="weapon4" class="tb w w4">4 BRICK</button>
  <button data-act="pause" class="tb pause">II</button>`;
document.body.appendChild(tui);
const rot = document.createElement('div');
rot.id = 'rotate'; rot.className = 'hidden';
rot.innerHTML = '<b>⟳</b><span>TURN YOUR PHONE SIDEWAYS</span><small>RUBBLEMAKER plays in landscape</small>';
document.body.appendChild(rot);
const stickEl = $('tStick'), knobEl = stickEl.firstElementChild;
const TOUCH = { held: new Map(), looks: new Map(), stick: null, mx: 0, my: 0 };
function resetTouch() {
  TOUCH.held.clear(); TOUCH.looks.clear(); TOUCH.stick = null; TOUCH.mx = TOUCH.my = 0;
  stickEl.classList.remove('on');
  tui.querySelectorAll('.tb.on').forEach((b) => b.classList.remove('on'));
}
function touchLook(t, prev) {
  const k = 0.0052 * settings.touchSens * aimFriction();
  const dx = t.clientX - prev.x, dy = t.clientY - prev.y;
  P.yaw -= dx * k;
  P.pitch = clamp(P.pitch - dy * k, -1.55, 1.55);
  swayX += dx * 0.6; swayY += dy * 0.6;
  prev.x = t.clientX; prev.y = t.clientY;
}
tui.addEventListener('touchstart', (ev) => {
  ev.preventDefault();
  lastTouch = Date.now();
  setInput('touch');
  if (G.state !== 'play') return;
  for (const t of ev.changedTouches) {
    const btn = t.target.closest ? t.target.closest('[data-act]') : null;
    if (btn) {
      const a = btn.dataset.act;
      if (a === 'pause') { pauseGame(); continue; }
      TOUCH.held.set(t.identifier, a);
      VHIT.add(a);
      btn.classList.add('on');
      if (a === 'fire' || a === 'alt') TOUCH.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
    } else if (t.clientX < innerWidth * 0.42 && !TOUCH.stick) {
      TOUCH.stick = { id: t.identifier, x: t.clientX, y: t.clientY };
      stickEl.style.left = t.clientX + 'px'; stickEl.style.top = t.clientY + 'px';
      knobEl.style.transform = '';
      stickEl.classList.add('on');
    } else TOUCH.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
  }
}, { passive: false });
tui.addEventListener('touchmove', (ev) => {
  ev.preventDefault();
  lastTouch = Date.now();
  if (G.state !== 'play') return;
  for (const t of ev.changedTouches) {
    if (TOUCH.stick && t.identifier === TOUCH.stick.id) {
      const R = Math.min(innerWidth, innerHeight) * 0.11;
      let dx = (t.clientX - TOUCH.stick.x) / R, dy = (t.clientY - TOUCH.stick.y) / R;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      TOUCH.mx = Math.abs(dx) < 0.12 ? 0 : dx; TOUCH.my = Math.abs(dy) < 0.12 ? 0 : -dy;
      knobEl.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
    } else if (TOUCH.looks.has(t.identifier)) touchLook(t, TOUCH.looks.get(t.identifier));
  }
}, { passive: false });
function touchEnd(ev) {
  ev.preventDefault();
  lastTouch = Date.now();
  for (const t of ev.changedTouches) {
    if (TOUCH.held.has(t.identifier)) {
      const a = TOUCH.held.get(t.identifier);
      TOUCH.held.delete(t.identifier);
      if (![...TOUCH.held.values()].includes(a)) { const b = tui.querySelector(`[data-act="${a}"]`); if (b) b.classList.remove('on'); }
    }
    TOUCH.looks.delete(t.identifier);
    if (TOUCH.stick && t.identifier === TOUCH.stick.id) { TOUCH.stick = null; TOUCH.mx = TOUCH.my = 0; stickEl.classList.remove('on'); }
  }
}
tui.addEventListener('touchend', touchEnd, { passive: false });
tui.addEventListener('touchcancel', touchEnd, { passive: false });
// any tap on a menu also flips into touch mode (so the first level starts with on-screen controls)
addEventListener('touchstart', () => { lastTouch = Date.now(); setInput('touch'); }, { passive: true });
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement && G.input === 'touch') { try { screen.orientation.lock('landscape').catch(() => {}); } catch (_) {} }
});

// ---------------------------------------------------------------- PRACTICE ROOM
const PRACTICE = { god: false, slots: [], pads: [], hits: [], last: 0, near: undefined, cd: 0, hudT: 0 };
const PRACTICE_PADS = [
  ['grunt', 'GRUNTS', 0xff7a3a], ['shooter', 'SHOOTERS', 0xff7a3a], ['flyer', 'GARGOYLES', 0xff7a3a], ['heavy', 'HEAVY', 0xff7a3a],
  ['shield', 'SHIELDBEARERS', 0xff7a3a], ['sniper', 'SNIPER', 0xff7a3a], ['bomber', 'BOMBERS', 0xff7a3a], ['priest', 'PRIEST', 0xff7a3a],
  ['wave', 'MIXED WAVE', 0xffd04a], ['clear', 'CLEAR ALL', 0x9a9aa8], ['god', 'GOD MODE', 0x4aff6a],
];
function labelTexture(text, color, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(12,6,4,0.82)'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = color; g.lineWidth = 8; g.strokeRect(6, 6, 500, 148);
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 54px Rubik, sans-serif'; g.fillText(text, 256, sub ? 62 : 80);
  if (sub) { g.fillStyle = '#d8c4b0'; g.font = '700 30px Rubik, sans-serif'; g.fillText(sub, 256, 118); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function wallSign(x, y, z, rotY, title, lines) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1a0e09'; g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = '#ff4a1c'; g.lineWidth = 12; g.strokeRect(10, 10, 1004, 492);
  g.fillStyle = '#ff6a3a'; g.font = '900 72px Rubik, sans-serif'; g.textAlign = 'center';
  g.fillText(title, 512, 108);
  g.fillStyle = '#f2e6d8'; g.font = '700 40px Rubik, sans-serif';
  lines.forEach((l, i) => { let fs2 = 40; g.font = `700 ${fs2}px Rubik, sans-serif`; while (g.measureText(l).width > 960 && fs2 > 20) { fs2 -= 2; g.font = `700 ${fs2}px Rubik, sans-serif`; } g.fillText(l, 512, 200 + i * 84); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: t }));
  m.position.set(x, y, z); m.rotation.y = rotY;
  levelGroup.add(m);
}
function buildPractice() {
  const X = 30, Z = 24, H = 12;
  box(0, -1, 0, 2 * X + 4, 1, 2 * Z + 4, floorMat, 3.5);
  box(0, 0, -Z - 1, 2 * X + 4, H, 2, brickMat); box(0, 0, Z + 1, 2 * X + 4, H, 2, brickMat);
  box(-X - 1, 0, 0, 2, H, 2 * Z, brickMat); box(X + 1, 0, 0, 2, H, 2 * Z, brickMat);
  box(0, 0, -Z + 0.2, 2 * X, 1.1, 0.4, cobbleMat, 3); box(0, 0, Z - 0.2, 2 * X, 1.1, 0.4, cobbleMat, 3);
  box(-X + 0.2, 0, 0, 0.4, 1.1, 2 * Z - 0.8, cobbleMat, 3); box(X - 0.2, 0, 0, 0.4, 1.1, 2 * Z - 0.8, cobbleMat, 3);
  // east: steps + a wall-jump shaft up to a high ledge
  box(26, 0, 14, 5, 1.5, 5, cobbleMat, 3);
  box(26, 0, 8.5, 5, 3, 5, cobbleMat, 3);
  box(26, 0, 3, 5, 4.5, 5, cobbleMat, 3);
  box(21.5, 0, -9.5, 1, 10, 7, brickMat);
  box(25.5, 0, -9.5, 1, 10, 7, brickMat);
  box(23.5, 0, -15, 7, 7.5, 4, cobbleMat, 3);
  // west: the Kiln's toys
  hazard('lava', -23, 3, 12, 3.2);
  hazard('vent', -23, 13, 2.2, 2.2, { phase: 0 });
  hazard('crusher', -23, -8, 3, 3, { top: 7, phase: 1 });
  // a few cover blocks between the lanes
  box(-10, 0, 4, 3, 1.4, 1, brickMat); box(10, 0, 4, 3, 1.4, 1, brickMat);
  for (const t of [-18, 0, 18]) { torch(t, 4.5, -Z, 0, 1); torch(t, 4.5, Z, 0, -1); }
  for (const t of [-12, 12]) { torch(-X, 4.5, t, 1, 0); torch(X, 4.5, t, -1, 0); }
  // signs (labels follow whatever you're playing with right now)
  const L = (a) => `[${actLabel(a)}]`;
  wallSign(0, 6, -Z + 0.05, 0, 'TARGET DUMMIES', ['They never fight back, and stand up again when broken.', 'Mix your weapons: FRESH weapons earn more style.', 'Your HIT and DPS show at the top of the screen.']);
  wallSign(-15, 6, -Z + 0.05, 0, 'PARRY & COMBOS', [`${L('punch')} a glowing orb to PARRY it back.`, 'Shotgun FURNACE: ALT lobs a core. Shoot it!', 'Spawn SHOOTERS behind you to practise parries.']);
  wallSign(X - 0.05, 6.5, 8, -Math.PI / 2, 'MOVEMENT', [`${L('jump')} against a wall to WALL JUMP (3 per air).`, `Hold ${L('slide')} while running to SLIDE, jump out fast.`, `${L('slide')} in the air SLAMS · ${L('dash')} has i-frames.`]);
  wallSign(-X + 0.05, 6.5, 3, Math.PI / 2, "THE KILN'S TOYS", [`${L('dash')} across lava: it burns and bounces you.`, 'Vents flicker before they erupt.', 'Crushers shake before they drop. Lure enemies under!']);
  wallSign(0, 6, Z - 0.05, Math.PI, 'SPAWN PADS', [`Stand on a pad and press ${L('interact')}.`, 'Every gun, variant and arm is unlocked in here.', `Press a weapon key again for its variant · ${L('arm')} swaps arms.`]);
  // spawn pads along the south wall
  PRACTICE.pads = PRACTICE_PADS.map(([id, label, col], i) => {
    const x = -26 + i * (52 / (PRACTICE_PADS.length - 1)), z = 20.6;
    box(x, 0, z, 3.2, 0.08, 3.2, ironMat, 1, false);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 }));
    plate.rotation.x = -Math.PI / 2; plate.position.set(x, 0.1, z);
    levelGroup.add(plate);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(label, '#' + col.toString(16).padStart(6, '0'), id === 'god' ? 'OFF' : null), depthWrite: false }));
    spr.position.set(x, 2.4, z); spr.scale.set(3.2, 1, 1);
    levelGroup.add(spr);
    return { id, label, col, x, z, plate, spr, verb: id === 'clear' ? 'CLEAR ALL ENEMIES' : id === 'god' ? 'TOGGLE GOD MODE' : id === 'wave' ? 'SPAWN A MIXED WAVE' : 'SPAWN ' + label };
  });
}
const DUMMY_SPOTS = [['grunt', -12, -12], ['shooter', -6, -12], ['heavy', 0, -13], ['shield', 6, -12], ['priest', 12, -12], ['flyer', -7, -17, 4.5], ['flyer', 7, -17, 4.5]];
function spawnDummy(slot) {
  const e = makeEnemy(slot.type, slot.x, slot.z, slot.y || 0);
  e.dummy = true;
  slot.e = e; slot.t = 0;
}
function updateDummy(e, dt) {
  const p = e.mesh.position;
  const ty = Math.atan2(P.pos.x - p.x, P.pos.z - p.z);
  let d = ty - e.mesh.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  e.mesh.rotation.y += d * Math.min(1, dt * 3);
  if (e.def.fly) {
    p.addScaledVector(e.vel, dt); e.vel.multiplyScalar(Math.exp(-dt * 3));
    const k = Math.min(1, dt * 1.5);
    p.x += (e.home.x - p.x) * k; p.z += (e.home.z - p.z) * k;
    p.y += (e.home.y - 1 + Math.sin(G.time * 1.6 + e.orbit) * 0.35 - p.y) * Math.min(1, dt * 2);
    e.grounded = false;
  } else enemyPhysics(e, (e.home.x - p.x) * 2, (e.home.z - p.z) * 2, dt);
  animateEnemy(e, dt, false, 0, G.time);
  e.flash -= dt;
  applyFlash(e, 0);
}
function practiceHit(e, dmg) {
  PRACTICE.last = dmg;
  PRACTICE.hits.push([G.time, dmg]);
}
function practiceSpawn(type, n) {
  for (let i = 0; i < n; i++) {
    let x = 0, z = 0;
    for (let k = 0; k < 12; k++) { x = rand(-15, 15); z = rand(-6, 6); if (Math.hypot(x - P.pos.x, z - P.pos.z) > 9 && !levelCtx.blocked(x, z)) break; }
    makeEnemy(type, x, z, type === 'flyer' ? rand(4, 5.5) : 0);
  }
}
function padAction(pd) {
  PRACTICE.cd = 0.35;
  sfx.door();
  if (pd.id === 'clear') {
    for (const e of enemies) if (!e.dummy && !e.dead) { e.dead = true; scene.remove(e.mesh); removeEnemyFx(e); for (const mt of [...e.mats, ...e.extraMats]) mt.dispose(); }
    for (const o of orbs) scene.remove(o.m);
    orbs.length = 0;
    G.boss = null; show('bossBar', false); hideBeam();
    banner('CLEARED');
  } else if (pd.id === 'god') {
    PRACTICE.god = !PRACTICE.god;
    pd.spr.material.map.dispose();
    pd.spr.material.map = labelTexture(pd.label, '#4aff6a', PRACTICE.god ? 'ON' : 'OFF');
    banner(PRACTICE.god ? 'GOD MODE ON' : 'GOD MODE OFF');
  } else if (pd.id === 'wave') {
    for (const t of ['grunt', 'grunt', 'shooter', 'flyer', 'heavy', 'bomber']) practiceSpawn(t, 1);
  } else practiceSpawn(pd.id, { heavy: 1, sniper: 1, priest: 1, shield: 2, ram: 1, mender: 1, burrower: 2 }[pd.id] || 3);
}
function updatePractice(dt) {
  for (const slot of PRACTICE.slots) {
    if (slot.e && !slot.e.dead) continue;
    slot.t += dt;
    if (slot.t > 1.5) spawnDummy(slot);
  }
  while (PRACTICE.hits.length && G.time - PRACTICE.hits[0][0] > 3) PRACTICE.hits.shift();
  PRACTICE.hudT -= dt;
  if (PRACTICE.hudT <= 0) {
    PRACTICE.hudT = 0.2;
    const dps = PRACTICE.hits.reduce((s, h) => s + h[1], 0) / 3;
    $('wave').textContent = `PRACTICE · HIT ${Math.round(PRACTICE.last)} · DPS ${Math.round(dps)}${PRACTICE.god ? ' · GOD' : ''}`;
  }
  PRACTICE.cd -= dt;
  let near = null;
  for (const pd of PRACTICE.pads) {
    const on = Math.abs(P.pos.x - pd.x) < 1.7 && Math.abs(P.pos.z - pd.z) < 1.7 && P.pos.y < 1.2;
    pd.plate.material.opacity = on ? 0.65 + Math.sin(G.time * 8) * 0.2 : 0.35;
    if (on) near = pd;
  }
  if (near !== PRACTICE.near) {
    PRACTICE.near = near;
    if (near) $('prompt').textContent = `[${actLabel('interact')}] ${near.verb}`;
    $('prompt').classList.toggle('show', !!near);
  }
  if (near && PRACTICE.cd <= 0 && hit('interact')) padAction(near);
}
function startPractice() {
  initAudio();
  G.mode = 'practice'; G.level = null; G.layout = null;
  resetGame();
  clearLevelGeometry();
  setLook('pit');
  buildPractice();
  G.ceil = 11;
  G.spawn = new V3(0, 0, 16);
  P.pos.copy(G.spawn); P.yaw = 0;
  PRACTICE.god = false; PRACTICE.hits.length = 0; PRACTICE.last = 0; PRACTICE.near = undefined;
  PRACTICE.slots = DUMMY_SPOTS.map(([type, x, z, y]) => ({ type, x, z, y, e: null, t: 0 }));
  for (const s2 of PRACTICE.slots) spawnDummy(s2);
  enterPlay();
  banner('PRACTICE ROOM');
  showHint(`Spawn pads are behind you · press ${actLabel('interact')} on one`);
}
$('practiceBtn').addEventListener('click', startPractice);
if (touchActive()) setInput('touch');
