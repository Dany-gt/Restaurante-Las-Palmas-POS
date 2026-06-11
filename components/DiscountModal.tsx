import React, { useState, useEffect, useRef } from 'react';
import { Delete, Check } from 'lucide-react';
import { supabase } from '../supabase';

interface Discount {
    id: string | null;
    name: string;
    percentage: number;
    value: number;
    type: 'PERCENT' | 'AMOUNT';
    afecta_propina?: boolean;
}

interface DiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    subtotal: number;
    onApply: (discount: Discount | null, reason?: string) => void;
    currentDiscount?: Discount | null;
    currentReason?: string;
    title?: string;
    itemContext?: string;
    tipRate?: number;
    roundTip?: boolean;
}

const parseAndFormatInput = (
    newVal: string,
    oldVal: string,
    selectionStart: number | null,
    type: 'AMOUNT' | 'PERCENT' | null
): { formatted: string; cursorPosition: number; rawValue: number } => {
    if (!type) {
        return {
            formatted: '0.00',
            cursorPosition: 4,
            rawValue: 0
        };
    }
    const cleanNew = newVal.replace(/[Qq%]/g, '');
    const cleanOld = oldVal.replace(/[Qq%]/g, '');

    if (cleanNew === '') {
        return {
            formatted: type === 'AMOUNT' ? 'Q0.00' : '0.00%',
            cursorPosition: type === 'AMOUNT' ? 2 : 1,
            rawValue: 0
        };
    }

    const hadDot = cleanOld.includes('.');
    const hasDot = cleanNew.includes('.');

    if (hadDot && !hasDot && cleanNew.length > 2) {
        const oldInt = cleanOld.split('.')[0];
        const newInt = oldInt.slice(0, -1) || '0';
        return {
            formatted: type === 'AMOUNT' ? `Q${newInt}.00` : `${newInt}.00%`,
            cursorPosition: type === 'AMOUNT' ? 1 + newInt.length : newInt.length,
            rawValue: parseFloat(newInt) || 0
        };
    }

    if (hasDot) {
        const parts = cleanNew.split('.');
        const integerPart = parts[0].replace(/[^0-9]/g, '') || '0';
        let decimalPart = parts[1].replace(/[^0-9]/g, '');

        const justTypedDot = cleanNew.endsWith('.') || (parts.length > 2) || (parts[1] === '' && !cleanOld.endsWith('.'));

        if (justTypedDot) {
            return {
                formatted: type === 'AMOUNT' ? `Q${integerPart}.00` : `${integerPart}.00%`,
                cursorPosition: type === 'AMOUNT' ? 1 + integerPart.length + 1 : integerPart.length + 1,
                rawValue: parseFloat(integerPart) || 0
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

        let newCursor = selectionStart ?? (type === 'AMOUNT' ? (1 + integerPart.length + 1 + decimalPart.length) : (integerPart.length + 1 + decimalPart.length));

        const finalLength = type === 'AMOUNT' ? (1 + integerPart.length + 1 + 2) : (integerPart.length + 1 + 2);
        if (newCursor > finalLength) {
            newCursor = finalLength;
        }

        return {
            formatted: type === 'AMOUNT' ? `Q${integerPart}.${formattedDecimals}` : `${integerPart}.${formattedDecimals}%`,
            cursorPosition: newCursor,
            rawValue: parseFloat(`${integerPart}.${formattedDecimals}`) || 0
        };
    }

    const integerPart = cleanNew.replace(/[^0-9]/g, '') || '0';
    if (integerPart === '0') {
        return {
            formatted: type === 'AMOUNT' ? 'Q0.00' : '0.00%',
            cursorPosition: type === 'AMOUNT' ? 2 : 1,
            rawValue: 0
        };
    }

    let normalizedInt = integerPart;
    if (normalizedInt.startsWith('0') && normalizedInt.length > 1) {
        normalizedInt = normalizedInt.replace(/^0+/, '');
    }

    return {
        formatted: type === 'AMOUNT' ? `Q${normalizedInt}.00` : `${normalizedInt}.00%`,
        cursorPosition: type === 'AMOUNT' ? 1 + normalizedInt.length : normalizedInt.length,
        rawValue: parseFloat(normalizedInt) || 0
    };
};

export const DiscountModal: React.FC<DiscountModalProps> = ({
    isOpen,
    onClose,
    subtotal,
    onApply,
    currentDiscount,
    currentReason = '',
    title = 'Descuentos',
    itemContext = 'Mesa',
    tipRate = 0.10,
    roundTip = true
}) => {
    const [discountType, setDiscountType] = useState<'AMOUNT' | 'PERCENT' | null>(null);
    const [displayValueStr, setDisplayValueStr] = useState<string>('0.00');
    const [reason, setReason] = useState<string>('');
    const [cursorPos, setCursorPos] = useState<number>(4);
    const [dbDiscounts, setDbDiscounts] = useState<any[]>([]);
    const wasInitialized = useRef(false);

    useEffect(() => {
        const fetchDbDiscounts = async () => {
            const { data, error } = await supabase
                .from('discount_types')
                .select('*')
                .eq('is_active', true)
                .order('name');
            if (!error && data) {
                setDbDiscounts(data);
            }
        };
        if (isOpen) {
            fetchDbDiscounts();
        }
    }, [isOpen]);

    // Force focus and select all text on mount/open
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                const input = document.getElementById('discount-input') as HTMLInputElement;
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            if (!wasInitialized.current) {
                if (currentDiscount) {
                    setDiscountType(currentDiscount.type || null);
                    const val = currentDiscount.value ? currentDiscount.value.toFixed(2) : '0.00';
                    const str = currentDiscount.type === 'PERCENT' ? `${val}%` : `Q${val}`;
                    setDisplayValueStr(str);
                    setCursorPos(str.length);
                    setReason('');
                } else {
                    // No default selection (starts as null / blank)
                    setDiscountType(null);
                    setDisplayValueStr('0.00');
                    setCursorPos(4);
                    setReason('');
                }
                wasInitialized.current = true;
            }
        } else {
            wasInitialized.current = false;
        }
    }, [isOpen, currentDiscount]);

    const handleKeyPad = (key: string) => {
        if (!discountType) {
            alert('Por favor, seleccione Descuento (Q) o Descuento (%) primero.');
            return;
        }
        const input = document.getElementById('discount-input') as HTMLInputElement;

        let start = cursorPos;
        let end = cursorPos;
        if (input && document.activeElement === input) {
            start = input.selectionStart ?? cursorPos;
            end = input.selectionEnd ?? cursorPos;
        }

        // If it is the initial Q0.00/0.00% and user types a digit/dot, let's replace all
        if ((displayValueStr === 'Q0.00' || displayValueStr === '0.00%') && key !== 'BACKSPACE') {
            start = 0;
            end = displayValueStr.length;
        }

        let newVal = displayValueStr;
        let selectionStart = start;

        const upperKey = key.toUpperCase();
        if (upperKey === 'BACKSPACE') {
            if (start !== end) {
                newVal = '';
                selectionStart = 0;
            } else if (start > 0) {
                newVal = displayValueStr.slice(0, start - 1) + displayValueStr.slice(start);
                selectionStart = start - 1;
            }
        } else {
            newVal = displayValueStr.slice(0, start) + key + displayValueStr.slice(end);
            selectionStart = start + key.length;
        }

        const res = parseAndFormatInput(newVal, displayValueStr, selectionStart, discountType);

        // Validation
        if (discountType === 'PERCENT' && res.rawValue > 100) return;
        if (discountType === 'AMOUNT' && res.rawValue > subtotal) return;

        setDisplayValueStr(res.formatted);
        setCursorPos(res.cursorPosition);

        if (input) {
            input.focus();
            setTimeout(() => {
                input.setSelectionRange(res.cursorPosition, res.cursorPosition);
            }, 0);
        }
    };

    const handleBackspace = () => {
        handleKeyPad('BACKSPACE');
    };

    const handleNumInputWithValidation = (char: string) => {
        handleKeyPad(char);
    };

    const handleReset = () => {
        const resetVal = discountType === 'AMOUNT' ? 'Q0.00' : (discountType === 'PERCENT' ? '0.00%' : '0.00');
        setDisplayValueStr(resetVal);
        setCursorPos(resetVal.length);
        const input = document.getElementById('discount-input') as HTMLInputElement;
        if (input) {
            input.focus();
            input.select();
        }
    };

    const handleTypeChange = (type: 'AMOUNT' | 'PERCENT') => {
        setDiscountType(type);

        const config = dbDiscounts.find(d => d.type === type);
        if (config) {
            const valStr = config.value.toFixed(2);
            const formatted = type === 'PERCENT' ? `${valStr}%` : `Q${valStr}`;
            setDisplayValueStr(formatted);
            setCursorPos(formatted.length);
        } else {
            const formatted = type === 'PERCENT' ? '0.00%' : 'Q0.00';
            setDisplayValueStr(formatted);
            setCursorPos(formatted.length);
        }

        setTimeout(() => {
            const input = document.getElementById('discount-input') as HTMLInputElement;
            if (input) {
                input.focus();
                input.select();
            }
        }, 50);
    };

    const handleEnterConfirm = () => {
        const enteredValue = parseFloat(displayValueStr.replace(/[Qq%]/g, '')) || 0;
        const formatted = discountType === 'PERCENT' ? `${enteredValue.toFixed(2)}%` : `Q${enteredValue.toFixed(2)}`;
        setDisplayValueStr(formatted);

        setTimeout(() => {
            const reasonInput = document.querySelector('textarea') as HTMLTextAreaElement;
            if (reasonInput) {
                reasonInput.focus();
            }
        }, 50);
    };

    const handleSubmit = () => {
        const enteredValue = parseFloat(displayValueStr.replace(/[Qq%]/g, '')) || 0;

        if (enteredValue > 0 && !discountType) {
            alert('Por favor, seleccione Descuento (Q) o Descuento (%) primero.');
            return;
        }

        if (enteredValue > 0 && !reason.trim()) {
            alert('Debe ingresar un comentario o descripción para poder aplicar el descuento.');
            return;
        }

        if (enteredValue === 0) {
            onApply(null, '');
        } else {
            const activeConfig = dbDiscounts.find(d => d.type === discountType);
            const affectsTip = activeConfig ? (activeConfig.afecta_propina ?? false) : false;

            const customDiscount: Discount = {
                id: currentDiscount?.id || null,
                name: discountType === 'AMOUNT' ? 'Descuento Manual (Q)' : 'Descuento Manual (%)',
                percentage: discountType === 'PERCENT' ? enteredValue : 0,
                value: enteredValue,
                type: discountType!,
                afecta_propina: affectsTip
            };
            onApply(customDiscount, reason);
        }
    };

    if (!isOpen) return null;

    const enteredValue = parseFloat(displayValueStr.replace(/[Qq%]/g, '')) || 0;

    // Calculate discount amount
    const discountAmount = discountType === 'AMOUNT'
        ? Math.min(enteredValue, subtotal)
        : Math.min((subtotal * enteredValue) / 100, subtotal);

    const subtotalAfterDiscount = Math.max(subtotal - discountAmount, 0);

    // Calculate tip (propina)
    const activeConfig = discountType ? dbDiscounts.find(d => d.type === discountType) : null;
    const affectsTip = activeConfig ? (activeConfig.afecta_propina ?? false) : false;

    const calculatedTip = (affectsTip ? subtotalAfterDiscount : subtotal) * tipRate;
    const tipVal = roundTip ? Math.round(calculatedTip) : parseFloat(calculatedTip.toFixed(2));

    // Calculate grand total
    const totalVal = subtotalAfterDiscount + tipVal;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 touch-none">
            <div
                className="bg-[#2d2e3d] flex flex-col overflow-hidden text-white shadow-2xl"
                style={{ width: '930px', height: '560px' }}
            >
                {/* Body */}
                <div className="flex">
                    {/* Left Column: Config and summary */}
                    <div className="flex-1 flex flex-col p-6 pr-4">
                        {/* Title Bar */}
                        <div className="w-full bg-[#3a3b4d] py-2.5 mb-4 flex items-center justify-center">
                            <h3 className="text-[16px] font-semibold text-white tracking-wide">Descuentos</h3>
                        </div>

                        {/* Selector de tipo de descuento */}
                        <div className="flex justify-center gap-4">
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleTypeChange('AMOUNT')}
                                style={{ width: '166.30px' }}
                                className={`h-12 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors border rounded-md ${discountType === 'AMOUNT'
                                    ? 'bg-[#5c60f5] border-[#5c60f5] text-white'
                                    : 'bg-[#3a3b4d] border-transparent text-white hover:bg-[#45465a]'
                                    }`}
                            >
                                Descuento (Q)
                            </button>
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleTypeChange('PERCENT')}
                                style={{ width: '166.30px' }}
                                className={`h-12 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors border rounded-md ${discountType === 'PERCENT'
                                    ? 'bg-[#5c60f5] border-[#5c60f5] text-white'
                                    : 'bg-[#3a3b4d] border-transparent text-white hover:bg-[#45465a]'
                                    }`}
                            >
                                Descuento (%)
                            </button>
                        </div>

                        {/* Contenedor inferior: Línea + Descripción y Resumen */}
                        <div className="flex flex-col mt-auto">
                            <div className="w-full border-t border-white/10 mb-4"></div>

                            <div className="flex gap-6 items-end">
                                {/* Input de Descripción */}
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Descripción..."
                                    className="bg-transparent border border-white/10 p-3 text-[12px] font-medium focus:outline-none resize-none text-white placeholder:text-white/40 rounded-md"
                                    style={{ width: '290px', height: '136.06px' }}
                                />

                                {/* Resumen Financiero */}
                                <div className="flex-1 flex flex-col justify-end min-w-[230px]" style={{ gap: '10px' }}>
                                    <div className="flex justify-between text-[13px] font-medium text-white">
                                        <span>SubTotal</span>
                                        <span>Q{subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[13px] font-medium text-white">
                                        <span>Descuento</span>
                                        <span>Q{discountAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[13px] font-medium text-white">
                                        <span>Propina</span>
                                        <span>Q{tipVal.toFixed(2)}</span>
                                    </div>
                                    <div className="border-t border-dashed border-white/20 pt-3 flex justify-between items-center text-[16px] font-bold text-white h-10">
                                        <span>Total</span>
                                        <span>Q{totalVal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Keypad */}
                    <div className="relative py-6 pr-6 pl-4 flex flex-col gap-3 ml-auto before:content-[''] before:absolute before:left-0 before:top-6 before:bottom-8 before:w-px before:bg-white/5">
                        <div
                            className="bg-black/30 border border-white/10 h-14 flex items-center justify-center px-4 shrink-0 overflow-hidden cursor-text select-text"
                            style={{ width: '309px' }}
                            onClick={() => document.getElementById('discount-input')?.focus()}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            <div className="w-full h-full flex items-center justify-center">
                                <input
                                    id="discount-input"
                                    type="text"
                                    inputMode="none"
                                    data-no-keyboard="true"
                                    value={displayValueStr}
                                    onFocus={(e) => {
                                        e.target.select();
                                        setCursorPos(e.target.value.length);
                                    }}
                                    onSelect={(e) => setCursorPos(e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                                    onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                                    onMouseUp={(e) => setCursorPos(e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                                    onTouchStart={(e) => {
                                        e.preventDefault();
                                        document.getElementById('discount-input')?.focus();
                                    }}
                                    onContextMenu={(e) => e.preventDefault()}
                                    onChange={(e) => {
                                        if (!discountType) {
                                            alert('Por favor, seleccione Descuento (Q) o Descuento (%) primero.');
                                            return;
                                        }
                                        const input = e.target;
                                        const res = parseAndFormatInput(input.value, displayValueStr, input.selectionStart, discountType);

                                        // Validation
                                        if (discountType === 'PERCENT' && res.rawValue > 100) return;
                                        if (discountType === 'AMOUNT' && res.rawValue > subtotal) return;

                                        setDisplayValueStr(res.formatted);
                                        setCursorPos(res.cursorPosition);
                                        setTimeout(() => {
                                            input.setSelectionRange(res.cursorPosition, res.cursorPosition);
                                        }, 0);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleEnterConfirm();
                                        }
                                    }}
                                    className="w-full h-10 bg-transparent focus:outline-none p-0 m-0 border-none outline-none text-2xl font-bold tracking-wider tabular-nums text-center text-white selection:bg-[#5c60f5] selection:text-white"
                                />
                            </div>
                        </div>

                        {/* Teclado y Botón de reiniciar */}
                        <div className="flex flex-col gap-[1px]" style={{ height: '340px' }}>
                            {/* Rejilla de teclas */}
                            <div
                                className="grid gap-[1px] bg-white/5 border border-white/10 overflow-hidden w-fit"
                                style={{
                                    gridTemplateColumns: 'repeat(4, 76px)',
                                    gridTemplateRows: 'repeat(4, 74px)'
                                }}
                            >
                                {/* Fila 1 */}
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleNumInputWithValidation('7')} className="bg-[#2d2e3d] hover:bg-[#3a3b4d] w-full h-full text-lg font-bold text-white transition-colors flex items-center justify-center">7</button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleNumInputWithValidation('8')} className="bg-[#2d2e3d] hover:bg-[#3a3b4d] w-full h-full text-lg font-bold text-white transition-colors flex items-center justify-center">8</button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleNumInputWithValidation('9')} className="bg-[#2d2e3d] hover:bg-[#3a3b4d] w-full h-full text-lg font-bold text-white transition-colors flex items-center justify-center">9</button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={handleBackspace} className="row-span-2 w-full h-full bg-[#2d2e3d] hover:bg-[#3a3b4d] text-white/70 hover:text-white transition-colors flex items-center justify-center">
                                    <Delete size={20} strokeWidth={1.5} />
                                </button>

                                {/* Fila 2 */}
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleNumInputWithValidation('4')} className="bg-[#2d2e3d] hover:bg-[#3a3b4d] w-full h-full text-lg font-bold text-white transition-colors flex items-center justify-center">4</button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleNumInputWithValidation('5')} className="bg-[#2d2e3d] hover:bg-[#3a3b4d] w-full h-full text-lg font-bold text-white transition-colors flex items-center justify-center">5</button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleNumInputWithValidation('6')} className="bg-[#2d2e3d] hover:bg-[#3a3b4d] w-full h-full text-lg font-bold text-white transition-colors flex items-center justify-center">6</button>

                                {/* Fila 3 */}
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleNumInputWithValidation('1')} className="bg-[#2d2e3d] hover:bg-[#3a3b4d] w-full h-full text-lg font-bold text-white transition-colors flex items-center justify-center">1</button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleNumInputWithValidation('2')} className="bg-[#2d2e3d] hover:bg-[#3a3b4d] w-full h-full text-lg font-bold text-white transition-colors flex items-center justify-center">2</button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleNumInputWithValidation('3')} className="bg-[#2d2e3d] hover:bg-[#3a3b4d] w-full h-full text-lg font-bold text-white transition-colors flex items-center justify-center">3</button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={handleEnterConfirm} className="row-span-2 w-full h-full bg-[#2d2e3d] hover:bg-[#3a3b4d] text-white/70 hover:text-white transition-colors flex items-center justify-center">
                                    <div className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center">
                                        <Check size={18} strokeWidth={1.5} />
                                    </div>
                                </button>

                                {/* Fila 4 */}
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleNumInputWithValidation('0')} className="col-span-2 w-full h-full bg-[#2d2e3d] hover:bg-[#3a3b4d] text-lg font-bold text-white transition-colors flex items-center justify-center">0</button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleNumInputWithValidation('.')} className="bg-[#2d2e3d] hover:bg-[#3a3b4d] w-full h-full text-lg font-bold text-white transition-colors flex items-center justify-center">.</button>
                            </div>

                            {/* Botón de reiniciar */}
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={handleReset}
                                className="h-12 bg-transparent border border-white/10 hover:bg-white/5 text-[20px] font-bold text-white transition-colors tracking-wide shrink-0 rounded-md"
                                style={{ width: '309px' }}
                            >
                                Reiniciar
                            </button>
                        </div>
                    </div>

                </div>

                {/* Footer Buttons */}
                <div className="px-6 pb-6 pt-4 flex justify-center items-center gap-4">
                    <button
                        onClick={onClose}
                        className="h-12 px-12 bg-transparent border border-white/10 text-[13px] font-bold tracking-[0.15em] text-white hover:text-white hover:bg-white/5 transition-colors uppercase rounded-md"
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="h-12 px-12 bg-[#5c60f5] hover:bg-[#4b4ed6] text-[13px] font-bold tracking-[0.15em] text-white transition-colors uppercase rounded-md"
                    >
                        ACEPTAR
                    </button>
                </div>
            </div>
        </div>
    );
};
