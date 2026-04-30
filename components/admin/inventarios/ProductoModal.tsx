import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2, ChefHat, FileText, Printer, Sparkles, Loader2, BookOpen, Layers, AlertCircle } from 'lucide-react';
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

const SmartPriceInput = ({ value, onChange, className = "" }: any) => {
    const [isFocused, setIsFocused] = React.useState(false);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.toUpperCase().replace('Q', '').replace(/[^0-9.]/g, '');
        const parts = raw.split('.');
        if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
        if (parts.length === 2 && parts[1].length > 2) {
            raw = parts[0] + '.' + parts[1].substring(0, 2);
        }
        onChange(raw);
    };

    const displayValue = isFocused 
        ? (value ? `Q${value}` : "Q")
        : (value ? `Q${parseFloat(value).toFixed(2)}` : "Q0.00");

    const inputRef = React.useRef<HTMLInputElement>(null);

    return (
        <div 
            className={`flex-1 flex items-center border border-gray-400 bg-white h-6 shadow-sm relative cursor-text px-2 ${className}`}
            onClick={() => inputRef.current?.focus()}
        >
            <input
                ref={inputRef}
                type="text"
                className="w-full h-5 text-[11px] font-bold outline-none bg-transparent text-center text-slate-900 selection:bg-[#3399ff] selection:text-white"
                value={displayValue}
                onChange={handleChange}
                onFocus={(e) => {
                    setIsFocused(true);
                    setTimeout(() => e.target.select(), 0);
                }}
                onBlur={() => {
                    setIsFocused(false);
                    if (value) {
                        const num = parseFloat(value);
                        if (!isNaN(num)) onChange(num.toFixed(2));
                    }
                }}
            />
        </div>
    );
};

export const ProductoModal: React.FC<ProductoModalProps> = ({
    isOpen, onClose, editingId, newProduct, setNewProduct, handleSave, isSaving,
    inventoryCategories = [], suppliers = [], branches = [], branchInventory = [], setBranchInventory,
    recipeItems = [], setRecipeItems, searchModal, setRecipeContextMenu
}) => {
    const [activeTab, setActiveTab] = useState<'sucursales' | 'receta'>('sucursales');
    const [showFichaModal, setShowFichaModal] = useState(false);
    const [isImproving, setIsImproving] = useState(false);

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

    const handleImproveText = async (field: 'prep_procedure' | 'observations') => {
        const textToImprove = newProduct[field];
        if (!textToImprove) return;
        setIsImproving(true);
        try {
            const systemPrompt = 'Eres un experto en redacción técnica culinaria. ' +
                'Revisa el siguiente texto para corregir errores ortográficos, gramaticales y de puntuación, mejorando la fluidez sin alterar el contenido original. ' +
                'Devuelve ÚNICAMENTE el texto corregido.';
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.0-flash',
                    prompt: systemPrompt + '\n\nTEXTO A MEJORAR:\n' + textToImprove,
                    temperature: 0.3
                })
            });
            if (response.ok) {
                const data = await response.json();
                if (data.text) setNewProduct({ ...newProduct, [field]: data.text.trim() });
            }
        } catch (error) {
            console.error('Error improving text:', error);
        } finally {
            setIsImproving(false);
        }
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
                                            onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                                            className="h-6 border border-gray-400 px-2 text-[11px] w-full outline-none focus:border-blue-500 selection:bg-[#3399ff] selection:text-white" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-[165px_1fr] items-center gap-2 pr-8">
                                        <label className="text-[11px] text-[#202020] font-[Arial]">Producto</label>
                                        <input 
                                            type="text" 
                                            value={newProduct.name || ''}
                                            onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                                            onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                                            className="h-6 border border-gray-400 px-2 text-[11px] w-full outline-none focus:border-[#106ebe] focus:bg-white selection:bg-[#3399ff] selection:text-white" 
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
                                                {value: 'Bote', label: 'Bote'},
                                                {value: 'Caja', label: 'Caja'},
                                                {value: 'Saco', label: 'Saco'},
                                                {value: 'Bolsa', label: 'Bolsa'},
                                                {value: 'Sobre', label: 'Sobre'},
                                                {value: 'Lata', label: 'Lata'},
                                                {value: 'Galón', label: 'Galón'},
                                                {value: 'Litro', label: 'Litro'},
                                                {value: 'Tonel', label: 'Tonel'},
                                                {value: 'Bidón', label: 'Bidón'},
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
                                            onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                                            className="h-6 border border-gray-400 px-2 text-[11px] text-center outline-none focus:border-blue-500 font-bold selection:bg-[#3399ff] selection:text-white" 
                                        />
                                        <label className="text-[11px] text-[#202020] font-[Arial] pl-2">Precio Costo</label>
                                        <SmartPriceInput 
                                            value={newProduct.cost_price}
                                            onChange={(v: string) => setNewProduct({...newProduct, cost_price: v})}
                                        />
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
                                    <div className="bg-white border border-gray-300 border-t-0 p-2 h-[320px] flex flex-col z-10 relative">
                                        {activeTab === 'sucursales' && (
                                            <div className="flex-1 border border-gray-300 overflow-y-auto custom-scrollbar flex flex-col">
                                                <table className="w-full border-collapse">
                                                    <thead className="sticky top-0 z-10 select-none">
                                                        <tr className="bg-[#f0f0f0] h-[22px]">
                                                            <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-r border-b border-gray-400 border-t-white border-l-white bg-[#f0f0f0] shadow-[inset_1px_1px_0_white] text-center">Sucursal</th>
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
                                                                <th className="px-2 border-r border-b border-gray-400 bg-white" colSpan={5}>
                                                                    <div className="flex items-center justify-between py-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <BookOpen size={13} className="text-[#106ebe]" />
                                                                            <span className="text-[10px] font-bold text-slate-700 uppercase">Insumos de Receta</span>
                                                                        </div>
                                                                        <button 
                                                                            onClick={() => setShowFichaModal(true)}
                                                                            className="bg-white border border-gray-400 text-slate-700 px-3 h-5 text-[9px] font-bold uppercase tracking-tight flex items-center gap-2 rounded-sm shadow-sm hover:bg-gray-50"
                                                                        >
                                                                            <FileText size={12} className="text-[#106ebe]" /> Ficha Técnica Pro
                                                                        </button>
                                                                    </div>
                                                                </th>
                                                            </tr>
                                                            <tr className="h-[22px]">
                                                                <th className="font-[Arial] text-[11px] text-[#202020] px-2 border-r border-b border-gray-400 border-t-white border-l-white shadow-[inset_1px_1px_0_white] text-center">Producto</th>
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

                        {/* Ficha Técnica Modal Tal como en Platillos */}
                        {showFichaModal && createPortal(
                            <div className="fixed inset-0 z-[3000000] flex items-center justify-center p-4 bg-black/5">
                                <DraggableWindow>
                                    <div className="bg-white border border-[#106ebe] shadow-[0_0_40px_rgba(0,0,0,0.5)] w-[900px] h-[85vh] flex flex-col overflow-hidden rounded-sm animate-in zoom-in-95 duration-200">
                                        {/* Header Style Dish Modal */}
                                        <div className="bg-[#106ebe] h-8 px-3 flex justify-between items-center text-white shrink-0 modal-header cursor-move shadow-md">
                                            <div className="flex items-center gap-2">
                                                <ChefHat size={14} className="text-white" />
                                                <span className="text-[11px] font-bold uppercase tracking-tight">Ficha Técnica: {newProduct.name || 'NUEVA'}</span>
                                            </div>
                                            <div className="flex items-center h-full">
                                                <button
                                                    onClick={() => window.print()}
                                                    className="h-full px-4 flex items-center gap-2 hover:bg-white/10 text-white border-r border-white/10 text-[9px] font-bold uppercase"
                                                >
                                                    <Printer size={14} /> IMPRIMIR
                                                </button>
                                                <button onClick={() => setShowFichaModal(false)} className="h-8 w-8 flex items-center justify-center hover:bg-red-500 text-white transition-colors">
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Main Content: Dish Style */}
                                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
                                            <div className="max-w-4xl mx-auto flex flex-col gap-8">
                                                
                                                {/* Specifications */}
                                                <div className="grid grid-cols-12 gap-6">
                                                    <div className="col-span-12 grid grid-cols-3 gap-4">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Clasificación</label>
                                                            <input
                                                                type="text"
                                                                value={newProduct.classification || ''}
                                                                onChange={(e) => setNewProduct({ ...newProduct, classification: e.target.value.toUpperCase() })}
                                                                className="h-9 w-full bg-slate-50 border border-slate-200 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] focus:bg-white transition-all uppercase"
                                                                placeholder="EJ. PRODUCTO TERMINADO"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No. de Receta</label>
                                                            <input
                                                                type="text"
                                                                value={newProduct.recipe_no || ''}
                                                                onChange={(e) => setNewProduct({ ...newProduct, recipe_no: e.target.value.toUpperCase() })}
                                                                className="h-9 w-full bg-slate-50 border border-slate-200 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] focus:bg-white transition-all uppercase"
                                                                placeholder="R-001"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Porciones</label>
                                                            <input
                                                                type="text"
                                                                value={newProduct.portions || '1'}
                                                                onChange={(e) => setNewProduct({ ...newProduct, portions: e.target.value })}
                                                                className="h-9 w-full bg-slate-50 border border-slate-200 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] focus:bg-white transition-all text-center"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tamaño Porción</label>
                                                            <input
                                                                type="text"
                                                                value={newProduct.portion_size || ''}
                                                                onChange={(e) => setNewProduct({ ...newProduct, portion_size: e.target.value.toUpperCase() })}
                                                                className="h-9 w-full bg-slate-50 border border-slate-200 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] focus:bg-white transition-all uppercase"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Temp. Servicio</label>
                                                            <input
                                                                type="text"
                                                                value={newProduct.serving_temp || ''}
                                                                onChange={(e) => setNewProduct({ ...newProduct, serving_temp: e.target.value.toUpperCase() })}
                                                                className="h-9 w-full bg-slate-50 border border-slate-200 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] focus:bg-white transition-all uppercase"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tiempo Elab.</label>
                                                            <input
                                                                type="text"
                                                                value={newProduct.prep_time || ''}
                                                                onChange={(e) => setNewProduct({ ...newProduct, prep_time: e.target.value })}
                                                                className="h-9 w-full bg-slate-50 border border-slate-200 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] focus:bg-white transition-all uppercase"
                                                                placeholder="15 MIN"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1 col-span-3">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Elaborado Por</label>
                                                            <input 
                                                                type="text" 
                                                                value={newProduct.prepared_by || ''}
                                                                onChange={e => setNewProduct({...newProduct, prepared_by: e.target.value.toUpperCase()})}
                                                                className="h-9 w-full bg-slate-50 border border-slate-200 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-[#106ebe] focus:bg-white transition-all uppercase" 
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Procedure */}
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex justify-between items-center border-b-2 border-[#106ebe]/10 pb-2">
                                                        <div className="flex items-center gap-2">
                                                            <Layers size={16} className="text-[#106ebe]" />
                                                            <h4 className="text-[12px] font-black text-slate-700 uppercase tracking-wider">Procedimientos de Preparación</h4>
                                                        </div>
                                                        <button
                                                            onClick={() => handleImproveText('prep_procedure')}
                                                            disabled={isImproving}
                                                            className="flex items-center gap-2 px-4 py-1.5 bg-[#f0f9ff] text-[#106ebe] border border-blue-200 rounded-full text-[10px] font-black uppercase hover:bg-[#106ebe] hover:text-white transition-all disabled:opacity-50 shadow-sm"
                                                        >
                                                            {isImproving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} IA
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        value={newProduct.prep_procedure || ''}
                                                        onChange={(e) => setNewProduct({ ...newProduct, prep_procedure: e.target.value.toUpperCase() })}
                                                        className="w-full h-[200px] p-6 text-[12px] leading-relaxed font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-[#106ebe] focus:shadow-xl transition-all rounded-xl uppercase custom-scrollbar"
                                                        placeholder="DESCRIPCIÓN DE PASOS..."
                                                    />
                                                </div>

                                                {/* Observations */}
                                                <div className="flex flex-col gap-3">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                        <AlertCircle size={12} /> Observaciones y Notas Técnicas
                                                    </label>
                                                    <textarea
                                                        value={newProduct.observations || ''}
                                                        onChange={(e) => setNewProduct({ ...newProduct, observations: e.target.value.toUpperCase() })}
                                                        className="w-full h-[80px] p-4 text-[11px] font-bold text-slate-600 bg-amber-50/30 border border-amber-100 outline-none focus:border-amber-400 rounded-lg uppercase custom-scrollbar"
                                                        placeholder="NOTAS ADICIONALES..."
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="h-16 bg-slate-50 border-t border-slate-200 px-8 flex justify-end items-center shrink-0">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setShowFichaModal(false)}
                                                    className="px-12 py-3 bg-[#106ebe] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#002244] transition-all shadow-lg active:scale-95 flex items-center gap-3"
                                                >
                                                    <Save size={16} /> Guardar Ficha
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </DraggableWindow>
                            </div>,
                            document.body
                        )}
                    </div>
                </DraggableWindow>
            </div>
        </div>,
        document.body
    );
};
