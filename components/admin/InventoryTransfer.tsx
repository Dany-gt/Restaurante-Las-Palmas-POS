import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Loader2, Plus, Edit2, History, Trash2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { InventoryTransferModal } from './InventoryTransferModal';

export const InventoryTransfer: React.FC = () => {
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTransfer, setEditingTransfer] = useState<any>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: any } | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const [sentTransfers, setSentTransfers] = useState<any[]>([]);
    const [receivedTransfers, setReceivedTransfers] = useState<any[]>([]);

    useEffect(() => {
        fetchBranches();
        fetchTransfers();
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [selectedBranch]);

    const fetchBranches = async () => {
        const { data } = await supabase.from('branches').select('id, name').order('name');
        if (data) {
            setBranches(data);
            if (data.length > 0 && !selectedBranch) setSelectedBranch(data[0].id);
        }
    };

    const fetchTransfers = async () => {
        if (!selectedBranch) return;
        setLoading(true);
        try {
            // Fetch Sent Transfers (transfers from this branch)
            const { data: sent, error: sentErr } = await supabase
                .from('inventory_transfers')
                .select(`
                    *,
                    to_branch:branches!to_branch_id(name),
                    creator:auth.users!created_by(email)
                `)
                .eq('from_branch_id', selectedBranch)
                .order('created_at', { ascending: false });

            if (sentErr) throw sentErr;
            setSentTransfers(sent || []);

            // Fetch Received Transfers (transfers to this branch)
            const { data: received, error: receivedErr } = await supabase
                .from('inventory_transfers')
                .select(`
                    *,
                    from_branch:branches!from_branch_id(name),
                    creator:auth.users!created_by(email)
                `)
                .eq('to_branch_id', selectedBranch)
                .order('created_at', { ascending: false });

            if (receivedErr) throw receivedErr;
            setReceivedTransfers(received || []);
        } catch (error) {
            console.error('Error fetching transfers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNew = () => {
        setEditingTransfer(null);
        setShowModal(true);
        setContextMenu(null);
    };

    const handleEdit = (item: any) => {
        setEditingTransfer(item);
        setShowModal(true);
        setContextMenu(null);
    };

    const handleDelete = (item: any) => {
        setShowDeleteConfirm(item);
        setContextMenu(null);
    };

    const confirmDelete = async () => {
        if (!showDeleteConfirm) return;

        // If it's the mock ID from earlier or not a UUID, just clear it locally
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(showDeleteConfirm.id);

        if (!isUUID) {
            setSentTransfers(prev => prev.filter(t => t.id !== showDeleteConfirm.id));
            setReceivedTransfers(prev => prev.filter(t => t.id !== showDeleteConfirm.id));
            setShowDeleteConfirm(null);
            return;
        }

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('inventory_transfers')
                .delete()
                .eq('id', showDeleteConfirm.id);

            if (error) throw error;

            await fetchTransfers();
            setShowDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting transfer:', error);
            alert('Error al eliminar el traslado: ' + (error as any).message);
        } finally {
            setIsDeleting(false);
        }
    };

    const renderTable = (items: any[], type: 'hacia' | 'desde') => (
        <div
            className="flex flex-col border border-gray-300 bg-white mb-1 shadow-sm flex-1 overflow-hidden"
            onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, item: null });
            }}
        >
            {/* Search/Action Bar */}
            <div className="bg-[#f0f0f0] border-b border-gray-300 p-1 flex items-center justify-end gap-1.5 px-2 h-8 shrink-0">
                <input
                    type="text"
                    placeholder="Introduzca el texto a buscar..."
                    className="bg-white border border-gray-400 px-2 h-6 w-64 text-[11px] outline-none shadow-inner"
                />
                <button className="h-6 bg-[#f0f0f0] border border-gray-400 px-3 text-[11px] font-medium hover:bg-[#e1e1e1] active:bg-[#d1d1d1] text-black leading-none flex items-center">
                    Buscar
                </button>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto bg-white min-h-[180px]">
                <table className="w-full border-collapse table-fixed min-w-[800px]">
                    <thead className="bg-[#e8e8e8] select-none text-black sticky top-0 z-10">
                        <tr className="h-6.5 border-b border-gray-400">
                            <th className="w-[8%] text-left px-2 font-medium border-r border-gray-300 uppercase text-[10px]">
                                <div className="flex items-center justify-between">Número <ChevronDown size={10} className="opacity-30" /></div>
                            </th>
                            <th className="w-[10%] text-left px-2 font-medium border-r border-gray-300 uppercase text-[10px]">
                                <div className="flex items-center justify-between">Fecha <ChevronDown size={10} className="opacity-30" /></div>
                            </th>
                            <th className="w-[30%] text-left px-2 font-medium border-r border-gray-300 uppercase text-[10px]">
                                <div className="flex items-center justify-between">Traslado {type === 'hacia' ? 'Hacia' : 'Desde'} <ChevronDown size={10} className="opacity-30" /></div>
                            </th>
                            <th className="w-[14%] text-left px-2 font-medium border-r border-gray-300 uppercase text-[10px]">
                                <div className="flex items-center justify-between">Creado Por <ChevronDown size={10} className="opacity-30" /></div>
                            </th>
                            <th className="w-[18%] text-left px-2 font-medium border-r border-gray-300 uppercase text-[10px]">
                                <div className="flex items-center justify-between text-[9px] leading-tight">Procesado / Anulado Por <ChevronDown size={10} className="opacity-30" /></div>
                            </th>
                            <th className="w-[10%] text-center px-1 font-medium border-r border-gray-300 uppercase text-[10px]">Procesado</th>
                            <th className="w-[10%] text-center px-1 font-medium uppercase text-[10px]">Anulado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length > 0 ? items.map((item, i) => (
                            <tr
                                key={i}
                                onDoubleClick={() => handleEdit(item)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setContextMenu({ x: e.clientX, y: e.clientY, item });
                                }}
                                className={`h-6 border-b border-gray-100 cursor-pointer text-[11px] text-black transition-colors group ${i % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'} hover:bg-[#f2f7fb]`}
                            >
                                <td className="px-2 border-r border-gray-200 font-medium">{item.id}</td>
                                <td className="px-2 border-r border-gray-200">{item.date}</td>
                                <td className="px-2 border-r border-gray-200 uppercase truncate text-gray-800">{item.to}</td>
                                <td className="px-2 border-r border-gray-200 truncate">{item.createdBy}</td>
                                <td className="px-2 border-r border-gray-200 truncate">{item.processedBy}</td>
                                <td className="px-2 border-r border-gray-200 text-center">
                                    <div className="flex justify-center">
                                        <div className={`w-3.5 h-3.5 border border-gray-300 flex items-center justify-center ${item.isProcessed ? 'bg-gray-100' : 'bg-white'}`}>
                                            {item.isProcessed && <div className="w-2 h-2 bg-gray-600 rounded-[1px]"></div>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-2 text-center">
                                    <div className="flex justify-center">
                                        <div className="w-3.5 h-3.5 border border-gray-300 flex items-center justify-center bg-white">
                                            {item.isVoid && <X size={11} className="text-red-500" />}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr className="h-24">
                                <td colSpan={7} className="text-center text-gray-300 text-[11px]">
                                    No hay traslados para mostrar
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#f0f0f0]">
                <Loader2 className="animate-spin text-gray-400" size={36} />
            </div>
        );
    }

    return (
        <div ref={containerRef} className="flex flex-col w-full h-full bg-[#f0f0f0] text-black overflow-hidden relative">
            {/* Sucursal Bar: Larger and better aligned */}
            <div className="bg-[#f0f0f0] px-4 py-1 border-b border-gray-300 flex items-center gap-3 shrink-0 h-10 shadow-sm">
                <span className="text-[11px] font-medium uppercase whitespace-nowrap text-gray-700">Sucursal</span>
                <div className="relative w-96 flex items-center">
                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="w-full h-7 bg-white border border-gray-400 outline-none text-[12px] px-3 font-medium appearance-none cursor-pointer leading-none text-black hover:border-blue-400 focus:border-blue-500 transition-colors"
                    >
                        {branches.map(branch => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-2 top-1.5 pointer-events-none opacity-60 text-gray-600" />
                </div>
            </div>

            <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
                {/* Sent Transfers */}
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="bg-[#e2e8f0] px-3 border border-gray-300 border-b-0 rounded-t-sm flex items-center h-6 shrink-0">
                        <h2 className="text-[11px] font-semibold text-[#106ebe] uppercase tracking-wide">Traslados Enviados</h2>
                    </div>
                    {renderTable(sentTransfers, 'hacia')}
                </div>

                {/* Received Transfers */}
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="bg-[#e2e8f0] px-3 border border-gray-300 border-b-0 rounded-t-sm flex items-center h-6 shrink-0">
                        <h2 className="text-[11px] font-semibold text-[#106ebe] uppercase tracking-wide">Traslados Recibidos</h2>
                    </div>
                    {renderTable(receivedTransfers, 'desde')}
                </div>

                {/* Footer Note */}
                <div className="px-2 shrink-0 h-5 flex items-center">
                    <p className="text-[10px] font-medium text-gray-400">* Doble Clic sobre un Traslado para recibirlo.</p>
                </div>
            </div>

            {/* DELETE CONFIRMATION MODAL - CUSTOM WINDOWS STYLE */}
            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 z-[120000] flex items-center justify-center pointer-events-none">
                    <div className="bg-[#f0f0f0] border border-gray-400 shadow-2xl w-[350px] relative rounded-sm overflow-hidden animate-in zoom-in-95 pointer-events-auto">
                        <div className="bg-[#106ebe] px-3 py-1 flex items-center justify-between text-white shrink-0">
                            <span className="text-[10px] font-medium uppercase tracking-wider">Confirmar Eliminación</span>
                            <button onClick={() => setShowDeleteConfirm(null)} className="hover:bg-red-600 px-1">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-6 bg-white flex flex-col items-center gap-4">
                            <div className="text-red-600 bg-red-50 p-3 rounded-full">
                                <Trash2 size={24} />
                            </div>
                            <div className="text-center">
                                <p className="text-[12px] font-medium text-gray-800">¿Está seguro de eliminar este traslado?</p>
                                <p className="text-[10px] font-medium text-gray-400 mt-1 uppercase">Esta acción no se puede deshacer</p>
                            </div>
                        </div>
                        <div className="bg-[#f0f0f0] border-t border-gray-300 p-3 flex justify-center gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-6 h-8 border border-gray-400 text-[10px] font-medium text-gray-600 hover:bg-gray-200 uppercase transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="px-6 h-8 bg-red-600 text-white text-[10px] font-medium hover:bg-red-700 uppercase shadow-md flex items-center gap-2 disabled:opacity-50"
                            >
                                {isDeleting ? <Loader2 size={12} className="animate-spin" /> : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Context Menu */}
            {contextMenu && createPortal(
                <div
                    className="fixed bg-white border border-gray-300 shadow-xl py-1 z-[10000] min-w-[180px] animate-in fade-in duration-75"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button
                        onClick={handleNew}
                        className="w-full text-left px-4 py-1.5 text-[11px] font-medium text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors"
                    >
                        <Plus size={14} className="text-gray-400 group-hover:text-white" /> Nuevo Traslado
                    </button>
                    {contextMenu.item && (
                        <>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button
                                onClick={() => handleEdit(contextMenu.item)}
                                className="w-full text-left px-4 py-1.5 text-[11px] font-medium text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors group"
                            >
                                <Edit2 size={14} className="text-[#106ebe] group-hover:text-white" /> Editar Traslado
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button
                                onClick={() => handleDelete(contextMenu.item)}
                                className="w-full text-left px-4 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-600 hover:text-white flex items-center gap-3 transition-colors group"
                            >
                                <Trash2 size={14} className="group-hover:text-white" /> Eliminar Traslado
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button
                                onClick={() => { /* Logic to open Kardex */ }}
                                className="w-full text-left px-4 py-1.5 text-[11px] font-medium text-[#106ebe] hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors group"
                            >
                                <History size={14} className="group-hover:text-white" /> Ver Kardex / Historial
                            </button>
                        </>
                    )}
                </div>,
                document.body
            )}

            {/* Maintenance Modal */}
            <InventoryTransferModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                branches={branches}
                editingTransfer={editingTransfer}
                currentUser={null}
                onSaveSuccess={() => { }}
            />
        </div>
    );
};
