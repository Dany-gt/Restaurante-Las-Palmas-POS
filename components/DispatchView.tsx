import React, { useState, useEffect } from 'react';
import { Truck, Package, Clock, Phone, MapPin, Search, CheckCircle2, Loader2, Plus, ArrowRight, User, Info, ChevronLeft, ChevronDown, Printer, X, Globe, UserPlus, UserMinus, Bike, Check } from 'lucide-react';
import { supabase } from '../supabase';
import { NewDispatchModal } from './NewDispatchModal';
import { DeliveryClientsView } from './DeliveryClientsView';
import { QuickDeliveryModal } from './QuickDeliveryModal';
import { VerifiedScooterIcon, UnverifiedScooterIcon } from './ScooterIcons';
import { printService } from '../services/PrintService';


interface Driver {
    id: string;
    name: string;
    vehicle_info?: string;
    phone?: string;
    is_active: boolean;
    is_verified?: boolean;
    google_location_link?: string;
}

interface DispatchOrder {
    id: string;
    order_type: 'TAKEOUT' | 'DELIVERY';
    status: string;
    customer_name: string;
    customer_phone: string;
    delivery_address?: string;
    total: number;
    created_at: string;
    item_count: number;
    driver_id?: string;
    driver?: Driver;
    notes?: string;
    order_number?: number;
    dispatched_at?: string;
    payment_method?: string; // Added payment_method
    platform_id?: string;
    is_platform_driver?: boolean;
}

const parseDBDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    // If it lacks a timezone indicator, treat as UTC by appending 'Z'
    const hasTZ = dateStr.endsWith('Z') || dateStr.match(/[+-]\d{2}:\d{2}$/);
    return new Date(hasTZ ? dateStr : `${dateStr}Z`);
};

const DeliveryTimer = ({ startTime }: { startTime: string }) => {
    const [elapsed, setElapsed] = useState('0m 0s');

    useEffect(() => {
        const calculateTime = () => {
            if (!startTime) return;
            const start = parseDBDate(startTime).getTime();
            const now = new Date().getTime();
            const diff = Math.max(0, now - start);

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            setElapsed(`${minutes}m ${seconds}s`);
        };

        calculateTime();
        const interval = setInterval(calculateTime, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    return <span className="text-sm font-black font-mono text-white">{elapsed}</span>;
};

const DriverLocationModal = ({ driver, onClose }: { driver: Driver, onClose: () => void }) => {
    const [location, setLocation] = useState<{ latitude: number, longitude: number, updated_at: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLocation = async () => {
            const { data } = await supabase
                .from('driver_locations')
                .select('*')
                .eq('driver_id', driver.id)
                .single();

            if (data) setLocation(data);
            setLoading(false);
        };

        fetchLocation();

        // Realtime subscription
        const sub = supabase.channel(`driver_loc_${driver.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'driver_locations',
                filter: `driver_id=eq.${driver.id}`
            }, (payload) => {
                setLocation(payload.new as any);
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'driver_locations',
                filter: `driver_id=eq.${driver.id}`
            }, (payload) => {
                setLocation(payload.new as any);
            })
            .subscribe();

        return () => { supabase.removeChannel(sub); };
    }, [driver.id]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-2xl bg-[#1e232f] rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                    <div>
                        <h3 className="text-lg font-black uppercase text-white tracking-tight">Ubicación en Tiempo Real</h3>
                        <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">{driver.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white"><X size={20} /></button>
                </div>

                <div className="flex-1 bg-black/50 h-[400px] relative flex items-center justify-center">
                    {driver.google_location_link ? (
                        <div className="text-center p-8">
                            <div className="w-20 h-20 bg-[#4285F4]/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                <MapPin size={40} className="text-[#4285F4]" />
                            </div>
                            <h4 className="text-white font-black uppercase tracking-wider text-lg mb-2">Ubicación por Google Maps</h4>
                            <p className="text-gray-400 text-xs mb-8 max-w-xs mx-auto">Este motorista comparte su ubicación mediante enlace directo.</p>

                            <a
                                href={driver.google_location_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-8 py-4 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-900/20 transition-all hover:scale-105 flex items-center justify-center gap-3"
                            >
                                <MapPin size={18} /> Ver Ubicación en Tiempo Real
                            </a>
                        </div>
                    ) : loading ? (
                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                    ) : location ? (
                        <div className="w-full h-full relative">
                            <iframe
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                style={{ border: 0 }}
                                src={`https://maps.google.com/maps?q=${location.latitude},${location.longitude}&z=15&output=embed`}
                                allowFullScreen
                            ></iframe>
                            <div className="absolute bottom-4 left-4 bg-[#1e232f] p-3 rounded-xl border border-white/10 shadow-xl max-w-xs">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Señal Recibida</span>
                                </div>
                                <p className="text-[10px] text-gray-400">Hace {Math.floor((new Date().getTime() - new Date(location.updated_at).getTime()) / 1000 / 60)} min</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-8">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MapPin size={32} className="text-gray-600" />
                            </div>
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Ubicación no disponible</p>
                            <p className="text-gray-600 text-[10px] mt-2 max-w-xs mx-auto">El motorista no ha iniciado sesión en el rastreador o no tiene señal GPS.</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-[#1e232f] border-t border-white/5 flex justify-end">
                    {location && !driver.google_location_link && (
                        <a
                            href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center gap-2"
                        >
                            <MapPin size={14} /> Abrir en Google Maps Externo
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

export const DispatchView: React.FC<{
    type: 'TAKEOUT' | 'DELIVERY',
    onCreateOrder: (customer: any) => void,
    onEditOrder?: (orderId: string) => void,
    onBack?: () => void,
    initialMode?: 'NEW' | 'LIST',
    currentUser?: any
}> = ({ type, onCreateOrder, onEditOrder, onBack, initialMode, currentUser }) => {

    const [orders, setOrders] = useState<DispatchOrder[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewModal, setShowNewModal] = useState(false);
    const [showQuickModal, setShowQuickModal] = useState(false);
    const [viewingDriver, setViewingDriver] = useState<Driver | null>(null);
    const [platforms, setPlatforms] = useState<any[]>([]);
    const [showDriverModal, setShowDriverModal] = useState(false);

    const [serverOffset, setServerOffset] = useState<number>(() => {
        const cached = localStorage.getItem('kds_server_offset');
        return cached ? parseInt(cached, 10) : 0;
    });

    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        if (showSuccessToast) {
            const timer = setTimeout(() => setShowSuccessToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showSuccessToast]);

    const [tick, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const nowServer = new Date(Date.now() + serverOffset);
    const timeDisplay = nowServer.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateDisplay = nowServer.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');


    // NEW: Side Panel State
    const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
    const [orderItems, setOrderItems] = useState<any[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    useEffect(() => {
        if (selectedOrder) {
            const fetchItems = async () => {
                setLoadingItems(true);
                const { data } = await supabase
                    .from('order_items')
                    .select('*, products(name)')
                    .eq('order_id', selectedOrder.id);
                setOrderItems(data || []);
                setLoadingItems(false);
            };
            fetchItems();
        } else {
            setOrderItems([]);
        }
    }, [selectedOrder?.id]);

    // For DELIVERY with initialMode NEW, show quick modal immediately
    const [showClientSelector, setShowClientSelector] = useState(false);

    // Effect to auto-open client selector when entering DELIVERY with NEW mode
    useEffect(() => {
        if (type === 'DELIVERY' && initialMode === 'NEW') {
            setShowClientSelector(true);
        }
    }, [initialMode, type]);

    // Fetch drivers for delivery orders
    const fetchDrivers = async () => {
        if (type !== 'DELIVERY') return;
        const { data } = await supabase
            .from('delivery_drivers')
            .select('*')
            .eq('is_active', true)
            .order('name');
        setDrivers(data || []);
    };

    const fetchDispatchOrders = async () => {
        try {
            console.log(`Fetching ${type} orders...`);
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    order_type,
                    status,
                    customer_name,
                    customer_phone,
                    delivery_address,
                    total,
                    created_at,
                    driver_id,
                    order_number,
                    dispatched_at,
                    payment_method,
                    platform_id,
                    is_platform_driver
                `)
                .eq('order_type', type)
                .not('status', 'eq', 'completed')
                .not('status', 'eq', 'cancelled')
                .order('created_at', { ascending: false });

            if (error) {
                console.error(`Error fetching ${type} dispatch: `, error);
                setError(error.message);
                return;
            }

            setOrders(data || []);
        } catch (e) {
            console.error('Unexpected error in DispatchView:', e);
        } finally {
            setLoading(false);
        }
    };

    // Assign driver to order
    const assignDriver = async (orderId: string, driverId: string | null) => {
        // Optimistic Update
        setOrders(prev => prev.map(o =>
            o.id === orderId ? { ...o, driver_id: driverId } : o
        ));

        // Also update selectedOrder if it's the one being modified
        if (selectedOrder?.id === orderId) {
            setSelectedOrder(prev => prev ? { ...prev, driver_id: driverId } : null);
        }

        const { error } = await supabase
            .from('orders')
            .update({ driver_id: driverId || null }) // Ensure null if empty string
            .eq('id', orderId);

        if (error) {
            console.error('Error assigning driver:', error);
            // Revert changes if error
            alert('Error al asignar motorista: ' + error.message);
            fetchDispatchOrders();
        } else {
            // Success
            setToastMessage('Repartidor asignado correctamente.');
            setShowSuccessToast(true);
            fetchDispatchOrders();
        }
    };

    const handlePrintAccount = async (order: DispatchOrder) => {
        try {
            const { data: items } = await supabase
                .from('order_items')
                .select('*, products(name)')
                .eq('order_id', order.id);

            if (!items) return;

            // Resolve driver name if driver_id exists but driver object might be missing from partial fetch?
            // The fetchDispatchOrders selects driver_id but not the joined driver object? 
            // Wait, fetchDispatchOrders DOES NOT select driver join in the current code! 
            // It only selects `driver_id`.
            // However, we have a `drivers` state array. We can find the driver there.

            const assignedDriver = drivers.find(d => d.id === order.driver_id);

            await printService.printPreAccountTicket({
                orderId: order.id,
                orderNumber: order.order_number,
                orderType: order.order_type === 'DELIVERY' ? 'DELIVERY' : 'TAKE_AWAY',
                customerName: order.customer_name,
                customerPhone: order.customer_phone,
                deliveryAddress: order.delivery_address,
                driverName: assignedDriver?.name,
                createdAt: order.created_at,
                items: items.map(i => ({
                    name: i.products?.name || 'Producto',
                    quantity: i.quantity,
                    price: i.unit_price,
                    notes: i.notes
                })),
                subtotal: order.total,
                total: order.total, // Assuming total includes tip/tax for now in this view
                paymentMethod: order.payment_method // Added
            });
        } catch (e) { console.error(e); }
    };

    const handlePrintDriverTicket = async (order: DispatchOrder) => {
        try {
            const { data: items } = await supabase
                .from('order_items')
                .select('*, products(name)')
                .eq('order_id', order.id);

            if (!items) return;

            const assignedDriver = drivers.find(d => d.id === order.driver_id);

            await printService.printDeliveryTicket({
                orderId: order.id,
                orderNumber: order.order_number,
                createdAt: order.created_at,
                customerName: order.customer_name,
                customerPhone: order.customer_phone,
                deliveryAddress: order.delivery_address || 'RECOGE EN TIENDA',
                driverName: assignedDriver?.name,
                total: order.total,
                notes: order.notes,
                paymentMethod: order.payment_method, // Added
                items: items.map(i => ({
                    name: i.products?.name || 'Producto',
                    quantity: i.quantity,
                    price: i.unit_price,
                    notes: i.notes
                }))
            });
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        const fetchAll = async () => {
            await Promise.all([
                fetchDispatchOrders(),
                fetchDrivers(),
                supabase.from('order_platforms').select('*').then(({ data }) => setPlatforms(data || []))
            ]);
        };
        fetchAll();

        const sub = supabase.channel(`dispatch_${type}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `order_type=eq.${type}` }, () => fetchDispatchOrders())
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [type]);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'ready': return 'text-emerald-400';
            case 'preparing': return 'text-amber-400';
            case 'delivering': return 'text-indigo-400';
            default: return 'text-gray-400';
        }
    };

    const handleClientSelected = (customer: any, address: any) => {
        setShowClientSelector(false);
        // Map data for order creation
        onCreateOrder({
            name: customer.name,
            phone: customer.phone,
            address: address ? address.address : '',
            // Map other fields from customer if available in DB
            customer_id: customer.id,
            platform_id: undefined, // Default for direct client selection
            is_platform_driver: false,
            type: type
        });
    };


    const filteredOrders = orders.filter(o => {
        const name = (o.customer_name || '').toLowerCase();
        const phone = (o.customer_phone || '');
        const search = searchTerm.toLowerCase();
        return name.includes(search) || phone.includes(search);
    });

    if (showClientSelector) {
        return (
            <DeliveryClientsView
                onBack={() => {
                    if (initialMode === 'NEW' && onBack) {
                        onBack();
                    } else {
                        setShowClientSelector(false);
                    }
                }}
                onSelectCustomer={handleClientSelected}
                currentUser={currentUser}
            />
        );
    }

    if (loading) return (
        <div className="h-full flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        </div>
    );

    return (
        <div className="h-full flex flex-col animate-fade-in relative bg-[#2d2e3d]">
            {viewingDriver && (
                <DriverLocationModal driver={viewingDriver} onClose={() => setViewingDriver(null)} />
            )}

            {/* Header Rediseñado - Más Compacto */}
            <div className="h-16 px-6 border-b border-white/5 flex justify-between items-center bg-black/20 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="p-2 -ml-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <div className={`p-2 rounded-xl ${type === 'DELIVERY' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {type === 'DELIVERY' ? <Truck size={20} strokeWidth={2.5} /> : <Package size={20} strokeWidth={2.5} />}
                    </div>
                    <div>
                        <h2 className="text-base font-black tracking-tight uppercase text-white leading-none">
                            {type === 'DELIVERY' ? 'Domicilio' : 'Para Llevar'}
                        </h2>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mt-0.5">Gestión de Despacho</p>
                    </div>
                </div>

                {/* Buscador Central */}
                <div className="hidden lg:flex items-center flex-1 max-w-md mx-8">
                    <div className="relative w-full">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar por cliente o teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/20 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-[11px] font-bold text-white focus:outline-none focus:border-indigo-500/30 transition-all placeholder:text-gray-600"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">

                    {/* Clock & Date Header Right */}
                    <div className="hidden md:flex flex-col items-end leading-none bg-black/40 px-3 py-1.5 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-[13px] font-black tracking-widest text-indigo-400 tabular-nums">{timeDisplay}</span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter mt-0.5">{dateDisplay}</span>
                    </div>
                </div>

            </div>

            {error && (
                <div className="mx-8 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 flex items-center gap-3 animate-fade-in">
                    <Info size={20} />
                    <p className="text-sm font-bold">{error}</p>
                </div>
            )}

            <NewDispatchModal
                isOpen={showNewModal}
                onClose={() => setShowNewModal(false)}
                type={type}
                onConfirm={(data) => {
                    setShowNewModal(false);
                    onCreateOrder(data);
                }}
            />

            <QuickDeliveryModal
                isOpen={showQuickModal}
                onClose={() => {
                    setShowQuickModal(false);
                    if (initialMode === 'NEW') onBack?.();
                }}
                type={type}
                onConfirm={(data) => {
                    setShowQuickModal(false);
                    onCreateOrder(data);
                }}
            />

            {showClientSelector && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8 animate-fade-in">
                    <div className="w-full max-w-7xl h-full max-h-[90vh] rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 relative">
                        <DeliveryClientsView
                            onBack={() => {
                                if (initialMode === 'LIST') {
                                    setShowClientSelector(false);
                                } else {
                                    onBack?.();
                                }
                            }}
                            onSelectCustomer={handleClientSelected}
                            currentUser={currentUser}
                        />
                    </div>
                </div>
            )}

            {/* Content Area with Side Panel Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Main Grid Grouped by Driver */}
                <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10">
                    {/* Unique drivers in current orders */}
                    {[...new Set(orders.map(o => o.driver_id))].map(driverId => {
                        const driverOrders = filteredOrders.filter(o => o.driver_id === driverId);
                        if (driverOrders.length === 0) return null;
                        const driverName = driverId ? (drivers.find(d => d.id === driverId)?.name || 'MOTORISTA') : 'SIN ASIGNAR';

                        return (
                            <div key={driverId || 'unassigned'} className="mb-12">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-8 flex flex-col items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${driverId ? 'bg-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-rose-500 shadow-lg shadow-rose-500/50'}`} />
                                    <div className="flex items-center gap-2">
                                        <span className="text-white/60">{driverName}</span>
                                        <span className="bg-white/5 px-2 py-0.5 rounded text-[8px] border border-white/5 font-bold tracking-normal">{driverOrders.length}</span>
                                    </div>
                                </h3>
                                <div className="flex flex-wrap justify-center gap-6">
                                    {driverOrders.map(order => (
                                        <div
                                            key={order.id}
                                            onClick={() => setSelectedOrder(order)}
                                            className={`group w-full sm:w-[310px] transition-all duration-300 flex flex-col relative cursor-pointer ${selectedOrder?.id === order.id ? 'bg-[#4a4b5d] z-10' : 'bg-[#3a3b4d] hover:bg-[#45465a]'}`}
                                        >


                                            <div className="p-2.5 flex flex-col h-full">
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <div className="flex items-center gap-1.5 text-gray-400">
                                                        <Clock size={14} />
                                                        <span className="text-[12px] font-bold tabular-nums">
                                                            {parseDBDate(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    {order.order_number && (
                                                        <span className="text-[11px] font-black text-indigo-400 px-1 uppercase tracking-widest">
                                                            ORDEN {order.order_number}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="mb-2 px-1">
                                                    <div className="flex justify-between items-baseline gap-2">
                                                        <h4 className="text-white text-[11px] font-black leading-tight truncate uppercase flex-1">
                                                            {order.customer_name || 'Cliente'}
                                                        </h4>
                                                        <div className="flex items-center gap-1.5 text-indigo-400 shrink-0">
                                                            <Phone size={12} strokeWidth={3} />
                                                            <span className="text-[12px] font-mono font-black tracking-tighter tabular-nums">{order.customer_phone || '--- ---'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {type === 'DELIVERY' && order.delivery_address && (
                                                    <div className="mb-1.5 flex gap-1.5 px-1">
                                                        <MapPin size={10} className="text-rose-500 min-w-[10px] mt-0.5" />
                                                        <p className="text-[8px] text-gray-400 font-bold leading-snug line-clamp-2">
                                                            {order.delivery_address}
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="mt-auto flex flex-col gap-2 pt-2">
                                                    {order.status === 'delivering' && order.dispatched_at && (
                                                        <div className="flex items-center justify-between gap-2 mb-1 px-1">
                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                                                <DeliveryTimer startTime={order.dispatched_at} />
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const drv = drivers.find(d => d.id === order.driver_id);
                                                                    if (drv) setViewingDriver(drv);
                                                                }}
                                                                className="px-2 py-1 text-[7px] font-black text-white/70 hover:text-white uppercase flex items-center gap-1 transition-all"
                                                            >
                                                                <MapPin size={8} /> Rastrear
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${getStatusStyle(order.status)}`}>
                                                            {order.status === 'ready' ? 'Listo' : order.status === 'preparing' ? 'Cocina' : order.status === 'delivering' ? 'En Ruta' : 'Espera'}
                                                        </span>
                                                        <div className="text-right">
                                                            <p className="text-[11px] font-black text-white mix-blend-plus-lighter">Q{order.total.toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {!error && orders.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-20 select-none">
                            {type === 'DELIVERY' ? <Truck size={80} strokeWidth={1} /> : <Package size={80} strokeWidth={1} />}
                            <p className="mt-4 font-black uppercase tracking-[0.2em] text-sm">No hay pedidos pendientes</p>
                        </div>
                    )}
                </div>

                {/* Fixed Right Side Panel */}
                <div className="w-[380px] bg-[#3a3b4d] border-l border-white/10 flex flex-col shadow-2xl overflow-hidden">
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {selectedOrder ? (
                            <>
                                <div className="p-6 border-b border-white/5 bg-black/10">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">Orden #{selectedOrder.order_number || '---'}</p>
                                            <h3 className="text-xl font-black text-white leading-tight break-words">{selectedOrder.customer_name || 'Sin Nombre'}</h3>
                                        </div>
                                    </div>
                                    {type === 'DELIVERY' && selectedOrder.delivery_address && (
                                        <div className="flex gap-2 text-gray-400 text-xs bg-white/5 p-3 rounded-xl border border-white/5 mb-2">
                                            <MapPin size={14} className="shrink-0 text-rose-500" />
                                            <p className="line-clamp-2">{selectedOrder.delivery_address}</p>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 text-gray-400 bg-black/20 px-2 py-1 rounded-lg">
                                            <Clock size={12} />
                                            <span className="text-[10px] font-bold">
                                                {parseDBDate(selectedOrder.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${getStatusStyle(selectedOrder.status)}`}>
                                            {selectedOrder.status === 'ready' ? 'Listo' : selectedOrder.status === 'preparing' ? 'Cocinando' : 'Pendiente'}
                                        </span>
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                                        <span className="w-1 h-1 bg-indigo-500 rounded-full" /> Detalle de Productos
                                    </h4>
                                    {loadingItems ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 italic text-xs">
                                            <Loader2 className="animate-spin text-indigo-500 mb-2" size={24} />
                                            Cargando contenido...
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="space-y-3">
                                                {orderItems.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-start text-sm group">
                                                        <div className="flex gap-3">
                                                            <span className="font-black text-indigo-400 min-w-[24px]">x{item.quantity}</span>
                                                            <div className="flex flex-col">
                                                                <span className="text-gray-200 font-semibold group-hover:text-white transition-colors">{item.products?.name}</span>
                                                                {item.notes && <span className="text-[10px] text-gray-500 italic mt-0.5">{item.notes}</span>}
                                                            </div>
                                                        </div>
                                                        <span className="font-bold text-white tabular-nums">Q{(item.quantity * item.unit_price).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="pt-6 mt-6 border-t border-white/5 space-y-2">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Monto Final</span>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-xl font-black text-indigo-400">Q</span>
                                                        <span className="text-3xl font-black text-white tracking-tighter">{selectedOrder.total.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                {selectedOrder.payment_method && (
                                                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg mt-2">
                                                        <p className="text-[8px] font-black uppercase text-emerald-500 tracking-widest mb-0.5">Método de Pago</p>
                                                        <p className="text-white text-[10px] font-bold">{selectedOrder.payment_method}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-20 p-8 text-center select-none overflow-hidden">
                                <Info size={48} className="mb-4" />
                                <p className="text-sm font-black uppercase tracking-widest leading-tight">Sin pedido seleccionado</p>
                                <p className="text-[10px] font-bold mt-2 uppercase">Toca una orden a la izquierda</p>
                            </div>
                        )}
                    </div>

                    {/* Persistent Action Buttons */}
                    <div className="p-4 bg-[#3a3b4d]/50 border-t border-white/5 flex flex-col gap-3">
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (!selectedOrder) {
                                        setToastMessage('Elija una orden primero');
                                        setShowSuccessToast(true);
                                        return;
                                    }
                                    setShowDriverModal(true);
                                }}
                                className="flex-1 flex items-center justify-center h-14 rounded-xl bg-[#3a3b4d] text-white border border-white/5 hover:bg-[#4a4b5d] transition-all group shadow-sm"
                            >
                                <div className="group-hover:scale-110 transition-transform text-white/90">
                                    <VerifiedScooterIcon size={34} />
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    if (!selectedOrder) {
                                        setToastMessage('Elija una orden primero');
                                        setShowSuccessToast(true);
                                        return;
                                    }
                                    assignDriver(selectedOrder.id, null);
                                }}
                                className="flex-1 flex items-center justify-center h-14 rounded-xl bg-[#3a3b4d] text-white border border-white/5 hover:bg-[#4a4b5d] transition-all group relative shadow-sm"
                            >
                                <div className="group-hover:scale-110 transition-transform text-white/90">
                                    <UnverifiedScooterIcon size={34} />
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    if (!selectedOrder) {
                                        setToastMessage('Elija una orden primero');
                                        setShowSuccessToast(true);
                                        return;
                                    }
                                    handlePrintDriverTicket(selectedOrder);
                                }}
                                className="flex-1 flex items-center justify-center h-14 rounded-xl bg-[#3a3b4d] text-white border border-white/5 hover:bg-[#4a4b5d] transition-all group shadow-sm"
                            >
                                <div className="group-hover:scale-110 transition-transform">
                                    <Printer size={28} className="text-white/90" />
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                if (!selectedOrder) {
                                    setToastMessage('Elija una orden primero');
                                    setShowSuccessToast(true);
                                    return;
                                }
                                if (!selectedOrder.dispatched_at && selectedOrder.driver_id) {
                                    const markAsDispatched = async () => {
                                        try {
                                            const { error } = await supabase.from('orders').update({
                                                status: 'delivering',
                                                dispatched_at: new Date().toISOString()
                                            }).eq('id', selectedOrder.id);
                                            if (error) throw error;
                                            fetchDispatchOrders();
                                            setSelectedOrder(prev => prev ? { ...prev, status: 'delivering', dispatched_at: new Date().toISOString() } : null);
                                        } catch (error: any) {
                                            console.error('Error dispatching:', error);
                                            alert('Error al guardar estado de despacho.\n' + error.message);
                                        }
                                    };
                                    markAsDispatched();
                                } else {
                                    onEditOrder?.(selectedOrder.id);
                                }
                            }}
                            className="w-full flex items-center justify-center h-12 rounded-xl bg-[#6366f1] text-white shadow-lg shadow-indigo-500/20 hover:bg-[#5558e3] transition-all font-sans"
                        >
                            {(!selectedOrder?.dispatched_at && selectedOrder?.driver_id) ? (
                                <div className="flex items-center gap-2">
                                    <Truck size={18} strokeWidth={2.5} className="animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">DESPACHAR AHORA</span>
                                </div>
                            ) : (
                                <span className="text-[10px] font-black uppercase tracking-widest">ABRIR ORDEN</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            <DriverSelectorModal
                isOpen={showDriverModal}
                onClose={() => setShowDriverModal(false)}
                drivers={drivers}
                selectedDriverId={selectedOrder?.driver_id}
                onSelect={(driverId: string | null) => {
                    if (selectedOrder) {
                        assignDriver(selectedOrder.id, driverId);
                    }
                    setShowDriverModal(false);
                }}
            />

            {/* Success Toast */}
            {showSuccessToast && (
                <div className="fixed top-12 right-4 z-[999999] animate-in slide-in-from-right fade-in duration-300">
                    <div className="bg-white rounded-xl shadow-2xl border border-white/10 p-4 flex items-center gap-4 min-w-[320px] backdrop-blur-md">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <Check size={20} className="text-emerald-500" strokeWidth={3} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[#1e232f] text-[11px] font-bold leading-tight">
                                {toastMessage}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowSuccessToast(false)}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const DriverSelectorModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    onSelect: (driverId: string | null) => void,
    drivers: any[],
    selectedDriverId: string | null
}> = ({ isOpen, onClose, onSelect, drivers, selectedDriverId }) => {
    const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedDriverId);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
            <div className="bg-[#2a2b3d] w-full max-w-2xl rounded-lg shadow-2xl border border-white/10 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-white/5 flex flex-col items-center justify-center">
                    <h2 className="text-white text-[12px] font-black uppercase tracking-[0.2em]">Repartidores</h2>
                </div>

                <div className="p-8">
                    <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {drivers.map((driver) => (
                            <button
                                key={driver.id}
                                onClick={() => setLocalSelectedId(driver.id)}
                                className={`h-16 rounded-xl flex items-center gap-3 px-4 transition-all border ${localSelectedId === driver.id
                                    ? 'bg-[#6366f1] border-indigo-400 text-white shadow-lg shadow-indigo-500/20'
                                    : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                                    }`}
                            >
                                <div className={`w-14 h-14 rounded-lg flex items-center justify-center shrink-0 ${localSelectedId === driver.id ? 'bg-white/10' : 'bg-white/5'}`}>
                                    {driver.is_verified !== false ? (
                                        <VerifiedScooterIcon size={48} />
                                    ) : (
                                        <UnverifiedScooterIcon size={48} />
                                    )}
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-wider text-left leading-tight ${localSelectedId === driver.id ? 'opacity-100' : 'opacity-70'}`}>
                                    {driver.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-8 pt-2 flex items-center justify-center gap-4">
                    <button
                        onClick={onClose}
                        className="px-10 py-3 rounded border border-white/20 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onSelect(localSelectedId)}
                        className="px-10 py-3 rounded bg-[#6366f1] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#5558e3] transition-all shadow-lg"
                    >
                        Aceptar
                    </button>
                </div>
            </div>
        </div>
    );
};
