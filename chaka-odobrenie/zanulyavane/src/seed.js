/* Примерни данни за демото и тестовете (в истинското приложение не се ползват) */
function heliosSeed(T) {
  var H = HELIOS, db = H.emptyDb(), r2 = H.r2, norm = H.norm, n = 0;
  var id = function (p) { return p + (++n); };
  db.settings.address = 'Варна, бул. Цар Освободител 164 А · 089 452 4394';
  var U = [['u1', 'Собственик', 'admin', 'helios', 'admin'], ['u2', 'Мария', 'maria', '1111', 'cashier', true, 55], ['u5', 'Петя', 'petya', '5555', 'cashier', false, 55],
    ['u3', 'Иван', 'ivan', '2222', 'washer'], ['u4', 'Георги', 'georgi', '3333', 'washer']];
  U.forEach(function (x) { var salt = 's' + x[0]; db.users.push({ id: x[0], name: x[1], username: x[2], role: x[4], active: true, canAddWashers: !!x[5], dayWage: x[6] || 0, salt: salt, hash: H.passHash(salt, x[3]) }); });
  [['Кола вътре+вън', 18], ['Джип / SUV', 21], ['Бус', 25], ['Восък', 5], ['Джанти', 6]].forEach(function (x, i) { db.prices.push({ id: 's' + (i + 1), name: x[0], price: x[1], active: true, ord: i + 1 }); });
  db.firms.push({ id: 'f2', row: 2, name: 'Транс Лоджистик ЕООД', eik: '204118765', contact: 'Николай Петров', phone: '0888 123 456', email: 'office@translog.bg', list: ['СА 1111 ТТ', 'СА 2222 ТТ', 'СА 3333 ТТ'], prices: { 'Кола вътре+вън': 15, 'Бус': 20 }, active: true });
  db.firms.push({ id: 'f3', row: 3, name: 'Строй Инвест ООД', eik: '131552094', contact: 'Даниела Иванова', phone: '0877 654 321', email: '', list: ['СВ 5555 СК', 'СВ 6666 СК'], prices: { 'Джип / SUV': 18, 'Бус': 22 }, active: true });
  var seq = function () { return ++db.meta.seq; };
  var firmOf = function (np) { return db.firms.filter(function (f) { return f.list.map(norm).indexOf(np) >= 0; })[0]; };
  function K(time, plate, svc, washer, pay, cashier, date) {
    cashier = cashier || 'Мария'; date = date || T;
    var np = norm(plate), f = pay === 'firm' ? firmOf(np) : null, names = [].concat(svc);
    var items = db.prices.filter(function (x) { return names.indexOf(x.name) >= 0; }).map(function (x) { return { name: x.name, price: f && f.prices[x.name] > 0 ? f.prices[x.name] : x.price }; });
    var s = seq();
    var k = { id: id('k'), seq: s, date: date, time: time, talon: String(db.kasa.filter(function (x) { return x.date === date; }).length + 1), plate: plate, np: np,
      service: items.map(function (x) { return x.name; }).join(' + '), items: items, price: items.reduce(function (a, x) { return a + x.price; }, 0), gift: 0, washer: washer, cashier: cashier,
      void: false, reason: '', pay: pay || null, firm: f ? f.name : '', paySeq: null, payDate: null, paidAt: null, paidBy: null };
    if (k.pay && k.pay !== 'firm') { k.paySeq = s; k.payDate = date; k.paidAt = time; k.paidBy = cashier; }
    db.kasa.push(k);
  }
  function W(time, plate, svc, washer, date) { db.wash.push({ id: id('w'), date: date || T, time: time, plate: plate, np: norm(plate), service: svc || '', washer: washer }); }
  var pad = function (x) { return String(x).padStart(2, '0'); };
  var POOL = Array.from({ length: 220 }, function (_, i) { return ['В', 'ВТ', 'СА', 'СВ', 'Н', 'ТХ', 'А', 'В'][i % 8] + ' ' + (1000 + (i * 7331) % 9000) + ' ' + ['АВ', 'КМ', 'ТТ', 'ХР', 'ВС', 'НН', 'РК', 'МА'][(i * 3) % 8]; });
  var LOST = [3, 7, 12, 18, 25], cutoff = (function () { var d = new Date(T); d.setDate(d.getDate() - 38); return d.toISOString().slice(0, 10); })();
  function seedPrivate(ds, d, cnt) {
    var R = function (k) { return (d * 7919 + k * 104729 + ds.charCodeAt(6) * 31) % 97; };
    for (var i = 0; i < cnt; i++) {
      var idx = Math.floor(Math.pow(((R(i + 2) * 13 + R(i + 9)) % 97) / 97, 1.8) * 220);
      if (LOST.indexOf(idx) >= 0 && ds > cutoff) idx += 100;
      if (i === 0 && ds <= cutoff) idx = LOST[d % LOST.length];
      var plate = POOL[idx];
      var svc = [['Кола вътре+вън'], ['Кола вътре+вън'], ['Джип / SUV'], ['Кола вътре+вън', 'Восък'], ['Бус'], ['Джип / SUV', 'Джанти']][R(i + 5) % 6];
      var w = i % 2 ? 'Иван' : 'Георги', t = pad(8 + Math.floor(i * 10 / cnt)) + ':' + pad(R(i + 6) % 60);
      W(t, plate, '', w, ds); K(t, plate, svc, w, R(i + 7) % 4 ? 'cash' : 'card', 'Мария', ds);
    }
  }
  (function () { var ym = T.split('-').map(Number), pm = new Date(ym[0], ym[1] - 2, 1), py = pm.getFullYear(), pmm = pm.getMonth() + 1, nd = new Date(py, pmm, 0).getDate();
    for (var d = 1; d <= nd; d++) { if (new Date(py, pmm - 1, d).getDay() === 0) continue; seedPrivate(py + '-' + pad(pmm) + '-' + pad(d), d, 6 + d % 5); } })();
  (function () { var ym = T.split('-').map(Number), fp = ['СА 1111 ТТ', 'СА 2222 ТТ', 'СА 3333 ТТ', 'СВ 5555 СК', 'СВ 6666 СК'];
    for (var d = 1; d < ym[2]; d++) { var ds = ym[0] + '-' + pad(ym[1]) + '-' + pad(d), wd = new Date(ym[0], ym[1] - 1, d).getDay(); if (wd === 0) continue;
      var R = function (k) { return (d * 7919 + k * 104729) % 97; };
      seedPrivate(ds, d, 6 + R(1) % 7 + (wd === 6 ? 5 : 0));
      if (d % 3 === 0) continue;
      W('10:15', fp[d % 5], '', d % 2 ? 'Иван' : 'Георги', ds); K('10:15', fp[d % 5], d % 4 ? 'Бус' : 'Кола вътре+вън', d % 2 ? 'Иван' : 'Георги', 'firm', 'Мария', ds);
      if (d % 2) { W('15:40', fp[(d + 2) % 5], '', 'Георги', ds); K('15:40', fp[(d + 2) % 5], 'Джип / SUV', 'Георги', 'firm', 'Мария', ds); } } })();
  (function () { var ym = T.split('-').map(Number), pm = ym[1] === 1 ? (ym[0] - 1) + '-12' : ym[0] + '-' + pad(ym[1] - 1);
    [4, 9, 13, 18, 22, 27].forEach(function (d, i) { var ds = pm + '-' + pad(d);
      W('11:00', 'СА 1111 ТТ', '', 'Иван', ds); K('11:00', 'СА 1111 ТТ', 'Бус', 'Иван', 'firm', 'Мария', ds);
      if (i % 2) { W('14:20', 'СВ 6666 СК', '', 'Георги', ds); K('14:20', 'СВ 6666 СК', ['Джип / SUV', 'Джанти'], 'Георги', 'firm', 'Мария', ds); } });
    var paid = db.kasa.filter(function (k) { return k.date.slice(0, 7) === pm && k.firm === 'Транс Лоджистик ЕООД'; }).reduce(function (s, k) { return s + k.price; }, 0);
    db.firmPays.push({ id: 'fp1', firm: 'Транс Лоджистик ЕООД', month: pm, amount: paid, date: T.slice(0, 8) + '05', method: 'bank', note: 'Фактура 0000412', by: 'Собственик' }); })();
  // днешни коли
  W('08:10', 'СА 4521 КМ', 'Кола вътре+вън', 'Иван'); K('08:12', 'СА 4521 КМ', ['Кола вътре+вън', 'Восък'], 'Иван', 'cash');
  W('08:38', 'CB7788AP', 'Джип / SUV', 'Георги'); K('08:40', 'СВ 7788 АР', 'Джип / SUV', 'Георги', 'cash');
  W('09:14', 'РВ 1203 ТТ', 'Кола вътре+вън', 'Иван'); K('09:15', 'РВ 1203 ТТ', 'Кола вътре+вън', 'Иван', 'card');
  W('10:18', 'ЕН 3344 ВС', 'Кола вътре+вън', 'Георги'); K('10:20', 'ЕН 3344 ВС', 'Кола вътре+вън', 'Георги', 'cash');
  K('11:40', 'А 2211 КР', 'Кола вътре+вън', 'Иван', null);
  W('12:08', 'СО 5050 ОО', 'Бус', 'Георги'); K('12:10', 'СО 5050 ОО', 'Бус', 'Георги', null);
  W('13:02', 'СА 1111 ТТ', 'Бус', 'Иван'); K('13:03', 'СА 1111 ТТ', 'Бус', 'Иван', 'firm');
  W('13:30', 'СВ 5555 СК', 'Джип / SUV', 'Георги'); K('13:31', 'СВ 5555 СК', 'Джип / SUV', 'Георги', 'firm');
  // карта за лоялност назад във времето
  (function () { var L = db.settings.loyalty, by = {};
    db.kasa.filter(function (k) { return !k.void && k.pay !== 'firm' && !firmOf(k.np); }).sort(function (a, b) { return a.seq - b.seq; }).forEach(function (k) {
      var c = by[k.np] || 0;
      if (c >= L.every - 1) { var g = r2(Math.min(L.maxValue, k.price)); k.gift = g; k.price = r2(k.price - g); by[k.np] = 0; } else by[k.np] = c + 1;
    }); })();
  var dates = Array.from(new Set(db.kasa.map(function (k) { return k.date; }))).filter(function (d) { return d < T; }).sort();
  var wb = function (k) { return k.price + (k.gift || 0); };
  dates.forEach(function (d) { ['Иван', 'Георги'].forEach(function (w) {
    var a = db.kasa.filter(function (k) { return k.date === d && k.washer === w && !k.void; }).reduce(function (s, k) { return s + wb(k); }, 0) * 0.4;
    if (a > 0) db.payouts.push({ id: id('p'), seq: seq(), date: d, time: '19:00', washer: w, amount: r2(a), cashier: 'Мария', kind: null }); }); });
  dates.slice(0, -1).forEach(function (d) { db.payouts.push({ id: id('p'), seq: seq(), date: d, time: '19:10', washer: 'Мария', amount: 55, cashier: 'Мария', kind: 'cashier' }); });
  (function () { var last = db.payouts.filter(function (x) { return x.washer === 'Георги'; }).pop(); if (last) { last.amount = r2(last.amount - 20); last.time = '19:05'; } })();
  dates.forEach(function (d) { db.logins.push({ id: id('l'), name: 'Мария', date: d }); });
  // вчерашната смяна е приключена, пликът ѝ още е в касата; днешната е отворена
  var yd = dates[dates.length - 1];
  if (yd) {
    var s = { id: 'h1', no: 127, date: yd, openSeq: 0, openT: '07:50', openBy: 'Мария', openCash: 50, openDiff: 0, prevBy: '', mode: 'day', closeSeq: db.meta.seq, closeT: '20:05', closeBy: 'Мария' };
    db.shifts.push(s);
    var tmp = H.Engine(db, { today: function () { return yd; }, now: function () { return '20:05'; }, uid: function () { return 'x'; } });
    var admin = db.users[0];
    // сметката на смяната: пускаме я през логиката
    s.closeT = null; s.closeSeq = null; var st = tmp.handle({ action: 'shiftState', _d: yd }, admin).shift; s.closeT = '20:05'; s.closeSeq = db.meta.seq;
    Object.assign(s, { counted: st.expected, expected: st.expected, diff: 0, leftFloat: 50, envelope: r2(st.expected - 50) });
    db.envs.push({ id: 'e127', label: 'Плик смяна № 127', date: yd, amount: s.envelope, byOwner: false, receivedBy: null, receivedAmount: null, receivedAt: null });
  }
  db.shifts.push({ id: 'h2', no: 128, date: T, openSeq: yd ? db.meta.seq : 0, openT: '07:55', openBy: 'Мария', openCash: 50, openDiff: 0, prevBy: 'Мария', mode: null, closeSeq: null, closeT: null, closeBy: null, counted: null, expected: null, diff: null, leftFloat: null, envelope: null });
  // днешните талони трябва да са след отварянето на смяната
  db.kasa.filter(function (k) { return k.date === T; }).forEach(function (k) { k.seq = seq(); if (k.paySeq != null) k.paySeq = k.seq; });
  db.logins.push({ id: id('l'), name: 'Мария', date: T });
  // версии за синхронизация
  Object.keys(H.TABLES).forEach(function (t) { db[t].forEach(function (r) { if (!H.TABLES[t].server) r.v = ++db.meta.v; }); });
  db.meta.sv = ++db.meta.v;
  return db;
}
if (typeof module !== 'undefined') module.exports = heliosSeed;
