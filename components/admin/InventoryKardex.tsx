import React, { useState, useEffect, useCallback } from 'react';
import {
    BookOpen, Search, Filter, Download, Printer, Loader2,
    Calendar, Building2, Package, ArrowRight, ChevronLeft,
    ChevronRight, X, TrendingUp, TrendingDown, RefreshCw,
    FileText, BarChart3, FileSpreadsheet
} from 'lucide-react';
import { supabase } from '../../supabase';
import * as XLSX from 'xlsx';

type MovementType = 'ALL' | 'COMPRA' | 'VENTA' | 'NIVELACION' | 'DEVOLUCION' | 'TRASLADO' | 'ANULACION';

interface KardexRow {
    id: string;
    created_at: string;
    branch_id: string | null;
    item_id: string | null;
    movement_type: string;
    reference: string | null;
    user_name: string | null;
    device: string | null;
    quantity_in: number;
    quantity_out: number;
    balance: number;
    unit_cost: number;
    balance_value: number;
    notes: string | null;
    inventory_items?: { name: string; unit: string; code: string } | null;
    products?: { name: string; unit_measure: string; product_code: string } | null;
    branches?: { name: string } | null;
}

const MOVEMENT_COLORS: Record<string, string> = {
    COMPRA: 'bg-blue-50 text-[#106ebe] border-blue-100',
    VENTA: 'bg-orange-50 text-orange-600 border-orange-100',
    NIVELACION: 'bg-violet-50 text-violet-600 border-violet-100',
    DEVOLUCION: 'bg-amber-50 text-amber-600 border-amber-100',
    TRASLADO: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    ANULACION: 'bg-rose-50 text-rose-600 border-rose-100',
};

const PAGE_SIZE = 50;

export const InventoryKardex: React.FC<{ currentUser?: any, initialProductId?: string | null }> = ({ currentUser, initialProductId }) => {
    const [rows, setRows] = useState<KardexRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

    // Filters
    const [filterBranch, setFilterBranch] = useState('ALL');
    const [filterProduct, setFilterProduct] = useState(initialProductId || 'ALL');
    const [filterType, setFilterType] = useState<MovementType>('ALL');
    const getLocalDateStr = (daysAgo = 0) => {
        const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
        if (daysAgo > 0) date.setDate(date.getDate() - daysAgo);
        return date.toISOString().split('T')[0];
    };
    const [filterStart, setFilterStart] = useState(getLocalDateStr(30)); // Ver últimos 30 días por defecto
    const [filterEnd, setFilterEnd] = useState(getLocalDateStr(0));
    const [searchProduct, setSearchProduct] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);

    // Pagination
    const [page, setPage] = useState(0);
    const [orderNumbers, setOrderNumbers] = useState<Record<string, string>>({});
    const [orderStatuses, setOrderStatuses] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchMeta = async () => {
            const [bRes, iRes, pRes] = await Promise.all([
                supabase.from('branches').select('id, name').order('name'),
                supabase.from('inventory_items').select('id, name, nombre').order('name'),
                supabase.from('products').select('id, name, nombre').eq('es_platillo', false).order('name')
            ]);
            
            if (bRes.data) setBranches(bRes.data);
            
            // Combinar ambos listados para el dropdown de selección, normalizando el nombre
            const combined = [
                ...(iRes.data || []).map(i => ({ ...i, display_name: i.nombre || i.name || '---' })),
                ...(pRes.data || []).map(p => ({ ...p, display_name: p.name || p.nombre || '---' }))
            ];
            
            // Eliminar duplicados por ID si los hay
            const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
            setProducts(unique);
        };
        fetchMeta();
    }, []);

    const fetchKardex = useCallback(async () => {
        setLoading(true);
        try {
            console.log('Fetching Kardex with filters:', { filterBranch, filterProduct, filterType, filterStart, filterEnd });
            
            let query = supabase
                .from('inventory_kardex')
                .select('*')
                .order('created_at', { ascending: false });

            // Solo aplicar filtros si no son ALL
            if (filterBranch !== 'ALL') query = query.eq('branch_id', filterBranch);
            if (filterProduct !== 'ALL') query = query.eq('item_id', filterProduct);
            if (filterType !== 'ALL') query = query.eq('movement_type', filterType);
            
            // Filtro de fecha inclusivo
            if (filterStart) query = query.gte('created_at', filterStart + 'T00:00:00');
            if (filterEnd) query = query.lte('created_at', filterEnd + 'T23:59:59');

            const { data, error } = await query.limit(1000);
            if (error) throw error;

            console.log('Kardex data received:', data?.length || 0, 'rows');
            setRows(data || []);
            setPage(0);

            // Fetch order numbers for UUID references found in the dataset
            if (data && data.length > 0) {
                const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
                const foundIds = new Set<string>();

                data.forEach(m => {
                    if (m.reference) {
                        const match = m.reference.match(uuidPattern);
                        if (match) foundIds.add(match[0].toLowerCase());
                    }
                });

                if (foundIds.size > 0) {
                    const idList = Array.from(foundIds);
                    const mapping: Record<string, string> = {};
                    const statuses: Record<string, string> = {};

                    // 1. Buscar en TABLA ORDERS
                    const { data: directOrders } = await supabase
                        .from('orders')
                        .select('id, order_number, status')
                        .in('id', idList);

                    if (directOrders) {
                        directOrders.forEach(o => {
                            const idLow = o.id.toLowerCase();
                            mapping[idLow] = o.order_number?.toString() || '--';
                            statuses[idLow] = o.status?.toUpperCase() || '';
                        });
                    }

                    // 2. Buscar en TABLA ORDER_ITEMS (para los IDs que faltan)
                    const missingIds = idList.filter(id => !mapping[id]);
                    if (missingIds.length > 0) {
                        const { data: itemData } = await supabase
                            .from('order_items')
                            .select('id, order_id, orders!inner(order_number, status)')
                            .in('id', missingIds);

                        if (itemData) {
                            itemData.forEach((it: any) => {
                                const idLow = it.id.toLowerCase();
                                const num = it.orders?.order_number?.toString();
                                if (num) {
                                    mapping[idLow] = num;
                                    statuses[idLow] = it.orders?.status?.toUpperCase() || '';
                                }
                            });
                        }
                    }

                    setOrderNumbers(prev => ({ ...prev, ...mapping }));
                    setOrderStatuses(prev => ({ ...prev, ...statuses }));
                }
            }
        } catch (err: any) {
            console.error('Kardex fetch error:', err.message);
        }
        setLoading(false);
    }, [filterBranch, filterProduct, filterType, filterStart, filterEnd]);

    useEffect(() => { fetchKardex(); }, [fetchKardex]);

    // Summary stats
    const totalIn = rows.reduce((a, r) => a + (Number(r.quantity_in) || 0), 0);
    const totalOut = rows.reduce((a, r) => a + (Number(r.quantity_out) || 0), 0);
    const lastBalance = rows[0]?.balance ?? 0;
    const lastBalanceValue = rows[0]?.balance_value ?? 0;

    // Paginated slice
    const paginated = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages = Math.ceil(rows.length / PAGE_SIZE);

    // Excel Export
    const handleExportExcel = () => {
        const exportData = rows.map(r => {
            let friendyRef = r.reference || '';
            const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
            const match = r.reference?.match(uuidPattern);
            if (match && orderNumbers[match[0].toLowerCase()]) {
                friendyRef = 'ORDEN #' + orderNumbers[match[0].toLowerCase()];
            }

            const prod = products.find(p => p.id === r.item_id);
            const branch = branches.find(b => b.id === r.branch_id);

            return {
                'Fecha/Hora': new Date(r.created_at).toLocaleString('es-GT'),
                'Sucursal': branch?.name || '',
                'Producto': prod?.display_name || prod?.name || '---',
                'Código': (prod as any)?.code || (prod as any)?.product_code || '',
                'Tipo Movimiento': r.movement_type,
                'Referencia': friendyRef,
                'Usuario': r.user_name || '',
                'Dispositivo': r.device || '',
                'Entrada': r.quantity_in,
                'Salida': r.quantity_out,
                'Saldo': r.balance,
                'Costo Unitario (Q)': r.unit_cost,
                'Saldo en Valores (Q)': r.balance_value,
                'Notas': r.notes || ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const colWidths = [
            { wpx: 130 }, { wpx: 150 }, { wpx: 200 }, { wpx: 100 },
            { wpx: 120 }, { wpx: 120 }, { wpx: 100 }, { wpx: 120 },
            { wpx: 70 },  { wpx: 70 },  { wpx: 70 },  { wpx: 110 },
            { wpx: 120 }, { wpx: 200 }
        ];
        worksheet['!cols'] = colWidths;
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Kardex');
        XLSX.writeFile(workbook, `Kardex_${filterStart}_al_${filterEnd}.xlsx`);
    };

    // Print / PDF
    const handlePrint = () => {
        const branchLabel = filterBranch === 'ALL' ? 'Todas' : branches.find(b => b.id === filterBranch)?.name || '';
        const productLabel = filterProduct === 'ALL' ? 'Todos' : products.find(p => p.id === filterProduct)?.name || '';

        const rowsHtml = rows.map(r => {
            const prod = products.find(p => p.id === r.item_id);
            const branch = branches.find(b => b.id === r.branch_id);
            
            return `
            <tr>
                <td>${new Date(r.created_at).toLocaleString('es-GT')}</td>
                <td>${branch?.name || '—'}</td>
                <td>${prod?.display_name || prod?.name || '—'}</td>
                <td style="text-align:center">${r.movement_type}</td>
                <td>${(() => {
                    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
                    const match = r.reference?.match(uuidPattern);
                    if (match && orderNumbers[match[0].toLowerCase()]) {
                        return 'ORDEN #' + orderNumbers[match[0].toLowerCase()];
                    }
                    return r.reference || '—';
                })()}</td>
                <td>${r.user_name || '—'}</td>
                <td>${r.device || '—'}</td>
                <td style="text-align:right;color:green">${r.quantity_in > 0 ? '+' + r.quantity_in : ''}</td>
                <td style="text-align:right;color:red">${r.quantity_out > 0 ? '-' + r.quantity_out : ''}</td>
                <td style="text-align:right;font-weight:bold">${r.balance}</td>
                <td style="text-align:right">Q${Number(r.unit_cost).toFixed(2)}</td>
                <td style="text-align:right">Q${Number(r.balance_value).toFixed(2)}</td>
            </tr>
        `}).join('');

        const win = window.open('', '_blank', 'width=1200,height=900');
        if (!win) return;
        win.document.write(`
            <html>
            <head>
                <title>Kardex de Inventario</title>
                <style>
                    @page { size: A4 landscape; margin: 8mm 10mm; }
                    * { font-family: Arial, sans-serif; font-size: 7pt; }
                    body { color: #000; }
                    h1 { font-size: 12pt; margin: 0 0 2px; text-align: center; }
                    .sub { font-size: 8pt; text-align: center; color: #555; margin-bottom: 6px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
                    th { background: #106ebe; color: #fff; padding: 3px 4px; font-size: 6.5pt; text-align: left; white-space: nowrap; }
                    td { padding: 2px 4px; border-bottom: 1px solid #e2e8f0; }
                    tr:nth-child(even) td { background: #f8fafc; }
                    .footer { margin-top: 10px; font-size: 7pt; text-align: right; color: #888; }
                </style>
            </head>
            <body>
                <h1>RESTAURANTE LAS PALMAS — KARDEX DE INVENTARIO</h1>
                <div class="sub">
                    Sucursal: <strong>${branchLabel}</strong> &nbsp;|&nbsp;
                    Producto: <strong>${productLabel}</strong> &nbsp;|&nbsp;
                    Período: <strong>${filterStart}</strong> al <strong>${filterEnd}</strong> &nbsp;|&nbsp;
                    Tipo: <strong>${filterType}</strong> &nbsp;|&nbsp;
                    Total registros: <strong>${rows.length}</strong>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Fecha/Hora</th>
                            <th>Sucursal</th>
                            <th>Producto</th>
                            <th>Tipo</th>
                            <th>Referencia</th>
                            <th>Usuario</th>
                            <th>Dispositivo</th>
                            <th>Entrada</th>
                            <th>Salida</th>
                            <th>Saldo</th>
                            <th>Costo Unit.</th>
                            <th>Saldo en Q</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <div class="footer">
                    Generado: ${new Date().toLocaleString('es-GT')} — Sistema POS Las Palmas
                </div>
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
    };

    const selectedProductName = filterProduct === 'ALL'
        ? ''
        : products.find(p => p.id === filterProduct)?.display_name || '';

    return (
        <div className="flex-1 h-full bg-slate-50 font-['Montserrat'] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-3 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap flex-1">
                    {/* Branch */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 min-w-[280px]">
                        <Building2 size={14} className="text-slate-400 shrink-0" />
                        <select
                            value={filterBranch}
                            onChange={e => setFilterBranch(e.target.value)}
                            className="bg-transparent outline-none text-[10px] font-black uppercase text-slate-700 w-full"
                        >
                            <option value="ALL">TODAS SUCURSALES</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    {/* Product Autocomplete */}
                    <div className="relative min-w-[200px]">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={searchProduct || selectedProductName}
                            onChange={e => {
                                setSearchProduct(e.target.value);
                                setShowProductDropdown(true);
                                if (!e.target.value) setFilterProduct('ALL');
                            }}
                            onFocus={() => { setSearchProduct(''); setShowProductDropdown(true); }}
                            className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400"
                        />
                        {(filterProduct !== 'ALL') && (
                            <button onClick={() => { setFilterProduct('ALL'); setSearchProduct(''); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-400">
                                <X size={12} />
                            </button>
                        )}
                        {showProductDropdown && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden max-h-52 overflow-y-auto">
                                <button onClick={() => { setFilterProduct('ALL'); setSearchProduct(''); setShowProductDropdown(false); }}
                                    className="w-full text-left px-4 py-2 text-[10px] font-black text-slate-400 hover:bg-slate-50 border-b border-slate-50">
                                    TODOS LOS PRODUCTOS
                                </button>
                                {products
                                    .filter(p => (p.display_name || '').toLowerCase().includes((searchProduct || '').toLowerCase()))
                                    .slice(0, 30)
                                    .map(p => (
                                        <button key={p.id}
                                            onClick={() => { setFilterProduct(p.id); setSearchProduct(''); setShowProductDropdown(false); }}
                                            className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border-b border-slate-50 last:border-0">
                                            {p.display_name}
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Movement type */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <Filter size={13} className="text-slate-400" />
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value as MovementType)}
                            className="bg-transparent outline-none text-[10px] font-black uppercase text-slate-700"
                        >
                            <option value="ALL">TODOS LOS TIPOS</option>
                            <option value="COMPRA">COMPRA</option>
                            <option value="VENTA">VENTA</option>
                            <option value="NIVELACION">NIVELACIÓN</option>
                            <option value="DEVOLUCION">DEVOLUCIÓN</option>
                            <option value="TRASLADO">TRASLADO</option>
                            <option value="ANULACION">ANULACIÓN</option>
                        </select>
                    </div>

                    {/* Date range */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <Calendar size={13} className="text-slate-400" />
                        <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)}
                            className="bg-transparent outline-none text-[10px] font-black text-slate-700" />
                        <ArrowRight size={12} className="text-slate-300" />
                        <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
                            className="bg-transparent outline-none text-[10px] font-black text-slate-700" />
                    </div>

                    <button onClick={fetchKardex} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all" title="Actualizar">
                        <RefreshCw size={15} />
                    </button>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={handleExportExcel}
                        disabled={rows.length === 0}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all active:scale-95"
                    >
                        <FileSpreadsheet size={13} /> Exportar Excel
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={rows.length === 0}
                        className="flex items-center gap-2 bg-[#106ebe] hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all active:scale-95"
                    >
                        <Printer size={13} /> Imprimir PDF
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <FileText size={16} />
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Registros</span>
                        <span className="text-base font-black text-slate-800">{rows.length.toLocaleString()}</span>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3">
                    <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                        <TrendingUp size={16} />
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">Total Entradas</span>
                        <span className="text-base font-black text-emerald-600">+{totalIn.toLocaleString()}</span>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-rose-100 shadow-sm flex items-center gap-3">
                    <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500">
                        <TrendingDown size={16} />
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block">Total Salidas</span>
                        <span className="text-base font-black text-rose-600">-{totalOut.toLocaleString()}</span>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center text-violet-500">
                        <BarChart3 size={16} />
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Último Saldo Val.</span>
                        <span className="text-base font-black text-slate-800">Q{lastBalanceValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden px-6 pb-3 flex flex-col min-h-0" onClick={() => setShowProductDropdown(false)}>
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-auto">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                                <Loader2 size={36} className="animate-spin text-indigo-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Cargando Kardex...</span>
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-300">
                                <BookOpen size={48} />
                                <div className="text-center">
                                    <p className="text-[11px] font-black uppercase tracking-widest">Sin movimientos registrados</p>
                                    <p className="text-[9px] font-bold mt-1">Ajusta los filtros o realiza una compra/nivelación</p>
                                </div>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse" style={{ minWidth: '1100px' }}>
                                <thead className="sticky top-0 bg-[#e8e8e8] z-10 border-b border-gray-400">
                                    <tr className="text-[8.5px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="px-3 py-2.5 whitespace-nowrap">Fecha / Hora</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap">Sucursal</th>
                                        <th className="px-3 py-2.5">Producto</th>
                                        <th className="px-3 py-2.5 text-center whitespace-nowrap">Tipo Mov.</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap">Referencia</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap">Usuario</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap">Dispositivo</th>
                                        <th className="px-3 py-2.5 text-right text-emerald-500 whitespace-nowrap">Entrada</th>
                                        <th className="px-3 py-2.5 text-right text-rose-500 whitespace-nowrap">Salida</th>
                                        <th className="px-3 py-2.5 text-right whitespace-nowrap">Saldo</th>
                                        <th className="px-3 py-2.5 text-right whitespace-nowrap">Costo Unit.</th>
                                        <th className="px-3 py-2.5 text-right whitespace-nowrap">Saldo en Q</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {paginated.map((row, index) => {
                                        const prod = products.find(p => p.id === row.item_id);
                                        const branch = branches.find(b => b.id === row.branch_id);
                                        
                                        return (
                                        <tr key={row.id} className={`h-7 transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'} hover:bg-[#f2f7fb]`}>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-700">
                                                        {new Date(row.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-slate-400 tabular-nums">
                                                        {new Date(row.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="text-[9px] font-bold text-slate-500">{branch?.name || row.branches?.name || '—'}</span>
                                            </td>
                                            <td className="px-3 py-2 max-w-[180px]">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-800 uppercase truncate">
                                                        {prod?.display_name || prod?.name || row.inventory_items?.nombre || row.inventory_items?.name || row.products?.name || '—'}
                                                    </span>
                                                    {((prod as any)?.product_code || (prod as any)?.code || row.inventory_items?.code || row.products?.product_code) && (
                                                        <span className="text-[8px] font-bold text-slate-400">
                                                            {(prod as any)?.product_code || (prod as any)?.code || row.inventory_items?.code || row.products?.product_code}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${(() => {
                                                    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
                                                    const match = row.reference?.match(uuidPattern);
                                                    const status = match ? orderStatuses[match[0].toLowerCase()] : '';
                                                    const isCancelled = status === 'CANCELLED' || status === 'ANULADO';

                                                    if (row.movement_type?.toUpperCase().includes('ANULACION') || isCancelled) {
                                                        return MOVEMENT_COLORS['ANULACION'];
                                                    }
                                                    return MOVEMENT_COLORS[row.movement_type] || 'bg-slate-50 text-slate-500 border-slate-200';
                                                })()}`}>
                                                    {(() => {
                                                        const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
                                                        const match = row.reference?.match(uuidPattern);
                                                        const status = match ? orderStatuses[match[0].toLowerCase()] : '';
                                                        const isCancelled = status === 'CANCELLED' || status === 'ANULADO';

                                                        let label = row.movement_type;
                                                        if (isCancelled) {
                                                            label = (label.includes('(') ? label.split('(')[0] : label) + ' (ANULADA)';
                                                        } else if (match && orderNumbers[match[0].toLowerCase()]) {
                                                            // Si es una venta comandada, mostramos el número de orden también en el tipo
                                                            label = `VENTA (#${orderNumbers[match[0].toLowerCase()]})`;
                                                        }
                                                        return label;
                                                    })()}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="text-[9px] font-bold text-slate-500">
                                                    {(() => {
                                                        const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
                                                        const match = row.reference?.match(uuidPattern);
                                                        if (match && orderNumbers[match[0].toLowerCase()]) {
                                                            return 'ORDEN #' + orderNumbers[match[0].toLowerCase()];
                                                        }
                                                        return row.reference || '—';
                                                    })()}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="text-[9px] font-bold text-slate-600">{row.user_name || '—'}</span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {row.device || '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                {row.quantity_in > 0 ? (
                                                    <span className="text-[11px] font-black text-emerald-600 tabular-nums">
                                                        +{row.quantity_in.toLocaleString()}
                                                    </span>
                                                ) : <span className="text-slate-200 text-sm">—</span>}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                {row.quantity_out > 0 ? (
                                                    <span className="text-[11px] font-black text-rose-600 tabular-nums">
                                                        -{row.quantity_out.toLocaleString()}
                                                    </span>
                                                ) : <span className="text-slate-200 text-sm">—</span>}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                <span className="text-[11px] font-black text-slate-900 tabular-nums">{row.balance.toLocaleString()}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                <span className="text-[9px] font-bold text-slate-500 tabular-nums">
                                                    Q{Number(row.unit_cost).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                <span className="text-[10px] font-black text-indigo-700 tabular-nums">
                                                    Q{Number(row.balance_value).toFixed(2)}
                                                </span>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} de {rows.length}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-all border border-slate-200"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="text-[10px] font-black text-slate-600">
                                    {page + 1} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-all border border-slate-200"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
