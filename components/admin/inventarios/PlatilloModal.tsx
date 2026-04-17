import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Image as ImageIcon, FileText, Layers, Trash2 } from 'lucide-react';
import { DraggableWindow } from '../shared/DraggableWindow';

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
    assignedModifierGroups: any[];
    assignedOptionGroups: any[];
    setOptionsContextMenu: (val: any) => void;
}

export const PlatilloModal: React.FC<PlatilloModalProps> = ({
    isOpen, onClose, editingId, newProduct, setNewProduct, handleSave, isSaving,
    menuCategories, kitchens, branches, recipeItems, setRecipeItems, setRecipeContextMenu,
    setSearchModal, branchPrices, setBranchPrices, assignedModifierGroups, assignedOptionGroups,
    setOptionsContextMenu
}) => {
    const [activeTab, setActiveTab] = useState<'sucursales' | 'opciones'>('sucursales');

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[2000000] flex items-center justify-center p-2 bg-black/10 pointer-events-none font-sans overflow-hidden">
            <div className="absolute inset-0 pointer-events-auto" onClick={onClose}></div>
            <div className="pointer-events-auto">
                <DraggableWindow>
                    <div className="bg-[#f0f3f6] border border-[#106ebe] w-[810px] overflow-hidden flex flex-col shadow-[0_30px_90px_rgba(0,0,0,0.3)] animate-in fade-in duration-200">
                        {/* HEADER EXTREMO CLONE */}
                        <div className="modal-header bg-[#106ebe] h-8 px-2 flex justify-between items-center text-white shrink-0 cursor-move transition-colors">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 flex items-center justify-center">
                                    <Layers size={14} className="text-white/90" />
                                </div>
                                <span className="text-[11px] font-semibold uppercase tracking-tight">Mantenimiento de Platillos</span>
                            </div>
                            <div className="flex items-center h-full">
                                <button className="h-full px-3 flex items-center gap-1.5 hover:bg-white/10 transition-colors">
                                    <ImageIcon size={14} className="text-white/80" />
                                    <span className="text-[9.5px] font-bold uppercase tracking-widest">Imagen</span>
                                </button>
                                <button 
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="h-full px-3 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50"
                                >
                                    <Save size={15} className="text-white/90" />
                                </button>
                                <button 
                                    onClick={onClose} 
                                    className="w-9 h-full flex items-center justify-center hover:bg-[#e81123] transition-colors ml-1"
                                >
                                    <X size={18} strokeWidth={2} />
                                </button>
                            </div>
                        </div>

                        <div className="p-[20px] space-y-[15px] bg-[#f0f3f6]">
                            {/* SECCIÓN 1 */}
                            <fieldset className="border border-[#ced4da] p-[25px] pt-[8px] bg-white relative">
                                <legend className="px-1.5 text-[10px] font-semibold text-[#106ebe] uppercase italic">Datos de Platillo</legend>
                                <div className="flex gap-[35px] mt-1">
                                    <div className="flex-1 space-y-[12px]">
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
                                                    className="flex-1 h-[32px] bg-white border border-[#e2e8f0] px-3 text-[12px] text-slate-700 outline-none focus:border-[#106ebe] uppercase"
                                                    value={newProduct[f.key] || ''}
                                                    onChange={e => setNewProduct({...newProduct, [f.key]: e.target.value.toUpperCase()})}
                                                />
                                            </div>
                                        ))}
                                        
                                        <div className="flex items-center">
                                            <div className="flex flex-1 items-center">
                                                <label className="text-[11px] text-gray-400 w-[100px] shrink-0 uppercase tracking-tighter">Precio Costo</label>
                                                <div className="flex-1 relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-300">Q</span>
                                                    <input 
                                                        type="text" 
                                                        className="w-full h-[32px] bg-white border border-[#e2e8f0] pl-7 pr-3 text-[12px] text-slate-700 outline-none focus:border-[#106ebe] text-right"
                                                        value={newProduct.cost_price || '0'}
                                                        onChange={e => setNewProduct({...newProduct, cost_price: e.target.value})}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center ml-[25px]">
                                                <label className="text-[11px] text-gray-400 mr-4 uppercase tracking-tighter">Prioridad</label>
                                                <input 
                                                    type="text" 
                                                    className="w-[100px] h-[32px] bg-white border border-[#e2e8f0] px-2 text-[12px] text-slate-700 outline-none focus:border-[#106ebe] text-center"
                                                    value={newProduct.sort_order || '100'}
                                                    onChange={e => setNewProduct({...newProduct, sort_order: e.target.value})}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <label className="text-[11px] text-gray-400 w-[100px] shrink-0 uppercase tracking-tighter">Categoría</label>
                                            <select 
                                                className="flex-1 h-[32px] bg-white border border-[#e2e8f0] px-2 text-[12px] text-slate-700 outline-none focus:border-[#106ebe] uppercase cursor-pointer"
                                                value={newProduct.category_id || ''}
                                                onChange={e => setNewProduct({...newProduct, category_id: e.target.value})}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {menuCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center">
                                            <label className="text-[11px] text-gray-400 w-[100px] shrink-0 uppercase tracking-tighter">Cocina</label>
                                            <select 
                                                className="flex-1 h-[32px] bg-white border border-[#e2e8f0] px-2 text-[12px] text-slate-700 outline-none focus:border-[#106ebe] uppercase cursor-pointer"
                                                value={newProduct.kitchen_station_id || ''}
                                                onChange={e => setNewProduct({...newProduct, kitchen_station_id: e.target.value})}
                                            >
                                                <option value="">Ninguna</option>
                                                {kitchens.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="w-[170px] flex flex-col items-center">
                                        <div className="w-full aspect-square border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-center text-gray-300 relative shadow-inner">
                                            {newProduct.image_url ? (
                                                <img src={newProduct.image_url} className="w-full h-full object-cover" alt="Plato" />
                                            ) : (
                                                <ImageIcon size={48} strokeWidth={0.5} className="opacity-20" />
                                            )}
                                        </div>
                                        <button className="mt-3 text-[10px] font-bold uppercase text-gray-400 hover:text-[#106ebe] tracking-tighter">Cambiar Imagen</button>
                                    </div>
                                </div>
                            </fieldset>

                            {/* SECCIÓN 2 */}
                            <fieldset className="border border-[#ced4da] p-[25px] pt-[8px] bg-white relative">
                                <legend className="px-1.5 text-[10px] font-semibold text-[#106ebe] uppercase italic">Precios de Venta</legend>
                                <div className="grid grid-cols-4 gap-[20px] items-end mt-1">
                                    {[ 
                                        { label: 'Precio Venta', key: 'price', color: '#106ebe' },
                                        { label: 'Precio Domicilio', key: 'delivery_price' },
                                        { label: 'Precio Plataformas', key: 'platform_price' }
                                    ].map((f) => (
                                        <div key={f.key} className="space-y-1.5">
                                            <label className="text-[10px] text-gray-400 block text-center uppercase tracking-tighter">{f.label}</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-300">Q</span>
                                                <input 
                                                    type="text" 
                                                    className={`w-full h-[34px] bg-white border border-[#e2e8f0] pl-8 pr-3 text-[13px] font-bold text-center outline-none focus:border-[#106ebe]`}
                                                    style={{ color: f.color || '#475569' }}
                                                    value={newProduct[f.key] || '00.00'}
                                                    onChange={e => setNewProduct({...newProduct, [f.key]: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <button 
                                        className="h-[34px] bg-[#106ebe] text-white text-[11px] font-bold uppercase hover:bg-[#0d5aa0] transition-colors shadow-sm"
                                        onClick={() => branchPrices.forEach(bp => { bp.price = newProduct.price; })}
                                    >
                                        Aplicar a Todos
                                    </button>
                                </div>
                            </fieldset>

                            {/* TABS Y TABLA */}
                            <div className="flex-1 border border-[#ced4da] bg-white shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                                <div className="h-[40px] bg-[#f8fafc] border-b border-[#ced4da] flex justify-between items-center px-1">
                                    <div className="flex h-full items-center">
                                        <button 
                                            onClick={() => setActiveTab('sucursales')}
                                            className={`px-6 h-full text-[11px] font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'sucursales' ? 'bg-white text-[#106ebe] border-x border-t-[3px] border-t-[#106ebe] z-10' : 'text-gray-400 border-r border-[#e2e8f0]'}`}
                                        >
                                            Sucursales
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('opciones')}
                                            className={`px-6 h-full text-[11px] font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'opciones' ? 'bg-white text-[#106ebe] border-x border-t-[3px] border-t-[#106ebe] z-10' : 'text-gray-400'}`}
                                        >
                                            Opciones y Modificadores
                                        </button>
                                    </div>
                                    <button 
                                        className="h-[30px] px-5 bg-[#106ebe] text-white text-[11px] font-bold uppercase flex items-center gap-2 hover:bg-[#0d5aa0]"
                                        onClick={() => setSearchModal({ visible: true, type: 'inventory' })}
                                    >
                                        <FileText size={15} /> Receta / Ficha Técnica
                                    </button>
                                </div>

                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    {activeTab === 'sucursales' ? (
                                        <div className="p-4">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="h-[40px] text-[11px] text-gray-400 uppercase border-b border-[#e2e8f0] bg-[#f8fafc]">
                                                        <th className="px-5 text-left border-r border-[#f1f5f9]">Sucursal</th>
                                                        <th className="px-5 text-center border-r border-[#f1f5f9] w-[140px]">Precio Venta</th>
                                                        <th className="px-5 text-center border-r border-[#f1f5f9] w-[140px]">Precio Domicilio</th>
                                                        <th className="px-5 text-center border-r border-[#f1f5f9] w-[140px]">Precio Plataformas</th>
                                                        <th className="px-5 text-center border-r border-[#f1f5f9] w-[100px]">Habilitado</th>
                                                        <th className="px-5 text-center w-[100px]">Asignado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#f1f5f9]">
                                                    {branchPrices.map((bp, idx) => (
                                                        <tr key={bp.branch_id} className="h-[44px] hover:bg-blue-50/10">
                                                            <td className="px-5 text-[11px] font-bold text-slate-600 uppercase truncate max-w-[240px]">{branches.find(b => b.id === bp.branch_id)?.name || '---'}</td>
                                                            {[ 'price', 'delivery_price', 'platform_price' ].map(field => (
                                                                <td key={field} className="px-5 border-r border-[#f1f5f9] text-center">
                                                                    <div className="relative">
                                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-300">Q</span>
                                                                        <input 
                                                                            type="text" 
                                                                            className="w-full h-7 border-b border-[#f1f5f9] text-center text-slate-700 font-bold text-[12px] outline-none" 
                                                                            value={bp[field]} 
                                                                            onChange={e => {
                                                                                const n = [...branchPrices];
                                                                                n[idx][field] = e.target.value.replace(/[^0-9.]/g, '');
                                                                                setBranchPrices(n);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            ))}
                                                            <td className="px-5 border-r border-[#f1f5f9] text-center">
                                                                <input type="checkbox" checked={bp.is_enabled} className="w-4 h-4 accent-[#106ebe]" />
                                                            </td>
                                                            <td className="px-5 text-center">
                                                                <input type="checkbox" checked={true} className="w-4 h-4 accent-[#106ebe]" />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="flex h-full divide-x divide-[#e2e8f0]">
                                            {[ 
                                                { title: 'Opciones Asignadas', data: assignedOptionGroups },
                                                { title: 'Modificadores Asignadas', data: assignedModifierGroups }
                                            ].map((panel, idx) => (
                                                <div key={idx} className="flex-1 flex flex-col bg-white">
                                                    <div className="h-[40px] bg-[#f5faff] border-b border-[#ced4da] flex items-center px-8">
                                                        <span className="text-[11px] font-bold text-[#106ebe] uppercase tracking-tighter">{panel.title}</span>
                                                    </div>
                                                    <div className="flex-1 flex flex-col items-center justify-center p-10 select-none opacity-20">
                                                        <Layers size={50} strokeWidth={1} className="text-gray-300 mb-4" />
                                                        <p className="text-[11px] font-black tracking-[0.3em] text-gray-400">HAZ CLIC DERECHO PARA AGREGAR</p>
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
