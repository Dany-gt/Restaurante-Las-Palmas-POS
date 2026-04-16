import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabase';
import {
    Download, Plus, Trash2, CheckCircle2, RefreshCw, FileText, Save, Loader2, Edit2, X, Cloud
} from 'lucide-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { DraggableWindow } from '../DraggableWindow';
import { activityLogService } from '../../../services/ActivityLogService';

const fmtQ = (n: any) => {
    const val = parseFloat(n) || 0;
    return `Q ${val.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface PurchaseInvoice {
    id?: string;
    org_id?: string;
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
    tipo_dte?: string;
    idp_monto?: number;
    fel_uuid?: string;
    uuid_referencia?: string;
    status?: string;
}

const EMPTY_INVOICE: PurchaseInvoice = {
    invoice_date: dayjs().format('YYYY-MM-DD'),
    supplier_nit: '',
    supplier_name: '',
    invoice_number: '',
    description: '',
    total_amount: 0,
    iva_amount: 0,
    net_amount: 0,
    category: 'materia_prima',
    payment_status: 'pending',
};

const CATEGORIES = [
    { value: 'materia_prima', label: 'Materia Prima' },
    { value: 'servicios', label: 'Servicios' },
    { value: 'gas_energia', label: 'Gas y Energía' },
    { value: 'limpieza', label: 'Limpieza' },
    { value: 'mantenimiento', label: 'Mantenimiento' },
    { value: 'otros', label: 'Otros' },
];

export const TabIVA: React.FC<{
    accentColor: string;
    satSyncing?: boolean;
    satLastSync?: string | null;
    onOpenSatSync?: () => void;
}> = ({ accentColor, satSyncing: globalSyncing, satLastSync, onOpenSatSync }) => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
    const [salesData, setSalesData] = useState({ gross: 0, net: 0, byChannel: { salon: 0, delivery: 0, takeout: 0 }, byPayment: { cash: 0, card: 0 } });
    const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editForm, setEditForm] = useState<PurchaseInvoice>(EMPTY_INVOICE);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [declaring, setDeclaring] = useState(false);
    const [declaredStatus, setDeclaredStatus] = useState<'pending' | 'declared'>('pending');
    const [exportingVentas, setExportingVentas] = useState(false);
    const [exportingCompras, setExportingCompras] = useState(false);
    const [showDeclaraguate, setShowDeclaraguate] = useState(false);
    const [declaraguateData, setDeclaraguateData] = useState({
        ventasBrutas: 0,
        ventasExentas: 0,
        ventasNetas: 0,
        debitoFiscal: 0,
        comprasBrutas: 0,
        creditoFiscalBruto: 0,
        ncreIvaSum: 0,
        creditoFiscalNeto: 0,
        saldoAnterior: 0, // Casilla 6 - Editable
        retencionesNeonet: 0,
        ivaLiquidacion: 0,
        ventasCount: 0,
        comprasCount: 0,
        isSaldoFavor: false
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        const start = dayjs(selectedMonth + '-01').startOf('month').toISOString();
        const end = dayjs(selectedMonth + '-01').endOf('month').toISOString();
        const startDay = dayjs(selectedMonth + '-01').format('YYYY-MM-DD');
        const endDay = dayjs(selectedMonth + '-01').endOf('month').format('YYYY-MM-DD');

        // 1. Facturas de venta (SAT Sync) - Fuente Fiscal principal
        const { data: sales } = await supabase
            .from('sales_invoices')
            .select('total_amount, iva_amount, status')
            .eq('org_id', 'default')
            .gte('invoice_date', startDay)
            .lte('invoice_date', endDay);

        let totalSatGross = 0;
        let totalSatNet = 0;
        let ventasCount = 0;
        (sales || []).forEach(s => {
            const isAnulado = s.status?.toLowerCase() === 'anulado' || s.status?.toLowerCase() === 'annulled' || s.status === 'A';
            if (!isAnulado) {
                totalSatGross += (Number(s.total_amount) || 0);
                totalSatNet += (Number(s.total_amount) - Number(s.iva_amount || 0));
                ventasCount++;
            }
        });

        // 2. Ventas del POS - Para Desglose de Canales y Pagos
        const { data: orders } = await supabase
            .from('orders')
            .select('total, order_type, payment_method')
            .eq('status', 'completed')
            .gte('created_at', start)
            .lte('created_at', end);

        let posGross = 0, salon = 0, delivery = 0, takeout = 0, cash = 0, card = 0;
        (orders || []).forEach(o => {
            const t = Number(o.total) || 0;
            posGross += t;
            if (o.order_type === 'DINE_IN') salon += t;
            else if (o.order_type === 'DELIVERY') delivery += t;
            else takeout += t;
            if ((o.payment_method || '').toLowerCase().includes('tarjeta')) card += t;
            else cash += t;
        });

        // Aplicamos la distribución del POS sobre el monto total de la SAT
        const ratio = posGross > 0 ? totalSatGross / posGross : 0;

        setSalesData({
            gross: totalSatGross,
            net: totalSatNet,
            byChannel: {
                salon: salon * ratio,
                delivery: delivery * ratio,
                takeout: takeout * ratio
            },
            byPayment: {
                cash: cash * ratio,
                card: card * ratio
            }
        });

        // 3. Compras desde Auditoría SAT (Crédito Fiscal)
        const [anio, mes] = selectedMonth.split('-').map(Number);
        const { data: auditoria } = await supabase
            .from('historico_auditoria_sat')
            .select('monto_total, iva_credito_fiscal, tipo_dte, estado')
            .eq('org_id', 'default')
            .eq('periodo_fiscal_mes', mes)
            .eq('periodo_fiscal_anio', anio)
            .eq('estado', 'VIGENTE');

        let comprasBrutas = 0;
        let creditoFiscalBruto = 0;
        let ncreIvaSum = 0;
        let comprasCount = 0;

        (auditoria || []).forEach(a => {
            const total = Number(a.monto_total) || 0;
            const iva = Number(a.iva_credito_fiscal) || 0;
            const isNcre = ['NCRE', 'NABN'].includes(a.tipo_dte || '');
            const isExcluded = ['FPEQ', 'RECI', 'RDON'].includes(a.tipo_dte || '');
            
            if (isExcluded) return;

            if (isNcre) {
                ncreIvaSum += iva;
            } else {
                comprasBrutas += total;
                creditoFiscalBruto += iva;
                comprasCount++;
            }
        });

        const retencionesNeonet = (card * ratio) * 0.035;
        const creditoFiscalNeto = creditoFiscalBruto - ncreIvaSum;
        const diff = totalSatNet * 0.12 - creditoFiscalNeto - retencionesNeonet;

        setDeclaraguateData({
            ventasBrutas: totalSatGross,
            ventasNetas: totalSatNet,
            debitoFiscal: totalSatNet * 0.12,
            comprasBrutas,
            creditoFiscalBruto,
            ncreIvaSum,
            creditoFiscalNeto,
            retencionesNeonet,
            ivaLiquidacion: Math.abs(diff),
            ventasCount,
            comprasCount,
            isSaldoFavor: diff <= 0
        });

        // Facturas de compra
        const { data: invData } = await supabase
            .from('purchase_invoices')
            .select('*')
            .eq('org_id', 'default')
            .gte('invoice_date', dayjs(selectedMonth + '-01').format('YYYY-MM-DD'))
            .lte('invoice_date', dayjs(selectedMonth + '-01').endOf('month').format('YYYY-MM-DD'))
            .order('invoice_date', { ascending: false });
        setInvoices(invData || []);

        // Estado de declaración
        const { data: decl } = await supabase
            .from('tax_declarations')
            .select('status')
            .eq('org_id', 'default')
            .eq('tax_type', 'IVA')
            .eq('period_label', selectedMonth)
            .maybeSingle();
        setDeclaredStatus(decl?.status === 'paid' ? 'declared' : 'pending');

        setLoading(false);
    }, [selectedMonth]);


    useEffect(() => { fetchData(); }, [fetchData]);

    // Refresco automático cuando termina una sync global
    useEffect(() => {
        if (satLastSync) fetchData();
    }, [satLastSync, fetchData]);

    const ventasNetas = salesData.net;
    const debitoFiscal = salesData.gross - salesData.net;

    // REGLA #1: NUNCA sumar al crédito fiscal: FPEQ, RECI, RDON, ANULADO.
    const creditoFiscal = invoices.reduce((acc, inv) => {
        const isAnulado = inv.status?.toLowerCase() === 'anulado' || inv.status?.toLowerCase() === 'annulled' || inv.status === 'A';
        const isExcluded = ['FPEQ', 'RECI', 'RDON'].includes(inv.tipo_dte || '') || isAnulado || (inv.description || '').includes('ANULADO');
        if (isExcluded) return acc;
        return acc + (Number(inv.iva_amount) || 0);
    }, 0);

    const ivaNeto = debitoFiscal - creditoFiscal;
    const dueDateStr = dayjs(selectedMonth + '-01').add(1, 'month').date(15).format('DD/MM/YYYY');

    const handleTotalChange = (val: number) => {
        const iva = (val / 1.12) * 0.12;
        setEditForm(f => ({ ...f, total_amount: val, iva_amount: parseFloat(iva.toFixed(2)), net_amount: parseFloat((val - iva).toFixed(2)) }));
    };

    const saveInvoice = async () => {
        const payload = { ...editForm, org_id: 'default' };
        if (editingId) {
            await supabase.from('purchase_invoices').update(payload).eq('id', editingId);
        } else {
            await supabase.from('purchase_invoices').insert(payload);
        }
        setShowForm(false);
        setEditingId(null);
        setEditForm(EMPTY_INVOICE);
        fetchData();
    };

    const deleteInvoice = async (id: string) => {
        await supabase.from('purchase_invoices').delete().eq('id', id);
        fetchData();
    };

    const markDeclared = async () => {
        setDeclaring(true);
        const start = dayjs(selectedMonth + '-01').startOf('month').format('YYYY-MM-DD');
        const end = dayjs(selectedMonth + '-01').endOf('month').format('YYYY-MM-DD');

        const finalAmount = declaraguateData.isSaldoFavor ? 0 : declaraguateData.ivaLiquidacion;
        const saldoFavorSiguiente = declaraguateData.isSaldoFavor ? declaraguateData.ivaLiquidacion : 0;

        await supabase.from('tax_declarations').upsert({
            org_id: 'default',
            tax_type: 'IVA',
            period_label: selectedMonth,
            period_start: start,
            period_end: end,
            amount_due: finalAmount,
            amount_paid: finalAmount,
            due_date: dayjs(selectedMonth + '-01').add(1, 'month').date(15).format('YYYY-MM-DD'),
            payment_date: dayjs().format('YYYY-MM-DD'),
            status: 'paid',
            metadata: {
                ...declaraguateData,
                debito_fiscal: declaraguateData.debitoFiscal,
                credito_fiscal: declaraguateData.creditoFiscalNeto,
                neonet_acreditado: declaraguateData.retencionesNeonet,
                saldo_favor_anterior: declaraguateData.saldoAnterior,
                saldo_favor_siguiente: saldoFavorSiguiente,
                declared_at: new Date().toISOString()
            }
        }, { onConflict: 'org_id,tax_type,period_label' });

        if (currentUser) {
            activityLogService.logFinancial({
                user: currentUser,
                module: 'CONTABILIDAD',
                action: 'DECLARACION_IVA_GENERADA' as any,
                severity: 'FINANCIAL',
                entity_id: `IVA_${selectedMonth}`,
                entity_type: 'DECLARACION',
                details: {
                    periodo: selectedMonth,
                    debito_fiscal: declaraguateData.debitoFiscal,
                    credito_fiscal: declaraguateData.creditoFiscalNeto,
                    neonet_acreditado: declaraguateData.retencionesNeonet,
                    iva_a_pagar: finalAmount,
                    fecha_limite: dayjs(selectedMonth + '-01').add(1, 'month').date(15).format('YYYY-MM-DD')
                }
            }, { amount: finalAmount, type: 'GASTO' });

            activityLogService.log({
                user: currentUser,
                module: 'CONTABILIDAD',
                action: 'DECLARACION_MARCADA_PAGADA' as any,
                severity: 'INFO',
                entity_id: `IVA_${selectedMonth}`,
                entity_type: 'DECLARACION',
                details: {
                    tipo: 'IVA',
                    periodo: selectedMonth,
                    monto_pagado: finalAmount,
                    fecha_pago: dayjs().format('YYYY-MM-DD'),
                    referencia_pago: 'Marcado Manual'
                }
            });
        }

        setDeclaredStatus('declared');
        setDeclaring(false);
    };

    const handleExportVentas = async () => {
        setExportingVentas(true);
        try {
            const startDay = dayjs(selectedMonth + '-01').format('YYYY-MM-DD');
            const endDay = dayjs(selectedMonth + '-01').endOf('month').format('YYYY-MM-DD');

            const { data: sales, error } = await supabase
                .from('sales_invoices')
                .select('*')
                .eq('org_id', 'default')
                .gte('invoice_date', startDay)
                .lte('invoice_date', endDay)
                .order('invoice_date', { ascending: true });

            if (error) throw error;

            const rows = (sales || []).map((s, i) => {
                const total = Number(s.total_amount) || 0;
                const iva = Number(s.iva_amount) || 0;
                const neto = total - iva;
                const isAnulado = s.status?.toLowerCase().includes('anul') || s.status === 'A';

                return {
                    'No.': i + 1,
                    'Fecha': s.invoice_date,
                    'Tipo': s.tipo_dte || 'FACT',
                    'Serie': s.invoice_number?.split('-')[0] || '',
                    'Número': s.invoice_number?.split('-')[1] || s.invoice_number || '',
                    'NIT Cliente': s.customer_nit || 'C/F',
                    'Nombre Cliente': s.customer_name || 'Consumidor Final',
                    'Exento': 0,
                    'Neto (Bienes)': neto,
                    'Neto (Servicios)': 0,
                    'IVA': isAnulado ? 0 : iva,
                    'Total': isAnulado ? 0 : total,
                    'Estado': isAnulado ? 'ANULADO' : 'VIGENTE'
                };
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Libro de Ventas");
            XLSX.writeFile(wb, `Libro_Ventas_${selectedMonth}.xlsx`);
        } catch (err) {
            console.error("Error exporting sales:", err);
        } finally {
            setExportingVentas(false);
        }
    };

    const handleExportCompras = async () => {
        setExportingCompras(true);
        try {
            const [year, month] = selectedMonth.split('-').map(Number);

            const { data: purchases, error } = await supabase
                .from('historico_auditoria_sat')
                .select('*')
                .eq('org_id', 'default')
                .eq('periodo_fiscal_mes', month)
                .eq('periodo_fiscal_anio', year)
                .order('fecha_emision', { ascending: true });

            if (error) throw error;

            const rows = (purchases || []).map((p, i) => {
                const total = Number(p.monto_total) || 0;
                const iva = Number(p.iva_credito_fiscal || p.iva_monto) || 0;
                const idp = Number(p.idp_monto) || 0;
                const neto = Math.abs(total) - Math.abs(iva) - Math.abs(idp);
                const isAnulado = p.estado === 'ANULADO';

                return {
                    'No.': i + 1,
                    'Fecha': p.fecha_emision,
                    'NIT Proveedor': p.emisor_nit,
                    'Nombre Proveedor': p.emisor_nombre,
                    'Tipo': p.tipo_dte,
                    'Serie': p.serie,
                    'Número': p.numero,
                    'Bienes': p.clasificacion_compra === 'GASTO_OPERACION' && p.categoria_gasto !== 'SERVICIOS_PROF' ? neto : 0,
                    'Servicios': p.clasificacion_compra === 'GASTO_OPERACION' && p.categoria_gasto === 'SERVICIOS_PROF' ? neto : 0,
                    'Activos Fijos': p.clasificacion_compra === 'ACTIVO_FIJO' ? neto : 0,
                    'Exento': !p.afecta_credito_fiscal ? neto : 0,
                    'IVA': isAnulado ? 0 : iva,
                    'IDP / Impuestos': idp,
                    'Total': isAnulado ? 0 : total
                };
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Libro de Compras");
            XLSX.writeFile(wb, `Libro_Compras_${selectedMonth}.xlsx`);
        } catch (err) {
            console.error("Error exporting purchases:", err);
        } finally {
            setExportingCompras(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar text-gray-900">
            {/* Header Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Periodo:</label>
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-1.5 text-[11px] font-bold text-gray-900 bg-white" />
                    <button onClick={fetchData} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
                        <RefreshCw size={13} />
                    </button>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowDeclaraguate(true)}
                        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase bg-[#1e6091] text-white rounded hover:bg-black transition-all shadow-sm"
                    >
                        <FileText size={12} /> Borrador Declaraguate
                    </button>
                    <button
                        onClick={handleExportVentas}
                        disabled={exportingVentas}
                        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                        {exportingVentas ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Libro Ventas
                    </button>
                    <button
                        onClick={handleExportCompras}
                        disabled={exportingCompras}
                        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                        {exportingCompras ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Libro Compras
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* DÉBITO FISCAL */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-[#106ebe] px-4 py-3">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Débito Fiscal — IVA sobre Ventas</span>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total Ventas Brutas</span>
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black rounded border border-blue-100 flex items-center gap-1">
                                    <RefreshCw size={8} /> SAT SYNC
                                </span>
                            </div>
                            <span className="text-[12px] font-black text-black">{fmtQ(salesData.gross)}</span>
                        </div>
                        <Row label="IVA Incluido (÷1.12 × 0.12)" value={fmtQ(debitoFiscal)} highlight />
                        <Row label="Ventas Netas sin IVA" value={fmtQ(ventasNetas)} />
                        <div className="pt-2 border-t border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Por Canal</p>
                            <Row label="Salón" value={fmtQ(salesData.byChannel.salon)} small />
                            <Row label="Delivery" value={fmtQ(salesData.byChannel.delivery)} small />
                            <Row label="Para Llevar" value={fmtQ(salesData.byChannel.takeout)} small />
                        </div>
                        <div className="pt-2 border-t border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Por Forma de Pago</p>
                            <Row label="Efectivo" value={fmtQ(salesData.byPayment.cash)} small />
                            <Row label="Tarjeta" value={fmtQ(salesData.byPayment.card)} small />
                        </div>
                    </div>
                </div>

                {/* CRÉDITO FISCAL */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-[#106ebe] px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Crédito Fiscal — IVA Compras</span>
                        <button onClick={() => { setShowForm(true); setEditingId(null); setEditForm(EMPTY_INVOICE); }}
                            className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-[9px] font-black uppercase rounded transition-all">
                            <Plus size={11} /> Agregar
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-black uppercase tracking-wider">
                                <tr>
                                    <th className="px-3 py-2">Fecha</th>
                                    <th className="px-3 py-2">Proveedor</th>
                                    <th className="px-3 py-2">No. Fact.</th>
                                    <th className="px-3 py-2 text-right">Total</th>
                                    <th className="px-3 py-2 text-right">IVA</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400"><Loader2 size={16} className="animate-spin mx-auto" /></td></tr>
                                ) : invoices.length === 0 ? (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-[10px] font-bold">Sin facturas registradas</td></tr>
                                ) : invoices.map(inv => {
                                    const isAnulado = inv.status?.toLowerCase() === 'anulado' || inv.status?.toLowerCase() === 'annulled' || inv.status === 'A';
                                    const isExcluded = ['FPEQ', 'RECI', 'RDON'].includes(inv.tipo_dte || '') || isAnulado || (inv.description || '').includes('ANULADO');
                                    return (
                                        <tr key={inv.id} className={`hover:bg-slate-50 transition-colors text-black font-black ${isExcluded ? 'opacity-50 grayscale bg-red-50/10' : ''}`}>
                                            <td className="px-3 py-2 font-mono text-black">
                                                <div className="flex flex-col">
                                                    <span>{dayjs(inv.invoice_date).format('DD/MM')}</span>
                                                    <span className="text-[7px] font-black uppercase text-slate-400">{inv.tipo_dte || 'FACT'}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 font-black truncate max-w-[120px] text-black">
                                                <div className="flex flex-col">
                                                    <span className="truncate">{inv.supplier_name}</span>
                                                    {isExcluded && <span className="text-[7px] font-black uppercase text-red-600">No Deducible</span>}
                                                    {inv.idp_monto && inv.idp_monto !== 0 && <span className="text-[7px] font-black uppercase text-amber-600">IDP: {fmtQ(inv.idp_monto)}</span>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-black">
                                                <div className="flex flex-col">
                                                    <span>{inv.invoice_number}</span>
                                                    {inv.uuid_referencia && <span className="text-[7px] text-blue-600 truncate max-w-[50px]">Ref: {inv.uuid_referencia.slice(0, 8)}</span>}
                                                </div>
                                            </td>
                                            <td className={`px-3 py-2 text-right font-black ${inv.total_amount < 0 ? 'text-red-600' : 'text-black'}`}>
                                                {fmtQ(inv.total_amount)}
                                            </td>
                                            <td className={`px-3 py-2 text-right font-black ${isExcluded ? 'text-slate-400 strike-through' : (inv.iva_amount < 0 ? 'text-red-600' : 'text-black')}`}>
                                                {isExcluded ? 'Q 0.00' : fmtQ(inv.iva_amount)}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="flex gap-1 justify-end">
                                                    <button onClick={() => { setEditForm(inv); setEditingId(inv.id!); setShowForm(true); }} className="p-1 hover:text-blue-600 text-slate-400 transition-colors"><Edit2 size={11} /></button>
                                                    <button onClick={() => deleteInvoice(inv.id!)} className="p-1 hover:text-red-500 text-slate-400 transition-colors"><Trash2 size={11} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-blue-50 border-t-2 border-blue-200 text-black font-black">
                                <tr>
                                    <td colSpan={4} className="px-3 py-2 text-[10px] font-black uppercase">Total Crédito Fiscal</td>
                                    <td className="px-3 py-2 text-right text-[12px] font-black">{fmtQ(creditoFiscal)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            {/* DECLARAGUATE — FORMULARIO IVA GENERAL SAT-2048 */}
            <div className="bg-white rounded-xl border-2 border-[#106EBE] shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-[#106EBE] px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileText size={16} className="text-white/80" />
                        <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Declaraguate — Formulario IVA General (SAT-2048)</h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-white/90">Periodo: <span className="underline decoration-white/30">{dayjs(selectedMonth + '-01').format('MMMM YYYY')}</span></span>
                        <button onClick={fetchData} className="p-1.5 hover:bg-white/10 rounded-full text-white transition-all"><RefreshCw size={12} /></button>
                    </div>
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                    {/* DÉBITO FISCAL */}
                    <div className="space-y-3">
                        <h4 className="text-[9px] font-black uppercase text-[#106EBE] border-b border-[#106EBE]/20 pb-1 flex items-center gap-2">
                            <span className="w-4 h-4 bg-[#106EBE] text-white rounded flex items-center justify-center text-[8px]">1</span>
                            DÉBITO FISCAL (VENTAS)
                        </h4>
                        <div className="space-y-1">
                            <FormRow label="Total Ventas Gravadas" value={fmtQ(declaraguateData.ventasBrutas)} sat="1" />
                            <FormRow label="Ventas Exentas (Por defecto)" value={fmtQ(0)} sat="2" />
                            <FormRow label="Base imponible (Ventas / 1.12)" value={fmtQ(declaraguateData.ventasNetas)} sat="3" />
                            <FormRow label="Débito Fiscal (Base x 12%)" value={fmtQ(declaraguateData.debitoFiscal)} sat="4" highlight color="blue" />
                        </div>
                    </div>

                    {/* CRÉDITO FISCAL */}
                    <div className="space-y-3">
                        <h4 className="text-[9px] font-black uppercase text-emerald-700 border-b border-emerald-100 pb-1 flex items-center gap-2">
                            <span className="w-4 h-4 bg-emerald-700 text-white rounded flex items-center justify-center text-[8px]">5</span>
                            CRÉDITO FISCAL (COMPRAS)
                        </h4>
                        <div className="space-y-1">
                            <FormRow label="Crédito Fiscal del Periodo" value={fmtQ(declaraguateData.creditoFiscalNeto)} sat="5" />
                            
                            <div className="flex items-center justify-between gap-3 py-1 px-2 rounded border-b border-[#106EBE]/10 bg-amber-50/30">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-[#106EBE] text-[8px] font-black flex items-center justify-center italic shrink-0">6</span>
                                    <span className="text-[9.5px] font-bold uppercase tracking-tight text-slate-800">Saldo Crédito Mes Anterior (Editable)</span>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">Q</span>
                                    <input 
                                        type="number" 
                                        value={declaraguateData.saldoAnterior || ''} 
                                        onChange={e => setDeclaraguateData(p => ({ ...p, saldoAnterior: parseFloat(e.target.value) || 0 }))}
                                        className="w-24 bg-white border border-slate-200 rounded px-5 py-0.5 text-right font-black text-[10px] outline-none focus:border-[#106EBE]"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <FormRow label="Total Crédito Disponible (5+6)" value={fmtQ(declaraguateData.creditoFiscalNeto + declaraguateData.saldoAnterior)} sat="7" />
                            <FormRow label="Retenciones Neonet Sufridas (3.5%)" value={fmtQ(declaraguateData.retencionesNeonet)} sat="8" color="blue" />
                            <FormRow label="Total a Acreditar (7+8)" value={fmtQ(declaraguateData.creditoFiscalNeto + declaraguateData.saldoAnterior + declaraguateData.retencionesNeonet)} sat="9" highlight color="emerald" />
                        </div>
                    </div>

                    {/* LIQUIDACIÓN FINAL */}
                    <div className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col justify-center space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase text-slate-500">Casilla 10: IVA a Pagar</span>
                                    <span className={`text-[11px] font-black ${!declaraguateData.isSaldoFavor ? 'text-red-600' : 'text-slate-300'}`}>
                                        {declaraguateData.isSaldoFavor ? fmtQ(0) : fmtQ(declaraguateData.ivaLiquidacion)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase text-slate-500">Casilla 11: Saldo a Favor Mes Sig.</span>
                                    <span className={`text-[11px] font-black ${declaraguateData.isSaldoFavor ? 'text-emerald-600' : 'text-slate-300'}`}>
                                        {declaraguateData.isSaldoFavor ? fmtQ(declaraguateData.ivaLiquidacion) : fmtQ(0)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col justify-center items-end text-right">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Resultado Liquidez SAT-2048</p>
                                <h2 className={`text-lg font-black mb-1 ${declaraguateData.isSaldoFavor ? 'text-emerald-600' : 'text-[#106EBE]'}`}>
                                    {declaraguateData.isSaldoFavor ? 'REMANENTE CRÉDITO' : 'OBLIGACIÓN DE PAGO'}
                                </h2>
                                <div className="text-3xl font-black text-slate-900 border-t-2 border-slate-900 pt-1 leading-none">
                                    {fmtQ(declaraguateData.ivaLiquidacion)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FOOTER ACCIONES Y SEMÁFORO */}
                <div className="bg-slate-900 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t-2 border-[#106EBE]">
                    <div className="flex items-center gap-4">
                        <DeadlineSemaphore monthStr={selectedMonth} />
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded font-black uppercase text-[9px] transition-all border border-white/10">
                            <Download size={12} /> Exportar PDF
                        </button>
                        {declaredStatus === 'pending' ? (
                            <button onClick={markDeclared} disabled={declaring} className="flex items-center gap-2 px-6 py-2 bg-[#106EBE] hover:bg-blue-600 text-white rounded font-black uppercase text-[9px] transition-all shadow-[0_3px_8px_rgba(16,110,190,0.3)]">
                                {declaring ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Marcar como Declarado
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 px-6 py-2 bg-emerald-600/20 text-emerald-400 rounded font-black uppercase text-[9px] border border-emerald-500/50">
                                <CheckCircle2 size={12} /> Mes Declarado
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* FORM MODAL */}
            {showForm && (
                <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200">
                        <div className="bg-[#106ebe] px-5 py-3 flex items-center justify-between rounded-t-xl">
                            <span className="text-[11px] font-black text-white uppercase tracking-widest">
                                {editingId ? 'Editar Factura' : 'Nueva Factura de Compra'}
                            </span>
                            <button onClick={() => setShowForm(false)} className="text-white/60 hover:text-white"><X size={16} /></button>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-3">
                            <FormField label="Fecha" colSpan={1}>
                                <input type="date" value={editForm.invoice_date} onChange={e => setEditForm(f => ({ ...f, invoice_date: e.target.value }))} className="input-std" />
                            </FormField>
                            <FormField label="No. Factura" colSpan={1}>
                                <input type="text" value={editForm.invoice_number} onChange={e => setEditForm(f => ({ ...f, invoice_number: e.target.value }))} className="input-std" />
                            </FormField>
                            <FormField label="NIT Proveedor" colSpan={1}>
                                <input type="text" value={editForm.supplier_nit} onChange={e => setEditForm(f => ({ ...f, supplier_nit: e.target.value }))} className="input-std" />
                            </FormField>
                            <FormField label="Nombre Proveedor" colSpan={1}>
                                <input type="text" value={editForm.supplier_name} onChange={e => setEditForm(f => ({ ...f, supplier_name: e.target.value }))} className="input-std" />
                            </FormField>
                            <FormField label="Descripción" colSpan={2}>
                                <input type="text" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="input-std" />
                            </FormField>
                            <FormField label="Monto Total (Q)" colSpan={1}>
                                <input type="number" value={editForm.total_amount} onChange={e => handleTotalChange(Number(e.target.value))} className="input-std" />
                            </FormField>
                            <FormField label="IVA Calculado (Q)" colSpan={1}>
                                <input type="number" value={editForm.iva_amount} readOnly className="input-std bg-slate-50 text-black font-black" />
                            </FormField>
                            <FormField label="Monto sin IVA (Q)" colSpan={1}>
                                <input type="number" value={editForm.net_amount} readOnly className="input-std bg-slate-50" />
                            </FormField>
                            <FormField label="Categoría" colSpan={1}>
                                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className="input-std">
                                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </FormField>
                        </div>
                        <div className="px-5 pb-5 flex justify-end gap-2">
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 rounded transition-all">Cancelar</button>
                            <button onClick={saveInvoice} className="flex items-center gap-2 px-5 py-2 bg-[#106ebe] text-white text-[10px] font-black uppercase rounded hover:bg-black transition-all">
                                <Save size={12} /> Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DECLARAGUATE SAT-2048 - STANDARD SKILL APPLIED */}
            {showDeclaraguate && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] bg-black/5 flex items-center justify-center p-4 overflow-hidden pointer-events-none">
                    <DraggableWindow id="modal-declaraguate" title="Borrador SAT-2048 (IVA General)">
                        <div className="w-full max-w-4xl bg-white shadow-[0_0_50px_rgba(0,0,0,0.3)] border-2 border-[#106EBE] flex flex-col pointer-events-auto overflow-hidden animate-slide-up">
                            {/* Header (Mover Modal) - Parte del DraggableWindow maneja el drag, pero definimos el estilo */}
                            <div className="modal-header bg-[#106EBE] h-9 px-4 flex justify-between items-center cursor-move select-none">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 size={16} className="text-[#a8d0f0]" />
                                    <span className="text-white font-black uppercase tracking-widest text-[11px]">Borrador SAT-2048 (IVA General)</span>
                                </div>
                                <button 
                                    onClick={() => setShowDeclaraguate(false)} 
                                    className="w-9 h-9 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8 bg-white overflow-y-auto max-h-[85vh]">
                                <div className="grid grid-cols-2 gap-12">
                                    {/* DÉBITO FISCAL */}
                                    <div className="space-y-6">
                                        <h4 className="text-[11px] font-black uppercase text-[#106EBE] border-b-2 border-[#106EBE] pb-1">Determinación del Débito Fiscal (Ventas)</h4>
                                        <div className="space-y-3">
                                            <TaxBox label="Suma de Ventas Brutas" val={declaraguateData.ventasBrutas} satBox="1" help={`Total ventas gravadas (${declaraguateData.ventasCount} facturas)`} />
                                            <TaxBox label="Ventas Netas (Base Imponible)" val={declaraguateData.ventasNetas || declaraguateData.ventasBrutas / 1.12} satBox="2" />
                                            <TaxBox label="DÉBITO FISCAL (IVA VENTAS)" val={declaraguateData.debitoFiscal} satBox="3" highlight color="blue" />
                                        </div>
                                    </div>

                                    {/* CRÉDITO FISCAL */}
                                    <div className="space-y-6">
                                        <h4 className="text-[11px] font-black uppercase text-emerald-700 border-b-2 border-emerald-700 pb-1">Determinación del Crédito Fiscal (Compras)</h4>
                                        <div className="space-y-3">
                                            <TaxBox label="Compras Brutas (Gravadas)" val={declaraguateData.comprasBrutas} satBox="14" help={`Total compras locales (${declaraguateData.comprasCount} facturas)`} />
                                            <TaxBox label="CRÉDITO FISCAL (IVA COMPRAS)" val={declaraguateData.creditoFiscalNeto} satBox="15" highlight color="emerald" />
                                            <TaxBox label="Retenciones Card (Neonet 3.5%)" val={declaraguateData.retencionesNeonet} satBox="22" help="Crédito por retenciones sufridas" />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 p-5 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resumen de Liquidación</p>
                                            <h3 className="text-lg font-black text-slate-800 mt-1">
                                                {declaraguateData.isSaldoFavor ? 'REMANENTE CRÉDITO FISCAL' : 'IVA A PAGAR ESTE MES'}
                                            </h3>
                                        </div>
                                        <div className={`text-2xl font-black tabular-nums ${!declaraguateData.isSaldoFavor ? 'text-[#106EBE]' : 'text-emerald-600'}`}>
                                            {fmtQ(declaraguateData.ivaLiquidacion)}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-widest italic">
                                    <span>* Borrador generado automáticamente con datos del POS y Auditoría SAT Sync.</span>
                                    <div className="flex gap-3">
                                        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 border-2 border-slate-200 rounded-md hover:bg-slate-50 transition-all text-slate-700 font-bold uppercase text-[10px]">
                                            <Download size={13} /> Imprimir Borrador
                                        </button>
                                        <button onClick={() => setShowDeclaraguate(false)} className="px-8 py-2.5 bg-slate-900 text-white rounded-md hover:bg-black transition-all font-bold uppercase text-[10px]">
                                            Cerrar Vista
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            <style>{`.input-std { width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: 700; outline: none; color: #000000; } .input-std:focus { border-color: #6366f1; }`}</style>
            
            {/* SECCIÓN IMPRESIÓN SAT-2048 (Solo visible en print) */}
            <PrintFormSAT2048 data={declaraguateData} period={selectedMonth} />

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body * { visibility: hidden; }
                    #print-sat-2048, #print-sat-2048 * { visibility: visible; }
                    #print-sat-2048 { position: absolute; left: 0; top: 0; width: 100%; }
                }
            ` }} />
        </div>
    );
};

const FormRow: React.FC<{ label: string; value: string; sat: string; highlight?: boolean; color?: 'blue' | 'emerald' | 'red' }> = ({ label, value, sat, highlight, color }) => (
    <div className={`flex items-center justify-between gap-3 py-1.5 px-2 rounded border-b border-transparent transition-all hover:bg-slate-50 ${highlight ? 'bg-slate-50 border-slate-100' : ''}`}>
        <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-400 text-[8px] font-black flex items-center justify-center italic shrink-0">{sat}</span>
            <span className={`text-[9.5px] font-bold uppercase tracking-tight ${highlight ? 'text-black font-black' : 'text-slate-600'}`}>{label}</span>
        </div>
        <span className={`text-[11px] font-black tabular-nums transition-all ${color === 'blue' ? 'text-[#106EBE]' : color === 'emerald' ? 'text-emerald-600' : color === 'red' ? 'text-red-500' : 'text-black'}`}>{value}</span>
    </div>
);

const DeadlineSemaphore: React.FC<{ monthStr: string }> = ({ monthStr }) => {
    const today = dayjs();
    const nextMonth = dayjs(monthStr + '-01').add(1, 'month');
    const deadline = nextMonth.date(15);
    const diff = deadline.diff(today, 'day');
    
    let color = 'text-emerald-400';
    let label = 'Vencimiento lejano';
    let dot = 'bg-emerald-400';

    if (diff < 0) {
        color = 'text-red-500';
        label = '¡VENCIDO!';
        dot = 'bg-red-500 animate-pulse';
    } else if (diff <= 3) {
        color = 'text-red-400';
        label = '¡URGENTE!';
        dot = 'bg-red-400 animate-pulse';
    } else if (diff <= 7) {
        color = 'text-amber-400';
        label = 'Vence pronto';
        dot = 'bg-amber-400';
    }

    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
                <div className={`w-2 h-2 rounded-full ${dot}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{label}</span>
            </div>
            <div className="text-[9px] font-bold text-white/50 uppercase">
                Fecha límite: <span className="text-white/80 font-black">{deadline.format('DD [de] MMMM')}</span>
                {diff >= 0 && <span className="ml-2">— {diff} días restantes</span>}
            </div>
        </div>
    );
};

const Row: React.FC<{ label: string; value: string; highlight?: boolean; small?: boolean }> = ({ label, value, highlight, small }) => (
    <div className={`flex justify-between items-center py-1.5 ${highlight ? 'bg-blue-50/50 -mx-4 px-4 border-y border-blue-100 font-bold' : ''}`}>
        <span className={`${small ? 'text-[9px]' : 'text-[10px]'} font-bold text-slate-600 uppercase tracking-tight`}>{label}</span>
        <span className={`${small ? 'text-[10px]' : 'text-[11px]'} font-black text-black tabular-nums`}>{value}</span>
    </div>
);

const TaxBox: React.FC<{ label: string; val: number; satBox: string; highlight?: boolean; color?: 'blue' | 'emerald'; help?: string }> = ({ label, val, satBox, highlight, color, help }) => (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${highlight ? (color === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200') : 'bg-white border-slate-100'}`}>
        <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{label}</span>
            {help && <span className="text-[8px] font-bold text-slate-400">{help}</span>}
        </div>
        <div className="flex items-center gap-6">
            <span className={`text-[13px] font-black tabular-nums shrink-0 ${highlight ? (color === 'blue' ? 'text-[#1e6091]' : 'text-emerald-700') : 'text-slate-700'}`}>{fmtQ(val)}</span>
            <div className="w-9 h-9 rounded bg-[#f8fafc] flex items-center justify-center border-2 border-slate-200 shadow-sm shrink-0 ml-4">
                <span className="text-[12px] font-black text-slate-600">{satBox}</span>
            </div>
        </div>
    </div>
);

const SummaryBox: React.FC<{ label: string; value: string; color: string; large?: boolean }> = ({ label, value, color, large }) => {
    const colors: Record<string, string> = { blue: 'bg-blue-50 border-blue-200 text-blue-800', indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800', orange: 'bg-orange-50 border-orange-200 text-orange-800', emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800' };
    return (
        <div className={`p-4 rounded-lg border-2 ${colors[color]}`}>
            <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">{label}</p>
            <p className={`${large ? 'text-2xl' : 'text-xl'} font-black tabular-nums`}>{value}</p>
        </div>
    );
};

const FormField: React.FC<{ label: string; colSpan?: number; children: React.ReactNode }> = ({ label, colSpan = 1, children }) => (
    <div style={{ gridColumn: `span ${colSpan}` }}>
        <label className="block text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">{label}</label>
        {children}
    </div>
);

// --- COMPONENTE DE IMPRESIÓN FORMATO SAT-2048 ---
const PrintFormSAT2048: React.FC<{ data: any; period: string }> = ({ data, period }) => {
    return (
        <div id="print-sat-2048" className="hidden print:block p-10 font-serif text-black leading-tight bg-white">
            <div className="text-center border-b-2 border-black pb-4 mb-6">
                <h1 className="text-xl font-bold uppercase">SUPERINTENDENCIA DE ADMINISTRACIÓN TRIBUTARIA</h1>
                <h2 className="text-lg font-bold">DECLARACIÓN DEL IMPUESTO AL VALOR AGREGADO</h2>
                <h3 className="text-md font-bold italic">Formulario SAT-2048 (IVA General)</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8 text-[12px] border p-4 border-black">
                <div>
                    <p><strong>NIT:</strong> 9188766-6</p>
                    <p><strong>Nombre / Razón Social:</strong> Cevicheria y Restaurante Las Palmas, S.A.</p>
                </div>
                <div className="text-right">
                    <p><strong>Periodo:</strong> {dayjs(period + '-01').format('MMMM YYYY').toUpperCase()}</p>
                    <p><strong>Fecha de Presentación:</strong> {dayjs().format('DD/MM/YYYY')}</p>
                </div>
            </div>

            <div className="space-y-3 border-t-2 border-black pt-4">
                <PrintRow label="Casilla 1: Total ventas gravadas" val={data.ventasBrutas} />
                <PrintRow label="Casilla 2: Total ventas exentas" val={0} />
                <PrintRow label="Casilla 3: Base imponible (Ventas / 1.12)" val={data.ventasNetas} />
                <PrintRow label="Casilla 4: Débito fiscal (Casilla 3 x 12%)" val={data.debitoFiscal} highlight />
                
                <div className="h-4" />

                <PrintRow label="Casilla 5: Total crédito fiscal del periodo" val={data.creditoFiscalNeto} />
                <PrintRow label="Casilla 6: Saldo crédito periodo anterior" val={data.saldoAnterior} />
                <PrintRow label="Casilla 7: Total crédito disponible (5+6)" val={data.creditoFiscalNeto + data.saldoAnterior} />
                <PrintRow label="Casilla 8: Retenciones Neonet acreditadas" val={data.retencionesNeonet} />
                <PrintRow label="Casilla 9: Total a acreditar (7+8)" val={data.creditoFiscalNeto + data.saldoAnterior + data.retencionesNeonet} />

                <div className="h-4 border-t-2 border-black mt-4" />
                
                <PrintRow label="Casilla 10: IVA A PAGAR ESTE MES" val={data.isSaldoFavor ? 0 : data.ivaLiquidacion} highlight />
                <PrintRow label="Casilla 11: SALDO A FAVOR MES SIGUIENTE" val={data.isSaldoFavor ? data.ivaLiquidacion : 0} highlight />
            </div>

            <div className="mt-24 flex flex-col items-center">
                <p className="text-[10px] italic mb-12">Declaro bajo juramento que los datos contenidos en esta declaración son verídicos.</p>
                <div className="w-64 border-t border-black mb-1"></div>
                <p className="text-[11px] font-bold">Firma del Contribuyente o Representante Legal</p>
                <p className="text-[10px]">NIT del Declarante: 9188766-6</p>
            </div>

            <div className="fixed bottom-4 left-10 right-10 flex justify-between text-[8px] text-slate-400 border-t border-slate-200 pt-1 italic">
                <span>Generado por Las Palmas POS - Antigravity OS Fiscal Engine</span>
                <span>ID Sistema: {Math.random().toString(36).substring(7).toUpperCase()}</span>
            </div>
        </div>
    );
};

const PrintRow: React.FC<{ label: string; val: any; highlight?: boolean }> = ({ label, val, highlight }) => {
    const numericVal = parseFloat(val) || 0;
    return (
        <div className={`flex justify-between items-center py-1.5 border-b border-slate-100 ${highlight ? 'bg-slate-100 font-bold' : ''}`}>
            <span className="text-[10px] uppercase tracking-tight">{label}</span>
            <span className="text-[11px] font-black font-mono">
                Q {numericVal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </span>
        </div>
    );
};
