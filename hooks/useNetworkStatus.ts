import { useState, useEffect } from 'react';

export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isServerConnected, setIsServerConnected] = useState(true);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        const handleSupabaseStatus = (e: any) => {
            if (e.detail !== undefined) setIsServerConnected(e.detail);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('supabase-connection-status' as any, handleSupabaseStatus);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('supabase-connection-status' as any, handleSupabaseStatus);
        };
    }, []);

    return { isOnline, isServerConnected };
};
