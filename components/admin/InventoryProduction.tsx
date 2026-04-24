import React, { useState, useEffect } from 'react';
import { Package, Search, ChevronRight, ChevronDown, Folder, Printer, FileDown, RefreshCw, Loader2, X, CheckSquare, Square, Plus, Building2, Calendar, ClipboardList, Check, RotateCcw } from 'lucide-react';
import { supabase } from '../../supabase';
import * as XLSX from 'xlsx';
import { ProductionOrderModal } from './ProductionOrderModal';

export const InventoryProduction: React.FC = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Dates for filtering
    const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalOrder, setModalOrder] = useState<any>(null);

    // Selection State
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    // Container Ref for coordinate calculation
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, row: any } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, row: any) => {
        e.preventDefault();
        e.stopPropagation();

        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        let posX = e.clientX - rect.left;
        let posY = e.clientY - rect.top;

        // Ensure menu stays within container boundaries
        const menuWidth = 160;
        const menuHeight = row ? 80 : 40;

        if (posX + menuWidth > rect.width) posX -= menuWidth;
        if (posY + menuHeight > rect.height) posY -= menuHeight;

        // If row is passed, select it. If not, use the existing selection for "Editar"
        if (row) {
            setSelectedOrderId(row.id);
        }

        setContextMenu({ x: Math.max(0, posX), y: Math.max(0, posY), row: row || orders.find(o => o.id === selectedOrderId) });
    };

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        handleResize();
        window.addEventListener('resize', handleResize);

        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        fetchInitialData();
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('click', handleClick);
        };
    }, []);

    const fetchInitialData = async () => {
        const { data: branchData } = await supabase.from('branches').select('id, name').order('name');
        if (branchData) {
            setBranches(branchData);
            if (branchData.length > 0) {
                setSelectedBranch(branchData[0].id);
            }
        }
    };

    // Auto-fetch orders when branch loads
    useEffect(() => {
        if (selectedBranch) fetchOrders();
    }, [selectedBranch]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            // Fetch orders for selected branch OR orders without branch assigned
            let query = supabase
                .from('inventory_production_orders')
                .select('id, code, date, status, created_by, total_cost, processed, voided, produced_item_id, produced_quantity, branch_id')
                .gte('date', fromDate)
                .lte('date', toDate)
                .order('created_at', { ascending: false });

            // If branch is selected, show that branch + null branch orders
            if (selectedBranch) {
                query = query.or(`branch_id.eq.${selectedBranch},branch_id.is.null`);
            }

            const { data, error } = await query;
            if (error) throw error;

            const rawOrders = data || [];

            // Secondary lookup: get product names for produced items
            const producedIds = rawOrders
                .map((o: any) => o.produced_item_id)
                .filter(Boolean);

            let productNameMap: Record<string, string> = {};
            if (producedIds.length > 0) {
                const { data: prods } = await supabase
                    .from('products')
                    .select('id, name')
                    .in('id', producedIds);
                if (prods) {
                    prods.forEach((p: any) => { productNameMap[p.id] = p.name; });
                }
                // Also try inventory_items
                const { data: invItems } = await supabase
                    .from('inventory_items')
                    .select('id, name')
                    .in('id', producedIds);
                if (invItems) {
                    invItems.forEach((p: any) => {
                        if (!productNameMap[p.id]) productNameMap[p.id] = p.name;
                    });
                }
            }

            // Merge names into orders
            const enrichedOrders = rawOrders.map((o: any) => ({
                ...o,
                produced_item_name: o.produced_item_id ? (productNameMap[o.produced_item_id] || null) : null
            }));

            setOrders(enrichedOrders);
        } catch (err: any) {
            console.error('Fetch Orders error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(orders);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Produccion");
        XLSX.writeFile(wb, "OrdenesProduccion.xlsx");
    };

    return (
        <div
            ref={containerRef}
            className="flex flex-col h-full bg-white overflow-hidden font-['Montserrat'] relative"
        >

            {/* Toolbar Area */}
            <div className="flex flex-col shrink-0 border-b border-gray-300">
                {/* Branch Selection Bar */}
                <div className="bg-[#f0f0f0] border-b border-gray-300 px-1 py-1.5 flex items-center">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-gray-300 rounded-sm">
                        <span className="text-[10px] font-bold text-slate-800 tracking-tight">Sucursal</span>
                        <select
                            value={selectedBranch}
                            onChange={e => setSelectedBranch(e.target.value)}
                            className="bg-transparent outline-none text-[10px] font-bold text-slate-700 min-w-[250px] cursor-pointer"
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Date Filter Bar */}
                <div className="bg-[#f0f0f0] border-b border-gray-300 px-1 py-1 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        {/* Title group */}
                        <div className="px-3 py-0.5 bg-[#e0e0e0] border border-gray-300 rounded-sm mr-2 shadow-[inset_0_1px_0_#fff]">
                            <span className="text-[11px] font-bold text-slate-700">Fechas</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-gray-300 rounded-sm">
                            <span className="text-[10px] font-bold text-slate-800 tracking-tight">Del:</span>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="bg-transparent outline-none text-[10px] font-bold text-slate-700 cursor-pointer"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-gray-300 rounded-sm">
                            <span className="text-[10px] font-bold text-slate-800 tracking-tight">Al:</span>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="bg-transparent outline-none text-[10px] font-bold text-slate-700 cursor-pointer"
                            />
                        </div>

                        <button
                            onClick={fetchOrders}
                            className="ml-2 bg-white border border-gray-400 px-8 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm active:scale-95 transition-all outline-none focus:ring-1 focus:ring-blue-400"
                        >
                            Generar
                        </button>

                        <button
                            onClick={handleExportExcel}
                            className="ml-4 bg-white border border-gray-300 px-4 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
                        >
                            Imprimir / Exportar
                        </button>
                    </div>

                    <button
                        onClick={fetchOrders}
                        className="bg-white border border-gray-300 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-[#0078d7] hover:bg-slate-50 shadow-sm transition-all active:scale-95 mr-2"
                        title="Refrescar Datos"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Search Bar Row Only */}
            <div className="bg-[#f0f0f0] border-b border-gray-300 flex items-center justify-end shrink-0 px-2 py-1">
                <div className="flex items-center gap-1">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-white border border-gray-400 px-2 py-0.5 text-[11px] font-bold text-slate-700 w-64 outline-none focus:border-blue-500"
                        placeholder="Introduzca el texto a buscar..."
                    />
                    <button className="bg-white border border-gray-400 px-4 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">Buscar</button>
                </div>
            </div>

            {/* Main Data Grid */}
            <div
                className="flex-1 overflow-auto custom-scrollbar bg-white"
                onContextMenu={(e) => handleContextMenu(e, null)}
            >
                <table className="w-full text-left border-collapse select-none min-w-[1000px]">
                    <thead className="sticky top-0 bg-[#f1f5f9] border-b border-gray-400 z-30 shadow-sm">
                        <tr className="h-9">
                            <th className="px-3 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300 text-center w-32">Fecha</th>
                            <th className="px-3 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300">No. / Código</th>
                            <th className="px-3 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300 w-[20%]">Producto Producido</th>
                            <th className="px-3 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300">Creado Por</th>
                            <th className="px-3 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300 text-center w-32">Total Costo</th>
                            <th className="px-3 text-[11px] font-bold text-slate-700 uppercase border-r border-gray-300 text-center w-32 text-nowrap">Procesado</th>
                            <th className="px-3 text-[11px] font-bold text-slate-700 uppercase text-center w-32 text-nowrap">Anulado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="py-20 text-center bg-white border-b border-gray-100"
                                    onContextMenu={(e) => handleContextMenu(e, null)}
                                >
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-loose">No hay datos para mostrar</span>
                                </td>
                            </tr>
                        ) : (
                            orders.map((order, idx) => (
                                <tr
                                    key={order.id}
                                    onClick={() => setSelectedOrderId(order.id)}
                                    onContextMenu={(e) => handleContextMenu(e, order)}
                                    className={`h-9 border-b border-gray-200 transition-colors cursor-default select-none group 
                                        ${selectedOrderId === order.id ? 'bg-[#cce8ff]' : (idx % 2 === 0 ? 'bg-white' : 'bg-[#f4f4f4]')} 
                                        hover:bg-[#cce8ff]`}
                                >
                                    <td className="px-3 border-r border-gray-200 text-[10px] font-bold text-slate-700 text-center">{order.date}</td>
                                    <td className="px-3 border-r border-gray-200 text-[10px] font-bold text-slate-900 uppercase">{order.code}</td>
                                    <td className="px-3 border-r border-gray-200 text-[10px] font-bold text-slate-900 uppercase">
                                        {order.produced_item_name ? (
                                            <div className="flex flex-col leading-tight">
                                                <span>{order.produced_item_name}</span>
                                                {order.produced_quantity > 0 && (
                                                    <span className="text-[9px] text-blue-600 font-extrabold">CANT: {order.produced_quantity}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic text-[9px]">No especificado</span>
                                        )}
                                    </td>
                                    <td className="px-3 border-r border-gray-200 text-[10px] font-bold text-slate-700 uppercase">{order.created_by}</td>
                                    <td className="px-3 border-r border-gray-200 text-[11px] font-bold text-[#106ebe] text-center tabular-nums">Q{(order.total_cost || 0).toFixed(2)}</td>
                                    <td className="px-3 border-r border-gray-200 text-center">
                                        <div className="w-4 h-4 border border-gray-400 mx-auto flex items-center justify-center bg-white">
                                            {order.processed && <Check size={12} className="text-blue-600" strokeWidth={4} />}
                                        </div>
                                    </td>
                                    <td className="px-3 text-center">
                                        <div className="w-4 h-4 border border-gray-400 mx-auto flex items-center justify-center bg-white">
                                            {order.voided && <Check size={12} className="text-red-600" strokeWidth={4} />}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bottom Status Bar - Summary */}
            <div className="bg-[#f0f0f0] border-t border-gray-300 px-4 py-1.5 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">TOTAL ÓRDENES: {orders.length}</span>
                <div className="flex gap-10">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">MODO VISUALIZACIÓN: GRILLA ERP</span>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="absolute z-[9999] bg-white border border-gray-400 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-0.5 min-w-[150px] animate-in fade-in zoom-in duration-75 select-none"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                    }}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setModalOrder(null);
                            setIsModalOpen(true);
                            setContextMenu(null);
                        }}
                        className="w-full px-3 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 transition-colors uppercase border-b border-gray-200 last:border-0 text-left group"
                    >
                        <Plus size={14} className="text-[#106ebe] group-hover:text-white" />
                        Nuevo
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const activeRow = contextMenu.row || orders.find(o => o.id === selectedOrderId);
                            if (activeRow) {
                                setModalOrder(activeRow);
                                setIsModalOpen(true);
                            } else {
                                alert('Por favor seleccione una orden para editar');
                            }
                            setContextMenu(null);
                        }}
                        className={`w-full px-3 py-1.5 text-[11px] font-bold flex items-center gap-2 transition-colors uppercase border-b border-gray-200 last:border-0 text-left group
                            ${(contextMenu.row || selectedOrderId) ? 'text-slate-800 hover:bg-[#106ebe] hover:text-white' : 'text-slate-400 cursor-not-allowed'}`}
                    >
                        <ClipboardList size={14} className={(contextMenu.row || selectedOrderId) ? 'text-[#106ebe] group-hover:text-white' : 'text-slate-300'} />
                        Editar
                    </button>
                </div>
            )}

            {/* Production Order Modal */}
            <ProductionOrderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={async (data) => {
                    setLoading(true);
                    // Helper: convierte string vacío a null para campos UUID
                    const toUUID = (val: any) => {
                        if (!val) return null;
                        const s = String(val).trim();
                        return s === '' ? null : s;
                    };

                    try {
                        const isProcessing = data.status === 'Guardar y Procesar';

                        // 1. Insert Production Order
                        const { data: order, error: orderError } = await supabase
                            .from('inventory_production_orders')
                            .insert([{
                                code: data.code || `PROD-${Date.now()}`,
                                branch_id: toUUID(data.branchId),
                                date: data.date,
                                status: data.status,
                                created_by: data.createdBy || '',
                                total_cost: data.details.reduce((sum: number, item: any) => sum + (item.total_cost || 0), 0),
                                produced_item_id: toUUID(data.producedItemId),
                                produced_quantity: Number(data.producedQuantity) || 0,
                                processed: isProcessing
                            }])
                            .select()
                            .single();

                        if (orderError) throw orderError;

                        // 2. Insert Production items
                        const cleanDetails = data.details
                            .filter((item: any) => item.inventory_item_id && String(item.inventory_item_id).trim() !== '')
                            .map((item: any) => ({
                                order_id: order.id,
                                inventory_item_id: String(item.inventory_item_id).trim(),
                                quantity: Number(item.quantity) || 0,
                                unit_cost: Number(item.unit_cost) || 0,
                                total_cost: Number(item.total_cost) || 0,
                                presentation: item.presentation || ''
                            }));

                        if (cleanDetails.length > 0) {
                            const { error: itemsError } = await supabase
                                .from('inventory_production_items')
                                .insert(cleanDetails);
                            if (itemsError) throw itemsError;
                        }

                        // 3. Deduction Loop (only if processing)
                        if (isProcessing) {
                            for (const item of data.details) {
                                // A. Global Stock Update
                                const { data: isProd } = await supabase.from('products').select('id').eq('id', item.inventory_item_id).single();

                                if (isProd) {
                                    const { data: pData } = await supabase.from('products').select('stock_actual').eq('id', item.inventory_item_id).single();
                                    await supabase.from('products').update({ stock_actual: (Number(pData?.stock_actual) || 0) - (Number(item.quantity) || 0) }).eq('id', item.inventory_item_id);
                                } else {
                                    const { data: globalItem } = await supabase
                                        .from('inventory_items')
                                        .select('quantity, name')
                                        .eq('id', item.inventory_item_id)
                                        .single();

                                    if (globalItem) {
                                        await supabase
                                            .from('inventory_items')
                                            .update({ quantity: (Number(globalItem.quantity) || 0) - (Number(item.quantity) || 0) })
                                            .eq('id', item.inventory_item_id);
                                    }
                                }

                                // B. Branch Stock Update
                                const { data: branchItem } = await supabase
                                    .from('inventory_item_branches')
                                    .select('quantity')
                                    .eq('item_id', item.inventory_item_id)
                                    .eq('branch_id', data.branchId)
                                    .single();

                                const currentBranchQty = branchItem?.quantity || 0;
                                const newBranchQty = currentBranchQty - (Number(item.quantity) || 0);

                                if (branchItem) {
                                    await supabase.from('inventory_item_branches')
                                        .update({ quantity: newBranchQty })
                                        .eq('item_id', item.inventory_item_id)
                                        .eq('branch_id', data.branchId);
                                } else {
                                    // Should not happen if item exists, but for safety:
                                    await supabase.from('inventory_item_branches').insert({
                                        item_id: item.inventory_item_id,
                                        branch_id: data.branchId,
                                        quantity: -Number(item.quantity),
                                        is_enabled: true,
                                        is_assigned: true
                                    });
                                }

                                // C. KARDEX Entry (Mandatory for tracking)
                                await supabase.from('inventory_kardex').insert({
                                    item_id: item.inventory_item_id,
                                    branch_id: data.branchId,
                                    movement_type: 'PRODUCCION',
                                    reference: `ORDEN PROD #${order.code}`,
                                    user_name: data.createdBy,
                                    device: isMobile ? 'Celular' : 'PC-ERP',
                                    quantity_in: 0,
                                    quantity_out: Number(item.quantity) || 0,
                                    balance: newBranchQty,
                                    unit_cost: item.unit_cost,
                                    balance_value: newBranchQty * item.unit_cost,
                                    notes: `Salida por producción de cocina - Ref: ${order.code}`
                                });
                            }

                            // B. INCREASE Produced Item Stock (if selected)
                            if (data.producedItemId && data.producedQuantity > 0) {
                                // 1. Global Stock
                                const { data: isProdObj } = await supabase.from('products').select('id').eq('id', data.producedItemId).single();

                                if (isProdObj) {
                                    const { data: gProd } = await supabase.from('products').select('stock_actual').eq('id', data.producedItemId).single();
                                    await supabase.from('products').update({ stock_actual: (Number(gProd?.stock_actual) || 0) + Number(data.producedQuantity) }).eq('id', data.producedItemId);
                                } else {
                                    const { data: gProd } = await supabase.from('inventory_items').select('quantity').eq('id', data.producedItemId).single();
                                    if (gProd) {
                                        await supabase.from('inventory_items').update({ quantity: (Number(gProd.quantity) || 0) + Number(data.producedQuantity) }).eq('id', data.producedItemId);
                                    }
                                }

                                // 2. Branch Stock
                                const { data: bProd } = await supabase.from('inventory_item_branches').select('quantity').eq('item_id', data.producedItemId).eq('branch_id', data.branchId).single();
                                const newProdQty = (bProd?.quantity || 0) + Number(data.producedQuantity);
                                if (bProd) {
                                    await supabase.from('inventory_item_branches').update({ quantity: newProdQty }).eq('item_id', data.producedItemId).eq('branch_id', data.branchId);
                                } else {
                                    await supabase.from('inventory_item_branches').insert({
                                        item_id: data.producedItemId,
                                        branch_id: data.branchId,
                                        quantity: Number(data.producedQuantity),
                                        is_enabled: true,
                                        is_assigned: true
                                    });
                                }

                                // 3. KARDEX Entry (Entry)
                                await supabase.from('inventory_kardex').insert({
                                    item_id: data.producedItemId,
                                    branch_id: data.branchId,
                                    movement_type: 'PRODUCCION_ENTRADA',
                                    reference: `ORDEN PROD #${order.code}`,
                                    user_name: data.createdBy,
                                    device: isMobile ? 'Celular' : 'PC-ERP',
                                    quantity_in: Number(data.producedQuantity),
                                    quantity_out: 0,
                                    balance: newProdQty,
                                    unit_cost: 0,
                                    notes: `Entrada por finalización de producción de cocina - Ref: ${order.code}`
                                });
                            }
                        }

                        alert(isProcessing ? `Orden #${order.code} Procesada y Descontada correctamente` : 'Orden Guardada como Borrador');
                        setIsModalOpen(false);
                        fetchOrders();
                    } catch (err: any) {
                        console.error('Save Error:', err);
                        alert(`Error al procesar la producción: ${err.message}`);
                    } finally {
                        setLoading(false);
                    }
                }}
                branches={branches}
                selectedBranchId={selectedBranch}
                initialData={modalOrder}
            />

        </div>
    );
};
