import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabase';
import { 
    Search, Filter, Calendar, AlertTriangle, ShieldCheck, 
    FileText, Fuel, Package, RefreshCw, Eye, Download,
    AlertCircle, Info, ChevronRight, Calculator, X, Building
} from 'lucide-react';
import dayjs from 'dayjs';
import { createPortal } from 'react-dom';
import { DraggableWindow } from '../DraggableWindow';

const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface AuditRecord {
    id: string;
    uuid_dte: string;
    serie: string;
    numero: string;
    tipo_dte: string;
    tipo_dte_descripcion: string;
    fecha_emision: string;
    estado: string;
    afecta_credito_fiscal: boolean;
    emisor_nit: string;
    emisor_nombre: string;
    emisor_tipo_contribuyente: string;
    emisor_giro: string;
    monto_total: number;
    iva_credito_fiscal: number;
    iva_retenido?: number;
    idp_monto: number;
    impuesto_bebidas_alcoh?: number;
    impuesto_bebidas_no_alcoh?: number;
    isr_retenido: number;
    uuid_referencia?: string;
    items: any[];
    clasificacion_compra: string;
    categoria_gasto: string;
    cuenta_contable: string;
    cuenta_contable_nombre: string;
    alertas: string[];
    requiere_revision_manual: boolean;
}

export const TabAuditoriaSAT: React.FC<{ accentColor: string }> = ({ accentColor }) => {
    const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
    const [records, setRecords] = useState<AuditRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    
    // Notification & Confirmation System
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', title: string, message: string } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
    const [showManualModal, setShowManualModal] = useState(false);

    const showNotify = (type: 'success' | 'error' | 'info', title: string, message: string) => {
        setNotification({ type, title, message });
        if (type !== 'error') {
            setTimeout(() => setNotification(null), 6000);
        }
    };

    const handleDownloadRetencion = async (record: AuditRecord) => {
        try {
            const { data: settings } = await supabase.from('system_settings').select('sat_username, sat_password').eq('id', 1).single();
            if (!settings?.sat_username || !settings?.sat_password) {
                showNotify('error', 'Credenciales no encontradas', '⚠️ No hay credenciales SAT configuradas en los ajustes del sistema.');
                return;
            }

            const [y, m] = month.split('-');
            const dateStart = dayjs(`${y}-${m}-01`).format('YYYY-MM-DD');
            const dateEnd = dayjs(`${y}-${m}-01`).endOf('month').format('YYYY-MM-DD');

            const res = await fetch('/api/sat-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'retenciones_pdf',
                    username: settings.sat_username,
                    password: settings.sat_password,
                    numero: record.numero,
                    dateStart,
                    dateEnd,
                    tipoRetencion: record.emisor_nombre?.includes('IVA') ? 'IVA' : 'ISR' // Heuristic based on name
                })
            });

            const data = await res.json();
            if (data.success && data.pdf_base64) {
                const link = document.createElement('a');
                link.href = `data:application/pdf;base64,${data.pdf_base64}`;
                link.download = data.filename || `Retencion_${record.numero}.pdf`;
                link.click();
            } else {
                showNotify('error', 'Error de Descarga', data.error || 'No se pudo generar el archivo PDF desde el portal SAT.');
            }
        } catch (e: any) {
            showNotify('error', 'Error Crítico', e.message);
        }
    };

    const handleSyncRetenciones = async () => {
        setConfirmModal({
            title: 'Sincronizar Retenciones',
            message: '¿Deseas conectar con el portal SAT para descargar las Retenciones (CRE) de este periodo?',
            onConfirm: executeSyncRetenciones
        });
    };

    const executeSyncRetenciones = async () => {
        setConfirmModal(null);
        setSyncing(true);
        try {
            const { data: settings } = await supabase.from('system_settings').select('sat_username, sat_password').eq('id', 1).single();
            const [y, m] = month.split('-');
            const dStart = dayjs(`${y}-${m}-01`).format('YYYY-MM-DD');
            const dEnd = dayjs(`${y}-${m}-01`).endOf('month').format('YYYY-MM-DD');

            let data;
            const syncParams = {
                username: settings.sat_username, password: settings.sat_password,
                dateStart: dStart, dateEnd: dEnd, tipo: 'recibida',
                onlyRetenciones: true,
                supabaseUrl: (import.meta as any).env.VITE_SUPABASE_URL,
                supabaseKey: (import.meta as any).env.VITE_SUPABASE_ANON_KEY
            };

            if ((window as any).electronAPI?.satSync) {
                console.log('TabAuditoriaSAT: Usando sincronización local (Electron)...');
                data = await (window as any).electronAPI.satSync(syncParams);
            } else {
                console.log('TabAuditoriaSAT: Usando sincronización remota (Vercel)...');
                const res = await fetch('/api/sat-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(syncParams)
                });
                data = await res.json();
            }
            if (data.success) {
                showNotify('success', 'Sincronización Completada', `Se procesaron ${data.total} documentos. Si no ves los registros esperados, comprueba el periodo anterior.`);
                fetchData();
            } else {
                showNotify('error', 'Fallo de Sincronización', data.error);
            }
        } catch (e: any) {
            showNotify('error', 'Error del Sistema', e.message);
        } finally {
            setSyncing(false);
        }
    };

    const handleSaveManual = async (data: any) => {
        try {
            setLoading(true);
            const [y, m] = month.split('-');
            
            const { error } = await supabase.from('historico_auditoria_sat').insert({
                org_id: 'default',
                uuid_dte: `MANUAL-CRE-${data.numero}-${Date.now()}`,
                serie: 'RET',
                numero: data.numero,
                tipo_dte: 'CRE',
                tipo_dte_descripcion: `Constancia de Retención (${data.tipo})`,
                fecha_emision: data.fecha,
                emisor_nit: data.nit,
                emisor_nombre: data.nombre,
                monto_total: parseFloat(data.monto),
                isr_retenido: data.tipo === 'ISR' ? parseFloat(data.monto) : 0,
                iva_monto: data.tipo === 'IVA' ? parseFloat(data.monto) : 0,
                iva_retenido: data.tipo === 'IVA' ? parseFloat(data.monto) : 0,
                periodo_fiscal_mes: parseInt(m),
                periodo_fiscal_anio: parseInt(y),
                xml_origen: 'Carga Manual',
                estado: 'VIGENTE'
            });

            if (error) throw error;
            
            showNotify('success', 'Registro Guardado', 'La retención ha sido guardada exitosamente.');
            setShowManualModal(false);
            fetchData();
        } catch (e: any) {
            showNotify('error', 'Error al Guardar', e.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [y, m] = month.split('-');
        const { data, error } = await supabase
            .from('historico_auditoria_sat')
            .select('*')
            .eq('org_id', 'default')
            .eq('periodo_fiscal_anio', parseInt(y))
            .eq('periodo_fiscal_mes', parseInt(m))
            .order('fecha_emision', { ascending: false });
        
        if (!error) setRecords(data || []);
        setLoading(false);
    }, [month]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = records.filter(r => {
        const matchesSearch = r.emisor_nombre.toLowerCase().includes(search.toLowerCase()) ||
            (r.uuid_dte && r.uuid_dte.includes(search)) ||
            (r.emisor_nit && r.emisor_nit.includes(search));
        
        if (!matchesSearch) return false;

        const inferredTipo = r.tipo_dte || (
            r.emisor_nombre?.toUpperCase().includes('NCRE') || r.emisor_nombre?.toUpperCase().includes('NOTA DE CREDITO') ? 'NCRE' :
            r.emisor_nombre?.toUpperCase().includes('FPEQ') || r.emisor_nombre?.toUpperCase().includes('PEQUEÑO CONTRIBUYENTE') ? 'FPEQ' :
            'FACT'
        );

        switch (filterType) {
            case 'FACT': return ['FACT', 'FCAM'].includes(inferredTipo);
            case 'NCRE': return ['NCRE', 'NABN'].includes(inferredTipo);
            case 'CRE': return inferredTipo === 'CRE';
            case 'FPEQ': return r.emisor_tipo_contribuyente === 'PEQUENO' || inferredTipo === 'FPEQ';
            case 'ANULADO': return r.estado?.toUpperCase() === 'ANULADO' || r.estado === 'A';
            default: return true;
        }
    });

    const totals = records.reduce((acc, r) => ({
        iva: acc.iva + (r.iva_credito_fiscal || 0),
        idp: acc.idp + (r.idp_monto || 0),
        bebidas: acc.bebidas + (r.impuesto_bebidas_alcoh || 0) + (r.impuesto_bebidas_no_alcoh || 0),
        total: acc.total + (r.monto_total || 0),
        retenciones: acc.retenciones + (r.iva_retenido || 0) + (r.isr_retenido || 0),
        activos: acc.activos + (r.clasificacion_compra === 'ACTIVO_FIJO' ? 1 : 0),
        alertas: acc.alertas + (r.alertas?.length || 0)
    }), { iva: 0, idp: 0, bebidas: 0, total: 0, retenciones: 0, activos: 0, alertas: 0 });

    return (
        <div className="h-full flex flex-col bg-[#f0f0f0] overflow-hidden">
            {/* Header / Toolbar */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col gap-3 shadow-sm shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-semibold uppercase text-slate-500 tracking-widest">Periodo Auditoría:</label>
                            <input type="month" value={month} onChange={e => {
                                setMonth(e.target.value);
                            }}
                                className="border border-gray-300 rounded px-3 py-1.5 text-[11px] font-medium text-gray-900 bg-white" />
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input type="text" placeholder="Buscar por emisor, NIT o UUID..." value={search} onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-1.5 border border-gray-300 rounded text-[11px] font-medium w-64 focus:ring-1 focus:ring-[#106ebe]" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowManualModal(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#106EBE] text-white rounded text-[10px] font-semibold uppercase hover:bg-[#0d5ea0] transition-all shadow-sm"
                        >
                            <FileText size={13} /> 
                            Carga Manual de Retenciones
                        </button>
                        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-semibold uppercase text-slate-600 hover:bg-slate-50">
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualizar
                        </button>
                    </div>
                </div>

                {/* Quick Filters */}
                <div className="flex items-center gap-2 border-t border-slate-50 pt-2">
                    <Filter size={12} className="text-slate-400 mr-1" />
                    {[
                        { id: 'ALL', label: 'Todos' },
                        { id: 'FACT', label: 'Facturas' },
                        { id: 'NCRE', label: 'Notas Crédito' },
                        { id: 'CRE', label: 'Retenciones' },
                        { id: 'ANULADO', label: 'Anulados' },
                        { id: 'FPEQ', label: 'FPEQ' }
                    ].map(f => (
                        <button key={f.id} onClick={() => setFilterType(f.id)}
                            className={`px-3 py-1 rounded-full text-[9px] font-semibold uppercase tracking-tighter transition-all ${filterType === f.id ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard label="Crédito Fiscal" value={fmtQ(totals.iva)} icon={ShieldCheck} color="text-blue-600" bg="bg-blue-50" info="IVA deducible" />
                    <StatCard label="IDP (Combustible)" value={fmtQ(totals.idp)} icon={Fuel} color="text-amber-600" bg="bg-amber-50" info="Impuesto Petróleo" />
                    <StatCard label="Impuesto Bebidas" value={fmtQ(totals.bebidas)} icon={Calculator} color="text-purple-600" bg="bg-purple-50" info="Alcohol y Gaseosas" />
                    <StatCard label="Retenciones" value={fmtQ(totals.retenciones)} icon={Calculator} color="text-emerald-600" bg="bg-emerald-50" info="ISR e IVA Retenido" />
                    <StatCard label="Alertas" value={totals.alertas.toString()} icon={AlertTriangle} color="text-rose-600" bg="bg-rose-50" info="Riesgos detectados" />
                </div>

                {/* Audit Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-[#106ebe] px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText size={16} className="text-white" />
                            <span className="text-[11px] font-semibold text-white uppercase tracking-widest">Historial de Auditoría de Inteligencia SAT</span>
                        </div>
                        <span className="text-[10px] font-medium text-white bg-white/20 px-2 py-0.5 rounded-full">
                            {filtered.length} Documentos Auditados
                        </span>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Fecha / Tipo</th>
                                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Emisor / NIT</th>
                                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Giro / Clasificación</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Monto Total</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">IVA Crédito</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Retenciones</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={7} className="px-4 py-20 text-center text-slate-400 font-medium uppercase text-[12px] tracking-widest"><RefreshCw size={24} className="animate-spin mx-auto mb-2 opacity-20" /> Analizando base de datos fiscal...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 py-20 text-center text-slate-400 font-medium uppercase text-[10px] tracking-widest">No se encontraron registros de auditoría para este periodo</td></tr>
                                ) : filtered.map(rec => (
                                    <tr key={rec.id} className={`hover:bg-slate-50 transition-all ${rec.requiere_revision_manual ? 'bg-amber-50/30' : ''}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-mono font-semibold text-black">{dayjs(rec.fecha_emision).format('DD/MM/YYYY')}</span>
                                                <div className="flex items-center gap-1 mt-1">
                                                    {(() => {
                                                        const inferredTipo = rec.tipo_dte || (
                                                            rec.emisor_nombre?.toUpperCase().includes('NCRE') || rec.emisor_nombre?.toUpperCase().includes('NOTA DE CREDITO') ? 'NCRE' :
                                                            rec.emisor_nombre?.toUpperCase().includes('FPEQ') || rec.emisor_nombre?.toUpperCase().includes('PEQUEÑO CONTRIBUYENTE') ? 'FPEQ' :
                                                            'FACT'
                                                        );
                                                        return (
                                                            <span className={`text-[8px] font-semibold uppercase px-1 rounded border ${getTypeColor(inferredTipo)}`}>
                                                                {inferredTipo}
                                                            </span>
                                                        );
                                                    })()}
                                                    {rec.uuid_referencia && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="DTE Vinculado" />}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 max-w-[200px]">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-semibold text-black truncate">{rec.emisor_nombre}</span>
                                                <span className="text-[9px] font-medium text-slate-500 font-mono">NIT: {rec.emisor_nit}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${rec.clasificacion_compra === 'ACTIVO_FIJO' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}`}>
                                                        {rec.clasificacion_compra}
                                                    </span>
                                                    <span className="text-[8px] font-semibold bg-blue-50 text-blue-600 px-1 rounded">{rec.emisor_giro}</span>
                                                </div>
                                                <span className="text-[9px] font-medium text-slate-400 truncate mt-1">
                                                    {rec.cuenta_contable} • {rec.cuenta_contable_nombre}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-[11px] font-mono font-semibold ${rec.monto_total < 0 ? 'text-rose-600' : 'text-black'}`}>
                                                {fmtQ(rec.monto_total)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-[11px] font-mono font-semibold ${!rec.afecta_credito_fiscal ? 'text-slate-300 line-through' : (rec.iva_credito_fiscal < 0 ? 'text-rose-500' : 'text-emerald-600')}`}>
                                                {fmtQ(rec.iva_credito_fiscal)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={`text-[10px] font-mono font-semibold ${(rec.iva_retenido || 0) + (rec.isr_retenido || 0) > 0 ? 'text-emerald-700' : 'text-slate-200'}`}>
                                                    {fmtQ((rec.iva_retenido || 0) + (rec.isr_retenido || 0))}
                                                </span>
                                                <div className="flex flex-col items-end gap-0">
                                                    {rec.idp_monto !== 0 && <span className="text-[7px] font-semibold text-amber-600 uppercase">IDP: {fmtQ(rec.idp_monto)}</span>}
                                                    {(rec.impuesto_bebidas_alcoh || 0) !== 0 && <span className="text-[7px] font-semibold text-purple-600 uppercase">ALC: {fmtQ(rec.impuesto_bebidas_alcoh!)}</span>}
                                                    {(rec.impuesto_bebidas_no_alcoh || 0) !== 0 && <span className="text-[7px] font-semibold text-blue-500 uppercase">BEB: {fmtQ(rec.impuesto_bebidas_no_alcoh!)}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => setSelectedRecord(rec)} className="p-2 hover:bg-[#106ebe] hover:text-white rounded-lg text-slate-400 transition-colors" title="Ver Detalle">
                                                    <Eye size={14} />
                                                </button>
                                                {(rec.tipo_dte === 'CRE' || rec.tipo_dte === 'CEX' || rec.emisor_nombre?.toUpperCase().includes('RETENCION')) && (
                                                    <button 
                                                        onClick={() => handleDownloadRetencion(rec)}
                                                        className="p-2 hover:bg-rose-600 hover:text-white rounded-lg text-rose-500 transition-colors"
                                                        title="Descargar PDF SAT-2229"
                                                    >
                                                        <FileText size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedRecord && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/10 pointer-events-auto">
                    <DraggableWindow title={`Auditoría SAT: ${selectedRecord.tipo_dte}`}>
                        <div className="w-[750px] max-h-[90vh] bg-[#f0f0f0] border border-[#106EBE] shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col animate-in fade-in zoom-in-95 duration-200 pointer-events-auto overflow-hidden">
                            {/* Header (Windows Classic Style) */}
                            <div className="modal-header bg-[#106EBE] h-9 px-4 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-white" />
                                    <span className="text-white text-[11px] font-semibold tracking-wide uppercase">Auditoría Inteligente de Documento FEL</span>
                                </div>
                                <button onClick={() => setSelectedRecord(null)} className="w-9 h-9 flex items-center justify-center hover:bg-red-500 text-white transition-all" title="Cerrar">
                                    <X size={20} strokeWidth={2.5} />
                                </button>
                            </div>

                            {/* Body Scrollable */}
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
                                {/* Top Section: Emisor & Montos */}
                                <div className="grid grid-cols-12 gap-4">
                                    {/* Emisor Panel */}
                                    <div className="col-span-7 bg-white border border-gray-300 p-3 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2 border-b border-gray-100 pb-1">
                                            <Building size={14} className="text-[#106EBE]" />
                                            <span className="text-[10px] font-semibold uppercase text-slate-500">Datos del Emisor</span>
                                        </div>
                                        <h4 className="text-[14px] font-semibold text-slate-900 leading-tight mb-1">{selectedRecord.emisor_nombre}</h4>
                                        <div className="flex items-center gap-3 text-[10px] font-medium text-slate-600 mb-2">
                                            <span className="bg-slate-100 px-1.5 py-0.5 border border-slate-200 uppercase">NIT: {selectedRecord.emisor_nit}</span>
                                            <span className="text-[#106EBE]">{selectedRecord.emisor_tipo_contribuyente}</span>
                                        </div>
                                        <div className="text-[9px] font-medium text-slate-400 uppercase tracking-tight">
                                            Giro: {selectedRecord.emisor_giro}
                                        </div>
                                        <div className="mt-3 pt-2 border-t border-dotted border-gray-200">
                                            <span className="text-[9px] font-mono font-medium text-slate-400 uppercase">UUID: {selectedRecord.uuid_dte}</span>
                                        </div>
                                    </div>

                                    {/* Totals Panel */}
                                    <div className="col-span-5 bg-white border border-gray-300 p-3 shadow-sm flex flex-col">
                                        <div className="flex items-center justify-between mb-2 border-b border-gray-100 pb-1">
                                            <span className="text-[10px] font-semibold uppercase text-slate-500">Resumen Financiero</span>
                                            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${getTypeColor(selectedRecord.tipo_dte)}`}>{selectedRecord.tipo_dte}</span>
                                        </div>
                                        
                                        <div className="flex-1 space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-medium text-slate-400 uppercase">Total DTE:</span>
                                                <span className={`text-[18px] font-mono font-semibold ${selectedRecord.monto_total < 0 ? 'text-rose-600' : 'text-black'}`}>
                                                    {fmtQ(selectedRecord.monto_total)}
                                                </span>
                                            </div>

                                            <div className="space-y-1.5 pt-2 border-t border-slate-50">
                                                <div className="flex justify-between text-[10px] font-medium">
                                                    <span className="text-slate-500">Crédito IVA:</span>
                                                    <span className={!selectedRecord.afecta_credito_fiscal ? 'text-slate-300 line-through' : (selectedRecord.iva_credito_fiscal < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                                        {selectedRecord.afecta_credito_fiscal ? fmtQ(selectedRecord.iva_credito_fiscal) : 'No deducible'}
                                                    </span>
                                                </div>
                                                {selectedRecord.idp_monto !== 0 && (
                                                    <div className="flex justify-between text-[10px] font-medium text-amber-600">
                                                        <span>IDP (Combustible):</span>
                                                        <span>{fmtQ(selectedRecord.idp_monto)}</span>
                                                    </div>
                                                )}
                                                {((selectedRecord.iva_retenido || 0) + (selectedRecord.isr_retenido || 0)) > 0 && (
                                                    <div className="flex justify-between text-[10px] font-medium text-purple-600 uppercase border-t border-purple-50 pt-1">
                                                        <span>Retenciones:</span>
                                                        <span>{fmtQ((selectedRecord.iva_retenido || 0) + (selectedRecord.isr_retenido || 0))}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Imputación Contable */}
                                <div className="bg-[#f8f9fa] border border-gray-300 p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-[#106EBE] text-white flex items-center justify-center shadow-inner">
                                            <Calculator size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-semibold text-slate-900 uppercase">Cuenta: {selectedRecord.cuenta_contable} — {selectedRecord.cuenta_contable_nombre}</span>
                                                <span className="text-[9px] font-semibold text-[#106EBE] bg-blue-50 px-2 py-0.5 border border-blue-200 uppercase">{selectedRecord.categoria_gasto}</span>
                                            </div>
                                            <div className="text-[9px] font-medium text-slate-500 uppercase mt-0.5">
                                                Clasificación: {selectedRecord.clasificacion_compra}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Alertas */}
                                {selectedRecord.alertas && selectedRecord.alertas.length > 0 && (
                                    <div className="border border-rose-300 bg-rose-50 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertCircle size={14} className="text-rose-600" />
                                            <span className="text-[10px] font-semibold uppercase text-rose-700">Alertas de Auditoría Encontradas</span>
                                        </div>
                                        <div className="space-y-1">
                                            {selectedRecord.alertas.map((a: string, i: number) => (
                                                <div key={i} className="text-[10px] font-medium text-rose-600 flex items-center gap-2">
                                                    <div className="w-1 h-1 bg-rose-600 rounded-full" /> {a}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Detalle de Lineas / Items */}
                                <div className="flex-1 flex flex-col min-h-[200px]">
                                    <div className="bg-slate-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                                        <span className="text-[10px] font-semibold text-white uppercase tracking-widest">Desglose de Ítems Auditados ({selectedRecord.items?.length || 0})</span>
                                        <span className="text-[9px] font-medium text-slate-400 uppercase">Precios incluyen impuestos</span>
                                    </div>
                                    <div className="bg-white border border-gray-300 border-t-0 flex-1 overflow-hidden flex flex-col">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-[#f0f0f0] border-b border-gray-300">
                                                <tr className="text-[9px] font-semibold text-slate-600 uppercase tracking-tight">
                                                    <th className="px-3 py-1.5 w-12 border-r border-gray-200 text-center">Cant</th>
                                                    <th className="px-3 py-1.5 border-r border-gray-200">Descripción del Bien o Servicio</th>
                                                    <th className="px-3 py-1.5 w-32 border-r border-gray-200 text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {(selectedRecord.items || []).map((it: any, i: number) => (
                                                    <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="px-3 py-1 text-center font-mono text-[10px] font-medium border-r border-gray-100">{it.cantidad || 1}</td>
                                                        <td className="px-3 py-1">
                                                            <div className="text-[10px] font-semibold text-slate-800 uppercase leading-tight">{it.descripcion}</div>
                                                            <div className="text-[8px] font-medium text-slate-400 uppercase tracking-tighter mt-0.5">{it.subcategoria_contable}</div>
                                                        </td>
                                                        <td className="px-3 py-1 text-right font-mono text-[10px] font-semibold text-slate-900 border-l border-gray-100">
                                                            {fmtQ(it.precio_total)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-3 bg-[#f0f0f0] border-t border-gray-300 flex justify-end gap-2 shrink-0">
                                {(selectedRecord.tipo_dte === 'CRE' || selectedRecord.tipo_dte === 'CEX' || selectedRecord.emisor_nombre?.toUpperCase().includes('RETENCION')) && (
                                    <button 
                                        onClick={() => handleDownloadRetencion(selectedRecord)}
                                        className="px-6 py-1.5 bg-rose-600 text-white text-[11px] font-medium uppercase tracking-tight border border-rose-700 hover:brightness-110 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <FileText size={14} /> Descargar PDF SAT
                                    </button>
                                )}
                                <button 
                                    onClick={() => setSelectedRecord(null)}
                                    className="px-8 py-1.5 bg-white text-slate-700 text-[11px] font-medium uppercase tracking-tight border border-gray-400 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
            {/* Notifications & Modals — ANTIGRAVITY OS STANDARD */}
            {notification && typeof document !== 'undefined' && createPortal(
                <div className="fixed bottom-4 right-4 z-[999999] animate-in slide-in-from-right-4 pointer-events-none">
                    <div className={`bg-white border shadow-[4px_4px_15px_rgba(0,0,0,0.15)] p-4 min-w-[320px] flex items-start gap-3 pointer-events-auto ${
                        notification.type === 'error' ? 'border-rose-500' : 
                        notification.type === 'success' ? 'border-emerald-500' : 'border-[#106ebe]'
                    }`}>
                        <div className={`p-1.5 shrink-0 ${
                            notification.type === 'error' ? 'text-rose-600' : 
                            notification.type === 'success' ? 'text-emerald-600' : 'text-[#106ebe]'
                        }`}>
                            {notification.type === 'error' ? <AlertCircle size={18} /> : <ShieldCheck size={18} />}
                        </div>
                        <div className="flex-1 pr-2">
                            <h4 className="text-[10px] font-semibold uppercase text-slate-800 tracking-tight mb-0.5">{notification.title}</h4>
                            <p className="text-[10px] font-medium text-slate-600 leading-tight">{notification.message}</p>
                        </div>
                        <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-900 transition-colors">
                            <X size={14} strokeWidth={3} />
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {confirmModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-black/10 z-[999999] flex items-center justify-center p-4 pointer-events-auto">
                    <DraggableWindow title={confirmModal.title}>
                        <div className="w-[420px] bg-[#f0f0f0] border border-[#106EBE] shadow-[0_0_30px_rgba(0,0,0,0.4)] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                            {/* Header (Mover Modal) - Handled by DraggableWindow or custom if DraggableWindow needs it */}
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <RefreshCw size={14} className="text-white animate-spin-slow" />
                                    <span className="text-white text-[11px] font-medium tracking-wide uppercase">{confirmModal.title}</span>
                                </div>
                                <button onClick={() => setConfirmModal(null)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all" title="Cerrar">
                                    <X size={16} strokeWidth={2.5} />
                                </button>
                            </div>

                            {/* Body content */}
                            <div className="p-6 bg-[#f0f0f0] border-b border-gray-300 flex flex-col items-center text-center gap-4">
                                <div className="w-12 h-12 bg-white border border-gray-300 shadow-sm flex items-center justify-center text-[#106EBE]">
                                    <RefreshCw size={24} />
                                </div>
                                <p className="text-[12px] font-medium text-slate-800 leading-normal">
                                    {confirmModal.message}
                                </p>
                            </div>

                            {/* Footer (Actions) */}
                            <div className="p-3 bg-[#f0f0f0] flex justify-end gap-2">
                                <button 
                                    onClick={confirmModal.onConfirm}
                                    className="px-6 py-1.5 bg-[#106EBE] text-white text-[11px] font-medium uppercase tracking-tight border border-[#0d5a9d] hover:brightness-110 active:scale-95 transition-all shadow-sm"
                                >
                                    Aceptar
                                </button>
                                <button 
                                    onClick={() => setConfirmModal(null)}
                                    className="px-6 py-1.5 bg-white text-slate-700 text-[11px] font-medium uppercase tracking-tight border border-gray-400 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
            {showManualModal && (
                <ManualRetentionModal 
                    onClose={() => setShowManualModal(false)}
                    onSave={handleSaveManual}
                    month={month}
                />
            )}
        </div>
    );
};

// --- Sub-componente Modal Carga Manual (Estilo Windows Classic / Antigravity OS) ---
const ManualRetentionModal: React.FC<{ 
    onClose: () => void, 
    onSave: (data: any) => void,
    month: string
}> = ({ onClose, onSave, month }) => {
    const [formData, setFormData] = useState({
        nit: '',
        nombre: '',
        fecha: dayjs(month + '-01').format('YYYY-MM-DD'),
        numero: '',
        tipo: 'IVA',
        monto: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/10 pointer-events-auto">
            <DraggableWindow title="Nueva Retención Manual">
                <div className="w-[450px] bg-[#f0f0f0] border border-[#106EBE] shadow-[0_0_30px_rgba(0,0,0,0.4)] flex flex-col animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
                    {/* Header (Mapeado a Estándar) */}
                    <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                        <div className="flex items-center gap-2">
                            <FileText size={14} className="text-white" />
                            <span className="text-white text-[11px] font-medium tracking-wide uppercase">Carga de Constancia CRE</span>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all" title="Cerrar">
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Body (Windows Dense Style) */}
                    <form onSubmit={handleSubmit} className="p-4 bg-[#f0f0f0] flex flex-col gap-4 border-b border-gray-300">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-tight">NIT Emisor / Agente:</label>
                                <input 
                                    required
                                    autoFocus
                                    value={formData.nit}
                                    onChange={e => setFormData(f => ({ ...f, nit: e.target.value.toUpperCase() }))}
                                    className="h-7 border border-gray-400 bg-white px-2 text-[11px] font-medium text-slate-900 focus:border-[#106EBE] outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-tight">No. Constancia:</label>
                                <input 
                                    required
                                    value={formData.numero}
                                    onChange={e => setFormData(f => ({ ...f, numero: e.target.value }))}
                                    className="h-7 border border-gray-400 bg-white px-2 text-[11px] font-medium text-slate-900 focus:border-[#106EBE] outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-medium text-slate-600 uppercase tracking-tight">Nombre del Agente Retenedor:</label>
                            <input 
                                required
                                value={formData.nombre}
                                onChange={e => setFormData(f => ({ ...f, nombre: e.target.value.toUpperCase() }))}
                                className="h-7 border border-gray-400 bg-white px-2 text-[11px] font-medium text-slate-900 focus:border-[#106EBE] outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-tight">Fecha Emisión:</label>
                                <input 
                                    type="date"
                                    required
                                    value={formData.fecha}
                                    onChange={e => setFormData(f => ({ ...f, fecha: e.target.value }))}
                                    className="h-7 border border-gray-400 bg-white px-2 text-[11px] font-medium text-slate-900 focus:border-[#106EBE] outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-tight">Tipo de Retención:</label>
                                <select 
                                    value={formData.tipo}
                                    onChange={e => setFormData(f => ({ ...f, tipo: e.target.value }))}
                                    className="h-7 border border-gray-400 bg-white px-2 text-[11px] font-medium text-slate-900 focus:border-[#106EBE] outline-none"
                                >
                                    <option value="IVA">IVA (Retención 15%)</option>
                                    <option value="ISR">ISR (Renta)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-medium text-slate-600 uppercase tracking-tight">Monto Retenido (GTQ):</label>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-medium">Q</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    required
                                    value={formData.monto}
                                    onChange={e => setFormData(f => ({ ...f, monto: e.target.value }))}
                                    className="h-7 w-full border border-gray-400 bg-white pl-6 pr-2 text-[11px] font-semibold text-[#106EBE] focus:border-[#106EBE] outline-none"
                                />
                            </div>
                        </div>

                        {/* Footer / Actions */}
                        <div className="flex justify-end gap-2 mt-2">
                           <button 
                                type="button"
                                onClick={onClose}
                                className="px-6 py-1 bg-white border border-gray-400 text-[11px] font-medium uppercase hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                className="px-6 py-1 bg-[#106EBE] text-white border border-[#0d5ea0] text-[11px] font-medium uppercase hover:brightness-110 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                            >
                                <ShieldCheck size={14} />
                                Guardar Registro
                            </button>
                        </div>
                    </form>
                </div>
            </DraggableWindow>
        </div>,
        document.body
    );
};

const StatCard = ({ label, value, icon: Icon, color, bg, info }: any) => (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative overflow-hidden group`}>
        <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-semibold uppercase text-slate-500 tracking-widest">{label}</span>
            <div className={`p-1.5 ${bg} ${color} rounded-lg group-hover:scale-110 transition-transform`}>
                <Icon size={14} />
            </div>
        </div>
        <div className="flex items-end gap-2">
            <span className={`text-[18px] font-mono font-semibold text-black leading-none`}>{value}</span>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-50 flex items-center gap-1.5">
            <Info size={10} className="text-slate-300" />
            <span className="text-[8px] font-medium text-slate-400 uppercase tracking-tight leading-none text-balance">{info}</span>
        </div>
    </div>
);

const getTypeColor = (type: string) => {
    switch (type) {
        case 'FACT': 
        case 'FCAM': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'FPEQ': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'FESP': return 'bg-orange-50 text-orange-700 border-orange-200';
        case 'NCRE': 
        case 'NABN': return 'bg-rose-50 text-rose-700 border-rose-200';
        case 'NDEB': return 'bg-orange-50 text-orange-700 border-orange-200';
        case 'CRE': return 'bg-purple-50 text-purple-700 border-purple-200 font-medium';
        case 'CEX': return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 font-medium';
        case 'RECI':
        case 'RDON': return 'bg-slate-100 text-slate-600 border-slate-300';
        default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
};

