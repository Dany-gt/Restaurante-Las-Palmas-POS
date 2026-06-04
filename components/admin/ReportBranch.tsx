import React, { useState, useEffect } from 'react';
import { X, Loader2, Download, Search, ChevronDown, Filter, BarChart3, Printer, FileSpreadsheet, Calculator, ClipboardList, TrendingUp } from 'lucide-react';
import { supabase } from '../../supabase';
import { createPortal } from 'react-dom';
import { useReactToPrint } from 'react-to-print';
import { DraggableWindow } from './DraggableWindow';
import * as XLSX from 'xlsx';

const formatCurrRaw = (v: number) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// --- MODAL DE VISTA PREVIA DE IMPRESIÓN (Sucursales) ---
const BranchReportPrintPreview: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    data: any[],
    totals: any,
    filters: { start: string, end: string },
    userId: string
}> = ({ isOpen, onClose, data, totals, filters, userId }) => {
    const printRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Reporte_Sucursales_${filters?.start || 'export'}`,
    });

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
            <DraggableWindow>
                <div className="bg-[#f0f0f0] border-2 border-[#106ebe] shadow-2xl flex flex-col w-[98vw] max-w-7xl h-[95vh] overflow-hidden select-none font-sans rounded-sm">
                    {/* Toolbar */}
                    <div className="modal-header bg-[#106ebe] h-10 px-4 flex justify-between items-center text-white shrink-0 cursor-move border-b border-black">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest">
                            <Printer size={16} className="text-emerald-400" />
                            <span>Contingencia y Auditoría - Vista Previa de Ventas por Sucursal</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handlePrint()} className="h-7 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-[10px] font-semibold uppercase flex items-center gap-2 transition-colors border border-blue-400/30">
                                <Printer size={12} strokeWidth={3} /> IMPRIMIR PDF
                            </button>
                            <button onClick={() => {
                                const ws = XLSX.utils.json_to_sheet(data.map(r => ({
                                    Sucursal: r.name,
                                    Efectivo: r.vEfectivo,
                                    Tarjeta: r.vTarjeta,
                                    'Venta Total': r.totalVentas,
                                    'Egresos (COM+GAS)': r.compras + r.gastos,
                                    Utilidad: r.totalVentas - r.totalEgresos
                                })));
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, 'Sucursales');
                                XLSX.writeFile(wb, `Reporte_Sucursales_${filters.start}.xlsx`);
                            }} className="h-7 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[10px] font-semibold uppercase flex items-center gap-2 transition-colors border border-emerald-400/30">
                                <FileSpreadsheet size={12} strokeWidth={3} /> EXCEL
                            </button>
                            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center hover:bg-red-500 transition-colors text-white ml-2 rounded-sm">
                                <X size={22} strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    {/* Hoja Membretada */}
                    <div className="flex-1 overflow-auto bg-slate-700 p-8 custom-scrollbar shadow-inner">
                        <div ref={printRef} className="bg-white mx-auto p-12 shadow-2xl min-h-full w-[1200px] text-black print:shadow-none print:w-full font-serif relative">
                            {/* Watermark Logo */}
                            <div className="absolute top-10 right-16 opacity-5 pointer-events-none text-slate-900">
                                <TrendingUp size={220} />
                            </div>

                            {/* Header */}
                            <div className="text-center mb-10 border-b-2 border-slate-900 pb-8 relative z-10">
                                <h1 className="text-4xl font-semibold uppercase tracking-tighter mb-1 font-sans">RESTAURANTE LAS PALMAS</h1>
                                <p className="text-[12px] font-semibold uppercase text-slate-400 tracking-[0.4em] mb-4 font-sans">Informe Consolidado de Rendimiento por Sucursal</p>

                                <div className="flex justify-between items-end bg-slate-50 p-6 border border-slate-200 mt-6 font-sans">
                                    <div className="text-left">
                                        <h2 className="text-2xl font-semibold uppercase text-slate-800 tracking-tight leading-none">ESTADO DE RESULTADOS OPERATIVOS</h2>
                                        <div className="mt-2 space-y-0.5">
                                            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Análisis: <span className="text-slate-900">Multisucuarsal Las Palmas</span></p>
                                            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Periodo: <span className="text-slate-900">{filters?.start} al {filters?.end}</span></p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="inline-block border-l-4 border-emerald-500 pl-4 text-right">
                                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1 font-sans">Ventas Totales Brutas</p>
                                            <div className="text-3xl font-semibold text-slate-900 tracking-tighter font-sans">Q{formatCurrRaw(totals?.totalVentas || 0)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Resumen Financiero */}
                            <div className="grid grid-cols-5 gap-4 mb-10 font-sans relative z-10 text-[11px] font-medium uppercase tracking-tighter">
                                <div className="border border-slate-200 p-4 bg-slate-50">
                                    <span className="text-[8px] font-semibold text-slate-400 block mb-1">EFECTIVO</span>
                                    <div className="text-lg font-semibold tracking-tight text-slate-900">Q{formatCurrRaw(totals?.vEfectivo || 0)}</div>
                                </div>
                                <div className="border border-slate-200 p-4 bg-white">
                                    <span className="text-[8px] font-semibold text-blue-400 block mb-1">TARJETA</span>
                                    <div className="text-lg font-semibold tracking-tight text-blue-700">Q{formatCurrRaw(totals?.vTarjeta || 0)}</div>
                                </div>
                                <div className="border border-slate-200 p-4 bg-white">
                                    <span className="text-[8px] font-semibold text-emerald-400 block mb-1">CRÉDITO</span>
                                    <div className="text-lg font-semibold tracking-tight text-emerald-700">Q{formatCurrRaw(totals?.vCredito || 0)}</div>
                                </div>
                                <div className="border border-slate-300 p-4 bg-slate-100/50">
                                    <span className="text-[8px] font-semibold text-slate-400 block mb-1 font-semibold">UTILIDAD BRUTA (ESTIMADA)</span>
                                    <div className="text-lg font-semibold tracking-tighter text-slate-900">Q{formatCurrRaw(totals.totalVentas - totals.totalEgresos)}</div>
                                </div>
                                <div className="border border-red-200 p-4 bg-red-50/30">
                                    <span className="text-[8px] font-semibold text-red-400 block mb-1">EGRESOS TOTALES</span>
                                    <div className="text-lg font-semibold tracking-tight text-red-700">Q{formatCurrRaw(totals?.totalEgresos || 0)}</div>
                                </div>
                            </div>

                            {/* Tabla de Detalle */}
                            <div className="mb-12 relative z-10">
                                <div className="bg-[#106ebe] text-white px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] mb-4 flex justify-between items-center font-sans">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp size={14} />
                                        <span>Desglose por Puntos de Venta</span>
                                    </div>
                                </div>

                                <table className="w-full border-collapse font-sans text-[10px]">
                                    <thead>
                                        <tr className="bg-slate-100 border-b-2 border-slate-900 font-semibold uppercase text-slate-600 tracking-tighter">
                                            <th className="px-2 py-3 text-left">SUCURSAL</th>
                                            <th className="px-2 py-3 text-right">EFECTIVO</th>
                                            <th className="px-2 py-3 text-right">TARJETA</th>
                                            <th className="px-2 py-3 text-right">VENTA TOTAL</th>
                                            <th className="px-2 py-3 text-right">EGRESOS (COM+GAS)</th>
                                            <th className="px-2 py-3 text-right">UTILIDAD</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {data?.map((r, i) => (
                                            <tr key={i} className="h-10">
                                                <td className="px-2 uppercase font-semibold">{r.name}</td>
                                                <td className="px-2 text-right">Q{formatCurrRaw(r.vEfectivo)}</td>
                                                <td className="px-2 text-right">Q{formatCurrRaw(r.vTarjeta)}</td>
                                                <td className="px-2 text-right bg-blue-50/30 font-semibold">Q{formatCurrRaw(r.totalVentas)}</td>
                                                <td className="px-2 text-right text-red-500 font-semibold">Q{formatCurrRaw(r.compras + r.gastos)}</td>
                                                <td className="px-2 text-right font-semibold border-l border-slate-200">Q{formatCurrRaw(r.totalVentas - r.totalEgresos)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-900 bg-slate-50 h-11 font-semibold uppercase text-xs">
                                            <td className="px-2 text-right tracking-[0.1em]">GRAN TOTAL CONSOLIDADO:</td>
                                            <td className="px-2 text-right">Q{formatCurrRaw(totals?.vEfectivo || 0)}</td>
                                            <td className="px-2 text-right text-blue-600">Q{formatCurrRaw(totals?.vTarjeta || 0)}</td>
                                            <td className="px-2 text-right bg-slate-100 font-extrabold">Q{formatCurrRaw(totals?.totalVentas || 0)}</td>
                                            <td className="px-2 text-right text-red-600">Q{formatCurrRaw(totals?.compras + totals?.gastos)}</td>
                                            <td className="px-2 text-right bg-slate-200 text-slate-900 font-extrabold tracking-tighter">Q{formatCurrRaw(totals.totalVentas - totals.totalEgresos)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Footer Firmas */}
                            <div className="mt-24 grid grid-cols-2 gap-20 px-20 font-sans relative z-10">
                                <div className="border-t-2 border-slate-900 pt-5 text-center">
                                    <p className="text-[10px] font-semibold uppercase text-slate-900">ADMINISTRACIÓN GENERAL</p>
                                    <p className="text-[8px] text-slate-400 font-medium mt-2 uppercase tracking-tight font-serif">Certificación de Resultados Mensuales / Período</p>
                                </div>
                                <div className="border-t-2 border-slate-900 pt-5 text-center">
                                    <p className="text-[10px] font-semibold uppercase text-slate-900">AUDITORÍA CONTABLE</p>
                                    <p className="text-[8px] text-slate-400 font-medium mt-2 uppercase tracking-tight font-serif">Verificación de Flujos y Egresos</p>
                                </div>
                            </div>

                            <div className="mt-20 text-[8px] flex justify-between items-center text-slate-300 font-mono tracking-widest uppercase">
                                <span>LAS PALMAS ERP SYTEM — REPORTE GERENCIAL</span>
                                <span>RESPONSABLE: {String(userId || 'ANON').toUpperCase()} — FECHA EMISIÓN: {new Date().toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </DraggableWindow>
        </div>,
        document.body
    );
};

export const ReportBranch: React.FC = () => {
    const getLocalISOString = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = cachedUser?.id || 'anon';
    const STORAGE_KEY = `ReportBranch_State_${userId}`;

    // Restore state synchronously on mount
    const [savedState] = useState(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    });

    const [startDate, setStartDate] = useState(savedState?.startDate || getLocalISOString());
    const [endDate, setEndDate] = useState(savedState?.endDate || getLocalISOString());
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintPreview, setShowPrintPreview] = useState(false);

    useEffect(() => {
        // Solo generar automáticamente
    }, []);

    useEffect(() => {
        const state = { startDate, endDate };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [startDate, endDate, STORAGE_KEY]);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const startStr = `${startDate}T00:00:00`;
            const endStr = `${endDate}T23:59:59`;

            // 1. Fetch Branches
            const { data: branches } = await supabase.from('branches').select('id, name').order('name');
            if (!branches) return;

            // 2. Fetch Orders grouped by Branch
            const { data: orders } = await supabase.from('orders')
                .select('branch_id, status, total, payment_method, discount_amount, order_items(discount_amount)')
                .gte('created_at', startStr)
                .lte('created_at', endStr)
                .in('status', ['completed']);

            // 3. Fetch Expenses
            const { data: expenses } = await supabase.from('expenses')
                .select('branch_id, amount')
                .gte('created_at', startStr)
                .lte('created_at', endStr)
                .neq('is_void', true);

            // 4. Fetch Purchases
            const { data: purchases } = await supabase.from('inventory_purchases')
                .select('branch_id, total_amount')
                .gte('purchase_date', startDate)
                .lte('purchase_date', endDate)
                .eq('status', 'PROCESADO')
                .eq('payment_condition', 'CONTADO');

            // Process data per branch
            const results = branches.map(b => {
                const bOrders = orders?.filter(o => o.branch_id === b.id) || [];
                const bExpenses = expenses?.filter(e => e.branch_id === b.id) || [];
                const bPurchases = purchases?.filter(p => p.branch_id === b.id) || [];

                let vEfectivo = 0, vTarjeta = 0, vCredito = 0, vOtros = 0, desc = 0;

                bOrders.forEach(o => {
                    const total = Number(o.total) || 0;
                    const method = (o.payment_method || 'EFECTIVO').toUpperCase();
                    desc += (Number(o.discount_amount) || 0);

                    if (o.order_items && Array.isArray(o.order_items)) {
                        desc += o.order_items.reduce((acc: number, item: any) => acc + (Number(item.discount_amount) || 0), 0);
                    }

                    if (method === 'EFECTIVO') vEfectivo += total;
                    else if (method.includes('TARJETA')) vTarjeta += total;
                    else if (method === 'CREDITO' || method === 'CRÉDITO') vCredito += total;
                    else vOtros += total;
                });

                const totalVentas = vEfectivo + vTarjeta + vCredito + vOtros;
                const compras = bPurchases.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
                const gastos = bExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
                const totalEgresos = compras + gastos + desc;

                return {
                    name: b.name.toUpperCase(),
                    vEfectivo,
                    vTarjeta,
                    vCredito,
                    vOtros,
                    totalVentas,
                    compras,
                    gastos,
                    desc,
                    totalEgresos
                };
            });

            setData(results);
        } catch (error) {
            console.error("Error generating report:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(data.map(r => ({
            'Sucursal': r.name,
            'Ventas Efectivo': r.vEfectivo,
            'Ventas Tarjeta': r.vTarjeta,
            'Total Ventas': r.totalVentas,
            'Compras': r.compras,
            'Gastos': r.gastos,
            'Utilidad Estimada': r.totalVentas - r.totalEgresos
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
        XLSX.writeFile(wb, `Reporte_Sucursales_${startDate}.xlsx`);
    };

    const formatCurr = (val: number) => `Q${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const totals = data.reduce((acc, curr) => ({
        vEfectivo: (acc.vEfectivo || 0) + (curr.vEfectivo || 0),
        vTarjeta: (acc.vTarjeta || 0) + (curr.vTarjeta || 0),
        vCredito: (acc.vCredito || 0) + (curr.vCredito || 0),
        vOtros: (acc.vOtros || 0) + (curr.vOtros || 0),
        totalVentas: (acc.totalVentas || 0) + (curr.totalVentas || 0),
        compras: (acc.compras || 0) + (curr.compras || 0),
        gastos: (acc.gastos || 0) + (curr.gastos || 0),
        desc: (acc.desc || 0) + (curr.desc || 0),
        totalEgresos: (acc.totalEgresos || 0) + (curr.totalEgresos || 0),
    }), { vEfectivo: 0, vTarjeta: 0, vCredito: 0, vOtros: 0, totalVentas: 0, compras: 0, gastos: 0, desc: 0, totalEgresos: 0 });

    const filteredData = data.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex flex-col h-full bg-[#f8f9fa] animate-fade-in text-black">
            {/* Header (Ribbon compatible) */}
            <div className="bg-[#f0f0f0] border-b border-gray-300 p-2 shrink-0">
                <div className="bg-gray-200/50 border border-gray-300 p-3 rounded-sm">
                    <div className="flex items-center gap-8">
                        {/* Fechas */}
                        <div className="flex items-center gap-4 relative pt-2">
                            <span className="absolute -top-3.5 left-0 text-[10px] font-medium text-gray-500 uppercase tracking-tighter">Filtro de Fechas</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-gray-700">Del:</span>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-gray-400 bg-white text-[11px] h-7 px-2 outline-none focus:border-blue-500 shadow-inner" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-gray-700">Al:</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-gray-400 bg-white text-[11px] h-7 px-2 outline-none focus:border-blue-500 shadow-inner" />
                            </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-2 pt-2">
                            <button onClick={handleGenerate} disabled={loading} className="bg-white border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 px-6 py-1 text-[11px] font-semibold uppercase text-gray-700 shadow-sm transition-all active:scale-95 disabled:opacity-50">
                                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Generar'}
                            </button>
                            <button onClick={() => setShowPrintPreview(true)} className="bg-white border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 px-6 py-1 text-[11px] font-semibold uppercase text-gray-700 shadow-sm transition-all active:scale-95">
                                <Printer size={14} className="text-blue-600 mr-2" /> Imprimir Vista Previa
                            </button>
                        </div>

                        <div className="flex-1"></div>

                        {/* Search bar integrated (Far right) */}
                        <div className="flex items-center bg-white border-2 border-gray-300 h-7 px-2 gap-2 group focus-within:border-blue-500/50 pt-0">
                            <Search size={14} className="text-gray-400" />
                            <input
                                type="text"
                                placeholder="Introduzca texto a buscar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="bg-transparent border-none outline-none text-[11px] text-gray-700 w-[240px]"
                            />
                            <button className="bg-[#f0f0f0] border-l border-gray-300 h-full px-4 text-[10px] font-medium hover:bg-gray-200 uppercase tracking-tighter">Buscar</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Space Filler */}
            <div className="h-2 bg-white border-b border-gray-300 shrink-0"></div>

            {/* Main Grid Area */}
            <div className="flex-1 overflow-auto bg-[#f8f9fa] relative scrollbar-thin scrollbar-thumb-gray-300">
                <table className="w-full border-collapse text-[11px] select-text">
                    <thead className="sticky top-0 bg-[#f0f0f0] z-20 shadow-sm ring-1 ring-gray-300 ring-inset">
                        <tr className="divide-x divide-gray-300">
                            <th className="px-4 py-2 text-left font-semibold uppercase text-gray-600 w-[15%]">Sucursal</th>
                            <th className="px-4 py-2 text-right font-semibold uppercase text-gray-600">Ventas Efectivo</th>
                            <th className="px-4 py-2 text-right font-semibold uppercase text-gray-600">Ventas Tarjeta</th>
                            <th className="px-4 py-2 text-right font-semibold uppercase text-gray-600">Ventas Al Crédito</th>
                            <th className="px-4 py-2 text-right font-semibold uppercase text-gray-600">Ventas Otros</th>
                            <th className="px-4 py-2 text-right font-semibold uppercase text-gray-600 bg-blue-100/30">Total Ventas</th>
                            <th className="px-4 py-2 text-right font-semibold uppercase text-gray-600">Compras</th>
                            <th className="px-4 py-2 text-right font-semibold uppercase text-gray-600">Gastos</th>
                            <th className="px-4 py-2 text-right font-semibold uppercase text-gray-600">Descuentos</th>
                            <th className="px-4 py-2 text-right font-semibold uppercase text-gray-600 bg-red-100/30">Total Egresos</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {filteredData.map((row, idx) => (
                            <tr key={idx} className="group hover:bg-blue-50 transition-colors border-b border-gray-200 divide-x divide-gray-100 font-medium">
                                <td className="px-4 py-2 text-gray-700 font-medium border-l-2 border-l-transparent group-hover:border-l-blue-500">{row.name}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{formatCurr(row.vEfectivo)}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{formatCurr(row.vTarjeta)}</td>
                                <td className="px-2 text-right text-gray-600">{formatCurr(row.vCredito)}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{formatCurr(row.vOtros)}</td>
                                <td className="px-4 py-2 text-right font-semibold text-slate-800 bg-blue-50/20">{formatCurr(row.totalVentas)}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{formatCurr(row.compras)}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{formatCurr(row.gastos)}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{formatCurr(row.desc)}</td>
                                <td className="px-4 py-2 text-right font-semibold text-slate-800 bg-red-50/20">{formatCurr(row.totalEgresos)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {data.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-40 opacity-20 select-none">
                        <BarChart3 size={64} className="mb-4" />
                        <span className="text-xs font-semibold uppercase tracking-[0.5em]">Sin Registros</span>
                    </div>
                )}
            </div>

            {/* Bottom Totals Summary bar */}
            <div className="bg-[#f0f0f0] border-t border-gray-300 flex items-center justify-end px-4 h-10 gap-x-1 divide-x divide-gray-300 shrink-0 select-text overflow-x-auto">
                <div className="px-6 flex flex-col items-end">
                    <span className="text-[11px] font-semibold text-slate-900 leading-tight">{formatCurr(totals.totalVentas)}</span>
                </div>
                <div className="px-6 flex flex-col items-end">
                    <span className="text-[11px] font-semibold text-slate-900 leading-tight">{formatCurr(totals.totalEgresos)}</span>
                </div>
            </div>

            {showPrintPreview && (
                <BranchReportPrintPreview
                    isOpen={showPrintPreview}
                    onClose={() => setShowPrintPreview(false)}
                    data={data}
                    totals={totals}
                    filters={{ start: startDate, end: endDate }}
                    userId={userId}
                />
            )}

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
                .scrollbar-thin::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                }
            `}</style>
        </div>
    );
};
