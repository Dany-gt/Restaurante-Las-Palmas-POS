import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';

// FIX A2: Ping adaptativo — rápido cuando offline, lento cuando online
// Reduce queries de 20/min → 4/min cuando hay internet estable
const PING_OFFLINE_MS = 3000;  // 3s cuando sin conexión (detección rápida)
const PING_ONLINE_MS  = 15000; // 15s cuando con conexión (ahorro de quota)
const PING_TIMEOUT_MS = 4000;  // Abortar si no responde en 4s

export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isServerConnected, setIsServerConnected] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isOnlineRef = useRef(isOnline); // Ref para leer el valor actual en el interval

    // Mantener ref sincronizado
    useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

    const checkConnection = useCallback(async () => {
        try {
            // Ping real: consulta ligera a una tabla que siempre existe
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
            const { error } = await supabase
                .from('system_settings')
                .select('id')
                .limit(1)
                .abortSignal(controller.signal);
            clearTimeout(timeout);

            const connected = !error;

            // Solo actualizar estado si cambió (evita re-renders innecesarios)
            if (connected !== isOnlineRef.current) {
                setIsOnline(connected);
                setIsServerConnected(connected);
                console.log(connected
                    ? '🟢 Red restaurada — cambiando a ping cada 15s'
                    : '🔴 Red perdida — cambiando a ping cada 3s'
                );
            }

            return connected;
        } catch {
            if (isOnlineRef.current) {
                setIsOnline(false);
                setIsServerConnected(false);
            }
            return false;
        }
    }, []);

    useEffect(() => {
        // Verificación inmediata al montar
        checkConnection();

        // Ping adaptativo: ajusta la frecuencia según el estado actual
        const scheduleInterval = (online: boolean) => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            const delay = online ? PING_ONLINE_MS : PING_OFFLINE_MS;
            intervalRef.current = setInterval(async () => {
                const nowOnline = await checkConnection();
                // Si el estado cambió, reagendar con nueva frecuencia
                if (nowOnline !== isOnlineRef.current) {
                    scheduleInterval(nowOnline);
                }
            }, delay);
        };

        scheduleInterval(navigator.onLine);

        // Eventos del navegador como respaldo para recuperación instantánea
        const handleOnline = () => {
            checkConnection();
            scheduleInterval(true);
        };
        const handleOffline = () => {
            setIsOnline(false);
            setIsServerConnected(false);
            scheduleInterval(false);
        };

        const handleSupabaseStatus = (e: any) => {
            if (e.detail !== undefined) setIsServerConnected(e.detail);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('supabase-connection-status' as any, handleSupabaseStatus);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('supabase-connection-status' as any, handleSupabaseStatus);
        };
    }, [checkConnection]);

    return { isOnline, isServerConnected };
};
