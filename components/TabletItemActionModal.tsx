import React, { useState, useEffect } from 'react';
import { Delete, Check } from 'lucide-react';
import { supabase } from '../supabase';
import { OrderItem } from '../types';

interface TabletItemActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: OrderItem | null;
    onUpdateQuantity: (id: string, newQuantity: number) => void;
    onUpdateNotes: (id: string, newNotes: string) => void;
    onEditItem: (item: OrderItem) => void;
    onDeleteItem: (item: OrderItem) => void;
    onTransferItem?: (item: OrderItem) => void;
    onSendWithoutPrinting?: (item: OrderItem) => void;
}

export const TabletItemActionModal: React.FC<TabletItemActionModalProps> = ({
    isOpen,
    onClose,
    item,
    onUpdateQuantity,
    onUpdateNotes,
    onEditItem,
    onDeleteItem,
    onTransferItem,
    onSendWithoutPrinting
}) => {
    const [quantityStr, setQuantityStr] = useState(item?.quantity?.toString() || '1');
    const [tempNotes, setTempNotes] = useState(item?.notes?.replace('*NO IMPRIMIR*', '').trim() || '');
    const [isCustomizable, setIsCustomizable] = useState<boolean>(false);

    useEffect(() => {
        if (item) {
            setQuantityStr(item.quantity?.toString() || '1');
            setTempNotes(item.notes?.replace('*NO IMPRIMIR*', '').trim() || '');
        }
    }, [item]);

    useEffect(() => {
        const checkCustomizable = async () => {
            if (!item) return;
            try {
                const { data, error } = await supabase.rpc('check_if_customizable', { p_id: item.product_id });
                if (!error) {
                    setIsCustomizable(!!data);
                }
            } catch (err) {
                console.error('Error checking customizability:', err);
            }
        };
        checkCustomizable();
    }, [item?.product_id]);

    if (!isOpen || !item) return null;

    const handleNumpadClick = (val: string) => {
        if (quantityStr === '0' || quantityStr === '1') {
            // Usually if it's 1 and they type 5, they want 5.
            if (val !== '.') {
                setQuantityStr(val);
                return;
            }
        }
        if (val === '.' && quantityStr.includes('.')) return;
        setQuantityStr(prev => prev + val);
    };

    const handleBackspace = () => {
        setQuantityStr(prev => prev.length > 1 ? prev.slice(0, -1) : '1');
    };

    const toggleNoteTag = (tag: string) => {
        setTempNotes(prev => {
            if (prev.includes(tag)) {
                return prev.replace(tag, '').trim();
            } else {
                return prev ? `${prev} ${tag}` : tag;
            }
        });
    };

    const handleAceptar = () => {
        const newQty = parseFloat(quantityStr);
        if (!isNaN(newQty) && newQty > 0) {
            onUpdateQuantity(item.id, newQty);
        }
        onUpdateNotes(item.id, tempNotes);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 animate-fade-in font-['Montserrat']">
            <div className="bg-[#2b2f3a] rounded-2xl shadow-2xl p-6 w-[700px] border border-white/10 flex flex-col gap-6">

                <div className="flex gap-6">
                    {/* Left side: Comments & Action Buttons */}
                    <div className="flex flex-col gap-4 flex-1">
                        {/* Textarea for comments */}
                        <div className="flex-1 flex flex-col relative min-h-[140px] rounded-xl overflow-hidden border border-white/5 bg-[#1f2229]">
                            <span className="absolute top-4 left-5 text-[10px] text-gray-500 font-bold uppercase tracking-widest pointer-events-none">
                                COMENTARIOS
                            </span>
                            <textarea
                                value={tempNotes}
                                onChange={(e) => setTempNotes(e.target.value)}
                                className="w-full flex-1 bg-transparent text-white p-5 pt-10 resize-none focus:outline-none focus:bg-white/[0.02] transition-colors text-sm"
                                placeholder=""
                            />
                        </div>

                        {/* Action Buttons - Gapless Grid */}
                        <div className="grid grid-cols-3 rounded-xl overflow-hidden border border-white/5 bg-[#2d303e]">
                            <button
                                onClick={() => { 
                                    onClose(); 
                                    onEditItem(item); 
                                }}
                                className="border-r border-b border-white/5 hover:bg-white/10 text-white text-[9px] font-bold uppercase tracking-wider h-16 transition-colors flex items-center justify-center text-center leading-tight"
                            >
                                EDITAR<br />PLATO
                            </button>
                            <button
                                onClick={() => { onClose(); onDeleteItem(item); }}
                                className="border-r border-b border-white/5 hover:bg-white/10 text-white text-[9px] font-bold uppercase tracking-wider h-16 transition-colors flex items-center justify-center text-center leading-tight"
                            >
                                ELIMINAR<br />PLATO
                            </button>
                            <button
                                onClick={() => { 
                                    onClose(); 
                                    if (onTransferItem) onTransferItem(item); 
                                }}
                                className="border-r border-b border-white/5 hover:bg-white/10 text-white text-[9px] font-bold uppercase tracking-wider h-16 transition-colors flex items-center justify-center text-center leading-tight"
                            >
                                TRASLADAR<br />PLATO
                            </button>
                            <button
                                onClick={() => toggleNoteTag('*PARA LLEVAR*')}
                                className={`border-r border-white/5 text-[9px] font-bold uppercase tracking-wider h-16 transition-colors flex items-center justify-center text-center leading-tight ${tempNotes.includes('*PARA LLEVAR*') ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/10 text-white'}`}
                            >
                                PARA<br />LLEVAR
                            </button>
                            <button
                                onClick={() => {
                                    onUpdateNotes(item.id || item.cart_id || '', tempNotes + (tempNotes ? ' ' : '') + '*NO IMPRIMIR*');
                                    if (onSendWithoutPrinting) {
                                        onSendWithoutPrinting({ ...item, notes: tempNotes + (tempNotes ? ' ' : '') + '*NO IMPRIMIR*' });
                                    }
                                }}
                                className={`border-r border-white/5 text-[9px] font-bold uppercase tracking-wider h-16 transition-colors flex items-center justify-center text-center leading-tight hover:bg-white/10 text-white`}
                            >
                                Enviar<br />Sin Imprimir
                            </button>
                            <button
                                onClick={() => setTempNotes('')}
                                className="hover:bg-white/10 text-white text-[9px] font-bold uppercase tracking-wider h-16 transition-colors flex items-center justify-center text-center leading-tight"
                            >
                                LIMPIAR<br />COMENTARIO
                            </button>
                        </div>
                    </div>

                    {/* Right side: Numpad - Fused design */}
                    <div className="w-[280px] flex flex-col rounded-xl overflow-hidden border border-white/5 bg-[#2d303e]">
                        {/* Header: Cantidad */}
                        <div className="bg-[#1f2229] p-4 text-center border-b border-white/5">
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">CANTIDAD</div>
                            <div className="text-4xl font-semibold text-white">{quantityStr || '1'}</div>
                        </div>

                        {/* Numpad Grid */}
                        <div className="flex flex-1">
                            {/* Numbers */}
                            <div className="grid grid-cols-3 flex-1">
                                {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'].map((num, idx) => (
                                    <button
                                        key={num}
                                        onClick={() => handleNumpadClick(num)}
                                        className={`border-r border-b border-white/5 hover:bg-white/10 text-white font-medium text-xl h-16 transition-colors ${num === '0' ? 'col-span-2' : ''
                                            } ${
                                            // Quitar borde inferior en la última fila
                                            (num === '0' || num === '.') ? 'border-b-0' : ''
                                            }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                            {/* Actions Column */}
                            <div className="flex flex-col w-16 border-l border-white/5">
                                <button
                                    onClick={handleBackspace}
                                    className="flex-1 border-b border-white/5 hover:bg-white/10 text-gray-400 flex items-center justify-center transition-colors"
                                >
                                    <Delete size={20} />
                                </button>
                                <button
                                    onClick={handleAceptar}
                                    className="flex-1 hover:bg-indigo-500/20 text-indigo-400 flex items-center justify-center transition-colors"
                                >
                                    <Check size={22} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom: Actions */}
                <div className="flex justify-center gap-4 mt-4">
                    <button
                        onClick={onClose}
                        className="w-40 bg-transparent hover:bg-white/5 text-white text-[11px] font-bold uppercase tracking-wider py-3 rounded-xl transition-colors border border-white/10"
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={handleAceptar}
                        className="w-40 bg-[#6c72ff] hover:bg-[#5a60e0] text-white text-[11px] font-bold uppercase tracking-wider py-3 rounded-xl transition-colors"
                    >
                        ACEPTAR
                    </button>
                </div>
            </div>
        </div>
    );
};
