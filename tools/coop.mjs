// node tools/coop.mjs <url> — two headless Chromes join one MASON'S LODGE over real PeerJS and play co-op.
// Each page ticks itself in real time (render stubbed). Prints a step log with checks, then every page error.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const [, , url] = process.argv;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kids = [], profs = [];
async function openPage(tag) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const prof = path.join(process.env.TEMP || '.', 'rbm-coop-' + port); profs.push(prof);
  kids.push(spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--autoplay-policy=no-user-gesture-required',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1280,720', '--no-first-run', 'about:blank'], { stdio: 'ignore' }));
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const errs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errs.push(`${tag} EXCEPTION ${d.exception?.description?.split('\n').slice(0, 3).join(' | ') || d.text}`); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(`${tag} console.error: ` + m.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (js) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${js} })()`, awaitPromise: true, returnByValue: true, timeout: 60000 });
    if (r.result?.exceptionDetails) return 'ERR ' + (r.result.exceptionDetails.exception?.description || '').split('\n')[0];
    return r.result?.result?.value;
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url });
  return { tag, ev, errs, ws };
}
const A = await openPage('HOST'), B = await openPage('JOIN');
await sleep(9000);
const SETUP = `
  renderer.render = () => {}; if (typeof composer === 'object' && composer) composer.render = () => {};
  window.requestAnimationFrame = () => 0;
  document.exitPointerLock = () => {}; HTMLElement.prototype.requestPointerLock = () => {};
  try { localStorage.setItem('rubblemaker-vs', '1'); } catch (_) {}
  window.__tick = setInterval(() => { try { frame(performance.now()); } catch (e) { (window.__fe = window.__fe || []).push(e.message + ' | ' + (e.stack || '').split('\\n')[1]); } }, 33);
  window.idx = (id) => LEVELS.findIndex((l) => l.id === id);
  window.fightRoom = () => G.layout && G.layout.rooms.find((r) => r.state !== 'clear' && r.waves && (r.waves.length || r.boss));
  window.live = () => enemies.filter((e) => !e.dead);
  window.killMine = () => { for (const e of live()) killEnemy(e, { weapon: 'revolver' }); };
  return 'ok';`;
const log = [];
const check = (name, ok, info) => { log.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info !== undefined ? '  ·  ' + JSON.stringify(info) : ''}`); };
const waitFor = async (P, js, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await P.ev(`return !!(${js});`); if (v === true) return true; await sleep(250); } return false; };
const both = (js) => Promise.all([A.ev(js), B.ev(js)]);

check('setup', (await both(SETUP)).every((v) => v === 'ok'));
// ---- lodge
await A.ev(`saveProgress(Object.assign(loadProgress(), { unlocked: 99 })); openVersus(); vsSetMode('coop'); vsHost(); return 1;`);
check('host peer open', await waitFor(A, `VS.peer && VS.peer.open && VS.code`, 20000));
const code = await A.ev(`return VS.code;`);
await B.ev(`openVersus(); $('vsCode').value = '${code}'; vsJoin(); return 1;`);
check('both connected', (await waitFor(A, `VS.connected`, 20000)) && (await waitFor(B, `VS.connected && VS.mode === 'coop'`, 10000)));
check('lodge titles', true, await both(`return [document.querySelector('#versus h2').textContent, $('vsStart').textContent, $('vsStatus').textContent, document.querySelector('#vsModes .on')?.dataset.mode, $('vsLevel').options.length];`));
// ---- level 0-2
await A.ev(`$('vsLevel').value = String(idx('0-2')); coStart(); return 1;`);
check('partner followed into 0-2', await waitFor(B, `CO.active && G.state === 'play' && G.level && G.level.id === '0-2'`));
await sleep(1500);
check('both see the other golem', true, await both(`return [!!CO.mate.pos, CO.mate.mesh && CO.mate.mesh.visible, G.modDiff && G.modDiff === DIFFS[CO.diff]];`));
// host walks into the first fight
await A.ev(`const r = fightRoom(); P.pos.set(r.cx, 0, r.cz); P.vel.set(0,0,0); return G.layout.rooms.indexOf(r);`);
await sleep(3500);
const room1 = await both(`const r = G.layout.rooms.find((x) => x.state === 'active'); return { room: r ? G.layout.rooms.indexOf(r) : -1, inside: r ? insideRoom(r, 0.5) : false, n: live().length, nids: live().map((e) => e.nid).sort((a,b)=>a-b).join(',') };`);
check('room active on both, partner pulled in', room1[0].room >= 0 && room1[0].room === room1[1].room && room1[1].inside, room1);
check('same enemies (nids) on both', room1[0].nids === room1[1].nids && room1[0].n > 0, [room1[0].nids, room1[1].nids]);
await sleep(1500);
const drift = await Promise.all([A.ev(`return live().map((e) => [e.nid, e.mesh.position.x, e.mesh.position.z]);`), B.ev(`return live().map((e) => [e.nid, e.mesh.position.x, e.mesh.position.z]);`)]);
const dd = drift[0].map(([n, x, z]) => { const o = drift[1].find((q) => q[0] === n); return o ? Math.hypot(o[1] - x, o[2] - z) : 99; });
check('partner enemy positions track the host (max drift m)', Math.max(0, ...dd) < 4, dd.map((d) => Math.round(d * 10) / 10));
// partner chips one enemy and kills another
const hitRes = await B.ev(`const L = live().filter((e) => e.spawnT <= 0 && !e.def.boss); if (L.length < 2) return 'few ' + L.length; damageEnemy(L[0], 12, { weapon: 'revolver' }); killEnemy(L[1], { weapon: 'revolver' }); return [L[0].nid, L[0].hp, L[1].nid];`);
await sleep(800);
const hostView = Array.isArray(hitRes) ? await A.ev(`const a = enemies.find((e) => e.nid === ${hitRes[0]}), b = enemies.find((e) => e.nid === ${hitRes[2]}); return [a ? Math.round(a.hp) : 'gone', a ? Math.round(a.maxHp) : 0, b ? b.dead : 'gone'];`) : null;
check('partner damage + kill reach the host', Array.isArray(hostView) && hostView[0] !== 'gone' && hostView[0] < hostView[1] && hostView[2] !== false, { hitRes, hostView });
// host clears the room
for (let i = 0; i < 14; i++) { await A.ev(`killMine(); return 1;`); await sleep(500); if (await A.ev(`return G.layout.rooms[${room1[0].room}].state;`) === 'clear') break; }
await sleep(1000);
check('room cleared on both', true, await both(`return [G.layout.rooms[${room1[0].room}].state, live().length, Math.round(P.hp), G.kills];`));
// ---- down + revive
await A.ev(`const r = fightRoom(); P.pos.set(r.cx, 0, r.cz); return 1;`);
await sleep(2500);
await A.ev(`window.__god = setInterval(() => { P.hp = 100; P.invuln = 1; }, 30); return 1;`);
await B.ev(`P.invuln = 0; P.dashT = 0; hurtPlayer(999, null); return CO.down;`);
await sleep(800);
check('partner goes DOWN, host sees it', true, await Promise.all([B.ev(`return [CO.down, G.state, P.hp, !$('coDown').classList.contains('hidden')];`), A.ev(`return [CO.mate.down, $('coMateSt').textContent];`)]));
await A.ev(`P.pos.set(CO.mate.pos.x + 0.5, CO.mate.pos.y, CO.mate.pos.z); P.vel.set(0,0,0); return 1;`);
await sleep(3200);
check('host lifts the partner back up', true, await Promise.all([B.ev(`return [CO.down, Math.round(P.hp), G.state];`), A.ev(`return CO.mate.down;`)]));
// ---- wipe: both down
await A.ev(`clearInterval(window.__god); return 1;`);
await both(`P.invuln = 0; P.dashT = 0; hurtPlayer(999, null); return CO.down;`);
await waitFor(A, `!CO.down && G.deaths === 1`, 12000); await waitFor(B, `!CO.down && G.deaths === 1`, 5000);
const wipe = await both(`const r = G.layout.rooms.find((x) => x.state === 'active'); return { down: CO.down, hp: Math.round(P.hp), active: !!r, deaths: G.deaths, live: live().length, state: G.state };`);
check('both down = room reset, both back at 100', !wipe[0].down && !wipe[1].down && wipe[0].hp === 100 && !wipe[0].active && !wipe[1].active && wipe[0].deaths === 1 && wipe[1].deaths === 1, wipe);
// ---- pause holds the fight for both
const t0 = await B.ev(`return G.levelTime;`);
await A.ev(`G.state = 'play'; pauseGame(); return G.state;`);
await sleep(1500);
const t1 = await B.ev(`return [G.levelTime, !$('coPauseNote').classList.contains('hidden')];`);
await A.ev(`$('resumeBtn').click(); return G.state;`);
await sleep(1200);
const t2 = await B.ev(`return G.levelTime;`);
check('host pause holds the partner, resume releases', t1[1] && t1[0] - t0 < 0.5 && t2 - t1[0] > 0.5, [t0, t1, t2]);
// ---- clear the level from the host side and walk into the portal
for (let i = 0; i < 80; i++) {
  const st = await A.ev(`if (G.state !== 'play') return G.state; P.hp = 100; P.invuln = 1; const r = fightRoom(); if (r) { P.pos.set(r.cx, 0, r.cz); P.vel.set(0,0,0); killMine(); return 'room'; } if (G.portal) { P.pos.set(G.portal.x, 0, G.portal.z); return 'portal'; } return 'none';`);
  if (st === 'complete') break;
  await sleep(400);
}
await sleep(1200);
check('both reach the results screen', true, await both(`return [G.state, !$('complete').classList.contains('hidden'), $('coNote').textContent, $('nextBtn').classList.contains('hidden'), $('completeMenuBtn').textContent, (loadProgress().best['0-2'] || {}).rank];`));
// ---- next level through the host's button: 0-3
await A.ev(`$('nextBtn').click(); return 1;`);
check('NEXT takes both to 0-3', (await waitFor(A, `G.level && G.level.id === '0-3' && G.state === 'play'`)) && (await waitFor(B, `G.level && G.level.id === '0-3' && G.state === 'play' && CO.active`)));
// ---- boss level 0-5: clear up to the boss, the partner lands the kill
await A.ev(`coGo(idx('0-5')); return 1;`);
await waitFor(B, `G.level && G.level.id === '0-5' && G.state === 'play'`);
let bossSeen = null;
for (let i = 0; i < 80; i++) {
  const st = await A.ev(`P.hp = 100; P.invuln = 1; if (G.boss && !G.boss.dead) return 'boss'; const r = fightRoom(); if (!r) return 'none'; P.pos.set(r.cx, 0, r.cz); P.vel.set(0,0,0); if (!r.boss) killMine(); return 'room';`);
  if (st === 'boss') { await sleep(2500); bossSeen = await both(`return G.boss ? [G.boss.type, G.boss.nid, Math.round(G.boss.hp), !$('bossBar').classList.contains('hidden')] : null;`); break; }
  await sleep(400);
}
check('boss appears on both with one id', bossSeen && bossSeen[0] && bossSeen[1] && bossSeen[0][1] === bossSeen[1][1], bossSeen);
await waitFor(B, `G.boss && G.boss.spawnT <= 0`, 10000);
await B.ev(`P.hp = 100; if (G.boss) { G.boss.hp = 30; damageEnemy(G.boss, 200, { weapon: 'revolver', explosion: true }); } return 1;`);
await waitFor(A, `G.portal`, 12000);
check('partner kills the boss → dead + portal on both', true, await both(`return [G.boss ? G.boss.hp : 'none', !!G.portal, G.layout.rooms.filter((r) => r.boss).map((r) => r.state).join()];`));
// ---- quit to lodge from the pause menu
await B.ev(`G.state = 'play'; pauseGame(); $('quitBtn').click(); return G.state;`);
await sleep(1500);
check('partner quits → both back in the lodge', true, await both(`return [G.state, CO.active, VS.connected, !$('versus').classList.contains('hidden')];`));
// ---- the race still works from the same lodge
await A.ev(`vsSetMode('race'); return 1;`);
check('mode switch reaches the partner', await waitFor(B, `VS.mode === 'race' && $('vsStart').textContent === 'START RACE'`, 5000));
await A.ev(`vsStartRace(); return 1;`);
check('race starts on both', (await waitFor(A, `G.state === 'vsready' && VS.active`)) && (await waitFor(B, `G.state === 'vsready' && VS.active`)));
await both(`vsSetReady(); return 1;`);
check('race countdown on both', (await waitFor(A, `G.state === 'play' && VS.freeze > 0`, 8000)) && (await waitFor(B, `G.state === 'play' && VS.active`, 8000)));
await both(`vsToLobby(); return 1;`);
await A.ev(`vsSetMode('coop'); return 1;`);
check('back to co-op mode', await waitFor(B, `VS.mode === 'coop' && G.state === 'versus'`, 5000));
// ---- start again, then the partner drops: host goes solo
await A.ev(`$('vsLevel').value = String(idx('0-1')); VS.level = idx('0-1'); coStart(); return 1;`);
await waitFor(B, `CO.active && G.state === 'play'`);
await sleep(1000);
await B.ev(`VS.peer.destroy(); return 1;`);
check('partner disconnects → host carries on solo', await waitFor(A, `!CO.active && G.state === 'play'`, 15000), await A.ev(`return [CO.active, G.state, $('hint').textContent];`));
await A.ev(`const r = fightRoom(); if (r) { P.pos.set(r.cx, 0, r.cz); } return 1;`);
await sleep(3000);
check('solo room logic runs again after the drop', true, await A.ev(`return [G.layout.rooms.filter((r) => r.state !== 'idle').map((r) => r.state).join(), live().length];`));

const fe = await both(`return window.__fe || [];`);
console.log(log.join('\n'));
const errs = [...A.errs, ...B.errs, ...fe[0].map((e) => 'HOST frame: ' + e), ...fe[1].map((e) => 'JOIN frame: ' + e)];
console.log(`ERRORS (${errs.length}):`); for (const e of [...new Set(errs)].slice(0, 40)) console.log('  ' + e);
for (const P of [A, B]) P.ws.close();
for (const k of kids) k.kill();
await sleep(600);
for (const p of profs) { try { fs.rmSync(p, { recursive: true, force: true }); } catch {} }
process.exit(0);
