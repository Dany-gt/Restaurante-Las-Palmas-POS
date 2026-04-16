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

            const listA = (iRes.data || []).map(i => ({
                ...i,
                source: 'inventory',
                display_cat: 'Inventario'
            }));

            const listB = (pRes.data || []).map(p => ({
                id: p.id,
                code: p.product_code || '',
                name: p.name,
                presentation: p.portion_size || '--',
                cost: p.cost_price || 0,
                conversion_factor: p.portions || 1,
                unit: p.unit_measure || 'Unidad',
                source: 'products',
                tipo: 'materia_prima',
                display_cat: catMap.get(p.category_id) || 'Producto'
            }));

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
            const loadedItems = (items || []).map((it: any) => {
                const itemData = inventoryItems.find(i => i.id === it.inventory_item_id);
                return {
                    id: it.id,
                    purchase_id: it.purchase_id,
                    inventory_item_id: it.inventory_item_id,
                    quantity: it.quantity,
                    equivalence: it.equivalence || 1,
                    unit_cost: it.unit_cost,
                    total_cost: it.total_cost,
                    product_name: itemData?.name || '--- PRODUCTO NO ENCONTRADO ---',
                    presentation: itemData?.presentation || '--',
                    base_unit: itemData?.unit || 'UN'
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

                    // Revert Branch Stock
                    const { data: branchItem } = await supabase.from('inventory_item_branches')
                        .select('quantity')
                        .eq('item_id', old.inventory_item_id)
                        .eq('branch_id', originalBranchId)
                        .single();
                    if (branchItem) {
                        await supabase.from('inventory_item_branches').update({
                            quantity: (branchItem.quantity || 0) - oldQty
                        }).eq('item_id', old.inventory_item_id).eq('branch_id', originalBranchId);
                    }

                    // Revert Global Stock (Crucial fix for exponential calculation bug in edits)
                    const { data: globalItem } = await supabase.from('inventory_items').select('quantity').eq('id', old.inventory_item_id).single();
                    if (globalItem) {
                        await supabase.from('inventory_items').update({
                            quantity: (globalItem.quantity || 0) - oldQty
                        }).eq('id', old.inventory_item_id);
                    }
                }

                // 2. Delete all previous items
                await supabase.from('inventory_purchase_items').delete().eq('purchase_id', formData.id);

                const { error: itemsError } = await supabase.from('inventory_purchase_items').insert(formItems.map(item => ({
                    purchase_id: formData.id,
                    inventory_item_id: item.inventory_item_id,
                    quantity: item.quantity,
                    equivalence: item.equivalence || 1, // Guardamos la equivalencia
                    unit_cost: item.unit_cost,
                    total_cost: item.total_cost
                })));
                if (itemsError) throw itemsError;

                for (const item of formItems) {
                    // MATEMÁTICA ESTRICTA: cantidad_comprada * factor_conversión
                    const addQty = Number(item.quantity) * Number(item.equivalence || 1);
                    const baseUnitCost = Number(item.unit_cost) / Number(item.equivalence || 1);

                    // 1. Update base unit cost (Global)
                    const { error: costError } = await supabase.from('inventory_items').update({
                        cost: baseUnitCost
                    }).eq('id', item.inventory_item_id);
                    if (costError) throw costError;

                    // 2. Update Global Quantity
                    const { data: globalItem } = await supabase.from('inventory_items').select('quantity').eq('id', item.inventory_item_id).single();
                    if (globalItem) {
                        const { error: globalQtyError } = await supabase.from('inventory_items').update({
                            quantity: (globalItem.quantity || 0) + addQty
                        }).eq('id', item.inventory_item_id);
                        if (globalQtyError) throw globalQtyError;
                    }

                    // 3. Update Branch Stock
                    const { data: branchItem } = await supabase.from('inventory_item_branches')
                        .select('quantity')
                        .eq('item_id', item.inventory_item_id)
                        .eq('branch_id', formData.branch_id)
                        .single();
                    if (branchItem) {
                        const { error: branchQtyError } = await supabase.from('inventory_item_branches').update({
                            quantity: (branchItem.quantity || 0) + addQty
                        }).eq('item_id', item.inventory_item_id).eq('branch_id', formData.branch_id);
                        if (branchQtyError) throw branchQtyError;
                    } else {
                        const { error: branchInsertError } = await supabase.from('inventory_item_branches').insert({
                            item_id: item.inventory_item_id,
                            branch_id: formData.branch_id,
                            quantity: addQty,
                            is_enabled: true,
                            is_assigned: true
                        });
                        if (branchInsertError) throw branchInsertError;
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
                    total_cost: item.total_cost
                })));
                if (itemsError) throw itemsError;

                for (const item of formItems) {
                    // MATEMÁTICA ESTRICTA: cantidad_comprada * factor_conversión
                    const addQty = Number(item.quantity) * Number(item.equivalence || 1);
                    const baseUnitCost = Number(item.unit_cost) / Number(item.equivalence || 1);

                    // 1. Update base unit cost & quantity (Global)
                    const { data: globalItem } = await supabase.from('inventory_items').select('quantity').eq('id', item.inventory_item_id).single();
                    await supabase.from('inventory_items').update({
                        cost: baseUnitCost,
                        quantity: (globalItem?.quantity || 0) + addQty
                    }).eq('id', item.inventory_item_id);

                    // 2. Update Branch Stock
                    const { data: branchItem } = await supabase.from('inventory_item_branches')
                        .select('quantity')
                        .eq('item_id', item.inventory_item_id)
                        .eq('branch_id', formData.branch_id)
                        .single();
                    const newBranchQty = (branchItem?.quantity || 0) + addQty;
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
                    // Kardex entry
                    const device = /mobile/i.test(navigator.userAgent)
                        ? 'Celular-' + (currentUser?.name || 'Usuario')
                        : 'PC-' + (currentUser?.name || 'Admin');

                    const baseUnitCostValue = Number(item.unit_cost) / Number(item.equivalence || 1);

                    await supabase.from('inventory_kardex').insert({
                        item_id: item.inventory_item_id,
                        branch_id: formData.branch_id,
                        movement_type: 'COMPRA',
                        reference: (formData.doc_type || 'FACTURA') + ' #' + formData.doc_number,
                        user_id: currentUser?.id,
                        user_name: currentUser?.name || 'Admin',
                        device: isMobile
                            ? 'Celular-' + (currentUser?.name || 'Usuario')
                            : 'PC-' + (currentUser?.name || 'Admin'),
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
                    <div className="absolute inset-0 bg-black/10 pointer-events-auto" onClick={() => !saving && setShowModal(false)} />
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
                                                                                        base_unit: i.unit
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
                                                                {item.presentation || inventoryItems.find(i => i.id === item.inventory_item_id)?.presentation || '--'}
                                                            </td>
                                                            <td className="px-1 border-r border-gray-100">
                                                                <input type="number" step="any" disabled={viewMode} value={item.unit_cost === 0 ? '' : item.unit_cost} onChange={e => handleUpdateItem(idx, { unit_cost: parseFloat(e.target.value) || 0 })}
                                                                    className="w-full h-full bg-transparent text-right text-[11px] font-bold text-black outline-none focus:bg-white focus:border focus:border-[#106ebe] disabled:opacity-100 tabular-nums" />
                                                            </td>
                                                            <td className="px-2 border-r border-gray-100 text-right text-[11px] font-bold text-black tabular-nums bg-slate-50">
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
                        className="absolute bg-[#f0f0f0] border border-gray-400 shadow-lg py-1 min-w-[300px]"
                        style={{ left: detailContextMenu.x, top: detailContextMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="w-full text-left px-6 py-2 text-[11px] hover:bg-[#106ebe] hover:text-white text-black flex items-center gap-3 whitespace-nowrap"
                            onClick={() => {
                                setDetailContextMenu(null);
                                setProductListSearch('');
                                setShowProductListModal(true);
                            }}
                        >
                            <Plus size={12} /> Agregar Producto
                        </button>
                        {detailContextMenu.itemIdx !== null && (
                            <>
                                <div className="h-px bg-gray-300 my-1 mx-2" />
                                <button
                                    className="w-full text-left px-6 py-2 text-[11px] hover:bg-red-50 text-red-600 flex items-center gap-3 whitespace-nowrap"
                                    onClick={() => {
                                        if (detailContextMenu.itemIdx !== null) handleRemoveItem(detailContextMenu.itemIdx);
                                        setDetailContextMenu(null);
                                    }}
                                >
                                    <X size={12} /> Quitar Línea
                                </button>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Product List Modal */}
            {showProductListModal && createPortal(
                <div className="fixed inset-0 z-[299999] flex items-center justify-center" onClick={() => setShowProductListModal(false)}>
                    <div
                        className="bg-[#f0f0f0] border border-[#106ebe] shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col rounded-sm animate-slide-up relative"
                        style={{ width: 840, height: 600 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Windows Classic Header */}
                        <div className="modal-header bg-[#106ebe] h-8 px-3 flex items-center justify-between text-white shrink-0 cursor-move select-none border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Package size={14} className="opacity-80" />
                                <span className="text-[12px] font-bold tracking-wide uppercase">Listado de Productos</span>
                            </div>
                            <button onClick={() => setShowProductListModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 transition-all ml-1 text-white" title="Cerrar">
                                <X size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                        {/* Search bar */}
                        <div className="bg-[#e8e8e8] px-3 py-2 flex items-center gap-2 border-b border-gray-300 shrink-0">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Escriba para buscar por nombre o código..."
                                value={productListSearch}
                                onChange={(e) => setProductListSearch(e.target.value)}
                                className="flex-1 h-7 border border-gray-400 px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-[#106ebe] bg-white"
                            />
                            <button className="bg-[#106ebe] text-white px-4 h-7 text-[10px] font-bold uppercase hover:bg-[#002244] transition-colors flex items-center gap-2 shadow-sm">
                                <Search size={12} /> Buscar
                            </button>
                        </div>
                        {/* Table */}
                        <div className={`flex-1 overflow-auto custom-scrollbar bg-white ${selectedProductForConfig ? 'pointer-events-none' : ''}`}>
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="bg-[#e8e8e8] sticky top-0 z-10 border-b border-gray-400 select-none">
                                    <tr className="h-7">
                                        <th className="px-3 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300 w-24">Código</th>
                                        <th className="px-3 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300">Producto</th>
                                        <th className="px-3 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300 w-28">Categoría</th>
                                        <th className="px-3 text-[10px] text-slate-800 font-bold uppercase border-r border-gray-300 w-24 text-center">Presentación</th>
                                        <th className="px-3 text-[10px] text-slate-800 font-bold uppercase w-24 text-right pr-3">Precio Costo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventoryItems
                                        .filter(i => {
                                            const code = (i.code || '').toUpperCase();
                                            // Excluir TODOS los items de inventario_items (INS-/UTE-) - solo mostrar productos del menú
                                            if (i.source === 'inventory') return false;
                                            
                                            const search = productListSearch.toLowerCase();
                                            const name = (i.name || '').toLowerCase();
                                            return name.includes(search) || code.toLowerCase().includes(search);
                                        })
                                        .map((item) => {
                                            const alreadyAdded = formItems.some(fi => fi.inventory_item_id === item.id);
                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={`h-7 cursor-default border-b border-gray-100 group ${alreadyAdded ? 'opacity-50 grayscale bg-gray-50' : ''}`}
                                                    onClick={() => {
                                                        if (alreadyAdded) return;
                                                        if (formItems.some(fi => fi.inventory_item_id === item.id)) {
                                                            notify.info('Este insumo ya se encuentra en el listado.');
                                                            return;
                                                        }
                                                        setSelectedProductForConfig(item);
                                                        setConfigQty(1);
                                                    }}
                                                >
                                                    <td className="px-3 text-[10px] border-r border-gray-100 font-mono truncate text-black font-bold uppercase">{item.code || '---'}</td>
                                                    <td className="px-3 text-[10px] border-r border-gray-100 font-bold uppercase truncate text-black">{item.name}</td>
                                                    <td className="px-3 text-[10px] border-r border-gray-100 font-bold uppercase truncate text-slate-500 italic">{item.display_cat || '---'}</td>
                                                    <td className="px-3 text-[10px] border-r border-gray-100 text-center truncate text-black font-bold">{item.presentation || '--'}</td>
                                                    <td className="px-3 text-[10px] text-right font-bold tabular-nums text-black">Q{(item.cost || 0).toFixed(2)}</td>
                                                </tr>
                                            );
                                        })
                                    }
                                    {inventoryItems.filter(i => {
                                        if (i.source === 'inventory') return false;
                                        const search = productListSearch.toLowerCase();
                                        return (i.name || '').toLowerCase().includes(search) || (i.code || '').toLowerCase().includes(search);
                                    }).length === 0 && (
                                        <tr><td colSpan={5} className="py-6 text-center text-[11px] text-black font-bold uppercase">Sin productos disponibles para compras</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Footer hint */}
                        <div className="bg-[#f0f0f0] border-t border-gray-300 px-3 py-1 shrink-0">
                            <span className="text-[9px] text-gray-500">*Clic sobre cualquier Producto para configurar la cantidad antes de agregar.</span>
                        </div>

                        {/* Config Sub-Modal (appears over the list) */}
                        {selectedProductForConfig && (
                            <div
                                className="absolute inset-0 bg-black/30 flex items-center justify-center z-10"
                                onClick={() => setSelectedProductForConfig(null)}
                            >
                                <div
                                    className="bg-[#f0f0f0] border border-[#106ebe] shadow-[0_0_50px_rgba(0,0,0,0.6)] w-[480px] flex flex-col rounded-sm animate-slide-up"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Sub-modal header */}
                                    <div className="bg-[#106ebe] h-8 px-3 flex items-center justify-between text-white border-b border-white/10 shadow-sm cursor-move">
                                        <div className="flex items-center gap-2">
                                            <Settings size={14} className="opacity-80" />
                                            <span className="text-[12px] font-bold uppercase tracking-wider">Configuración de Producto</span>
                                        </div>
                                        <button onClick={() => setSelectedProductForConfig(null)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 transition-all text-white" title="Cerrar">
                                            <X size={18} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                    {/* Product name */}
                                    <div className="px-4 pt-3 pb-2">
                                        <input
                                            type="text"
                                            disabled
                                            value={selectedProductForConfig.name || ''}
                                            className="w-full h-7 border border-gray-400 bg-[#f0f0f0] px-2 text-[11px] font-bold uppercase text-black"
                                        />
                                    </div>
                                    {/* Grid: Cantidad, Presentacion, Precio */}
                                    <div className="px-5 pb-4 grid grid-cols-3 gap-4 text-black">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase">Cantidad</label>
                                            <input
                                                autoFocus
                                                type="number"
                                                step="any"
                                                min="0.01"
                                                value={configQty}
                                                onChange={(e) => setConfigQty(parseFloat(e.target.value) || 0)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        if (configQty <= 0) return;
                                                        setFormItems(prev => [...prev, {
                                                            inventory_item_id: selectedProductForConfig.id,
                                                            quantity: configQty,
                                                            equivalence: selectedProductForConfig.conversion_factor || 1,
                                                            unit_cost: (selectedProductForConfig.cost || 0) * (selectedProductForConfig.conversion_factor || 1), // FIX BUG 1: Show presentation cost
                                                            total_cost: configQty * (selectedProductForConfig.cost || 0) * (selectedProductForConfig.conversion_factor || 1),
                                                            product_name: selectedProductForConfig.name,
                                                            presentation: selectedProductForConfig.presentation,
                                                            base_unit: selectedProductForConfig.unit
                                                        }]);
                                                        setSelectedProductForConfig(null);
                                                        setShowProductListModal(false);
                                                    }
                                                    if (e.key === 'Escape') setSelectedProductForConfig(null);
                                                }}
                                                className="w-full h-7 border border-gray-400 bg-white px-2 text-[11px] font-bold text-center text-black outline-none focus:border-[#106ebe]"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase">Presentación</label>
                                            <input
                                                type="text"
                                                disabled
                                                value={selectedProductForConfig.presentation || '--'}
                                                className="w-full h-7 border border-gray-400 bg-gray-100 px-2 text-[11px] font-bold text-center text-slate-800"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase">Precio Costo</label>
                                            <input
                                                type="text"
                                                disabled
                                                value={`Q${(selectedProductForConfig.cost || 0).toFixed(2)}`}
                                                className="w-full h-7 border border-gray-400 bg-[#f0f0f0] px-2 text-[11px] text-right font-bold text-black"
                                            />
                                        </div>
                                    </div>
                                    <div className="px-5 pb-5 flex justify-end gap-3">
                                        <button
                                            className="px-6 h-8 bg-[#f0f0f0] border-t border-l border-white border-r border-b border-gray-600 active:border-t-gray-700 active:border-l-gray-700 active:bg-gray-200 shadow-sm text-black text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                                            onClick={() => {
                                                if (configQty <= 0) return;
                                                setFormItems(prev => [...prev, {
                                                    inventory_item_id: selectedProductForConfig.id,
                                                    quantity: configQty,
                                                    equivalence: selectedProductForConfig.conversion_factor || 1,
                                                    unit_cost: (selectedProductForConfig.cost || 0) * (selectedProductForConfig.conversion_factor || 1), // FIX BUG 1: Show presentation cost
                                                    total_cost: configQty * (selectedProductForConfig.cost || 0) * (selectedProductForConfig.conversion_factor || 1),
                                                    product_name: selectedProductForConfig.name,
                                                    presentation: selectedProductForConfig.presentation,
                                                    base_unit: selectedProductForConfig.unit
                                                }]);
                                                setSelectedProductForConfig(null);
                                                setShowProductListModal(false);
                                            }}
                                        >
                                            <Plus size={14} /> Agregar a Lista
                                        </button>
                                        <button
                                            onClick={() => setSelectedProductForConfig(null)}
                                            className="px-6 h-8 bg-white border border-gray-400 text-gray-600 text-[11px] font-bold uppercase hover:bg-gray-50 transition-all text-center"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Annul Confirmation Modal */}

            {
                purchaseToAnnul && (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
                        <div className="absolute inset-0" onClick={() => !loading && setPurchaseToAnnul(null)} />
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative overflow-hidden border border-slate-200 pointer-events-auto">
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                    <AlertCircle size={32} />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 tracking-tight mb-3 uppercase">¿Anular Compra?</h3>
                                <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
                                    Esta acción revertirá todo el inventario ingresado con el documento <span className="text-slate-800 font-black">{purchaseToAnnul.doc_number}</span>.
                                </p>
                            </div>
                            <div className="p-6 bg-slate-50 flex flex-col gap-2">
                                <button onClick={confirmAnnulPurchase} disabled={loading} className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-rose-200">
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                    Confirmar Anulación
                                </button>
                                <button onClick={() => setPurchaseToAnnul(null)} disabled={loading} className="w-full py-3 bg-white text-slate-400 hover:text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
};
