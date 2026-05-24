import React, { useState, useEffect } from 'react';
import { Banknote, CreditCard, X, Percent, Edit3, Landmark } from 'lucide-react';

interface TipMethodModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (method: 'EFECTIVO' | 'TARJETA' | 'OTROS', amount: number) => void;
    amount: number;
    currency: string;
    isLocked?: boolean;
}

export const TipMethodModal: React.FC<TipMethodModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    amount: initialAmount,
    currency,
    isLocked = false
}) => {
    const [localAmount, setLocalAmount] = useState<string>(initialAmount.toFixed(2));

    useEffect(() => {
        if (isOpen) {
            setLocalAmount(initialAmount.toFixed(2));
        }
    }, [isOpen, initialAmount]);

    if (!isOpen) return null;

    const currentVal = parseFloat(localAmount) || 0;

    return (
        <div className="fixed inset-0 bg-black/80  z-[120] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-[#1e212b] w-full max-w-md rounded-xl border border-white/10  /50 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                            <Percent size={18} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">MÉTODO DE PROPINA</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 flex flex-col items-center gap-8">
                    <div className="text-center w-full">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block mb-2">Monto de Propina</span>
                        <div className="relative group">
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-2xl font-black text-white/20">{currency}</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={localAmount}
                                    onChange={(e) => setLocalAmount(e.target.value)}
                                    className={`bg-transparent text-5xl font-black tabular-nums tracking-tighter border-none outline-none w-48 text-center focus:ring-0 ${isLocked ? 'text-white/80 cursor-pointer' : 'text-white'}`}
                                    autoFocus
                                />
                            </div>
                            <div className={`mt-2 flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${isLocked ? 'text-white/40' : 'text-white/20 group-hover:text-white/40'}`}>
                                {isLocked ? <Edit3 size={10} /> : <Edit3 size={10} />}
                                <span>{isLocked ? 'Editar (Requiere PIN)' : 'Editar Monto'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 w-full">
                        <button
                            onClick={() => onConfirm('EFECTIVO', currentVal)}
                            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group"
                        >
                            <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-white/10 transition-all">
                                <Banknote size={28} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">Efectivo</span>
                        </button>

                        <button
                            onClick={() => onConfirm('TARJETA', currentVal)}
                            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-white/5 border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all group"
                        >
                            <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-indigo-400 group-hover:bg-indigo-400/20 transition-all">
                                <CreditCard size={28} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">Tarjeta</span>
                        </button>

                        <button
                            onClick={() => onConfirm('OTROS', currentVal)}
                            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-white/5 border border-white/5 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all group"
                        >
                            <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-amber-400 group-hover:bg-amber-400/20 transition-all">
                                <Landmark size={28} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">Otros</span>
                        </button>
                    </div>

                    <button
                        onClick={() => onConfirm('EFECTIVO', 0)}
                        className={`w-full py-4 mt-6 rounded-lg border border-dashed transition-all font-black text-[10px] uppercase tracking-[0.2em] ${isLocked ? 'border-white/20 text-white/60 hover:text-white hover:border-white/30 hover:bg-white/5' : 'border-white/10 text-gray-500 hover:text-white hover:border-white/30 hover:bg-white/5'}`}
                    >
                        {isLocked ? 'QUITAR PROPINA (PIDE PIN)' : 'QUITAR / SIN PROPINA'}
                    </button>
                </div>

                <div className="p-6 bg-white/5 border-t border-white/5">
                    <button
                        onClick={onClose}
                        className="w-full h-14 rounded-lg border border-white/10 font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all"
                    >
                        CANCELAR
                    </button>
                </div>
            </div>
        </div>
    );
};
