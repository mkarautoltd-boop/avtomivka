const { chromium } = require('playwright');
const API = 'http://localhost:8787/api';
const post = b => fetch(API, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
(async () => {
  const A = { login: 'admin', pass: 'helios2026' };
  await post(Object.assign({ action: 'saveUser', role: 'cashier', name: 'Мария', username: 'maria', newPass: 'maria123', dayWage: 55 }, A));
  await post(Object.assign({ action: 'saveUser', role: 'washer', name: 'Иван', username: 'ivan', newPass: 'ivan1234' }, A));
  await post(Object.assign({ action: 'saveFirm', name: 'Транс Лоджистик ЕООД', eik: '204118765', contact: 'Николай Петров', phone: '0888 123 456', prices: { 'Бус': 20, 'Кола вътре+вън': 15 }, plates: ['СА 1111 ТТ', 'СА 2222 ТТ'] }, A));
  const M = { login: 'maria', pass: 'maria123' };
  await post(Object.assign({ action: 'openShift', cash: 50 }, M));
  await post(Object.assign({ action: 'addKasa', plate: 'СА 1111 ТТ', services: ['Бус'], washer: 'Иван' }, M));
  await post(Object.assign({ action: 'addKasa', plate: 'СА 2222 ТТ', services: ['Кола вътре+вън'], washer: 'Иван' }, M));
  await post(Object.assign({ action: 'addKasa', plate: 'В 1234 АВ', services: ['Джип / SUV'], washer: 'Иван' }, M));
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8787/'); await p.waitForSelector('#lu'); await p.fill('#lu', 'maria'); await p.fill('#lp', 'maria123'); await p.click('#lgo');
  await p.waitForSelector('#recent [data-hand]', { timeout: 30000 }); await p.waitForTimeout(400);
  await p.screenshot({ path: process.env.SP + '/F1.png' });
  await p.click('#recent [data-hand] >> nth=0'); await p.waitForSelector('#hdSig');
  await p.fill('#hdName', 'Николай Петров');
  const bx = await (await p.$('#hdSig')).boundingBox();
  const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push([0.12 + 0.7 * t, 0.55 + 0.25 * Math.sin(t * 14) * (1 - t * 0.5)]); }
  await p.mouse.move(bx.x + bx.width * pts[0][0], bx.y + bx.height * pts[0][1]); await p.mouse.down();
  for (const q of pts) await p.mouse.move(bx.x + bx.width * q[0], bx.y + bx.height * q[1], { steps: 2 });
  await p.mouse.up();
  await p.mouse.move(bx.x + bx.width * 0.2, bx.y + bx.height * 0.3); await p.mouse.down(); await p.mouse.move(bx.x + bx.width * 0.3, bx.y + bx.height * 0.85, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(200); await p.screenshot({ path: process.env.SP + '/F2.png' });
  await p.click('#hdOk'); await p.waitForTimeout(1200); console.log('toast:', await p.$eval('#toast', e => e.textContent));
  // втората — на хартия
  await p.click('#recent [data-hand] >> nth=0'); await p.waitForSelector('#hdSig'); await p.fill('#hdName', 'Георги Колев'); await p.check('#hdPaper'); await p.click('#hdOk'); await p.waitForTimeout(1000);
  await p.evaluate(() => { const d = document.createElement('div'); d.id = 'slipView'; d.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99;background:#fff;padding:10px'; d.innerHTML = document.getElementById('printArea').innerHTML; document.body.appendChild(d); });
  const slip = await p.$('#slipView .talon'); if (slip) await slip.screenshot({ path: process.env.SP + '/F3.png' }); else console.log('no slip');
  // собственик: справка за фирмата
  const c2 = await b.newContext({ viewport: { width: 1100, height: 1000 } }); const q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto('http://localhost:8787/'); await q.waitForSelector('#lu'); await q.fill('#lu', 'admin'); await q.fill('#lp', 'helios2026'); await q.click('#lgo');
  await q.waitForSelector('[data-tab=inv]'); await q.click('[data-tab=inv]'); await q.waitForSelector('details.card summary', { timeout: 30000 });
  await q.click('details.card summary'); await q.waitForTimeout(300); await q.screenshot({ path: process.env.SP + '/F4.png', fullPage: true });
  await q.click('[data-frep="0"]'); await q.waitForTimeout(500);
  const a4 = await q.$('.a4'); await a4.screenshot({ path: process.env.SP + '/F5.png' });
  console.log(errs); await b.close();
})();
