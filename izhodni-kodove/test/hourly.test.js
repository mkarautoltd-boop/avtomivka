// надник на час: минутите на смяната в работното време × сумата на час
global.HELIOS = require('../src/engine.js');
const seed = require('../src/seed.js'), H = HELIOS, assert = require('assert');
let T = '2026-11-20', NOW = '12:00', n = 0;
const env = { today: () => T, now: () => NOW, uid: () => 'h' + (++n) };
const db = seed(T); const mem = { load: () => db, save: () => {} };
const call = (l, p, a, d = {}) => H.serve(Object.assign({ action: a, login: l, pass: p }, d), mem, env);
const A = (a, d) => { const r = call('admin', 'helios', a, d); assert(r.ok, a + ': ' + r.error); return r; };
const C = (a, d) => { const r = call('maria', '1111', a, d); assert(r.ok, a + ': ' + r.error); return r; };
// затваряме всички стари смени, за да почнем на чисто
db.shifts.forEach(s => { if (!s.closeT) { s.closeT = '18:00'; s.mode = 'day'; } });
const m = db.users.find(u => u.username === 'maria');
A('saveUser', { id: m.id, name: m.name, username: m.username, role: 'cashier', active: true, dayWage: 43, hourWage: 4.30 });
assert.equal(db.users.find(u => u.id === m.id).hourFrom, T);
let bad = call('admin', 'helios', 'saveWorkHours', { start: '18:00', end: '08:00' }); assert(!bad.ok);
A('saveWorkHours', { start: '08:00', end: '18:00' });
const shift = (d, o, c, talonAt) => { T = d; NOW = o; C('openShift', { openCash: 50 });
  if (talonAt) { NOW = talonAt; C('addKasa', { plate: 'В 1234 АВ', services: ['Кола вътре+вън'], washer: 'Иван' }); }
  if (c) { NOW = c; const st = C('myDay').shift; C('closeShift', { mode: 'day', counted: st.expected, leftFloat: 0 }); } };
// закъснял 8:30, приключил по-рано 17:30 → 9 ч → 38,70
shift('2026-11-21', '08:30', '17:30');
// дошъл рано 7:50, останал до 18:20 → само 8–18 → 10 ч → 43,00
shift('2026-11-22', '07:50', '18:20');
// не е приключил: последен талон 16:00, приключено на другия ден → 9–16 → 7 ч → 30,10
shift('2026-11-23', '09:00', null, '16:00');
T = '2026-11-24'; NOW = '08:05'; const st = C('myDay').shift; assert.equal(st.date, '2026-11-23');
C('closeShift', { mode: 'day', counted: st.expected, leftFloat: 0 });
T = '2026-11-25'; NOW = '10:00';
const day = d => A('report', { date: d }).cashiers.find(c => c.name === m.name);
for (const [d, mins, eur] of [['2026-11-21', 540, 38.7], ['2026-11-22', 600, 43], ['2026-11-23', 420, 30.1]]) {
  const c = day(d); console.log(d, c.mins, c.earned, JSON.stringify(c.spans)); assert.equal(c.mins, mins); assert.equal(c.earned, eur); }
// стар ден (преди почасовото) — по надник за ден
const old = db.shifts.find(s => s.openBy === m.name && s.date < '2026-11-20');
if (old) assert.equal(day(old.date).hourly, false);
const mon = A('monthReport', { month: '2026-11' }).cashiers || A('monthReport', { month: '2026-11' }).money;
const pr = C('payroll').me; console.log('owed', pr.owed, 'prev', pr.prev);
console.log('HOURLY OK');
