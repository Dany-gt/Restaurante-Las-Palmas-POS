import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { DraggableWindow } from '../shared/DraggableWindow';
import { WindowsSaveButton } from '../../WindowsSaveButton';

interface ProductoModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingId: string | null;
    newProduct: any;
    setNewProduct: (val: any) => void;
    handleSave: () => void;
    isSaving: boolean;
    inventoryCategories?: any[];
    suppliers?: any[];
    branches?: any[];
    branchInventory?: any[];
    setBranchInventory?: (val: any[]) => void;
    setRecipeItems?: (val: any[]) => void;
    searchModal?: (val: any) => void;
    setRecipeContextMenu?: any;
    setShowQuickCatModal?: any;
    openPicker?: any;
    setOpenPicker?: any;
}

const CustomSelect = ({ value, onChange, options, placeholder = "Seleccionar..." }: { value: string, onChange: (v: string) => void, options: {value: string, label: string}[], placeholder?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;
    return (
        <div className="relative flex-1">
            <div 
                className="h-6 bg-white border border-gray-400 px-1 text-[11px] text-[#202020] flex items-center justify-between cursor-pointer outline-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{selectedLabel}</span>
                <span className="text-[8px] text-[#202020] ml-1">▼</span>
            </div>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-[1px] max-h-[140px] overflow-y-auto bg-white border border-gray-400 shadow-lg z-50 drop-shadow-md custom-scrollbar">
                        <div 
                            className="px-2 py-1 text-[11px] hover:bg-[#106ebe] hover:text-white cursor-pointer text-gray-500 italic"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                        >
                            {placeholder}
                        </div>
                        {options.map(o => (
                            <div 
                                key={o.value} 
                                className="px-2 py-1.5 text-[11px] text-[#202020] hover:bg-[#106ebe] hover:text-white cursor-pointer truncate border-b border-gray-100 last:border-b-0"
                                onClick={() => { onChange(o.value); setIsOpen(false); }}
                                title={o.label}
                            >
                                {o.label}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export const ProductoModal: React.FC<ProductoModalProps> = ({
    isOpen, onClose, editingId, newProduct, setNewProduct, handleSave, isSaving,
    inventoryCategories = [], suppliers = [], branches = [], branchInventory = [], setBranchInventory,
    recipeItems = [], setRecipeItems, searchModal, setRecipeContextMenu
}) => {
    const [activeTab, setActiveTab] = useState<'sucursales' | 'receta'>('sucursales');

    if (!isOpen || !newProduct) return null;

    const totalReceta = (recipeItems || []).reduce((acc: number, ri: any) => {
        const qty = parseFloat(ri.quantity) || 0;
        const cost = parseFloat(ri.inventory_items?.cost_price) || 0;
        const factor = parseFloat(ri.inventory_items?.conversion_factor) || 1;
        const baseCost = cost / factor;

        // LÓGICA DE CONVERSIÓN DE UNIDADES (Prorrateo Inteligente)
        let unitFactor = 1;
        const selectedUnit = (ri.unit_measure || '').toLowerCase();
        const baseUnit = (ri.inventory_items?.unit_measure || ri.unit_measure || '').toLowerCase();

        // 0. Caso especial: UNIDADES (No dividir por factor si se usa como Unidad)
        if (selectedUnit === 'unidad') {
            return acc + (qty * cost);
        }

        // 1. Unidades de PESO (Base Libra)
        if (baseUnit.includes('libra') || baseUnit === 'lb') {
            if (selectedUnit.includes('onza')) unitFactor = 1 / 16;
            if (selectedUnit.includes('gramo')) unitFactor = 1 / 453.592;
        }
        // 2. Unidades de PESO (Base Kilo)
        else if (baseUnit.includes('kilo') || baseUnit === 'kg') {
            if (selectedUnit.includes('gramo')) unitFactor = 1 / 1000;
            if (selectedUnit.includes('onza')) unitFactor = 1 / 35.274;
        }
        // 3. Unidades de VOLUMEN (Base Mililitro / Litro)
        else if (baseUnit.includes('litro') || baseUnit === 'lt' || baseUnit.includes('mililitro') || baseUnit === 'ml' || baseUnit.includes('onza')) {
            let baseInMl = 1;
            if (baseUnit.includes('litro') || baseUnit === 'lt') baseInMl = 1000;
            if (baseUnit.includes('onza')) baseInMl = 29.5735;

            let selectedInMl = 1;
            if (selectedUnit.includes('mililitro') || selectedUnit === 'ml') selectedInMl = 1;
            if (selectedUnit.includes('onza')) selectedInMl = 29.5735;
            if (selectedUnit.includes('litro')) selectedInMl = 1000;

            unitFactor = selectedInMl / baseInMl;
        }

        return acc + (qty * baseCost * unitFactor);
    }, 0);


    const safeBranchInventory = branchInventory || [];
    const safeBranches = branches || [];
    const safeCategories = inventoryCategories || [];
    const safeSuppliers = suppliers || [];

    const handleUpdateBranchQuantity = (branchId: string, value: string) => {
        if (!setBranchInventory) return;
        setBranchInventory(safeBranchInventory.map(bi => 
            bi.branch_id === branchId ? { ...bi, quantity: value } : bi
        ));
    };

    const handleUpdateBranchReorder = (branchId: string, value: string) => {
        if (!setBranchInventory) return;
        setBranchInventory(safeBranchInventory.map(bi => 
            bi.branch_id === branchId ? { ...bi, min_stock: value } : bi
        ));
    };

    const handleUpdateBranchEnabled = (branchId: string, key: string, value: boolean) => {
        if (!setBranchInventory) return;
        setBranchInventory(safeBranchInventory.map(bi => 
            bi.branch_id === branchId ? { ...bi, [key]: value } : bi
        ));
    };

    return createPortal(
        <div className="fixed inset-0 z-[2000000] flex items-center justify-center p-2 bg-black/5 pointer-events-none font-sans overflow-hidden">
            <div className="absolute inset-0 pointer-events-auto" onClick={onClose}></div>
            <div className="pointer-events-auto">
                <DraggableWindow>
                    <div className="bg-white border border-[#106ebe] w-[750px] shadow-[0_25px_80px_rgba(0,0,0,0.35)] flex flex-col font-sans animate-in zoom-in-95 duration-100">
                        {/* Windows Title Bar */}
                        <div className="modal-header bg-[#106ebe] h-[34px] flex justify-between items-center pl-3 pr-1 shrink-0 cursor-move active:cursor-grabbing">
                            <span className="text-white text-[12px] font-bold tracking-wide">Mantenimiento de Productos</span>
                            <div className="flex items-center gap-1">
                                <WindowsSaveButton 
                                    onClick={handleSave} 
                                    loading={isSaving}
                                    title="Guardar"
                                    className={`w-[28px] h-[26px] flex items-center justify-center transition-all border border-transparent rounded-sm ${isSaving ? 'opacity-50 cursor-wait' : 'hover:bg-[#1a7cd8] hover:border-[#3891e6]'}`}
                                />
                                <button 
                                    onClick={onClose}
                                    title="Cerrar"
                                    className="w-[34px] h-[26px] bg-[#e81123] hover:bg-[#f1707a] flex items-center justify-center transition-colors shadow-sm ml-1"
                                >
                                    <X className="text-white" size={16} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-3 gap-3 flex flex-col">
                            {/* Datos de Producto Section */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[#106ebe] text-[13px] font-bold font-[Arial]">Datos de Producto</span>
                                <div className="flex flex-col gap-2">
                                    <div className="grid grid-cols-[165px_1fr] items-center gap-2 pr-8">
                                        <label className="text-[11px] text-[#202020] font-[Arial]">Código</label>
                                        <input 
                                            type="text" 
                                            value={newProduct.product_code || ''}
                                            onChange={e => setNewProduct({...newProduct, product_code: e.target.value})}
                                            className="h-6 border border-gray-400 px-2 text-[11px] w-full outline-none focus:border-blue-500" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-[165px_1fr] items-center gap-2 pr-8">
                                        <label className="text-[11px] text-[#202020] font-[Arial]">Producto</label>
                                        <input 
                                            type="text" 
                                            value={newProduct.name || ''}
                                            onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                                            className="h-6 border border-gray-400 px-2 text-[11px] w-full outline-none focus:border-[#106ebe] focus:bg-white" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-[165px_1fr_100px_1fr] items-center gap-2 pr-8">
                                        <label className="text-[11px] text-[#202020] font-[Arial]">Unidad de Medida</label>
                                        <CustomSelect 
                                            value={newProduct.unit_measure || ''}
                                            onChange={v => setNewProduct({...newProduct, unit_measure: v})}
                                            options={[
                                                {value: 'Mililitro', label: 'Mililitro'},
                                                {value: 'Gramo', label: 'Gramo'},
                                                {value: 'Onza', label: 'Onza'},
                                                {value: 'Litro', label: 'Litro'},
                                                {value: 'Libra', label: 'Libra'},
                                                {value: 'Kilogramo', label: 'Kilogramo'},
                                                {value: 'Unidad', label: 'Unidad'}
                                            ]}
                                        />
                                        <label className="text-[11px] text-[#202020] font-[Arial] pl-2">Presentación</label>
                                        <CustomSelect 
                                            value={newProduct.presentation_unit || ''}
                                            onChange={v => setNewProduct({...newProduct, presentation_unit: v})}
                                            options={[
                                                {value: 'Frasco', label: 'Frasco'},
                                                {value: 'Botella', label: 'Botella'},
                                                {value: 'Caja', label: 'Caja'},
                                                {value: 'Saco', label: 'Saco'},
                                                {value: 'Bolsa', label: 'Bolsa'},
                                                {value: 'Lata', label: 'Lata'},
                                                {value: 'Galón', label: 'Galón'},
                                                {value: 'Garrafón', label: 'Garrafón'},
                                                {value: 'Paquete', label: 'Paquete'},
                                                {value: 'Unidad', label: 'Unidad'}
                                            ]}
                                        />
                                    </div>
                                    <div className="grid grid-cols-[165px_1fr_100px_1fr] items-center gap-2 pr-8">
                                        <label className="text-[8.5px] tracking-tighter whitespace-nowrap text-[#202020] font-[Arial]">
                                            {`Cantidad de ${newProduct.unit_measure === 'Mililitro' ? 'ml' : newProduct.unit_measure === 'Gramo' ? 'g' : newProduct.unit_measure === 'Litro' ? 'L' : newProduct.unit_measure === 'Libra' ? 'lb' : newProduct.unit_measure === 'Kilogramo' ? 'kg' : newProduct.unit_measure === 'Onza' ? 'oz' : newProduct.unit_measure || 'ml'} en 1 ${newProduct.presentation_unit || 'Frasco'}`}
                                        </label>
                                        <input 
                                            type="text" 
                                            value={newProduct.conversion_factor ? newProduct.conversion_factor.toString().split('.').map((p: string, i: number) => i === 0 ? p.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : p).join('.') : ''}
                                            onChange={e => {
                                                const raw = e.target.value.replace(/,/g, '');
                                                if (/^\d*\.?\d*$/.test(raw)) {
                                                    setNewProduct({...newProduct, conversion_factor: raw});
                                                }
                                            }}
                                            className="h-6 border border-gray-400 px-2 text-[11px] text-center outline-none focus:border-blue-500 font-bold" 
                                        />
                                        <label className="text-[11px] text-[#202020] font-[Arial] pl-2">Precio Costo</label>
                                        <div className="relative">
                                            <span className="absolute left-2 top-1.5 text-[11px] text-gray-500">Q</span>
                                            <input 
                                                type="text" 
                                                value={newProduct.cost_price ? newProduct.cost_price.toString().split('.').map((p: string, i: number) => i === 0 ? p.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : p).join('.') : ''}
                                                onChange={e => {
                                                    const raw = e.target.value.replace(/,/g, '');
                                                    if (/^\d*\.?\d*$/.test(raw)) {
                                                        setNewProduct({...newProduct, cost_price: raw});
                                                    }
                                                }}
                                                className="h-6 w-full border border-gray-400 pl-6 pr-2 text-[11px] text-center outline-none focus:border-blue-500 font-bold" 
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[165px_1fr] items-center gap-2 pr-8">
                                        <label className="text-[11px] text-[#202020] font-[Arial]">Categoría</label>
                                        <CustomSelect 
                                            value={newProduct.category_id || ''}
                                            onChange={v => setNewProduct({...newProduct, category_id: v})}
                                            options={(() => {
                                                const catMap = new Map(safeCategories.map(c => [c.id, c]));
                                                return safeCategories.map(c => {
                                                    const parent = c.parent_id ? catMap.get(c.parent_id) : null;
                                                    const label = parent 
                                                        ? `${(parent.nombre || parent.name).toUpperCase()} > ${(c.nombre || c.name).toUpperCase()}`
                                                        : (c.nombre || c.name || '').toUpperCase();
                                                    return { value: c.id, label };
                                                }).sort((a, b) => a.label.localeCompare(b.label));
                                            })()}
                                        />
                                    </div>
                                    <div className="grid grid-cols-[165px_1fr] items-center gap-2 pr-8">
                                        <label className="text-[11px] text-[#202020] font-[Arial]">Proveedor</label>
                                        <CustomSelect 
                                            value={newProduct.supplier_id || ''}
                                            onChange={v => setNewProduct({...newProduct, supplier_id: v})}
                                            options={safeSuppliers.map(c => ({ value: c.id, label: c.name }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Configuración Section */}
                            <div className="flex flex-col mt-2 gap-1 mb-1">
                                <span className="text-[#106ebe] text-[13px] font-bold font-[Arial]">Configuración</span>
                                <div className="bg-white border-t border-gray-200 flex flex-col gap-0 relative pt-5">
                                    {/* Sub-tabs header superimposed on top padding */}
                                    <div className="absolute top-0 left-0 right-0 h-[24px] flex z-10">
                                        <button 
                                            className={`px-4 text-[11px] font-[Arial] border border-gray-300 rounded-t-sm transition-all overflow-hidden ${activeTab === 'sucursales' ? 'bg-white font-bold text-black border-b-white border-t-white relative z-20 mt-[-1px] h-[26px]' : 'bg-[#e4e4e4] text-gray-700 hover:bg-[#d4d4d4] border-b-gray-300 mt-[1px] h-[23px]'}`} 
                                            onClick={() => setActiveTab('sucursales')}
                                        >
                                            Sucursales
                                        </button>
                                        <button 
                                            className={`px-4 text-[11px] font-[Arial] border border-gray-300 border-l-0 rounded-t-sm transition-all overflow-hidden ${activeTab === 'receta' ? 'bg-white font-bold text-black border-b-white border-t-white border-l border-l-gray-300 relative z-20 mt-[-1px] h-[26px]' : 'bg-[#e4e4e4] text-gray-700 hover:bg-[#d4d4d4] border-b-gray-300 mt-[1px] h-[23px]'}`} 
                                            onClick={() => setActiveTab('receta')}
                                        >
                                            Receta
                                        </button>
                                        <div className="flex-1 border-b border-gray-300 mt-[23px]"></div>
                                    </div>
                                    
                                    {/* Tab Content Area */}
                                    <div className="bg-white border border-gray-300 border-t-0 p-2 h-[180px] flex flex-col z-10 relative">
                                        {activeTab === 'sucursales' && (
                                            <div className="flex-1 border border-gray-300 overflow-y-auto custom-scrollbar flex flex-col">
                                                <table className="w-full border-collapse">
                                                    <thead className="sticky top-0 z-10 select-none">
                                                        <tr className="bg-[#f0f0f0] h-[22px]">
                                                            <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-r border-b border-gray-400 border-t-white border-l-white bg-[#f0f0f0] shadow-[inset_1px_1px_0_white] text-left">Sucursal</th>
                                                            <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-r border-b border-gray-400 border-t-white border-l-white bg-[#f0f0f0] shadow-[inset_1px_1px_0_white] text-center w-28">Existencia</th>
                                                            <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-r border-b border-gray-400 border-t-white border-l-white bg-[#f0f0f0] shadow-[inset_1px_1px_0_white] text-center w-36">Punto de Reorden</th>
                                                            <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-r border-b border-gray-400 border-t-white border-l-white bg-[#f0f0f0] shadow-[inset_1px_1px_0_white] text-center w-24">Habilitado</th>
                                                            <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-b border-gray-400 border-t-white border-l-white bg-[#f0f0f0] shadow-[inset_1px_1px_0_white] text-center w-32">Asignado</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {safeBranches.map((b, idx) => {
                                                            const bi = safeBranchInventory.find((i: any) => i.branch_id === b.id) || {
                                                                quantity: '0', min_stock: '0', is_enabled: true, is_assigned: true
                                                            };
                                                            return (
                                                                <tr key={b.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f9f9f9]'} hover:bg-[#e8f2fe] transition-colors`}>
                                                                    <td className="px-2 py-1 border-r border-gray-200 text-[11px] text-[#202020] font-[Arial]">{b.name}</td>
                                                                    <td className="px-1 border-r border-gray-200">
                                                                        <input 
                                                                            type="text"
                                                                            value={bi.quantity ? bi.quantity.toString().split('.').map((p: string, i: number) => i === 0 ? p.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : p).join('.') : '0'}
                                                                            onChange={(e) => {
                                                                                const raw = e.target.value.replace(/,/g, '');
                                                                                if (/^\d*\.?\d*$/.test(raw)) {
                                                                                    handleUpdateBranchQuantity(b.id, raw);
                                                                                }
                                                                            }}
                                                                            className="w-full text-center px-1 text-[11px] font-bold font-[Arial] h-6 bg-transparent outline-none focus:bg-white focus:border focus:border-blue-400"
                                                                        />
                                                                    </td>
                                                                    <td className="px-1 border-r border-gray-200">
                                                                        <input 
                                                                            type="text"
                                                                            value={bi.min_stock ? bi.min_stock.toString().split('.').map((p: string, i: number) => i === 0 ? p.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : p).join('.') : '0'}
                                                                            onChange={(e) => {
                                                                                const raw = e.target.value.replace(/,/g, '');
                                                                                if (/^\d*\.?\d*$/.test(raw)) {
                                                                                    handleUpdateBranchReorder(b.id, raw);
                                                                                }
                                                                            }}
                                                                            className="w-full text-center px-1 text-[11px] font-bold font-[Arial] h-6 bg-transparent outline-none focus:bg-white focus:border focus:border-blue-400"
                                                                        />
                                                                    </td>
                                                                    <td className="px-2 py-0.5 border-r border-gray-200 text-center">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={bi.is_enabled !== false} 
                                                                            onChange={(e) => handleUpdateBranchEnabled(b.id, 'is_enabled', e.target.checked)}
                                                                            className="w-[11px] h-[11px]" 
                                                                        />
                                                                    </td>
                                                                    <td className="px-2 py-0.5 border-gray-200 text-center">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={bi.is_assigned !== false} 
                                                                            onChange={(e) => handleUpdateBranchEnabled(b.id, 'is_assigned', e.target.checked)}
                                                                            className="w-[11px] h-[11px]" 
                                                                        />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        {activeTab === 'receta' && (
                                            <div 
                                                className="flex-1 border border-gray-300 flex flex-col bg-white overflow-hidden"
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setRecipeContextMenu && setRecipeContextMenu({
                                                        visible: true,
                                                        x: e.clientX,
                                                        y: e.clientY,
                                                        itemIdx: undefined
                                                    });
                                                }}
                                            >
                                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                    <table className="w-full border-collapse">
                                                        <thead className="sticky top-0 z-10 select-none bg-[#f0f0f0]">
                                                            <tr className="h-[22px]">
                                                                <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-r border-b border-gray-400 border-t-white border-l-white shadow-[inset_1px_1px_0_white] text-left">Producto</th>
                                                                <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-r border-b border-gray-400 border-t-white border-l-white shadow-[inset_1px_1px_0_white] text-center w-24">Cantidad</th>
                                                                <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-r border-b border-gray-400 border-t-white border-l-white shadow-[inset_1px_1px_0_white] text-center w-24">Medida</th>
                                                                <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-r border-b border-gray-400 border-t-white border-l-white shadow-[inset_1px_1px_0_white] text-center w-24">Precio Costo</th>
                                                                <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-b border-gray-400 border-t-white border-l-white shadow-[inset_1px_1px_0_white] text-center w-4 invisible"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(recipeItems || []).length > 0 ? (recipeItems || []).map((ri, idx) => {
                                                                const qty = parseFloat(ri.quantity) || 0;
                                                                const cost = parseFloat(ri.inventory_items?.cost_price) || 0;
                                                                const factor = parseFloat(ri.inventory_items?.conversion_factor) || 1;
                                                                const baseCost = cost / factor;

                                                                // LÓGICA DE CONVERSIÓN DE UNIDADES (Prorrateo Inteligente)
                                                                let unitFactor = 1;
                                                                const selectedUnit = (ri.unit_measure || '').toLowerCase();
                                                                const baseUnit = (ri.inventory_items?.unit_measure || ri.unit_measure || '').toLowerCase();

                                                                // 0. Caso especial: UNIDADES (No dividir por factor para unidad entera)
                                                                if (selectedUnit === 'unidad') {
                                                                    const lineCost = qty * cost;
                                                                    return (
                                                                        <tr 
                                                                            key={ri.id || idx} 
                                                                            className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f9f9f9]'} hover:bg-[#e8f2fe] transition-colors`}
                                                                            onContextMenu={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                setRecipeContextMenu && setRecipeContextMenu({
                                                                                    visible: true,
                                                                                    x: e.clientX,
                                                                                    y: e.clientY,
                                                                                    itemIdx: idx
                                                                                });
                                                                            }}
                                                                        >
                                                                            <td className="px-2 py-1 border-r border-gray-200 text-[11px] text-[#202020] font-[Arial] uppercase truncate">
                                                                                {ri.inventory_items?.name || 'DESCONOCIDO'}
                                                                            </td>
                                                                            <td className="px-1 border-r border-gray-200">
                                                                                <input 
                                                                                    type="text"
                                                                                    value={ri.quantity ? ri.quantity.toString().split('.').map((p: any, i: number) => i === 0 ? p.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : p).join('.') : '0'}
                                                                                    onChange={(e) => {
                                                                                        const raw = e.target.value.replace(/,/g, '');
                                                                                        if (/^\d*\.?\d*$/.test(raw)) {
                                                                                            const newItems = [...(recipeItems || [])];
                                                                                            newItems[idx].quantity = raw;
                                                                                            setRecipeItems && setRecipeItems(newItems);
                                                                                        }
                                                                                    }}
                                                                                    className="w-full text-center px-1 text-[11px] font-bold font-[Arial] h-6 bg-transparent outline-none focus:bg-white focus:border focus:border-blue-400"
                                                                                />
                                                                            </td>
                                                                            <td className="px-2 py-1 border-r border-gray-200 text-center text-[10px] text-[#202020] font-[Arial] uppercase">
                                                                                {ri.unit_measure || ri.inventory_items?.unit_measure || 'UNI'}
                                                                            </td>
                                                                            <td className="px-2 py-1 border-r border-gray-200 text-right text-[11px] text-[#106ebe] font-black font-[Arial] tabular-nums">
                                                                                {lineCost.toFixed(2)}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                }

                                                                // 1. Unidades de PESO (Base Libra)
                                                                if (baseUnit.includes('libra') || baseUnit === 'lb') {
                                                                    if (selectedUnit.includes('onza')) unitFactor = 1 / 16;
                                                                    if (selectedUnit.includes('gramo')) unitFactor = 1 / 453.592;
                                                                }
                                                                // 2. Unidades de PESO (Base Kilo)
                                                                else if (baseUnit.includes('kilo') || baseUnit === 'kg') {
                                                                    if (selectedUnit.includes('gramo')) unitFactor = 1 / 1000;
                                                                    if (selectedUnit.includes('onza')) unitFactor = 1 / 35.274;
                                                                }
                                                                // 3. Unidades de VOLUMEN (Base Mililitro / Litro)
                                                                else if (baseUnit.includes('litro') || baseUnit === 'lt' || baseUnit.includes('mililitro') || baseUnit === 'ml' || baseUnit.includes('onza')) {
                                                                    let baseInMl = 1;
                                                                    if (baseUnit.includes('litro') || baseUnit === 'lt') baseInMl = 1000;
                                                                    if (baseUnit.includes('onza')) baseInMl = 29.5735;

                                                                    let selectedInMl = 1;
                                                                    if (selectedUnit.includes('mililitro') || selectedUnit === 'ml') selectedInMl = 1;
                                                                    if (selectedUnit.includes('onza')) selectedInMl = 29.5735;
                                                                    if (selectedUnit.includes('litro')) selectedInMl = 1000;

                                                                    unitFactor = selectedInMl / baseInMl;
                                                                }

                                                                const lineCost = qty * baseCost * unitFactor;
                                                                return (
                                                                <tr 
                                                                    key={ri.id || idx} 
                                                                    className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f9f9f9]'} hover:bg-[#e8f2fe] transition-colors`}
                                                                    onContextMenu={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setRecipeContextMenu && setRecipeContextMenu({
                                                                            visible: true,
                                                                            x: e.clientX,
                                                                            y: e.clientY,
                                                                            itemIdx: idx
                                                                        });
                                                                    }}
                                                                >
                                                                    <td className="px-2 py-1 border-r border-gray-200 text-[11px] text-[#202020] font-[Arial] uppercase truncate">
                                                                        {ri.inventory_items?.name || 'DESCONOCIDO'}
                                                                    </td>
                                                                    <td className="px-1 border-r border-gray-200">
                                                                        <input 
                                                                            type="text"
                                                                            value={ri.quantity ? ri.quantity.toString().split('.').map((p: any, i: number) => i === 0 ? p.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : p).join('.') : '0'}
                                                                            onChange={(e) => {
                                                                                const raw = e.target.value.replace(/,/g, '');
                                                                                if (/^\d*\.?\d*$/.test(raw)) {
                                                                                    const newItems = [...(recipeItems || [])];
                                                                                    newItems[idx].quantity = raw;
                                                                                    setRecipeItems && setRecipeItems(newItems);
                                                                                }
                                                                            }}
                                                                            className="w-full text-center px-1 text-[11px] font-bold font-[Arial] h-6 bg-transparent outline-none focus:bg-white focus:border focus:border-blue-400"
                                                                        />
                                                                    </td>
                                                                    <td className="px-2 py-1 border-r border-gray-200 text-center text-[10px] text-[#202020] font-[Arial] uppercase">
                                                                        {ri.unit_measure || ri.inventory_items?.unit_measure || 'UNI'}
                                                                    </td>
                                                                    <td className="px-2 py-1 border-r border-gray-200 text-right text-[11px] text-[#106ebe] font-black font-[Arial] tabular-nums">
                                                                        {lineCost.toFixed(2)}
                                                                    </td>
                                                                    <td className="px-2 py-1 text-center invisible w-0 p-0 overflow-hidden">
                                                                        {/* Removed trash can to force use of context menu */}
                                                                    </td>
                                                                </tr>
                                                            );
                                                            }) : (
                                                                <tr>
                                                                    <td colSpan={5} className="py-10 text-center text-[11px] text-gray-400 font-bold uppercase italic select-none">
                                                                        No hay insumos agregados a esta receta.
                                                                        <div className="text-[9px] mt-1 opacity-60 font-black tracking-widest">[ CLIC DERECHO PARA AGREGAR ]</div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {/* Total fijo al fondo */}
                                                <div className="bg-[#f5f5f5] border-t-2 border-gray-400 h-[26px] flex items-center justify-end px-2 select-none shadow-[0_-1px_3px_rgba(0,0,0,0.1)]">
                                                    <span className="text-[10px] font-black uppercase text-gray-600 mr-4">Total Receta Estimado:</span>
                                                    <span className="text-[12px] font-black text-[#106ebe] min-w-[120px] text-right">
                                                        Q {totalReceta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DraggableWindow>
            </div>
        </div>,
        document.body
    );
};
