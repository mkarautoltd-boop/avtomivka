const { chromium } = require('playwright');
const URL = 'http://localhost:8790/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.stack));
  const waitFor = async (fn, max = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (await p.evaluate(fn).catch(() => false)) return Date.now() - t0; await p.waitForTimeout(50); } return -1; };
  const toast = () => p.$eval('#toast', e => e.style.display !== 'none' ? e.textContent : '');
  await p.goto(URL); await p.waitForSelector('#lu'); await p.fill('#lu', 'admin'); await p.fill('#lp', 'helios2026'); await p.check('#lr'); await p.click('#lgo');
  await waitFor(() => S.user); await p.waitForTimeout(9000);
  await p.click('[data-tab=set]'); await waitFor(() => !!document.querySelector('#uNew'));
  const add = async (role, name, un, pw) => { await p.click('#uNew'); await p.waitForTimeout(150); await p.click(`#uRole [data-r=${role}]`); await p.fill('#uName', name); await p.fill('#uLogin', un); await p.fill('#uPass', pw); const t0 = Date.now(); await p.click('#uOk'); const t = await waitFor(n => document.querySelector('#app').innerText.includes(n), 20000).catch(() => -1); return t; };
  await p.click('#uNew'); await p.waitForTimeout(150); await p.click('#uRole [data-r=cashier]'); await p.fill('#uName', 'Мария'); await p.fill('#uLogin', 'maria'); await p.fill('#uPass', 'maria123'); let t0 = Date.now(); await p.click('#uOk');
  console.log('cashier visible in', await waitFor(() => document.querySelector('#app').innerText.includes('Мария')), 'ms'); if (await p.$('#lkX')) await p.click('#lkX');
  await p.click('#uNew'); await p.waitForTimeout(150); await p.click('#uRole [data-r=washer]'); await p.fill('#uName', 'Иван'); await p.fill('#uLogin', 'ivan'); await p.fill('#uPass', 'ivan1234'); await p.click('#uOk');
  console.log('washer visible in', await waitFor(() => document.querySelector('#app').innerText.includes('Иван')), 'ms'); if (await p.$('#lkX')) await p.click('#lkX');
  await p.click('#uNew'); await p.waitForTimeout(150); await p.fill('#uName', 'Друга'); await p.fill('#uLogin', 'maria'); await p.fill('#uPass', 'xxxxxx'); await p.click('#uOk'); console.log('dup username:', await toast()); await p.click('#uNo');
  await p.waitForTimeout(9000);
  const db = await (await p.request.get(URL + '_db')).json(); console.log('server users:', db.users.map(u => u.name + '/' + u.role).join(', '));
  console.log('ids now real:', await p.$$eval('[data-ue]', a => a.map(x => x.dataset.ue).join(',')), '| toast', await toast());
  // друг запис — с „Записване…“
  await p.fill('#lEv', '8'); await p.click('#lSave'); await p.waitForTimeout(300); console.log('busy shown during loyalty save:', await p.evaluate(() => !!document.getElementById('busy')));
  await waitFor(() => !document.getElementById('busy')); console.log('after save toast:', await toast());
  console.log('errors', errs); await b.close();
})();
