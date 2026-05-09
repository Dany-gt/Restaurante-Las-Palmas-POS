import React, { useEffect, useRef } from 'react';

interface Props {
    title?: string;
    message: string;
    onConfirm: () => void;
    onDeny?: () => void; // "No" action
    onCancel: () => void; // "Cancelar" action
}

export const WindowsConfirmModal: React.FC<Props> = ({
    title = 'Atención',
    message,
    onConfirm,
    onDeny,
    onCancel
}) => {
    const confirmBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (message) {
            // Focus the 'Sí' button on mount
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

    return (
        <div className="fixed inset-0 bg-transparent flex justify-center items-center z-[999999]">
            <div
                className="bg-[#f0f0f0] border border-[#106ebe] shadow-[2px_2px_10px_rgba(0,0,0,0.5)] flex flex-col"
                style={{ width: '420px', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' }}
            >
                {/* Title Bar */}
                <div className="flex justify-between items-center bg-[#106EBE] text-white px-3 py-1.5 select-none">
                    <span className="text-[12px] whitespace-nowrap overflow-hidden text-ellipsis">{title}</span>
                    <button
                        onClick={onCancel}
                        className="hover:bg-red-600 focus:outline-none w-6 h-6 flex items-center justify-center -mr-1 transition-colors"
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L9 9M9 1L1 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                {/* Content Body */}
                <div className="flex items-center gap-4 p-6 pt-8 pb-6 bg-[#f0f0f0]">
                    {/* Question Icon */}
                    <div className="w-[38px] h-[38px] min-w-[38px] rounded-full bg-[#106EBE] flex justify-center items-center relative text-white border-2 border-white shadow-sm overflow-hidden shrink-0">
                        <span className="text-[26px] font-medium" style={{ fontFamily: 'Times New Roman, serif', marginTop: '-1px' }}>?</span>
                    </div>

                    <p className="text-[#000000] text-[13px] pr-2 tracking-wide leading-tight flex-1">
                        {message}
                    </p>
                </div>

                {/* Button Bar */}
                <div className="bg-[#f0f0f0] px-4 pb-4 pt-2 flex justify-center gap-3">
                    <button
                        ref={confirmBtnRef}
                        onClick={onConfirm}
                        className="min-w-[85px] h-[26px] bg-[#e1e1e1] hover:bg-[#e5f1fb] border border-[#0078d7] hover:border-[#005499] text-black text-[12px] focus:outline-none relative group"
                    >
                        {/* Inner focus dotted line */}
                        <div className="absolute inset-[1px] border border-dotted border-black opacity-0 group-focus:opacity-100 pointer-events-none"></div>
                        Sí
                    </button>

                    {onDeny && (
                        <button
                            onClick={onDeny}
                            className="min-w-[85px] h-[26px] bg-[#e1e1e1] hover:bg-[#e5f1fb] border border-[#adadad] hover:border-[#0078d7] text-black text-[12px] focus:outline-none relative group"
                        >
                            <div className="absolute inset-[1px] border border-dotted border-black opacity-0 group-focus:opacity-100 pointer-events-none"></div>
                            No
                        </button>
                    )}

                    <button
                        onClick={onCancel}
                        className="min-w-[85px] h-[26px] bg-[#e1e1e1] hover:bg-[#e5f1fb] border border-[#adadad] hover:border-[#0078d7] text-black text-[12px] focus:outline-none relative group"
                    >
                        <div className="absolute inset-[1px] border border-dotted border-black opacity-0 group-focus:opacity-100 pointer-events-none"></div>
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
