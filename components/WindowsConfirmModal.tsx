import React, { useEffect, useRef } from 'react';

interface Props {
    title?: string;
    message: string;
    onConfirm: () => void;
    onDeny?: () => void; // "No" action
    onCancel?: () => void; // "Cancelar" action
    type?: 'confirm' | 'alert';
}

export const WindowsConfirmModal: React.FC<Props> = ({
    title = 'Atención',
    message,
    onConfirm,
    onDeny,
    onCancel,
    type = 'confirm'
}) => {
    const confirmBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (message) {
            // Focus the primary button on mount
            confirmBtnRef.current?.focus();

            // Trigger sound only notification
            const event = new CustomEvent('app-notification', {
                detail: {
                    type: 'ALERT',
                    message: message,
                    soundOnly: true
                }
            });
            window.dispatchEvent(event);
        }
    }, [message]);

    const isAlert = type === 'alert';

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[999999] font-['Montserrat']">
            <div
                className="bg-[#2a2d3d] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-white/10 animate-in zoom-in-95 duration-100"
                style={{ width: '450px' }}
            >
                {/* Title Bar */}
                <div className="bg-[#2a2d3d] border-b border-white/10 py-3 relative">
                    <h3 className="text-sm font-medium text-white text-center tracking-wide">{title}</h3>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                        >
                            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Content Body */}
                <div className="p-8 text-center min-h-[140px] flex items-center justify-center">
                    <p className="text-gray-200 text-[13px] font-medium leading-relaxed max-w-[90%] mx-auto">
                        {message}
                    </p>
                </div>

                {/* Button Bar */}
                <div className="pb-8 flex justify-center gap-4 px-8">
                    {!isAlert && onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-8 py-2.5 bg-transparent border border-gray-500 hover:bg-white/5 text-white text-sm font-medium rounded-md transition-all uppercase tracking-wide min-w-[120px]"
                        >
                            CANCELAR
                        </button>
                    )}
                    
                    {!isAlert && onDeny && (
                        <button
                            onClick={onDeny}
                            className="px-8 py-2.5 bg-transparent border border-gray-500 hover:bg-white/5 text-white text-sm font-medium rounded-md transition-all uppercase tracking-wide min-w-[120px]"
                        >
                            NO
                        </button>
                    )}

                    <button
                        ref={confirmBtnRef}
                        onClick={onConfirm}
                        className="px-8 py-2.5 bg-[#6b6cf0] hover:bg-[#5b5ce0] text-white text-sm font-medium rounded-md transition-all uppercase tracking-wide min-w-[120px]"
                    >
                        ACEPTAR
                    </button>
                </div>
            </div>
        </div>
    );
};
