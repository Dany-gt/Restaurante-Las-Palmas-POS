import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Package, Plus, Search, Eye, Filter, Loader2, Info, Folder, FileText, ChevronRight, ChevronDown, Check, X, Pencil, Trash, Building2, Save, FolderOpen, MoreVertical, Settings, DollarSign, ListOrdered, Calendar, History, ArrowRight, Upload, Layers, PlusCircle, Sparkles, Truck, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';

interface InventoryCategory {
    id: string;
    name: string;
    parent_id: string | null;
}

interface InventoryItem {
    id: string;
    code: string;
    name: string;
    category_id: string;
    quantity: number;
    conversion_factor: number;
    presentation: string;
    cost: number;
    is_enabled: boolean;
    unit: string;
    supplier_id: string;
}

import { SuppliersAdmin } from './SuppliersAdmin';
import { WindowsConfirmModal } from '../WindowsConfirmModal';
import { div } from 'framer-motion/client';

export const InventoryProducts: React.FC = () => {
    // ... rest of the states stay here
    const notify = useNotify();
    // Basic States
    const [activeTab, setActiveTab] = useState<'PRODUCTOS' | 'PROVEEDORES' | 'COMPRAS' | 'AJUSTES' | 'REPORTES' | 'PRODUCCION' | 'SUMINISTROS'>('PRODUCTOS');
    const [categories, setCategories] = useState<InventoryCategory[]>([]);
    const [products, setProducts] = useState<InventoryItem[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [parentSearch, setParentSearch] = useState('');
    const [showParentDropdown, setShowParentDropdown] = useState(false);
    const [showUnitDropdown, setShowUnitDropdown] = useState(false);
    const [showPresentationDropdown, setShowPresentationDropdown] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        unit: 'Unidad',
        presentation: 'Caja',
        conversion_factor: 1,
        cost: 0,
        category_id: '',
        supplier_id: '',
        is_enabled: true
    });
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [showModal, setShowModal] = useState(false);

    // Lógica de "Factores Inteligentes" (Sugerencias automáticas basadas en unidades)
    useEffect(() => {
        if (!showModal || editingProduct) return; // Solo sugerir al CREAR nuevo producto
        
        const u = formData.unit?.toUpperCase().trim();
        const p = formData.presentation?.toUpperCase().trim();
        let suggested = 0;

        if (u === 'MILILITRO' || u === 'ML') {
            if (p === 'LITRO') suggested = 1000;
            else if (p === 'GALÓN') suggested = 3785;
            else if (p === 'BOTELLA') suggested = 750;
        } else if (u === 'GRAMO' || u === 'GR') {
            if (p === 'LIBRA' || p === 'LB') suggested = 454;
            else if (p === 'KILOGRAMO' || p === 'KG') suggested = 1000;
        } else if (u === 'ONZA' || u === 'OZ') {
            if (p === 'LIBRA' || p === 'LB') suggested = 16;
        }

        // Solo aplicar si el factor actual es el valor por defecto (1)
        if (suggested > 0 && formData.conversion_factor === 1) {
            setFormData(prev => ({ ...prev, conversion_factor: suggested }));
        }
    }, [formData.unit, formData.presentation, showModal, editingProduct]);

    useEffect(() => {
        if (editingProduct) {
            // Lógica adicional de edición si fuera necesaria
        }
    }, [editingProduct]);

    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [showMobileCategories, setShowMobileCategories] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Filter States
    const [searchCategory, setSearchCategory] = useState('');
    const [searchProduct, setSearchProduct] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedBranch, setSelectedBranch] = useState<string>(() => {
        const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        return cachedUser?.branch_id || 'all';
    });
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // UI States
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [activeModalTab, setActiveModalTab] = useState<'SUCURSALES' | 'RECETA'>('SUCURSALES');
    const [saving, setSaving] = useState(false);

    // Search and Config Modals for Recipes
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [selectedIngredient, setSelectedIngredient] = useState<any>(null);
    const [configData, setConfigData] = useState({
        quantity: 1,
        unit: 'Unidad'
    });

    // Unit Conversion Logic
    const INVENTORY_UNITS: Record<string, { factor: number, base: string, category: string }> = {
        'ML': { factor: 1, base: 'ML', category: 'Volumen' },
        'MILILITRO': { factor: 1, base: 'ML', category: 'Volumen' },
        'LT': { factor: 1000, base: 'ML', category: 'Volumen' },
        'LITRO': { factor: 1000, base: 'ML', category: 'Volumen' },
        'FL OZ': { factor: 29.5735, base: 'ML', category: 'Volumen' },
        'GL': { factor: 3785.41, base: 'ML', category: 'Volumen' },
        'GR': { factor: 1, base: 'GR', category: 'Masa' },
        'GRAMO': { factor: 1, base: 'GR', category: 'Masa' },
        'MG': { factor: 0.001, base: 'GR', category: 'Masa' },
        'KG': { factor: 1000, base: 'GR', category: 'Masa' },
        'LB': { factor: 453.592, base: 'GR', category: 'Masa' },
        'LIBRA': { factor: 453.592, base: 'GR', category: 'Masa' },
        'OZ': { factor: 28.3495, base: 'GR', category: 'Masa' },
        'ONZA': { factor: 28.3495, base: 'GR', category: 'Masa' },
        'UN': { factor: 1, base: 'UN', category: 'Conteo' },
        'UNIDAD': { factor: 1, base: 'UN', category: 'Conteo' },
        'POR': { factor: 1, base: 'UN', category: 'Conteo' },
        'CAJA': { factor: 1, base: 'UN', category: 'Conteo' },
        'BOLSA': { factor: 1, base: 'UN', category: 'Conteo' },
    };

    const convertQuantity = (qty: number, from: string, to: string) => {
        const cleanUnit = (u: string) => {
            if (!u) return '';
            const match = u.match(/\(([^)]+)\)/);
            return (match ? match[1] : u).toUpperCase().trim();
        };

        const uFrom = INVENTORY_UNITS[cleanUnit(from)];
        const uTo = INVENTORY_UNITS[cleanUnit(to)];

        if (!uFrom || !uTo || uFrom.category !== uTo.category) return qty;
        return (qty * uFrom.factor) / uTo.factor;
    };

    // Category Management State
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any | null>(null);
    const [categoryFormData, setCategoryFormData] = useState({
        name: '',
        parent_id: null as string | null,
        is_subcategory: false
    });

    const [confirmAction, setConfirmAction] = useState<{
        message: string;
        onConfirm: () => void;
    } | null>(null);

    // Body Scroll Lock
    useEffect(() => {
        const isAnyModalOpen = showModal || showCategoryModal || showSearchModal || showConfigModal || !!confirmAction;
        if (isAnyModalOpen) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => { document.body.classList.remove('modal-open'); };
    }, [showModal, showCategoryModal, showSearchModal, showConfigModal, confirmAction]);

    // Context Menu State
    const [productContextMenu, setProductContextMenu] = useState<{
        x: number, y: number, product: any
    } | null>(null);

    const [recipeContextMenu, setRecipeContextMenu] = useState<{
        x: number, y: number, index: number | null
    } | null>(null);

    const [categoryContextMenu, setCategoryContextMenu] = useState<{
        x: number, y: number, category: any
    } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, type: 'product' | 'category' | 'recipe', data: any) => {
        e.preventDefault();
        e.stopPropagation();

        const menuWidth = 200;
        const menuHeight = 220;

        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

        x = Math.max(5, x);
        y = Math.max(5, y);

        if (type === 'product') setProductContextMenu({ x, y, product: data });
        else if (type === 'category') setCategoryContextMenu({ x, y, category: data });
        else if (type === 'recipe') setRecipeContextMenu({ x, y, index: data });
    };

    const [branchData, setBranchData] = useState<any[]>([]);
    const [recipeItems, setRecipeItems] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [catRes, prodRes, branchRes, supRes, stockRes] = await Promise.all([
            supabase.from('categories').select('*').eq('section', 'INVENTARIO').order('name'),
            supabase.from('products').select('*').eq('es_platillo', false).order('name'),
            supabase.from('branches').select('*').order('name'),
            supabase.from('suppliers').select('*').order('name'),
            supabase.from('inventory_item_branches').select('*')
        ]);

        const categoriesData = (catRes.data || []).map(c => ({ ...c, name: c.name }));

        const productsData = (prodRes.data || []).map(p => {
            const itemStocks = stockRes.data?.filter(s => s.item_id === p.id) || [];

            // Valor estilizado para la tabla (Ej: "CAJA (24 UN)")
            let displayPresentation = (p.portion_size || 'UNIDAD').toUpperCase();
            if (p.portions && p.portions > 1) {
                const unitBrief = (p.unit_measure || 'UN').substring(0, 2).toUpperCase();
                displayPresentation = `${displayPresentation} (${p.portions} ${unitBrief})`;
            }

            const totalQuantity = itemStocks.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

            return {
                ...p,
                name: p.name,
                code: p.product_code || '',
                category_id: p.product_category_id || p.category_id,
                quantity: totalQuantity,
                branchStocks: itemStocks,
                presentation_display: displayPresentation.toUpperCase(),
                raw_presentation: p.portion_size || 'Caja',
                conversion_factor: p.portions || 1,
                unit: p.unit_measure || 'Unidad',
                cost: p.cost_price || 0
            };
        });

        setCategories(categoriesData);
        setProducts(productsData);
        setBranches(branchRes.data || []);
        setSuppliers(supRes.data || []);
        setLoading(false);
    };

    const formatStock = (stock: number, capacity: number, presentation: string, unit: string) => {
        if (!capacity || capacity <= 0) {
            return (
                <div className="flex flex-col items-center">
                    <span className="font-bold text-sm">{stock}</span>
                    <span className="text-[9px] text-slate-800 font-bold">{unit}</span>
                </div>
            );
        }

        const converted = stock / capacity;
        const displayValue = Number.isInteger(converted) ? converted : converted.toFixed(2);

        return (
            <div className="flex flex-col items-center">
                <span className="font-bold text-sm">{displayValue}</span>
                <span className="text-[9px] text-slate-800 font-bold">{stock} {unit}</span>
            </div>
        );
    };

    const fetchItemBranches = async (itemId: string) => {
        const { data } = await supabase
            .from('inventory_item_branches')
            .select('*')
            .eq('item_id', itemId);

        const merged = branches.map(b => {
            const existing = data?.find(ib => ib.branch_id === b.id);
            return {
                branch_id: b.id,
                name: b.name,
                quantity: existing?.quantity || 0,
                min_stock: existing?.min_stock || 0,
                is_enabled: existing?.is_enabled ?? true,
                is_assigned: existing?.is_assigned ?? true
            };
        });
        setBranchData(merged);
    };

    const fetchItemRecipe = async (itemId: string) => {
        const { data, error } = await supabase
            .from('inventory_item_recipes')
            .select(`
                id,
                child_id,
                quantity,
                unit_measure,
                inventory_items!inventory_item_recipes_child_id_fkey (
                    nombre,
                    precio_compra
                )
            `)
            .eq('parent_id', itemId);

        if (error) {
            console.error('Error fetching recipe:', error);
            setRecipeItems([]);
        } else {
            setRecipeItems(data?.map(item => ({
                id: item.id,
                child_id: item.child_id,
                quantity: item.quantity,
                unit: item.unit_measure,
                name: (item as any).inventory_items?.nombre || 'Insumo desconocido',
                cost: (item as any).inventory_items?.precio_compra || 0
            })) || []);
        }
    };

    const toggleCategory = (id: string) => {
        const next = new Set(expandedCategories);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedCategories(next);
    };

    const handleNew = () => {
        setEditingProduct(null);
        setFormData({
            code: '',
            name: '',
            unit: 'Unidad',
            presentation: 'Caja',
            conversion_factor: 1,
            cost: 0,
            category_id: selectedCategories.size === 1 ? Array.from(selectedCategories)[0] : '',
            supplier_id: '',
            is_enabled: true
        });
        setBranchData(branches.map(b => ({
            branch_id: b.id,
            name: b.name,
            quantity: 0,
            min_stock: 0,
            is_enabled: true,
            is_assigned: true
        })));
        setRecipeItems([]);
        setActiveModalTab('SUCURSALES');
        setShowModal(true);
    };

    const handleEdit = async (product: any) => {
        setEditingProduct(product);
        const content = product.conversion_factor || 1;
        const displayCost = (product.cost || 0) * content;

        // Normalizar la presentación para que coincida con las opciones del SELECT (Capitalized)
        const normalizePresentation = (val: string) => {
            if (!val) return 'Caja';
            const v = val.toLowerCase();
            if (v === 'unidad') return 'Unidad'; // Especial para unidad
            return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        };

        setFormData({
            code: product.code || '',
            name: product.name || '',
            unit: product.unit || 'Unidad',
            presentation: normalizePresentation(product.raw_presentation || product.portion_size),
            conversion_factor: product.conversion_factor || product.portions || 1,
            cost: displayCost,
            category_id: product.category_id || '',
            supplier_id: product.supplier_id || '',
            is_enabled: product.is_enabled ?? true
        });
        await Promise.all([
            fetchItemBranches(product.id),
            fetchItemRecipe(product.id)
        ]);
        setActiveModalTab('SUCURSALES');
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        setConfirmAction({
            message: '¿Eliminar este producto y todas sus relaciones (incluyendo registros de producción)?',
            onConfirm: async () => {
                // Primero eliminamos dependencias que causan FK errors
                await supabase.from('registros_produccion').delete().eq('platillo_id', id);
                await supabase.from('rendimiento_cocina').delete().eq('platillo_id', id);
                
                const { error } = await supabase.from('products').delete().eq('id', id);
                if (!error) {
                    notify.success('Producto eliminado correctamente');
                    fetchData();
                } else {
                    notify.error('Error: ' + error.message);
                }
                setConfirmAction(null);
            }
        });
    };

    const handleNewCategory = (parentId: string | null = null) => {
        setEditingCategory(null);
        setCategoryFormData({ name: '', parent_id: parentId, is_subcategory: !!parentId });
        setShowCategoryModal(true);
    };

    const handleEditCategory = (cat: any) => {
        setEditingCategory(cat);
        setCategoryFormData({
            name: cat.name,
            parent_id: cat.parent_id,
            is_subcategory: !!cat.parent_id
        });
        setShowCategoryModal(true);
    };

    const handleDeleteCategory = async (id: string) => {
        const hasSub = categories.some(c => c.parent_id === id);
        const hasProd = products.some(p => p.category_id === id);
        if (hasSub || hasProd) {
            notify.alert('No se puede eliminar una categoría que contiene sub-categorías o productos.');
            return;
        }
        
        setConfirmAction({
            message: '¿Desea eliminar esta categoría?',
            onConfirm: async () => {
                const { error } = await supabase.from('categories').delete().eq('id', id);
                if (!error) fetchData();
                else notify.error('Error: ' + error.message);
                setConfirmAction(null);
            }
        });
    };

    const handleSaveCategory = async () => {
        if (!categoryFormData.name) return;
        setSaving(true);
        const data = {
            name: categoryFormData.name.toUpperCase(),
            parent_id: categoryFormData.parent_id,
            section: categoryFormData.section || 'INVENTARIO',
            is_enabled: true
        };

        let err;
        if (editingCategory) {
            const { error } = await supabase.from('categories').update(data).eq('id', editingCategory.id);
            err = error;
        } else {
            const { error } = await supabase.from('categories').insert([data]);
            err = error;
        }

        if (err) alert('Error: ' + err.message);
        else {
            setShowCategoryModal(false);
            fetchData();
        }
        setSaving(false);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.category_id) {
            alert('Nombre y Categoría son obligatorios');
            return;
        }

        setSaving(true);
        const content = Number(formData.conversion_factor) || 1;
        const totalCost = Number(formData.cost) || 0;
        const unitCost = totalCost / content;

        const extendedData: any = {
            name: formData.name.toUpperCase(),
            unit_measure: formData.unit,
            portion_size: formData.presentation,
            portions: Number(formData.conversion_factor) || 1,
            category_id: formData.category_id || null,
            is_enabled: formData.is_enabled,
            classification: 'INSUMO',
            cost_price: unitCost,
            product_code: formData.code
        };

        if (!editingProduct) {
            extendedData.price = totalCost;
        }

        let result;
        if (editingProduct) {
            result = await supabase.from('products').update(extendedData).eq('id', editingProduct.id).select();
        } else {
            result = await supabase.from('products').insert([extendedData]).select();
        }

        if (result.error) {
            alert('Error al guardar producto: ' + result.error.message);
            setSaving(false);
            return;
        }

        const savedItem = result.data[0];

        try {
            await supabase.from('inventory_item_branches').delete().eq('item_id', savedItem.id);
            const branchInserts = branchData.map(bd => ({
                item_id: savedItem.id,
                branch_id: bd.branch_id,
                quantity: bd.quantity,
                min_stock: bd.min_stock,
                is_enabled: bd.is_enabled,
                is_assigned: bd.is_assigned
            }));
            if (branchInserts.length > 0) {
                await supabase.from('inventory_item_branches').insert(branchInserts);
            }
        } catch (e) {
            console.error("Error al guardar ramas:", e);
        }

        setSaving(false);
        setShowModal(false);
        fetchData();
    };

    const handleAddIngredient = (ingredient: any) => {
        if (recipeItems.some(ri => ri.child_id === ingredient.id)) {
            notify.info("Este insumo ya se encuentra en el listado.");
            return;
        }

        setSelectedIngredient(ingredient);
        setConfigData({
            quantity: 1,
            unit: ingredient.unit || 'Unidad'
        });
        setShowUnitDropdown(false);
        setShowConfigModal(true);
    };

    const confirmAddIngredient = () => {
        if (!selectedIngredient) return;

        const storageUnit = selectedIngredient.unit?.toUpperCase() || 'UN';
        const selectedUnit = configData.unit.toUpperCase();
        const convertedQty = convertQuantity(configData.quantity, selectedUnit, storageUnit);

        const newItem = {
            child_id: selectedIngredient.id,
            name: selectedIngredient.name,
            quantity: convertedQty,
            unit: storageUnit,
            cost: selectedIngredient.cost || 0,
            original_qty: configData.quantity,
            original_unit: configData.unit
        };

        setRecipeItems([...recipeItems, newItem]);
        setShowConfigModal(false);
        setShowSearchModal(false);
    };

    const removeIngredient = (index: number) => {
        setRecipeItems(recipeItems.filter((_, i) => i !== index));
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
            (p.code && p.code.toLowerCase().includes(searchProduct.toLowerCase()));

        const matchesCategory = selectedCategories.size > 0 ? selectedCategories.has(p.category_id) : true;

        if (selectedBranch === 'all') return matchesSearch && matchesCategory;

        const branchInfo = p.branchStocks?.find((bs: any) => bs.branch_id === selectedBranch);
        return matchesSearch && matchesCategory && branchInfo;
    }).map(p => {
        if (selectedBranch === 'all') return p;
        const branchInfo = p.branchStocks?.find((bs: any) => bs.branch_id === selectedBranch);
        return {
            ...p,
            quantity: branchInfo?.quantity || 0
        };
    });

    const searchResults = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 200);

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
            .map(cat => {
                const hasChildren = categories.some(c => c.parent_id === cat.id);
                const isExpanded = expandedCategories.has(cat.id);
                const isSelected = selectedCategories.has(cat.id);

                return (
                    <div key={cat.id} className="flex flex-col select-none">
                        <div className="flex items-center group/cat">
                            <div
                                onClick={() => toggleCategorySelection(cat.id)}
                                onContextMenu={(e) => handleContextMenu(e, 'category', cat)}
                                className={`flex-1 flex items-center gap-1.5 px-3 py-1 text-left truncate cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50' : 'text-slate-800 font-bold hover:bg-slate-100'}`}
                            >
                                <div style={{ paddingLeft: `${depth * 12}px` }} className="flex items-center gap-1.5 flex-1 min-w-0">
                                    {hasChildren ? (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleCategory(cat.id); }} 
                                            className="w-4 h-4 flex items-center justify-center hover:bg-slate-200 rounded-sm"
                                        >
                                            {isExpanded ? <ChevronDown size={14} className="text-slate-800 font-bold" /> : <ChevronRight size={14} className="text-slate-800 font-bold" />}
                                        </button>
                                    ) : (
                                        <div className="w-4" />
                                    )}
                                    <div className="flex items-center justify-center">
                                        {isSelected ? <CheckSquare size={14} className="text-[#106ebe]" /> : <Square size={14} className="text-slate-800 font-bold" />}
                                    </div>
                                    <span className={`text-[11px] uppercase truncate ${hasChildren ? 'font-bold' : ''} ${isSelected ? 'text-[#106ebe] font-bold' : 'text-slate-800 font-bold'}`}>
                                        {cat.name}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {hasChildren && isExpanded && (
                            <div className="">
                                {renderCategoryTree(cat.id, depth + 1)}
                            </div>
                        )}
                    </div>
                );
            });
    };

    return (
        <>
            <div className="h-full flex flex-col relative bg-[#f0f0f0] font-['Montserrat'] overflow-hidden" onClick={() => setProductContextMenu(null)}>
                <div className="bg-[#e6e6e6] px-3 border-b border-gray-300 flex items-center justify-between shrink-0 h-[40px] z-[100]">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-800 font-bold font-medium text-[12px]">Sucursal</span>
                        <select
                            value={selectedBranch}
                            onChange={e => setSelectedBranch(e.target.value)}
                            className="bg-transparent outline-none text-[10px] font-bold uppercase text-slate-700 min-w-[280px] cursor-pointer"
                        >
                            <option value="all">TODAS LAS SUCURSALES</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setSelectedCategories(new Set())}
                            className="bg-[#106ebe] text-white px-3 h-[24px] text-[10px] font-bold uppercase rounded-sm shadow-sm hover:bg-[#005a9e] active:shadow-inner transition-all flex items-center justify-center"
                        >
                            Mostrar Todos
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white border border-gray-400 rounded-sm focus-within:border-[#106ebe] transition-colors">
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={searchProduct}
                                onChange={(e) => setSearchProduct(e.target.value)}
                                className="px-2 text-[11px] w-64 outline-none text-slate-800 font-bold font-medium h-[22px] bg-transparent"
                            />
                        </div>
                        <button className="bg-[#f0f0f0] border border-gray-400 px-4 h-[24px] text-[10px] font-bold uppercase hover:bg-[#e1e1e1] active:bg-[#d1d1d1] text-slate-800 font-bold rounded-sm shadow-sm transition-all flex items-center justify-center">
                            Buscar
                        </button>
                    </div>
                </div>

            <div className="flex-1 flex overflow-hidden">
                    <aside className="w-[280px] bg-white border-r border-gray-300 flex flex-col shrink-0">
                        <div className="bg-[#f0f0f0] px-3 py-1.5 border-b border-gray-300 flex items-center justify-between">
                            <span className="text-[11px] text-slate-800 font-bold uppercase tracking-widest">Categorías</span>
                        </div>
                        <div
                            className="flex-1 overflow-y-auto p-1"
                            onContextMenu={(e) => {
                                handleContextMenu(e, 'category', { id: null, name: 'Categorías' });
                            }}
                        >
                            <div className="space-y-0.5">
                                {loading ? (
                                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-800 font-bold" size={20} /></div>
                                ) : (
                                    renderCategoryTree()
                                )}
                            </div>
                        </div>
                    </aside>

                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="bg-[#f0f0f0] px-3 py-1.5 border-b border-gray-300 flex justify-between items-center">
                            <span className="text-[11px] text-slate-800 font-bold uppercase tracking-widest">Existencias de Inventario</span>
                        </div>

                        <div
                            className="flex-1 overflow-auto relative border-l border-gray-200"
                            onContextMenu={(e) => {
                                if ((e.target as HTMLElement).closest('thead')) return;
                                handleContextMenu(e, 'product', null);
                            }}
                        >
                            <div className="bg-white min-h-full">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[#e8e8e8] sticky top-0 z-20 border-b border-gray-400 select-none">
                                        <tr className="h-8">
                                            <th className="px-4 text-[10px] font-bold text-black uppercase border-r border-gray-300">Código</th>
                                            <th className="px-4 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300">Categoría</th>
                                            <th className="px-4 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300">Producto</th>
                                            <th className="px-2 text-center w-28 text-[10px] font-bold text-black uppercase border-r border-gray-300">Existencia</th>
                                            <th className="px-4 w-32 hidden md:table-cell text-left text-[10px] font-bold text-black uppercase border-r border-gray-300">Presentación</th>
                                            <th className="px-4 text-right w-32 text-[10px] font-bold text-black uppercase border-r border-gray-300">Precio Costo</th>
                                            <th className="px-4 text-center w-24 hidden lg:table-cell text-[10px] font-bold text-black uppercase">Habilitado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white min-h-[100px]">
                                        {loading ? (
                                            <tr><td colSpan={7} className="py-20 text-center"><Loader2 className="animate-spin text-slate-800 font-bold mx-auto" size={32} /></td></tr>
                                        ) : filteredProducts.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-20 text-center">
                                                    <span className="text-[11px] text-slate-800 font-bold font-medium font-['Montserrat']">No se encontraron productos en esta categoría</span>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredProducts.map(prod => {
                                                const isSelected = productContextMenu?.product?.id === prod.id;
                                                const isSelectedRow = selectedProduct === prod.id;
                                                return (
                                                    <tr
                                                        key={prod.id}
                                                        onMouseDown={() => setSelectedProduct(prod.id)}
                                                        onDoubleClick={() => handleEdit(prod)}
                                                        className={`h-6 cursor-pointer border-b border-gray-50 transition-colors ${isSelected || isSelectedRow ? 'bg-[#106ebe] text-white [&>td]:border-transparent' : 'text-slate-800 font-bold even:bg-slate-50/50 hover:bg-[#cce8ff]'}`}
                                                        onContextMenu={(e) => handleContextMenu(e, 'product', prod)}
                                                    >
                                                        <td className="px-4 font-bold border-r border-gray-100 uppercase text-[10px]">{prod.code || '--'}</td>
                                                        <td className="px-4 border-r border-gray-100 text-[10px] uppercase truncate">
                                                            {categories.find(c => c.id === prod.category_id)?.name || 'Sin categ.'}
                                                        </td>
                                                        <td className="px-4 border-r border-gray-100 text-[10px] font-bold uppercase truncate">{prod.name}</td>
                                                        <td className="px-4 border-r border-gray-100 text-[10px] text-center font-bold tabular-nums">
                                                            {parseFloat(prod.quantity.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-4 border-r border-gray-100 text-[10px] uppercase truncate">{prod.presentation_display || '--'}</td>
                                                        <td className="px-4 border-r border-gray-100 text-[10px] text-right font-bold tabular-nums">
                                                            Q{parseFloat(prod.cost.toString()).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 text-center">
                                                            <div className="flex justify-center items-center h-full">
                                                                <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${isSelected || isSelectedRow ? 'bg-white border-white text-[#106ebe]' : 'bg-[#106ebe] border-[#106ebe] text-white'}`}>
                                                                    <Check size={10} strokeWidth={4} />
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-[#f0f0f0] border-t border-gray-400 px-3 flex items-center shrink-0 h-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter">Productos: {filteredProducts.length}</span>
                        </div>
                    </div>
                </div>

                {showModal && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                        <DraggableWindow>
                            <div className="w-[850px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106EBE] flex flex-col pointer-events-auto">
                                <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move shrink-0 select-none">
                                    <div className="flex items-center gap-2">
                                        <Package size={14} className="text-white" />
                                        <span className="text-white text-[12px] font-bold tracking-wide">Control de Inventario - {formData.name || 'Nuevo'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setShowModal(false)}
                                            className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1"
                                            title="Cerrar"
                                        >
                                            <X size={18} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f0f0f0]">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col md:flex-row gap-4">
                                            <div className="flex-1 flex flex-col gap-4">
                                                <div className="border border-gray-300 bg-white flex flex-col shadow-sm">
                                                    <div className="p-3 pt-4 flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <label className="w-24 shrink-0 text-[10px] text-slate-800 font-bold uppercase tracking-tight">Código</label>
                                                            <input
                                                                value={formData.code}
                                                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                                                className="flex-1 h-6 border border-gray-300 px-2 text-[11px] text-slate-800 font-bold focus:border-[#106ebe] outline-none uppercase font-bold"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <label className="w-24 shrink-0 text-[10px] text-slate-800 font-bold uppercase tracking-tight">Nombre Producto</label>
                                                            <input
                                                                value={formData.name}
                                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                                className="flex-1 h-6 border border-gray-300 px-2 text-[11px] text-slate-800 font-bold focus:border-[#106ebe] outline-none uppercase font-bold"
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="flex items-center gap-2">
                                                                <label className="w-24 shrink-0 text-[10px] text-slate-800 font-bold uppercase tracking-tight">Unidad</label>
                                                                <div className="flex-1 relative">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowUnitDropdown(!showUnitDropdown)}
                                                                        className="w-full h-6 border border-gray-300 px-2 text-[11px] text-slate-800 font-bold text-left focus:border-[#106ebe] outline-none bg-[#f8f9fa] uppercase font-bold flex items-center justify-between"
                                                                    >
                                                                        <span>{formData.unit}</span>
                                                                        <ChevronDown size={12} className="text-slate-800 font-bold" />
                                                                    </button>
                                                                    {showUnitDropdown && (
                                                                        <>
                                                                            <div className="fixed inset-0 z-40" onClick={() => setShowUnitDropdown(false)} />
                                                                            <div className="absolute z-50 top-full mt-1 inset-x-0 bg-white border border-gray-400 shadow-xl p-0.5 max-h-40 overflow-y-auto custom-scrollbar">
                                                                                {['Unidad', 'Libra', 'Gramo', 'Onza', 'Mililitro', 'Litro'].map(u => (
                                                                                    <button
                                                                                        key={u}
                                                                                        type="button"
                                                                                        onClick={() => { setFormData({ ...formData, unit: u }); setShowUnitDropdown(false); }}
                                                                                        className="w-full text-left px-2 py-1 text-[10px] text-slate-800 font-bold hover:bg-[#106ebe] hover:text-white transition-colors uppercase"
                                                                                    >
                                                                                        {u}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <label className="w-24 shrink-0 text-[10px] font-bold text-black uppercase tracking-tight">Presentación</label>
                                                                <div className="flex-1 relative">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowPresentationDropdown(!showPresentationDropdown)}
                                                                        className="w-full h-6 border border-gray-300 px-2 text-[11px] text-slate-800 font-bold text-left focus:border-[#106ebe] outline-none bg-[#f8f9fa] uppercase font-bold flex items-center justify-between"
                                                                    >
                                                                        <span>{formData.presentation}</span>
                                                                        <ChevronDown size={12} className="text-slate-800 font-bold" />
                                                                    </button>
                                                                    {showPresentationDropdown && (
                                                                        <>
                                                                            <div className="fixed inset-0 z-40" onClick={() => setShowPresentationDropdown(false)} />
                                                                            <div className="absolute z-50 top-full mt-1 inset-x-0 bg-white border border-gray-400 shadow-xl p-0.5 max-h-40 overflow-y-auto custom-scrollbar">
                                                                                {['Caja', 'Bolsa', 'Bote', 'Frasco', 'Saco', 'Galón', 'Tonel', 'Bidón', 'Sobre', 'Litro', 'Garrafón', 'Paquete', 'Porción'].map(p => (
                                                                                    <button
                                                                                        key={p}
                                                                                        type="button"
                                                                                        onClick={() => { setFormData({ ...formData, presentation: p }); setShowPresentationDropdown(false); }}
                                                                                        className="w-full text-left px-2 py-1 text-[10px] text-slate-800 font-bold hover:bg-[#106ebe] hover:text-white transition-colors uppercase"
                                                                                    >
                                                                                        {p}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="flex items-center gap-2">
                                                                <label className="w-24 shrink-0 text-[10px] text-slate-800 font-bold uppercase tracking-tight leading-none">Contenido</label>
                                                                <div className="flex-1 flex items-center bg-gray-50 border border-gray-300 h-6 px-2">
                                                                    <input
                                                                        type="number"
                                                                        step="any"
                                                                        value={formData.conversion_factor}
                                                                        onChange={e => setFormData({ ...formData, conversion_factor: parseFloat(e.target.value) || 0 })}
                                                                        className="w-full bg-transparent border-none text-[11px] text-slate-800 font-bold outline-none text-center font-bold"
                                                                    />
                                                                    <span className="text-[8px] text-slate-800 font-bold ml-1 whitespace-nowrap">{formData.unit}/1 {formData.presentation}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <label className="w-24 shrink-0 text-[10px] text-slate-800 font-bold uppercase tracking-tight">Costo</label>
                                                                <div className="flex-1 flex flex-col gap-1">
                                                                    <div className="flex items-center bg-gray-50 border border-gray-300 h-6 px-2">
                                                                        <span className="text-[9px] text-slate-800 font-bold mr-1">Q</span>
                                                                        <input
                                                                            type="number"
                                                                            step="any"
                                                                            value={formData.cost}
                                                                            onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                                                                            className="w-full bg-transparent border-none text-[11px] text-slate-800 font-bold outline-none font-bold text-[#106ebe]"
                                                                        />
                                                                    </div>
                                                                    {formData.cost > 0 && formData.conversion_factor > 0 && (
                                                                        <div className="px-2 py-0.5 bg-blue-50/50 rounded flex justify-between items-center">
                                                                            <span className="text-[8px] font-black text-[#106ebe] uppercase italic">
                                                                                P. UNITARIO: Q{(formData.cost / formData.conversion_factor).toFixed(2)} / {formData.unit}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <label className="w-24 shrink-0 text-[10px] text-slate-800 font-bold uppercase tracking-tight">Categoría</label>
                                                            <div className="flex-1 relative group">
                                                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#106ebe] pointer-events-none">
                                                                    <Search size={12} strokeWidth={3} />
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    placeholder="BUSCAR CATEGORÍA..."
                                                                    value={showCategoryDropdown ? categorySearch : (categories.find(c => c.id === formData.category_id)?.name || '')}
                                                                    onFocus={() => { setShowCategoryDropdown(true); setCategorySearch(''); }}
                                                                    onChange={e => { setCategorySearch(e.target.value); setShowCategoryDropdown(true); }}
                                                                    className="w-full h-7 border border-gray-300 pl-7 pr-2 text-[11px] text-slate-800 font-bold focus:border-[#106ebe] focus:ring-1 focus:ring-[#106ebe]/20 outline-none uppercase font-bold bg-[#f8f9fa] transition-all shadow-sm"
                                                                />
                                                                {showCategoryDropdown && (
                                                                    <>
                                                                        <div className="fixed inset-0 z-40" onClick={() => setShowCategoryDropdown(false)} />
                                                                        <div className="absolute z-50 top-full mt-1 inset-x-0 bg-white border border-gray-400 shadow-2xl p-1 max-h-64 overflow-y-auto custom-scrollbar rounded-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setFormData({ ...formData, category_id: '' }); setShowCategoryDropdown(false); }}
                                                                                className="w-full text-left px-3 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors uppercase border-b border-gray-100 flex items-center justify-between"
                                                                            >
                                                                                <span>[Sin Categoría]</span>
                                                                                <X size={10} />
                                                                            </button>
                                                                            {categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                                                                                <button
                                                                                    key={c.id}
                                                                                    type="button"
                                                                                    onClick={() => { setFormData({ ...formData, category_id: c.id }); setShowCategoryDropdown(false); }}
                                                                                    className="w-full text-left px-3 py-2 text-[11px] text-slate-800 font-bold hover:bg-[#106ebe] hover:text-white transition-all uppercase border-b border-gray-50 last:border-0"
                                                                                >
                                                                                    {c.name}
                                                                                </button>
                                                                            ))}
                                                                            {categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                                                                                <div className="px-3 py-4 text-center text-[10px] text-gray-400 italic font-bold">
                                                                                    No se encontraron categorías
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <label className="w-24 shrink-0 text-[10px] text-slate-800 font-bold uppercase tracking-tight">Proveedor</label>
                                                            <div className="flex-1 relative group">
                                                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#106ebe] pointer-events-none">
                                                                    <Search size={12} strokeWidth={3} />
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    placeholder="BUSCAR PROVEEDOR..."
                                                                    value={showSupplierDropdown ? supplierSearch : (suppliers.find(s => s.id === formData.supplier_id)?.name || '')}
                                                                    onFocus={() => { setShowSupplierDropdown(true); setSupplierSearch(''); }}
                                                                    onChange={e => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }}
                                                                    className="w-full h-7 border border-gray-300 pl-7 pr-2 text-[11px] text-slate-800 font-bold focus:border-[#106ebe] focus:ring-1 focus:ring-[#106ebe]/20 outline-none uppercase font-bold bg-[#f8f9fa] transition-all shadow-sm"
                                                                />
                                                                {showSupplierDropdown && (
                                                                    <>
                                                                        <div className="fixed inset-0 z-40" onClick={() => setShowSupplierDropdown(false)} />
                                                                        <div className="absolute z-50 top-full mt-1 inset-x-0 bg-white border border-gray-400 shadow-2xl p-1 max-h-64 overflow-y-auto custom-scrollbar rounded-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setFormData({ ...formData, supplier_id: '' }); setShowSupplierDropdown(false); }}
                                                                                className="w-full text-left px-3 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors uppercase border-b border-gray-100 flex items-center justify-between"
                                                                            >
                                                                                <span>[Quitar Proveedor]</span>
                                                                                <X size={10} />
                                                                            </button>
                                                                            {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map(s => (
                                                                                <button
                                                                                    key={s.id}
                                                                                    type="button"
                                                                                    onClick={() => { setFormData({ ...formData, supplier_id: s.id }); setShowSupplierDropdown(false); }}
                                                                                    className="w-full text-left px-3 py-2 text-[11px] text-slate-800 font-bold hover:bg-[#106ebe] hover:text-white transition-all uppercase border-b border-gray-50 last:border-0"
                                                                                >
                                                                                    {s.name}
                                                                                </button>
                                                                            ))}
                                                                            {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && (
                                                                                <div className="px-3 py-4 text-center text-[10px] text-gray-400 italic font-bold">
                                                                                    No se encontraron proveedores
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-col min-h-[300px] border border-gray-300 bg-white shadow-inner">
                                            <div className="flex bg-[#e1e1e1] px-2 pt-2 gap-0.5 border-b border-gray-300">
                                                <button
                                                    onClick={() => setActiveModalTab('SUCURSALES')}
                                                    className={`px-4 py-1.5 text-[10px] font-bold border-t border-x transition-all ${activeModalTab === 'SUCURSALES' ? 'bg-white border-gray-300 -mb-[1px] z-10 text-[#106ebe]' : 'bg-[#d1d1d1] border-gray-300 text-slate-800 font-bold hover:bg-[#c1c1c1]'}`}
                                                >
                                                    SUCURSALES
                                                </button>
                                                <button
                                                    onClick={() => setActiveModalTab('RECETA')}
                                                    className={`px-4 py-1.5 text-[10px] font-bold border-t border-x transition-all ${activeModalTab === 'RECETA' ? 'bg-white border-gray-300 -mb-[1px] z-10 text-[#106ebe]' : 'bg-[#d1d1d1] border-gray-300 text-slate-800 font-bold hover:bg-[#c1c1c1]'}`}
                                                >
                                                    RECETA / COMPOSICIÓN
                                                </button>
                                            </div>

                                            <div className="flex-1 overflow-hidden flex flex-col relative bg-white">
                                                {activeModalTab === 'SUCURSALES' && (
                                                    <div className="flex-1 overflow-auto p-0">
                                                        <table className="w-full text-[10px] text-left border-collapse">
                                                            <thead className="bg-[#f0f0f0] sticky top-0 z-10 select-none uppercase">
                                                                <tr className="text-slate-800 font-bold border-b border-gray-300 h-7">
                                                                    <th className="px-3 py-1 border-r border-gray-200">Sucursal</th>
                                                                    <th className="px-3 py-1 border-r border-gray-200 text-center w-24">Existencia</th>
                                                                    <th className="px-3 py-1 border-r border-gray-200 text-center w-24">Reorden</th>
                                                                    <th className="px-3 py-1 border-r border-gray-200 text-center w-20">Habilitado</th>
                                                                    <th className="px-3 py-1 text-center w-20">Asignado</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {branchData.map((bd, i) => (
                                                                    <tr key={bd.branch_id} className="h-7 hover:bg-[#e5f1fb] transition-colors group">
                                                                        <td className="px-3 py-0 border-r border-gray-50 font-bold uppercase text-slate-800 font-bold truncate">{bd.name}</td>
                                                                        <td className="px-3 py-0 border-r border-gray-50 text-center font-bold tabular-nums text-[#106ebe]">{bd.quantity}</td>
                                                                        <td className="px-3 py-0 border-r border-gray-50 text-center">
                                                                            <input
                                                                                type="number"
                                                                                value={bd.min_stock}
                                                                                onChange={e => {
                                                                                    const next = [...branchData];
                                                                                    next[i] = { ...next[i], min_stock: parseFloat(e.target.value) || 0 };
                                                                                    setBranchData(next);
                                                                                }}
                                                                                className="w-16 h-5 border border-transparent group-hover:border-gray-300 focus:border-[#106ebe] outline-none text-[10px] text-center transition-all bg-transparent font-bold"
                                                                            />
                                                                        </td>
                                                                        <td className="px-3 py-0 border-r border-gray-50 text-center">
                                                                            <div className="flex justify-center">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={bd.is_enabled}
                                                                                    onChange={e => {
                                                                                        const next = [...branchData];
                                                                                        next[i] = { ...next[i], is_enabled: e.target.checked };
                                                                                        setBranchData(next);
                                                                                    }}
                                                                                    className="w-3.5 h-3.5 accent-[#106ebe]"
                                                                                />
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-0 text-center">
                                                                            <div className="flex justify-center">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={bd.is_assigned}
                                                                                    onChange={e => {
                                                                                        const next = [...branchData];
                                                                                        next[i] = { ...next[i], is_assigned: e.target.checked };
                                                                                        setBranchData(next);
                                                                                    }}
                                                                                    className="w-3.5 h-3.5 accent-[#106ebe]"
                                                                                />
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {activeModalTab === 'RECETA' && (
                                                    <div className="flex-1 overflow-hidden flex flex-col relative bg-white">
                                                        <div className="flex justify-between items-center p-2 bg-[#f0f0f0] border-b border-gray-300">
                                                            <div className="flex items-center gap-2">
                                                                <Layers size={12} className="text-slate-800 font-bold" />
                                                                <h4 className="text-[10px] font-bold uppercase text-slate-800 font-bold tracking-tight">Componentes de Receta</h4>
                                                            </div>
                                                            <button
                                                                onClick={() => setShowSearchModal(true)}
                                                                className="flex items-center gap-1.5 px-3 py-1 bg-[#106ebe] text-white hover:bg-[#005a9e] transition-colors shadow-sm"
                                                            >
                                                                <Plus size={12} />
                                                                <span className="text-[10px] font-bold uppercase">Agregar</span>
                                                            </button>
                                                        </div>

                                                        <div className="flex-1 overflow-auto">
                                                            <table className="w-full text-[10px] text-left border-collapse">
                                                                <thead className="bg-[#f0f0f0] sticky top-0 z-10 select-none uppercase">
                                                                    <tr className="text-slate-800 font-bold border-b border-gray-300 h-7">
                                                                        <th className="px-3 py-1 border-r border-gray-200">Producto</th>
                                                                        <th className="px-3 py-1 border-r border-gray-200 text-center w-24">Cantidad</th>
                                                                        <th className="px-3 py-1 border-r border-gray-200 text-center w-24">Medida</th>
                                                                        <th className="px-3 py-1 text-right w-28">Parcial</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100 min-h-[100px]">
                                                                    {recipeItems.map((item, index) => (
                                                                        <tr key={index} className="h-7 hover:bg-[#e5f1fb] transition-colors group cursor-context-menu" onContextMenu={(e) => handleContextMenu(e, 'recipe', index)}>
                                                                            <td className="px-3 py-0 border-r border-gray-50 font-bold uppercase text-slate-800 font-bold truncate">{item.name}</td>
                                                                            <td className="px-3 py-0 border-r border-gray-50 text-center">
                                                                                <input
                                                                                    type="number"
                                                                                    value={item.quantity}
                                                                                    onChange={e => {
                                                                                        const next = [...recipeItems];
                                                                                        next[index] = { ...next[index], quantity: parseFloat(e.target.value) || 0 };
                                                                                        setRecipeItems(next);
                                                                                    }}
                                                                                    className="w-16 h-5 border border-transparent group-hover:border-gray-300 focus:border-[#106ebe] outline-none text-[10px] text-center font-bold bg-transparent"
                                                                                />
                                                                            </td>
                                                                            <td className="px-3 py-0 border-r border-gray-50 text-center text-slate-800 font-bold">{item.unit || item.measure}</td>
                                                                            <td className="px-3 py-0 text-right font-bold text-[#106ebe] tabular-nums">Q{((item.cost || 0) * (item.quantity || 0)).toFixed(2)}</td>
                                                                        </tr>
                                                                    ))}
                                                                    {recipeItems.length === 0 && (
                                                                        <tr>
                                                                            <td colSpan={4} className="py-12 text-center text-slate-800 font-bold italic font-medium">No hay componentes en la receta</td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        <div className="p-1.5 bg-[#f0f0f0] border-t border-gray-300 flex justify-between items-center shrink-0">
                                                            <div className="flex items-center gap-2">
                                                                <Layers size={12} className="text-slate-800 font-bold" />
                                                                <span className="text-[9px] text-slate-800 font-bold uppercase tracking-tight">{recipeItems.length} COMPONENTES</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold text-black uppercase tracking-widest">Costo Total:</span>
                                                                <span className="text-[12px] font-bold text-black tabular-nums">Q{recipeItems.reduce((acc, item) => acc + (item.quantity * (item.cost || 0)), 0).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-10 px-4 bg-[#e1e1e1] border-t border-gray-400 flex justify-end items-center gap-2 shrink-0">
                                    <button onClick={() => setShowModal(false)} className="px-4 py-1.5 bg-[#d1d1d1] text-black text-[10px] font-bold uppercase border border-gray-400 hover:bg-[#c1c1c1] transition-colors">Cancelar</button>
                                    <button onClick={handleSave} disabled={saving} className="px-6 py-1.5 bg-[#106ebe] text-white text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-[#005a9e] transition-colors disabled:opacity-50">
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                        {saving ? 'Guardando...' : 'Confirmar Cambios'}
                                    </button>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>,
                    document.body
                )}

                {showSearchModal && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
                        <div className="absolute inset-0" onClick={() => setShowSearchModal(false)} />
                        <DraggableWindow>
                            <div className="bg-white w-full max-w-3xl border border-gray-400 shadow-xl flex flex-col max-h-[70vh] pointer-events-auto">
                                <div className="modal-header bg-[#106ebe] px-3 py-1.5 flex justify-between items-center shrink-0 border-b border-white/10 select-none">
                                    <div className="flex items-center gap-2">
                                        <Search size={14} className="text-white/80" />
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-white">Buscador de Insumos</span>
                                    </div>
                                    <button onClick={() => setShowSearchModal(false)} className="px-2 py-0.5 hover:bg-red-500 text-white transition-colors text-xs font-bold">X</button>
                                </div>
                                <div className="p-3 bg-[#f0f0f0] border-b border-gray-300">
                                    <div className="flex items-center gap-3">
                                        <label className="text-[10px] font-bold uppercase text-slate-700 whitespace-nowrap">Buscar:</label>
                                        <div className="flex-1 relative">
                                            <input
                                                type="text" autoFocus placeholder="Ingrese nombre o código..." value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="w-full bg-white border border-gray-300 px-3 py-1.5 text-[10px] font-bold text-slate-700 focus:border-[#106ebe] outline-none uppercase placeholder:text-slate-300 transition-all shadow-inner"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto bg-white">
                                    <table className="w-full text-[10px] text-left border-collapse">
                                        <thead className="bg-[#e8e8e8] sticky top-0 z-10 select-none uppercase">
                                            <tr className="border-b border-gray-400 h-8">
                                                <th className="px-4 border-r border-gray-300 w-32">Código</th>
                                                <th className="px-4 border-r border-gray-300">Producto</th>
                                                <th className="px-4 border-r border-gray-300 w-32">Medida</th>
                                                <th className="px-4">Proveedor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {searchResults.length > 0 ? (
                                                searchResults.map(p => (
                                                    <tr key={p.id} onMouseDown={() => handleAddIngredient(p)} className="h-8 hover:bg-[#106ebe] hover:text-white cursor-pointer group">
                                                        <td className="px-3 border-r border-gray-100 font-bold tabular-nums text-slate-800 font-bold group-hover:text-white/80">{p.code || 'N/A'}</td>
                                                        <td className="px-3 border-r border-gray-100 font-bold uppercase text-[#106ebe] group-hover:text-white">{p.name}</td>
                                                        <td className="px-3 border-r border-gray-100 uppercase text-slate-800 font-bold group-hover:text-white/60">{p.quantity} {p.unit}</td>
                                                        <td className="px-3 truncate text-slate-800 font-bold group-hover:text-white/60 text-[9.5px] uppercase">{suppliers.find(s => s.id === p.supplier_id)?.name || 'SIN PROVEEDOR'}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={4} className="py-20 text-center text-slate-800 font-bold italic">No se encontraron resultados</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-3 py-1 bg-[#f0f0f0] border-t-2 border-gray-300 flex justify-between items-center shrink-0">
                                    <span className="text-[9.5px] font-bold text-[#106ebe] uppercase flex items-center gap-1"><Package size={10} /> {searchResults.length} Ítems</span>
                                    <button onClick={() => setShowSearchModal(false)} className="px-6 py-1 bg-[#f0f0f0] border-2 border-gray-400 text-[#106ebe] text-[10px] font-bold uppercase hover:bg-red-500 hover:text-white shadow-sm">Cerrar [ESC]</button>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>,
                    document.body
                )}

                {showConfigModal && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
                        <div className="absolute inset-0" onClick={() => setShowConfigModal(false)} />
                        <DraggableWindow>
                            <div className="bg-white w-full max-w-md border border-gray-400 shadow-xl flex flex-col pointer-events-auto">
                                <div className="modal-header bg-[#106ebe] px-3 py-1.5 flex justify-between items-center shrink-0 select-none">
                                    <div className="flex items-center gap-2"><Settings size={14} className="text-white/80" /> <span className="text-[11px] font-bold uppercase text-white">Configuración de Insumo</span></div>
                                    <button onClick={() => setShowConfigModal(false)} className="px-2 py-0.5 hover:bg-red-500 text-white font-bold">X</button>
                                </div>
                                <div className="p-4 bg-[#f0f0f0] space-y-4">
                                    <div className="flex items-center gap-3">
                                        <label className="w-20 text-[10px] font-bold uppercase text-slate-700">Insumo:</label>
                                        <div className="flex-1 bg-white border border-gray-300 px-3 py-1.5 font-bold text-[10px] text-[#106ebe] uppercase truncate">{selectedIngredient?.name}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="w-20 text-[10px] font-bold uppercase text-slate-700">Consumo:</label>
                                        <div className="flex-1 flex gap-1">
                                            <input type="number" autoFocus value={configData.quantity} onChange={e => setConfigData({ ...configData, quantity: parseFloat(e.target.value) || 0 })} className="w-24 bg-white border border-gray-300 px-3 py-1.5 text-[10px] font-bold text-center text-slate-700 outline-none shadow-inner" />
                                            <select value={configData.unit} onChange={e => setConfigData({ ...configData, unit: e.target.value })} className="flex-1 h-8 border border-gray-300 bg-white px-2 text-[10px] font-bold uppercase text-slate-700 outline-none">
                                                <option value="Unidad">Unidad (UN)</option>
                                                <option value="Mililitro">Mililitro (ML)</option>
                                                <option value="Gramo">Gramo (GR)</option>
                                                <option value="Onza">Onza (OZ)</option>
                                                <option value="Libra">Libra (LB)</option>
                                                <option value="Litro">Litro (LT)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="pt-2 flex justify-end gap-2">
                                        <button onClick={() => setShowConfigModal(false)} className="px-4 py-1.5 bg-[#d1d1d1] border border-gray-400 text-slate-700 text-[10px] font-bold uppercase">Cancelar</button>
                                        <button onClick={confirmAddIngredient} className="px-6 py-1.5 bg-[#106ebe] text-white text-[10px] font-bold uppercase shadow-sm">Agregar</button>
                                    </div>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>,
                    document.body
                )}

                {productContextMenu && createPortal(
                    <div className="fixed inset-0 z-[99999]" onClick={() => setProductContextMenu(null)}>
                        <div className="absolute bg-[#f0f0f0] border border-gray-400 shadow-lg py-1 min-w-[200px]" style={{ left: productContextMenu.x, top: productContextMenu.y }}>
                            <div className="px-3 py-1 border-b border-gray-300 bg-[#e1e1e1] flex items-center gap-2">
                                <Package size={12} className="text-slate-800 font-bold" />
                                <span className="text-[10px] font-bold uppercase truncate text-slate-800 font-bold">{productContextMenu.product?.name || 'PRODUCTOS'}</span>
                            </div>
                            <button onClick={handleNew} className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-slate-800 font-bold hover:bg-[#106ebe] hover:text-white uppercase cursor-pointer"><PlusCircle size={14} className="inline mr-2" /> Nuevo</button>
                            {productContextMenu.product && (
                                <>
                                    <button onClick={() => handleEdit(productContextMenu.product)} className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-slate-800 font-bold hover:bg-[#106ebe] hover:text-white uppercase cursor-pointer"><Pencil size={14} className="inline mr-2" /> Editar</button>
                                    <button onClick={() => handleDelete(productContextMenu.product.id)} className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-[#106ebe] hover:text-white uppercase cursor-pointer"><Trash size={14} className="inline mr-2" /> Eliminar</button>
                                </>
                            )}
                        </div>
                    </div>,
                    document.body
                )}

                {categoryContextMenu && createPortal(
                    <div className="fixed inset-0 z-[99999]" onClick={() => setCategoryContextMenu(null)}>
                        <div className="absolute bg-[#f0f0f0] border border-gray-400 shadow-lg py-1 min-w-[200px]" style={{ left: categoryContextMenu.x, top: categoryContextMenu.y }}>
                            <div className="px-3 py-1 border-b border-gray-300 bg-[#e1e1e1] flex items-center gap-2"><Folder size={12} className="text-[#f0ba4c]" /> <span className="text-[10px] font-bold uppercase truncate text-slate-800 font-bold">{categoryContextMenu.category.name}</span></div>
                            <button onClick={() => handleNewCategory(categoryContextMenu.category.id)} className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-slate-800 font-bold hover:bg-[#106ebe] hover:text-white uppercase cursor-pointer"><PlusCircle size={14} className="inline mr-2" /> Nuevo</button>
                            {categoryContextMenu.category.id && (
                                <>
                                    <button onClick={() => handleEditCategory(categoryContextMenu.category)} className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-slate-800 font-bold hover:bg-[#106ebe] hover:text-white uppercase cursor-pointer"><Pencil size={14} className="inline mr-2" /> Editar</button>
                                    <button onClick={() => handleDeleteCategory(categoryContextMenu.category.id)} className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-[#106ebe] hover:text-white uppercase cursor-pointer"><Trash size={14} className="inline mr-2" /> Eliminar</button>
                                </>
                            )}
                        </div>
                    </div>,
                    document.body
                )}

                {showCategoryModal && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5">
                        <DraggableWindow>
                            <div className="w-[500px] bg-[#f0f0f0] border border-[#106EBE] flex flex-col">
                                <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center text-white font-bold select-none cursor-move">
                                    <span className="text-[12px] uppercase">Categorías</span>
                                    <button onClick={() => setShowCategoryModal(false)}><X size={18} /></button>
                                </div>
                                <div className="p-4 space-y-4">
                                    <fieldset className="border border-gray-400 p-3 pt-4 relative">
                                        <legend className="absolute -top-2.5 left-2 bg-[#f0f0f0] text-[10px] font-bold text-[#106EBE] uppercase px-1">Datos</legend>
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-2">
                                                <label className="w-24 text-[10px] font-bold uppercase text-slate-800 font-bold">Nombre</label>
                                                <input value={categoryFormData.name} onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value.toUpperCase() })} className="flex-1 bg-white border border-gray-400 px-2 h-7 text-[11px] text-slate-800 font-bold uppercase outline-none focus:border-[#106EBE]" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24" />
                                                <label className="flex items-center gap-2 cursor-pointer font-bold text-[10px] uppercase text-slate-800 font-bold">
                                                    <input type="checkbox" checked={categoryFormData.is_subcategory} onChange={e => setCategoryFormData({ ...categoryFormData, is_subcategory: e.target.checked, parent_id: e.target.checked ? categoryFormData.parent_id : null })} /> Es Subcategoría
                                                </label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="w-24 text-[10px] font-bold uppercase text-slate-800 font-bold">Padre</label>
                                                <div className="flex-1 relative">
                                                    <input
                                                        type="text"
                                                        disabled={!categoryFormData.is_subcategory}
                                                        placeholder="BUSCAR PADRE..."
                                                        value={showParentDropdown ? parentSearch : (categories.find(c => c.id === categoryFormData.parent_id)?.name || '[NINGUNO]')}
                                                        onFocus={() => { setShowParentDropdown(true); setParentSearch(''); }}
                                                        onChange={e => { setParentSearch(e.target.value); setShowParentDropdown(true); }}
                                                        className="w-full h-7 border border-gray-400 px-2 text-[11px] text-slate-800 font-bold uppercase underline-none focus:border-[#106EBE] disabled:bg-gray-200"
                                                    />
                                                    {showParentDropdown && (
                                                        <>
                                                            <div className="fixed inset-0 z-40" onClick={() => setShowParentDropdown(false)} />
                                                            <div className="absolute z-50 top-full mt-1 inset-x-0 bg-white border border-gray-400 shadow-xl p-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setCategoryFormData({ ...categoryFormData, parent_id: null }); setShowParentDropdown(false); }}
                                                                    className="w-full text-left px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-[#106ebe] hover:text-white transition-colors uppercase"
                                                                >
                                                                    [NINGUNO]
                                                                </button>
                                                                {categories.filter(c => c.id !== editingCategory?.id && c.name.toLowerCase().includes(parentSearch.toLowerCase())).map(cat => (
                                                                    <button
                                                                        key={cat.id}
                                                                        type="button"
                                                                        onClick={() => { setCategoryFormData({ ...categoryFormData, parent_id: cat.id }); setShowParentDropdown(false); }}
                                                                        className="w-full text-left px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-[#106ebe] hover:text-white transition-colors uppercase"
                                                                    >
                                                                        {cat.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="w-24 text-[10px] font-bold uppercase text-slate-800 font-bold">Módulo</label>
                                                <select
                                                    value={categoryFormData.section || 'INVENTARIO'}
                                                    onChange={e => setCategoryFormData({ ...categoryFormData, section: e.target.value as any })}
                                                    className="flex-1 bg-white border border-gray-400 px-2 h-7 text-[11px] text-slate-800 font-bold uppercase outline-none focus:border-[#106EBE]"
                                                >
                                                    <option value="MENU">MENÚ (PLATILLOS Y BEBIDAS)</option>
                                                    <option value="INVENTARIO">INVENTARIO (MATERIA PRIMA)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </fieldset>
                                </div>
                                <div className="h-10 px-4 bg-[#e1e1e1] border-t border-gray-400 flex justify-end items-center gap-2">
                                    <button onClick={() => setShowCategoryModal(false)} className="px-4 py-1.5 bg-[#d1d1d1] border border-gray-400 text-slate-800 font-bold font-bold uppercase text-[10px] hover:bg-[#c1c1c1] transition-colors cursor-pointer">Cancelar</button>
                                    <button onClick={handleSaveCategory} className="px-6 py-1.5 bg-[#106ebe] text-white font-bold uppercase text-[10px] hover:bg-[#005a9e] transition-colors cursor-pointer shadow-sm">Guardar</button>
                                </div>
                            </div>
                        </DraggableWindow>
                    </div>,
                    document.body
                )}
                <style>{`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: #f1f1f1;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: #ccc;
                        border-radius: 3px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #999;
                    }
                    .modal-open {
                        overflow: hidden !important;
                    }
                `}</style>
                
                {confirmAction && (
                    <WindowsConfirmModal
                        message={confirmAction.message}
                        onConfirm={confirmAction.onConfirm}
                        onCancel={() => setConfirmAction(null)}
                    />
                )}
            </div>
        </>
    );
};
