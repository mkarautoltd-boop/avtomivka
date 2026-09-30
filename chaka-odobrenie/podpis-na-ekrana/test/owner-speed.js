const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8787/'); await p.waitForSelector('#lu'); await p.fill('#lu', 'admin'); await p.fill('#lp', 'helios2026');
  let t = Date.now(); await p.click('#lgo'); await p.waitForSelector('#rep .stats', { timeout: 30000 }); console.log('first report', Date.now() - t, 'ms');
  await p.waitForTimeout(6000);   // предварително зареждане
  for (const [tab, sel] of [['set', '#uNew'], ['firms', '#app .card'], ['inv', '#fmr'], ['rep', '#rep .stats'], ['talons', '#tl']]) {
    t = Date.now(); await p.click(`[data-tab=${tab}]`); await p.waitForFunction(() => !/Зареждане/.test(document.querySelector('#app').innerText) && document.querySelector('#app').innerText.length > 20, null, { timeout: 30000 }); console.log(tab, Date.now() - t, 'ms');
  }
  await p.click('[data-tab=set]'); await p.waitForSelector('#uNew');
  await p.click('#uNew'); await p.click('#uRole [data-r=washer]'); await p.fill('#uName', 'Тест'); await p.fill('#uLogin', 'test1'); await p.fill('#uPass', 'test123');
  t = Date.now(); await p.click('#uOk'); await p.waitForFunction(() => document.body.innerText.includes('test1'), null, { timeout: 30000 }); console.log('new user visible', Date.now() - t, 'ms');
  console.log(errs); await b.close();
})();
