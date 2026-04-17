import React from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Image as ImageIcon, Trash2, Package } from 'lucide-react';
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
    categories: any[];
    units: any[];
    branches: any[];
    branchInventory: any[];
    setBranchInventory: (val: any[]) => void;
}

export const ProductoModal: React.FC<ProductoModalProps> = ({
    isOpen, onClose, editingId, newProduct, setNewProduct, handleSave, isSaving,
    categories, units, branches, branchInventory, setBranchInventory
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[2000000] flex items-center justify-center p-2 bg-black/5 pointer-events-none font-sans overflow-hidden">
            <div className="absolute inset-0 pointer-events-auto" onClick={onClose}></div>
            <div className="pointer-events-auto">
                <DraggableWindow>
                    <div className="bg-[#f2f4f7] border border-[#106ebe] w-[820px] overflow-hidden flex flex-col shadow-[0_25px_80px_rgba(0,0,0,0.35)] animate-in fade-in duration-100">
                        {/* HEADER - PIXEL PERFECT */}
                        <div className="modal-header bg-[#106ebe] h-9 px-3 flex justify-between items-center text-white shrink-0 cursor-move active:cursor-grabbing select-none shadow-md">
                            <div className="flex items-center gap-1.5 pt-0.5">
                                <span className="text-[12px] font-bold uppercase tracking-tight">MANTENIMIENTO DE PRODUCTO / INSUMO</span>
                            </div>
                            <div className="flex h-full items-center">
                                <button className="h-full px-4 hover:bg-white/10 flex items-center gap-1.5 transition-colors group">
                                    <ImageIcon size={15} className="text-white/80 group-hover:text-white" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none">IMAGEN</span>
                                </button>
                                <div className="h-full flex items-center px-1 border-l border-white/10">
                                    <WindowsSaveButton onClick={handleSave} loading={isSaving} variant="minimal" title="Guardar" />
                                </div>
                                <button onClick={onClose} className="w-10 h-full flex items-center justify-center hover:bg-[#e81123] transition-all ml-1" title="Cerrar">
                                    <X size={20} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-[#f2f4f7]">
                            {/* DATOS BÁSICOS */}
                            <fieldset className="border border-gray-300 p-6 pt-1.5 bg-white relative shadow-sm">
                                <legend className="px-2 text-[10.5px] font-bold text-[#106ebe] uppercase italic tracking-tighter">DATOS DEL PRODUCTO</legend>
                                <div className="flex gap-10 mt-2">
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-4">
                                            <label className="text-[10px] font-bold text-gray-400 w-24 shrink-0 uppercase tracking-tighter whitespace-nowrap leading-none">Nombre</label>
                                            <input 
                                                type="text" 
                                                className="flex-1 h-8.5 bg-white border border-gray-300 px-3 text-[12px] font-bold text-slate-700 outline-none focus:border-[#106ebe] uppercase shadow-sm"
                                                value={newProduct.name || ''}
                                                onChange={e => setNewProduct({...newProduct, name: e.target.value.toUpperCase()})}
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <label className="text-[10px] font-bold text-gray-400 w-24 shrink-0 uppercase tracking-tighter whitespace-nowrap leading-none">Descripción</label>
                                            <input 
                                                type="text" 
                                                className="flex-1 h-8.5 bg-white border border-gray-300 px-3 text-[12px] font-bold text-slate-700 outline-none focus:border-[#106ebe] uppercase shadow-sm"
                                                value={newProduct.description || ''}
                                                onChange={e => setNewProduct({...newProduct, description: e.target.value.toUpperCase()})}
                                            />
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-1 flex items-center gap-4">
                                                <label className="text-[10px] font-bold text-gray-400 w-24 shrink-0 uppercase tracking-tighter whitespace-nowrap leading-none">Categoría</label>
                                                <select 
                                                    className="flex-1 h-8.5 bg-white border border-gray-300 px-2 text-[12px] font-bold text-slate-700 outline-none focus:border-[#106ebe] uppercase cursor-pointer shadow-sm"
                                                    value={newProduct.category_id || ''}
                                                    onChange={e => setNewProduct({...newProduct, category_id: e.target.value})}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1 flex items-center gap-4">
                                                <label className="text-[10px] font-bold text-gray-400 w-16 shrink-0 uppercase tracking-tighter whitespace-nowrap leading-none">Unidad</label>
                                                <select 
                                                    className="flex-1 h-8.5 bg-white border border-gray-300 px-2 text-[12px] font-bold text-slate-700 outline-none focus:border-[#106ebe] uppercase cursor-pointer shadow-sm"
                                                    value={newProduct.unit_id || ''}
                                                    onChange={e => setNewProduct({...newProduct, unit_id: e.target.value})}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="w-[180px] flex flex-col items-center gap-3 pt-2">
                                        <div className="w-full aspect-square border border-gray-200 bg-[#f8f9fa] flex flex-col items-center justify-center text-gray-400 overflow-hidden relative shadow-inner">
                                            {newProduct.image_url ? (
                                                <img src={newProduct.image_url} className="w-full h-full object-cover" alt="Producto" />
                                            ) : (
                                                <ImageIcon size={52} strokeWidth={0.5} className="opacity-20" />
                                            )}
                                        </div>
                                        <button className="text-[10px] font-bold uppercase text-gray-400 hover:text-[#106ebe] transition-colors tracking-widest leading-none pt-1">CAMBIAR IMAGEN</button>
                                    </div>
                                </div>
                            </fieldset>

                            {/* COSTOS Y STOCK */}
                            <fieldset className="border border-gray-300 p-5 pt-1.5 bg-white relative shadow-sm">
                                <legend className="px-2 text-[10.5px] font-bold text-[#106ebe] uppercase italic tracking-tighter">COSTOS Y RENDIMIENTO</legend>
                                <div className="grid grid-cols-3 gap-8 items-end mt-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 block text-center uppercase tracking-tighter">COSTO ÚLTIMA COMPRA</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-bold">Q</span>
                                            <input 
                                                type="text" 
                                                className="w-full h-8.5 bg-white border border-gray-300 pl-8 pr-3 text-[13px] font-bold text-[#106ebe] outline-none focus:border-[#106ebe] text-center shadow-sm"
                                                value={newProduct.last_cost || '0.00'}
                                                onChange={e => setNewProduct({...newProduct, last_cost: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 block text-center uppercase tracking-tighter">STOCK MÍNIMO</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                className="w-full h-8.5 bg-white border border-gray-300 px-3 text-[13px] font-bold text-slate-600 outline-none focus:border-[#106ebe] text-center shadow-sm"
                                                value={newProduct.min_stock || '0'}
                                                onChange={e => setNewProduct({...newProduct, min_stock: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 text-center">
                                        <label className="text-[10px] font-black text-gray-400 block uppercase tracking-tighter mb-2">CONTROLAR STOCK</label>
                                        <div className="flex justify-center h-8.5 items-center">
                                            <input 
                                                type="checkbox" 
                                                checked={newProduct.track_inventory}
                                                onChange={e => setNewProduct({...newProduct, track_inventory: e.target.checked})}
                                                className="w-5 h-5 accent-[#106ebe] cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </fieldset>

                            {/* TABLA DE INVENTARIO POR SUCURSAL */}
                            <div className="flex-1 flex flex-col min-h-[350px] border border-gray-300 bg-white shadow-sm overflow-hidden">
                                <div className="h-10 bg-[#f8f9fa] border-b border-gray-300 flex items-center px-4 shrink-0">
                                    <span className="text-[11px] font-extrabold text-[#106ebe] uppercase tracking-tighter leading-none">Existencias por Sucursal</span>
                                </div>

                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="h-11 text-[11px] font-bold text-slate-400 uppercase border-b border-gray-200 bg-gray-50/20">
                                                <th className="px-5 text-left border-r border-gray-100">SUCURSAL</th>
                                                <th className="px-5 text-center border-r border-gray-100 w-48 leading-none">EXISTENCIA ACTUAL</th>
                                                <th className="px-5 text-center w-36 leading-none">HABILITADO</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {branchInventory.map((bi, idx) => {
                                                const branchName = branches.find(b => b.id === bi.branch_id)?.name || '---';
                                                return (
                                                    <tr key={bi.branch_id} className="h-12 hover:bg-blue-50/10 transition-colors">
                                                        <td className="px-5 text-[11px] font-bold text-slate-600 uppercase leading-none truncate max-w-[300px]">{branchName}</td>
                                                        <td className="px-5 border-r border-gray-50 text-center">
                                                            <div className="relative">
                                                                <input 
                                                                    type="text" 
                                                                    className="w-full h-8 border border-gray-200 text-center text-slate-700 font-bold text-[12.5px] outline-none bg-transparent shadow-inner" 
                                                                    value={bi.stock} 
                                                                    onChange={e => {
                                                                        const n = [...branchInventory];
                                                                        n[idx].stock = e.target.value.replace(/[^0-9.]/g, '');
                                                                        setBranchInventory(n);
                                                                    }}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-5 text-center">
                                                            <div className="flex justify-center">
                                                                <input type="checkbox" checked={true} className="w-4.5 h-4.5 accent-[#106ebe] cursor-pointer" />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
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
