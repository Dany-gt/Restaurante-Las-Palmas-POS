import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Tag, Layers, FileText, ArrowDownRight, AlertCircle, Calendar, RefreshCw } from 'lucide-react';
import { supabase } from '../../supabase';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Legend, LabelList } from 'recharts';
import dayjs from 'dayjs';

const PIE_COLORS = ['bg-rose-600', 'bg-orange-500', 'bg-indigo-600', 'bg-emerald-600', 'bg-blue-600', 'bg-violet-600'];

const KPICard = ({ label, value, trend, negative, showTrend = true }: any) => (
    <div className="admin-card p-4 md:p-5 rounded-[1.2rem] md:rounded-[1.5rem] border border-slate-200 shadow-sm active:scale-[0.98] transition-all bg-white relative overflow-hidden">
        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest block mb-0.5">{label}</span>
        <span className="text-base md:text-lg font-semibold tracking-tighter text-slate-800 leading-none">{value}</span>
        {showTrend && (
            <div className={`mt-4 flex items-center gap-1.5 text-[9px] md:text-[10px] font-semibold w-fit px-2 py-0.5 rounded-full ${negative ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                <ArrowDownRight size={12} className={negative ? '' : 'rotate-180'} /> {trend}
            </div>
        )}
    </div>
);

const ExpenseBar = ({ label, amount, percentage, color }: any) => (
    <div className="space-y-2.5">
        <div className="flex justify-between text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.05em] md:tracking-widest flex-col sm:flex-row gap-0.5 sm:gap-0">
            <span className="text-slate-400">{label}</span>
            <span className="text-slate-800">{amount} <span className="text-indigo-500">({percentage}%)</span></span>
        </div>
        <div className="h-2.5 md:h-3 bg-slate-100/50 rounded-full overflow-hidden shadow-inner">
            <div className={`h-full ${color} rounded-full transition-all duration-1000 shadow-lg`} style={{ width: `${percentage}%` }}></div>
        </div>
    </div>
);

const DashboardExpenses: React.FC = () => {
    const getISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState(getISO(firstDay));
    const [endDate, setEndDate] = useState(getISO(today));

    // Default to ALL for explicit branch filtering
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState('ALL');
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState('GASTOS');
    const [rawExpenses, setRawExpenses] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            const { data: bData } = await supabase.from('branches').select('id, name').order('name');
            if (bData) setBranches(bData);
        };
        load();
        // handleGenerate();
    }, []);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            // 1. Query Direct Expenses
            let query = supabase
                .from('expenses')
                .select(`
                    id, amount, description, category, created_at, is_void, branch_id, expense_number,
                    cash_registers:cash_register_id(name),
                    profiles:cashier_id(name)
                `)
                .eq('is_void', false)
                .gte('created_at', `${startDate}T00:00:00`)
                .lte('created_at', `${endDate}T23:59:59`);

            if (selectedBranch !== 'ALL') {
                query = query.eq('branch_id', selectedBranch);
            }

            // 2. Query Inventory Purchases
            let pQuery = supabase
                .from('inventory_purchases')
                .select(`
                    id, total_amount, purchase_date, status, doc_number, branch_id,
                    suppliers(name)
                `)
                .eq('status', 'PROCESADO')
                .gte('purchase_date', startDate)
                .lte('purchase_date', endDate);

            if (selectedBranch !== 'ALL') {
                pQuery = pQuery.eq('branch_id', selectedBranch);
            }

            const [expensesRes, purchasesRes] = await Promise.all([query, pQuery]);

            if (expensesRes.error) throw expensesRes.error;
            if (purchasesRes.error) throw purchasesRes.error;

            const itemsMap: any[] = [];

            // Map Direct Expenses
            (expensesRes.data || []).forEach((exp: any) => {
                const dt = dayjs(exp.created_at);
                itemsMap.push({
                    id: exp.id,
                    expenseNumber: exp.expense_number || exp.id.split('-')[0] || 'S/N',
                    createdAt: dt.format('DD/MM/YYYY hh:mm A'),
                    fullDate: dt.format('YYYY-MM-DD'),
                    category: (exp.category || 'SIN CATEGORÍA').toUpperCase(),
                    description: (exp.description || 'SIN DESCRIPCIÓN').toUpperCase(),
                    amount: Number(exp.amount) || 0,
                    caja: (exp.cash_registers?.name || 'Administración').toUpperCase(),
                    user: (exp.profiles?.name || 'Sin Asignar').toUpperCase()
                });
            });

            // Map Inventory Purchases
            (purchasesRes.data || []).forEach((pur: any) => {
                const dt = dayjs(pur.purchase_date);
                itemsMap.push({
                    id: pur.id,
                    expenseNumber: pur.doc_number || pur.id.split('-')[0] || 'S/N',
                    createdAt: dt.format('DD/MM/YYYY'),
                    fullDate: dt.format('YYYY-MM-DD'),
                    category: 'COMPRA DE INVENTARIO',
                    description: ('COMPRA A: ' + (pur.suppliers?.name || 'PROVEEDOR')).toUpperCase(),
                    amount: Number(pur.total_amount) || 0,
                    caja: 'INVENTARIOS',
                    user: 'SISTEMA'
                });
            });

            setRawExpenses(itemsMap);
            setFetchError(null);
        } catch (e: any) {
            console.error(e);
            setFetchError(e.message || String(e));
            setRawExpenses([]);
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        if (!rawExpenses.length) return null;

        const dateMap: any = {};
        const cat: any = {};
        const cajas: any = {};

        let grandAmount = 0;
        let grandCount = 0;

        rawExpenses.forEach(d => {
            if (!dateMap[d.fullDate]) dateMap[d.fullDate] = { time: d.fullDate, amount: 0, count: 0 };
            dateMap[d.fullDate].amount += d.amount;
            dateMap[d.fullDate].count += 1;

            if (!cat[d.category]) cat[d.category] = { name: d.category, amount: 0, count: 0 };
            cat[d.category].amount += d.amount;
            cat[d.category].count += 1;

            if (!cajas[d.caja]) cajas[d.caja] = { name: d.caja, amount: 0, count: 0 };
            cajas[d.caja].amount += d.amount;
            cajas[d.caja].count += 1;

            grandAmount += d.amount;
            grandCount += 1;
        });

        const arrDate = Object.values(dateMap).sort((a: any, b: any) => a.time.localeCompare(b.time));
        const arrCat = Object.values(cat).sort((a: any, b: any) => b.amount - a.amount);
        const arrCajas = Object.values(cajas).sort((a: any, b: any) => b.amount - a.amount);

        const avgTicket = grandCount > 0 ? grandAmount / grandCount : 0;

        // Calculate percentages safely
        const totalAmountSafe = grandAmount > 0 ? grandAmount : 1;

        const topCategory = arrCat.length > 0 ? arrCat[0] : null;

        return {
            byDate: arrDate,
            byCat: arrCat,
            byCaja: arrCajas,
            totalAmount: grandAmount,
            totalCount: grandCount,
            avgTicket,
            totalAmountSafe,
            topCategory
        };
    }, [rawExpenses]);

    const formatCurrency = (val: number) => `Q${Math.abs(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="h-full flex flex-col bg-[#f8f9fa] font-sans overflow-hidden">
            {/* HERRAMIENTAS Y FILTROS - DISEÑO MINIMALISTA SUPERIOR */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 shadow-sm shrink-0 z-10">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                    {/* Filtros Izquierda */}
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={selectedBranch}
                            onChange={e => setSelectedBranch(e.target.value)}
                            className="h-10 bg-[#f8f9fa] border border-slate-200 rounded-xl px-4 text-[11px] uppercase font-medium text-slate-700 outline-none hover:border-slate-300 transition-colors shadow-sm"
                        >
                            <option value="ALL">SUCURSAL: TODAS</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2 bg-[#f8f9fa] border border-slate-200 rounded-xl px-3 h-10 shadow-sm transition-colors hover:border-slate-300">
                            <Calendar size={14} className="text-slate-400" />
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-[11px] outline-none font-medium text-slate-700" />
                            <span className="text-slate-300 font-medium px-1">-</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-[11px] outline-none font-medium text-slate-700" />
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="h-10 px-6 bg-[#106ebe] hover:bg-[#1a1c29] text-white rounded-xl font-semibold text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                        >
                            {loading ? <Activity size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            SINCRONIZAR
                        </button>
                    </div>

                    {/* Botones Pestañas Derecha */}
                    <div className="flex bg-[#f1f3f6] p-1.5 rounded-xl border border-slate-200/60 shadow-inner">
                        <button onClick={() => setActiveTab('GASTOS')} className={`px-5 py-2 rounded-lg text-[10px] font-semibold tracking-widest uppercase transition-all flex items-center gap-2 ${activeTab === 'GASTOS' ? 'bg-white text-[#106ebe] shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}>
                            GASTOS
                        </button>
                        <button onClick={() => setActiveTab('CATEGORIAS_CAJAS')} className={`px-5 py-2 rounded-lg text-[10px] font-semibold tracking-widest uppercase transition-all flex items-center gap-2 ${activeTab === 'CATEGORIAS_CAJAS' ? 'bg-white text-[#106ebe] shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}>
                            DESGLOSE
                        </button>
                        <button onClick={() => setActiveTab('RESUMEN_GASTOS')} className={`px-5 py-2 rounded-lg text-[10px] font-semibold tracking-widest uppercase transition-all flex items-center gap-2 ${activeTab === 'RESUMEN_GASTOS' ? 'bg-white text-[#106ebe] shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}>
                            RESUMEN
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN CANVAS SCROLLABLE */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 relative custom-scrollbar">

                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f8f9fa]/80 backdrop-blur-sm z-50">
                        <Activity size={40} className="text-rose-500 animate-spin mb-4" />
                        <p className="font-semibold text-slate-600 uppercase tracking-[0.2em] text-xs">Calculando Gastos...</p>
                    </div>
                ) : fetchError ? (
                    <div className="h-full flex flex-col items-center justify-center text-red-500 max-w-xl mx-auto text-center px-6">
                        <AlertCircle size={48} className="mb-4 text-rose-500 drop-shadow-md" />
                        <p className="font-semibold uppercase tracking-widest text-sm mb-2 text-rose-900">Error obteniendo datos:</p>
                        <p className="font-mono text-[10px] font-medium text-red-700 bg-red-50 p-4 border border-red-200 rounded-xl break-all shadow-inner">
                            {fetchError}
                        </p>
                    </div>
                ) : !stats ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Activity size={56} className="mb-6 opacity-20" />
                        <p className="font-semibold uppercase tracking-widest text-slate-400">Genere un reporte para visualizar KPI's</p>
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-24">

                        {/* =========================================
                            TAB 1: GASTOS (EL DISEÑO CLÁSICO Y BELLO)
                        ========================================= */}
                        {activeTab === 'GASTOS' && (
                            <>
                                {/* KPI CARDS TOP */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                                    <KPICard label="Gasto Total Neto" value={formatCurrency(stats.totalAmount)} trend="+ Gasto Mayor" negative={true} />
                                    <KPICard label="Promedio por Gasto" value={formatCurrency(stats.avgTicket)} trend="- Operativo" negative={false} />
                                    <KPICard label="Transacciones" value={`${stats.totalCount} Movimientos`} trend="+ Consistente" negative={false} />
                                    <KPICard label="Categoría Principal" value={stats.topCategory ? stats.topCategory.name : 'N/A'} showTrend={false} />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* BARRAS DE DISTRIBUCIÓN */}
                                    <div className="lg:col-span-2 admin-card p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-200 shadow-sm bg-white">
                                        <div className="flex items-center justify-between mb-8 md:mb-10">
                                            <h3 className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] md:tracking-[0.3em] text-rose-500">Distribución de Egresos</h3>
                                            <Activity size={18} className="text-slate-400" />
                                        </div>
                                        <div className="space-y-6 md:space-y-8">
                                            {stats.byCat.length === 0 ? (
                                                <div className="text-slate-400 font-medium uppercase text-[10px] tracking-widest text-center py-6">Sin Datos</div>
                                            ) : (
                                                stats.byCat.map((cat: any, idx: number) => (
                                                    <ExpenseBar
                                                        key={cat.name}
                                                        label={cat.name}
                                                        amount={formatCurrency(cat.amount)}
                                                        percentage={((cat.amount / stats.totalAmountSafe) * 100).toFixed(1)}
                                                        color={PIE_COLORS[idx % PIE_COLORS.length]}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* PANELES DE ALERTA A LA DERECHA */}
                                    <div className="space-y-6">
                                        <div className="admin-card p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-rose-100 bg-rose-50/50 shadow-sm relative overflow-hidden">
                                            <div className="flex items-center gap-3 mb-4 text-rose-500">
                                                <AlertCircle size={20} />
                                                <h4 className="text-[10px] font-semibold uppercase tracking-widest leading-none">Resumen Financiero</h4>
                                            </div>
                                            <p className="text-[11px] md:text-xs text-rose-600/70 leading-relaxed font-medium z-10 relative">
                                                El rubro de <b className="text-rose-500 uppercase">{stats.topCategory ? stats.topCategory.name : 'NINGUNO'}</b> conforma la mayor parte de sus salidas totalizando <b className="text-rose-500">{formatCurrency(stats.topCategory ? stats.topCategory.amount : 0)}</b> durante este periodo.
                                            </p>
                                        </div>

                                        <div className="admin-card p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm bg-white">
                                            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                                <Activity size={14} /> Actividad General
                                            </h4>
                                            <div className="space-y-5">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] font-semibold text-slate-700 uppercase">Período Seleccionado</span>
                                                        <span className="text-sm font-semibold text-slate-900 tracking-tighter">{stats.byDate.length} DÍAS</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[10px] text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg font-medium">
                                                        <span>Registros Diarios</span>
                                                        <span className="text-emerald-500 uppercase tracking-widest">Activo</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* CRONOLOGÍA / TIMELINE TENDENCIA */}
                                <div className="admin-card p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-200 shadow-sm bg-white mt-8">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate-400">Comportamiento en Línea de Tiempo</h3>
                                    </div>
                                    <div className="h-[350px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={stats.byDate} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} dy={10} />
                                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} tickFormatter={(v) => `Q${v}`} />
                                                <RechartsTooltip
                                                    itemStyle={{ color: '#106ebe', fontWeight: 'bold' }}
                                                    labelStyle={{ color: '#64748b', fontWeight: '700', marginBottom: '4px' }}
                                                    contentStyle={{
                                                        borderRadius: '16px',
                                                        fontSize: '11px',
                                                        border: 'none',
                                                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                                                        backgroundColor: '#ffffff'
                                                    }}
                                                    formatter={(v: any) => formatCurrency(v)}
                                                />
                                                <Bar yAxisId="left" dataKey="amount" fill="#f43f5e" name="Egresos Emitidos (Q)" radius={[8, 8, 0, 0]} maxBarSize={45} isAnimationActive={true}>
                                                    <LabelList dataKey="amount" position="top" style={{ fontSize: '10px', fontWeight: '800', fill: '#475569' }} formatter={(v: any) => formatCurrency(v)} />
                                                </Bar>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </>
                        )}


                        {/* =========================================
                            TAB 2: DESGLOSE POR CATEGORÍAS Y CAJAS
                        ========================================= */}
                        {activeTab === 'CATEGORIAS_CAJAS' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* TABLA CATEGORÍAS */}
                                <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm flex flex-col">
                                    <div className="bg-[#f8f9fa] px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                                        <h3 className="text-[10px] font-semibold text-slate-700 uppercase tracking-[0.2em]">Desglose por Categoría</h3>
                                        <Tag size={16} className="text-slate-400" />
                                    </div>
                                    <div className="p-0 overflow-y-auto max-h-[600px] custom-scrollbar">
                                        <table className="w-full text-left text-[11px]">
                                            <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-6 py-4 font-semibold text-slate-400 uppercase tracking-widest bg-white">Categoría</th>
                                                    <th className="px-6 py-4 text-center font-semibold text-slate-400 uppercase tracking-widest bg-white">Cantidad</th>
                                                    <th className="px-6 py-4 text-right font-semibold text-slate-400 uppercase tracking-widest bg-white">Monto Neto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {stats.byCat.map((c: any, i: number) => (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-6 py-4 font-semibold uppercase text-slate-700 group-hover:text-rose-500 transition-colors">{c.name}</td>
                                                        <td className="px-6 py-4 text-center font-medium text-slate-500 tabular-nums bg-slate-50/50">{c.count}</td>
                                                        <td className="px-6 py-4 text-right tabular-nums text-slate-800 font-semibold text-[12px]">{formatCurrency(c.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* TABLA CAJAS */}
                                <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm flex flex-col">
                                    <div className="bg-[#f8f9fa] px-6 py-5 border-b border-slate-200 flex justify-between items-center">
                                        <h3 className="text-[10px] font-semibold text-slate-700 uppercase tracking-[0.2em]">Desglose por Caja Emisora</h3>
                                        <Activity size={16} className="text-indigo-400" />
                                    </div>
                                    <div className="p-0 overflow-y-auto max-h-[600px] custom-scrollbar">
                                        <table className="w-full text-left text-[11px]">
                                            <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-6 py-4 font-semibold text-slate-400 uppercase tracking-widest bg-white">Caja Registro</th>
                                                    <th className="px-6 py-4 text-center font-semibold text-slate-400 uppercase tracking-widest bg-white">Cantidad</th>
                                                    <th className="px-6 py-4 text-right font-semibold text-slate-400 uppercase tracking-widest bg-white">Monto Neto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {stats.byCaja.map((cx: any, i: number) => (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-6 py-4 font-semibold uppercase text-slate-700 group-hover:text-indigo-500 transition-colors">{cx.name}</td>
                                                        <td className="px-6 py-4 text-center font-medium text-slate-500 tabular-nums bg-slate-50/50">{cx.count}</td>
                                                        <td className="px-6 py-4 text-right tabular-nums text-slate-800 font-semibold text-[12px]">{formatCurrency(cx.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* =========================================
                            TAB 3: RESUMEN GENERAL TABLA COMPLETA
                        ========================================= */}
                        {activeTab === 'RESUMEN_GASTOS' && (
                            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                                <div className="bg-[#106ebe] px-8 py-5 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-[10px] font-semibold text-white uppercase tracking-[0.3em] mb-1">Auditoría Maestra de Gastos</h3>
                                        <p className="text-[9px] font-medium text-slate-400 tracking-widest uppercase">Reporte Detallado</p>
                                    </div>
                                    <FileText size={20} className="text-slate-400" />
                                </div>
                                <div className="overflow-x-auto max-h-[700px] overflow-y-auto custom-scrollbar relative">
                                    <table className="w-full text-left text-[10px] min-w-[800px]">
                                        <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold text-slate-400 uppercase tracking-widest bg-white">Nº Recibo</th>
                                                <th className="px-6 py-4 font-semibold text-slate-400 uppercase tracking-widest bg-white">Día / Hora</th>
                                                <th className="px-6 py-4 font-semibold text-slate-400 uppercase tracking-widest bg-white">Categoría</th>
                                                <th className="px-6 py-4 font-semibold text-slate-400 uppercase tracking-widest bg-white w-72">Justificación</th>
                                                <th className="px-6 py-4 font-semibold text-slate-400 uppercase tracking-widest bg-white">Usuario</th>
                                                <th className="px-6 py-4 text-right font-semibold text-slate-400 uppercase tracking-widest bg-white">Salida Neta</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {rawExpenses.map((exp: any, i: number) => (
                                                <tr key={exp.id || i} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-6 py-4 font-semibold text-rose-500 uppercase tracking-widest">#{exp.expenseNumber}</td>
                                                    <td className="px-6 py-4 font-medium text-slate-500 whitespace-nowrap">{exp.createdAt}</td>
                                                    <td className="px-6 py-4 font-semibold text-slate-600 uppercase">
                                                        <span className="bg-slate-100/80 border border-slate-200/60 px-2.5 py-1 rounded text-[9px]">{exp.category}</span>
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-slate-700 uppercase truncate max-w-sm" title={exp.description}>{exp.description}</td>
                                                    <td className="px-6 py-4 font-medium text-slate-500 uppercase bg-slate-50/30">{exp.user}</td>
                                                    <td className="px-6 py-4 text-right tabular-nums text-slate-900 font-semibold text-[11px]">{formatCurrency(exp.amount)}</td>
                                                </tr>
                                            ))}
                                            {rawExpenses.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium uppercase tracking-widest">No hay gastos reportados</td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {rawExpenses.length > 0 && (
                                            <tfoot className="bg-white sticky bottom-0 z-10 text-slate-900 shadow-[0_-15px_15px_-15px_rgba(0,0,0,0.1)] border-t border-slate-200">
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-5 font-semibold text-[11px] uppercase text-right tracking-[0.2em]">CANTIDAD LIQUIDADA DEL PERÍODO</td>
                                                    <td className="px-6 py-5 text-right tabular-nums font-semibold text-rose-600 text-lg">{formatCurrency(stats.totalAmount)}</td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
};

export { DashboardExpenses };
