import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../../supabase';

export const DriverTracker: React.FC = () => {
    const [status, setStatus] = useState<'IDLE' | 'TRACKING' | 'ERROR'>('IDLE');
    const [driverName, setDriverName] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const watchId = useRef<number | null>(null);

    // Get driver_id from URL
    const params = new URLSearchParams(window.location.search);
    const driverId = params.get('driver_id');

    useEffect(() => {
        if (!driverId) {
            setStatus('ERROR');
            setErrorMsg('No se especificó ID de conductor');
            return;
        }

        // Fetch driver name
        const fetchDriver = async () => {
            const { data } = await supabase.from('delivery_drivers').select('name').eq('id', driverId).single();
            if (data) setDriverName(data.name);
        };
        fetchDriver();

        return () => stopTracking();
    }, [driverId]);

    const startTracking = async () => {
        if (!navigator.geolocation) {
            setStatus('ERROR');
            setErrorMsg('Geolocalización no soportada por el navegador');
            return;
        }

        setStatus('TRACKING');

        // Intentar mantener la pantalla encendida (Wake Lock API)
        try {
            if ('wakeLock' in navigator) {
                await (navigator as any).wakeLock.request('screen');
            }
        } catch (err) {
            console.log('Wake Lock request failed:', err);
        }

        watchId.current = navigator.geolocation.watchPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setLastUpdate(new Date());

                // Upsert location to Supabase
                // Using upsert on specific driver_id is tricky with default RLS if using standard table, 
                // but we defined 'driver_locations' with a unique constraint on driver_id.
                // We'll try to upsert.
                try {
                    // Check if exists first to decide insert vs update, or use upsert
                    const { error } = await supabase
                        .from('driver_locations')
                        .upsert({
                            driver_id: driverId,
                            latitude,
                            longitude,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'driver_id' });

                    if (error) {
                        console.error('Error updating location:', error);
                        // Don't stop tracking on single network error, just log
                    }
                } catch (e) {
                    console.error(e);
                }
            },
            (error) => {
                console.error('Geo error:', error);
                setStatus('ERROR');
                setErrorMsg('Error de GPS: ' + error.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );
    };

    const stopTracking = () => {
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
        setStatus('IDLE');
    };

    if (status === 'ERROR') {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-6">
                    <AlertTriangle size={40} />
                </div>
                <h2 className="text-2xl font-medium mb-2">Error de Rastreo</h2>
                <p className="text-gray-400">{errorMsg}</p>
                {driverId && (
                    <button onClick={() => window.location.reload()} className="mt-8 px-6 py-3 bg-white/10 rounded-xl font-medium">
                        Reintentar
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#111] text-white flex flex-col items-center pt-20 px-6">
            <div className="mb-10 text-center">
                <h1 className="text-sm font-medium tracking-[0.3em] uppercase text-gray-500 mb-2">LAS PALMAS LOGISTICS</h1>
                <h2 className="text-3xl font-semibold italic uppercase text-indigo-400">{driverName || 'Conductor'}</h2>
            </div>

            <div className={`w-40 h-40 rounded-full flex items-center justify-center mb-10 transition-all duration-500 ${status === 'TRACKING' ? 'bg-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.3)]' : 'bg-gray-800'}`}>
                {status === 'TRACKING' ? (
                    <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                        <Navigation size={48} className="text-emerald-500 relative z-10" />
                    </div>
                ) : (
                    <MapPin size={48} className="text-gray-500" />
                )}
            </div>

            {status === 'IDLE' ? (
                <button
                    onClick={startTracking}
                    className="w-full max-w-xs py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-semibold uppercase tracking-widest shadow-xl transition-all active:scale-95 text-sm"
                >
                    Iniciar Turno / Rastreo
                </button>
            ) : (
                <div className="w-full max-w-xs flex flex-col gap-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center">
                        <p className="text-emerald-400 font-medium text-sm uppercase tracking-wider flex items-center justify-center gap-2">
                            <CheckCircle size={16} /> Rastreando Activo
                        </p>
                        {lastUpdate && (
                            <p className="text-[10px] text-emerald-500/60 mt-2 font-mono">
                                Última act: {lastUpdate.toLocaleTimeString()}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={stopTracking}
                        className="w-full py-5 bg-gray-800 hover:bg-gray-700 rounded-2xl font-semibold uppercase tracking-widest shadow-lg transition-all active:scale-95 text-sm text-gray-400"
                    >
                        Detener Rastreo
                    </button>
                </div>
            )}

            <p className="mt-auto mb-8 text-[10px] text-gray-600 uppercase tracking-widest max-w-xs text-center leading-relaxed">
                Mantén esta ventana abierta mientras realizas entregas para que el restaurante pueda ver tu ubicación.
            </p>
        </div>
    );
};
