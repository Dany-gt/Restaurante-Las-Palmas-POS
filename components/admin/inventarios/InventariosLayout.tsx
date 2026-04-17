import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useReactToPrint } from 'react-to-print';
import { Search, Plus, Edit2, Trash2, Folder, Package, X, RefreshCw, ChefHat, FolderOpen, Layers, Save, Check, Image as ImageIcon, Printer, FileText, Sparkles, Loader2, AlertCircle, FolderPlus } from 'lucide-react';
// ÔòÉÔòÉÔòÉ SIDEBARS INDEPENDIENTES POR DOMINIO ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
import { MenuCategorySidebar } from '../menu/MenuCategorySidebar';       // D1: menu_categories
import { ProductCategorySidebar } from '../products/ProductCategorySidebar'; // D2: product_categories
// D3 y D4 se usan en InventarioUnificado (insumos/utensilios)
import { ListadoPlatillos } from './ListadoPlatillos';
import { ListadoProductos } from './ListadoProductos';
import { PlatilloModal } from './PlatilloModal';
import { ProductoModal } from './ProductoModal';
import { supabase } from '../../../supabase';
import { useNotify } from '../../../hooks/useNotify';
import { registrarAuditoria, detectarCambios } from '../../../services/auditService';
import { WindowsSaveButton } from '../../WindowsSaveButton';
import { DraggableWindow } from '../shared/DraggableWindow';



interface InventariosLayoutProps {
    initialTab: 'platillos' | 'productos';
}

export const InventariosLayout: React.FC<InventariosLayoutProps> = ({ initialTab }) => {
    const notify = useNotify();
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({ contentRef: printRef });
    
    const [branches, setBranches] = useState<any[]>([]);
    const [kitchens, setKitchens] = useState<any[]>([]);
    
    const [selectedBranch, setSelectedBranch] = useState<string>(() => {
        try {
            const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            return cachedUser?.branch_id || 'all';
        } catch (e) {
            return 'all';
        }
    });
    
    // ÔòÉÔòÉÔòÉ ESTADO DE CATEGOR├ìA POR DOMINIO (ID ├║nico, no Set) ÔòÉÔòÉ
    // D1: Men├║ ÔÇö solo lee menu_categories
    const [categoryMenuId, setCategoryMenuId] = useState<string | null>(null);
    // D2: Productos ÔÇö solo lee product_categories
    const [categoryProdId, setCategoryProdId] = useState<string | null>(null);
    // Compatibilidad con ListadoPlatillos/ListadoProductos que esperan Set<string>
    const categoriaMenuSel = useMemo(() => categoryMenuId ? new Set([categoryMenuId]) : new Set<string>(), [categoryMenuId]);
    const categoriaProdSel = useMemo(() => categoryProdId ? new Set([categoryProdId]) : new Set<string>(), [categoryProdId]);

    // Estados para Modales de Edici├│n
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [modalType, setModalType] = useState<'platillo' | 'producto'>('platillo');
    const [activeTab, setActiveTab] = useState<'general' | 'branches' | 'recipe' | 'modifiers'>('general');
    const [loadingForm, setLoadingForm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // Estados de Formulario (Copiados de MenuAdmin)
    const [newProduct, setNewProduct] = useState<any>({
        name: '', short_name: '', description: '', price: '0', category_id: '', kitchen_station_id: '',
        image_url: '', is_enabled: true, product_code: '', cost_price: '0', unit_measure: 'Libra', 
        presentation_unit: 'Caja', conversion_factor: '1', supplier_id: '',
        classification: '', portions: '1', portion_size: '', serving_temp: '', prep_time: '',
        prepared_by: '', prep_procedure: '', observations: ''
    });
    const [globalPrices, setGlobalPrices] = useState({ price: '', delivery_price: '', platform_price: '' });
    const [branchPrices, setBranchPrices] = useState<any[]>([]);
    const [recipeItems, setRecipeItems] = useState<any[]>([]);
    const [optionGroups, setOptionGroups] = useState<any[]>([]);
    const [modifierGroups, setModifierGroups] = useState<any[]>([]);
    const [assignedModifierGroups, setAssignedModifierGroups] = useState<any[]>([]);
    const [assignedOptionGroups, setAssignedOptionGroups] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    
    // UX States for Subsidiary Modals
    const [optionsContextMenu, setOptionsContextMenu] = useState<{ visible: boolean, x: number, y: number, type: 'options' | 'modifiers' | null, targetGroupId?: string }>({ visible: false, x: 0, y: 0, type: null });
    const [searchModal, setSearchModal] = useState<{ visible: boolean, type: 'options' | 'modifiers' | 'inventory' | null, query: string }>({ visible: false, type: null, query: '' });
    const [configModal, setConfigModal] = useState<{ visible: boolean, item: any, quantity: string, unit: string } | null>(null);
    const [showTechnicalModal, setShowTechnicalModal] = useState(false);
    const [isImproving, setIsImproving] = useState(false);
    const [openPicker, setOpenPicker] = useState<'category' | 'supplier' | null>(null);
    const [recipeContextMenu, setRecipeContextMenu] = useState<{ visible: boolean, x: number, y: number, itemIdx?: number }>({ visible: false, x: 0, y: 0 });

    const handleImproveText = async (field: 'prep_procedure' | 'observations') => {
        const textToImprove = newProduct[field];
        if (!textToImprove) {
            notify.info('Por favor, escribe un borrador primero para que la IA pueda mejorarlo.');
            return;
        }

        setIsImproving(true);
        try {
            const systemPrompt = `Rol: Eres un experto en redacci├│n t├®cnica culinaria.
Tarea: Revisa el siguiente texto para corregir errores ortogr├íficos, gramaticales y de puntuaci├│n, mejorando la fluidez sin alterar el contenido original.
Reglas estrictas:
- NO modifiques la informaci├│n t├®cnica ni el sentido original del texto.
- Corrige ├║nicamente la ortograf├¡a y gram├ítica para que el texto sea profesional.
- Mant├®n el estilo original (si hay listas, resp├®talas; si es p├írrafo, resp├®talo) pero con redacci├│n impecable.
- Formato de salida: Devuelve ├ÜNICAMENTE el texto corregido. No agregues comentarios, saludos ni introducciones.`;

            const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || 'AIzaSyAHJeRT6nwLk1W4v4FXMvXjkxwn26zL8nw';

            const requestBody = {
                contents: [{
                    parts: [{ text: `${systemPrompt}\n\nTEXTO A MEJORAR:\n${textToImprove}` }]
                }],
                generationConfig: {
                    temperature: 0.3,
                }
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-1b-it:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Gemini API Error:', data);
                throw new Error(data.error?.message || 'Error al conectar con la API de IA Gemini');
            }

            const improvedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (improvedText) {
                setNewProduct(prev => ({ ...prev, [field]: improvedText }));
                notify.success('Texto optimizado por la IA correctamente.');
            } else {
                notify.info('La IA no pudo procesar el texto (sin respuesta).');
            }
        } catch (error: any) {
            console.error('Error improving text with Gemini:', error);
            notify.error(`Error IA: ${error.message}`);
        } finally {
            setIsImproving(false);
        }
    };

    const [menuCategories, setMenuCategories] = useState<any[]>([]);
    const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            const [brRes, invCatRes, kRes, optRes, modRes, invRes, supRes, dishCatRes] = await Promise.all([
                supabase.from('branches').select('*').order('name'),
                supabase.from('categories').select('*').eq('section', 'INVENTARIO').order('name'),
                supabase.from('kitchen_stations').select('*').order('name'),
                supabase.from('option_groups').select('*').order('name'),
                supabase.from('modifier_groups').select('*').order('name'),
                supabase.from('products').select('*, product_categories(nombre)').eq('es_platillo', false).order('name'),
                supabase.from('suppliers').select('*').order('name'),
                supabase.from('categories').select('*').eq('section', 'VENTA').order('name')
            ]);

            if (brRes.data) setBranches(brRes.data);
            if (dishCatRes.data) setMenuCategories(dishCatRes.data);
            if (invCatRes.data) setInventoryCategories(invCatRes.data);
            if (kRes.data) setKitchens(kRes.data);
            if (optRes.data) setOptionGroups(optRes.data);
            if (modRes.data) setModifierGroups(modRes.data);
            if (invRes.data) {
                const mapped = invRes.data.map((i: any) => ({
                    ...i,
                    nombre: i.name,
                    codigo: i.product_code,
                    presentacion: i.unit_measure,
                    categoria: i.product_categories?.nombre || 'SIN CATEGOR├ìA'
                }));
                setInventoryItems(mapped);
            }
            if (supRes.data) setSuppliers(supRes.data);
        } catch (e) {
            console.error('Error fetching data:', e);
        }
    };

    useEffect(() => {
        fetchData();
        // Close context menu on global click
        const handleGlobalClick = () => {
            if (optionsContextMenu.visible) setOptionsContextMenu(prev => ({ ...prev, visible: false }));
        };
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, [optionsContextMenu.visible]);
    
    // Estados para Acciones R├ípidas
    const [showQuickModal, setShowQuickModal] = useState<'category' | 'station' | null>(null);
    const [showQuickCatModal, setShowQuickCatModal] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [quickTargetId, setQuickTargetId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0); // Para forzar el refresco de los listados

    // Handlers para acciones desde los listados
    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
        console.log('Refrescando listados...');
    };

    const handleEdit = async (id: string, type: 'platillo' | 'producto') => {
        setEditingId(id);
        setModalType(type);
        setShowModal(true);
        setLoadingForm(true);
        setActiveTab('general');

        try {
            const table = type === 'platillo' ? 'products' : 'productos';
            const { data: prodData } = await supabase.from(table).select('*').eq('id', id).single();
            
            if (prodData) {
                setNewProduct({
                    ...prodData,
                    price: (prodData.price || 0).toString(),
                    product_code: prodData.codigo || prodData.product_code || '',
                    name: prodData.nombre || prodData.name || '',
                    cost_price: (prodData.precio_costo || prodData.cost_price || 0).toString(),
                    portions: (prodData.portions || 1).toString(),
                    unit_measure: prodData.unidad_medida || prodData.unit_measure || 'LB',
                    presentation_unit: prodData.presentacion || prodData.presentation_unit || 'UNI',
                    conversion_factor: (prodData.factor_conversion || prodData.conversion_factor || 1).toString(),
                    supplier_id: prodData.supplier_id || ''
                });

                // Cargar Precios por Sucursal (Merge with all branches)
                const { data: bpData } = await supabase.from('product_branch_prices').select('*').eq('product_id', id);
                
                // Asegurar que todas las sucursales existentes aparezcan, incluso si no tienen precio guardado
                const fullBranchPrices = branches.map(b => {
                    const existing = bpData?.find(bp => bp.branch_id === b.id);
                    return existing ? {
                        ...existing,
                        price: (existing.price || 0).toString(),
                        delivery_price: (existing.delivery_price || 0).toString(),
                        platform_price: (existing.platform_price || 0).toString()
                    } : {
                        branch_id: b.id,
                        price: '0',
                        delivery_price: '0',
                        platform_price: '0',
                        is_enabled: true
                    };
                });
                setBranchPrices(fullBranchPrices);

                // Cargar Receta
                const { data: recipeData } = await supabase.from('product_recipes').select('*, inventory_items(*)').eq('product_id', id);
                if (recipeData) setRecipeItems(recipeData);

                // Cargar Modificadores y Opciones
                const { data: modData } = await supabase.from('product_modifier_groups').select('*').eq('product_id', id);
                const { data: optData } = await supabase.from('product_option_groups').select('*').eq('product_id', id);
                if (modData) setAssignedModifierGroups(modData);
                if (optData) setAssignedOptionGroups(optData);
            }
        } catch (e) {
            console.error('Error loading product data:', e);
        } finally {
            setLoadingForm(false);
        }
    };

    const resetForm = () => {
        setNewProduct({
            name: '', short_name: '', description: '', price: '0', category_id: '', kitchen_station_id: '',
            image_url: '', is_enabled: true, product_code: '', cost_price: '0', unit_measure: 'Libra', 
            presentation_unit: 'Caja', conversion_factor: '1', supplier_id: '',
            classification: '', portions: '1', portion_size: '', serving_temp: '', prep_time: '',
            prepared_by: '', prep_procedure: '', observations: ''
        });
        setRecipeItems([]);
        setBranchPrices([]);
        setAssignedModifierGroups([]);
        setAssignedOptionGroups([]);
        setEditingId(null);
    };

    const handleNew = (type: 'platillo' | 'producto') => {
        resetForm();
        setModalType(type);
        setShowModal(true);
        setActiveTab('general');
        
        // Inicializar precios por sucursal con todas las sucursales disponibles
        setBranchPrices(branches.map(b => ({
            branch_id: b.id,
            price: '0',
            delivery_price: '0',
            platform_price: '0',
            is_enabled: true
        })));
    };

    const handleSave = async () => {
        if (!newProduct.name || !newProduct.category_id) {
            notify.error('El nombre y la categor├¡a son obligatorios');
            return;
        }

        setIsSaving(true);
        const table = modalType === 'platillo' ? 'products' : 'productos';
        
        try {
            let savedId = editingId;
            
            if (modalType === 'platillo') {
                const dishData = {
                    product_code: newProduct.product_code,
                    name: newProduct.name.toUpperCase(),
                    short_name: newProduct.short_name?.toUpperCase(),
                    description: newProduct.description,
                    price: parseFloat(newProduct.price) || 0,
                    category_id: newProduct.category_id,
                    kitchen_station_id: newProduct.kitchen_station_id || null,
                    image_url: newProduct.image_url,
                    is_enabled: newProduct.is_enabled,
                    cost_price: parseFloat(newProduct.cost_price) || 0,
                    portions: parseInt(newProduct.portions) || 1,
                    prep_procedure: newProduct.prep_procedure
                };

                if (editingId) {
                    const { error } = await supabase.from('products').update(dishData).eq('id', editingId);
                    if (error) throw error;
                } else {
                    const { data, error } = await supabase.from('products').insert(dishData).select();
                    if (error) throw error;
                    if (data?.[0]) savedId = data[0].id;
                }
            } else {
                const ingredientData = {
                    codigo: newProduct.product_code,
                    nombre: newProduct.name.toUpperCase(),
                    categoria_id: newProduct.category_id,
                    unidad_medida: newProduct.unit_measure,
                    presentacion: newProduct.presentation_unit,
                    factor_conversion: parseFloat(newProduct.conversion_factor) || 1,
                    precio_costo: parseFloat(newProduct.cost_price) || 0,
                    supplier_id: newProduct.supplier_id || null,
                    habilitado: newProduct.is_enabled
                };

                if (editingId) {
                    const { error } = await supabase.from('productos').update(ingredientData).eq('id', editingId);
                    if (error) throw error;
                } else {
                    const { data, error } = await supabase.from('productos').insert(ingredientData).select();
                    if (error) throw error;
                    if (data?.[0]) savedId = data[0].id;
                }
            }

            if (savedId) {
                // 2. Precios por Sucursal
                if (branchPrices.length > 0) {
                    const bpData = branchPrices.map(bp => ({
                        product_id: savedId,
                        branch_id: bp.branch_id,
                        price: parseFloat(bp.price) || 0,
                        delivery_price: parseFloat(bp.delivery_price) || 0,
                        platform_price: parseFloat(bp.platform_price) || 0,
                        is_enabled: bp.is_enabled
                    }));
                    await supabase.from('product_branch_prices').upsert(bpData, { onConflict: 'product_id,branch_id' });
                }

                // 3. Receta Técnica
                if (recipeItems.length > 0) {
                    await supabase.from('product_recipes').delete().eq('product_id', savedId);
                    const rData = recipeItems.map(ri => ({
                        product_id: savedId,
                        inventory_item_id: ri.inventory_item_id,
                        quantity: parseFloat(ri.quantity) || 0,
                        unit_measure: ri.unit_measure || 'Unidades'
                    }));
                    await supabase.from('product_recipes').insert(rData);
                } else {
                    await supabase.from('product_recipes').delete().eq('product_id', savedId);
                }

                // 4. Modificadores y Opciones
                await supabase.from('product_modifier_groups').delete().eq('product_id', savedId);
                await supabase.from('product_option_groups').delete().eq('product_id', savedId);
                
                if (assignedModifierGroups.length > 0) {
                    const mData = assignedModifierGroups.map(ag => ({ product_id: savedId, group_id: ag.group_id }));
                    await supabase.from('product_modifier_groups').insert(mData);
                }
                if (assignedOptionGroups.length > 0) {
                    const oData = assignedOptionGroups.map(ag => ({ product_id: savedId, group_id: ag.group_id }));
                    await supabase.from('product_option_groups').insert(oData);
                }

                notify.success('Registro guardado correctamente');
                handleRefresh();
                setShowModal(false);
                resetForm();
            }
        } catch (e: any) {
            notify.error('Error al guardar: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveQuickCategory = async () => {
        if (!newCatName.trim()) return;
        setIsSaving(true);
        try {
            const section = modalType === 'platillo' ? 'VENTA' : 'INVENTARIO';
            const { error } = await supabase.from('categories').insert({
                name: newCatName.trim().toUpperCase(),
                section: section,
                org_id: 'default'
            });
            if (error) throw error;
            
            notify.success('Categoría creada');
            await fetchData();
            setShowQuickCatModal(false);
            setNewCatName('');
        } catch (e: any) {
            notify.error('Error: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, type: 'platillo' | 'producto') => {
        if (!window.confirm(`¿Está seguro de eliminar este ${type}? No se puede deshacer.`)) return;
        try {
            const table = type === 'platillo' ? 'products' : 'productos'; // 'products' es la tabla real de platillos
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            handleRefresh();
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    const handleChangeCategory = (id: string) => {
        setQuickTargetId(id);
        setShowQuickModal('category');
    };

    const handleChangeKitchen = (id: string) => {
        setQuickTargetId(id);
        setShowQuickModal('station');
    };

    return (
        <>
            <div className="flex flex-col h-full bg-white overflow-hidden font-sans border-t border-gray-300 relative">
            {/* Ribbon Fino de Sucursal */}
            <div className="h-8 bg-[#f5f5f5] border-b border-gray-300 px-2 flex items-center gap-4 shrink-0 select-none">
                <div className="flex items-center gap-2 ml-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Sucursal:</span>
                    <select 
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="bg-white border border-gray-300 h-5 px-1 text-[10px] font-bold outline-none min-w-[200px]"
                    >
                        <option value="all">--- TODAS LAS SUCURSALES ---</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <button 
                        onClick={() => { setCategoryMenuId(null); setCategoryProdId(null); }}
                        className="px-4 h-5 border border-gray-300 bg-[#fdfdfd] text-[#106ebe] text-[9px] font-black uppercase hover:bg-white shadow-sm transition-all"
                    >
                        Mostrar Todos los Registros
                    </button>
                    {/* Bot├│n r├ípido de creaci├│n estilo Desktop */}
                    <button 
                        onClick={() => handleNew(initialTab === 'platillos' ? 'platillo' : 'producto')}
                        className="px-3 h-5 bg-[#106ebe] text-white text-[9px] font-black uppercase hover:bg-[#0d5aa0] shadow-sm flex items-center gap-1"
                    >
                        + Nuevo {initialTab === 'platillos' ? 'Platillo' : 'Producto'}
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* ÔòÉÔòÉÔòÉ SIDEBAR CORRECTO POR DOMINIO ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
                    D1: Men├║ ÔåÆ MenuCategorySidebar (lee SOLO menu_categories)
                    D2: Productos ÔåÆ ProductCategorySidebar (lee SOLO product_categories) */}
                {initialTab === 'platillos' ? (
                    <MenuCategorySidebar
                        selectedId={categoryMenuId}
                        onSelect={setCategoryMenuId}
                    />
                ) : (
                    <ProductCategorySidebar
                        selectedIds={categoriaProdSel}
                        onToggle={(id) => setCategoryProdId(categoryProdId === id ? null : id)}
                        onSelectAll={(ids) => setCategoryProdId(ids[0] || null)}
                        onClearAll={() => setCategoryProdId(null)}
                    />
                )}

                <div className="flex-1 flex flex-col min-w-0 bg-[#e0e0e0]">
                    {initialTab === 'platillos' ? (
                        <ListadoPlatillos 
                            key={`platillos-${refreshKey}`}
                            categorias={categoriaMenuSel} 
                            sucursalId={selectedBranch} 
                            onEdit={(id) => handleEdit(id, 'platillo')}
                            onNew={() => handleNew('platillo')}
                            onDelete={(id) => handleDelete(id, 'platillo')}
                            onRefresh={handleRefresh}
                            onChangeCategory={handleChangeCategory}
                            onChangeKitchen={handleChangeKitchen}
                        />
                    ) : (
                        <ListadoProductos 
                            key={`productos-${refreshKey}`}
                            categorias={categoriaProdSel} 
                            sucursalId={selectedBranch} 
                            onEdit={(id) => handleEdit(id, 'producto')}
                            onNew={() => handleNew('producto')}
                            onDelete={(id) => handleDelete(id, 'producto')}
                            onRefresh={handleRefresh}
                            onChangeCategory={handleChangeCategory}
                            onKardex={(id) => console.log('Kardex no implementado a├║n', id)}
                        />
                    )}
                </div>
            </div>
        </div>

        {/* Quick Change Modal (Categor├¡a / Cocina) */}
            {showQuickModal && quickTargetId && createPortal(
                <div className="fixed inset-0 z-[2000000] flex items-center justify-center p-4 pointer-events-none">
                    <div className="absolute inset-0 pointer-events-auto" onClick={() => setShowQuickModal(null)}></div>
                    <div className="pointer-events-auto">
                        <DraggableWindow>
                            <div className="w-[450px] bg-[#f0f0f0] border-2 border-white shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="modal-header px-4 py-2 bg-[#106ebe] flex items-center justify-between cursor-move select-none">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 bg-white/10 rounded">
                                            {showQuickModal === 'category' ? <Folder size={14} className="text-white" /> : <ChefHat size={14} className="text-white" />}
                                        </div>
                                        <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">
                                            {showQuickModal === 'category' ? 'Seleccionar Nueva Categor├¡a' : 'Seleccionar Estaci├│n de Cocina'}
                                        </h3>
                                    </div>
                                    <button onClick={() => setShowQuickModal(null)} className="text-white/60 hover:text-white hover:bg-red-500 w-6 h-6 flex items-center justify-center transition-all">
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="p-4 max-h-[350px] overflow-y-auto custom-scrollbar bg-white m-1 border border-gray-300">
                                    <div className="grid gap-1">
                                        {(showQuickModal === 'category' ? 
                                            (initialTab === 'platillos' ? menuCategories : inventoryCategories) : 
                                            kitchens
                                        ).map(item => (
                                            <button
                                                key={item.id}
                                                onClick={async () => {
                                                    const table = initialTab === 'platillos' ? 'products' : 'productos';
                                                    const field = showQuickModal === 'category' ? 'category_id' : 'kitchen_station_id';
                                                    const { error } = await supabase.from(table).update({ [field]: item.id }).eq('id', quickTargetId);
                                                    if (!error) {
                                                        handleRefresh();
                                                        setShowQuickModal(null);
                                                    } else {
                                                        alert('Error al actualizar: ' + error.message);
                                                    }
                                                }}
                                                className="flex items-center gap-3 px-3 py-2 transition-all border border-transparent hover:border-[#106ebe] hover:bg-blue-50 text-left group"
                                            >
                                                {showQuickModal === 'category' ? <Folder size={14} className="text-amber-500" /> : <ChefHat size={14} className="text-blue-500" />}
                                                <span className="text-[11px] font-bold uppercase text-slate-700 group-hover:text-[#106ebe]">
                                                    {item.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="px-4 py-2 bg-[#f5f5f5] border-t border-gray-300 flex justify-end">
                                    <button 
                                        onClick={() => setShowQuickModal(null)}
                                        className="px-6 py-1 bg-white border border-gray-400 text-[10px] font-bold uppercase hover:bg-gray-100 shadow-sm"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>
                </div>,
                document.body
            )}

            {/* MODALS FACTORED OUT */}
            <PlatilloModal 
                isOpen={showModal && modalType === 'platillo'}
                onClose={() => { setShowModal(false); resetForm(); }}
                editingId={editingId}
                newProduct={newProduct}
                setNewProduct={setNewProduct}
                handleSave={handleSave}
                isSaving={isSaving}
                menuCategories={menuCategories}
                kitchens={kitchens}
                branches={branches}
                recipeItems={recipeItems}
                setRecipeItems={setRecipeItems}
                setRecipeContextMenu={setRecipeContextMenu}
                setSearchModal={setSearchModal}
                branchPrices={branchPrices}
                setBranchPrices={setBranchPrices}
                assignedModifierGroups={assignedModifierGroups}
                assignedOptionGroups={assignedOptionGroups}
                setOptionsContextMenu={setOptionsContextMenu}
            />

            <ProductoModal 
                isOpen={showModal && modalType === 'producto'}
                onClose={() => { setShowModal(false); resetForm(); }}
                editingId={editingId}
                newProduct={newProduct}
                setNewProduct={setNewProduct}
                handleSave={handleSave}
                isSaving={isSaving}
                inventoryCategories={inventoryCategories}
                suppliers={suppliers}
                branches={branches}
                recipeItems={recipeItems}
                setRecipeItems={setRecipeItems}
                setRecipeContextMenu={setRecipeContextMenu}
                setShowQuickCatModal={setShowQuickCatModal}
                openPicker={openPicker}
                setOpenPicker={setOpenPicker}
            />

            {optionsContextMenu.visible && createPortal(
                <div 
                    className="fixed z-[9999999] bg-white border border-gray-400 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-0.5 min-w-[170px]"
                    style={{ left: optionsContextMenu.x, top: optionsContextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <button 
                        onClick={() => { setSearchModal({ visible: true, type: optionsContextMenu.type, query: '' }); setOptionsContextMenu({ ...optionsContextMenu, visible: false }); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white text-left"
                    >
                        <Plus size={14} className="text-green-600" />
                        <span>Agregar {optionsContextMenu.type === 'options' ? 'Opciones' : 'Modificadores'}</span>
                    </button>
                    <button 
                        onClick={() => {
                            if (optionsContextMenu.type === 'options') setAssignedOptionGroups([]);
                            else setAssignedModifierGroups([]);
                            setOptionsContextMenu({ ...optionsContextMenu, visible: false });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white text-left"
                    >
                        <Trash2 size={14} className="text-red-600" />
                        <span>Quitar Todos</span>
                    </button>
                </div>,
                document.body
            )}

            {/* Floating Search Modal */}
            {searchModal.visible && createPortal(
                <div className="fixed inset-0 z-[8000000] flex items-center justify-center p-4 pointer-events-none">
                    <div className="absolute inset-0 pointer-events-auto" onClick={() => setSearchModal({ visible: false, type: null, query: '' })}></div>
                    <div className="pointer-events-auto relative shadow-[0_0_50px_rgba(0,0,0,0.4)]">
                        <div className="bg-[#f0f0f0] border border-[#106ebe] w-[800px] h-[530px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center text-white shrink-0 select-none relative group">
                                <div className="flex items-center gap-2 relative z-10 font-[Arial]">
                                    <Search size={14} className="text-blue-100" />
                                            <span className="text-[10px] font-black uppercase tracking-tight">
                                                Explorador de Insumos - Seleccionando para: <span className="text-blue-100 font-black">{newProduct.name || 'NUEVO PRODUCTO'}</span>
                                            </span>
                                        </div>
                                        <button onClick={() => setSearchModal({ visible: false, type: null, query: '' })} className="hover:bg-red-500 w-8 h-8 flex items-center justify-center transition-colors font-bold text-[16px] relative z-10">✕</button>
                                    </div>
                                    <div className="p-3 bg-[#f0f0f0] flex gap-2 border-b border-gray-300">
                                        <div className="relative flex-1 flex bg-white border border-gray-400 p-0.5 shadow-inner">
                                            <div className="flex items-center px-3 text-gray-400">
                                                <Search size={14} />
                                            </div>
                                            <input 
                                                type="text" 
                                                autoFocus
                                                placeholder="INTRODUZCA EL TEXTO A BUSCAR (CODIGO O NOMBRE)..."
                                                className="grow h-8 bg-transparent text-[11px] font-bold text-[#106ebe] outline-none placeholder:text-gray-300 placeholder:font-normal"
                                                value={searchModal.query}
                                                onChange={e => setSearchModal({ ...searchModal, query: e.target.value.toUpperCase() })}
                                            />
                                        <button className="bg-[#106ebe] text-white px-6 h-8 text-[11px] font-black uppercase hover:bg-[#004578] transition-colors shadow-md">Buscar</button>
                                    </div>
                                </div>
                                <div className="flex-1 h-[400px] overflow-auto bg-white m-3 border border-gray-300 custom-scrollbar shadow-inner">
                                    <table className="w-full border-collapse">
                                        <thead className="bg-[#f0f0f0] sticky top-0 border-b border-gray-300 z-10 shadow-sm">
                                            <tr className="h-8">
                                                <th className="w-24 px-4 text-left text-[9px] font-bold text-slate-800 tracking-tight uppercase">Código</th>
                                                <th className="px-4 text-left text-[9px] font-bold text-slate-800 tracking-tight uppercase border-l border-gray-200">Producto / Insumo</th>
                                                <th className="w-32 px-4 text-center text-[9px] font-bold text-slate-800 tracking-tight uppercase border-l border-gray-200">Presentación</th>
                                                <th className="w-40 px-4 text-center text-[9px] font-bold text-slate-800 tracking-tight uppercase border-l border-gray-200">Proveedor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(searchModal.type === 'inventory' ? inventoryItems : searchModal.type === 'options' ? optionGroups : modifierGroups)
                                                .filter(i => {
                                                    const q = searchModal.query.toUpperCase();
                                                    const itemName = (i.name || i.nombre || '').toUpperCase();
                                                    const itemCode = (i.product_code || i.codigo || '').toUpperCase();
                                                    const catName = (i.categoria || i.product_categories?.nombre || '').toUpperCase();
                                                    
                                                    // Búsqueda por nombre o código
                                                    const matchesQuery = itemName.includes(q) || itemCode.includes(q);
                                                    if (!matchesQuery) return false;
                                                    // SEGREGACIÓN ESTRICTA PARA RECETAS (Solo Materia Prima / Insumos)
                                                    if (searchModal.type === 'inventory') {
                                                        // 1. Excluir por prefijo de código (Estándar: UTE=Utensilios, EQP=Equipo, INR=Insumos No Prod/Packaging)
                                                        const isExcludePrefix = itemCode.startsWith('UTE') || 
                                                                                itemCode.startsWith('EQP') || 
                                                                                itemCode.startsWith('SUM') || 
                                                                                itemCode.startsWith('MAQ') ||
                                                                                itemCode.startsWith('INR');
                                                        
                                                        // 2. Excluir por nombre de categoría
                                                        const isExcludeCategory = catName.includes('UTENSILIO') || 
                                                                                  catName.includes('EQUIPO') || 
                                                                                  catName.includes('MAQUINARIA') || 
                                                                                  catName.includes('HERRAMIENTA') || 
                                                                                  catName.includes('SUMINISTRO') ||
                                                                                  catName.includes('LIMPIEZA') ||
                                                                                  catName.includes('MANTENIMIENTO') ||
                                                                                  catName.includes('INSUMO');

                                                        // 3. Excluir específicamente si el nombre contiene palabras de herramientas o empaque
                                                        const isToolOrSupply = itemName.includes('SARTEN') || 
                                                                               itemName.includes('CUCHILLO') || 
                                                                               itemName.includes('LICUADORA') ||
                                                                               itemName.includes('PLATOS LLANOS') ||
                                                                               itemName.includes('VASOS DE AGUA') ||
                                                                               itemName.includes('BOLSA');

                                                        return !isExcludePrefix && !isExcludeCategory && !isToolOrSupply;
                                                    }
                                                    
                                                    return true;
                                                })
                                                .map(item => (
                                                    <tr key={item.id} className="h-8 hover:bg-blue-50 border-b border-gray-100 cursor-pointer group transition-all active:bg-[#106ebe]/10" 
                                                        onDoubleClick={() => {
                                                            if (searchModal.type === 'inventory') {
                                                                setConfigModal({ item, quantity: '1', unit: item.unit_measure || item.presentacion || 'unidad' });
                                                            } else if (searchModal.type === 'options') {
                                                                if (!assignedOptionGroups.some(g => g.group_id === item.id)) setAssignedOptionGroups([...assignedOptionGroups, { group_id: item.id }]);
                                                                setSearchModal({ ...searchModal, visible: false, type: null, query: '' });
                                                            } else {
                                                                if (!assignedModifierGroups.some(g => g.group_id === item.id)) setAssignedModifierGroups([...assignedModifierGroups, { group_id: item.id }]);
                                                                setSearchModal({ ...searchModal, visible: false, type: null, query: '' });
                                                            }
                                                        }}
                                                    >
                                                        <td className="px-4 font-bold text-slate-400 text-[9px] uppercase">{item.product_code || item.codigo || 'S/C'}</td>
                                                        <td className="px-4 font-bold text-slate-700 uppercase group-hover:text-[#106ebe] text-[10px]">{item.name || item.nombre}</td>
                                                        <td className="px-4 text-center font-bold text-slate-600 text-[9px] uppercase">{item.unit_measure || item.presentacion || 'Unidad'}</td>
                                                        <td className="px-4 text-center font-bold text-slate-600 text-[9px] uppercase border-l border-transparent group-hover:border-gray-200">{suppliers.find(s => s.id === item.supplier_id)?.name || 'Sin Proveedor'}</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-3 px-6 bg-[#f8fafc] border-t border-gray-200 flex justify-between items-center shadow-inner">
                                    <span className="text-[9px] font-black text-[#106ebe] italic uppercase tracking-wider opacity-60">* Doble clic sobre el insumo para configurar cantidad</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-[#106ebe] uppercase tracking-tighter">
                                            {(searchModal.type === 'inventory' ? inventoryItems : searchModal.type === 'options' ? optionGroups : modifierGroups).length} Registros
                                        </span>
                                        <button 
                                            onClick={() => setSearchModal({ visible: false, type: null, query: '' })}
                                            className="bg-[#106ebe] text-white px-6 h-8 text-[11px] font-black uppercase hover:bg-[#004578] transition-colors shadow-lg"
                                        >Salir / Cancelar</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>,
                document.body
            )}

            {showTechnicalModal && createPortal(
                <div className="fixed inset-0 z-[7000000] flex items-center justify-center p-4 pointer-events-none">
                    <div className="absolute inset-0 pointer-events-auto" onClick={() => setShowTechnicalModal(false)}></div>
                    <div className="pointer-events-auto relative">
                        <DraggableWindow>
                            <div className="bg-[#f0f0f0] border border-[#106ebe] shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-[850px] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-300 ring-1 ring-white/10">
                                {/* Header: Double line style like screenshot */}
                                <div className="modal-header bg-[#106ebe] px-4 flex justify-between items-center text-white shrink-0 cursor-move select-none h-10 border-b border-[#004578]">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <ChefHat size={18} className="text-white" />
                                            <span className="text-[13px] font-bold uppercase tracking-wide">Ficha Técnica y Receta Estandarizada</span>
                                        </div>
                                        <span className="text-[9px] font-semibold text-blue-100 uppercase ml-[26px] leading-tight">{newProduct.name || 'Nuevo Platillo'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={handleSave} className="flex items-center gap-1.5 px-3 h-7 bg-[#004578] hover:bg-[#003a66] active:bg-[#002d50] text-white border border-[#003a66] shadow-sm transition-colors">
                                            <Save size={14} />
                                            <span className="text-[9px] font-bold uppercase">Guardar Cambios</span>
                                        </button>
                                        <button 
                                            onClick={() => handlePrint()}
                                            className="flex items-center gap-1.5 px-3 h-7 bg-[#004578] hover:bg-[#003a66] active:bg-[#002d50] text-white border border-[#003a66] shadow-sm transition-colors"
                                        >
                                            <Printer size={14} />
                                            <span className="text-[9px] font-bold uppercase tracking-tighter">Imprimir</span>
                                        </button>
                                        <button onClick={() => setShowTechnicalModal(false)} className="hover:bg-red-500 active:bg-red-600 w-8 h-8 flex items-center justify-center font-bold text-[18px] transition-colors ml-2" title="Cerrar">✕</button>
                                    </div>
                                </div>

                                 <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#f0f0f0]">
                                    {/* UI VERSION (Editable) */}
                                    <div className="p-5 space-y-5 print:hidden">
                                        {/* SECTION: ESPECIFICACIONES */}
                                        <div className="bg-white border border-gray-300 shadow-md overflow-hidden shrink-0">
                                            <div className="bg-[#106ebe] px-3 py-1.5 border-b border-gray-300 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1 h-3 bg-white/50 rounded-full"></div>
                                                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Especificaciones del Platillo</h4>
                                                </div>
                                                <Layers size={12} className="text-white/30" />
                                            </div>
                                            <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-3 bg-white">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[10px] font-bold text-slate-500 w-24 uppercase">Clasificación</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="EJ. PLATILLO FUERTE"
                                                            className="flex-1 h-7 bg-white border border-gray-300 px-2 text-[10px] font-black text-[#106ebe] uppercase outline-none focus:border-[#106ebe] shadow-inner"
                                                            value={newProduct.classification || ''}
                                                            onChange={e => setNewProduct({...newProduct, classification: e.target.value.toUpperCase()})}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[10px] font-bold text-slate-500 w-24 uppercase">Núm. Porciones</label>
                                                        <div className="flex-1 relative">
                                                            <input 
                                                                type="text" 
                                                                className="w-full h-7 bg-white border border-gray-300 px-2 text-[10px] font-black text-[#106ebe] outline-none focus:border-[#106ebe] shadow-inner"
                                                                value={newProduct.portions || '1'}
                                                                onChange={e => setNewProduct({...newProduct, portions: e.target.value})}
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-gray-300 border border-gray-200 px-1 leading-none">UNID.</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[10px] font-bold text-slate-500 w-24 uppercase">Temp. Servicio</label>
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 h-7 bg-white border border-gray-300 px-2 text-[10px] font-black text-slate-600 uppercase outline-none focus:border-[#106ebe] shadow-inner"
                                                            value={newProduct.serving_temp || ''}
                                                            onChange={e => setNewProduct({...newProduct, serving_temp: e.target.value.toUpperCase()})}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[10px] font-bold text-slate-500 w-24 uppercase">Elaborado Por</label>
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 h-7 bg-white border border-gray-300 px-2 text-[10px] font-black text-slate-600 uppercase outline-none focus:border-[#106ebe] shadow-inner"
                                                            value={newProduct.prepared_by || ''}
                                                            onChange={e => setNewProduct({...newProduct, prepared_by: e.target.value.toUpperCase()})}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[10px] font-bold text-slate-500 w-24 uppercase">No. de Receta</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="EJ. 001"
                                                            className="flex-1 h-7 bg-white border border-gray-300 px-2 text-[10px] font-black text-slate-600 uppercase outline-none focus:border-[#106ebe] shadow-inner"
                                                            value={newProduct.recipe_no || ''}
                                                            onChange={e => setNewProduct({...newProduct, recipe_no: e.target.value.toUpperCase()})}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[10px] font-bold text-slate-500 w-24 uppercase">Tama├▒o Porci├│n</label>
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 h-7 bg-white border border-gray-300 px-2 text-[10px] font-black text-slate-600 uppercase outline-none focus:border-[#106ebe] shadow-inner"
                                                            value={newProduct.portion_size || ''}
                                                            onChange={e => setNewProduct({...newProduct, portion_size: e.target.value.toUpperCase()})}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[10px] font-bold text-slate-500 w-24 uppercase">Tiempo Elab.</label>
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 h-7 bg-white border border-gray-300 px-2 text-[10px] font-black text-slate-600 uppercase outline-none focus:border-[#106ebe] shadow-inner"
                                                            value={newProduct.prep_time || ''}
                                                            onChange={e => setNewProduct({...newProduct, prep_time: e.target.value.toUpperCase()})}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* PREPARACION Y OBSERVACIONES */}
                                        <div className="grid grid-cols-2 gap-4 shrink-0">
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[10px] font-black text-[#106ebe] uppercase tracking-wider">Preparaci├│n / Procedimiento</label>
                                                    <button 
                                                        onClick={() => handleImproveText('prep_procedure')}
                                                        disabled={isImproving}
                                                        className="text-[#106ebe] p-1 h-6 px-2 hover:bg-white rounded border border-gray-200 shadow-sm flex items-center gap-1 group transition-all"
                                                        title="Mejorar redacci├│n con IA"
                                                    >
                                                        {isImproving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={11} className="group-hover:text-amber-500 transition-colors" />}
                                                        <span className="text-[8px] font-black uppercase">IA</span>
                                                    </button>
                                                </div>
                                                <textarea 
                                                    className="w-full h-20 p-2 bg-white border border-gray-300 text-[10px] font-bold text-slate-700 outline-none focus:border-[#106ebe] shadow-inner resize-none uppercase"
                                                    placeholder="Pasos de preparaci├│n..."
                                                    value={newProduct.prep_procedure || ''}
                                                    onChange={e => setNewProduct({...newProduct, prep_procedure: e.target.value})}
                                                ></textarea>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[10px] font-black text-[#106ebe] uppercase tracking-wider">Observaciones Adicionales</label>
                                                    <button 
                                                        onClick={() => handleImproveText('observations')}
                                                        disabled={isImproving}
                                                        className="text-[#106ebe] p-1 h-6 px-2 hover:bg-white rounded border border-gray-200 shadow-sm flex items-center gap-1 group transition-all"
                                                        title="Mejorar redacci├│n con IA"
                                                    >
                                                        {isImproving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={11} className="group-hover:text-amber-500 transition-colors" />}
                                                        <span className="text-[8px] font-black uppercase">IA</span>
                                                    </button>
                                                </div>
                                                <textarea 
                                                    className="w-full h-20 p-2 bg-white border border-gray-300 text-[10px] font-bold text-slate-700 outline-none focus:border-[#106ebe] shadow-inner resize-none uppercase"
                                                    placeholder="Notas adicionales..."
                                                    value={newProduct.observations || ''}
                                                    onChange={e => setNewProduct({...newProduct, observations: e.target.value})}
                                                ></textarea>
                                            </div>
                                        </div>

                                        {/* INGREDIENTES Y COSTEO */}
                                        <div className="bg-white border border-gray-300 shadow-md group">
                                            <div className="bg-[#106ebe] h-8 px-4 flex items-center justify-between relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent pointer-events-none"></div>
                                                <div className="flex items-center gap-2 relative z-10">
                                                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Ingredientes y Costeo</h4>
                                                    <span className="bg-white text-[#106ebe] text-[9px] font-black px-1.5 rounded-full shadow-sm animate-in zoom-in duration-500">{recipeItems.length}</span>
                                                </div>
                                                <span className="text-[8px] font-bold text-blue-100/40 uppercase tracking-tighter relative z-10">* CLIC DERECHO PARA BUSCAR</span>
                                            </div>
                                            <div 
                                                className="min-h-[250px] max-h-[350px] overflow-auto custom-scrollbar relative bg-white"
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setSearchModal({ visible: true, type: 'inventory', query: '' });
                                                }}
                                            >
                                                {recipeItems.length === 0 ? (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-200 group-hover:text-[#106ebe]/10 transition-colors">
                                                        <Plus size={40} strokeWidth={1} />
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Sin Ingredientes - Clic derecho para buscar</span>
                                                    </div>
                                                ) : (
                                                    <table className="w-full border-collapse">
                                                        <thead className="bg-[#f8fafc] sticky top-0 border-b border-gray-200 z-10 shadow-sm">
                                                            <tr className="h-8">
                                                                <th className="px-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Insumo / Ingrediente</th>
                                                                <th className="w-24 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">Cantidad</th>
                                                                <th className="w-24 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">Unidad</th>
                                                                <th className="w-28 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest px-4">Subtotal</th>
                                                                <th className="w-10"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {recipeItems.map((ri, idx) => {
                                                                const cost = (ri.inventory_items?.price_cost || 0);
                                                                const total = parseFloat(ri.quantity) * cost;
                                                                return (
                                                                    <tr key={idx} className="h-8 text-[11px] group/row hover:bg-blue-50/40 transition-colors">
                                                                        <td className="px-4 font-bold text-slate-700 uppercase group-hover/row:text-[#106ebe]">{ri.inventory_items?.name}</td>
                                                                        <td className="px-2">
                                                                            <input 
                                                                                type="text" 
                                                                                className="w-full text-center bg-gray-50/50 group-hover/row:bg-white border border-gray-200 group-hover/row:border-[#106ebe]/30 font-black text-[#106ebe] outline-none h-6 transition-all"
                                                                                value={ri.quantity}
                                                                                onChange={e => {
                                                                                    const n = [...recipeItems];
                                                                                    n[idx].quantity = e.target.value.replace(/[^0-9.]/g, '');
                                                                                    setRecipeItems(n);
                                                                                }}
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 text-center text-slate-400 font-bold uppercase">{ri.unit_measure || 'GR'}</td>
                                                                        <td className="px-4 text-right">
                                                                           <div className="flex justify-between items-baseline opacity-80 group-hover/row:opacity-100 transition-opacity">
                                                                                <span className="text-[8px] text-slate-300">Q</span>
                                                                                <span className="font-black text-slate-700">{(total).toFixed(2)}</span>
                                                                           </div>
                                                                        </td>
                                                                        <td className="px-2 text-center">
                                                                            <button onClick={() => setRecipeItems(prev => prev.filter((_, i) => i !== idx))} className="text-gray-200 hover:text-red-500 transition-colors transform active:scale-90"><Trash2 size={12} /></button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                            <div className="bg-gradient-to-b from-[#f8fafc] to-white border-t border-gray-300 p-4 flex justify-between items-center shadow-inner">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resumen de Costos</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-[#106ebe]/60 uppercase tracking-tight">Valores sincronizados en tiempo real</span>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest opacity-60">Costo Total Receta</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-[12px] font-black text-[#106ebe]">Q</span>
                                                            <span className="text-[24px] font-black text-[#106ebe] drop-shadow-sm tabular-nums">{recipeItems.reduce((acc, ri) => acc + ((parseFloat(ri.quantity) || 0) * (ri.inventory_items?.price_cost || 0)), 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* PRINT VERSION (Professional / Non-editable) */}
                                    <div ref={printRef} className="hidden print:block bg-white p-8 text-black font-serif printable-document">
                                        <div className="max-w-[800px] mx-auto border-2 border-black">
                                            {/* Header Title Block */}
                                            <div className="border-b-2 border-black p-2 flex justify-between items-center bg-white relative">
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <h1 className="text-xl font-black uppercase underline decoration-double">{newProduct.name || 'PLATILLO SIN NOMBRE'}</h1>
                                                </div>
                                                <div className="z-10 bg-white px-2">
                                                    {/* Empty for spacing or logo */}
                                                </div>
                                                <div className="z-10 bg-white px-2 text-sm font-bold">
                                                    No. {newProduct.recipe_no || '---'}
                                                </div>
                                            </div>

                                            {/* Info Grid Table with Photo Box */}
                                            <div className="flex border-b-2 border-black">
                                                {/* Labels Side */}
                                                <div className="flex-1 border-r-2 border-black">
                                                    {[
                                                        { label: 'Clasificación:', value: newProduct.classification },
                                                        { label: 'Núm. de porciones:', value: newProduct.portions },
                                                        { label: 'Tamaño de la porción:', value: newProduct.portion_size },
                                                        { label: 'Temperatura de servicio:', value: newProduct.serving_temp },
                                                        { label: 'Tiempo de elaboración:', value: newProduct.prep_time },
                                                        { label: 'Fecha:', value: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) },
                                                        { label: 'Elaborado por:', value: newProduct.prepared_by }
                                                    ].map((row, i) => (
                                                        <div key={i} className="flex border-b border-black last:border-b-0 h-[26px] items-center px-3 bg-white">
                                                            <span className="text-[10px] font-bold w-44 uppercase flex items-center leading-none tracking-tight">{row.label}</span>
                                                            <span className="text-[10px] font-black uppercase text-left flex-1 truncate pl-4">{row.value || ''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Photo Side */}
                                                <div className="w-[180px] flex flex-col items-center justify-center p-1 bg-white">
                                                    {newProduct.image_url ? (
                                                        <img src={newProduct.image_url} className="max-w-full max-h-44 object-contain" alt="Dish" />
                                                    ) : (
                                                        <div className="w-full h-full border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-300">
                                                            <ImageIcon size={32} strokeWidth={1} />
                                                            <span className="text-[8px] font-black uppercase mt-1">FOTOGRAF├ìA</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Ingredients Table */}
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-200 border-b-2 border-black text-[10px] font-black uppercase">
                                                        <th className="border-r border-black p-1 w-20 text-center">Cantidad</th>
                                                        <th className="border-r border-black p-1 w-32 text-center">Unidad de Medida</th>
                                                        <th className="border-r border-black p-1 text-center">Ingrediente</th>
                                                        <th className="p-1 w-48 text-center">Especificaciones t├®cnicas</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* Actual Items */}
                                                    {recipeItems.map((item, idx) => (
                                                        <tr key={idx} className="border-b border-black text-[10px] h-7">
                                                            <td className="border-r border-black text-center font-bold">{item.quantity}</td>
                                                            <td className="border-r border-black text-center uppercase">{item.unit_measure || '---'}</td>
                                                            <td className="border-r border-black px-2 uppercase font-black">{item.inventory_items?.name}</td>
                                                            <td className="px-2 text-[9px] italic text-gray-600">---</td>
                                                        </tr>
                                                    ))}
                                                    {/* Empty Filler Rows */}
                                                    {Array.from({ length: Math.max(0, 15 - recipeItems.length) }).map((_, i) => (
                                                        <tr key={`empty-${i}`} className="border-b border-black h-7">
                                                            <td className="border-r border-black"></td>
                                                            <td className="border-r border-black"></td>
                                                            <td className="border-r border-black"></td>
                                                            <td></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            {/* Preparaci├│n Section */}
                                            <div className="bg-gray-200 border-y-2 border-black text-center py-1">
                                                <h3 className="text-[10px] font-black uppercase tracking-widest">Preparaci├│n</h3>
                                            </div>
                                            <div className="p-3 min-h-[150px] border-b-2 border-black">
                                                <p className="text-[10px] leading-relaxed text-left whitespace-pre-wrap uppercase font-medium">
                                                    {newProduct.prep_procedure || 'Sin procedimiento descrito.'}
                                                </p>
                                            </div>

                                            {/* Observations Section */}
                                            <div className="p-3">
                                                <div className="flex gap-2">
                                                    <span className="text-[10px] font-black uppercase">Observaciones:</span>
                                                    <div className="flex-1 border-b border-black min-h-[60px]">
                                                        <p className="text-[9px] italic uppercase text-gray-700">
                                                            {newProduct.observations || ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer Print Info */}
                                        <div className="mt-4 flex justify-between text-[8px] font-bold text-gray-400 uppercase italic">
                                            <span>Documento Generado por Antigravity OS</span>
                                            <span>Restaurante Las Palmas ÔÇó Guatemala</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-4 py-2 bg-[#e1e5eb] border-t border-gray-300 flex justify-between items-center shrink-0 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ficha T├®cnica Pro ÔÇó v2.0 ÔÇó Antigravity OS</span>
                                    </div>
                                    <button onClick={() => setShowTechnicalModal(false)} className="px-6 h-8 bg-white border border-gray-400 text-slate-500 text-[9px] font-black uppercase shadow-sm hover:bg-gray-50 transition-all hover:border-gray-500 active:bg-gray-100">Cerrar Ventana</button>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>
                </div>,
                document.body
            )}

            {/* Config Modal for Recipe Items (EXACT 100% ORIGINAL MATCH) */}
            {configModal && createPortal(
                <div className="fixed inset-0 z-[9000000] flex items-center justify-center p-4 pointer-events-none">
                     <div className="absolute inset-0 pointer-events-auto" onClick={() => setConfigModal(null)}></div>
                     <div className="pointer-events-auto">
                        <DraggableWindow>
                            <div className="bg-[#f0f0f0] border border-[#707070] shadow-xl w-[450px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                                <div className="modal-header bg-white h-7 px-3 flex items-center justify-between border-b border-gray-300 shrink-0 cursor-move select-none">
                                    <span className="text-[11px] font-medium text-black">Configuraci├│n - Esc (Cerrar)</span>
                                    <button onClick={() => setConfigModal(null)} className="hover:bg-red-500 hover:text-white w-7 h-7 flex items-center justify-center transition-colors text-black font-bold text-xs">Ô£ò</button>
                                </div>
                                <div className="p-5 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[11px] font-bold text-gray-600 w-20 shrink-0">Producto</label>
                                        <div className="flex-1 h-7 bg-white border border-gray-300 px-2 flex items-center">
                                            <span className="text-[11px] font-bold text-black uppercase truncate">{configModal.item.name || configModal.item.nombre}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <label className="text-[11px] font-bold text-gray-600 w-20 shrink-0">Cantidad</label>
                                        <div className="flex-1 flex items-center gap-2">
                                            <input 
                                                autoFocus
                                                type="text" 
                                                className="w-28 h-7 bg-white border border-gray-300 px-2 text-[12px] font-bold text-[#106ebe] outline-none text-center"
                                                value={configModal.quantity}
                                                onChange={e => setConfigModal({ ...configModal, quantity: e.target.value.replace(/[^0-9.]/g, '') })}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        setRecipeItems([...recipeItems, { 
                                                            inventory_item_id: configModal.item.id, 
                                                            quantity: configModal.quantity, 
                                                            unit_measure: configModal.unit, 
                                                            inventory_items: configModal.item 
                                                        }]);
                                                        setConfigModal(null);
                                                        setSearchModal({ ...searchModal, visible: false, type: null, query: '' });
                                                    }
                                                }}
                                            />
                                            <select 
                                                className="flex-1 h-7 bg-white border border-gray-300 text-[11px] font-medium text-black outline-none"
                                                value={configModal.unit}
                                                onChange={e => setConfigModal({ ...configModal, unit: e.target.value })}
                                            >
                                                <option value="unidad">unidad</option>
                                                <option value="Libra">Libra</option>
                                                <option value="Onza">Onza</option>
                                                <option value="Kilo">Kilo</option>
                                                <option value="Docena">Docena</option>
                                                <option value="Cento">Cento</option>
                                                <option value="Bolsa">Bolsa</option>
                                                <option value="Garrafon">Garrafon</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex justify-center pt-2">
                                        <button 
                                            onClick={() => {
                                                setRecipeItems([...recipeItems, { 
                                                    inventory_item_id: configModal.item.id, 
                                                    quantity: configModal.quantity, 
                                                    unit_measure: configModal.unit, 
                                                    inventory_items: configModal.item 
                                                }]);
                                                setConfigModal(null);
                                                setSearchModal({ ...searchModal, visible: false, type: null, query: '' });
                                            }}
                                            className="px-10 h-8 bg-[#106ebe] text-white text-[11px] font-bold uppercase shadow-[2px_2px_5px_rgba(0,0,0,0.1)] hover:brightness-110 transition-all rounded-[3px] flex items-center justify-center border border-[#0d599c] active:translate-y-[1px]"
                                        >Agregar</button>
                                    </div>
                                </div>
                            </div>
                        </DraggableWindow>
                     </div>
                </div>,
                document.body
            )}

        {/* Quick New Category Modal */}
        {showQuickCatModal && createPortal(
            <div className="fixed inset-0 z-[3000000] flex items-center justify-center p-4 bg-black/20 pointer-events-auto">
                <div className="pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[350px] bg-[#f0f0f0] border-2 border-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="modal-header px-4 py-2 bg-[#106ebe] flex items-center justify-between cursor-move select-none">
                                <div className="flex items-center gap-2">
                                    <FolderPlus size={14} className="text-white" />
                                    <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">Nueva Categor├¡a ({modalType === 'platillo' ? 'Venta' : 'Inventario'})</h3>
                                </div>
                                <button onClick={() => setShowQuickCatModal(false)} className="text-white/60 hover:text-white hover:bg-red-500 w-6 h-6 flex items-center justify-center transition-all">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-4 bg-white m-1 border border-gray-300 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre de Categor├¡a</label>
                                    <input 
                                        autoFocus
                                        type="text" 
                                        className="w-full h-8 bg-white border border-gray-300 px-3 text-[11px] font-black uppercase outline-none focus:border-[#106ebe]"
                                        value={newCatName}
                                        onChange={e => setNewCatName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveQuickCategory()}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setShowQuickCatModal(false)}
                                        className="flex-1 py-1.5 bg-white border border-gray-400 text-[10px] font-bold uppercase hover:bg-gray-100 shadow-sm"
                                    >Cancelar</button>
                                    <button 
                                        onClick={handleSaveQuickCategory}
                                        disabled={isSaving || !newCatName.trim()}
                                        className="flex-1 py-1.5 bg-[#106ebe] text-white text-[10px] font-black uppercase hover:bg-[#0d5aa0] shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>
            </div>,
            document.body
        )}

        {/* Recipe Context Menu Portal */}
        {recipeContextMenu.visible && createPortal(
            <>
                <div className="fixed inset-0 z-[10000000]" onClick={() => setRecipeContextMenu({ ...recipeContextMenu, visible: false })}></div>
                <div 
                    className="fixed z-[10000001] w-48 bg-white border border-gray-400 shadow-[4px_4px_15px_rgba(0,0,0,0.2)] py-1 animate-in zoom-in-95 duration-100"
                    style={{ left: recipeContextMenu.x, top: recipeContextMenu.y }}
                >
                    <button 
                        onClick={() => { 
                            setSearchModal({ visible: true, type: 'inventory', query: '' });
                            setRecipeContextMenu({ ...recipeContextMenu, visible: false }); 
                        }}
                        className="w-full flex items-center gap-3 px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-[#106ebe] hover:text-white transition-none group"
                    >
                        <Plus size={14} className="text-[#106ebe] group-hover:text-white" />
                        <span className="uppercase tracking-tight">Agregar Insumo</span>
                    </button>
                    <button 
                        disabled={recipeContextMenu.itemIdx === undefined}
                        onClick={() => { 
                            if (recipeContextMenu.itemIdx !== undefined) {
                                setRecipeItems(prev => prev.filter((_, i) => i !== recipeContextMenu.itemIdx));
                            }
                            setRecipeContextMenu({ ...recipeContextMenu, visible: false }); 
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-1.5 text-[10px] font-bold transition-none group ${recipeContextMenu.itemIdx === undefined ? 'opacity-30 cursor-not-allowed text-gray-400' : 'text-slate-700 hover:bg-[#106ebe] hover:text-white'}`}
                    >
                        <Trash2 size={13} className={recipeContextMenu.itemIdx === undefined ? 'text-gray-300' : 'text-red-500 group-hover:text-white'} />
                        <span className="uppercase tracking-tight">Quitar Insumo</span>
                    </button>
                </div>
            </>,
            document.body
        )}
        </>
    );
};

