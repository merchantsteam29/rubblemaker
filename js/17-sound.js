'use strict';
// ================================================================ SOUND OVERHAUL (batch 4.4c)
//  room reverb · 3D panning + wall occlusion · layered weapons · enemy voices · music ducking
var OUT = null;                 // when set, noise()/tone() route here (a spatial chain) instead of sfxBus
var LAYER = 0.5; // overall level of the layered one-shots below
var REV = null, revWet = null, revKey = '', crunch = null, comp = null, voicesLive = 0, chatterT = 3, beatT = 0;
const sRay = new THREE.Raycaster();
const REVERBS = { menu: [1.3, 0.1], cellar: [1.7, 0.2], cathedral: [3.6, 0.36], kiln: [1.1, 0.14], boss: [2.5, 0.26], pit: [2.0, 0.22] };

function audioFX() {
  if (!AC || REV) return;
  REV = AC.createConvolver();
  revWet = AC.createGain(); revWet.gain.value = 0;
  sfxBus.connect(revWet); revWet.connect(REV); REV.connect(master);
  // glue compressor so stacked gunfire punches instead of clipping
  comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.18;
  sfxBus.disconnect(); sfxBus.connect(comp); comp.connect(master); sfxBus.connect(revWet);
  // soft-clip bus that gives gunshots their crunch
  crunch = AC.createWaveShaper();
  const c = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; c[i] = Math.tanh(x * 3.2) * 0.85; }
  crunch.curve = c; crunch.oversample = '2x';
  crunch.connect(sfxBus);
  setReverb('menu');
}
function makeIR(sec) {
  const n = Math.floor(AC.sampleRate * sec), ir = AC.createBuffer(2, n, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3.2;
    // a few early reflections off the brick walls
    for (let k = 0; k < 6; k++) { const at = Math.floor(AC.sampleRate * (0.008 + k * 0.013 + Math.random() * 0.01)); if (at < n) d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.7 - k * 0.09); }
  }
  return ir;
}
function setReverb(key) {
  if (!REV || key === revKey) return;
  revKey = key;
  const [sec, wet] = REVERBS[key] || REVERBS.menu;
  REV.buffer = makeIR(sec);
  revWet.gain.cancelScheduledValues(AC.currentTime);
  revWet.gain.setTargetAtTime(wet, AC.currentTime, 0.4);
}
function setListener() {
  if (!AC) return;
  const L = AC.listener, p = camera.position, f = new V3(); camera.getWorldDirection(f);
  const u = new V3(0, 1, 0).applyQuaternion(camera.quaternion);
  if (L.positionX) {
    const t = AC.currentTime;
    L.positionX.setValueAtTime(p.x, t); L.positionY.setValueAtTime(p.y, t); L.positionZ.setValueAtTime(p.z, t);
    L.forwardX.setValueAtTime(f.x, t); L.forwardY.setValueAtTime(f.y, t); L.forwardZ.setValueAtTime(f.z, t);
    L.upX.setValueAtTime(u.x, t); L.upY.setValueAtTime(u.y, t); L.upZ.setValueAtTime(u.z, t);
  } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
}
// run fn with its sounds placed at world position p (panned, muffled behind walls / with distance)
function spatial(p, fn) {
  if (!AC || !p || !sfxBus || G.state === 'menu') return fn();
  const prev = OUT;
  const pos = p.clone ? p : new V3(p.x, p.y || 0, p.z);
  const d = camera.position.distanceTo(pos);
  if (d < 1.2) return fn();
  const pan = AC.createPanner();
  pan.panningModel = 'equalpower'; pan.distanceModel = 'linear'; pan.rolloffFactor = 0;
  if (pan.positionX) { pan.positionX.value = pos.x; pan.positionY.value = pos.y; pan.positionZ.value = pos.z; } else pan.setPosition(pos.x, pos.y, pos.z);
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass';
  let hz = Math.max(2600, 19000 - d * 260), gain = 1;
  if (d > 3 && worldMeshes.length) {
    const dir = pos.clone().sub(camera.position);
    sRay.set(camera.position, dir.normalize()); sRay.far = Math.max(0.1, d - 1.2);
    if (sRay.intersectObjects(worldMeshes, false).length) { hz = 750; gain = 0.6; }
  }
  lp.frequency.value = hz;
  const g = AC.createGain(); g.gain.value = gain;
  lp.connect(g); g.connect(pan); pan.connect(sfxBus);
  OUT = lp;
  try { fn(); } finally { OUT = prev; }
  setTimeout(() => { try { pan.disconnect(); } catch (_) {} }, 4000);
}
function sfxAt(p, name, ...args) { spatial(p, () => sfx[name](...args)); }

// richer one-shot helpers (delay, own destination)
function nz(dur, freq, vol, o = {}) {
  if (!AC || vol <= 0) return;
  vol *= LAYER;
  const t = AC.currentTime + (o.delay || 0);
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = o.q || 0.8;
  if (o.end) f.frequency.exponentialRampToValueAtTime(o.end, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.002)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(OUT || o.dest || sfxBus);
  src.start(t, Math.random() * 0.6); src.stop(t + dur + 0.02);
}
function tn(f1, f2, dur, vol, type = 'sine', o = {}) {
  if (!AC || vol <= 0) return;
  vol *= LAYER;
  const t = AC.currentTime + (o.delay || 0);
  const osc = AC.createOscillator(); osc.type = type;
  osc.frequency.setValueAtTime(f1, t); osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.003)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g); g.connect(OUT || o.dest || sfxBus);
  osc.start(t); osc.stop(t + dur + 0.02);
}
// music ducks under big hits so they land
function duck(a, hold = 0.12) {
  if (!musicBus) return;
  const g = musicBus.gain, t = AC.currentTime, base = settings.music;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(base * (1 - a), t + 0.025);
  g.setTargetAtTime(base, t + hold, 0.3);
}
const crumble = (n, vol, spread = 0.5, base = 0) => { for (let i = 0; i < n; i++) nz(0.05 + Math.random() * 0.08, 1200 + Math.random() * 3500, vol * (0.5 + Math.random() * 0.5), { type: 'bandpass', q: 3, delay: base + Math.random() * spread }); };

Object.assign(sfx, {
  revolver() {
    nz(0.025, 6500, 0.55, { type: 'highpass' });
    nz(0.14, 3000, 0.9, { end: 600, dest: crunch });
    tn(170, 45, 0.2, 0.75, 'sine');
    tn(240, 90, 0.08, 0.25, 'square', { dest: crunch });
    nz(0.5, 1000, 0.2, { end: 180, delay: 0.025 });
    nz(0.03, 3800, 0.13, { type: 'bandpass', q: 7, delay: 0.17 });
    duck(0.12, 0.05);
  },
  charged() {
    nz(0.03, 7000, 0.7, { type: 'highpass' });
    nz(0.55, 5200, 1.0, { end: 300, dest: crunch });
    tn(1700, 70, 0.5, 0.35, 'sawtooth', { dest: crunch });
    tn(110, 28, 0.8, 1.0, 'sine');
    nz(1.1, 1200, 0.32, { end: 120, delay: 0.04 });
    duck(0.35, 0.15);
  },
  shotgun() {
    nz(0.03, 5000, 0.7, { type: 'highpass' });
    nz(0.38, 2000, 1.2, { end: 220, dest: crunch });
    tn(95, 28, 0.5, 1.0, 'sine');
    tn(130, 50, 0.22, 0.45, 'sawtooth', { dest: crunch });
    nz(0.9, 750, 0.34, { end: 110, delay: 0.04 });
    // spent shells hitting the floor
    tn(3300, 2700, 0.05, 0.05, 'triangle', { delay: 0.42 }); tn(2900, 2500, 0.04, 0.04, 'triangle', { delay: 0.5 });
    duck(0.3, 0.1);
  },
  pump() { nz(0.05, 2200, 0.32, { type: 'bandpass', q: 3 }); tn(400, 200, 0.04, 0.12, 'square'); nz(0.06, 1500, 0.3, { type: 'bandpass', q: 3, delay: 0.09 }); tn(300, 160, 0.05, 0.12, 'square', { delay: 0.09 }); },
  punch() { nz(0.02, 5000, 0.35, { type: 'highpass' }); nz(0.14, 1000, 0.75, { end: 200, dest: crunch }); tn(150, 40, 0.16, 0.8, 'sine'); crumble(3, 0.12, 0.08); },
  parry() { tn(1300, 1900, 0.35, 0.35, 'triangle'); tn(2000, 2600, 0.3, 0.2, 'sine', { delay: 0.04 }); tn(3950, 3900, 0.6, 0.06, 'sine'); nz(0.15, 6000, 0.3, { type: 'highpass' }); tn(90, 40, 0.3, 0.6); duck(0.4, 0.2); },
  explode() {
    nz(0.04, 6000, 0.8, { type: 'highpass' });
    nz(0.6, 1800, 1.3, { end: 120, dest: crunch });
    tn(70, 20, 1.2, 1.1, 'sine');
    tn(120, 35, 0.4, 0.5, 'sawtooth', { dest: crunch });
    nz(1.8, 420, 0.55, { end: 40, delay: 0.05, a: 0.05 });
    crumble(9, 0.16, 0.9, 0.15);
    duck(0.55, 0.25);
  },
  kill() {
    nz(0.22, 2000, 0.5, { end: 300, dest: crunch });
    tn(200, 55, 0.22, 0.45, 'sine');
    crumble(6, 0.17, 0.35);
    nz(0.5, 600, 0.2, { end: 90, delay: 0.05 });
  },
  slam() {
    nz(0.05, 4000, 0.7, { type: 'highpass' });
    nz(0.7, 700, 1.3, { end: 45, dest: crunch });
    tn(65, 20, 0.8, 1.1, 'sine');
    crumble(8, 0.15, 0.6, 0.08);
    duck(0.5, 0.2);
  },
  heavySlam(v) { nz(0.65, 450, 1.0 * v, { end: 40, dest: crunch }); tn(55, 22, 0.6, 0.9 * v); crumble(4, 0.1 * v, 0.4, 0.05); },
  nail() { nz(0.045, 4200, 0.2, { type: 'bandpass', q: 3 }); tn(1500, 900, 0.035, 0.05, 'square'); tn(180, 80, 0.04, 0.12); },
  hurt() { tn(190, 80, 0.3, 0.55, 'sawtooth', { dest: crunch }); nz(0.22, 600, 0.45); tn(60, 30, 0.3, 0.6); duck(0.3, 0.1); },
  heartbeat(v) { tn(70, 40, 0.12, 0.5 * v); tn(60, 35, 0.14, 0.4 * v, 'sine', { delay: 0.17 }); },
});

// ---------------------------------------------------------------- enemy voices
// [pitch Hz, formant 1, formant 2, growl 0..1, length s, waveform]
const VOICES = {
  grunt: [92, 620, 1080, 0.55, 0.34], shooter: [138, 720, 1500, 0.35, 0.3], flyer: [430, 1000, 2700, 0.2, 0.24, 'sawtooth'],
  heavy: [52, 380, 760, 0.85, 0.55], shield: [84, 560, 980, 0.5, 0.36], sniper: [122, 480, 1700, 0.15, 0.3],
  bomber: [104, 900, 2200, 0.7, 0.3], priest: [128, 520, 860, 0.05, 0.6, 'square'], ram: [68, 420, 820, 0.9, 0.45],
  burrower: [76, 340, 1200, 0.7, 0.36], mender: [190, 680, 2100, 0.05, 0.3, 'sawtooth'], swarmling: [640, 1500, 3200, 0, 0.1, 'square'],
  cat: [560, 900, 2200, 0, 0.32, 'sawtooth'], boss1: [46, 330, 680, 0.9, 0.8], boss2: [70, 520, 900, 0.4, 0.7, 'square'], boss3: [40, 300, 640, 1, 0.9],
  shard: [260, 820, 2600, 0, 0.4, 'square'], bertha: [80, 600, 1000, 0.6, 0.45], kite: [210, 760, 1900, 0.2, 0.3],
};
function voiceOf(e) { return VOICES[e.type] || VOICES[e.animType] || (e.def.boss ? VOICES.boss1 : VOICES.grunt); }
function voice(e, kind) {
  if (!AC || !e || !e.mesh || e.dummy || G.state !== 'play' && G.state !== 'cutscene') return;
  if (voicesLive >= 4 && kind !== 'die') return;
  if (kind !== 'die' && G.time - (e.vT || -9) < (kind === 'hurt' ? 0.7 : 1.5)) return;
  if (e.type === 'swarmling' && Math.random() < (kind === 'die' ? 0.6 : 0.9)) return;
  const pos = e.mesh.position.clone(); pos.y += (e.def.h || 1.8) * 0.8;
  const v = distVol(pos); if (v < 0.12) return;
  e.vT = G.time;
  const [f0, f1, f2, growl, len0, wave] = voiceOf(e);
  const jit = 0.9 + Math.random() * 0.2;
  const len = len0 * ({ alert: 1, hurt: 0.55, die: 1.7, idle: 0.9 }[kind] || 1);
  // pitch contour per kind: [start, peak, end] multipliers
  const C = { alert: [1, 1.35, 0.85], hurt: [1.7, 1.5, 1.05], die: [1.45, 1.2, 0.62], idle: [0.95, 1.08, 0.9] }[kind] || [1, 1, 1];
  voicesLive++;
  setTimeout(() => { voicesLive--; }, len * 1000 + 50);
  spatial(pos, () => {
    const t = AC.currentTime, out = OUT || sfxBus;
    const o = AC.createOscillator(); o.type = wave || 'sawtooth';
    o.frequency.setValueAtTime(f0 * C[0] * jit, t);
    o.frequency.linearRampToValueAtTime(f0 * C[1] * jit, t + len * 0.3);
    o.frequency.exponentialRampToValueAtTime(f0 * C[2] * jit, t + len);
    // vibrato makes it sound alive
    const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 5 + Math.random() * 3; lg.gain.value = f0 * 0.04;
    lfo.connect(lg); lg.connect(o.frequency);
    const amp = AC.createGain(); const peak = 0.3 * v * LAYER * 1.6 * (kind === 'die' ? 1.4 : 1);
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + 0.02); amp.gain.setValueAtTime(peak, t + len * 0.6); amp.gain.exponentialRampToValueAtTime(0.001, t + len);
    // growl: amplitude flutter
    if (growl > 0) {
      const gl = AC.createOscillator(), gg = AC.createGain(); gl.type = 'square'; gl.frequency.value = 24 + Math.random() * 14; gg.gain.value = peak * growl * 0.5;
      gl.connect(gg); gg.connect(amp.gain); gl.start(t); gl.stop(t + len + 0.05);
    }
    // two vowel formants (they slide a little for a 'word')
    const fbank = [];
    for (const [ff, q, gv] of [[f1, 5, 1], [f2, 7, 0.6]]) {
      const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(ff * jit, t); bp.frequency.linearRampToValueAtTime(ff * jit * (kind === 'die' ? 0.7 : 1.15), t + len);
      const fg = AC.createGain(); fg.gain.value = gv * 2.2;
      o.connect(bp); bp.connect(fg); fg.connect(amp); fbank.push(bp);
    }
    if (growl > 0.3) nz(len, f1, 0.12 * v * growl, { type: 'bandpass', q: 2 });
    amp.connect(out);
    // octave-up double so deep voices keep their body
    const o2 = AC.createOscillator(); o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(f0 * C[0] * jit * 2, t); o2.frequency.linearRampToValueAtTime(f0 * C[1] * jit * 2, t + len * 0.3); o2.frequency.exponentialRampToValueAtTime(f0 * C[2] * jit * 2, t + len);
    const o2g = AC.createGain(); o2g.gain.value = f0 < 120 ? 0.6 : 0.2; o2.connect(o2g);
    for (const bp of fbank) o2g.connect(bp);
    o.start(t); o.stop(t + len + 0.05); lfo.start(t); lfo.stop(t + len + 0.05); o2.start(t); o2.stop(t + len + 0.05);
  });
}
function voiceSoon(e, kind, delay) { setTimeout(() => { if (!e.dead) voice(e, kind); }, delay * 1000 * (0.6 + Math.random() * 0.8)); }

// per-frame: listener, reverb per room, idle chatter, low-HP heartbeat
var tickLast = 0;
function tickAudio(theme) {
  const now = performance.now(), dt = Math.min(0.1, (now - (tickLast || now)) / 1000); tickLast = now;
  if (!AC) return;
  audioFX();
  setListener();
  setReverb(theme);
  if (G.state !== 'play') return;
  chatterT -= dt;
  if (chatterT <= 0) {
    chatterT = 4 + Math.random() * 4;
    const near = enemies.filter((e) => !e.dead && e.spawnT <= 0 && e.mesh.position.distanceTo(P.pos) < 32);
    if (near.length) voice(near[(Math.random() * near.length) | 0], 'idle');
  }
  if (P.hp > 0 && P.hp < 30) {
    beatT -= dt;
    if (beatT <= 0) { beatT = 0.55 + P.hp / 60; sfx.heartbeat(1 - P.hp / 40); }
  } else beatT = 0;
}
