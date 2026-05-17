import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import {
    Search,
    Printer,
    Download,
    ChevronDown,
    ChevronRight,
    Calendar,
    Filter,
    Loader2,
    Utensils,
    Package,
    User,
    Trash2,
    Clock,
    UserCircle
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');
import * as XLSX from 'xlsx';
import { useReactToPrint } from 'react-to-print';

const formatCurr = (v: number) => 'Q' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ReportSoldItemsProps {
    mode?: string;
}

export const ReportSoldItems: React.FC<ReportSoldItemsProps> = ({ mode = 'REP_SOLD_GEN' }) => {
    const getLocalISOString = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(getLocalISOString());
    const [endDate, setEndDate] = useState(getLocalISOString());
    const [startTime, setStartTime] = useState('00:00');
    const [endTime, setEndTime] = useState('23:59');

    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = cachedUser?.id || 'anon';
    const STORAGE_KEY = `ReportSoldItems_State_${userId}_${mode}`;

    // Restore state synchronously on mount
    const [savedState] = useState(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    });

    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(savedState?.selectedCategories ? new Set(savedState.selectedCategories) : new Set());
    const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
    const [data, setData] = useState<any[]>(savedState?.data || []);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>(savedState?.selectedBranch || 'all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);
    const printRef = React.useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Reporte_Platillos_${mode}_${startDate}`,
    });

    useEffect(() => {
        fetchMetadata();

        // Solo generar automáticamente si no hay un estado guardado previo
        if (!savedState) {
            handleGenerate();
        }
    }, [mode]);

    useEffect(() => {
        const state = {
            data,
            selectedBranch,
            selectedCategories: Array.from(selectedCategories),
            startDate,
            endDate,
            startTime,
            endTime
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [data, selectedBranch, selectedCategories, startDate, endDate, startTime, endTime, STORAGE_KEY]);

    const fetchMetadata = async () => {
        try {
            const { data: cats } = await supabase.from('menu_categories').select('id, name:nombre, parent_id').order('nombre');
            const { data: brs } = await supabase.from('branches').select('*').order('name');
            setCategories(cats || []);
            setBranches(brs || []);
            // Dejar categorías deseleccionadas por defecto (Significa: Mostrar Todo)
            setSelectedCategories(new Set());
            // Inicialmente expandir todos los padres
            const parents = (cats || []).filter(c => !c.parent_id).map(c => c.id);
            setExpandedParents(new Set(parents));
        } catch (error) {
            console.error(error);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            let currentCats = categories;
            if (categories.length === 0) {
                const { data: cats } = await supabase.from('menu_categories').select('id, name:nombre, parent_id').order('nombre');
                if (cats) {
                    setCategories(cats);
                    currentCats = cats;
                }
            }

            const startStr = `${startDate}T${startTime}:00`;
            const endStr = `${endDate}T${endTime}:59`;

            if (mode === 'REP_DELETED') {
                let query = supabase
                    .from('order_items')
                    .select(`
                        id,
                        quantity,
                        unit_price,
                        void_reason,
                        voided_at,
                        updated_at,
                        product_name,
                        status,
                        products!inner(menu_category_id),
                        orders!inner(order_number, branch_id, waiter:profiles!waiter_id(name))
                    `)
                    .in('status', ['cancelled', 'voided'])
                    .gte('updated_at', startStr)
                    .lte('updated_at', endStr);

                if (selectedBranch !== 'all') {
                    query = query.eq('orders.branch_id', selectedBranch);
                }

                const { data: results, error } = await query;
                if (error) throw error;

                results?.forEach(item => {
                    if (item.products) {
                        (item.products as any).category_id = (item.products as any).menu_category_id;
                    }
                });

                setData(results || []);
                return;
            }

            // Mode SOLD_GEN, SOLD_USER, or BILLED
            let query = supabase
                .from('order_items')
                .select(`
                    id,
                    quantity,
                    unit_price,
                    discount_amount,
                    products!inner(id, name, menu_category_id),
                    orders!inner(
                        id, 
                        created_at, 
                        status, 
                        branch_id,
                        is_contingency
                        ${mode === 'REP_SOLD_USER' ? ', waiter:profiles!waiter_id(name)' : ''}
                        ${mode === 'REP_BILLED' ? ', invoices!inner(status)' : ''}
                    )
                `)
                .eq('orders.status', 'completed')
                .gte('orders.created_at', startStr)
                .lte('orders.created_at', endStr);

            if (mode === 'REP_BILLED') {
                query = query.eq('orders.invoices.status', 'ACTIVE').not('orders.is_contingency', 'eq', true);
            }

            if (selectedBranch !== 'all') {
                query = query.eq('orders.branch_id', selectedBranch);
            }

            const { data: results, error } = await query;
            if (error) throw error;

            const grouped: Record<string, any> = {};

            results?.forEach(item => {
                const products = item.products as any;
                if (!products) return;

                // Map database menu_category_id to category_id
                products.category_id = products.menu_category_id;

                const netAmount = (item.unit_price * item.quantity) - (item.discount_amount || 0);

                if (mode === 'REP_SOLD_USER') {
                    const waiterName = (item.orders as any)?.waiter?.name || 'DESCONOCIDO';
                    const prodId = products.id;
                    const catName = currentCats.find(c => c.id === products.category_id)?.name || 'Sin Categoría';

                    if (!grouped[waiterName]) {
                        grouped[waiterName] = {
                            id: waiterName,
                            name: waiterName,
                            totalQty: 0,
                            totalAmount: 0,
                            itemGroups: {}
                        };
                    }

                    if (!grouped[waiterName].itemGroups[prodId]) {
                        grouped[waiterName].itemGroups[prodId] = {
                            id: prodId,
                            categoryName: catName,
                            productName: products.name,
                            qty: 0,
                            total: 0,
                            categoryId: products.category_id
                        };
                    }

                    grouped[waiterName].itemGroups[prodId].qty += item.quantity;
                    grouped[waiterName].itemGroups[prodId].total += netAmount;
                    grouped[waiterName].totalQty += item.quantity;
                    grouped[waiterName].totalAmount += netAmount;
                } else {
                    const catId = products.category_id;
                    const prodId = products.id;
                    const prodName = products.name;

                    if (!grouped[catId]) {
                        grouped[catId] = {
                            id: catId,
                            name: currentCats.find(c => c.id === catId)?.name || 'Sin Categoría',
                            totalQty: 0,
                            totalAmount: 0,
                            items: {}
                        };
                    }

                    if (!grouped[catId].items[prodId]) {
                        grouped[catId].items[prodId] = {
                            id: prodId,
                            name: prodName,
                            qty: 0,
                            total: 0
                        };
                    }

                    grouped[catId].items[prodId].qty += item.quantity;
                    grouped[catId].items[prodId].total += netAmount;
                    grouped[catId].totalQty += item.quantity;
                    grouped[catId].totalAmount += netAmount;
                }
            });

            if (mode === 'REP_SOLD_USER') {
                setData(Object.values(grouped).map((g: any) => ({
                    ...g,
                    itemsList: Object.values(g.itemGroups)
                })).sort((a, b) => a.name.localeCompare(b.name)));
            } else {
                setData(Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name)));
            }
        } catch (error) {
            console.error(error);
            alert("Error al generar reporte");
        } finally {
            setLoading(false);
        }
    };

    const toggleCategory = (id: string) => {
        const next = new Set(selectedCategories);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedCategories(next);
    };

    const toggleParent = (parent: any) => {
        const next = new Set(selectedCategories);
        const childIds = parent.children.map((c: any) => c.id);
        
        if (childIds.length > 0) {
            const allSelected = childIds.every((id: string) => next.has(id));
            if (allSelected) {
                childIds.forEach((id: string) => next.delete(id));
                if (parent.id !== 'others') next.delete(parent.id);
            } else {
                childIds.forEach((id: string) => next.add(id));
                if (parent.id !== 'others') next.add(parent.id);
            }
        } else {
            if (next.has(parent.id)) {
                next.delete(parent.id);
            } else {
                next.add(parent.id);
            }
        }
        setSelectedCategories(next);
    };

    const toggleParentExpand = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const next = new Set(expandedParents);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedParents(next);
    };

    const groupedCategories = useMemo(() => {
        const parents = categories.filter(c => !c.parent_id);
        const orphans = categories.filter(c => c.parent_id && !categories.some(p => p.id === c.parent_id));

        const tree = parents.map(p => ({
            ...p,
            children: categories.filter(c => c.parent_id === p.id).sort((a, b) => a.name.localeCompare(b.name))
        })).sort((a, b) => a.name.localeCompare(b.name));

        if (orphans.length > 0) {
            tree.push({
                id: 'others',
                name: 'OTROS',
                children: orphans.sort((a, b) => a.name.localeCompare(b.name))
            } as any);
        }

        return tree;
    }, [categories]);

    const filteredData = useMemo(() => {
        if (mode === 'REP_DELETED') {
            return data.filter(item => {
                const matchesSearch = searchTerm === '' || item.product_name.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesCategory = selectedCategories.size === 0 || selectedCategories.has(item.products?.category_id);
                return matchesSearch && matchesCategory;
            });
        }

        return data
            .map(group => {
                const itemsList = mode === 'REP_SOLD_USER' ? group.itemsList : Object.values(group.items);
                const displayItems = itemsList.filter((item: any) => {
                    const itemName = mode === 'REP_SOLD_USER' ? item.productName : item.name;
                    const catId = mode === 'REP_SOLD_USER' ? item.categoryId : group.id;
                    const matchesSearch = searchTerm === '' || itemName.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesCategory = selectedCategories.size === 0 || selectedCategories.has(catId);
                    return matchesSearch && matchesCategory;
                });

                return {
                    ...group,
                    displayItems,
                    groupTotalQty: displayItems.reduce((acc: number, curr: any) => acc + curr.qty, 0),
                    groupTotalAmount: displayItems.reduce((acc: number, curr: any) => acc + curr.total, 0)
                };
            })
            .filter(group => group.displayItems.length > 0);
    }, [data, selectedCategories, searchTerm, mode]);

    const globalTotal = useMemo(() => {
        if (mode === 'REP_DELETED') {
            return filteredData.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
        }
        return filteredData.reduce((acc, group) => acc + group.groupTotalAmount, 0);
    }, [filteredData, mode]);

    const globalCount = useMemo(() => {
        if (mode === 'REP_DELETED') {
            return filteredData.reduce((acc, item) => acc + item.quantity, 0);
        }
        return filteredData.reduce((acc, group) => acc + group.groupTotalQty, 0);
    }, [filteredData, mode]);

    const handleExportExcel = () => {
        const exportData: any[] = [];
        if (mode === 'REP_DELETED') {
            filteredData.forEach(item => {
                exportData.push({
                    Fecha: dayjs(item.updated_at).format('DD/MM/YYYY HH:mm'),
                    Cantidad: item.quantity,
                    "No. Orden": item.orders?.order_number,
                    Platillo: item.product_name,
                    "Eliminado Por": (item.orders as any)?.waiter?.name || 'SISTEMA',
                    Precio: formatCurr(item.unit_price),
                    Total: formatCurr(item.quantity * item.unit_price)
                });
            });
        } else {
            filteredData.forEach(group => {
                exportData.push({ Platillo: `--- ${group.name.toUpperCase()} ---`, Categoría: '', Cantidad: '', Total: '' });
                group.displayItems.forEach((item: any) => {
                    if (mode === 'REP_SOLD_USER') {
                        exportData.push({
                            Categoría: item.categoryName,
                            Platillo: item.productName,
                            Cantidad: item.qty,
                            Total: formatCurr(item.total)
                        });
                    } else {
                        exportData.push({
                            Platillo: item.name,
                            Cantidad: item.qty,
                            Total: formatCurr(item.total)
                        });
                    }
                });
                exportData.push({ Platillo: `SUBTOTAL ${group.name}`, Cantidad: group.groupTotalQty, Total: formatCurr(group.groupTotalAmount) });
                exportData.push({});
            });
        }
        exportData.push({ Platillo: 'TOTAL GENERAL', Cantidad: globalCount, Total: formatCurr(globalTotal) });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ventas");
        XLSX.writeFile(wb, `Reporte_Platillos_${mode}_${startDate}.xlsx`);
    };

    return (
        <div className="flex flex-col h-full bg-[#f0f0f0] text-slate-800 font-sans select-none overflow-hidden">
            {/* Header / Toolbar */}
            <div className="bg-[#f0f0f0] border-b border-gray-300 p-3 shrink-0">
                <div className="flex flex-col gap-3">
                    {/* Top Row: Branch & Options */}
                    <div className="flex items-center gap-4 border-b border-gray-200 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-gray-700">Sucursal</span>
                            <select
                                value={selectedBranch}
                                onChange={e => setSelectedBranch(e.target.value)}
                                className="border border-gray-400 bg-white text-[11px] h-7 px-2 outline-none shadow-inner w-64"
                            >
                                <option value="all">Todas las sucursales</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={selectedBranch === 'all'} onChange={() => setSelectedBranch('all')} />
                            <span className="text-[11px] font-bold text-gray-700">Ver todas las sucursales</span>
                        </label>
                    </div>

                    {/* Filters Row */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 relative pt-2">
                            <span className="absolute -top-3.5 left-0 text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Fechas</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-gray-700">Del:</span>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-gray-400 bg-white text-[11px] h-7 px-2 outline-none shadow-inner" />
                                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="border border-gray-400 bg-white text-[11px] h-7 px-1 outline-none shadow-inner" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-gray-700">Al:</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-gray-400 bg-white text-[11px] h-7 px-2 outline-none shadow-inner" />
                                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="border border-gray-400 bg-white text-[11px] h-7 px-1 outline-none shadow-inner" />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="bg-white border-2 border-gray-300 hover:bg-gray-50 px-6 py-1 h-8 text-[11px] font-black uppercase text-gray-700 shadow-sm active:scale-95 flex items-center gap-2"
                            >
                                {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Generar
                            </button>
                            <button
                                onClick={() => setShowPrintModal(true)}
                                disabled={data.length === 0}
                                className="bg-white border-2 border-gray-300 hover:bg-gray-50 px-6 py-1 h-8 text-[11px] font-black uppercase text-gray-700 shadow-sm active:scale-95 flex items-center gap-2"
                            >
                                <Printer size={12} className="text-blue-600" /> Vista Previa
                            </button>
                        </div>

                        <div className="flex-1"></div>

                        {/* Search Bar */}
                        <div className="flex items-center bg-white border-2 border-gray-300 h-8 px-2 gap-2 focus-within:border-blue-500/50">
                            <Search size={14} className="text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar platillo..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="bg-transparent border-none outline-none text-[11px] text-gray-700 w-[200px]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar: Categories */}
                {mode !== 'REP_DELETED' && (
                    <div className="w-64 border-r border-gray-300 bg-white flex flex-col shrink-0 shadow-lg z-10">
                        <div className="bg-gray-100 border-b border-gray-300 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-gray-600 flex justify-between items-center">
                            <span>Categoría</span>
                            {selectedCategories.size > 0 && (
                                <button
                                    onClick={() => setSelectedCategories(new Set())}
                                    className="text-[9px] text-blue-600 hover:text-blue-800 lowercase font-bold"
                                >
                                    (Limpiar)
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto bg-[#fafafa]">
                            <div className="flex flex-col">
                                {groupedCategories.map(parent => (
                                    <div key={parent.id} className="border-b border-gray-200">
                                        <div
                                            onClick={(e) => toggleParentExpand(parent.id, e)}
                                            className="flex items-center gap-2 p-2 px-3 hover:bg-gray-100 cursor-pointer bg-gray-50/80 group"
                                        >
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-400 text-blue-800"
                                                checked={parent.children.length > 0 ? parent.children.every((c: any) => selectedCategories.has(c.id)) : selectedCategories.has(parent.id)}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    toggleParent(parent);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <div className="flex-1 flex items-center gap-2">
                                                {expandedParents.has(parent.id) ? <ChevronDown size={12} className="text-blue-600" /> : <ChevronRight size={12} className="text-gray-400" />}
                                                <span className="text-[11px] font-black text-gray-800 uppercase tracking-tight">{parent.name}</span>
                                            </div>
                                        </div>
                                        {expandedParents.has(parent.id) && (
                                            <div className="flex flex-col bg-white animate-in slide-in-from-top-1 duration-200">
                                                {parent.children.map((child: any) => (
                                                    <label key={child.id} className="flex items-center gap-2 py-1.5 px-8 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0 grow">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCategories.has(child.id)}
                                                            onChange={() => toggleCategory(child.id)}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-[10px] font-bold text-gray-700 uppercase truncate">{child.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Grid: Results */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    <div className="flex-1 overflow-auto">
                        <table className="w-full border-collapse text-[11px]">
                            <thead className="sticky top-0 bg-[#f0f0f0] z-20 shadow-sm border-b border-gray-300">
                                <tr className="divide-x divide-gray-300">
                                    {mode === 'REP_DELETED' ? (
                                        <>
                                            <th className="px-4 py-2 text-left font-black uppercase text-gray-600 w-40">Fecha</th>
                                            <th className="px-4 py-2 text-center font-black uppercase text-gray-600 w-24">Cant.</th>
                                            <th className="px-4 py-2 text-center font-black uppercase text-gray-600 w-24">No. Orden</th>
                                            <th className="px-4 py-2 text-left font-black uppercase text-gray-600">Platillo</th>
                                            <th className="px-4 py-2 text-left font-black uppercase text-gray-600 w-48">Eliminado Por</th>
                                            <th className="px-4 py-2 text-right font-black uppercase text-gray-600 w-28">Precio</th>
                                            <th className="px-4 py-2 text-right font-black uppercase text-gray-600 w-28">Total</th>
                                        </>
                                    ) : (
                                        <>
                                            {mode === 'REP_SOLD_USER' && <th className="px-4 py-2 text-left font-black uppercase text-gray-600 w-1/4">Categoría</th>}
                                            <th className="px-4 py-2 text-left font-black uppercase text-gray-600">Platillo</th>
                                            <th className="px-4 py-2 text-center font-black uppercase text-gray-600 w-32">Cantidad</th>
                                            <th className="px-4 py-2 text-right font-black uppercase text-gray-600 w-32">Total</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={mode === 'REP_DELETED' ? 7 : (mode === 'REP_SOLD_USER' ? 4 : 3)} className="px-4 py-20 text-center text-gray-400 h-full">
                                            <div className="flex flex-col items-center gap-2 opacity-50">
                                                {mode === 'REP_DELETED' ? <Trash2 size={48} strokeWidth={1} /> : <Utensils size={48} strokeWidth={1} />}
                                                <span className="font-bold uppercase tracking-widest">No hay datos para mostrar</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    mode === 'REP_DELETED' ? (
                                        filteredData.map((item, idx) => (
                                            <tr key={item.id || idx} className="border-b border-gray-100 hover:bg-rose-50/30 transition-colors divide-x divide-gray-100">
                                                <td className="px-4 py-2 font-bold text-gray-500 tabular-nums">
                                                    {dayjs(item.updated_at).format('DD/MM/YYYY HH:mm')}
                                                </td>
                                                <td className="px-4 py-2 text-center font-black text-rose-600">{item.quantity}</td>
                                                <td className="px-4 py-2 text-center font-bold text-gray-600">#{item.orders?.order_number}</td>
                                                <td className="px-4 py-2 font-black text-slate-700 uppercase truncate" title={item.product_name}>
                                                    {item.product_name}
                                                    {item.void_reason && (
                                                        <div className="text-[9px] font-bold text-gray-400 lowercase mt-0.5">
                                                            Razón: {item.void_reason}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 uppercase font-bold text-gray-500 flex items-center gap-2 overflow-hidden">
                                                    <UserCircle size={12} className="shrink-0" />
                                                    <span className="truncate">{(item.orders as any)?.waiter?.name || 'SISTEMA'}</span>
                                                </td>
                                                <td className="px-4 py-2 text-right font-bold tabular-nums">{formatCurr(item.unit_price)}</td>
                                                <td className="px-4 py-2 text-right font-black tabular-nums text-rose-700">{formatCurr(item.quantity * item.unit_price)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        filteredData.map(group => (
                                            <React.Fragment key={group.id}>
                                                {/* Group Header */}
                                                <tr className="bg-blue-50/50 border-y border-gray-200">
                                                    <td colSpan={mode === 'REP_SOLD_USER' ? 4 : 3} className="px-4 py-2 flex items-center gap-2">
                                                        {mode === 'REP_SOLD_USER' ? <User size={12} className="text-blue-600" /> : <ChevronDown size={12} className="text-blue-600" />}
                                                        <span className="font-black text-blue-800 uppercase tracking-wider">{group.name}</span>
                                                    </td>
                                                </tr>
                                                {/* Items */}
                                                {group.displayItems.map((item: any, idx: number) => (
                                                    <tr key={`${group.id}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors divide-x divide-gray-100">
                                                        {mode === 'REP_SOLD_USER' && <td className="px-10 py-2 font-bold text-gray-500 uppercase">{item.categoryName}</td>}
                                                        <td className={`${mode === 'REP_SOLD_USER' ? 'px-4' : 'px-10'} py-2 font-bold text-slate-700 uppercase`}>
                                                            {mode === 'REP_SOLD_USER' ? item.productName : item.name}
                                                        </td>
                                                        <td className="px-4 py-2 text-center font-bold tabular-nums">{item.qty}</td>
                                                        <td className="px-4 py-2 text-right font-bold tabular-nums">{formatCurr(item.total)}</td>
                                                    </tr>
                                                ))}
                                                {/* Group Footer */}
                                                <tr className="bg-white border-b border-gray-300">
                                                    <td className="px-4 py-2" colSpan={mode === 'REP_SOLD_USER' ? 2 : 1}></td>
                                                    <td className="px-4 py-2 text-center font-black border-t-2 border-gray-400">{group.groupTotalQty}</td>
                                                    <td className="px-4 py-2 text-right font-black border-t-2 border-gray-400 text-blue-700">{formatCurr(group.groupTotalAmount)}</td>
                                                </tr>
                                            </React.Fragment>
                                        ))
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Fila Fija Total General al Fondo */}
                    {filteredData.length > 0 && (
                        <div className="bg-[#106ebe] text-white select-none shrink-0 z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.2)] border-t border-white/20">
                            <table className="w-full border-collapse text-[11px]">
                                <tbody>
                                    <tr className="divide-x divide-gray-700/50">
                                        {mode === 'REP_DELETED' ? (
                                            <>
                                                <td className="px-4 py-1 font-black uppercase tracking-[0.2em] text-[10px]">Resumen de Eliminaciones</td>
                                                <td className="px-4 py-1 text-center font-black text-xs w-24 bg-white/5">{globalCount}</td>
                                                <td className="w-24"></td>
                                                <td className="w-48"></td>
                                                <td className="px-4 py-1 text-right font-black text-xs w-28 bg-white/10 uppercase">Total</td>
                                                <td className="px-4 py-1 text-right font-black text-xs w-28 bg-white/10 pr-4">{formatCurr(globalTotal)}</td>
                                            </>
                                        ) : (
                                            <>
                                                {mode === 'REP_SOLD_USER' ? (
                                                    <td className="px-4 py-1 font-black uppercase tracking-[0.2em] text-[10px]" colSpan={2}>Total General</td>
                                                ) : (
                                                    <td className="px-4 py-1 font-black uppercase tracking-[0.2em] text-[10px]">Total General</td>
                                                )}
                                                <td className="px-4 py-1 text-center font-black text-xs w-32 bg-white/5">
                                                    {globalCount}
                                                </td>
                                                <td className="px-4 py-1 text-right font-black text-xs w-32 bg-white/10 pr-4">
                                                    {formatCurr(globalTotal)}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Print / Export Modal */}
            {showPrintModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
                    <div className="bg-[#f0f0f0] border-2 border-[#106ebe] shadow-2xl w-[950px] h-[90%] flex flex-col scale-in-center overflow-hidden">
                        <div className="bg-[#106ebe] text-white p-2 flex justify-between items-center shrink-0">
                            <span className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <Printer size={14} />
                                {mode === 'REP_DELETED' ? 'Reporte de Platillos Eliminados' :
                                    mode === 'REP_SOLD_USER' ? 'Platillos Vendidos por Usuario' :
                                        mode === 'REP_BILLED' ? 'Platillos Facturados' : 'Platillos Vendidos General'}
                            </span>
                            <button onClick={() => setShowPrintModal(false)} className="hover:bg-red-500 p-1 rounded transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="bg-white border-b border-gray-300 p-3 flex justify-between shrink-0">
                            <div className="flex gap-2">
                                <button
                                    onClick={handlePrint}
                                    className="bg-gray-100 hover:bg-gray-200 border border-gray-400 px-4 py-1 text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    <Printer size={14} /> Imprimir Reporte
                                </button>
                                <button
                                    onClick={handleExportExcel}
                                    className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-400 text-emerald-700 px-4 py-1 text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    <Download size={14} /> Exportar Excel (.xlsx)
                                </button>
                            </div>
                            <button onClick={() => setShowPrintModal(false)} className="text-xs font-bold text-gray-500 hover:text-gray-700 uppercase">Cerrar</button>
                        </div>

                        <div className="flex-1 overflow-auto bg-gray-200 p-8">
                            <div ref={printRef} className="bg-white shadow-lg p-10 min-h-full w-[25cm] mx-auto text-black">
                                <div className="text-center mb-10 border-b-4 border-double border-black pb-6">
                                    <h1 className="text-3xl font-black uppercase mb-1 tracking-tighter">RESTAURANTE LAS PALMAS</h1>
                                    <h2 className="text-xl font-bold uppercase mb-2">
                                        {mode === 'REP_DELETED' ? 'Reporte de Platillos Eliminados' :
                                            mode === 'REP_SOLD_USER' ? 'Reporte por Usuario' :
                                                mode === 'REP_BILLED' ? 'Platillos Facturados' : 'Reporte Platillos Vendidos General'}
                                    </h2>
                                    <p className="text-sm font-bold text-gray-600 uppercase">
                                        Período: {dayjs(startDate + 'T' + startTime).format('DD/MM/YYYY HH:mm')} al {dayjs(endDate + 'T' + endTime).format('DD/MM/YYYY HH:mm')}
                                    </p>
                                </div>

                                <table className="w-full text-[10px]">
                                    <thead className="border-b-2 border-black">
                                        <tr>
                                            {mode === 'REP_DELETED' ? (
                                                <>
                                                    <th className="py-2 text-left font-black uppercase w-32">Fecha</th>
                                                    <th className="py-2 text-center font-black uppercase w-12">Cant.</th>
                                                    <th className="py-2 text-center font-black uppercase w-16">Orden</th>
                                                    <th className="py-2 text-left font-black uppercase">Platillo</th>
                                                    <th className="py-2 text-left font-black uppercase w-32">Eliminado Por</th>
                                                    <th className="py-2 text-right font-black uppercase w-24">Precio</th>
                                                    <th className="py-2 text-right font-black uppercase w-24">Total</th>
                                                </>
                                            ) : (
                                                <>
                                                    {mode === 'REP_SOLD_USER' && <th className="py-2 text-left font-black uppercase">Categoría</th>}
                                                    <th className="py-2 text-left font-black uppercase">Platillo</th>
                                                    <th className="py-2 text-center font-black uppercase w-24">Unidades</th>
                                                    <th className="py-2 text-right font-black uppercase w-32">Monto Total</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {mode === 'REP_DELETED' ? (
                                            filteredData.map((item, i) => (
                                                <tr key={i} className="border-b border-gray-100">
                                                    <td className="py-2 font-bold">{dayjs(item.updated_at).format('DD/MM/YYYY HH:mm')}</td>
                                                    <td className="py-2 text-center">{item.quantity}</td>
                                                    <td className="py-2 text-center">#{item.orders?.order_number}</td>
                                                    <td className="py-2">
                                                        <div className="font-bold uppercase">{item.product_name}</div>
                                                        {item.void_reason && <div className="text-[8px] text-gray-400">Motivo: {item.void_reason}</div>}
                                                    </td>
                                                    <td className="py-2 uppercase">{(item.orders as any)?.waiter?.name || 'SISTEMA'}</td>
                                                    <td className="py-2 text-right font-bold">{formatCurr(item.unit_price)}</td>
                                                    <td className="py-2 text-right font-black">{formatCurr(item.quantity * item.unit_price)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            filteredData.map(group => (
                                                <React.Fragment key={group.id}>
                                                    <tr className="bg-gray-100">
                                                        <td colSpan={mode === 'REP_SOLD_USER' ? 4 : 3} className="py-2 px-2 font-black uppercase border-b border-gray-300 text-[11px]">
                                                            {mode === 'REP_SOLD_USER' ? 'USUARIO: ' : ''}{group.name}
                                                        </td>
                                                    </tr>
                                                    {group.displayItems.map((item: any, i: number) => (
                                                        <tr key={i} className="border-b border-gray-200">
                                                            {mode === 'REP_SOLD_USER' && <td className="py-2 px-4 uppercase text-gray-500">{item.categoryName}</td>}
                                                            <td className="py-2 px-6 uppercase">{mode === 'REP_SOLD_USER' ? item.productName : item.name}</td>
                                                            <td className="py-2 text-center">{item.qty}</td>
                                                            <td className="py-2 text-right">{formatCurr(item.total)}</td>
                                                        </tr>
                                                    ))}
                                                    <tr>
                                                        <td className="py-2" colSpan={mode === 'REP_SOLD_USER' ? 2 : 1}></td>
                                                        <td className="py-2 text-center font-black border-t border-black">{group.groupTotalQty}</td>
                                                        <td className="py-2 text-right font-black border-t border-black">{formatCurr(group.groupTotalAmount)}</td>
                                                    </tr>
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                    <tfoot className="border-t-4 border-double border-black mt-4">
                                        <tr>
                                            {mode === 'REP_DELETED' ? (
                                                <>
                                                    <td className="py-4 font-black uppercase text-base">TOTAL ELIMINACIONES</td>
                                                    <td className="py-4 text-center font-black text-lg">{globalCount}</td>
                                                    <td colSpan={3}></td>
                                                    <td className="py-4 text-right font-black text-lg">TOTAL PÉRDIDA</td>
                                                    <td className="py-4 text-right font-black text-xl">{formatCurr(globalTotal)}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="py-4 font-black uppercase text-base" colSpan={mode === 'REP_SOLD_USER' ? 2 : 1}>TOTAL GENERAL</td>
                                                    <td className="py-4 text-center font-black text-lg">{globalCount}</td>
                                                    <td className="py-4 text-right font-black text-xl">{formatCurr(globalTotal)}</td>
                                                </>
                                            )}
                                        </tr>
                                    </tfoot>
                                </table>
                                <div className="mt-10 border-t border-gray-300 pt-4 opacity-50 text-[10px] uppercase font-bold flex justify-between">
                                    <span>Generado por: Administrador de Sistema</span>
                                    <span>Fecha de impresión: {dayjs().format('DD/MM/YYYY HH:mm')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
