import React, { useState, useEffect, useRef } from 'react';
import { Search, Trash2, ShoppingCart, Delete, ArrowUp, ArrowDown } from 'lucide-react';
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
    const [itemPrice, setItemPrice] = useState('0.00');
    const [itemName, setItemName] = useState('');
    const [items, setItems] = useState<ExpenseItem[]>([]);
    const [loading, setLoading] = useState(false);

    const categoryScrollRef = useRef<HTMLDivElement>(null);
    const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const scrollCategories = (direction: number) => {
        if (categoryScrollRef.current) {
            categoryScrollRef.current.scrollBy({ top: direction * 40, behavior: 'auto' });
        }
    };

    const startScrolling = (direction: number) => {
        scrollCategories(direction);
        if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = setInterval(() => {
            scrollCategories(direction);
        }, 50);
    };

    const stopScrolling = () => {
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
    };

    useEffect(() => {
        return () => stopScrolling();
    }, []);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchCats = async () => {
            const { data } = await supabase
                .from('expense_categories')
                .select('*')
                .eq('is_active', true)
                .order('name');
            if (data) setCategories(data);
        };
        fetchCats();
    }, []);

    const handleKeyPad = (key: string) => {
        setItemPrice(prev => {
            if (key === 'BACKSPACE') {
                if (prev === '0.00') return '0.00';
                const stripped = prev.replace('.', '');
                const newVal = stripped.slice(0, -1);
                if (!newVal) return '0.00';
                return (parseInt(newVal) / 100).toFixed(2);
            }
            if (key === '.') return prev;
            const stripped = prev.replace('.', '');
            const newVal = (stripped === '000' || stripped === '0') ? key : stripped + key;
            return (parseInt(newVal) / 100).toFixed(2);
        });
    };

    // ✓ AGREGAR: solo agrega a la lista, sin guardar ni imprimir
    const handleAddItem = () => {
        const price = parseFloat(itemPrice);
        if (price <= 0 || !selectedCategory) return;
        setItems(prev => [...prev, {
            id: Date.now().toString(),
            name: itemName.trim() || selectedCategory,
            price,
        }]);
        setItemPrice('0.00');
        setItemName('');
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const total = items.reduce((acc, i) => acc + i.price, 0);

    // ACEPTAR: guarda todo e imprime el ticket
    const handleSaveExpense = async () => {
        if (items.length === 0 || !selectedCategory) return;
        setLoading(true);
        try {
            const { data: shift } = await supabase
                .from('shifts')
                .select('id, cash_register_id, shift_number, cash_registers(branch_id)')
                .eq('cashier_id', currentUser.id)
                .eq('status', 'OPEN')
                .single();

            const expenseData = {
                amount: total,
                category: selectedCategory,
                description: items.map(i => i.name).join(', '),
                items: items.map(i => ({ name: i.name, price: i.price })),
                cashier_id: currentUser.id,
                cash_register_id: shift?.cash_register_id,
                shift_id: shift?.id,
                branch_id: (shift?.cash_registers as any)?.branch_id,
            };

            const { data: insertedExpense, error } = await supabase
                .from('expenses')
                .insert(expenseData)
                .select('id')
                .single();
            if (error) throw error;

            let registerName = 'PRINCIPAL';
            if (shift?.cash_register_id) {
                const { data: reg } = await supabase
                    .from('cash_registers')
                    .select('current_balance, name')
                    .eq('id', shift.cash_register_id)
                    .single();
                if (reg) {
                    if (reg.name) registerName = reg.name;
                    await supabase.from('cash_registers').update({
                        current_balance: (reg.current_balance || 0) - total,
                    }).eq('id', shift.cash_register_id);
                }
            }

            // Obtener el número correlativo contando los gastos de este turno
            let expenseCorrelative = 1;
            if (shift?.id) {
                const { count } = await supabase
                    .from('expenses')
                    .select('*', { count: 'exact', head: true })
                    .eq('shift_id', shift.id);
                if (count !== null) {
                    expenseCorrelative = count;
                }
            }

            // Calcular número de turno del día (1, 2, 3...)
            let dailyShiftNumber = 1;
            if (shift?.cash_register_id) {
                const todayStr = new Date().toISOString().split('T')[0]; // Fecha actual YYYY-MM-DD
                const { count } = await supabase
                    .from('shifts')
                    .select('*', { count: 'exact', head: true })
                    .eq('cash_register_id', shift.cash_register_id)
                    .gte('start_time', `${todayStr}T00:00:00.000Z`)
                    .lte('start_time', `${todayStr}T23:59:59.999Z`);
                
                if (count !== null && count > 0) {
                    dailyShiftNumber = count;
                }
            }

            try {
                await printService.printDetailedExpense({
                    id: insertedExpense?.id,
                    expenseNumber: expenseCorrelative,
                    registerName: registerName,
                    shiftNumber: dailyShiftNumber,
                    amount: total,
                    category: selectedCategory,
                    description: expenseData.description,
                    items: expenseData.items,
                    cashierName: currentUser.name,
                    date: now.toLocaleDateString('es-GT'),
                    time: now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }),
                });
                printService.openCashDrawer({
                    userId: currentUser?.id,
                    userName: currentUser?.name,
                    amount: total,
                    reason: `Gasto: ${selectedCategory}`,
                }).catch(console.error);
            } catch (printErr) {
                console.error('Error printing expense:', printErr);
            }

            onSaveSuccess();
        } catch (err: any) {
            console.error(err);
            alert('Error al guardar el gasto.');
        } finally {
            setLoading(false);
        }
    };

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 font-sans">
            <div className="bg-[#2d2f3d] w-full max-w-[760px] rounded-lg border border-[#3e4153] overflow-hidden flex flex-col shadow-2xl">

                {/* Header */}
                <div className="bg-[#383a4c] p-3 flex items-center justify-center border-b border-[#3e4153]">
                    <span className="text-white font-semibold text-sm tracking-wide">Categorías de Gastos</span>
                </div>

                <div className="flex" style={{ height: '440px' }}>

                    {/* ══════════ LEFT PANEL ══════════ */}
                    <div className="flex-1 p-3 flex flex-col gap-2 bg-[#2d2f3d]">

                        {/* Search */}
                        <div className="relative shrink-0">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <Search size={16} />
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full bg-[#242533] border border-[#3e4153] rounded-md px-9 py-2 text-white text-sm focus:outline-none focus:border-[#7a73ff] transition-colors placeholder-gray-500 uppercase"
                            />
                        </div>

                        {/* Category Grid */}
                        <div className="relative shrink-0 h-[116px] overflow-hidden rounded-sm">
                            <style>{`.hide-scroll::-webkit-scrollbar { display: none; }`}</style>
                            
                            {/* Floating Up Arrow Area */}
                            <div 
                                className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-8 z-10 flex justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
                                onMouseDown={(e) => { e.preventDefault(); startScrolling(-1); }}
                                onMouseUp={stopScrolling}
                                onMouseLeave={stopScrolling}
                                onTouchStart={(e) => { e.preventDefault(); startScrolling(-1); }}
                                onTouchEnd={stopScrolling}
                            >
                                <div className="bg-[#3e4153]/90 text-white p-1 rounded-full shadow-md mt-1 backdrop-blur-sm cursor-pointer hover:bg-[#484b5e] transition-colors h-fit">
                                    <ArrowUp size={16} strokeWidth={3} />
                                </div>
                            </div>

                            <div 
                                ref={categoryScrollRef}
                                className="grid grid-cols-3 gap-1.5 h-full overflow-y-auto hide-scroll"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {filteredCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.name)}
                                        className={`px-2 py-1 rounded-none text-[11px] font-semibold uppercase tracking-tight transition-all h-8 flex items-center justify-center text-center leading-tight ${
                                            selectedCategory === cat.name
                                                ? 'bg-[#7a73ff] text-white border-transparent'
                                                : 'bg-[#3e4153] text-gray-200 hover:bg-[#484b5e] border border-transparent'
                                        }`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>

                            {/* Floating Down Arrow Area */}
                            <div 
                                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-8 z-10 flex justify-center items-end opacity-0 hover:opacity-100 transition-opacity duration-200"
                                onMouseDown={(e) => { e.preventDefault(); startScrolling(1); }}
                                onMouseUp={stopScrolling}
                                onMouseLeave={stopScrolling}
                                onTouchStart={(e) => { e.preventDefault(); startScrolling(1); }}
                                onTouchEnd={stopScrolling}
                            >
                                <div className="bg-[#3e4153]/90 text-white p-1 rounded-full shadow-md mb-1 backdrop-blur-sm cursor-pointer hover:bg-[#484b5e] transition-colors h-fit">
                                    <ArrowDown size={16} strokeWidth={3} />
                                </div>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="flex-1 flex flex-col min-h-0 bg-[#242533] rounded-md border border-[#3e4153] overflow-hidden">
                            <div className="px-3 py-1 bg-[#2d2f3d]/50 border-b border-[#3e4153] shrink-0 flex items-center gap-2">
                                <ShoppingCart size={13} className="text-[#7a73ff]" />
                                <span className="text-[10px] font-semibold text-[#7a73ff] uppercase tracking-wider">Detalle del Gasto</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                                {items.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60 py-2">
                                        <ShoppingCart size={18} className="mb-1" />
                                        <span className="text-[9px] uppercase font-semibold">Presiona el cheque para añadir ítems</span>
                                    </div>
                                ) : (
                                    items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center px-2 py-1 bg-[#3e4153]/40 rounded-md group hover:bg-[#3e4153]/80 transition-colors">
                                            <span className="text-[11px] font-medium text-gray-300 uppercase truncate flex-1">{item.name}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[11px] font-semibold text-white tabular-nums">Q{item.price.toFixed(2)}</span>
                                                <button
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="flex flex-col gap-1.5 mt-auto shrink-0">
                            <div className="flex gap-1.5">
                                <div className="flex-1 flex items-center bg-[#242533] border border-[#3e4153] rounded px-3 py-1.5">
                                    <span className="text-gray-400 text-xs mr-2">📁</span>
                                    <span className="text-gray-300 text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                                        {selectedCategory || 'Categoría'}
                                    </span>
                                </div>
                                <div className="w-24 flex items-center bg-[#242533] border border-[#3e4153] rounded px-3 py-1.5">
                                    <span className="text-gray-400 font-medium mr-1.5 text-xs">Q</span>
                                    <span className="text-white text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis tabular-nums">
                                        {total.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center bg-[#242533] border border-[#3e4153] rounded px-3 py-1.5">
                                <input
                                    type="text"
                                    placeholder="Nombre del producto..."
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
                                    className="w-full bg-transparent border-none text-white text-xs font-semibold focus:outline-none placeholder-gray-500 uppercase"
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1 shrink-0">
                            <button
                                onClick={onClose}
                                className="flex-1 py-1.5 text-xs font-medium rounded border border-[#3e4153] text-gray-300 hover:bg-[#3e4153] transition-colors uppercase"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveExpense}
                                disabled={items.length === 0 || !selectedCategory || loading}
                                className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors uppercase ${
                                    items.length > 0 && selectedCategory && !loading
                                    ? 'bg-[#7a73ff] text-white hover:bg-[#6b64ff] shadow-md shadow-[#7a73ff]/20' 
                                    : 'bg-[#3e4153] text-gray-500 cursor-not-allowed opacity-50'
                                }`}
                            >
                                {loading ? '...' : 'Aceptar'}
                            </button>
                        </div>
                    </div>
                    {/* ══════════ END LEFT PANEL ══════════ */}

                    {/* ══════════ RIGHT PANEL: Numpad ══════════ */}
                    <div className="w-[230px] bg-[#36384a] p-3 flex flex-col gap-3 border-l border-[#2d2f3d]">

                        {/* Amount display */}
                        <div className="bg-transparent border border-[#4b4e63] rounded h-12 flex items-center justify-center shrink-0">
                            <span className="text-xl font-medium text-white tabular-nums tracking-wide">Q{itemPrice}</span>
                        </div>

                        {/* 4-column Numpad */}
                        <div className="grid grid-cols-4 gap-0 auto-rows-[55px] border-t border-l border-[#4b4e63] rounded overflow-hidden mb-auto">
                            {/* Row 1 */}
                            {['7','8','9'].map(k => (
                                <button key={k} onClick={() => handleKeyPad(k)} className="bg-transparent hover:bg-white/5 active:bg-[#7a73ff] text-sm font-semibold text-white rounded-none transition-colors border-r border-b border-[#4b4e63]">{k}</button>
                            ))}
                            <button onClick={() => handleKeyPad('BACKSPACE')} className="bg-transparent hover:bg-rose-500/80 active:bg-rose-500 text-white rounded-none flex items-center justify-center transition-colors border-r border-b border-[#4b4e63] row-span-2">
                                <Delete size={16} strokeWidth={2.5} />
                            </button>

                            {/* Row 2 */}
                            {['4','5','6'].map(k => (
                                <button key={k} onClick={() => handleKeyPad(k)} className="bg-transparent hover:bg-white/5 active:bg-[#7a73ff] text-sm font-semibold text-white rounded-none transition-colors border-r border-b border-[#4b4e63]">{k}</button>
                            ))}

                            {/* Row 3 */}
                            {['1','2','3'].map(k => (
                                <button key={k} onClick={() => handleKeyPad(k)} className="bg-transparent hover:bg-white/5 active:bg-[#7a73ff] text-sm font-semibold text-white rounded-none transition-colors border-r border-b border-[#4b4e63]">{k}</button>
                            ))}
                            <button onClick={handleAddItem} disabled={parseFloat(itemPrice) <= 0 || !selectedCategory} className={`rounded-none flex items-center justify-center transition-all row-span-2 border-r border-b border-[#4b4e63] ${parseFloat(itemPrice) > 0 && selectedCategory ? 'bg-transparent hover:bg-white/5 active:bg-[#7a73ff] text-white cursor-pointer' : 'bg-transparent text-gray-500 cursor-not-allowed opacity-50'}`}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            </button>

                            {/* Row 4 */}
                            <button onClick={() => handleKeyPad('0')} className="bg-transparent hover:bg-white/5 active:bg-[#7a73ff] text-sm font-semibold text-white rounded-none transition-colors border-r border-b border-[#4b4e63] col-span-2">0</button>
                            <button onClick={() => handleKeyPad('.')} className="bg-transparent hover:bg-white/5 active:bg-[#7a73ff] text-sm font-semibold text-white rounded-none transition-colors border-r border-b border-[#4b4e63]">.</button>
                        </div>

                    </div>
                    {/* ══════════ END RIGHT PANEL ══════════ */}
                </div>
            </div>
        </div>
    );
};
