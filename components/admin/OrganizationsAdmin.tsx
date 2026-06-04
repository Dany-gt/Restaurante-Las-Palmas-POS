import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Building, Plus, Edit3, Trash2, Loader2, X, CheckCircle, Save, MoreVertical, Power, ListFilter, MapPin, User, Search, Map as MapIcon, Baseline, CreditCard } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './DraggableWindow';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { getOrganizations, createNewOrganization } from '../../services/AdminService';

export const OrganizationsAdmin: React.FC = () => {
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, org: any, visible: boolean }>({ x: 0, y: 0, org: null, visible: false });
    const [editingOrg, setEditingOrg] = useState<any>(null);
    const [viewingBranchesOrg, setViewingBranchesOrg] = useState<any>(null);
    const [orgBranches, setOrgBranches] = useState<any[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(false);

    // Admin Credentials
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminName, setNewAdminName] = useState('');
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [newAdminPassword, setNewAdminPassword] = useState('');

    const notify = useNotify();
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const fetchOrgs = async () => {
        setLoading(true);
        const res = await getOrganizations();
        if (res.success) {
            setOrganizations(res.data || []);
        } else {
            notify.error('Error al cargar organizaciones: ' + res.error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchOrgs();

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setContextMenu(prev => ({ ...prev, visible: false }));
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, org: any) => {
        e.preventDefault();

        // Ajuste para que el menú no se salga de la pantalla (Screen Boundary Check)
        let x = e.clientX;
        let y = e.clientY;
        const menuWidth = 240; // Approx width of w-60
        const menuHeight = 200; // Approx height

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

        setContextMenu({ x, y, org, visible: true });
    };

    const handleEdit = (org: any) => {
        const target = org || contextMenu?.org;
        if (!target) return;
        setEditingOrg(target);
        setNewOrgName(target.name);
        setShowModal(true);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleManageBranches = async (org: any) => {
        const target = org || contextMenu?.org;
        if (!target) return;

        setViewingBranchesOrg(target);
        setContextMenu(prev => ({ ...prev, visible: false }));
        setLoadingBranches(true);

        const { data, error } = await supabase.from('branches').select('*').eq('org_id', target.id);
        if (!error) {
            setOrgBranches(data || []);
        } else {
            notify.error('Error al cargar sucursales');
        }
        setLoadingBranches(false);
    };

    const handleDeactivate = async (org: any) => {
        const target = org || contextMenu?.org;
        if (!target) return;

        const confirm = window.confirm(`¿Estás seguro de cambiar el estado de "${target.name}"?`);
        if (!confirm) return;

        setIsSaving(true);
        const newStatus = target.status === 'active' ? 'inactive' : 'active';
        const { error } = await supabase.from('organizations').update({ status: newStatus }).eq('id', target.id);

        if (!error) {
            notify.success(`Estado actualizado a ${newStatus}`);
            fetchOrgs();
        } else {
            notify.error('Error: ' + error.message);
        }
        setIsSaving(false);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleSave = async () => {
        if (!newOrgName) {
            notify.error('El nombre de la empresa es obligatorio');
            return;
        }

        if (!editingOrg && (!newAdminEmail || !newAdminName)) {
            notify.error('El correo y nombre del administrador son obligatorios para el alta');
            return;
        }

        setIsSaving(true);

        if (editingOrg) {
            const { error } = await supabase.from('organizations').update({ name: newOrgName.toUpperCase() }).eq('id', editingOrg.id);
            if (!error) {
                notify.success('Organización actualizada correctamente');
                setEditingOrg(null);
                setNewOrgName('');
                setShowModal(false);
                fetchOrgs();
            } else {
                notify.error('Error al actualizar: ' + error.message);
            }
        } else {
            const res = await createNewOrganization(newOrgName, newAdminEmail, newAdminName);
            if (res.success) {
                notify.success(`Organización "${res.name}" registrada.`);
                setGeneratedToken(res.token); // Almacenar el token para mostrarlo
                setNewOrgName('');
                setNewAdminEmail('');
                setNewAdminName('');
                fetchOrgs();
                // NO cerramos el modal para mostrar el token
            } else {
                notify.error('Error al crear empresa: ' + res.error);
            }
        }
        setIsSaving(false);
    };

    return (
        <div ref={containerRef} className="h-full flex flex-col bg-[#fcfdfe] p-4 gap-4 relative select-none overflow-hidden">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-[14px] font-semibold text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Building className="text-[#106ebe]" size={18} />
                        Gestión de Organizaciones
                    </h1>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1 ml-7">Administración Multi-Empresa & Grupos</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar organización..."
                            className="bg-slate-100 border-none text-[11px] font-medium px-4 py-2 pl-9 rounded-lg w-64 focus:ring-2 focus:ring-[#106ebe] transition-all"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    </div>
                </div>
            </div>

            {/* Organizations Table and Context Area */}
            <div
                className="flex-1 bg-white border border-gray-200 shadow-sm overflow-hidden flex flex-col relative"
                onContextMenu={(e) => {
                    // Only activate the "empty" menu if no specific organization was right-clicked
                    if (contextMenu.visible && contextMenu.org !== null) return; // If an org-specific menu is already open, don't open another
                    handleContextMenu(e, null); // Pass null for org to indicate empty area click
                }}
            >
                <div className="overflow-x-auto custom-scrollbar flex-1 relative">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-[#f0f0f0] border-b border-gray-300">
                            <tr>
                                <th className="py-2 px-4 text-[10px] font-medium text-slate-800 tracking-tight uppercase">#</th>
                                <th className="py-2 px-4 text-[10px] font-medium text-slate-800 tracking-tight uppercase">Nombre de la Empresa</th>
                                <th className="py-2 px-4 text-[10px] font-medium text-slate-800 tracking-tight uppercase text-center">Fecha Registro</th>
                                <th className="py-2 px-4 text-[10px] font-medium text-slate-800 tracking-tight uppercase text-center">Estado de Pago</th>
                                <th className="w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse border-b border-gray-50">
                                        <td colSpan={4} className="py-4 px-4 bg-slate-50/50" />
                                    </tr>
                                ))
                            ) : (
                                organizations.map((org, index) => (
                                    <tr
                                        key={org.id}
                                        className={`group border-b border-gray-100/50 hover:bg-blue-50/50 transition-all cursor-default select-none ${contextMenu.org?.id === org.id ? 'bg-blue-50' : ''}`}
                                        onContextMenu={(e) => handleContextMenu(e, org)}
                                        onDoubleClick={() => handleEdit(org)}
                                    >
                                        <td className="py-2 px-4 text-[11px] font-mono text-slate-400">{(index + 1).toString().padStart(2, '0')}</td>
                                        <td className="py-2 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#106ebe] group-hover:scale-110 transition-transform">
                                                    <Building size={14} />
                                                </div>
                                                <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-tight">{org.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest text-center">
                                            {new Date(org.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-2 px-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`text-[9px] font-semibold uppercase px-2 py-0.5 rounded-sm border border-transparent transition-all ${(org.subscription_status || 'active') === 'active'
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    : 'bg-red-50 text-red-600 border-red-100 animate-pulse'
                                                    }`}>
                                                    {(org.subscription_status || 'active') === 'active' ? '✓ AL DÍA' : (org.subscription_status === 'past_due' ? '⚠ ATRASADO' : '✗ SUSPENDIDO')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-2 text-right">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleContextMenu(e as any, org);
                                                }}
                                                className="p-1 px-1.5 hover:bg-[#106ebe] hover:text-white rounded transition-colors text-slate-400"
                                                title="Clic para Opciones"
                                            >
                                                <MoreVertical size={16} strokeWidth={2.5} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {organizations.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center text-slate-300 font-medium uppercase tracking-widest">No hay organizaciones registradas</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Status Bar Section Table */}
                <div className="h-7 bg-[#f0f0f0] border-t border-gray-300 flex items-center justify-between px-4 text-[9px] font-medium text-slate-500 shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> TOTAL: {organizations.length} EMPRESAS</span>
                        <div className="w-px h-3 bg-gray-300" />
                        <span className="text-slate-400">Clic derecho para acciones • Doble clic para Sucursales</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin size={10} className="text-[#106ebe]" />
                        <span className="tracking-widest uppercase">Ecosistema Las Palmas POS</span>
                    </div>
                </div>

                {/* Context Menu (Crear Portal para posicionamiento absoluto real) */}
                {contextMenu.visible && createPortal(
                    <div
                        ref={menuRef}
                        className="fixed z-[100000] w-64 bg-white border border-gray-300 shadow-[0_10px_50px_rgba(0,0,0,0.3)] select-none rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-75"
                        style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                    >
                        <div className="p-2 px-3 border-b border-gray-100 bg-[#106ebe] text-white flex items-center justify-between">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] block opacity-80">Menú de Gestión</span>
                        </div>
                        <div className="p-1 bg-white">
                            <button
                                onClick={() => {
                                    setContextMenu({ ...contextMenu, visible: false });
                                    setEditingOrg(null);
                                    setNewOrgName('');
                                    setShowModal(true);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-all group rounded-sm mb-0.5"
                            >
                                <Plus size={16} className="text-emerald-600" />
                                <span className="uppercase tracking-tight underline-offset-4 group-hover:underline">Crear Nueva Empresa</span>
                            </button>

                            {contextMenu.org && (
                                <>
                                    <div className="h-px bg-gray-100 my-1 mx-2" />
                                    <button
                                        onClick={() => {
                                            setContextMenu({ ...contextMenu, visible: false });
                                            handleEdit(contextMenu.org);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[#106ebe] hover:text-white transition-all group rounded-sm mb-0.5"
                                    >
                                        <Edit3 size={16} className="text-[#106ebe] group-hover:text-white shrink-0" />
                                        <span className="uppercase tracking-tight">Editar Propiedades / Pago</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setContextMenu({ ...contextMenu, visible: false });
                                            handleManageBranches(contextMenu.org);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-all group rounded-sm mb-0.5"
                                    >
                                        <MapPin size={16} className="text-indigo-600 shrink-0" />
                                        <span className="uppercase tracking-tight">Gestionar Sucursales</span>
                                    </button>
                                    <div className="h-px bg-gray-100 my-1 mx-2" />
                                    <button
                                        onClick={() => {
                                            setContextMenu({ ...contextMenu, visible: false });
                                            handleDeactivate(contextMenu.org);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all group rounded-sm mb-0.5"
                                    >
                                        <Power size={16} />
                                        <span className="uppercase">{contextMenu.org.status === 'active' ? 'Suspender Temporalmente' : 'Reactivar Empresa'}</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>,
                    document.body
                )}
            </div>

            {/* Modal de Creación / Edición - PORTAL A BODY */}
            {showModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow id="organizations-admin-modal" title="Propiedades de Empresa">
                        <div className="w-[480px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106ebe] flex flex-col animate-slide-up pointer-events-auto">
                            {/* Header (Mover Modal) */}
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <Building size={14} className="text-white" />
                                    <span className="text-white text-[11px] font-medium tracking-wide uppercase">{editingOrg ? 'Propiedades de Empresa' : 'Alta de Nueva Empresa'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <WindowsSaveButton onClick={handleSave} loading={isSaving} variant="minimal" title="Confirmar" />
                                    <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" title="Cerrar">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            {/* Body (Formulario Compacto Windows o Pantalla de Éxito) */}
                            <div className="p-5 bg-[#f0f0f0] flex flex-col gap-4 border-b border-gray-300 min-h-[200px] justify-center">
                                {generatedToken ? (
                                    <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
                                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                                            <CheckCircle size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-[14px] font-semibold text-slate-800 uppercase tracking-tight">¡Empresa Registrada!</h3>
                                            <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">Proporciona este token al instalador:</p>
                                        </div>

                                        <div className="w-full bg-white border-2 border-dashed border-emerald-200 p-4 rounded-xl flex flex-col items-center gap-2 select-text group relative">
                                            <span className="text-[24px] font-mono font-semibold text-[#106ebe] tracking-[0.2em]">{generatedToken}</span>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(generatedToken);
                                                    notify.success('Token copiado al portapapeles');
                                                }}
                                                className="text-[9px] font-medium text-blue-500 hover:underline uppercase flex items-center gap-1"
                                            >
                                                Copiar Código de Licencia
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setShowModal(false);
                                                setGeneratedToken(null);
                                            }}
                                            className="w-full h-10 bg-[#106ebe] text-white text-[11px] font-semibold uppercase rounded-lg hover:bg-[#106ebe] transition-all shadow-lg"
                                        >
                                            Entendido y Cerrar
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-medium text-slate-800 uppercase tracking-tight">Nombre Comercial / Organización</label>
                                            <div className="relative group">
                                                <input
                                                    autoFocus
                                                    value={newOrgName}
                                                    onChange={e => setNewOrgName(e.target.value)}
                                                    className="w-full bg-white border border-gray-400 text-[11px] font-medium px-3 py-1.5 focus:border-[#106ebe] shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] outline-none uppercase transition-all"
                                                    placeholder="EJ. RESTAURANTE LAS PALMAS MATRIZ"
                                                />
                                            </div>
                                        </div>

                                        {editingOrg && (
                                            <div className="mt-4 p-3 bg-slate-50 border border-gray-300 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CreditCard size={14} className="text-[#106ebe]" />
                                                    <label className="text-[10px] font-semibold text-[#106ebe] uppercase tracking-widest">Estado Contable / Suscripción</label>
                                                </div>
                                                <select
                                                    value={editingOrg.subscription_status || 'active'}
                                                    onChange={async (e) => {
                                                        const newStatus = e.target.value;
                                                        const { error } = await supabase
                                                            .from('organizations')
                                                            .update({ subscription_status: newStatus })
                                                            .eq('id', editingOrg.id);

                                                        if (!error) {
                                                            notify.success(`Suscripción actualizada a ${newStatus.toUpperCase()}`);
                                                            // Update local state to show change immediately in selector
                                                            setEditingOrg({ ...editingOrg, subscription_status: newStatus });
                                                            fetchOrgs();
                                                        }
                                                    }}
                                                    className={`w-full text-[11px] font-semibold uppercase px-3 py-2 border rounded-md shadow-sm focus:outline-none transition-all cursor-pointer ${(editingOrg.subscription_status || 'active') === 'active'
                                                        ? 'bg-emerald-50 border-emerald-500/30 text-emerald-700'
                                                        : 'bg-red-50 border-red-500/30 text-red-700'
                                                        }`}
                                                >
                                                    <option value="active">✓ LICENCIA ACTIVA / AL DÍA</option>
                                                    <option value="suspended">✗ SUSPENDIDO - FALTA DE PAGO</option>
                                                    <option value="past_due">⚠ PAGO ATRASADO - AVISO</option>
                                                </select>
                                                <p className="text-[8px] text-slate-400 mt-2 font-medium uppercase tracking-tighter">
                                                    Nota: Si el estado no es "ACTIVO", el sistema se bloqueará para todos los dispositivos de esta empresa.
                                                </p>
                                            </div>
                                        )}

                                        {!editingOrg && (
                                            <div className="mt-2 pt-4 border-t border-gray-300 space-y-4">
                                                <div className="flex items-center gap-2 text-[#106ebe] mb-1">
                                                    <User size={14} strokeWidth={2.5} />
                                                    <span className="text-[10px] font-semibold uppercase tracking-widest underline decoration-blue-200">Credenciales del Administrador</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[10px] font-medium text-slate-600 uppercase tracking-tight">Nombre del Contacto</label>
                                                        <input
                                                            value={newAdminName}
                                                            onChange={e => setNewAdminName(e.target.value)}
                                                            className="w-full bg-white border border-gray-400 text-[11px] font-medium px-3 py-1.5 focus:border-[#106ebe] shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] outline-none uppercase"
                                                            placeholder="JUAN PÉREZ"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[10px] font-medium text-slate-600 uppercase tracking-tight">Email Administrador</label>
                                                        <input
                                                            value={newAdminEmail}
                                                            onChange={e => setNewAdminEmail(e.target.value.toLowerCase())}
                                                            className="w-full bg-white border border-gray-400 text-[11px] font-medium px-3 py-1.5 focus:border-[#106ebe] shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] outline-none"
                                                            placeholder="admin@sucursal.com"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <WindowsSaveButton onClick={handleSave} loading={isSaving} title={editingOrg ? "Guardar Propiedades" : "Generar Organización y Token"} />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Footer / Info */}
                            <div className="bg-[#e1e1e1] px-4 py-2 flex items-center justify-between text-[9px] font-medium text-slate-400 uppercase tracking-widest">
                                <span>{isSaving ? 'Guardando en la nube...' : 'Certificado por Antigravity v4.2'}</span>
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Multi-SaaS</span>
                                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online</span>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* Modal de Sucursales - PORTAL A BODY */}
            {viewingBranchesOrg && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow id="org-branches-manager" title="Sucursales del Grupo">
                        <div className="w-[600px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106ebe] flex flex-col animate-slide-up pointer-events-auto">
                            {/* Header */}
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <ListFilter size={14} className="text-white" />
                                    <span className="text-white text-[11px] font-medium tracking-wide uppercase">Sucursales del Grupo: {viewingBranchesOrg.name}</span>
                                </div>
                                <button onClick={() => setViewingBranchesOrg(null)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" title="Cerrar">
                                    <X size={18} strokeWidth={2.5} />
                                </button>
                            </div>

                            {/* Content Grid */}
                            <div className="p-4 flex-1 overflow-auto custom-scrollbar bg-[#f0f0f0]">
                                {loadingBranches ? (
                                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#106ebe]" size={40} /></div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-2">
                                        {orgBranches.length === 0 ? (
                                            <div className="bg-white p-10 border border-gray-300 text-center text-slate-400 font-medium uppercase tracking-widest text-[9px]">
                                                No hay registros vinculados
                                            </div>
                                        ) : (
                                            orgBranches.map(branch => (
                                                <div key={branch.id} className="bg-white p-3 border border-gray-300 flex items-center justify-between hover:bg-blue-50/30 transition-all select-none group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#106ebe]">
                                                            <MapIcon size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] font-medium text-slate-800 uppercase tracking-tight">{branch.name}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-widest leading-none">{branch.location || 'UBICACIÓN NO DEFINIDA'}</p>
                                                                <div className="w-px h-2 bg-gray-200" />
                                                                <div
                                                                    onClick={() => {
                                                                        if (branch.registration_token) {
                                                                            navigator.clipboard.writeText(branch.registration_token);
                                                                            notify.success(`Token para "${branch.name}" copiado.`);
                                                                        }
                                                                    }}
                                                                    className="flex items-center gap-1 text-[9px] font-semibold text-blue-600 bg-blue-100/50 px-1.5 py-0.5 border border-blue-200 rounded-sm hover:bg-[#106ebe] hover:text-white cursor-pointer hover:shadow-md transition-all active:scale-95 group/token"
                                                                    title="Clic para copiar token"
                                                                >
                                                                    <Baseline size={8} />
                                                                    <span className="uppercase tracking-widest">TOKEN: {branch.registration_token || '---'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {branch.is_main && (
                                                            <div className="flex items-center gap-1 text-[8px] font-semibold text-[#106ebe] bg-blue-50 px-1.5 py-0.5 border border-blue-200 uppercase">
                                                                <CheckCircle size={8} /> Matriz
                                                            </div>
                                                        )}
                                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer Status */}
                            <div className="bg-[#e1e1e1] px-4 h-6 flex items-center justify-between text-[9px] font-medium text-slate-500 border-t border-gray-300">
                                <span>{orgBranches.length} SUCURSALES ENCONTRADAS</span>
                                <span className="text-blue-600">SISTEMA MULTI-TENANT ACTIVO</span>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
        </div>
    );
};
