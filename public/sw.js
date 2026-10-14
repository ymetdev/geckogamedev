// GeckoBoard service worker: makes the site installable and opens instantly.
// Network-first for the app shell (so a new deploy shows up right away), cache only as an offline fallback. The API is never cached.
const CACHE = 'geckoboard-shell-v3';
const SHELL = ['/', '/style.css', '/app.js', '/data.js', '/fx.js', '/i18n.js', '/icon-192.png', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/mcp' || url.pathname === '/healthz') return; // live data: always the network
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('/'))));
});
