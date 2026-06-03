import React, { useState, useEffect } from 'react';
import { TrendingUp, Target, Award, ArrowUpRight, ArrowDownRight, BarChart, Zap, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { QIcon } from '../QIcon';

export const DashboardSales: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        grossSales: 0,
        avgTicket: 0,
        totalTips: 0,
        totalOrders: 0,
        growth: 0,
        history: [] as any[]
    });

    const fetchStats = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

            let query = supabase
                .from('orders')
                .select('*')
                .gte('created_at', startOfMonth.toISOString())
                .in('status', ['completed', 'finalizada', 'PAID', 'FINALIZADA', 'cerrada', 'CERRADA', 'closed']);

            if (cachedUser?.branch_id) query = query.eq('branch_id', cachedUser.branch_id);

            const { data: orders, error } = await query;

            if (error) throw error;

            if (orders && orders.length > 0) {
                const gross = orders.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
                const tips = orders.reduce((acc, curr) => acc + (Number(curr.tip_amount) || 0), 0);
                const count = orders.length;
                const avg = gross / count;

                // Simple history grouping by day
                const historyMap: Record<string, number> = {};
                orders.forEach(o => {
                    const day = new Date(o.created_at).getDate();
                    historyMap[day] = (historyMap[day] || 0) + Number(o.total);
                });

                const historyArray = Array.from({ length: 30 }, (_, i) => ({
                    day: i + 1,
                    total: historyMap[i + 1] || 0
                }));

                const maxSales = Math.max(...historyArray.map(h => h.total), 1);
                const normalizedHistory = historyArray.map(h => (h.total / maxSales) * 100);

                setStats({
                    grossSales: gross,
                    avgTicket: avg,
                    totalTips: tips,
                    totalOrders: count,
                    growth: 24, // Simulated growth
                    history: normalizedHistory
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (loading) return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
        </div>
    );

    return (
        <div className="p-4 md:p-8 animate-fade-in max-w-7xl mx-auto w-full h-full overflow-y-auto pb-24 md:pb-20">
            <div className="flex items-center justify-between mb-8 md:mb-12">
                <div className="flex-1"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-12">
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                    <SaleMetric label="Venta Bruta" value={`Q.${stats.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} trend="+15%" icon={QIcon} color="text-emerald-400" />
                    <SaleMetric label="Ticket Promedio" value={`Q.${stats.avgTicket.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} trend="+2%" icon={Target} color="text-indigo-400" />
                    <SaleMetric label="Propinas Acumuladas" value={`Q.${stats.totalTips.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} trend="+8%" icon={Award} color="text-amber-400" />
                    <SaleMetric label="Órdenes Totales" value={stats.totalOrders.toString()} trend="+12%" icon={Zap} color="text-rose-400" />
                </div>

                <div className="admin-card p-8 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 bg-indigo-50/30 flex flex-col justify-center items-center text-center shadow-sm">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-600 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center text-white mb-4 md:mb-6 shadow-xl shadow-indigo-600/20">
                        <TrendingUp size={32} className="md:w-10 md:h-10" />
                    </div>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-2 block">Progreso Objetivos</span>
                    <span className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-slate-800">{stats.growth}%</span>
                    <p className="text-[11px] md:text-xs text-slate-400 font-bold max-w-[200px] leading-relaxed">Rendimiento positivo detectado en el periodo actual.</p>
                </div>
            </div>

            <div className="admin-card p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-8 md:mb-10">
                    <h3 className="text-[9px] md:text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate-500">Rendimiento de Ventas Diarias (Mes Actual)</h3>
                </div>
                <div className="h-48 md:h-64 flex items-end gap-1 px-1 md:gap-1.5 md:px-4">
                    {stats.history.map((h, i) => (
                        <div key={i} className="flex-1 group relative h-full">
                            <div className="absolute inset-0 bg-slate-50 rounded-t-lg md:group-hover:bg-slate-100 transition-colors"></div>
                            <div
                                className="absolute bottom-0 left-0 right-0 bg-indigo-600/40 md:group-hover:bg-indigo-600 rounded-t-lg transition-all duration-700"
                                style={{ height: `${h}%` }}
                            ></div>
                            {/* Hover Tooltip (Desktop only) */}
                            <div className="hidden md:group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#106ebe] text-white text-[8px] px-2 py-1 rounded-md z-10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                Día {i + 1}: {h.toFixed(1)}%
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-4 px-2 md:px-4">
                    <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Día 1</span>
                    <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Día 15</span>
                    <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Día 30</span>
                </div>
            </div>
        </div>
    );
};

const SaleMetric = ({ label, value, trend, icon: Icon, color }: any) => (
    <div className="admin-card p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 relative group active:scale-[0.98] md:hover:border-indigo-200 md:hover:shadow-lg transition-all shadow-sm">
        <div className={`w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center ${color} mb-4 md:mb-6 md:group-hover:scale-110 transition-transform`}>
            <Icon size={20} className="md:w-6 md:h-6" />
        </div>
        <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</span>
        <span className="text-xl md:text-2xl font-black text-slate-800">{value}</span>
        <div className="mt-3 md:mt-4 flex items-center gap-1 text-[9px] md:text-[10px] font-black text-emerald-500 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
            <ArrowUpRight size={10} className="md:w-[12px]" /> {trend}
        </div>
    </div>
);
