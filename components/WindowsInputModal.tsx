import React, { useState, useEffect, useRef } from 'react';

interface Props {
    title?: string;
    message: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
    placeholder?: string;
}

export const WindowsInputModal: React.FC<Props> = ({
    title = 'Entrada de Datos',
    message,
    defaultValue = '',
    onConfirm,
    onCancel,
    placeholder = 'Ingrese valor...'
}) => {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') onConfirm(value);
        if (e.key === 'Escape') onCancel();
    };

    return (
        <div className="fixed inset-0 bg-black/20 flex justify-center items-center z-[999999] backdrop-blur-[1px]">
            <div
                className="bg-[#f0f0f0] border border-[#333] shadow-[0_10px_25px_rgba(0,0,0,0.3)] flex flex-col animate-in zoom-in-95 duration-100"
                style={{ width: '400px', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' }}
            >
                {/* Title Bar */}
                <div className="flex justify-between items-center bg-[#222] text-white px-3 py-1.5 select-none">
                    <span className="text-[12px] font-bold whitespace-nowrap overflow-hidden text-ellipsis uppercase tracking-wider">{title}</span>
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
                <div className="p-6 flex flex-col gap-4">
                    <p className="text-[#000] text-[13px] font-medium leading-relaxed">
                        {message}
                    </p>
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="w-full h-9 bg-white border border-[#adadad] px-3 text-[13px] text-black outline-none focus:border-[#0078d7] transition-colors shadow-inner placeholder:text-gray-400"
                    />
                </div>

                {/* Button Bar */}
                <div className="bg-[#f0f0f0] px-4 pb-4 pt-2 flex justify-end gap-2.5">
                    <button
                        onClick={() => onConfirm(value)}
                        className="min-w-[90px] h-[28px] bg-[#333] hover:bg-[#444] border border-[#000] text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                    >
                        ACEPTAR
                    </button>
                    <button
                        onClick={onCancel}
                        className="min-w-[90px] h-[28px] bg-[#e1e1e1] hover:bg-[#d5d5d5] border border-[#adadad] text-black text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                    >
                        CANCELAR
                    </button>
                </div>
            </div>
        </div>
    );
};
