import React, { useState, useEffect, useRef } from 'react';
import { Lock, Loader2, X } from 'lucide-react';
import { registrarAuditoria } from '../services/auditService';

interface PinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (user: any) => void;
    title?: string;
    subtitle?: string;
    requiredRole?: string;
    validateFn: (pin: string, role?: string) => Promise<{ valid: boolean; user?: any }>;
}

export const PinModalV2: React.FC<PinModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    title = 'Verificación Requerida',
    subtitle = 'Ingrese su PIN de acceso',
    requiredRole,
    validateFn
}) => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key >= '0' && e.key <= '9' && pin.length < 4) {
                setPin(prev => prev + e.key);
            } else if (e.key === 'Backspace') {
                setPin(prev => prev.slice(0, -1));
            } else if (e.key === 'Enter' && pin.length === 4) {
                handleSubmit();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, pin]);

    const handleSubmit = async () => {
        if (pin.length !== 4) return;

        setLoading(true);
        setError('');

        try {
            const result = await validateFn(pin, requiredRole);

            if (result.valid && result.user) {
                onSuccess(result.user);
                onClose();
            } else {
                setError('PIN incorrecto o usuario no autorizado');
                
                // Logging: Failed PIN Attempt
                await registrarAuditoria({
                    modulo: 'SEGURIDAD',
                    accion: 'AUTH_FAILED',
                    accion_descripcion: `Intento fallido de PIN para ${title}`,
                    entidad_id: 'PIN_VERIFICATION',
                    entidad_tipo: 'seguridad',
                    entidad_nombre: 'Verificación PIN',
                    metadata: {
                        modalTitle: title,
                        modalSubtitle: subtitle,
                        requiredRole: requiredRole,
                        failureReason: 'PIN incorrecto o usuario no autorizado'
                    }
                }, { id: 'unknown', name: 'Intento Fallido', role: 'UNKNOWN' } as any);
                
                setPin('');
            }
        } catch (error: any) {
            setError('Error de validación');
            
            // Logging: Validation Error
            await registrarAuditoria({
                modulo: 'SEGURIDAD',
                accion: 'AUTH_ERROR',
                accion_descripcion: `Error técnico en validación de PIN: ${error.message}`,
                entidad_id: 'PIN_VERIFICATION_ERROR',
                entidad_tipo: 'seguridad',
                entidad_nombre: 'Error PIN',
                metadata: {
                    error: error.message,
                    modalTitle: title,
                    failureReason: error.message
                }
            }, { id: 'system', name: 'Sistema', role: 'SYSTEM' } as any);

            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const handlePinInput = (num: string) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6 animate-fade-in touch-none">
            {/* Decorative elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gray-500/10 rounded-full blur-[80px] pointer-events-none"></div>

            <div className="w-full max-w-[280px] bg-[#323544]/95 backdrop-blur-2xl rounded-[2rem] p-6 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)] relative overflow-hidden ring-1 ring-white/5">
                {/* Top Shine */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                <div className="flex justify-end mb-2">
                    <button onClick={onClose} className="p-1.5 text-white/30 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10">
                        <X size={14} />
                    </button>
                </div>

                <div className="flex flex-col items-center mb-6 relative z-10">
                    <span className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase mb-3 opacity-80">{title}</span>
                    <h3 className="text-xs font-medium text-gray-400 text-center uppercase tracking-widest mb-4 px-4 leading-relaxed">{subtitle}</h3>

                    {error && (
                        <div className="absolute top-0 translate-y-16 w-full flex justify-center z-50">
                            <span className="text-[9px] font-bold text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-1 rounded-full animate-shake backdrop-blur-md">
                                {error}
                            </span>
                        </div>
                    )}

                    <div className="flex gap-3 mb-2">
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className={`
                                    w-3 h-3 rounded-full border border-gray-500/30 transition-all duration-300
                                    ${pin.length > i
                                        ? 'bg-gray-200 scale-110 shadow-[0_0_10px_rgba(255,255,255,0.4)] border-gray-200'
                                        : 'bg-white/5 scale-100'
                                    }
                                `}
                            />
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3 relative z-10 place-items-center">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((key) => (
                        <button
                            key={key}
                            onClick={() => handlePinInput(key.toString())}
                            disabled={loading}
                            className="
                                group relative w-12 h-12 rounded-full text-lg font-medium text-white/90 
                                transition-all duration-200 active:scale-90 flex items-center justify-center 
                                bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10
                                shadow-lg shadow-black/20 disabled:opacity-50 disabled:pointer-events-none
                            "
                        >
                            <span className="relative z-10">{key}</span>
                        </button>
                    ))}

                    <button
                        onClick={() => setPin('')}
                        disabled={loading}
                        className="
                            group relative w-12 h-12 rounded-full text-[9px] font-bold text-red-400/90 
                            transition-all duration-200 active:scale-90 flex items-center justify-center 
                            bg-red-500/[0.05] hover:bg-red-500/[0.1] border border-red-500/10 hover:border-red-500/20
                            disabled:opacity-50 disabled:pointer-events-none
                        "
                    >
                        CLEAR
                    </button>

                    <button
                        onClick={() => handlePinInput('0')}
                        disabled={loading}
                        className="
                            group relative w-12 h-12 rounded-full text-lg font-medium text-white/90 
                            transition-all duration-200 active:scale-90 flex items-center justify-center 
                            bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10
                            shadow-lg shadow-black/20 disabled:opacity-50 disabled:pointer-events-none
                        "
                    >
                        0
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="
                            group relative w-12 h-12 rounded-full text-base font-bold text-white 
                            transition-all duration-200 active:scale-90 flex items-center justify-center 
                            bg-[#2563EB] hover:bg-[#1d4ed8] border border-blue-400/20 
                            shadow-[0_0_15px_-5px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:pointer-events-none
                        "
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
};
