import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

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
    const [amount, setAmount] = useState('0'); // raw digits, no auto-formatting

    useEffect(() => {
        if (isOpen) {
            setSelectedMethod('EFECTIVO');
            setAmount('0');
        }
    }, [isOpen]);

    const handleKey = useCallback((key: string) => {
        setAmount(prev => {
            if (key === 'backspace') {
                if (prev.length <= 1) return '0';
                return prev.slice(0, -1);
            }
            if (key === '.') {
                if (prev.includes('.')) return prev;
                return prev + '.';
            }
            // Limit to 2 decimal places
            const dotIdx = prev.indexOf('.');
            if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev;
            if (prev === '0') return key;
            return prev + key;
        });
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key === 'Enter') { doConfirm(); return; }
            if (e.key === 'Backspace') { handleKey('backspace'); return; }
            if (e.key === '.') { handleKey('.'); return; }
            if (e.key >= '0' && e.key <= '9') handleKey(e.key);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, selectedMethod, amount]);

    const parsedAmount = parseFloat(amount) || 0;
    // Display: show with 2 decimal places only when has a dot
    const displayAmount = amount.includes('.') ? amount : amount;
    const change = Math.max(0, parsedAmount - total);
    const canConfirm = selectedMethod !== 'EFECTIVO' || parsedAmount >= total;

    function doConfirm() {
        if (!canConfirm || isLoading) return;
        onConfirm({
            method: selectedMethod,
            cashAmount: selectedMethod === 'EFECTIVO' ? parsedAmount : undefined,
        });
    }

    if (!isOpen) return null;

    // ── Shared button styles ──────────────────────────────────────────────────
    const methodCls = (id: PaymentMethod) =>
        `w-full py-3 rounded-sm text-[10px] font-semibold uppercase tracking-widest border transition-all active:scale-95 ${selectedMethod === id
            ? 'bg-indigo-600 border-indigo-400 text-white '
            : 'bg-[#3a3d50] border-[#4c4f69] text-gray-300 hover:bg-[#44475e] hover:text-white'
        }`;

    const numCls = 'h-[48px] w-full rounded-sm bg-[#3a3d50] border border-[#4c4f69] text-white text-xl font-semibold hover:bg-[#44475e] transition-all active:scale-95 flex items-center justify-center';

    // row heights: 48px per row, 1px gap between rows
    const ROW = 48;
    const GAP = 1;
    // Total numpad height = 4 rows + 3 gaps
    const totalH = ROW * 4 + GAP * 3;   // 195px
    // Each control button = half the numpad (split 50/50 with 1px gap between them)
    const halfH = Math.floor((totalH - GAP) / 2); // 97px
    const confirmH = halfH;

    const modal = (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 ">
            <div className="bg-[#2d2f3e] rounded-lg  /50 border border-white/10" style={{ width: 640, maxWidth: '95vw' }}>

                {/* ── Title ── */}
                <div className="text-center py-4 border-b border-white/10">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80">
                        Registro Pago a Domicilio
                    </h2>
                </div>

                {/* ── Body ── */}
                <div className="flex gap-4 p-5">

                    {/* LEFT PANEL ─────────────────────────── */}
                    <div className="flex flex-col gap-2.5" style={{ width: 250 }}>

                        {/* Row 1: EFECTIVO | TARJETA */}
                        <div className="grid grid-cols-2 gap-2">
                            <button className={methodCls('EFECTIVO')} onClick={() => setSelectedMethod('EFECTIVO')}>Efectivo</button>
                            <button className={methodCls('TARJETA')} onClick={() => setSelectedMethod('TARJETA')}>Tarjeta</button>
                        </div>

                        {/* Row 2: DEPÓSITO | TRANSFERENCIA */}
                        <div className="grid grid-cols-2 gap-2">
                            <button className={methodCls('DEPOSITO')} onClick={() => setSelectedMethod('DEPOSITO')}>Depósito</button>
                            <button className={methodCls('TRANSFERENCIA')} onClick={() => setSelectedMethod('TRANSFERENCIA')}>Transferencia</button>
                        </div>

                        {/* Row 3: OTROS (same width as individual buttons above) */}
                        <div className="grid grid-cols-2 gap-2">
                            <button className={methodCls('OTROS')} onClick={() => setSelectedMethod('OTROS')}>Otros</button>
                        </div>

                        {/* Spacer */}
                        <div className="flex-1 min-h-[20px]" />

                        {/* Summary */}
                        <div className="space-y-1.5 text-[11px]">
                            <div className="flex justify-between text-gray-400 font-semibold">
                                <span>Total Orden</span>
                                <span>Q{total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-400 font-semibold">
                                <span>
                                    {selectedMethod === 'EFECTIVO' ? 'Efectivo'
                                        : selectedMethod === 'TARJETA' ? 'Tarjeta'
                                            : selectedMethod === 'DEPOSITO' ? 'Depósito'
                                                : selectedMethod === 'TRANSFERENCIA' ? 'Transferencia'
                                                    : 'Otros'}
                                </span>
                                <span>Q{parsedAmount.toFixed(2)}</span>
                            </div>
                            <div className="h-px bg-white/10" />
                            <div className="flex justify-between text-white font-semibold">
                                <span>Cambio</span>
                                <span>Q{change.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL ─────────────────────────── */}
                    <div className="flex-1 flex flex-col gap-1">

                        {/* Amount display */}
                        <div className="bg-[#1e2030] rounded-xl flex items-center justify-end px-5 border border-white/10" style={{ height: ROW }}>
                            <span className="text-[22px] font-semibold text-white tracking-tight tabular-nums">
                                Q{amount}
                            </span>
                        </div>

                        {/* Numpad row = number grid + control column */}
                        <div className="flex gap-px">

                            {/* Numbers 3-col grid */}
                            <div className="flex-1 grid grid-cols-3 gap-px">
                                {/* Row 1 */}
                                {['7', '8', '9'].map(n => <button key={n} className={numCls} onClick={() => handleKey(n)}>{n}</button>)}
                                {/* Row 2 */}
                                {['4', '5', '6'].map(n => <button key={n} className={numCls} onClick={() => handleKey(n)}>{n}</button>)}
                                {/* Row 3 */}
                                {['1', '2', '3'].map(n => <button key={n} className={numCls} onClick={() => handleKey(n)}>{n}</button>)}
                                {/* Row 4: 0 (span 2) + . */}
                                <button
                                    className={`${numCls} col-span-2`}
                                    style={{ gridColumn: 'span 2' }}
                                    onClick={() => handleKey('0')}
                                >0</button>
                                <button className={numCls} onClick={() => handleKey('.')}>.</button>
                            </div>

                            {/* Control column: backspace + confirm — fills exact numpad height */}
                            <div className="flex flex-col gap-px" style={{ width: ROW }}>
                                {/* ⌫ Backspace */}
                                <button
                                    onClick={() => handleKey('backspace')}
                                    style={{ height: halfH }}
                                    className="w-full rounded-sm bg-[#3a3d50] border border-[#4c4f69] text-gray-300 hover:bg-[#44475e] transition-all active:scale-95 flex items-center justify-center shrink-0"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                                        <line x1="18" y1="9" x2="12" y2="15" />
                                        <line x1="12" y1="9" x2="18" y2="15" />
                                    </svg>
                                </button>

                                {/* ⊙ Confirm — spans height of rows 2+3 */}
                                <button
                                    onClick={doConfirm}
                                    disabled={!canConfirm || isLoading}
                                    style={{ height: confirmH }}
                                    className={`w-full rounded-sm border flex items-center justify-center transition-all active:scale-95 shrink-0
                                        ${canConfirm
                                            ? 'bg-[#3a3d50] border-[#4c4f69] text-gray-300 hover:bg-indigo-600 hover:border-indigo-400 hover:text-white'
                                            : 'bg-[#2a2c3a] border-[#3a3d50] text-gray-600 cursor-not-allowed'
                                        }`}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="9 12 11 14 15 10" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="flex gap-3 px-5 pb-5">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 py-3 rounded-xl bg-[#3a3d50] border border-[#4c4f69] text-gray-400 font-semibold uppercase tracking-widest text-[10px] hover:bg-[#44475e] hover:text-white transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={doConfirm}
                        disabled={!canConfirm || isLoading}
                        className={`flex-1 py-3 rounded-xl font-semibold uppercase tracking-widest text-[10px] transition-all active:scale-95
                            ${canConfirm
                                ? 'bg-indigo-600 border border-indigo-400/40 text-white hover:bg-indigo-500  -600/20'
                                : 'bg-[#3a3d50] border border-[#4c4f69] text-gray-600 cursor-not-allowed'
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
