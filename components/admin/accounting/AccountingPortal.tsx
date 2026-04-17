import React, { useState, useEffect } from 'react';
import {
    Receipt, TrendingUp, Users, ShoppingCart,
    Wallet, BarChart3, CalendarDays, AlertCircle, X,
    Cloud, Minus, Maximize2, RefreshCw, CloudDownload, ShieldCheck
} from 'lucide-react';
import { supabase } from '../../../supabase';
import dayjs from 'dayjs';
import { createPortal } from 'react-dom';
import { DraggableWindow } from '../DraggableWindow';
import { TabIVA } from './TabIVA.tsx';
import { TabISR } from './TabISR.tsx';
import { TabPlanilla } from './TabPlanilla.tsx';
import { TabCompras } from './TabCompras.tsx';
import { TabFlujoCaja } from './TabFlujoCaja.tsx';
import { TabEstadosFinancieros } from './TabEstadosFinancieros.tsx';
import { TabCalendarioFiscal } from './TabCalendarioFiscal.tsx';
import { TabAuditoriaSAT } from './TabAuditoriaSAT.tsx';
import { TabLibrosContables } from './TabLibrosContables.tsx';

const TABS = [
    { id: 'iva',        label: 'IVA',                         icon: Receipt,       color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-500',    accent: '#2563eb' },
    { id: 'isr',        label: 'ISR',                         icon: TrendingUp,    color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-500',  accent: '#ea580c' },
    { id: 'planilla',   label: 'Planilla e IGSS',             icon: Users,         color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-500', accent: '#059669' },
    { id: 'compras',    label: 'Libros de Compra y Venta SAT',icon: ShoppingCart,  color: 'text-[#106ebe]',  bg: 'bg-blue-50',    border: 'border-[#106ebe]',   accent: '#106ebe' },
    { id: 'flujo',      label: 'Flujo de Caja',               icon: Wallet,        color: 'text-teal-600',   bg: 'bg-teal-50',    border: 'border-teal-500',    accent: '#0d9488' },
    { id: 'libros',     label: 'Libros Contables',            icon: ShieldCheck,   color: 'text-violet-600', bg: 'bg-violet-50',  border: 'border-violet-500',  accent: '#7c3aed' },
    { id: 'estados',    label: 'Estados Financieros',         icon: BarChart3,     color: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-500',   accent: '#475569' },
    { id: 'calendario', label: 'Calendario Fiscal',           icon: CalendarDays,  color: 'text-rose-600',   bg: 'bg-rose-50',    border: 'border-rose-500',    accent: '#e11d48' },
    { id: 'auditoria',  label: 'Auditoría SAT',               icon: AlertCircle,   color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-500',  accent: '#4f46e5' },
];

const useFiscalAlerts = () => {
    const today = new Date();
    const day = today.getDate();
    const alerts: { label: string; days: number; color: string }[] = [];

    // Día 15 → IVA
    const ivaDue = new Date(today.getFullYear(), today.getMonth(), 15);
    if (today > ivaDue) ivaDue.setMonth(ivaDue.getMonth() + 1);
    const ivaDays = Math.ceil((ivaDue.getTime() - today.getTime()) / 86400000);
    if (ivaDays <= 10) alerts.push({ label: 'IVA vence', days: ivaDays, color: 'text-blue-600' });

    // Día 20 → IGSS
    const igssDue = new Date(today.getFullYear(), today.getMonth(), 20);
    if (today > igssDue) igssDue.setMonth(igssDue.getMonth() + 1);
    const igssDays = Math.ceil((igssDue.getTime() - today.getTime()) / 86400000);
    if (igssDays <= 10) alerts.push({ label: 'IGSS vence', days: igssDays, color: 'text-emerald-600' });

    return alerts;
};

// --- Tipos para Sync Global ---
interface SatSyncResult { total: number; imported: number; skipped: number; errors: number }
interface SatSyncState {
    syncing: boolean;
    status: string;
    progress: number;
    result: SatSyncResult | null;
    minimized: boolean;
    showModal: boolean;
    dateStart: string;
    dateEnd: string;
    tipo: 'recibida' | 'emitida';
    lastCompletedAt: string | null;
}

export const AccountingPortal: React.FC = () => {
    const [activeTab, setActiveTab] = useState('iva');
    const [showAlertBar, setShowAlertBar] = useState(true);
    const alerts = useFiscalAlerts();
    
    // --- Estado Global de Sincronización SAT ---
    const [sat, setSat] = useState<SatSyncState>({
        syncing: false, status: '', progress: 0, result: null, minimized: false, showModal: false,
        dateStart: dayjs().startOf('month').format('YYYY-MM-DD'),
        dateEnd: dayjs().format('YYYY-MM-DD'),
        tipo: 'recibida', lastCompletedAt: null
    });
    const [portalError, setPortalError] = useState<string | null>(null);

    const handleSatSync = async () => {
        setSat(s => ({ ...s, syncing: true, status: 'Obteniendo credenciales SAT...', progress: 5, result: null }));
        let progressInterval: any;

        try {
            const { data: settings } = await supabase.from('system_settings').select('sat_username, sat_password').eq('id', 1).single();
            if (!settings?.sat_username || !settings?.sat_password) {
                setPortalError('⚠️ No hay credenciales SAT configuradas en los ajustes del sistema.');
                setSat(s => ({ ...s, syncing: false, status: '', progress: 0 }));
                return;
            }

            // @ts-ignore
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
            // @ts-ignore
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

            // ── Dividir en bloques diarios para evitar timeout y ver avance más rápido ──
            const chunks: { start: string; end: string }[] = [];
            const startDate = dayjs(sat.dateStart);
            const endDate = dayjs(sat.dateEnd);

            let cursor = startDate;
            while (cursor.isBefore(endDate) || cursor.isSame(endDate)) {
                const chunkStr = cursor.format('YYYY-MM-DD');
                chunks.push({ start: chunkStr, end: chunkStr });
                cursor = cursor.add(1, 'day');
            }

            let totalImported = 0;
            let totalFound = 0;
            let totalErrors = 0;

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const basePct = Math.round(10 + ((i / chunks.length) * 80));
                const nextPct = Math.round(10 + (((i + 1) / chunks.length) * 80));
                
                const label = chunks.length > 1 
                    ? `Día ${i + 1}/${chunks.length}: ${chunk.start}` 
                    : `Sincronizando ${sat.tipo === 'emitida' ? 'emitidas' : 'recibidas'}...`;
                
                setSat(s => ({ ...s, status: label, progress: basePct }));

                // Iniciar animación visual hacia el próximo porcentaje
                if (progressInterval) clearInterval(progressInterval);
                progressInterval = setInterval(() => {
                    setSat(s => {
                        const target = nextPct - 2; // dejarlo casi terminado
                        if (s.progress >= target) return s;
                        return { ...s, progress: s.progress + 1 };
                    });
                }, 500);

                const response = await window.fetch('/api/sat-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: settings.sat_username, password: settings.sat_password,
                        dateStart: chunk.start, dateEnd: chunk.end, tipo: sat.tipo,
                        supabaseUrl, supabaseKey
                    })
                });

                clearInterval(progressInterval);

                const data = await response.json();
                if (!response.ok || !data.success) {
                    console.warn(`Chunk ${i + 1} failed: ${data.error}`);
                    continue;
                }

                totalFound += data.total || 0;
                totalImported += data.imported || 0;
                totalErrors += data.errors || 0;
            }

            setSat(s => ({ 
                ...s, syncing: false, status: '✅ Sincronización completada', progress: 100,
                result: { total: totalFound, imported: totalImported, skipped: Math.max(0, totalFound - totalImported - totalErrors), errors: totalErrors },
                lastCompletedAt: new Date().toISOString()
            }));
        } catch (err: any) {
            if (progressInterval) clearInterval(progressInterval);
            setSat(s => ({ ...s, syncing: false, status: `❌ Error: ${err.message}`, progress: 0 }));
            setPortalError(`Error SAT: ${err.message}`);
        }
    };

    const currentTab = TABS.find(t => t.id === activeTab)!;

    const renderTab = () => {
        const commonProps = { 
            satSyncing: sat.syncing, 
            satLastSync: sat.lastCompletedAt,
            onOpenSatSync: () => setSat(s => ({ ...s, showModal: true, minimized: false }))
        };

        switch (activeTab) {
            case 'iva':        return <TabIVA accentColor={TABS[0].accent} {...commonProps} />;
            case 'isr':        return <TabISR accentColor={TABS[1].accent} {...commonProps} />;
            case 'planilla':   return <TabPlanilla accentColor={TABS[2].accent} />;
            case 'compras':    return <TabCompras accentColor={TABS[3].accent} {...commonProps} />;
            case 'flujo':      return <TabFlujoCaja accentColor={TABS[4].accent} />;
            case 'libros':     return <TabLibrosContables accentColor={TABS[5].accent} />;
            case 'estados':    return <TabEstadosFinancieros accentColor={TABS[6].accent} />;
            case 'calendario': return <TabCalendarioFiscal accentColor={TABS[7].accent} onNavigate={setActiveTab} />;
            case 'auditoria':  return <TabAuditoriaSAT accentColor={TABS[8].accent} />;
            default:          return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f0f0f0] font-sans overflow-hidden">

            {/* Alert Bar */}
            {showAlertBar && alerts.length > 0 && (
                <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-4">
                    <AlertCircle size={14} className="text-amber-600 shrink-0" />
                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Próximas obligaciones:</span>
                    <div className="flex gap-4 flex-1">
                        {alerts.map((a, i) => (
                            <span key={i} className={`text-[10px] font-bold ${a.color}`}>
                                {a.label} en <strong>{a.days}</strong> días
                            </span>
                        ))}
                    </div>
                    <button onClick={() => setShowAlertBar(false)} className="text-amber-400 hover:text-amber-700">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Tab Header */}
            <div className="shrink-0 bg-white border-b border-gray-200 px-4 pt-2">
                <div className="flex items-end gap-1 overflow-x-auto">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = tab.id === activeTab;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold rounded-t-lg border-t-2 transition-all whitespace-nowrap
                                    ${isActive
                                        ? `bg-white ${tab.color} ${tab.border} border-x border-gray-200 shadow-sm -mb-px z-10`
                                        : 'bg-[#f0f0f0] text-slate-500 border-transparent hover:bg-white hover:text-slate-700'
                                    }`}
                            >
                                <Icon size={13} strokeWidth={isActive ? 2.5 : 2} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden relative">
                {renderTab()}

                {/* --- INDICADOR FLOTANTE (MINIMIZADO) --- */}
                {sat.syncing && sat.minimized && (
                    <div 
                        onClick={() => setSat(s => ({ ...s, minimized: false, showModal: true }))}
                        className="absolute bottom-4 right-4 bg-white border-2 border-[#106ebe] shadow-2xl rounded-xl p-3 flex items-center gap-4 cursor-pointer hover:scale-105 transition-all z-[9999]"
                    >
                        <div className="w-8 h-8 rounded-full border-2 border-slate-100 border-t-[#106ebe] animate-spin" />
                        <div className="flex flex-col pr-4">
                            <span className="text-[9px] font-black uppercase text-[#106ebe] tracking-widest">Sincronizando SAT...</span>
                            <span className="text-[10px] font-bold text-slate-600 truncate max-w-[200px]">{sat.status}</span>
                        </div>
                        <Maximize2 size={14} className="text-slate-400" />
                    </div>
                )}
            </div>

            {/* --- MODAL GLOBAL DE SINCRONIZACIÓN --- */}
            {sat.showModal && !sat.minimized && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/10 backdrop-blur-[2px]">
                    <DraggableWindow id="sat-sync-console" title="Consola de Sincronización SAT">
                        <div className="w-[800px] bg-[#f2f2f2] shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-[#106EBE] flex flex-col animate-in fade-in zoom-in duration-200">
                            {/* Toolbar (Header) */}
                            <div className="bg-[#106EBE] h-9 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0">
                                <div className="flex items-center gap-2">
                                    <Cloud size={14} className="text-white/80" />
                                    <span className="text-white text-[11px] font-black uppercase tracking-widest">Canal de Sincronización SAT</span>
                                </div>
                                <div className="flex items-center">
                                    <button 
                                        onClick={() => setSat(s => ({ ...s, minimized: true }))}
                                        className="w-9 h-9 flex items-center justify-center hover:bg-white/10 transition-all text-white border-r border-white/10" 
                                        title="Minimizar"
                                    >
                                        <Minus size={14} strokeWidth={2.5} />
                                    </button>
                                    <button 
                                        onClick={() => !sat.syncing && setSat(s => ({ ...s, showModal: false }))} 
                                        className="w-9 h-9 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" 
                                        title="Cerrar"
                                    >
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-row h-[400px] overflow-hidden">
                                {/* Left: Config */}
                                <div className="w-[340px] p-6 bg-slate-50 border-r border-slate-200 space-y-6">
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block border-b pb-1">Configuración Temporal</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Fecha Inicio</label>
                                                <input type="date" value={sat.dateStart} onChange={e => setSat(s => ({ ...s, dateStart: e.target.value }))} className="w-full bg-white border border-slate-300 text-[11px] font-black px-2 py-1.5 rounded outline-none focus:border-[#106EBE] h-8 shadow-sm" />
                                            </div>
                                            <div>
                                                <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Fecha Fin</label>
                                                <input type="date" value={sat.dateEnd} onChange={e => setSat(s => ({ ...s, dateEnd: e.target.value }))} className="w-full bg-white border border-slate-300 text-[11px] font-black px-2 py-1.5 rounded outline-none focus:border-[#106EBE] h-8 shadow-sm" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block border-b pb-1">Libro Objetivo</label>
                                        <div className="flex flex-col gap-2">
                                            {['recibida', 'emitida'].map(t => (
                                                <button key={t} onClick={() => setSat(s => ({ ...s, tipo: t as any }))}
                                                    className={`px-4 py-2.5 text-[10px] font-black uppercase rounded border transition-all flex items-center gap-3 ${sat.tipo === t ? 'bg-white border-[#106ebe] text-[#106ebe] shadow-md ring-2 ring-[#106ebe]/10' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-white'}`}>
                                                    <div className={`w-3 h-3 rounded-full border-2 ${sat.tipo === t ? 'bg-[#106ebe] border-[#106ebe]' : 'bg-white border-slate-300'}`} />
                                                    {t === 'recibida' ? 'Facturas Recibidas (Compras)' : 'Facturas Emitidas (Ventas)'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {!sat.syncing && (
                                        <button onClick={handleSatSync} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 mt-4">
                                            <CloudDownload size={16} /> Sincronizar Ahora
                                        </button>
                                    )}
                                </div>

                                {/* Right: Status */}
                                <div className="flex-1 p-8 bg-white flex flex-col justify-center overflow-y-auto custom-scrollbar">
                                    {sat.syncing ? (
                                        <div className="flex flex-col items-center space-y-6">
                                            <div className="w-16 h-16 border-4 border-slate-100 border-t-[#106ebe] rounded-full animate-spin" />
                                            <div className="text-center space-y-2">
                                                <p className="text-[14px] font-black text-slate-800 uppercase tracking-tight">{sat.status}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">El proceso continúa si cambias de pestaña o minimizas...</p>
                                            </div>
                                            <div className="w-full max-w-xs bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200 relative">
                                                <div 
                                                    className="bg-[#106ebe] h-full transition-all duration-300 ease-out" 
                                                    style={{ width: `${sat.progress}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-[#106ebe]">{sat.progress}%</span>
                                        </div>
                                    ) : sat.result ? (
                                        <div className="space-y-6 animate-in slide-in-from-bottom-2">
                                            <div className="text-center">
                                                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-inner">
                                                    <ShieldCheck size={28} />
                                                </div>
                                                <h4 className="text-[18px] font-black text-black uppercase">Sync Completada</h4>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-3">
                                                 <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                                                     <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 text-[10px] font-black">{sat.result.imported}</div>
                                                     <div><span className="block text-[7px] font-black text-slate-400 uppercase">Nuevas</span><span className="text-[9px] font-bold text-slate-700">Hecho</span></div>
                                                 </div>
                                                 <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                                                     <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 text-[10px] font-black">{sat.result.skipped}</div>
                                                     <div><span className="block text-[7px] font-black text-slate-400 uppercase">Omitidas</span><span className="text-[9px] font-bold text-slate-700">Existían</span></div>
                                                 </div>
                                                 <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                                                     <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 text-[10px] font-black">{sat.result.errors}</div>
                                                     <div><span className="block text-[7px] font-black text-slate-400 uppercase">Errores</span><span className="text-[9px] font-bold text-slate-700">Fallas</span></div>
                                                 </div>
                                             </div>

                                            <button onClick={() => setSat(s => ({ ...s, showModal: false }))} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black uppercase rounded-xl transition-all">Regresar</button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center opacity-30 text-center space-y-4">
                                            <CloudDownload size={64} className="text-slate-200" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Listo para iniciar...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* Notification Portal Overlay — ANTIGRAVITY OS STANDARD */}
            {portalError && (
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[999999] animate-in slide-in-from-top-4">
                    <div className="bg-rose-600 text-white px-6 py-2 border border-rose-700 shadow-[0_0_20px_rgba(0,0,0,0.3)] flex items-center gap-3">
                        <AlertCircle size={16} />
                        <span className="text-[11px] font-black uppercase tracking-widest">{portalError}</span>
                        <button onClick={() => setPortalError(null)} className="ml-4 p-1 hover:bg-black/20 transition-colors">
                            <X size={14} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
