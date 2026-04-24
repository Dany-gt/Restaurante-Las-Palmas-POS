import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, Calendar, ChevronRight, Clock, ListFilter,
    FileText, Users, Landmark, CreditCard, Search,
    Smartphone, Filter, TrendingUp
} from 'lucide-react';
import { supabase } from '../../supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell, Legend, LineChart, Line,
    BarChart as RechartsBarChart, Bar as RechartsBar,
    CartesianGrid, LabelList, ComposedChart
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// --- PALETA ---
const THEME = {
    midnight: '#1a1b26',
    teal: '#0d9488',
    blue: '#3b82f6',
    amber: '#f59e0b',
    orange: '#f97316',
    rose: '#f43f5e',
    slate50: '#f8fafc',
    border: 'rgba(0,0,0,0.06)'
};

export const DashboardFacturacion: React.FC = () => {
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
    const [searchNIT, setSearchNIT] = useState('');
    const [searchClient, setSearchClient] = useState('');
    const [selectedNITs, setSelectedNITs] = useState<string[]>([]);
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState('FACTURACION');

    useEffect(() => {
        const fetchBranches = async () => {
            const { data: b } = await supabase.from('branches').select('id, name').order('name');
            if (b) setBranches(b);
        };
        fetchBranches();
        handleGenerate();
    }, []);

    // AUTO-SYNC cuando cambian fechas
    useEffect(() => {
        const timeout = setTimeout(() => {
            handleGenerate();
        }, 300); // Debounce para evitar AbortError
        return () => clearTimeout(timeout);
    }, [startDate, endDate, selectedBranch]);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            console.log('[DashboardFacturacion] Fetching invoices...', { startDate, endDate });

            // Traemos TODAS las facturas (sin filtrar por status ni series para máxima cobertura)
            let query = supabase
                .from('invoices')
                .select(`
                    id, created_at, series, document_number, uuid,
                    customer_nit, customer_name, authorization_number,
                    grand_total, status, pdf_url,
                    order:orders (id, order_number, order_type, branch_id)
                `)
                .gte('created_at', `${startDate}T00:00:00`)
                .lte('created_at', `${endDate}T23:59:59`)
                .order('created_at', { ascending: true });

            const { data: raw, error } = await query;
            if (error) throw error;

            console.log(`[DashboardFacturacion] Raw invoices fetched: ${raw?.length || 0}`);

            const mapped = (raw || [])
                .filter(inv => {
                    if (selectedBranch === 'ALL') return true;
                    return (inv.order as any)?.branch_id === selectedBranch;
                })
                .map(inv => ({
                    id: inv.id,
                    fecha: inv.created_at,
                    dateOnly: inv.created_at.split('T')[0],
                    nit: inv.customer_nit || 'CF',
                    cliente: inv.customer_name || 'CONSUMIDOR FINAL',
                    firma: inv.uuid && inv.uuid.trim() !== '' ? inv.uuid : '---',
                    dte: inv.authorization_number || '---',
                    serie: inv.series || '---',
                    numero: inv.document_number || '---',
                    noOrden: (inv.order as any)?.order_number || '---',
                    monto: Number(inv.grand_total || 0),
                    status: inv.status
                }));

            console.log(`[DashboardFacturacion] Mapped invoices: ${mapped.length}`);
            setData(mapped);
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                console.error('Error fetching invoices:', err);
            }
        } finally {
            setLoading(false);
        }
    };

    // OPCIONES ÚNICAS
    const nitOptions = useMemo(() => {
        const nits = Array.from(new Set<string>(data.map(d => d.nit))).sort();
        if (!searchNIT) return nits;
        return nits.filter(n => n.toLowerCase().includes(searchNIT.toLowerCase()));
    }, [data, searchNIT]);

    const clientOptions = useMemo(() => {
        const clients = Array.from(new Set<string>(data.map(d => d.cliente))).sort();
        if (!searchClient) return clients;
        return clients.filter(c => c.toLowerCase().includes(searchClient.toLowerCase()));
    }, [data, searchClient]);

    // FILTRADO
    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchNIT = selectedNITs.length === 0 || selectedNITs.includes(d.nit);
            const matchClient = selectedClients.length === 0 || selectedClients.includes(d.cliente);
            return matchNIT && matchClient;
        });
    }, [data, selectedNITs, selectedClients]);

    // STATS
    const stats = useMemo(() => {
        const totalMonto = filteredData.reduce((acc, c) => acc + c.monto, 0);
        const totalDTE = filteredData.length;

        // Por Día
        const dailyMap: any = {};
        filteredData.forEach(d => {
            if (!dailyMap[d.dateOnly]) dailyMap[d.dateOnly] = { date: d.dateOnly, total: 0, dte: 0 };
            dailyMap[d.dateOnly].total += d.monto;
            dailyMap[d.dateOnly].dte += 1;
        });
        const dailyTrend = Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

        // Por Mes
        const monthMap: any = {};
        filteredData.forEach(d => {
            const m = dayjs(d.fecha).format('MMMM YYYY');
            if (!monthMap[m]) monthMap[m] = { month: m, total: 0, dte: 0 };
            monthMap[m].total += d.monto;
            monthMap[m].dte += 1;
        });
        const monthlyTrend = Object.values(monthMap);

        // Top Clientes
        const clientMap: any = {};
        filteredData.forEach(d => {
            if (!clientMap[d.cliente]) clientMap[d.cliente] = { cliente: d.cliente, nit: d.nit, total: 0, facturas: 0 };
            clientMap[d.cliente].total += d.monto;
            clientMap[d.cliente].facturas += 1;
        });
        const topClients = Object.values(clientMap).sort((a: any, b: any) => b.total - a.total);

        return { totalMonto, totalDTE, dailyTrend, monthlyTrend, topClients };
    }, [filteredData]);

    const dailyGrid = useMemo(() => {
        const days: any = {};
        filteredData.forEach(d => {
            if (!days[d.dateOnly]) days[d.dateOnly] = { date: d.dateOnly, total: 0, dte: 0 };
            days[d.dateOnly].total += d.monto;
            days[d.dateOnly].dte += 1;
        });
        const list = Object.values(days).sort((a: any, b: any) => a.date.localeCompare(b.date)) as any[];
        const maxTotal = list.length > 0 ? Math.max(...list.map(l => l.total)) : 1;
        return list.map(l => ({ ...l, intensity: l.total / maxTotal }));
    }, [filteredData]);

    const formatCurrency = (val: number) => `Q${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const TABS = [
        { id: 'FACTURACION', label: 'Facturación', icon: FileText },
        { id: 'TOP_CLIENTES', label: 'Top Clientes', icon: Users },
        { id: 'FACTURACION_TOTAL', label: 'Facturación Total', icon: ListFilter }
    ];

    return (
        <div className="flex h-screen bg-[#f1f3f6] overflow-hidden font-sans text-slate-900 select-none">
            {/* --- SIDEBAR --- */}
            <motion.div
                animate={{ width: isSidebarCollapsed ? 32 : 280 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="bg-[#f8f9fa] border-r border-[#d1d5db] flex flex-col shadow-sm shrink-0 z-50 relative overflow-hidden"
            >
                <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="absolute right-0 top-10 bg-white border-y border-l border-slate-300 text-slate-500 p-1.5 rounded-l-md shadow-sm z-[60] hover:bg-slate-100 transition-all flex items-center justify-center cursor-pointer"
                    style={{ width: '24px', height: '32px' }}
                >
                    <ChevronRight size={14} className={`transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
                </button>

                {!isSidebarCollapsed && (
                    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        {/* FILTRO FECHAS */}
                        <div className="border-b border-slate-200">
                            <div className="flex items-center px-3 py-2 bg-white">
                                <h3 className="text-[10px] font-bold text-slate-700 flex items-center gap-2">
                                    <Calendar size={12} className="text-slate-400" />
                                    Filtro Fechas
                                </h3>
                            </div>
                            <div className="p-3 space-y-2">
                                <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-bold block px-1">Fecha Inicial</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-[10px] outline-none focus:border-blue-400 transition-colors" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-bold block px-1">Fecha Final</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-[10px] outline-none focus:border-blue-400 transition-colors" />
                                </div>
                            </div>
                        </div>

                        {/* FILTRO NIT */}
                        <div className="border-b border-slate-200">
                            <div className="flex items-center px-3 py-2 bg-white">
                                <h3 className="text-[10px] font-bold text-slate-700 flex items-center gap-2">
                                    <CreditCard size={12} className="text-slate-400" />
                                    Filtro NIT
                                </h3>
                            </div>
                            <div className="p-3 bg-[#f3f4f6]/50 space-y-2">
                                <div className="relative">
                                    <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchNIT}
                                        onChange={e => setSearchNIT(e.target.value)}
                                        placeholder="Introduzca texto a buscar..."
                                        className="w-full h-7 bg-white border border-slate-200 rounded pl-6 pr-2 text-[9px] outline-none focus:border-blue-400"
                                    />
                                </div>
                                <div className="max-h-[140px] overflow-y-auto space-y-1 pl-1 custom-scrollbar">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={selectedNITs.length === nitOptions.length && nitOptions.length > 0}
                                            onChange={() => setSelectedNITs(selectedNITs.length === nitOptions.length ? [] : [...nitOptions])}
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-0"
                                        />
                                        <span className="text-[10px] text-blue-600 font-bold">(Todos)</span>
                                    </label>
                                    {nitOptions.map(n => (
                                        <label key={n} className="flex items-center gap-2 cursor-pointer group pl-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedNITs.includes(n)}
                                                onChange={() => setSelectedNITs(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])}
                                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-0"
                                            />
                                            <span className="text-[10px] text-slate-600 font-medium group-hover:text-blue-600 truncate">{n}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* FILTRO CLIENTE */}
                        <div className="border-b border-slate-200">
                            <div className="flex items-center px-3 py-2 bg-white">
                                <h3 className="text-[10px] font-bold text-slate-700 flex items-center gap-2">
                                    <Users size={12} className="text-slate-400" />
                                    Filtro Nombre Cliente
                                </h3>
                            </div>
                            <div className="p-3 bg-[#f3f4f6]/50 space-y-2">
                                <div className="relative">
                                    <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchClient}
                                        onChange={e => setSearchClient(e.target.value)}
                                        placeholder="Introduzca texto a buscar..."
                                        className="w-full h-7 bg-white border border-slate-200 rounded pl-6 pr-2 text-[9px] outline-none focus:border-blue-400"
                                    />
                                </div>
                                <div className="max-h-[140px] overflow-y-auto space-y-1 pl-1 custom-scrollbar">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={selectedClients.length === clientOptions.length && clientOptions.length > 0}
                                            onChange={() => setSelectedClients(selectedClients.length === clientOptions.length ? [] : [...clientOptions])}
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-0"
                                        />
                                        <span className="text-[10px] text-blue-600 font-bold">(Todos)</span>
                                    </label>
                                    {clientOptions.map(c => (
                                        <label key={c} className="flex items-center gap-2 cursor-pointer group pl-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedClients.includes(c)}
                                                onChange={() => setSelectedClients(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-0"
                                            />
                                            <span className="text-[10px] text-slate-600 font-medium group-hover:text-blue-600 truncate">{c}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!isSidebarCollapsed && (
                    <div className="p-3 bg-white border-t border-slate-200">
                        <button
                            onClick={handleGenerate}
                            className="w-full h-9 bg-[#1a1b26] text-white rounded flex items-center justify-center gap-2 font-bold uppercase tracking-widest shadow-sm active:scale-95 transition-all text-[9px] hover:bg-[#106ebe]"
                        >
                            {loading ? <Loader2 size={12} className="animate-spin" /> : 'Sincronizar Datos'}
                        </button>
                    </div>
                )}
            </motion.div>

            {/* --- CONTENIDO PRINCIPAL --- */}
            <main className="flex-1 overflow-y-auto bg-[#f1f3f6] p-4 pb-64 custom-scrollbar scroll-smooth">
                {/* TÍTULO */}
                <div className="text-center mb-4">
                    <h1 className="text-[14px] font-black text-slate-800 uppercase tracking-widest">Facturación</h1>
                </div>

                {/* TABS */}
                <div className="flex items-center gap-1 mb-6 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit sticky top-0 z-10 mx-auto">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-[#1a1b26] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <tab.icon size={13} className={activeTab === tab.id ? 'text-teal-400' : 'text-slate-400'} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-6"
                    >
                        {/* === PESTAÑA 1: FACTURACIÓN === */}
                        {activeTab === 'FACTURACION' && (
                            <div className="space-y-6">
                                {/* KPI Cards */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Gran Total Facturado</p>
                                        <p className="text-2xl font-black text-teal-600 tabular-nums">{formatCurrency(stats.totalMonto)}</p>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total DTE Emitidos</p>
                                        <p className="text-2xl font-black text-orange-500 tabular-nums">{stats.totalDTE}</p>
                                    </div>
                                </div>

                                {/* Facturación Por Día */}
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Facturación Por Día</h3>
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-teal-500 rounded-sm" /> <span className="text-[9px] font-bold text-slate-500">Total</span></div>
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-sm" /> <span className="text-[9px] font-bold text-slate-500">Cantidad de DTE</span></div>
                                        </div>
                                    </div>
                                    <div className="h-[300px] p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={stats.dailyTrend} margin={{ top: 20, right: 50, left: 10, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} tickFormatter={(v) => dayjs(v).format('DD/MM')} />
                                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '10px' }} formatter={(v: any, name: string) => [name === 'total' ? formatCurrency(v) : v, name === 'total' ? 'Total' : 'DTE']} />
                                                <Area yAxisId="left" type="monotone" dataKey="total" fill="#99f6e4" stroke="#0d9488" strokeWidth={2} fillOpacity={0.3}>
                                                    <LabelList dataKey="total" position="top" offset={10} style={{ fontSize: '8px', fontWeight: 'bold', fill: '#0d9488' }} formatter={(v: any) => v > 0 ? formatCurrency(v) : ''} />
                                                </Area>
                                                <Line yAxisId="right" type="monotone" dataKey="dte" stroke="#f97316" strokeWidth={2} dot={{ r: 4, fill: '#f97316' }}>
                                                    <LabelList dataKey="dte" position="top" offset={10} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#f97316' }} />
                                                </Line>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Análisis por Mes + Resumen por Día */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Análisis Por Mes</h3>
                                        </div>
                                        <div className="h-[280px] p-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={stats.monthlyTrend} margin={{ top: 20, right: 50, left: 10, bottom: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                                    <RechartsBar yAxisId="left" dataKey="total" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={40}>
                                                        <LabelList dataKey="total" position="top" offset={10} style={{ fontSize: '8px', fontWeight: 'bold', fill: '#0d9488' }} formatter={(v: any) => formatCurrency(v)} />
                                                    </RechartsBar>
                                                    <Line yAxisId="right" type="monotone" dataKey="dte" stroke="#f97316" strokeWidth={2} dot={{ r: 4, fill: '#f97316' }}>
                                                        <LabelList dataKey="dte" position="top" offset={10} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#f97316' }} />
                                                    </Line>
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Resumen Por Día (tabla pequeña) */}
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Resumen Por Día</h3>
                                        </div>
                                        <div className="overflow-y-auto max-h-[300px] custom-scrollbar">
                                            <table className="w-full text-[9px]">
                                                <thead className="sticky top-0 bg-white">
                                                    <tr className="border-b border-slate-200 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                                        <th className="px-3 py-2 text-left">Fecha</th>
                                                        <th className="px-3 py-2 text-right">Gran Total</th>
                                                        <th className="px-3 py-2 text-right">DTE</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {dailyGrid.map((day: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-3 py-1.5 text-slate-500 font-bold">{dayjs(day.date).format('DD/MM/YYYY')}</td>
                                                            <td className="px-3 py-1.5 text-right font-bold text-teal-600 tabular-nums">{formatCurrency(day.total)}</td>
                                                            <td className="px-3 py-1.5 text-right font-bold text-orange-500 tabular-nums"
                                                                style={{ backgroundColor: `rgba(249, 115, 22, ${0.05 + (day.intensity || 0) * 0.12})` }}
                                                            >{day.dte}</td>
                                                        </tr>
                                                    ))}
                                                    <tr className="bg-[#106ebe] text-white font-black text-[10px]">
                                                        <td className="px-3 py-2 uppercase tracking-tighter">Gran Total</td>
                                                        <td className="px-3 py-2 text-right tabular-nums text-teal-400">{formatCurrency(stats.totalMonto)}</td>
                                                        <td className="px-3 py-2 text-right tabular-nums text-orange-400">{stats.totalDTE}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === PESTAÑA 2: TOP CLIENTES === */}
                        {activeTab === 'TOP_CLIENTES' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Tabla Top Clientes */}
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Ranking de Clientes</h3>
                                        </div>
                                        <div className="overflow-y-auto max-h-[500px] custom-scrollbar">
                                            <table className="w-full text-[10px]">
                                                <thead className="sticky top-0 bg-[#f8f9fa]">
                                                    <tr className="border-b border-slate-200 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                                        <th className="px-4 py-2 text-left">#</th>
                                                        <th className="px-4 py-2 text-left">Cliente</th>
                                                        <th className="px-4 py-2 text-left">NIT</th>
                                                        <th className="px-4 py-2 text-right">Facturas</th>
                                                        <th className="px-4 py-2 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                                                    {(stats.topClients as any[]).map((c: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-2 text-slate-400 font-black">{idx + 1}</td>
                                                            <td className="px-4 py-2 uppercase text-[9px] tracking-tight max-w-[200px] truncate">{c.cliente}</td>
                                                            <td className="px-4 py-2 text-slate-400 tabular-nums">{c.nit}</td>
                                                            <td className="px-4 py-2 text-right text-orange-500 tabular-nums">{c.facturas}</td>
                                                            <td className="px-4 py-2 text-right text-teal-600 tabular-nums font-black">{formatCurrency(c.total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Gráfico de Dona: Participación */}
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm flex flex-col">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Distribución Por Cliente</h3>
                                        </div>
                                        <div className="flex-1 min-h-[400px] flex items-center justify-center p-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={(stats.topClients as any[]).slice(0, 8)}
                                                        cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={3} dataKey="total"
                                                        isAnimationActive={false}
                                                        label={({ percent }) => `${((percent as number) * 100).toFixed(0)}%`}
                                                    >
                                                        {(stats.topClients as any[]).slice(0, 8).map((_: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={['#0d9488', '#0ea5e9', '#6366f1', '#8b5cf6', '#f97316', '#f43f5e', '#eab308', '#64748b'][index % 8]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                                                    <Legend verticalAlign="bottom" height={36} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === PESTAÑA 3: FACTURACIÓN TOTAL === */}
                        {activeTab === 'FACTURACION_TOTAL' && (
                            <div className="flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
                                <div className="bg-white rounded-t-xl border border-slate-200 border-b-0 overflow-hidden shadow-sm flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-[10px] border-collapse min-w-[900px]">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-[#f8f9fa] border-b border-slate-200 font-black text-slate-500 uppercase tracking-widest text-[8px]">
                                                <th className="px-3 py-3 text-left border-r border-slate-200">Fecha</th>
                                                <th className="px-3 py-3 text-left border-r border-slate-200">NIT</th>
                                                <th className="px-3 py-3 text-left border-r border-slate-200">Cliente</th>
                                                <th className="px-3 py-3 text-left border-r border-slate-200">Firma</th>
                                                <th className="px-3 py-3 text-center border-r border-slate-200">Serie</th>
                                                <th className="px-3 py-3 text-center border-r border-slate-200">Número</th>
                                                <th className="px-3 py-3 text-center border-r border-slate-200">No. DTE</th>
                                                <th className="px-3 py-3 text-right bg-teal-50/50">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="font-bold text-slate-600 divide-y divide-slate-100">
                                            {filteredData.map((inv: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-3 py-2 text-slate-500 border-r border-slate-100 text-[9px] whitespace-nowrap">{dayjs(inv.fecha).format('DD/MM/YYYY')}</td>
                                                    <td className="px-3 py-2 border-r border-slate-100 tabular-nums text-slate-400">{inv.nit}</td>
                                                    <td className="px-3 py-2 border-r border-slate-100 uppercase text-[9px] max-w-[180px] truncate">{inv.cliente}</td>
                                                    <td className="px-3 py-2 border-r border-slate-100 text-[8px] text-slate-400 max-w-[120px] truncate tabular-nums">{inv.firma}</td>
                                                    <td className="px-3 py-2 text-center border-r border-slate-100 text-slate-400">{inv.serie}</td>
                                                    <td className="px-3 py-2 text-center border-r border-slate-100 tabular-nums">{inv.numero}</td>
                                                    <td className="px-3 py-2 text-center border-r border-slate-100 tabular-nums text-orange-500">{inv.dte}</td>
                                                    <td className="px-3 py-2 text-right font-black tabular-nums text-teal-700">{formatCurrency(inv.monto)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* FOOTER FIJO */}
                                <div className="bg-[#106ebe] rounded-b-xl border border-slate-700 flex text-white font-black text-[10px] shrink-0">
                                    <div className="flex-1 px-3 py-3 uppercase tracking-tighter">Gran Total Periodo</div>
                                    <div className="px-3 py-3 text-center tabular-nums text-orange-400 border-l border-slate-700" style={{ minWidth: '80px' }}>Suma = {stats.totalDTE}</div>
                                    <div className="px-3 py-3 text-right tabular-nums text-white bg-[#1a1b26] border-l border-slate-700 rounded-br-xl" style={{ minWidth: '120px' }}>Suma = {formatCurrency(stats.totalMonto)}</div>
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

export default DashboardFacturacion;
