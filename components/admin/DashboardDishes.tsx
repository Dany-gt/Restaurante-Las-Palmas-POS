import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import { BarChart, Bar as RechartsBar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Line, ComposedChart, Cell, PieChart, Pie, Legend } from 'recharts';
import { Calendar, Tag, ChevronRight, Download, UsersRound, Star, Search, Activity, Box, Filter, Clock, PieChart as PieChartIcon, Utensils } from 'lucide-react';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';

const ORDER_TYPE_LABELS: Record<string, string> = {
    'DINE_IN': 'Mesas',
    'TAKE_OUT': 'Para Llevar',
    'TAKEOUT': 'Para Llevar',
    'DELIVERY': 'Domicilio',
    'QUICK_SALE': 'Para Llevar'
};

const DAY_LABELS = ['0 DOMINGO', '1 LUNES', '2 MARTES', '3 MIÉRCOLES', '4 JUEVES', '5 VIERNES', '6 SÁBADO'];
const COLORS = ['#0d9488', '#0284c7', '#c2410c', '#6366f1', '#e11d48', '#d97706', '#0f766e', '#b91c1c'];

export const DashboardDishes: React.FC = () => {
    const getISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState(getISO(firstDay));
    const [endDate, setEndDate] = useState(getISO(today));
    const [startTime, setStartTime] = useState('00:00');
    const [endTime, setEndTime] = useState('23:59');

    const [branches, setBranches] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState('ALL');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // TABS: HORAS, PLATOS_Q, PLATOS_U, USUARIOS, MEJORES_USUARIOS, TABLA_GENERAL
    const [activeTab, setActiveTab] = useState('HORAS');
    const [rawItems, setRawItems] = useState<any[]>([]);

    const [allUsers, setAllUsers] = useState<string[]>([]);

    useEffect(() => {
        const load = async () => {
            const { data: bData } = await supabase.from('branches').select('id, name').order('name');
            if (bData) setBranches(bData);

            const { data: pData } = await supabase.from('profiles').select('name, role').in('role', ['admin', 'mesero', 'cajero', 'ADMIN', 'MESERO', 'CAJERO']);
            if (pData) setAllUsers(pData.map(p => (p.name || 'Sin nombre').toUpperCase()));
        };
        load();
    }, []);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const { data: raw, error } = await supabase.rpc('get_dishes_performance_report', {
                start_date: `${startDate} ${startTime}:00`,
                end_date: `${endDate} ${endTime}:59`,
                branch_uuid: selectedBranch === 'ALL' ? null : selectedBranch
            });

            if (error) throw error;

            const itemsMap: any[] = [];
            (raw || []).forEach((item: any) => {
                const oTypeRaw = item.order_type || 'DINE_IN';
                const dt = dayjs(item.order_created_at);
                const qty = Number(item.quantity || 0);
                const val = (Number(item.unit_price || 0) * qty) - Number(item.discount_amount || 0);

                itemsMap.push({
                    id: item.item_id,
                    orderNumber: (item.order_number && item.order_number.trim() !== '') ? item.order_number : (item.order_id?.split('-')[0] || 'S/N'),
                    createdAt: dt.format('DD/MM/YYYY hh:mm A'),
                    product: (item.product_name || 'Desconocido').toUpperCase(),
                    category: (item.category_name || 'Sin Categoría').toUpperCase(),
                    quantity: qty,
                    totalVenta: val,
                    hour: dt.hour(),
                    dayOfWeek: dt.day(),
                    user: (item.waiter_name || 'Sin asignar').toUpperCase(),
                    orderType: oTypeRaw,
                    orderTypeLabel: ORDER_TYPE_LABELS[oTypeRaw] || 'Mesas'
                });
            });
            setRawItems(itemsMap);
            setFetchError(null);
        } catch (e: any) {
            console.error(e);
            setFetchError(e.message || String(e));
            setRawItems([]);
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        if (!rawItems.length) return null;

        const hr: any = {};
        const dy: any = {};
        const prod: any = {};
        const cat: any = {};
        const typed: any = {};
        const usr: any = {};

        for (let i = 0; i < 24; i++) hr[`${i.toString().padStart(2, '0')}:00`] = { time: `${i.toString().padStart(2, '0')}:00`, items: 0, venta: 0 };
        DAY_LABELS.forEach(d => dy[d] = { name: d, items: 0, venta: 0 });

        allUsers.forEach(u => {
            usr[u] = { name: u, items: 0, venta: 0, byCat: {} };
        });

        let grandItems = 0;
        let grandVenta = 0;

        rawItems.forEach(d => {
            const h = `${d.hour.toString().padStart(2, '0')}:00`;
            hr[h].items += d.quantity;
            hr[h].venta += d.totalVenta;

            const dayL = DAY_LABELS[d.dayOfWeek];
            dy[dayL].items += d.quantity;
            dy[dayL].venta += d.totalVenta;

            if (!prod[d.product]) prod[d.product] = { name: d.product, items: 0, venta: 0, category: d.category };
            prod[d.product].items += d.quantity;
            prod[d.product].venta += d.totalVenta;

            if (!cat[d.category]) cat[d.category] = { name: d.category, items: 0, venta: 0, products: {} };
            cat[d.category].items += d.quantity;
            cat[d.category].venta += d.totalVenta;
            if (!cat[d.category].products[d.product]) cat[d.category].products[d.product] = { name: d.product, items: 0, venta: 0 };
            cat[d.category].products[d.product].items += d.quantity;
            cat[d.category].products[d.product].venta += d.totalVenta;

            if (!typed[d.orderTypeLabel]) typed[d.orderTypeLabel] = { name: d.orderTypeLabel, items: 0, venta: 0 };
            typed[d.orderTypeLabel].items += d.quantity;
            typed[d.orderTypeLabel].venta += d.totalVenta;

            if (!usr[d.user]) usr[d.user] = { name: d.user, items: 0, venta: 0, byCat: {} };
            usr[d.user].items += d.quantity;
            usr[d.user].venta += d.totalVenta;
            if (!usr[d.user].byCat[d.category]) usr[d.user].byCat[d.category] = { name: d.category, items: 0, venta: 0 };
            usr[d.user].byCat[d.category].items += d.quantity;
            usr[d.user].byCat[d.category].venta += d.totalVenta;

            grandItems += d.quantity;
            grandVenta += d.totalVenta;
        });

        const arrProd = Object.values(prod) as any[];
        const arrUsr = Object.values(usr) as any[];

        return {
            grandItems,
            grandVenta,
            byHour: Object.values(hr).filter((h: any) => h.venta > 0 || h.items > 0),
            byDay: Object.values(dy),
            byType: Object.values(typed).sort((a: any, b: any) => b.venta - a.venta),
            byCat: Object.values(cat).sort((a: any, b: any) => b.venta - a.venta).map((c: any) => ({
                ...c,
                products: Object.values(c.products).sort((p1: any, p2: any) => p2.venta - p1.venta)
            })),
            topVenta: [...arrProd].sort((a, b) => b.venta - a.venta).slice(0, 20),
            topUnidades: [...arrProd].sort((a, b) => b.items - a.items).slice(0, 10),
            worstUnidades: [...arrProd].sort((a, b) => a.items - b.items).slice(0, 10),
            byUser: arrUsr.sort((a, b) => b.venta - a.venta)
        };
    }, [rawItems, allUsers]);

    const formatCurrency = (val: number) => `Q${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const TABS = [
        { id: 'HORAS', label: 'Día - Horas', icon: Clock },
        { id: 'PLATOS_Q', label: 'Top Mejores Platos (Q.)', icon: Star },
        { id: 'PLATOS_U', label: 'Top Mejores Platos (Uni)', icon: Activity },
        { id: 'USUARIOS', label: 'Ventas Por Usuario', icon: UsersRound },
        { id: 'MEJORES_USUARIOS', label: 'Mejores Usuarios', icon: PieChartIcon },
        { id: 'VENTAS_PLATILLOS', label: 'Ventas Platillos', icon: Utensils },
        { id: 'GENERAL_VENTAS', label: 'General de Ventas', icon: Box }
    ];

    return (
        <div className="flex h-full w-full bg-[#f1f3f6] overflow-hidden font-sans text-slate-900 select-none">
            {/* SIDEBAR */}
            <motion.div
                animate={{ width: isMobile ? 0 : (isSidebarCollapsed ? 32 : 280) }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className={`bg-[#f8f9fa] border-r border-[#d1d5db] flex flex-col shadow-sm shrink-0 z-50 relative overflow-hidden ${isMobile ? 'hidden' : ''}`}
            >
                <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="absolute right-0 top-10 bg-white border-y border-l border-slate-300 text-slate-500 p-1.5 rounded-l-md shadow-sm z-[60] hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center"
                    style={{ width: '24px', height: '32px' }}
                >
                    <ChevronRight size={14} className={`transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
                </button>

                {!isSidebarCollapsed && (
                    <div className="flex flex-col h-full bg-[#f8f9fa]">
                        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                            <div className="border-b border-slate-200">
                                <div className="p-3 space-y-2">
                                    <div className="space-y-1">
                                        <label className="text-[9px] text-slate-500 font-bold block px-1">Sucursal</label>
                                        <select
                                            value={selectedBranch}
                                            onChange={e => setSelectedBranch(e.target.value)}
                                            className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-[10px] uppercase font-bold text-slate-700 outline-none"
                                        >
                                            <option value="ALL">TODAS</option>
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] text-slate-500 font-bold block px-1">Del:</label>
                                        <div className="flex gap-1">
                                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-[10px] outline-none" />
                                            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-16 h-8 bg-white border border-slate-200 rounded px-1 text-[10px] outline-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] text-slate-500 font-bold block px-1">Al:</label>
                                        <div className="flex gap-1">
                                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-[10px] outline-none" />
                                            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-16 h-8 bg-white border border-slate-200 rounded px-1 text-[10px] outline-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 pb-8 bg-white border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] shrink-0">
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="w-full py-2.5 bg-[#106ebe] hover:bg-[#0f172a] text-white rounded font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {loading && <Activity size={12} className="animate-spin" />}
                                Sincronizar Datos
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* CONTENT */}
            <div className="flex-1 flex flex-col overflow-hidden relative bg-[#f1f3f6]">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 flex items-center justify-between shadow-sm z-10">
                    <h1 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <Utensils size={16} className="text-indigo-600" />
                        Análisis Ventas Platillos
                    </h1>
                </div>

                <div className="bg-white border-b border-slate-200 px-4 py-2 shrink-0 admin-tabs-scroll flex items-center gap-2 shadow-sm z-10">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap border ${activeTab === t.id
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-inner'
                                : 'bg-white border-transparent text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            <t.icon size={12} className={activeTab === t.id ? "text-indigo-600" : "text-slate-400"} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Dashboard Area */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar lg:p-6 bg-[#f1f3f6] relative">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-50">
                            <Activity size={32} className="text-indigo-500 animate-spin mb-4" />
                            <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">Calculando estadísticas...</p>
                        </div>
                    ) : fetchError ? (
                        <div className="h-full flex flex-col items-center justify-center text-red-500 max-w-xl mx-auto text-center px-6">
                            <Activity size={48} className="mb-4 opacity-50 text-red-500" />
                            <p className="font-black uppercase tracking-widest text-sm mb-2">Error obteniendo datos desde SQL:</p>
                            <p className="font-mono text-xs text-red-700 bg-red-50 p-4 border border-red-200 rounded break-all shadow-sm">
                                {fetchError}
                            </p>
                            <p className="font-bold text-[10px] uppercase text-red-400 mt-4 tracking-wider">Toma captura de este mensaje para diagnosticarlo.</p>
                        </div>
                    ) : !stats ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Filter size={48} className="mb-4 opacity-20" />
                            <p className="font-black uppercase tracking-widest">Ajuste los filtros y genere el reporte</p>
                        </div>
                    ) : (
                        <div className="space-y-6 max-w-7xl mx-auto pb-20">

                            {/* TAB 1: HORAS Y DIA */}
                            {activeTab === 'HORAS' && (
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    <div className="xl:col-span-2 space-y-6">
                                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                            <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Ventas Por Hora (Items / Quetzales)</h3>
                                            </div>
                                            <div className="h-[250px] p-4">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={stats.byHour} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                        <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tickFormatter={(v) => `Q${v}`} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                                        <RechartsBar yAxisId="left" dataKey="venta" fill="#5f8b9b" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                                                            <LabelList dataKey="venta" position="top" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#5f8b9b' }} formatter={formatCurrency} />
                                                        </RechartsBar>
                                                        <Line yAxisId="right" type="monotone" dataKey="items" stroke="#c2410c" strokeWidth={2} dot={{ r: 4, fill: '#c2410c' }} isAnimationActive={false}>
                                                            <LabelList dataKey="items" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#c2410c' }} />
                                                        </Line>
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                            <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Ventas Por Día</h3>
                                            </div>
                                            <div className="h-[250px] p-4">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={stats.byDay} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                        <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tickFormatter={(v) => `Q${v}`} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                                        <RechartsBar yAxisId="left" dataKey="venta" fill="#5f8b9b" radius={[4, 4, 0, 0]} maxBarSize={50} isAnimationActive={false}>
                                                            <LabelList dataKey="venta" position="insideTop" style={{ fontSize: '9px', fontWeight: 'bold', fill: 'white' }} formatter={formatCurrency} />
                                                        </RechartsBar>
                                                        <Line yAxisId="right" type="monotone" dataKey="items" stroke="#c2410c" strokeWidth={2} dot={{ r: 4, fill: '#white', stroke: '#c2410c', strokeWidth: 2 }} isAnimationActive={false}>
                                                            <LabelList dataKey="items" position="top" style={{ fontSize: '10px', fontWeight: 'black', fill: '#c2410c' }} />
                                                        </Line>
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm h-fit">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Resumen De Ventas</h3>
                                        </div>
                                        <div className="p-0">
                                            <table className="w-full text-left text-[10px]">
                                                <thead className="bg-[#f0f0f0] border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-2 font-black text-slate-600 uppercase">Gran Total</th>
                                                        <th className="px-4 py-2 text-right font-black text-slate-600 uppercase">Items</th>
                                                        <th className="px-4 py-2 text-right font-black text-slate-600 uppercase">Venta</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {stats.byType.map((t: any, i: number) => (
                                                        <tr key={i} className="hover:bg-[#f6f8fa] text-slate-700 font-bold uppercase transition-colors">
                                                            <td className="px-4 py-2 border-r border-slate-100">{t.name}</td>
                                                            <td className="px-4 py-2 text-right tabular-nums border-r border-slate-100">{t.items}</td>
                                                            <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(t.venta)}</td>
                                                        </tr>
                                                    ))}
                                                    <tr className="bg-[#106ebe] text-white font-black">
                                                        <td className="px-4 py-2 border-r border-[#3a3b4d]">Gran Total</td>
                                                        <td className="px-4 py-2 text-right tabular-nums border-r border-[#3a3b4d]">{stats.grandItems}</td>
                                                        <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(stats.grandVenta)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: PLATOS VENTA (Q) */}
                            {activeTab === 'PLATOS_Q' && (
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    <div className="xl:col-span-2 space-y-6">
                                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                            <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Venta Por Platos (20 Mejores)</h3>
                                            </div>
                                            <div className="h-[350px] p-4">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={stats.topVenta} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 'bold' }} interval={0} angle={-45} textAnchor="end" />
                                                        <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `Q${v}`} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} formatter={(v: any) => formatCurrency(v)} />
                                                        <RechartsBar dataKey="venta" fill="#5f8b9b" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                                                            <LabelList dataKey="venta" position="top" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#5f8b9b' }} formatter={formatCurrency} />
                                                        </RechartsBar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                            <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Participación Tipo Orden</h3>
                                            </div>
                                            <div className="h-[300px] flex items-center justify-center pt-6">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={stats.byType}
                                                            dataKey="venta"
                                                            nameKey="name"
                                                            cx="40%"
                                                            cy="50%"
                                                            outerRadius={80}
                                                            label={({ name, value, percent }) => `${name}: Q${value} (${(percent * 100).toFixed(2)}%)`}
                                                            labelLine={true}
                                                            isAnimationActive={false}
                                                        >
                                                            {stats.byType.map((_: any, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm h-[680px] flex flex-col">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200 shrink-0">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Venta Por Categoria y Plato (Todos)</h3>
                                        </div>
                                        <div className="flex-1 overflow-auto custom-scrollbar">
                                            <table className="w-full text-left text-[10px]">
                                                <thead className="bg-[#f0f0f0] border-b border-slate-200 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-4 py-2 font-black text-slate-600 uppercase">Platos</th>
                                                        <th className="px-4 py-2 text-right font-black text-slate-600 uppercase">Total Venta</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {stats.byCat.map((c: any, i: number) => (
                                                        <React.Fragment key={i}>
                                                            <tr className="bg-orange-600 text-white font-black uppercase text-[11px] sticky top-8 shadow-sm">
                                                                <td className="px-4 py-1.5 border-r border-orange-500 flex items-center gap-1"><ChevronRight size={12} /> {c.name}</td>
                                                                <td className="px-4 py-1.5 text-right tabular-nums">{formatCurrency(c.venta)}</td>
                                                            </tr>
                                                            {c.products.map((p: any, j: number) => (
                                                                <tr key={j} className="hover:bg-slate-50 text-slate-700 font-bold uppercase transition-colors">
                                                                    <td className="px-8 py-1.5 border-r border-slate-100">{p.name}</td>
                                                                    <td className="px-4 py-1.5 text-right tabular-nums">{formatCurrency(p.venta)}</td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: PLATOS (UNIDADES) */}
                            {activeTab === 'PLATOS_U' && (
                                <div className="space-y-6">
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Top 10 Más Vendidos</h3>
                                        </div>
                                        <div className="h-[300px] p-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={stats.topUnidades} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 'bold' }} interval={0} angle={-30} textAnchor="end" />
                                                    <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tickFormatter={(v) => `Q${v}`} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                                    <RechartsBar yAxisId="left" dataKey="venta" fill="#5f8b9b" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                                                        <LabelList dataKey="venta" position="insideTop" style={{ fontSize: '9px', fontWeight: 'bold', fill: 'white' }} formatter={formatCurrency} />
                                                    </RechartsBar>
                                                    <Line yAxisId="right" type="monotone" dataKey="items" stroke="#c2410c" strokeWidth={2} dot={{ r: 4, fill: 'white', stroke: '#c2410c', strokeWidth: 2 }} isAnimationActive={false}>
                                                        <LabelList dataKey="items" position="top" style={{ fontSize: '10px', fontWeight: 'black', fill: '#c2410c' }} />
                                                    </Line>
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Top 10 Menos Vendidos</h3>
                                        </div>
                                        <div className="h-[300px] p-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={stats.worstUnidades} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 'bold' }} interval={0} angle={-30} textAnchor="end" />
                                                    <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tickFormatter={(v) => `Q${v}`} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                                    <RechartsBar yAxisId="left" dataKey="venta" fill="#5f8b9b" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                                                        <LabelList dataKey="venta" position="insideTop" style={{ fontSize: '9px', fontWeight: 'bold', fill: 'white' }} formatter={formatCurrency} />
                                                    </RechartsBar>
                                                    <Line yAxisId="right" type="monotone" dataKey="items" stroke="#c2410c" strokeWidth={2} dot={{ r: 4, fill: 'white', stroke: '#c2410c', strokeWidth: 2 }} isAnimationActive={false}>
                                                        <LabelList dataKey="items" position="top" style={{ fontSize: '10px', fontWeight: 'black', fill: '#c2410c' }} />
                                                    </Line>
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: USUARIOS */}
                            {activeTab === 'USUARIOS' && (
                                <div className="space-y-6">
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Venta y Cantidad de Platos Vendidos por Usuario</h3>
                                        </div>
                                        <div className="h-[300px] p-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={stats.byUser} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} interval={0} angle={-15} textAnchor="end" />
                                                    <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tickFormatter={(v) => `Q${v}`} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                                    <RechartsBar yAxisId="left" dataKey="venta" fill="#5f8b9b" radius={[4, 4, 0, 0]} maxBarSize={60} isAnimationActive={false}>
                                                        <LabelList dataKey="venta" position="insideTop" style={{ fontSize: '9px', fontWeight: 'bold', fill: 'white' }} formatter={formatCurrency} />
                                                    </RechartsBar>
                                                    <Line yAxisId="right" type="monotone" dataKey="items" stroke="#c2410c" strokeWidth={2} dot={{ r: 4, fill: 'white', stroke: '#c2410c', strokeWidth: 2 }} isAnimationActive={false}>
                                                        <LabelList dataKey="items" position="top" style={{ fontSize: '10px', fontWeight: 'black', fill: '#c2410c' }} />
                                                    </Line>
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm overflow-x-auto">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Venta y cantidad de items vendidos</h3>
                                        </div>
                                        <table className="w-full text-left text-[10px]">
                                            <thead className="bg-[#f0f0f0]">
                                                <tr>
                                                    <th className="px-4 py-2 bg-white min-w-[150px] sticky left-0 z-10 border-r border-b border-slate-200"></th>
                                                    {stats.byUser.map((u: any, i: number) => (
                                                        <th key={i} colSpan={2} className="px-4 py-2 text-center font-black text-slate-600 uppercase border-r border-b border-slate-200">{u.name}</th>
                                                    ))}
                                                </tr>
                                                <tr>
                                                    <th className="bg-white sticky left-0 z-10 border-r border-b border-slate-200"></th>
                                                    {stats.byUser.map((_: any, i: number) => (
                                                        <React.Fragment key={`sub-${i}`}>
                                                            <th className="px-4 py-1 text-center font-bold text-slate-500 uppercase border-r border-b border-slate-200">Items</th>
                                                            <th className="px-4 py-1 text-center font-bold text-slate-500 uppercase border-r border-b border-slate-200">Venta</th>
                                                        </React.Fragment>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {stats.byCat.map((c: any, i: number) => (
                                                    <tr key={i} className="hover:bg-orange-50 transition-colors">
                                                        <td className="px-4 py-2 uppercase font-black text-slate-700 bg-white sticky left-0 z-10 border-r border-slate-200 whitespace-nowrap">{c.name}</td>
                                                        {stats.byUser.map((u: any, j: number) => {
                                                            const s = u.byCat[c.name] || { items: 0, venta: 0 };
                                                            return (
                                                                <React.Fragment key={j}>
                                                                    <td className="px-4 py-2 text-center tabular-nums font-bold text-slate-600 border-r border-slate-100">{s.items || ''}</td>
                                                                    <td className="px-4 py-2 text-right tabular-nums font-black text-slate-800 border-r border-slate-100">{s.venta ? formatCurrency(s.venta) : ''}</td>
                                                                </React.Fragment>
                                                            )
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 5: MEJORES USUARIOS */}
                            {activeTab === 'MEJORES_USUARIOS' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Mejores 10 Usuarios</h3>
                                        </div>
                                        <div className="h-[400px] flex items-center justify-center p-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={stats.byUser.filter((u: any) => u.venta > 0).slice(0, 10)}
                                                        dataKey="venta"
                                                        nameKey="name"
                                                        cx="35%"
                                                        cy="50%"
                                                        outerRadius={100}
                                                        label={false}
                                                        isAnimationActive={false}
                                                    >
                                                        {stats.byUser.filter((u: any) => u.venta > 0).slice(0, 10).map((_: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => formatCurrency(val)} />
                                                    <Legend
                                                        verticalAlign="middle"
                                                        align="right"
                                                        layout="vertical"
                                                        iconType="circle"
                                                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Ventas Por Usuario</h3>
                                        </div>
                                        <div className="p-0">
                                            <table className="w-full text-left text-[10px]">
                                                <thead className="bg-[#f0f0f0] border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-2 font-black text-slate-600 uppercase border-r border-slate-200">Usuario</th>
                                                        <th className="px-4 py-2 text-right font-black text-slate-600 uppercase">Total Venta</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {stats.byUser.map((u: any, i: number) => (
                                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-2 font-bold uppercase text-slate-700 border-r border-slate-100">{u.name}</td>
                                                            <td className="px-4 py-2 text-right tabular-nums text-slate-800 bg-orange-600 text-white border-y border-white">{formatCurrency(u.venta)}</td>
                                                        </tr>
                                                    ))}
                                                    <tr className="bg-[#f8f9fa] text-slate-700 font-black">
                                                        <td className="px-4 py-3 border-r border-slate-200">Gran Total</td>
                                                        <td className="px-4 py-3 text-right tabular-nums text-slate-900 border-b-2 border-slate-300">{formatCurrency(stats.grandVenta)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 6: VENTAS PLATILLOS */}
                            {activeTab === 'VENTAS_PLATILLOS' && (
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Ventas de Todos los Platillos</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-[10px]">
                                            <thead className="bg-[#f0f0f0]">
                                                <tr>
                                                    <th className="px-4 py-2 font-black text-slate-600 uppercase">Categoría</th>
                                                    <th className="px-4 py-2 font-black text-slate-600 uppercase">Platillo</th>
                                                    <th className="px-4 py-2 text-center font-black text-slate-600 uppercase">Cantidad</th>
                                                    <th className="px-4 py-2 text-right font-black text-slate-600 uppercase">Total Venta</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {stats.byCat.map((c: any) => (
                                                    <React.Fragment key={c.name}>
                                                        <tr className="bg-slate-50 border-b border-slate-200">
                                                            <td colSpan={4} className="px-4 py-2 font-black text-slate-700 uppercase">{c.name}</td>
                                                        </tr>
                                                        {c.products.map((p: any, i: number) => (
                                                            <tr key={`${c.name}-${i}`} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-4 py-2 text-slate-500 uppercase"></td>
                                                                <td className="px-4 py-2 font-bold text-slate-700 uppercase">{p.name}</td>
                                                                <td className="px-4 py-2 text-center tabular-nums text-slate-600">{p.items}</td>
                                                                <td className="px-4 py-2 text-right tabular-nums text-slate-800 font-bold">{formatCurrency(p.venta)}</td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 7: GENERAL VENTAS */}
                            {activeTab === 'GENERAL_VENTAS' && (
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Reporte Detallado de Items Vendidos</h3>
                                    </div>
                                    <div className="overflow-x-auto h-[600px] overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-left text-[10px] sticky-header">
                                            <thead className="bg-[#f0f0f0] sticky top-0 z-10 shadow-sm border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-2 font-black text-slate-600 uppercase">Orden</th>
                                                    <th className="px-4 py-2 font-black text-slate-600 uppercase">Día / Hora</th>
                                                    <th className="px-4 py-2 font-black text-slate-600 uppercase">Categoría</th>
                                                    <th className="px-4 py-2 font-black text-slate-600 uppercase">Platillo</th>
                                                    <th className="px-4 py-2 text-center font-black text-slate-600 uppercase">Cant.</th>
                                                    <th className="px-4 py-2 text-right font-black text-slate-600 uppercase">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {rawItems.map((item: any, i: number) => (
                                                    <tr key={item.id || i} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-2 font-black text-slate-800 uppercase">#{item.orderNumber}</td>
                                                        <td className="px-4 py-2 font-bold text-slate-500 whitespace-nowrap">{item.createdAt}</td>
                                                        <td className="px-4 py-2 font-bold text-slate-500 uppercase">{item.category}</td>
                                                        <td className="px-4 py-2 font-bold text-slate-700 uppercase">{item.product}</td>
                                                        <td className="px-4 py-2 text-center tabular-nums text-slate-600">{item.quantity}</td>
                                                        <td className="px-4 py-2 text-right tabular-nums text-slate-800 font-bold">{formatCurrency(item.totalVenta)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
