import React, { useState, useEffect } from 'react';
import { Search, Clock, MapPin, User, FileText, ArrowRight, Printer, XCircle, AlertOctagon, Truck, Package, Utensils, Percent, Split, Minus, Plus } from 'lucide-react';
import { supabase } from '../supabase';
import { printService } from '../services/PrintService';
import { billingService } from '../services/BillingService';
import { DateUtils } from '../utils/DateUtils';

interface OrderViewerProps {
    onBack: () => void;
    onOpenOrder?: (orderId: string) => void;
    currentUser?: any;
}

const parseDBDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    // If it lacks a timezone indicator, treat as UTC by appending 'Z'
    const hasTZ = dateStr.endsWith('Z') || dateStr.match(/[+-]\d{2}:\d{2}$/);
    return new Date(hasTZ ? dateStr : `${dateStr}Z`);
};

export const OrderViewer: React.FC<OrderViewerProps> = ({ onBack, onOpenOrder, currentUser }) => {
    const [activeTab, setActiveTab] = useState<'OPEN' | 'CLOSED' | 'CANCELLED'>('OPEN');
    const [searchTerm, setSearchTerm] = useState('');
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

    useEffect(() => {
        setOrders([]);
        setSelectedOrder(null);
        fetchOrders();
        const sub = supabase.channel('order_viewer_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [activeTab]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const branchId = cachedUser?.branch_id;

            let query = supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            if (activeTab === 'OPEN') {
                query = query.not('status', 'eq', 'completed').not('status', 'eq', 'cancelled');
            } else {
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
                
                if (activeTab === 'CLOSED') {
                    query = query.eq('status', 'completed').gte('created_at', todayStart);
                } else if (activeTab === 'CANCELLED') {
                    query = query.eq('status', 'cancelled').gte('created_at', todayStart);
                }
            }

            const { data: rawOrders, error } = await query.limit(50);
            if (error) throw error;
            if (!rawOrders || rawOrders.length === 0) {
                setOrders([]);
                setLoading(false);
                return;
            }

            const waiterIds = Array.from(new Set(rawOrders.map(o => o.waiter_id).filter(Boolean)));
            const tableIds = Array.from(new Set(rawOrders.map(o => o.table_id).filter(Boolean)));

            const [profilesRes, tablesRes] = await Promise.all([
                waiterIds.length > 0 ? supabase.from('profiles').select('id, name, full_name').in('id', waiterIds) : Promise.resolve({ data: [] }),
                tableIds.length > 0 ? supabase.from('tables').select('id, number, section').in('id', tableIds) : Promise.resolve({ data: [] })
            ]);

            const profileLookup = new Map();
            profilesRes.data?.forEach(p => profileLookup.set(p.id, p.full_name || p.name || 'Usuario'));

            const tableLookup = new Map();
            tablesRes.data?.forEach(t => tableLookup.set(t.id, t));

            const enrichedOrders = rawOrders.map(order => ({
                ...order,
                profiles: {
                    name: profileLookup.get(order.waiter_id) || 'Desconocido',
                    full_name: profileLookup.get(order.waiter_id) || 'Desconocido'
                },
                tables: tableLookup.get(order.table_id) || { number: '?', section: 'General' }
            }));

            setOrders(enrichedOrders);
            // Auto-select first order if none selected
            if (enrichedOrders.length > 0 && !selectedOrder) {
                setSelectedOrder(enrichedOrders[0]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedOrder && !selectedOrder.order_items) {
            fetchOrderItems(selectedOrder.id);
        }
    }, [selectedOrder]);

    const fetchOrderItems = async (orderId: string) => {
        try {
            const { data, error } = await supabase
                .from('order_items')
                .select('*, products(name)')
                .eq('order_id', orderId);

            if (!error && data) {
                setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, order_items: data } : prev);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const isActive = (status: string) => ['pending', 'preparing', 'ready'].includes(status);

    const filteredOrders = orders.filter(order => {
        if (!searchTerm.trim()) return true;
        const search = searchTerm.toLowerCase().trim();
        return (order.tables?.number || '').toString().includes(search) ||
            (order.order_number || '').toString().includes(search) ||
            (order.customer_name || '').toLowerCase().includes(search);
    });

    const getOrderTitle = (order: any) => {
        if (order.order_type === 'DELIVERY') return 'DOMICILIO';
        if (order.order_type === 'TAKEOUT') return 'LLEVAR';
        return `MESA ${order.tables?.number || '?'}`;
    };

    return (
        <div className="fixed inset-0 w-full flex flex-col bg-[#2d2e3d] text-white overflow-hidden font-sans z-50">
            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Orders List */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-[#1e1f2b]">
                    {/* Header with Search */}
                    <div className="bg-[#3a3b4d] h-10 flex items-center justify-center px-3 shrink-0 shadow-md">
                        <button onClick={onBack} className="absolute left-3 p-1.5 hover:bg-white/5 rounded-sm text-gray-400">
                            <ArrowRight className="rotate-180" size={18} />
                        </button>
                        <h2 className="text-[11px] font-black tracking-widest uppercase">RESTAURANTE LAS PALMAS POS</h2>
                    </div>

                    <div className="p-3 bg-[#2d2e3d]">
                        <div className="relative group max-w-4xl">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                            <input
                                type="text"
                                placeholder="BUSCAR ORDEN / MESA..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-black/40 border border-white/20 rounded-sm py-2.5 pl-10 pr-3 text-[11px] font-black placeholder:text-gray-500 outline-none focus:border-white/50 focus:bg-black/60 transition-all uppercase tracking-widest text-white shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
                        {loading ? (
                            <div className="h-full flex items-center justify-center opacity-30">
                                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-sm animate-spin"></div>
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-10">
                                <FileText size={40} />
                                <span className="text-[10px] font-black uppercase tracking-widest mt-2">Sin registros</span>
                            </div>
                        ) : (
                            <div className="max-w-6xl space-y-8">
                                {/* DINE IN SECTION */}
                                {filteredOrders.some(o => o.order_type === 'DINE_IN' || !o.order_type) && (
                                    <div>
                                        <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-white mb-4 flex items-center gap-2">
                                            <Utensils size={12} className="opacity-50" /> Comer Aquí
                                            <div className="h-px flex-1 bg-white/5" />
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                            {filteredOrders.filter(o => o.order_type === 'DINE_IN' || !o.order_type).map(order => (
                                                <OrderCard
                                                    key={order.id}
                                                    order={order}
                                                    isSelected={selectedOrder?.id === order.id}
                                                    onClick={() => setSelectedOrder(order)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* TAKEOUT SECTION */}
                                {filteredOrders.some(o => o.order_type === 'TAKEOUT') && (
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-6 flex items-center gap-3">
                                            <Package size={14} className="opacity-50" /> Para Llevar
                                            <div className="h-px flex-1 bg-white/5" />
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {filteredOrders.filter(o => o.order_type === 'TAKEOUT').map(order => (
                                                <OrderCard
                                                    key={order.id}
                                                    order={order}
                                                    isSelected={selectedOrder?.id === order.id}
                                                    onClick={() => setSelectedOrder(order)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* DELIVERY SECTION */}
                                {filteredOrders.some(o => o.order_type === 'DELIVERY') && (
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-6 flex items-center gap-3">
                                            <Truck size={14} className="opacity-50" /> A Domicilio
                                            <div className="h-px flex-1 bg-white/5" />
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {filteredOrders.filter(o => o.order_type === 'DELIVERY').map(order => (
                                                <OrderCard
                                                    key={order.id}
                                                    order={order}
                                                    isSelected={selectedOrder?.id === order.id}
                                                    onClick={() => setSelectedOrder(order)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Bottom Tabs for Main Area */}
                    <div className="px-4 py-3 flex justify-center gap-2 shrink-0 border-t border-white/5">
                        <TabButton active={activeTab === 'OPEN'} onClick={() => setActiveTab('OPEN')} label="ORDENES ABIERTAS" color="bg-[#3a3b4d] border-b-2 border-white" />
                        <TabButton active={activeTab === 'CLOSED'} onClick={() => setActiveTab('CLOSED')} label="ORDENES CERRADAS" color="bg-[#3a3b4d] border-b-2 border-white" />
                        <TabButton active={activeTab === 'CANCELLED'} onClick={() => setActiveTab('CANCELLED')} label="ANULADAS" color="bg-[#3a3b4d] border-b-2 border-white" />
                    </div>
                </div>

                {/* Right Side: Order Detail */}
                <div className="w-[400px] flex flex-col bg-[#2d2e3d] shrink-0 h-full border-l border-[#1e1f2b]">
                    <div className="bg-[#3a3b4d] h-10 flex items-center justify-center shrink-0 shadow-md gap-2">
                        <FileText size={14} className="text-white/30" />
                        <h2 className="text-[11px] font-bold tracking-widest uppercase">INFORMACIÓN</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                        {selectedOrder ? (
                            <>
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-4 text-center">Artículos en la Orden</h4>
                                <div className="space-y-3">
                                    {selectedOrder.order_items?.map((item: any) => (
                                        <div key={item.id} className="bg-[#3a3b4d] rounded-sm p-3 text-sm shadow-sm border border-white/[0.03]">
                                            <div className="flex justify-between items-start">
                                                <div className="flex gap-3">
                                                    <span className="font-bold text-white/50">{item.quantity}</span>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold uppercase tracking-tight leading-tight text-white/80">{item.products?.name}</span>
                                                        {item.notes && (
                                                            <span className="text-[10px] text-gray-400 mt-1 uppercase leading-tight italic">
                                                                {item.notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="font-bold tabular-nums tracking-tighter shrink-0 ml-2 text-white/90">Q{(item.unit_price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-12 opacity-50">
                                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10 shadow-2xl">
                                    <FileText size={48} className="text-white/30" strokeWidth={1} />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/60 text-center mb-2">SIN SELECCIÓN</h3>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">
                                    Selecciona una cuenta de la lista
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Integrated Totals Section - FIXED AT BOTTOM */}
                    {selectedOrder && (
                        <div className="p-4 shrink-0 border-t border-white/5 bg-[#2d2e3d] shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.3)]">
                            <div className="ml-auto w-full max-w-[220px] space-y-1">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-500 font-bold uppercase tracking-widest leading-none self-end pb-0.5">Sub-Total</span>
                                    <span className="font-black tabular-nums text-white/80">Q{parseFloat(selectedOrder.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-500 font-bold uppercase tracking-widest leading-none self-end pb-0.5">Descuento</span>
                                    <span className="font-black tabular-nums text-white/80">-Q{parseFloat(selectedOrder.discount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-500 font-bold uppercase tracking-widest leading-none self-end pb-0.5">Propina</span>
                                    <span className="font-black tabular-nums text-white/80">Q{parseFloat(selectedOrder.tip_amount || selectedOrder.tip || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-baseline">
                                    <span className="text-[11px] font-black text-white/40 uppercase tracking-widest leading-none">Total</span>
                                    <span className="text-2xl font-black tabular-nums text-white leading-none">Q{parseFloat(selectedOrder.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer for Detail Panel */}
                    <div className="p-4 shrink-0 border-t border-white/5 bg-black/40">
                        {selectedOrder && (
                            <div className="flex gap-2">
                                <button
                                    onClick={async () => {
                                        if (!selectedOrder) return;
                                        const { data: invoice } = await supabase
                                            .from('invoices')
                                            .select('*')
                                            .eq('order_id', selectedOrder.id)
                                            .eq('status', 'ACTIVE')
                                            .maybeSingle();

                                        const ticketData = {
                                            orderId: selectedOrder.id,
                                            orderNumber: selectedOrder.order_number,
                                            tableNumber: selectedOrder.tables?.number,
                                            tableName: selectedOrder.tables?.section,
                                            waiterName: selectedOrder.profiles?.name,
                                            items: (selectedOrder.order_items || []).map((i: any) => ({
                                                name: i.products?.name || 'Desconocido',
                                                quantity: i.quantity,
                                                price: i.unit_price,
                                                notes: i.notes
                                            })),
                                            subtotal: selectedOrder.subtotal,
                                            taxAmount: selectedOrder.tax_amount || selectedOrder.tax || 0,
                                            tipAmount: selectedOrder.tip_amount || selectedOrder.tip || 0,
                                            total: selectedOrder.total,
                                            createdAt: selectedOrder.created_at,
                                            paymentMethod: selectedOrder.payment_method,
                                            customerNit: invoice?.customer_nit,
                                            customerName: invoice?.customer_name,
                                            dteInfo: invoice ? {
                                                serie: invoice.series,
                                                numero: invoice.document_number,
                                                fechaCertificacion: invoice.certification_date || invoice.created_at,
                                                autorizacion: invoice.uuid
                                            } : undefined
                                        };
                                        printService.printInvoiceTicket(ticketData as any);
                                    }}
                                    className="w-10 h-10 bg-white/5 border border-white/5 rounded-sm flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-all shrink-0"
                                >
                                    <Printer size={20} />
                                </button>
                                <button
                                    onClick={() => onOpenOrder && onOpenOrder(selectedOrder.id)}
                                    className="flex-1 bg-white hover:bg-gray-100 text-black py-3 rounded-sm text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all"
                                >
                                    ABRIR ORDEN
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, label, color }: any) => (
    <button
        onClick={onClick}
        className={`px-6 py-4 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-lg ${color} ${active ? 'opacity-100 scale-105 ring-1 ring-white/10' : 'opacity-60 grayscale-[0.5] hover:opacity-80'}`}
    >
        {label}
    </button>
);

const OrderCard = ({ order, isSelected, onClick }: any) => {
    return (
        <button
            onClick={onClick}
            className={`
                relative p-3 rounded-sm text-left border transition-all group
                ${isSelected
                    ? 'bg-white/10 border-white shadow-xl'
                    : 'bg-[#3a3b4d] border-transparent hover:bg-[#45465a]'
                }
            `}
        >
            <div className="flex justify-between items-start mb-1.5">
                <div className="flex items-center gap-1.5">
                    <FileText size={12} className="opacity-70" />
                    <span className="text-[11px] font-bold">{order.order_number}</span>
                </div>
                <span className="text-[11px] font-black tabular-nums">Q{parseFloat(order.total || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
                <div className="w-3.5 h-3.5 bg-white/20 rounded flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-sm opacity-50" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-tight truncate">
                    {order.order_type === 'DINE_IN' || !order.order_type ? (
                        `${order.tables?.section || 'MESA'} ${order.tables?.number || '?'}`
                    ) : order.order_type === 'TAKEOUT' ? (
                        'PARA LLEVAR'
                    ) : (
                        'DOMICILIO'
                    )}
                    {order.customer_name && ` - ${order.customer_name}`}
                </span>
                {(order.order_type === 'DINE_IN' || !order.order_type) && (
                    <div className="ml-auto flex items-center gap-1 opacity-70">
                        <User size={12} />
                        <span className="text-[10px] font-bold">{order.pax || 0}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-medium opacity-60">
                <Clock size={12} />
                <span>{parseDBDate(order.created_at).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
        </button>
    );
};
