/* JOKKOO offline cache: version bump purges mixed/stale JavaScript bundles. */
const CACHE = 'jokkoo-v23';
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const ASSETS = ['./', './index.html', './style.css', './config.js', './branding.js', './data.js', './core.js', './app.js', './rapport.js', './admin.js', './auth.js', './archive.js', './journal.js', './messages.js', './manifest.json', './assets/icon-192.png', './assets/icon-512.png', './assets/taatan-hero.jpg', './assets/taatan-logo.jpg', CDN];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.origin !== location.origin && r.url !== CDN) return;
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit =>
    fetch(r).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(r, res.clone()));
      return res;
    }).catch(() => hit || caches.match('./index.html'))
  ));
});
