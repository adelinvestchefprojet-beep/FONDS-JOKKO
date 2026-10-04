/* Service worker : application utilisable hors ligne. Les appels à Supabase (API, Auth, Storage) ne sont JAMAIS mis en cache. */
const CACHE = 'jokkoo-v11';
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const ASSETS = ['./', './index.html', './style.css', './config.js', './branding.js', './data.js', './core.js', './app.js', './rapport.js', './admin.js', './auth.js', './archive.js', './journal.js', './manifest.json', './assets/icon-192.png', './assets/icon-512.png', './assets/taatan-hero.jpg', './assets/taatan-logo.jpg', CDN];
// Un fichier absent ne fait plus échouer toute l'installation
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => { })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.origin !== location.origin && r.url !== CDN) return; // API Supabase, Storage… : réseau uniquement
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
    const net = fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)) } return res }).catch(() => hit || caches.match('./index.html'));
    return hit || net;
  }));
});
