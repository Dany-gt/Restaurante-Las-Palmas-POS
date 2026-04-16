import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Search, RotateCcw, Loader2, ListFilter, ArrowUpDown, Filter, Plus, Edit3, Trash2, X, Check, Baseline,
    Folder, FolderOpen, Package, Layers, ClipboardCheck, ChevronRight, ChevronDown, Save, Trash, Square, CheckSquare
} from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';

export const DishesModifiersAssign: React.FC = () => {
    const notify = useNotify();
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [modifierGroups, setModifierGroups] = useState<any[]>([]);

    // UI State
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [searchCategory, setSearchCategory] = useState('');
    const [searchProduct, setSearchProduct] = useState('');

    // Assignment State
    const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<any[]>([]);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; type: 'products' | 'groups' | null }>({
        visible: false,
        x: 0,
        y: 0,
        type: null
    });

    // Picker State
    const [showPicker, setShowPicker] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [catRes, prodRes, groupRes] = await Promise.all([
            supabase.from('categories').select('*').order('name'),
            supabase.from('products').select('*, categories(name)').order('name'),
            supabase.from('modifier_groups').select('*').order('name')
        ]);

        if (catRes.data) {
            setCategories(catRes.data);
            // Default to first top-level category
            const firstCat = catRes.data.filter(c => !c.parent_id)[0];
            if (firstCat) setSelectedCategories(new Set([firstCat.id]));
        }
        if (prodRes.data) setProducts(prodRes.data);
        if (groupRes.data) setModifierGroups(groupRes.data);
        setLoading(false);
    };

    const handleContextMenu = (e: React.MouseEvent, type: 'products' | 'groups') => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            type
        });
    };

    const toggleCategory = (id: string) => {
        const next = new Set(expandedCategories);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedCategories(next);
    };

    const toggleCategorySelection = (id: string) => {
        const next = new Set(selectedCategories);
        const isCurrentlyChecked = next.has(id);

        const setAllChildren = (parentId: string, check: boolean) => {
            const children = categories.filter(c => c.parent_id === parentId);
            children.forEach(c => {
                if (check) next.add(c.id);
                else next.delete(c.id);
                setAllChildren(c.id, check);
            });
        };

        if (isCurrentlyChecked) {
            next.delete(id);
            setAllChildren(id, false);
            let parentId = categories.find(c => c.id === id)?.parent_id;
            while (parentId) {
                next.delete(parentId);
                parentId = categories.find(c => c.id === parentId)?.parent_id;
            }
        } else {
            next.add(id);
            setAllChildren(id, true);
        }
        setSelectedCategories(next);
    };

    const renderCategoryTree = (parentId: string | null = null, depth = 0) => {
        return categories
            .filter(c => c.parent_id === parentId)
            .filter(c => c.name.toLowerCase().includes(searchCategory.toLowerCase()))
            .map(cat => {
                const hasChildren = categories.some(c => c.parent_id === cat.id);
                const isExpanded = expandedCategories.has(cat.id);
                const isSelected = selectedCategories.has(cat.id);

                return (
                    <div key={cat.id} className="flex flex-col select-none">
                        <div className="flex items-center group/cat">
                            <div
                                onClick={() => toggleCategorySelection(cat.id)}
                                className={`flex-1 flex items-center gap-1.5 px-3 py-1 text-left truncate cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50' : 'text-slate-800 hover:bg-slate-100'}`}
                            >
                                <div style={{ paddingLeft: `${depth * 12}px` }} className="flex items-center gap-1.5 flex-1 min-w-0">
                                    {hasChildren ? (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleCategory(cat.id); }} 
                                            className="w-4 h-4 flex items-center justify-center hover:bg-slate-200 rounded-sm"
                                        >
                                            {isExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                                        </button>
                                    ) : (
                                        <div className="w-4" />
                                    )}
                                    <div className="flex items-center justify-center">
                                        {isSelected ? <CheckSquare size={14} className="text-[#106ebe]" /> : <Square size={14} className="text-slate-400" />}
                                    </div>
                                    <span className={`text-[11px] uppercase truncate ${hasChildren ? 'font-bold' : ''} ${isSelected ? 'text-[#106ebe] font-bold' : 'text-slate-700'}`}>
                                        {cat.name}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {hasChildren && isExpanded && (
                            <div className="mt-0.5">
                                {renderCategoryTree(cat.id, depth + 1)}
                            </div>
                        )}
                    </div>
                );
            });
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
            (p.product_code && p.product_code.toLowerCase().includes(searchProduct.toLowerCase()));
        
        // Match if product's category is in selected categories, or if its parent category is in selected categories (though toggleCategorySelection covers expanding parents)
        const matchesCategory = selectedCategories.size > 0 
            ? selectedCategories.has(p.category_id) || categories.find(c => c.id === p.category_id)?.parent_id && selectedCategories.has(categories.find(c => c.id === p.category_id)!.parent_id as string)
            : true;
        
        return matchesSearch && matchesCategory;
    });

    const handleAddProduct = (prod: any) => {
        if (selectedProducts.find(p => p.id === prod.id)) {
            notify.info("Este platillo ya se encuentra en el listado.");
            return;
        }
        setSelectedProducts([...selectedProducts, prod]);
    };

    const handleRemoveProduct = (id: string) => {
        setSelectedProducts(selectedProducts.filter(p => p.id !== id));
    };

    const handleAddGroup = (group: any) => {
        if (selectedGroups.find(g => g.id === group.id)) {
            notify.info("Este grupo ya se encuentra en el listado.");
            setShowPicker(false);
            return;
        }
        setSelectedGroups([...selectedGroups, { ...group, min_selection: 0, max_selection: 1 }]);
        setShowPicker(false);
    };

    const handleRemoveGroup = (id: string) => {
        setSelectedGroups(selectedGroups.filter(g => g.id !== id));
    };

    const handleUpdateGroupSelections = (id: string, field: string, value: number) => {
        setSelectedGroups(selectedGroups.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const handleSave = async () => {
        if (selectedProducts.length === 0) {
            notify.error('Seleccione al menos un platillo');
            return;
        }
        if (selectedGroups.length === 0) {
            notify.error('Seleccione al menos un grupo de modificadores');
            return;
        }

        setLoading(true);
        try {
            // Process each product
            for (const prod of selectedProducts) {
                // Upsert each group for each product
                const assignments = selectedGroups.map(group => ({
                    product_id: prod.id,
                    group_id: group.id,
                    min_selection: group.min_selection,
                    max_selection: group.max_selection
                }));

                const { error } = await supabase
                    .from('product_modifier_groups')
                    .upsert(assignments, { onConflict: 'product_id,group_id' });

                if (error) throw error;
            }

            notify.success('Asignación masiva completada con éxito');
            setSelectedProducts([]);
            setSelectedGroups([]);
        } catch (error: any) {
            notify.error('Error al guardar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const pickerFilteredGroups = modifierGroups.filter(g =>
        g.name.toLowerCase().includes(pickerSearch.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-[#f0f0f0] font-['Montserrat'] overflow-hidden p-1 gap-1">
            {/* Main Panels */}
            <div className="flex-1 flex gap-1 overflow-hidden">

                {/* 1. Categorías Left sidebar */}
                <aside className="w-[280px] flex flex-col shrink-0 bg-white border border-gray-300 shadow-sm overflow-hidden rounded-sm">
                    <div className="bg-[#f0f0f0] px-3 py-1.5 flex items-center gap-2 border-b border-gray-300">
                        <span className="text-slate-800 text-[11px] font-bold uppercase tracking-widest">Categorías de Menú</span>
                    </div>
                    <div className="p-1 border-b border-gray-300 bg-[#f8f8f8]">
                        <div className="flex items-center bg-white border border-gray-300">
                            <div className="px-2 text-slate-400 border-r border-gray-300 bg-gray-50 text-[10px] h-[22px] flex items-center">
                                Categoría
                            </div>
                            <input
                                type="text"
                                value={searchCategory}
                                onChange={e => setSearchCategory(e.target.value)}
                                placeholder="..."
                                className="w-full px-2 py-0.5 text-[10px] font-bold text-slate-700 outline-none uppercase h-[22px]"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-1 custom-scrollbar">
                        {renderCategoryTree()}
                    </div>
                </aside>

                {/* 2. Listado de Platillos Middle Panel */}
                <section className="flex-1 flex flex-col bg-white border border-gray-300 shadow-sm overflow-hidden rounded-sm">
                    <div className="bg-[#f0f0f0] px-3 py-1.5 flex items-center justify-between border-b border-gray-300">
                        <div className="flex items-center gap-2">
                            <Layers size={14} className="text-[#106ebe]" />
                            <span className="text-slate-800 text-[11px] font-bold uppercase tracking-widest">Listado de Platillos</span>
                        </div>
                        <button
                            onClick={() => setSelectedCategories(new Set())}
                            className="bg-white text-[#106ebe] px-3 py-0.5 text-[9px] font-black uppercase rounded-sm border border-gray-300 hover:bg-gray-100 transition-colors"
                        >
                            Mostrar Todos
                        </button>
                    </div>
                    <div className="p-2 border-b border-gray-200 flex gap-1">
                        <div className="relative group flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                            <input
                                type="text"
                                value={searchProduct}
                                onChange={e => setSearchProduct(e.target.value)}
                                placeholder="INTRODUZCA EL TEXTO A BUSCAR..."
                                className="w-full pl-7 pr-2 py-1 text-[10px] border border-gray-300 outline-none focus:border-[#106ebe] uppercase font-bold text-slate-700"
                            />
                        </div>
                        <button className="bg-[#106ebe] text-white px-4 text-[10px] font-bold uppercase hover:bg-[#002244] transition-colors rounded-sm">Buscar</button>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 bg-[#e8e8e8] z-10 shadow-sm">
                                <tr className="h-7 border-b border-gray-300 text-[10px] font-bold uppercase text-slate-700">
                                    <th className="px-4 text-left border-r border-gray-200">Platillo</th>
                                    <th className="px-4 text-right w-32 border-r border-gray-200">Precio Venta</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map(prod => (
                                    <tr
                                        key={prod.id}
                                        className="h-7 border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer text-[10px] font-bold text-[#106ebe] uppercase"
                                        onClick={() => handleAddProduct(prod)}
                                    >
                                        <td className="px-4 border-r border-gray-100">{prod.name}</td>
                                        <td className="px-4 text-right border-r border-gray-100">Q{Number(prod.price || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* 3. Assignment Panels Right column */}
                <div className="w-[450px] flex flex-col gap-1 shrink-0 overflow-hidden">

                    {/* Top Right: Platillos a Aplicar */}
                    <div
                        className="flex-1 flex flex-col bg-white border border-gray-300 shadow-sm overflow-hidden rounded-sm"
                        onContextMenu={(e) => handleContextMenu(e, 'products')}
                    >
                        <div className="bg-[#106ebe] px-3 py-1.5 flex items-center gap-2">
                            <Check size={14} className="text-white" />
                            <span className="text-white text-[10px] font-black uppercase tracking-tight">Platillos a Aplicar</span>
                            <span className="ml-auto text-white/70 text-[10px] font-bold uppercase">{selectedProducts.length}</span>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 bg-[#f8f9fa] z-10 shadow-sm">
                                    <tr className="h-7 border-b border-gray-300 text-[9px] font-black uppercase text-slate-500">
                                        <th className="px-4 text-left">Platillo</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedProducts.map(prod => (
                                        <tr key={prod.id} className="h-7 border-b border-gray-50 group">
                                            <td className="px-4 text-[10px] font-bold text-[#106ebe] uppercase">{prod.name}</td>
                                            <td className="px-2 text-center">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveProduct(prod.id); }}
                                                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {selectedProducts.length === 0 && (
                                        <tr><td className="p-8 text-center text-[10px] font-bold text-slate-400 italic uppercase">Haga clic en un platillo para añadirlo</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bottom Right: Modificadores a Aplicar */}
                    <div
                        className="flex-1 flex flex-col bg-white border border-gray-300 shadow-sm overflow-hidden rounded-sm"
                        onContextMenu={(e) => handleContextMenu(e, 'groups')}
                    >
                        <div className="bg-[#106ebe] px-3 py-1.5 flex items-center gap-2">
                            <ClipboardCheck size={14} className="text-white" />
                            <span className="text-white text-[10px] font-black uppercase tracking-tight">Modificadores a Aplicar</span>
                            <button
                                onClick={() => setShowPicker(true)}
                                className="ml-auto p-1 text-white hover:bg-white/20 rounded-sm transition-colors"
                            >
                                <Plus size={14} />
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading || selectedProducts.length === 0 || selectedGroups.length === 0}
                                className="p-1 px-3 bg-white text-[#106ebe] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm text-[9px] font-black uppercase shadow-sm transition-all flex items-center gap-1.5"
                            >
                                <Save size={14} />
                                <span>Guardar</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 bg-[#f8f9fa] z-10 shadow-sm">
                                    <tr className="h-7 border-b border-gray-300 text-[9px] font-black uppercase text-slate-500">
                                        <th className="px-4 text-left">Grupo de Modificadores</th>
                                        <th className="w-16 text-center">Min</th>
                                        <th className="w-16 text-center">Max</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedGroups.map(group => (
                                        <tr key={group.id} className="h-9 border-b border-gray-50">
                                            <td className="px-4 text-[10px] font-bold text-[#106ebe] uppercase">{group.name}</td>
                                            <td className="px-1 text-center">
                                                <input
                                                    type="number"
                                                    value={group.min_selection}
                                                    onChange={e => handleUpdateGroupSelections(group.id, 'min_selection', parseInt(e.target.value) || 0)}
                                                    className="w-10 h-6 border border-gray-200 text-[10px] font-bold text-center outline-none focus:border-[#106ebe]"
                                                />
                                            </td>
                                            <td className="px-1 text-center">
                                                <input
                                                    type="number"
                                                    value={group.max_selection}
                                                    onChange={e => handleUpdateGroupSelections(group.id, 'max_selection', parseInt(e.target.value) || 0)}
                                                    className="w-10 h-6 border border-gray-200 text-[10px] font-bold text-center outline-none focus:border-[#106ebe]"
                                                />
                                            </td>
                                            <td className="px-2 text-center text-slate-300 hover:text-red-500 cursor-pointer" onClick={() => handleRemoveGroup(group.id)}>
                                                <Trash2 size={12} />
                                            </td>
                                        </tr>
                                    ))}
                                    {selectedGroups.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-[10px] font-bold text-slate-400 italic uppercase">Añada grupos de modificadores</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu.visible && createPortal(
                <div
                    className="fixed z-[100000] w-48 bg-white border border-gray-300 shadow-xl py-1 select-none animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    {contextMenu.type === 'products' ? (
                        <button
                            onClick={() => setSelectedProducts([])}
                            className="w-full h-8 px-4 flex items-center gap-3 hover:bg-red-600 hover:text-white text-slate-700 text-[10px] font-bold uppercase transition-colors group"
                        >
                            <Trash size={14} className="text-red-500 group-hover:text-inherit" />
                            Limpiar Selección
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowPicker(true)}
                                className="w-full h-8 px-4 flex items-center gap-3 hover:bg-[#106ebe] hover:text-white text-slate-700 text-[10px] font-bold uppercase transition-colors group"
                            >
                                <Plus size={14} className="text-green-600 group-hover:text-inherit" />
                                Añadir Grupo
                            </button>
                            <div className="h-px bg-gray-100 my-1" />
                            <button
                                onClick={() => setSelectedGroups([])}
                                className="w-full h-8 px-4 flex items-center gap-3 hover:bg-red-600 hover:text-white text-slate-700 text-[10px] font-bold uppercase transition-colors group"
                            >
                                <Trash2 size={14} className="text-red-500 group-hover:text-inherit" />
                                Limpiar Grupos
                            </button>
                        </>
                    )}
                </div>,
                document.body
            )}

            {/* Status Info Bar */}
            <footer className="h-6 bg-white border border-gray-300 rounded-sm flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic flex items-center gap-1.5">
                        <Baseline size={10} /> Páladar POS - Asignación Masiva
                    </span>
                </div>
                <div className="flex items-center gap-4 divide-x divide-gray-200">
                    <span className="text-[10px] font-black text-[#106ebe] uppercase px-4">{filteredProducts.length} Platos disponibles</span>
                    <span className="text-[10px] font-black text-emerald-600 uppercase px-4">{selectedProducts.length} Seleccionados</span>
                </div>
            </footer>

            {/* Picker Modal for Modifiers */}
            {showPicker && createPortal(
                <div className="fixed inset-0 z-[100000] flex items-center justify-center pointer-events-none p-4">
                    <div className="absolute inset-0 bg-black/5 pointer-events-auto" onClick={() => setShowPicker(false)}></div>
                    <div className="pointer-events-auto">
                        <DraggableWindow>
                            <div className="w-[500px] h-[500px] bg-white border border-[#106ebe] shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="modal-header bg-[#106ebe] h-8 px-3 flex items-center justify-between text-white shrink-0 cursor-move">
                                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase">
                                        <ListFilter size={14} /> Seleccionar Grupo de Modificadores
                                    </div>
                                    <button onClick={() => setShowPicker(false)} className="hover:bg-red-500 p-1 transition-colors"><X size={16} /></button>
                                </div>
                                <div className="p-2 border-b border-gray-200 bg-[#f8f9fa]">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                        <input
                                            autoFocus
                                            type="text"
                                            value={pickerSearch}
                                            onChange={e => setPickerSearch(e.target.value)}
                                            placeholder="Buscar grupo..."
                                            className="w-full pl-7 pr-2 py-1.5 text-[10px] border border-gray-300 outline-none focus:border-[#106ebe] uppercase font-bold text-slate-700"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-1 custom-scrollbar">
                                    <div className="grid grid-cols-1 gap-1">
                                        {pickerFilteredGroups.map(group => (
                                            <button
                                                key={group.id}
                                                onClick={() => handleAddGroup(group)}
                                                className="flex items-center gap-3 w-full p-2 hover:bg-blue-50 text-left border border-transparent hover:border-blue-100 group transition-all"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[#106ebe] group-hover:bg-white shadow-sm">
                                                    <Layers size={14} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-bold text-[#106ebe] uppercase truncate">{group.name}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase truncate italic">{group.group_prompt || 'Sin Prompt'}</p>
                                                </div>
                                                <ChevronRight size={14} className="text-slate-300" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
