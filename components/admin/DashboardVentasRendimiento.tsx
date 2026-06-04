import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, Calendar, ChevronRight, Clock, ListFilter,
    FileText, Users, CreditCard, Search, TrendingUp,
    BarChart3, PieChart as PieChartIcon, Table2
} from 'lucide-react';
import { supabase } from '../../supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import {
    ResponsiveContainer, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell, Legend, Line,
    CartesianGrid, LabelList, ComposedChart,
    Bar as RechartsBar
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const ORDER_TYPE_LABELS: Record<string, string> = {
    'DINE_IN': 'Mesas',
    'TAKE_OUT': 'Para Llevar',
    'TAKEOUT': 'Para Llevar',
    'DELIVERY': 'Domicilio',
    'QUICK_SALE': 'Para Llevar'
};

const DAY_LABELS = ['0 DOMINGO', '1 LUNES', '2 MARTES', '3 MIÉRCOLES', '4 JUEVES', '5 VIERNES', '6 SÁBADO'];

const PIE_COLORS = ['#0d9488', '#0ea5e9', '#6366f1', '#8b5cf6', '#f97316', '#f43f5e', '#eab308', '#64748b'];

export const DashboardVentasRendimiento: React.FC = () => {
    dayjs.locale('es');

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const getISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(getISO(firstDay));
    const [endDate, setEndDate] = useState(getISO(now));
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState('ALL');
    const [data, setData] = useState<any[]>([]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState('DIAS_HORAS');

    // Filtros secundarios
    const [selectedOrderTypes, setSelectedOrderTypes] = useState<string[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [selectedSections, setSelectedSections] = useState<string[]>([]);
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [selectedHours, setSelectedHours] = useState<string[]>([]);

    useEffect(() => {
        const fetchBranches = async () => {
            const { data: b } = await supabase.from('branches').select('id, name').order('name');
            if (b) setBranches(b);
        };
        fetchBranches();
        // handleGenerate();
    }, []);

    useEffect(() => {
        // const timeout = setTimeout(() => handleGenerate(), 300);
        // return () => clearTimeout(timeout);
    }, [startDate, endDate, selectedBranch]);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('orders')
                .select(`
                    id, created_at, order_number, order_type, total, tip_amount, discount_amount, status, branch_id,
                    tables:table_id (number, section),
                    waiter:profiles!waiter_id (name)
                `)
                .in('status', ['completed', 'finalizada', 'PAID', 'FINALIZADA', 'cerrada', 'CERRADA'])
                .gte('created_at', `${startDate} 00:00:00`)
                .lte('created_at', `${endDate} 23:59:59`)
                .order('created_at', { ascending: true });

            if (selectedBranch !== 'ALL') {
                query = query.eq('branch_id', selectedBranch);
            }

            const { data: raw, error } = await query;
            if (error) throw error;

            const mapped = (raw || []).map(o => {
                const d = dayjs(o.created_at);
                return {
                    id: o.id,
                    fecha: o.created_at,
                    dateOnly: o.created_at.split('T')[0],
                    fechaFormatted: d.format('DD/MM/YYYY HH:mm'),
                    hour: d.format('HH:00'),
                    dayOfWeek: d.day(),
                    dayLabel: DAY_LABELS[d.day()],
                    orderType: o.order_type || 'DINE_IN',
                    orderTypeLabel: ORDER_TYPE_LABELS[o.order_type] || 'Mesas',
                    orderNumber: o.order_number || o.id.slice(0, 6).toUpperCase(),
                    total: Number(o.total || 0),
                    tip: Number(o.tip_amount || 0),
                    discount: Number(o.discount_amount || 0),
                    user: (o.waiter as any)?.name || 'Sin asignar',
                    section: (o.tables as any)?.section || '---',
                    mesa: (o.tables as any)?.number || '---'
                };
            });

            setData(mapped);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    };

    // Opciones únicas para filtros
    const orderTypeOptions = useMemo(() => Array.from(new Set<string>(data.map(d => d.orderTypeLabel))).sort(), [data]);
    const userOptions = useMemo(() => Array.from(new Set<string>(data.map(d => d.user))).sort(), [data]);
    const sectionOptions = useMemo(() => Array.from(new Set<string>(data.map(d => d.section))).sort(), [data]);
    const dayOptions = useMemo(() => Array.from(new Set<string>(data.map(d => d.dayLabel))).sort(), [data]);
    const hourOptions = useMemo(() => Array.from(new Set<string>(data.map(d => d.hour))).sort(), [data]);

    // Filtrado
    const filteredData = useMemo(() => {
        return data.filter(d => {
            if (selectedOrderTypes.length > 0 && !selectedOrderTypes.includes(d.orderTypeLabel)) return false;
            if (selectedUsers.length > 0 && !selectedUsers.includes(d.user)) return false;
            if (selectedSections.length > 0 && !selectedSections.includes(d.section)) return false;
            if (selectedDays.length > 0 && !selectedDays.includes(d.dayLabel)) return false;
            if (selectedHours.length > 0 && !selectedHours.includes(d.hour)) return false;
            return true;
        });
    }, [data, selectedOrderTypes, selectedUsers, selectedSections, selectedDays, selectedHours]);

    // Stats
    const stats = useMemo(() => {
        const totalVenta = filteredData.reduce((a, c) => a + c.total, 0);
        const totalOrdenes = filteredData.length;

        // Por Hora
        const hourMap: any = {};
        filteredData.forEach(d => {
            if (!hourMap[d.hour]) hourMap[d.hour] = { hour: d.hour, totalVenta: 0, totalOrdenes: 0 };
            hourMap[d.hour].totalVenta += d.total;
            hourMap[d.hour].totalOrdenes += 1;
        });
        const byHour = Object.values(hourMap).sort((a: any, b: any) => a.hour.localeCompare(b.hour));

        // Por Día de semana
        const dayMap: any = {};
        filteredData.forEach(d => {
            if (!dayMap[d.dayLabel]) dayMap[d.dayLabel] = { day: d.dayLabel, totalVenta: 0, totalOrdenes: 0 };
            dayMap[d.dayLabel].totalVenta += d.total;
            dayMap[d.dayLabel].totalOrdenes += 1;
        });
        const byDay = DAY_LABELS.map(label => dayMap[label] || { day: label, totalVenta: 0, totalOrdenes: 0 });

        // Por Tipo de Orden
        const typeMap: any = {};
        filteredData.forEach(d => {
            if (!typeMap[d.orderTypeLabel]) typeMap[d.orderTypeLabel] = { name: d.orderTypeLabel, totalVenta: 0, totalOrdenes: 0 };
            typeMap[d.orderTypeLabel].totalVenta += d.total;
            typeMap[d.orderTypeLabel].totalOrdenes += 1;
        });
        const byType = Object.values(typeMap).sort((a: any, b: any) => b.totalVenta - a.totalVenta);

        // Por Sección
        const secMap: any = {};
        filteredData.forEach(d => {
            if (!secMap[d.section]) secMap[d.section] = { name: d.section, totalVenta: 0, totalOrdenes: 0 };
            secMap[d.section].totalVenta += d.total;
            secMap[d.section].totalOrdenes += 1;
        });
        const bySection = Object.values(secMap).sort((a: any, b: any) => b.totalVenta - a.totalVenta);

        // Por Usuario
        const userMap: any = {};
        filteredData.forEach(d => {
            if (!userMap[d.user]) userMap[d.user] = { name: d.user, totalVenta: 0, totalOrdenes: 0 };
            userMap[d.user].totalVenta += d.total;
            userMap[d.user].totalOrdenes += 1;
        });
        const byUser = Object.values(userMap).sort((a: any, b: any) => b.totalVenta - a.totalVenta);

        return { totalVenta, totalOrdenes, byHour, byDay, byType, bySection, byUser };
    }, [filteredData]);

    const formatCurrency = (val: number) => `Q${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const TABS = [
        { id: 'DIAS_HORAS', label: 'Días - Horas', icon: Clock },
        { id: 'TIPO_ORDEN', label: 'Ventas Por Tipo de Orden', icon: BarChart3 },
        { id: 'SECCIONES', label: 'Secciones', icon: Table2 },
        { id: 'USUARIOS', label: 'Usuarios', icon: Users },
        { id: 'RESUMEN', label: 'Resumen General', icon: ListFilter }
    ];

    // Componente de filtro reutilizable
    const FilterBlock = ({ title, icon: Icon, options, selected, setSelected }: any) => (
        <div className="border-b border-slate-200">
            <div className="flex items-center px-3 py-2 bg-white">
                <h3 className="text-[10px] font-medium text-slate-700 flex items-center gap-2">
                    <Icon size={12} className="text-slate-400" />
                    {title}
                </h3>
            </div>
            <div className="p-3 bg-[#f3f4f6]/50 space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={selected.length === 0} onChange={() => setSelected([])} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-0" />
                    <span className="text-[10px] text-blue-600 font-medium">(Todos)</span>
                </label>
                {options.map((o: string) => (
                    <label key={o} className="flex items-center gap-2 cursor-pointer pl-2">
                        <input type="checkbox" checked={selected.includes(o)} onChange={() => setSelected((prev: string[]) => prev.includes(o) ? prev.filter((x: string) => x !== o) : [...prev, o])} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-0" />
                        <span className="text-[10px] text-slate-600 font-medium truncate">{o}</span>
                    </label>
                ))}
            </div>
        </div>
    );

    return (
        <div className="flex h-full w-full bg-[#f1f3f6] overflow-hidden font-sans text-slate-900 select-none">
            {/* SIDEBAR */}
            <motion.div
                animate={{ width: isSidebarCollapsed ? 32 : 280 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="bg-[#f8f9fa] border-r border-[#d1d5db] flex flex-col shadow-sm shrink-0 z-50 relative overflow-hidden"
            >
                <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="absolute right-0 top-10 bg-white border-y border-l border-slate-300 text-slate-500 p-1.5 rounded-l-md shadow-sm z-[60] hover:bg-slate-100 transition-all flex items-center justify-center cursor-pointer"
                    style={{ width: '24px', height: '32px' }}
                >
                    <ChevronRight size={14} className={`transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
                </button>

                {!isSidebarCollapsed && (
                    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        {/* FECHAS */}
                        <div className="border-b border-slate-200">
                            <div className="flex items-center px-3 py-2 bg-white">
                                <h3 className="text-[10px] font-medium text-slate-700 flex items-center gap-2">
                                    <Calendar size={12} className="text-slate-400" /> Filtro Fechas
                                </h3>
                            </div>
                            <div className="p-3 space-y-2">
                                <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-medium block px-1">Fecha Inicial</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-[10px] outline-none focus:border-blue-400" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-medium block px-1">Fecha Final</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-[10px] outline-none focus:border-blue-400" />
                                </div>
                            </div>
                        </div>

                        <FilterBlock title="Filtro Tipo de Orden" icon={CreditCard} options={orderTypeOptions} selected={selectedOrderTypes} setSelected={setSelectedOrderTypes} />
                        <FilterBlock title="Filtro Usuario" icon={Users} options={userOptions} selected={selectedUsers} setSelected={setSelectedUsers} />
                        <FilterBlock title="Filtro Sección" icon={Table2} options={sectionOptions} selected={selectedSections} setSelected={setSelectedSections} />
                        <FilterBlock title="Filtro Día" icon={Calendar} options={dayOptions} selected={selectedDays} setSelected={setSelectedDays} />
                        <FilterBlock title="Filtro Hora" icon={Clock} options={hourOptions} selected={selectedHours} setSelected={setSelectedHours} />
                    </div>
                )}

                {!isSidebarCollapsed && (
                    <div className="p-3 bg-white border-t border-slate-200">
                        <button onClick={handleGenerate}
                            className="w-full h-9 bg-[#1a1b26] text-white rounded flex items-center justify-center gap-2 font-medium uppercase tracking-widest shadow-sm active:scale-95 transition-all text-[9px] hover:bg-[#106ebe] cursor-pointer"
                        >
                            {loading ? <Loader2 size={12} className="animate-spin" /> : 'Sincronizar Datos'}
                        </button>
                    </div>
                )}
            </motion.div>

            {/* CONTENIDO */}
            <main className="flex-1 overflow-y-auto bg-[#f1f3f6] p-4 pb-64 custom-scrollbar scroll-smooth">
                <div className="text-center mb-4">
                    <h1 className="text-[14px] font-semibold text-slate-800 uppercase tracking-widest">Análisis De Ventas</h1>
                </div>

                {/* TABS */}
                <div className="flex items-center gap-1 mb-6 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit sticky top-0 z-10 mx-auto">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-all cursor-pointer ${activeTab === tab.id ? 'bg-[#1a1b26] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <tab.icon size={13} className={activeTab === tab.id ? 'text-teal-400' : 'text-slate-400'} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-6">

                        {/* === TAB 1: DÍAS - HORAS === */}
                        {activeTab === 'DIAS_HORAS' && (
                            <div className="space-y-6">
                                {/* Ventas Por Hora */}
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Ventas Por Hora</h3>
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-teal-500 rounded-sm" /><span className="text-[9px] font-medium text-slate-500">Total Venta</span></div>
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500 rounded-full" /><span className="text-[9px] font-medium text-slate-500">Total Ordenes</span></div>
                                        </div>
                                    </div>
                                    <div className="h-[300px] p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={stats.byHour} margin={{ top: 20, right: 50, left: 10, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '10px' }} formatter={(v: any, name: string) => [name === 'totalVenta' ? formatCurrency(v) : v, name === 'totalVenta' ? 'Total Venta' : 'Ordenes']} />
                                                <RechartsBar yAxisId="left" dataKey="totalVenta" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={30} isAnimationActive={false}>
                                                    <LabelList dataKey="totalVenta" position="top" offset={10} style={{ fontSize: '7px', fontWeight: 'bold', fill: '#0d9488' }} formatter={(v: any) => v > 0 ? formatCurrency(v) : ''} />
                                                </RechartsBar>
                                                <Line yAxisId="right" type="monotone" dataKey="totalOrdenes" stroke="#e11d48" strokeWidth={2} dot={{ r: 4, fill: '#e11d48' }} isAnimationActive={false}>
                                                    <LabelList dataKey="totalOrdenes" position="top" offset={10} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#e11d48' }} />
                                                </Line>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Ventas Por Día + Resumen */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Ventas Por Día</h3>
                                        </div>
                                        <div className="h-[300px] p-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={stats.byDay} margin={{ top: 20, right: 50, left: 10, bottom: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 'bold' }} />
                                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                                    <RechartsBar yAxisId="left" dataKey="totalVenta" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={false}>
                                                        <LabelList dataKey="totalVenta" position="top" offset={10} style={{ fontSize: '7px', fontWeight: 'bold', fill: '#0d9488' }} formatter={(v: any) => v > 0 ? formatCurrency(v) : ''} />
                                                    </RechartsBar>
                                                    <Line yAxisId="right" type="monotone" dataKey="totalOrdenes" stroke="#e11d48" strokeWidth={2} dot={{ r: 4, fill: '#e11d48' }} isAnimationActive={false}>
                                                        <LabelList dataKey="totalOrdenes" position="top" offset={10} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#e11d48' }} />
                                                    </Line>
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Resumen De Ventas */}
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Resumen De Ventas</h3>
                                        </div>
                                        <table className="w-full text-[10px]">
                                            <thead>
                                                <tr className="border-b border-slate-200 text-[8px] font-semibold text-slate-500 uppercase tracking-widest">
                                                    <th className="px-3 py-2 text-left" colSpan={3}>Gran Total</th>
                                                </tr>
                                                <tr className="border-b border-slate-100 text-[8px] font-semibold text-slate-400 uppercase tracking-widest">
                                                    <th className="px-3 py-1.5 text-left"></th>
                                                    <th className="px-3 py-1.5 text-right">Total Ordenes</th>
                                                    <th className="px-3 py-1.5 text-right">Total Venta</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                                                {(stats.byType as any[]).map((t: any, i: number) => (
                                                    <tr key={i} className="hover:bg-slate-50">
                                                        <td className="px-3 py-1.5 text-[9px]">{t.name}</td>
                                                        <td className="px-3 py-1.5 text-right tabular-nums text-orange-500">{t.totalOrdenes}</td>
                                                        <td className="px-3 py-1.5 text-right tabular-nums text-teal-600">{formatCurrency(t.totalVenta)}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-[#106ebe] text-white font-semibold text-[10px]">
                                                    <td className="px-3 py-2">Gran Total</td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-orange-400">{stats.totalOrdenes}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-teal-400">{formatCurrency(stats.totalVenta)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === TAB 2: TIPO DE ORDEN === */}
                        {activeTab === 'TIPO_ORDEN' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Ventas Por Tipo de Orden</h3>
                                    </div>
                                    <div className="h-[350px] p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={stats.byType} layout="vertical" margin={{ top: 10, right: 80, left: 80, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} width={80} />
                                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} formatter={(v: any) => formatCurrency(v)} />
                                                <RechartsBar dataKey="totalVenta" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={25} isAnimationActive={false}>
                                                    <LabelList dataKey="totalVenta" position="right" offset={8} style={{ fontSize: '8px', fontWeight: 'bold', fill: '#0d9488' }} formatter={(v: any) => formatCurrency(v)} />
                                                </RechartsBar>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm flex flex-col">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Distribución</h3>
                                    </div>
                                    <div className="flex-1 min-h-[350px] flex items-center justify-center p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={stats.byType} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="totalVenta" isAnimationActive={false}
                                                    label={({ percent }) => `${((percent as number) * 100).toFixed(0)}%`}
                                                >
                                                    {(stats.byType as any[]).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === TAB 3: SECCIONES === */}
                        {activeTab === 'SECCIONES' && (
                            <div className="space-y-6">
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Ventas Por Sección</h3>
                                    </div>
                                    <div className="h-[300px] p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={stats.bySection} margin={{ top: 20, right: 50, left: 10, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} formatter={(v: any, name: string) => [name === 'totalVenta' ? formatCurrency(v) : v, name === 'totalVenta' ? 'Total Venta' : 'Ordenes']} />
                                                <RechartsBar yAxisId="left" dataKey="totalVenta" fill="#5f8b9b" radius={[4, 4, 0, 0]} barSize={50} isAnimationActive={false}>
                                                    <LabelList dataKey="totalVenta" position="top" offset={10} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#5f8b9b' }} formatter={(v: any) => formatCurrency(v)} />
                                                </RechartsBar>
                                                <Line yAxisId="right" type="monotone" dataKey="totalOrdenes" stroke="#c2410c" strokeWidth={2} dot={{ r: 4, fill: '#c2410c' }} isAnimationActive={false}>
                                                    <LabelList dataKey="totalOrdenes" position="top" offset={10} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#c2410c' }} />
                                                </Line>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm w-fit min-w-[500px]">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200 flex justify-between">
                                        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Ventas Por Sección</h3>
                                    </div>
                                    <table className="w-full text-[10px]">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-[8px] font-semibold text-slate-500 uppercase tracking-widest">
                                                <th className="px-4 py-2 text-left bg-[#f8f9fa] border-r border-slate-200"></th>
                                                <th className="px-4 py-2 text-center border-r border-slate-200" colSpan={2}>Gran Total</th>
                                            </tr>
                                            <tr className="border-b border-slate-100 text-[8px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-50">
                                                <th className="px-4 py-2 text-left border-r border-slate-100"></th>
                                                <th className="px-4 py-2 text-right border-r border-slate-100">Total Ordenes</th>
                                                <th className="px-4 py-2 text-right">Total Venta</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                                            {(stats.bySection as any[]).map((s: any, i: number) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 uppercase text-[9px] border-r border-slate-100">{s.name}</td>
                                                    <td className="px-4 py-2 text-right tabular-nums text-white bg-orange-600 border-r border-slate-100 border-y border-white">{s.totalOrdenes}</td>
                                                    <td className="px-4 py-2 text-right tabular-nums text-white bg-orange-600 border-y border-white">{formatCurrency(s.totalVenta)}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-[#f8f9fa] text-slate-700 font-semibold text-[10px]">
                                                <td className="px-4 py-2 border-r border-slate-200">Gran Total</td>
                                                <td className="px-4 py-2 text-right tabular-nums border-r border-slate-200">{stats.totalOrdenes}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(stats.totalVenta)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* === TAB 4: USUARIOS === */}
                        {activeTab === 'USUARIOS' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Ventas Por Usuario</h3>
                                    </div>
                                    <div className="h-[400px] p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart layout="vertical" data={stats.byUser} margin={{ top: 20, right: 80, left: 60, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                <XAxis type="number" xAxisId="bottom" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <XAxis type="number" xAxisId="top" orientation="top" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tickFormatter={(v) => String(v).toUpperCase()} tick={{ fill: '#475569', fontSize: 9, fontWeight: 'bold' }} />
                                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                                <RechartsBar xAxisId="bottom" dataKey="totalVenta" fill="#5f8b9b" radius={[0, 4, 4, 0]} barSize={25} isAnimationActive={false}>
                                                    <LabelList dataKey="totalVenta" position="right" offset={10} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#5f8b9b' }} formatter={(v: any) => formatCurrency(v)} />
                                                </RechartsBar>
                                                <Line xAxisId="top" type="monotone" dataKey="totalOrdenes" stroke="#c2410c" strokeWidth={2} dot={{ r: 4, fill: '#c2410c' }} isAnimationActive={false}>
                                                    <LabelList dataKey="totalOrdenes" position="top" offset={10} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#c2410c' }} />
                                                </Line>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm h-fit">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Total Ventas</h3>
                                    </div>
                                    <table className="w-full text-[10px]">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-[8px] font-semibold text-slate-500 uppercase tracking-widest bg-[#f8f9fa]">
                                                <th className="px-4 py-2 text-left border-r border-slate-200"></th>
                                                <th className="px-4 py-2 text-center" colSpan={2}>Gran Total</th>
                                            </tr>
                                            <tr className="border-b border-slate-100 text-[8px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-50">
                                                <th className="px-4 py-2 text-left border-r border-slate-100"></th>
                                                <th className="px-4 py-2 text-right border-r border-slate-100">Total Ordenes</th>
                                                <th className="px-4 py-2 text-right">Total Venta</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                                            {(stats.byUser as any[]).map((u: any, i: number) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 uppercase text-[9px] border-r border-slate-100">{u.name}</td>
                                                    <td className="px-4 py-2 text-right tabular-nums border-r border-slate-100 border-y border-white" style={{ backgroundColor: i < 3 ? '#ea580c' : 'transparent', color: i < 3 ? 'white' : 'inherit' }}>{u.totalOrdenes}</td>
                                                    <td className="px-4 py-2 text-right tabular-nums border-y border-white" style={{ backgroundColor: i < 3 ? '#ea580c' : 'transparent', color: i < 3 ? 'white' : 'inherit' }}>{formatCurrency(u.totalVenta)}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-[#f8f9fa] text-slate-700 font-semibold text-[10px]">
                                                <td className="px-4 py-2 border-r border-slate-200">Gran Total</td>
                                                <td className="px-4 py-2 text-right tabular-nums border-r border-slate-200">{stats.totalOrdenes}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(stats.totalVenta)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* === TAB 5: RESUMEN GENERAL === */}
                        {activeTab === 'RESUMEN' && (
                            <div className="flex flex-col h-[calc(100vh-220px)] bg-white border border-slate-200 rounded-lg shadow-sm">
                                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                                    <table className="w-full min-w-[1200px] text-[10px] border-collapse relative">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-[#f8f9fa] border-b border-slate-200 text-[8px] font-semibold text-slate-500 uppercase tracking-widest">
                                                <th className="px-3 py-3 text-left border-r border-slate-200">Fecha</th>
                                                <th className="px-3 py-3 text-center border-r border-slate-200">No. Orden</th>
                                                <th className="px-3 py-3 text-left border-r border-slate-200">Tipo</th>
                                                <th className="px-3 py-3 text-left border-r border-slate-200">Sección</th>
                                                <th className="px-3 py-3 text-center border-r border-slate-200">No. Mesa</th>
                                                <th className="px-3 py-3 text-left border-r border-slate-200">Atendió</th>
                                                <th className="px-3 py-3 text-right border-r border-slate-200">SubTotal</th>
                                                <th className="px-3 py-3 text-right border-r border-slate-200">Propina</th>
                                                <th className="px-3 py-3 text-right border-r border-slate-200">Descuento</th>
                                                <th className="px-3 py-3 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                                            {filteredData.map((o: any, i: number) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="px-3 py-2 text-[9px] border-r border-slate-100 text-slate-500 whitespace-nowrap">{o.fechaFormatted}</td>
                                                    <td className="px-3 py-2 text-center tabular-nums text-slate-400 border-r border-slate-100">{o.orderNumber}</td>
                                                    <td className="px-3 py-2 text-[9px] border-r border-slate-100 uppercase">{o.orderTypeLabel}</td>
                                                    <td className="px-3 py-2 text-[9px] border-r border-slate-100 uppercase truncate max-w-[150px]">{o.section}</td>
                                                    <td className="px-3 py-2 text-center tabular-nums border-r border-slate-100 text-slate-400">{o.mesa}</td>
                                                    <td className="px-3 py-2 text-[9px] border-r border-slate-100 uppercase truncate max-w-[150px]">{o.user}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums border-r border-slate-100 text-slate-500">{formatCurrency(o.total)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums border-r border-slate-100 text-slate-500">{formatCurrency(o.tip)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums border-r border-slate-100 text-slate-500">{formatCurrency(o.discount)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-teal-700 bg-teal-50/10 font-semibold">{formatCurrency(o.total + o.tip - o.discount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Resumen Footer Fijo */}
                                <div className="bg-white border-t border-slate-200 text-slate-800 font-semibold flex items-center px-3 py-3 shrink-0 uppercase tracking-widest text-[9px]">
                                    <div className="w-[150px] flex gap-2"><span className="text-slate-500 font-medium">Recuento:</span>{filteredData.length}</div>
                                    <div className="flex-1 flex justify-end items-center gap-8">
                                        <div className="flex items-center gap-2"><span className="text-slate-500 font-medium">Suma SubTotal =</span>{formatCurrency(filteredData.reduce((a, c) => a + c.total, 0))}</div>
                                        <div className="flex items-center gap-2"><span className="text-slate-500 font-medium">Suma Propina =</span>{formatCurrency(filteredData.reduce((a, c) => a + c.tip, 0))}</div>
                                        <div className="flex items-center gap-2"><span className="text-slate-500 font-medium">Suma Descuento =</span>{formatCurrency(filteredData.reduce((a, c) => a + c.discount, 0))}</div>
                                        <div className="flex items-center gap-2 text-[10px] text-teal-700"><span className="text-slate-500 font-medium">Suma Total =</span>{formatCurrency(filteredData.reduce((a, c) => a + (c.total + c.tip - c.discount), 0))}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </motion.div>
                </AnimatePresence>
            </main>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default DashboardVentasRendimiento;
