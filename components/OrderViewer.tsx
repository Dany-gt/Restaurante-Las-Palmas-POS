import React, { useState, useEffect } from 'react';
import { Search, Clock, MapPin, User, FileText, ArrowRight, Printer, XCircle, AlertOctagon, Truck, Package, Utensils, Percent, Split, Minus, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { printService } from '../services/PrintService';
import { billingService } from '../services/BillingService';
import { DateUtils } from '../utils/DateUtils';
import { ItemStatusBadge } from './ItemStatusBadge';
import { parseNotes } from './OrderView';

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

const getComputedTotals = (order: any) => {
    if (!order) return { subtotal: 0, discount: 0, tip: 0, total: 0 };

    const hasItems = order.order_items && order.order_items.length > 0;

    const dbSubtotal = parseFloat(order.subtotal || 0);
    const dbTotal = parseFloat(order.total || 0);

    if (dbSubtotal > 0 && dbTotal > 0) {
        return {
            subtotal: dbSubtotal,
            discount: parseFloat(order.discount || 0),
            tip: parseFloat(order.tip_amount || order.tip || 0),
            total: dbTotal
        };
    }

    if (!hasItems) {
        return {
            subtotal: dbSubtotal,
            discount: parseFloat(order.discount || 0),
            tip: parseFloat(order.tip_amount || order.tip || 0),
            total: dbTotal
        };
    }

    // Calculate dynamically from order_items
    const calculatedSubtotal = order.order_items
        .filter((i: any) => i.status !== 'voided' && i.status !== 'cancelled')
        .reduce((acc: number, i: any) => acc + ((i.unit_price || 0) * (i.quantity || 0)), 0);

    const calculatedItemDiscounts = order.order_items
        .filter((i: any) => i.status !== 'voided' && i.status !== 'cancelled')
        .reduce((acc: number, i: any) => acc + (i.discount_amount || 0), 0);

    let globalDiscount = 0;
    if (order.discount_percentage > 0) {
        globalDiscount = (calculatedSubtotal * order.discount_percentage / 100);
    } else if (order.discount_amount > 0) {
        globalDiscount = order.discount_amount;
    } else if (order.discount > 0) {
        globalDiscount = order.discount;
    }

    const totalDiscount = calculatedItemDiscounts + globalDiscount;
    const subtotalAfterDiscount = Math.max(0, calculatedSubtotal - totalDiscount);

    const tip = parseFloat(order.tip_amount || order.tip || 0);
    const total = subtotalAfterDiscount + tip;

    return {
        subtotal: calculatedSubtotal,
        discount: totalDiscount,
        tip,
        total
    };
};

export const OrderViewer: React.FC<OrderViewerProps> = ({ onBack, onOpenOrder, currentUser }) => {
    const [activeTab, setActiveTab] = useState<'OPEN' | 'CLOSED' | 'CANCELLED'>('OPEN');
    const [searchTerm, setSearchTerm] = useState('');
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

    // Synchronized server offset and second tick for elapsed timers
    const [serverOffset, setServerOffset] = useState<number>(() => {
        const cached = localStorage.getItem('kds_server_offset');
        return cached ? parseInt(cached, 10) : 0;
    });
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const cachedSettings = JSON.parse(localStorage.getItem('system_settings') || '{}');
    const waiterName = currentUser?.full_name || currentUser?.name || cachedUser?.full_name || cachedUser?.name || 'DANILO PEREZ';
    const waiterId = currentUser?.pin || currentUser?.id || cachedUser?.pin || cachedUser?.id || '2-724';
    const restaurantName = cachedSettings?.restaurant_name || 'RESTAURANTE LAS PALMAS POS';

    const viewStatusLabel = activeTab === 'OPEN'
        ? 'Ordenes Abiertas'
        : activeTab === 'CLOSED'
            ? 'Ordenes Cerradas'
            : 'Anuladas';

    useEffect(() => {
        setOrders([]);
        setSelectedOrder(null);
        fetchOrders();
        const sub = supabase.channel('order_viewer_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, fetchOrders)
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
                .select('*, order_items(status, unit_price, quantity, discount_amount)')
                .order('created_at', { ascending: false });

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            if (currentUser?.role === 'MESERO') {
                query = query.eq('waiter_id', currentUser.id);
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

            const enrichedOrders = rawOrders.map(order => {
                const rawItems: any[] = order.order_items || [];
                const item_counts = {
                    pending: rawItems.filter(i => i.status === 'pending').length,
                    preparing: rawItems.filter(i => i.status === 'preparing').length,
                    ready: rawItems.filter(i => ['ready', 'delivered'].includes(i.status)).length,
                };

                let total = parseFloat(order.total || 0);
                let subtotal = parseFloat(order.subtotal || 0);
                let discount = parseFloat(order.discount || 0);
                const tip = parseFloat(order.tip_amount || order.tip || 0);

                if ((total === 0 || subtotal === 0) && rawItems.length > 0) {
                    const calcSubtotal = rawItems
                        .filter(i => i.status !== 'voided' && i.status !== 'cancelled')
                        .reduce((acc, i) => acc + ((i.unit_price || 0) * (i.quantity || 0)), 0);

                    const calcItemDiscounts = rawItems
                        .filter(i => i.status !== 'voided' && i.status !== 'cancelled')
                        .reduce((acc, i) => acc + (i.discount_amount || 0), 0);

                    let globalDiscount = 0;
                    if (order.discount_percentage > 0) {
                        globalDiscount = (calcSubtotal * order.discount_percentage / 100);
                    } else if (order.discount_amount > 0) {
                        globalDiscount = order.discount_amount;
                    } else if (order.discount > 0) {
                        globalDiscount = order.discount;
                    }

                    discount = calcItemDiscounts + globalDiscount;
                    subtotal = calcSubtotal;
                    total = Math.max(0, calcSubtotal - discount) + tip;
                }

                return {
                    ...order,
                    subtotal,
                    discount,
                    total,
                    order_items: undefined,   // reset → fetchGroupOrderItems se dispara al seleccionar
                    item_counts,
                    profiles: {
                        name: profileLookup.get(order.waiter_id) || 'Desconocido',
                        full_name: profileLookup.get(order.waiter_id) || 'Desconocido'
                    },
                    tables: tableLookup.get(order.table_id) || { number: '?', section: 'General' }
                };
            });

            // Grouping logic for the list by table
            const groupedMap = new Map<string, any>();
            
            enrichedOrders.forEach(order => {
                const isDineIn = order.order_type === 'DINE_IN' || !order.order_type;
                const groupId = (isDineIn && order.table_id) 
                    ? `table_${order.table_id}` 
                    : `order_${order.id}`;
                
                if (!groupedMap.has(groupId)) {
                    groupedMap.set(groupId, {
                        id: groupId,
                        isGroup: isDineIn && !!order.table_id,
                        table_id: order.table_id,
                        order_type: order.order_type || 'DINE_IN',
                        tables: order.tables,
                        created_at: order.created_at,
                        pax_count: order.pax_count || 0,
                        total: order.total || 0,
                        item_counts: {
                            pending: order.item_counts?.pending || 0,
                            preparing: order.item_counts?.preparing || 0,
                            ready: order.item_counts?.ready || 0,
                        },
                        orders: [order]
                    });
                } else {
                    const existing = groupedMap.get(groupId);
                    existing.orders.push(order);
                    existing.total += (order.total || 0);
                    existing.pax_count += (order.pax_count || 0);
                    // Keep the oldest created_at
                    if (new Date(order.created_at) < new Date(existing.created_at)) {
                        existing.created_at = order.created_at;
                    }
                    existing.item_counts.pending += (order.item_counts?.pending || 0);
                    existing.item_counts.preparing += (order.item_counts?.preparing || 0);
                    existing.item_counts.ready += (order.item_counts?.ready || 0);
                }
            });

            const groupedOrdersList = Array.from(groupedMap.values());
            // Sort orders inside each group by created_at ascending (oldest first)
            groupedOrdersList.forEach(group => {
                group.orders.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
            setOrders(groupedOrdersList);

            // Keep selected order updated with fresh data
            if (selectedOrder) {
                const freshGroup = groupedOrdersList.find(g => g.id === selectedOrder.id);
                if (freshGroup) {
                    setSelectedOrder(freshGroup);
                } else {
                    setSelectedOrder(groupedOrdersList[0] || null);
                }
            } else if (groupedOrdersList.length > 0) {
                setSelectedOrder(groupedOrdersList[0]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchGroupOrderItems = async (group: any) => {
        try {
            const orderIds = group.orders.map((o: any) => o.id);
            if (orderIds.length === 0) return;
            
            const { data, error } = await supabase
                .from('order_items')
                .select('*, products(name)')
                .in('order_id', orderIds);

            if (!error && data) {
                setSelectedOrder(prev => {
                    if (!prev || prev.id !== group.id) return prev;
                    
                    const updatedOrders = prev.orders.map((o: any) => {
                        const itemsForOrder = data.filter((item: any) => item.order_id === o.id);
                        return { ...o, order_items: itemsForOrder };
                    });
                    
                    return { ...prev, orders: updatedOrders, order_items: data };
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (selectedOrder) {
            const needsFetch = selectedOrder.orders.some((o: any) => !o.order_items);
            if (needsFetch) {
                fetchGroupOrderItems(selectedOrder);
            }
        }
    }, [selectedOrder?.id]);

    // Real-time: refresh item statuses when kitchen updates them (EN ESPERA → EN PREPARACIÓN → LISTO)
    useEffect(() => {
        if (!selectedOrder?.id) return;
        
        const orderIds = selectedOrder.orders.map((o: any) => o.id);
        if (orderIds.length === 0) return;

        const channels = orderIds.map((orderId: string) => {
            return supabase.channel(`ov_items_${orderId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'order_items',
                    filter: `order_id=eq.${orderId}`
                }, () => fetchGroupOrderItems(selectedOrder))
                .subscribe();
        });
        
        return () => { 
            channels.forEach(ch => supabase.removeChannel(ch)); 
        };
    }, [selectedOrder?.id]);

    const isActive = (status: string) => ['pending', 'preparing', 'ready'].includes(status);

    const filteredOrders = orders.filter(group => {
        if (!searchTerm.trim()) return true;
        const search = searchTerm.toLowerCase().trim();
        
        if ((group.tables?.number || '').toString().includes(search)) return true;
        if ((group.tables?.section || '').toLowerCase().includes(search)) return true;
        
        return group.orders.some((order: any) => 
            (order.order_number || '').toString().includes(search) ||
            (order.customer_name || '').toLowerCase().includes(search)
        );
    });

    const getOrderTitle = (order: any) => {
        if (order.order_type === 'DELIVERY') return 'DOMICILIO';
        if (order.order_type === 'TAKEOUT') return 'LLEVAR';
        return `MESA ${order.tables?.number || '?'}`;
    };

    return (
        <div className="fixed inset-0 w-full flex flex-col bg-[#2d2e3d] text-white overflow-hidden font-sans z-50">
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 3px !important;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent !important;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.15) !important;
                    border-radius: 99px !important;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3) !important;
                }
            `}} />
            {/* Unified Top Header Bar */}
            <div className="bg-[#3a3b4d] h-16 flex items-center justify-between px-4 shrink-0 border-b border-[#1e1f2b]">
                {/* Left side: back button and restaurant name */}
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-white/5 hover:bg-white/10 active:scale-95 rounded-xl transition-all text-gray-400 hover:text-white shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
                        {restaurantName}
                    </h1>
                </div>

                {/* Right side: User Name and status */}
                <div className="flex flex-col items-end text-right">
                    <span className="text-[11px] font-semibold text-white/95 tracking-wide">
                        {waiterName}
                    </span>
                    <span className="text-[10px] font-bold text-[#2dd4bf] uppercase tracking-wider mt-0.5">
                        {viewStatusLabel}
                    </span>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden mt-3">
                {/* Left Side: Orders List */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Sub-Header: Ordenes */}
                    <div className="bg-[#3a3b4d] h-12 flex items-center justify-center shrink-0 border-b border-[#1e1f2b]">
                        <h2 className="text-sm font-medium text-white tracking-wide">Ordenes</h2>
                    </div>

                    <div className="p-3 bg-[#2d2e3d]">
                        <div className="w-full relative group">
                            <input
                                type="text"
                                placeholder="🔍 Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-transparent border border-white/25 rounded-full py-2 px-4 text-xs font-normal placeholder:text-white/40 outline-none focus:border-white/50 transition-all text-center text-white"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="bg-[#2a2d3d] border border-white/10 px-6 py-4 rounded-xl shadow-xl flex items-center gap-4">
                                    <Loader2 size={28} className="text-white animate-spin" />
                                    <div className="text-left">
                                        <h3 className="text-white font-bold text-base tracking-wider uppercase mb-0.5">Cargando</h3>
                                        <p className="text-white/60 text-xs font-medium uppercase tracking-widest">Espere por favor...</p>
                                    </div>
                                </div>
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-10">
                                <FileText size={40} />
                                <span className="text-[10px] font-semibold uppercase tracking-widest mt-2">Sin registros</span>
                            </div>
                        ) : (
                            <div className="max-w-6xl space-y-8">
                                {/* DINE IN SECTION */}
                                {filteredOrders.some(o => o.order_type === 'DINE_IN' || !o.order_type) && (
                                    <div>
                                        <h3 className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white mb-4 flex items-center gap-2">
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
                                        <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white mb-6 flex items-center gap-3">
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
                                        <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white mb-6 flex items-center gap-3">
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
                        <TabButton active={activeTab === 'OPEN'} onClick={() => setActiveTab('OPEN')} label="ORDENES ABIERTAS" triangleColor="border-t-yellow-500" />
                        <TabButton active={activeTab === 'CLOSED'} onClick={() => setActiveTab('CLOSED')} label="ORDENES CERRADAS" triangleColor="border-t-blue-500" />
                        <TabButton active={activeTab === 'CANCELLED'} onClick={() => setActiveTab('CANCELLED')} label="ORDENES ANULADAS" triangleColor="border-t-red-500" />
                    </div>
                </div>

                {/* Right Side: Order Detail */}
                <div className="w-[400px] flex flex-col bg-[#2d2e3d] shrink-0 h-full border-l border-[#1e1f2b]">
                    <div className="bg-[#3a3b4d] h-12 flex items-center justify-center shrink-0 border-b border-[#1e1f2b]">
                        <h2 className="text-sm font-medium text-white tracking-wide">Detalle de Orden</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                        {selectedOrder ? (
                            <div className="space-y-6">
                                {selectedOrder.orders.map((order: any, idx: number) => (
                                    <div key={order.id} className="flex flex-col">
                                        {/* Header of the account/order without container border */}
                                        <div className="mb-2 flex flex-col pl-1">
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-white">
                                                {order.customer_name || `Cuenta ${idx + 1}`}
                                            </span>
                                            <span className="text-[9px] text-gray-400 font-medium uppercase tracking-tight">
                                                Orden #{order.order_number} · {order.profiles?.name}
                                            </span>
                                        </div>

                                        {/* Items inside this order */}
                                        <div className="space-y-2">
                                            {order.order_items?.map((item: any) => (
                                                <div key={item.id} className="bg-[#343547] rounded-sm p-3 text-sm border border-white/[0.03]">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex gap-3">
                                                            <span className="font-medium text-white/50">{item.quantity}</span>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="font-medium uppercase tracking-tight leading-tight text-white/80">{item.products?.name}</span>
                                                                {(() => {
                                                                    const { mods, obs } = parseNotes(item.notes);
                                                                    const modItems = mods 
                                                                        ? mods.split(/[|,\n]/).map(m => m.trim()).filter(Boolean)
                                                                        : [];
                                                                    const obsItems = obs
                                                                        ? obs.split('\n').map(o => o.trim()).filter(Boolean)
                                                                        : [];
                                                                    const allItems = [...modItems, ...obsItems];
                                                                    
                                                                    return allItems.length > 0 ? (
                                                                        <div className="flex flex-col gap-0.5 mt-1 pl-1 text-[11px] text-gray-400 uppercase font-normal tracking-wide">
                                                                            {allItems.map((noteText, idx) => (
                                                                                <span key={idx}>- {noteText}</span>
                                                                            ))}
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                                {item.status && (
                                                                    <ItemStatusBadge item={item} serverOffset={serverOffset} tick={tick} />
                                                                )}
                                                            </div>
                                                        </div>
                                                        <span className="font-medium tabular-nums tracking-tighter shrink-0 ml-2 text-white/90">Q{((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!order.order_items || order.order_items.length === 0) && (
                                                <div className="text-center py-2 text-[10px] text-white/40 uppercase tracking-wider">
                                                    Cargando productos...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-12 opacity-50">
                                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10 ">
                                    <FileText size={48} className="text-white/30" strokeWidth={1} />
                                </div>
                                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60 text-center mb-2">SIN SELECCIÓN</h3>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest text-center">
                                    Selecciona una mesa o cuenta de la lista
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Printer Area (above the divider line) */}
                    <div className="p-3 flex justify-center shrink-0">
                        <button
                            disabled={!selectedOrder}
                            onClick={async () => {
                                if (!selectedOrder) return;
                                for (const order of selectedOrder.orders) {
                                    const computed = getComputedTotals(order);
                                    const ticketData = {
                                        orderId: order.id,
                                        orderNumber: order.order_number,
                                        orderType: order.order_type,
                                        tableNumber: order.tables?.number,
                                        tableName: order.tables?.section,
                                        waiterName: order.profiles?.name,
                                        customerName: order.customer_name || 'Cuenta 1',
                                        items: (order.order_items || []).map((i: any) => ({
                                            name: i.products?.name || 'Desconocido',
                                            quantity: i.quantity,
                                            price: i.unit_price,
                                            notes: i.notes
                                        })),
                                        subtotal: computed.subtotal,
                                        discount: computed.discount || 0,
                                        tipAmount: computed.tip || 0,
                                        total: computed.total,
                                        createdAt: order.created_at
                                    };
                                    printService.printPreAccountTicket(ticketData as any, { silent: true });
                                }
                            }}
                            className="w-[71px] h-[71px] bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white transition-all hover:bg-white/10 active:scale-95 shrink-0"
                        >
                            <Printer size={34} />
                        </button>
                    </div>

                    {/* Footer for Detail Panel */}
                    <div className="px-4 py-3 shrink-0 border-t border-white/5 flex items-center justify-center">
                        <button
                            disabled={!selectedOrder}
                            onClick={() => selectedOrder && onOpenOrder && onOpenOrder(selectedOrder.orders[0]?.id)}
                            className="w-[220px] bg-[#6366f1] hover:bg-[#5558e3] text-white h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center active:scale-[0.98]"
                        >
                            ABRIR ORDEN
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, label, triangleColor }: any) => (
    <button
        onClick={onClick}
        className={`relative px-6 py-4 bg-[#3a3b4d] border ${active ? 'border-white/20 opacity-100 ring-1 ring-white/10' : 'border-transparent opacity-60 hover:opacity-85'} rounded-[4px] text-[10px] font-semibold uppercase tracking-wider transition-all shadow-md active:scale-95 overflow-hidden`}
    >
        <span className="relative z-10">{label}</span>
        <div className={`absolute top-0 right-0 w-0 h-0 border-t-[10px] ${triangleColor} border-l-[10px] border-l-transparent pointer-events-none`} />
    </button>
);

const OrderCard = ({ order, isSelected, onClick }: any) => {
    return (
        <button
            onClick={onClick}
            className={`
                relative p-3 rounded-sm text-left border transition-all group
                ${isSelected
                    ? 'bg-white/10 border-white '
                    : 'bg-[#3a3b4d] border-transparent hover:bg-[#45465a]'
                }
            `}
        >
            <div className="flex justify-between items-start mb-1.5">
                <div className="flex items-center gap-1.5 text-white">
                    <FileText size={12} />
                    <span className="text-[11px] font-medium">
                        {order.isGroup ? `${order.orders.length} Cuentas` : `Orden ${order.orders[0]?.order_number}`}
                    </span>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-white">Q{parseFloat(order.total || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 max-w-[70%] text-white">
                    <div className="w-3.5 h-3.5 bg-white/30 rounded flex items-center justify-center shrink-0">
                        <div className="w-2 h-2 bg-white rounded-sm" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-tight truncate">
                        {order.order_type === 'DINE_IN' || !order.order_type ? (
                            (order.tables?.section || 'MESA').trim()
                        ) : order.order_type === 'TAKEOUT' ? (
                            'PARA LLEVAR'
                        ) : (
                            'DOMICILIO'
                        )}
                        {!order.isGroup && order.orders[0]?.customer_name && ` - ${order.orders[0].customer_name}`}
                    </span>
                </div>
                {(order.order_type === 'DINE_IN' || !order.order_type) && (
                    <div className="flex items-center gap-1 text-[13px] font-bold text-amber-400 shrink-0">
                        <User size={15} />
                        <span>{order.pax_count || 0}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between text-[10px] font-medium text-white">
                <div className="flex items-center gap-1.5 truncate">
                    <Clock size={11} className="shrink-0" />
                    <span>{parseDBDate(order.created_at).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
                {(order.order_type === 'DINE_IN' || !order.order_type) && (
                    <span className="text-[10px] font-bold uppercase tracking-tight text-white shrink-0">
                        MESA {order.tables?.number || '?'}
                    </span>
                )}
            </div>
            {(order.item_counts?.pending > 0 || order.item_counts?.preparing > 0 || order.item_counts?.ready > 0) && (
                <div className="mt-1.5 flex flex-col gap-0.5 border-t border-white/5 pt-1.5">
                    {order.item_counts?.pending > 0 && (
                        <span className="text-[11px] font-semibold text-gray-400">🕐 {order.item_counts.pending} en espera</span>
                    )}
                    {order.item_counts?.preparing > 0 && (
                        <span className="text-[11px] font-semibold text-amber-400">🔥 {order.item_counts.preparing} en preparación</span>
                    )}
                    {order.item_counts?.ready > 0 && (
                        <span className="text-[11px] font-semibold text-emerald-400">✅ {order.item_counts.ready} listo</span>
                    )}
                </div>
            )}
        </button>
    );
};
