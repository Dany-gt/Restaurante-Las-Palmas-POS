import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Search, RotateCcw, Loader2, ListFilter, ArrowUpDown, Filter, Plus, Edit3, Trash2, X, Check, Baseline,
    Folder, FolderOpen, Package, Layers, ClipboardCheck, ChevronRight, ChevronDown, Save, Trash, Square, CheckSquare
} from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';
import { CategorySidebar } from './shared/CategorySidebar';

export const DishesModifiersAssign: React.FC = () => {
    const notify = useNotify();
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [modifierGroups, setModifierGroups] = useState<any[]>([]);

    const [selectedBranch, setSelectedBranch] = useState<string>(() => {
        const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        return cachedUser?.branch_id || 'all';
    });
    const [branches, setBranches] = useState<any[]>([]);

    // UI State
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('pos_sidebar_width_modifiers');
        return saved ? parseInt(saved) : 280;
    });
    const [isResizing, setIsResizing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        const { data } = await supabase.from('branches').select('*').order('name');
        if (data) setBranches(data);
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    const stopResizing = () => {
        setIsResizing(false);
        localStorage.setItem('pos_sidebar_width_modifiers', sidebarWidth.toString());
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        const newWidth = e.clientX;
        if (newWidth >= 150 && newWidth <= 600) {
            setSidebarWidth(newWidth);
        }
    };

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, sidebarWidth]);

    const fetchData = async () => {
        setLoading(true);
        const [catRes, prodRes, groupRes] = await Promise.all([
            // VENTA categories are now read from 'menu_categories'
            supabase.from('menu_categories').select('*').order('nombre'),
            // Only fetch food items (es_platillo = true) and branch out to their menu_category parent relation
            supabase.from('products').select('*, menu_categories!menu_category_id(nombre, parent_id)').eq('es_platillo', true).order('name'),
            supabase.from('modifier_groups').select('*').order('name')
        ]);

        if (catRes.data) {
            // Map 'nombre' to 'name' for backwards compatibility with the CategorySidebar component
            setCategories(catRes.data.map(c => ({...c, name: c.nombre})));
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


    const isCategoryChildOf = (catId: string, parentId: string): boolean => {
        const cat = categories.find(c => String(c.id) === String(catId));
        if (!cat) return false;
        if (String(cat.parent_id) === String(parentId)) return true;
        if (cat.parent_id) return isCategoryChildOf(cat.parent_id, parentId);
        return false;
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
            (p.product_code && p.product_code.toLowerCase().includes(searchProduct.toLowerCase()));
        
        // Use menu_category_id since recent DB separation
        const catId = String(p.menu_category_id || '');
        const selId = String(selectedCategory || '');

        const matchesCategory = !selectedCategory || 
            catId === selId || 
            isCategoryChildOf(catId, selId);
        
        const matchesBranch = selectedBranch === 'all' || !p.branch_id || p.branch_id === selectedBranch;
        
        return matchesSearch && matchesCategory && matchesBranch;
    });

    const handleAddProduct = (prod: any) => {
        if (!selectedProducts.find(p => p.id === prod.id)) {
            setSelectedProducts([...selectedProducts, prod]);
        }
    };

    const handleRemoveProduct = (id: string) => {
        setSelectedProducts(selectedProducts.filter(p => p.id !== id));
    };

    const handleAddGroup = (group: any) => {
        if (!selectedGroups.find(g => g.id === group.id)) {
            setSelectedGroups([...selectedGroups, { ...group, min_selection: 0, max_selection: 1 }]);
        }
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

            notify.success('Asignación masiva de modificadores completada');
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
            {/* 1. Filter Bar (Sucursal on Left, Show All on Right) */}
            <div className="bg-[#f0f0f0] border border-[#ccc] px-2 py-1 flex items-center justify-between shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Sucursal</span>
                    <select
                        value={selectedBranch}
                        onChange={e => setSelectedBranch(e.target.value)}
                        className="bg-white border border-gray-400 rounded-sm px-2 py-0.5 text-[10px] font-bold text-slate-700 outline-none focus:border-[#106ebe] min-w-[280px]"
                    >
                        <option value="all">TODAS LAS SUCURSALES</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className="bg-[#106ebe] hover:bg-[#002244] text-white px-5 py-1.5 border border-[#001a33] text-[10px] font-black uppercase tracking-widest shadow-sm active:translate-y-[1px] transition-all"
                    >
                        Mostrar Todos
                    </button>
                </div>
            </div>

            {/* Main Panels */}
            <div className="flex-1 flex gap-1 overflow-hidden relative">

                {/* 1. Categorías Left sidebar */}
                <CategorySidebar 
                    categories={categories}
                    selectedId={selectedCategory}
                    onSelect={setSelectedCategory}
                    width={sidebarWidth}
                    onResizeStart={startResizing}
                    isResizing={isResizing}
                    showSearch={false}
                />

                {/* RESIZER HANDLE */}
                <div 
                    onMouseDown={startResizing}
                    className={`w-[3px] h-full cursor-col-resize shrink-0 transition-colors z-50 ${isResizing ? 'bg-[#106ebe]' : 'bg-gray-200 hover:bg-gray-400 opacity-50 hover:opacity-100'}`}
                    title="Arrastrar para redimensionar"
                />

                {/* 2. Listado de Platillos Middle Panel */}
                <section className="flex-1 flex flex-col overflow-hidden">
                    {/* Header Panel */}
                    <div className="bg-[#106ebe] px-3 py-1.5 flex items-center justify-between rounded-t-sm">
                        <div className="flex items-center gap-2">
                            <Layers size={14} className="text-white" />
                            <span className="text-white text-[10px] font-bold font-black tracking-tight uppercase">Listado de Platillos</span>
                        </div>
                    </div>

                    <div className="flex-1 bg-white border border-gray-300 shadow-sm flex flex-col overflow-hidden rounded-b-sm">
                        <div className="bg-[#f8f9fa] border-b border-gray-200 px-3 py-1.5 flex items-center justify-end gap-2 shrink-0">
                            <div className="relative flex items-center bg-white border border-gray-300 rounded-sm overflow-hidden shadow-inner">
                                <input
                                    type="text"
                                    value={searchProduct}
                                    onChange={e => setSearchProduct(e.target.value)}
                                    placeholder="BUSCAR PRODUCTO..."
                                    className="px-2 h-[22px] text-[10px] font-bold text-slate-700 outline-none w-64 uppercase bg-transparent"
                                />
                                <button className="bg-[#f0f0f0] border-l border-gray-300 px-3 h-[22px] text-[10px] font-black uppercase text-slate-600 hover:bg-[#e1e1e1]">
                                    BUSCAR
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 bg-[#e8e8e8] z-20 shadow-sm select-none">
                                    <tr className="h-8 border-b border-gray-400 text-[10px] font-bold uppercase text-black">
                                        <th className="px-4 text-left border-r border-gray-300">Platillo</th>
                                        <th className="px-4 text-right w-32 border-r border-gray-300">Precio Venta</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredProducts.map((prod, index) => (
                                        <tr
                                            key={prod.id}
                                            className={`h-7 border-b border-gray-50 hover:bg-[#f2f7fb] cursor-pointer text-[10px] font-bold text-slate-900 uppercase ${index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'}`}
                                            onClick={() => handleAddProduct(prod)}
                                        >
                                            <td className="px-4 border-r border-gray-100">{prod.name}</td>
                                            <td className="px-4 text-right border-r border-gray-100 tabular-nums">Q{Number(prod.price || 0).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
                                    {selectedProducts.map((prod, index) => (
                                        <tr key={prod.id} className={`h-7 border-b border-gray-50 group ${index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'}`}>
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
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedGroups.map((group, index) => (
                                        <tr key={group.id} className={`h-9 border-b border-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'}`}>
                                            <td className="px-4 text-[10px] font-bold text-[#106ebe] uppercase">{group.name}</td>
                                            <td className="px-2 text-center text-slate-300 hover:text-red-500 cursor-pointer" onClick={() => handleRemoveGroup(group.id)}>
                                                <Trash2 size={12} />
                                            </td>
                                        </tr>
                                    ))}
                                    {selectedGroups.length === 0 && (
                                        <tr><td colSpan={2} className="p-8 text-center text-[10px] font-bold text-slate-400 italic uppercase">Añada grupos de modificadores</td></tr>
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
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Baseline size={10} /> Las Palmas POS - Asignación Masiva
                    </span>
                </div>
                <div className="flex items-center gap-4 divide-x divide-gray-200">
                    <span className="text-[10px] font-black text-[#106ebe] uppercase px-4">{filteredProducts.length} Platos disponibles</span>
                    <span className="text-[10px] font-black text-emerald-600 uppercase px-4">{selectedProducts.length} Seleccionados</span>
                </div>
            </footer>

            {/* Picker Modal for Modifiers */}
            {showPicker && createPortal(
                <div className="fixed inset-0 z-[100000] flex items-center justify-center pointer-events-none font-sans">
                    <div className="absolute inset-0 bg-black/5 pointer-events-auto" onClick={() => setShowPicker(false)} />
                    <div className="pointer-events-auto">
                        <DraggableWindow>
                            <div className="w-[600px] bg-[#f0f0f0] border border-[#106ebe] shadow-2xl overflow-hidden flex flex-col">
                                <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move text-white shrink-0">
                                    <div className="flex items-center gap-2">
                                        <ListFilter size={14} />
                                        <span className="text-[11px] font-bold tracking-tight uppercase text-white">Seleccionar Grupo de Modificadores</span>
                                    </div>
                                    <button onClick={() => setShowPicker(false)} className="w-7 h-7 flex items-center justify-center bg-red-600 hover:bg-red-700 transition-all text-white">
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="p-4 space-y-4">
                                    <div className="bg-white border border-gray-300 p-2 flex items-center gap-2">
                                        <div className="flex-1 relative">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={pickerSearch}
                                                onChange={e => setPickerSearch(e.target.value)}
                                                placeholder="Introduzca el texto a buscar..."
                                                className="w-full h-8 border border-gray-300 px-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-[#106ebe]"
                                            />
                                        </div>
                                        <button className="px-6 h-8 bg-[#f0f0f0] border border-gray-400 text-[11px] font-bold uppercase text-slate-700 hover:bg-white active:bg-gray-200">Buscar</button>
                                    </div>

                                    <div className="bg-white border border-gray-300 h-80 overflow-auto">
                                        <table className="w-full border-collapse text-left">
                                            <thead className="sticky top-0 bg-[#e8e8e8] z-10 text-[10px] font-black uppercase shadow-sm text-slate-700">
                                                <tr className="h-8 border-b border-gray-300">
                                                    <th className="px-4 border-r border-gray-300">Grupo</th>
                                                    <th className="px-4">Prompt</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[11px] font-bold uppercase text-slate-600">
                                                {pickerFilteredGroups.map(group => (
                                                    <tr
                                                        key={group.id}
                                                        onDoubleClick={() => handleAddGroup(group)}
                                                        onClick={() => handleAddGroup(group)}
                                                        className="h-8 border-b border-gray-50 hover:bg-[#e1e5eb] cursor-pointer"
                                                    >
                                                        <td className="px-4 border-r border-gray-200">{group.name}</td>
                                                        <td className="px-4 text-slate-400">{group.group_prompt || '—'}</td>
                                                    </tr>
                                                ))}
                                                {pickerFilteredGroups.length === 0 && (
                                                    <tr><td colSpan={2} className="p-8 text-center text-slate-400 italic">No se encontraron grupos</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-bold text-slate-500">* Clic o Doble Clic sobre cualquier grupo para añadirlo.</p>
                                        <p className="text-[10px] font-bold text-slate-500">* ESC - Para cerrar la ventana.</p>
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
