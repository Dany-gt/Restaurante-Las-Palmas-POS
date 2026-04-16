import React, { useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';
import { supabase } from '../../supabase';

const containerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '1.5rem',
};

const center = {
    lat: 14.6349, // Ubicación por defecto (ej. Ciudad de Guatemala)
    lng: -90.5069
};

// Moto Icon (SVG)
const bikeIcon = {
    path: "M19.5,14c-1.38,0-2.5,1.12-2.5,2.5s1.12,2.5,2.5,2.5s2.5-1.12,2.5-2.5S20.88,14,19.5,14z M5,16c0-1.38-1.12-2.5-2.5-2.5S0,14.62,0,16s1.12,2.5,2.5,2.5 S5,17.38,5,16z M22,10h-2c-0.55,0-1,0.45-1,1v1h-5.46l-2-4H10V7c0-0.55-0.45-1-1-1H7C6.45,6,6,6.45,6,7v1H2c-0.55,0-1,0.45-1,1v1h2v1 c-1.66,0-3,1.34-3,3s1.34,3,3,3s3-1.34,3-3V12h4.54l2,4H10v1c0,0.55,0.45,1,1,1h2c0.55,0,1-0.45,1-1v-1h5.11 c0.21,1.14,1.21,2,2.39,2c1.38,0,2.5-1.12,2.5-2.5s-1.12-2.5-2.5-2.5c-1.18,0-2.18,0.86-2.39,2h-4.22l-2-4H22V10z",
    fillColor: "#4f46e5",
    fillOpacity: 1,
    strokeWeight: 1,
    rotation: 0,
    scale: 1,
    anchor: { x: 12, y: 12 }
};

export const DriverMap: React.FC = () => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: "TU_GOOGLE_MAPS_API_KEY"
    });

    const [drivers, setDrivers] = useState<any[]>([]);

    useEffect(() => {
        // 1. Cargar repartidores activos inicialmente
        const fetchActiveDrivers = async () => {
            const { data } = await supabase
                .from('delivery_drivers')
                .select('*')
                .not('last_lat', 'is', null);
            setDrivers(data || []);
        };

        fetchActiveDrivers();

        // 2. Suscribirse a cambios en tiempo real
        const channel = supabase
            .channel('drivers_tracking')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'delivery_drivers' },
                (payload) => {
                    setDrivers(prev =>
                        prev.map(d => d.id === payload.new.id ? payload.new : d)
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    if (!isLoaded) return <div className="h-64 flex items-center justify-center animate-pulse bg-gray-100 rounded-3xl">Cargando Mapa...</div>;

    return (
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={drivers.length > 0 ? { lat: drivers[0].last_lat, lng: drivers[0].last_lng } : center}
            zoom={14}
        >
            {drivers.map(driver => (
                <React.Fragment key={driver.id}>
                    <Marker
                        position={{ lat: driver.last_lat, lng: driver.last_lng }}
                        icon={bikeIcon}
                        title={driver.name}
                    />
                    <Circle
                        center={{ lat: driver.last_lat, lng: driver.last_lng }}
                        radius={50}
                        options={{
                            fillColor: '#4f46e5',
                            fillOpacity: 0.1,
                            strokeColor: '#4f46e5',
                            strokeOpacity: 0.3,
                            strokeWeight: 1,
                        }}
                    />
                </React.Fragment>
            ))}
        </GoogleMap>
    );
};
