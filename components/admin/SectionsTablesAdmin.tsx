import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, RefreshCw, X, Save, Trash2, Edit3,
  Check, Loader2, MapPin, List, Table as TableIcon, Star
} from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';

export const SectionsTablesAdmin: React.FC = () => {
  const [sections, setSections] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(() => {
    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return cachedUser?.branch_id || 'ALL';
  });
  const [localSearch, setLocalSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, section: any } | null>(null);
  const notify = useNotify();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const defaultFormData = {
    name: '',
    priority: 1,
    table_from: 1,
    table_to: 10,
    branch_id: '',
    is_enabled: true
  };

  const [formData, setFormData] = useState(defaultFormData);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: sectionsData, error: sError },
        { data: branchesData, error: bError }
      ] = await Promise.all([
        supabase.from('sections').select('*, branch:branches(name)').order('priority', { ascending: true }),
        supabase.from('branches').select('*').order('name')
      ]);

      if (sError) throw sError;
      setSections(sectionsData || []);
      setBranches(branchesData || []);
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
        priority: parseInt(formData.priority.toString()) || 1,
        table_from: parseInt(formData.table_from.toString()) || 0,
        table_to: parseInt(formData.table_to.toString()) || 0,
        branch_id: formData.branch_id,
        is_enabled: formData.is_enabled
      };

      const { error } = editingSection
        ? await supabase.from('sections').update(dataToSave).eq('id', editingSection.id)
        : await supabase.from('sections').insert([dataToSave]);

      if (error) throw error;

      notify.success(`Sección ${editingSection ? 'actualizada' : 'registrada'} correctamente`);
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      notify.error('Error al guardar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (section: any) => {
    setEditingSection(section);
    setFormData({
      name: section.name || '',
      priority: section.priority || 1,
      table_from: section.table_from || 0,
      table_to: section.table_to || 0,
      branch_id: section.branch_id || '',
      is_enabled: section.is_enabled ?? true
    });
    setShowModal(true);
  };
  const handleDelete = async () => {
    if (!confirmDelete) return;

    const { error } = await supabase.from('sections').delete().eq('id', confirmDelete);
    if (!error) {
      notify.success('Sección eliminada correctamente');
      fetchData();
    } else {
      notify.error('Error al eliminar: ' + error.message);
    }
    setConfirmDelete(null);
  };

  const filteredSections = sections.filter(s => {
    const matchesBranch = selectedBranchFilter === 'ALL' || s.branch_id === selectedBranchFilter;
    const matchesSearch = s.name.toLowerCase().includes(localSearch.toLowerCase()) ||
      (s.branch?.name || '').toLowerCase().includes(localSearch.toLowerCase());
    return matchesBranch && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] overflow-hidden" ref={containerRef} onClick={() => setContextMenu(null)}>
      {/* Toolbar Principal - Estilo ERP */}
      <div className="bg-white border-b border-gray-300 p-2 flex flex-wrap items-center gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tighter">Sucursal</span>
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="h-7 bg-white border border-gray-300 rounded px-2 text-[11px] font-bold text-slate-800 outline-none min-w-[280px] focus:border-[#106ebe]"
          >
            <option value="ALL">TODAS LAS SUCURSALES</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 max-w-md flex items-center gap-1 ml-auto">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Introduzca el texto a buscar..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full h-7 pl-8 pr-3 bg-white border border-gray-300 rounded text-[11px] font-medium outline-none focus:border-[#106ebe]"
            />
            <Search size={14} className="absolute left-2.5 top-1.5 text-gray-400" />
          </div>
          <button className="h-7 px-4 bg-gray-100 hover:bg-[#106ebe] hover:text-white text-gray-600 text-[10px] font-black uppercase tracking-widest rounded transition-all border border-gray-200">
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
          setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), section: null });
        }}
      >

        {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-[#106ebe]" size={32} /></div>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-20 bg-[#e8e8e8] select-none">
              <tr className="border-b border-gray-400 h-10">
                <th className="py-2 px-6 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[30%]">Sección</th>
                <th className="py-2 px-6 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[15%]">Mesas Del</th>
                <th className="py-2 px-6 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[15%]">Al</th>
                <th className="py-2 px-6 text-center text-[10px] font-bold text-black uppercase border-r border-gray-300 w-[15%]">Prioridad</th>
                <th className="py-2 px-6 text-center text-[10px] font-bold text-black uppercase w-[15%] text-nowrap">Habilitado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSections.map((s, index) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedSectionId(s.id)}
                  onDoubleClick={() => openEdit(s)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedSectionId(s.id);
                    const rect = containerRef.current?.getBoundingClientRect();
                    setContextMenu({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0), section: s });
                  }}
                  className={`h-6 transition-colors cursor-default relative border-b border-gray-50 ${
                    selectedSectionId === s.id
                      ? 'bg-[#106ebe] text-white shadow-[inset_3px_0_0_#106ebe]'
                      : index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'
                  } text-slate-900`}
                >
                  <td className="px-4 font-bold flex items-center gap-2 h-6 border-r border-gray-100">
                    <MapPin size={12} className={selectedSectionId === s.id ? 'text-white' : 'text-slate-400'} />
                    <span className="uppercase tracking-tight text-[10px]">{s.name}</span>
                  </td>
                  <td className="px-4 border-r border-gray-100 text-[10px] font-bold tracking-tight">
                    {s.table_from}
                  </td>
                  <td className="px-4 border-r border-gray-100 text-[10px] font-bold tracking-tight">
                    {s.table_to}
                  </td>
                  <td className="px-4 border-r border-gray-100 text-[10px] font-bold text-center tracking-tight">
                    {s.priority}
                  </td>
                  <td className="px-4 border-r border-gray-100">
                    <div className="flex justify-center">
                      <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${s.is_enabled !== false ? (selectedSectionId === s.id ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white') : 'bg-white border-gray-300'}`}>
                        {s.is_enabled !== false && <Check size={10} strokeWidth={4} />}
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
            onClick={() => { setEditingSection(null); setFormData(defaultFormData); setShowModal(true); setContextMenu(null); }}
            className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
          >
            <Plus size={14} className="text-emerald-500 group-hover:text-white" /> Nuevo
          </button>
          <div className="h-px bg-gray-100 my-1"></div>
          {contextMenu.section && (
            <>
              <button
                onClick={() => { openEdit(contextMenu.section); setContextMenu(null); }}
                className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 group transition-colors"
              >
                <Edit3 size={14} className="text-[#106ebe] group-hover:text-white" /> Editar
              </button>
              <div className="h-px bg-gray-100 my-1"></div>
              <button
                onClick={() => { setConfirmDelete(contextMenu.section.id); setContextMenu(null); }}
                className="w-full text-left px-4 py-2 text-[11px] font-bold text-red-600 hover:bg-red-600 hover:text-white flex items-center gap-3 group transition-colors"
              >
                <Trash2 size={14} className="text-red-500 group-hover:text-white" /> Eliminar
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

      {/* Modal de Mantenimiento de Secciones */}
      {showModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
          <div className="absolute inset-0" onClick={() => setShowModal(false)} />
          <DraggableWindow id="sections-admin-modal" title="Mantenimiento de Secciones">
            <div className="w-full max-w-lg bg-[#f0f0f0] shadow-2xl overflow-hidden border border-[#106ebe] flex flex-col pointer-events-auto">
              {/* Header del Modal */}
              <div className="bg-[#106ebe] h-8 flex items-center justify-between px-3 shrink-0 modal-header cursor-default select-none">
                <div className="flex items-center gap-2">
                  <span className="text-white text-[11px] font-bold">Mantenimiento de Secciones</span>
                </div>
                <div className="flex items-center gap-1">
                  <WindowsSaveButton onClick={handleSave} loading={isSaving} title="Guardar Sección" />
                  <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all">
                    <X size={18} strokeWidth={3} />
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-4">
                <div className="bg-white border border-gray-300 shadow-sm">
                  <div className="bg-[#cbd5e1] px-3 py-1 border-b border-gray-300">
                    <span className="text-[11px] font-bold text-[#106ebe] uppercase tracking-tighter">Datos de Sección</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                      <label className="text-[11px] font-medium text-gray-700">Nombre</label>
                      <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })} type="text" className="erp-input-field" />
                    </div>
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
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
                    </div>
                    <div className="grid grid-cols-[100px_1fr_100px_1fr] items-center gap-4">
                      <label className="text-[11px] font-medium text-gray-700">Mesas Del</label>
                      <input value={formData.table_from} onChange={e => setFormData({ ...formData, table_from: parseInt(e.target.value) || 0 })} type="number" className="erp-input-field" />
                      <label className="text-[11px] font-medium text-gray-700">Al</label>
                      <input value={formData.table_to} onChange={e => setFormData({ ...formData, table_to: parseInt(e.target.value) || 0 })} type="number" className="erp-input-field" />
                    </div>
                    <div className="grid grid-cols-[100px_120px_1fr] items-center gap-4">
                      <label className="text-[11px] font-medium text-gray-700">Prioridad</label>
                      <input value={formData.priority} onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })} type="number" className="erp-input-field" />
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.is_enabled}
                          onChange={e => setFormData({ ...formData, is_enabled: e.target.checked })}
                          className="w-3.5 h-3.5 accent-[#106ebe]"
                          id="chk_habilitado"
                        />
                        <label htmlFor="chk_habilitado" className="text-[11px] font-medium text-gray-700 cursor-pointer">Habilitado</label>
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
          message="¿Desea eliminar este registro permanentemente? (Se eliminarán también las mesas asociadas)"
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
