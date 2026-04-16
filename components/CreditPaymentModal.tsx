import React, { useState, useEffect } from 'react';
import { X, Search, User, CreditCard, Loader2, Receipt } from 'lucide-react';
import { supabase } from '../supabase';
import { QIcon } from './QIcon';

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
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
    const [description, setDescription] = useState('');
    const [processing, setProcessing] = useState(false);

    // Buscar clientes con deuda
    useEffect(() => {
        const searchCustomers = async () => {
            setLoading(true);
            try {
                let query = supabase
                    .from('receivables_summary')
                    .select('*')
                    .gt('saldo', 0); // Solo clientes con deuda

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

        const timer = setTimeout(() => {
            searchCustomers();
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handlePayment = async () => {
        if (!selectedCustomer || !amount) return;

        const paymentAmount = parseFloat(amount);
        if (paymentAmount <= 0) {
            alert('El monto debe ser mayor a 0');
            return;
        }

        if (paymentAmount > selectedCustomer.saldo) {
            alert('El abono no puede ser mayor al saldo pendiente');
            return;
        }

        const paymentId = crypto.randomUUID();
        const paymentData = {
            id: paymentId,
            customer_id: selectedCustomer.id,
            amount: paymentAmount,
            payment_method: paymentMethod,
            description: description || `Abono en Caja - ${paymentMethod}`,
            created_by: currentUserId,
            created_at: new Date().toISOString()
        };

        if (!navigator.onLine) {
            try {
                await import('../services/OfflineDB').then(m => m.offlineDB.saveRecord('CREDIT_PAYMENT', paymentData));
                console.log('📦 Abono guardado offline (IndexedDB):', paymentId);
                alert('✅ Abono registrado localmente (Offline). Se aplicará al reconectar.');
                onClose();
                window.dispatchEvent(new CustomEvent('offline-sync-trigger'));
                return;
            } catch (e) {
                console.error('Error saving credit payment offline:', e);
            }
        }

        setProcessing(true);
        try {
            const { data, error } = await supabase.rpc('register_credit_payment', {
                p_customer_id: selectedCustomer.id,
                p_amount: paymentAmount,
                p_payment_method: paymentMethod,
                p_description: description || `Abono en Caja - ${paymentMethod}`,
                p_created_by: currentUserId
            });

            if (error) throw error;

            const result = typeof data === 'string' ? JSON.parse(data) : data;

            if (!result.success) {
                throw new Error(result.error);
            }

            alert(`✅ Abono registrado correctamente\nNuevo saldo: Q${result.new_balance.toFixed(2)}`);
            onClose();

        } catch (error: any) {
            console.error('Error procesando pago:', error);
            // Fallback to offline
            await import('../services/OfflineDB').then(m => m.offlineDB.saveRecord('CREDIT_PAYMENT', paymentData));
            alert('⚠️ Error de conexión: El abono se guardó localmente y se sincronizará luego.');
            onClose();
            window.dispatchEvent(new CustomEvent('offline-sync-trigger'));
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-2xl bg-[#1a1f2e] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight uppercase">Abono a Crédito</h2>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Registrar pago de cliente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {!selectedCustomer ? (
                        /* SEARCH MODE */
                        <div className="space-y-6">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="BUSCAR POR NOMBRE O NIT..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-14 pl-12 pr-4 bg-black/20 border border-white/10 rounded-2xl text-white font-bold placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 transition-all uppercase"
                                    autoFocus
                                />
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin text-blue-500" size={32} />
                                </div>
                            ) : customers.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <User size={48} className="mx-auto mb-4 opacity-50" />
                                    <p className="font-bold">NO SE ENCONTRARON CLIENTES CON DEUDA</p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {customers.map((c) => (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedCustomer(c);
                                                setAmount(''); // Reset amount when selecting customer
                                            }}
                                            className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/30 rounded-2xl transition-all group text-left"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 group-hover:text-white">
                                                    <User size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-white uppercase">{c.customer_name}</h3>
                                                    {c.client_nit && (
                                                        <span className="text-xs font-bold text-gray-500 bg-black/30 px-2 py-0.5 rounded">NIT: {c.client_nit}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Saldo Pendiente</p>
                                                <p className="text-xl font-black text-red-400 group-hover:text-red-300">
                                                    Q{c.saldo.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* PAYMENT MODE */
                        <div className="space-y-6 animate-slide-up">
                            {/* Selected Customer Card */}
                            <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-3xl flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                        <User size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg text-white uppercase">{selectedCustomer.customer_name}</h3>
                                        <p className="text-xs font-bold text-blue-300">NIT: {selectedCustomer.client_nit || 'C/F'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedCustomer(null)}
                                    className="px-4 py-2 bg-black/20 hover:bg-black/40 rounded-xl text-xs font-black text-white uppercase tracking-widest transition-colors"
                                >
                                    Cambiar
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Saldo Actual</span>
                                    <span className="text-2xl font-black text-red-400 block">
                                        Q{selectedCustomer.saldo.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Nuevo Saldo</span>
                                    <span className={`text-2xl font-black block ${amount && parseFloat(amount) > selectedCustomer.saldo ? 'text-red-500' : 'text-emerald-400'}`}>
                                        Q{Math.max(0, selectedCustomer.saldo - (parseFloat(amount) || 0)).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Monto a Abonar</label>
                                    <div className="relative">
                                        <QIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full h-16 pl-12 pr-4 bg-black/30 border border-white/10 focus:border-emerald-500/50 rounded-2xl text-3xl font-black text-white placeholder:text-gray-700 outline-none transition-all"
                                            placeholder="0.00"
                                            autoFocus
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Método de Pago</label>
                                        <select
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                            className="w-full h-12 px-4 bg-black/30 border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-blue-500/30"
                                        >
                                            <option value="EFECTIVO">EFECTIVO</option>
                                            <option value="TARJETA">TARJETA</option>
                                            <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                                            <option value="CHEQUE">CHEQUE</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Nota (Opcional)</label>
                                        <input
                                            type="text"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="REFERENCIA..."
                                            className="w-full h-12 px-4 bg-black/30 border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-blue-500/30 placeholder:text-gray-600"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handlePayment}
                                disabled={!amount || parseFloat(amount) <= 0 || processing}
                                className="w-full h-16 mt-6 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-600 rounded-2xl text-white text-lg font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                            >
                                {processing ? (
                                    <Loader2 className="animate-spin" size={24} />
                                ) : (
                                    <>
                                        <Receipt size={24} />
                                        CONFIRMAR ABONO
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
