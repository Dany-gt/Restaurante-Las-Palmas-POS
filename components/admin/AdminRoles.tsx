import React, { useState, useEffect, useRef } from 'react';
import { Shield, Plus, Lock, Edit3, Trash2, CheckCircle, XCircle, Loader2, X, ChevronDown, ChevronRight, Save, ShieldCheck, Check, MoreVertical } from 'lucide-react';
import { supabase } from '../../supabase';
import { PERMISSIONS_STRUCTURE } from '../../permissions';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';
import { useModulePermissions } from '../../hooks/useModulePermissions';

export const AdminRoles: React.FC = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    const [showPermissionsModal, setShowPermissionsModal] = useState(false);
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingRole, setEditingRole] = useState<any | null>(null);
    const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: [] as string[] });
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [expandedModules, setExpandedModules] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, role: any } | null>(null);
    const notify = useNotify();
    const { can } = useModulePermissions('Roles de Usuario');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('roles').select('*').order('name');
        if (!error) setRoles(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        const handleClick = () => { setContextMenu(null); };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Removed local toast timer logic

    const handleContextMenu = (e: React.MouseEvent, role?: any) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = containerRef.current?.getBoundingClientRect();
        const x = e.clientX - (rect?.left || 0);
        const y = e.clientY - (rect?.top || 0);

        setContextMenu({ x, y, role: role || null });
    };

    const handleTogglePermission = (perm: string) => {
        setRoleForm(prev => ({
            ...prev,
            permissions: prev.permissions.includes(perm)
                ? prev.permissions.filter(p => p !== perm)
                : [...prev.permissions, perm]
        }));
    };

    const handleToggleModule = (module: string) => {
        const moduleData = PERMISSIONS_STRUCTURE.find(m => m.module === module);
        const modulePerms = moduleData?.actions.map(a => `${module}:${a}`) || [];
        const allSelected = modulePerms.every(p => roleForm.permissions.includes(p));

        setRoleForm(prev => ({
            ...prev,
            permissions: allSelected
                ? prev.permissions.filter(p => !modulePerms.includes(p))
                : [...new Set([...prev.permissions, ...modulePerms])]
        }));
    };

    const handleSave = async () => {
        if (!roleForm.name) return;
        setIsSaving(true);
        const { error } = editingRole
            ? await supabase.from('roles').update({ name: roleForm.name, description: roleForm.description }).eq('id', editingRole.id)
            : await supabase.from('roles').insert([{ name: roleForm.name, description: roleForm.description, permissions: [] }]);

        if (!error) {
            setShowRoleModal(false);
            setEditingRole(null);
            setRoleForm({ name: '', description: '', permissions: [] });
            fetchData();
            notify.success('Rol guardado correctamente');
        } else {
            notify.error('Error al guardar: ' + error.message);
        }
        setIsSaving(false);
    };

    const handleSavePermissions = async () => {
        if (!editingRole) return;
        setIsSaving(true);
        const { error } = await supabase.from('roles').update({ permissions: roleForm.permissions }).eq('id', editingRole.id);
        if (!error) {
            fetchData();
            notify.success('Permisos actualizados con éxito');
            if (isMobile) setShowPermissionsModal(false);
        } else {
            notify.error('Error al actualizar permisos: ' + error.message);
        }
        setIsSaving(false);
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const { error } = await supabase.from('roles').delete().eq('id', confirmDelete);
        if (!error) {
            fetchData();
            if (editingRole?.id === confirmDelete) {
                setEditingRole(null);
                setRoleForm({ name: '', description: '', permissions: [] });
            }
            notify.success('Rol eliminado permanentemente');
        } else {
            notify.error('Error al eliminar: ' + error.message);
        }
        setConfirmDelete(null);
    };

    const openEdit = (role: any) => {
        setEditingRole(role);
        setRoleForm({ name: role.name, description: role.description || '', permissions: role.permissions || [] });
        if (isMobile) setShowPermissionsModal(true);
    };

    const startNewRole = () => {
        setEditingRole(null);
        setRoleForm({ name: '', description: '', permissions: [] });
        setShowRoleModal(true);
    };

    const renderPermissionsTree = () => (
        <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2">
            {/* Search Bar */}
            <div className={`bg-white border border-gray-300 ${isMobile ? 'p-3' : 'p-1.5'} flex gap-2`}>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar permisos..."
                    className="flex-1 px-2 py-1 text-[11px] outline-none border border-gray-200"
                />
                {!isMobile && <button className="bg-[#f5f5f5] border border-gray-300 px-4 py-1 text-[11px] font-medium hover:bg-gray-200 text-gray-700">Buscar</button>}
            </div>

            {/* Permissions Tree Area */}
            <div className="flex-1 bg-white border border-gray-300 overflow-y-auto p-2">
                <div className="space-y-1">
                    <span className="text-[11px] font-medium text-gray-700 block border-b border-gray-100 pb-1 mb-2">Módulos y Acciones</span>
                    {PERMISSIONS_STRUCTURE
                        .filter(m =>
                            m.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.actions.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()))
                        )
                        .map((module) => {
                            const modulePerms = module.actions.map(a => `${module.module}:${a}`);
                            const allSelected = modulePerms.every(p => roleForm.permissions.includes(p));
                            const isExpanded = expandedModules.includes(module.module) || searchTerm !== '';

                            return (
                                <div key={module.module} className="text-[11px] border-b border-gray-50 last:border-0">
                                    <div
                                        className="flex items-center gap-2 hover:bg-blue-50/50 cursor-pointer py-2 px-1"
                                        onClick={() => setExpandedModules(prev => isExpanded ? prev.filter(m => m !== module.module) : [...prev, module.module])}
                                    >
                                        {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={(e) => { e.stopPropagation(); handleToggleModule(module.module); }}
                                            className="w-4 h-4 accent-[#106ebe]"
                                        />
                                        <span className={`font-semibold uppercase tracking-tight ${isExpanded ? 'text-[#106ebe]' : 'text-gray-500'}`}>{module.module}</span>
                                        <span className="text-[9px] font-medium text-gray-400 ml-auto">({module.actions.length})</span>
                                    </div>

                                    {isExpanded && (
                                        <div className="ml-6 space-y-1 mb-2 border-l-2 border-slate-100 pl-3">
                                            {module.actions
                                                .filter(action => searchTerm === '' || action.toLowerCase().includes(searchTerm.toLowerCase()))
                                                .map((action) => {
                                                    const permId = `${module.module}:${action}`;
                                                    const isSelected = roleForm.permissions.includes(permId);
                                                    return (
                                                        <div
                                                            key={action}
                                                            className={`flex items-center gap-3 py-2 px-2 hover:bg-gray-50 cursor-pointer rounded transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}
                                                            onClick={() => handleTogglePermission(permId)}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => { }} // Controlled by parent onClick
                                                                className="w-4 h-4 accent-[#106ebe]"
                                                            />
                                                            <span className={`text-[11px] font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{action}</span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* Action Buttons Footer */}
            <div className="grid grid-cols-2 gap-2 shrink-0">
                <button
                    onClick={() => {
                        const allPerms = PERMISSIONS_STRUCTURE.flatMap(m => m.actions.map(a => `${m.module}:${a}`));
                        setRoleForm(prev => ({ ...prev, permissions: allPerms }));
                    }}
                    className="bg-[#f5f5f5] border border-gray-300 py-2 text-[10px] font-semibold text-gray-700 hover:bg-gray-200 uppercase tracking-tighter"
                >
                    Marcar Todo
                </button>
                <button
                    onClick={() => setRoleForm(prev => ({ ...prev, permissions: [] }))}
                    className="bg-[#f5f5f5] border border-gray-300 py-2 text-[10px] font-semibold text-gray-700 hover:bg-gray-200 uppercase tracking-tighter"
                >
                    Desmarcar Todo
                </button>
            </div>

            <div className="flex justify-center pt-2">
                <WindowsSaveButton
                    onClick={handleSavePermissions}
                    disabled={!editingRole}
                    loading={isSaving}
                    title="Aplicar Cambios"
                />
            </div>
        </div>
    );

    return (
        <div ref={containerRef} className="h-full flex flex-col bg-[#fcfdfe] overflow-hidden select-none relative">
            {/* Main Split View */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Roles List Table */}
                <div
                    className="flex-1 border-r border-gray-200 flex flex-col bg-white"
                    onContextMenu={(e) => handleContextMenu(e)}
                >
                    <div className="bg-gray-50/80 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Roles del Sistema</span>
                        {isMobile && (
                            <button
                                onClick={startNewRole}
                                className="bg-[#106ebe] text-white p-1 rounded-sm shadow-sm active:scale-95"
                            >
                                <Plus size={16} />
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto bg-[#fafafa]">
                        {isMobile ? (
                            <div className="p-2 space-y-2">
                                {roles.map(role => (
                                    <div
                                        key={role.id}
                                        onClick={() => openEdit(role)}
                                        className={`p-3 rounded-xl border transition-all relative ${editingRole?.id === role.id ? 'bg-[#106ebe] text-white border-[#106ebe] shadow-indigo-100' : 'bg-white border-slate-100 shadow-sm text-slate-900'}`}
                                    >
                                        <div className="flex justify-between items-start pr-8">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-[13px] uppercase tracking-tight">{role.name}</span>
                                                <span className="text-[10px] opacity-60 font-medium">{role.description || 'Sin descripción'}</span>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${editingRole?.id === role.id ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'}`}>
                                                Habilitado
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const rect = (e.target as HTMLElement).getBoundingClientRect();
                                                const containerRect = containerRef.current?.getBoundingClientRect();
                                                setContextMenu({
                                                    x: rect.left - (containerRect?.left || 0) - 150,
                                                    y: rect.top - (containerRect?.top || 0) + 20,
                                                    role
                                                });
                                            }}
                                            className={`absolute top-3 right-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${editingRole?.id === role.id ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:bg-slate-50'}`}
                                        >
                                            <MoreVertical size={18} />
                                        </button>

                                        <div className="mt-2 text-[10px] font-semibold opacity-60 flex items-center gap-2">
                                            <ShieldCheck size={10} className={editingRole?.id === role.id ? 'text-white' : 'text-indigo-500'} />
                                            <span>{(role.permissions || []).length} PERMISOS ASIGNADOS</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <table className="w-full border-collapse text-[11px]">
                                <thead className="bg-[#e8e8e8] sticky top-0 z-10 border-b border-gray-400 select-none">
                                    <tr className="h-10">
                                        <th className="py-2.5 px-6 text-left font-medium text-black uppercase w-[75%] border-r border-gray-300 text-[10px]">ROL</th>
                                        <th className="py-2.5 px-6 text-center font-medium text-black uppercase w-[25%] text-[10px]">HABILITADO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {roles.map(role => (
                                        <tr
                                            key={role.id}
                                            onClick={() => openEdit(role)}
                                            onContextMenu={(e) => handleContextMenu(e, role)}
                                            className={`h-6 transition-colors cursor-default relative border-b border-gray-50 ${editingRole?.id === role.id
                                                ? 'bg-[#106ebe] text-white shadow-[inset_3px_0_0_#106ebe]'
                                                : 'text-slate-900 even:bg-slate-50/50'
                                                }`}
                                        >
                                            <td className="px-4 font-medium flex items-center gap-2 h-6 border-r border-gray-100">
                                                <ShieldCheck size={12} className={editingRole?.id === role.id ? 'text-white' : 'text-slate-400'} />
                                                <span className="uppercase tracking-tight text-[10px]">{role.name}</span>
                                            </td>
                                            <td className="px-4">
                                                <div className="flex justify-center items-center h-full">
                                                    <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${editingRole?.id === role.id ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white'}`}>
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
                    <div className="p-2 text-[10px] font-medium text-gray-400 bg-gray-50 border-t border-gray-200 uppercase tracking-tighter">
                        {roles.length} registros cargados. Haga clic derecho en la lista para acciones.
                    </div>
                </div>

                {/* Right Side: Role Details & Permissions Tree List (Desktop) */}
                {!isMobile && (
                    <div className="w-[450px] flex flex-col overflow-hidden bg-[#f0f0f0] border-l border-gray-300 shrink-0">
                        <div className="bg-[#e9e9e9] px-4 py-1.5 border-b border-gray-300 flex items-center justify-between">
                            <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                                {editingRole ? `Editando: ${roleForm.name}` : roleForm.name ? 'Nuevo Rol' : 'Configuración de Permisos'}
                            </span>
                        </div>
                        {renderPermissionsTree()}
                    </div>
                )}
            </div>

            {/* Mobile Permissions Modal */}
            {isMobile && showPermissionsModal && editingRole && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-0">
                    <DraggableWindow disabled={true}>
                        <div className="bg-[#f0f0f0] flex flex-col w-full h-full overflow-hidden shadow-2xl">
                            <div className="bg-[#106ebe] h-12 px-4 flex justify-between items-center text-white shrink-0">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={18} />
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-semibold uppercase tracking-widest leading-none">Permisos</span>
                                        <span className="text-[10px] opacity-70 font-medium">{editingRole.name}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowPermissionsModal(false)}
                                    className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden flex flex-col bg-white">
                                {renderPermissionsTree()}
                            </div>
                        </div>
                    </DraggableWindow>
                </div>
            )}

            {/* Context Menu Component */}
            {contextMenu && (
                <div
                    className="absolute bg-white border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] z-[1000] py-1 min-w-[175px] animate-in fade-in zoom-in duration-75"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                    {can('Nuevo') && (
                    <button
                        onClick={startNewRole}
                        className="w-full text-left px-4 py-2 text-[11px] hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-gray-800 group transition-colors"
                    >
                        <Plus size={14} className="text-gray-600 group-hover:text-white" />
                        <span>Nuevo Registro</span>
                    </button>
                    )}

                    {contextMenu.role && (
                        <>
                            <div className="h-px bg-gray-200 my-1" />
                            {can('Editar') && (
                            <button
                                onClick={() => {
                                    setEditingRole(contextMenu.role);
                                    setRoleForm({ name: contextMenu.role.name, description: contextMenu.role.description || '', permissions: contextMenu.role.permissions || [] });
                                    setShowRoleModal(true);
                                }}
                                className="w-full text-left px-4 py-2 text-[11px] hover:bg-[#106ebe] hover:text-white flex items-center gap-3 text-gray-800 group transition-colors"
                            >
                                <Edit3 size={14} className="text-gray-600 group-hover:text-white" />
                                <span>Editar Registro</span>
                            </button>
                            )}
                            {can('Eliminar') && (
                            <button
                                onClick={() => setConfirmDelete(contextMenu.role.id)}
                                className="w-full text-left px-4 py-2 text-[11px] hover:bg-red-600 hover:text-white flex items-center gap-3 text-red-600 font-medium group transition-colors"
                            >
                                <Trash2 size={14} className="text-red-500 group-hover:text-white" />
                                <span>Eliminar Registro</span>
                            </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Modal de Mantenimiento de Roles */}
            {showRoleModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
                    <div className="absolute inset-0" onClick={() => setShowRoleModal(false)} />
                    <DraggableWindow>
                        <div className="bg-white w-[500px] shadow-[0_10px_40px_rgba(0,0,0,0.3)] border border-gray-300 animate-in fade-in zoom-in duration-200 pointer-events-auto relative">
                            <div className="bg-[#106ebe] px-3 py-1.5 flex items-center justify-between text-white modal-header cursor-default select-none">
                                <div className="flex items-center gap-2">
                                    <Shield size={16} />
                                    <span className="text-[11px] font-medium uppercase tracking-wider">Mantenimiento de Roles</span>
                                </div>
                                <X size={18} className="cursor-pointer hover:bg-white/10 p-0.5" onClick={() => setShowRoleModal(false)} />
                            </div>
                            <div className="p-6 bg-[#fcfdfe]">
                                <div className="flex items-center gap-4 mb-8">
                                    <label className="text-[11px] font-medium text-gray-500 w-12 text-right">Rol</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={roleForm.name}
                                        onChange={e => setRoleForm({ ...roleForm, name: e.target.value.toUpperCase() })}
                                        className="flex-1 border border-gray-200 px-3 py-1.5 text-[12px] outline-none shadow-inner bg-white focus:border-[#106ebe]"
                                    />
                                    <div className="flex items-center gap-2 ml-2">
                                        <input type="checkbox" defaultChecked className="accent-[#106ebe] w-4 h-4" />
                                        <span className="text-[11px] font-medium text-gray-500">Habilitado</span>
                                    </div>
                                </div>
                                <div className="flex justify-center gap-4">
                                    <WindowsSaveButton onClick={handleSave} loading={isSaving} title="Guardar Rol" />
                                    <button onClick={() => setShowRoleModal(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 min-w-[120px] py-1.5 px-4 flex items-center justify-center gap-2 rounded-sm shadow-md transition-all border border-gray-300">
                                        <XCircle size={16} />
                                        <span className="text-[12px] font-medium uppercase">Cancelar</span>
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
                    message="¿Está seguro que desea eliminar este rol?"
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(null)}
                    onDeny={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
};
