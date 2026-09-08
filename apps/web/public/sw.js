// Service worker mínimo: cachea el "app shell" para arranque offline.
// El contenido dinámico (API) se sirve siempre de red (network-first sencillo).
const CACHE = 'rrhh-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icono.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Nunca cachear llamadas a la API.
  if (url.pathname.startsWith('/api')) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r ?? caches.match('/index.html'))),
  );
});
