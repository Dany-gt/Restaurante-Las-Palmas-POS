import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useReactToPrint } from 'react-to-print';
import { Search, Plus, Edit2, Trash2, Folder, Package, X, RefreshCw, ChefHat, FolderOpen, Layers, Save, Check, Image as ImageIcon, Printer, FileText, Sparkles, Loader2, AlertCircle, FolderPlus, Settings } from 'lucide-react';
import { ConfirmDialog } from '../ConfirmDialog';
// ••• SIDEBARS INDEPENDIENTES POR DOMINIO •••••••••••••
import { MenuCategorySidebar } from '../menu/MenuCategorySidebar';       // D1: menu_categories
import { ProductCategorySidebar } from '../products/ProductCategorySidebar'; // D2: product_categories
// D3 y D4 se usan en InventarioUnificado (insumos/utensilios)
import { ListadoPlatillos } from './ListadoPlatillos';
import { ListadoProductos } from './ListadoProductos';
import { PlatilloModal } from './PlatilloModal';
import { ProductoModal } from './ProductoModal';
import { InventoryKardex } from '../InventoryKardex';
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
    
    // ••• ESTADO DE CATEGORÍA POR DOMINIO (Multi-Select con Sets) ••
    // D1: Menú — solo lee menu_categories
    const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());
    // D2: Productos — solo lee product_categories
    const [selectedProdIds, setSelectedProdIds] = useState<Set<string>>(new Set());
    
    // Alias para compatibilidad con listados (puedes pasarlos directamente)
    const categoriaMenuSel = selectedMenuIds;
    const categoriaProdSel = selectedProdIds;

    // Estados para Modales de Edición
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
    const [branchInventory, setBranchInventory] = useState<any[]>([]);
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
    const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'platillo' | 'producto' | 'categoria' } | null>(null);
    const [isImproving, setIsImproving] = useState(false);
    const [openPicker, setOpenPicker] = useState<'category' | 'supplier' | null>(null);
    const [recipeContextMenu, setRecipeContextMenu] = useState<{ visible: boolean, x: number, y: number, itemIdx?: number }>({ visible: false, x: 0, y: 0 });

    // Kardex Modal State
    const [showKardexMode, setShowKardexMode] = useState(false);
    const [kardexItemId, setKardexItemId] = useState<string | null>(null);

    // ••• SIDEBAR RESIZING STATE •••
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('pos_sidebar_width');
        return saved ? parseInt(saved) : 210;
    });
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    const stopResizing = () => {
        setIsResizing(false);
        localStorage.setItem('pos_sidebar_width', sidebarWidth.toString());
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        const newWidth = e.clientX;
        // Límites: mínimo 140px, máximo 600px
        if (newWidth >= 140 && newWidth <= 600) {
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
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, sidebarWidth]);

    const getCompatibleUnits = (baseUnit: string) => {
        const lowerBase = (baseUnit || '').toLowerCase();
        
        // GRUPO PESO (Masa)
        if (['libra', 'lb', 'kilo', 'kg', 'gramo', 'gr', 'onza', 'onz'].includes(lowerBase)) {
            return ['Onza', 'Gramo'];
        }
        
        // GRUPO VOLUMEN (Líquidos)
        if (['litro', 'lt', 'ml', 'mililitro', 'onza (liq)', 'onza liq', 'frasco', 'botella', 'galon'].includes(lowerBase)) {
            return ['Mililitro', 'Onza'];
        }
        
        // TODO LO DEMÁS (Unidades, Cajas, etc.) -> Mostrar la unidad base y 'Unidad'
        const units = [baseUnit || 'Unidad'];
        if (!units.some(u => u.toLowerCase() === 'unidad')) units.push('Unidad');
        return [...new Set(units.map(u => u.charAt(0).toUpperCase() + u.slice(1).toLowerCase()))];
    };

    const handleImproveText = async (field: 'prep_procedure' | 'observations') => {
        const textToImprove = newProduct[field];
        if (!textToImprove) {
            notify.info('Por favor, escribe un borrador primero para que la IA pueda mejorarlo.');
            return;
        }

        setIsImproving(true);
        try {
            const systemPrompt = 'Eres un experto en redacción técnica culinaria. ' +
                'Revisa el siguiente texto para corregir errores ortográficos, gramaticales y de puntuación, mejorando la fluidez sin alterar el contenido original. ' +
                'Devuelve ÚNICAMENTE el texto corregido.';

            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.0-flash',
                    prompt: systemPrompt + '\n\nTEXTO A MEJORAR:\n' + textToImprove,
                    temperature: 0.3
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Error al conectar con la IA');
            }

            const improvedText = data.text?.trim();

            if (improvedText) {
                setNewProduct(prev => ({ ...prev, [field]: improvedText }));
                notify.success('Texto optimizado por la IA correctamente.');
            } else {
                notify.info('La IA no pudo procesar el texto.');
            }
        } catch (error: any) {
            console.error('Error improving text:', error);
            notify.error('Error IA: ' + error.message);
        } finally {
            setIsImproving(false);
        }
    };

    const [menuCategories, setMenuCategories] = useState<any[]>([]);
    const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            const [brRes, invCatRes, kRes, optRes, modRes, invRes, supRes, menuCatRes] = await Promise.all([
                supabase.from('branches').select('*').order('name'),
                supabase.from('product_categories').select('*').order('nombre'),
                supabase.from('kitchen_stations').select('*').order('name'),
                supabase.from('option_groups').select('*').order('name'),
                supabase.from('modifier_groups').select('*').order('name'),
                supabase.from('products').select('*, product_categories!product_category_id(nombre)').eq('es_platillo', false).order('name'),
                supabase.from('suppliers').select('*').order('name'),
                supabase.from('menu_categories').select('*').order('nombre')
            ]);

            if (brRes.data) setBranches(brRes.data);
            if (menuCatRes.data) {
                const mapped = menuCatRes.data.map(c => ({ id: c.id, name: c.nombre }));
                setMenuCategories(mapped);
            }
            if (invCatRes.data) {
                const mapped = invCatRes.data.map(c => ({ ...c, name: c.nombre }));
                setInventoryCategories(mapped);
            }
            if (kRes.data) setKitchens(kRes.data);
            if (optRes.data) setOptionGroups(optRes.data);
            if (modRes.data) setModifierGroups(modRes.data);
            if (invRes.data) {
                const mapped = invRes.data.map((i: any) => ({
                    ...i,
                    nombre: i.name,
                    codigo: i.product_code,
                    presentacion: i.unit_measure,
                    categoria: i.product_categories?.nombre || 'SIN CATEGORÍA'
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

    // Handle Escape key for Config Modal
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setConfigModal(null);
        };
        if (configModal) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [configModal]);
    
    // Estados para Acciones Rápidas
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
            if (type === 'platillo') {
                // Cargar desde tabla 'products'
                const { data: prodData } = await supabase.from('products').select('*').eq('id', id).single();
                if (prodData) {
                    setNewProduct({
                        ...prodData,
                        category_id: prodData.menu_category_id || '',  // Mapeamos a category_id para el modal, pero viene de menu_category_id
                        product_code: prodData.product_code || '',
                        name: prodData.name || '',
                        cost_price: (prodData.cost_price || 0).toString(),
                        portions: (prodData.portions || 1).toString(),
                        unit_measure: prodData.unit_measure || 'LB',
                        presentation_unit: prodData.presentation_unit || 'UNI',
                        conversion_factor: (prodData.conversion_factor || 1).toString(),
                        supplier_id: prodData.supplier_id || ''
                    });

                    // Precios por Sucursal
                    const { data: bpData } = await supabase.from('product_branch_prices').select('*').eq('product_id', id);
                    const fullBranchPrices = branches.map(b => {
                        const existing = bpData?.find(bp => bp.branch_id === b.id);
                        return existing ? {
                            ...existing,
                            price: (existing.price || 0).toString(),
                            delivery_price: (existing.delivery_price || 0).toString(),
                            platform_price: (existing.platform_price || 0).toString()
                        } : { branch_id: b.id, price: '0', delivery_price: '0', platform_price: '0', is_enabled: true };
                    });
                    setBranchPrices(fullBranchPrices);

                    // Receta
                    const { data: recipeData } = await supabase.from('product_recipes').select('*, inventory_items(*)').eq('product_id', id);
                    if (recipeData) setRecipeItems(recipeData);

                    // Modificadores y Opciones
                    const { data: modData } = await supabase.from('product_modifier_groups').select('*').eq('product_id', id);
                    const { data: optData } = await supabase.from('product_option_groups').select('*').eq('product_id', id);
                    if (modData) setAssignedModifierGroups(modData);
                    if (optData) setAssignedOptionGroups(optData);
                }
            } else {
                // Cargar desde tabla 'products' con es_platillo=false
                const { data: insumoData } = await supabase.from('products').select('*').eq('id', id).eq('es_platillo', false).single();
                if (insumoData) {
                    setNewProduct({
                        ...insumoData,
                        category_id: insumoData.product_category_id || '', // Mapeamos a category_id para el modal, pero viene de product_category_id
                        product_code: insumoData.product_code || '',
                        name: insumoData.name || '',
                        cost_price: (insumoData.cost_price || 0).toString(),
                        unit_measure: insumoData.unit_measure || 'LB',
                        presentation_unit: insumoData.presentation_unit || 'UNI',
                        conversion_factor: (insumoData.conversion_factor || 1).toString(),
                        supplier_id: insumoData.supplier_id || '',
                        is_enabled: insumoData.is_enabled !== undefined ? insumoData.is_enabled : true,
                        price: '0',
                        portions: '1',
                    });
                    // Insumos no tienen precios por sucursal ni receta ni modificadores
                    setBranchPrices([]);
                    setAssignedModifierGroups([]);
                    setAssignedOptionGroups([]);
                    
                    // Receta para Insumos (Carga en dos pasos para evitar error 400)
                    const { data: recipeData, error: recipeError } = await supabase
                        .from('product_recipes')
                        .select('*')
                        .eq('product_id', id);
                    
                    if (recipeError) {
                        console.warn('Error al cargar receta:', recipeError.message);
                    } else if (recipeData && recipeData.length > 0) {
                        // Traer detalles de los ingredientes de forma manual
                        const itemIds = recipeData.map(r => r.inventory_item_id).filter(Boolean);
                        const { data: itemsDetail } = await supabase
                            .from('products')
                            .select('*')
                            .in('id', itemIds);
                            
                        const fullRecipe = recipeData.map(r => ({
                            ...r,
                            inventory_items: itemsDetail?.find(detail => detail.id === r.inventory_item_id)
                        }));
                        setRecipeItems(fullRecipe);
                    } else {
                        setRecipeItems([]);
                    }

                    // Inventario por Sucursal para Insumos
                    const { data: invData, error: invError } = await supabase.from('product_branch_inventory').select('*').eq('product_id', id);
                    if (invError) console.warn('product_branch_inventory no disponible:', invError.message);
                    const fullBranchInventory = branches.map(b => {
                        const existing = invData?.find(i => i.branch_id === b.id);
                        return existing ? {
                            ...existing,
                            quantity: (existing.quantity || 0).toString(),
                            min_stock: (existing.min_stock || 0).toString(),
                            is_enabled: existing.is_enabled !== undefined ? existing.is_enabled : true,
                            is_assigned: existing.is_assigned !== undefined ? existing.is_assigned : true
                        } : { branch_id: b.id, quantity: '0', min_stock: '0', is_enabled: true, is_assigned: true };
                    });
                    setBranchInventory(fullBranchInventory);
                }
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
        setBranchInventory([]);
        setAssignedModifierGroups([]);
        setAssignedOptionGroups([]);
        setEditingId(null);
    };

    const handleNew = (type: 'platillo' | 'producto') => {
        resetForm();
        setModalType(type);
        setShowModal(true);
        setActiveTab('general');
        
        // --- AUTO-FILL CATEGORY FROM SIDEBAR SELECTION ---
        const currentSelection = type === 'platillo' ? selectedMenuIds : selectedProdIds;
        const defaultCategoryId = Array.from(currentSelection)[0] || '';
        if (defaultCategoryId) {
            setNewProduct(prev => ({ ...prev, category_id: defaultCategoryId }));
        }

        // Inicializar precios por sucursal con todas las sucursales disponibles
        setBranchPrices(branches.map(b => ({
            branch_id: b.id,
            price: '0',
            delivery_price: '0',
            platform_price: '0',
            is_enabled: true
        })));

        if (type === 'producto') {
            setBranchInventory(branches.map(b => ({
                branch_id: b.id,
                quantity: '0',
                min_stock: '0',
                is_enabled: true
            })));
        }
    };

    const handleSave = async () => {
        if (!newProduct.name || !newProduct.category_id) {
            notify.error('El nombre y la categoría son obligatorios');
            return;
        }

        setIsSaving(true);
        
        try {
            let savedId = editingId;
            const isPlatillo = modalType === 'platillo';

            if (isPlatillo) {
                // =====================================================
                // MÓDULO MENÚ DE PLATILLOS — tabla: products
                // =====================================================
                const dishData = {
                    product_code: (newProduct.product_code || '').toUpperCase(),
                    name: (newProduct.name || '').toUpperCase(),
                    short_name: (newProduct.short_name || '').toUpperCase() || null,
                    description: newProduct.description || null,
                    category_id: null, // Evitamos el FK error usando null en la columna vieja
                    menu_category_id: newProduct.category_id || null, // Guardamos en la columna de menú
                    price: parseFloat(newProduct.price) || 0,
                    cost_price: parseFloat(newProduct.cost_price) || 0,
                    kitchen_station_id: newProduct.kitchen_station_id || null,
                    image_url: newProduct.image_url || null,
                    is_enabled: newProduct.is_enabled !== undefined ? newProduct.is_enabled : true,
                    is_available: true,
                    es_platillo: true,                                  // MARCA: es platillo
                    portions: parseInt(newProduct.portions) || 1,
                    prep_procedure: newProduct.prep_procedure || null,
                    classification: newProduct.classification || null,
                    portion_size: newProduct.portion_size || null,
                    serving_temp: newProduct.serving_temp || null,
                    prep_time: newProduct.prep_time || null,
                    prepared_by: newProduct.prepared_by || null,
                    observations: newProduct.observations || null,
                };

                if (editingId) {
                    const { error } = await supabase.from('products').update(dishData).eq('id', editingId);
                    if (error) throw error;
                } else {
                    const { data, error } = await supabase.from('products').insert(dishData).select();
                    if (error) throw error;
                    if (data?.[0]) savedId = data[0].id;
                }

                if (savedId) {
                    // Precios por Sucursal
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

                    // Receta Técnica
                    await supabase.from('product_recipes').delete().eq('product_id', savedId);
                    if (recipeItems.length > 0) {
                        const rData = recipeItems.map(ri => ({
                            product_id: savedId,
                            inventory_item_id: ri.inventory_item_id,
                            quantity: parseFloat(ri.quantity) || 0,
                            unit_measure: ri.unit_measure || 'Unidades'
                        }));
                        await supabase.from('product_recipes').insert(rData);
                    }

                    // Modificadores y Opciones
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
                }
            } else {
                // =====================================================
                // MÓDULO INVENTARIO — tabla: products, es_platillo=false
                // =====================================================
                const insumoData = {
                    product_code: (newProduct.product_code || '').toUpperCase(),
                    name: (newProduct.name || '').toUpperCase(),
                    short_name: (newProduct.short_name || '').toUpperCase() || null,
                    description: newProduct.description || null,
                    category_id: null, // Evitamos el FK error usando null en la columna vieja
                    product_category_id: newProduct.category_id || null, // Guardamos en la columna de productos
                    unit_measure: newProduct.unit_measure || '',
                    presentation_unit: newProduct.presentation_unit || '',
                    conversion_factor: parseFloat(newProduct.conversion_factor) || 1,
                    cost_price: parseFloat(newProduct.cost_price) || 0,
                    price: 0,
                    supplier_id: newProduct.supplier_id || null,
                    is_enabled: newProduct.is_enabled !== undefined ? newProduct.is_enabled : true,
                    es_platillo: false,  // MARCA: es insumo/producto
                    image_url: newProduct.image_url || null,
                };

                savedId = editingId;
                if (editingId) {
                    const { error } = await supabase.from('products').update(insumoData).eq('id', editingId);
                    if (error) throw error;
                } else {
                    const { data, error } = await supabase.from('products').insert(insumoData).select();
                    if (error) throw error;
                    if (data?.[0]) savedId = data[0].id;
                }
                if (savedId) {
                    const invData = branchInventory.map(bi => ({
                        product_id: savedId,
                        branch_id: bi.branch_id,
                        quantity: parseFloat(bi.quantity) || 0,
                        min_stock: parseFloat(bi.min_stock) || 0,
                        is_enabled: bi.is_enabled !== undefined ? bi.is_enabled : true,
                        is_assigned: bi.is_assigned !== undefined ? bi.is_assigned : true
                    }));
                    await supabase.from('product_branch_inventory').upsert(invData, { onConflict: 'product_id,branch_id' });
                }

                // Receta para Insumos
                const { error: delError } = await supabase.from('product_recipes').delete().eq('product_id', savedId);
                if (delError) console.warn('Aviso: No se pudo limpiar receta previa:', delError.message);

                if (recipeItems.length > 0) {
                    const rData = recipeItems.map(ri => ({
                        product_id: savedId,
                        inventory_item_id: ri.inventory_item_id,
                        quantity: parseFloat(ri.quantity) || 0,
                        unit_measure: ri.unit_measure || ri.inventory_items?.unit_measure || 'Unidades'
                    }));
                    const { error: insError } = await supabase.from('product_recipes').insert(rData);
                    if (insError) throw new Error('Error al guardar componentes de la receta: ' + insError.message);
                }
            }

            notify.success('Registro guardado correctamente');
            handleRefresh();
            setShowModal(false);
            resetForm();
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

    const handleDelete = async (id: string, type: 'platillo' | 'producto' | 'categoria') => {
        setConfirmDelete({ id, type });
    };

    const executeDelete = async () => {
        if (!confirmDelete) return;
        const { id, type } = confirmDelete;
        setConfirmDelete(null);

        try {
            if (type === 'categoria') {
                const { error } = await supabase.from('categories').delete().eq('id', id);
                if (error) throw error;
                notify.success('Categoría eliminada');
            } else {
                // Ambos (platillo e insumo) viven en tabla 'products'
                const { error } = await supabase.from('products').delete().eq('id', id);
                if (error) throw error;
                notify.success(`${type === 'platillo' ? 'Platillo' : 'Insumo'} eliminado`);
            }
            handleRefresh();
        } catch (e: any) {
            notify.error('Error al eliminar: ' + e.message);
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
                        onClick={() => { setSelectedMenuIds(new Set()); setSelectedProdIds(new Set()); }}
                        className="px-4 h-5 bg-[#106ebe] text-white text-[9px] font-black uppercase hover:bg-[#0d5aa0] shadow-sm transition-all"
                    >
                        Mostrar Todos
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* ••• SIDEBAR CORRECTO POR DOMINIO •••
                    D1: Menú → MenuCategorySidebar (lee SOLO menu_categories)
                    D2: Productos → ProductCategorySidebar (lee SOLO product_categories) */}
                {initialTab === 'platillos' ? (
                    <MenuCategorySidebar
                        width={sidebarWidth}
                        selectedIds={selectedMenuIds}
                        onToggle={(id, childrenIds) => {
                            setSelectedMenuIds(prev => {
                                // Seleccion única estricta: si ya está seleccionado, lo quitamos, si no, es el único seleccionado
                                if (prev.has(id)) return new Set();
                                return new Set([id]);
                            });
                        }}
                    />
                ) : (
                    <ProductCategorySidebar
                        width={sidebarWidth}
                        selectedIds={selectedProdIds}
                        onToggle={(id) => {
                            setSelectedProdIds(prev => {
                                // Seleccion única estricta: si ya está seleccionado, lo quitamos, si no, es el único seleccionado
                                if (prev.has(id)) return new Set();
                                return new Set([id]);
                            });
                        }}
                    />
                )}

                {/* RESIZER HANDLE */}
                <div 
                    onMouseDown={startResizing}
                    className={`w-[4px] h-full cursor-col-resize shrink-0 transition-colors z-50 ${isResizing ? 'bg-[#106ebe]' : 'bg-gray-200 hover:bg-gray-400 opacity-50 hover:opacity-100'}`}
                    title="Arrastrar para redimensionar"
                />

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
                            onKardex={(id) => { setKardexItemId(id); setShowKardexMode(true); }}
                        />
                    )}
                </div>
            </div>
        </div>

        {/* Quick Change Modal (Categoría / Cocina) */}
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
                                            {showQuickModal === 'category' ? 'Seleccionar Nueva Categoría' : 'Seleccionar Estación de Cocina'}
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
            {modalType === 'platillo' && (
                <PlatilloModal 
                    isOpen={showModal}
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
                    setShowTechnicalModal={setShowTechnicalModal}
                />
            )}

            {modalType === 'producto' && (
                <ProductoModal 
                    isOpen={showModal}
                    onClose={() => { setShowModal(false); resetForm(); }}
                    editingId={editingId}
                    newProduct={newProduct}
                    setNewProduct={setNewProduct}
                    handleSave={handleSave}
                    isSaving={isSaving}
                    inventoryCategories={inventoryCategories}
                    suppliers={suppliers}
                    branches={branches}
                    branchInventory={branchInventory}
                    setBranchInventory={setBranchInventory}
                    recipeItems={recipeItems}
                    setRecipeItems={setRecipeItems}
                    searchModal={setSearchModal}
                    setRecipeContextMenu={setRecipeContextMenu}
                    setShowQuickCatModal={setShowQuickCatModal}
                    openPicker={openPicker}
                    setOpenPicker={setOpenPicker}
                />
            )}

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
                        <DraggableWindow>
                            <div className="bg-[#f0f0f0] border border-[#106ebe] w-[800px] h-[530px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                                <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center text-white shrink-0 select-none relative group cursor-move">
                                    <div className="flex items-center gap-2 relative z-10 font-[Arial]">
                                        <Search size={14} className="text-blue-100" />
                                        <span className="text-[10px] font-black uppercase tracking-tight">
                                            {searchModal.type === 'inventory' ? 'Explorador de Insumos' : searchModal.type === 'options' ? 'Listado de Opciones' : 'Listado de Grupos de Modificadores'}
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
                                                <th className="w-20 px-4 text-left text-[9px] font-black text-slate-800 tracking-tight uppercase">CÓDIGO</th>
                                                <th className="px-4 text-left text-[9px] font-black text-slate-800 tracking-tight uppercase border-l border-gray-200">PRODUCTO / INSUMO</th>
                                                <th className="w-32 px-4 text-left text-[9px] font-black text-slate-800 tracking-tight uppercase border-l border-gray-200">PRESENTACIÓN</th>
                                                <th className="w-64 px-4 text-left text-[9px] font-black text-slate-800 tracking-tight uppercase border-l border-gray-200">PROVEEDOR</th>
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
                                                    return itemName.includes(q) || itemCode.includes(q);
                                                })
                                                .map(item => (
                                                    <tr key={item.id} className="h-8 hover:bg-blue-50 border-b border-gray-100 cursor-pointer group transition-all active:bg-[#106ebe]/10" 
                                                        onDoubleClick={() => {
                                                            if (searchModal.type === 'inventory') {
                                                                const units = getCompatibleUnits(item.unit_measure);
                                                                setConfigModal({ item, quantity: '1', unit: units[0] || 'Unidad' });
                                                            } else if (searchModal.type === 'options') {
                                                                if (!assignedOptionGroups.some(g => g.group_id === item.id)) setAssignedOptionGroups([...assignedOptionGroups, { group_id: item.id }]);
                                                                setSearchModal({ ...searchModal, visible: false, type: null, query: '' });
                                                            } else {
                                                                if (!assignedModifierGroups.some(g => g.group_id === item.id)) setAssignedModifierGroups([...assignedModifierGroups, { group_id: item.id }]);
                                                                setSearchModal({ ...searchModal, visible: false, type: null, query: '' });
                                                            }
                                                        }}
                                                    >
                                                        <td className="px-4 font-bold text-slate-400 text-[9px] uppercase tracking-tighter shrink-0">{item.product_code || item.codigo || 'S/C'}</td>
                                                        <td className="px-4 font-black text-slate-700 uppercase group-hover:text-[#106ebe] text-[10px] break-words">{item.name || item.nombre}</td>
                                                        <td className="px-4 text-left font-bold text-slate-500 text-[9px] uppercase">{item.unit_measure || item.presentacion || 'Unidad'}</td>
                                                        <td className="px-4 text-left font-bold text-slate-600 text-[9px] uppercase border-l border-transparent group-hover:border-gray-200 truncate max-w-[250px]">{suppliers.find(s => s.id === item.supplier_id)?.name || 'Sin Proveedor'}</td>
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
                        </DraggableWindow>
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
                                    <div className="flex items-center gap-4 pr-1">
                                        <button onClick={handleSave} className="flex items-center justify-center text-white hover:text-gray-300 transition-colors" title="Guardar Cambios">
                                            <Save size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handlePrint()}
                                            className="flex items-center gap-1.5 text-white hover:text-gray-300 transition-colors"
                                        >
                                            <Printer size={18} />
                                            <span className="text-[11px] font-bold uppercase tracking-wide">Imprimir</span>
                                        </button>
                                        <button onClick={() => setShowTechnicalModal(false)} className="flex items-center justify-center text-white hover:text-red-300 font-black text-[22px] transition-colors ml-2" title="Cerrar">✕</button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#f0f0f0]">
                                    {/* UI VERSION (Editable) */}
                                    <div className="p-5 space-y-5 print:hidden">
                                        {/* SECTION: ESPECIFICACIONES */}
                                        <div className="bg-white border border-[#ced4da] shrink-0">
                                            <div className="bg-[#f1f5f9] px-3 py-1.5 border-b border-[#ced4da] flex items-center">
                                                <h4 className="text-[11px] font-bold text-[#106ebe] uppercase tracking-wide">Especificaciones del Platillo</h4>
                                            </div>
                                            <div className="p-3 space-y-3">
                                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                                    {/* left col */}
                                                    <div className="space-y-2">
                                                        <div className="flex items-center">
                                                            <label className="text-[11px] font-bold text-[#64748b] w-[130px] shrink-0 uppercase">Clasificación</label>
                                                            <input type="text" placeholder="EJ. PLATILLO FUERTE" className="flex-1 h-[26px] bg-white border border-[#ced4da] px-2 text-[10px] font-bold text-slate-700 uppercase outline-none focus:border-[#106ebe]" value={newProduct.classification || ''} onChange={e => setNewProduct({...newProduct, classification: e.target.value.toUpperCase()})} />
                                                        </div>
                                                        <div className="flex items-center">
                                                            <label className="text-[11px] font-bold text-[#64748b] w-[130px] shrink-0 uppercase">Núm. Porciones</label>
                                                            <div className="flex-1 relative flex">
                                                                <input type="text" className="w-full h-[26px] bg-white border border-[#ced4da] px-2 text-[10px] font-bold text-center text-[#106ebe] uppercase outline-none focus:border-[#106ebe] border-r-0" value={newProduct.portions || '1'} onChange={e => setNewProduct({...newProduct, portions: e.target.value})} />
                                                                <div className="h-[26px] px-2 bg-[#f8fafc] border border-[#ced4da] text-[8px] font-bold text-[#94a3b8] flex items-center justify-center pointer-events-none">UNID</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <label className="text-[11px] font-bold text-[#64748b] w-[130px] shrink-0 uppercase">Temp. Servicio</label>
                                                            <input type="text" className="flex-1 h-[26px] bg-white border border-[#ced4da] px-2 text-[10px] font-bold text-slate-700 uppercase outline-none focus:border-[#106ebe]" value={newProduct.serving_temp || ''} onChange={e => setNewProduct({...newProduct, serving_temp: e.target.value.toUpperCase()})} />
                                                        </div>
                                                        <div className="flex items-center">
                                                            <label className="text-[11px] font-bold text-[#64748b] w-[130px] shrink-0 uppercase">Elaborado Por</label>
                                                            <input type="text" className="flex-1 h-[26px] bg-white border border-[#ced4da] px-2 text-[10px] font-bold text-slate-700 uppercase outline-none focus:border-[#106ebe]" value={newProduct.prepared_by || ''} onChange={e => setNewProduct({...newProduct, prepared_by: e.target.value.toUpperCase()})} />
                                                        </div>
                                                    </div>
                                                    {/* right col */}
                                                    <div className="space-y-2">
                                                        <div className="flex items-center">
                                                            <label className="text-[11px] font-bold text-[#64748b] w-[130px] shrink-0 uppercase">No. de Receta</label>
                                                            <input type="text" placeholder="EJ. 001" className="flex-1 h-[26px] bg-white border border-[#ced4da] px-2 text-[10px] font-bold text-[#106ebe] uppercase outline-none focus:border-[#106ebe]" value={newProduct.recipe_no || ''} onChange={e => setNewProduct({...newProduct, recipe_no: e.target.value.toUpperCase()})} />
                                                        </div>
                                                        <div className="flex items-center">
                                                            <label className="text-[11px] font-bold text-[#64748b] w-[130px] shrink-0 uppercase">Tamaño Porción</label>
                                                            <input type="text" className="flex-1 h-[26px] bg-white border border-[#ced4da] px-2 text-[10px] font-bold text-slate-700 uppercase outline-none focus:border-[#106ebe]" value={newProduct.portion_size || ''} onChange={e => setNewProduct({...newProduct, portion_size: e.target.value.toUpperCase()})} />
                                                        </div>
                                                        <div className="flex items-center">
                                                            <label className="text-[11px] font-bold text-[#64748b] w-[130px] shrink-0 uppercase">Tiempo Elab.</label>
                                                            <input type="text" className="flex-1 h-[26px] bg-white border border-[#ced4da] px-2 text-[10px] font-bold text-slate-700 uppercase outline-none focus:border-[#106ebe]" value={newProduct.prep_time || ''} onChange={e => setNewProduct({...newProduct, prep_time: e.target.value.toUpperCase()})} />
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-4 pt-1">
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">Preparación / Procedimiento</label>
                                                            <button onClick={() => handleImproveText('prep_procedure')} disabled={isImproving} className="text-amber-500 px-1 border border-gray-200 flex items-center gap-1 bg-[#fcfeff] rounded-[2px]" title="Mejorar redacción con IA">
                                                                {isImproving ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} className="text-amber-400" />}
                                                                <span className="text-[9px] font-bold text-[#106ebe] uppercase tracking-tighter">IA</span>
                                                            </button>
                                                        </div>
                                                        <textarea className="w-full h-[70px] p-2 bg-white border border-[#ced4da] text-[10px] font-bold text-[#64748b] hover:border-[#106ebe] outline-none focus:border-[#106ebe] resize-none uppercase placeholder:text-gray-400 placeholder:font-normal" placeholder="PASOS DE PREPARACIÓN..." value={newProduct.prep_procedure || ''} onChange={e => setNewProduct({...newProduct, prep_procedure: e.target.value})}></textarea>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">Observaciones Adicionales</label>
                                                            <button onClick={() => handleImproveText('observations')} disabled={isImproving} className="text-amber-500 px-1 border border-gray-200 flex items-center gap-1 bg-[#fcfeff] rounded-[2px]" title="Mejorar redacción con IA">
                                                                {isImproving ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} className="text-amber-400" />}
                                                                <span className="text-[9px] font-bold text-[#106ebe] uppercase tracking-tighter">IA</span>
                                                            </button>
                                                        </div>
                                                        <textarea className="w-full h-[70px] p-2 bg-white border border-[#ced4da] text-[10px] font-bold text-[#64748b] hover:border-[#106ebe] outline-none focus:border-[#106ebe] resize-none uppercase placeholder:text-gray-400 placeholder:font-normal" placeholder="NOTAS ADICIONALES..." value={newProduct.observations || ''} onChange={e => setNewProduct({...newProduct, observations: e.target.value})}></textarea>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* INGREDIENTES Y COSTEO */}
                                        <div className="bg-white border border-[#ced4da] flex flex-col relative group">
                                            <div className="bg-[#f1f5f9] px-3 py-1 border-b border-[#ced4da] flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-[11px] font-bold text-[#106ebe] uppercase tracking-wide">Ingredientes y Costeo</h4>
                                                    <span className="bg-[#106ebe] text-white text-[10px] font-bold px-1.5 rounded-[3px] leading-none">{recipeItems.length}</span>
                                                </div>
                                                <span className="text-[9px] font-bold text-[#94a3b8] italic uppercase">* Clic derecho para buscar</span>
                                            </div>
                                            <div 
                                                className="min-h-[160px] max-h-[250px] overflow-auto custom-scrollbar relative bg-white"
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setRecipeContextMenu({
                                                        visible: true,
                                                        x: e.clientX,
                                                        y: e.clientY,
                                                        itemIdx: undefined
                                                    });
                                                }}
                                            >
                                                {recipeItems.length === 0 ? (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#cbd5e1] pointer-events-none">
                                                        <Plus size={24} strokeWidth={1} />
                                                        <span className="text-[9px] font-bold uppercase opacity-80">No hay ingredientes - Clic derecho para buscar</span>
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
                                                                const baseCost = (parseFloat(ri.inventory_items?.cost_price) || 0);
                                                                const conversionFactor = (parseFloat(ri.inventory_items?.conversion_factor) || 1);
                                                                const costPerUnit = baseCost / conversionFactor;
                                                                
                                                                const qty = parseFloat(ri.quantity) || 0;
                                                                let unitInternalFactor = 1;
                                                                const lowerUnit = (ri.unit_measure || '').toLowerCase();
                                                                const baseUnit = (ri.inventory_items?.unit_measure || '').toLowerCase();

                                                                // Conversiones Inteligentes (Basado en Unidad Base)
                                                                if (lowerUnit === 'gramo' && (baseUnit === 'libra' || baseUnit === 'lb')) unitInternalFactor = 1 / 453.592;
                                                                if (lowerUnit === 'onza' && (baseUnit === 'libra' || baseUnit === 'lb')) unitInternalFactor = 1 / 16;
                                                                if (lowerUnit === 'mililitro' && (baseUnit === 'litro' || baseUnit === 'lt')) unitInternalFactor = 1 / 1000;
                                                                if (lowerUnit === 'onza (liq)' && (baseUnit === 'litro' || baseUnit === 'lt')) unitInternalFactor = 1 / 33.814;

                                                                const subtotal = qty * costPerUnit * unitInternalFactor;
                                                                return (
                                                                    <tr 
                                                                        key={idx} 
                                                                        className="h-8 text-[11px] group/row hover:bg-blue-50/40 transition-colors"
                                                                        onContextMenu={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            setRecipeContextMenu({
                                                                                visible: true,
                                                                                x: e.clientX,
                                                                                y: e.clientY,
                                                                                itemIdx: idx
                                                                            });
                                                                        }}
                                                                    >
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
                                                                        <td className="px-4 text-center text-slate-400 font-bold uppercase">{ri.unit_measure || 'unidad'}</td>
                                                                        <td className="px-4 text-right">
                                                                           <div className="flex justify-between items-baseline opacity-80 group-hover/row:opacity-100 transition-opacity">
                                                                                <span className="text-[8px] text-slate-300">Q</span>
                                                                                <span className="font-black text-slate-700">{subtotal.toFixed(2)}</span>
                                                                           </div>
                                                                        </td>
                                                                        <td className="px-2 text-center w-0 p-0 overflow-hidden invisible">
                                                                             {/* Removed trash can to force use of context menu */}
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
                                                            <span className="text-[24px] font-black text-[#106ebe] drop-shadow-sm tabular-nums">
                                                                {recipeItems.reduce((acc, ri) => {
                                                                    const baseCost = (parseFloat(ri.inventory_items?.cost_price) || 0);
                                                                    const conversionFactor = (parseFloat(ri.inventory_items?.conversion_factor) || 1);
                                                                    const costPerUnit = baseCost / conversionFactor;

                                                                    const qty = parseFloat(ri.quantity) || 0;
                                                                    let unitInternalFactor = 1;
                                                                    const lowerUnit = (ri.unit_measure || '').toLowerCase();
                                                                    const baseUnit = (ri.inventory_items?.unit_measure || '').toLowerCase();

                                                                    if (lowerUnit === 'gramo' && (baseUnit === 'libra' || baseUnit === 'lb')) unitInternalFactor = 1 / 453.592;
                                                                    if (lowerUnit === 'onza' && (baseUnit === 'libra' || baseUnit === 'lb')) unitInternalFactor = 1 / 16;
                                                                    if (lowerUnit === 'mililitro' && (baseUnit === 'litro' || baseUnit === 'lt')) unitInternalFactor = 1 / 1000;
                                                                    if (lowerUnit === 'onza (liq)' && (baseUnit === 'litro' || baseUnit === 'lt')) unitInternalFactor = 1 / 33.814;

                                                                    return acc + (qty * costPerUnit * unitInternalFactor);
                                                                }, 0).toFixed(2)}
                                                            </span>
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
                                                <div className="z-10 bg-white px-2 text-sm font-black">
                                                    NO. {newProduct.recipe_no || '---'}
                                                </div>
                                            </div>

                                            {/* Info Grid Table with Photo Box */}
                                            <div className="flex border-b-2 border-black">
                                                {/* Photo Side (NOW LEFT) */}
                                                <div className="w-[180px] flex flex-col items-center justify-center p-1 bg-white border-r-2 border-black">
                                                    {newProduct.image_url ? (
                                                        <img src={newProduct.image_url} className="max-w-full max-h-44 object-contain" alt="Dish" />
                                                    ) : (
                                                        <div className="w-full h-full border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-300">
                                                            <ImageIcon size={32} strokeWidth={1} />
                                                            <span className="text-[8px] font-black uppercase mt-1">FOTOGRAFÍA</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Labels Side (NOW RIGHT) */}
                                                <div className="flex-1">
                                                    <table className="w-full h-full border-collapse">
                                                        <tbody>
                                                            {[
                                                                { label: 'Clasificación:', value: newProduct.classification },
                                                                { label: 'Núm. de porciones:', value: newProduct.portions },
                                                                { label: 'Tamaño de la porción:', value: newProduct.portion_size },
                                                                { label: 'Temperatura de servicio:', value: newProduct.serving_temp },
                                                                { label: 'Tiempo de elaboración:', value: newProduct.prep_time },
                                                                { label: 'Fecha:', value: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) },
                                                                { label: 'Elaborado por:', value: newProduct.prepared_by }
                                                            ].map((row, i) => (
                                                                <tr key={i} className="border-b border-black last:border-b-0 h-7">
                                                                    <td className="w-40 px-3 text-[10px] font-bold uppercase border-r border-black bg-gray-50/30 whitespace-nowrap">{row.label}</td>
                                                                    <td className="px-4 text-[10px] font-black uppercase text-left">{row.value || ''}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Ingredients Table */}
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-200 border-b-2 border-black text-[10px] font-black uppercase">
                                                        <th className="border-r border-black p-1 w-20 text-center">Cantidad</th>
                                                        <th className="border-r border-black p-1 w-32 text-center">Unidad de Medida</th>
                                                        <th className="border-r border-black p-1 text-center">Ingrediente</th>
                                                        <th className="p-1 w-48 text-center">Especificaciones técnicas</th>
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

                                            {/* Preparación Section */}
                                            <div className="bg-gray-200 border-y-2 border-black text-center py-1">
                                                <h3 className="text-[10px] font-black uppercase tracking-widest">Preparación</h3>
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
                                            <span>Restaurante Las Palmas • Guatemala</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-4 py-2 bg-[#e1e5eb] border-t border-gray-300 flex justify-between items-center shrink-0 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ficha Técnica Pro • v2.0 • Antigravity OS</span>
                                    </div>
                                    <button onClick={() => setShowTechnicalModal(false)} className="px-6 h-8 bg-white border border-gray-400 text-slate-500 text-[9px] font-black uppercase shadow-sm hover:bg-gray-50 transition-all hover:border-gray-500 active:bg-gray-100">Cerrar Ventana</button>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>
                </div>,
                document.body
            )}

            {/* Config Modal for Recipe Items (Antigravity OS Standard) */}
            {configModal && createPortal(
                <div className="fixed inset-0 z-[9000000] flex items-center justify-center p-4">
                     {/* Fondo clickable para cerrar (Evita pantalla negra por falta de interacción) */}
                     <div className="absolute inset-0 bg-black/10 pointer-events-auto" onClick={() => setConfigModal(null)}></div>
                     
                     <div className="relative animate-in zoom-in-95 duration-200 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <DraggableWindow>
                            <div className="bg-[#f0f0f0] border border-[#106ebe] shadow-[0_0_40px_rgba(0,0,0,0.4)] w-[400px] overflow-hidden flex flex-col pointer-events-auto">
                                {/* Header: Classic Windows Header */}
                                <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center text-white shrink-0 cursor-move select-none border-b border-[#0d5aa0]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-white/10 rounded-sm flex items-center justify-center">
                                            <Settings size={12} className="text-blue-100" />
                                        </div>
                                        <span className="text-[11px] font-black uppercase tracking-wider">Configuración</span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        <WindowsSaveButton 
                                            variant="minimal"
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
                                            title="Confirmar y Agregar"
                                        />
                                        <button 
                                            onClick={() => setConfigModal(null)} 
                                            className="w-8 h-8 flex items-center justify-center hover:bg-red-500 transition-colors text-white font-black text-sm"
                                        >✕</button>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4">
                                    <div className="bg-white border border-gray-300 p-3 space-y-3 shadow-sm rounded-sm">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                                                Insumo Seleccionado
                                            </label>
                                            <div className="h-7 bg-[#f8fafc] border border-gray-200 px-2 flex items-center">
                                                <span className="text-[11px] font-bold text-slate-700 uppercase truncate italic opacity-80">{configModal.item.name || configModal.item.nombre}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 pt-1">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                                                    Cantidad neta
                                                </label>
                                                <input 
                                                    autoFocus
                                                    type="text" 
                                                    className="w-full h-8 bg-white border border-gray-400 px-3 text-[13px] font-black text-[#106ebe] outline-none text-center focus:border-[#106ebe] focus:ring-1 focus:ring-[#106ebe]/20 transition-all shadow-inner"
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
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                                                    Unidad de Receta
                                                </label>
                                                <select 
                                                    className="w-full h-8 bg-white border border-gray-400 text-[11px] font-black text-slate-700 outline-none px-2 focus:border-[#106ebe] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%23106ebe%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m3%205%203%203%203-3%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_8px_center] bg-no-repeat shadow-inner"
                                                    value={configModal.unit}
                                                    onChange={e => setConfigModal({ ...configModal, unit: e.target.value })}
                                                >
                                                    {getCompatibleUnits(configModal.item.unit_measure).map(u => (
                                                        <option key={u} value={u}>{u}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex bg-[#e2e8f0] p-1 border border-gray-300 rounded-sm">
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
                                            className="w-full h-8 bg-[#106ebe] text-white text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-[#0d5aa0] active:scale-95 transition-all shadow-md group"
                                        >
                                            <Plus size={14} className="group-hover:rotate-90 transition-transform" />
                                            AGREGAR
                                        </button>
                                    </div>
                                    
                                    <div className="flex justify-between items-center px-1">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-[#106ebe]"></div>
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Basado en {configModal.item.unit_measure}</span>
                                        </div>
                                        <span className="text-[8px] font-black text-blue-300/60 uppercase italic tracking-tighter">Antigravity RecipeEngine v2.0</span>
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
                                    <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">Nueva Categoría ({modalType === 'platillo' ? 'Venta' : 'Inventario'})</h3>
                                </div>
                                <button onClick={() => setShowQuickCatModal(false)} className="text-white/60 hover:text-white hover:bg-red-500 w-6 h-6 flex items-center justify-center transition-all">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-4 bg-white m-1 border border-gray-300 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre de Categoría</label>
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
                        <span className="uppercase tracking-tight">Agregar</span>
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
                        <span className="uppercase tracking-tight">Quitar</span>
                    </button>
                </div>
            </>,
            document.body
        )}

        {/* Kardex Modal Portal */}
        {showKardexMode && createPortal(
            <div className="fixed inset-0 z-[2000000] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                <DraggableWindow>
                    <div className="w-[95vw] h-[90vh] max-w-7xl bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106EBE] flex flex-col animate-in zoom-in-95 duration-200 pointer-events-auto">
                        {/* Header (Mover Modal) - OBLIGATORIO .modal-header */}
                        <div className="modal-header bg-[#106EBE] h-9 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                            <div className="flex items-center gap-2">
                                <Package size={16} className="text-white" />
                                <span className="text-white text-[11px] font-bold uppercase tracking-wider">Kardex de Inventario - Consulta Específica</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => setShowKardexMode(false)} 
                                    className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" 
                                    title="Cerrar"
                                >
                                    <X size={20} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        {/* Body (Contenido) */}
                        <div className="flex-1 overflow-hidden bg-white m-1 border border-gray-300 shadow-inner">
                            <InventoryKardex initialProductId={kardexItemId} />
                        </div>
                    </div>
                </DraggableWindow>
            </div>,
            document.body
        )}

        <ConfirmDialog 
            isOpen={!!confirmDelete}
            title="Confirmar Eliminación"
            message={`¿Está seguro de eliminar este ${confirmDelete?.type === 'platillo' ? 'platillo' : confirmDelete?.type === 'producto' ? 'insumo' : 'categoría'}?`}
            description="Esta acción no se puede deshacer y puede afectar la integridad de los datos si existen dependencias."
            onConfirm={executeDelete}
            onCancel={() => setConfirmDelete(null)}
            type="danger"
        />
    </>
);
};

