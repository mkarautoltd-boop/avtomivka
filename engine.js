/* =====================================================================
   HELIOS Каса — обща логика
   Един и същ код работи на сървъра (Google Apps Script) и на касата
   (в браузъра, когато няма интернет). Не зависи от Google или браузъра.
   ===================================================================== */
var HELIOS = (function () {
  'use strict';

  // ---------- схема на таблиците (листовете в Google Sheets) ----------
  // тип: s = текст, S = текст или празно, n = число, N = число или празно, b = да/не, j = JSON
  var TABLES = {
    users:    { sheet: 'Потребители', cols: [['id','s'],['name','s'],['username','s'],['role','s'],['active','b'],['canAddWashers','b'],['dayWage','n'],['salt','s'],['hash','s'],['v','n']] },
    prices:   { sheet: 'Услуги', cols: [['id','s'],['name','s'],['price','n'],['active','b'],['ord','n'],['v','n']] },
    firms:    { sheet: 'Фирми', cols: [['id','s'],['row','n'],['name','s'],['eik','s'],['contact','s'],['phone','s'],['email','s'],['list','j'],['prices','j'],['active','b'],['v','n']] },
    kasa:     { sheet: 'Талони', cols: [['id','s'],['seq','n'],['date','s'],['time','s'],['talon','s'],['plate','s'],['np','s'],['service','s'],['items','j'],['price','n'],['gift','n'],['washer','s'],['cashier','s'],['void','b'],['reason','s'],['pay','S'],['firm','s'],['paySeq','N'],['payDate','S'],['paidAt','S'],['paidBy','S'],['v','n']] },
    wash:     { sheet: 'Миене', cols: [['id','s'],['date','s'],['time','s'],['plate','s'],['np','s'],['service','s'],['washer','s'],['v','n']] },
    payouts:  { sheet: 'Изплащания', cols: [['id','s'],['seq','n'],['date','s'],['time','s'],['washer','s'],['amount','n'],['cashier','s'],['kind','S'],['v','n']] },
    firmPays: { sheet: 'ФирмениПлащания', cols: [['id','s'],['firm','s'],['month','s'],['amount','n'],['date','s'],['method','s'],['note','s'],['by','s'],['v','n']] },
    shifts:   { sheet: 'Смени', cols: [['id','s'],['no','n'],['date','s'],['openSeq','n'],['openT','s'],['openBy','s'],['openCash','n'],['openDiff','n'],['prevBy','s'],['mode','S'],['closeSeq','N'],['closeT','S'],['closeBy','S'],['counted','N'],['expected','N'],['diff','N'],['leftFloat','N'],['envelope','N'],['v','n']] },
    envs:     { sheet: 'Пликове', cols: [['id','s'],['label','s'],['date','s'],['amount','n'],['byOwner','b'],['receivedBy','S'],['receivedAmount','N'],['receivedAt','S'],['v','n']] },
    takes:    { sheet: 'ВзетоОтПликове', cols: [['id','s'],['env','s'],['seq','n'],['date','s'],['time','s'],['amount','n'],['note','s'],['by','s'],['v','n']] },
    logins:   { sheet: 'Влизания', cols: [['id','s'],['name','s'],['date','s'],['v','n']] },
    ops:      { sheet: 'Операции', server: true, cols: [['cid','s'],['action','s'],['at','s']] }
  };
  var SYNCED = ['users', 'prices', 'firms', 'kasa', 'wash', 'payouts', 'firmPays', 'shifts', 'envs', 'takes', 'logins'];
  var DEFAULT_SETTINGS = { talonName: 'АВТОМИВКА HELIOS', address: '', clientTalon: false, pct: 40,
    loyalty: { on: true, every: 10, maxValue: 18, payWasher: true } };
  // действия, които касата може да направи и без интернет
  var OFFLINE_WRITE = ['addKasa', 'payKasa', 'payWasher', 'takeWage', 'envTake', 'openShift', 'closeShift', 'login'];
  var LOCAL_READ = ['myDay', 'payroll', 'shiftState', 'loyalty'];
  var WRITE = OFFLINE_WRITE.concat(['saveUser', 'saveLoyalty', 'saveSettings', 'savePrice', 'movePrice', 'addWash', 'receiveEnvelope', 'envAdd', 'firmPay', 'saveFirm', 'voidKasa']);

  var r2 = function (x) { return Math.round((+x || 0) * 100) / 100; };
  var num = function (v) { return r2(Number(String(v == null ? '' : v).replace(',', '.')) || 0); };
  var LAT = { 'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X' };
  function norm(s) { return String(s || '').toUpperCase().replace(/[АВЕКМНОРСТУХ]/g, function (c) { return LAT[c]; }).replace(/[^A-Z0-9]/g, ''); }
  function sum(a, f) { var t = 0; for (var i = 0; i < a.length; i++) t += f(a[i]); return t; }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }

  // ---------- SHA-256 (за паролите; еднакво на сървъра и на касата) ----------
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mp = Math.pow, maxWord = mp(2, 32), result = '', words = [], i, j;
    var str = unescape(encodeURIComponent(ascii)), bitLen = str.length * 8;
    var hash = [], k = [], primeCounter = 0, isComposite = {};
    for (var cand = 2; primeCounter < 64; cand++) {
      if (!isComposite[cand]) {
        for (i = 0; i < 313; i += cand) isComposite[i] = cand;
        hash[primeCounter] = (mp(cand, .5) * maxWord) | 0;
        k[primeCounter++] = (mp(cand, 1 / 3) * maxWord) | 0;
      }
    }
    hash = hash.slice(0, 8);
    str += '\x80';
    while (str.length % 64 - 56) str += '\x00';
    for (i = 0; i < str.length; i++) { j = str.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
    words[words.length] = ((bitLen / maxWord) | 0); words[words.length] = (bitLen);
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var temp1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash); hash[4] = (hash[4] + temp1) | 0; hash.length = 8;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? 0 : '') + b.toString(16); }
    return result;
  }
  function passHash(salt, pass) { return sha256('helios|' + salt + '|' + pass); }

  // =====================================================================
  //  ENGINE — всички правила на касата
  // =====================================================================
  function Engine(db, env) {
    var T = env.today(), NOW = null;
    var now = function () { return NOW || env.now(); };
    var SET = function () { return db.settings; };
    var PCT = function () { return Number(db.settings.pct) || 40; };
    var nextSeq = function () { db.meta.seq = (Number(db.meta.seq) || 0) + 1; return db.meta.seq; };
    var uid = function (pfx) { return (pfx || '') + env.uid(); };
    var wb = function (k) { return k.price + (SET().loyalty.payWasher ? (k.gift || 0) : 0); };   // база за заплатата на мияча
    var washers = function () { return db.users.filter(function (u) { return u.role === 'washer' && u.active; }).map(function (u) { return u.name; }); };
    var pricesSorted = function () { return db.prices.slice().sort(function (a, b) { return a.ord - b.ord; }); };
    var activeP = function () { return pricesSorted().filter(function (x) { return x.active; }).map(function (x) { return { name: x.name, price: x.price }; }); };
    var activeFirms = function () { return db.firms.filter(function (f) { return f.active; }).map(function (f) { return { name: f.name, eik: f.eik, prices: f.prices || {}, plates: (f.list || []).map(norm) }; }); };
    var firmOf = function (np) { return activeFirms().filter(function (f) { return f.plates.indexOf(np) >= 0; })[0]; };

    function stamps(np) {
      var c = 0;
      db.kasa.filter(function (k) { return !k.void && k.np === np && k.pay !== 'firm'; }).sort(function (a, b) { return a.seq - b.seq; })
        .forEach(function (k) { c = k.gift ? 0 : c + 1; });
      return c;
    }
    // ---------- смени и пликове ----------
    var inShift = function (s, x) { return x.date === s.date && x.seq > s.openSeq && (s.closeSeq == null || x.seq <= s.closeSeq); };
    var envById = function (id) { return db.envs.filter(function (e) { return e.id === id; })[0]; };
    var envTakes = function () { return db.takes.map(function (t) { var e = envById(t.env); return Object.assign({ envLabel: e ? e.label : '' }, t); }); };
    var envLeft = function (e) { return r2(e.amount - sum(db.takes.filter(function (t) { return t.env === e.id; }), function (t) { return t.amount; })); };
    var envOpen = function () { return db.envs.filter(function (e) { return !e.receivedAt; }); };
    var envTotal = function () { return r2(sum(envOpen(), envLeft)); };
    var envView = function (e) {
      return Object.assign({}, e, { left: envLeft(e),
        taken: db.takes.filter(function (t) { return t.env === e.id; }).map(function (t) { return { date: t.date, time: t.time, amount: t.amount, note: t.note, by: t.by }; }),
        received: e.receivedAt ? { by: e.receivedBy, amount: e.receivedAmount, at: e.receivedAt } : null });
    };
    function shiftCalc(s) {
      var tal = db.kasa.filter(function (k) { return inShift(s, k); }), act = tal.filter(function (k) { return !k.void; });
      var pays = db.payouts.filter(function (x) { return inShift(s, x); }), takes = envTakes().filter(function (x) { return inShift(s, x); });
      var paidIn = db.kasa.filter(function (k) { return !k.void && k.pay && k.pay !== 'firm' && k.paySeq != null && inShift(s, { date: k.payDate, seq: k.paySeq }); });
      var cash = sum(paidIn.filter(function (k) { return k.pay === 'cash'; }), function (k) { return k.price; });
      var unpaid = db.kasa.filter(function (k) { return !k.void && !k.pay; });
      var byW = {}, isC = {}; pays.forEach(function (x) { byW[x.washer] = (byW[x.washer] || 0) + x.amount; if (x.kind === 'cashier') isC[x.washer] = 1; });
      var byC = {}; act.forEach(function (k) { byC[k.cashier] = (byC[k.cashier] || 0) + 1; });
      return Object.assign({}, s, {
        talons: act.length, voided: tal.length - act.length, revenue: r2(sum(act, function (k) { return k.price; })), cash: r2(cash),
        card: r2(sum(paidIn.filter(function (k) { return k.pay === 'card'; }), function (k) { return k.price; })),
        firm: r2(sum(act.filter(function (k) { return k.pay === 'firm'; }), function (k) { return k.price; })),
        unpaidN: unpaid.length, unpaidSum: r2(sum(unpaid, function (k) { return k.price; })),
        paidTill: r2(sum(pays, function (x) { return x.amount; })),
        tillByWasher: Object.keys(byW).map(function (n) { return { name: n, amount: r2(byW[n]), cashier: !!isC[n] }; }), byCashier: byC,
        takes: takes.map(function (t) { return { env: t.envLabel, amount: t.amount, note: t.note, by: t.by, time: t.time }; }),
        taken: r2(sum(takes, function (t) { return t.amount; })),
        expected: r2(s.openCash + cash + sum(takes, function (t) { return t.amount; }) - sum(pays, function (x) { return x.amount; }))
      });
    }
    var openShift = function () { return db.shifts.filter(function (s) { return !s.closeT; })[0]; };
    var closedShifts = function () { return db.shifts.filter(function (s) { return s.closeT; }).sort(function (a, b) { return a.no - b.no; }); };
    var lastClosed = function () { var c = closedShifts(); return c[c.length - 1]; };
    function firmDebts() {
      var by = {};
      db.kasa.filter(function (k) { return k.pay === 'firm' && !k.void; }).forEach(function (k) { var key = k.firm + '|' + k.date.slice(0, 7); by[key] = (by[key] || 0) + k.price; });
      return Object.keys(by).map(function (key) {
        var p = key.split('|'), firm = p[0], month = p[1];
        var paid = sum(db.firmPays.filter(function (x) { return x.firm === firm && x.month === month; }), function (x) { return x.amount; });
        return { firm: firm, month: month, total: r2(by[key]), rest: r2(by[key] - paid) };
      }).filter(function (x) { return x.rest > 0.004; }).sort(function (a, b) { return a.month < b.month ? -1 : a.month > b.month ? 1 : 0; });
    }
    function payroll() {
      return washers().map(function (n) {
        var mine = db.kasa.filter(function (k) { return k.washer === n && !k.void; });
        var paid = db.payouts.filter(function (x) { return x.washer === n && x.kind !== 'cashier'; });
        var amt = function (x) { return x.amount; };
        var prev = r2(sum(mine.filter(function (k) { return k.date < T; }), wb) * PCT() / 100 - sum(paid.filter(function (x) { return x.date < T; }), amt));
        return { name: n, prev: prev, earnedToday: r2(sum(mine.filter(function (k) { return k.date === T; }), wb) * PCT() / 100),
          paidToday: r2(sum(paid.filter(function (x) { return x.date === T; }), amt)), owed: r2(sum(mine, wb) * PCT() / 100 - sum(paid, amt)) };
      });
    }
    function dayData(d) {
      var K2 = db.kasa.filter(function (k) { return k.date === d; }).map(function (k) { return Object.assign({}, k); });
      var W2 = db.wash.filter(function (w) { return w.date === d; }).map(function (w) { return Object.assign({}, w); });
      var active = K2.filter(function (k) { return !k.void; }), used = {};
      W2.forEach(function (w) {
        var k = active.filter(function (k) { return !used[k.id] && k.np === w.np && k.washer === w.washer; })[0];
        if (!k) k = active.filter(function (k) { return !used[k.id] && k.np === w.np; })[0];
        w.matched = !!k; if (k) used[k.id] = true;
      });
      active.forEach(function (k) { k.matched = !!used[k.id]; });
      return { kasa: K2, wash: W2, active: active };
    }
    // дни, в които касиерът е работил: влизане, талони, смяна или взет надник
    function workDays(name) {
      return uniq(db.kasa.filter(function (k) { return k.cashier === name; }).map(function (k) { return k.date; })
        .concat(db.logins.filter(function (x) { return x.name === name; }).map(function (x) { return x.date; }))
        .concat(db.shifts.filter(function (s) { return s.openBy === name || s.closeBy === name; }).map(function (s) { return s.date; }))
        .concat(db.payouts.filter(function (x) { return x.kind === 'cashier' && x.washer === name; }).map(function (x) { return x.date; }))).sort();
    }
    function cashRoll(c) {
      var w = r2(c.dayWage || 0), days = workDays(c.name), paid = db.payouts.filter(function (x) { return x.kind === 'cashier' && x.washer === c.name; });
      var s = function (a) { return r2(sum(a, function (x) { return x.amount; })); };
      var prev = r2(days.filter(function (d) { return d < T; }).length * w - s(paid.filter(function (x) { return x.date < T; })));
      var earnedToday = days.indexOf(T) >= 0 ? w : 0, paidToday = s(paid.filter(function (x) { return x.date === T; }));
      return { name: c.name, wage: w, prev: prev, earnedToday: earnedToday, paidToday: paidToday, owed: r2(prev + earnedToday - paidToday),
        takes: paid.filter(function (x) { return x.date === T; }).map(function (x) { return { time: x.time, amount: x.amount }; }) };
    }
    var cashierPay = function (d) { return r2(sum(db.payouts.filter(function (x) { return x.kind === 'cashier' && x.date.slice(0, d.length) === d; }), function (x) { return x.amount; })); };
    function need(u, r) { if (r.indexOf(u.role) < 0) throw new Error('Нямаш права за това'); }
    var find = function (arr, f) { return arr.filter(f)[0]; };
    var noPass = function (x) { var c = Object.assign({}, x); delete c.salt; delete c.hash; delete c.v; return c; };

    function handle(p, u) {
      T = p._d || env.today(); NOW = p._t || null;
      var user = { id: u.id, name: u.name, role: u.role, canAddWashers: !!u.canAddWashers, dayWage: u.dayWage || 0 };
      var S = SET();
      switch (p.action) {
        case 'login':
          if (u.role === 'cashier' && !db.logins.some(function (x) { return x.name === u.name && x.date === T; }))
            db.logins.push({ id: p.cid || uid('l'), name: u.name, date: T });
          return { user: user, talonName: S.talonName, address: S.address, clientTalon: !!S.clientTalon, prices: activeP(), washers: washers(), firms: activeFirms(), today: T };

        case 'users':
          if (u.role === 'admin') return { users: db.users.map(noPass) };
          if (u.role === 'cashier' && u.canAddWashers) return { users: db.users.filter(function (x) { return x.role === 'washer'; }).map(function (x) { return { id: x.id, name: x.name, role: x.role, active: x.active }; }) };
          throw new Error('Нямаш права за това');

        case 'saveUser': {
          var isAdmin = u.role === 'admin';
          if (!isAdmin && !(u.role === 'cashier' && u.canAddWashers)) throw new Error('Нямаш права да добавяш хора');
          if (!isAdmin && (p.id || p.role !== 'washer')) throw new Error('Касиерът може само да добавя нови миячи');
          var name = String(p.name || '').trim(), username = String(p.username || '').trim().toLowerCase(), pass = String(p.newPass || '');
          if (!name) throw new Error('Въведи име');
          if (!/^[a-z0-9._-]{3,20}$/.test(username)) throw new Error('Потребителското име: 3–20 знака, само латиница, цифри, точка, тире');
          if (db.users.some(function (x) { return x.id !== p.id && x.username === username; })) throw new Error('Това потребителско име е заето');
          var ex = find(db.users, function (x) { return x.id === p.id; });
          if (!ex && pass.length < 6) throw new Error('Паролата трябва да е поне 6 знака');
          if (ex && pass && pass.length < 6) throw new Error('Паролата трябва да е поне 6 знака');
          if (['cashier', 'washer', 'admin'].indexOf(p.role) < 0) throw new Error('Избери роля');
          if (db.users.some(function (x) { return x.id !== p.id && x.name.toLowerCase() === name.toLowerCase(); })) throw new Error('Вече има човек с това име');
          if (ex && ex.role === 'admin' && (p.role !== 'admin' || p.active === false)) throw new Error('Собственикът не може да бъде спрян');
          if (!ex && p.role === 'admin') throw new Error('Избери роля');
          var rec = { name: name, username: username, role: p.role, active: p.active !== false, canAddWashers: p.role === 'cashier' && !!p.canAddWashers };
          if (isAdmin && p.role === 'cashier') { var dw = num(p.dayWage); if (dw < 0 || dw > 500) throw new Error('Невалиден надник'); rec.dayWage = dw; }
          if (pass) { rec.salt = env.uid() + env.uid(); rec.hash = passHash(rec.salt, pass); }
          if (ex) {
            if (ex.name !== name) rename(ex.name, name, ex.role);
            Object.assign(ex, rec);
          } else db.users.push(Object.assign({ id: uid('u'), dayWage: 0 }, rec));
          return {};
        }
        case 'getSettings': need(u, ['admin']); return JSON.parse(JSON.stringify(S));
        case 'saveLoyalty': {
          need(u, ['admin']);
          var every = Math.round(Number(p.every) || 0), maxValue = num(p.maxValue);
          if (every < 2 || every > 50) throw new Error('„Всяко … измиване“ трябва да е между 2 и 50');
          if (maxValue <= 0) throw new Error('Въведи до каква стойност е подаръкът');
          S.loyalty = { on: !!p.on, every: every, maxValue: maxValue, payWasher: !!p.payWasher }; return {};
        }
        case 'loyalty': {
          need(u, ['cashier', 'admin']);
          var np = norm(p.plate), L = S.loyalty;
          if (!L.on || np.length < 3 || firmOf(np)) return { on: false };
          var c = stamps(np); return { on: true, every: L.every, maxValue: L.maxValue, stamps: c, freeNow: c >= L.every - 1 };
        }
        case 'saveSettings':
          need(u, ['admin']);
          if (!String(p.talonName || '').trim()) throw new Error('Въведи име на автомивката');
          S.talonName = String(p.talonName).trim(); S.address = String(p.address || '').trim(); S.clientTalon = !!p.clientTalon; return {};

        case 'pricesAll': need(u, ['admin']); return { prices: pricesSorted().map(function (x) { return { id: x.id, name: x.name, price: x.price, active: x.active }; }) };
        case 'savePrice': {
          need(u, ['admin']);
          var pn = String(p.name || '').trim(), price = num(p.price);
          if (!pn) throw new Error('Въведи име на услугата');
          if (price <= 0) throw new Error('Въведи цена по-голяма от 0');
          if (db.prices.some(function (x) { return x.id !== p.id && x.name.toLowerCase() === pn.toLowerCase(); })) throw new Error('Вече има услуга с това име');
          var pe = find(db.prices, function (x) { return x.id === p.id; });
          if (pe && pe.name !== pn) db.firms.forEach(function (f) {   // фирмените цени следват новото име
            if (f.prices && f.prices[pe.name] !== undefined) { var np2 = Object.assign({}, f.prices); np2[pn] = np2[pe.name]; delete np2[pe.name]; f.prices = np2; }
          });
          if (pe) Object.assign(pe, { name: pn, price: price, active: p.active !== false });
          else db.prices.push({ id: uid('s'), name: pn, price: price, active: true, ord: db.prices.reduce(function (m, x) { return Math.max(m, x.ord); }, 0) + 1 });
          return { prices: activeP() };
        }
        case 'movePrice': {
          need(u, ['admin']);
          var ps = pricesSorted(), i = -1;
          ps.forEach(function (x, ix) { if (x.id === p.id) i = ix; });
          var j = i + (p.dir === 'up' ? -1 : 1);
          if (i >= 0 && j >= 0 && j < ps.length) { var t = ps[i].ord; ps[i].ord = ps[j].ord; ps[j].ord = t; if (ps[i].ord === ps[j].ord) { ps.forEach(function (x, ix) { x.ord = ix + 1; }); t = ps[i].ord; ps[i].ord = ps[j].ord; ps[j].ord = t; } }
          return { prices: activeP() };
        }

        case 'addKasa': {
          need(u, ['cashier', 'admin']);
          if (!openShift()) throw new Error('Първо отвори смяна');
          var plate = String(p.plate || '').trim().toUpperCase(), np0 = norm(plate);
          if (np0.length < 3) throw new Error('Въведи регистрационен номер');
          var names = [].concat(p.services || []);
          if (!db.prices.some(function (x) { return x.active && names.indexOf(x.name) >= 0; })) throw new Error('Отметни поне една услуга');
          if (washers().indexOf(p.washer) < 0) throw new Error('Избери мияч');
          // фирмените коли се разпознават по номера; всички останали плащат при взимане на колата
          var f = firmOf(np0), L2 = S.loyalty;
          var eligible = L2.on && !f && stamps(np0) >= L2.every - 1;
          var items = pricesSorted().filter(function (x) { return x.active && names.indexOf(x.name) >= 0; })
            .map(function (x) { return { name: x.name, price: f && f.prices[x.name] > 0 ? f.prices[x.name] : x.price }; });
          var seq = nextSeq(), time = now();
          var k = { id: p.cid || uid('k'), seq: seq, date: T, time: time,
            talon: String(p.talon || (db.kasa.filter(function (x) { return x.date === T; }).length + 1)),
            plate: plate, np: np0, service: items.map(function (x) { return x.name; }).join(' + '), items: items,
            price: r2(sum(items, function (x) { return x.price; })), gift: 0, washer: p.washer, cashier: u.name, void: false, reason: '',
            pay: f ? 'firm' : null, firm: f ? f.name : '', paySeq: null, payDate: null, paidAt: null, paidBy: null };
          if (eligible && p.useGift) { k.gift = r2(Math.min(L2.maxValue, k.price)); k.price = r2(k.price - k.gift); }
          if (!k.pay && k.price <= 0) { k.pay = 'cash'; k.paySeq = seq; k.payDate = T; k.paidAt = time; k.paidBy = u.name; }   // изцяло подарък
          db.kasa.push(k);
          var st = L2.on && !f ? stamps(np0) : null;
          return { id: k.id, talon: k.talon, date: k.date, time: k.time, plate: plate, service: k.service, items: k.items, price: k.price, gift: k.gift,
            loy: st == null ? null : { stamps: st, every: L2.every }, washer: p.washer, cashier: u.name, pay: k.pay, firm: k.firm };
        }
        case 'payKasa': {
          need(u, ['cashier', 'admin']);
          if (!openShift()) throw new Error('Първо отвори смяна');
          var kk = find(db.kasa, function (x) { return x.id === p.id; }); if (!kk || kk.void) throw new Error('Талонът не е намерен');
          if (kk.pay) throw new Error('Талон № ' + kk.talon + ' вече е платен');
          if (['cash', 'card'].indexOf(p.pay) < 0) throw new Error('Избери в брой или карта');
          Object.assign(kk, { pay: p.pay, paySeq: nextSeq(), payDate: T, paidAt: now(), paidBy: u.name });
          return { id: kk.id, talon: kk.talon, plate: kk.plate, price: kk.price, pay: kk.pay };
        }
        case 'addWash': {
          need(u, ['washer']);
          var wp = String(p.plate || '').trim().toUpperCase();
          var tt = find(dayData(T).active, function (k) { return !k.matched && k.np === norm(wp) && k.washer === u.name; });
          if (!tt) throw new Error('Няма талон за тази кола — изпрати клиента на касата');
          db.wash.push({ id: uid('w'), date: T, time: now(), plate: wp, np: norm(wp), service: '', washer: u.name });
          return {};
        }
        case 'myDay': {
          var dd = dayData(T), K2 = dd.kasa, W2 = dd.wash, active = dd.active;
          if (u.role === 'washer') {
            var cars = active.filter(function (k) { return k.washer === u.name; });
            var mine = W2.filter(function (w) { return w.washer === u.name; }).reverse();
            var pr = find(payroll(), function (x) { return x.name === u.name; }) || { owed: 0, prev: 0 };
            return {
              items: mine.map(function (w) { return { plate: w.plate, time: w.time, service: w.service, matched: w.matched }; }),
              logged: mine.length, withReceipt: mine.filter(function (w) { return w.matched; }).length, carsKasa: cars.length,
              pay: r2(sum(cars, wb) * PCT() / 100), owed: pr.owed, prev: pr.prev,
              pending: active.filter(function (k) { return k.washer === u.name && !k.matched; }).map(function (k) { return { plate: k.plate, talon: k.talon, time: k.time }; }).reverse(),
              paidToday: r2(sum(db.payouts.filter(function (x) { return x.date === T && x.washer === u.name; }), function (x) { return x.amount; }))
            };
          }
          var mineK = K2.slice().reverse(), os = openShift(), lc = lastClosed();
          return { items: mineK, total: r2(sum(mineK.filter(function (k) { return !k.void; }), function (k) { return k.price; })),
            firms: activeFirms(), prices: activeP(), talonName: S.talonName, address: S.address, clientTalon: !!S.clientTalon, canAddWashers: !!u.canAddWashers, washers: washers(),
            unpaid: db.kasa.filter(function (k) { return !k.void && !k.pay; }).map(function (k) {
              return { id: k.id, talon: k.talon, date: k.date, time: k.time, plate: k.plate, np: k.np, service: k.service, items: k.items, price: k.price, gift: k.gift || 0, washer: k.washer,
                washed: db.wash.some(function (w) { return w.date === k.date && w.np === k.np && w.washer === k.washer; }) }; }),
            cash: r2(sum(active.filter(function (k) { return k.pay === 'cash'; }), function (k) { return k.price; })),
            paidOut: r2(sum(db.payouts.filter(function (x) { return x.date === T; }), function (x) { return x.amount; })),
            shift: os ? shiftCalc(os) : null, envTotal: envTotal(), lastFloat: lc ? lc.leftFloat || 0 : 0, lastBy: lc ? lc.closeBy || '' : '' };
        }
        case 'payroll':
          need(u, ['cashier', 'admin']);
          return { washers: payroll(), payments: db.payouts.filter(function (x) { return x.date === T; }).slice().reverse(), me: u.role === 'cashier' ? cashRoll(u) : null };
        case 'takeWage': {
          need(u, ['cashier']);
          var sh = openShift(); if (!sh) throw new Error('Първо отвори смяна');
          var roll = cashRoll(u), w = num(p.amount);
          if (w <= 0) throw new Error('Въведи сума');
          if (w > roll.owed + 0.009) throw new Error('Имаш да вземаш само ' + roll.owed.toFixed(2) + ' €');
          var inTill = shiftCalc(sh).expected;
          if (w > inTill + 0.009) throw new Error('В касата има само ' + inTill.toFixed(2) + ' € — първо вземи от плик');
          db.payouts.push({ id: p.cid || uid('p'), seq: nextSeq(), date: T, time: now(), washer: u.name, amount: w, cashier: u.name, kind: 'cashier' });
          return { amount: w, left: r2(roll.owed - w) };
        }
        case 'payWasher': {
          need(u, ['cashier', 'admin']);
          var amount = num(p.amount); if (amount <= 0) throw new Error('Въведи сума');
          var wr = find(payroll(), function (x) { return x.name === p.washer; }); if (!wr) throw new Error('Избери мияч');
          if (amount > wr.owed + 0.009) throw new Error('Сумата е по-голяма от дължимото (' + wr.owed.toFixed(2) + ' €)');
          var sh2 = openShift(); if (!sh2) throw new Error('Първо отвори смяна');
          var inTill2 = shiftCalc(sh2).expected;
          if (amount > inTill2 + 0.009) throw new Error('В касата има само ' + inTill2.toFixed(2) + ' € — първо вземи от плик');
          db.payouts.push({ id: p.cid || uid('p'), seq: nextSeq(), date: T, time: now(), washer: wr.name, amount: amount, cashier: u.name, kind: null });
          return { washer: wr.name, amount: amount };
        }
        case 'shiftState': {
          need(u, ['cashier', 'admin']);
          var s0 = openShift(), last = lastClosed();
          return { shift: s0 ? shiftCalc(s0) : null, lastFloat: last ? last.leftFloat || 0 : 0, lastBy: last ? last.closeBy : '', lastMode: last ? last.mode : '',
            envelopes: envOpen().map(function (e) { return { id: e.id, label: e.label, date: e.date, left: envLeft(e) }; }) };
        }
        case 'openShift': {
          need(u, ['cashier', 'admin']);
          if (openShift()) throw new Error('Вече има отворена смяна');
          var cash = num(p.cash); if (cash < 0) throw new Error('Невалидна сума');
          var no = db.shifts.reduce(function (m, s) { return Math.max(m, s.no); }, 0) + 1, lc2 = lastClosed();
          db.shifts.push({ id: p.cid || uid('h'), no: no, date: T, openSeq: Number(db.meta.seq) || 0, openT: now(), openBy: u.name, openCash: cash,
            openDiff: lc2 ? r2(cash - (lc2.leftFloat || 0)) : 0, prevBy: lc2 ? lc2.closeBy : '', mode: null, closeSeq: null, closeT: null, closeBy: null,
            counted: null, expected: null, diff: null, leftFloat: null, envelope: null });
          return { no: no };
        }
        case 'closeShift': {
          need(u, ['cashier', 'admin']);
          var s1 = openShift(); if (!s1) throw new Error('Няма отворена смяна');
          var mode = p.mode === 'handover' ? 'handover' : 'day';
          var counted = num(p.counted), left = mode === 'handover' ? counted : num(p.leftFloat);
          if (counted < 0 || left < 0) throw new Error('Невалидна сума');
          if (left > counted + 0.009) throw new Error('Не може да оставиш повече, отколкото си преброил');
          var cc = shiftCalc(s1);
          Object.assign(s1, { mode: mode, closeSeq: Number(db.meta.seq) || 0, closeT: now(), closeBy: u.name, counted: counted, expected: cc.expected,
            diff: r2(counted - cc.expected), leftFloat: left, envelope: r2(counted - left) });
          if (mode === 'day' && s1.envelope > 0) db.envs.push({ id: (p.cid ? p.cid + 'e' : uid('e')), label: 'Плик смяна № ' + s1.no, date: T, amount: s1.envelope, byOwner: false, receivedBy: null, receivedAmount: null, receivedAt: null });
          return { shift: shiftCalc(s1) };
        }
        case 'envTake': {
          need(u, ['cashier', 'admin']);
          if (!openShift()) throw new Error('Първо отвори смяна');
          var e = find(db.envs, function (x) { return x.id === p.id && !x.receivedAt; }); if (!e) throw new Error('Избери плик');
          var ea = num(p.amount); if (ea <= 0) throw new Error('Въведи сума');
          if (ea > envLeft(e) + 0.009) throw new Error('В плика има само ' + envLeft(e).toFixed(2) + ' €');
          db.takes.push({ id: p.cid || uid('t'), env: e.id, seq: nextSeq(), date: T, time: now(), amount: ea, note: String(p.note || '').trim() || 'за заплати', by: u.name });
          return { left: envLeft(e) };
        }
        case 'shifts': {
          need(u, ['admin']);
          var d = p.date || T;
          return { shifts: db.shifts.filter(function (s) { return s.date === d; }).sort(function (a, b) { return b.no - a.no; }).map(shiftCalc),
            envelopes: db.envs.filter(function (e) { return !e.receivedAt || String(e.receivedAt).slice(0, 10) === d; }).map(envView).reverse(), envTotal: envTotal() };
        }
        case 'receiveEnvelope': {
          need(u, ['admin']);
          var re = find(db.envs, function (x) { return x.id === p.id; }); if (!re || re.receivedAt) throw new Error('Пликът вече е приет');
          Object.assign(re, { receivedBy: u.name, receivedAmount: num(p.amount), receivedAt: T + ' ' + now() }); return {};
        }
        case 'envAdd': {
          need(u, ['admin']);
          var aa = num(p.amount); if (aa <= 0) throw new Error('Въведи сума');
          db.envs.push({ id: uid('o'), label: String(p.note || '').trim() || 'Плик от собственика', date: T, amount: aa, byOwner: true, receivedBy: null, receivedAmount: null, receivedAt: null });
          return { envTotal: envTotal() };
        }
        case 'report': {
          need(u, ['admin']);
          var rd = p.date || T, x = dayData(rd), pays = db.payouts.filter(function (y) { return y.date === rd; }), rl = payroll();
          var act = x.active, amt = function (y) { return y.price; };
          var ws = washers().map(function (nm) {
            var cs = act.filter(function (k) { return k.washer === nm; }), lg = x.wash.filter(function (w) { return w.washer === nm; }), rr = find(rl, function (y) { return y.name === nm; });
            return { name: nm, carsKasa: cs.length, logged: lg.length, noReceipt: lg.filter(function (w) { return !w.matched; }).length, revenue: r2(sum(cs, amt)), pay: r2(sum(cs, wb) * PCT() / 100),
              paidDay: r2(sum(pays.filter(function (y) { return y.washer === nm; }), function (y) { return y.amount; })), owed: rr.owed, prev: rr.prev };
          });
          var rev = sum(act, amt), nr = x.wash.filter(function (w) { return !w.matched; }), nw = act.filter(function (k) { return !k.matched; });
          var cp = cashierPay(rd), wp2 = sum(act, wb) * PCT() / 100;
          return { date: rd, pct: PCT(),
            totals: { carsKasa: act.length, carsWash: x.wash.length, noReceipt: nr.length, noWasher: nw.length, revenue: r2(rev), washerPay: r2(wp2),
              gifts: act.filter(function (k) { return k.gift; }).length, giftValue: r2(sum(act, function (k) { return k.gift || 0; })),
              revenueCash: r2(sum(act.filter(function (k) { return k.pay === 'cash'; }), amt)), revenueCard: r2(sum(act.filter(function (k) { return k.pay === 'card'; }), amt)),
              revenueFirm: r2(sum(act.filter(function (k) { return k.pay === 'firm'; }), amt)),
              unpaid: act.filter(function (k) { return !k.pay; }).length, revenueUnpaid: r2(sum(act.filter(function (k) { return !k.pay; }), amt)),
              cashierPay: cp, company: r2(rev - wp2 - cp), voided: x.kasa.filter(function (k) { return k.void; }).length, paidOut: r2(sum(pays, function (y) { return y.amount; })) },
            payments: pays.slice().reverse(),
            cashiers: db.users.filter(function (c) { return c.role === 'cashier' && workDays(c.name).indexOf(rd) >= 0; }).map(function (c) {
              var tk = db.payouts.filter(function (y) { return y.kind === 'cashier' && y.washer === c.name && y.date === rd; });
              return { name: c.name, wage: c.dayWage || 0, taken: r2(sum(tk, function (y) { return y.amount; })), time: tk.length ? tk[tk.length - 1].time : '', owed: cashRoll(c).owed }; }),
            noReceipt: nr, noWasher: nw, washers: ws, kasa: x.kasa.slice().reverse() };
        }
        case 'monthReport': {
          need(u, ['admin']);
          var m = p.month || T.slice(0, 7);
          var days = uniq(db.kasa.concat(db.wash).filter(function (y) { return y.date.slice(0, 7) === m; }).map(function (y) { return y.date; })).sort();
          var D = [], svc = {}, all = [], nrr = 0, voided = 0, pr2 = function (k) { return k.price; };
          days.forEach(function (d2) {
            var y = dayData(d2); all = all.concat(y.active); voided += y.kasa.filter(function (k) { return k.void; }).length;
            var n = y.wash.filter(function (w) { return !w.matched; }).length; nrr += n;
            D.push({ date: d2, cars: y.active.length, revenue: r2(sum(y.active, pr2)), cash: r2(sum(y.active.filter(function (k) { return k.pay === 'cash'; }), pr2)),
              card: r2(sum(y.active.filter(function (k) { return k.pay === 'card'; }), pr2)), noReceipt: n });
          });
          all.forEach(function (k) { (k.items || []).forEach(function (i) { var s = svc[i.name] || (svc[i.name] = { name: i.name, count: 0, revenue: 0 }); s.count++; s.revenue += i.price; }); });
          var mp = db.payouts.filter(function (y) { return y.date.slice(0, 7) === m; }), mrev = sum(all, pr2), mcp = cashierPay(m), mwp = sum(all, wb) * PCT() / 100;
          return { month: m, pct: PCT(), days: D,
            totals: { cars: all.length, revenue: r2(mrev), cash: r2(sum(all.filter(function (k) { return k.pay === 'cash'; }), pr2)), card: r2(sum(all.filter(function (k) { return k.pay === 'card'; }), pr2)),
              firm: r2(sum(all.filter(function (k) { return k.pay === 'firm'; }), pr2)), washerPay: r2(mwp), paidOut: r2(sum(mp, function (y) { return y.amount; })), cashierPay: mcp,
              company: r2(mrev - mwp - mcp), noReceipt: nrr, voided: voided, gifts: all.filter(function (k) { return k.gift; }).length, giftValue: r2(sum(all, function (k) { return k.gift || 0; })) },
            washers: washers().map(function (n) { var cs = all.filter(function (k) { return k.washer === n; });
              return { name: n, cars: cs.length, revenue: r2(sum(cs, pr2)), earned: r2(sum(cs, wb) * PCT() / 100), paid: r2(sum(mp.filter(function (y) { return y.washer === n && y.kind !== 'cashier'; }), function (y) { return y.amount; })) }; }),
            services: Object.keys(svc).map(function (k) { return svc[k]; }).sort(function (a, b) { return b.revenue - a.revenue; }) };
        }
        case 'clients': {
          need(u, ['admin']);
          var cdays = Math.max(1, Number(p.days) || 30), cm = T.slice(0, 7), dayMs = 864e5, tNow = new Date(T).getTime();
          var firmPl = {}; db.firms.forEach(function (f) { (f.list || []).forEach(function (y) { firmPl[norm(y)] = f.name; }); });
          var by = {};
          db.kasa.filter(function (k) { return !k.void; }).forEach(function (k) {
            var c = by[k.np] || (by[k.np] = { plate: k.plate, visits: 0, month: 0, spent: 0, first: k.date, last: k.date, dates: [], firm: firmPl[k.np] || '' });
            c.visits++; c.spent += k.price; c.dates.push(k.date); if (k.date.slice(0, 7) === cm) c.month++;
            if (k.date < c.first) c.first = k.date; if (k.date > c.last) { c.last = k.date; c.plate = k.plate; }
          });
          var list = Object.keys(by).map(function (key) {
            var c = by[key], ds = uniq(c.dates).sort(), span = (new Date(ds[ds.length - 1]) - new Date(ds[0])) / dayMs;
            return { plate: c.plate, firm: c.firm, visits: c.visits, month: c.month, spent: r2(c.spent), first: c.first, last: c.last,
              every: ds.length > 1 ? Math.round(span / (ds.length - 1)) : 0, since: Math.round((tNow - new Date(c.last).getTime()) / dayMs) };
          });
          var inMonth = list.filter(function (c) { return c.month > 0; });
          return {
            stats: { month: inMonth.length, fresh: inMonth.filter(function (c) { return c.first.slice(0, 7) === cm; }).length, back: inMonth.filter(function (c) { return c.first.slice(0, 7) < cm; }).length, regular: inMonth.filter(function (c) { return c.month >= 2; }).length },
            regulars: inMonth.filter(function (c) { return c.month >= 2; }).sort(function (a, b) { return b.month - a.month || b.spent - a.spent; }).slice(0, 20),
            lost: list.filter(function (c) { return c.visits >= 3 && c.since >= cdays; }).sort(function (a, b) { return b.visits - a.visits; }).slice(0, 30),
            all: list };
        }
        case 'plateHistory': {
          need(u, ['admin']);
          var pn2 = norm(p.plate);
          return { items: db.kasa.filter(function (k) { return !k.void && k.np === pn2; }).map(function (k) { return { date: k.date, time: k.time, service: k.service, price: k.price, washer: k.washer, pay: k.pay }; })
            .sort(function (a, b) { return (b.date + b.time) < (a.date + a.time) ? -1 : 1; }) };
        }
        case 'firmMonth': {
          need(u, ['admin']);
          var fm = p.month || T.slice(0, 7), fb = {};
          db.kasa.filter(function (k) { return k.date.slice(0, 7) === fm && k.pay === 'firm' && !k.void; }).forEach(function (k) {
            var src = find(db.firms, function (y) { return y.name === k.firm; }) || {};
            var f = fb[k.firm] || (fb[k.firm] = { name: k.firm, eik: src.eik || '', contact: src.contact || '', phone: src.phone || '', email: src.email || '', count: 0, total: 0, items: [] });
            f.count++; f.total = r2(f.total + k.price); f.items.push({ date: k.date, time: k.time, plate: k.plate, service: k.service, price: k.price });
          });
          Object.keys(fb).forEach(function (key) { var f = fb[key]; f.pays = db.firmPays.filter(function (y) { return y.firm === f.name && y.month === fm; }); f.paid = r2(sum(f.pays, function (y) { return y.amount; })); f.rest = r2(f.total - f.paid); });
          return { month: fm, firms: Object.keys(fb).map(function (key) { return fb[key]; }).sort(function (a, b) { return b.total - a.total; }), older: firmDebts().filter(function (y) { return y.month !== fm; }) };
        }
        case 'firmPay': {
          need(u, ['admin']);
          var fd = find(firmDebts(), function (y) { return y.firm === p.firm && y.month === p.month; });
          var fa = num(p.amount);
          if (!fd) throw new Error('Тази фирма няма задължение за този месец');
          if (fa <= 0) throw new Error('Въведи сума');
          if (fa > fd.rest + 0.009) throw new Error('Сумата е повече от задължението (' + fd.rest.toFixed(2) + ' €)');
          db.firmPays.push({ id: uid('fp'), firm: p.firm, month: p.month, amount: fa, date: T, method: p.method === 'cash' ? 'cash' : 'bank', note: String(p.note || '').trim(), by: u.name });
          return { rest: r2(fd.rest - fa) };
        }
        case 'firmsAll':
          need(u, ['admin']);
          var debts = firmDebts();
          return { firms: db.firms.map(function (f) { return { debt: r2(sum(debts.filter(function (y) { return y.firm === f.name; }), function (y) { return y.rest; })), row: f.row, name: f.name, eik: f.eik,
            contact: f.contact || '', phone: f.phone || '', email: f.email || '', prices: Object.assign({}, f.prices), plates: (f.list || []).slice(), active: f.active }; }) };
        case 'saveFirm': {
          need(u, ['admin']);
          var fnm = String(p.name || '').trim(); if (!fnm) throw new Error('Въведи име на фирмата');
          var fpr = {};
          Object.keys(p.prices || {}).forEach(function (k) { var v = num(p.prices[k]); if (v > 0 && db.prices.some(function (y) { return y.name === k; })) fpr[k] = v; });
          if (!Object.keys(fpr).length) throw new Error('Въведи фирмена цена поне за една услуга');
          var row = Number(p.row) || 0, factive = p.active !== false, seen = {}, flist = [];
          (p.plates || []).forEach(function (s) { s = String(s).trim().toUpperCase(); var n = norm(s); if (n.length >= 4 && !seen[n]) { seen[n] = 1; flist.push(s); } });
          if (db.firms.some(function (f) { return f.row !== row && f.name.toLowerCase() === fnm.toLowerCase(); })) throw new Error('Вече има фирма с това име');
          if (factive) db.firms.filter(function (f) { return f.row !== row && f.active; }).forEach(function (f) { (f.list || []).forEach(function (y) { if (seen[norm(y)]) throw new Error(y + ' вече е към фирма ' + f.name); }); });
          var phone = String(p.phone || '').trim();
          if (phone && !/^[+0-9 ()/-]{6,20}$/.test(phone)) throw new Error('Телефонът изглежда грешен — само цифри, интервали и +');
          var frec = { name: fnm, eik: String(p.eik || '').trim(), contact: String(p.contact || '').trim(), phone: phone, email: String(p.email || '').trim(), list: flist, prices: fpr, active: factive };
          var fex = find(db.firms, function (f) { return f.row === row; });
          if (fex) {
            if (fex.name !== fnm) db.kasa.forEach(function (k) { if (k.firm === fex.name) k.firm = fnm; });
            if (fex.name !== fnm) db.firmPays.forEach(function (y) { if (y.firm === fex.name) y.firm = fnm; });
            Object.assign(fex, frec);
          } else { var nr2 = db.firms.reduce(function (mx, f) { return Math.max(mx, f.row); }, 1) + 1; db.firms.push(Object.assign({ id: 'f' + nr2, row: nr2 }, frec)); }
          return {};
        }
        case 'voidKasa': {
          need(u, ['admin']);
          var reason = String(p.reason || '').trim(); if (!reason) throw new Error('Въведи причина');
          var vk = find(db.kasa, function (k) { return k.id === p.id; }); if (!vk) throw new Error('Записът не е намерен');
          vk.void = true; vk.reason = reason + ' (' + u.name + ', ' + now() + ')'; return {};
        }
      }
      throw new Error('Непозната операция');
    }
    // смяна на име на човек — историята му остава свързана
    function rename(old, nw, role) {
      if (role === 'washer') { db.kasa.forEach(function (k) { if (k.washer === old) k.washer = nw; }); db.wash.forEach(function (w) { if (w.washer === old) w.washer = nw; });
        db.payouts.forEach(function (x) { if (x.washer === old && x.kind !== 'cashier') x.washer = nw; }); }
      if (role === 'cashier') { db.kasa.forEach(function (k) { if (k.cashier === old) k.cashier = nw; }); db.logins.forEach(function (x) { if (x.name === old) x.name = nw; });
        db.payouts.forEach(function (x) { if (x.kind === 'cashier' && x.washer === old) x.washer = nw; });
        db.shifts.forEach(function (s) { if (s.openBy === old) s.openBy = nw; if (s.closeBy === old) s.closeBy = nw; }); }
    }
    return { handle: handle };
  }

  // =====================================================================
  //  Промени, версии и синхронизация (общи за сървъра и касата)
  // =====================================================================
  function snapshot(db) {
    var s = {};
    Object.keys(TABLES).forEach(function (t) { if (db[t]) s[t] = db[t].map(function (r) { return JSON.stringify(r); }); });
    s.settings = JSON.stringify(db.settings);
    return s;
  }
  // кои редове са променени / нови спрямо снимката
  function diff(db, snap) {
    var ch = { tables: {}, settings: JSON.stringify(db.settings) !== snap.settings, ids: [] };
    Object.keys(TABLES).forEach(function (t) {
      if (!db[t]) return;
      var old = snap[t] || [], upd = [], add = [];
      db[t].forEach(function (r, i) {
        if (i >= old.length) add.push(i);
        else if (JSON.stringify(r) !== old[i]) upd.push(i);
      });
      if (upd.length || add.length) ch.tables[t] = { upd: upd, add: add };
      upd.concat(add).forEach(function (i) { if (db[t][i].id) ch.ids.push(db[t][i].id); });
    });
    return ch;
  }
  function stamp(db, ch) {   // нова версия (v) на всеки променен ред — касата тегли само новото
    Object.keys(ch.tables).forEach(function (t) {
      if (TABLES[t].server) return;
      var c = ch.tables[t]; c.upd.concat(c.add).forEach(function (i) { db.meta.v = (Number(db.meta.v) || 0) + 1; db[t][i].v = db.meta.v; });
    });
    if (ch.settings) { db.meta.v = (Number(db.meta.v) || 0) + 1; db.meta.sv = db.meta.v; }
  }
  function delta(db, since, touch) {
    since = Number(since) || 0; var tset = {}; (touch || []).forEach(function (id) { tset[id] = 1; });
    var out = { tables: {}, meta: { seq: db.meta.seq, v: db.meta.v } };
    SYNCED.forEach(function (t) {
      var rows = db[t].filter(function (r) { return (Number(r.v) || 0) > since || tset[r.id]; });
      if (t === 'users') rows = rows.map(function (r) { var c = Object.assign({}, r); delete c.salt; delete c.hash; return c; });
      if (rows.length) out.tables[t] = rows;
    });
    if ((Number(db.meta.sv) || 0) > since || since === 0) out.settings = db.settings;
    return out;
  }
  function applyDelta(rep, d) {   // касата: слива новото от сървъра в локалното копие
    Object.keys(d.tables || {}).forEach(function (t) {
      var arr = rep[t] || (rep[t] = []), idx = {};
      arr.forEach(function (r, i) { idx[r.id] = i; });
      d.tables[t].forEach(function (r) { if (idx[r.id] != null) arr[idx[r.id]] = r; else { idx[r.id] = arr.length; arr.push(r); } });
    });
    if (d.settings) rep.settings = d.settings;
    if (d.meta) { rep.meta = rep.meta || {}; rep.meta.v = d.meta.v; rep.meta.seq = d.meta.seq; }
  }
  function emptyDb() {
    var db = { settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), meta: { seq: 0, v: 0, sv: 0 } };
    Object.keys(TABLES).forEach(function (t) { db[t] = []; });
    return db;
  }

  // =====================================================================
  //  СЪРВЪР — обработка на една заявка (store зарежда/записва данните)
  // =====================================================================
  function authUser(db, p) {
    var login = String(p.login || '').trim().toLowerCase();
    var u = db.users.filter(function (x) { return x.active && x.username === login; })[0];
    if (!u || !u.hash || passHash(u.salt, String(p.pass || '')) !== u.hash) throw new Error('Грешно потребителско име или парола');
    return u;
  }
  function serve(p, store, env) {
    var db = store.load(), snap = snapshot(db), out, u;
    try {
      u = authUser(db, p);
      var E = Engine(db, env), done = {};
      db.ops.forEach(function (o) { done[o.cid] = 1; });
      var rec = function (cid, action) { if (cid) { done[cid] = 1; db.ops.push({ cid: cid, action: action, at: env.today() + ' ' + env.now() }); } };
      if (p.action === 'sync') out = {};
      else if (p.action === 'batch') {   // изпращане на натрупаното на касата без интернет
        if (['cashier', 'admin'].indexOf(u.role) < 0) throw new Error('Нямаш права за това');
        out = { results: (p.items || []).map(function (it) {
          if (it.cid && done[it.cid]) return { cid: it.cid, ok: true, dup: true };
          if (OFFLINE_WRITE.indexOf(it.action) < 0) return { cid: it.cid, ok: false, error: 'Непозната операция' };
          var who = db.users.filter(function (x) { return x.active && x.username === String(it.by || '').toLowerCase() && (x.role === 'cashier' || x.role === 'admin'); })[0] || u;
          var s2 = snapshot(db);
          try { var r = E.handle(it, who); rec(it.cid, it.action); return { cid: it.cid, ok: true, r: r }; }
          catch (e) { restore(db, s2); return { cid: it.cid, ok: false, error: e.message, action: it.action }; }
        }) };
      } else {
        if (p.cid && done[p.cid]) out = { dup: true };
        else { var q = Object.assign({}, p); delete q._d; delete q._t; delete q.talon; out = E.handle(q, u) || {}; if (WRITE.indexOf(p.action) >= 0) rec(p.cid, p.action); }
      }
    } catch (e) { return { ok: false, error: e.message }; }
    var ch = diff(db, snap);
    if (Object.keys(ch.tables).length || ch.settings) { stamp(db, ch); store.save(db, ch); }
    if (u && (u.role === 'cashier' || u.role === 'admin') && p.since != null) out.delta = delta(db, p.since, p.touch);
    out.ok = true;
    return out;
  }
  function restore(db, s) {   // връща данните както са били (при грешка в опашката)
    Object.keys(TABLES).forEach(function (t) { if (s[t]) db[t] = s[t].map(function (x) { return JSON.parse(x); }); });
    db.settings = JSON.parse(s.settings);
  }

  return { TABLES: TABLES, SYNCED: SYNCED, DEFAULT_SETTINGS: DEFAULT_SETTINGS, OFFLINE_WRITE: OFFLINE_WRITE, LOCAL_READ: LOCAL_READ, WRITE: WRITE,
    Engine: Engine, serve: serve, snapshot: snapshot, diff: diff, stamp: stamp, delta: delta, applyDelta: applyDelta, emptyDb: emptyDb, norm: norm, sha256: sha256, passHash: passHash, r2: r2 };
})();
if (typeof module !== 'undefined') module.exports = HELIOS;
