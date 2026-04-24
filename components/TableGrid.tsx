import React, { useState } from 'react';
import { Table } from '../types';
import { Users, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';

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
  const [now, setNow] = useState(Date.now());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

        fetchedOrders?.forEach(o => {
          if (o.table_id) {
            if (textUser?.role === 'MESERO' && o.waiter_id && o.waiter_id !== textUser.id) {
              return;
            }
            if (!map[o.table_id]) map[o.table_id] = o.created_at;
            ordersMap[o.table_id] = o;
          }
        });

        setOccupancyTimes(map);
        setActiveOrders(ordersMap);

      } catch (err) {
        console.error('FetchData Error:', err);
      }
      setLoading(false);
    };

    fetchData();

    const channel = supabase.channel('table-grid-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .subscribe();

    return () => {
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
    const isOccupied = t.status === 'occupied' || !!activeOrders[t.id];

    if (isOccupied) {
      onSelectTable(t, 1);
    }
    else {
      // 3. IMMEDIATE LOCK: Take the table before even choosing pax
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
    }
  };

  return (
    <>
      <div className="h-full flex flex-col p-8 animate-fade-in relative z-10 bg-[#2d2e3d]">
        {/* Tab Navigation */}
        <div className="flex gap-4 mb-10 overflow-x-auto pb-4 no-scrollbar areas-container">
          {sections.map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-10 py-5 lg:px-8 lg:py-4 rounded-2xl font-black text-sm lg:text-xs tracking-[0.2em] uppercase transition-all border area-button ${activeSection === s ? 'bg-indigo-600 border-indigo-500 shadow-xl shadow-indigo-500/20' : 'bg-[#3a3b4d] border-white/5 text-gray-400'
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
              <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <div className={`p-8 rounded-full mb-6 ${!isOnline ? 'bg-rose-500/10' : 'bg-white/5'}`}>
                {!isOnline ? <Loader2 size={64} className="text-rose-500" /> : <Users size={64} className="opacity-50" />}
              </div>
              <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-6 mesas-grid">
            {filtered.map(t => {
              const access = checkAccess(t);
              // Calculate effective status based on live orders too
              const isOccupied = t.status === 'occupied' || !!activeOrders[t.id];

              return (
                <button
                  key={t.id}
                  onClick={() => handleClick(t)}
                  disabled={!access.allowed && (isOccupied || (t.locked_by && !access.allowed))}
                  className={`relative h-60 lg:h-52 rounded-[2rem] bg-[#3a3b4d] p-6 flex flex-col items-center justify-center transition-all active:scale-95 group shadow-2xl border border-white/5 mesa-card ${(!access.allowed && (isOccupied || t.locked_by)) ? '!cursor-not-allowed opacity-50 grayscale hover:bg-[#3a3b4d]' : ''}`}
                >
                  {(!access.allowed && (isOccupied || t.locked_by)) && (
                    <div className="absolute top-4 right-4 text-rose-500 animate-pulse">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </div>
                  )}
                  <span className="text-6xl lg:text-5xl font-black text-white mb-1 tracking-tighter">{t.number}</span>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
                    {isOccupied ? 'Ocupada' : t.locked_by ? 'Reservada' : 'Disponible'}
                  </span>
                  <div className={`w-2.5 h-2.5 rounded-full ${isOccupied ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : t.locked_by ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                    }`} />
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
            <h3 className="text-center text-[10px] font-black text-indigo-400 tracking-[0.4em] uppercase mb-2">Mesa {showCounter.number}</h3>
            <h4 className="text-center text-lg font-black mb-8 tracking-tight text-white">CANTIDAD PERSONAS</h4>

            <div className="flex items-center justify-center gap-6 mb-8">
              <button onClick={() => setPax(p => Math.max(1, p - 1))} className="w-14 h-14 rounded-2xl bg-[#3a3b4d] border border-white/5 flex items-center justify-center text-xl transition-all active:scale-95 text-white shadow-lg">-</button>
              <span className="text-6xl font-black tabular-nums text-white w-24 text-center tracking-tighter shadow-black drop-shadow-lg">{pax}</span>
              <button onClick={() => setPax(p => p + 1)} className="w-14 h-14 rounded-2xl bg-[#3a3b4d] border border-white/5 flex items-center justify-center text-xl transition-all active:scale-95 text-white shadow-lg">+</button>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowCounter(null)} className="flex-1 py-4 bg-[#3a3b4d] border border-white/5 rounded-xl font-black uppercase tracking-widest text-[10px] text-white transition-all">Cancelar</button>
              <button onClick={() => { onSelectTable(showCounter, pax); setShowCounter(null); }} className="flex-[1.5] py-3 bg-indigo-600 rounded-xl font-black uppercase tracking-widest text-[10px] text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
