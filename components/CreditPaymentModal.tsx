import React, { useState, useEffect } from 'react';
import { X, Search, User, CreditCard, Loader2, Save, Banknote, CreditCard as CardIcon, Wallet, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '../supabase';
import { generateUUID } from '../utils/uuid';
import { printService } from '../services/PrintService';

interface CreditPaymentModalProps {
    onClose: () => void;
    currentUserId: string;
}

interface CustomerDebt {
    id: string;
    customer_name: string;
    client_nit: string;
    telephone: string;
    saldo: number;
    limite_credito: number;
}

export const CreditPaymentModal: React.FC<CreditPaymentModalProps> = ({ onClose, currentUserId }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState<CustomerDebt[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerDebt | null>(null);
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState('0.00');
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
    const [selectedProcessor, setSelectedProcessor] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [terminals, setTerminals] = useState<any[]>([]);
    const [showPosSelector, setShowPosSelector] = useState(false);

    // Buscar clientes con deuda
    useEffect(() => {
        const searchCustomers = async () => {
            setLoading(true);
            try {
                let query = supabase
                    .from('receivables_summary')
                    .select('*')
                    .gt('saldo', 0); 

                if (searchTerm) {
                    query = query.or(`customer_name.ilike.%${searchTerm}%,client_nit.ilike.%${searchTerm}%`);
                }

                const { data, error } = await query.limit(10);
                if (error) throw error;
                setCustomers(data || []);
            } catch (err) {
                console.error('Error buscando clientes:', err);
            } finally {
                setLoading(false);
            }
        };

        const fetchTerminals = async () => {
            const { data } = await supabase.from('pos_terminals').select('*').order('name');
            if (data) setTerminals(data);
        };
        fetchTerminals();

        const timer = setTimeout(() => {
            searchCustomers();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleKeypad = (val: string) => {
        if (val === 'DEL') {
            setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        } else if (val === '.') {
            if (!amount.includes('.')) setAmount(prev => prev + '.');
        } else {
            setAmount(prev => prev === '0' || prev === '0.00' ? val : prev + val);
        }
    };

    const handlePayment = async () => {
        if (!selectedCustomer || parseFloat(amount) <= 0) return;

        const paymentAmount = parseFloat(amount);
        if (paymentAmount > selectedCustomer.saldo) {
            alert('El abono no puede ser mayor al saldo pendiente');
            return;
        }

        const paymentData = {
            id: generateUUID(),
            customer_id: selectedCustomer.id,
            amount: paymentAmount,
            payment_method: paymentMethod,
            description: `Abono a Crédito - ${paymentMethod}${selectedProcessor ? ` (${selectedProcessor})` : ''}`,
            created_by: currentUserId,
            created_at: new Date().toISOString()
        };

        setProcessing(true);
        try {
            const { error } = await supabase.rpc('register_credit_payment', {
                p_customer_id: selectedCustomer.id,
                p_amount: paymentAmount,
                p_payment_method: paymentMethod,
                p_description: paymentData.description,
                p_created_by: currentUserId
            });
            if (error) throw error;

            // Imprimir Recibo de Abono
            try {
                await printService.printCreditPaymentReceipt({
                    customerName: selectedCustomer.customer_name,
                    previousBalance: selectedCustomer.saldo,
                    amountPaid: paymentAmount,
                    paymentMethod: paymentMethod,
                    newBalance: selectedCustomer.saldo - paymentAmount,
                    receivedBy: 'ADMINISTRACIÓN' // O podrías usar el nombre del usuario si lo tienes
                });
            } catch (printErr) {
                console.error('Error imprimiendo recibo:', printErr);
            }

            onClose();
        } catch (error: any) {
            console.error(error);
            alert('⚠️ Error al procesar el pago.');
        } finally {
            setProcessing(false);
        }
    };

    const calculateNewBalance = () => {
        if (!selectedCustomer) return 0;
        return Math.max(0, selectedCustomer.saldo - (parseFloat(amount) || 0));
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#282a36] flex flex-col font-sans select-none overflow-hidden">
            
            {/* Top Bar Personalizada */}
            <div className="h-[60px] flex items-center justify-between px-6 bg-[#21232d] border-b border-black/20 shrink-0">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={onClose}
                        className="h-10 px-4 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-gray-400 group transition-all"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <span className="text-sm font-black text-indigo-400 uppercase tracking-tighter">RESTAURANTE LAS PALMAS POS</span>
                </div>

                <div className="flex items-center gap-8">
                    <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-[#f8f8f2] uppercase">DANILO PEREZ</span>
                        <span className="text-[10px] font-bold text-[#50fa7b] uppercase tracking-widest">Abono A Créditos</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center gap-12 p-12 overflow-hidden">
                
                {/* COL 1: Cuentas por Cobrar (Trabajadores/Clientes) */}
                <div className="w-[360px] flex flex-col gap-4">
                    <div className="bg-[#383a59]/30 rounded-sm border border-white/5 overflow-hidden flex flex-col h-[480px]">
                        <div className="p-2 border-b border-white/5 text-center bg-[#383a59]/50 shrink-0">
                            <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">Cuentas por Cobrar</span>
                        </div>
                        <div className="p-3 bg-black/10 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                                <input
                                    type="text"
                                    placeholder=""
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded h-9 pl-9 pr-4 text-xs font-bold text-white uppercase focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-black/10">
                            {loading ? (
                                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-600" size={20} /></div>
                            ) : customers.length === 0 ? (
                                <div className="py-8 text-center text-[10px] uppercase font-bold text-gray-700">Sin resultados</div>
                            ) : customers.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedCustomer(c)}
                                    className={`w-full p-3 rounded-sm border transition-all text-left ${
                                        selectedCustomer?.id === c.id 
                                        ? 'bg-[#383a59] border-[#6272a4] shadow-lg' 
                                        : 'bg-[#282a36]/50 border-transparent hover:bg-[#383a59]/30'
                                    }`}
                                >
                                    <div className="text-[10px] font-black text-gray-200 uppercase truncate">{c.customer_name}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* COL 2: El Ticket */}
                <div className="w-[320px] h-[480px] bg-[#44475a] shadow-2xl relative flex flex-col">
                    <div className="p-8 flex-1 space-y-4">
                        <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-gray-200 uppercase tracking-wider">Saldo Actual</span>
                            <span className="text-white">Q{selectedCustomer?.saldo.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-gray-200 uppercase tracking-wider">Efectivo</span>
                            <span className="text-white">Q{paymentMethod === 'EFECTIVO' ? parseFloat(amount).toFixed(2) : '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-gray-200 uppercase tracking-wider">Tarjeta</span>
                            <span className="text-white">Q{paymentMethod === 'TARJETA' ? parseFloat(amount).toFixed(2) : '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-bold border-b border-white/10 pb-4">
                            <span className="text-gray-200 uppercase tracking-wider">Otros</span>
                            <span className="text-white">Q{paymentMethod === 'OTROS' ? parseFloat(amount).toFixed(2) : '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-[12px] font-black text-white uppercase">Saldo Nuevo</span>
                            <span className="text-[12px] font-black text-white uppercase tracking-tight">Q{calculateNewBalance().toFixed(2)}</span>
                        </div>
                    </div>
                    {/* Zigzag bottom effect */}
                    <div className="h-4 bg-[#44475a] shrink-0" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 95% 75%, 90% 100%, 85% 75%, 80% 100%, 75% 75%, 70% 100%, 65% 75%, 60% 100%, 55% 75%, 50% 100%, 45% 75%, 40% 100%, 35% 75%, 30% 100%, 25% 75%, 20% 100%, 15% 75%, 10% 100%, 5% 75%, 0% 100%)' }}></div>
                </div>

                {/* COL 3: Cobro Proporcionado */}
                <div className="flex flex-col gap-4">
                    {/* Display */}
                    <div className="w-[360px] bg-[#21222c] border border-white/5 p-4 text-center rounded-sm">
                        <span className="text-2xl font-black text-white tracking-widest">Q{amount}</span>
                    </div>

                    <div className="flex gap-3">
                        {/* Keypad Ajustado */}
                        <div className="w-[280px] grid grid-cols-3 gap-1 bg-[#44475a]/20 p-1 rounded-sm border border-white/5">
                            {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => (
                                <button 
                                    key={n} 
                                    onClick={() => handleKeypad(n.toString())}
                                    className="h-16 bg-[#282a36]/80 hover:bg-[#44475a] text-sm font-black text-white transition-all flex items-center justify-center rounded-sm"
                                >
                                    {n}
                                </button>
                            ))}
                            <button onClick={() => handleKeypad('DEL')} className="h-16 bg-[#282a36]/80 hover:bg-[#ff5555]/20 flex items-center justify-center text-gray-500 rounded-sm">
                                <DeleteIcon size={18} />
                            </button>
                            <button onClick={() => handleKeypad('0')} className="h-16 bg-[#282a36]/80 hover:bg-[#44475a] text-sm font-black text-white flex items-center justify-center rounded-sm">0</button>
                            <button onClick={() => handleKeypad('.')} className="h-16 bg-[#282a36]/80 hover:bg-[#44475a] text-sm font-black text-white flex items-center justify-center rounded-sm">.</button>
                        </div>

                        {/* Métodos Íconos */}
                        <div className="flex flex-col gap-1 w-[70px]">
                            <button 
                                onClick={() => {
                                    setPaymentMethod('EFECTIVO');
                                    setSelectedProcessor(null); // Limpiar procesador
                                    if (selectedCustomer && (amount === '0.00' || amount === '0')) {
                                        setAmount(selectedCustomer.saldo.toFixed(2));
                                    }
                                }}
                                className={`flex-1 flex flex-col items-center justify-center rounded-sm border transition-all gap-1 ${
                                    paymentMethod === 'EFECTIVO' ? 'bg-[#383a59] border-blue-500/50 text-white' : 'bg-[#282a36]/80 border-white/5 text-gray-500'
                                }`}
                            >
                                <Banknote size={16} />
                                <span className="text-[8px] font-bold uppercase">Efectivo</span>
                            </button>
                             <button 
                                onClick={() => {
                                    setPaymentMethod('TARJETA');
                                    if (selectedCustomer && (amount === '0.00' || amount === '0')) {
                                        setAmount(selectedCustomer.saldo.toFixed(2));
                                    }
                                    setShowPosSelector(true);
                                }}
                                className={`flex-1 flex flex-col items-center justify-center rounded-sm border transition-all gap-1 ${
                                    paymentMethod === 'TARJETA' ? 'bg-[#383a59] border-blue-500/50 text-white' : 'bg-[#282a36]/80 border-white/5 text-gray-500'
                                }`}
                            >
                                <CardIcon size={16} />
                                <span className="text-[8px] font-bold uppercase">Tarjeta</span>
                                {selectedProcessor && <span className="text-[7px] text-blue-400 font-black">{selectedProcessor}</span>}
                            </button>
                             <button 
                                onClick={() => {
                                    setPaymentMethod('OTROS');
                                    setSelectedProcessor(null); // Limpiar procesador
                                    if (selectedCustomer && (amount === '0.00' || amount === '0')) {
                                        setAmount(selectedCustomer.saldo.toFixed(2));
                                    }
                                }}
                                className={`flex-1 flex flex-col items-center justify-center rounded-sm border transition-all gap-1 ${
                                    paymentMethod === 'OTROS' ? 'bg-[#383a59] border-blue-500/50 text-white' : 'bg-[#282a36]/80 border-white/5 text-gray-500'
                                }`}
                            >
                                <Wallet size={16} />
                                <span className="text-[8px] font-bold uppercase">Otros</span>
                            </button>
                        </div>
                    </div>

                    <button 
                        onClick={handlePayment}
                        disabled={!selectedCustomer || parseFloat(amount) <= 0 || processing}
                        className={`w-full h-12 rounded-sm font-black uppercase text-xs tracking-widest transition-all ${
                            !selectedCustomer || parseFloat(amount) <= 0 
                            ? 'bg-[#44475a] text-gray-600' 
                            : 'bg-[#6272a4] hover:bg-[#7282b4] text-white shadow-lg'
                        }`}
                    >
                        {processing ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'PAGAR'}
                    </button>
                </div>

            </div>

            {/* Selector de POS Modal */}
            {showPosSelector && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-[#1e212b] w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Seleccione POS</h3>
                            <button onClick={() => setShowPosSelector(false)} className="p-2 bg-white/5 rounded-full text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {terminals.map(pos => (
                                <button
                                    key={pos.id}
                                    onClick={() => {
                                        setSelectedProcessor(pos.name);
                                        setShowPosSelector(false);
                                    }}
                                    className={`p-6 bg-white rounded-2xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 border-4 ${selectedProcessor === pos.name ? 'border-blue-500 shadow-xl' : 'border-transparent shadow-md'}`}
                                >
                                    {pos.logo_url ? (
                                        <img src={pos.logo_url} alt={pos.name} className="h-12 object-contain" />
                                    ) : (
                                        <CreditCard size={32} className="text-gray-400" />
                                    )}
                                    <span className="text-[10px] font-black text-black uppercase tracking-widest">{pos.name}</span>
                                </button>
                            ))}
                        </div>
                        <div className="p-6 bg-[#0d0f13] border-t border-white/5">
                            <button
                                onClick={() => setShowPosSelector(false)}
                                className="w-full h-14 rounded-2xl border border-white/10 bg-white/5 font-black uppercase text-[11px] text-gray-500 hover:text-white"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {processing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                        <span className="text-xs font-black uppercase tracking-widest text-white/40">Procesando Pago...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const DeleteIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
        <line x1="18" y1="9" x2="12" y2="15"></line>
        <line x1="12" y1="9" x2="18" y2="15"></line>
    </svg>
);

