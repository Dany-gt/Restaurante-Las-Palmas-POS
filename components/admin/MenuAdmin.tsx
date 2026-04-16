import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Search, Edit2, Trash2, Image as ImageIcon, Loader2, X, ChefHat, Save, CheckCircle2,
  Printer, Sparkles, Info, Settings, ChevronRight, ChevronDown, Folder, FolderOpen, Package, Layers, Check, Utensils, Grid, Columns, PieChart,
  BookOpen, Building2, AlertCircle, PlusCircle, Trash, List, FileText, RefreshCw
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { MenuEngineeringModal } from './MenuEngineeringModal';
import { Product, Category } from '../../types';
import { removeBackground } from '@imgly/background-removal';
import { printService } from '../../services/PrintService';
import { useNotify } from '../../hooks/useNotify';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { WindowsConfirmModal } from '../WindowsConfirmModal';
import { registrarAuditoria, detectarCambios } from '../../services/auditService';
import { activityLogService } from '../../services/ActivityLogService';

export const MenuAdmin: React.FC = () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kitchens, setKitchens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isImproving, setIsImproving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const notify = useNotify();
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const [branches, setBranches] = useState<any[]>([]);
  const [branchPrices, setBranchPrices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'branches' | 'options' | 'recipe'>('branches');
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [globalPrices, setGlobalPrices] = useState({ price: '', delivery_price: '', platform_price: '' });
  const [branchStock, setBranchStock] = useState<any[]>([]);

  // Options and Modifiers State
  interface AssignedGroup {
    group_id: string;
    min_selection: number;
    max_selection: number;
  }
  const [optionGroups, setOptionGroups] = useState<any[]>([]);
  const [assignedOptionGroups, setAssignedOptionGroups] = useState<AssignedGroup[]>([]);

  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [assignedModifierGroups, setAssignedModifierGroups] = useState<AssignedGroup[]>([]);

  // UX state for Floating Search
  const [searchModal, setSearchModal] = useState<{ visible: boolean, type: 'options' | 'modifiers' | 'inventory' | null, query: string }>({ visible: false, type: null, query: '' });

  // Recipe State
  const [recipeItems, setRecipeItems] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [configModal, setConfigModal] = useState<{ visible: boolean, item: any, quantity: string, unit: string } | null>(null);

  const [newProduct, setNewProduct] = useState({
    product_code: '',
    name: '',
    short_name: '',
    cost_price: '',
    category_id: '',
    kitchen_station_id: '',
    description: '',
    image_url: '',
    priority: '100',
    is_enabled: true,
    stock_quantity: '',
    min_stock_level: '',
    unit_measure: 'Unidades',
    classification: '',
    portions: '1',
    portion_size: '',
    serving_temp: '',
    prep_time: '',
    prepared_by: '',
    prep_procedure: '',
    observations: '',
    inventory_item_id: ''
  });

  const [isMobile, setIsMobile] = useState(false);
  const [showMobileCategories, setShowMobileCategories] = useState(false);

  // Filter States
  const [searchCategory, setSearchCategory] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return cachedUser?.branch_id || 'all';
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, product: Product | null }>({ visible: false, x: 0, y: 0, product: null });
  const [optionsContextMenu, setOptionsContextMenu] = useState<{ visible: boolean, x: number, y: number, type: 'options' | 'modifiers' | null, targetGroupId?: string }>({ visible: false, x: 0, y: 0, type: null });
  const [showQuickModal, setShowQuickModal] = useState<'category' | 'station' | null>(null);

  // Category Management State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMenuEngineering, setShowMenuEngineering] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    parent_id: '' as string | null,
    priority: '100',
    is_enabled: true
  });
  const [categoryContextMenu, setCategoryContextMenu] = useState<{ visible: boolean, x: number, y: number, category: Category | null }>({ visible: false, x: 0, y: 0, category: null });
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<Category | null>(null);

  // Helper para posicionar menús contextuales dentro del viewport
  const handleShowContextMenu = (e: React.MouseEvent, type: 'product' | 'category' | 'options', data: any, extra?: any) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 220;
    const menuHeight = 250;

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

    x = Math.max(5, x);
    y = Math.max(5, y);

    if (type === 'product') setContextMenu({ visible: true, x, y, product: data });
    else if (type === 'category') setCategoryContextMenu({ visible: true, x, y, category: data });
    else if (type === 'options') setOptionsContextMenu({ visible: true, x, y, type: data, targetGroupId: extra });
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showRecipeModal) setShowRecipeModal(false);
        else if (showModal) { setShowModal(false); resetForm(); }
        else if (showCategoryModal) setShowCategoryModal(false);
        else if (searchModal.visible) setSearchModal({ visible: false, type: null, query: '' });
        else if (configModal?.visible) setConfigModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showRecipeModal, showModal, showCategoryModal, searchModal.visible, configModal]);

  const fetchData = async () => {
    setLoading(true);
    const [catRes, prodRes, kitchenRes, branchRes, modGroupRes, optGroupRes, invRes, supRes, stockRes] = await Promise.all([
      supabase.from('categories').select('*').eq('section', 'VENTA').order('name'),
      supabase.from('products').select('*, categories(name), kitchen_stations(name)').order('name'),
      supabase.from('kitchen_stations').select('*').order('name'),
      supabase.from('branches').select('*').order('name'),
      supabase.from('modifier_groups').select('*').order('name'),
      supabase.from('option_groups').select('*').order('name'),
      supabase.from('inventory_items').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('inventory_item_branches').select('*')
    ]);

    if (branchRes.error) notify.error('Error al cargar sucursales: ' + branchRes.error.message);
    if (prodRes.error) notify.error('Error al cargar productos: ' + prodRes.error.message);

    // Guardar stock de sucursales en un estado para usarlo en la tabla
    (window as any).__inventory_stock = stockRes.data || [];

    setCategories(catRes.data || []);
    setProducts(prodRes.data || []);
    setKitchens(kitchenRes.data || []);
    setBranches(branchRes.data || []);
    setModifierGroups(modGroupRes.data || []);
    setOptionGroups(optGroupRes.data || []);
    setInventoryItems(invRes.data || []);
    setSuppliers(supRes.data || []);
    setBranchStock(stockRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getAvailableUnits = (sourceUnit: string) => {
  const s = sourceUnit?.toLowerCase() || '';
  if (s.includes('libra') || s.includes('kilogramo') || s === 'kg' || s === 'lb') {
    return [{ value: 'gramos', label: 'GRAMOS (GR)' }, { value: 'onzas', label: 'ONZAS (OZ)' }];
  }
  if (s.includes('litro') || s === 'lt' || s === 'ml') {
    return [{ value: 'ml', label: 'MILILITROS (ML)' }, { value: 'onzas', label: 'ONZAS (OZ)' }];
  }
  return [{ value: 'unidad', label: 'UNIDAD (UN)' }];
};

  const totalReceta = recipeItems.reduce((acc, item) => {
    const cost = item.inventory_items?.average_cost || item.inventory_items?.cost_price || 0;
    return acc + (parseFloat(item.quantity || 0) * cost);
  }, 0);

  const agregarAReceta = (item: any) => {
    if (recipeItems.some(ri => ri.inventory_item_id === item.id)) {
      notify.info("Este insumo ya se encuentra en el listado.");
      return;
    }
    const units = getAvailableUnits(item.unit || '');
    setConfigModal({
      visible: true,
      item: item,
      quantity: '1',
      unit: units[0].value
    });
  };

  const toggleCategory = (id: string) => {
    const next = new Set(expandedCategories);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCategories(next);
  };

  const renderCategoryTree = (parentId: string | null = null, depth = 0) => {
    return categories
      .filter(c => c.parent_id === parentId)
      .filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchCategory.toLowerCase());
        const matchesBranch = selectedBranch === 'all' || !c.branch_id || c.branch_id === selectedBranch;
        return matchesSearch && matchesBranch;
      })
      .map(cat => {
        const hasChildren = categories.some(c => c.parent_id === cat.id);
        const isExpanded = expandedCategories.has(cat.id);
        const isSelected = selectedCategory === cat.id;

        return (
          <div key={cat.id} className="flex flex-col">
            <div className="flex items-center">
              <button
                onClick={() => {
                  setSelectedCategory(isSelected ? null : cat.id);
                  if (hasChildren) toggleCategory(cat.id);
                }}
                onContextMenu={(e) => handleShowContextMenu(e, 'category', cat)}
                className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded-sm text-left transition-none ${isSelected ? 'bg-[#106ebe] text-white' : 'text-slate-700 hover:bg-[#e1e5eb]'}`}
              >
                <div style={{ paddingLeft: `${depth * 0.75}rem` }} className="flex items-center gap-1.5 flex-1">
                  {hasChildren ? (
                    <div className="w-3 h-3 flex items-center justify-center border border-gray-400 bg-white mr-0.5">
                      {isExpanded ? <span className="text-[10px] font-bold text-gray-600 leading-none mt-[-1px]">-</span> : <span className="text-[10px] font-bold text-gray-600 leading-none mt-[-1px]">+</span>}
                    </div>
                  ) : (
                    <div className="w-4"></div>
                  )}
                  {hasChildren ? (isExpanded ? <FolderOpen size={14} className={isSelected ? 'text-white' : 'text-amber-500'} /> : <Folder size={14} className={isSelected ? 'text-white' : 'text-amber-500'} />) : <Package size={13} className={isSelected ? 'text-white' : 'text-slate-400'} />}
                  <span className={`text-[10px] font-bold uppercase tracking-tight truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {cat.name}
                  </span>
                </div>
              </button>
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

    // Si hay una categoría seleccionada, buscar si el producto pertenece a ella o a alguna subcategoría de la misma
    const matchesCategory = selectedCategory
      ? p.category_id === selectedCategory || categories.find(c => c.id === p.category_id)?.parent_id === selectedCategory
      : true;

    const matchesBranch = selectedBranch === 'all' || !p.branch_id || p.branch_id === selectedBranch;

    return matchesSearch && matchesCategory && matchesBranch;
  });

  // Body Scroll Lock
  useEffect(() => {
    const isAnyModalOpen = showModal || searchModal.visible || configModal?.visible || showRecipeModal;
    if (isAnyModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [showModal, searchModal.visible, configModal?.visible, showRecipeModal]);

  // Keyboard Shortcuts (Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close modals in reverse order of depth
        if (configModal?.visible) {
          setConfigModal(null);
        } else if (searchModal.visible) {
          setSearchModal({ visible: false, type: null, query: '' });
        } else if (showRecipeModal) {
          setShowRecipeModal(false);
        } else if (showModal) {
          setShowModal(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [configModal, searchModal, showRecipeModal, showModal]);

  useEffect(() => {
    const handleGlobalClick = () => {
      if (optionsContextMenu.visible) setOptionsContextMenu(prev => ({ ...prev, visible: false }));
      if (contextMenu.visible) setContextMenu(prev => ({ ...prev, visible: false }));
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [optionsContextMenu.visible, contextMenu.visible]);

  // Carga automática de receta al abrir el modal de Ficha Técnica
  useEffect(() => {
    const fetchRecipeItems = async () => {
      if (!editingId) return;

      console.log('[RECIPE_EFFECT] Modal de receta abierto. Verificando insumos para:', editingId);

      // Solo cargar si no se ha cargado o si está vacío (prevención de llamadas duplicadas si ya se cargó en un onDoubleClick)
      if (recipeItems.length === 0) {
        try {
          const { data, error } = await supabase
            .from('product_recipes')
            .select('*, inventory_items(*)')
            .eq('product_id', editingId);

          if (error) {
            console.error('[RECIPE_EFFECT_ERROR]:', error);
          } else {
            console.log('[RECIPE_EFFECT_SUCCESS] Datos cargados dinámicamente:', data);
            setRecipeItems(data || []);
          }
        } catch (err) {
          console.error('[RECIPE_EFFECT_CRITICAL]:', err);
        }
      }
    };

    if (showRecipeModal && editingId) {
      fetchRecipeItems();
    }
  }, [showRecipeModal, editingId]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    
    // Primero eliminamos dependencias que causan FK errors (registros de producción)
    await supabase.from('registros_produccion').delete().eq('platillo_id', confirmDelete.id);
    await supabase.from('rendimiento_cocina').delete().eq('platillo_id', confirmDelete.id);
    
    const { error } = await supabase.from('products').delete().eq('id', confirmDelete.id);
    if (error) {
      if (error.code === '23503') { // Foreign Key Violation for non-handled tables
        notify.error('No se puede eliminar porque este producto tiene transacciones (ventas) registradas que no pueden borrarse por integridad contable. \n\nSugerencia: Edítalo y desmarca "Producto Habilitado" para ocultarlo.');
      } else {
        notify.error('Error al eliminar: ' + error.message);
      }
    } else {
      notify.success('Producto eliminado correctamente');
      fetchData();
    }
    setConfirmDelete(null);

    // LOG: Product Deletion
    if (currentUser && confirmDelete) {
        registrarAuditoria({
            modulo: 'PLATILLOS',
            accion: 'PLATILLO_ELIMINADO' as any,
            accion_descripcion: `Eliminó el platillo ${confirmDelete.name} de forma permanente`,
            entidad_id: confirmDelete.id,
            entidad_tipo: 'platillo',
            entidad_nombre: confirmDelete.name,
            valores_anteriores: { 
                precio: confirmDelete.price,
                motivo_eliminacion: "Eliminado desde panel administrativo"
            }
        }, currentUser);
    }
  };

  const handleSave = async () => {
    if (!newProduct.name || !newProduct.category_id) {
      notify.error('El nombre y la categoría son obligatorios');
      return;
    }

    setIsSaving(true);

    const costPrice = parseFloat(newProduct.cost_price) || 0;
    const priority = parseInt(newProduct.priority) || 100;

    // Legacy compatibility for older system columns that expect a NOT NULL price
    const fallbackPrice = branchPrices.length > 0 ? parseFloat(branchPrices[0].price) || 0 : 0;

    const productData = {
      product_code: newProduct.product_code,
      name: newProduct.name.toUpperCase(),
      short_name: newProduct.short_name.toUpperCase(),
      cost_price: costPrice,
      priority: priority,
      category_id: newProduct.category_id,
      kitchen_station_id: newProduct.kitchen_station_id || null,
      description: newProduct.description,
      image_url: newProduct.image_url,
      is_enabled: newProduct.is_enabled,
      price: fallbackPrice,
      stock_quantity: parseFloat(newProduct.stock_quantity) || 0,
      min_stock_level: parseFloat(newProduct.min_stock_level) || 0,
      unit_measure: newProduct.unit_measure,
      classification: newProduct.classification,
      portions: parseInt(newProduct.portions) || 1,
      portion_size: newProduct.portion_size,
      serving_temp: newProduct.serving_temp,
      prep_time: newProduct.prep_time,
      prepared_by: newProduct.prepared_by,
      prep_procedure: newProduct.prep_procedure,
      observations: newProduct.observations,
      inventory_item_id: newProduct.inventory_item_id || null
    };

    // Prepare old product state for diffs
    let oldProduct: any = null;
    if (editingId) {
        oldProduct = products.find(p => p.id === editingId);
    }

    let savedProductId = editingId;
    let error;

    if (editingId) {
      const { error: updateError } = await supabase.from('products').update(productData).eq('id', editingId);
      error = updateError;
    } else {
      const { data: newProdData, error: insertError } = await supabase.from('products').insert(productData).select();
      error = insertError;
      if (newProdData && newProdData.length > 0) {
        savedProductId = newProdData[0].id;
        setEditingId(savedProductId);
      }
    }

    if (!error && savedProductId) {
      let pmError = null;
      let poError = null;

      // 1. Save Branch Prices
      const branchPricesData = branchPrices
        .filter(bp => bp.branch_id && savedProductId)
        .map(bp => ({
          product_id: savedProductId,
          branch_id: bp.branch_id,
          price: parseFloat(bp.price?.toString()) || 0,
          delivery_price: parseFloat(bp.delivery_price?.toString()) || 0,
          platform_price: parseFloat(bp.platform_price?.toString()) || 0,
          is_enabled: Boolean(bp.is_enabled),
          is_assigned: Boolean(bp.is_assigned)
        }));

      const { error: bpError } = await supabase.from('product_branch_prices').upsert(branchPricesData, { onConflict: 'product_id,branch_id' });

      // 2. Guardar Modificadores (Limpiar e Insertar)
      await supabase.from('product_modifier_groups').delete().eq('product_id', savedProductId);
      if (assignedModifierGroups.length > 0) {
        const pmGroups = assignedModifierGroups.map(ag => ({
          product_id: savedProductId,
          group_id: ag.group_id,
          min_selection: Number(ag.min_selection) || 0,
          max_selection: Number(ag.max_selection) || 0
        }));
        await supabase.from('product_modifier_groups').insert(pmGroups);
      }

      // 3. Guardar Opciones (Limpiar e Insertar)
      await supabase.from('product_option_groups').delete().eq('product_id', savedProductId);
      if (assignedOptionGroups.length > 0) {
        const poGroups = assignedOptionGroups.map(ag => ({
          product_id: savedProductId,
          group_id: ag.group_id,
          min_selection: Number(ag.min_selection) || 0,
          max_selection: Number(ag.max_selection) || 0
        }));
        await supabase.from('product_option_groups').insert(poGroups);
      }

      // 4. Guardar Receta (Ciclo Blindado)
      const { error: recipeError } = await supabase.from('product_recipes').delete().eq('product_id', savedProductId);

      if (!recipeError && recipeItems.length > 0) {
        const pRecipes = recipeItems.map(ri => ({
          product_id: savedProductId,
          inventory_item_id: ri.inventory_item_id,
          quantity: parseFloat(ri.quantity?.toString()) || 0,
          unit_measure: ri.unit_measure || 'Unidades'
        }));

        const { error: insError } = await supabase.from('product_recipes').insert(pRecipes);
        if (insError) {
          notify.error(`Fallo en Receta: ${insError.message}`);
          throw insError; // Prevent proceeding if recipe fails
        }
      }

      if (!bpError && !recipeError) {
        console.log('[SAVE_SUCCESS] Todo guardado en disco.');

        if (showRecipeModal) {
          setShowRecipeModal(false);
          fetchData();
        } else {
          setShowModal(false);
          resetForm();
          fetchData();
        }
        notify.success(`Guardado global exitoso (${recipeItems.length} insumos registrados)`);

        // LOG: Product Save/Update
        if (currentUser && savedProductId) {
            if (editingId && oldProduct) {
                // If availability was changed:
                if (oldProduct.is_enabled !== productData.is_enabled) {
                    await registrarAuditoria({
                        modulo: 'PLATILLOS',
                        accion: 'DISPONIBILIDAD_CAMBIADA' as any,
                        accion_descripcion: `Disponibilidad de "${productData.name}" cambió a ${productData.is_enabled ? 'disponible' : 'agotado'}`,
                        entidad_id: savedProductId,
                        entidad_tipo: 'platillo',
                        entidad_nombre: productData.name,
                        valores_anteriores: { estado: oldProduct.is_enabled ? 'disponible' : 'agotado' },
                        valores_nuevos: { estado: productData.is_enabled ? 'disponible' : 'agotado' },
                        campos_modificados: ['is_enabled']
                    });
                }
                
                // If fallback legacy price was changed:
                const oldFallbackPrice = oldProduct.price || 0;
                if (fallbackPrice !== oldFallbackPrice) {
                    const diffQ = fallbackPrice - oldFallbackPrice;
                    const ventas_mes = 50; // estimate
                    
                    await registrarAuditoria({
                        modulo: 'PLATILLOS',
                        accion: 'PRECIO_CAMBIADO' as any,
                        accion_descripcion: `Precio "${productData.name}" cambió de Q${oldFallbackPrice} a Q${fallbackPrice}`,
                        entidad_id: savedProductId,
                        entidad_tipo: 'platillo',
                        entidad_nombre: productData.name,
                        valores_anteriores: { precio: oldFallbackPrice },
                        valores_nuevos: { precio: fallbackPrice },
                        campos_modificados: ['precio'],
                        impacto_financiero: {
                            diferencia_precio: diffQ,
                            impacto_mensual_estimado: `±Q${Math.abs(diffQ * ventas_mes)} si se mantienen ventas`
                        }
                    });
                }

                // General Diff tracking for remaining modifications
                const camposAdicionales = detectarCambios(oldProduct, { ...oldProduct, ...productData });
                const camposIgnorados = ['is_enabled', 'price', 'updated_at', 'created_at', 'id'];
                
                // Limpiar campos que ya registramos o que no interesan
                camposAdicionales.campos_modificados = camposAdicionales.campos_modificados.filter(k => !camposIgnorados.includes(k));
                
                if (camposAdicionales.campos_modificados.length > 0) {
                     await registrarAuditoria({
                        modulo: 'PLATILLOS',
                        accion: 'PLATILLO_MODIFICADO' as any,
                        accion_descripcion: `Modificó datos generales de "${productData.name}" (${camposAdicionales.campos_modificados.length} campos)`,
                        entidad_id: savedProductId,
                        entidad_tipo: 'platillo',
                        entidad_nombre: productData.name,
                        ...camposAdicionales
                    });
                }
            } else {
                await registrarAuditoria({
                    modulo: 'PLATILLOS',
                    accion: 'PLATILLO_CREADO' as any,
                    accion_descripcion: `Creó el nuevo platillo "${productData.name}" con precio base Q${productData.price}`,
                    entidad_id: savedProductId,
                    entidad_tipo: 'platillo',
                    entidad_nombre: productData.name,
                    valores_nuevos: {
                        categoria: categories.find(c => c.id === productData.category_id)?.name,
                        ...productData
                    }
                });
            }
        }
      } else {
        notify.error('Fallo parcial al guardar. Revise los mensajes de error en la consola.');
      }
    } else {
      notify.error('Error al guardar producto: ' + (error?.message || 'ID de producto no generado'));
    }
    setIsSaving(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setNewProduct({
      product_code: '',
      name: '',
      short_name: '',
      cost_price: '',
      category_id: '',
      kitchen_station_id: '',
      description: '',
      image_url: '',
      priority: '100',
      is_enabled: true,
      stock_quantity: '',
      min_stock_level: '',
      unit_measure: 'Unidades',
      classification: '',
      portions: '1',
      portion_size: '',
      serving_temp: '',
      prep_time: '',
      prepared_by: '',
      prep_procedure: '',
      observations: '',
      inventory_item_id: ''
    });
    // Proactive check: if branches state is empty, use empty but notify or try to get them
    const actualBranches = branches.length > 0 ? branches : [];
    setBranchPrices(actualBranches.map(b => ({
      branch_id: b.id,
      price: 0,
      delivery_price: 0,
      platform_price: 0,
      is_enabled: true,
      is_assigned: true
    })));
    setGlobalPrices({ price: '', delivery_price: '', platform_price: '' });
    setAssignedModifierGroups([]);
    setAssignedOptionGroups([]);
    setRecipeItems([]);
    setShowRecipeModal(false);
    setActiveTab('branches');
  };

  const handleImproveText = async (field: 'prep_procedure' | 'observations') => {
    const textToImprove = newProduct[field];
    if (!textToImprove) {
      notify.info('Por favor, escribe un borrador primero para que la IA pueda mejorarlo.');
      return;
    }

    setIsImproving(true);
    try {
      const systemPrompt = `Rol: Eres un experto en redacción técnica culinaria.
Tarea: Revisa el siguiente texto para corregir errores ortográficos, gramaticales y de puntuación, mejorando la fluidez sin alterar el contenido original.
Reglas estrictas:
- NO modifiques la información técnica ni el sentido original del texto.
- Corrige únicamente la ortografía y gramática para que el texto sea profesional.
- Mantén el estilo original (si hay listas, respétalas; si es párrafo, respétalo) pero con redacción impecable.
- Formato de salida: Devuelve ÚNICAMENTE el texto corregido. No agregues comentarios, saludos ni introducciones.`;

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

      if (!response.ok) {
        throw new Error('Error al conectar con la API de IA Gemini');
      }

      const data = await response.json();
      const improvedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (improvedText) {
        setNewProduct(prev => ({ ...prev, [field]: improvedText }));
      }
    } catch (error) {
      console.error('Error improving text with Gemini:', error);
      notify.error('Hubo un error al mejorar el texto.');
    } finally {
      setIsImproving(false);
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextId: string | null, formatCallback: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      formatCallback();
      if (nextId) {
        setTimeout(() => {
          const nextInput = document.getElementById(nextId);
          if (nextInput) {
            nextInput.focus();
            if (nextInput instanceof HTMLInputElement) nextInput.select();
          }
        }, 10);
      } else {
        e.currentTarget.blur();
      }
    }
  };

  return (
    <>
      <div ref={containerRef} className="animate-fade-in w-full h-full flex flex-col relative bg-[#f0f0f0] overflow-hidden">

        {/* 1. Filter Bar (Sucursal on Left, Show All on Right) */}
        <div className="bg-[#f0f0f0] border-y border-[#ccc] px-2 py-1 flex items-center justify-between shrink-0 shadow-sm z-20">
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
            {isMobile && (
              <button
                onClick={() => setShowMobileCategories(!showMobileCategories)}
                className={`p-1.5 rounded-sm border transition-all ${showMobileCategories ? 'bg-[#106ebe] text-white border-[#106ebe]' : 'bg-white text-[#106ebe] border-gray-400'}`}
                title="Mostrar Categorías"
              >
                <Grid size={16} />
              </button>
            )}
            <button
              onClick={() => { setSelectedCategory(null); if (isMobile) setShowMobileCategories(false); }}
              className="bg-[#106ebe] hover:bg-[#002244] text-white px-5 py-1.5 border border-[#001a33] text-[10px] font-black uppercase tracking-widest shadow-sm active:translate-y-[1px] transition-all"
            >
              Mostrar Todos
            </button>
          </div>
        </div>

        {/* 4. Main Content Area */}
        <div className={`flex-1 overflow-hidden flex ${isMobile ? 'flex-col' : 'flex-row'} p-1 gap-1`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-white border border-gray-300">
              <Loader2 className="animate-spin text-[#106ebe]" size={48} />
            </div>
          ) : (
            <>
              {/* Sidebar: Categorías de Menú */}
              <aside className={`${isMobile ? (showMobileCategories ? 'flex h-1/2' : 'hidden') : 'w-[280px] flex'} flex-col shrink-0`}>
                <div className="bg-[#106ebe] px-3 py-1.5 flex items-center justify-between rounded-t-sm">
                  <div className="flex items-center gap-2">
                    <Folder size={14} className="text-white" />
                    <span className="text-white text-[10px] font-bold font-black tracking-tight uppercase">Categorías de Menú</span>
                  </div>
                </div>
                <div className="flex-1 bg-white border border-gray-300 shadow-sm flex flex-col overflow-hidden">
                  <div className="bg-[#f8f9fa] border-b border-gray-200 px-3 py-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Categoría</span>
                  </div>
                  <div
                    className="flex-1 overflow-y-auto p-2 custom-scrollbar"
                    onContextMenu={(e) => {
                      handleShowContextMenu(e, 'category', null);
                    }}
                  >
                    {renderCategoryTree()}
                  </div>
                </div>
              </aside>

              {/* Main Table: Listado de Platillos */}
              <div className={`flex-1 flex flex-col overflow-hidden ${isMobile && showMobileCategories ? 'hidden' : 'flex'}`}>
                {/* Table Header Section */}
                <div className="bg-[#106ebe] px-3 py-1.5 flex items-center justify-between rounded-t-sm">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-white" />
                    <span className="text-white text-[10px] font-bold font-black tracking-tight uppercase">Listado de Platillos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="INTRODUZCA EL TEXTO A BUSCAR..."
                      className="bg-white border border-gray-300 px-2 py-0.5 text-[9px] font-bold text-slate-700 outline-none w-56 uppercase"
                      value={searchProduct}
                      onChange={e => setSearchProduct(e.target.value)}
                    />
                    <button className="bg-[#106ebe] hover:bg-[#002244] text-white px-5 py-0.5 border border-[#001a33] text-[9px] font-bold uppercase transition-all shadow-sm active:translate-y-[1px]">
                      BUSCAR
                    </button>
                  </div>
                </div>

                {/* Table Wrapper */}
                <div className="flex-1 bg-white border border-gray-300 shadow-sm flex flex-col overflow-hidden relative">
                  <div
                    className="flex-1 overflow-auto custom-scrollbar"
                    onContextMenu={(e) => {
                      if ((e.target as HTMLElement).closest('thead')) return;
                      handleShowContextMenu(e, 'product', null);
                    }}
                  >
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-20 bg-[#e8e8e8] select-none shadow-sm">
                        <tr className="h-8 border-b border-gray-400">
                          <th className="px-4 py-1 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 w-24">Código</th>
                          <th className="px-4 py-1 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300 min-w-[250px]">Platillo</th>
                          <th className="px-4 py-1 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300">Categoría</th>
                          <th className="px-4 py-1 text-left text-[10px] font-bold text-black uppercase border-r border-gray-300">Cocina</th>
                          <th className="px-4 py-1 text-center text-[10px] font-bold text-black uppercase border-r border-gray-300 w-20">Prioridad</th>
                          <th className="px-4 text-center text-[10px] font-bold text-black uppercase border-r border-gray-300 w-24">Existencia</th>
                          <th className="px-4 py-1 text-right text-[10px] font-bold text-black uppercase border-r border-gray-300 w-28">Precio Costo</th>
                          <th className="px-4 py-1 text-right text-[10px] font-bold text-black uppercase border-r border-gray-300 w-28">Precio Venta</th>
                          <th className="px-4 py-1 text-center text-[10px] font-bold text-black uppercase w-24">Habilitado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredProducts.map((prod) => (
                          <tr
                            key={prod.id}
                            className={`h-7 transition-colors cursor-default border-b border-gray-50 text-[10px] ${contextMenu.product?.id === prod.id
                              ? 'bg-[#106ebe] text-white selection:bg-white/20'
                              : 'text-slate-900 hover:bg-[#f2f7fb]'
                              }`}
                            onClick={() => setContextMenu({ ...contextMenu, visible: false, product: prod })}
                            onContextMenu={(e) => handleShowContextMenu(e, 'product', prod)}
                            onDoubleClick={() => {
                              setEditingId(prod.id);
                              setNewProduct({
                                product_code: prod.product_code || '',
                                name: prod.name,
                                short_name: prod.short_name || '',
                                cost_price: prod.cost_price?.toString() || '',
                                category_id: prod.category_id,
                                kitchen_station_id: prod.kitchen_station_id || '',
                                description: prod.description || '',
                                image_url: prod.image_url || '',
                                priority: prod.priority?.toString() || '100',
                                is_enabled: prod.is_enabled,
                                stock_quantity: prod.stock_quantity?.toString() || '',
                                min_stock_level: prod.min_stock_level?.toString() || '',
                                unit_measure: prod.unit_measure || 'Unidades',
                                classification: prod.classification || '',
                                portions: prod.portions?.toString() || '1',
                                portion_size: prod.portion_size || '',
                                serving_temp: prod.serving_temp || '',
                                prep_time: prod.prep_time || '',
                                prepared_by: prod.prepared_by || '',
                                prep_procedure: prod.prep_procedure || '',
                                observations: prod.observations || ''
                              });

                              // Load prices and groups for consistency with context menu edit
                              (async () => {
                                setLoading(true);
                                let currentBranches = branches;
                                if (currentBranches.length === 0) {
                                  const { data: latestBranches } = await supabase.from('branches').select('*').order('name');
                                  if (latestBranches) {
                                    currentBranches = latestBranches;
                                    setBranches(latestBranches);
                                  }
                                }

                                const { data: bpData } = await supabase.from('product_branch_prices').select('*').eq('product_id', prod.id);
                                if (bpData && bpData.length > 0) {
                                  setBranchPrices(currentBranches.map(b => bpData.find(pbp => pbp.branch_id === b.id) || { branch_id: b.id, price: prod.price || 0, delivery_price: prod.price || 0, platform_price: prod.price || 0, is_enabled: true, is_assigned: false }));
                                } else {
                                  setBranchPrices(currentBranches.map(b => ({ branch_id: b.id, price: prod.price || 0, delivery_price: prod.price || 0, platform_price: prod.price || 0, is_enabled: true, is_assigned: true })));
                                }

                                const { data: modData } = await supabase.from('product_modifier_groups').select('group_id, min_selection, max_selection').eq('product_id', prod.id);
                                setAssignedModifierGroups(modData?.map(m => ({ group_id: m.group_id, min_selection: m.min_selection || 0, max_selection: m.max_selection || 0 })) || []);

                                const { data: optData } = await supabase.from('product_option_groups').select('group_id, min_selection, max_selection').eq('product_id', prod.id);
                                setAssignedOptionGroups(optData?.map(o => ({ group_id: o.group_id, min_selection: o.min_selection || 0, max_selection: o.max_selection || 0 })) || []);

                                // Carga de Receta
                                try {
                                  const { data: recipeData } = await supabase.from('product_recipes').select('*, inventory_items(*)').eq('product_id', prod.id);
                                  setRecipeItems(recipeData || []);
                                } catch (err) {
                                  console.error('[RECIPE_DCLICK_FETCH]', err);
                                }

                                setLoading(false);
                                setShowModal(true);
                              })();
                            }}
                          >
                            <td className="px-4 py-1 uppercase border-r border-gray-100 font-bold text-gray-400 tabular-nums">{prod.product_code || '--'}</td>
                            <td className="px-4 py-1 uppercase font-bold truncate">{prod.name}</td>
                            <td className={`px-4 py-1 uppercase border-r border-gray-100 ${contextMenu.product?.id === prod.id ? 'text-white' : 'text-slate-600'}`}>{prod.categories?.name}</td>
                            <td className={`px-4 py-1 uppercase border-r border-gray-100 ${contextMenu.product?.id === prod.id ? 'text-white' : 'text-slate-600/80'}`}>{prod.kitchen_stations?.name || '--'}</td>
                            <td className="px-4 py-1 text-center border-r border-gray-100">{prod.priority || 100}</td>
                            <td className="px-4 py-1 text-center border-r border-gray-100 font-bold tabular-nums">
                              {(() => {
                                const invId = (prod as any).inventory_item_id;
                                if (!invId) return 'N/A';

                                const branchItems = branchStock.filter((s: any) => s.item_id === invId);
                                if (selectedBranch === 'all') {
                                  return branchItems.reduce((acc: number, s: any) => acc + (s.quantity || 0), 0).toFixed(0);
                                } else {
                                  return (branchItems.find((s: any) => s.branch_id === selectedBranch)?.quantity || 0).toFixed(0);
                                }
                              })()}
                            </td>
                            <td className="px-4 py-1 text-right border-r border-gray-100 font-bold tabular-nums">Q{Number(prod.cost_price || 0).toFixed(2)}</td>
                            <td className="px-4 py-1 text-right border-r border-gray-100 font-bold tabular-nums">Q{Number(prod.price).toFixed(2)}</td>
                            <td className="px-4 py-1 text-center">
                              <input
                                type="checkbox"
                                readOnly
                                checked={prod.is_enabled}
                                className="w-3.5 h-3.5 accent-[#0078d7]"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer */}
                  <div className="h-6 bg-[#f0f0f0] border-t border-[#ccc] flex items-center px-4 shrink-0 select-none">
                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tight">Platos: {filteredProducts.length}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      {/* Main Product Modal Portal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/5 animate-in fade-in duration-200">
          <DraggableWindow>
            <div className="w-[980px] bg-[#f0f0f0] border border-[#106ebe] shadow-[0_0_30px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden select-none animate-in zoom-in-95 duration-200 rounded-sm">
              {/* Main Premium Header */}
              <div className="bg-[#106ebe] h-8 px-3 flex justify-between items-center text-white shrink-0 modal-header cursor-move">
                <div className="flex items-center gap-2">
                  <Utensils size={14} className="text-white" />
                  <span className="text-[11px] font-bold uppercase tracking-wide">Mantenimiento de Platillos</span>
                </div>
                <div className="flex items-center h-full">
                  <WindowsSaveButton onClick={handleSave} loading={isSaving} variant="minimal" title="Guardar Producto" />
                  <button onClick={() => { setShowModal(false); resetForm(); }} className="h-8 w-8 flex items-center justify-center hover:bg-red-500 text-white transition-colors ml-1">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 bg-[#f0f0f0]">
                
                {/* Section 1: DATOS DE PLATILLO */}
                <div className="border border-gray-300 bg-white ring-1 ring-black/5 overflow-hidden rounded-sm">
                  <div className="bg-[#f8fafc] px-4 py-1.5 border-b border-gray-200">
                    <span className="text-[9px] font-black text-[#106ebe] uppercase tracking-widest">Datos de Platillo</span>
                  </div>
                  
                  <div className="p-4 pt-6 flex gap-8 font-sans">
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-medium text-slate-600 w-20">Código</label>
                          <input
                            value={newProduct.product_code}
                            onChange={e => setNewProduct({ ...newProduct, product_code: e.target.value })}
                            className="w-32 h-8 border border-gray-300 px-3 text-[12px] font-medium text-slate-700 outline-none focus:border-[#106ebe] bg-white rounded-sm"
                          />
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <label className="text-[11px] font-medium text-slate-600 w-12 text-center">Plato</label>
                          <input
                            value={newProduct.name}
                            onChange={e => setNewProduct({ ...newProduct, name: e.target.value.toUpperCase() })}
                            className="flex-1 h-8 border border-gray-300 px-3 text-[12px] font-medium text-slate-700 outline-none focus:border-[#106ebe] bg-white uppercase rounded-sm"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-medium text-slate-600 w-20">Nombre Corto</label>
                        <input
                          value={newProduct.short_name}
                          onChange={e => setNewProduct({ ...newProduct, short_name: e.target.value.toUpperCase() })}
                          className="flex-1 h-8 border border-gray-300 px-3 text-[12px] font-medium text-slate-700 outline-none focus:border-[#106ebe] bg-white uppercase rounded-sm"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-medium text-slate-600 w-20">Descripción</label>
                        <input
                          value={newProduct.description}
                          onChange={e => setNewProduct({ ...newProduct, description: e.target.value.toUpperCase() })}
                          className="flex-1 h-8 border border-gray-300 px-3 text-[12px] font-medium text-slate-700 outline-none focus:border-[#106ebe] bg-white uppercase rounded-sm"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1 flex items-center gap-2">
                          <label className="text-[11px] font-medium text-slate-600 w-20">Precio Costo</label>
                          <div className="flex-1 relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">Q</span>
                            <input
                              value={newProduct.cost_price}
                              onChange={e => setNewProduct({ ...newProduct, cost_price: e.target.value.replace(/[^0-9.]/g, '') })}
                              className="w-full h-8 border border-gray-300 pl-6 pr-3 text-[12px] font-medium text-slate-700 outline-none focus:border-[#106ebe] bg-white rounded-sm"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-medium text-slate-600 w-16 text-center">Prioridad</label>
                          <input
                            value={newProduct.priority}
                            onChange={e => setNewProduct({ ...newProduct, priority: e.target.value.replace(/[^0-9]/g, '') })}
                            className="w-32 h-8 border border-gray-300 px-3 text-center text-[12px] font-medium text-slate-700 outline-none focus:border-[#106ebe] bg-white rounded-sm"
                          />
                        </div>
                      </div>

                      {/* CategorÃa con Buscador */}
                      <div className="flex items-start gap-2">
                        <label className="text-[11px] font-medium text-slate-600 w-20 pt-1">Categoría</label>
                        <div className="flex-1 relative">
                          <div className="flex gap-1">
                            <select
                              value={newProduct.category_id}
                              onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })}
                              className="flex-1 h-8 border border-gray-300 px-2 text-[11px] text-slate-700 outline-none focus:border-[#106ebe] bg-white cursor-pointer rounded-sm"
                            >
                              <option value="">-- SELECCIONE CATEGORÍA --</option>
                              {categories.slice(0, 50).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button 
                              onClick={() => {
                                const q = prompt("Buscar categoría:");
                                if (q) {
                                  const found = categories.find(c => c.name.toLowerCase().includes(q.toLowerCase()));
                                  if (found) setNewProduct({ ...newProduct, category_id: found.id });
                                }
                              }}
                              className="w-8 h-8 bg-gray-100 border border-gray-300 flex items-center justify-center hover:bg-gray-200 text-gray-600"
                              title="Buscar Categoría"
                            >
                              <Search size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-medium text-slate-600 w-20">Cocina</label>
                        <select
                          value={newProduct.kitchen_station_id}
                          onChange={e => setNewProduct({ ...newProduct, kitchen_station_id: e.target.value })}
                          className="flex-1 h-8 border border-gray-300 px-2 text-[11px] text-slate-700 outline-none focus:border-[#106ebe] bg-white cursor-pointer rounded-sm"
                        >
                          <option value="">-- NINGUNA / SALÓN --</option>
                          {kitchens.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-medium text-slate-600 w-20">Insumo Stock</label>
                        <select
                          value={newProduct.inventory_item_id}
                          onChange={e => setNewProduct({ ...newProduct, inventory_item_id: e.target.value })}
                          className="flex-1 h-8 border border-[#106ebe]/30 px-2 text-[11px] text-[#106ebe] font-bold outline-none focus:border-[#106ebe] bg-blue-50/30 cursor-pointer rounded-sm"
                        >
                          <option value="">-- SIN VINCULACIÓN A STOCK --</option>
                          {inventoryItems.slice(0, 100).map(inv => <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit_measure})</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="w-[180px] flex flex-col items-center gap-3">
                      <div className="w-[150px] h-[150px] bg-white border border-gray-200 flex flex-col items-center justify-center p-1 shadow-inner relative group shrink-0 rounded-sm">
                         {newProduct.image_url ? (
                          <img src={newProduct.image_url} className="w-full h-full object-contain" alt="Preview" />
                         ) : (
                           <ImageIcon size={48} className="text-gray-100" />
                         )}
                      </div>
                      <button 
                        onClick={() => document.getElementById('productImageInput')?.click()}
                        className="w-full bg-white border border-gray-400 h-7 text-[9px] font-bold text-slate-700 uppercase tracking-tight hover:bg-gray-100 flex items-center justify-center gap-2 shadow-sm rounded-sm"
                      >
                         <ImageIcon size={14} className="text-[#106ebe]" /> CAMBIAR IMAGEN
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 2: PRECIOS DE VENTA */}
                <div className="border border-gray-300 bg-white shadow-sm overflow-hidden rounded-sm">
                   <div className="bg-[#f8fafc] px-4 py-1.5 border-b border-gray-200">
                     <h4 className="text-[9px] font-black text-[#106ebe] uppercase tracking-widest">Precios de Venta</h4>
                   </div>
                   <div className="p-4 flex items-center gap-4">
                     <div className="flex-1 grid grid-cols-3 gap-6">
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter block text-center">Precio Venta</label>
                         <div className="relative">
                           <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-300">Q</span>
                           <input
                             type="text"
                             value={globalPrices.price}
                             onChange={e => setGlobalPrices({ ...globalPrices, price: e.target.value.replace(/[^0-9.]/g, '') })}
                             className="w-full h-10 bg-white border border-gray-300 text-center text-[22px] font-medium text-slate-700 outline-none focus:border-[#106ebe]"
                             placeholder="0.00"
                           />
                         </div>
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter block text-center">Precio Domicilio</label>
                         <div className="relative">
                           <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-300">Q</span>
                           <input
                             type="text"
                             value={globalPrices.delivery_price}
                             onChange={e => setGlobalPrices({ ...globalPrices, delivery_price: e.target.value.replace(/[^0-9.]/g, '') })}
                             className="w-full h-10 bg-white border border-gray-300 text-center text-[22px] font-medium text-slate-700 outline-none focus:border-[#106ebe]"
                             placeholder="0.00"
                           />
                         </div>
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter block text-center">Precio Plataformas</label>
                         <div className="relative">
                           <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-300">Q</span>
                           <input
                             type="text"
                             value={globalPrices.platform_price}
                             onChange={e => setGlobalPrices({ ...globalPrices, platform_price: e.target.value.replace(/[^0-9.]/g, '') })}
                             className="w-full h-10 bg-white border border-gray-300 text-center text-[22px] font-medium text-slate-700 outline-none focus:border-[#106ebe]"
                             placeholder="0.00"
                           />
                         </div>
                       </div>
                     </div>
                     <div className="flex gap-2 pt-4">
                       <button
                          onClick={() => { 
                            setBranchPrices(branchPrices.map(bp => ({ 
                              ...bp, 
                              price: globalPrices.price || bp.price, 
                              delivery_price: globalPrices.delivery_price || bp.delivery_price, 
                              platform_price: globalPrices.platform_price || bp.platform_price 
                            }))); 
                            notify.success('Precios aplicados globalmente.');
                          }}
                          className="bg-[#106ebe] hover:bg-blue-800 text-white px-5 h-10 text-[10px] font-black uppercase tracking-widest shadow-md transition-all active:translate-y-0.5 rounded-sm"
                       >
                          Aplicar a Todos
                       </button>
                     </div>
                   </div>
                </div>

                {/* Section 3: Detailed Configuration Tabs */}
                <div className="border border-gray-300 bg-white shadow-sm flex flex-col flex-1 rounded-sm overflow-hidden mt-4">
                    <div className="flex items-center justify-between border-b border-gray-300 bg-[#f8fafc] px-2 pt-2">
                      <div className="flex items-end h-8 gap-0.5">
                        <button
                          onClick={() => setActiveTab('branches')}
                          className={`px-4 h-full text-[10px] font-bold uppercase transition-all rounded-t-sm border border-b-0 ${activeTab === 'branches' ? 'bg-white border-gray-300 text-[#106ebe] mb-[-1px] pb-1 z-10' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-200/50'}`}
                        >
                          Disponibilidad y Precios
                        </button>
                        <button
                          onClick={() => setActiveTab('options')}
                          className={`px-4 h-full text-[10px] font-bold uppercase transition-all rounded-t-sm border border-b-0 ${activeTab === 'options' ? 'bg-white border-gray-300 text-[#106ebe] mb-[-1px] pb-1 z-10' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-200/50'}`}
                        >
                          Opciones y Modificadores
                        </button>
                        <button
                          onClick={() => setActiveTab('recipe')}
                          className={`px-4 h-full text-[10px] font-bold uppercase transition-all rounded-t-sm border border-b-0 ${activeTab === 'recipe' ? 'bg-white border-gray-300 text-[#106ebe] mb-[-1px] pb-1 z-10' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-200/50'}`}
                        >
                          Receta / Ficha Técnica
                        </button>
                      </div>
                    </div>

                   <div className="flex-1 p-0 bg-white min-h-[300px]">
                       {activeTab === 'branches' ? (
                        <div className="w-full h-full overflow-auto custom-scrollbar">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-[#f8fafc] shadow-sm">
                              <tr className="border-b border-gray-200 h-9">
                                <th className="w-10 py-2 text-center text-[9px] font-bold text-slate-500 uppercase tracking-tight"></th>
                                <th className="py-2 text-[9px] font-bold text-slate-500 uppercase tracking-tight">Sucursal</th>
                                <th className="w-32 text-center text-[9px] font-bold text-slate-500 uppercase tracking-tight">Precio Salón</th>
                                <th className="w-32 text-center text-[9px] font-bold text-slate-500 uppercase tracking-tight">Domicilio</th>
                                <th className="w-32 text-center text-[9px] font-bold text-slate-500 uppercase tracking-tight">Plataformas</th>
                                <th className="w-20 text-center text-[9px] font-bold text-slate-500 uppercase tracking-tight">Habilitado</th>
                                <th className="w-20 text-center text-[9px] font-bold text-slate-500 uppercase tracking-tight">Asignado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {branchPrices.map((bp, index) => {
                                const bName = branches.find(b => b.id === bp.branch_id)?.name || '--';
                                return (
                                  <tr key={bp.branch_id} className="h-10 hover:bg-gray-50 transition-colors">
                                    <td className="text-center text-gray-400 px-2">
                                      <Building2 size={14} />
                                    </td>
                                    <td className="text-[10px] font-bold text-slate-700 uppercase leading-none">{bName}</td>
                                    <td className="px-2">
                                      <div className="flex items-center gap-1.5 border border-gray-300 px-2 bg-white rounded-sm h-7">
                                        <span className="text-[10px] text-gray-400 font-bold">Q</span>
                                        <input value={bp.price} onChange={e => { const newBp = [...branchPrices]; newBp[index].price = e.target.value.replace(/[^0-9.]/g, ''); setBranchPrices(newBp); }} className="w-full text-[11px] font-bold text-slate-700 outline-none text-right" />
                                      </div>
                                    </td>
                                    <td className="px-2">
                                      <div className="flex items-center gap-1.5 border border-gray-300 px-2 bg-white rounded-sm h-7">
                                        <span className="text-[10px] text-gray-400 font-bold">Q</span>
                                        <input value={bp.delivery_price} onChange={e => { const newBp = [...branchPrices]; newBp[index].delivery_price = e.target.value.replace(/[^0-9.]/g, ''); setBranchPrices(newBp); }} className="w-full text-[11px] font-bold text-slate-700 outline-none text-right" />
                                      </div>
                                    </td>
                                    <td className="px-2">
                                      <div className="flex items-center gap-1.5 border border-gray-300 px-2 bg-white rounded-sm h-7">
                                        <span className="text-[10px] text-gray-400 font-bold">Q</span>
                                        <input value={bp.platform_price} onChange={e => { const newBp = [...branchPrices]; newBp[index].platform_price = e.target.value.replace(/[^0-9.]/g, ''); setBranchPrices(newBp); }} className="w-full text-[11px] font-bold text-slate-700 outline-none text-right" />
                                      </div>
                                    </td>
                                    <td>
                                      <div className="flex justify-center">
                                        <input type="checkbox" checked={bp.is_enabled} onChange={e => { const newBp = [...branchPrices]; newBp[index].is_enabled = e.target.checked; setBranchPrices(newBp); }} className="w-4 h-4 accent-[#106ebe] cursor-pointer" />
                                      </div>
                                    </td>
                                    <td>
                                      <div className="flex justify-center">
                                        <input type="checkbox" checked={bp.is_assigned} onChange={e => { const newBp = [...branchPrices]; newBp[index].is_assigned = e.target.checked; setBranchPrices(newBp); }} className="w-4 h-4 accent-[#106ebe] cursor-pointer" />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : activeTab === 'options' ? (
                        <div className="grid grid-cols-2 gap-px bg-gray-200 h-full">
                           <div className="bg-white flex flex-col p-3">
                              <div className="bg-[#f8fafc] px-3 py-2 border border-gray-300 flex items-center justify-between rounded-t-sm">
                                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">Opciones Asignadas (Tabs)</span>
                                <button onClick={() => setSearchModal({ visible: true, type: 'options', query: '' })} className="bg-white border border-gray-300 text-[#106ebe] font-bold flex items-center justify-center w-6 h-6 rounded-sm shadow-sm hover:bg-blue-50 transition-colors"><Plus size={14}/></button>
                              </div>
                              <div className="flex-1 p-2 overflow-y-auto custom-scrollbar border-x border-b border-gray-300 rounded-b-sm bg-white">
                                {assignedOptionGroups.length === 0 ? (
                                  <div className="h-full flex items-center justify-center text-[10px] font-bold text-gray-300 uppercase italic">Sin opciones asignadas</div>
                                ) : (
                                  <div className="space-y-1">
                                    {assignedOptionGroups.map(og => (
                                      <div key={og.group_id} className="flex justify-between items-center p-2 hover:bg-gray-50 border border-gray-200 bg-white rounded-sm">
                                        <span className="text-[10px] font-bold uppercase text-slate-600 tracking-tight">{optionGroups.find(g => g.id === og.group_id)?.name}</span>
                                        <button onClick={() => setAssignedOptionGroups(prev => prev.filter(p => p.group_id !== og.group_id))} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                           </div>
                           <div className="bg-white flex flex-col p-3">
                              <div className="bg-[#f8fafc] px-3 py-2 border border-gray-300 flex items-center justify-between rounded-t-sm">
                                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">Modificadores Asignados</span>
                                <button onClick={() => setSearchModal({ visible: true, type: 'modifiers', query: '' })} className="bg-white border border-gray-300 text-[#106ebe] font-bold flex items-center justify-center w-6 h-6 rounded-sm shadow-sm hover:bg-blue-50 transition-colors"><Plus size={14}/></button>
                              </div>
                              <div className="flex-1 p-2 overflow-y-auto custom-scrollbar border-x border-b border-gray-300 rounded-b-sm bg-white">
                                {assignedModifierGroups.length === 0 ? (
                                  <div className="h-full flex items-center justify-center text-[10px] font-bold text-gray-300 uppercase italic">Sin modificadores asignados</div>
                                ) : (
                                  <div className="space-y-1">
                                    {assignedModifierGroups.map(am => (
                                      <div key={am.group_id} className="flex justify-between items-center p-2 hover:bg-gray-50 border border-gray-200 bg-white rounded-sm">
                                        <span className="text-[10px] font-bold uppercase text-slate-600 tracking-tight">{modifierGroups.find(m => m.id === am.group_id)?.name}</span>
                                        <button onClick={() => setAssignedModifierGroups(prev => prev.filter(p => p.group_id !== am.group_id))} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                           </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col bg-white">
                          <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <BookOpen size={16} className="text-[#106ebe]" />
                                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">Ingredientes e Insumos</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setSearchModal({ visible: true, type: 'inventory', query: '' })}
                                  className="bg-[#106ebe] text-white px-3 h-7 text-[10px] font-bold uppercase tracking-tight flex items-center gap-2 rounded-sm shadow-sm hover:bg-blue-800"
                                >
                                  <Plus size={14} /> Agregar Insumo
                                </button>
                                <button
                                  onClick={() => setShowRecipeModal(true)}
                                  className="bg-white border border-gray-400 text-slate-700 px-3 h-7 text-[10px] font-bold uppercase tracking-tight flex items-center gap-2 rounded-sm shadow-sm hover:bg-gray-50"
                                >
                                  <FileText size={14} className="text-[#106ebe]" /> Ficha Técnica Pro
                                </button>
                              </div>
                            </div>

                            <div className="flex-1 border border-gray-300 rounded-sm overflow-hidden flex flex-col">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-[#f8fafc] border-b border-gray-300 sticky top-0 z-10">
                                  <tr className="h-8">
                                    <th className="px-3 text-[9px] font-bold text-slate-500 uppercase">Insumo</th>
                                    <th className="w-24 px-3 text-center text-[9px] font-bold text-slate-500 uppercase">Cant.</th>
                                    <th className="w-24 px-3 text-center text-[9px] font-bold text-slate-500 uppercase">Unidad</th>
                                    <th className="w-24 px-3 text-right text-[9px] font-bold text-slate-500 uppercase">Costo Est.</th>
                                    <th className="w-16 px-3 text-center text-[9px] font-bold text-slate-500 uppercase">Acción</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 overflow-y-auto">
                                  {recipeItems.length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className="py-10 text-center text-[10px] font-bold text-gray-300 uppercase italic">No hay insumos registrados para este platillo</td>
                                    </tr>
                                  ) : (
                                    recipeItems.map((item, idx) => {
                                      const cost = item.inventory_items?.average_cost || item.inventory_items?.cost_price || 0;
                                      return (
                                        <tr key={idx} className="h-9 hover:bg-gray-50">
                                          <td className="px-3 text-[10px] font-bold text-slate-700 uppercase">{item.inventory_items?.name}</td>
                                          <td className="px-2">
                                            <input 
                                              value={item.quantity} 
                                              onChange={(e) => {
                                                const next = [...recipeItems];
                                                next[idx].quantity = e.target.value;
                                                setRecipeItems(next);
                                              }}
                                              className="w-full h-6 border border-gray-300 text-center text-[11px] font-bold text-slate-700 bg-white" 
                                            />
                                          </td>
                                          <td className="px-3 text-center text-[10px] text-slate-500 uppercase">{item.unit_measure}</td>
                                          <td className="px-3 text-right text-[10px] font-bold text-slate-600">Q{(cost * (parseFloat(item.quantity) || 0)).toFixed(2)}</td>
                                          <td className="px-3 text-center">
                                            <button onClick={() => setRecipeItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                                {recipeItems.length > 0 && (
                                  <tfoot className="bg-[#f8fafc] border-t border-gray-300">
                                    <tr className="h-8">
                                      <td colSpan={3} className="px-3 text-[10px] font-black text-slate-500 uppercase text-right">Costo Total Receta:</td>
                                      <td className="px-3 text-right text-[11px] font-black text-[#106ebe]">Q{totalReceta.toFixed(2)}</td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                   </div>
                </div>

                {/* Footer exactly like user's first screenshot */}
                <div className="bg-[#f0f4f8] border-t border-gray-300 px-6 py-4 flex justify-end gap-3 shrink-0">
                  <button
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="bg-white border border-gray-300 text-slate-600 px-8 h-10 text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-gray-50 shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-[#106ebe] text-white px-8 h-10 text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-blue-800 transition-colors shadow-[0_4px_10px_rgba(16,110,190,0.3)] min-w-[200px]"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </div>
          </DraggableWindow>
        </div>,
        document.body
      )}

      {/* 3. Interfaz de Ficha Técnica (Modal Completo) */}
      {showRecipeModal && createPortal(
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/5">
          <DraggableWindow>
            <div className="bg-white border border-[#106ebe] shadow-[0_0_40px_rgba(0,0,0,0.5)] w-[950px] h-[85vh] flex flex-col overflow-hidden rounded-sm animate-in zoom-in-95 duration-200">
              {/* Header Document Style */}
              <div className="bg-[#106ebe] h-8 px-3 flex justify-between items-center text-white shrink-0 modal-header cursor-move shadow-md">
                <div className="flex items-center gap-2">
                  <ChefHat size={14} className="text-white" />
                  <span className="text-[11px] font-bold uppercase tracking-tight">Ficha Técnica: {newProduct.name || 'NUEVA'}</span>
                </div>
                <div className="flex items-center h-full">
                  <button
                    onClick={handlePrint}
                    className="h-full px-4 flex items-center gap-2 hover:bg-white/10 text-white border-r border-white/10 text-[9px] font-bold uppercase"
                  >
                    <Printer size={14} /> IMPRIMIR
                  </button>
                  <button onClick={() => setShowRecipeModal(false)} className="h-8 w-8 flex items-center justify-center hover:bg-red-500 text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Main Content: Document Layout */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
                <div className="max-w-4xl mx-auto flex flex-col gap-8">
                  
                  {/* Row 1: General Info & Specifications */}
                  <div className="grid grid-cols-12 gap-6">
                    {/* Left: Product Info Card */}
                    <div className="col-span-8 grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Clasificación</label>
                        <input
                          type="text"
                          value={newProduct.classification}
                          onChange={(e) => setNewProduct({ ...newProduct, classification: e.target.value.toUpperCase() })}
                          className="h-9 w-full bg-slate-50 border border-slate-200 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] focus:bg-white transition-all uppercase"
                          placeholder="EJ: PLATO FUERTE / BEBIDA"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Porciones Sugeridas</label>
                        <input
                          type="text"
                          value={newProduct.portions}
                          onChange={(e) => setNewProduct({ ...newProduct, portions: e.target.value })}
                          className="h-9 w-full bg-slate-50 border border-slate-200 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] focus:bg-white transition-all text-center"
                          placeholder="1"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Temp. Servicio</label>
                        <input
                          type="text"
                          value={newProduct.serving_temp}
                          onChange={(e) => setNewProduct({ ...newProduct, serving_temp: e.target.value.toUpperCase() })}
                          className="h-9 w-full bg-slate-50 border border-slate-200 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] focus:bg-white transition-all uppercase"
                          placeholder="EJ: 75°C"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tiempo Prep.</label>
                        <input
                          type="text"
                          value={newProduct.prep_time}
                          onChange={(e) => setNewProduct({ ...newProduct, prep_time: e.target.value.toUpperCase() })}
                          className="h-9 w-full bg-slate-50 border border-slate-200 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] focus:bg-white transition-all uppercase"
                          placeholder="EJ: 15 MIN"
                        />
                      </div>
                    </div>

                    {/* Right: Product Photo Box */}
                    <div className="col-span-4 aspect-square border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg flex items-center justify-center relative group overflow-hidden">
                      {newProduct.image_url ? (
                        <img src={newProduct.image_url} className="w-full h-full object-contain p-4" alt="Preview" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-30 group-hover:opacity-50 transition-opacity">
                          <PlusCircle size={32} strokeWidth={1} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Foto del Platillo</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Procedimiento de Elaboración (The Core) */}
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center border-b-2 border-[#106ebe]/10 pb-2">
                       <div className="flex items-center gap-2">
                          <Layers size={16} className="text-[#106ebe]" />
                          <h4 className="text-[12px] font-black text-slate-700 uppercase tracking-wider">Procedimientos y Métodos de Preparación</h4>
                       </div>
                       <button
                         onClick={() => handleImproveText('prep_procedure')}
                         disabled={isImproving}
                         className="flex items-center gap-2 px-4 py-1.5 bg-[#f0f9ff] text-[#106ebe] border border-blue-200 rounded-full text-[10px] font-black uppercase hover:bg-[#106ebe] hover:text-white transition-all disabled:opacity-50 shadow-sm"
                       >
                         {isImproving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Redactar con IA
                       </button>
                    </div>
                    
                    <div className="relative">
                      <textarea
                        value={newProduct.prep_procedure}
                        onChange={(e) => setNewProduct({ ...newProduct, prep_procedure: e.target.value })}
                        className="w-full h-[250px] p-6 text-[12px] leading-relaxed font-medium text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-[#106ebe] focus:shadow-xl transition-all rounded-xl placeholder:italic placeholder:text-slate-300"
                        placeholder="Describa detalladamente los pasos para la elaboración del platillo..."
                      />
                    </div>
                  </div>

                  {/* Row 3: Observaciones y Notas Técnicas */}
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <AlertCircle size={12} /> Observaciones y Notas Técnicas de Emplatado
                    </label>
                    <textarea
                      value={newProduct.observations}
                      onChange={(e) => setNewProduct({ ...newProduct, observations: e.target.value })}
                      className="w-full h-[100px] p-4 text-[11px] font-bold text-slate-600 bg-amber-50/30 border border-amber-100 outline-none focus:border-amber-400 rounded-lg uppercase"
                      placeholder="NOTAS ADICIONALES SOBRE PRESENTACIÓN O PORCIONADO..."
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="h-16 bg-slate-50 border-t border-slate-200 px-8 flex justify-between items-center shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-[9px] font-bold uppercase tracking-widest">Última Modificación: {new Date().toLocaleDateString('es-GT')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowRecipeModal(false)}
                    className="px-8 py-2 text-[10px] font-black uppercase text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Cerrar Sin Sugerir
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-12 py-3 bg-[#106ebe] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#002244] transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-3"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                    Actualizar Ficha Técnica
                  </button>
                </div>
              </div>
            </div>
          </DraggableWindow>
        </div>,
        document.body
      )}

      {/* Context Menu for Options/Modifiers */}
      {optionsContextMenu.visible && createPortal(
        <div
          className="fixed z-[2000000] bg-white border border-gray-400 shadow-[2px_2px_0_rgba(0,0,0,0.2)] py-0.5 min-w-[170px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: optionsContextMenu.x, top: optionsContextMenu.y }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSearchModal({ visible: true, type: optionsContextMenu.type, query: '' });
              setOptionsContextMenu({ ...optionsContextMenu, visible: false });
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white transition-none text-left"
          >
            <Plus size={14} className="opacity-70 text-green-600 group-hover:text-white" />
            <span>Agregar {optionsContextMenu.type === 'options' ? 'Opciones' : 'Modificadores'}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (optionsContextMenu.targetGroupId) {
                if (optionsContextMenu.type === 'options') setAssignedOptionGroups(prev => prev.filter(g => g.group_id !== optionsContextMenu.targetGroupId));
                else setAssignedModifierGroups(prev => prev.filter(g => g.group_id !== optionsContextMenu.targetGroupId));
              } else {
                if (optionsContextMenu.type === 'options') setAssignedOptionGroups([]);
                else setAssignedModifierGroups([]);
              }
              setOptionsContextMenu({ ...optionsContextMenu, visible: false });
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-gray-800 hover:bg-[#106ebe] hover:text-white transition-none text-left"
          >
            <Trash2 size={14} className="opacity-70 text-red-600 group-hover:text-white" />
            <span>{optionsContextMenu.targetGroupId ? 'Quitar Selección' : `Quitar Todas las ${optionsContextMenu.type === 'options' ? 'Opciones' : 'Modificadores'}`}</span>
          </button>
          <div className="border-t border-gray-200 my-0.5"></div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOptionsContextMenu({ ...optionsContextMenu, visible: false });
            }}
            className="w-full flex items-center gap-2 px-3 py-1 text-[9px] font-bold text-gray-400 hover:bg-gray-100 transition-none text-left"
          >
            <X size={12} />
            <span>Cancelar</span>
          </button>
        </div>,
        document.body
      )}

      {/* 4. Buscador de Insumos (Floating Search) */}
      {searchModal.visible && searchModal.type === 'inventory' && createPortal(
        <div className="fixed inset-0 z-[2000000] bg-black/40 flex items-center justify-center p-4">
          <DraggableWindow>
            <div className="bg-white border-2 border-[#106ebe] w-[750px] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
              <div className="bg-[#106ebe] p-2 text-white font-bold text-[11px] uppercase flex justify-between items-center modal-header cursor-move">
                <div className="flex items-center gap-2">
                  <Search size={14} />
                  <span>Buscador de Insumos para Receta</span>
                </div>
                <button onClick={() => setSearchModal({ visible: false, type: null, query: '' })} className="hover:bg-red-500 p-1"><X size={16} /></button>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <div className="relative">
                  <input
                    autoFocus
                    className="w-full border-2 border-gray-300 p-3 pl-10 text-[12px] uppercase font-black text-[#106ebe] outline-none focus:border-[#106ebe] shadow-inner"
                    placeholder="BUSCAR POR NOMBRE O CÓDIGO DE INSUMO..."
                    value={searchModal.query}
                    onChange={e => setSearchModal({ ...searchModal, query: e.target.value })}
                  />
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <div className="h-[350px] overflow-y-auto border border-gray-200 custom-scrollbar shadow-sm">
                  <table className="admin-table">
                    <thead className="sticky top-0 bg-[#f0f0f0] z-10">
                      <tr>
                        <th className="w-24">CÓDIGO</th>
                        <th>NOMBRE DE INSUMO</th>
                        <th className="w-32">PRESENTACIÓN</th>
                        <th className="w-24">ACCIÓN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inventoryItems
                        .filter(i =>
                          i.name.toLowerCase().includes(searchModal.query.toLowerCase()) ||
                          i.code?.toLowerCase().includes(searchModal.query.toLowerCase())
                        )
                        .map(item => (
                          <tr
                            key={item.id}
                            onDoubleClick={() => agregarAReceta(item)}
                            className="hover:bg-blue-50 cursor-pointer h-9 group"
                          >
                            <td className="px-3 text-gray-400">{item.code || '--'}</td>
                            <td className="px-3 font-bold uppercase truncate">{item.name}</td>
                            <td className="px-3 text-center text-slate-500 uppercase">{item.unit || 'UNIDAD'}</td>
                            <td className="px-3 text-center">
                              <button
                                onClick={() => agregarAReceta(item)}
                                className="opacity-0 group-hover:opacity-100 bg-[#106ebe] text-white px-3 py-1 text-[8px] font-black rounded uppercase transition-all"
                              >
                                AGREGAR
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center text-gray-400 text-[9px] font-bold uppercase italic">
                  <span>* Haz doble clic sobre un insumo para agregarlo directamente</span>
                  <span>{inventoryItems.length} insumos totales</span>
                </div>
              </div>
            </div>
          </DraggableWindow>
        </div>,
        document.body
      )}

      {/* Legacy Search Modals for Options/Modifiers (Consolidated) */}
      {searchModal.visible && (searchModal.type === 'options' || searchModal.type === 'modifiers') && createPortal(
        <div className="fixed inset-0 z-[2000000] flex items-center justify-center p-4 bg-black/40 pointer-events-none">
          <div
            className="absolute inset-0 pointer-events-auto"
            onClick={() => setSearchModal({ visible: false, type: null, query: '' })}
          ></div>

          <DraggableWindow>
            <div className="bg-[#f0f0f0] shadow-2xl border border-[#106ebe] w-[650px] overflow-hidden flex flex-col pointer-events-auto animate-in zoom-in-95 duration-200">
              {/* Header Style Windows Classic */}
              <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none text-white">
                <div className="flex items-center gap-2">
                  <Layers size={14} />
                  <span className="text-[11px] font-bold uppercase tracking-tight">Listado de {searchModal.type === 'options' ? 'Opciones' : 'Modificadores'}</span>
                </div>
                <button
                  onClick={() => setSearchModal({ visible: false, type: null, query: '' })}
                  className="w-8 h-8 flex items-center justify-center hover:bg-red-500 transition-all text-white active:bg-red-600"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* Search Toolbar */}
              <div className="p-4 bg-white border-b border-gray-300 flex items-center gap-3">
                <div className="flex-1 flex items-center border border-gray-400 px-2 py-1 bg-white">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Introduzca el texto a buscar..."
                    value={searchModal.query}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setSearchModal({ visible: false, type: null, query: '' });
                    }}
                    onChange={e => setSearchModal({ ...searchModal, query: e.target.value })}
                    className="w-full bg-transparent outline-none text-[11px] font-bold text-gray-700 placeholder:text-gray-400 placeholder:italic uppercase"
                  />
                </div>
              </div>

              {/* Table Content */}
              <div className="flex-1 min-h-[300px] max-h-[450px] overflow-y-auto bg-white mx-4 mt-2 border border-gray-400 custom-scrollbar">
                <table className="admin-table">
                  <thead className="sticky top-0 bg-[#f0f0f0] z-10 border-b border-gray-400">
                    <tr className="text-gray-600 font-bold uppercase text-[9px]">
                      <th className="px-4 py-2">Nombre</th>
                      <th className="w-24 px-4 py-2 text-center">Mínimo</th>
                      <th className="w-24 px-4 py-2 text-center">Máximo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(() => {
                      const results = searchModal.type === 'options'
                        ? optionGroups.filter(g => g.name.toLowerCase().includes(searchModal.query.toLowerCase()) && !assignedOptionGroups.some(ag => ag.group_id === g.id))
                        : modifierGroups.filter(g => g.name.toLowerCase().includes(searchModal.query.toLowerCase()) && !assignedModifierGroups.some(ag => ag.group_id === g.id));

                      if (results.length === 0) {
                        return (
                          <tr>
                            <td colSpan={3} className="px-4 py-12 text-center text-[10px] font-black uppercase text-gray-300 italic">
                              No se encontraron resultados disponibles
                            </td>
                          </tr>
                        );
                      }

                      return results.map((item) => (
                        <tr
                          key={item.id}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (searchModal.type === 'options') {
                                setAssignedOptionGroups(prev => [...prev, { group_id: item.id, min_selection: item.min_selection || 0, max_selection: item.max_selection !== undefined && item.max_selection !== null ? item.max_selection : 1 }]);
                              } else if (searchModal.type === 'modifiers') {
                                setAssignedModifierGroups(prev => [...prev, { group_id: item.id, min_selection: item.min_selection || 0, max_selection: item.max_selection || 0 }]);
                              }
                              setSearchModal({ visible: false, type: null, query: '' });
                            }
                          }}
                          onDoubleClick={() => {
                            if (searchModal.type === 'options') {
                              setAssignedOptionGroups(prev => [...prev, { group_id: item.id, min_selection: item.min_selection || 0, max_selection: item.max_selection !== undefined && item.max_selection !== null ? item.max_selection : 1 }]);
                            } else if (searchModal.type === 'modifiers') {
                              setAssignedModifierGroups(prev => [...prev, { group_id: item.id, min_selection: item.min_selection || 0, max_selection: item.max_selection || 0 }]);
                            }
                            setSearchModal({ visible: false, type: null, query: '' });
                          }}
                          className="hover:bg-blue-50 focus:bg-[#106ebe] focus:text-white outline-none cursor-pointer group transition-none"
                        >
                          <td className="px-4 py-2 font-bold text-[#106ebe] group-focus:text-white uppercase text-[10px]">
                            {item.name}
                          </td>
                          <td className="px-4 py-2 text-center text-gray-700 group-focus:text-white text-[10px]">
                            {item.min_selection || 0}
                          </td>
                          <td className="px-4 py-2 text-center text-gray-700 group-focus:text-white text-[10px]">
                            {item.max_selection !== undefined && item.max_selection !== null ? item.max_selection : 1}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Informational Footer */}
              <div className="px-4 py-3 bg-[#f0f0f0] border-t border-gray-300 flex flex-col gap-0.5">
                <p className="text-[9px] font-bold text-gray-600 uppercase italic">
                  *Doble Clic o Enter sobre cualquier item para enviarlo a la configuración.
                </p>
              </div>
            </div>
          </DraggableWindow>
        </div>,
        document.body
      )}

      {/* Configuration Modal (Secondary) */}
      {
        configModal?.visible && createPortal(
          <div className="fixed inset-0 z-[2000000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfigModal(null)}></div>
            <DraggableWindow>
              <div className="bg-[#f0f0f0] border border-[#106ebe] shadow-2xl w-full max-w-sm flex flex-col relative z-20 animate-fade-in">
                <div className="bg-[#106ebe] h-8 px-4 flex justify-between items-center text-white shrink-0 modal-header cursor-move">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-white">Configuración - Esc (Cerrar)</h4>
                  <button onClick={() => setConfigModal(null)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 transition-colors"><X size={16} /></button>
                </div>
                <div className="p-4 space-y-4 bg-[#f0f0f0]">
                  <div className="flex items-center gap-2">
                    <label className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Producto</label>
                    <div className="flex-1 bg-[#e1e5eb] border border-gray-400 px-3 py-1 text-[11px] font-bold text-slate-700 uppercase truncate">
                      {configModal.item.name}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-widest text-[#106ebe] text-right">Cantidad</label>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        value={configModal.quantity}
                        onChange={e => setConfigModal({ ...configModal, quantity: e.target.value.replace(/[^0-9.]/g, '') })}
                        className="w-[90px] bg-white border border-gray-400 px-3 py-1.5 text-[11px] font-bold text-[#106ebe] focus:border-[#106ebe] outline-none shadow-sm text-center"
                        placeholder="0.00"
                      />
                      <select
                        value={configModal.unit}
                        onChange={e => setConfigModal({ ...configModal, unit: e.target.value })}
                        className="flex-1 bg-white border border-gray-400 px-2 py-1.5 text-[11px] font-bold text-slate-600 focus:border-[#106ebe] outline-none uppercase cursor-pointer shadow-sm"
                      >
                        {getAvailableUnits(configModal.item.unit || '').map(u => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-300 flex flex-col items-center">
                    <button
                      onClick={() => {
                        const newItem = {
                          inventory_item_id: configModal.item.id,
                          quantity: configModal.quantity || '0',
                          unit_measure: configModal.unit
                        };
                        setRecipeItems(prev => [...prev, newItem]);
                        notify.success(`Agregado: ${configModal.item.name}`);
                        setConfigModal(null);
                        setSearchModal({ visible: false, type: null, query: '' });
                      }}
                      className="px-10 bg-[#106ebe] hover:bg-[#002244] text-white py-2 font-bold uppercase tracking-widest text-[10px] shadow-sm transition-all active:translate-y-[1px]"
                    >
                      Agregar
                    </button>
                    <p className="mt-2 text-[8px] text-gray-400 font-bold uppercase tracking-widest italic">Presiona Esc para cancelar</p>
                  </div>
                </div>
              </div>
            </DraggableWindow>
          </div>,
          document.body
        )
      }

      {/* Quick Action Context Menu */}
      {
        contextMenu.visible && createPortal(
          <>
            <div className="fixed inset-0 z-[99999]" onClick={() => setContextMenu({ ...contextMenu, visible: false })}></div>
            <div
              className="fixed z-[100000] w-56 bg-[#f0f0f0] border-2 border-white shadow-lg shadow-black/20 ring-1 ring-gray-400 overflow-hidden"
              style={{
                top: contextMenu.y,
                left: contextMenu.x
              }}
            >
              <div className="px-3 py-1.5 border-b border-gray-300 bg-[#106ebe]">
                <span className="text-[9px] font-bold text-white uppercase tracking-wider">Opciones de Platillo</span>
              </div>
              <div className="p-0.5">
                <div className="p-1">
                  <button
                    onClick={() => {
                      setContextMenu({ ...contextMenu, visible: false });
                      setShowModal(true);
                      resetForm();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#106ebe] hover:text-white transition-none group text-[#106ebe]"
                  >
                    <Plus size={12} strokeWidth={3} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Nuevo</span>
                  </button>

                  {contextMenu.product && (
                    <>
                      <div className="h-px bg-gray-300 my-1 mx-2"></div>
                      <button
                        onClick={async () => {
                          const prod = contextMenu.product;
                          if (!prod) return;
                          setContextMenu({ ...contextMenu, visible: false });
                          setEditingId(prod.id);
                          setNewProduct({
                            product_code: prod.product_code || '',
                            name: prod.name,
                            short_name: prod.short_name || '',
                            description: prod.description || '',
                            cost_price: (prod.cost_price || 0).toString(),
                            priority: (prod.priority || 100).toString(),
                            category_id: prod.category_id,
                            kitchen_station_id: prod.kitchen_station_id || '',
                            image_url: prod.image_url || '',
                            is_enabled: prod.is_enabled ?? true,
                            stock_quantity: (prod.stock_quantity || 0).toString(),
                            min_stock_level: (prod.min_stock_level || 0).toString(),
                            unit_measure: prod.unit_measure || 'Unidades',
                            classification: prod.classification || '',
                            portions: (prod.portions || 1).toString(),
                            portion_size: prod.portion_size || '',
                            serving_temp: prod.serving_temp || '',
                            prep_time: prod.prep_time || '',
                            prepared_by: prod.prepared_by || '',
                            prep_procedure: prod.prep_procedure || '',
                            observations: prod.observations || ''
                          });

                          setLoading(true);
                          let currentBranches = branches;
                          if (currentBranches.length === 0) {
                            const { data: latestBranches } = await supabase.from('branches').select('*').order('name');
                            if (latestBranches && latestBranches.length > 0) {
                              currentBranches = latestBranches;
                              setBranches(latestBranches);
                            }
                          }

                          const { data: bpData } = await supabase.from('product_branch_prices').select('*').eq('product_id', prod.id);
                          if (bpData && bpData.length > 0) {
                            setBranchPrices(currentBranches.map(b => bpData.find(pbp => pbp.branch_id === b.id) || { branch_id: b.id, price: prod.price || 0, delivery_price: prod.price || 0, platform_price: prod.price || 0, is_enabled: true, is_assigned: false }));
                          } else {
                            setBranchPrices(currentBranches.map(b => ({ branch_id: b.id, price: prod.price || 0, delivery_price: prod.price || 0, platform_price: prod.price || 0, is_enabled: true, is_assigned: true })));
                          }
                          const { data: pmData } = await supabase.from('product_modifier_groups').select('group_id, min_selection, max_selection').eq('product_id', prod.id);
                          setAssignedModifierGroups(pmData?.map(pm => ({ group_id: pm.group_id, min_selection: pm.min_selection || 0, max_selection: pm.max_selection || 0 })) || []);
                          const { data: poData } = await supabase.from('product_option_groups').select('group_id, min_selection, max_selection').eq('product_id', prod.id);
                          setAssignedOptionGroups(poData?.map(po => ({ group_id: po.group_id, min_selection: po.min_selection || 0, max_selection: po.max_selection || 0 })) || []);
                          
                          try {
                            const { data: recipeData, error: recipeFetchError } = await supabase
                              .from('product_recipes')
                              .select('*, inventory_items(*)')
                              .eq('product_id', prod.id);

                            if (!recipeFetchError) {
                              setRecipeItems(recipeData || []);
                            }
                          } catch (err: any) {
                            console.error('[CRITICAL_FETCH_FAULT]:', err);
                          }
                          setGlobalPrices({ price: '', delivery_price: '', platform_price: '' });
                          setActiveTab('branches');
                          setLoading(false);
                          setShowModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#106ebe] hover:text-white transition-none group text-slate-800"
                      >
                        <Edit2 size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Editar</span>
                      </button>

                      <button
                        onClick={() => {
                          if (contextMenu.product) {
                            setConfirmDelete(contextMenu.product);
                            setContextMenu({ ...contextMenu, visible: false });
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-500 hover:text-white transition-none group text-red-600"
                      >
                        <Trash2 size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Eliminar</span>
                      </button>

                      <div className="h-px bg-gray-300 my-1 mx-2"></div>

                      <button
                        onClick={() => {
                          setContextMenu({ ...contextMenu, visible: false });
                          setShowQuickModal('category');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#106ebe] hover:text-white transition-none group text-slate-800"
                      >
                        <Folder size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Cambiar Categoría</span>
                      </button>

                      <button
                        onClick={() => {
                          setContextMenu({ ...contextMenu, visible: false });
                          setShowQuickModal('station');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#106ebe] hover:text-white transition-none group text-slate-800"
                      >
                        <ChefHat size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Cambiar Cocina</span>
                      </button>
                    </>
                  )}

                  <div className="h-px bg-gray-300 my-1 mx-2"></div>

                  <button
                    onClick={() => {
                      setContextMenu({ ...contextMenu, visible: false });
                      fetchData();
                      notify.success('Datos actualizados');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#106ebe] hover:text-white transition-none group text-slate-800"
                  >
                    <RefreshCw size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Refrescar</span>
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )
      }

      {/* Quick Change Modal */}
      {
        showQuickModal && contextMenu.product && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 pointer-events-none">
            <div className="absolute inset-0 pointer-events-auto" onClick={() => setShowQuickModal(null)}></div>
            <div className="pointer-events-auto">
              <DraggableWindow>
                <div className="w-full max-w-md bg-[#f0f0f0] border-2 border-white shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-4 py-2 bg-[#106ebe] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-white/10 rounded">
                        {showQuickModal === 'category' ? <Folder size={14} className="text-white" /> : <ChefHat size={14} className="text-white" />}
                      </div>
                      <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">
                        {showQuickModal === 'category' ? 'Seleccionar Categoría' : 'Seleccionar Estación'}
                      </h3>
                    </div>
                    <button onClick={() => setShowQuickModal(null)} className="text-white/60 hover:text-white"><X size={16} /></button>
                  </div>
                  <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <div className="grid gap-2">
                      {showQuickModal === 'category' ? (
                        categories.map(cat => (
                          <button
                            key={cat.id}
                            onClick={async () => {
                              const { error } = await supabase.from('products').update({ category_id: cat.id }).eq('id', contextMenu.product?.id);
                              if (!error) {
                                fetchData();
                                setShowQuickModal(null);
                              }
                            }}
                            className={`flex items-center gap-3 p-3 transition-all border text-left ${contextMenu.product?.category_id === cat.id ? 'bg-[#106ebe] border-[#001a33] text-white' : 'bg-white border-gray-300 hover:border-[#106ebe]'}`}
                          >
                            <Folder size={14} />
                            <span className="text-[11px] font-black uppercase tracking-wider">
                              {cat.name}
                            </span>
                          </button>
                        ))
                      ) : (
                        kitchens.map(k => (
                          <button
                            key={k.id}
                            onClick={async () => {
                              const { error } = await supabase.from('products').update({ kitchen_station_id: k.id }).eq('id', contextMenu.product?.id);
                              if (!error) {
                                fetchData();
                                setShowQuickModal(null);
                              }
                            }}
                            className={`flex items-center gap-3 p-3 transition-all border text-left ${contextMenu.product?.kitchen_station_id === k.id ? 'bg-[#106ebe] border-[#001a33] text-white' : 'bg-white border-gray-300 hover:border-[#106ebe]'}`}
                          >
                            <ChefHat size={14} />
                            <span className="text-[11px] font-black uppercase tracking-wider">
                              {k.name}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </DraggableWindow>
            </div>
          </div>
        )
      }

      {
        confirmDelete && (
          <WindowsConfirmModal
            title="Confirmar Eliminación"
            message="¿Está seguro que desea eliminar este producto de forma permanente?"
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(null)}
            onDeny={() => setConfirmDelete(null)}
          />
        )
      }
      {
        confirmDeleteCategory && (
          <WindowsConfirmModal
            title="Confirmar Eliminación"
            message="¿Está seguro de eliminar esta categoría? Se eliminarán también sus subcategorías."
            onConfirm={async () => {
              const { error } = await supabase.from('categories').delete().eq('id', confirmDeleteCategory.id);
              if (!error) {
                notify.success('Categoría eliminada');
                fetchData();
              } else {
                notify.error('Error al eliminar: ' + error.message);
              }
              setConfirmDeleteCategory(null);
            }}
            onCancel={() => setConfirmDeleteCategory(null)}
            onDeny={() => setConfirmDeleteCategory(null)}
          />
        )
      }

      {/* Category Management Context Menu */}
      {
        categoryContextMenu.visible && createPortal(
          <>
            <div className="fixed inset-0 z-[99999]" onClick={() => setCategoryContextMenu({ ...categoryContextMenu, visible: false })}></div>
            <div
              className="fixed z-[100000] w-48 bg-[#f0f0f0] border-2 border-white shadow-lg shadow-black/20 ring-1 ring-gray-400 overflow-hidden"
              style={{ top: categoryContextMenu.y, left: categoryContextMenu.x }}
            >
              <div className="px-3 py-1.5 border-b border-gray-300 bg-[#106ebe]">
                <span className="text-[9px] font-bold text-white uppercase tracking-wider">Categoría</span>
              </div>
              <div className="p-0.5">
                <button
                  onClick={() => {
                    setCategoryContextMenu({ ...categoryContextMenu, visible: false });
                    setEditingCategory(null);
                    setCategoryForm({ name: '', parent_id: categoryContextMenu.category?.id || null, priority: '100', is_enabled: true });
                    setShowCategoryModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#106ebe] hover:text-white transition-none group text-slate-800"
                >
                  <Plus size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Nueva Subcategoría</span>
                </button>
                {categoryContextMenu.category && (
                  <>
                    <button
                      onClick={() => {
                        setCategoryContextMenu({ ...categoryContextMenu, visible: false });
                        setEditingCategory(categoryContextMenu.category);
                        setCategoryForm({
                          name: categoryContextMenu.category?.name || '',
                          parent_id: categoryContextMenu.category?.parent_id || null,
                          priority: (categoryContextMenu.category?.priority || 100).toString(),
                          is_enabled: categoryContextMenu.category?.is_enabled ?? true
                        });
                        setShowCategoryModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#106ebe] hover:text-white transition-none group text-slate-800"
                    >
                      <Edit2 size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Editar Categoría</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (!categoryContextMenu.category) return;
                        setConfirmDeleteCategory(categoryContextMenu.category);
                        setCategoryContextMenu({ ...categoryContextMenu, visible: false });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-500 hover:text-white transition-none group text-red-600"
                    >
                      <Trash2 size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Eliminar</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </>,
          document.body
        )
      }

      {/* Category Modal */}
      {showMenuEngineering && (
        <MenuEngineeringModal onClose={() => setShowMenuEngineering(false)} />
      )}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1001] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/5" onClick={() => setShowCategoryModal(false)}></div>
          <DraggableWindow>
            <div className="w-full max-w-sm bg-[#f0f0f0] border-2 border-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-4 py-2 bg-[#106ebe] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder size={14} className="text-white" />
                  <h3 className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">
                    {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                  </h3>
                </div>
                <button onClick={() => setShowCategoryModal(false)} className="text-white/60 hover:text-white"><X size={16} /></button>
              </div>

              <div className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Nombre</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value.toUpperCase() })}
                    className="w-full h-8 bg-white border border-gray-300 px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-[#106ebe]"
                    placeholder="NOMBRE DE LA CATEGORÍA"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Dependencia</label>
                  <select
                    value={categoryForm.parent_id || ''}
                    onChange={(e) => setCategoryForm({ ...categoryForm, parent_id: e.target.value || null })}
                    className="w-full h-8 bg-white border border-gray-300 px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-[#106ebe]"
                  >
                    <option value="">[CATEGORÍA RAÍZ]</option>
                    {categories.filter(c => c.id !== editingCategory?.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Prioridad</label>
                    <input
                      type="number"
                      value={categoryForm.priority}
                      onChange={(e) => setCategoryForm({ ...categoryForm, priority: e.target.value })}
                      className="w-full h-8 bg-white border border-gray-300 px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-[#106ebe]"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      checked={categoryForm.is_enabled}
                      onChange={(e) => setCategoryForm({ ...categoryForm, is_enabled: e.target.checked })}
                      className="w-3 h-3"
                    />
                    <label className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Habilitado</label>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Módulo de Visualización</label>
                  <select
                    value={categoryForm.section || 'MENU'}
                    onChange={(e) => setCategoryForm({ ...categoryForm, section: e.target.value as any })}
                    className="w-full px-2 py-1.5 bg-white border border-gray-300 text-[11px] focus:outline-none focus:border-[#106ebe]"
                  >
                    <option value="MENU">MENÚ (PLATILLOS Y BEBIDAS)</option>
                    <option value="INVENTARIO">INVENTARIO (MATERIA PRIMA)</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-2">
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="px-6 py-1.5 bg-gray-200 text-gray-700 text-[10px] font-bold uppercase hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!categoryForm.name) return notify.error('El nombre es obligatorio');
                    setIsSaving(true);
                    const payload = {
                      name: categoryForm.name,
                      parent_id: categoryForm.parent_id,
                      section: categoryForm.section || 'MENU',
                      priority: parseInt(categoryForm.priority) || 100,
                      is_enabled: categoryForm.is_enabled
                    };

                    const { error } = editingCategory
                      ? await supabase.from('categories').update(payload).eq('id', editingCategory.id)
                      : await supabase.from('categories').insert([payload]);

                    if (error) {
                      notify.error('Error al guardar la categoría');
                    } else {
                      notify.success('Categoría guardada con éxito');
                      setShowCategoryModal(false);
                      fetchData();
                    }
                    setIsSaving(false);
                  }}
                  disabled={isSaving}
                  className="px-6 py-1.5 bg-[#106ebe] text-white text-[10px] font-bold uppercase hover:bg-[#002244] transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </DraggableWindow>
        </div>
      )
      }

      </div>

      <style>{`
        /* Robust Scroll Lock */
        body.modal-open {
          overflow: hidden !important;
        }
        body.modal-open .pos-main-layout,
        body.modal-open .overflow-y-auto:not(.custom-scrollbar) {
          overflow-y: hidden !important;
        }
        
        .custom-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <style>{`
    .erp-input {
      background-color: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      outline: none;
      transition: all 0.2s;
    }
    .erp-input:focus {
      border-color: #106ebe;
      box-shadow: 0 0 0 4px rgba(0, 51, 102, 0.05);
      background-color: #fcfdfe;
    }
  `}</style>
    </>
  );
};
