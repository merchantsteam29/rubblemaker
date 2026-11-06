// node cdp.mjs <url> <script.js>  — opens url in headless Chrome, waits for boot, runs script.js (an async fn body) in the page, prints result + all errors
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const [, , url, scriptFile] = process.argv;
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const prof = path.join(process.env.TEMP || process.env.TMPDIR || here, 'rbm-prof-' + port);
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--autoplay-policy=no-user-gesture-required',
  '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1280,720', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; logs.push(`EXCEPTION ${d.exception?.description || d.text} @ ${d.url}:${d.lineNumber + 1}`); }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(`console.${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('LOG ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Page.navigate', { url });
await sleep(9000);
const body = fs.readFileSync(scriptFile, 'utf8');
const code = `(async () => { ${body} })()`;
const res = await send('Runtime.evaluate', { expression: `window.__eval ? window.__eval(${JSON.stringify(code)}) : (0, eval)(${JSON.stringify(code)})`, awaitPromise: true, returnByValue: true, timeout: 240000 });
console.log('RESULT:', JSON.stringify(res.result?.result?.value ?? res.result?.exceptionDetails?.exception?.description ?? res, null, 1));
if (process.argv[4]) { // phase 2: reload (keeping the save) and run another script
  logs.push('---- reload ----');
  await send('Page.reload', { ignoreCache: true }); await sleep(9000);
  const code2 = `(async () => { ${fs.readFileSync(process.argv[4], 'utf8')} })()`;
  const r2 = await send('Runtime.evaluate', { expression: `window.__eval ? window.__eval(${JSON.stringify(code2)}) : (0, eval)(${JSON.stringify(code2)})`, awaitPromise: true, returnByValue: true, timeout: 240000 });
  console.log('RESULT2:', JSON.stringify(r2.result?.result?.value ?? r2.result?.exceptionDetails?.exception?.description ?? r2, null, 1));
}
console.log('ERRORS (' + logs.length + '):'); for (const l of logs) console.log('  ' + l);
ws.close(); ch.kill(); await sleep(500);
try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
