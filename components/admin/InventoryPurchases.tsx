import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    ShoppingCart, Plus, FileText, Search, Printer, Trash2,
    Loader2, Calendar, X, Save, Truck, Package, ChevronDown,
    Building2, Receipt, AlertCircle, CheckCircle2, MoreHorizontal, Check,
    ArrowRight, History, Filter, CreditCard, Eye, Edit2, Minus, Layers, Settings
} from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { useReactToPrint } from 'react-to-print';
import { User } from '../../types';
import { useNotify } from '../../hooks/useNotify';
import { activityLogService } from '../../services/ActivityLogService';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { useWindows } from './WindowsModalContext';


// Unit Conversion Logic (Consistente con los demás módulos)
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

interface PurchaseItem {
    id?: string;
    purchase_id?: string;
    inventory_item_id: string;
    quantity: number;
    equivalence?: number; // How many base units per purchased unit (e.g. 3000 for a 3L bote)
    unit_cost: number;
    total_cost: number;
    product_name?: string;
    presentation?: string;
    base_unit?: string;
    source?: 'inventory' | 'products';
}

interface Purchase {
    id: string;
    branch_id: string;
    supplier_id: string;
    user_id: string;
    doc_type: string;
    doc_number: string;
    purchase_date: string;
    payment_condition: 'CONTADO' | 'CREDITO';
    payment_status?: string;
    status: 'PROCESADO' | 'ANULADO';
    total_amount: number;
    notes?: string;
    created_by?: string;
    executed_by?: string;
    voided_by?: string;
    suppliers?: { name: string };
    branches?: { name: string };
    profiles?: { name: string };
}

const StatCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className={`w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center ${color} shadow-inner`}>
            <Icon size={16} />
        </div>
        <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">{label}</span>
            <span className="text-base font-black text-slate-800 tracking-tight tabular-nums">{value}</span>
        </div>
    </div>
);

const Badge = ({ status }: { status: string }) => {
    if (status === 'PROCESADO') return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100">
            <CheckCircle2 size={10} /> Procesado
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-rose-100">
            <AlertCircle size={10} /> Anulado
        </span>
    );
};

interface InventoryPurchasesProps {
    currentUser?: User | null;
}

export const InventoryPurchases: React.FC<InventoryPurchasesProps> = ({ currentUser }) => {
    const notify = useNotify();
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [filterBranch, setFilterBranch] = useState<string>(() => {
        const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        return cachedUser?.branch_id || 'ALL';
    });
    const getLocalDateStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const [filterDateStart, setFilterDateStart] = useState<string>(getLocalDateStr());
    const [filterDateEnd, setFilterDateEnd] = useState<string>(getLocalDateStr());
    const [purchaseToAnnul, setPurchaseToAnnul] = useState<Purchase | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState(false);
    const [formData, setFormData] = useState({
        id: '' as string | undefined,
        branch_id: '',
        supplier_id: '',
        doc_type: 'FACTURA',
        doc_number: '',
        purchase_date: getLocalDateStr(),
        payment_condition: 'CONTADO' as 'CONTADO' | 'CREDITO',
        payment_status: 'NO PAGADA',
        notes: '',
        created_by: '',
        executed_by: '',
        voided_by: ''
    });
    const [formItems, setFormItems] = useState<PurchaseItem[]>([]);
    const [originalItems, setOriginalItems] = useState<PurchaseItem[]>([]);
    const [originalBranchId, setOriginalBranchId] = useState<string>('');
    const [supplierSearch, setSupplierSearch] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState<number | null>(null);
    const [branchStocks, setBranchStocks] = useState<any[]>([]);

    const [isMobile, setIsMobile] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, purchase: Purchase | null } | null>(null);
    const [detailContextMenu, setDetailContextMenu] = useState<{ x: number, y: number, itemIdx: number | null } | null>(null);
    const [showProductListModal, setShowProductListModal] = useState(false);
    const [productListSearch, setProductListSearch] = useState('');
    const [selectedProductForConfig, setSelectedProductForConfig] = useState<any | null>(null);
    const [configQty, setConfigQty] = useState<number>(1);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedProductForConfig) {
                    setSelectedProductForConfig(null);
                } else if (showProductListModal) {
                    setShowProductListModal(false);
                } else if (purchaseToAnnul) {
                    setPurchaseToAnnul(null);
                } else if (detailContextMenu) {
                    setDetailContextMenu(null);
                } else if (showProductDropdown !== null) {
                    setShowProductDropdown(null);
                } else if (showSupplierDropdown) {
                    setShowSupplierDropdown(false);
                } else if (showModal) {
                    setShowModal(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedProductForConfig, showProductListModal, purchaseToAnnul, detailContextMenu, showProductDropdown, showSupplierDropdown, showModal]);
    const printRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bRes, sRes, iRes, pRes, catRes] = await Promise.all([
                supabase.from('branches').select('*').order('name'),
                supabase.from('suppliers').select('*').order('name'),
                supabase.from('inventory_items').select('*').order('name'),
                supabase.from('products').select('*').order('name'),
                supabase.from('categories').select('*').order('name')
            ]);
            
            if (bRes.data) setBranches(bRes.data);
            if (sRes.data) setSuppliers(sRes.data);

            const catMap = new Map((catRes.data || []).map(c => [c.id, c.name]));

            const listA = (iRes.data || []).map(i => {
                const rawName = (i.nombre || i.name || '').trim();
                const rawPres = (i.tamano_capacidad || i.presentation || '').trim();
                const unit = (i.unidad_medida || i.unit || 'UN').trim();
                
                return {
                    id: i.id,
                    code: (i.codigo || i.code || '').trim(),
                    name: rawName || '---',
                    presentation: rawPres || unit || 'UNIDAD',
                    cost: i.precio_compra || i.cost_price || i.cost || 0,
                    conversion_factor: i.portions || i.conversion_factor || 1,
                    unit: unit,
                    source: 'inventory',
                    display_cat: 'Inventario'
                };
            });

            const listB = (pRes.data || []).map(p => {
                const rawName = (p.name || p.nombre || '').trim();
                const conversion = parseFloat(p.conversion_factor || p.portions) || 1;
                const formattedConv = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(conversion);
                const presentation = `${p.presentation_unit || ''} ${formattedConv} ${p.unit_measure || ''}`.trim();

                return {
                    id: p.id,
                    code: (p.product_code || p.codigo || p.code || '').trim(),
                    name: rawName || '---',
                    presentation: presentation || 'UNIDAD',
                    cost: p.cost_price || p.precio_compra || p.cost || 0,
                    conversion_factor: conversion,
                    unit: p.unit_measure || p.unit || 'UN',
                    source: 'products',
                    tipo: 'materia_prima',
                    display_cat: catMap.get(p.category_id) || 'Producto'
                };
            });

            setInventoryItems([...listA, ...listB]);

            // Fetch generic stocks initially if no branch is selected or all branches
            const { data: stocks } = await supabase.from('inventory_item_branches').select('item_id, branch_id, quantity');
            if (stocks) setBranchStocks(stocks);

            let query = supabase.from('inventory_purchases').select('*, suppliers(name), branches(name), profiles(name)').order('purchase_date', { ascending: false });
            if (filterBranch !== 'ALL') query = query.eq('branch_id', filterBranch);
            if (filterDateStart) query = query.gte('purchase_date', filterDateStart);
            if (filterDateEnd) query = query.lte('purchase_date', filterDateEnd);

            const { data, error } = await query;
            if (error) console.error("Error fetching purchases:", error);
            if (data) setPurchases(data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [filterBranch, filterDateStart, filterDateEnd]);

    const handleLoadPurchase = async (purchase: Purchase, mode: 'VIEW' | 'EDIT') => {
        setLoading(true);
        try {
            // Ya no pedimos inventory_items(name, ...) para evitar el error de relación
            const { data: items, error } = await supabase
                .from('inventory_purchase_items')
                .select('*')
                .eq('purchase_id', purchase.id);

            if (error) throw error;

            setFormData({
                id: purchase.id,
                branch_id: purchase.branch_id,
                supplier_id: purchase.supplier_id,
                doc_type: purchase.doc_type,
                doc_number: purchase.doc_number,
                purchase_date: purchase.purchase_date,
                payment_condition: purchase.payment_condition,
                payment_status: purchase.payment_status || 'NO PAGADA',
                notes: purchase.notes || '',
                created_by: purchase.created_by || '',
                executed_by: purchase.executed_by || '',
                voided_by: purchase.voided_by || ''
            });
            setOriginalBranchId(purchase.branch_id);

            // Mapeo manual usando lo que ya tenemos en memoria (inventoryItems)
            // Ajuste: Si itemData no existe en inventoryItems (posible carga lenta), 
            // intentamos reconstruirlo para que no muestre '--'
            const loadedItems = (items || []).map((it: any) => {
                const itemData = inventoryItems.find(i => i.id === it.inventory_item_id);
                
                // Prioridad 1: Datos de inventoryItems (enriquecidos)
                // Prioridad 2: Datos del registro it (de la base de datos)
                return {
                    id: it.id,
                    purchase_id: it.purchase_id,
                    inventory_item_id: it.inventory_item_id,
                    quantity: it.quantity,
                    equivalence: it.equivalence || 1,
                    unit_cost: it.unit_cost,
                    total_cost: it.total_cost,
                    product_name: itemData?.name || it.product_name || '---',
                    presentation: itemData?.presentation || it.presentation || '--',
                    base_unit: itemData?.unit || it.base_unit || 'UN',
                    source: it.source || itemData?.source || 'inventory'
                };
            });

            setFormItems(loadedItems);
            setOriginalItems(loadedItems);
            setSupplierSearch(purchase.suppliers?.name || '');
            setViewMode(mode === 'VIEW');
            setShowModal(true);
        } catch (err: any) {
            alert('Error cargando detalles: ' + err.message);
        }
        setLoading(false);
    };

    const confirmAnnulPurchase = async () => {
        if (!purchaseToAnnul) return;
        const purchase = purchaseToAnnul;

        if (purchase.status === 'ANULADO') {
            alert('Esta compra ya ha sido anulada.');
            setPurchaseToAnnul(null);
            return;
        }

        setLoading(true);
        try {
            // Llamada atómica al RPC en Supabase
            const { error: rpcError } = await supabase.rpc('rpc_annul_purchase', {
                p_purchase_id: purchase.id,
                p_user_id: currentUser?.id
            });

            if (rpcError) throw rpcError;

            alert('Compra anulada exitosamente. El inventario ha sido revertido.');
            
            // LOG: Purchase Annulled
            activityLogService.log({
                user: currentUser!,
                module: 'INVENTARIO',
                action: 'Anulación de Compra',
                details: {
                    purchaseId: purchase.id,
                    docNumber: purchase.doc_number,
                    supplier: purchase.suppliers?.name,
                    total: purchase.total_amount
                }
            });

            setPurchaseToAnnul(null);
            fetchData(); // Recargar lista
        } catch (err: any) {
            console.error('Error al anular compra (Atomic RPC):', err.message);
            alert('Error al anular: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = () => setFormItems([...formItems, { inventory_item_id: '', quantity: 1, equivalence: 1, unit_cost: 0, total_cost: 0 }]);
    const handleRemoveItem = (index: number) => setFormItems(formItems.filter((_, i) => i !== index));
    const handleUpdateItem = (index: number, updates: Partial<PurchaseItem>) => {
        const newItems = [...formItems];
        newItems[index] = { ...newItems[index], ...updates };
        newItems[index].total_cost = (newItems[index].quantity || 0) * (newItems[index].unit_cost || 0);
        setFormItems(newItems);
    };

    const handlePurchaseUnitChange = (index: number, unitCode: string) => {
        const item = formItems[index];
        const itemData = inventoryItems.find(i => i.id === item.inventory_item_id);
        if (!itemData) return;

        const baseUnit = itemData.unit?.toUpperCase() || 'UN';
        const uFrom = INVENTORY_UNITS[unitCode.toUpperCase()];
        const uTo = INVENTORY_UNITS[baseUnit];

        if (uFrom && uTo && uFrom.category === uTo.category) {
            const newEquivalence = uFrom.factor / uTo.factor;
            handleUpdateItem(index, { equivalence: newEquivalence });
        }
    };
    const calculateTotal = () => formItems.reduce((acc, item) => acc + (item.total_cost || 0), 0);

    const handleSave = async () => {
        if (!formData.branch_id || !formData.supplier_id || !formData.doc_number || formItems.length === 0) {
            alert('Complete todos los campos principales y agregue al menos un producto.'); return;
        }
        setSaving(true);
        try {
            const userId = currentUser?.id;
            const total = calculateTotal();

            if (formData.id) {
                // EDIT MODE
                const { error: pError } = await supabase
                    .from('inventory_purchases')
                    .update({
                        branch_id: formData.branch_id,
                        supplier_id: formData.supplier_id,
                        doc_type: formData.doc_type,
                        doc_number: formData.doc_number,
                        purchase_date: formData.purchase_date,
                        payment_condition: formData.payment_condition,
                        notes: formData.notes,
                        total_amount: total
                    })
                    .eq('id', formData.id);
                if (pError) throw pError;

                // Sync Items and Stock Diffs
                // 1. Revert previous stock quantities from originalItems
                for (const old of originalItems) {
                    const oldQty = Number(old.quantity) * Number(old.equivalence || 1);
                    const isProduct = old.source === 'products';

                    // Revert Branch Stock (inventory_item_branches refers to product IDs)
                    const { data: branchItem } = await supabase.from('inventory_item_branches')
                        .select('quantity')
                        .eq('item_id', old.inventory_item_id)
                        .eq('branch_id', originalBranchId)
                        .single();
                    if (branchItem) {
                        await supabase.from('inventory_item_branches').update({
                            quantity: (Number(branchItem.quantity) || 0) - oldQty
                        }).eq('item_id', old.inventory_item_id).eq('branch_id', originalBranchId);
                    }

                    // Revert Global Stock
                    if (isProduct) {
                        const { data: prodItem } = await supabase.from('products').select('stock_actual').eq('id', old.inventory_item_id).single();
                        if (prodItem) {
                            await supabase.from('products').update({
                                stock_actual: (Number(prodItem.stock_actual) || 0) - oldQty
                            }).eq('id', old.inventory_item_id);
                        }
                    } else {
                        const { data: globalItem } = await supabase.from('inventory_items').select('quantity').eq('id', old.inventory_item_id).single();
                        if (globalItem) {
                            await supabase.from('inventory_items').update({
                                quantity: (Number(globalItem.quantity) || 0) - oldQty
                            }).eq('id', old.inventory_item_id);
                        }
                    }
                }

                // 2. Delete all previous items
                await supabase.from('inventory_purchase_items').delete().eq('purchase_id', formData.id);

                const { error: itemsError } = await supabase.from('inventory_purchase_items').insert(formItems.map(item => ({
                    purchase_id: formData.id,
                    inventory_item_id: item.inventory_item_id,
                    quantity: item.quantity,
                    equivalence: item.equivalence || 1, 
                    unit_cost: item.unit_cost,
                    total_cost: item.total_cost,
                    source: item.source || 'inventory'
                })));
                if (itemsError) throw itemsError;

                for (const item of formItems) {
                    const isProduct = item.source === 'products';
                    // MATEMÁTICA ESTRICTA: cantidad_comprada * factor_conversión
                    const addQty = Number(item.quantity) * Number(item.equivalence || 1);
                    const baseUnitCost = Number(item.unit_cost) / Number(item.equivalence || 1);

                    // 1. Update base unit cost (Global)
                    if (isProduct) {
                        await supabase.from('products').update({ cost_price: baseUnitCost }).eq('id', item.inventory_item_id);
                    } else {
                        await supabase.from('inventory_items').update({ cost: baseUnitCost }).eq('id', item.inventory_item_id);
                    }

                    // 2. Update Global Quantity
                    if (isProduct) {
                        const { data: prodItem } = await supabase.from('products').select('stock_actual').eq('id', item.inventory_item_id).single();
                        if (prodItem) {
                            await supabase.from('products').update({
                                stock_actual: (Number(prodItem.stock_actual) || 0) + addQty
                            }).eq('id', item.inventory_item_id);
                        }
                    } else {
                        const { data: globalItem } = await supabase.from('inventory_items').select('quantity').eq('id', item.inventory_item_id).single();
                        if (globalItem) {
                            await supabase.from('inventory_items').update({
                                quantity: (Number(globalItem.quantity) || 0) + addQty
                            }).eq('id', item.inventory_item_id);
                        }
                    }

                    // 3. Update Branch Stock
                    const { data: branchItem } = await supabase.from('inventory_item_branches')
                        .select('quantity')
                        .eq('item_id', item.inventory_item_id)
                        .eq('branch_id', formData.branch_id)
                        .single();
                    if (branchItem) {
                        await supabase.from('inventory_item_branches').update({
                            quantity: (Number(branchItem.quantity) || 0) + addQty
                        }).eq('item_id', item.inventory_item_id).eq('branch_id', formData.branch_id);
                    } else {
                        await supabase.from('inventory_item_branches').insert({
                            item_id: item.inventory_item_id,
                            branch_id: formData.branch_id,
                            quantity: addQty,
                            is_enabled: true,
                            is_assigned: true
                        });
                    }
                }

                alert('Compra actualizada exitosamente.');

            } else {
                // CREATE MODE
                const createdBy = currentUser?.full_name || currentUser?.name || 'Sistema';
                const { data: purchase, error: pError } = await supabase.from('inventory_purchases').insert([{
                    branch_id: formData.branch_id,
                    supplier_id: formData.supplier_id,
                    doc_type: formData.doc_type,
                    doc_number: formData.doc_number,
                    purchase_date: formData.purchase_date,
                    payment_condition: formData.payment_condition,
                    payment_status: formData.payment_status,
                    notes: formData.notes,
                    user_id: userId,
                    total_amount: total,
                    status: 'PROCESADO',
                    created_by: createdBy,
                    executed_by: createdBy
                }]).select().single();

                if (pError) throw pError;

                const { error: itemsError } = await supabase.from('inventory_purchase_items').insert(formItems.map(item => ({
                    purchase_id: purchase.id,
                    inventory_item_id: item.inventory_item_id,
                    quantity: item.quantity,
                    equivalence: item.equivalence || 1, // Guardamos equivalencia
                    unit_cost: item.unit_cost,
                    total_cost: item.total_cost,
                    source: item.source || 'inventory' // Guardar origen si la tabla lo soporta
                })));
                if (itemsError) throw itemsError;

                for (const item of formItems) {
                    const isProduct = item.source === 'products';
                    // MATEMÁTICA ESTRICTA: cantidad_comprada * factor_conversión
                    const addQty = Number(item.quantity) * Number(item.equivalence || 1);
                    const baseUnitCost = Number(item.unit_cost) / Number(item.equivalence || 1);

                    // 1. Update base unit cost & quantity (Global)
                    if (isProduct) {
                        const { data: currentProd } = await supabase.from('products').select('stock_actual').eq('id', item.inventory_item_id).single();
                        await supabase.from('products').update({
                            cost_price: baseUnitCost,
                            stock_actual: (Number(currentProd?.stock_actual) || 0) + addQty
                        }).eq('id', item.inventory_item_id);
                    } else {
                        const { data: globalItem } = await supabase.from('inventory_items').select('quantity').eq('id', item.inventory_item_id).single();
                        await supabase.from('inventory_items').update({
                            cost: baseUnitCost,
                            quantity: (Number(globalItem?.quantity) || 0) + addQty
                        }).eq('id', item.inventory_item_id);
                    }

                    // 2. Update Branch Stock (Siempre en inventory_item_branches ya que referencia products)
                    const { data: branchItem } = await supabase.from('inventory_item_branches')
                        .select('quantity')
                        .eq('item_id', item.inventory_item_id)
                        .eq('branch_id', formData.branch_id)
                        .single();
                    
                    const newBranchQty = (Number(branchItem?.quantity) || 0) + addQty;
                    
                    if (branchItem) {
                        await supabase.from('inventory_item_branches').update({
                            quantity: newBranchQty
                        }).eq('item_id', item.inventory_item_id).eq('branch_id', formData.branch_id);
                    } else {
                        await supabase.from('inventory_item_branches').insert({
                            item_id: item.inventory_item_id,
                            branch_id: formData.branch_id,
                            quantity: addQty,
                            is_enabled: true,
                            is_assigned: true
                        });
                    }

                    // 3. Update Product Branch Inventory (Specific for POS Sales Items)
                    if (isProduct) {
                        const { data: pbiItem } = await supabase.from('product_branch_inventory')
                            .select('quantity')
                            .eq('product_id', item.inventory_item_id)
                            .eq('branch_id', formData.branch_id)
                            .single();
                        
                        const newPbiQty = (Number(pbiItem?.quantity) || 0) + addQty;
                        
                        if (pbiItem) {
                            await supabase.from('product_branch_inventory').update({
                                quantity: newPbiQty
                            }).eq('product_id', item.inventory_item_id).eq('branch_id', formData.branch_id);
                        } else {
                            await supabase.from('product_branch_inventory').insert({
                                product_id: item.inventory_item_id,
                                branch_id: formData.branch_id,
                                quantity: addQty,
                                is_enabled: true,
                                is_assigned: true
                            });
                        }
                        
                        // Sync global products.stock_quantity for legacy views
                        const { data: globalProd } = await supabase.from('products').select('stock_quantity').eq('id', item.inventory_item_id).single();
                        await supabase.from('products').update({
                            stock_quantity: (Number(globalProd?.stock_quantity) || 0) + addQty
                        }).eq('id', item.inventory_item_id);
                    }

                    // Kardex entry
                    const baseUnitCostValue = Number(item.unit_cost) / Number(item.equivalence || 1);

                    await supabase.from('inventory_kardex').insert({
                        item_id: item.inventory_item_id,
                        branch_id: formData.branch_id,
                        movement_type: 'COMPRA',
                        reference: (formData.doc_type || 'FACTURA') + ' #' + formData.doc_number,
                        user_id: currentUser?.id,
                        user_name: currentUser?.name || 'Admin',
                        device: /mobile/i.test(navigator.userAgent) ? 'Celular' : 'PC',
                        quantity_in: addQty,
                        quantity_out: 0,
                        balance: newBranchQty,
                        unit_cost: baseUnitCostValue,
                        balance_value: newBranchQty * baseUnitCostValue,
                        notes: 'Compra de ' + item.quantity + ' ' + (item.presentation || 'UNID')
                    });
                }
                alert('Compra guardada exitosamente.');

                // LOG: Purchase Created
                activityLogService.log({
                    user: currentUser!,
                    module: 'INVENTARIO',
                    action: 'Registro de Compra',
                    details: {
                        purchaseId: purchase.id,
                        docNumber: formData.doc_number,
                        supplier: suppliers.find(s => s.id === formData.supplier_id)?.name,
                        total: total,
                        branch: branches.find(b => b.id === formData.branch_id)?.name
                    }
                });
            }

            setShowModal(false); resetForm(); fetchData();
        } catch (err: any) { alert(err.message); }
        setSaving(false);
    };

    const resetForm = () => {
        setFormData({ id: undefined, branch_id: '', supplier_id: '', doc_type: 'FACTURA', doc_number: '', purchase_date: getLocalDateStr(), payment_condition: 'CONTADO', payment_status: 'NO PAGADA', notes: '', created_by: '', executed_by: '', voided_by: '' });
        setFormItems([]); setOriginalItems([]); setOriginalBranchId(''); setSupplierSearch(''); setViewMode(false);
    };

    return (
        <>
            <div className="flex-1 h-full bg-[#f0f0f0] overflow-hidden flex flex-col font-['Montserrat']" onClick={() => setContextMenu(null)}>

                {/* Main Toolbar - ERP Style */}
                <div className="bg-[#e6e6e6] px-3 border-b border-gray-300 flex flex-wrap md:flex-nowrap items-center justify-between shrink-0 h-auto md:h-[40px] py-2 md:py-0 z-[100] gap-2 md:gap-0">
                    {/* Left: Branch Filter and Dates */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-900 font-medium text-[12px]">Sucursal</span>
                            <select
                                value={filterBranch}
                                onChange={(e) => setFilterBranch(e.target.value)}
                                className="min-w-[280px] mb-0 bg-white border border-gray-400 rounded-sm px-2 outline-none text-[11px] text-slate-900 font-medium focus:border-[#106ebe] h-[24px]"
                            >
                                <option value="ALL">TODAS LAS SUCURSALES</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="hidden md:block h-4 w-px bg-gray-400 mx-1"></div>

                        <div className="flex items-center gap-2">
                            <span className="text-slate-900 font-medium text-[12px]">Del:</span>
                            <input
                                type="date"
                                value={filterDateStart}
                                onChange={(e) => setFilterDateStart(e.target.value)}
                                className="bg-white border border-gray-400 px-2 text-[11px] text-slate-900 font-medium focus:border-[#106ebe] h-7 outline-none"
                            />
                            <span className="text-slate-900 font-medium text-[11px] ml-1">Al:</span>
                            <input
                                type="date"
                                value={filterDateEnd}
                                onChange={(e) => setFilterDateEnd(e.target.value)}
                                className="bg-white border border-gray-400 px-2 text-[11px] text-slate-900 font-medium focus:border-[#106ebe] h-7 outline-none"
                            />
                            <button
                                onClick={fetchData}
                                className="ml-2 bg-[#106ebe] text-white px-5 h-7 text-[10px] font-bold uppercase hover:bg-[#002244] active:bg-black shadow-sm"
                            >
                                Generar
                            </button>
                        </div>
                    </div>

                    {/* Right: Search & Actions */}
                    <div className="flex items-center gap-1 w-full md:w-auto mt-2 md:mt-0">
                        <input
                            type="text"
                            placeholder="Buscar compras..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white border border-gray-400 px-2 text-[11px] font-bold w-full md:w-56 outline-none text-slate-800 focus:border-[#106ebe] h-[26px]"
                        />
                        <button className="bg-[#106ebe] text-white px-4 h-[26px] text-[10px] font-bold uppercase hover:bg-[#002244] transition-colors shadow-sm flex items-center gap-2">
                            <Search size={12} /> Buscar
                        </button>
                        <div className="w-px h-6 bg-gray-400 mx-2" />
                        <button
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="bg-[#28a745] text-white px-4 h-[26px] text-[10px] font-bold uppercase hover:bg-[#218838] transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Plus size={14} /> Nueva Compra
                        </button>
                    </div>
                </div>

                {/* Table Container */}
                <div className="bg-[#f0f0f0] px-3 py-1.5 border-b border-gray-300 flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">Listado de Compras</span>
                </div>

                <div
                    className="flex-1 overflow-auto custom-scrollbar relative border-l border-gray-200"
                    onContextMenu={(e) => {
                        const target = e.target as HTMLElement;
                        if (!target.closest('thead')) {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, purchase: null });
                        }
                    }}
                >
                    <div className="bg-white min-h-full">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="bg-[#e8e8e8] sticky top-0 z-20 border-b border-gray-400 select-none">
                                <tr className="h-8">
                                    <th className="w-6 border-r border-gray-300 px-1 py-1 text-center font-normal"></th>
                                    <th className="px-4 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300 w-24 text-center">Fecha</th>
                                    <th className="px-4 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300 w-32 text-center">No. Documento</th>
                                    <th className="px-4 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300 w-48">Proveedor</th>
                                    <th className="px-4 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300 w-32">Creado Por</th>
                                    <th className="px-4 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300 w-28 text-center">Forma de Pago</th>
                                    <th className="px-4 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300 w-24 text-right">Total</th>
                                    <th className="px-2 w-16 text-center text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300">Procesado</th>
                                    <th className="px-2 w-16 text-center text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300">Anulado</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white min-h-[100px]">
                                {loading ? (
                                    <tr><td colSpan={9} className="py-20 text-center"><Loader2 className="animate-spin text-slate-400 mx-auto" size={32} /></td></tr>
                                ) : purchases.filter(p => p.doc_number.toLowerCase().includes(searchTerm.toLowerCase()) || p.suppliers?.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-20 text-center">
                                            <span className="text-[12px] text-slate-500 font-bold uppercase tracking-widest">No se encontraron compras registradas</span>
                                        </td>
                                    </tr>
                                ) : (
                                    purchases
                                        .filter(p => p.doc_number.toLowerCase().includes(searchTerm.toLowerCase()) || p.suppliers?.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .map((purchase) => (
                                            <tr
                                                key={purchase.id}
                                                className="h-6 cursor-default border-b border-gray-50 text-slate-900 even:bg-slate-50/50 group"
                                                onDoubleClick={() => handleLoadPurchase(purchase, 'VIEW')}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setContextMenu({ x: e.clientX, y: e.clientY, purchase });
                                                }}
                                            >
                                                <td className="w-6 border-r border-gray-100 px-1 py-1 text-center font-bold text-[10px]">
                                                    {purchase.status !== 'ANULADO' && '+'}
                                                </td>
                                                <td className="px-4 text-[10px] border-r border-gray-100 whitespace-nowrap overflow-hidden text-ellipsis text-center font-bold">
                                                    {new Date(purchase.purchase_date).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="px-4 text-[10px] border-r border-gray-100 whitespace-nowrap overflow-hidden text-ellipsis text-center font-bold">
                                                    {purchase.doc_number}
                                                </td>
                                                <td className="px-4 text-[10px] border-r border-gray-100 whitespace-nowrap overflow-hidden text-ellipsis font-medium uppercase">
                                                    {purchase.suppliers?.name || '---'}
                                                </td>
                                                <td className="px-4 text-[10px] border-r border-gray-100 whitespace-nowrap overflow-hidden text-ellipsis font-medium uppercase">
                                                    {purchase.created_by || 'Sistema'}
                                                </td>
                                                <td className="px-4 text-[10px] border-r border-gray-100 whitespace-nowrap overflow-hidden text-ellipsis text-center font-medium uppercase">
                                                    {purchase.payment_condition}
                                                </td>
                                                <td className="px-4 text-[10px] border-r border-gray-100 whitespace-nowrap overflow-hidden text-ellipsis text-right font-bold tabular-nums">
                                                    Q{purchase.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-4 text-center border-r border-gray-100">
                                                    <div className="flex justify-center items-center h-full">
                                                        <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${purchase.status === 'PROCESADO' ? 'bg-[#106ebe] border-[#106ebe] text-white' : 'bg-white border-gray-400 text-transparent'}`}>
                                                            <Check size={10} strokeWidth={4} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 text-center">
                                                    <div className="flex justify-center items-center h-full">
                                                        <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${purchase.status === 'ANULADO' ? 'bg-black border-black text-white' : 'bg-white border-gray-400 text-transparent'}`}>
                                                            <Check size={10} strokeWidth={4} />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Status Bar / Footer Classic */}
                <div className="bg-[#f0f0f0] border-t border-gray-400 px-3 flex items-center justify-between shrink-0 h-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">Compras: {purchases.length}</span>
                    <span className="text-[10px] font-bold text-slate-800 pr-10">
                        Total: Q{purchases.reduce((acc, p) => acc + (p.status === 'PROCESADO' ? p.total_amount : 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>


            {/* Context Menu with Portal */}
            {contextMenu && createPortal(
                <div
                    className="fixed bg-[#f9f9f9] border border-[#d0d0d0] shadow-[4px_4px_15px_rgba(0,0,0,0.2)] py-1.5 z-[100000] min-w-[200px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="w-full text-left px-4 py-1.5 text-[11px] font-bold hover:bg-[#106ebe] hover:text-white text-slate-800 flex items-center gap-2 transition-colors uppercase"
                        onClick={() => {
                            setContextMenu(null);
                            resetForm();
                            setShowModal(true);
                        }}
                    >
                        <Plus size={14} /> Nueva Compra
                    </button>
                        {
                            contextMenu.purchase && (
                                <>
                                    {contextMenu.purchase.status !== 'ANULADO' && (
                                        <button
                                            className="w-full text-left px-4 py-1.5 text-[11px] hover:bg-[#e6f2fa] text-[#000000]"
                                            onClick={() => {
                                                setContextMenu(null);
                                                handleLoadPurchase(contextMenu.purchase!, 'EDIT');
                                            }}
                                        >
                                            Editar Compra
                                        </button>
                                    )}
                                    <button
                                        className="w-full text-left px-4 py-1.5 text-[11px] hover:bg-[#e6f2fa] text-[#000000]"
                                        onClick={() => {
                                            setContextMenu(null);
                                            handleLoadPurchase(contextMenu.purchase!, 'VIEW');
                                        }}
                                    >
                                        Ver Detalle
                                    </button>
                                    {contextMenu.purchase.status !== 'ANULADO' && (
                                        <>
                                            <div className="h-px bg-gray-300 my-1.5 mx-2" />
                                            <button
                                                className="w-full text-left px-4 py-1.5 text-[11px] font-bold hover:bg-red-600 hover:text-white text-red-600 flex items-center gap-2 transition-colors uppercase"
                                                onClick={() => {
                                                    setContextMenu(null);
                                                    setPurchaseToAnnul(contextMenu.purchase);
                                                }}
                                            >
                                                <Trash2 size={14} /> Anular Compra
                                            </button>
                                        </>
                                    )}
                                </>
                            )
                        }
                    </div>,
                    document.body
                )
            }

            {/* Maintenance Modal */}
            {showModal && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
                    <div className="absolute inset-0 bg-transparent pointer-events-auto" onClick={() => !saving && setShowModal(false)} />
                    <DraggableWindow id="inventory-purchase" title={viewMode ? 'Detalle de Compra' : 'Mantenimiento de Compra'}>
                        <div className="bg-[#f0f0f0] w-full max-w-5xl shadow-[0_0_40px_rgba(0,0,0,0.4)] relative flex flex-col max-h-[95vh] overflow-hidden rounded-sm border border-[#106ebe] animate-slide-up pointer-events-auto font-['Montserrat']">

                            {/* Windows Classic Header */}
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex items-center justify-between text-white shrink-0 cursor-move select-none border-b border-white/10">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart size={14} className="opacity-80" />
                                    <span className="text-[12px] font-bold tracking-wide">{viewMode ? 'Detalle de Compra' : formData.id ? 'Mantenimiento de Compra' : 'Mantenimiento de Compra'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {!viewMode && (
                                        <WindowsSaveButton
                                            onClick={handleSave}
                                            loading={saving}
                                            title="Guardar Compra"
                                            variant="minimal"
                                        />
                                    )}
                                    <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 transition-all ml-1 text-white" title="Cerrar">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>



                            {/* Windows Classic Layout */}
                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-[#f0f0f0] flex flex-col min-h-0">
                                <div className="flex flex-col gap-2 h-full">

                                    {/* Datos Compra - GroupBox Style */}
                                    <div className="bg-white border border-gray-300 flex flex-col shadow-sm shrink-0">
                                        <div className="bg-[#e8e8e8] px-3 py-1 flex items-center border-b border-gray-300">
                                            <h4 className="text-[11px] font-bold text-slate-800 tracking-wider">Datos Compra</h4>
                                        </div>
                                        <div className="p-3">
                                            <div className="grid grid-cols-[100px_1fr_100px_1fr] md:grid-cols-[100px_250px_100px_250px] gap-x-4 gap-y-2 items-center">

                                                <label className="text-[10px] text-slate-800 font-bold tracking-tight">Documento</label>
                                                <select value={formData.doc_type} onChange={e => setFormData({ ...formData, doc_type: e.target.value })} disabled={viewMode}
                                                    className="w-full h-6 bg-white border border-gray-400 px-1 text-[11px] font-bold text-slate-900 outline-none focus:border-[#106ebe] uppercase disabled:bg-gray-100">
                                                    <option value="FACTURA">Factura</option>
                                                    <option value="RECIBO">Recibo</option>
                                                    <option value="SIN DOCUMENTO">Sin Documento</option>
                                                </select>

                                                <label className="text-[10px] text-slate-800 font-bold tracking-tight">No. Documento</label>
                                                <input type="text" value={formData.doc_number} onChange={e => setFormData({ ...formData, doc_number: e.target.value.toUpperCase() })} disabled={viewMode}
                                                    className="w-full h-6 bg-white border border-gray-400 px-2 text-[11px] font-bold text-slate-900 outline-none focus:border-[#106ebe] uppercase disabled:bg-gray-100" />

                                                <label className="text-[10px] text-slate-800 font-bold tracking-tight">Proveedor</label>
                                                <div className="relative">
                                                    <input type="text" placeholder="[Elija un Proveedor]"
                                                        value={supplierSearch}
                                                        disabled={viewMode}
                                                        onChange={e => {
                                                            setSupplierSearch(e.target.value);
                                                            setShowSupplierDropdown(true);
                                                            if (!e.target.value) setFormData({ ...formData, supplier_id: '' });
                                                        }}
                                                        onFocus={() => {
                                                            setSupplierSearch(suppliers.find(s => s.id === formData.supplier_id)?.name || '');
                                                            setShowSupplierDropdown(true);
                                                        }}
                                                        className="w-full h-6 bg-white border border-gray-400 pl-2 pr-6 text-[11px] font-bold text-slate-900 outline-none focus:border-[#106ebe] uppercase disabled:bg-gray-100" />
                                                    {!viewMode && <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 cursor-pointer p-1">...</span>}
                                                    {showSupplierDropdown && !viewMode && (
                                                        <div className="absolute z-[100] top-full left-0 right-0 bg-white border border-gray-400 shadow-md max-h-40 overflow-y-auto">
                                                            {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map(s => (
                                                                <div key={s.id} onClick={() => { setFormData({ ...formData, supplier_id: s.id }); setSupplierSearch(s.name); setShowSupplierDropdown(false); }}
                                                                    className="px-2 py-1 text-[10px] uppercase text-slate-700 hover:bg-[#106ebe] hover:text-white cursor-pointer select-none">
                                                                    {s.name}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <label className="text-[10px] text-slate-800 font-bold tracking-tight">Fecha de Compra</label>
                                                <input type="date" value={formData.purchase_date} onChange={e => setFormData({ ...formData, purchase_date: e.target.value })} disabled={viewMode}
                                                    className="w-full h-6 bg-white border border-gray-400 px-2 text-[11px] font-bold text-slate-900 outline-none focus:border-[#106ebe] disabled:bg-gray-100" />

                                                <label className="text-[10px] text-slate-800 font-bold tracking-tight">Cond. Pago</label>
                                                <select value={formData.payment_condition} onChange={e => setFormData({ ...formData, payment_condition: e.target.value })} disabled={viewMode}
                                                    className="w-full h-6 bg-white border border-gray-400 px-1 text-[11px] font-bold text-slate-900 outline-none focus:border-[#106ebe] uppercase disabled:bg-gray-100">
                                                    <option value="CONTADO">Contado</option>
                                                    <option value="CREDITO">Crédito</option>
                                                </select>

                                                <label className="text-[10px] text-slate-800 font-bold tracking-tight">Estado Pago</label>
                                                <select value={formData.payment_status} onChange={e => setFormData({ ...formData, payment_status: e.target.value })} disabled={viewMode}
                                                    className="w-full h-6 bg-white border border-gray-400 px-1 text-[11px] font-bold text-slate-900 outline-none focus:border-[#106ebe] uppercase disabled:bg-gray-100">
                                                    <option value="NO PAGADA">No Pagada</option>
                                                    <option value="PAGADA">Pagada</option>
                                                    <option value="PAGADA DESDE CAJA">Pagada desde Caja</option>
                                                </select>

                                                <label className="text-[10px] text-slate-800 font-bold tracking-tight">Sucursal</label>
                                                <select value={formData.branch_id} onChange={e => setFormData({ ...formData, branch_id: e.target.value })} disabled={viewMode}
                                                    className="w-full h-6 bg-white border border-gray-400 px-1 text-[11px] font-bold text-slate-900 outline-none focus:border-[#106ebe] uppercase disabled:bg-gray-100 col-span-3 min-w-[280px]">
                                                    <option value="">ELIJA SUCURSAL</option>
                                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                </select>

                                            </div>

                                            <div className="mt-3 bg-[#f0f0f0] p-1.5 border border-gray-300 flex items-center gap-4 text-[10px]">
                                                <div className="flex items-center gap-1.5 flex-1">
                                                    <span className="text-slate-500 font-bold uppercase tracking-tight">Creado Por</span>
                                                    <input type="text" disabled value={formData.created_by || ''} className="flex-1 h-5 bg-[#e8e8e8] border border-gray-300 text-slate-700 font-bold px-1 uppercase" />
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-1">
                                                    <span className="text-slate-500 font-bold uppercase tracking-tight">Ejecutado Por</span>
                                                    <input type="text" disabled value={formData.executed_by || ''} className="flex-1 h-5 bg-[#e8e8e8] border border-gray-300 text-slate-700 font-bold px-1 uppercase" />
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-1">
                                                    <span className="text-slate-500 font-bold uppercase tracking-tight">Anulado Por</span>
                                                    <input type="text" disabled value={formData.voided_by || ''} className="flex-1 h-5 bg-[#e8e8e8] border border-gray-300 text-slate-700 font-bold px-1 uppercase" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detalle Compra - GroupBox Style */}
                                    <div className="flex-1 flex flex-col border border-gray-300 bg-white shadow-sm min-h-[250px] relative">
                                        <div className="bg-[#e8e8e8] px-3 py-1 flex items-center justify-between border-b border-gray-300">
                                            <h4 className="text-[11px] font-bold text-slate-800 tracking-wider">Detalle de Compra</h4>
                                        </div>

                                        <div
                                            className="flex-1 overflow-auto bg-white custom-scrollbar w-full"
                                            onContextMenu={(e) => {
                                                if (viewMode) return;
                                                e.preventDefault();
                                                const menuW = 240, menuH = 130;
                                                let x = e.clientX, y = e.clientY;
                                                if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 8;
                                                if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
                                                // Detect if right-click was on a data row
                                                const rowEl = (e.target as HTMLElement).closest('tr[data-idx]');
                                                const itemIdx = rowEl ? parseInt((rowEl as HTMLElement).getAttribute('data-idx') || '', 10) : null;
                                                setDetailContextMenu({ x, y, itemIdx: isNaN(itemIdx as number) ? null : itemIdx });
                                            }}
                                        >
                                            <table className="w-full text-left border-collapse table-fixed">
                                                <thead className="bg-[#f0f0f0] sticky top-0 z-10 border-b border-gray-400 select-none">
                                                    <tr>
                                                        <th className="px-2 py-1 border-r border-gray-300 text-[10px] text-slate-800 font-bold text-center w-20 uppercase">Cantidad</th>
                                                        <th className="px-2 py-1 border-r border-gray-300 text-[10px] text-slate-800 font-bold uppercase">Producto</th>
                                                        <th className="px-2 py-1 border-r border-gray-300 text-[10px] text-slate-800 font-bold text-center w-28 uppercase">Presentación</th>
                                                        <th className="px-2 py-1 border-r border-gray-300 text-[10px] text-slate-800 font-bold text-center w-24 uppercase">Precio Costo</th>
                                                        <th className="px-2 py-1 border-r border-gray-300 text-[10px] text-slate-800 font-bold text-center w-24 uppercase">SubTotal</th>
                                                        <th className="w-8"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {formItems.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="text-center py-4">
                                                                <span className="text-[11px] text-black font-bold uppercase">-- LISTADO VACÍO --</span>
                                                            </td>
                                                        </tr>
                                                    ) : formItems.map((item, idx) => (
                                                        <tr
                                                            key={idx}
                                                            data-idx={idx}
                                                            className="border-b border-gray-100 h-7"
                                                        >
                                                            <td className="px-1 border-r border-gray-100">
                                                                <input type="number" step="any" disabled={viewMode} value={item.quantity === 0 ? '' : item.quantity} onChange={e => handleUpdateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                                                                    className="w-full h-full bg-transparent text-center text-[11px] font-bold text-black outline-none focus:bg-white focus:border focus:border-[#106ebe] disabled:opacity-100" />
                                                            </td>
                                                            <td className="px-1 border-r border-gray-100 relative">
                                                                <input type="text" disabled={viewMode} placeholder="[Escriba para buscar...]"
                                                                    value={item.product_name || inventoryItems.find(i => i.id === item.inventory_item_id)?.name || ''}
                                                                    onChange={e => { handleUpdateItem(idx, { product_name: e.target.value }); setShowProductDropdown(idx); setProductSearch(e.target.value); }}
                                                                    onFocus={() => { if (!viewMode) { handleUpdateItem(idx, { product_name: '' }); setShowProductDropdown(idx); setProductSearch(''); } }}
                                                                    className="w-full h-full bg-transparent px-1 text-[11px] font-bold text-black outline-none focus:bg-white focus:border focus:border-[#106ebe] uppercase disabled:opacity-100" />
                                                                {showProductDropdown === idx && !viewMode && (
                                                                    <div className="absolute z-[100] top-full left-0 right-0 bg-white border border-gray-400 shadow-lg max-h-48 overflow-y-auto w-[350px]">
                                                                        {inventoryItems.filter(i => i.name.toLowerCase().includes(productSearch.toLowerCase())).map(i => {
                                                                            const stock = branchStocks.find(s => s.item_id === i.id && s.branch_id === formData.branch_id)?.quantity || 0;
                                                                            return (
                                                                                <div key={i.id} onClick={() => {
                                                                                    if (formItems.some(fi => fi.inventory_item_id === i.id)) {
                                                                                        notify.info("Este insumo ya se encuentra en el listado.");
                                                                                        setShowProductDropdown(null);
                                                                                        return;
                                                                                    }
                                                                                    handleUpdateItem(idx, {
                                                                                        inventory_item_id: i.id,
                                                                                        product_name: i.name,
                                                                                        unit_cost: (i.cost || 0) * (i.conversion_factor || 1), // FIX BUG 1: Show presentation cost by default
                                                                                        presentation: i.presentation,
                                                                                        equivalence: i.conversion_factor || 1,
                                                                                        base_unit: i.unit,
                                                                                        source: i.source
                                                                                    });
                                                                                    setShowProductDropdown(null);
                                                                                }}
                                                                                    className="px-2 py-1 text-[10px] border-b border-gray-100 hover:bg-[#106ebe] hover:text-white cursor-pointer flex justify-between uppercase text-slate-800 font-bold group">
                                                                                    <span className="truncate pr-2 group-hover:text-white">{i.name}</span>
                                                                                    <span className={`shrink-0 font-bold ${stock <= 0 ? 'text-red-500 group-hover:text-red-300' : 'text-green-600 group-hover:text-green-300'}`}>Stock: {stock}</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-2 border-r border-gray-100 text-[10px] text-center uppercase truncate text-black font-bold">
                                                                {item.presentation || '--'}
                                                            </td>
                                                            <td className="px-1 border-r border-gray-100">
                                                                <input type="number" step="any" disabled={viewMode} value={item.unit_cost === 0 ? '' : item.unit_cost} onChange={e => handleUpdateItem(idx, { unit_cost: parseFloat(e.target.value) || 0 })}
                                                                    className="w-full h-full bg-transparent text-right text-[11px] font-bold text-black outline-none focus:bg-white focus:border focus:border-[#106ebe] disabled:opacity-100 tabular-nums" />
                                                            </td>
                                                            <td className="px-2 border-r border-gray-100 text-right text-[11px] font-bold text-black tabular-nums">
                                                                {item.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-1 text-center">
                                                                {!viewMode && (
                                                                    <button onClick={() => handleRemoveItem(idx)} className="text-red-600 hover:bg-red-100 p-0.5 rounded-sm">
                                                                        <X size={12} strokeWidth={3} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Classic */}
                            <div className="bg-[#f0f0f0] border-t border-gray-400 px-3 flex items-center justify-end shrink-0 h-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                <span className="text-[11px] font-bold text-slate-800 pr-4">
                                    Total: Q{calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* Detail Context Menu */}
            {detailContextMenu && createPortal(
                <div
                    className="fixed inset-0 z-[199999]"
                    onClick={() => setDetailContextMenu(null)}
                    onContextMenu={(e) => { e.preventDefault(); setDetailContextMenu(null); }}
                >
                    <div
                        className="absolute bg-white border border-gray-400 shadow-[4px_4px_10px_rgba(0,0,0,0.2)] py-1 min-w-[220px]"
                        style={{ left: detailContextMenu.x, top: detailContextMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-800 uppercase hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-none group"
                            onClick={() => {
                                setDetailContextMenu(null);
                                setProductListSearch('');
                                setShowProductListModal(true);
                            }}
                        >
                            <Plus size={14} className="text-[#106ebe] group-hover:text-white" /> Agregar Producto
                        </button>
                        {detailContextMenu.itemIdx !== null && (
                            <>
                                <div className="h-px bg-gray-200 my-1 mx-2" />
                                <button
                                    className="w-full text-left px-4 py-2 text-[11px] font-bold text-red-600 uppercase hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-none group"
                                    onClick={() => {
                                        if (detailContextMenu.itemIdx !== null) handleRemoveItem(detailContextMenu.itemIdx);
                                        setDetailContextMenu(null);
                                    }}
                                >
                                    <X size={14} className="text-red-500 group-hover:text-white" /> Quitar Línea
                                </button>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Product List Modal — Antigravity OS Skill */}
            {showProductListModal && createPortal(
                <div className="fixed inset-0 z-[299999] flex items-center justify-center bg-transparent pointer-events-auto" onClick={() => setShowProductListModal(false)}>
                    <DraggableWindow>
                        <div
                            className="bg-[#f0f0f0] border border-[#106ebe] shadow-[0_0_60px_rgba(0,0,0,0.5)] flex flex-col rounded-sm animate-slide-up relative overflow-hidden pointer-events-auto"
                            style={{ width: 840, height: 600 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex items-center justify-between text-white shrink-0 cursor-move border-b border-white/10">
                                <div className="flex items-center gap-2">
                                    <Package size={14} className="opacity-80" />
                                    <span className="text-[12px] font-bold uppercase tracking-tight">Listado de Productos / Insumos</span>
                                </div>
                                <button onClick={() => setShowProductListModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 transition-all ml-1 text-white" title="Cerrar">
                                    <X size={18} strokeWidth={2.5} />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="bg-[#e8e8e8] px-3 py-2 flex items-center gap-2 border-b border-gray-300 shrink-0">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="BUSCAR POR NOMBRE O CÓDIGO..."
                                    value={productListSearch}
                                    onChange={(e) => setProductListSearch(e.target.value)}
                                    className="flex-1 h-7 border border-gray-400 px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-[#106ebe] bg-white uppercase"
                                />
                                <button className="bg-[#106ebe] text-white px-4 h-7 text-[10px] font-bold uppercase hover:bg-[#002244] flex items-center gap-2">
                                    <Search size={12} /> Buscar
                                </button>
                            </div>

                            {/* Grid */}
                            <div className="flex-1 overflow-hidden flex flex-col bg-white">
                                <div className="flex-1 overflow-auto custom-scrollbar relative">
                                    <table className="w-full text-left border-collapse table-fixed">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-[#f0f0f0] border-b border-gray-300 h-7 shadow-sm">
                                                <th className="px-4 py-1.5 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-200 w-24 tracking-tight">Código</th>
                                                <th className="px-4 py-1.5 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-200 tracking-tight">Producto / Insumo</th>
                                                <th className="px-4 py-1.5 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-200 text-center w-28 tracking-tight">Categoría</th>
                                                <th className="px-4 py-1.5 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-200 text-center w-40 tracking-tight">Presentación</th>
                                                <th className="px-4 py-1.5 text-[10px] text-slate-800 font-bold uppercase text-right w-24 tracking-tight">P. Costo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inventoryItems
                                                .filter(i => {
                                                    const q = productListSearch.toLowerCase();
                                                    return i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q);
                                                })
                                                .map((item) => {
                                                    const alreadyAdded = formItems.some(fi => fi.inventory_item_id === item.id);
                                                    return (
                                                        <tr
                                                            key={`${item.id}-${item.source}`}
                                                            onClick={() => {
                                                                if (alreadyAdded) {
                                                                    notify.info("Este insumo ya se encuentra en el listado.");
                                                                    return;
                                                                }
                                                                setSelectedProductForConfig(item);
                                                                setConfigQty(1);
                                                            }}
                                                            className={`h-7 transition-colors cursor-default border-b border-gray-100 group ${alreadyAdded ? 'opacity-50 grayscale bg-gray-50' : 'hover:bg-[#106ebe]/5'}`}
                                                        >
                                                            <td className="px-4 py-1 text-[10px] border-r border-gray-100 truncate text-slate-600 tabular-nums">{item.code || '---'}</td>
                                                            <td className="px-4 py-1 text-[11px] border-r border-gray-100 font-bold truncate group-hover:text-[#106ebe] uppercase text-slate-800">{item.name}</td>
                                                            <td className="px-4 py-1 text-[10px] border-r border-gray-100 text-center italic text-slate-400 uppercase">{item.display_cat}</td>
                                                            <td className="px-4 py-1 text-[10px] border-r border-gray-100 text-center truncate font-bold uppercase text-slate-600">{item.presentation}</td>
                                                            <td className="px-4 py-1 text-[11px] text-right font-bold tabular-nums pr-4 text-[#106ebe]">Q{(item.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-[#f0f0f0] border-t border-gray-300 px-3 py-1 text-[9px] font-bold text-slate-500 italic shrink-0">
                                    * Haga clic sobre el producto para configurar su ingreso.
                                </div>
                            </div>

                            {/* Sub-Modal Config — Parity with Image */}
                            {selectedProductForConfig && (
                                <div className="absolute inset-0 bg-transparent flex items-center justify-center z-[300001] pointer-events-auto" onClick={() => setSelectedProductForConfig(null)}>
                                    <div 
                                        className="bg-[#f0f0f0] border-2 border-slate-400 shadow-[4px_4px_20px_rgba(0,0,0,0.5)] w-[600px] flex flex-col rounded-sm animate-slide-up pointer-events-auto" 
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Header Light Style */}
                                        <div className="bg-[#f0f0f0] h-7 px-2 flex items-center justify-between border-b border-slate-300">
                                            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">Configuración - Esc (Cerrar)</span>
                                            <button onClick={() => setSelectedProductForConfig(null)} className="w-5 h-5 flex items-center justify-center hover:bg-red-500 hover:text-white text-slate-500 transition-all">
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        </div>

                                        <div className="p-4 flex flex-col gap-4">
                                            {/* Product Title Box */}
                                            <div className="bg-[#e2e2e2] border border-slate-300 p-2 text-center shadow-inner">
                                                <span className="text-[13px] font-black text-slate-900 uppercase tracking-wider">{selectedProductForConfig.name}</span>
                                            </div>

                                            {/* Inputs Row */}
                                            <div className="grid grid-cols-[100px_1fr_120px] gap-2 items-end">
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] font-bold text-slate-600 uppercase mb-1 text-center">Cantidad</label>
                                                    <input
                                                        type="number"
                                                        autoFocus
                                                        className="w-full h-8 bg-white border-2 border-slate-400 px-2 text-[14px] font-black text-[#106ebe] text-center outline-none focus:border-[#106ebe] shadow-inner"
                                                        value={configQty || ''}
                                                        onChange={e => setConfigQty(Number(e.target.value) || 0)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter' && configQty > 0) {
                                                                // Trigger add logic (abstracted below)
                                                                const btn = document.getElementById('btn-add-to-list');
                                                                if (btn) btn.click();
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] font-bold text-slate-600 uppercase mb-1 text-center">Presentación</label>
                                                    <div className="w-full h-8 bg-[#e8e8e8] border border-slate-300 px-3 flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase">
                                                        {selectedProductForConfig.presentation}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] font-bold text-slate-600 uppercase mb-1 text-center">Precio Costo</label>
                                                    <div className="w-full h-8 bg-[#e8e8e8] border border-slate-300 px-3 flex items-center justify-center text-[11px] font-black text-slate-800 tabular-nums">
                                                        Q{(selectedProductForConfig.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-center pt-2">
                                                <button
                                                    id="btn-add-to-list"
                                                    onClick={async () => {
                                                        if (configQty <= 0) return;
                                                        setFormItems(prev => [...prev, {
                                                            inventory_item_id: selectedProductForConfig.id,
                                                            quantity: configQty,
                                                            equivalence: selectedProductForConfig.conversion_factor || 1,
                                                            unit_cost: (selectedProductForConfig.cost || 0),
                                                            total_cost: configQty * (selectedProductForConfig.cost || 0),
                                                            product_name: selectedProductForConfig.name,
                                                            presentation: selectedProductForConfig.presentation,
                                                            base_unit: selectedProductForConfig.unit || 'UN',
                                                            source: selectedProductForConfig.source
                                                        }]);
                                                        setSelectedProductForConfig(null);
                                                        setShowProductListModal(false);
                                                    }}
                                                    className="min-w-[140px] h-9 bg-[#2b7ede] hover:bg-[#1a5fb4] text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md active:translate-y-px"
                                                >
                                                    Agregar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* Annul Confirmation Modal — Antigravity OS Skill */}
            {purchaseToAnnul && createPortal(
                <div className="fixed inset-0 z-[500000] flex items-center justify-center p-4 bg-transparent pointer-events-auto" onClick={() => !loading && setPurchaseToAnnul(null)}>
                    <DraggableWindow>
                        <div 
                            className="bg-[#f0f0f0] border border-[#106ebe] shadow-[0_0_80px_rgba(0,0,0,0.5)] w-full max-w-sm relative overflow-hidden pointer-events-auto rounded-sm animate-slide-up"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={14} className="text-white opacity-80" />
                                    <span className="text-white text-[12px] font-bold uppercase tracking-tight">Confirmar Anulación</span>
                                </div>
                                <button onClick={() => setPurchaseToAnnul(null)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1">
                                    <X size={18} strokeWidth={2.5} />
                                </button>
                            </div>
                            <div className="p-8 text-center bg-white">
                                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-200">
                                    <Trash2 size={28} />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">¿Anular Documento?</h3>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                                    Esta acción revertirá los saldos del inventario del doc: <br/> 
                                    <span className="text-red-500 font-bold block mt-1">{purchaseToAnnul.doc_number}</span>
                                </p>
                            </div>
                            <div className="p-4 bg-[#f0f0f0] border-t border-gray-200 flex flex-col gap-2">
                                <button onClick={confirmAnnulPurchase} disabled={loading} className="w-full h-11 bg-red-500 hover:bg-red-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-red-100">
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                    Confirmar Anulación
                                </button>
                                <button onClick={() => setPurchaseToAnnul(null)} disabled={loading} className="w-full h-11 bg-white text-slate-400 hover:text-slate-600 font-bold text-[11px] uppercase border border-gray-300">
                                    Regresar
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
        </>
    );
};
