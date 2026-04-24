import React, { useState } from 'react';
import { X, Users, Minus, Plus } from 'lucide-react';

interface PaxModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPax: number;
    onConfirm: (pax: number) => void;
}

export const PaxModal: React.FC<PaxModalProps> = ({ isOpen, onClose, initialPax, onConfirm }) => {
    const [pax, setPax] = useState(initialPax);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fade-in">
            <div className="w-full max-w-sm bg-[#16191f] rounded-3xl border border-white/10 shadow-2xl p-8">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter">Rectificar Personas</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Capacidad de la Mesa (PAX)</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="flex flex-col items-center gap-8 mb-10">
                    <div className="w-24 h-24 bg-indigo-600/20 rounded-3xl flex items-center justify-center border-2 border-indigo-500/20 shadow-xl shadow-indigo-600/10">
                        <span className="text-5xl font-black tabular-nums text-indigo-400">{pax}</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setPax(Math.max(1, pax - 1))}
                            className="w-16 h-16 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center border border-white/5 transition-all active:scale-90"
                        >
                            <Minus size={24} />
                        </button>
                        <div className="w-px h-8 bg-white/10"></div>
                        <button
                            onClick={() => setPax(pax + 1)}
                            className="w-16 h-16 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center border border-white/5 transition-all active:scale-90"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => {
                        onConfirm(pax);
                        onClose();
                    }}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                >
                    Guardar Cambios
                </button>
            </div>
        </div>
    );
};
