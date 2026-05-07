import React, { useState, useEffect, useRef } from 'react';
import { NotificationType } from '../hooks/useNotify';
import { supabase } from '../supabase';
import { getSecureSoundUrl } from '../utils/supabaseUtils';

interface AppNotification {
    id: string;
    type: NotificationType;
    message: string;
}

export const NotificationContainer: React.FC = () => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [soundsMap, setSoundsMap] = useState<Record<string, string>>({});
    const [volume, setVolume] = useState(0.8);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Load all active sounds to have them ready
                const { data: sounds } = await supabase
                    .from('sound_library')
                    .select('id, file_url')
                    .eq('is_active', true);

                if (sounds) {
                    const map: Record<string, string> = {};
                    sounds.forEach(s => {
                        map[s.id] = getSecureSoundUrl(s.file_url);
                    });
                    setSoundsMap(map);
                }

                // Initial volume from localStorage or DB
                const localSettings = JSON.parse(localStorage.getItem('system_settings') || '{}');
                if (localSettings.kds_alert_volume) {
                    setVolume(localSettings.kds_alert_volume);
                } else {
                    const { data: settings } = await supabase
                        .from('system_settings')
                        .select('kds_alert_volume')
                        .eq('id', 1)
                        .single();
                    if (settings?.kds_alert_volume) setVolume(settings.kds_alert_volume);
                }
            } catch (error) {
                console.error('Error initializing notification sounds:', error);
            }
        };

        loadInitialData();
    }, []);

    useEffect(() => {
        const handleNotification = (event: any) => {
            const { type, message } = event.detail;
            const id = crypto.randomUUID();

            setNotifications(prev => {
                const updated = [...prev, { id, type, message }];
                if (updated.length > 5) return updated.slice(updated.length - 5);
                return updated;
            });

            // Get latest settings from localStorage to be reactive
            const localSettings = JSON.parse(localStorage.getItem('system_settings') || '{}');
            const soundId = localSettings.pos_notification_sound_id;
            const currentVolume = localSettings.kds_alert_volume || volume;

            if (soundId) {
                let url = soundsMap[soundId];
                
                // Fallback: if sound is not in map (e.g. newly added), fetch it
                if (!url) {
                    supabase
                        .from('sound_library')
                        .select('file_url')
                        .eq('id', soundId)
                        .single()
                        .then(({ data }) => {
                            if (data?.file_url) {
                                const newUrl = getSecureSoundUrl(data.file_url);
                                setSoundsMap(prev => ({ ...prev, [soundId]: newUrl }));
                                playAudio(newUrl, currentVolume);
                            }
                        });
                } else {
                    playAudio(url, currentVolume);
                }
            }

            // Auto discard after 5 seconds
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }, 5000);
        };

        const playAudio = (url: string, vol: number) => {
            const audio = new Audio(url);
            audio.volume = vol;
            audio.play().catch(err => {
                console.warn('Notification audio playback failed:', err);
            });
        };

        window.addEventListener('app-notification', handleNotification);
        return () => window.removeEventListener('app-notification', handleNotification);
    }, []);

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const getTitle = (type: NotificationType) => {
        switch (type) {
            case 'SUCCESS': return 'Éxito';
            case 'ERROR': return 'Error';
            case 'ALERT': return 'Alerta';
            case 'OFFLINE': return 'Desconectado';
            case 'INFO': return 'Información';
            default: return 'Aviso';
        }
    };

    const getIcon = (type: NotificationType) => {
        if (type === 'SUCCESS') {
            return (
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-inner border-2 border-green-500 overflow-hidden shrink-0 mt-1">
                    <div className="w-full h-full bg-gradient-to-b from-[#7bc143] to-[#599b2f] flex items-center justify-center border-2 border-white rounded-full">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>
            );
        } else if (type === 'ERROR') {
            return (
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-inner border-2 border-red-500 overflow-hidden shrink-0 mt-1">
                    <div className="w-full h-full bg-gradient-to-b from-[#e74c3c] to-[#c0392b] flex items-center justify-center border-2 border-white rounded-full">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </div>
                </div>
            );
        } else if (type === 'ALERT') {
            return (
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-inner border-2 border-yellow-500 overflow-hidden shrink-0 mt-1">
                    <div className="w-full h-full bg-gradient-to-b from-[#f1c40f] to-[#f39c12] flex items-center justify-center border-2 border-white rounded-full">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-inner border-2 border-blue-400 overflow-hidden shrink-0 mt-1">
                    <div className="w-full h-full bg-gradient-to-b from-[#3498db] to-[#2980b9] flex items-center justify-center border-2 border-white rounded-full">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="fixed bottom-12 right-4 z-[999999] flex flex-col gap-2 pointer-events-none items-end">
            {notifications.map(n => (
                <div
                    key={n.id}
                    className="flex flex-col min-w-[340px] max-w-[400px] pointer-events-auto transform transition-all duration-300 animate-in slide-in-from-right-8 fade-in bg-[#2b78d6] shadow-[2px_2px_10px_rgba(0,0,0,0.3)] select-none border border-[#1d63b8]"
                    style={{ fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' }}
                    onClick={() => removeNotification(n.id)}
                >
                    {/* Top Right Arrow Into Square Icon (Contextual to Windows Toast) */}
                    <div className="absolute top-2 right-2 text-white/80 hover:text-white cursor-pointer transition-colors p-1 z-10">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
                            <path d="M15 3h6v18h-6" />
                            <path d="M10 17l5-5-5-5" />
                            <path d="M15 12H3" />
                        </svg>
                    </div>

                    <div className="flex items-start gap-4 p-4 pr-10">
                        {getIcon(n.type)}
                        <div className="flex flex-col text-white pt-1">
                            <span className="text-[14px] font-bold leading-none mb-1.5 shadow-sm tracking-wide">
                                {getTitle(n.type)}
                            </span>
                            <span className="text-[13px] leading-tight font-normal opacity-95">
                                {n.message}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
