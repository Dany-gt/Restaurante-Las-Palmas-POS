import React, { useState, useEffect, useRef } from 'react';
import { X, User, Check, Delete, Loader2, MapPin, Smartphone, CreditCard, Search, Grid, CheckCircle, ArrowLeft, Keyboard } from 'lucide-react';
import { CustomerData, CONSUMIDOR_FINAL_NIT, CONSUMIDOR_FINAL_NAME } from '../types/billing';
import { billingService } from '../services/BillingService';
import { CustomerSearchModal } from './CustomerSearchModal';
import { Customer } from '../types';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (customer: CustomerData, paymentMethod: string, cardProcessor?: string) => void;
    total: number;
    isSuccess?: boolean;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    total,
    isSuccess = false
}) => {
    const [customer, setCustomer] = useState<CustomerData>({
        nit: '',
        name: '',
        email: '',
        address: 'CIUDAD',
        phone: ''
    });
    const [activeInput, setActiveInput] = useState<'nit' | 'name' | 'address' | 'phone'>('nit');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const nitInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'F10') {
                e.preventDefault();
                handleContingency();
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        if (isOpen) {
            setCustomer({ nit: '', name: '', email: '', address: 'CIUDAD', phone: '' });
            setActiveInput('nit');
            setError('');
            setIsVerified(false);
            setTimeout(() => {
                nitInputRef.current?.focus();
            }, 50);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleNitLookup = async () => {
        if (!customer.nit || customer.nit === CONSUMIDOR_FINAL_NIT || customer.nit === 'CF') return;

        setLoading(true);
        setError('');
        setIsVerified(false);
        try {
            const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const data = await billingService.lookupNIT(customer.nit, cachedUser?.branch_id);
            if (data) {
                setCustomer(prev => ({
                    ...prev,
                    name: data.name,
                    address: data.address || 'CIUDAD',
                    email: data.email || '',
                    phone: data.phone || ''
                }));
                setIsVerified(true);
                // Focus remains on NIT or neutral, allowing user to see filled data and click Accept
            } else {
                setError('NIT NO ENCONTRADO');
                setActiveInput('name');
            }
        } catch (err: any) {
            setError('ERROR DE CONEXIÓN');
            setActiveInput('name');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase();
        if (activeInput === 'nit') setIsVerified(false);
        setCustomer(prev => ({ ...prev, [activeInput]: val }));
        if (error) setError('');
    };

    // ... inside useEffect for Keydown ...

    const handleKeypadClick = (val: string) => {
        if (isVerified && activeInput === 'name') return;

        setCustomer(prev => ({
            ...prev,
            [activeInput]: ((prev[activeInput] || '') + val).toUpperCase()
        }));
        if (activeInput === 'nit') setIsVerified(false);
        if (error) setError('');
    };

    const handleBackspace = () => {
        if (isVerified && activeInput === 'name') return;

        setCustomer(prev => ({
            ...prev,
            [activeInput]: (prev[activeInput] || '').slice(0, -1)
        }));
        if (activeInput === 'nit') setIsVerified(false);
    };

    const handleContingency = async () => {
        const data: CustomerData = {
            nit: CONSUMIDOR_FINAL_NIT,
            name: CONSUMIDOR_FINAL_NAME,
            email: '',
            address: 'CIUDAD',
            phone: '',
            is_contingency: true
        };
        setCustomer(data);
        setIsVerified(true);
        setError('');
        
        // Proceso ultra-rápido: no esperamos al guardado si falla, lo prioritario es facturar
        try {
            setLoading(true);
            billingService.saveCustomer(data).catch(e => console.warn('Silent fail saving customer:', e));
            onSubmit(data, 'EFECTIVO');
        } catch (err) {
            setError('ERROR CRÍTICO');
            console.error('Contingency error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCF = async () => {
        const data: CustomerData = {
            nit: 'CF',
            name: CONSUMIDOR_FINAL_NAME,
            email: '',
            address: 'CIUDAD',
            phone: ''
        };
        setCustomer(data);
        setIsVerified(true);
        setError('');

        // Process immediately
        setLoading(true);
        try {
            await billingService.saveCustomer(data);
            onSubmit(data, 'EFECTIVO');
        } catch (err) {
            setError('ERROR AL PROCESAR');
        } finally {
            setLoading(false);
        }
    };

    // ... handlePorConsumo ... allow edit always?
    // ... handlePorAlmuerzo ... allow edit always?

    // ... JSX modifications for inputs ...
    // Note: Since I cannot edit disjoint lines easily with `replace_file_content`, I'll use `multi_replace` conceptually by providing a large chunk or multiple replace calls.
    // Wait, `replace_file_content` is only for contiguous blocks.
    // The previous instruction asked to replace `isVerified` injection in multple places.
    // But `handleNitLookup`, `handleChange`, `handleKeypadClick` and `handleBackspace` are contiguous enough?
    // No, `handleNitLookup` (line 47) -> `handleChange` (line 74) -> `handleKeypadClick` (line 94) -> `handleBackspace` (line 102) -> `handleContingency` (line 109).
    // They are sequential. I can replace the whole block from line 31 to 119.



    const handlePorConsumo = async () => {
        const data = {
            ...customer,
            is_por_consumo: !customer.is_por_consumo,
            is_por_almuerzo: false
        };
        setCustomer(data);
        
        // If it's a quick toggle and user has data, we could auto-submit, 
        // but user might want to check. However, user said "al presionar pase de una vez a procesar".
        if (data.nit && data.name) {
            setLoading(true);
            try {
                await billingService.saveCustomer(data);
                onSubmit(data, 'EFECTIVO');
            } catch (err) {
                setError('ERROR AL PROCESAR');
            } finally {
                setLoading(false);
            }
        }
    };

    const handlePorAlmuerzo = async () => {
        const data = {
            ...customer,
            is_por_almuerzo: !customer.is_por_almuerzo,
            is_por_consumo: false
        };
        setCustomer(data);

        if (data.nit && data.name) {
            setLoading(true);
            try {
                await billingService.saveCustomer(data);
                onSubmit(data, 'EFECTIVO');
            } catch (err) {
                setError('ERROR AL PROCESAR');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleWhatsApp = () => {
        if (!customer.phone) {
            alert('No se ha ingresado un número de teléfono para este cliente.');
            return;
        }
        const message = `Hola, le adjunto su factura por el consumo en Restaurante Las Palmas. Total: Q${total.toFixed(2)}`;
        const url = `https://wa.me/502${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const handleCustomerSelect = (selected: Customer) => {
        setCustomer(prev => ({
            ...prev,
            nit: selected.nit || 'CF',
            name: selected.name,
            address: selected.address || 'CIUDAD',
            email: selected.email || '',
            phone: selected.phone || ''
        }));
        setShowSearchModal(false);
        setActiveInput('name');
    };



    const handleSubmit = async () => {
        if (!customer.nit || !customer.name) return;
        await billingService.saveCustomer(customer); // Auto-save on submit
        onSubmit(customer, 'EFECTIVO');
    };

    if (!isOpen) return null;

    if (isSuccess) {
        return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0a0c10]/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
                <div className="w-full max-w-md bg-[#1e232f] rounded-[2rem] border border-white/10 shadow-2xl flex flex-col items-center p-10 text-center animate-in zoom-in duration-300">
                    <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6 text-white">
                        <Check size={48} />
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">Factura Generada</h2>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-[10px] mb-8">El proceso se completó correctamente</p>

                    <button
                        onClick={handleWhatsApp}
                        className="w-full py-5 bg-white/10 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl transition-all flex items-center justify-center gap-3 mb-4 active:scale-95 hover:bg-white/20"
                    >
                        <Smartphone size={20} /> Enviar WhatsApp
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-5 bg-white/5 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs border border-white/10 transition-all active:scale-95 hover:bg-white/10"
                    >
                        Finalizar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-[#1e2330] rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden relative">

                {/* Header */}
                <div className="bg-white/5 border-b border-white/5 p-6 flex justify-center items-center">
                    <h2 className="text-sm font-black text-white uppercase tracking-[0.3em]">DATOS FACTURACIÓN</h2>
                </div>

                <div className="flex flex-col md:flex-row p-6 gap-6 bg-[#1f2333]">

                    {/* Left Column: Form Data */}
                    <div className="flex-1 flex flex-col gap-4">

                        {/* NIT & Search */}
                        <div className={`flex items-center bg-black/20 border rounded-xl h-12 transition-all overflow-hidden ${activeInput === 'nit' ? 'border-white/40 ring-1 ring-white/10' : 'border-white/5'}`}>
                            <div className="w-10 h-full flex items-center justify-center text-gray-400 border-r border-gray-700/50">
                                <Grid size={18} />
                            </div>
                            <input
                                ref={nitInputRef}
                                type="text"
                                value={customer.nit}
                                onFocus={() => setActiveInput('nit')}
                                onChange={handleChange}
                                onKeyDown={(e) => e.key === 'Enter' && handleNitLookup()}
                                className="flex-1 bg-transparent px-3 text-base font-medium text-white outline-none placeholder:text-gray-600 font-mono"
                                placeholder="00000000"
                                data-no-keyboard
                            />
                            {loading ? (
                                <div className="px-3"><Loader2 className="animate-spin text-white" size={18} /></div>
                            ) : (
                                <button
                                    onClick={() => handleNitLookup()}
                                    className="h-full px-3 text-gray-400 hover:text-white border-l border-gray-700/50 hover:bg-white/5 transition-colors"
                                >
                                    <Search size={18} />
                                </button>
                            )}
                        </div>

                        {/* Name */}
                        <div className={`flex items-center bg-black/20 border rounded-xl h-12 transition-all overflow-hidden ${activeInput === 'name' ? 'border-white/40 ring-1 ring-white/10' : 'border-white/5'}`}>
                            <div className="w-10 h-full flex items-center justify-center text-gray-400 border-r border-gray-700/50">
                                <User size={18} />
                            </div>
                            <input
                                type="text"
                                value={customer.name}
                                onFocus={() => setActiveInput('name')}
                                onChange={handleChange}
                                className="flex-1 bg-transparent px-3 text-sm font-bold outline-none uppercase text-white placeholder:text-gray-600 tracking-tight"
                                placeholder="NOMBRE DEL CLIENTE"
                                data-no-keyboard
                            />
                        </div>

                        {/* Address */}
                        <div className={`flex items-center bg-black/20 border rounded-xl h-12 transition-all overflow-hidden ${activeInput === 'address' ? 'border-white/40 ring-1 ring-white/10' : 'border-white/5'}`}>
                            <div className="w-10 h-full flex items-center justify-center text-gray-400 border-r border-gray-700/50">
                                <MapPin size={18} />
                            </div>
                            <input
                                type="text"
                                value={customer.address}
                                onFocus={() => setActiveInput('address')}
                                onChange={handleChange}
                                className="flex-1 bg-transparent px-3 text-base font-medium text-white outline-none placeholder:text-gray-600 uppercase"
                                placeholder="DIRECCIÓN"
                                data-no-keyboard
                            />
                        </div>

                        {/* Phone */}
                        <div className={`flex items-center bg-black/20 border rounded-xl h-12 transition-all overflow-hidden ${activeInput === 'phone' ? 'border-white/40 ring-1 ring-white/10' : 'border-white/5'}`}>
                            <div className="w-10 h-full flex items-center justify-center text-gray-400 border-r border-gray-700/50">
                                <Smartphone size={18} />
                            </div>
                            <input
                                type="text"
                                value={customer.phone}
                                onFocus={() => setActiveInput('phone')}
                                onChange={handleChange}
                                className="flex-1 bg-transparent px-3 text-base font-medium text-white outline-none placeholder:text-gray-600 uppercase"
                                placeholder="TELÉFONO"
                                data-no-keyboard
                            />
                        </div>

                        {/* Quick Action Buttons Row */}
                        <div className="flex gap-3 mt-2">
                            <button onClick={handleContingency} className="h-10 px-4 rounded bg-[#181b25] hover:bg-[#252a36] hover:text-white border border-gray-700 text-white text-[11px] font-bold uppercase tracking-wider transition-all flex-1">
                                F10
                            </button>
                            <button onClick={handlePorConsumo} className="h-10 px-4 rounded bg-[#181b25] hover:bg-[#252a36] hover:text-white border border-gray-700 text-white text-[11px] font-bold uppercase tracking-wider transition-all flex-1">
                                POR CONSUMO
                            </button>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleCF} className="h-10 px-4 rounded bg-[#181b25] hover:bg-[#252a36] hover:text-white border border-gray-700 text-white text-[11px] font-bold uppercase tracking-wider transition-all flex-1">
                                Consumidor Final
                            </button>
                            <button onClick={handlePorAlmuerzo} className="h-10 px-4 rounded bg-[#181b25] hover:bg-[#252a36] hover:text-white border border-gray-700 text-white text-[11px] font-bold uppercase tracking-wider transition-all flex-1">
                                Por Almuerzo
                            </button>
                        </div>

                    </div>

                    {/* Right Column: Compact Keypad */}
                    <div className="w-full md:w-[320px] bg-[#1a1e29] p-4 rounded-lg border border-gray-800 flex flex-col shadow-inner">

                        {/* Display - Small - STRICTLY NIT */}
                        <div className="bg-black/40 rounded-2xl border border-white/5 text-right h-16 flex flex-col justify-center px-4 mb-4 relative overflow-hidden">
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-0.5">
                                INGRESANDO NIT...
                            </span>
                            <div className="flex justify-end items-center overflow-hidden">
                                <span className="text-2xl font-bold text-white truncate tracking-wide">
                                    {customer.nit || ''}<span className="animate-pulse text-white/40 font-light">|</span>
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 flex-1">
                            {/* Num Pad */}
                            {/* Row 1 */}
                            {['7', '8', '9'].map(num => (
                                <button key={num} onClick={() => handleKeypadClick(num)} className="h-14 bg-[#232836] hover:bg-[#2d3345] active:bg-[#384055] rounded text-lg font-bold text-white transition-all shadow-sm border border-gray-700/30">
                                    {num}
                                </button>
                            ))}
                            {/* Delete Button - Row 1 & 2, Col 4 */}
                            <button onClick={handleBackspace} className="row-span-2 h-full bg-white/5 hover:bg-white/10 active:scale-95 rounded-2xl text-white/50 transition-all shadow-sm border border-white/5 flex items-center justify-center">
                                <Delete size={24} />
                            </button>

                            {/* Row 2 */}
                            {['4', '5', '6'].map(num => (
                                <button key={num} onClick={() => handleKeypadClick(num)} className="h-14 bg-[#232836] hover:bg-[#2d3345] active:bg-[#384055] rounded text-lg font-bold text-white transition-all shadow-sm border border-gray-700/30">
                                    {num}
                                </button>
                            ))}

                            {/* Row 3 */}
                            {['1', '2', '3'].map(num => (
                                <button key={num} onClick={() => handleKeypadClick(num)} className="h-14 bg-[#232836] hover:bg-[#2d3345] active:bg-[#384055] rounded text-lg font-bold text-white transition-all shadow-sm border border-gray-700/30">
                                    {num}
                                </button>
                            ))}

                            {/* Enter Button (NIT Lookup ONLY) - Row 3 & 4, Col 4 */}
                            <button
                                onClick={handleNitLookup}
                                disabled={!customer.nit || loading}
                                className="row-span-2 h-full bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/20 rounded-2xl font-black shadow-lg transition-all flex items-center justify-center active:scale-95"
                                title="Buscar NIT"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={24} />
                                ) : (
                                    <Search size={28} strokeWidth={3} />
                                )}
                            </button>

                            <button onClick={() => handleKeypadClick('0')} className="col-span-2 h-14 bg-[#232836] hover:bg-[#2d3345] active:bg-[#384055] rounded text-lg font-bold text-white transition-all shadow-sm border border-gray-700/30">
                                0
                            </button>
                            <button onClick={() => handleKeypadClick('K')} className="h-14 bg-[#232836] hover:bg-[#2d3345] active:bg-[#384055] rounded text-lg font-bold text-white transition-all shadow-sm border border-gray-700/30">
                                K
                            </button>
                        </div>

                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-8 bg-white/5 border-t border-white/5 flex gap-4 justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 h-14 rounded-2xl border border-white/10 text-white/40 font-black uppercase hover:bg-white/5 active:scale-95 transition-all text-xs tracking-[0.2em]"
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!customer.nit || !customer.name}
                        className="px-10 h-14 rounded-2xl bg-white text-black font-black uppercase shadow-xl transition-all active:scale-95 text-xs tracking-[0.2em] flex items-center gap-2 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/20"
                    >
                        {!loading ? <CheckCircle size={18} /> : <Loader2 className="animate-spin" size={18} />}
                        {loading ? 'PROCESANDO' : 'ACEPTAR'}
                    </button>
                </div>

            </div>

            <CustomerSearchModal
                isOpen={showSearchModal}
                onClose={() => setShowSearchModal(false)}
                onSelect={handleCustomerSelect}
            />
        </div>
    );

};
