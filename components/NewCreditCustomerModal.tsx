import React, { useState } from 'react';
import { User, Phone, MapPin, Mail, DollarSign, Percent } from 'lucide-react';
import { supabase } from '../supabase';

interface NewCreditCustomerModalProps {
    onClose: () => void;
    onCustomerAdded: () => void;
    settings: any;
}

export const NewCreditCustomerModal: React.FC<NewCreditCustomerModalProps> = ({ onClose, onCustomerAdded, settings }) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [creditLimit, setCreditLimit] = useState('');
    const [discount, setDiscount] = useState('');
    const [loading, setLoading] = useState(false);

    const currency = settings?.currency || 'Q';

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
                    email,
                    nit: 'CF', // Default to CF for credit unless specified otherwise
                    current_balance: 0,
                    credit_limit: parseFloat(creditLimit) || 0,
                    authorized_discount: parseFloat(discount) || 0
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
            <div className="w-full max-w-lg bg-[#232632] rounded-lg  /50 overflow-hidden flex flex-col border border-white/10">
                <div className="p-6 border-b border-white/5 text-center bg-[#232632]">
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-white">DATOS CUENTA AL CRÉDITO</h3>
                </div>

                <div className="p-6 space-y-4">
                    {/* Nombre */}
                    <div className="relative">
                        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white" />
                        <input
                            autoFocus
                            data-virtual-input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-[#1e212b] border border-white/10 rounded-lg py-3 pl-12 pr-4 text-xs font-medium text-white outline-none focus:border-indigo-500 transition-colors uppercase placeholder:text-gray-500"
                            placeholder="Nombre de Cuenta"
                        />
                    </div>

                    {/* Dirección */}
                    <div className="relative">
                        <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white" />
                        <input
                            data-virtual-input
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            className="w-full bg-[#1e212b] border border-white/10 rounded-lg py-3 pl-12 pr-4 text-xs font-medium text-white outline-none focus:border-indigo-500 transition-colors uppercase placeholder:text-gray-500"
                            placeholder="Dirección"
                        />
                    </div>

                    {/* Teléfono */}
                    <div className="relative">
                        <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white" />
                        <input
                            data-virtual-input
                            data-keyboard="numeric"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="w-full bg-[#1e212b] border border-white/10 rounded-lg py-3 pl-12 pr-4 text-xs font-medium text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-500"
                            placeholder="Teléfono"
                        />
                    </div>

                    {/* Correo Electrónico */}
                    <div className="relative">
                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white" />
                        <input
                            data-virtual-input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-[#1e212b] border border-white/10 rounded-lg py-3 pl-12 pr-4 text-xs font-medium text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-500"
                            placeholder="Correo Electrónico"
                        />
                    </div>

                    {/* Límite de Crédito */}
                    <div className="flex items-center gap-4">
                        <div className="relative w-1/2">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-semibold text-sm">Q</span>
                            <input
                                data-virtual-input
                                data-keyboard="numeric"
                                type="text"
                                value={creditLimit}
                                onChange={e => setCreditLimit(e.target.value)}
                                className="w-full bg-[#1e212b] border border-white/10 rounded-lg py-3 pl-12 pr-4 text-xs font-medium text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-500 text-center"
                                placeholder={`${currency}0.00`}
                            />
                        </div>
                        <span className="text-[9px] font-medium text-white w-1/2">* Límite de Crédito (Cero si desea que sea ilimitado)</span>
                    </div>

                    {/* Porcentaje de Descuento */}
                    <div className="flex items-center gap-4">
                        <div className="relative w-1/2">
                            <Percent size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white" />
                            <input
                                data-virtual-input
                                data-keyboard="numeric"
                                type="text"
                                value={discount}
                                onChange={e => setDiscount(e.target.value)}
                                className="w-full bg-[#1e212b] border border-white/10 rounded-lg py-3 pl-12 pr-4 text-xs font-medium text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-500 text-center"
                                placeholder="0.00 %"
                            />
                        </div>
                        <span className="text-[9px] font-medium text-white w-1/2">* Porcentaje de Descuento</span>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-2 gap-4 bg-[#232632] border-t border-white/5">
                    <button
                        onClick={onClose}
                        className="py-4 rounded-xl font-semibold uppercase tracking-widest text-[11px] border border-white/20 text-white hover:bg-white/5 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || !name}
                        className="py-4 rounded-xl font-semibold uppercase tracking-widest text-[11px] bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors "
                    >
                        {loading ? 'Guardando...' : 'Aceptar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
