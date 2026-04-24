import React, { useState, useEffect, useRef } from 'react';
import { Clock, CheckCircle2, Flame, ChefHat, Bell, AlertCircle, Loader2, Play, Check, Trash2, Volume2, VolumeX, ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { supabase } from '../supabase';

interface KDSItem {
    id: string;
    product_name: string;
    quantity: number;
    notes?: string;
    status: 'pending' | 'preparing' | 'ready' | 'delivered';
    kitchen_station_id?: string;
    preparing_at?: string;
}

interface KDSOrder {
    id: string;
    table_number: string;
    section: string;
    waiter_name: string;
    created_at: string;
    items: KDSItem[];
    order_number?: number;
    original_order_id: string;
}

interface KitchenStation {
    id: string;
    name: string;
    is_enabled: boolean;
    sound_id?: string | null;
}

interface SoundLibraryItem {
    id: string;
    file_url: string;
}

export const KitchenView: React.FC = () => {
    const [orders, setOrders] = useState<KDSOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'ready'>('all');
    const [kitchenStations, setKitchenStations] = useState<KitchenStation[]>([]);
    const [selectedStation, setSelectedStation] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<KDSOrder | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const ordersPerPage = 5;

    const [soundSettings, setSoundSettings] = useState<{
        defaultSoundId: string | null;
        enabled: boolean;
        volume: number;
    }>({ defaultSoundId: null, enabled: true, volume: 0.8 });
    const [soundLibrary, setSoundLibrary] = useState<Record<string, string>>({});
    const soundCache = useRef<Record<string, HTMLAudioElement>>({});
    const previousOrderCountRef = useRef<number>(0);

    const fetchKitchenStations = React.useCallback(async () => {
        try {
            const { data } = await supabase
                .from('kitchen_stations')
                .select('id, name, is_enabled, sound_id')
                .eq('is_enabled', true)
                .order('name', { ascending: true });

            if (data) {
                setKitchenStations(data);
            }
        } catch (e) {
            console.error('KDS: Error fetching kitchen stations:', e);
        }
    }, []);

    const fetchSoundSettings = React.useCallback(async () => {
        try {
            console.log('KDS: Fetching sound settings...');
            // Fetch with fallback logic: first try all, if 400, try common ones
            const { data: settingsData, error } = await supabase
                .from('system_settings')
                .select('kds_default_sound_id, kds_alert_enabled, kds_alert_volume')
                .eq('id', 1)
                .single();

            if (error) {
                console.warn('KDS: Could not fetch advanced sound settings, falling back...', error);
                // Minimal fallback to avoid crash if columns are missing
                const { data: fallback } = await supabase.from('system_settings').select('restaurant_name').eq('id', 1).single();
                if (fallback) setSoundSettings(prev => ({ ...prev, ...fallback }));
            } else if (settingsData) {
                setSoundSettings({
                    defaultSoundId: settingsData.kds_default_sound_id,
                    enabled: settingsData.kds_alert_enabled ?? true,
                    volume: settingsData.kds_alert_volume ? parseFloat(settingsData.kds_alert_volume) : 0.8
                });
            }

            const { data: libraryData, error: libError } = await supabase
                .from('sound_library')
                .select('id, file_url')
                .eq('is_active', true);

            if (libError) console.error('KDS: Error fetching sound library:', libError);
            if (libraryData) {
                const lib: Record<string, string> = {};
                libraryData.forEach(s => lib[s.id] = s.file_url);
                setSoundLibrary(lib);
            }
        } catch (e) {
            console.error('KDS: Error in fetchSoundSettings:', e);
        }
    }, []);

    const fetchKDSData = React.useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            console.log('KDS: START Fetch Order Data. Station Filter:', selectedStation);

            // 1. Fetch Orders
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select(`
          id,
          created_at,
          status,
          waiter_id,
          customer_name,
          order_type,
          order_number,
          table_id,
          tables (number, section)
        `)
                .in('status', ['pending', 'preparing', 'ready'])
                .order('created_at', { ascending: true });

            if (ordersError) {
                console.error('KDS: Supabase Orders Error:', ordersError);
                return;
            }

            console.log(`KDS: Found ${ordersData?.length || 0} active orders.`);

            if (!ordersData || ordersData.length === 0) {
                setOrders([]);
                return;
            }

            // 2. Fetch order_items
            const orderIds = ordersData.map(o => o.id);
            const { data: allOrderItems, error: itemsError } = await supabase
                .from('order_items')
                .select('*, products(name, kitchen_station_id)')
                .in('order_id', orderIds);

            if (itemsError) {
                console.error('KDS: Error fetching order items:', itemsError);
            }

            console.log(`KDS: Fetched ${allOrderItems?.length || 0} items for these orders.`);

            // 3. Extract Waiter IDs and fetch Profiles
            const waiterIds = Array.from(new Set(ordersData.map((o: any) => o.waiter_id).filter(Boolean)));
            let profilesMap: Record<string, string> = {};

            if (waiterIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, name')
                    .in('id', waiterIds);

                profilesData?.forEach((p: any) => {
                    profilesMap[p.id] = p.name;
                });
            }

            // 4. Group items by order_id AND created_at to separate submission batches
            const itemGroups: Record<string, any[]> = {};
            (allOrderItems || []).forEach(item => {
                // Skip delivered items as they shouldn't be in KDS
                if (item.status === 'delivered') return;

                // Use a composite key for grouping: orderId + creation timestamp
                const key = `${item.order_id}_${item.created_at}`;
                if (!itemGroups[key]) itemGroups[key] = [];
                itemGroups[key].push(item);
            });

            // 5. Map groups to KDSOrder objects
            const formattedOrders: KDSOrder[] = Object.entries(itemGroups).map(([groupKey, items]) => {
                const orderId = items[0].order_id;
                const ord = ordersData.find(o => o.id === orderId);
                if (!ord) return null;

                // Apply station filter to items in this batch
                const filteredItems = selectedStation
                    ? items.filter(item => item.products?.kitchen_station_id === selectedStation)
                    : items;

                if (filteredItems.length === 0) return null;

                const tableData = Array.isArray(ord.tables) ? ord.tables[0] : ord.tables;

                return {
                    id: groupKey, // Use the composite key as unique ID for this card
                    original_order_id: ord.id,
                    table_number: tableData?.number?.toString() || (ord.order_type === 'DELIVERY' ? 'DOM' : 'LLEVAR'),
                    section: tableData?.section || ord.customer_name || 'GENERAL',
                    waiter_name: profilesMap[ord.waiter_id] || 'Mesero',
                    created_at: items[0].created_at, // Use the batch's creation time for the timer
                    order_number: ord.order_number,
                    items: filteredItems.map((oi: any) => ({
                        id: oi.id,
                        product_name: oi.products?.name || 'Producto Sin Nombre',
                        quantity: oi.quantity || 1,
                        notes: oi.notes,
                        status: oi.status || 'pending',
                        kitchen_station_id: oi.products?.kitchen_station_id,
                        preparing_at: oi.preparing_at
                    }))
                };
            }).filter(Boolean) as KDSOrder[];

            // Sort by creation time (batch time)
            formattedOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            console.log(`KDS: Final visible batches/cards: ${formattedOrders.length}`);
            setOrders(formattedOrders);
        } catch (e) {
            console.error('KDS: Unexpected error in fetchKDSData:', e);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [selectedStation]);

    useEffect(() => {
        console.log('KDS: Initial initialization');
        fetchKitchenStations();
        fetchSoundSettings();
        fetchKDSData();
    }, [fetchKitchenStations, fetchSoundSettings, fetchKDSData]);

    useEffect(() => {
        console.log('KDS: Establishing Real-time Subscription...');
        const channel = supabase
            .channel(`kds_v2_${selectedStation || 'all'}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
                console.log('KDS: Change in order_items:', payload.eventType);
                fetchKDSData(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                console.log('KDS: Change in orders:', payload.eventType);
                fetchKDSData(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_stations' }, () => {
                fetchKitchenStations();
            })
            .subscribe((status) => {
                console.log('KDS: Real-time status:', status);
            });

        return () => {
            console.log('KDS: Cleaning up subscription');
            supabase.removeChannel(channel);
        };
    }, [fetchKDSData, fetchKitchenStations, selectedStation]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(0);
    }, [filter, selectedStation]);

    // Handle minutes counters update and Polling Fallback
    useEffect(() => {
        console.log('KDS: Starting counter and polling (10s) interval');
        const interval = setInterval(() => {
            // Refresh timers
            setOrders(prev => [...prev]);
            // Safety poll every 10s to ensure real-time sync even if subscription lags
            fetchKDSData(true);
        }, 10000);
        return () => clearInterval(interval);
    }, [fetchKDSData]);

    const [audioUnlocked, setAudioUnlocked] = useState(false);

    // Play sound when new orders arrive
    useEffect(() => {
        const playSound = (soundId: string) => {
            const url = soundLibrary[soundId];
            if (!url || !audioUnlocked) return;

            if (!soundCache.current[soundId]) {
                soundCache.current[soundId] = new Audio(url);
            }

            const audio = soundCache.current[soundId];
            audio.volume = soundSettings.volume;
            audio.play().catch(err => {
                console.error('KDS: Sound play error:', err);
                if (err.name === 'NotAllowedError') {
                    setAudioUnlocked(false);
                }
            });
        };

        // If new orders arrived and we're not just loading for the first time
        if (orders.length > previousOrderCountRef.current && soundSettings.enabled && previousOrderCountRef.current > 0) {
            const newOrdersCount = orders.length - previousOrderCountRef.current;
            // Get the last N orders (the newest ones)
            const newOrders = orders.slice(-newOrdersCount);

            console.log(`KDS: New orders detected: ${newOrdersCount}. Playing sounds...`);

            newOrders.forEach(order => {
                // Find which station this belongs to (priority to current filter, then first item)
                const stationId = selectedStation || order.items[0]?.kitchen_station_id;
                const station = kitchenStations.find(ks => ks.id === stationId);
                const targetSoundId = station?.sound_id || soundSettings.defaultSoundId;

                if (targetSoundId) {
                    playSound(targetSoundId);
                }
            });
        }
        previousOrderCountRef.current = orders.length;
    }, [orders, soundLibrary, soundSettings.enabled, kitchenStations, selectedStation, audioUnlocked, soundSettings.volume, soundSettings.defaultSoundId]);

    const unlockAudio = () => {
        console.log('KDS: Unlocking audio context...');
        setAudioUnlocked(true);

        // Try to play any real sound from the library at near-zero volume to prime the browser
        const librarySounds = Object.values(soundLibrary) as string[];
        if (librarySounds.length > 0) {
            const audio = new Audio(librarySounds[0]);
            audio.volume = 0.01;
            audio.play()
                .then(() => console.log('KDS: Audio successfully primed.'))
                .catch(err => console.warn('KDS: Auto-prime failed, but state is unlocked:', err));
        } else {
            console.log('KDS: No sounds in library to prime, state unlocked anyway.');
        }
    };

    const updateItemStatus = async (itemId: string, nextStatus: string) => {
        // 1. Actualización Optimista (Cambiamos el estado local de inmediato)
        setOrders(prev => prev.map(order => ({
            ...order,
            items: order.items.map(item => item.id === itemId ? {
                ...item,
                status: nextStatus as any,
                preparing_at: nextStatus === 'preparing' ? new Date().toISOString() : item.preparing_at
            } : item)
        })));

        // 2. Si el modal está abierto, también lo actualizamos de forma optimista
        const now = new Date().toISOString();
        setSelectedOrder(prev => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.map(item => item.id === itemId ? {
                    ...item,
                    status: nextStatus as any,
                    preparing_at: nextStatus === 'preparing' ? now : item.preparing_at
                } : item)
            };
        });

        // 3. Persistir en la base de datos
        const updateData: any = { status: nextStatus };
        if (nextStatus === 'preparing') {
            updateData.preparing_at = now;
        }

        const { error } = await supabase
            .from('order_items')
            .update(updateData)
            .eq('id', itemId);

        if (error) console.error(error);
    };

    const getTimeDiff = (date: string) => {
        const minutes = Math.floor((new Date().getTime() - new Date(date).getTime()) / 60000);
        return minutes;
    };

    const formatTimeDiff = (minutes: number) => {
        if (minutes < 60) return `${minutes} MIN`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}H ${mins}M`;
    };

    const getWaitColor = (minutes: number) => {
        if (minutes > 20) return 'text-red-500 bg-red-500/10 border-red-500/20';
        if (minutes > 10) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    };

    if (loading) return (
        <div className="h-full flex items-center justify-center bg-[#0f1115]">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Sincronizando Cocina...</span>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[#0a0c10] overflow-hidden">
            {/* HEADER KDS */}
            <header className="p-8 border-b border-white/5 bg-[#0f1115] flex justify-between items-center shadow-xl">
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                        <ChefHat size={32} className="text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">Kitchen Display System</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Restaurante Las Palmas</span>
                            <div className="w-1 h-1 rounded-full bg-white/20"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{orders.length} Comandas Activas</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 items-center">
                    {/* PAGINATION CONTROLS */}
                    {Math.ceil(orders.length / ordersPerPage) > 1 && (
                        <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/5 mr-4">
                            <button
                                disabled={currentPage === 0}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-20 disabled:hover:bg-transparent transition-all text-gray-400"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="px-3 flex flex-col items-center">
                                <span className="text-[9px] font-black tracking-tighter text-indigo-400">PÁGINA {currentPage + 1}</span>
                                <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">{Math.ceil(orders.length / ordersPerPage)} TOTAL</span>
                            </div>
                            <button
                                disabled={(currentPage + 1) * ordersPerPage >= orders.length}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-20 disabled:hover:bg-transparent transition-all text-gray-400"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}

                    {/* AUDIO UNLOCK BUTTON */}
                    <button
                        onClick={unlockAudio}
                        className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${audioUnlocked
                            ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-600/40 animate-pulse'
                            }`}
                    >
                        {audioUnlocked ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        {audioUnlocked ? 'Sonido Activado' : 'Activar Sonido'}
                    </button>

                    <div className="w-px h-8 bg-white/20 mx-2"></div>

                    <FilterButton label="TODO" active={filter === 'all'} onClick={() => setFilter('all')} />
                    <FilterButton label="PENDIENTE" active={filter === 'pending'} onClick={() => setFilter('pending')} />
                    <FilterButton label="LISTO" active={filter === 'ready'} onClick={() => setFilter('ready')} />
                    <div className="w-px h-8 bg-white/20 mx-2"></div>
                    <FilterButton
                        label="TODAS LAS ESTACIONES"
                        active={selectedStation === null}
                        onClick={() => setSelectedStation(null)}
                    />
                    {kitchenStations.map(station => (
                        <React.Fragment key={station.id}>
                            <FilterButton
                                label={station.name}
                                active={selectedStation === station.id}
                                onClick={() => setSelectedStation(station.id)}
                            />
                        </React.Fragment>
                    ))}
                </div>
            </header>

            {/* GRID DE COMANDAS - Fixed Height Calculation to ensure bottom coverage */}
            <main className="flex-1 p-6 overflow-hidden h-[calc(100vh-140px)]">
                <div className="grid grid-cols-5 grid-rows-1 gap-6 h-full">
                    {orders
                        .slice(currentPage * ordersPerPage, (currentPage + 1) * ordersPerPage)
                        .map(order => (
                            <div key={order.id} className="flex flex-col bg-[#16191f] rounded-[1.5rem] border border-white/5 shadow-2xl relative overflow-hidden group h-full">
                                {/* CABECERA DE COMANDA */}
                                <div className={`p-4 border-b border-white/5 flex justify-between items-start transition-colors ${getTimeDiff(order.created_at) > 15 ? 'bg-red-900/10' : 'bg-black/20'
                                    }`}>
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-lg font-black tracking-tighter uppercase">
                                                {order.order_number ? `#${order.order_number}` : ''} {order.table_number.length < 4 ? `MESA ${order.table_number}` : order.table_number}
                                            </span>
                                            <div className="flex flex-col gap-0.5">
                                                {(() => {
                                                    // 1. Filter items for the current station (or all if no station selected)
                                                    const stationItems = selectedStation
                                                        ? order.items.filter(i => i.products?.kitchen_station_id === selectedStation)
                                                        : order.items;

                                                    // 2. Find start time specifically for these items
                                                    const stationPrepStart = stationItems.find(i => i.preparing_at)?.preparing_at;

                                                    // 3. Calculate Wait Time (Red Clock)
                                                    // Freezes if THIS station has started. Otherwise keeps running.
                                                    const waitEnd = stationPrepStart ? new Date(stationPrepStart) : new Date();
                                                    const waitStart = new Date(order.created_at);
                                                    const waitMinutes = Math.floor((waitEnd.getTime() - waitStart.getTime()) / 60000);

                                                    // 4. Calculate Prep Time (Blue/Flame Clock)
                                                    // Only runs if THIS station has started
                                                    const prepMinutes = stationPrepStart
                                                        ? Math.floor((new Date().getTime() - new Date(stationPrepStart).getTime()) / 60000)
                                                        : 0;

                                                    return (
                                                        <>
                                                            <div className={`px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-tight flex items-center gap-1.5 ${getWaitColor(waitMinutes)}`}>
                                                                <Clock size={8} /> {formatTimeDiff(waitMinutes)}
                                                            </div>
                                                            {prepMinutes > 0 && (
                                                                <div className="px-1.5 py-0.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase tracking-tight flex items-center gap-1.5">
                                                                    <Flame size={8} className="animate-pulse" /> {formatTimeDiff(prepMinutes)}
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 truncate block w-40">{order.section} • {order.waiter_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                                            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-500 transition-colors"
                                        >
                                            <Maximize2 size={12} />
                                        </button>
                                        <div className="p-2 bg-white/5 rounded-xl">
                                            <Bell size={12} className={`${getTimeDiff(order.created_at) > 15 ? 'text-red-500 animate-bounce' : 'text-gray-600'}`} />
                                        </div>
                                    </div>
                                </div>

                                {/* LISTA DE ITEMS */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                                    {order.items.map(item => (
                                        <div key={item.id} className={`p-3 rounded-xl border transition-all ${item.status === 'ready' ? 'bg-emerald-500/5 border-emerald-500/20 opacity-40' :
                                            item.status === 'preparing' ? 'bg-indigo-500/10 border-indigo-500/30' :
                                                'bg-white/5 border-white/5'
                                            }`}>
                                            <div className="flex justify-between items-center gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-tight leading-none truncate">{item.product_name}</span>
                                                        <span className="text-[8px] font-bold text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded-full">x{item.quantity}</span>
                                                    </div>
                                                    {item.notes && (
                                                        <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <AlertCircle size={10} className="text-amber-500 flex-shrink-0" />
                                                                <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Indicaciones:</span>
                                                            </div>
                                                            <p className="text-[11px] text-amber-400 font-bold uppercase leading-snug break-words italic">
                                                                "{item.notes}"
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    {item.status === 'pending' ? (
                                                        <button
                                                            onClick={() => updateItemStatus(item.id, 'preparing')}
                                                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[7px] font-black uppercase tracking-tighter transition-all flex items-center gap-1 shadow-lg shadow-indigo-600/20"
                                                        >
                                                            <Play size={8} />
                                                        </button>
                                                    ) : item.status === 'preparing' ? (
                                                        <button
                                                            onClick={() => updateItemStatus(item.id, 'ready')}
                                                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[7px] font-black uppercase tracking-tighter transition-all flex items-center gap-1 shadow-lg shadow-emerald-600/20"
                                                        >
                                                            <Check size={9} />
                                                        </button>
                                                    ) : (
                                                        <div className="w-10 h-6 bg-emerald-500/20 text-emerald-500 rounded-md flex items-center justify-center border border-emerald-500/20">
                                                            <CheckCircle2 size={10} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* ACCIONES DE COMANDA COMPLETA (Station Aware) - Forced to bottom */}
                                <div className="mt-auto p-3 bg-black/40 border-t border-white/5 flex gap-2">
                                    {(() => {
                                        const stationItems = selectedStation
                                            ? order.items.filter(i => i.products?.kitchen_station_id === selectedStation)
                                            : order.items;

                                        const allReady = stationItems.every(i => i.status === 'ready' || i.status === 'delivered');
                                        const anyPending = stationItems.some(i => i.status === 'pending');
                                        const anyPreparing = stationItems.some(i => i.status === 'preparing');
                                        const stationName = kitchenStations.find(s => s.id === selectedStation)?.name || 'COCINA';

                                        if (allReady) {
                                            return (
                                                <button
                                                    onClick={async () => {
                                                        // Mark only THIS station's items as delivered (or all if no filter)
                                                        const itemsToDeliver = stationItems.filter(i => i.status === 'ready');
                                                        if (itemsToDeliver.length === 0) return;

                                                        const itemIds = itemsToDeliver.map(i => i.id);
                                                        await supabase.from('order_items').update({ status: 'delivered' }).in('id', itemIds);
                                                        fetchKDSData();
                                                    }}
                                                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-[8px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle2 size={12} /> ENTREGAR {selectedStation ? stationName : ''}
                                                </button>
                                            );
                                        }

                                        if (anyPending) {
                                            return (
                                                <button
                                                    onClick={async () => {
                                                        if (selectedStation) {
                                                            // Call the new RPC for station-specific start
                                                            const { error } = await supabase.rpc('start_station_items', {
                                                                p_order_id: order.original_order_id,
                                                                p_station_id: selectedStation
                                                            });

                                                            if (error) {
                                                                console.error("Error starting station items:", error);
                                                            } else {
                                                                // Optimistic update
                                                                const now = new Date().toISOString();
                                                                setOrders(prev => prev.map(o => {
                                                                    if (o.id !== order.id) return o;
                                                                    return {
                                                                        ...o,
                                                                        items: o.items.map(item => {
                                                                            if (item.products?.kitchen_station_id === selectedStation && item.status === 'pending') {
                                                                                return { ...item, status: 'preparing', preparing_at: now };
                                                                            }
                                                                            return item;
                                                                        })
                                                                    };
                                                                }));
                                                            }
                                                        } else {
                                                            // Fallback for "All Stations": start simplified logic or alert user
                                                            // For now, let's just start first pending item to avoid blocking
                                                            // A better UX might be to require station selection or start all
                                                            console.warn("Select a station to start items en-masse");
                                                        }
                                                    }}
                                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-black text-[8px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Play size={12} /> EMPEZAR {selectedStation ? stationName : 'ORDEN'}
                                                </button>
                                            );
                                        }

                                        return (
                                            <div className="w-full flex items-center justify-center gap-2 text-gray-700 bg-white/5 py-2 rounded-lg border border-white/5">
                                                <Flame size={10} className="animate-pulse" />
                                                <span className="text-[7px] font-black uppercase tracking-widest">PREPARANDO {selectedStation ? stationName : ''}</span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        ))}

                    {/* EMPTY CARDS TO MAINTAIN GRID SHAPE (Always show up to 10) */}
                    {Array.from({ length: Math.max(0, ordersPerPage - orders.slice(currentPage * ordersPerPage, (currentPage + 1) * ordersPerPage).length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-full border border-white/[0.02] rounded-[1.5rem] bg-white/[0.01] flex items-center justify-center">
                            {orders.length === 0 && i === 2 && (
                                <div className="flex flex-col items-center opacity-5">
                                    <ChefHat size={40} className="mb-2" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-center">Sin Pedidos</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Remove the fullscreen empty state as we now show the grid slots */}
            </main>

            {/* MODAL DE DETALLE EXPANDIDO */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 lg:p-12 animate-fade-in">
                    <div className="bg-[#16191f] w-full max-w-4xl rounded-[3rem] border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/20">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                                    <ChefHat size={32} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">
                                        {selectedOrder.order_number ? `#${selectedOrder.order_number}` : ''} {selectedOrder.table_number.length < 4 ? `MESA ${selectedOrder.table_number}` : selectedOrder.table_number}
                                    </h2>
                                    <div className="flex items-center gap-4 mt-2">
                                        <p className="text-xs font-black uppercase text-gray-500 tracking-widest">{selectedOrder.section} • {selectedOrder.waiter_name}</p>
                                        <div className="flex gap-2">
                                            {(() => {
                                                const prepStart = selectedOrder.items.find(i => i.preparing_at)?.preparing_at;
                                                const waitEnd = prepStart || new Date().toISOString();
                                                const waitMinutes = Math.floor((new Date(waitEnd).getTime() - new Date(selectedOrder.created_at).getTime()) / 60000);
                                                const prepMinutes = prepStart ? Math.floor((new Date().getTime() - new Date(prepStart).getTime()) / 60000) : 0;

                                                return (
                                                    <>
                                                        <div className={`px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${getWaitColor(waitMinutes)}`}>
                                                            <Clock size={12} /> ESPERA: {formatTimeDiff(waitMinutes)}
                                                        </div>
                                                        {prepMinutes > 0 && (
                                                            <div className="px-2 py-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                                <Flame size={12} className="animate-pulse" /> PREP: {formatTimeDiff(prepMinutes)}
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="w-14 h-14 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all border border-white/10">
                                <X size={28} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide">
                            {selectedOrder.items.map(item => (
                                <div key={item.id} className={`p-6 rounded-[2rem] border transition-all ${item.status === 'ready' ? 'bg-emerald-500/5 border-emerald-500/20 opacity-40' :
                                    item.status === 'preparing' ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg shadow-indigo-600/10' :
                                        'bg-white/5 border-white/5'
                                    }`}>
                                    <div className="flex justify-between items-center gap-6">
                                        <div className="flex-1">
                                            <div className="flex items-baseline gap-4 mb-2">
                                                <span className="text-2xl font-black uppercase tracking-tight">{item.product_name}</span>
                                                <span className="text-sm font-bold text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-full">x{item.quantity}</span>
                                            </div>
                                            {item.notes && (
                                                <div className="mt-3 flex items-start gap-3 bg-black/40 p-4 rounded-2xl border border-white/5">
                                                    <AlertCircle size={18} className="text-amber-500 mt-1 flex-shrink-0" />
                                                    <p className="text-base text-amber-500 font-black uppercase leading-relaxed">"{item.notes}"</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {item.status === 'pending' && (
                                                <button
                                                    onClick={() => updateItemStatus(item.id, 'preparing')}
                                                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all flex items-center gap-3"
                                                >
                                                    <Play size={14} /> EMPEZAR COCINA
                                                </button>
                                            )}
                                            {item.status === 'preparing' && (
                                                <button
                                                    onClick={() => updateItemStatus(item.id, 'ready')}
                                                    className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all flex items-center gap-3"
                                                >
                                                    <Check size={18} /> TERMINAR
                                                </button>
                                            )}
                                            {item.status === 'ready' && (
                                                <div className="flex items-center gap-3 px-8 py-4 bg-emerald-500/20 text-emerald-500 rounded-2xl border border-emerald-500/20 font-black uppercase text-xs tracking-widest">
                                                    <CheckCircle2 size={24} /> LISTO
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-8 bg-black/40 border-t border-white/5">
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="w-full py-6 bg-white/5 hover:bg-white/10 rounded-[2rem] font-black uppercase tracking-[0.3em] transition-all"
                            >
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const FilterButton = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
    >
        {label}
    </button>
);
