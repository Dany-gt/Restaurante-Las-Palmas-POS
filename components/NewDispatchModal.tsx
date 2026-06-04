import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, MapPin, Package, Truck, ArrowRight, ChevronUp, ChevronDown, Globe } from 'lucide-react';
import { supabase } from '../supabase';

interface CustomerInfo {
    name: string;
    phone: string;
    address: string;
    type: 'TAKEOUT' | 'DELIVERY';
    platform_id?: string;
    is_platform_driver?: boolean;
}

interface NewDispatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'TAKEOUT' | 'DELIVERY';
    onConfirm: (info: CustomerInfo) => void;
}

export const NewDispatchModal: React.FC<NewDispatchModalProps> = ({ isOpen, onClose, type, onConfirm }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [platformId, setPlatformId] = useState<string>('');
    const [isPlatformDriver, setIsPlatformDriver] = useState(false);
    const [platforms, setPlatforms] = useState<any[]>([]);
    const [isRaised, setIsRaised] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const fetchPlatforms = async () => {
                const { data } = await supabase.from('order_platforms').select('*').eq('is_connected', true).order('name');
                setPlatforms(data || []);
            };
            fetchPlatforms();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isComplete = name && phone && (type === 'TAKEOUT' || address);

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80  p-6 animate-fade-in"
            style={{ alignItems: isRaised ? 'flex-start' : 'center', paddingTop: isRaised ? '12px' : undefined }}
        >
            <div className="w-full max-w-sm bg-[#16191f] rounded-xl border border-white/10  /50 p-8 transform transition-all">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="text-xl font-semibold uppercase tracking-tighter text-white">
                            {type === 'DELIVERY' ? 'Domicilio' : 'Para Llevar'}
                        </h3>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest mt-1">
                            Datos del cliente
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsRaised(r => !r)}
                            className="p-2 hover:bg-white/10 rounded-xl transition-all"
                            title={isRaised ? 'Centrar formulario' : 'Subir formulario'}
                        >
                            {isRaised ? <ChevronDown size={20} className="text-indigo-400" /> : <ChevronUp size={20} className="text-gray-500" />}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Form Body */}
                <div className="space-y-5 mb-8">
                    <div className="space-y-2">
                        <label className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wider ml-1">Nombre</label>
                        <div className="relative">
                            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Ej. Juan Pérez"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 pl-11 pr-4 text-xs font-medium text-white focus:outline-none focus:border-indigo-500/50 transition-all uppercase tracking-wide"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wider ml-1">Teléfono</label>
                        <div className="relative">
                            <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="tel"
                                placeholder="Ej. 5555-5555"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 pl-11 pr-4 text-xs font-medium text-white focus:outline-none focus:border-indigo-500/50 transition-all tracking-wide"
                            />
                        </div>
                    </div>

                    {type === 'DELIVERY' && (
                        <div className="space-y-2">
                            <label className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wider ml-1">Dirección</label>
                            <div className="relative">
                                <MapPin size={16} className="absolute left-4 top-4 text-gray-500" />
                                <textarea
                                    placeholder="Dirección exacta..."
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 pl-11 pr-4 text-xs font-medium text-white focus:outline-none focus:border-indigo-500/50 transition-all min-h-[80px] resize-none uppercase tracking-wide"
                                />
                            </div>
                        </div>
                    )}

                    {platforms.length > 0 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider ml-1">Plataforma de Pedido (Opcional)</label>
                                <div className="relative">
                                    <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <select
                                        value={platformId}
                                        onChange={(e) => {
                                            setPlatformId(e.target.value);
                                            if (!e.target.value) setIsPlatformDriver(false);
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 pl-11 pr-4 text-xs font-medium text-white focus:outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="" className="bg-[#1a1d24]">Venta Directa (Sin Plataforma)</option>
                                        {platforms.map(p => (
                                            <option key={p.id} value={p.id} className="bg-[#1a1d24]">{p.name.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {platformId && (
                                <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
                                    <label className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wider block">¿Quién entrega el pedido?</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setIsPlatformDriver(false)}
                                            className={`py-2.5 rounded-xl text-[10px] font-semibold uppercase transition-all ${!isPlatformDriver ? 'bg-indigo-600 text-white ' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                                        >
                                            REPARTIDOR PROPIO
                                        </button>
                                        <button
                                            onClick={() => setIsPlatformDriver(true)}
                                            className={`py-2.5 rounded-xl text-[10px] font-semibold uppercase transition-all ${isPlatformDriver ? 'bg-indigo-600 text-white ' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                                        >
                                            REPARTIDOR {platforms.find(p => p.id === platformId)?.name.toUpperCase() || 'PLATAFORMA'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Action Button */}
                <button
                    disabled={!isComplete}
                    onClick={() => onConfirm({ name, phone, address, type, platform_id: platformId || undefined, is_platform_driver: isPlatformDriver })}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-gray-500 text-white rounded-lg font-semibold uppercase tracking-[0.2em] text-xs  -600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    Continuar <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
