// =====================================================================
//  Settings: persisted options, rebindable controls, and the settings UI
// =====================================================================

export const ACTIONS = [
  ['forward', 'Move forward', ['KeyW']],
  ['back', 'Move back', ['KeyS']],
  ['left', 'Strafe left', ['KeyA']],
  ['right', 'Strafe right', ['KeyD']],
  ['jump', 'Jump / wall jump', ['Space']],
  ['dash', 'Dash', ['ShiftLeft']],
  ['slide', 'Slide / ground slam', ['KeyC']],
  ['fire', 'Fire', ['Mouse0']],
  ['alt', 'Alt fire', ['Mouse2']],
  ['punch', 'Punch / parry', ['KeyF']],
  ['weapon1', 'Revolver', ['Digit1']],
  ['weapon2', 'Shotgun', ['Digit2']],
  ['weapon3', 'Nailgun', ['Digit3']],
  ['swap', 'Swap weapon', ['KeyQ']],
  ['arm', 'Switch arm', ['KeyG']],
  ['interact', 'Use (FORGE)', ['KeyE']],
  ['inspect', 'Inspect weapon', ['KeyR']],
];

export const DIFFS = {
  easy: { label: 'EASY', dmg: 0.5, speed: 0.9, fire: 1.3, hp: 0.8, scrap: 0.75, heal: 1.3 },
  normal: { label: 'NORMAL', dmg: 1, speed: 1, fire: 1, hp: 1, scrap: 1, heal: 1 },
  hard: { label: 'HARD', dmg: 1.4, speed: 1.12, fire: 0.82, hp: 1.15, scrap: 1.3, heal: 0.9 },
  brutal: { label: 'BRUTAL', dmg: 1.85, speed: 1.25, fire: 0.65, hp: 1.3, scrap: 1.7, heal: 0.8 },
};

const defaultBinds = () => Object.fromEntries(ACTIONS.map(([id, , b]) => [id, b.slice()]));
// standard gamepad layout: 0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT · 8 VIEW · 9 MENU · 10 L3 · 11 R3 · 12-15 D-pad
export const PAD_DEFAULTS = { jump: 0, slide: 1, interact: 2, swap: 3, dash: 4, punch: 5, alt: 6, fire: 7, inspect: 8, arm: 11, weapon1: 14, weapon2: 12, weapon3: 15 };
export const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'L3', 'R3', 'D-PAD ↑', 'D-PAD ↓', 'D-PAD ←', 'D-PAD →', 'HOME'];
export const padLabel = (b) => (b == null ? '—' : PAD_NAMES[b] || 'B' + b);
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
export const DEFAULTS = {
  sens: 1, invertY: false, wheelSwap: true,
  fov: 95, quality: 'high', shake: 1, viewBob: true, fullscreen: true, effects: true, killcam: true, gore: true,
  master: 0.8, sfx: 0.8, music: 0.6,
  crosshair: 'cross', crossColor: '#ffffff', crossSize: 1, difficulty: 'normal', showFPS: false, hitmarkers: true,
  binds: defaultBinds(),
  ctrlFix: true,
  skin: 'steel',
  padBinds: { ...PAD_DEFAULTS }, padSens: 1, padInvert: false, padDeadzone: 0.15, aimAssist: 0.5, rumble: true,
  touchControls: 'auto', touchSens: 1, touchOpacity: 0.55,
};

const KEY = 'rubblemaker-settings';
function load() {
  const s = structuredClone(DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      for (const k in saved) if (k !== 'binds' && k !== 'padBinds' && k in s) s[k] = saved[k];
      if (saved.padBinds) for (const id in s.padBinds) if (id in saved.padBinds) s.padBinds[id] = saved.padBinds[id];
      if (saved.binds) for (const id in s.binds) if (Array.isArray(saved.binds[id])) s.binds[id] = saved.binds[id].slice(0, 2);
      // one-time fix: Ctrl on slide made Ctrl+W close the tab
      if (!saved.ctrlFix) {
        s.binds.slide = s.binds.slide.map((c) => (c === 'ControlLeft' || c === 'ControlRight' ? null : c));
        if (!s.binds.slide.some(Boolean)) s.binds.slide = ['KeyC', null];
      }
    } else {
      if (coarse) { s.quality = 'low'; s.fov = 90; } // phones: start light
      const oldSens = Number(localStorage.getItem('rubblemaker-sens'));
      if (oldSens) s.sens = oldSens;
    }
  } catch (_) {}
  return s;
}
export const settings = load();
export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {}
}

const NAMES = {
  Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'MOUSE 4', Mouse4: 'MOUSE 5',
  Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT', AltRight: 'R-ALT', Tab: 'TAB', CapsLock: 'CAPS', Enter: 'ENTER', Backquote: '`',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
};
export function keyLabel(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
}

// ---------------------------------------------------------------- UI
// root: container element. onChange(key) is called after any change.
export function initSettingsUI(root, onChange, onBack) {
  const TABS = ['CONTROLS', 'CONTROLLER', 'MOUSE', 'TOUCH', 'VIDEO', 'AUDIO', 'GAMEPLAY'];
  let tab = 'CONTROLS';
  let capture = null; // {id, slot, btn}

  root.innerHTML = `
    <h2>SETTINGS</h2>
    <div class="tabs">${TABS.map((t) => `<button data-tab="${t}">${t}</button>`).join('')}</div>
    <div class="panel"></div>
    <div class="row-buttons"><button class="reset">RESET TAB</button><button class="back">BACK</button></div>`;
  const panel = root.querySelector('.panel');
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
  root.querySelector('.back').addEventListener('click', () => { stopCapture(); onBack(); });
  root.querySelector('.reset').addEventListener('click', () => {
    const keysFor = {
      CONTROLS: ['binds'], CONTROLLER: ['padBinds', 'padSens', 'padInvert', 'padDeadzone', 'aimAssist', 'rumble'], TOUCH: ['touchControls', 'touchSens', 'touchOpacity'], MOUSE: ['sens', 'invertY', 'wheelSwap'], VIDEO: ['fov', 'quality', 'shake', 'viewBob', 'fullscreen', 'effects', 'killcam'],
      AUDIO: ['master', 'sfx', 'music'], GAMEPLAY: ['crosshair', 'crossColor', 'crossSize', 'difficulty', 'showFPS', 'hitmarkers', 'gore'],
    }[tab];
    for (const k of keysFor) { settings[k] = structuredClone(DEFAULTS[k]); onChange(k); }
    saveSettings(); render();
  });

  const set = (k, v) => { settings[k] = v; saveSettings(); onChange(k); };

  function slider(label, k, min, max, step, fmt = (v) => v) {
    const row = el(`<div class="opt"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${settings[k]}"><span class="val">${fmt(settings[k])}</span></div>`);
    const inp = row.querySelector('input'), val = row.querySelector('.val');
    inp.addEventListener('input', () => { const v = Number(inp.value); val.textContent = fmt(v); set(k, v); });
    return row;
  }
  function toggle(label, k) {
    const row = el(`<div class="opt"><label>${label}</label><button class="tog ${settings[k] ? 'on' : ''}">${settings[k] ? 'ON' : 'OFF'}</button></div>`);
    const b = row.querySelector('button');
    b.addEventListener('click', () => { set(k, !settings[k]); b.classList.toggle('on', settings[k]); b.textContent = settings[k] ? 'ON' : 'OFF'; });
    return row;
  }
  function choice(label, k, opts) {
    const row = el(`<div class="opt"><label>${label}</label><div class="choices">${opts.map(([v, t]) => `<button data-v="${v}" class="${settings[k] === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>`);
    row.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      set(k, b.dataset.v);
      row.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    }));
    return row;
  }
  function color(label, k) {
    const row = el(`<div class="opt"><label>${label}</label><input type="color" value="${settings[k]}"></div>`);
    row.querySelector('input').addEventListener('input', (e) => set(k, e.target.value));
    return row;
  }

  function render() {
    stopCapture();
    root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    panel.innerHTML = '';
    if (tab === 'CONTROLS') {
      panel.appendChild(el('<p class="hint">Click a slot, then press a key or mouse button. ESC cancels, BACKSPACE clears.</p>'));
      for (const [id, label] of ACTIONS) {
        const row = el(`<div class="opt bind"><label>${label}</label><div class="slots"><button data-slot="0"></button><button data-slot="1"></button></div></div>`);
        row.querySelectorAll('button').forEach((b) => {
          const slot = Number(b.dataset.slot);
          b.textContent = keyLabel(settings.binds[id][slot]);
          b.classList.toggle('empty', !settings.binds[id][slot]);
          b.addEventListener('click', () => startCapture(id, slot, b));
        });
        panel.appendChild(row);
      }
    } else if (tab === 'CONTROLLER') {
      panel.appendChild(el('<p class="hint">Plug in any Xbox / PlayStation / standard pad and press a button. Click a slot, then press a pad button to rebind. Left stick moves, right stick looks, MENU pauses. In menus: D-pad / stick to move, A to pick, B to go back.</p>'));
      panel.appendChild(slider('Look sensitivity', 'padSens', 0.2, 3, 0.05, (v) => v.toFixed(2)));
      panel.appendChild(toggle('Invert Y', 'padInvert'));
      panel.appendChild(slider('Stick deadzone', 'padDeadzone', 0.05, 0.4, 0.01, (v) => `${Math.round(v * 100)}%`));
      panel.appendChild(slider('Aim assist (pad + touch)', 'aimAssist', 0, 1, 0.05, (v) => (v ? `${Math.round(v * 100)}%` : 'OFF')));
      panel.appendChild(toggle('Rumble', 'rumble'));
      for (const [id, label] of ACTIONS) {
        if (!(id in PAD_DEFAULTS)) continue;
        const row = el(`<div class="opt bind"><label>${label}</label><div class="slots"><button data-pad="${id}"></button></div></div>`);
        const b = row.querySelector('button');
        b.textContent = padLabel(settings.padBinds[id]);
        b.classList.toggle('empty', settings.padBinds[id] == null);
        b.addEventListener('click', () => startPadCapture(id, b));
        panel.appendChild(row);
      }
    } else if (tab === 'TOUCH') {
      panel.appendChild(el('<p class="hint">On-screen controls for phones and tablets: touch the left side for a floating move stick, drag anywhere on the right to look. You can drag FIRE to aim while shooting.</p>'));
      panel.appendChild(choice('Touch controls', 'touchControls', [['auto', 'AUTO'], ['on', 'ALWAYS'], ['off', 'OFF']]));
      panel.appendChild(slider('Touch look sensitivity', 'touchSens', 0.2, 3, 0.05, (v) => v.toFixed(2)));
      panel.appendChild(slider('Button opacity', 'touchOpacity', 0.15, 1, 0.05, (v) => `${Math.round(v * 100)}%`));
      panel.appendChild(slider('Aim assist (pad + touch)', 'aimAssist', 0, 1, 0.05, (v) => (v ? `${Math.round(v * 100)}%` : 'OFF')));
    } else if (tab === 'MOUSE') {
      panel.appendChild(slider('Sensitivity', 'sens', 0.1, 4, 0.05, (v) => v.toFixed(2)));
      panel.appendChild(toggle('Invert Y', 'invertY'));
      panel.appendChild(toggle('Mouse wheel swaps weapon', 'wheelSwap'));
    } else if (tab === 'VIDEO') {
      panel.appendChild(slider('Field of view', 'fov', 70, 120, 1, (v) => `${v}°`));
      panel.appendChild(choice('Graphics quality', 'quality', [['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']]));
      panel.appendChild(slider('Screen shake', 'shake', 0, 2, 0.05, (v) => `${Math.round(v * 100)}%`));
      panel.appendChild(toggle('View bob', 'viewBob'));
      panel.appendChild(toggle('Fullscreen + key lock (stops Ctrl+W closing the tab)', 'fullscreen'));
      panel.appendChild(toggle('Screen effects (flashes, chromatic shake)', 'effects'));
      panel.appendChild(toggle('Slow-mo kill-cam', 'killcam'));
    } else if (tab === 'AUDIO') {
      panel.appendChild(slider('Master volume', 'master', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`));
      panel.appendChild(slider('Sound effects', 'sfx', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`));
      panel.appendChild(slider('Music', 'music', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`));
    } else {
      panel.appendChild(choice('Difficulty', 'difficulty', Object.entries(DIFFS).map(([k, d]) => [k, d.label])));
      panel.appendChild(choice('Crosshair', 'crosshair', [['cross', 'CROSS'], ['dot', 'DOT'], ['circle', 'CIRCLE'], ['crossdot', 'CROSS+DOT'], ['none', 'NONE']]));
      panel.appendChild(color('Crosshair color', 'crossColor'));
      panel.appendChild(slider('Crosshair size', 'crossSize', 0.5, 2.5, 0.05, (v) => `${Math.round(v * 100)}%`));
      panel.appendChild(toggle('Hitmarkers', 'hitmarkers'));
      panel.appendChild(toggle('Show FPS', 'showFPS'));
      panel.appendChild(toggle('Gore, blood & rubble', 'gore'));
    }
  }

  let padCap = null;
  function startPadCapture(id, btn) {
    stopCapture();
    btn.textContent = 'PRESS A BUTTON…';
    btn.classList.add('listening');
    const start = performance.now();
    const held = new Set();
    const findPad = () => (navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null);
    const first = findPad();
    if (first) first.buttons.forEach((b, i) => { if (b.pressed) held.add(i); });
    padCap = { id, btn, raf: 0 };
    const tick = () => {
      if (!padCap) return;
      const gp = findPad();
      if (gp) {
        for (let i = 0; i < gp.buttons.length; i++) {
          const p = gp.buttons[i].pressed || gp.buttons[i].value > 0.5;
          if (!p) { held.delete(i); continue; }
          if (held.has(i) || i === 9) continue;
          for (const other in settings.padBinds) if (settings.padBinds[other] === i && other !== id) settings.padBinds[other] = null;
          settings.padBinds[id] = i;
          saveSettings(); onChange('padBinds');
          padCap = null; render();
          return;
        }
      }
      if (performance.now() - start > 6000) { padCap = null; render(); return; }
      padCap.raf = requestAnimationFrame(tick);
    };
    padCap.raf = requestAnimationFrame(tick);
  }
  function startCapture(id, slot, btn) {
    stopCapture();
    capture = { id, slot, btn };
    btn.textContent = 'PRESS…';
    btn.classList.add('listening');
    setTimeout(() => {
      if (!capture) return;
      addEventListener('keydown', onKey, true);
      addEventListener('mousedown', onMouse, true);
    }, 0);
  }
  function stopCapture() {
    if (padCap) { cancelAnimationFrame(padCap.raf); padCap.btn.classList.remove('listening'); padCap = null; }
    removeEventListener('keydown', onKey, true);
    removeEventListener('mousedown', onMouse, true);
    if (capture) { capture.btn.classList.remove('listening'); capture = null; }
  }
  function assign(code) {
    const { id, slot } = capture;
    if (code) for (const other in settings.binds) {
      settings.binds[other] = settings.binds[other].map((c, i) => (c === code && !(other === id && i === slot) ? null : c));
    }
    const arr = settings.binds[id];
    arr[slot] = code;
    settings.binds[id] = [arr[0] || null, arr[1] || null];
    saveSettings(); onChange('binds');
    capture = null;
    render();
  }
  function onKey(e) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === 'Escape') { const c = capture; stopCapture(); render(); return c; }
    if (e.code === 'Backspace' || e.code === 'Delete') { stopCaptureListeners(); assign(null); return; }
    stopCaptureListeners();
    assign(e.code);
  }
  function onMouse(e) {
    e.preventDefault(); e.stopImmediatePropagation();
    stopCaptureListeners();
    assign('Mouse' + e.button);
  }
  function stopCaptureListeners() {
    removeEventListener('keydown', onKey, true);
    removeEventListener('mousedown', onMouse, true);
  }

  render();
  return { render, isCapturing: () => !!capture || !!padCap };
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
