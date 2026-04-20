const CACHE = 'health-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Шрифты: сначала кэш, потом сеть (работает офлайн после первого визита)
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached =>
          cached || fetch(e.request).then(resp => {
            cache.put(e.request, resp.clone());
            return resp;
          })
        )
      )
    );
    return;
  }

  // Основной HTML: сначала кэш, фоновое обновление
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(resp => {
          cache.put(e.request, resp.clone());
          return resp;
        });
        return cached || fresh;
      })
    )
  );
});
