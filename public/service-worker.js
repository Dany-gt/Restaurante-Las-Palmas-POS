const CACHE_NAME = 'las-palmas-pos-v1-2-5';
const STATIC_CACHE = 'static-v1-2-5';
const DYNAMIC_CACHE = 'dynamic-v1-2-5';

const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Install Event: Cache Static Assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing Service Worker ...', event);
    // Take control immediately without waiting for old tabs to close
    self.skipWaiting();
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[Service Worker] Precaching App Shell');
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Event: Cleanup Old Caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating Service Worker ....', event);
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
                        console.log('[Service Worker] Removing old cache.', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch Event: Strategies
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const method = event.request.method;

    // 1. Supabase REST API
    // Only cache GET requests. Writes (POST/PATCH/PUT/DELETE/HEAD) must ALWAYS
    // go straight to the network so real-time data stays fresh.
    if (url.href.includes('supabase.co/rest/v1')) {
        if (method !== 'GET') {
            // Pass write requests through without any caching
            return; // let browser handle it normally
        }
        // GET: Network-First with Cache Fallback
        // ALWAYS fetch from network so real-time triggered fetchData gets instant fresh data.
        // Cache is only used as a fallback when the device is offline.
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Cache the fresh response for offline use
                    if (networkResponse.ok) {
                        caches.open(DYNAMIC_CACHE).then((cache) => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Network failed (device is offline) — serve from cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // 2. Images (Supabase Storage) - Cache First
    // Images don't change often. If they do, usually the URL changes (random filename)
    if (url.href.includes('supabase.co/storage/v1')) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                if (response) return response;
                return fetch(event.request).then((networkResponse) => {
                    return caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // 3. Static Assets & Navigation - Cache First with Network Fallback
    // IMPORTANT: Only intercept GET requests. POST/PATCH/DELETE (e.g. KDS printer, Supabase writes)
    // must go straight to the network; intercepting them causes "network error response" in the console.
    if (method !== 'GET') {
        return; // let the browser handle writes normally
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                return response;
            }
            return fetch(event.request).then((res) => {
                return caches.open(DYNAMIC_CACHE).then((cache) => {
                    // Only cache same-origin or http assets
                    if (event.request.url.startsWith('http')) {
                        cache.put(event.request, res.clone());
                    }
                    return res;
                });
            }).catch(() => {
                // Network failed for static asset — nothing to return
            });
        })
    );
});
