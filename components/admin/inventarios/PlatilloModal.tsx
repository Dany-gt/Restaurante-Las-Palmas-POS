import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Image as ImageIcon, FileText, Layers, Trash2, ChevronDown, Loader2, Settings, ChevronRight } from 'lucide-react';
import { DraggableWindow } from '../shared/DraggableWindow';
import { WindowsSaveButton } from '../../WindowsSaveButton';
import { supabase } from '../../../supabase';

interface PlatilloModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingId: string | null;
    newProduct: any;
    setNewProduct: (val: any) => void;
    handleSave: () => void;
    isSaving: boolean;
    menuCategories: any[];
    kitchens: any[];
    branches: any[];
    recipeItems: any[];
    setRecipeItems: React.Dispatch<React.SetStateAction<any[]>>;
    setRecipeContextMenu: (val: any) => void;
    setSearchModal: (val: any) => void;
    branchPrices: any[];
    setBranchPrices: (val: any[]) => void;
    assignedOptionGroups: any[];
    assignedModifierGroups: any[];
    setOptionsContextMenu: (val: any) => void;
    setShowTechnicalModal: (val: boolean) => void;
}

const PlaceholderLogo = () => (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#3a3b4d]">
        <span className="text-[10px] font-bold tracking-[0.2em] text-gray-400 mb-0.5">RESTAURANTE</span>
        <span className="text-sm font-black tracking-tighter text-orange-500 uppercase leading-none">LAS PALMAS</span>
        <div className="flex items-center gap-1.5 mt-1">
            <div className="h-[1px] w-4 bg-white/20"></div>
            <span className="text-[10px] font-black text-white/40 tracking-widest">POS</span>
            <div className="h-[1px] w-4 bg-white/20"></div>
        </div>
    </div>
);

const CustomSelect = ({ value, onChange, options, placeholder = "SELECCIONAR..." }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
       <div className="relative flex-1">
            <div 
                onClick={() => setIsOpen(!isOpen)} 
                className="h-[26px] bg-white border border-[#e2e8f0] px-2 flex items-center justify-between cursor-pointer hover:border-[#106ebe] transition-colors "
            >
                <span className="text-[11px] text-slate-700 uppercase truncate">
                    {options.find((o: any) => o.value === value)?.label || placeholder}
                </span>
                <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </div>
           {isOpen && (
               <>
                   <div className="fixed inset-0 z-[2000001]" onClick={() => setIsOpen(false)} />
                   <div className="absolute top-[calc(100%+2px)] left-0 w-full bg-white border border-[#106ebe]  z-[2000002] max-h-[140px] overflow-y-auto custom-scrollbar">
                       <div 
                           onClick={() => { onChange(''); setIsOpen(false); }} 
                           className="px-2 py-2 text-[10px] text-gray-400 hover:bg-[#106ebe] hover:text-white cursor-pointer uppercase border-b border-[#f1f5f9] font-bold"
                       >
                           {placeholder}
                       </div>
                       {options.map((o: any) => (
                           <div 
                               key={o.value} 
                               onClick={() => { onChange(o.value); setIsOpen(false); }} 
                               className={`px-2 py-1.5 text-[11px] text-slate-700 hover:bg-[#106ebe] hover:text-white cursor-pointer uppercase border-b border-[#f8fafc] last:border-none ${value === o.value ? 'bg-blue-50 font-bold text-[#106ebe]' : ''}`}
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
            className={`flex-1 flex items-center border border-gray-300 bg-white h-[28px]  relative cursor-text px-2 ${className}`}
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


export const PlatilloModal: React.FC<PlatilloModalProps> = ({
    isOpen, onClose, editingId, newProduct, setNewProduct, handleSave, isSaving,
    menuCategories, kitchens, branches, recipeItems, setRecipeItems, setRecipeContextMenu,
    setSearchModal, branchPrices, setBranchPrices, assignedModifierGroups, assignedOptionGroups,
    setOptionsContextMenu, setShowTechnicalModal
}) => {
    const [activeTab, setActiveTab] = useState<'sucursales' | 'opciones'>('sucursales');
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [batchTool, setBatchTool] = useState({
        price: '0.00',
        delivery_price: '0.00',
        platform_price: '0.00'
    });
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImage(true);
        try {
            // Procesamiento profesional con la API de remove.bg
            const formData = new FormData();
            formData.append('image_file', file);
            formData.append('size', 'auto');
            formData.append('crop', 'true');
            formData.append('margin', '20%');

            const keysString = (import.meta as any).env?.VITE_REMOVE_BG_API_KEYS || (import.meta as any).env?.VITE_REMOVE_BG_API_KEY || '';
            const apiKeys = keysString.split(',').map((k: string) => k.trim()).filter((k: string) => k !== '');
            
            let response: Response | null = null;
            let lastError = '';

            for (const key of apiKeys) {
                try {
                    const currentResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
                        method: 'POST',
                        headers: { 'X-Api-Key': key },
                        body: formData
                    });

                    if (currentResponse.ok) {
                        response = currentResponse;
                        break; 
                    } else {
                        const errorData = await currentResponse.json();
                        lastError = errorData.errors?.[0]?.title || 'Error en remove.bg';
                        
                        if (currentResponse.status !== 402 && currentResponse.status !== 429) {
                            throw new Error(lastError);
                        }
                    }
                } catch (err: any) {
                    if (!apiKeys.includes(key)) throw err; 
                    console.warn(`Llave fallida, probando siguiente...`);
                }
            }

            if (!response || !response.ok) {
                throw new Error(lastError || 'No hay créditos disponibles en ninguna de las llaves.');
            }

            const blob = await response.blob();
            
            const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".png", { type: "image/png" });

            const fileName = `platillo-${Math.random()}-${Date.now()}.png`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('menu').upload(filePath, processedFile);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('menu').getPublicUrl(filePath);
            setNewProduct({ ...newProduct, image_url: publicUrl });
        } catch (error: any) {
            console.error('Error al subir imagen:', error);
            alert('Error al procesar imagen: ' + error.message);
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[2000000] flex items-center justify-center p-2 bg-transparent pointer-events-none font-sans overflow-hidden">
            <div className="absolute inset-0 pointer-events-auto" onClick={onClose}></div>
            <div className="pointer-events-auto">
                <DraggableWindow resizable defaultWidth={950} defaultHeight={"auto"} minWidth={700} minHeight={500}>
                    <div className="bg-white border border-[#106ebe] w-full h-full max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in duration-200">
                        {/* HEADER EXTREMO CLONE */}
                        <div className="modal-header bg-[#106ebe] h-8 px-2 flex justify-between items-center text-white shrink-0 cursor-move transition-colors">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 flex items-center justify-center">
                                    <Layers size={14} className="text-white/90" />
                                </div>
                                <span className="text-[11px] font-semibold uppercase tracking-tight">Mantenimiento de Platillos</span>
                            </div>
                            <div className="flex items-center h-full">
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleImageUpload} 
                                    className="hidden" 
                                    accept="image/*" 
                                />
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingImage}
                                    className="h-full px-3 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50"
                                    title="Subir Imagen Inteligente"
                                >
                                    {uploadingImage ? <Loader2 size={18} className="animate-spin text-white/80" /> : <ImageIcon size={20} className="text-white/80" />}
                                </button>
                                <WindowsSaveButton 
                                    onClick={handleSave}
                                    loading={isSaving}
                                    variant="minimal"
                                    size={20}
                                />
                                <button 
                                    onClick={onClose} 
                                    className="w-9 h-full flex items-center justify-center hover:bg-[#e81123] transition-colors ml-1"
                                >
                                    <X size={18} strokeWidth={2} />
                                </button>
                            </div>
                        </div>

                        {/* CONTENEDOR PRINCIPAL FLEXIBLE */}
                        <div className="flex-1 p-4 space-y-4 bg-white overflow-y-auto custom-scrollbar">
                            {/* SECCIÓN 1 */}
                            <fieldset className="border border-[#ced4da] p-4 pt-2 bg-white relative ">
                                <legend className="px-1.5 text-[10px] font-semibold text-[#106ebe] uppercase">Datos de Platillo</legend>
                                <div className="flex gap-6 mt-1">
                                    <div className="flex-1 space-y-3">
                                        {[
                                            { label: 'Código', key: 'product_code' },
                                            { label: 'Plato', key: 'name' },
                                            { label: 'Nombre Corto', key: 'short_name' },
                                            { label: 'Descripción', key: 'description' }
                                        ].map((f) => (
                                            <div key={f.key} className="flex items-center">
                                                <label className="text-[11px] text-gray-400 w-[110px] shrink-0 uppercase tracking-tighter">{f.label}</label>
                                                 <div className="flex-1 h-[28px] bg-white border border-[#e2e8f0] flex items-center px-3  focus-within:border-gray-400 transition-colors">
                                                     <input 
                                                         type="text" 
                                                         className="w-full h-5 bg-transparent text-[11px] text-slate-700 outline-none uppercase"
                                                         value={newProduct[f.key] || ''}
                                                         onChange={e => setNewProduct({...newProduct, [f.key]: e.target.value.toUpperCase()})}
                                                         onFocus={e => e.target.select()}
                                                     />
                                                 </div>
                                            </div>
                                        ))}
                                        
                                        <div className="flex items-center pb-1">
                                            {/* Precio Costo - 50% */}
                                            <div className="w-1/2 flex items-center pr-3">
                                                <label className="text-[11px] text-gray-400 w-[110px] shrink-0 uppercase tracking-tighter">Precio Costo</label>
                                                <SmartPriceInput 
                                                    value={newProduct.cost_price}
                                                    onChange={(val: string) => setNewProduct({...newProduct, cost_price: val})}
                                                />
                                            </div>

                                            {/* Prioridad - 50% */}
                                            <div className="w-1/2 flex items-center pl-3">
                                                <label className="text-[11px] text-gray-400 w-[110px] shrink-0 uppercase tracking-tighter text-right pr-6">Prioridad</label>
                                                 <div className="flex-1 h-[28px] border border-gray-400 bg-white flex items-center justify-center ">
                                                     <input
                                                         type="text"
                                                         className="w-full h-5 bg-transparent text-[11px] font-bold text-slate-800 outline-none text-center"
                                                         value={newProduct.sort_order || '1'}
                                                         onChange={e => setNewProduct({...newProduct, sort_order: e.target.value})}
                                                         onFocus={e => e.target.select()}
                                                     />
                                                 </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <label className="text-[11px] text-gray-400 w-[110px] shrink-0 uppercase tracking-tighter">Categoría</label>
                                            <CustomSelect 
                                                value={newProduct.category_id || ''}
                                                onChange={(val: string) => setNewProduct({...newProduct, category_id: val})}
                                                options={(() => {
                                                    const catMap = new Map(menuCategories.map((c: any) => [c.id, c]));
                                                    return menuCategories.map((c: any) => {
                                                        const parent = c.parent_id ? (catMap.get(c.parent_id) as any) : null;
                                                        const pName = String(parent?.name || parent?.nombre || '').toUpperCase();
                                                        const cName = String(c.name || c.nombre || '').toUpperCase();
                                                        const label = pName ? `${pName} > ${cName}` : cName;
                                                        return { value: c.id, label: label || 'SIN NOMBRE' };
                                                    }).sort((a, b) => a.label.localeCompare(b.label));
                                                })()}
                                                placeholder="Seleccionar..."
                                            />
                                        </div>
                                        <div className="flex items-center">
                                            <label className="text-[11px] text-gray-400 w-[100px] shrink-0 uppercase tracking-tighter">Cocina</label>
                                            <CustomSelect 
                                                value={newProduct.kitchen_station_id || ''}
                                                onChange={(val: string) => setNewProduct({...newProduct, kitchen_station_id: val})}
                                                options={kitchens.map(k => ({ value: k.id, label: k.name }))}
                                                placeholder="Ninguna"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="w-[140px] flex flex-col items-center">
                                        <div className="w-full aspect-square border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-center text-gray-300 relative  overflow-hidden group p-4">
                                            {newProduct.image_url ? (
                                                <img src={newProduct.image_url} className="w-full h-full object-contain" alt="Plato" />
                                            ) : (
                                                <PlaceholderLogo />
                                            )}
                                            {uploadingImage && (
                                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                                                    <Loader2 className="animate-spin text-[#106ebe]" size={24} />
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => { if (newProduct.image_url) setNewProduct({...newProduct, image_url: ''}); }}
                                            disabled={uploadingImage}
                                            className="mt-3 w-full h-[28px] bg-[#106ebe] text-white text-[10px] font-bold uppercase hover:bg-[#0d5aa0] transition-colors  flex items-center justify-center gap-2"
                                        >
                                            <Trash2 size={12} />
                                            Quitar Imagen
                                        </button>
                                    </div>
                                </div>
                            </fieldset>

                            {/* SECCIÓN 2 */}
                            <fieldset className="border border-[#ced4da] p-3 pt-2 bg-white relative">
                                <legend className="px-1.5 text-[10px] font-semibold text-[#106ebe] uppercase">Precios de Venta</legend>
                                <div className="grid grid-cols-4 gap-4 items-end mt-1">
                                    {[ 
                                        { label: 'Precio Venta', key: 'price' },
                                        { label: 'Precio Domicilio', key: 'delivery_price' },
                                        { label: 'Precio Plataformas', key: 'platform_price' }
                                    ].map((f) => (
                                        <div key={f.key} className="space-y-1 text-center">
                                            <label className="text-[10px] text-gray-400 block uppercase tracking-tighter">{f.label}</label>
                                            <SmartPriceInput 
                                                value={batchTool[f.key as keyof typeof batchTool]}
                                                onChange={(val: string) => setBatchTool({...batchTool, [f.key]: val})}
                                            />
                                        </div>
                                    ))}
                                    <button 
                                        className="h-[28px] bg-[#106ebe] text-white text-[10px] font-bold uppercase hover:bg-[#0d5aa0] transition-colors "
                                        onClick={() => {
                                            setBranchPrices(branchPrices.map(bp => ({ 
                                                ...bp, 
                                                price: batchTool.price !== '0.00' && batchTool.price !== '' ? batchTool.price : bp.price,
                                                delivery_price: batchTool.delivery_price !== '0.00' && batchTool.delivery_price !== '' ? batchTool.delivery_price : bp.delivery_price,
                                                platform_price: batchTool.platform_price !== '0.00' && batchTool.platform_price !== '' ? batchTool.platform_price : bp.platform_price
                                            })));
                                            setBatchTool({ price: '0.00', delivery_price: '0.00', platform_price: '0.00' });
                                        }}
                                    >
                                        Aplicar a Todos
                                    </button>
                                </div>
                            </fieldset>

                            {/* TABS Y TABLA */}
                            <div className="flex-1 border border-[#ced4da] bg-white  overflow-hidden flex flex-col min-h-[220px]">
                                <div className="h-8 bg-[#f1f5f9] border-b border-[#ced4da] flex justify-between items-center px-1">
                                    <div className="flex h-full items-center">
                                        <button 
                                            onClick={() => setActiveTab('sucursales')}
                                            className={`px-5 h-full text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'sucursales' ? 'bg-white text-[#106ebe] border-x border-gray-300 border-t-[3px] border-t-[#106ebe] -mb-[1px] z-10' : 'text-slate-400 border-r border-transparent'}`}
                                        >
                                            Sucursales
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('opciones')}
                                            className={`px-5 h-full text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'opciones' ? 'bg-white text-[#106ebe] border-x border-gray-300 border-t-[3px] border-t-[#106ebe] -mb-[1px] z-10' : 'text-slate-400'}`}
                                        >
                                            Opciones y Modificadores
                                        </button>
                                    </div>
                                    <button 
                                        className="h-[24px] px-4 bg-[#106ebe] text-white text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-[#0d5aa0]  transition-all active:scale-95"
                                        onClick={() => setShowTechnicalModal(true)}
                                    >
                                        <FileText size={13} /> Ficha Técnica
                                    </button>
                                </div>

                                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                                    {activeTab === 'sucursales' ? (
                                        <div className="p-2">
                                            <div className="border border-gray-300 rounded-sm overflow-hidden w-full bg-white  overflow-x-hidden">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr className="h-8 text-[9.5px] text-slate-700 font-extrabold uppercase border-b border-gray-300 bg-[#f1f5f9]">
                                                            <th className="px-3 text-left border-r border-gray-200">Sucursal</th>
                                                            <th className="px-2 text-center border-r border-gray-200 w-[125px]">Precio Venta</th>
                                                            <th className="px-2 text-center border-r border-gray-200 w-[125px]">Precio Domicilio</th>
                                                            <th className="px-2 text-center border-r border-gray-200 w-[135px]">Precio Plataforma</th>
                                                            <th className="px-2 text-center border-r border-gray-200 w-[75px]">Habilitado</th>
                                                            <th className="px-2 text-center w-[120px]">Asignado a Sucursal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {branchPrices.map((bp, idx) => (
                                                            <tr key={bp.branch_id} className="h-9 hover:bg-blue-50/30">
                                                                <td className="px-3 text-[9.5px] font-bold text-slate-800 uppercase border-r border-gray-100 whitespace-nowrap overflow-hidden">
                                                                    {branches.find(b => b.id === bp.branch_id)?.name || '---'}
                                                                </td>
                                                                {[ 'price', 'delivery_price', 'platform_price' ].map(field => (
                                                                    <td key={field} className="px-1.5 border-r border-gray-100 text-center">
                                                                        <SmartPriceInput 
                                                                            value={bp[field]}
                                                                            className="h-[28px] mx-0.5"
                                                                            onChange={(val: string) => {
                                                                                const n = [...branchPrices];
                                                                                n[idx][field] = val;
                                                                                setBranchPrices(n);
                                                                            }}
                                                                        />
                                                                    </td>
                                                                ))}
                                                                <td className="px-1 border-r border-gray-100 text-center">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={bp.is_enabled} 
                                                                        onChange={(e) => {
                                                                            const n = [...branchPrices];
                                                                            n[idx].is_enabled = e.target.checked;
                                                                            setBranchPrices(n);
                                                                        }}
                                                                        className="w-3.5 h-3.5 accent-[#106ebe] cursor-pointer" 
                                                                    />
                                                                </td>
                                                                <td className="px-1 text-center">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={bp.is_assigned !== undefined ? bp.is_assigned : true} 
                                                                        onChange={(e) => {
                                                                            const n = [...branchPrices];
                                                                            n[idx].is_assigned = e.target.checked;
                                                                            // Si se desasigna, también deshabilitamos por lógica
                                                                            if (!e.target.checked) n[idx].is_enabled = false;
                                                                            setBranchPrices(n);
                                                                        }}
                                                                        className="w-3.5 h-3.5 accent-[#106ebe] cursor-pointer" 
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex bg-white border-t border-[#ced4da] overflow-hidden">
                                            {[ 
                                                { title: 'Opciones Asignadas', data: assignedOptionGroups, type: 'options' },
                                                { title: 'Modificadores Asignadas', data: assignedModifierGroups, type: 'modifiers' }
                                            ].map((panel, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className={`flex-1 flex flex-col bg-white relative ${idx === 0 ? 'border-r-2 border-[#ced4da]' : ''}`}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        setOptionsContextMenu({
                                                            visible: true,
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                            type: panel.type,
                                                            targetGroupId: null
                                                        });
                                                    }}
                                                >
                                                    {/* Línea vertical de columna NOMBRE/PRIORIDAD que llega hasta el fondo */}
                                                    <div className="absolute top-0 bottom-0 right-[100px] w-px bg-[#ced4da] z-0 pointer-events-none"></div>
                                                    <div className="flex-1 flex flex-col min-h-0">
                                                        <table className="w-full border-collapse sticky top-0 z-10">
                                                            <thead>
                                                                <tr className="h-8 bg-[#f1f5f9] border-b border-[#ced4da] text-[10px] font-black text-slate-800 uppercase tracking-widest relative z-10">
                                                                    <th className="text-center px-4 w-full">NOMBRE</th>
                                                                    <th className="text-center px-2 w-[100px]">PRIORIDAD</th>
                                                                </tr>
                                                            </thead>
                                                        </table>
                                                        
                                                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                            {panel.data.length > 0 ? (
                                                                <table className="w-full border-collapse">
                                                                    <tbody className="">
                                                                        {panel.data.map((item: any) => (
                                                                            <tr 
                                                                                key={item.group_id || item.id} 
                                                                                className={`h-8 group cursor-pointer ${selectedRowId === (item.group_id || item.id) ? 'bg-[#106ebe]' : 'hover:bg-blue-50/50'}`}
                                                                                onClick={() => setSelectedRowId(item.group_id || item.id)}
                                                                            >
                                                                                <td className={`px-4 text-[10.5px] font-bold uppercase relative z-10 ${selectedRowId === (item.group_id || item.id) ? 'text-white' : 'text-slate-700'}`}>
                                                                                    {item.name || item.option_groups?.name || item.modifier_groups?.name || '---'}
                                                                                </td>
                                                                                <td className={`px-2 w-[100px] text-center text-[10.5px] font-medium relative z-10 ${selectedRowId === (item.group_id || item.id) ? 'text-blue-100' : 'text-slate-500'}`}>
                                                                                    {item.sort_order || item.priority || '1'}
                                                                                </td>
                                                                                <td className="w-8 text-center">
                                                                                    <button 
                                                                                        className={`opacity-0 group-hover:opacity-100 transition-opacity ${selectedRowId === (item.group_id || item.id) ? 'text-red-200 hover:text-white' : 'text-red-400 hover:text-red-600'}`}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setOptionsContextMenu({ 
                                                                                                visible: true, 
                                                                                                type: panel.type, 
                                                                                                x: e.clientX, 
                                                                                                y: e.clientY, 
                                                                                                targetGroupId: item.group_id 
                                                                                            });
                                                                                        }}
                                                                                    >
                                                                                        <X size={12} />
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            ) : (
                                                                <div className="flex-1 flex flex-col items-center justify-center p-10 select-none opacity-20 pointer-events-none h-full">
                                                                    <Layers size={40} strokeWidth={1} className="text-gray-300 mb-2" />
                                                                    <p className="text-[9px] font-black tracking-[0.2em] text-gray-400 text-center">CLIC DERECHO PARA AGREGAR</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
