import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabase';
import { 
    Plus, Trash2, Save, X, RefreshCw, Loader2, 
    ArrowUpRight, ArrowDownLeft, FileUp, Search, 
    CheckCircle2, AlertCircle, Info, Check, CloudUpload,
    Calendar, Link2, CreditCard, Building2, UserCircle, Briefcase, Minus
} from 'lucide-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { DraggableWindow } from '../DraggableWindow';
import { WindowsSaveButton } from '../../WindowsSaveButton';
import { registrarAuditoria } from '../../../services/auditService';
import { activityLogService } from '../../../services/ActivityLogService';

const fmtQ = (n: any) => {
    const val = parseFloat(n) || 0;
    return `Q ${val.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface BankMovement {
    id: string;
    fecha: string;
    descripcion: string;
    debito: number;
    credito: number;
    saldo: number;
    tipo: 'debito' | 'credito';
    referencia?: string;
    estado: 'conciliado' | 'pendiente' | 'justificado' | 'nuevo';
    cash_flow_id?: string;
    // BI InterBanking Specifics
    secuencia?: number;
    valor?: number;
    signo?: string;
    adenda?: string;
    categoria?: string;
    tipo_registro?: string;
    agencia?: number;
    requiere_revision?: boolean;
    color_cat?: string;
}

interface CashFlowItem {
    id?: string;
    flow_date: string;
    concept: string;
    category: string;
    flow_type: 'entry' | 'exit';
    entry_amount: number;
    exit_amount: number;
    notes?: string;
}

const ENTRY_CATEGORIES = ['Ventas efectivo', 'Ventas tarjeta (neto)', 'Transferencia recibida', 'Otros ingresos'];
const EXIT_CATEGORIES = ['Compras materia prima', 'Pago planilla', 'Pago IGSS', 'Servicios (luz/agua)', 'Pago alquiler', 'Gastos varios'];
const EMPTY: CashFlowItem = { flow_date: dayjs().format('YYYY-MM-DD'), concept: '', category: EXIT_CATEGORIES[0], flow_type: 'exit', entry_amount: 0, exit_amount: 0, notes: '' };

export const TabFlujoCaja: React.FC<{ accentColor: string }> = ({ accentColor }) => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
    const [items, setItems] = useState<CashFlowItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<CashFlowItem>(EMPTY);
    const [alertThreshold, setAlertThreshold] = useState(5000);
    const [bankBalance, setBankBalance] = useState(0);
    const [bankBalanceInput, setBankBalanceInput] = useState('');

    // --- Bank Reconciliation State ---
    const [bankMovements, setBankMovements] = useState<BankMovement[]>([]);
    const [selectedBank, setSelectedBank] = useState('BI');
    const [bankLoading, setBankLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'conciliados' | 'pendientes' | 'sin_banco'>('all');
    const [isMatching, setIsMatching] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedMovement, setSelectedMovement] = useState<BankMovement | null>(null);
    const [assignType, setAssignType] = useState('COMPRA MATERIA PRIMA');
    const [savingConcil, setSavingConcil] = useState(false);


    const fetchData = useCallback(async () => {
        setLoading(true);
        const start = dayjs(month + '-01').startOf('month').format('YYYY-MM-DD');
        const end = dayjs(month + '-01').endOf('month').format('YYYY-MM-DD');
        const { data } = await supabase.from('cash_flow').select('*').eq('org_id', 'default')
            .gte('flow_date', start).lte('flow_date', end).order('flow_date');
        setItems(data || []);
        setLoading(false);
    }, [month]);

    const fetchBankData = useCallback(async () => {
        setBankLoading(true);
        const [year, mes] = month.split('-').map(Number);
        const { data } = await supabase.from('bank_reconciliation_bi')
            .select('*')
            .eq('periodo_mes', mes)
            .eq('periodo_anio', year)
            .eq('banco', selectedBank)
            .order('fecha_movimiento', { ascending: true });
        
        if (data) {
            setBankMovements(data.map(m => ({
                id: m.id,
                fecha: m.fecha_movimiento,
                descripcion: m.descripcion,
                debito: m.tipo === 'debito' ? Math.abs(m.valor) : 0,
                credito: m.tipo === 'credito' ? Math.abs(m.valor) : 0,
                saldo: m.saldo_contable || 0, 
                tipo: m.tipo,
                referencia: m.numero_doc,
                estado: m.estado,
                cash_flow_id: m.referencia_sistema,
                adenda: m.adenda,
                categoria: m.categoria,
                tipo_registro: m.tipo_registro,
                agencia: m.agencia,
                codigo_transaccion: m.codigo_transaccion,
                tipo_transaccion: m.tipo_transaccion,
                nombre_agencia: m.nombre_agencia,
                saldo_contable: m.saldo_contable,
                fecha_valor: m.fecha_valor,
                saldo_disponible: m.saldo_disponible,
                signo: m.signo,
                cuenta_origen: m.cuenta_origen
            })));
        } else {
            setBankMovements([]);
        }
        setBankLoading(false);
    }, [month, selectedBank]);

    useEffect(() => { 
        fetchData(); 
        fetchBankData();
    }, [fetchData, fetchBankData]);

    // --- CRUCE AUTOMÁTICO — REGLAS BI (PASO 3 / CRUCE CON EL SISTEMA) ---
    const autoMatch = async () => {
        setIsMatching(true);
        const matchedMovements = [...bankMovements];
        
        // Cargar fuentes de cruce
        const start = dayjs(month + '-01').startOf('month').format('YYYY-MM-DD');
        const end = dayjs(month + '-01').endOf('month').format('YYYY-MM-DD');

        // 1. Cargar Ventas POS (para Neonet)
        const { data: sales } = await supabase.from('sales_tickets').select('*').eq('payment_method', 'tarjeta').gte('created_at', start).lte('created_at', end);
        // 2. Cargar Planilla
        const { data: payroll } = await supabase.from('payroll_payments').select('*').gte('payment_date', start).lte('payment_date', end);
        // 3. Cargar Facturas Proveedores
        const { data: purchases } = await supabase.from('purchase_invoices').select('*').eq('status', 'pendiente').gte('invoice_date', start).lte('invoice_date', end);
        // 4. Cargar Declaraciones
        const { data: taxes } = await supabase.from('tax_declarations').select('*').eq('periodo_mes', parseInt(month.split('-')[1])).eq('periodo_anio', parseInt(month.split('-')[0]));
        // 5. Cargar Cost Items Generales (para Combustible)
        const { data: costs } = await supabase.from('cost_items').select('*').gte('created_at', start).lte('created_at', end);
        // 6. Cargar Accounting Entries (para Gastos Varios)
        const { data: accounting } = await supabase.from('accounting_entries').select('*').gte('entry_date', start).lte('entry_date', end);
        for (let i = 0; i < matchedMovements.length; i++) {
            const bank = matchedMovements[i];
            const bankVal = bank.tipo === 'credito' ? bank.credito : -bank.debito;
            const bankDate = dayjs(bank.fecha);

            let matchId = null;
            let tableRef = '';

            if (bank.categoria === 'NEONET') {
                // REGLA 1: Neonet ± Q50, ± 3 días
                const sMatch = sales?.find(s => {
                    const diffMonto = Math.abs(s.total - bank.credito);
                    const diffFecha = Math.abs(bankDate.diff(dayjs(s.created_at), 'day'));
                    return diffMonto <= 50 && diffFecha <= 3;
                });
                if (sMatch) { matchId = sMatch.id; tableRef = 'sales_tickets'; }
            } else if (bank.categoria === 'PLANILLA') {
                // REGLA PLANILLA: ± Q100, mismo mes
                const pMatch = payroll?.find(p => Math.abs(p.net_pay_total - bank.debito) <= 100);
                if (pMatch) { matchId = pMatch.id; tableRef = 'payroll_payments'; }
            } else if (bank.categoria === 'ARRENDAMIENTO') {
                // REGLA ALQUILER: Q11,788.10 aprox
                if (Math.abs(bank.debito - 11788.10) <= 5) { matchId = 'ALQUILER_FIXED'; tableRef = 'cost_items'; }
            } else if (bank.categoria === 'TRANSFERENCIA_RECIBIDA') {
                // REGLA TRANSFERENCIA_RECIBIDA (CRÉDITO): cash_flow tipo=ingreso
                const sysMatch = items.find(sys => sys.flow_type === 'entry' && Math.abs(sys.entry_amount - bank.credito) <= 1 && Math.abs(bankDate.diff(dayjs(sys.flow_date), 'day')) <= 3);
                if (sysMatch) { matchId = sysMatch.id; tableRef = 'cash_flow'; }
            } else if (bank.categoria === 'IMPUESTO_SAT') {
                const tMatch = taxes?.find(t => Math.abs(t.total - bank.debito) <= 10);
                if (tMatch) { matchId = tMatch.id; tableRef = 'tax_declarations'; }
            } else if (bank.categoria === 'COMBUSTIBLE') {
                const cMatch = costs?.find(c => c.name.toLowerCase().includes('combustible') && Math.abs(c.amount - bank.debito) <= 10);
                if (cMatch) { matchId = cMatch.id; tableRef = 'cost_items'; }
            } else if (bank.tipo === 'debito') {
                // REGLA PROVEEDORES: ± Q10
                const buyMatch = purchases?.find(p => Math.abs(p.total - bank.debito) <= 10);
                if (buyMatch) { matchId = buyMatch.id; tableRef = 'purchase_invoices'; }
                
                // Si aún no hay match, intentar con accounting_entries (Gastos Varios)
                if (!matchId) {
                    const accMatch = accounting?.find(a => Math.abs(a.amount - bank.debito) <= 1);
                    if (accMatch) { matchId = accMatch.id; tableRef = 'accounting_entries'; }
                }
            }

            // Si no hay match específico, buscar en cash_flow genérico (REGLA PASO 3)
            if (!matchId) {
                const sysMatch = items.find(sys => {
                    const sysAmount = sys.flow_type === 'entry' ? sys.entry_amount : -sys.exit_amount;
                    return Math.abs(bankVal - sysAmount) <= 1 && Math.abs(bankDate.diff(dayjs(sys.flow_date), 'day')) <= 2;
                });
                if (sysMatch) { matchId = sysMatch.id; tableRef = 'cash_flow'; }
            }

            if (matchId) {
                matchedMovements[i].estado = 'conciliado';
                matchedMovements[i].cash_flow_id = matchId;
                // matchedMovements[i].tabla_referencia = tableRef;
            }
        }

        setBankMovements(matchedMovements);
        setIsMatching(false);
    };

    // ─── GUARDAR CONCILIACIÓN → bank_reconciliation ───────────────────
    const saveConciliacion = async () => {
        if (bankMovements.length === 0) return;
        setSavingConcil(true);
        const [yr, mo] = month.split('-').map(Number);
        const rows = bankMovements.map(m => ({
            org_id: 'default',
            periodo_mes: mo,
            periodo_anio: yr,
            banco: selectedBank,
            secuencia: m.secuencia || 0,
            fecha_movimiento: dayjs(m.fecha).format('YYYY-MM-DD HH:mm:ssZ'),
            descripcion: m.descripcion,
            numero_doc: m.referencia || '',
            valor: m.tipo === 'credito' ? m.credito : m.debito,
            codigo_transaccion: m.codigo_transaccion || 0,
            tipo_transaccion: m.tipo_transaccion || 0,
            nombre_agencia: m.nombre_agencia || '',
            agencia: m.agencia || 0,
            saldo_contable: m.saldo_contable || 0,
            fecha_valor: m.fecha_valor || dayjs(m.fecha).format('YYYY-MM-DD HH:mm:ssZ'),
            saldo_disponible: m.saldo_disponible || 0,
            signo: m.tipo === 'credito' ? '+' : '-',
            cuenta_origen: m.cuenta_origen || '',
            adenda: m.adenda || '',
            tipo: m.tipo,
            monto_real: m.tipo === 'credito' ? m.credito : -m.debito,
            categoria: m.categoria || 'OTRO',
            tipo_registro: m.tipo_registro || 'variable',
            estado: m.estado,
            referencia_sistema: m.cash_flow_id || null,
            tabla_referencia: m.tabla_referencia || null
        }));
        // Upsert por periodo+banco (borrar y re-insertar)
        await supabase.from('bank_reconciliation_bi')
            .delete()
            .eq('org_id', 'default')
            .eq('periodo_mes', mo)
            .eq('periodo_anio', yr)
            .eq('banco', selectedBank);
        await supabase.from('bank_reconciliation_bi').insert(rows);
        setSavingConcil(false);
        alert(`✓ Conciliación guardada (${rows.length} movimientos)`);
    };

    // ─── APROBAR CONCILIADOS → persist estado='conciliado' ────────────
    const aprobarConciliados = async () => {
        const conciliados = bankMovements.filter(m => m.estado === 'conciliado');
        if (conciliados.length === 0) { alert('No hay movimientos conciliados para aprobar.'); return; }
        setSavingConcil(true);
        for (const m of conciliados) {
            if (m.id && !m.id.startsWith('bi-')) {
                await supabase.from('bank_reconciliation_bi')
                    .update({ estado: 'conciliado', conciliado_fecha: new Date().toISOString() })
                    .eq('id', m.id);
            }
        }

        if (currentUser) {
            const montoTotal = conciliados.reduce((a, m) => a + (m.tipo === 'credito' ? m.credito : m.debito), 0);
            await registrarAuditoria({
                modulo: 'CONTABILIDAD',
                accion: 'CONCILIACION_APROBADA',
                accion_descripcion: `Aprobación de ${conciliados.length} movimientos conciliados (${selectedBank}) para el periodo ${month}`,
                entidad_id: `CONCIL_${selectedBank}_${month}`,
                entidad_tipo: 'conciliacion_bancaria',
                entidad_nombre: `Conciliación ${selectedBank} ${month}`,
                metadata: {
                    banco: selectedBank,
                    periodo: month,
                    movimientos_conciliados: conciliados.length,
                    monto_total_conciliado: montoTotal,
                    autorizado_por: currentUser.name
                },
                impacto_financiero: {
                    monto_total: montoTotal,
                    impacto_mensual_estimado: `Confirmación de Q${montoTotal.toFixed(2)}`
                }
            }, currentUser);
        }

        alert(`✓ ${conciliados.length} movimiento(s) aprobado(s)`);
        setSavingConcil(false);
    };

    const exportToPDF = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;
        
        const totCred = bankMovements.reduce((a, m) => a + m.credito, 0);
        const totDeb = bankMovements.reduce((a, m) => a + m.debito, 0);
        const diffAbs = Math.abs(diff);
        
        // Asumiendo que el primer movimiento es el saldo inicial mas antiguo
        const saldoIni = bankMovements.length > 0 ? (bankMovements[0].saldo + bankMovements[0].debito - bankMovements[0].credito) : 0;
        const depositTrans = bankMovements.filter(m => m.estado !== 'conciliado' && m.tipo === 'credito').reduce((a, m) => a + m.credito, 0);
        const checksPend = bankMovements.filter(m => m.estado !== 'conciliado' && m.tipo === 'debito').reduce((a, m) => a + m.debito, 0);

        const pendingRowsHtml = bankMovements.filter(m => m.estado !== 'conciliado').map(m => `
            <tr>
                <td>${m.fecha.substring(0,10)}</td>
                <td>${m.descripcion} ${m.adenda ? '<br/><small>' + m.adenda + '</small>' : ''}</td>
                <td class="right">${m.debito > 0 ? fmtQ(m.debito) : ''}</td>
                <td class="right">${m.credito > 0 ? fmtQ(m.credito) : ''}</td>
            </tr>
        `).join('');

        const html = `
            <html>
                <head>
                    <title>Reporte de Conciliación Bancaria</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
                        h1, h2, h3 { margin: 5px 0; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px; }
                        .section { margin-bottom: 20px; border: 1px solid #000; padding: 10px; }
                        .section-title { font-weight: bold; background: #ddd; padding: 5px; margin-top: 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
                        th, td { padding: 4px; border-bottom: 1px solid #ccc; text-align: left; }
                        .right { text-align: right; }
                        .row { display: flex; justify-content: space-between; padding: 3px 0; }
                        .bold { font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>CEVICHERIA Y RESTAURANTE LAS PALMAS, S.A.</h2>
                        <p>NIT: 9188766-6</p>
                        <h3>CONCILIACIÓN BANCARIA</h3>
                        <p>Banco Industrial — Cuenta 81-0044302-5</p>
                        <p>Periodo: ${month}</p>
                    </div>

                    <div class="section">
                        <div class="section-title">SECCIÓN A — SALDO SEGÚN BANCO</div>
                        <div class="row"><span>Saldo inicial del mes:</span><span class="right">${fmtQ(saldoIni)}</span></div>
                        <div class="row"><span>(+) Total créditos del mes:</span><span class="right">${fmtQ(totCred)}</span></div>
                        <div class="row"><span>(-) Total débitos del mes:</span><span class="right">${fmtQ(totDeb)}</span></div>
                        <div class="row bold" style="border-top:1px solid #000; margin-top:5px; padding-top:5px;"><span>Saldo final según banco:</span><span class="right">${fmtQ(bankBalance)}</span></div>
                    </div>

                    <div class="section">
                        <div class="section-title">SECCIÓN B — SALDO SEGÚN LIBROS</div>
                        <div class="row"><span>Saldo inicial en libros:</span><span class="right">Q ---</span></div>
                        <div class="row"><span>(+) Depósitos registrados:</span><span class="right">${fmtQ(totalEntradas)}</span></div>
                        <div class="row"><span>(-) Pagos registrados:</span><span class="right">${fmtQ(totalSalidas)}</span></div>
                        <div class="row bold" style="border-top:1px solid #000; margin-top:5px; padding-top:5px;"><span>Saldo en libros (Sistema):</span><span class="right">${fmtQ(saldoFinal)}</span></div>
                    </div>

                    <div class="section">
                        <div class="section-title">SECCIÓN C — PARTIDAS CONCILIATORIAS</div>
                        <div class="row"><span>Depósitos en tránsito:</span><span class="right">${fmtQ(depositTrans)}</span></div>
                        <div class="row"><span>Cheques pendientes:</span><span class="right">- ${fmtQ(checksPend)}</span></div>
                        <div class="row"><span>Otros ajustes:</span><span class="right">Q 0.00</span></div>
                        <div class="row bold" style="border-top:1px solid #000; margin-top:5px; padding-top:5px;"><span>DIFERENCIA EXPLICADA:</span><span class="right">${fmtQ(diffAbs)}</span></div>
                    </div>

                    <div class="section">
                        <div class="section-title">SECCIÓN D — MOVIMIENTOS PENDIENTES</div>
                        <table>
                            <thead><tr><th>Fecha</th><th>Descripción</th><th class="right">Débito</th><th class="right">Crédito</th></tr></thead>
                            <tbody>
                                ${pendingRowsHtml}
                                ${bankMovements.filter(m => m.estado !== 'conciliado').length === 0 ? '<tr><td colspan="4" style="text-align:center">No hay movimientos pendientes</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                        <div style="text-align: center; width: 45%;">
                            <div style="border-bottom: 1px solid #000; height: 30px;"></div>
                            <p>Preparado por: Administrador</p>
                            <p>Fecha: ${dayjs().format('DD/MM/YYYY')}</p>
                            <p>Firma: _______________</p>
                        </div>
                    </div>
                </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    const parseInterbankingDate = (dateStr: any) => {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;
        const str = String(dateStr).trim();
        const parts = str.split(' ');
        const datePart = parts[0];
        const timePart = parts[1] || '00:00';
        
        if (!datePart.includes('/')) return null;
        
        const [day, month, year] = datePart.split('/');
        if (!day || !month || !year) return null;
        
        const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00`;
        const dateObj = new Date(isoString);
        return isNaN(dateObj.getTime()) ? null : dateObj;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setBankLoading(true);
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const data = evt.target?.result;
                const wb = XLSX.read(data, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // Mapear desde fila 2, fila 1 son headers
                const rows: any[] = XLSX.utils.sheet_to_json(ws);
                if (rows.length === 0) throw new Error("Archivo vacío o formato incorrecto");

                const parsed = rows.map((row, idx) => {
                    const banco = row['Banco'];
                    const secuencia = row['Secuencia'];
                    const fecha_movimiento = parseInterbankingDate(row['Fecha Movimiento']);
                    const descRaw = row['Descripcion Movimiento'];
                    const docRaw = row['No. Doc']?.toString();
                    const valParsed = parseFloat(row['Valor']) || 0;
                    const codigo_transaccion = row['Transaccion'];
                    const tipo_transaccion = row['Tipo Transaccion'];
                    const nombre_agencia = row['Nombre Agencia'];
                    const agencia = row['Agencia'];
                    const saldo_contable = parseFloat(row['Saldo Contable']) || 0;
                    const fecha_valor = parseInterbankingDate(row['fecha Valor']);
                    const saldo_disponible = parseFloat(row['Saldo Disponible']) || 0;
                    const signRaw = row['Signo Movimiento']?.toString().trim();
                    const cuenta_origen = row['Cuenta Origen']?.toString();
                    const adendaRaw = row['Adenda'] || '';

                    if (!fecha_movimiento && !valParsed) return null;

                    const sign = signRaw || '';
                    const tipoMov = sign === '+' ? 'credito' : (sign === '-' ? 'debito' : '');
                    
                    const mov: any = {
                        id: `bi-${idx}-${Date.now()}`,
                        fecha: fecha_movimiento ? fecha_movimiento.toISOString() : new Date().toISOString(),
                        descripcion: String(descRaw || 'S/D').trim(),
                        debito: tipoMov === 'debito' ? valParsed : 0,
                        credito: tipoMov === 'credito' ? valParsed : 0,
                        saldo: saldo_contable,
                        tipo: tipoMov,
                        referencia: String(docRaw || '').trim(),
                        secuencia: secuencia || idx,
                        adenda: String(adendaRaw || '').trim(),
                        agencia: agencia || 0,
                        estado: 'pendiente',
                        color_cat: 'slate',
                        categoria: 'OTRO',
                        // Additional specific fields:
                        codigo_transaccion,
                        tipo_transaccion,
                        nombre_agencia,
                        saldo_contable,
                        fecha_valor: fecha_valor ? fecha_valor.toISOString() : null,
                        saldo_disponible,
                        signo: sign,
                        cuenta_origen
                    };

                    const classification = classifyBI(mov.descripcion, mov.adenda, mov.agencia, mov.referencia, mov.tipo, mov.tipo_transaccion);
                    Object.assign(mov, classification);

                    return mov;
                }).filter(Boolean);

                console.log("Parsed BI Data (Exact):", parsed);
                if (parsed.length === 0) {
                    alert("No se encontraron movimientos válidos. Verifique que las columnas coincidan con el formato InterBanking.");
                } else {
                    setBankMovements(parsed as BankMovement[]);
                    // Actualizar saldo de cuenta real
                    if (parsed.length > 0) {
                        const lastBalance = parsed[parsed.length - 1].saldo;
                        setBankBalance(lastBalance);
                    }
                }
            } catch (err) {
                console.error("Error parsing BI XLS:", err);
                alert("Error al procesar el archivo. Verifique que sea un formato de estado de cuenta válido.");
            } finally {
                setBankLoading(false);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const classifyBI = (desc: string, adenda: string, agencia: number, doc: string, tipo: string, tipo_transaccion?: number) => {
        const text = (desc + ' ' + adenda).toUpperCase();
        let res: any = { categoria: 'OTRO', color_cat: 'white', tipo_registro: 'variable', requiere_revision: true };

        if (text.includes('LQNN') || text.includes('LIQUIDACION NEONET')) {
            res = { categoria: 'NEONET', color_cat: 'emerald', tipo_registro: 'ingreso_ventas_tarjeta', nota: 'Liquidación Neonet — ventas con tarjeta' };
        } else if (text.includes('PLANILLA')) {
            res = { categoria: 'PLANILLA', color_cat: 'blue', tipo_registro: 'egreso_laboral', nota: 'Pago de planilla empleados' };
        } else if (text.includes('ARRENDAMIENTO')) {
            res = { categoria: 'ARRENDAMIENTO', color_cat: 'orange', tipo_registro: 'egreso_fijo' };
        } else if (desc.toUpperCase().includes('ACH') && text.includes('BANCO INDUSTRIAL')) {
            res = { categoria: 'TRANSFERENCIA_ACH', color_cat: 'blue', tipo_registro: 'transferencia' };
        } else if (text.includes('GASOLINERA') || (text.includes('DO1') && agencia == 501)) {
            res = { categoria: 'COMBUSTIBLE', color_cat: 'slate', tipo_registro: 'egreso_variable', nota: 'Compra combustible' };
        } else if (text.includes('SUPERMERCADO') || text.includes('MAXI') || text.includes('ALIMENTART') || text.includes('ALIMENTOS')) {
            res = { categoria: 'MATERIA_PRIMA', color_cat: 'slate', tipo_registro: 'egreso_variable' };
        } else if (text.includes('PAGO DE CHEQUE')) {
            res = { categoria: 'CHEQUE', color_cat: 'red', tipo_registro: 'egreso_cheque', nota: 'Cheque No. ' + doc };
        } else if (text.includes('DECLARAGUATE') || text.includes('SAT')) {
            res = { categoria: 'IMPUESTO_SAT', color_cat: 'purple', tipo_registro: 'egreso_fiscal', nota: 'Pago declaración SAT' };
        } else if (desc.toUpperCase().includes('ACH') && tipo_transaccion == 2) {
            res = { categoria: 'TRANSFERENCIA_RECIBIDA', color_cat: 'emerald', tipo_registro: 'ingreso' };
        } else if (desc.toUpperCase().includes('ACH')) {
            res = { categoria: 'TRANSFERENCIA_ACH', color_cat: 'blue', tipo_registro: 'transferencia' };
        }

        return res;
    };

    const save = async () => {
        const payload = { ...form, org_id: 'default' };
        if (form.flow_type === 'entry') { payload.entry_amount = form.entry_amount; payload.exit_amount = 0; }
        else { payload.exit_amount = form.exit_amount; payload.entry_amount = 0; }
        const { data } = await supabase.from('cash_flow').insert(payload).select();
        
        if (currentUser && data && data.length > 0) {
            activityLogService.logFinancial({
                user: currentUser,
                module: 'CONTABILIDAD',
                action: 'FLUJO_CAJA_REGISTRADO' as any,
                severity: 'INFO',
                entity_id: data[0].id,
                entity_type: 'FLUJO_CAJA',
                details: {
                    fecha: form.flow_date,
                    concepto: form.concept,
                    categoria: form.category,
                    tipo: form.flow_type,
                    monto: form.flow_type === 'entry' ? form.entry_amount : form.exit_amount
                }
            }, { amount: form.flow_type === 'entry' ? form.entry_amount : form.exit_amount, type: form.flow_type === 'entry' ? 'INGRESO' : 'EGRESO' });
        }

        setShowForm(false); setForm(EMPTY); fetchData();
    };

    const del = async (id: string) => { 
        const item = items.find(i => i.id === id);
        if (item && currentUser) {
            activityLogService.logFinancial({
                user: currentUser,
                module: 'CONTABILIDAD',
                action: 'FLUJO_CAJA_ELIMINADO' as any,
                severity: 'CRITICAL',
                entity_id: id,
                entity_type: 'FLUJO_CAJA',
                details: {
                    fecha: item.flow_date,
                    concepto: item.concept,
                    categoria: item.category,
                    tipo: item.flow_type,
                    monto: item.flow_type === 'entry' ? item.entry_amount : item.exit_amount,
                    motivo: 'Eliminación manual desde panel'
                }
            }, { amount: item.flow_type === 'entry' ? item.entry_amount : item.exit_amount, type: item.flow_type === 'entry' ? 'INGRESO' : 'EGRESO' });
        }
        await supabase.from('cash_flow').delete().eq('id', id); 
        fetchData(); 
    };

    // Running balance
    let runningBalance = 0;
    const rows = items.map(i => {
        runningBalance += (Number(i.entry_amount) || 0) - (Number(i.exit_amount) || 0);
        return { ...i, balance: runningBalance };
    });

    const totalEntradas = items.reduce((a, i) => a + Number(i.entry_amount || 0), 0);
    const totalSalidas = items.reduce((a, i) => a + Number(i.exit_amount || 0), 0);
    const flujoNeto = totalEntradas - totalSalidas;
    const saldoFinal = runningBalance;

    // Weekly summary
    const weeks = [1, 2, 3, 4].map(w => {
        const weekItems = items.filter(i => {
            const d = dayjs(i.flow_date).date();
            return d >= (w - 1) * 7 + 1 && d <= w * 7;
        });
        const ent = weekItems.reduce((a, i) => a + Number(i.entry_amount || 0), 0);
        const sal = weekItems.reduce((a, i) => a + Number(i.exit_amount || 0), 0);
        return { week: w, entradas: ent, salidas: sal, neto: ent - sal };
    });
    let weekAccum = 0;

    // Projection (based on monthly avg from last 3 months)
    const dailyAvgIncome = totalEntradas > 0 ? totalEntradas / dayjs(month + '-01').daysInMonth() : 0;
    const dailyAvgExpense = totalSalidas > 0 ? totalSalidas / dayjs(month + '-01').daysInMonth() : 0;
    const proj30 = saldoFinal + (dailyAvgIncome - dailyAvgExpense) * 30;
    const proj60 = saldoFinal + (dailyAvgIncome - dailyAvgExpense) * 60;

    // Bank reconciliation
    const diff = bankBalance - saldoFinal;

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar text-gray-900">
            {/* Controls */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Periodo:</label>
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-[11px] font-bold text-gray-900 bg-white" />
                    <button onClick={fetchData} className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><RefreshCw size={13} /></button>
                    {loading && <Loader2 size={14} className="animate-spin text-teal-500" />}
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-[9px] font-black uppercase text-slate-400">Alerta si saldo &lt;</label>
                        <input type="number" value={alertThreshold} onChange={e => setAlertThreshold(Number(e.target.value))}
                            className="w-24 border border-slate-200 rounded px-2 py-1 text-[10px] font-bold" />
                    </div>
                    <button onClick={() => { setShowForm(true); setForm(EMPTY); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#106ebe] hover:bg-blue-800 text-white text-[10px] font-black uppercase rounded transition-all">
                        <Plus size={12} /> Registrar Movimiento
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPIBox label="Total Entradas" value={fmtQ(totalEntradas)} color="emerald" />
                <KPIBox label="Total Salidas" value={fmtQ(totalSalidas)} color="red" />
                <KPIBox label="Flujo Neto" value={fmtQ(flujoNeto)} color={flujoNeto >= 0 ? 'teal' : 'orange'} />
                <KPIBox label="Saldo Final" value={fmtQ(saldoFinal)} color={saldoFinal < alertThreshold ? 'red' : 'teal'} alert={saldoFinal < alertThreshold} />
            </div>

            {saldoFinal < alertThreshold && saldoFinal >= 0 && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                    <span className="text-red-600 text-[10px] font-black uppercase">⚠ Alerta: Saldo por debajo del umbral mínimo ({fmtQ(alertThreshold)})</span>
                </div>
            )}

            {/* SECCIÓN A — Movimientos Diarios */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-[#106ebe] px-4 py-3">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Sección A — Movimientos Diarios — {dayjs(month + '-01').format('MMMM YYYY')}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px]">
                        <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-black uppercase tracking-wider">
                            <tr>
                                <th className="px-3 py-2">Fecha</th>
                                <th className="px-3 py-2">Concepto</th>
                                <th className="px-3 py-2">Categoría</th>
                                <th className="px-3 py-2 text-right">Entrada</th>
                                <th className="px-3 py-2 text-right">Salida</th>
                                <th className="px-3 py-2 text-right">Saldo</th>
                                <th className="px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {rows.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-[10px] font-bold">Sin movimientos registrados</td></tr>
                            ) : rows.map(r => (
                                <tr key={r.id} className={`hover:bg-slate-50 transition-colors text-black font-black ${r.balance < alertThreshold ? 'bg-red-50/30' : ''}`}>
                                    <td className="px-3 py-2 font-mono text-black">{dayjs(r.flow_date).format('DD/MM')}</td>
                                    <td className="px-3 py-2 font-black text-black">{r.concept}</td>
                                    <td className="px-3 py-2 text-black">{r.category}</td>
                                    <td className="px-3 py-2 text-right font-black text-black">{r.entry_amount > 0 ? fmtQ(r.entry_amount) : '—'}</td>
                                    <td className="px-3 py-2 text-right font-black text-black">{r.exit_amount > 0 ? fmtQ(r.exit_amount) : '—'}</td>
                                    <td className={`px-3 py-2 text-right font-black text-black`}>{fmtQ(r.balance)}</td>
                                    <td className="px-3 py-2"><button onClick={() => del(r.id!)} className="p-1 hover:text-red-500 text-slate-300"><Trash2 size={11} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECCIÓN B — Resumen Semanal */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-[#106ebe] px-4 py-3">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Sección B — Resumen Semanal</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px]">
                        <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-black uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-2">Semana</th>
                                <th className="px-4 py-2">Días</th>
                                <th className="px-4 py-2 text-right">Entradas</th>
                                <th className="px-4 py-2 text-right">Salidas</th>
                                <th className="px-4 py-2 text-right">Flujo Neto</th>
                                <th className="px-4 py-2 text-right">Saldo Acum.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {weeks.map(w => {
                                weekAccum += w.neto;
                                return (
                                    <tr key={w.week} className="hover:bg-slate-50 text-black font-black">
                                        <td className="px-4 py-2.5 font-black">Semana {w.week}</td>
                                        <td className="px-4 py-2.5">{(w.week - 1) * 7 + 1} – {Math.min(w.week * 7, dayjs(month + '-01').daysInMonth())}</td>
                                        <td className="px-4 py-2.5 text-right font-black">{fmtQ(w.entradas)}</td>
                                        <td className="px-4 py-2.5 text-right font-black">{fmtQ(w.salidas)}</td>
                                        <td className={`px-4 py-2.5 text-right font-black text-black`}>{fmtQ(w.neto)}</td>
                                        <td className={`px-4 py-2.5 text-right font-black text-black`}>{fmtQ(weekAccum)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-teal-50 border-t-2 border-teal-200 text-black font-black">
                            <tr>
                                <td colSpan={2} className="px-4 py-2 text-[10px] font-black uppercase">Total Mes</td>
                                <td className="px-4 py-2 text-right font-black">{fmtQ(totalEntradas)}</td>
                                <td className="px-4 py-2 text-right font-black">{fmtQ(totalSalidas)}</td>
                                <td className="px-4 py-2 text-right font-black">{fmtQ(flujoNeto)}</td>
                                <td className="px-4 py-2 text-right font-black">{fmtQ(saldoFinal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* SECCIÓN C — Proyección 30/60 días */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Sección C — Proyección de Flujo (basada en promedios del mes)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-teal-50 border border-teal-200">
                        <p className="text-[9px] font-black uppercase text-teal-600 mb-1">Saldo Actual</p>
                        <p className="text-xl font-black text-teal-900">{fmtQ(saldoFinal)}</p>
                    </div>
                    <div className={`p-4 rounded-lg border ${proj30 < alertThreshold ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                        <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Proyección 30 días</p>
                        <p className={`text-xl font-black ${proj30 < alertThreshold ? 'text-red-700' : 'text-slate-800'}`}>{fmtQ(proj30)}</p>
                        <p className="text-[8px] text-slate-400 mt-1">{proj30 < alertThreshold ? '⚠ Por debajo del umbral' : '✓ Por encima del umbral'}</p>
                    </div>
                    <div className={`p-4 rounded-lg border ${proj60 < alertThreshold ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                        <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Proyección 60 días</p>
                        <p className={`text-xl font-black ${proj60 < alertThreshold ? 'text-red-700' : 'text-slate-800'}`}>{fmtQ(proj60)}</p>
                        <p className="text-[8px] text-slate-400 mt-1">{proj60 < alertThreshold ? '⚠ Por debajo del umbral' : '✓ Por encima del umbral'}</p>
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-[9px] font-black text-slate-500 uppercase">Ingreso promedio diario</span>
                        <span className="text-[11px] font-black text-emerald-700">{fmtQ(dailyAvgIncome)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-[9px] font-black text-slate-500 uppercase">Gasto promedio diario</span>
                        <span className="text-[11px] font-black text-red-600">{fmtQ(dailyAvgExpense)}</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN D — PANEL DE CONCILIACIÓN BANCARIA AVANZADA — BANCO INDUSTRIAL */}
            <div className="bg-white rounded-xl border-2 border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-[#106EBE] px-5 py-6 border-b border-white/10 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
                            <Building2 size={28} />
                        </div>
                        <div>
                            <h2 className="text-white font-black uppercase tracking-tighter text-base leading-none">Conciliación Bancaria</h2>
                            <div className="flex items-center gap-4 mt-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-white/60 text-[10px] font-bold uppercase">Periodo:</span>
                                    <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-white/10 border border-white/20 text-white rounded px-2 py-0.5 text-[10px] font-black outline-none" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-white/60 text-[10px] font-bold uppercase">Banco:</span>
                                    <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="bg-white/10 border border-white/20 text-white rounded px-2 py-0.5 text-[10px] font-black outline-none [&>option]:text-black">
                                        <option value="BI">Banco Industrial</option>
                                        <option value="BAC">BAC Credomatic</option>
                                        <option value="BANRURAL">Banrural</option>
                                        <option value="INTERNACIONAL">Banco Internacional</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative group mt-1">
                            <input type="file" onChange={handleFileUpload} className="hidden" id="bank-upload" accept=".pdf,.xls,.xlsx,.csv" />
                            <label htmlFor="bank-upload" className="flex items-center gap-2 px-6 py-2.5 bg-white text-[#106EBE] text-[11px] font-black uppercase rounded-lg cursor-pointer transition-all shadow-xl hover:bg-slate-50 active:scale-95">
                                <FileUp size={16} /> 📁 Subir Estado de Cuenta (+ PDF/XLS)
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    {/* RESUMEN DE CONCILIACIÓN — BI STYLE */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 mb-8">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            <div className="lg:col-span-1 space-y-4 pr-8 border-r border-slate-200">
                                <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-2">Resumen de Conciliación</h3>
                                <div className="space-y-4">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-500 uppercase">Saldo según Banco</span>
                                        <span className="text-xl font-black text-slate-900">
                                            {bankMovements.length > 0
                                                ? fmtQ(bankMovements.reduce((a, m) => a + m.credito - m.debito, 0))
                                                : 'Q 0.00'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-500 uppercase">Saldo según Sistema</span>
                                        <span className="text-xl font-black text-[#106ebe]">{fmtQ(saldoFinal)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-500 uppercase">Total Créditos Banco</span>
                                        <span className="text-xl font-black text-emerald-600">
                                            {fmtQ(bankMovements.reduce((a, m) => a + m.credito, 0))}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-500 uppercase">Total Débitos Banco</span>
                                        <span className="text-xl font-black text-red-600">
                                            {fmtQ(bankMovements.reduce((a, m) => a + m.debito, 0))}
                                        </span>
                                    </div>
                                    <div className="flex flex-col border-t border-slate-200 pt-3">
                                        <span className="text-[9px] font-black text-slate-500 uppercase">Diferencia Sist vs Banco</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-lg font-black ${Math.abs(diff) < 1 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtQ(diff)}</span>
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${Math.abs(diff) < 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {Math.abs(diff) < 1 ? '✓ Cuadrado' : '⚠ Descuadre'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="lg:col-span-3 flex flex-col justify-center gap-3">
                                <StatusBadge label="Conciliados" count={bankMovements.filter(m=>m.estado==='conciliado').length} amount={bankMovements.filter(m=>m.estado==='conciliado').reduce((a,m)=>a+(m.credito-m.debito),0)} color="emerald" icon={<CheckCircle2 size={16}/>} />
                                <StatusBadge label="Pendientes" count={bankMovements.filter(m=>m.estado==='pendiente').length} amount={bankMovements.filter(m=>m.estado==='pendiente').reduce((a,m)=>a+(m.credito-m.debito),0)} color="red" icon={<AlertCircle size={16}/>} />
                                <StatusBadge label="Sin Conciliar" count={items.filter(i=>!bankMovements.find(m=>m.cash_flow_id===i.id)).length} amount={items.filter(i=>!bankMovements.find(m=>m.cash_flow_id===i.id)).reduce((a,i)=>(i.flow_type==='entry'?a+i.entry_amount:a-i.exit_amount),0)} color="amber" icon={<Info size={16}/>} />
                            </div>
                        </div>
                    </div>

                    {/* BARRA DE FILTROS Y ACCIONES */}
                    <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
                            <FilterBtn active={filter==='all'} onClick={()=>setFilter('all')} label="Todos" />
                            <FilterBtn active={filter==='conciliados'} onClick={()=>setFilter('conciliados')} label="Conciliados" />
                            <FilterBtn active={filter==='pendientes'} onClick={()=>setFilter('pendientes')} label="Pendientes" />
                            <FilterBtn active={filter==='sin_banco'} onClick={()=>setFilter('sin_banco')} label="No en Banco" />
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={autoMatch}
                                disabled={isMatching || bankMovements.length === 0}
                                className="flex items-center gap-2 px-5 py-2 bg-[#106ebe] hover:bg-blue-800 text-white text-[10px] font-black uppercase rounded shadow-lg transition-all disabled:opacity-50"
                            >
                                {isMatching ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} Cruce Automático
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded shadow-lg transition-all">
                                <CheckCircle2 size={14}/> Aprobar Conciliados
                            </button>
                            <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-2 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-black uppercase rounded transition-all">
                                Exportar PDF Conciliación
                            </button>
                        </div>
                    </div>

                    {/* TABLA DE MOVIMIENTOS BANCARIOS */}
                    <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-inner">
                        <table className="w-full text-left">
                            <thead className="bg-[#f8fafc] border-b border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                <tr>
                                    <th className="px-5 py-3">Fecha</th>
                                    <th className="px-5 py-3">Descripción Banco</th>
                                    <th className="px-5 py-3 text-right">Monto</th>
                                    <th className="px-5 py-3">Sistema POS</th>
                                    <th className="px-5 py-3 text-center">Estado</th>
                                    <th className="px-5 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bankLoading ? (
                                    <tr><td colSpan={7} className="px-10 py-20 text-center"><Loader2 size={30} className="animate-spin text-teal-600 mx-auto mb-4" /><p className="text-[10px] font-black uppercase text-slate-400">Analizando Estado de Cuenta...</p></td></tr>
                                ) : bankMovements.length === 0 ? (
                                    <tr><td colSpan={7} className="px-10 py-20 text-center"><CloudUpload size={40} className="text-slate-200 mx-auto mb-4" /><p className="text-[10px] font-black uppercase text-slate-400">Sube un PDF para comenzar la conciliación</p></td></tr>
                                ) : (filter === 'sin_banco' ? (
                                    items.filter(i => !bankMovements.find(m => m.cash_flow_id === i.id)).map(i => (
                                        <tr key={i.id} className="bg-amber-50/20 hover:bg-amber-50/40 transition-all italic">
                                            <td className="px-5 py-3 font-mono text-[10px] text-slate-500 font-bold">{dayjs(i.flow_date).format('DD/MM/YYYY')}</td>
                                            <td className="px-5 py-3 text-[10px] font-bold text-amber-700 uppercase">En Sistema — {i.concept}</td>
                                            <td className={`px-5 py-3 text-right font-black text-[11px] ${i.flow_type === 'entry' ? 'text-emerald-700' : 'text-red-600'}`}>
                                                {i.flow_type === 'entry' ? `+${fmtQ(i.entry_amount)}` : `-${fmtQ(i.exit_amount)}`}
                                            </td>
                                            <td className="px-5 py-3 text-[10px] font-bold text-slate-300">—</td>
                                            <td className="px-5 py-3 text-[10px] font-bold text-slate-700 underline decoration-amber-300">No en Banco ℹ</td>
                                            <td className="px-5 py-3 text-center">
                                                <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200">
                                                    NO EN BANCO
                                                </span>
                                            </td>
                                            <td className="px-5 py-3"></td>
                                        </tr>
                                    ))
                                ) : (
                                    bankMovements
                                        .filter(m => {
                                            if (filter === 'conciliados') return m.estado === 'conciliado';
                                            if (filter === 'pendientes') return m.estado === 'pendiente';
                                            return true;
                                        })
                                        .map(m => {
                                            const bgClass = m.color_cat === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
                                                           m.color_cat === 'blue' ? 'bg-blue-50 text-blue-700' :
                                                           m.color_cat === 'purple' ? 'bg-purple-50 text-purple-700' :
                                                           m.color_cat === 'orange' ? 'bg-orange-50 text-orange-700' :
                                                           m.color_cat === 'red' ? 'bg-red-50 text-red-700' :
                                                           m.color_cat === 'slate' ? 'bg-slate-50 text-slate-700' : 'bg-white';
                                            return (
                                                <tr key={m.id || m.secuencia} className={`hover:bg-teal-50/30 transition-all ${bgClass}`}>
                                                    <td className="px-5 py-4 font-mono text-[10px] font-black text-slate-500">{dayjs(m.fecha).format('DD/MM/YYYY')}</td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex flex-col">
                                                            <p className="text-[10px] font-black uppercase leading-none text-slate-900 flex items-center gap-2">
                                                                {m.descripcion}
                                                                {m.categoria === 'NEONET' && <span className="px-1.5 py-0.5 rounded text-[8px] bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 shadow-sm">LQ Neonet</span>}
                                                            </p>
                                                            {m.adenda && <span className="text-[8px] font-black text-slate-400 mt-1 max-w-xs truncate">{m.adenda}</span>}
                                                            {m.categoria === 'NEONET' && (
                                                                <span className="text-[8px] font-bold text-emerald-600 mt-1">Ventas brutas est: {fmtQ(m.credito / (1 - 0.05))}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-right font-black text-[11px]">
                                                        {m.credito > 0
                                                            ? <span className="text-emerald-700">+{fmtQ(m.credito)}</span>
                                                            : <span className="text-red-600">-{fmtQ(m.debito)}</span>}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {m.cash_flow_id ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm"><Check size={12} strokeWidth={4}/></div>
                                                                <span className="text-[10px] font-bold text-slate-700">Sistema Conectado</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-300 italic">No vinculado</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                                            m.estado === 'conciliado' ? 'bg-emerald-500 text-white shadow-sm' :
                                                            m.estado === 'pendiente' ? 'bg-amber-400 text-white shadow-sm' :
                                                            'bg-slate-200 text-slate-500'
                                                        }`}>
                                                            {m.estado}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <button 
                                                            onClick={() => { setSelectedMovement(m); setShowAssignModal(true); }}
                                                            className="px-3 py-1 bg-white border border-slate-200 hover:border-[#106EBE] hover:text-[#106EBE] rounded text-[9px] font-black uppercase transition-all shadow-sm"
                                                        >
                                                            {m.estado === 'conciliado' ? 'Ver' : 'Asignar'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 flex justify-end gap-3 border-t border-slate-200">
                    <button
                        onClick={aprobarConciliados}
                        disabled={savingConcil}
                        className="flex items-center gap-1.5 px-8 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-black uppercase rounded transition-all shadow-lg disabled:opacity-50">
                        <CheckCircle2 size={13}/> Aprobar Conciliados
                    </button>
                    <button
                        onClick={saveConciliacion}
                        disabled={savingConcil}
                        className="flex items-center gap-1.5 px-8 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase rounded hover:bg-black transition-all shadow-lg active:translate-y-0.5 disabled:opacity-50">
                        {savingConcil ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>} Guardar Conciliación
                    </button>
                </div>
            </div>

            {/* PANEL DE REVISIÓN MANUAL — ASIGNACIÓN (MODAL) */}
            {showAssignModal && selectedMovement && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] bg-black/20 flex items-center justify-center p-4">
                    <DraggableWindow id="bi-assign-mov" title="Asignar Movimiento Bancario" onClose={() => setShowAssignModal(false)}>
                        <div className="w-[600px] bg-[#f0f0f0] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[#106EBE] flex flex-col animate-in slide-in-from-bottom-2">
                            {/* Header Clásico */}
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none shrink-0">
                                <div className="flex items-center gap-2">
                                    <Link2 size={14} className="text-white" />
                                    <span className="text-white text-[12px] font-bold tracking-wide">Asignar Movimiento: {selectedMovement.id?.substring(0,8)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button className="w-6 h-6 flex items-center justify-center text-white/80 hover:bg-white/10 rounded transition-all"><Minus size={14}/></button>
                                    <button onClick={() => setShowAssignModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white transition-all ml-1">
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 flex flex-col gap-4">
                                <div className="bg-white border border-gray-300 p-4 shadow-sm flex items-center justify-between">
                                    <div className="max-w-[70%]">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Concepto Bancario</span>
                                        <p className="text-[12px] font-black text-slate-900 uppercase break-words leading-tight">{selectedMovement.descripcion}</p>
                                        <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase tracking-tighter">Fecha: {dayjs(selectedMovement.fecha).format('DD/MM/YYYY')} · Adenda: {selectedMovement.adenda || 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Monto Liquido</span>
                                        <p className={`text-xl font-black tabular-nums ${selectedMovement.tipo === 'credito' ? 'text-emerald-700' : 'text-red-600'}`}>
                                            {selectedMovement.tipo === 'credito' ? `+${fmtQ(selectedMovement.credito)}` : `-${fmtQ(selectedMovement.debito)}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="border-2 border-gray-300 p-4 relative pt-6 bg-white/50">
                                    <span className="absolute -top-3 left-3 bg-[#f0f0f0] px-2 text-[10px] font-black text-slate-600 uppercase border border-gray-300 shadow-sm">Clasificación de Destino</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        <AssignOption onClick={() => setAssignType('COMPRA MATERIA PRIMA')} icon={<CreditCard size={14}/>} label="Compra Materia Prima" active={assignType === 'COMPRA MATERIA Prima' || assignType === 'COMPRA MATERIA PRIMA'} />
                                        <AssignOption onClick={() => setAssignType('GASTO OPERATIVO')} icon={<Briefcase size={14}/>} label="Gasto Operativo" active={assignType === 'GASTO OPERATIVO'} />
                                        <AssignOption onClick={() => setAssignType('PAGO A PROVEEDOR')} icon={<UserCircle size={14}/>} label="Pago a Proveedor" active={assignType === 'PAGO A PROVEEDOR'} />
                                        <AssignOption onClick={() => {
                                            setShowAssignModal(false);
                                            setShowForm(true);
                                            if (selectedMovement) {
                                                setForm({
                                                    ...EMPTY,
                                                    flow_date: dayjs(selectedMovement.fecha).format('YYYY-MM-DD'),
                                                    concept: selectedMovement.descripcion,
                                                    flow_type: selectedMovement.tipo === 'credito' ? 'entry' : 'exit',
                                                    entry_amount: selectedMovement.tipo === 'credito' ? selectedMovement.credito : 0,
                                                    exit_amount: selectedMovement.tipo === 'debito' ? selectedMovement.debito : 0
                                                });
                                            }
                                        }} icon={<Plus size={14}/>} label="Nuevo Registro" active={assignType === 'NUEVO REGISTRO'} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Cuenta Contable</label>
                                        <select className="h-7 bg-white border border-gray-400 text-[11px] font-black text-slate-900 px-2 outline-none focus:border-[#106EBE]">
                                            <option className="text-slate-900 font-bold">5.1.01.01 · Compras materia prima</option>
                                            <option className="text-slate-900 font-bold">5.1.02.04 · Combustibles y lubricantes</option>
                                            <option className="text-slate-900 font-bold">5.2.01.10 · Otros gastos de venta</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Referencia Doc.</label>
                                        <input type="text" className="h-7 bg-white border border-gray-400 text-[11px] font-black text-slate-900 px-2 outline-none focus:border-[#106EBE] placeholder:text-slate-300" placeholder="P Ej. NCF-001..." />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Observaciones para Contabilidad</label>
                                    <textarea className="h-20 bg-white border border-gray-400 text-[11px] font-black text-slate-900 p-2 outline-none focus:border-[#106EBE] resize-none placeholder:text-slate-300" placeholder="Escribe el motivo de la asignación aquí..."></textarea>
                                </div>
                            </div>

                            <div className="bg-[#e1e1e1] px-4 py-3 flex justify-end gap-2 border-t border-gray-300 shadow-[inset_0_1px_0_#fff]">
                                <button onClick={() => setShowAssignModal(false)} className="h-7 px-4 bg-white border border-gray-400 text-[10px] font-bold uppercase hover:bg-gray-50 flex items-center justify-center shadow-sm">Cancelar</button>
                                <WindowsSaveButton onClick={() => {}} title="Confirmar Asignación" />
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}

            {/* Form Modal (Nuevo Movimiento Manual) */}
            {showForm && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] bg-black/20 flex items-center justify-center p-4">
                    <DraggableWindow id="bi-manual-mov" title="Registrar Movimiento Manual">
                        <div className="w-[450px] bg-[#f0f0f0] shadow-[0_0_20px_rgba(0,0,0,0.3)] border border-[#106EBE] flex flex-col">
                            <div className="modal-header bg-[#106EBE] h-8 px-3 flex justify-between items-center cursor-move select-none shrink-0">
                                <div className="flex items-center gap-2">
                                    <Plus size={14} className="text-white" />
                                    <span className="text-white text-[12px] font-bold tracking-wide">Nuevo Movimiento</span>
                                </div>
                                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-500 text-white ml-1">
                                    <X size={18} strokeWidth={2.5} />
                                </button>
                            </div>

                            <div className="p-4 flex flex-col gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-800 uppercase">Fecha</label>
                                        <input type="date" value={form.flow_date} onChange={e => setForm(p => ({ ...p, flow_date: e.target.value }))} className="h-7 border border-gray-400 text-[11px] px-2 outline-none font-black text-slate-900" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-800 uppercase">Tipo</label>
                                        <select value={form.flow_type} onChange={e => setForm(p => ({ ...p, flow_type: e.target.value as any, category: e.target.value === 'entry' ? ENTRY_CATEGORIES[0] : EXIT_CATEGORIES[0] }))}
                                            className="h-7 border border-gray-400 text-[11px] px-2 outline-none font-black text-slate-900">
                                            <option value="entry">Entrada (+)</option>
                                            <option value="exit">Salida (-)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-slate-800 uppercase">Concepto / Descripción</label>
                                    <input type="text" value={form.concept} onChange={e => setForm(p => ({ ...p, concept: e.target.value }))} className="h-7 border border-gray-400 text-[11px] px-2 outline-none font-black text-slate-900" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-800 uppercase">Categoría</label>
                                        <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="h-7 border border-gray-400 text-[11px] px-2 outline-none font-black text-slate-900">
                                            {(form.flow_type === 'entry' ? ENTRY_CATEGORIES : EXIT_CATEGORIES).map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">Monto en Quetzales</label>
                                        <input type="number" value={form.flow_type === 'entry' ? form.entry_amount : form.exit_amount}
                                            onChange={e => setForm(p => form.flow_type === 'entry' ? ({ ...p, entry_amount: Number(e.target.value) }) : ({ ...p, exit_amount: Number(e.target.value) }))}
                                            className="h-7 border border-gray-400 text-[11px] px-2 outline-none font-black text-emerald-700" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#e1e1e1] px-4 py-3 flex justify-end gap-2 border-t border-gray-300">
                                <button onClick={() => setShowForm(false)} className="h-7 px-4 bg-white border border-gray-400 text-[10px] font-black uppercase text-slate-600">Cerrar</button>
                                <WindowsSaveButton onClick={save} title="Guardar Registro" />
                            </div>
                        </div>
                    </DraggableWindow>
                </div>,
                document.body
            )}
        </div>
    );
};

const ReconcilRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-slate-500 uppercase tracking-tight">{label}</span>
        <span className="font-black text-slate-900">{value}</span>
    </div>
);

const StatusBadge: React.FC<{ label: string; count: number; amount: number; color: string; icon: React.ReactNode }> = ({ label, count, amount, color, icon }) => (
    <div className={`p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between shadow-sm hover:shadow-md transition-shadow relative overflow-hidden`}>
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${color === 'emerald' ? 'bg-emerald-500' : color === 'red' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
        <div className="flex items-center gap-4 pl-3">
            <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : color === 'red' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                {icon}
            </div>
            <div className="flex flex-col">
                <span className={`text-[11px] font-black uppercase tracking-widest ${color === 'emerald' ? 'text-emerald-700' : color === 'red' ? 'text-red-700' : 'text-amber-700'}`}>{label}</span>
                <span className="text-[10px] font-bold text-slate-500">{count} movimientos clasificados</span>
            </div>
        </div>
        <span className="text-lg font-black text-slate-800 tabular-nums">{fmtQ(amount)}</span>
    </div>
);

const FilterBtn: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
    <button 
        onClick={onClick}
        className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${
            active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
        }`}
    >
        {label}
    </button>
);

const AssignOption: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${active ? 'bg-blue-50 border-[#106EBE] text-[#106EBE]' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'bg-[#106EBE] text-white' : 'bg-slate-100 text-slate-400'}`}>
            {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-tighter leading-none">{label}</span>
    </button>
);

const KPIBox: React.FC<{ label: string; value: string; color: string; alert?: boolean }> = ({ label, value, color, alert }) => {
    return (
        <div className={`p-4 rounded-xl border-2 bg-white border-slate-200 text-black ${alert ? 'animate-pulse border-red-500' : ''}`}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1">{label}</p>
            <p className="text-lg font-black tabular-nums">{value}</p>
        </div>
    );
};
