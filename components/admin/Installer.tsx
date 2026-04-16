import React, { useState } from 'react';
import { ShieldCheck, HardDrive, Mail, Key, Loader2, CheckCircle, Smartphone, Building2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { WindowsSaveButton } from '../WindowsSaveButton';

interface InstallerProps {
    onActivationSuccess: (activationData: any) => void;
}

export const Installer: React.FC<InstallerProps> = ({ onActivationSuccess }) => {
    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [step, setStep] = useState<'LOGIN' | 'VALIDATING' | 'SUCCESS'>('LOGIN');
    const [error, setError] = useState('');
    const [branchInfo, setBranchInfo] = useState<any>(null);

    const handleActivate = async () => {
        if (!email || !token) {
            setError('Todos los campos son obligatorios.');
            return;
        }

        setStep('VALIDATING');
        setError('');

        try {
            // Validar contra la tabla branches
            // Buscamos una sucursal que coincida con el email del responsable y el token generado
            const { data, error: dbError } = await supabase
                .from('branches')
                .select('*, organizations(name)')
                .eq('email', email.toLowerCase().trim())
                .eq('registration_token', token.toUpperCase().trim())
                .single();

            if (dbError || !data) {
                setStep('LOGIN');
                setError('Credenciales inválidas. Verifique el Email y el Token de sucursal.');
                return;
            }

            // ÉXITO
            const activationData = {
                branch_id: data.id,
                branch_name: data.name,
                org_id: data.org_id,
                org_name: data.organizations?.name || 'ORGANIZACIÓN',
                activated_at: new Date().toISOString()
            };

            // REGISTRO DE DISPOSITIVO (HARDWARE ID)
            const fingerprint = `POS-${Math.random().toString(36).substring(2, 9).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

            await supabase.from('device_registrations').insert([{
                branch_id: data.id,
                fingerprint: fingerprint,
                device_name: 'POS TERMINAL',
                status: 'authorized'
            }]);

            setBranchInfo(activationData);
            setStep('SUCCESS');

            // Persistencia local para reconocimiento instantáneo
            localStorage.setItem('activation_data', JSON.stringify(activationData));
            localStorage.setItem('device_fingerprint', fingerprint);

            // Delay para que el usuario vea el éxito
            setTimeout(() => {
                onActivationSuccess(activationData);
            }, 3000);

        } catch (err) {
            setStep('LOGIN');
            setError('Error de conexión con el servidor de licencias.');
        }
    };

    return (
        <div className="min-h-screen bg-[#106ebe] flex items-center justify-center p-4 font-sans select-none overflow-hidden">
            {/* Fondo decorativo estilo Windows Server */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-white blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-400 blur-[150px] rounded-full" />
            </div>

            <div className="w-full max-w-[480px] bg-[#f0f0f0] border-2 border-[#106ebe] shadow-[10px_10px_40px_rgba(0,0,0,0.5)] flex flex-col relative z-10 animate-in fade-in zoom-in-95 duration-500">
                {/* Windows Title Bar */}
                <div className="h-9 bg-[#106ebe] flex items-center justify-between px-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <Smartphone size={16} className="text-white opacity-80" />
                        <span className="text-[11px] font-black text-white uppercase tracking-[0.15em]">Instalador Las Palmas POS</span>
                    </div>
                    <div className="flex gap-1">
                        <div className="w-6 h-6 flex items-center justify-center hover:bg-white/10 text-white transition-colors cursor-pointer">
                            <div className="w-3 h-[1.5px] bg-current" />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    {/* Header Icon Section */}
                    <div className="bg-white border-b border-gray-300 p-8 flex items-center gap-6">
                        <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-[#106ebe] shadow-inner shrink-0 ring-1 ring-blue-100/50">
                            <HardDrive size={40} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h1 className="text-[18px] font-black text-slate-800 uppercase tracking-tight leading-none">Configuración de Licencia</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Active su sucursal para comenzar</p>
                        </div>
                    </div>

                    {/* Form Area */}
                    <div className="p-8 pb-4 space-y-5">
                        {step === 'SUCCESS' ? (
                            <div className="flex flex-col items-center text-center py-6 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-sm border border-emerald-200">
                                    <CheckCircle size={32} />
                                </div>
                                <h2 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">¡Activación Exitosa!</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Bienvenido a {branchInfo?.branch_name}</p>
                                <div className="mt-6 flex flex-col items-center gap-2">
                                    <div className="w-12 h-1 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Cargando Entorno POS...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1.5 focus-within:translate-x-1 transition-transform">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Mail size={12} className="text-[#106ebe]" />
                                            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Correo del Administrador</label>
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="sucursal@ejemplo.com"
                                            disabled={step === 'VALIDATING'}
                                            className="w-full bg-white border border-gray-400 text-[12px] font-bold px-4 py-3 focus:border-[#106ebe] text-slate-900 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] outline-none transition-all placeholder:text-slate-400"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5 focus-within:translate-x-1 transition-transform">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Key size={12} className="text-[#106ebe]" />
                                            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Token de Sucursal</label>
                                        </div>
                                        <input
                                            type="text"
                                            value={token}
                                            onChange={e => setToken(e.target.value)}
                                            placeholder="XXXX-XXXX"
                                            disabled={step === 'VALIDATING'}
                                            className="w-full font-mono bg-white border border-gray-400 text-[14px] font-black tracking-[0.2em] px-4 py-3 focus:border-[#106ebe] text-[#106ebe] shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] outline-none transition-all placeholder:text-slate-300 uppercase"
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold uppercase text-center animate-shake">
                                        {error}
                                    </div>
                                )}

                                <div className="pt-4">
                                    <WindowsSaveButton
                                        onClick={handleActivate}
                                        loading={step === 'VALIDATING'}
                                        title="Activar Sistema Ahora"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer / Status Bar style */}
                    <div className="h-8 bg-[#e1e1e1] border-t border-gray-300 flex items-center justify-between px-6 shrink-0 mt-4">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={12} className="text-slate-400" />
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Conectado a Ecosistema Central</span>
                        </div>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">v1.2 // Secure Install</span>
                    </div>
                </div>
            </div>

            {/* Créditos en la esquina */}
            <div className="fixed bottom-6 left-6 text-white/30 flex items-center gap-3">
                <Building2 size={24} />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] leading-none">Las Palmas POS</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest mt-1 opacity-60 italic">Multi-Tenant Engineering</span>
                </div>
            </div>
        </div>
    );
};
