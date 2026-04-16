
export const getSecureSoundUrl = (url: string) => {
    if (!url) return '';

    // Dynamically extract project ref from environment
    // @ts-ignore
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    let currentProjectRef = 'cofdsbczmrkriohlgyct'; // Default found in .env.local

    if (envUrl) {
        const match = envUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
        if (match) currentProjectRef = match[1];
    }

    // 1. Handle full URLs (detect old project refs and swap them)
    if (url.startsWith('http')) {
        // List of known old refs or generic check for supabase.co
        const isOldSupabase = url.includes('.supabase.co') && !url.includes(currentProjectRef);
        const isMalformedLegacy = url.includes('mrcfmsmxpbdmqclpzxpf'); // specifically catch the one in logs

        if (isOldSupabase || isMalformedLegacy) {
            const parts = url.split('/');
            const fileName = parts[parts.length - 1]; // e.g. "digital-alert.mp3" or "mrcfmsmxpbdmqclpzxpf.digital-alert.mp3"

            // If the filename itself contains a legacy prefix (e.g. prefix.name.mp3)
            if (fileName.includes('.') && fileName.split('.').length > 2) {
                const actualName = fileName.split('.').slice(1).join('.');
                return `https://${currentProjectRef}.supabase.co/storage/v1/object/public/kds-sounds/${actualName}`;
            }

            return `https://${currentProjectRef}.supabase.co/storage/v1/object/public/kds-sounds/${fileName}`;
        }
        return url;
    }

    // 2. Normalize and check for malformed parts
    let cleanUrl = url.trim();

    // Fix double extension bug (.mp3.mp3)
    if (cleanUrl.toLowerCase().endsWith('.mp3.mp3')) {
        cleanUrl = cleanUrl.slice(0, -4);
    }

    // Decode URL characters (like %20 for space)
    try {
        if (cleanUrl.includes('%')) {
            cleanUrl = decodeURIComponent(cleanUrl);
        }
    } catch (e) {
        // ignore decoding errors
    }

    // 2. Handle relative paths or malformed strings (ref.filename.mp3)
    // ... rest of logic ...
    if (cleanUrl.includes('.mp3') && !cleanUrl.includes('/')) {
        const parts = cleanUrl.split('.');
        if (parts.length > 2) {
            const fileName = parts.slice(1).join('.');
            return `https://${currentProjectRef}.supabase.co/storage/v1/object/public/kds-sounds/${fileName}`;
        }
        return `https://${currentProjectRef}.supabase.co/storage/v1/object/public/kds-sounds/${cleanUrl}`;
    }

    return `https://${currentProjectRef}.supabase.co/storage/v1/object/public/kds-sounds/${cleanUrl}`;
};
