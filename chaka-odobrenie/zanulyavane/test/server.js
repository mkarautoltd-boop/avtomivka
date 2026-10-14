// Локален сървър за тестове: имитира Apps Script (/api) и GitHub Pages (файловете от dist/)
const http = require('http'), fs = require('fs'), path = require('path');
const H = require('../src/engine.js');
const db = H.emptyDb();
const salt = 'x1'; db.users.push({ id: 'u1', name: 'Собственик', username: 'admin', role: 'admin', active: true, canAddWashers: false, dayWage: 0, salt, hash: H.passHash(salt, 'helios2026') });
[['Кола вътре+вън', 18], ['Джип / SUV', 21], ['Бус', 25]].forEach((x, i) => db.prices.push({ id: 's' + (i + 1), name: x[0], price: x[1], active: true, ord: i + 1 }));
H.stamp(db, H.diff(db, { settings: '' }));
let n = 0; const pad = x => String(x).padStart(2, '0');
const env = { today: () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }, now: () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }, uid: () => 'S' + (++n) };
const store = { load: () => db, save: () => {} };
global.TESTDB = db;
const PORT = +process.env.PORT || 8787;
http.createServer((req, res) => {
  if (req.url === '/api' && req.method === 'POST') { const DELAY = +process.env.DELAY || 0;
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      let out; try { out = H.serve(JSON.parse(b), store, env); } catch (e) { out = { ok: false, error: 'server: ' + e.message }; }
      setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out)); }, DELAY);
    }); return;
  }
  if (req.url === '/_db') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(db)); return; }
  let f = req.url.split('?')[0]; if (f === '/') f = '/index.html';
  const fp = path.join(__dirname, '..', 'dist', f);
  if (!fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
  let body = fs.readFileSync(fp);
  if (f === '/index.html') body = body.toString().replace("const API_URL = 'ПОСТАВИ_ТУК_URL_ОТ_APPS_SCRIPT';", "const API_URL = 'http://localhost:" + PORT + "/api';").replace('const AUTO_PRINT = true;', 'const AUTO_PRINT = false;');
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' }[path.extname(fp)] || 'application/octet-stream' });
  res.end(body);
}).listen(PORT, () => console.log('test server on', PORT));
