// Service Worker: macht Tap Leaf offline spielbar.
// Die Spielseite kommt bevorzugt frisch aus dem Netz (Updates kommen sofort an), alles andere aus dem Cache.
const CACHE = 'tapleaf-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // cache: 'reload' umgeht den Browser-Cache, damit wirklich die neuesten Dateien gespeichert werden.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          // Nur die Spielseite selbst merken, keine Fehlerseiten (z. B. 404 bei vertippter Adresse).
          const path = new URL(req.url).pathname;
          if (res.ok && (path.endsWith('/') || path.endsWith('/index.html'))) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Icons, Manifest und Schriften: sofort aus dem Cache, im Hintergrund frisch laden,
  // damit Änderungen (z. B. ein neuer App-Name) beim nächsten Start ankommen.
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req);
    const net = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }).catch(() => hit);
    e.waitUntil(net.then(() => {}, () => {}));
    return hit || net;
  }));
});
