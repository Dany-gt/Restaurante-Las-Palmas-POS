import React, { useState, useEffect, useRef } from 'react';
import { Lock, Loader2, X } from 'lucide-react';
import { registrarAuditoria } from '../services/auditService';

interface PinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (user: any, pin: string) => void;
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
                onSuccess(result.user, pin);
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6 touch-none">
            <div className="w-full max-w-[300px] bg-[#1e1f2b] rounded-lg p-6 border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="flex justify-end mb-2">
                    <button onClick={onClose} className="p-1.5 text-white/30 hover:text-white transition-colors bg-white/5 rounded-md hover:bg-white/10">
                        <X size={14} />
                    </button>
                </div>

                <div className="flex flex-col items-center mb-6 relative z-10">
                    <span className="text-[10px] font-black text-gray-500 tracking-[0.2em] uppercase mb-2 opacity-80">{title}</span>
                    <h3 className="text-xs font-bold text-gray-400 text-center uppercase tracking-widest mb-6 px-4 leading-relaxed">{subtitle}</h3>

                    {error && (
                        <div className="absolute top-0 translate-y-16 w-full flex justify-center z-50">
                            <span className="text-[9px] font-black text-white bg-indigo-600 px-3 py-1.5 rounded-md shadow-lg">
                                {error}
                            </span>
                        </div>
                    )}

                    <div className="flex gap-4 mb-2">
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className={`
                                    w-3 h-3 border border-gray-700 transition-all duration-200
                                    ${pin.length > i
                                        ? 'bg-indigo-500 border-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                                        : 'bg-black/40'
                                    }
                                `}
                            />
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 relative z-10 place-items-center">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((key) => (
                        <button
                            key={key}
                            onClick={() => handlePinInput(key.toString())}
                            disabled={loading}
                            className="
                                group relative w-16 h-14 rounded-md text-xl font-bold text-white/90 
                                transition-all duration-100 active:scale-95 flex items-center justify-center 
                                bg-white/5 hover:bg-white/10 border border-white/5
                                shadow-lg disabled:opacity-50 disabled:pointer-events-none
                            "
                        >
                            <span className="relative z-10">{key}</span>
                        </button>
                    ))}

                    <button
                        onClick={() => setPin('')}
                        disabled={loading}
                        className="
                            group relative w-16 h-14 rounded-md text-[10px] font-black text-gray-400 
                            transition-all duration-100 active:scale-95 flex items-center justify-center 
                            bg-white/5 hover:bg-white/10 border border-white/5
                            disabled:opacity-50 disabled:pointer-events-none
                        "
                    >
                        BORRAR
                    </button>

                    <button
                        onClick={() => handlePinInput('0')}
                        disabled={loading}
                        className="
                            group relative w-16 h-14 rounded-md text-xl font-bold text-white/90 
                            transition-all duration-100 active:scale-95 flex items-center justify-center 
                            bg-white/5 hover:bg-white/10 border border-white/5
                            shadow-lg disabled:opacity-50 disabled:pointer-events-none
                        "
                    >
                        0
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="
                            group relative w-16 h-14 rounded-md text-sm font-black text-white 
                            transition-all duration-100 active:scale-95 flex items-center justify-center 
                            bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/20 
                            shadow-lg disabled:opacity-50 disabled:pointer-events-none
                        "
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
};
