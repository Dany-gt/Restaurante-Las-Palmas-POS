import React, { useState, useEffect, useMemo } from 'react';
import { X, Delete, Check, Save } from 'lucide-react';

interface ArqueoModalProps {
    onClose: () => void;
    onSave: (total: number, detail: any) => void;
    expectedAmount?: number;
    isBlind?: boolean;
    title?: string;
}

const DENOMINATIONS = {
    monedas: [
        { id: 'm_0.01', label: 'Q0.01', val: 0.01 },
        { id: 'm_0.05', label: 'Q0.05', val: 0.05 },
        { id: 'm_0.10', label: 'Q0.10', val: 0.10 },
        { id: 'm_0.25', label: 'Q0.25', val: 0.25 },
        { id: 'm_0.50', label: 'Q0.50', val: 0.50 },
        { id: 'm_1.00', label: 'Q1.00', val: 1.00 },
    ],
    billetes: [
        { id: 'b_1.00', label: 'Q1.00', val: 1.00 },
        { id: 'b_5.00', label: 'Q5.00', val: 5.00 },
        { id: 'b_10.00', label: 'Q10.00', val: 10.00 },
        { id: 'b_20.00', label: 'Q20.00', val: 20.00 },
        { id: 'b_50.00', label: 'Q50.00', val: 50.00 },
        { id: 'b_100.00', label: 'Q100.00', val: 100.00 },
        { id: 'b_200.00', label: 'Q200.00', val: 200.00 },
    ]
};

export const ArqueoModal: React.FC<ArqueoModalProps> = ({ onClose, onSave, expectedAmount, isBlind = true, title }) => {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [activeInput, setActiveInput] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState('');

    const calculateSubtotal = (val: number, count: number) => val * count;

    const totalArqueo = useMemo(() => {
        let total = 0;
        [...DENOMINATIONS.monedas, ...DENOMINATIONS.billetes].forEach(d => {
            total += (counts[d.id] || 0) * d.val;
        });
        total += (counts['MANUAL'] || 0);
        return total;
    }, [counts]);

    const handleKeyPad = (key: string) => {
        if (!activeInput) return;

        setTempValue(prev => {
            let newVal = prev;
            if (key === 'BACKSPACE') {
                newVal = prev.slice(0, -1);
            } else if (key === 'DOT') {
                newVal = prev.includes('.') ? prev : prev + '.';
            } else {
                if (prev === '0') {
                    newVal = key;
                } else {
                    newVal = prev + key;
                }
            }

            // Sync with counts immediately
            const numericValue = activeInput === 'MANUAL' ? parseFloat(newVal) || 0 : parseInt(newVal) || 0;
            setCounts(cPrev => ({ ...cPrev, [activeInput]: numericValue }));

            return newVal;
        });
    };

    const handleInputClick = (label: string) => {
        setActiveInput(label);
        setTempValue(counts[label] ? counts[label].toString() : '');
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                confirmValue();
            } else if (e.key === 'Escape') {
                onClose();
            } else if (e.key >= '0' && e.key <= '9') {
                handleKeyPad(e.key);
            } else if (e.key === 'Backspace') {
                handleKeyPad('BACKSPACE');
            } else if (e.key === '.') {
                handleKeyPad('DOT');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeInput, tempValue, counts, totalArqueo]);

    const confirmValue = () => {
        if (!activeInput) {
            onSave(totalArqueo, counts);
            return;
        }
        setActiveInput(null);
        setTempValue('');
    };

    return (
        <div className="fixed inset-0 bg-[#252836] z-[200] flex flex-col animate-fade-in">
            {/* Header / Topbar */}
            <header className="px-6 py-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 transition-colors flex items-center gap-2">
                        <X size={18} />
                        <span className="text-xs font-bold uppercase tracking-wider">Cerrar Arqueo</span>
                    </button>
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">{title || 'PALADAR POS - Arqueo de Caja'}</h2>
                </div>
            </header>

            {/* Centered Main Content */}
            <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
                <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-12">
                    
                    {/* COL 1: Monedas */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-[#303343] py-2 rounded-t-lg border-b border-white/5 text-center">
                            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Monedas</h3>
                        </div>
                        <div className="space-y-2">
                            {DENOMINATIONS.monedas.map(d => (
                                <div key={d.id} className="flex h-10">
                                    <button
                                        onClick={() => handleInputClick(d.id)}
                                        className="w-16 bg-[#303343] hover:bg-[#3d4154] transition-colors rounded-l-md flex items-center justify-center text-xs font-bold text-gray-300 border border-white/5 cursor-pointer"
                                    >
                                        {d.label}
                                    </button>
                                    <div
                                        className={`flex-1 flex items-center justify-center font-bold text-sm transition-all border-y border-white/5 ${activeInput === d.id
                                            ? 'bg-white text-black'
                                            : 'bg-[#1f1d2b] text-white'
                                            }`}
                                    >
                                        {counts[d.id] || 0}
                                    </div>
                                    <div className="w-20 bg-[#303343] rounded-r-md flex items-center justify-center text-xs font-mono font-bold text-gray-400 border border-white/5">
                                        Q{calculateSubtotal(d.val, counts[d.id] || 0).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* Totals Summary */}
                        <div className="mt-8 space-y-4">
                            {!isBlind && expectedAmount !== undefined && (
                                <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                                    <span>A Cuadrar</span>
                                    <span className="font-mono text-white">Q{expectedAmount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-sm font-bold text-white">
                                <span>Total Arqueo</span>
                                <span className="font-mono text-lg">Q{totalArqueo.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    {/* COL 2: Billetes */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-[#303343] py-2 rounded-t-lg border-b border-white/5 text-center">
                            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Billetes</h3>
                        </div>
                        <div className="space-y-2">
                            {DENOMINATIONS.billetes.map(d => (
                                <div key={d.id} className="flex h-10">
                                    <button
                                        onClick={() => handleInputClick(d.id)}
                                        className="w-16 bg-[#303343] hover:bg-[#3d4154] transition-colors rounded-l-md flex items-center justify-center text-xs font-bold text-gray-300 border border-white/5 cursor-pointer"
                                    >
                                        {d.label}
                                    </button>
                                    <div
                                        className={`flex-1 flex items-center justify-center font-bold text-sm transition-all border-y border-white/5 ${activeInput === d.id
                                            ? 'bg-white text-black'
                                            : 'bg-[#1f1d2b] text-white'
                                            }`}
                                    >
                                        {counts[d.id] || 0}
                                    </div>
                                    <div className="w-20 bg-[#303343] rounded-r-md flex items-center justify-center text-xs font-mono font-bold text-gray-400 border border-white/5">
                                        Q{calculateSubtotal(d.val, counts[d.id] || 0).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* COL 3: Keypad & Save */}
                    <div className="flex flex-col gap-4">
                        {/* Display Screen */}
                        <div className="h-14 bg-[#1f1d2b] border border-white/5 rounded-md flex flex-col justify-center px-4 text-right">
                             <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                                {activeInput === 'MANUAL' ? 'MONTO MANUAL' : (activeInput ? `CANTIDAD DE ${[...DENOMINATIONS.monedas, ...DENOMINATIONS.billetes].find(d => d.id === activeInput)?.label || activeInput}` : 'SELECCIONE DENOMINACIÓN')}
                            </span>
                            <span className="text-lg font-bold text-white tracking-widest">
                                {activeInput ? (tempValue || '0') : ''}
                            </span>
                        </div>

                        {/* Numpad */}
                        <div className="bg-[#303343] p-2 rounded-md grid grid-cols-3 gap-1">
                            {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => (
                                <button key={n} onClick={() => handleKeyPad(n.toString())} className="h-14 bg-[#303343] border border-white/5 hover:bg-[#3d4154] text-white font-bold text-sm transition-colors rounded-sm">
                                    {n}
                                </button>
                            ))}
                            <button onClick={() => handleKeyPad('0')} className="h-14 bg-[#303343] border border-white/5 hover:bg-[#3d4154] text-white font-bold text-sm transition-colors rounded-sm">
                                0
                            </button>
                            <button onClick={() => handleKeyPad('DOT')} className="h-14 bg-[#303343] border border-white/5 hover:bg-[#3d4154] text-white font-bold text-sm transition-colors rounded-sm">
                                .
                            </button>
                            <button onClick={() => handleKeyPad('BACKSPACE')} className="h-14 bg-[#303343] border border-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 flex items-center justify-center transition-colors rounded-sm">
                                <Delete size={18} />
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 mt-2">
                             <button onClick={confirmValue} className="h-12 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-md transition-colors flex items-center justify-center gap-2">
                                <Check size={16} /> Confirmar Monto
                            </button>
                            <button
                                onClick={() => onSave(totalArqueo, counts)}
                                className="h-12 bg-[#6b72ff] hover:bg-[#5a60e0] text-white font-bold text-xs uppercase tracking-widest rounded-md transition-colors mt-2"
                            >
                                Guardar Arqueo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
