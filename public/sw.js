const CACHE_VERSION = 'v2';
const RUNTIME_CACHE = `sigocc-runtime-${CACHE_VERSION}`;
const PRECACHE_ASSETS = ['/offline.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.addAll(PRECACHE_ASSETS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== RUNTIME_CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isHttpRequest = requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:';

  // Evita errores al intentar cachear esquemas no soportados (ej: chrome-extension://).
  if (!isHttpRequest) {
    return;
  }

  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(event.request);
        return (
          cached ||
          (await cache.match(
            new Request('/offline.html', { method: 'GET', headers: { accept: 'text/html' } }),
          )) ||
          Response.error()
        );
      }
    }),
  );
});

