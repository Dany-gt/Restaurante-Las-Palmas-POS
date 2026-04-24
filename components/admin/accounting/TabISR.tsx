import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabase';
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, Loader2, Edit2, Save, X, TrendingUp, Cloud } from 'lucide-react';
import dayjs from 'dayjs';
import { calcularISOTrimestral, ISOCalculation } from '../../../utils/isoCalculator';

const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ISRQuarter {
    label: string;
    period: string;
    start: string;
    end: string;
    dueDate: string;
    ingresos: number;
    gastos: number;
    baseISR: number;
    monto: number;
    status: 'pending' | 'paid' | 'overdue';
}

const QUARTERS: { label: string; period: string; months: number[]; dueDate: string }[] = [
    { label: 'T1', period: 'Ene – Feb – Mar', months: [0, 1, 2], dueDate: '30 Abril' },
    { label: 'T2', period: 'Abr – May – Jun', months: [3, 4, 5], dueDate: '31 Julio' },
    { label: 'T3', period: 'Jul – Ago – Sep', months: [6, 7, 8], dueDate: '31 Octubre' },
    { label: 'T4', period: 'Oct – Nov – Dic', months: [9, 10, 11], dueDate: '31 Enero (sig.)' },
];

const ISR_RATE = 0.05;
const NEONET_RATE_DEFAULT = 3.5;

interface NeonetRow {
    month: string;
    cardSales: number;
    retentionPct: number;
    retainedAmount: number;
    bank: string;
    status: 'retained' | 'credited';
}

interface FESPRow {
    id: string;
    date: string;
    supplier: string;
    amount: number;
    isrRetained: number;
    ivaRetained: number;
}

export const TabISR: React.FC<{ 
    accentColor: string;
    satSyncing?: boolean;
    satLastSync?: string | null;
    onOpenSatSync?: () => void;
}> = ({ accentColor, satSyncing: globalSyncing, satLastSync, onOpenSatSync }) => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [quarters, setQuarters] = useState<ISRQuarter[]>([]);
    const [neonetRows, setNeonetRows] = useState<NeonetRow[]>([]);
    const [fespRows, setFespRows] = useState<FESPRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalOpex, setTotalOpex] = useState(0);
    const [editingQ, setEditingQ] = useState<number | null>(null);
    const [editGastos, setEditGastos] = useState(0);

    // ISO State
    const [isoIncome, setIsoIncome] = useState<number>(0);
    const [isoNetAsset, setIsoNetAsset] = useState<number>(0);
    const [isoResult, setIsoResult] = useState<ISOCalculation | null>(null);

    useEffect(() => {
        if (isoIncome > 0 || isoNetAsset > 0) {
            setIsoResult(calcularISOTrimestral(isoIncome, isoNetAsset));
        } else {
            setIsoResult(null);
        }
    }, [isoIncome, isoNetAsset]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const qData: ISRQuarter[] = [];
        const nData: NeonetRow[] = [];

        // Fetch costos operativos de cost_items para estimar gastos deducibles
        const { data: costItems } = await supabase
            .from('cost_items')
            .select('amount, section')
            .eq('org_id', 'default');
        const monthlyOpex = (costItems || []).reduce((a, c) => a + (Number(c.amount) || 0), 0);
        setTotalOpex(monthlyOpex);

        // Fetch declarations saved
        const { data: decls } = await supabase
            .from('tax_declarations')
            .select('*')
            .eq('org_id', 'default')
            .ilike('tax_type', 'ISR_%')
            .gte('period_start', `${year}-01-01`)
            .lte('period_end', `${year}-12-31`);

        for (let qi = 0; qi < 4; qi++) {
            const q = QUARTERS[qi];
            const startMonth = q.months[0];
            const endMonth = q.months[2];
            const start = dayjs(`${year}-${String(startMonth + 1).padStart(2, '0')}-01`).startOf('month').toISOString();
            const end = dayjs(`${year}-${String(endMonth + 1).padStart(2, '0')}-01`).endOf('month').toISOString();

            const { data: orders } = await supabase
                .from('orders')
                .select('total')
                .eq('status', 'completed')
                .gte('created_at', start)
                .lte('created_at', end);

            const ingresos = (orders || []).reduce((a, o) => a + (Number(o.total) || 0), 0);
            const ingresosNetos = ingresos / 1.12;
            const gastosDeducibles = monthlyOpex * 3;
            const baseISR = Math.max(0, ingresosNetos - gastosDeducibles);
            const monto = baseISR * ISR_RATE;

            const taxType = `ISR_Q${qi + 1}`;
            const savedDecl = (decls || []).find(d => d.tax_type === taxType);

            qData.push({
                label: q.label,
                period: q.period,
                start,
                end,
                dueDate: q.dueDate,
                ingresos: ingresosNetos,
                gastos: gastosDeducibles,
                baseISR,
                monto,
                status: savedDecl?.status === 'paid' ? 'paid' : (new Date() > new Date(savedDecl?.due_date || '2099-01-01') ? 'overdue' : 'pending'),
            });

            // Neonet monthly data
            for (let mi = 0; mi < 3; mi++) {
                const month = q.months[mi];
                const mStart = dayjs(`${year}-${String(month + 1).padStart(2, '0')}-01`).startOf('month').toISOString();
                const mEnd = dayjs(`${year}-${String(month + 1).padStart(2, '0')}-01`).endOf('month').toISOString();
                const { data: mOrders } = await supabase
                    .from('orders')
                    .select('total, payment_method')
                    .eq('status', 'completed')
                    .gte('created_at', mStart)
                    .lte('created_at', mEnd);
                const cardSales = (mOrders || []).filter(o => (o.payment_method || '').toLowerCase().includes('tarjeta')).reduce((a, o) => a + (Number(o.total) || 0), 0);
                nData.push({
                    month: dayjs(`${year}-${String(month + 1).padStart(2, '0')}-01`).format('MMM YYYY'),
                    cardSales,
                    retentionPct: NEONET_RATE_DEFAULT,
                    retainedAmount: cardSales * (NEONET_RATE_DEFAULT / 100),
                    bank: 'Neonet / BAC',
                    status: 'retained',
                });
            }
        }

        // Fetch FESP Retentions
        const { data: fespData } = await supabase
            .from('purchase_invoices')
            .select('id, invoice_date, supplier_name, total_amount, isr_retenido, iva_retenido')
            .eq('tipo_dte', 'FESP')
            .gte('invoice_date', `${year}-01-01`)
            .lte('invoice_date', `${year}-12-31`)
            .order('invoice_date', { ascending: false });

        if (fespData) {
            setFespRows(fespData.map(f => ({
                id: f.id,
                date: f.invoice_date,
                supplier: f.supplier_name,
                amount: Number(f.total_amount),
                isrRetained: Number(f.isr_retenido),
                ivaRetained: Number(f.iva_retenido)
            })));
        }

        setQuarters(qData);
        setNeonetRows(nData);
        setLoading(false);
    }, [year]);


    useEffect(() => { fetchData(); }, [fetchData]);

    // Refresco automático cuando termina una sync global
    useEffect(() => {
        if (satLastSync) fetchData();
    }, [satLastSync, fetchData]);

    const markQuarterPaid = async (qi: number) => {
        const q = quarters[qi];
        const taxType = `ISR_Q${qi + 1}`;
        await supabase.from('tax_declarations').upsert({
            org_id: 'default',
            tax_type: taxType,
            period_label: `${year}-Q${qi + 1}`,
            period_start: q.start.split('T')[0],
            period_end: q.end.split('T')[0],
            amount_due: q.monto,
            amount_paid: q.monto,
            due_date: q.dueDate,
            payment_date: dayjs().format('YYYY-MM-DD'),
            status: 'paid',
        }, { onConflict: 'org_id,tax_type,period_label' });
        fetchData();
    };

    const totalNeonet = neonetRows.reduce((a, r) => a + r.retainedAmount, 0);
    const totalISR = quarters.reduce((a, q) => a + q.monto, 0);
    const totalIngresos = quarters.reduce((a, q) => a + q.ingresos, 0);
    const isrNeto = Math.max(0, totalISR - totalNeonet);

    const statusBadge = (s: string) => {
        if (s === 'paid') return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase rounded-full flex items-center gap-1"><CheckCircle2 size={9} />Pagado</span>;
        if (s === 'overdue') return <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[9px] font-black uppercase rounded-full flex items-center gap-1"><AlertTriangle size={9} />Vencido</span>;
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black uppercase rounded-full flex items-center gap-1"><Clock size={9} />Pendiente</span>;
    };

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar text-gray-900">
            {/* Controls */}
            <div className="flex items-center gap-3">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Año:</label>
                <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} min={2020} max={2030}
                    className="border border-gray-300 rounded px-3 py-1.5 text-[11px] font-black text-black w-24" />
                <button onClick={fetchData} className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors">
                    <RefreshCw size={13} />
                </button>
                {loading && <Loader2 size={14} className="animate-spin text-orange-500" />}
            </div>

            {/* SECCIÓN A — Pagos Trimestrales */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-[#106ebe] px-4 py-3">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Sección A — Pagos Trimestrales ISR (5%)</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px]">
                        <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-black uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-2">Trim.</th>
                                <th className="px-4 py-2">Periodo</th>
                                <th className="px-4 py-2 text-right">Ingresos Netos</th>
                                <th className="px-4 py-2 text-right">Gastos Deduc.</th>
                                <th className="px-4 py-2 text-right">Base ISR</th>
                                <th className="px-4 py-2 text-right">ISR (5%)</th>
                                <th className="px-4 py-2">Vencimiento</th>
                                <th className="px-4 py-2">Estado</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {quarters.map((q, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors text-black font-black">
                                    <td className="px-4 py-3 font-black">{q.label}</td>
                                    <td className="px-4 py-3 font-black">{q.period}</td>
                                    <td className="px-4 py-3 text-right font-mono">{fmtQ(q.ingresos)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{fmtQ(q.gastos)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{fmtQ(q.baseISR)}</td>
                                    <td className="px-4 py-3 text-right font-black">{fmtQ(q.monto)}</td>
                                    <td className="px-4 py-3">{q.dueDate}</td>
                                    <td className="px-4 py-3">{statusBadge(q.status)}</td>
                                    <td className="px-4 py-3">
                                        {q.status !== 'paid' && (
                                            <button onClick={() => markQuarterPaid(i)}
                                                className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-[9px] font-black uppercase rounded transition-all">
                                                Marcar Pagado
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECCIÓN B — Retenciones Neonet */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-[#106ebe] px-4 py-3">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Sección B — Retenciones Neonet (ISR Tarjetas)</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px]">
                        <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-black uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-2">Mes</th>
                                <th className="px-4 py-2 text-right">Ventas Tarjeta</th>
                                <th className="px-4 py-2 text-center">Ret. %</th>
                                <th className="px-4 py-2 text-right">Monto Retenido</th>
                                <th className="px-4 py-2">Banco</th>
                                <th className="px-4 py-2">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {neonetRows.map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors text-black font-black">
                                    <td className="px-4 py-2 font-black">{r.month}</td>
                                    <td className="px-4 py-2 text-right font-mono">{fmtQ(r.cardSales)}</td>
                                    <td className="px-4 py-2 text-center">
                                        <input type="number" defaultValue={r.retentionPct} step="0.1"
                                            onChange={e => {
                                                const updated = [...neonetRows];
                                                updated[i].retentionPct = Number(e.target.value);
                                                updated[i].retainedAmount = r.cardSales * (Number(e.target.value) / 100);
                                                setNeonetRows(updated);
                                            }}
                                            className="w-14 text-center border border-slate-200 rounded px-1 py-0.5 text-[10px] font-black outline-none text-black" />
                                        <span className="text-black font-black">%</span>
                                    </td>
                                    <td className="px-4 py-2 text-right font-black text-black">{fmtQ(r.retainedAmount)}</td>
                                    <td className="px-4 py-2 text-black font-black">{r.bank}</td>
                                    <td className="px-4 py-2">
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black uppercase rounded-full">Retenido</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-100 border-t-2 border-slate-200 text-black">
                            <tr>
                                <td colSpan={3} className="px-4 py-2 text-[10px] font-black uppercase">Total Retenciones Acumuladas</td>
                                <td className="px-4 py-2 text-right text-[12px] font-black">{fmtQ(totalNeonet)}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* SECCIÓN C — ISR Anual */}
            <div className="bg-white rounded-xl border-2 border-orange-200 shadow-sm p-5">
                <h3 className="text-[11px] font-black text-black uppercase tracking-widest mb-4">Sección C — ISR Anual {year}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <AnnualCard label="Total Ingresos del Año" value={fmtQ(totalIngresos)} color="bg-slate-50 text-slate-800" />
                    <AnnualCard label="Total Gastos Deducibles" value={fmtQ(totalOpex * 12)} color="bg-slate-50 text-slate-800" />
                    <AnnualCard label="ISR Calculado (Trimestral)" value={fmtQ(totalISR)} color="bg-orange-50 text-orange-800" />
                    <AnnualCard label="Retenciones Neonet" value={`- ${fmtQ(totalNeonet)}`} color="bg-blue-50 text-blue-800" />
                    <AnnualCard label="ISR Neto a Pagar" value={fmtQ(isrNeto)} color="bg-red-50 text-red-800" large />
                </div>
                <p className="text-[9px] font-bold text-slate-400 mt-4">* Cálculo estimado bajo régimen optativo sobre utilidades. Consulta con contador certificado.</p>
            </div>

            {/* SECCIÓN D — Impuesto de Solidaridad (ISO) */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-[#106ebe] px-5 py-3 flex items-center justify-between">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Sección D — Cálculo de Impuesto de Solidaridad (ISO)</span>
                    <span className="text-[9px] font-black text-white/50 uppercase tracking-wider">Tasa Anual : 1.0%</span>
                </div>
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 shadow-inner">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Parámetros del Periodo Fiscal Anterior</p>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-600 uppercase">Ingresos Brutos Anuales:</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400">Q</span>
                                        <input type="number" value={isoIncome || ''} onChange={e => setIsoIncome(Number(e.target.value))}
                                            placeholder="0.00"
                                            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 text-[12px] font-black outline-none focus:ring-2 focus:ring-[#106ebe]/20 focus:border-[#106ebe] transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-600 uppercase">Activo Neto Anual:</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400">Q</span>
                                        <input type="number" value={isoNetAsset || ''} onChange={e => setIsoNetAsset(Number(e.target.value))}
                                            placeholder="0.00"
                                            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 text-[12px] font-black outline-none focus:ring-2 focus:ring-[#106ebe]/20 focus:border-[#106ebe] transition-all" />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
                                <AlertTriangle size={14} className="shrink-0" />
                                <p className="text-[9px] font-bold leading-tight uppercase">La ley establece que se debe utilizar la base que sea mayor entre Ingresos y Activos.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col justify-center">
                        {isoResult ? (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Base Aplicada:</span>
                                    <span className="px-2 py-0.5 bg-blue-50 text-[#106ebe] text-[9px] font-black uppercase rounded border border-blue-100">{isoResult.baseUtilizada}</span>
                                </div>
                                
                                <div className="bg-white rounded-2xl p-7 border-2 border-[#106ebe] shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12">
                                        <TrendingUp size={120} />
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 relative z-10">Pago Trimestral ISO</p>
                                    <p className="text-4xl font-black text-black tracking-tighter relative z-10">{fmtQ(isoResult.pagoTrimestral)}</p>
                                    
                                    <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-6 relative z-10">
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Monto Base Anual</p>
                                            <p className="text-[12px] font-black text-black">{fmtQ(isoResult.montoBase)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Impuesto Anual (1%)</p>
                                            <p className="text-[12px] font-black text-black">{fmtQ(isoResult.impuestoAnualTotal)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[9px] font-bold text-slate-500 leading-relaxed italic">
                                        Este monto de {fmtQ(isoResult.pagoTrimestral)} coincide con la boleta de pago generada por el sistema. El ISO pagado puede acreditarse al ISR en el futuro.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                <TrendingUp size={48} className="mb-4 opacity-10" />
                                <p className="text-[11px] font-black uppercase tracking-widest text-center">
                                    Ingrese datos fiscales anuales<br/>
                                    <span className="text-[9px] font-bold opacity-60">Para proyectar el pago del trimestre</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SECCIÓN E — Retenciones Facturas Especiales (FESP) */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-[#106ebe] px-4 py-3">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Sección E — Retenciones Facturas Especiales (FESP)</span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 border-b border-slate-100">
                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                      <p className="text-[9px] font-black text-emerald-800 uppercase mb-1">Total ISR Retenido (5%)</p>
                      <p className="text-xl font-black text-emerald-900">{fmtQ(fespRows.reduce((a,r) => a + r.isrRetained, 0))}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <p className="text-[9px] font-black text-blue-800 uppercase mb-1">Total IVA Retenido (12%)</p>
                      <p className="text-xl font-black text-blue-900">{fmtQ(fespRows.reduce((a,r) => a + r.ivaRetained, 0))}</p>
                    </div>
                    <div className="col-span-2 flex items-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <AlertTriangle size={18} className="text-amber-500 mr-3" />
                        <p className="text-[10px] font-bold text-slate-600 leading-tight">
                            IMPORTANTE: Estas retenciones deben declararse y pagarse a la SAT en el formulario SAT-2311 y SAT-2000 respectivamente dentro de los primeros 10 días hábiles del mes siguiente.
                        </p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px]">
                        <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-black uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-2">Fecha</th>
                                <th className="px-4 py-2">Proveedor/Servicio</th>
                                <th className="px-4 py-2 text-right">Monto Factura</th>
                                <th className="px-4 py-2 text-right">ISR Retenido (5%)</th>
                                <th className="px-4 py-2 text-right">IVA Retenido (12%)</th>
                                <th className="px-4 py-2 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {fespRows.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-bold uppercase">No se detectaron facturas especiales</td></tr>
                            ) : fespRows.map(f => (
                                <tr key={f.id} className="hover:bg-slate-50 transition-colors text-black font-black">
                                    <td className="px-4 py-3">{dayjs(f.date).format('DD/MM/YYYY')}</td>
                                    <td className="px-4 py-3">{f.supplier}</td>
                                    <td className="px-4 py-3 text-right">{fmtQ(f.amount)}</td>
                                    <td className="px-4 py-3 text-right text-emerald-700">{fmtQ(f.isrRetained)}</td>
                                    <td className="px-4 py-3 text-right text-blue-700">{fmtQ(f.ivaRetained)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-black uppercase rounded-full">Por Enterar</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const AnnualCard: React.FC<{ label: string; value: string; color: string; large?: boolean }> = ({ label, value, color, large }) => (
    <div className={`p-4 rounded-lg bg-white border border-slate-200 text-black`}>
        <p className="text-[9px] font-black uppercase tracking-widest mb-1">{label}</p>
        <p className={`${large ? 'text-2xl' : 'text-lg'} font-black tabular-nums`}>{value}</p>
    </div>
);
