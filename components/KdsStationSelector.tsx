import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { ChefHat, Loader2, AlertCircle, LogOut, ChevronLeft } from 'lucide-react';

interface KdsStationSelectorProps {
    onSelect: (stationId: string) => void;
    onLogout: () => void;
}

interface Station {
    id: string;
    name: string;
}

export const KdsStationSelector: React.FC<KdsStationSelectorProps> = ({ onSelect, onLogout }) => {
    const [stations, setStations] = useState<Station[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchStations();
    }, []);

    const fetchStations = async () => {
        try {
            setLoading(true);
            // Try to load from cache first for offline support
            const cached = localStorage.getItem('cached_kitchen_stations');
            if (cached) {
                setStations(JSON.parse(cached));
            }

            const { data, error } = await supabase
                .from('kitchen_stations')
                .select('id, name')
                .eq('is_enabled', true)
                .order('name');

            if (error) throw error;

            if (data) {
                setStations(data);
                localStorage.setItem('cached_kitchen_stations', JSON.stringify(data));
            }
        } catch (err: any) {
            console.error('Error fetching stations:', err);
            // If we have no cache and no internet, show error
            if (stations.length === 0) {
                setError('No se pudieron cargar las estaciones. Revise su conexión.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStationClick = (station: Station) => {
        localStorage.setItem('current_kds_station', station.id);
        localStorage.setItem('current_kds_station_name', station.name);
        onSelect(station.id);
    };

    return (
        <div className="min-h-screen bg-[#2d2e3d] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900/40 via-transparent to-transparent"></div>
            </div>

            <div className="w-full max-w-4xl z-10">
                <div className="text-center mb-12">
                    <div className="w-24 h-24 bg-indigo-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/30 shadow-2xl shadow-indigo-500/20">
                        <ChefHat size={48} className="text-indigo-400" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-semibold text-white uppercase tracking-widest mb-3">SELECCIÓN DE ESTACIÓN</h1>
                    <p className="text-gray-400 font-medium tracking-[0.2em] uppercase text-sm">Configuración de KDS</p>
                </div>

                {loading && stations.length === 0 ? (
                    <div className="flex justify-center">
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center gap-4 text-red-400 bg-red-500/10 p-8 rounded-2xl border border-red-500/20">
                        <AlertCircle size={48} />
                        <span className="font-medium text-lg">{error}</span>
                        <button onClick={fetchStations} className="px-6 py-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-white font-medium transition-colors">Reintentar</button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 w-full max-w-md mx-auto animate-fade-in">
                        {stations.map((station) => (
                            <button
                                key={station.id}
                                onClick={() => handleStationClick(station)}
                                className="group relative h-20 bg-[#161b22] hover:bg-[#1c2128] border border-white/5 hover:border-indigo-500/50 rounded-[1.25rem] px-8 flex items-center justify-between transition-all active:scale-95 shadow-xl hover:shadow-indigo-500/10"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                                <span className="text-lg md:text-xl font-extrabold text-gray-300 group-hover:text-white uppercase tracking-tight relative z-10 text-left">
                                    {station.name}
                                </span>
                                <div className="w-1.5 h-1.5 bg-indigo-500/30 group-hover:bg-indigo-500 rounded-full transition-all relative z-10 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                            </button>
                        ))}
                    </div>
                )}

                <div className="mt-16 flex flex-col md:flex-row items-center justify-center gap-8">
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-medium text-xs uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-white/5"
                    >
                        <ChevronLeft size={16} />
                        Volver al Inicio
                    </button>

                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 text-red-500/50 hover:text-red-400 transition-colors font-medium text-xs uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-red-500/10"
                    >
                        <LogOut size={16} />
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
    );
};
