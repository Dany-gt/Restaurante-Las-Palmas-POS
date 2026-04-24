const CACHE_NAME = 'las-palmas-pos-v1-2-3';
const STATIC_CACHE = 'static-v1-2-3';
const DYNAMIC_CACHE = 'dynamic-v1-2-3';

const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Install Event: Cache Static Assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing Service Worker ...', event);
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

// Fetch Event: Stratagies
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. API Requests (Supabase) - Stale While Revalidate
    // We want to return cached data instantly, but also update it from network
    if (url.href.includes('supabase.co/rest/v1')) {
        event.respondWith(
            caches.open(DYNAMIC_CACHE).then((cache) => {
                return cache.match(event.request).then((response) => {
                    const fetchPromise = fetch(event.request)
                        .then((networkResponse) => {
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        })
                        .catch((err) => {
                            // Network failed, nothing to do (we rely on cache)
                            console.log('Network failed for API, using cache if available');
                        });
                    return response || fetchPromise;
                });
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
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                return response;
            }
            return fetch(event.request).then((res) => {
                return caches.open(DYNAMIC_CACHE).then((cache) => {
                    // Don't cache chrome-extension or other non-http schemes
                    if (event.request.url.startsWith('http')) {
                        cache.put(event.request, res.clone());
                    }
                    return res;
                });
            }).catch(err => {
                // Optional: Return offline page for navigation requests
            });
        })
    );
});
