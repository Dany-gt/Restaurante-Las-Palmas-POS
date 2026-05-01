import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Save, Trash2, Plus, ShoppingCart, CornerDownLeft } from 'lucide-react';
import { supabase } from '../supabase';
import { User } from '../types';
import { printService } from '../services/PrintService';

interface NewExpenseModalProps {
    currentUser: User;
    onClose: () => void;
    onSaveSuccess: () => void;
}

interface ExpenseItem {
    id: string;
    name: string;
    price: number;
}

export const NewExpenseModal: React.FC<NewExpenseModalProps> = ({ currentUser, onClose, onSaveSuccess }) => {
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [description, setDescription] = useState('');
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Item Entry State
    const [itemName, setItemName] = useState('');
    const [itemPrice, setItemPrice] = useState('0.00'); // Controlled by keypad
    const [items, setItems] = useState<ExpenseItem[]>([]);
    const [recentItems, setRecentItems] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchCats = async () => {
            const { data } = await supabase.from('expense_categories').select('*').eq('is_active', true).order('name');
            if (data) setCategories(data);
        };

        const fetchRecentItems = async () => {
            const { data } = await supabase.from('expenses').select('items').order('created_at', { ascending: false }).limit(20);
            if (data) {
                const names = new Set<string>();
                data.forEach(exp => {
                    const items = exp.items as any[];
                    if (Array.isArray(items)) {
                        items.forEach(it => {
                            if (it.name) names.add(it.name.toUpperCase());
                        });
                    }
                });
                setRecentItems(Array.from(names));
            }
        };

        fetchCats();
        fetchRecentItems();
    }, []);

    const handleKeyPad = (key: string) => {
        setItemPrice(prev => {
            if (key === 'BACKSPACE') return prev.length > 1 ? prev.slice(0, -1) : '0';
            if (key === '.' || key === 'DOT') {
                return prev.includes('.') ? prev : prev + '.';
            }
            const newVal = prev === '0.00' || prev === '0' ? key : prev + key;
            return newVal;
        });
    };

    const handleAddItem = () => {
        const price = parseFloat(itemPrice);
        if (!itemName.trim()) {
            if (!selectedCategory) return;
            return;
        }

        const newItem: ExpenseItem = {
            id: Date.now().toString(),
            name: itemName,
            price: price
        };

        setItems([...items, newItem]);
        setItemName('');
        setItemPrice('0.00');

        // Keep focus for next item
        setTimeout(() => nameInputRef.current?.focus(), 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddItem();
        }
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const calculateTotal = () => items.reduce((acc, curr) => acc + curr.price, 0);


    const handleSaveExpense = async () => {
        const total = calculateTotal();
        if (total <= 0) return;
        if (!selectedCategory) return;

        setLoading(true);
        try {
            // Find open shift to link register? Not strictly required by schema but good practice.
            // Using last known logic or just storing without shift_id if not in schema yet.
            // Schema has cash_register_id. We need that.

            // Get user's open shift to find the register
            const { data: shift } = await supabase.from('shifts')
                .select('id, cash_register_id')
                .eq('cashier_id', currentUser.id)
                .eq('status', 'OPEN')
                .single();

            const expenseData = {
                amount: total,
                category: selectedCategory,
                description: description || `Gasto en ${selectedCategory} (${items.length} items)`,
                items: items, // JSONB
                cashier_id: currentUser.id,
                cash_register_id: shift?.cash_register_id,
                shift_id: shift?.id
            };

            const { error } = await supabase.from('expenses').insert(expenseData);
            if (error) throw error;

            // Also UPDATE register balance?
            // Usually expenses DEDUCT from cash drawer.
            if (shift?.cash_register_id) {
                // We need to decrement the balance
                // RPC is safer for atomic updates, but for now read-update-write
                const { data: reg } = await supabase.from('cash_registers').select('current_balance').eq('id', shift.cash_register_id).single();
                if (reg) {
                    await supabase.from('cash_registers').update({
                        current_balance: (reg.current_balance || 0) - total
                    }).eq('id', shift.cash_register_id);
                }
            }

            // Print Receipt Silently
            try {
                await printService.printDetailedExpense({
                    amount: total,
                    category: selectedCategory,
                    description: expenseData.description,
                    items: items,
                    cashierName: currentUser.name
                });
            } catch (printErr) {
                console.error('Error printing expense:', printErr);
            }

            onSaveSuccess();
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#16191f] w-full max-w-5xl h-[85vh] rounded-2xl border border-white/10 shadow-2xl flex overflow-hidden">

                {/* LEFT: Category & List */}
                <div className="flex-1 flex flex-col border-r border-white/5 bg-[#0f1115]">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h2 className="text-xl font-black text-white tracking-tight uppercase">Nuevo Gasto</h2>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white"><X size={20} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* 1. Items List (TOP) */}
                        <div className="bg-[#1e212b] rounded-2xl border border-white/5 overflow-hidden flex flex-col h-[280px] shrink-0">
                            <div className="p-3 bg-white/5 border-b border-white/5 flex justify-between items-center">
                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Detalle del Gasto</span>
                                <span className="text-xs font-black text-white tabular-nums">Total: Q{calculateTotal().toFixed(2)}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
                                {items.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-600 py-10 opacity-50">
                                        <ShoppingCart size={32} className="mb-2" />
                                        <span className="text-[10px] uppercase font-bold">Agregue items al gasto</span>
                                    </div>
                                ) : (
                                    items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center p-3 bg-black/20 rounded-2xl hover:bg-black/30 group">
                                            <span className="text-sm font-bold text-gray-300">{item.name}</span>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm font-black text-white tabular-nums">Q{item.price.toFixed(2)}</span>
                                                <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 2. Category Grid (BOTTOM) */}
                        <div className="mb-6 flex flex-col flex-1 min-h-0">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Categorías</label>
                                <div className="relative w-1/2">
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-[#1e212b] border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 uppercase"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 overflow-y-auto pr-2 content-start min-h-0 bg-[#0f1115]">
                                {categories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.name)}
                                        className={`p-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border h-14 flex items-center justify-center text-center ${selectedCategory === cat.name
                                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                                            : 'bg-[#1e212b] text-gray-400 border-white/5 hover:bg-[#2b2f3a] hover:border-white/10'
                                            }`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                                {categories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                                    <div className="col-span-3 text-center py-8 text-gray-600 text-[10px] uppercase font-bold">
                                        Sin resultados
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Input & Keypad */}
                <div className="w-[380px] bg-[#16191f] flex flex-col h-full border-l border-white/5">
                    <div className="p-5 flex-1 flex flex-col gap-4 h-full">

                        {/* Selected Cat & Name Input */}
                        <div className="flex flex-col gap-3 shrink-0">
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Registrando en</span>
                                <div className="text-lg font-black text-indigo-400 uppercase tracking-tight truncate">{selectedCategory || 'Seleccione Categoría'}</div>
                            </div>

                            <div>
                                <input
                                    type="text"
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    ref={nameInputRef}
                                    placeholder="Descripción..."
                                    className="w-full bg-[#0f1115] border border-white/10 rounded-2xl px-4 py-3 text-white text-base font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                                />

                                {/* Suggestions */}
                                {itemName.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {recentItems
                                            .filter(name => name.includes(itemName.toUpperCase()) && name !== itemName.toUpperCase())
                                            .slice(0, 5)
                                            .map(name => (
                                                <button
                                                    key={name}
                                                    onClick={() => setItemName(name)}
                                                    className="px-3 py-1.5 bg-[#2b2f3a] hover:bg-indigo-600 rounded-lg text-[10px] font-black text-white transition-all uppercase"
                                                >
                                                    {name}
                                                </button>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Amount Display */}
                        <div className="shrink-0">
                            <div className="bg-[#222630] rounded-2xl px-5 py-4 text-right border border-white/5 flex flex-col justify-center h-20">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Monto</span>
                                <span className="text-4xl font-black tracking-tighter text-white">Q{itemPrice}</span>
                            </div>
                        </div>

                        {/* Keypad - Takes remaining space */}
                        <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => (
                                <button key={k} onClick={() => handleKeyPad(k)} className="rounded-2xl bg-[#363b49] text-xl font-bold text-white border border-white/5 active:scale-95 transition-all">
                                    {k}
                                </button>
                            ))}
                            <button onClick={() => handleKeyPad('.')} className="rounded-2xl bg-[#363b49] text-2xl font-bold text-white border border-white/5 active:scale-95 transition-all">.</button>
                            <button onClick={() => handleKeyPad('0')} className="rounded-2xl bg-[#363b49] text-xl font-bold text-white border border-white/5 active:scale-95 transition-all">0</button>
                            <button onClick={() => handleKeyPad('BACKSPACE')} className="rounded-2xl bg-[#363b49] text-xl font-bold text-white border border-white/5 active:scale-95 transition-all flex items-center justify-center">
                                <Delete size={20} />
                            </button>
                        </div>

                        {/* Actions Row - Fixed Height */}
                        <div className="grid grid-cols-[1fr_1.5fr] gap-2 shrink-0 h-16">
                            {/* ENTER / ADD ITEM BUTTON */}
                            <button
                                onClick={handleAddItem}
                                className="bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs flex flex-col items-center justify-center gap-1 active:scale-95"
                            >
                                <CornerDownLeft size={20} />
                                <span>Agregar</span>
                            </button>

                            {/* SAVE & PRINT BUTTON */}
                            <button
                                onClick={handleSaveExpense}
                                disabled={items.length === 0 || loading}
                                className={`rounded-2xl font-black uppercase tracking-widest text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all ${items.length > 0 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                <Save size={20} />
                                <span>{loading ? '...' : 'Terminar'}</span>
                            </button>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
};

// Helper for Delete icon
const Delete = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
        <line x1="18" y1="9" x2="12" y2="15"></line>
        <line x1="12" y1="9" x2="18" y2="15"></line>
    </svg>
);
