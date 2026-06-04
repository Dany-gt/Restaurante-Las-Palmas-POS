import React, { useState, useEffect } from 'react';
import { Search, User, Phone, MapPin, MapPinPlus, MapPinPen, MapPinOff, Plus, ArrowLeft, ArrowRight, UserPlus, Edit2, Trash2, Map, Users, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../supabase';
import { CustomerModal } from './CustomerModal';
import { AddressModal } from './AddressModal';

interface Customer {
    id: string;
    name: string;
    phone: string;
    nit?: string;
}

interface Address {
    id: string;
    customer_id: string;
    name: string; // 'Casa', 'Oficina'
    address: string;
    zone?: string;
    reference?: string;
}

interface DeliveryClientsViewProps {
    onBack: () => void;
    onSelectCustomer: (customer: Customer, address: Address | null) => void;
    currentUser?: any;
}

export const DeliveryClientsView: React.FC<DeliveryClientsViewProps> = ({ onBack, onSelectCustomer, currentUser }) => {
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

    const [assignedOrdersCount, setAssignedOrdersCount] = useState<number>(0);

    useEffect(() => {
        if (!currentUser?.id) return;
        const fetchOrdersCount = async () => {
            const { count } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('waiter_id', currentUser.id)
                .in('status', ['pending', 'in_progress', 'ready', 'delivering']);
            if (count !== null) setAssignedOrdersCount(count);
        };
        fetchOrdersCount();
        const sub = supabase.channel('assigned_orders_delivery')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `waiter_id=eq.${currentUser.id}` }, fetchOrdersCount)
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [currentUser]);

    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);

    // Confirmation Modals
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);

    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl + Enter -> New Customer Modal
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                handleNewCustomer();
            } else if (e.key === 'Enter' && !e.ctrlKey) {
                // If not already focused in search input, focus it
                if (document.activeElement !== searchInputRef.current) {
                    e.preventDefault();
                    searchInputRef.current?.focus();
                    searchInputRef.current?.select();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        if (selectedCustomer) {
            fetchAddresses(selectedCustomer.id);
            setSelectedAddress(null);
        } else {
            setAddresses([]);
        }
    }, [selectedCustomer]);

    const fetchCustomers = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('customers').select('*').order('name');
        if (!error && data) setCustomers(data);
        setLoading(false);
    };

    const fetchAddresses = async (customerId: string) => {
        const { data, error } = await supabase
            .from('customer_addresses')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });
        if (!error && data) setAddresses(data);
        if (data && data.length > 0) setSelectedAddress(data[0]);
    };

    const handleCreateOrder = () => {
        if (!selectedCustomer) {
            setToastMessage('Elija un cliente por favor.');
            return;
        }
        onSelectCustomer(selectedCustomer, selectedAddress);
    };

    // --- CLIENT HANDLERS ---
    const handleNewCustomer = () => {
        setEditingCustomer(null);
        setShowCustomerModal(true);
    };

    const handleEditCustomer = () => {
        if (!selectedCustomer) {
            setToastMessage('Elija un cliente por favor.');
            return;
        }
        setEditingCustomer(selectedCustomer);
        setShowCustomerModal(true);
    };

    const handleDeleteCustomerBtnClick = () => {
        if (!selectedCustomer) {
            setToastMessage('Elija un cliente por favor.');
            return;
        }
        setCustomerToDelete(selectedCustomer);
    };

    const confirmDeleteCustomer = async () => {
        if (!customerToDelete) return;

        const { error } = await supabase.from('customers').delete().eq('id', customerToDelete.id);
        if (error) {
            alert('Error al eliminar: ' + error.message);
        } else {
            setSelectedCustomer(null);
            fetchCustomers();
        }
        setCustomerToDelete(null);
    };

    // --- ADDRESS HANDLERS ---
    const handleNewAddress = () => {
        if (!selectedCustomer) {
            setToastMessage('Elija un cliente por favor.');
            return;
        }
        setEditingAddress(null);
        setShowAddressModal(true);
    };

    const handleEditAddress = () => {
        if (!selectedAddress) {
            setToastMessage('Elija una dirección por favor.');
            return;
        }
        setEditingAddress(selectedAddress);
        setShowAddressModal(true);
    };

    const handleDeleteAddressBtnClick = () => {
        if (!selectedAddress) {
            setToastMessage('Elija una dirección por favor.');
            return;
        }
        setAddressToDelete(selectedAddress);
    };

    const confirmDeleteAddress = async () => {
        if (!addressToDelete) return;

        const { error } = await supabase.from('customer_addresses').delete().eq('id', addressToDelete.id);
        if (error) {
            alert('Error al eliminar address: ' + error.message);
        } else {
            if (selectedCustomer) fetchAddresses(selectedCustomer.id);
            setSelectedAddress(null);
        }
        setAddressToDelete(null);
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm))
    );

    return (
        <div className="absolute inset-0 z-10 flex flex-col font-sans animate-fade-in bg-[#2d2e3d]">
            {/* Top Bar matching reference */}
            <div className="h-16 px-6 border-b border-white/5 flex justify-between items-center bg-black/20 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="h-14 w-14 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0">
                        <ArrowLeft size={28} strokeWidth={2.5} />
                    </button>
                    <div className="ml-1 flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none mb-1">RESTAURANTE</span>
                        <span className="text-[12px] font-bold text-gray-500 uppercase tracking-widest leading-none">LAS PALMAS</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Clock & Date Bar */}
                    <div className="hidden lg:flex flex-col items-end leading-none bg-black/30 px-3 py-1.5 rounded-xl border border-white/5">
                        <span className="text-[12px] font-semibold tracking-widest text-indigo-400 tabular-nums">{timeDisplay}</span>
                        <span className="text-[9px] font-medium text-gray-500 uppercase tracking-tighter mt-0.5">{dateDisplay}</span>
                    </div>

                    {/* Assigned Orders Counter Pill */}
                    <div className="hidden lg:flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded border border-white/5">
                        <span className="text-sm font-bold text-white leading-none">{assignedOrdersCount}</span>
                        <span className="text-xs font-medium text-gray-300 leading-none">Ordenes Asignadas</span>
                    </div>

                    {/* User Profile */}
                    <div className="hidden md:flex flex-col items-end leading-none">
                        <span className="text-[11px] font-bold text-white uppercase tracking-wide">{currentUser?.name || (currentUser as any)?.full_name}</span>
                        <span className="text-[10px] font-medium text-emerald-400 mt-1">Clientes a Domicilio</span>
                    </div>
                </div>
            </div>


            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* LEFT PANEL: CLIENTS GRID */}
                <div className="flex-1 flex flex-col border-r border-white/5 bg-[#2d2e3d] min-h-0">                    {/* Header 'Clientes' */}
                    <div className="bg-[#3a3b4d] h-10 flex items-center justify-center shrink-0 ">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white">Clientes</span>
                    </div>

                    {/* Search Bar */}
                    <div className="p-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70" size={16} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="BUSCAR..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-transparent border border-white/20 rounded-sm py-2.5 pl-10 pr-3 text-[11px] font-semibold placeholder:text-white/60 outline-none focus:border-white/50 focus:bg-transparent transition-all uppercase tracking-widest text-white "
                            />
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-4 content-start min-h-0 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <div className="grid grid-cols-4 gap-3 w-fit mx-auto">
                            {filteredCustomers.slice(0, 28).map(customer => (
                                <button
                                    key={customer.id}
                                    onClick={() => setSelectedCustomer(customer)}
                                    className={`
                                        w-[278px] h-20 rounded-lg flex flex-col justify-center px-4 relative group text-left border
                                        ${selectedCustomer?.id === customer.id
                                            ? 'bg-[#7c71e2] border-transparent'
                                            : 'bg-[#3a3b4d] border-transparent hover:bg-[#45465a]'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <User size={14} className="text-white" fill="white" />
                                        <span className="text-[12px] font-semibold truncate text-white">
                                            {customer.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone size={14} className="text-white" fill="white" />
                                        <span className="text-[11px] font-medium text-white">
                                            {customer.phone || 'Sin Teléfono'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Action Buttons (Left) */}
                    <div className="p-4 border-t border-white/5 bg-transparent shrink-0 flex flex-col gap-4 z-10">
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={handleNewCustomer}
                                className="w-[71px] h-[71px] border border-white/30 rounded-xl text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                                title="Nuevo Cliente"
                            >
                                <div className="relative w-[32px] h-[26px]">
                                    <User size={26} strokeWidth={1.5} className="absolute left-0 top-0" />
                                    <Plus size={16} strokeWidth={2} className="absolute -bottom-1 -right-1" />
                                </div>
                            </button>
                            <button
                                onClick={handleEditCustomer}
                                className="w-[71px] h-[71px] border border-white/30 rounded-xl text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                                title="Editar Cliente"
                            >
                                <div className="relative w-[32px] h-[26px]">
                                    <User size={26} strokeWidth={1.5} className="absolute left-0 top-0" />
                                    <Edit2 size={14} strokeWidth={2} className="absolute -bottom-1 -right-1" />
                                </div>
                            </button>
                            <button
                                onClick={handleDeleteCustomerBtnClick}
                                className="w-[71px] h-[71px] border border-white/30 rounded-xl text-white hover:bg-red-500/20 hover:text-red-500 transition-colors flex items-center justify-center"
                                title="Eliminar Cliente"
                            >
                                <div className="relative w-[32px] h-[26px] flex items-center justify-center">
                                    <User size={26} strokeWidth={1.5} />
                                    <div className="absolute w-[30px] h-[1.5px] bg-current -rotate-45" />
                                </div>
                            </button>
                        </div>
                        <div className="h-[46px] flex items-center justify-start px-2">
                            <div className="flex gap-4 text-[8px] text-white/70 uppercase font-semibold tracking-widest">
                                <span>1. ENTER - BUSCAR</span>
                                <span>2. Ctrl+Enter - NUEVO</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MODAL CONFIGURATION */}
                <CustomerModal
                    isOpen={showCustomerModal}
                    onClose={() => setShowCustomerModal(false)}
                    onSuccess={() => { fetchCustomers(); /* if edited, refresh */ }}
                    customerToEdit={editingCustomer}
                />

                {selectedCustomer && (
                    <AddressModal
                        isOpen={showAddressModal}
                        onClose={() => setShowAddressModal(false)}
                        onSuccess={() => fetchAddresses(selectedCustomer.id)}
                        customerId={selectedCustomer.id}
                        customerName={selectedCustomer.name}
                        addressToEdit={editingAddress}
                    />
                )}


                {/* RIGHT PANEL: ADDRESSES & DETAILS */}
                <div className="w-[400px] bg-[#2d2e3d] flex flex-col shrink-0 border-l border-white/5 min-h-0">
                    <div className="bg-[#3a3b4d] h-10 flex items-center justify-center shrink-0 border-b border-white/5">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
                            Direcciones
                        </span>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto space-y-4 min-h-0 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {selectedCustomer ? (
                            addresses.length > 0 ? (
                                addresses.map(addr => (
                                    <button
                                        key={addr.id}
                                        onClick={() => setSelectedAddress(addr)}
                                        className={`w-full p-4 rounded-xl border text-left relative group ${selectedAddress?.id === addr.id
                                            ? 'bg-[#5c5d73] border-transparent text-white'
                                            : 'bg-[#3a3b4d] border-transparent hover:bg-[#45465a] text-white'
                                            }`}
                                    >
                                        <div className="flex flex-col gap-1 text-left">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-[11px] font-semibold flex items-center gap-2 text-white`}>
                                                    <MapPin size={12} className={selectedAddress?.id === addr.id ? 'text-white' : 'text-white/70'} />
                                                    {addr.name || 'Dirección'}
                                                </span>
                                            </div>
                                            <p className={`text-[12px] font-medium leading-normal text-white`}>
                                                {addr.address}
                                            </p>
                                            {addr.reference && (
                                                <p className={`text-[11px] font-normal mt-1 leading-normal ${selectedAddress?.id === addr.id ? 'text-white/90' : 'text-white/60'}`}>
                                                    {addr.reference}
                                                </p>
                                            )}
                                            {addr.zone && (
                                                <span className={`inline-block w-fit mt-2 px-2 py-0.5 rounded text-[9px] font-semibold uppercase bg-black/20 text-white`}>
                                                    Zona {addr.zone}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-40 text-white/50">
                                    <Map size={48} strokeWidth={1} className="text-white/40" />
                                    <span className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-white">Sin direcciones registradas</span>
                                </div>
                            )
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/10 ">
                                    <User size={56} className="text-white/60" strokeWidth={1} />
                                </div>
                                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white mb-2 whitespace-nowrap">Seleccione un Cliente</h3>
                                <p className="text-[9px] font-medium text-white/70 uppercase tracking-widest leading-relaxed">
                                    Para ver su información y direcciones de envío
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Bottom Actions (Right) */}
                    <div className="p-4 border-t border-white/5 bg-transparent shrink-0 flex flex-col gap-4 z-10">
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={handleNewAddress}
                                className="w-[71px] h-[71px] border border-white/30 rounded-xl text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                                title="Nueva Dirección"
                            >
                                <div className="relative w-[32px] h-[26px]">
                                    <MapPin size={26} strokeWidth={1.5} className="absolute left-0 top-0" />
                                    <Plus size={16} strokeWidth={2} className="absolute -bottom-1 -right-1" />
                                </div>
                            </button>
                            <button
                                onClick={handleEditAddress}
                                className="w-[71px] h-[71px] border border-white/30 rounded-xl text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                                title="Editar Dirección"
                            >
                                <div className="relative w-[32px] h-[26px]">
                                    <MapPin size={26} strokeWidth={1.5} className="absolute left-0 top-0" />
                                    <Edit2 size={14} strokeWidth={2} className="absolute -bottom-1 -right-1" />
                                </div>
                            </button>
                            <button
                                onClick={handleDeleteAddressBtnClick}
                                className="w-[71px] h-[71px] border border-white/30 rounded-xl text-white hover:bg-red-500/20 hover:text-red-500 transition-colors flex items-center justify-center"
                                title="Eliminar Dirección"
                            >
                                <MapPinOff size={26} strokeWidth={1.5} />
                            </button>
                        </div>

                        <button
                            onClick={handleCreateOrder}
                            className="w-[237px] mx-auto h-[46px] rounded flex items-center justify-center transition-all active:scale-95 bg-[#7c71e2] hover:bg-[#8e84f0] text-white font-semibold text-[13px]"
                        >
                            Crear Orden
                        </button>
                    </div>
                </div>
            </div>

            {/* CONFIRMATION MODALS */}
            {customerToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-[#1e232f] rounded-3xl border border-red-500/20  -500/10 overflow-hidden flex flex-col">
                        <div className="p-6 bg-red-500/10 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-4 animate-bounce">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-xl font-semibold text-white px-4">Eliminar Cliente</h3>
                            <p className="text-gray-400 text-sm mt-2 px-4">
                                ¿Estás seguro de que deseas eliminar permanentemente a <span className="text-white font-semibold">{customerToDelete.name}</span>? Se borrarán también todas sus direcciones registradas.
                            </p>
                        </div>
                        <div className="p-6 bg-[#1e232f] border-t border-white/5 flex gap-4">
                            <button
                                onClick={() => setCustomerToDelete(null)}
                                className="flex-1 py-3 rounded-xl font-medium uppercase tracking-wider text-xs bg-white/5 hover:bg-white/10 text-white transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteCustomer}
                                className="flex-1 py-3 rounded-xl font-semibold uppercase tracking-wider text-xs bg-red-600 hover:bg-red-500 text-white  -600/30 transition-all active:scale-95 flex items-center justify-center"
                            >
                                <Trash2 size={16} className="mr-2" /> Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {addressToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-[#1e232f] rounded-3xl border border-rose-500/20  -500/10 overflow-hidden flex flex-col">
                        <div className="p-6 bg-rose-500/10 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-500 mb-4">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-semibold text-white px-4">Eliminar Dirección</h3>
                            <p className="text-gray-400 text-sm mt-2 px-4">
                                ¿Estás seguro de que deseas eliminar la dirección <span className="text-white font-semibold">{addressToDelete.name}</span>?
                            </p>
                        </div>
                        <div className="p-6 bg-[#1e232f] border-t border-white/5 flex gap-4">
                            <button
                                onClick={() => setAddressToDelete(null)}
                                className="flex-1 py-3 rounded-xl font-medium uppercase tracking-wider text-xs bg-white/5 hover:bg-white/10 text-white transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteAddress}
                                className="flex-1 py-3 rounded-xl font-semibold uppercase tracking-wider text-xs bg-rose-600 hover:bg-rose-500 text-white  -600/30 transition-all active:scale-95"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {toastMessage && (
                <div className="fixed top-12 right-4 z-[999999] animate-in slide-in-from-right fade-in duration-300">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 min-w-[320px] shadow-2xl backdrop-blur-md">
                        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                            <span className="text-white text-base font-semibold">!</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-[#1e232f] text-[11px] font-medium leading-tight">
                                {toastMessage}
                            </p>
                        </div>
                        <button
                            onClick={() => setToastMessage(null)}
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
