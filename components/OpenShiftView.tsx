import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { User } from '../types';
import { ArrowLeft, Delete, Check } from 'lucide-react';
import { activityLogService } from '../services/ActivityLogService';
import { generateUUID } from '../utils/uuid';

interface OpenShiftViewProps {
    currentUser: User;
    onShiftOpened: () => void;
    onBack?: () => void;
    onNavigate?: (view: string) => void;
}

export const OpenShiftView: React.FC<OpenShiftViewProps> = ({ currentUser, onShiftOpened, onBack, onNavigate }) => {
    const [amount, setAmount] = useState('0.00');
    const [cashRegisters, setCashRegisters] = useState<any[]>([]);
    const [selectedRegisterId, setSelectedRegisterId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [shiftCount, setShiftCount] = useState(1);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            // Fetch cash registers
            const { data: registers } = await supabase.from('cash_registers').select('*').eq('is_active', true);
            if (registers && registers.length > 0) {
                setCashRegisters(registers);
                setSelectedRegisterId(registers[0].id);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (!selectedRegisterId) return;

        const calculateShiftCount = async () => {
            // Calculate shift number (daily sequence for this register today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { count } = await supabase
                .from('shifts')
                .select('*', { count: 'exact', head: true })
                .eq('cash_register_id', selectedRegisterId)
                .gte('start_time', today.toISOString());

            setShiftCount((count || 0) + 1);
        };
        calculateShiftCount();
    }, [selectedRegisterId]);

    const handleKeyPad = (key: string) => {
        setAmount(prev => {
            if (key === 'BACKSPACE') return prev.length > 1 ? prev.slice(0, -1) : '0';
            if (key === 'DOT') return prev.includes('.') ? prev : prev + '.';

            // Handle logical input for currency
            // If currently 0.00, replace
            let newVal = prev === '0.00' || prev === '0' ? key : prev + key;
            return newVal;
        });
    };

    // Helper to format input as float for display if needed, but here we construct string directly
    // Let's refine the input logic to behave like a standard POS amount input if simpler
    // For now simple string concatenation is fine as long as we validate.

    const handleOpenShift = async () => {
        if (!selectedRegisterId) return alert('Seleccione una caja');

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount)) return;

        setLoading(true);

        const shiftId = generateUUID();
        const shiftData = {
            id: shiftId,
            cash_register_id: selectedRegisterId,
            cashier_id: currentUser.id,
            start_amount: numericAmount,
            status: 'OPEN',
            start_time: new Date().toISOString(),
            shift_number: shiftCount
        };

        try {
            // Recalculate shift number immediately before inserting to avoid race conditions (online)
            if (navigator.onLine) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const { count } = await supabase
                    .from('shifts')
                    .select('*', { count: 'exact', head: true })
                    .eq('cash_register_id', selectedRegisterId)
                    .gte('start_time', today.toISOString());

                shiftData.shift_number = (count || 0) + 1;
            } else {
                await import('../services/OfflineDB').then(m => m.offlineDB.saveRecord('CASH_INIT', shiftData));
                console.log('📦 Turno abierto offline (IndexedDB):', shiftId);
                setShowSuccessModal(true);
                window.dispatchEvent(new CustomEvent('offline-sync-trigger'));
                return;
            }

            const { error } = await supabase.from('shifts').insert(shiftData);
            if (error) throw error;

            // Also update the cash register status and balance
            await supabase.from('cash_registers').update({
                status: 'open',
                current_balance: numericAmount
            }).eq('id', selectedRegisterId);

            // LOG: Shift Opened
            activityLogService.log({
                user: currentUser,
                module: 'CAJA',
                action: 'Apertura de Turno',
                details: {
                    shiftId: shiftId,
                    registerId: selectedRegisterId,
                    registerName: cashRegisters.find(r => r.id === selectedRegisterId)?.name,
                    startAmount: numericAmount
                }
            });

            setShowSuccessModal(true);
        } catch (err: any) {
            console.error(err);
            // Fallback to offline
            await import('../services/OfflineDB').then(m => m.offlineDB.saveRecord('CASH_INIT', shiftData));
            alert('⚠️ Error de conexión: El turno se inició localmente y se sincronizará luego.');
            onShiftOpened();
            window.dispatchEvent(new CustomEvent('offline-sync-trigger'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#16191f] text-white z-50 flex flex-col font-sans">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                        <ArrowLeft size={20} className="text-gray-400" />
                    </button>
                    <span className="text-xs font-black tracking-[0.2em] text-gray-500 uppercase">RESTAURANTE LAS PALMAS POS</span>
                </div>
                <div className="flex items-center gap-6">
                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
                        0 Ordenes Asignadas
                    </span>
                    <div className="text-right">
                        <div className="text-sm font-black uppercase tracking-tight">{currentUser.name || 'CAJERO'}</div>
                        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Abrir Turno</div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 flex items-center justify-center p-8 gap-20">

                {/* Left Form */}
                <div className="w-[340px] flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-center py-2 bg-[#2b2f3a] rounded-t-lg text-xs font-bold text-gray-400 uppercase tracking-widest">Caja</label>
                        <select
                            value={selectedRegisterId}
                            onChange={(e) => setSelectedRegisterId(e.target.value)}
                            className="bg-[#16191f] border-none text-center text-lg font-bold text-white py-3 border-b-2 border-white/10 focus:ring-0 rounded-b-lg"
                        >
                            {cashRegisters.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-center py-2 bg-[#2b2f3a] rounded-t-lg text-xs font-bold text-gray-400 uppercase tracking-widest">Turno</label>
                        <div className="bg-transparent text-center text-lg font-bold text-white py-3 border-b border-white/10 rounded-b-lg">
                            {shiftCount}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-center py-2 bg-[#2b2f3a] rounded-t-lg text-xs font-bold text-gray-400 uppercase tracking-widest">Monto Inicial</label>
                        <div className="bg-transparent text-center text-xl font-black text-white py-3 border-b border-white/10 rounded-b-lg">
                            Q{parseFloat(amount).toFixed(2)}
                        </div>
                    </div>

                    <button
                        onClick={handleOpenShift}
                        disabled={loading}
                        className="mt-4 bg-[#5c6bff] hover:bg-[#4b59eb] text-white py-4 rounded-xl font-black uppercase tracking-widest  -500/20 active:scale-95 transition-all text-sm"
                    >
                        {loading ? 'Abriendo...' : 'Abrir Turno'}
                    </button>
                    {((currentUser.role === 'ADMIN' || currentUser.originalRole === 'ADMIN') && onNavigate) && (
                        <button
                            onClick={() => onNavigate('ADMIN_PORTAL')}
                            className="mt-2 bg-red-600/20 hover:bg-red-600/30 text-red-500 py-3 rounded-xl font-black uppercase tracking-widest border border-red-500/20 active:scale-95 transition-all text-xs"
                        >
                            Ir a Panel Admin
                        </button>
                    )}
                </div>

                {/* Right Keypad */}
                <div className="w-[340px]">
                    <div className="bg-[#222630] rounded-t-2xl p-6 text-right mb-4 border border-white/5">
                        <span className="text-3xl font-black tracking-tight">Q{parseFloat(amount).toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        <KeypadButton val="7" onClick={() => handleKeyPad('7')} />
                        <KeypadButton val="8" onClick={() => handleKeyPad('8')} />
                        <KeypadButton val="9" onClick={() => handleKeyPad('9')} />
                        <button onClick={() => setAmount('0.00')} className="row-span-1 bg-[#2b2f3a] hover:bg-red-500/20 hover:text-red-400 text-gray-400 rounded-xl flex items-center justify-center transition-all border border-white/5">
                            <Delete size={20} />
                        </button>

                        <KeypadButton val="4" onClick={() => handleKeyPad('4')} />
                        <KeypadButton val="5" onClick={() => handleKeyPad('5')} />
                        <KeypadButton val="6" onClick={() => handleKeyPad('6')} />
                        <button onClick={() => handleKeyPad('BACKSPACE')} className="bg-[#2b2f3a] hover:bg-white/10 text-gray-400 rounded-xl flex items-center justify-center transition-all border border-white/5">
                            <span className="text-xs font-black">DEL</span>
                        </button>


                        <KeypadButton val="1" onClick={() => handleKeyPad('1')} />
                        <KeypadButton val="2" onClick={() => handleKeyPad('2')} />
                        <KeypadButton val="3" onClick={() => handleKeyPad('3')} />
                        <button onClick={handleOpenShift} className="row-span-2 bg-[#2b2f3a] hover:bg-emerald-500/20 hover:text-emerald-400 text-gray-400 rounded-xl flex items-center justify-center transition-all border border-white/5">
                            <Check size={24} />
                        </button>

                        <KeypadButton val="0" onClick={() => handleKeyPad('0')} className="col-span-2" />
                        <KeypadButton val="." onClick={() => handleKeyPad('DOT')} />
                    </div>
                </div>

            </main>

            {/* MODAL DE ÉXITO ESTILO LAS PALMAS */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-fade-in p-4">
                    <div className="w-full max-w-[380px] bg-[#2d2e3d] rounded-2xl border border-white/10  p-8 flex flex-col items-center text-center animate-zoom-in">
                        <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 mb-6 border border-indigo-500/20">
                            <Check size={32} strokeWidth={3} />
                        </div>
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">RESTAURANTE LAS PALMAS POS</h3>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-8">Turno aperturado con éxito.</p>

                        <button
                            onClick={() => onShiftOpened()}
                            className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.3em] rounded-xl  -500/20 active:scale-95 transition-all text-xs"
                        >
                            ACEPTAR
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const KeypadButton = ({ val, onClick, className = '' }: { val: string, onClick: () => void, className?: string }) => (
    <button
        onClick={onClick}
        className={`h-16 bg-[#222630] hover:bg-[#2b2f3a] rounded-xl text-xl font-bold transition-all border border-white/5 active:scale-95 ${className}`}
    >
        {val}
    </button>
);
