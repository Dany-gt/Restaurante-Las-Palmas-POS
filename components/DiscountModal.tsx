import React, { useState, useEffect } from 'react';
import { X, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';

interface Discount {
    id: string;
    name: string;
    percentage: number;
    value: number;
    type: 'PERCENT' | 'AMOUNT';
}

interface DiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    subtotal: number;
    onApply: (discount: Discount | null, reason?: string) => void;
    currentDiscount?: Discount | null;
    title?: string;
    itemContext?: string;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({ isOpen, onClose, subtotal, onApply, currentDiscount, title = "Descuento: Aguachile Camaron", itemContext = "Mesa" }) => {
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-6">
            <div className="w-full max-w-4xl h-auto max-h-[85vh] bg-[#3a3b4d] rounded-none border border-white/5  /50 flex overflow-hidden pointer-events-auto">

                {/* Lado Izquierdo: Lista de Descuentos — Color fondo tarjetas mesa #3a3b4d */}
                <div className="flex-1 flex flex-col border-r border-white/5 p-6 md:p-8">
                    <div className="mb-6">
                        <h3 className="text-xl font-semibold uppercase tracking-tighter text-white">{title}</h3>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest mt-1">Seleccione un descuento autorizado</p>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                        {discounts.map(disc => (
                            <button
                                key={disc.id}
                                onClick={() => setSelectedDiscount(disc)}
                                className={`w-full flex items-center justify-between p-5 transition-all border-2 ${selectedDiscount?.id === disc.id
                                    ? 'bg-[#2d2e3d] border-[#7c7ffb]'
                                    : 'bg-[#2d2e3d]/40 border-white/5 hover:border-white/10 hover:bg-[#2d2e3d]/60'
                                    }`}
                            >
                                <div className="text-left">
                                    <span className={`block text-[11px] font-semibold uppercase tracking-widest ${selectedDiscount?.id === disc.id ? 'text-white' : 'text-gray-400'}`}>{disc.name}</span>
                                    <span className="text-[9px] text-gray-600 font-medium uppercase tracking-widest">Descuento Directo</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-lg font-semibold ${selectedDiscount?.id === disc.id ? 'text-white' : 'text-gray-400'}`}>
                                        {disc.type === 'AMOUNT' ? `-Q${disc.value.toFixed(2)}` : `-${disc.value}%`}
                                    </span>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedDiscount?.id === disc.id ? 'bg-[#7c7ffb] border-[#7c7ffb]' : 'border-white/10'
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
                            className="w-full py-3 bg-[#2d2e3d] hover:bg-[#45465e] text-gray-600 hover:text-white rounded-lg font-semibold uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={14} /> Eliminar Descuentos
                        </button>
                    </div>
                </div>

                {/* Lado Derecho: Detalles y Confirmación — Color fondo pantalla mesas #2d2e3d */}
                <div className="w-[340px] bg-[#2d2e3d] flex flex-col p-6 md:p-8">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-[0.3em]">Detalle Final</span>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-all text-gray-600 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 space-y-6 overflow-y-auto">
                        <section>
                            <h4 className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Resumen Matemático</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">Base Producto</span>
                                    <span className="text-xs font-semibold tabular-nums text-white">Q{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-black/20 p-4 border border-white/5">
                                    <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Ahorro Aplicado</span>
                                    <span className="text-xl font-semibold text-white tabular-nums">
                                        -Q{selectedDiscount ? calculateSaving(selectedDiscount).toFixed(2) : '0.00'}
                                    </span>
                                </div>
                            </div>
                        </section>

                        <section>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest">Motivo / Descripción</h4>
                                <span className="text-[8px] font-semibold text-gray-700 uppercase tracking-widest">Obligatorio</span>
                            </div>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Escriba el motivo..."
                                className="w-full h-20 bg-black/10 border border-white/5 rounded-none p-4 text-xs font-medium focus:outline-none focus:border-[#7c7ffb]/40 transition-all resize-none text-white placeholder:text-gray-700"
                            />
                        </section>
                    </div>

                    <div className="pt-6 border-t border-white/5 mt-auto">
                        <div className="flex justify-between items-end mb-6">
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.2em]">Total Final</span>
                            <span className="text-4xl font-semibold tracking-tighter tabular-nums text-white">
                                Q{(subtotal - (selectedDiscount ? calculateSaving(selectedDiscount) : 0)).toFixed(2)}
                            </span>
                        </div>

                        <button
                            disabled={!selectedDiscount || !reason.trim()}
                            onClick={() => onApply(selectedDiscount, reason)}
                            className="w-full h-16 bg-[#7c7ffb] text-white disabled:bg-white/5 disabled:text-white/10 rounded-lg font-semibold uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={16} strokeWidth={3} /> Aplicar Descuento
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
