import React, { useState, useEffect } from 'react';
import { Plus, Tag, MoveVertical, Edit2, Trash2, Loader2, X, ChevronRight, ChevronDown, Save } from 'lucide-react';
import { DraggableWindow } from './AdminPortal';
import { supabase } from '../../supabase';
import { Category } from '../../types';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';

export const CategoriesAdmin: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPriority, setNewPriority] = useState('100');
  const [newImage, setNewImage] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [parent_id, setParentId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const notify = useNotify();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('priority', { ascending: true }) // Order by priority
      .order('name');
    if (!error) setCategories(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from('categories').delete().eq('id', confirmDelete);
    if (!error) {
      fetchData();
      notify.success('Categoría eliminada correctamente');
    } else {
      notify.error('Error: Asegúrate de que la categoría no tenga productos antes de borrarla.');
    }
    setConfirmDelete(null);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setNewName(category.name);
    setParentId(category.parent_id);
    setNewPriority(category.priority ? category.priority.toString() : '100');
    setNewImage(category.image_url || '');
    setIsEnabled(category.is_enabled);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!newName) {
      notify.error('El nombre es obligatorio');
      return;
    }
    setIsSaving(true);

    const payload = {
      name: newName.toUpperCase(),
      parent_id: parent_id === "" ? null : parent_id,
      priority: parseInt(newPriority) || 100,
      image_url: newImage,
      is_enabled: isEnabled
    };

    if (editingCategory) {
      const { error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', editingCategory.id);

      if (!error) {
        setShowModal(false);
        resetForm();
        fetchData();
        notify.success('Categoría actualizada correctamente');
      } else {
        notify.error('Error al actualizar: ' + error.message);
      }
    } else {
      const { error } = await supabase.from('categories').insert([payload]);
      if (!error) {
        setShowModal(false);
        resetForm();
        fetchData();
        notify.success('Categoría guardada correctamente');
      } else {
        notify.error('Error al guardar: ' + error.message);
      }
    }
    setIsSaving(false);
  };

  const resetForm = () => {
    setNewName('');
    setParentId(null);
    setNewPriority('100');
    setNewImage('');
    setIsEnabled(true);
    setEditingCategory(null);
  };

  const mainCategories = categories.filter(c => !c.parent_id);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    // Only toggle if the click wasn't on a button element inside the row
    if ((e.target as HTMLElement).closest('button')) return;
    setExpandedCategories(prev =>
      prev.includes(id) ? prev.filter(catId => catId !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in max-w-4xl mx-auto w-full relative h-full flex flex-col">
      <div className="flex items-center justify-end mb-6 md:mb-8">
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-slate-800 px-4 py-3 md:px-6 md:py-3 rounded-2xl font-semibold text-[10px] md:text-xs tracking-widest uppercase transition-all shadow-lg active:scale-95"
        >
          <Plus size={18} /> NUEVA<span className="hidden xs:inline"> CATEGORÍA</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 md:space-y-6 pb-24 md:pb-8 scrollbar-hide">
        {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>
        ) : (
          mainCategories.map((main) => {
            const isExpanded = expandedCategories.includes(main.id);
            return (
              <div key={main.id} className="space-y-2 md:space-y-3">
                <div
                  onClick={(e) => toggleExpand(main.id, e)}
                  onDoubleClick={() => handleEdit(main)}
                  title={`Doble click para editar o click para ${isExpanded ? 'contraer' : 'expandir'} subcategorías de ${main.name}`}
                  className={`admin-card p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between border border-slate-200 transition-all group cursor-pointer select-none ${isExpanded ? 'bg-white shadow-sm' : 'bg-slate-50 hover:bg-white'}`}
                >
                  <div className="flex items-center gap-3 md:gap-6 min-w-0">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isExpanded ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'bg-indigo-600/10 text-indigo-400 group-hover:bg-indigo-600/20'}`}>
                      <Tag size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm md:text-lg font-semibold tracking-tight text-slate-800 truncate">{main.name}</span>
                        {!main.is_enabled && <span className="text-[8px] md:text-[10px] bg-red-500/20 text-red-500 px-1.5 md:px-2 rounded-md font-medium uppercase">Deshabilitada</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-2 text-[8px] md:text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                        <span className="hidden sm:inline">Categoría Principal</span>
                        <span className="text-indigo-400">Orden: {main.priority || 100}</span>
                        <span className="text-slate-300">• {categories.filter(c => c.parent_id === main.id).length} sub</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 md:gap-4 shrink-0 mt-3 sm:mt-0">
                    <div className="flex items-center gap-1.5 opacity-60 sm:hidden">
                      <div className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={18} />
                      </div>
                      <span className="text-[9px] font-medium uppercase tracking-widest">{isExpanded ? 'Cerrar' : 'Ver sub'}</span>
                    </div>
                    <div className="flex gap-1 md:gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(main); }}
                        title={`Editar categoría ${main.name}`}
                        className="p-2 md:p-2.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl text-amber-500 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1 md:gap-2"
                      >
                        <Edit2 size={14} /> <span className="hidden xs:inline">Editar</span>
                      </button>
                      <button
                        onClick={() => { setParentId(main.id); setEditingCategory(null); setNewName(''); setNewPriority('100'); setNewImage(''); setIsEnabled(true); setShowModal(true); }}
                        title={`Añadir subcategoría a ${main.name}`}
                        className="p-2 md:p-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 rounded-xl text-indigo-400 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1 md:gap-2"
                      >
                        <Plus size={14} /> <span className="hidden xs:inline">Sub</span>
                      </button>
                      <button
                        onClick={() => setConfirmDelete(main.id)}
                        title={`Eliminar categoría ${main.name}`}
                        className="p-2 md:p-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 font-semibold"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className={`text-slate-400 transition-transform duration-300 hidden sm:block ${isExpanded ? 'rotate-180' : ''}`}>
                      <ChevronDown size={20} />
                    </div>
                  </div>
                </div>

                <div
                  className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden">
                    <div className="ml-6 md:ml-12 space-y-2 border-l-2 border-slate-200 pl-4 md:pl-6 pt-1 pb-3">
                      {categories.filter(c => c.parent_id === main.id).map(sub => (
                        <div 
                          key={sub.id} 
                          onDoubleClick={() => handleEdit(sub)}
                          className="admin-card p-3 md:p-4 rounded-xl flex items-center justify-between border border-slate-200 hover:border-slate-300 bg-white transition-all group/sub cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2 md:gap-4 min-w-0">
                            <div className="w-6 h-6 md:w-8 md:h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover/sub:text-indigo-400 shrink-0">
                              <ChevronRight size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs md:text-sm font-medium tracking-tight text-slate-700 truncate">{sub.name}</span>
                                {!sub.is_enabled && <span className="text-[8px] md:text-[9px] bg-red-500/20 text-red-500 px-1.5 rounded-md font-medium uppercase">Deshabilitada</span>}
                              </div>
                              <span className="text-[8px] md:text-[9px] text-slate-400 font-semibold uppercase">Prioridad: {sub.priority || 100}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover/sub:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(sub); }}
                              title={`Editar subcategoría ${sub.name}`}
                              className="p-2 text-slate-500 hover:text-amber-500 transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(sub.id)}
                              title={`Eliminar subcategoría ${sub.name}`}
                              className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {categories.filter(c => c.parent_id === main.id).length === 0 && (
                        <div className="p-4 rounded-xl flex items-center justify-center border border-dashed border-slate-200 bg-slate-50/50">
                          <span className="text-[10px] uppercase tracking-widest font-medium text-slate-400 text-center">No hay subcategorías registradas</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-0 md:p-6 animate-fade-in pointer-events-none">
          <div className="absolute inset-0 bg-black/5 pointer-events-auto" onClick={() => setShowModal(false)} />
          <DraggableWindow id="categories-admin-modal" title={editingCategory ? 'Editar Categoría' : 'Mantenimiento de Categorías'}>
            <div className="w-full h-[600px] md:h-auto md:max-w-2xl bg-white md:rounded-sm shadow-2xl relative flex flex-col overflow-y-auto pointer-events-auto border border-gray-300">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div className="space-y-1">
                  <h3 className="text-lg md:text-2xl font-semibold uppercase text-slate-800 tracking-tight">{editingCategory ? 'Editar Categoría' : parent_id ? 'Nueva Subcategoría' : 'Nueva Categoría'}</h3>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none">Configuración de Niveles</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all active:scale-95 shadow-sm border border-slate-100"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 p-2">
                {/* Left Column: Basic Info */}
                <div className="space-y-4 md:space-y-6">
                  {parent_id && (
                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                      <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest">Rama Principal</p>
                      <p className="text-sm font-medium mt-1 uppercase text-slate-700">{categories.find(c => c.id === parent_id)?.name}</p>
                    </div>
                  )}

                  {!parent_id && !editingCategory && (
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Vincular a Padre (Opcional)</label>
                      <select value={parent_id || ""} onChange={e => setParentId(e.target.value)} className="form-input w-full bg-slate-50 border-slate-200">
                        <option value="">Ninguno (Categoría Principal)</option>
                        {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nombre Visual</label>
                    <input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      type="text"
                      className="form-input w-full bg-slate-50 border-slate-200 focus:bg-white transition-all outline-none uppercase"
                      placeholder="EJ. MARISCOS"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Orden de Visualización</label>
                    <input
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value)}
                      type="number"
                      className="form-input w-full bg-slate-50 border-slate-200 focus:bg-white transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Right Column: Media & Status */}
                <div className="space-y-4 md:space-y-6">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Imagen Representativa</label>
                    <div className="group relative w-full aspect-video bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 overflow-hidden transition-all hover:bg-slate-100/80 hover:border-indigo-300 shadow-inner">
                      {newImage ? (
                        <>
                          <img src={newImage} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button
                              onClick={() => setNewImage('')}
                              className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-xl transform active:scale-95"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400">
                            <Plus size={24} />
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Subir Imagen</p>
                            <p className="text-[9px] font-medium text-slate-300 uppercase tracking-widest mt-1">Formatos: JPG, PNG</p>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                setLoading(true);
                                const fileExt = file.name.split('.').pop();
                                const fileName = `cat_${Math.random()}.${fileExt}`;
                                const filePath = `categories/${fileName}`;
                                const { error: uploadError } = await supabase.storage.from('menu').upload(filePath, file);
                                if (uploadError) throw uploadError;
                                const { data } = supabase.storage.from('menu').getPublicUrl(filePath);
                                setNewImage(data.publicUrl);
                              } catch (error: any) {
                                notify.error('Error al subir imagen: ' + error.message);
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-tight">Estado de Categoría</p>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Visible en el Menú</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={e => setIsEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                      </label>
                    </div>
                  </div>

                  <WindowsSaveButton
                    onClick={handleSave}
                    loading={isSaving}
                    title={editingCategory ? 'Actualizar Categoría' : `Guardar ${parent_id ? 'Subcategoría' : 'Categoría'}`}
                  />
                </div>
              </div>
            </div>
          </DraggableWindow>
        </div>
      )}

      {confirmDelete && (
        <WindowsConfirmModal
          title="Confirmar Eliminación"
          message="¿Eliminar esta categoría? Esto podría afectar a los productos asociados. Asegúrate de que no tenga productos vinculados."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          onDeny={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};
