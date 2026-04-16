import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Plus, Trash2, Edit2, Loader2, Save, X, Check, Upload } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';

export const ConfigPlatforms: React.FC = () => {
    const [platforms, setPlatforms] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // UI states
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('ALL');
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const notify = useNotify();
    const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; item: any | null }>({
        x: 0, y: 0, visible: false, item: null
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    const [form, setForm] = useState({
        id: '',
        name: '',
        commission_percentage: '0',
        is_connected: true,
        branch_id: '',
        account_id: '',
        image_url: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [platRes, branchRes, accRes] = await Promise.all([
                supabase.from('order_platforms').select('*').order('name'),
                supabase.from('branches').select('*').order('name'),
                supabase.from('customers').select('id, name').order('name')
            ]);
            setPlatforms(platRes.data || []);
            setBranches(branchRes.data || []);
            setAccounts(accRes.data || []);

            if (branchRes.data && branchRes.data.length > 0) {
                setForm(prev => prev.branch_id ? prev : { ...prev, branch_id: branchRes.data![0].id });
            }
        } catch (err) {
            console.error('Error fetching platforms:', err);
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
        if (!form.name) {
            notify.error('El nombre es obligatorio');
            return;
        }
        setIsSaving(true);
        try {
            const dataToSave = {
                name: form.name.toUpperCase(),
                commission_percentage: parseFloat(form.commission_percentage),
                is_connected: form.is_connected,
                branch_id: form.branch_id || null,
                account_id: form.account_id || null,
                image_url: form.image_url || null
            };

            const { error } = form.id
                ? await supabase.from('order_platforms').update(dataToSave).eq('id', form.id)
                : await supabase.from('order_platforms').insert([dataToSave]);

            if (error) throw error;
            setShowModal(false);
            fetchData();
            notify.success('Plataforma guardada correctamente');
        } catch (error: any) {
            notify.error('Error al guardar plataforma: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        try {
            const ext = file.name.split('.').pop();
            const fileName = `platforms/${Date.now()}_${form.name || 'platform'}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('menu')
                .upload(fileName, file, { cacheControl: '3600', upsert: true });
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('menu').getPublicUrl(fileName);
            setForm(prev => ({ ...prev, image_url: data.publicUrl }));
            notify.success('Imagen subida correctamente');
        } catch (err: any) {
            notify.error('Error al subir imagen: ' + err.message);
        } finally {
            setUploadingImage(false);
            // reset input so the same file can be re-selected
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const { error } = await supabase.from('order_platforms').delete().eq('id', confirmDelete.id);
        if (!error) {
            fetchData();
            notify.success('Plataforma eliminada correctamente');
        } else {
            notify.error('Error al eliminar: ' + error.message);
        }
        setConfirmDelete(null);
    };

    const handleInlineToggle = async (plat: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const newVal = !plat.is_connected;
        setPlatforms(prev => prev.map(p => p.id === plat.id ? { ...p, is_connected: newVal } : p));
        const { error } = await supabase.from('order_platforms').update({ is_connected: newVal }).eq('id', plat.id);
        if (error) {
            fetchData();
            notify.error('Error al actualizar: ' + error.message);
        } else {
            notify.success('Estado actualizado');
        }
    };

    const openModal = (item: any = null) => {
        if (item) {
            setEditingItem(item);
            setForm({
                id: item.id,
                name: item.name,
                commission_percentage: item.commission_percentage?.toString() ?? '0',
                is_connected: item.is_connected ?? true,
                branch_id: item.branch_id || branches[0]?.id || '',
                account_id: item.account_id || '',
                image_url: item.image_url || ''
            });
        } else {
            setEditingItem(null);
            setForm({
                id: '',
                name: '',
                commission_percentage: '0',
                is_connected: true,
                branch_id: branches[0]?.id || '',
                account_id: '',
                image_url: ''
            });
        }
        setShowModal(true);
    };

    const handleContextMenu = (e: React.MouseEvent, item: any | null = null) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = containerRef.current?.getBoundingClientRect();
        setContextMenu({
            x: e.clientX - (rect?.left || 0),
            y: e.clientY - (rect?.top || 0),
            visible: true,
            item
        });
    };

    const filtered = platforms.filter(p => {
        const matchSearch = searchTerm === '' || p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchBranch = branchFilter === 'ALL' || !p.branch_id || p.branch_id === branchFilter;
        return matchSearch && matchBranch;
    });

    return (
        <div className="flex flex-col h-full bg-[#f0f0f0] absolute inset-0 text-slate-900" ref={containerRef}>

            {/* Topbar */}
            <div className="bg-[#e6e6e6] px-3 border-b border-gray-300 flex items-center justify-between shrink-0 h-[40px]">
                {/* Izquierda: Sucursal */}
                <div className="flex items-center gap-2">
                    <span className="text-slate-900 font-medium text-[12px]">Sucursal</span>
                    <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="min-w-[280px] bg-white border border-gray-400 rounded-sm px-2 outline-none text-[11px] text-slate-900 font-medium focus:border-[#106ebe] h-[24px]"
                    >
                        <option value="ALL">TODAS LAS SUCURSALES</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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
                        className="bg-white border border-gray-400 rounded-sm px-2 text-[11px] w-64 outline-none text-slate-900 font-medium focus:border-[#106ebe] h-[24px]"
                    />
                    <button
                        className="bg-[#e1e1e1] border border-gray-400 px-4 text-[11px] font-medium hover:bg-[#d0d0d0] text-slate-900 shadow-sm rounded-sm transition-colors h-[24px] flex items-center"
                    >
                        Buscar
                    </button>
                </div>
            </div>

            {/* Grid Header */}
            <div className="grid grid-cols-[1fr_160px_120px_100px] bg-[#e8e8e8] border-b border-gray-400 font-bold text-black text-[10px] select-none shrink-0 uppercase">
                <div className="py-2.5 px-6 border-r border-gray-300 text-left tracking-tight">Plataforma</div>
                <div className="py-2.5 px-6 border-r border-gray-300 text-center tracking-tight">Cuenta por Cobrar</div>
                <div className="py-2.5 px-6 border-r border-gray-300 text-center tracking-tight">Porcentaje Servicio</div>
                <div className="py-2.5 px-6 text-center tracking-tight">Habilitado</div>
            </div>

            {/* Sub-header row */}
            <div className="grid grid-cols-[1fr_160px_120px_100px] bg-[#fafafa] border-b border-gray-300 shrink-0">
                <div className="py-1 px-4 border-r border-gray-300" />
                <div className="py-1 px-4 border-r border-gray-300 flex justify-center items-center">
                    <div className="text-[10px] text-gray-400 font-semibold">=</div>
                </div>
                <div className="py-1 px-4 border-r border-gray-300 flex justify-center items-center">
                    <div className="text-[10px] text-gray-400 font-semibold">=</div>
                </div>
                <div className="py-1 px-4 flex justify-center items-center">
                    <div className="w-4 h-4 border-2 border-gray-500 bg-gray-700 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white" />
                    </div>
                </div>
            </div>

            {/* Data Content */}
            <div
                className="flex-1 overflow-y-auto bg-white relative"
                onContextMenu={(e) => handleContextMenu(e, null)}
            >
                {loading ? (
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="animate-spin text-[#106ebe]" size={32} />
                    </div>
                ) : (
                    <table className="w-full border-collapse table-fixed">
                        <colgroup>
                            <col />
                            <col style={{ width: '160px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '100px' }} />
                        </colgroup>
                        <tbody>
                            {platforms.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center text-slate-500 font-bold italic text-[11px]">
                                        No hay plataformas configuradas.<br />
                                        Haz clic derecho para crear una nueva.
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center text-slate-500 font-bold italic text-[11px]">
                                        No se encontraron resultados para "{searchTerm}".
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(plat => {
                                    const isSelected = editingItem?.id === plat.id;
                                    const acct = accounts.find(a => a.id === plat.account_id);
                                    return (
                                        <tr
                                            key={plat.id}
                                            onClick={() => setEditingItem(plat)}
                                            onDoubleClick={() => openModal(plat)}
                                            onContextMenu={(e) => handleContextMenu(e, plat)}
                                            className={`h-6 border-b border-gray-100 cursor-default transition-colors ${isSelected ? 'bg-[#106ebe] text-white' : 'text-slate-900 even:bg-slate-50/50'}`}
                                        >
                                            <td className="px-4 border-r border-gray-100 truncate">
                                                <div className="flex items-center gap-2">
                                                    {plat.image_url ? (
                                                        <img src={plat.image_url} alt={plat.name} className="w-4 h-4 rounded-sm object-cover shrink-0" />
                                                    ) : (
                                                        <Globe size={12} className={isSelected ? 'text-white' : 'text-slate-400'} />
                                                    )}
                                                    <span className="uppercase font-bold text-[10px] tracking-tight">{plat.name}</span>
                                                </div>
                                            </td>
                                            {/* Cuenta por Cobrar */}
                                            <td className="px-4 border-r border-gray-100 text-[10px] font-bold truncate text-center">
                                                {acct?.name || ''}
                                            </td>
                                            {/* Porcentaje Servicio */}
                                            <td className="px-4 border-r border-gray-100 text-right text-[10px] font-black tracking-tight">
                                                {plat.commission_percentage != null
                                                    ? `${plat.commission_percentage % 1 === 0 ? plat.commission_percentage : Number(plat.commission_percentage).toFixed(2)}%`
                                                    : ''}
                                            </td>
                                            {/* Habilitado — toggle inline */}
                                            <td className="px-4">
                                                <div
                                                    className="flex justify-center items-center h-full cursor-pointer"
                                                    onClick={(e) => handleInlineToggle(plat, e)}
                                                    title={plat.is_connected ? 'Habilitado — clic para deshabilitar' : 'Deshabilitado — clic para habilitar'}
                                                >
                                                    <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${plat.is_connected ? (isSelected ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                        {plat.is_connected && <Check size={10} strokeWidth={4} />}
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

            {/* Context Menu */}
            {contextMenu.visible && (
                <div
                    className="absolute z-[100] w-48 bg-[#f5f5f5] border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-1 flex flex-col"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                    <button
                        onClick={() => { setContextMenu({ ...contextMenu, visible: false }); openModal(null); }}
                        className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-bold transition-colors group text-slate-900"
                    >
                        <Plus size={14} className="group-hover:text-white text-emerald-600" /> Nuevo Registro
                    </button>
                    {contextMenu.item && (
                        <>
                            <div className="h-px bg-gray-200 my-1" />
                            <button
                                onClick={() => { setContextMenu({ ...contextMenu, visible: false }); openModal(contextMenu.item); }}
                                className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-bold transition-colors group text-slate-900"
                            >
                                <Edit2 size={14} className="text-[#106ebe] group-hover:text-white" /> Modificar
                            </button>
                            <button
                                onClick={() => { setContextMenu({ ...contextMenu, visible: false }); setConfirmDelete(contextMenu.item); }}
                                className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-bold transition-colors group text-slate-900"
                            >
                                <Trash2 size={14} className="text-red-500 group-hover:text-white" /> Eliminar
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Modal Portal */}
            {showModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[520px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106ebe] flex flex-col pointer-events-auto">
                            {/* Modal Header */}
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move select-none shrink-0">
                                <div className="flex items-center gap-2">
                                    <Globe size={14} className="text-white/80" />
                                    <span className="text-white text-[12px] font-bold tracking-wide">
                                        Mantenimiento de Plataformas de Pedidos
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <WindowsSaveButton
                                        onClick={handleSave}
                                        loading={isSaving}
                                        title="Guardar"
                                        variant="minimal"
                                    />
                                    <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" title="Cerrar">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="p-4 flex gap-4">
                                {/* Left: form fields */}
                                <div className="flex-1">
                                    <div className="border border-gray-400 p-3 pt-4 relative bg-[#f0f0f0] rounded-sm">
                                        <span className="text-[11px] text-slate-800 font-bold px-1 absolute -top-2.5 left-2 bg-[#f0f0f0]">Datos de la Plataforma</span>

                                        <div className="space-y-3">
                                            {/* Nombre */}
                                            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
                                                <label className="text-[11px] font-medium text-slate-900">Nombre</label>
                                                <input
                                                    value={form.name}
                                                    onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })}
                                                    type="text"
                                                    className="w-full bg-white border border-gray-400 rounded-sm px-2 h-7 text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] shadow-sm uppercase"
                                                    placeholder="Ej. UBER EATS"
                                                />
                                            </div>

                                            {/* Cuenta por Cobrar */}
                                            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
                                                <label className="text-[11px] font-medium text-slate-900 leading-tight">Asignar a Cuenta*</label>
                                                <select
                                                    value={form.account_id}
                                                    onChange={e => setForm({ ...form, account_id: e.target.value })}
                                                    className="w-full bg-white border border-gray-400 rounded-sm px-2 h-7 text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] shadow-sm"
                                                >
                                                    <option value="">[Elija una Cuenta por Cobrar]</option>
                                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                </select>
                                            </div>

                                            {/* Porcentaje Servicio + Habilitado */}
                                            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
                                                <label className="text-[11px] font-medium text-slate-900 leading-tight">Porcentaje Servicio</label>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center">
                                                        <input
                                                            value={form.commission_percentage}
                                                            onChange={e => setForm({ ...form, commission_percentage: e.target.value })}
                                                            type="number"
                                                            step="0.01"
                                                            className="w-[80px] bg-white border border-gray-400 rounded-sm px-2 h-7 text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] shadow-sm text-right"
                                                            placeholder="0.00"
                                                        />
                                                        <span className="ml-1 text-[11px] text-gray-600 font-medium">%</span>
                                                    </div>
                                                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-900">
                                                        <input
                                                            type="checkbox"
                                                            className="h-3 w-3 accent-[#0078d7]"
                                                            checked={form.is_connected}
                                                            onChange={(e) => setForm({ ...form, is_connected: e.target.checked })}
                                                        />
                                                        Habilitado
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Sucursal */}
                                            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
                                                <label className="text-[11px] font-medium text-slate-900">Sucursal</label>
                                                <select
                                                    value={form.branch_id}
                                                    onChange={e => setForm({ ...form, branch_id: e.target.value })}
                                                    className="w-full min-w-[280px] bg-white border border-gray-400 rounded-sm px-2 h-7 text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] shadow-sm"
                                                >
                                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <p className="text-[9px] text-blue-700 mt-3 leading-snug">
                                            *Si la plataforma le cobra un porcentaje por sus servicios de reparto, por favor ingrese dicho porcentaje cuando cree la Cuenta por Cobrar.
                                        </p>
                                    </div>
                                </div>

                                {/* Right: Image upload */}
                                <div className="flex flex-col items-center gap-2 w-[120px] shrink-0">
                                    {/* Preview */}
                                    <div className="w-[100px] h-[100px] bg-black rounded-md flex items-center justify-center overflow-hidden border border-gray-400">
                                        {uploadingImage ? (
                                            <Loader2 size={28} className="animate-spin text-gray-400" />
                                        ) : form.image_url ? (
                                            <img src={form.image_url} alt="logo" className="w-full h-full object-contain" />
                                        ) : (
                                            <Globe size={36} className="text-gray-500" />
                                        )}
                                    </div>

                                    {/* Hidden file input */}
                                    <input
                                        ref={imageInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />

                                    {/* Upload button */}
                                    <button
                                        type="button"
                                        onClick={() => imageInputRef.current?.click()}
                                        disabled={uploadingImage}
                                        className="w-full bg-[#e1e1e1] border border-gray-400 hover:bg-[#d0d0d0] text-slate-800 text-[10px] font-medium py-1 rounded-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                    >
                                        <Upload size={11} />
                                        {uploadingImage ? 'Subiendo...' : 'Subir Imagen'}
                                    </button>

                                    {/* Quitar imagen */}
                                    {form.image_url && (
                                        <button
                                            type="button"
                                            onClick={() => setForm({ ...form, image_url: '' })}
                                            className="w-full bg-[#106ebe] hover:bg-blue-700 text-white text-[10px] font-medium py-1 rounded-sm transition-colors"
                                        >
                                            Quitar Imagen
                                        </button>
                                    )}
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
                    message="¿Seguro que desea eliminar esta plataforma?"
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onDeny={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
};
