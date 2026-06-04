import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bike, Plus, Trash2, Smartphone, X, Loader2, Edit2, MessageCircle, MapPin, Save, Check, Search } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';
import { VerifiedScooterIcon, UnverifiedScooterIcon } from '../ScooterIcons';

export const ConfigDrivers: React.FC = () => {
    const [drivers, setDrivers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
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

    const [form, setForm] = useState({
        id: '',
        name: '',
        vehicle_info: '',
        phone: '',
        status: 'active',
        is_verified: true,
        branch_id: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [driversRes, branchesRes] = await Promise.all([
                supabase.from('delivery_drivers').select('*, branch:branches(name)').order('name'),
                supabase.from('branches').select('id, name').order('name')
            ]);
            setDrivers(driversRes.data || []);
            setBranches(branchesRes.data || []);

            if (branchesRes.data && branchesRes.data.length > 0) {
                setForm(prev => prev.branch_id ? prev : { ...prev, branch_id: branchesRes.data![0].id });
            }
        } catch (err) {
            console.error('Error fetching drivers:', err);
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
                vehicle_info: form.vehicle_info.toUpperCase(),
                phone: form.phone,
                status: form.status,
                is_verified: form.is_verified,
                branch_id: form.branch_id
            };

            const { error } = form.id
                ? await supabase.from('delivery_drivers').update(dataToSave).eq('id', form.id)
                : await supabase.from('delivery_drivers').insert([dataToSave]);

            if (error) throw error;
            setShowModal(false);
            fetchData();
            notify.success('Repartidor guardado correctamente');
        } catch (error: any) {
            notify.error('Error al guardar repartidor: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const { error } = await supabase.from('delivery_drivers').delete().eq('id', confirmDelete.id);
        if (!error) {
            fetchData();
            notify.success('Repartidor eliminado correctamente');
        } else {
            notify.error('Error al eliminar: ' + error.message);
        }
        setConfirmDelete(null);
    };

    const handleToggleStatus = async (driver: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const newStatus = driver.status === 'active' ? 'busy' : 'active';
        // Optimistic UI update
        setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, status: newStatus } : d));

        const { error } = await supabase.from('delivery_drivers').update({ status: newStatus }).eq('id', driver.id);
        if (error) {
            fetchData(); // Rollback
            notify.error('Error al actualizar estado: ' + error.message);
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
                vehicle_info: item.vehicle_info || '',
                phone: item.phone || '',
                status: item.status || 'active',
                is_verified: item.is_verified !== false,
                branch_id: item.branch_id || (branches.length > 0 ? branches[0].id : '')
            });
        } else {
            setEditingItem(null);
            setForm({
                id: '',
                name: '',
                vehicle_info: '',
                phone: '',
                status: 'active',
                is_verified: true,
                branch_id: branches[0]?.id || ''
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

    const handleSendTracking = (driver: any) => {
        if (!driver.phone) {
            notify.error('El repartidor no tiene teléfono registrado.');
            return;
        }
        const link = `${window.location.origin}?mode=tracker&driver_id=${driver.id}`;
        const msg = `Hola ${driver.name}, activa tu rastreo: ${link}`;
        window.open(`https://wa.me/${driver.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const filtered = drivers.filter(d => {
        const matchSearch = searchTerm === '' || d.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchBranch = branchFilter === 'ALL' || d.branch_id === branchFilter;
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
            <div className="grid grid-cols-[1fr_150px_280px_100px] bg-[#e8e8e8] border-b border-gray-400 font-medium text-black text-[10px] select-none shrink-0 uppercase">
                <div className="py-2 px-6 border-r border-gray-300 text-left tracking-tight">Repartidor</div>
                <div className="py-2 px-6 border-r border-gray-300 text-left tracking-tight">Teléfono</div>
                <div className="py-2 px-6 border-r border-gray-300 text-left tracking-tight">Sucursal</div>
                <div className="py-2 px-6 text-center tracking-tight">Habilitado</div>
            </div>

            {/* Sub-header row */}
            <div className="grid grid-cols-[1fr_150px_280px_100px] bg-[#fafafa] border-b border-gray-300 shrink-0">
                <div className="py-1 px-4 border-r border-gray-300" />
                <div className="py-1 px-4 border-r border-gray-300">
                    <div className="text-[10px] text-gray-400 font-semibold">=</div>
                </div>
                <div className="py-1 px-4 border-r border-gray-300">
                    <div className="text-[10px] text-gray-400 font-semibold">=</div>
                </div>
                <div className="py-1 px-4 flex justify-center items-center">
                    <div className="w-3.5 h-3.5 border border-gray-500 bg-gray-700 flex items-center justify-center">
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
                            <col style={{ width: '150px' }} />
                            <col style={{ width: '280px' }} />
                            <col style={{ width: '100px' }} />
                        </colgroup>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-slate-500 font-medium italic text-[11px]">
                                        No se encontraron repartidores.<br />
                                        Haz clic derecho para crear uno nuevo.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(driver => {
                                    const isSelected = editingItem?.id === driver.id;
                                    return (
                                        <tr
                                            key={driver.id}
                                            onClick={() => setEditingItem(driver)}
                                            onDoubleClick={() => openModal(driver)}
                                            onContextMenu={(e) => handleContextMenu(e, driver)}
                                            className={`h-6 border-b border-gray-50 cursor-default transition-colors ${isSelected ? 'bg-[#106ebe] text-white' : 'text-slate-900 even:bg-slate-50/50'}`}
                                        >
                                            <td className="px-4 border-r border-gray-100">
                                                <div className="flex items-center gap-2 h-6">
                                                    <div className="flex items-center justify-center w-10">
                                                        {driver.is_verified !== false ? (
                                                            <VerifiedScooterIcon size={24} />
                                                        ) : (
                                                            <UnverifiedScooterIcon size={24} />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="uppercase font-medium text-[10px] leading-tight tracking-tight">{driver.name}</span>
                                                        <span className={`uppercase text-[8px] font-medium tracking-tighter ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{driver.vehicle_info || 'SIN VEHÍCULO'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 border-r border-gray-100 text-[10px] font-medium tracking-tight">
                                                {driver.phone || ''}
                                            </td>
                                            <td className="px-4 border-r border-gray-100 text-[10px] font-medium truncate tracking-tight">
                                                {driver.branch?.name || ''}
                                            </td>
                                            <td className="px-4">
                                                <div
                                                    className="flex justify-center items-center h-full cursor-pointer"
                                                    onClick={(e) => handleToggleStatus(driver, e)}
                                                    title={driver.status === 'active' ? 'Habilitado (Libre) — clic para cambiar estado' : 'Inhabilitado (Ocupado) — clic para cambiar estado'}
                                                >
                                                    <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${driver.status === 'active' ? (isSelected ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                        {driver.status === 'active' && <Check size={10} strokeWidth={4} />}
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
                    className="absolute z-[100] w-52 bg-[#f5f5f5] border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-1 flex flex-col"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                    <button
                        onClick={() => { setContextMenu({ ...contextMenu, visible: false }); openModal(null); }}
                        className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-medium transition-colors group text-slate-900"
                    >
                        <Plus size={14} className="group-hover:text-white text-emerald-600" /> Nuevo Repartidor
                    </button>
                    {contextMenu.item && (
                        <>
                            <div className="h-px bg-gray-200 my-1" />
                            <button
                                onClick={() => { setContextMenu({ ...contextMenu, visible: false }); openModal(contextMenu.item); }}
                                className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-medium transition-colors group text-slate-900"
                            >
                                <Edit2 size={14} className="text-[#106ebe] group-hover:text-white" /> Modificar
                            </button>
                            <button
                                onClick={() => { setContextMenu({ ...contextMenu, visible: false }); handleSendTracking(contextMenu.item); }}
                                className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-medium transition-colors group text-slate-900"
                            >
                                <MapPin size={14} className="text-indigo-500 group-hover:text-white" /> Enviar Rastreo
                            </button>
                            <button
                                onClick={() => { setContextMenu({ ...contextMenu, visible: false }); setConfirmDelete(contextMenu.item); }}
                                className="w-full text-left px-4 py-1.5 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-[11px] font-medium transition-colors group text-slate-900"
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
                        <div className="w-[500px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106ebe] flex flex-col pointer-events-auto animate-slide-up">
                            {/* Modal Header */}
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move select-none shrink-0">
                                <div className="flex items-center gap-2">
                                    <Bike size={14} className="text-white/80" />
                                    <span className="text-white text-[12px] font-medium tracking-wide">
                                        Mantenimiento de Repartidores
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
                            <div className="p-4 bg-[#f0f0f0] flex flex-col gap-4">
                                <div className="border border-gray-400 p-3 pt-4 relative bg-[#f0f0f0] rounded-sm">
                                    <span className="text-[11px] text-slate-800 font-medium px-1 absolute -top-2.5 left-2 bg-[#f0f0f0]">Datos de Repartidor</span>

                                    <div className="space-y-3">
                                        {/* Nombre */}
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                                            <label className="text-[11px] font-medium text-slate-900">Nombre</label>
                                            <input
                                                value={form.name}
                                                onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })}
                                                type="text"
                                                className="w-full bg-white border border-gray-400 rounded-sm px-2 h-7 text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] shadow-sm uppercase"
                                                placeholder="EJ. JUAN PEREZ"
                                            />
                                        </div>

                                        {/* Teléfono */}
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                                            <label className="text-[11px] font-medium text-slate-900">Teléfono</label>
                                            <div className="relative">
                                                <Smartphone size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    value={form.phone}
                                                    onChange={e => setForm({ ...form, phone: e.target.value })}
                                                    type="text"
                                                    className="w-full bg-white border border-gray-400 rounded-sm pl-7 pr-2 h-7 text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] shadow-sm"
                                                    placeholder="5555-5555"
                                                />
                                            </div>
                                        </div>

                                        {/* Vehículo */}
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                                            <label className="text-[11px] font-medium text-slate-900 leading-tight">Vehículo / Placas</label>
                                            <input
                                                value={form.vehicle_info}
                                                onChange={e => setForm({ ...form, vehicle_info: e.target.value.toUpperCase() })}
                                                type="text"
                                                className="w-full bg-white border border-gray-400 rounded-sm px-2 h-7 text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] shadow-sm uppercase"
                                                placeholder="EJ. MOTO HONDA"
                                            />
                                        </div>

                                        {/* Sucursal */}
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                                            <label className="text-[11px] font-medium text-slate-900">Sucursal</label>
                                            <select
                                                value={form.branch_id}
                                                onChange={e => setForm({ ...form, branch_id: e.target.value })}
                                                className="w-full min-w-[280px] bg-white border border-gray-400 rounded-sm px-2 h-7 text-[11px] font-medium text-slate-900 outline-none focus:border-[#106ebe] shadow-sm"
                                            >
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Estado / Habilitado */}
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                                            <label className="text-[11px] font-medium text-slate-900">Estado</label>
                                            <div className="flex items-center gap-4">
                                                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-900">
                                                    <input
                                                        type="radio"
                                                        className="h-3 w-3 accent-[#0078d7]"
                                                        checked={form.status === 'active'}
                                                        onChange={() => setForm({ ...form, status: 'active' })}
                                                    />
                                                    Habilitado (Libre)
                                                </label>
                                                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-900">
                                                    <input
                                                        type="radio"
                                                        className="h-3 w-3 accent-amber-500"
                                                        checked={form.status === 'busy'}
                                                        onChange={() => setForm({ ...form, status: 'busy' })}
                                                    />
                                                    Inhabilitado (Ocupado)
                                                </label>
                                            </div>
                                        </div>

                                        {/* Vehículo Verificado */}
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                                            <label className="text-[11px] font-medium text-slate-900">Vehículo</label>
                                            <button
                                                onClick={() => setForm({ ...form, is_verified: !form.is_verified })}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all ${form.is_verified ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}
                                            >
                                                {form.is_verified ? <VerifiedScooterIcon size={24} /> : <UnverifiedScooterIcon size={24} />}
                                                <span className="text-[10px] font-semibold uppercase tracking-widest">
                                                    {form.is_verified ? 'Vehículo Verificado' : 'No Verificado'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Tracking Info Card */}
                                <div className="bg-indigo-50 border border-indigo-200 rounded-sm p-3">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                                        <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-widest">Rastreo GPS Activo</span>
                                    </div>
                                    <p className="text-[9px] font-medium text-indigo-600/70 uppercase leading-relaxed tracking-wider">
                                        "EL SISTEMA REGISTRA LA UBICACIÓN GPS DEL REPARTIDOR CADA 45 SEGUNDOS. ASEGÚRESE QUE EL REPARTIDOR TENGA INTERNET Y ACTIVA SU SESIÓN DE RASTREO."
                                    </p>
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
                    message="¿Seguro que desea eliminar este repartidor?"
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onDeny={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
};
