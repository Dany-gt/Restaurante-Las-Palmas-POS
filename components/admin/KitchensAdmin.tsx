import React, { useState, useEffect, useRef } from 'react';
import { ChefHat, Plus, Trash2, Loader2, X, CheckCircle, Volume2, Play, Search, Filter, Monitor, Printer, Building2, MoreVertical, Check, XCircle, Edit3, Smartphone, LayoutGrid, Save, RefreshCw } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';

interface KitchensAdminProps {
    globalSearch?: string;
}

export const KitchensAdmin: React.FC<KitchensAdminProps> = ({ globalSearch = '' }) => {
    const [kitchens, setKitchens] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
    const [localSearch, setLocalSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingKitchen, setEditingKitchen] = useState<any | null>(null);
    const [modalTab, setModalTab] = useState<'INFO' | 'SOUND'>('INFO');
    const notify = useNotify();
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [selectedKitchenId, setSelectedKitchenId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, kitchen: any } | null>(null);
    const [printers, setPrinters] = useState<any[]>([]);
    const [showAssignDeviceModal, setShowAssignDeviceModal] = useState(false);
    const [assignDeviceKitchen, setAssignDeviceKitchen] = useState<any | null>(null);
    const [selectedPrinter, setSelectedPrinter] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const defaultFormData = {
        name: '',
        device_name: '', // Added based on reference image
        device_type: 'PRINTER',
        num_copies: 1,
        is_printer: true,
        is_kds: false,
        is_enabled: true,
        is_assigned_to_branch: true,
        sound_id: '',
        branch_id: ''
    };

    const [formData, setFormData] = useState(defaultFormData);

    const [sounds, setSounds] = useState<any[]>([]);
    const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [
                { data: kitchensData, error: kError },
                { data: soundData },
                { data: branchesData, error: bError },
                { data: printersData }
            ] = await Promise.all([
                supabase.from('kitchen_stations').select('*, branch:branches(name)').order('name'),
                supabase.from('sound_library').select('id, name, file_url').eq('is_active', true).order('name'),
                supabase.from('branches').select('*').order('name'),
                supabase.from('printers').select('*').order('name')
            ]);

            if (kError) throw kError;
            setKitchens(kitchensData || []);
            setSounds(soundData || []);
            setBranches(branchesData || []);
            setPrinters(printersData || []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Removed local toast timer logic

    const handleSave = async () => {
        if (!formData.name) {
            notify.error('El nombre es obligatorio');
            return;
        }

        setIsSaving(true);

        const validDeviceType = (formData.device_type === 'BOTH' || formData.device_type === 'NONE')
            ? 'PRINTER'
            : formData.device_type;

        const dataToSave = {
            name: formData.name.toUpperCase(),
            device_name: formData.device_name.toUpperCase(),
            device_type: validDeviceType,
            num_copies: formData.num_copies,
            is_printer: formData.is_printer,
            is_kds: formData.is_kds,
            is_enabled: formData.is_enabled,
            is_assigned_to_branch: formData.is_assigned_to_branch,
            sound_id: formData.sound_id || null,
            branch_id: formData.branch_id || null
        };

        let result;
        if (editingKitchen) {
            result = await supabase.from('kitchen_stations').update(dataToSave).eq('id', editingKitchen.id);
        } else {
            result = await supabase.from('kitchen_stations').insert([dataToSave]);
        }

        if (!result.error) {
            setShowModal(false);
            setEditingKitchen(null);
            fetchData();
            notify.success('Estación guardada correctamente');
        } else {
            notify.error('Error al guardar: ' + result.error.message);
        }
        setIsSaving(false);
    };

    const openEdit = (kitchen: any) => {
        setEditingKitchen(kitchen);
        setFormData({
            name: kitchen.name || '',
            device_name: kitchen.device_name || '',
            device_type: (kitchen.is_printer && kitchen.is_kds) ? 'BOTH' : ((!kitchen.is_printer && !kitchen.is_kds) ? 'NONE' : (kitchen.is_kds ? 'KDS' : 'PRINTER')),
            num_copies: kitchen.num_copies || 1,
            is_printer: kitchen.is_printer || false,
            is_kds: kitchen.is_kds || false,
            is_enabled: kitchen.is_enabled ?? true,
            is_assigned_to_branch: kitchen.is_assigned_to_branch ?? true,
            sound_id: kitchen.sound_id || '',
            branch_id: kitchen.branch_id || ''
        });
        setModalTab('INFO');
        setShowModal(true);
    };


    const handleDelete = async () => {
        if (!confirmDelete) return;
        const { error } = await supabase.from('kitchen_stations').delete().eq('id', confirmDelete);
        if (!error) {
            fetchData();
            notify.success('Estación eliminada correctamente');
        } else {
            notify.error('Error al eliminar: ' + error.message);
        }
        setConfirmDelete(null);
    };

    const handleAssignDevice = async () => {
        if (!assignDeviceKitchen || !selectedPrinter) return;

        setLoading(true);
        const { error } = await supabase
            .from('kitchen_stations')
            .update({ device_name: selectedPrinter })
            .eq('id', assignDeviceKitchen.id);

        if (!error) {
            notify.success('Dispositivo asignado correctamente');
            fetchData();
            setShowAssignDeviceModal(false);
        } else {
            notify.error('Error al asignar el dispositivo');
        }
        setLoading(false);
    };

    const filteredKitchens = React.useMemo(() => {
        const search = localSearch.toLowerCase();
        return kitchens.filter(k => {
            const matchesSearch = (k.name || '').toLowerCase().includes(search) ||
                (k.device_name || '').toLowerCase().includes(search) ||
                (k.branch?.name || '').toLowerCase().includes(search);
            const matchesBranch = selectedBranchFilter === 'ALL' || k.branch_id === selectedBranchFilter;
            return matchesSearch && matchesBranch;
        });
    }, [kitchens, localSearch, selectedBranchFilter]);

    return (
        <div ref={containerRef} className="h-full flex flex-col bg-[#fcfdfe] p-4 gap-4 relative select-none animate-fade-in">
            {/* Toolbar superior estilo Referencia */}
            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Sucursal</span>
                        <select
                            value={selectedBranchFilter}
                            onChange={(e) => setSelectedBranchFilter(e.target.value)}
                            className="h-8 px-3 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-medium text-[#106ebe] outline-none focus:border-[#106ebe] transition-all min-w-[280px]"
                        >
                            <option value="ALL">TODAS LAS SUCURSALES</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-md">
                    <div className="relative flex-1">
                        <input
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            type="text"
                            placeholder="Introduzca el texto a buscar..."
                            className="w-full h-8 pl-9 pr-4 bg-white border border-gray-300 rounded-lg text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] transition-all shadow-sm"
                        />
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    </div>
                    <button
                        onClick={() => fetchData()}
                        className="h-8 px-4 bg-gray-100 hover:bg-[#106ebe] hover:text-white text-slate-900 text-[10px] font-semibold uppercase tracking-widest rounded-lg transition-all border border-gray-300 active:scale-95"
                    >
                        Buscar
                    </button>
                </div>
            </div>

            {/* Tabla Estilo Referencia (Compacta y Profesional) */}
            <div
                className="flex-1 overflow-auto bg-white rounded-2xl border border-gray-100 shadow-sm relative"
                onContextMenu={(e) => {
                    e.preventDefault();
                    const rect = containerRef.current?.getBoundingClientRect();
                    setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), kitchen: null });
                }}
            >

                {loading ? (
                    <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-[#106ebe]" size={32} /></div>
                ) : (
                    <table className="w-full border-collapse text-[11px]">
                        <thead className="sticky top-0 z-20 bg-[#e8e8e8] select-none">
                            <tr className="border-b border-gray-400 h-10">
                                <th className="px-6 py-2 text-left text-[10px] font-medium text-black uppercase border-r border-gray-300 w-[25%]">Estación</th>
                                <th className="px-6 py-2 text-left text-[10px] font-medium text-black uppercase border-r border-gray-300 w-[25%]">Punto de Impresión / KDS</th>
                                <th className="px-6 py-2 text-center text-[10px] font-medium text-black uppercase border-r border-gray-300 w-[10%]">Ticket</th>
                                <th className="px-6 py-2 text-center text-[10px] font-medium text-black uppercase border-r border-gray-300 w-[10%]">Pantalla</th>
                                <th className="px-6 py-2 text-center text-[10px] font-medium text-black uppercase border-r border-gray-300 w-[10%]">Habilitado</th>
                                <th className="px-6 py-2 text-left text-[10px] font-medium text-black uppercase w-[20%]">Sucursal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {kitchens.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-slate-500 font-medium italic">
                                        No hay estaciones de cocina vinculadas. <br />
                                        Haz clic derecho para agregar una nueva.
                                    </td>
                                </tr>
                            ) : filteredKitchens.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-slate-500 font-medium italic">
                                        No se encontraron resultados para "{localSearch}".
                                    </td>
                                </tr>
                            ) : (
                                filteredKitchens.map((k, index) => (
                                    <tr
                                        key={k.id}
                                        onClick={() => setSelectedKitchenId(k.id)}
                                        onDoubleClick={() => openEdit(k)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setSelectedKitchenId(k.id);
                                            const rect = containerRef.current?.getBoundingClientRect();
                                            setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), kitchen: k });
                                        }}
                                        className={`h-6 transition-colors cursor-default relative border-b border-gray-50 ${
                                            selectedKitchenId === k.id
                                                ? 'bg-[#106ebe] text-white shadow-[inset_3px_0_0_#106ebe]'
                                                : index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'
                                        } text-slate-900`}
                                    >
                                        <td className="px-4 font-medium flex items-center gap-2 h-6 border-r border-gray-100">
                                            <ChefHat size={12} className={selectedKitchenId === k.id ? 'text-white' : 'text-slate-400'} />
                                            <span className="uppercase tracking-tight text-[10px]">{k.name}</span>
                                        </td>
                                        <td className="px-4 border-r border-gray-100">
                                            <span className={`uppercase tracking-tight text-[10px] ${selectedKitchenId === k.id ? 'text-blue-100' : 'text-slate-500 font-medium'}`}>{k.device_name || '---'}</span>
                                        </td>
                                        <td className="px-4 border-r border-gray-100">
                                            <div className="flex justify-center items-center h-full">
                                                <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${k.is_printer ? (selectedKitchenId === k.id ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                    {k.is_printer && <Check size={10} strokeWidth={4} />}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-1 px-6 text-center">
                                            <div className="flex justify-center">
                                                <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${k.is_kds ? 'bg-[#106ebe] border-[#106ebe] text-white' : 'bg-white border-gray-300'}`}>
                                                    {k.is_kds && <Check size={10} strokeWidth={4} />}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 border-r border-gray-100">
                                            <div className="flex justify-center items-center h-full">
                                                <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${k.is_enabled ? (selectedKitchenId === k.id ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                    {k.is_enabled && <Check size={10} strokeWidth={4} />}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4">
                                            <span className={`uppercase tracking-tight text-[9px] font-semibold flex items-center gap-1 ${selectedKitchenId === k.id ? 'text-blue-100' : 'text-[#106ebe]'}`}>
                                                <Building2 size={10} /> {k.branch?.name || 'CENTRAL / GENERAL'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="flex items-center justify-between shrink-0">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest pl-2 border-l-4 border-[#106ebe]">
                    {filteredKitchens.length} Estaciones Operativas
                </span>
            </div>

            {/* Menú Contextual Actualizado */}
            {contextMenu && (
                <div
                    className="absolute z-[1000] bg-white border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-75"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                    <button
                        onClick={() => { setEditingKitchen(null); setFormData(defaultFormData); setShowModal(true); setContextMenu(null); }}
                        className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                    >
                        <Plus size={14} className="text-emerald-500 group-hover:text-white" /> Nuevo Registro
                    </button>
                    <div className="h-px bg-gray-100 my-1"></div>
                    {contextMenu.kitchen && (
                        <>
                            <button
                                onClick={() => { openEdit(contextMenu.kitchen); setContextMenu(null); }}
                                className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                            >
                                <Edit3 size={14} className="text-[#106ebe] group-hover:text-white" /> Editar Configuración
                            </button>
                            <button
                                onClick={() => {
                                    setAssignDeviceKitchen(contextMenu.kitchen);
                                    setSelectedPrinter(contextMenu.kitchen.device_name || '');
                                    setShowAssignDeviceModal(true);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                            >
                                <Smartphone size={14} className="text-indigo-500 group-hover:text-white" /> Asignar Dispositivo
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button
                                onClick={() => { setConfirmDelete(contextMenu.kitchen.id); setContextMenu(null); }}
                                className="w-full text-left px-4 py-2 text-[11px] font-medium text-red-600 hover:bg-red-600 hover:text-white flex items-center gap-3 group transition-colors"
                            >
                                <Trash2 size={14} className="text-red-500 group-hover:text-white" /> Eliminar Estación
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                        </>
                    )}
                    <button
                        onClick={() => { fetchData(); setContextMenu(null); }}
                        className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-600 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                    >
                        <RefreshCw size={14} className="text-gray-400 group-hover:text-white" /> Refrescar
                    </button>
                </div>
            )}

            {/* Modal de Configuración Estilo Referencia 2 */}
            {showModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
                    <div className="absolute inset-0" onClick={() => setShowModal(false)} />
                    <DraggableWindow id="kitchens-admin-modal" title="Mantenimiento de Cocinas">
                        <div
                            className="w-full max-w-2xl bg-[#f0f0f0] shadow-2xl overflow-hidden border border-[#106ebe] flex flex-col max-h-[90vh] relative z-20 pointer-events-auto"
                        >
                            <div
                                className="bg-[#106ebe] h-8 flex items-center justify-between px-3 shrink-0 modal-header cursor-default select-none"
                            >
                                <div className="flex items-center gap-2 pointer-events-none select-none">
                                    <ChefHat size={14} className="text-white" />
                                    <span className="text-white text-[11px] font-medium">Mantenimiento de Cocinas</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <WindowsSaveButton onClick={handleSave} loading={isSaving} title="Guardar Estación" variant="minimal" />
                                    <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" title="Cerrar">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 overflow-y-auto custom-scrollbar space-y-4">
                                {/* Sección Datos de Cocina */}
                                <div className="bg-white border border-gray-300 shadow-sm">
                                    <div className="bg-[#cbd5e1] px-3 py-1 border-b border-gray-300">
                                        <span className="text-[11px] font-medium text-[#106ebe] uppercase tracking-tighter">Datos de Cocina</span>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">Cocina</label>
                                            <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })} type="text" className="erp-input-field" />
                                        </div>
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">Dispositivo</label>
                                            <input value={formData.device_name} onChange={e => setFormData({ ...formData, device_name: e.target.value.toUpperCase() })} type="text" className="erp-input-field" />
                                        </div>
                                        <div className="grid grid-cols-[100px_140px] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">No. de Copias</label>
                                            <input value={formData.num_copies} onChange={e => setFormData({ ...formData, num_copies: parseInt(e.target.value) || 1 })} type="number" min="1" className="erp-input-field" />
                                        </div>
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">Sonido KDS</label>
                                            <div className="flex gap-2">
                                                <select value={formData.sound_id} onChange={e => setFormData({ ...formData, sound_id: e.target.value })} className="erp-input-field flex-1">
                                                    <option value="">CAMPANA PREDETERMINADA</option>
                                                    {sounds.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                                {formData.sound_id && (
                                                    <button onClick={() => {
                                                        const sound = sounds.find(s => s.id === formData.sound_id);
                                                        if (sound) { new Audio(sound.file_url).play(); }
                                                    }} className="px-2 bg-gray-200 border border-gray-300 rounded hover:bg-gray-300 active:bg-gray-400 transition-colors">
                                                        <Volume2 size={14} className="text-[#106ebe]" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sección Sucursales con Tabla de Checkboxes */}
                                <div className="bg-white border border-gray-300 shadow-sm">
                                    <div className="bg-[#cbd5e1] px-3 py-1 border-b border-gray-300">
                                        <span className="text-[11px] font-medium text-[#106ebe] uppercase tracking-tighter">Sucursales</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-[10px]">
                                            <thead className="bg-[#e8e8e8] select-none uppercase">
                                                <tr className="text-black font-medium border-b border-gray-400 h-8">
                                                    <th className="px-6 py-2 text-left border-r border-gray-300">Agencia / Sucursal</th>
                                                    <th className="px-2 py-2 text-center border-r border-gray-300 w-16">Imprime</th>
                                                    <th className="px-2 py-2 text-center border-r border-gray-300 w-16">KDS</th>
                                                    <th className="px-2 py-2 text-center border-r border-gray-300 w-16">Hab.</th>
                                                    <th className="px-2 py-2 text-center border-r border-gray-300 w-16">Sucursal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {branches.map((b, index) => (
                                                    <tr key={b.id} className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'}`}>
                                                        <td className="py-2 px-6 font-medium text-gray-700 border-r border-gray-300 uppercase">{b.name}</td>
                                                        <td className="py-2 px-2 text-center border-r border-gray-300">
                                                            <input type="checkbox" checked={formData.branch_id === b.id ? formData.is_printer : false} disabled={formData.branch_id !== b.id} onChange={e => formData.branch_id === b.id && setFormData({ ...formData, is_printer: e.target.checked })} className="w-3.5 h-3.5 accent-[#106ebe]" />
                                                        </td>
                                                        <td className="py-2 px-2 text-center border-r border-gray-300">
                                                            <input type="checkbox" checked={formData.branch_id === b.id ? formData.is_kds : false} disabled={formData.branch_id !== b.id} onChange={e => formData.branch_id === b.id && setFormData({ ...formData, is_kds: e.target.checked })} className="w-3.5 h-3.5 accent-[#106ebe]" />
                                                        </td>
                                                        <td className="py-2 px-2 text-center border-r border-gray-300">
                                                            <input type="checkbox" checked={formData.branch_id === b.id ? formData.is_enabled : false} disabled={formData.branch_id !== b.id} onChange={e => formData.branch_id === b.id && setFormData({ ...formData, is_enabled: e.target.checked })} className="w-3.5 h-3.5 accent-[#106ebe]" />
                                                        </td>
                                                        <td className="py-2 px-2 text-center">
                                                            <input type="checkbox" checked={formData.branch_id === b.id} onChange={() => setFormData({ ...formData, branch_id: b.id })} className="w-3.5 h-3.5 accent-[#106ebe]" />
                                                        </td>
                                                    </tr>
                                                ))}
                                                {/* Fila para "TODAS LAS SUCURSALES / GENERAL" */}
                                                <tr className="bg-gray-50/50">
                                                    <td className="py-2 px-6 font-semibold text-[#106ebe]/40 border-r border-gray-300 uppercase">General / Sucursal</td>
                                                    <td className="py-2 px-2 text-center border-r border-gray-300">
                                                        <input type="checkbox" checked={!formData.branch_id ? formData.is_printer : false} disabled={!!formData.branch_id} onChange={e => !formData.branch_id && setFormData({ ...formData, is_printer: e.target.checked })} className="w-3.5 h-3.5 accent-[#106ebe]" />
                                                    </td>
                                                    <td className="py-2 px-2 text-center border-r border-gray-300">
                                                        <input type="checkbox" checked={!formData.branch_id ? formData.is_kds : false} disabled={!!formData.branch_id} onChange={e => !formData.branch_id && setFormData({ ...formData, is_kds: e.target.checked })} className="w-3.5 h-3.5 accent-[#106ebe]" />
                                                    </td>
                                                    <td className="py-2 px-2 text-center border-r border-gray-300">
                                                        <input type="checkbox" checked={!formData.branch_id ? formData.is_enabled : false} disabled={!!formData.branch_id} onChange={e => !formData.branch_id && setFormData({ ...formData, is_enabled: e.target.checked })} className="w-3.5 h-3.5 accent-[#106ebe]" />
                                                    </td>
                                                    <td className="py-2 px-2 text-center">
                                                        <input type="checkbox" checked={!formData.branch_id} onChange={() => setFormData({ ...formData, branch_id: '' })} className="w-3.5 h-3.5 accent-[#106ebe]" />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>
            )}

            {showAssignDeviceModal && assignDeviceKitchen && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 pointer-events-none">
                    <div className="absolute inset-0 pointer-events-auto" onClick={() => setShowAssignDeviceModal(false)}></div>
                    <DraggableWindow id="kitchens-device-assign" title="Asignar Dispositivo">
                        <div className="bg-white w-[500px] shadow-2xl border border-[#106ebe] overflow-hidden animate-zoom-in pointer-events-auto relative flex flex-col">
                            <div className="bg-[#106ebe] h-8 flex items-center justify-between px-3 shrink-0 modal-header cursor-default select-none">
                                <span className="text-white text-[11px] font-medium uppercase tracking-wider">Asignar Dispositivo</span>
                                <button onClick={() => setShowAssignDeviceModal(false)} className="text-white/60 hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-3">Dispositivo</h4>
                                    <div className="flex flex-col gap-4">
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-slate-700 uppercase">Punto Impresión</label>
                                            <select
                                                value={selectedPrinter}
                                                onChange={(e) => setSelectedPrinter(e.target.value)}
                                                className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-[12px] font-semibold text-[#106ebe] outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                                            >
                                                <option value="">SELECCIONE PUNTO DE IMPRESIÓN...</option>
                                                {printers.filter(p => !p.branch_id || p.branch_id === assignDeviceKitchen.branch_id).map(p => (
                                                    <option key={p.id} value={p.name}>{p.name} ({p.connection_type})</option>
                                                ))}
                                                {/* Allow manual entry if needed, but for now just dropdown */}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        onClick={handleAssignDevice}
                                        disabled={loading || !selectedPrinter}
                                        className="px-8 py-2.5 bg-[#106ebe] hover:bg-black text-white rounded-xl font-semibold text-[10px] tracking-widest uppercase transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                        Aceptar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>
            )}

            {confirmDelete && (
                <WindowsConfirmModal
                    title="Confirmar Eliminación"
                    message="¿Desea eliminar esta estación de cocina permanentemente?"
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onDeny={() => setConfirmDelete(null)}
                />
            )}

            <style>{`
                .premium-input-field { width: 100%; height: 28px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; font-weight: 700; padding: 0 10px; color: #106ebe; outline: none; transition: all 0.2s; }
                .premium-input-field:focus { border-color: #106ebe; box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.05); }
                .premium-input-field::placeholder { color: #cbd5e1; font-weight: 400; }
                
                .erp-input-field { width: 100%; height: 24px; background: white; border: 1px solid #cbd5e1; border-radius: 2px; font-size: 11px; font-weight: 600; padding: 0 6px; color: #334155; outline: none; transition: all 0.1s; }
                .erp-input-field:focus { border-color: #106ebe; background: #f8fafc; }

                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                @keyframes fade-in { from { opacity: 0;  } to { opacity: 1;  } }
                @keyframes zoom-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .animate-zoom-in { animation: zoom-in 0.15s ease-out forwards; }
            `}</style>
        </div>
    );
};
