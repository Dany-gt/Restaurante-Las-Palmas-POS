import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { offlineDB, OfflineRecord } from '../services/OfflineDB';

/**
 * HOOK: useOfflineSync (v1.6.4 - Senior Refactor)
 * Patrón "Auth-Guard" para sincronización segura y silenciosa.
 * Este hook evita bucles infinitos y errores 400 en consola validando la sesión
 * ANTES de realizar cualquier petición al servidor.
 */
export const useOfflineSync = () => {
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [authError, setAuthError] = useState(false);

    // 1. Contador de pendientes (Local-First)
    const updatePendingCount = useCallback(async () => {
        try {
            const count = await offlineDB.getPendingCount();
            setPendingCount(count);
            // Notificar al sistema global (opcional)
            window.dispatchEvent(new CustomEvent('offline-sync-count', { detail: count }));
        } catch (e) {
            console.error('OfflineDB: Error leyendo contador:', e);
        }
    }, []);

    /**
     * GUARDA DE SEGURIDAD:
     * Verifica que la sesión de Supabase Auth sea válida y la refresca si está por expirar.
     * Retorna TRUE solo si es seguro realizar peticiones de red.
     */
    const ensureSessionValid = async (): Promise<boolean> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                if (!authError) setAuthError(true);
                return false;
            }

            // PATRÓN PROACTIVO: Refrescar si faltan menos de 5 minutos (300s)
            const expiresAt = session.expires_at || 0;
            const now = Math.floor(Date.now() / 1000);
            
            if (expiresAt - now < 300) {
                console.log('📡 useOfflineSync: Sesión próxima a expirar. Refrescando...');
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError || !refreshData.session) {
                    setAuthError(true);
                    return false;
                }
            }

            if (authError) setAuthError(false);
            return true;
        } catch (e) {
            console.error('AuthGuard: Fallo crítico en verificación:', e);
            return false;
        }
    };

    /**
     * MOTOR DE SINCRONIZACIÓN:
     * Ejecuta el envío de registros locales al servidor de forma secuencial y segura.
     */
    const syncRecords = useCallback(async () => {
        // Guardas de entrada básica
        if (!navigator.onLine || isSyncing) return;

        // VALIDA AUTENTICACIÓN: No disparamos errores 400 si la sesión no existe.
        const canSync = await ensureSessionValid();
        if (!canSync) {
            // Silencioso: No alertar al usuario a menos que sea necesario.
            updatePendingCount(); 
            return;
        }

        const pending = await offlineDB.getPendingRecords();
        if (pending.length === 0) {
            updatePendingCount();
            return;
        }

        setIsSyncing(true);
        console.log(`🌐 useOfflineSync: Iniciando sincronización de ${pending.length} registros...`);

        try {
            for (const record of pending) {
                try {
                    const success = await processRecord(record);
                    if (success) {
                        await offlineDB.markAsSynced(record.id);
                    } else {
                        // Si falla una, seguimos pero incrementamos reintento
                        await offlineDB.incrementRetry(record.id);
                    }
                } catch (err) {
                    console.error(`❌ Fallo procesando registro ${record.id}:`, err);
                }
            }
        } catch (globalErr) {
            console.error('❌ Error global en bucle de sincronización:', globalErr);
        } finally {
            setIsSyncing(false);
            updatePendingCount();
        }
    }, [isSyncing, authError, updatePendingCount]);

    /**
     * Lógica específica de inserción por tipo de dato
     */
    const processRecord = async (record: OfflineRecord): Promise<boolean> => {
        const { id, type, data } = record;
        
        try {
            if (type === 'ORDER') {
                // Sincronización de Orden
                const { error: orderError } = await supabase.from('orders').upsert({
                    id: id,
                    ...data.order,
                    status: data.order.status || 'pending',
                    synced_at: new Date().toISOString()
                });

                if (orderError) throw orderError;

                // Sincronización de Items (si existen)
                if (data.items && data.items.length > 0) {
                    const { error: itemsError } = await supabase.from('order_items').upsert(
                        data.items.map((item: any) => ({
                            order_id: id,
                            ...item
                        }))
                    );
                    if (itemsError) throw itemsError;
                }

                // Sincronización de Factura (si existe)
                if (data.invoice) {
                    const { error: invError } = await supabase.from('invoices').upsert({
                        order_id: id,
                        ...data.invoice
                    });
                    if (invError) throw invError;
                }
            } else if (type === 'EXPENSE') {
                const { error } = await supabase.from('expenses').upsert({ id, ...data });
                if (error) throw error;
            } else if (type === 'CASH_INIT') {
                const { error } = await supabase.from('shifts').upsert({ id, ...data });
                if (error) throw error;
            } else if (type === 'CREDIT_PAYMENT') {
                const { data: rpcData, error } = await supabase.rpc('register_credit_payment', {
                    p_customer_id: data.customer_id,
                    p_amount: data.amount,
                    p_payment_method: data.payment_method,
                    p_description: data.description,
                    p_created_by: data.created_by
                });
                if (error) throw error;
                const result = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
                if (!result.success) return false;
            } else if (type === 'CASH_CLOSE') {
                const { error } = await supabase.from('shifts').update({
                    status: 'CLOSED',
                    ...data.closingData
                }).eq('id', id);
                if (error) throw error;
            }

            return true;
        } catch (e) {
            console.error(`Sync Error (${type}):`, e);
            return false;
        }
    };

    // --- Ciclo de vida y Disparadores ---
    useEffect(() => {
        updatePendingCount();

        // Disparadores masivos
        window.addEventListener('online', syncRecords);
        window.addEventListener('offline-sync-trigger', syncRecords);
        window.addEventListener('manual-offline-sync' as any, syncRecords);

        // Intervalo moderado: Cada 30 segundos (Equilibrio batería/consola/respuesta)
        const interval = setInterval(() => {
            if (navigator.onLine) syncRecords();
            else updatePendingCount();
        }, 30000);

        return () => {
            window.removeEventListener('online', syncRecords);
            window.removeEventListener('offline-sync-trigger', syncRecords);
            window.removeEventListener('manual-offline-sync' as any, syncRecords);
            clearInterval(interval);
        };
    }, [syncRecords, updatePendingCount]);

    return { pendingCount, isSyncing, authError, syncRecords };
};
