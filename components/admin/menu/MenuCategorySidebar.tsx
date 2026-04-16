/**
 * DOMINIO 1 — MENÚ DE PLATILLOS
 * Sidebar exclusivo del Menú.
 * SOLO lee / escribe: menu_categories
 * NUNCA toca: product_categories, supply_categories,
 *              utensil_categories, inventory_items
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Save, Loader2, Utensils, RefreshCw, Folder, Image as ImageIcon } from 'lucide-react';
import { useRef } from 'react';
import { useDomainCategories } from '../../../hooks/useDomainCategories';
import { useNotify } from '../../../hooks/useNotify';
import { supabase } from '../../../supabase';
import { DraggableWindow } from '../DraggableWindow';

const DOMAIN_TABLE = 'menu_categories' as const;

interface MenuCategorySidebarProps {
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}

interface FormState { 
    id: string | null; 
    nombre: string; 
    parent_id: string | null;
    isSubCategory: boolean;
    branch_ids: string[];
    sort_order: number;
    imagen_url: string;
}

export const MenuCategorySidebar: React.FC<MenuCategorySidebarProps> = ({ selectedId, onSelect }) => {
    const notify = useNotify();
    const { categories, load, loading, create, update, remove } = useDomainCategories({
        table: DOMAIN_TABLE,
        extraFilters: { activo: true },
        orderBy: 'sort_order',
    });

    const [branches, setBranches] = useState<any[]>([]);
    useEffect(() => {
        supabase.from('branches').select('*').then(({ data }) => setBranches(data || []));
    }, []);

    const [form, setForm] = useState<FormState | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string | null; nombre: string | null } | null>(null);
    const [showParentSelect, setShowParentSelect] = useState(false);
    
    // Image Upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `categorie_${Date.now()}.${fileExt}`;
            const filePath = `categories/${fileName}`;
            const { error } = await supabase.storage.from('menu').upload(filePath, file, { upsert: true });
            if (error) throw error;
            const { data } = supabase.storage.from('menu').getPublicUrl(filePath);
            setForm(prev => prev ? { ...prev, imagen_url: data.publicUrl } : null);
            notify.success('Imagen subida correctamente');
        } catch (err: any) {
            notify.error('Error al subir imagen: ' + err.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        if (!form?.nombre.trim()) return;
        setIsSaving(true);
        try {
            const payload = {
                parent_id: form.isSubCategory ? form.parent_id : null,
                sort_order: form.sort_order,
                branch_ids: form.branch_ids,
                imagen_url: form.imagen_url || null
            };

            if (form.id) {
                await update(form.id, { nombre: form.nombre.toUpperCase(), ...payload });
                notify.success('Categoría actualizada');
            } else {
                await create(form.nombre, payload);
                notify.success('Categoría creada');
            }
            setForm(null);
        } catch (e: any) {
            notify.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, nombre: string) => {
        setContextMenu(null);
        if (!confirm(`¿Eliminar categoría "${nombre}"?\nLos platillos quedarán sin categoría.`)) return;
        try {
            await remove(id);
            if (selectedId === id) onSelect(null);
            notify.success('Categoría eliminada');
        } catch (e: any) {
            notify.error(e.message);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, id: string, nombre: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: Math.min(e.clientX, window.innerWidth - 160), y: Math.min(e.clientY, window.innerHeight - 100), id, nombre });
    };

    const handleOpenForm = (id: string | null, catName: string = '') => {
        if (!id) {
            setForm({ id: null, nombre: '', parent_id: null, isSubCategory: false, branch_ids: [], sort_order: categories.length + 1, imagen_url: '' });
        } else {
            const c = categories.find(x => x.id === id);
            if (c) {
                setForm({
                    id: c.id,
                    nombre: c.nombre,
                    parent_id: (c as any).parent_id || null,
                    isSubCategory: !!(c as any).parent_id,
                    branch_ids: (c as any).branch_ids || [],
                    sort_order: (c as any).sort_order || 1,
                    imagen_url: (c as any).imagen_url || ''
                });
            } else {
                setForm({ id: null, nombre: catName, parent_id: null, isSubCategory: false, branch_ids: [], sort_order: 1, imagen_url: '' });
            }
        }
    };

    // Render tree logic for subcategories (in case they use them now)
    const roots = categories.filter(c => !(c as any).parent_id);
    const getChildren = (parentId: string) => categories.filter(c => (c as any).parent_id === parentId);

    const renderCat = (cat: typeof categories[0], depth = 0) => (
        <React.Fragment key={cat.id}>
            <div
                className={`flex items-center h-[22px] px-3 cursor-pointer group ${selectedId === cat.id ? 'bg-blue-50 text-[#106ebe] font-black' : 'hover:bg-[#cce8ff] text-slate-800'}`}
                style={{ paddingLeft: `${12 + depth * 12}px` }}
                onClick={() => onSelect(cat.id)}
                onContextMenu={(e) => handleContextMenu(e, cat.id, cat.nombre)}
            >
                {depth > 0 && <span className="text-gray-300 mr-1 text-[8px]">└</span>}
                <span className="flex-1 text-[10px] uppercase truncate leading-none">{cat.nombre}</span>
                <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleOpenForm(cat.id); }}
                        className="p-0.5 hover:bg-blue-100 rounded"
                    ><Edit2 size={9} /></button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(cat.id, cat.nombre); }}
                        className="p-0.5 hover:bg-red-100 text-red-500 rounded"
                    ><Trash2 size={9} /></button>
                </div>
            </div>
            {getChildren(cat.id).map(child => renderCat(child, depth + 1))}
        </React.Fragment>
    );

    return (
        <>
            <div
                className="w-[190px] flex flex-col bg-white border-r border-gray-300 h-full shadow-sm shrink-0 select-none"
                onClick={() => setContextMenu(null)}
            >
                <div className="bg-[#106ebe] h-[26px] px-2 flex items-center justify-between border-b border-[#004578] shrink-0">
                    <div className="flex items-center gap-1.5">
                        <Utensils size={10} className="text-white/80" />
                        <span className="text-[9px] font-bold text-white uppercase tracking-tight">Categorías de Menú</span>
                    </div>
                    <button
                        onClick={() => handleOpenForm(null)}
                        className="w-5 h-5 flex items-center justify-center hover:bg-white/20 rounded transition-colors text-white font-bold text-[14px] leading-none"
                        title="Nueva categoría de menú"
                    >+</button>
                </div>

                <div 
                    className="flex-1 overflow-y-auto text-[11px]"
                    onContextMenu={(e) => {
                        if (e.target === e.currentTarget) {
                            e.preventDefault();
                            setContextMenu({ x: Math.min(e.clientX, window.innerWidth - 160), y: Math.min(e.clientY, window.innerHeight - 100), id: null, nombre: null });
                        }
                    }}
                >
                    {loading ? (
                        <div className="flex justify-center p-4"><Loader2 size={14} className="animate-spin text-gray-400" /></div>
                    ) : (
                        roots.map(cat => renderCat(cat))
                    )}
                </div>

                <div className="h-5 bg-[#f0f0f0] border-t border-gray-300 px-2 flex items-center shrink-0">
                    <span className="text-[8px] font-bold text-gray-400 italic">Módulo: Menú de Platillos</span>
                </div>
            </div>

            {contextMenu && createPortal(
                <>
                    <div className="fixed inset-0 z-[99999]" onClick={() => setContextMenu(null)} />
                    <div className="fixed z-[100000] bg-[#f0f0f0] border border-gray-400 shadow-lg py-0.5 w-36"
                        style={{ top: contextMenu.y, left: contextMenu.x }}>
                        <button onClick={() => { handleOpenForm(null); setContextMenu(null); }}
                            className="w-full h-6 flex items-center gap-2 px-3 hover:bg-[#106ebe] hover:text-white text-[11px] text-slate-700">
                            <Plus size={11} /> Nuevo
                        </button>
                        {contextMenu.id && (
                            <>
                                <div className="h-px bg-gray-300 my-0.5" />
                                <button onClick={() => { handleOpenForm(contextMenu.id); setContextMenu(null); }}
                                    className="w-full h-6 flex items-center gap-2 px-3 hover:bg-[#106ebe] hover:text-white text-[11px] text-slate-700">
                                    <Edit2 size={11} /> Editar
                                </button>
                                <button onClick={() => handleDelete(contextMenu.id!, contextMenu.nombre!)}
                                    className="w-full h-6 flex items-center gap-2 px-3 hover:bg-red-500 hover:text-white text-[11px] text-red-600">
                                    <Trash2 size={11} /> Eliminar
                                </button>
                            </>
                        )}
                        <div className="h-px bg-gray-300 my-0.5" />
                        <button onClick={() => { load(); setContextMenu(null); }}
                            className="w-full h-6 flex items-center gap-2 px-3 hover:bg-[#106ebe] hover:text-white text-[11px] text-slate-700">
                            <RefreshCw size={11} /> Refrescar
                        </button>
                    </div>
                </>, document.body
            )}

            {/* Mantenimiento de Categorias Modal */}
            {form && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4 pointer-events-none">
                    <div className="absolute inset-0 pointer-events-auto" onClick={() => setForm(null)} />
                    <DraggableWindow id="menu-category-modal" title="Mantenimiento de Categorías">
                        <div className="bg-[#f0f0f0] border border-[#106ebe] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] w-[650px] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200 pointer-events-auto">
                            {/* Title Bar */}
                            <div className="bg-[#106ebe] h-8 px-3 flex justify-between items-center text-white shrink-0 modal-header cursor-move">
                            <div className="flex items-center gap-2">
                                <Folder size={14} className="text-white" />
                                <span className="text-[11px] font-bold uppercase tracking-tight">Mantenimiento de Categorías</span>
                            </div>
                            <div className="flex items-center h-full">
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                <button onClick={() => fileInputRef.current?.click()} className="h-full px-2.5 hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer relative" title="Subir Imagen" disabled={isUploading}>
                                    {isUploading ? <Loader2 size={16} className="text-white animate-spin" /> : <ImageIcon size={16} className="text-white" />}
                                </button>
                                <button onClick={handleSave} className="h-full px-2.5 hover:bg-white/10 transition-colors flex items-center justify-center" title="Guardar Datos (F2)">
                                    {isSaving ? <Loader2 size={16} className="text-white animate-spin" /> : <Save size={16} className="text-white" />}
                                </button>
                                <button onClick={() => setForm(null)} className="h-full px-3 hover:bg-red-500 transition-colors flex items-center" title="Cerrar">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Datos de Categoría */}
                            <fieldset className="border border-gray-300 p-3 pt-1 bg-white/50 relative">
                                <legend className="px-2 text-[10px] font-bold text-[#106ebe] uppercase italic">Datos de Categoría</legend>
                                <div className="space-y-3 mt-1 flex">
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-4">
                                            <label className="text-[10px] font-bold text-gray-600 w-24">Categoría</label>
                                            <div className="flex-1 flex flex-col gap-1.5">
                                                <input
                                                    type="text"
                                                    value={form.nombre}
                                                    onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })}
                                                    className="w-full h-7 bg-white border border-gray-400 px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-[#106ebe] focus:ring-1 focus:ring-[#106ebe]/20 shadow-inner"
                                                    autoFocus
                                                />
                                                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                                                    <div className="relative flex items-center justify-center w-3.5 h-3.5 bg-white border border-gray-400 group-hover:border-[#106ebe]">
                                                        <input 
                                                            type="checkbox" 
                                                            className="sr-only" 
                                                            checked={form.isSubCategory}
                                                            onChange={(e) => setForm({ ...form, isSubCategory: e.target.checked, parent_id: e.target.checked ? form.parent_id : null })}
                                                        />
                                                        {form.isSubCategory && <div className="w-2 h-2 bg-[#106ebe]" />}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase italic transition-colors group-hover:text-[#106ebe]">SubCategoría</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className={`flex items-center gap-4 transition-all duration-200 ${form.isSubCategory ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                                            <label className="text-[10px] font-bold text-gray-600 w-24">Categoría Padre</label>
                                            <div className="flex-1 relative">
                                                <div 
                                                    onClick={(e) => { e.stopPropagation(); if(form.isSubCategory) setShowParentSelect(!showParentSelect); }}
                                                    className="w-full h-7 bg-white border border-gray-400 px-2 flex items-center justify-between cursor-pointer"
                                                >
                                                    <span className="text-[11px] font-bold text-slate-800 truncate">
                                                        {categories.find(c => c.id === form.parent_id)?.nombre || '[ SELECCIONE CATEGORÍA PADRE ]'}
                                                    </span>
                                                    <span className="text-[8px] text-gray-400">▼</span>
                                                </div>

                                                {showParentSelect && (
                                                    <div className="absolute top-full left-0 right-0 z-[300000] bg-white border border-gray-400 shadow-xl max-h-[140px] overflow-y-auto custom-scrollbar mt-0.5">
                                                        <div 
                                                            onClick={() => { setForm({...form, parent_id: null}); setShowParentSelect(false); }}
                                                            className="px-2 py-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50 cursor-pointer border-b border-gray-100 uppercase"
                                                        >
                                                            [ CATEGORÍA RAÍZ ]
                                                        </div>
                                                        {categories.filter(c => c.id !== form.id && !(c as any).parent_id).map(c => (
                                                            <div 
                                                                key={c.id}
                                                                onClick={() => { setForm({...form, parent_id: c.id}); setShowParentSelect(false); }}
                                                                className={`px-2 py-1 text-[10px] font-bold uppercase cursor-pointer hover:bg-[#106ebe] hover:text-white ${form.parent_id === c.id ? 'bg-[#106ebe] text-white' : 'text-slate-700'}`}
                                                            >
                                                                {c.nombre}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <label className="text-[10px] font-bold text-gray-600 w-24">Prioridad</label>
                                            <input 
                                                type="number"
                                                value={form.sort_order}
                                                onChange={e => setForm({...form, sort_order: parseInt(e.target.value) || 0})}
                                                className="w-full flex-1 h-7 bg-white border border-gray-400 px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-[#106ebe] text-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="w-[120px] ml-4 flex flex-col justify-between">
                                        <div className="w-full h-[100px] border border-gray-300 bg-gray-100 flex items-center justify-center relative overflow-hidden group">
                                            {form.imagen_url ? (
                                                <img src={form.imagen_url} alt="C" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-gray-400 flex flex-col items-center">
                                                    <ImageIcon size={24} />
                                                    <span className="text-[10px] mt-1 font-bold">SIN IMAGEN</span>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => setForm(prev => prev ? {...prev, imagen_url: ''} : null)} className="w-full h-6 bg-[#106ebe] text-white text-[9px] font-bold uppercase hover:bg-[#0d5aa0]">
                                            Quitar Imagen
                                        </button>
                                    </div>
                                </div>
                            </fieldset>

                            <fieldset className="border border-gray-300 p-0 bg-white shadow-sm overflow-hidden">
                                <legend className="px-2 ml-3 text-[10px] font-bold text-[#106ebe] uppercase italic bg-white border border-gray-300 border-b-white">Sucursales</legend>
                                <div className="max-h-[160px] overflow-auto custom-scrollbar">
                                    <table className="w-full border-collapse">
                                        <thead className="sticky top-0 bg-[#f5f5f5] z-10">
                                            <tr className="h-6 border-b border-gray-300">
                                                <th className="px-4 text-[9px] font-black text-gray-500 uppercase text-left border-r border-gray-200">Sucursal</th>
                                                <th className="px-4 text-[9px] font-black text-gray-500 uppercase text-center border-r border-gray-200 w-24">Habilitado</th>
                                                <th className="px-4 text-[9px] font-black text-gray-500 uppercase text-center w-36">Asignado a Sucursal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {branches.map(branch => {
                                                const isAssigned = form.branch_ids.includes(branch.id);
                                                return (
                                                    <tr key={branch.id} className="h-7 hover:bg-blue-50/50 transition-colors group cursor-pointer" onClick={() => {
                                                        const next = isAssigned 
                                                            ? form.branch_ids.filter(id => id !== branch.id)
                                                            : [...form.branch_ids, branch.id];
                                                        setForm({...form, branch_ids: next});
                                                    }}>
                                                        <td className="px-4 text-[10px] font-bold text-slate-700 uppercase">{branch.name}</td>
                                                        <td className="px-4 border-r border-gray-100">
                                                            <div className="flex justify-center">
                                                                <div className="w-3.5 h-3.5 border border-gray-400 bg-white flex items-center justify-center">
                                                                    <div className="w-1.5 h-1.5 bg-gray-400" />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4">
                                                            <div className="flex justify-center">
                                                                <div className="relative flex items-center justify-center w-3.5 h-3.5 bg-white border border-[#106ebe]">
                                                                    {isAssigned && <div className="w-2 h-2 bg-[#106ebe]" />}
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
                    </div>
                    </DraggableWindow>
                </div>, document.body
            )}
        </>
    );
};
