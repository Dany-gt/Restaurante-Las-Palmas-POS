import React, { useState, useEffect } from 'react';
import { ChevronLeft, ArrowLeftRight, Check } from 'lucide-react';
import { OrderItem } from '../types';

interface Account {
    id: string;
    name: string;
    items: OrderItem[];
}

interface AccountsManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: any[];
    onConfirm: (accounts: Account[]) => void;
    onOpenOverview?: () => void;
}

export const AccountsManagementModal: React.FC<AccountsManagementModalProps> = ({ isOpen, onClose, orders, onConfirm, onOpenOverview }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [activeAccountIdx, setActiveAccountIdx] = useState(0);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
    const [tempName, setTempName] = useState('');

    useEffect(() => {
        if (isOpen) {
            const usedNames = new Set<string>();
            const initialAccounts = orders.map((o, idx) => {
                let name = o.customer_name?.trim();
                if (!name || name.toUpperCase() === 'CUENTA PRINCIPAL') {
                    name = `CUENTA ${idx + 1}`;
                }

                let finalName = name.toUpperCase();
                if (usedNames.has(finalName)) {
                    let nextNum = idx + 1;
                    while (usedNames.has(`CUENTA ${nextNum}`)) {
                        nextNum++;
                    }
                    finalName = `CUENTA ${nextNum}`;
                }
                usedNames.add(finalName);

                return {
                    id: o.id || `acc-${idx}`,
                    name: finalName,
                    items: (o.items || o.order_items || []).map((item: any) => ({
                        ...item,
                        uniqueId: `${item.id}-${Math.random().toString(36).substr(2, 9)}`
                    }))
                };
            });
            setAccounts(initialAccounts);
            setActiveAccountIdx(0);
            setSelectedItems(new Set());
        }
    }, [isOpen, orders]);

    const toggleItemSelection = (uniqueId: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(uniqueId)) newSelected.delete(uniqueId);
        else newSelected.add(uniqueId);
        setSelectedItems(newSelected);
    };

    const moveItemsToAccount = (targetIdx: number) => {
        if (selectedItems.size === 0) return;

        const sourceAccount = accounts[activeAccountIdx];
        const itemsToMove = sourceAccount.items.filter(item => selectedItems.has(item.uniqueId!));
        
        const newAccounts = [...accounts];
        newAccounts[activeAccountIdx] = {
            ...sourceAccount,
            items: sourceAccount.items.filter(item => !selectedItems.has(item.uniqueId!))
        };
        newAccounts[targetIdx] = {
            ...newAccounts[targetIdx],
            items: [...newAccounts[targetIdx].items, ...itemsToMove]
        };

        setAccounts(newAccounts);
        setSelectedItems(new Set());
    };

    const handleRename = (idx: number) => {
        setRenamingIdx(idx);
        setTempName(accounts[idx].name);
    };

    const saveRename = () => {
        if (renamingIdx === null) return;
        const newAccounts = [...accounts];
        newAccounts[renamingIdx].name = tempName.toUpperCase();
        setAccounts(newAccounts);
        setRenamingIdx(null);
    };

    if (!isOpen) return null;

    const activeAccount = accounts[activeAccountIdx];

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#1a1d26]">

            {/* Header Barra Superior - Diseño Original */}
            <div className="h-14 bg-[#252836] flex items-center px-4 border-b border-white/5">
                <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded flex items-center justify-center text-gray-400 hover:text-white">
                    <ChevronLeft size={20} />
                </button>
                <span className="ml-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest">PÁLADAR POS</span>
                
                <div className="ml-auto flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-[10px] font-black text-white uppercase">{localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')!).name : 'DANILO PEREZ'}</div>
                        <div className="text-[9px] font-bold text-[#7c7ffb] uppercase">Dividir Cuentas</div>
                    </div>
                </div>
            </div>

            {/* Contenido Principal */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* Columna Cuentas */}
                <div className="w-[300px] flex flex-col border-r border-white/5">
                    <div className="h-10 bg-[#2d2e3d] flex items-center justify-center border-b border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cuentas</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {accounts.map((acc, idx) => (
                            <div
                                key={acc.id}
                                onClick={() => setActiveAccountIdx(idx)}
                                onDoubleClick={() => handleRename(idx)}
                                className={`h-12 px-4 flex items-center justify-between cursor-pointer transition-all ${
                                    activeAccountIdx === idx 
                                    ? 'bg-[#7c7ffb] text-white' 
                                    : 'bg-[#3a3b4d]/40 text-gray-500 border border-white/5 hover:bg-[#3a3b4d]/60'
                                }`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-2 h-2 rounded-full ${activeAccountIdx === idx ? 'bg-green-400' : 'bg-white/10'}`} />
                                    {renamingIdx === idx ? (
                                        <input
                                            autoFocus
                                            value={tempName}
                                            onChange={(e) => setTempName(e.target.value)}
                                            onBlur={saveRename}
                                            onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                                            className="bg-black/20 text-white text-[11px] font-bold uppercase outline-none px-1 w-full"
                                        />
                                    ) : (
                                        <span className="text-[11px] font-black uppercase truncate">{acc.name}</span>
                                    )}
                                </div>
                                <span className="text-[11px] font-bold tabular-nums">
                                    Q{acc.items.reduce((s, i) => s + ((i.price || i.unit_price || 0) * (i.quantity || 1)), 0).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Columna Platillos */}
                <div className="flex-1 flex flex-col">
                    <div className="h-10 bg-[#2d2e3d] flex items-center justify-center border-b border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Platillos</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                        <div className="flex flex-wrap gap-3">
                            {activeAccount?.items.map((item) => (
                                <button
                                    key={item.uniqueId}
                                    onClick={() => toggleItemSelection(item.uniqueId!)}
                                    className={`h-14 px-4 flex items-center gap-4 transition-all border-2 ${
                                        selectedItems.has(item.uniqueId!)
                                        ? 'bg-[#7c7ffb]/20 border-[#7c7ffb]'
                                        : 'bg-[#3a3b4d] border-transparent hover:border-white/10'
                                    }`}
                                >
                                    <div className="w-6 h-6 bg-black/20 rounded flex items-center justify-center text-[10px] font-bold text-white">
                                        {item.quantity}
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <div className="text-[10px] font-black text-gray-200 uppercase leading-tight line-clamp-1">{item.product_name}</div>
                                        <div className="text-[9px] font-bold text-gray-500">Q{(item.price || item.unit_price || 0).toFixed(2)}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Hint Inferior */}
                    <div className="h-10 border-t border-white/5 bg-black/10 flex items-center justify-center">
                        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-gray-600">
                            Toca un platillo para seleccionar
                        </span>
                    </div>
                </div>
            </div>

            {/* Footer Barra Inferior - Diseño Original */}
            <div className="h-20 bg-[#252836] border-t border-white/5 flex items-center justify-center gap-10 px-8">
                <button
                    onClick={() => onOpenOverview?.()}
                    className="w-40 h-12 bg-[#3a3b4d] hover:bg-[#45465e] text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all rounded"
                >
                    CUENTAS
                </button>

                <div className="flex gap-2">
                    {accounts.map((acc, idx) => (
                        idx !== activeAccountIdx && selectedItems.size > 0 && (
                            <button
                                key={acc.id}
                                onClick={() => moveItemsToAccount(idx)}
                                className="h-12 px-6 bg-[#3a3b4d] hover:bg-[#7c7ffb] text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all rounded border border-white/5"
                            >
                                TRASLADAR A {acc.name}
                            </button>
                        )
                    ))}
                    {selectedItems.size === 0 && (
                        <button className="h-12 px-10 bg-[#3a3b4d] opacity-50 cursor-not-allowed text-[10px] font-black uppercase tracking-widest text-gray-400 rounded">
                            TRASLADAR PLATOS
                        </button>
                    )}
                </div>

                <button
                    onClick={() => onConfirm(accounts)}
                    className="w-40 h-12 bg-[#7c7ffb] hover:bg-[#6b6edb] text-[10px] font-black uppercase tracking-widest text-white transition-all rounded  /20"
                >
                    ACEPTAR
                </button>
            </div>
        </div>
    );
};
