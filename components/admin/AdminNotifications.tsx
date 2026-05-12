import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase';
import { 
    Bell, BellOff, X, AlertTriangle, Trash2, 
    ChevronRight, CheckCircle, Info, ExternalLink 
} from 'lucide-react';
import { activityLogService } from '../../services/ActivityLogService';

interface Notification {
    id: string;
    timestamp: string;
    usuario_nombre: string;
    accion: string;
    accion_descripcion: string;
    modulo: string;
    metadata: any;
    isRead: boolean;
}

interface AdminNotificationsProps {
    currentUser: any;
    onViewAll?: () => void;
}

export const AdminNotifications: React.FC<AdminNotificationsProps> = ({ currentUser, onViewAll }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Cargar historial inicial de anulaciones críticas (últimas 24h)
        const fetchRecentVoids = async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Solo mostrar alertas de hoy

            const { data, error } = await supabase
                .from('activity_log_detailed')
                .select('*')
                .or('accion.eq.ITEM_ANULADO,accion.eq.ORDEN_ANULADA,accion.eq.CUENTA_ELIMINADA,accion.eq.FACTURA_ANULADA')
                .gte('timestamp', today.toISOString())
                .order('timestamp', { ascending: false })
                .limit(20);

            if (!error && data) {
                const formatted = data.map((log: any) => ({
                    id: log.id,
                    timestamp: log.timestamp,
                    usuario_nombre: log.usuario_nombre,
                    accion: log.accion,
                    accion_descripcion: log.accion_descripcion,
                    modulo: log.modulo,
                    metadata: log.metadata || {},
                    isRead: true // Historial inicial marcado como leído
                }));
                setNotifications(formatted);
            }
        };

        fetchRecentVoids();

        // Suscribirse a tiempo real
        const channel = supabase
            .channel('admin_notifications')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'activity_log_detailed',
                filter: `accion=in.(ITEM_ANULADO,ORDEN_ANULADA,CUENTA_ELIMINADA,FACTURA_ANULADA)`
            }, (payload) => {
                const newLog = payload.new as any;
                const newNotif: Notification = {
                    id: newLog.id,
                    timestamp: newLog.timestamp,
                    usuario_nombre: newLog.usuario_nombre,
                    accion: newLog.accion,
                    accion_descripcion: newLog.accion_descripcion,
                    modulo: newLog.modulo,
                    metadata: newLog.metadata || {},
                    isRead: false
                };

                setNotifications(prev => [newNotif, ...prev].slice(0, 50));
                setHasUnread(true);
                playAlertSound();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const playAlertSound = () => {
        try {
            if (!audioRef.current) {
                audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            }
            audioRef.current.play().catch(e => console.log('Audio play blocked by browser'));
        } catch (e) {}
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setHasUnread(false);
    };

    const getIcon = (accion: string) => {
        if (accion.includes('ANULADA')) return <AlertTriangle size={16} className="text-amber-500" />;
        if (accion.includes('ELIMINADA')) return <Trash2 size={16} className="text-red-500" />;
        return <Info size={16} className="text-blue-500" />;
    };

    const getEntityBadge = (accion: string) => {
        if (accion.includes('ITEM')) return <span className="bg-blue-500/20 text-blue-400 text-[7px] px-1 rounded font-black border border-blue-500/20">ÍTEM</span>;
        if (accion.includes('ORDEN')) return <span className="bg-amber-500/20 text-amber-400 text-[7px] px-1 rounded font-black border border-amber-500/20">ORDEN</span>;
        if (accion.includes('CUENTA')) return <span className="bg-red-500/20 text-red-400 text-[7px] px-1 rounded font-black border border-red-500/20">CUENTA</span>;
        return null;
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen && hasUnread) markAllAsRead();
                }}
                className={`relative p-2 rounded-lg transition-all ${
                    isOpen ? 'bg-white/10 text-white' : 'text-indigo-400/70 hover:text-indigo-400 hover:bg-white/5'
                }`}
            >
                <Bell size={20} />
                {hasUnread && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-[#16191f] rounded-full animate-pulse" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-[#1e212b] shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl border border-white/10 z-[100] overflow-hidden flex flex-col max-h-[600px] animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between bg-black/20">
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Alertas Críticas</h3>
                            <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">Auditoría en Vivo</span>
                        </div>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter bg-white/5 px-2 py-0.5 rounded">{notifications.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-10 text-center py-20">
                                <BellOff size={40} className="mx-auto text-gray-700 mb-4 opacity-20" />
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Sin alertas críticas hoy</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {notifications.map(n => (
                                    <div key={n.id} className={`p-4 transition-all hover:bg-white/5 ${!n.isRead ? 'bg-indigo-500/5' : ''}`}>
                                        <div className="flex gap-4">
                                            <div className="mt-1 shrink-0 p-2 bg-black/20 rounded-lg">
                                                {getIcon(n.accion)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        {getEntityBadge(n.accion)}
                                                        <span className="text-[10px] font-black text-white truncate uppercase tracking-wider">
                                                            {n.accion_descripcion}
                                                        </span>
                                                    </div>
                                                    <span className="text-[9px] font-bold text-gray-500 shrink-0 ml-2 bg-black/20 px-1.5 py-0.5 rounded">
                                                        {formatDate(n.timestamp)}
                                                    </span>
                                                </div>

                                                {/* Detalle de Auditoría Robusto */}
                                                <div className="grid grid-cols-2 gap-2 mb-3">
                                                    {(n.metadata?.productName || n.metadata?.product_name || n.metadata?.item_name) && (
                                                        <div className="bg-white/5 p-1.5 rounded border border-white/5">
                                                            <span className="block text-[7px] text-gray-500 uppercase font-black tracking-widest leading-none mb-1">Producto</span>
                                                            <span className="text-[9px] font-bold text-gray-300 truncate block uppercase">
                                                                {n.metadata?.productName || n.metadata?.product_name || n.metadata?.item_name}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {n.metadata?.cuenta && (
                                                        <div className="bg-white/5 p-1.5 rounded border border-white/5">
                                                            <span className="block text-[7px] text-gray-500 uppercase font-black tracking-widest leading-none mb-1">Cuenta</span>
                                                            <span className="text-[9px] font-bold text-gray-300 truncate block uppercase">
                                                                {n.metadata?.cuenta}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {(n.metadata?.order_number || n.metadata?.numero_orden || n.metadata?.orderId || n.metadata?.order_id) && (
                                                        <div className="bg-white/5 p-1.5 rounded border border-white/5">
                                                            <span className="block text-[7px] text-gray-500 uppercase font-black tracking-widest leading-none mb-1">Orden / ID</span>
                                                            <span className="text-[9px] font-bold text-gray-300 block uppercase">
                                                                #{n.metadata?.order_number || n.metadata?.numero_orden || (n.metadata?.orderId || n.metadata?.order_id)?.toString().slice(0, 8)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {(n.metadata?.table_number || n.metadata?.mesa || n.metadata?.table_id) && (
                                                        <div className="bg-white/5 p-1.5 rounded border border-white/5">
                                                            <span className="block text-[7px] text-gray-500 uppercase font-black tracking-widest leading-none mb-1">Mesa</span>
                                                            <span className="text-[9px] font-bold text-gray-300 block uppercase">
                                                                {n.metadata?.table_number || n.metadata?.mesa || n.metadata?.table_id}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {(n.metadata?.amount || n.metadata?.monto_anulado || n.metadata?.total_anulado || n.metadata?.total_cuenta) && (
                                                        <div className="bg-white/5 p-1.5 rounded border border-white/5">
                                                            <span className="block text-[7px] text-gray-500 uppercase font-black tracking-widest leading-none mb-1">Monto</span>
                                                            <span className="text-[9px] font-black text-emerald-400 block uppercase">
                                                                Q{Number(n.metadata?.amount || n.metadata?.monto_anulado || n.metadata?.total_anulado || n.metadata?.total_cuenta || 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <p className="text-xs text-gray-400 leading-snug mb-3 font-medium bg-black/10 p-2 rounded border border-white/5 italic">
                                                    "{n.metadata?.reason || n.metadata?.motivo || n.metadata?.motivo_anulacion || 'Sin motivo especificado'}"
                                                </p>

                                                {/* Lista de Items (para Orden/Cuenta) */}
                                                {n.metadata?.items && Array.isArray(n.metadata.items) && n.metadata.items.length > 0 && (
                                                    <div className="mb-3 bg-black/20 p-2 rounded border border-white/5">
                                                        <span className="block text-[7px] text-gray-500 uppercase font-black tracking-widest leading-none mb-1.5">Detalle de Productos</span>
                                                        <div className="flex flex-col gap-1">
                                                            {n.metadata.items.slice(0, 5).map((item: any, idx: number) => (
                                                                <div key={idx} className="flex justify-between items-center text-[9px] font-bold text-gray-400 border-b border-white/5 pb-0.5 last:border-0">
                                                                    <span className="truncate pr-2 uppercase">{item.cantidad}x {item.nombre || item.productName || 'Producto'}</span>
                                                                    <span className="shrink-0 text-gray-500">Q{(item.precio * item.cantidad).toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                            {n.metadata.items.length > 5 && (
                                                                <span className="text-[8px] text-indigo-400 font-black mt-1 uppercase">+{n.metadata.items.length - 5} productos más...</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-[9px] font-black text-red-400 border border-red-500/20">
                                                            {n.usuario_nombre.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[7px] text-gray-500 uppercase font-black tracking-widest leading-none mb-0.5">Autorizado Por</span>
                                                            <span className="text-[10px] font-black text-gray-300 uppercase leading-none">
                                                                {n.usuario_nombre}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[8px] font-black text-gray-600 uppercase tracking-widest">
                                                        <span>{n.modulo}</span>
                                                        <ChevronRight size={10} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-black/40 border-t border-white/5 text-center">
                        <button 
                            className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] hover:text-indigo-300 transition-colors flex items-center justify-center gap-2 mx-auto"
                            onClick={() => {
                                setIsOpen(false);
                                if (onViewAll) onViewAll();
                            }}
                        >
                            Ver historial completo
                            <ExternalLink size={12} />
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};
