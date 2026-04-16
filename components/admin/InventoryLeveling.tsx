import React, { useState, useEffect, useRef } from 'react';
import {
    BarChart3, Save, Search, Loader2, X, AlertTriangle,
    CheckCircle, Building2, RefreshCw, Printer, Package,
    TrendingDown, TrendingUp, ClipboardList, Filter, Info, FileText,
    ChevronDown, Sparkles
} from 'lucide-react';
import { supabase } from '../../supabase';
import { DraggableWindow } from './AdminPortal';
import { activityLogService } from '../../services/ActivityLogService';

// Unit Conversion Logic (Consistente con InventoryProducts)
const INVENTORY_UNITS: Record<string, { factor: number, base: string, category: string }> = {
    'ML': { factor: 1, base: 'ML', category: 'Volumen' },
    'MILILITRO': { factor: 1, base: 'ML', category: 'Volumen' },
    'LT': { factor: 1000, base: 'ML', category: 'Volumen' },
    'LITRO': { factor: 1000, base: 'ML', category: 'Volumen' },
    'FL OZ': { factor: 29.5735, base: 'ML', category: 'Volumen' },
    'GL': { factor: 3785.41, base: 'ML', category: 'Volumen' },
    'GR': { factor: 1, base: 'GR', category: 'Masa' },
    'GRAMO': { factor: 1, base: 'GR', category: 'Masa' },
    'MG': { factor: 0.001, base: 'GR', category: 'Masa' },
    'KG': { factor: 1000, base: 'GR', category: 'Masa' },
    'LB': { factor: 453.592, base: 'GR', category: 'Masa' },
    'LIBRA': { factor: 453.592, base: 'GR', category: 'Masa' },
    'OZ': { factor: 28.3495, base: 'GR', category: 'Masa' },
    'ONZA': { factor: 28.3495, base: 'GR', category: 'Masa' },
    'UN': { factor: 1, base: 'UN', category: 'Conteo' },
    'UNIDAD': { factor: 1, base: 'UN', category: 'Conteo' },
    'POR': { factor: 1, base: 'UN', category: 'Conteo' },
    'CAJA': { factor: 1, base: 'UN', category: 'Conteo' },
    'BOLSA': { factor: 1, base: 'UN', category: 'Conteo' },
};

const convertQuantity = (qty: number, from: string, to: string) => {
    // Limpieza de código de unidad (ej: "Mililitro (ML)" -> "ML")
    const cleanUnit = (u: string) => {
        if (!u) return '';
        const match = u.match(/\(([^)]+)\)/);
        return (match ? match[1] : u).toUpperCase().trim();
    };

    const uFrom = INVENTORY_UNITS[cleanUnit(from)];
    const uTo = INVENTORY_UNITS[cleanUnit(to)];

    if (!uFrom || !uTo || uFrom.category !== uTo.category) return qty;
    return (qty * uFrom.factor) / uTo.factor;
};

interface LevelingRow {
    item_id: string;
    code: string;
    name: string;
    unit: string;
    cost: number;
    presentation: string;
    category_name: string;
    system_stock: number;
    physical_stock: number | string;
    display_unit: string;
    normalized_physical: number | string;
    difference: number;
}

interface Branch { id: string; name: string; }

export const InventoryLeveling: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [rows, setRows] = useState<LevelingRow[]>([]);
    const [filteredRows, setFilteredRows] = useState<LevelingRow[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Session tracking
    const [sessionRows, setSessionRows] = useState<LevelingRow[]>([]);
    const [showConfirm, setShowConfirm] = useState(false);
    const [notes, setNotes] = useState('');
    const [notesError, setNotesError] = useState(false);

    // Print Count Sheet Modal
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printFormat, setPrintFormat] = useState<'SUCURSAL' | 'CATEGORIA'>('CATEGORIA');

    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        supabase.from('branches').select('*').order('name').then(({ data }) => {
            if (data) {
                setBranches(data);
                if (data.length > 0) setSelectedBranch(data[0].id);
            }
        });
    }, []);

    useEffect(() => {
        if (selectedBranch) fetchStock();
    }, [selectedBranch]);

    useEffect(() => {
        const q = search.toLowerCase();
        setFilteredRows(
            rows.filter(r => r.name.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q))
        );
    }, [search, rows]);

    const fetchStock = async () => {
        setLoading(true);
        setRows([]);
        setSessionRows([]);
        setSearch('');
        try {
            // Get all items with their branch stock
            const { data: items } = await supabase
                .from('inventory_items')
                .select(`id, code, name, unit, cost, presentation, inventory_categories(name)`)
                .order('name');

            const { data: branchStock } = await supabase
                .from('inventory_item_branches')
                .select('item_id, quantity')
                .eq('branch_id', selectedBranch);

            const stockMap: Record<string, number> = {};
            (branchStock || []).forEach(b => { stockMap[b.item_id] = b.quantity; });

            const mapped: LevelingRow[] = (items || []).map((item: any) => ({
                item_id: item.id,
                code: item.code || '',
                name: item.name,
                unit: item.unit || 'UN',
                cost: item.cost || 0,
                presentation: item.presentation || 'N/A',
                category_name: item.inventory_categories?.name || 'SIN CATEGORÍA',
                system_stock: stockMap[item.id] ?? 0,
                physical_stock: '',
                display_unit: item.unit || 'UN',
                normalized_physical: '',
                difference: 0,
            }));

            setRows(mapped);
            setFilteredRows(mapped);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const handlePhysicalChange = (item_id: string, value: string) => {
        setRows(prev =>
            prev.map(r => {
                if (r.item_id !== item_id) return r;
                const rawPhysical = value === '' ? '' : parseFloat(value) || 0;

                // Convertimos de la unidad de visualización a la del sistema
                const normalizedPhys = rawPhysical === '' ? '' : convertQuantity(rawPhysical as number, r.display_unit, r.unit);
                const diff = normalizedPhys === '' ? 0 : (normalizedPhys as number) - r.system_stock;

                return {
                    ...r,
                    physical_stock: value,
                    normalized_physical: normalizedPhys,
                    difference: diff
                };
            })
        );
    };

    const handleUnitChange = (item_id: string, newUnit: string) => {
        setRows(prev =>
            prev.map(r => {
                if (r.item_id !== item_id) return r;

                const rawPhysical = r.physical_stock === '' ? '' : parseFloat(r.physical_stock as string) || 0;
                const normalizedPhys = rawPhysical === '' ? '' : convertQuantity(rawPhysical as number, newUnit, r.unit);
                const diff = normalizedPhys === '' ? 0 : (normalizedPhys as number) - r.system_stock;

                return {
                    ...r,
                    display_unit: newUnit,
                    normalized_physical: normalizedPhys,
                    difference: diff
                };
            })
        );
    };

    // Track items that were actually edited
    const getAuditedRows = () =>
        rows.filter(r => r.physical_stock !== '' && r.physical_stock !== r.system_stock);

    const mermas = getAuditedRows()
        .filter(r => r.difference < 0)
        .reduce((acc, r) => acc + Math.abs(r.difference) * r.cost, 0);

    const sobrantes = getAuditedRows()
        .filter(r => r.difference > 0)
        .reduce((acc, r) => acc + r.difference * r.cost, 0);

    const handleConfirmOpen = () => {
        const edited = getAuditedRows();
        if (edited.length === 0) {
            alert('No hay productos con conteo físico ingresado para nivelar.');
            return;
        }
        setSessionRows(edited);
        setNotes('');
        setNotesError(false);
        setShowConfirm(true);
    };

    const getDeviceName = () => {
        const ua = navigator.userAgent;
        if (/mobile/i.test(ua)) return 'Celular-' + (currentUser?.name || 'Usuario');
        return 'PC-' + (currentUser?.name || 'Admin');
    };

    const handleSave = async () => {
        if (!notes.trim()) { setNotesError(true); return; }
        setSaving(true);
        try {
            const device = getDeviceName();
            const userName = currentUser?.full_name || currentUser?.name || 'Sistema';
            const userId = currentUser?.id || null;

            for (const row of sessionRows) {
                // La cantidad normalizada es la que realmente afecta el stock (convertida a unidad base)
                const normalizedPhysStock = typeof row.normalized_physical === 'string'
                    ? (row.normalized_physical === '' ? row.system_stock : parseFloat(row.normalized_physical))
                    : row.normalized_physical;

                const diff = normalizedPhysStock - row.system_stock;

                // 1. Update branch stock
                const { data: existing } = await supabase
                    .from('inventory_item_branches')
                    .select('id, quantity')
                    .eq('item_id', row.item_id)
                    .eq('branch_id', selectedBranch)
                    .single();

                if (existing) {
                    await supabase
                        .from('inventory_item_branches')
                        .update({ quantity: normalizedPhysStock })
                        .eq('item_id', row.item_id)
                        .eq('branch_id', selectedBranch);
                } else {
                    await supabase.from('inventory_item_branches').insert({
                        item_id: row.item_id,
                        branch_id: selectedBranch,
                        quantity: normalizedPhysStock,
                        is_enabled: true,
                        is_assigned: true
                    });
                }

                // 2. Update global stock in inventory_items (apply diff)
                const { data: globalItem } = await supabase
                    .from('inventory_items')
                    .select('quantity')
                    .eq('id', row.item_id)
                    .single();

                if (globalItem) {
                    await supabase.from('inventory_items')
                        .update({ quantity: (globalItem.quantity || 0) + diff })
                        .eq('id', row.item_id);
                }

                // 3. Get new running balance for kardex (approximate with branch stock)
                const newBalance = normalizedPhysStock;
                const balanceValue = newBalance * row.cost;

                // 4. Insert into inventory_kardex
                await supabase.from('inventory_kardex').insert({
                    branch_id: selectedBranch,
                    item_id: row.item_id,
                    movement_type: 'NIVELACION',
                    reference: 'AJUSTE FÍSICO',
                    user_id: userId,
                    user_name: userName,
                    device: device,
                    quantity_in: diff > 0 ? diff : 0,
                    quantity_out: diff < 0 ? Math.abs(diff) : 0,
                    balance: newBalance,
                    unit_cost: row.cost,
                    balance_value: balanceValue,
                    notes: `${notes.trim()} (Captura: ${row.physical_stock} ${row.display_unit})`
                });

                // 5. Insert into inventory_levelings for audit history
                await supabase.from('inventory_levelings').insert({
                    branch_id: selectedBranch,
                    item_id: row.item_id,
                    user_id: userId,
                    user_name: userName,
                    device: device,
                    system_stock: row.system_stock,
                    physical_stock: typeof row.physical_stock === 'string' ? parseFloat(row.physical_stock) || 0 : row.physical_stock,
                    difference: diff,
                    notes: notes.trim()
                });
            }

            setShowConfirm(false);
            setNotes('');
            alert(`✅ Nivelación procesada: ${sessionRows.length} producto(s) ajustado(s).`);

            // LOG: Inventory Leveled
            activityLogService.log({
                user: currentUser,
                module: 'INVENTARIO',
                action: 'Nivelación de Existencia',
                details: {
                    branchId: selectedBranch,
                    branchName: branches.find(b => b.id === selectedBranch)?.name,
                    itemsAdjusted: sessionRows.length,
                    mermas: mermas,
                    sobrantes: sobrantes,
                    notes: notes.trim()
                }
            });

            fetchStock();
        } catch (err: any) {
            alert('Error al guardar nivelación: ' + err.message);
        }
        setSaving(false);
    };

    const handlePrintCierre = () => {
        const branchName = branches.find(b => b.id === selectedBranch)?.name || 'N/A';
        const audited = getAuditedRows();
        const now = new Date().toLocaleString('es-GT');

        const content = `
            <html>
            <head>
                <title>Cierre de Inventario</title>
                <style>
                    /* === CANON A4 (default) === */
                    @page { size: A4; margin: 10mm 15mm; }
                    /*
                    === PARA EPSON 80mm (descomentar cuando la instales) ===
                    @page { size: 80mm auto; margin: 2mm 3mm; }
                    */
                    * { font-family: 'Courier New', monospace; font-size: 9pt; }
                    body { color: #000; }
                    h1 { font-size: 14pt; text-align: center; margin: 0 0 4px; }
                    h2 { font-size: 10pt; text-align: center; margin: 0 0 8px; font-weight: normal; }
                    .meta { font-size: 8pt; text-align: center; margin-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                    th { background: #000; color: #fff; padding: 3px 5px; font-size: 8pt; text-align: left; }
                    td { padding: 2px 5px; font-size: 8pt; border-bottom: 1px dotted #ccc; }
                    .right { text-align: right; }
                    .center { text-align: center; }
                    .neg { color: #c00; font-weight: bold; }
                    .pos { color: #080; font-weight: bold; }
                    .summary { margin-top: 12px; border-top: 2px solid #000; padding-top: 6px; }
                    .summary-row { display: flex; justify-content: space-between; padding: 2px 0; }
                    .footer { margin-top: 20px; border-top: 1px solid #000; padding-top: 8px; font-size: 8pt; }
                    .sig { margin-top: 40px; border-top: 1px solid #000; width: 60%; text-align: center; margin-left: auto; margin-right: auto; }
                </style>
            </head>
            <body>
                <h1>RESTAURANTE LAS PALMAS</h1>
                <h2>CIERRE DE INVENTARIO FÍSICO</h2>
                <div class="meta">
                    Sucursal: <strong>${branchName}</strong> &nbsp;|&nbsp;
                    Fecha: <strong>${now}</strong><br/>
                    Responsable: <strong>${currentUser?.full_name || currentUser?.name || 'N/A'}</strong>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th class="right">Sistema</th>
                            <th class="right">Físico</th>
                            <th class="right">Dif.</th>
                            <th class="right">Valor Dif.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${audited.length === 0
                ? `<tr><td colspan="5" style="text-align:center;padding:10px;">Sin productos contados en esta sesión</td></tr>`
                : audited.map(r => {
                    const phys = typeof r.physical_stock === 'string'
                        ? parseFloat(r.physical_stock) || 0
                        : r.physical_stock;
                    const diffVal = r.difference * r.cost;
                    return `<tr>
                                    <td>${r.name}</td>
                                    <td class="right">${r.system_stock}</td>
                                    <td class="right">${phys}</td>
                                    <td class="right ${r.difference < 0 ? 'neg' : r.difference > 0 ? 'pos' : ''}">${r.difference > 0 ? '+' : ''}${r.difference}</td>
                                    <td class="right ${diffVal < 0 ? 'neg' : diffVal > 0 ? 'pos' : ''}">Q${diffVal.toFixed(2)}</td>
                                </tr>`;
                }).join('')
            }
                    </tbody>
                </table>
                <div class="summary">
                    <div class="summary-row"><span>Artículos revisados:</span><span>${audited.length}</span></div>
                    <div className="summary-row neg"><span>Total Pérdida:</span><span>Q${mermas.toFixed(2)}</span></div>
                    <div class="summary-row pos"><span>Total Sobrantes:</span><span>Q${sobrantes.toFixed(2)}</span></div>
                    <div class="summary-row" style="font-weight:bold;border-top:1px solid #000;padding-top:4px;">
                        <span>Diferencia Neta:</span>
                        <span>Q${(sobrantes - mermas).toFixed(2)}</span>
                    </div>
                </div>
                <div class="footer">
                    Documento generado automáticamente por el sistema POS Las Palmas.<br/>
                    Los datos reflejan el conteo físico realizado en esta sesión.
                </div>
                <div class="sig">
                    <p>Firma y Sello del Responsable</p>
                </div>
            </body>
            </html>
        `;

        const win = window.open('', '_blank', 'width=800,height=900');
        if (win) {
            win.document.write(content);
            win.document.close();
            win.focus();
            setTimeout(() => { win.print(); win.close(); }, 500);
        }
    };

    const handlePrintPhysicalSheet = () => {
        const branchName = branches.find(b => b.id === selectedBranch)?.name || 'N/A';
        const now = new Date().toLocaleString('es-GT');
        const printUser = currentUser?.full_name || currentUser?.name || 'Sistema';

        let sortedRows = [...filteredRows]; // Current filtered view

        let groupsHtml = '';

        if (printFormat === 'CATEGORIA') {
            // Group and Sort by Category, then by Name
            const groups: Record<string, LevelingRow[]> = {};
            sortedRows.forEach(r => {
                if (!groups[r.category_name]) groups[r.category_name] = [];
                groups[r.category_name].push(r);
            });

            const sortedCategories = Object.keys(groups).sort();

            groupsHtml = sortedCategories.map(cat => {
                const catRows = groups[cat].sort((a, b) => a.name.localeCompare(b.name));
                return `
                    <h3 class="cat-header">${cat}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 55%">Descripción del Producto</th>
                                <th style="width: 20%">Presentación</th>
                                <th style="width: 25%" class="center count-header">CONTEO REAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${catRows.map(r => `
                                <tr>
                                    <td><div class="prod-desc">${r.name}</div></td>
                                    <td>${r.presentation}</td>
                                    <td class="count-box"></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }).join('');
        } else {
            // Sort by branch (straight alphabetical)
            sortedRows.sort((a, b) => a.name.localeCompare(b.name));
            groupsHtml = `
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 55%">Descripción del Producto</th>
                                <th style="width: 20%">Presentación</th>
                                <th style="width: 25%" class="center count-header">CONTEO REAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedRows.map(r => `
                                <tr>
                                    <td><div class="prod-desc">${r.name}</div></td>
                                    <td>${r.presentation}</td>
                                    <td class="count-box"></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
            `;
        }

        const content = `
            <html>
            <head>
                <title>Hoja de Conteo Físico</title>
                <style>
                    @page { size: Letter; margin: 15mm 15mm; }
                    * { font-family: Arial, sans-serif; font-size: 10pt; box-sizing: border-box; }
                    body { color: #000; margin: 0; padding: 0; }
                    .header-box { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                    .title { margin: 0; font-size: 16pt; font-weight: bold; text-transform: uppercase; }
                    .subtitle { margin: 4px 0 0 0; font-size: 11pt; color: #444; }
                    .meta-info { text-align: right; font-size: 9pt; color: #555; }
                    .cat-header { font-size: 12pt; background: #f0f0f0; padding: 6px 10px; border-left: 4px solid #333; margin: 25px 0 10px 0; font-weight: bold; text-transform: uppercase; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                    th { border: 1px solid #000; padding: 8px 5px; font-weight: bold; background: #e5e5e5; text-align: left; }
                    td { border: 1px solid #000; padding: 6px 5px; vertical-align: middle; }
                    .center { text-align: center; }
                    .count-header { font-size: 9pt; background: #fff; }
                    .count-box { background: #fafafa; height: 30px; }
                    .prod-desc { font-weight: bold; font-size: 9.5pt; text-transform: uppercase; }
                    .footer { position: fixed; bottom: 0; left: 0; width: 100%; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 5px; display: flex; justify-content: space-between; }
                </style>
            </head>
            <body>
                <div class="header-box">
                    <div>
                        <h1 class="title">Hoja de Conteo Físico</h1>
                        <h2 class="subtitle">Sucursal: <strong>${branchName}</strong></h2>
                    </div>
                    <div class="meta-info">
                        <strong>Fecha de Emisión:</strong><br/>
                        ${now}
                    </div>
                </div>
                
                ${groupsHtml}

                <div class="footer">
                    <div>RESTAURANTE LAS PALMAS POS — Módulo de Inventarios</div>
                    <div><strong>Impreso por:</strong> ${printUser} a las ${now}</div>
                </div>
            </body>
            </html>
        `;

        const win = window.open('', '_blank', 'width=1000,height=900');
        if (win) {
            win.document.write(content);
            win.document.close();
            win.focus();
            setTimeout(() => { win.print(); win.close(); }, 500);
        }
        setShowPrintModal(false);
    };

    const branchName = branches.find(b => b.id === selectedBranch)?.name || '';
    const auditedCount = getAuditedRows().length;

    return (
        <div className="flex-1 h-full bg-slate-50 font-['Montserrat'] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 md:px-6 py-3 bg-[#eaeff5] border-b border-slate-200 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 z-20 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 shadow-sm">
                            <ClipboardList size={18} />
                        </div>
                        <h2 className="text-sm font-black text-slate-700 uppercase tracking-tight leading-none">Nivelación de Existencia</h2>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {/* Branch Selector */}
                        <div className="flex-1 sm:flex-none flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm min-w-[280px]">
                            <Building2 size={14} className="text-slate-400" />
                            <select
                                value={selectedBranch}
                                onChange={e => setSelectedBranch(e.target.value)}
                                className="bg-transparent outline-none text-[10px] font-black uppercase text-slate-700 w-full"
                            >
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>

                        <button onClick={fetchStock} className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-400 transition-all shadow-sm" title="Recargar">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                    <button
                        onClick={() => setShowPrintModal(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl font-black text-[9px] tracking-widest uppercase transition-all whitespace-nowrap shadow-sm"
                    >
                        <FileText size={14} /> <span className="hidden sm:inline">Hoja de Conteo</span><span className="inline sm:hidden">Hoja</span>
                    </button>
                    <button
                        onClick={handlePrintCierre}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#106ebe] hover:bg-slate-700 text-white px-3 py-2 rounded-xl font-black text-[9px] tracking-widest uppercase transition-all whitespace-nowrap"
                    >
                        <Printer size={14} /> <span className="hidden sm:inline">Cierre de Inventario</span><span className="inline sm:hidden">Cierre</span>
                    </button>
                    <button
                        onClick={handleConfirmOpen}
                        disabled={loading}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-black text-[9px] tracking-widest uppercase shadow-lg transition-all whitespace-nowrap"
                    >
                        <Save size={14} /> <span className="hidden sm:inline">Procesar Nivelación</span><span className="inline sm:hidden">Procesar</span>
                    </button>
                </div>
            </div>

            {/* Sub-Header: Search & Stats Toggles on Mobile */}
            <div className={`px-4 md:px-6 py-2 bg-[#eaeff5]/50 border-b border-slate-200 flex flex-col md:flex-row md:items-center gap-3 ${isMobile ? 'sticky top-0 z-10' : ''}`}>
                {/* Search */}
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o código..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-sm"
                    />
                </div>
                {!isMobile && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <TrendingUp size={14} /> {filteredRows.length} items filtrados
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="px-4 md:px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0 overflow-x-auto no-scrollbar">
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 min-w-[140px]">
                    <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <ClipboardList size={14} />
                    </div>
                    <div className="overflow-hidden">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block truncate">Sesión</span>
                        <span className="text-xs font-black text-slate-800 tabular-nums">{auditedCount} / {rows.length}</span>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-rose-100 shadow-sm flex items-center gap-3 min-w-[140px]">
                    <div className="w-8 h-8 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500">
                        <TrendingDown size={14} />
                    </div>
                    <div className="overflow-hidden">
                        <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest block truncate">Pérdida (-)</span>
                        <span className="text-xs font-black text-rose-500 tabular-nums">Q{mermas.toFixed(2)}</span>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3 min-w-[140px]">
                    <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                        <TrendingUp size={14} />
                    </div>
                    <div className="overflow-hidden">
                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block truncate">Sobrantes (+)</span>
                        <span className="text-xs font-black text-emerald-500 tabular-nums">Q{sobrantes.toFixed(2)}</span>
                    </div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 min-w-[140px]">
                    <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                        <BarChart3 size={14} />
                    </div>
                    <div className="overflow-hidden">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block truncate">Diferencia</span>
                        <span className={`text-xs font-black tabular-nums ${sobrantes - mermas < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            Q{(sobrantes - mermas).toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden px-4 md:px-6 pb-6 flex flex-col">
                <div className="flex-1 bg-white md:bg-transparent rounded-2xl border-0 md:border md:border-slate-200 md:shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-300 py-20">
                                <Loader2 size={48} className="animate-spin text-indigo-500" />
                                <span className="text-[11px] font-black uppercase tracking-widest">Cargando inventario...</span>
                            </div>
                        ) : !isMobile ? (
                            <table className="w-full text-left border-collapse min-w-[800px] bg-white">
                                <thead className="sticky top-0 bg-[#eaeff5] z-10 border-b border-slate-300 shadow-sm">
                                    <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-700 h-10">
                                        <th className="px-4 py-1">Código</th>
                                        <th className="px-4 py-1">Producto</th>
                                        <th className="px-4 py-1 text-center">U. Medida</th>
                                        <th className="px-4 py-1 text-center">Existencia Sistema</th>
                                        <th className="px-4 py-1 text-center">Conteo Físico</th>
                                        <th className="px-4 py-1 text-center">Diferencia</th>
                                        <th className="px-4 py-1 text-right">Costo Unit.</th>
                                        <th className="px-4 py-1 text-right">Valor Dif.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-24 text-center">
                                                <div className="flex flex-col items-center gap-4 text-slate-200">
                                                    <Package size={64} className="opacity-20" />
                                                    <span className="text-[12px] font-black uppercase tracking-widest text-slate-400">
                                                        {search ? 'Sin resultados para tu búsqueda' : 'No hay productos en esta sucursal'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRows.map(row => {
                                            const phys = typeof row.physical_stock === 'string'
                                                ? (row.physical_stock === '' ? null : parseFloat(row.physical_stock) || 0)
                                                : row.physical_stock;
                                            const diff = phys !== null ? phys - row.system_stock : 0;
                                            const valueDiff = diff * row.cost;
                                            const isEdited = row.physical_stock !== '';

                                            return (
                                                <tr
                                                    key={row.item_id}
                                                    className={`group transition-colors border-b border-slate-100 h-11 ${isEdited
                                                        ? diff < 0 ? 'bg-rose-50/20' : diff > 0 ? 'bg-emerald-50/20' : 'bg-slate-50/40'
                                                        : 'hover:bg-slate-50/30'
                                                        }`}
                                                >
                                                    <td className="px-4 py-1 whitespace-nowrap">
                                                        <span className="text-[9px] font-black text-slate-500">
                                                            {row.code || '--'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-1">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-black text-slate-800 uppercase leading-tight">{row.name}</span>
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{row.category_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-1 text-center">
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <select
                                                                value={row.display_unit}
                                                                onChange={(e) => handleUnitChange(row.item_id, e.target.value)}
                                                                className="text-[9px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 outline-none cursor-pointer hover:bg-[#106ebe] hover:text-white transition-all appearance-none text-center min-w-[45px]"
                                                            >
                                                                {Object.keys(INVENTORY_UNITS)
                                                                    .filter(uCode => INVENTORY_UNITS[uCode].category === INVENTORY_UNITS[row.unit.toUpperCase()]?.category)
                                                                    .map(uCode => (
                                                                        <option key={uCode} value={uCode}>{uCode}</option>
                                                                    ))
                                                                }
                                                            </select>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-1 text-center">
                                                        <span className="font-bold text-[11px] text-slate-500 tabular-nums">{row.system_stock}</span>
                                                    </td>
                                                    <td className="px-4 py-1 text-center">
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min="0"
                                                            placeholder="0"
                                                            value={row.physical_stock === '' ? '' : row.physical_stock}
                                                            onChange={e => handlePhysicalChange(row.item_id, e.target.value)}
                                                            className={`w-20 text-center font-black text-[11px] rounded border h-7 px-2 outline-none transition-all
                                                                ${isEdited
                                                                    ? diff < 0 ? 'border-rose-400 bg-rose-50 text-rose-700' :
                                                                        diff > 0 ? 'border-emerald-400 bg-emerald-50 text-emerald-700' :
                                                                            'border-indigo-400 bg-white text-indigo-700'
                                                                    : 'border-slate-300 bg-white text-slate-700 focus:border-indigo-500'
                                                                }`}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-1 text-center">
                                                        {isEdited ? (
                                                            <span className={`inline-flex items-center gap-1 font-black text-[10px] tabular-nums
                                                                ${diff < 0 ? 'text-rose-600' :
                                                                    diff > 0 ? 'text-emerald-600' :
                                                                        'text-indigo-600'}`}>
                                                                {diff > 0 ? '+' : ''}{diff}
                                                            </span>
                                                        ) : <span className="text-slate-200 font-bold tracking-widest">—</span>}
                                                    </td>
                                                    <td className="px-4 py-1 text-right">
                                                        <span className="text-[10px] font-bold text-slate-500 tabular-nums">
                                                            Q{row.cost.toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-1 text-right pr-6">
                                                        {isEdited ? (
                                                            <span className={`text-[11px] font-black tabular-nums
                                                                ${valueDiff < 0 ? 'text-rose-600' : valueDiff > 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                                                {valueDiff > 0 ? '+' : ''}Q{valueDiff.toFixed(2)}
                                                            </span>
                                                        ) : <span className="text-slate-200">—</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            /* Mobile Card Layout */
                            <div className="flex flex-col gap-3 pb-24">
                                {filteredRows.length === 0 ? (
                                    <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center flex flex-col items-center gap-4">
                                        <Package size={48} className="text-slate-200" />
                                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Sin productos</span>
                                    </div>
                                ) : (
                                    filteredRows.map(row => {
                                        const phys = typeof row.physical_stock === 'string'
                                            ? (row.physical_stock === '' ? null : parseFloat(row.physical_stock) || 0)
                                            : row.physical_stock;
                                        const diff = phys !== null ? phys - row.system_stock : 0;
                                        const valueDiff = diff * row.cost;
                                        const isEdited = row.physical_stock !== '';

                                        return (
                                            <div key={row.item_id} className={`bg-white p-4 rounded-3xl border-2 transition-all shadow-sm flex flex-col gap-4 ${isEdited ? (diff < 0 ? 'border-rose-200 bg-rose-50/10' : diff > 0 ? 'border-emerald-200 bg-emerald-50/10' : 'border-indigo-200 bg-indigo-50/10') : 'border-slate-50'}`}>
                                                <div className="flex justify-between items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase">{row.code || 'S/C'}</span>
                                                            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">{row.presentation}</span>
                                                        </div>
                                                        <h3 className="text-xs font-black text-slate-800 uppercase leading-snug">{row.name}</h3>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Existencia Sistema</div>
                                                        <div className="text-sm font-black text-slate-600 tabular-nums">{row.system_stock} <span className="text-[9px] text-slate-400">{row.unit}</span></div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 items-end">
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Conteo Real</label>
                                                        <input
                                                            type="number"
                                                            inputMode="decimal"
                                                            placeholder="Ingrese cantidad..."
                                                            value={row.physical_stock === '' ? '' : row.physical_stock}
                                                            onChange={e => handlePhysicalChange(row.item_id, e.target.value)}
                                                            className={`w-full py-3 px-4 rounded-2xl border text-center font-black text-sm outline-none transition-all shadow-inner
                                                                ${isEdited
                                                                    ? 'bg-white border-indigo-400 text-indigo-700'
                                                                    : 'bg-slate-50 border-slate-100 text-slate-700 focus:bg-white focus:border-indigo-400'}`}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 items-end">
                                                        {isEdited ? (
                                                            <>
                                                                <div className={`p-2 rounded-2xl flex items-center gap-2 w-full justify-center ${diff < 0 ? 'bg-rose-100/50 text-rose-700' : diff > 0 ? 'bg-emerald-100/50 text-emerald-700' : 'bg-indigo-100/50 text-indigo-700'}`}>
                                                                    {diff > 0 ? <TrendingUp size={16} /> : diff < 0 ? <TrendingDown size={16} /> : null}
                                                                    <span className="text-xs font-black tabular-nums">{diff > 0 ? '+' : ''}{diff}</span>
                                                                </div>
                                                                <div className={`text-[11px] font-black ${valueDiff < 0 ? 'text-rose-500' : valueDiff > 0 ? 'text-emerald-500' : 'text-indigo-500'}`}>
                                                                    {valueDiff > 0 ? '+' : ''}Q{valueDiff.toFixed(2)}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="h-[60px] flex items-center justify-center text-slate-200 font-bold opacity-50">
                                                                PENDIENTE
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirm Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-[99999] flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-none">
                    <DraggableWindow id="inventory-leveling-confirm" title="Confirmar Nivelación de Inventario">
                        <div className="relative bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh] pointer-events-auto">
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-4 bg-[#106ebe] sticky top-0 z-10 shadow-sm">
                                <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center text-amber-300 shadow-sm">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white uppercase tracking-tight">Confirmar Nivelación</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        {sessionRows.length} items · {branchName}
                                    </p>
                                </div>
                                <button onClick={() => setShowConfirm(false)} className="ml-auto w-10 h-10 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all shadow-sm">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Products summary */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50/30 custom-scrollbar">
                                <div className="space-y-2">
                                    {sessionRows.map(r => {
                                        const phys = typeof r.physical_stock === 'string' ? parseFloat(r.physical_stock) || 0 : r.physical_stock;
                                        const diff = phys - r.system_stock;
                                        return (
                                            <div key={r.item_id} className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                                                <div className="flex-1 overflow-hidden pr-4">
                                                    <h4 className="text-[11px] font-black text-slate-700 uppercase leading-none truncate mb-1.5">{r.name}</h4>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                        Existencia: {r.system_stock} → <span className="text-slate-600">{phys}</span>
                                                    </div>
                                                </div>
                                                <div className={`text-[11px] font-black px-3 py-1.5 rounded-xl tabular-nums shadow-sm ${diff < 0 ? 'text-rose-600 bg-rose-50 border border-rose-100' : diff > 0 ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : 'text-indigo-600 bg-indigo-50 border border-indigo-100'}`}>
                                                    {diff > 0 ? '+' : ''}{diff}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Notes — mandatory */}
                            <div className="px-6 py-5 bg-white border-t border-slate-50">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-3 flex items-center gap-2">
                                    <Info size={12} className="text-indigo-400" />
                                    Justificación del Ajuste <span className="text-rose-500 ml-auto">* Requerido</span>
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={e => { setNotes(e.target.value); setNotesError(false); }}
                                    placeholder="Describa el motivo de las diferencias encontradas..."
                                    rows={2}
                                    className={`w-full bg-slate-50 border-2 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none transition-all resize-none ${notesError ? 'border-rose-400 bg-rose-50 shadow-inner' : 'border-slate-100 focus:border-indigo-400 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/5'}`}
                                />
                                {notesError && (
                                    <p className="text-[10px] font-black text-rose-500 uppercase mt-2 flex items-center gap-1.5 animate-pulse">
                                        <AlertTriangle size={12} /> Debe ingresar un motivo válido
                                    </p>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-6 bg-white border-t border-slate-100 flex items-center gap-4">
                                {!isMobile && (
                                    <button
                                        disabled={saving}
                                        onClick={() => setShowConfirm(false)}
                                        className="px-6 py-3 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all"
                                    >
                                        Cerrar
                                    </button>
                                )}
                                <button
                                    disabled={saving}
                                    onClick={handleSave}
                                    className={`flex-1 flex items-center gap-3 bg-[#106ebe] hover:bg-[#106ebe] hover:brightness-110 disabled:opacity-50 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.1em] shadow-xl shadow-blue-900/20 active:scale-95 transition-all justify-center ${saving ? 'cursor-not-allowed' : ''}`}
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                    {saving ? 'Sincronizando...' : 'Confirmar Cambios'}
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>
            )}

            {showPrintModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
                    <DraggableWindow id="inventory-physical-sheet" title="Hoja de Conteo Físico">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative overflow-hidden border border-slate-200 animate-zoom-in pointer-events-auto">
                            <div className="p-6 border-b border-slate-200 flex items-center gap-3 bg-[#106ebe] shadow-sm">
                                <div className="w-10 h-10 bg-white/10 border border-white/20 text-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white tracking-tight uppercase">Generar Hoja Físico</h3>
                                    <p className="text-[10px] uppercase tracking-widest text-blue-200/60 font-bold mt-0.5">Opciones de Impresión PDF</p>
                                </div>
                            </div>
                            <div className="p-6">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Agrupar Lista Por:</label>
                                <div className="flex flex-col gap-3">
                                    <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${printFormat === 'CATEGORIA' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                                        <input type="radio" checked={printFormat === 'CATEGORIA'} onChange={() => setPrintFormat('CATEGORIA')} className="w-4 h-4 text-indigo-600" />
                                        <span className={`text-[11px] font-black uppercase tracking-tight ${printFormat === 'CATEGORIA' ? 'text-indigo-700' : 'text-slate-600'}`}>Por Categoría (Recomendado)</span>
                                    </label>
                                    <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${printFormat === 'SUCURSAL' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                                        <input type="radio" checked={printFormat === 'SUCURSAL'} onChange={() => setPrintFormat('SUCURSAL')} className="w-4 h-4 text-indigo-600" />
                                        <span className={`text-[11px] font-black uppercase tracking-tight ${printFormat === 'SUCURSAL' ? 'text-indigo-700' : 'text-slate-600'}`}>Todos Alfabéticamente</span>
                                    </label>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-4 leading-relaxed font-semibold">
                                    Se generará un PDF tamaño Carta con espacio designado para el conteo a mano.
                                </p>
                            </div>
                            <div className="p-5 flex gap-2 border-t border-slate-100 bg-slate-50">
                                <button onClick={() => setShowPrintModal(false)} className="flex-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl py-3 text-[11px] font-black uppercase tracking-widest transition-all">
                                    Cancelar
                                </button>
                                <button onClick={handlePrintPhysicalSheet} className="flex-1 bg-[#106ebe] hover:bg-[#106ebe] hover:brightness-110 text-white shadow-lg shadow-blue-900/20 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                    <Printer size={14} /> Generar
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>
            )}
        </div>
    );
};
