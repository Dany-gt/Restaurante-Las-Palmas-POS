import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, MapPin, Navigation, FileText, Hash, Building, ChevronUp, ChevronDown, Loader2, Search } from 'lucide-react';
import { supabase } from '../supabase';
import { billingService } from '../services/BillingService';

interface Customer {
    id: string;
    name: string;
    phone: string;
    nit?: string;
    email?: string;
    phone2?: string;
    notes?: string;
    city?: string;
}

interface CustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    customerToEdit?: Customer | null;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({ isOpen, onClose, onSuccess, customerToEdit }) => {
    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [phone2, setPhone2] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [nit, setNit] = useState('');
    const [nitName, setNitName] = useState('');
    const [city, setCity] = useState('');

    const [saving, setSaving] = useState(false);
    const [isRaised, setIsRaised] = useState(false);
    const [isSearchingNit, setIsSearchingNit] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (customerToEdit) {
                setName(customerToEdit.name || '');
                setPhone(customerToEdit.phone || '');
                setPhone2(customerToEdit.phone2 || '');
                setEmail(customerToEdit.email || '');
                setNotes(customerToEdit.notes || '');
                setNit(customerToEdit.nit || '');
                setCity(customerToEdit.city || '');
                // Address cannot be easily edited here if multiple exist, so we leave address blank for 'Add New Address' or skip?
                // For simplicity, we leave address fields empty in Edit Mode unless we fetch the primary one.
                // Assuming "Edit Customer" is mainly for profile info.
                setAddress('');
                setReference('');
            } else {
                // RESET for New Customer
                setName('');
                setPhone('');
                setPhone2('');
                setEmail('');
                setAddress('');
                setReference('');
                setNotes('');
                setNit('');
                setNitName('');
                setCity('Guatemala');
            }
        }
    }, [isOpen, customerToEdit]);

    const searchCustomer = async (nitSearch: string) => {
        const cleanNit = nitSearch.trim().toUpperCase();
        if (!cleanNit || cleanNit === 'CF') return;

        setIsSearchingNit(true);
        try {
            const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const data = await billingService.lookupNIT(cleanNit, cachedUser?.branch_id);
            if (data && data.name) {
                setNitName(data.name);
                if (data.address && data.address !== 'CIUDAD') {
                    setAddress(data.address);
                }
            } else {
                setNitName('');
            }
        } catch (error) {
            console.error('Error fetching NIT:', error);
            // Don't alert loudly, just clear the name so they can type it manually
        } finally {
            setIsSearchingNit(false);
        }
    };

    const handleSave = async () => {
        if (!name) return;
        setSaving(true);

        try {
            const customerData = {
                name: name,
                phone,
                phone2,
                email,
                notes,
                nit: nit || 'CF',
                city
            };

            let customerId = customerToEdit?.id;

            if (customerToEdit) {
                // UPDATE
                const { error } = await supabase
                    .from('customers')
                    .update(customerData)
                    .eq('id', customerId);
                if (error) throw error;
            } else {
                // INSERT
                const { data, error } = await supabase
                    .from('customers')
                    .insert({
                        ...customerData,
                        current_balance: 0,
                        credit_limit: 0
                    })
                    .select()
                    .single();

                if (error) throw error;
                customerId = data.id;
            }

            // Handle Address (Only if provided)
            if (address && customerId) {
                const { error: addrError } = await supabase
                    .from('customer_addresses')
                    .insert({
                        customer_id: customerId,
                        address: address,
                        reference: reference,
                        city: city,
                        name: 'Principal'
                    });

                if (addrError) {
                    console.error("Error saving address:", addrError);
                    // Don't block success if customer saved but address failed (warn user?)
                }
            }

            onSuccess();
            onClose();

        } catch (error: any) {
            console.error('Error saving customer:', error);
            alert('Error al guardar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in"
            style={{ alignItems: isRaised ? 'flex-start' : 'center', paddingTop: isRaised ? '12px' : undefined }}
        >
            <div className="w-full max-w-lg bg-[#2d2e3d] rounded-2xl border border-white/5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden transition-all duration-300">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#3a3b4d] z-10">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-200">
                        {customerToEdit ? 'Editar Cliente' : 'Datos de Cliente'}
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsRaised(r => !r)}
                            className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-indigo-400 transition-colors"
                            title={isRaised ? 'Centrar formulario' : 'Subir formulario'}
                        >
                            {isRaised ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                        </button>
                        <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Form Container with Inner Scroll */}
                <div className="p-5 space-y-3 flex-1 overflow-y-auto custom-scrollbar bg-[#2d2e3d]">
                    {/* Nombre de Cliente */}
                    <div className="relative shrink-0">
                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nombre de Cliente"
                            className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Teléfono + Teléfono 2 */}
                    <div className="grid grid-cols-2 gap-3 shrink-0">
                        <div className="relative">
                            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Teléfono 1"
                                className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                            />
                        </div>
                        <div className="relative">
                            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="tel"
                                value={phone2}
                                onChange={(e) => setPhone2(e.target.value)}
                                placeholder="Teléfono 2"
                                className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Correo Electrónico */}
                    <div className="relative shrink-0">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Correo Electrónico"
                            className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                        />
                    </div>

                    {/* Address Fields - ONLY FOR NEW CUSTOMERS */}
                    {!customerToEdit && (
                        <>
                            {/* Dirección Completa */}
                            <div className="relative shrink-0">
                                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Dirección Completa"
                                    className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                                />
                            </div>

                            {/* Referencia */}
                            <div className="relative shrink-0">
                                <Navigation size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                    placeholder="Referencia"
                                    className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                                />
                            </div>
                        </>
                    )}

                    {/* Observaciones del Cliente */}
                    <div className="relative shrink-0">
                        <FileText size={14} className="absolute left-3 top-3 text-gray-500" />
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Observaciones del Cliente..."
                            className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                        />
                    </div>

                    {/* NIT Selection & Lookup */}
                    <div className="space-y-3 p-3 bg-black/20 rounded-xl border border-white/5">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    value={nit}
                                    onChange={(e) => setNit(e.target.value.toUpperCase())}
                                    onBlur={(e) => {
                                        if (e.target.value && e.target.value !== 'CF') {
                                            searchCustomer(e.target.value);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            searchCustomer(nit);
                                        }
                                    }}
                                    placeholder="NIT / CF"
                                    className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-2 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all uppercase"
                                />
                            </div>
                            <button
                                onClick={() => searchCustomer(nit)}
                                disabled={isSearchingNit || !nit || nit === 'CF'}
                                className="px-5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 rounded-lg flex items-center justify-center disabled:opacity-50 transition-all font-bold text-[10px] tracking-wider uppercase shrink-0"
                                title="Buscar NIT en SAT"
                            >
                                {isSearchingNit ? <Loader2 size={14} className="animate-spin mr-2" /> : <Search size={14} className="mr-2" />}
                                {isSearchingNit ? 'Buscando...' : 'Verificar'}
                            </button>
                        </div>

                        {/* NIT NAME FEEDBACK - FULL WIDTH BELOW */}
                        <div className="relative">
                            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={nitName}
                                onChange={(e) => setNitName(e.target.value)}
                                placeholder="Nombre para Factura (Nombre obtenido de SAT)"
                                className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-[9px] text-white font-black placeholder:text-gray-600 outline-none transition-all uppercase"
                            />
                        </div>
                    </div>

                    {/* Ciudad */}
                    <div className="relative shrink-0">
                        <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Ciudad"
                            className="w-full bg-black/40 border border-white/10 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-white/5 flex gap-3 shrink-0 bg-[#3a3b4d] z-10">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-transparent border border-white/10 hover:bg-white/5 rounded-lg font-bold text-xs uppercase tracking-widest text-gray-400 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-xs uppercase tracking-widest text-white transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                    >
                        {saving ? 'Guardando...' : 'Aceptar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
