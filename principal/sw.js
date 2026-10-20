const CACHE = 'journal-v2-s2';
const FILES = ['./', 'index.html', 'journal.enc', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'jshare').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord (toujours la dernière version), cache en secours hors connexion
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method === 'POST' && u.origin === location.origin && u.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try { const fd = await e.request.formData(), f = fd.get('statement');
        if (f && f.size) { const c = await caches.open('jshare'); await c.put('shared-file', new Response(f, { headers: { 'x-name': f.name || 'releve.csv' } })); }
      } catch (err) {}
      return Response.redirect('./index.html?share=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'journal-remind' && new Date().getHours() >= 17)
    e.waitUntil(self.registration.showNotification('Journal de trades', { body: 'Pense à noter ta journée de trading.', icon: 'icons/icon-192.png', tag: 'remind' }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(l => l.length ? l[0].focus() : clients.openWindow('./index.html')));
});
