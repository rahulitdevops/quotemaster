// QuoteMaster Service Worker v3
// Auto-update: change CACHE_VERSION to force update on all clients
const CACHE_VERSION = 'v3';
const CACHE_NAME = 'quotemaster-' + CACHE_VERSION;
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// Install: cache the app shell and skip waiting immediately
self.addEventListener('install', function(event) {
  console.log('[SW] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(function(url) {
          // Use cache-busting query param to bypass browser HTTP cache
          return cache.add(new Request(url, { cache: 'no-cache' })).catch(function(err) {
            console.log('[SW] Cache skip:', url, err.message);
          });
        })
      );
    })
  );
  // Force this SW to become active immediately (don't wait for old tabs to close)
  self.skipWaiting();
});

// Activate: delete ALL old caches and take control of all clients
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) {
              console.log('[SW] Deleting old cache:', k);
              return caches.delete(k);
            })
      );
    }).then(function() {
      // Notify all open clients that an update happened
      return self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      });
    })
  );
  // Take control of ALL tabs/clients immediately (even those opened before this SW)
  self.clients.claim();
});

// Fetch: Network-first for HTML (always get latest), cache-first for other assets
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // For navigation requests (HTML pages) — always try network first
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then(function(response) {
        // Got fresh version from network — update cache
        if (response && response.status === 200) {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(function() {
        // Offline — serve from cache
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // For all other assets — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(function() {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Listen for skip waiting message from client
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
