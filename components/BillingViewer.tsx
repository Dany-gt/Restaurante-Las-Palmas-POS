import React, { useState, useEffect } from 'react';
import { DateUtils } from '../utils/DateUtils';
import {
    ArrowLeft, Search, Calendar, Filter, Printer, Eye,
    FileText, CheckCircle, XCircle, AlertCircle, Loader2,
    ChevronRight, Hash, User, MapPin, Receipt, Download, Trash2, Key, MessageSquare,
    Delete as Backspace, CreditCard
} from 'lucide-react';
import { supabase } from '../supabase';
import { printService } from '../services/PrintService';
import { billingService } from '../services/BillingService';

interface BillingViewerProps {
    onBack: () => void;
    currentUser: any;
    onCheckout?: (order: any) => void;
}

type BillingTab = 'FACTURADAS' | 'CONTINGENCIA';

export const BillingViewer: React.FC<BillingViewerProps> = ({ onBack, currentUser, onCheckout }) => {
    const [activeTab, setActiveTab] = useState<BillingTab>('FACTURADAS');
    const [startDate, setStartDate] = useState(DateUtils.getLocalDate());
    const [endDate, setEndDate] = useState(DateUtils.getLocalDate());
    const [searchTerm, setSearchTerm] = useState('');
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const [selectedOrderItems, setSelectedOrderItems] = useState<any[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [showVoidModal, setShowVoidModal] = useState(false);
    const [voidPin, setVoidPin] = useState('');
    const [voidNit, setVoidNit] = useState('');
    const [voidReason, setVoidReason] = useState('Error en los datos de la descripción');
    const [voiding, setVoiding] = useState(false);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [whatsAppPhone, setWhatsAppPhone] = useState('');
    const [whatsAppRecord, setWhatsAppRecord] = useState<any | null>(null);
    const [whatsAppError, setWhatsAppError] = useState('');
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

    useEffect(() => {
        fetchRecords();
    }, [activeTab, startDate, endDate]);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            // Broaden range by 12 hours both sides to handle clock mismatches and catch shifts
            const start = new Date(new Date(DateUtils.getStartOfDay(startDate)).getTime() - 12 * 60 * 60 * 1000).toISOString();
            const end = new Date(new Date(DateUtils.getEndOfDay(endDate)).getTime() + 12 * 60 * 60 * 1000).toISOString();

            const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const branchId = cachedUser?.branch_id;

            // 1. Fetch Invoices (Certified and Contingency with Record)
            let queryStart = start;
            let queryEnd = end;

            // If we are in CONTINGENCIA, strictly limit to current day (living day to day)
            if (activeTab === 'CONTINGENCIA') {
                queryStart = new Date(DateUtils.getStartOfDay(DateUtils.getLocalDate())).toISOString();
                queryEnd = new Date(DateUtils.getEndOfDay(DateUtils.getLocalDate())).toISOString();
            }

            let invoicesQuery = supabase
                .from('invoices')
                .select('*, orders!inner(*, tables(number))')
                .gte('created_at', queryStart)
                .lte('created_at', queryEnd)
                .order('created_at', { ascending: false });

            if (branchId) invoicesQuery = invoicesQuery.eq('orders.branch_id', branchId);

            const { data: allInvoices } = await invoicesQuery;

            // 2. Fetch Orders marked for contingency
            let contingencyQuery = supabase
                .from('orders')
                .select('*, tables(number)')
                .eq('is_contingency', true)
                .gte('created_at', queryStart)
                .lte('created_at', queryEnd);

            if (branchId) contingencyQuery = contingencyQuery.eq('branch_id', branchId);

            const { data: contingencyOrders } = await contingencyQuery;

            if (activeTab === 'FACTURADAS') {
                const data = allInvoices?.filter(inv => inv.uuid && inv.uuid.length > 5);
                setRecords(data || []);
            } else if (activeTab === 'CONTINGENCIA') {
                // Combine invoices that are NOT certified (Contingency) with orphaned contingency orders
                const invoiceContingency = allInvoices?.filter(inv =>
                    ((!inv.uuid || inv.uuid === '' || inv.series === 'CONT' || inv.document_number?.includes('PEND'))) &&
                    inv.status === 'ACTIVE'
                ) || [];

                const orphanedOrders = contingencyOrders?.filter(o =>
                    o.status !== 'pending' && !invoiceContingency.some(inv => inv.order_id === o.id)
                ).map(o => ({
                    ...o,
                    order_id: o.id,
                    customer_name: o.customer_name || 'CONSUMIDOR FINAL',
                    customer_nit: 'CF',
                    total: o.total,
                    grand_total: o.total,
                    tip_amount: o.tip_amount || 0,
                    discount_amount: o.discount || o.discount_amount || 0,
                    is_pure_order: true
                })) || [];

                setRecords([...invoiceContingency, ...orphanedOrders]);
            }
        } catch (err) {
            console.error('Error fetching billing records:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredRecords = records.filter(record => {
        const search = searchTerm.toLowerCase();
        const name = (record.customer_name || '').toLowerCase();
        const nit = (record.customer_nit || '').toLowerCase();
        const orderNum = String(record.order_number || record.orders?.order_number || '').toLowerCase();
        const uuid = (record.uuid || '').toLowerCase();
        const docNum = (record.document_number || '').toLowerCase();
        const series = (record.series || '').toLowerCase();
        return name.includes(search) || nit.includes(search) || orderNum.includes(search) || uuid.includes(search) || docNum.includes(search) || series.includes(search);
    });

    const handlePrint = async (record: any) => {
        if (!record) return;

        const itemsToPrint = record.id === selectedRecord?.id ? selectedOrderItems : [];
        let finalItems = itemsToPrint;

        if (finalItems.length === 0) {
            const { data: items } = await supabase.from('order_items').select('*, products(name)').eq('order_id', record.order_id || record.id);
            finalItems = (items || []).map((i: any) => ({
                name: i.products?.name || 'Item',
                quantity: i.quantity,
                price: i.unit_price
            }));
        }

        const isCancelled = record.status?.toUpperCase() === 'CANCELLED';
        const cancellationReason = record.cancellation_reason || 'Anulado';

        if (isCancelled && !record.uuid && record.series !== 'CONT') {
            const orderObj = record.orders || record;
            await printService.printCancelledTicket({
                orderId: record.order_id || record.id,
                orderNumber: orderObj?.order_number || '---',
                items: finalItems,
                createdAt: record.created_at,
                orderType: orderObj?.order_type,
                customerName: orderObj?.customer_name,
                customerPhone: orderObj?.customer_phone,
                deliveryAddress: orderObj?.delivery_address,
                tableNumber: orderObj?.tables?.number || orderObj?.table_number
            }, cancellationReason);
            return;
        }

        if (record.uuid || record.series === 'CONT') {
            const ticketData = {
                orderId: record.order_id || record.id,
                orderNumber: record.orders?.order_number || record.order_number,
                customerNit: record.customer_nit,
                customerName: record.customer_name,
                subtotal: record.subtotal,
                taxAmount: record.tax_total,
                grand_total: record.grand_total,
                total: record.grand_total || record.total,
                createdAt: record.created_at,
                isCancelled,
                cancellationReason,
                isReprint: true,
                dteInfo: record.uuid ? {
                    serie: record.series,
                    numero: record.document_number,
                    fechaCertificacion: record.certification_date,
                    autorizacion: record.uuid
                } : undefined,
                items: finalItems
            };
            printService.printInvoiceTicket(ticketData as any);
        } else {
            const ticketData = {
                orderId: record.id,
                orderNumber: record.order_number,
                createdAt: record.created_at,
                total: record.total,
                items: finalItems
            };
            printService.printPreAccountTicket(ticketData as any);
        }
    };

    const handleSelectRecord = async (record: any) => {
        setSelectedRecord(record);
        setLoadingItems(true);
        try {
            const { data: items } = await supabase
                .from('order_items')
                .select('*, products(name)')
                .eq('order_id', record.order_id || record.id);
            setSelectedOrderItems(items || []);
        } catch (err) {
            console.error('Error fetching order items:', err);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleFacturar = async (record: any) => {
        if (!record || !onCheckout) return;

        // 1. Reconstruct order object for CheckoutView
        // We use the joined record.orders if available, otherwise we use the record itself (if record is order)
        const baseOrder = record.orders || record;

        // 2. Fetch items if not already loaded (though they should be via handleSelectRecord)
        let items = selectedOrderItems;
        if (items.length === 0 || items[0].order_id !== baseOrder.id) {
            const { data } = await supabase
                .from('order_items')
                .select('*, products(*)')
                .eq('order_id', baseOrder.id);
            items = data || [];
        }

        const formattedOrder = {
            ...baseOrder,
            order_items: items, // CheckoutView expects order_items for list
            items: items.map((i: any) => ({
                ...i,
                product_name: i.products?.name || 'Producto',
                product: i.products,
                price: i.unit_price,
                unit_price: i.unit_price,
                is_sent: true
            }))
        };

        onCheckout(formattedOrder);
    };

    const getPaymentMethodDisplay = (record: any) => {
        const orderObj = record.orders || record;
        if (!orderObj) return 'N/A';

        const activeMethods: string[] = [];
        if (orderObj.cash_amount > 0) activeMethods.push('Efectivo');
        if (orderObj.card_amount > 0) {
            const processor = orderObj.card_processor 
                ? ` - ${orderObj.card_processor}` 
                : '';
            activeMethods.push(`Tarjeta${processor}`);
        }
        if (orderObj.credit_amount > 0) activeMethods.push('Crédito');
        if (orderObj.other_amount > 0) activeMethods.push('Otros');

        if (activeMethods.length > 0) {
            if (activeMethods.length === 2 && activeMethods.includes('Efectivo') && activeMethods.some(m => m.startsWith('Tarjeta'))) {
                const tarjetaPart = activeMethods.find(m => m.startsWith('Tarjeta'));
                return `${tarjetaPart} y Efectivo`;
            }
            return activeMethods.join(' y ');
        }

        return orderObj.payment_method || 'N/A';
    };

    const handleWhatsApp = async (record: any) => {
        if (!record) return;

        setWhatsAppRecord(record);
        setWhatsAppError('');
        setSendingWhatsApp(true);
        let phone = '';
        try {
            if (record.customer_nit && record.customer_nit !== 'CF') {
                const { data: cust } = await supabase
                    .from('customers')
                    .select('phone')
                    .eq('nit', record.customer_nit)
                    .maybeSingle();
                if (cust?.phone) {
                    phone = cust.phone;
                }
            }
        } catch (err) {
            console.error('Error fetching customer phone:', err);
        } finally {
            setSendingWhatsApp(false);
        }

        setWhatsAppPhone(phone || '');
        setShowWhatsAppModal(true);
    };

    const confirmWhatsApp = async () => {
        if (!whatsAppRecord) return;
        
        const cleanPhone = whatsAppPhone.replace(/\D/g, '');
        if (cleanPhone.length !== 8) {
            setWhatsAppError("El número de teléfono debe tener exactamente 8 dígitos.");
            return;
        }

        setSendingWhatsApp(true);
        // Save phone back to customers if NIT is not CF and it changed
        try {
            if (whatsAppRecord.customer_nit && whatsAppRecord.customer_nit !== 'CF') {
                await supabase.from('customers').update({ phone: cleanPhone }).eq('nit', whatsAppRecord.customer_nit);
            }
        } catch (err) {
            console.error('Error updating customer phone:', err);
        } finally {
            setSendingWhatsApp(false);
        }

        const totalVal = whatsAppRecord.grand_total || whatsAppRecord.total || 0;
        const pdfUrl = whatsAppRecord.pdf_url;
        let message = '';
        if (pdfUrl) {
            message = `¡Hola! Le saludamos de Restaurante Las Palmas.\nAgradecemos su preferencia y le compartimos el enlace para descargar su factura digital por un monto de Q${totalVal.toFixed(2)}: ${pdfUrl}.\n¡Feliz día y buen provecho!`;
        } else {
            message = `¡Hola! Le saludamos de Restaurante Las Palmas.\nAgradecemos su preferencia y le compartimos los detalles de su consumo por un monto de Q${totalVal.toFixed(2)}.\n¡Feliz día y buen provecho!`;
        }
        const url = `https://wa.me/502${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        
        setShowWhatsAppModal(false);
        setWhatsAppRecord(null);
        setWhatsAppPhone('');
    };

    const handleVoid = async () => {
        if (!selectedRecord) return;
        if (voidPin.length < 4) {
            alert('PIN incompleto');
            return;
        }

        setVoiding(true);
        try {
            // 1. Validate Admin PIN
            const { data: admin, error: pinError } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'ADMIN')
                .eq('pin', voidPin)
                .maybeSingle();

            if (pinError || !admin) {
                alert('PIN de Administrador inválido');
                setVoiding(false);
                return;
            }

            // 2. Process FEL Voiding if applicable
            let result;
            if (activeTab === 'FACTURADAS' && selectedRecord.uuid) {
                // Pass branchId, then voidNit if provided, otherwise undefined
                result = await billingService.voidInvoice(selectedRecord.order_id, voidReason, JSON.parse(localStorage.getItem('currentUser') || '{}')?.branch_id, voidNit || undefined);
                if (!result.success) {
                    alert(`Error SAT: ${result.error}`);
                    setVoiding(false);
                    return;
                }

                // Print Voided Invoice
                await printService.printInvoiceTicket({
                    ...selectedRecord,
                    items: selectedOrderItems.map(i => ({ name: i.products?.name, quantity: i.quantity, price: i.unit_price })),
                    isCancelled: true,
                    cancellationReason: voidReason
                });
            }

            // 3. Update Order Status (Return to Table as Pending)
            const orderId = selectedRecord.order_id || selectedRecord.id;
            
            // Mark invoice as CANCELLED so it disappears from the list
            if (selectedRecord.id && (selectedRecord.uuid || selectedRecord.series === 'CONT' || selectedRecord.document_number?.includes('PEND'))) {
                await supabase.from('invoices').update({ 
                    status: 'CANCELLED',
                    cancellation_reason: voidReason 
                }).eq('id', selectedRecord.id);
            }

            await supabase.from('orders').update({
                status: 'pending',        // Return to sales area
                is_paid: false,           // Mark as unpaid
                is_contingency: false,    // Clear contingency flag so it doesn't show in this list
                payment_method: null,     // Clear payment method
                cancellation_reason: voidReason,
                cancelled_at: new Date().toISOString(),
                cancelled_by: admin.id
            }).eq('id', orderId);

            // Fetch order again to get the table_id if not present in selectedRecord
            let tableIdToOccupied = selectedRecord.table_id || selectedRecord.orders?.table_id;
            if (!tableIdToOccupied) {
                const { data: ord } = await supabase.from('orders').select('table_id').eq('id', orderId).single();
                if (ord?.table_id) tableIdToOccupied = ord.table_id;
            }

            if (tableIdToOccupied) {
                await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableIdToOccupied);
            }

            // 4. Reverse Credit if applicable
            const { data: creditPayment } = await supabase
                .from('credit_transactions')
                .select('*')
                .eq('order_id', orderId)
                .eq('type', 'CHARGE')
                .maybeSingle();

            if (creditPayment) {
                // Find customer and revert balance
                const { data: customer } = await supabase.from('customers').select('*').eq('id', creditPayment.customer_id).single();
                if (customer) {
                    await supabase.from('customers').update({
                        current_balance: customer.current_balance - creditPayment.amount
                    }).eq('id', customer.id);

                    await supabase.from('credit_transactions').insert({
                        customer_id: customer.id,
                        order_id: orderId,
                        amount: creditPayment.amount,
                        type: 'PAYMENT', // Or a new 'VOID' type if you have it, PAYMENT works as reversal
                        description: `ANULACION ORDEN #${selectedRecord.order_number || '---'}`
                    });
                }
            }

            // 5. Print Cancellation Voucher
            const orderObj = selectedRecord.orders || selectedRecord;
            await printService.printCancelledTicket({
                orderId: orderId,
                orderNumber: orderObj?.order_number || '---',
                items: selectedOrderItems.map(i => ({
                    name: i.products?.name || 'Item',
                    quantity: i.quantity
                })),
                createdAt: selectedRecord.created_at,
                orderType: orderObj?.order_type,
                customerName: orderObj?.customer_name,
                customerPhone: orderObj?.customer_phone,
                deliveryAddress: orderObj?.delivery_address,
                tableNumber: orderObj?.tables?.number || orderObj?.table_number
            }, voidReason);

            alert(`✅ ${result?.error || 'Registro anulado correctamente'}`);
            setShowVoidModal(false);
            setVoidPin('');
            setVoidNit('');
            setSelectedRecord(null);
            fetchRecords();
        } catch (err: any) {
            console.error('Error during voiding:', err);
            alert(`Error: ${err.message}`);
        } finally {
            setVoiding(false);
        }
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-[#2d2e3d] text-white overflow-hidden animate-fade-in z-50">
            {/* Top Navigation Bar */}
            <div className="bg-[#3a3b4d] h-16 px-4 flex items-center justify-between shrink-0  border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3.5 bg-white/5 hover:bg-white/10 active:scale-95 rounded-xl transition-all pos-button text-gray-400 hover:text-white shrink-0">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div className="flex flex-col">
                        <h1 className="text-[11px] font-semibold tracking-widest text-white uppercase flex items-center gap-2">
                            RESTAURANTE LAS PALMAS POS
                        </h1>
                        <span className="text-[8px] font-medium text-gray-500 tracking-widest uppercase">Visor de Facturas</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-xs font-medium">{currentUser?.name || 'Usuario'}</span>
                        <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-widest">{currentUser?.role || 'Personal'}</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-medium">
                        {(currentUser?.name || 'U')[0]}
                    </div>
                </div>
            </div>

            <main className="flex-1 flex overflow-hidden">
                {/* Left Panel: Search & List */}
                <div className="w-full lg:w-[320px] xl:w-[360px] flex flex-col border-r border-white/5 bg-[#2d2e3d]  z-10">
                    {/* Header */}
                    <div className="p-3 border-b border-white/5 bg-[#3a3b4d]/30">
                        <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-[0.2em] mb-3">Facturas</h3>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div>
                                <label className="text-[8px] font-semibold text-gray-600 uppercase tracking-widest mb-1.5 block">Del</label>
                                <div className="relative">
                                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" size={12} />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-[#3a3b4d] border border-white/5 rounded-sm py-1.5 pl-8 pr-2 text-[10px] font-medium focus:border-white/50 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[8px] font-semibold text-gray-600 uppercase tracking-widest mb-1.5 block">Al</label>
                                <div className="relative">
                                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" size={12} />
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full bg-[#3a3b4d] border border-white/5 rounded-sm py-1.5 pl-8 pr-2 text-[10px] font-medium focus:border-white/50 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="relative group max-w-4xl">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                            <input
                                type="text"
                                placeholder="BUSCAR NOMBRE / NIT..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-black/40 border border-white/20 rounded-sm py-2.5 pl-10 pr-3 text-[11px] font-semibold placeholder:text-gray-500 outline-none focus:border-white/50 focus:bg-black/60 transition-all uppercase tracking-widest text-white "
                            />
                        </div>
                        {activeTab === 'CONTINGENCIA' && (
                            <div className="mt-2 text-[8px] font-semibold text-white/30 uppercase tracking-[0.2em] text-center border border-white/5 py-1 rounded-sm bg-black/20">
                                Viendo solo registros de HOY
                            </div>
                        )}
                    </div>

                    {/* Records List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        {loading && records.length === 0 ? (
                            <div className="h-full flex items-center justify-center py-20">
                                <Loader2 className="animate-spin text-gray-500" size={32} />
                            </div>
                        ) : records.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center py-20 opacity-30 text-center">
                                <FileText size={40} strokeWidth={1} />
                                <span className="text-[10px] font-semibold uppercase tracking-widest mt-4">Sin registros</span>
                            </div>
                        ) : (
                            filteredRecords.map((record) => (
                                <button
                                    key={record.id}
                                    onClick={() => handleSelectRecord(record)}
                                    className={`w-full p-2.5 rounded-sm border transition-all flex flex-col gap-1 text-left group shrink-0
                                    ${selectedRecord?.id === record.id
                                            ? 'bg-white/10 border-white '
                                            : 'bg-[#3a3b4d] border-white/5 hover:border-white/10 hover:bg-[#45465a]'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-semibold text-white group-hover:text-white uppercase truncate max-w-[140px]">
                                                {record.customer_name || 'CONSUMIDOR FINAL'}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[8px] font-semibold text-indigo-400 uppercase tracking-tighter">
                                                    ORDEN #{record.order_number || record.orders?.order_number || '---'}
                                                </span>
                                                {(record.orders?.order_type === 'DINE_IN' || record.order_type === 'DINE_IN') && (
                                                    <>
                                                        <span className="w-0.5 h-0.5 rounded-full bg-gray-600"></span>
                                                        <span className="text-[8px] font-semibold text-gray-400 uppercase tracking-tighter">
                                                            MESA {record.orders?.tables?.number || record.tables?.number || record.orders?.table?.number || record.table?.number || '---'}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-sm font-semibold tracking-tighter tabular-nums ${selectedRecord?.id === record.id ? 'text-white' : 'text-white'}`}>
                                                Q{(
                                                    record.grand_total !== undefined
                                                        ? (parseFloat((record.grand_total || 0).toString()) + parseFloat((record.tip_amount || record.tip_total || record.orders?.tip_amount || 0).toString()))
                                                        : parseFloat((record.total || 0).toString())
                                                ).toFixed(2)}
                                            </span>
                                            <div className={`flex items-center gap-1 justify-end mt-1 text-[9px] font-medium uppercase ${selectedRecord?.id === record.id ? 'text-white/60' : 'text-gray-500'}`}>
                                                <Hash size={10} />
                                                <span>{record.customer_nit || 'CF'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`flex items-center justify-between mt-1 pt-2 border-t ${selectedRecord?.id === record.id ? 'border-white/10' : 'border-white/5'}`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${record.status?.toUpperCase() === 'CANCELLED' ? 'bg-rose-500' : record.uuid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                            <span className={`text-[9px] font-semibold uppercase tracking-widest ${record.status?.toUpperCase() === 'CANCELLED' ? 'text-rose-400' : selectedRecord?.id === record.id ? 'text-white/80' : 'text-gray-500'}`}>
                                                {record.status?.toUpperCase() === 'CANCELLED' ? 'Anulada' : record.uuid ? 'Certificada' : 'Sin Facturar'}
                                            </span>
                                        </div>
                                        <span className={`text-[8px] font-medium ${selectedRecord?.id === record.id ? 'text-white/50' : 'text-gray-600'}`}>
                                            {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Bottom Tabs */}
                    <div className="p-3 border-t border-white/5 flex gap-2 shrink-0">
                        <button
                            onClick={() => setActiveTab('FACTURADAS')}
                            className={`flex-1 py-4 bg-[#3a3b4d] border ${activeTab === 'FACTURADAS' ? 'border-white/20 opacity-100 ring-1 ring-white/10' : 'border-transparent opacity-65 hover:opacity-85'} rounded-[4px] text-[10px] font-semibold uppercase tracking-wider transition-all shadow-md active:scale-95`}
                        >
                            Facturadas
                        </button>
                        <button
                            onClick={() => setActiveTab('CONTINGENCIA')}
                            className={`flex-1 py-4 bg-[#3a3b4d] border ${activeTab === 'CONTINGENCIA' ? 'border-white/20 opacity-100 ring-1 ring-white/10' : 'border-transparent opacity-65 hover:opacity-85'} rounded-[4px] text-[10px] font-semibold uppercase tracking-wider transition-all shadow-md active:scale-95`}
                        >
                            Contingencia
                        </button>
                    </div>
                </div>

                {/* Right Panel: Detail View */}
                <div className="flex-1 flex flex-col bg-[#2d2e3d] overflow-hidden relative">
                    {selectedRecord ? (
                        <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300 overflow-hidden">
                            {/* Detail Header */}
                            <div className="p-3 border-b border-white/5 flex justify-between items-center shrink-0 bg-[#3a3b4d]/50 backdrop-blur-md">
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-sm ${selectedRecord.status?.toUpperCase() === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400' : selectedRecord.uuid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/50'} border border-white/10 `}>
                                        <FileText size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-[11px] font-semibold text-white uppercase tracking-wider leading-none">
                                            {selectedRecord.status?.toUpperCase() === 'CANCELLED' ? 'ORDEN ANULADA' : selectedRecord.uuid ? 'DOCUMENTO EMITIDO' : 'ORDEN COMPLETADA'}
                                        </h2>
                                        <p className="text-[8px] font-medium text-gray-500 mt-1 uppercase tracking-widest">
                                            {selectedRecord.uuid ? `DTE: ${selectedRecord.document_number}` : 'Pendiente de emisión FEL'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    {selectedRecord.status?.toUpperCase() === 'CANCELLED' ? (
                                        <div className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-sm text-[8px] font-semibold uppercase tracking-widest">
                                            ANULADO
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowVoidModal(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 rounded-sm transition-all active:scale-95 text-[9px] font-semibold uppercase tracking-widest  -600/20"
                                        >
                                            <Trash2 size={12} />
                                            <span>Anular</span>
                                        </button>
                                    )}
                                    {selectedRecord.status?.toUpperCase() !== 'CANCELLED' && (
                                        <button
                                            onClick={() => handleWhatsApp(selectedRecord)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-sm transition-all active:scale-95 text-[9px] font-semibold uppercase tracking-widest  -600/20 text-white"
                                        >
                                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 fill-current">
                                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                                            </svg>
                                            <span>WhatsApp</span>
                                        </button>
                                    )}
                                    {activeTab === 'CONTINGENCIA' && onCheckout ? (
                                        <button
                                            onClick={() => handleFacturar(selectedRecord)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-sm transition-all active:scale-95 text-[9px] font-semibold uppercase tracking-widest  -600/20"
                                        >
                                            <Receipt size={12} />
                                            <span>Facturar</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handlePrint(selectedRecord)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-sm transition-all active:scale-95 text-[9px] font-semibold uppercase tracking-widest  -600/20"
                                        >
                                            <Printer size={12} />
                                            <span>Imprimir</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Info Area */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-black/5 border-b border-white/5 shrink-0">
                                <div className="bg-white/[0.03] p-2.5 rounded-sm border border-white/5 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <User size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[7px] font-semibold text-gray-600 uppercase tracking-widest leading-none mb-1">Cliente / NIT</p>
                                        <p className="text-[10px] font-semibold text-white uppercase truncate">{selectedRecord.customer_name || 'Consumidor Final'}</p>
                                        <p className="text-[8px] font-medium text-indigo-400/80 tracking-widest uppercase">{selectedRecord.customer_nit || 'CF'}</p>
                                    </div>
                                </div>

                                <div className="bg-white/[0.03] p-2.5 rounded-sm border border-white/5 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <Hash size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[7px] font-semibold text-gray-600 uppercase tracking-widest leading-none mb-1">Orden / Fecha</p>
                                        <p className="text-[10px] font-semibold text-white">#{selectedRecord.order_number || selectedRecord.orders?.order_number || '---'}</p>
                                        <p className="text-[9px] font-medium text-gray-400 tracking-tight mt-0.5">{new Date(selectedRecord.created_at).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</p>
                                    </div>
                                </div>

                                <div className="bg-white/[0.03] p-2.5 rounded-sm border border-white/5 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <MapPin size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[7px] font-semibold text-gray-600 uppercase tracking-widest leading-none mb-1">Origen / Tipo</p>
                                        <p className="text-[10px] font-semibold text-white uppercase truncate">
                                            {(selectedRecord.orders?.order_type || selectedRecord.order_type) === 'DINE_IN' 
                                                ? `MESA ${(selectedRecord.orders?.tables?.number || selectedRecord.tables?.number || selectedRecord.orders?.table?.number || selectedRecord.table?.number || '---')}`
                                                : (selectedRecord.orders?.order_type || selectedRecord.order_type) === 'TAKEOUT'
                                                    ? 'PARA LLEVAR'
                                                    : (selectedRecord.orders?.order_type || selectedRecord.order_type) === 'DELIVERY'
                                                        ? 'A DOMICILIO'
                                                        : 'VENTA GENERAL'
                                            }
                                        </p>
                                        <p className="text-[8px] font-medium text-indigo-400/80 tracking-widest uppercase">
                                            {selectedRecord.orders?.order_type || selectedRecord.order_type || 'GENERAL'}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white/[0.03] p-2.5 rounded-sm border border-white/5 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <CreditCard size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[7px] font-semibold text-gray-600 uppercase tracking-widest leading-none mb-1">Forma de Pago</p>
                                        <p className="text-[10px] font-semibold text-white uppercase truncate">
                                            {getPaymentMethodDisplay(selectedRecord)}
                                        </p>
                                        {(selectedRecord.orders?.card_processor || selectedRecord.card_processor) && (
                                            <p className="text-[8px] font-medium text-indigo-400/80 tracking-widest uppercase truncate">
                                                {selectedRecord.orders?.card_processor || selectedRecord.card_processor}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Table Area: Flexible and Scrollable */}
                            <div className="flex-1 flex flex-col p-3 overflow-hidden">
                                <div className="flex-1 flex flex-col bg-[#3a3b4d] border border-white/5 rounded-sm overflow-hidden ">
                                    <div className="grid grid-cols-12 px-4 py-2 bg-black/40 border-b border-white/5 text-[8px] font-semibold text-gray-500 uppercase tracking-[0.2em]">
                                        <div className="col-span-1">Ct.</div>
                                        <div className="col-span-7">Descripción</div>
                                        <div className="col-span-2 text-right">Unit.</div>
                                        <div className="col-span-2 text-right">Total</div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        {loadingItems ? (
                                            <div className="h-full flex flex-col items-center justify-center gap-3 py-20">
                                                <Loader2 size={32} className="animate-spin text-indigo-500 opacity-50" />
                                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">Sincronizando ítems...</span>
                                            </div>
                                        ) : selectedOrderItems.length > 0 ? (
                                            <div className="flex flex-col min-h-full">
                                                <div className="flex-1">
                                                    {selectedOrderItems.map((item, idx) => (
                                                        <div key={idx} className="grid grid-cols-12 px-6 py-4 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center group">
                                                            <div className="col-span-1 text-xs font-semibold text-indigo-400">{item.quantity}</div>
                                                            <div className="col-span-7 text-xs font-semibold uppercase text-gray-300 tracking-tight group-hover:text-white transition-colors">
                                                                {item.products?.name || 'Producto'}
                                                            </div>
                                                            <div className="col-span-2 text-right text-[11px] font-medium text-gray-500 tabular-nums">
                                                                Q{item.unit_price.toFixed(2)}
                                                            </div>
                                                            <div className="col-span-2 text-right text-xs font-semibold text-white tabular-nums">
                                                                Q{(item.quantity * item.unit_price).toFixed(2)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Integrated Totals Section - CLEAN TEXT NO BORDER */}
                                                <div className="mt-6 pt-4 border-t border-white/5">
                                                    <div className="ml-auto w-full max-w-[220px] space-y-1">
                                                        {(() => {
                                                            const isInvoice = selectedRecord.grand_total !== undefined;
                                                            const tip = parseFloat((selectedRecord.tip_amount || selectedRecord.tip_total || selectedRecord.orders?.tip_amount || 0).toString());
                                                            const discount = parseFloat((selectedRecord.discount || selectedRecord.discount_amount || selectedRecord.orders?.discount || selectedRecord.orders?.discount_amount || 0).toString());
                                                            const totalPaid = isInvoice ? (parseFloat((selectedRecord.grand_total || 0).toString()) + tip) : parseFloat((selectedRecord.total || 0).toString());
                                                            const subTotalVal = totalPaid - tip + discount;
                                                            return (
                                                                <>
                                                                    <div className="flex justify-between text-[12px] items-center">
                                                                        <span className="text-gray-400 font-medium uppercase tracking-widest leading-none">Sub-Total</span>
                                                                        <span className="font-semibold tabular-nums text-white/95">Q{subTotalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-[12px] items-center mt-1">
                                                                        <span className="text-gray-400 font-medium uppercase tracking-widest leading-none">Descuento</span>
                                                                        <span className="font-semibold tabular-nums text-white/95">-Q{discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-[12px] items-center mt-1">
                                                                        <span className="text-gray-400 font-medium uppercase tracking-widest leading-none">Propina</span>
                                                                        <span className="font-semibold tabular-nums text-white/95">Q{tip.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                    <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-baseline">
                                                                        <span className="text-[11px] font-semibold text-white/45 uppercase tracking-widest leading-none">Total</span>
                                                                        <span className="text-2xl font-semibold tabular-nums text-white leading-none">Q{totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-700 py-20 opacity-50">
                                                <FileText size={48} strokeWidth={1} />
                                                <span className="text-[10px] font-semibold uppercase mt-4">No hay contenido</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-20 opacity-50">
                            <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/10 ">
                                <FileText size={64} className="text-white/40" strokeWidth={1} />
                            </div>
                            <h3 className="text-2xl font-semibold uppercase tracking-[0.4em] text-white/60 mb-3">Visor de Detalles</h3>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest max-w-[300px] leading-relaxed">
                                Seleccione un registro de la lista para ver el desglose completo
                            </p>
                        </div>
                    )}
                </div>
            </main>

            {/* Void Modal */}
            {
                showVoidModal && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-[#14171c] w-full max-w-4xl h-auto max-h-[90vh] sm:h-[540px] rounded-[2rem] border border-white/10  overflow-hidden flex">
                            {/* Left Side: Info & Keypad */}
                            <div className="w-1/2 flex flex-col border-r border-white/5 bg-black/20 shrink-0">
                                <div className="p-4 sm:p-6 border-b border-white/5 bg-white/[0.02]">
                                    <span className="text-[9px] font-semibold uppercase tracking-[0.4em] text-rose-500">Procedimiento Seguro</span>
                                    <h3 className="text-lg sm:text-xl font-semibold text-white uppercase tracking-tighter">PIN DE ADMINISTRADOR</h3>
                                    {selectedRecord?.uuid && (
                                        <p className="text-[10px] font-medium text-gray-400 mt-2 break-all text-center">
                                            UUID: {selectedRecord.uuid}
                                        </p>
                                    )}
                                </div>

                                <div className="flex-1 p-4 sm:p-6 flex flex-col justify-center">
                                    {/* PIN Display */}
                                    <div className="flex gap-4 justify-center mb-8">
                                        {[...Array(4)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-3.5 h-3.5 rounded-full transition-all duration-300 border ${voidPin.length > i
                                                    ? 'bg-rose-500 border-rose-500 '
                                                    : 'bg-white/5 border-white/10'
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    {/* Numeric Grid */}
                                    <div className="grid grid-cols-3 gap-2 w-64 mx-auto">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                            <button
                                                key={num}
                                                onClick={() => voidPin.length < 4 && setVoidPin(v => v + num)}
                                                className="h-10 rounded-sm bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-semibold transition-all active:scale-90"
                                            >
                                                {num}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setVoidPin('')}
                                            className="h-10 rounded-sm bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 text-[9px] font-semibold uppercase transition-all active:scale-90"
                                        >
                                            Limpiar
                                        </button>
                                        <button
                                            onClick={() => voidPin.length < 4 && setVoidPin(v => v + '0')}
                                            className="h-10 rounded-sm bg-white/5 hover:bg-white/10 border border-white/5 text-lg font-semibold transition-all active:scale-90"
                                        >
                                            0
                                        </button>
                                        <button
                                            onClick={() => setVoidPin(v => v.slice(0, -1))}
                                            className="h-10 rounded-sm bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center transition-all active:scale-90"
                                        >
                                            <Backspace size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Reason & Confirmation */}
                            <div className="w-1/2 flex flex-col bg-[#2d2e3d]">
                                <div className="p-4 sm:p-6 border-b border-white/5 flex justify-end">
                                    <button onClick={() => { setShowVoidModal(false); setVoidPin(''); }} className="p-2 text-gray-500 hover:bg-white/5 hover:text-white rounded-full transition-colors active:scale-95">
                                        <XCircle size={24} />
                                    </button>
                                </div>

                                <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                                <MessageSquare size={12} className="text-rose-500" />
                                                Motivo de Anulación
                                            </label>
                                            <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                                                {[
                                                    'Error en los datos de la descripción',
                                                    'Error en el precio unitario',
                                                    'Error en el total del DTE',
                                                    'No cancelación del bien y/o servicio',
                                                    'Cancelación de la operación',
                                                    'Devolución de producto',
                                                    'Emisión con moneda incorrecta',
                                                    'Datos incorrectos del receptor',
                                                    'Otros'
                                                ].map((reason) => (
                                                    <button
                                                        key={reason}
                                                        onClick={() => setVoidReason(reason)}
                                                        className={`p-3 rounded-sm text-xs text-left font-medium transition-all border ${voidReason === reason
                                                            ? 'bg-rose-500/10 border-rose-500/50 text-white'
                                                            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        {reason}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {voidReason === 'Otros' && (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder="Especifique el motivo..."
                                                    onChange={(e) => setVoidReason(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/5 rounded-sm p-3 text-xs font-medium text-white focus:border-rose-500/50 outline-none transition-all uppercase"
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-2 pt-4 border-t border-white/5">
                                            <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                                NIT Receptor (Opcional)
                                            </label>
                                            <p className="text-[8px] sm:text-[9px] text-gray-500 mb-2 leading-tight">
                                                Original: <span className="text-white font-medium">{selectedRecord?.customer_nit || 'CF'}</span>.
                                                Ingrese un NIT diferente solo si el DTE de la SAT lo requiere.
                                            </p>
                                            <input
                                                type="text"
                                                placeholder="NIT a anular si difiere..."
                                                value={voidNit}
                                                onChange={(e) => setVoidNit(e.target.value)}
                                                className="w-full bg-black/40 border border-white/5 rounded-sm p-3 text-xs font-medium text-white focus:border-indigo-500/50 outline-none transition-all uppercase tracking-widest placeholder:text-gray-700"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 sm:p-6 border-t border-white/5 bg-[#3a3b4d] space-y-4 shrink-0">
                                    <div className="p-3 rounded-sm bg-amber-500/5 border border-amber-500/10 flex gap-3 items-center">
                                        <AlertCircle className="text-amber-500 shrink-0" size={16} />
                                        <p className="text-[9px] font-medium text-amber-500/80 uppercase leading-snug tracking-wider">
                                            Acción irreversible. Anulará en el sistema local y la SAT si corresponde.
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleVoid}
                                        disabled={voiding || voidPin.length < 4}
                                        className={`w-full h-12 rounded-sm font-semibold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 text-xs
                                        ${voidPin.length === 4 && !voiding
                                                ? 'bg-rose-600 text-white hover:bg-rose-500  -600/30 active:scale-95'
                                                : 'bg-white/5 text-gray-700 cursor-not-allowed border border-white/5'}`}
                                    >
                                        {voiding ? (
                                            <>
                                                <Loader2 size={20} className="animate-spin" />
                                                <span>Procesando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 size={18} />
                                                <span>Confirmar Anulación</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* WhatsApp Modal */}
            {/* WhatsApp Modal */}
            {showWhatsAppModal && (
                <div className="fixed inset-0 bg-transparent z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-[#2d2e3d] w-full max-w-sm rounded-none border border-white/10  overflow-hidden flex flex-col pointer-events-auto">
                        {/* Dashboard Header */}
                        <div className="bg-[#3a3b4d] h-10 px-3 flex justify-between items-center shrink-0 select-none rounded-none border-b border-white/5">
                            <span className="text-white text-[11px] font-semibold uppercase tracking-wider">Compartir por WhatsApp</span>
                            <button 
                                onClick={() => { setShowWhatsAppModal(false); setWhatsAppPhone(''); setWhatsAppRecord(null); setWhatsAppError(''); }}
                                className="w-8 h-8 flex items-center justify-center hover:bg-white/5 text-gray-400 hover:text-white transition-all rounded-none"
                                title="Cerrar"
                            >
                                <XCircle size={18} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Dashboard Form Body */}
                        <div className="p-4 bg-[#2d2e3d] flex flex-col gap-4 border-b border-white/5">
                            {/* Input Display */}
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest block">
                                    Número de Teléfono (Guatemala)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 tracking-wider">
                                        +502
                                    </span>
                                    <input
                                        type="text"
                                        readOnly
                                        placeholder="Ingrese 8 dígitos"
                                        value={whatsAppPhone}
                                        className="w-full bg-black/40 border border-white/10 rounded-none p-2.5 pl-12 text-sm font-medium text-white outline-none tracking-[0.2em] placeholder:text-gray-700 focus:border-white/30"
                                    />
                                </div>
                                {whatsAppError && (
                                    <p className="text-[9px] font-medium text-rose-500 uppercase tracking-wide">
                                        {whatsAppError}
                                    </p>
                                )}
                            </div>

                            {/* Touch Numeric Grid Keyboard */}
                            <div className="grid grid-cols-3 gap-2 w-60 mx-auto mt-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => {
                                            setWhatsAppError('');
                                            if (whatsAppPhone.length < 8) {
                                                setWhatsAppPhone(p => p + num);
                                            }
                                        }}
                                        className="h-9 rounded-none bg-white/5 hover:bg-white/10 border border-white/5 text-white text-sm font-medium transition-all active:scale-95 "
                                    >
                                        {num}
                                    </button>
                                ))}
                                <button
                                    onClick={() => { setWhatsAppPhone(''); setWhatsAppError(''); }}
                                    className="h-9 rounded-none bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[10px] font-medium uppercase transition-all active:scale-95 "
                                >
                                    Limpiar
                                </button>
                                <button
                                    onClick={() => {
                                        setWhatsAppError('');
                                        if (whatsAppPhone.length < 8) {
                                            setWhatsAppPhone(p => p + '0');
                                        }
                                    }}
                                    className="h-9 rounded-none bg-white/5 hover:bg-white/10 border border-white/5 text-white text-base font-medium transition-all active:scale-95 "
                                >
                                    0
                                </button>
                                <button
                                    onClick={() => {
                                        setWhatsAppError('');
                                        setWhatsAppPhone(p => p.slice(0, -1));
                                    }}
                                    className="h-9 rounded-none bg-white/5 hover:bg-white/10 border border-white/5 text-white flex items-center justify-center transition-all active:scale-95 "
                                >
                                    <Backspace size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Dashboard Footer */}
                        <div className="p-4 bg-[#3a3b4d]/30 flex flex-col gap-2 rounded-none">
                            <button
                                onClick={confirmWhatsApp}
                                disabled={sendingWhatsApp || whatsAppPhone.length !== 8}
                                className={`w-full h-10 rounded-none font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 text-xs text-white border
                                ${whatsAppPhone.length === 8 && !sendingWhatsApp
                                        ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-700 active:scale-95 '
                                        : 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed'}`}
                            >
                                {sendingWhatsApp ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 fill-current">
                                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                                        </svg>
                                        <span>Aceptar</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
