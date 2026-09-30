const { chromium } = require('playwright');
const API = 'http://localhost:8787/api';
const post = b => fetch(API, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
(async () => {
  const A = { login: 'admin', pass: 'helios2026' };
  await post(Object.assign({ action: 'saveUser', role: 'cashier', name: 'Мария', username: 'maria', newPass: 'maria123', dayWage: 55 }, A));
  await post(Object.assign({ action: 'saveUser', role: 'washer', name: 'Иван', username: 'ivan', newPass: 'ivan1234' }, A));
  await post(Object.assign({ action: 'saveFirm', name: 'Транс Лоджистик ЕООД', prices: { 'Бус': 20 }, plates: ['СА 1111 ТТ'] }, A));
  await post(Object.assign({ action: 'openShift', cash: 50 }, { login: 'maria', pass: 'maria123' }));
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8787/'); await p.waitForSelector('#lu'); await p.fill('#lu', 'maria'); await p.fill('#lp', 'maria123'); await p.click('#lgo');
  await p.waitForSelector('#plate', { timeout: 30000 });
  await p.fill('#plate', 'СА 1111 ТТ'); await p.dispatchEvent('#plate', 'input'); await p.waitForTimeout(300);
  await p.click('[data-s="Бус"]'); await p.click('[data-w] >> nth=0'); await p.click('#save2'); await p.waitForTimeout(1200);
  console.log('talons in print area:', await p.$$eval('#printArea .talon', x => x.length));
  await p.emulateMedia({ media: 'print' }); await p.setViewportSize({ width: 260, height: 900 });
  await p.screenshot({ path: process.env.SP + '/T1.png', fullPage: true });
  await p.emulateMedia({ media: 'screen' });
  // обикновена кола — само една бележка
  await p.setViewportSize({ width: 1366, height: 900 });
  await p.fill('#plate', 'В 1234 АВ'); await p.dispatchEvent('#plate', 'input'); await p.waitForTimeout(300);
  await p.click('[data-s="Бус"]'); await p.click('[data-w] >> nth=0'); await p.click('#save2'); await p.waitForTimeout(1200);
  console.log('normal car talons:', await p.$$eval('#printArea .talon', x => x.length));
  console.log(errs); await b.close();
})();
