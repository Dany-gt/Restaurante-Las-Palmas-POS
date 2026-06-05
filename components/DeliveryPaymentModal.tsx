import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const parseAndFormatAmount = (
    newVal: string, 
    oldVal: string, 
    selectionStart: number | null
): { formatted: string; cursorPosition: number } => {
    const cleanNew = newVal.replace(/[Qq]/g, '');
    const cleanOld = oldVal.replace(/[Qq]/g, '');
    
    if (cleanNew === '') {
        return { formatted: 'Q0.00', cursorPosition: 2 };
    }
    
    const hadDot = cleanOld.includes('.');
    const hasDot = cleanNew.includes('.');
    
    if (hadDot && !hasDot && cleanNew.length > 2) {
        const oldInt = cleanOld.split('.')[0];
        const newInt = oldInt.slice(0, -1) || '0';
        return {
            formatted: `Q${newInt}.00`,
            cursorPosition: 1 + newInt.length
        };
    }
    
    if (hasDot) {
        const parts = cleanNew.split('.');
        const integerPart = parts[0].replace(/[^0-9]/g, '') || '0';
        let decimalPart = parts[1].replace(/[^0-9]/g, '');
        
        const justTypedDot = cleanNew.endsWith('.') || (parts.length > 2) || (parts[1] === '' && !cleanOld.endsWith('.'));
        
        if (justTypedDot) {
            return {
                formatted: `Q${integerPart}.00`,
                cursorPosition: 1 + integerPart.length + 1
            };
        }
        
        let formattedDecimals = decimalPart;
        if (formattedDecimals.length === 0) {
            formattedDecimals = '00';
        } else if (formattedDecimals.length === 1) {
            formattedDecimals = formattedDecimals + '0';
        } else {
            formattedDecimals = formattedDecimals.slice(0, 2);
        }
        
        let newCursor = selectionStart ?? (1 + integerPart.length + 1 + decimalPart.length);
        const finalLength = 1 + integerPart.length + 1 + 2;
        if (newCursor > finalLength) {
            newCursor = finalLength;
        }
        
        return {
            formatted: `Q${integerPart}.${formattedDecimals}`,
            cursorPosition: newCursor
        };
    }
    
    const integerPart = cleanNew.replace(/[^0-9]/g, '') || '0';
    if (integerPart === '0') {
        return { formatted: 'Q0.00', cursorPosition: 2 };
    }
    
    let normalizedInt = integerPart;
    if (normalizedInt.startsWith('0') && normalizedInt.length > 1) {
        normalizedInt = normalizedInt.replace(/^0+/, '');
    }
    
    return {
        formatted: `Q${normalizedInt}.00`,
        cursorPosition: 1 + normalizedInt.length
    };
};

interface DeliveryPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (paymentData: { method: string; cashAmount?: number }) => void;
    isLoading?: boolean;
    total: number;
}

type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'DEPOSITO' | 'TRANSFERENCIA' | 'OTROS';

export const DeliveryPaymentModal: React.FC<DeliveryPaymentModalProps> = ({
    isOpen, onClose, onConfirm, isLoading, total
}) => {
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('EFECTIVO');
    const [amount, setAmount] = useState('Q0.00'); // amount holds the full string like Q0.00

    useEffect(() => {
        if (isOpen) {
            setSelectedMethod('EFECTIVO');
            setAmount('Q0.00');
        }
    }, [isOpen]);

    // Force focus and select all text on mount/open
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            const input = document.getElementById('price-input') as HTMLInputElement;
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [isOpen]);

    const handleKey = useCallback((key: string) => {
        const input = document.getElementById('price-input') as HTMLInputElement;
        if (input && document.activeElement !== input) {
            input.focus();
        }
        setAmount(prev => {
            let cursorStart = prev.length;
            let cursorEnd = prev.length;
            if (input) {
                cursorStart = input.selectionStart ?? prev.length;
                cursorEnd = input.selectionEnd ?? prev.length;
            }
            
            let newVal = prev;
            let selectionStart: number | null = null;
            
            if (key === 'backspace') {
                if (cursorStart !== cursorEnd) {
                    newVal = '';
                    selectionStart = 0;
                } else if (cursorStart > 0) {
                    newVal = prev.slice(0, cursorStart - 1) + prev.slice(cursorStart);
                    selectionStart = cursorStart - 1;
                } else {
                    return prev;
                }
            } else if (key === '.') {
                if (cursorStart !== cursorEnd) {
                    newVal = '.';
                    selectionStart = 1;
                } else {
                    newVal = prev.slice(0, cursorStart) + '.' + prev.slice(cursorStart);
                    selectionStart = cursorStart + 1;
                }
            } else {
                // Digit key
                if (cursorStart !== cursorEnd) {
                    newVal = key;
                    selectionStart = 1;
                } else {
                    newVal = prev.slice(0, cursorStart) + key + prev.slice(cursorStart);
                    selectionStart = cursorStart + 1;
                }
            }
            
            const res = parseAndFormatAmount(newVal, prev, selectionStart);
            
            if (input) {
                setTimeout(() => {
                    input.setSelectionRange(res.cursorPosition, res.cursorPosition);
                }, 0);
            }
            
            return res.formatted;
        });
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key === 'Enter') { doConfirm(); return; }

            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            if (e.key === 'Backspace') { handleKey('backspace'); return; }
            if (e.key === '.') { handleKey('.'); return; }
            if (e.key >= '0' && e.key <= '9') handleKey(e.key);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, selectedMethod, amount, handleKey]);

    const parsedAmount = parseFloat(amount.replace('Q', '')) || 0;
    const change = Math.max(0, parsedAmount - total);
    const canConfirm = true;
    const isInitial = amount === 'Q0.00';

    function doConfirm() {
        if (isLoading) return;
        onConfirm({
            method: selectedMethod,
            cashAmount: selectedMethod === 'EFECTIVO'
                ? (parsedAmount === 0 ? total : parsedAmount)
                : undefined,
        });
    }

    if (!isOpen) return null;

    // ── Shared button styles ──────────────────────────────────────────────────
    const methodCls = (id: PaymentMethod) =>
        `w-[178.6px] py-4 rounded-md text-xs font-bold uppercase tracking-wider border transition-all active:scale-95 ${selectedMethod === id
            ? 'bg-[#737df2] border-transparent text-white shadow-md'
            : 'bg-[#2c2d3e] border-[#3b3c4f] text-white hover:bg-[#34364d]'
        }`;

    const numCls = 'bg-[#2c2d3e] text-white text-2xl font-medium hover:bg-[#34364d] transition-all active:scale-95 flex items-center justify-center';

    const renderNumButton = (key: string, extraCls = '') => (
        <button
            onMouseDown={(e) => { e.preventDefault(); handleKey(key); }}
            onTouchStart={(e) => { e.preventDefault(); handleKey(key); }}
            className={`${numCls} ${extraCls}`}
        >
            {key}
        </button>
    );

    const modal = (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 ">
            <div className="bg-[#232533] rounded-xl flex flex-col border border-white/10" style={{ width: 822, height: 516, maxWidth: '95vw', maxHeight: '95vh' }}>

                {/* ── Title ── */}
                <div className="text-center pt-4 pb-2.5 shrink-0 border-b border-white/10">
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">
                        Registro Pago a Domicilio
                    </h2>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 flex px-6 pt-3.5 pb-0 min-h-0">

                    {/* LEFT PANEL ─────────────────────────── */}
                    <div className="flex flex-col gap-[18px] pr-4" style={{ width: '436.58px' }}>

                        {/* Row 1: EFECTIVO | TARJETA */}
                        <div className="flex justify-between">
                            <button className={methodCls('EFECTIVO')} onClick={() => setSelectedMethod('EFECTIVO')}>Efectivo</button>
                            <button className={methodCls('TARJETA')} onClick={() => setSelectedMethod('TARJETA')}>Tarjeta</button>
                        </div>

                        {/* Row 2: DEPÓSITO | TRANSFERENCIA */}
                        <div className="flex justify-between">
                            <button className={methodCls('DEPOSITO')} onClick={() => setSelectedMethod('DEPOSITO')}>Depósito</button>
                            <button className={methodCls('TRANSFERENCIA')} onClick={() => setSelectedMethod('TRANSFERENCIA')}>Transferencia</button>
                        </div>

                        {/* Row 3: OTROS */}
                        <div className="flex gap-3">
                            <button className={methodCls('OTROS')} onClick={() => setSelectedMethod('OTROS')}>Otros</button>
                        </div>

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Summary */}
                        <div className="bg-[#3a3b4d] rounded-lg border border-white/5 flex flex-col justify-between overflow-hidden mb-[28.5px]">
                            <div className="p-4 pb-0 space-y-3">
                                <div className="flex justify-between text-white text-sm font-medium">
                                    <span>Total Orden</span>
                                    <span>Q{total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-white text-sm font-medium">
                                    <span>
                                        {selectedMethod === 'EFECTIVO' ? 'Efectivo'
                                            : selectedMethod === 'TARJETA' ? 'Tarjeta'
                                                : selectedMethod === 'DEPOSITO' ? 'Depósito'
                                                    : selectedMethod === 'TRANSFERENCIA' ? 'Transferencia'
                                                        : 'Otros'}
                                    </span>
                                    <span>Q{parsedAmount.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="relative flex flex-col justify-start px-4 pt-3 shrink-0" style={{ height: 48 }}>
                                <div className="absolute top-0 left-4 right-4 border-t border-white/30 border-dashed" />
                                <div className="flex justify-between text-white font-bold text-base">
                                    <span>Cambio</span>
                                    <span>Q{change.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Divider line in the middle separating Left Panel from Right Panel */}
                    <div className="w-px bg-[#3b3c4f]/50 self-stretch my-2 shrink-0"></div>

                    {/* RIGHT PANEL ─────────────────────────── */}
                    <div className="flex flex-col gap-3 min-h-0 items-end justify-end" style={{ width: '337.36px', paddingLeft: '18.36px' }}>

                        {/* Amount display */}
                        <div
                            className="bg-[#242533] border border-[#4b4e63] rounded-lg flex items-center justify-center shrink-0 overflow-hidden cursor-text"
                            style={{ height: 60, width: 319 }}
                            onClick={() => document.getElementById('price-input')?.focus()}
                        >
                            <input
                                id="price-input"
                                type="text"
                                inputMode="none" /* Prevent OS virtual keyboard from popping up */
                                data-no-keyboard="true"
                                value={amount}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onChange={(e) => {
                                    const input = e.target;
                                    const res = parseAndFormatAmount(input.value, amount, input.selectionStart);
                                    setAmount(res.formatted);
                                    setTimeout(() => {
                                        input.setSelectionRange(res.cursorPosition, res.cursorPosition);
                                    }, 0);
                                }}
                                className="w-full h-full bg-transparent focus:outline-none p-0 m-0 border-none outline-none text-3xl font-semibold tracking-tight tabular-nums text-center text-white selection:bg-[#0078d7] selection:text-white"
                            />
                        </div>

                        {/* Numpad */}
                        <div
                            className="grid grid-cols-4 grid-rows-4 gap-px bg-[#4c4d61] rounded-lg overflow-hidden border border-[#4c4d61] shrink-0"
                            style={{ width: 319, height: 303 }}
                        >
                            {/* Row 1 */}
                            {renderNumButton('7')}
                            {renderNumButton('8')}
                            {renderNumButton('9')}

                            {/* Backspace spans 2 rows */}
                            <button
                                onMouseDown={(e) => { e.preventDefault(); handleKey('backspace'); }}
                                onTouchStart={(e) => { e.preventDefault(); handleKey('backspace'); }}
                                className="row-span-2 bg-[#3a3b4d] text-white hover:bg-[#45475c] transition-all active:scale-95 flex items-center justify-center"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                                    <line x1="18" y1="9" x2="12" y2="15" />
                                    <line x1="12" y1="9" x2="18" y2="15" />
                                </svg>
                            </button>

                            {/* Row 2 */}
                            {renderNumButton('4')}
                            {renderNumButton('5')}
                            {renderNumButton('6')}

                            {/* Row 3 */}
                            {renderNumButton('1')}
                            {renderNumButton('2')}
                            {renderNumButton('3')}

                            {/* Confirm spans 2 rows */}
                            <button
                                onClick={doConfirm}
                                disabled={!canConfirm || isLoading}
                                className={`row-span-2 flex items-center justify-center transition-all active:scale-95
                                    ${canConfirm
                                        ? 'bg-[#3a3b4d] text-white hover:bg-[#45475c]'
                                        : 'bg-[#20212f] text-gray-600 cursor-not-allowed'
                                    }`}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="9 12 11 14 15 10" />
                                </svg>
                            </button>

                            {/* Row 4 */}
                            {renderNumButton('0', 'col-span-2')}
                            {renderNumButton('.')}
                        </div>
                    </div>
                </div>

                {/* ── Footer / Centered Action buttons ── */}
                <div className="flex justify-center gap-4 pb-5 pt-2 shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="w-[140px] h-11 rounded-md bg-[#2c2d3e] border border-[#3b3c4f] text-white font-bold uppercase tracking-wider text-xs hover:bg-[#34364d] transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={doConfirm}
                        disabled={!canConfirm || isLoading}
                        className={`w-[140px] h-11 rounded-md font-bold uppercase tracking-wider text-xs transition-all active:scale-95 shadow-md
                            ${canConfirm
                                ? 'bg-[#737df2] text-white hover:bg-[#6264f1]'
                                : 'bg-[#20212f] border border-[#3b3c4f]/50 text-gray-600 cursor-not-allowed shadow-none'
                            }`}
                    >
                        {isLoading ? 'Procesando...' : 'Aceptar'}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
};
