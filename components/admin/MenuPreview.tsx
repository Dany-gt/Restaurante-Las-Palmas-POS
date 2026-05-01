import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Loader2, ChevronLeft, X, RefreshCw, Layers, Monitor, ChevronDown, RotateCcw } from 'lucide-react';
import { Product } from '../../types';
import { DraggableWindow } from './AdminPortal';

const PlaceholderLogo = () => (
    <div className="w-full h-full flex flex-col items-center justify-center opacity-40 transition-opacity">
        <span className="text-[6px] font-black tracking-widest text-orange-400">RESTAURANTE</span>
        <span className="text-[8px] font-black tracking-widest text-[#94a3b8]">LAS PALMAS</span>
        <div className="h-px w-6 bg-red-500 my-1"></div>
        <span className="text-[10px] font-black tracking-widest text-white">POS</span>
    </div>
);

const ProductCard: React.FC<{ product: Product, currency: string }> = ({ product, currency }) => (
    <div className={`
        relative overflow-hidden rounded-lg cursor-default transition-all bg-[#2b2f3a] border border-white/5 aspect-square flex flex-col p-2
        ${product.is_enabled !== false ? 'opacity-100' : 'opacity-50'}
    `}>
        <div className="flex-1 flex flex-col items-center justify-center w-full mb-1 p-5 overflow-hidden">
            {product.image_url ? (
                <img 
                    src={product.image_url} 
                    alt={product.name} 
                    className="max-w-full max-h-full object-contain rounded-md opacity-90 transition-transform duration-300" 
                />
            ) : (
                <PlaceholderLogo />
            )}
        </div>
        <div className="w-full flex-col flex items-center justify-center">
            <span className="text-center text-[9px] font-black uppercase tracking-wide text-gray-200 leading-tight line-clamp-2 px-1">
                {product.short_name || product.name}
            </span>
            <span className="text-[10px] font-bold text-indigo-300 mt-0.5">{currency}{product.price.toFixed(2)}</span>
        </div>
        {product.is_enabled === false && (
            <div className="absolute top-1 right-1 bg-red-500 text-white text-[7px] font-bold px-1 py-0.5 rounded shadow uppercase tracking-wider">Agotado</div>
        )}
    </div>
);

interface MenuPreviewProps {
    onClose?: () => void;
}

export const MenuPreview: React.FC<MenuPreviewProps> = ({ onClose }) => {
    const [categories, setCategories] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [selectedCat, setSelectedCat] = useState<any | null>(null);
    const [selectedSubCat, setSelectedSubCat] = useState<any | null>(null);

    const currency = 'Q';

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [catRes, prodRes, branchRes] = await Promise.all([
                supabase.from('menu_categories').select('*').order('nombre', { ascending: true }),
                supabase.from('products').select('*').eq('es_platillo', true).eq('is_enabled', true).order('name', { ascending: true }),
                supabase.from('branches').select('*').order('name')
            ]);

            setCategories(catRes.data || []);
            setProducts(prodRes.data || []);
            setBranches(branchRes.data || []);
            if (branchRes.data?.length) setSelectedBranch(branchRes.data[0].id);
            setLoading(false);
        };
        fetchData();
    }, []);

    return (
        <DraggableWindow>
            <div className="bg-white border border-[#106ebe] shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full flex flex-col overflow-hidden animate-fade-in rounded-sm">
                {/* Title Bar - Classic Windows Style */}
                <div className="bg-[#106ebe] h-8 px-3 flex justify-between items-center text-white shrink-0 modal-header cursor-move select-none">
                    <div className="flex items-center gap-2">
                        <Monitor size={14} className="text-white fill-white/20" />
                        <h4 className="text-[10px] font-bold uppercase tracking-widest">Vista Previa de Menú</h4>
                    </div>
                    <div className="flex items-center">
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Control Bar */}
                <div className="bg-[#f0f2f5] border-b border-gray-300 p-2 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Sucursal</span>
                            <div className="relative">
                                <select
                                    value={selectedBranch}
                                    onChange={e => setSelectedBranch(e.target.value)}
                                    className="bg-white border border-gray-300 rounded px-2 py-1 text-[10px] font-bold text-slate-700 outline-none focus:border-[#106ebe] min-w-[280px] appearance-none cursor-pointer pr-8"
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Sub-Header Area */}
                <div className="bg-[#eaeff5] px-4 py-2 border-b border-[#c5cdd9]">
                    <div className="flex items-center gap-2">
                        <Layers size={14} className="text-[#106ebe]" />
                        <h5 className="text-[11px] font-black text-[#106ebe] uppercase tracking-wider">Detalle de Menú</h5>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-white flex flex-col min-h-[500px] max-h-[70vh] overflow-y-auto custom-scrollbar p-6">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20">
                            <Loader2 size={32} className="text-[#106ebe] animate-spin mb-4" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cargando Menú...</span>
                        </div>
                    ) : (
                        <div className="max-w-5xl mx-auto w-full">
                            {/* Breadcrumb if navigating */}
                            {(selectedCat || selectedSubCat) && (
                                <button
                                    onClick={() => selectedSubCat ? setSelectedSubCat(null) : setSelectedCat(null)}
                                    className="mb-6 flex items-center gap-2 text-[10px] font-black text-[#106ebe] uppercase hover:underline transition-all"
                                >
                                    <ChevronLeft size={16} /> Regresar a Categorías
                                </button>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {!selectedCat && categories.filter(c => !c.parent_id).map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCat(cat)}
                                        className="group relative aspect-square bg-[#2b2f3a] rounded-lg p-3 flex flex-col items-center justify-between border-2 border-transparent hover:border-[#106ebe] transition-all shadow-md overflow-hidden"
                                    >
                                        <div className="flex-1 flex flex-col items-center justify-center w-full mb-2 p-5 overflow-hidden">
                                            {cat.imagen_url ? (
                                                <img 
                                                    src={cat.imagen_url} 
                                                    alt={cat.nombre} 
                                                    className="max-w-full max-h-full object-contain rounded-md opacity-90 group-hover:scale-110 transition-transform duration-500" 
                                                />
                                            ) : (
                                                <PlaceholderLogo />
                                            )}
                                        </div>
                                        <span className="w-full text-center text-[10px] font-black uppercase tracking-widest text-white leading-tight pb-1 truncate">{cat.nombre}</span>
                                    </button>
                                ))}

                                {selectedCat && !selectedSubCat && (
                                    <>
                                        {categories.filter(c => c.parent_id === selectedCat.id).map(sub => (
                                            <button
                                                key={sub.id}
                                                onClick={() => setSelectedSubCat(sub)}
                                                className="group relative aspect-square bg-[#2b2f3a] rounded-lg p-3 flex flex-col items-center justify-between border-2 border-transparent hover:border-[#106ebe] transition-all shadow-md overflow-hidden"
                                            >
                                                <div className="flex-1 flex flex-col items-center justify-center w-full mb-2 p-5 overflow-hidden">
                                                    {sub.imagen_url ? (
                                                        <img 
                                                            src={sub.imagen_url} 
                                                            alt={sub.nombre} 
                                                            className="max-w-full max-h-full object-contain rounded-md opacity-90 group-hover:scale-110 transition-transform duration-500" 
                                                        />
                                                    ) : (
                                                        <PlaceholderLogo />
                                                    )}
                                                </div>
                                                <span className="w-full text-center text-[10px] font-black uppercase tracking-widest text-white leading-tight pb-1 truncate">{sub.nombre}</span>
                                            </button>
                                        ))}
                                        {categories.filter(c => c.parent_id === selectedCat.id).length === 0 && (
                                            products.filter(p => p.menu_category_id === selectedCat.id).map(p => (
                                                <ProductCard key={p.id} product={p} currency={currency} />
                                            ))
                                        )}
                                    </>
                                )}

                                {selectedSubCat && products.filter(p => p.menu_category_id === selectedSubCat.id).map(p => (
                                    <ProductCard key={p.id} product={p} currency={currency} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Status Bar */}
                <div className="bg-[#f0f2f5] border-t border-gray-300 px-4 py-1.5 flex justify-between items-center shrink-0">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Restaurante Las Palmas POS - Plataforma de Gestión de Menú</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{categories.length} Categorías | {products.length} Platillos</span>
                </div>
            </div>
        </DraggableWindow>
    );
};
