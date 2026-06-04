import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Plus, Search, X, Package, Trash2, Edit2, ChevronRight, 
    ArrowRight, Save, ClipboardList, AlertCircle, RefreshCw,
    CheckCircle2, Settings
} from 'lucide-react';
import { DraggableWindow } from './DraggableWindow';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { supabase } from '../../supabase';

const idxIsNumber = (idx: any) => typeof idx === 'number' && idx !== null;

interface ProductionOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    branches: any[];
    selectedBranchId: string;
    initialData?: any;
}

export const ProductionOrderModal: React.FC<ProductionOrderModalProps> = ({
    isOpen,
    onClose,
    onSave,
    branches,
    selectedBranchId,
    initialData
}) => {
    const [formData, setFormData] = useState({
        date: initialData?.date || new Date().toISOString().split('T')[0],
        code: initialData?.code || '',
        branchId: initialData?.branchId || selectedBranchId,
        status: initialData?.status || 'Guardar',
        createdBy: initialData?.createdBy || 'EDVIN CASTRO',
        executedBy: initialData?.executedBy || '',
        voidedBy: initialData?.voidedBy || '',
        producedItemId: initialData?.produced_item_id || '',
        producedItemName: initialData?.produced_item_name || '',
        producedQuantity: initialData?.produced_quantity || 0,
        details: initialData?.details || []
    });

    const [tableContextMenu, setTableContextMenu] = useState<{ x: number, y: number, itemIndex: number | null } | null>(null);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [showProductSearchModal, setShowProductSearchModal] = useState(false);
    const [searchingForProduced, setSearchingForProduced] = useState(false);
    const [searchContextMenu, setSearchContextMenu] = useState<{ x: number, y: number, product: any } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [configQty, setConfigQty] = useState<string>('1');
    const [loading, setLoading] = useState(false);

    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen || showProductSearchModal) {
            fetchInventoryItems();
        }
    }, [isOpen, showProductSearchModal]);

    // Load existing order items when editing
    useEffect(() => {
        if (isOpen && initialData?.id) {
            loadOrderItems(initialData.id);
        } else if (isOpen && !initialData) {
            // Reset details for new order
            setFormData(prev => ({ ...prev, details: [] }));
        }
    }, [isOpen, initialData?.id]);

    const loadOrderItems = async (orderId: string) => {
        try {
            const { data: items } = await supabase
                .from('inventory_production_items')
                .select('*')
                .eq('order_id', orderId);

            if (!items || items.length === 0) return;

            // Resolve product names
            const itemIds = items.map((i: any) => i.inventory_item_id).filter(Boolean);
            const { data: prods } = await supabase
                .from('products')
                .select('id, name, unit_measure, presentation_unit, conversion_factor, cost_price')
                .in('id', itemIds);

            const prodMap: Record<string, any> = {};
            (prods || []).forEach((p: any) => { prodMap[p.id] = p; });

            const details = items.map((item: any) => {
                const prod = prodMap[item.inventory_item_id] || {};
                const unitShort = (prod.unit_measure || '').toLowerCase().includes('onza') ? 'OZ' :
                                  (prod.unit_measure || '').toLowerCase().includes('libra') ? 'LB' :
                                  (prod.unit_measure || '').toLowerCase().includes('kilo') ? 'KG' : 
                                  (prod.unit_measure || '').toUpperCase();
                const factorStr = prod.conversion_factor ? ` ${prod.conversion_factor}` : '';
                const presentation = item.presentation || `${prod.presentation_unit || 'UNIDAD'}${factorStr} ${unitShort}`.trim();

                return {
                    quantity: item.quantity,
                    product_name: prod.name || 'Insumo',
                    presentation: presentation.toUpperCase(),
                    unit_cost: item.unit_cost,
                    total_cost: item.total_cost,
                    inventory_item_id: item.inventory_item_id
                };
            });

            setFormData(prev => ({ ...prev, details }));
        } catch (e) {
            console.error('[ProductionOrderModal] Error loading items:', e);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedProduct) {
                    setSelectedProduct(null);
                } else if (showProductSearchModal) {
                    setShowProductSearchModal(false);
                } else if (isOpen) {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showProductSearchModal, selectedProduct, onClose]);

    const fetchInventoryItems = async () => {
        setLoading(true);
        try {
            // Usamos directamente el ID de la categoría PRODUCCION que ya localizamos
            const productionCategoryId = '4fd547d1-2667-4d7f-b6cf-947be65cdaf8';

            const { data, error } = await supabase
                .from('products')
                .select('id, product_code, name, unit_measure, cost_price, presentation_unit, conversion_factor')
                .eq('product_category_id', productionCategoryId)
                .order('name');

            if (error) throw error;

            if (data) {
                const mapped = data
                    .filter(p => p.name && p.name.trim() !== '')
                    .map(p => {
                        const unitShort = (p.unit_measure || '').toLowerCase().includes('onza') ? 'OZ' : 
                                          (p.unit_measure || '').toLowerCase().includes('libra') ? 'LB' : 
                                          (p.unit_measure || '').toLowerCase().includes('kilo') ? 'KG' : 
                                          (p.unit_measure || '').toLowerCase().includes('gramo') ? 'GR' : 
                                          (p.unit_measure || '').toUpperCase();
                        
                        const factorStr = p.conversion_factor ? ` ${p.conversion_factor}` : '';
                        const desc = `${p.presentation_unit || 'UNIDAD'}${factorStr} ${unitShort}`.trim();

                        return {
                            id: p.id,
                            code: p.product_code || '',
                            name: p.name,
                            unit: p.unit_measure || 'UN',
                            cost: p.cost_price || 0,
                            presentation: desc.toUpperCase()
                        };
                    });
                setInventoryItems(mapped);
            }
        } catch (error) {
            console.error('Error in fetchInventoryItems:', error);
        }
        setLoading(false);
    };

    const fetchAllInventory = async () => {
        await fetchInventoryItems();
        setSearchContextMenu(null);
    };

    const handleAddItem = (product: any, qty: number) => {
        if (searchingForProduced) {
            setFormData({
                ...formData,
                producedItemId: product.id,
                producedItemName: product.name,
                producedQuantity: qty
            });
            setSearchingForProduced(false);
        } else {
            const newItem = {
                quantity: qty,
                product_name: product.name,
                presentation: product.presentation || 'UNIDAD',
                unit_cost: product.cost || 0,
                total_cost: qty * (product.cost || 0),
                inventory_item_id: product.id
            };
            setFormData({
                ...formData,
                details: [...formData.details, newItem]
            });
        }
        setShowProductSearchModal(false);
        setSelectedProduct(null);
        setConfigQty('1');
    };

    const handleRemoveItem = (index: number) => {
        const newDetails = [...formData.details];
        newDetails.splice(index, 1);
        setFormData({ ...formData, details: newDetails });
    };

    const handleContextMenu = (e: React.MouseEvent, index: number | null) => {
        e.preventDefault();
        e.stopPropagation();
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setTableContextMenu({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            itemIndex: index
        });
    };

    if (!isOpen || typeof document === 'undefined') return null;

    const portal = createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-none">
            <DraggableWindow id="production-order-modal" title="Orden de Producción">
                <div className="w-[900px] bg-[#f0f0f0]  overflow-hidden border border-[#106ebe] flex flex-col animate-in fade-in zoom-in duration-150 pointer-events-auto">

                    {/* Header (Mover Modal) */}
                    <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                        <div className="flex items-center gap-2">
                            <span className="text-white text-[12px] font-medium tracking-wide">Orden de Producción "beta"</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <WindowsSaveButton
                                onClick={() => onSave(formData)}
                                variant="minimal"
                                title="Guardar"
                            />
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1"
                                title="Cerrar"
                            >
                                <X size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 bg-[#f0f0f0] flex flex-col gap-4 border-b border-gray-300 overflow-y-auto max-h-[85vh]">

                        {/* Section: Datos Compra */}
                        {/* Section: Datos Generales y Producto Resultante */}
                        <fieldset className="border border-gray-400 p-4 pt-2 bg-white relative rounded-sm  shrink-0">
                            <legend className="px-2 text-[11px] font-medium text-slate-950 ml-2 uppercase tracking-tighter">Información de la Orden de Producción</legend>

                            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                {/* Row 1: Fecha y Código */}
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-medium text-slate-900 w-20">Fecha</label>
                                    <div className="flex-1 flex border border-gray-400 h-7 overflow-hidden">
                                        <input
                                            type="date"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="flex-1 px-2 py-0 text-[10px] bg-[#fdfdfd] outline-none font-medium text-black cursor-pointer"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-medium text-slate-900 w-24 text-right">No. / Código</label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="flex-1 border border-gray-400 px-2 h-7 text-[10px] font-medium text-black outline-none focus:border-[#106ebe] uppercase"
                                        placeholder="AUTOGENERADO"
                                    />
                                </div>

                                {/* Row 2: Sucursal y Estado */}
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-medium text-slate-900 w-20">Sucursal</label>
                                    <div className="flex-1 flex border border-gray-400 h-7">
                                        <select
                                            value={formData.branchId}
                                            onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                                            className="flex-1 px-2 py-0 text-[10px] font-medium text-black outline-none appearance-none bg-white"
                                        >
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                        <button className="px-1.5 bg-gray-100 border-l border-gray-300 text-[10px] font-medium text-slate-900">...</button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-medium text-slate-900 w-24 text-right">Estado</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="flex-1 border border-gray-400 px-2 h-7 text-[10px] font-medium text-slate-900 outline-none bg-white font-semibold uppercase tracking-tight"
                                    >
                                        <option value="Guardar">Guardar</option>
                                        <option value="Guardar y Procesar">Guardar y Procesar</option>
                                    </select>
                                </div>

                                {/* Row 3: Usuarios */}
                                <div className="col-span-2 grid grid-cols-3 gap-4 mt-2">
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-medium text-slate-500 uppercase ml-1">Creado Por</label>
                                        <input type="text" value={formData.createdBy} readOnly className="border border-gray-400 bg-[#f9f9f9] px-2 h-6 text-[9px] font-medium text-black" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-medium text-slate-500 uppercase ml-1">Ejecutado Por</label>
                                        <input type="text" value={formData.executedBy} readOnly className="border border-gray-400 bg-[#f9f9f9] px-2 h-6 text-[9px] font-medium text-black" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-medium text-slate-500 uppercase ml-1">Anulado Por</label>
                                        <input type="text" value={formData.voidedBy} readOnly className="border border-gray-400 bg-[#f9f9f9] px-2 h-6 text-[9px] font-medium text-red-600" />
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        {/* Section: Detalle de Producción */}
                        <div
                            ref={containerRef}
                            className="border border-gray-400 flex flex-col bg-white rounded-sm overflow-hidden flex-1 min-h-[350px]  relative"
                            onContextMenu={(e) => handleContextMenu(e, null)}
                            onClick={() => setTableContextMenu(null)}
                        >
                            <div className="bg-[#f0f0f0] border-b border-gray-400 px-3 py-1.5 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-medium text-[#106ebe] uppercase tracking-tight">Detalle de Producción</span>
                                    {formData.producedItemId && (
                                        <div className="flex items-center gap-2 ml-4">
                                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">PRODUCIENDO:</span>
                                            <span className="bg-[#106ebe] text-white px-3 py-0.5 text-[10px] font-semibold rounded-sm  animate-in fade-in slide-in-from-left-2 duration-300">
                                                {formData.producedQuantity} {formData.producedItemName}
                                            </span>
                                            <button 
                                                onClick={() => setFormData({...formData, producedItemId: '', producedItemName: '', producedQuantity: 0})}
                                                className="w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                                            >
                                                <X size={10} strokeWidth={4} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {!formData.producedItemId && <span className="text-[8px] font-semibold text-amber-600 uppercase animate-pulse">* Establecer producto final vía clic derecho</span>}
                            </div>

                            {/* Detail Table */}
                            <div className="flex-1 overflow-auto bg-white custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-[#f8f9fa] border-b border-gray-400 z-10">
                                        <tr className="h-7 text-[#106ebe]">
                                            <th className="px-3 text-[10px] font-medium uppercase w-24">Cantidad</th>
                                            <th className="px-3 text-[10px] font-medium uppercase">Producto</th>
                                            <th className="px-3 text-[10px] font-medium uppercase">Presentación</th>
                                            <th className="px-3 text-[10px] font-medium uppercase text-right w-28">Precio Costo</th>
                                            <th className="px-3 text-[10px] font-medium uppercase text-right w-28">SubTotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-0">
                                        {formData.details.map((item: any, idx: number) => (
                                            <tr
                                                key={idx}
                                                className="h-7 bg-white hover:bg-blue-50 cursor-context-menu transition-colors"
                                                onContextMenu={(e) => handleContextMenu(e, idx)}
                                            >
                                                <td className="px-3 text-[10px] font-medium text-slate-700">{item.quantity}</td>
                                                <td className="px-3 text-[10px] font-medium text-slate-900 uppercase">{item.product_name}</td>
                                                <td className="px-3 text-[10px] font-medium text-slate-600">{item.presentation}</td>
                                                <td className="px-3 text-[10px] font-medium text-slate-700 text-right">{item.unit_cost}</td>
                                                <td className="px-3 text-[10px] font-medium text-slate-900 text-right font-mono">{item.total_cost}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Table Context Menu */}
                                {tableContextMenu && (
                                    <div
                                        className="absolute z-[9999] bg-white border border-gray-400  py-0.5 min-w-[140px] animate-in fade-in zoom-in duration-75 select-none"
                                        style={{ left: tableContextMenu.x, top: tableContextMenu.y }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            onClick={() => {
                                                setSearchingForProduced(false);
                                                setShowProductSearchModal(true);
                                                setSearchTerm('');
                                                setTableContextMenu(null);
                                            }}
                                            className="w-full px-4 py-2 text-[12px] font-semibold text-slate-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors uppercase text-left group"
                                        >
                                            <Plus size={18} className="text-emerald-600 group-hover:text-white" />
                                            AGREGAR
                                        </button>

                                        {tableContextMenu.itemIndex !== null && (
                                            <button
                                                onClick={() => {
                                                    if (tableContextMenu.itemIndex !== null) {
                                                        handleRemoveItem(tableContextMenu.itemIndex);
                                                    }
                                                    setTableContextMenu(null);
                                                }}
                                                className="w-full px-4 py-2 text-[12px] font-semibold text-slate-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors uppercase text-left group border-t border-gray-100"
                                            >
                                                <Trash2 size={18} className="text-rose-600 group-hover:text-white" />
                                                QUITAR
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer Totals */}
                            <div className="bg-[#f0f0f0] border-t border-gray-400 px-4 py-1.5 flex justify-end shrink-0">
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-medium text-slate-950 uppercase tracking-widest">TOTAL PRODUCCIÓN:</span>
                                    <span className="text-[14px] font-semibold text-[#106ebe] tracking-tighter tabular-nums underline decoration-double">
                                        Q{formData.details.reduce((sum: number, item: any) => sum + (item.total_cost || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DraggableWindow>
        </div>,
        document.body
    );

            const searchModalPortal = showProductSearchModal && createPortal(
                <div className="fixed inset-0 z-[110000] flex items-center justify-center pointer-events-none">
                    <DraggableWindow id="production-product-search" title="Buscador de Insumos / Productos - (Categoría: Producción)">
                        <div
                            className="w-[840px] h-[550px]  rounded-sm overflow-hidden pointer-events-auto border-2 border-[#106ebe] bg-[#f0f0f0] flex flex-col relative"
                            onContextMenu={(e) => e.preventDefault()}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (searchContextMenu) setSearchContextMenu(null);
                            }}
                        >
                            {/* Modal Header Interno */}
                            <div className="bg-[#106ebe] px-3 py-1.5 flex items-center justify-between text-white shrink-0 select-none text-left">
                                <span className="text-[11px] font-semibold tracking-widest uppercase flex items-center gap-2">
                                    <Search size={14} strokeWidth={3} /> PANEL DE SELECCIÓN DE INSUMOS
                                </span>
                                <button onClick={() => setShowProductSearchModal(false)} className="w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors ">
                                    <X size={16} strokeWidth={3} />
                                </button>
                            </div>

                            {/* Search Controls */}
                            <div className="p-4 bg-[#f0f0f0] border-b border-gray-300 flex gap-1 shrink-0">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="INTRODUZCA EL TEXTO A BUSCAR..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="flex-1 h-9 border border-gray-400 px-4 text-[12px] outline-none focus:border-[#106ebe] bg-white font-semibold uppercase text-black "
                                />
                                <button className="bg-[#106ebe] text-white px-12 h-9 text-[11px] font-semibold uppercase hover:bg-[#002244]  transition-all active:scale-[0.98]">
                                    Buscar
                                </button>
                            </div>

                            {/* Table Area */}
                            <div className="flex-1 overflow-auto bg-white relative">
                                <table className="w-full text-center border-collapse table-fixed">
                                    <thead className="bg-[#e8ebf0] sticky top-0 z-10 border-b-2 border-slate-300 select-none ">
                                        <tr className="h-9 text-slate-800">
                                            <th className="px-4 text-[10px] font-semibold border-r border-slate-200 w-32 uppercase tracking-tighter">Código</th>
                                            <th className="px-4 text-[10px] font-semibold border-r border-slate-200 uppercase tracking-tighter text-left">Producto / Insumo</th>
                                            <th className="px-4 text-[10px] font-semibold border-r border-slate-200 w-36 uppercase tracking-tighter">Presentación</th>
                                            <th className="px-4 text-[10px] font-semibold w-36 uppercase tracking-tighter">Costo Unitario</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inventoryItems
                                            .filter(i =>
                                                i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                (i.code && i.code.toLowerCase().includes(searchTerm.toLowerCase()))
                                            )
                                            .map((item) => (
                                                <tr
                                                    key={item.id}
                                                    onDoubleClick={() => {
                                                        setSelectedProduct(item);
                                                        setConfigQty('1');
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setSearchContextMenu({
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                            product: item
                                                        });
                                                    }}
                                                    className="h-9 cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors group"
                                                >
                                                    <td className="px-4 text-[10px] border-r border-gray-100 font-medium text-slate-400 truncate uppercase tabular-nums">{item.code || '--'}</td>
                                                    <td className="px-4 text-[11px] border-r border-gray-100 font-semibold uppercase truncate text-left text-slate-800 group-hover:text-[#106ebe]">{item.name}</td>
                                                    <td className="px-4 text-[10px] border-r border-gray-100 truncate text-slate-600 uppercase font-semibold">{item.presentation || 'UNIDAD'}</td>
                                                    <td className="px-4 text-[11px] font-semibold text-[#106ebe] tabular-nums">Q{item.cost?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer */}
                            <div className="bg-[#e8ebf0] border-t border-slate-400 px-5 py-2 flex justify-between items-center shrink-0">
                                <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">* Doble clic para agregar</span>
                                <span className="text-[11px] font-semibold text-[#106ebe] uppercase bg-white border border-slate-300 px-4 py-1.5  rounded-sm tabular-nums">
                                    {inventoryItems.length} Encontrados
                                </span>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            );

            {/* CONFIGURATION MODAL - PORTAL INDEPENDIENTE (INFO REAL) */}
            const configModalPortal = selectedProduct && createPortal(
                <div className="fixed inset-0 z-[120000] flex items-center justify-center pointer-events-none animate-in fade-in duration-100">
                    <DraggableWindow id="production-config-win-v4">
                        <div className="bg-white border-2 border-[#106ebe]  w-[580px] relative rounded-sm overflow-hidden pointer-events-auto flex flex-col">
                            {/* Skill Header */}
                            <div className="modal-header bg-[#106ebe] px-4 py-2 flex items-center justify-between cursor-move select-none border-b border-[#002244]">
                                <div className="flex items-center gap-2">
                                    <Settings size={16} className="text-white/80" />
                                    <span className="text-white text-[12px] font-semibold uppercase tracking-widest font-sans">
                                        Configuración de Insumo
                                    </span>
                                </div>
                                <button onClick={() => setSelectedProduct(null)} className="text-white/60 hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-4 bg-white space-y-4">
                                {/* Product Name Box */}
                                <div className="bg-slate-100 border border-slate-300 py-3 px-5 text-center  rounded-sm">
                                    <span className="text-[17px] font-semibold text-slate-800 uppercase tracking-tight font-sans block truncate">
                                        {selectedProduct.name}
                                    </span>
                                </div>

                                {/* Info Fields Row */}
                                <div className="grid grid-cols-7 gap-3">
                                    {/* Cantidad */}
                                    <div className="col-span-2 space-y-1 text-center">
                                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest font-sans">Cantidad</label>
                                        <input
                                            autoFocus
                                            type="number"
                                            value={configQty}
                                            onChange={(e) => setConfigQty(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full h-10 border-2 border-slate-400 bg-white px-3 text-[15px] font-semibold text-[#106ebe] outline-none text-center tabular-nums focus:border-[#106ebe]  rounded-sm"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleAddItem(selectedProduct, parseFloat(configQty) || 0);
                                            }}
                                        />
                                    </div>
                                    {/* Presentación */}
                                    <div className="col-span-3 space-y-1 text-center">
                                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest font-sans">Presentación</label>
                                        <div className="w-full h-10 border-2 border-slate-200 bg-slate-50 flex items-center justify-center text-[13px] font-semibold text-slate-800 whitespace-nowrap overflow-hidden px-4  rounded-sm uppercase tracking-tighter leading-tight text-center">
                                            {selectedProduct.presentation || 'UNIDAD'}
                                        </div>
                                    </div>
                                    {/* Precio Costo */}
                                    <div className="col-span-2 space-y-1 text-center">
                                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest font-sans">Precio Costo</label>
                                        <div className="w-full h-10 border-2 border-slate-200 bg-slate-50 flex items-center justify-center text-[14px] font-semibold text-slate-900 tabular-nums  rounded-sm">
                                            Q{selectedProduct.cost?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Button Container */}
                                <div className="flex justify-center pt-1">
                                    <button
                                        onClick={() => handleAddItem(selectedProduct, parseFloat(configQty) || 0)}
                                        className="px-16 py-3 bg-[#106ebe] text-white text-[15px] font-semibold uppercase tracking-[0.2em] flex items-center justify-center rounded-sm "
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            );

            {/* CONTEXT MENU PORTAL */}
            const contextMenuPortal = searchContextMenu && createPortal(
                <div
                    className="fixed z-[999999] bg-white border border-gray-400  /50 py-0.5 min-w-[240px] animate-in fade-in zoom-in duration-75 pointer-events-auto"
                    style={{ left: searchContextMenu.x, top: searchContextMenu.y }}
                >
                    {searchContextMenu.product && (
                        <button
                            onClick={() => { setSelectedProduct(searchContextMenu.product); setSearchContextMenu(null); }}
                            className="w-full px-4 py-2 text-[12px] font-semibold text-slate-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors uppercase text-left group"
                        >
                            <Plus size={18} className="text-emerald-600 group-hover:text-white" /> Agregar al Detalle
                        </button>
                    )}
                    <button
                        onClick={() => { fetchAllInventory(); setSearchContextMenu(null); }}
                        className="w-full px-4 py-2 text-[12px] font-semibold text-slate-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors uppercase text-left group"
                    >
                        <RefreshCw size={18} className="text-blue-500 group-hover:text-white" /> Ver Todo el Inventario
                    </button>
                    <button onClick={() => setSearchContextMenu(null)} className="w-full px-4 py-2 text-[12px] font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-3 transition-colors uppercase text-left border-t border-gray-100">
                        <X size={18} className="text-gray-400" /> Cancelar
                    </button>
                </div>,
                document.body
            );

    return (
        <>
            {portal}
            {searchModalPortal}
            {configModalPortal}
            {contextMenuPortal}
        </>
    );
};
