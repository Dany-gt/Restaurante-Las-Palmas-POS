import React, { useState, useEffect } from 'react';
import { Search, Trash2, ShoppingCart } from 'lucide-react';
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
        <div className="fixed inset-0 bg-black/60  z-50 flex items-center justify-center p-4 font-sans">
            <div className="bg-[#2d3244] w-full max-w-[950px] rounded-lg  border border-white/10 overflow-hidden flex flex-col">

                {/* Header */}
                <div className="bg-[#3a4159] p-2 flex items-center justify-center border-b border-black/20">
                    <span className="text-white font-bold text-sm uppercase tracking-wider">Categorías de Gastos</span>
                </div>

                <div className="flex" style={{ height: '520px' }}>

                    {/* ══════════ LEFT PANEL ══════════ */}
                    <div className="flex-1 p-4 flex flex-col gap-3 bg-[#33394d] border-r border-black/30">

                        {/* Search */}
                        <div className="relative shrink-0">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <Search size={16} />
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar categoría..."
                                className="w-full bg-[#242938] border border-black/20 rounded px-9 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
                            />
                        </div>

                        {/* Category Grid */}
                        <div className="grid grid-cols-3 gap-2 shrink-0 overflow-y-auto" style={{ maxHeight: '160px' }}>
                            {filteredCategories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.name)}
                                    className={`px-2 py-2 rounded text-[10px] font-bold uppercase tracking-tight transition-all h-12 flex items-center justify-center text-center leading-tight ${
                                        selectedCategory === cat.name
                                            ? 'bg-[#6366f1] text-white '
                                            : 'bg-[#474f68] text-gray-200 hover:bg-[#525b7a] border border-black/20'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Items List */}
                        <div className="flex-1 flex flex-col min-h-0 bg-[#242938] rounded border border-black/20 overflow-hidden">
                            <div className="px-3 py-1.5 bg-black/20 border-b border-black/20 shrink-0 flex items-center gap-1.5">
                                <ShoppingCart size={12} className="text-indigo-400" />
                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Detalle del Gasto</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {items.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-40 py-6">
                                        <ShoppingCart size={22} className="mb-1" />
                                        <span className="text-[9px] uppercase font-bold">Presiona AGREGAR para añadir ítems</span>
                                    </div>
                                ) : (
                                    items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center px-3 py-2 bg-black/20 rounded group hover:bg-black/30">
                                            <span className="text-xs font-bold text-gray-300 uppercase truncate flex-1">{item.name}</span>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="text-xs font-black text-white tabular-nums">Q{item.price.toFixed(2)}</span>
                                                <button
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Item name input */}
                        <input
                            type="text"
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value.toUpperCase())}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
                            placeholder="Nombre del producto (ej: AGUACATE)..."
                            className="w-full bg-[#242938] border border-black/20 rounded px-3 py-2.5 text-white text-xs focus:outline-none uppercase placeholder-gray-600 shrink-0"
                        />

                        {/* Category + Total row */}
                        <div className="flex gap-2 shrink-0">
                            <div className="flex-1 bg-[#242938] border border-black/20 rounded px-3 py-2 flex items-center gap-2">
                                <span className="text-gray-500 text-xs">📁</span>
                                <span className="text-gray-200 text-xs font-bold uppercase truncate">
                                    {selectedCategory || 'Seleccione Categoría'}
                                </span>
                            </div>
                            <div className="w-28 bg-[#242938] border border-indigo-500/30 rounded px-3 py-2 flex items-center gap-1">
                                <span className="text-indigo-400 font-bold text-xs">Q</span>
                                <span className="text-white text-xs font-black tabular-nums">{total.toFixed(2)}</span>
                            </div>
                        </div>



                        <div className="grid grid-cols-2 gap-3 shrink-0">
                            <button
                                onClick={onClose}
                                className="bg-[#3a4159] hover:bg-[#474f68] text-white py-3 rounded font-bold uppercase text-xs transition-colors border border-black/20"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveExpense}
                                disabled={items.length === 0 || !selectedCategory || loading}
                                className={`py-3 rounded font-bold uppercase text-xs transition-all border border-black/20 ${
                                    items.length > 0 && selectedCategory && !loading
                                        ? 'bg-[#6366f1] hover:bg-[#4f46e5] text-white'
                                        : 'bg-[#242938] text-gray-500 cursor-not-allowed opacity-50'
                                }`}
                            >
                                {loading ? '...' : 'ACEPTAR'}
                            </button>
                        </div>

                    </div>
                    {/* ══════════ END LEFT PANEL ══════════ */}

                    {/* ══════════ RIGHT PANEL: Numpad ══════════ */}
                    <div className="w-[300px] bg-[#3a4159] p-4 flex flex-col gap-3 ">

                        {/* Amount display — shows what you are typing */}
                        <div className="bg-[#242938] rounded p-4 text-right border-b-2 border-indigo-500/50  shrink-0">
                            <span className="text-3xl font-black text-white tabular-nums tracking-tighter">Q{itemPrice}</span>
                        </div>

                        {/* Number keys */}
                        <div className="grid grid-cols-3 gap-2 flex-1">
                            {['7','8','9','4','5','6','1','2','3'].map(k => (
                                <button
                                    key={k}
                                    onClick={() => handleKeyPad(k)}
                                    className="bg-[#474f68] hover:bg-[#525b7a] active:bg-[#6366f1] text-2xl font-bold text-white rounded transition-colors  border-b-2 border-black/20"
                                >
                                    {k}
                                </button>
                            ))}
                            <button onClick={() => handleKeyPad('0')} className="bg-[#474f68] hover:bg-[#525b7a] text-2xl font-bold text-white rounded  border-b-2 border-black/20">0</button>
                            <button onClick={() => handleKeyPad('.')} className="bg-[#474f68] hover:bg-[#525b7a] text-2xl font-bold text-white rounded  border-b-2 border-black/20">.</button>
                            <button onClick={() => handleKeyPad('BACKSPACE')} className="bg-[#474f68] hover:bg-rose-500 text-white rounded flex items-center justify-center  border-b-2 border-black/20">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                                    <line x1="18" y1="9" x2="12" y2="15"/>
                                    <line x1="12" y1="9" x2="18" y2="15"/>
                                </svg>
                            </button>
                        </div>

                        {/* AGREGAR button */}
                        <button
                            onClick={handleAddItem}
                            disabled={parseFloat(itemPrice) <= 0 || !selectedCategory}
                            className={`w-full h-14 rounded flex items-center justify-center gap-2 transition-all  font-black uppercase text-sm tracking-widest border-b-2 shrink-0 ${
                                parseFloat(itemPrice) > 0 && selectedCategory
                                    ? 'bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white border-emerald-700'
                                    : 'bg-[#242938] text-gray-600 cursor-not-allowed border-black/20'
                            }`}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            AGREGAR
                        </button>

                    </div>
                    {/* ══════════ END RIGHT PANEL ══════════ */}

                </div>

            </div>
        </div>
    );
};
