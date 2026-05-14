/**
 * Utility for generating UUIDs compatible with both secure (HTTPS) and 
 * non-secure (HTTP) contexts.
 */
export const generateUUID = (): string => {
    // If we're in a secure context and the browser supports it, use the native API
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    
    // Fallback implementation for non-secure contexts (HTTP)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
