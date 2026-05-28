import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export const AppUpdater = () => {
    const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
    const [progress, setProgress] = useState<{ percent: number } | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        // Check if running in Electron
        if ((window as any).electronAPI || (window as any).electron) {
            setIsElectron(true);
            const api = (window as any).electronAPI || (window as any).electron;

            if (api.onUpdateAvailable) {
                api.onUpdateAvailable(() => {
                    setStatus('available');
                });
            }
            if (api.onUpdateProgress) {
                api.onUpdateProgress((event: any, progObj: any) => {
                    setStatus('downloading');
                    setProgress(progObj || event); // Handle different IPC arg structures
                });
            }
            if (api.onUpdateDownloaded) {
                api.onUpdateDownloaded(() => {
                    setStatus('downloaded');
                });
            }
            if (api.onUpdateError) {
                api.onUpdateError((event: any, err: string) => {
                    setStatus('error');
                    setErrorMessage(err || 'Error de actualización');
                });
            }
        }
    }, []);

    const checkForUpdates = async () => {
        if (!isElectron) return;
        const api = (window as any).electronAPI || (window as any).electron;
        if (!api.checkForUpdates) return;
        
        setStatus('checking');
        setErrorMessage('');
        
        const result = await api.checkForUpdates();
        if (!result.success) {
            setStatus('error');
            setErrorMessage(result.error || 'Error al buscar actualización');
            setTimeout(() => setStatus('idle'), 5000);
        }
    };

    if (!isElectron) return null;

    if (status === 'idle') {
        return (
            <div className="fixed bottom-4 left-4 z-[9999]">
                <button
                    onClick={checkForUpdates}
                    className="bg-[#2d2e3d] border border-white/10 hover:border-white/20 text-white/50 hover:text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 transition-all shadow-md active:scale-95"
                    title="Buscar Actualizaciones"
                >
                    <RefreshCw size={14} />
                    <span className="font-black tracking-widest uppercase">Actualizar</span>
                </button>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 z-[9999] bg-[#2d2e3d] border border-white/20 rounded-lg p-3 shadow-xl shadow-black/40 min-w-[200px] animate-fade-in flex flex-col gap-2">
            {status === 'checking' && (
                <div className="flex items-center gap-2 text-blue-400">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-xs font-black uppercase tracking-widest">Buscando...</span>
                </div>
            )}
            
            {status === 'available' && (
                <div className="flex items-center gap-2 text-yellow-400">
                    <Download size={16} className="animate-bounce" />
                    <span className="text-xs font-black uppercase tracking-widest">Encontrada! Iniciando...</span>
                </div>
            )}

            {status === 'downloading' && (
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-green-400">
                        <span className="text-[10px] font-black uppercase tracking-widest">Descargando</span>
                        <span className="text-xs font-black tabular-nums">{progress?.percent?.toFixed(1) || 0}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${progress?.percent || 0}%` }}
                        />
                    </div>
                </div>
            )}

            {status === 'downloaded' && (
                <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle size={16} />
                    <span className="text-xs font-black uppercase tracking-widest">Lista para instalar</span>
                </div>
            )}

            {status === 'error' && (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">Error</span>
                    </div>
                    <span className="text-[9px] text-red-300/80 leading-tight">{errorMessage}</span>
                    <button 
                        onClick={() => setStatus('idle')}
                        className="mt-1 text-[10px] bg-red-500/20 hover:bg-red-500/40 text-red-200 px-2 py-1 rounded w-full text-center font-bold"
                    >
                        CERRAR
                    </button>
                </div>
            )}
        </div>
    );
};
