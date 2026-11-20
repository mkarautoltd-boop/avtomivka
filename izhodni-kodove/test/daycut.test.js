// надник за ден: ако смяната не е приключена в същия ден — намалява се до последния талон
global.HELIOS = require('../src/engine.js');
const seed = require('../src/seed.js'), H = HELIOS, assert = require('assert');
let T = '2026-11-20', NOW = '12:00', n = 0;
const env = { today: () => T, now: () => NOW, uid: () => 'd' + (++n) };
const db = seed(T); const mem = { load: () => db, save: () => {} };
const call = (l, p, a, d = {}) => H.serve(Object.assign({ action: a, login: l, pass: p }, d), mem, env);
const A = (a, d) => { const r = call('admin', 'helios', a, d); assert(r.ok, a + ': ' + r.error); return r; };
const C = (a, d) => { const r = call('maria', '1111', a, d); assert(r.ok, a + ': ' + r.error); return r; };
db.shifts.forEach(s => { if (!s.closeT) { s.closeT = '18:00'; s.mode = 'day'; } });
const m = db.users.find(u => u.username === 'maria'); m.dayWage = 43;
const close = () => { const st = C('myDay').shift; C('closeShift', { mode: 'day', counted: st.expected, leftFloat: 0 }); };
// приключил нормално, макар и с закъснение → пълен надник
T = '2026-11-21'; NOW = '08:35'; C('openShift', { openCash: 0 }); NOW = '17:40'; close();
// не приключил: 8:20, последен талон 16:00 → 7 ч 40 мин от 10 ч → 32,97
T = '2026-11-22'; NOW = '08:20'; C('openShift', { openCash: 0 }); NOW = '16:00'; C('addKasa', { plate: 'В 1234 АВ', services: ['Кола вътре+вън'], washer: 'Иван' });
T = '2026-11-23'; NOW = '08:02'; close();
const day = d => A('report', { date: d }).cashiers.find(c => c.name === m.name);
let c = day('2026-11-21'); console.log('closed', c.earned, c.cut); assert.equal(c.earned, 43); assert(!c.cut);
c = day('2026-11-22'); console.log('late', c.earned, JSON.stringify(c.cut)); assert.equal(c.earned, 32.97); assert.equal(c.cut.mins, 460);
const rows = A('cashierLog', { month: '2026-11' }).rows.filter(r => r.name === m.name && r.date === '2026-11-22'); assert.equal(rows[0].cutEarn, 32.97);
console.log('DAYCUT OK');
