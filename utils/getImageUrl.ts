/**
 * getImageUrl - Resolves a remote image URL to a local file when running in Electron.
 *
 * When the user presses "ACTUALIZAR IMÁGENES", images are downloaded to the
 * OS filesystem (userData/images/) and mapped via the `app-image://` protocol.
 * That mapping is persisted in localStorage as `electron_image_cache`.
 *
 * Usage:
 *   import { getImageUrl } from '../utils/getImageUrl';
 *   <img src={getImageUrl(product.image_url)} />
 *
 * Behaviour:
 *  - Electron context + image downloaded → returns `app-image:///hash.jpg`
 *  - Electron context + not yet downloaded → returns remote URL (fallback)
 *  - Browser/web context → returns remote URL (unchanged)
 *  - Google Drive share links → converted to direct-download URL automatically
 */

const ELECTRON_CACHE_KEY = 'electron_image_cache';

/** Convert a Google Drive share link to a direct image URL */
function toDirectUrl(url: string): string {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        const idMatch = url.match(/[-\w]{25,}/);
        if (idMatch) return `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
    }
    return url;
}

/** Returns the best available URL for an image (local if cached, remote otherwise) */
export function getImageUrl(remoteUrl: string | null | undefined): string {
    if (!remoteUrl) return '';

    // Try Electron local cache first
    try {
        const cacheRaw = localStorage.getItem(ELECTRON_CACHE_KEY);
        if (cacheRaw) {
            const cache: Record<string, string> = JSON.parse(cacheRaw);
            if (cache[remoteUrl]) return cache[remoteUrl];
        }
    } catch {
        // localStorage parse error — ignore
    }

    // Fallback: return direct remote URL
    return toDirectUrl(remoteUrl);
}

/** Clear the local image cache (useful after reinstall or when images change) */
export function clearImageCache(): void {
    localStorage.removeItem(ELECTRON_CACHE_KEY);
}

/** Returns the number of images currently cached locally */
export function getImageCacheSize(): number {
    try {
        const cacheRaw = localStorage.getItem(ELECTRON_CACHE_KEY);
        if (!cacheRaw) return 0;
        return Object.keys(JSON.parse(cacheRaw)).length;
    } catch {
        return 0;
    }
}
