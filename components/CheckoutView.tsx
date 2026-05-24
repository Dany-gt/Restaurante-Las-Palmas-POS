
import React, { useState, useEffect } from 'react';
import { Order, User, Table, OrderItem, POSTerminal, Customer } from '../types';
import { ChevronLeft, Delete, Check, CreditCard, Banknote, Landmark, Wallet, Percent, User as UserIcon, Printer, FileText, ShoppingCart, X, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import { InvoiceModal } from './InvoiceModal';
import { CreditSelector } from './CreditSelector';
import { OtherPaymentModal } from './OtherPaymentModal';
import { TipMethodModal } from './TipMethodModal';
import { billingService } from '../services/BillingService';
import { printService } from '../services/PrintService';
import { CustomerData } from '../types/billing';
import { DateUtils } from '../utils/DateUtils';
import { PinModalV2 } from './PinModalV2';
import { useSecurityPolicy } from '../hooks/useSecurityPolicy';
import { activityLogService } from '../services/ActivityLogService';
import { generateUUID } from '../utils/uuid';

interface CheckoutViewProps {
    order: Order;
    table: Table | null;
    currentUser: User | null;
    settings: any;
    onBack: () => void;
    onComplete: () => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({ order, table, currentUser, settings, onBack, onComplete }) => {
    const [amount, setAmount] = useState('0');
    const [payments, setPayments] = useState<{ method: string, amount: number, processor?: string, customer_id?: string, customer_name?: string, notes?: string }[]>([]);
    const [selectedMethod, setSelectedMethod] = useState('EFECTIVO');
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showPosSelector, setShowPosSelector] = useState(false);
    const [selectedTerminal, setSelectedTerminal] = useState<POSTerminal | null>(null);
    const [showCreditSelector, setShowCreditSelector] = useState(false);
    const [showOtherModal, setShowOtherModal] = useState(false);
    const [showTipModal, setShowTipModal] = useState(false);
    const [pendingAmount, setPendingAmount] = useState<number | null>(null);
    const [pendingCreditAmount, setPendingCreditAmount] = useState<number | null>(null);
    const [pendingOtherAmount, setPendingOtherAmount] = useState<number | null>(null);
    const [pendingTipAmount, setPendingTipAmount] = useState<number | null>(null);
    // v1.7.1: Inicializar desde la DB para no perder el método si el cajero entra/sale sin cambiar la propina
    const [tipMethod, setTipMethod] = useState<'EFECTIVO' | 'TARJETA' | 'OTROS' | null>(
        ((order as any).tip_method as 'EFECTIVO' | 'TARJETA' | 'OTROS' | null) || null
    );
    const [currentTip, setCurrentTip] = useState(order.tip_amount || 0);
    // v1.8.0: Inicializar y sincronizar el descuento acumulado (de platillo o global) de la orden o subcuenta
    const [discount, setDiscount] = useState(() => {
        const items = order.items || (order as any).order_items || [];
        const accumulatedItemDiscounts = items
            .filter((i: any) => i.status !== 'voided' && i.status !== 'cancelled')
            .reduce((acc: number, i: any) => acc + (i.discount_amount || 0), 0);

        if (accumulatedItemDiscounts > 0) {
            return accumulatedItemDiscounts;
        }
        return (order as any).discount_amount || order.discount || 0;
    });

    useEffect(() => {
        const items = order.items || (order as any).order_items || [];
        const accumulatedItemDiscounts = items
            .filter((i: any) => i.status !== 'voided' && i.status !== 'cancelled')
            .reduce((acc: number, i: any) => acc + (i.discount_amount || 0), 0);

        if (accumulatedItemDiscounts > 0) {
            setDiscount(accumulatedItemDiscounts);
        } else {
            setDiscount((order as any).discount_amount || order.discount || 0);
        }

        // Sync tip and tip method from order dynamically
        setCurrentTip(order.tip_amount || 0);
        setTipMethod(((order as any).tip_method as 'EFECTIVO' | 'TARJETA' | 'OTROS' | null) || null);
    }, [order]);
    const [processing, setProcessing] = useState(false);
    const [terminals, setTerminals] = useState<POSTerminal[]>([]);
    const [invoiceSuccess, setInvoiceSuccess] = useState(false);
    const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | undefined>(undefined);
    const [existingInvoice, setExistingInvoice] = useState<any>(null);
    const [isAnticipatedMode, setIsAnticipatedMode] = useState(false);
    const [showAdminPinForTip, setShowAdminPinForTip] = useState(false);
    const [pendingTipAction, setPendingTipAction] = useState<{ type: 'CONFIRM' | 'SIN_PROPINA', method?: 'EFECTIVO' | 'TARJETA' | 'OTROS', amount?: number } | null>(null);
    const [isAmountSelected, setIsAmountSelected] = useState(false);
    const [selectedPaymentIdx, setSelectedPaymentIdx] = useState<number | null>(null);

    // Security hook
    const { validatePin, canAccessOrder } = useSecurityPolicy(settings);

    // Logging: Opening order
    useEffect(() => {
        if (currentUser && order.id) {
            activityLogService.log({
                user: currentUser,
                module: 'CAJA',
                action: 'INGRESO_CAJA',
                entity_id: order.id,
                entity_type: 'ORDER',
                details: {
                    orderId: order.id,
                    orderNumber: (order as any).order_number,
                    mesa: table?.number,
                    seccion: table?.section,
                    total_orden: order.subtotal,
                    propina_actual: order.tip_amount || 0
                }
            });
        }
    }, []); // Only on mount

    const [serverOffset, setServerOffset] = useState<number>(() => {
        const cached = localStorage.getItem('kds_server_offset');
        return cached ? parseInt(cached, 10) : 0;
    });

    const [tick, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const nowServer = new Date(Date.now() + serverOffset);
    const timeDisplay = nowServer.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateDisplay = nowServer.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');


    // DEBUG: Check permissions on load
    useEffect(() => {
        if (currentUser) {
            console.log('Current User Permissions:', currentUser.permissions);
            console.log('Has Tip Lock Permission:', currentUser.permissions?.some(p => p.toLowerCase().includes('bloquear eliminación de propina')));
        }
    }, [currentUser]);

    const isStaff = currentUser?.role === 'ADMIN' || currentUser?.role === 'MASTER' || currentUser?.role === 'SOPORTE';

    // Permiso: SEGURIDAD -> Bloquear eliminación/modificación de propina
    // Se aplica a CAJEROS y MESEROS. Solo Administración (Staff) queda libre.
    const hasTipLock = !isStaff && (currentUser?.role === 'CAJERO' || currentUser?.role === 'MESERO');

    const currency = (settings?.currency === 'GTQ' || settings?.currency === 'Q') ? 'Q.' : (settings?.currency || 'Q.');
    // v1.8.0: Calcular subtotal dinámico considerando sólo ítems activos
    const computedSubtotal = (order.items || (order as any).order_items || [])
        .filter((i: any) => i.status !== 'voided' && i.status !== 'cancelled')
        .reduce((acc: number, i: any) => acc + ((i.unit_price || i.price || 0) * i.quantity), 0);
    const subtotal = order.subtotal && order.subtotal > 0 ? order.subtotal : computedSubtotal;

    // Calcular IVA dinámico basado en subtotal después de descuento
    const taxRate = parseFloat(settings?.tax_percentage || '12') / 100;
    const subtotalAfterDiscount = Math.max(0, subtotal - discount);
    const tax = subtotalAfterDiscount - (subtotalAfterDiscount / (1 + taxRate));

    const total = subtotalAfterDiscount + currentTip; // El total ahora considera el descuento aplicado

    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = total - totalPaid;
    const change = totalPaid > total ? totalPaid - total : 0;

    useEffect(() => {
        // Blur any focused input to prevent virtual keyboard from showing
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        const fetchTerminals = async () => {
            let query = supabase.from('pos_terminals').select('*').order('name');
            if (currentUser?.branch_id) query = query.eq('branch_id', currentUser.branch_id);
            const { data } = await query;
            if (data) {
                setTerminals(data);
                // Preload images for faster rendering when modal opens
                data.forEach(pos => {
                    if (pos.logo_url) {
                        const img = new Image();
                        img.src = pos.logo_url;
                    }
                });
            }
        };
        fetchTerminals();

        // Logging: Access to Checkout
        if (currentUser) {
            activityLogService.logFinancial({
                user: currentUser,
                module: 'CAJA',
                action: 'INGRESO_CAJA',
                entity_id: order.id,
                entity_type: 'ORDER',
                details: {
                    orderId: order.id,
                    orderNumber: (order as any).order_number,
                    mesa: table?.number,
                    seccion: table?.section,
                    total: total,
                    subtotal: subtotal,
                    impuesto: tax,
                    propina: order.tip_amount || 0
                }
            }, {
                amount: total,
                type: 'NEUTRO',
                currency: 'GTQ'
            });
        }

        const checkExistingInvoice = async () => {
            if (!order || !order.id) return;
            const { data } = await supabase
                .from('invoices')
                .select('*')
                .eq('order_id', order.id)
                .eq('status', 'ACTIVE')
                .maybeSingle();

            if (data) {
                console.log('Factura existente encontrada:', data);
                setExistingInvoice(data);
            }
        };
        checkExistingInvoice();
    }, [order.id]);

    // Global keyboard listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if in invoice modal or other overlays
            if (showInvoiceModal || showPosSelector || showCreditSelector || showOtherModal || showTipModal || processing) {
                if (showPosSelector && e.key === 'Enter' && selectedTerminal) {
                    handlePosSelect(selectedTerminal.name);
                }
                if (showPosSelector && e.key === 'Escape') {
                    setShowPosSelector(false);
                    setSelectedTerminal(null);
                }
                return;
            }

            if (e.key >= '0' && e.key <= '9') {
                handleNumberClick(e.key);
            } else if (e.key === '.') {
                handleNumberClick('.');
            } else if (e.key === 'Backspace') {
                handleBackspace();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleAddPayment();
            } else if (e.key === 'Escape') {
                onBack();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showInvoiceModal, showPosSelector, showCreditSelector, showOtherModal, showTipModal, processing, amount, selectedMethod, balance, selectedTerminal]);

    const handleNumberClick = (num: string) => {
        setAmount(prev => {
            if (isAmountSelected || prev === '0') {
                setIsAmountSelected(false);
                return num;
            }
            return prev + num;
        });
    };

    const handleClear = () => setAmount('0');

    const handleBackspace = () => {
        if (isAmountSelected) {
            setAmount('0');
            setIsAmountSelected(false);
            return;
        }
        setAmount(prev => {
            if (prev.length <= 1) return '0';
            return prev.slice(0, -1);
        });
    };

    const handlePropinaAction = () => {
        const val = parseFloat(amount);
        const tipPercentage = (settings?.suggested_tip || 10) / 100;
        const rawTip = val > 0 ? val : (subtotalAfterDiscount * tipPercentage);

        // Respect the 'round_tip' setting from admin panel
        const finalTip = settings?.round_tip
            ? Math.round(rawTip)
            : parseFloat(rawTip.toFixed(2));

        setPendingTipAmount(finalTip);
        setShowTipModal(true);
    };

    const handleAddPayment = () => {
        let val = parseFloat(amount);
        if (val <= 0) {
            if (balance > 0) {
                setAmount(balance.toFixed(2));
                return;
            }
            return;
        }

        if (selectedMethod === 'TARJETA') {
            setPendingAmount(val);
            setShowPosSelector(true);
        } else if (selectedMethod === 'AL CRÉDITO') {
            setPendingCreditAmount(val);
            setShowCreditSelector(true);
        } else if (selectedMethod === 'OTROS') {
            setPendingOtherAmount(val);
            setShowOtherModal(true);
        } else {
            setPayments(prev => [...prev, { method: selectedMethod, amount: val }]);
            setAmount('0');
        }
    };

    const handleReset = () => {
        if (payments.length === 0 && currentTip === (order.tip_amount || 0)) return;
        setPayments([]);
        setCurrentTip(order.tip_amount || 0);
        setTipMethod(null);
        setAmount('0');
    };

    const handleTipConfirm = (method: 'EFECTIVO' | 'TARJETA' | 'OTROS', tipAmount: number) => {
        // Calculate the suggested 10% tip using SAME LOGIC as handlePropinaAction
        const suggestedTipRate = (settings?.suggested_tip || 10) / 100;
        const rawSuggested = subtotalAfterDiscount * suggestedTipRate;
        const suggestedAmount = settings?.round_tip
            ? Math.round(rawSuggested)
            : parseFloat(rawSuggested.toFixed(2));

        console.log(`[Tip Check] Input: ${tipAmount}, Suggested: ${suggestedAmount}, Lock: ${hasTipLock}`);

        // BLOQUEO POR PIN: Si el cajero MODIFICA o QUITA la propina (tipAmount !== suggestedAmount)
        // Solo aplica si el usuario TIENE el permiso de bloqueo activo
        if (hasTipLock && tipAmount !== suggestedAmount) {
            console.log('--- ACTION BLOCKED: Requiring Admin PIN ---');
            setPendingTipAction({ type: 'CONFIRM', method, amount: tipAmount });
            setShowAdminPinForTip(true);
            return;
        }

        // Flujo libre si se respeta exactamente el monto sugerido o si el usuario NO tiene el bloqueo
        executeTipAction('CONFIRM', method, tipAmount);
    };

    const executeTipAction = (type: 'CONFIRM' | 'SIN_PROPINA', method?: 'EFECTIVO' | 'TARJETA' | 'OTROS', amount?: number) => {
        if (type === 'CONFIRM') {
            setCurrentTip(amount || 0);
            // v1.7.1: Siempre requerir un método explícito; fallback a EFECTIVO solo si se confirmó con monto
            setTipMethod(method || 'EFECTIVO');
            setShowTipModal(false);
            setAmount('0');
        } else if (type === 'SIN_PROPINA') {
            setCurrentTip(0);
            // v1.7.1: Sin propina = sin método. null es correcto y ShiftService lo ignorará (tip > 0 es el guard).
            setTipMethod(null);
            setAmount('0');
        }
    };

    const handleOtherConfirm = (data: { subType: string, amount: number, documentNo: string, description: string }) => {
        setPayments(prev => [...prev, {
            method: 'OTROS',
            amount: data.amount,
            processor: data.subType, // We'll re-use 'processor' for subType
            customer_name: data.documentNo, // We'll re-use 'customer_name' for doc no
            notes: data.description
        }]);
        setShowOtherModal(false);
        setAmount('0');
    };

    const handlePosSelect = (processor: string) => {
        if (pendingAmount !== null) {
            const terminal = terminals.find(t => t.name === processor);
            setPayments(prev => [...prev, {
                method: 'TARJETA',
                amount: pendingAmount,
                processor,
                terminalId: terminal?.id // Store terminal ID for database
            }]);
            setPendingAmount(null);
            setShowPosSelector(false);
            setSelectedTerminal(null);
            setAmount('0');
        }
    };

    const handleCreditConfirm = async (customer: Customer, creditAmount: number) => {
        setProcessing(true);
        try {
            // Aplicar el descuento del cliente a la orden global si no se ha aplicado uno mayor
            const discPercent = customer.authorized_discount || 0;
            const discAmount = (subtotal * discPercent) / 100;
            if (discAmount > discount) {
                setDiscount(discAmount);
            }

            // Si se paga al crédito y se pidió excluir la propina, la ponemos en 0 para evitar saldo pendiente
            setCurrentTip(0);

            // 1. Add locally
            setPayments(prev => [...prev, {
                method: 'AL CRÉDITO',
                amount: creditAmount,
                customer_id: customer.id,
                customer_name: customer.name
            }]);

            // 2. Update DB
            const { error: custError } = await supabase
                .from('customers')
                .update({ current_balance: customer.current_balance + creditAmount })
                .eq('id', customer.id);
            if (custError) throw custError;

            const { error: transError } = await supabase
                .from('credit_transactions')
                .insert([{
                    customer_id: customer.id,
                    order_id: order.id,
                    amount: creditAmount,
                    type: 'CHARGE',
                    description: `Cargo por orden #${order.order_number || order.id.slice(0, 8)}`
                }]);
            if (transError) throw transError;

            await supabase.from('orders').update({ customer_id: customer.id }).eq('id', order.id);

            setShowCreditSelector(false);
            setPendingCreditAmount(null);
            setAmount('0');
        } catch (e: any) {
            console.error(`Error al procesar crédito: ${e.message}`);
        }
        setProcessing(false);
    };

    const handleFinalize = async () => {
        let activePayments = [...payments];
        let activeTotalPaid = totalPaid;
        let activeChange = change;
        let activeBalance = balance;

        if (activeTotalPaid < total) {
            const remaining = total - activeTotalPaid;
            if (selectedMethod === 'EFECTIVO') {
                const newPayment = { method: 'EFECTIVO', amount: remaining };
                activePayments.push(newPayment);
                activeTotalPaid += remaining;
                activeBalance = 0;
                activeChange = 0;
                setPayments(activePayments);
            } else if (selectedMethod === 'TARJETA') {
                setPendingAmount(remaining);
                setShowPosSelector(true);
                return;
            } else if (selectedMethod === 'AL CRÉDITO') {
                setPendingCreditAmount(remaining);
                setShowCreditSelector(true);
                return;
            } else if (selectedMethod === 'OTROS') {
                setPendingOtherAmount(remaining);
                setShowOtherModal(true);
                return;
            }
        }

        if (existingInvoice) {
            // Case: Already invoiced, just need to close order and save payments
            setProcessing(true);
            try {
                // Determine payment method and processor
                const cardPayment = activePayments.find(p => p.method === 'TARJETA');
                const mainPaymentMethod = activePayments.length > 0 ? activePayments[0].method : 'EFECTIVO';
                const hasCashPayment = activePayments.some(p => p.method === 'EFECTIVO');

                const getBreakdownValues = () => {
                    if (activePayments.length > 0) {
                        const cashAmount = activePayments.filter(p => p.method === 'EFECTIVO').reduce((acc, p) => acc + p.amount, 0);
                        const cardAmount = activePayments.filter(p => p.method === 'TARJETA').reduce((acc, p) => acc + p.amount, 0);
                        const creditAmount = activePayments.filter(p => p.method === 'AL CRÉDITO').reduce((acc, p) => acc + p.amount, 0);
                        const otherAmount = activePayments.filter(p => p.method === 'OTROS').reduce((acc, p) => acc + p.amount, 0);
                        return {
                            cash_amount: cashAmount,
                            card_amount: cardAmount,
                            credit_amount: creditAmount,
                            other_amount: otherAmount,
                            total_paid: activeTotalPaid,
                            change_amount: activeChange
                        };
                    } else {
                        const method = (mainPaymentMethod || 'EFECTIVO').toUpperCase();
                        const isCash = method === 'EFECTIVO';
                        const isCard = method === 'TARJETA';
                        const isCredit = method.includes('CREDIT') || method.includes('CRÉDITO') || method.includes('CREDITO');
                        const isOther = !isCash && !isCard && !isCredit;

                        return {
                            cash_amount: isCash ? total : 0,
                            card_amount: isCard ? total : 0,
                            credit_amount: isCredit ? total : 0,
                            other_amount: isOther ? total : 0,
                            total_paid: total,
                            change_amount: 0
                        };
                    }
                };
                const breakdown = getBreakdownValues();

                const { error: updateError } = await supabase.from('orders').update({
                    status: 'completed',
                    payment_method: mainPaymentMethod,
                    card_processor: cardPayment?.processor || null,
                    pos_terminal_id: cardPayment?.terminalId || null,
                    total: total,
                    tip_amount: currentTip,
                    tip_method: tipMethod,
                    subtotal: subtotalAfterDiscount - tax,
                    tax_amount: tax,
                    discount_amount: discount,
                    cashier_id: currentUser?.id,
                    cash_amount: breakdown.cash_amount,
                    card_amount: breakdown.card_amount,
                    credit_amount: breakdown.credit_amount,
                    other_amount: breakdown.other_amount,
                    total_paid: breakdown.total_paid,
                    change_amount: breakdown.change_amount
                }).eq('id', order.id);

                if (updateError) throw updateError;
                if (table?.id) {
                    await supabase.from('tables').update({ status: 'available' }).eq('id', table.id);
                    try {
                        const offlineTablesStr = localStorage.getItem('offline_occupied_tables');
                        if (offlineTablesStr) {
                            const offlineTables = JSON.parse(offlineTablesStr);
                            delete offlineTables[table.id];
                            localStorage.setItem('offline_occupied_tables', JSON.stringify(offlineTables));
                        }
                    } catch (e) { console.warn(e); }
                }

                printService.openCashDrawer({
                    orderId: order.id,
                    userId: currentUser?.id || '',
                    userName: currentUser?.name || 'Cajero',
                    amount: hasCashPayment ? (activePayments.find(p => p.method === 'EFECTIVO')?.amount || total) : 0,
                    reason: 'Cobro de Orden (Contingencia/Facturado)'
                }).catch(console.error);

                // Logging action
                if (currentUser) {
                    await activityLogService.logFinancial({
                        user: currentUser,
                        module: 'CAJA',
                        action: 'ORDEN_CERRADA',
                        entity_id: order.id,
                        entity_type: 'ORDER',
                        details: {
                            orderId: order.id,
                            orderNumber: (order as any).order_number,
                            mesa: table?.number,
                            seccion: table?.section,
                            subtotal: subtotal - tax,
                            impuesto: tax,
                            propina: currentTip,
                            propina_metodo: tipMethod,
                            total_final: total,
                            factura_preexistente: true,
                            factura_serie: existingInvoice?.series,
                            factura_numero: existingInvoice?.document_number,
                            pagos: activePayments.map(p => ({ metodo: p.method, monto: p.amount, procesador: p.processor })),
                            cajero: currentUser.name
                        },
                        branchId: order.branch_id
                    }, {
                        amount: total,
                        type: 'INGRESO',
                        currency: 'GTQ',
                        tax_amount: tax,
                        tip_amount: currentTip,
                        payment_breakdown: {
                            efectivo: activePayments.filter(p => p.method === 'EFECTIVO').reduce((a, p) => a + p.amount, 0),
                            tarjeta: activePayments.filter(p => p.method === 'TARJETA').reduce((a, p) => a + p.amount, 0),
                            credito: activePayments.filter(p => p.method === 'AL CRÉDITO').reduce((a, p) => a + p.amount, 0),
                            otros: activePayments.filter(p => p.method === 'OTROS').reduce((a, p) => a + p.amount, 0)
                        }
                    });
                }

                // Print Payment Voucher / Ticket
                await printService.printInvoiceTicket({
                    orderId: order.id,
                    orderNumber: (order as any).order_number,
                    tableNumber: table?.number,
                    tableName: table?.section,
                    waiterName: (order as any).profiles?.name || currentUser?.name,
                    items: (existingInvoice.is_por_consumo) ? [{ // Basic check, better if we fetch items
                        name: 'CONSUMO DE ALIMENTOS',
                        quantity: 1,
                        price: subtotalAfterDiscount
                    }] : (order.items || (order as any).order_items || []).map((i: any) => ({
                        name: i.products?.name || i.product_name || i.name || 'Producto',
                        quantity: i.quantity,
                        price: i.unit_price || i.price
                    })),
                    subtotal: subtotalAfterDiscount - tax,
                    taxAmount: tax,
                    tipAmount: currentTip,
                    discountAmount: discount,
                    total: total,
                    createdAt: order.created_at || DateUtils.nowISO(),
                    dteInfo: {
                        serie: existingInvoice.series,
                        numero: existingInvoice.document_number,
                        fechaCertificacion: existingInvoice.certification_date,
                        autorizacion: existingInvoice.uuid
                    },
                    customerNit: existingInvoice.customer_nit,
                    customerName: existingInvoice.customer_name,
                    paymentMethod: mainPaymentMethod,
                    isReprint: true // Mark as reprint/voucher
                });

                onComplete();
            } catch (err: any) {
                console.error("Error finalizing existing invoice:", err);
                alert("Error al finalizar orden: " + err.message);
            } finally {
                setProcessing(false);
            }
        } else {
            // Normal flow: Open modal to invoice
            if (!navigator.onLine) {
                // FORCE CONTINGENCY IF OFFLINE
                setIsAnticipatedMode(false);
                setShowInvoiceModal(true);
            } else {
                setIsAnticipatedMode(false);
                setShowInvoiceModal(true);
            }
        }
    };

    const handleAnticipatedInvoice = () => {
        setIsAnticipatedMode(true);
        setShowInvoiceModal(true);
    };

    const handleInvoiceSubmit = async (customer: CustomerData, paymentMethod: string, cardProcessor?: string) => {

        setProcessing(true);
        try {
            const getBreakdownValues = () => {
                if (payments.length > 0) {
                    const cashAmount = payments.filter(p => p.method === 'EFECTIVO').reduce((acc, p) => acc + p.amount, 0);
                    const cardAmount = payments.filter(p => p.method === 'TARJETA').reduce((acc, p) => acc + p.amount, 0);
                    const creditAmount = payments.filter(p => p.method === 'AL CRÉDITO').reduce((acc, p) => acc + p.amount, 0);
                    const otherAmount = payments.filter(p => p.method === 'OTROS').reduce((acc, p) => acc + p.amount, 0);
                    return {
                        cash_amount: cashAmount,
                        card_amount: cardAmount,
                        credit_amount: creditAmount,
                        other_amount: otherAmount,
                        total_paid: totalPaid,
                        change_amount: change
                    };
                } else {
                    const method = (paymentMethod || 'EFECTIVO').toUpperCase();
                    const isCash = method === 'EFECTIVO';
                    const isCard = method === 'TARJETA';
                    const isCredit = method.includes('CREDIT') || method.includes('CRÉDITO') || method.includes('CREDITO');
                    const isOther = !isCash && !isCard && !isCredit;

                    return {
                        cash_amount: isCash ? total : 0,
                        card_amount: isCard ? total : 0,
                        credit_amount: isCredit ? total : 0,
                        other_amount: isOther ? total : 0,
                        total_paid: total,
                        change_amount: 0
                    };
                }
            };
            const breakdown = getBreakdownValues();

            const checkoutItems = (order.items || (order as any).order_items || [])
                .filter((i: any) => i.status !== 'voided' && i.status !== 'cancelled');

            const accumulatedItemDiscounts = checkoutItems.reduce((acc: number, i: any) => acc + (i.discount_amount || 0), 0);
            const globalDiscount = accumulatedItemDiscounts > 0 ? 0 : discount;

            const invoiceItems = billingService.buildInvoiceItems(
                checkoutItems.map((i: any) => {
                    const linePrice = i.unit_price || i.price || 0;
                    const lineTotal = linePrice * i.quantity;
                    const itemDiscountShare = i.discount_amount || 0;
                    const globalDiscountShare = subtotal > 0 ? (lineTotal / subtotal) * globalDiscount : 0;
                    const finalLineTotal = Math.max(0, lineTotal - itemDiscountShare - globalDiscountShare);
                    const name = i.products?.name || i.product_name || i.name || 'Producto';
                    return {
                        name,
                        quantity: i.quantity,
                        unit_price: finalLineTotal / i.quantity
                    };
                })
            );

            const billingMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT' =
                paymentMethod === 'EFECTIVO' ? 'CASH' :
                    (paymentMethod === 'TARJETA' ? 'CARD' :
                        (paymentMethod === 'TRANSFERENCIA' ? 'TRANSFER' : 'CREDIT'));

            let result: any = { success: true, series: 'CONT', document_number: 'PENDIENTE' };

            if (!customer.is_contingency) {
                result = await billingService.processInvoice({
                    customer,
                    items: invoiceItems,
                    subtotal: subtotalAfterDiscount - tax,
                    tax_total: tax,
                    discount_total: 0, // 0 to avoid double discounting since unit_price is already discounted
                    grand_total: billingMethod === 'CARD' ? subtotalAfterDiscount + currentTip : subtotalAfterDiscount,
                    tip_amount: currentTip,
                    payment_method: billingMethod,
                    order_id: order.id
                }, order.branch_id || currentUser?.branch_id);
            } else if (existingInvoice) {
                // Should not happen here usually, but if it does, use existing
                result = {
                    success: true,
                    uuid: existingInvoice.uuid,
                    series: existingInvoice.series,
                    document_number: existingInvoice.document_number,
                    certification_date: existingInvoice.certification_date
                };
            } else {
                console.log('Modo Contingencia: Saltando certificación FEL');
                // Save contingency invoice to database
                await billingService.saveContingencyInvoice({
                    customer,
                    items: invoiceItems,
                    subtotal: subtotalAfterDiscount - tax,
                    tax_total: tax,
                    discount_total: 0, // already applied to items
                    grand_total: billingMethod === 'CARD' ? subtotalAfterDiscount + currentTip : subtotalAfterDiscount,
                    tip_amount: currentTip,
                    payment_method: billingMethod,
                    order_id: order.id
                }, (order as any).order_number || order.id);
            }

            if (!navigator.onLine) {
                // OFFLINE SAVE TO INDEXEDDB
                const cardPayment = payments.find(p => p.method === 'TARJETA');
                const orderData = {
                    id: order.id || generateUUID(),
                    order: {
                        status: 'completed',
                        payment_method: payments.length > 0 ? payments[0].method : paymentMethod,
                        card_processor: cardPayment?.processor || cardProcessor,
                        pos_terminal_id: cardPayment?.terminalId || null,
                        total: total,
                        tip_amount: currentTip,
                        tip_method: tipMethod,
                        subtotal: subtotalAfterDiscount - tax,
                        tax_amount: tax,
                        discount_amount: discount,
                        is_contingency: true,
                        cashier_id: currentUser?.id,
                        branch_id: order.branch_id || currentUser?.branch_id,
                        cash_amount: breakdown.cash_amount,
                        card_amount: breakdown.card_amount,
                        credit_amount: breakdown.credit_amount,
                        other_amount: breakdown.other_amount,
                        total_paid: breakdown.total_paid,
                        change_amount: breakdown.change_amount
                    },
                    items: (order.items || (order as any).order_items || []).map((i: any) => ({
                        product_id: i.product_id,
                        quantity: i.quantity,
                        unit_price: i.unit_price || i.price,
                        notes: i.notes
                    })),
                    invoice: {
                        customer_nit: customer.nit,
                        customer_name: customer.name,
                        series: 'CONT',
                        document_number: `OFF-${(order as any).order_number || order.id.slice(0, 5)}`,
                        subtotal: subtotalAfterDiscount - tax,
                        tax_total: tax,
                        grand_total: billingMethod === 'CARD' ? subtotalAfterDiscount + currentTip : subtotalAfterDiscount,
                        status: 'ACTIVE'
                    }
                };

                await import('../services/OfflineDB').then(m => m.offlineDB.saveRecord('ORDER', orderData));
                console.log('📦 Venta finalizada Offline (IndexedDB):', order.id);

                alert('✅ Venta guardada localmente. Se sincronizará al reconectar.');

                setInvoiceSuccess(true);
                window.dispatchEvent(new CustomEvent('offline-sync-trigger'));
                onComplete(); // Navigate back to dashboard/tables
                return;
            }

            if (result.success) {
                // If Anticipated Mode: Do NOT close order, just save state and print
                if (isAnticipatedMode) {

                    // Refetch to get the full object including ID if needed, or just construct it
                    // We need to update existingInvoice state so buttons update
                    setExistingInvoice({
                        ...result,
                        customer_nit: customer.nit,
                        customer_name: customer.name,
                        status: 'ACTIVE'
                    });

                    // Print FEL Invoice
                    try {
                        await printService.printInvoiceTicket({
                            orderId: order.id,
                            orderNumber: (order as any).order_number,
                            tableNumber: table?.number,
                            tableName: table?.section,
                            waiterName: (order as any).profiles?.name || currentUser?.name,
                            items: (customer.is_por_consumo || customer.is_por_almuerzo) ? [{
                                name: customer.is_por_almuerzo ? 'POR ALMUERZO' : 'CONSUMO DE ALIMENTOS',
                                quantity: 1,
                                price: subtotalAfterDiscount
                            }] : (order.items || (order as any).order_items || []).map((i: any) => ({
                                name: i.products?.name || i.product_name || i.name || 'Producto',
                                quantity: i.quantity,
                                price: i.unit_price || i.price
                            })),
                            subtotal: subtotalAfterDiscount - tax,
                            taxAmount: tax,
                            tipAmount: currentTip,
                            discountAmount: discount,
                            total: total,
                            createdAt: order.created_at || DateUtils.nowISO(),
                            dteInfo: !customer.is_contingency ? {
                                serie: result.series || '',
                                numero: result.document_number || '',
                                fechaCertificacion: result.certification_date || new Date().toISOString(),
                                autorizacion: result.uuid || result.authorization_number || ''
                            } : undefined,
                            customerNit: customer.nit,
                            customerName: customer.name,
                            paymentMethod: 'EFECTIVO' // Default for anticipated
                        });
                    } catch (printError) {
                        console.error('Error printing anticipated invoice:', printError);
                    }

                    setInvoiceSuccess(true);
                    setProcessing(false);
                    return; // EXIT HERE, DO NOT CLOSE ORDER
                }

                // Cleanup: Delete any existing contingency invoice for this order ONLY IF not in contingency mode
                if (!customer.is_contingency) {
                    await supabase.from('invoices').delete().eq('order_id', order.id).is('uuid', null);
                }

                const cardPayment = payments.find(p => p.method === 'TARJETA');
                const { error: updateError } = await supabase.from('orders').update({
                    status: 'completed',
                    payment_method: payments.length > 0 ? payments[0].method : paymentMethod,
                    card_processor: cardPayment?.processor || cardProcessor,
                    pos_terminal_id: cardPayment?.terminalId || null,
                    total: total,
                    tip_amount: currentTip,
                    tip_method: tipMethod,
                    subtotal: subtotal - tax,
                    tax_amount: tax,
                    is_contingency: customer.is_contingency || false,
                    cashier_id: currentUser?.id,
                    cash_amount: breakdown.cash_amount,
                    card_amount: breakdown.card_amount,
                    credit_amount: breakdown.credit_amount,
                    other_amount: breakdown.other_amount,
                    total_paid: breakdown.total_paid,
                    change_amount: breakdown.change_amount
                }).eq('id', order.id);

                if (updateError) throw updateError;
                if (table?.id) {
                    await supabase.from('tables').update({ status: 'available' }).eq('id', table.id);
                    try {
                        const offlineTablesStr = localStorage.getItem('offline_occupied_tables');
                        if (offlineTablesStr) {
                            const offlineTables = JSON.parse(offlineTablesStr);
                            delete offlineTables[table.id];
                            localStorage.setItem('offline_occupied_tables', JSON.stringify(offlineTables));
                        }
                    } catch (e) { console.warn(e); }
                }

                // Logging action
                if (currentUser) {
                    await activityLogService.logFinancial({
                        user: currentUser,
                        module: 'FACTURACION',
                        action: customer.is_contingency ? 'FACTURA_CONTINGENCIA' : 'FACTURA_EMITIDA',
                        severity: 'FINANCIAL',
                        entity_id: order.id,
                        entity_type: 'INVOICE',
                        details: {
                            orderId: order.id,
                            orderNumber: (order as any).order_number,
                            mesa: table?.number,
                            seccion: table?.section,
                            // Datos de la factura
                            factura_serie: result.series,
                            factura_numero: result.document_number,
                            factura_uuid: result.uuid,
                            fecha_certificacion: result.certification_date,
                            // Datos del cliente
                            cliente_nit: customer.nit,
                            cliente_nombre: customer.name,
                            // Desglose financiero
                            subtotal: subtotal - tax,
                            impuesto: tax,
                            iva_generado: tax,
                            propina: currentTip,
                            propina_metodo: tipMethod,
                            total_facturado: total,
                            es_contingencia: !!customer.is_contingency,
                            es_por_consumo: customer.is_por_consumo || false,
                            // Pagos
                            forma_pago_principal: payments.length > 0 ? payments[0].method : 'EFECTIVO',
                            pagos: payments.map(p => ({
                                metodo: p.method,
                                monto: p.amount,
                                procesador: p.processor,
                                cliente_credito: p.customer_name,
                                notas: p.notes
                            })),
                            cajero: currentUser.name
                        },
                        branchId: order.branch_id
                    }, {
                        amount: total,
                        type: 'INGRESO',
                        currency: 'GTQ',
                        tax_amount: tax,
                        tip_amount: currentTip,
                        payment_breakdown: {
                            efectivo: payments.filter(p => p.method === 'EFECTIVO').reduce((a, p) => a + p.amount, 0),
                            tarjeta: payments.filter(p => p.method === 'TARJETA').reduce((a, p) => a + p.amount, 0),
                            credito: payments.filter(p => p.method === 'AL CRÉDITO').reduce((a, p) => a + p.amount, 0),
                            otros: payments.filter(p => p.method === 'OTROS').reduce((a, p) => a + p.amount, 0)
                        }
                    });
                }

                // Open Cash Drawer for ALL payments (to store cash or card vouchers)
                const cashPayments = payments.filter(p => p.method === 'EFECTIVO');
                const cashAmount = payments.length > 0
                    ? cashPayments.reduce((acc, p) => acc + p.amount, 0)
                    : (paymentMethod === 'EFECTIVO' ? total : 0);

                printService.openCashDrawer({
                    orderId: order.id,
                    userId: currentUser?.id || '',
                    userName: currentUser?.name || 'Cajero',
                    amount: cashAmount,
                    reason: 'Cobro de Orden'
                }).catch(console.error);

                // ─── IMPRESIÓN DEL TICKET ───
                try {
                    await printService.printInvoiceTicket({
                        orderId: order.id,
                        orderNumber: (order as any).order_number,
                        tableNumber: table?.number,
                        tableName: table?.section,
                        waiterName: (order as any).profiles?.name || currentUser?.name,
                        items: (customer.is_por_consumo || customer.is_por_almuerzo) ? [{
                            name: customer.is_por_almuerzo ? 'POR ALMUERZO' : 'CONSUMO DE ALIMENTOS',
                            quantity: 1,
                            price: subtotalAfterDiscount
                        }] : (order.items || (order as any).order_items || []).map((i: any) => ({
                            name: i.products?.name || i.product_name || i.name || 'Producto',
                            quantity: i.quantity,
                            price: i.unit_price || i.price
                        })),
                        subtotal: subtotalAfterDiscount - tax,
                        taxAmount: tax,
                        tipAmount: currentTip,
                        discountAmount: discount,
                        total: total,
                        createdAt: order.created_at || DateUtils.nowISO(),
                        // DTE Info from certifier
                        dteInfo: !customer.is_contingency ? {
                            serie: result.series || '',
                            numero: result.document_number || '',
                            fechaCertificacion: result.certification_date || new Date().toISOString(),
                            autorizacion: result.uuid || result.authorization_number || ''
                        } : undefined,
                        customerNit: customer.nit,
                        customerName: customer.name,
                        paymentMethod: payments.length > 0 ? payments[0].method : paymentMethod
                    });
                    console.log('Venta procesada e impresión enviada');
                } catch (printError: any) {
                    console.error('Error printing invoice:', printError);
                    alert('Venta procesada pero falló la impresión: ' + (printError.message || 'Error de driver'));
                }

                if (result.pdf_url) {
                    setInvoicePdfUrl(result.pdf_url);
                } else {
                    setInvoicePdfUrl(undefined);
                }
                setInvoiceSuccess(true);
            } else {
                console.error(`❌ Error al facturar: ${result.error}`);
                alert(`❌ Error al generar factura: ${result.error || 'Error desconocido. Verifique la conexión a Infile.'}`);
            }
        } catch (e: any) {
            console.error(`Error inesperado: ${e.message}`);
            alert(`❌ Error inesperado al facturar: ${e.message}`);
        }
        setProcessing(false);
    };

    return (
        <div className="fixed inset-0 bg-[#0f1115] text-white flex flex-col font-sans overflow-hidden z-50 animate-fade-in">
            {/* TOP HEADER */}
            <header className="h-16 bg-[#16191f] border-b border-white/5 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-6">
                    <button onClick={onBack} className="p-2.5 bg-white/5 rounded-xl transition-all">
                        <ChevronLeft size={24} />
                    </button>
                    <span className="text-sm font-black tracking-widest uppercase text-gray-400">RESTAURANTE LAS PALMAS POS</span>
                </div>
                <div className="flex items-center gap-6">
                    {/* Clock & Date */}
                    <div className="hidden md:flex flex-col items-center leading-none bg-black/40 px-3 py-1.5 rounded-2xl border border-white/5 ">
                        <span className="text-[13px] font-black tracking-widest text-white/40 tabular-nums">{timeDisplay}</span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter mt-0.5">{dateDisplay}</span>
                    </div>

                    <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-gray-200">{currentUser?.name}</span>
                        <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Cobrar Cuenta</span>
                    </div>
                </div>

            </header>

            <div className="flex-1 flex overflow-hidden p-6 gap-6">

                {/* LEFT PANEL: TOTALS & SUMMARY */}
                <div className="w-[300px] flex flex-col gap-4">
                    <div className="bg-[#1e212b] p-6 flex flex-col gap-3 border border-white/5 ">
                        <div className="flex justify-between text-gray-400 text-sm font-black uppercase leading-tight">
                            <span>SUB-TOTAL</span>
                            <span>{currency}{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-400 text-sm font-black uppercase leading-tight">
                            <span>DESCUENTO</span>
                            <span className={discount > 0 ? "text-emerald-400" : ""}>{currency}{discount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-400 text-sm font-black uppercase leading-tight">
                            <div className="flex flex-col">
                                <span>PROPINA</span>
                                {tipMethod && <span className="text-[10px] text-white/40 font-black tracking-widest leading-none">Vía {tipMethod}</span>}
                            </div>
                            <span>{currency}{currentTip.toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-white/10 my-1"></div>
                        <div className="flex justify-between text-white text-sm font-black uppercase leading-tight">
                            <span>TOTAL</span>
                            <span>{currency}{total.toFixed(2)}</span>
                        </div>

                        <div className="mt-4 space-y-2">
                            {['EFECTIVO', 'TARJETA', 'AL CRÉDITO', 'OTROS'].map(method => {
                                const methodPayments = payments.filter(p => p.method === method);
                                const mAmount = methodPayments.reduce((acc, p) => acc + p.amount, 0);
                                return (
                                    <div key={method} className="flex justify-between text-white text-xs font-bold uppercase tracking-wider">
                                        <span>{method}</span>
                                        <span>{currency}{mAmount.toFixed(2)}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="h-px bg-white/10 my-3"></div>

                        <div className="flex justify-between text-white text-sm font-black uppercase leading-tight">
                            <span>PAGADO</span>
                            <span>{currency}{totalPaid.toFixed(2)}</span>
                        </div>

                        <div className="mt-4 flex flex-col gap-1.5">
                            <div className="flex justify-between text-white text-sm font-black uppercase leading-tight tracking-tighter">
                                <span>RESTANTE</span>
                                <span>{currency}{Math.max(0, balance).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-white text-sm font-black uppercase leading-tight tracking-tighter">
                                <span>CAMBIO</span>
                                <span>{currency}{change.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {!existingInvoice && !invoiceSuccess && (
                        <button
                            onClick={handleAnticipatedInvoice}
                            className="w-full py-5 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-black uppercase tracking-[0.2em] text-[11px] transition-all active:scale-95 flex items-center justify-center gap-3  group"
                        >
                            <FileText size={22} className="group-hover:scale-110 transition-transform" /> Factura Anticipada
                        </button>
                    )}
                </div>

                {/* MIDDLE PANEL: PAYMENTS LIST */}
                <div className="flex-1 h-[430px] self-start bg-[#1e212b] border border-white/5  overflow-hidden flex flex-col relative">
                    <div className="flex-1 overflow-y-auto p-6 space-y-2">
                        {payments.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-white/20 font-black uppercase tracking-widest text-sm">
                                Sin pagos
                            </div>
                        ) : (
                            payments.map((p, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedPaymentIdx(prev => prev === idx ? null : idx)}
                                    className={`flex justify-between items-center p-4 rounded-none border cursor-pointer transition-all active:scale-95 ${selectedPaymentIdx === idx
                                        ? 'bg-indigo-500/30 border-indigo-400/60'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-200 capitalize">{p.method.toLowerCase()}</span>
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{p.processor || p.customer_name || p.method}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-black text-white">{currency}{p.amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="absolute bottom-4 right-4">
                        <button
                            onClick={() => {
                                if (selectedPaymentIdx !== null) {
                                    setPayments(prev => prev.filter((_, i) => i !== selectedPaymentIdx));
                                    setSelectedPaymentIdx(null);
                                } else {
                                    handleReset();
                                }
                            }}
                            className="w-12 h-12 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                            title={selectedPaymentIdx !== null ? 'Eliminar pago seleccionado' : 'Limpiar todos los pagos'}
                        >
                            <Trash2 size={22} />
                        </button>
                    </div>
                </div>

                {/* RIGHT PANEL: KEYPAD & METHODS */}
                <div className="w-[420px] flex flex-col gap-3 shrink-0">
                    <div className="bg-[#1e212b] p-4 border border-white/5  flex flex-col gap-4">
                        {/* AMOUNT DISPLAY */}
                        <div className="bg-black/40 rounded-2xl h-16 flex items-center justify-center text-3xl font-bold text-white border border-white/20  relative overflow-hidden">
                            <span className="tabular-nums">
                                {currency === 'Q.' ? 'Q' : currency}
                                {parseFloat(amount || '0').toFixed(2)}
                            </span>
                        </div>

                        {/* MAIN INTERACTION AREA: KEYPAD + METHODS */}
                        <div className="flex gap-2 items-stretch">
                            {/* KEYPAD GRID */}
                            <div className="grid grid-cols-4 bg-[#1a1c24] border border-white/5 rounded-md overflow-hidden gap-[1px] w-[291px] shrink-0">
                                {/* Row 1 */}
                                <button
                                    onClick={() => handleNumberClick('7')}
                                    className="w-full h-[72px] bg-[#262b36] hover:bg-[#2d3340] active:bg-[#343b4a] text-3xl font-bold flex items-center justify-center transition-all text-white border-0 outline-none"
                                >
                                    7
                                </button>
                                <button
                                    onClick={() => handleNumberClick('8')}
                                    className="w-full h-[72px] bg-[#262b36] hover:bg-[#2d3340] active:bg-[#343b4a] text-3xl font-bold flex items-center justify-center transition-all text-white border-0 outline-none"
                                >
                                    8
                                </button>
                                <button
                                    onClick={() => handleNumberClick('9')}
                                    className="w-full h-[72px] bg-[#262b36] hover:bg-[#2d3340] active:bg-[#343b4a] text-3xl font-bold flex items-center justify-center transition-all text-white border-0 outline-none"
                                >
                                    9
                                </button>
                                <button
                                    onClick={handleBackspace}
                                    className="w-full h-[72px] bg-[#262b36]/60 hover:bg-[#2d3340] active:bg-[#343b4a] flex items-center justify-center text-white/80 transition-all border-0 outline-none"
                                >
                                    <Delete size={24} />
                                </button>

                                {/* Row 2 */}
                                <button
                                    onClick={() => handleNumberClick('4')}
                                    className="w-full h-[72px] bg-[#262b36] hover:bg-[#2d3340] active:bg-[#343b4a] text-3xl font-bold flex items-center justify-center transition-all text-white border-0 outline-none"
                                >
                                    4
                                </button>
                                <button
                                    onClick={() => handleNumberClick('5')}
                                    className="w-full h-[72px] bg-[#262b36] hover:bg-[#2d3340] active:bg-[#343b4a] text-3xl font-bold flex items-center justify-center transition-all text-white border-0 outline-none"
                                >
                                    5
                                </button>
                                <button
                                    onClick={() => handleNumberClick('6')}
                                    className="w-full h-[72px] bg-[#262b36] hover:bg-[#2d3340] active:bg-[#343b4a] text-3xl font-bold flex items-center justify-center transition-all text-white border-0 outline-none"
                                >
                                    6
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="w-full h-[72px] bg-[#262b36]/60 hover:bg-[#2d3340] active:bg-[#343b4a] flex items-center justify-center text-white/50 transition-all border-0 outline-none"
                                    title="Resetear Pagos"
                                >
                                    <RotateCcw size={22} />
                                </button>

                                {/* Row 3 */}
                                <button
                                    onClick={() => handleNumberClick('1')}
                                    className="w-full h-[72px] bg-[#262b36] hover:bg-[#2d3340] active:bg-[#343b4a] text-3xl font-bold flex items-center justify-center transition-all text-white border-0 outline-none"
                                >
                                    1
                                </button>
                                <button
                                    onClick={() => handleNumberClick('2')}
                                    className="w-full h-[72px] bg-[#262b36] hover:bg-[#2d3340] active:bg-[#343b4a] text-3xl font-bold flex items-center justify-center transition-all text-white border-0 outline-none"
                                >
                                    2
                                </button>
                                <button
                                    onClick={() => handleNumberClick('3')}
                                    className="w-full h-[72px] bg-[#262b36] hover:bg-[#2d3340] active:bg-[#343b4a] text-3xl font-bold flex items-center justify-center transition-all text-white border-0 outline-none"
                                >
                                    3
                                </button>
                                <button
                                    onClick={handleAddPayment}
                                    className="row-span-2 w-full bg-[#262b36]/60 hover:bg-indigo-500/20 active:bg-indigo-500/30 text-white flex items-center justify-center transition-all border-0 outline-none"
                                >
                                    <div className="rounded-full border border-white/20 p-2.5 flex items-center justify-center hover:border-white transition-colors">
                                        <Check size={24} strokeWidth={3} />
                                    </div>
                                </button>

                                {/* Row 4 */}
                                <button
                                    onClick={() => handleNumberClick('0')}
                                    className="col-span-2 w-full h-[72px] bg-[#262b36] hover:bg-[#2d3340] active:bg-[#343b4a] text-3xl font-bold flex items-center justify-center transition-all text-white border-0 outline-none"
                                >
                                    0
                                </button>
                                <button
                                    onClick={() => handleNumberClick('.')}
                                    className="w-full h-[72px] bg-[#262b36] hover:bg-[#2d3340] active:bg-[#343b4a] text-3xl font-bold flex items-center justify-center transition-all text-white border-0 outline-none"
                                >
                                    .
                                </button>
                            </div>

                            {/* RIGHT COLUMN: PAYMENT METHODS */}
                            <div className="flex-1 flex flex-col bg-[#1a1c24] border border-white/5 rounded-md overflow-hidden gap-[1px]">
                                {[
                                    { id: 'EFECTIVO', icon: Banknote, label: 'Efectivo' },
                                    { id: 'TARJETA', icon: CreditCard, label: 'Tarjeta' },
                                    { id: 'AL CRÉDITO', icon: Wallet, label: 'Al Crédito' },
                                    { id: 'OTROS', icon: Landmark, label: 'Otros' },
                                    { id: 'PROPINA', icon: Percent, label: 'Propina' },
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => {
                                            if (m.id === 'PROPINA') {
                                                handlePropinaAction();
                                            } else {
                                                const currentVal = parseFloat(amount);

                                                // If already selected and have a value, confirm it (Double click/Quick touch)
                                                // Only confirm if it's NOT the first touch that just selected the amount
                                                if (selectedMethod === m.id && currentVal > 0 && !isAmountSelected) {
                                                    handleAddPayment();
                                                    return;
                                                }

                                                // AUTO-FILL BALANCE AND SELECT (READY TO OVERWRITE)
                                                if (balance > 0) {
                                                    setAmount(Math.max(0, balance).toFixed(2));
                                                    setIsAmountSelected(true);
                                                }

                                                setSelectedMethod(m.id);
                                            }
                                        }}
                                        className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all border-0 font-semibold tracking-wide transition-all duration-200 relative ${selectedMethod === m.id
                                            ? 'bg-indigo-500/10 text-white'
                                            : 'bg-[#262b36] text-gray-400 hover:bg-[#2d3340]'
                                            }`}
                                        style={{ fontSize: '10px' }}
                                    >
                                        <m.icon size={18} className={selectedMethod === m.id ? "text-indigo-400" : "opacity-80"} />
                                        <span className="leading-none text-center">{m.label}</span>
                                        {selectedMethod === m.id && (
                                            <div className="absolute top-1 right-1 bg-indigo-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center ">
                                                <Check size={8} strokeWidth={4} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* PAGAR BUTTON */}
                    <button
                        onClick={handleFinalize}
                        className="w-[291px] ml-4 h-16 rounded-none flex items-center justify-center text-lg font-black uppercase tracking-[0.2em]  transition-all active:scale-95 bg-blue-600 text-white hover:bg-blue-500 -500/20"
                    >
                        {existingInvoice && totalPaid >= total ? 'FINALIZAR' : 'PAGAR'}
                    </button>
                </div>
            </div>

            {/* POS SELECTOR MODAL */}
            {showPosSelector && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-[#2d2f3d] w-full max-w-2xl rounded-xl  overflow-hidden flex flex-col">
                        <div className="pt-8 pb-6 flex justify-center items-center">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">SELECCIONE POS</h3>
                        </div>

                        <div className="px-10 pb-8">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                {terminals.map(pos => (
                                    <button
                                        key={pos.id}
                                        onClick={() => setSelectedTerminal(pos)}
                                        className={`relative flex flex-col rounded-lg overflow-hidden transition-all active:scale-95 ${selectedTerminal?.id === pos.id ? 'ring-2 ring-white ' : 'ring-1 ring-white/10 hover:ring-white/30 shadow'}`}
                                    >
                                        <div className="w-full bg-white h-24 flex items-center justify-center p-4">
                                            {pos.logo_url ? (
                                                <img src={pos.logo_url} alt={pos.name} className="max-w-full max-h-full object-contain" loading="eager" fetchPriority="high" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-gray-800">
                                                    <CreditCard size={32} strokeWidth={1.5} />
                                                </div>
                                            )}
                                        </div>
                                        <div className={`w-full h-9 flex items-center justify-center text-[11px] font-bold uppercase transition-all ${selectedTerminal?.id === pos.id ? 'bg-[#43465b] text-white' : 'bg-[#353746] text-white/80'}`}>
                                            {pos.name}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pb-8 flex justify-center gap-4">
                            <button
                                onClick={() => { setShowPosSelector(false); setSelectedTerminal(null); }}
                                className="px-8 py-2.5 rounded-md border border-white/20 text-white text-xs font-bold uppercase tracking-wide hover:bg-white/5 transition-all active:scale-95 min-w-[120px]"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={() => selectedTerminal && handlePosSelect(selectedTerminal.name)}
                                disabled={!selectedTerminal}
                                className={`px-8 py-2.5 rounded-md text-white text-xs font-bold uppercase tracking-wide transition-all active:scale-95 min-w-[120px] ${selectedTerminal ? 'bg-[#7a73ff] hover:bg-[#6861ff] ' : 'bg-[#7a73ff]/50 cursor-not-allowed opacity-70'}`}
                            >
                                ACEPTAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCreditSelector && (
                <CreditSelector
                    order={{ ...order, total: pendingCreditAmount || balance }}
                    onBack={() => setShowCreditSelector(false)}
                    onSelect={handleCreditConfirm}
                    settings={settings}
                />
            )}

            {showOtherModal && (
                <OtherPaymentModal
                    isOpen={showOtherModal}
                    onClose={() => setShowOtherModal(false)}
                    onConfirm={handleOtherConfirm}
                    initialAmount={pendingOtherAmount || balance}
                    currency={currency}
                />
            )}

            {showTipModal && (
                <TipMethodModal
                    isOpen={showTipModal}
                    onClose={() => setShowTipModal(false)}
                    onConfirm={handleTipConfirm}
                    amount={pendingTipAmount || currentTip}
                    currency={currency}
                    isLocked={hasTipLock}
                />
            )}

            <InvoiceModal
                isOpen={showInvoiceModal}
                onClose={() => {
                    setShowInvoiceModal(false);
                    setInvoicePdfUrl(undefined);
                    if (invoiceSuccess) {
                        if (!isAnticipatedMode) {
                            onComplete();
                        } else {
                            // If anticipated, just reset modal state, stay in Checkout
                            setInvoiceSuccess(false);
                            setIsAnticipatedMode(false);
                        }
                    }
                }}
                onSubmit={handleInvoiceSubmit}
                total={total}
                isSuccess={invoiceSuccess}
                pdfUrl={invoicePdfUrl}
            />

            {processing && (
                <div className="fixed inset-0 bg-[#0f1115]/80 backdrop-blur-sm z-[100] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                        <span className="font-black uppercase tracking-widest text-white/40">Procesando...</span>
                    </div>
                </div>
            )}
            {/* PIN VERIFICATION FOR TIPS */}
            <PinModalV2
                isOpen={showAdminPinForTip}
                onClose={() => {
                    setShowAdminPinForTip(false);
                    setPendingTipAction(null);
                }}
                onSuccess={() => {
                    if (pendingTipAction) {
                        executeTipAction(pendingTipAction.type, pendingTipAction.method, pendingTipAction.amount);
                    }
                    setShowAdminPinForTip(false);
                    setPendingTipAction(null);
                }}
                title="AUTORIZACIÓN REQUERIDA"
                subtitle="SE REQUIERE PIN DE ADMINISTRADOR PARA MODIFICAR PROPINA"
                requiredRole="ADMIN"
                validateFn={validatePin}
                remoteAuthEnabled={true}
                authPayload={{
                    action_type: 'MODIFY_TIP',
                    action_details: `Modificar propina en Mesa ${table?.number || '?'} a Q${pendingTipAction?.amount?.toFixed(2) || '0.00'}`,
                    metadata: {
                        order_id: order?.id,
                        table_id: table?.id,
                        waiter_name: currentUser?.name,
                        tip_amount: pendingTipAction?.amount
                    }
                }}
            />
        </div>
    );
};
