import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import {
    Layers,
    Play,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
    X,
    BookOpen,
    ChefHat,
    ClipboardList
} from 'lucide-react';

interface Product {
    id: string;
    nombre: string;
    descripcion: string;
    codigo?: string;
    categoria: string;
    precio_costo?: number;
    precio_venta?: number;
    classification?: string;
    recipe_no?: string;
    portions?: number;
    portion_size?: string;
    serving_temp?: string;
    prep_time?: number;
    prepared_by?: string;
    prep_procedure?: string;
    observations?: string;
}

interface Chef {
    id: string;
    nombre: string;
    branch_id?: string;
}

interface Ingrediente {
    cantidad: number;
    unidad: string;
    ingrediente_nombre: string;
    costo_unitario?: number;
}

interface Receta {
    id: string;
    instrucciones?: string;
    porciones?: number;
    tiempo_preparacion?: number;
    receta_ingredientes: Ingrediente[];
    ficha?: {
        classification?: string;
        recipe_no?: string;
        portion_size?: string;
        serving_temp?: string;
        prepared_by?: string;
        observations?: string;
    };
}

interface ActiveProduction {
    instanceId: string;
    product: Product;
    chef: Chef;
    startTime: Date;
    endTime?: Date;
    timerSec: number;
    isCompleted: boolean;
    logs: { time: string; msg: string }[];
    receta?: Receta | null;
}

interface ModuloProduccionProps {
    sucursalId: string;
    onExit: () => void;
}

type ScreenState = 'LIST' | 'PIN' | 'ACTIVE';

export const ModuloProduccion: React.FC<ModuloProduccionProps> = ({ sucursalId, onExit }) => {
    const [view, setView] = useState<ScreenState>(() => (localStorage.getItem('pos_prod_view') as ScreenState) || 'LIST');
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('es-GT'));
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Multi-Production States
    const [activeProductions, setActiveProductions] = useState<ActiveProduction[]>(() => {
        const saved = localStorage.getItem('pos_active_productions');
        if (saved) {
            try {
                return JSON.parse(saved).map((p: any) => ({
                    ...p,
                    startTime: new Date(p.startTime),
                    endTime: p.endTime ? new Date(p.endTime) : undefined
                }));
            } catch (e) { return []; }
        }
        return [];
    });
    const [currentIdx, setCurrentIdx] = useState<number>(() => {
        const saved = localStorage.getItem('pos_prod_current_idx');
        return saved ? parseInt(saved) : -1;
    });

    // Persistence
    useEffect(() => {
        localStorage.setItem('pos_active_productions', JSON.stringify(activeProductions));
    }, [activeProductions]);

    useEffect(() => {
        localStorage.setItem('pos_prod_view', view);
    }, [view]);

    useEffect(() => {
        localStorage.setItem('pos_prod_current_idx', currentIdx.toString());
    }, [currentIdx]);

    // Screen 2 States (Starting new)
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState(false);

    // States derived from currentIdx for the ACTIVE screen
    const currentProd = currentIdx >= 0 ? activeProductions[currentIdx] : null;
    const receta = currentProd?.receta || null;
    const [loadingReceta, setLoadingReceta] = useState(false);
    const [recetaNotFound, setRecetaNotFound] = useState(false);

    // Real-time clock
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('es-GT'));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Background Timers for all active productions (Resilient to clock drifts/F5)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            setActiveProductions(prev => prev.map(p => {
                if (p.isCompleted) return p;
                const elapsedSinceStart = Math.floor((now.getTime() - p.startTime.getTime()) / 1000);
                // Usamos el mayor entre el actual y el calculado para evitar saltos raros si el reloj cambia
                return { ...p, timerSec: Math.max(p.timerSec, elapsedSinceStart) };
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Fetch products on mount
    useEffect(() => {
        fetchProducts();
    }, []);

    // Fetch receta when a NEW production is selected and doesn't have one
    useEffect(() => {
        if (view === 'ACTIVE' && currentProd && !currentProd.receta && !loadingReceta && currentProd.product?.id) {
            fetchReceta(currentProd.product.id);
        }
    }, [view, currentProd]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const cachedProductsStr = localStorage.getItem('cached_products');
            const cachedCategoriesStr = localStorage.getItem('cached_categories');

            let allAvailable: Product[] = [];

            // 1. Intentar desde Cache (Super Rápido)
            if (cachedProductsStr && cachedCategoriesStr) {
                try {
                    const pcats = JSON.parse(cachedCategoriesStr);
                    const prodCats = pcats.filter((c: any) => {
                        const n = (c.nombre || c.name || '').toUpperCase();
                        return n.includes('PRODUC');
                    });

                    if (prodCats.length > 0) {
                        const catIds = prodCats.map((c: any) => c.id);
                        const prods = JSON.parse(cachedProductsStr);
                        const filtered = prods.filter((p: any) =>
                            p.is_enabled && (
                                catIds.includes(p.category_id) || 
                                catIds.includes(p.menu_category_id) || 
                                catIds.includes(p.product_category_id)
                            )
                        );
                        allAvailable = filtered.map((p: any) => ({
                            id: p.id,
                            nombre: p.name || p.nombre || 'Sin nombre',
                            descripcion: p.description || '',
                            categoria: 'PRODUCCION',
                            precio_venta: p.price
                        }));
                    }
                } catch (e) { console.warn('Cache parse error', e); }
            }

            // 2. Si no hay cache o está vacío, consultar DB de forma consolidada
            if (allAvailable.length === 0) {
                const searchStrings = ['PRODUCCION', 'PRODUCCIÓN'];
                const [menuRes, prodRes, oldRes] = await Promise.all([
                    supabase.from('menu_categories').select('id').in('nombre', searchStrings),
                    supabase.from('product_categories').select('id').in('nombre', searchStrings),
                    supabase.from('categories').select('id').in('name', searchStrings)
                ]);

                const catIds = [
                    ...(menuRes.data || []).map(c => c.id),
                    ...(prodRes.data || []).map(c => c.id),
                    ...(oldRes.data || []).map(c => c.id)
                ];

                if (catIds.length > 0) {
                    const { data: prods } = await supabase
                        .from('products')
                        .select('id, name, description, price, is_enabled')
                        .or(`category_id.in.(${catIds.join(',')}),menu_category_id.in.(${catIds.join(',')}),product_category_id.in.(${catIds.join(',')})`)
                        .eq('is_enabled', true);

                    if (prods) {
                        allAvailable = prods.map((p: any) => ({
                            id: p.id,
                            nombre: p.name,
                            descripcion: p.description || '',
                            categoria: 'PRODUCCION',
                            precio_venta: p.price
                        }));
                    }
                }

                // Fallback por clasificación
                if (allAvailable.length === 0) {
                    const { data: prodsClass } = await supabase
                        .from('products')
                        .select('id, name, description, price, is_enabled')
                        .ilike('classification', 'PRODUCCION')
                        .eq('is_enabled', true);

                    if (prodsClass) {
                        allAvailable = prodsClass.map((p: any) => ({
                            id: p.id,
                            nombre: p.name,
                            descripcion: p.description || '',
                            categoria: 'PRODUCCION',
                            precio_venta: p.price
                        }));
                    }
                }
            }

            setProducts(allAvailable);
        } catch (e: any) {
            console.error('[Produccion] Fallo en fetchProducts:', e);
            setError('Error al cargar la lista de producción');
        } finally {
            setLoading(false);
        }
    };

    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString('es-GT');
        setActiveProductions(prev => prev.map((p, idx) => 
            idx === currentIdx ? { ...p, logs: [{ time, msg }, ...p.logs] } : p
        ));
    };

    const fetchReceta = async (platilloId: string) => {
        setLoadingReceta(true);
        setRecetaNotFound(false);
        try {
            let prodData: any = null;
            
            // 1. Intentar carga completa
            const { data, error } = await supabase
                .from('products')
                .select('prep_procedure, portions, prep_time, classification, recipe_no, portion_size, serving_temp, prepared_by, observations, name')
                .eq('id', platilloId)
                .maybeSingle();

            if (error) {
                if (error.code === '42703') {
                    console.warn('[Produccion] Columnas extendidas no encontradas, modo básico.');
                    const { data: basic } = await supabase.from('products').select('id, name').eq('id', platilloId).maybeSingle();
                    prodData = basic;
                } else {
                    throw error;
                }
            } else {
                prodData = data;
            }

            // 2. Ingredientes
            const { data: rawIngredients } = await supabase
                .from('product_recipes')
                .select('quantity, unit_measure, inventory_item_id')
                .eq('product_id', platilloId);

            let finalIngredients: any[] = [];
            if (rawIngredients && rawIngredients.length > 0) {
                const itemIds = rawIngredients.map(r => r.inventory_item_id).filter(Boolean);
                const { data: itemsDetail } = await supabase.from('products').select('id, name').in('id', itemIds);

                finalIngredients = rawIngredients.map(r => {
                    const detail = itemsDetail?.find(d => d.id === r.inventory_item_id);
                    return {
                        cantidad: r.quantity,
                        unidad: r.unit_measure,
                        ingrediente_nombre: detail?.name || 'Insumo desconocido',
                        costo_unitario: 0
                    };
                });
            }

            if (!prodData && finalIngredients.length === 0) {
                setRecetaNotFound(true);
                return;
            }

            const loadedReceta: Receta = {
                id: platilloId,
                instrucciones: prodData?.prep_procedure || '',
                porciones: prodData?.portions || 1,
                tiempo_preparacion: prodData?.prep_time || 0,
                receta_ingredientes: finalIngredients,
                ficha: {
                    classification: prodData?.classification,
                    recipe_no: prodData?.recipe_no,
                    portion_size: prodData?.portion_size,
                    serving_temp: prodData?.serving_temp,
                    prepared_by: prodData?.prepared_by,
                    observations: prodData?.observations
                }
            };

            setActiveProductions(prev => prev.map((p, idx) => 
                idx === currentIdx ? { ...p, receta: loadedReceta } : p
            ));

        } catch (e: any) {
            console.error('[Produccion] Error blindado en fetchReceta:', e);
            setRecetaNotFound(true);
        } finally {
            setLoadingReceta(false);
        }
    };

    const handlePinInput = (num: string) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
        }
    };

    const handlePinDelete = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const validatePin = async () => {
        if (pin.length < 4) return;
        setLoading(true);
        setPinError(false);
        try {
            const { data: chefData, error } = await supabase
                .from('profiles')
                .select('id, name, pin, role, branch_id')
                .eq('pin', pin)
                .ilike('role', 'COCINA')
                .maybeSingle();

            if (error || !chefData) {
                setPinError(true);
                setPin('');
                return;
            }

            const newProd: ActiveProduction = {
                instanceId: Math.random().toString(36).substr(2, 9),
                product: selectedProduct!,
                chef: { id: chefData.id, nombre: chefData.name, branch_id: chefData.branch_id },
                startTime: new Date(),
                timerSec: 0,
                isCompleted: false,
                logs: [{ time: new Date().toLocaleTimeString('es-GT'), msg: `Sesión iniciada por ${chefData.name}` }]
            };
            setActiveProductions(prev => [newProd, ...prev]);
            setCurrentIdx(0);
            setView('ACTIVE');
            setSelectedProduct(null);
            setPin('');
        } catch (e) {
            setPinError(true);
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const guardarRegistro = async (pIdx: number) => {
        const p = activeProductions[pIdx];
        if (!p) return;
        try {
            const { error: insertError } = await supabase.from('rendimiento_cocina').insert({
                platillo_id: p.product.id,
                platillo_nombre: p.product.nombre,
                categoria: 'PRODUCCION',
                usuario_id: p.chef.id,
                usuario_nombre: p.chef.nombre,
                tiempo_inicio: p.startTime.toISOString(),
                tiempo_fin: p.endTime?.toISOString() || new Date().toISOString(),
                duracion_segundos: p.timerSec,
                sucursal_id: p.chef.branch_id || sucursalId,
                fecha: new Date().toISOString()
            });

            if (!insertError) {
                addLog('✓ Registro guardado en rendimiento de cocina');
            }
        } catch (e: any) {
            console.error('[Produccion] Error guardando rendimiento:', e);
        }
    };

    const finalizarProduccion = async () => {
        if (!currentProd || currentProd.isCompleted) return;
        const end = new Date();
        const logs = [{ time: end.toLocaleTimeString('es-GT'), msg: 'Producción completada' }, ...currentProd.logs];
        
        setActiveProductions(prev => prev.map((p, idx) => 
            idx === currentIdx ? { ...p, isCompleted: true, endTime: end, logs } : p
        ));
        
        // Guardar en DB
        await guardarRegistro(currentIdx);
    };

    const formatSeconds = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // ─── PANTALLA 1: Lista de producciones ───────────────────────────────────
    const renderList = () => (
        <div className="flex-1 flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto w-full pt-4">
                {/* Cabecera simplificada sin repetir 'Producción' */}

                {/* --- SECCIÓN: PRODUCCIONES ACTIVAS --- */}
                {activeProductions.some(p => !p.isCompleted) && (
                    <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="flex items-center gap-3 mb-6">
                            <Clock size={16} className="text-emerald-500" />
                            <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Producciones en Curso</h2>
                        </div>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
                            {activeProductions.map((p, idx) => !p.isCompleted && (
                                <div 
                                    key={p.instanceId}
                                    onClick={() => {
                                        setCurrentIdx(idx);
                                        setView('ACTIVE');
                                    }}
                                    className="bg-[#0d1117] rounded-2xl border-2 border-emerald-500/20 hover:border-emerald-500 p-5 cursor-pointer transition-all hover:scale-[1.02] shadow-xl group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 h-full w-1 bg-emerald-500"></div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">{p.chef.nombre}</span>
                                            <h3 className="text-white font-black text-lg leading-tight">{p.product.nombre}</h3>
                                        </div>
                                        <div className="text-2xl font-black tabular-nums text-white bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                                            {formatSeconds(p.timerSec)}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] font-bold text-[#7a8499] uppercase">
                                        <span>Iniciado: {p.startTime.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="text-emerald-500 animate-pulse flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                            En curso
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- SECCIÓN: NUEVA PRODUCCIÓN --- */}
                <div className="flex items-center gap-3 mb-6">
                    <Play size={16} className="text-[#106EBE]" />
                    <h2 className="text-[10px] font-black text-[#106EBE] uppercase tracking-[0.4em]">Nueva Producción</h2>
                </div>

                {loading && !products.length ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-[#106EBE] animate-spin" />
                </div>
            ) : products.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[#7a8499] bg-[#141922] rounded-3xl border border-[#106EBE33]">
                    <Layers className="w-16 h-16 mb-4 opacity-20" />
                    <p className="font-bold uppercase tracking-widest">No hay platillos de producción configurados</p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
                    {products.map(product => (
                        <div
                            key={product.id}
                            className="bg-[#141922] rounded-xl border border-[#106EBE33] border-t-[3px] border-t-[#106EBE] p-6 flex flex-col hover:-translate-y-1 hover:border-[#106EBE] transition-all group relative overflow-hidden"
                        >
                            <h3 className="text-white font-bold text-xl mb-1 leading-tight">{product.nombre}</h3>
                            <p className="text-[#7a8499] text-sm mb-6 flex-1 line-clamp-2">{product.descripcion}</p>

                            <div className="flex items-center justify-end mt-auto">
                                <button
                                    onClick={() => {
                                        setSelectedProduct(product);
                                        setView('PIN');
                                    }}
                                    className="bg-[#106EBE] text-white font-black text-xs uppercase px-6 py-3 rounded-lg hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <Play size={14} fill="white" />
                                    INICIAR
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </div>
        </div>
    );

    // ─── PANTALLA 2: Ingreso de PIN ───────────────────────────────────────────
    const renderPin = () => (
        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-full max-w-sm bg-[#141922] border border-[#106EBE33] rounded-[32px] p-8 shadow-2xl relative">
                <div className="text-center mb-10">
                    <h3 className="text-[18px] font-black text-white uppercase mb-2">{selectedProduct?.nombre}</h3>
                    <p className="text-[10px] font-bold text-[#7a8499] uppercase tracking-[0.2em]">INGRESA TU PIN DE COCINERO</p>
                </div>

                <div className="flex gap-4 justify-center mb-10">
                    {[...Array(4)].map((_, i) => (
                        <div
                            key={i}
                            className={`w-4 h-4 rounded-full border-2 border-[#106EBE] transition-all duration-300 ${pin.length > i ? 'bg-[#106EBE] shadow-[0_0_15px_#106EBE]' : 'bg-transparent opacity-30'}`}
                        />
                    ))}
                </div>

                {pinError && (
                    <div className="mb-6 flex items-center justify-center gap-2 text-[#e24b4a] font-black text-[10px] uppercase animate-shake">
                        <AlertCircle size={14} />
                        PIN INCORRECTO
                    </div>
                )}

                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <button
                            key={n}
                            onClick={() => handlePinInput(n.toString())}
                            className="h-12 bg-[#141922] hover:bg-[#106EBE33] border border-[#106EBE33] rounded-[10px] text-xl font-black text-white transition-all active:scale-90"
                        >
                            {n}
                        </button>
                    ))}
                    <div />
                    <button
                        onClick={() => handlePinInput('0')}
                        className="h-12 bg-[#141922] hover:bg-[#106EBE33] border border-[#106EBE33] rounded-[10px] text-xl font-black text-white transition-all active:scale-90"
                    >
                        0
                    </button>
                    <button
                        onClick={handlePinDelete}
                        className="h-12 bg-[#141922] hover:bg-red-500/20 border border-red-500/20 rounded-[10px] text-[#e24b4a] flex items-center justify-center transition-all active:scale-90"
                    >
                        <X size={24} />
                    </button>
                    <button
                        onClick={validatePin}
                        disabled={loading || pin.length < 4}
                        className="col-span-3 h-12 bg-[#106EBE] hover:bg-blue-600 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-[10px] transition-all active:scale-95 shadow-lg shadow-blue-950/20"
                    >
                        {loading ? <Loader2 className="animate-spin mx-auto" /> : 'ENTRAR'}
                    </button>
                </div>

                <button
                    onClick={() => {
                        setView('LIST');
                        setPin('');
                        setPinError(false);
                    }}
                    className="w-full text-center text-[#7a8499] font-bold text-xs uppercase hover:text-white transition-colors"
                >
                    ← Volver a producciones
                </button>
            </div>
        </div>
    );

    const renderActive = () => {
        if (!currentProd) return null;

        return (
            <div className="flex-1 flex flex-col px-12 py-6 gap-6 overflow-y-auto animate-in fade-in duration-500 custom-scrollbar bg-[#0a0c10]">
                
                {/* INTERFAZ ULTRA-EXPANDIDA (MAX-W 1800PX - ALINEADA A LA IZQUIERDA CON GRAN DISTANCIA) */}
                <div className="flex flex-col lg:flex-row gap-24 items-start max-w-[1800px] w-full">
                    
                    {/* COLUMNA DE CONTROL ULTRA-ANCHA (650PX PARA EVITAR DOBLE LÍNEA) */}
                    <div className="w-full lg:w-[650px] shrink-0 flex flex-col gap-8">
                        
                        {/* CRONÓMETRO MINI-PANEL */}
                        <div className="bg-[#141922] rounded-2xl p-5 border border-white/5 flex flex-col items-center">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 opacity-60">Tiempo de Producción</span>
                            <div className={`text-4xl font-black tabular-nums tracking-tighter ${currentProd?.isCompleted ? 'text-[#0cf192]' : 'text-white'}`}>
                                {formatSeconds(currentProd?.timerSec || 0)}
                            </div>

                            <div className="mt-4 w-full">
                                {currentProd?.isCompleted ? (
                                    <div className="w-full h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-[#0cf192] font-black text-[10px] uppercase tracking-widest">
                                        <CheckCircle2 size={16} />
                                        <span>Procesado</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={finalizarProduccion}
                                        className="w-full h-10 bg-[#0cf1921a] hover:bg-[#0cf192] border border-[#0cf19222] hover:border-transparent text-[#0cf192] hover:text-black rounded-xl transition-all font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 size={16} />
                                        <span>Finalizar Tiempo</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* TABLA DE INSUMOS (SIN SALTOS DE LÍNEA) */}
                        <div className="bg-[#141922] rounded-3xl border border-white/5 overflow-hidden flex flex-col shadow-2xl">
                            <div className="bg-white/5 p-6 border-b border-white/5 flex items-center gap-4">
                                <ClipboardList size={22} className="text-[#106EBE]" />
                                <span className="text-[12px] font-black text-white uppercase tracking-[0.3em]">Lista General de Insumos</span>
                            </div>
                            
                            <div className="p-4">
                                {receta?.receta_ingredientes?.length > 0 ? (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-slate-500 text-[10px] uppercase font-black border-b border-white/5">
                                                <th className="p-4 pl-6">Artículo / Especificación Técnica</th>
                                                <th className="p-4 text-right">Cantidad</th>
                                                <th className="p-4 pr-6 text-right">U.M.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-[13px] font-bold text-white/90">
                                            {receta.receta_ingredientes.map((ing, i) => (
                                                <tr key={i} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors group">
                                                    <td className="p-4 pl-6 font-black uppercase whitespace-nowrap leading-relaxed">{ing.ingrediente_nombre}</td>
                                                    <td className="p-4 text-right text-[#0cf192] font-black tabular-nums text-lg">{ing.cantidad}</td>
                                                    <td className="p-4 pr-6 text-right text-slate-600 uppercase text-[10px] font-black">{ing.unidad}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-12 text-center text-slate-700 text-[11px] uppercase font-black tracking-[0.4em] opacity-40">
                                        No se registran insumos
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BOTÓN DE SALIDA (SIEMPRE VISIBLE EN LA COLUMNA DE CONTROL) */}
                        <button 
                            onClick={() => setView('LIST')} 
                            className="mt-4 self-center text-slate-600 hover:text-white font-black text-[12px] uppercase tracking-[0.4em] transition-all py-3 px-8 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 w-full text-center"
                        >
                            ← SALIR DEL MÓDULO
                        </button>

                    </div>

                    {/* COLUMNA DE FICHA (ESPACIOSA) */}
                    <div className="flex-1 flex flex-col gap-6 w-full">
                        
                        {/* CONTENEDOR PRINCIPAL DE FICHA (PLANO) */}
                        <div className="bg-[#141922] rounded-3xl border border-white/5 overflow-hidden flex flex-col">
                            
                            <div className="p-8">
                                
                                {/* ENCABEZADO FORMAL */}
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-6 border-b border-white/5">
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-white font-black text-2xl border border-white/10 shrink-0">
                                            {currentProd?.product?.nombre?.charAt(0) || 'P'}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-[#106EBE] uppercase tracking-[0.3em] block mb-1">Ficha Técnica Operativa</span>
                                            <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-tight mb-2">{currentProd?.product?.nombre || '---'}</h2>
                                            <div className="flex items-center gap-4 text-slate-400 font-bold text-[11px]">
                                                <span className="uppercase">Chef: {currentProd?.chef?.nombre}</span>
                                                <div className="w-1 h-1 bg-white/10 rounded-full"></div>
                                                <span className="uppercase">Referencia: {receta?.ficha?.recipe_no || '00'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5 text-right min-w-[140px]">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Tiempo Estándar</span>
                                        <span className="text-xl font-black text-white">{receta?.tiempo_preparacion || '0'} <span className="text-sm font-bold text-slate-500">MIN</span></span>
                                    </div>
                                </div>

                                {/* GRILLA DETONALIZADA (CENTRADOS) */}
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
                                    {[
                                        { label: 'Clasificación', val: receta?.ficha?.classification },
                                        { label: 'No. Receta', val: receta?.ficha?.recipe_no },
                                        { label: 'Porciones', val: receta?.porciones },
                                        { label: 'Tamaño', val: receta?.ficha?.portion_size },
                                        { label: 'Temperatura', val: receta?.ficha?.serving_temp }
                                    ].map((spec, i) => (
                                        <div key={i} className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col items-center text-center">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1 tracking-widest w-full">{spec.label}</span>
                                            <span className="text-[11px] font-bold uppercase text-white truncate block w-full">{spec.val || '---'}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* ÁREA DE PROCEDIMIENTO (LIMPIA) */}
                                <div className="mb-8">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-[11px] font-black text-white uppercase tracking-widest border-b-2 border-[#106EBE] pb-1">Procedimiento de Elaboración</span>
                                    </div>
                                    <div className="bg-black/20 p-6 rounded-2xl border border-white/5 text-[14px] font-normal leading-relaxed text-slate-300 whitespace-pre-line min-h-[200px] max-h-[350px] overflow-y-auto custom-scrollbar">
                                        {receta?.instrucciones || "No se han cargado instrucciones técnicas."}
                                    </div>
                                </div>

                                {/* PIE DE FICHA SÓLIDO */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 mt-4 border-t border-white/5">
                                    <div className="bg-white/5 p-4 rounded-xl text-[11px] text-slate-400 font-medium">
                                        <span className="text-[9px] font-bold text-[#106EBE] uppercase block mb-1">Observaciones:</span>
                                        {receta?.ficha?.observations || "Sin notas técnicas adicionales."}
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl flex items-center justify-between">
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Autorizado por:</span>
                                            <span className="text-[11px] font-black text-white uppercase">{receta?.ficha?.prepared_by || currentProd?.chef?.nombre}</span>
                                        </div>
                                        <div className="text-[10px] font-mono text-slate-600">ID: {currentProd?.instanceId?.slice(0,8) || '---'}</div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* BITÁCORA DE EVENTOS (PLANA) */}
                        <div className="bg-[#141922] rounded-2xl p-4 border border-white/5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4">Registro de Jornada</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 max-h-[60px] overflow-y-auto custom-scrollbar">
                                {currentProd?.logs?.map((log, i) => (
                                    <div key={i} className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                                        <span className="text-slate-600 font-mono">[{log.time}]</span>
                                        <span className="truncate">{log.msg}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        );
    };

    // ─── SHELL ───────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[999] bg-[#1a1f2e] text-[#e8eaf0] flex flex-col font-sans select-none overflow-hidden">
            {/* Header */}
            <header className="bg-[#0d1117] h-14 border-b border-[#106EBE33] flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#106EBE] rounded-full flex items-center justify-center p-2 shadow-inner">
                        <Layers className="text-white" size={18} />
                    </div>
                    <span className="text-[11px] font-black tracking-[0.3em] text-[#106EBE] uppercase">Módulo de Producción</span>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-[#7a8499]">
                        <Clock size={16} />
                        <span className="text-sm font-black tabular-nums">{currentTime}</span>
                    </div>
                    <button
                        onClick={onExit}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/20 text-[#7a8499] hover:text-red-500 flex items-center justify-center transition-all active:scale-95"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col overflow-hidden">
                {error && (
                    <div className="m-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between text-[#e24b4a]">
                        <div className="flex items-center gap-3">
                            <AlertCircle size={20} />
                            <span className="text-xs font-bold uppercase tracking-widest">{error}</span>
                        </div>
                        <button onClick={() => setError(null)} className="hover:text-white"><X size={18} /></button>
                    </div>
                )}

                {view === 'LIST' && renderList()}
                {view === 'PIN' && renderPin()}
                {view === 'ACTIVE' && renderActive()}
            </main>

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #106EBE33; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #106EBE; }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake { animation: shake 0.2s ease-in-out infinite; animation-iteration-count: 2; }
            `}} />
        </div>
    );
};

const LogOut = ({ size, className }: { size: number, className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
);

export default ModuloProduccion;
