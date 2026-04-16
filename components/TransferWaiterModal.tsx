import React, { useState, useEffect } from 'react';
import { X, UserPlus, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { User } from '../types';

interface TransferWaiterModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentWaiterName?: string;
    onTransfer: (waiterId: string) => void;
}

export const TransferWaiterModal: React.FC<TransferWaiterModalProps> = ({ isOpen, onClose, currentWaiterName, onTransfer }) => {
    const [waiters, setWaiters] = useState<User[]>([]);
    const [selectedWaiterId, setSelectedWaiterId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWaiters = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, role')
                .neq('role', 'SISTEMA') // Get all staff except system
                .order('name', { ascending: true });

            if (error) {
                console.error('Error fetching waiters:', error);
            } else {
                setWaiters(data || []);
            }
            setLoading(false);
        };

        if (isOpen) fetchWaiters();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-transparent p-4 animate-fade-in">
            <div className="w-full max-w-2xl bg-[#2e3248] rounded-[1.5rem] border-2 border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="px-8 py-5 border-b border-white/5 flex flex-col items-center justify-center shrink-0">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-1">USUARIOS</h3>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight leading-none">SELECCIONAR</h4>
                </div>

                {/* List - Grid Design */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    {loading ? (
                        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
                    ) : waiters.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {waiters.map(waiter => (
                                <button
                                    key={waiter.id}
                                    onClick={() => setSelectedWaiterId(waiter.id)}
                                    className={`relative p-3 rounded-xl border-2 flex flex-col items-start justify-center transition-all active:scale-95 group ${selectedWaiterId === waiter.id
                                        ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-600/30'
                                        : 'bg-[#1e212b] border-transparent'
                                        }`}
                                >
                                    <span className={`block text-[11px] font-black uppercase tracking-tight mb-0.5 truncate w-full text-left ${selectedWaiterId === waiter.id ? 'text-white' : 'text-gray-100'}`}>
                                        {waiter.name}
                                    </span>
                                    <span className={`text-[8px] font-bold uppercase tracking-widest ${selectedWaiterId === waiter.id ? 'text-indigo-200' : 'text-gray-500'}`}>
                                        {waiter.role || 'USUARIO'}
                                    </span>

                                    {selectedWaiterId === waiter.id && (
                                        <div className="absolute top-2 right-2 text-white/50">
                                            <CheckCircle size={12} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center opacity-40 flex flex-col items-center">
                            <UserPlus size={32} className="mb-2 text-gray-500" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">No hay usuarios</p>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="px-8 py-6 flex gap-4 mt-auto bg-black/10 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 bg-[#1e212b] border-2 border-white/5 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] text-white hover:bg-white/5 transition-all active:scale-95"
                    >
                        CANCELAR
                    </button>
                    <button
                        disabled={!selectedWaiterId}
                        onClick={() => selectedWaiterId && onTransfer(selectedWaiterId)}
                        className="flex-1 py-3.5 bg-indigo-600 border-2 border-indigo-400/30 disabled:bg-gray-800/50 disabled:text-gray-600 text-white rounded-xl font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-indigo-600/40 transition-all active:scale-95"
                    >
                        ACEPTAR
                    </button>
                </div>
            </div>
        </div>
    );
};
