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

export const InventoryKardex: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
    const [rows, setRows] = useState<KardexRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

    // Filters
    const [filterBranch, setFilterBranch] = useState('ALL');
    const [filterProduct, setFilterProduct] = useState('ALL');
    const [filterType, setFilterType] = useState<MovementType>('ALL');
    const getLocalDateStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const [filterStart, setFilterStart] = useState(getLocalDateStr());
    const [filterEnd, setFilterEnd] = useState(getLocalDateStr());
    const [searchProduct, setSearchProduct] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);

    // Pagination
    const [page, setPage] = useState(0);
    const [orderNumbers, setOrderNumbers] = useState<Record<string, string>>({});
    const [orderStatuses, setOrderStatuses] = useState<Record<string, string>>({});

    useEffect(() => {
        Promise.all([
            supabase.from('branches').select('id, name').order('name'),
            supabase.from('inventory_items').select('id, name').order('name'),
        ]).then(([bRes, iRes]) => {
            if (bRes.data) setBranches(bRes.data);
            if (iRes.data) setProducts(iRes.data);
        });
    }, []);

    const fetchKardex = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('inventory_kardex')
                .select(`
                    *,
                    inventory_items(name, unit, code),
                    branches(name)
                `)
                .order('created_at', { ascending: false })
                .gte('created_at', filterStart + 'T00:00:00')
                .lte('created_at', filterEnd + 'T23:59:59');

            if (filterBranch !== 'ALL') query = query.eq('branch_id', filterBranch);
            if (filterProduct !== 'ALL') query = query.eq('item_id', filterProduct);
            if (filterType !== 'ALL') query = query.eq('movement_type', filterType);

            const { data, error } = await query.limit(1000);
            if (error) throw error;

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

                    // 1. Try to find these IDs directly in orders
                    const { data: directOrders } = await supabase
                        .from('orders')
                        .select('id, order_number, status')
                        .in('id', idList);

                    if (directOrders) {
                        directOrders.forEach(o => {
                            mapping[o.id.toLowerCase()] = o.order_number?.toString() || '--';
                            setOrderStatuses(prev => ({ ...prev, [o.id.toLowerCase()]: o.status?.toUpperCase() || '' }));
                        });
                    }

                    // 2. Try to find missing IDs in order_items (many kardex entries point to item_id)
                    const missingIds = idList.filter(id => !mapping[id]);
                    if (missingIds.length > 0) {
                        const { data: itemData } = await supabase
                            .from('order_items')
                            .select('id, order_id, orders(order_number, status)')
                            .in('id', missingIds);

                        if (itemData) {
                            itemData.forEach((it: any) => {
                                const num = it.orders?.order_number?.toString();
                                if (num) {
                                    mapping[it.id.toLowerCase()] = num;
                                    setOrderStatuses(prev => ({ ...prev, [it.id.toLowerCase()]: it.orders?.status?.toUpperCase() || '' }));
                                }
                            });
                        }
                    }

                    setOrderNumbers(prev => ({ ...prev, ...mapping }));
                }
            }
        } catch (err: any) {
            console.error('Kardex fetch error:', err.message);
        }
        setLoading(false);
    }, [filterBranch, filterProduct, filterType, filterStart, filterEnd]);

    useEffect(() => { fetchKardex(); }, [fetchKardex]);

    // Summary stats
    const totalIn = rows.reduce((a, r) => a + r.quantity_in, 0);
    const totalOut = rows.reduce((a, r) => a + r.quantity_out, 0);
    const lastBalance = rows[0]?.balance ?? 0;
    const lastBalanceValue = rows[0]?.balance_value ?? 0;

    // Paginated slice
    const paginated = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages = Math.ceil(rows.length / PAGE_SIZE);

    // Excel Export
    const handleExportExcel = () => {
        // Prepare data for Excel
        const exportData = rows.map(r => {
            let friendyRef = r.reference || '';
            const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
            const match = r.reference?.match(uuidPattern);
            if (match && orderNumbers[match[0].toLowerCase()]) {
                friendyRef = 'ORDEN #' + orderNumbers[match[0].toLowerCase()];
            }

            return {
                'Fecha/Hora': new Date(r.created_at).toLocaleString('es-GT'),
                'Sucursal': r.branches?.name || '',
                'Producto': r.inventory_items?.name || '',
                'Código': r.inventory_items?.code || '',
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

        // Create a new workbook and add the worksheet
        const worksheet = XLSX.utils.json_to_sheet(exportData);

        // Adjust column widths automatically based on content
        const colWidths = [
            { wpx: 130 }, // Fecha
            { wpx: 150 }, // Sucursal
            { wpx: 200 }, // Producto
            { wpx: 100 }, // Código
            { wpx: 120 }, // Tipo
            { wpx: 120 }, // Referencia
            { wpx: 100 }, // Usuario
            { wpx: 120 }, // Dispositivo
            { wpx: 70 },  // Entrada
            { wpx: 70 },  // Salida
            { wpx: 70 },  // Saldo
            { wpx: 110 }, // Costo
            { wpx: 120 }, // Saldo Q
            { wpx: 200 }  // Notas
        ];
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Kardex');

        // Generate Excel file
        XLSX.writeFile(workbook, `Kardex_${filterStart}_al_${filterEnd}.xlsx`);
    };

    // Print / PDF
    const handlePrint = () => {
        const branchLabel = filterBranch === 'ALL' ? 'Todas' : branches.find(b => b.id === filterBranch)?.name || '';
        const productLabel = filterProduct === 'ALL' ? 'Todos' : products.find(p => p.id === filterProduct)?.name || '';

        const rowsHtml = rows.map(r => `
            <tr>
                <td>${new Date(r.created_at).toLocaleString('es-GT')}</td>
                <td>${r.branches?.name || '—'}</td>
                <td>${r.inventory_items?.name || '—'}</td>
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
                <td style="text-align:right">Q${r.unit_cost.toFixed(2)}</td>
                <td style="text-align:right">Q${r.balance_value.toFixed(2)}</td>
            </tr>
        `).join('');

        const win = window.open('', '_blank', 'width=1200,height=900');
        if (!win) return;
        win.document.write(`
            <html>
            <head>
                <title>Kardex de Inventario</title>
                <style>
                    @page { size: A4 landscape; margin: 8mm 10mm; }
                    /*
                    === EPSON 80mm (descomentar al instalar) ===
                    @page { size: 80mm auto; margin: 2mm; }
                    */
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
        : products.find(p => p.id === filterProduct)?.name || '';

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
                                    .filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()))
                                    .slice(0, 30)
                                    .map(p => (
                                        <button key={p.id}
                                            onClick={() => { setFilterProduct(p.id); setSearchProduct(''); setShowProductDropdown(false); }}
                                            className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border-b border-slate-50 last:border-0">
                                            {p.name}
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
                                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
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
                                    {paginated.map(row => (
                                        <tr key={row.id} className="hover:bg-slate-50/60 transition-colors group">
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
                                                <span className="text-[9px] font-bold text-slate-500">{row.branches?.name || '—'}</span>
                                            </td>
                                            <td className="px-3 py-2 max-w-[180px]">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-800 uppercase truncate">
                                                        {row.inventory_items?.name || '—'}
                                                    </span>
                                                    {row.inventory_items?.code && (
                                                        <span className="text-[8px] font-bold text-slate-400">{row.inventory_items.code}</span>
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

                                                        return isCancelled
                                                            ? (row.movement_type.includes('(') ? row.movement_type.split('(')[0] : row.movement_type) + ' (ANULADA)'
                                                            : row.movement_type;
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
                                                    Q{row.unit_cost.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                <span className="text-[10px] font-black text-indigo-700 tabular-nums">
                                                    Q{row.balance_value.toFixed(2)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
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
