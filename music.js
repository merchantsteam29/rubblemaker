// =====================================================================
//  Procedural heavy-industrial soundtrack. Intensity 0..5 adds layers:
//  0 pad + pulse · 1 kick/hats · 2 bass + snare · 3 full chug + metal · 4 lead
//  5 RUBBLEMAKER: double-kick, octave bass, crash every bar, harmony lead
// =====================================================================

const THEMES = {
  menu: { tempo: 96, root: 40, prog: [0, 0, 3, -2], swing: 0 },
  cellar: { tempo: 128, root: 40, prog: [0, 0, 3, -2], bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 7, 12, 10] },
  cathedral: { tempo: 140, root: 38, prog: [0, -4, -2, -5], bass: [0, 12, 0, 0, 12, 0, 0, 12, 0, 0, 12, 0, 7, 0, 10, 12], organ: true },
  boss: { tempo: 158, root: 40, prog: [0, 1, 0, -2], bass: [0, 0, 0, 12, 0, 0, 1, 0, 0, 0, 0, 12, 0, 1, 0, 13] },
  kiln: { tempo: 146, root: 39, prog: [0, -2, -5, -7], bass: [0, 0, 12, 0, 1, 0, 12, 0, 0, 0, 12, 0, 13, 0, 12, 10] },
  aqueduct: { tempo: 132, root: 38, prog: [0, 5, 3, -2], bass: [0, 0, 7, 0, 12, 0, 7, 0, 0, 0, 7, 0, 10, 0, 12, 7], organ: true },
  pit: { tempo: 136, root: 41, prog: [0, 3, -2, -4], bass: [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 7, 0, 12, 0] },
};
const DEFAULT_BASS = [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 7, 12, 10];
const LEAD = [0, 3, 7, 12, 15, 12, 7, 3, 0, 3, 7, 10, 14, 10, 7, 3];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function createMusic(AC, out, noiseBuf) {
  const bus = AC.createGain();
  bus.gain.value = 0;
  // tone filter: opens up with the style rank, muffles when hurt / paused
  const toneLP = AC.createBiquadFilter(); toneLP.type = 'lowpass'; toneLP.frequency.value = 18000; toneLP.Q.value = 0.9;
  bus.connect(toneLP); toneLP.connect(out);

  // distorted bass chain
  const bassIn = AC.createGain(); bassIn.gain.value = 0.5;
  const shaper = AC.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 6) * 0.8; }
  shaper.curve = curve; shaper.oversample = '2x';
  const bassLP = AC.createBiquadFilter(); bassLP.type = 'lowpass'; bassLP.frequency.value = 900; bassLP.Q.value = 2;
  const bassOut = AC.createGain(); bassOut.gain.value = 0.32;
  bassIn.connect(shaper); shaper.connect(bassLP); bassLP.connect(bassOut); bassOut.connect(bus);

  // simple feedback delay for lead / metal
  const delay = AC.createDelay(1); const fb = AC.createGain(); const dWet = AC.createGain();
  fb.gain.value = 0.3; dWet.gain.value = 0.25;
  delay.connect(fb); fb.connect(delay); delay.connect(dWet); dWet.connect(bus);

  let theme = THEMES.menu, step = 0, nextTime = 0, intensity = 0, playing = false, fill = 0, sting = 0;

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function kick(t, v = 1) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    env(g, t, 0.002, 0.9 * v, 0.28);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.32);
    const n = AC.createBufferSource(); n.buffer = noiseBuf;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2500;
    const ng = AC.createGain(); env(ng, t, 0.001, 0.25 * v, 0.03);
    n.connect(f); f.connect(ng); ng.connect(bus); n.start(t); n.stop(t + 0.05);
  }
  function snare(t, v = 1) {
    const n = AC.createBufferSource(); n.buffer = noiseBuf;
    const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
    const g = AC.createGain(); env(g, t, 0.001, 0.55 * v, 0.18);
    n.connect(f); f.connect(g); g.connect(bus); n.start(t, Math.random()); n.stop(t + 0.22);
    const o = AC.createOscillator(), og = AC.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    env(og, t, 0.001, 0.35 * v, 0.1);
    o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.12);
  }
  function hat(t, v = 1, open = false) {
    const n = AC.createBufferSource(); n.buffer = noiseBuf;
    const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = AC.createGain(); env(g, t, 0.001, 0.16 * v, open ? 0.2 : 0.04);
    n.connect(f); f.connect(g); g.connect(bus); n.start(t, Math.random()); n.stop(t + 0.25);
  }
  function metal(t, v = 1) {
    for (const fr of [523, 1347, 2210]) {
      const o = AC.createOscillator(), g = AC.createGain(); o.type = 'square';
      o.frequency.value = fr * (0.98 + Math.random() * 0.04);
      env(g, t, 0.001, 0.05 * v, 0.25);
      o.connect(g); g.connect(bus); g.connect(delay); o.start(t); o.stop(t + 0.3);
    }
  }
  function bass(t, note, len, v = 1) {
    for (const det of [-8, 8]) {
      const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth';
      o.frequency.value = midi(note); o.detune.value = det;
      env(g, t, 0.004, 0.5 * v, len);
      o.connect(g); g.connect(bassIn); o.start(t); o.stop(t + len + 0.05);
    }
  }
  function crash(t, v = 1) {
    const n = AC.createBufferSource(); n.buffer = noiseBuf;
    const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4500;
    const g = AC.createGain(); env(g, t, 0.002, 0.22 * v, 1.1);
    n.connect(f); f.connect(g); g.connect(bus); g.connect(delay); n.start(t, Math.random() * 0.3); n.stop(t + 1.2);
  }
  function chord(t, root, len) {
    for (const n of [root, root + 7, root + 12]) bass(t, n, len, 0.7);
    crash(t, 1.2);
  }
  function lead(t, note, len) {
    const o = AC.createOscillator(), g = AC.createGain(); o.type = 'square';
    o.frequency.value = midi(note);
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    env(g, t, 0.005, 0.07, len);
    o.connect(f); f.connect(g); g.connect(bus); g.connect(delay); o.start(t); o.stop(t + len + 0.05);
  }
  function pad(t, root, dur, organ) {
    const notes = organ ? [root + 12, root + 19, root + 24, root + 27] : [root + 12, root + 15, root + 19];
    for (const n of notes) for (const det of [-10, 10]) {
      const o = AC.createOscillator(), g = AC.createGain(); o.type = organ ? 'square' : 'sawtooth';
      o.frequency.value = midi(n); o.detune.value = det;
      const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = organ ? 1400 : 700;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(organ ? 0.018 : 0.03, t + dur * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
    }
  }

  function schedule(t) {
    const s = step % 16, bar = Math.floor(step / 16) % 4;
    const root = theme.root + theme.prog[bar];
    const i = intensity;
    const sixteenth = 60 / theme.tempo / 4;
    if (s === 0) pad(t, root, sixteenth * 16, theme.organ);
    if (i === 0 && s % 4 === 0) bass(t, root, sixteenth * 1.5, 0.35);
    if (i >= 1) {
      if (s % 4 === 0) kick(t, s === 0 ? 1 : 0.85);
      if (i >= 3 && (s === 10 || s === 14 || s === 7)) kick(t, 0.6);
      if (s % 4 === 2) hat(t, 0.9, i >= 3 && s === 14);
      if (i >= 3 && s % 2 === 1) hat(t, 0.4);
    }
    if (i >= 2) {
      if (s === 4 || s === 12) snare(t);
      if (i >= 4 && s === 15) snare(t, 0.5);
      const pat = theme.bass || DEFAULT_BASS;
      const gated = i >= 3 || s % 2 === 0;
      if (gated) bass(t, root + pat[s], sixteenth * (i >= 3 ? 0.8 : 1.6), i >= 3 ? 1 : 0.8);
    }
    if (i >= 3 && (s === 6 || s === 14) && bar % 2 === 1) metal(t);
    if (i >= 4) lead(t, root + 24 + LEAD[(s + bar * 4) % 16], sixteenth * 0.9);
    if (i >= 5) {
      if (s % 2 === 1) kick(t, 0.5);
      if (s === 0) crash(t, 0.8);
      if (s % 4 === 0) bass(t, root + 12 + (theme.bass || DEFAULT_BASS)[s], sixteenth * 0.7, 0.55);
      if (s % 2 === 0) lead(t, root + 31 + LEAD[(s + bar * 4 + 2) % 16], sixteenth * 1.6);
    }
    // drum fill after the intensity rises
    if (fill > 0) { snare(t, 0.35 + (4 - fill) * 0.15); fill--; }
    if (sting) { chord(t, root, sixteenth * (sting > 1 ? 6 : 3)); if (sting > 1) lead(t, root + 36, sixteenth * 6); sting = 0; }
  }

  return {
    setTheme(name) {
      const nt = THEMES[name] || THEMES.menu;
      if (nt === theme) return;
      theme = nt;
      delay.delayTime.value = (60 / theme.tempo) * 0.75;
      step = Math.ceil(step / 16) * 16; // restart on a bar line
    },
    setIntensity(v) { const n = Math.max(0, Math.min(5, v | 0)); if (n > intensity && n >= 2 && playing) fill = 4; intensity = n; },
    setTone(hz) { toneLP.frequency.setTargetAtTime(hz, AC.currentTime, 0.25); },
    stinger(level = 1) { sting = level; },
    start() {
      if (playing) return;
      playing = true;
      nextTime = AC.currentTime + 0.1;
      bus.gain.cancelScheduledValues(AC.currentTime);
      bus.gain.setTargetAtTime(1, AC.currentTime, 0.3);
    },
    stop() {
      playing = false;
      bus.gain.setTargetAtTime(0, AC.currentTime, 0.2);
    },
    update() {
      if (!playing) return;
      if (nextTime < AC.currentTime - 0.5) nextTime = AC.currentTime + 0.05; // tab was hidden
      while (nextTime < AC.currentTime + 0.15) {
        schedule(nextTime);
        nextTime += 60 / theme.tempo / 4;
        step++;
      }
    },
  };
}
