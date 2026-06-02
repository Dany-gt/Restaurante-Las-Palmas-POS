import React, { useState, useEffect } from 'react';
import { Truck, Plus, Phone, Mail, Globe, Trash2, Edit2, Search, Loader2, X, Save, Info, UserCircle, Settings, Check, RefreshCw, Edit3 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';
import { useModulePermissions } from '../../hooks/useModulePermissions';

export const SuppliersAdmin: React.FC = () => {
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const notify = useNotify();
    const { can } = useModulePermissions('Proveedores');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        contact_name: '',
        nit: '',
        phone: '',
        email: '',
        contact_phone: '',
        contact_email: '',
        branches: [] as string[]
    });
    const [branches, setBranches] = useState<any[]>([]);

    // UI State
    const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, supplier: any } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleContextMenu = (e: React.MouseEvent, supplier: any = null) => {
        e.preventDefault();
        e.stopPropagation();

        const menuWidth = 200;
        const menuHeight = 180;

        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

        x = Math.max(5, x);
        y = Math.max(5, y);

        setContextMenu({ x, y, supplier });
    };

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const { data: sups, error: sErr } = await supabase.from('suppliers').select('*').order('name');
            if (sErr) throw sErr;
            
            let supsWithBranches = sups || [];

            try {
                const { data: assignments } = await supabase.from('supplier_branches').select('*');
                if (assignments && supsWithBranches) {
                    supsWithBranches = supsWithBranches.map(s => ({
                        ...s,
                        branch_ids: assignments.filter(a => a.supplier_id === s.id).map(a => a.branch_id)
                    }));
                }
            } catch (aErr) { console.warn(aErr); }

            setSuppliers(supsWithBranches);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchBranches = async () => {
        const { data } = await supabase.from('branches').select('id, name').order('name');
        setBranches(data || []);
    };

    useEffect(() => {
        fetchSuppliers();
        fetchBranches();
    }, []);

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const { error } = await supabase.from('suppliers').delete().eq('id', confirmDelete);
        if (!error) {
            fetchSuppliers();
            notify.success('Proveedor eliminado correctamente');
        } else {
            notify.error('Error al eliminar: ' + error.message);
        }
        setConfirmDelete(null);
    };

    const handleEdit = (sup: any) => {
        setEditingId(sup.id);
        setFormData({
            name: sup.name || '',
            contact_name: sup.contact_name || '',
            nit: sup.nit || '',
            phone: sup.phone || '',
            email: sup.email || '',
            contact_phone: sup.contact_phone || '',
            contact_email: sup.contact_email || '',
            branches: sup.branch_ids || []
        });
        setShowModal(true);
    };

    const handleToggleBranch = (branchId: string) => {
        setFormData(prev => {
            const isAssigned = prev.branches.includes(branchId);
            return {
                ...prev,
                branches: isAssigned 
                    ? prev.branches.filter(id => id !== branchId)
                    : [...prev.branches, branchId]
            };
        });
    };

    const handleSave = async () => {
        if (!formData.name) {
            notify.error('El nombre es obligatorio');
            return;
        }

        setSaving(true);

        try {
            const dataToSave: any = {
                name: (formData.name || '').toUpperCase(),
                contact_name: (formData.contact_name || '').toUpperCase(),
                phone: formData.phone || '',
                email: (formData.email || '').toLowerCase(),
                nit: (formData.nit || '').toUpperCase(),
                contact_phone: formData.contact_phone || '',
                contact_email: (formData.contact_email || '').toLowerCase()
            };

            let supplierId = editingId;
            let error;

            if (editingId) {
                const { error: err } = await supabase.from('suppliers').update(dataToSave).eq('id', editingId);
                error = err;
            } else {
                const { data, error: err } = await supabase.from('suppliers').insert([dataToSave]).select();
                error = err;
                if (data?.[0]) supplierId = data[0].id;
            }

            if (error) throw error;

            if (supplierId) {
                await supabase.from('supplier_branches').delete().eq('supplier_id', supplierId);
                if (formData.branches && formData.branches.length > 0) {
                    const assignments = formData.branches.map(bId => ({ supplier_id: supplierId, branch_id: bId }));
                    await supabase.from('supplier_branches').insert(assignments);
                }
            }

            setShowModal(false);
            resetForm();
            await fetchSuppliers();
            notify.success('Guardado correctamente');
        } catch (err: any) {
            notify.error('Error al guardar: ' + (err.message || 'Error de conexión'));
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({ name: '', contact_name: '', nit: '', phone: '', email: '', contact_phone: '', contact_email: '', branches: [] });
    };

    try {
        return (
            <div className="h-full flex flex-col relative bg-[#f0f0f0] font-['Montserrat'] overflow-hidden" ref={containerRef} onClick={() => setContextMenu(null)}>

                {/* Toolbar Superior Principal */}
                <div className="bg-[#e6e6e6] px-3 border-b border-gray-300 flex items-center justify-between shrink-0 h-[40px] z-20">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-900 font-medium text-[12px]">Sucursal</span>
                        <select
                            value={selectedBranchFilter}
                            onChange={(e) => setSelectedBranchFilter(e.target.value)}
                            className="w-full min-w-[280px] bg-white border border-gray-400 rounded-sm px-2 outline-none text-[11px] text-slate-900 font-medium focus:border-[#106ebe] h-[24px]"
                        >
                            <option value="ALL">TODAS LAS SUCURSALES</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Introduzca el texto a buscar..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-white border border-gray-400 rounded-sm px-2 text-[11px] w-64 outline-none text-slate-900 font-medium focus:border-[#106ebe] h-[24px]"
                            />
                        </div>
                        <button className="bg-[#f0f0f0] border border-gray-400 px-4 h-[24px] text-[10px] font-bold uppercase hover:bg-[#e1e1e1] active:bg-[#d1d1d1] text-slate-800 rounded-sm shadow-sm transition-all flex items-center justify-center">
                            Buscar
                        </button>
                        <button 
                            onClick={fetchSuppliers}
                            className="h-[24px] w-[24px] flex items-center justify-center bg-white border border-gray-400 hover:bg-gray-100 text-slate-600 transition-all rounded-sm shadow-sm"
                            title="Refrescar Listado"
                        >
                            <RefreshCw size={12} />
                        </button>
                    </div>
                </div>

                {/* Contenido Principal - Tabla de Proveedores */}
                <div
                    className="flex-1 overflow-auto bg-white custom-scrollbar"
                    onContextMenu={(e) => {
                        if ((e.target as HTMLElement).closest('thead')) return;
                        handleContextMenu(e, null);
                    }}
                >
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center p-20">
                            <Loader2 className="animate-spin text-[#106ebe]" size={48} />
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-[11px]">
                            <thead className="bg-[#e8e8e8] sticky top-0 z-10 select-none">
                                <tr className="border-b border-gray-400 h-8">
                                    <th className="px-4 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[50%]">Proveedor</th>
                                    <th className="px-4 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[15%]">Teléfono</th>
                                    <th className="px-4 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[25%]">Correo</th>
                                    <th className="px-4 text-center text-[10px] font-bold text-black uppercase w-[10%]">Habilitado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {suppliers
                                    .filter(sup => {
                                        const matchesBranch = selectedBranchFilter === 'ALL' || (Array.isArray(sup.branch_ids) && sup.branch_ids.includes(selectedBranchFilter));
                                        const query = searchQuery.toLowerCase().trim();
                                        if (!query) return matchesBranch;

                                        const name = (sup.name || '').toLowerCase();
                                        const nit = (sup.nit || '').toLowerCase();
                                        return matchesBranch && (name.includes(query) || nit.includes(query));
                                    })
                                    .map((sup, index) => (
                                        <tr
                                            key={sup.id}
                                            onClick={() => setSelectedSupplierId(sup.id)}
                                            onDoubleClick={() => handleEdit(sup)}
                                            onContextMenu={(e) => {
                                                setSelectedSupplierId(sup.id);
                                                handleContextMenu(e, sup);
                                            }}
                                            className={`h-6 transition-colors cursor-pointer relative border-b border-gray-50 group ${selectedSupplierId === sup.id ? 'bg-[#106ebe] text-white' : (index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]') + ' text-slate-900 hover:bg-[#cce8ff]'}`}
                                        >
                                            <td className="px-4 font-bold uppercase text-[10px] border-r border-gray-100">{sup.name}</td>
                                            <td className="px-4 border-r border-gray-100 uppercase text-[10px]">{sup.phone || '--'}</td>
                                            <td className="px-4 border-r border-gray-100 text-[10px]">{sup.email || '--'}</td>
                                            <td className="px-4 text-center">
                                                <div className="flex justify-center">
                                                    <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${selectedSupplierId === sup.id ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white'}`}>
                                                        <Check size={10} strokeWidth={4} />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* MODAL: Mantenimiento de Proveedores (Windows Standard) */}
                {showModal && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/10 pointer-events-auto">
                        <DraggableWindow id="supplier-modal" title="Mantenimiento de Proveedores">
                            <div className="w-[800px] bg-[#f0f0f0] border border-[#106EBE] shadow-2xl flex flex-col pointer-events-auto">
                                {/* Header del Modal */}
                                <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center shrink-0 select-none cursor-move">
                                    <div className="flex items-center gap-2">
                                        <Truck size={14} className="text-white" />
                                        <span className="text-white text-[12px] font-bold">Mantenimiento de Proveedores</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <WindowsSaveButton onClick={handleSave} loading={saving} variant="minimal" title="Guardar Proveedor" />
                                        <button 
                                            onClick={() => setShowModal(false)} 
                                            className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1"
                                            title="Cerrar"
                                        >
                                            <X size={18} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4">
                                    {/* Datos de Proveedor */}
                                    <fieldset className="border border-gray-400 p-4 pt-5 relative bg-white/50">
                                        <legend className="absolute -top-3 left-3 bg-[#f0f0f0] px-2 text-[11px] font-bold text-[#106EBE] uppercase">Datos de Proveedor</legend>
                                        
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-4">
                                                <label className="w-24 text-[11px] font-bold text-slate-600 uppercase">Proveedor</label>
                                                <input 
                                                    autoFocus
                                                    value={formData.name} 
                                                    onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })} 
                                                    className="flex-1 h-7 border border-gray-400 px-2 text-[11px] outline-none focus:border-[#106EBE] bg-[#fffceb] font-bold text-slate-900" 
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                                <div className="flex items-center gap-4">
                                                    <label className="w-24 text-[11px] font-bold text-slate-600 uppercase">Teléfono</label>
                                                    <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="flex-1 h-7 border border-gray-400 px-2 text-[11px] outline-none focus:border-[#106EBE] text-slate-900" />
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <label className="w-16 text-[11px] font-bold text-slate-600 uppercase text-right">Correo</label>
                                                    <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value.toLowerCase() })} className="flex-1 h-7 border border-gray-400 px-2 text-[11px] outline-none focus:border-[#106EBE] text-slate-900" />
                                                </div>
                                                
                                                <div className="flex items-center gap-4">
                                                    <label className="w-24 text-[11px] font-bold text-slate-600 uppercase">Contacto</label>
                                                    <input value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value.toUpperCase() })} className="flex-1 h-7 border border-gray-400 px-2 text-[11px] outline-none focus:border-[#106EBE] text-slate-900" />
                                                </div>
                                                <div className="h-7" />

                                                <div className="flex items-center gap-4">
                                                    <label className="w-24 text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Tel. Contacto</label>
                                                    <input value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })} className="flex-1 h-7 border border-gray-400 px-2 text-[11px] outline-none focus:border-[#106EBE] text-slate-900" />
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <label className="w-16 text-[11px] font-bold text-slate-600 uppercase text-right">Correo</label>
                                                    <input value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value.toLowerCase() })} className="flex-1 h-7 border border-gray-400 px-2 text-[11px] outline-none focus:border-[#106EBE] text-slate-900" />
                                                </div>
                                            </div>
                                        </div>
                                    </fieldset>

                                    {/* Sucursales */}
                                    <fieldset className="border border-gray-400 p-0 pt-5 relative bg-white/50">
                                        <legend className="absolute -top-3 left-3 bg-[#f0f0f0] px-2 text-[11px] font-bold text-[#106EBE] uppercase">Sucursales</legend>
                                        
                                        <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-[#e8e8e8] sticky top-0 border-b border-gray-400 z-10">
                                                    <tr>
                                                        <th className="px-4 py-1.5 text-[10px] font-bold text-slate-700 uppercase border-r border-gray-300">Sucursal</th>
                                                        <th className="w-24 px-2 py-1.5 text-center text-[10px] font-bold text-slate-700 uppercase border-r border-gray-300">Habilitado</th>
                                                        <th className="w-40 px-2 py-1.5 text-center text-[10px] font-bold text-slate-700 uppercase">Asignado a Sucursal</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {branches.map(branch => {
                                                        const isAssigned = formData.branches.includes(branch.id);
                                                        return (
                                                            <tr key={branch.id} className="border-b border-gray-200 hover:bg-[#e8f2ff] transition-colors cursor-pointer" onClick={() => handleToggleBranch(branch.id)}>
                                                                <td className="px-4 py-1 text-[11px] text-slate-700 border-r border-gray-200 uppercase font-medium">{branch.name}</td>
                                                                <td className="px-2 py-1 border-r border-gray-200">
                                                                    <div className="flex justify-center">
                                                                        <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${isAssigned ? 'bg-[#106EBE] border-[#106EBE] text-white shadow-sm' : 'bg-white border-gray-300'}`}>
                                                                            {isAssigned && <Check size={10} strokeWidth={4} />}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-2 py-1">
                                                                    <div className="flex justify-center">
                                                                        <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${isAssigned ? 'bg-[#106EBE] border-[#106EBE] text-white shadow-sm' : 'bg-white border-gray-300'}`}>
                                                                            {isAssigned && <Check size={10} strokeWidth={4} />}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </fieldset>
                                </div>

                                {/* Status Bar del Modal */}
                                <div className="h-6 px-3 bg-[#e8e8e8] border-t border-gray-300 flex items-center justify-between shrink-0">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                        <Info size={10} /> {editingId ? 'Editando registro' : 'Nuevo Proveedor'}
                                    </span>
                                    <span className="text-[9px] font-bold text-[#106EBE] uppercase tracking-[0.2em]">SISTEMA POS v2.0</span>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>,
                    document.body
                )}

                {/* Confirmación de Borrado */}
                {confirmDelete && (
                    <WindowsConfirmModal
                        title="Confirmar Eliminación"
                        message="¿Desea eliminar este proveedor de forma permanente?"
                        onConfirm={handleDelete}
                        onCancel={() => setConfirmDelete(null)}
                    />
                )}

                {/* Menú Contextual */}
                {contextMenu && createPortal(
                    <div
                        className="fixed z-[100000] bg-white border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-1 min-w-[200px] select-none"
                        style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                    >
                        {can('Nuevo') && (
                        <button onClick={() => { resetForm(); setShowModal(true); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors">
                            <Plus size={14} className="text-emerald-600" /> Nuevo Proveedor
                        </button>
                        )}
                        <div className="h-px bg-gray-100 my-1"></div>
                        {contextMenu.supplier && (
                            <>
                                {can('Editar') && (
                                <button onClick={() => { handleEdit(contextMenu.supplier); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors">
                                    <Edit3 size={14} className="text-[#106ebe]" /> Editar
                                </button>
                                )}
                                {can('Eliminar') && (
                                <button onClick={() => { setConfirmDelete(contextMenu.supplier.id); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors">
                                    <Trash2 size={14} className="text-red-500" /> Eliminar
                                </button>
                                )}
                                <div className="h-px bg-gray-100 my-1"></div>
                            </>
                        )}
                        <button onClick={() => { fetchSuppliers(); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors">
                            <RefreshCw size={14} className="text-gray-400" /> Refrescar Lista
                        </button>
                    </div>,
                    document.body
                )}

                <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #999; }
                `}</style>
            </div>
        );
    } catch (renderError: any) {
        return (
            <div className="p-10 bg-red-50 text-red-700 font-bold border-2 border-red-500 rounded-lg">
                <h1 className="text-xl mb-4 text-red-900 font-black">FALLO DE RENDERIZADO</h1>
                <code className="block bg-white p-4 text-sm whitespace-pre-wrap">{renderError.message}</code>
                <button onClick={() => window.location.reload()} className="mt-4 bg-red-600 text-white px-4 py-2 font-bold uppercase rounded">Reiniciar</button>
            </div>
        );
    }
};
