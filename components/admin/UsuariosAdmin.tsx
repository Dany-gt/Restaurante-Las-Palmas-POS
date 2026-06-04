import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Edit3, Trash2, Key, Loader2, X, Check, CheckCircle, XCircle, Shield, AlertTriangle, Save, User, MoreVertical } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';
import { activityLogService } from '../../services/ActivityLogService';
import { useModulePermissions } from '../../hooks/useModulePermissions';

interface UsuariosAdminProps {
  globalSearch?: string;
}

export const UsuariosAdmin: React.FC<UsuariosAdminProps> = ({ globalSearch = '' }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    role: 'MESERO',
    role_id: '',
    pin: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    branch_id: '',
    is_active: true,
    fingerprint_data: null as string | null
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, user: any } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmFingerprint, setConfirmFingerprint] = useState<{ type: 'add' | 'remove' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const notify = useNotify();
  const { can } = useModulePermissions('Usuarios');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [{ data: profiles, error: pError }, { data: rolesData, error: rError }, { data: branchesData, error: bError }] = await Promise.all([
        supabase.from('profiles').select('*, branch:branches(name)').order('created_at', { ascending: false }),
        supabase.from('roles').select('*').order('name'),
        supabase.from('branches').select('*').order('name')
      ]);

      if (pError) {
        console.error('Error fetching profiles:', pError);
        setFetchError('Error al cargar perfiles: ' + pError.message);
      }
      if (rError) console.error('Error fetching roles:', rError);

      if (profiles) {
        const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const visibleProfiles = (profiles || []).filter(u => {
          const myBranchId = cachedUser?.branch_id;
          const isSuper = cachedUser?.is_superadmin;

          const role = (u.role || '').toUpperCase().trim();
          const name = (u.name || '').toUpperCase().trim();
          const matchesRole = role !== 'MASTER' && role !== 'SOPORTE' && name !== 'SOPORTE TECNICO';

          // SuperAdmin ve todo. Admin normal ve su sucursal (o todas si no tiene branch_id asignado)
          const matchesBranch = isSuper || !myBranchId || u.branch_id === myBranchId;

          return matchesRole && matchesBranch;
        });
        setUsers(visibleProfiles);
      }
      if (rolesData) setRoles(rolesData || []);
      if (branchesData) setBranches(branchesData || []);
      if (bError) console.error('Error fetching branches:', bError);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setFetchError('Error inesperado: ' + err.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Removed local toast timer logic

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from('profiles').delete().eq('id', confirmDelete);
    if (!error) {
      // LOG: User Deleted
      const deletedUser = users.find(u => u.id === confirmDelete);
      activityLogService.log({
        user: JSON.parse(localStorage.getItem('currentUser') || '{}'),
        module: 'USUARIOS',
        action: 'Eliminación de Usuario',
        details: {
          deletedUserId: confirmDelete,
          deletedUserName: deletedUser?.name,
          deletedUserRole: deletedUser?.role
        }
      });

      fetchData();
      notify.success('Usuario eliminado permanentemente');
    } else {
      notify.error('Error al eliminar: ' + error.message);
    }
    setConfirmDelete(null);
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setNewUser({
      name: user.name || '',
      role: user.role || 'MESERO',
      role_id: user.role_id || '',
      pin: user.pin || '',
      email: user.email || '',
      phone: user.phone || '',
      username: user.username || '',
      password: user.password || '',
      branch_id: user.branch_id || '',
      is_active: user.is_active !== false,
      fingerprint_data: user.fingerprint_data || null
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!newUser.name || newUser.pin.length < 4) {
      notify.error('Complete los campos obligatorios (Nombre y PIN 4 dígitos)');
      return;
    }
    setSaving(true);

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userData: any = {
      name: newUser.name,
      role: newUser.role,
      role_id: newUser.role_id || null,
      pin: newUser.pin,
      email: newUser.email,
      phone: newUser.phone,
      username: newUser.username,
      password: newUser.password,
      branch_id: newUser.branch_id || null,
      org_id: currentUser.org_id, // Multi-tenant isolation
      is_active: newUser.is_active,
      is_available: newUser.is_active,
      fingerprint_data: newUser.fingerprint_data
    };

    let error;
    if (editingUser) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(userData)
        .eq('id', editingUser.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([userData]);
      error = insertError;
    }

    if (!error) {
      // LOG: User Created/Updated
      activityLogService.log({
        user: currentUser,
        module: 'USUARIOS',
        action: editingUser ? 'Actualización de Usuario' : 'Registro de Nuevo Usuario',
        details: {
          targetUserId: editingUser?.id,
          targetUserName: newUser.name,
          targetUserRole: newUser.role,
          branchId: newUser.branch_id,
          isActive: newUser.is_active
        }
      });

      setShowModal(false);
      setEditingUser(null);
      setNewUser({
        name: '', role: 'MESERO', role_id: '', pin: '', email: '', phone: '', username: '', password: '', branch_id: '', is_active: true, fingerprint_data: null
      });
      fetchData();
      notify.success('Usuario guardado correctamente');
    } else {
      notify.error('Error al guardar: ' + error.message);
    }
    setSaving(false);
  };

  const toggleMultiBranch = async (user: any) => {
    const newBranchId = user.branch_id ? null : (branches[0]?.id || null);
    const { error } = await supabase
      .from('profiles')
      .update({ branch_id: newBranchId })
      .eq('id', user.id);

    if (!error) {
      fetchData();
      notify.success('Configuración de sucursal actualizada');
    }
  };

  const toggleEnabled = async (user: any) => {
    const newState = user.is_active === false || user.is_available === false ? true : false;
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newState, is_available: newState })
      .eq('id', user.id);

    if (!error) {
      fetchData();
      notify.success(`Usuario ${newState ? 'habilitado' : 'deshabilitado'}`);
    } else {
      notify.error('Error al cambiar estado');
    }
  };

  const handleRegisterFingerprint = () => {
    const fakeFingerprintId = `FP_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    setNewUser(prev => ({ ...prev, fingerprint_data: fakeFingerprintId }));
    setConfirmFingerprint(null);
    notify.success('¡Huella capturada exitosamente!');
  };

  const handleRemoveFingerprint = () => {
    setNewUser(prev => ({ ...prev, fingerprint_data: null }));
    setConfirmFingerprint(null);
    notify.success('Huella eliminada');
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(globalSearch.toLowerCase()) ||
    u.role?.toLowerCase().includes(globalSearch.toLowerCase()) ||
    u.branch?.name?.toLowerCase().includes(globalSearch.toLowerCase())
  );

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-[#fcfdfe] p-4 gap-4 relative select-none">
      {fetchError && (
        <div className="p-2 bg-red-50 border-b border-red-100 text-red-600 text-[10px] font-medium uppercase">
          {fetchError}
        </div>
      )}

      <div
        className="flex-1 overflow-auto bg-white rounded-2xl border border-gray-100 shadow-sm custom-scrollbar"
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest('thead')) return;
          e.preventDefault();
          const rect = containerRef.current?.getBoundingClientRect();
          setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), user: null });
        }}
      >
        {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-[#106ebe]" size={32} /></div>
        ) : isMobile ? (
          <div className="p-2 space-y-2">
            {filteredUsers.map(user => (
              <div
                key={user.id}
                onClick={() => setSelectedUserId(user.id)}
                className={`p-3 rounded-xl border transition-all relative ${selectedUserId === user.id ? 'bg-[#106ebe] text-white border-[#106ebe] shadow-indigo-100' : 'bg-white border-slate-100 shadow-sm text-slate-900'}`}
              >
                <div className="flex justify-between items-start pr-8">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[13px] uppercase tracking-tight">{user.name}</span>
                    <div className="flex items-center gap-1.5 opacity-70">
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                        {user.role}
                      </span>
                      <span className="text-[10px] font-medium">| {user.branch?.name || 'GLOBAL'}</span>
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${user.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </div>
                </div>

                {/* Acciones Rápidas (3 dots) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedUserId(user.id);
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    const containerRect = containerRef.current?.getBoundingClientRect();
                    setContextMenu({
                      x: rect.left - (containerRect?.left || 0) - 150,
                      y: rect.top - (containerRect?.top || 0) + 20,
                      user
                    });
                  }}
                  className={`absolute top-3 right-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${selectedUserId === user.id ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                  <MoreVertical size={18} />
                </button>

                <div className="mt-2 text-[10px] font-medium opacity-60 flex items-center gap-4">
                  <span>USUARIO: {user.username || '---'}</span>
                  {user.fingerprint_data && <span className="text-emerald-500 flex items-center gap-1">HUELA ✓</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full border-collapse text-[11px] font-sans">
            <thead className="bg-[#e8e8e8] sticky top-0 z-20 select-none">
              <tr className="border-b border-gray-400 h-8">
                <th className="py-2 px-4 text-left text-black font-medium uppercase text-[10px] border-r border-gray-300 w-[25%]">Nombre</th>
                <th className="py-2 px-4 text-left text-black font-medium uppercase text-[10px] border-r border-gray-300 w-[15%]">Usuario</th>
                <th className="py-2 px-4 text-left text-black font-medium uppercase text-[10px] border-r border-gray-300 w-[15%]">Rol</th>
                <th className="py-2 px-4 text-left text-black font-medium uppercase text-[10px] border-r border-gray-300 w-[20%]">Sucursal</th>
                <th className="py-2 px-4 text-center text-black font-medium uppercase text-[10px] border-r border-gray-300 w-[12%]">Multi</th>
                <th className="py-2 px-4 text-center text-black font-medium uppercase text-[10px] w-[13%]">Habilitado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  onDoubleClick={() => handleEdit(user)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedUserId(user.id);
                    const rect = containerRef.current?.getBoundingClientRect();
                    setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), user });
                  }}
                  className={`h-6 transition-colors cursor-default relative border-b border-gray-50 ${selectedUserId === user.id
                    ? 'bg-[#106ebe] text-white shadow-[inset_3px_0_0_#106ebe]'
                    : 'text-slate-900 even:bg-slate-50/50'
                    }`}
                >
                  <td className="px-4 font-medium flex items-center gap-2 h-6 border-r border-gray-100">
                    <User size={12} className={selectedUserId === user.id ? 'text-white' : 'text-slate-400'} />
                    <span className="tracking-tight text-[10px]">{user.name || '---'}</span>
                  </td>
                  <td className="px-4 text-[10px] border-r border-gray-100 font-medium">{user.username || `#${user.id?.slice(0, 8)}`}</td>
                  <td className="px-4 border-r border-gray-100">
                    <span className={`px-1.5 py-0 rounded-sm text-[8px] font-semibold uppercase ${selectedUserId === user.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {user.role_id ? (roles.find(r => r.id === user.role_id)?.name) : user.role}
                    </span>
                  </td>
                  <td className="px-4 text-[10px] border-r border-gray-100 font-medium">{user.branch?.name || '--- GLOBAL ---'}</td>
                  <td className="px-4 text-center border-r border-gray-100">
                    <div className="flex justify-center items-center h-full">
                      <div
                        onClick={(e) => { e.stopPropagation(); toggleMultiBranch(user); }}
                        className={`w-3.5 h-3.5 border flex items-center justify-center transition-all cursor-pointer ${!user.branch_id ? (selectedUserId === user.id ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}
                      >
                        {!user.branch_id && <Check size={10} strokeWidth={4} />}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 text-center">
                    <div className="flex justify-center items-center h-full">
                      <div
                        onClick={(e) => { e.stopPropagation(); toggleEnabled(user); }}
                        className={`w-3.5 h-3.5 border flex items-center justify-center transition-all cursor-pointer ${(user.is_active !== false && user.is_available !== false) ? (selectedUserId === user.id ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}
                      >
                        {(user.is_active !== false && user.is_available !== false) && <Check size={10} strokeWidth={4} />}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 shrink-0">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest pl-2 border-l-4 border-[#106ebe]">
          {filteredUsers.length} Usuarios Registrados
        </span>
      </div>

      {contextMenu && (
        <div
          className="absolute z-[1000] bg-white border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-1 min-w-[175px] animate-in fade-in zoom-in-95 duration-75"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          {can('Nuevo') && (
          <button
            onClick={() => { setEditingUser(null); setNewUser({ name: '', role: 'MESERO', role_id: '', pin: '', email: '', phone: '', username: '', password: '', branch_id: '', is_active: true, fingerprint_data: null }); setShowModal(true); setContextMenu(null); }}
            className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
          >
            <UserPlus size={14} className="text-gray-600 group-hover:text-white" /> Nuevo Usuario
          </button>
          )}
          {contextMenu.user && (
            <>
              <div className="h-px bg-gray-100 my-1"></div>
              {can('Editar') && (
              <button
                onClick={() => { handleEdit(contextMenu.user); setContextMenu(null); }}
                className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
              >
                <Edit3 size={14} className="text-[#106ebe] group-hover:text-white" /> Editar Registro
              </button>
              )}
              {can('Eliminar') && (
              <button
                onClick={() => { setConfirmDelete(contextMenu.user.id); setContextMenu(null); }}
                className="w-full text-left px-4 py-2 text-[11px] font-medium text-red-600 hover:bg-red-600 hover:text-white flex items-center gap-3 group transition-colors"
              >
                <Trash2 size={14} className="text-red-500 group-hover:text-white" /> Eliminar Registro
              </button>
              )}
            </>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
          <div className="absolute inset-0" onClick={() => { setShowModal(false); setEditingUser(null); }} />
          <DraggableWindow id="users-admin-modal" title="Mantenimiento de Usuarios">
            <div className="w-full h-full md:h-auto md:max-w-2xl bg-white md:rounded-sm shadow-2xl overflow-y-auto animate-in zoom-in-95 duration-200 border-0 md:border border-gray-300 pointer-events-auto relative">
              {/* Cabecera del Modal */}
              <div className="bg-[#106ebe] h-8 flex items-center justify-between px-3 shrink-0 modal-header cursor-default select-none modal-header cursor-default select-none">
                <span className="text-white text-[11px] font-medium uppercase tracking-wider">Mantenimiento de Usuarios</span>
                <div className="flex items-center gap-1">
                  <WindowsSaveButton onClick={handleSave} loading={saving} title="Guardar Usuario" />
                  <button onClick={() => { setShowModal(false); setEditingUser(null); }} title="Cerrar" className="w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-all">
                    <X size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>

              <div className="p-0 overflow-y-auto">
                {/* Sección: Datos de Usuario */}
                <div className="bg-slate-100/80 px-4 py-1 border-b border-gray-200">
                  <span className="text-[#106ebe] text-[10px] font-semibold uppercase tracking-wider">Datos de Usuario</span>
                </div>

                <div className="p-2.5 space-y-1">
                  {/* Nombre */}
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] font-medium text-gray-600 w-24 shrink-0">Nombre</label>
                    <input
                      autoFocus
                      value={newUser.name}
                      onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                      type="text"
                      className="flex-1 border border-gray-300 h-6 px-2 text-[11px] outline-none focus:border-[#106ebe] bg-blue-50/20"
                    />
                  </div>

                  {/* Correo y Teléfono */}
                  <div className="grid grid-cols-2 gap-8">
                    <div className="flex items-center gap-4">
                      <label className="text-[10px] font-medium text-gray-600 w-24 shrink-0">Correo</label>
                      <input
                        value={newUser.email}
                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                        type="email"
                        className="flex-1 border border-gray-300 h-6 px-2 text-[11px] outline-none focus:border-[#106ebe]"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="text-[10px] font-medium text-gray-600 w-16 shrink-0">Teléfono</label>
                      <input
                        value={newUser.phone}
                        onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                        type="text"
                        className="flex-1 border border-gray-300 h-6 px-2 text-[11px] outline-none focus:border-[#106ebe]"
                      />
                    </div>
                  </div>

                  {/* Sucursal y Estados */}
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] font-medium text-gray-600 w-24 shrink-0">Sucursal</label>
                    <select
                      value={newUser.branch_id}
                      onChange={e => setNewUser({ ...newUser, branch_id: e.target.value })}
                      className="min-w-[280px] border border-gray-300 h-6 px-2 text-[11px] outline-none focus:border-[#106ebe] bg-white"
                    >
                      <option value="">Seleccionar..</option>
                      {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                    </select>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <div className="flex items-center gap-1.5">
                        <input type="checkbox" checked={newUser.branch_id === null || newUser.branch_id === ''} onChange={e => { }} className="accent-[#106ebe]" id="chk_multisuc" />
                        <label htmlFor="chk_multisuc" className="text-[10px] font-medium text-gray-600 cursor-pointer">Multi Sucursal</label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="checkbox" checked={newUser.is_active} onChange={e => setNewUser({ ...newUser, is_active: e.target.checked })} className="accent-[#106ebe]" id="chk_active" />
                        <label htmlFor="chk_active" className="text-[10px] font-medium text-gray-600 cursor-pointer">Habilitado</label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sección: Datos de Acceso */}
                <div className="bg-slate-100/80 px-4 py-1 border-y border-gray-200">
                  <span className="text-[#106ebe] text-[10px] font-semibold uppercase tracking-wider">Datos de Acceso</span>
                </div>

                <div className="p-2.5 space-y-1">
                  {/* Usuario */}
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] font-medium text-gray-600 w-24 shrink-0">Usuario</label>
                    <input
                      value={newUser.username}
                      onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                      type="text"
                      className="flex-1 md:w-[300px] border border-gray-300 h-6 px-2 text-[11px] outline-none focus:border-[#106ebe] font-medium"
                    />
                  </div>

                  {/* Contraseña */}
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] font-medium text-gray-600 w-24 shrink-0">Contraseña</label>
                    <input
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                      type="text"
                      className="flex-1 md:w-[300px] border border-gray-300 h-6 px-2 text-[11px] outline-none focus:border-[#106ebe]"
                    />
                  </div>

                  {/* PIN */}
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] font-medium text-gray-600 w-24 shrink-0">PIN</label>
                    <input
                      value={newUser.pin}
                      onChange={e => setNewUser({ ...newUser, pin: e.target.value })}
                      type="text"
                      maxLength={4}
                      className="flex-1 md:w-[300px] border border-gray-300 h-6 px-2 text-[11px] outline-none focus:border-[#106ebe] font-medium tracking-[4px]"
                    />
                  </div>

                  {/* Rol */}
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] font-medium text-gray-600 w-24 shrink-0">Rol de Usuario</label>
                    <select
                      value={newUser.role_id || newUser.role}
                      onChange={e => { const val = e.target.value; const isDynamic = roles.find(r => r.id === val); if (isDynamic) setNewUser({ ...newUser, role_id: val, role: isDynamic.name }); else setNewUser({ ...newUser, role: val, role_id: '' }); }}
                      className="flex-1 md:w-[300px] border border-gray-300 h-6 px-2 text-[11px] outline-none focus:border-[#106ebe] bg-white"
                    >
                      <option value="ADMIN">ADMINISTRADOR</option><option value="CAJERO">CAJERO</option><option value="MESERO">MESERO</option><option value="COCINA">COCINA</option>
                      {roles.filter(r => !['ADMINISTRADOR', 'CAJERO', 'MESERO', 'COCINA', 'ADMIN'].includes(r.name.toUpperCase())).map(r => (<option key={r.id} value={r.id}>{r.name}</option>))}
                    </select>
                  </div>

                  {/* Fingerprint Footer Area */}
                  <div className="flex items-center gap-4 pt-1">
                    <span className={`text-[10px] font-medium ${newUser.fingerprint_data ? 'text-green-600' : 'text-red-500'}`}>
                      {newUser.fingerprint_data ? `Huella Registrada` : 'Sin huella registrada...'}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmFingerprint({ type: 'add' })} className="px-3 py-0.5 bg-white border border-gray-300 text-[10px] font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        Agregar Huella
                      </button>
                      {newUser.fingerprint_data && (
                        <button onClick={() => setConfirmFingerprint({ type: 'remove' })} className="px-3 py-0.5 bg-white border border-gray-300 text-[10px] font-medium text-red-600 hover:bg-red-50">
                          Quitar Huella
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DraggableWindow>
        </div>
      )}

      {/* MODALES DE CONFIRMACIÓN PROPIOS */}
      {confirmDelete && (
        <WindowsConfirmModal
          title="Confirmar Eliminación"
          message="¿Desea eliminar este usuario permanentemente?"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          onDeny={() => setConfirmDelete(null)}
        />
      )}

      {confirmFingerprint && (
        <WindowsConfirmModal
          title="Mantenimiento de Huella"
          message={confirmFingerprint.type === 'add' ? '¿Iniciar proceso de captura de huella digital?' : '¿Desea eliminar la huella registrada de este usuario?'}
          onConfirm={confirmFingerprint.type === 'add' ? handleRegisterFingerprint : handleRemoveFingerprint}
          onCancel={() => setConfirmFingerprint(null)}
          onDeny={() => setConfirmFingerprint(null)}
        />
      )}
    </div >
  );
};
