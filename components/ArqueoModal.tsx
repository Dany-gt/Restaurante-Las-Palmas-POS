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
        { label: 'Q0.01', val: 0.01 },
        { label: 'Q0.05', val: 0.05 },
        { label: 'Q0.10', val: 0.10 },
        { label: 'Q0.25', val: 0.25 },
        { label: 'Q0.50', val: 0.50 },
        { label: 'Q1.00', val: 1.00 },
    ],
    billetes: [
        { label: 'Q1.00', val: 1.00 },
        { label: 'Q5.00', val: 5.00 },
        { label: 'Q10.00', val: 10.00 },
        { label: 'Q20.00', val: 20.00 },
        { label: 'Q50.00', val: 50.00 },
        { label: 'Q100.00', val: 100.00 },
        { label: 'Q200.00', val: 200.00 },
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
            total += (counts[d.label] || 0) * d.val;
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#16191f] w-full max-w-6xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <header className="px-8 py-5 border-b border-white/5 flex items-center justify-between bg-[#1c1f26]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                            <Save size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight text-white">{title || 'Arqueo de Caja'}</h2>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Conteo físico de efectivo para cierre</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl text-gray-400 transition-colors">
                        <X size={20} />
                    </button>
                </header>

                {/* Main Content Grid */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

                    {/* Denominations Section (Span 8) */}
                    <div className="lg:col-span-8 overflow-y-auto p-8 bg-[#16191f]">
                        <div className="grid grid-cols-2 gap-8 h-full content-start">
                            {/* Monedas */}
                            <div className="flex flex-col gap-3">
                                <h3 className="flex items-center justify-center py-2 bg-white/5 rounded-lg text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 border border-white/5">
                                    Monedas
                                </h3>
                                <div className="space-y-2">
                                    {DENOMINATIONS.monedas.map(d => (
                                        <div key={d.label} className="flex gap-2 items-center group">
                                            <div className="w-16 py-3 bg-white/5 rounded-xl text-[10px] font-bold text-center border border-white/5 text-gray-400 group-hover:bg-white/10 transition-colors">
                                                {d.label}
                                            </div>
                                            <button
                                                onClick={() => handleInputClick(d.label)}
                                                className={`flex-1 py-3 px-4 rounded-xl text-center font-black transition-all border text-sm active:scale-95 ${activeInput === d.label
                                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                    : 'bg-[#1e222b] border-white/5 text-gray-300 hover:border-white/20 hover:bg-[#252a35]'
                                                    }`}
                                            >
                                                {counts[d.label] || 0}
                                            </button>
                                            <div className="w-24 py-3 px-3 bg-[#111318] rounded-xl text-xs font-mono font-bold text-right text-emerald-400/80 border border-white/5">
                                                Q{calculateSubtotal(d.val, counts[d.label] || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Billetes */}
                            <div className="flex flex-col gap-3">
                                <h3 className="flex items-center justify-center py-2 bg-white/5 rounded-lg text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 border border-white/5">
                                    Billetes
                                </h3>
                                <div className="space-y-2">
                                    {DENOMINATIONS.billetes.map(d => (
                                        <div key={d.label} className="flex gap-2 items-center group">
                                            <div className="w-16 py-3 bg-white/5 rounded-xl text-[10px] font-bold text-center border border-white/5 text-gray-400 group-hover:bg-white/10 transition-colors">
                                                {d.label}
                                            </div>
                                            <button
                                                onClick={() => handleInputClick(d.label)}
                                                className={`flex-1 py-3 px-4 rounded-xl text-center font-black transition-all border text-sm active:scale-95 ${activeInput === d.label
                                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                    : 'bg-[#1e222b] border-white/5 text-gray-300 hover:border-white/20 hover:bg-[#252a35]'
                                                    }`}
                                            >
                                                {counts[d.label] || 0}
                                            </button>
                                            <div className="w-24 py-3 px-3 bg-[#111318] rounded-xl text-xs font-mono font-bold text-right text-emerald-400/80 border border-white/5">
                                                Q{calculateSubtotal(d.val, counts[d.label] || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}


                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Keypad Section (Span 4) */}
                    <div className="lg:col-span-4 bg-[#1c1f26] border-l border-white/5 p-6 flex flex-col gap-4 relative shadow-2xl overflow-y-auto">
                        {/* Display */}
                        <div className="bg-black/40 rounded-2xl p-6 text-right border border-white/5 h-24 flex flex-col justify-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors"></div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest relative z-10 mb-1">
                                {activeInput === 'MANUAL' ? 'MONTO MANUAL' : (activeInput ? `CANTIDAD DE ${activeInput}` : 'SELECCIONE DENOMINACIÓN')}
                            </span>
                            <span className={`text-4xl font-black tracking-tight relative z-10 transition-colors ${activeInput ? 'text-white' : 'text-gray-600'}`}>
                                {activeInput ? (tempValue || '0') : '---'}
                            </span>
                        </div>

                        {/* Numpad */}
                        <div className="grid grid-cols-3 gap-2 content-start">
                            {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => (
                                <button key={n} onClick={() => handleKeyPad(n.toString())} className="h-16 bg-[#252830] hover:bg-[#2e323b] rounded-xl text-xl font-bold transition-all active:scale-95 border border-white/5 text-gray-200">
                                    {n}
                                </button>
                            ))}
                            <button onClick={() => handleKeyPad('BACKSPACE')} className="h-16 bg-[#252830] hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 rounded-xl flex items-center justify-center transition-all active:scale-95 border border-white/5 text-gray-400">
                                <Delete size={24} />
                            </button>
                            <button onClick={() => handleKeyPad('0')} className="h-16 bg-[#252830] hover:bg-[#2e323b] rounded-xl text-xl font-bold transition-all active:scale-95 border border-white/5 text-gray-200">
                                0
                            </button>
                            <button onClick={confirmValue} className="h-16 bg-indigo-600 hover:bg-indigo-500 rounded-xl flex items-center justify-center transition-all active:scale-95 text-white shadow-lg shadow-indigo-600/20">
                                <Check size={28} />
                            </button>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                            {!isBlind && expectedAmount !== undefined && (
                                <div className="flex justify-between items-end text-gray-500 font-bold uppercase tracking-widest text-[10px]">
                                    <span>A Cuadrar</span>
                                    <span className="text-gray-300 text-sm font-mono bg-white/5 px-2 py-1 rounded">Q{expectedAmount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-end text-indigo-400 font-black uppercase tracking-widest text-xs">
                                <span>Total Arqueo</span>
                                <span className="text-3xl text-white leading-none">Q{totalArqueo.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <button
                                onClick={() => onSave(totalArqueo, counts)}
                                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-2"
                            >
                                <Save size={18} /> Guardar Arqueo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
