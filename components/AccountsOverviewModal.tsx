import React, { useState } from 'react';
import { ArrowLeft, UserPlus, UserRoundPen, UserMinus, Printer, CheckCircle, X, AlertTriangle, MessageSquare } from 'lucide-react';
import { OrderItem } from '../types';

interface OrderSummary {
    id: string;
    customer_name: string;
    items: OrderItem[];
    subtotal: number;
    discount: number;
    tip: number;
    total: number;
}

interface AccountsOverviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    tableOrders: any[];
    activeOrderId: string | null;
    onSelectAccount: (orderId: string | null) => void;
    onAddAccount: () => void;
    onEditAccount: (orderId: string) => void;
    onDeleteAccount: (orderId: string, reason?: string) => void;
    onSplitAccount: () => void;
    onPrintAccount: (orderId: string | null) => void;
    initialOrder: any;
}

export const AccountsOverviewModal: React.FC<AccountsOverviewModalProps> = ({
    isOpen,
    onClose,
    tableOrders,
    activeOrderId,
    onSelectAccount,
    onAddAccount,
    onEditAccount,
    onDeleteAccount,
    onSplitAccount,
    onPrintAccount,
    initialOrder
}) => {
    const [localSelectedId, setLocalSelectedId] = useState<string | null>(activeOrderId);
    const [showDeletePrompt, setShowDeletePrompt] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    const getOrderSummary = (order: any, index: number): OrderSummary => {
        const items = order.items || order.order_items || [];
        const subtotal = items.reduce((sum: number, i: any) => sum + ((i.price ?? i.unit_price ?? 0) * (i.quantity ?? 1)), 0);
        const discount = items.reduce((sum: number, i: any) => sum + (i.discount_amount || 0), 0);
        const tip = order.tip_amount || (subtotal * 0.1); 
        const total = subtotal - discount + tip;

        return {
            id: order.id,
            customer_name: (order.customer_name && order.customer_name.toUpperCase() !== 'CUENTA PRINCIPAL') 
                ? order.customer_name 
                : `CUENTA ${index + 1}`,
            items,
            subtotal,
            discount,
            tip,
            total
        };
    };

    const summaries = tableOrders.map((order, idx) => getOrderSummary(order, idx));

    const handleDeleteClick = () => {
        if (!localSelectedId) return;

        // Regla: No permitir eliminar si solo queda 1 cuenta
        if (tableOrders.length <= 1) {
            setErrorMessage("No puedes eliminar la única cuenta disponible. Si deseas anular todo el pedido, usa el botón 'ANULAR ORDEN' fuera de esta ventana.");
            setTimeout(() => setErrorMessage(null), 5000);
            return;
        }

        setShowDeletePrompt(true);
        setDeleteReason('');
    };

    const confirmDelete = () => {
        if (!deleteReason.trim()) return;
        if (localSelectedId) {
            onDeleteAccount(localSelectedId, deleteReason);
            setShowDeletePrompt(false);
            setLocalSelectedId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
            {/* Modal Principal */}
            <div className="w-full max-w-6xl h-[85vh] bg-[#3a3b4d] flex flex-col overflow-hidden rounded-none pointer-events-auto border border-white/5 shadow-2xl relative">
                
                {/* Header */}
                <div className="px-6 py-4 bg-[#2d2e3d] border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={onClose}
                            className="w-10 h-10 bg-[#3a3b4d] hover:bg-[#45465e] rounded flex items-center justify-center text-gray-400 transition-colors"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <h2 className="text-[10px] font-black text-gray-700 uppercase tracking-widest">PÁLADAR POS</h2>
                    </div>

                    <button 
                        onClick={() => { setLocalSelectedId(null); onSelectAccount(null); }}
                        className={`px-8 py-2.5 rounded text-[10px] font-black uppercase tracking-widest transition-all ${
                            localSelectedId === null
                            ? 'bg-[#7c7ffb] text-white shadow-lg shadow-[#7c7ffb]/20'
                            : 'bg-[#3a3b4d] text-white/20 hover:bg-[#45465e]'
                        }`}
                    >
                        Abrir Todas
                    </button>
                </div>

                {/* Mensaje de Error (Feedback Visual) */}
                {errorMessage && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[120] bg-red-500 text-white px-6 py-3 rounded shadow-2xl flex items-center gap-3 animate-bounce">
                        <AlertTriangle size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{errorMessage}</span>
                    </div>
                )}

                {/* Body - Grid de Cuentas */}
                <div className="flex-1 overflow-y-auto p-10 scrollbar-hide bg-[#3a3b4d]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {summaries.map((summary) => (
                            <div 
                                key={summary.id}
                                onClick={() => setLocalSelectedId(summary.id)}
                                className={`relative cursor-pointer overflow-hidden flex flex-col transition-all border-2 ${
                                    localSelectedId === summary.id 
                                    ? 'bg-[#2d2e3d] border-[#7c7ffb] shadow-2xl' 
                                    : 'bg-[#2d2e3d]/40 border-white/5 hover:bg-[#2d2e3d]/60'
                                }`}
                            >
                                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-center gap-3 bg-black/10">
                                    <span className={`w-2 h-2 rounded-full ${localSelectedId === summary.id ? 'bg-green-400 animate-pulse' : 'bg-white/10'}`} />
                                    <span className={`text-[11px] font-black uppercase tracking-widest ${localSelectedId === summary.id ? 'text-white' : 'text-gray-500'}`}>
                                        {summary.customer_name}
                                    </span>
                                </div>

                                <div className="p-6">
                                    <div className="grid grid-cols-4 gap-2 mb-3">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter">Sub-Total</span>
                                            <span className="text-[10px] font-black text-gray-400">Q{summary.subtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter">Descto.</span>
                                            <span className="text-[10px] font-black text-gray-400">Q{summary.discount.toFixed(2)}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter">Prop.</span>
                                            <span className="text-[10px] font-black text-gray-400">Q{summary.tip.toFixed(2)}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter">Total</span>
                                            <span className="text-[11px] font-black text-white">Q{summary.total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="border-t border-dashed border-white/10 w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-10 py-8 bg-[#2d2e3d] border-t border-white/5 shrink-0 flex items-center justify-center gap-12">
                    <div className="flex items-center gap-5">
                        <button onClick={onAddAccount} className="w-14 h-14 bg-[#3a3b4d] hover:bg-[#45465e] text-white rounded flex items-center justify-center border border-white/10 transition-all shadow-lg active:scale-95">
                            <UserPlus size={24} />
                        </button>

                        <button onClick={() => localSelectedId && onEditAccount(localSelectedId)} disabled={!localSelectedId} className="w-14 h-14 bg-[#3a3b4d] hover:bg-[#45465e] text-white rounded flex items-center justify-center border border-white/10 disabled:opacity-10 transition-all shadow-lg active:scale-95">
                            <UserRoundPen size={24} />
                        </button>

                        <button 
                            onClick={handleDeleteClick} 
                            disabled={!localSelectedId} 
                            className="w-14 h-14 bg-[#3a3b4d] hover:bg-[#45465e] text-red-400 rounded flex items-center justify-center border border-white/10 disabled:opacity-10 transition-all shadow-lg active:scale-95"
                        >
                            <UserMinus size={24} />
                        </button>

                        <button onClick={() => onPrintAccount(localSelectedId)} className="w-14 h-14 bg-[#3a3b4d] hover:bg-[#45465e] text-white rounded flex items-center justify-center border border-white/10 transition-all shadow-lg active:scale-95">
                            <Printer size={24} />
                        </button>
                    </div>

                    <div className="w-[1px] h-12 bg-white/5" />

                    <button 
                        onClick={() => onSelectAccount(localSelectedId)}
                        className="h-14 px-16 bg-[#7c7ffb] text-white hover:bg-[#6b6edb] rounded flex items-center justify-center transition-all text-[11px] font-black uppercase tracking-widest shadow-xl shadow-[#7c7ffb]/20 active:scale-95"
                    >
                        Aceptar
                    </button>
                </div>

                {/* OVERLAY DE COMENTARIO OBLIGATORIO PARA ELIMINACIÓN */}
                {showDeletePrompt && (
                    <div className="absolute inset-0 z-[150] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
                        <div className="bg-[#2d2e3d] w-full max-w-md p-8 rounded-none border border-white/10 shadow-3xl">
                            <div className="flex items-center gap-3 mb-6 text-red-400">
                                <MessageSquare size={24} />
                                <h3 className="text-sm font-black uppercase tracking-[0.2em]">Motivo de Eliminación</h3>
                            </div>
                            
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                                Explique por qué desea eliminar la cuenta seleccionada. Este comentario quedará registrado.
                            </p>

                            <textarea 
                                autoFocus
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                placeholder="Escriba el motivo aquí..."
                                className="w-full h-32 bg-black/20 border border-white/10 rounded p-4 text-xs font-bold text-white focus:outline-none focus:border-[#7c7ffb] transition-all resize-none mb-6 placeholder:text-gray-700"
                            />

                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setShowDeletePrompt(false)}
                                    className="flex-1 py-4 bg-[#3a3b4d] hover:bg-[#45465e] text-gray-400 rounded text-[9px] font-black uppercase tracking-widest transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    disabled={!deleteReason.trim()}
                                    onClick={confirmDelete}
                                    className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white disabled:opacity-20 rounded text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={14} /> Confirmar Eliminación
                                </button>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShowDeletePrompt(false)}
                            className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors"
                        >
                            <X size={32} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
