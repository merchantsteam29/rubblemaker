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
  ['swap', 'Swap weapon', ['KeyQ']],
  ['interact', 'Use (FORGE)', ['KeyE']],
];

export const DIFFS = {
  easy: { label: 'EASY', dmg: 0.6, speed: 0.9, fire: 1.3 },
  normal: { label: 'NORMAL', dmg: 1, speed: 1, fire: 1 },
  hard: { label: 'HARD', dmg: 1.5, speed: 1.15, fire: 0.8 },
};

const defaultBinds = () => Object.fromEntries(ACTIONS.map(([id, , b]) => [id, b.slice()]));
export const DEFAULTS = {
  sens: 1, invertY: false, wheelSwap: true,
  fov: 95, quality: 'high', shake: 1, viewBob: true, fullscreen: true,
  master: 0.8, sfx: 0.8, music: 0.6,
  crosshair: 'cross', crossColor: '#ffffff', crossSize: 1, difficulty: 'normal', showFPS: false, hitmarkers: true,
  binds: defaultBinds(),
  ctrlFix: true,
};

const KEY = 'rubblemaker-settings';
function load() {
  const s = structuredClone(DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      for (const k in saved) if (k !== 'binds' && k in s) s[k] = saved[k];
      if (saved.binds) for (const id in s.binds) if (Array.isArray(saved.binds[id])) s.binds[id] = saved.binds[id].slice(0, 2);
      // one-time fix: Ctrl on slide made Ctrl+W close the tab
      if (!saved.ctrlFix) {
        s.binds.slide = s.binds.slide.map((c) => (c === 'ControlLeft' || c === 'ControlRight' ? null : c));
        if (!s.binds.slide.some(Boolean)) s.binds.slide = ['KeyC', null];
      }
    } else {
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
  const TABS = ['CONTROLS', 'MOUSE', 'VIDEO', 'AUDIO', 'GAMEPLAY'];
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
      CONTROLS: ['binds'], MOUSE: ['sens', 'invertY', 'wheelSwap'], VIDEO: ['fov', 'quality', 'shake', 'viewBob', 'fullscreen'],
      AUDIO: ['master', 'sfx', 'music'], GAMEPLAY: ['crosshair', 'crossColor', 'crossSize', 'difficulty', 'showFPS', 'hitmarkers'],
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
    }
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
  return { render, isCapturing: () => !!capture };
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
