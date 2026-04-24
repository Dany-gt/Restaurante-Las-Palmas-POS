
import React, { useState } from 'react';
import { Landmark, Send, Ticket, Receipt, Banknote, X, Check } from 'lucide-react';

interface OtherPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { subType: string, amount: number, documentNo: string, description: string }) => void;
    initialAmount: number;
    currency: string;
}

export const OtherPaymentModal: React.FC<OtherPaymentModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    initialAmount,
    currency
}) => {
    const [selectedType, setSelectedType] = useState('Depósito Bancario');
    const [amount, setAmount] = useState(initialAmount.toString());
    const [documentNo, setDocumentNo] = useState('');
    const [description, setDescription] = useState('');

    if (!isOpen) return null;

    const paymentTypes = [
        { id: 'Depósito Bancario', label: 'Depósito Bancario', icon: Landmark },
        { id: 'Transferencia Electrónica', label: 'Transferencia Electrónica', icon: Send },
        { id: 'Cheque', label: 'Cheque', icon: Receipt },
        { id: 'Cupón de Descuento', label: 'Cupón de Descuento', icon: Ticket },
        { id: 'Moneda Extranjera', label: 'Moneda Extranjera', icon: Banknote },
    ];

    const handleConfirm = () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) return;
        onConfirm({
            subType: selectedType,
            amount: val,
            documentNo,
            description
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-[#1e212b] w-full max-w-2xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">TIPO DE PAGO</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 p-8 gap-8">
                    {/* LEFT SIDE: TYPES */}
                    <div className="flex flex-col gap-3 w-1/2">
                        {paymentTypes.map(type => (
                            <button
                                key={type.id}
                                onClick={() => setSelectedType(type.id)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${selectedType === type.id
                                        ? 'bg-indigo-600 border-indigo-400 shadow-lg'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedType === type.id ? 'bg-white/20' : 'bg-white/5'}`}>
                                    <type.icon size={20} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest leading-tight">
                                    {type.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* RIGHT SIDE: INPUTS */}
                    <div className="flex flex-col gap-6 w-1/2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Monto</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currency}</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all text-right"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Documento No.</label>
                            <input
                                type="text"
                                value={documentNo}
                                onChange={e => setDocumentNo(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                                placeholder="Referencia / No. Cheque"
                            />
                        </div>

                        <div className="space-y-2 flex-1 flex flex-col">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Descripción</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all resize-none"
                                placeholder="Notas adicionales..."
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-white/5 border-t border-white/5 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 h-14 rounded-2xl border border-white/10 font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 transition-all"
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 h-14 rounded-2xl bg-indigo-600 font-black uppercase tracking-widest text-white hover:bg-indigo-500 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                        <Check size={20} />
                        ACEPTAR
                    </button>
                </div>
            </div>
        </div>
    );
};
