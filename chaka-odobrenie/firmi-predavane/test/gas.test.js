// имитация на Google Apps Script + Sheets, за да пуснем Code.gs в node
const fs = require('fs'), vm = require('vm'), assert = require('assert');
function Sheet(name) { this.name = name; this.data = []; this.max = 1000; }
Sheet.prototype = {
  getLastRow() { let n = this.data.length; while (n && this.data[n - 1].every(v => v === '' || v == null)) n--; return n; },
  getMaxRows() { return this.max; }, insertRowsAfter(a, n) { this.max += n; },
  getLastColumn() { return (this.data[0] || []).filter(v => v !== '' && v != null).length; }, getMaxColumns() { return this.maxC || 26; }, insertColumnsAfter(a, n) { this.maxC = (this.maxC || 26) + n; },
  setFrozenRows() {}, getName() { return this.name; },
  getRange(r, c, nr = 1, nc = 1) { const sh = this;
    if (r + nr - 1 > sh.max) throw new Error('outside the dimensions of the sheet');
    const rg = {
      getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (sh.data[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } o.push(row); } return o; },
      setValues(v) { assert.equal(v.length, nr); for (let i = 0; i < nr; i++) { assert.equal(v[i].length, nc); sh.data[r - 1 + i] = sh.data[r - 1 + i] || []; for (let j = 0; j < nc; j++) sh.data[r - 1 + i][c - 1 + j] = v[i][j]; } return rg; },
      setValue(v) { return rg.setValues([[v]]); }, setNumberFormats() { return rg; }, setNumberFormat() { return rg; }, setFontWeight() { return rg; }, setBackground() { return rg; } };
    return rg; } };
const SS = { sheets: [new Sheet('Sheet1')], getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }, insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; },
  getSheets() { return this.sheets; }, deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); } };
let clock = new Date('2026-09-30T08:00:00');
const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => SS },
  Utilities: { formatDate(d, tz, f) { const p = x => String(x).padStart(2, '0'); d = new Date(d.getTime ? d.getTime() : d); return f === 'HH:mm' ? p(d.getHours()) + ':' + p(d.getMinutes()) : d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); },
    getUuid: () => require('crypto').randomUUID() },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 1 } },
  Logger: { log: m => console.log('  [Logger]', m) }, console
};
ctx.Date = class extends Date { constructor(...a) { if (a.length) super(...a); else super(clock.getTime()); } static now() { return clock.getTime(); } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../dist/Code.gs', 'utf8'), ctx);
ctx.setup();
{ const k = SS.getSheetByName('Талони'); k.data[0] = k.data[0].slice(0, 22); console.log('old kasa header cols', k.getLastColumn()); }
console.log('sheets:', SS.sheets.map(s => s.name).join(', '));
const post = b => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(b) } }).s);
let r = post({ action: 'login', login: 'admin', pass: 'helios2026' }); assert(r.ok, r.error);
const A = { login: 'admin', pass: 'helios2026' };
r = post(Object.assign({ action: 'saveUser', role: 'cashier', name: 'Мария', username: 'maria', newPass: 'maria123', dayWage: 55, canAddWashers: true }, A)); assert(r.ok, r.error);
r = post(Object.assign({ action: 'saveUser', role: 'washer', name: 'Иван', username: 'ivan', newPass: 'ivan123' }, A)); assert(r.ok, r.error);
r = post(Object.assign({ action: 'saveFirm', name: 'Транс ЕООД', prices: { 'Бус': 20 }, plates: ['СА 1111 ТТ'] }, A)); assert(r.ok, r.error);
r = post(Object.assign({ action: 'saveLoyalty', on: true, every: 3, maxValue: 18, payWasher: true }, A)); assert(r.ok, r.error);
const M = { login: 'maria', pass: 'maria123' };
r = post(Object.assign({ action: 'login', cid: 'L1' }, M)); assert(r.ok, r.error);
r = post(Object.assign({ action: 'sync', since: 0 }, M)); assert(r.ok, r.error); console.log('first sync tables:', Object.keys(r.delta.tables).join(','), 'settings', !!r.delta.settings);
r = post(Object.assign({ action: 'openShift', cash: 50, cid: 'o1' }, M)); assert(r.ok, r.error);
for (let i = 0; i < 3; i++) { r = post(Object.assign({ action: 'addKasa', plate: 'В 1234 АВ', services: ['Кола вътре+вън'], washer: 'Иван', useGift: true, cid: 'k' + i }, M)); assert(r.ok, r.error); }
console.log('3rd visit gift', r.gift, 'price', r.price, 'pay', r.pay);
r = post(Object.assign({ action: 'payKasa', id: 'k0', pay: 'cash', cid: 'pk0' }, M)); assert(r.ok, r.error);
r = post(Object.assign({ action: 'addKasa', plate: 'СА 1111 ТТ', services: ['Бус'], washer: 'Иван', cid: 'kf' }, M)); assert.equal(r.pay, 'firm'); assert.equal(r.price, 20);
// четене обратно от листовете
const kasaSheet = SS.getSheetByName('Талони'); console.log('Талони rows:', kasaSheet.getLastRow() - 1, 'row1:', JSON.stringify(kasaSheet.data[1]));
r = post(Object.assign({ action: 'myDay' }, M)); assert(r.ok, r.error); console.log('expected', r.shift.expected, 'unpaid', r.unpaid.length);
assert.equal(r.shift.expected, 68);
r = post(Object.assign({ action: 'batch', items: [{ action: 'payKasa', cid: 'q1', by: 'maria', id: 'k1', pay: 'card', _d: '2026-09-30', _t: '09:00' }], since: 0 }, M)); assert(r.ok && r.results[0].ok, JSON.stringify(r.results));
r = post(Object.assign({ action: 'payroll' }, M)); console.log('Иван', JSON.stringify(r.washers[0]), 'me', r.me.owed);
r = post(Object.assign({ action: 'payWasher', washer: 'Иван', amount: 10, cid: 'pw1' }, M)); assert(r.ok, r.error);
r = post(Object.assign({ action: 'takeWage', amount: 55, cid: 'tw1' }, M)); assert(r.ok, r.error);
r = post(Object.assign({ action: 'closeShift', mode: 'day', counted: 3, leftFloat: 3, cid: 'cs1' }, M)); assert(r.ok, r.error); console.log('close expected', r.shift.expected, 'diff', r.shift.diff);
r = post(Object.assign({ action: 'report' }, A)); assert(r.ok, r.error); console.log('report', JSON.stringify(r.totals));
r = post(Object.assign({ action: 'monthReport' }, A)); assert(r.ok, r.error);
r = post(Object.assign({ action: 'firmMonth' }, A)); assert(r.ok, r.error); console.log('firm', r.firms[0].name, r.firms[0].total);
r = post(Object.assign({ action: 'movePrice', id: 's3', dir: 'up' }, A)); assert.equal(r.prices[1].name, 'Бус');
r = post(Object.assign({ action: 'saveUser', id: 'u1', role: 'admin', name: 'Собственик', username: 'admin', newPass: 'novaparola' }, A)); assert(r.ok, r.error);
r = post(Object.assign({ action: 'login' }, A)); assert(!r.ok); r = post({ action: 'login', login: 'admin', pass: 'novaparola' }); assert(r.ok);
// много редове — листът трябва да порасне
const B = { login: 'admin', pass: 'novaparola' };
r = post(Object.assign({ action: 'openShift', cash: 0 }, M)); assert(r.ok, r.error);
for (let i = 0; i < 30; i++) post(Object.assign({ action: 'addKasa', plate: 'СВ ' + (1000 + i) + ' ВВ', services: ['Бус'], washer: 'Иван', cid: 'm' + i }, M));
kasaSheet.max = kasaSheet.getLastRow() + 2;
for (let i = 30; i < 40; i++) { r = post(Object.assign({ action: 'addKasa', plate: 'СВ ' + (1000 + i) + ' ВВ', services: ['Бус'], washer: 'Иван', cid: 'm' + i }, M)); assert(r.ok, r.error); }
console.log('Талони rows now', kasaSheet.getLastRow() - 1, 'max', kasaSheet.max);
// следващия ден
clock = new Date('2026-10-01T09:00:00');
r = post(Object.assign({ action: 'payroll' }, M)); console.log('next day Иван prev', r.washers[0].prev, 'me prev', r.me.prev);
r = ctx.doGet(); console.log('doGet', r.s);
// фирмена кола: предаване с подпис
r = post(Object.assign({ action: 'addKasa', plate: 'СА 1111 ТТ', services: ['Бус'], washer: 'Иван', cid: 'kf2' }, M)); assert.equal(r.pay, 'firm');
r = post(Object.assign({ action: 'handover', id: 'kf2', driver: 'Ники', mode: 'sig', sig: 'data:image/png;base64,AAAA' }, M)); assert(r.ok, r.error);
r = post(Object.assign({ action: 'handover', id: 'kf2', driver: 'Ники', mode: 'sig', sig: 'data:image/png;base64,AAAA' }, M)); assert(!r.ok);
r = post(Object.assign({ action: 'myDay' }, M)); console.log('handover list', r.handover.map(x => x.plate).join(','));
r = post(Object.assign({ action: 'firmMonth', month: '2026-10' }, B)); console.log('firm items', JSON.stringify(r.firms[0].items.map(i => [i.plate, i.driver, (i.sig || '').slice(0, 15)])), 'unsigned', r.firms[0].unsigned);
console.log('kasa header now', SS.getSheetByName('Талони').data[0].slice(20).join(','));
r = post(Object.assign({ action: 'sync', since: 0 }, M)); console.log('cashier sig', r.delta.tables.kasa.filter(k => k.sig).map(k => k.sig).join(','));
console.log('GAS OK');
