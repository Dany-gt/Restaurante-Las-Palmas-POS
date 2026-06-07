import React, { useState } from 'react';
import { ArrowLeft, User, UserPlus, UserRoundPen, UserMinus, Printer, CheckCircle, X, AlertTriangle, MessageSquare } from 'lucide-react';
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
    transferMode?: boolean;
    itemToTransferName?: string;
    sourceOrderId?: string;
    onTransferConfirm?: (orderId: string) => void;
    // Local (unsent) items from the POS state — used to show draft totals before submission
    localItems?: any[];
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
    initialOrder,
    transferMode,
    itemToTransferName,
    sourceOrderId,
    onTransferConfirm,
    localItems = []
}) => {
    const [localSelectedId, setLocalSelectedId] = useState<string | null>(activeOrderId);
    const [showDeletePrompt, setShowDeletePrompt] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    const getOrderSummaries = (orders: any[]): OrderSummary[] => {
        const usedNames = new Set<string>();
        const summaries = orders.map((order, index) => {
            // Merge DB items with local (unsent) items for this order
            const dbItems = order.items || order.order_items || [];
            const unsentForOrder = localItems.filter(
                (li: any) => li.order_id === order.id && !li.is_sent
            );
            // Normalize unsent items to match the shape expected (unit_price vs price)
            const normalizedUnsent = unsentForOrder.map((li: any) => ({
                ...li,
                unit_price: li.unit_price ?? li.price ?? 0,
                price: li.price ?? li.unit_price ?? 0
            }));
            const items = [...dbItems, ...normalizedUnsent];

            const subtotal = items.reduce((sum: number, i: any) => sum + ((i.price ?? i.unit_price ?? 0) * (i.quantity ?? 1)), 0);
            const discount = items.reduce((sum: number, i: any) => sum + (i.discount_amount || 0), 0);
            const tip = order.tip_amount || (subtotal * 0.1);
            const total = subtotal - discount + tip;

            let name = order.customer_name?.trim();
            if (!name || name.toUpperCase() === 'CUENTA PRINCIPAL') {
                name = `CUENTA ${index + 1}`;
            }

            let finalName = name.toUpperCase();
            if (usedNames.has(finalName)) {
                let nextNum = index + 1;
                while (usedNames.has(`CUENTA ${nextNum}`)) {
                    nextNum++;
                }
                finalName = `CUENTA ${nextNum}`;
            }
            usedNames.add(finalName);

            return {
                id: order.id,
                customer_name: finalName,
                items,
                subtotal,
                discount,
                tip,
                total
            };
        });

        // Sort summaries numerically and alphabetically by customer_name
        summaries.sort((a, b) => a.customer_name.localeCompare(b.customer_name, undefined, { numeric: true }));
        return summaries;
    };

    let summaries = getOrderSummaries(tableOrders);
    if (transferMode && sourceOrderId) {
        summaries = summaries.filter(s => s.id !== sourceOrderId);
    }

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

    const parseNotesLocal = (notesStr?: string | null) => {
        if (!notesStr) return { mods: '', obs: '', isJson: false, noPrint: false };
        const noPrint = notesStr.includes('*NO IMPRIMIR*');
        const clean = notesStr.replace('*NO IMPRIMIR*', '').trim();
        try {
            if (clean.startsWith('{') && (clean.includes('"mods"') || clean.includes('"obs"'))) {
                const parsed = JSON.parse(clean);
                return { mods: parsed.mods || '', obs: parsed.obs || '', isJson: true, noPrint };
            }
        } catch (e) { }
        return { mods: '', obs: clean, isJson: false, noPrint };
    };

    const formatNotesLocal = (notesStr?: string | null) => {
        const p = parseNotesLocal(notesStr);
        return [p.mods, p.obs].filter(Boolean).join(' | ');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop oscuro translúcido para que la ventana resalte */}
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />

            {/* Modal Principal */}
            <div className="w-full max-w-[992.22px] h-[674.71px] bg-[#3a3b4d] flex flex-col overflow-hidden rounded border border-white/10 shadow-2xl relative z-10">

                {/* Header */}
                <div className="px-6 py-4 bg-[#3a3b4d] border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={onClose}
                            title="Cerrar"
                            className="w-14 h-14 bg-[#3a3b4d] hover:bg-[#45465e] border border-white/10 rounded flex items-center justify-center text-white transition-colors"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <h2 className={`text-[10px] font-bold uppercase tracking-widest ${transferMode ? 'text-indigo-400' : 'text-white'}`}>
                            {transferMode ? `TRASLADAR: ${itemToTransferName}` : 'LAS PALMAS POS'}
                        </h2>
                    </div>

                    {!transferMode && (
                        <button
                            onClick={() => { setLocalSelectedId(null); onSelectAccount(null); }}
                            title="Abrir Todas las Cuentas"
                            className={`relative overflow-hidden px-8 py-2.5 rounded text-[10px] font-semibold uppercase tracking-widest transition-all border ${localSelectedId === null
                                    ? 'bg-[#7c7ffb] text-white border-transparent shadow-lg shadow-indigo-500/10'
                                    : 'bg-[#3a3b4d] text-white border-white/10 hover:bg-[#45465e]'
                                }`}
                        >
                            {/* Pestañita azul en el lado derecho superior */}
                            <div className="absolute top-0 right-0 w-0 h-0 border-t-[8px] border-t-blue-400 border-l-[8px] border-l-transparent" />
                            Abrir Todas
                        </button>
                    )}
                </div>

                {/* Mensaje de Error (Feedback Visual) */}
                {errorMessage && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[120] bg-red-500 text-white px-6 py-3 rounded  /50 flex items-center gap-3 animate-bounce">
                        <AlertTriangle size={20} />
                        <span className="text-[10px] font-semibold uppercase tracking-widest">{errorMessage}</span>
                    </div>
                )}

                {/* Body - Grid de Cuentas */}
                <div className="flex-1 overflow-y-auto p-10 scrollbar-hide bg-[#3a3b4d]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {summaries.map((summary, index) => (
                            <div
                                key={summary.id || `account-${index}`}
                                onClick={() => setLocalSelectedId(summary.id)}
                                className={`relative cursor-pointer overflow-hidden flex flex-col transition-all border-2 rounded-lg ${localSelectedId === summary.id
                                        ? 'bg-[#2d2e3d] border-[#7c7ffb]'
                                        : 'bg-[#2d2e3d]/40 border-white/5 hover:bg-[#2d2e3d]/60'
                                    }`}
                            >
                                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-center gap-3 bg-black/10">
                                    <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                                    <span className="text-[11px] font-semibold uppercase tracking-widest text-white">
                                        {summary.customer_name}
                                    </span>
                                </div>

                                <div className="p-5 flex-1 flex flex-col justify-between min-h-[160px] max-h-[320px]">
                                    {/* Lista de productos scrollable */}
                                    <div className="flex-1 overflow-y-auto pr-1 mb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                        {summary.items.length === 0 ? (
                                            <div className="text-[9px] text-white uppercase tracking-widest text-center py-12">
                                                Cuenta vacía
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5 text-left">
                                                {summary.items.map((item: any, itemIdx: number) => {
                                                    const cleanNotes = formatNotesLocal(item.notes);
                                                    return (
                                                        <div key={item.id || `item-${itemIdx}`} className="text-[10px] font-medium text-white uppercase tracking-wider flex items-start gap-2">
                                                            <span className="text-white font-semibold shrink-0">{item.quantity}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="truncate text-white leading-tight">{item.product_name || item.name || 'Producto'}</div>
                                                                {cleanNotes && (
                                                                    <div className="text-[8px] text-white font-semibold tracking-wide uppercase leading-tight truncate">
                                                                        {cleanNotes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-dashed border-white/10 w-full mb-3" />

                                    <div className="grid grid-cols-4 gap-1 mt-auto">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-semibold text-gray-300 uppercase tracking-tighter">Sub-Total</span>
                                            <span className="text-[10px] font-bold text-white">Q{summary.subtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-semibold text-gray-300 uppercase tracking-tighter">Descto.</span>
                                            <span className="text-[10px] font-bold text-white">Q{summary.discount.toFixed(2)}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-semibold text-gray-300 uppercase tracking-tighter">Prop.</span>
                                            <span className="text-[10px] font-bold text-white">Q{summary.tip.toFixed(2)}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-semibold text-gray-300 uppercase tracking-tighter">Total</span>
                                            <span className="text-[11px] font-bold text-white">Q{summary.total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-10 py-8 bg-[#3a3b4d] border-t border-white/5 shrink-0 flex items-center justify-center gap-12">
                    <div className="flex items-center gap-5">
                        <button 
                            onClick={onAddAccount} 
                            title="Agregar Cuenta"
                            className="w-14 h-14 bg-[#3a3b4d] hover:bg-[#45465e] text-white rounded flex items-center justify-center border border-white/10 transition-all active:scale-95"
                        >
                            <UserPlus size={24} />
                        </button>

                        <button 
                            onClick={() => {
                                if (!localSelectedId) {
                                    setErrorMessage("Selecciona una cuenta para editar");
                                    setTimeout(() => setErrorMessage(null), 3000);
                                    return;
                                }
                                onEditAccount(localSelectedId);
                            }} 
                            title="Editar Nombre de Cuenta"
                            className="w-14 h-14 bg-[#3a3b4d] hover:bg-[#45465e] text-white rounded flex items-center justify-center border border-white/10 transition-all active:scale-95"
                        >
                            <UserRoundPen size={24} />
                        </button>

                        <button
                            onClick={() => {
                                if (!localSelectedId) {
                                    setErrorMessage("Selecciona una cuenta para eliminar");
                                    setTimeout(() => setErrorMessage(null), 3000);
                                    return;
                                }
                                handleDeleteClick();
                            }}
                            title="Eliminar Cuenta"
                            className="w-14 h-14 bg-[#3a3b4d] hover:bg-[#45465e] text-white rounded flex items-center justify-center border border-white/10 transition-all active:scale-95"
                        >
                            <div className="relative w-[28px] h-[24px] flex items-center justify-center">
                                <User size={24} strokeWidth={1.5} />
                                <div className="absolute w-[26px] h-[1.5px] bg-current -rotate-45" />
                            </div>
                        </button>

                        <button 
                            onClick={() => {
                                if (!localSelectedId) {
                                    setErrorMessage("Selecciona una cuenta para imprimir");
                                    setTimeout(() => setErrorMessage(null), 3000);
                                    return;
                                }
                                onPrintAccount(localSelectedId);
                            }} 
                            title="Imprimir Pre-Cuenta"
                            className="w-14 h-14 bg-[#3a3b4d] hover:bg-[#45465e] text-white rounded flex items-center justify-center border border-white/10 transition-all active:scale-95"
                        >
                            <Printer size={24} />
                        </button>
                    </div>

                    <div className="w-[1px] h-12 bg-white/5" />

                    <button
                        onClick={() => {
                            if (transferMode && !localSelectedId) {
                                setErrorMessage("Selecciona una cuenta de destino");
                                setTimeout(() => setErrorMessage(null), 3000);
                                return;
                            }
                            if (transferMode && onTransferConfirm && localSelectedId) {
                                onTransferConfirm(localSelectedId);
                            } else {
                                onSelectAccount(localSelectedId);
                            }
                        }}
                        title="Aceptar"
                        className="h-14 px-16 bg-[#7c7ffb] text-white hover:bg-[#6b6edb] rounded flex items-center justify-center transition-all text-[11px] font-semibold uppercase tracking-widest active:scale-95"
                    >
                        Aceptar
                    </button>
                </div>

                {/* OVERLAY DE COMENTARIO OBLIGATORIO PARA ELIMINACIÓN */}
                {showDeletePrompt && (
                    <div className="absolute inset-0 z-[150] bg-black/80 flex items-center justify-center p-6 ">
                        <div className="bg-[#2d2e3d] w-full max-w-md p-8 rounded-none border border-white/10 ">
                            <div className="flex items-center gap-3 mb-6 text-red-400">
                                <MessageSquare size={24} />
                                <h3 className="text-sm font-semibold uppercase tracking-[0.2em]">Motivo de Eliminación</h3>
                            </div>

                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-4">
                                Explique por qué desea eliminar la cuenta seleccionada. Este comentario quedará registrado.
                            </p>

                            <textarea
                                autoFocus
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                placeholder="Escriba el motivo aquí..."
                                className="w-full h-32 bg-black/20 border border-white/10 rounded p-4 text-xs font-medium text-white focus:outline-none focus:border-[#7c7ffb] transition-all resize-none mb-6 placeholder:text-gray-700"
                            />

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowDeletePrompt(false)}
                                    className="flex-1 py-4 bg-[#3a3b4d] hover:bg-[#45465e] text-gray-400 rounded text-[9px] font-semibold uppercase tracking-widest transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={!deleteReason.trim()}
                                    onClick={confirmDelete}
                                    className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white disabled:opacity-20 rounded text-[9px] font-semibold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
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
