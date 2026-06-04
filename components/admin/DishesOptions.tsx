import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Search, RotateCcw, Loader2, ListFilter, ArrowUpDown, Filter, Plus, Edit3, Trash2, X, Check, CheckSquare
} from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { useNotify } from '../../hooks/useNotify';
import { WindowsConfirmModal } from '../WindowsConfirmModal';

export const DishesOptions: React.FC = () => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const notify = useNotify();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        id: '',
        name: '',
        group_prompt: '',
        min_selection: 0,
        max_selection: 0,
        is_enabled: true
    });
    const [modalItems, setModalItems] = useState<any[]>([]);
    const [loadingModalItems, setLoadingModalItems] = useState(false);
    const [selectedModalItemId, setSelectedModalItemId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'platillos' | 'sucursales'>('platillos');
    const [branches, setBranches] = useState<any[]>([]);
    const [branchAssignments, setBranchAssignments] = useState<Record<string, { is_enabled: boolean, is_assigned: boolean }>>({});

    // Group List Context Menu
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; item: any | null }>({
        visible: false,
        x: 0,
        y: 0,
        item: null
    });

    // Configuration Table Context Menu (inside modal)
    const [configContextMenu, setConfigContextMenu] = useState<{ visible: boolean; x: number; y: number; item: any | null }>({
        visible: false,
        x: 0,
        y: 0,
        item: null
    });

    // Picker Modal State
    const [showPicker, setShowPicker] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerItems, setPickerItems] = useState<any[]>([]);
    const [loadingPicker, setLoadingPicker] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('option_groups')
            .select('*')
            .order('name');
        if (data) setItems(data);

        const { data: bData } = await supabase.from('branches').select('id, name').order('name');
        if (bData) setBranches(bData);

        setLoading(false);
    };

    const fetchModalItems = async (groupId: string) => {
        setLoadingModalItems(true);
        const { data } = await supabase
            .from('group_items')
            .select('*, products(name, price)')
            .eq('option_group_id', groupId)
            .order('created_at');
        setModalItems(data || []);

        const { data: bData } = await supabase
            .from('option_group_branches')
            .select('*')
            .eq('option_group_id', groupId);
        
        const assignments: any = {};
        if (bData) {
            bData.forEach(b => {
                assignments[b.branch_id] = { is_enabled: b.is_enabled, is_assigned: b.is_assigned };
            });
        }
        setBranchAssignments(assignments);

        if (data && data.length > 0) setSelectedModalItemId(data[0].id);
        setLoadingModalItems(false);
    };

    const fetchPickerItems = async () => {
        setLoadingPicker(true);
        const { data } = await supabase
            .from('products')
            .select('id, name, price, menu_categories(nombre)')
            .eq('is_available', true)
            .eq('es_platillo', true)
            .order('name');

        setPickerItems(data || []);
        setLoadingPicker(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Handle ESC key for modals
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showPicker) {
                    setShowPicker(false);
                } else if (showModal) {
                    setShowModal(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showPicker, showModal]);

    const handleContextMenu = (e: React.MouseEvent, item: any | null) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.pageX,
            y: e.pageY,
            item: item && item.id !== 'empty' ? item : null
        });
        if (item && item.id !== 'empty') setSelectedId(item.id);
    };

    const handleConfigContextMenu = (e: React.MouseEvent, item: any | null) => {
        e.preventDefault();
        e.stopPropagation();
        setConfigContextMenu({
            visible: true,
            x: e.pageX,
            y: e.pageY,
            item: item && item.id !== 'empty' ? item : null
        });
        if (item && item.id !== 'empty') setSelectedModalItemId(item.id);
    };

    const closeContextMenus = () => {
        setContextMenu({ ...contextMenu, visible: false });
        setConfigContextMenu({ ...configContextMenu, visible: false });
    };

    useEffect(() => {
        const handleClick = () => closeContextMenus();
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu, configContextMenu]);

    const handleNew = () => {
        setIsEditing(false);
        setActiveTab('platillos');
        setForm({
            id: '',
            name: '',
            group_prompt: '',
            min_selection: 0,
            max_selection: 0,
            is_enabled: true
        });
        setModalItems([]);
        setBranchAssignments({});
        setShowModal(true);
    };

    const handleEdit = (item: any) => {
        setIsEditing(true);
        setForm({
            id: item.id,
            name: item.name,
            group_prompt: item.group_prompt || '',
            min_selection: item.min_selection || 0,
            max_selection: item.max_selection || 0,
            is_enabled: item.is_enabled !== false
        });
        setBranchAssignments({});
        fetchModalItems(item.id);
        setShowModal(true);
    };

    const handleSave = async (shouldClose = true) => {
        if (!form.name.trim()) return;
        setSaving(true);

        const groupData = {
            name: form.name.toUpperCase(),
            group_prompt: form.group_prompt.trim().toUpperCase() || form.name.toUpperCase(),
            min_selection: form.min_selection || 0,
            max_selection: form.max_selection || 0,
            is_enabled: form.is_enabled
        };

        let currentId = form.id;
        if (isEditing) {
            const { error } = await supabase.from('option_groups').update(groupData).eq('id', form.id);
            if (error) notify.error('Error al actualizar: ' + error.message);
        } else {
            const { data, error } = await supabase.from('option_groups').insert([groupData]).select();
            if (error) {
                notify.error('Error al crear grupo: ' + error.message);
            } else if (data?.[0]) {
                currentId = data[0].id;
                setForm(prev => ({ ...prev, id: currentId }));
                setIsEditing(true);
            }
        }

        if (currentId) {
            const updates = branches.map(b => ({
                option_group_id: currentId,
                branch_id: b.id,
                is_enabled: branchAssignments[b.id]?.is_enabled ?? true,
                is_assigned: branchAssignments[b.id]?.is_assigned ?? true
            }));
            await supabase.from('option_group_branches').upsert(updates);
        }

        setSaving(false);
        fetchData();
        if (shouldClose) setShowModal(false);
        return currentId;
    };

    const handleDelete = async (id: string) => {
        setConfirmAction({
            message: '¿Confirma eliminar este grupo de opciones?',
            onConfirm: async () => {
                await supabase.from('option_groups').delete().eq('id', id);
                fetchData();
                setConfirmAction(null);
            }
        });
    };

    const handleRemoveItemFromConfig = async (itemId: string) => {
        setConfirmAction({
            message: '¿Quitar esta opción del grupo?',
            onConfirm: async () => {
                const { error } = await supabase.from('group_items').delete().eq('id', itemId);
                if (error) notify.error('Error al quitar item: ' + error.message);
                fetchModalItems(form.id);
                setConfirmAction(null);
            }
        });
    };

    const handleAddFromPicker = async (item: any) => {
        let currentGroupId = form.id;

        // If it's a new group (no name yet or unsaved), we need to save it first
        if (!currentGroupId) {
            if (!form.name.trim()) {
                notify.alert('Debe asignar un nombre al grupo antes de agregar opciones.');
                return;
            }
            currentGroupId = await handleSave(false); // Save without closing
        }

        if (!currentGroupId) return;

        // Prevent duplicate options within the group
        const exists = modalItems.some(mi => mi.product_id === item.id);
        if (exists) {
            notify.alert('Este platillo ya está asignado a este grupo.');
            return;
        }

        const { error } = await supabase.from('group_items').insert([{
            option_group_id: currentGroupId,
            product_id: item.id,
            is_enabled: true
        }]);

        if (error) {
            notify.error('Error al añadir opción: ' + error.message);
        } else {
            fetchModalItems(currentGroupId);
            // setShowPicker(false); // Keep open for multi-selection
        }
    };

    const filteredItems = useMemo(() => {
        return items.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.group_prompt?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [items, searchQuery]);

    const filteredPickerItems = useMemo(() => {
        return pickerItems.filter(item =>
            item.name?.toLowerCase().includes(pickerSearch.toLowerCase()) ||
            item.menu_categories?.nombre?.toLowerCase().includes(pickerSearch.toLowerCase())
        );
    }, [pickerItems, pickerSearch]);

    return (
        <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
            {/* Toolbar Area */}
            <div className="bg-white border-b border-gray-200 shrink-0">
                {/* Search Bar Group */}
                <div className="px-6 py-1.5 flex items-center justify-end gap-2 bg-white">
                    <div className="relative group flex-1 max-w-sm">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Introduzca el texto a buscar..."
                            className="w-full pl-3 pr-4 py-1.5 bg-white border border-gray-300 text-[10px] font-medium text-slate-700 uppercase tracking-wide outline-none focus:border-[#106ebe] transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => { }}
                        className="px-6 h-7 bg-[#106ebe] text-white border border-[#001a33] text-[10px] font-medium uppercase hover:bg-[#002244] active:bg-[#001a33] transition-all shadow-sm"
                    >
                        Buscar
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div
                className="flex-1 overflow-auto custom-scrollbar bg-white min-h-[100px]"
                onContextMenu={(e) => handleContextMenu(e, null)}
            >
                {loading && items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                        <Loader2 size={32} className="animate-spin text-[#106ebe]" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest">Cargando Grupos...</span>
                    </div>
                ) : (
                    <table className="w-full border-collapse text-left">
                        <thead className="sticky top-0 bg-[#e8e8e8] z-10 select-none shadow-sm text-slate-700">
                            <tr className="h-9 border-b border-gray-400 text-[10px] font-medium uppercase">
                                <th className="px-6 py-1 border-r border-gray-300 w-1/2">Nombre</th>
                                <th className="px-6 py-1 border-r border-gray-300 w-1/3">Prompt</th>
                                <th className="px-6 py-1 text-center w-32">Habilitado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-medium">
                            {filteredItems.map(item => {
                                const isSelected = selectedId === item.id;
                                return (
                                    <tr
                                        key={item.id}
                                        onContextMenu={(e) => {
                                            e.stopPropagation();
                                            handleContextMenu(e, item);
                                        }}
                                        onClick={() => setSelectedId(item.id)}
                                        onDoubleClick={() => handleEdit(item)}
                                        className={`h-9 border-b border-gray-50 transition-all cursor-pointer select-none text-[11px] ${isSelected
                                            ? 'bg-[#106ebe] text-white'
                                            : 'hover:bg-[#e1e5eb] text-slate-700 odd:bg-white even:bg-[#f6f8fa]'
                                            }`}
                                    >
                                        <td className="px-6 py-1 uppercase">{item.name}</td>
                                        <td className="px-6 py-1 uppercase">{item.group_prompt}</td>
                                        <td className="px-6 py-1 text-center">
                                            <div className="flex justify-center">
                                                <div className={`w-4 h-4 border flex items-center justify-center rounded-sm ${isSelected ? 'border-white bg-white/20' : 'border-gray-400 bg-white'}`}>
                                                    <Check size={12} className={isSelected ? 'text-white' : 'text-[#106ebe]'} />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer Status Bar */}
            <div className="h-6 bg-[#f0f0f0] border-t border-gray-300 flex items-center px-4 shrink-0">
                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">
                    {filteredItems.length} Registros Encontrados
                </span>
            </div>

            {/* Group Context Menu */}
            {contextMenu.visible && createPortal(
                <div
                    className="fixed z-[999999] bg-white border border-gray-400 shadow-xl py-1 min-w-[160px] font-sans"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button onClick={handleNew} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-semibold text-slate-700 hover:bg-[#106ebe] hover:text-white transition-all text-left uppercase text-left">
                        <Plus size={14} className="text-emerald-500" /> Nuevo Grupo
                    </button>
                    {contextMenu.item && (
                        <>
                            <button onClick={() => handleEdit(contextMenu.item)} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-semibold text-slate-700 hover:bg-[#106ebe] hover:text-white transition-all text-left uppercase text-left">
                                <Edit3 size={14} className="text-blue-500" /> Editar Grupo
                            </button>
                            <div className="h-px bg-gray-200 my-1" />
                            <button onClick={() => handleDelete(contextMenu.item.id)} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-semibold text-slate-700 hover:bg-[#106ebe] hover:text-white transition-all text-left uppercase text-left">
                                <Trash2 size={14} className="text-red-500" /> Eliminar Grupo
                            </button>
                        </>
                    )}
                    <div className="h-px bg-gray-200 my-1" />
                    <button onClick={fetchData} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-semibold text-slate-700 hover:bg-[#106ebe] hover:text-white transition-all text-left uppercase">
                        <RotateCcw size={14} className="text-slate-400" /> Refrescar
                    </button>
                </div>,
                document.body
            )}

            {/* Config Table Context Menu */}
            {configContextMenu.visible && createPortal(
                <div
                    className="fixed z-[999999] bg-white border border-gray-400 shadow-xl py-1 min-w-[170px] font-sans"
                    style={{ left: configContextMenu.x, top: configContextMenu.y }}
                >
                    <button
                        onClick={() => {
                            setPickerSearch('');
                            fetchPickerItems();
                            setShowPicker(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-semibold text-slate-700 hover:bg-[#106ebe] hover:text-white transition-all text-left uppercase"
                    >
                        <Plus size={14} className="text-emerald-500" /> Agregar Opción
                    </button>
                    {configContextMenu.item && (
                        <button
                            onClick={() => handleRemoveItemFromConfig(configContextMenu.item.id)}
                            className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-semibold text-slate-700 hover:bg-[#106ebe] hover:text-white transition-all text-left uppercase"
                        >
                            <Trash2 size={14} className="text-red-500" /> Quitar Opción
                        </button>
                    )}
                </div>,
                document.body
            )}

            {/* Maintenance Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-black/10 pointer-events-auto" onClick={() => setShowModal(false)} />
                    <div className="pointer-events-auto">
                        <DraggableWindow>
                            <div className="w-[700px] bg-[#f0f0f0] border border-[#106ebe] shadow-2xl overflow-hidden flex flex-col">
                                {/* Title Bar */}
                                <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move text-white shrink-0">
                                    <div className="flex items-center gap-2 text-[11px] font-medium tracking-tight">
                                        Mantenimiento de Opciones
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <WindowsSaveButton
                                            onClick={() => handleSave(true)}
                                            loading={saving}
                                            variant="minimal"
                                            title="Guardar"
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

                                {/* Content */}
                                <div className="p-4 space-y-4">
                                    <div className="bg-white border border-gray-300 shadow-sm overflow-hidden rounded-sm">
                                        <div className="bg-[#e1e5eb] h-6 px-3 flex items-center border-b border-gray-300">
                                            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Datos Grupo</span>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <div className="flex items-center gap-4">
                                                <label className="w-16 text-[10px] font-medium text-slate-500 uppercase">Nombre</label>
                                                <input
                                                    type="text"
                                                    value={form.name}
                                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                                    className="flex-1 h-7 border border-gray-300 px-2 text-[11px] font-medium text-slate-700 uppercase outline-none focus:border-[#106ebe] bg-[#e3edfd]"
                                                />
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <label className="w-16 text-[10px] font-medium text-slate-500 uppercase">Prompt</label>
                                                <input
                                                    type="text"
                                                    value={form.group_prompt}
                                                    onChange={e => setForm({ ...form, group_prompt: e.target.value })}
                                                    className="flex-1 h-7 border border-gray-300 px-2 text-[11px] font-medium text-slate-700 uppercase outline-none focus:border-[#106ebe]"
                                                />
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <label className="w-16 text-[10px] font-medium text-slate-500 uppercase">Mínimo</label>
                                                <input
                                                    type="number"
                                                    value={form.min_selection}
                                                    onChange={e => setForm({ ...form, min_selection: parseInt(e.target.value) || 0 })}
                                                    className="flex-1 h-7 border border-gray-300 px-2 text-[11px] font-medium text-slate-700 outline-none text-center"
                                                />
                                                <label className="w-16 text-[10px] font-medium text-slate-500 uppercase text-center">Máximo</label>
                                                <input
                                                    type="number"
                                                    value={form.max_selection}
                                                    onChange={e => setForm({ ...form, max_selection: parseInt(e.target.value) || 0 })}
                                                    className="flex-1 h-7 border border-gray-300 px-2 text-[11px] font-medium text-slate-700 outline-none text-center"
                                                />
                                            </div>
                                            <div className="flex items-center justify-end gap-2 pr-2">
                                                <input
                                                    type="checkbox"
                                                    checked={form.is_enabled}
                                                    onChange={e => setForm({ ...form, is_enabled: e.target.checked })}
                                                    className="w-3.5 h-3.5 border-gray-300 rounded"
                                                />
                                                <span className="text-[10px] font-medium text-slate-600 uppercase">Habilitado</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-gray-300 shadow-sm overflow-hidden rounded-sm flex flex-col h-64">
                                        <div className="bg-[#e1e5eb] h-6 flex items-end border-b border-gray-300">
                                            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 py-1">Configuración</span>
                                        </div>
                                        {/* Tabs */}
                                        <div className="flex bg-[#f4f4f4] border-b border-gray-300">
                                            <div 
                                                onClick={() => setActiveTab('platillos')}
                                                className={`px-6 py-1.5 border-t-2 ${activeTab === 'platillos' ? 'bg-white border-[#106ebe] border-r border-gray-300 text-slate-700' : 'bg-[#f4f4f4] border-transparent text-slate-500 hover:bg-white'} text-[10px] font-medium cursor-pointer transition-colors`}
                                            >
                                                Platillos
                                            </div>
                                            <div 
                                                onClick={() => setActiveTab('sucursales')}
                                                className={`px-6 py-1.5 border-t-2 ${activeTab === 'sucursales' ? 'bg-white border-[#106ebe] border-x border-gray-300 text-slate-700' : 'bg-[#f4f4f4] border-transparent text-slate-500 hover:bg-white'} text-[10px] font-medium cursor-pointer transition-colors -ml-[1px]`}
                                            >
                                                Sucursales
                                            </div>
                                        </div>
                                        <div
                                            className="flex-1 overflow-auto bg-white min-h-[100px]"
                                            onContextMenu={activeTab === 'platillos' ? (e) => handleConfigContextMenu(e, null) : undefined}
                                        >
                                            {activeTab === 'platillos' ? (
                                                <table className="w-full border-collapse text-left">
                                                    <thead className="sticky top-0 bg-[#f4f4f4] z-10 text-[10px] font-semibold uppercase shadow-sm border-b border-gray-300 text-slate-700">
                                                        <tr className="h-7 text-center">
                                                            <th className="px-4 text-left border-r border-gray-300">Plato</th>
                                                            <th className="px-4 border-r border-gray-300">Precio Venta</th>
                                                            <th className="px-4 border-r border-gray-300">Precio Domicilio</th>
                                                            <th className="px-4">Precio Plataformas</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loadingModalItems ? (
                                                            <tr><td colSpan={4} className="p-4 text-center"><Loader2 size={24} className="animate-spin inline text-[#106ebe]" /></td></tr>
                                                        ) : modalItems.length === 0 ? (
                                                            <tr>
                                                                <td
                                                                    colSpan={4}
                                                                    onContextMenu={(e) => {
                                                                        e.preventDefault();
                                                                        handleConfigContextMenu(e, { id: 'empty' });
                                                                    }}
                                                                    className="px-4 py-8 text-center text-[10px] font-semibold text-slate-300 uppercase tracking-widest"
                                                                >
                                                                    Haga clic derecho para agregar
                                                                </td>
                                                            </tr>
                                                        ) : modalItems.map((mi) => (
                                                            <tr
                                                                key={mi.id}
                                                                onContextMenu={(e) => handleConfigContextMenu(e, mi)}
                                                                onClick={() => setSelectedModalItemId(mi.id)}
                                                                className={`h-7 border-b border-gray-50 text-[10px] font-medium uppercase cursor-default ${selectedModalItemId === mi.id ? 'bg-[#106ebe] text-white' : 'hover:bg-gray-100 text-slate-600'}`}
                                                            >
                                                                <td className="px-4 border-r border-gray-200">{mi.products?.name || '—'}</td>
                                                                <td className="px-4 border-r border-gray-200 text-center">Q{parseFloat(mi.products?.price || 0).toFixed(2)}</td>
                                                                <td className="px-4 border-r border-gray-200 text-center">Q{parseFloat(mi.delivery_price || 0).toFixed(2)}</td>
                                                                <td className="px-4 text-center">Q{parseFloat(mi.platform_price || 0).toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <table className="w-full border-collapse text-left">
                                                    <thead className="sticky top-0 bg-[#f4f4f4] z-10 text-[10px] font-semibold uppercase shadow-sm border-b border-gray-300 text-slate-700">
                                                        <tr className="h-7 text-center">
                                                            <th className="px-4 text-left border-r border-gray-300">Sucursal</th>
                                                            <th className="px-4 border-r border-gray-300 w-[150px]">Habilitado</th>
                                                            <th className="px-4 w-[150px]">Asignado a Sucursal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {branches.map(b => {
                                                            const assign = branchAssignments[b.id] ?? { is_enabled: true, is_assigned: true };
                                                            return (
                                                                <tr key={b.id} className="h-7 hover:bg-gray-100 text-slate-600 border-b border-gray-50">
                                                                    <td className="px-4 text-[10px] font-medium uppercase border-r border-gray-200">{b.name}</td>
                                                                    <td className="px-4 text-center border-r border-gray-200">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={assign.is_enabled} 
                                                                            onChange={(e) => setBranchAssignments({ ...branchAssignments, [b.id]: { ...assign, is_enabled: e.target.checked } })}
                                                                            className="w-3.5 h-3.5 accent-[#106ebe] opacity-80 cursor-pointer" 
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 text-center">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={assign.is_assigned} 
                                                                            onChange={(e) => {
                                                                                const isChecked = e.target.checked;
                                                                                setBranchAssignments({ 
                                                                                    ...branchAssignments, 
                                                                                    [b.id]: { ...assign, is_assigned: isChecked, is_enabled: isChecked ? assign.is_enabled : false } 
                                                                                });
                                                                            }}
                                                                            className="w-3.5 h-3.5 accent-[#106ebe] opacity-80 cursor-pointer" 
                                                                        />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>

                                    <div className="px-1 py-1">
                                        <p className="text-[9px] font-medium text-slate-500 leading-tight">
                                            Los cambios en la Configuración afectarán a todas las sucursales que contengan esta Opción en su menú.
                                        </p>
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

            {/* Picker Modal - Portaled and with higher z-index to stay on top */}
            {showPicker && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-none font-sans">
                    <div className="absolute inset-0 bg-black/5 pointer-events-auto" onClick={() => setShowPicker(false)} />
                    <div className="pointer-events-auto">
                        <DraggableWindow>
                            <div className="w-[850px] bg-[#f0f0f0] border border-[#106ebe] shadow-2xl overflow-hidden flex flex-col">
                                <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move text-white shrink-0">
                                    <span className="text-[11px] font-medium tracking-tight uppercase text-white">Listado de Textos de Opciones</span>
                                    <button
                                        onClick={() => setShowPicker(false)}
                                        className="w-7 h-7 flex items-center justify-center bg-red-600 hover:bg-red-700 transition-all text-white"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="p-4 space-y-4">
                                    <div className="bg-white border border-gray-300 p-2 flex items-center gap-2">
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={pickerSearch}
                                                onChange={e => setPickerSearch(e.target.value)}
                                                placeholder="Introduzca el texto a buscar..."
                                                className="w-full h-8 border border-gray-300 px-3 text-[11px] font-medium text-slate-700 uppercase outline-none focus:border-[#106ebe]"
                                            />
                                        </div>
                                        <button className="px-6 h-8 bg-[#f0f0f0] border border-gray-400 text-[11px] font-medium uppercase text-slate-700 hover:bg-white active:bg-gray-200">Buscar</button>
                                    </div>

                                    <div className="bg-white border border-gray-300 h-80 overflow-auto">
                                        <table className="w-full border-collapse text-left">
                                            <thead className="sticky top-0 bg-[#e8e8e8] z-10 text-[10px] font-semibold uppercase shadow-sm text-slate-700">
                                                <tr className="h-8 border-b border-gray-300">
                                                    <th className="px-4 border-r border-gray-300">Platillo</th>
                                                    <th className="px-4 border-r border-gray-300">Categoría</th>
                                                    <th className="px-4 border-r border-gray-300 text-center">Precio Venta</th>
                                                    <th className="px-4 border-r border-gray-300 text-center">Precio Domicilio</th>
                                                    <th className="px-4 text-center">Precio Plataformas</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[11px] font-medium uppercase text-slate-600">
                                                {loadingPicker ? (
                                                    <tr><td colSpan={4} className="p-8 text-center"><Loader2 size={32} className="animate-spin inline text-[#106ebe]" /></td></tr>
                                                ) : filteredPickerItems.map(item => (
                                                    <tr
                                                        key={item.id}
                                                        onDoubleClick={() => handleAddFromPicker(item)}
                                                        className="h-8 border-b border-gray-50 hover:bg-[#e1e5eb] cursor-pointer"
                                                    >
                                                        <td className="px-4 border-r border-gray-200">{item.name}</td>
                                                        <td className="px-4 border-r border-gray-200">{item.menu_categories?.nombre || 'SIN CATEGORÍA'}</td>
                                                        <td className="px-4 border-r border-gray-200 text-center">Q{parseFloat(item.price || 0).toFixed(2)}</td>
                                                        <td className="px-4 border-r border-gray-200 text-center">Q0.00</td>
                                                        <td className="px-4 text-center">Q0.00</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-medium text-slate-500">* Doble Clic o Enter sobre cualquier Platillo para enviarlo a la configuración.</p>
                                        <p className="text-[10px] font-medium text-slate-500">* ESC - Para cerrar la ventana.</p>
                                    </div>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
