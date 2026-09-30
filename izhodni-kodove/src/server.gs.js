/* =====================================================================
   HELIOS Каса — сървър (Google Apps Script към таблицата)
   Първо пусни функцията setup (веднъж). После Deploy → Web app.
   ===================================================================== */
const FIRST_ADMIN_PASSWORD = 'helios2026';   // паролата на собственика при първото пускане — смени я после от приложението
const TZ = 'Europe/Sofia';

const ENV = {
  today: () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'),
  now: () => Utilities.formatDate(new Date(), TZ, 'HH:mm'),
  uid: () => Utilities.getUuid().replace(/-/g, '').slice(0, 12)
};

function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'Невалидна заявка' }); }
  // четенето не чака опашка; записите минават един по един
  const writes = p.action === 'batch' || HELIOS.WRITE.indexOf(p.action) >= 0, lock = writes ? LockService.getScriptLock() : null;
  if (lock) { try { lock.waitLock(30000); } catch (x) { return out_({ ok: false, error: 'Сървърът е зает — опитай пак след малко' }); } }
  try { return out_(HELIOS.serve(p, SheetStore_(), ENV)); }
  catch (x) { return out_({ ok: false, error: 'Грешка на сървъра: ' + x.message }); }
  finally { if (lock) lock.releaseLock(); }
}
function doGet() { return out_({ ok: true, app: 'HELIOS Каса', time: ENV.today() + ' ' + ENV.now() }); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- четене и запис в листовете ----------
const TIME_COLS_ = { time: 1, openT: 1, closeT: 1, paidAt: 1 };
function cellToVal_(v, type, key) {
  if (v instanceof Date) v = Utilities.formatDate(v, TZ, TIME_COLS_[key] ? 'HH:mm' : 'yyyy-MM-dd');
  switch (type) {
    case 's': return v === '' || v == null ? '' : String(v);
    case 'S': return v === '' || v == null ? null : String(v);
    case 'n': return v === '' || v == null ? 0 : Number(v);
    case 'N': return v === '' || v == null ? null : Number(v);
    case 'b': return v === true || v === 'TRUE' || v === 'true' || v === 1;
    case 'j': if (v === '' || v == null) return null; try { return JSON.parse(v); } catch (x) { return null; }
  }
  return v;
}
function valToCell_(v, type) {
  if (v == null) return '';
  if (type === 'j') return JSON.stringify(v);
  if (type === 'b') return !!v;
  if (type === 'n' || type === 'N') return Number(v);
  return String(v);
}
function rowFormats_(def) { return def.cols.map(c => (c[1] === 's' || c[1] === 'S' || c[1] === 'j') ? '@' : 'General'); }

function SheetStore_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), T = HELIOS.TABLES, sheets = {}, loaded = {}, snap = {};
  let kvSheet, kvRows = {}, metaStr = '';
  return {
    // листовете се четат чак когато потрябват — по-бързо
    load() {
      const db = {};
      Object.keys(T).forEach(t => {
        let rows = null;
        Object.defineProperty(db, t, { enumerable: true, configurable: true,
          get() {
            if (rows === null) {
              const def = T[t], sh = ss.getSheetByName(def.sheet);
              if (!sh) throw new Error('Липсва лист „' + def.sheet + '“ — пусни функцията setup');
              sheets[t] = sh;
              const last = sh.getLastRow(), vals = last > 1 ? sh.getRange(2, 1, last - 1, def.cols.length).getValues() : [];
              rows = vals.map(r => { const o = {}; def.cols.forEach((c, i) => { o[c[0]] = cellToVal_(r[i], c[1], c[0]); }); return o; });
              loaded[t] = rows.length; snap[t] = rows.map(r => JSON.stringify(r));
            }
            return rows;
          },
          set(v) { if (rows === null) db[t]; rows = v; } });
      });
      kvSheet = ss.getSheetByName('Настройки');
      if (!kvSheet) throw new Error('Липсва лист „Настройки“ — пусни функцията setup');
      const kv = kvSheet.getLastRow() > 1 ? kvSheet.getRange(2, 1, kvSheet.getLastRow() - 1, 2).getValues() : [];
      kv.forEach((r, i) => { kvRows[r[0]] = i + 2; });
      const get = k => { const r = kv.filter(x => x[0] === k)[0]; try { return r ? JSON.parse(r[1]) : null; } catch (x) { return null; } };
      db.settings = Object.assign(JSON.parse(JSON.stringify(HELIOS.DEFAULT_SETTINGS)), get('settings') || {});
      db.settings.loyalty = Object.assign({}, HELIOS.DEFAULT_SETTINGS.loyalty, db.settings.loyalty || {});
      db.meta = Object.assign({ seq: 0, v: 0, sv: 0 }, get('meta') || {});
      metaStr = JSON.stringify(db.meta); snap.settings = JSON.stringify(db.settings);
      return db;
    },
    snapshot() { return snap; },
    save(db, ch) {
      Object.keys(ch.tables).forEach(t => {
        const def = T[t], sh = sheets[t], c = ch.tables[t], toRow = o => def.cols.map(col => valToCell_(o[col[0]], col[1]));
        // променени редове — поредици от съседни редове се записват наведнъж
        const upd = c.upd.slice().sort((a, b) => a - b);
        for (let i = 0; i < upd.length;) {
          let j = i; while (j + 1 < upd.length && upd[j + 1] === upd[j] + 1) j++;
          const block = upd.slice(i, j + 1).map(ix => toRow(db[t][ix]));
          sh.getRange(upd[i] + 2, 1, block.length, def.cols.length).setValues(block);
          i = j + 1;
        }
        if (c.add.length) {
          const start = loaded[t] + 2, block = c.add.map(ix => toRow(db[t][ix]));
          const needRows = start + block.length - 1 - sh.getMaxRows();
          if (needRows > 0) sh.insertRowsAfter(sh.getMaxRows(), needRows + 500);
          const rg = sh.getRange(start, 1, block.length, def.cols.length), f = rowFormats_(def);
          rg.setNumberFormats(block.map(() => f));
          rg.setValues(block);
        }
      });
      if (ch.settings) setKv_(kvSheet, kvRows, 'settings', JSON.stringify(db.settings));
      const m = JSON.stringify(db.meta); if (m !== metaStr) setKv_(kvSheet, kvRows, 'meta', m);
    }
  };
}
function setKv_(sh, rows, key, val) {
  if (rows[key]) sh.getRange(rows[key], 2).setValue(val);
  else { const r = sh.getLastRow() + 1; sh.getRange(r, 1, 1, 2).setNumberFormat('@').setValues([[key, val]]); rows[key] = r; }
}

// ---------- първоначална настройка ----------
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), T = HELIOS.TABLES;
  Object.keys(T).forEach(t => {
    const def = T[t]; let sh = ss.getSheetByName(def.sheet);
    if (!sh) sh = ss.insertSheet(def.sheet);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols.map(c => c[0])]).setFontWeight('bold').setBackground('#F2C230');
      sh.setFrozenRows(1);
      const f = rowFormats_(def);
      def.cols.forEach((c, i) => sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat(f[i]));
    }
  });
  let kv = ss.getSheetByName('Настройки');
  if (!kv) kv = ss.insertSheet('Настройки');
  if (kv.getLastRow() === 0) {
    kv.getRange(1, 1, 1, 2).setValues([['key', 'value']]).setFontWeight('bold').setBackground('#F2C230');
    kv.getRange(2, 1, kv.getMaxRows() - 1, 2).setNumberFormat('@');
  }
  // начални данни: собственик, ценоразпис, настройки
  const store = SheetStore_(), db = store.load(); HELIOS.snapshot(db); const snap = store.snapshot();
  if (!db.users.length) {
    const salt = ENV.uid() + ENV.uid();
    db.users.push({ id: 'u1', name: 'Собственик', username: 'admin', role: 'admin', active: true, canAddWashers: false, dayWage: 0, salt: salt, hash: HELIOS.passHash(salt, FIRST_ADMIN_PASSWORD) });
  }
  if (!db.prices.length) [['Кола вътре+вън', 18], ['Джип / SUV', 21], ['Бус', 25]].forEach((x, i) => db.prices.push({ id: 's' + (i + 1), name: x[0], price: x[1], active: true, ord: i + 1 }));
  if (!db.settings.address) db.settings.address = 'Варна, бул. Цар Освободител 164 А · 089 452 4394';
  const ch = HELIOS.diff(db, snap); ch.settings = true;
  HELIOS.stamp(db, ch); store.save(db, ch);
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Лист1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  Logger.log('Готово. Вход: admin / ' + FIRST_ADMIN_PASSWORD);
}
// ако забравиш паролата на собственика: пусни тази функция — паролата става FIRST_ADMIN_PASSWORD
function resetAdminPassword() {
  const store = SheetStore_(), db = store.load(); HELIOS.snapshot(db); const snap = store.snapshot();
  const a = db.users.filter(u => u.role === 'admin')[0]; if (!a) throw new Error('Няма собственик');
  a.salt = ENV.uid() + ENV.uid(); a.hash = HELIOS.passHash(a.salt, FIRST_ADMIN_PASSWORD); a.active = true;
  const ch = HELIOS.diff(db, snap); HELIOS.stamp(db, ch); store.save(db, ch);
  Logger.log('Паролата на ' + a.username + ' е ' + FIRST_ADMIN_PASSWORD);
}
