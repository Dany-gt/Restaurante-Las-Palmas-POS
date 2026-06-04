import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export const AppUpdater = () => {
    const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'up_to_date'>('idle');
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
            if (api.onUpdateNotAvailable) {
                api.onUpdateNotAvailable(() => {
                    setStatus('up_to_date');
                    setTimeout(() => setStatus('idle'), 4000);
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

    const baseClasses = "w-[150px] h-[56px] bg-[#23242f] border border-white/10 rounded-none px-3 transition-all group shadow-md active:scale-[0.97] flex flex-col items-center justify-center relative overflow-hidden";
    const hoverClasses = "hover:bg-white/10 hover:border-white/25";

    if (status === 'idle') {
        return (
            <button
                onClick={checkForUpdates}
                className={`${baseClasses} ${hoverClasses}`}
                title="Buscar Actualizaciones de Sistema"
            >
                <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-emerald-500 border-l-[10px] border-l-transparent pointer-events-none" />
                <RefreshCw size={14} className="text-gray-400 group-hover:text-emerald-400 mb-1 transition-colors" />
                <span className="text-[9px] font-semibold text-gray-400 group-hover:text-white uppercase tracking-wider text-center transition-colors leading-tight">
                    BUSCAR<br/>ACTUALIZACIÓN
                </span>
            </button>
        );
    }

    return (
        <button className={`${baseClasses} ${status === 'error' ? 'border-red-500/50 bg-red-500/10' : ''}`} onClick={status === 'error' ? () => setStatus('idle') : undefined}>
            <div className={`absolute top-0 right-0 w-0 h-0 border-t-[10px] border-l-[10px] border-l-transparent pointer-events-none ${
                status === 'error' ? 'border-t-red-500' : 
                (status === 'downloaded' || status === 'up_to_date') ? 'border-t-emerald-500' : 
                'border-t-blue-500'
            }`} />

            {status === 'checking' && (
                <div className="flex flex-col items-center">
                    <RefreshCw size={14} className="animate-spin text-blue-400 mb-1" />
                    <span className="text-[9px] font-semibold text-blue-400 uppercase tracking-widest leading-tight">BUSCANDO...</span>
                </div>
            )}
            
            {status === 'available' && (
                <div className="flex flex-col items-center">
                    <Download size={14} className="animate-bounce text-yellow-400 mb-1" />
                    <span className="text-[9px] font-semibold text-yellow-400 uppercase tracking-widest leading-tight">INICIANDO...</span>
                </div>
            )}

            {status === 'downloading' && (
                <div className="flex flex-col items-center w-full px-2">
                    <span className="text-[9px] font-semibold text-green-400 uppercase tracking-widest mb-1">
                        DESCARGANDO {progress?.percent?.toFixed(0) || 0}%
                    </span>
                    <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${progress?.percent || 0}%` }}
                        />
                    </div>
                </div>
            )}

            {status === 'downloaded' && (
                <div className="flex flex-col items-center">
                    <CheckCircle size={14} className="text-emerald-400 mb-1" />
                    <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-widest leading-tight">LISTA PARA<br/>INSTALAR</span>
                </div>
            )}

            {status === 'up_to_date' && (
                <div className="flex flex-col items-center">
                    <CheckCircle size={14} className="text-emerald-400 mb-1" />
                    <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-widest leading-tight">ACTUALIZADO</span>
                </div>
            )}

            {status === 'error' && (
                <div className="flex flex-col items-center">
                    <AlertCircle size={14} className="text-red-400 mb-1" />
                    <span className="text-[8px] font-semibold text-red-400 uppercase tracking-tight leading-tight px-1 text-center line-clamp-2">
                        {errorMessage || 'ERROR'}
                    </span>
                </div>
            )}
        </button>
    );
};
