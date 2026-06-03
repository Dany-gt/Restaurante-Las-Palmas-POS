import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabase';
import { Plus, Trash2, Save, X, RefreshCw, Loader2, Edit2, CloudDownload, Package, Cloud, Building, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { DraggableWindow } from '../DraggableWindow';
import { WindowsSaveButton } from '../../WindowsSaveButton';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { parseAuditDTE, parseAuditXML } from '../../../utils/satAuditParser';
import { registrarAuditoria } from '../../../services/auditService';

// --- COMPONENTES AUXILIARES ESTABLES (Fuera del render principal para evitar parpadeos) ---
const Pagination = ({ 
    current, 
    total, 
    onPage, 
    pageSize, 
    setPageSize,
    resetToFirst
}: { 
    current: number; 
    total: number; 
    onPage: (p: number) => void;
    pageSize: number;
    setPageSize: (s: number) => void;
    resetToFirst: () => void;
}) => {
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6 py-4 px-4 bg-slate-50 border-t border-slate-200 justify-center relative shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
            {/* Info Text (Left-ish) */}
            <div className="hidden lg:block absolute left-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                Página {current} de {total || 1}
            </div>

            <div className="flex items-center gap-6 bg-white border border-slate-200 rounded-2xl px-6 py-2 shadow-sm">
                <button 
                    onClick={() => onPage(Math.max(1, current - 1))} 
                    disabled={current === 1}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-sm"
                >
                    <ChevronLeft size={16} strokeWidth={3} /> Anterior
                </button>

                <div className="flex items-center gap-3 border-x border-slate-100 px-6">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Página</span>
                    <div className="bg-[#106ebe] text-white px-3 py-1.5 rounded-lg text-[11px] font-black shadow-md shadow-[#106ebe]/20">
                        {current}
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">de {total || 1}</span>
                </div>

                {/* Selector de Tamaño (CENTREADO) */}
                <div className="relative">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Mostrar:</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsSelectorOpen(!isSelectorOpen); }}
                            className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-1.5 text-[11px] font-black text-[#106ebe] hover:border-[#106ebe] transition-all shadow-sm min-w-[130px] justify-between group"
                        >
                            {pageSize} facturas
                            <ChevronLeft size={14} className={`transition-transform duration-200 text-slate-400 ${isSelectorOpen ? 'rotate-90' : '-rotate-90'}`} />
                        </button>
                    </div>

                    {isSelectorOpen && (
                        <>
                            <div className="fixed inset-0 z-[10000]" onClick={() => setIsSelectorOpen(false)} />
                            <div className="absolute bottom-full left-0 mb-3 w-full bg-white border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[10001] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 border-t-[#106ebe] border-t-2">
                                {[10, 25, 50, 500].map(size => (
                                    <div key={size} onClick={(e) => { e.stopPropagation(); setPageSize(size); resetToFirst(); setIsSelectorOpen(false); }}
                                        className={`px-4 py-3 text-[10px] font-black uppercase cursor-pointer transition-all flex items-center justify-between ${pageSize === size ? 'bg-[#106ebe]/5 text-[#106ebe]' : 'text-slate-600 hover:bg-slate-50'}`}>
                                        {size} registros
                                        {pageSize === size && <div className="w-1.5 h-1.5 bg-[#106ebe] rounded-full" />}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <button 
                    onClick={() => onPage(Math.min(total, current + 1))} 
                    disabled={current === total || total === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-sm"
                >
                    Siguiente <ChevronRight size={16} strokeWidth={3} />
                </button>
            </div>

            <div className="hidden lg:block absolute right-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none text-right">
                {pageSize} por página
            </div>
        </div>
    );
};

const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORIES = [
    'Materia prima cocina', 'Materia prima cevichería', 'Materia prima bebidas',
    'Gas y energía', 'Limpieza y desechables', 'Mantenimiento',
    'Servicios profesionales', 'Otros'
];

const autoCategorize = (name: string, nit?: string, suppliers: Supplier[] = []): string => {
    // ── CAPA 1: MEMORIA POR NIT ──
    if (nit) {
        const found = suppliers.find(s => s.nit === nit);
        if (found && found.default_category) return found.default_category;
    }

    const s = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // ── CAPA 3: HEURÍSTICA TÉCNICA ──
    if (/\bgas\b|electric|energuate|eegsa|tropig|z-gas|empresa elec|solar|energi|metropolitano|kw\/h|vatios|lectura|transformador/.test(s)) return 'Gas y energía';
    if (/propano|cilindro|zgas|tomza/.test(s)) return 'Gas y energía';
    if (/platic|desechable|limpieza|detergent|jabon|bolsa|quimic|higienico|servilleta|dollarcity/.test(s)) return 'Limpieza y desechables';
    if (/bebid|pepsi|coca|cerveza|brava|gallito|agua pura|hielo|licor|ron |aguas|vodka|jarabe|licores/.test(s)) return 'Materia prima bebidas';
    if (/ceviche|marisco|camaron|pescado|concha|ostra|marina|filete/.test(s)) return 'Materia prima cevichería';
    if (/ferreter|pintur|vidrio|mader|taller|mantenim|herramient|reparacion|repuest|tecnico/.test(s)) return 'Mantenimiento';
    if (/contad|auditor|abogad|notari|asesor|seguridad|consultor|oficin|servicios prof|plan mensual|internet|fibra|telefonia/.test(s)) return 'Servicios profesionales';
    if (/pollo|carne|carnicer|embutid|huevo|pan |tortilla|verdur|frut|abarrot|distribuidor|walmart|paiz|unisuper|la torre|supermerca|aliment|lacteo|queso|harina|montana|asociadas|avicola|aceite|manteca/.test(s)) return 'Materia prima cocina';
    return 'Otros';
};

interface Invoice {
    id?: string;
    invoice_date: string;
    supplier_nit: string;
    supplier_name: string;
    invoice_number: string;
    description: string;
    total_amount: number;
    iva_amount: number;
    net_amount: number;
    category: string;
    payment_status: string;
    due_date?: string;
    fel_uuid?: string;
    tipo_dte?: string;
    idp_monto?: number;
    iva_retenido?: number;
    isr_retenido?: number;
    uuid_referencia?: string;
    items?: any[];
}

const EMPTY: Invoice = {
    invoice_date: dayjs().format('YYYY-MM-DD'),
    supplier_nit: '', supplier_name: '', invoice_number: '', description: '',
    total_amount: 0, iva_amount: 0, net_amount: 0, category: CATEGORIES[0],
    payment_status: 'pending', due_date: '',
};

interface Supplier {
    id?: string; nit: string; name: string; phone: string;
    products: string; credit_days: number; default_category?: string;
}

const EMPTY_SUP: Supplier = { nit: '', name: '', phone: '', products: '', credit_days: 0, default_category: CATEGORIES[0] };

type SubTab = 'facturas' | 'ventas' | 'proveedores' | 'cxp' | 'resumen';

export const TabCompras: React.FC<{ 
    accentColor: string;
    satSyncing?: boolean;
    satLastSync?: string | null;
    onOpenSatSync?: () => void;
}> = ({ accentColor, satSyncing: globalSyncing, satLastSync, onOpenSatSync }) => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const [sub, setSub] = useState<SubTab>('facturas');
    const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<Invoice>(EMPTY);
    const [editId, setEditId] = useState<string | null>(null);
    const [showSupForm, setShowSupForm] = useState(false);
    const [supForm, setSupForm] = useState<Supplier>(EMPTY_SUP);
    const [monthlySales, setMonthlySales] = useState(0);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
    const [showDetail, setShowDetail] = useState(false);

    // --- Paginación ---
    const [pageSize, setPageSize] = useState(50);
    const [purchasePage, setPurchasePage] = useState(1);
    const [salesPage, setSalesPage] = useState(1);

    // Reset de página al cambiar filtros
    useEffect(() => {
        setPurchasePage(1);
        setSalesPage(1);
    }, [month, searchTerm]);


    const fetch = useCallback(async () => {
        setLoading(true);
        const start = dayjs(month + '-01').startOf('month').format('YYYY-MM-DD');
        const end = dayjs(month + '-01').endOf('month').format('YYYY-MM-DD');
        const { data: inv } = await supabase.from('purchase_invoices').select('*').eq('org_id', 'default').gte('invoice_date', start).lte('invoice_date', end).order('invoice_date', { ascending: false }).order('id', { ascending: false });
        setInvoices(inv || []);
        const { data: sales } = await supabase.from('sales_invoices').select('*').eq('org_id', 'default').gte('invoice_date', start).lte('invoice_date', end).order('invoice_date', { ascending: false }).order('id', { ascending: false });
        setSalesInvoices(sales || []);
        const { data: sup } = await supabase.from('accounting_suppliers').select('*').eq('org_id', 'default').order('name');
        setSuppliers(sup || []);
        const { data: orders } = await supabase.from('orders').select('total').in('status', ['completed', 'finalizada', 'PAID', 'FINALIZADA', 'cerrada', 'CERRADA', 'closed']).gte('created_at', dayjs(month + '-01').startOf('month').toISOString()).lte('created_at', dayjs(month + '-01').endOf('month').toISOString());
        setMonthlySales((orders || []).reduce((a, o) => a + Number(o.total || 0), 0));
        setLoading(false);
    }, [month]);

    useEffect(() => { fetch(); }, [fetch]);

    // Refresco automático cuando termina una sync global
    useEffect(() => {
        if (satLastSync) fetch();
    }, [satLastSync, fetch]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setSyncing(true);
        let importedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = file.name.toLowerCase();

            if (fileName.endsWith('.xml')) {
                const xmlText = await file.text();
                try {
                    const auditData = parseAuditXML(xmlText);
                    const uuid = auditData.uuid;

                    const { data: existing } = await supabase.from('purchase_invoices').select('id, items').eq('fel_uuid', uuid).maybeSingle();
                    
                    if (existing) {
                        if (!existing.items || existing.items.length === 0) {
                            const { error: upErr } = await supabase.from('purchase_invoices').update({ items: auditData.items }).eq('id', existing.id);
                            if (!upErr) importedCount++;
                            else errorCount++;
                        } else {
                            skippedCount++;
                        }
                        continue;
                    }

                    const { error } = await supabase.from('purchase_invoices').insert({
                        org_id: 'default', 
                        invoice_date: auditData.fecha_emision, 
                        supplier_nit: auditData.emisor_nit, 
                        supplier_name: auditData.emisor_nombre, 
                        invoice_number: auditData.numero || uuid.slice(0, 8),
                        description: `Importado XML: ${auditData.emisor_nombre}`, 
                        total_amount: auditData.monto_total,
                        iva_amount: auditData.iva_credito_fiscal,
                        net_amount: auditData.monto_total - auditData.iva_credito_fiscal - (auditData.idp_monto || 0),
                        category: autoCategorize(auditData.emisor_nombre, auditData.emisor_nit, suppliers), 
                        payment_status: 'paid',
                        fel_uuid: uuid, 
                        tipo_dte: auditData.tipo_dte,
                        idp_monto: auditData.idp_monto,
                        iva_retenido: auditData.iva_retenido,
                        isr_retenido: auditData.isr_retenido,
                        uuid_referencia: auditData.uuid_referencia,
                        items: auditData.items
                    });

                    // AUTO-REGISTER SUPPLIER
                    if (!error && auditData.emisor_nit) {
                        await supabase.from('accounting_suppliers').upsert({
                            org_id: 'default', nit: auditData.emisor_nit, name: auditData.emisor_nombre
                        }, { onConflict: 'nit' });
                    }

                    if (error) throw error;
                    importedCount++;
                } catch (err) { errorCount++; }
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                try {
                    const data = await file.arrayBuffer();
                    const wb = XLSX.read(data, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const fullData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
                    
                    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    let headerIdx = -1;
                    for (let j = 0; j < Math.min(fullData.length, 25); j++) {
                        const row = fullData[j].map(c => norm(String(c)));
                        if (row.some(c => c.includes('nit')) && (row.some(c => c.includes('total')) || row.some(c => c.includes('monto')))) {
                            headerIdx = j; break;
                        }
                    }

                    if (headerIdx !== -1) {
                        const headers = fullData[headerIdx].map(h => norm(String(h).trim()));
                        const rows = fullData.slice(headerIdx + 1);
                        const getCol = (inc: string[]) => headers.findIndex(h => inc.every(kw => h.includes(kw)));

                        const colNit = getCol(['nit', 'emisor']) !== -1 ? getCol(['nit', 'emisor']) : getCol(['nit']);
                        const colNombre = getCol(['nombre', 'emisor']) !== -1 ? getCol(['nombre', 'emisor']) : getCol(['razon']);
                        const colUuid = getCol(['uuid']) !== -1 ? getCol(['uuid']) : getCol(['autorizacion']);
                        const colTotal = getCol(['total']) !== -1 ? getCol(['total']) : getCol(['monto']);
                        const colFecha = getCol(['fecha', 'emision']) !== -1 ? getCol(['fecha', 'emision']) : getCol(['fecha']);
                        
                        const newInvoices: any[] = [];
                        const newSuppliers: any[] = [];

                        for (const rowData of rows) {
                            const uuid = String(rowData[colUuid] || '').trim();
                            if (!uuid || uuid === '-') continue;
                            const total = Number(String(rowData[colTotal] || '0').replace(/[^0-9.]/g, '')) || 0;
                            if (total === 0) continue;

                            const nit = String(rowData[colNit] || '').trim();
                            const nombre = String(rowData[colNombre] || 'Prov SAT').trim();

                            // --- PARSEO DE FECHA DEL EXCEL ---
                            let fechaFinal = dayjs().format('YYYY-MM-DD'); 
                            const rawFecha = rowData[colFecha];
                            if (rawFecha) {
                                // Si es número de Excel (fecha serial), cargarlo con XLSX
                                if (typeof rawFecha === 'number') {
                                    fechaFinal = dayjs(XLSX.SSF.format('yyyy-mm-dd', rawFecha)).format('YYYY-MM-DD');
                                } else {
                                    const s = String(rawFecha).trim();
                                    // DD/MM/YYYY | DD-MM-YYYY
                                    if (s.includes('/') || s.includes('-')) {
                                        const p = s.split(/[/-]/);
                                        if (p.length === 3) {
                                            // DD/MM/YYYY target (SAT estándar)
                                            if (p[2].length === 4) fechaFinal = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                                            // YYYY/MM/DD target
                                            else if (p[0].length === 4) fechaFinal = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
                                        }
                                    } else {
                                        // Intento genérico de dayjs
                                        const d = dayjs(s);
                                        if (d.isValid()) fechaFinal = d.format('YYYY-MM-DD');
                                    }
                                }
                            }

                            newInvoices.push({
                                org_id: 'default', invoice_date: fechaFinal,
                                supplier_nit: nit, supplier_name: nombre,
                                invoice_number: uuid.slice(0, 8), description: `Importado SAT Excel`,
                                total_amount: total, iva_amount: total/1.12*0.12, net_amount: total/1.12,
                                category: autoCategorize(nombre), payment_status: 'paid', fel_uuid: uuid
                            });

                            if (nit) {
                                newSuppliers.push({ org_id: 'default', nit: nit, name: nombre });
                            }
                        }

                        if (newInvoices.length > 0) {
                            const { error: insErr } = await supabase.from('purchase_invoices').upsert(newInvoices, { onConflict: 'fel_uuid' });
                            if (!insErr) {
                                importedCount += newInvoices.length;
                                if (newSuppliers.length > 0) {
                                    await supabase.from('accounting_suppliers').upsert(newSuppliers, { onConflict: 'nit' });
                                }
                            }
                        }
                    }
                } catch (err) { errorCount++; }
            }
        }

        setSyncing(false);
        if (e.target) e.target.value = '';
        alert(`Proceso Terminado:\n- ${importedCount} facturas nuevas.\n- ${skippedCount} ya existían (omitidas).\n- ${errorCount} errores.`);
        fetch();
    };
    const handleTotalChange = (val: number) => {
        const roundedVal = parseFloat(val.toFixed(2));
        const iva = (roundedVal / 1.12) * 0.12;
        setForm(f => ({ ...f, total_amount: roundedVal, iva_amount: parseFloat(iva.toFixed(2)), net_amount: parseFloat((roundedVal - iva).toFixed(2)) }));
    };

    const saveInvoice = async () => {
        const payload = { ...form, org_id: 'default' };
        let insertedId = editId;
        if (editId) {
            await supabase.from('purchase_invoices').update(payload).eq('id', editId);
        } else {
            const { data } = await supabase.from('purchase_invoices').insert(payload).select();
            if (data && data.length > 0) insertedId = data[0].id;
        }

        if (currentUser && insertedId) {
            await registrarAuditoria({
                modulo: 'COMPRAS',
                accion: 'FACTURA_COMPRA_REGISTRADA',
                accion_descripcion: `Registro manual de factura de compra ${form.invoice_number} de ${form.supplier_name}`,
                entidad_id: insertedId,
                entidad_tipo: 'factura_compra',
                entidad_nombre: `Factura ${form.invoice_number}`,
                valores_nuevos: {
                    numero_factura: form.invoice_number,
                    proveedor: form.supplier_name,
                    nit_proveedor: form.supplier_nit,
                    monto_total: form.total_amount,
                    iva: form.iva_amount,
                    monto_neto: form.net_amount,
                    categoria_contable: form.category,
                    afecta_cxp: form.payment_status === 'pending'
                },
                impacto_financiero: {
                    monto_total: form.total_amount,
                    impacto_mensual_estimado: `Gasto de Q${form.total_amount.toFixed(2)}`
                }
            }, currentUser);
        }

        setShowForm(false); setEditId(null); setForm(EMPTY); fetch();
    };

    const delInvoice = async (id: string) => { 
        const invoice = invoices.find(i => i.id === id);
        if (invoice && currentUser) {
            await registrarAuditoria({
                modulo: 'COMPRAS',
                accion: 'FACTURA_COMPRA_ELIMINADA' as any,
                accion_descripcion: `Eliminación de factura de compra ${invoice.invoice_number} de ${invoice.supplier_name}`,
                entidad_id: id,
                entidad_tipo: 'factura_compra',
                entidad_nombre: `Factura ${invoice.invoice_number}`,
                valores_anteriores: {
                    numero_factura: invoice.invoice_number,
                    proveedor: invoice.supplier_name,
                    nit_proveedor: invoice.supplier_nit,
                    monto_total: invoice.total_amount,
                    iva: invoice.iva_amount,
                    monto_neto: invoice.net_amount,
                    categoria_contable: invoice.category,
                    motivo: "Eliminación manual desde panel administrativo"
                },
                impacto_financiero: {
                    monto_total: invoice.total_amount,
                    impacto_mensual_estimado: `Corrección de Q${invoice.total_amount.toFixed(2)}`
                }
            }, currentUser);
        }
        await supabase.from('purchase_invoices').delete().eq('id', id); 
        fetch(); 
    };

    const saveSup = async () => {
        await supabase.from('accounting_suppliers').insert({ ...supForm, org_id: 'default' });
        setShowSupForm(false); setSupForm(EMPTY_SUP); fetch();
    };

    // Resumen por categoría (Lógica Contable de Signos) - MEMOIZED
    const byCategory = useMemo(() => {
        return CATEGORIES.map(cat => {
            const total = invoices
                .filter(i => i.category === cat && i.status?.toLowerCase() !== 'anulado' && i.status?.toLowerCase() !== 'annulled' && !['CRE', 'CEX', 'RDON'].includes(i.tipo_dte || ''))
                .reduce((acc, i) => {
                    const sign = ['NCRE', 'NABN'].includes(i.tipo_dte || '') ? -1 : 1;
                    return acc + (Number(i.total_amount || 0) * sign);
                }, 0);
            const pct = monthlySales > 0 ? (total / monthlySales) * 100 : 0;
            return { cat, total, pct };
        }).filter(c => c.total > 0);
    }, [invoices, monthlySales]);

    const totalCompras = useMemo(() => {
        return invoices
            .filter(i => i.status?.toLowerCase() !== 'anulado' && i.status?.toLowerCase() !== 'annulled' && !['CRE', 'CEX', 'RDON'].includes(i.tipo_dte || ''))
            .reduce((acc, i) => {
                const sign = ['NCRE', 'NABN'].includes(i.tipo_dte || '') ? -1 : 1;
                return acc + (Number(i.total_amount || 0) * sign);
            }, 0);
    }, [invoices]);

    // Cuentas por pagar - MEMOIZED
    const cxp = useMemo(() => {
        return invoices.filter(i => i.payment_status === 'pending' && i.status?.toLowerCase() !== 'anulado' && i.status?.toLowerCase() !== 'annulled').map(i => {
            const today = dayjs();
            const due = i.due_date ? dayjs(i.due_date) : dayjs(i.invoice_date).add(30, 'day');
            const diff = due.diff(today, 'day');
            return { ...i, diff };
        }).sort((a, b) => a.diff - b.diff);
    }, [invoices]);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => 
            (inv.supplier_nit || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (inv.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [invoices, searchTerm]);

    const filteredSalesInvoices = useMemo(() => {
        return salesInvoices.filter(inv => 
            (inv.customer_nit || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (inv.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [salesInvoices, searchTerm]);

    // Lógica de Paginación para Facturas
    const paginatedInvoices = useMemo(() => {
        return filteredInvoices.slice((purchasePage - 1) * pageSize, purchasePage * pageSize);
    }, [filteredInvoices, purchasePage, pageSize]);

    const paginatedSalesInvoices = useMemo(() => {
        return filteredSalesInvoices.slice((salesPage - 1) * pageSize, salesPage * pageSize);
    }, [filteredSalesInvoices, salesPage, pageSize]);

    const totalPurchasePages = Math.ceil(filteredInvoices.length / pageSize);
    const totalSalesPages = Math.ceil(filteredSalesInvoices.length / pageSize);

    // Totales calculados para UI - MEMOIZED
    const totalSalesAmount = useMemo(() => {
        return filteredSalesInvoices
            .filter(i => i.status?.toLowerCase() !== 'anulado' && i.status?.toLowerCase() !== 'annulled' && i.status !== 'A')
            .reduce((a, i) => a + Number(i.total_amount || 0), 0);
    }, [filteredSalesInvoices]);

    const totalPurchasesAmount = useMemo(() => {
        return filteredInvoices
            .filter(i => i.status?.toLowerCase() !== 'anulado' && i.status?.toLowerCase() !== 'annulled' && i.status !== 'A')
            .reduce((a, i) => a + Number(i.total_amount || 0), 0);
    }, [filteredInvoices]);

    const SUB_TABS: { id: SubTab; label: string }[] = [
        { id: 'facturas', label: 'Facturas de Compra' },
        { id: 'ventas', label: 'Facturas Emitidas' },
        { id: 'proveedores', label: 'Proveedores' },
        { id: 'cxp', label: 'Cuentas por Pagar' },
        { id: 'resumen', label: 'Resumen del Mes' },
    ];

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar text-gray-900">
            {/* Sub tabs */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit">
                {SUB_TABS.map(t => (
                    <button key={t.id} onClick={() => setSub(t.id)}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase rounded transition-all ${sub === t.id ? 'bg-[#106ebe] text-white' : 'text-black hover:bg-slate-100'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Top Controls: Period, Search, SAT Actions */}
            <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest">Periodo:</label>
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-gray-400 rounded px-3 py-1.5 text-[11px] font-black text-black bg-white shadow-inner" />
                    <button onClick={fetch} className="p-1.5 hover:bg-slate-200 rounded text-black transition-all"><RefreshCw size={13} /></button>
                    {loading && <Loader2 size={14} className="animate-spin text-[#106ebe]" />}

                    <div className="h-4 w-px bg-slate-200 mx-2" />

                    {/* Search Filter */}
                    <div className="relative group">
                        <input 
                            type="text" 
                            placeholder="Buscar por NIT o Nombre..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[11px] font-bold bg-white focus:ring-2 focus:ring-[#106ebe] focus:border-transparent transition-all outline-none w-64 shadow-sm"
                        />
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#106ebe]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpenSatSync}
                        className="flex items-center gap-2 px-4 py-2 bg-[#106ebe] hover:bg-[#0d5ea0] text-white text-[10px] font-black uppercase rounded shadow-md transition-all active:scale-95"
                    >
                        {globalSyncing ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
                        {globalSyncing ? 'Sincronizando...' : 'Sincronizar SAT'}
                    </button>
                    <label className="flex items-center gap-2 px-4 py-2 bg-[#106ebe] hover:bg-[#0d5ea0] text-white text-[10px] font-black uppercase rounded shadow-md cursor-pointer transition-all active:scale-95">
                        {syncing ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        {syncing ? 'Procesando...' : 'Importar XML / Excel'}
                        <input type="file" className="hidden" accept=".xlsx, .xls, .xml" onChange={handleFileUpload} disabled={syncing} multiple />
                    </label>
                </div>
            </div>

            {sub === 'facturas' && (
                <>
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-[#106ebe] px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Facturas de Compra — {dayjs(month + '-01').format('MMMM YYYY')}</span>
                        <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY); }}
                            className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-[9px] font-black uppercase rounded transition-all">
                            <Plus size={11} /> Registrar Factura
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-black uppercase tracking-wider">
                                <tr>
                                    <th className="px-3 py-2">Fecha</th>
                                    <th className="px-3 py-2">NIT Emisor</th>
                                    <th className="px-3 py-2">Nombre Emisor</th>
                                    <th className="px-3 py-2">No. Fact.</th>
                                    <th className="px-3 py-2">Descripción</th>
                                    <th className="px-3 py-2">Categoría</th>
                                    <th className="px-3 py-2 text-right">Total</th>
                                    <th className="px-3 py-2 text-right">IVA</th>
                                    <th className="px-3 py-2 text-right">Otros Imp.</th>
                                    <th className="px-3 py-2 text-center">SAT</th>
                                    <th className="px-3 py-2">Estado</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {paginatedInvoices.length === 0 ? (
                                    <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400 text-[10px] font-bold">Sin facturas encontradas</td></tr>
                                ) : paginatedInvoices.map(inv => {
                                    const isAnulado = inv.status?.toLowerCase() === 'anulado' || inv.payment_status === 'anulado';
                                    return (
                                    <tr key={inv.id} onDoubleClick={() => { setSelectedInv(inv); setShowDetail(true); }} 
                                        className={`hover:bg-slate-50 transition-colors cursor-pointer text-black ${isAnulado ? 'opacity-50 italic' : ''} ${inv.tipo_dte === 'CRE' ? 'bg-purple-50/30' : ''}`}
                                    >
                                        <td className={`px-3 py-2 font-mono whitespace-nowrap text-black ${isAnulado ? 'line-through' : ''}`}>{dayjs(inv.invoice_date).format('DD/MM/YY')}</td>
                                        <td className={`px-3 py-2 font-mono text-black ${isAnulado ? 'line-through' : ''}`}>{inv.supplier_nit}</td>
                                        <td className={`px-3 py-2 font-black truncate max-w-[150px] text-black ${isAnulado ? 'line-through' : ''}`} title={inv.supplier_name}>{inv.supplier_name}</td>
                                        <td className={`px-3 py-2 font-mono uppercase text-[9px] text-black ${isAnulado ? 'line-through' : ''}`}>{inv.invoice_number}</td>
                                        <td className="px-3 py-2 max-w-[180px]">
                                            <div className={`truncate font-black text-black ${isAnulado ? 'line-through decoration-red-500' : ''}`} title={inv.description}>{inv.description}</div>
                                            {inv.items && inv.items.length > 0 && (
                                                <div className="text-[8px] text-black font-black uppercase mt-0.5">
                                                    {inv.items.length} productos: {inv.items.slice(0, 2).map((it: any) => it.descripcion).join(', ')}...
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2"><span className="px-2 py-0.5 bg-slate-100 text-black text-[8px] font-black uppercase rounded">{inv.category}</span></td>
                                        <td className={`px-3 py-2 text-right font-black ${['NCRE', 'NABN'].includes(inv.tipo_dte || '') ? 'text-red-600' : ''}`}>
                                            <span className={isAnulado ? 'line-through' : ''}>
                                                {inv.tipo_dte === 'CRE' ? fmtQ(inv.isr_retenido || 0) : fmtQ(inv.total_amount)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right font-black">
                                            {inv.tipo_dte === 'CRE' ? (
                                                <span className="text-purple-600">Ret. Q {(inv.iva_retenido || 0).toFixed(2)}</span>
                                            ) : (
                                                <span className={isAnulado ? 'line-through' : ''}>{fmtQ(inv.iva_amount)}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right font-black text-emerald-600">
                                            <span className={isAnulado ? 'line-through opacity-30' : ''}>
                                                {inv.tipo_dte !== 'CRE' && fmtQ((inv.idp_monto || 0) + (inv.impuesto_bebidas_alcoh || 0) + (inv.impuesto_bebidas_no_alcoh || 0))}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {(() => {
                                                const status = inv.status?.toLowerCase();
                                                const tipo = inv.tipo_dte || (
                                                    inv.description?.toUpperCase().includes('NCRE') ? 'NCRE' :
                                                    'FACT'
                                                );

                                                if (isAnulado) return <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[7px] font-black uppercase shadow-sm">Anulado</span>;
                                                
                                                const colors: Record<string, string> = {
                                                    'FACT': 'bg-blue-600', 'FCAM': 'bg-blue-600',
                                                    'NCRE': 'bg-red-500', 'NABN': 'bg-red-500',
                                                    'NDEB': 'bg-orange-500', 'FPEQ': 'bg-amber-400',
                                                    'FESP': 'bg-orange-600', 'CRE': 'bg-purple-600'
                                                };

                                                return <span className={`${colors[tipo] || 'bg-slate-400'} text-white px-1.5 py-0.5 rounded text-[7px] font-black uppercase shadow-sm`}>{tipo}</span>;
                                            })()}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full ${isAnulado ? 'bg-red-50 text-red-700' : (inv.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}`}>
                                                {isAnulado ? 'Anulado' : (inv.payment_status === 'paid' ? 'Pagado' : 'Pendiente')}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => {
                                                    // Parsear items localmente: soporta array, metadata.items, o JSON string
                                                    let parsedItems = inv.items;
                                                    if (!parsedItems || parsedItems.length === 0) {
                                                        const raw = inv.metadata?.items ?? inv.detalles;
                                                        if (typeof raw === 'string') { try { parsedItems = JSON.parse(raw); } catch { parsedItems = []; } }
                                                        else if (Array.isArray(raw)) { parsedItems = raw; }
                                                    }
                                                    if (typeof parsedItems === 'string') { try { parsedItems = JSON.parse(parsedItems); } catch { parsedItems = []; } }
                                                    setSelectedInv({ ...inv, items: parsedItems || [] });
                                                    setShowDetail(true);
                                                }} 
                                                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase rounded shadow-sm transition-all active:scale-95">
                                                    <Package size={10} />
                                                </button>
                                                <button onClick={() => { setForm(inv); setEditId(inv.id!); setShowForm(true); }} className="p-1.5 hover:bg-slate-100 text-slate-400 rounded transition-all"><Edit2 size={11} /></button>
                                                <button onClick={() => delInvoice(inv.id!)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-all"><Trash2 size={11} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan={6} className="px-3 py-2 text-[10px] font-black uppercase text-black">Total Facturas de Compra</td>
                                    <td className="px-3 py-2 text-right font-black text-[12px] text-black">{fmtQ(totalPurchasesAmount)}</td>
                                    <td colSpan={6}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <Pagination 
                        current={purchasePage} 
                        total={totalPurchasePages} 
                        onPage={setPurchasePage}
                        pageSize={pageSize}
                        setPageSize={setPageSize}
                        resetToFirst={() => { setPurchasePage(1); setSalesPage(1); }}
                    />
                </div>

                {/* ── SECCIÓN DE RETENCIONES ── */}
                {invoices.some(i => i.tipo_dte === 'CRE') && (
                    <div className="mt-4 bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden">
                        <div className="bg-purple-600 px-4 py-2 flex items-center justify-between">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheck size={14} /> Constancias de Retención Recibidas (Crédito ISR/IVA)
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[10px]">
                                <thead className="bg-purple-50 text-[9px] font-black text-purple-900 uppercase">
                                    <tr>
                                        <th className="px-3 py-2">Fecha</th>
                                        <th className="px-3 py-2">NIT Retenedor</th>
                                        <th className="px-3 py-2">Nombre del Retenedor</th>
                                        <th className="px-3 py-2 text-right">Ret. ISR (Activo)</th>
                                        <th className="px-3 py-2 text-right">Ret. IVA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-purple-50">
                                    {invoices.filter(i => i.tipo_dte === 'CRE').map(inv => (
                                        <tr key={inv.id} className="text-black font-medium">
                                            <td className="px-3 py-2 font-mono">{dayjs(inv.invoice_date).format('DD/MM/YY')}</td>
                                            <td className="px-3 py-2 font-mono">{inv.supplier_nit}</td>
                                            <td className="px-3 py-2 truncate max-w-[200px]">{inv.supplier_name}</td>
                                            <td className="px-3 py-2 text-right font-black text-purple-700">{fmtQ(inv.isr_retenido || 0)}</td>
                                            <td className="px-3 py-2 text-right font-black text-blue-700">{fmtQ(inv.iva_retenido || 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-purple-50/50 border-t border-purple-100 font-black">
                                    <tr>
                                        <td colSpan={3} className="px-3 py-2 text-right uppercase text-purple-900">Total Retenciones a Acreditar:</td>
                                        <td className="px-3 py-2 text-right text-purple-900 text-[12px]">
                                            {fmtQ(invoices.filter(i => i.tipo_dte === 'CRE').reduce((a, i) => a + Number(i.isr_retenido || 0), 0))}
                                        </td>
                                        <td className="px-3 py-2 text-right text-blue-900 text-[12px]">
                                            {fmtQ(invoices.filter(i => i.tipo_dte === 'CRE').reduce((a, i) => a + Number(i.iva_retenido || 0), 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
                </>
            )}

            {sub === 'ventas' && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-[#106ebe] px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Facturas Emitidas (Ventas) — {dayjs(month + '-01').format('MMMM YYYY')}</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-black uppercase tracking-wider">
                                <tr>
                                    <th className="px-3 py-2">Fecha</th>
                                    <th className="px-3 py-2">NIT Cliente</th>
                                    <th className="px-3 py-2">Nombre Cliente</th>
                                    <th className="px-3 py-2">No. Fact.</th>
                                    <th className="px-3 py-2">Descripción</th>
                                    <th className="px-3 py-2 text-right">Total</th>
                                    <th className="px-3 py-2 text-right">IVA</th>
                                    <th className="px-3 py-2 text-center">SAT</th>
                                    <th className="px-3 py-2">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {paginatedSalesInvoices.length === 0 ? (
                                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-[10px] font-bold">Sin facturas emitidas encontradas</td></tr>
                                ) : paginatedSalesInvoices.map(inv => {
                                    const isAnulado = inv.status?.toLowerCase() === 'anulado' || inv.status?.toLowerCase() === 'annulled' || inv.status === 'A';
                                    return (
                                    <tr key={inv.id} className={`hover:bg-slate-50 transition-colors text-black font-black ${isAnulado ? 'opacity-50 italic text-slate-500' : ''}`}>
                                        <td className={`px-3 py-2 font-mono whitespace-nowrap text-black ${isAnulado ? 'line-through' : ''}`}>{dayjs(inv.invoice_date).format('DD/MM/YY')}</td>
                                        <td className={`px-3 py-2 font-mono text-black ${isAnulado ? 'line-through' : ''}`}>{inv.customer_nit}</td>
                                        <td className={`px-3 py-2 font-black truncate max-w-[150px] text-black ${isAnulado ? 'line-through' : ''}`} title={inv.customer_name}>{inv.customer_name}</td>
                                        <td className={`px-3 py-2 font-mono uppercase text-[9px] text-black ${isAnulado ? 'line-through' : ''}`}>{inv.invoice_number}</td>
                                        <td className="px-3 py-2 max-w-[180px]">
                                            <div className={`truncate font-black text-black ${isAnulado ? 'line-through decoration-red-500' : ''}`} title={inv.description}>{inv.description}</div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-black text-black">{fmtQ(inv.total_amount)}</td>
                                        <td className="px-3 py-2 text-right font-black text-black">{fmtQ(inv.iva_amount)}</td>
                                        <td className="px-3 py-2 text-center">
                                            {(() => {
                                                const isAnulado = inv.status?.toLowerCase() === 'anulado' || inv.status?.toLowerCase() === 'annulled' || inv.status === 'A';
                                                const tipo = inv.tipo_dte || (
                                                    inv.description?.toUpperCase().includes('NCRE') ? 'NCRE' :
                                                    inv.description?.toUpperCase().includes('NABN') ? 'NABN' :
                                                    inv.description?.toUpperCase().includes('FPEQ') ? 'FPEQ' :
                                                    inv.description?.toUpperCase().includes('FCAM') ? 'FCAM' :
                                                    'FACT'
                                                );

                                                if (isAnulado) return <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[7px] font-black uppercase shadow-sm">Anulado</span>;
                                                
                                                const colors: Record<string, string> = {
                                                    'FACT': 'bg-emerald-500', 'FCAM': 'bg-emerald-500', 'FPEQ': 'bg-cyan-600',
                                                    'NCRE': 'bg-purple-600', 'NABN': 'bg-purple-600',
                                                    'NDEB': 'bg-orange-500', 'FESP': 'bg-amber-600',
                                                    'RDON': 'bg-indigo-500', 'RECI': 'bg-slate-500'
                                                };

                                                return <span className={`${colors[tipo] || 'bg-slate-400'} text-white px-1.5 py-0.5 rounded text-[7px] font-black uppercase shadow-sm`}>{tipo}</span>;
                                            })()}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full ${isAnulado ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                {isAnulado ? 'Anulado' : 'Vigente'}
                                            </span>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan={5} className="px-3 py-2 text-[10px] font-black uppercase text-black">Total Ventas Emitidas</td>
                                    <td className="px-3 py-2 text-right font-black text-[12px] text-black">
                                        {fmtQ(totalSalesAmount)}
                                    </td>
                                    <td colSpan={3}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <Pagination 
                        current={salesPage} 
                        total={totalSalesPages} 
                        onPage={setSalesPage}
                        pageSize={pageSize}
                        setPageSize={setPageSize}
                        resetToFirst={() => { setPurchasePage(1); setSalesPage(1); }}
                    />
                </div>
            )}

            {sub === 'proveedores' && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-[#106ebe] px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Catálogo de Proveedores</span>
                        <button onClick={() => setShowSupForm(true)} className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-[9px] font-black uppercase rounded">
                            <Plus size={11} /> Agregar
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-black uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-2">NIT</th>
                                    <th className="px-4 py-2">Nombre / Razón Social</th>
                                    <th className="px-4 py-2">Teléfono</th>
                                    <th className="px-4 py-2">Productos</th>
                                    <th className="px-4 py-2 text-center">Días Crédito</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {suppliers.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-[10px] font-bold">Sin proveedores registrados</td></tr>
                                ) : suppliers.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50 text-black">
                                        <td className="px-4 py-3 font-mono">{s.nit}</td>
                                        <td className="px-4 py-3 font-black">{s.name}</td>
                                        <td className="px-4 py-3">{s.phone}</td>
                                        <td className="px-4 py-3 truncate max-w-[160px] font-bold">{s.products}</td>
                                        <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 bg-slate-100 text-black text-[9px] font-black rounded">{s.credit_days} días</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {sub === 'cxp' && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-[#106ebe] px-4 py-3">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Cuentas por Pagar — Ordenadas por Vencimiento</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-black uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-2">Proveedor</th>
                                    <th className="px-4 py-2">No. Factura</th>
                                    <th className="px-4 py-2 text-right">Monto</th>
                                    <th className="px-4 py-2">Vencimiento</th>
                                    <th className="px-4 py-2 text-center">Días</th>
                                    <th className="px-4 py-2 text-center">Semáforo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {cxp.length === 0 ? (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-emerald-600 font-bold text-[10px]">✓ Sin cuentas pendientes</td></tr>
                                ) : cxp.map(c => {
                                    const color = c.diff < 0 ? 'bg-red-500' : c.diff <= 7 ? 'bg-amber-400' : 'bg-emerald-500';
                                    const textColor = c.diff < 0 ? 'text-red-700' : c.diff <= 7 ? 'text-amber-700' : 'text-emerald-700';
                                    return (
                                        <tr key={c.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-bold">{c.supplier_name}</td>
                                            <td className="px-4 py-3 text-slate-500">{c.invoice_number}</td>
                                            <td className="px-4 py-3 text-right font-black">{fmtQ(c.total_amount)}</td>
                                            <td className="px-4 py-3">{c.due_date ? dayjs(c.due_date).format('DD/MM/YYYY') : 'N/A'}</td>
                                            <td className={`px-4 py-3 text-center font-black ${textColor}`}>
                                                {c.diff < 0 ? `${Math.abs(c.diff)}d vencida` : `${c.diff}d`}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-block w-3 h-3 rounded-full ${color}`}></span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {sub === 'resumen' && (
                <div className="space-y-3">
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <h3 className="text-[11px] font-black text-[#106ebe] uppercase tracking-widest mb-4">Resumen de Compras — {dayjs(month + '-01').format('MMMM YYYY')}</h3>
                        <div className="space-y-2">
                            {byCategory.map(({ cat, total, pct }) => (
                                <div key={cat} className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-slate-600 w-48 truncate">{cat}</span>
                                    <div className="flex-1 bg-slate-100 rounded-full h-2 text-slate-400">
                                        <div className="bg-slate-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-700 w-28 text-right">{fmtQ(total)}</span>
                                    <span className="text-[10px] font-bold text-slate-400 w-12 text-right">{pct.toFixed(1)}%</span>
                                </div>
                            ))}
                            <div className="border-t border-slate-200 mt-3 pt-3 flex items-center justify-between">
                                <span className="text-[11px] font-black text-[#106ebe] uppercase">Total Compras</span>
                                <span className="text-xl font-black text-slate-800">{fmtQ(totalCompras)}</span>
                                <span className="text-[11px] font-black text-slate-500">
                                    {monthlySales > 0 ? ((totalCompras / monthlySales) * 100).toFixed(1) : '0.0'}% de ventas
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Form (Horizontal) */}
            {showForm && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow id="purchase-invoice-form" title="Mantenimiento de Factura de Compra">
                        <div className="w-[850px] max-h-[85vh] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106EBE] flex flex-col animate-slide-up pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <CloudDownload size={14} className="text-white/80" />
                                    <span className="text-white text-[11px] font-bold uppercase tracking-widest">{editId ? 'Editar' : 'Nueva'} Factura de Compra</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <WindowsSaveButton onClick={saveInvoice} variant="minimal" title="Guardar Factura" />
                                    <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" title="Cerrar">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-5 grid grid-cols-3 gap-6 bg-[#f0f0f0] border-b border-gray-300 overflow-y-auto custom-scrollbar">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase text-black border-b border-black pb-1">Datos de Emisor</h4>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-black mb-1">NIT Proveedor</label>
                                        <input type="text" value={form.supplier_nit} 
                                            onChange={e => {
                                                const val = e.target.value;
                                                setForm(p => ({ ...p, supplier_nit: val }));
                                                const master = suppliers.find(s => s.nit === val.trim());
                                                if (master) setForm(p => ({ ...p, supplier_name: master.name, category: master.default_category || p.category }));
                                            }}
                                            className="w-full border border-gray-400 rounded px-2 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-7 shadow-inner text-black" />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-black mb-1">Nombre Proveedor</label>
                                        <input type="text" value={form.supplier_name} onChange={e => setForm(p => ({ ...p, supplier_name: e.target.value }))}
                                            className="w-full border border-gray-400 rounded px-2 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-7 shadow-inner text-black" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase text-black border-b border-black pb-1">Detalle de Factura</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-black mb-1">Fecha</label>
                                            <input type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))}
                                                className="w-full border border-gray-400 rounded px-2 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-7 shadow-inner text-black" />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-black mb-1">No. Factura</label>
                                            <input type="text" value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))}
                                                className="w-full border border-gray-400 rounded px-2 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-7 shadow-inner text-black" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-black mb-1">Descripción General</label>
                                        <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                            className="w-full border border-gray-400 rounded px-2 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-7 shadow-inner text-black" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-black mb-1">Categoría</label>
                                            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                                                className="w-full border border-gray-400 rounded px-2 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-7 shadow-inner text-black">
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-black mb-1">Estado Pago</label>
                                            <select value={form.payment_status} onChange={e => setForm(p => ({ ...p, payment_status: e.target.value }))}
                                                className="w-full border border-gray-400 rounded px-2 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-7 shadow-inner text-black">
                                                <option value="pending">Pendiente</option>
                                                <option value="paid">Pagado</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase text-black border-b border-black pb-1">Montos (Q)</h4>
                                    <div className="bg-white border border-gray-300 p-4 rounded shadow-inner space-y-3">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-black mb-1">Monto Total</label>
                                            <input type="number" step="0.01" value={form.total_amount ? Number(form.total_amount).toFixed(2) : ''} onChange={e => handleTotalChange(Number(e.target.value))}
                                                className="w-full h-10 text-xl font-black text-black bg-transparent border-none outline-none text-right" />
                                        </div>
                                        <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                                            <span className="text-[9px] font-black uppercase text-black">IVA (12%)</span>
                                            <span className="text-[12px] font-black text-black">{fmtQ(form.iva_amount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black uppercase text-black">Base</span>
                                            <span className="text-[12px] font-black text-black">{fmtQ(form.net_amount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[#f0f0f0] p-3 flex justify-end gap-2">
                                <button onClick={() => setShowForm(false)} className="px-5 py-1.5 text-[10px] font-black uppercase text-slate-500 hover:bg-gray-200 border border-gray-300 rounded transition-all">Cancelar</button>
                                <button onClick={saveInvoice} className="flex items-center gap-2 px-8 py-1.5 bg-[#106ebe] text-white text-[11px] font-black uppercase rounded shadow-lg hover:bg-[#0d5ea0] transition-all active:scale-95">
                                    <Save size={14} /> Guardar Registro
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* Supplier Form (Horizontal) */}
            {showSupForm && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/5 pointer-events-auto">
                    <DraggableWindow id="supplier-form" title="Registro de Proveedor">
                        <div className="w-[750px] max-h-[85vh] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden border border-[#106EBE] flex flex-col animate-slide-up pointer-events-auto">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <Building size={14} className="text-white/80" />
                                    <span className="text-white text-[11px] font-bold uppercase tracking-widest">{supForm.id ? 'Editar' : 'Nuevo'} Proveedor</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <WindowsSaveButton onClick={saveSup} variant="minimal" title="Guardar Proveedor" />
                                    <button onClick={() => setShowSupForm(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1" title="Cerrar">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-4 bg-[#f0f0f0] border-b border-gray-300 overflow-y-auto custom-scrollbar">
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-black mb-1">NIT del Proveedor</label>
                                    <input type="text" value={supForm.nit} onChange={e => setSupForm(p => ({ ...p, nit: e.target.value }))}
                                        className="w-full border border-gray-400 rounded px-3 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-8 shadow-inner text-black" />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-black mb-1">Nombre Comercial / Razón Social</label>
                                    <input type="text" value={supForm.name} onChange={e => setSupForm(p => ({ ...p, name: e.target.value }))}
                                        className="w-full border border-gray-400 rounded px-3 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-8 shadow-inner text-black" />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-black mb-1">Teléfono de Contacto</label>
                                    <input type="text" value={supForm.phone} onChange={e => setSupForm(p => ({ ...p, phone: e.target.value }))}
                                        className="w-full border border-gray-400 rounded px-3 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-8 shadow-inner text-black" />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-black mb-1">Días de Crédito Otorgado</label>
                                    <input type="number" value={supForm.credit_days} onChange={e => setSupForm(p => ({ ...p, credit_days: Number(e.target.value) }))}
                                        className="w-full border border-gray-400 rounded px-3 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-8 shadow-inner text-black" />
                                </div>
                                <div className="col-span-2 grid grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-black mb-1">Categoría Predeterminada (Memoria por NIT)</label>
                                        <select value={supForm.default_category} onChange={e => setSupForm(p => ({ ...p, default_category: e.target.value }))}
                                            className="w-full border border-gray-400 rounded px-3 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-8 shadow-inner text-black">
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-black mb-1">Productos / Servicios que suministra</label>
                                        <input type="text" value={supForm.products} onChange={e => setSupForm(p => ({ ...p, products: e.target.value }))}
                                            className="w-full border border-gray-400 rounded px-3 py-1 text-[11px] font-black outline-none focus:border-[#106EBE] bg-white h-8 shadow-inner text-black" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[#f0f0f0] p-3 flex justify-end gap-2">
                                <button onClick={() => setShowSupForm(false)} className="px-5 py-1.5 text-[10px] font-black uppercase text-slate-500 hover:bg-gray-200 border border-gray-300 rounded transition-all">Cancelar</button>
                                <button onClick={saveSup} className="flex items-center gap-2 px-8 py-1.5 bg-[#106ebe] text-white text-[11px] font-black uppercase rounded shadow-lg hover:bg-[#0d5ea0] transition-all active:scale-95">
                                    <Save size={14} /> Guardar Proveedor
                                </button>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
            {showDetail && selectedInv && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/10 pointer-events-auto">
                    <DraggableWindow id="purchase-xml-detail" title="Detalle XML de Compra">
                        <div className="w-[980px] h-[680px] bg-white shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden border border-[#106EBE] flex flex-col animate-slide-up pointer-events-auto text-gray-900 rounded-sm">
                            {/* Header */}
                            <div className="modal-header bg-[#106EBE] h-9 px-4 flex justify-between items-center cursor-move active:cursor-grabbing shrink-0 select-none">
                                <div className="flex items-center gap-2">
                                    <Package size={14} className="text-white/80" />
                                    <span className="text-white text-[11px] font-black uppercase tracking-wider">DETALLE FACTURA XML — {selectedInv.supplier_name}</span>
                                </div>
                                <button onClick={() => setShowDetail(false)} className="w-9 h-9 flex items-center justify-center hover:bg-red-600 text-white transition-all ml-1" title="Cerrar">
                                    <X size={20} strokeWidth={2.5} />
                                </button>
                            </div>

                            {/* Info Boxes Section (Original Style) */}
                            <div className="p-6 pb-2 grid grid-cols-2 gap-6 bg-white shrink-0">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-black uppercase block ml-1">FECHA EMISIÓN</span>
                                    <div className="border border-gray-300 rounded px-3 py-2 bg-gray-50/50">
                                        <span className="text-[12px] font-black text-black">{dayjs(selectedInv.invoice_date).format('DD [de] MMMM, YYYY')}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-black uppercase block ml-1">NIT EMISOR</span>
                                    <div className="border border-gray-300 rounded px-3 py-2 bg-gray-50/50">
                                        <span className="text-[12px] font-black text-black font-mono tracking-widest">{selectedInv.supplier_nit}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Main Content: Items Table */}
                            <div className="flex-1 overflow-hidden flex flex-col px-6">
                                <div className="flex-1 overflow-y-auto custom-scrollbar border border-gray-200 rounded-t mt-4">
                                    <table className="w-full text-left border-collapse bg-white">
                                        <thead className="sticky top-0 bg-gray-50 shadow-sm z-10 border-b border-gray-200">
                                            <tr className="text-[10px] font-black text-black uppercase">
                                                <th className="px-6 py-3 w-20">CANT</th>
                                                <th className="px-4 py-3">DESCRIPCIÓN PRODUCTO</th>
                                                <th className="px-6 py-3 text-right w-40">MONTO</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {selectedInv.items?.map((it: any, i: number) => (
                                                <tr key={i} className="text-[11px] hover:bg-blue-50/20 transition-colors group">
                                                    <td className="px-6 py-3 font-black text-black">{it.cantidad}</td>
                                                    <td className="px-4 py-3 text-black font-black group-hover:text-[#106ebe] transition-colors">{it.descripcion}</td>
                                                    <td className="px-6 py-3 text-right font-black text-black font-mono tracking-tight">{fmtQ(it.total)}</td>
                                                </tr>
                                            ))}
                                            {(!selectedInv.items || selectedInv.items.length === 0) && (
                                                <tr>
                                                    <td colSpan={3} className="px-8 py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3 opacity-40">
                                                            <Package size={32} className="text-slate-400" />
                                                            <span className="text-[11px] font-bold text-slate-500">Sin detalle de productos disponible</span>
                                                            <span className="text-[9px] text-slate-400">Esta factura no contiene líneas de detalle almacenadas localmente.</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Resumen Fiscal Mejorado y Cuadrado */}
                                <div className="grid grid-cols-5 gap-3 mb-4 shrink-0 px-6">
                                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-sm flex flex-col items-end">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto Neto</span>
                                        <span className="text-[12px] font-black text-black">{fmtQ(selectedInv.total_amount - (selectedInv.iva_amount || 0) - (selectedInv.idp_monto || 0) - (selectedInv.impuesto_bebidas_alcoh || 0) - (selectedInv.impuesto_bebidas_no_alcoh || 0))}</span>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-sm flex flex-col items-end">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">IVA (12%)</span>
                                        <span className="text-[12px] font-black text-black">{fmtQ(selectedInv.iva_amount)}</span>
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-sm flex flex-col items-end">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Otros Imp.</span>
                                        <span className="text-[12px] font-black text-emerald-600">
                                            {fmtQ((selectedInv.idp_monto || 0) + (selectedInv.impuesto_bebidas_alcoh || 0) + (selectedInv.impuesto_bebidas_no_alcoh || 0))}
                                        </span>
                                    </div>
                                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-sm flex flex-col items-end">
                                        <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Impuestos</span>
                                        <span className="text-[12px] font-black text-emerald-700">
                                            {fmtQ((selectedInv.iva_amount || 0) + (selectedInv.idp_monto || 0) + (selectedInv.impuesto_bebidas_alcoh || 0) + (selectedInv.impuesto_bebidas_no_alcoh || 0))}
                                        </span>
                                    </div>
                                    <div className="bg-[#106ebe] border border-[#106ebe] p-3 rounded-sm flex flex-col items-end shadow-lg">
                                        <span className="text-[7px] font-black text-white/70 uppercase tracking-widest mb-1">Total Factura</span>
                                        <span className="text-[15px] font-black text-white">{fmtQ(selectedInv.total_amount)}</span>
                                    </div>
                                </div>

                                {((selectedInv.iva_retenido || 0) > 0 || (selectedInv.isr_retenido || 0) > 0) && (
                                    <div className="mx-6 mb-4 p-2 bg-amber-50 border border-amber-200 rounded flex gap-6 items-center justify-center shrink-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black text-amber-800 uppercase">IVA Retenido:</span>
                                            <span className="text-[11px] font-black text-amber-900">{fmtQ(selectedInv.iva_retenido)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black text-amber-800 uppercase">ISR Retenido:</span>
                                            <span className="text-[11px] font-black text-amber-900">{fmtQ(selectedInv.isr_retenido)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Central Close Button (Original Style) */}
                                <div className="flex justify-center pb-8 pt-2">
                                    <button onClick={() => setShowDetail(false)}
                                        className="px-12 py-2.5 bg-gray-100 hover:bg-gray-200 text-black text-[11px] font-black uppercase rounded border border-gray-300 transition-all active:scale-95 shadow-sm">
                                        CERRAR DETALLE
                                    </button>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* El modal se movió a AccountingPortal.tsx */}
        </div>
    );
};

export default TabCompras;
