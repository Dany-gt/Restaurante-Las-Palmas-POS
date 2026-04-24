import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X, Check, HelpCircle } from 'lucide-react';
import { DraggableWindow } from './DraggableWindow';

interface ConfirmDialogProps {
    isOpen: boolean;
    title?: string;
    message: string;
    description?: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'warning' | 'question' | 'danger';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title = 'Confirmación del Sistema',
    message,
    description,
    onConfirm,
    onCancel,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    type = 'warning'
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger': return <AlertCircle size={32} className="text-red-500" />;
            case 'question': return <HelpCircle size={32} className="text-[#106ebe]" />;
            default: return <AlertCircle size={32} className="text-amber-500" />;
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[500000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" onClick={onCancel} />
            
            {/* Window */}
            <DraggableWindow id="confirm-system-dialog" title={title}>
                <div className="bg-[#f0f0f0] border border-[#106ebe] shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-[400px] flex flex-col relative animate-in zoom-in-95 duration-200">
                    {/* Title Bar */}
                    <div className="bg-[#106ebe] h-7 px-2 flex justify-between items-center text-white shrink-0 modal-header cursor-move select-none">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-tight">{title}</span>
                        </div>
                        <button onClick={onCancel} className="h-full px-2 hover:bg-red-500 transition-colors flex items-center">
                            <X size={14} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex gap-4 bg-white/50">
                        <div className="shrink-0 pt-1">
                            {getIcon()}
                        </div>
                        <div className="flex-1 space-y-2">
                            <h3 className="text-[12px] font-black text-slate-800 leading-tight uppercase">
                                {message}
                            </h3>
                            {description && (
                                <p className="text-[10px] font-medium text-slate-500 leading-relaxed italic">
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="bg-[#e1e5eb] p-3 flex justify-end gap-2 border-t border-gray-300">
                        <button 
                            onClick={onConfirm}
                            className="px-6 h-7 bg-[#106ebe] text-white text-[10px] font-black uppercase shadow-sm hover:bg-[#0d5aa0] transition-colors flex items-center gap-2"
                        >
                            <Check size={12} />
                            {confirmText}
                        </button>
                        <button 
                            onClick={onCancel}
                            className="px-6 h-7 bg-white border border-gray-400 text-slate-600 text-[10px] font-black uppercase shadow-sm hover:bg-gray-50 transition-colors"
                        >
                            {cancelText}
                        </button>
                    </div>

                    {/* Decorative Bottom Bar */}
                    <div className="h-1 bg-[#106ebe]/10" />
                </div>
            </DraggableWindow>
        </div>,
        document.body
    );
};
