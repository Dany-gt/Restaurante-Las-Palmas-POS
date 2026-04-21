import React, { useState, useEffect } from 'react';
import { Package, Search, ChevronRight, ChevronDown, Folder, Printer, FileDown, RefreshCw, Loader2, X, CheckSquare, Square, Plus, Building2, Calendar, LayoutList, History, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { DraggableWindow } from './AdminPortal';
import { supabase } from '../../supabase';
import * as XLSX from 'xlsx';
import { useNotify } from '../../hooks/useNotify';
import { ConfirmDialog } from './ConfirmDialog';

interface InventoryCategory {
    id: string;
    name: string;
    parent_id: string | null;
}

interface InventoryItem {
    id: string;
    name: string;
    category_id: string;
    cost: number;
    presentation: string;
    unit: string;
    code: string;
    conversion_factor: number;
    product_category_id?: string; // New field from DB
}

interface BranchStock {
    item_id: string;
    branch_id: string;
    quantity: number;
    min_stock: number;
}

interface InventoryStockProps {
    mode?: string;
}

export const InventoryStock: React.FC<InventoryStockProps> = ({ mode }) => {
    const notify = useNotify();
    const [categories, setCategories] = useState<InventoryCategory[]>([]);
    const [products, setProducts] = useState<InventoryItem[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [branchStocks, setBranchStocks] = useState<BranchStock[]>([]);
    const [loading, setLoading] = useState(true);

    const [isMobile, setIsMobile] = useState(false);
    const [showMobileCategories, setShowMobileCategories] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Filters
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [printSelectedCategories, setPrintSelectedCategories] = useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, row: any } | null>(null);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [selectedRowForMovement, setSelectedRowForMovement] = useState<any>(null);

    // Date for INV_STOCK_DATE
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [categorySearchQuery, setCategorySearchQuery] = useState('');

    // Category Maintenance
    const [catCtxMenu, setCatCtxMenu] = useState<{ x: number, y: number, id: string, name: string } | null>(null);
    const [showCatModal, setShowCatModal] = useState(false);
    const [editingCat, setEditingCat] = useState<InventoryCategory | null>(null);
    const [newCatName, setNewCatName] = useState('');
    const [savingCat, setSavingCat] = useState(false);
    const [showDelConfirm, setShowDelConfirm] = useState(false);
    const [catToDelete, setCatToDelete] = useState<{id:string;name:string}|null>(null);

    useEffect(() => {
        fetchData();
    }, [selectedBranch, selectedDate, mode]);

    const fetchData = async () => {
        setLoading(true);
        const [catRes, prodRes, branchRes, stockRes] = await Promise.all([
            // Use 'product_categories' and 'products' instead of legacy tables
            supabase.from('product_categories').select('*').order('nombre'),
            supabase.from('products')
                .select('id, name, product_category_id, cost_price, unit_measure, product_code, conversion_factor, presentation_unit, stock_actual')
                .eq('es_platillo', false)
                .order('name'),
            supabase.from('branches').select('id, name').order('name'),
            supabase.from('product_branch_inventory')
                .select('product_id, branch_id, quantity, min_stock')
        ]);

        const mappedCategories = (catRes.data || []).map((c: any) => ({
            id: c.id,
            name: c.nombre,
            parent_id: c.parent_id
        }));

        const mappedProducts = (prodRes.data || []).map(p => {
            const conversion = parseFloat(p.conversion_factor) || 1;
            const formattedConv = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(conversion);
            const presentacion = `${p.presentation_unit || ''} ${formattedConv} ${p.unit_measure || ''}`.trim();

            return {
                id: p.id,
                name: p.name,
                category_id: p.product_category_id || '',
                cost: parseFloat(p.cost_price || 0),
                presentation: presentacion || 'UNIDAD',
                unit: p.unit_measure || 'UN',
                code: p.product_code || '',
                conversion_factor: conversion,
                stock_actual: parseFloat(p.stock_actual || 0)
            };
        });

        setCategories(mappedCategories);
        setProducts(mappedProducts);
        setBranches(branchRes.data || []);

        let currentBranchId = selectedBranch;
        if (!currentBranchId && branchRes.data && branchRes.data.length > 0) {
            currentBranchId = branchRes.data[0].id;
            setSelectedBranch(currentBranchId);
        }

        if (mode === 'INV_STOCK_DATE' && selectedDate && currentBranchId) {
            const endOfDay = `${selectedDate}T23:59:59Z`;
            const { data: dateStocks, error: dateError } = await supabase.rpc('rpc_get_inventory_at_date', {
                p_branch_id: currentBranchId,
                p_target_date: endOfDay
            });

            if (dateStocks) {
                // Map date stocks to the format used by the component
                // Since RPC only returns item_id and quantity, we keep existing min_stock from current stock if available
                const mappedDateStocks = dateStocks.map((ds: any) => {
                    const currentStock = stockRes.data?.find(s => s.item_id === ds.item_id && s.branch_id === currentBranchId);
                    return {
                        item_id: ds.item_id,
                        branch_id: currentBranchId,
                        quantity: ds.quantity,
                        min_stock: currentStock?.min_stock || 0
                    };
                });
                setBranchStocks(mappedDateStocks);
            } else {
                setBranchStocks([]);
            }
        } else {
            const rawStocks = (stockRes.data || []).map((s: any) => ({
                item_id: s.product_id,
                branch_id: s.branch_id,
                quantity: s.quantity,
                min_stock: s.min_stock
            }));
            setBranchStocks(rawStocks);
        }

        if (catRes.data) {
            const allCatIds = new Set(catRes.data.map((c: any) => c.id));
            setExpandedCategories(allCatIds);
            setPrintSelectedCategories(allCatIds);
        }

        setLoading(false);
    };

    const toggleCategory = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const next = new Set(expandedCategories);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedCategories(next);
    };

    const handleCategoryClick = (id: string | null) => {
        if (id === null) {
            if (printSelectedCategories.size === categories.length) {
                setPrintSelectedCategories(new Set());
            } else {
                setPrintSelectedCategories(new Set(categories.map(c => c.id)));
            }
        } else {
            togglePrintCategory(id);
        }
    };

    const togglePrintCategory = (id: string) => {
        // If everything is currently selected (Catálogo Completo mode), 
        // clicking a specific category means the user wants to exclusively select it (SOLO select).
        if (printSelectedCategories.size === categories.length) {
            const next = new Set<string>();
            next.add(id);
            const setAllChildren = (parentId: string, check: boolean) => {
                const children = categories.filter(c => c.parent_id === parentId);
                children.forEach(c => {
                    if (check) next.add(c.id);
                    setAllChildren(c.id, check);
                });
            };
            setAllChildren(id, true);
            setPrintSelectedCategories(next);
            return;
        }

        const next = new Set(printSelectedCategories);
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
        setPrintSelectedCategories(next);
    };

    const handleSaveCategory = async () => {
        if (!newCatName.trim() || !editingCat) return;
        setSavingCat(true);
        try {
            const { error } = await supabase
                .from('product_categories')
                .update({ nombre: newCatName.trim().toUpperCase() })
                .eq('id', editingCat.id);
            
            if (error) throw error;
            
            await fetchData();
            setShowCatModal(false);
            setEditingCat(null);
            setNewCatName('');
            notify.success("Categoría actualizada correctamente");
        } catch (e: any) {
            notify.error("Error al editar categoría: " + e.message);
        } finally {
            setSavingCat(false);
        }
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        setCatCtxMenu(null);
        // Verificar si hay productos vinculados
        const { count, error: countErr } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('product_category_id', id);

        if (countErr) {
            notify.error("Error al verificar integridad: " + countErr.message);
            return;
        }

        if (count && count > 0) {
            notify.alert(`No se puede eliminar "${name}" porque tiene ${count} productos asociados.`);
            return;
        }

        setCatToDelete({ id, name });
        setShowDelConfirm(true);
    };

    const confirmDeleteCategory = async () => {
        if (!catToDelete) return;
        const { id, name } = catToDelete;
        setShowDelConfirm(false);

        try {
            const { error } = await supabase.from('product_categories').delete().eq('id', id);
            if (error) throw error;
            
            notify.success(`Categoría "${name}" eliminada correctamente`);
            await fetchData();
        } catch (e: any) {
            notify.error("Error al eliminar categoría: " + e.message);
        } finally {
            setCatToDelete(null);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, row: any) => {
        e.preventDefault();
        const container = e.currentTarget.closest('.inventory-stock-root');
        if (container) {
            const rect = container.getBoundingClientRect();
            setContextMenu({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                row
            });
        } else {
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                row
            });
        }
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const renderCategoryTree = (parentId: string | null = null, depth = 0) => {
        const children = categories
            .filter(c => c.parent_id === parentId)
            .filter(c => !categorySearchQuery || c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()));

        return children.map(cat => {
            const hasChildren = categories.some(c => c.parent_id === cat.id);
            const isExpanded = expandedCategories.has(cat.id);
            const isSelected = printSelectedCategories.size < categories.length && printSelectedCategories.has(cat.id);
            const isParent = depth === 0;

            return (
                <React.Fragment key={cat.id}>
                    <div
                        className={`flex items-center cursor-pointer transition-none select-none
                            ${isSelected ? 'bg-transparent' : 'hover:bg-[#f0f0f0] bg-white'}`}
                        style={{ height: isParent ? 26 : 22 }}
                        onClick={() => togglePrintCategory(cat.id)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCatCtxMenu({ x: e.clientX, y: e.clientY, id: cat.id, name: cat.name });
                        }}
                    >
                        {/* Gutter (Icon Area) */}
                        <div className="w-[34px] h-full flex items-center justify-center shrink-0 border-r border-gray-300">
                            {isSelected && <span className="text-[#106ebe] text-[9px] mr-0.5">►</span>}
                            {hasChildren && (
                                <span 
                                    className="text-[8px] text-gray-500 hover:text-[#106ebe]"
                                    onClick={(e) => { e.stopPropagation(); toggleCategory(cat.id); }}
                                >
                                    {isExpanded ? '▾' : '▸'}
                                </span>
                            )}
                        </div>

                        {/* Name Area */}
                        <div className={`flex-1 h-full flex items-center pl-2 ${isSelected ? 'bg-[#106ebe]' : ''}`}>
                             <span className={`truncate leading-none uppercase pr-1 ${
                                isParent ? 'text-[11px] font-black tracking-wide' : 'text-[10px]'
                            } ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                {cat.name}
                            </span>
                        </div>
                    </div>
                    {hasChildren && isExpanded && (
                        <div className="bg-[#fafafa]">
                            {renderCategoryTree(cat.id, depth + 1)}
                        </div>
                    )}
                </React.Fragment>
            );
        });
    };

    const getSubCategoryIds = (catId: string): string[] => {
        const subCats = categories.filter(c => c.parent_id === catId);
        let ids = [catId];
        subCats.forEach(sc => {
            ids = [...ids, ...getSubCategoryIds(sc.id)];
        });
        return ids;
    };

    let filteredProducts = products;
    let viewCatIds: string[] = [];
    printSelectedCategories.forEach(cid => {
        viewCatIds.push(cid);
        viewCatIds = viewCatIds.concat(getSubCategoryIds(cid).filter(id => id !== cid));
    });
    viewCatIds = Array.from(new Set(viewCatIds));

    if (printSelectedCategories.size === 0) {
        filteredProducts = [];
    } else {
        filteredProducts = filteredProducts.filter(p => viewCatIds.includes(p.category_id));
    }

    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filteredProducts = filteredProducts.filter(p => p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q)));
    }

    filteredProducts.sort((a, b) => a.name.localeCompare(b.name));

    const tableRows = filteredProducts.map(product => {
        const branchStock = branchStocks.find(bs => bs.item_id === product.id && bs.branch_id === selectedBranch);
        
        // SINCRO: Prioridad absoluta al stock de la base de productos para paridad con botón "Productos"
        const totalStock = product.stock_actual; 
        const minStock = branchStock ? branchStock.min_stock : 0;
        const factor = product.conversion_factor || 1;
        return {
            ...product,
            totalStock: totalStock,
            minStock: minStock,
            existencia: totalStock, // Show raw absolute units
            costoTotal: totalStock * product.cost
        };
    }).filter(row => {
        if (mode === 'INV_STOCK_REORDER') {
            return row.totalStock <= row.minStock;
        }
        return true;
    });

    const handleExportExcel = () => {
        const exportData = tableRows.map(row => ({
            'Código': row.code || '--',
            'Producto': row.name,
            'Existencia': row.existencia,
            'Presentación': row.presentation || '—',
            'Costo': row.cost,
            'Costo Total': row.costoTotal
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Existencias");
        XLSX.writeFile(wb, `Existencias_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handlePrintPDF = () => {
        const branchName = branches.find(b => b.id === selectedBranch)?.name || 'Todas';
        const topLevelCats = categories.filter(c => !c.parent_id);

        let printContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 20px; letter-spacing: 1px;">REPORTE DE EXISTENCIAS</h2>
                    <h3 style="margin: 5px 0 0; color: #555; font-size: 14px; font-weight: normal;">SUCURSAL: <b>${branchName.toUpperCase()}</b></h3>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; text-align: left; border-bottom: 2px solid #cbd5e1;">
                            <th style="padding: 10px 8px;">Código</th>
                            <th style="padding: 10px 8px;">Producto</th>
                            <th style="padding: 10px 8px; text-align: right;">Existencia</th>
                            <th style="padding: 10px 8px; text-align: center;">Presentación</th>
                            <th style="padding: 10px 8px; text-align: right;">Costo</th>
                            <th style="padding: 10px 8px; text-align: right;">Costo Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        topLevelCats.forEach(cat => {
            if (!printSelectedCategories.has(cat.id)) return;
            const catIds = getSubCategoryIds(cat.id);
            const catProducts = tableRows.filter(r => catIds.includes(r.category_id));

            if (catProducts.length > 0) {
                printContent += `
                    <tr>
                        <td colspan="6" style="padding: 12px 8px 8px; background-color: #f8fafc; font-weight: bold; border-bottom: 1px solid #e2e8f0; color: #475569; letter-spacing: 1px; font-size: 10px;">
                            ${cat.name.toUpperCase()}
                        </td>
                    </tr>
                `;
                catProducts.forEach(r => {
                    printContent += `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px;">${r.code || '--'}</td>
                            <td style="padding: 8px;">${r.name}</td>
                            <td style="padding: 8px; text-align: right; font-weight: bold; ${r.existencia <= 0 ? 'color: #ef4444;' : 'color: #0f172a;'}">${r.existencia.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: center; color: #64748b;">${r.presentation || '—'}</td>
                            <td style="padding: 8px; text-align: right; color: #64748b;">Q${r.cost.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: right; font-weight: bold; color: #4f46e5;">Q${r.costoTotal.toFixed(2)}</td>
                        </tr>
                    `;
                });
            }
        });

        const totalValue = tableRows.reduce((acc, r) => acc + r.costoTotal, 0);

        printContent += `
                    </tbody>
                </table>
                <div style="margin-top: 30px; text-align: right;">
                    <span style="font-size: 12px; color: #64748b; margin-right: 10px; text-transform: uppercase;">Valor Inventario Mostrado:</span>
                    <span style="font-size: 18px; font-weight: bold; color: #4f46e5;">Q${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`<html><head><title>Reporte</title></head><body onload="window.print()">${printContent}</body></html>`);
            printWindow.document.close();
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-800" size={40} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden font-['Montserrat'] relative inventory-stock-root">
            {/* Header Bar */}


            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar */}
                <div className="w-[280px] shrink-0 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
                    {/* Categorías Header - Premium Style */}
                    <div className="bg-[#f0f0f0] h-[24px] flex items-center border-b border-gray-400 shrink-0">
                        <div className="w-[34px] h-full border-r border-gray-300" />
                        <span className="pl-2 text-[10px] font-bold text-slate-700 uppercase tracking-tight">Categoría</span>
                    </div>

                    {/* Category Search Input */}
                    <div className="px-1 py-1 border-b border-gray-300 bg-[#f8f8f8]">
                        <div className="flex items-center bg-white border border-gray-300">
                            <div className="px-2 text-slate-400 border-r border-gray-300 bg-gray-50 text-[10px] h-full flex items-center">
                                Categoría
                            </div>
                            <input
                                type="text"
                                value={categorySearchQuery}
                                onChange={(e) => setCategorySearchQuery(e.target.value)}
                                className="w-full px-2 py-0.5 text-[10px] font-bold text-slate-700 outline-none"
                                placeholder="..."
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
                        <button
                            onClick={() => setPrintSelectedCategories(new Set(categories.map(c => c.id)))}
                            className={`w-full flex items-center transition-none text-left h-[28px] border-b border-gray-300 select-none
                                ${printSelectedCategories.size === categories.length && categories.length > 0
                                ? 'bg-transparent'
                                : 'bg-white hover:bg-[#f0f0f0]'
                                }`}
                        >
                            <div className="w-[34px] h-full flex items-center justify-center shrink-0 border-r border-gray-300">
                                {printSelectedCategories.size === categories.length && (
                                    <span className="text-[#106ebe] text-[9px]">►</span>
                                )}
                            </div>
                            <div className={`flex-1 h-full flex items-center pl-2 ${printSelectedCategories.size === categories.length ? 'bg-[#106ebe]' : ''}`}>
                                <span className={`text-[11px] font-black uppercase tracking-tight ${
                                    printSelectedCategories.size === categories.length ? 'text-white' : 'text-slate-600'
                                }`}>
                                    CATÁLOGO COMPLETO
                                </span>
                            </div>
                        </button>
                        <div className="py-1">
                            {renderCategoryTree(null)}
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="flex-1 flex flex-col bg-white overflow-hidden">
                    {/* Header de contenido */}
                    {/* Legacy Stats Bar (as seen in screenshot) */}
                    <div className="px-1 py-1.5 bg-[#f0f0f0] border-b border-gray-300 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-gray-300 rounded-sm">
                                <span className="text-[10px] font-bold text-slate-800 tracking-tight">Sucursal</span>
                                <select
                                    value={selectedBranch}
                                    onChange={e => setSelectedBranch(e.target.value)}
                                    className="bg-transparent outline-none text-[10px] font-bold text-slate-700 min-w-[150px] cursor-pointer"
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            {mode === 'INV_STOCK_DATE' && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-gray-300 rounded-sm">
                                    <span className="text-[10px] font-bold text-slate-800 tracking-tight">Fecha</span>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="bg-transparent outline-none text-[10px] font-bold text-slate-700 cursor-pointer"
                                    />
                                </div>
                            )}

                            {mode === 'INV_STOCK_DATE' ? (
                                <button
                                    onClick={fetchData}
                                    className="bg-white border border-gray-300 px-4 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm uppercase tracking-widest active:bg-blue-50 transition-all border-dashed"
                                >
                                    Generar
                                </button>
                            ) : (
                                <button
                                    onClick={handlePrintPDF}
                                    className="bg-white border border-gray-300 px-4 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
                                >
                                    Imprimir / Exportar
                                </button>
                            )}

                            <button
                                onClick={fetchData}
                                className="bg-white border border-gray-300 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-[#0078d7] hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                                title="Refrescar Datos"
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Sub-Header Title with Search Integrated */}
                    <div className="px-4 py-1 bg-[#f0f0f0] border-b border-gray-300 flex items-center justify-between shrink-0">
                        <h3 className="text-[14px] font-bold text-[#106ebe] tracking-tight">Listado de Productos</h3>

                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-white border border-gray-400 px-2 py-0.5 text-[11px] font-bold text-slate-700 w-64 outline-none focus:border-blue-500"
                                placeholder="Introduzca el texto a buscar..."
                            />
                            <button className="bg-white border border-gray-400 px-3 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">Buscar</button>
                        </div>
                    </div>





                    {/* Data Table */}
                    <div className="flex-1 overflow-auto custom-scrollbar border-l border-gray-100 bg-white">
                        <table className="w-full text-left border-collapse select-none">
                            <thead className="sticky top-0 bg-[#f1f5f9] border-b border-gray-400 z-30">
                                <tr className="h-7">
                                    <th className="px-3 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300">Categoría</th>
                                    <th className="px-3 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300">Producto</th>
                                    <th className="px-3 text-center w-28 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300">Existencia</th>
                                    {mode !== 'INV_STOCK_DATE' && (
                                        <th className="px-3 text-center w-28 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300">Punto Reorden</th>
                                    )}
                                    <th className="px-3 text-center w-40 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300">Presentación</th>
                                    <th className="px-3 text-center w-32 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300">Existencia Total</th>
                                    <th className="px-3 text-right w-24 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300">Costo</th>
                                    <th className="px-3 text-right w-32 text-[11px] font-bold text-slate-700 uppercase">Costo Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={mode === 'INV_STOCK_DATE' ? 7 : 8} className="py-20 text-center bg-white">
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No hay datos para mostrar</span>
                                        </td>
                                    </tr>
                                ) : tableRows.map((row, idx) => (
                                    <tr
                                        key={row.id}
                                        onContextMenu={(e) => handleContextMenu(e, row)}
                                        className={`h-7 border-b border-gray-200 transition-colors cursor-default select-none group relative ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f4f4f4]'} hover:bg-[#cce8ff]`}
                                    >
                                        <td className="px-3 border-r border-gray-200 text-[10px] font-bold text-slate-900 uppercase truncate group-hover:bg-[#cce8ff]">
                                            {categories.find(c => c.id === row.category_id)?.name || '--'}
                                        </td>
                                        <td className="px-3 border-r border-gray-200 text-[10px] font-bold text-slate-900 uppercase truncate group-hover:bg-[#cce8ff]">
                                            {row.name}
                                        </td>
                                        <td className="px-3 text-center border-r border-gray-200 text-[11px] font-bold tabular-nums text-slate-800">
                                            {row.totalStock.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </td>
                                        {mode !== 'INV_STOCK_DATE' && (
                                            <td className="px-3 text-center border-r border-gray-200 text-[11px] font-bold text-slate-800 tabular-nums">
                                                {row.minStock.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </td>
                                        )}
                                        <td className="px-3 border-r border-gray-200 text-[10px] font-bold text-slate-800 uppercase truncate">
                                            {row.presentation}
                                        </td>
                                        <td className="px-3 text-center border-r border-gray-200 text-[11px] font-bold tabular-nums text-slate-800">
                                            {row.totalStock.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 text-right border-r border-gray-200 text-[11px] font-bold text-slate-800 tabular-nums">
                                            Q{row.cost.toFixed(2)}
                                        </td>
                                        <td className="px-3 text-right text-[11px] font-bold text-slate-900 tabular-nums">
                                            Q{row.costoTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer resumen */}
                    <div className="px-4 py-2 bg-slate-50/50 border-t border-gray-200 flex justify-between items-center shrink-0">
                        <div className="flex gap-6">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Ítems</span>
                                <span className="text-[11px] font-black text-slate-800">{tableRows.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="absolute z-[1000] bg-white border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] rounded-md py-1 min-w-[180px] overflow-hidden"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        onClick={() => {
                            setSelectedRowForMovement(contextMenu.row);
                            setShowMovementModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-gray-50 uppercase tracking-tighter"
                    >
                        <History size={14} className="text-indigo-500" />
                        Movimiento del Producto
                    </button>
                    <button
                        onClick={() => {
                            // En el futuro: Editar producto
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold text-slate-400 hover:bg-slate-50 transition-colors uppercase tracking-tighter cursor-not-allowed"
                    >
                        <Package size={14} className="text-slate-300" />
                        Ver Ficha Técnica
                    </button>
                </div>
            )}

            {/* Product Movement Modal */}
            {showMovementModal && selectedRowForMovement && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <ProductMovementModal
                            product={selectedRowForMovement}
                            branchId={selectedBranch}
                            branchName={branches.find(b => b.id === selectedBranch)?.name || ''}
                            onClose={() => setShowMovementModal(false)}
                        />
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* Cat Maintenance Modal */}
            {showCatModal && editingCat && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-black/10 pointer-events-auto">
                    <DraggableWindow id="cat-maintenance">
                        <div className="w-[320px] bg-[#f0f0f0] border border-[#106ebe] shadow-2xl flex flex-col pointer-events-auto">
                            <div className="bg-[#106ebe] h-8 px-3 flex justify-between items-center text-white shrink-0 cursor-move modal-header">
                                <div className="flex items-center gap-2">
                                    <Folder size={14} />
                                    <span className="text-[11px] font-bold uppercase">Editar Categoría</span>
                                </div>
                                <button onClick={() => setShowCatModal(false)} className="hover:bg-red-500 h-full px-2">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-4 flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre de Categoría</label>
                                    <input 
                                        type="text"
                                        value={newCatName}
                                        onChange={e => setNewCatName(e.target.value.toUpperCase())}
                                        className="w-full h-7 border border-gray-300 px-2 text-[11px] font-bold outline-none focus:border-[#106ebe]"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowCatModal(false)} className="px-4 py-1 text-[11px] font-bold bg-white border border-gray-400 hover:bg-gray-100 uppercase">Cancelar</button>
                                    <button 
                                        onClick={handleSaveCategory}
                                        disabled={savingCat || !newCatName.trim()}
                                        className="px-5 py-1 bg-[#106ebe] text-white text-[11px] font-bold hover:bg-[#0d5aa0] disabled:opacity-50 uppercase flex items-center gap-2"
                                    >
                                        {savingCat && <Loader2 size={12} className="animate-spin" />}
                                        {savingCat ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* Category Context Menu */}
            {catCtxMenu && createPortal(
                <div className="fixed inset-0 z-[250000] pointer-events-auto" onContextMenu={(e) => e.preventDefault()}>
                    <div className="absolute inset-0 bg-transparent" onClick={() => setCatCtxMenu(null)} />
                    <div className="fixed z-[250001] bg-[#f0f0f0] border border-gray-400 shadow-[0_10px_25px_rgba(0,0,0,0.2)] py-0.5 w-36 select-none animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: catCtxMenu.y, left: catCtxMenu.x }}>
                        <button onClick={() => { 
                            setEditingCat(categories.find(c => c.id === catCtxMenu.id) || null);
                            setNewCatName(catCtxMenu.name);
                            setShowCatModal(true);
                            setCatCtxMenu(null);
                        }} className="w-full h-6 flex items-center gap-2 px-3 hover:bg-[#106ebe] hover:text-white text-[11px] text-slate-700">
                            <Pencil size={11} /> Editar
                        </button>
                        <div className="h-px bg-gray-300 my-0.5" />
                        <button onClick={() => { fetchData(); setCatCtxMenu(null); }}
                            className="w-full h-6 flex items-center gap-2 px-3 hover:bg-[#106ebe] hover:text-white text-[11px] text-slate-700">
                            <RefreshCw size={11} /> Refrescar
                        </button>
                        <button onClick={() => handleDeleteCategory(catCtxMenu.id, catCtxMenu.name)}
                            className="w-full h-6 flex items-center gap-2 px-3 hover:bg-red-500 hover:text-white text-[11px] text-red-600">
                            <Trash2 size={11} /> Eliminar
                        </button>
                    </div>
                </div>, document.body
            )}

            {/* Confirm Category Delete Dialog */}
            <ConfirmDialog 
                isOpen={showDelConfirm}
                title="Eliminar Categoría"
                message={`¿Estás seguro de eliminar la categoría "${catToDelete?.name}"?`}
                description="Esta acción eliminará la categoría permanentemente del catálogo."
                type="danger"
                onConfirm={confirmDeleteCategory}
                onCancel={() => { setShowDelConfirm(false); setCatToDelete(null); }}
            />
        </div>
    );
};

// Sub-component for the Movement Modal to keep things clean
interface MovementModalProps {
    product: any;
    branchId: string;
    branchName: string;
    onClose: () => void;
}

const ProductMovementModal: React.FC<MovementModalProps> = ({ product, branchId, branchName, onClose }) => {
    const [movements, setMovements] = useState<any[]>([]);
    const [orderNumbers, setOrderNumbers] = useState<Record<string, string>>({}); // Mapping orderId -> friendlyNumber
    const [orderStatuses, setOrderStatuses] = useState<Record<string, string>>({}); // Mapping orderId -> status
    const [loading, setLoading] = useState(true);
    const getLocalTime = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(getLocalTime());
    const [endDate, setEndDate] = useState(getLocalTime());
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchMovements();
    }, [branchId, product.id, startDate, endDate]);

    const fetchMovements = async () => {
        setLoading(true);
        const { data: kardexData, error } = await supabase
            .from('inventory_kardex')
            .select('*')
            .eq('item_id', product.id)
            .eq('branch_id', branchId)
            .gte('created_at', startDate + 'T00:00:00')
            .lte('created_at', endDate + 'T23:59:59')
            .order('created_at', { ascending: false });

        if (!error && kardexData) {
            setMovements(kardexData);

            const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
            const foundIds = new Set<string>();

            kardexData.forEach(m => {
                if (m.reference) {
                    const match = m.reference.match(uuidPattern);
                    if (match) foundIds.add(match[0].toLowerCase());
                }
            });

            if (foundIds.size > 0) {
                const idList = Array.from(foundIds);
                const mapping: Record<string, string> = {};

                // 1. Try to find these IDs directly in orders
                const { data: directOrders } = await supabase
                    .from('orders')
                    .select('id, order_number, status')
                    .in('id', idList);

                if (directOrders) {
                    directOrders.forEach(o => {
                        mapping[o.id.toLowerCase()] = o.order_number?.toString() || '--';
                        setOrderStatuses(prev => ({ ...prev, [o.id.toLowerCase()]: o.status?.toUpperCase() || '' }));
                    });
                }

                // 2. Try to find missing IDs in order_items (many kardex entries point to item_id)
                const missingIds = idList.filter(id => !mapping[id]);
                if (missingIds.length > 0) {
                    const { data: itemData } = await supabase
                        .from('order_items')
                        .select('id, order_id, orders(order_number, status)')
                        .in('id', missingIds);

                    if (itemData) {
                        itemData.forEach((it: any) => {
                            const num = it.orders?.order_number?.toString();
                            if (num) {
                                mapping[it.id.toLowerCase()] = num;
                                setOrderStatuses(prev => ({ ...prev, [it.id.toLowerCase()]: it.orders?.status?.toUpperCase() || '' }));
                            }
                        });
                    }
                }

                setOrderNumbers(prev => ({ ...prev, ...mapping }));
            }
        }
        setLoading(false);
    };

    const filteredMovements = movements.filter(m =>
        m.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.movement_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-[#f0f0f0] w-full max-w-4xl shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-hidden border border-[#106ebe] flex flex-col max-h-[90vh] pointer-events-auto">
            {/* Windows Style Header */}
            <div className="modal-header bg-[#106ebe] px-4 h-9 flex items-center justify-between text-white shrink-0 select-none cursor-move active:cursor-grabbing">
                <div className="flex items-center gap-2">
                    <History size={16} className="text-blue-100" />
                    <span className="text-[11px] font-black uppercase tracking-widest italic">Movimientos de Producto</span>
                </div>
                <button onClick={onClose} className="hover:bg-red-500 w-9 h-9 flex items-center justify-center transition-colors group">
                    <X size={18} className="text-white" />
                </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                {/* Datos de Producto Section */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest underline decoration-blue-500 decoration-2 underline-offset-4">Datos de Producto</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 bg-white/50 p-4 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-3">
                            <label className="text-[9px] font-black text-slate-500 uppercase w-20">Producto</label>
                            <div className="flex-1 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-[10px] font-bold text-blue-800 shadow-sm">{product.name}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-[9px] font-black text-slate-500 uppercase w-20">Presentación</label>
                            <div className="flex-1 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-[10px] font-bold text-slate-700 shadow-sm">{product.presentation || '—'}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-[9px] font-black text-slate-500 uppercase w-20">Unidad</label>
                            <div className="flex-1 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-[10px] font-bold text-slate-700 shadow-sm">{product.unit || '—'}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-[9px] font-black text-slate-500 uppercase w-20">Sucursal</label>
                            <div className="flex-1 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-[10px] font-bold text-slate-700 shadow-sm">{branchName}</div>
                        </div>
                    </div>
                </div>

                {/* Detalle Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-300 pb-2">
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest underline decoration-blue-500 decoration-2 underline-offset-4">Detalle</span>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 shadow-sm">
                                <span className="text-[9px] font-black text-slate-400 uppercase">Del</span>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[9px] font-bold outline-none bg-transparent" />
                                <span className="text-[9px] font-black text-slate-400 uppercase">Al</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[9px] font-bold outline-none bg-transparent" />
                            </div>
                            <button
                                onClick={fetchMovements}
                                className="bg-[#106ebe] text-white px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md active:scale-95 flex items-center gap-2"
                            >
                                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Generar
                            </button>
                        </div>
                    </div>

                    {/* Search Bar Detail */}
                    <div className="relative max-w-sm">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="BUSCAR POR REFERENCIA O DESCRIPCIÓN..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-[9px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 transition-all uppercase"
                        />
                    </div>

                    {/* Grid Data */}
                    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden flex flex-col min-h-[400px]">
                        <div className="overflow-auto max-h-[400px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-[#f1f5f9] border-b border-gray-300 z-10 shadow-sm">
                                    <tr className="h-9 font-['Montserrat']">
                                        <th className="px-4 text-[9px] font-black text-slate-500 uppercase border-r border-gray-200">Fecha</th>
                                        <th className="px-4 text-[9px] font-black text-slate-500 uppercase border-r border-gray-200 text-center">Número Orden</th>
                                        <th className="px-4 text-[9px] font-black text-slate-500 uppercase border-r border-gray-200">Descripción</th>
                                        <th className="px-4 text-center text-[9px] font-black text-emerald-600 uppercase border-r border-gray-200">Entrada</th>
                                        <th className="px-4 text-center text-[9px] font-black text-rose-600 uppercase border-r border-gray-200">Salida</th>
                                        <th className="px-4 text-right text-[9px] font-black text-slate-800 uppercase">Existencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="py-32 text-center">
                                                <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">Cargando movimientos...</p>
                                            </td>
                                        </tr>
                                    ) : filteredMovements.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-32 text-center">
                                                <History size={32} className="text-gray-200 mx-auto" />
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">No se encontraron movimientos</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredMovements.map((move, minIdx) => {
                                            const factor = product.conversion_factor || 1;
                                            const cleanType = move.movement_type?.split('(')[0].trim().toUpperCase() || 'MOVIMIENTO';

                                            // Extract number from reference (e.g. "ORDEN #530" -> "530")
                                            let orderNum = '--';
                                            let isCancelled = false;
                                            if (move.reference) {
                                                const cleanRef = move.reference.trim();
                                                const uuidMatch = cleanRef.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

                                                if (uuidMatch) {
                                                    const uuid = uuidMatch[0].toLowerCase();
                                                    if (orderNumbers[uuid]) {
                                                        orderNum = orderNumbers[uuid];
                                                    }
                                                    if (orderStatuses[uuid] === 'CANCELLED' || orderStatuses[uuid] === 'ANULADO') {
                                                        isCancelled = true;
                                                    }
                                                } else if (cleanRef.includes('#')) {
                                                    orderNum = cleanRef.split('#')[1].trim();
                                                } else {
                                                    const digitMatch = cleanRef.match(/\d+/);
                                                    if (digitMatch) orderNum = digitMatch[0];
                                                }
                                            }

                                            const displayType = isCancelled ? cleanType + ' (ANULADA)' : cleanType;
                                            const typeColor = isCancelled ? 'text-rose-600 font-black' : (cleanType === 'VENTA' ? 'text-slate-900 font-bold' : '');

                                            return (
                                                <tr key={move.id} className={`h-10 hover:bg-blue-50/50 transition-colors ${minIdx % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                                                    <td className="px-4 text-[10px] font-bold text-slate-600 border-r border-gray-100">
                                                        {new Date(move.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-4 text-[11px] font-black text-blue-700 text-center border-r border-gray-100 bg-blue-50/5">
                                                        {orderNum}
                                                    </td>
                                                    <td className="px-4 text-[10px] font-bold text-slate-700 border-r border-gray-100 uppercase tracking-tighter">
                                                        <span className={typeColor}>{displayType}</span>
                                                    </td>
                                                    <td className="px-4 text-center text-[10px] font-black text-emerald-600 border-r border-gray-100 bg-emerald-50/20 tabular-nums">
                                                        {move.quantity_in > 0 ? Math.round(move.quantity_in).toLocaleString() : '—'}
                                                    </td>
                                                    <td className="px-4 text-center text-[10px] font-black text-rose-600 border-r border-gray-100 bg-rose-50/20 tabular-nums">
                                                        {move.quantity_out > 0 ? Math.round(move.quantity_out).toLocaleString() : '—'}
                                                    </td>
                                                    <td className="px-4 text-right text-[10px] font-black text-slate-900 tabular-nums bg-gray-50/50">
                                                        {Math.round(move.balance).toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Footer Windows Style */}
            <div className="bg-[#e8e8e8] px-6 py-3 border-t border-gray-300 flex justify-end gap-3 shrink-0 shadow-[inset_0_1px_0_#fff]">
                <button
                    onClick={onClose}
                    className="bg-white border-2 border-slate-300 text-slate-700 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:border-slate-400 active:translate-y-px transition-all shadow-sm"
                >
                    Cerrar Ventana
                </button>
                <button
                    className="bg-[#106ebe] text-white px-8 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-[2px_2px_0_rgba(0,0,0,0.2)] active:translate-y-px"
                >
                    Exportar Reporte
                </button>
            </div>
        </div>
    );
};
