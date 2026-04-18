import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import {
    Plus, X, Save, RefreshCw, Loader2, Camera, Search, Edit2, Trash2,
    Eye, Check, Archive, AlertTriangle, TrendingDown, Wrench, Package,
    FilePlus, Pencil, AlertCircle, Boxes, ShoppingBag, Clock, BadgeAlert,
    ClipboardList, ShoppingCart, BarChart2, Download, FileText,
    List, LayoutGrid, History, ChevronDown, ChevronUp, ArrowUpCircle,
    ArrowDownCircle, RefreshCcw, Printer, FileSpreadsheet, MessageCircle,
    FolderPlus, Folder,
    ImagePlus, Tag, Info, Star, CheckCircle2
} from 'lucide-react';
import { registrarAuditoria, detectarCambios } from '../../services/auditService';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type ItemTipo = 'insumo' | 'utensilio';
type AlertStatus = 'ok' | 'low' | 'critical' | 'empty';
type FormTab = 'info' | 'stock' | 'fotos' | 'compra' | 'historial';

interface Category { id: string; nombre: string; tipo: ItemTipo; }
interface Photo { id: string; url: string; tipo: string; descripcion: string; fecha_foto: string; }
interface Movement {
    id: string; tipo: string; cantidad_anterior: number; cantidad_movimiento: number;
    cantidad_nueva: number; motivo: string; notas: string; referencia: string;
    responsable: string; fecha_movimiento: string;
}
interface InventoryItem {
    id: string; org_id: string; codigo: string; nombre: string; descripcion: string;
    tipo: ItemTipo; categoria_id: string | null; marca: string; modelo: string;
    material: string; tamano_capacidad: string; unidad_medida: string;
    contenido_por_unidad: string;
    stock_actual: number; stock_minimo: number; stock_maximo: number; ubicacion: string;
    cantidad_total: number; cantidad_en_uso: number; cantidad_bodega: number;
    cantidad_reparacion: number; cantidad_minima: number;
    estado: string; fecha_adquisicion: string | null; costo_adquisicion: number;
    vida_util_anos: number; fecha_proxima_revision: string | null;
    precio_compra: number; precio_unitario_minimo: number;
    fecha_ultima_compra: string | null; dias_entre_compras: number;
    consumo_diario_promedio: number; imagen_principal_url: string | null;
    activo: boolean; notas: string; created_at: string;
    // Joined
    categoria_nombre?: string;
    _photos?: Photo[];
    _movements?: Movement[];
}

// ─── Catálogos ────────────────────────────────────────────────────────────────
const MATERIALES = ['Acero inoxidable','Plástico','Madera','Vidrio','Cerámica','Aluminio','Otro'];
const UBICACIONES_I = ['Bodega principal','Cocina','Barra','Área de servicio','Baños','Oficina'];
const UBICACIONES_U = ['Cocina','Sala','Barra','Bodega'];
const UNIDADES = ['unidad','caja','paquete','rollo','bolsa','docena','kilo','litro','galón','otro'];
const ESTADOS_U = [
    {v:'excelente', l:'Excelente', cls:'bg-emerald-600 text-white'},
    {v:'bueno',     l:'Bueno',     cls:'bg-[#106EBE] text-white'},
    {v:'regular',   l:'Regular',   cls:'bg-amber-500 text-white'},
    {v:'reparacion',l:'Reparación',cls:'bg-orange-600 text-white'},
    {v:'baja',      l:'Baja',      cls:'bg-red-700 text-white'},
];
const MOTIVOS = ['compra','uso','perdida','rotura','inventario_fisico','ajuste','baja','devolucion','otro'];
const TIPOS_FOTO = ['general','estado','adquisicion','baja'];

// ─── Demo data ─────────────────────────────────────────────────────────────────
const buildDemoInsumos = (cats: Category[]) => {
    const getCat = (n: string) => cats.find(c => c.nombre === n && c.tipo === 'insumo')?.id || null;
    return [
        { tipo:'insumo', codigo:'INS-0001', nombre:'Bolsas plásticas medianas', categoria_id:getCat('Desechables'), unidad_medida:'paquete', stock_actual:8, stock_minimo:10, stock_maximo:50, ubicacion:'Bodega principal', precio_compra:45, consumo_diario_promedio:2.5, dias_entre_compras:15, activo:true, org_id:'default', estado:'bueno', cantidad_minima:1 },
        { tipo:'insumo', codigo:'INS-0002', nombre:'Vasos desechables 8oz', categoria_id:getCat('Desechables'), unidad_medida:'caja', stock_actual:3, stock_minimo:5, stock_maximo:30, ubicacion:'Cocina', precio_compra:38.5, consumo_diario_promedio:1.5, dias_entre_compras:10, activo:true, org_id:'default', estado:'bueno', cantidad_minima:1 },
        { tipo:'insumo', codigo:'INS-0003', nombre:'Guantes de nitrilo (caja ×100)', categoria_id:getCat('Limpieza'), unidad_medida:'caja', stock_actual:0, stock_minimo:3, stock_maximo:15, ubicacion:'Cocina', precio_compra:120, consumo_diario_promedio:0.5, dias_entre_compras:20, activo:true, org_id:'default', estado:'bueno', cantidad_minima:1 },
        { tipo:'insumo', codigo:'INS-0004', nombre:'Servilletas de papel', categoria_id:getCat('Desechables'), unidad_medida:'paquete', stock_actual:25, stock_minimo:10, stock_maximo:60, ubicacion:'Área de servicio', precio_compra:28, consumo_diario_promedio:3, dias_entre_compras:14, activo:true, org_id:'default', estado:'bueno', cantidad_minima:1 },
        { tipo:'insumo', codigo:'INS-0005', nombre:'Rollos para impresora POS', categoria_id:getCat('Oficina y POS'), unidad_medida:'caja', stock_actual:4, stock_minimo:5, stock_maximo:20, ubicacion:'Oficina', precio_compra:85, consumo_diario_promedio:0.2, dias_entre_compras:30, activo:true, org_id:'default', estado:'bueno', cantidad_minima:1 },
    ];
};
const buildDemoUtensilios = (cats: Category[]) => {
    const getCat = (n: string) => cats.find(c => c.nombre === n && c.tipo === 'utensilio')?.id || null;
    return [
        { tipo:'utensilio', codigo:'UTE-0001', nombre:'Sartén antiadherente 30cm', categoria_id:getCat('Utensilios de cocina'), marca:'Tramontina', material:'Aluminio', tamano_capacidad:'30cm', cantidad_total:4, cantidad_en_uso:3, cantidad_bodega:1, cantidad_reparacion:0, cantidad_minima:2, ubicacion:'Cocina', estado:'bueno', costo_adquisicion:350, vida_util_anos:2, activo:true, org_id:'default', stock_actual:0, stock_minimo:0, stock_maximo:0, precio_compra:350 },
        { tipo:'utensilio', codigo:'UTE-0002', nombre:'Cuchillo chef 8"', categoria_id:getCat('Utensilios de cocina'), marca:'Victorinox', material:'Acero inoxidable', tamano_capacidad:'8 pulgadas', cantidad_total:3, cantidad_en_uso:3, cantidad_bodega:0, cantidad_reparacion:0, cantidad_minima:3, ubicacion:'Cocina', estado:'regular', costo_adquisicion:280, vida_util_anos:5, activo:true, org_id:'default', stock_actual:0, stock_minimo:0, stock_maximo:0, precio_compra:280 },
        { tipo:'utensilio', codigo:'UTE-0003', nombre:'Platos llanos 28cm', categoria_id:getCat('Vajilla'), marca:'Corona', material:'Cerámica', tamano_capacidad:'28cm', cantidad_total:24, cantidad_en_uso:20, cantidad_bodega:4, cantidad_reparacion:0, cantidad_minima:20, ubicacion:'Sala', estado:'bueno', costo_adquisicion:45, vida_util_anos:5, activo:true, org_id:'default', stock_actual:0, stock_minimo:0, stock_maximo:0, precio_compra:45 },
        { tipo:'utensilio', codigo:'UTE-0004', nombre:'Vasos de agua 12oz', categoria_id:getCat('Cristalería'), marca:'Libbey', material:'Vidrio', tamano_capacidad:'12 oz', cantidad_total:36, cantidad_en_uso:30, cantidad_bodega:6, cantidad_reparacion:0, cantidad_minima:24, ubicacion:'Sala', estado:'bueno', costo_adquisicion:22, vida_util_anos:3, activo:true, org_id:'default', stock_actual:0, stock_minimo:0, stock_maximo:0, precio_compra:22 },
        { tipo:'utensilio', codigo:'UTE-0005', nombre:'Licuadora industrial', categoria_id:getCat('Equipos menores'), marca:'Oster', material:'Plástico', tamano_capacidad:'2 litros', cantidad_total:2, cantidad_en_uso:1, cantidad_bodega:0, cantidad_reparacion:1, cantidad_minima:1, ubicacion:'Cocina', estado:'reparacion', costo_adquisicion:850, vida_util_anos:4, activo:true, org_id:'default', stock_actual:0, stock_minimo:0, stock_maximo:0, precio_compra:850 },
    ];
};

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmtQ = (n: number) => `Q ${Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtNum = (n: number) => Number(n||0).toLocaleString('es-GT');
const fmtDate = (d: string) => d ? new Date(d).toLocaleString('es-GT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

const compressImage = (file: File): Promise<Blob> =>
    new Promise(resolve => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                const MAX = 1200;
                let {width,height} = img;
                if (width>MAX||height>MAX) {
                    if (width>height){height=(height*MAX)/width;width=MAX;}
                    else{width=(width*MAX)/height;height=MAX;}
                }
                const canvas=document.createElement('canvas');
                canvas.width=width;canvas.height=height;
                canvas.getContext('2d')!.drawImage(img,0,0,width,height);
                canvas.toBlob(b=>resolve(b!),'image/jpeg',0.82);
            };
        };
    });

function getAlertStatus(item: InventoryItem): AlertStatus {
    if (item.tipo === 'insumo') {
        if (item.stock_actual <= 0) return 'empty';
        if (item.stock_actual <= item.stock_minimo) return 'critical';
        if (item.stock_actual <= item.stock_minimo * 1.5) return 'low';
        return 'ok';
    } else {
        if (item.cantidad_total < item.cantidad_minima) return 'critical';
        return 'ok';
    }
}
const ALERT_BADGE: Record<AlertStatus,string> = {
    ok:'bg-[#106EBE] text-white', low:'bg-amber-500 text-white',
    critical:'bg-orange-600 text-white', empty:'bg-red-600 text-white'
};
const ALERT_LABEL: Record<AlertStatus,string> = {
    ok:'En Stock', low:'Stock Bajo', critical:'Crítico', empty:'Sin Stock'
};

function emptyForm(tipo: ItemTipo): Omit<InventoryItem,'id'|'org_id'|'created_at'|'categoria_nombre'|'_photos'|'_movements'> {
    return {
        codigo:'', nombre:'', descripcion:'', tipo, categoria_id:null,
        marca:'', modelo:'', material:'', tamano_capacidad:'', unidad_medida:'unidad',
        contenido_por_unidad:'', stock_actual:0, stock_minimo:0, stock_maximo:0, ubicacion:'',
        cantidad_total:1, cantidad_en_uso:0, cantidad_bodega:1, cantidad_reparacion:0, cantidad_minima:1,
        estado:'bueno', fecha_adquisicion:null, costo_adquisicion:0, vida_util_anos:3,
        fecha_proxima_revision:null, precio_compra:0, precio_unitario_minimo:0,
        fecha_ultima_compra:null, dias_entre_compras:30, consumo_diario_promedio:0,
        imagen_principal_url:null, activo:true, notas:'',
    };
}

// ─── Componente Principal ─────────────────────────────────────────────────────
interface Props { initialTab?: ItemTipo; }
export const InventarioUnificado: React.FC<Props> = ({ initialTab = 'insumo' }) => {
    const [activeTab, setActiveTab] = useState<ItemTipo>(initialTab);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'list'|'cards'>('list');
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterUbic, setFilterUbic] = useState('');
    const [showAlertsPanel, setShowAlertsPanel] = useState(true);
    const [dbError, setDbError] = useState(false);
    const [dbErrorMsg, setDbErrorMsg] = useState('');

    // Form
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem|null>(null);
    const [form, setForm] = useState<ReturnType<typeof emptyForm>>(emptyForm(activeTab));
    const [formTab, setFormTab] = useState<FormTab>('info');
    const [saving, setSaving] = useState(false);

    // Fotos
    const [formPhotos, setFormPhotos] = useState<Photo[]>([]);
    const [uploadingImg, setUploadingImg] = useState(false);
    const [photoTypeModal, setPhotoTypeModal] = useState<{file:File|null;show:boolean}>({file:null,show:false});
    const [selectedPhotoType, setSelectedPhotoType] = useState<string>('general');
    const [photoDesc, setPhotoDesc] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Movimientos form
    const [showMovForm, setShowMovForm] = useState(false);
    const [movItem, setMovItem] = useState<InventoryItem|null>(null);
    const [movForm, setMovForm] = useState({tipo:'entrada', cantidad:'', motivo:'compra', notas:'', referencia:''});

    // Conteo físico
    const [showPhysical, setShowPhysical] = useState(false);
    const [physCounts, setPhysCounts] = useState<Record<string,string>>({});
    const [physResponsable, setPhysResponsable] = useState('');

    // Lista de compras
    const [showPurchase, setShowPurchase] = useState(false);

    // Quick adjust modal
    const [showQuick, setShowQuick] = useState(false);
    const [quickItem, setQuickItem] = useState<InventoryItem|null>(null);
    const [quickDelta, setQuickDelta] = useState('1');
    const [quickMotivo, setQuickMotivo] = useState('uso');

    // Detail
    const [viewItem, setViewItem] = useState<InventoryItem|null>(null);

    // Context menu
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [ctxMenu, setCtxMenu] = useState<{x:number;y:number;item?:InventoryItem}|null>(null);
    const [showCatModal, setShowCatModal] = useState(false);
    const [newCatName, setNewCatName] = useState('');

    // ••• SIDEBAR RESIZING STATE •••
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('pos_sidebar_width_unified');
        return saved ? parseInt(saved) : 240;
    });
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    const stopResizing = () => {
        setIsResizing(false);
        localStorage.setItem('pos_sidebar_width_unified', sidebarWidth.toString());
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        const newWidth = e.clientX;
        if (newWidth >= 140 && newWidth <= 600) {
            setSidebarWidth(newWidth);
        }
    };

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, sidebarWidth]);

    // ── Carga ────────────────────────────────────────────────────────────────
    const fetchCategories = useCallback(async () => {
        // D3: insumos → supply_categories | D4: utensilios → utensil_categories
        // NOTA: ambas tablas usan columna 'name' (no 'nombre')
        const table = activeTab === 'insumo' ? 'supply_categories' : 'utensil_categories';
        const { data } = await supabase
            .from(table)
            .select('id, name, sort_order')
            .order('sort_order');
        // Normalizar 'name' → 'nombre' para compatibilidad con interfaz Category
        const mapped = ((data as any[]) || []).map(c => ({
            id: c.id,
            nombre: c.name ?? '',   // 'name' en BD → 'nombre' en interfaz
            tipo: activeTab,
        })) as Category[];
        setCategories(mapped);
        return mapped;
    }, [activeTab]);

    const fetchItems = useCallback(async (cats?: Category[]) => {
        setLoading(true);
        try {
            const {data, error} = await supabase
                .from('inventory_items')
                .select('*')
                .eq('org_id', 'default')
                .eq('tipo', activeTab)
                .eq('activo', true)
                .order('nombre');

            if (error) {
                console.error('[InventarioUnificado] fetchItems error:', error);
                setDbError(true);
                setDbErrorMsg(error.message || error.code || 'Error desconocido');
                setItems([]);
                setLoading(false);
                return;
            }
            setDbError(false);
            setDbErrorMsg('');

            // Join con categorías del dominio correcto
            let finalCats = cats;
            if (!finalCats || finalCats.length === 0) {
                if (categories.length > 0) {
                    finalCats = categories;
                } else {
                    const table = activeTab === 'insumo' ? 'supply_categories' : 'utensil_categories';
                    const { data: freshCats } = await supabase.from(table).select('id, name');
                    finalCats = ((freshCats as any[]) || []).map(c => ({
                        id: c.id, nombre: c.name ?? '', tipo: activeTab,
                    })) as Category[];
                }
            }

            const mapped = (data || []).map((i: any) => ({
                ...i,
                categoria_nombre: finalCats?.find(c => String(c.id) === String(i.categoria_id))?.nombre || null
            }));

            if (mapped.length === 0 && finalCats && finalCats.length > 0) {
                const demo = activeTab === 'insumo' ? buildDemoInsumos(finalCats) : buildDemoUtensilios(finalCats);
                const { error: insertErr } = await supabase.from('inventory_items').insert(demo as any[]);
                if (!insertErr) {
                    const { data: d2 } = await supabase.from('inventory_items')
                        .select('*').eq('org_id','default').eq('tipo',activeTab).eq('activo',true).order('nombre');
                    setItems(((d2||[]).map((i:any) => ({
                        ...i,
                        categoria_nombre: cats.find(c => c.id === i.categoria_id)?.nombre || null
                    }))) as InventoryItem[]);
                }
            } else {
                setItems(mapped as InventoryItem[]);
            }
        } catch(e: any) {
            console.error('[InventarioUnificado] fetchItems catch:', e);
            setDbError(true);
            setDbErrorMsg(e?.message || 'Error de conexión');
        }
        setLoading(false);
    }, [activeTab]); // ← Solo activeTab, sin categories para evitar loop

    useEffect(() => {
        fetchCategories().then(cats => fetchItems(cats));
    }, [activeTab, fetchCategories, fetchItems]);

    // ── Pre-calculos para el árbol ───────────────────────────────────────────
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['ALL']));
    const toggleCat = (id: string) => {
        setExpandedCats(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const tabCats = categories.filter(c => c.tipo === activeTab);

    useEffect(() => {
        const close = ()=>setCtxMenu(null);
        document.addEventListener('click',close);
        return ()=>document.removeEventListener('click',close);
    },[]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const genCode = async () => {
        const prefix = activeTab==='insumo'?'INS':'UTE';
        const {count} = await supabase.from('inventory_items').select('*',{count:'exact',head:true}).eq('tipo',activeTab);
        return `${prefix}-${String((count||0)+1).padStart(4,'0')}`;
    };

    const logMovement = async (item:InventoryItem, tipo:string, antes:number, movimiento:number, nueva:number, motivo:string, notas='', ref='') => {
        await supabase.from('inventory_movements').insert({
            item_id:item.id, org_id:'default', tipo, cantidad_anterior:antes,
            cantidad_movimiento:movimiento, cantidad_nueva:nueva,
            motivo, notas, referencia:ref, responsable:'Admin',
        });
        
        const costoUnitario = item.precio_compra || item.costo_adquisicion || 0;
        const monto = movimiento * costoUnitario;
        
        if (motivo === 'baja' || motivo === 'perdida' || motivo === 'rotura') {
            await registrarAuditoria({
                modulo: 'INVENTARIO',
                accion: 'ITEM_DADO_DE_BAJA',
                accion_descripcion: `Baja de ${movimiento} ${item.unidad_medida||'u'} de ${item.nombre} por ${motivo}`,
                entidad_id: item.id,
                entidad_tipo: 'inventario',
                entidad_nombre: item.nombre,
                valores_anteriores: { cantidad_baja: movimiento, motivo, valor_economico_perdido: monto },
                impacto_financiero: {
                    diferencia_precio: monto,
                    impacto_mensual_estimado: `Pérdida de Q${monto.toFixed(2)}`
                }
            });
        } else if (motivo === 'ajuste' || motivo === 'uso' || motivo === 'inventario_fisico') {
            await registrarAuditoria({
                modulo: 'INVENTARIO',
                accion: 'STOCK_AJUSTADO',
                accion_descripcion: `Ajuste de stock: ${item.nombre}: ${antes} → ${nueva} (${tipo === 'entrada' ? '+' : '-'}${movimiento}) por ${motivo}`,
                entidad_id: item.id,
                entidad_tipo: 'inventario',
                entidad_nombre: item.nombre,
                valores_anteriores: { stock: antes },
                valores_nuevos: { stock: nueva },
                metadata: { diferencia: movimiento, motivo, responsable: 'Admin' }
            });
        }

        // Integración con Contabilidad y Costos
        if (motivo === 'baja' || motivo === 'perdida' || motivo === 'rotura') {
            const costoUnitario = item.precio_compra || item.costo_adquisicion || 0;
            const monto = movimiento * costoUnitario;
            if (monto > 0) {
                // 1. Reflejar en Control de Costos (cost_items)
                await supabase.from('cost_items').insert({
                    org_id: 'default',
                    date: new Date().toISOString().split('T')[0],
                    category: item.tipo === 'insumo' ? 'variable_insumo' : 'variable_utensilio',
                    amount: monto,
                    notes: `Baja/Pérdida inv: ${item.nombre} (${movimiento} ${item.unidad_medida||'u'})`
                });

                // 2. Reflejar en Contabilidad (accounting_entries) - acumulativo del mes
                const dateObj = new Date();
                const mes = dateObj.getMonth() + 1;
                const anio = dateObj.getFullYear();
                const codigoCuenta = item.tipo === 'insumo' ? '712007' : '712024';
                
                // Hacemos upsert manual si no existe la cuenta para este periodo
                const { data: existing } = await supabase.from('accounting_entries')
                    .select('id, monto')
                    .eq('periodo_mes', mes)
                    .eq('periodo_anio', anio)
                    .eq('codigo_cuenta', codigoCuenta)
                    .maybeSingle();

                if (existing) {
                    await supabase.from('accounting_entries').update({
                        monto: Number(existing.monto) + monto
                    }).eq('id', existing.id);
                } else {
                    await supabase.from('accounting_entries').insert({
                        org_id: 'default',
                        periodo_mes: mes,
                        periodo_anio: anio,
                        codigo_cuenta: codigoCuenta,
                        nombre_cuenta: item.tipo === 'insumo' ? 'Gastos - Limpieza y Consumibles' : 'Gastos - Utensilios',
                        seccion: 'estado_resultados',
                        monto: monto,
                        fuente: 'automatico'
                    });
                }
            }
        }
    };

    // ── CRUD ─────────────────────────────────────────────────────────────────
    const openNew = async () => {
        const code = await genCode();
        setForm({...emptyForm(activeTab), codigo:code});
        setFormPhotos([]);
        setEditingItem(null);
        setFormTab('info');
        setShowForm(true);
        setCtxMenu(null);
    };

    const openEdit = async (item: InventoryItem) => {
        setEditingItem(item);
        setForm({...item});
        setFormTab('info');
        // Load photos
        const {data} = await supabase.from('inventory_photos').select('*').eq('item_id',item.id).order('created_at');
        setFormPhotos((data as Photo[])||[]);
        setShowForm(true);
        setCtxMenu(null);
    };

    const loadPhotosForView = async (item: InventoryItem) => {
        const {data} = await supabase.from('inventory_photos').select('*').eq('item_id',item.id).order('created_at');
        const {data:movs} = await supabase.from('inventory_movements').select('*').eq('item_id',item.id).order('fecha_movimiento',{ascending:false}).limit(30);
        setViewItem({...item, _photos:(data as Photo[])||[], _movements:(movs as Movement[])||[]});
    };

    const handleSave = async () => {
        if (!form.nombre.trim()) return;
        setSaving(true);
        const payload = {...form, org_id:'default', tipo:activeTab};
        // Limpiar campos calculados o privados que no existen en la DB
        const cleanPayload = {...payload};
        delete (cleanPayload as any).categoria_nombre;
        Object.keys(cleanPayload).forEach(key => {
            if (key.startsWith('_')) delete (cleanPayload as any)[key];
        });

        if (editingItem) {
            await supabase.from('inventory_items').update(cleanPayload).eq('id',editingItem.id);
            
            const cambios = detectarCambios(editingItem, payload);
            if (cambios.campos_modificados.length > 0) {
                 if (cambios.campos_modificados.includes('precio_compra')) {
                     await registrarAuditoria({
                        modulo: 'INVENTARIO',
                        accion: 'PRECIO_COMPRA_ACTUALIZADO',
                        accion_descripcion: `Precio de compra de ${payload.nombre} actualizado: Q${editingItem.precio_compra} → Q${payload.precio_compra}`,
                        entidad_id: editingItem.id,
                        entidad_tipo: 'inventario',
                        entidad_nombre: payload.nombre,
                        valores_anteriores: { precio: editingItem.precio_compra },
                        valores_nuevos: { precio: payload.precio_compra }
                     });
                 }
            }
        } else {
            const {data:newItem, error:insErr} = await supabase.from('inventory_items').insert(cleanPayload).select().single();
            if (newItem) {
                await registrarAuditoria({
                    modulo: 'INVENTARIO',
                    accion: 'ITEM_CREADO',
                    accion_descripcion: `Ítem de inventario creado: ${payload.nombre} (${payload.codigo})`,
                    entidad_id: newItem.id,
                    entidad_tipo: 'inventario',
                    entidad_nombre: payload.nombre,
                    valores_nuevos: payload
                });

                const antes = 0;
                const nueva = activeTab==='insumo' ? payload.stock_actual : payload.cantidad_total;
                await logMovement(newItem as InventoryItem,'entrada',antes,nueva,nueva,'compra','Stock inicial al crear item');
                // Save pending photos
                if (formPhotos.length > 0) {
                    await supabase.from('inventory_photos').insert(formPhotos.map(p=>({...p,item_id:newItem.id})));
                }
            }
        }
        setSaving(false);
        setShowForm(false);
        fetchItems();
    };

    const handleSaveCategory = async () => {
        if (!newCatName.trim()) return;
        setSaving(true);
        // D3: insumos → supply_categories | D4: utensilios → utensil_categories
        // NOTA: ambas tablas usan columna 'name' (no 'nombre')
        const table = activeTab === 'insumo' ? 'supply_categories' : 'utensil_categories';
        const { error } = await supabase.from(table).insert({
            name: newCatName.trim().toUpperCase(),  // columna real: 'name'
        });
        if (!error) {
            await fetchCategories();
            setShowCatModal(false);
            setNewCatName('');
        }
        setSaving(false);
    };

    const handleDelete = async (id:string) => {
        if (!confirm('¿Eliminar este ítem? No se puede deshacer.')) return;
        await supabase.from('inventory_items').update({activo:false}).eq('id',id);
        fetchItems(); setCtxMenu(null);
    };

    // ── Upload imagen ─────────────────────────────────────────────────────────
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (formPhotos.length >= 5) { alert('Máximo 5 imágenes.'); return; }
        setPhotoTypeModal({file, show:true});
        setSelectedPhotoType('general');
        setPhotoDesc('');
        if (fileInputRef.current) fileInputRef.current.value='';
    };

    const confirmPhotoUpload = async () => {
        const {file} = photoTypeModal;
        if (!file) return;
        setPhotoTypeModal({file:null,show:false});
        setUploadingImg(true);
        try {
            const compressed = await compressImage(file);
            const fileName = `inventory/${activeTab}/${Date.now()}.jpg`;
            const {data,error} = await supabase.storage.from('inventario-fotos').upload(fileName,compressed,{upsert:true,contentType:'image/jpeg'});
            let url = '';
            if (!error && data) {
                const {data:u} = supabase.storage.from('inventario-fotos').getPublicUrl(data.path);
                url = u.publicUrl;
            } else {
                // fallback dataURL
                await new Promise<void>(res => {
                    const reader = new FileReader();
                    reader.onload = ev => { url = ev.target?.result as string; res(); };
                    reader.readAsDataURL(compressed);
                });
            }
            const newPhoto: Photo = {
                id: crypto.randomUUID(),
                url, tipo:selectedPhotoType,
                descripcion:photoDesc,
                fecha_foto:new Date().toISOString(),
            };
            setFormPhotos(p=>[...p,newPhoto]);
            // If first photo, set as principal
            if (formPhotos.length === 0) setForm(f=>({...f, imagen_principal_url:url}));
            // If editing, save immediately
            if (editingItem) {
                await supabase.from('inventory_photos').insert({...newPhoto, item_id:editingItem.id});
                if (formPhotos.length === 0) await supabase.from('inventory_items').update({imagen_principal_url:url}).eq('id',editingItem.id);
            }
        } catch {}
        setUploadingImg(false);
    };

    const deletePhoto = async (photoId:string) => {
        setFormPhotos(p=>p.filter(ph=>ph.id!==photoId));
        if (editingItem) await supabase.from('inventory_photos').delete().eq('id',photoId);
    };

    // ── Movimiento manual ─────────────────────────────────────────────────────
    const openMovForm = (item:InventoryItem) => {
        setMovItem(item);
        setMovForm({tipo:'entrada', cantidad:'', motivo:'compra', notas:'', referencia:''});
        setShowMovForm(true);
        setCtxMenu(null);
    };

    const handleMovSave = async () => {
        if (!movItem || !movForm.cantidad) return;
        setSaving(true);
        const cant = Number(movForm.cantidad);
        const antes = activeTab==='insumo' ? movItem.stock_actual : movItem.cantidad_total;
        let nueva = antes;
        if (movForm.tipo==='entrada') nueva = antes+cant;
        else if (movForm.tipo==='salida') nueva = Math.max(0,antes-cant);
        else if (movForm.tipo==='ajuste') nueva = cant;

        if (activeTab==='insumo') {
            await supabase.from('inventory_items').update({stock_actual:nueva}).eq('id',movItem.id);
        } else {
            await supabase.from('inventory_items').update({cantidad_total:nueva}).eq('id',movItem.id);
        }
        await logMovement(movItem,movForm.tipo,antes,Math.abs(nueva-antes),nueva,movForm.motivo,movForm.notas,movForm.referencia);
        setSaving(false); setShowMovForm(false); fetchItems();
    };

    // ── Quick adjust ──────────────────────────────────────────────────────────
    const openQuick = (item:InventoryItem) => {
        setQuickItem(item); 
        setQuickDelta(String(activeTab==='insumo'?item.stock_actual:item.cantidad_total)); 
        setQuickMotivo('ajuste');
        setShowQuick(true);
    };

    const handleQuickSave = async (nueva:number) => {
        if (!quickItem) return;
        const antes = activeTab==='insumo' ? quickItem.stock_actual : quickItem.cantidad_total;
        if (activeTab==='insumo') {
            await supabase.from('inventory_items').update({stock_actual:nueva}).eq('id',quickItem.id);
        } else {
            await supabase.from('inventory_items').update({cantidad_total:nueva}).eq('id',quickItem.id);
        }
        await logMovement(quickItem, 'ajuste', antes, Math.abs(nueva-antes), nueva, quickMotivo, 'Ajuste rápido manual');
        setItems(prev=>prev.map(i=>i.id===quickItem.id ? {...i, stock_actual: activeTab==='insumo'?nueva:i.stock_actual, cantidad_total: activeTab==='utensilio'?nueva:i.cantidad_total} : i));
        setShowQuick(false);
    };

    // ── Conteo físico ─────────────────────────────────────────────────────────
    const handlePhysicalSave = async () => {
        setSaving(true);
        const {data:conteo} = await supabase.from('physical_counts').insert({
            org_id:'default', tipo: activeTab==='insumo'?'insumos':'utensilios',
            fecha_conteo:new Date().toISOString().split('T')[0],
            responsable:physResponsable||'Admin', estado:'completado',
        }).select().single();

        const lines = [];
        let totalDiferenciaMontos = 0;
        let itemsConDiferencia = 0;
        let itemsContados = 0;

        for (const item of items) {
            const val = physCounts[item.id];
            if (val===undefined||val==='') continue;
            
            itemsContados++;
            const counted = Number(val);
            const sys = activeTab==='insumo' ? item.stock_actual : item.cantidad_total;
            lines.push({conteo_id:conteo?.id, item_id:item.id, cantidad_sistema:sys, cantidad_contada:counted, ajustado:true});
            if (counted !== sys) {
                itemsConDiferencia++;
                totalDiferenciaMontos += Math.abs(sys - counted) * (item.precio_compra || item.costo_adquisicion || 0);

                if (activeTab==='insumo') await supabase.from('inventory_items').update({stock_actual:counted}).eq('id',item.id);
                else await supabase.from('inventory_items').update({cantidad_total:counted}).eq('id',item.id);
                await logMovement(item,'conteo',sys,Math.abs(counted-sys),counted,'inventario_fisico',`Conteo físico: ${physResponsable||'Admin'}`);
            }
        }
        if (lines.length > 0) {
            await supabase.from('physical_count_lines').insert(lines);
            
            await registrarAuditoria({
                modulo: 'INVENTARIO',
                accion: 'CONTEO_FISICO',
                accion_descripcion: `Conteo físico completado: ${itemsContados} ítems contados, ${itemsConDiferencia} con diferencia`,
                entidad_id: conteo?.id,
                entidad_tipo: 'inventario_conteo',
                entidad_nombre: `Conteo ${conteo?.fecha_conteo}`,
                metadata: {
                    items_contados: itemsContados,
                    items_con_diferencia: itemsConDiferencia,
                    responsable: physResponsable || 'Admin'
                },
                impacto_financiero: {
                    monto_total: totalDiferenciaMontos,
                    impacto_mensual_estimado: `Diferencia de Q${totalDiferenciaMontos.toFixed(2)}`
                }
            });
        }
        setSaving(false); setShowPhysical(false); setPhysCounts({}); fetchItems();
    };

    // ── Lista de compras ──────────────────────────────────────────────────────
    const purchaseItems = items.filter(i=>{const s=getAlertStatus(i);return s==='critical'||s==='empty'||s==='low';});

    const printPurchaseList = () => {
        const byProv = purchaseItems.reduce((acc,i)=>{
            const p=i.categoria_nombre||'Sin categoría';
            if(!acc[p])acc[p]=[];acc[p].push(i);return acc;
        }, {} as Record<string,InventoryItem[]>);
        let html=`<html><head><style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}h1,h3{margin:4px 0}table{width:100%;border-collapse:collapse;margin:8px 0}td,th{border:1px solid #ccc;padding:4px 8px}th{background:#f0f0f0;font-weight:bold}.prov{background:#106EBE;color:white;padding:4px 8px;font-weight:bold;margin:12px 0 0}hr{border:1px solid #333}</style></head><body>`;
        html+=`<h1>LISTA DE COMPRAS — ${new Date().toLocaleDateString('es-GT')}</h1><h3>Cevichería y Restaurante Las Palmas S.A.</h3><hr/>`;
        for(const[prov,provItems]of Object.entries(byProv) as [string, InventoryItem[]][]){
            html+=`<div class="prov">${prov}</div><table><tr><th>Producto</th><th>Unidad</th><th>Stock act.</th><th>A pedir</th><th>Precio</th><th>Subtotal</th></tr>`;
            for(const item of provItems){
                const ap=Math.max(0,item.stock_maximo-item.stock_actual);
                html+=`<tr><td>${item.nombre}</td><td>${item.unidad_medida}</td><td>${item.stock_actual}</td><td><strong>${ap}</strong></td><td>Q ${item.precio_compra?.toFixed(2)||'0.00'}</td><td>Q ${(ap*(item.precio_compra||0)).toFixed(2)}</td></tr>`;
            }
            html+=`</table>`;
        }
        const tot=purchaseItems.reduce((s,i)=>s+Math.max(0,i.stock_maximo-i.stock_actual)*(i.precio_compra||0),0);
        html+=`<hr/><p><strong>TOTAL ESTIMADO: Q ${tot.toFixed(2)}</strong></p></body></html>`;
        const w=window.open('','_blank')!;w.document.write(html);w.document.close();w.print();
    };

    const sendWhatsApp = () => {
        let msg=`*LISTA DE COMPRAS — Las Palmas*\n${new Date().toLocaleDateString('es-GT')}\n\n`;
        purchaseItems.forEach(i=>{
            const ap=Math.max(0,i.stock_maximo-i.stock_actual);
            msg+=`• ${i.nombre} × ${ap} ${i.unidad_medida}\n`;
        });
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const exportCSV = () => {
        const headers=['Código','Nombre','Tipo','Categoría','Unidad','Stock','Mín','Máx','Ubicación','Estado','Precio','Valor'];
        const rows=items.map(i=>[i.codigo,i.nombre,i.tipo,i.categoria_nombre,i.unidad_medida,
            activeTab==='insumo'?i.stock_actual:i.cantidad_total,
            activeTab==='insumo'?i.stock_minimo:i.cantidad_minima,
            i.stock_maximo,i.ubicacion,i.estado,i.precio_compra,
            ((activeTab==='insumo'?i.stock_actual:i.cantidad_total)*(i.precio_compra||0)).toFixed(2)]);
        const csv=[headers,...rows].map(r=>r.map(c=>`"${c||''}"`).join(';')).join('\n');
        const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));
        a.download=`inventario_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;a.click();
    };


    // ── Filtros y cómputos derivados ─────────────────────────────────────────
    const filtered = items.filter(item => {
        const q = search.toLowerCase();
        return (!q || item.nombre.toLowerCase().includes(q) || (item.codigo||'').toLowerCase().includes(q) || (item.marca||'').toLowerCase().includes(q))
            && (!filterCat || item.categoria_id === filterCat)
            && (!filterStatus || getAlertStatus(item) === filterStatus)
            && (!filterUbic || item.ubicacion === filterUbic);
    });

    const kpis = {
        total: items.length,
        alertas: items.filter(i => getAlertStatus(i) !== 'ok').length,
        sinStock: activeTab === 'insumo'
            ? items.filter(i => i.stock_actual <= 0).length
            : items.filter(i => i.estado === 'baja').length,
        valor: activeTab === 'insumo'
            ? items.reduce((s,i) => s + i.stock_actual * (i.precio_compra||0), 0)
            : items.reduce((s,i) => s + i.cantidad_total * (i.costo_adquisicion||0), 0),
    };

    const toggleSelect = (id: string) => setSelectedIds(prev => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });

    const handleCtx = (e: React.MouseEvent, item?: InventoryItem) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY, item });
    };

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col bg-[#f0f0f0] overflow-hidden select-none font-sans" onContextMenu={e => handleCtx(e)}>
        {/* Header de Módulo */}
            <div className="shrink-0 bg-[#106ebe] px-4 py-1 flex items-center justify-between shadow-sm">
                <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">
                    {activeTab === 'insumo' ? 'Suministros e Insumos' : 'Utensilios de Cocina'}
                </span>
                <span className="text-white/60 text-[9px] font-bold uppercase tracking-widest">
                    {activeTab === 'insumo' ? 'TABLA: inventory_items (tipo=insumo)' : 'TABLA: inventory_items (tipo=utensilio)'}
                </span>
            </div>

            {/* ── TOOLBAR ── */}
            <div className="shrink-0 bg-white border-b border-gray-300 px-3 py-1.5 flex items-center gap-1.5 flex-wrap">
                <button onClick={openNew} className="flex items-center gap-1 px-3 py-1 bg-[#106EBE] text-white text-[11px] font-bold border border-[#0d5aa0] hover:bg-[#0d5aa0]"><Plus size={11} /> Agregar Ítem</button>
                <div className="w-px h-5 bg-gray-300 mx-0.5" />
                <button onClick={() => { setPhysCounts({}); setPhysResponsable(''); setShowPhysical(true); }} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-[11px] font-bold text-slate-700 shadow-sm"><ClipboardList size={11} /> Conteo Físico</button>
                <button onClick={() => setShowPurchase(true)} className={`flex items-center gap-1 px-2.5 py-1 border text-[11px] font-bold shadow-sm transition-all ${purchaseItems.length > 0 ? 'bg-amber-50 border-amber-400 text-amber-700 hover:bg-amber-100' : 'bg-white border-gray-300 text-slate-700 hover:bg-gray-50'}`}>
                    <ShoppingCart size={11} /> Lista Compras{purchaseItems.length > 0 && <span className="ml-0.5 bg-amber-500 text-white text-[8px] px-1">{purchaseItems.length}</span>}
                </button>
                <button onClick={exportCSV} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-[11px] font-bold text-slate-700 shadow-sm"><FileSpreadsheet size={11} /> Exportar CSV</button>
                
                <div className="flex-1" />
                
                <div className="relative"><Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en inventario..." className="pl-6 pr-2 py-1 text-[11px] border border-gray-400 bg-white w-48 outline-none focus:border-[#106EBE] font-bold shadow-inner" />
                </div>
                
                <div className="w-px h-5 bg-gray-300 mx-0.5" />
                
                <button onClick={() => setViewMode(v => v === 'list' ? 'cards' : 'list')} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-[11px] font-bold text-slate-700 shadow-sm">
                    {viewMode === 'list' ? <><LayoutGrid size={11} /> Tarjetas</> : <><List size={11} /> Lista</>}
                </button>
                <button onClick={() => fetchCategories().then(c => fetchItems(c))} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-[11px] font-bold text-slate-700 shadow-sm"><RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualizar</button>
            </div>

            {/* ── MAIN CONTENT WITH SIDEBAR ── */}
            <div className="flex-1 flex overflow-hidden">

                
                {/* ── SIDEBAR (Árbol de Categorías de Inventario) ── */}
                <aside 
                    className="shrink-0 bg-white border-r border-gray-300 flex flex-col overflow-hidden shadow-sm"
                    style={{ width: `${sidebarWidth}px` }}
                >
                    <div className="bg-[#f0f0f0] border-b border-gray-300 px-3 py-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Navegar Categorías</span>
                        <Folder size={12} className="text-slate-400" />
                    </div>
                    
                    <div className="flex-1 overflow-y-auto py-2">
                        {/* Botón Ver Todo */}
                        <button 
                            onClick={() => setFilterCat('')}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-left border-b border-gray-50 transition-colors ${filterCat === '' ? 'bg-blue-50 text-[#106ebe]' : 'hover:bg-gray-50 text-slate-600'}`}
                        >
                            <LayoutGrid size={13} className={filterCat === '' ? 'text-[#106ebe]' : 'text-slate-400'} />
                            <span className="text-[11px] font-bold uppercase tracking-tight">MOSTRAR TODO</span>
                        </button>
                        
                        {/* Lista de Categorías de Inventarios */}
                        <div className="py-2 px-1">
                            {tabCats.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setFilterCat(cat.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left rounded-sm transition-all mb-0.5 ${filterCat === cat.id ? 'bg-blue-50 text-[#106ebe] ps-4 border-l-2 border-[#106ebe]' : 'hover:bg-gray-50 text-slate-600 ps-3'}`}
                                >
                                    <Folder size={12} className={filterCat === cat.id ? 'text-[#106ebe]' : 'text-slate-400'} />
                                    <span className={`text-[11px] font-bold uppercase truncate ${filterCat === cat.id ? 'font-black' : ''}`}>
                                        {cat.nombre}
                                    </span>
                                </button>
                            ))}
                            {tabCats.length === 0 && !loading && (
                                <div className="px-4 py-4 text-center">
                                    <Info size={16} className="mx-auto mb-2 text-slate-300" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">No hay categorías configuradas</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-3 bg-gray-50 border-t border-gray-300">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Conexión Segura</span>
                        </div>
                        <p className="text-[8px] text-slate-400 font-medium leading-tight">Este módulo opera bajo el esquema de inventario independiente (TABLA: inventory_items).</p>
                    </div>
                </aside>

                {/* RESIZER HANDLE */}
                <div 
                    onMouseDown={startResizing}
                    className={`w-[4px] h-full cursor-col-resize shrink-0 transition-colors z-50 ${isResizing ? 'bg-[#106ebe]' : 'bg-gray-200 hover:bg-gray-400 opacity-50 hover:opacity-100'}`}
                    title="Arrastrar para redimensionar"
                />

                {/* ── LISTADO / TABLA ── */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {/* KPIs Panel */}
                    <div className="shrink-0 flex items-center border-b border-gray-300 bg-[#f8f9fa]">
                        {[
                            { label: 'ÍTEMS', value: kpis.total, icon: Boxes, c: 'text-slate-700' },
                            { label: 'ALERTAS', value: kpis.alertas, icon: AlertTriangle, c: 'text-amber-600' },
                            { label: activeTab === 'insumo' ? 'SIN STOCK' : 'DE BAJA', value: kpis.sinStock, icon: TrendingDown, c: 'text-red-600' },
                            { label: 'VALOR TOTAL', value: fmtQ(kpis.valor), icon: ShoppingBag, c: 'text-emerald-700' },
                        ].map((k, i) => (
                            <div key={i} className="flex items-center gap-2 px-4 py-1.5 border-r border-gray-200 last:border-r-0">
                                <k.icon size={12} className={k.c} />
                                <span className={`text-[12px] font-black ${k.c}`}>{k.value}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{k.label}</span>
                            </div>
                        ))}
                    </div>

                    {dbError && (
                        <div className="shrink-0 bg-red-50 border-b border-red-200 px-4 py-2">
                            <div className="flex items-center gap-2 text-[11px] text-red-700 font-bold mb-1">
                                <AlertCircle size={14} /> Error al cargar inventario
                                {dbErrorMsg && <span className="font-normal text-red-600">— {dbErrorMsg}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-red-600 font-bold">Abre la consola del navegador (F12) para ver el error exacto.</span>
                            </div>
                        </div>
                    )}

                    {/* ── CONTENIDO ── */}
                    <div className="flex-1 overflow-auto" onContextMenu={e=>handleCtx(e)}>
                {loading?(
                    <div className="flex items-center justify-center h-32 text-slate-400"><Loader2 size={18} className="animate-spin mr-2"/><span className="text-[11px] font-bold">Cargando...</span></div>
                ):filtered.length===0?(
                    <div className="flex flex-col items-center justify-center h-32 text-slate-400"><Archive size={28} className="mb-2 opacity-30"/><p className="text-[11px] font-bold">SIN REGISTROS</p><button onClick={openNew} className="mt-2 text-[10px] text-[#106EBE] font-black underline">+ Agregar ítem</button></div>
                ):viewMode==='list'?(
                    /* ── VISTA LISTA ── */
                    <table className="w-full border-collapse text-left">
                        <thead className="sticky top-0 z-10"><tr className="bg-[#f0f0f0] border-b border-gray-300">
                            <th className="w-6 px-2 py-1 border-r border-gray-300"/>
                            <th className="w-10 px-2 py-1 border-r border-gray-300 text-[10px] font-bold text-slate-700">Foto</th>
                            <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-bold text-slate-700">Nombre</th>
                            <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-bold text-slate-700">Código</th>
                            <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-bold text-slate-700">Categoría</th>
                            {activeTab==='utensilio'&&<th className="px-3 py-1 border-r border-gray-300 text-[10px] font-bold text-slate-700">Marca</th>}
                            <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-bold text-slate-700 text-center">{activeTab==='insumo'?'Stock':'Cant.'}</th>
                            <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-bold text-slate-700">Estado</th>
                            <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-bold text-slate-700">Ubicación</th>
                            {activeTab==='insumo'&&<th className="px-3 py-1 border-r border-gray-300 text-[10px] font-bold text-slate-700">Días rest.</th>}
                            <th className="px-3 py-1 text-[10px] font-bold text-slate-700 text-center">Acciones</th>
                        </tr></thead>
                        <tbody>{filtered.map((item,idx)=>{
                            const st=getAlertStatus(item);
                            const isSelected=selectedIds.has(item.id);
                            const stockVal=activeTab==='insumo'?item.stock_actual:item.cantidad_total;
                            const dias=item.consumo_diario_promedio>0?Math.floor(item.stock_actual/item.consumo_diario_promedio):null;
                            return(
                                <tr key={item.id} onClick={()=>toggleSelect(item.id)} onContextMenu={e=>handleCtx(e,item)}
                                    className={`border-b border-gray-200 cursor-default transition-colors ${isSelected?'bg-[#cce5ff]':idx%2===0?'bg-white hover:bg-[#f0f7ff]':'bg-[#f8f8f8] hover:bg-[#f0f7ff]'}`}>
                                    <td className="px-2 py-1 border-r border-gray-200">
                                        <div className={`w-3.5 h-3.5 border flex items-center justify-center mx-auto ${isSelected?'bg-[#106EBE] border-[#106EBE] text-white':'bg-white border-gray-300'}`}>
                                            {isSelected&&<Check size={10} strokeWidth={4}/>}
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 border-r border-gray-200">
                                        {item.imagen_principal_url?<img src={item.imagen_principal_url} alt="" className="w-8 h-8 object-cover border border-gray-300 cursor-pointer" onClick={e=>{e.stopPropagation();loadPhotosForView(item);}}/>
                                        :<div className="w-8 h-8 bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-300">{activeTab==='insumo'?<Package size={12}/>:<Wrench size={12}/>}</div>}
                                    </td>
                                    <td className="px-3 py-1 border-r border-gray-200"><span className="text-[11px] font-bold text-slate-800">{item.nombre}</span></td>
                                    <td className="px-3 py-1 border-r border-gray-200"><span className="text-[10px] font-mono text-slate-400">{item.codigo}</span></td>
                                    <td className="px-3 py-1 border-r border-gray-200"><span className="text-[10px] text-slate-600">{item.categoria_nombre||'—'}</span></td>
                                    {activeTab==='utensilio'&&<td className="px-3 py-1 border-r border-gray-200"><span className="text-[10px] text-slate-600">{item.marca||'—'}</span></td>}
                                    <td className="px-3 py-1 border-r border-gray-200 text-center">
                                        <div className="flex items-center justify-center gap-1" onClick={e=>e.stopPropagation()}>
                                            <button onClick={()=>handleQuickSave((activeTab==='insumo'?item.stock_actual:item.cantidad_total)-1)} className="w-4 h-4 bg-gray-200 hover:bg-red-100 border border-gray-300 text-[10px] font-black flex items-center justify-center">−</button>
                                            <span onClick={()=>openQuick(item)} className={`text-[12px] font-black w-8 text-center cursor-pointer hover:bg-gray-100 ${st==='empty'?'text-red-600':st==='critical'?'text-orange-600':st==='low'?'text-amber-600':'text-slate-800'}`}>{fmtNum(stockVal)}</span>
                                            <button onClick={()=>handleQuickSave((activeTab==='insumo'?item.stock_actual:item.cantidad_total)+1)} className="w-4 h-4 bg-gray-200 hover:bg-emerald-100 border border-gray-300 text-[10px] font-black flex items-center justify-center">+</button>
                                        </div>
                                    </td>
                                    <td className="px-3 py-1 border-r border-gray-200">
                                        {activeTab==='insumo'
                                            ?<span className={`inline-block px-1.5 py-0.5 text-[8px] font-black uppercase ${ALERT_BADGE[st]}`}>{ALERT_LABEL[st]}</span>
                                            :<span className={`inline-block px-1.5 py-0.5 text-[8px] font-black uppercase ${ESTADOS_U.find(e=>e.v===item.estado)?.cls||'bg-gray-400 text-white'}`}>{ESTADOS_U.find(e=>e.v===item.estado)?.l||item.estado}</span>
                                        }
                                    </td>
                                    <td className="px-3 py-1 border-r border-gray-200"><span className="text-[10px] text-slate-600">{item.ubicacion||'—'}</span></td>
                                    {activeTab==='insumo'&&<td className="px-3 py-1 border-r border-gray-200">
                                        {dias!==null?<span className={`text-[10px] font-bold ${dias<=3?'text-red-600':dias<=7?'text-amber-600':'text-slate-600'}`}>{dias}d</span>:<span className="text-[9px] text-slate-300">—</span>}
                                    </td>}
                                    <td className="px-3 py-1" onClick={e=>e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-0.5">
                                            <button onClick={()=>loadPhotosForView(item)} title="Ver" className="p-0.5 hover:bg-blue-100 text-slate-400 hover:text-blue-600"><Eye size={12}/></button>
                                            <button onClick={()=>openEdit(item)} title="Editar" className="p-0.5 hover:bg-amber-100 text-slate-400 hover:text-amber-600"><Edit2 size={12}/></button>
                                            <button onClick={()=>openMovForm(item)} title="Movimiento" className="p-0.5 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600"><ArrowUpCircle size={12}/></button>
                                            <button onClick={()=>handleDelete(item.id)} title="Eliminar" className="p-0.5 hover:bg-red-100 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}</tbody>
                    </table>
                ):(
                    /* ── VISTA TARJETAS ── */
                    <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {filtered.map(item=>{
                            const st=getAlertStatus(item);
                            const stockVal=activeTab==='insumo'?item.stock_actual:item.cantidad_total;
                            const pct=activeTab==='insumo'&&item.stock_maximo>0?Math.min(100,(item.stock_actual/item.stock_maximo)*100):0;
                            return(
                                <div key={item.id} onContextMenu={e=>handleCtx(e,item)} className="bg-white border border-gray-300 flex flex-col overflow-hidden hover:border-[#106EBE] transition-colors cursor-default">
                                    {item.imagen_principal_url
                                        ?<img src={item.imagen_principal_url} alt="" className="w-full h-24 object-cover cursor-pointer" onClick={()=>loadPhotosForView(item)}/>
                                        :<div className="w-full h-24 bg-gray-100 flex items-center justify-center text-gray-200">{activeTab==='insumo'?<Package size={36}/>:<Wrench size={36}/>}</div>
                                    }
                                    <div className="p-2 flex-1 flex flex-col gap-1">
                                        <span className={`self-start px-1.5 py-0.5 text-[8px] font-black uppercase ${activeTab==='insumo'?ALERT_BADGE[st]:ESTADOS_U.find(e=>e.v===item.estado)?.cls||'bg-gray-400 text-white'}`}>
                                            {activeTab==='insumo'?ALERT_LABEL[st]:ESTADOS_U.find(e=>e.v===item.estado)?.l}
                                        </span>
                                        <p className="text-[11px] font-black text-slate-800 leading-tight">{item.nombre}</p>
                                        <p className="text-[9px] text-slate-400">{item.codigo} · {item.categoria_nombre||'—'}</p>
                                        {activeTab==='insumo'&&<><div className="h-1.5 bg-gray-200"><div className={`h-full ${st==='empty'?'bg-red-600':st==='critical'?'bg-orange-600':st==='low'?'bg-amber-500':'bg-[#106EBE]'}`} style={{width:`${pct}%`}}/></div></>}
                                        <div className="flex justify-between items-center">
                                            <span className={`text-[13px] font-black ${st==='empty'?'text-red-600':st==='critical'?'text-orange-600':st==='low'?'text-amber-600':'text-slate-800'}`}>{fmtNum(stockVal)}</span>
                                            <span className="text-[9px] text-slate-400">{activeTab==='insumo'?item.unidad_medida||'u.':item.marca||''}</span>
                                        </div>
                                        <p className="text-[9px] text-slate-400">{item.ubicacion||'—'}</p>
                                        <div className="flex gap-1 mt-auto pt-1" onClick={e=>e.stopPropagation()}>
                                            <button onClick={()=>loadPhotosForView(item)} className="flex-none p-1 bg-gray-100 border border-gray-200 hover:bg-blue-50 text-slate-500"><Eye size={10}/></button>
                                            <button onClick={()=>openMovForm(item)} className="flex-1 py-1 bg-[#106EBE] text-white text-[9px] font-black hover:bg-[#0d5aa0] border border-[#0d5aa0]">+Mov</button>
                                            <button onClick={()=>openEdit(item)} className="flex-none p-1 bg-gray-100 border border-gray-200 hover:bg-amber-50 text-slate-500"><Edit2 size={10}/></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── STATUS BAR ── */}
            <div className="shrink-0 bg-[#f0f0f0] border-t border-gray-300 flex items-center gap-4 px-3 py-0.5">
                <span className="text-[9px] text-slate-500 font-bold">{filtered.length} registro(s)</span>
                {selectedIds.size>0&&<span className="text-[9px] text-[#106EBE] font-bold">{selectedIds.size} seleccionado(s)</span>}
                <div className="flex-1"/>
                <span className="text-[9px] text-slate-400">{activeTab==='insumo'?'INSUMOS Y SUMINISTROS':'UTENSILIOS DE COCINA'} — Las Palmas POS</span>
            </div>
                </div>{/* fin flex-1 columna contenido */}
            </div>{/* fin flex layout sidebar+contenido */}

            {/* ══ CONTEXT MENU ══ */}
            {ctxMenu&&typeof document!=='undefined'&&createPortal(
                <div style={{position:'fixed',top:ctxMenu.y,left:ctxMenu.x,zIndex:200001}} className="bg-white border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] min-w-[180px] py-0.5 select-none animate-in fade-in zoom-in duration-75" onClick={e=>e.stopPropagation()}>
                    <CtxItem icon={FilePlus} label="Nuevo ítem" onClick={openNew}/>
                    <CtxItem icon={FolderPlus} label="Nueva categoría" onClick={()=>setShowCatModal(true)}/>
                    {ctxMenu.item&&<>
                        <div className="h-px bg-gray-200 my-0.5"/>
                        <CtxItem icon={Eye} label="Ver Detalle / Info" onClick={()=>loadPhotosForView(ctxMenu.item!)}/>
                        <CtxItem icon={Pencil} label="Editar Producto" onClick={()=>openEdit(ctxMenu.item!)}/>
                        <CtxItem icon={ArrowUpCircle} label="Registrar Movimiento" onClick={()=>openMovForm(ctxMenu.item!)}/>
                        <div className="h-px bg-gray-200 my-0.5"/>
                        <CtxItem icon={Trash2} label="Eliminar Permanente" onClick={()=>handleDelete(ctxMenu.item!.id)} danger/>
                    </>}
                </div>,
                document.body
            )}

            {/* ══ MODAL FORMULARIO ══ */}
            {showForm&&typeof document!=='undefined'&&createPortal(
                <div className="fixed inset-0 z-[190000] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[740px] max-h-[94vh] bg-[#f0f0f0] shadow-[0_0_40px_rgba(0,0,0,0.4)] border border-[#106EBE] flex flex-col pointer-events-auto overflow-hidden animate-slide-up">
                            <div className="modal-header bg-[#106EBE] h-9 px-3 flex justify-between items-center cursor-move select-none shrink-0 border-b border-[#0d5aa0]">
                                <div className="flex items-center gap-2">
                                    {activeTab==='insumo'?<Package size={15} className="text-white"/>:<Wrench size={15} className="text-white"/>}
                                    <span className="text-white text-[13px] font-bold tracking-tight uppercase">Mantenimiento de {activeTab==='insumo'?'Insumo':'Utensilio'} {form.nombre && `— ${form.nombre}`}</span>
                                </div>
                                <button onClick={()=>setShowForm(false)} className="w-9 h-9 flex items-center justify-center hover:bg-red-500 text-white transition-all"><X size={20} strokeWidth={2.5}/></button>
                            </div>
                            {/* Form tabs */}
                            <div className="flex shrink-0 border-b border-gray-300 bg-[#f0f0f0] px-3 pt-1 gap-1">
                                {([
                                    {id:'info',label:'Información',icon:Info},
                                    {id:'stock',label:activeTab==='insumo'?'Stock':'Cantidades',icon:Boxes},
                                    {id:'fotos',label:'Imágenes',icon:ImagePlus},
                                    {id:'compra',label:'Compra/Proveedor',icon:ShoppingBag},
                                    ...(editingItem?[{id:'historial',label:'Historial',icon:History}]:[]),
                                ] as {id:FormTab;label:string;icon:any}[]).map(t=>(
                                    <button key={t.id} onClick={()=>setFormTab(t.id)}
                                        className={`flex items-center gap-1 px-3 py-1 text-[10px] font-bold border border-b-0 transition-colors ${formTab===t.id?'bg-white border-gray-300 text-[#106EBE]':'bg-[#e8e8e8] border-gray-300 text-slate-500 hover:bg-[#ebebeb]'}`}>
                                        <t.icon size={10}/>{t.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                {/* ── TAB INFO ── */}
                                {formTab==='info'&&<div className="space-y-4">
                                    <Fieldset title="Información Básica">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2"><FLabel>Nombre *</FLabel><input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} className={IC} placeholder={activeTab==='insumo'?'Ej: Bolsas plásticas medianas':'Ej: Sartén antiadherente 30cm'}/></div>
                                            <div><FLabel>Código</FLabel><input value={form.codigo} readOnly className={IC+' bg-gray-100 text-slate-500'}/></div>
                                            <div><FLabel>Categoría</FLabel>
                                                <div className="flex gap-1">
                                                    <select value={form.categoria_id||''} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value||null}))} className={IC}>
                                                        <option value="">Seleccionar</option>
                                                        {tabCats.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                                                    </select>
                                                    <button onClick={()=>setShowCatModal(true)} className="px-2 bg-white border border-gray-400 hover:bg-gray-100 text-[#106EBE] font-bold">+</button>
                                                </div>
                                            </div>
                                            {activeTab==='insumo'&&<div><FLabel>Stock Actual</FLabel><input type="number" value={form.stock_actual} onChange={e=>setForm(f=>({...f,stock_actual:Number(e.target.value)}))} className={IC}/></div>}
                                            {activeTab==='utensilio'&&<><div><FLabel>Marca</FLabel><input value={form.marca} onChange={e=>setForm(f=>({...f,marca:e.target.value}))} className={IC}/></div>
                                            <div><FLabel>Modelo</FLabel><input value={form.modelo} onChange={e=>setForm(f=>({...f,modelo:e.target.value}))} className={IC}/></div>
                                            <div><FLabel>Material</FLabel><select value={form.material} onChange={e=>setForm(f=>({...f,material:e.target.value}))} className={IC}><option value="">Seleccionar</option>{MATERIALES.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                                            <div><FLabel>Tamaño / Capacidad</FLabel><input value={form.tamano_capacidad} onChange={e=>setForm(f=>({...f,tamano_capacidad:e.target.value}))} className={IC} placeholder="Ej: 30cm diámetro"/></div>
                                            <div><FLabel>Vida útil (años)</FLabel><input type="number" min={1} value={form.vida_util_anos} onChange={e=>setForm(f=>({...f,vida_util_anos:Number(e.target.value)}))} className={IC}/></div>
                                            <div><FLabel>Próxima revisión</FLabel><input type="date" value={form.fecha_proxima_revision||''} onChange={e=>setForm(f=>({...f,fecha_proxima_revision:e.target.value}))} className={IC}/></div>
                                            <div><FLabel>Estado</FLabel><select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))} className={IC}>{ESTADOS_U.map(e=><option key={e.v} value={e.v}>{e.l}</option>)}</select></div></>}
                                            {activeTab==='insumo'&&<><div><FLabel>Unidad de medida</FLabel><select value={form.unidad_medida} onChange={e=>setForm(f=>({...f,unidad_medida:e.target.value}))} className={IC}>{UNIDADES.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
                                            <div><FLabel>Contenido por unidad</FLabel><input value={form.contenido_por_unidad} onChange={e=>setForm(f=>({...f,contenido_por_unidad:e.target.value}))} className={IC} placeholder="Ej: Caja de 100"/></div></>}
                                            <div><FLabel>Ubicación</FLabel><select value={form.ubicacion} onChange={e=>setForm(f=>({...f,ubicacion:e.target.value}))} className={IC}><option value="">Seleccionar</option>{(activeTab==='insumo'?UBICACIONES_I:UBICACIONES_U).map(u=><option key={u} value={u}>{u}</option>)}</select></div>
                                            <div className="col-span-2"><FLabel>Notas</FLabel><textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} rows={2} className={IC+' resize-none'}/></div>
                                        </div>
                                    </Fieldset>
                                </div>}

                                {/* ── TAB STOCK ── */}
                                {formTab==='stock'&&<div className="space-y-4">
                                    {activeTab==='insumo'?<Fieldset title="Control de Stock">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div><FLabel>Stock actual</FLabel><input type="number" min={0} value={form.stock_actual} onChange={e=>setForm(f=>({...f,stock_actual:Number(e.target.value)}))} className={IC}/></div>
                                            <div><FLabel>Stock mínimo (alerta)</FLabel><input type="number" min={0} value={form.stock_minimo} onChange={e=>setForm(f=>({...f,stock_minimo:Number(e.target.value)}))} className={IC}/></div>
                                            <div><FLabel>Stock máximo</FLabel><input type="number" min={0} value={form.stock_maximo} onChange={e=>setForm(f=>({...f,stock_maximo:Number(e.target.value)}))} className={IC}/></div>
                                            <div><FLabel>Consumo promedio/día</FLabel><input type="number" min={0} step={0.1} value={form.consumo_diario_promedio} onChange={e=>setForm(f=>({...f,consumo_diario_promedio:Number(e.target.value)}))} className={IC}/></div>
                                        </div>
                                        {form.stock_maximo>0&&<div className="mt-3"><div className="flex justify-between text-[9px] text-slate-500 font-bold mb-1"><span>0</span><span>Stock: {form.stock_actual}/{form.stock_maximo}</span><span>{form.stock_maximo}</span></div>
                                            <div className="h-2 bg-gray-200 border border-gray-300"><div className={`h-full transition-all ${form.stock_actual<=0?'bg-red-600':form.stock_actual<=form.stock_minimo?'bg-amber-500':'bg-[#106EBE]'}`} style={{width:`${Math.min(100,(form.stock_actual/form.stock_maximo)*100)}%`}}/></div>
                                        </div>}
                                    </Fieldset>:<Fieldset title="Control de Cantidades">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><FLabel>Total en existencia</FLabel><input type="number" min={0} value={form.cantidad_total} onChange={e=>setForm(f=>({...f,cantidad_total:Number(e.target.value)}))} className={IC}/></div>
                                            <div><FLabel>En uso (servicio activo)</FLabel><input type="number" min={0} value={form.cantidad_en_uso} onChange={e=>setForm(f=>({...f,cantidad_en_uso:Number(e.target.value)}))} className={IC}/></div>
                                            <div><FLabel>En bodega</FLabel><input type="number" min={0} value={form.cantidad_bodega} onChange={e=>setForm(f=>({...f,cantidad_bodega:Number(e.target.value)}))} className={IC}/></div>
                                            <div><FLabel>En reparación / baja</FLabel><input type="number" min={0} value={form.cantidad_reparacion} onChange={e=>setForm(f=>({...f,cantidad_reparacion:Number(e.target.value)}))} className={IC}/></div>
                                            <div><FLabel>Cantidad mínima requerida</FLabel><input type="number" min={1} value={form.cantidad_minima} onChange={e=>setForm(f=>({...f,cantidad_minima:Number(e.target.value)}))} className={IC}/></div>
                                            <div><FLabel>Fecha adquisición</FLabel><input type="date" value={form.fecha_adquisicion||''} onChange={e=>setForm(f=>({...f,fecha_adquisicion:e.target.value}))} className={IC}/></div>
                                            <div><FLabel>Costo adquisición (Q)</FLabel><input type="number" min={0} step={0.01} value={form.costo_adquisicion} onChange={e=>setForm(f=>({...f,costo_adquisicion:Number(e.target.value)}))} className={IC}/></div>
                                        </div>
                                        {(form.cantidad_en_uso+form.cantidad_bodega+form.cantidad_reparacion)!==form.cantidad_total&&form.cantidad_total>0&&(
                                            <p className="mt-2 text-[10px] font-bold text-amber-600 flex items-center gap-1"><AlertTriangle size={11}/>En uso+Bodega+Reparación = {form.cantidad_en_uso+form.cantidad_bodega+form.cantidad_reparacion} ≠ Total {form.cantidad_total}</p>
                                        )}
                                    </Fieldset>}
                                </div>}

                                {/* ── TAB FOTOS ── */}
                                {formTab==='fotos'&&<div className="space-y-4">
                                    <Fieldset title={`Fotos — Máx. 5 · JPG, PNG, WEBP, HEIC${activeTab==='utensilio'?' · Historial fotográfico con fecha':''}`}>
                                        <div className="flex items-start gap-3 flex-wrap mt-2">
                                            {formPhotos.map((ph,idx)=>(
                                                <div key={ph.id} className="relative group flex flex-col items-center">
                                                    <div className="relative">
                                                        <img src={ph.url} alt="" className="w-20 h-20 object-cover border border-gray-400 cursor-pointer" onClick={()=>window.open(ph.url,'_blank')}/>
                                                        <span className={`absolute top-0 right-0 text-[7px] font-black px-1 py-0.5 ${ph.tipo==='principal'?'bg-[#106EBE] text-white':ph.tipo==='estado'?'bg-orange-600 text-white':ph.tipo==='baja'?'bg-red-700 text-white':'bg-gray-700 text-white'}`}>{ph.tipo}</span>
                                                        <button onClick={()=>deletePhoto(ph.id)} className="absolute bottom-0 left-0 w-full bg-red-600/80 text-white text-[8px] font-black py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Eliminar</button>
                                                    </div>
                                                    <p className="text-[8px] text-slate-500 mt-1 max-w-[80px] text-center truncate">{ph.descripcion||' '}</p>
                                                    <p className="text-[8px] text-slate-400">{new Date(ph.fecha_foto).toLocaleDateString('es-GT')}</p>
                                                </div>
                                            ))}
                                            {formPhotos.length<5&&(
                                                <button onClick={()=>fileInputRef.current?.click()} disabled={uploadingImg}
                                                    className="w-20 h-20 border-2 border-dashed border-gray-400 flex flex-col items-center justify-center text-gray-400 hover:border-[#106EBE] hover:text-[#106EBE] gap-1 text-[8px] transition-colors">
                                                    {uploadingImg?<Loader2 size={18} className="animate-spin"/>:<Camera size={18}/>}
                                                    {uploadingImg?'Procesando...':'📷 Agregar foto'}
                                                </button>
                                            )}
                                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" className="hidden" onChange={handleFileSelect}/>
                                        </div>
                                        <p className="text-[9px] text-slate-400 mt-2">Compresión automática a máx. 800kb · Compatible con cámara del teléfono · Al seleccionar se pregunta el tipo de foto</p>
                                        {activeTab==='utensilio'&&<p className="text-[9px] text-amber-600 font-bold mt-1">💡 Para utensilios: carga fotos de "estado" periódicamente para comparar el deterioro con el tiempo</p>}
                                    </Fieldset>
                                </div>}

                                {/* ── TAB COMPRA ── */}
                                {formTab==='compra'&&<Fieldset title="Información de Compra y Proveedor">
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        <div className="col-span-2"><FLabel>Proveedor habitual</FLabel><input value={''} onChange={()=>{}} placeholder="Nombre del proveedor" className={IC}/><p className="text-[9px] text-slate-400 mt-0.5">Próximamente: selector desde módulo de Proveedores</p></div>
                                        <div><FLabel>Precio de compra (Q)</FLabel><input type="number" min={0} step={0.01} value={form.precio_compra} onChange={e=>setForm(f=>({...f,precio_compra:Number(e.target.value)}))} className={IC}/></div>
                                        <div><FLabel>Precio unitario mínimo (Q)</FLabel><input type="number" min={0} step={0.01} value={form.precio_unitario_minimo} onChange={e=>setForm(f=>({...f,precio_unitario_minimo:Number(e.target.value)}))} className={IC}/></div>
                                        <div><FLabel>Última compra</FLabel><input type="date" value={form.fecha_ultima_compra||''} onChange={e=>setForm(f=>({...f,fecha_ultima_compra:e.target.value}))} className={IC}/></div>
                                        <div><FLabel>Días entre compras</FLabel><input type="number" min={1} value={form.dias_entre_compras} onChange={e=>setForm(f=>({...f,dias_entre_compras:Number(e.target.value)}))} className={IC}/></div>
                                    </div>
                                </Fieldset>}

                                {/* ── TAB HISTORIAL ── */}
                                {formTab==='historial'&&editingItem&&<HistorialTab itemId={editingItem.id}/>}
                            </div>
                            <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 bg-[#f0f0f0] border-t border-gray-300">
                                <button onClick={()=>setShowForm(false)} className="px-5 py-1 text-[12px] font-bold bg-white border border-gray-400 hover:bg-gray-100 text-slate-700 shadow-sm transition-all active:scale-95">Cancelar y Salir</button>
                                <button 
                                    onClick={handleSave} 
                                    disabled={saving||!form.nombre.trim()} 
                                    className="flex items-center gap-2 px-6 py-1 bg-[#106EBE] hover:bg-[#0d5aa0] text-white text-[12px] font-bold border border-[#0d5aa0] shadow-md disabled:opacity-50 transition-all active:scale-95 group"
                                >
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={14} className="group-hover:scale-110 transition-transform" />}
                                    {saving ? 'Procesando...' : editingItem ? 'Actualizar Registro' : 'Guardar Nuevo Ítem'}
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL TIPO DE FOTO ══ */}
            {photoTypeModal.show&&typeof document!=='undefined'&&createPortal(
                <div className="fixed inset-0 z-[199999] flex items-center justify-center bg-black/20 pointer-events-auto">
                    <div className="w-[380px] bg-[#f0f0f0] border border-[#106EBE] shadow-xl pointer-events-auto">
                        <div className="bg-[#106EBE] h-8 px-3 flex items-center gap-2">
                            <ImagePlus size={13} className="text-white"/><span className="text-white text-[12px] font-bold">¿Qué tipo de foto es esta?</span>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    {v:'principal',l:'📷 Principal',desc:'Foto de catálogo del ítem'},
                                    {v:'estado',l:'📋 Estado actual',desc:'Checkpoint de condición actual'},
                                    {v:'adquisicion',l:'🛒 Adquisición',desc:'Foto al momento de compra'},
                                    {v:'baja',l:'⚠ Evidencia de baja',desc:'Foto de rotura, pérdida, etc.'},
                                ].map(t=>(
                                    <button key={t.v} onClick={()=>setSelectedPhotoType(t.v)}
                                        className={`p-2 border-2 text-left transition-all ${selectedPhotoType===t.v?'border-[#106EBE] bg-blue-50':'border-gray-300 bg-white hover:border-gray-400'}`}>
                                        <p className="text-[11px] font-black text-slate-800">{t.l}</p>
                                        <p className="text-[9px] text-slate-500 mt-0.5">{t.desc}</p>
                                    </button>
                                ))}
                            </div>
                            <div><FLabel>Descripción opcional</FLabel><input value={photoDesc} onChange={e=>setPhotoDesc(e.target.value)} placeholder="Ej: Foto del 10/04/2025 — estado regular" className={IC}/></div>
                            <div className="flex gap-2">
                                <button onClick={()=>setPhotoTypeModal({file:null,show:false})} className="flex-1 py-1 text-[11px] font-bold bg-white border border-gray-400 text-slate-700 hover:bg-gray-100">Cancelar</button>
                                <button onClick={confirmPhotoUpload} className="flex-1 py-1 text-[11px] font-bold bg-[#106EBE] text-white border border-[#0d5aa0] hover:bg-[#0d5aa0]">Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ══ MODAL MOVIMIENTO ══ */}
            {showMovForm&&movItem&&typeof document!=='undefined'&&createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[460px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none">
                                <div className="flex items-center gap-2"><ArrowUpCircle size={13} className="text-white"/><span className="text-white text-[12px] font-bold">Registrar Movimiento — {movItem.nombre}</span></div>
                                <button onClick={()=>setShowMovForm(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white"><X size={18} strokeWidth={2.5}/></button>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="bg-white border border-gray-300 px-3 py-2 text-[11px] font-bold text-slate-600 flex items-center gap-2">
                                    Stock actual: <span className="text-[15px] font-black text-[#106EBE]">{activeTab==='insumo'?movItem.stock_actual:movItem.cantidad_total}</span> <span className="text-slate-400">{movItem.unidad_medida||'uds'}</span>
                                </div>
                                <Fieldset title="Datos del Movimiento">
                                    <div className="grid grid-cols-2 gap-3 mt-1">
                                        <div><FLabel>Tipo de movimiento</FLabel>
                                            <select value={movForm.tipo} onChange={e=>setMovForm(f=>({...f,tipo:e.target.value}))} className={IC}>
                                                <option value="entrada">▲ Entrada — aumenta stock</option>
                                                <option value="salida">▼ Salida — reduce stock</option>
                                                <option value="ajuste">⟳ Ajuste — nuevo total</option>
                                            </select>
                                        </div>
                                        <div><FLabel>Cantidad</FLabel><input type="number" min={0} value={movForm.cantidad} onChange={e=>setMovForm(f=>({...f,cantidad:e.target.value}))} className={IC} autoFocus/></div>
                                        <div><FLabel>Motivo</FLabel>
                                            <select value={movForm.motivo} onChange={e=>setMovForm(f=>({...f,motivo:e.target.value}))} className={IC}>
                                                {MOTIVOS.map(m=><option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
                                            </select>
                                        </div>
                                        <div><FLabel>N° Factura</FLabel><input value={movForm.referencia} onChange={e=>setMovForm(f=>({...f,referencia:e.target.value}))} className={IC} placeholder="Opcional"/></div>
                                        <div className="col-span-2"><FLabel>Notas</FLabel><input value={movForm.notas} onChange={e=>setMovForm(f=>({...f,notas:e.target.value}))} className={IC}/></div>
                                    </div>
                                    {movForm.cantidad&&<div className="mt-2 bg-white border border-gray-300 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                                        Resultado: <span className="text-[15px] font-black text-[#106EBE]">
                                            {movForm.tipo==='entrada'?(activeTab==='insumo'?movItem.stock_actual:movItem.cantidad_total)+Number(movForm.cantidad):movForm.tipo==='salida'?Math.max(0,(activeTab==='insumo'?movItem.stock_actual:movItem.cantidad_total)-Number(movForm.cantidad)):Number(movForm.cantidad)}
                                        </span>
                                    </div>}
                                </Fieldset>
                            </div>
                            <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-gray-300 bg-[#f0f0f0]">
                                <button onClick={()=>setShowMovForm(false)} className="px-4 py-1 text-[11px] font-bold bg-white border border-gray-400 text-slate-700 hover:bg-gray-100">Cancelar</button>
                                <button onClick={handleMovSave} disabled={saving||!movForm.cantidad} className="flex items-center gap-1.5 px-5 py-1 bg-[#106EBE] text-white text-[11px] font-bold border border-[#0d5aa0] disabled:opacity-50">
                                    {saving?<Loader2 size={12} className="animate-spin"/>:<Save size={12}/>} Registrar
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL AJUSTE RÁPIDO ══ */}
            {showQuick&&quickItem&&typeof document!=='undefined'&&createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[340px] bg-[#f0f0f0] border border-[#106EBE] shadow-[0_0_30px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none shrink-0">
                                <span className="text-white text-[12px] font-bold">Ajustar: {quickItem.nombre}</span>
                                <button onClick={()=>setShowQuick(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white"><X size={18} strokeWidth={2.5}/></button>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between bg-white border border-gray-300 px-3 py-2">
                                    <span className="text-[11px] font-bold text-slate-600">Stock actual</span>
                                    <span className="text-[18px] font-black text-[#106EBE]">{activeTab==='insumo'?quickItem.stock_actual:quickItem.cantidad_total}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={()=>setQuickDelta(String(Math.max(1,Number(quickDelta)-1)))} className="shrink-0 w-10 h-10 bg-white border border-gray-400 text-[18px] font-black hover:bg-red-50 flex items-center justify-center">−</button>
                                    <input type="number" min={0} value={quickDelta} onChange={e=>setQuickDelta(e.target.value)} className="w-full h-10 text-center text-[22px] font-black text-[#106EBE] border-2 border-[#106EBE] outline-none" autoFocus/>
                                    <button onClick={()=>setQuickDelta(String(Number(quickDelta)+1))} className="shrink-0 w-10 h-10 bg-white border border-gray-400 text-[18px] font-black hover:bg-emerald-50 flex items-center justify-center">+</button>
                                </div>
                                <div><FLabel>Motivo</FLabel>
                                    <select value={quickMotivo} onChange={e=>setQuickMotivo(e.target.value)} className={IC}>
                                        {MOTIVOS.map(m=><option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={()=>handleQuickSave(-Number(quickDelta))} disabled={Number(quickDelta)===0} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-600 text-white text-[11px] font-bold border border-red-700 hover:bg-red-700 disabled:opacity-40">
                                        <ArrowDownCircle size={12}/> Salida −{quickDelta}
                                    </button>
                                    <button onClick={()=>handleQuickSave(Number(quickDelta))} disabled={Number(quickDelta)===0} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600 text-white text-[11px] font-bold border border-emerald-700 hover:bg-emerald-700 disabled:opacity-40">
                                        <ArrowUpCircle size={12}/> Entrada +{quickDelta}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL CONTEO FÍSICO ══ */}
            {showPhysical&&typeof document!=='undefined'&&createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[680px] max-h-[90vh] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none">
                                <div className="flex items-center gap-2"><ClipboardList size={13} className="text-white"/><span className="text-white text-[12px] font-bold">Conteo Físico — {new Date().toLocaleDateString('es-GT')}</span></div>
                                <button onClick={()=>setShowPhysical(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white"><X size={18}/></button>
                            </div>
                            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
                                <div className="flex-1"><FLabel>Responsable del conteo</FLabel><input value={physResponsable} onChange={e=>setPhysResponsable(e.target.value)} placeholder="Nombre del responsable" className="px-2 py-1 text-[11px] border border-gray-400 bg-white w-48 outline-none focus:border-[#106EBE] h-7"/></div>
                                <p className="text-[10px] font-bold text-amber-700">Ingrese la cantidad REAL contada. Solo se actualizan los ítems modificados.</p>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <table className="w-full border-collapse">
                                    <thead className="sticky top-0"><tr className="bg-[#f0f0f0] border-b border-gray-300">
                                        <th className="px-3 py-1 text-[10px] font-bold text-slate-700 border-r border-gray-300">Código</th>
                                        <th className="px-3 py-1 text-[10px] font-bold text-slate-700 border-r border-gray-300">Nombre</th>
                                        <th className="px-3 py-1 text-[10px] font-bold text-slate-700 border-r border-gray-300 text-center">Sistema</th>
                                        <th className="px-3 py-1 text-[10px] font-bold text-slate-700 border-r border-gray-300 text-center">Contado</th>
                                        <th className="px-3 py-1 text-[10px] font-bold text-slate-700 text-center">Diferencia</th>
                                    </tr></thead>
                                    <tbody>{items.map((item,idx)=>{
                                        const val=physCounts[item.id];
                                        const sys=activeTab==='insumo'?item.stock_actual:item.cantidad_total;
                                        const diff=val!==undefined&&val!==''?Number(val)-sys:null;
                                        return(
                                            <tr key={item.id} className={`border-b border-gray-200 ${idx%2===0?'bg-white':'bg-[#f8f8f8]'}`}>
                                                <td className="px-3 py-1 border-r border-gray-200 text-[10px] font-mono text-slate-400">{item.codigo}</td>
                                                <td className="px-3 py-1 border-r border-gray-200 text-[11px] font-bold text-slate-800">{item.nombre}</td>
                                                <td className="px-3 py-1 border-r border-gray-200 text-center text-[12px] font-black text-slate-600">{sys}</td>
                                                <td className="px-3 py-1 border-r border-gray-200 text-center">
                                                    <input type="number" min={0} placeholder="—" value={physCounts[item.id]||''} onChange={e=>setPhysCounts(p=>({...p,[item.id]:e.target.value}))} className="w-20 px-2 py-0.5 text-[11px] font-black border border-gray-400 text-center outline-none focus:border-[#106EBE] bg-white"/>
                                                </td>
                                                <td className="px-3 py-1 text-center">{diff!==null&&<span className={`text-[12px] font-black ${diff===0?'text-slate-400':diff>0?'text-emerald-600':'text-red-600'}`}>{diff>0?`+${diff}`:diff}</span>}</td>
                                            </tr>
                                        );
                                    })}</tbody>
                                </table>
                            </div>
                            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-300 bg-[#f0f0f0]">
                                <span className="text-[10px] font-bold text-slate-500">{Object.values(physCounts).filter(v=>v!=='').length} ítems ingresados</span>
                                <div className="flex gap-2">
                                    <button onClick={()=>setShowPhysical(false)} className="px-4 py-1 text-[11px] font-bold bg-white border border-gray-400 text-slate-700 hover:bg-gray-100">Cancelar</button>
                                    <button onClick={handlePhysicalSave} disabled={saving} className="flex items-center gap-1.5 px-5 py-1 bg-[#106EBE] text-white text-[11px] font-bold border border-[#0d5aa0] disabled:opacity-50">
                                        {saving?<Loader2 size={12} className="animate-spin"/>:<Save size={12}/>} Guardar Conteo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL LISTA DE COMPRAS ══ */}
            {showPurchase && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[195000] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[800px] max-h-[92vh] bg-[#f0f0f0] shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col pointer-events-auto overflow-hidden animate-slide-up text-slate-900">
                            <div className="modal-header bg-[#106EBE] h-9 px-3 flex justify-between items-center cursor-move select-none shrink-0 border-b border-[#0d5aa0]">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart size={15} className="text-white"/>
                                    <span className="text-white text-[13px] font-bold uppercase tracking-wide">Planeación de Abastecimiento — Sugerencia de Compras</span>
                                </div>
                                <button onClick={()=>setShowPurchase(false)} className="w-9 h-9 flex items-center justify-center hover:bg-red-500 text-white transition-all"><X size={20} strokeWidth={2.5}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 bg-[#f0f0f0]">
                                {purchaseItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 opacity-60">
                                        <CheckCircle2 size={48} className="mb-4 text-emerald-500"/>
                                        <p className="text-[14px] font-black uppercase tracking-widest">Inventario en Niveles Óptimos</p>
                                        <p className="text-[11px]">No se detectan faltantes ni alertas críticas en este momento.</p>
                                    </div>
                                ) : (
                                    <div className="bg-white border border-gray-300 shadow-sm overflow-hidden text-slate-900 rounded-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-[#f0f0f0] border-b border-gray-300 text-[10px] uppercase font-bold text-slate-700">
                                                    <th className="px-3 py-2 border-r border-gray-200">Producto / Insumo</th>
                                                    <th className="px-3 py-2 border-r border-gray-200 text-center w-24">Estado</th>
                                                    <th className="px-3 py-2 border-r border-gray-200 text-center w-24">Existencia</th>
                                                    <th className="px-3 py-2 border-r border-gray-200 text-center w-24">A Pedir</th>
                                                    <th className="px-3 py-2 text-right w-32">Total Sugerido</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {purchaseItems.map((item, idx) => {
                                                    const st = getAlertStatus(item);
                                                    const ap = Math.max(0, item.stock_maximo - item.stock_actual);
                                                    return (
                                                        <tr key={item.id} className={`border-b border-gray-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/50`}>
                                                            <td className="px-3 py-2 border-r border-gray-100">
                                                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none">{item.nombre}</p>
                                                                <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase italic">{item.categoria_nombre || 'General'} · {item.unidad_medida}</p>
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-gray-100 text-center">
                                                                <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black uppercase rounded-sm ${ALERT_BADGE[st]}`}>{ALERT_LABEL[st]}</span>
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-gray-100 text-center">
                                                                <span className={`text-[12px] font-black ${st === 'empty' ? 'text-red-600' : 'text-amber-600'}`}>{item.stock_actual}</span>
                                                                <span className="text-[9px] text-slate-400 font-bold ml-1">/{item.stock_minimo}</span>
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-gray-100 text-center">
                                                                <span className="text-[15px] font-black text-[#106EBE]">{ap}</span>
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-[12px] font-black text-slate-800 bg-slate-50/50">
                                                                {fmtQ(ap * (item.precio_compra || 0))}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-300 bg-emerald-50 font-black text-[14px]">
                                            <div className="flex flex-col">
                                                <span className="text-emerald-700 text-[9px] uppercase tracking-tighter leading-none">Inversión Estimada de Abastecimiento</span>
                                                <span className="text-emerald-800 uppercase">Total Global Sugerido</span>
                                            </div>
                                            <span className="text-emerald-700 text-[20px] tracking-tighter">
                                                {fmtQ(purchaseItems.reduce((s, i) => s + Math.max(0, i.stock_maximo - i.stock_actual) * (i.precio_compra || 0), 0))}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {purchaseItems.length > 0 && (
                                <div className="flex items-center gap-2 px-4 py-3 bg-[#f0f0f0] border-t border-gray-300 shrink-0">
                                    <button onClick={printPurchaseList} className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-400 text-[11px] font-black text-slate-700 hover:bg-gray-100 shadow-sm uppercase tracking-tighter transition-all active:scale-95"><Printer size={16}/> Comprobante PDF</button>
                                    <button onClick={sendWhatsApp} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white text-[11px] font-black border border-emerald-700 hover:bg-emerald-700 shadow-sm uppercase tracking-tighter transition-all active:scale-95"><MessageCircle size={16}/> Compra vía WhatsApp</button>
                                    <div className="flex-1" />
                                    <button onClick={exportCSV} className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-400 text-[11px] font-black text-slate-700 hover:bg-gray-100 shadow-sm uppercase tracking-tighter transition-all active:scale-95"><FileSpreadsheet size={16}/> Descargar Excel</button>
                                </div>
                            )}
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL DETALLE ══ */}
            {viewItem&&typeof document!=='undefined'&&createPortal(
                <div className="fixed inset-0 z-[192000] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[560px] max-h-[90vh] bg-[#f0f0f0] shadow-[0_0_40px_rgba(0,0,0,0.4)] border border-[#106EBE] flex flex-col pointer-events-auto overflow-hidden animate-slide-up">
                            <div className="modal-header bg-[#106EBE] h-9 px-3 flex justify-between items-center cursor-move select-none border-b border-[#0d5aa0]">
                                <div className="flex items-center gap-2">
                                    <Search size={14} className="text-white"/>
                                    <span className="text-white text-[13px] font-bold tracking-tight uppercase">Expediente del Ítem: {viewItem.nombre}</span>
                                </div>
                                <button onClick={()=>setViewItem(null)} className="w-9 h-9 flex items-center justify-center hover:bg-red-500 text-white transition-all"><X size={20} strokeWidth={2.5}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#f0f0f0]">
                                {/* Cabecera de Identificación */}
                                <div className="bg-white border border-gray-300 p-4 shadow-sm flex items-start gap-4">
                                    {viewItem.imagen_principal_url ? (
                                        <img src={viewItem.imagen_principal_url} alt="" className="w-24 h-24 object-cover border-2 border-slate-100 shadow-md" />
                                    ) : (
                                        <div className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                                            <Package size={32}/>
                                        </div>
                                    )}
                                    <div className="flex-1 flex flex-col">
                                        <span className="text-[10px] font-black text-[#106EBE] uppercase tracking-[0.2em] mb-1">{viewItem.categoria_nombre||'Sin Categoría'}</span>
                                        <h2 className="text-[18px] font-black text-slate-800 leading-tight mb-1">{viewItem.nombre}</h2>
                                        <p className="text-[11px] font-bold text-slate-400">SKU: {viewItem.codigo} · UBICACIÓN: {viewItem.ubicacion || 'N/A'}</p>
                                        <div className="flex items-center gap-3 mt-3">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Existencia Real</span>
                                                <span className="text-[18px] font-black text-slate-800 leading-none">{(activeTab==='insumo'?viewItem.stock_actual:viewItem.cantidad_total) || 0}</span>
                                            </div>
                                            <div className="w-px h-8 bg-gray-200" />
                                            <div className="flex flex-col text-slate-500">
                                                <span className="text-[9px] font-bold uppercase">Unidad</span>
                                                <span className="text-[12px] font-black">{viewItem.unidad_medida || 'Unidad'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Galería de Fotos */}
                                {viewItem._photos && viewItem._photos.length > 0 && (
                                    <Fieldset title={`Acervo Fotográfico (${viewItem._photos.length})`}>
                                        <div className="flex gap-2.5 flex-wrap py-2">
                                            {viewItem._photos.map(ph => (
                                                <div key={ph.id} className="group relative cursor-zoom-in transition-transform hover:scale-105 active:scale-95" onClick={() => window.open(ph.url, '_blank')}>
                                                    <img src={ph.url} alt="" className="w-24 h-24 object-cover border-2 border-white shadow-md ring-1 ring-gray-200" />
                                                    <div className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-[8px] font-black text-white uppercase tracking-tighter">{ph.tipo}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Fieldset>
                                )}

                                {/* Historial de Movimientos */}
                                <Fieldset title="Kárdex / Historial de Movimientos Recientes">
                                    <div className="bg-white border border-gray-300 mt-2 overflow-hidden shadow-sm">
                                        {viewItem._movements && viewItem._movements.length > 0 ? (
                                            <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
                                                {viewItem._movements.map((m, i) => (
                                                    <div key={m.id} className={`flex items-start gap-3 p-3 text-[11px] border-l-4 transition-colors hover:bg-slate-50 ${m.tipo === 'entrada' ? 'border-emerald-500' : m.tipo === 'salida' ? 'border-red-400' : 'border-amber-400'}`}>
                                                        <div className="flex-1 flex flex-col">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-sm ${m.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : m.tipo === 'salida' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{m.tipo}</span>
                                                                <span className="text-slate-400 text-[9px] font-bold uppercase">{fmtDate(m.fecha_movimiento)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-400 line-through">{m.cantidad_anterior}</span>
                                                                <span className="text-slate-800 font-black">→ {m.cantidad_nueva}</span>
                                                                <span className="text-slate-500 font-bold opacity-60 ml-2 uppercase italic text-[9px]">{m.motivo?.replace(/_/g, ' ')}</span>
                                                            </div>
                                                            {m.notas && <p className="text-[10px] text-slate-400 mt-1 first-letter:uppercase">{m.notas}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-8 text-center text-slate-300 italic text-[11px]">No hay movimientos registrados para este ítem todavía.</div>
                                        )}
                                    </div>
                                </Fieldset>
                            </div>
                            <div className="flex gap-2 px-4 py-3 border-t border-gray-300 bg-[#f0f0f0] shrink-0">
                                <button onClick={() => { setViewItem(null); openEdit(viewItem); }} className="flex items-center gap-2 px-6 py-1.5 bg-white border border-gray-400 text-[11px] font-black text-amber-700 hover:bg-amber-50 shadow-sm transition-all active:scale-95 uppercase tracking-tighter"><Pencil size={12} strokeWidth={3}/> Modificar Ítem</button>
                                <div className="flex-1" />
                                <button onClick={() => setViewItem(null)} className="px-8 py-1.5 bg-white border border-gray-400 text-[11px] font-black text-slate-600 hover:bg-gray-100 shadow-sm transition-all active:scale-95 uppercase tracking-tighter">Cerrar Expediente</button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
            {/* ══ MODAL NUEVA CATEGORÍA ══ */}
            {showCatModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[340px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.3)] overflow-hidden border border-[#106EBE] flex flex-col animate-slide-up pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <FolderPlus size={14} className="text-white" />
                                    <span className="text-white text-[12px] font-bold tracking-wide uppercase">Nueva Categoría</span>
                                </div>
                                <div className="flex items-center">
                                    <button onClick={() => setShowCatModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all" title="Cerrar">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 bg-[#f0f0f0] flex flex-col gap-4">
                                <Fieldset title="Datos de la Categoría">
                                    <div className="py-2">
                                        <FLabel>Nombre de la Categoría</FLabel>
                                        <input 
                                            value={newCatName} 
                                            onChange={e => setNewCatName(e.target.value.toUpperCase())} 
                                            className={IC} 
                                            autoFocus 
                                            placeholder="EJ: DESECHABLES" 
                                        />
                                        <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-tighter italic">Se guardará automáticamente en la sección de {activeTab === 'insumo' ? 'INSUMOS' : 'UTENSILIOS'}</p>
                                    </div>
                                </Fieldset>
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <button onClick={() => setShowCatModal(false)} className="px-4 py-1 text-[11px] font-bold bg-white border border-gray-400 hover:bg-gray-100 text-slate-700 shadow-sm">Cancelar</button>
                                    <button 
                                        onClick={handleSaveCategory} 
                                        disabled={saving || !newCatName.trim()} 
                                        className="flex items-center gap-1.5 px-5 py-1 bg-[#106EBE] hover:bg-[#0d5aa0] text-white text-[11px] font-bold border border-[#0d5aa0] disabled:opacity-50 shadow-sm"
                                    >
                                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                        {saving ? 'Guardando...' : 'Crear Categoría'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL AJUSTE RÁPIDO ══ */}
            {showQuick && quickItem && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[320px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.3)] overflow-hidden border border-[#106EBE] flex flex-col animate-slide-up pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <TrendingDown size={14} className="text-white" />
                                    <span className="text-white text-[12px] font-bold tracking-wide uppercase">Ajuste de Stock Directo</span>
                                </div>
                                <button onClick={() => setShowQuick(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all">
                                    <X size={18} strokeWidth={2.5} />
                                </button>
                            </div>
                            <div className="p-4 bg-[#f0f0f0] flex flex-col gap-4">
                                <div className="bg-white p-3 border border-gray-300 shadow-inner">
                                    <p className="text-[10px] font-black text-[#106EBE] uppercase leading-tight mb-0.5">{quickItem.nombre}</p>
                                    <p className="text-[9px] font-bold text-slate-400">ITEM ID: {quickItem.codigo}</p>
                                </div>

                                <Fieldset title="Valores de Ajuste">
                                    <div className="grid grid-cols-2 gap-3 py-1">
                                        <div>
                                            <FLabel>Cantidad Final</FLabel>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                value={quickDelta} 
                                                onChange={e => setQuickDelta(e.target.value)} 
                                                className="w-full px-2 py-1.5 text-[15px] font-black text-center border-2 border-slate-300 focus:border-[#106EBE] outline-none text-[#106EBE] bg-blue-50/30" 
                                                autoFocus 
                                                onFocus={e => e.target.select()} 
                                            />
                                        </div>
                                        <div>
                                            <FLabel>Tipo / Motivo</FLabel>
                                            <select value={quickMotivo} onChange={e => setQuickMotivo(e.target.value)} className={IC}>
                                                <option value="ajuste">Corrección Manual</option>
                                                <option value="uso">Consumo Directo</option>
                                                <option value="compra">Suministro Nuevo</option>
                                                <option value="merma">Mermas / Daños</option>
                                            </select>
                                        </div>
                                    </div>
                                </Fieldset>

                                <button 
                                    onClick={() => handleQuickSave(Number(quickDelta))} 
                                    disabled={!quickDelta} 
                                    className="w-full py-2 bg-[#106EBE] hover:bg-[#0d5aa0] text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md active:scale-[0.98]"
                                >
                                    Confirmar y Actualizar Saldo
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
        </div>
    );
};

// ── Historial Tab (sub-componente con carga propia) ───────────────────────────
const HistorialTab: React.FC<{itemId:string}> = ({itemId}) => {
    const [movs,setMovs]=useState<Movement[]>([]);
    const [loading,setLoading]=useState(true);
    useEffect(()=>{
        supabase.from('inventory_movements').select('*').eq('item_id',itemId).order('fecha_movimiento',{ascending:false}).limit(50)
            .then(({data})=>{setMovs((data as Movement[])||[]);setLoading(false);});
    },[itemId]);
    return(
        <div>
            {loading?<div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-slate-400"/></div>:
            movs.length===0?<div className="flex flex-col items-center justify-center py-12 text-slate-400"><History size={24} className="mb-2 opacity-30"/><p className="text-[11px] font-bold">Sin movimientos registrados</p></div>:(
                <div className="space-y-1">
                    {movs.map(m=>(
                        <div key={m.id} className={`flex items-start gap-2 px-3 py-2 border-l-3 text-[10px] ${m.tipo==='entrada'?'border-l-4 border-emerald-500 bg-white':m.tipo==='salida'?'border-l-4 border-red-400 bg-white':m.tipo==='conteo'?'border-l-4 border-purple-400 bg-white':'border-l-4 border-amber-400 bg-white'}`}>
                            <span className={`font-black uppercase text-[8px] px-1.5 py-0.5 shrink-0 ${m.tipo==='entrada'?'bg-emerald-100 text-emerald-700':m.tipo==='salida'?'bg-red-100 text-red-700':m.tipo==='conteo'?'bg-purple-100 text-purple-700':'bg-amber-100 text-amber-700'}`}>{m.tipo}</span>
                            <div className="flex-1">
                                <span className="text-slate-700 font-bold">{m.cantidad_anterior} → {m.cantidad_nueva}</span>
                                <span className="text-slate-500 ml-2">{m.motivo?.replace(/_/g,' ')}{m.notas?` · ${m.notas}`:''}{m.referencia?` (${m.referencia})`:''}</span>
                            </div>
                            <div className="text-right shrink-0 text-slate-400">
                                <div>{new Date(m.fecha_movimiento).toLocaleDateString('es-GT')}</div>
                                <div>{m.responsable}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────
const IC='w-full px-2 py-1 text-[11px] text-slate-800 border border-gray-400 bg-white outline-none focus:border-[#106EBE] h-7 font-bold';
const FLabel:React.FC<{children:React.ReactNode}>=({children})=><label className="block text-[10px] font-bold text-slate-700 mb-0.5">{children}</label>;
const Fieldset:React.FC<{title:string;children:React.ReactNode}>=({title,children})=>(
    <fieldset className="border border-gray-400 bg-white px-3 pt-0.5 pb-3"><legend className="text-[10px] font-black text-slate-700 uppercase px-1">{title}</legend>{children}</fieldset>
);
const CtxItem:React.FC<{icon:any;label:string;onClick:()=>void;danger?:boolean}>=({icon:Icon,label,onClick,danger})=>(
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-1 text-[11px] font-bold text-left hover:bg-[#106EBE] hover:text-white ${danger?'text-red-600':'text-slate-700'}`}>
        <Icon size={12}/>{label}
    </button>
);
