import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabase';
import { Search, Plus, Edit2, Trash2, Folder, Package, X, RefreshCw } from 'lucide-react';

interface Producto {
    id: string;
    codigo: string;
    categoria: string;
    categoria_id: string;
    nombre: string;
    existencia: number;
    presentacion: string;
    precio_costo: number;
    habilitado: boolean;
}

interface ListadoProductosProps {
    categorias: Set<string>;
    sucursalId: string;
    onEdit: (id: string, type: 'platillo' | 'producto') => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    onRefresh: () => void;
    onChangeCategory: (id: string) => void;
    onKardex: (id: string) => void;
}

export const ListadoProductos: React.FC<ListadoProductosProps> = ({ 
    categorias, sucursalId, onEdit, onNew, onDelete, onRefresh, onChangeCategory, onKardex 
}) => {
    const [items, setItems] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, product: Producto | null }>({ visible: false, x: 0, y: 0, product: null });

    const formatAmount = (num: number) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Insumos/Productos — tabla: products con es_platillo=false
                let query = supabase
                    .from('products')
                    .select('*, product_categories!product_category_id(nombre)')
                    .eq('es_platillo', false);

                if (categorias.size > 0) {
                    query = query.in('product_category_id', Array.from(categorias));
                }

                const { data, error } = await query.order('name');

                if (data) {
                    const mapped = data.map((i: any) => {
                        const conversion = parseFloat(i.conversion_factor) || 1;
                        const formattedConv = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(conversion);
                        const presentacion = `${i.presentation_unit || ''} ${formattedConv} ${i.unit_measure || ''}`.trim();

                        return {
                            ...i,
                            id: i.id,
                            codigo: i.product_code || '',
                            nombre: i.name || 'SIN NOMBRE',
                            categoria: i.product_categories?.nombre || 'SIN CATEGORÍA',
                            categoria_id: i.product_category_id,
                            existencia: parseFloat(i.stock_actual || 0) || 0,
                            presentacion: presentacion || 'UNIDAD',
                            precio_costo: parseFloat(i.cost_price || 0) || 0,
                            habilitado: i.is_enabled !== undefined ? i.is_enabled : true,
                        };
                    });
                    setItems(mapped);
                }

                if (error) console.error('Error fetching inventory items:', error.message);
            } catch (e: any) {
                console.error('Fetch error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [categorias, sucursalId]);

    const handleContextMenu = (e: React.MouseEvent, product: Producto | null = null) => {
        e.preventDefault();
        e.stopPropagation();
        
        let x = e.clientX;
        let y = e.clientY;
        const menuWidth = 220;
        const menuHeight = product ? 200 : 80;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

        setContextMenu({ visible: true, x, y, product });
        if (product) setSelectedId(product.id);
    };

    useEffect(() => {
        const hideMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', hideMenu);
        window.addEventListener('contextmenu', (e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.grid-container')) hideMenu();
        });
        return () => window.removeEventListener('click', hideMenu);
    }, []);

    return (
        <div 
            className="flex-1 flex flex-col bg-white overflow-hidden shadow-inner border-l border-gray-300 grid-container"
            onContextMenu={(e) => handleContextMenu(e)}
        >
            {/* Toolbar Superior */}
            <div className="h-8 bg-[#f5f5f5] border-b border-gray-300 flex items-center px-2 shrink-0">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tighter">Listado de Productos / Insumos</span>
            </div>


            {/* Grid Area */}
            <div className="flex-1 overflow-auto bg-[#fafafa] max-h-[calc(100vh-180px)] custom-scrollbar shadow-inner">
                <table className="w-full border-collapse border-spacing-0 min-w-max">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-[#f5f5f5] border-b border-gray-300 h-7 select-none">
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-left border-r border-gray-300 w-32">Código</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-left border-r border-gray-300 w-56">Categoría</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-left border-r border-gray-300 min-w-[500px]">Producto / Insumo</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-center border-r border-gray-200 w-32">Existencia</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-center border-r border-gray-300 w-72">Presentación</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-right border-r border-gray-300 w-40">Precio Costo</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-center w-32">Habilitado</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {loading ? (
                            <tr><td colSpan={7} className="py-20 text-center text-[10px] uppercase font-bold text-slate-400 font-sans">Sincronizando Inventario...</td></tr>
                        ) : items.length === 0 ? (
                            <tr><td colSpan={7} className="py-20 text-center text-[10px] uppercase font-bold text-slate-400 font-sans italic">No se encontraron productos</td></tr>
                        ) : (
                            items.map((item) => (
                                <tr 
                                    key={item.id} 
                                    onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); }}
                                    onDoubleClick={() => onEdit(item.id, 'producto')}
                                    onContextMenu={(e) => handleContextMenu(e, item)}
                                    className={`
                                        h-6 border-b border-gray-100 cursor-pointer transition-colors
                                        ${selectedId === item.id ? 'bg-[#106ebe] text-white font-bold' : 'hover:bg-blue-50 text-slate-800'}
                                    `}
                                >
                                    <td className="px-4 text-[10px] border-r border-gray-100 tabular-nums">{item.codigo || '---'}</td>
                                    <td className="px-4 text-[10px] border-r border-gray-100 uppercase text-gray-400" style={{ color: selectedId === item.id ? 'white' : '' }}>
                                        {item.categoria}
                                    </td>
                                    <td className="px-4 text-[10px] uppercase truncate">{item.nombre}</td>
                                    <td className={`px-4 text-[10px] border-x border-gray-100 text-center tabular-nums font-black ${selectedId === item.id ? 'text-white' : item.existencia <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                        {item.existencia?.toFixed(2) || '0.00'}
                                    </td>
                                    <td className="px-4 text-[10px] border-r border-gray-100 uppercase text-center">{item.presentacion || 'UNIDAD'}</td>
                                    <td className="px-4 text-[10px] border-r border-gray-100 text-right tabular-nums">Q. {item.precio_costo?.toFixed(2) || '0.00'}</td>
                                    <td className="px-4 border-gray-100">
                                        <div className="flex justify-center">
                                            <input type="checkbox" checked={item.habilitado} readOnly className="w-3.5 h-3.5 outline-none" />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="h-6 bg-[#f0f0f0] border-t border-gray-300 px-2 flex items-center shrink-0">
                <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tighter">Productos: {items.length}</span>
            </div>

            {/* Context Menu Portal */}
            {contextMenu.visible && createPortal(
                <>
                    <div className="fixed inset-0 z-[99999]" onClick={() => setContextMenu({ ...contextMenu, visible: false })}></div>
                    <div
                        className="fixed z-[100000] w-60 bg-white border border-gray-400 shadow-[4px_4px_10px_rgba(0,0,0,0.2)] py-1"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <div className="p-0.5">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onNew(); setContextMenu({ ...contextMenu, visible: false }); }}
                                className="w-full h-7 flex items-center gap-2.5 px-3 hover:bg-[#106ebe] hover:text-white transition-none group text-slate-800"
                            >
                                <Plus size={15} className="group-hover:text-white text-[#106ebe]" />
                                <span className="text-[11px] font-bold uppercase tracking-tight">Nuevo</span>
                            </button>

                            <button 
                                disabled={!contextMenu.product}
                                onClick={(e) => { 
                                    if (!contextMenu.product) return;
                                    e.stopPropagation(); 
                                    onEdit(contextMenu.product.id, 'producto'); 
                                    setContextMenu({ ...contextMenu, visible: false }); 
                                }}
                                className={`w-full h-7 flex items-center gap-2.5 px-3 transition-none group ${!contextMenu.product ? 'opacity-40 cursor-not-allowed text-gray-400' : 'hover:bg-[#106ebe] hover:text-white text-slate-800'}`}
                            >
                                <Edit2 size={13} className={!contextMenu.product ? 'text-gray-400' : 'text-gray-500 group-hover:text-white'} />
                                <span className="text-[11px] font-bold uppercase tracking-tight">Editar</span>
                            </button>

                            <button 
                                disabled={!contextMenu.product}
                                onClick={(e) => { 
                                    if (!contextMenu.product) return;
                                    e.stopPropagation(); 
                                    onDelete(contextMenu.product.id); 
                                    setContextMenu({ ...contextMenu, visible: false }); 
                                }}
                                className={`w-full h-7 flex items-center gap-2.5 px-3 transition-none group ${!contextMenu.product ? 'opacity-40 cursor-not-allowed text-gray-400' : 'hover:bg-[#106ebe] hover:text-white text-slate-800'}`}
                            >
                                <Trash2 size={14} className={!contextMenu.product ? 'text-gray-400' : 'text-red-500 group-hover:text-white'} />
                                <span className="text-[11px] font-bold uppercase tracking-tight">Eliminar</span>
                            </button>

                            <div className="h-px bg-gray-300 my-1 mx-2"></div>
                            
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRefresh(); setContextMenu({ ...contextMenu, visible: false }); }}
                                className="w-full h-7 flex items-center gap-2.5 px-3 hover:bg-[#106ebe] hover:text-white transition-none group text-slate-800"
                            >
                                <RefreshCw size={14} className="text-gray-500 group-hover:text-white" />
                                <span className="text-[11px] font-bold uppercase tracking-tight">Refrescar</span>
                            </button>


                            
                            <button 
                                disabled={!contextMenu.product}
                                onClick={(e) => { 
                                    if (!contextMenu.product) return;
                                    e.stopPropagation(); 
                                    onKardex(contextMenu.product.id); 
                                    setContextMenu({ ...contextMenu, visible: false }); 
                                }}
                                className={`w-full h-7 flex items-center gap-2.5 px-3 transition-none group ${!contextMenu.product ? 'opacity-40 cursor-not-allowed text-gray-400' : 'hover:bg-[#106ebe] hover:text-white text-slate-800'}`}
                            >
                                <Package size={14} className={!contextMenu.product ? 'text-gray-400' : 'text-blue-500 group-hover:text-white'} />
                                <span className="text-[11px] font-bold uppercase tracking-tight">Ver Kardex</span>
                            </button>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};
