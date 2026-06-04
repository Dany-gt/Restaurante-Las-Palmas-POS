import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Receipt, Plus, User, Loader2, X, Trash2, Clock, AlertTriangle,
    CheckCircle, Phone, CreditCard, TrendingUp, Eye, FileText,
    Search, Edit, ToggleLeft, ToggleRight, Hash, Mail, MapPin,
    Check, RefreshCw, MoreVertical, Trash
} from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { QIcon } from '../QIcon';
import { WindowsSaveButton } from '../WindowsSaveButton';

interface ReceivableAccount {
    id: string;
    customer_name: string;
    client_nit: string;
    telephone: string;
    limite_credito: number;
    descuento: number;
    saldo: number;
    email: string;
    address: string;
    fecha_registro: string;
    total_cargos: number;
    total_pagos: number;
    total_vendido: number;
    total_abonado: number;
    ultimo_pago: string;
    ultimo_cargo: string;
    is_active?: boolean;
}

export const ConfigReceivable: React.FC = () => {
    const [accounts, setAccounts] = useState<ReceivableAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<ReceivableAccount | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, account: ReceivableAccount | null } | null>(null);

    // New Customer Modal States
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<ReceivableAccount | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [customerForm, setCustomerForm] = useState({
        name: '',
        nit: 'CF',
        phone: '',
        email: '',
        address: 'CIUDAD',
        credit_limit: 0,
        authorized_discount: 0,
        is_active: true
    });

    const [paymentForm, setPaymentForm] = useState({
        amount: '',
        payment_method: 'EFECTIVO',
        description: ''
    });

    // Obtener usuario actual
    useEffect(() => {
        const loadUser = async () => {
            const { data } = await supabase.from('profiles').select('*').limit(1).single();
            if (data) setCurrentUser(data);
        };
        loadUser();
    }, []);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const { data: summaryData, error: summaryErr } = await supabase
                .from('receivables_summary')
                .select('*');

            if (summaryErr) throw summaryErr;

            // Fetch active status from customers table
            const { data: customersData, error: custErr } = await supabase
                .from('customers')
                .select('id, is_active');

            if (custErr) throw custErr;

            const activeMap = new Map(customersData?.map(c => [c.id, c.is_active]));

            const merged = (summaryData || []).map((acc: any) => ({
                ...acc,
                is_active: activeMap.has(acc.id) ? activeMap.get(acc.id) : true
            }));

            setAccounts(merged);
        } catch (err) {
            console.error('Error fetching receivables:', err);
            alert('Error al cargar cuentas por cobrar.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();

        // Suscribirse a cambios en tiempo real
        const subscription = supabase
            .channel('receivables_changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'credit_transactions' },
                () => {
                    fetchAccounts();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('customers')
                .update({ is_active: !currentStatus })
                .eq('id', id);
            if (error) throw error;
            fetchAccounts();
        } catch (err: any) {
            alert('Error al actualizar estado: ' + err.message);
        }
    };

    const handleSaveCustomer = async () => {
        if (!customerForm.name || customerForm.credit_limit < 0) {
            alert('Por favor completa los campos requeridos y el límite no puede ser negativo.');
            return;
        }

        setIsSaving(true);
        try {
            if (editingCustomer) {
                const { error } = await supabase
                    .from('customers')
                    .update({
                        name: customerForm.name.toUpperCase(),
                        nit: customerForm.nit.toUpperCase(),
                        phone: customerForm.phone,
                        email: customerForm.email,
                        address: customerForm.address.toUpperCase(),
                        credit_limit: customerForm.credit_limit,
                        authorized_discount: customerForm.authorized_discount,
                        is_active: customerForm.is_active
                    })
                    .eq('id', editingCustomer.id);
                if (error) throw error;
                alert('Cliente actualizado exitosamente.');
            } else {
                const { error } = await supabase
                    .from('customers')
                    .insert([{
                        name: customerForm.name.toUpperCase(),
                        nit: customerForm.nit.toUpperCase(),
                        phone: customerForm.phone,
                        email: customerForm.email,
                        address: customerForm.address.toUpperCase(),
                        credit_limit: customerForm.credit_limit,
                        authorized_discount: customerForm.authorized_discount,
                        is_active: customerForm.is_active,
                        current_balance: 0
                    }]);
                if (error) throw error;
                alert('Cliente creado exitosamente.');
            }
            setShowCustomerModal(false);
            fetchAccounts();
        } catch (err: any) {
            alert('Error al guardar el cliente: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCustomer = async (id: string, name: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente al cliente "${name}"?\nEsta acción no se puede deshacer y fallará si el cliente ya tiene transacciones o pagos registrados.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', id);

            if (error) throw error;

            alert('Cliente eliminado exitosamente.');
            fetchAccounts();
        } catch (err: any) {
            console.error('Error deleting customer:', err);
            alert('No se pudo eliminar el cliente. Es probable que tenga historial de transacciones o pagos asociados.\n\nEn ese caso, te recomendamos usar el botón de "Habilitado" para desactivarlo y evitar que siga apareciendo.\n\nDetalle técnico: ' + err.message);
        }
    };

    const openCreateModal = () => {
        setEditingCustomer(null);
        setCustomerForm({ name: '', nit: 'CF', phone: '', email: '', address: 'CIUDAD', credit_limit: 0, authorized_discount: 0, is_active: true });
        setShowCustomerModal(true);
    };

    const openEditModal = (acc: ReceivableAccount) => {
        setEditingCustomer(acc);
        setCustomerForm({
            name: acc.customer_name,
            nit: acc.client_nit || 'CF',
            phone: acc.telephone || '',
            email: acc.email || '',
            address: acc.address || 'CIUDAD',
            credit_limit: parseFloat(acc.limite_credito.toString()),
            authorized_discount: parseFloat(acc.descuento?.toString() || '0'),
            is_active: acc.is_active ?? true
        });
        setShowCustomerModal(true);
    };

    const handlePayment = async () => {
        if (!selectedAccount || !paymentForm.amount || !currentUser) return;
        setLoading(true);
        try {
            const paymentAmount = parseFloat(paymentForm.amount);

            if (paymentAmount <= 0) {
                alert('El monto debe ser mayor a 0');
                return;
            }

            if (paymentAmount > selectedAccount.saldo) {
                alert('El abono no puede ser mayor al saldo pendiente');
                return;
            }

            // Llamar a la función de base de datos para registrar el pago
            const { data, error } = await supabase.rpc('register_credit_payment', {
                p_customer_id: selectedAccount.id,
                p_amount: paymentAmount,
                p_payment_method: paymentForm.payment_method,
                p_description: paymentForm.description || `Abono - ${paymentForm.payment_method}`,
                p_created_by: currentUser.id
            });

            if (error) throw error;

            const result = typeof data === 'string' ? JSON.parse(data) : data;

            if (!result.success) {
                alert('Error: ' + result.error);
                return;
            }

            alert(`✅ Pago registrado exitosamente\n\nSaldo anterior: Q${result.previous_balance.toFixed(2)}\nAbono: Q${result.payment_amount.toFixed(2)}\nNuevo saldo: Q${result.new_balance.toFixed(2)}`);

            setShowPaymentModal(false);
            setPaymentForm({ amount: '', payment_method: 'EFECTIVO', description: '' });
            setSelectedAccount(null);
            fetchAccounts();
        } catch (error: any) {
            console.error('Payment error:', error);
            alert('Error al registrar pago: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const loadTransactionHistory = async (customerId: string) => {
        try {
            const { data, error } = await supabase
                .from('receivables_transactions_detail')
                .select('*')
                .eq('customer_id', customerId)
                .order('fecha_transaccion', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (err) {
            console.error('Error loading transactions:', err);
        }
    };

    const openDetailModal = async (account: ReceivableAccount) => {
        setSelectedAccount(account);
        await loadTransactionHistory(account.id);
        setShowDetailModal(true);
    };

    const filteredAccounts = accounts.filter(acc =>
        acc.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (acc.client_nit && acc.client_nit.includes(searchTerm))
    );

    const totalInStreet = accounts.reduce((sum, acc) => sum + parseFloat(acc.saldo.toString() || '0'), 0);
    const activeCount = accounts.filter(a => a.saldo > 0).length;
    const totalCreditLimit = accounts.reduce((sum, acc) => sum + parseFloat(acc.limite_credito.toString() || '0'), 0);

    const handleContextMenu = (e: React.MouseEvent, account: ReceivableAccount | null) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            account
        });
    };

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    useEffect(() => {
        window.addEventListener('click', closeContextMenu);
        return () => window.removeEventListener('click', closeContextMenu);
    }, [closeContextMenu]);

    return (
        <div
            className="p-4 animate-fade-in w-full h-full flex flex-col relative overflow-hidden bg-[#f0f0f0] text-slate-900"
            onContextMenu={(e) => handleContextMenu(e, null)}
        >
            {/* Ribbon Search & Actions */}
            <div className="flex flex-col md:flex-row items-center justify-between font-sans shrink-0 border-b border-gray-300">
                <div className="flex items-center w-full md:w-auto">
                    <div className="flex items-center px-4 py-2 text-[11px] font-sans border-r border-gray-300 bg-gray-50 text-slate-700">
                        <span>Sucursal</span>
                        <select className="ml-2 bg-white border border-gray-300 px-1 py-0.5 min-w-[280px] text-[11px] outline-none">
                            <option>Cevicheria y Rest. Las Palmas</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-2 p-1">
                    <div className="relative w-64">
                        <input
                            type="text"
                            placeholder="Introduzca el texto a buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-300 focus:border-[#106ebe] px-2 py-1 text-[11px] outline-none pr-12"
                        />
                        <button className="absolute right-0 top-0 bottom-0 px-4 bg-[#106ebe] text-white border-l border-[#002244] text-[10px] font-medium hover:bg-[#002244] uppercase transition-colors">
                            Buscar
                        </button>
                    </div>
                </div>
            </div>

            {/* Data Grid Table */}
            <div className="flex-1 bg-white overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full min-w-[1000px] border-collapse relative text-[11px] font-sans">
                        <thead className="bg-[#e8e8e8] sticky top-0 z-10 select-none">
                            <tr className="border-b border-gray-400 h-8">
                                <th className="text-left px-3 font-medium border-r border-gray-300 text-black uppercase text-[10px]">Nombre</th>
                                <th className="text-left px-3 font-medium border-r border-gray-300 text-black uppercase text-[10px]">Correo</th>
                                <th className="text-left px-3 font-medium border-r border-gray-300 text-black uppercase text-[10px]">Teléfono</th>
                                <th className="text-left px-3 font-medium border-r border-gray-300 text-black uppercase text-[10px]">Límite de Crédito</th>
                                <th className="text-left px-3 font-medium border-r border-gray-300 text-black uppercase text-[10px]">Descuento</th>
                                <th className="text-left px-3 font-medium border-r border-gray-300 text-black uppercase text-[10px]">Saldo</th>
                                <th className="text-center px-3 font-medium text-black uppercase text-[10px]">Habilitado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredAccounts.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            {loading ? <Loader2 size={24} className="animate-spin mb-2" /> : <Receipt size={24} className="mb-2 opacity-30" />}
                                            <p className="text-[10px] uppercase font-medium">{loading ? 'Cargando datos...' : 'No se encontraron clientes'}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAccounts.map(acc => (
                                    <tr
                                        key={acc.id}
                                        onClick={() => setSelectedAccount(acc)}
                                        className={`h-6 transition-colors cursor-default relative border-b border-gray-50 select-none ${selectedAccount?.id === acc.id
                                            ? 'bg-[#106ebe] text-white'
                                            : 'text-slate-900 even:bg-white odd:bg-[#fafafa] hover:bg-[#f2f7fb]'
                                            }`}
                                        onContextMenu={(e) => handleContextMenu(e, acc)}
                                        onDoubleClick={() => openEditModal(acc)}
                                    >
                                        <td className="px-3 border-r border-gray-100 truncate">{acc.customer_name}</td>
                                        <td className="px-3 border-r border-gray-100 truncate">{acc.email || ''}</td>
                                        <td className="px-3 border-r border-gray-100 truncate">{acc.telephone || ''}</td>
                                        <td className="px-3 border-r border-gray-100 text-right pr-12 font-mono">Q{parseFloat(acc.limite_credito.toString() || '0').toFixed(2)}</td>
                                        <td className="px-3 border-r border-gray-100 text-right pr-12 font-mono">{parseFloat(acc.descuento?.toString() || '0').toFixed(2)}%</td>
                                        <td className="px-3 border-r border-gray-100 text-right pr-12 font-mono">Q{parseFloat(acc.saldo.toString() || '0').toFixed(2)}</td>
                                        <td className="px-3">
                                            <div className="flex justify-center items-center h-full">
                                                <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${acc.is_active ? (selectedAccount?.id === acc.id ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                    {acc.is_active && <Check size={10} strokeWidth={4} />}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Context Menu Portal */}
            {contextMenu && createPortal(
                <div
                    className="fixed z-[1000001] bg-white border border-gray-400 shadow-[2px_2px_4px_rgba(0,0,0,0.2)] w-44 animate-in fade-in duration-75 select-none"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <div className="py-1 flex flex-col font-sans">
                        <button onClick={openCreateModal} className="w-full text-left px-3 py-1.5 hover:bg-[#106ebe] hover:text-white text-[11px] text-slate-800 flex items-center gap-3 group transition-colors">
                            <Plus size={14} className="group-hover:text-white text-slate-600" />
                            <span>Nuevo</span>
                        </button>

                        {contextMenu.account && (
                            <>
                                <div className="my-0.5 border-t border-gray-200 mx-1"></div>
                                <button onClick={() => openEditModal(contextMenu.account!)} className="w-full text-left px-3 py-1.5 hover:bg-[#106ebe] hover:text-white text-[11px] text-slate-800 flex items-center gap-3 group transition-colors">
                                    <Edit size={14} className="group-hover:text-white text-slate-600" />
                                    <span>Editar</span>
                                </button>
                                <button onClick={() => handleDeleteCustomer(contextMenu.account!.id, contextMenu.account!.customer_name)} className="w-full text-left px-3 py-1.5 hover:bg-[#106ebe] hover:text-white text-[11px] text-slate-800 flex items-center gap-3 group transition-colors">
                                    <Trash size={14} className="group-hover:text-white text-slate-600" />
                                    <span>Eliminar</span>
                                </button>
                                <div className="my-0.5 border-t border-gray-200 mx-1"></div>
                                <button onClick={() => openDetailModal(contextMenu.account!)} className="w-full text-left px-3 py-1.5 hover:bg-[#106ebe] hover:text-white text-[11px] text-slate-800 flex items-center gap-3 group transition-colors">
                                    <FileText size={14} className="group-hover:text-white text-slate-600" />
                                    <span>Estado de Cuenta</span>
                                </button>
                            </>
                        )}

                        <div className="my-0.5 border-t border-gray-200 mx-1"></div>
                        <button onClick={fetchAccounts} className="w-full text-left px-3 py-1.5 hover:bg-[#106ebe] hover:text-white text-[11px] text-slate-800 flex items-center gap-3 group transition-colors">
                            <RefreshCw size={14} className="group-hover:text-white text-slate-600" />
                            <span>Refrescar</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}


            {/* Payment Modal */}
            {showPaymentModal && selectedAccount && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[1000001] flex items-center justify-center p-6 bg-black/20 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[450px] bg-[#f0f0f0] border border-[#106ebe] shadow-[0_0_30px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col animate-slide-up">
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <CreditCard size={14} className="text-white" />
                                    <span className="text-white text-[11px] font-medium tracking-wide uppercase">Registrar Abono</span>
                                </div>
                                <div className="flex items-center">
                                    <WindowsSaveButton
                                        onClick={handlePayment}
                                        loading={loading}
                                        title="Registrar Pago"
                                        variant="minimal"
                                    />
                                    <button onClick={() => { setShowPaymentModal(false); setSelectedAccount(null); }} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" title="Cerrar">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 space-y-4">
                                <div className="bg-white p-3 border border-gray-300 shadow-inner">
                                    <span className="text-[9px] font-medium text-slate-500 uppercase tracking-tight block mb-1">Saldo Pendiente actual</span>
                                    <span className="text-xl font-semibold text-rose-600">Q{parseFloat(selectedAccount.saldo.toString()).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                                </div>

                                <div className="grid grid-cols-[100px_1fr] items-center gap-y-3 gap-x-4">
                                    <label className="text-[10px] font-medium text-slate-700 uppercase">Monto Abono:</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-xs">Q</span>
                                        <input
                                            value={paymentForm.amount}
                                            onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-white border border-gray-300 rounded-none px-3 pl-7 h-8 text-[11px] text-slate-800 font-medium focus:border-[#106ebe] outline-none"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <label className="text-[10px] font-medium text-slate-700 uppercase">Método:</label>
                                    <select
                                        value={paymentForm.payment_method}
                                        onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-none px-3 h-8 text-[11px] text-slate-800 font-medium focus:border-[#106ebe] outline-none appearance-none"
                                    >
                                        <option value="EFECTIVO">EFECTIVO</option>
                                        <option value="TARJETA">TARJETA</option>
                                        <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                                        <option value="CHEQUE">CHEQUE</option>
                                    </select>

                                    <label className="text-[10px] font-medium text-slate-700 uppercase">Descripción:</label>
                                    <input
                                        value={paymentForm.description}
                                        onChange={e => setPaymentForm({ ...paymentForm, description: e.target.value })}
                                        type="text"
                                        className="w-full bg-white border border-gray-300 rounded-none px-3 h-8 text-[11px] text-slate-800 font-medium focus:border-[#106ebe] outline-none"
                                        placeholder="Referencia o nota..."
                                    />
                                </div>
                            </div>

                            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2 shrink-0">
                                <button
                                    onClick={() => { setShowPaymentModal(false); setSelectedAccount(null); }}
                                    className="px-4 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-slate-700 text-[11px] font-medium uppercase"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handlePayment}
                                    disabled={!paymentForm.amount || loading}
                                    className="px-6 py-1.5 bg-[#155724] hover:bg-[#1e7e34] text-white text-[11px] font-medium uppercase shadow-sm disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                                    Registrar Pago
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* Customer Creation/Edit Modal */}
            {showCustomerModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[1000001] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[600px] bg-[#f0f0f0] border border-[#106ebe] shadow-[0_4px_20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col animate-slide-up">
                            {/* Title Bar */}
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <span className="text-white text-[11px] font-medium tracking-tight uppercase">Mantenimiento de Cuentas por Cobrar</span>
                                <div className="flex items-center gap-1">
                                    <WindowsSaveButton
                                        onClick={handleSaveCustomer}
                                        loading={isSaving}
                                        title="Guardar"
                                        variant="minimal"
                                    />
                                    <button onClick={() => setShowCustomerModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" title="Cerrar">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="p-4 bg-white m-4 border border-gray-300">
                                <div className="text-[#106ebe] text-[12px] font-medium mb-3 border-b border-gray-100 pb-1 flex items-center gap-2 uppercase tracking-wide">
                                    Datos de Cuenta Corriente
                                </div>

                                <div className="grid grid-cols-[100px_1fr] items-center gap-y-2 gap-x-4">
                                    <label className="text-[11px] text-gray-600">Nombre</label>
                                    <input
                                        type="text"
                                        value={customerForm.name}
                                        onChange={e => setCustomerForm({ ...customerForm, name: e.target.value.toUpperCase() })}
                                        className="w-full bg-[#e8f2ff] border border-gray-300 px-2 h-6 text-[11px] font-medium outline-none focus:border-[#106ebe] uppercase"
                                    />

                                    <label className="text-[11px] text-gray-600">Direccion</label>
                                    <input
                                        type="text"
                                        value={customerForm.address}
                                        onChange={e => setCustomerForm({ ...customerForm, address: e.target.value.toUpperCase() })}
                                        className="w-full border border-gray-300 px-2 h-6 text-[11px] outline-none focus:border-[#106ebe] uppercase"
                                    />

                                    <label className="text-[11px] text-gray-600">Correo</label>
                                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                                        <input
                                            type="email"
                                            value={customerForm.email}
                                            onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })}
                                            className="w-full border border-gray-300 px-2 h-6 text-[11px] outline-none focus:border-[#106ebe]"
                                        />
                                        <label className="text-[11px] text-gray-600">Teléfono</label>
                                        <input
                                            type="text"
                                            value={customerForm.phone}
                                            onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                                            className="w-full border border-gray-300 px-2 h-6 text-[11px] outline-none focus:border-[#106ebe]"
                                        />
                                    </div>

                                    <label className="text-[11px] text-gray-600">Límite de Crédito</label>
                                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                                        <div className="relative flex items-center">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={customerForm.credit_limit}
                                                onChange={e => setCustomerForm({ ...customerForm, credit_limit: parseFloat(e.target.value) || 0 })}
                                                className="w-full border border-gray-300 px-8 h-6 text-[11px] text-right outline-none focus:border-[#106ebe]"
                                            />
                                            <span className="absolute left-2 text-[10px] text-gray-400">Q</span>
                                        </div>
                                        <label className="text-[11px] text-gray-600">Descuento</label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={customerForm.authorized_discount}
                                                onChange={e => setCustomerForm({ ...customerForm, authorized_discount: parseFloat(e.target.value) || 0 })}
                                                className="w-full border border-gray-300 px-2 h-6 text-[11px] text-right outline-none focus:border-[#106ebe] pr-6"
                                            />
                                            <span className="absolute right-2 text-[10px] text-gray-400">%</span>
                                        </div>
                                    </div>

                                    <label className="text-[11px] text-gray-600">Sucursal</label>
                                    <div className="flex items-center gap-4">
                                        <select className="flex-1 bg-white border border-gray-300 px-1 py-0.5 text-[11px] outline-none min-w-[280px]">
                                            <option>Cevicheria y Rest. Las Palmas</option>
                                        </select>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="checkbox"
                                                id="chkHabilitado"
                                                checked={customerForm.is_active}
                                                onChange={() => setCustomerForm({ ...customerForm, is_active: !customerForm.is_active })}
                                                className="w-3 h-3 accent-[#106ebe]"
                                            />
                                            <label htmlFor="chkHabilitado" className="text-[11px] text-gray-600 cursor-pointer">Habilitado</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}


            {/* Detail Modal - Transaction History */}
            {/* Detail Modal - Transaction History */}
            {showDetailModal && selectedAccount && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[1000001] flex items-center justify-center p-4 bg-black/10 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[1050px] bg-[#f0f0f0] border border-[#106ebe] shadow-[0_4px_30px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col animate-slide-up max-h-[95vh]">
                            {/* Title Bar */}
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <FileText size={14} className="text-white" />
                                    <span className="text-white text-[11px] font-medium tracking-tight uppercase">Movimientos de Cuenta</span>
                                </div>
                                <button onClick={() => { setShowDetailModal(false); setSelectedAccount(null); }} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" title="Cerrar">
                                    <X size={18} strokeWidth={2.5} />
                                </button>
                            </div>

                            <div className="p-4 flex flex-col gap-4 overflow-hidden">
                                {/* Filter & Info Section */}
                                <div className="grid grid-cols-[1fr_350px] gap-4">
                                    <fieldset className="border border-gray-300 p-4 pt-2 bg-white">
                                        <legend className="px-2 text-[10px] font-medium text-gray-700 uppercase">Datos</legend>
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-y-2 gap-x-4">
                                            <label className="text-[11px] font-medium text-slate-800">Nombre:</label>
                                            <div className="border border-gray-400 px-2 h-5 text-[11px] font-medium flex items-center uppercase text-black bg-white">{selectedAccount.customer_name}</div>

                                            <label className="text-[11px] font-medium text-slate-800">Teléfono:</label>
                                            <div className="border border-gray-400 px-2 h-5 text-[11px] font-medium flex items-center uppercase text-black bg-white">{selectedAccount.telephone || ''}</div>

                                            <label className="text-[11px] font-medium text-slate-800">Límite de Crédito:</label>
                                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                                                <div className="border border-gray-400 px-2 h-5 text-[11px] font-medium flex items-center justify-end font-mono text-black bg-white">Q{parseFloat(selectedAccount.limite_credito.toString()).toFixed(2)}</div>
                                                <label className="text-[11px] font-medium text-slate-800">Descuento Autorizado:</label>
                                                <div className="border border-gray-400 px-2 h-5 text-[11px] font-medium flex items-center justify-end font-mono text-black bg-white">{parseFloat(selectedAccount.descuento?.toString() || '0').toFixed(2)}%</div>
                                            </div>
                                        </div>
                                    </fieldset>

                                    <fieldset className="border border-gray-300 p-4 pt-2 bg-white">
                                        <legend className="px-2 text-[10px] font-medium text-gray-700 uppercase">Fechas</legend>
                                        <div className="grid grid-cols-[40px_1fr] items-center gap-y-2 gap-x-2">
                                            <label className="text-[11px] font-medium text-black">Del:</label>
                                            <input type="date" className="w-full border border-gray-400 px-2 h-6 text-[11px] font-medium outline-none text-black bg-white" defaultValue={new Date().toISOString().split('T')[0]} />

                                            <label className="text-[11px] font-medium text-black">Al:</label>
                                            <input type="date" className="w-full border border-gray-400 px-2 h-6 text-[11px] font-medium outline-none text-black bg-white" defaultValue={new Date().toISOString().split('T')[0]} />

                                            <div></div>
                                            <button className="w-full bg-[#106ebe] hover:bg-[#002244] text-white text-[11px] font-medium h-6 transition-colors shadow-sm uppercase">Filtrar</button>
                                        </div>
                                    </fieldset>
                                </div>

                                {/* Transactions Table */}
                                <div className="flex-1 border border-gray-300 bg-white overflow-hidden flex flex-col font-sans min-h-[400px]">
                                    <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-[#e8e8e8] text-[10px] text-black font-medium border-b border-gray-400 sticky top-0 z-10 select-none">
                                                    <th className="px-2 py-1.5 border-r border-gray-300 text-left w-24 uppercase">Fecha</th>
                                                    <th className="px-2 py-1.5 border-r border-gray-300 text-left w-28 uppercase">Tipo Docto.</th>
                                                    <th className="px-2 py-1.5 border-r border-gray-300 text-left w-24 uppercase">No. Docto.</th>
                                                    <th className="px-2 py-1.5 border-r border-gray-300 text-left uppercase">Descripción</th>
                                                    <th className="px-2 py-1.5 border-r border-gray-300 text-right w-24 uppercase">Debe</th>
                                                    <th className="px-2 py-1.5 border-r border-gray-300 text-right w-24 uppercase">Haber</th>
                                                    <th className="px-2 py-1.5 border-r border-gray-300 text-right w-24 uppercase">Saldo</th>
                                                    <th className="px-2 py-1.5 text-left w-32 uppercase">Usuario</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transactions.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} className="p-10 text-center">
                                                            <div className="flex flex-col items-center opacity-60">
                                                                <FileText size={48} className="text-slate-400" />
                                                                <span className="text-[12px] font-medium uppercase mt-2 text-slate-600">Sin registros de movimientos</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    transactions.map(tx => (
                                                        <tr key={tx.transaction_id} className="text-[11px] text-black border-b border-gray-100 hover:bg-[#f2f7fb] h-6 transition-colors">
                                                            <td className="px-2 border-r border-gray-300">{new Date(tx.fecha_transaccion).toLocaleDateString('es-GT')}</td>
                                                            <td className="px-2 border-r border-gray-300">
                                                                {tx.transaction_type === 'CHARGE' ? 'CARGO (NOT. DEB)' : 'ABONO (NOT. CRE)'}
                                                            </td>
                                                            <td className="px-2 border-r border-gray-300 font-mono text-[10px]">
                                                                {tx.order_id ? tx.order_id.substring(0, 8).toUpperCase() : 'S/N'}
                                                            </td>
                                                            <td className="px-2 border-r border-gray-300 truncate max-w-xs">{tx.descripcion}</td>
                                                            <td className="px-2 border-r border-gray-300 text-right font-mono">
                                                                {tx.transaction_type === 'CHARGE' ? parseFloat(tx.monto).toFixed(2) : ''}
                                                            </td>
                                                            <td className="px-2 border-r border-gray-300 text-right font-mono">
                                                                {tx.transaction_type === 'PAYMENT' ? parseFloat(tx.monto).toFixed(2) : ''}
                                                            </td>
                                                            <td className="px-2 border-r border-gray-300 text-right font-mono font-medium">
                                                                {/* Simplified: showing current balance since we don't have running balance in tx data easily */}
                                                                -
                                                            </td>
                                                            <td className="px-2 uppercase text-[9px] text-gray-500">ADMINISTRADOR</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Table Totals Row */}
                                    <div className="bg-[#e8e8e8] border-t border-gray-400 flex justify-end font-mono text-[11px] font-semibold p-1 gap-0 text-black select-none">
                                        <div className="w-24 text-right px-2 border-r border-gray-300">
                                            {transactions.reduce((sum, tx) => sum + (tx.transaction_type === 'CHARGE' ? parseFloat(tx.monto) : 0), 0).toFixed(2)}
                                        </div>
                                        <div className="w-24 text-right px-2 border-r border-gray-300">
                                            {transactions.reduce((sum, tx) => sum + (tx.transaction_type === 'PAYMENT' ? parseFloat(tx.monto) : 0), 0).toFixed(2)}
                                        </div>
                                        <div className="w-24 text-right px-2 border-r border-gray-300 text-blue-800">
                                            {parseFloat(selectedAccount.saldo.toString()).toFixed(2)}
                                        </div>
                                        <div className="w-32"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

        </div>
    );
};
