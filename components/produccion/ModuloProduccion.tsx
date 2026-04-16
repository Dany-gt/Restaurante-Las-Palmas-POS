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
}

interface ModuloProduccionProps {
    sucursalId: string;
    onExit: () => void;
}

type ScreenState = 'LIST' | 'PIN' | 'ACTIVE';

export const ModuloProduccion: React.FC<ModuloProduccionProps> = ({ sucursalId, onExit }) => {
    const [view, setView] = useState<ScreenState>('LIST');
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('es-GT'));
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Screen 2 States
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState(false);

    // Screen 3 States
    const [currentChef, setCurrentChef] = useState<Chef | null>(null);
    const [timerSec, setTimerSec] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const [timerCompleted, setTimerCompleted] = useState(false);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [endTime, setEndTime] = useState<Date | null>(null);
    const [sessionLog, setSessionLog] = useState<{ time: string, msg: string }[]>([]);

    // Receta States
    const [receta, setReceta] = useState<Receta | null>(null);
    const [loadingReceta, setLoadingReceta] = useState(false);
    const [recetaNotFound, setRecetaNotFound] = useState(false);

    // Real-time clock
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('es-GT'));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Timer logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (timerActive) {
            interval = setInterval(() => {
                setTimerSec(s => s + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerActive]);

    // Fetch products on mount
    useEffect(() => {
        fetchProducts();
    }, []);

    // Fetch receta when entering ACTIVE view
    useEffect(() => {
        if (view === 'ACTIVE' && selectedProduct) {
            fetchReceta(selectedProduct.id);
        }
    }, [view, selectedProduct]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const cachedProductsStr = localStorage.getItem('cached_products');
            const cachedCategoriesStr = localStorage.getItem('cached_categories');

            let allAvailable: any[] = [];

            if (cachedProductsStr && cachedCategoriesStr) {
                const pcats = JSON.parse(cachedCategoriesStr);
                const prodCat = pcats.find((c: any) =>
                    c.name?.toUpperCase() === 'PRODUCCION' || c.nombre?.toUpperCase() === 'PRODUCCION'
                );

                if (prodCat) {
                    const prods = JSON.parse(cachedProductsStr);
                    const filtered = prods.filter((p: any) =>
                        p.is_enabled && p.category_id === prodCat.id
                    );
                    allAvailable = filtered.map((p: any) => ({
                        id: p.id,
                        nombre: p.name || p.nombre,
                        descripcion: p.description || p.descripcion || '',
                        categoria: 'PRODUCCION',
                        precio_venta: p.price || p.precio_venta
                    }));
                }
            }

            if (allAvailable.length === 0) {
                const { data: cats } = await supabase
                    .from('categories')
                    .select('id, name')
                    .ilike('name', 'PRODUCCION')
                    .limit(5);

                if (cats && cats.length > 0) {
                    const catIds = cats.map((c: any) => c.id);
                    const { data: prods } = await supabase
                        .from('products')
                        .select('id, name, description, category_id, price, is_enabled')
                        .in('category_id', catIds)
                        .eq('is_enabled', true);

                    if (prods && prods.length > 0) {
                        allAvailable = prods.map((p: any) => ({
                            id: p.id,
                            nombre: p.name,
                            descripcion: p.description || '',
                            categoria: 'PRODUCCION',
                            precio_venta: p.price
                        }));
                    }
                }

                if (allAvailable.length === 0) {
                    const { data: prodsClass } = await supabase
                        .from('products')
                        .select('id, name, description, price, is_enabled')
                        .ilike('classification', 'PRODUCCION')
                        .eq('is_enabled', true);

                    if (prodsClass && prodsClass.length > 0) {
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
            console.error('Error fetching production products:', e);
            setError('Error al cargar producciones disponibles');
        } finally {
            setLoading(false);
        }
    };

    const fetchReceta = async (platilloId: string) => {
        setLoadingReceta(true);
        setReceta(null);
        setRecetaNotFound(false);
        try {
            const { data, error: recetaError } = await supabase
                .from('recetas')
                .select(`
                    id,
                    instrucciones,
                    porciones,
                    tiempo_preparacion,
                    receta_ingredientes (
                        cantidad,
                        unidad,
                        ingrediente_nombre,
                        costo_unitario
                    )
                `)
                .eq('platillo_id', platilloId)
                .maybeSingle();

            if (recetaError) {
                console.warn('[Produccion] Error buscando receta:', recetaError.message);
                setRecetaNotFound(true);
            } else if (!data) {
                setRecetaNotFound(true);
            } else {
                setReceta(data as Receta);
            }
        } catch (e) {
            console.warn('[Produccion] Receta no disponible:', e);
            setRecetaNotFound(true);
        } finally {
            setLoadingReceta(false);
        }
    };

    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString('es-GT');
        setSessionLog(prev => [{ time, msg }, ...prev]);
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
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, pin, role, branch_id')
                .eq('pin', pin)
                .ilike('role', 'COCINA')
                .maybeSingle();

            if (error || !data) {
                setPinError(true);
                setPin('');
                return;
            }

            setCurrentChef({ id: data.id, nombre: data.name, branch_id: data.branch_id });
            setView('ACTIVE');
            addLog(`Sesión iniciada por ${data.name}`);
        } catch (e) {
            setPinError(true);
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const iniciarProduccion = () => {
        if (timerActive || timerCompleted) return;
        const now = new Date();
        setStartTime(now);
        setTimerActive(true);
        addLog('Producción iniciada');
    };

    const guardarRegistro = async (end: Date, duracion: number) => {
        if (!selectedProduct || !currentChef || !startTime) return;
        try {
            // Usar el branch_id del cocinero autenticado, no el del admin
            const branchToSave = currentChef.branch_id || sucursalId;
            const { error: insertError } = await supabase
                .from('rendimiento_cocina')
                .insert({
                    platillo_id: selectedProduct.id,
                    platillo_nombre: selectedProduct.nombre,
                    categoria: 'PRODUCCION',
                    usuario_id: currentChef.id,
                    usuario_nombre: currentChef.nombre,
                    tiempo_inicio: startTime.toISOString(),
                    tiempo_fin: end.toISOString(),
                    duracion_segundos: duracion,
                    sucursal_id: branchToSave,
                    fecha: new Date().toISOString()
                });

            if (!insertError) {
                addLog('✓ Registro guardado en rendimiento de cocina');
            } else {
                addLog('✗ Error al guardar: ' + insertError.message);
                console.error('[Produccion] Error guardando rendimiento:', insertError);
            }
        } catch (e: any) {
            addLog('✗ Error inesperado al guardar');
            console.error('[Produccion] Error inesperado:', e);
        }
    };

    const finalizarProduccion = async () => {
        if (!timerActive || timerCompleted) return;
        const end = new Date();
        setTimerActive(false);
        setTimerCompleted(true);
        setEndTime(end);
        addLog('Producción completada');
        await guardarRegistro(end, timerSec);
    };

    const formatSeconds = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // ─── PANTALLA 1: Lista de producciones ───────────────────────────────────
    const renderList = () => (
        <div className="flex-1 flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-[10px] font-black text-[#106EBE] uppercase tracking-[0.4em] mb-1">Restaurante Las Palmas POS</h2>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter">PRODUCCIONES DISPONIBLES — CATEGORÍA PRODUCCION</h1>
                </div>
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
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[14px]">
                    {products.map(product => (
                        <div
                            key={product.id}
                            className="bg-[#141922] rounded-[12px] border border-[#106EBE33] border-t-[3px] border-t-[#106EBE] p-5 flex flex-col hover:-translate-y-1 hover:border-[#106EBE] transition-all group relative overflow-hidden"
                        >
                            <span className="absolute top-2 right-3 text-[8px] font-black bg-[#106EBE] text-white px-2 py-0.5 rounded-full">PRODUCCION</span>
                            <h3 className="text-white font-bold text-lg mb-1 leading-tight">{product.nombre}</h3>
                            <p className="text-[#7a8499] text-xs mb-6 flex-1 line-clamp-2">{product.descripcion}</p>

                            <div className="flex items-center justify-between mt-auto">
                                <span className="text-[10px] font-bold text-[#7a8499] uppercase">Rendimiento: 1x1</span>
                                <button
                                    onClick={() => {
                                        setSelectedProduct(product);
                                        setView('PIN');
                                    }}
                                    className="bg-[#106EBE] text-white font-black text-[11px] uppercase p-3 rounded-lg hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-2"
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
                            className="h-14 bg-[#141922] hover:bg-[#106EBE33] border border-[#106EBE33] rounded-[10px] text-xl font-black text-white transition-all active:scale-90"
                        >
                            {n}
                        </button>
                    ))}
                    <div />
                    <button
                        onClick={() => handlePinInput('0')}
                        className="h-14 bg-[#141922] hover:bg-[#106EBE33] border border-[#106EBE33] rounded-[10px] text-xl font-black text-white transition-all active:scale-90"
                    >
                        0
                    </button>
                    <button
                        onClick={handlePinDelete}
                        className="h-14 bg-[#141922] hover:bg-red-500/20 border border-red-500/20 rounded-[10px] text-[#e24b4a] flex items-center justify-center transition-all active:scale-90"
                    >
                        <X size={24} />
                    </button>
                    <button
                        onClick={validatePin}
                        disabled={loading || pin.length < 4}
                        className="col-span-3 h-14 bg-[#106EBE] hover:bg-blue-600 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-[10px] transition-all active:scale-95 shadow-lg shadow-blue-950/20"
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

    // ─── PANTALLA 3: Producción Activa ────────────────────────────────────────
    const renderActive = () => (
        <div className="flex-1 flex flex-col p-6 gap-5 overflow-y-auto animate-in fade-in duration-700 custom-scrollbar">

            {/* Header con nombre del platillo y chef */}
            <div className="bg-[#0d1117] rounded-2xl p-4 flex items-center justify-between border border-[#106EBE1a]">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#106EBE] rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-950/40">
                        {currentChef?.nombre.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-[17px] leading-tight">{selectedProduct?.nombre}</h3>
                        <p className="text-[#7a8499] text-[10px] font-bold uppercase tracking-widest">{currentChef?.nombre}</p>
                    </div>
                </div>

                <div className={`px-4 py-1.5 rounded-full border font-black text-[10px] uppercase tracking-widest ${
                    timerCompleted ? 'bg-[#4caf501a] border-[#4caf50] text-[#4caf50]' :
                    timerActive ? 'bg-[#106EBE1a] border-[#106EBE] text-[#106EBE] animate-pulse' :
                    'bg-[#7a84991a] border-[#7a8499] text-[#7a8499]'
                }`}>
                    {timerCompleted ? '✓ Completada' : timerActive ? 'En producción' : 'En espera'}
                </div>
            </div>

            {/* CRONÓMETRO — bloque único centrado */}
            <div className="bg-[#141922] rounded-3xl p-8 border border-[#106EBE33] flex flex-col items-center shadow-2xl relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1 transition-colors duration-500 ${timerCompleted ? 'bg-[#4caf50]' : timerActive ? 'bg-[#106EBE]' : 'bg-[#7a8499]'}`} />

                <span className="text-[#7a8499] font-bold text-[10px] uppercase tracking-[0.3em] mb-4">
                    TIEMPO DE PRODUCCIÓN
                </span>

                <div className={`text-[52px] font-black tabular-nums transition-colors duration-500 mb-8 ${
                    timerCompleted ? 'text-[#4caf50]' :
                    timerActive ? 'text-[#106EBE]' :
                    'text-white opacity-40'
                }`}>
                    {formatSeconds(timerSec)}
                </div>

                <div className="flex gap-4 w-full max-w-md">
                    {!timerActive && !timerCompleted && (
                        <button
                            onClick={iniciarProduccion}
                            className="flex-1 h-14 bg-[#106EBE] hover:bg-blue-600 rounded-xl text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-950/20"
                        >
                            <Play size={20} fill="white" />
                            INICIAR PRODUCCIÓN
                        </button>
                    )}
                    {timerActive && !timerCompleted && (
                        <button
                            onClick={finalizarProduccion}
                            className="flex-1 h-14 bg-[#4caf501a] hover:bg-[#4caf5033] border border-[#4caf50] rounded-xl text-[#4caf50] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95"
                        >
                            <CheckCircle2 size={20} />
                            FINALIZAR PRODUCCIÓN
                        </button>
                    )}
                    {timerCompleted && (
                        <div className="flex-1 h-14 bg-[#4caf501a] border border-[#4caf50] rounded-xl text-[#4caf50] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 opacity-60 cursor-not-allowed">
                            <CheckCircle2 size={20} />
                            PRODUCCIÓN COMPLETADA
                        </div>
                    )}
                </div>
            </div>

            {/* RECETA DEL PLATILLO */}
            <div className="bg-[#0d1117] rounded-[12px] border border-[#106EBE22] overflow-hidden">
                {/* Header receta */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-[#106EBE22]">
                    <ClipboardList size={16} className="text-[#106EBE]" />
                    <span className="text-[10px] font-black text-[#106EBE] uppercase tracking-[0.3em]">
                        RECETA DE PREPARACIÓN
                    </span>
                </div>

                {loadingReceta ? (
                    <div className="flex items-center justify-center py-10 gap-3 text-[#7a8499]">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-xs font-bold">Cargando receta...</span>
                    </div>
                ) : recetaNotFound || !receta ? (
                    <div className="flex items-center justify-center py-8 text-[#7a8499] gap-2">
                        <BookOpen size={18} className="opacity-40" />
                        <span className="text-xs font-bold uppercase tracking-widest">Sin receta registrada para este platillo</span>
                    </div>
                ) : (
                    <div className="p-5 flex flex-col gap-4">
                        {/* Meta-info: porciones + tiempo */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#141922] rounded-lg p-3">
                                <span className="block text-[8px] font-bold text-[#7a8499] uppercase mb-1">Porciones</span>
                                <span className="text-white font-black text-lg">{receta.porciones ?? '—'}</span>
                            </div>
                            <div className="bg-[#141922] rounded-lg p-3">
                                <span className="block text-[8px] font-bold text-[#7a8499] uppercase mb-1">Tiempo estimado</span>
                                <span className="text-white font-black text-lg">
                                    {receta.tiempo_preparacion ? `${receta.tiempo_preparacion} min` : '—'}
                                </span>
                            </div>
                        </div>

                        {/* Tabla de ingredientes */}
                        {receta.receta_ingredientes && receta.receta_ingredientes.length > 0 && (
                            <div>
                                <h4 className="text-[9px] font-black text-[#106EBE] uppercase tracking-[0.3em] mb-2">INGREDIENTES</h4>
                                <div className="rounded-lg overflow-hidden border border-[#106EBE22]">
                                    <div className="grid grid-cols-[1fr_80px_60px] bg-[#106EBE15] px-4 py-2 border-b border-[#106EBE22]">
                                        <span className="text-[9px] font-black text-[#106EBE] uppercase">Ingrediente</span>
                                        <span className="text-[9px] font-black text-[#106EBE] uppercase text-center">Cant.</span>
                                        <span className="text-[9px] font-black text-[#106EBE] uppercase text-center">Unidad</span>
                                    </div>
                                    {receta.receta_ingredientes.map((ing, idx) => (
                                        <div
                                            key={idx}
                                            className={`grid grid-cols-[1fr_80px_60px] px-4 py-2.5 border-b border-[#106EBE11] last:border-0 ${idx % 2 === 0 ? 'bg-[#141922]' : 'bg-[#0d1117]'}`}
                                        >
                                            <span className="text-xs font-bold text-white">{ing.ingrediente_nombre}</span>
                                            <span className="text-xs font-bold text-[#7a8499] text-center">{ing.cantidad}</span>
                                            <span className="text-xs font-bold text-[#7a8499] text-center">{ing.unidad}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Instrucciones */}
                        {receta.instrucciones && (
                            <div>
                                <h4 className="text-[9px] font-black text-[#106EBE] uppercase tracking-[0.3em] mb-2">INSTRUCCIONES</h4>
                                <div className="flex flex-col gap-2">
                                    {receta.instrucciones.split('\n').filter(s => s.trim()).map((paso, idx) => (
                                        <div
                                            key={idx}
                                            className="flex gap-3 bg-[#141922] rounded-lg px-4 py-2.5 border-l-[3px] border-[#106EBE]"
                                        >
                                            <span className="text-[#106EBE] font-black text-xs shrink-0">{idx + 1}.</span>
                                            <span className="text-xs text-[#e8eaf0] leading-relaxed">{paso.replace(/^\d+\.\s*/, '').trim()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Panel Info + Bitácora */}
            <div className="grid grid-cols-[1fr,1.2fr] gap-5">
                <div className="bg-[#141922] rounded-3xl p-5 border border-[#106EBE1a]">
                    <h4 className="text-[10px] font-black text-[#106EBE] uppercase tracking-[0.3em] mb-4">Información</h4>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                        <div>
                            <span className="block text-[8px] font-bold text-[#7a8499] uppercase mb-1">Platillo</span>
                            <span className="text-xs font-bold text-white leading-tight">{selectedProduct?.nombre}</span>
                        </div>
                        <div>
                            <span className="block text-[8px] font-bold text-[#7a8499] uppercase mb-1">Cocinero</span>
                            <span className="text-xs font-bold text-white leading-tight">{currentChef?.nombre}</span>
                        </div>
                        <div>
                            <span className="block text-[8px] font-bold text-[#7a8499] uppercase mb-1">Hora Inicio</span>
                            <span className="text-xs font-bold text-white tabular-nums">{startTime ? startTime.toLocaleTimeString('es-GT') : '—'}</span>
                        </div>
                        <div>
                            <span className="block text-[8px] font-bold text-[#7a8499] uppercase mb-1">Hora Finalización</span>
                            <span className="text-xs font-bold text-white tabular-nums">{endTime ? endTime.toLocaleTimeString('es-GT') : '—'}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-[#0d1117] rounded-3xl p-5 border border-[#106EBE1a] flex flex-col">
                    <h4 className="text-[10px] font-black text-[#106EBE] uppercase tracking-[0.3em] mb-4">Bitácora de Sesión</h4>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="flex flex-col gap-2">
                            {sessionLog.map((log, i) => (
                                <div key={i} className="flex gap-3 text-[10px]">
                                    <span className="text-[#106EBE] font-bold tabular-nums">[{log.time}]</span>
                                    <span className="text-[#7a8499] font-medium leading-tight">{log.msg}</span>
                                </div>
                            ))}
                            <div className="text-[10px] text-[#7a8499] opacity-30 flex gap-3">
                                <span>[{currentTime}]</span>
                                <span>Esperando acciones...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={() => {
                    setTimerActive(false);
                    setView('LIST');
                }}
                className="text-center text-[#7a8499] font-bold text-xs uppercase hover:text-white transition-colors py-2"
            >
                ← Salir a lista de producciones
            </button>
        </div>
    );

    // ─── SHELL ───────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[999] bg-[#1a1f2e] text-[#e8eaf0] flex flex-col font-sans select-none overflow-hidden">
            {/* Header */}
            <header className="bg-[#0d1117] h-16 border-b border-[#106EBE33] flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#106EBE] rounded-full flex items-center justify-center p-2 shadow-inner">
                        <Layers className="text-white" size={20} />
                    </div>
                    <span className="text-xs font-black tracking-[0.3em] text-[#106EBE] uppercase">Módulo de Producción</span>
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
