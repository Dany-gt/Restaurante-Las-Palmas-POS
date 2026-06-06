import React, { useState, useEffect } from 'react';

interface PaxModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPax: number;
    onConfirm: (pax: number) => void;
    tableName?: string;
}

export const PaxModal: React.FC<PaxModalProps> = ({ isOpen, onClose, initialPax, onConfirm, tableName }) => {
    const [pax, setPax] = useState(initialPax);

    // Update local state if initialPax changes while modal is closed or opens
    useEffect(() => {
        if (isOpen) {
            setPax(initialPax);
        }
    }, [isOpen, initialPax]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 animate-fade-in">
            <div className="w-full max-w-[320px] bg-[#2d2e3d] rounded-2xl p-6 shadow-2xl">
                {tableName && (
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center mt-2">
                        {tableName}
                    </p>
                )}
                <h3 className="text-sm font-bold text-white uppercase text-center mt-1 mb-8">
                    Personas
                </h3>

                <div className="flex items-center justify-center gap-6 mb-10">
                    <button
                        onClick={() => setPax(Math.max(1, pax - 1))}
                        className="w-14 h-14 bg-[#3f4251] rounded-xl text-white flex items-center justify-center font-bold text-2xl active:scale-95 transition-transform"
                    >
                        -
                    </button>
                    
                    <span className="text-5xl font-bold text-white w-16 text-center tabular-nums">
                        {pax}
                    </span>
                    
                    <button
                        onClick={() => setPax(pax + 1)}
                        className="w-14 h-14 bg-[#3f4251] rounded-xl text-white flex items-center justify-center font-bold text-2xl active:scale-95 transition-transform"
                    >
                        +
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 h-12 bg-[#3f4251] hover:bg-white/10 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl active:scale-95 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            onConfirm(pax);
                            onClose();
                        }}
                        className="flex-1 h-12 bg-white text-black text-[11px] font-bold uppercase tracking-wider rounded-xl active:scale-95 transition-all"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};
