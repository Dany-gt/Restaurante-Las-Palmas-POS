import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Plus, Trash2, ChevronDown, Loader2, Settings } from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { WindowsSaveButton } from '../WindowsSaveButton';

// Unit definitions for category checking
const INVENTORY_UNITS: Record<string, { factor: number, base: string, category: string }> = {
    'ML': { factor: 1, base: 'ML', category: 'Volumen' },
    'MILILITRO': { factor: 1, base: 'ML', category: 'Volumen' },
    'LT': { factor: 1000, base: 'ML', category: 'Volumen' },
    'LITRO': { factor: 1000, base: 'ML', category: 'Volumen' },
    'FL OZ': { factor: 29.5735, base: 'ML', category: 'Volumen' },
    'GL': { factor: 3785.41, base: 'ML', category: 'Volumen' },
    'GR': { factor: 1, base: 'GR', category: 'Masa' },
    'GRAMO': { factor: 1, base: 'GR', category: 'Masa' },
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

interface TransferItem {
    inventory_item_id: string;
    product_name: string;
    presentation: string;
    quantity: number;
    cost: number;
    total: number;
}

interface InventoryTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingTransfer?: any;
    branches: any[];
    currentUser?: any;
    onSaveSuccess: () => void;
}

export const InventoryTransferModal: React.FC<InventoryTransferModalProps> = ({
    isOpen,
    onClose,
    editingTransfer,
    branches,
    currentUser,
    onSaveSuccess
}) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        id: '',
        date: new Date().toISOString().split('T')[0],
        transfer_no: '',
        from_branch_id: '',
        to_branch_id: '',
        status: 'GUARDAR'
    });
    const [items, setItems] = useState<TransferItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showProductSearch, setShowProductSearch] = useState<number | null>(null);

    // Context Menu & Product List States
    const [detailContextMenu, setDetailContextMenu] = useState<{ x: number, y: number, itemIdx: number | null } | null>(null);
    const [showProductListModal, setShowProductListModal] = useState(false);
    const [productListSearch, setProductListSearch] = useState('');
    const [selectedProductForConfig, setSelectedProductForConfig] = useState<any | null>(null);
    const [configQty, setConfigQty] = useState<number>(1);
    const [configUnit, setConfigUnit] = useState<string>('');

    useEffect(() => {
        if (selectedProductForConfig) {
            setConfigUnit(selectedProductForConfig.unit || 'Unidad');
        }
    }, [selectedProductForConfig]);

    useEffect(() => {
        if (isOpen) {
            fetchInventoryItems();
            if (editingTransfer) {
                // Initialize form with editing data
                setFormData({
                    id: editingTransfer.id,
                    date: editingTransfer.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
                    transfer_no: editingTransfer.transfer_no || '',
                    from_branch_id: editingTransfer.from_branch_id || '',
                    to_branch_id: editingTransfer.to_branch_id || '',
                    status: editingTransfer.status || 'GUARDAR'
                });
                // Fetch items for this transfer...
            } else {
                setFormData({
                    id: '',
                    date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
                    transfer_no: '',
                    from_branch_id: branches[0]?.id || '',
                    to_branch_id: '',
                    status: 'GUARDAR'
                });
                setItems([]);
            }
        }
    }, [isOpen, editingTransfer, branches]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedProductForConfig) {
                    setSelectedProductForConfig(null);
                } else if (showProductListModal) {
                    setShowProductListModal(false);
                } else if (isOpen) {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showProductListModal, selectedProductForConfig, onClose]);

    useEffect(() => {
        const handleClickOutside = () => setDetailContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const fetchInventoryItems = async () => {
        const { data } = await supabase.from('inventory_items').select('*').order('name');
        if (data) setInventoryItems(data);
    };

    const handleAddItem = () => {
        setItems([...items, { inventory_item_id: '', product_name: '', presentation: '', quantity: 1, cost: 0, total: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleProductSelect = (index: number, product: any) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            inventory_item_id: product.id,
            product_name: product.name,
            presentation: product.presentation || '',
            cost: product.cost || 0,
            total: (newItems[index].quantity || 0) * (product.cost || 0)
        };
        setItems(newItems);
        setShowProductSearch(null);
    };

    const handleQuantityChange = (index: number, qty: number) => {
        const newItems = [...items];
        newItems[index].quantity = qty;
        newItems[index].total = qty * newItems[index].cost;
        setItems(newItems);
    };

    const calculateTotal = () => items.reduce((acc, item) => acc + item.total, 0);

    const handleSave = async () => {
        if (!formData.from_branch_id || !formData.to_branch_id || items.length === 0) {
            alert('Por favor complete todos los datos y agregue productos.');
            return;
        }
        if (formData.from_branch_id === formData.to_branch_id) {
            alert('La sucursal de origen y destino no pueden ser la misma.');
            return;
        }

        setSaving(true);
        // Save logic to Supabase would go here
        // 1. Insert/Update inventory_transfers
        // 2. Insert/Update inventory_transfer_items
        // 3. Update stocks (or wait for processing)

        // Mock success for now as we focus on UI
        setTimeout(() => {
            setSaving(false);
            onSaveSuccess();
            onClose();
        }, 1000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none">
            <DraggableWindow id="inventory-transfer-modal" title="Traslado de Inventario">
                <div className="bg-[#f0f0f0] w-[900px] shadow-2xl relative flex flex-col rounded-sm border border-gray-400 font-sans text-black overflow-hidden pointer-events-auto">
                    {/* Header */}
                    <div className="modal-header bg-[#106ebe] px-3 py-1.5 flex items-center justify-between text-white shrink-0 cursor-default select-none">
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold tracking-wider">Traslado de Inventario</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <WindowsSaveButton onClick={handleSave} loading={saving} title="Guardar Traslado" />
                            <button onClick={onClose} className="w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-all">
                                <X size={16} strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    <div className="p-3 space-y-4">
                        {/* Datos de Traslado Section */}
                        <div className="border border-gray-300 rounded-sm bg-white overflow-hidden">
                            <div className="bg-gray-100 px-3 py-1 border-b border-gray-300">
                                <span className="text-[11px] font-black text-[#106ebe] uppercase">Datos de Traslado</span>
                            </div>
                            <div className="p-3 grid grid-cols-2 gap-x-12 gap-y-2">
                                {/* Row 1 */}
                                <div className="flex items-center gap-2">
                                    <label className="text-[11px] font-bold text-gray-600 w-24">Fecha</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="flex-1 h-6 border border-gray-300 px-2 text-[11px] outline-none bg-blue-50/20"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[11px] font-bold text-gray-600 w-24">Traslado No.</label>
                                    <input
                                        type="text"
                                        value={formData.transfer_no}
                                        readOnly
                                        className="flex-1 h-6 border border-gray-300 px-2 text-[11px] outline-none bg-gray-50 uppercase"
                                        placeholder="AUTOGENERADO"
                                    />
                                </div>

                                {/* Row 2 */}
                                <div className="flex items-center gap-2">
                                    <label className="text-[11px] font-bold text-gray-600 w-24">Sucursal Envía</label>
                                        <select
                                            value={formData.from_branch_id}
                                            onChange={e => setFormData({ ...formData, from_branch_id: e.target.value })}
                                            className="flex-1 h-6 border border-gray-300 px-2 text-[11px] outline-none bg-white font-bold"
                                        >
                                            <option value="">Seleccione...</option>
                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[11px] font-bold text-gray-600 w-24">Sucursal Destino</label>
                                        <select
                                            value={formData.to_branch_id}
                                            onChange={e => setFormData({ ...formData, to_branch_id: e.target.value })}
                                            className="flex-1 h-6 border border-gray-300 px-2 text-[11px] outline-none bg-white font-bold"
                                        >
                                            <option value="">Seleccione...</option>
                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                </div>

                                {/* Row 3 */}
                                <div className="flex items-center gap-2">
                                    <label className="text-[11px] font-bold text-gray-600 w-24">Estado</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="flex-1 h-6 border border-gray-300 px-2 text-[11px] outline-none bg-white font-bold"
                                    >
                                        <option value="GUARDAR">GUARDAR</option>
                                        <option value="PROCESAR">PROCESAR</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Detalle de Traslado Section */}
                        <div className="border border-gray-300 rounded-sm bg-white overflow-hidden flex flex-col min-h-[400px]">
                            <div className="bg-gray-100 px-3 py-1 border-b border-gray-300 shrink-0">
                                <span className="text-[11px] font-black text-[#106ebe] uppercase">Detalle de Traslado</span>
                            </div>

                            <div
                                className="flex-1 overflow-auto relative"
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setDetailContextMenu({ x: e.clientX, y: e.clientY, itemIdx: null });
                                }}
                            >
                                <table className="w-full border-collapse table-fixed">
                                    <thead className="bg-[#e8e8e8] sticky top-0 z-10">
                                        <tr className="h-7 border-b border-gray-400">
                                            <th className="w-[3%] px-1 border-r border-gray-300"></th>
                                            <th className="w-[40%] text-left px-3 font-bold border-r border-gray-300 uppercase text-[10px]">Producto</th>
                                            <th className="w-[15%] text-left px-3 font-bold border-r border-gray-300 uppercase text-[10px]">Presentación</th>
                                            <th className="w-[15%] text-center px-3 font-bold border-r border-gray-300 uppercase text-[10px]">Cantidad a Trasladar</th>
                                            <th className="w-[12%] text-right px-3 font-bold border-r border-gray-300 uppercase text-[10px]">Costo Producto</th>
                                            <th className="w-[15%] text-right px-3 font-bold uppercase text-[10px]">Costo Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {items.map((item, idx) => (
                                            <tr
                                                key={idx}
                                                className="h-7 border-b border-gray-100 group"
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setDetailContextMenu({ x: e.clientX, y: e.clientY, itemIdx: idx });
                                                }}
                                            >
                                                <td className="px-1 border-r border-gray-200">
                                                    <button onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </td>
                                                <td className="px-3 border-r border-gray-200 relative">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={item.product_name}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                const newItems = [...items];
                                                                newItems[idx].product_name = val;
                                                                setItems(newItems);
                                                                setSearchTerm(val);
                                                                setShowProductSearch(idx);
                                                                setSearchResults(inventoryItems.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).slice(0, 10));
                                                            }}
                                                            placeholder="Buscar producto..."
                                                            className="w-full text-[11px] outline-none h-6 uppercase font-medium"
                                                        />
                                                    </div>
                                                    {showProductSearch === idx && searchResults.length > 0 && (
                                                        <div className="absolute left-0 right-0 top-full bg-white border border-gray-300 shadow-xl z-[50] max-h-48 overflow-y-auto">
                                                            {searchResults.map(p => (
                                                                <div
                                                                    key={p.id}
                                                                    onClick={() => handleProductSelect(idx, p)}
                                                                    className="px-3 py-1.5 text-[11px] hover:bg-blue-600 hover:text-white cursor-pointer border-b border-gray-50 flex justify-between"
                                                                >
                                                                    <span className="font-bold">{p.name}</span>
                                                                    <span className="opacity-70">{p.presentation}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 border-r border-gray-200 text-[11px] uppercase text-gray-500">{item.presentation}</td>
                                                <td className="px-3 border-r border-gray-200">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={e => handleQuantityChange(idx, Number(e.target.value))}
                                                        className="w-full text-center text-[11px] outline-none h-6 font-bold tabular-nums"
                                                    />
                                                </td>
                                                <td className="px-3 border-r border-gray-200 text-right text-[11px] tabular-nums font-medium">
                                                    Q{item.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-3 text-right text-[11px] tabular-nums font-bold text-[#106ebe]">
                                                    Q{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}

                                    </tbody>
                                </table>
                            </div>

                            {/* Table Footer / Total */}
                            <div className="bg-gray-100 border-t border-gray-400 p-2 flex justify-end items-center px-4 h-10 shrink-0">
                                <div className="flex items-baseline gap-4">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total del Traslado</span>
                                    <span className="text-xl font-black text-[#106ebe] tabular-nums">
                                        Q{calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Info Note */}
                    <div className="bg-[#f0f0f0] px-4 py-1.5 border-t border-gray-300">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">* Verifique los datos antes de procesar el traslado.</p>
                    </div>
                </div>
            </DraggableWindow>

            {/* DETAIL CONTEXT MENU */}
            {detailContextMenu && createPortal(
                <div
                    className="fixed inset-0 z-[100000]"
                    onClick={() => setDetailContextMenu(null)}
                    onContextMenu={(e) => { e.preventDefault(); setDetailContextMenu(null); }}
                >
                    <div
                        className="absolute bg-[#f0f0f0] border border-gray-400 shadow-xl py-1 min-w-[280px] animate-in fade-in duration-75"
                        style={{ left: detailContextMenu.x, top: detailContextMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="w-full text-left px-6 py-2 text-[11px] font-bold hover:bg-[#106ebe] hover:text-white text-black flex items-center gap-3 transition-colors uppercase"
                            onClick={() => {
                                setDetailContextMenu(null);
                                setProductListSearch('');
                                setShowProductListModal(true);
                            }}
                        >
                            <Plus size={14} strokeWidth={3} /> Agregar Productos
                        </button>
                        {detailContextMenu.itemIdx !== null && (
                            <>
                                <div className="h-px bg-gray-300 my-1 mx-2" />
                                <button
                                    className="w-full text-left px-6 py-2 text-[11px] font-bold hover:bg-red-600 hover:text-white text-red-600 flex items-center gap-3 transition-colors uppercase"
                                    onClick={() => {
                                        if (detailContextMenu.itemIdx !== null) handleRemoveItem(detailContextMenu.itemIdx);
                                        setDetailContextMenu(null);
                                    }}
                                >
                                    <Trash2 size={14} /> Quitar Producto de la Lista
                                </button>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* PRODUCT LIST MODAL - AGGREGATE SEARCH */}
            {showProductListModal && createPortal(
                <div className="fixed inset-0 z-[110000] flex items-center justify-center pointer-events-none">
                    <div
                        className="bg-[#f0f0f0] border border-gray-400 shadow-[0_20px_70px_-15px_rgba(0,0,0,0.5)] flex flex-col w-[760px] h-[520px] relative rounded-sm overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-[#106ebe] px-3 py-1.5 flex items-center justify-between text-white shrink-0">
                            <span className="text-[11px] font-bold tracking-wider uppercase flex items-center gap-2">
                                <Search size={14} /> Buscador de Insumos - Listado para Traslado
                            </span>
                            <button onClick={() => setShowProductListModal(false)} className="w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors">
                                <X size={16} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Search bar Area */}
                        <div className="bg-[#f0f0f0] px-4 py-3 flex items-center gap-2 border-b border-gray-300 shrink-0">
                            <input
                                autoFocus
                                type="text"
                                placeholder="INTRODUZCA EL TEXTO A BUSCAR (CÓDIGO O NOMBRE)..."
                                value={productListSearch}
                                onChange={(e) => setProductListSearch(e.target.value)}
                                className="flex-1 h-8 border border-gray-400 px-3 text-[11px] outline-none focus:border-[#106ebe] bg-white font-bold uppercase"
                            />
                            <button className="bg-[#106ebe] text-white px-8 h-8 text-[11px] font-bold uppercase hover:bg-[#002244] shadow-sm">
                                Buscar
                            </button>
                        </div>

                        {/* Table Area */}
                        <div className={`flex-1 overflow-auto bg-white relative ${selectedProductForConfig ? 'pointer-events-none opacity-30 grayscale' : ''}`}>
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="bg-[#e8e8e8] sticky top-0 z-10 border-b border-gray-400 select-none">
                                    <tr className="h-8">
                                        <th className="px-3 text-[10px] font-bold text-black border-r border-gray-300 w-28 uppercase">Código</th>
                                        <th className="px-3 text-[10px] font-bold text-black border-r border-gray-300 uppercase">Producto / Insumo</th>
                                        <th className="px-3 text-[10px] font-bold text-black border-r border-gray-300 w-32 text-center uppercase">Presentación</th>
                                        <th className="px-12 text-[10px] font-bold text-black w-48 text-left uppercase">Proveedor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(productListSearch.length > 0
                                        ? inventoryItems.filter(i => i.name.toLowerCase().includes(productListSearch.toLowerCase()) || (i.code || '').toLowerCase().includes(productListSearch.toLowerCase()))
                                        : inventoryItems
                                    ).map((item) => {
                                        const alreadyAdded = items.some(fi => fi.inventory_item_id === item.id);
                                        return (
                                            <tr
                                                key={item.id}
                                                onDoubleClick={() => {
                                                    setSelectedProductForConfig(item);
                                                    setConfigQty(1);
                                                }}
                                                className={`h-8 cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors group ${alreadyAdded ? 'bg-emerald-50/20' : ''}`}
                                            >
                                                <td className="px-3 text-[10px] border-r border-gray-100 font-mono text-gray-400 truncate">{item.code || '--'}</td>
                                                <td className="px-3 text-[11px] border-r border-gray-100 font-bold uppercase truncate text-gray-800">{item.name}</td>
                                                <td className="px-3 text-[10px] border-r border-gray-100 text-center truncate text-gray-500 uppercase">{item.presentation || 'Galón'}</td>
                                                <td className="px-3 text-[10px] truncate text-gray-400 uppercase">Sin Proveedor</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Table Footer Hint */}
                        <div className="bg-[#e8e8e8] border-t border-gray-300 px-4 py-1.5 flex justify-between items-center shrink-0">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">
                                * Doble clic sobre el insumo para configurar cantidad
                            </span>
                            <span className="text-[10px] font-black text-gray-600 uppercase">
                                {inventoryItems.length} Registros
                            </span>
                        </div>

                        {/* Global Footer */}
                        <div className="bg-[#f0f0f0] border-t border-gray-400 p-3 flex justify-end shrink-0">
                            <button
                                onClick={() => setShowProductListModal(false)}
                                className="bg-[#106ebe] text-white px-10 h-9 text-[11px] font-bold uppercase hover:bg-[#002244] shadow-md flex items-center justify-center"
                            >
                                Salir / Cancelar
                            </button>
                        </div>

                        {/* CONFIGURATION POPUP - EXACT REPLICA */}
                        {selectedProductForConfig && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200 pointer-events-none">
                                <div className="bg-[#f0f0f0] border border-gray-400 shadow-2xl w-[420px] relative rounded-sm overflow-hidden animate-in zoom-in-95 pointer-events-auto">
                                    <div className="bg-[#106ebe] px-3 py-1.5 flex items-center justify-between text-white shadow-sm shrink-0">
                                        <span className="text-[11px] font-bold uppercase tracking-wider">
                                            Configuración - ESC (Cerrar)
                                        </span>
                                        <button onClick={() => setSelectedProductForConfig(null)} className="w-5 h-5 flex items-center justify-center hover:bg-red-600 transition-colors">
                                            <X size={14} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                    <div className="p-6 space-y-3">
                                        {/* Product Field */}
                                        <div className="flex items-center gap-4">
                                            <label className="text-[11px] font-bold text-[#106ebe] w-20 uppercase text-right">Producto</label>
                                            <input
                                                type="text"
                                                disabled
                                                value={selectedProductForConfig.name || ''}
                                                className="flex-1 h-8 border border-gray-400 bg-white/50 px-3 text-[11px] font-bold uppercase text-gray-800"
                                            />
                                        </div>

                                        {/* Quantity Field */}
                                        <div className="flex items-center gap-4">
                                            <label className="text-[11px] font-bold text-[#106ebe] w-20 uppercase text-right">Cantidad</label>
                                            <div className="flex-1 flex gap-px">
                                                <input
                                                    autoFocus
                                                    type="number"
                                                    value={configQty}
                                                    onChange={(e) => setConfigQty(parseFloat(e.target.value) || 0)}
                                                    className="w-24 h-8 border-2 border-gray-300 bg-white px-2 text-[14px] font-black text-center text-[#106ebe] outline-none focus:border-[#106ebe] tabular-nums"
                                                />
                                                <select
                                                    value={configUnit}
                                                    onChange={(e) => setConfigUnit(e.target.value)}
                                                    className="flex-1 h-8 border-2 border-gray-300 bg-white px-2 text-[10px] font-bold uppercase text-gray-600 outline-none focus:border-[#106ebe]"
                                                >
                                                    {(() => {
                                                        const unit = selectedProductForConfig.unit?.toUpperCase() || 'UNIDAD';
                                                        const category = INVENTORY_UNITS[unit]?.category || 'Conteo';

                                                        if (category === 'Volumen') {
                                                            return (
                                                                <>
                                                                    <option value="Mililitro">Mililitro (ML)</option>
                                                                    <option value="FL OZ">Onza LÍQ. (FL OZ)</option>
                                                                    <option value="Litro">Litro (LT)</option>
                                                                </>
                                                            );
                                                        } else if (category === 'Masa') {
                                                            return (
                                                                <>
                                                                    <option value="Gramo">Gramo (GR)</option>
                                                                    <option value="Onza">Onza (OZ)</option>
                                                                    <option value="Libra">Libra (LB)</option>
                                                                    <option value="Kilogramo">Kilogramo (KG)</option>
                                                                </>
                                                            );
                                                        } else {
                                                            return <option value="Unidad">Unidad (UN)</option>;
                                                        }
                                                    })()}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        <div className="flex flex-col items-center pt-4 gap-3">
                                            <button
                                                onClick={() => {
                                                    setItems(prev => [...prev, {
                                                        inventory_item_id: selectedProductForConfig.id,
                                                        product_name: selectedProductForConfig.name,
                                                        presentation: selectedProductForConfig.presentation || '',
                                                        quantity: configQty,
                                                        unit: configUnit,
                                                        cost: selectedProductForConfig.cost || 0,
                                                        total: configQty * (selectedProductForConfig.cost || 0)
                                                    }]);
                                                    setSelectedProductForConfig(null);
                                                    setShowProductListModal(false);
                                                }}
                                                className="w-36 h-9 bg-[#106ebe] text-white text-[11px] font-black hover:bg-[#002244] uppercase shadow-md active:scale-95 transition-all"
                                            >
                                                Agregar
                                            </button>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                                Presiona ESC para cancelar
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
