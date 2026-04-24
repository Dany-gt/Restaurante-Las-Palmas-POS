import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { useNetworkStatus } from './useNetworkStatus';
import { useNotify } from './useNotify';

export const useDataSync = () => {
    const { isOnline } = useNetworkStatus();
    const notify = useNotify();
    const [syncType, setSyncType] = useState<'config' | 'images' | 'all' | 'inventory' | null>(null);

    // 1. Sync Active Orders (Real-time operational data)
    const syncOrders = useCallback(async (isSilent = true) => {
        if (!isOnline) return;

        try {
            const cachedUserStr = localStorage.getItem('currentUser');
            let textUser: any = null;
            try { textUser = JSON.parse(cachedUserStr || '{}'); } catch (e) { }
            const branchId = textUser?.branch_id;

            let ordersQuery = supabase.from('orders')
                .select('*, order_items(*, products(*)), waiter:profiles!orders_waiter_id_fkey(name)')
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
    const syncMasterData = useCallback(async (type: 'config' | 'images' | 'all' | 'inventory' = 'all') => {
        if (!isOnline) {
            const notify = (window as any).notify;
            if (notify) notify.error('📡 Sin conexión a internet.');
            return;
        }

        if (syncType) return;
        setSyncType(type);

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
                // v1.6.9 - Silent
            }

            const { masterDataDB } = await import('../services/MasterDataDB');

            // 1. Fetching logic with individual error handling to prevent blocking the whole app
            const safeFetch = async (query: any, name: string) => {
                const { data, error } = await query;
                if (error) {
                    console.error(`❌ Sync error for [${name}]:`, error);
                    return null;
                }
                return data;
            };

            const [
                tables,
                sections,
                categories,
                prodCats,
                menuCats,
                products,
                profiles,
                printers,
                settings,
                roles,
                branchPrices,
                branchInventory
            ] = await Promise.all([
                safeFetch(supabase.from('tables').select('*').order('number'), 'tables'),
                safeFetch(supabase.from('sections').select('*').order('priority', { ascending: true }).order('name'), 'sections'),
                safeFetch(supabase.from('categories').select('*').order('order_index'), 'categories'),
                safeFetch(supabase.from('product_categories').select('*').order('nombre'), 'product_categories'),
                safeFetch(supabase.from('menu_categories').select('*').order('nombre'), 'menu_categories'),
                safeFetch(supabase.from('products').select('*').eq('is_available', true), 'products'),
                safeFetch(supabase.from('profiles').select('*'), 'profiles'),
                safeFetch(supabase.from('kitchen_stations').select('*'), 'printers'),
                safeFetch(supabase.from('system_settings').select('*').limit(1).maybeSingle(), 'settings'),
                safeFetch(supabase.from('roles').select('*'), 'roles'),
                safeFetch(supabase.from('product_branch_prices').select('*'), 'branchPrices'),
                safeFetch(supabase.from('product_branch_inventory').select('*'), 'branchInventory')
            ]);

            // 2. Saving logic
            if (tables) {
                await masterDataDB.saveData('tables', tables);
                localStorage.setItem('cached_tables', JSON.stringify(tables));
            }
            if (sections) {
                await masterDataDB.saveData('sections', sections);
                localStorage.setItem('cached_sections', JSON.stringify(sections.map(s => s.name)));
            }
            if (categories) {
                // Combined categories from all 3 tables to bridge legacy, maintenance and menu systems
                const finalCombined = [
                    ...(menuCats || []).map(c => ({
                        ...c,
                        name: c.nombre || c.name,
                        image_url: c.imagen_url || c.image_url,
                        section: c.section || 'MENU',
                        order_index: c.sort_order ?? c.order_index ?? 999
                    })),
                    ...(prodCats || []).map(c => ({ 
                        ...c, 
                        name: c.nombre || c.name, 
                        image_url: c.imagen_url || c.image_url,
                        section: c.section || 'INVENTARIO',
                        order_index: c.sort_order ?? c.order_index ?? 999
                    })),
                    ...(categories || []).map(c => ({ 
                        ...c, 
                        order_index: c.order_index ?? c.sort_order ?? 999 
                    }))
                ];

                await masterDataDB.saveData('categories', finalCombined);
                localStorage.setItem('cached_categories', JSON.stringify(finalCombined));
            }
            if (products) {
                // v1.6.14 - Image fallback mapping for products
                const mappedProducts = products.map((p: any) => ({
                    ...p,
                    image_url: p.image_url || p.imagen_url || null
                }));
                await masterDataDB.saveData('products', mappedProducts);
                localStorage.setItem('cached_products', JSON.stringify(mappedProducts));
            }
            if (profiles) await masterDataDB.saveData('profiles', profiles);
            if (printers) await masterDataDB.saveData('printers', printers);
            if (settings) await masterDataDB.saveData('system_settings', settings);
            if (roles) await masterDataDB.saveData('roles', roles);
            if (branchPrices) {
                await masterDataDB.saveData('branch_prices' as any, branchPrices);
                localStorage.setItem('cached_branch_prices', JSON.stringify(branchPrices));
            }
            if (branchInventory) {
                await masterDataDB.saveData('branch_inventory' as any, branchInventory);
                localStorage.setItem('cached_branch_inventory', JSON.stringify(branchInventory));
            }
            
            // Sync orders in background
            await syncOrders(true);

            // Only notify for manual syncs, not automatic inventory refreshes
            if (type !== 'inventory') {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const msg = type === 'config' ? 'Configuración y precios actualizados.' : (type === 'images' ? 'Imágenes actualizadas.' : 'Sincronización manual completa.');
                notify.success(msg);
            } else {
                console.log('🔄 Inventario actualizado silenciosamente.');
            }

        } catch (e) {
            console.error('❌ Master Data Sync Failed:', e);
            notify.error('Error al actualizar datos. Revisa tu conexión.');
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

    // AUTO-REFRESH LISTENER
    useEffect(() => {
        const handleRefresh = () => {
            syncMasterData('inventory'); // Silent refresh for inventory badges after order submission
        };
        window.addEventListener('refresh-inventory', handleRefresh);
        return () => window.removeEventListener('refresh-inventory', handleRefresh);
    }, [syncMasterData]);

    return { syncData: syncMasterData, syncType, isSyncing: !!syncType };
};
