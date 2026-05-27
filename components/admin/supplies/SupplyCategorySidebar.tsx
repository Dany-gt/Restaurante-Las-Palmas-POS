/**
 * DOMINIO 3 — INSUMOS Y SUMINISTROS
 * Sidebar exclusivo de Suministros.
 * SOLO lee / escribe: supply_categories
 * NUNCA toca: menu_categories, product_categories,
 *              utensil_categories, products
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Trash2, X, Save, Loader2, ShoppingCart } from 'lucide-react';
import { useDomainCategories } from '../../../hooks/useDomainCategories';
import { useNotify } from '../../../hooks/useNotify';

// ══════════════════════════════════════════════════
// CONSTANTE: única tabla permitida en este módulo
// ══════════════════════════════════════════════════
const DOMAIN_TABLE = 'supply_categories' as const;
// NOTA: supply_categories usa columna 'name' (no 'nombre')
// El hook la mapea a 'nombre' para compatibilidad con la interfaz

interface SupplyCategorySidebarProps {
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    width?: number;
}

export const SupplyCategorySidebar: React.FC<SupplyCategorySidebarProps> = ({ selectedId, onSelect, width = 190 }) => {
    const notify = useNotify();
    const { categories, loading, create, update, remove } = useDomainCategories({
        table: DOMAIN_TABLE,   // ← SOLO ESTA TABLA
        orderBy: 'sort_order',
        nameField: 'name',     // supply_categories usa columna 'name'
    });

    const [form, setForm] = useState<{ id: string | null; nombre: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string; nombre: string } | null>(null);

    const handleSave = async () => {
        if (!form?.nombre.trim()) return;
        setIsSaving(true);
        try {
            if (form.id) {
                await update(form.id, { nombre: form.nombre.toUpperCase() });
                notify.success('Categoría actualizada');
            } else {
                await create(form.nombre);
                notify.success('Categoría creada');
            }
            setForm(null);
        } catch (e: any) {
            notify.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, nombre: string) => {
        setContextMenu(null);
        if (!confirm(`¿Eliminar categoría "${nombre}"?`)) return;
        try {
            await remove(id);
            if (selectedId === id) onSelect(null);
            notify.success('Categoría eliminada');
        } catch (e: any) {
            notify.error(e.message);
        }
    };

    return (
        <>
            <div
                className="flex flex-col bg-white border-r border-gray-300 h-full shadow-sm shrink-0 select-none"
                style={{ width: `${width}px` }}
                onClick={() => setContextMenu(null)}
            >
                <div className="bg-[#106ebe] h-[26px] px-2 flex items-center justify-between border-b border-[#004578] shrink-0">
                    <div className="flex items-center gap-1.5">
                        <ShoppingCart size={10} className="text-white/80" />
                        <span className="text-[9px] font-bold text-white uppercase tracking-tight">Suministros</span>
                    </div>
                    <button onClick={() => setForm({ id: null, nombre: '' })}
                        className="w-5 h-5 flex items-center justify-center hover:bg-white/20 rounded transition-colors text-white font-bold text-[14px] leading-none"
                        title="Nueva categoría de suministros">+</button>
                </div>

                <div className="bg-[#f0f0f0] h-6 px-2 flex items-center border-b border-gray-300 shrink-0">
                    <span className="text-[9px] font-bold text-gray-500 uppercase">Categoría</span>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div
                        className={`flex items-center h-[22px] px-3 cursor-pointer ${!selectedId ? 'bg-blue-50 text-[#106ebe] font-bold' : 'hover:bg-[#cce8ff] text-slate-700'}`}
                        onClick={() => onSelect(null)}
                    >
                        <span className="uppercase text-[10px]">— Todos los Insumos —</span>
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-4"><Loader2 size={14} className="animate-spin text-gray-400" /></div>
                    ) : (
                        categories.map(cat => (
                            <div
                                key={cat.id}
                                className={`flex items-center h-[22px] px-3 cursor-pointer group ${selectedId === cat.id ? 'bg-blue-50 text-[#106ebe] font-black' : 'hover:bg-[#cce8ff] text-slate-800'}`}
                                onClick={() => onSelect(cat.id)}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setForm({ id: cat.id, nombre: cat.nombre });
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault(); e.stopPropagation();
                                    setContextMenu({ x: Math.min(e.clientX, window.innerWidth - 160), y: Math.min(e.clientY, window.innerHeight - 100), id: cat.id, nombre: cat.nombre });
                                }}
                            >
                                <span className="flex-1 text-[10px] uppercase truncate leading-none">{cat.nombre}</span>
                                <div className="hidden group-hover:flex items-center gap-0.5">
                                    <button onClick={(e) => { e.stopPropagation(); setForm({ id: cat.id, nombre: cat.nombre }); }}
                                        className="p-0.5 hover:bg-blue-100 rounded"><Edit2 size={9} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(cat.id, cat.nombre); }}
                                        className="p-0.5 hover:bg-red-100 text-red-500 rounded"><Trash2 size={9} /></button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="h-5 bg-[#f0f0f0] border-t border-gray-300 px-2 flex items-center shrink-0">
                    <span className="text-[8px] font-bold text-gray-400 italic">Módulo: Insumos y Suministros</span>
                </div>
            </div>

            {contextMenu && createPortal(
                <>
                    <div className="fixed inset-0 z-[99999]" onClick={() => setContextMenu(null)} />
                    <div className="fixed z-[100000] bg-[#f0f0f0] border border-gray-400 shadow-lg py-0.5 w-36"
                        style={{ top: contextMenu.y, left: contextMenu.x }}>
                        <button onClick={() => { setForm({ id: contextMenu.id, nombre: contextMenu.nombre }); setContextMenu(null); }}
                            className="w-full h-6 flex items-center gap-2 px-3 hover:bg-[#106ebe] hover:text-white text-[11px] text-slate-700">
                            <Edit2 size={11} /> Editar
                        </button>
                        <button onClick={() => handleDelete(contextMenu.id, contextMenu.nombre)}
                            className="w-full h-6 flex items-center gap-2 px-3 hover:bg-red-500 hover:text-white text-[11px] text-red-600">
                            <Trash2 size={11} /> Eliminar
                        </button>
                    </div>
                </>, document.body
            )}

            {form !== null && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/20">
                    <div className="bg-[#f0f0f0] border border-[#106ebe] shadow-2xl w-[320px] overflow-hidden">
                        <div className="bg-[#106ebe] h-8 px-3 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                                <ShoppingCart size={13} />
                                <span className="text-[11px] font-bold uppercase">{form.id ? 'Editar' : 'Nueva'} Cat. de Suministros</span>
                            </div>
                            <button onClick={() => setForm(null)} className="hover:bg-red-500 w-7 h-7 flex items-center justify-center">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Nombre de Categoría</label>
                                <input autoFocus type="text" value={form.nombre}
                                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                                    className="w-full h-8 bg-white border border-gray-400 px-3 text-[11px] font-black uppercase outline-none focus:border-[#106ebe]"
                                    placeholder="ej. DESECHABLES" />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button onClick={() => setForm(null)}
                                    className="flex-1 h-8 bg-white border border-gray-400 text-[10px] font-bold uppercase hover:bg-gray-100">Cancelar</button>
                                <button onClick={handleSave} disabled={isSaving || !form.nombre.trim()}
                                    className="flex-1 h-8 bg-[#106ebe] text-white text-[10px] font-black uppercase hover:bg-[#004578] disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>, document.body
            )}
        </>
    );
};
