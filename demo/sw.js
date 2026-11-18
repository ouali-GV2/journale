const CACHE = 'journal-demo-80f616e8';
const FILES = ['./', 'index.html', 'journal.enc', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('journal-demo-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord (toujours la dernière version), cache en secours hors connexion
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method === 'POST' && u.origin === location.origin && u.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try { const fd = await e.request.formData(), f = fd.get('statement');
        if (f && f.size) { const c = await caches.open('jshare-demo'); await c.put('shared-file', new Response(f, { headers: { 'x-name': f.name || 'releve.csv' } })); }
      } catch (err) {}
      return Response.redirect('./index.html?share=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(e.request).then(r => { if (r && r.ok) cache.put(e.request, r.clone()); return r; });
    net.catch(() => {});
    // réseau d'abord, mais on bascule sur le cache si le réseau met plus de 4 s ou échoue
    try { const r = await Promise.race([net, new Promise(res => setTimeout(() => res(null), 4000))]); if (r) return r; } catch (err) {}
    const m = (await cache.match(e.request, { ignoreSearch: true })) || (await cache.match('index.html', { ignoreSearch: true }));
    if (m) return m;
    try { return await net; } catch (err) { return Response.error(); }
  })());
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'journal-remind' && new Date().getHours() >= 17)
    e.waitUntil(self.registration.showNotification('Journal de trades', { body: 'Pense à noter ta journée de trading.', icon: 'icons/icon-192.png', tag: 'remind' }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(l => l.length ? l[0].focus() : clients.openWindow('./index.html')));
});
