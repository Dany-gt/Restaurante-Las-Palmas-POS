import React from 'react';
import { useWindows } from './WindowsModalContext';
import { X, Minus, Maximize2, Layers } from 'lucide-react';

export const WindowsTaskbar: React.FC = () => {
    const { modals, restoreModal, minimizeModal, closeModal, focusModal } = useWindows();

    if (modals.length === 0) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 h-12 bg-white/80 backdrop-blur-md border-t border-slate-200 z-[200000] flex items-center px-4 gap-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hide h-full flex-1">
                {modals.map(modal => (
                    <div 
                        key={modal.id}
                        onClick={() => modal.status === 'minimized' ? restoreModal(modal.id) : focusModal(modal.id)}
                        className={`flex items-center gap-2 h-9 px-3 rounded-lg cursor-pointer transition-all border-b-2 ${
                            modal.status === 'open' 
                            ? 'bg-slate-100 border-[#106ebe] shadow-inner' 
                            : 'bg-transparent border-transparent hover:bg-slate-50'
                        }`}
                        title={modal.title}
                    >
                        <div className="text-[#106ebe] shrink-0 opacity-80">
                            {modal.icon || <Layers size={14} />}
                        </div>
                        <span className={`text-[10px] font-semibold uppercase tracking-tight truncate max-w-[120px] ${
                            modal.status === 'open' ? 'text-slate-900' : 'text-slate-400'
                        }`}>
                            {modal.title}
                        </span>
                        
                        {/* Pequeños controles en el botón de la barra */}
                        <div className="flex items-center ml-1 border-l border-slate-200 pl-1.5 opacity-40 hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => { e.stopPropagation(); closeModal(modal.id); }}
                                className="hover:text-red-500 transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="h-6 w-px bg-slate-200" />
            
            {/* Indicador de número de ventanas */}
            <div className="flex items-center gap-2 pl-2">
                <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">{modals.length} VENTANAS</span>
            </div>
        </div>
    );
};
