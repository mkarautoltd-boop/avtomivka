const { chromium } = require('playwright');
const assert = require('assert');
const URL = 'http://localhost:8787/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.stack)); p.on('dialog', d => d.dismiss());
  let OFF = false;
  await p.route('**/api', r => OFF ? r.abort('internetdisconnected') : r.continue());
  const toast = async () => (await p.$eval('#toast', e => e.textContent));
  const login = async (u, pw, rem) => { await p.goto(URL); await p.waitForSelector('#lu'); await p.fill('#lu', u); await p.fill('#lp', pw); if (rem) await p.check('#lr'); await p.click('#lgo'); await p.waitForTimeout(1200); };
  // 1. собственик: екип и фирма
  await login('admin', 'helios2026');
  await p.click('[data-tab=set]'); await p.waitForTimeout(600);
  for (const [role, name, un, pw] of [['cashier', 'Мария', 'maria', 'maria123'], ['washer', 'Иван', 'ivan', 'ivan1234'], ['washer', 'Георги', 'georgi', 'georgi12']]) {
    await p.click('#uNew'); await p.waitForTimeout(200);
    await p.click(`#uRole [data-r=${role}]`); await p.fill('#uName', name); await p.fill('#uLogin', un); await p.fill('#uPass', pw);
    await p.click('#uOk'); await p.waitForTimeout(700); console.log('user', name, await toast());
  }
  await p.click('#out'); await p.waitForTimeout(300);
  // 2. касиер онлайн
  await login('maria', 'maria123', true);
  if (await p.$('#osGo')) { await p.fill('#osCash', '50').catch(() => {}); await p.click('#osGo'); await p.waitForTimeout(800); }
  console.log('after open shift, tab:', await p.evaluate(() => S.tab), 'net:', await p.evaluate(() => NET.off));
  const issue = async (plate, svc = 0, w = 0) => { await p.fill('#plate', plate); await p.dispatchEvent('#plate', 'input'); await p.waitForTimeout(400); await p.click(`[data-s] >> nth=${svc}`); await p.click(`[data-w] >> nth=${w}`); await p.click('#save2'); await p.waitForTimeout(900); return p.$eval('#lastT', e => e.innerText.replace(/\n/g, ' ')); };
  console.log('online talon:', await issue('СА 1234 ВХ'));
  // 3. без интернет
  OFF = true;
  console.log('offline talon 1:', await issue('ВТ 1111 АА', 1, 1));
  console.log('offline talon 2:', await issue('В 2222 ВВ', 2, 0));
  await p.click('[data-tab=due]'); await p.waitForTimeout(500);
  await p.click('[data-charge] >> nth=0'); await p.click('[data-pm=cash]'); await p.click('#cgOk'); await p.waitForTimeout(600); console.log('offline pay:', await toast());
  console.log('queue:', await p.evaluate(() => NET.queue.map(q => q.action).join(',')), '| bar:', await p.$eval('#net', e => e.innerText));
  await p.screenshot({ path: process.env.SP + '/E1.png' });
  // презареждане без интернет — данните и опашката остават
  await p.reload(); await p.waitForTimeout(1500);
  console.log('after reload offline: user', await p.evaluate(() => S.user && S.user.name), 'queue', await p.evaluate(() => NET.queue.length), 'due', await p.evaluate(() => (S.day && S.day.unpaid || []).length));
  // 4. интернетът се връща
  OFF = false; await p.evaluate(() => netTick()); await p.waitForTimeout(2000);
  console.log('after flush: queue', await p.evaluate(() => NET.queue.length), 'off', await p.evaluate(() => NET.off), 'bar', await p.$eval('#net', e => e.innerText));
  const sdb = await (await p.request.get(URL + '_db')).json();
  const today = sdb.kasa.map(k => k.talon + ':' + k.plate + ':' + (k.pay || '-')).join(' | ');
  console.log('server kasa:', today); assert.equal(sdb.kasa.length, 3); assert.equal(sdb.kasa.filter(k => k.pay === 'cash').length, 1);
  // 5. мияч вижда своите талони
  const ctx2 = await b.newContext(); const p2 = await ctx2.newPage(); p2.on('pageerror', e => errs.push(e.stack));
  await p2.goto(URL); await p2.waitForSelector('#lu'); await p2.fill('#lu', 'ivan'); await p2.fill('#lp', 'ivan1234'); await p2.click('#lgo'); await p2.waitForTimeout(1200);
  console.log('washer pending:', await p2.evaluate(() => document.body.innerText.match(/(СА 1234 ВХ|В 2222 ВВ|ВТ 1111 АА)/g)));
  const start = await p2.$('button:has-text("Започвам")'); if (start) { await start.click(); await p2.waitForTimeout(800); }
  // касата вижда „мие се“ след синхронизация
  await p.evaluate(() => netTick()); await p.waitForTimeout(1200); await p.click('[data-tab=due]'); await p.waitForTimeout(500);
  console.log('due list:', await p.$eval('#dueL', e => e.innerText.replace(/\n/g, ' ')));
  // 6. собственик: отчет
  const ctx3 = await b.newContext(); const p3 = await ctx3.newPage(); await p3.goto(URL); await p3.waitForSelector('#lu'); await p3.fill('#lu', 'admin'); await p3.fill('#lp', 'helios2026'); await p3.click('#lgo'); await p3.waitForTimeout(1500);
  console.log('owner kpis:', await p3.$eval('#kpis', e => e.innerText.replace(/\n/g, ' ')));
  await p3.screenshot({ path: process.env.SP + '/E2.png' });
  // 7. нов касиер, който не е влизал — без интернет не може
  OFF = true; await p.click('#out'); await p.waitForTimeout(300);
  await p.fill('#lu', 'petya'); await p.fill('#lp', 'whatever'); await p.click('#lgo'); await p.waitForTimeout(800); console.log('unknown offline login:', await toast());
  await p.fill('#lu', 'maria'); await p.fill('#lp', 'maria123'); await p.click('#lgo'); await p.waitForTimeout(1200); console.log('maria offline login:', await p.evaluate(() => S.user && S.user.name), await p.$eval('#net', e => e.innerText));
  console.log('errors', errs); await b.close();
})();
