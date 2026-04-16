import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit2, Loader2, Save, X, Check, Tag } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';

export const ConfigDiscounts: React.FC = () => {
    const [discounts, setDiscounts] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // UI states
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('ALL');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, visible: boolean, discount: any | null }>({
        x: 0, y: 0, visible: false, discount: null
    });

    // Form and logic
    const [editingDiscount, setEditingDiscount] = useState<any | null>(null);
    const notify = useNotify();
    const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        value: '',
        branch_id: '',
        type: 'PERCENT',
        apply_to: 'TODOS',
        is_active: true,
        afecta_propina: false
    });

    const containerRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [discRes, branchRes] = await Promise.all([
                supabase.from('discount_types').select('*').order('name'),
                supabase.from('branches').select('*').order('name')
            ]);

            if (discRes.error) throw discRes.error;
            setDiscounts(discRes.data || []);
            setBranches(branchRes.data || []);

            if (branchRes.data && branchRes.data.length > 0 && !formData.branch_id) {
                setFormData(prev => ({ ...prev, branch_id: branchRes.data[0].id }));
            }
        } catch (err) {
            console.error('Error fetching discounts data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        const handleClickOutside = () => setContextMenu(prev => ({ ...prev, visible: false }));
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleSave = async () => {
        if (!formData.name || !formData.value) {
            notify.error('Nombre y valor son obligatorios');
            return;
        }
        setIsSaving(true);

        const dataToSave = {
            name: formData.name.toUpperCase(),
            value: parseFloat(formData.value),
            type: formData.type,
            apply_to: formData.apply_to.toUpperCase(),
            is_active: formData.is_active,
            afecta_propina: formData.afecta_propina
        };

        try {
            if (formData.id) {
                const { error } = await supabase.from('discount_types').update(dataToSave).eq('id', formData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('discount_types').insert([dataToSave]);
                if (error) throw error;
            }

            setShowModal(false);
            fetchData();
            notify.success('Descuento guardado correctamente');
        } catch (error: any) {
            notify.error('Error al guardar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const { error } = await supabase.from('discount_types').delete().eq('id', confirmDelete.id);
        if (!error) {
            fetchData();
            notify.success('Descuento eliminado correctamente');
        } else {
            notify.error('Error al eliminar: ' + error.message);
        }
        setConfirmDelete(null);
    };

    const openModal = (disc: any = null) => {
        if (disc) {
            setEditingDiscount(disc);
            setFormData({
                id: disc.id,
                name: disc.name,
                value: disc.value.toString(),
                branch_id: disc.branch_id || branches[0]?.id || '',
                type: disc.type,
                apply_to: disc.apply_to,
                is_active: disc.is_active,
                afecta_propina: disc.afecta_propina ?? false
            });
        } else {
            setEditingDiscount(null);
            setFormData({
                id: '',
                name: '',
                value: '',
                branch_id: branches[0]?.id || '',
                type: 'PERCENT',
                apply_to: 'TODOS',
                is_active: true,
                afecta_propina: false
            });
        }
        setShowModal(true);
    };

    const handleInlineToggle = async (
        disc: any,
        field: 'is_active' | 'type' | 'afecta_propina',
        e: React.MouseEvent
    ) => {
        e.stopPropagation(); // no seleccionar la fila

        let updatePayload: any = {};

        if (field === 'is_active') {
            updatePayload = { is_active: !disc.is_active };
        } else if (field === 'type') {
            updatePayload = { type: disc.type === 'PERCENT' ? 'AMOUNT' : 'PERCENT' };
        } else if (field === 'afecta_propina') {
            updatePayload = { afecta_propina: !disc.afecta_propina };
        }

        // Optimistic UI: actualiza localmente sin esperar red
        setDiscounts(prev => prev.map(d => d.id === disc.id ? { ...d, ...updatePayload } : d));

        const { error } = await supabase
            .from('discount_types')
            .update(updatePayload)
            .eq('id', disc.id);

        if (error) {
            // Revertir si hubo error
            fetchData();
            notify.error('Error al actualizar: ' + error.message);
        } else {
            notify.success('Actualizado correctamente');
        }
    };

    const handleContextMenu = (e: React.MouseEvent, discount: any | null = null) => {
        e.preventDefault();
        e.stopPropagation();

        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        let x = e.clientX - containerRect.left;
        let y = e.clientY - containerRect.top;

        setContextMenu({
            x,
            y,
            visible: true,
            discount
        });
    };

    const filteredDiscounts = discounts.filter(d => {
        const matchSearch = searchTerm === '' || d.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchBranch = branchFilter === 'ALL' || !d.branch_id || d.branch_id === branchFilter;
        return matchSearch && matchBranch;
    });

    return (
        <div className="flex flex-col h-full bg-[#f0f0f0] absolute inset-0 text-slate-900" ref={containerRef}>
            {/* Topbar Filter */}
            <div className="bg-[#e6e6e6] px-3 border-b border-gray-300 flex items-center justify-between shrink-0 h-[40px]">
                {/* Izquierda: Sucursal */}
                <div className="flex items-center gap-2">
                    <span className="text-slate-900 font-medium text-[12px]">Sucursal</span>
                    <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="min-w-[280px] bg-white border border-gray-400 rounded-sm px-2 outline-none text-[11px] text-slate-900 font-medium focus:border-[#106ebe] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] transition-all h-[24px]"
                    >
                        <option value="ALL">TODAS LAS SUCURSALES</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>

                {/* Derecha: Buscador */}
                <div className="flex items-center gap-1">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && setSearchTerm(e.currentTarget.value)}
                        placeholder="Introduzca el texto a buscar..."
                        className="bg-white border border-gray-400 rounded-sm px-2 text-[11px] w-64 outline-none text-slate-900 font-medium focus:border-[#106ebe] shadow-sm transition-all h-[24px]"
                    />
                    <button
                        onClick={() => setSearchTerm(searchTerm)}
                        className="bg-[#e1e1e1] border border-gray-400 px-4 text-[11px] font-medium hover:bg-[#d0d0d0] text-slate-900 shadow-sm rounded-sm transition-colors h-[24px] flex items-center"
                    >
                        Buscar
                    </button>
                </div>
            </div>

            {/* Data Grid Header */}
            <div className="grid grid-cols-[1fr_150px_100px_100px_100px] bg-[#e8e8e8] border-b border-gray-400 font-bold text-black text-[10px] select-none uppercase">
                <div className="py-2.5 px-6 border-r border-gray-300 text-left tracking-tight">Descuento</div>
                <div className="py-2.5 px-6 border-r border-gray-300 text-center tracking-tight">Valor</div>
                <div className="py-2.5 px-6 border-r border-gray-300 text-center tracking-tight">Editable</div>
                <div className="py-2.5 px-6 border-r border-gray-300 text-center tracking-tight">Porcentaje</div>
                <div className="py-2.5 px-6 text-center tracking-tight">Afecta Propina</div>
            </div>

            {/* Sub-header (fila de filtros de columna, sin tuerca) */}
            <div className="grid grid-cols-[1fr_150px_100px_100px_100px] bg-[#fafafa] border-b border-gray-300 shadow-sm z-10">
                <div className="py-1 px-4 border-r border-gray-300">{/* vacío */}</div>
                <div className="py-1 px-4 border-r border-gray-300 flex justify-center items-center">
                    <div className="text-[10px] text-gray-400 font-semibold">=</div>
                </div>
                <div className="py-1 px-4 border-r border-gray-300 flex justify-center items-center">
                    <div className="w-4 h-4 border-2 border-gray-500 bg-gray-700 relative flex items-center justify-center">
                        <div className="w-2 h-2 bg-white"></div>
                    </div>
                </div>
                <div className="py-1 px-4 border-r border-gray-300 flex justify-center items-center">
                    <div className="w-4 h-4 border-2 border-gray-500 bg-gray-700 relative flex items-center justify-center">
                        <div className="w-2 h-2 bg-white"></div>
                    </div>
                </div>
                <div className="py-1 px-4 flex justify-center items-center">
                    <div className="w-4 h-4 border-2 border-gray-500 bg-gray-700 relative flex items-center justify-center">
                        <div className="w-2 h-2 bg-white"></div>
                    </div>
                </div>
            </div>

            {/* Data Content */}
            <div
                className="flex-1 overflow-y-auto bg-white relative"
                onContextMenu={(e) => handleContextMenu(e, null)}
            >
                {loading ? (
                    <div className="flex-1 h-full flex items-center justify-center bg-white">
                        <Loader2 className="animate-spin text-[#106ebe]" size={32} />
                    </div>
                ) : (
                    <table className="w-full border-collapse table-fixed">
                        <colgroup>
                            <col /> {/* Descuento: ancho libre */}
                            <col style={{ width: '150px' }} /> {/* Valor */}
                            <col style={{ width: '100px' }} /> {/* Editable */}
                            <col style={{ width: '100px' }} /> {/* Porcentaje */}
                            <col style={{ width: '100px' }} /> {/* Afecta Propina */}
                        </colgroup>
                        <tbody>

                            {discounts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center text-slate-500 font-bold italic">
                                        No hay descuentos configurados. <br />
                                        Haz clic derecho para crear uno nuevo.
                                    </td>
                                </tr>
                            ) : filteredDiscounts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-slate-500 font-bold italic">
                                        No se encontraron resultados para "{searchTerm}".
                                    </td>
                                </tr>
                            ) : (
                                filteredDiscounts.map((disc) => {
                                    const isSelected = editingDiscount?.id === disc.id;
                                    return (
                                        <tr
                                            key={disc.id}
                                            onClick={() => setEditingDiscount(disc)}
                                            onDoubleClick={() => openModal(disc)}
                                            onContextMenu={(e) => handleContextMenu(e, disc)}
                                            className={`h-6 transition-colors cursor-default relative border-b border-gray-50 ${isSelected
                                                ? 'bg-[#106ebe] text-white shadow-[inset_3px_0_0_#106ebe]'
                                                : 'text-slate-900 even:bg-slate-50/50'
                                                }`}
                                        >
                                            <td className="px-4 font-bold flex items-center gap-2 h-6 border-r border-gray-100">
                                                <Tag size={12} className={isSelected ? 'text-white' : 'text-slate-400'} />
                                                <span className="uppercase tracking-tight text-[10px]">{disc.name}</span>
                                            </td>
                                            <td className="px-4 text-right font-black tabular-nums border-r border-gray-100">
                                                <span className="text-[10px]">
                                                    {disc.type === 'PERCENT'
                                                        ? `${disc.value % 1 === 0 ? disc.value : disc.value.toFixed(2)}%`
                                                        : `Q${disc.value.toFixed(2)}`
                                                    }
                                                </span>
                                            </td>
                                            <td className="px-4 border-r border-gray-100">
                                                <div className="flex justify-center items-center h-full">
                                                    <div
                                                        className="cursor-pointer"
                                                        onClick={(e) => handleInlineToggle(disc, 'is_active', e)}
                                                    >
                                                        <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${disc.is_active ? (isSelected ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                            {disc.is_active && <Check size={10} strokeWidth={4} />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 border-r border-gray-100">
                                                <div className="flex justify-center items-center h-full">
                                                    <div
                                                        className="cursor-pointer"
                                                        onClick={(e) => handleInlineToggle(disc, 'type', e)}
                                                    >
                                                        <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${disc.type === 'PERCENT' ? (isSelected ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                            {disc.type === 'PERCENT' && <Check size={10} strokeWidth={4} />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4">
                                                <div className="flex justify-center items-center h-full">
                                                    <div
                                                        className="cursor-pointer"
                                                        onClick={(e) => handleInlineToggle(disc, 'afecta_propina', e)}
                                                    >
                                                        <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${disc.afecta_propina ? (isSelected ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                            {disc.afecta_propina && <Check size={10} strokeWidth={4} />}
                                                        </div>
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

            {/* CONTEXT MENU */}
            {contextMenu.visible && (
                <div
                    className="absolute z-[100] w-48 bg-[#f5f5f5] border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-1 flex flex-col"
                    style={{ top: `${Math.min(contextMenu.y, (containerRef.current?.clientHeight || 0) - 150)}px`, left: `${contextMenu.x}px` }}
                >
                    <button
                        onClick={() => {
                            setContextMenu({ ...contextMenu, visible: false });
                            openModal(null);
                        }}
                        className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-bold transition-colors group text-slate-900"
                    >
                        <Plus size={14} className="group-hover:text-white text-emerald-600" /> Nuevo Registro
                    </button>

                    {contextMenu.discount && (
                        <>
                            <div className="h-px bg-gray-200 my-1"></div>
                            <button
                                onClick={() => {
                                    setContextMenu({ ...contextMenu, visible: false });
                                    openModal(contextMenu.discount);
                                }}
                                className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-bold transition-colors group text-slate-900"
                            >
                                <Edit2 size={14} className="text-[#106ebe] group-hover:text-white" /> Modificar
                            </button>
                            <button
                                onClick={() => {
                                    setContextMenu({ ...contextMenu, visible: false });
                                    setConfirmDelete(contextMenu.discount);
                                }}
                                className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-bold transition-colors group text-slate-900"
                            >
                                <Trash2 size={14} className="text-red-500 group-hover:text-white" /> Eliminar
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Editing Modal Portal */}
            {showModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[450px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106ebe] flex flex-col animate-slide-up pointer-events-auto">
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <h3 className="text-[12px] font-bold text-white tracking-wide flex items-center gap-2">
                                    Mantenimiento Tipos de Descuento
                                </h3>
                                <div className="flex items-center gap-1">
                                    <WindowsSaveButton
                                        onClick={handleSave}
                                        loading={isSaving}
                                        title="Guardar"
                                        variant="minimal"
                                    />
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1"
                                        title="Cerrar"
                                    >
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 bg-[#f0f0f0] flex flex-col gap-4 border-b border-gray-300">
                                {/* Datos de Descuento Fieldset */}
                                <div className="border border-gray-400 p-3 pt-4 relative bg-[#f0f0f0] rounded-sm">
                                    <span className="text-[11px] text-slate-800 font-bold px-1 absolute -top-2.5 left-2 bg-[#f0f0f0]">Tipo de Descuento</span>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-[80px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-slate-900">Descuento</label>
                                            <input
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                type="text"
                                                className="w-full bg-white border border-gray-400 rounded-sm px-2 py-1 h-7 text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] shadow-sm uppercase"
                                            />
                                        </div>

                                        <div className="grid grid-cols-[80px_1fr] items-center gap-4">
                                            <div className="col-start-2 flex items-center gap-4 text-[11px] font-medium text-slate-900">
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="h-3 w-3 accent-[#0078d7]"
                                                        checked={formData.is_active}
                                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                    />
                                                    Es Editable
                                                </label>
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="h-3 w-3 accent-[#0078d7]"
                                                        checked={formData.type === 'PERCENT'}
                                                        onChange={(e) => setFormData({ ...formData, type: e.target.checked ? 'PERCENT' : 'AMOUNT' })}
                                                    />
                                                    Es Porcentaje
                                                </label>
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="h-3 w-3 accent-[#0078d7]"
                                                        checked={formData.afecta_propina}
                                                        onChange={(e) => setFormData({ ...formData, afecta_propina: e.target.checked })}
                                                    />
                                                    Afecta Propina
                                                </label>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-[80px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-slate-900">Valor</label>
                                            <div className="w-[120px]">
                                                <input
                                                    value={formData.value}
                                                    onChange={e => setFormData({ ...formData, value: e.target.value })}
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full bg-white border border-gray-400 rounded-sm px-2 py-1 h-7 text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] shadow-sm text-right"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-[80px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-slate-900">Sucursal</label>
                                            <select
                                                value={formData.branch_id}
                                                onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                                                className="w-full min-w-[280px] bg-white border border-gray-400 rounded-sm px-2 py-1 h-7 text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] shadow-sm"
                                            >
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
            {confirmDelete && (
                <WindowsConfirmModal
                    title="Confirmar Eliminación"
                    message="¿Desea eliminar este tipo de descuento permanentemente?"
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onDeny={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
};
