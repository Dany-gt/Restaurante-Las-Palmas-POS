import React, { useState, useEffect, useRef } from 'react';
import {
    Wallet, Plus, RefreshCw, Search, X, Save, Trash2, Edit3,
    Smartphone, Check, CheckCircle, XCircle, Loader2, Building2,
    Printer, Cpu, Fingerprint, Star
} from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';

export const CajasAdmin: React.FC = () => {
    const [cashiers, setCashiers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [printers, setPrinters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(() => {
        const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        return cachedUser?.branch_id || 'ALL';
    });
    const [localSearch, setLocalSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingCaja, setEditingCaja] = useState<any | null>(null);
    const [selectedCajaId, setSelectedCajaId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, caja: any } | null>(null);
    const notify = useNotify();
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const defaultFormData = {
        name: '',
        printer_name: '',
        branch_id: '',
        is_active: true,
        enable_fingerprint: false,
        mac_address: '',
        serial_number: '',
        verification_code: '',
        activation_code: ''
    };

    const [formData, setFormData] = useState(defaultFormData);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [
                { data: registersData, error: rError },
                { data: branchesData, error: bError },
                { data: printersData }
            ] = await Promise.all([
                supabase.from('cash_registers').select('*, branch:branches(name)').order('name'),
                supabase.from('branches').select('*').order('name'),
                supabase.from('printers').select('*').order('name')
            ]);

            if (rError) throw rError;
            setCashiers(registersData || []);
            setBranches(branchesData || []);
            setPrinters(printersData || []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Removed local toast timer logic

    const handleSave = async () => {
        if (!formData.name || !formData.branch_id) {
            notify.error('Nombre y Sucursal son obligatorios');
            return;
        }

        setIsSaving(true);
        try {
            const dataToSave = {
                name: formData.name.toUpperCase(),
                printer_name: formData.printer_name,
                branch_id: formData.branch_id,
                is_active: formData.is_active,
                // Add these fields if they exist in DB, if not Supabase will ignore them if not in schema
                // or we can handle them if they are in a metadata column
                enable_fingerprint: formData.enable_fingerprint,
                mac_address: formData.mac_address,
                serial_number: formData.serial_number,
                verification_code: formData.verification_code,
                activation_code: formData.activation_code
            };

            const { error } = editingCaja
                ? await supabase.from('cash_registers').update(dataToSave).eq('id', editingCaja.id)
                : await supabase.from('cash_registers').insert([dataToSave]);

            if (error) throw error;

            notify.success(`Caja ${editingCaja ? 'actualizada' : 'registrada'} correctamente`);
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            notify.error('Error al guardar: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const openEdit = (caja: any) => {
        setEditingCaja(caja);
        setFormData({
            name: caja.name || '',
            printer_name: caja.printer_name || '',
            branch_id: caja.branch_id || '',
            is_active: caja.is_active ?? true,
            enable_fingerprint: caja.enable_fingerprint || false,
            mac_address: caja.mac_address || '',
            serial_number: caja.serial_number || '',
            verification_code: caja.verification_code || '',
            activation_code: caja.activation_code || ''
        });
        setShowModal(true);
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const { error } = await supabase.from('cash_registers').delete().eq('id', confirmDelete);
        if (!error) {
            notify.success('Caja eliminada correctamente');
            fetchData();
        } else {
            notify.error('Error al eliminar: ' + error.message);
        }
        setConfirmDelete(null);
    };

    const filteredCashiers = cashiers.filter(c => {
        const matchesBranch = selectedBranchFilter === 'ALL' || c.branch_id === selectedBranchFilter;
        const matchesSearch = c.name.toLowerCase().includes(localSearch.toLowerCase()) ||
            (c.branch?.name || '').toLowerCase().includes(localSearch.toLowerCase());
        return matchesBranch && matchesSearch;
    });

    return (
        <div className="flex flex-col h-full bg-[#f0f0f0] overflow-hidden text-slate-900" ref={containerRef} onClick={() => setContextMenu(null)}>
            {/* Toolbar Principal - Estilo Windows Classic */}
            <div className="bg-[#e6e6e6] px-3 border-b border-gray-300 flex items-center justify-between shrink-0 h-[40px]">
                {/* Izquierda: Sucursal */}
                <div className="flex items-center gap-2">
                    <span className="text-slate-900 font-medium text-[12px]">Sucursal</span>
                    <select
                        value={selectedBranchFilter}
                        onChange={(e) => setSelectedBranchFilter(e.target.value)}
                        className="min-w-[280px] bg-white border border-gray-400 rounded-sm px-2 outline-none text-[11px] text-slate-900 font-medium focus:border-[#106ebe] h-[24px]"
                    >
                        <option value="ALL">TODAS LAS SUCURSALES</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>

                {/* Derecha: Buscador y Acciones */}
                <div className="flex items-center gap-1">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Introduzca el texto a buscar..."
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            className="bg-white border border-gray-400 rounded-sm px-2 text-[11px] w-64 outline-none text-slate-900 font-medium focus:border-[#106ebe] h-[24px]"
                        />
                    </div>
                    <button className="bg-[#e1e1e1] border border-gray-400 px-4 text-[11px] font-medium hover:bg-[#d0d0d0] text-slate-900 shadow-sm rounded-sm transition-colors h-[24px] flex items-center">
                        Buscar
                    </button>
                </div>
            </div>

            {/* Contenedor de Tabla */}
            <div
                className="flex-1 overflow-auto bg-white custom-scrollbar"
                onContextMenu={(e) => {
                    e.preventDefault();
                    const rect = containerRef.current?.getBoundingClientRect();
                    setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), caja: null });
                }}
            >

                {loading ? (
                    <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-[#106ebe]" size={32} /></div>
                ) : (
                    <table className="w-full border-collapse text-[11px]">
                        <thead className="bg-[#e8e8e8] sticky top-0 z-10 select-none">
                            <tr className="border-b border-gray-400 h-8">
                                <th className="px-4 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[40%]">Caja</th>
                                <th className="px-4 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[40%]">Punto de Impresión</th>
                                <th className="px-4 text-center text-[10px] font-bold text-black uppercase w-[20%]">Habilitado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredCashiers.map((c) => (
                                <tr
                                    key={c.id}
                                    onClick={() => setSelectedCajaId(c.id)}
                                    onDoubleClick={() => openEdit(c)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedCajaId(c.id);
                                        const rect = containerRef.current?.getBoundingClientRect();
                                        setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), caja: c });
                                    }}
                                    className={`h-6 cursor-default transition-colors border-b border-gray-50 ${selectedCajaId === c.id
                                        ? 'bg-[#106ebe] text-white'
                                        : 'text-slate-900 even:bg-slate-50/50'
                                        }`}
                                >
                                    <td className="px-4 border-r border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <Wallet size={12} className={selectedCajaId === c.id ? 'text-white' : 'text-slate-400'} />
                                            <span className="font-bold uppercase tracking-tight text-[10px]">{c.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 border-r border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <Printer size={12} className={selectedCajaId === c.id ? 'text-white' : 'text-slate-400'} />
                                            <span className="font-bold uppercase tracking-tight text-[10px]">{c.printer_name || 'CAJA'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4">
                                        <div className="flex justify-center items-center h-full">
                                            <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${c.is_active ? (selectedCajaId === c.id ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                {c.is_active && <Check size={10} strokeWidth={4} />}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Menú Contextual */}
            {contextMenu && (
                <div
                    className="absolute z-[1000] bg-white border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-75"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                    <button
                        onClick={() => { setEditingCaja(null); setFormData(defaultFormData); setShowModal(true); setContextMenu(null); }}
                        className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                    >
                        <Plus size={14} className="text-emerald-600 group-hover:text-white" /> Nuevo Registro
                    </button>
                    <div className="h-px bg-gray-100 my-1"></div>
                    {contextMenu.caja && (
                        <>
                            <button
                                onClick={() => { openEdit(contextMenu.caja); setContextMenu(null); }}
                                className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                            >
                                <Edit3 size={14} className="text-[#106ebe] group-hover:text-white" /> Editar Configuración
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button
                                onClick={() => { setConfirmDelete(contextMenu.caja.id); setContextMenu(null); }}
                                className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                            >
                                <Trash2 size={14} className="text-red-500 group-hover:text-white" /> Eliminar Registro
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                        </>
                    )}
                    <button
                        onClick={() => { fetchData(); setContextMenu(null); }}
                        className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-600 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                    >
                        <RefreshCw size={14} className="text-gray-400 group-hover:text-white" /> Refrescar
                    </button>
                </div>
            )}

            {/* Modal de Mantenimiento de Cajas */}
            {showModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
                    <div className="absolute inset-0" onClick={() => setShowModal(false)} />
                    <DraggableWindow id="cajas-admin-modal" title="Mantenimiento de Cajas">
                        <div className="w-full max-w-2xl bg-[#f0f0f0] shadow-2xl overflow-hidden border border-[#106ebe] flex flex-col max-h-[90vh] relative z-20 pointer-events-auto">
                            {/* Header del Modal */}
                            <div className="bg-[#106ebe] h-8 flex items-center justify-between px-3 shrink-0 modal-header cursor-default select-none">
                                <div className="flex items-center gap-2 pointer-events-none select-none">
                                    <span className="text-white text-[11px] font-bold">Mantenimiento de Cajas</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <WindowsSaveButton onClick={handleSave} loading={isSaving} title="Guardar Caja" variant="minimal" />
                                    <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" title="Cerrar">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 overflow-y-auto custom-scrollbar space-y-4">
                                {/* Sección Datos de Caja */}
                                <div className="bg-white border border-gray-300 shadow-sm">
                                    <div className="bg-[#cbd5e1] px-3 py-1 border-b border-gray-300">
                                        <span className="text-[11px] font-bold text-[#106ebe] uppercase tracking-tighter">Datos de Caja</span>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">Caja</label>
                                            <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })} type="text" className="erp-input-field" />
                                        </div>
                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">Punto de Impresión</label>
                                            <select
                                                value={formData.printer_name}
                                                onChange={e => setFormData({ ...formData, printer_name: e.target.value })}
                                                className="erp-input-field"
                                            >
                                                <option value="">SELECCIONE PUNTO DE IMPRESIÓN...</option>
                                                {printers.map(p => (
                                                    <option key={p.id} value={p.name}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-[100px_1fr_100px] items-center gap-4">
                                            <label className="text-[11px] font-medium text-gray-700">Sucursal</label>
                                            <select
                                                value={formData.branch_id}
                                                onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                                                className="erp-input-field min-w-[280px]"
                                            >
                                                <option value="">Seleccionar Sucursal...</option>
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.is_active}
                                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                                    className="w-3.5 h-3.5 accent-[#106ebe]"
                                                    id="chk_habilitado"
                                                />
                                                <label htmlFor="chk_habilitado" className="text-[11px] font-medium text-gray-700 cursor-pointer">Habilitado</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sección Lector de Huella */}
                                <div className="bg-white border border-gray-300 shadow-sm">
                                    <div className="bg-[#cbd5e1] px-3 py-1 border-b border-gray-300">
                                        <span className="text-[11px] font-bold text-[#106ebe] uppercase tracking-tighter">Lector de Huella</span>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.enable_fingerprint}
                                                onChange={e => setFormData({ ...formData, enable_fingerprint: e.target.checked })}
                                                className="w-3.5 h-3.5 accent-[#106ebe]"
                                                id="chk_fingerprint"
                                            />
                                            <label htmlFor="chk_fingerprint" className="text-[11px] font-medium text-gray-700 cursor-pointer">Habilitar Lector de Huella</label>
                                        </div>

                                        <div className={`space-y-2 transition-opacity duration-300 ${!formData.enable_fingerprint ? 'opacity-40' : ''}`}>
                                            <div className="grid grid-cols-[100px_1fr_120px] items-center gap-4">
                                                <label className="text-[11px] font-medium text-gray-700">Dirección MAC</label>
                                                <input
                                                    value={formData.mac_address}
                                                    onChange={e => setFormData({ ...formData, mac_address: e.target.value })}
                                                    disabled={!formData.enable_fingerprint}
                                                    type="text"
                                                    className="erp-input-field bg-gray-50"
                                                />
                                                <button className="h-6 bg-[#0066cc] hover:bg-[#004499] text-white text-[10px] font-bold uppercase rounded shadow-sm transition-all focus:ring-2 focus:ring-blue-500/20 active:scale-95 disabled:opacity-50">
                                                    Obtener MAC
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                                <label className="text-[11px] font-medium text-gray-700">Serie</label>
                                                <input
                                                    value={formData.serial_number}
                                                    onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
                                                    disabled={!formData.enable_fingerprint}
                                                    type="text"
                                                    className="erp-input-field bg-gray-50"
                                                />
                                            </div>
                                            <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                                <label className="text-[11px] font-medium text-gray-700">Verificación</label>
                                                <input
                                                    value={formData.verification_code}
                                                    onChange={e => setFormData({ ...formData, verification_code: e.target.value })}
                                                    disabled={!formData.enable_fingerprint}
                                                    type="text"
                                                    className="erp-input-field bg-gray-50"
                                                />
                                            </div>
                                            <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                                <label className="text-[11px] font-medium text-gray-700">Activación</label>
                                                <input
                                                    value={formData.activation_code}
                                                    onChange={e => setFormData({ ...formData, activation_code: e.target.value })}
                                                    disabled={!formData.enable_fingerprint}
                                                    type="text"
                                                    className="erp-input-field bg-gray-50"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>
            )}

            {confirmDelete && (
                <WindowsConfirmModal
                    title="Confirmar Eliminación"
                    message="¿Desea eliminar este registro de caja permanentemente?"
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onDeny={() => setConfirmDelete(null)}
                />
            )}

            <style>{`
                .erp-input-field { width: 100%; height: 24px; background: white; border: 1px solid #cbd5e1; border-radius: 2px; font-size: 11px; font-weight: 600; padding: 0 6px; color: #334155; outline: none; transition: all 0.1s; }
                .erp-input-field:focus { border-color: #106ebe; background: #f8fafc; }
                .erp-input-field:disabled { background: #f1f5f9; cursor: not-allowed; }

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
