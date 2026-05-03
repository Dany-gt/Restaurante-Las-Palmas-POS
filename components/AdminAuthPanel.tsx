import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { CheckCircle2, XCircle, Clock, ArrowLeft, LogOut, ShieldAlert, RefreshCw } from 'lucide-react';
import { User } from '../types';

interface AdminAuthPanelProps {
    currentUser: User | null;
    onExit: () => void;
}

export const AdminAuthPanel: React.FC<AdminAuthPanelProps> = ({ currentUser, onExit }) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();

        // Request browser notification permissions
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        // Subscribe to real-time changes for new requests
        const channel = supabase.channel('admin_auth_channel_panel')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'admin_auth_requests'
            }, (payload) => {
                fetchRequests(); // Reload list on any change
                
                // Optional: Play a sound if it's a new INSERT
                if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
                    playNotificationSound();
                    
                    // Native notification if permission granted
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("Nueva Solicitud de Autorización", {
                            body: `${payload.new.metadata?.item_name || 'Acción'} - Mesa ${payload.new.metadata?.table_number || '?'}`,
                            icon: '/icon.png',
                            badge: '/icon.png',
                            vibrate: [200, 100, 200]
                        });
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Fallback polling: fetch requests every 5 seconds in case realtime isn't enabled
    useEffect(() => {
        fetchRequests(); // Carga inicial
        
        // Polling de seguridad (5s)
        const intervalId = setInterval(fetchRequests, 5000);
        
        // Suscripción Real-time para inmediatez
        const channel = supabase
            .channel('admin_auth_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'admin_auth_requests' },
                () => {
                    fetchRequests();
                }
            )
            .subscribe();

        return () => {
            clearInterval(intervalId);
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_auth_requests')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error fetching auth requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/sounds/notification.mp3'); // Fallback if no specific sound exists
            audio.play().catch(() => {});
        } catch (e) {}
    };

    const handleAction = async (id: string, newStatus: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('admin_auth_requests')
                .update({ 
                    status: newStatus,
                    resolved_by: currentUser?.id,
                    resolved_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            // The list will update automatically via real-time subscription
            // But we can optimistically remove it here
            setRequests(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            console.error(`Error marking request as ${newStatus}:`, error);
            alert('Error procesando la solicitud.');
        }
    };

    // Format date nicely
    const formatTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Hace un momento';
        if (minutes === 1) return 'Hace 1 minuto';
        return `Hace ${minutes} minutos`;
    };

    return (
        <div className="fixed inset-0 bg-[#0f1115] text-white flex flex-col font-sans overflow-hidden z-50">
            {/* Header */}
            <header className="h-14 bg-[#16191f] border-b border-white/5 flex items-center justify-between px-5 shrink-0 shadow-md relative z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onExit} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex flex-col">
                        <span className="text-[12px] font-black tracking-wider text-white">AUTORIZACIONES</span>
                        <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest">En Tiempo Real</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={fetchRequests} 
                        className={`p-2 rounded-lg transition-all ${loading ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">En Línea</span>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gradient-to-b from-[#0f1115] to-[#0a0b0d]">
                <div className="max-w-xl mx-auto space-y-4">
                    
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-indigo-400">
                            <Clock className="animate-spin mb-4" size={32} />
                            <span className="font-bold tracking-widest text-xs">CARGANDO SOLICITUDES...</span>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <ShieldAlert size={48} className="mb-4 text-gray-600" />
                            <h3 className="text-xl font-black text-gray-400">NO HAY SOLICITUDES PENDIENTES</h3>
                            <p className="text-sm text-gray-500 text-center mt-2">Todo está bajo control. Las nuevas solicitudes de autorización aparecerán aquí mágicamente.</p>
                        </div>
                    ) : (
                        requests.map((req) => (
                            <div key={req.id} className="bg-[#1e212b] border border-white/10 rounded-xl p-4 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                                {/* Glassmorphism gradient blur behind the card content */}
                                <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
                                
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-col gap-1 w-full pr-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                                                    {req.action_type ? req.action_type.replace(/_/g, ' ') : 'SOLICITUD'}
                                                </span>
                                                {req.metadata?.table_number && (
                                                    <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                                                        MESA {req.metadata.table_number}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-[14px] font-semibold text-white leading-snug">
                                                 {req.action_details?.includes('Desconocido') || req.action_details?.includes('Producto (Cant')
                                                     ? `${req.action_type === 'EDIT_ITEM' ? 'Editar' : 'Eliminar'}: ${req.metadata?.item_name || 'Producto'} (Cant: ${req.metadata?.quantity || 1}) - Mesa ${req.metadata?.table_number || '?'}`
                                                     : (req.action_details || 'Detalles no disponibles')}
                                             </h4>
                                            {req.metadata?.reason && (
                                                <div className="mt-2 bg-black/20 rounded-lg p-2.5 border border-white/5 relative">
                                                    <span className="absolute top-0 left-3 -mt-2 bg-[#1e212b] px-1 text-[8px] text-gray-500 font-bold uppercase tracking-widest">Motivo</span>
                                                    <span className="text-xs text-gray-300 italic leading-tight">"{req.metadata.reason}"</span>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[9px] text-gray-500 font-medium bg-white/5 px-1.5 py-0.5 rounded-md shrink-0">
                                            {formatTimeAgo(req.created_at)}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5 mb-4">
                                        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-gray-300">
                                            {req.profiles?.name?.charAt(0) || req.metadata?.waiter_name?.charAt(0) || '?'}
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            Solicitado por <span className="text-gray-300 font-medium">{req.profiles?.name || req.metadata?.waiter_name || 'Desconocido'}</span>
                                        </span>
                                    </div>

                                    <div className="flex gap-2.5 mt-2">
                                        <button
                                            onClick={() => handleAction(req.id, 'rejected')}
                                            className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg font-bold text-xs transition-all active:scale-95 flex justify-center items-center gap-1.5 border border-red-500/20"
                                        >
                                            <XCircle size={16} />
                                            Rechazar
                                        </button>
                                        <button
                                            onClick={() => handleAction(req.id, 'approved')}
                                            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg font-bold text-xs transition-all active:scale-95 flex justify-center items-center gap-1.5 shadow-[0_4px_14px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
                                        >
                                            <CheckCircle2 size={16} />
                                            Aprobar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
