import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import {
    Plus, X, Save, RefreshCw, Loader2, Camera, Search,
    Edit2, Trash2, Eye, Check, Archive, AlertTriangle,
    TrendingDown, Wrench, Package, FilePlus, Pencil,
    AlertCircle, ChevronDown, Calendar, Tag, Boxes,
    ShoppingBag, Clock, BadgeAlert
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface UtensilioItem {
    id: string;
    org_id: string;
    nombre: string;
    categoria: string;
    descripcion: string;
    marca_modelo: string;
    codigo_interno: string;
    material: string;
    tamano_capacidad: string;
    imagen_urls: string[];
    cantidad_total: number;
    cantidad_en_uso: number;
    cantidad_en_bodega: number;
    cantidad_en_reparacion: number;
    cantidad_minima: number;
    ubicacion: string;
    estado: string;
    fecha_adquisicion: string | null;
    costo_adquisicion: number;
    vida_util_anos: number;
    fecha_proxima_revision: string | null;
    proveedor_nombre: string;
    dado_de_baja: boolean;
    motivo_baja: string | null;
    fecha_baja: string | null;
    responsable_baja: string | null;
    foto_evidencia_baja: string | null;
    created_at: string;
}

// ─── Catálogos ────────────────────────────────────────────────────────────────
const CATEGORIAS = [
    { grupo: 'Vajilla', items: ['Platos llanos', 'Platos hondos / soperos', 'Platos de postre', 'Platos de presentación', 'Bowls (varios tamaños)', 'Tazas de café', 'Tazas de té', 'Platos para taza', 'Platos de mariscos'] },
    { grupo: 'Cristalería', items: ['Vasos de agua', 'Vasos de jugo', 'Vasos de cerveza', 'Copas de vino', 'Copas de margarita', 'Tazones de ceviche', 'Jarras'] },
    { grupo: 'Cubiertos', items: ['Tenedores de mesa', 'Cuchillos de mesa', 'Cucharas soperas', 'Cucharas de postre', 'Cucharas de té', 'Cucharas de servicio', 'Pinzas de servicio', 'Cucharones', 'Espátulas'] },
    { grupo: 'Utensilios de Cocina', items: ['Sartenes', 'Ollas', 'Cazuelas', 'Woks', 'Parrillas / planchas', 'Freidoras', 'Tablas de cortar', 'Cuchillos de chef', 'Peladores', 'Ralladores', 'Coladores / escurridores', 'Batidores', 'Espumaderas', 'Cucharones de servicio', 'Pinzas de cocina', 'Termómetros', 'Balanzas', 'Moldes y cortadores'] },
    { grupo: 'Equipos Menores', items: ['Licuadoras', 'Batidoras', 'Procesadores de alimentos', 'Abrelatas eléctricos', 'Tostadoras', 'Microondas', 'Cafetera', 'Dispensador de bebidas'] },
    { grupo: 'Almacenamiento', items: ['Recipientes herméticos', 'Bandejas GN (Gastronorm)', 'Contenedores de almacenamiento', 'Bolsas para vacío', 'Etiquetadoras'] },
    { grupo: 'Limpieza de Cocina', items: ['Cepillos para fregar', 'Esponjas de acero', 'Mopas de cocina', 'Cubetas'] },
    { grupo: 'Presentación', items: ['Tablas de madera para servir', 'Pizarrones de menú', 'Canastas de pan', 'Salseras', 'Dispensadores de azúcar/sal', 'Servilleteros'] },
];

const MATERIALES = ['Acero inoxidable', 'Plástico', 'Madera', 'Vidrio', 'Cerámica', 'Aluminio', 'Otro'];
const UBICACIONES = ['Cocina', 'Sala', 'Barra', 'Bodega'];
const ESTADOS = ['Excelente', 'Bueno', 'Regular', 'Necesita reparación', 'Dado de baja'];
const MOTIVOS_BAJA = ['Roto', 'Perdido', 'Robado', 'Desgaste', 'Obsoleto'];

const fmtQ = (n: number) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n: number) => Number(n || 0).toLocaleString('es-GT');

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO: Partial<UtensilioItem>[] = [
    { nombre: 'Sartén antiadherente 30cm', categoria: 'Utensilios de Cocina — Sartenes', marca_modelo: 'Tramontina', codigo_interno: 'UTE-0001', material: 'Aluminio', tamano_capacidad: '30cm diámetro', cantidad_total: 4, cantidad_en_uso: 3, cantidad_en_bodega: 1, cantidad_en_reparacion: 0, cantidad_minima: 2, ubicacion: 'Cocina', estado: 'Bueno', costo_adquisicion: 350, vida_util_anos: 2, proveedor_nombre: 'Casa Cristal', dado_de_baja: false, imagen_urls: [], org_id: 'default' },
    { nombre: 'Cuchillo chef 8"', categoria: 'Utensilios de Cocina — Cuchillos de chef', marca_modelo: 'Victorinox', codigo_interno: 'UTE-0002', material: 'Acero inoxidable', tamano_capacidad: '8 pulgadas', cantidad_total: 3, cantidad_en_uso: 3, cantidad_en_bodega: 0, cantidad_en_reparacion: 0, cantidad_minima: 3, ubicacion: 'Cocina', estado: 'Regular', costo_adquisicion: 280, vida_util_anos: 5, proveedor_nombre: 'Victorinox GT', dado_de_baja: false, imagen_urls: [], org_id: 'default' },
    { nombre: 'Platos llanos 28cm', categoria: 'Vajilla — Platos llanos', marca_modelo: 'Corona', codigo_interno: 'UTE-0003', material: 'Cerámica', tamano_capacidad: '28cm', cantidad_total: 24, cantidad_en_uso: 20, cantidad_en_bodega: 4, cantidad_en_reparacion: 0, cantidad_minima: 20, ubicacion: 'Sala', estado: 'Bueno', costo_adquisicion: 45, vida_util_anos: 5, proveedor_nombre: 'Distribuidora HyL', dado_de_baja: false, imagen_urls: [], org_id: 'default' },
    { nombre: 'Vasos de agua 12oz', categoria: 'Cristalería — Vasos de agua', marca_modelo: 'Libbey', codigo_interno: 'UTE-0004', material: 'Vidrio', tamano_capacidad: '12 oz / 355ml', cantidad_total: 36, cantidad_en_uso: 30, cantidad_en_bodega: 6, cantidad_en_reparacion: 0, cantidad_minima: 24, ubicacion: 'Sala', estado: 'Bueno', costo_adquisicion: 22, vida_util_anos: 3, proveedor_nombre: 'Importaciones JM', dado_de_baja: false, imagen_urls: [], org_id: 'default' },
    { nombre: 'Licuadora industrial', categoria: 'Equipos Menores — Licuadoras', marca_modelo: 'Oster BVCB07-B', codigo_interno: 'UTE-0005', material: 'Plástico', tamano_capacidad: '2 litros', cantidad_total: 2, cantidad_en_uso: 1, cantidad_en_bodega: 0, cantidad_en_reparacion: 1, cantidad_minima: 1, ubicacion: 'Cocina', estado: 'Necesita reparación', costo_adquisicion: 850, vida_util_anos: 4, proveedor_nombre: 'ElectroPlus GT', dado_de_baja: false, imagen_urls: [], org_id: 'default' },
    { nombre: 'Cucharas soperas (juego)', categoria: 'Cubiertos — Cucharas soperas', marca_modelo: 'WMF', codigo_interno: 'UTE-0006', material: 'Acero inoxidable', tamano_capacidad: 'Estándar', cantidad_total: 24, cantidad_en_uso: 22, cantidad_en_bodega: 2, cantidad_en_reparacion: 0, cantidad_minima: 20, ubicacion: 'Sala', estado: 'Excelente', costo_adquisicion: 18, vida_util_anos: 10, proveedor_nombre: 'Casa Cristal', dado_de_baja: false, imagen_urls: [], org_id: 'default' },
];

function getEstadoColor(estado: string) {
    switch (estado) {
        case 'Excelente': return 'bg-emerald-600 text-white';
        case 'Bueno': return 'bg-[#106EBE] text-white';
        case 'Regular': return 'bg-amber-500 text-white';
        case 'Necesita reparación': return 'bg-orange-600 text-white';
        case 'Dado de baja': return 'bg-red-700 text-white';
        default: return 'bg-gray-400 text-white';
    }
}

function getEstadoText(estado: string) {
    switch (estado) {
        case 'Necesita reparación': return 'Reparación';
        case 'Dado de baja': return 'Baja';
        default: return estado;
    }
}

const emptyForm = (): Omit<UtensilioItem, 'id' | 'org_id' | 'created_at'> => ({
    nombre: '', categoria: '', descripcion: '', marca_modelo: '',
    codigo_interno: '', material: 'Acero inoxidable', tamano_capacidad: '',
    imagen_urls: [], cantidad_total: 1, cantidad_en_uso: 0, cantidad_en_bodega: 1,
    cantidad_en_reparacion: 0, cantidad_minima: 1, ubicacion: 'Cocina',
    estado: 'Bueno', fecha_adquisicion: null, costo_adquisicion: 0,
    vida_util_anos: 3, fecha_proxima_revision: null, proveedor_nombre: '',
    dado_de_baja: false, motivo_baja: null, fecha_baja: null,
    responsable_baja: null, foto_evidencia_baja: null,
});

// ─── Componente Principal ─────────────────────────────────────────────────────
export const InventarioUtensilios: React.FC = () => {
    const [items, setItems] = useState<UtensilioItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [showBajas, setShowBajas] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showBajaForm, setShowBajaForm] = useState(false);
    const [editingItem, setEditingItem] = useState<UtensilioItem | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const [uploadingImg, setUploadingImg] = useState(false);
    const [viewItem, setViewItem] = useState<UtensilioItem | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; item?: UtensilioItem } | null>(null);
    const [dbError, setDbError] = useState(false);
    const [bajaForm, setBajaForm] = useState({ motivo: 'Roto', fecha: '', responsable: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Carga ────────────────────────────────────────────────────────────────
    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('kitchen_utensils')
                .select('*')
                .eq('org_id', 'default')
                .order('nombre');

            if (error) { setDbError(true); setItems([]); }
            else {
                setDbError(false);
                if ((data || []).length === 0) {
                    await supabase.from('kitchen_utensils').insert(DEMO as any[]);
                    const { data: d2 } = await supabase.from('kitchen_utensils').select('*').eq('org_id', 'default').order('nombre');
                    setItems((d2 as UtensilioItem[]) || []);
                } else {
                    setItems((data as UtensilioItem[]) || []);
                }
            }
        } catch { setDbError(true); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    useEffect(() => {
        const close = () => setCtxMenu(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, []);

    // ── Código auto ──────────────────────────────────────────────────────────
    const generateCode = async () => {
        const { count } = await supabase.from('kitchen_utensils').select('*', { count: 'exact', head: true });
        return `UTE-${String((count || 0) + 1).padStart(4, '0')}`;
    };

    const openNew = async () => {
        const code = await generateCode();
        setForm({ ...emptyForm(), codigo_interno: code });
        setEditingItem(null);
        setShowForm(true);
        setCtxMenu(null);
    };

    const openEdit = (item: UtensilioItem) => {
        setEditingItem(item);
        setForm({ ...item } as any);
        setShowForm(true);
        setCtxMenu(null);
    };

    const handleSave = async () => {
        if (!form.nombre.trim()) return;
        setSaving(true);
        const payload = { ...form, org_id: 'default' };
        if (editingItem) {
            await supabase.from('kitchen_utensils').update(payload).eq('id', editingItem.id);
        } else {
            await supabase.from('kitchen_utensils').insert(payload);
        }
        setSaving(false);
        setShowForm(false);
        fetchItems();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este utensilio? Esta acción no se puede deshacer.')) return;
        await supabase.from('kitchen_utensils').delete().eq('id', id);
        fetchItems();
        setCtxMenu(null);
    };

    // ── Dar de baja ──────────────────────────────────────────────────────────
    const openBajaModal = (item: UtensilioItem) => {
        setEditingItem(item);
        setBajaForm({ motivo: 'Roto', fecha: new Date().toISOString().split('T')[0], responsable: '' });
        setShowBajaForm(true);
        setCtxMenu(null);
    };

    const handleBaja = async () => {
        if (!editingItem) return;
        setSaving(true);
        await supabase.from('kitchen_utensils').update({
            dado_de_baja: true,
            estado: 'Dado de baja',
            motivo_baja: bajaForm.motivo,
            fecha_baja: bajaForm.fecha,
            responsable_baja: bajaForm.responsable,
        }).eq('id', editingItem.id);
        setSaving(false);
        setShowBajaForm(false);
        fetchItems();
    };

    // ── Imagen ───────────────────────────────────────────────────────────────
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (form.imagen_urls.length >= 5) { alert('Máximo 5 imágenes.'); return; }
        setUploadingImg(true);
        const fileName = `utensilios/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        const { data, error } = await supabase.storage.from('inventory-images').upload(fileName, file, { upsert: true });
        if (!error && data) {
            const { data: u } = supabase.storage.from('inventory-images').getPublicUrl(data.path);
            setForm(f => ({ ...f, imagen_urls: [...f.imagen_urls, u.publicUrl] }));
        } else {
            const reader = new FileReader();
            reader.onload = ev => setForm(f => ({ ...f, imagen_urls: [...f.imagen_urls, ev.target?.result as string] }));
            reader.readAsDataURL(file);
        }
        setUploadingImg(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    // ── Filtrado ─────────────────────────────────────────────────────────────
    const filtered = items.filter(item => {
        if (!showBajas && item.dado_de_baja) return false;
        const q = search.toLowerCase();
        const ms = !q || item.nombre.toLowerCase().includes(q) || item.codigo_interno.toLowerCase().includes(q) || (item.marca_modelo || '').toLowerCase().includes(q);
        const mc = !filterCat || item.categoria === filterCat;
        const me = !filterEstado || item.estado === filterEstado;
        return ms && mc && me;
    });

    const kpis = {
        total: items.filter(i => !i.dado_de_baja).length,
        enUso: items.filter(i => !i.dado_de_baja).reduce((a, i) => a + i.cantidad_en_uso, 0),
        reparacion: items.filter(i => i.cantidad_en_reparacion > 0 && !i.dado_de_baja).length,
        bajas: items.filter(i => i.dado_de_baja).length,
        valorTotal: items.filter(i => !i.dado_de_baja).reduce((a, i) => a + i.cantidad_total * i.costo_adquisicion, 0),
    };

    const handleContextMenu = (e: React.MouseEvent, item?: UtensilioItem) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY, item });
    };

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col bg-[#f0f0f0] overflow-hidden select-none" onContextMenu={e => handleContextMenu(e)}>

            {/* ── TOOLBAR ── */}
            <div className="shrink-0 bg-white border-b border-gray-300 px-3 py-1.5 flex items-center gap-2">
                <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-[11px] font-medium text-slate-700">
                    <Plus size={12} /> Nuevo
                </button>
                <button onClick={fetchItems} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-[11px] font-medium text-slate-700">
                    <RefreshCw size={12} /> Actualizar
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <button onClick={() => setShowBajas(!showBajas)}
                    className={`flex items-center gap-1.5 px-3 py-1 border text-[11px] font-medium transition-colors ${showBajas ? 'bg-red-100 border-red-400 text-red-700' : 'bg-white border-gray-300 text-slate-600 hover:bg-gray-50'}`}>
                    <BadgeAlert size={12} /> {showBajas ? 'Ocultando bajas' : 'Ver bajas'}
                </button>
                <div className="flex-1" />
                <div className="relative">
                    <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, código, marca..."
                        className="pl-6 pr-2 py-1 text-[11px] border border-gray-400 bg-white w-52 outline-none focus:border-[#106EBE]" />
                </div>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                    className="px-2 py-1 text-[11px] border border-gray-400 bg-white outline-none focus:border-[#106EBE] max-w-[180px]">
                    <option value="">Todas las categorías</option>
                    {CATEGORIAS.map(g => (
                        <optgroup key={g.grupo} label={g.grupo}>
                            {g.items.map(i => <option key={i} value={`${g.grupo} — ${i}`}>{i}</option>)}
                        </optgroup>
                    ))}
                </select>
                <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
                    className="px-2 py-1 text-[11px] border border-gray-400 bg-white outline-none focus:border-[#106EBE]">
                    <option value="">Todos los estados</option>
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
            </div>

            {/* ── KPIs ── */}
            <div className="shrink-0 flex items-center gap-0 border-b border-gray-300 bg-[#f0f0f0]">
                {[
                    { label: 'ÍTEMS', value: kpis.total, icon: Boxes, color: 'text-slate-700' },
                    { label: 'EN USO', value: fmtNum(kpis.enUso), icon: Wrench, color: 'text-[#106EBE]' },
                    { label: 'EN REPARACIÓN', value: kpis.reparacion, icon: AlertTriangle, color: 'text-orange-600' },
                    { label: 'DADOS DE BAJA', value: kpis.bajas, icon: TrendingDown, color: 'text-red-600' },
                    { label: 'VALOR ACTIVOS', value: fmtQ(kpis.valorTotal), icon: ShoppingBag, color: 'text-emerald-700' },
                ].map((k, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-1.5 border-r border-gray-300">
                        <k.icon size={13} className={k.color} />
                        <span className={`text-[12px] font-semibold ${k.color}`}>{k.value}</span>
                        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">{k.label}</span>
                    </div>
                ))}
                <div className="flex-1" />
                <span className="text-[9px] text-slate-400 font-medium pr-3">{filtered.length} de {items.length} registros</span>
            </div>

            {/* ── ERROR BD ── */}
            {dbError && (
                <div className="shrink-0 flex items-center gap-2 bg-red-50 border-b border-red-200 px-4 py-2 text-[11px] text-red-700 font-medium">
                    <AlertCircle size={13} />
                    Tabla <code className="bg-red-100 px-1">kitchen_utensils</code> no existe. Ejecuta <code className="bg-red-100 px-1">sql/supply_inventory_schema.sql</code> en Supabase.
                </div>
            )}

            {/* ── DATA GRID ── */}
            <div className="flex-1 overflow-auto" onContextMenu={e => handleContextMenu(e)}>
                {loading ? (
                    <div className="flex items-center justify-center h-32 text-slate-400">
                        <Loader2 size={18} className="animate-spin mr-2" />
                        <span className="text-[11px] font-medium">Cargando...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                        <Archive size={28} className="mb-2 opacity-30" />
                        <p className="text-[11px] font-medium">SIN REGISTROS</p>
                        <button onClick={openNew} className="mt-2 text-[10px] text-[#106EBE] font-semibold underline">+ Crear nuevo</button>
                    </div>
                ) : (
                    <table className="w-full border-collapse text-left">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#e8e8e8] border-b border-gray-300">
                                <th className="w-6 px-2 py-1 border-r border-gray-300" />
                                <th className="w-10 px-2 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Img</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Nombre</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Código</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Categoría</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Marca</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Material</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700 text-center">Total</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700 text-center">En uso</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700 text-center">Bodega</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700 text-center">Repara.</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Estado</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Ubicación</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700 text-right">Costo U.</th>
                                <th className="px-3 py-1 text-[10px] font-medium text-slate-700 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item, idx) => {
                                const isSelected = selectedIds.has(item.id);
                                const isBaja = item.dado_de_baja;
                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => toggleSelect(item.id)}
                                        onContextMenu={e => handleContextMenu(e, item)}
                                        className={`border-b border-gray-100 cursor-default transition-colors ${isBaja ? 'opacity-50 bg-red-50' : isSelected ? 'bg-[#cce5ff]' : idx % 2 === 0 ? 'bg-white hover:bg-[#f2f7fb]' : 'bg-[#f5f5f5] hover:bg-[#f2f7fb]'}`}
                                    >
                                        <td className="px-2 py-1 border-r border-gray-200 text-center">
                                            <div className={`w-3.5 h-3.5 border flex items-center justify-center mx-auto ${isSelected ? 'bg-[#106EBE] border-[#106EBE] text-white' : 'bg-white border-gray-300'}`}>
                                                {isSelected && <Check size={10} strokeWidth={4} />}
                                            </div>
                                        </td>
                                        <td className="px-2 py-1 border-r border-gray-200">
                                            {item.imagen_urls?.[0] ? (
                                                <img src={item.imagen_urls[0]} alt="" className="w-8 h-8 object-cover border border-gray-300 cursor-pointer" onClick={e => { e.stopPropagation(); setViewItem(item); }} />
                                            ) : (
                                                <div className="w-8 h-8 bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-300">
                                                    <Wrench size={13} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200">
                                            <span className={`text-[11px] font-medium ${isBaja ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.nombre}</span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200">
                                            <span className="text-[10px] font-mono text-slate-500">{item.codigo_interno}</span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200">
                                            <span className="text-[10px] text-slate-600">{item.categoria?.split(' — ')[1] || item.categoria}</span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200">
                                            <span className="text-[10px] text-slate-600">{item.marca_modelo || '—'}</span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200">
                                            <span className="text-[10px] text-slate-500">{item.material}</span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200 text-center">
                                            <span className="text-[12px] font-semibold text-slate-800">{fmtNum(item.cantidad_total)}</span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200 text-center">
                                            <span className="text-[11px] font-medium text-blue-700">{fmtNum(item.cantidad_en_uso)}</span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200 text-center">
                                            <span className="text-[11px] font-medium text-slate-600">{fmtNum(item.cantidad_en_bodega)}</span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200 text-center">
                                            <span className={`text-[11px] font-medium ${item.cantidad_en_reparacion > 0 ? 'text-orange-600' : 'text-slate-300'}`}>{fmtNum(item.cantidad_en_reparacion)}</span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200">
                                            <span className={`inline-block px-1.5 py-0.5 text-[8px] font-semibold uppercase ${getEstadoColor(item.estado)}`}>
                                                {getEstadoText(item.estado)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200">
                                            <span className="text-[10px] text-slate-600">{item.ubicacion}</span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200 text-right">
                                            <span className="text-[11px] font-medium text-slate-800">{fmtQ(item.costo_adquisicion)}</span>
                                        </td>
                                        <td className="px-3 py-1" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => setViewItem(item)} className="p-0.5 hover:bg-blue-100 text-slate-400 hover:text-blue-600 border border-transparent hover:border-blue-300"><Eye size={12} /></button>
                                                <button onClick={() => openEdit(item)} className="p-0.5 hover:bg-amber-100 text-slate-400 hover:text-amber-600 border border-transparent hover:border-amber-300"><Edit2 size={12} /></button>
                                                {!item.dado_de_baja && (
                                                    <button onClick={() => openBajaModal(item)} title="Dar de baja" className="p-0.5 hover:bg-red-100 text-slate-400 hover:text-red-600 border border-transparent hover:border-red-300"><BadgeAlert size={12} /></button>
                                                )}
                                                <button onClick={() => handleDelete(item.id)} className="p-0.5 hover:bg-red-100 text-slate-400 hover:text-red-500 border border-transparent hover:border-red-300"><Trash2 size={12} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── STATUS BAR ── */}
            <div className="shrink-0 bg-[#f0f0f0] border-t border-gray-300 flex items-center gap-4 px-3 py-0.5">
                <span className="text-[9px] text-slate-500 font-medium">{filtered.length} registro(s)</span>
                {selectedIds.size > 0 && <span className="text-[9px] text-[#106EBE] font-medium">{selectedIds.size} seleccionado(s)</span>}
                <div className="flex-1" />
                <span className="text-[9px] text-slate-400">UTENSILIOS DE COCINA — Las Palmas POS</span>
            </div>

            {/* ══ CONTEXT MENU ══ */}
            {ctxMenu && typeof document !== 'undefined' && createPortal(
                <div style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 99999 }}
                    className="bg-white border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] min-w-[180px] py-0.5"
                    onClick={e => e.stopPropagation()}>
                    <CtxItem icon={FilePlus} label="Nuevo utensilio" onClick={openNew} />
                    {ctxMenu.item && <>
                        <div className="h-px bg-gray-200 my-0.5" />
                        <CtxItem icon={Eye} label="Ver detalle" onClick={() => setViewItem(ctxMenu.item!)} />
                        <CtxItem icon={Pencil} label="Editar" onClick={() => openEdit(ctxMenu.item!)} />
                        {!ctxMenu.item.dado_de_baja && <CtxItem icon={BadgeAlert} label="Dar de baja" onClick={() => openBajaModal(ctxMenu.item!)} danger />}
                        <div className="h-px bg-gray-200 my-0.5" />
                        <CtxItem icon={Trash2} label="Eliminar" onClick={() => handleDelete(ctxMenu.item!.id)} danger />
                    </>}
                </div>,
                document.body
            )}

            {/* ══ MODAL FORMULARIO ══ */}
            {showForm && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[740px] max-h-[92vh] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none shrink-0">
                                <div className="flex items-center gap-2">
                                    <Wrench size={13} className="text-white" />
                                    <span className="text-white text-[12px] font-medium">{editingItem ? 'Editar' : 'Nuevo'} Utensilio — {form.codigo_interno}</span>
                                </div>
                                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all"><X size={18} strokeWidth={2.5} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                                {/* Información Básica */}
                                <Fieldset title="Información Básica">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2">
                                            <FLabel>Nombre *</FLabel>
                                            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={IC} placeholder="Ej: Sartén antiadherente 30cm" />
                                        </div>
                                        <div>
                                            <FLabel>Código interno</FLabel>
                                            <input value={form.codigo_interno} readOnly className={IC + ' bg-gray-100 text-slate-500'} />
                                        </div>
                                        <div>
                                            <FLabel>Categoría *</FLabel>
                                            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className={IC}>
                                                <option value="">Seleccionar</option>
                                                {CATEGORIAS.map(g => (
                                                    <optgroup key={g.grupo} label={g.grupo}>
                                                        {g.items.map(i => <option key={i} value={`${g.grupo} — ${i}`}>{i}</option>)}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <FLabel>Marca / Modelo</FLabel>
                                            <input value={form.marca_modelo} onChange={e => setForm(f => ({ ...f, marca_modelo: e.target.value }))} className={IC} placeholder="Ej: Victorinox" />
                                        </div>
                                        <div>
                                            <FLabel>Material</FLabel>
                                            <select value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} className={IC}>
                                                {MATERIALES.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <FLabel>Tamaño / Capacidad / Medidas</FLabel>
                                            <input value={form.tamano_capacidad} onChange={e => setForm(f => ({ ...f, tamano_capacidad: e.target.value }))} className={IC} placeholder="Ej: 30cm diámetro" />
                                        </div>
                                        <div className="col-span-2">
                                            <FLabel>Descripción / Especificaciones técnicas</FLabel>
                                            <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} className={IC + ' resize-none'} />
                                        </div>
                                    </div>
                                </Fieldset>

                                {/* Imágenes (máx. 5) */}
                                <Fieldset title="Imágenes — Máx. 5 (incluyendo foto de estado actual)">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {form.imagen_urls.map((url, idx) => (
                                            <div key={idx} className="relative group">
                                                <img src={url} alt="" className="w-16 h-16 object-cover border border-gray-400" />
                                                <button onClick={() => setForm(f => ({ ...f, imagen_urls: f.imagen_urls.filter((_, i) => i !== idx) }))}
                                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <X size={8} />
                                                </button>
                                                {idx === 1 && <span className="absolute bottom-0 left-0 right-0 bg-orange-600/80 text-[7px] text-white text-center font-medium">ESTADO</span>}
                                            </div>
                                        ))}
                                        {form.imagen_urls.length < 5 && (
                                            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingImg}
                                                className="w-16 h-16 border border-dashed border-gray-400 flex flex-col items-center justify-center text-gray-400 hover:border-[#106EBE] hover:text-[#106EBE] text-[8px] gap-1">
                                                {uploadingImg ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                                                {form.imagen_urls.length === 0 ? 'Principal' : 'Estado'}
                                            </button>
                                        )}
                                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-1">La 2ª foto se usa como "foto de estado actual" para control de deterioro</p>
                                </Fieldset>

                                {/* Inventario */}
                                <Fieldset title="Inventario y Cantidades">
                                    <div className="grid grid-cols-5 gap-3">
                                        <div>
                                            <FLabel>Total en existencia</FLabel>
                                            <input type="number" min={0} value={form.cantidad_total} onChange={e => setForm(f => ({ ...f, cantidad_total: Number(e.target.value) }))} className={IC} />
                                        </div>
                                        <div>
                                            <FLabel>En uso (servicio)</FLabel>
                                            <input type="number" min={0} value={form.cantidad_en_uso} onChange={e => setForm(f => ({ ...f, cantidad_en_uso: Number(e.target.value) }))} className={IC} />
                                        </div>
                                        <div>
                                            <FLabel>En bodega</FLabel>
                                            <input type="number" min={0} value={form.cantidad_en_bodega} onChange={e => setForm(f => ({ ...f, cantidad_en_bodega: Number(e.target.value) }))} className={IC} />
                                        </div>
                                        <div>
                                            <FLabel>En reparación / baja</FLabel>
                                            <input type="number" min={0} value={form.cantidad_en_reparacion} onChange={e => setForm(f => ({ ...f, cantidad_en_reparacion: Number(e.target.value) }))} className={IC} />
                                        </div>
                                        <div>
                                            <FLabel>Mínimo requerido</FLabel>
                                            <input type="number" min={0} value={form.cantidad_minima} onChange={e => setForm(f => ({ ...f, cantidad_minima: Number(e.target.value) }))} className={IC} />
                                        </div>
                                        <div>
                                            <FLabel>Ubicación</FLabel>
                                            <select value={form.ubicacion} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))} className={IC}>
                                                {UBICACIONES.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    {/* Validación visual */}
                                    {(form.cantidad_en_uso + form.cantidad_en_bodega + form.cantidad_en_reparacion) !== form.cantidad_total && form.cantidad_total > 0 && (
                                        <p className="text-[10px] text-amber-600 font-medium mt-2 flex items-center gap-1">
                                            <AlertTriangle size={11} />
                                            Uso + Bodega + Reparación = {form.cantidad_en_uso + form.cantidad_en_bodega + form.cantidad_en_reparacion} ≠ Total {form.cantidad_total}
                                        </p>
                                    )}
                                </Fieldset>

                                {/* Estado y Vida Útil */}
                                <Fieldset title="Estado y Vida Útil">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <FLabel>Estado actual</FLabel>
                                            <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} className={IC}>
                                                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <FLabel>Fecha de adquisición</FLabel>
                                            <input type="date" value={form.fecha_adquisicion || ''} onChange={e => setForm(f => ({ ...f, fecha_adquisicion: e.target.value }))} className={IC} />
                                        </div>
                                        <div>
                                            <FLabel>Costo de adquisición (Q)</FLabel>
                                            <input type="number" min={0} step={0.01} value={form.costo_adquisicion} onChange={e => setForm(f => ({ ...f, costo_adquisicion: Number(e.target.value) }))} className={IC} />
                                        </div>
                                        <div>
                                            <FLabel>Vida útil estimada (años)</FLabel>
                                            <input type="number" min={1} value={form.vida_util_anos} onChange={e => setForm(f => ({ ...f, vida_util_anos: Number(e.target.value) }))} className={IC} />
                                        </div>
                                        <div>
                                            <FLabel>Fecha próxima revisión</FLabel>
                                            <input type="date" value={form.fecha_proxima_revision || ''} onChange={e => setForm(f => ({ ...f, fecha_proxima_revision: e.target.value }))} className={IC} />
                                        </div>
                                        <div>
                                            <FLabel>Proveedor de compra</FLabel>
                                            <input value={form.proveedor_nombre} onChange={e => setForm(f => ({ ...f, proveedor_nombre: e.target.value }))} className={IC} placeholder="Nombre del proveedor" />
                                        </div>
                                    </div>
                                </Fieldset>
                            </div>
                            <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-2 bg-[#f0f0f0] border-t border-gray-300">
                                <button onClick={() => setShowForm(false)} className="px-4 py-1 text-[11px] font-medium bg-white border border-gray-400 hover:bg-gray-100 text-slate-700">Cancelar</button>
                                <button onClick={handleSave} disabled={saving || !form.nombre.trim()}
                                    className="flex items-center gap-1.5 px-5 py-1 bg-[#106EBE] hover:bg-[#0d5aa0] text-white text-[11px] font-medium border border-[#0d5aa0] disabled:opacity-50">
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    {saving ? 'Guardando...' : editingItem ? 'Actualizar' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL DAR DE BAJA ══ */}
            {showBajaForm && editingItem && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[420px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-red-700 flex flex-col pointer-events-auto">
                            <div className="modal-header bg-red-700 h-8 px-3 flex justify-between items-center cursor-move select-none">
                                <div className="flex items-center gap-2">
                                    <BadgeAlert size={13} className="text-white" />
                                    <span className="text-white text-[12px] font-medium">Dar de Baja — {editingItem.nombre}</span>
                                </div>
                                <button onClick={() => setShowBajaForm(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-900 text-white"><X size={18} strokeWidth={2.5} /></button>
                            </div>
                            <div className="p-4 space-y-3">
                                <p className="text-[11px] text-slate-600 bg-red-50 border border-red-200 p-2 font-medium">
                                    Esta acción registrará el utensilio como dado de baja. El historial se conserva para trazabilidad.
                                </p>
                                <Fieldset title="Control de Baja">
                                    <div className="space-y-2">
                                        <div>
                                            <FLabel>Motivo de baja</FLabel>
                                            <select value={bajaForm.motivo} onChange={e => setBajaForm(f => ({ ...f, motivo: e.target.value }))} className={IC}>
                                                {MOTIVOS_BAJA.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <FLabel>Fecha de baja</FLabel>
                                            <input type="date" value={bajaForm.fecha} onChange={e => setBajaForm(f => ({ ...f, fecha: e.target.value }))} className={IC} />
                                        </div>
                                        <div>
                                            <FLabel>Responsable que reporta</FLabel>
                                            <input value={bajaForm.responsable} onChange={e => setBajaForm(f => ({ ...f, responsable: e.target.value }))} className={IC} placeholder="Nombre del empleado" />
                                        </div>
                                    </div>
                                </Fieldset>
                            </div>
                            <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-gray-300 bg-[#f0f0f0]">
                                <button onClick={() => setShowBajaForm(false)} className="px-4 py-1 text-[11px] font-medium bg-white border border-gray-400 hover:bg-gray-100 text-slate-700">Cancelar</button>
                                <button onClick={handleBaja} disabled={saving || !bajaForm.responsable.trim()}
                                    className="flex items-center gap-1.5 px-5 py-1 bg-red-700 hover:bg-red-800 text-white text-[11px] font-medium border border-red-900 disabled:opacity-50">
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <BadgeAlert size={12} />}
                                    Confirmar Baja
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL DETALLE ══ */}
            {viewItem && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[500px] max-h-[85vh] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none">
                                <span className="text-white text-[12px] font-medium">{viewItem.nombre} — {viewItem.codigo_interno}</span>
                                <button onClick={() => setViewItem(null)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all"><X size={18} strokeWidth={2.5} /></button>
                            </div>
                            <div className="p-4 overflow-y-auto space-y-3">
                                {viewItem.imagen_urls?.length > 0 && (
                                    <div className="flex gap-2">
                                        {viewItem.imagen_urls.map((url, i) => <img key={i} src={url} alt="" className="h-20 w-20 object-cover border border-gray-400" />)}
                                    </div>
                                )}
                                <table className="w-full border-collapse text-[11px]">
                                    <tbody>
                                        {[
                                            ['Categoría', viewItem.categoria?.split(' — ')[1] || viewItem.categoria],
                                            ['Marca/Modelo', viewItem.marca_modelo || '—'],
                                            ['Material', viewItem.material || '—'],
                                            ['Tamaño', viewItem.tamano_capacidad || '—'],
                                            ['Total existencia', fmtNum(viewItem.cantidad_total)],
                                            ['En uso', fmtNum(viewItem.cantidad_en_uso)],
                                            ['En bodega', fmtNum(viewItem.cantidad_en_bodega)],
                                            ['En reparación', fmtNum(viewItem.cantidad_en_reparacion)],
                                            ['Mínimo requerido', fmtNum(viewItem.cantidad_minima)],
                                            ['Ubicación', viewItem.ubicacion],
                                            ['Estado', viewItem.estado],
                                            ['Costo adquisición', fmtQ(viewItem.costo_adquisicion)],
                                            ['Fecha adquisición', viewItem.fecha_adquisicion || '—'],
                                            ['Vida útil', `${viewItem.vida_util_anos} años`],
                                            ['Próx. revisión', viewItem.fecha_proxima_revision || '—'],
                                            ['Proveedor', viewItem.proveedor_nombre || '—'],
                                            ...(viewItem.dado_de_baja ? [
                                                ['⚠ Motivo baja', viewItem.motivo_baja || '—'],
                                                ['Fecha baja', viewItem.fecha_baja || '—'],
                                                ['Responsable', viewItem.responsable_baja || '—'],
                                            ] : []),
                                        ].map(([l, v], i) => (
                                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'}>
                                                <td className="px-2 py-0.5 border border-gray-200 font-medium text-slate-600 w-36">{l}</td>
                                                <td className="px-2 py-0.5 border border-gray-200 text-slate-800">{v}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex gap-2 px-4 py-2 border-t border-gray-300 bg-[#f0f0f0]">
                                <button onClick={() => { setViewItem(null); openEdit(viewItem); }}
                                    className="flex items-center gap-1.5 px-4 py-1 bg-white border border-gray-400 text-[11px] font-medium text-amber-700 hover:bg-amber-50">
                                    <Edit2 size={11} /> Editar
                                </button>
                                <button onClick={() => setViewItem(null)} className="flex-1 py-1 bg-white border border-gray-400 text-[11px] font-medium text-slate-600 hover:bg-gray-100">Cerrar</button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
        </div>
    );
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────
const IC = 'w-full px-2 py-1 text-[11px] border border-gray-400 bg-white outline-none focus:border-[#106EBE] h-7 font-medium';
const FLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => <label className="block text-[10px] font-medium text-slate-700 mb-0.5">{children}</label>;
const Fieldset: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <fieldset className="border border-gray-400 bg-white px-3 pt-0.5 pb-3">
        <legend className="text-[10px] font-semibold text-slate-700 uppercase px-1">{title}</legend>
        {children}
    </fieldset>
);
const CtxItem: React.FC<{ icon: any; label: string; onClick: () => void; danger?: boolean }> = ({ icon: Icon, label, onClick, danger }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-1 text-[11px] font-medium text-left hover:bg-[#106EBE] hover:text-white transition-colors ${danger ? 'text-red-600' : 'text-slate-700'}`}>
        <Icon size={12} />{label}
    </button>
);
