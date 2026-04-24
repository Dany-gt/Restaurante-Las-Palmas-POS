
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, Plus, Smartphone, Globe, ShieldCheck, Settings, Trash2, Edit3, X, Loader2, Camera, Check, Save } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { POSTerminal } from '../../types';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';

export const ConfigPosCard: React.FC = () => {
    const [terminals, setTerminals] = useState<POSTerminal[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTerminal, setEditingTerminal] = useState<Partial<POSTerminal> | null>(null);
    const [saving, setSaving] = useState(false);
    const notify = useNotify();
    const [confirmDelete, setConfirmDelete] = useState<POSTerminal | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, visible: boolean, terminal: POSTerminal | null }>({
        x: 0,
        y: 0,
        visible: false,
        terminal: null
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('Cevichería y Rest. Las Palmas');

    const fetchTerminals = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('pos_terminals').select('*').order('created_at');
            if (data) {
                console.log('Terminales cargadas (DEBUG):', data);
                setTerminals(data);
            }
        } catch (e: any) {
            console.error('Exception fetching terminals:', e);
            notify.error(`Error inesperado al cargar: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTerminals();
    }, []);

    const handleSave = async () => {
        if (!editingTerminal?.name) {
            notify.error('El nombre de la terminal es obligatorio');
            return;
        }
        setSaving(true);
        try {
            // Clean the object: Only send valid database columns
            const payload = {
                name: editingTerminal.name,
                serial: editingTerminal.serial,
                type: editingTerminal.type,
                status: editingTerminal.status,
                logo_url: editingTerminal.logo_url
            };

            console.log('Intentando guardar payload:', payload);

            let result;
            if (editingTerminal.id) {
                result = await supabase.from('pos_terminals').update(payload).eq('id', editingTerminal.id).select();
            } else {
                result = await supabase.from('pos_terminals').insert([payload]).select();
            }

            const { error, data: savedData } = result;

            if (error) {
                console.error('Error al guardar en tabla pos_terminals:', error);
                notify.error(`Error de base de datos: ${error.message}`);
            } else if (!savedData || savedData.length === 0) {
                console.warn('No se guardó ninguna fila (RLS?)');
                notify.error('No se detectaron cambios en la base de datos (RLS).');
            } else {
                console.log('Guardado exitoso en base de datos:', savedData[0]);
                notify.success('Terminal guardada correctamente');
                setShowModal(false);
                fetchTerminals();
            }
        } catch (e: any) {
            console.error('Exception saving terminal:', e);
            notify.error(`Error inesperado: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('pos_terminals').delete().eq('id', confirmDelete.id);
            if (error) {
                console.error('Error deleting terminal:', error);
                notify.error(`Error al eliminar: ${error.message}`);
            } else {
                notify.success('Terminal eliminada correctamente');
                await fetchTerminals();
                setConfirmDelete(null);
            }
        } catch (e: any) {
            console.error('Exception deleting terminal:', e);
            notify.error(`Error inesperado: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditingTerminal({ name: '', serial: '', type: 'Físico', status: 'online', logo_url: '' });
        setShowModal(true);
    };

    const openEdit = (pos: POSTerminal) => {
        setEditingTerminal(pos);
        setShowModal(true);
    };

    const handleContextMenu = (e: React.MouseEvent, pos: POSTerminal | null = null) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            visible: true,
            terminal: pos
        });
        if (pos) setEditingTerminal(pos);
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const filteredTerminals = React.useMemo(() => {
        return terminals.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.serial?.toLowerCase().includes(searchTerm.toLowerCase());
            // Currently using a hardcoded branch filter as per UI, but ready for expansion
            return matchesSearch;
        });
    }, [terminals, searchTerm]);

    return (
        <div className="flex-1 flex flex-col bg-white overflow-hidden text-[11px] font-sans h-full select-none">
            {/* Toolbar/Search Area */}
            <div className="bg-[#f0f0f0] border-b border-gray-300 p-2 space-y-2">
                {/* Branch Selection Row & Search */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-slate-900 font-bold">Sucursal</span>
                        <select
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                            className="min-w-[400px] bg-white border border-gray-400 rounded-sm px-2 py-1 outline-none text-slate-900 font-medium focus:border-[#106ebe] shadow-sm transition-all"
                        >
                            <option>Cevichería y Rest. Las Palmas</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Introduzca el texto a buscar..."
                            className="bg-white border border-gray-400 rounded-sm px-2 py-1 text-[11px] w-72 outline-none text-slate-900 font-medium focus:border-[#106ebe] shadow-sm transition-all"
                        />
                        <button className="bg-[#e1e1e1] border border-gray-400 px-6 py-1 text-[11px] font-bold hover:bg-[#d0d0d0] text-slate-900 shadow-sm rounded-sm transition-colors">
                            Buscar
                        </button>
                    </div>
                </div>
            </div>

            {/* Data Grid Header */}
            <div className="grid grid-cols-[1fr_250px] bg-[#e8e8e8] border-b border-gray-400 font-bold text-black select-none">
                <div className="py-2 px-6 border-r border-gray-300 text-left text-[10px] uppercase tracking-wider">POS / Terminal</div>
                <div className="py-2 px-6 text-center text-[10px] uppercase tracking-wider">Habilitado</div>
            </div>

            {/* Sub-header with grouping icon/checkbox */}
            <div className="grid grid-cols-[1fr_250px] bg-[#fafafa] border-b border-gray-300">
                <div className="py-1 px-4 border-r border-gray-300 flex items-center">
                    <Settings size={14} className="text-gray-500 cursor-pointer hover:text-[#106ebe] transition-colors" />
                </div>
                <div className="py-1 px-4 flex justify-center items-center">
                    <div className="w-4 h-4 border-2 border-gray-500 bg-gray-700 relative flex items-center justify-center">
                        <div className="w-2 h-2 bg-white"></div>
                    </div>
                </div>
            </div>

            {/* Data Content */}
            <div
                className="flex-1 overflow-y-auto bg-white"
                onContextMenu={(e) => handleContextMenu(e)}
            >
                {loading ? (
                    <div className="flex-1 h-full flex items-center justify-center bg-white">
                        <Loader2 className="animate-spin text-[#106ebe]" size={32} />
                    </div>
                ) : (
                    <table className="w-full border-collapse">
                        <tbody>
                            {terminals.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="py-20 text-center text-slate-500 font-bold italic">
                                        No hay terminales vinculadas. <br />
                                        Haz clic derecho para vincular una nueva.
                                    </td>
                                </tr>
                            ) : filteredTerminals.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="py-20 text-center text-slate-500 font-bold italic">
                                        No se encontraron resultados para "{searchTerm}".
                                    </td>
                                </tr>
                            ) : (
                                filteredTerminals.map((pos) => {
                                    const isSelected = editingTerminal?.id === pos.id;
                                    return (
                                        <tr
                                            key={pos.id}
                                            onClick={() => setEditingTerminal(pos)}
                                            onDoubleClick={() => openEdit(pos)}
                                            onContextMenu={(e) => handleContextMenu(e, pos)}
                                            className={`h-6 border-b border-gray-100 cursor-default transition-colors ${isSelected ? 'bg-[#106ebe] text-white shadow-[inset_3px_0_0_#106ebe]' : 'text-slate-900 even:bg-slate-50/50'}`}
                                        >
                                            <td className="px-4 border-r border-gray-100 uppercase font-bold text-[10px] tracking-tight">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard size={12} className={isSelected ? 'text-white' : 'text-slate-400'} />
                                                    {pos.name}
                                                </div>
                                            </td>
                                            <td className="px-4">
                                                <div className="flex justify-center items-center h-full">
                                                    <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${pos.status === 'online' ? (isSelected ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                        {pos.status === 'online' && <Check size={10} strokeWidth={4} />}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>



            {showModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="bg-white w-[750px] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106ebe] flex flex-col animate-slide-up pointer-events-auto">
                            {/* Status Bar/Header (Blue) */}
                            <div className="modal-header bg-[#106ebe] px-4 py-2 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <h3 className="text-[12px] font-bold text-white tracking-wide flex items-center gap-2">
                                    <CreditCard size={14} /> Mantenimiento de POS Tarjeta
                                </h3>
                                <div className="flex items-center gap-1">
                                    <button className="w-8 h-8 hover:bg-white/20 flex items-center justify-center text-white transition-all relative">
                                        <Camera size={18} strokeWidth={2.5} />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                try {
                                                    setSaving(true);
                                                    const fileExt = file.name.split('.').pop();
                                                    const fileName = `pos_${Math.random()}.${fileExt}`;
                                                    const filePath = `products/${fileName}`;
                                                    const { error: uploadError } = await supabase.storage.from('menu').upload(filePath, file, { cacheControl: '3600', upsert: true });
                                                    if (uploadError) throw uploadError;
                                                    const { data } = supabase.storage.from('menu').getPublicUrl(filePath);
                                                    setEditingTerminal({ ...editingTerminal, logo_url: data.publicUrl });
                                                    notify.success('Imagen subida correctamente');
                                                } catch (error: any) {
                                                    notify.error('Error: ' + error.message);
                                                } finally {
                                                    setSaving(false);
                                                }
                                            }}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </button>
                                    <WindowsSaveButton
                                        onClick={handleSave}
                                        loading={saving}
                                        title="Guardar"
                                        variant="minimal"
                                    />
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1"
                                    >
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="p-1 bg-[#f0f0f0] border-b border-gray-300">
                                <div className="p-6 bg-white border border-gray-300 shadow-inner flex flex-col lg:flex-row gap-6">
                                    {/* Form Left Side */}
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2">
                                            Datos POS
                                        </h4>

                                        <div className="space-y-4">
                                            <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                                <label className="text-[11px] font-bold text-gray-600">Nombre</label>
                                                <input
                                                    type="text"
                                                    value={editingTerminal?.name || ''}
                                                    onChange={e => setEditingTerminal({ ...editingTerminal, name: e.target.value.toUpperCase() })}
                                                    className="w-full bg-white border border-gray-300 rounded-sm px-3 py-1.5 text-[12px] font-medium text-gray-900 focus:outline-none focus:border-[#106ebe] shadow-sm transition-all"
                                                />
                                            </div>

                                            <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                                <label className="text-[11px] font-bold text-gray-600">Sucursal</label>
                                                <div className="flex items-center gap-3">
                                                    <select className="flex-1 bg-white border border-gray-300 rounded-sm px-3 py-1.5 text-[12px] font-medium text-gray-900 focus:outline-none focus:border-[#106ebe] shadow-sm min-w-[280px]">
                                                        <option>Cevichería y Rest. Las Palmas</option>
                                                    </select>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div
                                                            onClick={() => setEditingTerminal({ ...editingTerminal, status: editingTerminal?.status === 'online' ? 'offline' : 'online' })}
                                                            className={`w-3.5 h-3.5 border border-gray-400 flex items-center justify-center bg-white cursor-pointer`}
                                                        >
                                                            {editingTerminal?.status === 'online' && <Check size={10} className="text-gray-800 font-bold" />}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-gray-600">Habilitado</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                                <label className="text-[11px] font-bold text-gray-600">ID / Serial</label>
                                                <input
                                                    type="text"
                                                    value={editingTerminal?.serial || ''}
                                                    onChange={e => setEditingTerminal({ ...editingTerminal, serial: e.target.value })}
                                                    className="w-full bg-white border border-gray-300 rounded-sm px-3 py-1.5 text-[12px] font-medium text-gray-900 focus:outline-none focus:border-[#106ebe] shadow-sm transition-all"
                                                />
                                            </div>

                                            <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                                <label className="text-[11px] font-bold text-gray-600">Tipo</label>
                                                <div className="flex gap-1">
                                                    {['Físico', 'Virtual'].map((type) => (
                                                        <button
                                                            key={type}
                                                            onClick={() => setEditingTerminal({ ...editingTerminal, type: type as any })}
                                                            className={`px-6 py-1 border font-bold text-[11px] transition-all shadow-sm ${editingTerminal?.type === type ? 'bg-[#106ebe] border-[#106ebe] text-white' : 'bg-[#f5f5f5] border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                                                        >
                                                            {type}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Image/Logo Area */}
                                    <div className="w-full lg:w-48 flex flex-col items-center gap-4 pt-8">
                                        <div className="w-full aspect-[4/3] bg-white border border-gray-200 rounded-sm flex items-center justify-center p-2 relative shadow-sm overflow-hidden">
                                            {editingTerminal?.logo_url ? (
                                                <img src={editingTerminal.logo_url} alt="Logo" className="w-full h-full object-contain" />
                                            ) : (
                                                <div className="flex flex-wrap justify-center items-center gap-2 opacity-60">
                                                    <div className="text-blue-700 font-black text-xl italic select-none tracking-tighter">VISA</div>
                                                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center relative">
                                                        <div className="w-8 h-8 rounded-full bg-orange-500 absolute left-4 opacity-80" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => setEditingTerminal({ ...editingTerminal, logo_url: '' })}
                                            className="w-full py-1.5 bg-[#106ebe] hover:bg-[#005a9e] text-white border border-[#106ebe] rounded-sm text-[11px] font-bold shadow-sm transition-all uppercase"
                                        >
                                            Quitar Imagen
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* CONTEXT MENU */}
            {contextMenu.visible && (
                <div
                    className="fixed z-[200] bg-white border border-gray-300 shadow-2xl py-1 min-w-[200px] animate-fade-in ring-1 ring-black/10"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        onClick={openCreate}
                        className="w-full text-left px-4 py-2 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-bold transition-colors group text-gray-900"
                    >
                        <Plus size={14} className="text-[#106ebe] group-hover:text-white" /> Vincular Nuevo POS
                    </button>

                    {contextMenu.terminal && (
                        <>
                            <div className="my-1 border-t border-gray-100" />
                            <button
                                onClick={() => openEdit(contextMenu.terminal!)}
                                className="w-full text-left px-4 py-2 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-bold transition-colors group text-gray-900"
                            >
                                <Edit3 size={14} className="text-gray-400 group-hover:text-white" /> Editar POS
                            </button>
                            <button
                                onClick={() => setConfirmDelete(contextMenu.terminal!)}
                                className="w-full text-left px-4 py-2 hover:bg-rose-600 hover:text-white flex items-center gap-3 text-[11px] font-bold transition-colors group text-gray-900"
                            >
                                <Trash2 size={14} className="text-rose-500 group-hover:text-white" /> Eliminar POS
                            </button>
                        </>
                    )}
                </div>
            )}
            {confirmDelete && (
                <WindowsConfirmModal
                    title="Confirmar Eliminación"
                    message="¿Desea eliminar este POS permanentemente?"
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onDeny={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
};
