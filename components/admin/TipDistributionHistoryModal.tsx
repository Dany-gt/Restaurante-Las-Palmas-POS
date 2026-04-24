import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    History,
    Calendar,
    Search,
    ChevronRight,
    Eye,
    FileText,
    Users,
    ChefHat,
    Loader2
} from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './DraggableWindow';
import dayjs from 'dayjs';

const formatCurr = (v: number) => (v || 0).toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' });

interface Props {
    onClose: () => void;
}

export const TipDistributionHistoryModal: React.FC<Props> = ({ onClose }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDist, setSelectedDist] = useState<any>(null);
    const [details, setDetails] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            const { data, error } = await supabase
                .from('tip_distributions')
                .select(`*, branches (name)`)
                .order('created_at', { ascending: false });
            if (!error) setHistory(data || []);
            setLoading(false);
        };
        fetchHistory();
    }, []);

    const fetchDetails = async (distId: string) => {
        setLoadingDetails(true);
        const { data, error } = await supabase
            .from('tip_distribution_items')
            .select('*')
            .eq('distribution_id', distId)
            .order('type', { ascending: false });
        if (!error) setDetails(data || []);
        setLoadingDetails(false);
    };

    const handleSelect = (dist: any) => {
        setSelectedDist(dist);
        fetchDetails(dist.id);
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/40 select-none">
            <DraggableWindow id="tip-distribution-history" title="Historial de Liquidación de Propinas">
                <div className="w-[1000px] h-[650px] bg-[#fdfdfd] border-2 border-[#106ebe] shadow-[0_30px_90px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                    <div className="modal-header bg-[#106ebe] h-9 px-4 flex justify-between items-center cursor-move border-b border-black">
                        <div className="flex items-center gap-2 pointer-events-none">
                            <History size={16} className="text-blue-400" />
                            <span className="text-white text-[11px] font-black uppercase tracking-widest text-[#f0f0f0]">Historial de Liquidaciones</span>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-red-600 text-white transition-colors">
                            <X size={22} />
                        </button>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        <div className="w-1/3 border-r-2 border-slate-200 bg-slate-50 overflow-y-auto">
                            <div className="p-3 bg-slate-200 border-b border-slate-300">
                                <span className="text-[10px] font-black uppercase text-slate-800 tracking-tighter">Liquidaciones Guardadas</span>
                            </div>
                            <div className="divide-y divide-slate-200">
                                {history.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => handleSelect(item)}
                                        className={`p-3 cursor-pointer hover:bg-white transition-all flex items-center justify-between group ${selectedDist?.id === item.id ? 'bg-white border-l-4 border-blue-600' : ''}`}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[11px] font-black text-slate-800">{dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}</span>
                                            <span className="text-[9px] font-bold text-slate-400 capitalize">{item.branches?.name || 'Global'}</span>
                                            <span className="text-[10px] font-black text-emerald-600 font-mono">{formatCurr(item.total_bruta)}</span>
                                        </div>
                                        <ChevronRight size={16} className={`${selectedDist?.id === item.id ? 'text-blue-600' : 'text-slate-300'}`} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col bg-white overflow-hidden">
                            {selectedDist ? (
                                <>
                                    <div className="p-4 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center">
                                        <div>
                                            <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Liquidación Periodo</h2>
                                            <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">
                                                {dayjs(selectedDist.periodo_inicio).format('DD/MM/YY')} al {dayjs(selectedDist.periodo_fin).format('DD/MM/YY')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[8px] font-black text-slate-400 uppercase">Total Bruto</span>
                                            <div className="text-sm font-black font-mono text-slate-900">{formatCurr(selectedDist.total_bruta)}</div>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-100 text-[9px] font-black text-slate-600 uppercase">
                                                <tr className="border-b border-slate-300">
                                                    <th className="px-3 py-2">Colaborador</th>
                                                    <th className="px-3 py-2 text-center">Tipo</th>
                                                    <th className="px-3 py-2 text-right">Neto Pagado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-[11px] font-black text-slate-800 uppercase bg-white">
                                                {details.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="px-3 py-2">{row.employee_name}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[8px] ${row.type === 'MESERO' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                {row.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono">{formatCurr(row.monto_neto)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                                    <FileText size={48} className="mb-2 opacity-10" />
                                    <p className="text-[9px] font-black uppercase tracking-widest">Seleccionar liquidación para ver detalle</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DraggableWindow>
        </div>,
        document.body
    );
};
