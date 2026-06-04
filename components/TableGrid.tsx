import React, { useState } from 'react';
import { Table } from '../types';
import { Users, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { PinModalV2 } from './PinModalV2';

interface TableGridProps {
  onSelectTable: (table: Table) => void;
}

export const TableGrid: React.FC<TableGridProps> = ({ onSelectTable }) => {
  const [sections, setSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState('');
  const [showCounter, setShowCounter] = useState<Table | null>(null);
  const [pax, setPax] = useState(1);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const [occupancyTimes, setOccupancyTimes] = useState<Record<string, string>>({});
  const [activeOrders, setActiveOrders] = useState<Record<string, any>>({});
  const [offlineOccupied, setOfflineOccupied] = useState<Record<string, any>>({});
  const [now, setNow] = useState(Date.now());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [maxOrdersLimit, setMaxOrdersLimit] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingTable, setPendingTable] = useState<Table | null>(null);

  React.useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Update timer every minute
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const cachedUserStr = localStorage.getItem('currentUser');
      let textUser: any = null;
      try { textUser = JSON.parse(cachedUserStr || '{}'); } catch (e) { }

      try {
        const branchId = textUser?.branch_id;

        let fetchedTables: any[] = [];
        let fetchedSections: any[] = [];
        let fetchedOrders: any[] = [];

        // 1. ONLINE FETCH
        if (navigator.onLine) {
          try {
            let tablesQuery = supabase.from('tables').select('*, locked_by').order('number');
            if (branchId) tablesQuery = tablesQuery.eq('branch_id', branchId);

            let tablesRes = await tablesQuery;
            if (tablesRes.error) {
              console.warn('Branch filter might have failed, falling back...');
              let fallbackQuery = supabase.from('tables').select('*').order('number');
              if (branchId) fallbackQuery = fallbackQuery.eq('branch_id', branchId);
              tablesRes = await fallbackQuery;
            }
            if (!tablesRes.error && tablesRes.data) fetchedTables = tablesRes.data;

            let sectionsQuery = supabase.from('sections').select('*').order('priority', { ascending: true }).order('name');
            if (branchId) sectionsQuery = sectionsQuery.eq('branch_id', branchId);
            const sectionsRes = await sectionsQuery;
            if (!sectionsRes.error && sectionsRes.data) fetchedSections = sectionsRes.data;

            let ordersQuery = supabase.from('orders')
              .select('table_id, created_at, waiter_id, waiter:profiles!orders_waiter_id_fkey(name)')
              .in('status', ['pending', 'preparing', 'ready', 'served'])
              .order('created_at', { ascending: true });
            if (branchId) ordersQuery = ordersQuery.eq('branch_id', branchId);
            const ordersRes = await ordersQuery;
            if (!ordersRes.error && ordersRes.data) fetchedOrders = ordersRes.data;

          } catch (e) {
            console.warn("Online fetch failed, falling back to offline", e);
          }

          try {
            const { data: settings } = await supabase.from('system_settings').select('max_active_orders_per_waiter').eq('id', 1).single();
            if (settings?.max_active_orders_per_waiter) {
              setMaxOrdersLimit(settings.max_active_orders_per_waiter);
              localStorage.setItem('cached_max_orders', settings.max_active_orders_per_waiter.toString());
            }
          } catch (e) { }
        }

        // 2. OFFLINE FALLBACK
        if (fetchedTables.length === 0 || fetchedSections.length === 0) {
          const { masterDataDB } = await import('../services/MasterDataDB');
          fetchedTables = await masterDataDB.getAll('tables');
          fetchedSections = await masterDataDB.getAll('sections');

          const cachedOrdersStr = localStorage.getItem('cached_active_orders');
          if (cachedOrdersStr) {
            try {
              const map = JSON.parse(cachedOrdersStr);
              fetchedOrders = Object.values(map);
            } catch (e) { }
          }
          
          const cachedMaxOrders = localStorage.getItem('cached_max_orders');
          if (cachedMaxOrders) {
            setMaxOrdersLimit(parseInt(cachedMaxOrders) || 0);
          }
        }

        // Apply Branch Filters statically if offline
        if (branchId && !navigator.onLine) {
          fetchedTables = fetchedTables.filter(t => t.branch_id === branchId || !t.branch_id);
          fetchedSections = fetchedSections.filter(s => s.branch_id === branchId || !s.branch_id);
          fetchedOrders = fetchedOrders.filter(o => o.branch_id === branchId || !o.branch_id);
        }

        setTables(fetchedTables || []);

        let availableSections = fetchedSections || [];

        // Try to fetch waiter assignment safely if online (REMOVED - Tabla waiter_stations no existe)
        /*
        if (navigator.onLine && textUser?.role === 'MESERO') {
          try {
            const { data: assignRes } = await supabase.from('waiter_stations')
              .select('section_id')
              .eq('waiter_id', textUser?.id)
              .maybeSingle();

            if (assignRes?.section_id) {
              availableSections = availableSections.filter(s => s.id === assignRes.section_id);
            }
          } catch (e) { }
        }
        */

        const names = availableSections.map(s => s.name);
        setSections(names);
        if (names.length > 0 && (!activeSection || !names.includes(activeSection))) {
          setActiveSection(names[0]);
        }

        const map: Record<string, string> = {};
        const ordersMap: Record<string, any> = {};

        // Register ALL active orders regardless of waiter_id.
        // This ensures tables with orders from other waiters show as "Ocupada".
        // Access restriction (who can open) is handled exclusively by checkAccess().
        fetchedOrders?.forEach(o => {
          if (o.table_id) {
            if (!map[o.table_id]) map[o.table_id] = o.created_at;
            ordersMap[o.table_id] = o;
          }
        });

        setOccupancyTimes(map);
        setActiveOrders(ordersMap);

        // v1.7.0 - Leer mesas ocupadas localmente (guardadas offline)
        // FIX A3: TTL de 24h para evitar mesas fantasma permanentes
        try {
          const offlineTablesStr = localStorage.getItem('offline_occupied_tables');
          if (offlineTablesStr) {
            const offlineTables: Record<string, any> = JSON.parse(offlineTablesStr);
            const MAX_OFFLINE_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas
            const now24 = Date.now();
            const cleaned: Record<string, any> = {};

            for (const tableId in offlineTables) {
              const entry = offlineTables[tableId];
              const age = now24 - new Date(entry.created_at || 0).getTime();
              
              // Si estamos online y la mesa en base de datos ya está 'available', la limpiamos.
              const dbTable = fetchedTables?.find((t: any) => t.id === tableId);
              const isAvailableOnline = navigator.onLine && dbTable && dbTable.status === 'available';

              if (!ordersMap[tableId] && age < MAX_OFFLINE_AGE_MS && !isAvailableOnline) {
                cleaned[tableId] = entry;
              }
            }

            const removedCount = Object.keys(offlineTables).length - Object.keys(cleaned).length;
            if (removedCount > 0) {
              console.log(`🧹 TableGrid: Limpiadas ${removedCount} mesa(s) offline (sincronizadas o expiradas)`);
              localStorage.setItem('offline_occupied_tables', JSON.stringify(cleaned));
            }
            setOfflineOccupied(cleaned);
          } else {
            setOfflineOccupied({});
          }
        } catch (e) {
          setOfflineOccupied({});
        }

      } catch (err) {
        console.error('FetchData Error:', err);
      }
      setLoading(false);
    };

    fetchData();

    // FIX C3: Debounce 1.5s para agrupar cambios simultáneos (ej: orden + items = 2 eventos)
    // Sin debounce, una sola orden disparaba 3+ fetchData() en cascada
    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedFetch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchData, 1500);
    };

    const channel = supabase.channel('table-grid-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, debouncedFetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, debouncedFetch)
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const getOccupancyMinutes = (tableId: string) => {
    const startTime = occupancyTimes[tableId];
    if (!startTime) return 0;
    const start = new Date(startTime).getTime();
    return Math.floor((now - start) / 60000);
  };

  const filtered = tables.filter(t => t.section === activeSection);

  const checkAccess = (table: Table) => {
    const cachedUserStr = localStorage.getItem('currentUser');
    if (!cachedUserStr) return { allowed: true };

    try {
      const user = JSON.parse(cachedUserStr);
      // 1. Admins and Cashiers: ALWAYS ALLOW
      if (['ADMIN', 'CAJERO'].includes(user.role)) return { allowed: true };

      // 2. Waiters: STRICT CHECK
      if (user.role === 'MESERO') {
        // Case 1: Table is Occupied but Order Data is MISSING (Hidden by RLS or Sync Error)
        if (table.status === 'occupied' && !activeOrders[table.id]) {
          // AUTO-REPAIR: If we are here, nobody owns this table's order right now or it's a ghost lock.
          // We allow access so the waiter can "re-take" or fix it.
          return { allowed: true };
        }

        const activeOrder = activeOrders[table.id];

        // Case 2: Table has Order Data -> Check Ownership
        if (activeOrder && activeOrder.waiter_id && activeOrder.waiter_id !== user.id) {
          return {
            allowed: false,
            ownerName: activeOrder.waiter?.name || 'Otro Mesero'
          };
        }

        // Case 3: SOFT LOCK Check (Lazy Creation Support)
        // If table is NOT occupied but is LOCKED by someone else
        if (table.locked_by && table.locked_by !== user.id && table.status !== 'occupied') {
          return {
            allowed: false,
            ownerName: 'Temporalmente Abierta por otro Mesero'
          };
        }
      }
    } catch (e) { console.error(e); }

    return { allowed: true };
  };

  const handleClick = async (t: Table) => {
    // 1. ALWAYS check access first (respect soft locks and current orders)
    const access = checkAccess(t);
    if (!access.allowed) {
      alert(`⛔ ACCESO DENEGADO\n\nEsta mesa está siendo atendida por: ${access.ownerName}`);
      return;
    }

    // 2. Determine flow based on status
    const isOccupied = t.status === 'occupied' || !!activeOrders[t.id] || !!offlineOccupied[t.id];

    if (isOccupied) {
      onSelectTable(t, 1);
    }
    else {
      // 3. Check max active orders limit for NEW tables
      const cachedUserStr = localStorage.getItem('currentUser');
      if (cachedUserStr && maxOrdersLimit > 0) {
        const user = JSON.parse(cachedUserStr);
        // Only apply to CAJERO and MESERO
        if (user.role === 'CAJERO' || user.role === 'MESERO') {
          // Check tables that are occupied AND owned by this user
          const myOrdersCount = tables.filter(tbl => {
            const isOcc = tbl.status === 'occupied' || !!activeOrders[tbl.id] || !!offlineOccupied[tbl.id];
            if (!isOcc) return false;
            const ownerId = tbl.locked_by || activeOrders[tbl.id]?.waiter_id || offlineOccupied[tbl.id]?.locked_by;
            return ownerId === user.id;
          }).length;

          if (myOrdersCount >= maxOrdersLimit) {
            setPendingTable(t);
            setShowPinModal(true);
            return;
          }
        }
      }

      // 4. IMMEDIATE LOCK: Take the table before even choosing pax
      takeTableLockAndProceed(t);
    }
  };

  const takeTableLockAndProceed = async (t: Table) => {
    const cachedUserStr = localStorage.getItem('currentUser');
    if (cachedUserStr) {
      const user = JSON.parse(cachedUserStr);
      await supabase.from('tables').update({
        locked_by: user.id,
        locked_at: new Date().toISOString()
      }).eq('id', t.id);
    }

    setPax(1);
    setShowCounter(t);
  };

  const handleBypassLimit = (adminUser: any) => {
    setShowPinModal(false);
    if (pendingTable) {
      takeTableLockAndProceed(pendingTable);
      setPendingTable(null);
    }
  };

  return (
    <>
      <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8 animate-fade-in relative z-10 bg-[#2d2e3d]">
        {/* Tab Navigation */}
        <div className="flex flex-nowrap justify-start md:justify-center gap-2 sm:gap-3 lg:gap-4 mb-6 sm:mb-8 lg:mb-10 overflow-x-auto pb-4 no-scrollbar areas-container w-full">
          {sections.map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`w-auto min-w-[100px] sm:min-w-[110px] lg:min-w-[140px] max-w-[150px] sm:max-w-[140px] h-auto min-h-[55px] sm:min-h-[60px] lg:min-h-[65px] flex-shrink-0 flex items-center justify-center rounded-lg font-semibold text-[11px] sm:text-[11px] lg:text-[12px] tracking-wider uppercase transition-all border px-3 py-2 text-center leading-snug whitespace-normal break-words area-button ${
                activeSection === s
                  ? 'bg-[#6366f1] text-white border-[#6366f1] shadow-xl'
                  : 'bg-white border-white/10 text-black shadow-sm hover:bg-gray-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Grid */}
        {/* Grid State Handling */}
        {tables.length === 0 ? (
          loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-white/20" size={48} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <div className={`p-8 rounded-full mb-6 ${!isOnline ? 'bg-rose-500/10' : 'bg-white/5'}`}>
                {!isOnline ? <Loader2 size={64} className="text-rose-500" /> : <Users size={64} className="opacity-50" />}
              </div>
              <h3 className="text-2xl font-semibold text-white mb-2 uppercase tracking-wide">
                {!isOnline ? 'SIN CONEXIÓN' : 'Sin Configuración'}
              </h3>
              <p className="text-sm text-center max-w-md text-gray-400 mb-8 leading-relaxed">
                {!navigator.onLine
                  ? "Modo Offline Activo. No se encontraron datos maestros cacheados o hubo un error."
                  : "No se han encontrado mesas configuradas en el sistema."}
              </p>
            </div>
          )
        ) : (
          <div className="flex flex-wrap justify-center content-start gap-4 sm:gap-6 lg:gap-8 w-full max-w-7xl mx-auto mt-2 pb-10">
            {filtered.map(t => {
              const access = checkAccess(t);
              // Calculate effective status based on live orders AND offline-saved orders
              const isOccupied = t.status === 'occupied' || !!activeOrders[t.id] || !!offlineOccupied[t.id];
              const isOfflineOnly = !activeOrders[t.id] && !!offlineOccupied[t.id]; // Offline but not yet synced

              return (
                <button
                  key={t.id}
                  onClick={() => handleClick(t)}
                  disabled={!access.allowed && (isOccupied || (t.locked_by && !access.allowed))}
                  className={`relative w-[130px] h-[105px] sm:w-[150px] sm:h-[115px] lg:w-[170px] lg:h-[125px] rounded-xl bg-[#3a3b4d] border border-white/10 flex flex-col items-center justify-between overflow-hidden active:scale-95 group shadow-lg transition-all ${(!access.allowed && (isOccupied || t.locked_by)) ? '!cursor-not-allowed opacity-50 grayscale' : ''}`}
                >
                  {(!access.allowed && (isOccupied || t.locked_by)) && (
                    <div className="absolute top-2 right-2 text-rose-500 animate-pulse">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </div>
                  )}
                  {/* Badge: Pendiente de sincronizar (Offline) */}
                  {isOfflineOnly && (
                    <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full px-1.5 py-0.5" title="Orden guardada sin internet - pendiente de sincronizar">
                      <span className="text-[7px] font-semibold text-amber-400 uppercase tracking-widest">Local</span>
                    </div>
                  )}
                  
                  <div className="flex-1 flex items-center justify-center w-full">
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white">{t.number}</span>
                  </div>

                  <div className="w-full h-[38%] border-t border-white/5 flex flex-col items-center justify-center gap-1.5 pb-1">
                    <span className="text-[11px] sm:text-[12px] font-semibold text-gray-300 capitalize tracking-wide text-center w-full truncate">
                      {isOccupied ? 'Ocupada' : t.locked_by ? 'Reservada' : 'Disponible'}
                    </span>
                    <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                      isOfflineOnly
                        ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse'
                        : isOccupied
                          ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                          : t.locked_by
                            ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse'
                            : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    }`} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Pax Modal */}
      {showCounter && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 animate-fade-in backdrop-blur-sm">
          <div className="w-full max-w-[320px] bg-[#2d2e3d] rounded-2xl p-6 border border-white/5 shadow-2xl relative z-[101]">
            <h3 className="text-center text-[10px] font-semibold text-white/40 tracking-[0.4em] uppercase mb-2">Mesa {showCounter.number}</h3>
            <h4 className="text-center text-lg font-semibold mb-8 tracking-tight text-white">CANTIDAD PERSONAS</h4>

            <div className="flex items-center justify-center gap-6 mb-8">
              <button onClick={() => setPax(p => Math.max(1, p - 1))} className="w-14 h-14 rounded-2xl bg-[#3a3b4d] border border-white/5 flex items-center justify-center text-xl transition-all active:scale-95 text-white shadow-lg">-</button>
              <span className="text-6xl font-semibold tabular-nums text-white w-24 text-center tracking-tighter shadow-black drop-shadow-lg">{pax}</span>
              <button onClick={() => setPax(p => p + 1)} className="w-14 h-14 rounded-2xl bg-[#3a3b4d] border border-white/5 flex items-center justify-center text-xl transition-all active:scale-95 text-white shadow-lg">+</button>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowCounter(null)} className="flex-1 py-4 bg-[#3a3b4d] border border-white/5 rounded-xl font-semibold uppercase tracking-widest text-[10px] text-white transition-all">Cancelar</button>
              <button onClick={() => { onSelectTable(showCounter, pax); setShowCounter(null); }} className="flex-[1.5] py-3 bg-white text-black rounded-xl font-semibold uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Override PIN Modal */}
      <PinModalV2
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPendingTable(null);
        }}
        onSuccess={handleBypassLimit}
        title="LÍMITE ALCANZADO"
        subtitle={`Límite de ${maxOrdersLimit} mesas activas superado. PIN de ADMIN requerido para anular.`}
        requiredRole={['ADMIN']}
      />
    </>
  );
};
