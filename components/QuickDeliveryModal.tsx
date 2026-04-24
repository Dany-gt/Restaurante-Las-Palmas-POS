import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, MapPin, Navigation, FileText, Hash, Building, ChevronUp, ChevronDown, Globe } from 'lucide-react';
import { supabase } from '../supabase';

interface QuickDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: {
        name: string;
        phone: string;
        phone2?: string;
        email?: string;
        address: string;
        reference?: string;
        notes?: string;
        nit?: string;
        city?: string;
        type: 'DELIVERY' | 'TAKEOUT';
        platform_id?: string;
        is_platform_driver?: boolean;
    }) => void;
    type: 'DELIVERY' | 'TAKEOUT';
}

export const QuickDeliveryModal: React.FC<QuickDeliveryModalProps> = ({ isOpen, onClose, onConfirm, type }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [phone2, setPhone2] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [nit, setNit] = useState('CF');
    const [nitName, setNitName] = useState('Consumidor Final');
    const [city, setCity] = useState('Ciudad');
    const [platformId, setPlatformId] = useState<string>('');
    const [isPlatformDriver, setIsPlatformDriver] = useState(false);
    const [platforms, setPlatforms] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const fetchPlatforms = async () => {
                const { data } = await supabase.from('order_platforms').select('*').eq('is_connected', true).order('name');
                setPlatforms(data || []);
            };
            fetchPlatforms();
        }
    }, [isOpen]);

    // Toggle position: center (default) or raised to top (keyboard visible)
    const [isRaised, setIsRaised] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!name.trim()) {
            alert('Ingresa el nombre del cliente');
            return;
        }
        if (!phone.trim()) {
            alert('Ingresa el teléfono');
            return;
        }
        if (type === 'DELIVERY' && !address.trim()) {
            alert('Ingresa la dirección de entrega');
            return;
        }

        setSaving(true);
        onConfirm({
            name: name.trim(),
            phone: phone.trim(),
            phone2: phone2.trim() || undefined,
            email: email.trim() || undefined,
            address: address.trim(),
            reference: reference.trim() || undefined,
            notes: notes.trim() || undefined,
            nit: nit.trim() || 'CF',
            city: city.trim() || undefined,
            platform_id: platformId || undefined,
            is_platform_driver: isPlatformDriver,
            type
        });
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 animate-fade-in"
            style={{ alignItems: isRaised ? 'flex-start' : 'center', paddingTop: isRaised ? '12px' : undefined }}
        >
            <div
                className="w-full max-w-lg bg-[#1f2937] rounded-2xl border border-gray-700 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden transition-all duration-300"
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex items-center justify-between shrink-0 bg-[#1f2937] z-10">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-200">Datos de Cliente</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsRaised(r => !r)}
                            className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-indigo-400 transition-colors"
                            title={isRaised ? 'Centrar formulario' : 'Subir formulario (teclado)'}
                        >
                            {isRaised ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                        </button>
                        <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Form Container with Inner Scroll */}
                <div className="p-5 space-y-3 flex-1 overflow-y-auto custom-scrollbar bg-[#1f2937]">
                    {/* Nombre de Cliente */}
                    <div className="relative shrink-0">
                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nombre de Cliente"
                            className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
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
                                placeholder="Teléfono"
                                className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                            />
                        </div>
                        <div className="relative">
                            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="tel"
                                value={phone2}
                                onChange={(e) => setPhone2(e.target.value)}
                                placeholder="Teléfono 2"
                                className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
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
                            className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                        />
                    </div>

                    {/* Dirección Completa */}
                    <div className="relative shrink-0">
                        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Dirección Completa"
                            className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
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
                            className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                        />
                    </div>

                    {/* Observaciones del Cliente */}
                    <div className="relative shrink-0">
                        <FileText size={14} className="absolute left-3 top-3 text-gray-500" />
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Observaciones del Cliente..."
                            className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                        />
                    </div>

                    {/* NIT + Nombre Factura */}
                    <div className="grid grid-cols-2 gap-3 shrink-0">
                        <div className="relative">
                            <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={nit}
                                onChange={(e) => setNit(e.target.value)}
                                placeholder="NIT"
                                className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                            />
                        </div>
                        <div className="relative">
                            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={nitName}
                                onChange={(e) => setNitName(e.target.value)}
                                placeholder="Consumidor Final"
                                className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
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
                            className="w-full bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none transition-all"
                        />
                    </div>

                    {/* Plataforma */}
                    {platforms.length > 0 && (
                        <div className="space-y-4 pt-2">
                            <div className="relative shrink-0">
                                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <select
                                    value={platformId}
                                    onChange={(e) => {
                                        setPlatformId(e.target.value);
                                        if (!e.target.value) setIsPlatformDriver(false);
                                    }}
                                    className="w-full bg-gray-900 border border-gray-700 focus:border-emerald-500 rounded-lg py-2.5 pl-9 pr-4 text-sm text-gray-200 outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Venta Directa (Sin Plataforma)</option>
                                    {platforms.map(p => (
                                        <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            {platformId && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">¿Quién entrega el pedido?</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsPlatformDriver(false)}
                                            className={`py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${!isPlatformDriver ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                                        >
                                            REPARTIDOR PROPIO
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsPlatformDriver(true)}
                                            className={`py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${isPlatformDriver ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                                        >
                                            REPARTIDOR EXTERNO
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-gray-700 flex gap-3 shrink-0 bg-[#1f2937] z-10">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-transparent border border-gray-600 hover:bg-gray-700 rounded-lg font-bold text-xs uppercase tracking-widest text-gray-400 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
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
