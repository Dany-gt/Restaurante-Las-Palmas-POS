const STATIC_CACHE = 'static-v1-2-8';
const DYNAMIC_CACHE = 'dynamic-v1-2-8';

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
                bgCache(request, networkRes.clone());
                return networkRes;
            }).catch(() => caches.match(request))
        );
        return;
    }

    // ── Images (Supabase Storage + Google Drive + general images) ───────────
    // Cache First using BOTH the dynamic cache and the app-media-cache that
    // useDataSync fills when the user presses "ACTUALIZAR IMÁGENES".
    const isImage =
        url.href.includes('supabase.co/storage/v1') ||
        url.href.includes('drive.google.com') ||
        url.href.includes('googleusercontent.com') ||
        /\.(jpe?g|png|webp|gif|svg|avif)(\?|$)/i.test(url.pathname);

    if (isImage) {
        event.respondWith(
            // 1. Check app-media-cache first (filled by "ACTUALIZAR IMÁGENES")
            caches.open('app-media-cache').then(async (mediaCache) => {
                const mediaCached = await mediaCache.match(request);
                if (mediaCached) return mediaCached;

                // 2. Check dynamic cache
                const dynCached = await caches.match(request);
                if (dynCached) return dynCached;

                // 3. Fetch from network and cache for next time
                return fetch(request).then((networkRes) => {
                    bgCache(request, networkRes.clone());
                    return networkRes;
                });
            })
        );
        return;
    }

    // ── Everything else (HTML, JS, CSS) ─ Network First, Cache Fallback ────────
    // This solves the issue of users having to manually clear cache for new updates!
    event.respondWith(
        fetch(request).then((networkRes) => {
            bgCache(request, networkRes.clone());
            return networkRes;
        }).catch(() => {
            // If offline, use cache
            return caches.match(request);
        })
    );
});
