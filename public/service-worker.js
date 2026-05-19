const STATIC_CACHE = 'static-v1-2-7';
const DYNAMIC_CACHE = 'dynamic-v1-2-7';

const ASSETS = ['/', '/index.html', '/manifest.json'];

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS))
    );
});

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => {
                    if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
                        return caches.delete(key);
                    }
                })
            )
        )
    );
    return self.clients.claim();
});

/**
 * Cache a response clone in the background WITHOUT touching the original.
 * 
 * CRITICAL RULE: The caller must pass an already-cloned Response object.
 * Never pass the same Response that will be returned to the browser —
 * consuming (cloning) a body twice causes "Response body is already used".
 * 
 * Correct pattern:
 *   const clone = networkRes.clone();   // 1. clone synchronously
 *   bgCache(request, clone);            // 2. cache the clone (async)
 *   return networkRes;                  // 3. return original to browser
 */
function bgCache(request, responseClone) {
    if (!responseClone || responseClone.status === 0 || !responseClone.ok) return;
    caches.open(DYNAMIC_CACHE).then((cache) => {
        cache.put(request, responseClone).catch(() => { /* ignore quota errors */ });
    });
}

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle GET over HTTP/HTTPS
    if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

    // Skip Vite dev-server module requests (dynamic imports, HMR, etc.)
    // Intercepting these breaks React lazy() and dynamic import() calls.
    if (url.origin === self.location.origin) {
        const p = url.pathname;
        const isViteModule =
            p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.jsx') ||
            p.includes('/@') || p.includes('/node_modules/') ||
            p.includes('/src/') || p.includes('?t=') || p.includes('?v=') ||
            p.includes('__vite') || p.includes('?import');
        if (isViteModule) return;
    }

    // ── Supabase REST API ─ Network First, Cache Fallback ──────────────────
    if (url.href.includes('supabase.co/rest/v1')) {
        event.respondWith(
            fetch(request).then((networkRes) => {
                bgCache(request, networkRes.clone()); // clone sync, cache async
                return networkRes;
            }).catch(() => caches.match(request))
        );
        return;
    }

    // ── Supabase Storage ─ Cache First, Network Fallback ───────────────────
    if (url.href.includes('supabase.co/storage/v1')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((networkRes) => {
                    bgCache(request, networkRes.clone()); // clone sync, cache async
                    return networkRes;
                });
            })
        );
        return;
    }

    // ── Everything else ─ Cache First, Network Fallback ────────────────────
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((networkRes) => {
                bgCache(request, networkRes.clone()); // clone sync, cache async
                return networkRes;
            }).catch(() => undefined);
        })
    );
});
