const { chromium } = require('playwright');
const API = 'http://localhost:8787/api';
const post = b => fetch(API, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
(async () => {
  const A = { login: 'admin', pass: 'helios2026' };
  await post(Object.assign({ action: 'saveUser', role: 'cashier', name: 'Мария', username: 'maria', newPass: 'maria123', dayWage: 55 }, A));
  await post(Object.assign({ action: 'saveUser', role: 'washer', name: 'Иван', username: 'ivan', newPass: 'ivan1234' }, A));
  await post(Object.assign({ action: 'saveFirm', name: 'Транс Лоджистик ЕООД', eik: '204118765', contact: 'Николай Петров', prices: { 'Бус': 20, 'Кола вътре+вън': 15 }, plates: ['СА 1111 ТТ', 'СА 2222 ТТ'] }, A));
  const M = { login: 'maria', pass: 'maria123' };
  await post(Object.assign({ action: 'openShift', cash: 50 }, M));
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); p.on('pageerror', e => errs.push('CASHIER ' + e.stack));
  await p.goto('http://localhost:8787/'); await p.waitForSelector('#lu'); await p.fill('#lu', 'maria'); await p.fill('#lp', 'maria123'); await p.click('#lgo');
  await p.waitForSelector('#plate', { timeout: 30000 });
  for (const [pl, sv] of [['СА 1111 ТТ', 'Бус'], ['СА 2222 ТТ', 'Кола вътре+вън']]) {
    await p.fill('#plate', pl); await p.dispatchEvent('#plate', 'input'); await p.waitForTimeout(300);
    await p.click(`[data-s="${sv}"]`); await p.click('[data-w] >> nth=0'); await p.click('#save2'); await p.waitForTimeout(1200);
    console.log(pl, 'print at issue:', await p.$$eval('#printArea .talon', x => x.length));
  }
  await p.screenshot({ path: process.env.SP + '/H1.png' });
  await p.click('#recent [data-hand] >> nth=0'); await p.waitForSelector('#hdOk'); await p.waitForTimeout(200);
  await p.screenshot({ path: process.env.SP + '/H2.png' });
  await p.click('#hdOk'); await p.waitForTimeout(1200); console.log('toast:', await p.$eval('#toast', e => e.textContent));
  console.log('left for handover:', await p.$$eval('#recent [data-hand]', x => x.length));
  await p.emulateMedia({ media: 'print' }); await p.setViewportSize({ width: 260, height: 700 }); await p.screenshot({ path: process.env.SP + '/H3.png', fullPage: true }); await p.emulateMedia({ media: 'screen' });
  const c2 = await b.newContext({ viewport: { width: 1100, height: 1000 } }); const q = await c2.newPage(); q.on('pageerror', e => errs.push('OWNER ' + e.stack));
  await q.goto('http://localhost:8787/'); await q.waitForSelector('#lu'); await q.fill('#lu', 'admin'); await q.fill('#lp', 'helios2026'); await q.click('#lgo');
  await q.waitForSelector('[data-tab=inv]'); await q.click('[data-tab=inv]'); await q.waitForSelector('details.card summary', { timeout: 30000 });
  await q.click('details.card summary'); await q.waitForTimeout(300); await q.screenshot({ path: process.env.SP + '/H5.png', fullPage: true }); await q.click('[data-frep="0"]'); await q.waitForTimeout(500); const a4 = await q.$('.a4'); await a4.screenshot({ path: process.env.SP + '/H4.png' });
  console.log(errs); await b.close();
})();
