import React, { useState } from 'react';
import { X, MessageSquare } from 'lucide-react';

interface ClosingNotesModalProps {
    onClose: () => void;
    onConfirm: (notes: string) => void;
}

export const ClosingNotesModal: React.FC<ClosingNotesModalProps> = ({ onClose, onConfirm }) => {
    const [notes, setNotes] = useState('');

    return (
        <div className="fixed inset-0 bg-black/80  z-[200] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#1e212b] w-full max-w-lg rounded-xl border border-white/10  /50 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-3">
                        <MessageSquare size={20} className="text-indigo-400" />
                        <span className="text-sm font-black uppercase tracking-widest text-white">Notas del Cierre</span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <textarea
                        className="w-full h-40 bg-black/20 border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none"
                        placeholder="Notas adicionales..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                onConfirm(notes);
                            }
                        }}
                        autoFocus
                    />
                </div>

                <div className="p-6 pt-0 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 h-12 rounded-xl border border-white/10 font-bold uppercase tracking-widest text-xs text-gray-400 hover:bg-white/5 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm(notes)}
                        className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold uppercase tracking-widest text-xs text-white  -600/20 transition-all"
                    >
                        Aceptar
                    </button>
                </div>
            </div>
        </div>
    );
};
