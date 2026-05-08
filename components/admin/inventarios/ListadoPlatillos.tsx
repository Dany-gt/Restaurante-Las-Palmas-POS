import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabase';
import { Search, Plus, Edit2, Trash2, Folder, ChefHat, X, RefreshCw, Package } from 'lucide-react';
import { PremiumIcon, ICON_MAP } from '../../shared/PremiumIcon';

interface Platillo {
    id: string;
    codigo: string;
    nombre: string;
    categoria: string;
    categoria_id: string;
    cocina: string;
    kitchen_station_id: string;
    prioridad: number;
    existencia: number;
    precio_costo: number;
    precio_venta: number;
    habilitado: boolean;
}

interface ListadoPlatillosProps {
    categorias: Set<string>;
    sucursalId: string;
    onEdit: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    onRefresh: () => void;
    onChangeCategory: (id: string) => void;
    onChangeKitchen: (id: string) => void;
    iconTheme?: 'classic' | 'premium';
}

export const ListadoPlatillos: React.FC<ListadoPlatillosProps> = ({ 
    categorias, sucursalId, onEdit, onNew, onDelete, onRefresh, onChangeCategory, onChangeKitchen, iconTheme = 'classic'
}) => {
    const [items, setItems] = useState<Platillo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [branchStock, setBranchStock] = useState<any[]>([]);
    const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, product: Platillo | null }>({ visible: false, x: 0, y: 0, product: null });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let query = supabase.from('products').select('*, menu_categories!menu_category_id(nombre), kitchen_stations(name)')
                    .eq('es_platillo', true);
                
                if (categorias.size > 0) query = query.in('menu_category_id', Array.from(categorias));

                const { data, error } = await query.order('name');
                const { data: stockData } = await supabase.from('inventory_item_branches').select('*');
                
                if (data) setItems(data);
                if (stockData) setBranchStock(stockData);
                if (error) console.error('Error fetching platillos:', error.message);
            } catch (e) {
                console.error('Fetch error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [categorias, sucursalId]);

    const handleContextMenu = (e: React.MouseEvent, product: Platillo | null = null) => {
        e.preventDefault();
        e.stopPropagation();
        
        let x = e.clientX;
        let y = e.clientY;
        const menuWidth = 220;
        const menuHeight = product ? 220 : 80;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

        setContextMenu({ visible: true, x, y, product });
        if (product) setSelectedId(product.id);
    };

    useEffect(() => {
        const hideMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', hideMenu);
        window.addEventListener('contextmenu', (e) => {
            // Si el clic no fue dentro de nuestra grilla, cerramos el menú personalizado
            const target = e.target as HTMLElement;
            if (!target.closest('.grid-container')) hideMenu();
        });
        return () => {
            window.removeEventListener('click', hideMenu);
        };
    }, []);

    const filtered = items.filter(item =>
        ((item as any).name || item.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
        ((item as any).product_code || item.codigo || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div 
            className="flex-1 flex flex-col bg-white overflow-hidden shadow-inner border-l border-gray-300 grid-container"
            onContextMenu={(e) => handleContextMenu(e)}
        >
            {/* Toolbar Superior */}
            <div className="h-8 bg-[#f5f5f5] border-b border-gray-300 flex items-center justify-between px-2 shrink-0">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tighter">Listado de Platillos</span>
                <div className="flex items-center gap-1">
                    <div className="relative flex items-center h-5">
                        <input 
                            type="text"
                            placeholder="Introduzca el texto a buscar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-white border border-gray-400 h-full px-2 text-[10px] w-56 outline-none focus:border-[#106ebe]"
                        />
                        <button className="bg-[#f0f0f0] border border-gray-400 h-full px-4 text-[9px] font-bold border-l-0 hover:bg-white transition-colors active:bg-gray-200 text-black">
                            BUSCAR
                        </button>
                    </div>
                    <button 
                        onClick={onRefresh}
                        className="h-5 w-5 flex items-center justify-center bg-white border border-gray-400 hover:bg-gray-100 text-slate-600 transition-all"
                        title="Refrescar Listado"
                    >
                        <RefreshCw size={12} />
                    </button>
                </div>
            </div>


            {/* Grid Area */}
            <div className="flex-1 overflow-auto bg-[#fafafa] max-h-[calc(100vh-180px)] custom-scrollbar shadow-inner">
                <table className="w-full border-collapse border-spacing-0 min-w-max">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-[#f5f5f5] border-b border-gray-300 h-7 select-none">
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-center border-r border-gray-300 w-28">Código</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-center border-r border-gray-300 min-w-[350px]">Platillo</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-center border-r border-gray-300 w-[280px]">Categoría</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-center border-r border-gray-300 w-32">Cocina</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-center border-r border-gray-300 w-24">Prioridad</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-center border-r border-gray-300 w-28">Precio Costo</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-center border-r border-gray-300 w-28">Precio Venta</th>
                            <th className="px-4 text-[10px] font-bold text-slate-700 text-center w-24">Habilitado</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {loading ? (
                            <tr><td colSpan={8} className="py-20 text-center text-[10px] uppercase font-bold text-slate-400">Consultando Base de Datos...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={8} className="py-20 text-center text-[10px] uppercase font-bold text-slate-400">No se encontraron registros</td></tr>
                        ) : (
                            filtered.map((item, index) => (
                                <tr 
                                    key={item.id} 
                                    onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); }}
                                    onDoubleClick={() => onEdit(item.id)}
                                    onContextMenu={(e) => handleContextMenu(e, item)}
                                     className={`
                                         h-6 cursor-pointer transition-colors
                                        ${selectedId === item.id ? 'bg-[#106ebe] text-white font-bold' : index % 2 === 0 ? 'bg-white hover:bg-blue-50 text-slate-800' : 'bg-[#f5f5f5] hover:bg-blue-50 text-slate-800'}
                                    `}
                                >
                                    <td className="px-4 text-[10px] font-bold border-r border-gray-100">{(item as any).product_code || '---'}</td>
                                    <td className="px-4 text-[10px] font-bold uppercase truncate">{(item as any).name}</td>
                                    <td className="px-4 text-[10px] border-x border-gray-100 uppercase text-slate-700 font-medium" style={{ color: selectedId === item.id ? 'white' : '' }}>
                                        {item.categoria || (item as any).menu_categories?.nombre}
                                    </td>
                                    <td className="px-4 text-[10px] border-r border-gray-100 uppercase">{item.cocina || (item as any).kitchen_stations?.name}</td>
                                    <td className="px-4 text-[10px] border-r border-gray-100 text-center">{(item as any).priority || 100}</td>
                                    
                                    <td className="px-4 text-[10px] border-r border-gray-100 text-right tabular-nums">Q{(item as any).cost_price?.toFixed(2) || '0.00'}</td>
                                    <td className="px-4 text-[10px] border-r border-gray-100 text-right tabular-nums font-bold">Q{(item as any).price?.toFixed(2) || '0.00'}</td>
                                    <td className="px-4 border-gray-100">
                                        <div className="flex justify-center">
                                            <input type="checkbox" checked={item.habilitado || (item as any).is_enabled} readOnly className="w-3.5 h-3.5" />
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
                <span className="text-[10px] font-bold text-slate-800">Platos: {filtered.length}</span>
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
                                {iconTheme === 'premium' ? <PremiumIcon icon={ICON_MAP.PLUS} size={18} color="currentColor" /> : <Plus size={15} className="group-hover:text-white text-[#106ebe]" />}
                                <span className="text-[11px] font-bold uppercase tracking-tight">Nuevo</span>
                            </button>

                            <button 
                                disabled={!contextMenu.product}
                                onClick={(e) => { 
                                    if (!contextMenu.product) return;
                                    e.stopPropagation(); 
                                    onEdit(contextMenu.product.id); 
                                    setContextMenu({ ...contextMenu, visible: false }); 
                                }}
                                className={`w-full h-7 flex items-center gap-2.5 px-3 transition-none group ${!contextMenu.product ? 'opacity-40 cursor-not-allowed text-gray-400' : 'hover:bg-[#106ebe] hover:text-white text-slate-800'}`}
                            >
                                {iconTheme === 'premium' ? <PremiumIcon icon={ICON_MAP.EDIT} size={18} color="currentColor" /> : <Edit2 size={13} className={!contextMenu.product ? 'text-gray-400' : 'text-gray-500 group-hover:text-white'} />}
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
                                {iconTheme === 'premium' ? <PremiumIcon icon={ICON_MAP.TRASH} size={18} color="currentColor" /> : <Trash2 size={14} className={!contextMenu.product ? 'text-gray-400' : 'text-red-500 group-hover:text-white'} />}
                                <span className="text-[11px] font-bold uppercase tracking-tight">Eliminar</span>
                            </button>

                            <div className="h-px bg-gray-300 my-1 mx-2"></div>
                            
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRefresh(); setContextMenu({ ...contextMenu, visible: false }); }}
                                className="w-full h-7 flex items-center gap-2.5 px-3 hover:bg-[#106ebe] hover:text-white transition-none group text-slate-800"
                            >
                                {iconTheme === 'premium' ? <PremiumIcon icon={ICON_MAP.REFRESH} size={18} color="currentColor" /> : <RefreshCw size={14} className="text-gray-500 group-hover:text-white" />}
                                <span className="text-[11px] font-bold uppercase tracking-tight">Refrescar</span>
                            </button>
                            
                            <button 
                                disabled={!contextMenu.product}
                                onClick={(e) => { 
                                    if (!contextMenu.product) return;
                                    e.stopPropagation(); 
                                    onChangeCategory(contextMenu.product.id); 
                                    setContextMenu({ ...contextMenu, visible: false }); 
                                }}
                                className={`w-full h-7 flex items-center gap-2.5 px-3 transition-none group ${!contextMenu.product ? 'opacity-40 cursor-not-allowed text-gray-400' : 'hover:bg-[#106ebe] hover:text-white text-slate-800'}`}
                            >
                                {iconTheme === 'premium' ? <PremiumIcon name={ICON_MAP.CATEGORY} size={16} color="currentColor" /> : <Folder size={14} className={!contextMenu.product ? 'text-gray-400' : 'text-amber-500 group-hover:text-white'} />}
                                <span className="text-[11px] font-bold uppercase tracking-tight">Cambiar Categoría</span>
                            </button>

                            <button 
                                disabled={!contextMenu.product}
                                onClick={(e) => { 
                                    if (!contextMenu.product) return;
                                    e.stopPropagation(); 
                                    onChangeKitchen(contextMenu.product.id); 
                                    setContextMenu({ ...contextMenu, visible: false }); 
                                }}
                                className={`w-full h-7 flex items-center gap-2.5 px-3 transition-none group ${!contextMenu.product ? 'opacity-40 cursor-not-allowed text-gray-400' : 'hover:bg-[#106ebe] hover:text-white text-slate-800'}`}
                            >
                                {iconTheme === 'premium' ? <PremiumIcon name={ICON_MAP.CHEF} size={16} color="currentColor" /> : <ChefHat size={14} className={!contextMenu.product ? 'text-gray-400' : 'text-blue-500 group-hover:text-white'} />}
                                <span className="text-[11px] font-bold uppercase tracking-tight">Cambiar Cocina</span>
                            </button>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};
