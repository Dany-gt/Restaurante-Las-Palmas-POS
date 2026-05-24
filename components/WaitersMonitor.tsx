import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { User, ClipboardList, Package, Bike, Utensils } from 'lucide-react';

interface WaiterStats {
    id: string;
    name: string;
    dineInCount: number;
    takeoutCount: number;
    deliveryCount: number;
    totalOrders: number;
    tables: string[];
}

export const WaitersMonitor: React.FC = () => {
    const [stats, setStats] = useState<WaiterStats[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            // MÉTODO ULTRA-ROBUSTO: Consultas separadas para evitar fallos de JOIN

            // 1. Traer solo las órdenes activas
            const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const branchId = cachedUser?.branch_id;

            let query = supabase
                .from('orders')
                .select('id, waiter_id, order_type, table_id, status')
                .in('status', ['pending', 'preparing', 'ready']);

            if (branchId) query = query.eq('branch_id', branchId);

            const { data: orders, error: ordersError } = await query;

            if (ordersError) throw ordersError;
            if (!orders || orders.length === 0) {
                setStats([]);
                setLoading(false);
                return;
            }

            // 2. Identificar IDs únicos para mapeo
            const waiterIds = Array.from(new Set(orders.map(o => o.waiter_id).filter(Boolean)));
            const tableIds = Array.from(new Set(orders.map(o => o.table_id).filter(Boolean)));

            // 3. Traer perfiles y mesas en paralelo
            const [profilesRes, tablesRes] = await Promise.all([
                waiterIds.length > 0
                    ? supabase.from('profiles').select('id, name, full_name').in('id', waiterIds)
                    : Promise.resolve({ data: [] }),
                tableIds.length > 0
                    ? supabase.from('tables').select('id, number').in('id', tableIds)
                    : Promise.resolve({ data: [] })
            ]);

            // 4. Crear diccionarios de búsqueda (Mapas)
            const profileMap = new Map();
            profilesRes.data?.forEach(p => {
                profileMap.set(p.id, p.full_name || p.name || 'Sin Nombre');
            });

            const tableMap = new Map();
            tablesRes.data?.forEach(t => {
                tableMap.set(t.id, String(t.number));
            });

            // 5. Procesar y agrupar
            const waiterMap = new Map<string, WaiterStats>();

            orders.forEach(order => {
                const wId = order.waiter_id || 'unassigned';
                const wName = profileMap.get(wId) || (wId === 'unassigned' ? 'Sin Mesero' : `ID: ${String(wId).substring(0, 5)}`);

                if (!waiterMap.has(wId)) {
                    waiterMap.set(wId, {
                        id: wId,
                        name: wName,
                        dineInCount: 0,
                        takeoutCount: 0,
                        deliveryCount: 0,
                        totalOrders: 0,
                        tables: []
                    });
                }

                const stat = waiterMap.get(wId)!;
                stat.totalOrders++;

                if (order.order_type === 'DELIVERY') {
                    stat.deliveryCount++;
                } else if (order.order_type === 'TAKEOUT') {
                    stat.takeoutCount++;
                } else {
                    stat.dineInCount++;
                    const tableNum = tableMap.get(order.table_id);
                    if (tableNum && !stat.tables.includes(tableNum)) {
                        stat.tables.push(tableNum);
                    }
                }
            });

            setStats(Array.from(waiterMap.values()));
        } catch (err) {
            console.error('WaitersMonitor UltraFetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        fetchStats();

        const channel = supabase.channel('waiters_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                if (mounted) fetchStats();
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.warn('WaitersMonitor WebSocket Error - Falling back to polling');
                }
            });

        const interval = setInterval(fetchStats, 15000);

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse font-black text-[10px] tracking-widest uppercase">Sincronizando monitoreo...</div>;

    if (stats.length === 0) return (
        <div className="p-12 rounded-xl border border-white/5 bg-[#2a2d3a] text-center flex flex-col items-center justify-center gap-4 animate-fade-in">
            <User size={40} className="text-gray-700" />
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.4em]">Sin actividad activa</p>
        </div>
    );

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex items-center gap-3 px-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-500 animate-pulse" />
                <h3 className="text-xs font-black tracking-[0.5em] uppercase text-slate-400/80">Monitor de Servicio</h3>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {stats.map(waiter => (
                    <div key={waiter.id} className="group bg-[#2a2d3a] border border-white/5 rounded-xl p-6 flex flex-col gap-5 hover:border-slate-500/40 hover:bg-[#323544] transition-all duration-500 transform hover:-translate-y-1.5 shadow-md shadow-black/20">
                        <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                                <h4 className="font-black text-sm text-white truncate group-hover:text-slate-400 transition-colors uppercase tracking-tight leading-tight">
                                    {waiter.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-[9px] text-emerald-400/80 font-black uppercase tracking-[0.2em]">En Turno</span>
                                </div>
                            </div>
                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-xs font-black text-white border border-white/10 group-hover:bg-slate-500/20 transition-all">
                                {waiter.totalOrders}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5">
                            <div className="bg-white/5 rounded-lg p-4 border border-white/5 flex flex-col items-center gap-2 min-h-[110px]">
                                <Utensils size={24} className="text-gray-400" />
                                <span className="text-lg font-black text-white leading-none">{waiter.dineInCount}</span>
                                <div className="w-full text-center mt-1">
                                    <span className="text-[8px] font-black text-gray-400/50 uppercase tracking-widest block mb-1">Mesas</span>
                                    {waiter.tables.length > 0 && (
                                        <div className="text-[10px] font-black text-white/70 leading-tight break-words px-1">
                                            {waiter.tables.sort((a, b) => Number(a) - Number(b)).join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white/5 rounded-lg p-4 border border-white/5 flex flex-col items-center justify-center gap-2 min-h-[110px]">
                                <Package size={24} className="text-gray-400" />
                                <span className="text-lg font-black text-white leading-none">{waiter.takeoutCount}</span>
                                <span className="text-[8px] font-black text-gray-400/50 uppercase tracking-widest mt-1">Llevar</span>
                            </div>

                            <div className="bg-white/5 rounded-lg p-4 border border-white/5 flex flex-col items-center justify-center gap-2 min-h-[110px]">
                                <Bike size={24} className="text-gray-400" />
                                <span className="text-lg font-black text-white leading-none">{waiter.deliveryCount}</span>
                                <span className="text-[8px] font-black text-gray-400/50 uppercase tracking-widest mt-1">Domic</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
