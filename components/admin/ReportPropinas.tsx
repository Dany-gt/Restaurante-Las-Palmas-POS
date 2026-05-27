import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/supabase';
import {
    Search,
    Download,
    ChevronDown,
    ChevronRight,
    Loader2,
    Users,
    UserPlus,
    User,
    Navigation,
    AlertTriangle,
    X,
    Save,
    ClipboardCheck,
    History,
    ChefHat,
    Edit,
    Trash2,
    DollarSign,
    Wallet,
    CreditCard,
    CircleDollarSign,
    Scale,
    Printer,
    FileText,
    FileSpreadsheet
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');
import * as XLSX from 'xlsx';
import { generateUUID } from '@/utils/uuid';

// --- COMPONENTES DE APOYO INTERNOS ---
import { WindowsConfirmModal } from '@/components/WindowsConfirmModal';
import { DraggableWindow } from '@/components/admin/DraggableWindow';
import { WindowsSaveButton } from '@/components/WindowsSaveButton';

const formatCurr = (v: number) => (v || 0).toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' });

// --- MODAL DE VISTA PREVIA COMPLETA (INTERNO PARA DISTRIBUCIÓN) ---
const TipDistributionPrintPreview: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    results: any,
    employees: any[],
    dates: { start?: string, end?: string }
}> = ({ isOpen, onClose, results, employees, dates }) => {
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Planilla_Propinas_Completa_${dates.start}`,
    });

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-6">
            <DraggableWindow>
                <div className="bg-[#f0f0f0] border-2 border-[#22232a] shadow-2xl flex flex-col w-[95vw] max-w-5xl h-[95vh] overflow-hidden select-none font-sans">
                    {/* Toolbar */}
                    <div className="modal-header bg-[#106ebe] h-10 px-4 flex justify-between items-center text-white shrink-0 cursor-move border-b border-black">
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
                            <Printer size={16} className="text-emerald-400" />
                            <span>Planilla de Propinas Final (Borrador)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handlePrint()} className="h-7 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-[10px] font-black uppercase flex items-center gap-2">
                                <Printer size={12} strokeWidth={3} /> IMPRIMIR PDF
                            </button>
                            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center hover:bg-red-500 transition-colors text-white ml-2">
                                <X size={22} strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    {/* Hoja Membretada */}
                    <div className="flex-1 overflow-auto bg-slate-700 p-10 custom-scrollbar shadow-inner">
                        <div ref={printRef} className="bg-white mx-auto p-16 shadow-2xl min-h-full w-[950px] text-black print:shadow-none print:w-full font-serif">
                            {/* Header */}
                            <div className="text-center mb-10 border-b-2 border-gray-900 pb-8">
                                <h1 className="text-4xl font-black uppercase tracking-tighter mb-1 font-sans">RESTAURANTE LAS PALMAS</h1>
                                <p className="text-[12px] font-black uppercase text-gray-400 tracking-[0.4em] mb-4 font-sans">Control Administrativo de Distribución</p>
                                <div className="flex justify-between items-end bg-slate-50 p-4 border border-slate-100 font-sans">
                                    <div className="text-left">
                                        <h2 className="text-xl font-black uppercase text-slate-800 tracking-tight">PLANILLA INTEGRAL DE PROPINAS</h2>
                                        <p className="text-[11px] font-bold text-gray-500">Periodo: {dates.start} al {dates.end}</p>
                                    </div>
                                    <div className="text-right text-[10px] font-bold text-slate-400">
                                        <p>Generado hoy: {new Date().toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Resumen Fiscal */}
                            <div className="grid grid-cols-4 gap-4 mb-8">
                                <div className="border border-slate-200 p-4 bg-slate-50"><span className="text-[9px] font-black text-slate-400 block mb-1 uppercase">TOTAL BRUTO</span><div className="text-xl font-black">{formatCurr(results.netoDisponibleGlobal + results.totalRetencionAdmin)}</div></div>
                                <div className="border border-rose-100 p-4 bg-rose-50 text-rose-600"><span className="text-[9px] font-black text-rose-400 block mb-1 uppercase">RETENCIÓN (17%)</span><div className="text-xl font-black">-{formatCurr(results.totalRetencionAdmin)}</div></div>
                                <div className="border border-emerald-100 p-4 bg-emerald-50 text-emerald-700 font-sans"><span className="text-[9px] font-black text-emerald-400 block mb-1 uppercase">RECIBE MESEROS (55%)</span><div className="text-xl font-black">{formatCurr(results.fondoMeserosGlobal)}</div></div>
                                <div className="border border-blue-100 p-4 bg-blue-50 text-blue-700 font-sans"><span className="text-[9px] font-black text-blue-400 block mb-1 uppercase">RECIBE APOYO (45%)</span><div className="text-xl font-black">{formatCurr(results.fondoApoyoGlobal)}</div></div>
                            </div>

                            {/* Detalle Meseros */}
                            <div className="mb-10">
                                <div className="bg-[#106ebe] text-white px-4 py-2 text-[11px] font-black uppercase tracking-widest mb-3 flex justify-between">
                                    <span>PLANILLA MESEROS (55% DE LEY)</span>
                                    <span>{formatCurr(results.fondoMeserosGlobal)}</span>
                                </div>
                                <table className="w-full border-collapse">
                                    <thead><tr className="bg-slate-100 border-b border-black text-[10px] font-black uppercase"><th className="px-3 py-2 text-left">COLABORADOR</th><th className="px-3 py-2 text-right">SUBTOTAL 55%</th><th className="px-3 py-2 text-center">VALES</th><th className="px-3 py-2 text-right">TOTAL NETO</th></tr></thead>
                                    <tbody className="text-[12px] font-bold uppercase tracking-tight divide-y divide-slate-100">
                                        {results.meseros.map((m: any, i: number) => (
                                            <tr key={i} className="h-9">
                                                <td className="px-3">{m.name}</td>
                                                <td className="px-3 text-right tabular-nums text-slate-400 font-sans font-normal">{formatCurr(m.neto55)}</td>
                                                <td className="px-3 text-center tabular-nums text-rose-400">{m.vale > 0 ? `-${formatCurr(m.vale)}` : '--'}</td>
                                                <td className="px-3 text-right tabular-nums bg-slate-50">{formatCurr(m.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Detalle Apoyo */}
                            <div className="mb-12">
                                <div className="bg-emerald-800 text-white px-4 py-2 text-[11px] font-black uppercase tracking-widest mb-3 flex justify-between">
                                    <span>PLANILLA PERSONAL APOYO (45% DE LEY)</span>
                                    <span>{formatCurr(results.fondoApoyoGlobal)}</span>
                                </div>
                                <table className="w-full border-collapse">
                                    <thead><tr className="bg-slate-100 border-b border-black text-[10px] font-black uppercase"><th className="px-3 py-2 text-left">COLABORADOR</th><th className="px-3 py-2 text-right">CUOTA BASE</th><th className="px-3 py-2 text-center">VALES</th><th className="px-3 py-2 text-right">TOTAL NETO</th></tr></thead>
                                    <tbody className="text-[12px] font-bold uppercase tracking-tight divide-y divide-slate-100">
                                        {employees.map((e: any, i: number) => (
                                            <tr key={i} className="h-9">
                                                <td className="px-3">{e.name || '---'}</td>
                                                <td className="px-3 text-right tabular-nums text-slate-400 font-sans font-normal">{formatCurr(results.basePorPersonaApoyo)}</td>
                                                <td className="px-3 text-center tabular-nums text-rose-400">{e.vales > 0 ? `-${formatCurr(e.vales)}` : '--'}</td>
                                                <td className="px-3 text-right tabular-nums bg-emerald-50/20">{formatCurr(results.basePorPersonaApoyo - e.vales)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer Firmas */}
                            <div className="mt-20 flex justify-around px-8">
                                <div className="w-[250px] border-t-2 border-black pt-4 text-center">
                                    <p className="text-[11px] font-black uppercase">ADMINISTRACIÓN</p>
                                    <p className="text-[9px] text-gray-500 mt-1">Autorizado</p>
                                </div>
                                <div className="w-[250px] border-t-2 border-black pt-4 text-center">
                                    <p className="text-[11px] font-black uppercase">CONTABILIDAD</p>
                                    <p className="text-[9px] text-gray-500 mt-1">Recibido para Nomina</p>
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

// --- MODAL DE DISTRIBUCIÓN (PLAN DE ACCIÓN: DOBLE PLANILLA 55/45) ---
interface ManualTipProps {
    onClose: () => void;
    totalBruta: number;
    branchId?: string;
    startDate?: string;
    endDate?: string;
    waiterData?: any[];
}
const ManualTipDistributionModal: React.FC<ManualTipProps> = ({ onClose, totalBruta: initialTotalBruta, branchId, startDate, endDate, waiterData = [] }) => {
    const [meseroVales, setMeseroVales] = useState<Record<string, number>>({});
    const [employees, setEmployees] = useState<{ id: string, name: string, vales: number }[]>([{ id: generateUUID(), name: '', vales: 0 }]);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrintLocal = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Planilla_Final_Propinas_${startDate}`,
    });

    const results = useMemo(() => {
        // 1. CÁLCULO FISCAL (17% SOBRE FACTURADO)
        const totalFacturadoReporte = waiterData.reduce((acc, w) => acc + (w.totals.facturado || 0), 0);
        const totalRetencionAdmin = totalFacturadoReporte * 0.17;
        const netoDisponibleGlobal = initialTotalBruta - totalRetencionAdmin; // DINERO LÍQUIDO A REPARTIR

        // 2. REPARTO SEGÚN LEY (55 / 45)
        const fondoMeserosGlobal = netoDisponibleGlobal * 0.55;
        const fondoApoyoGlobal = netoDisponibleGlobal * 0.45;

        // 3. DESGLOSE INDIVIDUAL MESEROS (PROPORCIONAL)
        const meseros = (waiterData || []).map(w => {
            const bruto = w.totals?.total || 0;
            const facturado = w.totals?.facturado || 0;
            const retencion = facturado * 0.17;
            const ratio = initialTotalBruta > 0 ? bruto / initialTotalBruta : 0;
            // Cada mesero se lleva el 55% neto de su parte proporcional ya libre de impuestos
            const netoProporcional55 = fondoMeserosGlobal * ratio;
            const vale = meseroVales[w.name] || 0;
            return {
                name: w.name,
                ventaPropina: bruto,
                facturado,
                retencion,
                share55: netoProporcional55,
                neto55: netoProporcional55,
                vale,
                total: netoProporcional55 - vale
            };
        }).sort((a, b) => b.neto55 - a.neto55);

        // 4. DESGLOSE APOYO (EQUITATIVO)
        const basePorPersonaApoyo = employees.length > 0 ? fondoApoyoGlobal / employees.length : 0;

        return { totalRetencionAdmin, netoDisponibleGlobal, fondoMeserosGlobal, fondoApoyoGlobal, meseros, basePorPersonaApoyo };
    }, [initialTotalBruta, waiterData, meseroVales, employees.length]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const { data: dist, error } = await supabase.from('tip_distributions').insert([{ total_bruta: initialTotalBruta, retencion_manual: results.totalRetencionAdmin, total_liquido: results.netoDisponibleGlobal, fondo_meseros: results.fondoMeserosGlobal, fondo_apoyo: results.fondoApoyoGlobal, branch_id: branchId, periodo_inicio: startDate, periodo_fin: endDate }]).select().single();
            if (error) throw error;
            const items = [...employees.map(e => ({ distribution_id: dist.id, employee_name: e.name, vales_adelantos: e.vales, monto_neto: results.basePorPersonaApoyo - e.vales, type: 'APOYO' })), ...results.meseros.map(m => ({ distribution_id: dist.id, employee_name: m.name, vales_adelantos: m.vale, monto_neto: m.total, type: 'MESERO' }))];
            await supabase.from('tip_distribution_items').insert(items);
            onClose();
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60">
            <DraggableWindow>
                <div className="w-[1050px] bg-[#fdfdfd] border-2 border-[#106ebe] shadow-2xl flex flex-col overflow-hidden rounded-sm">
                    {/* Header Premium */}
                    <div className="modal-header bg-[#106ebe] h-10 px-4 flex justify-between items-center cursor-move border-b border-black shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                        <div className="flex items-center gap-2">
                            <Scale size={18} className="text-emerald-400" />
                            <span className="text-white text-[11px] font-black uppercase tracking-widest">Liquidación y Planilla de Propinas</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowPrintPreview(true)}
                                className="text-white hover:text-blue-400 transition-colors h-8 px-2 flex items-center gap-2 border border-white/10 rounded hover:bg-white/5"
                                title="Vista Previa de Impresión"
                            >
                                <Printer size={18} />
                                <span className="text-[9px] font-black uppercase">Imprimir / Exportar</span>
                            </button>
                            <div className="w-px h-5 bg-white/20 mx-1" />
                            <WindowsSaveButton onClick={() => setShowConfirm(true)} loading={loading} size={22} variant="minimal" />
                            <button onClick={onClose} className="text-white hover:text-red-500 transition-colors"><X size={26} /></button>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden min-h-[620px]">
                        {/* PANEL IZQUIERDO: BALANCE FISCAL */}
                        <div className="w-[300px] border-r bg-slate-50 p-6 space-y-6">
                            <div className="text-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 bg-slate-100 py-1 rounded-sm shadow-sm ring-1 ring-slate-200">1. Balance Fiscal</span></div>
                            <div className="space-y-4">
                                <div className="text-center py-2 bg-white border border-slate-200 rounded shadow-sm">
                                    <span className="text-[9px] font-black text-slate-400 uppercase">Propinas Brutas del Reporte</span>
                                    <div className="text-2xl font-black text-slate-800 tracking-tighter">{formatCurr(initialTotalBruta)}</div>
                                </div>
                                <div className="text-center border-2 border-red-100 bg-red-50/50 p-4 rounded-sm shadow-sm">
                                    <span className="text-[9px] font-black text-red-500 uppercase">Retención ISR/IVA (17%)</span>
                                    <div className="text-2xl font-black text-red-600 tracking-tighter">{formatCurr(results.totalRetencionAdmin)}</div>
                                </div>
                                <div className="text-center bg-[#106ebe] p-5 rounded-sm shadow-2xl relative overflow-hidden group">
                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1 block">Total Neto a Pagar</span>
                                    <div className="text-3xl font-black text-white tracking-tighter">{formatCurr(results.netoDisponibleGlobal)}</div>
                                </div>
                            </div>
                        </div>

                        {/* PANEL DERECHO: DOBLE PLANILLA (MESEROS / APOYO) */}
                        <div className="flex-1 bg-white p-6 space-y-8 overflow-y-auto">
                            {/* PLANILLA MESEROS (55%) */}
                            <div className="space-y-3">
                                <div className="bg-[#106ebe] h-9 px-4 flex items-center gap-2 rounded-t-sm shadow-sm">
                                    <Users size={16} className="text-blue-400" /><span className="text-white text-[10px] font-black uppercase tracking-widest">Planilla Meseros (55% de Ley)</span>
                                </div>
                                <div className="border rounded-b-sm overflow-hidden shadow-sm">
                                    <table className="w-full text-[11px]">
                                        <thead className="bg-slate-100 border-b font-black text-slate-500 text-[9px] uppercase">
                                            <tr className="divide-x divide-slate-200">
                                                <th className="px-4 py-2 text-left">Nombre del Mesero</th>
                                                <th className="px-4 py-2 text-right text-red-500">Facturado</th>
                                                <th className="px-4 py-2 text-right text-red-500">ISR/IVA</th>
                                                <th className="px-4 py-2 text-right text-blue-700">Sub 55%</th>
                                                <th className="px-4 py-2 text-center w-28">Vales</th>
                                                <th className="px-4 py-2 text-right text-emerald-700">Recibe Neto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y font-bold uppercase text-slate-700">
                                            {results.meseros.map((m, i) => (
                                                <tr key={i} className="hover:bg-blue-50/10 divide-x divide-slate-100">
                                                    <td className="px-4 py-0.5 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm" />{m.name}</td>
                                                    <td className="px-4 py-0.5 text-right font-mono text-red-600">{formatCurr(m.facturado)}</td>
                                                    <td className="px-4 py-0.5 text-right font-mono text-red-600">{formatCurr(m.retencion)}</td>
                                                    <td className="px-4 py-0.5 text-right font-mono text-blue-700">{formatCurr(m.share55)}</td>
                                                    <td className="px-4 py-0.5"><input type="number" className="w-full h-6 border text-center font-mono outline-none focus:ring-1 ring-blue-500 rounded-sm bg-slate-50" value={m.vale || ''} onChange={e => setMeseroVales(p => ({ ...p, [m.name]: parseFloat(e.target.value) || 0 }))} /></td>
                                                    <td className="px-4 py-0.5 text-right font-black font-mono text-emerald-800 bg-emerald-50/20">{formatCurr(m.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-[#106ebe] text-white font-black uppercase text-[10px]"><tr className="divide-x divide-white/10"><td colSpan={5} className="px-4 py-2 text-right">Total Planilla Meseros</td><td className="px-4 py-2 text-right font-mono text-emerald-400">{formatCurr(results.fondoMeserosGlobal)}</td></tr></tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* PLANILLA APOYO (45%) */}
                            <div className="space-y-3">
                                <div className="bg-[#106ebe] h-9 px-4 flex justify-between items-center rounded-t-sm shadow-sm">
                                    <div className="flex items-center gap-2"><ChefHat size={16} className="text-emerald-400" /><span className="text-white text-[10px] font-black uppercase tracking-widest">Personal de Apoyo (45% de Ley)</span></div>
                                    <button onClick={() => setEmployees([...employees, { id: generateUUID(), name: '', vales: 0 }])} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 h-6 rounded-sm text-[9px] font-black uppercase flex items-center gap-1.5 border border-emerald-400/30 transition-none"><UserPlus size={14} /> Agregar Personal</button>
                                </div>
                                <div className="border rounded-b-sm overflow-hidden shadow-sm">
                                    <table className="w-full text-[11px]">
                                        <thead className="bg-slate-100 border-b font-black text-slate-500 text-[9px] uppercase">
                                            <tr className="divide-x divide-slate-200">
                                                <th className="px-4 py-2 text-left">Nombre Completo</th>
                                                <th className="px-4 py-2 text-center w-28">Vales</th>
                                                <th className="px-4 py-2 text-right bg-emerald-50/50 text-emerald-700">Monto Neto</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y font-bold uppercase text-slate-700">
                                            {employees.map(e => (
                                                <tr key={e.id} className="hover:bg-emerald-50/10 divide-x divide-slate-100">
                                                    <td className="px-4 py-1.5"><input type="text" className="w-full h-8 bg-transparent outline-none font-bold placeholder:text-slate-300" placeholder="NOMBRE COLABORADOR..." value={e.name} onChange={v => setEmployees(p => p.map(em => em.id === e.id ? ({ ...em, name: v.target.value }) : em))} /></td>
                                                    <td className="px-4 py-1.5"><input type="number" className="w-full h-8 border text-center font-mono outline-none focus:ring-1 ring-blue-500 rounded-sm bg-slate-50" value={e.vales || ''} onChange={v => setEmployees(p => p.map(em => em.id === e.id ? ({ ...em, vales: parseFloat(v.target.value) || 0 }) : em))} /></td>
                                                    <td className="px-4 py-1.5 text-right font-black font-mono text-emerald-800 bg-emerald-50/20">{formatCurr(results.basePorPersonaApoyo - e.vales)}</td>
                                                    <td className="text-center"><button onClick={() => setEmployees(p => p.filter(em => em.id !== e.id))} className="text-slate-300 hover:text-red-500 transition-none"><Trash2 size={14} /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-[#106ebe] text-white font-black uppercase text-[10px]"><tr className="divide-x divide-white/10"><td colSpan={2} className="px-4 py-2 text-right">Total Planilla Apoyo</td><td className="px-4 py-2 text-right font-mono text-emerald-400">{formatCurr(results.fondoApoyoGlobal)}</td><td /></tr></tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DraggableWindow>
            {showConfirm && <WindowsConfirmModal title="Finalizar Distribución" message="¿Estás seguro de finalizar la liquidación de propinas para este periodo?" onConfirm={handleSave} onCancel={() => setShowConfirm(false)} />}
            {showPrintPreview && (
                <TipDistributionPrintPreview
                    isOpen={showPrintPreview}
                    onClose={() => setShowPrintPreview(false)}
                    results={results}
                    employees={employees}
                    dates={{ start: startDate, end: endDate }}
                />
            )}
        </div>,
        document.body
    );
};


// --- MODAL DE HISTORIAL ---
const TipDistributionHistoryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [distHistory, setDistHistory] = useState<any[]>([]);
    const [selectedDist, setSelectedDist] = useState<any>(null);
    const [details, setDetails] = useState<any[]>([]);
    useEffect(() => {
        supabase.from('tip_distributions').select(`*, branches(name)`).order('created_at', { ascending: false }).then(({ data }) => setDistHistory(data || []));
    }, []);
    const handleSelect = async (dist: any) => {
        const { data } = await supabase.from('tip_distribution_items').select('*').eq('distribution_id', dist.id).order('type', { ascending: false });
        setSelectedDist(dist); setDetails(data || []);
    };
    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/40">
            <DraggableWindow>
                <div className="w-[900px] h-[600px] bg-white border-2 border-[#106ebe] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 rounded-sm">
                    <div className="modal-header bg-[#106ebe] h-10 px-4 flex justify-between items-center cursor-move border-b border-black">
                        <div className="flex items-center gap-2 font-black text-[12px] text-white uppercase"><History size={18} className="text-blue-400" /> Auditoría Histórica</div>
                        <button onClick={onClose} className="text-white hover:text-red-500"><X size={26} /></button>
                    </div>
                    <div className="flex-1 flex overflow-hidden">
                        <div className="w-1/3 border-r bg-slate-50 overflow-y-auto divide-y">
                            {distHistory.map(h => (
                                <div key={h.id} onClick={() => handleSelect(h)} className={`p-4 cursor-pointer hover:bg-white transition-all ${selectedDist?.id === h.id ? 'bg-white border-l-4 border-blue-600' : ''}`}>
                                    <div className="text-[11px] font-black">{dayjs(h.created_at).format('DD/MM/YYYY HH:mm')}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase">{h.branches?.name || 'GENERAL'}</div>
                                    <div className="text-[11px] font-black text-emerald-600 font-mono mt-1">{formatCurr(h.total_bruta)}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {selectedDist ? (
                                <div className="flex-1 flex flex-col">
                                    <div className="p-4 bg-slate-50 border-b flex justify-between items-center"><div><span className="text-[9px] font-black text-slate-400 uppercase">Total Bruto</span><div className="text-xl font-black">{formatCurr(selectedDist.total_bruta)}</div></div><div className="text-right font-black text-red-600"><span className="text-[9px] text-slate-400 uppercase leading-none">Retención</span><div className="text-xl">{formatCurr(selectedDist.retencion_manual)}</div></div></div>
                                    <div className="flex-1 overflow-y-auto p-4">
                                        <table className="w-full text-[11px] uppercase font-bold text-slate-700">
                                            <thead className="bg-slate-50 text-[9px] font-black text-slate-500 border-b"><tr><th className="px-3 py-2 text-left">Colaborador</th><th className="px-3 py-2 text-center">Tipo</th><th className="px-3 py-2 text-right">Neto</th></tr></thead>
                                            <tbody className="divide-y">{details.map((r, i) => (<tr key={i}><td className="px-3 py-2">{r.employee_name}</td><td className="px-3 py-2 text-center text-[8px]"><span className={r.type === 'MESERO' ? 'text-blue-600' : 'text-emerald-600'}>{r.type}</span></td><td className="px-3 py-2 text-right font-mono">{formatCurr(r.monto_neto)}</td></tr>))}</tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : <div className="flex-1 flex items-center justify-center text-slate-300 font-black uppercase text-[10px]">Selecciona un registro</div>}
                        </div>
                    </div>
                </div>
            </DraggableWindow>
        </div>, document.body
    );
};

// --- COMPONENTE PRINCIPAL ---
export const ReportPropinas: React.FC = () => {
    const getLocalISOString = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = cachedUser?.id || 'anon';
    const STORAGE_KEY = `ReportPropinas_State_${userId}`;

    // Restore state synchronously on mount
    const [savedState] = useState(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    });

    const [startDate, setStartDate] = useState(savedState?.startDate || getLocalISOString());
    const [endDate, setEndDate] = useState(savedState?.endDate || getLocalISOString());
    const [startTime, setStartTime] = useState(savedState?.startTime || '00:00');
    const [endTime, setEndTime] = useState(savedState?.endTime || '23:59');

    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [data, setData] = useState<any[]>(savedState?.data || []);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>(savedState?.selectedBranch || 'all');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedWaiters, setExpandedWaiters] = useState<string[]>(savedState?.expandedWaiters || []);
    const toggleWaiter = (name: string) => { setExpandedWaiters(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]); };

    useEffect(() => {
        const state = { data, expandedWaiters, selectedBranch, startDate, endDate, startTime, endTime };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [data, expandedWaiters, selectedBranch, startDate, endDate, startTime, endTime, STORAGE_KEY]);

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, order: any } | null>(null);
    const [editOrder, setEditOrder] = useState<any>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [showDistributionModal, setShowDistributionModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Reporte_Propinas_${startDate}`,
    });

    useEffect(() => {
        supabase.from('branches').select('*').order('name').then(({ data }) => setBranches(data || []));
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                supabase.from('profiles').select('name').eq('id', user.id).single().then(({ data: profile }) => {
                    setCurrentUser(profile);
                });
            }
        });
    }, []);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const startStr = `${startDate}T${startTime}:00`;
            const endStr = `${endDate}T${endTime}:59`;
            let q = supabase.from('orders').select(`id,created_at,order_number,order_type,tip_amount,payment_method,cash_amount,card_amount,other_amount,total,branch_id,waiter:profiles!waiter_id(name,id),invoice:invoices(status)`).neq('status', 'CANCELLED').gt('tip_amount', 0).gte('created_at', startStr).lte('created_at', endStr);
            if (selectedBranch !== 'all') q = q.eq('branch_id', selectedBranch);
            const { data: res, error } = await q;
            if (error) throw error;
            const grouped: any = {};
            ((res as any[]) || []).forEach(order => {
                const waiterObj = Array.isArray(order.waiter) ? order.waiter[0] : order.waiter;
                const waiterName = waiterObj?.name || 'SIN ASIGNAR';
                if (!grouped[waiterName]) grouped[waiterName] = { name: waiterName, orders: [], totals: { efectivo: 0, tarjeta: 0, otros: 0, total: 0, facturado: 0 } };
                let ef = 0; let tj = 0; let ot = 0;
                const totalPay = (order.cash_amount || 0) + (order.card_amount || 0) + (order.other_amount || 0);
                if (totalPay > 0) { ef = (order.cash_amount / totalPay) * order.tip_amount; tj = (order.card_amount / totalPay) * order.tip_amount; ot = (order.other_amount / totalPay) * order.tip_amount; }
                else { const m = order.payment_method?.toUpperCase() || ''; if (m.includes('EFECTIVO')) ef = order.tip_amount; else if (m.includes('TARJETA')) tj = order.tip_amount; else ot = order.tip_amount; }
                const inv = Array.isArray(order.invoice) ? order.invoice[0] : order.invoice;
                const isFact = inv && inv.status !== 'CANCELLED';
                const orderTypeLabel = order.order_type === 'DINE_IN' ? 'MESA' :
                    (order.order_type === 'PICKUP' || order.order_type === 'TAKEAWAY') ? 'PARA LLEVAR' :
                        order.order_type === 'DELIVERY' ? 'DOMICILIO' : order.order_type;

                grouped[waiterName].orders.push({
                    id: order.id,
                    fecha: order.created_at,
                    no_orden: order.order_number,
                    cuenta: orderTypeLabel,
                    efectivo: ef,
                    tarjeta: tj,
                    otros: ot,
                    total: order.tip_amount,
                    isFacturada: isFact,
                    waiter_name: waiterName
                });
                grouped[waiterName].totals.efectivo += ef; grouped[waiterName].totals.tarjeta += tj; grouped[waiterName].totals.otros += ot; grouped[waiterName].totals.total += order.tip_amount; if (isFact) grouped[waiterName].totals.facturado += order.tip_amount;
            });
            setData(Object.values(grouped));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const updateOrderTip = async (id: string, total: number, ef: number, tj: number, ot: number, waiter: string) => {
        setLoading(true);
        try {
            const { error } = await supabase.from('orders').update({
                tip_amount: total,
                payment_method: `EFECTIVO: ${ef}, TARJETA: ${tj}, OTROS: ${ot}`,
                waiter_id: null, // Assuming waiter_id should be null if waiter_name is set directly
                waiter_name: waiter
            }).eq('id', id);
            if (error) { console.error(error); return; }
            handleGenerate();
        } catch (e) { console.error(e); } finally { setLoading(false); setShowEditModal(false); }
    };

    const globalTotals = useMemo(() => {
        return data.reduce((acc, w) => ({ efectivo: acc.efectivo + w.totals.efectivo, tarjeta: acc.tarjeta + w.totals.tarjeta, otros: acc.otros + w.totals.otros, total: acc.total + w.totals.total, facturado: acc.facturado + w.totals.facturado }), { efectivo: 0, tarjeta: 0, otros: 0, total: 0, facturado: 0 });
    }, [data]);

    const tipTotalTotal = globalTotals.total;
    const retention = globalTotals.facturado * 0.17;
    const netFund = tipTotalTotal - retention;
    const waitersData = useMemo(() => data.map(w => ({ name: w.name, venta: w.totals.total })), [data]);
    const totalVentasWaiters = waitersData.reduce((acc, w) => acc + w.venta, 0);

    const handleExportExcel = () => {
        setIsExporting(true);
        try {
            const wb = XLSX.utils.book_new();

            // 1. Encabezado de la Empresa
            const header = [
                ["RESTAURANTE LAS PALMAS"],
                ["REPORTE DE DISTRIBUCIÓN DE PROPINAS"],
                [`Periodo: ${startDate} ${startTime} a ${endDate} ${endTime}`],
                [`Sucursal: ${selectedBranch === 'all' ? 'TODAS' : branches.find(b => b.id === selectedBranch)?.name || 'SALA'}`],
                [""], // Espacio
                ["RESUMEN FISCAL"],
                ["Descripción", "Monto"],
                ["Total Propinas Brutas", globalTotals.total],
                ["Retención ISR/IVA (17%)", -(globalTotals.facturado * 0.17)],
                ["Fondo Neto Repartible", globalTotals.total - (globalTotals.facturado * 0.17)],
                [""], // Espacio
                ["DETALLE DE PLANILLA"],
                ["MESERO / COLABORADOR", "VENTA ACUMULADA", "RETENCIÓN (17%)", "RECIBE NETO (55%)"]
            ];

            // 2. Datos de la Planilla
            const rows = data.map(w => {
                const retention = w.totals.facturado * 0.17;
                const sharePercentage = totalVentasWaiters > 0 ? (w.totals.total / totalVentasWaiters) : 0;
                const netAmount = sharePercentage * (netFund * 0.55);
                return [
                    w.name,
                    w.totals.total,
                    -retention,
                    netAmount
                ];
            });

            // 3. Totales Finales
            const footer = [
                ["TOTALES GENERALES", globalTotals.total, -retention, netFund * 0.55]
            ];

            const wsData = [...header, ...rows, ...footer];
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Ajustar anchos de columna
            ws['!cols'] = [
                { wch: 35 }, // Nombre
                { wch: 20 }, // Venta
                { wch: 20 }, // Retención
                { wch: 20 }  // Neto
            ];

            XLSX.utils.book_append_sheet(wb, ws, "Planilla de Propinas");
            XLSX.writeFile(wb, `Planilla_Propinas_${startDate}.xlsx`);
        } catch (error) {
            console.error("Error al exportar:", error);
            alert("Hubo un error al generar el archivo Excel");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] text-[11px] select-none">
            {/* TOOLBAR */}
            <div className="bg-white border-b-2 border-slate-200 p-4 flex items-center flex-wrap gap-4 shadow-sm">
                <div className="flex flex-col gap-0.5"><span className="text-[9px] font-black uppercase text-slate-400">Sucursal:</span><select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="h-8 border border-slate-300 rounded px-2 font-bold bg-slate-50 outline-none w-48"><option value="all">TODAS LAS SUCURSALES</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-sm border border-slate-200">
                    <div className="flex items-center gap-1.5"><span className="text-[9px] font-black uppercase text-slate-500">Del:</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-7 border border-slate-400 px-2 rounded-sm font-mono font-bold" /><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-7 border border-slate-400 px-1 rounded-sm font-mono font-bold" /></div>
                    <div className="flex items-center gap-1.5"><span className="text-[9px] font-black uppercase text-slate-500">Al:</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-7 border border-slate-400 px-2 rounded-sm font-mono font-bold" /><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-7 border border-slate-400 px-1 rounded-sm font-mono font-bold" /></div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <button onClick={handleGenerate} className="bg-[#106ebe] text-white px-5 h-8 font-black uppercase text-[10px] flex items-center gap-2 rounded-sm active:scale-95 transition-transform"><Search size={14} /> GENERAR</button>
                    <button onClick={() => setShowDistributionModal(true)} className="bg-[#106ebe] text-white px-5 h-8 font-black uppercase text-[10px] flex items-center gap-2 rounded-sm active:scale-95 transition-transform"><ClipboardCheck size={14} /> DISTRIBUCIÓN APOYO</button>
                    <button onClick={() => setShowHistoryModal(true)} className="bg-[#106ebe] text-white px-5 h-8 font-black uppercase text-[10px] flex items-center gap-2 rounded-sm active:scale-95 transition-transform"><History size={14} /> HISTORIAL</button>
                    <button
                        onClick={() => setShowPrintModal(true)}
                        disabled={data.length === 0}
                        className="bg-white border text-slate-700 px-5 h-8 font-black uppercase text-[10px] flex items-center gap-2 rounded-sm active:scale-95 transition-transform border-slate-300 shadow-sm"
                    >
                        <Printer size={14} className="text-blue-600" /> Vista Previa
                    </button>

                </div>
            </div>

            {/* BUSCADOR */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
                <Search className="text-slate-400" size={16} />
                <input type="text" placeholder="BUSCAR POR NOMBRE POR USUARIO / MESERO..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-transparent outline-none font-bold text-slate-600 placeholder:text-slate-300 h-6" />
            </div>

            {/* TABLA PRINCIPAL */}
            <div className="flex-1 overflow-y-auto bg-white">
                <table className="w-full border-separate border-spacing-0">
                    <thead className="sticky top-0 z-30 bg-slate-100 text-slate-800 uppercase font-bold text-[10px]">
                        <tr className="divide-x divide-slate-200">
                            <th className="px-4 py-3 text-left w-48">FECHA</th>
                            <th className="px-4 py-3 text-center w-28">NO.ORDEN</th>
                            <th className="px-4 py-3 text-left">CUENTA</th>
                            <th className="px-4 py-3 text-center w-28">FACTURADO</th>
                            <th className="px-4 py-3 text-right w-36">EFECTIVO</th>
                            <th className="px-4 py-3 text-right w-36">TARJETA</th>
                            <th className="px-4 py-3 text-right w-36">OTROS</th>
                            <th className="px-4 py-3 text-right w-40 bg-slate-200/50">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 uppercase">
                        {data.length === 0 && !loading && (<tr><td colSpan={8} className="py-20 text-center text-slate-300 font-black uppercase text-[12px] opacity-40">No se han encontrado registros</td></tr>)}
                        {data.map(w => {
                            const expanded = expandedWaiters.includes(w.name);
                            if (searchTerm && !w.name.toLowerCase().includes(searchTerm.toLowerCase())) return null;
                            return (
                                <React.Fragment key={w.name}>
                                    <tr onClick={() => toggleWaiter(w.name)} className="bg-slate-50/70 hover:bg-slate-100 cursor-pointer border-y border-slate-200 group font-black text-slate-800 uppercase">
                                        <td className="px-4 py-2.5 flex items-center gap-2 group-hover:text-blue-700">
                                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} <span>MESERO: {w.name}</span>
                                        </td>
                                        <td></td><td></td><td></td>
                                        <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-l border-slate-100">{w.totals.efectivo > 0 ? formatCurr(w.totals.efectivo) : '-'}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-l border-slate-100">{w.totals.tarjeta > 0 ? formatCurr(w.totals.tarjeta) : '-'}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-l border-slate-100">{w.totals.otros > 0 ? formatCurr(w.totals.otros) : '-'}</td>
                                        <td className="px-4 py-2.5 text-right font-mono bg-slate-200/30 text-blue-700 border-l border-slate-300 shadow-[inset_-1px_0_0_rgba(0,0,0,0.05)]">{formatCurr(w.totals.total)}</td>
                                    </tr>
                                    {expanded && (
                                        <>
                                            {w.orders.map((o: any) => (
                                                <tr
                                                    key={o.id}
                                                    onDoubleClick={() => { setEditOrder({ ...o }); setShowEditModal(true); }}
                                                    onContextMenu={e => { e.preventDefault(); setSelectedOrderId(o.id); setContextMenu({ x: e.clientX, y: e.clientY, order: o }) }}
                                                    className={`divide-x divide-slate-100 font-bold text-slate-600 transition-colors hover:bg-blue-50/30 ${selectedOrderId === o.id ? 'bg-blue-100 ring-1 ring-inset ring-blue-300' : ''}`}
                                                >
                                                    <td className="px-6 py-1.5 text-slate-400 font-mono text-[9px]">{dayjs(o.fecha).format('DD/MM/YYYY HH:mm')}</td>
                                                    <td className="px-4 py-1.5 text-center text-slate-800 font-black">{o.no_orden}</td>
                                                    <td className="px-4 py-1.5 truncate text-[10px]">{o.cuenta}</td>
                                                    <td className="px-4 py-1.5 text-center">{o.isFacturada ? 'SI' : '--'}</td>
                                                    <td className="px-4 py-1.5 text-right font-mono text-slate-700">{o.efectivo > 0 ? formatCurr(o.efectivo) : '-'}</td>
                                                    <td className="px-4 py-1.5 text-right font-mono text-slate-700">{o.tarjeta > 0 ? formatCurr(o.tarjeta) : '-'}</td>
                                                    <td className="px-4 py-1.5 text-right font-mono text-slate-700">{o.otros > 0 ? formatCurr(o.otros) : '-'}</td>
                                                    <td className="px-4 py-1.5 text-right font-mono font-black text-slate-900 bg-slate-50/50">{formatCurr(o.total)}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-slate-100/80 font-black text-slate-800 uppercase border-b-2 border-slate-300 divide-x divide-slate-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
                                                <td colSpan={4} className="px-8 py-2 text-right text-[10px] tracking-widest text-slate-500">TOTALES {w.name}</td>
                                                <td className="px-4 py-2 text-right font-mono">{w.totals.efectivo > 0 ? formatCurr(w.totals.efectivo) : '-'}</td>
                                                <td className="px-4 py-2 text-right font-mono">{w.totals.tarjeta > 0 ? formatCurr(w.totals.tarjeta) : '-'}</td>
                                                <td className="px-4 py-2 text-right font-mono">{w.totals.otros > 0 ? formatCurr(w.totals.otros) : '-'}</td>
                                                <td className="px-4 py-2 text-right font-mono text-blue-800 bg-blue-100/30">{formatCurr(w.totals.total)}</td>
                                            </tr>
                                        </>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                    {data.length > 0 && (
                        <tfoot className="sticky bottom-0 z-30 bg-[#106ebe] text-white font-black uppercase text-[11px] divide-x divide-white/10 shadow-[0_-4px_10px_rgba(0,0,0,0.2)]">
                            <tr>
                                <td colSpan={3} className="px-8 py-3 text-right tracking-[0.1em]">TOTALES PERIODO</td>
                                <td className="px-4 py-3 text-center text-blue-400 bg-blue-500/10 font-mono">{formatCurr(globalTotals.facturado)}</td>
                                <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurr(globalTotals.efectivo)}</td>
                                <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurr(globalTotals.tarjeta)}</td>
                                <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurr(globalTotals.otros)}</td>
                                <td className="px-4 py-3 text-right font-mono text-emerald-400 bg-emerald-500/10 text-[14px]">{formatCurr(globalTotals.total)}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {showEditModal && editOrder && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/60 p-4">
                    <DraggableWindow>
                        <div className="bg-[#f0f2f5] border-2 border-[#106ebe] shadow-2xl flex flex-col w-[450px] overflow-hidden select-none font-sans">
                            {/* Header Estilo Auditoría */}
                            <div className="modal-header bg-[#106ebe] h-12 px-4 flex justify-between items-center text-white shrink-0 cursor-move border-b border-black">
                                <div className="flex items-center gap-3">
                                    <ClipboardCheck size={18} className="text-emerald-400" />
                                    <span className="text-[12px] font-black uppercase tracking-wider">Auditoría de Propina - Orden #{editOrder.no_orden}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => updateOrderTip(editOrder.id, editOrder.efectivo + (editOrder.tarjeta || 0) + (editOrder.otros || 0), editOrder.efectivo, editOrder.tarjeta || 0, editOrder.otros || 0, editOrder.waiter_name)} className="hover:scale-110 transition-transform">
                                        <Save size={18} className="text-slate-300 hover:text-white" />
                                    </button>
                                    <button onClick={() => setShowEditModal(false)} className="hover:scale-110 transition-transform">
                                        <X size={22} className="text-slate-300 hover:text-white" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-5 space-y-4">
                                {/* Info General */}
                                <div className="bg-white border border-slate-200 p-4 rounded-sm space-y-3">
                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="text-slate-400 uppercase">Fecha/Hora de Orden</span>
                                        <span className="text-slate-600 font-mono uppercase">{dayjs(editOrder.fecha).format('DD MMM YYYY, HH:mm')}</span>
                                    </div>
                                    <div className="flex items-center gap-3 py-1 border-t border-slate-50">
                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                            <User size={16} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase leading-tight">Atendido por:</span>
                                            <span className="text-[11px] font-black text-slate-700 uppercase leading-tight">{editOrder.waiter_name || '---'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Asignación de Mesero */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                        <Navigation size={12} className="text-blue-500 rotate-45" />
                                        <span>Asignación de Mesero</span>
                                    </div>
                                    <select
                                        className="w-full h-10 border border-slate-300 px-3 text-[11px] font-black uppercase text-slate-700 bg-white"
                                        value={editOrder.waiter_name}
                                        onChange={e => setEditOrder({ ...editOrder, waiter_name: e.target.value })}
                                    >
                                        <option value="SIN ASIGNAR">SIN ASIGNAR</option>
                                        {data.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}
                                    </select>
                                </div>

                                {/* Montos */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span>Monto Efectivo</span>
                                        </div>
                                        <input
                                            type="number"
                                            className="w-full h-10 border border-slate-300 px-3 font-mono font-bold text-slate-800 text-lg"
                                            value={editOrder.efectivo}
                                            onChange={e => setEditOrder({ ...editOrder, efectivo: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            <span>Monto Tarjeta</span>
                                        </div>
                                        <input
                                            type="number"
                                            className="w-full h-10 border border-slate-300 px-3 font-mono font-bold text-slate-800 text-lg"
                                            value={editOrder.tarjeta}
                                            onChange={e => setEditOrder({ ...editOrder, tarjeta: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                        <div className="flex gap-0.5">
                                            <div className="w-0.5 h-0.5 bg-slate-400 rounded-full" /><div className="w-0.5 h-0.5 bg-slate-400 rounded-full" /><div className="w-0.5 h-0.5 bg-slate-400 rounded-full" />
                                        </div>
                                        <span>Otros Métodos de Pago</span>
                                    </div>
                                    <input
                                        type="number"
                                        className="w-full h-10 border border-slate-300 px-3 font-mono font-bold text-slate-800 text-lg"
                                        value={editOrder.otros || 0}
                                        onChange={e => setEditOrder({ ...editOrder, otros: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>

                                {/* Liquidación Final Box */}
                                <div className="bg-[#106ebe] rounded-sm p-5 flex justify-between items-center shadow-lg">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Liquidación Final</span>
                                        <span className="text-[12px] font-bold text-white uppercase">Cruce de Cuentas</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Total Propina</span>
                                        <div className="text-3xl font-black text-white flex items-center gap-2 leading-none">
                                            <span className="text-lg opacity-80">Q</span>
                                            <span className="font-mono tracking-tighter">{(editOrder.efectivo + (editOrder.tarjeta || 0) + (editOrder.otros || 0)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Warning Audit */}
                                <div className="bg-amber-50 border border-amber-200 p-3 flex gap-3 items-start">
                                    <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[10px] font-bold text-amber-800 leading-tight uppercase">
                                        Sistema de Auditoría: <span className="font-normal normal-case">Esta corrección afecta directamente la conciliación de caja. Asegúrese de que los montos coinciden con los Boucher físicos antes de guardar.</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {showDistributionModal && <ManualTipDistributionModal onClose={() => setShowDistributionModal(false)} totalBruta={globalTotals.total} branchId={selectedBranch === 'all' ? undefined : selectedBranch} startDate={startDate} endDate={endDate} waiterData={data} />}
            {showHistoryModal && <TipDistributionHistoryModal onClose={() => setShowHistoryModal(false)} />}

            {contextMenu && createPortal(
                <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setContextMenu(null)} onContextMenu={e => { e.preventDefault(); setContextMenu(null); }} />
                    <div className="fixed z-[110] bg-white border-2 border-[#106ebe] shadow-xl py-1 min-w-[200px]" style={{ top: contextMenu.y, left: contextMenu.x }}>
                        <button onClick={() => { setEditOrder({ ...contextMenu.order }); setShowEditModal(true); setContextMenu(null); }} className="w-full px-4 py-2.5 text-left hover:bg-slate-100 flex items-center gap-3 transition-all"><Edit size={16} className="text-blue-700" /><span className="text-[11px] font-black uppercase text-slate-900">Editar Propina</span></button>
                        <button onClick={() => { setSelectedOrderId(contextMenu.order.id); setEditOrder(contextMenu.order); setShowDeleteModal(true); setContextMenu(null); }} className="w-full px-4 py-2.5 text-left hover:bg-red-50 flex items-center gap-3 transition-all border-t"><Trash2 size={16} className="text-red-600" /><span className="text-[11px] font-black uppercase text-red-600">Eliminar Registro</span></button>
                    </div>
                </>,
                document.body
            )}

            {showDeleteModal && editOrder && (
                <WindowsConfirmModal
                    title="Eliminar Registro"
                    message={`¿Confirmas que deseas eliminar la propina de la orden #${editOrder.no_orden}?`}
                    onConfirm={() => { updateOrderTip(editOrder.id, 0, 0, 0, 0, editOrder.waiter_name); setShowDeleteModal(false); }}
                    onCancel={() => setShowDeleteModal(false)}
                />
            )}

            {/* Vista Previa / Modal de Impresión */}
            {showPrintModal && createPortal(
                <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 p-4">
                    <DraggableWindow>
                        <div className="bg-[#f0f0f0] border-2 border-[#106ebe] shadow-2xl flex flex-col w-[90vw] max-w-6xl h-[90vh] overflow-hidden select-none font-sans">
                            {/* Toolbar Modal */}
                            <div className="modal-header bg-[#106ebe] h-10 px-4 flex justify-between items-center text-white shrink-0 cursor-move border-b border-black shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
                                    <Printer size={16} className="text-emerald-400" />
                                    <span>Vista Previa de Reporte</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePrint()}
                                        className="h-7 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-[10px] font-black uppercase flex items-center gap-2 shadow-sm active:scale-95 transition-transform"
                                    >
                                        <Printer size={12} strokeWidth={3} /> IMPRIMIR PDF
                                    </button>
                                    <button
                                        onClick={handleExportExcel}
                                        disabled={isExporting}
                                        className="h-7 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[10px] font-black uppercase flex items-center gap-2 shadow-sm active:scale-95 transition-transform border border-emerald-400/30"
                                    >
                                        {isExporting ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} strokeWidth={3} />} EXCEL (.XLSX)
                                    </button>
                                    <div className="w-px h-5 bg-white/20 mx-2" />
                                    <button onClick={() => setShowPrintModal(false)} className="h-8 w-8 flex items-center justify-center hover:bg-red-500 transition-colors text-white">
                                        <X size={22} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>

                            {/* Hoja de Reporte (Printable Content) */}
                            <div className="flex-1 overflow-auto bg-slate-700/80 p-10 custom-scrollbar scroll-smooth">
                                <div
                                    ref={printRef}
                                    className="bg-white mx-auto p-16 shadow-2xl min-h-full w-[1000px] text-black print:shadow-none print:w-full print:p-8 font-serif"
                                >
                                    {/* Header Reporte */}
                                    <div className="text-center mb-12 border-b-2 border-gray-900 pb-8">
                                        <h1 className="text-5xl font-black uppercase tracking-tighter mb-1 font-sans">RESTAURANTE LAS PALMAS</h1>
                                        <p className="text-[14px] font-black uppercase tracking-[0.5em] text-gray-500 mb-6 font-sans">Sistema de Control Administrativo</p>
                                        <div className="flex justify-between items-end px-2">
                                            <div className="text-left">
                                                <h2 className="text-2xl font-black uppercase text-slate-800 font-sans border-l-4 border-blue-600 pl-4 py-1 bg-slate-50">REPORTE DE DISTRIBUCIÓN DE PROPINAS</h2>
                                                <p className="text-[12px] font-bold text-gray-500 mt-2">Periodo Seleccionado: {dayjs(startDate).format('DD/MM/YYYY')} - {dayjs(endDate).format('DD/MM/YYYY')}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[12px] font-bold text-gray-800 uppercase tracking-wider">Sucursal: {selectedBranch === 'all' ? 'TODAS LAS SUCURSALES' : (branches.find(b => b.id === selectedBranch)?.name || 'SALA')}</p>
                                                <p className="text-[10px] font-mono text-gray-400 mt-1">Generado el: {new Date().toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cuadros de Mando (Fiscal Summary) */}
                                    <div className="grid grid-cols-3 gap-6 mb-12">
                                        <div className="bg-slate-50 border-2 border-slate-100 p-5 rounded-sm">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">PROPINAS BRUTAS</span>
                                            <div className="text-2xl font-black text-slate-900 tabular-nums">{formatCurr(tipTotalTotal)}</div>
                                        </div>
                                        <div className="bg-rose-50 border-2 border-rose-100 p-5 rounded-sm">
                                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-1">RETENCIÓN ISR/IVA (17%)</span>
                                            <div className="text-2xl font-black text-rose-600 tabular-nums">-{formatCurr(retention)}</div>
                                        </div>
                                        <div className="bg-blue-600 p-6 rounded-sm shadow-lg">
                                            <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest block mb-1">FONDO NETO REPARTIBLE</span>
                                            <div className="text-3xl font-black text-white tabular-nums tracking-tighter shadow-sm">{formatCurr(netFund)}</div>
                                        </div>
                                    </div>

                                    {/* Tabla Meseros */}
                                    <div className="mb-12">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="h-8 w-1.5 bg-blue-600 rounded-full" />
                                            <h3 className="text-[16px] font-black uppercase tracking-tight text-slate-800">Planilla de Meseros (55% de Ley - {formatCurr(netFund * 0.55)})</h3>
                                        </div>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-[#106ebe] text-white text-[10px] font-black uppercase tracking-widest">
                                                    <th className="px-5 py-3 text-left w-1/2">Colaborador (Mesero)</th>
                                                    <th className="px-5 py-3 text-right">Venta Acumulada</th>
                                                    <th className="px-5 py-3 text-right">Proporción (%)</th>
                                                    <th className="px-5 py-3 text-right text-emerald-400">Neto a Recibir</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[12px] font-bold">
                                                {waitersData.map((w, i) => {
                                                    const share = totalVentasWaiters > 0 ? (w.venta / totalVentasWaiters) * 100 : 0;
                                                    const amount = totalVentasWaiters > 0 ? (w.venta / totalVentasWaiters) * (netFund * 0.55) : 0;
                                                    return (
                                                        <tr key={i} className="border-b border-slate-200 h-10 hover:bg-slate-50">
                                                            <td className="px-5 uppercase text-slate-800">{w.name}</td>
                                                            <td className="px-5 text-right tabular-nums text-slate-500">{formatCurr(w.venta)}</td>
                                                            <td className="px-5 text-right tabular-nums text-slate-400">{share.toFixed(2)}%</td>
                                                            <td className="px-5 text-right tabular-nums font-black text-slate-950 bg-emerald-50/20">{formatCurr(amount)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-slate-100 font-black h-12">
                                                    <td colSpan={3} className="px-5 text-right uppercase text-[11px] tracking-widest">SUBTOTAL PLANILLA MESEROS</td>
                                                    <td className="px-5 text-right text-[14px] font-black text-slate-900 border-t-2 border-slate-900">{formatCurr(netFund * 0.55)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Firmas Auditoría */}
                                    <div className="mt-24 flex justify-between px-16">
                                        <div className="w-[280px] border-t-2 border-slate-900 text-center pt-4">
                                            <p className="text-[12px] font-black uppercase tracking-tighter">Firma Responsable Operativo</p>
                                            <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase block">Elaborado por: {currentUser?.name || '---'}</p>
                                        </div>
                                        <div className="w-[280px] border-t-2 border-slate-900 text-center pt-4">
                                            <p className="text-[12px] font-black uppercase tracking-tighter">Vo.Bo. Administración / Gerencia</p>
                                            <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase block">Sello de Autorización</p>
                                        </div>
                                    </div>

                                    <div className="mt-16 text-center">
                                        <div className="inline-block border-y border-slate-200 px-10 py-2">
                                            <p className="text-[9px] font-serif text-slate-400">
                                                Este reporte es un documento de uso interno exclusivo para la gestión de Restaurante Las Palmas.
                                                Generado por Restaurante Las Palmas POS
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
        </div>
    );
};
