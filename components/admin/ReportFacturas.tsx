import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import {
    Search, Download, Clock, FileText, Loader2, Filter, Printer,
    CalendarDays, Building, BarChart3, Receipt, FileSearch, Trash2,
    Eye, X, ShoppingCart, CreditCard, User, Clock as ClockIcon, ExternalLink,
    FileSpreadsheet, Calculator, ClipboardList, TrendingUp
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { DraggableWindow } from './DraggableWindow';

interface ReportFacturasProps {
    mode?: 'REP_INV' | 'REP_INV_VOID' | 'REP_INV_CONT';
}

export const ReportFacturas: React.FC<ReportFacturasProps> = ({ mode = 'REP_INV' }) => {
    const getLocalISOString = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const formatCurrRaw = (v: number) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // --- MODAL DE VISTA PREVIA DE IMPRESIÓN (Facturas) ---
    const InvoiceReportPrintPreview: React.FC<{
        isOpen: boolean,
        onClose: () => void,
        data: any[],
        totals: any,
        filters: { start: string, end: string, branch: string, mode: string },
        userId: string
    }> = ({ isOpen, onClose, data, totals, filters, userId }) => {
        const printRef = React.useRef<HTMLDivElement>(null);
        const handlePrint = useReactToPrint({
            contentRef: printRef,
            documentTitle: `Reporte_Facturacion_${filters?.start || 'export'}`,
        });

        if (!isOpen) return null;

        const getModeTitle = () => {
            if (filters.mode === 'REP_INV_VOID') return 'FACTURAS ANULADAS (CRONOLÓGICO)';
            if (filters.mode === 'REP_INV_CONT') return 'REPORTE DE CONTINGENCIA (MANUAL)';
            return 'LIBRO DE VENTAS Y FACTURACIÓN';
        };

        return createPortal(
            <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
                <DraggableWindow id="invoice-print-preview" title="Vista Previa de Impresión">
                    <div className="bg-[#f0f0f0] border-2 border-[#106ebe] shadow-2xl flex flex-col w-[98vw] max-w-7xl h-[95vh] overflow-hidden select-none font-sans rounded-sm">
                        {/* Toolbar */}
                        <div className="modal-header bg-[#106ebe] h-10 px-4 flex justify-between items-center text-white shrink-0 cursor-move border-b border-black">
                            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
                                <Printer size={16} className="text-emerald-400" />
                                <span>Contingencia y Auditoría - Vista Previa de {getModeTitle()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handlePrint()} className="h-7 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-[10px] font-black uppercase flex items-center gap-2 transition-colors border border-blue-400/30">
                                    <Printer size={12} strokeWidth={3} /> IMPRIMIR PDF
                                </button>
                                <button onClick={() => {
                                    const ws = XLSX.utils.json_to_sheet(data.map(r => ({
                                        Fecha: new Date(r.creada).toLocaleDateString(),
                                        Orden: r.noOrden,
                                        Serie: r.serie,
                                        Numero: r.numero,
                                        Firma: r.firma,
                                        Cliente: r.cliente,
                                        NIT: r.nit,
                                        Monto: r.monto
                                    })));
                                    const wb = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
                                    XLSX.writeFile(wb, `Reporte_Facturacion_${filters.start}.xlsx`);
                                }} className="h-7 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[10px] font-black uppercase flex items-center gap-2 transition-colors border border-emerald-400/30">
                                    <FileSpreadsheet size={12} strokeWidth={3} /> EXCEL
                                </button>
                                <button onClick={onClose} className="h-8 w-8 flex items-center justify-center hover:bg-red-500 transition-colors text-white ml-2 rounded-sm">
                                    <X size={22} strokeWidth={3} />
                                </button>
                            </div>
                        </div>

                        {/* Hoja Membretada */}
                        <div className="flex-1 overflow-auto bg-slate-700 p-8 custom-scrollbar shadow-inner">
                            <div ref={printRef} className="bg-white mx-auto p-12 shadow-2xl min-h-full w-[1200px] text-black print:shadow-none print:w-full font-serif relative">
                                {/* Watermark Logo */}
                                <div className="absolute top-10 right-16 opacity-5 pointer-events-none text-slate-900">
                                    <Receipt size={220} />
                                </div>

                                {/* Header */}
                                <div className="text-center mb-10 border-b-2 border-slate-900 pb-8 relative z-10">
                                    <h1 className="text-4xl font-black uppercase tracking-tighter mb-1 font-sans">RESTAURANTE LAS PALMAS</h1>
                                    <p className="text-[12px] font-black uppercase text-slate-400 tracking-[0.4em] mb-4 font-sans">Informe Fiscal de Facturación y Ventas</p>

                                    <div className="flex justify-between items-end bg-slate-50 p-6 border border-slate-200 mt-6 font-sans">
                                        <div className="text-left">
                                            <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tight leading-none">{getModeTitle()}</h2>
                                            <div className="mt-2 space-y-0.5">
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sucursal: <span className="text-slate-900">{filters?.branch === 'ALL' ? 'TODAS LAS SUCURSALES' : filters?.branch}</span></p>
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Periodo: <span className="text-slate-900">{filters?.start} al {filters?.end}</span></p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="inline-block border-l-4 border-emerald-500 pl-4 text-right">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 font-sans">Monto Total Bruto</p>
                                                <div className="text-3xl font-black text-slate-900 tracking-tighter font-sans">Q{formatCurrRaw(totals?.amount || 0)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabla de Detalle */}
                                <div className="mb-12 relative z-10">
                                    <div className="bg-[#106ebe] text-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex justify-between items-center font-sans">
                                        <div className="flex items-center gap-2">
                                            <FileText size={14} />
                                            <span>Relación de Documentos Tributarios Electrónicos (DTE)</span>
                                        </div>
                                        <span>Total Documentos: {totals.count}</span>
                                    </div>

                                    <table className="w-full border-collapse font-sans text-[9px]">
                                        <thead>
                                            <tr className="bg-slate-100 border-b-2 border-slate-900 font-black uppercase text-slate-600 tracking-tighter">
                                                <th className="px-1 py-3 text-center">FECHA</th>
                                                {filters.mode === 'REP_INV_VOID' && <th className="px-1 py-3 text-center">F. ANULACIÓN</th>}
                                                <th className="px-1 py-3 text-center">ORDEN</th>
                                                <th className="px-1 py-3 text-center">SERIE</th>
                                                <th className="px-1 py-3 text-center">NÚMERO</th>
                                                <th className="px-1 py-3 text-left">FIRMA / UUID</th>
                                                <th className="px-1 py-3 text-left">CLIENTE / NIT</th>
                                                <th className="px-1 py-3 text-right">MONTO (Q)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-bold">
                                            {data?.map((r, i) => (
                                                <tr key={i} className={`h-9 ${r.status === 'CANCELLED' ? 'text-red-500 line-through opacity-50' : ''}`}>
                                                    <td className="px-1 text-center whitespace-nowrap">{new Date(r.creada).toLocaleDateString()}</td>
                                                    {filters.mode === 'REP_INV_VOID' && <td className="px-1 text-center whitespace-nowrap">{r.status === 'CANCELLED' && r.fechaAnulacion ? new Date(r.fechaAnulacion).toLocaleDateString() : '---'}</td>}
                                                    <td className="px-1 text-center font-black">#{r.noOrden}</td>
                                                    <td className="px-1 text-center text-slate-400 font-mono">{r.serie}</td>
                                                    <td className="px-1 text-center font-black">{r.numero}</td>
                                                    <td className="px-1 text-left font-mono text-[8px] max-w-[200px] truncate">{r.firma}</td>
                                                    <td className="px-1 text-left uppercase truncate max-w-[250px]">{r.cliente} <span className="text-slate-400 ml-1">[{r.nit}]</span></td>
                                                    <td className="px-1 text-right font-black">Q{formatCurrRaw(r.monto)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-slate-900 bg-slate-50 h-11 font-black uppercase text-xs">
                                                <td colSpan={6} className="px-2 text-right tracking-[0.1em]">GRAN TOTAL DE FACTURACIÓN:</td>
                                                <td className="px-2 text-right bg-[#106ebe] text-white font-extrabold tracking-tighter">Q{formatCurrRaw(totals?.amount || 0)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Resumen por Serie */}
                                <div className="mt-8 grid grid-cols-3 gap-8 px-4 font-sans relative z-10">
                                    <div className="border border-slate-200 p-4 bg-slate-50">
                                        <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Resumen de Operación</p>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] uppercase">Documentos Válidos:</span>
                                            <span className="font-black">{data.filter(f => f.status !== 'CANCELLED').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] uppercase">Anulaciones:</span>
                                            <span className="font-black text-red-500">{data.filter(f => f.status === 'CANCELLED').length}</span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 border-l-2 border-slate-100 pl-8 flex items-center justify-end pr-8">
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Exento de IVA (Estimado)</p>
                                            <p className="text-2xl font-black text-slate-300 tracking-tighter leading-none">Q0.00</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Firmas */}
                                <div className="mt-24 grid grid-cols-2 gap-20 px-20 font-sans relative z-10">
                                    <div className="border-t-2 border-slate-900 pt-5 text-center">
                                        <p className="text-[10px] font-black uppercase text-slate-900">ADMINISTRACIÓN FINANCIERA</p>
                                        <p className="text-[8px] text-slate-400 font-bold mt-2 uppercase tracking-tight font-serif">Certificación de Ingresos Brutos</p>
                                    </div>
                                    <div className="border-t-2 border-slate-900 pt-5 text-center">
                                        <p className="text-[10px] font-black uppercase text-slate-900">REVISIÓN DE AUDITORÍA</p>
                                        <p className="text-[8px] text-slate-400 font-bold mt-2 uppercase tracking-tight font-serif">Verificación de Correlativos y Firmas</p>
                                    </div>
                                </div>

                                <div className="mt-20 text-[8px] flex justify-between items-center text-slate-300 font-mono tracking-widest uppercase">
                                    <span>LAS PALMAS ERP SYTEM — REPORTE DE FACTURACIÓN</span>
                                    <span>RESPONSABLE: {String(userId || 'ANON').toUpperCase()} — FECHA EMISIÓN: {new Date().toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </DraggableWindow>
            </div>,
            document.body
        );
    };
    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = cachedUser?.id || 'anon';
    const STORAGE_KEY = `ReportFacturas_State_${userId}_${mode}`;

    // Restore state synchronously on mount
    const [savedState] = useState(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    });

    // Filtros
    const [startDate, setStartDate] = useState(savedState?.startDate || getLocalISOString());
    const [endDate, setEndDate] = useState(savedState?.endDate || getLocalISOString());
    const [selectedBranch, setSelectedBranch] = useState(savedState?.selectedBranch || 'ALL');
    const [showAllBranches, setShowAllBranches] = useState(savedState?.showAllBranches || false);
    const [searchTerm, setSearchTerm] = useState('');

    // Datos
    const [data, setData] = useState<any[]>(savedState?.data || []);
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Estados para Menú Contextual y Modal
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, row: any } | null>(null);
    const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
    const [viewInternalMode, setViewInternalMode] = useState(false);
    const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showPrintPreview, setShowPrintPreview] = useState(false);

    // Referencias para scroll sincronizado
    const containerRef = React.useRef<HTMLDivElement>(null);
    const headerScrollRef = React.useRef<HTMLDivElement>(null);
    const footerScrollRef = React.useRef<HTMLDivElement>(null);

    const syncScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (footerScrollRef.current) {
            footerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    useEffect(() => {
        const fetchMetadata = async () => {
            const { data: b } = await supabase.from('branches').select('id, name').order('name');
            if (b) setBranches(b);

            const { data: p } = await supabase.from('profiles').select('*').limit(1).single();
            if (p) setCurrentUser(p);
        };
        fetchMetadata();

        // Solo generar automáticamente si no hay un estado guardado previo
        if (!savedState) {
            handleGenerate();
        }
    }, [mode]);

    useEffect(() => {
        const state = { data, selectedBranch, showAllBranches, startDate, endDate };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [data, selectedBranch, showAllBranches, startDate, endDate, STORAGE_KEY]);

    const handleGenerate = async () => {
        setLoading(true);
        console.log('Generating Facturas report...', { startDate, endDate, mode, selectedBranch });
        try {
            // Simplified query for maximum reliability
            let query = supabase
                .from('invoices')
                .select(`
                    id,
                    created_at,
                    series,
                    document_number,
                    uuid,
                    customer_nit,
                    customer_name,
                    authorization_number,
                    grand_total,
                    status,
                    pdf_url,
                    order:orders (
                        id,
                        order_number,
                        order_type,
                        branch_id,
                        cancellation_reason,
                        subtotal,
                        discount_amount,
                        tip_amount,
                        total
                    )
                `)
                .order('created_at', { ascending: false });

            // Filtro de Fechas
            query = query.gte('created_at', `${startDate}T00:00:00`);
            query = query.lte('created_at', `${endDate}T23:59:59`);

            // Filtro por Modo (Exclusión Estricta de Contingencia)
            if (mode === 'REP_INV_VOID') {
                query = query.eq('status', 'CANCELLED').not('series', 'eq', 'CONT');
            } else if (mode === 'REP_INV_CONT') {
                query = query.or('series.eq.CONT,uuid.is.null,uuid.eq."",document_number.ilike.%PENDIENTE%');
            } else {
                // REP_INV (Solo Facturas Oficiales)
                query = query.neq('status', 'CANCELLED').neq('series', 'CONT');
            }

            const { data: res, error } = await query;

            if (error) {
                console.error('Supabase Query Error:', error);
                throw error;
            }

            console.log(`Fetched ${res?.length || 0} invoices raw.`);

            // Mapear datos con protección contra nulos
            const mapped = (res || [])
                .filter(inv => {
                    // Filtrado de sucursal en memoria para evitar problemas de relación anidada en la query
                    if (selectedBranch === 'ALL' || showAllBranches) return true;
                    return (inv.order as any)?.branch_id === selectedBranch;
                })
                .map(inv => {
                    const order = inv.order as any;

                    // Lógica de cuenta (Evitando repetir el No. de Orden)
                    let accountLabel = '---';
                    if (order) {
                        if (order.order_type === 'TAKE_OUT') {
                            accountLabel = order.customer_name ? `LLEVAR: ${order.customer_name}` : 'PARA LLEVAR';
                        } else if (order.order_type === 'DELIVERY') {
                            accountLabel = order.customer_name ? `${order.customer_name} (DOMICILIO)` : 'DOMICILIO';
                        } else {
                            // Para mesas, si se dividió la cuenta, el sistema guarda "Cuenta 1", "Cuenta 2" en customer_name
                            // Si no hay nombre, por defecto es la Cuenta 1 de esa mesa.
                            accountLabel = order.customer_name ? order.customer_name.toUpperCase() : 'CUENTA 1';
                        }
                    }

                    return {
                        id: inv.id,
                        order_id: order?.id,
                        creada: inv.created_at,
                        fechaAnulacion: inv.created_at,
                        noOrden: order?.order_number || '---',
                        cuenta: accountLabel,
                        serie: inv.series || '---',
                        numero: inv.document_number || '---',
                        firma: inv.uuid || '---',  // UUID is the legal signature (37 chars)
                        nit: inv.customer_nit || 'CF',
                        dte: inv.authorization_number || '---', // Short number is the DTE identifier
                        pdf_url: inv.pdf_url,
                        cliente: inv.customer_name || 'CONSUMIDOR FINAL',
                        operadoPor: mode === 'REP_INV_VOID' && order?.cancelled_profile?.name ? order.cancelled_profile.name : (mode === 'REP_INV_CONT' && order?.cashier_profile?.name ? order.cashier_profile.name : (order?.profiles?.name || '---')),
                        monto: inv.grand_total || 0,
                        status: inv.status,
                        motivoAnulacion: order?.cancellation_reason || 'SIN ESPECIFICAR',
                        tipoOrden: order?.order_type === 'TAKE_OUT' ? 'P. LLEVAR' : order?.order_type === 'DELIVERY' ? 'DOMICILIO' : 'MESA',
                        mesa: '---',
                        seccion: '---',
                        subtotal: order?.subtotal || 0,
                        descuento: order?.discount_amount || 0,
                        propina: order?.tip_amount || 0
                    };
                });

            setData(mapped);
        } catch (error) {
            console.error('Error generating invoice report:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data.map(r => ({
            'FECHA': new Date(r.creada).toLocaleDateString(),
            ...(mode === 'REP_INV_VOID' ? { 'FECHA ANULACIÓN': r.status === 'CANCELLED' && r.fechaAnulacion ? new Date(r.fechaAnulacion).toLocaleDateString() : '---' } : {}),
            'NO. ORDEN': r.noOrden,
            'CUENTA': r.cuenta,
            'SERIE': r.serie,
            'NÚMERO': r.numero,
            'FIRMA/AUTORIZACIÓN': r.firma,
            'DTE': r.dte,
            'NIT': r.nit,
            'CLIENTE': r.cliente,
            'OPERADO POR': r.operadoPor,
            'MONTO': r.monto
        })));
        XLSX.utils.book_append_sheet(wb, ws, "Facturas");
        XLSX.writeFile(wb, `Reporte_Facturas_${startDate}.xlsx`);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(val || 0);
    };

    const handleContextMenu = (e: React.MouseEvent, row: any) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, row });
    };

    const fetchInvoiceDetails = async (invoice: any) => {
        setViewingInvoice(invoice);
        setLoadingDetails(true);
        setInvoiceItems([]);
        setContextMenu(null);

        try {
            // Obtener items de la orden asociada a la factura con desglose de pagos
            const { data: orderData, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    payment_method,
                    cash_amount,
                    card_amount,
                    credit_amount,
                    other_amount,
                    total,
                    subtotal,
                    tip_amount,
                    discount_amount,
                    order_items (
                        quantity,
                        unit_price,
                        products!inner (name)
                    )
                `)
                .eq('id', invoice.order_id)
                .single();

            if (error) throw error;

            if (orderData) {
                // Generar etiqueta descriptiva del pago (Skill: Desglose Mixto)
                const parts: string[] = [];
                if ((orderData.cash_amount || 0) > 0) parts.push(`EFECTIVO: ${formatCurrency(orderData.cash_amount)}`);
                if ((orderData.card_amount || 0) > 0) parts.push(`TARJETA: ${formatCurrency(orderData.card_amount)}`);
                if ((orderData.credit_amount || 0) > 0) parts.push(`CRÉDITO: ${formatCurrency(orderData.credit_amount)}`);
                if ((orderData.other_amount || 0) > 0) parts.push(`OTROS: ${formatCurrency(orderData.other_amount)}`);

                const paymentSummary = parts.length > 0 ? parts.join(' | ') : (orderData.payment_method?.toUpperCase() || 'EFECTIVO (POR DEFECTO)');

                // Actualizar Invoice en el estado local con datos financieros completos
                setViewingInvoice((prev: any) => ({
                    ...prev,
                    metodo_pago_detallado: paymentSummary,
                    es_mixto: parts.length > 1,
                    subtotal: orderData.subtotal || (orderData.total - (orderData.tip_amount || 0)),
                    propina: orderData.tip_amount || 0,
                    descuento: orderData.discount_amount || 0
                }));

                setInvoiceItems(orderData.order_items.map((it: any) => ({
                    quantity: it.quantity,
                    name: it.products?.name || 'Producto sin nombre',
                    price: it.unit_price || 0,
                    total: it.quantity * it.unit_price
                })));
            }
        } catch (err) {
            console.error("Error fetching invoice details:", err);
            alert("No se pudieron cargar los detalles de la orden.");
        } finally {
            setLoadingDetails(false);
        }
    };

    const filteredData = data.filter(r =>
        r.noOrden.toString().includes(searchTerm) ||
        r.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.nit.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.numero.toString().includes(searchTerm)
    );

    const totals = filteredData.reduce((acc, curr) => ({
        count: acc.count + 1,
        amount: acc.amount + curr.monto,
        subtotal: acc.subtotal + (curr.subtotal || 0),
        descuento: acc.descuento + (curr.descuento || 0),
        propina: acc.propina + (curr.propina || 0)
    }), { count: 0, amount: 0, subtotal: 0, descuento: 0, propina: 0 });

    return (
        <div className="flex flex-col h-full bg-[#f8f9fa] animate-fade-in text-black font-sans">
            {/* Toolbar Principal estilo ERP */}
            <div className="bg-[#f0f0f0] border-b border-gray-300 p-2 shrink-0">
                <div className="bg-gray-200/50 border border-gray-300 p-3 rounded-sm shadow-inner">
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">

                        {/* Selector de Sucursal */}
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-1 relative">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Sucursal</span>
                                <select
                                    value={selectedBranch}
                                    onChange={e => setSelectedBranch(e.target.value)}
                                    className="border border-gray-400 bg-white text-[11px] h-7 px-2 w-[220px] outline-none focus:border-blue-500 shadow-sm"
                                >
                                    <option value="ALL">TODAS LAS SUCURSALES</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <input
                                    type="checkbox"
                                    id="all-br"
                                    checked={showAllBranches}
                                    onChange={e => setShowAllBranches(e.target.checked)}
                                    className="w-3 h-3 cursor-pointer"
                                />
                                <label htmlFor="all-br" className="text-[10px] font-bold text-gray-600 uppercase cursor-pointer select-none">Ver todas las sucursales</label>
                            </div>
                        </div>

                        {/* Rango de Fechas */}
                        <div className="flex items-center gap-6 border-l border-gray-300 pl-6 h-10">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Fechas</span>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-gray-700">Del:</span>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            className="border border-gray-400 bg-white text-[11px] h-7 px-2 outline-none focus:border-blue-500 shadow-inner"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-gray-700">Al:</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            className="border border-gray-400 bg-white text-[11px] h-7 px-2 outline-none focus:border-blue-500 shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Botones de Acción directos del diseño */}
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="bg-white border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 px-8 py-1.5 text-[11px] font-black uppercase text-gray-700 shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <BarChart3 size={14} className="text-blue-500" />}
                                Generar
                            </button>
                            <button
                                onClick={() => setShowPrintPreview(true)}
                                className="bg-white border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 px-6 py-1.5 text-[11px] font-black uppercase text-gray-700 shadow-sm transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Printer size={14} className="text-blue-600" /> Vista Previa
                            </button>
                        </div>
                    </div>
                </div>

                {/* Buscador Integrado estilo Windows 10/11 */}
                <div className="mt-2 flex items-center justify-end gap-2 px-1">
                    <div className="flex items-center bg-white border border-gray-300 h-8 px-3 gap-2 focus-within:ring-2 focus-within:ring-blue-100 transition-all w-[350px]">
                        <Search size={14} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Introduzca texto a buscar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none outline-none text-[11px] text-gray-700 w-full"
                        />
                    </div>
                    <button className="bg-white border border-gray-300 h-8 px-4 text-[10px] font-bold uppercase hover:bg-gray-50 active:bg-gray-100 transition-colors">
                        Buscar
                    </button>
                </div>
            </div>

            {/* Separador estético */}
            <div className="h-0.5 bg-gray-300 shrink-0"></div>

            {/* Area de Grilla con Scroll Sincronizado */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <div
                    ref={headerScrollRef}
                    onScroll={syncScroll}
                    className="flex-1 overflow-auto bg-white"
                    style={{ scrollbarGutter: 'stable' }}
                >
                    <table className="w-full border-collapse text-[11px] table-fixed min-w-[1200px]">
                        <thead className="sticky top-0 bg-[#f8f9fa] z-20 shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                            <tr className="divide-x divide-gray-300 text-gray-700 border-b border-gray-300">
                                <th className="w-[100px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Creada</th>
                                {mode === 'REP_INV_VOID' && <th className="w-[100px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">F. Anulación</th>}
                                {mode === 'REP_INV_VOID' && <th className="w-[160px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Motivo</th>}
                                <th className="w-[80px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">No. Orden</th>
                                <th className="w-[110px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Cuenta</th>
                                {mode === 'REP_INV_CONT' && <th className="w-[80px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Tipo</th>}
                                {mode === 'REP_INV_CONT' && <th className="w-[80px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Mesa</th>}
                                {mode === 'REP_INV_CONT' && <th className="w-[100px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Sección</th>}
                                {mode !== 'REP_INV_CONT' && <th className="w-[80px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Serie</th>}
                                {mode !== 'REP_INV_CONT' && <th className="w-[110px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Número</th>}
                                {mode !== 'REP_INV_CONT' && <th className="w-[220px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap bg-gray-50/50">Firma / Autorización</th>}
                                {mode !== 'REP_INV_CONT' && <th className="w-[140px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">DTE</th>}
                                {mode !== 'REP_INV_CONT' && <th className="w-[100px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Nit</th>}
                                <th className="w-[180px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Cliente</th>
                                <th className="w-[120px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">
                                    {mode === 'REP_INV_VOID' ? 'Anulado Por' : 'Operado Por'}
                                </th>
                                {mode === 'REP_INV_CONT' && <th className="w-[100px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Subtotal</th>}
                                {mode === 'REP_INV_CONT' && <th className="w-[100px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Desc.</th>}
                                {mode === 'REP_INV_CONT' && <th className="w-[100px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Propina</th>}
                                <th className="w-[120px] px-2 py-2.5 font-black uppercase tracking-tighter text-center text-[10px] whitespace-nowrap">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredData.map((row, idx) => (
                                <tr
                                    key={row.id}
                                    onContextMenu={(e) => handleContextMenu(e, row)}
                                    onDoubleClick={() => fetchInvoiceDetails(row)}
                                    className={`hover:bg-blue-50/50 transition-colors cursor-default select-none divide-x divide-gray-100 h-9 ${row.status === 'CANCELLED' ? 'text-red-500 bg-red-50/20' : ''}`}
                                >
                                    <td className="px-3 py-1 text-center tabular-nums">
                                        {new Date(row.creada).toLocaleDateString()}
                                    </td>
                                    {mode === 'REP_INV_VOID' && <td className="px-3 py-1 text-center tabular-nums font-bold">
                                        {row.status === 'CANCELLED' && row.fechaAnulacion ? new Date(row.fechaAnulacion).toLocaleDateString() : '---'}
                                    </td>}
                                    {mode === 'REP_INV_VOID' && <td className="px-3 py-1 text-center truncate text-[9px] uppercase font-bold text-gray-700">
                                        {row.motivoAnulacion}
                                    </td>}
                                    <td className="px-3 py-1 text-center font-bold">{row.noOrden}</td>
                                    <td className="px-3 py-1 text-center truncate uppercase font-medium">{row.cuenta}</td>
                                    {mode === 'REP_INV_CONT' && <td className="px-3 py-1 text-center truncate uppercase font-bold text-gray-500 text-[9px]">{row.tipoOrden}</td>}
                                    {mode === 'REP_INV_CONT' && <td className="px-3 py-1 text-center truncate uppercase font-bold text-gray-600">{row.mesa}</td>}
                                    {mode === 'REP_INV_CONT' && <td className="px-3 py-1 text-center truncate uppercase font-bold text-gray-500 text-[9px]">{row.seccion}</td>}
                                    {mode !== 'REP_INV_CONT' && <td className="px-3 py-1 text-center font-bold text-gray-500">{row.serie}</td>}
                                    {mode !== 'REP_INV_CONT' && <td className="px-3 py-1 text-center font-black text-slate-700">{row.numero}</td>}
                                    {mode !== 'REP_INV_CONT' && <td className="px-3 py-1 text-center text-[10px] text-gray-400 font-mono font-bold leading-none truncate">{row.firma}</td>}
                                    {mode !== 'REP_INV_CONT' && <td className="px-3 py-1 text-center font-mono text-[10px] text-slate-900">{row.dte}</td>}
                                    {mode !== 'REP_INV_CONT' && <td className="px-3 py-1 text-center font-bold">{row.nit}</td>}
                                    <td className="px-3 py-1 text-center truncate uppercase font-medium">{row.cliente}</td>
                                    <td className="px-3 py-1 text-center truncate text-[10px] text-gray-500">{row.operadoPor}</td>
                                    {mode === 'REP_INV_CONT' && <td className="px-3 py-1 text-center font-medium tabular-nums">{formatCurrency(row.subtotal)}</td>}
                                    {mode === 'REP_INV_CONT' && <td className="px-3 py-1 text-center text-red-500 font-medium tabular-nums">{formatCurrency(row.descuento)}</td>}
                                    {mode === 'REP_INV_CONT' && <td className="px-3 py-1 text-center text-blue-500 font-medium tabular-nums">{formatCurrency(row.propina)}</td>}
                                    <td className="px-3 py-1 text-center font-black text-gray-900 tabular-nums">
                                        {formatCurrency(row.monto)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredData.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center pt-32 opacity-25">
                            <FileSearch size={64} className="text-gray-400 mb-4" />
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">No se encontraron facturas</span>
                        </div>
                    )}
                </div>

                {/* FOOTER TOTALES - Fijo y Sincronizado */}
                <div className="shrink-0 overflow-hidden bg-[#106ebe] border-t border-white/20 shadow-[0_-4px_15px_rgba(0,0,0,0.2)]">
                    <div
                        ref={footerScrollRef}
                        className="overflow-x-auto custom-scrollbar"
                        style={{ scrollbarGutter: 'stable' }}
                    >
                        <table className="w-full border-collapse text-[11px] table-fixed min-w-[1200px]">
                            <tbody>
                                <tr className="font-black h-9 text-white items-center">
                                    <td className="w-[100px] px-3 uppercase text-[10px] text-gray-400 border-none shrink-0">
                                        Facts.: <span className="text-white text-[11px]">{totals.count}</span>
                                    </td>
                                    <td className="text-left px-4 uppercase text-[10px] font-black tracking-[0.2em] text-white/90 border-none">
                                        Total General de Facturación
                                    </td>
                                    {mode === 'REP_INV_CONT' && (
                                        <>
                                            <td className="w-[100px] px-3 py-1 text-center text-white text-[12px] font-black tabular-nums border-l border-gray-600 bg-transparent">
                                                {formatCurrency(totals.subtotal)}
                                            </td>
                                            <td className="w-[100px] px-3 py-1 text-center text-red-400 text-[12px] font-bold tabular-nums border-l border-gray-600 bg-transparent">
                                                {formatCurrency(totals.descuento)}
                                            </td>
                                            <td className="w-[100px] px-3 py-1 text-center text-blue-400 text-[12px] font-bold tabular-nums border-l border-gray-600 bg-transparent">
                                                {formatCurrency(totals.propina)}
                                            </td>
                                        </>
                                    )}
                                    <td className="w-[120px] px-3 py-1 text-right text-emerald-400 text-[13px] font-black tabular-nums border-l border-white/10 bg-white/5 pr-4">
                                        {formatCurrency(totals.amount)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Menú Contextual (PORTAL STANDARDS) */}
            {contextMenu && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed z-[100000] bg-white border border-gray-300 shadow-2xl rounded-md py-1 w-48 animate-in fade-in zoom-in duration-100 pointer-events-auto"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button
                        onClick={() => fetchInvoiceDetails(contextMenu.row)}
                        className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors"
                    >
                        <Eye size={14} /> Ver Detalles de Factura
                    </button>
                    <div className="h-px bg-gray-200 my-1" />
                    <button
                        onClick={() => setContextMenu(null)}
                        className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-400 hover:bg-gray-50 flex items-center gap-3"
                    >
                        <X size={14} /> Cancelar
                    </button>
                </div>,
                document.body
            )}

            {/* Modal de Detalle de Factura (PORTAL STANDARDS) */}
            {viewingInvoice && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] bg-black/5 flex items-center justify-center p-4 pointer-events-none">
                    <DraggableWindow id="invoice-detail-view" title={`Detalle: ${viewingInvoice.serie}-${viewingInvoice.numero}`}>
                        <div className="w-full max-w-4xl bg-[#f0f0f0] shadow-[0_0_40px_rgba(0,0,0,0.3)] border border-[#106ebe] flex flex-col pointer-events-auto animate-in zoom-in-95 duration-200">
                            {/* Header Clásico Windows */}
                            <div className="modal-header bg-[#106ebe] h-10 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <Receipt size={14} className="text-blue-300" />
                                        <span className="text-white text-[11px] font-black uppercase tracking-wider">Detalle de Factura: {viewingInvoice.serie}-{viewingInvoice.numero}</span>
                                    </div>

                                    {viewingInvoice.pdf_url && (
                                        <button
                                            onClick={() => window.open(viewingInvoice.pdf_url, '_blank')}
                                            className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-sm text-[10px] font-black uppercase flex items-center gap-2 shadow-lg transition-all active:scale-95"
                                        >
                                            <ExternalLink size={12} /> Abrir Factura SAT (FEL)
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={() => setViewingInvoice(null)}
                                    className="text-white/60 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* VISTA PREVIA DE FACTURA PRO (SAT STYLE) */}
                            <div className="flex-1 overflow-auto bg-[#525659] p-2 flex justify-center">
                                <div className="w-full max-w-[900px] bg-white shadow-xl p-3 lg:p-4 flex flex-col gap-2 text-[10px] leading-tight text-slate-800 font-sans relative my-1">

                                    {/* Cabecera Documento */}
                                    <div className="flex flex-col items-center gap-1 mb-2">
                                        <h1 className="text-xl font-black uppercase tracking-widest text-blue-900 leading-none">Factura</h1>
                                        <div className="h-0.5 w-12 bg-blue-900"></div>
                                    </div>

                                    {/* Bloque Superior de Información */}
                                    <div className="grid grid-cols-2 gap-8 border-b border-gray-100 pb-6">
                                        {/* Izquierda: Datos del Emisor */}
                                        <div className="flex flex-col gap-1">
                                            <span className="font-black text-[12px] uppercase text-blue-800">Cevicheria y Restaurante Las Palmas, Sociedad Anónima</span>
                                            <span className="font-bold uppercase">Nit Emisor: 91887666</span>
                                            <span className="font-bold opacity-80 uppercase">Cevicheria y Restaurante Las Palmas No. 2</span>
                                            <span className="opacity-70 uppercase leading-none">Avenida Circunvalación 6-73 Zona 1, Retalhuleu, Retalhuleu</span>
                                            <div className="mt-1 flex flex-col pt-1 border-t border-gray-50">
                                                <span className="font-bold opacity-60 text-[8px] uppercase">Receptor:</span>
                                                <span className="font-black text-[11px] uppercase leading-none mb-1">{viewingInvoice.cliente}</span>
                                                <span className="font-bold mb-1">NIT RECEPTOR: {viewingInvoice.nit}</span>
                                                <div className="flex items-center gap-1 mt-1 pt-1 border-t border-gray-100">
                                                    <CreditCard size={10} className="text-blue-600" />
                                                    <span className="font-bold text-blue-800 uppercase text-[9px]">Forma de Pago: {viewingInvoice.metodo_pago_detallado || 'EFECTIVO'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Derecha: Datos de Autorización */}
                                        <div className="flex flex-col gap-1 text-right items-end">
                                            <div className="flex flex-col items-end mb-2">
                                                <span className="font-bold text-blue-600 text-[10px] uppercase">Número de Autorización:</span>
                                                <span className="font-black font-mono text-slate-900 text-[11px] break-all max-w-[250px] leading-none uppercase">{viewingInvoice.firma}</span>
                                            </div>
                                            <div className="flex flex-col items-end border-t border-gray-100 pt-2 w-full">
                                                <div className="flex justify-between w-full max-w-[200px]">
                                                    <span className="font-bold opacity-60 uppercase">Serie:</span>
                                                    <span className="font-black text-slate-900 uppercase font-mono">{viewingInvoice.serie}</span>
                                                </div>
                                                <div className="flex justify-between w-full max-w-[200px]">
                                                    <span className="font-bold opacity-60 uppercase">Número:</span>
                                                    <span className="font-black text-slate-900 uppercase font-mono">{viewingInvoice.dte}</span>
                                                </div>
                                                <div className="flex justify-between w-full max-w-[200px] mt-1 border-t border-gray-100 pt-1">
                                                    <span className="font-bold opacity-60 uppercase">Fecha Emisión:</span>
                                                    <span className="font-black text-slate-900 uppercase font-mono">{new Date(viewingInvoice.creada).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex justify-between w-full max-w-[200px]">
                                                    <span className="font-bold opacity-60 uppercase">Hora Emisión:</span>
                                                    <span className="font-black text-slate-900 uppercase font-mono">{new Date(viewingInvoice.creada).toLocaleTimeString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tabla de Detalle Digital */}
                                    <div className="flex-1 flex flex-col">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="border-y-2 border-slate-800 text-[10px] font-black uppercase text-center bg-slate-50/50">
                                                    <th className="w-8 py-2">No.</th>
                                                    <th className="w-10">B/S</th>
                                                    <th className="w-16">Cantidad</th>
                                                    <th className="text-left px-4">Descripción</th>
                                                    <th className="w-24">P. Unitario (Q)</th>
                                                    <th className="w-20">Descuentos (Q)</th>
                                                    <th className="w-24 text-right pr-2">Total (Q)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {loadingDetails ? (
                                                    Array.from({ length: 5 }).map((_, i) => (
                                                        <tr key={i} className="animate-pulse">
                                                            <td colSpan={7} className="h-8 bg-gray-50/50"></td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    invoiceItems.map((item, idx) => (
                                                        <tr key={idx} className="text-center h-9 hover:bg-slate-50/50 transition-colors">
                                                            <td className="font-mono opacity-50">{idx + 1}</td>
                                                            <td className="font-bold uppercase tracking-tighter opacity-70">Bien</td>
                                                            <td className="font-black text-[12px]">{item.quantity}.00</td>
                                                            <td className="text-left px-4 font-bold uppercase truncate">{item.name}</td>
                                                            <td className="font-mono text-gray-500">{formatCurrency(item.price).replace('Q ', '')}</td>
                                                            <td className="font-mono text-red-400">0.00</td>
                                                            <td className="text-right pr-2 font-black text-slate-900 font-mono">{formatCurrency(item.total).replace('Q ', '')}</td>
                                                        </tr>
                                                    ))
                                                )}
                                                {/* Espacio en blanco para completar la estética (mínimo) */}
                                                {!loadingDetails && invoiceItems.length < 2 && Array.from({ length: 2 - invoiceItems.length }).map((_, i) => (
                                                    <tr key={`fill-${i}`} className="h-6">
                                                        <td colSpan={7}></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pie de Factura: Totales */}
                                    <div className="flex justify-between items-start mt-4 pt-4 border-t-2 border-slate-800">
                                        <div className="flex flex-col gap-2 max-w-[50%]">
                                            <div className="flex flex-col items-center gap-2 p-2 bg-white rounded border border-gray-100 shadow-sm">
                                                <div className="w-20 h-20 bg-white flex items-center justify-center border border-gray-200 p-1 relative overflow-hidden">
                                                    <img
                                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(viewingInvoice.firma || 'N/A')}`}
                                                        alt="QR Certificación"
                                                        className="w-full h-full object-contain"
                                                    />
                                                    <div className="absolute inset-x-0 bottom-0 bg-[#106ebe]/90 text-white text-[6px] font-black text-center py-0.5">
                                                        CERTIFICADO SAT
                                                    </div>
                                                </div>
                                                <span className="text-[7px] font-bold text-center opacity-70 uppercase leading-none">Sujeto a pagos trimestrales ISR</span>
                                            </div>
                                            <div className="flex flex-col text-[9px] opacity-40 font-mono leading-tight">
                                                <span>DATOS DEL CERTIFICADOR:</span>
                                                <span>INFILE, S.A. NIT: 12521337</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col w-52 gap-1 px-2">
                                            <div className="flex justify-between font-bold opacity-60">
                                                <span>Subtotal:</span>
                                                <span className="font-mono">{formatCurrency(viewingInvoice.subtotal || viewingInvoice.monto).replace('Q ', '')}</span>
                                            </div>
                                            {viewingInvoice.propina > 0 && (
                                                <div className="flex justify-between font-bold text-blue-600">
                                                    <span>Propina (+):</span>
                                                    <span className="font-mono">{formatCurrency(viewingInvoice.propina).replace('Q ', '')}</span>
                                                </div>
                                            )}
                                            {viewingInvoice.descuento > 0 && (
                                                <div className="flex justify-between font-bold text-red-500">
                                                    <span>Descuentos (-):</span>
                                                    <span className="font-mono">{formatCurrency(viewingInvoice.descuento).replace('Q ', '')}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center mt-2 py-2 border-t-2 border-slate-800 text-[14px] font-black w-full text-blue-900">
                                                <span className="uppercase tracking-widest text-[10px]">Total:</span>
                                                <span className="font-mono leading-none">{formatCurrency(viewingInvoice.monto)}</span>
                                            </div>
                                            {/* Moneda */}
                                            <div className="flex justify-end mt-1 text-[9px] font-black text-slate-400">
                                                <span>MONEDA: QUETZAL (GTQ)</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {showPrintPreview && (
                <InvoiceReportPrintPreview
                    isOpen={showPrintPreview}
                    onClose={() => setShowPrintPreview(false)}
                    data={filteredData}
                    totals={totals}
                    filters={{
                        start: startDate,
                        end: endDate,
                        branch: branches.find(b => b.id === selectedBranch)?.name || 'TODAS',
                        mode: mode
                    }}
                    userId={userId}
                />
            )}

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
};
