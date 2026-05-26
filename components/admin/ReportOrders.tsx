import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabase';
import {
    Search, Download, Clock, History, FileText, X, Loader2, UsersRound, Printer, CheckSquare
} from 'lucide-react';
import { DraggableWindow } from './DraggableWindow';
import * as XLSX from 'xlsx';
import { useReactToPrint } from 'react-to-print';

interface ReportOrdersProps {
    mode?: string;
}

const getLocalISOString = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

export const ReportOrders: React.FC<ReportOrdersProps> = ({ mode }) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = cachedUser?.id || 'anon';
    const STORAGE_KEY = `ReportOrders_State_${userId}_${mode || 'GEN'}`;

    // Restore state synchronously on mount
    const [savedState] = useState(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    });

    const [startDate, setStartDate] = useState(savedState?.startDate || getLocalISOString());
    const [endDate, setEndDate] = useState(savedState?.endDate || getLocalISOString());
    const [startTime, setStartTime] = useState(savedState?.startTime || '00:00');
    const [endTime, setEndTime] = useState(savedState?.endTime || '23:59');

    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState(savedState?.selectedBranch || 'ALL');
    const [showAllBranches, setShowAllBranches] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const printRef = React.useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Reporte_${mode}_${startDate}`,
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [data, setData] = useState<any[]>(savedState?.data || []);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const [showOrderModal, setShowOrderModal] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<any>(null);
    const [orderItems, setOrderItems] = useState<any[]>([]);
    const [loadingOrderItems, setLoadingOrderItems] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, order: any } | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
    const [relatedOrders, setRelatedOrders] = useState<any[]>([]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // New Filter and Sort states
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
        apertura: '',
        tipo: '',
        noOrden: '',
        seccion: '',
        mesa: '',
        atendio: '',
        status: '',
        cliente: '',
        customer_phone: '',
        customer_email: '',
        delivery_address: '',
        driver_name: ''
    });
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        const loadUser = async () => {
            const { data } = await supabase.from('profiles').select('*').limit(1).single();
            if (data) setCurrentUser(data);
        };
        loadUser();
    }, []);

    useEffect(() => {
        const fetchBranches = async () => {
            const { data: b } = await supabase.from('branches').select('id, name').order('name');
            if (b) setBranches(b);
        };
        fetchBranches();

        // Solo generar automáticamente si no hay un estado guardado previo
        if (!savedState) {
            handleGenerate();
        }
    }, [mode]);

    useEffect(() => {
        const state = {
            data,
            selectedBranch,
            startDate,
            endDate,
            startTime,
            endTime
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [data, selectedBranch, startDate, endDate, startTime, endTime, STORAGE_KEY]);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            // Unificar fechas de forma ultra-segura para Postgres
            const startStr = `${startDate} 00:00:00`;
            const endStr = `${endDate} 23:59:59`;

            console.log(`[ReportOrders] Consultando: Del ${startStr} Al ${endStr}`);

            let query = supabase.from('orders')
                .select(`
                    id, 
                    created_at, 
                    order_type, 
                    order_number, 
                    tip_amount, 
                    discount_amount, 
                    discount_percentage,
                    total, 
                    status,
                    discount_reason,
                    payment_method,
                    updated_at,
                    customer_name,
                    cancellation_reason,
                    cancelled_at,
                    customer_phone,
                    delivery_address,
                    table_id,
                    cash_amount, card_amount, credit_amount, other_amount, total_paid, change_amount,
                    tables:table_id (number, section),
                    waiter:profiles!waiter_id (name),
                    cancelled_by_user:profiles!cancelled_by (name),
                    driver:delivery_drivers (name)
                `, { count: 'exact' })
                .gte('created_at', startStr)
                .lte('created_at', endStr);

            // SOLO FILTRAR si realmente hay una sucursal seleccionada que NO sea 'ALL'
            if (selectedBranch && selectedBranch !== 'ALL' && selectedBranch !== '') {
                query = query.eq('branch_id', selectedBranch);
            }

            if (mode === 'REP_OPEN') {
                query = query.not('status', 'in', '("completed", "cancelled")');
            } else if (mode === 'REP_DELIVERY') {
                query = query.in('order_type', ['DELIVERY', 'TAKEOUT']);
            } else if (mode === 'REP_DISC') {
                query = query.eq('status', 'completed').gt('discount_amount', 0);
            } else if (mode === 'REP_CLOSED' || mode === 'REP_CLOSED_CH') {
                query = query.eq('status', 'completed');
            } else if (mode === 'REP_CREDIT') {
                query = query.eq('status', 'completed').or('payment_method.ilike.%CREDITO%,payment_method.ilike.%CRÉDITO%');
            } else if (mode === 'REP_VOID') {
                query = query.eq('status', 'cancelled');
            }

            const { data: orders, error, count } = await query.order('created_at', { ascending: false });

            if (error) {
                console.error("Supabase Error:", error);
                alert("Atención: Error de base de datos - " + error.message);
                return;
            }

            if (!orders || orders.length === 0) {
                console.warn("[ReportOrders] 0 registros encontrados.");
                setData([]);
            } else {
                console.log(`[ReportOrders] Éxito: ${orders.length} órdenes encontradas de un total de ${count}`);
                setData(orders.map((o: any) => {
                    const typeLabels: Record<string, string> = {
                        'DINE_IN': 'MESA',
                        'TAKEOUT': 'PARA LLEVAR',
                        'DELIVERY': 'DOMICILIO'
                    };
                    const targetDate = (mode === 'REP_CLOSED' || mode === 'REP_CLOSED_CH' || mode === 'REP_CREDIT') ? o.updated_at : o.created_at;
                    const subtotalRaw = (Number(o.total) || 0) + (Number(o.discount_amount) || 0) - (Number(o.tip_amount) || 0);

                    return {
                        id: o.id,
                        fecha_full: new Date(targetDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                        apertura: new Date(targetDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        fecha_creacion: new Date(o.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                        fecha_anulacion: (o.status === 'cancelled') ?
                            new Date(o.cancelled_at || o.updated_at || o.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
                            new Date(o.cancelled_at || o.updated_at || o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                            '-',
                        fecha_anulacion_full: (o.status === 'cancelled') ?
                            new Date(o.cancelled_at || o.updated_at || o.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) :
                            '-',
                        anulada: (o.status === 'cancelled') ?
                            new Date(o.cancelled_at || o.updated_at || o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                            '-',
                        tipo: typeLabels[o.order_type] || o.order_type || 'N/A',
                        noOrden: o.order_number || '-',
                        seccion: o.tables?.section || '-',
                        mesa: o.tables?.number || '-',
                        atendio: mode === 'REP_VOID' ? (o.cancelled_by_user?.name || '-') : (o.waiter?.name || '-'),
                        atendio_original: o.waiter?.name || '-',
                        subtotal: subtotalRaw,
                        propina: Number(o.tip_amount) || 0,
                        descuento: Number(o.discount_amount) || 0,
                        discount_reason: mode === 'REP_VOID' ? (o.cancellation_reason || '-') : (o.discount_reason || '-'),
                        discount_type: (Number(o.discount_percentage) || 0) > 0 ? 'Descuento (%)' : 'Descuento (Q)',
                        total: Number(o.total) || 0,
                        status: o.status,
                        driver_name: o.driver?.name || '---',
                        customer_email: o.customer?.email || '---',
                        customer_phone: o.customer_phone || '---',
                        delivery_address: o.delivery_address || '---',
                        cliente: o.customer_name || '-',
                        metodo: o.payment_method || '-',
                        efectivo: (() => {
                            const hasBreakdown = (o.cash_amount !== null && o.cash_amount !== undefined && Number(o.cash_amount) > 0) ||
                                                 (o.card_amount !== null && o.card_amount !== undefined && Number(o.card_amount) > 0) ||
                                                 (o.credit_amount !== null && o.credit_amount !== undefined && Number(o.credit_amount) > 0) ||
                                                 (o.other_amount !== null && o.other_amount !== undefined && Number(o.other_amount) > 0) ||
                                                 (o.total_paid !== null && o.total_paid !== undefined && Number(o.total_paid) > 0) ||
                                                 (o.change_amount !== null && o.change_amount !== undefined && Number(o.change_amount) > 0);
                            
                            const totalVal = Number(o.total || 0);
                            const method = (o.payment_method || 'EFECTIVO').toUpperCase();
                            const isCash = method === 'EFECTIVO';
                            const isCard = method.includes('TARJETA');
                            const isCredit = method.includes('CREDIT') || method.includes('CRÉDITO') || method.includes('CREDITO');
                            const isOther = !isCash && !isCard && !isCredit;

                            return hasBreakdown ? Number(o.cash_amount || 0) : (isCash ? totalVal : 0);
                        })(),
                        tarjeta: (() => {
                            const hasBreakdown = (o.cash_amount !== null && o.cash_amount !== undefined && Number(o.cash_amount) > 0) ||
                                                 (o.card_amount !== null && o.card_amount !== undefined && Number(o.card_amount) > 0) ||
                                                 (o.credit_amount !== null && o.credit_amount !== undefined && Number(o.credit_amount) > 0) ||
                                                 (o.other_amount !== null && o.other_amount !== undefined && Number(o.other_amount) > 0) ||
                                                 (o.total_paid !== null && o.total_paid !== undefined && Number(o.total_paid) > 0) ||
                                                 (o.change_amount !== null && o.change_amount !== undefined && Number(o.change_amount) > 0);

                            const totalVal = Number(o.total || 0);
                            const method = (o.payment_method || 'EFECTIVO').toUpperCase();
                            const isCash = method === 'EFECTIVO';
                            const isCard = method.includes('TARJETA');
                            const isCredit = method.includes('CREDIT') || method.includes('CRÉDITO') || method.includes('CREDITO');
                            const isOther = !isCash && !isCard && !isCredit;

                            return hasBreakdown ? Number(o.card_amount || 0) : (isCard ? totalVal : 0);
                        })(),
                        credito: (() => {
                            const hasBreakdown = (o.cash_amount !== null && o.cash_amount !== undefined && Number(o.cash_amount) > 0) ||
                                                 (o.card_amount !== null && o.card_amount !== undefined && Number(o.card_amount) > 0) ||
                                                 (o.credit_amount !== null && o.credit_amount !== undefined && Number(o.credit_amount) > 0) ||
                                                 (o.other_amount !== null && o.other_amount !== undefined && Number(o.other_amount) > 0) ||
                                                 (o.total_paid !== null && o.total_paid !== undefined && Number(o.total_paid) > 0) ||
                                                 (o.change_amount !== null && o.change_amount !== undefined && Number(o.change_amount) > 0);

                            const totalVal = Number(o.total || 0);
                            const method = (o.payment_method || 'EFECTIVO').toUpperCase();
                            const isCash = method === 'EFECTIVO';
                            const isCard = method.includes('TARJETA');
                            const isCredit = method.includes('CREDIT') || method.includes('CRÉDITO') || method.includes('CREDITO');
                            const isOther = !isCash && !isCard && !isCredit;

                            return hasBreakdown ? Number(o.credit_amount || 0) : (isCredit ? totalVal : 0);
                        })(),
                        otros: (() => {
                            const hasBreakdown = (o.cash_amount !== null && o.cash_amount !== undefined && Number(o.cash_amount) > 0) ||
                                                 (o.card_amount !== null && o.card_amount !== undefined && Number(o.card_amount) > 0) ||
                                                 (o.credit_amount !== null && o.credit_amount !== undefined && Number(o.credit_amount) > 0) ||
                                                 (o.other_amount !== null && o.other_amount !== undefined && Number(o.other_amount) > 0) ||
                                                 (o.total_paid !== null && o.total_paid !== undefined && Number(o.total_paid) > 0) ||
                                                 (o.change_amount !== null && o.change_amount !== undefined && Number(o.change_amount) > 0);

                            const totalVal = Number(o.total || 0);
                            const method = (o.payment_method || 'EFECTIVO').toUpperCase();
                            const isCash = method === 'EFECTIVO';
                            const isCard = method.includes('TARJETA');
                            const isCredit = method.includes('CREDIT') || method.includes('CRÉDITO') || method.includes('CREDITO');
                            const isOther = !isCash && !isCard && !isCredit;

                            return hasBreakdown ? Number(o.other_amount || 0) : (isOther ? totalVal : 0);
                        })()
                    };
                }));
            }
        } catch (error) {
            console.error("Error generating orders report:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurr = (val: number) => `Q${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleExportExcel = () => {
        if (filteredData.length === 0) return;
        setIsExporting(true);
        try {
            const reportName = mode === 'REP_CREDIT' ? 'Ordenes_al_Credito' :
                mode === 'REP_CLOSED_CH' ? 'Ordenes_Cerradas_por_Canal' :
                    mode === 'REP_CLOSED' ? 'Ventas_Cerradas' :
                        mode === 'REP_VOID' ? 'Ventas_Anuladas' : 'Reporte_Ventas';

            const exportData = filteredData.map(d => {
                if (mode === 'REP_CREDIT') {
                    return {
                        'Pagada': d.fecha_full + ' ' + d.apertura,
                        'Tipo': d.tipo,
                        'No. Orden': d.noOrden,
                        'Cuenta': 'Cuenta 1',
                        'Cliente': d.cliente,
                        'Operado Por': d.atendio,
                        'Total Cuenta': d.total,
                        'Efectivo': d.efectivo,
                        'Tarjeta': d.tarjeta,
                        'Crédito': d.credito,
                        'Otros': d.otros,
                        'Total Pagado': d.total
                    };
                }
                if (mode === 'REP_DISC') {
                    return {
                        'Creada': d.fecha_full + ' ' + d.apertura,
                        'Tipo': d.tipo,
                        'No. Orden': d.noOrden,
                        'Autorizado Por': d.atendio,
                        'Descuento Tipo': d.discount_type,
                        'Motivo': d.discount_reason,
                        'Cuenta': 'Cuenta 1',
                        'SubTotal': d.subtotal,
                        'Propina': d.propina,
                        'Descuento': d.descuento,
                        'Total': d.total
                    };
                }
                if (mode === 'REP_VOID') {
                    return {
                        'Creada': d.fecha_creacion,
                        'Anulada': d.fecha_anulacion,
                        'Tipo': d.tipo,
                        'No. Orden': d.noOrden,
                        'Autorizado': d.atendio,
                        'Motivo': d.discount_reason,
                        'Subtotal': d.subtotal,
                        'Propina': d.propina,
                        'Descuento': d.descuento,
                        'Total': d.total
                    };
                }
                if (mode === 'REP_ALL') {
                    return {
                        'Apertura': d.fecha_full + ' ' + d.apertura,
                        'Tipo': d.tipo,
                        'No. Orden': d.noOrden,
                        'Sección': d.seccion,
                        'Mesa No.': d.mesa,
                        'Atendió': d.atendio,
                        'Subtotal': d.subtotal,
                        'Propina': d.propina,
                        'Descuento': d.descuento,
                        'Total': d.total,
                        'Cerrada': d.status === 'completed' ? 'X' : '',
                        'Anulada': d.status === 'cancelled' ? 'X' : ''
                    }
                }
                if (mode === 'REP_DELIVERY') {
                    return {
                        'Fecha': d.fecha_full + ' ' + d.apertura,
                        'No. Orden': d.noOrden,
                        'Tipo de Orden': d.tipo,
                        'Cliente': d.cliente,
                        'Teléfono': d.customer_phone,
                        'Correo': d.customer_email,
                        'Dirección': d.delivery_address,
                        'Repartidor': d.driver_name,
                        'Total': d.total
                    };
                }
                return {
                    'Fecha': d.fecha_full,
                    'Hora': d.apertura,
                    'Tipo': d.tipo,
                    'No. Orden': d.noOrden,
                    'Sección': d.seccion,
                    'Mesa No.': d.mesa,
                    'Atendió': d.atendio,
                    'Subtotal': d.subtotal,
                    'Propina': d.propina,
                    'Descuento': d.descuento,
                    'Total': d.total
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Reporte");
            XLSX.writeFile(wb, `${reportName}_${startDate}.xlsx`);
        } catch (error) {
            console.error("Excel Export Error:", error);
            alert("Error al exportar a Excel");
        } finally {
            setIsExporting(false);
        }
    };

    const filteredData = React.useMemo(() => {
        let result = data.filter(d => {
            const matchesGlobal = searchTerm === '' ||
                d.noOrden.toString().includes(searchTerm) ||
                d.atendio.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.mesa.toString().toLowerCase().includes(searchTerm.toLowerCase());

            const matchesColumn = (
                (columnFilters.apertura === '' || d.apertura.includes(columnFilters.apertura)) &&
                (columnFilters.fecha_anulacion === undefined || columnFilters.fecha_anulacion === '' || (d.fecha_anulacion && d.fecha_anulacion.toLowerCase().includes(columnFilters.fecha_anulacion.toLowerCase()))) &&
                (columnFilters.tipo === '' || d.tipo.toLowerCase().includes(columnFilters.tipo.toLowerCase())) &&
                (columnFilters.noOrden === '' || d.noOrden.toString().includes(columnFilters.noOrden)) &&
                (columnFilters.seccion === '' || d.seccion.toLowerCase().includes(columnFilters.seccion.toLowerCase())) &&
                (columnFilters.mesa === '' || d.mesa.toString().includes(columnFilters.mesa)) &&
                (columnFilters.atendio === '' || d.atendio.toLowerCase().includes(columnFilters.atendio.toLowerCase())) &&
                (!columnFilters.cliente || d.cliente.toLowerCase().includes(columnFilters.cliente.toLowerCase()))
            );

            return matchesGlobal && matchesColumn;
        });

        if (sortConfig) {
            result.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [data, searchTerm, columnFilters, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (column: string, value: string) => {
        setColumnFilters(prev => ({ ...prev, [column]: value }));
    };

    const totals = filteredData.reduce((acc, curr) => ({
        subtotal: acc.subtotal + curr.subtotal,
        propina: acc.propina + curr.propina,
        descuento: acc.descuento + curr.descuento,
        total: acc.total + curr.total
    }), { subtotal: 0, propina: 0, descuento: 0, total: 0 });

    const groupedData = React.useMemo(() => {
        if (mode !== 'REP_CLOSED_CH' && mode !== 'REP_CREDIT') return null;
        const groups: Record<string, any[]> = {};
        const groupKey = mode === 'REP_CLOSED_CH' ? 'tipo' : 'atendio';
        filteredData.forEach(d => {
            const key = d[groupKey] || 'SIN ASIGNAR';
            if (!groups[key]) groups[key] = [];
            groups[key].push(d);
        });
        return groups;
    }, [filteredData, mode]);

    const toggleGroup = (groupName: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupName)) next.delete(groupName);
            else next.add(groupName);
            return next;
        });
    };

    const fetchOrderDetails = async (order: any) => {
        setLoadingOrderItems(true);
        setViewingOrder(order);
        setShowOrderModal(true);
        setOrderItems([]);
        setRelatedOrders([]);
        setSelectedAccount('ALL');

        try {
            // Fetch Order Header (include table_id for sibling lookup)
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select(`
                    id, created_at, order_type, order_number, tip_amount,
                    discount_amount, total, status, discount_reason, table_id, customer_name,
                    tables (number, section),
                    waiter:profiles!waiter_id (name)
                `)
                .eq('id', order.id)
                .single();

            let resolvedTableId: string | null = null;
            let resolvedStatus = 'completed';
            let resolvedCreatedAt = order.created_at || new Date().toISOString();

            if (!orderError && orderData) {
                const o = orderData as any;
                resolvedTableId = o.table_id;
                resolvedStatus = o.status;
                resolvedCreatedAt = o.created_at;

                const mappedOrder = {
                    id: o.id,
                    noOrden: o.order_number || o.id.split('-')[0],
                    fecha_full: new Date(o.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                    apertura: new Date(o.created_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                    seccion: o.tables?.section || 'SALA',
                    mesa: o.tables?.number || '0',
                    atendio: o.waiter?.name || '-',
                    tipo: o.order_type === 'DINE_IN' ? 'MESA' :
                        o.order_type === 'TAKEOUT' ? 'LLEVAR' :
                            o.order_type === 'DELIVERY' ? 'DOMICILIO' : o.order_type,
                    subtotal: (Number(o.total) || 0) + (Number(o.discount_amount) || 0) - (Number(o.tip_amount) || 0),
                    propina: Number(o.tip_amount) || 0,
                    descuento: Number(o.discount_amount) || 0,
                    discount_reason: o.discount_reason || '',
                    total: Number(o.total) || 0,
                    status: o.status,
                    table_id: o.table_id,
                    customer_name: o.customer_name
                };
                setViewingOrder(mappedOrder);
            }

            // Determinar qué IDs de orden necesitamos para los items
            let itemOrderIds: string[] = [order.id];

            // Si la orden es de mesa, buscar cuentas hermanas en misma mesa mismo estado ±3h
            if (resolvedTableId) {
                const refDate = new Date(resolvedCreatedAt);
                const windowStart = new Date(refDate.getTime() - 3 * 60 * 60 * 1000).toISOString();
                const windowEnd   = new Date(refDate.getTime() + 3 * 60 * 60 * 1000).toISOString();

                const { data: siblings } = await supabase
                    .from('orders')
                    .select('id, customer_name, order_number, total, tip_amount, discount_amount, discount_reason, status, created_at')
                    .eq('table_id', resolvedTableId)
                    .eq('status', resolvedStatus)
                    .gte('created_at', windowStart)
                    .lte('created_at', windowEnd)
                    .order('created_at', { ascending: true });

                if (siblings && siblings.length > 1) {
                    setRelatedOrders(siblings);
                    itemOrderIds = siblings.map((s: any) => s.id);
                } else {
                    setRelatedOrders([]);
                }
            }

            // Fetch items de todos los IDs relevantes
            const { data: items, error: itemsErr } = await supabase
                .from('order_items')
                .select('*, products(name)')
                .in('order_id', itemOrderIds)
                .order('created_at', { ascending: true });

            if (!itemsErr && items) {
                setOrderItems(items);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingOrderItems(false);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, order: any) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            setContextMenu({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                order
            });
            setSelectedOrderId(order.id);
        }
    };

    // Cuenta actualmente seleccionada en el dropdown
    const selectedOrderData = React.useMemo(() => {
        if (selectedAccount === 'ALL' || relatedOrders.length === 0) return null;
        return relatedOrders.find((o: any) => o.id === selectedAccount) || null;
    }, [selectedAccount, relatedOrders]);

    // Derived values for the modal — usa la cuenta seleccionada si existe, si no la orden principal
    const subtotalWithTax = selectedOrderData
        ? (Number(selectedOrderData.total) || 0) + (Number(selectedOrderData.discount_amount) || 0) - (Number(selectedOrderData.tip_amount) || 0)
        : (viewingOrder?.subtotal || 0);
    const discount = selectedOrderData ? (Number(selectedOrderData.discount_amount) || 0) : (viewingOrder?.descuento || 0);
    const tip      = selectedOrderData ? (Number(selectedOrderData.tip_amount) || 0)      : (viewingOrder?.propina || 0);
    const total    = selectedOrderData ? (Number(selectedOrderData.total) || 0)            : (viewingOrder?.total || 0);
    const subtotalWithoutTax = subtotalWithTax / 1.12;
    const tax = subtotalWithTax - subtotalWithoutTax;

    // Cuentas únicas: órdenes hermanas cuando hay varias, si no lista vacía
    const uniqueAccounts: { id: string; name: string }[] = relatedOrders.length > 1
        ? relatedOrders.map((o: any, idx: number) => ({
            id: o.id,
            name: (o.customer_name && o.customer_name.toUpperCase() !== 'CUENTA PRINCIPAL')
                ? o.customer_name.toUpperCase()
                : `CUENTA ${idx + 1}`
          }))
        : [];

    // Filtrar items según la cuenta seleccionada (por order_id)
    const filteredOrderItems = selectedAccount === 'ALL'
        ? orderItems
        : orderItems.filter((item: any) => item.order_id === selectedAccount);

    return (
        <div
            ref={containerRef}
            className="flex flex-col h-full bg-[#f8f9fa] animate-fade-in text-black relative font-['Montserrat'] overflow-hidden"
            onClick={() => setContextMenu(null)}
        >
            {/* Toolbar Area */}
            <div className="bg-[#f0f0f0] border-b border-gray-300 p-2 shrink-0">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-gray-700">Sucursal</span>
                            <select
                                value={selectedBranch}
                                onChange={e => setSelectedBranch(e.target.value)}
                                disabled={showAllBranches}
                                className="border border-gray-400 bg-white text-[11px] h-7 w-[280px] px-2 outline-none focus:border-blue-500 shadow-sm"
                            >
                                <option value="ALL">TODAS LAS SUCURSALES</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                id="allBranches"
                                checked={showAllBranches}
                                onChange={e => setShowAllBranches(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <label htmlFor="allBranches" className="text-[11px] font-bold text-gray-700 cursor-pointer">Ver todas las sucursales</label>
                        </div>
                    </div>

                    <div className="bg-gray-200/50 border border-gray-300 p-3 rounded-sm">
                        <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-6 w-full`}>
                            <div className="flex items-center gap-6">
                                <div className={`flex ${isMobile ? 'flex-col items-start' : 'items-center'} gap-4 relative pt-2`}>
                                    <span className="absolute -top-3.5 left-0 text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Fechas</span>
                                    <div className="flex items-center gap-2 w-full">
                                        <span className="text-[11px] font-bold text-gray-700 w-8">Del:</span>
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 border border-gray-400 bg-white text-[11px] h-7 px-2 outline-none shadow-inner" />
                                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-[70px] border border-gray-400 bg-white text-[11px] h-7 px-1 outline-none shadow-inner" />
                                    </div>
                                    <div className="flex items-center gap-2 w-full">
                                        <span className="text-[11px] font-bold text-gray-700 w-8">Al:</span>
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 border border-gray-400 bg-white text-[11px] h-7 px-2 outline-none shadow-inner" />
                                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-[70px] border border-gray-400 bg-white text-[11px] h-7 px-1 outline-none shadow-inner" />
                                    </div>
                                </div>

                                <div className="flex gap-2 w-[240px]">
                                    <button onClick={handleGenerate} disabled={loading} className="flex-1 bg-white border border-gray-400 hover:bg-gray-50 py-1 h-7 text-[10px] font-black uppercase text-gray-700 shadow-sm active:scale-95 flex items-center justify-center gap-2">
                                        {loading ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />} Generar
                                    </button>
                                    <button
                                        onClick={() => setShowPrintModal(true)}
                                        disabled={filteredData.length === 0}
                                        className="flex-1 bg-white border border-gray-400 hover:bg-gray-50 py-1 h-7 text-[10px] font-black uppercase text-gray-700 shadow-sm active:scale-95 flex items-center justify-center gap-1"
                                    >
                                        <Printer size={11} className="text-blue-600" /> {isMobile ? 'Vista' : 'Vista Previa'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center bg-white border border-gray-400 h-7 pl-2 gap-2 group focus-within:border-blue-500/50 w-[400px] overflow-hidden">
                                <Search size={12} className="text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="bg-transparent border-none outline-none text-[10px] text-gray-700 flex-1"
                                />
                                <button
                                    className="bg-[#106ebe] text-white px-3 h-full text-[9px] font-black uppercase hover:bg-black transition-colors"
                                    onClick={handleGenerate}
                                >
                                    Buscar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-1 bg-white border-b border-gray-300 shrink-0"></div>

            {/* Grid Area */}
            {isMobile ? (
                <div className="divide-y divide-gray-100 pb-20">
                    {filteredData.map((row, idx) => (
                        <div
                            key={row.id || idx}
                            onClick={() => { setSelectedOrderId(row.id); fetchOrderDetails(row); }}
                            className={`p-4 active:bg-blue-50 transition-all ${selectedOrderId === row.id ? 'bg-blue-50' : 'bg-white'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{row.fecha_full} | {row.apertura}</span>
                                    <span className="text-sm font-black text-slate-800">#{row.noOrden} <span className="text-[10px] font-bold text-indigo-500 ml-1">({row.tipo})</span></span>
                                </div>
                                <span className="text-sm font-black text-indigo-600">{formatCurr(row.total)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-y-1 text-[10px] font-bold text-slate-500 uppercase">
                                <div>Atendió: <span className="text-slate-800">{row.atendio}</span></div>
                                <div>Mesa: <span className="text-slate-800">{row.mesa}</span></div>
                                <div className="col-span-2">Cliente: <span className="text-slate-800">{row.cliente}</span></div>
                                {row.status === 'cancelled' && <div className="col-span-2 text-rose-500">ANULADA: {row.discount_reason}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full table-fixed border-collapse text-[11px] select-text">
                        <thead className="sticky top-0 bg-[#f0f0f0] z-20 shadow-sm ring-1 ring-gray-300 ring-inset">
                            <tr className="border-b border-gray-300">
                                {mode === 'REP_CREDIT' ? (
                                    <>
                                        <th onClick={() => requestSort('apertura')} className="px-3 py-2 text-center font-black uppercase text-gray-600 w-[100px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">Pagada</th>
                                        <th onClick={() => requestSort('tipo')} className="px-3 py-2 text-center font-black uppercase text-gray-600 w-[100px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">Tipo</th>
                                        <th onClick={() => requestSort('noOrden')} className="px-3 py-2 text-center font-black uppercase text-gray-600 w-[80px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">No. Orden</th>
                                        <th onClick={() => requestSort('mesa')} className="px-3 py-2 text-center font-black uppercase text-gray-600 w-[100px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">Cuenta</th>
                                        <th onClick={() => requestSort('cliente')} className="px-3 py-2 text-left font-black uppercase text-gray-600 w-[180px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">Cliente</th>
                                        <th onClick={() => requestSort('atendio')} className="px-3 py-2 text-center font-black uppercase text-gray-600 w-[150px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">Operado Por</th>
                                        <th onClick={() => requestSort('total')} className="px-3 py-2 text-right font-black uppercase text-gray-600 w-[100px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">Total Cuenta</th>
                                        <th onClick={() => requestSort('efectivo')} className="px-3 py-2 text-right font-black uppercase text-gray-600 w-[90px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">Efectivo</th>
                                        <th onClick={() => requestSort('tarjeta')} className="px-3 py-2 text-right font-black uppercase text-gray-600 w-[90px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">Tarjeta</th>
                                        <th onClick={() => requestSort('credito')} className="px-3 py-2 text-right font-black uppercase text-gray-600 w-[90px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">Crédito</th>
                                        <th onClick={() => requestSort('otros')} className="px-3 py-2 text-right font-black uppercase text-gray-600 w-[90px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">Otros</th>
                                        <th onClick={() => requestSort('total')} className="px-3 py-2 text-right font-black uppercase text-gray-600 w-[110px] cursor-pointer hover:bg-gray-200 border-r border-gray-300 text-[10px]">Total Pagado</th>
                                    </>
                                ) : mode === 'REP_DELIVERY' ? (
                                    <>
                                        <th onClick={() => requestSort('apertura')} className="px-3 py-2 text-center font-black uppercase text-slate-700 w-[110px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Fecha</th>
                                        <th onClick={() => requestSort('noOrden')} className="px-3 py-2 text-center font-black uppercase text-slate-700 w-[80px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">No. Orden</th>
                                        <th onClick={() => requestSort('tipo')} className="px-3 py-2 text-center font-black uppercase text-slate-700 w-[120px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Tipo de Orden</th>
                                        <th onClick={() => requestSort('cliente')} className="px-3 py-2 text-left font-black uppercase text-slate-700 w-[180px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Cliente</th>
                                        <th className="px-3 py-2 text-center font-black uppercase text-slate-700 w-[100px] border-r border-gray-300">Teléfono</th>
                                        <th className="px-3 py-2 text-center font-black uppercase text-slate-700 w-[150px] border-r border-gray-300">Correo</th>
                                        <th className="px-3 py-2 text-left font-black uppercase text-slate-700 w-[240px] border-r border-gray-300">Dirección</th>
                                        <th className="px-3 py-2 text-center font-black uppercase text-slate-700 w-[130px] border-r border-gray-300">Repartidor</th>
                                        <th onClick={() => requestSort('total')} className="px-3 py-2 text-right font-black uppercase text-slate-700 w-[110px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Total</th>
                                    </>
                                ) : (
                                    <>
                                        <th onClick={() => requestSort('apertura')} className="px-3 py-2 text-center font-black uppercase text-black w-[100px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">{(mode === 'REP_VOID' || mode === 'REP_DISC') ? 'Creada' : (mode === 'REP_CLOSED_CH' ? 'Cerrada' : 'Apertura')}</th>
                                        {mode === 'REP_VOID' && <th onClick={() => requestSort('fecha_anulacion')} className="px-3 py-2 text-center font-black uppercase text-black w-[100px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Anulada</th>}
                                        <th onClick={() => requestSort('tipo')} className="px-3 py-2 text-center font-black uppercase text-black w-[120px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Tipo</th>
                                        <th onClick={() => requestSort('noOrden')} className="px-3 py-2 text-center font-black uppercase text-black w-[100px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">No. Orden</th>
                                        {mode === 'REP_VOID' || mode === 'REP_DISC' ? (
                                            <>
                                                <th onClick={() => requestSort('atendio')} className="px-3 py-2 text-center font-black uppercase text-black w-[150px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">{mode === 'REP_VOID' ? 'Autorizado' : 'Autorizado Por'}</th>
                                                {mode === 'REP_DISC' && <th onClick={() => requestSort('discount_type')} className="px-3 py-2 text-center font-black uppercase text-black w-[150px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Desc. Tipo</th>}
                                                <th className="px-3 py-2 text-center font-black uppercase text-black w-[200px] border-r border-gray-300">Motivo</th>
                                            </>
                                        ) : (
                                            <>
                                                <th onClick={() => requestSort('seccion')} className="px-3 py-2 text-center font-black uppercase text-black w-[150px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Sección</th>
                                                <th onClick={() => requestSort('mesa')} className="px-3 py-2 text-center font-black uppercase text-black w-[100px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Mesa No.</th>
                                                <th onClick={() => requestSort('atendio')} className="px-3 py-2 text-center font-black uppercase text-black w-[150px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Atendió</th>
                                            </>
                                        )}
                                        {mode === 'REP_DISC' && <th className="px-3 py-2 text-center font-black uppercase text-black w-[100px] border-r border-gray-300">Cuenta</th>}
                                        <th onClick={() => requestSort('subtotal')} className="px-3 py-2 text-center font-black uppercase text-black w-[100px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Subtotal</th>
                                        <th onClick={() => requestSort('propina')} className="px-3 py-2 text-center font-black uppercase text-black w-[100px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Propina</th>
                                        <th onClick={() => requestSort('descuento')} className="px-3 py-2 text-center font-black uppercase text-black w-[100px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Descuento</th>
                                        <th onClick={() => requestSort('total')} className="px-3 py-2 text-center font-black uppercase text-black w-[120px] cursor-pointer hover:bg-gray-200 border-r border-gray-300">Total</th>
                                        {mode === 'REP_ALL' && (
                                            <>
                                                <th className="px-3 py-2 text-center font-black text-black w-[60px] border-r border-gray-300 uppercase text-[10px]">Cerr.</th>
                                                <th className="px-3 py-2 text-center font-black text-black w-[60px] border-r border-gray-300 uppercase text-[10px]">Anul.</th>
                                            </>
                                        )}
                                    </>
                                )}
                            </tr>
                            {/* Filter Row */}
                            <tr className="bg-white border-b border-gray-300">
                                {mode === 'REP_CREDIT' ? (
                                    <>
                                        <td className="p-1"><input type="text" value={columnFilters.apertura} onChange={e => handleFilterChange('apertura', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.tipo} onChange={e => handleFilterChange('tipo', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.noOrden} onChange={e => handleFilterChange('noOrden', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.mesa} onChange={e => handleFilterChange('mesa', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.cliente || ''} onChange={e => handleFilterChange('cliente', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.atendio} onChange={e => handleFilterChange('atendio', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1 bg-gray-50" colSpan={6}></td>
                                    </>
                                ) : mode === 'REP_DELIVERY' ? (
                                    <>
                                        <td className="p-1"><input type="text" value={columnFilters.apertura} onChange={e => handleFilterChange('apertura', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.noOrden} onChange={e => handleFilterChange('noOrden', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.tipo} onChange={e => handleFilterChange('tipo', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.cliente} onChange={e => handleFilterChange('cliente', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.customer_phone} onChange={e => handleFilterChange('customer_phone', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.customer_email} onChange={e => handleFilterChange('customer_email', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.delivery_address} onChange={e => handleFilterChange('delivery_address', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1"><input type="text" value={columnFilters.driver_name} onChange={e => handleFilterChange('driver_name', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1 bg-gray-100"></td>
                                    </>
                                ) : (
                                    <>
                                        <td className="p-1 border-r border-gray-200"><input type="text" value={columnFilters.apertura} onChange={e => handleFilterChange('apertura', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        {mode === 'REP_VOID' && <td className="p-1 border-r border-gray-200"><input type="text" value={columnFilters.fecha_anulacion || ''} onChange={e => handleFilterChange('fecha_anulacion', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>}
                                        <td className="p-1 border-r border-gray-200"><input type="text" value={columnFilters.tipo} onChange={e => handleFilterChange('tipo', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        <td className="p-1 border-r border-gray-200"><input type="text" value={columnFilters.noOrden} onChange={e => handleFilterChange('noOrden', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                        {mode === 'REP_VOID' || mode === 'REP_DISC' ? (
                                            <>
                                                <td className="p-1 border-r border-gray-200"><input type="text" value={columnFilters.atendio} onChange={e => handleFilterChange('atendio', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                                {mode === 'REP_DISC' && <td className="p-1 border-r border-gray-200"><input type="text" value={columnFilters.discount_type || ''} onChange={e => handleFilterChange('discount_type', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>}
                                                <td className="p-1 border-r border-gray-200"><input type="text" value={columnFilters.discount_reason || ''} onChange={e => handleFilterChange('discount_reason', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-1 border-r border-gray-200"><input type="text" value={columnFilters.seccion} onChange={e => handleFilterChange('seccion', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                                <td className="p-1 border-r border-gray-200"><input type="text" value={columnFilters.mesa} onChange={e => handleFilterChange('mesa', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                                <td className="p-1 border-r border-gray-200"><input type="text" value={columnFilters.atendio} onChange={e => handleFilterChange('atendio', e.target.value)} className="w-full text-[10px] border border-gray-200 px-1 py-0.5 outline-none focus:border-blue-400" placeholder="Filtrar..." /></td>
                                            </>
                                        )}
                                        {mode === 'REP_DISC' && <td className="p-1 bg-gray-50 border-r border-gray-200"></td>}
                                        <td className="p-1 bg-gray-50 border-r border-gray-200"></td>
                                        <td className="p-1 bg-gray-50 border-r border-gray-200"></td>
                                        <td className="p-1 bg-gray-50 border-r border-gray-200"></td>
                                        <td className="p-1 bg-gray-50 border-r border-gray-200"></td>
                                        {mode === 'REP_ALL' && (
                                            <>
                                                <td className="p-1 bg-gray-50 border-r border-gray-200"></td>
                                                <td className="p-1 bg-gray-50 border-r border-gray-200"></td>
                                            </>
                                        )}
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {groupedData ? (
                                Object.entries(groupedData).map(([groupName, items]) => (
                                    <React.Fragment key={groupName}>
                                        <tr
                                            onClick={() => toggleGroup(groupName)}
                                            className="bg-[#106ebe] text-white cursor-pointer select-none group"
                                        >
                                            <td colSpan={mode === 'REP_CREDIT' ? 12 : (mode === 'REP_DISC' ? 11 : (mode === 'REP_VOID' ? 10 : (mode === 'REP_ALL' ? 12 : 10)))} className="px-3 py-1.5 flex items-center gap-2">
                                                <span className="text-[10px] font-black transition-transform duration-200" style={{ transform: collapsedGroups.has(groupName) ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                                                <span className="text-[11px] font-black uppercase tracking-wider">{groupName}</span>
                                                <span className="text-[10px] font-bold text-gray-300 bg-white/10 px-2 py-0.5 rounded ml-2">({(items as any[]).length} órdenes)</span>
                                            </td>
                                        </tr>
                                        {collapsedGroups.has(groupName) ? null : (items as any[]).map((row: any, idx: number) => {
                                            return (
                                                <tr
                                                    key={`${groupName}-${idx}`}
                                                    onClick={(e) => { e.stopPropagation(); setSelectedOrderId(row.id); }}
                                                    onDoubleClick={() => {
                                                        setSelectedOrderId(row.id);
                                                        fetchOrderDetails(row);
                                                    }}
                                                    onContextMenu={(e) => handleContextMenu(e, row)}
                                                    className={`border-b border-gray-200 font-medium cursor-default select-none ${selectedOrderId === row.id
                                                        ? 'selected-row-custom text-white'
                                                        : 'hover:bg-[#e1e5eb] text-slate-700 odd:bg-white even:bg-[#f6f8fa]'
                                                        }`}
                                                >
                                                    {mode === 'REP_CREDIT' ? (
                                                        <>
                                                            <td className="px-3 py-1.5 text-center flex flex-col items-center justify-center leading-tight">
                                                                <span className="text-[10px] font-bold opacity-80">{row.fecha_full}</span>
                                                                <div className="flex items-center gap-1">
                                                                    <Clock size={10} className="opacity-50" />
                                                                    <span className="text-[11px] font-black">{row.apertura}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-1.5 text-center font-bold text-[10px]">{row.tipo}</td>
                                                            <td className="px-3 py-1.5 text-center font-black text-indigo-500 text-[10px]">#{row.noOrden}</td>
                                                            <td className="px-3 py-1.5 text-center uppercase text-[10px]">Cuenta 1</td>
                                                            <td className="px-3 py-1.5 text-left font-black text-[10px] uppercase truncate max-w-[180px]">{row.cliente}</td>
                                                            <td className="px-3 py-1.5 text-center font-bold text-[10px] uppercase truncate max-w-[150px]">{row.atendio}</td>
                                                            <td className="px-3 py-1.5 text-right font-bold text-[10px]">{formatCurr(row.total)}</td>
                                                            <td className="px-3 py-1.5 text-right font-medium text-[10px]">{formatCurr(row.efectivo)}</td>
                                                            <td className="px-3 py-1.5 text-right font-medium text-[10px]">{formatCurr(row.tarjeta)}</td>
                                                            <td className="px-3 py-1.5 text-right font-black text-blue-600 text-[10px]">{formatCurr(row.credito)}</td>
                                                            <td className="px-3 py-1.5 text-right font-medium text-[10px]">{formatCurr(row.otros)}</td>
                                                            <td className="px-3 py-1.5 text-right font-black text-slate-900 text-[11px] bg-blue-50/50">{formatCurr(row.total)}</td>
                                                        </>
                                                    ) : mode === 'REP_DELIVERY' ? (
                                                        <>
                                                            <td className="px-3 py-1.5 text-center flex flex-col items-center justify-center leading-tight">
                                                                <span className="text-[10px] font-bold opacity-80">{row.fecha_full}</span>
                                                                <div className="flex items-center gap-1">
                                                                    <Clock size={10} className="opacity-50" />
                                                                    <span className="text-[11px] font-black">{row.apertura}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-1.5 text-center font-black text-slate-800">#{row.noOrden}</td>
                                                            <td className="px-3 py-1.5 text-center font-bold text-slate-700">{row.tipo}</td>
                                                            <td className="px-3 py-1.5 text-left font-black uppercase truncate max-w-[180px] text-slate-800">{row.cliente}</td>
                                                            <td className="px-3 py-1.5 text-center font-bold text-slate-800 tabular-nums">{row.customer_phone}</td>
                                                            <td className="px-3 py-1.5 text-center text-slate-600 truncate max-w-[150px]">{row.customer_email}</td>
                                                            <td className="px-3 py-1.5 text-left text-slate-700 truncate max-w-[240px]" title={row.delivery_address}>{row.delivery_address}</td>
                                                            <td className="px-3 py-1.5 text-center font-bold text-slate-800">{row.driver_name}</td>
                                                            <td className="px-3 py-1.5 text-right font-black text-slate-900 bg-gray-50">{formatCurr(row.total)}</td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="px-3 py-1.5 text-center border-r border-gray-200">
                                                                <div className="flex flex-col items-center justify-center leading-tight">
                                                                    <span className="text-[10px] font-bold opacity-80">{row.fecha_full}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <Clock size={10} className="opacity-50" />
                                                                        <span className="text-[11px] font-black">{row.apertura}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {mode === 'REP_VOID' && (
                                                                <td className="px-3 py-1.5 text-center border-r border-gray-200">
                                                                    <div className="flex flex-col items-center justify-center leading-tight">
                                                                        <span className="text-[10px] font-bold opacity-80">{row.fecha_anulacion_full}</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <Clock size={10} className="opacity-50" />
                                                                            <span className="text-[11px] font-black">{row.anulada}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            )}
                                                            <td className="px-3 py-1.5 text-center font-bold border-r border-gray-200">{row.tipo}</td>
                                                            <td className="px-3 py-1.5 text-center font-black text-slate-900 border-r border-gray-200">#{row.noOrden}</td>
                                                            {mode === 'REP_VOID' || mode === 'REP_DISC' ? (
                                                                <>
                                                                    <td className="px-3 py-1.5 text-center uppercase font-bold text-slate-700 border-r border-gray-200">{row.atendio}</td>
                                                                    {mode === 'REP_DISC' && <td className="px-3 py-1.5 text-center font-bold text-gray-600 border-r border-gray-200">{row.discount_type}</td>}
                                                                    <td className="px-3 py-1.5 text-left text-gray-500 truncate border-r border-gray-200" title={row.discount_reason}>{row.discount_reason}</td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="px-3 py-1.5 text-center uppercase border-r border-gray-200">{row.seccion}</td>
                                                                    <td className="px-3 py-1.5 text-center font-bold border-r border-gray-200">{row.mesa}</td>
                                                                    <td className="px-3 py-1.5 text-center font-bold border-r border-gray-200">{row.atendio}</td>
                                                                </>
                                                            )}
                                                            {mode === 'REP_DISC' && <td className="px-3 py-1.5 text-center font-bold text-slate-800 border-r border-gray-200">Cuenta 1</td>}
                                                            <td className="px-3 py-1.5 text-right font-medium text-slate-900 border-r border-gray-200">{formatCurr(row.subtotal)}</td>
                                                            <td className="px-3 py-1.5 text-right font-medium text-slate-900 border-r border-gray-200">{formatCurr(row.propina)}</td>
                                                            <td className="px-3 py-1.5 text-right font-medium text-slate-900 border-r border-gray-200">- {formatCurr(row.descuento)}</td>
                                                            <td className="px-3 py-1.5 text-right font-black text-slate-900 border-r border-gray-200">{formatCurr(row.total)}</td>
                                                            {mode === 'REP_ALL' && (
                                                                <>
                                                                    <td className="px-3 py-1.5 text-center text-[10px] border-r border-gray-200">{row.status === 'completed' ? <CheckSquare size={14} className="mx-auto text-green-600" /> : '-'}</td>
                                                                    <td className="px-3 py-1.5 text-center text-[10px] border-r border-gray-200">{row.status === 'cancelled' ? <CheckSquare size={14} className="mx-auto text-rose-600" /> : '-'}</td>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </tr>
                                            )
                                        })}
                                    </React.Fragment>
                                ))
                            ) : (
                                filteredData.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        onClick={(e) => { e.stopPropagation(); setSelectedOrderId(row.id); }}
                                        onDoubleClick={() => {
                                            setSelectedOrderId(row.id);
                                            fetchOrderDetails(row);
                                        }}
                                        onContextMenu={(e) => handleContextMenu(e, row)}
                                        className={`border-b border-gray-200 font-medium cursor-default select-none ${selectedOrderId === row.id
                                            ? 'selected-row-custom text-white'
                                            : 'hover:bg-[#e1e5eb] text-slate-700 odd:bg-white even:bg-[#f6f8fa]'
                                            }`}
                                    >
                                        {mode === 'REP_DELIVERY' ? (
                                            <>
                                                <td className="px-3 py-1.5 text-center flex flex-col items-center justify-center leading-tight border-r border-gray-200">
                                                    <span className="text-[10px] font-bold opacity-80">{row.fecha_full}</span>
                                                    <div className="flex items-center gap-1">
                                                        <Clock size={10} className="opacity-50" />
                                                        <span className="text-[11px] font-black">{row.apertura}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 text-center font-black text-slate-800 border-r border-gray-200">#{row.noOrden}</td>
                                                <td className="px-3 py-1.5 text-center font-bold text-slate-700 border-r border-gray-200">{row.tipo}</td>
                                                <td className="px-3 py-1.5 text-left font-black uppercase truncate max-w-[180px] text-slate-800 border-r border-gray-200">{row.cliente}</td>
                                                <td className="px-3 py-1.5 text-center font-bold text-slate-800 tabular-nums border-r border-gray-200">{row.customer_phone}</td>
                                                <td className="px-3 py-1.5 text-center text-slate-600 truncate max-w-[150px] border-r border-gray-200">{row.customer_email}</td>
                                                <td className="px-3 py-1.5 text-left text-slate-700 truncate max-w-[240px] border-r border-gray-200" title={row.delivery_address}>{row.delivery_address}</td>
                                                <td className="px-3 py-1.5 text-center font-bold text-slate-800 border-r border-gray-200">{row.driver_name}</td>
                                                <td className="px-3 py-1.5 text-right font-black text-slate-900 bg-gray-50 border-r border-gray-200">{formatCurr(row.total)}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-3 py-1.5 text-center border-r border-gray-200">
                                                    <div className="flex flex-col items-center justify-center leading-tight">
                                                        <span className="text-[10px] font-bold opacity-80">{row.fecha_full}</span>
                                                        <div className="flex items-center gap-1">
                                                            <Clock size={10} className="opacity-50" />
                                                            <span className="text-[11px] font-black">{row.apertura}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                {mode === 'REP_VOID' && (
                                                    <td className="px-3 py-1.5 text-center border-r border-gray-200">
                                                        <div className="flex flex-col items-center justify-center leading-tight">
                                                            <span className="text-[10px] font-bold opacity-80">{row.fecha_anulacion_full}</span>
                                                            <div className="flex items-center gap-1">
                                                                <Clock size={10} className="opacity-50" />
                                                                <span className="text-[11px] font-black">{row.anulada}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="px-3 py-1.5 text-center font-bold text-gray-600 border-r border-gray-200">{row.tipo}</td>
                                                <td className="px-3 py-1.5 text-center font-black text-slate-900 border-r border-gray-200">#{row.noOrden}</td>
                                                {mode === 'REP_VOID' || mode === 'REP_DISC' ? (
                                                    <>
                                                        <td className="px-3 py-1.5 text-center uppercase font-bold text-slate-700 border-r border-gray-200">{row.atendio}</td>
                                                        {mode === 'REP_DISC' && <td className="px-3 py-1.5 text-center font-bold text-gray-600 border-r border-gray-200">{row.discount_type}</td>}
                                                        <td className="px-3 py-1.5 text-left text-gray-500 truncate border-r border-gray-200" title={row.discount_reason}>{row.discount_reason}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-3 py-1.5 text-center text-gray-600 uppercase border-r border-gray-200 w-[150px]">{row.seccion}</td>
                                                        <td className="px-3 py-1.5 text-center font-bold text-slate-800 border-r border-gray-200 w-[100px]">{row.mesa}</td>
                                                        <td className="px-3 py-1.5 text-center font-bold text-slate-800 border-r border-gray-200 w-[150px] uppercase truncate">{row.atendio}</td>
                                                    </>
                                                )}
                                                {mode === 'REP_DISC' && <td className="px-3 py-1.5 text-center font-bold text-slate-800 border-r border-gray-200 w-[100px]">Cuenta 1</td>}
                                                <td className="px-3 py-1.5 text-right font-medium text-slate-900 border-r border-gray-200 w-[100px] tabular-nums">{formatCurr(row.subtotal)}</td>
                                                <td className="px-3 py-1.5 text-right font-medium text-slate-900 border-r border-gray-200 w-[100px] tabular-nums">{formatCurr(row.propina)}</td>
                                                <td className="px-3 py-1.5 text-right font-medium text-slate-900 border-r border-gray-200 w-[100px] tabular-nums">- {formatCurr(row.descuento)}</td>
                                                <td className="px-3 py-1.5 text-right font-black text-slate-900 border-r border-gray-200 w-[120px] tabular-nums bg-gray-50">{formatCurr(row.total)}</td>
                                                {mode === 'REP_ALL' && (
                                                    <>
                                                        <td className="px-3 py-1.5 text-center border-r border-gray-200 w-[60px]"><div className="flex items-center justify-center">{row.status === 'completed' ? <CheckSquare size={14} className="text-gray-500" /> : <div className="w-[14px] h-[14px] border border-gray-400 rounded-sm"></div>}</div></td>
                                                        <td className="px-3 py-1.5 text-center border-r border-gray-200 w-[60px]"><div className="flex items-center justify-center">{row.status === 'cancelled' ? <CheckSquare size={14} className="text-gray-500" /> : <div className="w-[14px] h-[14px] border border-gray-400 rounded-sm"></div>}</div></td>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {filteredData.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-40 opacity-10 select-none">
                            <Search size={64} className="mb-4" />
                            <span className="text-sm font-black uppercase tracking-[0.5em]">No se encontraron órdenes</span>
                        </div>
                    )}
                </div>
            )}

            {/* BARRA DE TOTALES FIJA AL FONDO - ESTRUCTURA DE TABLA PARA ALINEACIÓN PERFECTA */}
            <div className="shrink-0 bg-[#106ebe] text-white border-t border-gray-900 shadow-[0_-4px_15px_rgba(0,0,0,0.3)] z-[60]">
                <table className="w-full table-fixed uppercase font-bold text-[11px] select-none shadow-inner border-collapse">
                    <tbody>
                        <tr className="h-10">
                            {mode === 'REP_CREDIT' ? (
                                <>
                                    <td className="w-[100px] px-3">
                                        <div className="flex items-center gap-2 h-full">
                                            <span className="text-[9px] text-gray-400 font-bold uppercase">ÓRDENES:</span>
                                            <span className="text-[12px] font-black">{filteredData.length}</span>
                                        </div>
                                    </td>
                                    <td className="w-[120px]"></td>
                                    <td className="w-[100px]"></td>
                                    <td className="w-[150px]"></td>
                                    <td className="w-[100px]"></td>
                                    <td className="w-[150px]"></td>
                                    <td className="w-[100px] px-3 text-right border-l border-gray-700/30 bg-black/5">
                                        <div className="flex flex-col h-full justify-center pb-0.5">
                                            <span className="text-[7px] text-gray-400 uppercase font-black">EFECTIVO</span>
                                            <span className="text-gray-100 font-bold text-[11px]">{formatCurr(filteredData.reduce((sum, d) => sum + d.efectivo, 0))}</span>
                                        </div>
                                    </td>
                                    <td className="w-[100px] px-3 text-right border-l border-gray-700/30 bg-black/5">
                                        <div className="flex flex-col h-full justify-center pb-0.5">
                                            <span className="text-[7px] text-gray-400 uppercase font-black">TARJETA</span>
                                            <span className="text-gray-100 font-bold text-[11px]">{formatCurr(filteredData.reduce((sum, d) => sum + d.tarjeta, 0))}</span>
                                        </div>
                                    </td>
                                    <td className="w-[100px] px-3 text-right border-l border-gray-700/30 bg-black/5">
                                        <div className="flex flex-col h-full justify-center pb-0.5">
                                            <span className="text-[7px] text-gray-400 uppercase font-black">CRÉDITO</span>
                                            <span className="text-blue-400 font-bold text-[11px]">{formatCurr(filteredData.reduce((sum, d) => sum + d.credito, 0))}</span>
                                        </div>
                                    </td>
                                    <td className="w-[120px] px-3 text-right border-l border-gray-700 bg-black/30">
                                        <div className="flex flex-col h-full justify-center pb-0.5">
                                            <span className="text-[9px] text-gray-400 font-black uppercase">TOTAL</span>
                                            <span className="text-[14px] font-black text-white">{formatCurr(totals.total)}</span>
                                        </div>
                                    </td>
                                </>
                            ) : mode === 'REP_DELIVERY' ? (
                                <>
                                    <td className="w-[110px] px-3 border-r border-gray-700/20">
                                        <div className="flex items-center gap-2 h-full">
                                            <span className="text-[9px] text-gray-400 font-bold uppercase">ÓRDENES:</span>
                                            <span className="text-[12px] font-black">{filteredData.length}</span>
                                        </div>
                                    </td>
                                    <td className="w-[80px]"></td>
                                    <td className="w-[120px]"></td>
                                    <td className="w-[180px]"></td>
                                    <td className="w-[100px]"></td>
                                    <td className="w-[150px]"></td>
                                    <td className="w-[240px]"></td>
                                    <td className="w-[130px]"></td>
                                    <td className="w-[110px] px-3 text-right border-l border-gray-700/30 bg-black/5 bg-opacity-20 bg-indigo-900">
                                        <div className="flex flex-col h-full justify-center pb-0.5">
                                            <span className="text-[7px] text-gray-300 uppercase font-black">TOTAL DOMICILIO</span>
                                            <span className="text-white font-black text-[12px]">{formatCurr(totals.total)}</span>
                                        </div>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="w-[100px] px-3 border-r border-gray-700/20">
                                        <div className="flex items-center gap-2 h-full">
                                            <span className="text-[9px] text-gray-400 font-bold uppercase">ÓRDENES:</span>
                                            <span className="text-[12px] font-black">{filteredData.length}</span>
                                        </div>
                                    </td>
                                    <td className="w-[120px]"></td>
                                    <td className="w-[100px]"></td>
                                    <td className="w-[150px]"></td>
                                    <td className="w-[100px]"></td>
                                    <td className="w-[150px]"></td>
                                    <td className="w-[100px] px-3 text-right border-l border-gray-700/30 bg-black/5">
                                        <div className="flex flex-col h-full justify-center pb-0.5">
                                            <span className="text-[7px] text-gray-400 uppercase font-black">SUBTOTAL</span>
                                            <span className="text-gray-100 font-bold text-[11px]">{formatCurr(totals.subtotal)}</span>
                                        </div>
                                    </td>
                                    <td className="w-[100px] px-3 text-right border-l border-gray-700/30 bg-black/5">
                                        <div className="flex flex-col h-full justify-center pb-0.5">
                                            <span className="text-[7px] text-gray-400 uppercase font-black">PROPINA</span>
                                            <span className="text-gray-100 font-bold text-[11px]">{formatCurr(totals.propina)}</span>
                                        </div>
                                    </td>
                                    <td className="w-[100px] px-3 text-right border-l border-gray-700/30 bg-black/5">
                                        <div className="flex flex-col h-full justify-center pb-0.5">
                                            <span className="text-[7px] text-gray-400 uppercase font-black">DESCUENTO</span>
                                            <span className="text-gray-400 font-bold text-[11px]">{formatCurr(totals.descuento)}</span>
                                        </div>
                                    </td>
                                    <td className="w-[120px] px-3 text-right border-l border-gray-700 bg-black/30">
                                        <div className="flex flex-col h-full justify-center pb-0.5">
                                            <span className="text-[9px] text-gray-400 font-black uppercase">GRAN TOTAL</span>
                                            <span className="text-[14px] font-black text-white">{formatCurr(totals.total)}</span>
                                        </div>
                                    </td>
                                    {mode === 'REP_ALL' && <td className="w-[120px]"></td>}
                                </>
                            )}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="absolute z-[1000] bg-white border border-gray-300 shadow-xl py-1 min-w-[180px] rounded-sm"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group"
                        onClick={() => {
                            fetchOrderDetails(contextMenu.order);
                            setContextMenu(null);
                        }}
                    >
                        <FileText size={14} className="text-blue-500 group-hover:text-white" /> Ver Orden
                    </button>
                </div>
            )}

            {/* Order Viewer Modal PORTAL */}
            {
                showOrderModal && viewingOrder && createPortal(
                    <div className={`fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 p-0 sm:p-4 overflow-hidden`}>
                        <DraggableWindow disabled={isMobile}>
                            <div className={`bg-[#f0f0f0] border border-[#106ebe] shadow-2xl flex flex-col w-full h-full sm:w-[480px] sm:h-auto sm:max-h-[92vh] overflow-hidden select-none font-sans ${isMobile ? '' : 'rounded-sm'}`}>
                                {/* Title Bar */}
                                <div className="bg-[#106ebe] h-10 sm:h-8 px-3 flex justify-between items-center cursor-move text-white shrink-0">
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-tight px-1">
                                        <FileText size={12} className="text-blue-100" strokeWidth={2.5} />
                                        <span>Visor de Ordenes</span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        <button
                                            onClick={() => setShowOrderModal(false)}
                                            className="w-8 h-7 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors text-white/90"
                                            title="Cerrar"
                                        >
                                            <X size={16} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white p-3 flex flex-col gap-1 border-b border-gray-400">
                                    {/* Density Optimized Rows */}
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="text-[10px] font-bold text-slate-800 w-24">No. Orden:</span>
                                            <div className="flex-1 h-6 border border-gray-400 bg-white px-2 flex items-center text-[11px] font-black text-black shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)]">
                                                {viewingOrder.noOrden}
                                            </div>
                                        </div>
                                        <button className="bg-[#e1e1e1] border border-gray-500 px-3 h-6 text-[10px] font-black text-black hover:bg-gray-200 flex items-center gap-1.5 shadow-sm active:bg-gray-300">
                                            IMPRIMIR <Printer size={11} strokeWidth={3} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-800 w-24">Fecha y Hora:</span>
                                        <div className="flex-1 h-6 border border-gray-400 bg-white px-2 flex items-center text-[10px] font-bold text-slate-700 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] tabular-nums uppercase">
                                            {viewingOrder.fecha_full || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} {viewingOrder.apertura}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="text-[10px] font-bold text-slate-800 w-24">Sección:</span>
                                            <div className="flex-1 h-6 border border-gray-400 bg-white px-2 flex items-center text-[10px] font-bold text-black shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] uppercase truncate">
                                                {viewingOrder.seccion}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 w-24">
                                            <span className="text-[10px] font-bold text-slate-800">Mesa:</span>
                                            <div className="flex-1 h-6 border border-gray-400 bg-white px-1 flex items-center justify-center text-[10px] font-black text-black shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)]">
                                                {viewingOrder.mesa}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-800 w-24">Atendió:</span>
                                        <div className="flex-1 h-6 border border-gray-400 bg-white px-2 flex items-center text-[10px] font-bold text-black shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] uppercase truncate">
                                            {viewingOrder.atendio}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="text-[10px] font-bold text-slate-800 w-24">Cuenta:</span>
                                            <select
                                                value={selectedAccount}
                                                onChange={(e) => setSelectedAccount(e.target.value)}
                                                className="flex-1 h-6 border border-gray-400 bg-white text-[10px] font-black px-1.5 outline-none focus:ring-1 focus:ring-blue-500 shadow-sm uppercase cursor-pointer text-black"
                                            >
                                                <option value="ALL">TODAS LAS CUENTAS</option>
                                                {uniqueAccounts.map(acc => (
                                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => setSelectedAccount('ALL')}
                                            className="bg-[#e1e1e1] border border-gray-500 px-3 h-6 text-[10px] font-black text-black hover:bg-gray-200 shadow-sm active:bg-gray-300"
                                        >
                                            VER TODOS
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="text-[10px] font-bold text-slate-800 w-24">Tipo:</span>
                                            <div className="flex-1 h-6 border border-gray-400 bg-white px-2 flex items-center text-[10px] font-bold text-black shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] uppercase">
                                                {viewingOrder.tipo}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 w-44 justify-end shrink-0">
                                            <span className="text-[10px] font-bold text-slate-800">Estado:</span>
                                            <div className="w-24 h-6 border border-gray-400 bg-white px-2 flex items-center justify-center text-[10px] font-black text-black shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] uppercase">
                                                {viewingOrder.status === 'completed' || !viewingOrder.status ? 'PAGADA' :
                                                    viewingOrder.status === 'cancelled' ? 'ANULADA' : 'PENDIENTE'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Dense Items List */}
                                <div className="flex-1 min-h-[350px] overflow-auto bg-[#dcdcdc] p-1.5 flex flex-col gap-1">
                                    {loadingOrderItems ? (
                                        <div className="h-full flex flex-col items-center justify-center gap-2 opacity-50">
                                            <Loader2 className="animate-spin text-slate-600" size={24} strokeWidth={3} />
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Cargando datos...</span>
                                        </div>
                                    ) : (
                                        filteredOrderItems.map((item) => {
                                            const noteParts = item.notes ? item.notes.replace('*NO IMPRIMIR*', '').split(' | ') : [];
                                            return (
                                                <div key={item.id} className="flex flex-col bg-white border border-gray-400 shadow-[1px_1px_1px_rgba(0,0,0,0.1)]">
                                                    {/* Header dark bar - ultra compact */}
                                                    <div className="bg-[#5a5a5a] h-7 px-2 flex items-center justify-between text-white shrink-0 border-b border-gray-600">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[12px] font-black w-6 text-center tabular-nums bg-black/10 h-full flex items-center justify-center">{item.quantity}</span>
                                                            <span className="text-[10px] font-black uppercase tracking-tight">{item.products?.name || item.product_name}</span>
                                                        </div>
                                                        <span className="text-[11px] font-bold tabular-nums">Q{((item.unit_price || item.price || 0) * (item.quantity || 0)).toFixed(2)}</span>
                                                    </div>
                                                    {/* Modifiers List - dense */}
                                                    {noteParts.length > 0 && (
                                                        <div className="p-1 px-2 flex flex-col gap-0.5 bg-white">
                                                            {noteParts.map((mod, mIdx) => (
                                                                <div key={mIdx} className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-2 ml-8">
                                                                    <div className="w-1 h-[0.5px] bg-slate-300" /> {mod}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Summary Footer - Compact Matrix */}
                                <div className="bg-[#f0f0f0] border-t border-gray-400 p-3 pt-2 shrink-0 flex flex-col gap-1 items-end">
                                    <div className="flex items-center gap-3 w-full max-w-[200px]">
                                        <span className="text-[10px] font-bold text-slate-800 flex-1 text-right">Sub-Total:</span>
                                        <div className="w-24 h-6 border border-gray-400 bg-white px-2 flex items-center justify-end text-[10px] font-bold text-slate-800 shadow-[inset_1px_1px_1px_rgba(0,0,0,0.05)] tabular-nums">
                                            Q{subtotalWithoutTax.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="flex-1 flex items-center justify-end gap-2">
                                            <span className="text-[10px] font-bold text-slate-800 shrink-0">Descuento aplicado a:</span>
                                            <div className="flex-1 max-w-[200px] h-6 border border-gray-400 bg-white px-2 flex items-center text-[10px] font-black text-blue-700 shadow-[inset_1px_1px_1px_rgba(0,0,0,0.05)] uppercase truncate min-w-[120px]">
                                                {viewingOrder.discount_reason ? viewingOrder.discount_reason : (viewingOrder.descuento > 0 ? 'DESCUENTO APLICADO' : '')}
                                            </div>
                                        </div>
                                        <div className="w-24 h-6 border border-gray-400 bg-white px-2 flex items-center justify-end text-[10px] font-bold text-black shadow-[inset_1px_1px_1px_rgba(0,0,0,0.05)] tabular-nums shrink-0">
                                            Q{discount.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full max-w-[200px]">
                                        <span className="text-[10px] font-bold text-slate-800 flex-1 text-right">Propina:</span>
                                        <div className="w-24 h-6 border border-gray-400 bg-white px-2 flex items-center justify-end text-[10px] font-bold text-slate-800 shadow-[inset_1px_1px_1px_rgba(0,0,0,0.05)] tabular-nums">
                                            Q{tip.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="h-px bg-gray-400 w-full max-w-[200px] my-0.5" />
                                    <div className="flex items-center gap-3 w-full max-w-[200px]">
                                        <span className="text-[10px] font-black text-slate-950 flex-1 text-right uppercase">Total:</span>
                                        <div className="w-24 h-7 border-2 border-gray-600 bg-white px-2 flex items-center justify-end text-[12px] font-black text-slate-900 shadow-[inset_1px_1px_1px_rgba(0,0,0,0.1)] tabular-nums">
                                            Q{total.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>,
                    document.body
                )
            }

            {/* Vista Previa / Modal de Impresión */}
            {
                showPrintModal && createPortal(
                    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 p-4 overflow-hidden">
                        <DraggableWindow>
                            <div className="bg-[#f0f0f0] border border-[#106ebe] shadow-2xl flex flex-col w-[90vw] max-w-6xl h-[90vh] overflow-hidden select-none font-sans">
                                {/* Toolbar Modal */}
                                <div className="bg-[#106ebe] h-10 px-4 flex justify-between items-center text-white shrink-0">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                                        <Printer size={14} className="text-blue-400" />
                                        <span>Vista Previa de Reporte</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handlePrint()}
                                            className="h-7 px-4 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-black uppercase flex items-center gap-2"
                                        >
                                            <Printer size={12} /> Imprimir PDF
                                        </button>
                                        <button
                                            onClick={handleExportExcel}
                                            disabled={isExporting}
                                            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-400 text-emerald-700 px-4 py-1 text-xs font-bold flex items-center gap-2 transition-colors shadow-sm ml-2"
                                        >
                                            <Download size={14} /> Descargar Excel (.xlsx)
                                        </button>
                                        <button onClick={() => setShowPrintModal(false)} className="h-7 w-8 flex items-center justify-center hover:bg-red-500 transition-colors">
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Hoja de Reporte (Printable Content) */}
                                <div className="flex-1 overflow-auto bg-gray-600 p-8 custom-scrollbar">
                                    <div
                                        ref={printRef}
                                        className="bg-white mx-auto p-12 shadow-2xl min-h-full w-[1000px] text-black print:shadow-none print:w-full print:p-8 font-serif"
                                    >
                                        {/* Header Reporte */}
                                        <div className="text-center mb-10 border-b-2 border-gray-900 pb-6">
                                            <h1 className="text-4xl font-black uppercase tracking-tighter mb-1">RESTAURANTE LAS PALMAS</h1>
                                            <p className="text-[14px] font-black uppercase tracking-[0.3em] text-gray-600 mb-4">Sistema de Control Administrativo</p>
                                            <div className="flex justify-between items-end">
                                                <div className="text-left">
                                                    <h2 className="text-2xl font-black uppercase text-slate-800">
                                                        {mode === 'REP_CREDIT' ? 'REPORTE DE ÓRDENES AL CRÉDITO' :
                                                            mode === 'REP_CLOSED_CH' ? 'ÓRDENES CERRADAS POR CANAL' :
                                                                mode === 'REP_VOID' ? 'REPORTE DE ANULACIONES' : 'REPORTE GENERAL DE VENTAS'}
                                                    </h2>
                                                    <p className="text-[12px] font-bold text-gray-500">Periodo: {startDate} {startTime} - {endDate} {endTime}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[12px] font-bold text-gray-800">Sucursal: {selectedBranch === 'ALL' ? 'TODAS' : (branches.find(b => b.id === selectedBranch)?.name || 'SALA')}</p>
                                                    <p className="text-[10px] font-mono text-gray-500">Generado el: {new Date().toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tabla Reporte */}
                                        <table className="w-full border-collapse border-b-2 border-gray-900">
                                            <thead>
                                                <tr className="bg-gray-100 border-y-2 border-gray-900 text-[11px] font-black uppercase text-center">
                                                    {mode === 'REP_CREDIT' ? (
                                                        <>
                                                            <th className="px-3 py-1.5 border-r border-gray-300 w-[100px] cursor-pointer hover:bg-gray-100" onClick={() => requestSort('apertura')}>Apertura</th>
                                                            <th className="px-3 py-1.5 border-r border-gray-300 w-[120px] cursor-pointer hover:bg-gray-100" onClick={() => requestSort('tipo')}>Tipo</th>
                                                            <th className="px-3 py-1.5 border-r border-gray-300 w-[100px] cursor-pointer hover:bg-gray-100" onClick={() => requestSort('noOrden')}>No. Orden</th>
                                                            <th className="px-3 py-1.5 border-r border-gray-300 w-[150px] cursor-pointer hover:bg-gray-100" onClick={() => requestSort('seccion')}>Sección</th>
                                                            <th className="px-3 py-1.5 border-r border-gray-300 w-[100px] cursor-pointer hover:bg-gray-100 text-center" onClick={() => requestSort('mesa')}>Mesa No.</th>
                                                            <th className="px-3 py-1.5 border-r border-gray-300 w-[150px] cursor-pointer hover:bg-gray-100" onClick={() => requestSort('atendio')}>Atendió</th>
                                                            <th className="px-3 py-1.5 border-r border-gray-300 w-[100px] cursor-pointer hover:bg-gray-100 text-right" onClick={() => requestSort('subtotal')}>Subtotal</th>
                                                            <th className="px-3 py-1.5 border-r border-gray-300 w-[100px] cursor-pointer hover:bg-gray-100 text-right" onClick={() => requestSort('propina')}>Propina</th>
                                                            <th className="px-3 py-1.5 border-r border-gray-300 w-[100px] cursor-pointer hover:bg-gray-100 text-right" onClick={() => requestSort('descuento')}>Descuento</th>
                                                            <th className="px-3 py-1.5 border-r border-gray-300 w-[120px] cursor-pointer hover:bg-gray-100 text-right font-black bg-gray-50 bg-opacity-50" onClick={() => requestSort('total')}>Total</th>
                                                            {mode === 'REP_ALL' && (
                                                                <>
                                                                    <th className="px-3 py-1.5 border-r border-gray-300 w-[100px] text-center">Cerrada</th>
                                                                    <th className="px-3 py-1.5 w-[100px] text-center">Anulada</th>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : mode === 'REP_VOID' || mode === 'REP_DISC' ? (
                                                        <>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-32 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('apertura')}>{mode === 'REP_VOID' ? 'Creada' : 'Creada'}</th>
                                                            {mode === 'REP_VOID' && <th className="px-3 py-2 border-r border-gray-300 w-32 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('fecha_anulacion')}>Anulada</th>}
                                                            <th className="px-3 py-2 border-r border-gray-300 w-24 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('tipo')}>Tipo</th>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-24 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('noOrden')}>No. Orden</th>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-40 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('atendio')}>{mode === 'REP_VOID' ? 'Autorizado' : 'Autorizado Por'}</th>
                                                            {mode === 'REP_DISC' && <th className="px-3 py-2 border-r border-gray-300 w-32">Desc. Tipo</th>}
                                                            <th className="px-3 py-2 border-r border-gray-300 w-64 text-left">Motivo</th>
                                                            {mode === 'REP_DISC' && <th className="px-3 py-2 border-r border-gray-300 w-24">Cuenta</th>}
                                                            <th className="px-3 py-2 border-r border-gray-300 w-24 text-right" onClick={() => requestSort('subtotal')}>SubTotal</th>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-24 text-right" onClick={() => requestSort('propina')}>Propina</th>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-24 text-right" onClick={() => requestSort('descuento')}>Descuento</th>
                                                            <th className="px-3 py-2 text-right w-32" onClick={() => requestSort('total')}>Total</th>
                                                        </>
                                                    ) : mode === 'REP_DELIVERY' ? (
                                                        <>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-32 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('created_at')}>Fecha</th>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-24 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('noOrden')}>No. Orden</th>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-24 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('tipo')}>Tipo de Orden</th>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-32 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('cliente')}>Cliente</th>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-24">Teléfono</th>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-32">Correo</th>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-64 text-left">Dirección</th>
                                                            <th className="px-3 py-2 border-r border-gray-300 w-32">Repartidor</th>
                                                            <th className="px-3 py-2 text-right w-32" onClick={() => requestSort('total')}>Total</th>
                                                        </>
                                                    ) : mode === 'REP_ALL' ? (
                                                        <>
                                                            <th className="p-2 border-x text-left">Fecha/Hora</th>
                                                            <th className="p-2 border-x">Canal</th>
                                                            <th className="p-2 border-x">Orden</th>
                                                            <th className="p-2 border-x">Atendió</th>
                                                            <th className="p-2 border-x text-right">Subtotal</th>
                                                            <th className="p-2 border-x text-right">Propina</th>
                                                            <th className="p-2 border-x text-right">Desc.</th>
                                                            <th className="p-2 border-x text-right font-black">Total</th>
                                                            <th className="p-2 border-x text-center">Cerrada</th>
                                                            <th className="p-2 border-x text-center">Anulada</th>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <th className="p-2 border-x text-left">Fecha/Hora</th>
                                                            <th className="p-2 border-x">Canal</th>
                                                            <th className="p-2 border-x">Orden</th>
                                                            <th className="p-2 border-x">Atendió</th>
                                                            <th className="p-2 border-x text-right">Subtotal</th>
                                                            <th className="p-2 border-x text-right">Propina</th>
                                                            <th className="p-2 border-x text-right">Desc.</th>
                                                            <th className="p-2 border-x text-right font-black">Total</th>
                                                        </>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="text-[10px]">
                                                {filteredData.map((row, i) => (
                                                    <tr key={i} className="border-b border-gray-300 odd:bg-white even:bg-gray-50">
                                                        {mode === 'REP_CREDIT' ? (
                                                            <>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 font-bold bg-gray-100">{row.fecha_full} {row.apertura}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-center">{row.tipo}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-center font-bold">#{row.noOrden}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 uppercase truncate max-w-[150px]">{row.cliente}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-right">{formatCurr(row.total)}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-right">{formatCurr(row.efectivo)}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-right">{formatCurr(row.tarjeta)}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-right font-black bg-slate-50 text-slate-900">{formatCurr(row.credito)}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-right">{formatCurr(row.otros)}</td>
                                                                <td className="px-3 py-1.5 text-right font-black bg-gray-50">{formatCurr(row.total)}</td>
                                                            </>
                                                        ) : mode === 'REP_VOID' || mode === 'REP_DISC' ? (
                                                            <>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 font-bold bg-gray-50">{row.fecha_creacion}</td>
                                                                {mode === 'REP_VOID' && <td className="px-3 py-1.5 border-r border-gray-300 font-bold text-slate-900 bg-slate-50/30">{row.fecha_anulacion}</td>}
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-center">{row.tipo}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-center font-black text-slate-900">#{row.noOrden}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 uppercase truncate font-bold text-slate-700">{row.atendio}</td>
                                                                {mode === 'REP_DISC' && <td className="px-3 py-1.5 border-r border-gray-300 text-center text-gray-500 font-bold">{row.discount_type}</td>}
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-left text-gray-400 max-w-[250px] truncate" title={row.discount_reason}>{row.discount_reason}</td>
                                                                {mode === 'REP_DISC' && <td className="px-3 py-1.5 border-r border-gray-300 text-center text-slate-700 font-bold">Cuenta 1</td>}
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-right font-medium">{formatCurr(row.subtotal)}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-right font-medium">{formatCurr(row.propina)}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-right font-medium">-{formatCurr(row.descuento)}</td>
                                                                <td className="px-3 py-1.5 text-right font-black bg-gray-50 text-slate-900">{formatCurr(row.total)}</td>
                                                            </>
                                                        ) : mode === 'REP_DELIVERY' ? (
                                                            <>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 font-bold bg-gray-100">{row.fecha_full} {row.apertura}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-center font-bold">#{row.noOrden}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-center">{row.tipo}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 uppercase truncate max-w-[150px]">{row.cliente}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-center font-mono">{row.customer_phone}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 truncate max-w-[120px] text-gray-500">{row.customer_email}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-left truncate max-w-[250px]">{row.delivery_address}</td>
                                                                <td className="px-3 py-1.5 border-r border-gray-300 text-center font-bold text-slate-800">{row.driver_name}</td>
                                                                <td className="px-3 py-1.5 text-right font-black bg-gray-50">{formatCurr(row.total)}</td>
                                                            </>
                                                        ) : mode === 'REP_ALL' ? (
                                                            <>
                                                                <td className="p-2 border-x text-left font-bold">{row.fecha_full} {row.apertura}</td>
                                                                <td className="p-2 border-x text-center font-bold">{row.tipo}</td>
                                                                <td className="p-2 border-x text-center font-bold">#{row.noOrden}</td>
                                                                <td className="p-2 border-x text-center uppercase">{row.atendio}</td>
                                                                <td className="p-2 border-x text-right">{formatCurr(row.subtotal)}</td>
                                                                <td className="p-2 border-x text-right">{formatCurr(row.propina)}</td>
                                                                <td className="p-2 border-x text-right text-slate-600">-{formatCurr(row.descuento)}</td>
                                                                <td className="p-2 border-x text-right font-black bg-gray-100">{formatCurr(row.total)}</td>
                                                                <td className="p-2 border-x text-center">{row.status === 'completed' ? 'X' : ''}</td>
                                                                <td className="p-2 border-x text-center">{row.status === 'cancelled' ? 'X' : ''}</td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className="p-2 border-x text-left font-bold">{row.fecha_full} {row.apertura}</td>
                                                                <td className="p-2 border-x text-center font-bold">{row.tipo}</td>
                                                                <td className="p-2 border-x text-center font-bold">#{row.noOrden}</td>
                                                                <td className="p-2 border-x text-center uppercase">{row.atendio}</td>
                                                                <td className="p-2 border-x text-right">{formatCurr(row.subtotal)}</td>
                                                                <td className="p-2 border-x text-right">{formatCurr(row.propina)}</td>
                                                                <td className="p-2 border-x text-right text-slate-600">-{formatCurr(row.descuento)}</td>
                                                                <td className="p-2 border-x text-right font-black bg-gray-100">{formatCurr(row.total)}</td>
                                                            </>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-gray-200 border-t-2 border-gray-900 font-black text-[12px]">
                                                    {mode === 'REP_CREDIT' ? (
                                                        <>
                                                            <td colSpan={4} className="p-2 text-right">TOTAL GENERAL:</td>
                                                            <td className="p-2 border-x text-right">{formatCurr(filteredData.reduce((s, d) => s + d.total, 0))}</td>
                                                            <td className="p-2 border-x text-right">{formatCurr(filteredData.reduce((s, d) => s + d.efectivo, 0))}</td>
                                                            <td className="p-2 border-x text-right">{formatCurr(filteredData.reduce((s, d) => s + d.tarjeta, 0))}</td>
                                                            <td className="p-2 border-x text-right bg-gray-300">{formatCurr(filteredData.reduce((s, d) => s + d.credito, 0))}</td>
                                                            <td className="p-2 border-x text-right">{formatCurr(filteredData.reduce((s, d) => s + d.otros, 0))}</td>
                                                            <td className="p-2 border-x text-right text-[14px]">{formatCurr(totals.total)}</td>
                                                        </>
                                                    ) : mode === 'REP_DELIVERY' ? (
                                                        <>
                                                            <td colSpan={8} className="p-2 text-right">TOTAL VENTAS:</td>
                                                            <td className="p-2 border-x text-right text-[14px]">{formatCurr(totals.total)}</td>
                                                        </>
                                                    ) : (mode === 'REP_VOID' || mode === 'REP_DISC') ? (
                                                        <>
                                                            <td colSpan={mode === 'REP_VOID' ? 6 : 8} className="p-2 text-right">TOTAL GENERAL:</td>
                                                            <td className="p-2 border-x text-right font-black">{formatCurr(totals.subtotal)}</td>
                                                            <td className="p-2 border-x text-right font-black">{formatCurr(totals.propina)}</td>
                                                            <td className="p-2 border-x text-right font-black text-slate-900">-{formatCurr(totals.descuento)}</td>
                                                            <td className="p-2 border-x text-right text-[14px] bg-gray-300 font-black">{formatCurr(totals.total)}</td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td colSpan={4} className="p-2 text-right">TOTAL GENERAL:</td>
                                                            <td className="p-2 border-x text-right">{formatCurr(totals.subtotal)}</td>
                                                            <td className="p-2 border-x text-right">{formatCurr(totals.propina)}</td>
                                                            <td className="p-2 border-x text-right text-slate-950">-{formatCurr(totals.descuento)}</td>
                                                            <td className="p-2 border-x text-right text-[14px] bg-gray-300">{formatCurr(totals.total)}</td>
                                                            {mode === 'REP_ALL' && <td colSpan={2} className="bg-gray-100"></td>}
                                                        </>
                                                    )}
                                                </tr>
                                            </tfoot>
                                        </table>

                                        {/* Auditoría Footer */}
                                        <div className="mt-12 flex justify-between px-10">
                                            <div className="w-[200px] border-t border-gray-800 text-center pt-2">
                                                <p className="text-[10px] font-black uppercase">Responsable Operativo</p>
                                            </div>
                                            <div className="w-[200px] border-t border-gray-800 text-center pt-2">
                                                <p className="text-[10px] font-black uppercase">Autorización Gerencial</p>
                                            </div>
                                        </div>
                                        <div className="mt-8 text-center text-[8px] font-serif text-gray-400">
                                            Restaurante Las Palmas POS - Generado por {currentUser?.name || 'Administrador'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>,
                    document.body
                )
            }

            {/* Footer Summary removed from here and moved inside table as tfoot */}

            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                
                /* Selected Row Premium Contrast Styles */
                .selected-row-custom {
                    background-color: #106ebe !important;
                }
                .selected-row-custom td {
                    color: #ffffff !important;
                    background-color: transparent !important;
                }
                .selected-row-custom td span,
                .selected-row-custom td div,
                .selected-row-custom td font {
                    color: #ffffff !important;
                    background-color: transparent !important;
                }
                .selected-row-custom td svg {
                    color: #ffffff !important;
                    opacity: 0.95 !important;
                }
                tr.selected-row-custom:hover {
                    background-color: #106ebe !important;
                }
            `}</style>
        </div >
    );
};
