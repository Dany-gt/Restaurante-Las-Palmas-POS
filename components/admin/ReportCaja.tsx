
import React, { useState, useEffect, useMemo } from 'react';
import {
    Download, Printer, Search, Filter, Calendar,
    ChevronDown, ChevronRight, Calculator, FileText,
    CreditCard, DollarSign, Wallet, ArrowDownCircle,
    Copy, ExternalLink, RefreshCw, X, Play, PrinterIcon,
    FileSpreadsheet, FileIcon as FilePdf, ClipboardList
} from 'lucide-react';
import { supabase } from '../../supabase';
import { createPortal } from 'react-dom';
import { useReactToPrint } from 'react-to-print';
import { DraggableWindow } from './DraggableWindow';
import * as XLSX from 'xlsx';

// Estilos específicos para el diseño "ERP Classic Windows"
const ERP_STYLES = {
    headerBg: '#e1e1e1',
    toolbarBg: '#f0f0f0',
    border: '#a0a0a0',
    selectedRow: '#0078d7',
    text: '#000000',
    mutedText: '#444444'
};

const formatCurr = (v: number) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// --- MODAL DE VISTA PREVIA DE IMPRESIÓN (Cortes de Caja) ---
const ShiftsPrintPreview: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    onExportExcel: () => void,
    data: any[],
    totals: any,
    filters: { start: string, end: string, branch: string },
    userId: string
}> = ({ isOpen, onClose, onExportExcel, data, totals, filters, userId }) => {
    const printRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Cortes_Caja_${filters?.start || 'reporte'}`,
    });

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
            <DraggableWindow>
                <div className="bg-[#f0f0f0] border-2 border-[#106ebe] shadow-2xl flex flex-col w-[95vw] max-w-6xl h-[90vh] overflow-hidden select-none font-sans rounded-sm">
                    {/* Toolbar */}
                    <div className="modal-header bg-[#106ebe] h-10 px-4 flex justify-between items-center text-white shrink-0 cursor-move border-b border-black">
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
                            <Printer size={16} className="text-emerald-400" />
                            <span>Contingencia y Auditoría - Vista Previa de Cortes de Caja</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={onExportExcel} className="h-7 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[10px] font-black uppercase flex items-center gap-2 transition-colors border border-emerald-400/30">
                                <FileSpreadsheet size={12} strokeWidth={3} /> EXCEL (.XLSX)
                            </button>
                            <button onClick={() => handlePrint()} className="h-7 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-[10px] font-black uppercase flex items-center gap-2 transition-colors border border-blue-400/30 ml-2">
                                <Printer size={12} strokeWidth={3} /> IMPRIMIR PDF
                            </button>
                            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center hover:bg-red-500 transition-colors text-white ml-2 rounded-sm">
                                <X size={22} strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    {/* Hoja Membretada */}
                    <div className="flex-1 overflow-auto bg-slate-700 p-8 custom-scrollbar shadow-inner">
                        <div ref={printRef} className="bg-white mx-auto p-12 shadow-2xl min-h-full w-[1000px] text-black print:shadow-none print:w-full font-serif relative">
                            {/* Watermark Logo */}
                            <div className="absolute top-10 right-16 opacity-5 pointer-events-none text-slate-900">
                                <Calculator size={180} />
                            </div>

                            {/* Header */}
                            <div className="text-center mb-10 border-b-2 border-slate-900 pb-8 relative z-10">
                                <h1 className="text-4xl font-black uppercase tracking-tighter mb-1 font-sans">RESTAURANTE LAS PALMAS</h1>
                                <p className="text-[12px] font-black uppercase text-slate-400 tracking-[0.4em] mb-4 font-sans">Auditoría Operativa de Turnos y Cajas</p>

                                <div className="flex justify-between items-end bg-slate-50 p-6 border border-slate-200 mt-6 font-sans">
                                    <div className="text-left">
                                        <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tight leading-none">REPORTE DE CORTES DE CAJA</h2>
                                        <div className="mt-2 space-y-0.5">
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sucursal: <span className="text-slate-900">{filters?.branch || 'GENERAL'}</span></p>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Periodo: <span className="text-slate-900">{filters?.start} al {filters?.end}</span></p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="inline-block border-l-4 border-slate-900 pl-4 text-right">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 font-sans">Venta Neta Consolidada</p>
                                            <div className="text-3xl font-black text-slate-900 tracking-tighter font-sans">Q{formatCurr(totals?.ventas || 0)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Resumen Financiero */}
                            <div className="grid grid-cols-4 gap-4 mb-10 font-sans relative z-10 text-[11px] font-bold">
                                <div className="border border-slate-200 p-4 bg-slate-50">
                                    <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">TOTAL VENTAS</span>
                                    <div className="text-xl font-black">Q{formatCurr(totals?.ventas || 0)}</div>
                                </div>
                                <div className="border border-slate-200 p-4 bg-white">
                                    <span className="text-[9px] font-black text-blue-400 uppercase block mb-1">ABONOS CRÉDITOS</span>
                                    <div className="text-xl font-black text-blue-700">Q{formatCurr(totals?.abonos || 0)}</div>
                                </div>
                                <div className="border border-slate-200 p-4 bg-white">
                                    <span className="text-[9px] font-black text-emerald-400 uppercase block mb-1">PROPINAS ACUM.</span>
                                    <div className="text-xl font-black text-emerald-700">Q{formatCurr(totals?.propinas || 0)}</div>
                                </div>
                                <div className="border border-slate-200 p-4 bg-red-50/30">
                                    <span className="text-[9px] font-black text-red-400 uppercase block mb-1">GASTOS OPERATIVOS</span>
                                    <div className="text-xl font-black text-red-700">Q{formatCurr(totals?.gastos || 0)}</div>
                                </div>
                            </div>

                            {/* Tabla de Detalle */}
                            <div className="mb-12 relative z-10">
                                <div className="bg-[#106ebe] text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest mb-4 flex justify-between items-center font-sans">
                                    <div className="flex items-center gap-2">
                                        <ClipboardList size={14} />
                                        <span>Detalle Cronológico de Turnos</span>
                                    </div>
                                    <span>{data?.length || 0} TURNOS AUDITADOS</span>
                                </div>

                                <table className="w-full border-collapse font-sans text-[10px]">
                                    <thead>
                                        <tr className="bg-slate-100 border-b-2 border-slate-900 font-black uppercase text-slate-600">
                                            <th className="px-2 py-3 text-left">APERTURA</th>
                                            <th className="px-2 py-3 text-left">CIERRE</th>
                                            <th className="px-2 py-3 text-left">CAJA / TURNO</th>
                                            <th className="px-2 py-3 text-left">CAJERO</th>
                                            <th className="px-2 py-3 text-right">VENTAS</th>
                                            <th className="px-2 py-3 text-right">GASTOS</th>
                                            <th className="px-2 py-3 text-right">BALANCE</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-bold">
                                        {data?.map((s, i) => (
                                            <tr key={i} className="h-9">
                                                <td className="px-2 whitespace-nowrap">{s.start_time ? new Date(s.start_time).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}</td>
                                                <td className="px-2 whitespace-nowrap">{s.end_time ? new Date(s.end_time).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'ABIERTO'}</td>
                                                <td className="px-2 uppercase truncate max-w-[120px]">{s.cash_registers?.name || 'S/C'} - T{s.shift_number || 1}</td>
                                                <td className="px-2 uppercase truncate max-w-[120px]">{s.profiles?.full_name || s.profiles?.name || '---'}</td>
                                                <td className="px-2 text-right">Q{formatCurr(s.ventas)}</td>
                                                <td className="px-2 text-right text-red-500">Q{formatCurr(s.gastos)}</td>
                                                <td className="px-2 text-right font-black">Q{formatCurr(Number(s.ventas || 0) + Number(s.abonos || 0) - Number(s.gastos || 0))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-900 bg-slate-50 h-10 font-black uppercase">
                                            <td colSpan={4} className="px-2 text-right">Sumatoria de Auditoría:</td>
                                            <td className="px-2 text-right">Q{formatCurr(totals?.ventas || 0)}</td>
                                            <td className="px-2 text-right text-red-600">Q{formatCurr(totals?.gastos || 0)}</td>
                                            <td className="px-2 text-right bg-[#106ebe] text-white">Q{formatCurr(totals.ventas + totals.abonos - totals.gastos)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Footer Firmas */}
                            <div className="mt-24 grid grid-cols-3 gap-10 px-6 font-sans relative z-10">
                                <div className="border-t border-slate-900 pt-4 text-center">
                                    <p className="text-[9px] font-black uppercase text-slate-900">FIRMA CAJERO(A)</p>
                                    <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase">Responsable de Turno</p>
                                </div>
                                <div className="border-t border-slate-900 pt-4 text-center">
                                    <p className="text-[9px] font-black uppercase text-slate-900">ADMINISTRACIÓN</p>
                                    <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase">Validación de Valores</p>
                                </div>
                                <div className="border-t border-slate-900 pt-4 text-center">
                                    <p className="text-[9px] font-black uppercase text-slate-900">AUDITORÍA INTERNA</p>
                                    <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase">Control de Ingresos</p>
                                </div>
                            </div>

                            <div className="mt-16 text-[8px] flex justify-between items-center text-slate-300 font-mono tracking-widest uppercase">
                                <span>ANTIGRAVITY OS — ADMINISTRATIVE SUITE</span>
                                <span>GENERADO POR: {String(userId || 'ANON').toUpperCase()} — {new Date().toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </DraggableWindow >
        </div >,
        document.body
    );
};

export const ReportCaja: React.FC = () => {
    // Contexto de usuario
    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const is_admin = cachedUser?.role === 'admin' || cachedUser?.role === 'superadmin';
    const bId = cachedUser?.branch_id || '';

    const userId = cachedUser?.id || 'anon';
    const STORAGE_KEY = `ReportCaja_State_${userId}`;

    // Estado
    const [savedState] = useState(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    });

    const [loading, setLoading] = useState(false);
    const [shifts, setShifts] = useState<any[]>(savedState?.shifts || []);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState(savedState?.selectedBranch || 'ALL');

    // Filtros (Fechas) - Default al inicio del mes actual
    const [startDate, setStartDate] = useState(savedState?.startDate || (() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        return firstDay.toISOString().split('T')[0];
    })());
    const [endDate, setEndDate] = useState(savedState?.endDate || new Date().toISOString().split('T')[0]);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

    // Cargar Sucursales
    useEffect(() => {
        const loadBranches = async () => {
            const { data: bData } = await supabase.from('branches').select('*').order('name');
            if (bData) setBranches(bData);
        };
        loadBranches();

        // Si no hay datos previos, generar reporte automáticamente
        if (!savedState) {
            handleGenerate();
        }
    }, []);

    useEffect(() => {
        const state = { shifts, selectedBranch, startDate, endDate };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [shifts, selectedBranch, startDate, endDate, STORAGE_KEY]);

    const handleGenerate = async () => {
        setLoading(true);
        console.log('Fetching shifts for:', { startDate, endDate, selectedBranch });
        try {
            let query = supabase
                .from('shifts')
                .select(`
                    *,
                    cash_registers (name, branch_id),
                    profiles:cashier_id (full_name, name)
                `)
                .order('start_time', { ascending: false });

            // Rango de fechas
            query = query.gte('start_time', `${startDate}T00:00:00`);
            query = query.lte('start_time', `${endDate}T23:59:59`);

            // Filtrado por sucursal si no es 'ALL'
            if (selectedBranch && selectedBranch !== 'ALL') {
                // Como shifts.branch_id puede ser null, filtramos por la relación con cash_registers
                // query = query.filter('cash_registers.branch_id', 'eq', selectedBranch);
                // Nota: PostgREST requiere inner join para filtrar por relaciones
                query = query.filter('branch_id', 'eq', selectedBranch);
            }

            const { data: shiftsData, error } = await query;
            if (error) throw error;

            console.log(`Found ${shiftsData?.length || 0} shifts`);

            if (!shiftsData) {
                setShifts([]);
                setLoading(false);
                return;
            }

            // Enriquecer datos con totales (Ventas, Abonos, Propinas, Gastos)
            const enrichedShifts = await Promise.all(shiftsData.map(async (shift: any) => {
                // Ventas (Neto)
                const { data: orders } = await supabase
                    .from('orders')
                    .select('total, tip_amount')
                    .eq('shift_id', shift.id)
                    .eq('status', 'completed');

                let ventas = 0;
                let propinas = 0;
                orders?.forEach(o => {
                    const tip = Number(o.tip_amount || 0);
                    ventas += (Number(o.total || 0) - tip);
                    propinas += tip;
                });

                // Gastos
                const { data: expenses } = await supabase
                    .from('expenses')
                    .select('amount')
                    .eq('shift_id', shift.id)
                    .eq('is_void', false);
                const gastos = expenses?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;

                // Abonos
                const { data: abonos } = await supabase
                    .from('credit_transactions')
                    .select('amount')
                    .eq('type', 'PAYMENT')
                    .gte('created_at', shift.start_time)
                    .lte('created_at', shift.end_time || new Date().toISOString());
                const totalAbonos = abonos?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;

                return {
                    ...shift,
                    ventas,
                    propinas,
                    gastos,
                    abonos: totalAbonos
                };
            }));

            setShifts(enrichedShifts);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Lógica de filtrado en cliente (DataGrid style)
    const filteredShifts = useMemo(() => {
        return shifts.filter((s: any) => {
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const p = s.profiles;
                const r = s.cash_registers;
                const text = `${p?.full_name || p?.name || ''} ${r?.name || ''} ${s.shift_number || ''}`.toLowerCase();
                if (!text.includes(search)) return false;
            }
            // Filtros por columna
            for (const [col, filter] of Object.entries(columnFilters)) {
                if (!filter) continue;
                const f = String(filter).toLowerCase();
                if (col === 'caja' && !String(s.cash_registers?.name || '').toLowerCase().includes(f)) return false;
                if (col === 'aperturado' && !String(s.profiles?.full_name || s.profiles?.name || '').toLowerCase().includes(f)) return false;
            }
            return true;
        });
    }, [shifts, searchTerm, columnFilters]);

    const totals = useMemo(() => {
        return filteredShifts.reduce((acc, s: any) => ({
            ventas: acc.ventas + (s.ventas || 0),
            abonos: acc.abonos + (s.abonos || 0),
            propinas: acc.propinas + (s.propinas || 0),
            gastos: acc.gastos + (s.gastos || 0)
        }), { ventas: 0, abonos: 0, propinas: 0, gastos: 0 });
    }, [filteredShifts]);

    const handleExportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredShifts.map(s => ({
            'Apertura': s.start_time, 'Cierre': s.end_time, 'Caja': s.cash_registers?.name,
            'Turno No.': s.shift_number, 'Ventas': s.ventas, 'Abonos': s.abonos, 'Propinas': s.propinas, 'Gastos': s.gastos
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');
        XLSX.writeFile(wb, `Cortes_Caja_${startDate}.xlsx`);
    };

    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const selectedBranchLabel = selectedBranch === 'ALL' ? 'Todas las Sucursales' : branches.find(b => b.id === selectedBranch)?.name || 'Sucursal';

    const handlePrintExport = () => {
        // En lugar de exportar directo, habilitamos la vista previa premium
        setShowPrintPreview(true);
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#f0f0f0] font-sans text-[11px] overflow-hidden">
            {/* 1. Pestraña de Tab (Cortes de Caja) */}
            <div className="flex items-end px-2 bg-white border-b border-gray-300">
                <div className="flex items-center gap-4 px-4 py-1.5 bg-[#f0f0f0] border-t border-l border-r border-gray-300 rounded-t-lg min-w-[120px]">
                    <span className="font-bold text-gray-800">Cortes de Caja</span>
                    <X size={12} className="text-gray-400 hover:text-red-500 cursor-pointer" />
                </div>
            </div>

            {/* 2. Toolbar de Filtros (Sucursal) */}
            <div className="p-2 flex items-center gap-4 bg-[#f0f0f0] border-b border-gray-300">
                <span className="font-bold text-black">Sucursal</span>
                <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="h-6 px-1 border border-gray-400 bg-white min-w-[300px] outline-none text-black"
                >
                    <option value="ALL">Todas las Sucursales</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>

            {/* 3. Panel de Fechas */}
            <div className="p-3 bg-[#f0f0f0]">
                <div className="border border-gray-300 rounded pb-3 relative">
                    <span className="absolute -top-2 left-4 bg-[#f0f0f0] px-2 font-bold text-gray-700">Fechas</span>
                    <div className="mt-4 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-2">
                                <span className="text-black">Del:</span>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-6 border border-gray-400 px-2 text-black bg-white" />
                                <span className="text-black">Al:</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-6 border border-gray-400 px-2 text-black bg-white" />
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleGenerate} className="h-7 px-8 bg-white border border-gray-400 hover:bg-gray-100 flex items-center gap-2 shadow-sm font-bold text-black text-[12px]">
                                    Generar
                                </button>
                                <button onClick={handlePrintExport} className="h-7 px-6 bg-white border border-gray-400 hover:bg-gray-100 flex items-center gap-2 shadow-sm font-bold text-black text-[12px]">
                                    <Printer size={14} className="text-blue-600" /> Vista Previa
                                </button>
                            </div>
                        </div>

                        {/* Buscador al fondo lado derecho */}
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                placeholder="Introduzca texto a buscar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-7 w-[200px] border border-gray-400 px-2 italic outline-none text-black bg-white"
                            />
                            <button className="h-7 px-4 bg-white border border-gray-400 hover:bg-gray-100 font-bold text-black shadow-sm">Buscar</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Data Grid (Table) + Total Footer en el mismo scroll horizontal */}
            <div id="report-caja-container" className="flex-1 overflow-auto bg-white relative">
                <table className="w-full border-collapse border-slate-300 table-fixed min-w-[1376px]">
                    <thead className="sticky top-0 z-20">
                        {/* Headers Principales */}
                        <tr className="bg-[#f0f0f0] h-9">
                            <th className="border border-gray-300 px-2 font-bold text-center w-32 text-black">Apertura</th>
                            <th className="border border-gray-300 px-2 font-bold text-center w-32 text-black">Cierre</th>
                            <th className="border border-gray-300 px-2 font-bold text-center w-32 text-black">Caja</th>
                            <th className="border border-gray-300 px-2 font-bold text-center w-24 text-black">Turno No.</th>
                            <th className="border border-gray-300 px-2 font-bold text-center w-48 text-black">Aperturado Por</th>
                            <th className="border border-gray-300 px-2 font-bold text-center w-48 text-black">Cerrado Por</th>
                            <th className="border border-gray-300 px-2 font-bold text-center w-32 text-black">Ventas</th>
                            <th className="border border-gray-300 px-2 font-bold text-center w-32 text-black">Abonos Créditos</th>
                            <th className="border border-gray-300 px-2 font-bold text-center w-32 text-black">Propinas</th>
                            <th className="border border-gray-300 px-2 font-bold text-center w-32 text-black">Gastos</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredShifts.map((s, idx) => (
                            <tr key={s.id} className={`h-8 hover:bg-blue-50 cursor-default ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                <td className="border border-gray-200 px-2 text-black">{s.start_time ? new Date(s.start_time).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}</td>
                                <td className="border border-gray-200 px-2 text-black">{s.end_time ? new Date(s.end_time).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'ABIERTO'}</td>
                                <td className="border border-gray-200 px-2 font-bold text-black text-center">{s.cash_registers?.name || '---'}</td>
                                <td className="border border-gray-200 px-2 text-center text-black font-semibold">{s.shift_number || '1'}</td>
                                <td className="border border-gray-200 px-2 uppercase font-semibold text-black text-center">{s.profiles?.full_name || s.profiles?.name || '---'}</td>
                                <td className="border border-gray-200 px-2 text-black font-semibold uppercase text-center">{s.profiles?.full_name || s.profiles?.name || '---'}</td>
                                <td className="border border-gray-200 px-2 text-right font-bold text-black whitespace-nowrap">Q{Number(s.ventas || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                                <td className="border border-gray-200 px-2 text-right text-black whitespace-nowrap">Q{Number(s.abonos || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                                <td className="border border-gray-200 px-2 text-right text-black whitespace-nowrap">Q{Number(s.propinas || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                                <td className="border border-gray-200 px-2 text-right font-bold text-black whitespace-nowrap">Q{Number(s.gastos || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer de Totales — siempre al fondo */}
            <div className="shrink-0 overflow-x-auto bg-[#106ebe] border-t-2 border-gray-900 pb-2 custom-scrollbar">
                <div className="min-w-[1376px] flex items-center h-12 uppercase font-bold text-[11px] text-white">
                    <div className="w-32 px-2"></div>
                    <div className="w-32 px-2"></div>
                    <div className="w-32 px-2"></div>
                    <div className="w-24 px-2"></div>
                    <div className="w-48 px-2"></div>
                    <div className="w-48 px-2 text-right text-gray-400 tracking-tight">TOTALES:</div>
                    <div className="w-32 px-2 text-right tabular-nums border-l border-gray-600">Q{totals.ventas.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</div>
                    <div className="w-32 px-2 text-right tabular-nums border-l border-gray-600">Q{totals.abonos.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</div>
                    <div className="w-32 px-2 text-right tabular-nums border-l border-gray-600">Q{totals.propinas.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</div>
                    <div className="w-32 px-2 text-right tabular-nums border-l border-gray-600 text-blue-400 font-black">Q{totals.gastos.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>

            {
                showPrintPreview && (
                    <ShiftsPrintPreview
                        isOpen={showPrintPreview}
                        onClose={() => setShowPrintPreview(false)}
                        onExportExcel={handleExportExcel}
                        data={filteredShifts}
                        totals={totals}
                        filters={{ start: startDate, end: endDate, branch: selectedBranchLabel }}
                        userId={userId}
                    />
                )
            }
        </div >
    );
};
