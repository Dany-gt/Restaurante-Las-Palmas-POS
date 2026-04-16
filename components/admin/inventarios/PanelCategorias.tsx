import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Folder, FolderOpen, Package, Plus, Edit2, Trash2, X, RefreshCw, Save } from 'lucide-react';
import { supabase } from '../../../supabase';
import { useNotify } from '../../../hooks/useNotify';

interface Category {
    id: string;
    name: string;
    parent_id: string | null;
    branch_ids: string[];
}

interface PanelCategoriasProps {
    tipo: 'menu' | 'productos';
    onSelect: (ids: Set<string>) => void;
    seleccionadas: Set<string>;
    sucursalId?: string;
}

export const PanelCategorias: React.FC<PanelCategoriasProps> = ({ tipo, onSelect, seleccionadas, sucursalId }) => {
    const notify = useNotify();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // Context Menu
    const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, category: Category | null }>({ visible: false, x: 0, y: 0, category: null });

    // Modal State
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [categoryForm, setCategoryForm] = useState({ 
        name: '', 
        parent_id: '' as string | null,
        isSubCategory: false,
        branch_ids: [] as string[]
    });
    const [showParentSelect, setShowParentSelect] = useState(false);
    const [branches, setBranches] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Eliminamos la lógica de tablas múltiples para usar solo 'categories' con filtro de sección

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('id, name, parent_id, branch_ids')
                .eq('section', tipo === 'menu' ? 'VENTA' : 'INVENTARIO')
                .order('name');

            if (data) {
                setCategories(data);
                const allIds = data.map(c => c.id);
                setExpanded(new Set(allIds));
            }
            if (error) console.error(`Error fetching categories for ${tipo}:`, error.message);
            
            // Cargar sucursales para el modal
            const { data: brData } = await supabase.from('branches').select('id, name').order('name');
            if (brData) setBranches(brData);

        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [tipo]);

    useEffect(() => {
        const hideMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', hideMenu);
        return () => window.removeEventListener('click', hideMenu);
    }, []);

    const getAllChildren = (id: string, allCats: Category[]): string[] => {
        let children: string[] = [];
        const direct = allCats.filter(c => c.parent_id === id);
        direct.forEach(child => {
            children.push(child.id);
            children = [...children, ...getAllChildren(child.id, allCats)];
        });
        return children;
    };

    const handleSelect = (catId: string) => {
        const next = new Set(seleccionadas);
        const children = getAllChildren(catId, categories);
        
        if (next.has(catId)) {
            next.delete(catId);
            children.forEach(id => next.delete(id));
        } else {
            next.add(catId);
            children.forEach(id => next.add(id));
        }
        
        onSelect(next);
    };

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expanded);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpanded(newExpanded);
    };

    const handleContextMenu = (e: React.MouseEvent, cat: Category | null) => {
        e.preventDefault();
        e.stopPropagation();
        const menuWidth = 190;
        const menuHeight = 140;
        let x = e.clientX;
        let y = e.clientY;
        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
        setContextMenu({ visible: true, x, y, category: cat });
    };

    const handleSaveCategory = async () => {
        if (!categoryForm.name.trim()) return;
        setIsSaving(true);
        const payload = {
            name: categoryForm.name.toUpperCase(),
            parent_id: categoryForm.isSubCategory ? categoryForm.parent_id : null,
            section: tipo === 'menu' ? 'VENTA' : 'INVENTARIO',
            branch_ids: categoryForm.branch_ids
        };
        const { error } = editingCategory
            ? await supabase.from('categories').update(payload).eq('id', editingCategory.id)
            : await supabase.from('categories').insert([payload]);

        if (error) {
            notify.error('Error al guardar: ' + error.message);
        } else {
            notify.success('Categoría guardada');
            setShowCategoryModal(false);
            fetchCategories();
        }
        setIsSaving(false);
    };

    const handleDeleteCategory = async (cat: Category) => {
        if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
        const { error } = await supabase.from('categories').delete().eq('id', cat.id);
        if (error) {
            notify.error('Error al eliminar: ' + error.message);
        } else {
            notify.success('Categoría eliminada');
            fetchCategories();
        }
    };

    useEffect(() => {
        const handleClickOutside = () => setShowParentSelect(false);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const renderTree = (parentId: string | null = null, depth = 0): React.ReactNode => {
        return categories
            .filter(c => c.parent_id === parentId)
            .map(cat => {
                const hasChildren = categories.some(c => c.parent_id === cat.id);
                const isExpanded = expanded.has(cat.id);
                const isSelected = seleccionadas.has(cat.id);

                return (
                    <div key={cat.id} className="flex flex-col">
                        <div
                            className={`flex items-center h-[22px] cursor-pointer select-none transition-none ${isSelected ? 'bg-blue-50 text-[#106ebe]' : 'hover:bg-[#cce8ff] text-slate-800'}`}
                            style={{ paddingLeft: `${depth * 14 + 4}px` }}
                            onClick={(e) => { e.stopPropagation(); handleSelect(cat.id); }}
                            onContextMenu={(e) => handleContextMenu(e, cat)}
                        >
                            {/* Flecha de Expansión (Solo si tiene hijos) */}
                            <div 
                                className="w-4 h-full flex items-center justify-center cursor-pointer hover:bg-black/5"
                                onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id); }}
                            >
                                {hasChildren && (
                                    <span className="text-[8px] text-gray-400">
                                        {isExpanded ? '▼' : '▶'}
                                    </span>
                                )}
                            </div>

                            {/* Checkbox (El Cuadrito) */}
                            <div className="w-[18px] h-full flex items-center justify-center mr-1">
                                <div className={`w-3.5 h-3.5 border border-gray-400 bg-white flex items-center justify-center ${isSelected ? 'border-[#106ebe]' : ''}`}>
                                    {isSelected && <div className="w-2 h-2 bg-[#106ebe]" />}
                                </div>
                            </div>

                            <span className={`text-[10px] uppercase truncate leading-none ${isSelected ? 'font-bold' : ''}`}>
                                {cat.name}
                            </span>
                        </div>

                        {hasChildren && isExpanded && renderTree(cat.id, depth + 1)}
                    </div>
                );
            });
    };

    return (
        <>
            <div
                className="w-[200px] flex flex-col bg-white border-r border-gray-300 h-full shadow-sm shrink-0"
                onContextMenu={(e) => handleContextMenu(e, null)}
            >
                {/* Header */}
                <div className="bg-[#106ebe] h-[26px] px-2 flex items-center border-b border-[#004578]">
                    <span className="text-[10px] font-bold text-white uppercase tracking-tight">
                        Categorías de {tipo === 'menu' ? 'Menú' : 'Inventario'}
                    </span>
                </div>

                {/* Column Header */}
                <div className="bg-[#f0f0f0] h-6 px-2 flex items-center border-b border-gray-300">
                    <span className="text-[9px] font-bold text-gray-500 uppercase">Categoría</span>
                </div>

                {/* Tree */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                    {loading ? (
                        <div className="p-4 flex justify-center">
                            <div className="w-4 h-4 border-2 border-[#106ebe] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="py-0.5">
                            {renderTree()}
                        </div>
                    )}
                </div>

                <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
                `}</style>
            </div>

            {/* Context Menu */}
            {contextMenu.visible && createPortal(
                <>
                    <div className="fixed inset-0 z-[99999]" onClick={() => setContextMenu({ ...contextMenu, visible: false })} />
                    <div
                        className="fixed z-[100000] bg-[#f0f0f0] border border-gray-400 shadow-[2px_2px_5px_rgba(0,0,0,0.2)] py-0.5 w-36 select-none"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => {
                                setContextMenu({ ...contextMenu, visible: false });
                                setEditingCategory(null);
                                setCategoryForm({ 
                                    name: '', 
                                    parent_id: contextMenu.category?.id || null,
                                    isSubCategory: !!contextMenu.category?.id,
                                    branch_ids: [] 
                                });
                                setShowCategoryModal(true);
                            }}
                            className="w-full h-6 flex items-center gap-3 px-3 hover:bg-[#106ebe] hover:text-white transition-none text-slate-800"
                        >
                            <Plus size={13} className="shrink-0" />
                            <span className="text-[11px] font-medium">Nuevo</span>
                        </button>

                        {contextMenu.category && (
                            <>
                                <button
                                    onClick={() => {
                                        setContextMenu({ ...contextMenu, visible: false });
                                        setEditingCategory(contextMenu.category);
                                        setCategoryForm({ 
                                            name: contextMenu.category?.name || '', 
                                            parent_id: contextMenu.category?.parent_id || null,
                                            isSubCategory: !!contextMenu.category?.parent_id,
                                            branch_ids: contextMenu.category?.branch_ids || []
                                        });
                                        setShowCategoryModal(true);
                                    }}
                                    className="w-full h-6 flex items-center gap-3 px-3 hover:bg-[#106ebe] hover:text-white transition-none text-slate-800"
                                >
                                    <Edit2 size={13} className="shrink-0" />
                                    <span className="text-[11px] font-medium">Editar</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (contextMenu.category) handleDeleteCategory(contextMenu.category);
                                        setContextMenu({ ...contextMenu, visible: false });
                                    }}
                                    className="w-full h-6 flex items-center gap-3 px-3 hover:bg-red-500 hover:text-white transition-none text-red-600 hover:text-white"
                                >
                                    <Trash2 size={13} className="shrink-0" />
                                    <span className="text-[11px] font-medium">Eliminar</span>
                                </button>
                            </>
                        )}
                        
                        <div className="h-px bg-gray-300 my-0.5 mx-1" />

                        <button
                            onClick={() => {
                                fetchCategories();
                                setContextMenu({ ...contextMenu, visible: false });
                            }}
                            className="w-full h-6 flex items-center gap-3 px-3 hover:bg-[#106ebe] hover:text-white transition-none text-slate-800"
                        >
                            <RefreshCw size={13} className="shrink-0 text-blue-600 group-hover:text-white" />
                            <span className="text-[11px] font-medium">Refrescar</span>
                        </button>
                    </div>
                </>,
                document.body
            )}

            {/* Category Modal - Redesign Based on Desktop UI */}
            {showCategoryModal && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4">
                    <div className="absolute inset-0" onClick={() => setShowCategoryModal(false)} />
                    <div className="bg-[#f0f0f0] border border-[#106ebe] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] w-[650px] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
                        {/* Custom Title Bar */}
                        <div className="bg-[#106ebe] h-8 px-3 flex justify-between items-center text-white shrink-0 cursor-move">
                            <div className="flex items-center gap-2">
                                <Folder size={14} className="text-white" />
                                <span className="text-[11px] font-bold uppercase tracking-tight">Mantenimiento de Categorías</span>
                            </div>
                            <div className="flex items-center h-full">
                                <button 
                                    onClick={handleSaveCategory}
                                    className="h-full px-2.5 hover:bg-white/10 transition-colors flex items-center justify-center"
                                    title="Guardar Datos (F2)"
                                >
                                    <Save size={16} className="text-white" />
                                </button>
                                <button 
                                    onClick={() => setShowCategoryModal(false)}
                                    className="h-full px-3 hover:bg-red-500 transition-colors flex items-center"
                                    title="Cerrar"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Datos de Categoría */}
                            <fieldset className="border border-gray-300 p-3 pt-1 bg-white/50">
                                <legend className="px-2 text-[10px] font-bold text-[#106ebe] uppercase italic">Datos de Categoría</legend>
                                <div className="space-y-3 mt-1">
                                    <div className="flex items-center gap-4">
                                        <label className="text-[10px] font-bold text-gray-600 w-24">Categoría</label>
                                        <div className="flex-1 flex flex-col gap-1.5">
                                            <input
                                                type="text"
                                                value={categoryForm.name}
                                                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value.toUpperCase() })}
                                                className="w-full h-7 bg-white border border-gray-400 px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-[#106ebe] focus:ring-1 focus:ring-[#106ebe]/20 shadow-inner"
                                                autoFocus
                                            />
                                            <label className="flex items-center gap-2 cursor-pointer group w-fit">
                                                <div className="relative flex items-center justify-center w-3.5 h-3.5 bg-white border border-gray-400 group-hover:border-[#106ebe]">
                                                    <input 
                                                        type="checkbox" 
                                                        className="sr-only" 
                                                        checked={categoryForm.isSubCategory}
                                                        onChange={(e) => setCategoryForm({ ...categoryForm, isSubCategory: e.target.checked, parent_id: e.target.checked ? categoryForm.parent_id : null })}
                                                    />
                                                    {categoryForm.isSubCategory && <div className="w-2 h-2 bg-[#106ebe]" />}
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-500 uppercase italic transition-colors group-hover:text-[#106ebe]">SubCategoría</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className={`flex items-center gap-4 transition-all duration-200 ${categoryForm.isSubCategory ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                                        <label className="text-[10px] font-bold text-gray-600 w-24">Categoría Padre</label>
                                        <div className="flex-1 relative">
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); if(categoryForm.isSubCategory) setShowParentSelect(!showParentSelect); }}
                                                className="w-full h-7 bg-white border border-gray-400 px-2 flex items-center justify-between cursor-pointer"
                                            >
                                                <span className="text-[11px] font-bold text-slate-800 truncate">
                                                    {categories.find(c => c.id === categoryForm.parent_id)?.name || '[ SELECCIONE CATEGORÍA PADRE ]'}
                                                </span>
                                                <span className="text-[8px] text-gray-400">▼</span>
                                            </div>

                                            {showParentSelect && (
                                                <div className="absolute top-full left-0 right-0 z-[300000] bg-white border border-gray-400 shadow-xl max-h-[140px] overflow-y-auto custom-scrollbar mt-0.5">
                                                    <div 
                                                        onClick={() => { setCategoryForm({...categoryForm, parent_id: null}); setShowParentSelect(false); }}
                                                        className="px-2 py-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50 cursor-pointer border-b border-gray-100 uppercase"
                                                    >
                                                        [ CATEGORÍA RAÍZ ]
                                                    </div>
                                                    {categories.filter(c => c.id !== editingCategory?.id).map(c => (
                                                        <div 
                                                            key={c.id}
                                                            onClick={() => { setCategoryForm({...categoryForm, parent_id: c.id}); setShowParentSelect(false); }}
                                                            className={`px-2 py-1 text-[10px] font-bold uppercase cursor-pointer hover:bg-[#106ebe] hover:text-white ${categoryForm.parent_id === c.id ? 'bg-[#106ebe] text-white' : 'text-slate-700'}`}
                                                        >
                                                            {c.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </fieldset>

                            {/* Sucursales */}
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
                                                const isAssigned = categoryForm.branch_ids.includes(branch.id);
                                                return (
                                                    <tr key={branch.id} className="h-7 hover:bg-blue-50/50 transition-colors group cursor-pointer" onClick={() => {
                                                        const next = isAssigned 
                                                            ? categoryForm.branch_ids.filter(id => id !== branch.id)
                                                            : [...categoryForm.branch_ids, branch.id];
                                                        setCategoryForm({...categoryForm, branch_ids: next});
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

                        {/* Status Bar style footer */}
                        <div className="h-6 bg-[#f0f0f0] border-t border-gray-300 px-3 flex items-center justify-between shrink-0">
                            <span className="text-[9px] font-bold text-gray-400 italic">Estado: Listo...</span>
                            <span className="text-[9px] font-bold text-[#106ebe] font-mono tracking-tighter uppercase">{tipo === 'menu' ? 'Módulo Menú' : 'Módulo Insumos'}</span>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
