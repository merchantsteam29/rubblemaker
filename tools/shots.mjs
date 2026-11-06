// node tools/shots.mjs <url> <outDir> [w] [h] — screenshots the main screens of the game in headless Chrome
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const [, , url, outDir, W = 1280, H = 720] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9800 + Math.floor(Math.random() * 150);
const prof = path.join(process.env.TEMP || outDir, 'rbm-shots-' + port);
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--autoplay-policy=no-user-gesture-required',
  '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--window-size=${W},${H}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const errs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description?.split('\n').slice(0, 2).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (js) => (await send('Runtime.evaluate', { expression: `(async () => { ${js} })()`, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 700 });
await send('Page.navigate', { url });
await sleep(10000);
// a veteran-ish save so screens have content: unlock everything through the cheat-free path (progress for every level)
await ev(`document.exitPointerLock = () => {}; HTMLElement.prototype.requestPointerLock = () => {};`);
const SHOTS = [
  ['menu', `toMenu();`],
  ['levels', `openLevels();`],
  ['settings', `toMenu(); $('menuSettingsBtn').click();`],
  ['codex', `toMenu(); openCodex();`],
  ['codex-ach', `+document.querySelector('#codexTabs [data-tab=ach]').click();`],
  ['versus', `toMenu(); $('vsBtn').classList.remove('hidden'); $('vsBtn').click();`],
  ['lodge-coop', `toMenu(); $('vsBtn').classList.remove('hidden'); $('vsBtn').click(); vsSetMode('coop');`],
  ['coop-hud', `toMenu(); VS.connected = false; coBegin(LEVELS.findIndex(l => l.id === '1-2'), 'normal', true); CO.mate.pos = P.pos.clone().add(new V3(-Math.sin(P.yaw) * 4, 0, -Math.cos(P.yaw) * 4)); CO.mate.tgt = CO.mate.pos.clone(); CO.mate.seen = performance.now(); CO.mate.hp = 62; CO.mate.down = true; CO.mate.bo = 14;`, 2500],
  ['coop-down', `+P.invuln = 0; P.dashT = 0; CO.mate.down = false; hurtPlayer(999, null); CO.revT = 0.9; CO.downT = 13.2;`, 1500],
  ['pitrecords', `toMenu(); $('pitRecordsBtn').click();`],
  ['crumble', `toMenu(); openLevels(); await new Promise(r => setTimeout(r, 900)); $('levelsBack').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); $('levelsBack').click(); await new Promise(r => setTimeout(r, 220)); for (const a of document.getAnimations()) if (a.effect && a.effect.target && a.effect.target.parentNode === UIFX.layer) a.pause();`, 200],
  ['hud', `toMenu(); startLevel(LEVELS.findIndex(l => l.id === '1-2')); if (G.state === 'cutscene') endCutscene(); P.hp = 64; addStyle(900, 'TEST', null, 'big'); pushFeed('+20 HP', 'heal');`, 2500],
  ['boss', `toMenu(); startLevel(LEVELS.findIndex(l => l.id === '0-5')); if (G.state === 'cutscene') endCutscene(); const r = G.layout.rooms.find(r => r.boss); P.pos.set(r.cx, 0, r.cz + 6);`, 6000],
  ['pause', `G.state = 'play'; pauseGame();`],
  ['shop', `toMenu(); startLevel(LEVELS.findIndex(l => l.id === '1-1')); if (G.state === 'cutscene') endCutscene(); openShop();`],
  ['complete', `toMenu(); startLevel(LEVELS.findIndex(l => l.id === '0-1')); if (G.state === 'cutscene') endCutscene(); G.levelTime = 80; completeLevel();`, 2500],
  ['over', `toMenu(); startLevel(LEVELS.findIndex(l => l.id === '0-2')); if (G.state === 'cutscene') endCutscene(); P.invuln = 0; hurtPlayer(999, null, {}); `, 3000],
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const [name, js, wait = 1500] of SHOTS) {
  if (only && !only.includes(name)) continue;
  const keep = js.startsWith('+'); const body = keep ? js.slice(1) : `for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden'); await new Promise(r => setTimeout(r, 1300)); ${js}`;
  const r = await ev(`try { ${body} return 'ok'; } catch (e) { return 'ERR ' + e.message; }`);
  await sleep(wait);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(shot.result.data, 'base64'));
  console.log(name, r);
}
if (errs.length) console.log('page errors:\n  ' + [...new Set(errs)].join('\n  '));
ws.close(); ch.kill(); await sleep(500);
try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
