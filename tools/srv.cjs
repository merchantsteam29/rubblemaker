// serves the repo at :8091, and /__name from the scratchpad
const http = require('http'), fs = require('fs'), path = require('path');
const [, , ROOT, SP, PORT = 8091] = process.argv;
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/__') ? path.join(SP, u.slice(3)) : path.join(ROOT, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); }
    const t = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': t, 'Cache-Control': 'no-store' }); res.end(d); });
}).listen(PORT);
