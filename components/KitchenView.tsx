import React, { useState, useEffect, useRef } from 'react';
import { KitchenTimer } from './KitchenTimer';
import { DateUtils } from '../utils/DateUtils';


import { Clock, CheckCircle2, Flame, ChefHat, Bell, AlertCircle, Loader2, Play, Check, Trash2, Volume2, VolumeX, ChevronLeft, ChevronRight, Maximize2, X, History, Mic, MicOff, Printer } from 'lucide-react';
import { supabase } from '../supabase';
import { speak, speakAfterAudio } from '../utils/voice';
import { getSecureSoundUrl } from '../utils/supabaseUtils';
import { generateUUID } from '../utils/uuid';

interface KDSItem {
  id: string;
  product_name: string;
  quantity: number;
  notes?: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivered';
  kitchen_station_id?: string;
  preparing_at?: string;
  ready_at?: string;
  cook_duration_seconds?: number;
  products?: {
    kitchen_station_id?: string;
    category_name?: string;
  };
  category_name?: string;
}

const STATION_CATEGORY_MAP: Record<string, string[]> = {
  'COCINA CALIENTE': ['HAMBURGUESAS', 'CALDOS', 'CARNES', 'DESAYUNOS', 'ALMUERZOS', 'EXTRAS', 'GUARNICIONES', 'MENU INFANTIL', 'SOPAS', 'PLATOS FUERTES', 'GUARNICIONES CALIENTES', 'TACOS', 'REFACCIONES'],
  'COCINA': ['HAMBURGUESAS', 'CALDOS', 'CARNES', 'DESAYUNOS', 'ALMUERZOS', 'EXTRAS', 'GUARNICIONES', 'MENU INFANTIL', 'SOPAS', 'PLATOS FUERTES', 'GUARNICIONES CALIENTES', 'TACOS', 'REFACCIONES'],
  'CEVICHERIA': ['CEVICHES', 'COCTELES', 'CRUDOS', 'MARISCOS', 'ENTRADAS', 'AGUACHILES', 'TOSTADAS', 'ENTRADAS FRIAS', 'TIKAS', 'CEVICHE TIPO COCTEL (SALSA DULCE)'],
  'BARRA': ['BEBIDAS', 'CERVEZAS', 'SODAS', 'LICUADOS', 'CAFÉ', 'COCTELERIA', 'BEBIDAS CALIENTES', 'JUGOS', 'MICHELADAS', 'LICORES', 'VINOS', 'TRAGOS', 'AGUA PURA'],
  'BEBIDAS': ['BEBIDAS', 'CERVEZAS', 'SODAS', 'LICUADOS', 'CAFÉ', 'COCTELERIA', 'BEBIDAS CALIENTES', 'JUGOS', 'MICHELADAS', 'LICORES', 'VINOS', 'TRAGOS', 'AGUA PURA', 'LICUADO'],
  'POSTRES': ['POSTRES', 'HELADOS', 'PASTELES', 'MILKSHAKES']
};

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
  const [filter, setFilter] = useState<'all' | 'pending' | 'ready' | 'delivered'>('all');
  const [kitchenStations, setKitchenStations] = useState<KitchenStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<string | null>(localStorage.getItem('current_kds_station'));
  const [selectedOrder, setSelectedOrder] = useState<KDSOrder | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // SERVER SYNC LOGIC with Persistence
  const [serverOffset, setServerOffset] = useState<number>(() => {
    const cached = localStorage.getItem('kds_server_offset');
    return cached ? parseInt(cached, 10) : 0;
  });

  // Helper for parsing Postgres timestamps correctly as UTC if zone is missing
  const safeParseDate = (d: string | null | undefined) => {
    if (!d) return 0;
    const normalized = d.includes('T') ? d : d.replace(' ', 'T');
    const val = new Date(normalized).getTime();
    if (isNaN(val)) return 0;
    return val;
  };

  // Add a simple 1s ticker to force re-renders for all time-based elements
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const syncTime = async () => {
    try {
      console.log('⏳ KDS: Synchronizing clock...');
      // Fallback timeout promise (10s)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sync timeout')), 10000)
      );

      const fetchPromise = (async () => {
        const { data, error } = await supabase.rpc('get_server_time');
        if (error) throw error;
        return data;
      })();

      // Race: RPC vs Timeout
      const data = await Promise.race([fetchPromise, timeoutPromise]) as string;

      if (data) {
        const serverTime = new Date(data).getTime();
        const clientTime = Date.now();
        const offset = serverTime - clientTime;

        console.log(`✅ KDS: Clock Synced. ServerMs=${serverTime}, ClientMs=${clientTime}, Offset=${offset}ms`);
        setServerOffset(offset);
        localStorage.setItem('kds_server_offset', offset.toString());
        console.log('✅ KDS: Time Synced:', { server: data, client: new Date().toISOString(), offset });
      }
    } catch (err) {
      console.warn('⚠️ KDS: Sync failed. Retrying in background...', err);
      // Keep previous offset if exists, or 0.
    }
  };

  useEffect(() => {
    syncTime();

    // Re-sync every minute to prevent drift
    const interval = setInterval(syncTime, 60000);
    return () => clearInterval(interval);
  }, []);



  const ordersPerPage = 5;

  // Filter orders based on selected station
  // Filter orders based on selected station AND status
  const filteredOrders = React.useMemo(() => {
    let result = orders;

    // 1. Station Context Filtering
    const belongsToContext = (item: KDSItem) => {
      // If no station selected, everything is relevant (General View)
      if (!selectedStation) return true;

      const currentStationName = localStorage.getItem('current_kds_station_name')?.toUpperCase();

      // 1. Step 1: Check Category Map logic
      if (currentStationName && STATION_CATEGORY_MAP[currentStationName]) {
        const itemCategory = item.category_name?.toUpperCase();
        const allowedCategories = STATION_CATEGORY_MAP[currentStationName];

        if (itemCategory && allowedCategories.some(cat => itemCategory.includes(cat))) {
          return true;
        }
      }

      // 2. Step 2: Fallback to ID Logic (matches if explicitly assigned OR if item has NO station)
      const effectiveStationId = item.kitchen_station_id;
      return String(effectiveStationId) === String(selectedStation) || !effectiveStationId;
    };

    // Filter down to orders relevant to this station
    if (selectedStation) {
      result = result.filter(order => order.items.some(belongsToContext));
    }

    // 2. Status Filtering (Active vs History)
    // "Delivered" means ALL items relevant to this station are delivered.
    // "Active" means AT LEAST ONE item relevant to this station is NOT delivered.

    if (filter === 'delivered') {
      // Show orders where ALL relevant items are delivered
      result = result.filter(order => {
        const stationItems = order.items.filter(belongsToContext);
        return stationItems.length > 0 && stationItems.every(i => i.status === 'delivered');
      });
    } else {
      // DEFAULT: Show orders where AT LEAST ONE relevant item is NOT finished
      // (Pending, Preparing, Ready) -> Active
      result = result.filter(order => {
        const stationItems = order.items.filter(belongsToContext);
        // Keep order visible if there is work to do for this station
        return stationItems.some(i => i.status !== 'delivered');
      });
    }

    return result;
  }, [orders, selectedStation, filter]);

  // --- STABILIZE BATCHES (Fixes Timer Jitters) ---
  const processedBatches = React.useMemo(() => {
    return filteredOrders.map(order => {
      // Logic for status filtering inside the batch
      const currentStationName = localStorage.getItem('current_kds_station_name')?.toUpperCase();
      const belongsToContext = (item: KDSItem) => {
        if (!selectedStation) return true;

        // Step 1: Try category map first
        if (currentStationName && STATION_CATEGORY_MAP[currentStationName]) {
          const itemCategory = item.category_name?.toUpperCase();
          const allowedCategories = STATION_CATEGORY_MAP[currentStationName];
          if (itemCategory && allowedCategories.some(cat => itemCategory.includes(cat))) {
            return true;
          }
        }

        // Step 2: Fallback to explicit kitchen_station_id match OR item has no station assigned
        return String(item.kitchen_station_id) === String(selectedStation) || !item.kitchen_station_id;
      };

      const stationItems = order.items.filter(belongsToContext);

      const truePrepStart = stationItems
        .filter(i => i.preparing_at && i.status !== 'pending')
        .map(i => safeParseDate(i.preparing_at))
        .sort((a, b) => a - b)[0];

      const truePrepStartISO = truePrepStart ? new Date(truePrepStart).toISOString() : undefined;

      const earliestCreatedAt = stationItems.length > 0
        ? stationItems.map(i => safeParseDate(i.created_at || order.created_at)).sort((a, b) => a - b)[0]
        : safeParseDate(order.created_at);

      const ticketStartTime = new Date(earliestCreatedAt).toISOString();

      const latestReadyAt = stationItems
        .filter(i => i.ready_at)
        .map(i => safeParseDate(i.ready_at!))
        .sort((a, b) => b - a)[0];

      const stationReadyAt = (stationItems.length > 0 && stationItems.every(i => i.status === 'ready' || i.status === 'delivered'))
        ? (latestReadyAt ? new Date(latestReadyAt).toISOString() : new Date().toISOString())
        : undefined;

      return {
        ...order,
        ticketStartTime,
        truePrepStartISO,
        stationReadyAt,
        stationItems // useful for rendering
      };
    });
  }, [filteredOrders, selectedStation, serverOffset]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [selectedStation, filter]);

  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
  }, []);

  // Update clock every second for the detailed modal and real-time feel
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [soundSettings, setSoundSettings] = useState<{
    defaultSoundId: string | null;
    enabled: boolean;
    volume: number;
    voiceVolume: number;
    voicePhrase: string;
  }>({ defaultSoundId: null, enabled: true, volume: 0.8, voiceVolume: 1.0, voicePhrase: 'Nueva orden en cocina' });
  const [soundLibrary, setSoundLibrary] = useState<Record<string, string>>({});
  const soundCache = useRef<Record<string, HTMLAudioElement>>({});

  // Helper to normalize Supabase Storage URLs - REMOVED (using central util)
  const previousOrderCountRef = useRef<number>(0);
  const lastNewOrderSpeakTimeRef = useRef<number>(0);
  const isFetchingRef = useRef(false);

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
        .select('kds_default_sound_id, kds_alert_enabled, kds_alert_volume, kds_voice_volume, kds_voice_phrase')
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
          volume: settingsData.kds_alert_volume ? parseFloat(settingsData.kds_alert_volume) : 0.8,
          voiceVolume: settingsData.kds_voice_volume ? parseFloat(settingsData.kds_voice_volume) : 1.0,
          voicePhrase: settingsData.kds_voice_phrase || 'Nueva orden en cocina'
        });
      }

      const { data: libraryData, error: libError } = await supabase
        .from('sound_library')
        .select('id, file_url')
        .eq('is_active', true);

      if (libError) console.error('KDS: Error fetching sound library:', libError);
      if (libraryData) {
        const lib: Record<string, string> = {};
        libraryData.forEach(s => {
          const secureUrl = getSecureSoundUrl(s.file_url);
          lib[s.id] = secureUrl;

          // Preload sounds!
          if (!soundCache.current[s.id]) {
            const audio = new Audio(secureUrl);
            audio.preload = 'auto';
            audio.load();
            soundCache.current[s.id] = audio;
            console.log(`KDS: Preloaded sound ${s.id} from ${secureUrl}`);
          }
        });
        setSoundLibrary(lib);
      }
    } catch (e) {
      console.error('KDS: Error in fetchSoundSettings:', e);
    }
  }, [getSecureSoundUrl]);

  const fetchKDSData = React.useCallback(async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!silent) setLoading(true);
    try {
      console.log('KDS: START Fetch Order Data. Station Filter:', selectedStation, 'Filter:', filter);

      // 1. Fetch Orders
      let ordersQuery = supabase
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
        `);

      if (filter === 'delivered') {
        ordersQuery = ordersQuery
          .in('status', ['pending', 'preparing', 'ready', 'delivered', 'completed'])
          .order('updated_at', { ascending: false })
          .limit(200);
      } else {
        ordersQuery = ordersQuery
          .in('status', ['pending', 'preparing', 'ready'])
          .order('created_at', { ascending: true });
      }

      // Branch isolation (Only filter if we have a valid UUID branch)
      const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (cachedUser?.branch_id && cachedUser.branch_id !== 'null' && cachedUser.branch_id !== '') {
        ordersQuery = ordersQuery.eq('branch_id', cachedUser.branch_id);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;

      if (ordersError) {
        console.error('KDS: Supabase Orders Error:', ordersError);
        return;
      }

      console.log(`KDS: Fetched ${ordersData?.length || 0} active orders from branch ${cachedUser?.branch_id || 'ALL'}`);

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      const orderIds = ordersData.map(o => o.id);

      // 2. Fetch Order Items with DETERMINISTIC SORT
      const { data: allOrderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          products:products(name, kitchen_station_id, categories(name))
        `)
        .in('order_id', orderIds)
        .order('created_at', { ascending: true }); // Important for stable Batch IDs

      if (itemsError) {
        console.error('KDS: Error fetching items:', itemsError);
      }

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

      // 4. Group items by order_id AND fuzzy created_at (time window)
      const itemGroups: Record<string, any[]> = {};

      (allOrderItems || []).forEach(item => {
        // REMOVED Item status filtering here! 
        // We need all items of a batch to correctly determine if the batch is "active" or "history"
        // in the useMemo. Filtering here caused flickering when items moved statuses.

        const itemTime = safeParseDate(item.created_at);
        let foundKey = Object.keys(itemGroups).find(key => {
          if (!key.startsWith(item.order_id)) return false;
          const parts = key.split('_');
          const groupTimeStr = parts.slice(1).join('_');
          const groupTime = new Date(groupTimeStr).getTime();
          return Math.abs(groupTime - itemTime) < 10000;
        });

        if (foundKey) {
          if (!itemGroups[foundKey].some(existing => existing.id === item.id)) {
            itemGroups[foundKey].push(item);
          }
        } else {
          const newKey = `${item.order_id}_${item.created_at}`;
          itemGroups[newKey] = [item];
        }
      });

      // 5. Map groups to KDSOrder objects
      const formattedOrders: KDSOrder[] = Object.entries(itemGroups).map(([groupKey, items]) => {
        const orderId = items[0].order_id;
        const ord = ordersData.find(o => o.id === orderId);
        if (!ord) return null;

        // Apply station filter
        const filteredItems = selectedStation
          ? items.filter(item => {
            const stationId = item.products?.kitchen_station_id;
            const itemCategory = item.products?.categories?.name?.toUpperCase();
            const currentStationName = localStorage.getItem('current_kds_station_name')?.toUpperCase();

            // 1. Check Category Map first
            if (currentStationName && STATION_CATEGORY_MAP[currentStationName]) {
              const allowedCategories = STATION_CATEGORY_MAP[currentStationName];
              if (itemCategory && allowedCategories.some(cat => itemCategory.includes(cat))) {
                return true;
              }
            }

            // 2. Check explicit ID match or Global Fallback (items with NO station show everywhere)
            return String(stationId) === String(selectedStation) || !stationId;
          })
          : items;

        if (filteredItems.length === 0) return null;
        const tableData = Array.isArray(ord.tables) ? ord.tables[0] : ord.tables;

        return {
          id: groupKey,
          original_order_id: ord.id,
          table_number: tableData?.number?.toString() || (ord.order_type === 'DELIVERY' ? 'DOM' : 'LLEVAR'),
          section: tableData?.section || ord.customer_name || 'GENERAL',
          waiter_name: profilesMap[ord.waiter_id] || 'Mesero',
          created_at: items[0].created_at,
          order_number: ord.order_number,
          items: filteredItems.map((oi: any) => ({
            id: oi.id,
            product_name: oi.products?.name || 'Producto Sin Nombre',
            quantity: oi.quantity || 1,
            notes: oi.notes,
            status: oi.status || 'pending',
            kitchen_station_id: oi.products?.kitchen_station_id || oi.kitchen_station_id,
            category_name: oi.products?.categories?.name,
            preparing_at: oi.preparing_at,
            ready_at: oi.ready_at
          }))
        };
      }).filter(Boolean) as KDSOrder[];

      formattedOrders.sort((a, b) => safeParseDate(a.created_at) - safeParseDate(b.created_at));
      setOrders(formattedOrders);
    } catch (e) {
      console.error('KDS: Unexpected error in fetchKDSData:', e);
    } finally {
      isFetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  }, [selectedStation, filter]);

  useEffect(() => {
    console.log('KDS: Initial initialization');
    fetchKitchenStations();
    fetchSoundSettings();
    fetchKDSData();
  }, [fetchKitchenStations, fetchSoundSettings, fetchKDSData]);

  useEffect(() => {
    console.log('KDS: Establishing Real-time Subscription...');
    const channel = supabase
      .channel(`kds_v3_${selectedStation || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, async (payload) => {
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
        if (status === 'SUBSCRIBED') {
          // Force fetch on connect to ensure we are up to date
          fetchKDSData(true);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`KDS: Channel Disconnected (${status}). Attempting refresh in 5s...`);
          setTimeout(() => fetchKDSData(true), 5000);
        }
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

  // Polling Fallback (Back-up for Realtime)
  useEffect(() => {
    console.log('KDS: Starting safety polling interval');
    const interval = setInterval(() => {
      fetchKDSData(true);
    }, 15000); // 15s is balanced
    return () => clearInterval(interval);
  }, [fetchKDSData]);

  // ----------------------------------------------------------------------
  // LOCAL KDS BRIDGE LISTENER
  // Catch offline orders beamed locally via Electron WebSockets / HTTP
  // ----------------------------------------------------------------------
  useEffect(() => {
    const electron = (window as any).electronAPI || (window as any).electron;
    if (electron && electron.onLocalKdsOrder) {
      console.log('🛡️ Listening for Local KDS Bridge orders...');
      electron.onLocalKdsOrder((data: any) => {
        console.log("📲 ORDEN LOCAL RECIBIDA VIA KDS BRIDGE:", data);

        const orderTimestamp = data.createdAt || new Date().toISOString();
        const groupKey = `${data.orderId}_${orderTimestamp}`;

        const newOrder: KDSOrder = {
          id: groupKey,
          original_order_id: data.orderId,
          table_number: data.tableNumber?.toString() || 'LLEV/DOM',
          section: data.tableName || 'GENERAL',
          waiter_name: data.waiterName || 'Offline',
          created_at: orderTimestamp,
          order_number: data.orderNumber,
          items: (data.items || []).map((i: any) => ({
            id: i.id || generateUUID(),
            product_name: i.product_name || 'Desconocido',
            quantity: i.quantity || 1,
            notes: i.notes,
            status: 'pending' as const,
            kitchen_station_id: null, // Resolves via general fallback
            category_name: 'LOCAL', // Skip category filter for local emergency orders
            preparing_at: undefined,
            ready_at: undefined
          }))
        };

        setOrders(prev => {
          const existingOrderIndex = prev.findIndex(o => o.original_order_id === data.orderId);
          if (existingOrderIndex >= 0) {
            const copy = [...prev];
            const existing = copy[existingOrderIndex];
            const newItems = newOrder.items;

            newItems.forEach((ni: any) => {
              if (!existing.items.find(ei => ei.id === ni.id)) {
                existing.items.push(ni);
              }
            });
            return copy;
          }
          return [newOrder, ...prev];
        });
      });

      return () => {
        electron.offLocalKdsOrder();
      };
    }
  }, []);

  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Play sound when new orders arrive
  // Play sound when new orders arrive
  // Play sound when new orders arrive
  useEffect(() => {
    const playSound = async (soundId: string): Promise<HTMLAudioElement | null> => {
      const url = soundLibrary[soundId];
      if (!url) {
        console.warn('KDS: No URL found for sound ID:', soundId);
        return null;
      }

      let audioToPlay: HTMLAudioElement;

      // Use preloaded cache if available for instant play (0 latency)
      if (soundCache.current[soundId]) {
        // Clone node to allow overlapping sounds (e.g. multiple rapid orders) without cutting off
        // The clone shares the buffered data so it's fast
        audioToPlay = soundCache.current[soundId].cloneNode(true) as HTMLAudioElement;
        audioToPlay.volume = soundSettings.volume;
      } else {
        // Fallback if not preloaded
        console.warn('KDS: Sound not cached, creating new instance (latency possible)');
        audioToPlay = new Audio(url);
        audioToPlay.volume = soundSettings.volume;
      }

      try {
        await audioToPlay.play();
        console.log('KDS: Audio played successfully');
        if (!audioUnlocked) setAudioUnlocked(true);
        return audioToPlay;
      } catch (err: any) {
        console.error('KDS: Sound play error:', err);
        if (err.name === 'NotAllowedError') {
          console.warn('KDS: Audio blocked by browser policy. User interaction required.');
          setAudioUnlocked(false);
        }
        return null;
      }
    };

    // If new orders arrived and we're not just loading for the first time
    // If new orders arrived and we're not just loading for the first time
    if (orders.length > previousOrderCountRef.current && soundSettings.enabled && previousOrderCountRef.current > 0) {
      console.log('KDS: Order count increased. Checking for new arrivals...');

      const now = Date.now();
      // Only speak once per batch (10s throttle)
      const shouldSpeak = now - lastNewOrderSpeakTimeRef.current > 10000;

      // Filter for genuinely new orders created in the last 60 seconds (generous window to catch latency)
      // This prevents re-playing sounds for old orders that might just be appearing due to filter changes
      const recentOrders = orders.filter(o => {
        const orderTime = new Date(o.created_at).getTime();
        return (now - orderTime) < 60000;
      });

      if (recentOrders.length > 0) {
        if (shouldSpeak) lastNewOrderSpeakTimeRef.current = now;

        let soundPlayed = false;

        // Play sound for the most relevant new order
        // Sort by newest first to prioritize latest sound
        const newestOrder = recentOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (newestOrder) {
          // Find which station this belongs to
          const stationId = selectedStation || newestOrder.items[0]?.kitchen_station_id;
          const station = kitchenStations.find(ks => ks.id === stationId);
          const targetSoundId = station?.sound_id || soundSettings.defaultSoundId;

          if (targetSoundId) {
            console.log(`KDS: Playing sound for order #${newestOrder.order_number} (Station: ${station?.name || 'Default'})`);
            playSound(targetSoundId).then(audio => {
              if (audio) {
                soundPlayed = true;
                if (shouldSpeak) speakAfterAudio(audio, soundSettings.voicePhrase, soundSettings.voiceVolume);
              } else if (shouldSpeak) {
                speak(soundSettings.voicePhrase, soundSettings.voiceVolume);
              }
            });
          }
        }

        // Fallback: if no admin sound was configured/played, just speak directly
        if (!soundPlayed && shouldSpeak && !soundSettings.defaultSoundId) {
          console.log('KDS: No specific sound configured. Using voice fallback.');
          speak(soundSettings.voicePhrase, soundSettings.voiceVolume);
        }
      } else {
        console.log('KDS: New orders detected but they are older than 60s (likely history load). Skipping sound.');
      }
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
    // USE SYNCED SERVER TIME
    const now = DateUtils.toGuatemalaISO(new Date(Date.now() + serverOffset));
    const nowMs = Date.now() + serverOffset;

    // --- COOK DURATION CALCULATION ---
    // Find the item in local state to read preparing_at before the update
    let cookDurationSeconds: number | null = null;
    if (nextStatus === 'ready') {
      const allItems = orders.flatMap(o => o.items);
      const targetItem = allItems.find(i => i.id === itemId);
      if (targetItem?.preparing_at) {
        const prepMs = safeParseDate(targetItem.preparing_at);
        if (prepMs > 0) {
          cookDurationSeconds = Math.max(1, Math.floor((nowMs - prepMs) / 1000));
        }
      }
    }

    // 1. Actualización Optimista
    setOrders(prev => prev.map(order => ({
      ...order,
      items: order.items.map(item => item.id === itemId ? {
        ...item,
        status: nextStatus as any,
        preparing_at: nextStatus === 'preparing' ? now : item.preparing_at,
        ready_at: (nextStatus === 'ready' || nextStatus === 'delivered') ? now : item.ready_at,
        cook_duration_seconds: nextStatus === 'ready' && cookDurationSeconds !== null ? cookDurationSeconds : item.cook_duration_seconds
      } : item)
    })));

    // 2. Si el modal está abierto, también actualizamos de forma optimista
    setSelectedOrder(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map(item => item.id === itemId ? {
          ...item,
          status: nextStatus as any,
          preparing_at: nextStatus === 'preparing' ? now : item.preparing_at,
          ready_at: (nextStatus === 'ready' || nextStatus === 'delivered') ? now : item.ready_at,
          cook_duration_seconds: nextStatus === 'ready' && cookDurationSeconds !== null ? cookDurationSeconds : item.cook_duration_seconds
        } : item)
      };
    });

    // 3. Actualizar base de datos
    const updatePayload: any = {
      status: nextStatus,
      preparing_at: nextStatus === 'preparing' ? now : undefined,
      ready_at: (nextStatus === 'ready' || nextStatus === 'delivered') ? now : undefined,
    };
    // Only write cook duration when marking READY
    if (nextStatus === 'ready' && cookDurationSeconds !== null) {
      updatePayload.cook_duration_seconds = cookDurationSeconds;
    }

    const { error } = await supabase.from('order_items').update(updatePayload).eq('id', itemId);

    if (error) {
      console.error('KDS: Error updating status:', error);
      return;
    }

    // 4. Sincronizar estado de la ORDEN general (Para que el mesero vea "LISTO" en la grilla de mesas)
    const orderToRefresh = orders.find(o => o.items.some(i => i.id === itemId));
    if (orderToRefresh) {
      const { data: allItemsData } = await supabase.from('order_items').select('status').eq('order_id', orderToRefresh.original_order_id);
      if (allItemsData) {
        const allDone = allItemsData.every(i => i.status === 'ready' || i.status === 'delivered' || i.status === 'voided');
        const anyPreparing = allItemsData.some(i => i.status === 'preparing');
        let orderStatus = 'pending';
        if (allDone) orderStatus = 'ready';
        else if (anyPreparing) orderStatus = 'preparing';

        await supabase.from('orders').update({ status: orderStatus, requires_printing: false }).eq('id', orderToRefresh.original_order_id);
      }
    }

    fetchKDSData(true);
  };

  const getTimeDiff = (date: string) => {
    const nowServer = Date.now() + (Number(serverOffset) || 0);
    const itemTimeUTC = safeParseDate(date);
    const diff = nowServer - itemTimeUTC;
    const minutes = Math.floor(diff / 60000);
    return Math.max(0, minutes);
  };

  const formatTimeDiff = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getWaitColor = (minutes: number) => {
    if (minutes > 20) return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (minutes > 10) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  };

  const handleReprint = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    // Kitchen printing disabled — KDS is the source of truth
    alert('Impresión de cocina desactivada. Use el KDS.');
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-[#2d2e3d]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Sincronizando Cocina...</span>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#2d2e3d] overflow-hidden">
      {/* HEADER KDS */}
      <header className="p-8 border-b border-white/5 bg-[#2d2e3d] flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/20">
            <ChefHat size={32} className="text-indigo-400" />
          </div>
          <div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500/80 mb-1">Restaurante Las Palmas</span>
              <h1 className="text-4xl font-black tracking-tighter uppercase leading-none text-white/90">KDS</h1>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {filter === 'delivered' ? `${filteredOrders.length} Entregas Recientes` : `${filteredOrders.length} Comandas Activas`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          {/* PAGINATION CONTROLS */}
          {Math.ceil(filteredOrders.length / ordersPerPage) > 1 && (
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
                <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">{Math.ceil(filteredOrders.length / ordersPerPage)} TOTAL</span>
              </div>
              <button
                disabled={(currentPage + 1) * ordersPerPage >= filteredOrders.length}
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
              ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400'
              : 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-600/40 animate-pulse'
              }`}
          >
            {audioUnlocked ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {audioUnlocked ? 'Sonido Activado' : 'Activar Sonido'}
          </button>


          <div className="w-px h-8 bg-white/10 mx-2"></div>

          <div className="flex items-center gap-4 px-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">ÁREA:</span>
              <span className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
                {localStorage.getItem('current_kds_station_name') || 'VISTA GENERAL'}
              </span>
            </div>
          </div>

          <div className="w-px h-8 bg-white/20 mx-2"></div>

          <FilterButton
            label="HISTORIAL"
            active={filter === 'delivered'}
            onClick={() => setFilter(prev => prev === 'delivered' ? 'all' : 'delivered')}
            icon={History}
          />
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 h-full auto-rows-fr">
          {processedBatches
            .slice(currentPage * ordersPerPage, (currentPage + 1) * ordersPerPage)
            .map(order => (
              <div key={order.id} className="flex flex-col bg-[#16191f] rounded-[1.5rem] border border-white/10 shadow-2xl relative overflow-hidden group h-full">
                {/* CABECERA DE COMANDA */}
                <div className="p-3 border-b border-white/10 flex justify-between items-start transition-colors bg-white/[0.03]">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-lg font-black tracking-tighter uppercase flex items-center gap-2">
                        {order.order_number && (
                          <span className="text-indigo-400">
                            ORDEN #{order.order_number}
                          </span>
                        )}
                        <span className="text-white ml-2">
                          {order.table_number.length < 4 ? `MESA ${order.table_number}` : order.table_number}
                        </span>
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 truncate block w-40">{order.section} • {order.waiter_name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleReprint(e, order.original_order_id)}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-gray-500 transition-colors"
                      title="Re-imprimir Ticket"
                    >
                      <Printer size={12} />
                    </button>
                    <div className="p-2 bg-white/5 rounded-xl">
                      <Bell size={12} className={`${getTimeDiff(order.created_at) > 15 ? 'text-red-500 animate-bounce' : 'text-gray-600'}`} />
                    </div>
                  </div>
                </div>

                {/* TIMERS ROW */}
                <div className="grid grid-cols-2 border-b border-white/5 bg-black/40">
                  <div className="py-2 px-1 text-center border-r border-white/5 flex flex-col justify-center bg-black/40">
                    <span className="text-[8px] font-black text-white/50 uppercase tracking-widest mb-1.5">EN ESPERA</span>
                    <KitchenTimer
                      startDate={order.ticketStartTime}
                      endDate={order.truePrepStartISO || order.stationReadyAt}
                      warningThresholdMinutes={15}
                      serverOffset={serverOffset}
                      tick={tick}
                    />
                  </div>
                  <div className="py-1.5 px-1 text-center flex flex-col justify-center bg-black/40">
                    <span className="text-[7px] font-black text-white/50 uppercase tracking-widest mb-1.5">PREPARACIÓN</span>
                    {order.truePrepStartISO ? (
                      <KitchenTimer
                        startDate={order.truePrepStartISO}
                        endDate={order.stationReadyAt}
                        warningThresholdMinutes={15}
                        serverOffset={serverOffset}
                        tick={tick}
                      />
                    ) : (
                      <span className="text-[10px] font-black text-gray-600 tracking-widest">--:--</span>
                    )}
                  </div>
                </div>

                {/* LISTA DE ITEMS */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
                  {(order as any).stationItems.map((item: any) => (
                    <div key={item.id} className={`p-2.5 rounded-xl border transition-all ${item.status === 'ready' ? 'bg-white/5 border-white/20 opacity-90 shadow-inner shadow-black/20' :
                      item.status === 'preparing' ? 'bg-indigo-500/20 border-indigo-500/40' :
                        'bg-[#1e293b] border-white/10'
                      }`}>
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-tight leading-none text-white">{item.product_name}</span>
                            <span className="text-[12px] font-black text-white bg-black/20 px-2 py-0.5 rounded-md">x{item.quantity}</span>
                          </div>
                          {item.notes && (
                            <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              <div className="flex items-center gap-1.5 mb-1">
                                <AlertCircle size={10} className="text-amber-500 flex-shrink-0" />
                                <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Indicaciones:</span>
                              </div>
                              <p className="text-[11px] text-[#ff7675] font-bold uppercase leading-snug break-words">
                                "{item.notes}"
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {filter === 'delivered' ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); updateItemStatus(item.id, 'ready'); }}
                              className="px-2 py-1 bg-amber-500/10 text-amber-500/80 hover:bg-amber-500 hover:text-white rounded-lg text-[7px] font-black uppercase tracking-tighter flex items-center justify-center border border-amber-500/20 transition-all"
                            >
                              <ChevronLeft size={8} className="mr-1" /> RETORNAR
                            </button>
                          ) : (
                            <>
                              {item.status === 'pending' ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateItemStatus(item.id, 'preparing'); }}
                                  className="w-16 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[7px] font-black uppercase tracking-tighter flex items-center justify-center gap-1 border border-indigo-400/50 transition-all active:scale-95 shadow-lg shadow-indigo-900/30"
                                >
                                  <Play size={8} /> INICIAR
                                </button>
                              ) : item.status === 'preparing' ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateItemStatus(item.id, 'ready'); }}
                                  className="w-16 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[7px] font-black uppercase tracking-tighter flex items-center justify-center gap-1 border border-emerald-400/50 transition-all active:scale-95 shadow-lg shadow-emerald-900/30"
                                >
                                  <Check size={8} /> LISTO
                                </button>
                              ) : (
                                <div className="w-16 py-1 bg-white/10 text-white rounded-md text-[7px] font-black uppercase tracking-tighter flex items-center justify-center border border-white/20 shadow-sm">
                                  <CheckCircle2 size={8} className="mr-1 text-emerald-400" /> LISTO
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ACCIONES DE COMANDA COMPLETA - PER BATCH (Independent per ticket) */}
                <div className="border-t border-white/10"></div>
                <div className="mt-auto p-2.5 bg-black/20 flex gap-2">
                  {(() => {
                    // Use ONLY the items in THIS batch/ticket (pre-calculated stationItems)
                    const batchItems = (order as any).stationItems;
                    const allReady = batchItems.length > 0 && batchItems.every((i: any) => i.status === 'ready' || i.status === 'delivered');
                    const anyPending = batchItems.some((i: any) => i.status === 'pending');
                    const stationName = kitchenStations.find(s => s.id === selectedStation)?.name || 'COCINA';

                    // Get the IDs of items in THIS batch only
                    const batchItemIds = batchItems.map(i => i.id);

                    if (allReady && filter !== 'delivered') {
                      return (
                        <button
                          onClick={async () => {
                            const now = DateUtils.toGuatemalaISO(new Date(Date.now() + serverOffset));
                            const readyIds = batchItems.filter(i => i.status === 'ready').map(i => i.id);
                            if (readyIds.length === 0) return;

                            // Optimistic Update - only THIS batch
                            setOrders(prev => prev.map(o => o.id === order.id ? {
                              ...o, items: o.items.map(i =>
                                readyIds.includes(i.id) ? { ...i, status: 'delivered', ready_at: i.ready_at || now } : i
                              )
                            } : o));

                            // Direct update by item IDs (NOT by order_id)
                            const { error } = await supabase
                              .from('order_items')
                              .update({ status: 'delivered', ready_at: now })
                              .in('id', readyIds);

                            if (error) console.error("Error batch delivering:", error);
                            fetchKDSData(true);
                          }}
                          className="w-full py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-indigo-900/10"
                        >
                          <CheckCircle2 size={12} /> ENTREGAR
                        </button>
                      );
                    }


                    return (
                      <button
                        onClick={async () => {
                          const now = DateUtils.toGuatemalaISO(new Date(Date.now() + serverOffset));
                          const activeIds = batchItems.filter(i => i.status === 'preparing' || i.status === 'pending').map(i => i.id);
                          if (activeIds.length === 0) return;

                          // Optimistic Update - only THIS batch
                          setOrders(prev => prev.map(o => o.id === order.id ? {
                            ...o, items: o.items.map(i =>
                              activeIds.includes(i.id) ? { ...i, status: 'ready', ready_at: now } : i
                            )
                          } : o));

                          // Direct update by item IDs (NOT by order_id)
                          const { error } = await supabase
                            .from('order_items')
                            .update({ status: 'ready', ready_at: now })
                            .in('id', activeIds);

                          if (error) console.error("Error batch completing:", error);

                          // 3. Sincronizar estado de la ORDEN general
                          const { data: allItems } = await supabase.from('order_items').select('status').eq('order_id', order.original_order_id);
                          if (allItems) {
                            const allDone = allItems.every(i => i.status === 'ready' || i.status === 'delivered' || i.status === 'voided');
                            if (allDone) {
                              await supabase.from('orders').update({ status: 'ready', requires_printing: false }).eq('id', order.original_order_id);
                            }
                          }

                          fetchKDSData(true);
                        }}
                        className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-lg font-black text-[8px] uppercase tracking-[0.2em] border border-indigo-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Flame size={12} className="animate-pulse" /> SERVIR
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}

          {/* EMPTY CARDS TO MAINTAIN GRID SHAPE */}
          {Array.from({ length: Math.max(0, ordersPerPage - (filteredOrders.slice(currentPage * ordersPerPage, (currentPage + 1) * ordersPerPage).length)) }).map((_, i) => (
            <div key={`empty-${i}`} className="h-full border border-white/[0.02] rounded-[1.5rem] bg-white/[0.01] flex items-center justify-center">
              {filteredOrders.length === 0 && i === 2 && (
                <div className="flex flex-col items-center opacity-5">
                  <ChefHat size={40} className="mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-center">Sin Pedidos</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* MODAL DE DETALLE EXPANDIDO */}
      {
        selectedOrder && (
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
                          const now = currentTime.getTime() + serverOffset;
                          const waitEnd = prepStart ? safeParseDate(prepStart) : now;
                          const waitSeconds = Math.max(0, Math.floor((waitEnd - safeParseDate(selectedOrder.created_at)) / 1000));
                          const prepSeconds = prepStart ? Math.max(0, Math.floor((now - safeParseDate(prepStart)) / 1000)) : 0;

                          return (
                            <>
                              <div className={`px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${getWaitColor(Math.floor(waitSeconds / 60))}`}>
                                <Clock size={12} /> ESPERA: {formatTimeDiff(waitSeconds)}
                              </div>
                              {prepSeconds > 0 && (
                                <div className="px-2 py-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                  <Flame size={12} className="animate-pulse" /> PREP: {formatTimeDiff(prepSeconds)}
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
                  <div key={item.id} className={`p-6 rounded-[2rem] border transition-all ${item.status === 'ready' ? 'bg-white/5 border-white/20 opacity-40' :
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
                            <Play size={14} /> EMPEZAR
                          </button>
                        )}
                        {item.status === 'preparing' && (
                          <button
                            onClick={() => updateItemStatus(item.id, 'ready')}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all flex items-center gap-3"
                          >
                            <Check size={18} /> SERVIR
                          </button>
                        )}
                        {item.status === 'ready' && (
                          <div className="flex items-center gap-3 px-8 py-4 bg-white/10 text-white rounded-2xl border border-white/20 font-black uppercase text-xs tracking-widest">
                            <CheckCircle2 size={24} className="text-indigo-400" /> LISTO
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-8 bg-black/40 border-t border-white/5">
                <button
                  disabled={!selectedOrder.items.every(i => i.status === 'ready')}
                  onClick={async () => {
                    const itemIds = selectedOrder.items.filter(i => i.status === 'ready').map(i => i.id);
                    if (itemIds.length === 0) return;
                    const nowServer = DateUtils.toGuatemalaISO(new Date(Date.now() + serverOffset));
                    await supabase.from('order_items').update({ status: 'delivered', ready_at: nowServer }).in('id', itemIds);
                    fetchKDSData();
                    setSelectedOrder(null);
                  }}
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 disabled:grayscale text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-4"
                >
                  <CheckCircle2 size={24} /> ENTREGAR COMANDA COMPLETA
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

const FilterButton = ({ label, active, onClick, icon: Icon }: { label: string, active: boolean, onClick: () => void, icon?: any }) => (
  <button
    onClick={onClick}
    className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${active
      ? 'bg-indigo-500/30 border-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] scale-105'
      : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
      }`}
  >
    {Icon && <Icon size={14} className={active ? 'text-indigo-400' : 'text-gray-500'} />}
    {label}
  </button>
);

const ActionButton = ({ icon, color, onClick }: { icon: any, color: 'indigo' | 'emerald', onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 ${color === 'indigo'
      ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/30'
      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/30'
      } border border-white/5 opacity-80 hover:opacity-100`}
  >
    {icon}
  </button>
);
