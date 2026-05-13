import React, { useState, useEffect, useRef } from 'react';
import { Lock, Loader2, X, Send, CheckCircle2, XCircle } from 'lucide-react';
import { registrarAuditoria } from '../services/auditService';
import { supabase } from '../supabase';

interface PinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (user: any, pin: string) => void;
    title?: string;
    subtitle?: string;
    requiredRole?: string;
    validateFn: (pin: string, role?: string) => Promise<{ valid: boolean; user?: any }>;
    remoteAuthEnabled?: boolean;
    authPayload?: {
        action_type: string;
        action_details: string;
        metadata?: any;
    };
}

export const PinModalV2: React.FC<PinModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    title = 'Verificación Requerida',
    subtitle = 'Ingrese su PIN de acceso',
    requiredRole,
    validateFn,
    remoteAuthEnabled = false,
    authPayload
}) => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [remoteStatus, setRemoteStatus] = useState<'idle' | 'waiting' | 'approved' | 'rejected'>('idle');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError('');
            setRemoteStatus('idle');
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

    const handleRemoteAuthRequest = async () => {
        if (!authPayload) return;
        setLoading(true);
        setError('');
        setRemoteStatus('waiting');

        try {
            const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const requesterId = cachedUser?.id;

            const { data, error: insertError } = await supabase
                .from('admin_auth_requests')
                .insert([{
                    requester_id: requesterId,
                    action_type: authPayload.action_type,
                    action_details: authPayload.action_details,
                    metadata: authPayload.metadata,
                    status: 'pending'
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            // Subscribe to the created request
            const channel = supabase.channel(`auth_request_${data.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'admin_auth_requests',
                    filter: `id=eq.${data.id}`
                }, (payload) => {
                    const updatedRequest = payload.new;
                    if (updatedRequest.status === 'approved') {
                        setRemoteStatus('approved');
                        // Create a dummy admin user object for the onSuccess callback
                        const adminUser = { id: updatedRequest.resolved_by, name: 'Aprobación Remota', role: 'ADMIN' };
                        setTimeout(() => {
                            onSuccess(adminUser, 'REMOTE');
                            onClose();
                        }, 1000);
                        supabase.removeChannel(channel);
                    } else if (updatedRequest.status === 'rejected') {
                        setRemoteStatus('rejected');
                        setError('La solicitud fue RECHAZADA por el administrador.');
                        setLoading(false);
                        supabase.removeChannel(channel);
                        setTimeout(() => setRemoteStatus('idle'), 3000);
                    }
                })
                .subscribe();

        } catch (error: any) {
            console.error(error);
            setError('Error al enviar la solicitud: ' + error.message);
            setRemoteStatus('idle');
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
                            <span className="text-[9px] font-black text-white bg-black/80 px-3 py-1.5 rounded-md shadow-lg border border-white/10">
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
                                        ? 'bg-gray-400 border-gray-400 shadow-[0_0_8px_rgba(255,255,255,0.2)]'
                                        : 'bg-black/40'
                                    }
                                `}
                            />
                        ))}
                    </div>
                </div>

                {remoteStatus === 'waiting' ? (
                    <div className="flex flex-col items-center justify-center py-6 relative z-10 animate-in fade-in zoom-in duration-300">
                        <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
                        <h4 className="text-white font-bold text-center">Esperando Aprobación</h4>
                        <p className="text-gray-400 text-xs text-center mt-2 px-4">
                            Se ha enviado una notificación al administrador. La pantalla se desbloqueará sola.
                        </p>
                        <button 
                            onClick={() => { setRemoteStatus('idle'); setLoading(false); setError(''); }}
                            className="mt-6 text-xs text-gray-500 hover:text-white border border-gray-700 rounded-md px-4 py-2 transition-colors"
                        >
                            Cancelar Solicitud
                        </button>
                    </div>
                ) : remoteStatus === 'approved' ? (
                    <div className="flex flex-col items-center justify-center py-8 relative z-10 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-16 h-16 text-white mb-4" />
                        <h4 className="text-white font-bold text-center text-lg">¡APROBADO!</h4>
                    </div>
                ) : remoteStatus === 'rejected' ? (
                    <div className="flex flex-col items-center justify-center py-8 relative z-10 animate-in fade-in zoom-in duration-300">
                        <XCircle className="w-16 h-16 text-white/40 mb-4" />
                        <h4 className="text-white font-bold text-center text-lg">RECHAZADO</h4>
                    </div>
                ) : (
                    <>
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
                            bg-white hover:bg-white/90 border border-white 
                            shadow-lg disabled:opacity-50 disabled:pointer-events-none
                        "
                    >
                        {loading ? <Loader2 className="animate-spin text-black" size={20} /> : <span className="text-black">OK</span>}
                    </button>
                </div>

                {remoteAuthEnabled && authPayload && (
                    <div className="mt-4 pt-4 border-t border-white/5 relative z-10">
                        <button
                            onClick={handleRemoteAuthRequest}
                            disabled={loading}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                            <Send size={14} />
                            Solicitar Autorización Remota
                        </button>
                    </div>
                )}
                </>
                )}
            </div>
        </div>
    );
};
