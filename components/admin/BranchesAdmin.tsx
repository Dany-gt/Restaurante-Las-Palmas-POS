import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Plus, Edit3, Trash2, Loader2, X, Building, Phone, Mail, Receipt, FileText, Lock, Globe, Store, Building2, CheckCircle, XCircle, MoreVertical, Star, Check } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';

import { createNewBranch } from '../../services/AdminService';

interface BranchesAdminProps {
    globalSearch?: string;
}

export const BranchesAdmin: React.FC<BranchesAdminProps> = ({ globalSearch = '' }) => {
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState<any | null>(null);
    const [modalTab, setModalTab] = useState<'INFO' | 'BILLING'>('INFO');
    const notify = useNotify();
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, branch: any } | null>(null);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const defaultBranch = {
        name: '', location: '', phone: '', email: '', is_main: false,
        enable_billing: false, billing_copies: 1, print_logo_on_invoice: true,
        commercial_name: '', legal_name: '', nit: '', billing_email: '', billing_address_1: '',
        billing_address_2: '', municipality: '', department: '', branch_code: '',
        scenario_code: '1', ws_prefix: '', ws_key: '', signer_token: '', invoice_phrases: '',
        certifier_legend: '', isr_retention: false, iva_retention: false, no_iva_credit: false, exempt_iva: false,
        admin_name: '', admin_email: '', org_id: ''
    };

    const [newBranch, setNewBranch] = useState(defaultBranch);

    const fetchBranches = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('branches').select('*').order('name');
        if (!error) setBranches(data || []);
        setLoading(false);
    };

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        setCurrentUser(user);
        fetchBranches();
        if (user.is_superadmin) {
            import('../../services/AdminService').then(service => {
                service.getOrganizations().then(res => {
                    if (res.success) setOrganizations(res.data || []);
                });
            });
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const handleSave = async () => {
        if (!newBranch.name) {
            notify.error('El nombre es obligatorio');
            return;
        }

        setIsSaving(true);

        const branchData = {
            name: newBranch.name.toUpperCase(),
            location: newBranch.location,
            phone: newBranch.phone,
            email: newBranch.email,
            is_main: newBranch.is_main,
            enable_billing: newBranch.enable_billing,
            billing_copies: newBranch.billing_copies,
            print_logo_on_invoice: newBranch.print_logo_on_invoice,
            commercial_name: newBranch.commercial_name,
            legal_name: newBranch.legal_name,
            nit: newBranch.nit,
            billing_email: newBranch.billing_email,
            billing_address_1: newBranch.billing_address_1,
            billing_address_2: newBranch.billing_address_2,
            municipality: newBranch.municipality,
            department: newBranch.department,
            branch_code: newBranch.branch_code,
            scenario_code: newBranch.scenario_code,
            ws_prefix: newBranch.ws_prefix,
            ws_key: newBranch.ws_key,
            signer_token: newBranch.signer_token,
            invoice_phrases: newBranch.invoice_phrases,
            certifier_legend: newBranch.certifier_legend,
            isr_retention: newBranch.isr_retention,
            iva_retention: newBranch.iva_retention,
            no_iva_credit: newBranch.no_iva_credit,
            exempt_iva: newBranch.exempt_iva
        };

        if (editingBranch) {
            const { error: updateError } = await supabase.from('branches').update(branchData).eq('id', editingBranch.id);
            if (!updateError) {
                setShowModal(false);
                setEditingBranch(null);
                setNewBranch(defaultBranch);
                fetchBranches();
                notify.success('Sucursal actualizada correctamente');
            } else {
                notify.error('Error al actualizar: ' + updateError.message);
            }
        } else {
            // Obtener el usuario actual para heredar la organización
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

            // USAR EL SERVICIO PARA CREACIÓN (SIGUIENDO LA GUIA GEMINI)
            const result = await createNewBranch(
                newBranch.name,
                newBranch.location,
                newBranch.admin_email,
                newBranch.admin_name,
                newBranch.org_id || currentUser.org_id // Priorizar selección del SuperAdmin
            );

            if (result.success) {
                // If special additional data (billing) was provided, we need to update it as well
                await supabase.from('branches').update(branchData).eq('id', result.branchId);

                setShowModal(false);
                setNewBranch(defaultBranch);
                fetchBranches();
                notify.success(result.message || 'Nueva sucursal creada y aislada correctamente');
            } else {
                notify.error('Error al crear: ' + (result as any).error);
            }
        }

        setIsSaving(false);
    };

    const handleEdit = (branch: any) => {
        setEditingBranch(branch);
        setNewBranch({
            name: branch.name || '',
            location: branch.location || '',
            phone: branch.phone || '',
            email: branch.email || '',
            is_main: branch.is_main || false,
            enable_billing: branch.enable_billing || false,
            billing_copies: branch.billing_copies || 1,
            print_logo_on_invoice: branch.print_logo_on_invoice ?? true,
            commercial_name: branch.commercial_name || '',
            legal_name: branch.legal_name || '',
            nit: branch.nit || '',
            billing_email: branch.billing_email || '',
            billing_address_1: branch.billing_address_1 || '',
            billing_address_2: branch.billing_address_2 || '',
            municipality: branch.municipality || '',
            department: branch.department || '',
            branch_code: branch.branch_code || '',
            scenario_code: branch.scenario_code || '1',
            ws_prefix: branch.ws_prefix || '',
            ws_key: branch.ws_key || '',
            signer_token: branch.signer_token || '',
            invoice_phrases: branch.invoice_phrases || '',
            certifier_legend: branch.certifier_legend || '',
            isr_retention: branch.isr_retention || false,
            iva_retention: branch.iva_retention || false,
            no_iva_credit: branch.no_iva_credit || false,
            exempt_iva: branch.exempt_iva || false,
            admin_name: '',
            admin_email: ''
        });
        setModalTab('INFO');
        setShowModal(true);
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const { error } = await supabase.from('branches').delete().eq('id', confirmDelete);
        if (!error) {
            fetchBranches();
            notify.success('Sucursal eliminada correctamente');
        } else {
            notify.error('Error al eliminar: ' + error.message);
        }
        setConfirmDelete(null);
    };

    const filteredBranches = branches.filter(b => {
        const name = (b.name || '').toLowerCase();
        const location = (b.location || '').toLowerCase();
        const search = (globalSearch || '').toLowerCase();
        return name.includes(search) || location.includes(search);
    });

    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div ref={containerRef} className="h-full flex flex-col bg-[#fcfdfe] p-4 gap-4 relative select-none">
            <div
                className="flex-1 overflow-auto bg-white rounded-2xl border border-gray-100 shadow-sm custom-scrollbar"
                onContextMenu={(e) => {
                    if ((e.target as HTMLElement).closest('thead')) return;
                    e.preventDefault();
                    const rect = containerRef.current?.getBoundingClientRect();
                    setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), branch: null });
                }}
            >
                {loading ? (
                    <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-[#106ebe]" size={32} /></div>
                ) : isMobile ? (
                    <div className="p-2 space-y-2">
                        {filteredBranches.map(branch => (
                            <div
                                key={branch.id}
                                onClick={() => setSelectedBranchId(branch.id)}
                                className={`p-3 rounded-xl border transition-all relative ${selectedBranchId === branch.id ? 'bg-[#106ebe] text-white border-[#106ebe] shadow-indigo-100' : 'bg-white border-slate-100 shadow-sm text-slate-900'}`}
                            >
                                <div className="flex justify-between items-start pr-8">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-bold text-[13px] uppercase tracking-tight">{branch.name}</span>
                                        <div className="flex items-center gap-1.5 opacity-70">
                                            <span className="text-[10px] font-medium">{branch.location || '---'}</span>
                                        </div>
                                    </div>
                                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${branch.enable_billing ? (selectedBranchId === branch.id ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600') : 'bg-gray-100 text-gray-500'}`}>
                                        {branch.enable_billing ? 'FEL Activo' : 'FEL Inactivo'}
                                    </div>
                                </div>

                                {/* Acciones Rápidas (3 dots) */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBranchId(branch.id);
                                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                                        const containerRect = containerRef.current?.getBoundingClientRect();
                                        setContextMenu({
                                            x: rect.left - (containerRect?.left || 0) - 150,
                                            y: rect.top - (containerRect?.top || 0) + 20,
                                            branch
                                        });
                                    }}
                                    className={`absolute top-3 right-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${selectedBranchId === branch.id ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:bg-slate-50'}`}
                                >
                                    <MoreVertical size={18} />
                                </button>

                                <div className="mt-2 text-[10px] font-bold opacity-60 flex items-center gap-4">
                                    <span className="flex items-center gap-1"><Phone size={10} /> {branch.phone || 'N/A'}</span>
                                    {branch.is_main && <span className="text-amber-500 font-black">PRINCIPAL ★</span>}
                                    <span className="font-mono text-[9px] bg-slate-100 px-1 rounded ml-auto">{branch.registration_token || '---'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <table className="w-full border-collapse text-[11px]">
                        <thead className="sticky top-0 z-20 bg-[#e8e8e8] select-none">
                            <tr className="border-b border-gray-400 h-10">
                                <th className="px-6 py-2 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[20%]">Nombre Sucursal</th>
                                <th className="px-6 py-2 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[20%]">Ubicación</th>
                                <th className="px-6 py-2 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[15%]">Contacto</th>
                                <th className="px-6 py-2 text-center text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[15%]">Token Registro</th>
                                <th className="px-6 py-2 text-center text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[10%]">FEL</th>
                                <th className="px-6 py-2 text-center text-[10px] font-bold text-black uppercase w-[10%]">Principal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredBranches.map((branch) => (
                                <tr
                                    key={branch.id}
                                    onClick={() => setSelectedBranchId(branch.id)}
                                    onDoubleClick={() => handleEdit(branch)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedBranchId(branch.id);
                                        const rect = containerRef.current?.getBoundingClientRect();
                                        setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), branch });
                                    }}
                                    className={`h-6 transition-colors cursor-default relative border-b border-gray-50 ${selectedBranchId === branch.id
                                        ? 'bg-[#106ebe] text-white shadow-[inset_3px_0_0_#106ebe]'
                                        : 'text-slate-900 even:bg-slate-50/50'
                                        }`}
                                >
                                    <td className="px-4 font-bold flex items-center gap-2 h-6 border-r border-gray-100">
                                        <Building2 size={12} className={selectedBranchId === branch.id ? 'text-white' : 'text-slate-400'} />
                                        <span className="uppercase tracking-tight text-[10px]">{branch.name}</span>
                                    </td>
                                    <td className="px-4 border-r border-gray-100 text-[9px] font-bold truncate max-w-[200px]" title={branch.location}>
                                        {branch.location || '---'}
                                    </td>
                                    <td className="px-4 border-r border-gray-100 text-[9px] font-bold">
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center gap-1"><Phone size={9} className={selectedBranchId === branch.id ? 'text-blue-100' : 'text-gray-300'} /> {branch.phone || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 border-r border-gray-100 text-center">
                                        <div
                                            className={`px-2 py-0.5 rounded-sm font-mono text-[9px] font-black cursor-pointer transition-all hover:scale-105 ${selectedBranchId === branch.id ? 'bg-white/20 text-white border border-white/30' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (branch.registration_token) {
                                                    navigator.clipboard.writeText(branch.registration_token);
                                                    notify.success('Token copiado al portapapeles');
                                                }
                                            }}
                                            title="Clic para copiar token"
                                        >
                                            {branch.registration_token || '---'}
                                        </div>
                                    </td>
                                    <td className="px-4 border-r border-gray-100 text-center">
                                        <div className="flex justify-center items-center h-full">
                                            <span className={`px-1.5 py-0 rounded-sm text-[8px] font-black uppercase inline-flex items-center gap-1 ${branch.enable_billing ? (selectedBranchId === branch.id ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700') : 'bg-gray-100 text-gray-400'}`}>
                                                {branch.enable_billing ? 'Activado' : 'Inactivo'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 text-center">
                                        <div className="flex justify-center items-center h-full">
                                            <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${branch.is_main ? (selectedBranchId === branch.id ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                                                {branch.is_main && <Check size={10} strokeWidth={4} />}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2 border-l-4 border-[#106ebe]">
                    {filteredBranches.length} Sucursales Configuradas
                </span>
            </div>

            {contextMenu && (
                <div
                    className="absolute z-[1000] bg-white border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-75"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                    <button
                        onClick={() => { setEditingBranch(null); setNewBranch(defaultBranch); setShowModal(true); setContextMenu(null); }}
                        className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                    >
                        <Plus size={14} className="text-gray-600 group-hover:text-white" /> Agregar Sucursal
                    </button>
                    {contextMenu.branch && (
                        <>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button
                                onClick={() => { handleEdit(contextMenu.branch); setContextMenu(null); }}
                                className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
                            >
                                <Edit3 size={14} className="text-[#106ebe] group-hover:text-white" /> Editar Configuración
                            </button>
                            <button
                                onClick={() => { setConfirmDelete(contextMenu.branch.id); setContextMenu(null); }}
                                className="w-full text-left px-4 py-2 text-[11px] font-bold text-red-600 hover:bg-red-600 hover:text-white flex items-center gap-3 group transition-colors"
                            >
                                <Trash2 size={14} className="text-red-500 group-hover:text-white" /> Eliminar Sucursal
                            </button>
                        </>
                    )}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
                    <div className="absolute inset-0" onClick={() => setShowModal(false)} />
                    <DraggableWindow id="branches-admin-modal" title="Configuración de Sucursal">
                        <div className="w-full max-w-4xl bg-white rounded-sm shadow-2xl overflow-hidden border border-gray-300 flex flex-col max-h-[90vh] relative z-20 pointer-events-auto">
                            {/* Cabecera del Modal */}
                            <div className="bg-[#106ebe] h-10 flex items-center justify-between px-4 shrink-0 modal-header cursor-default select-none">
                                <div className="flex items-center gap-2">
                                    <Building2 size={14} className="text-white text-opacity-80" />
                                    <span className="text-white text-[11px] font-black uppercase tracking-wider">{editingBranch ? 'Configuración de Sucursal' : 'Registro de Nueva Sucursal'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <WindowsSaveButton onClick={handleSave} loading={isSaving} title="Guardar Sucursal" />
                                    <button onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-all">
                                        <X size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>

                            {/* Tabs del Modal */}
                            <div className="flex bg-slate-50 border-b border-gray-200 px-4 shrink-0">
                                <button onClick={() => setModalTab('INFO')} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${modalTab === 'INFO' ? 'text-[#106ebe] border-b-2 border-[#106ebe] bg-white' : 'text-gray-400 hover:text-gray-600'}`}>Información General</button>
                                <button onClick={() => setModalTab('BILLING')} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${modalTab === 'BILLING' ? 'text-[#106ebe] border-b-2 border-[#106ebe] bg-white' : 'text-gray-400 hover:text-gray-600'}`}>Facturación FEL</button>
                            </div>

                            <div className="p-4 overflow-y-auto bg-white custom-scrollbar">
                                {modalTab === 'INFO' ? (
                                    <div className="space-y-6">
                                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
                                            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                                <label className="text-[10px] font-black text-gray-400 uppercase">Nombre Sucursal</label>
                                                <input value={newBranch.name} onChange={e => setNewBranch({ ...newBranch, name: e.target.value.toUpperCase() })} type="text" className="premium-input-field" placeholder="EJ. CENTRO HISTÓRICO" />
                                            </div>
                                            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                                <label className="text-[10px] font-black text-gray-400 uppercase">Dirección Física</label>
                                                <input value={newBranch.location} onChange={e => setNewBranch({ ...newBranch, location: e.target.value })} type="text" className="premium-input-field" placeholder="Avenida Central No. 123..." />
                                            </div>
                                            {currentUser?.is_superadmin && (
                                                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Organización/Empresa</label>
                                                    <select
                                                        value={newBranch.org_id}
                                                        onChange={e => setNewBranch({ ...newBranch, org_id: e.target.value })}
                                                        className="premium-input-field border-indigo-200 bg-indigo-50/10"
                                                    >
                                                        <option value="">{newBranch.org_id ? 'EMPRESA SELECCIONADA' : 'SELECCIONE EMPRESA (OBLIGATORIO)...'}</option>
                                                        {organizations.map(org => (
                                                            <option key={org.id} value={org.id}>{org.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-8 pt-2">
                                                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase">Teléfono</label>
                                                    <input value={newBranch.phone} onChange={e => setNewBranch({ ...newBranch, phone: e.target.value })} type="text" className="premium-input-field" />
                                                </div>
                                                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase">Email</label>
                                                    <input value={newBranch.email} onChange={e => setNewBranch({ ...newBranch, email: e.target.value })} type="email" className="premium-input-field" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 flex items-center justify-between">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[11px] font-black text-[#106ebe] uppercase tracking-widest">Sucursal Principal</span>
                                                <p className="text-[10px] text-gray-500 font-medium">Marcar como la entidad central de la red de sucursales.</p>
                                            </div>
                                            <div onClick={() => setNewBranch({ ...newBranch, is_main: !newBranch.is_main })} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all ${newBranch.is_main ? 'bg-[#106ebe]' : 'bg-gray-200'}`}>
                                                <div className={`w-4 h-4 bg-white rounded-full transition-all transform ${newBranch.is_main ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </div>
                                        </div>

                                        {/* Sección Registro Maestro (Solo para nuevas) */}
                                        {!editingBranch && (
                                            <div className="bg-amber-50 p-5 rounded-xl border border-amber-100 space-y-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Lock size={14} className="text-amber-600" />
                                                    <span className="text-[11px] font-black text-amber-800 uppercase tracking-widest">Administrador Inicial (Opcional)</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-8">
                                                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                                        <label className="text-[10px] font-black text-amber-700 uppercase">Nombre Admin</label>
                                                        <input value={newBranch.admin_name} onChange={e => setNewBranch({ ...newBranch, admin_name: e.target.value.toUpperCase() })} type="text" className="premium-input-field border-amber-200 focus:border-amber-500" placeholder="NOMBRE COMPLETO" />
                                                    </div>
                                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                                        <label className="text-[10px] font-black text-amber-700 uppercase">Email Admin</label>
                                                        <input value={newBranch.admin_email} onChange={e => setNewBranch({ ...newBranch, admin_email: e.target.value })} type="email" className="premium-input-field border-amber-200 focus:border-amber-500" placeholder="admin@sucursal.com" />
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-amber-600 font-bold italic">Nota: Al crear la sucursal, este usuario tendrá acceso total a esta base de datos vacía.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center"><Receipt size={20} /></div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">Emisión FEL Habilitada</span>
                                                    <p className="text-[10px] text-emerald-600 text-opacity-70 font-medium">Activa la integración con el certificador para esta sucursal.</p>
                                                </div>
                                            </div>
                                            <div onClick={() => setNewBranch({ ...newBranch, enable_billing: !newBranch.enable_billing })} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all ${newBranch.enable_billing ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                                                <div className={`w-4 h-4 bg-white rounded-full transition-all transform ${newBranch.enable_billing ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </div>
                                        </div>

                                        {newBranch.enable_billing && (
                                            <div className="space-y-4">
                                                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-4">
                                                    <div className="grid grid-cols-2 gap-8">
                                                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase">Nombre Comercial</label>
                                                            <input value={newBranch.commercial_name} onChange={e => setNewBranch({ ...newBranch, commercial_name: e.target.value })} type="text" className="premium-input-field" />
                                                        </div>
                                                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase">Razón Social</label>
                                                            <input value={newBranch.legal_name} onChange={e => setNewBranch({ ...newBranch, legal_name: e.target.value })} type="text" className="premium-input-field" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-8">
                                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase">NIT Emisor</label>
                                                            <input value={newBranch.nit} onChange={e => setNewBranch({ ...newBranch, nit: e.target.value })} type="text" className="premium-input-field" />
                                                        </div>
                                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase">Cód. Estab.</label>
                                                            <input value={newBranch.branch_code} onChange={e => setNewBranch({ ...newBranch, branch_code: e.target.value })} type="text" className="premium-input-field" />
                                                        </div>
                                                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase">Email FEL</label>
                                                            <input value={newBranch.billing_email} onChange={e => setNewBranch({ ...newBranch, billing_email: e.target.value })} type="text" className="premium-input-field" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 space-y-4">
                                                    <span className="text-[10px] font-black text-[#106ebe] uppercase tracking-[0.2em] mb-2 block border-b border-blue-100 pb-1">Credenciales WebService (INFILE)</span>
                                                    <div className="grid grid-cols-2 gap-8">
                                                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase">Alias Firma</label>
                                                            <input value={newBranch.ws_prefix} onChange={e => setNewBranch({ ...newBranch, ws_prefix: e.target.value })} type="text" className="premium-input-field" />
                                                        </div>
                                                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase">Llave WS</label>
                                                            <input value={newBranch.ws_key} onChange={e => setNewBranch({ ...newBranch, ws_key: e.target.value })} type="password" autoComplete="off" className="premium-input-field" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase">Token Signer</label>
                                                        <input value={newBranch.signer_token} onChange={e => setNewBranch({ ...newBranch, signer_token: e.target.value })} type="password" autoComplete="off" className="premium-input-field" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </DraggableWindow>
                </div>
            )}

            {confirmDelete && (
                <WindowsConfirmModal
                    title="Confirmar Eliminación"
                    message="¿Desea eliminar esta sucursal permanentemente?"
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onDeny={() => setConfirmDelete(null)}
                />
            )}

            <style>{`
                .premium-input-field { width: 100%; height: 28px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; font-weight: 700; padding: 0 10px; color: #106ebe; outline: none; transition: all 0.2s; }
                .premium-input-field:focus { border-color: #106ebe; box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.05); }
                .premium-input-field::placeholder { color: #cbd5e1; font-weight: 400; font-style: italic; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                @keyframes fade-in { from { opacity: 0;  } to { opacity: 1;  } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};
