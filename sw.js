// sw.js — Mesa de Trabajo PWA · v15.0
// Se publica como sw.js en el repo (lo registra index.html con './sw.js').
//
// Cambios respecto de mdt-v11:
//  · ASSETS apuntaba a ./index_v11.html (ya no existe): cache.addAll fallaba entero y el
//    SW nunca se instalaba. Ahora apunta a ./index.html.
//  · HTML con "red primero": cada versión nueva de index.html se ve apenas se sube a
//    GitHub Pages (antes, cache primero → había que esperar a que cambiara el cache).
//    Sin conexión, sirve la última copia guardada.
//  · Nunca se cachea nada de otro origen (Supabase, GAS, CDNs): los datos van siempre
//    directo a la red.

const CACHE_NAME = 'mdt-v15-0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(ASSETS.map(a => cache.add(a).catch(() => null))))  // un asset faltante no frena la instalación
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase, GAS, CDNs: directo a la red

  const esHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (esHtml) {
    // Red primero; sin red → copia guardada
    e.respondWith(
      fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copia));
        }
        return resp;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Íconos y manifest: cache primero
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const copia = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copia));
      }
      return resp;
    }))
  );
});
