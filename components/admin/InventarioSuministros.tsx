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
    ArrowDownCircle, RefreshCcw, Printer, FileSpreadsheet, MessageCircle
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type StockStatus = 'ok' | 'low' | 'critical' | 'empty';
interface SupplyItem {
    id: string; tipo: 'insumo' | 'utensilio'; nombre: string; categoria: string;
    descripcion: string; codigo_interno: string; unidad_medida: string;
    contenido_por_unidad: string; stock_actual: number; stock_minimo: number;
    stock_maximo: number; ubicacion: string; unidades_por_paquete: number;
    proveedor_id: string | null; proveedor_nombre: string; precio_unitario: number;
    precio_unidad_minima: number; fecha_ultima_compra: string | null;
    dias_entre_compras: number; consumo_diario_promedio: number; imagen_urls: string[];
    org_id: string; created_at: string;
}
interface Movement {
    id: string; tipo_movimiento: string; cantidad: number; stock_antes: number;
    stock_despues: number; motivo: string; notas: string; numero_factura: string;
    usuario: string; created_at: string;
}
interface PhysicalCount { [id: string]: string; }

// ─── Catálogos ────────────────────────────────────────────────────────────────
const CATEGORIAS_INSUMOS = [
    { grupo: 'Desechables', items: ['Bolsas plásticas','Bolsas biodegradables','Vasos desechables','Platos desechables','Cubiertos desechables','Sorbetes / Popotes','Servilletas de papel','Palillos de dientes','Papel encerado','Papel aluminio','Papel plástico stretch'] },
    { grupo: 'Empaque', items: ['Cajas para llevar','Envases con tapa','Bolsas con cierre (zip)','Stickers / Etiquetas','Rollos de empaque'] },
    { grupo: 'Limpieza', items: ['Guantes de látex','Guantes de nitrilo','Papel toalla','Papel higiénico','Jabón líquido','Detergente líquido','Cloro / Desinfectante','Esponjas / Estropajos','Escobas / Trapeadores','Bolsas para basura','Atomizadores','Fibras de limpieza'] },
    { grupo: 'Cocina Consumibles', items: ['Palillos de brocheta','Mondadientes','Film plástico','Papel para horno','Papel filtro','Moldes desechables','Pajillas de presentación'] },
    { grupo: 'Oficina', items: ['Rollos para impresora (POS)','Papel bond','Bolígrafos','Marcadores','Tape / Cinta adhesiva','Grapas','Folders'] },
];
const UNIDADES = ['unidad','caja','paquete','rollo','bolsa','docena','kilo','litro','galón','otro'];
const UBICACIONES = ['Bodega principal','Cocina','Barra','Área de servicio','Baños','Oficina'];
const MOTIVOS_MOV = ['Compra','Uso diario','Pérdida','Rotura','Inventario físico','Ajuste','Devolución a proveedor','Otro'];

const fmtQ = (n: number) => `Q ${Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtNum = (n: number) => Number(n||0).toLocaleString('es-GT');
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-GT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

// ─── Utilidades ───────────────────────────────────────────────────────────────
const compressImage = (file: File): Promise<Blob> =>
    new Promise(resolve => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                const MAX = 1200;
                let { width, height } = img;
                if (width > MAX || height > MAX) {
                    if (width > height) { height = (height * MAX) / width; width = MAX; }
                    else { width = (width * MAX) / height; height = MAX; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.82);
            };
        };
    });

function getStockStatus(item: SupplyItem): StockStatus {
    if (item.stock_actual <= 0) return 'empty';
    if (item.stock_actual <= item.stock_minimo * 0.5) return 'critical';
    if (item.stock_actual <= item.stock_minimo * 1.5) return 'low';
    return 'ok';
}
const STATUS_BADGE: Record<StockStatus,string> = {
    ok:'bg-[#106EBE] text-white', low:'bg-amber-500 text-white',
    critical:'bg-orange-600 text-white', empty:'bg-red-600 text-white'
};
const STATUS_LABEL: Record<StockStatus,string> = {
    ok:'En Stock', low:'Stock Bajo', critical:'Crítico', empty:'Sin Stock'
};

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_INSUMOS = [
    { tipo:'insumo', nombre:'Bolsas plásticas medianas', categoria:'Desechables — Bolsas plásticas', codigo_interno:'INS-0001', unidad_medida:'paquete', contenido_por_unidad:'Paquete de 100 unidades', stock_actual:8, stock_minimo:10, stock_maximo:50, ubicacion:'Bodega principal', unidades_por_paquete:100, proveedor_nombre:'Distribuidora Centroamérica', precio_unitario:45.00, precio_unidad_minima:0.45, dias_entre_compras:15, consumo_diario_promedio:2.5, imagen_urls:[], org_id:'default' },
    { tipo:'insumo', nombre:'Vasos desechables 8oz', categoria:'Desechables — Vasos desechables', codigo_interno:'INS-0002', unidad_medida:'caja', contenido_por_unidad:'Caja de 50 vasos', stock_actual:3, stock_minimo:5, stock_maximo:30, ubicacion:'Cocina', unidades_por_paquete:50, proveedor_nombre:'Plastipack GT', precio_unitario:38.50, precio_unidad_minima:0.77, dias_entre_compras:10, consumo_diario_promedio:1.5, imagen_urls:[], org_id:'default' },
    { tipo:'insumo', nombre:'Guantes de nitrilo (caja ×100)', categoria:'Limpieza — Guantes de nitrilo', codigo_interno:'INS-0003', unidad_medida:'caja', contenido_por_unidad:'Caja de 100 guantes', stock_actual:0, stock_minimo:3, stock_maximo:15, ubicacion:'Cocina', unidades_por_paquete:100, proveedor_nombre:'MedSupply', precio_unitario:120.00, precio_unidad_minima:1.20, dias_entre_compras:20, consumo_diario_promedio:0.5, imagen_urls:[], org_id:'default' },
    { tipo:'insumo', nombre:'Servilletas de papel', categoria:'Desechables — Servilletas de papel', codigo_interno:'INS-0004', unidad_medida:'paquete', contenido_por_unidad:'Paquete de 500 hojas', stock_actual:25, stock_minimo:10, stock_maximo:60, ubicacion:'Área de servicio', unidades_por_paquete:500, proveedor_nombre:'Distribuidora Centroamérica', precio_unitario:28.00, precio_unidad_minima:0.056, dias_entre_compras:14, consumo_diario_promedio:3, imagen_urls:[], org_id:'default' },
    { tipo:'insumo', nombre:'Rollos para impresora POS', categoria:'Oficina — Rollos para impresora (POS)', codigo_interno:'INS-0005', unidad_medida:'caja', contenido_por_unidad:'Caja de 10 rollos', stock_actual:4, stock_minimo:5, stock_maximo:20, ubicacion:'Oficina', unidades_por_paquete:10, proveedor_nombre:'TechEquip GT', precio_unitario:85.00, precio_unidad_minima:8.50, dias_entre_compras:30, consumo_diario_promedio:0.2, imagen_urls:[], org_id:'default' },
];

const emptyForm = (): Omit<SupplyItem,'id'|'org_id'|'created_at'> => ({
    tipo:'insumo', nombre:'', categoria:'', descripcion:'', codigo_interno:'',
    unidad_medida:'unidad', contenido_por_unidad:'', stock_actual:0,
    stock_minimo:5, stock_maximo:100, ubicacion:'Bodega principal',
    unidades_por_paquete:1, proveedor_id:null, proveedor_nombre:'',
    precio_unitario:0, precio_unidad_minima:0, fecha_ultima_compra:null,
    dias_entre_compras:30, consumo_diario_promedio:0, imagen_urls:[],
});

// ─── Componente Principal ─────────────────────────────────────────────────────
interface Props { initialTab?: 'insumos'|'utensilios'; }
export const InventarioSuministros: React.FC<Props> = ({ initialTab = 'insumos' }) => {
    const [items, setItems] = useState<SupplyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterUbic, setFilterUbic] = useState('');
    const [viewMode, setViewMode] = useState<'table'|'cards'>('table');
    const [showAlertsPanel, setShowAlertsPanel] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<SupplyItem|null>(null);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const [uploadingImg, setUploadingImg] = useState(false);
    const [viewItem, setViewItem] = useState<SupplyItem|null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [ctxMenu, setCtxMenu] = useState<{x:number;y:number;item?:SupplyItem}|null>(null);
    const [dbError, setDbError] = useState(false);
    const [showMovements, setShowMovements] = useState(false);
    const [movItemId, setMovItemId] = useState<string|null>(null);
    const [movements, setMovements] = useState<Movement[]>([]);
    const [movLoading, setMovLoading] = useState(false);
    const [showPhysicalCount, setShowPhysicalCount] = useState(false);
    const [physicalCounts, setPhysicalCounts] = useState<PhysicalCount>({});
    const [showPurchaseList, setShowPurchaseList] = useState(false);
    const [showMovForm, setShowMovForm] = useState(false);
    const [movForm, setMovForm] = useState({tipo:'entrada', cantidad:'', motivo:'Compra', notas:'', factura:'', itemId:''});
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Carga ────────────────────────────────────────────────────────────────
    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supply_items').select('*')
                .eq('tipo','insumo').eq('org_id','default').order('nombre');
            if (error) { setDbError(true); setItems([]); }
            else {
                setDbError(false);
                if ((data||[]).length === 0) {
                    await supabase.from('supply_items').insert(DEMO_INSUMOS as any[]);
                    const { data: d2 } = await supabase.from('supply_items').select('*').eq('tipo','insumo').eq('org_id','default').order('nombre');
                    setItems((d2 as SupplyItem[])||[]);
                } else { setItems((data as SupplyItem[])||[]); }
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

    // ── Log movimiento ────────────────────────────────────────────────────────
    const logMovement = async (item: SupplyItem, tipo: string, cantidad: number, stockDespues: number, motivo: string, notas = '', factura = '') => {
        await supabase.from('supply_movements').insert({
            supply_item_id: item.id, org_id: 'default',
            tipo_movimiento: tipo, cantidad, stock_antes: item.stock_actual,
            stock_despues: stockDespues, motivo, notas, numero_factura: factura, usuario: 'Admin',
        });
    };

    // ── Ver movimientos ──────────────────────────────────────────────────────
    const openMovements = async (item: SupplyItem) => {
        setMovItemId(item.id);
        setShowMovements(true);
        setMovLoading(true);
        const { data } = await supabase.from('supply_movements')
            .select('*').eq('supply_item_id', item.id).order('created_at', { ascending: false }).limit(50);
        setMovements((data as Movement[])||[]);
        setMovLoading(false);
        setCtxMenu(null);
    };

    // ── Agregar movimiento manual ─────────────────────────────────────────────
    const openMovForm = (item: SupplyItem) => {
        setMovForm({tipo:'entrada', cantidad:'', motivo:'Compra', notas:'', factura:'', itemId: item.id});
        setEditingItem(item);
        setShowMovForm(true);
        setCtxMenu(null);
    };

    const handleMovSave = async () => {
        if (!editingItem || !movForm.cantidad) return;
        setSaving(true);
        const cant = Number(movForm.cantidad);
        let newStock = editingItem.stock_actual;
        if (movForm.tipo === 'entrada') newStock += cant;
        else if (movForm.tipo === 'salida') newStock = Math.max(0, newStock - cant);
        else if (movForm.tipo === 'ajuste') newStock = cant;

        await supabase.from('supply_items').update({stock_actual: newStock}).eq('id', editingItem.id);
        await logMovement(editingItem, movForm.tipo, cant, newStock, movForm.motivo, movForm.notas, movForm.factura);
        setSaving(false);
        setShowMovForm(false);
        fetchItems();
    };

    // ── Quick stock ──────────────────────────────────────────────────────────
    const quickUpdateStock = async (item: SupplyItem, delta: number) => {
        const newStock = Math.max(0, item.stock_actual + delta);
        await supabase.from('supply_items').update({stock_actual: newStock}).eq('id', item.id);
        await logMovement(item, delta > 0 ? 'entrada' : 'salida', Math.abs(delta), newStock, 'Ajuste rápido');
        setItems(prev => prev.map(i => i.id === item.id ? {...i, stock_actual: newStock} : i));
    };

    // ── CRUD ─────────────────────────────────────────────────────────────────
    const generateCode = async () => {
        const {count} = await supabase.from('supply_items').select('*',{count:'exact',head:true}).eq('tipo','insumo');
        return `INS-${String((count||0)+1).padStart(4,'0')}`;
    };
    const openNew = async () => { const code = await generateCode(); setForm({...emptyForm(), codigo_interno:code}); setEditingItem(null); setShowForm(true); setCtxMenu(null); };
    const openEdit = (item: SupplyItem) => { setEditingItem(item); setForm({...item} as any); setShowForm(true); setCtxMenu(null); };

    const handleSave = async () => {
        if (!form.nombre.trim()) return;
        setSaving(true);
        const payload = {...form, org_id:'default', tipo:'insumo'};
        if (editingItem) {
            await supabase.from('supply_items').update(payload).eq('id', editingItem.id);
        } else {
            const {data} = await supabase.from('supply_items').insert(payload).select().single();
            if (data) await logMovement(data as SupplyItem, 'entrada', payload.stock_actual, payload.stock_actual, 'Stock inicial al crear item');
        }
        setSaving(false); setShowForm(false); fetchItems();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este insumo?')) return;
        await supabase.from('supply_items').delete().eq('id', id);
        fetchItems(); setCtxMenu(null);
    };

    // ── Upload imagen con compresión ──────────────────────────────────────────
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (form.imagen_urls.length >= 3) { alert('Máximo 3 imágenes.'); return; }
        setUploadingImg(true);
        try {
            const compressed = await compressImage(file);
            const fileName = `supply/${Date.now()}_${file.name.replace(/\s/g,'_').replace(/[^a-z0-9._-]/gi,'')}.jpg`;
            const {data, error} = await supabase.storage.from('inventario-fotos').upload(fileName, compressed, {upsert:true, contentType:'image/jpeg'});
            if (!error && data) {
                const {data:u} = supabase.storage.from('inventario-fotos').getPublicUrl(data.path);
                setForm(f => ({...f, imagen_urls:[...f.imagen_urls, u.publicUrl]}));
            } else {
                // Fallback: dataURL
                const reader = new FileReader();
                reader.onload = ev => setForm(f => ({...f, imagen_urls:[...f.imagen_urls, ev.target?.result as string]}));
                reader.readAsDataURL(compressed);
            }
        } catch {}
        setUploadingImg(false);
        if (fileInputRef.current) fileInputRef.current.value='';
    };

    // ── Conteo Físico ────────────────────────────────────────────────────────
    const handlePhysicalCountSave = async () => {
        setSaving(true);
        for (const item of items) {
            const val = physicalCounts[item.id];
            if (val === undefined || val === '') continue;
            const newStock = Number(val);
            if (newStock !== item.stock_actual) {
                await supabase.from('supply_items').update({stock_actual: newStock}).eq('id', item.id);
                await logMovement(item, 'conteo_fisico', Math.abs(newStock - item.stock_actual), newStock, `Conteo físico: esperado ${item.stock_actual}, contado ${newStock}`);
            }
        }
        setSaving(false); setShowPhysicalCount(false); fetchItems();
    };

    // ── Lista de compras ──────────────────────────────────────────────────────
    const purchaseItems = items.filter(i => getStockStatus(i) === 'critical' || getStockStatus(i) === 'empty' || getStockStatus(i) === 'low');
    const purchaseByProvider = purchaseItems.reduce((acc, item) => {
        const prov = item.proveedor_nombre || 'Sin proveedor';
        if (!acc[prov]) acc[prov] = [];
        acc[prov].push(item);
        return acc;
    }, {} as Record<string, SupplyItem[]>);

    const printPurchaseList = () => {
        const fecha = new Date().toLocaleDateString('es-GT');
        let html = `<html><head><title>Lista de Compras</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}h1,h2,h3{margin:4px 0}table{width:100%;border-collapse:collapse;margin:8px 0}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#f0f0f0;font-weight:bold}.prov{margin:16px 0 4px;font-weight:bold;background:#106EBE;color:white;padding:4px 8px}hr{border:1px solid #333}</style></head><body>`;
        html += `<h1>LISTA DE COMPRAS — ${fecha}</h1><h3>Cevichería y Restaurante Las Palmas S.A.</h3><hr/>`;
        for (const [prov, provItems] of Object.entries(purchaseByProvider) as [string, SupplyItem[]][]) {
            html += `<div class="prov">PROVEEDOR: ${prov}</div><table><tr><th>Producto</th><th>Unidad</th><th>Stock actual</th><th>A pedir</th><th>Precio U.</th><th>Subtotal est.</th></tr>`;
            for (const item of provItems) {
                const aPedir = Math.max(0, item.stock_maximo - item.stock_actual);
                html += `<tr><td>${item.nombre}</td><td>${item.unidad_medida}</td><td>${item.stock_actual}</td><td><strong>${aPedir}</strong></td><td>Q ${item.precio_unitario.toFixed(2)}</td><td>Q ${(aPedir*item.precio_unitario).toFixed(2)}</td></tr>`;
            }
            html += `</table>`;
        }
        const total = purchaseItems.reduce((s,i) => s + Math.max(0,i.stock_maximo-i.stock_actual)*i.precio_unitario, 0);
        html += `<hr/><p><strong>TOTAL ESTIMADO: Q ${total.toFixed(2)}</strong></p></body></html>`;
        const w = window.open('', '_blank')!;
        w.document.write(html); w.document.close(); w.print();
    };

    const sendWhatsApp = () => {
        let msg = `*LISTA DE COMPRAS - Las Palmas*\n${new Date().toLocaleDateString('es-GT')}\n\n`;
        for (const [prov, provItems] of Object.entries(purchaseByProvider) as [string, SupplyItem[]][]) {
            msg += `*PROVEEDOR: ${prov}*\n`;
            for (const item of provItems) {
                const aPedir = Math.max(0, item.stock_maximo - item.stock_actual);
                msg += `• ${item.nombre} × ${aPedir} ${item.unidad_medida}\n`;
            }
            msg += '\n';
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    };

    // ── Exportar Excel (CSV) ──────────────────────────────────────────────────
    const exportCSV = () => {
        const headers = ['Código','Nombre','Categoría','Unidad','Stock Actual','Stock Mín','Stock Máx','Ubicación','Estado','Proveedor','Precio Unit.','Valor Bodega','Consumo Diario','Días Restantes'];
        const rows = items.map(i => {
            const status = STATUS_LABEL[getStockStatus(i)];
            const dias = i.consumo_diario_promedio > 0 ? Math.floor(i.stock_actual/i.consumo_diario_promedio) : '';
            return [i.codigo_interno, i.nombre, i.categoria, i.unidad_medida, i.stock_actual, i.stock_minimo, i.stock_maximo, i.ubicacion, status, i.proveedor_nombre, i.precio_unitario, (i.stock_actual*i.precio_unitario).toFixed(2), i.consumo_diario_promedio, dias];
        });
        const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `inventario_insumos_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    };

    // ── Filtrado ─────────────────────────────────────────────────────────────
    const filtered = items.filter(item => {
        const q = search.toLowerCase();
        return (!q || item.nombre.toLowerCase().includes(q) || item.codigo_interno.toLowerCase().includes(q) || item.categoria.toLowerCase().includes(q) || (item.proveedor_nombre||'').toLowerCase().includes(q))
            && (!filterCat || item.categoria === filterCat)
            && (!filterStatus || getStockStatus(item) === filterStatus)
            && (!filterUbic || item.ubicacion === filterUbic);
    });

    const kpis = {
        total: items.length,
        alertas: items.filter(i => getStockStatus(i) !== 'ok').length,
        sinStock: items.filter(i => i.stock_actual <= 0).length,
        valorTotal: items.reduce((a,i) => a+i.stock_actual*i.precio_unitario, 0),
    };
    const alertasCriticas = items.filter(i => getStockStatus(i) === 'critical' || getStockStatus(i) === 'empty');
    const alertasBajas = items.filter(i => getStockStatus(i) === 'low');
    const movItem = items.find(i => i.id === movItemId);

    const handleContextMenu = (e: React.MouseEvent, item?: SupplyItem) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({x:e.clientX, y:e.clientY, item}); };
    const toggleSelect = (id: string) => setSelectedIds(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col bg-[#f0f0f0] overflow-hidden select-none" onContextMenu={e => handleContextMenu(e)}>

            {/* ── TOOLBAR ── */}
            <div className="shrink-0 bg-white border-b border-gray-300 px-3 py-1.5 flex items-center gap-1.5 flex-wrap">
                <button onClick={openNew} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-[11px] font-medium text-slate-700"><Plus size={11}/> Nuevo</button>
                <button onClick={fetchItems} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-[11px] font-medium text-slate-700"><RefreshCw size={11}/> Actualizar</button>
                <div className="w-px h-5 bg-gray-300 mx-0.5"/>
                <button onClick={() => setShowPhysicalCount(true)} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-[11px] font-medium text-slate-700"><ClipboardList size={11}/> Conteo Físico</button>
                <button onClick={() => setShowPurchaseList(true)} className={`flex items-center gap-1 px-2.5 py-1 border text-[11px] font-medium transition-colors ${purchaseItems.length > 0 ? 'bg-amber-50 border-amber-400 text-amber-700 hover:bg-amber-100' : 'bg-white border-gray-300 text-slate-700 hover:bg-gray-50'}`}>
                    <ShoppingCart size={11}/> Lista Compras {purchaseItems.length > 0 && <span className="bg-amber-500 text-white text-[8px] px-1 rounded-full">{purchaseItems.length}</span>}
                </button>
                <div className="w-px h-5 bg-gray-300 mx-0.5"/>
                <button onClick={exportCSV} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-[11px] font-medium text-slate-700"><FileSpreadsheet size={11}/> Excel</button>
                <div className="w-px h-5 bg-gray-300 mx-0.5"/>
                <button onClick={() => setViewMode(v => v==='table'?'cards':'table')} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-[11px] font-medium text-slate-700">
                    {viewMode==='table' ? <><LayoutGrid size={11}/> Tarjetas</> : <><List size={11}/> Lista</>}
                </button>
                <div className="flex-1"/>
                <div className="relative"><Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." className="pl-6 pr-2 py-1 text-[11px] border border-gray-400 bg-white w-44 outline-none focus:border-[#106EBE]"/>
                </div>
                <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="px-2 py-1 text-[11px] border border-gray-400 bg-white outline-none focus:border-[#106EBE] max-w-[160px]">
                    <option value="">Todas las cat.</option>
                    {CATEGORIAS_INSUMOS.map(g=><optgroup key={g.grupo} label={g.grupo}>{g.items.map(i=><option key={i} value={`${g.grupo} — ${i}`}>{i}</option>)}</optgroup>)}
                </select>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-2 py-1 text-[11px] border border-gray-400 bg-white outline-none focus:border-[#106EBE]">
                    <option value="">Todos estados</option>
                    <option value="ok">En Stock</option><option value="low">Stock Bajo</option>
                    <option value="critical">Crítico</option><option value="empty">Sin Stock</option>
                </select>
                <select value={filterUbic} onChange={e=>setFilterUbic(e.target.value)} className="px-2 py-1 text-[11px] border border-gray-400 bg-white outline-none focus:border-[#106EBE]">
                    <option value="">Todas ubicaciones</option>
                    {UBICACIONES.map(u=><option key={u} value={u}>{u}</option>)}
                </select>
            </div>

            {/* ── PANEL DE ALERTAS ── */}
            {(alertasCriticas.length > 0 || alertasBajas.length > 0) && (
                <div className="shrink-0 border-b border-gray-300">
                    <button onClick={() => setShowAlertsPanel(v=>!v)}
                        className="w-full flex items-center gap-2 px-3 py-1 bg-amber-50 hover:bg-amber-100 transition-colors">
                        <AlertTriangle size={12} className="text-amber-600"/>
                        <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-widest">ALERTAS DE INVENTARIO</span>
                        {alertasCriticas.length > 0 && <span className="flex items-center gap-1 bg-red-600 text-white text-[9px] font-semibold px-2 py-0.5"><span className="w-1.5 h-1.5 bg-white rounded-full"/> {alertasCriticas.length} crítico(s)</span>}
                        {alertasBajas.length > 0 && <span className="flex items-center gap-1 bg-amber-500 text-white text-[9px] font-semibold px-2 py-0.5"><span className="w-1.5 h-1.5 bg-white rounded-full"/> {alertasBajas.length} bajo(s)</span>}
                        <div className="flex-1"/>
                        {showAlertsPanel ? <ChevronUp size={12} className="text-amber-600"/> : <ChevronDown size={12} className="text-amber-600"/>}
                    </button>
                    {showAlertsPanel && (
                        <div className="bg-amber-50/50 border-t border-amber-100 px-3 py-2 flex gap-3 overflow-x-auto">
                            {[...alertasCriticas, ...alertasBajas].slice(0,8).map(item => {
                                const st = getStockStatus(item);
                                return (
                                    <div key={item.id} className={`shrink-0 flex items-center gap-2 px-2 py-1 border text-[10px] font-medium ${st==='empty'||st==='critical' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                                        <span className={`w-2 h-2 rounded-full ${st==='empty'||st==='critical'?'bg-red-500':'bg-amber-500'}`}/>
                                        <span>{item.nombre}</span>
                                        <span className="font-semibold">{item.stock_actual}/{item.stock_minimo}</span>
                                        <button onClick={() => openMovForm(item)} className="underline text-[9px]">+Stock</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── KPIs ── */}
            <div className="shrink-0 flex items-center gap-0 border-b border-gray-300 bg-[#f0f0f0]">
                {[
                    {label:'ÍTEMS', value:kpis.total, icon:Boxes, color:'text-slate-700'},
                    {label:'ALERTAS', value:kpis.alertas, icon:AlertTriangle, color:'text-amber-600'},
                    {label:'SIN STOCK', value:kpis.sinStock, icon:TrendingDown, color:'text-red-600'},
                    {label:'VALOR BODEGA', value:fmtQ(kpis.valorTotal), icon:ShoppingBag, color:'text-emerald-700'},
                ].map((k,i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-1.5 border-r border-gray-300">
                        <k.icon size={13} className={k.color}/>
                        <span className={`text-[12px] font-semibold ${k.color}`}>{k.value}</span>
                        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">{k.label}</span>
                    </div>
                ))}
                <div className="flex-1"/>
                <span className="text-[9px] text-slate-400 font-medium pr-3">{filtered.length} de {items.length} registros</span>
            </div>

            {dbError && (
                <div className="shrink-0 flex items-center gap-2 bg-red-50 border-b border-red-200 px-4 py-2 text-[11px] text-red-700 font-medium">
                    <AlertCircle size={13}/>Tabla <code className="bg-red-100 px-1">supply_items</code> no existe. Ejecuta <code className="bg-red-100 px-1">sql/supply_inventory_schema.sql</code> y <code className="bg-red-100 px-1">sql/inventory_movements_patch.sql</code>
                </div>
            )}

            {/* ── CONTENIDO ── */}
            <div className="flex-1 overflow-auto" onContextMenu={e => handleContextMenu(e)}>
                {loading ? (
                    <div className="flex items-center justify-center h-32 text-slate-400"><Loader2 size={18} className="animate-spin mr-2"/><span className="text-[11px] font-medium">Cargando...</span></div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-400"><Archive size={28} className="mb-2 opacity-30"/><p className="text-[11px] font-medium">SIN REGISTROS</p><button onClick={openNew} className="mt-2 text-[10px] text-[#106EBE] font-semibold underline">+ Crear nuevo</button></div>
                ) : viewMode === 'table' ? (
                    /* ── TABLA ── */
                    <table className="w-full border-collapse text-left">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#e8e8e8] border-b border-gray-300">
                                <th className="w-6 px-2 py-1 border-r border-gray-300"/>
                                <th className="w-10 px-2 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Img</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Nombre</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Código</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Categoría</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700 text-center">Stock</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700 text-center">Mín</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Ubicación</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Estado</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700">Días/Sem.</th>
                                <th className="px-3 py-1 border-r border-gray-300 text-[10px] font-medium text-slate-700 text-right">Precio</th>
                                <th className="px-3 py-1 text-[10px] font-medium text-slate-700 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item, idx) => {
                                const status = getStockStatus(item);
                                const dias = item.consumo_diario_promedio > 0 ? Math.floor(item.stock_actual/item.consumo_diario_promedio) : null;
                                const sem = item.consumo_diario_promedio > 0 ? +(item.consumo_diario_promedio*7).toFixed(1) : null;
                                const isSelected = selectedIds.has(item.id);
                                return (
                                    <tr key={item.id} onClick={() => toggleSelect(item.id)} onContextMenu={e=>handleContextMenu(e,item)}
                                        className={`border-b border-gray-100 cursor-default transition-colors ${isSelected?'bg-[#cce5ff]':idx%2===0?'bg-white hover:bg-[#f2f7fb]':'bg-[#f5f5f5] hover:bg-[#f2f7fb]'}`}>
                                        <td className="px-2 py-1 border-r border-gray-200 text-center">
                                            <div className={`w-3.5 h-3.5 border flex items-center justify-center mx-auto ${isSelected?'bg-[#106EBE] border-[#106EBE] text-white':'bg-white border-gray-300'}`}>
                                                {isSelected && <Check size={10} strokeWidth={4}/>}
                                            </div>
                                        </td>
                                        <td className="px-2 py-1 border-r border-gray-200">
                                            {item.imagen_urls?.[0] ? (
                                                <img src={item.imagen_urls[0]} alt="" className="w-8 h-8 object-cover border border-gray-300 cursor-pointer" onClick={e=>{e.stopPropagation();setViewItem(item)}}/>
                                            ) : (
                                                <div className="w-8 h-8 bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-300"><Package size={13}/></div>
                                            )}
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200"><span className="text-[11px] font-medium text-slate-800">{item.nombre}</span></td>
                                        <td className="px-3 py-1 border-r border-gray-200"><span className="text-[10px] font-mono text-slate-500">{item.codigo_interno}</span></td>
                                        <td className="px-3 py-1 border-r border-gray-200"><span className="text-[10px] text-slate-600">{item.categoria?.split(' — ')[1]||item.categoria}</span></td>
                                        <td className="px-3 py-1 border-r border-gray-200 text-center">
                                            <div className="flex items-center justify-center gap-1" onClick={e=>e.stopPropagation()}>
                                                <button onClick={()=>quickUpdateStock(item,-1)} className="w-4 h-4 bg-gray-200 hover:bg-red-100 text-[10px] font-semibold border border-gray-300 flex items-center justify-center">−</button>
                                                <span className={`text-[12px] font-semibold w-8 text-center ${status==='empty'?'text-red-600':status==='critical'?'text-orange-600':status==='low'?'text-amber-600':'text-slate-800'}`}>{fmtNum(item.stock_actual)}</span>
                                                <button onClick={()=>quickUpdateStock(item,1)} className="w-4 h-4 bg-gray-200 hover:bg-emerald-100 text-[10px] font-semibold border border-gray-300 flex items-center justify-center">+</button>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200 text-center"><span className="text-[10px] text-slate-500">{item.stock_minimo}</span></td>
                                        <td className="px-3 py-1 border-r border-gray-200"><span className="text-[10px] text-slate-600">{item.ubicacion}</span></td>
                                        <td className="px-3 py-1 border-r border-gray-200">
                                            <span className={`inline-block px-1.5 py-0.5 text-[8px] font-semibold uppercase ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200">
                                            {dias !== null ? <span className={`text-[10px] font-medium ${dias<=3?'text-red-600':dias<=7?'text-amber-600':'text-slate-600'}`}>{dias}d / {sem}/sem</span> : <span className="text-[9px] text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-200 text-right"><span className="text-[11px] font-medium text-slate-800">{fmtQ(item.precio_unitario)}</span></td>
                                        <td className="px-3 py-1" onClick={e=>e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-0.5">
                                                <button onClick={()=>setViewItem(item)} title="Ver" className="p-0.5 hover:bg-blue-100 text-slate-400 hover:text-blue-600"><Eye size={12}/></button>
                                                <button onClick={()=>openEdit(item)} title="Editar" className="p-0.5 hover:bg-amber-100 text-slate-400 hover:text-amber-600"><Edit2 size={12}/></button>
                                                <button onClick={()=>openMovForm(item)} title="Movimiento" className="p-0.5 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600"><ArrowUpCircle size={12}/></button>
                                                <button onClick={()=>openMovements(item)} title="Historial" className="p-0.5 hover:bg-purple-100 text-slate-400 hover:text-purple-600"><History size={12}/></button>
                                                <button onClick={()=>handleDelete(item.id)} title="Eliminar" className="p-0.5 hover:bg-red-100 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    /* ── CARDS ── */
                    <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filtered.map(item => {
                            const status = getStockStatus(item);
                            const pct = item.stock_maximo > 0 ? Math.min(100,(item.stock_actual/item.stock_maximo)*100) : 0;
                            return (
                                <div key={item.id} onContextMenu={e=>handleContextMenu(e,item)}
                                    className="bg-white border border-gray-300 flex flex-col overflow-hidden hover:border-[#106EBE] transition-colors cursor-default">
                                    {item.imagen_urls?.[0] ? (
                                        <img src={item.imagen_urls[0]} alt="" className="w-full h-24 object-cover cursor-pointer" onClick={()=>setViewItem(item)}/>
                                    ) : (
                                        <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-gray-300"><Package size={32}/></div>
                                    )}
                                    <div className="p-2 flex-1 flex flex-col gap-1">
                                        <span className={`self-start px-1.5 py-0.5 text-[8px] font-semibold uppercase ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
                                        <p className="text-[11px] font-semibold text-slate-800 leading-tight">{item.nombre}</p>
                                        <p className="text-[9px] text-slate-400 font-medium">{item.codigo_interno}</p>
                                        <div className="h-1.5 bg-gray-200 mt-1"><div className={`h-full ${status==='empty'?'bg-red-600':status==='critical'?'bg-orange-600':status==='low'?'bg-amber-500':'bg-[#106EBE]'}`} style={{width:`${pct}%`}}/></div>
                                        <div className="flex justify-between items-center">
                                            <span className={`text-[13px] font-semibold ${status==='empty'?'text-red-600':status==='critical'?'text-orange-600':status==='low'?'text-amber-600':'text-slate-800'}`}>{item.stock_actual} <span className="text-[9px] font-medium text-slate-400">/ {item.stock_minimo} mín</span></span>
                                        </div>
                                        <p className="text-[9px] text-slate-500">{item.ubicacion} · {fmtQ(item.precio_unitario)}</p>
                                        <div className="flex gap-1 mt-1" onClick={e=>e.stopPropagation()}>
                                            <button onClick={()=>quickUpdateStock(item,-1)} className="flex-1 py-0.5 bg-gray-100 border border-gray-300 text-[10px] font-semibold hover:bg-red-50">−</button>
                                            <button onClick={()=>openMovForm(item)} className="flex-1 py-0.5 bg-[#106EBE] text-white border border-[#0d5aa0] text-[9px] font-semibold hover:bg-[#0d5aa0]">+Mov</button>
                                            <button onClick={()=>quickUpdateStock(item,1)} className="flex-1 py-0.5 bg-gray-100 border border-gray-300 text-[10px] font-semibold hover:bg-emerald-50">+</button>
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
                <span className="text-[9px] text-slate-500 font-medium">{filtered.length} registro(s)</span>
                {selectedIds.size > 0 && <span className="text-[9px] text-[#106EBE] font-medium">{selectedIds.size} seleccionado(s)</span>}
                <div className="flex-1"/>
                <span className="text-[9px] text-slate-400">INSUMOS Y SUMINISTROS — Las Palmas POS</span>
            </div>

            {/* ══ CONTEXT MENU ══ */}
            {ctxMenu && typeof document !== 'undefined' && createPortal(
                <div style={{position:'fixed',top:ctxMenu.y,left:ctxMenu.x,zIndex:99999}} className="bg-white border border-gray-300 shadow-[4px_4px_15px_rgba(0,0,0,0.15)] min-w-[180px] py-0.5" onClick={e=>e.stopPropagation()}>
                    <CtxItem icon={FilePlus} label="Nuevo insumo" onClick={openNew}/>
                    {ctxMenu.item && <>
                        <div className="h-px bg-gray-200 my-0.5"/>
                        <CtxItem icon={Eye} label="Ver detalle" onClick={()=>setViewItem(ctxMenu.item!)}/>
                        <CtxItem icon={Pencil} label="Editar" onClick={()=>openEdit(ctxMenu.item!)}/>
                        <CtxItem icon={ArrowUpCircle} label="Registrar movimiento" onClick={()=>openMovForm(ctxMenu.item!)}/>
                        <CtxItem icon={History} label="Ver historial" onClick={()=>openMovements(ctxMenu.item!)}/>
                        <div className="h-px bg-gray-200 my-0.5"/>
                        <CtxItem icon={Trash2} label="Eliminar" onClick={()=>handleDelete(ctxMenu.item!.id)} danger/>
                    </>}
                </div>,
                document.body
            )}

            {/* ══ MODAL FORMULARIO ══ */}
            {showForm && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[700px] max-h-[92vh] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none shrink-0">
                                <div className="flex items-center gap-2"><Package size={13} className="text-white"/><span className="text-white text-[12px] font-medium">{editingItem?'Editar':'Nuevo'} Insumo — {form.codigo_interno}</span></div>
                                <button onClick={()=>setShowForm(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all"><X size={18} strokeWidth={2.5}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <Fieldset title="Información Básica">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2"><FLabel>Nombre *</FLabel><input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} className={IC} placeholder="Ej: Bolsas plásticas medianas"/></div>
                                        <div><FLabel>Categoría *</FLabel>
                                            <select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))} className={IC}>
                                                <option value="">Seleccionar</option>
                                                {CATEGORIAS_INSUMOS.map(g=><optgroup key={g.grupo} label={g.grupo}>{g.items.map(i=><option key={i} value={`${g.grupo} — ${i}`}>{i}</option>)}</optgroup>)}
                                            </select>
                                        </div>
                                        <div><FLabel>Unidad de medida</FLabel>
                                            <select value={form.unidad_medida} onChange={e=>setForm(f=>({...f,unidad_medida:e.target.value}))} className={IC}>
                                                {UNIDADES.map(u=><option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-2"><FLabel>Descripción</FLabel><textarea value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} rows={2} className={IC+' resize-none'}/></div>
                                        <div><FLabel>Contenido por unidad de compra</FLabel><input value={form.contenido_por_unidad} onChange={e=>setForm(f=>({...f,contenido_por_unidad:e.target.value}))} className={IC} placeholder="Ej: caja de 100"/></div>
                                        <div><FLabel>Unidades por paquete</FLabel><input type="number" min={1} value={form.unidades_por_paquete} onChange={e=>setForm(f=>({...f,unidades_por_paquete:Number(e.target.value)}))} className={IC}/></div>
                                    </div>
                                </Fieldset>
                                <Fieldset title="Imágenes — JPG, PNG, WEBP, HEIC (máx. 3)">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {form.imagen_urls.map((url,idx)=>(
                                            <div key={idx} className="relative group">
                                                <img src={url} alt="" className="w-16 h-16 object-cover border border-gray-400"/>
                                                <button onClick={()=>setForm(f=>({...f,imagen_urls:f.imagen_urls.filter((_,i)=>i!==idx)}))} className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><X size={8}/></button>
                                            </div>
                                        ))}
                                        {form.imagen_urls.length < 3 && (
                                            <button onClick={()=>fileInputRef.current?.click()} disabled={uploadingImg} className="w-16 h-16 border border-dashed border-gray-400 flex flex-col items-center justify-center text-gray-400 hover:border-[#106EBE] hover:text-[#106EBE] text-[8px] gap-1">
                                                {uploadingImg?<Loader2 size={14} className="animate-spin"/>:<Camera size={14}/>}
                                                {uploadingImg?'Comprimiendo...':'Foto'}
                                            </button>
                                        )}
                                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" className="hidden" onChange={handleImageUpload}/>
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-1">Compresión automática a máx. 800kb · Soporta cámara del teléfono</p>
                                </Fieldset>
                                <Fieldset title="Control de Stock">
                                    <div className="grid grid-cols-4 gap-3">
                                        <div><FLabel>Stock actual</FLabel><input type="number" min={0} value={form.stock_actual} onChange={e=>setForm(f=>({...f,stock_actual:Number(e.target.value)}))} className={IC}/></div>
                                        <div><FLabel>Stock mínimo</FLabel><input type="number" min={0} value={form.stock_minimo} onChange={e=>setForm(f=>({...f,stock_minimo:Number(e.target.value)}))} className={IC}/></div>
                                        <div><FLabel>Stock máximo</FLabel><input type="number" min={0} value={form.stock_maximo} onChange={e=>setForm(f=>({...f,stock_maximo:Number(e.target.value)}))} className={IC}/></div>
                                        <div><FLabel>Ubicación</FLabel><select value={form.ubicacion} onChange={e=>setForm(f=>({...f,ubicacion:e.target.value}))} className={IC}>{UBICACIONES.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
                                        <div><FLabel>Consumo prom. diario</FLabel><input type="number" min={0} step={0.1} value={form.consumo_diario_promedio} onChange={e=>setForm(f=>({...f,consumo_diario_promedio:Number(e.target.value)}))} className={IC}/></div>
                                    </div>
                                    {form.stock_maximo > 0 && <div className="mt-2 h-2 bg-white border border-gray-400 overflow-hidden"><div className={`h-full transition-all ${form.stock_actual<=0?'bg-red-600':form.stock_actual<=form.stock_minimo?'bg-amber-500':'bg-[#106EBE]'}`} style={{width:`${Math.min(100,(form.stock_actual/form.stock_maximo)*100)}%`}}/></div>}
                                </Fieldset>
                                <Fieldset title="Información de Compra">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2"><FLabel>Proveedor habitual</FLabel><input value={form.proveedor_nombre} onChange={e=>setForm(f=>({...f,proveedor_nombre:e.target.value}))} className={IC}/></div>
                                        <div><FLabel>Precio unitario (Q)</FLabel><input type="number" min={0} step={0.01} value={form.precio_unitario} onChange={e=>setForm(f=>({...f,precio_unitario:Number(e.target.value)}))} className={IC}/></div>
                                        <div><FLabel>P. unidad mínima (Q)</FLabel><input type="number" min={0} step={0.01} value={form.precio_unidad_minima} onChange={e=>setForm(f=>({...f,precio_unidad_minima:Number(e.target.value)}))} className={IC}/></div>
                                        <div><FLabel>Última compra</FLabel><input type="date" value={form.fecha_ultima_compra||''} onChange={e=>setForm(f=>({...f,fecha_ultima_compra:e.target.value}))} className={IC}/></div>
                                        <div><FLabel>Días entre compras</FLabel><input type="number" min={1} value={form.dias_entre_compras} onChange={e=>setForm(f=>({...f,dias_entre_compras:Number(e.target.value)}))} className={IC}/></div>
                                    </div>
                                </Fieldset>
                            </div>
                            <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-2 bg-[#f0f0f0] border-t border-gray-300">
                                <button onClick={()=>setShowForm(false)} className="px-4 py-1 text-[11px] font-medium bg-white border border-gray-400 hover:bg-gray-100 text-slate-700">Cancelar</button>
                                <button onClick={handleSave} disabled={saving||!form.nombre.trim()} className="flex items-center gap-1.5 px-5 py-1 bg-[#106EBE] hover:bg-[#0d5aa0] text-white text-[11px] font-medium border border-[#0d5aa0] disabled:opacity-50">
                                    {saving?<Loader2 size={12} className="animate-spin"/>:<Save size={12}/>}{saving?'Guardando...':editingItem?'Actualizar':'Guardar'}
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL REGISTRAR MOVIMIENTO ══ */}
            {showMovForm && editingItem && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[460px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none">
                                <div className="flex items-center gap-2"><ArrowUpCircle size={13} className="text-white"/><span className="text-white text-[12px] font-medium">Registrar Movimiento — {editingItem.nombre}</span></div>
                                <button onClick={()=>setShowMovForm(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white"><X size={18} strokeWidth={2.5}/></button>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-2 bg-white border border-gray-300 px-3 py-2 text-[11px] font-medium text-slate-600">
                                    Stock actual: <span className="text-[14px] font-semibold text-[#106EBE] ml-1">{editingItem.stock_actual}</span> <span className="text-slate-400">{editingItem.unidad_medida}</span>
                                </div>
                                <Fieldset title="Datos del Movimiento">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><FLabel>Tipo de movimiento</FLabel>
                                            <select value={movForm.tipo} onChange={e=>setMovForm(f=>({...f,tipo:e.target.value}))} className={IC}>
                                                <option value="entrada">▲ Entrada (aumenta stock)</option>
                                                <option value="salida">▼ Salida (reduce stock)</option>
                                                <option value="ajuste">⟳ Ajuste (stock total nuevo)</option>
                                            </select>
                                        </div>
                                        <div><FLabel>Cantidad {movForm.tipo==='ajuste'?'(stock nuevo total)':'a registrar'}</FLabel>
                                            <input type="number" min={0} value={movForm.cantidad} onChange={e=>setMovForm(f=>({...f,cantidad:e.target.value}))} className={IC} placeholder="0" autoFocus/>
                                        </div>
                                        <div><FLabel>Motivo</FLabel>
                                            <select value={movForm.motivo} onChange={e=>setMovForm(f=>({...f,motivo:e.target.value}))} className={IC}>
                                                {MOTIVOS_MOV.map(m=><option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        <div><FLabel>N° Factura (si aplica)</FLabel><input value={movForm.factura} onChange={e=>setMovForm(f=>({...f,factura:e.target.value}))} className={IC} placeholder="Ej: FAC-2025-001"/></div>
                                        <div className="col-span-2"><FLabel>Notas opcionales</FLabel><input value={movForm.notas} onChange={e=>setMovForm(f=>({...f,notas:e.target.value}))} className={IC} placeholder="Observaciones adicionales..."/></div>
                                    </div>
                                    {movForm.cantidad && (
                                        <div className="mt-2 bg-white border border-gray-300 text-[11px] px-3 py-1.5 font-medium text-slate-600">
                                            Stock resultante: <span className="text-[14px] font-semibold text-[#106EBE]">
                                                {movForm.tipo==='entrada' ? editingItem.stock_actual + Number(movForm.cantidad) : movForm.tipo==='salida' ? Math.max(0, editingItem.stock_actual - Number(movForm.cantidad)) : Number(movForm.cantidad)}
                                            </span> {editingItem.unidad_medida}
                                        </div>
                                    )}
                                </Fieldset>
                            </div>
                            <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-gray-300 bg-[#f0f0f0]">
                                <button onClick={()=>setShowMovForm(false)} className="px-4 py-1 text-[11px] font-medium bg-white border border-gray-400 hover:bg-gray-100 text-slate-700">Cancelar</button>
                                <button onClick={handleMovSave} disabled={saving||!movForm.cantidad} className="flex items-center gap-1.5 px-5 py-1 bg-[#106EBE] text-white text-[11px] font-medium border border-[#0d5aa0] disabled:opacity-50">
                                    {saving?<Loader2 size={12} className="animate-spin"/>:<Save size={12}/>} Registrar
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL HISTORIAL ══ */}
            {showMovements && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[600px] max-h-[80vh] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none">
                                <div className="flex items-center gap-2"><History size={13} className="text-white"/><span className="text-white text-[12px] font-medium">Historial de Movimientos — {movItem?.nombre}</span></div>
                                <button onClick={()=>setShowMovements(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white"><X size={18} strokeWidth={2.5}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {movLoading ? <div className="flex items-center justify-center h-24"><Loader2 size={18} className="animate-spin text-slate-400"/></div> :
                                movements.length === 0 ? <div className="flex items-center justify-center h-24 text-[11px] text-slate-400 font-medium">Sin movimientos registrados</div> : (
                                    <table className="w-full border-collapse text-left">
                                        <thead className="sticky top-0"><tr className="bg-[#f0f0f0] border-b border-gray-300">
                                            <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-300">Fecha</th>
                                            <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-300">Tipo</th>
                                            <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-300 text-center">Cant.</th>
                                            <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-300 text-center">Antes→Después</th>
                                            <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-300">Motivo</th>
                                            <th className="px-3 py-1 text-[10px] font-medium text-slate-700">Usuario</th>
                                        </tr></thead>
                                        <tbody>{movements.map((m,i) => (
                                            <tr key={m.id} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'}`}>
                                                <td className="px-3 py-1 border-r border-gray-200 text-[10px] text-slate-600 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                                                <td className="px-3 py-1 border-r border-gray-200">
                                                    <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 ${m.tipo_movimiento==='entrada'?'bg-emerald-100 text-emerald-700':m.tipo_movimiento==='salida'?'bg-red-100 text-red-700':m.tipo_movimiento==='conteo_fisico'?'bg-purple-100 text-purple-700':'bg-amber-100 text-amber-700'}`}>{m.tipo_movimiento}</span>
                                                </td>
                                                <td className="px-3 py-1 border-r border-gray-200 text-center text-[11px] font-semibold text-slate-800">{m.cantidad}</td>
                                                <td className="px-3 py-1 border-r border-gray-200 text-center text-[10px] text-slate-600">{m.stock_antes} → {m.stock_despues}</td>
                                                <td className="px-3 py-1 border-r border-gray-200 text-[10px] text-slate-600">{m.motivo}{m.notas?` · ${m.notas}`:''}{m.numero_factura?` (${m.numero_factura})`:''}</td>
                                                <td className="px-3 py-1 text-[10px] text-slate-500">{m.usuario}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                )}
                            </div>
                            <div className="flex justify-end px-4 py-2 border-t border-gray-300 bg-[#f0f0f0]">
                                <button onClick={()=>setShowMovements(false)} className="px-4 py-1 text-[11px] font-medium bg-white border border-gray-400 text-slate-600 hover:bg-gray-100">Cerrar</button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL CONTEO FÍSICO ══ */}
            {showPhysicalCount && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[700px] max-h-[90vh] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none">
                                <div className="flex items-center gap-2"><ClipboardList size={13} className="text-white"/><span className="text-white text-[12px] font-medium">Conteo Físico de Inventario — {new Date().toLocaleDateString('es-GT')}</span></div>
                                <button onClick={()=>setShowPhysicalCount(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white"><X size={18} strokeWidth={2.5}/></button>
                            </div>
                            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
                                <p className="text-[11px] font-medium text-amber-700">Ingrese la cantidad REAL contada de cada ítem. Solo se registran los cambios. Deje en blanco si no contó el ítem.</p>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <table className="w-full border-collapse">
                                    <thead className="sticky top-0"><tr className="bg-[#f0f0f0] border-b border-gray-300">
                                        <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-300">Código</th>
                                        <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-300">Nombre</th>
                                        <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-300 text-center">Sistema</th>
                                        <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-300 text-center">Real contado</th>
                                        <th className="px-3 py-1 text-[10px] font-medium text-slate-700 text-center">Diferencia</th>
                                    </tr></thead>
                                    <tbody>{items.map((item,idx) => {
                                        const counted = physicalCounts[item.id];
                                        const diff = counted !== undefined && counted !== '' ? Number(counted) - item.stock_actual : null;
                                        return (
                                            <tr key={item.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'}`}>
                                                <td className="px-3 py-1 border-r border-gray-200 text-[10px] font-mono text-slate-500">{item.codigo_interno}</td>
                                                <td className="px-3 py-1 border-r border-gray-200 text-[11px] font-medium text-slate-800">{item.nombre}</td>
                                                <td className="px-3 py-1 border-r border-gray-200 text-center text-[12px] font-semibold text-slate-600">{item.stock_actual}</td>
                                                <td className="px-3 py-1 border-r border-gray-200 text-center">
                                                    <input type="number" min={0} placeholder="—"
                                                        value={physicalCounts[item.id]||''}
                                                        onChange={e=>setPhysicalCounts(p=>({...p,[item.id]:e.target.value}))}
                                                        className="w-20 px-2 py-0.5 text-[11px] font-semibold border border-gray-400 text-center outline-none focus:border-[#106EBE] bg-white"/>
                                                </td>
                                                <td className="px-3 py-1 text-center">
                                                    {diff !== null && <span className={`text-[12px] font-semibold ${diff===0?'text-slate-400':diff>0?'text-emerald-600':'text-red-600'}`}>{diff>0?`+${diff}`:diff}</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}</tbody>
                                </table>
                            </div>
                            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-300 bg-[#f0f0f0]">
                                <span className="text-[10px] font-medium text-slate-500">{Object.values(physicalCounts).filter(v=>v!=='').length} ítems ingresados</span>
                                <div className="flex gap-2">
                                    <button onClick={()=>setShowPhysicalCount(false)} className="px-4 py-1 text-[11px] font-medium bg-white border border-gray-400 text-slate-600 hover:bg-gray-100">Cancelar</button>
                                    <button onClick={handlePhysicalCountSave} disabled={saving} className="flex items-center gap-1.5 px-5 py-1 bg-[#106EBE] text-white text-[11px] font-medium border border-[#0d5aa0] disabled:opacity-50">
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
            {showPurchaseList && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[660px] max-h-[90vh] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none">
                                <div className="flex items-center gap-2"><ShoppingCart size={13} className="text-white"/><span className="text-white text-[12px] font-medium">Lista de Compras Automática — {new Date().toLocaleDateString('es-GT')}</span></div>
                                <button onClick={()=>setShowPurchaseList(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white"><X size={18} strokeWidth={2.5}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                {purchaseItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-32 text-slate-400"><Check size={28} className="text-emerald-500 mb-2"/><p className="text-[11px] font-medium">¡Todo el stock está en niveles correctos!</p></div>
                                ) : (
                                    <div className="space-y-3">
                                        {(Object.entries(purchaseByProvider) as [string, SupplyItem[]][]).map(([prov, provItems]) => (
                                            <div key={prov} className="border border-gray-300 bg-white">
                                                <div className="bg-[#106EBE] px-3 py-1.5"><p className="text-[11px] font-semibold text-white uppercase">PROVEEDOR: {prov}</p></div>
                                                <table className="w-full border-collapse">
                                                    <thead><tr className="bg-gray-50 border-b border-gray-200">
                                                        <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-200">Producto</th>
                                                        <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-200 text-center">Stock</th>
                                                        <th className="px-3 py-1 text-[10px] font-medium text-slate-700 border-r border-gray-200 text-center">A pedir</th>
                                                        <th className="px-3 py-1 text-[10px] font-medium text-slate-700 text-right">Costo est.</th>
                                                    </tr></thead>
                                                    <tbody>{provItems.map(item => {
                                                        const aPedir = Math.max(0, item.stock_maximo - item.stock_actual);
                                                        const st = getStockStatus(item);
                                                        return (
                                                            <tr key={item.id} className="border-b border-gray-100">
                                                                <td className="px-3 py-1 border-r border-gray-100">
                                                                    <p className="text-[11px] font-medium text-slate-800">{item.nombre}</p>
                                                                    <p className="text-[9px] text-slate-400">{item.unidad_medida}</p>
                                                                </td>
                                                                <td className="px-3 py-1 border-r border-gray-100 text-center">
                                                                    <span className={`text-[11px] font-semibold ${st==='empty'?'text-red-600':st==='critical'?'text-orange-600':'text-amber-600'}`}>{item.stock_actual}</span>
                                                                    <span className="text-[9px] text-slate-400">/{item.stock_minimo}</span>
                                                                </td>
                                                                <td className="px-3 py-1 border-r border-gray-100 text-center"><span className="text-[12px] font-semibold text-[#106EBE]">{aPedir}</span></td>
                                                                <td className="px-3 py-1 text-right text-[11px] font-medium text-slate-800">{fmtQ(aPedir*item.precio_unitario)}</td>
                                                            </tr>
                                                        );
                                                    })}</tbody>
                                                </table>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between px-3 py-2 bg-white border border-gray-300 font-medium text-[12px]">
                                            <span className="text-slate-600">TOTAL ESTIMADO</span>
                                            <span className="text-[#106EBE]">{fmtQ(purchaseItems.reduce((s,i)=>s+Math.max(0,i.stock_maximo-i.stock_actual)*i.precio_unitario,0))}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {purchaseItems.length > 0 && (
                                <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-300 bg-[#f0f0f0]">
                                    <button onClick={printPurchaseList} className="flex items-center gap-1.5 px-4 py-1 bg-white border border-gray-400 text-[11px] font-medium text-slate-700 hover:bg-gray-100"><Printer size={12}/> Imprimir / PDF</button>
                                    <button onClick={sendWhatsApp} className="flex items-center gap-1.5 px-4 py-1 bg-emerald-600 border border-emerald-700 text-white text-[11px] font-medium hover:bg-emerald-700"><MessageCircle size={12}/> WhatsApp</button>
                                    <button onClick={exportCSV} className="flex items-center gap-1.5 px-4 py-1 bg-white border border-gray-400 text-[11px] font-medium text-slate-700 hover:bg-gray-100"><FileSpreadsheet size={12}/> CSV</button>
                                </div>
                            )}
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* ══ MODAL DETALLE ══ */}
            {viewItem && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow>
                        <div className="w-[480px] max-h-[85vh] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none">
                                <span className="text-white text-[12px] font-medium">{viewItem.nombre} — {viewItem.codigo_interno}</span>
                                <button onClick={()=>setViewItem(null)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white"><X size={18} strokeWidth={2.5}/></button>
                            </div>
                            <div className="p-4 overflow-y-auto space-y-3">
                                {viewItem.imagen_urls?.length > 0 && (
                                    <div className="flex gap-2">{viewItem.imagen_urls.map((url,i)=><img key={i} src={url} alt="" className="h-20 w-20 object-cover border border-gray-400 cursor-pointer" onClick={()=>window.open(url,'_blank')}/>)}</div>
                                )}
                                <table className="w-full border-collapse text-[11px]">
                                    <tbody>
                                        {[
                                            ['Categoría', viewItem.categoria?.split(' — ')[1]||viewItem.categoria],
                                            ['Unidad', viewItem.unidad_medida],
                                            ['Contenido/unidad', viewItem.contenido_por_unidad||'—'],
                                            ['Stock actual', `${fmtNum(viewItem.stock_actual)} ${viewItem.unidad_medida}`],
                                            ['Stock mínimo', `${fmtNum(viewItem.stock_minimo)} ${viewItem.unidad_medida}`],
                                            ['Stock máximo', `${fmtNum(viewItem.stock_maximo)} ${viewItem.unidad_medida}`],
                                            ['Ubicación', viewItem.ubicacion],
                                            ['Proveedor', viewItem.proveedor_nombre||'—'],
                                            ['Precio unitario', fmtQ(viewItem.precio_unitario)],
                                            ['Valor en bodega', fmtQ(viewItem.stock_actual*viewItem.precio_unitario)],
                                            ['Consumo diario', viewItem.consumo_diario_promedio>0?`${viewItem.consumo_diario_promedio} ${viewItem.unidad_medida}/día`:'—'],
                                            ['Días restantes', viewItem.consumo_diario_promedio>0?`~${Math.floor(viewItem.stock_actual/viewItem.consumo_diario_promedio)} días`:'—'],
                                            ['Última compra', viewItem.fecha_ultima_compra||'—'],
                                        ].map(([l,v],i)=>(
                                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'}>
                                                <td className="px-2 py-0.5 border border-gray-200 font-medium text-slate-600 w-36">{l}</td>
                                                <td className="px-2 py-0.5 border border-gray-200 text-slate-800">{v}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex gap-2 px-4 py-2 border-t border-gray-300 bg-[#f0f0f0]">
                                <button onClick={()=>{setViewItem(null);openEdit(viewItem);}} className="flex items-center gap-1.5 px-4 py-1 bg-white border border-gray-400 text-[11px] font-medium text-amber-700 hover:bg-amber-50"><Edit2 size={11}/> Editar</button>
                                <button onClick={()=>{const tmp=viewItem;setViewItem(null);openMovements(tmp);}} className="flex items-center gap-1.5 px-4 py-1 bg-white border border-gray-400 text-[11px] font-medium text-purple-700 hover:bg-purple-50"><History size={11}/> Historial</button>
                                <button onClick={()=>setViewItem(null)} className="flex-1 py-1 bg-white border border-gray-400 text-[11px] font-medium text-slate-600 hover:bg-gray-100">Cerrar</button>
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
const FLabel: React.FC<{children:React.ReactNode}> = ({children}) => <label className="block text-[10px] font-medium text-slate-700 mb-0.5">{children}</label>;
const Fieldset: React.FC<{title:string;children:React.ReactNode}> = ({title,children}) => (
    <fieldset className="border border-gray-400 bg-white px-3 pt-0.5 pb-3">
        <legend className="text-[10px] font-semibold text-slate-700 uppercase px-1">{title}</legend>
        {children}
    </fieldset>
);
const CtxItem: React.FC<{icon:any;label:string;onClick:()=>void;danger?:boolean}> = ({icon:Icon,label,onClick,danger}) => (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-1 text-[11px] font-medium text-left hover:bg-[#106EBE] hover:text-white transition-colors ${danger?'text-red-600':'text-slate-700'}`}>
        <Icon size={12}/>{label}
    </button>
);
