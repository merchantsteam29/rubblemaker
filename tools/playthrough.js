// Auto-plays every level (plus pit, practice, training, codex) with a seeded RNG and reports a summary.
// Runs identically against the single-file build and the split build so the two can be diffed.
const seed = (n) => { let s = n | 0; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
window.requestAnimationFrame = () => 0;
renderer.render = () => {};
if (typeof composer === 'object' && composer) composer.render = () => {};
document.exitPointerLock = () => {}; HTMLElement.prototype.requestPointerLock = () => {};
let now = performance.now() + 1000;
const errs = [];
const step = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; try { frame(now); } catch (e) { errs.push(`${G.level ? G.level.id : G.mode}: ${e.message} | ${(e.stack || '').split('\n')[1]?.trim()}`); return false; } } return true; };
const killAll = () => { for (const e of enemies.slice()) { try { if (!e.dead) killEnemy(e, { src: 'test' }); } catch (err) { errs.push(`${G.level?.id} kill ${e.type}: ${err.message}`); e.hp = 0; } } };
const out = [];
const t0 = performance.now();
for (let idx = 0; idx < LEVELS.length; idx++) {
  const lv = LEVELS[idx];
  seed(1000 + idx);
  try { startLevel(idx); } catch (e) { errs.push(`${lv.id} start: ${e.message} | ${(e.stack || '').split('\n')[1]?.trim()}`); continue; }
  const r0 = { id: lv.id, rooms: G.layout ? G.layout.rooms.length : -1, types: new Set(), states: new Set(), done: false, ticks: 0 };
  let guard = 0;
  while (guard++ < 2500) {
    r0.states.add(G.state);
    if (G.state === 'cutscene') { cutAdvance(); step(4); continue; }
    if (G.state === 'complete') { r0.done = true; break; }
    if (G.state !== 'play') { step(2); if (G.state !== 'play' && G.state !== 'cutscene' && guard > 50) break; continue; }
    P.hp = 100; P.invuln = 1;
    const room = G.layout.rooms.find((r) => r.state !== 'clear' && r.waves && (r.waves.length || r.boss));
    if (room) { P.pos.set(room.cx, 0, room.cz); P.vel.set(0, 0, 0); }
    else if (G.portal) { P.pos.set(G.portal.x, 0, G.portal.z); }
    for (const e of enemies) r0.types.add(e.type);
    if (guard % 3 === 0) killAll();
    if (G.boss && G.boss.dead === undefined && guard % 30 === 0) { try { killEnemy(G.boss, { src: 'test' }); } catch (e) {} }
    if (!step(3)) break;
    r0.ticks += 3;
  }
  r0.types = [...r0.types].sort().join(','); r0.states = [...r0.states].sort().join(',');
  r0.clear = G.layout ? G.layout.rooms.filter((r) => r.state === 'clear').length : -1;
  r0.kills = G.kills;
  out.push(r0);
  try { toMenu(); } catch (e) { errs.push(`${lv.id} toMenu: ${e.message}`); }
  step(2);
}
// other modes
const modes = {};
const tryMode = (name, fn, frames) => { seed(77); try { fn(); } catch (e) { errs.push(`${name} start: ${e.message} | ${(e.stack || '').split('\n')[1]?.trim()}`); } let g = 0; while (g++ < frames) { if (G.state === 'cutscene') cutAdvance(); P.hp = 100; P.invuln = 1; if (g % 20 === 0) killAll(); if (!step(3)) break; } modes[name] = { state: G.state, mode: G.mode, wave: G.wave, kills: G.kills }; try { toMenu(); } catch (e) { errs.push(name + ' toMenu: ' + e.message); } step(2); };
tryMode('pit', startEndless, 1500);
tryMode('practice', startPractice, 300);
tryMode('tutorial', startTutorial, 300);
try { openCodex(); step(30); modes.codex = 'ok'; } catch (e) { errs.push('codex: ' + e.message); }
return { ms: Math.round(performance.now() - t0), levels: out.length, completed: out.filter((o) => o.done).length, notDone: out.filter((o) => !o.done).map((o) => `${o.id}(${o.clear}/${o.rooms} ${o.states})`), modes, errs: errs.slice(0, 40), errCount: errs.length, sig: out.map((o) => `${o.id}|${o.done}|${o.clear}/${o.rooms}|k${o.kills}|${o.types}`) };
