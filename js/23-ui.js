'use strict';
// ================================================================ BATCH 9.2: CHISELLED STONE UI — motion
// Screens set into place stone by stone when they open, and crumble into rubble + dust when they close.
// Pressing a slab knocks a few chips off it. Purely cosmetic: nothing here touches game state.
const UIFX = {
  layer: null,
  rects: new Map(),          // screen -> the slab rects to crumble from (measured while it is still visible)
  calm: matchMedia('(prefers-reduced-motion: reduce)'),
  MAX: 150,                  // live chips + puffs, all screens together
};
UIFX.layer = document.createElement('div');
UIFX.layer.id = 'rubbleFx';
document.body.appendChild(UIFX.layer);

const uiCalm = () => UIFX.calm.matches || document.hidden;

// the pieces a screen is "built" from: titles, slabs and panels that are on screen right now
function uiMeasure(screen) {
  if (screen.classList.contains('hidden')) return;
  const els = screen.querySelectorAll('h1, h2.title, button, .tablet, .panel, #completeStats, #completeRank, .item, .ach, .cxGun, .cxDetail');
  const H = innerHeight, W = innerWidth, out = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
    out.push({ x: r.left, y: r.top, w: r.width, h: r.height, big: /^H[12]$/.test(el.tagName) });
    if (out.length >= 26) break;
  }
  UIFX.rects.set(screen, out);
}

function uiChip(x, y, size, vx, vy, life) {
  const c = document.createElement('i');
  const w = size * (0.7 + Math.random() * 0.6), h = size * (0.55 + Math.random() * 0.5);
  // a random 5–6 sided shard
  const n = 5 + (Math.random() * 2 | 0), pts = [];
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + Math.random() * 0.6; const r = 0.62 + Math.random() * 0.38; pts.push(`${(50 + Math.cos(a) * 50 * r).toFixed(1)}% ${(50 + Math.sin(a) * 50 * r).toFixed(1)}%`); }
  c.style.cssText = `left:${x - w / 2}px;top:${y - h / 2}px;width:${w}px;height:${h}px;clip-path:polygon(${pts.join(',')});filter:brightness(${0.7 + Math.random() * 0.6})`;
  UIFX.layer.appendChild(c);
  const rot = (Math.random() - 0.5) * 720;
  const fall = vy + 280 + Math.random() * 260; // gravity carries every chip down past where it started
  const a = c.animate([
    { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
    { transform: `translate(${vx * 0.35}px, ${-Math.abs(vy) * 0.35 - 10}px) rotate(${rot * 0.25}deg)`, opacity: 1, offset: 0.18 },
    { transform: `translate(${vx}px, ${fall}px) rotate(${rot}deg)`, opacity: 0 },
  ], { duration: life, easing: 'cubic-bezier(.35,0,.85,.55)' });
  a.onfinish = a.oncancel = () => c.remove();
}
function uiDust(x, y, size, life) {
  const d = document.createElement('b');
  d.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px`;
  UIFX.layer.appendChild(d);
  const a = d.animate([
    { transform: 'scale(.35)', opacity: 0.9 },
    { transform: `translate(${(Math.random() - 0.5) * 40}px, ${-10 - Math.random() * 20}px) scale(1.7)`, opacity: 0 },
  ], { duration: life, easing: 'cubic-bezier(.2,.6,.4,1)' });
  a.onfinish = a.oncancel = () => d.remove();
}

function uiCrumble(rects) {
  if (uiCalm() || !rects || !rects.length) return;
  let budget = UIFX.MAX - UIFX.layer.childElementCount;
  if (budget < 12) return;
  const total = rects.reduce((s, r) => s + r.w * r.h, 0) || 1;
  for (const r of rects) {
    const share = Math.max(2, Math.round(((r.w * r.h) / total) * Math.min(budget * 0.8, 90)) + (r.big ? 6 : 0));
    for (let k = 0; k < share && budget > 0; k++, budget--) {
      const x = r.x + Math.random() * r.w, y = r.y + Math.random() * r.h;
      uiChip(x, y, r.big ? 10 + Math.random() * 16 : 5 + Math.random() * 10, (Math.random() - 0.5) * 160, Math.random() * 90, 700 + Math.random() * 520);
    }
    if (budget > 0 && (r.big || r.w > 160)) { uiDust(r.x + r.w * (0.25 + Math.random() * 0.5), r.y + r.h * 0.8, Math.min(220, 60 + r.w * 0.25), 650 + Math.random() * 300); budget--; }
  }
}

function uiEnter(screen) {
  if (uiCalm() || screen.id === 'menu') return;
  let i = 0;
  for (const ch of screen.children) {
    ch.style.setProperty('--si', Math.min(i++, 12));
    ch.style.setProperty('--sr', `${((Math.random() - 0.5) * 2.4).toFixed(2)}deg`);
  }
  screen.classList.remove('enter');
  void screen.offsetWidth; // restart the animation if it was already set
  screen.classList.add('enter');
  clearTimeout(screen._enterT);
  screen._enterT = setTimeout(() => { screen.classList.remove('enter'); uiMeasure(screen); }, 1100);
  setTimeout(() => uiMeasure(screen), 480);
}

// watch every screen for being shown / hidden, however the game does it
const uiObs = new MutationObserver((muts) => {
  for (const m of muts) {
    const el = m.target;
    const was = /(^|\s)hidden(\s|$)/.test(m.oldValue || '');
    const now = el.classList.contains('hidden');
    if (was && !now) uiEnter(el);
    else if (!was && now) { uiCrumble(UIFX.rects.get(el)); UIFX.rects.delete(el); }
  }
});
for (const s of document.querySelectorAll('.screen')) uiObs.observe(s, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });

// measure just before any input can close a screen (capture phase runs before the game's own handlers)
const uiMeasureOpen = () => { for (const s of document.querySelectorAll('.screen:not(.hidden)')) uiMeasure(s); };
addEventListener('pointerdown', uiMeasureOpen, true);
addEventListener('keydown', uiMeasureOpen, true);
addEventListener('resize', () => setTimeout(uiMeasureOpen, 200));
uiMeasureOpen();

// pressing a slab knocks a few chips off where you hit it
addEventListener('pointerdown', (e) => {
  if (uiCalm()) return;
  const b = e.target.closest && e.target.closest('.screen button, .lvl');
  if (!b || b.disabled || UIFX.layer.childElementCount > UIFX.MAX - 8) return;
  for (let k = 0; k < 5; k++) uiChip(e.clientX + (Math.random() - 0.5) * 16, e.clientY + (Math.random() - 0.5) * 10, 3 + Math.random() * 5, (Math.random() - 0.5) * 90, Math.random() * 40, 420 + Math.random() * 260);
}, true);
