import React, { useRef } from 'react';
import { X, Printer, FileText, Save, FolderOpen, Settings, Layout, Search, Grid, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileType, Columns } from 'lucide-react';
import { DraggableWindow } from './AdminPortal';

interface ExpenseReportViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportHtml: string;
}

export const ExpenseReportViewerModal: React.FC<ExpenseReportViewerModalProps> = ({
    isOpen,
    onClose,
    reportHtml
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    if (!isOpen) return null;

    const handlePrint = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.focus();
            iframeRef.current.contentWindow.print();
        }
    };

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center animate-fade-in pointer-events-none">
            <div className="absolute inset-0 pointer-events-auto bg-black/20" onClick={onClose} />
            <DraggableWindow id="expense-report-viewer" title="Visor de Reporte">
                <div className="bg-[#f0f0f0] w-full max-w-[95vw] h-[95vh] border border-[#707070] shadow-2xl flex flex-col overflow-hidden pointer-events-auto relative">

                    {/* Title Bar */}
                    <div className="h-7 bg-[#106ebe] flex items-center justify-between px-2 shrink-0 select-none modal-header">
                        <div className="flex items-center gap-2">
                            <FileText size={14} className="text-white" />
                            <span className="text-white text-[11px] font-bold">Vista previa</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={onClose} className="w-5 h-5 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-all">
                                <X size={14} strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    {/* Ribbon Toolbar */}
                    <div className="bg-[#f5f6f7] border-b border-[#dadada] flex items-stretch shrink-0 py-1 overflow-x-auto no-scrollbar">
                        {/* Group: Documento */}
                        <div className="px-3 border-r border-[#dadada] flex flex-col items-center">
                            <div className="flex gap-2 mb-1 h-12 items-center">
                                <div className="flex flex-col items-center group cursor-pointer px-1 hover:bg-[#e5f1fb] border border-transparent hover:border-[#a0c7e4] rounded-sm transition-all grayscale hover:grayscale-0">
                                    <FolderOpen size={24} className="text-[#5b5b5b]" />
                                    <span className="text-[9px] mt-0.5">Abrir</span>
                                </div>
                                <div className="flex flex-col items-center group cursor-pointer px-1 hover:bg-[#e5f1fb] border border-transparent hover:border-[#a0c7e4] rounded-sm transition-all grayscale hover:grayscale-0">
                                    <Save size={24} className="text-[#3c7cbc]" />
                                    <span className="text-[9px] mt-0.5">Guardar</span>
                                </div>
                            </div>
                            <span className="text-[9px] text-[#808080] font-bold uppercase tracking-tighter">Documento</span>
                        </div>

                        {/* Group: Imprimir */}
                        <div className="px-3 border-r border-[#dadada] flex flex-col items-center">
                            <div className="flex gap-2 mb-1 h-12 items-center">
                                <div
                                    onClick={handlePrint}
                                    className="flex flex-col items-center group cursor-pointer px-2 hover:bg-[#e5f1fb] border border-transparent hover:border-[#a0c7e4] rounded-sm transition-all"
                                >
                                    <Printer size={24} className="text-[#2b2b2b]" />
                                    <span className="text-[9px] mt-0.5 font-bold">Imprimir</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5 px-1 hover:bg-[#e5f1fb] rounded-sm cursor-pointer grayscale hover:grayscale-0">
                                        <Printer size={12} className="text-[#5b5b5b]" />
                                        <span className="text-[9px]">Impresión rápida</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-1 hover:bg-[#e5f1fb] rounded-sm cursor-pointer grayscale hover:grayscale-0">
                                        <Settings size={12} className="text-[#5b5b5b]" />
                                        <span className="text-[9px]">Opciones</span>
                                    </div>
                                </div>
                            </div>
                            <span className="text-[9px] text-[#808080] font-bold uppercase tracking-tighter">Imprimir</span>
                        </div>

                        {/* Group: Configurar Página */}
                        <div className="px-3 border-r border-[#dadada] flex flex-col items-center">
                            <div className="flex gap-3 mb-1 h-12 items-center grayscale">
                                <div className="flex flex-col items-center group cursor-pointer px-1 hover:bg-[#e5f1fb]">
                                    <Layout size={20} className="text-[#5b5b5b]" />
                                    <span className="text-[9px] mt-0.5">Márgenes</span>
                                </div>
                                <div className="flex flex-col items-center group cursor-pointer px-1 hover:bg-[#e5f1fb]">
                                    <Columns size={20} className="text-[#3c7cbc]" />
                                    <span className="text-[9px] mt-0.5">Orientación</span>
                                </div>
                                <div className="flex flex-col items-center group cursor-pointer px-1 hover:bg-[#e5f1fb]">
                                    <FileType size={20} className="text-[#5b5b5b]" />
                                    <span className="text-[9px] mt-0.5">Tamaño</span>
                                </div>
                            </div>
                            <span className="text-[9px] text-[#808080] font-bold uppercase tracking-tighter">Configurar Página</span>
                        </div>

                        {/* Group: Navegación */}
                        <div className="px-3 border-r border-[#dadada] flex flex-col items-center grayscale">
                            <div className="flex gap-3 mb-1 h-12 items-center">
                                <div className="flex flex-col items-center cursor-pointer px-1">
                                    <ChevronsLeft size={20} className="text-[#2b2b2b]" />
                                    <span className="text-[9px] mt-0.5">Primera</span>
                                </div>
                                <div className="flex flex-col items-center cursor-pointer px-1">
                                    <ChevronLeft size={20} className="text-[#2b2b2b]" />
                                    <span className="text-[9px] mt-0.5">Anterior</span>
                                </div>
                                <div className="flex flex-col items-center cursor-pointer px-1">
                                    <ChevronRight size={20} className="text-[#2b2b2b]" />
                                    <span className="text-[9px] mt-0.5">Siguiente</span>
                                </div>
                                <div className="flex flex-col items-center cursor-pointer px-1">
                                    <ChevronsRight size={20} className="text-[#2b2b2b]" />
                                    <span className="text-[9px] mt-0.5">Última</span>
                                </div>
                            </div>
                            <span className="text-[9px] text-[#808080] font-bold uppercase tracking-tighter">Navegación</span>
                        </div>

                        {/* Right: Close */}
                        <div className="ml-auto px-4 flex flex-col items-center justify-center">
                            <button
                                onClick={onClose}
                                className="flex flex-col items-center group cursor-pointer px-3 py-1 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-sm transition-all"
                            >
                                <X size={24} className="text-red-500" />
                                <span className="text-[10px] text-red-600 font-bold mt-0.5 uppercase">Cerrar</span>
                            </button>
                        </div>
                    </div>

                    {/* Viewer Body: Classic Blue Background */}
                    <div className="flex-1 bg-[#3a6ea5] p-10 overflow-auto flex justify-center custom-scrollbar shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">
                        <div className="w-full max-w-[21cm] min-h-[29.7cm] bg-white shadow-[10px_10px_30px_rgba(0,0,0,0.4)] overflow-hidden rounded-sm ring-1 ring-black/10 transition-all flex flex-col">
                            <iframe
                                ref={iframeRef}
                                srcDoc={reportHtml}
                                className="flex-1 w-full border-none"
                                title="Reporte PDF"
                            />
                        </div>
                    </div>

                    {/* Status Bar */}
                    <div className="h-6 bg-[#f0f0f0] border-t border-[#dadada] flex items-center justify-between px-4 shrink-0 select-none">
                        <span className="text-[10px] text-gray-500 font-bold">Página 1 de 1</span>
                        <div className="flex items-center gap-4 grayscale opacity-60">
                            <div className="flex items-center gap-2">
                                <ZoomOut size={12} />
                                <div className="w-24 h-1 bg-gray-300 rounded-full relative">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#106ebe] rounded-full shadow-sm"></div>
                                </div>
                                <ZoomIn size={12} />
                            </div>
                            <span className="text-[10px] text-gray-500 font-bold">100%</span>
                        </div>
                    </div>

                </div>
            </DraggableWindow>
        </div>
    );
};
