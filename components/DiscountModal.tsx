import React, { useState, useEffect } from 'react';
import { X, Percent, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';

interface Discount {
    id: string;
    name: string;
    percentage: number; // Keep for backward compatibility 
    value: number;
    type: 'PERCENT' | 'AMOUNT';
}

interface DiscountModalProps {
    currentDiscount?: Discount | null;
    title?: string;
    itemContext?: string;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({ isOpen, onClose, subtotal, onApply, currentDiscount, title = "Gestión de Descuentos", itemContext = "Mesa" }) => {
    const [discounts, setDiscounts] = useState<Discount[]>([]);
    const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(currentDiscount || null);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDiscounts = async () => {
            const { data } = await supabase
                .from('discount_types')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (data) {
                const mapped = data.map(d => ({
                    id: d.id,
                    name: d.name,
                    percentage: d.type === 'PERCENT' ? d.value : 0,
                    value: d.value,
                    type: d.type as 'PERCENT' | 'AMOUNT'
                }));
                setDiscounts(mapped);
            } else {
                setDiscounts([]);
            }
            setLoading(false);
        };
        if (isOpen) fetchDiscounts();
    }, [isOpen]);

    const calculateSaving = (discount: Discount) => {
        if (discount.type === 'AMOUNT') {
            return discount.value;
        }
        return (subtotal * discount.value) / 100;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6">
            <div className="w-full max-w-4xl h-auto max-h-[85vh] bg-[#16191f] rounded-2xl border border-white/10 shadow-2xl flex overflow-hidden">

                {/* Lado Izquierdo: Lista de Descuentos */}
                <div className="flex-1 flex flex-col border-r border-white/5 p-6 md:p-8">
                    <div className="mb-6">
                        <h3 className="text-xl font-black uppercase tracking-tighter">{title}</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Seleccione un descuento autorizado</p>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                        {discounts.map(disc => (
                            <button
                                key={disc.id}
                                onClick={() => setSelectedDiscount(disc)}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-95 ${selectedDiscount?.id === disc.id
                                    ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-600/5'
                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                                    }`}
                            >
                                <div className="text-left">
                                    <span className="block text-xs font-black uppercase tracking-widest">{disc.name}</span>
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Descuento Directo</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-lg font-black italic ${selectedDiscount?.id === disc.id ? 'text-indigo-400' : 'text-gray-300'}`}>
                                        {disc.type === 'AMOUNT' ? `-Q${disc.value.toFixed(2)}` : `-${disc.value}%`}
                                    </span>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${selectedDiscount?.id === disc.id ? 'bg-indigo-500 border-indigo-500' : 'border-white/10'
                                        }`}>
                                        {selectedDiscount?.id === disc.id && <CheckCircle size={12} className="text-white" />}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5">
                        <button
                            onClick={() => {
                                setSelectedDiscount(null);
                                setReason('');
                                onApply(null);
                            }}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={14} /> Eliminar Descuentos
                        </button>
                    </div>
                </div>

                {/* Lado Derecho: Detalles y Confirmación */}
                <div className="w-[340px] bg-black/20 flex flex-col p-6 md:p-8">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Detalle Final</span>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                            <X size={18} className="text-gray-500" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-6 overflow-y-auto">
                        <section>
                            <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Resumen Matemático</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Base {itemContext}</span>
                                    <span className="text-xs font-black tabular-nums">Q{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-indigo-600/5 p-3 rounded-xl border border-white/5">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ahorro Aplicado</span>
                                    <span className="text-lg font-black text-white tabular-nums">
                                        -Q{selectedDiscount ? calculateSaving(selectedDiscount).toFixed(2) : '0.00'}
                                    </span>
                                </div>
                            </div>
                        </section>

                        <section>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Motivo / Descripción</h4>
                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Obligatorio</span>
                            </div>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Escriba el motivo..."
                                className="w-full h-20 bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-indigo-500/50 transition-all resize-none text-white"
                            />
                        </section>
                    </div>

                    <div className="pt-6 border-t border-white/10 mt-auto">
                        <div className="flex justify-between items-end mb-6">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Total Final</span>
                            <span className="text-3xl font-black tracking-tighter tabular-nums text-white">
                                Q{(subtotal - (selectedDiscount ? calculateSaving(selectedDiscount) : 0)).toFixed(2)}
                            </span>
                        </div>

                        <button
                            disabled={!selectedDiscount || !reason.trim()}
                            onClick={() => onApply(selectedDiscount, reason)}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-[#1a1c23] disabled:text-gray-700 disabled:opacity-50 text-white rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-indigo-600/10 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={16} /> Aplicar Descuento
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
