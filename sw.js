// Версия — поднимается при каждом деплое для инвалидации кэша
const CACHE_VERSION = '2026-05-03-1';
const CACHE = `health-${CACHE_VERSION}`;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./']))
  );
  // Сразу активируем новый SW, не ждём закрытия всех вкладок
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // Удаляем все кэши кроме текущей версии
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Клиент может попросить SW сразу активироваться
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  const isNavigation = e.request.mode === 'navigate' ||
                       (e.request.method === 'GET' && e.request.headers.get('accept')?.includes('text/html'));

  // Шрифты Google: cache-first (редко меняются, важна скорость и офлайн)
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

  // HTML/навигация: network-first — гарантия свежей версии при наличии сети.
  // Кэш используется только если сети нет (офлайн).
  if (isNavigation) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, copy));
        return resp;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('./')))
    );
    return;
  }

  // Прочие GET-запросы (manifest, иконки): stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(resp => {
          cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
