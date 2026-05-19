
import React, { useState, useEffect } from 'react';
import { Search, User, Phone, ChevronLeft, CreditCard, Plus, Check, Loader2, X, UserPlus } from 'lucide-react';
import { supabase } from '../supabase';
import { Customer, Order, POSTerminal } from '../types';
import { NewCreditCustomerModal } from './NewCreditCustomerModal';
import { printService } from '../services/PrintService';

interface CreditSelectorProps {
    order: Order;
    onSelect: (customer: Customer, creditAmount: number) => void;
    onBack: () => void;
    settings: any;
}

export const CreditSelector: React.FC<CreditSelectorProps> = ({ order, onSelect, onBack, settings }) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);

    const currency = settings?.currency || 'Q';
    
    // Cálculos de Descuento Autorizado
    const discountPercent = selectedCustomer?.authorized_discount || 0;
    const subtotal = order.subtotal || 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const tipAmount = (order as any).tip_amount || 0;
    
    // El total real para el crédito es solo (Subtotal - Descuento), excluyendo la propina
    const orderTotal = (subtotal - discountAmount);

    const newBalance = selectedCustomer ? selectedCustomer.current_balance + orderTotal : 0;
    const isOverLimit = selectedCustomer && selectedCustomer.credit_limit > 0 ? newBalance > selectedCustomer.credit_limit : false;

    const fetchCustomers = async () => {
        setLoading(true);
        const { data } = await supabase.from('customers').select('*').order('name');
        if (data) setCustomers(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) ||
        c.nit?.includes(search)
    );

    return (
        <div className="fixed inset-0 bg-[#0f1115] text-white flex flex-col font-sans z-[60] animate-fade-in">
            {/* HEADER */}
            <header className="h-16 bg-[#16191f] border-b border-white/5 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-6">
                    <button onClick={onBack} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                        <ChevronLeft size={24} />
                    </button>
                    <span className="text-sm font-black tracking-widest uppercase text-gray-400">RESTAURANTE LAS PALMAS POS</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400">Cuenta por Cobrar</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-indigo-400 font-black uppercase tracking-widest">Vale Al Crédito</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANEL: CUSTOMERS */}
                <div className="flex-1 flex flex-col border-r border-white/5 bg-[#16191f]/50">
                    <div className="p-4 bg-white/5 border-b border-white/5">
                        <div className="relative max-w-2xl mx-auto">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar cliente..."
                                className="w-full bg-[#1e212b] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold focus:border-indigo-500/50 outline-none transition-all placeholder:text-gray-600 uppercase"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {loading ? (
                                <div className="col-span-full flex items-center justify-center h-40">
                                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                                </div>
                            ) : filteredCustomers.map(customer => (
                                <button
                                    key={customer.id}
                                    onClick={() => setSelectedCustomer(customer)}
                                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col gap-2 group relative overflow-hidden min-h-[120px] ${selectedCustomer?.id === customer.id
                                        ? 'bg-indigo-600 border-indigo-400 shadow-xl shadow-indigo-600/30'
                                        : 'bg-[#1e212b] border-white/5 hover:bg-[#2b2f3a] hover:border-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedCustomer?.id === customer.id ? 'bg-white/20' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                            <User size={16} />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[11px] font-black uppercase truncate group-hover:text-white transition-colors leading-tight">
                                                {customer.name}
                                            </span>
                                            {customer.nit && (
                                                <span className={`text-[9px] font-bold uppercase tracking-widest ${selectedCustomer?.id === customer.id ? 'text-white/60' : 'text-gray-500'}`}>
                                                    NIT: {customer.nit}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-auto flex justify-between items-end">
                                        <div className="flex flex-col gap-0.5">
                                            <div className={`flex items-center gap-1.5 text-[9px] font-bold ${selectedCustomer?.id === customer.id ? 'text-white/60' : 'text-gray-500'}`}>
                                                <Phone size={10} />
                                                <span>{customer.phone || '---'}</span>
                                            </div>
                                            <div className={`text-xs font-black tabular-nums transition-colors ${selectedCustomer?.id === customer.id ? 'text-white' : (customer.current_balance > 0 ? 'text-amber-400' : 'text-emerald-400')}`}>
                                                {currency}{customer.current_balance.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>

                                    {selectedCustomer?.id === customer.id && (
                                        <div className="absolute top-2 right-2">
                                            <div className="bg-white/20 p-1 rounded-lg text-white">
                                                <Check size={14} />
                                            </div>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 flex justify-center pb-8">
                        <button
                            onClick={() => setShowNewCustomerModal(true)}
                            className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 flex items-center justify-center text-gray-400 transition-all hover:text-white hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-95"
                            title="Nuevo Cliente"
                        >
                            <UserPlus size={20} />
                        </button>
                    </div>
                </div>

                {/* RIGHT PANEL: SUMMARY */}
                <div className="w-[360px] bg-[#16191f] flex flex-col border-l border-white/5">
                    <div className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar">
                        <section>
                            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-600 mb-4">Cuenta por Cobrar</h3>
                            <div className="space-y-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400/80">Aplicar a:</label>
                                    <div className="h-12 flex items-center px-4 bg-white/5 rounded-xl border border-white/10 text-sm font-black uppercase">
                                        {selectedCustomer?.name || '---'}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Desc. Autorizado</label>
                                        <div className="text-xs font-black text-amber-500">{(selectedCustomer?.authorized_discount || 0).toFixed(2)} %</div>
                                    </div>
                                    <div className="flex flex-col gap-0.5 text-right">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Límite Crédito</label>
                                        <div className="text-xs font-black text-white">{currency}{(selectedCustomer?.credit_limit || 0).toFixed(2)}</div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-0.5 text-right">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600">Saldo Actual</label>
                                    <div className="text-sm font-black text-white/90">{currency}{(selectedCustomer?.current_balance || 0).toFixed(2)}</div>
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-white/5"></div>

                        <section>
                            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-600 mb-4">Datos Orden</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold text-gray-500">
                                    <span>SUB-TOTAL</span>
                                    <span>{currency}{order.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-gray-500">
                                    <span>DESCUENTO (-)</span>
                                    <span className={discountAmount > 0 ? "text-emerald-400" : ""}>{currency}{discountAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-gray-500">
                                    <span>PROPINA (+)</span>
                                    <span>{currency}{(order as any).tip_amount?.toFixed(2) || '0.00'}</span>
                                </div>
                                <div className="flex justify-between text-lg font-black text-white uppercase tracking-widest pt-1 border-t border-white/5">
                                    <span>TOTAL</span>
                                    <span>{currency}{orderTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-white/5"></div>

                        <section>
                            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-600 mb-4">Datos Crédito</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[11px] font-bold text-gray-600">
                                    <span>EFEC. TAR. OTROS. (-)</span>
                                    <span>{currency}0.00</span>
                                </div>
                                <div className="flex justify-between text-xs font-black text-amber-500 uppercase tracking-widest">
                                    <span>TOTAL AL CRÉDITO</span>
                                    <span>{currency}{orderTotal.toFixed(2)}</span>
                                </div>
                                <div className={`flex justify-between text-base font-black uppercase tracking-widest pt-2 border-t border-white/5 ${isOverLimit ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                                    <span>NUEVO SALDO</span>
                                    <span>{currency}{newBalance.toFixed(2)}</span>
                                </div>
                                {isOverLimit && (
                                    <div className="mt-1 text-[8px] font-black uppercase text-red-500 text-center tracking-widest">
                                        ⚠️ EL SALDO SUPERA EL LÍMITE DE CRÉDITO
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    <div className="p-6 pt-0">
                        <button
                            disabled={!selectedCustomer || isOverLimit}
                            onClick={async () => {
                                if (selectedCustomer) {
                                    // Imprimir Vale de Crédito antes de finalizar
                                    try {
                                        await printService.printCreditVoucher({
                                            orderNumber: (order as any).order_number || order.id.slice(0, 8),
                                            tableNumber: (order as any).table_number || '--',
                                            waiterName: (order as any).waiter_name || 'Caja',
                                            customerName: selectedCustomer.name,
                                            items: order.items || [],
                                            subtotal: subtotal,
                                            tipAmount: tipAmount,
                                            total: orderTotal + tipAmount, // El total de la orden con propina
                                            discountAmount: discountAmount,
                                            newBalance: newBalance,
                                            otherPaymentsAmount: 0
                                        });
                                    } catch (err) {
                                        console.error('Error imprimiendo vale:', err);
                                    }
                                    
                                    onSelect(selectedCustomer, orderTotal);
                                }
                            }}
                            className={`w-full h-16 rounded-2xl flex items-center justify-center text-lg font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl ${selectedCustomer && !isOverLimit
                                ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20'
                                : 'bg-white/5 text-gray-700 border border-white/10 cursor-not-allowed opacity-50'
                                }`}
                        >
                            ACEPTAR
                        </button>
                    </div>
                </div>
            </div>

            {showNewCustomerModal && (
                <NewCreditCustomerModal
                    onClose={() => setShowNewCustomerModal(false)}
                    onCustomerAdded={fetchCustomers}
                    settings={settings}
                />
            )}
        </div>
    );
};
