import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { useNetworkStatus } from './useNetworkStatus';

export const useDataSync = () => {
    const isOnline = useNetworkStatus();
    const [syncType, setSyncType] = useState<'config' | 'images' | 'all' | null>(null);

    // 1. Sync Active Orders (Real-time operational data)
    const syncOrders = useCallback(async (isSilent = true) => {
        if (!isOnline) return;

        try {
            const cachedUserStr = localStorage.getItem('currentUser');
            let textUser: any = null;
            try { textUser = JSON.parse(cachedUserStr || '{}'); } catch (e) { }
            const branchId = textUser?.branch_id;

            let ordersQuery = supabase.from('orders')
                .select('*, order_items(*, products(*)), waiter:profiles!waiter_id(name)')
                .in('status', ['pending', 'preparing', 'ready'])
                .order('created_at', { ascending: true });

            if (branchId) {
                ordersQuery = ordersQuery.eq('branch_id', branchId);
            }

            const { data: activeOrders, error } = await ordersQuery;

            if (activeOrders && !error) {
                const activeOrdersMap: Record<string, any> = {};
                activeOrders.forEach(o => {
                    if (o.table_id) activeOrdersMap[o.table_id] = o;
                });
                localStorage.setItem('cached_active_orders', JSON.stringify(activeOrdersMap));
                if (!isSilent) console.log('✅ Orders synced.');
            }
        } catch (e) {
            if (!isSilent) console.error('Error syncing orders:', e);
        }
    }, [isOnline]);

    // 2. Sync Master Data (Prices, Categories, Products - Manual Control)
    const syncMasterData = useCallback(async (type: 'config' | 'images' | 'all' = 'all') => {
        if (!isOnline) {
            const notify = (window as any).notify;
            if (notify) notify.error('📡 Sin conexión a internet.');
            return;
        }

        if (syncType) return;
        setSyncType(type);

        try {
            const { masterDataDB } = await import('../services/MasterDataDB');

            const [
                { data: tables },
                { data: sections },
                { data: categories },
                { data: products },
                { data: profiles },
                { data: printers },
                { data: settings },
                { data: roles },
                { data: branchPrices }
            ] = await Promise.all([
                supabase.from('tables').select('*').order('number'),
                supabase.from('sections').select('*').order('priority', { ascending: true }).order('name'),
                supabase.from('categories').select('*').order('order_index'),
                supabase.from('products').select('*').eq('is_available', true),
                supabase.from('profiles').select('*'),
                supabase.from('kitchen_stations').select('*'),
                supabase.from('system_settings').select('*').limit(1).maybeSingle(),
                supabase.from('roles').select('*'),
                supabase.from('product_branch_prices').select('*')
            ]);

            if (tables) await masterDataDB.saveData('tables', tables);
            if (sections) await masterDataDB.saveData('sections', sections);
            if (categories) await masterDataDB.saveData('categories', categories);
            if (products) await masterDataDB.saveData('products', products);
            if (profiles) await masterDataDB.saveData('profiles', profiles);
            if (printers) await masterDataDB.saveData('printers', printers);
            if (settings) await masterDataDB.saveData('system_settings', settings);
            if (roles) await masterDataDB.saveData('roles', roles);
            if (branchPrices) await masterDataDB.saveData('branch_prices', branchPrices);

            if (tables) localStorage.setItem('cached_tables', JSON.stringify(tables));
            if (sections) localStorage.setItem('cached_sections', JSON.stringify(sections.map(s => s.name)));
            if (categories) localStorage.setItem('cached_categories', JSON.stringify(categories));
            if (products) localStorage.setItem('cached_products', JSON.stringify(products));
            if (branchPrices) localStorage.setItem('cached_branch_prices', JSON.stringify(branchPrices));

            // Also sync orders while we are at it
            await syncOrders(true);

            await new Promise(resolve => setTimeout(resolve, 1500));
            const notify = (window as any).notify;
            const msg = type === 'config' ? 'Configuración y precios actualizados.' : (type === 'images' ? 'Imágenes actualizadas.' : 'Sincronización manual completa.');
            if (notify) notify.success(msg);
            else alert('✅ ' + msg);

        } catch (e) {
            console.error('❌ Master Data Sync Failed:', e);
            const notify = (window as any).notify;
            if (notify) notify.error('Error al actualizar datos. Revisa tu conexión.');
        } finally {
            setSyncType(null);
        }
    }, [isOnline, syncType, syncOrders]);

    useEffect(() => {
        // Initial sync on mount (only orders)
        syncOrders(true);
        
        // Background interval (Orders ONLY - every 60s)
        const interval = setInterval(() => syncOrders(true), 60000); 
        return () => clearInterval(interval);
    }, [isOnline, syncOrders]);

    return { syncData: syncMasterData, syncType, isSyncing: !!syncType };
};
