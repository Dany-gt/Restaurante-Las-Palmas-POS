
import React, { useState, useEffect } from 'react';
import { Order, User, Table, OrderItem, POSTerminal, Customer } from '../types';
import { ChevronLeft, Delete, Check, CreditCard, Banknote, Landmark, Wallet, Percent, User as UserIcon, Printer, FileText, ShoppingCart, X, RotateCcw } from 'lucide-react';
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
    const [payments, setPayments] = useState<{ method: string, amount: number, processor?: string, customer_id?: string, customer_name?: string }[]>([]);
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
    const [discount, setDiscount] = useState(0); // Nuevo estado para el descuento
    const [processing, setProcessing] = useState(false);
    const [terminals, setTerminals] = useState<POSTerminal[]>([]);
    const [invoiceSuccess, setInvoiceSuccess] = useState(false);
    const [existingInvoice, setExistingInvoice] = useState<any>(null);
    const [isAnticipatedMode, setIsAnticipatedMode] = useState(false);
    const [showAdminPinForTip, setShowAdminPinForTip] = useState(false);
    const [pendingTipAction, setPendingTipAction] = useState<{ type: 'CONFIRM' | 'SIN_PROPINA', method?: 'EFECTIVO' | 'TARJETA' | 'OTROS', amount?: number } | null>(null);
    const [isAmountSelected, setIsAmountSelected] = useState(false);

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
    const subtotal = order.subtotal || 0;
    const tax = order.tax_amount || 0;
    const total = subtotal - discount + currentTip; // El total ahora considera el descuento aplicado

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
        const rawTip = val > 0 ? val : (subtotal * tipPercentage);

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
        const rawSuggested = subtotal * suggestedTipRate;
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
            customer_name: data.documentNo // We'll re-use 'customer_name' for doc no
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
            const discAmount = (order.subtotal * discPercent) / 100;
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
        if (totalPaid < total) {
            return;
        }

        if (existingInvoice) {
            // Case: Already invoiced, just need to close order and save payments
            setProcessing(true);
            try {
                // Determine payment method and processor
                const cardPayment = payments.find(p => p.method === 'TARJETA');
                const mainPaymentMethod = payments.length > 0 ? payments[0].method : 'EFECTIVO';
                const hasCashPayment = payments.some(p => p.method === 'EFECTIVO');

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
                    subtotal: subtotal - tax,
                    tax_amount: tax,
                    cashier_id: currentUser?.id,
                    cash_amount: breakdown.cash_amount,
                    card_amount: breakdown.card_amount,
                    credit_amount: breakdown.credit_amount,
                    other_amount: breakdown.other_amount,
                    total_paid: breakdown.total_paid,
                    change_amount: breakdown.change_amount
                }).eq('id', order.id);

                if (updateError) throw updateError;
                if (table?.id) await supabase.from('tables').update({ status: 'available' }).eq('id', table.id);

                printService.openCashDrawer({
                    orderId: order.id,
                    userId: currentUser?.id || '',
                    userName: currentUser?.name || 'Cajero',
                    amount: hasCashPayment ? (payments.find(p => p.method === 'EFECTIVO')?.amount || total) : 0,
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
                            pagos: payments.map(p => ({ metodo: p.method, monto: p.amount, procesador: p.processor })),
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
                        price: subtotal
                    }] : ((order as any).order_items || []).map((i: any) => ({
                        name: i.products?.name || 'Producto',
                        quantity: i.quantity,
                        price: i.unit_price
                    })),
                    subtotal: subtotal - tax,
                    taxAmount: tax,
                    tipAmount: currentTip,
                    discountAmount: 0,
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

            const invoiceItems = billingService.buildInvoiceItems(
                (order as any).order_items?.map((i: any) => ({
                    name: i.products?.name || 'Producto',
                    quantity: i.quantity,
                    unit_price: i.unit_price
                })) || []
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
                    subtotal: subtotal - tax,
                    tax_total: tax,
                    discount_total: discount,
                    grand_total: billingMethod === 'CARD' ? (subtotal - discount) + currentTip : (subtotal - discount),
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
                    subtotal: subtotal - tax,
                    tax_total: tax,
                    discount_total: discount,
                    grand_total: billingMethod === 'CARD' ? (subtotal - discount) + currentTip : (subtotal - discount),
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
                        subtotal: subtotal - tax,
                        tax_amount: tax,
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
                    items: (order as any).order_items?.map((i: any) => ({
                        product_id: i.product_id,
                        quantity: i.quantity,
                        unit_price: i.unit_price,
                        notes: i.notes
                    })) || [],
                    invoice: {
                        customer_nit: customer.nit,
                        customer_name: customer.name,
                        series: 'CONT',
                        document_number: `OFF-${(order as any).order_number || order.id.slice(0, 5)}`,
                        subtotal: (subtotal - discount) - tax + (billingMethod === 'CARD' ? (currentTip - (currentTip - (currentTip / 1.12))) : 0),
                        tax_total: tax + (billingMethod === 'CARD' ? (currentTip - (currentTip / 1.12)) : 0),
                        grand_total: billingMethod === 'CARD' ? (subtotal - discount) + currentTip : (subtotal - discount),
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
                                price: subtotal
                            }] : ((order as any).order_items || []).map((i: any) => ({
                                name: i.products?.name || 'Producto',
                                quantity: i.quantity,
                                price: i.unit_price
                            })),
                            subtotal: subtotal - tax,
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
                if (table?.id) await supabase.from('tables').update({ status: 'available' }).eq('id', table.id);

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
                                cliente_credito: p.customer_name
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
                            price: subtotal
                        }] : ((order as any).order_items || []).map((i: any) => ({
                            name: i.products?.name || 'Producto',
                            quantity: i.quantity,
                            price: i.unit_price
                        })),
                        subtotal: subtotal - tax,
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
                    <div className="hidden md:flex flex-col items-center leading-none bg-black/40 px-3 py-1.5 rounded-2xl border border-white/5 shadow-inner">
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
                    <div className="bg-[#1e212b] rounded-3xl p-6 flex flex-col gap-3 border border-white/5 shadow-2xl">
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
                                if (mAmount === 0) return null;
                                return (
                                    <div key={method} className="flex flex-col gap-0.5">
                                        <div className="flex justify-between text-white text-xs font-bold uppercase tracking-wider">
                                            <span>{method}</span>
                                            <span>{currency}{mAmount.toFixed(2)}</span>
                                        </div>
                                        {method === 'TARJETA' && methodPayments.map((p, i) => (
                                            <div key={i} className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-4">
                                                <span>• {p.processor || 'S/E'}</span>
                                                <span>{currency}{p.amount.toFixed(2)}</span>
                                            </div>
                                        ))}
                                        {method === 'AL CRÉDITO' && methodPayments.map((p, i) => (
                                            <div key={i} className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-4">
                                                <span>• {p.customer_name || 'S/E'}</span>
                                                <span>{currency}{p.amount.toFixed(2)}</span>
                                            </div>
                                        ))}
                                        {method === 'OTROS' && methodPayments.map((p, i) => (
                                            <div key={i} className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-4 leading-tight">
                                                <span>• {p.processor} {p.customer_name ? `(${p.customer_name})` : ''}</span>
                                                <span>{currency}{p.amount.toFixed(2)}</span>
                                            </div>
                                        ))}
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
                            {change > 0 && (
                                <div className="flex justify-between text-white text-sm font-black uppercase leading-tight tracking-tighter">
                                    <span>CAMBIO</span>
                                    <span>{currency}{change.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {!existingInvoice && totalPaid < total && (
                        <button
                            onClick={handleAnticipatedInvoice}
                            className="w-full py-5 rounded-3xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-black uppercase tracking-[0.2em] text-[11px] transition-all active:scale-95 flex items-center justify-center gap-3 shadow-2xl group"
                        >
                            <FileText size={22} className="group-hover:scale-110 transition-transform" /> Factura Anticipada
                        </button>
                    )}
                </div>

                {/* MIDDLE PANEL: ITEMS LIST */}
                <div className="flex-1 bg-[#1e212b] rounded-3xl border border-white/5 shadow-2xl overflow-hidden flex flex-col">
                    <div className="p-2 sm:p-3 border-b border-white/5 bg-white/5 flex items-center justify-between text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-wider text-gray-300 relative">
                        {/* Left spacer to help center the middle content */}
                        <div className="w-1 sm:w-6 hidden lg:block"></div>

                        <div className="flex-1 flex flex-nowrap justify-center items-center gap-x-1 sm:gap-x-2 overflow-hidden whitespace-nowrap">
                            <span className="text-white shrink-0">ORDEN: #{(order as any).order_number || '...'}</span>
                            <span className="text-gray-600 shrink-0">|</span>
                            <span className="text-white font-black shrink-0 uppercase tracking-widest">
                                {!order.customer_name || order.customer_name.toUpperCase() === 'CUENTA PRINCIPAL' ? 'CUENTA 1' : order.customer_name}
                            </span>
                            <span className="text-gray-600 shrink-0">|</span>
                            <span className="text-white shrink-0">{table?.section || 'SALA'}</span>
                            <span className="text-gray-600 shrink-0">|</span>
                            <span className="text-white shrink-0">MESA: {table?.number || '?'}</span>
                            <span className="text-gray-600 shrink-0">|</span>
                            <span className="text-gray-400 shrink-0">ATIENDE: {(order as any).profiles?.name || currentUser?.name || 'Mesero'}</span>
                            <span className="text-gray-600 shrink-0">|</span>
                            <span className="text-white font-black shrink-0 uppercase tracking-widest">
                                {order.items?.length || 0} PLATILLOS
                            </span>
                        </div>

                        <div className="w-2 sm:w-12 hidden lg:block"></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-2">
                        {order.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white font-black">
                                        {item.quantity}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-200">{item.product_name}</span>
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{currency}{(item.unit_price || 0).toFixed(2)} c/u</span>
                                    </div>
                                </div>
                                <span className="text-sm font-black text-white">{currency}{((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT PANEL: KEYPAD & METHODS */}
                <div className="w-[380px] flex flex-col gap-3 shrink-0">
                    <div className="bg-[#1e212b] rounded-3xl p-4 border border-white/5 shadow-2xl flex flex-col gap-4">
                        {/* AMOUNT DISPLAY */}
                        <div className={`bg-black/40 rounded-2xl h-16 flex items-center justify-end px-6 text-3xl font-black tabular-nums tracking-tighter border transition-all duration-300 shadow-inner relative overflow-hidden ${isAmountSelected ? 'text-white border-white/30 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]' : 'text-white/30 border-white/10'}`}>
                            {isAmountSelected && (
                                <div className="absolute inset-x-0 bottom-0 top-0 bg-white/5 animate-pulse pointer-events-none" />
                            )}
                            <span className={`mr-2 text-xl ${isAmountSelected ? 'text-white/50' : 'text-white/20'}`}>{currency}</span>
                            {amount}
                        </div>

                        {/* MAIN INTERACTION AREA: KEYPAD + METHODS */}
                        <div className="flex gap-4 items-stretch">
                            {/* LEFT COLUMN: NUMBERS & CONTROLS (approx 70%) */}
                            <div className="flex gap-2">
                                {/* NUMBERS */}
                                <div className="grid grid-cols-3 gap-2">
                                    {[7, 8, 9, 4, 5, 6, 1, 2, 3, 0, '.'].map(n => (
                                        <button
                                            key={n.toString()}
                                            onClick={() => handleNumberClick(n.toString())}
                                            className={`w-14 h-14 rounded-2xl bg-[#262b36] border border-white/5 flex items-center justify-center text-xl font-black transition-all active:scale-95 hover:bg-[#2d3340] hover:border-white/20 ${n === 0 ? 'col-span-2 w-auto' : ''}`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>

                                {/* CONTROLS */}
                                <div className="flex flex-col gap-2 w-14">
                                    <button onClick={handleBackspace} className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white/80 transition-all active:scale-95 hover:bg-white/10"><Delete size={20} /></button>
                                    <button onClick={handleReset} className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 transition-all active:scale-95 hover:bg-white/10" title="Resetear Pagos"><RotateCcw size={18} /></button>
                                    <button onClick={handleAddPayment} className="w-14 flex-1 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white transition-all active:scale-95 hover:bg-white/20"><Check size={24} /></button>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: PAYMENT METHODS (approx 30%) */}
                            <div className="flex-1 flex flex-col gap-2">
                                {[
                                    { id: 'EFECTIVO', icon: Banknote, label: 'Efectivo' },
                                    { id: 'TARJETA', icon: CreditCard, label: 'Tarjeta' },
                                    { id: 'AL CRÉDITO', icon: Wallet, label: 'Crédito' },
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
                                        className={`flex-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border font-black uppercase tracking-[0.1em] transition-all duration-200 ${selectedMethod === m.id
                                            ? 'bg-white text-black border-white'
                                            : 'bg-[#262b36] border-white/5 text-gray-400 hover:border-white/20 hover:bg-[#2d3340]'
                                            }`}
                                        style={{ fontSize: '9px' }}
                                    >
                                        <m.icon size={18} className="opacity-80" />
                                        <span className="leading-none text-center">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleFinalize}
                            disabled={totalPaid < total}
                            className={`h-16 rounded-2xl flex items-center justify-center text-lg font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 ${totalPaid >= total ? 'bg-white text-black shadow-white/10' : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'}`}
                        >
                            {existingInvoice && totalPaid >= total ? 'FINALIZAR' : 'PAGAR'}
                        </button>
                    </div>
                </div>
            </div>

            {/* POS SELECTOR MODAL */}
            {showPosSelector && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[120] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-[#14171c] w-full max-w-4xl rounded-[3rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Selección de Procesador</span>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">SELECCIONE POS</h3>
                            </div>
                            <button onClick={() => { setShowPosSelector(false); setSelectedTerminal(null); }} className="p-3 bg-white/5 rounded-full text-white transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-10 md:p-14 mb-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                                {terminals.map(pos => (
                                    <button
                                        key={pos.id}
                                        onClick={() => setSelectedTerminal(pos)}
                                        className={`group relative aspect-[1.4/1] bg-white rounded-3xl flex flex-col items-center justify-center p-6 transition-all active:scale-95 border-4 ${selectedTerminal?.id === pos.id ? 'border-black ring-8 ring-white/10 shadow-2xl' : 'border-transparent shadow-xl'}`}
                                    >
                                        <div className="flex-1 w-full flex items-center justify-center p-2">
                                            {pos.logo_url ? (
                                                <img src={pos.logo_url} alt={pos.name} className="max-w-full max-h-[80%] object-contain transition-all group-hover:scale-110" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-3 text-gray-300">
                                                    <CreditCard size={48} />
                                                </div>
                                            )}
                                        </div>
                                        <div className={`w-full h-10 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-xl mt-2 ${selectedTerminal?.id === pos.id ? 'bg-black text-white' : 'bg-black/5 text-gray-400 group-hover:bg-black/10 group-hover:text-black'}`}>
                                            {pos.name}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-10 bg-[#0d0f13] border-t border-white/5 flex gap-6">
                            <button
                                onClick={() => { setShowPosSelector(false); setSelectedTerminal(null); }}
                                className="flex-1 h-16 rounded-[1.5rem] border border-white/10 bg-white/5 font-black uppercase tracking-[0.2em] text-[11px] text-gray-500 hover:text-white transition-all active:scale-95"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={() => selectedTerminal && handlePosSelect(selectedTerminal.name)}
                                disabled={!selectedTerminal}
                                className={`flex-1 h-16 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[11px] transition-all flex items-center justify-center gap-3 active:scale-95 ${selectedTerminal ? 'bg-white text-black hover:bg-white/90 shadow-xl' : 'bg-white/5 text-white/20 cursor-not-allowed opacity-50'}`}
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
