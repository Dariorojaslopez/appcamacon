self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open('sigocc-runtime');
      await cache.addAll(['/offline.html', '/manifest.json']);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open('sigocc-runtime').then(async (cache) => {
      try {
        const response = await fetch(event.request);
        if (event.request.method === 'GET' && response.ok) {
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

