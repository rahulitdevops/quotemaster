// QuoteMaster Service Worker v2
// Works with relative paths for local hosting
const CACHE_NAME = 'quotemaster-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// Install: cache the app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cache what we can, skip failures gracefully
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.log('Cache skip:', url, err.message);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: serve from cache first, fallback to network
self.addEventListener('fetch', function(event) {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        // Cache successful responses for future offline use
        if (response && response.status === 200 && response.type === 'basic') {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(function() {
        // Offline and not in cache — return a basic offline page
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
