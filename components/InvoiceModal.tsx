import React, { useState, useEffect, useRef } from 'react';
import { X, User, Check, Delete, Loader2, MapPin, Smartphone, CreditCard, Search, Grid, CheckCircle, ArrowLeft, Keyboard, ExternalLink } from 'lucide-react';
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
    pdfUrl?: string;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    total,
    isSuccess = false,
    pdfUrl
}) => {
    const [customer, setCustomer] = useState<CustomerData>({
        nit: 'CF',
        name: CONSUMIDOR_FINAL_NAME,
        email: '',
        address: 'CIUDAD',
        phone: ''
    });
    const [keypadNit, setKeypadNit] = useState('');
    const [activeInput, setActiveInput] = useState<'nit' | 'name' | 'address' | 'phone'>('nit');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [isVerified, setIsVerified] = useState(true);
    const activeInputRef = useRef(activeInput);
    const keypadNitRef = useRef(keypadNit);
    const nitInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        activeInputRef.current = activeInput;
    }, [activeInput]);

    useEffect(() => {
        keypadNitRef.current = keypadNit;
    }, [keypadNit]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            const currentActiveInput = activeInputRef.current;
            const currentKeypadNit = keypadNitRef.current;

            if (e.key === 'F10') {
                e.preventDefault();
                handleContingency();
                return;
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit();
                return;
            }

            if (currentActiveInput === 'nit') {
                if (e.key === 'Tab') {
                    return;
                }

                if (/^[0-9kK]$/.test(e.key)) {
                    e.preventDefault();
                    setKeypadNit(prev => (prev + e.key).toUpperCase());
                    if (error) setError('');
                    return;
                }

                if (e.key === 'Backspace') {
                    e.preventDefault();
                    if (currentKeypadNit.length > 0) {
                        setKeypadNit(prev => prev.slice(0, -1));
                    } else {
                        setCustomer(prev => ({ ...prev, nit: '' }));
                    }
                    return;
                }

                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNitLookup(currentKeypadNit);
                    return;
                }

                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        if (isOpen) {
            setCustomer({ nit: 'CF', name: CONSUMIDOR_FINAL_NAME, email: '', address: 'CIUDAD', phone: '' });
            setKeypadNit('');
            setActiveInput('nit');
            setError('');
            setIsVerified(true);
            setTimeout(() => {
                nitInputRef.current?.focus();
            }, 50);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleNitLookup = async (nitToSearch?: string) => {
        const nit = (nitToSearch !== undefined ? nitToSearch : keypadNit).trim();
        if (!nit || nit === CONSUMIDOR_FINAL_NIT || nit === 'CF') {
            setCustomer(prev => ({
                ...prev,
                nit: 'CF',
                name: CONSUMIDOR_FINAL_NAME,
                address: 'CIUDAD'
            }));
            setKeypadNit('');
            setIsVerified(true);
            return;
        }

        setLoading(true);
        setError('');
        setIsVerified(false);
        try {
            const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const data = await billingService.lookupNIT(nit, cachedUser?.branch_id);
            
            // Transfer NIT to customer.nit
            setCustomer(prev => ({
                ...prev,
                nit: nit
            }));

            if (data) {
                setCustomer(prev => ({
                    ...prev,
                    name: data.name,
                    address: data.address || 'CIUDAD',
                    email: data.email || '',
                    phone: data.phone || ''
                }));
                setIsVerified(true);
                setKeypadNit(''); // Clear keypad buffer upon successful transfer
            } else {
                setError('NIT NO ENCONTRADO');
                setKeypadNit(''); // Clear keypad buffer too
                setActiveInput('name');
            }
        } catch (err: any) {
            setError('ERROR DE CONEXIÓN');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (activeInput === 'nit') {
            setIsVerified(false);
            setCustomer(prev => ({ ...prev, nit: val.toUpperCase() }));
            setKeypadNit(''); // Clear keypad buffer on physical keyboard typing
        } else {
            setCustomer(prev => ({ ...prev, [activeInput]: val }));
        }
        if (error) setError('');
    };

    // ... inside useEffect for Keydown ...

    const handleKeypadClick = (val: string) => {
        if (activeInput === 'nit') {
            setKeypadNit(prev => (prev + val).toUpperCase());
            if (error) setError('');
        } else {
            if (isVerified && activeInput === 'name') return;
            setCustomer(prev => ({
                ...prev,
                [activeInput]: (prev[activeInput] || '') + val
            }));
            if (error) setError('');
        }
    };

    const handleBackspace = () => {
        if (activeInput === 'nit') {
            if (keypadNit.length > 0) {
                setKeypadNit(prev => prev.slice(0, -1));
            } else {
                setCustomer(prev => ({ ...prev, nit: '' }));
            }
        } else {
            if (isVerified && activeInput === 'name') return;
            setCustomer(prev => ({
                ...prev,
                [activeInput]: (prev[activeInput] || '').slice(0, -1)
            }));
        }
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
        setKeypadNit('');
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
        setKeypadNit('');
        setIsVerified(true);
        setError('');
    };

    const handlePorConsumo = async () => {
        const data = {
            ...customer,
            is_por_consumo: !customer.is_por_consumo,
            is_por_almuerzo: false
        };
        setCustomer(data);
    };

    const handlePorAlmuerzo = async () => {
        const data = {
            ...customer,
            is_por_almuerzo: !customer.is_por_almuerzo,
            is_por_consumo: false
        };
        setCustomer(data);
    };

    const handleWhatsApp = () => {
        if (!customer.phone) {
            alert('No se ha ingresado un número de teléfono para este cliente.');
            return;
        }
        let message = '';
        if (pdfUrl) {
            message = `¡Hola! Le saludamos de Restaurante Las Palmas.\nAgradecemos su preferencia y le compartimos el enlace para descargar su factura digital por un monto de Q${total.toFixed(2)}: ${pdfUrl}.\n¡Feliz día y buen provecho!`;
        } else {
            message = `¡Hola! Le saludamos de Restaurante Las Palmas.\nAgradecemos su preferencia y le compartimos los detalles de su consumo por un monto de Q${total.toFixed(2)}.\n¡Feliz día y buen provecho!`;
        }
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
        setKeypadNit('');
        setShowSearchModal(false);
        setActiveInput('name');
    };



    const handleSubmit = async () => {
        let finalCustomer = { ...customer };
        if (activeInput === 'nit' && keypadNit.trim()) {
            finalCustomer.nit = keypadNit.trim();
        }
        if (!finalCustomer.nit || !finalCustomer.nit.trim() || finalCustomer.nit === 'CF') {
            finalCustomer.nit = 'CF';
            finalCustomer.name = CONSUMIDOR_FINAL_NAME;
            finalCustomer.address = 'CIUDAD';
        } else if (!finalCustomer.name || !finalCustomer.name.trim()) {
            setError('NOMBRE REQUERIDO');
            return;
        }
        await billingService.saveCustomer(finalCustomer); // Auto-save on submit
        onSubmit(finalCustomer, 'EFECTIVO');
    };

    if (!isOpen) return null;

    if (isSuccess) {
        return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0a0c10]/95 p-4 animate-in fade-in duration-300">
                <div className="w-full max-w-md bg-[#1e232f] border border-white/10 shadow-2xl flex flex-col items-center p-10 text-center animate-in zoom-in duration-300">
                    <div className="w-24 h-24 bg-white/10 flex items-center justify-center mb-6 text-white">
                        <Check size={48} />
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">Factura Generada</h2>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-[10px] mb-8">El proceso se completó correctamente</p>

                    {pdfUrl && (
                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-5 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl transition-all flex items-center justify-center gap-3 mb-4 active:scale-95 hover:bg-indigo-500"
                        >
                            <ExternalLink size={20} /> Ver Factura (PDF)
                        </a>
                    )}

                    <button
                        onClick={handleWhatsApp}
                        className="w-full py-5 bg-white/10 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl transition-all flex items-center justify-center gap-3 mb-4 active:scale-95 hover:bg-white/20"
                    >
                        <Smartphone size={20} /> Enviar WhatsApp
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-5 bg-white/5 text-white font-black uppercase tracking-[0.2em] text-xs border border-white/10 transition-all active:scale-95 hover:bg-white/10"
                    >
                        Finalizar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
            <style>{`
                @keyframes fast-blink {
                    0%, 100% { opacity: 0.1; }
                    50% { opacity: 1; }
                }
                .animate-fast-blink {
                    animation: fast-blink 0.8s step-end infinite;
                }
            `}</style>
            <div className="bg-[#1e2330] shadow-2xl border border-white/10 flex flex-col overflow-hidden relative" style={{ width: '20.5cm', height: '13cm' }}>

                {/* Header */}
                <div className="bg-white/5 border-b border-white/5 p-6 flex justify-center items-center">
                    <h2 className="text-sm font-black text-white uppercase tracking-[0.3em]">DATOS FACTURACIÓN</h2>
                </div>

                <div className="flex flex-col md:flex-row px-5 py-3 gap-5 bg-[#1f2333] flex-1 overflow-hidden">

                    {/* Left Column: Form Data */}
                    <div className="flex-1 flex flex-col gap-2">

                        {/* NIT & Search */}
                        <div className={`flex items-center bg-black/20 border h-10 transition-all overflow-hidden ${activeInput === 'nit' ? 'border-white/40 ring-1 ring-white/10' : 'border-white/5'}`}>
                            <div className="w-10 h-full flex items-center justify-center text-gray-400 border-r border-gray-700/50">
                                <Grid size={18} />
                            </div>
                            <input
                                ref={nitInputRef}
                                type="text"
                                value={customer.nit}
                                onFocus={() => setActiveInput('nit')}
                                onChange={handleChange}
                                onKeyDown={(e) => e.key === 'Enter' && handleNitLookup(customer.nit)}
                                className="flex-1 bg-transparent px-3 text-base font-medium text-white outline-none placeholder:text-gray-600 font-mono"
                                placeholder=""
                                data-no-keyboard
                            />
                            {loading ? (
                                <div className="px-3"><Loader2 className="animate-spin text-white" size={18} /></div>
                            ) : (
                                <button
                                    onClick={() => handleNitLookup(customer.nit)}
                                    className="h-full px-3 text-gray-400 hover:text-white border-l border-gray-700/50 hover:bg-white/5 transition-colors"
                                >
                                    <Search size={18} />
                                </button>
                            )}
                        </div>

                        {/* Name */}
                        <div className={`flex items-center bg-black/20 border h-10 transition-all overflow-hidden ${activeInput === 'name' ? 'border-white/40 ring-1 ring-white/10' : 'border-white/5'}`}>
                            <div className="w-10 h-full flex items-center justify-center text-gray-400 border-r border-gray-700/50">
                                <User size={18} />
                            </div>
                            <input
                                type="text"
                                value={customer.name}
                                onFocus={() => setActiveInput('name')}
                                onChange={handleChange}
                                className="flex-1 bg-transparent px-3 text-[10px] font-bold outline-none text-white placeholder:text-gray-600 tracking-tight"
                                placeholder="NOMBRE DEL CLIENTE"
                                data-no-keyboard
                            />
                        </div>

                        {/* Address */}
                        <div className={`flex items-center bg-black/20 border h-10 transition-all overflow-hidden ${activeInput === 'address' ? 'border-white/40 ring-1 ring-white/10' : 'border-white/5'}`}>
                            <div className="w-10 h-full flex items-center justify-center text-gray-400 border-r border-gray-700/50">
                                <MapPin size={18} />
                            </div>
                            <input
                                type="text"
                                value={customer.address}
                                onFocus={() => setActiveInput('address')}
                                onChange={handleChange}
                                className="flex-1 bg-transparent px-3 text-[10px] font-bold outline-none text-white placeholder:text-gray-600 tracking-tight"
                                placeholder="DIRECCIÓN"
                                data-no-keyboard
                            />
                        </div>

                        {/* Phone */}
                        <div className={`flex items-center bg-black/20 border h-10 transition-all overflow-hidden ${activeInput === 'phone' ? 'border-white/40 ring-1 ring-white/10' : 'border-white/5'}`}>
                            <div className="w-10 h-full flex items-center justify-center text-gray-400 border-r border-gray-700/50">
                                <Smartphone size={18} />
                            </div>
                            <input
                                type="text"
                                value={customer.phone}
                                onFocus={() => setActiveInput('phone')}
                                onChange={handleChange}
                                className="flex-1 bg-transparent px-3 text-base font-medium text-white outline-none placeholder:text-gray-600"
                                placeholder="TELÉFONO"
                                data-no-keyboard
                            />
                        </div>

                        {/* Quick Action Buttons Row */}
                        <div className="flex gap-2 mt-1">
                            <button 
                                onClick={handleContingency} 
                                className={`h-9 px-2 border text-[10px] font-bold uppercase tracking-wider transition-all flex-1 ${
                                    customer.is_contingency
                                        ? 'bg-orange-600 border-orange-400 text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                                        : 'bg-[#181b25] border-gray-700 text-gray-400 hover:bg-[#252a36] hover:text-white'
                                }`}
                            >
                                F10
                            </button>
                            <button 
                                onClick={handlePorConsumo} 
                                className={`h-9 px-2 border text-[10px] font-bold uppercase tracking-wider transition-all flex-1 ${
                                    customer.is_por_consumo
                                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                                        : 'bg-[#181b25] border-gray-700 text-gray-400 hover:bg-[#252a36] hover:text-white'
                                }`}
                            >
                                POR CONSUMO
                            </button>
                            <button 
                                onClick={handlePorAlmuerzo} 
                                className={`h-9 px-2 border text-[10px] font-bold uppercase tracking-wider transition-all flex-1 ${
                                    customer.is_por_almuerzo
                                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                                        : 'bg-[#181b25] border-gray-700 text-gray-400 hover:bg-[#252a36] hover:text-white'
                                }`}
                            >
                                Por Almuerzo
                            </button>
                        </div>

                    </div>

                    {/* Right Column: Compact Keypad */}
                    <div className="w-full md:w-[300px] bg-[#1a1e29] p-3 border border-gray-800 flex flex-col shadow-inner">

                        {/* Display - Small - STRICTLY NIT */}
                        <div className="bg-black/40 border border-white/5 text-center h-12 flex flex-col justify-center px-4 mb-3 relative overflow-hidden">
                            {activeInput === 'nit' && keypadNit && (
                                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-0.5">
                                    INGRESANDO NIT...
                                </span>
                            )}
                            <div className="flex justify-center items-center overflow-hidden">
                                <span className="text-2xl font-bold text-white truncate tracking-wide">
                                    {activeInput === 'nit' ? keypadNit : ''}
                                    <span className="animate-fast-blink text-white/40 font-light ml-0.5">|</span>
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 flex-1">
                            {/* Num Pad */}
                            {/* Row 1 */}
                            {['7', '8', '9'].map(num => (
                                <button key={num} onClick={() => handleKeypadClick(num)} className="h-14 bg-[#232836] hover:bg-[#2d3345] active:bg-[#384055] text-lg font-bold text-white transition-all shadow-sm border border-gray-700/30">
                                    {num}
                                </button>
                            ))}
                            {/* Delete Button - Row 1 & 2, Col 4 */}
                            <button onClick={handleBackspace} className="row-span-2 h-full bg-white/5 hover:bg-white/10 active:scale-95 text-white/50 transition-all shadow-sm border border-white/5 flex items-center justify-center">
                                <Delete size={24} />
                            </button>

                            {/* Row 2 */}
                            {['4', '5', '6'].map(num => (
                                <button key={num} onClick={() => handleKeypadClick(num)} className="h-14 bg-[#232836] hover:bg-[#2d3345] active:bg-[#384055] text-lg font-bold text-white transition-all shadow-sm border border-gray-700/30">
                                    {num}
                                </button>
                            ))}

                            {/* Row 3 */}
                            {['1', '2', '3'].map(num => (
                                <button key={num} onClick={() => handleKeypadClick(num)} className="h-14 bg-[#232836] hover:bg-[#2d3345] active:bg-[#384055] text-lg font-bold text-white transition-all shadow-sm border border-gray-700/30">
                                    {num}
                                </button>
                            ))}

                            {/* Enter Button (NIT Lookup ONLY) - Row 3 & 4, Col 4 */}
                            <button
                                onClick={() => handleNitLookup(keypadNit)}
                                disabled={!keypadNit || loading}
                                className="row-span-2 h-full bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/20 font-black shadow-lg transition-all flex items-center justify-center active:scale-95"
                                title="Buscar NIT"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={24} />
                                ) : (
                                    <Search size={28} strokeWidth={3} />
                                )}
                            </button>

                            <button onClick={() => handleKeypadClick('0')} className="col-span-2 h-14 bg-[#232836] hover:bg-[#2d3345] active:bg-[#384055] text-lg font-bold text-white transition-all shadow-sm border border-gray-700/30">
                                0
                            </button>
                            <button onClick={() => handleKeypadClick('K')} className="h-14 bg-[#232836] hover:bg-[#2d3345] active:bg-[#384055] text-lg font-bold text-white transition-all shadow-sm border border-gray-700/30">
                                K
                            </button>
                        </div>

                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3 bg-white/5 border-t border-white/5 flex gap-4 justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-8 h-10 border border-white/10 text-white/40 font-black uppercase hover:bg-white/5 active:scale-95 transition-all text-xs tracking-[0.2em]"
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || (!!customer.nit && customer.nit !== 'CF' && !customer.name)}
                        className="px-10 h-10 bg-white text-black font-black uppercase shadow-xl transition-all active:scale-95 text-xs tracking-[0.2em] flex items-center gap-2 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/20"
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
