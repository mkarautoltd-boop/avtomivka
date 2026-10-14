global.HELIOS = require('../src/engine.js');
const seed = require('../src/seed.js');
const H = HELIOS, assert = require('assert');
const T = '2026-09-30';
let clock = '16:00', n = 0;
const env = { today: () => T, now: () => clock, uid: () => 'x' + (++n) };
const db = seed(T);
const mem = { load: () => db, save: () => {} };
const call = (login, pass, action, data = {}) => H.serve(Object.assign({ action, login, pass }, data), mem, env);
let r;
r = call('maria', '1111', 'login'); assert(r.ok, r.error); assert.equal(r.user.name, 'Мария');
r = call('maria', 'bad', 'login'); assert(!r.ok);
r = call('maria', '1111', 'myDay'); assert(r.ok, r.error);
console.log('shift expected', r.shift.expected, 'unpaid', r.unpaid.length, 'cash', r.shift.cash);
assert.equal(r.unpaid.length, 2);
const exp0 = r.shift.expected;
// издаване без плащане
r = call('maria', '1111', 'addKasa', { plate: 'ВТ 4455 ХХ', services: ['Кола вътре+вън'], washer: 'Иван', cid: 'c1' }); assert(r.ok, r.error); assert.equal(r.pay, null); assert.equal(r.id, 'c1');
// повторно изпращане (същият cid) не дублира
const cnt = db.kasa.length; r = call('maria', '1111', 'addKasa', { plate: 'ВТ 4455 ХХ', services: ['Кола вътре+вън'], washer: 'Иван', cid: 'c1' }); assert(r.dup); assert.equal(db.kasa.length, cnt);
r = call('maria', '1111', 'payKasa', { id: 'c1', pay: 'cash', cid: 'c2' }); assert(r.ok, r.error);
r = call('maria', '1111', 'myDay'); assert.equal(r.shift.expected, H.r2(exp0 + 18)); console.log('after pay', r.shift.expected);
// фирма
r = call('maria', '1111', 'addKasa', { plate: 'СА 2222 ТТ', services: ['Бус'], washer: 'Георги' }); assert.equal(r.pay, 'firm'); assert.equal(r.price, 20);
// плащане на мияч
r = call('maria', '1111', 'payroll'); const iv = r.washers.find(w => w.name === 'Иван'); console.log('Иван дължимо', iv.owed, 'me', r.me.owed);
r = call('maria', '1111', 'payWasher', { washer: 'Иван', amount: iv.owed }); assert(r.ok, r.error);
r = call('maria', '1111', 'takeWage', { amount: 30 }); assert(r.ok, r.error); assert.equal(r.left, 80);
// лоялност
r = call('maria', '1111', 'loyalty', { plate: 'ТХ 1655 МА' }); console.log('loyalty', JSON.stringify(r));
// плик
r = call('maria', '1111', 'shiftState'); const env1 = r.envelopes[0]; console.log('env', env1);
r = call('maria', '1111', 'envTake', { id: env1.id, amount: 10 }); assert(r.ok, r.error);
// затваряне на деня
r = call('maria', '1111', 'shiftState'); const ex = r.shift.expected;
r = call('maria', '1111', 'closeShift', { mode: 'day', counted: ex, leftFloat: 50 }); assert(r.ok, r.error); assert.equal(r.shift.diff, 0); console.log('closed; envelope', r.shift.envelope);
r = call('maria', '1111', 'addKasa', { plate: 'В 1234 АВ', services: ['Бус'], washer: 'Иван' }); assert(!r.ok);
// офлайн опашка (batch) с дата/час от касата
r = call('petya', '5555', 'batch', { items: [
  { action: 'login', cid: 'q0', by: 'petya', _d: T, _t: '17:00' },
  { action: 'openShift', cid: 'q1', by: 'petya', cash: 50, _d: T, _t: '17:01' },
  { action: 'addKasa', cid: 'q2', by: 'petya', plate: 'Н 7777 ВС', services: ['Джип / SUV'], washer: 'Георги', talon: '99', _d: T, _t: '17:05' },
  { action: 'payKasa', cid: 'q3', by: 'petya', id: 'q2', pay: 'card', _d: T, _t: '17:30' },
  { action: 'payKasa', cid: 'q4', by: 'petya', id: 'q2', pay: 'cash', _d: T, _t: '17:31' } ], since: 0 });
assert(r.ok, r.error); console.log(r.results.map(x => x.cid + ':' + (x.ok ? 'ok' : x.error)).join(' | '));
assert.equal(r.results[4].ok, false); const k99 = db.kasa.find(k => k.id === 'q2'); assert.equal(k99.talon, '99'); assert.equal(k99.time, '17:05'); assert.equal(k99.pay, 'card');
assert(r.delta.tables.kasa.length > 100); assert(!r.delta.tables.users[0].hash);
// повторен batch — нищо ново
const kl = db.kasa.length; r = call('petya', '5555', 'batch', { items: [{ action: 'addKasa', cid: 'q2', by: 'petya', plate: 'Н 7777 ВС', services: ['Бус'], washer: 'Георги' }] }); assert(r.results[0].dup); assert.equal(db.kasa.length, kl);
// делта само с новото
const v0 = db.meta.v; r = call('petya', '5555', 'payKasa', { id: db.kasa.find(k => !k.pay && !k.void).id, pay: 'cash', since: v0 }); assert(r.ok, r.error);
console.log('delta tables', Object.keys(r.delta.tables), r.delta.tables.kasa.length);
// собственик
for (const a of ['report', 'monthReport', 'clients', 'firmMonth', 'firmsAll', 'shifts', 'users', 'pricesAll', 'getSettings']) { r = call('admin', 'helios', a); assert(r.ok, a + ': ' + r.error); }
r = call('admin', 'helios', 'report'); console.log('report', JSON.stringify(r.totals));
r = call('admin', 'helios', 'saveUser', { role: 'washer', name: 'Стефан', username: 'stefan', newPass: 'stefan1' }); assert(r.ok, r.error);
r = call('stefan', 'stefan1', 'login'); assert(r.ok, r.error);
r = call('admin', 'helios', 'movePrice', { id: 's3', dir: 'up' }); assert.equal(r.prices[1].name, 'Бус');
r = call('admin', 'helios', 'savePrice', { name: 'Вакуум', price: 7 }); assert(r.ok, r.error);
r = call('admin', 'helios', 'saveFirm', { name: 'Нова ООД', prices: { 'Бус': 19 }, plates: ['В 5555 ВВ'] }); assert(r.ok, r.error);
r = call('maria', '1111', 'myDay'); assert(r.firms.some(f => f.name === 'Нова ООД'));
r = call('ivan', '2222', 'myDay'); assert(r.ok, r.error); console.log('ivan pending', r.pending.length);
console.log('ALL OK');
