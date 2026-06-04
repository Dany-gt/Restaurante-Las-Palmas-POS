import React, { useState } from 'react';
import { X, User, Phone, MapPin, Save, FileText } from 'lucide-react';
import { supabase } from '../supabase';

interface NewCustomerModalProps {
    onClose: () => void;
    onCustomerAdded: () => void;
}

export const NewCustomerModal: React.FC<NewCustomerModalProps> = ({ onClose, onCustomerAdded }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [nit, setNit] = useState('');
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!name) return;
        setLoading(true);

        try {
            // 1. Create Customer
            const { data: customer, error: cError } = await supabase
                .from('customers')
                .insert({
                    name: name.toUpperCase(),
                    phone,
                    nit: nit || 'CF',
                    current_balance: 0,
                    credit_limit: 0
                })
                .select()
                .single();

            if (cError) throw cError;

            // 2. Create Address if provided
            if (address && customer) {
                const { error: aError } = await supabase
                    .from('customer_addresses')
                    .insert({
                        customer_id: customer.id,
                        address: address.toUpperCase(),
                        name: 'PRINCIPAL',
                        is_default: true
                    });
                if (aError) throw aError;
            }

            onCustomerAdded();
            onClose();

        } catch (error: any) {
            console.error('Error creating customer:', error);
            alert('Error al crear cliente: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60  p-4 animate-fade-in">
            <div className="w-full max-w-md bg-[#232632] rounded-xl border border-white/10  /50 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-white">Nuevo Cliente</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-semibold tracking-widest text-gray-500">Nombre Completo *</label>
                        <div className="relative">
                            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                autoFocus
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-[#1e212b] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-medium text-white uppercase focus:border-indigo-500 outline-none"
                                placeholder="NOMBRE DEL CLIENTE"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-semibold tracking-widest text-gray-500">Teléfono</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full bg-[#1e212b] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-medium text-white focus:border-indigo-500 outline-none"
                                    placeholder="0000-0000"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-semibold tracking-widest text-gray-500">NIT</label>
                            <div className="relative">
                                <FileText size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    value={nit}
                                    onChange={e => setNit(e.target.value)}
                                    className="w-full bg-[#1e212b] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-medium text-white focus:border-indigo-500 outline-none uppercase"
                                    placeholder="C/F"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-semibold tracking-widest text-gray-500">Dirección Inicial</label>
                        <div className="relative">
                            <MapPin size={16} className="absolute left-4 top-4 text-gray-500" />
                            <textarea
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                className="w-full bg-[#1e212b] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-medium text-white uppercase focus:border-indigo-500 outline-none resize-none h-24"
                                placeholder="DIRECCIÓN DE ENTREGA..."
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-black/20 border-t border-white/5">
                    <button
                        onClick={handleSave}
                        disabled={loading || !name}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-semibold uppercase tracking-widest text-xs flex items-center justify-center gap-2 "
                    >
                        {loading ? 'Guardando...' : <><Save size={16} /> Guardar Cliente</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
