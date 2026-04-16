import React, { useState, useEffect } from 'react';
import { Search, User, Phone, X, Loader2, Check } from 'lucide-react';
import { supabase } from '../supabase';
import { Customer } from '../types';

interface CustomerSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (customer: Customer) => void;
}

export const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchCustomers();
            setSearchTerm('');
        }
    }, [isOpen]);

    const fetchCustomers = async () => {
        setLoading(true);
        // Fetch all customers - optimization: limit or paginate if too many, but for now select all
        // We order by name for better UX
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('name');

        if (data) {
            setCustomers(data);
            setFilteredCustomers(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!searchTerm) {
            setFilteredCustomers(customers);
            return;
        }
        const lowerTerm = searchTerm.toLowerCase();
        const filtered = customers.filter(c =>
            (c.name || '').toLowerCase().includes(lowerTerm) ||
            (c.nit || '').toLowerCase().includes(lowerTerm) ||
            (c.phone || '').includes(lowerTerm)
        );
        setFilteredCustomers(filtered);
    }, [searchTerm, customers]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-2xl bg-[#14171c] rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#1e212b]">
                    <div className="flex flex-col">
                        <h3 className="text-lg font-black text-white uppercase tracking-wider">Buscar Cliente</h3>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Seleccione cliente para facturación</span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-6 bg-[#16191f] border-b border-white/5">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por Nombre, NIT o Teléfono..."
                            autoFocus
                            className="w-full h-14 bg-[#0a0c10] border border-white/10 rounded-2xl pl-12 pr-4 text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-gray-600"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-[#0f1115]">
                    {loading ? (
                        <div className="h-40 flex items-center justify-center">
                            <Loader2 className="animate-spin text-indigo-500" size={32} />
                        </div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-gray-500">
                            <User size={32} className="mb-2 opacity-50" />
                            <span className="text-xs font-bold uppercase tracking-widest">No se encontraron clientes</span>
                        </div>
                    ) : (
                        filteredCustomers.map(customer => (
                            <button
                                key={customer.id}
                                onClick={() => onSelect(customer)}
                                className="w-full p-4 bg-[#1e212b] border border-white/5 rounded-2xl flex items-center justify-between group hover:bg-white/5 hover:border-indigo-500/30 transition-all text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                        <User size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-gray-200 group-hover:text-white uppercase">{customer.name}</span>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                            {customer.nit && (
                                                <span className="flex items-center gap-1">NIT: <span className="text-indigo-400">{customer.nit}</span></span>
                                            )}
                                            {customer.phone && (
                                                <span className="flex items-center gap-1"><Phone size={10} /> {customer.phone}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-2 rounded-lg bg-white/5 text-gray-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                    <Check size={16} />
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-[#1e212b] border-t border-white/5 text-center">
                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">{filteredCustomers.length} Clientes Encontrados</span>
                </div>
            </div>
        </div>
    );
};
