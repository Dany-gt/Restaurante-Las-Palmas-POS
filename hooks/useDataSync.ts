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
                branchInventory,
                itemInventory
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
                safeFetch(supabase.from('product_branch_inventory').select('*'), 'branchInventory'),
                safeFetch(supabase.from('inventory_item_branches').select('*'), 'itemInventory')
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
            // Combined categories from all 3 tables - declared at outer scope so image caching can access it
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

            if (categories) {
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
            if (itemInventory) {
                localStorage.setItem('cached_inventory_item_branches', JSON.stringify(itemInventory));
            }
            
            // Sync orders in background
            await syncOrders(true);

            // ── Image caching logic ───────────────────────────────────────────────
            if (type === 'images' || type === 'all') {
                try {
                    const imageUrls: string[] = [];

                    if (settings) {
                        if (settings.logo_url) imageUrls.push(settings.logo_url);
                        if (settings.login_background_url) imageUrls.push(settings.login_background_url);
                    }
                    if (products) {
                        products.forEach((p: any) => {
                            if (p.image_url) imageUrls.push(p.image_url);
                            if (p.imagen_url) imageUrls.push(p.imagen_url);
                        });
                    }
                    finalCombined.forEach((c: any) => {
                        if (c.image_url) imageUrls.push(c.image_url);
                        if (c.imagen_url) imageUrls.push(c.imagen_url);
                    });

                    // POS terminals logos
                    const { data: posData } = await supabase.from('pos_terminals').select('logo_url').not('logo_url', 'is', null);
                    if (posData) {
                        posData.forEach((p: any) => { if (p.logo_url) imageUrls.push(p.logo_url); });
                    }

                    const validUrls = Array.from(new Set(
                        imageUrls.filter(u => u && typeof u === 'string' && u.startsWith('http'))
                    ));

                    const getDirectUrl = (url: string): string => {
                        if (!url) return '';
                        if (url.includes('drive.google.com')) {
                            const idMatch = url.match(/[-\w]{25,}/);
                            if (idMatch) return `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
                        }
                        return url;
                    };

                    if (validUrls.length > 0) {
                        const electronAPI = (window as any).electronAPI;

                        if (electronAPI?.downloadImages) {
                            // ── ELECTRON: Descarga imágenes al disco duro ─────────────────
                            console.log(`📁 [Electron] Descargando ${validUrls.length} imágenes al disco...`);
                            const imageList = validUrls.map(url => ({
                                originalUrl: url,
                                directUrl: getDirectUrl(url)
                            }));
                            const localMapping: Record<string, string> = await electronAPI.downloadImages(imageList);
                            if (Object.keys(localMapping).length > 0) {
                                const existing: Record<string, string> = JSON.parse(localStorage.getItem('electron_image_cache') || '{}');
                                localStorage.setItem('electron_image_cache', JSON.stringify({ ...existing, ...localMapping }));
                                console.log(`✅ [Electron] ${Object.keys(localMapping).length} imágenes guardadas localmente.`);
                            }
                        } else {
                            // ── WEB / TABLETA (PWA): Cache API del navegador ──────────────
                            // Descarga activamente las imágenes y las almacena en la Cache API
                            // del navegador. El service worker las sirve en modo "Cache First"
                            // en solicitudes futuras → funciona offline y sin parpadeo.
                            console.log(`📥 [PWA] Cacheando ${validUrls.length} imágenes en Cache API...`);

                            const MEDIA_CACHE = 'app-media-cache';
                            const cache = 'caches' in window ? await caches.open(MEDIA_CACHE) : null;

                            let cached = 0;
                            let skipped = 0;

                            await Promise.allSettled(validUrls.map(async (url) => {
                                try {
                                    const directUrl = getDirectUrl(url);
                                    if (!directUrl) return;

                                    if (cache) {
                                        // Check if already cached to avoid re-downloading
                                        const existing = await cache.match(directUrl);
                                        if (existing) { skipped++; return; }

                                        // Fetch and store. Use no-cors for cross-origin images
                                        // (Supabase Storage, Google Drive direct links, etc.)
                                        // Note: no-cors produces opaque responses (status 0) which
                                        // cannot be inspected but CAN be stored and served back.
                                        const response = await fetch(directUrl, {
                                            mode: directUrl.includes(window.location.hostname) ? 'cors' : 'no-cors',
                                            cache: 'force-cache'
                                        });
                                        // Only cache non-error responses
                                        if (response.status === 0 || response.ok) {
                                            await cache.put(directUrl, response);
                                            cached++;
                                        }
                                    } else {
                                        // Fallback: at least preload into browser memory for this session
                                        const img = new Image();
                                        img.src = directUrl;
                                        cached++;
                                    }
                                } catch {
                                    // Individual image error — skip silently
                                }
                            }));

                            console.log(`✅ [PWA] ${cached} imágenes cacheadas, ${skipped} ya estaban en caché.`);
                        }
                    }
                } catch (e) {
                    console.error('Error cacheando imágenes:', e);
                }
            }

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
