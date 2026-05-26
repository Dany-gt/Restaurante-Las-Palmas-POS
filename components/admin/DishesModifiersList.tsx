import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, RotateCcw, Loader2, Baseline, ArrowUpDown, Filter, Plus, Edit3, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { useNotify } from '../../hooks/useNotify';
import { WindowsConfirmModal } from '../WindowsConfirmModal';

export const DishesModifiersList: React.FC = () => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; item: any | null }>({
        visible: false,
        x: 0,
        y: 0,
        item: null
    });

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [modifierGroups, setModifierGroups] = useState<any[]>([]);
    const [form, setForm] = useState({
        id: '',
        item_name: '',
        display_name: '',
        extra_price: '0.00',
        delivery_price: '0.00',
        platform_price: '0.00',
        modifier_group_id: ''
    });
    const [saving, setSaving] = useState(false);
    const notify = useNotify();
    const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

    useEffect(() => {
        fetchData();
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        const { data } = await supabase.from('modifier_groups').select('*').order('name');
        setModifierGroups(data || []);
    };

    const fetchData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('group_items')
            .select(`
                *,
                modifier_groups (id, name)
            `)
            .not('modifier_group_id', 'is', null)
            .order('item_name');

        if (!error) {
            setItems(data || []);
        }
        setLoading(false);
    };

    const handleContextMenu = (e: React.MouseEvent, item: any | null) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            item
        });
        if (item) setSelectedId(item.id);
    };

    const closeContextMenu = () => {
        setContextMenu({ ...contextMenu, visible: false });
    };

    useEffect(() => {
        const handleClick = () => closeContextMenu();
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu]);

    const handleNew = () => {
        setIsEditing(false);
        setForm({
            id: '',
            item_name: '',
            display_name: '',
            extra_price: '0.00',
            delivery_price: '0.00',
            platform_price: '0.00',
            modifier_group_id: modifierGroups[0]?.id || ''
        });
        setShowModal(true);
    };

    const handleEdit = (item: any) => {
        setIsEditing(true);
        setForm({
            id: item.id,
            item_name: item.item_name,
            display_name: item.display_name || '',
            extra_price: item.extra_price.toString(),
            delivery_price: (item.delivery_price || 0).toString(),
            platform_price: (item.platform_price || 0).toString(),
            modifier_group_id: item.modifier_group_id
        });
        setShowModal(true);
    };

    const handleDelete = async (item: any) => {
        setConfirmAction({
            message: `¿Está seguro que desea eliminar el modificador "${item.item_name}"?`,
            onConfirm: async () => {
                const { error } = await supabase.from('group_items').delete().eq('id', item.id);
                if (error) {
                    notify.error('Error al eliminar modificador: ' + error.message);
                } else {
                    fetchData();
                }
                setConfirmAction(null);
            }
        });
    };

    const handleSave = async () => {
        if (!form.item_name || !form.modifier_group_id) return;
        setSaving(true);
        const payload = {
            item_name: form.item_name.toUpperCase(),
            display_name: form.display_name.toUpperCase() || null,
            extra_price: parseFloat(form.extra_price) || 0,
            delivery_price: parseFloat(form.delivery_price) || 0,
            platform_price: parseFloat(form.platform_price) || 0,
            modifier_group_id: form.modifier_group_id,
            modifier_type: 'add',
            is_enabled: true
        };

        // Check for duplicates in the same modifier group
        const { data: duplicateData, error: duplicateError } = await supabase
            .from('group_items')
            .select('id')
            .eq('item_name', payload.item_name)
            .eq('modifier_group_id', payload.modifier_group_id);

        if (duplicateError) {
            console.error('Error validation:', duplicateError);
        } else if (duplicateData && duplicateData.length > 0) {
            const isDup = isEditing ? duplicateData.some(d => d.id !== form.id) : true;
            if (isDup) {
                notify.alert('Este modificador ya existe en el grupo seleccionado.');
                setSaving(false);
                return;
            }
        }

        if (isEditing) {
            await supabase.from('group_items').update(payload).eq('id', form.id);
        } else {
            await supabase.from('group_items').insert([payload]);
        }

        setSaving(false);
        setShowModal(false);
        fetchData();
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedItems = React.useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const filteredItems = sortedItems.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.modifier_groups?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white font-['Montserrat'] overflow-hidden">
            {/* Header Content */}
            <div className="flex flex-col shrink-0 bg-[#f8fafc] border-b border-gray-200">
                <div className="px-6 py-1.5 flex items-center justify-end">
                    <div className="flex items-center gap-2">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#106ebe] transition-colors" size={14} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar modificador..."
                                className="pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-slate-700 uppercase tracking-wide w-64 outline-none focus:border-[#106ebe] transition-all shadow-sm"
                            />
                        </div>
                        <button
                            onClick={fetchData}
                            className="p-2 bg-white border border-gray-200 text-slate-400 hover:text-[#106ebe] hover:border-[#106ebe] rounded-lg transition-all"
                            title="Recargar"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </div>
                </div>

            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto custom-scrollbar" onContextMenu={(e) => handleContextMenu(e, null)}>
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                        <Loader2 size={32} className="animate-spin text-[#106ebe]" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Cargando Modificadores...</span>
                    </div>
                ) : (
                    <table className="w-full border-collapse text-left">
                        <thead className="sticky top-0 bg-[#e8e8e8] z-10 select-none shadow-sm text-black">
                            <tr className="h-9 border-b border-gray-400 text-[10px] font-bold uppercase">
                                <th onClick={() => handleSort('item_name')} className="px-6 py-1 border-r border-gray-300">
                                    Modificador
                                </th>
                                <th onClick={() => handleSort('display_name')} className="px-6 py-1 border-r border-gray-300">
                                    PROMPT
                                </th>
                                <th onClick={() => handleSort('extra_price')} className="px-6 py-1 border-r border-gray-300 text-center w-32">
                                    Precio Venta
                                </th>
                                <th className="px-6 py-1 border-r border-gray-300 text-center w-32 uppercase tracking-tighter">Precio Domicilio</th>
                                <th className="px-6 py-1 text-center w-32 uppercase tracking-tighter">Precio Plataformas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-bold">
                            {filteredItems.map((item) => (
                                <tr
                                    key={item.id}
                                    onClick={() => setSelectedId(item.id)}
                                    onContextMenu={(e) => {
                                        setSelectedId(item.id);
                                        handleContextMenu(e, item);
                                    }}
                                    className={`transition-colors text-[10px] uppercase cursor-default ${selectedId === item.id
                                        ? 'bg-[#106ebe] text-white'
                                        : 'hover:bg-blue-50/50 text-[#106ebe]'
                                        }`}
                                >
                                    <td className={`px-6 py-2.5 border-r ${selectedId === item.id ? 'border-white/10' : 'border-gray-100 font-bold'}`}>{item.item_name}</td>
                                    <td className={`px-6 py-2.5 border-r ${selectedId === item.id ? 'border-white/10 text-white/80' : 'border-gray-100 text-slate-500 font-bold'}`}>{item.display_name || '--'}</td>
                                    <td className={`px-6 py-2.5 text-center border-r ${selectedId === item.id ? 'border-white/10 text-white' : 'border-gray-100 text-slate-700 font-bold'}`}>Q{parseFloat(item.extra_price).toFixed(2)}</td>
                                    <td className={`px-6 py-2.5 text-center border-r ${selectedId === item.id ? 'border-white/10 text-white' : 'border-gray-100 text-slate-700 font-bold'}`}>Q{parseFloat(item.delivery_price || 0).toFixed(2)}</td>
                                    <td className={`px-6 py-2.5 text-center ${selectedId === item.id ? 'text-white' : 'text-slate-700 font-bold'}`}>Q{parseFloat(item.platform_price || 0).toFixed(2)}</td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-20">
                                            <Filter size={48} strokeWidth={1} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">No se encontraron resultados</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer Bar */}
            <div className="bg-[#f1f5f9] border-t border-gray-300 px-6 py-2 flex items-center justify-between shrink-0">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Las Palmas POS - Plataforma de Administración</span>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-[#106ebe] uppercase">{filteredItems.length} Registros Encontrados</span>
                </div>
            </div>
            {/* Context Menu */}
            {contextMenu.visible && createPortal(
                <>
                <div
                    className="fixed inset-0 z-[99999]"
                    onClick={closeContextMenu}
                    onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
                />
                <div
                    className="fixed z-[100000] w-44 bg-white border border-gray-300 shadow-xl overflow-hidden py-1 select-none font-['Montserrat']"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        onClick={handleNew}
                        className="w-full h-8 px-4 flex items-center gap-3 hover:bg-[#106ebe] hover:text-white text-slate-700 text-[10px] font-bold uppercase transition-colors group"
                    >
                        <Plus size={14} className="text-green-600 group-hover:text-inherit" />
                        Nuevo
                    </button>
                    {contextMenu.item && (
                        <>
                        <button
                            onClick={() => handleEdit(contextMenu.item)}
                            className="w-full h-8 px-4 flex items-center gap-3 hover:bg-[#106ebe] hover:text-white text-slate-700 text-[10px] font-bold uppercase transition-colors group"
                        >
                            <Edit3 size={14} className="text-blue-600 group-hover:text-inherit" />
                            Editar
                        </button>
                        <button
                            onClick={() => handleDelete(contextMenu.item)}
                            className="w-full h-8 px-4 flex items-center gap-3 hover:bg-red-600 hover:text-white text-slate-700 text-[10px] font-bold uppercase transition-colors group"
                        >
                            <Trash2 size={14} className="text-red-500 group-hover:text-inherit" />
                            Eliminar
                        </button>
                        </>
                    )}
                    <div className="h-px bg-gray-200 my-1 font-normal" />
                    <button
                        onClick={fetchData}
                        className="w-full h-8 px-4 flex items-center gap-3 hover:bg-[#106ebe] hover:text-white text-slate-700 text-[10px] font-bold uppercase transition-colors group"
                    >
                        <RotateCcw size={14} className="text-blue-600 group-hover:text-inherit" />
                        Refrescar
                    </button>
                </div>
                </>,
                document.body
            )}

            {/* Maintenance Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-black/10 pointer-events-auto" onClick={() => setShowModal(false)} />
                    <div className="pointer-events-auto">
                        <DraggableWindow>
                            <div className="w-[600px] bg-[#f0f0f0] border border-[#106ebe] shadow-2xl overflow-hidden flex flex-col">
                                {/* Title Bar */}
                                <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move text-white shrink-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold tracking-tight">Mantenimiento de Textos de Modificadores</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <WindowsSaveButton
                                            onClick={handleSave}
                                            loading={saving}
                                            variant="minimal"
                                            title="Guardar Modificador"
                                        />
                                        <button
                                            onClick={() => setShowModal(false)}
                                            className="w-7 h-7 flex items-center justify-center bg-red-600 hover:bg-red-700 transition-all text-white"
                                            title="Cerrar"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Form Content */}
                                <div className="p-4 bg-white">
                                    <div className="space-y-4">
                                        {/* Group: Texto de Modificador */}
                                        <div className="space-y-2">
                                            <div className="bg-[#e1e5eb] px-3 py-1">
                                                <span className="text-[10px] font-black text-[#106ebe] uppercase tracking-wider">Texto de Modificador</span>
                                            </div>
                                            <div className="space-y-1.5 px-2">
                                                <div className="flex items-center gap-4">
                                                    <label className="w-20 text-[10px] font-bold text-slate-500">Nombre</label>
                                                    <input
                                                        type="text"
                                                        value={form.item_name}
                                                        onChange={e => setForm({ ...form, item_name: e.target.value })}
                                                        className="flex-1 h-6 border border-gray-300 px-2 text-[11px] font-bold text-[#106ebe] uppercase outline-none focus:border-[#106ebe]"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <label className="w-20 text-[10px] font-bold text-slate-500">Prompt</label>
                                                    <input
                                                        type="text"
                                                        value={form.display_name}
                                                        onChange={e => setForm({ ...form, display_name: e.target.value })}
                                                        className="flex-1 h-6 border border-gray-300 px-2 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-[#106ebe]"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Group: Precios */}
                                        <div className="space-y-0.5">
                                            <div className="bg-[#e1e5eb] px-3 py-1">
                                                <span className="text-[10px] font-black text-[#106ebe] uppercase tracking-wider">Precios</span>
                                            </div>
                                            <div className="grid grid-cols-3 bg-gray-100/50 border-x border-b border-gray-200">
                                                <div className="p-2 border-r border-gray-200">
                                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 text-center">Precio Venta</label>
                                                    <div className="relative bg-white border border-gray-300 h-7 flex items-center px-2">
                                                        <span className="text-[9px] font-bold text-slate-400 mr-1">Q</span>
                                                        <input
                                                            type="text"
                                                            value={form.extra_price}
                                                            onChange={e => setForm({ ...form, extra_price: e.target.value.replace(/[^0-9.]/g, '') })}
                                                            className="w-full bg-transparent text-[11px] font-black text-center text-[#106ebe] outline-none"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="p-2 border-r border-gray-200">
                                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 text-center">Precio Domicilio</label>
                                                    <div className="relative bg-white border border-gray-300 h-7 flex items-center px-2">
                                                        <span className="text-[9px] font-bold text-slate-400 mr-1">Q</span>
                                                        <input
                                                            type="text"
                                                            value={form.delivery_price}
                                                            onChange={e => setForm({ ...form, delivery_price: e.target.value.replace(/[^0-9.]/g, '') })}
                                                            className="w-full bg-transparent text-[11px] font-black text-center text-[#106ebe] outline-none"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="p-2">
                                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 text-center">Precio Plataformas</label>
                                                    <div className="relative bg-white border border-gray-300 h-7 flex items-center px-2">
                                                        <span className="text-[9px] font-bold text-slate-400 mr-1">Q</span>
                                                        <input
                                                            type="text"
                                                            value={form.platform_price}
                                                            onChange={e => setForm({ ...form, platform_price: e.target.value.replace(/[^0-9.]/g, '') })}
                                                            className="w-full bg-transparent text-[11px] font-black text-center text-[#106ebe] outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>
                </div>
            )}
            {confirmAction && (
                <WindowsConfirmModal
                    message={confirmAction.message}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
        </div>
    );
};
