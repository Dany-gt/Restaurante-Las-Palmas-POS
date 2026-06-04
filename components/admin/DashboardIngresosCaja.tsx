import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Loader2, BarChart3, Download, Printer,
    Calendar, Filter, Wallet, CreditCard, Landmark,
    TrendingUp, ArrowUpRight, ChevronRight, LayoutDashboard,
    Clock, Smartphone, Navigation, ListFilter
}
    from 'lucide-react';
import { supabase } from '../../supabase';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell, Legend, LineChart, Line, BarChart as RechartsBarChart, Bar as RechartsBar,
    CartesianGrid, LabelList
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { MobileTableCard } from './MobileTableCard';

// --- PALETA DE COLORES FINTECH ---
const THEME = {
    midnight: '#1a1b26',
    emerald: '#10b981',
    blue: '#3b82f6',
    amber: '#f59e0b',
    rose: '#f43f5e',
    slate50: '#f8fafc',
    border: 'rgba(0,0,0,0.06)'
};

const CHART_COLORS = [THEME.emerald, THEME.blue, THEME.amber, THEME.rose, THEME.midnight];

export const DashboardIngresosCaja: React.FC = () => {
    // ACTIVAR ESPAÑOL PARA FECHAS
    dayjs.locale('es');

    // ESTADOS DE FILTRO
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const getISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(getISO(firstDay));
    const [endDate, setEndDate] = useState(getISO(now));
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [data, setData] = useState<any[]>([]);

    // FILTROS AVANZADOS BI
    const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
    const [selectedRegisters, setSelectedRegisters] = useState<string[]>([]);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        const fetchBranches = async () => {
            const { data: b } = await supabase.from('branches').select('id, name').order('name');
            if (b) setBranches(b);
        };
        fetchBranches();
        // handleGenerate();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // AUTO-GENERAR CUANDO CAMBIAN FILTROS DE FECHA O SEDE
    useEffect(() => {
        // handleGenerate();
    }, [startDate, endDate, selectedBranch]);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const startStr = `${startDate}T00:00:00`;
            const endStr = `${endDate}T23:59:59`;

            // BUSCAMOS ÓRDENES PAGADAS O COMPLETADAS (Soporte Multi-Estado)
            let query = supabase.from('orders')
                .select(`
                    id, created_at, order_number, customer_name, total, 
                    payment_method, order_type, status, branch_id,
                    shift:shifts!shift_id(shift_number, cash_registers(name))
                `)
                .or('status.eq.completed,status.eq.finalizada,status.eq.PAID,status.eq.FINALIZADA')
                .gte('created_at', startStr)
                .lte('created_at', endStr)
                .order('created_at', { ascending: true });

            if (selectedBranch !== 'ALL') query = query.eq('branch_id', selectedBranch);

            const { data: rawOrders, error } = await query;
            if (error) throw error;

            const processed = (rawOrders || []).map(o => {
                const method = (o.payment_method || 'EFECTIVO').toUpperCase();
                const totalValue = Number(o.total || 0);
                const shiftData = Array.isArray(o.shift) ? o.shift[0] : o.shift;
                const registerName = (shiftData as any)?.cash_registers?.name || 'PRINCIPAL';

                return {
                    id: o.id,
                    ingreso: o.created_at,
                    dateOnly: o.created_at.split('T')[0],
                    noOrden: o.order_number,
                    metodo: method,
                    caja: registerName,
                    turno: (shiftData as any)?.shift_number || '1',
                    efectivo: method === 'EFECTIVO' ? totalValue : 0,
                    tarjeta: method.includes('TARJETA') ? totalValue : 0,
                    credito: (method.includes('CREDITO') || method.includes('CRÉDITO')) ? totalValue : 0,
                    otros: (!['EFECTIVO'].includes(method) && !method.includes('TARJETA') && !method.includes('CREDIT')) ? totalValue : 0,
                    total: totalValue
                };
            });
            setData(processed);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const [activeTab, setActiveTab] = useState('DIAS_HORAS');

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchSearch = d.noOrden?.toString().includes(searchTerm) || d.caja?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchShift = selectedShifts.length === 0 || selectedShifts.includes(d.turno.toString());
            const matchRegister = selectedRegisters.length === 0 || selectedRegisters.includes(d.caja);
            return matchSearch && matchShift && matchRegister;
        });
    }, [data, searchTerm, selectedShifts, selectedRegisters]);

    const stats = useMemo(() => {
        const total = filteredData.reduce((acc, c) => acc + c.total, 0);
        const cash = filteredData.reduce((acc, c) => acc + c.efectivo, 0);
        const card = filteredData.reduce((acc, c) => acc + c.tarjeta, 0);
        const other = filteredData.reduce((acc, c) => acc + (c.credito + c.otros), 0);

        // 1. Participación (Métodos de Pago)
        const methodsParticipation = [
            { name: 'EFECTIVO', value: cash, color: THEME.emerald },
            { name: 'TARJETA', value: card, color: THEME.blue },
            { name: 'OTROS/CRED', value: other, color: THEME.amber }
        ].filter(v => v.value > 0);

        // Distribución por Cajas
        const cajasMap: any = {};
        filteredData.forEach(d => {
            cajasMap[d.caja] = (cajasMap[d.caja] || 0) + d.total;
        });
        const cajasParticipation = Object.entries(cajasMap).map(([name, value]) => ({
            name,
            value: value as number
        }));

        // 2. Lógica por Horas
        const hourMap: any = {};
        for (let i = 0; i < 24; i++) hourMap[i.toString().padStart(2, '0')] = { hour: `${i}:00`, total: 0, cash: 0, card: 0, other: 0 };
        filteredData.forEach(d => {
            const h = dayjs(d.ingreso).format('HH');
            if (hourMap[h]) {
                hourMap[h].total += d.total;
                hourMap[h].cash += d.efectivo;
                hourMap[h].card += d.tarjeta;
                hourMap[h].other += (d.credito + d.otros);
            }
        });
        const hourlyData = Object.values(hourMap);

        // 3. Lógica por Día de la Semana
        const weekdayMap: any = { 0: 'DOM', 1: 'LUN', 2: 'MAR', 3: 'MIE', 4: 'JUE', 5: 'VIE', 6: 'SAB' };
        const weekData = [0, 1, 2, 3, 4, 5, 6].map(i => ({
            day: weekdayMap[i],
            total: 0,
            cash: 0,
            card: 0,
            other: 0
        }));
        filteredData.forEach(d => {
            const dayIdx = dayjs(d.ingreso).day();
            weekData[dayIdx].total += d.total;
            weekData[dayIdx].cash += d.efectivo;
            weekData[dayIdx].card += d.tarjeta;
            weekData[dayIdx].other += (d.credito + d.otros);
        });

        // 4. Lógica Diaria Trends
        const dailyMap: any = {};
        filteredData.forEach(d => {
            if (!dailyMap[d.dateOnly]) dailyMap[d.dateOnly] = {
                date: d.dateOnly,
                dayNum: dayjs(d.ingreso).date(),
                total: 0,
                cash: 0,
                card: 0,
                credit: 0,
                other: 0
            };
            dailyMap[d.dateOnly].total += d.total;
            dailyMap[d.dateOnly].cash += d.efectivo;
            dailyMap[d.dateOnly].card += d.tarjeta;
            dailyMap[d.dateOnly].credit += d.credito;
            dailyMap[d.dateOnly].other += d.otros;
        });
        const dailyTrend = Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

        return { total, cash, card, other, methodsParticipation, cajasParticipation, hourlyData, weekData, dailyTrend };
    }, [filteredData]);

    const dailyGrid = useMemo(() => {
        const days: any = {};
        filteredData.forEach(d => {
            if (!days[d.dateOnly]) days[d.dateOnly] = { date: d.dateOnly, total: 0, cash: 0, card: 0, credit: 0, other: 0 };
            days[d.dateOnly].total += d.total;
            days[d.dateOnly].cash += d.efectivo;
            days[d.dateOnly].card += d.tarjeta;
            days[d.dateOnly].credit += d.credito;
            days[d.dateOnly].other += d.otros;
        });
        const list = Object.values(days).sort((a: any, b: any) => a.date.localeCompare(b.date)) as any[];
        const maxTotal = list.length > 0 ? Math.max(...list.map(l => l.total)) : 1;
        return list.map(l => ({ ...l, intensity: l.total / maxTotal }));
    }, [filteredData]);

    const formatCurrency = (val: number) => `Q${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // OPCIONES ÚNICAS PARA SIDEBAR
    const shiftOptions = useMemo(() => Array.from(new Set(data.map(d => d.turno.toString()))).sort(), [data]);
    const registerOptions = useMemo(() => Array.from(new Set(data.map(d => d.caja))).sort(), [data]);

    const TABS = [
        { id: 'DIAS_HORAS', label: 'Días - Horas', icon: Clock },
        { id: 'DIAS_MES', label: 'Días del Mes', icon: Calendar },
        { id: 'PARTICIPACION', label: 'Participación', icon: PieChart },
        { id: 'TOTALES', label: 'Total de Ingresos', icon: ListFilter }
    ];

    return (
        <div className="flex h-screen bg-[#f1f3f6] overflow-hidden font-sans text-slate-900 select-none">
            <motion.div
                animate={{ width: isMobile ? 0 : (isSidebarCollapsed ? 32 : 260) }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className={`bg-[#f8f9fa] border-r border-[#d1d5db] flex flex-col shadow-sm shrink-0 z-50 relative overflow-hidden ${isMobile ? 'hidden' : ''}`}
            >
                {/* Botón de Colapso (SIEMPRE VISIBLE Y CENTRADO) */}
                <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="absolute right-0 top-10 bg-white border-y border-l border-slate-300 text-slate-500 p-1.5 rounded-l-md shadow-sm z-[60] hover:bg-slate-100 transition-all flex items-center justify-center cursor-pointer"
                    style={{ width: '24px', height: '32px' }}
                >
                    <ChevronRight size={14} className={`transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
                </button>

                {!isSidebarCollapsed && (
                    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        {/* SECCIÓN: FILTRO FECHAS */}
                        <div className="border-b border-slate-200">
                            <div className="flex items-center justify-between px-3 py-2 bg-white">
                                <h3 className="text-[10px] font-medium text-slate-700 flex items-center gap-2">
                                    <Calendar size={12} className="text-slate-400" />
                                    Filtro Fechas
                                </h3>
                            </div>
                            <div className="p-3 space-y-2">
                                <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-medium block px-1">Fecha Inicial</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-[10px] outline-none focus:border-blue-400 transition-colors" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-medium block px-1">Fecha Final</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full h-8 bg-white border border-slate-200 rounded px-2 text-[10px] outline-none focus:border-blue-400 transition-colors" />
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN: FILTRO TURNOS */}
                        <div className="border-b border-slate-200">
                            <div className="flex items-center justify-between px-3 py-2 bg-white">
                                <h3 className="text-[10px] font-medium text-slate-700 flex items-center gap-2">
                                    <Clock size={12} className="text-slate-400" />
                                    Filtro Turnos
                                </h3>
                            </div>
                            <div className="p-3 bg-[#f3f4f6]/50">
                                <div className="space-y-1.5 pl-1">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={selectedShifts.length === shiftOptions.length}
                                            onChange={() => setSelectedShifts(selectedShifts.length === shiftOptions.length ? [] : [...shiftOptions])}
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-0"
                                        />
                                        <span className="text-[10px] text-slate-600 font-medium group-hover:text-blue-600">(Todos)</span>
                                    </label>
                                    {shiftOptions.map(s => (
                                        <label key={s} className="flex items-center gap-2 cursor-pointer group pl-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedShifts.includes(s)}
                                                onChange={() => setSelectedShifts(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-0"
                                            />
                                            <span className="text-[10px] text-slate-600 font-medium group-hover:text-blue-600 uppercase">TURNO {s}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN: FILTRO CAJAS */}
                        <div className="border-b border-slate-200">
                            <div className="flex items-center justify-between px-3 py-2 bg-white">
                                <h3 className="text-[10px] font-medium text-slate-700 flex items-center gap-2">
                                    <Smartphone size={12} className="text-slate-400" />
                                    Filtro Cajas
                                </h3>
                            </div>
                            <div className="p-3 bg-[#f3f4f6]/50">
                                <div className="space-y-1.5 pl-1">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={selectedRegisters.length === registerOptions.length}
                                            onChange={() => setSelectedRegisters(selectedRegisters.length === registerOptions.length ? [] : [...registerOptions])}
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-0"
                                        />
                                        <span className="text-[10px] text-slate-600 font-medium group-hover:text-blue-600">(Todos)</span>
                                    </label>
                                    {registerOptions.map(r => (
                                        <label key={r} className="flex items-center gap-2 cursor-pointer group pl-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedRegisters.includes(r)}
                                                onChange={() => setSelectedRegisters(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-0"
                                            />
                                            <span className="text-[10px] text-slate-600 font-medium group-hover:text-blue-600 uppercase truncate pr-2">{r}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* FOOTER DE BOTÓN (SOLO EXPANDIDO) */}
                {!isSidebarCollapsed && (
                    <div className="p-3 bg-white border-t border-slate-200">
                        <button
                            onClick={handleGenerate}
                            className="w-full h-9 bg-[#1a1b26] text-white rounded flex items-center justify-center gap-2 font-medium uppercase tracking-widest shadow-sm active:scale-95 transition-all text-[9px] hover:bg-[#106ebe]"
                        >
                            {loading ? <Loader2 size={12} className="animate-spin" /> : 'Sincronizar Datos'}
                        </button>
                    </div>
                )}
            </motion.div>

            {/* --- CONTENIDO PRINCIPAL --- */}
            <main className="flex-1 overflow-y-auto bg-[#f1f3f6] p-4 pb-64 custom-scrollbar scroll-smooth">
                {/* --- TAB NAVIGATION --- */}
                <div className="flex items-center gap-1 mb-6 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-full admin-tabs-scroll sticky top-0 z-10">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-[#1a1b26] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <tab.icon size={13} className={activeTab === tab.id ? 'text-emerald-400' : 'text-slate-400'} />
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
                        className="space-y-8"
                    >
                        {activeTab === 'DIAS_HORAS' && (
                            <div className="space-y-6">
                                <div className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                    <table className="w-full text-center border-collapse">
                                        <thead>
                                            <tr className="bg-[#f8f9fa] text-[8px] font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                                                <th className="py-2.5 border-r border-slate-200">Total Ingresos</th>
                                                <th className="py-2.5 border-r border-slate-200">Venta Efectivo</th>
                                                <th className="py-2.5 border-r border-slate-200">Venta Tarjeta</th>
                                                <th className="py-2.5">Otros / Crédito</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="text-xs font-semibold text-slate-700">
                                                <td className="py-2.5 border-r border-slate-200 text-emerald-600 font-mono">{formatCurrency(stats.total)}</td>
                                                <td className="py-2.5 border-r border-slate-200 text-[#b91c1c] font-mono">{formatCurrency(stats.cash)}</td>
                                                <td className="py-2.5 border-r border-slate-200 text-[#7c3aed] font-mono">{formatCurrency(stats.card)}</td>
                                                <td className="py-2.5 text-[#0369a1] font-mono">{formatCurrency(stats.other)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                            <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Ingresos Por Hora</h3>
                                            <div className="flex gap-4">
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#b91c1c] rounded-sm" /> <span className="text-[9px] font-medium text-slate-500">Efectivo</span></div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#7c3aed] rounded-sm" /> <span className="text-[9px] font-medium text-slate-500">Tarjeta</span></div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#0369a1] rounded-sm" /> <span className="text-[9px] font-medium text-slate-500">Otros</span></div>
                                            </div>
                                        </div>
                                        <div className="h-[280px] p-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={stats.hourlyData} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '10px' }} />
                                                    <Line name="Efectivo" type="monotone" dataKey="cash" stroke="#b91c1c" strokeWidth={2} dot={{ r: 4, fill: '#b91c1c' }} activeDot={{ r: 6 }}>
                                                        <LabelList dataKey="cash" position="top" offset={10} style={{ fontSize: '8px', fontWeight: 'bold', fill: '#b91c1c' }} formatter={(v: any) => v > 0 ? `Q${v.toLocaleString()}` : ''} />
                                                    </Line>
                                                    <Line name="Tarjeta" type="monotone" dataKey="card" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4, fill: '#7c3aed' }}>
                                                        <LabelList dataKey="card" position="top" offset={10} style={{ fontSize: '8px', fontWeight: 'bold', fill: '#7c3aed' }} formatter={(v: any) => v > 0 ? `Q${v.toLocaleString()}` : ''} />
                                                    </Line>
                                                    <Line name="Otros" type="monotone" dataKey="other" stroke="#0369a1" strokeWidth={2} dot={{ r: 4, fill: '#0369a1' }}>
                                                        <LabelList dataKey="other" position="top" offset={10} style={{ fontSize: '8px', fontWeight: 'bold', fill: '#0369a1' }} formatter={(v: any) => v > 0 ? `Q${v.toLocaleString()}` : ''} />
                                                    </Line>
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                            <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Ingresos Por Día</h3>
                                            <div className="flex gap-4">
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#b91c1c] rounded-sm" /> <span className="text-[9px] font-medium text-slate-500">Efectivo</span></div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#7c3aed] rounded-sm" /> <span className="text-[9px] font-medium text-slate-500">Tarjeta</span></div>
                                            </div>
                                        </div>
                                        <div className="h-[280px] p-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={stats.weekData} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                                    <Line name="Efectivo" type="monotone" dataKey="cash" stroke="#b91c1c" strokeWidth={2} dot={{ r: 4, fill: '#b91c1c' }}>
                                                        <LabelList dataKey="cash" position="top" offset={10} style={{ fontSize: '8px', fontWeight: 'bold', fill: '#b91c1c' }} formatter={(v: any) => v > 0 ? `Q${v.toLocaleString()}` : ''} />
                                                    </Line>
                                                    <Line name="Tarjeta" type="monotone" dataKey="card" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4, fill: '#7c3aed' }}>
                                                        <LabelList dataKey="card" position="top" offset={10} style={{ fontSize: '8px', fontWeight: 'bold', fill: '#7c3aed' }} formatter={(v: any) => v > 0 ? `Q${v.toLocaleString()}` : ''} />
                                                    </Line>
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'DIAS_MES' && (
                            <div className="space-y-6">
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Total Por Día</h3>
                                    </div>
                                    <div className="h-[280px] p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsBarChart data={stats.dailyTrend} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="dayNum" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} labelFormatter={(v, items) => items[0]?.payload?.date || ''} />
                                                <RechartsBar dataKey="total" fill="#588191" radius={[4, 4, 0, 0]} barSize={20}>
                                                    <LabelList dataKey="total" position="top" offset={10} style={{ fontSize: '8px', fontWeight: 'bold', fill: '#588191' }} formatter={(v: any) => v > 0 ? `Q${v.toLocaleString()}` : ''} />
                                                </RechartsBar>
                                            </RechartsBarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Desglose Por Día</h3>
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#b91c1c] rounded-sm" /> <span className="text-[9px] font-medium text-slate-500">Efectivo</span></div>
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#7c3aed] rounded-sm" /> <span className="text-[9px] font-medium text-slate-500">Tarjeta</span></div>
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#0369a1] rounded-sm" /> <span className="text-[9px] font-medium text-slate-500">Crédito</span></div>
                                        </div>
                                    </div>
                                    <div className="h-[320px] p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={stats.dailyTrend} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="dayNum" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                                <Line name="Efectivo" type="monotone" dataKey="cash" stroke="#b91c1c" strokeWidth={2} dot={{ r: 3 }}>
                                                    <LabelList dataKey="cash" position="top" offset={8} style={{ fontSize: '7px', fontWeight: 'bold', fill: '#b91c1c' }} formatter={(v: any) => v > 0 ? `Q${v.toLocaleString()}` : ''} />
                                                </Line>
                                                <Line name="Tarjeta" type="monotone" dataKey="card" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }}>
                                                    <LabelList dataKey="card" position="top" offset={8} style={{ fontSize: '7px', fontWeight: 'bold', fill: '#7c3aed' }} formatter={(v: any) => v > 0 ? `Q${v.toLocaleString()}` : ''} />
                                                </Line>
                                                <Line name="Crédito" type="monotone" dataKey="credit" stroke="#0369a1" strokeWidth={2} dot={{ r: 3 }}>
                                                    <LabelList dataKey="credit" position="top" offset={8} style={{ fontSize: '7px', fontWeight: 'bold', fill: '#0369a1' }} formatter={(v: any) => v > 0 ? `Q${v.toLocaleString()}` : ''} />
                                                </Line>
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'PARTICIPACION' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm flex flex-col">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Participación Por Método de Pago</h3>
                                    </div>
                                    <div className="flex-1 min-h-[400px] flex items-center justify-center p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={stats.methodsParticipation}
                                                    cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value"
                                                    isAnimationActive={false}
                                                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                                >
                                                    {stats.methodsParticipation.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm flex flex-col">
                                    <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200">
                                        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Distribución Por Caja / Usuario</h3>
                                    </div>
                                    <div className="flex-1 min-h-[400px] flex items-center justify-center p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={stats.cajasParticipation}
                                                    cx="50%" cy="50%" innerRadius={0} outerRadius={100} dataKey="value"
                                                    isAnimationActive={false}
                                                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                                >
                                                    {stats.cajasParticipation.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={[`#0c4a6e`, `#0369a1`, `#0ea5e9`, `#38bdf8`, `#7dd3fc`][index % 5]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'TOTALES' && (
                            <div className="space-y-4">
                                <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm ${isMobile ? 'border-none shadow-none bg-transparent' : ''}`}>
                                    {isMobile ? (
                                        <div className="stacked-card-grid">
                                            {dailyGrid.map((day: any, idx: number) => (
                                                <MobileTableCard
                                                    key={idx}
                                                    title={dayjs(day.date).format('dddd, DD [de] MMM')}
                                                    value={formatCurrency(day.total)}
                                                    hasActivity={day.total > 0}
                                                    details={[
                                                        { label: 'Efectivo', value: formatCurrency(day.cash), color: 'text-emerald-600' },
                                                        { label: 'Tarjeta', value: formatCurrency(day.card), color: 'text-blue-600' },
                                                        { label: 'Crédito', value: formatCurrency(day.credit), color: 'text-amber-600' },
                                                        { label: 'Otros', value: formatCurrency(day.other) }
                                                    ]}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <table className="w-full text-[10px] border-collapse">
                                            <thead>
                                                <tr className="bg-[#f8f9fa] border-b border-slate-200 font-semibold text-slate-500 uppercase tracking-widest text-[8px]">
                                                    <th className="px-4 py-3 text-left border-r border-slate-200">Fecha</th>
                                                    <th className="px-4 py-3 text-right border-r border-slate-200">Crédito</th>
                                                    <th className="px-4 py-3 text-right border-r border-slate-200">Efectivo</th>
                                                    <th className="px-4 py-3 text-right border-r border-slate-200">Otros</th>
                                                    <th className="px-4 py-3 text-right border-r border-slate-200">Tarjeta</th>
                                                    <th className="px-4 py-3 text-right bg-orange-50/50">Ingreso Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="font-medium text-slate-600 divide-y divide-slate-100">
                                                {/* FILA DE GRAN TOTAL */}
                                                <tr className="bg-[#106ebe] text-white font-semibold text-[11px] shadow-sm">
                                                    <td className="px-4 py-3 border-r border-slate-700 uppercase tracking-tighter">Gran Total Periodo</td>
                                                    <td className="px-4 py-3 text-right border-r border-slate-700 tabular-nums text-amber-400">Q{(stats.other || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-3 text-right border-r border-slate-700 tabular-nums text-emerald-400">Q{(stats.cash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-3 text-right border-r border-slate-700 tabular-nums text-slate-400">Q0.00</td>
                                                    <td className="px-4 py-3 text-right border-r border-slate-700 tabular-nums text-blue-400">Q{(stats.card || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-3 text-right bg-[#1a1b26] border-l border-slate-800 tabular-nums text-white">Q{(stats.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                                {/* FILAS DIARIAS */}
                                                {dailyGrid.map((day: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-4 py-2 text-slate-500 border-r border-slate-100 uppercase font-semibold text-[8px] tracking-tighter">
                                                            {dayjs(day.date).format('dddd, DD [de] MMMM YYYY')}
                                                        </td>
                                                        <td className="px-4 py-2 text-right border-r border-slate-100 tabular-nums text-slate-400">Q{day.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-4 py-2 text-right border-r border-slate-100 tabular-nums text-emerald-600">Q{day.cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-4 py-2 text-right border-r border-slate-100 tabular-nums text-slate-300">Q{day.other.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-4 py-2 text-right border-r border-slate-100 tabular-nums text-blue-600">Q{day.card.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                        <td
                                                            className="px-4 py-2 text-right font-semibold tabular-nums transition-all border-l border-slate-100 text-[#c2410c]"
                                                            style={{
                                                                backgroundColor: `rgba(249, 115, 22, ${0.05 + (day.intensity || 0) * 0.12})`
                                                            }}
                                                        >
                                                            Q{day.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
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

export default DashboardIngresosCaja;
