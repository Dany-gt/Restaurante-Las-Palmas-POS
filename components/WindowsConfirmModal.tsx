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
        <div className="fixed inset-0 bg-black/20 flex justify-center items-center z-[999999] ">
            <div
                className="bg-[#f0f0f0] border border-[#333]  flex flex-col animate-in zoom-in-95 duration-100"
                style={{ width: '420px', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' }}
            >
                {/* Title Bar - NEUTRALIZED */}
                <div className="flex justify-between items-center bg-[#222] text-white px-3 py-1.5 select-none">
                    <span className="text-[12px] font-bold whitespace-nowrap overflow-hidden text-ellipsis uppercase tracking-wider">{title}</span>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="hover:bg-red-600 focus:outline-none w-6 h-6 flex items-center justify-center -mr-1 transition-colors"
                        >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L9 9M9 1L1 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Content Body */}
                <div className="flex items-center gap-5 p-6 pt-8 pb-6 bg-[#f0f0f0]">
                    {/* Neutralized Icon */}
                    <div className="w-[42px] h-[42px] min-w-[42px] rounded-xl bg-[#333] flex justify-center items-center relative text-white border border-white/20  shrink-0">
                        {isAlert ? (
                            <span className="text-[22px] font-black">!</span>
                        ) : (
                            <span className="text-[24px] font-medium" style={{ fontFamily: 'Times New Roman, serif', marginTop: '-1px' }}>?</span>
                        )}
                    </div>

                    <p className="text-[#000] text-[13px] pr-2 tracking-wide font-medium leading-relaxed flex-1">
                        {message}
                    </p>
                </div>

                {/* Button Bar */}
                <div className="bg-[#f0f0f0] px-4 pb-4 pt-2 flex justify-end gap-2.5">
                    <button
                        ref={confirmBtnRef}
                        onClick={onConfirm}
                        className="min-w-[90px] h-[28px] bg-[#333] hover:bg-[#444] border border-[#000] text-white text-[11px] font-black uppercase tracking-widest focus:outline-none relative group transition-all active:scale-95 "
                    >
                        {/* Inner focus dotted line */}
                        <div className="absolute inset-[2px] border border-dotted border-white/30 opacity-0 group-focus:opacity-100 pointer-events-none"></div>
                        ACEPTAR
                    </button>

                    {!isAlert && onDeny && (
                        <button
                            onClick={onDeny}
                            className="min-w-[90px] h-[28px] bg-[#e1e1e1] hover:bg-[#d5d5d5] border border-[#adadad] text-black text-[11px] font-black uppercase tracking-widest focus:outline-none relative group transition-all active:scale-95 "
                        >
                            <div className="absolute inset-[2px] border border-dotted border-black/30 opacity-0 group-focus:opacity-100 pointer-events-none"></div>
                            NO
                        </button>
                    )}

                    {!isAlert && onCancel && (
                        <button
                            onClick={onCancel}
                            className="min-w-[90px] h-[28px] bg-[#e1e1e1] hover:bg-[#d5d5d5] border border-[#adadad] text-black text-[11px] font-black uppercase tracking-widest focus:outline-none relative group transition-all active:scale-95 "
                        >
                            <div className="absolute inset-[2px] border border-dotted border-black/30 opacity-0 group-focus:opacity-100 pointer-events-none"></div>
                            CANCELAR
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
