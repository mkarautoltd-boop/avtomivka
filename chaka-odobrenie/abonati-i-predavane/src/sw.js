/* HELIOS Каса — работа без интернет: приложението се отваря от паметта на компютъра */
const CACHE = 'helios-v1';
const SHELL = ['./', 'index.html', 'engine.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || /script\.google(usercontent)?\.com$/.test(url.hostname)) return;   // заявките към сървъра не минават оттук
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {            // шрифтовете: от паметта, ако ги има
    e.respondWith(caches.match(req).then(m => m || fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // приложението: първо от интернет (за да идват новите версии), без интернет — от паметта
  e.respondWith(Promise.race([
    fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
  ]).catch(() => caches.match(req, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
});
