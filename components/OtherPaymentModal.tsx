
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
        <div className="fixed inset-0 bg-black/80  z-[110] flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-[#2d2f3d] w-full max-w-2xl rounded-xl  /50 overflow-hidden flex flex-col">
                <div className="pt-8 pb-6 flex justify-center items-center">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">TIPO DE PAGO</h3>
                </div>

                <div className="flex flex-1 px-10 pb-8 gap-8">
                    {/* LEFT SIDE: TYPES */}
                    <div className="grid grid-cols-2 gap-3 w-1/2 content-start">
                        {paymentTypes.map(type => (
                            <button
                                key={type.id}
                                onClick={() => setSelectedType(type.id)}
                                className={`flex items-center justify-between p-3.5 rounded-lg border transition-all text-left ${selectedType === type.id
                                        ? 'bg-[#43465b] border-white/30 text-white  ring-1 ring-white/10'
                                        : 'bg-[#353746] border-white/5 text-white/80 hover:bg-[#3e4153]'
                                    }`}
                            >
                                <span className="text-[10px] font-bold tracking-wide leading-tight flex-1 pr-2">
                                    {type.label}
                                </span>
                                <div className="text-white/60">
                                    <type.icon size={20} strokeWidth={1.5} />
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* RIGHT SIDE: INPUTS */}
                    <div className="flex flex-col gap-4 w-1/2">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Monto</label>
                            <div className="relative flex items-center bg-transparent border border-white/20 rounded-md focus-within:border-white/40 transition-all overflow-hidden">
                                <span className="pl-3 text-white/60 text-sm font-bold">{currency}</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="w-full bg-transparent py-2 px-3 text-sm font-bold text-white outline-none text-right"
                                    step="0.01"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Documento No.</label>
                            <input
                                type="text"
                                value={documentNo}
                                onChange={e => setDocumentNo(e.target.value)}
                                className="w-full bg-transparent border border-white/20 rounded-md py-2 px-3 text-sm text-white focus:border-white/40 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-1.5 flex-1 flex flex-col">
                            <label className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Descripción</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full flex-1 bg-transparent border border-white/20 rounded-md py-2 px-3 text-sm text-white focus:border-white/40 outline-none transition-all resize-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="pb-8 flex justify-center gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 rounded-md border border-white/20 text-white text-xs font-bold uppercase tracking-wide hover:bg-white/5 transition-all active:scale-95 min-w-[120px]"
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-8 py-2.5 rounded-md bg-[#7a73ff] text-white text-xs font-bold uppercase tracking-wide hover:bg-[#6861ff] transition-all  active:scale-95 min-w-[120px]"
                    >
                        ACEPTAR
                    </button>
                </div>
            </div>
        </div>
    );
};
