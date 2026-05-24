import React, { useState, useEffect } from 'react';
import { X, MapPin, Map, Navigation, Save, User } from 'lucide-react';
import { supabase } from '../supabase';

interface Address {
    id: string;
    name: string;
    address: string;
    zone?: string;
    reference?: string;
}

interface AddressModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    customerId: string;
    customerName?: string;
    addressToEdit?: Address | null;
}

export const AddressModal: React.FC<AddressModalProps> = ({ isOpen, onClose, onSuccess, customerId, customerName, addressToEdit }) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [zone, setZone] = useState('');
    const [reference, setReference] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (addressToEdit) {
                setName(addressToEdit.name || '');
                setAddress(addressToEdit.address || '');
                setZone(addressToEdit.zone || '');
                setReference(addressToEdit.reference || '');
            } else {
                setName('');
                setAddress('');
                setZone('');
                setReference('');
            }
        }
    }, [isOpen, addressToEdit]);

    const handleSave = async () => {
        if (!address) return;
        setLoading(true);

        try {
            const addressData = {
                name: name || 'CASA', // Default name if empty
                address: address,
                zone: zone || null,
                reference: reference || null,
                customer_id: customerId
            };

            if (addressToEdit) {
                // UPDATE
                const { error } = await supabase
                    .from('customer_addresses')
                    .update(addressData)
                    .eq('id', addressToEdit.id);
                if (error) throw error;
            } else {
                // INSERT
                const { error } = await supabase
                    .from('customer_addresses')
                    .insert(addressData);
                if (error) throw error;
            }

            onSuccess();
            onClose();

        } catch (error: any) {
            console.error('Error saving address:', error);
            alert('Error al guardar dirección: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
            <div className="w-full max-w-[400px] bg-[#2d2e3d] rounded-sm border border-white/10  /50 overflow-hidden flex flex-col">
                <div className="bg-[#3a3b4d] h-10 flex items-center justify-center relative shrink-0 border-b border-white/5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white">
                        DATOS DIRECCIÓN
                    </h3>
                    <button onClick={onClose} className="absolute right-3 text-white/40 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-4 bg-[#2d2e3d]">
                    {/* Readonly Customer Name */}
                    <div className="relative">
                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
                        <input
                            type="text"
                            readOnly
                            value={customerName || (addressToEdit ? 'CARGANDO...' : 'CLIENTE')}
                            className="w-full bg-black/40 border border-white/20 rounded-sm py-2 pl-9 pr-3 text-[10px] font-black text-white outline-none uppercase tracking-widest cursor-not-allowed"
                        />
                    </div>

                    <div className="relative">
                        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
                        <input
                            autoFocus
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            className="w-full bg-black/40 border border-white/20 rounded-sm py-2 pl-9 pr-3 text-[10px] font-black placeholder:text-white/40 outline-none focus:border-white tracking-widest text-white "
                            placeholder="DIRECCIÓN"
                        />
                    </div>

                    <div className="relative">
                        <Map size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
                        <input
                            value={reference}
                            onChange={e => setReference(e.target.value)}
                            className="w-full bg-black/40 border border-white/20 rounded-sm py-2 pl-9 pr-3 text-[10px] font-black placeholder:text-white/40 outline-none focus:border-white tracking-widest text-white "
                            placeholder="REFERENCIA"
                        />
                    </div>
                </div>

                <div className="p-4 bg-[#2d2e3d] border-t border-white/5 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-white/20 hover:bg-white/10 rounded-sm font-black uppercase tracking-[0.2em] text-[9px] text-white transition-all"
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || !address}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-white/20 rounded-sm font-black uppercase tracking-[0.2em] text-[9px] text-white  transition-all"
                    >
                        {loading ? '...' : 'ACEPTAR'}
                    </button>
                </div>
            </div>
        </div>
    );
};
