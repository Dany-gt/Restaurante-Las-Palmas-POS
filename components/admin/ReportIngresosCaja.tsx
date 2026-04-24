
import React, { useState, useEffect, useMemo } from 'react';
import {
    Download, Printer, Search, Filter, Calendar, FileText,
    ChevronDown, ChevronRight, X, Clock, FileSpreadsheet,
    Loader2, Hash, CreditCard, DollarSign, Wallet, ArrowDownToLine, Scissors,
    History
} from 'lucide-react';
import { supabase } from '../../supabase';
import { createPortal } from 'react-dom';
import { useReactToPrint } from 'react-to-print';
import { DraggableWindow } from './DraggableWindow';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

// Estilos ERP Classic
const THEME = {
    headerBg: '#f0f0f0',
    border: '#c0c0c0',
    selected: '#0078d7',
    text: '#000000',
    muted: '#666666'
};

const formatCurr = (v: number) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// --- MODAL DE VISTA PREVIA DE IMPRESIÓN ---
const ReceiptsPrintPreview: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    data: any[],
    totals: any,
    filters: { start: string, end: string, branch: string, mode?: string },
    userId: string
}> = ({ isOpen, onClose, data, totals, filters, userId }) => {
    const printRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Reporte_Ingresos_Caja_${filters?.start || 'export'}`,
    });

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-6">
            <DraggableWindow>
                <div className="bg-[#f0f0f0] border-2 border-[#106ebe] shadow-2xl flex flex-col w-[95vw] max-w-5xl h-[95vh] overflow-hidden select-none font-sans">
                    {/* Toolbar */}
                    <div className="modal-header bg-[#106ebe] h-10 px-4 flex justify-between items-center text-white shrink-0 cursor-move border-b border-black">
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
                            <Printer size={16} className="text-emerald-400" />
                            <span>Vista Previa de Impresión - Reporte de Ingresos</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handlePrint()} className="h-7 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-[10px] font-black uppercase flex items-center gap-2 transition-colors">
                                <Printer size={12} strokeWidth={3} /> IMPRIMIR REPORTE
                            </button>
                            <button onClick={() => {
                                const ws = XLSX.utils.json_to_sheet(data.map(d => ({
                                    'Ingreso': d.ingreso, 'No. Orden': d.noOrden, 'Caja': d.caja, 'Turno': d.turno,
                                    'Operado Por': d.operadoPor, 'Efectivo': d.efectivo, 'Tarjeta': d.tarjeta,
                                    'Crédito': d.credito, 'Otros': d.otros, 'Total Pagado': d.totalPagado
                                })));
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, 'Data');
                                XLSX.writeFile(wb, `Ingresos_Caja_${filters.start}.xlsx`);
                            }} className="h-7 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[10px] font-black uppercase flex items-center gap-2 transition-colors">
                                <FileSpreadsheet size={12} strokeWidth={3} /> EXCEL
                            </button>
                            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center hover:bg-red-500 transition-colors text-white ml-2">
                                <X size={22} strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    {/* Hoja Membretada */}
                    <div className="flex-1 overflow-auto bg-slate-700 p-10 custom-scrollbar shadow-inner">
                        <div ref={printRef} className="bg-white mx-auto p-16 shadow-2xl min-h-full w-[950px] text-black print:shadow-none print:w-full font-serif relative">
                            {/* Watermark Logo (Opcional, usando Lucide como ejemplo) */}
                            <div className="absolute top-10 right-16 opacity-10">
                                <FileSpreadsheet size={120} className="text-slate-400" />
                            </div>

                            {/* Header */}
                            <div className="text-center mb-10 border-b-2 border-slate-900 pb-8">
                                <h1 className="text-4xl font-black uppercase tracking-tighter mb-1 font-sans">RESTAURANTE LAS PALMAS</h1>
                                <p className="text-[12px] font-black uppercase text-slate-400 tracking-[0.4em] mb-4 font-sans">Sistema de Gestión de Ingresos y Auditoría</p>

                                <div className="flex justify-between items-end bg-slate-50 p-6 border border-slate-200 mt-6 font-sans">
                                    <div className="text-left">
                                        <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tight leading-none">{filters?.mode === 'REP_CASH_OTHER' ? 'REPORTE DE INGRESOS OTROS' : 'REPORTE INTEGRAL DE INGRESOS'}</h2>
                                        <div className="mt-2 space-y-0.5">
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sucursal: <span className="text-slate-900">{filters?.branch || 'GENERAL'}</span></p>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Periodo: <span className="text-slate-900">{filters?.start} al {filters?.end}</span></p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="inline-block border-l-4 border-emerald-500 pl-4 text-right">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Consolidado</p>
                                            <div className="text-3xl font-black text-slate-900 tracking-tighter">Q{formatCurr(totals?.totalPagado || 0)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Resumen por Método de Pago */}
                            <div className="grid grid-cols-4 gap-4 mb-10 font-sans">
                                <div className="border border-slate-200 p-4 bg-slate-50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Wallet size={12} className="text-slate-400" />
                                        <span className="text-[9px] font-black text-slate-400 uppercase">EFECTIVO</span>
                                    </div>
                                    <div className="text-xl font-black">Q{formatCurr(totals?.efectivo || 0)}</div>
                                </div>
                                <div className="border border-slate-200 p-4 bg-slate-50 border-emerald-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CreditCard size={12} className="text-emerald-400" />
                                        <span className="text-[9px] font-black text-emerald-400 uppercase">TARJETA</span>
                                    </div>
                                    <div className="text-xl font-black text-emerald-700">Q{formatCurr(totals?.tarjeta || 0)}</div>
                                </div>
                                <div className="border border-slate-200 p-4 bg-slate-50 border-blue-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <History size={12} className="text-blue-400" />
                                        <span className="text-[9px] font-black text-blue-400 uppercase">CRÉDITO</span>
                                    </div>
                                    <div className="text-xl font-black text-blue-700">Q{formatCurr(totals?.credito || 0)}</div>
                                </div>
                                <div className="border border-slate-200 p-4 bg-slate-50 border-amber-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <DollarSign size={12} className="text-amber-400" />
                                        <span className="text-[9px] font-black text-amber-400 uppercase">OTROS</span>
                                    </div>
                                    <div className="text-xl font-black text-amber-700">Q{formatCurr(totals?.otros || 0)}</div>
                                </div>
                            </div>

                            {/* Tabla de Detalle */}
                            <div className="mb-12">
                                <div className="bg-[#106ebe] text-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] mb-4 flex justify-between items-center font-sans">
                                    <div className="flex items-center gap-2">
                                        <FileText size={14} />
                                        <span>Detalle de Transacciones Auditoras</span>
                                    </div>
                                    <span className="text-slate-400 text-[9px] tracking-normal font-bold uppercase">{data.length} REGISTROS CARGADOS</span>
                                </div>

                                <table className="w-full border-collapse font-sans">
                                    <thead>
                                        <tr className="bg-slate-100 border-b-2 border-slate-900 text-[9px] font-black uppercase tracking-wider text-slate-600">
                                            <th className="px-3 py-3 text-left">FECHA/HORA</th>
                                            <th className="px-3 py-3 text-center">NO. ORDEN</th>
                                            <th className="px-3 py-3 text-left">OPERADOR</th>
                                            <th className="px-3 py-3 text-right">EFECTIVO</th>
                                            <th className="px-3 py-3 text-right">TARJETA</th>
                                            <th className="px-3 py-3 text-right">TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[11px] font-bold divide-y divide-slate-100">
                                        {data.map((row, i) => (
                                            <tr key={i} className="h-10">
                                                <td className="px-3 text-slate-500 whitespace-nowrap">{row.ingreso}</td>
                                                <td className="px-3 text-center font-black text-slate-900">ORD-{row.noOrden}</td>
                                                <td className="px-3 text-slate-500 uppercase truncate max-w-[150px]">{row.operadoPor}</td>
                                                <td className="px-3 text-right text-slate-400 font-normal">Q{formatCurr(row.efectivo)}</td>
                                                <td className="px-3 text-right text-slate-400 font-normal">Q{formatCurr(row.tarjeta)}</td>
                                                <td className="px-3 text-right bg-slate-50/50 font-black">Q{formatCurr(row.totalPagado)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-900 bg-slate-50 h-10 font-black text-[11px] uppercase tracking-wide">
                                            <td colSpan={3} className="px-3 text-right text-slate-400">Sumatoria de Columna:</td>
                                            <td className="px-3 text-right">Q{formatCurr(totals?.efectivo || 0)}</td>
                                            <td className="px-3 text-right text-emerald-600">Q{formatCurr(totals?.tarjeta || 0)}</td>
                                            <td className="px-3 text-right bg-emerald-100">Q{formatCurr(totals?.totalPagado || 0)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Footer Firmas - Muy Importante para Control Administrativo */}
                            <div className="mt-24 grid grid-cols-2 gap-20 px-10 font-sans">
                                <div className="border-t-2 border-slate-900 pt-5 text-center">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-900">FIRMA ADMINISTRATIVA</p>
                                    <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase">Validación de Ingresos y Cuadre de Caja</p>
                                    <div className="mt-8 text-[8px] font-bold text-slate-300 uppercase tracking-tighter">LAS PALMAS — ERP AUDIT SYSTEM</div>
                                </div>
                                <div className="border-t-2 border-slate-900 pt-5 text-center">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-900">CONTROL DE CONTABILIDAD</p>
                                    <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase">Recepción de Fondos Integrales</p>
                                    <div className="mt-8 text-[8px] font-bold text-slate-300 uppercase tracking-tighter">Generado por: {String(userId || 'ANON').toUpperCase()}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DraggableWindow>
        </div>,
        document.body
    );
};

export const ReportIngresosCaja: React.FC<{ mode?: 'REP_CASH_IN' | 'REP_CASH_OTHER' }> = ({ mode = 'REP_CASH_IN' }) => {
    dayjs.locale('es');

    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = cachedUser?.id || 'anon';
    const STORAGE_KEY = `ReportIngresosCaja_State_${userId}`;

    // Restore state synchronously on mount
    const [savedState] = useState(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    });

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>(savedState?.data || []);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState(savedState?.selectedBranch || 'ALL');

    // Fechas
    const [startDate, setStartDate] = useState(savedState?.startDate || dayjs().format('YYYY-MM-DD'));
    const [endDate, setEndDate] = useState(savedState?.endDate || dayjs().format('YYYY-MM-DD'));
    const [startTime, setStartTime] = useState(savedState?.startTime || '00:00');
    const [endTime, setEndTime] = useState(savedState?.endTime || '23:59');

    // Filtros UI
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintPreview, setShowPrintPreview] = useState(false);

    useEffect(() => {
        const fetchMetadata = async () => {
            const { data: b } = await supabase.from('branches').select('id, name').order('name');
            if (b) setBranches(b);
        };
        fetchMetadata();

        // Si no hay datos previos, generar reporte automáticamente
        if (!savedState) {
            handleGenerate();
        }
    }, []);

    useEffect(() => {
        // Solo guardar si hay algo relevante que guardar para evitar sobreescribir con valores por defecto al montar
        const state = { data, selectedBranch, startDate, endDate, startTime, endTime };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [data, selectedBranch, startDate, endDate, startTime, endTime, STORAGE_KEY]);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const startStr = `${startDate} ${startTime}:00`;
            const endStr = `${endDate} ${endTime}:59`;

            let query = supabase.from('orders')
                .select(`
                    id, created_at, order_number, total, payment_method, 
                    tip_amount, discount_amount,
                    branch_id, status,
                    shift:shifts!shift_id(
                        shift_number, 
                        cash_registers(name),
                        profiles!cashier_id(name, full_name)
                    ),
                    waiter:profiles!waiter_id(name, full_name)
                `)
                .neq('status', 'cancelled')
                .gte('created_at', startStr)
                .lte('created_at', endStr)
                .order('created_at', { ascending: false });

            if (selectedBranch !== 'ALL') query = query.eq('branch_id', selectedBranch);

            const { data: results, error } = await query;

            if (error) {
                console.error("Supabase Error:", error);
                alert("Atención: Error de base de datos - " + error.message);
                throw error;
            }

            console.log("Raw orders from Supabase:", results?.length || 0);

            let processed = (results || []).map(o => {
                const shiftData = Array.isArray(o.shift) ? o.shift[0] : o.shift;
                const method = (o.payment_method || 'EFECTIVO').toUpperCase();
                const totalVal = Number(o.total || 0);

                return {
                    id: o.id,
                    ingreso: dayjs(o.created_at).format('DD/MM/YYYY HH:mm'),
                    noOrden: o.order_number,
                    cuenta: '1', // Default
                    caja: (() => {
                        const s = Array.isArray(o.shift) ? o.shift[0] : o.shift;
                        const crRaw = (s as any)?.cash_registers;
                        const cr = Array.isArray(crRaw) ? crRaw[0] : crRaw;
                        return cr?.name || 'PRINCIPAL';
                    })(),
                    turno: (() => {
                        const s = Array.isArray(o.shift) ? o.shift[0] : o.shift;
                        return (s as any)?.shift_number || '1';
                    })(),
                    operadoPor: (() => {
                        const s = Array.isArray(o.shift) ? o.shift[0] : o.shift;
                        const shiftProfiles = (s as any)?.profiles;
                        const waiterData = (o as any)?.waiter;
                        const c = Array.isArray(shiftProfiles) ? shiftProfiles[0] : shiftProfiles;
                        const w = Array.isArray(waiterData) ? waiterData[0] : waiterData;
                        return c?.full_name || c?.name || w?.full_name || w?.name || 'USUARIO';
                    })(),
                    efectivo: method === 'EFECTIVO' ? totalVal : 0,
                    tarjeta: method.includes('TARJETA') ? totalVal : 0,
                    credito: (method.includes('CREDITO') || method.includes('CRÉDITO')) ? totalVal : 0,
                    otros: (!['EFECTIVO'].includes(method) && !method.includes('TARJETA') && !method.includes('CREDIT')) ? totalVal : 0,
                    totalCuenta: totalVal,
                    totalPagado: totalVal,
                    cambio: 0
                };
            });

            if (mode === 'REP_CASH_OTHER') {
                processed = processed.filter((row: any) => row.efectivo === 0 && row.tarjeta === 0 && (row.credito > 0 || row.otros > 0));
            }

            console.log("Processed mapped rows:", processed?.length || 0);
            setData(processed);
        } catch (error: any) {
            console.error('Error fetching data:', error);
            alert("Ocurrió un error al cargar la información: " + (error?.message || 'Revisa la consola.'));
        } finally {
            setLoading(false);
        }
    };

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchesSearch = searchTerm === '' ||
                d.noOrden?.toString().includes(searchTerm) ||
                String(d.operadoPor || '').toLowerCase().includes(searchTerm.toLowerCase());

            return matchesSearch;
        });
    }, [data, searchTerm]);

    const totals = useMemo(() => {
        return filteredData.reduce((acc, curr) => ({
            efectivo: acc.efectivo + curr.efectivo,
            tarjeta: acc.tarjeta + curr.tarjeta,
            credito: acc.credito + curr.credito,
            otros: acc.otros + curr.otros,
            totalCuenta: acc.totalCuenta + curr.totalCuenta,
            totalPagado: acc.totalPagado + curr.totalPagado,
            cambio: acc.cambio + curr.cambio
        }), { efectivo: 0, tarjeta: 0, credito: 0, otros: 0, totalCuenta: 0, totalPagado: 0, cambio: 0 });
    }, [filteredData]);

    const handlePrintExport = () => {
        setShowPrintPreview(true);
    };

    const selectedBranchLabel = selectedBranch === 'ALL' ? 'Todas las Sucursales' : branches.find(b => b.id === selectedBranch)?.name || 'Sucursal';

    return (
        <div className="flex flex-col h-full bg-[#f0f0f0] font-sans text-[11px] overflow-hidden select-none">
            {showPrintPreview && (
                <ReceiptsPrintPreview
                    isOpen={showPrintPreview}
                    onClose={() => setShowPrintPreview(false)}
                    data={filteredData}
                    totals={totals}
                    filters={{ start: startDate, end: endDate, branch: selectedBranchLabel, mode }}
                    userId={userId}
                />
            )}
            {/* 1. Pestana de Tab */}
            <div className="flex items-end px-2 bg-white border-b border-gray-300">
                <div className="flex items-center gap-4 px-4 py-1.5 bg-[#f0f0f0] border-t border-l border-r border-gray-300 rounded-t-lg min-w-[120px]">
                    <span className="font-bold text-gray-800">{mode === 'REP_CASH_OTHER' ? 'Ingresos Otros' : 'Ingresos a Caja'}</span>
                    <X size={12} className="text-gray-400 hover:text-red-500 cursor-pointer" />
                </div>
            </div>

            {/* 2. Toolbar de Filtros */}
            <div className="p-2 flex items-center gap-4 bg-[#f0f0f0] border-b border-gray-300 shrink-0">
                <span className="font-bold text-black">Sucursal</span>
                <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="h-6 px-1 border border-gray-400 bg-white min-w-[300px] outline-none text-black shadow-inner"
                >
                    <option value="ALL">Todas las Sucursales</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>

            {/* 3. Filter Box */}
            <div className="p-3 bg-[#f0f0f0] shrink-0">
                <div className="border border-[#c0c0c0] rounded-sm pb-3 pt-4 relative bg-[#f0f0f0] shadow-sm">
                    <span className="absolute -top-2 left-4 bg-[#f0f0f0] px-2 font-bold text-gray-700 uppercase tracking-tighter text-[9px]">Fechas</span>
                    <div className="flex items-center justify-between px-4">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-x-4">
                                <div className="flex items-center gap-x-2">
                                    <span className="font-bold text-gray-600">Del:</span>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-6 border border-gray-400 px-1 text-black bg-white outline-none focus:border-blue-500" />
                                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-6 border border-gray-400 px-1 text-black bg-white outline-none w-[84px] focus:border-blue-500 ml-1" />
                                </div>
                                <div className="flex items-center gap-x-2">
                                    <span className="font-bold text-gray-600">Al:</span>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-6 border border-gray-400 px-1 text-black bg-white outline-none focus:border-blue-500" />
                                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-6 border border-gray-400 px-1 text-black bg-white outline-none w-[84px] focus:border-blue-500 ml-1" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 capitalize">
                                <button onClick={handleGenerate} className="h-7 px-8 bg-white border border-gray-400 hover:bg-gray-100 flex items-center gap-2 shadow-sm font-bold text-black text-[11px] active:bg-gray-200">
                                    Generar
                                </button>
                                <button onClick={handlePrintExport} className="h-7 px-6 bg-white border border-gray-400 hover:bg-gray-100 flex items-center gap-2 shadow-sm font-bold text-black text-[11px] active:bg-gray-200 transition-colors">
                                    <Printer size={12} className="text-blue-600" /> Vista Previa
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <div className="relative">
                                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Introduzca texto a buscar..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-7 w-[200px] border border-gray-400 pl-8 pr-2 outline-none text-black bg-white focus:border-blue-500"
                                />
                            </div>
                            <button className="h-7 px-4 bg-white border border-gray-400 hover:bg-gray-100 font-bold text-black shadow-sm text-[11px]">Buscar</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Main Grid Area */}
            <div className="flex-1 overflow-auto bg-white custom-scrollbar relative" id="report-container">
                <table className="w-full border-collapse border-spacing-0 table-fixed min-w-[1770px]">
                    <colgroup>
                        <col style={{ width: '140px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '150px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '200px' }} />
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '150px' }} />
                        <col style={{ width: '160px' }} />
                        <col style={{ width: '150px' }} />
                    </colgroup>
                    <thead className="sticky top-0 z-20">
                        {/* Column Headers */}
                        <tr className="bg-[#f0f0f0] h-9 border-b border-gray-300">
                            {[
                                'Ingreso', 'No. Orden', 'Cuenta', 'Caja', 'Turno', 'Operado Por',
                                'Efectivo', 'Tarjeta', 'Crédito', 'Otros', 'Total Cuenta', 'Total Pagado', 'Cambio'
                            ].map(label => (
                                <th key={label} className="border border-gray-300 px-2 font-bold text-center text-black bg-[#f0f0f0] text-[11px]">
                                    {label}
                                </th>
                            ))}
                        </tr>

                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredData.length === 0 && !loading && (
                            <tr>
                                <td colSpan={13} className="py-40 text-center text-slate-300 bg-white">
                                    <div className="flex flex-col items-center gap-2 opacity-40">
                                        <Search size={48} />
                                        <span className="text-lg font-black uppercase tracking-widest">No se encontraron registros</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {filteredData.map((row, idx) => (
                            <tr key={idx} className={`h-8 hover:bg-slate-100 group cursor-default transition-all duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8f9fa]'} border-b border-gray-200`}>
                                <td className="border border-gray-300 px-2 whitespace-nowrap text-center tabular-nums text-black text-[11px]">{row.ingreso}</td>
                                <td className="border border-gray-300 px-2 text-center text-black text-[11px] font-bold">#{row.noOrden}</td>
                                <td className="border border-gray-300 px-2 text-center text-black text-[11px]">{row.cuenta}</td>
                                <td className="border border-gray-300 px-2 uppercase text-center text-black text-[11px]">{row.caja}</td>
                                <td className="border border-gray-300 px-2 text-center text-black text-[11px]">{row.turno}</td>
                                <td className="border border-gray-300 px-2 uppercase text-black text-[11px] truncate">{row.operadoPor}</td>
                                <td className="border border-gray-300 px-4 text-right tabular-nums text-black text-[11px] font-medium">Q{formatCurr(row.efectivo)}</td>
                                <td className="border border-gray-300 px-4 text-right tabular-nums text-black text-[11px] font-medium">Q{formatCurr(row.tarjeta)}</td>
                                <td className="border border-gray-300 px-4 text-right tabular-nums text-black text-[11px] font-medium">Q{formatCurr(row.credito)}</td>
                                <td className="border border-gray-300 px-4 text-right tabular-nums text-black text-[11px]">Q{formatCurr(row.otros)}</td>
                                <td className="border border-gray-300 px-4 text-right tabular-nums text-black text-[11px] font-bold">Q{formatCurr(row.totalCuenta)}</td>
                                <td className="border border-gray-300 pr-10 text-right tabular-nums text-black text-[11px] font-black bg-white">Q{formatCurr(row.totalPagado)}</td>
                                <td className="border border-gray-300 px-4 text-right tabular-nums text-gray-500 text-[10px]">Q{formatCurr(row.cambio)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer de Totales — siempre al fondo */}
            <div className="shrink-0 overflow-x-auto bg-[#106ebe] border-t-2 border-gray-900 pb-2 custom-scrollbar">
                <div className="min-w-[1770px] flex items-center h-12 uppercase font-bold text-[11px] text-white px-2">
                    <div className="w-[140px] px-2"></div>
                    <div className="w-[100px] px-2"></div>
                    <div className="w-[100px] px-2"></div>
                    <div className="w-[150px] px-2"></div>
                    <div className="w-[100px] px-2"></div>
                    <div className="w-[200px] px-8 text-right text-gray-400 tracking-tight">TOTALES:</div>
                    <div className="w-[130px] px-4 text-right tabular-nums">Q{formatCurr(totals.efectivo)}</div>
                    <div className="w-[130px] px-4 text-right tabular-nums">Q{formatCurr(totals.tarjeta)}</div>
                    <div className="w-[130px] px-4 text-right tabular-nums">Q{formatCurr(totals.credito)}</div>
                    <div className="w-[130px] px-4 text-right tabular-nums">Q{formatCurr(totals.otros)}</div>
                    <div className="w-[150px] px-4 text-right tabular-nums font-black">Q{formatCurr(totals.totalCuenta)}</div>
                    <div className="w-[160px] pr-10 text-right tabular-nums font-black text-blue-400">Q{formatCurr(totals.totalPagado)}</div>
                    <div className="w-[150px] px-4 text-right tabular-nums text-gray-400 font-normal">Q{formatCurr(totals.cambio)}</div>
                </div>
            </div>



            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
                #report-container { display: flex; flex-direction: column; }
                #report-container table { border-spacing: 0; }
            `}</style>
        </div>
    );
};

export default ReportIngresosCaja;
