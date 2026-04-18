import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Image as ImageIcon, FileText, Layers, Trash2, ChevronDown, Loader2, Settings, ChevronRight } from 'lucide-react';
import { DraggableWindow } from '../shared/DraggableWindow';
import { WindowsSaveButton } from '../../WindowsSaveButton';
import { supabase } from '../../../supabase';
import { removeBackground } from '@imgly/background-removal';

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
    setOptionsContextMenu: (val: any) => void;
    setShowTechnicalModal: (val: boolean) => void;
}

const CustomSelect = ({ value, onChange, options, placeholder = "SELECCIONAR..." }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
       <div className="relative flex-1">
            <div 
                onClick={() => setIsOpen(!isOpen)} 
                className="h-[26px] bg-white border border-[#e2e8f0] px-2 flex items-center justify-between cursor-pointer hover:border-[#106ebe] transition-colors shadow-sm"
            >
                <span className="text-[11px] text-slate-700 uppercase truncate">
                    {options.find((o: any) => o.value === value)?.label || placeholder}
                </span>
                <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </div>
           {isOpen && (
               <>
                   <div className="fixed inset-0 z-[2000001]" onClick={() => setIsOpen(false)} />
                   <div className="absolute top-[calc(100%+2px)] left-0 w-full bg-white border border-[#106ebe] shadow-xl z-[2000002] max-h-[140px] overflow-y-auto custom-scrollbar">
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


export const PlatilloModal: React.FC<PlatilloModalProps> = ({
    isOpen, onClose, editingId, newProduct, setNewProduct, handleSave, isSaving,
    menuCategories, kitchens, branches, recipeItems, setRecipeItems, setRecipeContextMenu,
    setSearchModal, branchPrices, setBranchPrices, assignedModifierGroups, assignedOptionGroups,
    setOptionsContextMenu, setShowTechnicalModal
}) => {
    const [activeTab, setActiveTab] = useState<'sucursales' | 'opciones'>('sucursales');
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImage(true);
        try {
            const blob = await removeBackground(file);
            const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".png", { type: "image/png" });

            const fileName = `platillo-${Math.random()}-${Date.now()}.png`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('menu').upload(filePath, processedFile);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('menu').getPublicUrl(filePath);
            setNewProduct({ ...newProduct, image_url: publicUrl });
        } catch (error: any) {
            console.error('Error al subir imagen:', error);
            alert('Error al subir la imagen y remover fondo: ' + error.message);
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[2000000] flex items-center justify-center p-2 bg-black/10 pointer-events-none font-sans overflow-hidden">
            <div className="absolute inset-0 pointer-events-auto" onClick={onClose}></div>
            <div className="pointer-events-auto">
                <DraggableWindow>
                    <div className="bg-[#f0f3f6] border border-[#106ebe] w-[900px] overflow-hidden flex flex-col shadow-[0_30px_90px_rgba(0,0,0,0.3)] animate-in fade-in duration-200">
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
                                    title="Subir Imagen"
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

                        {/* APLICANDO EL TAMAÑO DEL ALTO QUE LE GUSTÓ AL USUARIO PERO COMPACTADO */}
                        <div className="p-3 space-y-2 bg-[#f0f3f6] overflow-y-auto max-h-[85vh] custom-scrollbar">
                            {/* SECCIÓN 1 */}
                            <fieldset className="border border-[#ced4da] p-3 pt-2 bg-white relative">
                                <legend className="px-1.5 text-[10px] font-semibold text-[#106ebe] uppercase">Datos de Platillo</legend>
                                <div className="flex gap-4 mt-1">
                                    <div className="flex-1 space-y-1.5">
                                        {[
                                            { label: 'Código', key: 'product_code' },
                                            { label: 'Plato', key: 'name' },
                                            { label: 'Nombre Corto', key: 'short_name' },
                                            { label: 'Descripción', key: 'description' }
                                        ].map((f) => (
                                            <div key={f.key} className="flex items-center">
                                                <label className="text-[11px] text-gray-400 w-[100px] shrink-0 uppercase tracking-tighter">{f.label}</label>
                                                <input 
                                                    type="text" 
                                                    className="flex-1 h-[26px] bg-white border border-[#e2e8f0] px-3 text-[11px] text-slate-700 outline-none focus:border-[#106ebe] uppercase"
                                                    value={newProduct[f.key] || ''}
                                                    onChange={e => setNewProduct({...newProduct, [f.key]: e.target.value.toUpperCase()})}
                                                />
                                            </div>
                                        ))}
                                        
                                        <div className="flex items-center">
                                            {/* Precio Costo - 50% */}
                                            <div className="w-1/2 flex items-center pr-2">
                                                <label className="text-[11px] text-gray-400 w-[100px] shrink-0 uppercase tracking-tighter">Precio Costo</label>
                                                <div className="flex-1 flex items-center border border-gray-400 bg-white h-[30px] px-2 shadow-sm">
                                                    <div className="flex-1 flex items-center justify-center">
                                                        <span className="text-[11px] font-bold text-slate-400 mr-1">Q.</span>
                                                        <input
                                                            type="text"
                                                            className="w-[70px] h-full text-[11px] font-bold text-slate-800 outline-none bg-white text-center"
                                                            value={(!newProduct.cost_price || newProduct.cost_price === '0') ? '0.00' : (isNaN(newProduct.cost_price) ? newProduct.cost_price : parseFloat(newProduct.cost_price).toFixed(2))}
                                                            onChange={e => setNewProduct({...newProduct, cost_price: e.target.value})}
                                                            onFocus={e => e.target.select()}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Prioridad - 50% */}
                                            <div className="w-1/2 flex items-center pl-2">
                                                <label className="text-[11px] text-gray-400 w-[100px] shrink-0 uppercase tracking-tighter text-right pr-4">Prioridad</label>
                                                <input
                                                    type="text"
                                                    className="flex-1 h-[26px] border border-gray-400 bg-white px-2 text-[11px] font-bold text-slate-800 outline-none text-center"
                                                    value={newProduct.sort_order || '1'}
                                                    onChange={e => setNewProduct({...newProduct, sort_order: e.target.value})}
                                                    onFocus={e => e.target.select()}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <CustomSelect 
                                                value={newProduct.category_id || ''}
                                                onChange={(val: string) => setNewProduct({...newProduct, category_id: val})}
                                                options={(() => {
                                                    const catMap = new Map(menuCategories.map(c => [c.id, c]));
                                                    return menuCategories.map(c => {
                                                        const pId = (c as any).parent_id;
                                                        const parent = pId ? catMap.get(pId) : null;
                                                        const label = parent 
                                                            ? `${(parent.name || parent.nombre).toUpperCase()} > ${(c.name || c.nombre).toUpperCase()}`
                                                            : (c.name || c.nombre || '').toUpperCase();
                                                        return { value: c.id, label };
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
                                        <div className="w-full aspect-square border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-center text-gray-300 relative shadow-inner overflow-hidden group">
                                            {newProduct.image_url ? (
                                                <img src={newProduct.image_url} className="w-full h-full object-cover" alt="Plato" />
                                            ) : (
                                                <ImageIcon size={40} strokeWidth={0.5} className="opacity-20" />
                                            )}
                                            {uploadingImage && (
                                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                                                    <Loader2 className="animate-spin text-[#106ebe]" size={24} />
                                                </div>
                                            )}
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploadingImage}
                                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold uppercase transition-opacity"
                                            >
                                                Subir
                                            </button>
                                        </div>
                                        <button 
                                            onClick={() => newProduct.image_url ? setNewProduct({...newProduct, image_url: ''}) : fileInputRef.current?.click()}
                                            disabled={uploadingImage}
                                            className={`mt-2 text-[9px] font-bold uppercase tracking-tighter ${newProduct.image_url ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-[#106ebe]'}`}
                                        >
                                            {newProduct.image_url ? 'Quitar Imagen' : 'Subir Imagen'}
                                        </button>
                                    </div>
                                </div>
                            </fieldset>

                            {/* SECCIÓN 2 */}
                            <fieldset className="border border-[#ced4da] p-3 pt-2 bg-white relative">
                                <legend className="px-1.5 text-[10px] font-semibold text-[#106ebe] uppercase">Precios de Venta</legend>
                                <div className="grid grid-cols-4 gap-4 items-end mt-1">
                                    {[ 
                                        { label: 'Precio Venta', key: 'price', color: '#106ebe' },
                                        { label: 'Precio Domicilio', key: 'delivery_price' },
                                        { label: 'Precio Plataformas', key: 'platform_price' }
                                    ].map((f) => (
                                        <div key={f.key} className="space-y-1">
                                            <label className="text-[10px] text-gray-400 block text-center uppercase tracking-tighter">{f.label}</label>
                                            <div className="flex items-center border border-gray-400 bg-white h-[34px] px-2 shadow-sm">
                                                <div className="flex-1 flex items-center justify-center">
                                                    <span className="text-[11px] font-bold text-slate-400 mr-1">Q.</span>
                                                    <input 
                                                        type="text" 
                                                        className="w-[85px] h-full text-[13px] font-bold text-center outline-none bg-white"
                                                        style={{ color: f.color || '#475569' }}
                                                        value={(!newProduct[f.key] || newProduct[f.key] === '0') ? '0.00' : (isNaN(newProduct[f.key]) ? newProduct[f.key] : parseFloat(newProduct[f.key]).toFixed(2))}
                                                        onChange={e => setNewProduct({...newProduct, [f.key]: e.target.value})}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button 
                                        className="h-[28px] bg-[#106ebe] text-white text-[10px] font-bold uppercase hover:bg-[#0d5aa0] transition-colors shadow-sm"
                                        onClick={() => setBranchPrices(branchPrices.map(bp => ({ 
                                            ...bp, 
                                            price: newProduct.price,
                                            delivery_price: newProduct.delivery_price,
                                            platform_price: newProduct.platform_price
                                        })))}
                                    >
                                        Aplicar a Todos
                                    </button>
                                </div>
                            </fieldset>

                            {/* TABS Y TABLA */}
                            <div className="flex-1 border border-[#ced4da] bg-white shadow-sm overflow-hidden flex flex-col min-h-[220px]">
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
                                        className="h-[24px] px-4 bg-[#106ebe] text-white text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-[#0d5aa0] shadow-sm transition-all active:scale-95"
                                        onClick={() => setShowTechnicalModal(true)}
                                    >
                                        <FileText size={13} /> Ficha Técnica
                                    </button>
                                </div>

                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    {activeTab === 'sucursales' ? (
                                        <div className="p-2">
                                            <div className="border border-gray-300 rounded-sm overflow-x-auto w-full bg-white shadow-sm custom-scrollbar">
                                                <table className="w-full border-collapse min-w-[850px]">
                                                    <thead>
                                                        <tr className="h-8 text-[9.5px] text-slate-700 font-extrabold uppercase border-b border-gray-300 bg-[#f1f5f9]">
                                                            <th className="px-3 text-left border-r border-gray-200 w-[300px]">Sucursal</th>
                                                            <th className="px-2 text-center border-r border-gray-200 w-[115px]">Precio Venta</th>
                                                            <th className="px-2 text-center border-r border-gray-200 w-[115px]">Precio Domicilio</th>
                                                            <th className="px-2 text-center border-r border-gray-200 w-[115px]">Precio Plataforma</th>
                                                            <th className="px-2 text-center border-r border-gray-200 w-[70px]">Habilitado</th>
                                                            <th className="px-2 text-center w-[70px]">Asignado</th>
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
                                                                        <div className="flex items-center border border-gray-300 bg-white h-[28px] mx-0.5 shadow-sm px-2">
                                                                            <div className="flex-1 flex items-center justify-center">
                                                                                <span className="text-[10px] font-bold text-slate-400 mr-1.5">Q.</span>
                                                                                <input 
                                                                                    type="text" 
                                                                                    className="w-full h-full text-center text-slate-800 font-bold text-[11px] outline-none bg-white font-sans mt-[0.5px]" 
                                                                                    value={(!bp[field] || bp[field] === '0') ? '0.00' : (isNaN(bp[field]) ? bp[field] : parseFloat(bp[field]).toFixed(2))} 
                                                                                    onChange={e => {
                                                                                        const n = [...branchPrices];
                                                                                        n[idx][field] = e.target.value.replace(/[^0-9.]/g, '');
                                                                                        setBranchPrices(n);
                                                                                    }}
                                                                                    onFocus={e => e.target.select()}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                ))}
                                                                <td className="px-1 border-r border-gray-100 text-center">
                                                                    <input type="checkbox" readOnly checked={bp.is_enabled} className="w-3.5 h-3.5 accent-[#106ebe] cursor-pointer" />
                                                                </td>
                                                                <td className="px-1 text-center">
                                                                    <input type="checkbox" readOnly checked={true} className="w-3.5 h-3.5 accent-[#106ebe] cursor-pointer" />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex h-full divide-x divide-[#e2e8f0]">
                                            {[ 
                                                { title: 'Opciones Asignadas', data: assignedOptionGroups, type: 'options' },
                                                { title: 'Modificadores Asignadas', data: assignedModifierGroups, type: 'modifiers' }
                                            ].map((panel, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className="flex-1 flex flex-col bg-white"
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
                                                    <div className="h-[40px] bg-[#f5faff] border-b border-[#ced4da] flex items-center px-8">
                                                        <span className="text-[11px] font-bold text-[#106ebe] uppercase tracking-tighter">{panel.title}</span>
                                                    </div>
                                                    
                                                    {panel.data.length > 0 ? (
                                                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                                            {panel.data.map((item: any) => (
                                                                <div key={item.id} className="p-3 border border-gray-200 bg-gray-50 flex justify-between items-center group">
                                                                    <span className="text-[11px] font-bold uppercase text-gray-700">{item.name || item.option_groups?.name || item.modifier_groups?.name || 'GRUPO'}</span>
                                                                    <button 
                                                                        className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (panel.type === 'options') {
                                                                                setOptionsContextMenu({ visible: true, type: 'options', x: e.clientX, y: e.clientY, targetGroupId: item.id });
                                                                            } else {
                                                                                setOptionsContextMenu({ visible: true, type: 'modifiers', x: e.clientX, y: e.clientY, targetGroupId: item.id });
                                                                            }
                                                                        }}
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 flex flex-col items-center justify-center p-10 select-none opacity-20 relative pointer-events-none">
                                                            <Layers size={50} strokeWidth={1} className="text-gray-300 mb-4" />
                                                            <p className="text-[11px] font-black tracking-[0.3em] text-gray-400">HAZ CLIC DERECHO PARA AGREGAR</p>
                                                        </div>
                                                    )}
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
