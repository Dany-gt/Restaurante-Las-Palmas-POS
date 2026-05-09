import React, { useState, useEffect } from 'react';
import { X, Settings2, ArrowRight, Plus, Trash2, CheckCircle, Split, Edit2, LayoutList } from 'lucide-react';
import { OrderItem } from '../types';
import { supabase } from '../supabase';

interface Account {
    id: string;
    originalOrderId?: string;
    name: string;
    items: OrderItem[];
}

interface AccountsManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: any[]; // Accepts full Order objects
    onConfirm: (accounts: Account[]) => void;
}

export const AccountsManagementModal: React.FC<AccountsManagementModalProps> = ({ isOpen, onClose, orders, onConfirm }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [activeAccountIdx, setActiveAccountIdx] = useState(0);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (orders && orders.length > 0) {
                // Map existing orders to accounts
                const mappedAccounts = orders.map((order, idx) => ({
                    id: order.id || `temp-${Date.now()}-${idx}`,
                    originalOrderId: order.id,
                    name: order.customer_name || `Cuenta ${idx + 1}`,
                    items: [...(order.items || order.order_items || [])].map((i: any) => ({
                        ...i,
                        price: i.price ?? i.unit_price ?? 0,
                        product_name: i.product_name || i.products?.name || 'Producto'
                    }))
                }));
                setAccounts(mappedAccounts);
            } else {
                // Fallback (should typically not happen if properly called)
                setAccounts([{ id: 'main', name: 'Cuenta 1', items: [] }]);
            }
            setActiveAccountIdx(0);
            setEditingIdx(null);
        }
    }, [isOpen, orders]);

    const addAccount = () => {
        const newId = `acc-${Date.now()}`;
        setAccounts([...accounts, { id: newId, name: `Cuenta ${accounts.length + 1}`, items: [] }]);
        setActiveAccountIdx(accounts.length);
    };

    const moveItem = (itemId: string, fromIdx: number, toIdx: number) => {
        if (fromIdx === toIdx) return;

        setAccounts(prev => {
            const newAccounts = [...prev];
            const sourceAcc = { ...newAccounts[fromIdx] };
            const targetAcc = { ...newAccounts[toIdx] };

            const itemIdx = sourceAcc.items.findIndex(i => i.id === itemId);
            if (itemIdx === -1) return prev;

            const [item] = sourceAcc.items.splice(itemIdx, 1);
            sourceAcc.items = [...sourceAcc.items]; // New array reference
            targetAcc.items = [...targetAcc.items, item]; // New array reference

            newAccounts[fromIdx] = sourceAcc;
            newAccounts[toIdx] = targetAcc;

            return newAccounts;
        });
    };

    const removeAccount = (idx: number) => {
        if (idx === 0) return;
        const newAccounts = [...accounts];
        const itemsToReturn = newAccounts[idx].items;
        newAccounts[0].items = [...newAccounts[0].items, ...itemsToReturn];
        newAccounts.splice(idx, 1);
        setAccounts(newAccounts);
        setActiveAccountIdx(0);
    };

    const updateAccountName = (idx: number, name: string) => {
        const newAccounts = [...accounts];
        newAccounts[idx].name = name;
        setAccounts(newAccounts);
    };

    const handleDecomposeItem = async (item: OrderItem) => {
        const userStr = localStorage.getItem('currentUser');
        if (!userStr) return;
        try {
            const user = JSON.parse(userStr);
            if (!['ADMIN', 'CAJERO'].includes(user.role)) {
                alert('RESTRINGIDO: Solo Cajeros y Administradores pueden desglosar ítems enviados.');
                return;
            }

            if (!window.confirm(`¿Confirmar desglose de ${item.quantity}x ${item.product_name}?\n\nSe convertirán en líneas individuales con el mismo precio.\nEsta acción conservará el estado de cocina y NO reimprimirá tickets.`)) return;

            // 1. Update Original Item to Qty 1
            const { error: updateError } = await supabase
                .from('order_items')
                .update({ quantity: 1 })
                .eq('id', item.id);

            if (updateError) throw updateError;

            // 2. Prepare Copies (N-1)
            // 2. Prepare Copies (N-1)
            // 2. Prepare Copies (N-1)
            const copies = [];
            for (let i = 0; i < item.quantity - 1; i++) {
                const itemAny = item as any;
                copies.push({
                    order_id: itemAny.order_id,
                    product_id: item.product_id,
                    quantity: 1,
                    unit_price: item.price,
                    notes: item.notes || '',
                    status: item.status,
                    sent_to_kitchen: true,
                    print_status: 'printed'
                });
            }

            if (copies.length > 0) {
                // Try Full Insert (Propagating status)
                const { error: insertError } = await supabase.from('order_items').insert(copies);

                if (insertError) {
                    console.warn('⚠️ Fallo inserción con flags de cocina, intentando básico...', insertError);

                    // Fallback: Basic Insert (Clean payload)
                    const basicCopies = copies.map(c => ({
                        order_id: c.order_id,
                        product_id: c.product_id,
                        quantity: c.quantity,
                        unit_price: c.unit_price,
                        notes: c.notes,
                        status: c.status
                    }));

                    const { error: retryError } = await supabase.from('order_items').insert(basicCopies);
                    if (retryError) throw retryError;
                }
            }

            // 3. Feedback and Close
            alert('✅ Ítem desglosado correctamente.\nLa ventana se cerrará para actualizar los datos.');
            onClose();

        } catch (error: any) {
            console.error(error);
            alert('Error al desglosar: ' + error.message);
        }
    };

    if (!isOpen || accounts.length === 0) return null;

    return (

        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-fade-in">
            <div className="w-full max-w-5xl h-[85vh] bg-[#16191f] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden">

                {/* Header Compacto */}
                <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/20">
                            <Split size={20} className="text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tighter text-white">Gestión de Cuentas Separadas</h3>
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-0.5">Dividir mesa y asignar platillos</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={addAccount}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-indigo-600/20 text-white"
                        >
                            <Plus size={14} strokeWidth={3} /> Nueva Cuenta
                        </button>
                        <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Workspace */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Side Tabs: Accounts List */}
                    <div className="w-[260px] border-r border-white/5 flex flex-col bg-[#13151a]">
                        <div className="p-4 space-y-2 overflow-y-auto flex-1 scrollbar-hide">
                            {accounts.map((acc, idx) => (
                                <button
                                    key={acc.id}
                                    onClick={() => setActiveAccountIdx(idx)}
                                    className={`w-full p-4 rounded-2xl border transition-all flex flex-col gap-1.5 text-left group ${activeAccountIdx === idx
                                        ? 'bg-indigo-600/10 border-indigo-500/50 shadow-md shadow-indigo-600/5'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                        }`}
                                >
                                    <div className="flex justify-between items-center w-full">
                                        {editingIdx === idx ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                value={acc.name}
                                                onChange={(e) => updateAccountName(idx, e.target.value)}
                                                onBlur={() => setEditingIdx(null)}
                                                onKeyDown={(e) => e.key === 'Enter' && setEditingIdx(null)}
                                                className="bg-black/40 border border-indigo-500/50 rounded-lg px-2 py-1 text-[10px] font-black uppercase text-white w-full outline-none"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 max-w-[85%]">
                                                <span className={`text-[10px] font-black uppercase tracking-widest truncate ${activeAccountIdx === idx ? 'text-white' : 'text-gray-300'}`}>{acc.name}</span>
                                                <Edit2
                                                    size={10}
                                                    className="text-gray-600 hover:text-indigo-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                                    onClick={(e) => { e.stopPropagation(); setEditingIdx(idx); }}
                                                />
                                            </div>
                                        )}
                                        {idx > 0 && (
                                            <Trash2
                                                size={12}
                                                className="text-gray-600 hover:text-red-400 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); removeAccount(idx); }}
                                            />
                                        )}
                                    </div>
                                    <div className="flex justify-between items-end border-t border-white/5 pt-1.5 mt-0.5">
                                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">{acc.items.length} Items</span>
                                        <span className="text-sm font-black tabular-nums text-indigo-400">
                                            Q{acc.items.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Area: Item Assignment */}
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#16191f]">

                        {/* Source List */}
                        <div className="flex-1 flex flex-col overflow-hidden p-6 relative">
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Productos en <span className="text-indigo-400">{accounts[activeAccountIdx].name}</span></h4>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                {accounts[activeAccountIdx].items.map(item => (
                                    <div
                                        key={item.id}
                                        className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-white/10 hover:bg-white/[0.07] transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xs font-black text-indigo-300">
                                                {item.quantity}
                                            </div>
                                            <div>
                                                <span className="block text-[11px] font-bold text-gray-200 leading-tight mb-0.5">{item.product_name}</span>
                                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Q{item.price.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Botón Desglosar (Solo si Qty > 1 y es Cajero/Admin - validado en click, botón visible para todos o filtrar?) */}
                                            {item.quantity > 1 && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDecomposeItem(item); }}
                                                    className="w-8 h-8 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 flex items-center justify-center transition-colors border border-amber-500/20 ml-2"
                                                    title="Desglosar en unidades individuales"
                                                >
                                                    <LayoutList size={14} />
                                                </button>
                                            )}
                                            {accounts.length > 1 && (
                                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {accounts.map((acc, idx) => (
                                                        idx !== activeAccountIdx && (
                                                            <button
                                                                key={acc.id}
                                                                onClick={(e) => { e.stopPropagation(); moveItem(item.id, activeAccountIdx, idx); }}
                                                                className="h-7 px-3 bg-white/10 hover:bg-indigo-500 text-gray-300 hover:text-white rounded-lg flex items-center gap-1.5 transition-all text-[9px] font-black uppercase tracking-wider"
                                                                title={`Mover a ${acc.name}`}
                                                            >
                                                                <span className="truncate max-w-[60px]">{acc.name}</span>
                                                                <ArrowRight size={10} />
                                                            </button>
                                                        )
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {accounts[activeAccountIdx].items.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center opacity-20 text-gray-500 gap-2">
                                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center">
                                            <Plus size={24} />
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] mt-2">Sin productos asignados</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Summary Panel */}
                        <div className="w-[320px] bg-black/20 border-l border-white/5 flex flex-col p-6 shadow-xl z-10">
                            <div className="flex-1 overflow-y-auto scrollbar-hide">
                                <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Resumen de División</h4>
                                <div className="space-y-3">
                                    {accounts.map(acc => {
                                        const sub = acc.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                                        return (
                                            <div key={acc.id} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/5">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-tight mb-0.5">{acc.name}</span>
                                                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{acc.items.length} Platillos</span>
                                                </div>
                                                <span className="text-sm font-black text-indigo-400 tabular-nums">Q{sub.toFixed(2)}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-white/10 mt-4">
                                <div className="flex justify-between items-end mb-4 px-1">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Mesa</span>
                                    <span className="text-xl font-black text-white tabular-nums">
                                        Q{accounts.reduce((totalSum, acc) => totalSum + acc.items.reduce((s, i) => s + (i.price * i.quantity), 0), 0).toFixed(2)}
                                    </span>
                                </div>
                                <button
                                    onClick={() => onConfirm(accounts)}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 group"
                                >
                                    <CheckCircle size={16} className="group-hover:scale-110 transition-transform" />
                                    <span>Confirmar y Dividir</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
