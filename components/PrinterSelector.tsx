import React, { useState, useEffect } from 'react';
import { Printer, Check, X, Loader2 } from 'lucide-react';

interface PrinterSelectorProps {
    onClose: () => void;
}

export const PrinterSelector: React.FC<PrinterSelectorProps> = ({ onClose }) => {
    const [printers, setPrinters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPrinter, setSelectedPrinter] = useState<string | null>(localStorage.getItem('pos_printer_name'));
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPrinters = async () => {
            if (!(window as any).electron) {
                setError('No se detectó el entorno de escritorio.');
                setLoading(false);
                return;
            }

            try {
                const list = await (window as any).electron.getPrinters();
                setPrinters(list);
            } catch (err) {
                console.error(err);
                setError('Error al obtener impresoras.');
            } finally {
                setLoading(false);
            }
        };
        fetchPrinters();
    }, []);

    const handleSelect = (printerName: string) => {
        setSelectedPrinter(printerName);
        localStorage.setItem('pos_printer_name', printerName);
    };

    const handleClear = () => {
        setSelectedPrinter(null);
        localStorage.removeItem('pos_printer_name');
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-md bg-[#1a1c23] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="text-xl font-black uppercase tracking-tighter text-white">Configurar Impresora Local</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6">
                    <div className="mb-4 text-xs text-gray-400">
                        Selecciona la impresora que se usará en <strong>esta computadora</strong> para los tickets.
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
                    ) : error ? (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-bold text-center">
                            {error}
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            <button
                                onClick={handleClear}
                                className={`w-full p-4 rounded-xl flex items-center justify-between transition-all border ${!selectedPrinter ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-white/5 border-transparent hover:bg-white/10 text-gray-300'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${!selectedPrinter ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-500'}`}>
                                        <Printer size={20} />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm uppercase">Automático</div>
                                        <div className="text-[10px] opacity-70">Usar predeterminada de Windows</div>
                                    </div>
                                </div>
                                {!selectedPrinter && <Check size={20} className="text-indigo-400" />}
                            </button>

                            {printers.map((p) => (
                                <button
                                    key={p.name}
                                    onClick={() => handleSelect(p.name)}
                                    className={`w-full p-4 rounded-xl flex items-center justify-between transition-all border ${selectedPrinter === p.name ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-white/5 border-transparent hover:bg-white/10 text-gray-300'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedPrinter === p.name ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-500'}`}>
                                            <Printer size={20} />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-sm uppercase truncate max-w-[200px]">{p.name}</div>
                                            <div className="text-[10px] opacity-70">{p.isDefault ? 'Predeterminada' : 'Disponible'}</div>
                                        </div>
                                    </div>
                                    {selectedPrinter === p.name && <Check size={20} className="text-indigo-400" />}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mt-6">
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                        >
                            Guardar y Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
