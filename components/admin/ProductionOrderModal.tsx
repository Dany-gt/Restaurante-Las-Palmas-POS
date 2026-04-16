import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Search, Trash2, Edit2, RefreshCw } from 'lucide-react';
import { DraggableWindow } from './DraggableWindow';
import { WindowsSaveButton } from '../WindowsSaveButton';
import { supabase } from '../../supabase';

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

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, itemIndex: number | null } | null>(null);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [showProductSearchModal, setShowProductSearchModal] = useState(false);
    const [searchingForProduced, setSearchingForProduced] = useState(false);
    const [searchContextMenu, setSearchContextMenu] = useState<{ x: number, y: number, product: any } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [configQty, setConfigQty] = useState<string>('1');

    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchInventoryItems();
        }
    }, [isOpen]);

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
        try {
            // First attempt to get the Producción category
            const { data: categories, error: catError } = await supabase
                .from('inventory_categories')
                .select('id, name, parent_id');

            if (catError) throw catError;

            const mainProdCat = categories?.find(c =>
                c.name.toUpperCase().includes('PRODUCC')
            );

            let prodCategoryIds: string[] = [];

            if (mainProdCat) {
                // Recursive search for all subcategories
                prodCategoryIds = [mainProdCat.id];
                let added = true;
                while (added) {
                    added = false;
                    const children = categories!.filter(c => c.parent_id && prodCategoryIds.includes(c.parent_id));
                    children.forEach(c => {
                        if (!prodCategoryIds.includes(c.id)) {
                            prodCategoryIds.push(c.id);
                            added = true;
                        }
                    });
                }
            }

            // Fetch products
            let query = supabase.from('inventory_items').select('*').order('name');

            if (prodCategoryIds.length > 0) {
                query = query.in('category_id', prodCategoryIds);
            }

            const { data, error: itemsError } = await query;
            if (itemsError) throw itemsError;

            if (data) setInventoryItems(data);
        } catch (error) {
            console.error('Error fetching inventory items:', error);
            const { data } = await supabase.from('inventory_items').select('*').order('name');
            if (data) setInventoryItems(data);
        }
    };

    const fetchAllInventory = async () => {
        const { data } = await supabase.from('inventory_items').select('*').order('name');
        if (data) setInventoryItems(data);
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
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setContextMenu({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            itemIndex: index
        });
    };

    if (!isOpen || typeof document === 'undefined') return null;

    const portal = createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-none">
            <DraggableWindow id="production-order-modal" title="Orden de Producción">
                <div className="w-[900px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.3)] overflow-hidden border border-[#106ebe] flex flex-col animate-in fade-in zoom-in duration-150 pointer-events-auto">

                    {/* Header (Mover Modal) */}
                    <div className="modal-header bg-[#106ebe] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                        <div className="flex items-center gap-2">
                            <span className="text-white text-[12px] font-bold tracking-wide">Orden de Producción "beta"</span>
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
                        <fieldset className="border border-gray-400 p-4 pt-2 bg-white relative rounded-sm shadow-sm">
                            <legend className="px-2 text-[11px] font-bold text-slate-950 ml-2">Datos Compra</legend>

                            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                {/* Row 1 */}
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-slate-900 w-20">Fecha</label>
                                    <div className="flex-1 flex border border-gray-400 h-7 overflow-hidden">
                                        <input
                                            type="date"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="flex-1 px-2 py-0 text-[10px] bg-[#fdfdfd] outline-none font-bold text-black cursor-pointer"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-slate-900 w-24 text-right">No. / Código</label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="flex-1 border border-gray-400 px-2 h-7 text-[10px] font-bold text-black outline-none focus:border-[#106ebe] uppercase"
                                        placeholder="AUTOGENERADO"
                                    />
                                </div>

                                {/* Row 2 */}
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-slate-900 w-20">Sucursal</label>
                                    <div className="flex-1 flex border border-gray-400 h-7">
                                        <select
                                            value={formData.branchId}
                                            onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                                            className="flex-1 px-2 py-0 text-[10px] font-bold text-black outline-none appearance-none bg-white"
                                        >
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                        <button className="px-1.5 bg-gray-100 border-l border-gray-300 text-[10px] font-bold text-slate-900">...</button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-slate-900 w-24 text-right">Estado</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="flex-1 border border-gray-400 px-2 h-7 text-[10px] font-bold text-slate-900 outline-none bg-white font-black uppercase tracking-tight"
                                    >
                                        <option value="Guardar">Guardar</option>
                                        <option value="Guardar y Procesar">Guardar y Procesar</option>
                                    </select>
                                </div>

                                {/* Row 3 - Footers markers */}
                                <div className="col-span-2 grid grid-cols-3 gap-4 mt-2">
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-bold text-slate-900 uppercase ml-1">Creado Por</label>
                                        <input type="text" value={formData.createdBy} readOnly className="border border-gray-400 bg-[#f9f9f9] px-2 h-6 text-[9px] font-bold text-black" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-bold text-slate-900 uppercase ml-1">Ejecutado Por</label>
                                        <input type="text" value={formData.executedBy} readOnly className="border border-gray-400 bg-[#f9f9f9] px-2 h-6 text-[9px] font-bold text-black" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-bold text-slate-900 uppercase ml-1">Anulado Por</label>
                                        <input type="text" value={formData.voidedBy} readOnly className="border border-gray-400 bg-[#f9f9f9] px-2 h-6 text-[9px] font-bold text-red-600" />
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        {/* Section: Producto Final (Resultado de la Producción) */}
                        <fieldset className="border border-[#106ebe] p-4 pt-2 bg-blue-50/20 relative rounded-sm shadow-sm">
                            <legend className="px-2 text-[11px] font-extrabold text-[#106ebe] ml-2 uppercase">Producto Resultante (Lo que se Cocina/Produce)</legend>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Producto / Ítem a Cargar Stock</label>
                                    <div className="flex h-8 border border-gray-400 bg-white overflow-hidden shadow-sm">
                                        <input
                                            type="text"
                                            readOnly
                                            value={formData.producedItemName}
                                            placeholder="HAGA CLIC EN LA LUPA PARA SELECCIONAR EL PRODUCTO FINAL..."
                                            className="flex-1 px-3 text-[11px] font-extrabold text-[#106ebe] outline-none placeholder:text-gray-300"
                                        />
                                        <button
                                            onClick={() => {
                                                setSearchingForProduced(true);
                                                setShowProductSearchModal(true);
                                                setSearchTerm('');
                                            }}
                                            className="px-4 bg-[#106ebe] text-white hover:bg-[#106ebe] transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Search size={14} />
                                            <span className="text-[10px] font-bold">BUSCAR</span>
                                        </button>
                                        {formData.producedItemId && (
                                            <button
                                                onClick={() => setFormData({ ...formData, producedItemId: '', producedItemName: '', producedQuantity: 0 })}
                                                className="px-2 bg-red-100 text-red-600 border-l border-gray-300 hover:bg-red-200 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="w-40 flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-1 text-center">Cantidad Producida</label>
                                    <input
                                        type="number"
                                        value={formData.producedQuantity}
                                        onChange={(e) => setFormData({ ...formData, producedQuantity: parseFloat(e.target.value) || 0 })}
                                        className="h-8 border border-gray-400 px-3 text-[16px] font-black text-slate-900 outline-none text-center bg-white shadow-sm focus:border-[#106ebe]"
                                    />
                                </div>
                            </div>
                            <p className="text-[8px] font-bold text-gray-400 mt-2 uppercase italic ml-1">* Al procesar esta orden, se SUMARÁ esta cantidad al inventario de este producto.</p>
                        </fieldset>

                        {/* Section: Detalle de Producción */}
                        <div
                            ref={containerRef}
                            className="border border-gray-400 flex flex-col bg-white rounded-sm overflow-hidden flex-1 min-h-[350px] shadow-sm relative"
                            onContextMenu={(e) => handleContextMenu(e, null)}
                            onClick={() => setContextMenu(null)}
                        >
                            <div className="bg-[#f0f0f0] border-b border-gray-400 px-3 py-1 flex items-center justify-between shrink-0">
                                <span className="text-[10px] font-bold text-[#106ebe] uppercase tracking-tight">Detalle de Producción</span>
                            </div>

                            {/* Detail Table */}
                            <div className="flex-1 overflow-auto bg-white custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-[#f8f9fa] border-b border-gray-400 z-10">
                                        <tr className="h-7 text-[#106ebe]">
                                            <th className="px-3 text-[10px] font-bold uppercase w-24">Cantidad</th>
                                            <th className="px-3 text-[10px] font-bold uppercase">Producto</th>
                                            <th className="px-3 text-[10px] font-bold uppercase">Presentación</th>
                                            <th className="px-3 text-[10px] font-bold uppercase text-right w-28">Precio Costo</th>
                                            <th className="px-3 text-[10px] font-bold uppercase text-right w-28">SubTotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-0">
                                        {formData.details.length === 0 ? (
                                            <tr
                                                className="h-7 text-[#106ebe] group hover:bg-blue-50 cursor-context-menu"
                                                onContextMenu={(e) => handleContextMenu(e, null)}
                                            >
                                                <td className="px-3 text-[10px] font-bold text-slate-900">--</td>
                                                <td className="px-3 text-[10px] font-bold text-slate-900">--</td>
                                                <td className="px-3 text-[10px] font-bold text-slate-900">--</td>
                                                <td className="px-3 text-[10px] font-bold text-slate-900 text-right">--</td>
                                                <td className="px-3 text-[10px] font-bold text-slate-900 text-right">--</td>
                                            </tr>
                                        ) : (
                                            formData.details.map((item: any, idx: number) => (
                                                <tr
                                                    key={idx}
                                                    className="h-7 bg-white hover:bg-blue-50 cursor-context-menu transition-colors"
                                                    onContextMenu={(e) => handleContextMenu(e, idx)}
                                                >
                                                    <td className="px-3 text-[10px] font-bold text-slate-700">{item.quantity}</td>
                                                    <td className="px-3 text-[10px] font-bold text-slate-900 uppercase">{item.product_name}</td>
                                                    <td className="px-3 text-[10px] font-bold text-slate-600">{item.presentation}</td>
                                                    <td className="px-3 text-[10px] font-bold text-slate-700 text-right">{item.unit_cost}</td>
                                                    <td className="px-3 text-[10px] font-bold text-slate-900 text-right font-mono">{item.total_cost}</td>
                                                </tr>
                                            ))
                                        )}
                                        {/* Classic ERP empty rows - CLEAN NO LINES */}
                                        {[...Array(12)].map((_, i) => (
                                            <tr key={`pad-${i}`} className="h-7 opacity-40 hover:bg-slate-50/50" onContextMenu={(e) => handleContextMenu(e, null)}>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Table Context Menu */}
                                {contextMenu && (
                                    <div
                                        className="absolute z-[9999] bg-white border border-gray-400 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] py-0.5 min-w-[150px] animate-in fade-in zoom-in duration-75 select-none"
                                        style={{ left: contextMenu.x, top: contextMenu.y }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            onClick={() => {
                                                setShowProductSearchModal(true);
                                                setSearchTerm('');
                                                setContextMenu(null);
                                            }}
                                            className="w-full px-3 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 transition-colors uppercase border-b border-gray-200 last:border-0 text-left group"
                                        >
                                            <Plus size={14} className="text-emerald-600 group-hover:text-white" />
                                            Agregar Producto
                                        </button>
                                        {contextMenu.itemIndex !== null && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        if (contextMenu.itemIndex !== null) {
                                                            const item = formData.details[contextMenu.itemIndex];
                                                            const invItem = inventoryItems.find(i => i.id === item.inventory_item_id);
                                                            if (invItem) {
                                                                setSelectedProduct(invItem);
                                                                setConfigQty(item.quantity.toString());
                                                                const newDetails = [...formData.details];
                                                                newDetails.splice(contextMenu.itemIndex, 1);
                                                                setFormData({ ...formData, details: newDetails });
                                                            }
                                                        }
                                                        setContextMenu(null);
                                                    }}
                                                    className="w-full px-3 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 transition-colors uppercase border-b border-gray-200 last:border-0 text-left group"
                                                >
                                                    <Edit2 size={14} className="text-amber-600 group-hover:text-white" />
                                                    Modificar Línea
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (contextMenu.itemIndex !== null) {
                                                            handleRemoveItem(contextMenu.itemIndex);
                                                        }
                                                        setContextMenu(null);
                                                    }}
                                                    className="w-full px-3 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-2 transition-colors uppercase border-b border-gray-200 last:border-0 text-left group"
                                                >
                                                    <Trash2 size={14} className="text-rose-600 group-hover:text-white" />
                                                    Quitar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer Totals */}
                            <div className="bg-[#f0f0f0] border-t border-gray-400 px-4 py-1.5 flex justify-end shrink-0">
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-bold text-slate-950 uppercase tracking-widest">TOTAL PRODUCCIÓN:</span>
                                    <span className="text-[14px] font-black text-[#106ebe] tracking-tighter tabular-nums underline decoration-double">
                                        Q{formData.details.reduce((sum: number, item: any) => sum + (item.total_cost || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>



                {/* PRODUCT SEARCH MODAL PORTAL */}
                {showProductSearchModal && createPortal(
                    <div className="fixed inset-0 z-[110000] flex items-center justify-center bg-black/40 backdrop-blur-[1px] pointer-events-none">
                        <DraggableWindow id="production-product-search" title="Buscador de Insumos para Producción">
                            <div
                                className="w-[840px] h-[580px] shadow-[0_30px_90px_-15px_rgba(0,0,0,0.6)] rounded-sm overflow-hidden pointer-events-auto border-2 border-[#106ebe] bg-white flex flex-col h-full relative"
                                onContextMenu={(e) => e.preventDefault()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (searchContextMenu) setSearchContextMenu(null);
                                }}
                            >
                                {/* Modal Header */}
                                <div className="modal-header bg-[#106ebe] px-3 py-1.5 flex items-center justify-between text-white shrink-0 cursor-move select-none">
                                    <span className="text-[11px] font-bold tracking-wider uppercase flex items-center gap-2">
                                        <Search size={14} /> Buscador de Insumos / Productos - (Categoría: Producción)
                                    </span>
                                    <button onClick={() => setShowProductSearchModal(false)} className="w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors">
                                        <X size={16} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* Search Controls */}
                                <div className="p-5 bg-slate-50 border-b border-gray-300 flex gap-0 shadow-sm shrink-0">
                                    <div className="relative flex-1 group">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="INTRODUZCA EL TEXTO A BUSCAR (CÓDIGO O NOMBRE)..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full h-10 border-2 border-slate-300 px-4 text-[13px] outline-none focus:border-[#106ebe] focus:bg-white bg-white font-black uppercase text-black placeholder:text-gray-400 transition-all rounded-l-sm shadow-inner"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
                                            <Search size={16} className="text-[#106ebe]" />
                                        </div>
                                    </div>
                                    <button className="bg-[#106ebe] text-white px-10 h-10 text-[12px] font-black uppercase hover:bg-[#106ebe] shadow-md transition-all active:scale-[0.98] rounded-r-sm border-l border-white/10 flex items-center gap-2">
                                        <span>Buscar</span>
                                    </button>
                                </div>

                                {/* Table Area */}
                                <div
                                    className={`flex-1 overflow-auto bg-white relative ${selectedProduct ? 'pointer-events-none opacity-20 grayscale' : ''}`}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        if (searchContextMenu) setSearchContextMenu(null);
                                    }}
                                >
                                    <table className="w-full text-left border-collapse table-fixed">
                                        <thead className="bg-[#e8ebf0] sticky top-0 z-10 border-b-2 border-slate-300 select-none">
                                            <tr className="h-10 text-slate-800">
                                                <th className="px-4 text-[10px] font-black border-r border-slate-200 w-32 uppercase tracking-wide">Código</th>
                                                <th className="px-4 text-[10px] font-black border-r border-slate-200 uppercase tracking-wide">Producto / Insumo</th>
                                                <th className="px-4 text-[10px] font-black border-r border-slate-200 w-36 text-center uppercase tracking-wide">Presentación</th>
                                                <th className="px-4 text-[10px] font-black w-36 text-right uppercase tracking-wide">Costo Unitario</th>
                                            </tr>
                                        </thead>
                                        <tbody onContextMenu={(e) => e.stopPropagation()}>
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
                                                        className="h-10 cursor-pointer border-b border-gray-100 hover:bg-slate-100 transition-colors group relative"
                                                    >
                                                        <td className="px-4 text-[11px] border-r border-gray-100 font-bold text-slate-900 truncate uppercase tabular-nums">{item.code || '--'}</td>
                                                        <td className="px-4 text-[12px] border-r border-gray-100 font-black uppercase truncate text-black group-hover:text-[#106ebe]">{item.name}</td>
                                                        <td className="px-4 text-[11px] border-r border-gray-100 text-center truncate text-slate-800 uppercase font-bold">{item.presentation || 'UNIDAD'}</td>
                                                        <td className="px-4 text-[11px] text-right font-black text-black tabular-nums">Q{item.cost?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))
                                            }
                                            {inventoryItems.length === 0 && (
                                                <tr
                                                    className="cursor-pointer"
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setSearchContextMenu({
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                            product: null
                                                        });
                                                    }}
                                                >
                                                    <td colSpan={4} className="p-20 text-center">
                                                        <div className="flex flex-col items-center gap-4">
                                                            <Search size={40} className="text-gray-300" />
                                                            <div>
                                                                <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest">No se encontraron productos en esta categoría</p>
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 italic">Sugerencia: Haz clic derecho aquí para ver todo el inventario</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer Information */}
                                <div className="bg-[#e8ebf0] border-t border-slate-300 px-5 py-2 flex justify-between items-center shrink-0 shadow-inner">
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                        <Plus size={10} className="text-emerald-600" /> * Doble clic o clic derecho para agregar
                                    </span>
                                    <span className="text-[11px] font-black text-slate-950 uppercase bg-white border border-slate-300 px-3 py-1 shadow-sm rounded-sm tabular-nums">
                                        {inventoryItems.length} Registros Disponibles
                                    </span>
                                </div>

                                {/* Main Footer Buttons */}
                                <div className="bg-slate-50 border-t border-gray-300 p-4 flex justify-end shrink-0">
                                    <button
                                        onClick={() => setShowProductSearchModal(false)}
                                        className="bg-white border-2 border-slate-500 text-slate-900 px-12 h-10 text-[11px] font-black uppercase hover:bg-slate-100 transition-all active:scale-[0.98] rounded-sm shadow-sm"
                                    >
                                        Cerrar / Cancelar
                                    </button>
                                </div>

                                {/* CONFIGURATION SUB-MODAL */}
                                {selectedProduct && (
                                    <div className="absolute inset-0 z-[120000] flex items-center justify-center bg-black/40 animate-in fade-in duration-150 pointer-events-auto">
                                        <div className="bg-[#f2f2f2] border-2 border-[#106ebe] shadow-[0_30px_100px_-10px_rgba(0,0,0,0.6)] w-[650px] relative rounded-sm overflow-hidden animate-in zoom-in-95 duration-200">
                                            <div className="bg-[#106ebe] px-3 py-1.5 flex items-center justify-between text-white shadow-sm shrink-0 select-none">
                                                <span className="text-[11px] font-bold uppercase tracking-wider">Configuración de Insumo - Esc (Cerrar)</span>
                                                <button onClick={() => setSelectedProduct(null)} className="w-5 h-5 flex items-center justify-center hover:bg-red-600 transition-colors">
                                                    <X size={14} strokeWidth={2.5} />
                                                </button>
                                            </div>

                                            <div className="p-8 space-y-8">
                                                <div className="bg-white border border-gray-300 p-4 shadow-inner rounded-sm text-center">
                                                    <h3 className="text-[20px] font-black text-[#106ebe] uppercase tracking-wide leading-tight">{selectedProduct.name}</h3>
                                                </div>

                                                <div className="grid grid-cols-3 gap-6">
                                                    <div className="space-y-2 flex flex-col items-center">
                                                        <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">Cantidad</label>
                                                        <input
                                                            autoFocus
                                                            type="number"
                                                            value={configQty}
                                                            onChange={(e) => setConfigQty(e.target.value)}
                                                            className="w-full h-12 border-2 border-slate-400 bg-white px-3 text-[22px] font-black text-slate-900 outline-none tabular-nums text-center focus:border-[#106ebe] shadow-sm"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleAddItem(selectedProduct, parseFloat(configQty) || 0);
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="space-y-2 flex flex-col items-center">
                                                        <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">Presentación</label>
                                                        <div className="w-full h-12 border-2 border-slate-200 bg-white flex items-center justify-center text-[13px] font-black text-slate-900 uppercase tracking-tight shadow-sm">
                                                            {selectedProduct.presentation || 'UNIDAD'}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2 flex flex-col items-center">
                                                        <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">Precio Costo</label>
                                                        <div className="w-full h-12 border-2 border-slate-200 bg-white flex items-center justify-center text-[13px] font-black text-[#106ebe] tabular-nums shadow-sm underline decoration-blue-200">
                                                            Q{selectedProduct.cost?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-center pt-2 gap-4">
                                                    <button
                                                        onClick={() => handleAddItem(selectedProduct, parseFloat(configQty) || 0)}
                                                        className="w-full h-12 bg-[#106ebe] text-white text-[14px] font-black uppercase shadow-xl hover:bg-[#106ebe] active:scale-[0.98] transition-all flex items-center justify-center gap-2 rounded-sm border-b-4 border-black"
                                                    >
                                                        Agregar al Detalle de Producción
                                                    </button>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">* Presione Enter para confirmar y añadir a la orden</p>
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
            </DraggableWindow>
        </div>,
        document.body
    );

    {/* SEARCH PRODUCT CONTEXT MENU (Highest Priority - Bottom of DOM) */ }
    {
        searchContextMenu && createPortal(
            <div
                className="fixed z-[9999999] bg-white border border-gray-400 shadow-[4px_4px_40px_rgba(0,0,0,0.6)] py-0.5 min-w-[240px] animate-in fade-in zoom-in duration-75 select-none pointer-events-auto"
                style={{
                    left: searchContextMenu.x,
                    top: searchContextMenu.y,
                }}
                onContextMenu={(e) => e.preventDefault()}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-1.5 bg-slate-100 border-b border-gray-200 text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                    <Search size={12} className="text-slate-400" /> Opciones de Búsqueda
                </div>

                {searchContextMenu.product ? (
                    <button
                        onClick={() => {
                            setSelectedProduct(searchContextMenu.product);
                            setSearchContextMenu(null);
                        }}
                        className="w-full px-4 py-2 text-[12px] font-black text-slate-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors uppercase text-left group"
                    >
                        <Plus size={18} className="text-emerald-600 group-hover:text-white" />
                        Agregar al Detalle
                    </button>
                ) : (
                    <button
                        onClick={fetchAllInventory}
                        className="w-full px-4 py-2 text-[12px] font-black text-slate-800 hover:bg-[#106ebe] hover:text-white flex items-center gap-3 transition-colors uppercase text-left group"
                    >
                        <RefreshCw size={18} className="text-blue-500 group-hover:text-white" />
                        Ver Todo el Inventario
                    </button>
                )}

                <button
                    onClick={() => setSearchContextMenu(null)}
                    className="w-full px-4 py-2 text-[12px] font-black text-slate-800 hover:bg-slate-100 flex items-center gap-3 transition-colors uppercase text-left border-t border-gray-100"
                >
                    <X size={18} className="text-gray-400" />
                    Cancelar
                </button>
            </div>,
            document.body
        )
    }

    return portal;
};
