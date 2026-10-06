# Сглобява: dist/ (за качване) и demo.html (демото)
import os, shutil, re
R = os.path.dirname(os.path.abspath(__file__))
src = lambda f: open(os.path.join(R, 'src', f), encoding='utf8').read()
os.makedirs(os.path.join(R, 'dist'), exist_ok=True)
h = open(os.path.join(R, 'index.html'), encoding='utf8').read()
# ---- dist ----
for f in ['engine.js', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png']:
    shutil.copy(os.path.join(R, 'src', f), os.path.join(R, 'dist', f))
# версия на логиката в адреса — Chrome тегли новата заедно с новия екран (без стар кеш)
import hashlib
ev = hashlib.sha1(src('engine.js').encode('utf8')).hexdigest()[:8]
open(os.path.join(R, 'dist', 'index.html'), 'w', encoding='utf8').write(h.replace('<script src="engine.js"></script><!--ENGINE-->', '<script src="engine.js?v=' + ev + '"></script><!--ENGINE-->'))
open(os.path.join(R, 'dist', 'Code.gs'), 'w', encoding='utf8').write(src('engine.js') + '\n' + src('server.gs.js'))
# ---- demo ----
d = h
d = re.sub(r'<link rel="manifest"[^\n]*<!--PWA-->\n', '', d)
d = d.replace('<script src="engine.js"></script><!--ENGINE-->', '<script>\n' + src('engine.js') + '\n' + src('seed.js') + '\n</script>')
a = d.index('/*API-START*/'); b = d.index('/*API-END*/') + len('/*API-END*/')
d = d[:a] + r'''/*API-START*/
// ДЕМО: „сървърът“ работи тук в браузъра с примерни данни; бутонът горе изключва интернета на касата
const DEMO_DB = heliosSeed(todayStr());
const DEMO_ENV = { today: todayStr, now: () => { const x = new Date(); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); }, uid: () => Math.random().toString(36).slice(2, 10) };
let DEMO_OFF = false;
async function post(body) {
  await new Promise(r => setTimeout(r, 150));
  const u = DEMO_DB.users.find(x => x.username === String(body.login || '').toLowerCase());
  if (DEMO_OFF && (!u || u.role === 'cashier')) throw new TypeError('offline');   // само касата е без интернет — телефоните на другите имат
  return JSON.parse(JSON.stringify(HELIOS.serve(JSON.parse(JSON.stringify(body)), { load: () => DEMO_DB, save: () => {} }, DEMO_ENV)));
}
function demoNet() {
  DEMO_OFF = !DEMO_OFF;
  const b = document.getElementById('netBtn'); if (b) { b.textContent = DEMO_OFF ? '📵 Интернет на касата: НЯМА' : '📶 Интернет на касата: има'; b.classList.toggle('offb', DEMO_OFF); }
  if (DEMO_OFF) { if (cashierMode()) goOffline(); } else netTick();
}
/*API-END*/''' + d[b:]
a = d.index('/*START*/'); b = d.index('/*END*/') + len('/*END*/')
d = d[:a] + 'showLogin();' + d[b:]
d = d.replace("const API_URL = 'ПОСТАВИ_ТУК_URL_ОТ_APPS_SCRIPT';", "const API_URL = 'demo';").replace("const AUTO_PRINT = true;", "const AUTO_PRINT = false;")
bar = '''<div class="demo"><b>ДЕМО</b><span>Влез като:</span>
<button onclick="doLogin('1111','maria')">Касиер Мария</button><button onclick="doLogin('2222','ivan')">Мияч Иван</button><button onclick="doLogin('helios','admin')">Собственик</button><button id="netBtn" onclick="demoNet()">📶 Интернет на касата: има</button>
<small>Или влезте отдолу: maria / 1111 · petya / 5555 · ivan / 2222 · georgi / 3333 · admin / helios. Данните са примерни.</small></div>'''
d = d.replace('<!--DEMO-BAR-->', bar)
d = d.replace('</style>', '''.demo{background:#FDE68A;color:#422006;padding:8px 16px;font-size:13px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.demo button{border:0;border-radius:8px;padding:7px 10px;font-size:13px;font-weight:700;background:#422006;color:#FDE68A;cursor:pointer}
.demo small{flex-basis:100%;opacity:.8}
.demo #netBtn{margin-left:auto;background:#166534;color:#fff}.demo #netBtn.offb{background:#B91C1C}
.hdr{top:0}
</style>''', 1)
open(os.path.join(R, 'demo.html'), 'w', encoding='utf8').write(d)
print('dist + demo ok', len(d))
