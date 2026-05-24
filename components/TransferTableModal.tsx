import React, { useState, useEffect } from 'react';
import { X, Ban, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { Table } from '../types';

interface TransferTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTable: Table;
    onTransfer: (targetTableId: string) => void;
}

export const TransferTableModal: React.FC<TransferTableModalProps> = ({ isOpen, onClose, currentTable, onTransfer }) => {
    const [tables, setTables] = useState<Table[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTables = async () => {
            // Only select necessary columns for elegance if possible, but select * is fine
            const { data } = await supabase.from('tables').select('*').eq('status', 'available').neq('id', currentTable.id).order('number', { ascending: true });
            setTables(data || []);
            setLoading(false);
        };
        if (isOpen) fetchTables();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90  p-4 animate-fade-in">
            <div className="w-full max-w-xl bg-[#16191f] rounded-[2rem] border border-white/10  /50 overflow-hidden flex flex-col max-h-[70vh]">

                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tighter text-white">Trasladar Mesa</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5 leading-none">
                            Mesa Actual: <span className="text-white">{currentTable.number}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {loading ? (
                            <div className="col-span-full py-12 flex justify-center"><Loader2 className="animate-spin text-white w-8 h-8" /></div>
                        ) : tables.length > 0 ? (
                            tables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => setSelectedTableId(table.id)}
                                    className={`group relative h-20 rounded-xl border flex flex-col items-center justify-center transition-all overflow-hidden ${selectedTableId === table.id
                                        ? 'bg-white border-white  /50 translate-y-[-2px]'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 active:scale-95'
                                        }`}
                                >
                                    <span className={`text-xl font-black tracking-tighter z-10 ${selectedTableId === table.id ? 'text-black' : 'text-gray-300'}`}>
                                        {table.number}
                                    </span>
                                    <span className={`text-[8px] font-bold uppercase tracking-widest z-10 ${selectedTableId === table.id ? 'text-black/60' : 'text-gray-600'}`}>
                                        {table.section}
                                    </span>

                                    {/* Aesthetic decoration */}
                                    {selectedTableId === table.id && (
                                        <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-white/10 rounded-full blur-xl"></div>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="col-span-full py-16 text-center opacity-40 flex flex-col items-center">
                                <Ban size={32} className="mb-2 text-gray-500" />
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">No hay mesas disponibles</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 bg-black/40 border-t border-white/5 shrink-0">
                    <button
                        disabled={!selectedTableId}
                        onClick={() => selectedTableId && onTransfer(selectedTableId)}
                        className="w-full py-4 bg-white hover:bg-white/90 disabled:bg-white/5 disabled:text-gray-600 disabled:border-white/5 text-black rounded-xl font-black uppercase tracking-[0.2em] text-[10px]  /40 transition-all active:scale-95 flex items-center justify-center gap-2 group"
                    >
                        <span>Confirmar Traslado</span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
};
