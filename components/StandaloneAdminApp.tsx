import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { AdminAuthPanel } from './AdminAuthPanel';
import { User } from '../types';
import { Shield, Lock } from 'lucide-react';

export const StandaloneAdminApp: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Auto-login if previously authenticated on this device
    useEffect(() => {
        document.title = 'AUTORIZACIONES - Admin';
        const checkSession = async () => {
            const savedPin = localStorage.getItem('standalone_admin_pin');
            if (savedPin) {
                await authenticate(savedPin, true);
            }
        };
        checkSession();
    }, []);

    const authenticate = async (inputPin: string, silent = false) => {
        if (!silent) setLoading(true);
        setError('');
        
        try {
            const { data, error: dbError } = await supabase
                .from('profiles')
                .select('*')
                .eq('pin', inputPin)
                .single();

            if (dbError || !data) {
                throw new Error('PIN incorrecto o usuario no encontrado');
            }

            if (data.role?.toUpperCase() !== 'ADMIN' && data.role?.toUpperCase() !== 'SUPERVISOR') {
                throw new Error('Acceso denegado. Requiere privilegios de Administrador.');
            }

            setCurrentUser(data as User);
            localStorage.setItem('standalone_admin_pin', inputPin); // Remember session
        } catch (err: any) {
            console.error('Auth error:', err);
            if (!silent) {
                setError(err.message || 'Error de autenticación');
                setPin('');
            } else {
                localStorage.removeItem('standalone_admin_pin');
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handlePinInput = (val: string) => {
        if (pin.length < 4) {
            const newPin = pin + val;
            setPin(newPin);
            if (newPin.length === 4) {
                authenticate(newPin);
            }
        }
    };

    const handleEnter = () => {
        if (pin.length > 0) {
            authenticate(pin);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('standalone_admin_pin');
        setCurrentUser(null);
        setPin('');
    };

    if (currentUser) {
        return (
            <AdminAuthPanel 
                currentUser={currentUser} 
                onExit={handleLogout} 
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-[#0f1115] flex flex-col items-center justify-center p-6 text-white font-sans">
            <div className="w-full max-w-sm bg-[#1e212b] rounded-3xl border border-white/10 p-8 shadow-2xl flex flex-col items-center">
                <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6">
                    <Shield size={32} className="text-indigo-400" />
                </div>
                <h1 className="text-2xl font-semibold mb-1">APP DE AUTORIZACIONES</h1>
                <p className="text-gray-400 text-sm mb-8 text-center">Ingresa tu PIN de administrador para continuar.</p>
                
                {error && (
                    <div className="w-full bg-red-500/10 text-red-400 text-xs font-medium px-4 py-3 rounded-xl mb-6 text-center border border-red-500/20">
                        {error}
                    </div>
                )}

                <div className="flex gap-3 mb-8">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pin.length ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]' : 'bg-white/10'}`}></div>
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-3 w-full mb-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handlePinInput(num.toString())}
                            className="bg-white/5 hover:bg-white/10 active:bg-white/20 h-16 rounded-2xl text-2xl font-semibold transition-colors"
                        >
                            {num}
                        </button>
                    ))}
                    <button
                        onClick={() => setPin(pin.slice(0, -1))}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 active:bg-red-500/30 h-16 rounded-2xl text-lg font-medium transition-colors flex items-center justify-center"
                    >
                        BORRAR
                    </button>
                    <button
                        onClick={() => handlePinInput('0')}
                        className="bg-white/5 hover:bg-white/10 active:bg-white/20 h-16 rounded-2xl text-2xl font-semibold transition-colors"
                    >
                        0
                    </button>
                    <button
                        onClick={handleEnter}
                        disabled={pin.length === 0 || loading}
                        className="bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed h-16 rounded-2xl text-lg font-medium transition-colors flex items-center justify-center"
                    >
                        {loading ? '...' : 'ENTRAR'}
                    </button>
                </div>
            </div>
            
            <p className="mt-8 text-xs text-gray-600 font-medium tracking-widest text-center">
                LAS PALMAS POS &bull; ADMIN MODULE
            </p>
        </div>
    );
};
