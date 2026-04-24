
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabase';
import { RefreshCw, Loader2, Save, ChevronDown, ChevronUp, CheckCircle2, Circle, FileText } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { jsPDF } from 'jspdf';
dayjs.locale('es');

// ─── Formatters ─────────────────────────────────────────────────────────────
const fmtQ = (n: number) =>
    `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${Number(n || 0).toFixed(1)}%`;

// ─── Cuentas manuales que el usuario debe ingresar cada mes ─────────────────
const MANUAL_ACCOUNTS = [
    { code: '511001', name: 'Materia Prima Directa' },
    { code: '612001', name: 'Compras Bebidas' },
    { code: '521011', name: 'Fletes s/ Materia Prima' },
    { code: '712002', name: 'Combustibles y Lubricantes' },
    { code: '712003', name: 'Comunicaciones' },
    { code: '712007', name: 'Gastos de Limpieza' },
    { code: '712012', name: 'Reparación y Mantenimiento' },
    { code: '712015', name: 'Servicios Técnicos' },
    { code: '712018', name: 'Arrendamientos' },
    { code: '712019', name: 'Comisión Sobre Liquidación' },
    { code: '712023', name: 'Insumos Varios' },
    { code: '712024', name: 'Utensilios de Cocina Gasto' },
    { code: '712025', name: 'Servicio de Seguridad' },
    { code: '712028', name: 'Servicios Telefónicos' },
    { code: '712032', name: 'Material de Empaque' },
    { code: '714008', name: 'IDP (Impuesto Petróleos)' },
    { code: '715004', name: 'Gas Propano' },
    { code: '715006', name: 'Aproximaciones de IVA' },
];

// ─── Cuentas del Balance General manejadas manualmente ──────────────────────
const BALANCE_ACCOUNTS = [
    { code: 'caja',          name: 'Efectivo en caja',           section: 'activo_circulante' },
    { code: 'banco',         name: 'Depósitos en banco',          section: 'activo_circulante' },
    { code: 'inventario',    name: 'Inventario (materia prima)',   section: 'activo_circulante' },
    { code: 'cxc',           name: 'Cuentas por cobrar',          section: 'activo_circulante' },
    { code: 'equipo_cocina', name: 'Equipo de cocina',            section: 'activo_fijo' },
    { code: 'mobiliario',    name: 'Mobiliario y equipo',         section: 'activo_fijo' },
    { code: 'depreciacion',  name: 'Depreciación acumulada (-)',   section: 'activo_fijo' },
    { code: 'cxp',           name: 'Cuentas por pagar proveedores', section: 'pasivo' },
    { code: 'igss_pagar',    name: 'IGSS por pagar',              section: 'pasivo' },
    { code: 'prestaciones',  name: 'Prestaciones por pagar',      section: 'pasivo' },
    { code: 'capital',       name: 'Capital inicial',             section: 'patrimonio' },
    { code: 'util_acum',     name: 'Utilidades acumuladas',       section: 'patrimonio' },
];

// ─── Types ───────────────────────────────────────────────────────────────────
type PeriodView = 'mes' | 'trimestre' | 'año';

export const TabEstadosFinancieros: React.FC<{ accentColor: string }> = ({ accentColor }) => {
    const [month, setMonth]             = useState(dayjs().format('YYYY-MM'));
    const [periodView, setPeriodView]   = useState<PeriodView>('mes');
    const [loading, setLoading]         = useState(false);
    const [saving, setSaving]           = useState(false);
    const [showDataPanel, setShowDataPanel] = useState(false);

    // Entries: código => monto
    const [entries, setEntries]         = useState<Record<string, number>>({});
    // Balance manual: código => monto
    const [balanceData, setBalanceData] = useState<Record<string, number>>({});
    // Valores automáticos (se mantienen separados para mostrar fuente)
    const [autoValues, setAutoValues]   = useState<Record<string, number>>({});

    // ── Configuración de Firmas ──────────────────────────────────────────
    const [reportConfig, setReportConfig] = useState({
        proprietor_name: 'Cevicheria y Restaurante Las Palmas, S.A.',
        proprietor_title: 'Propietario / Representante Legal',
        accountant_name: 'Licda. Carmen Hernández',
        accountant_title: 'Contador Público y Auditor',
        accountant_reg: 'Registrada SAT No. 2597453K',
    });

    // ── Carga de datos ────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true);
        const [anio, mes] = month.split('-').map(Number);
        const startStr = dayjs(month + '-01').startOf('month').format('YYYY-MM-DD');
        const endStr   = dayjs(month + '-01').endOf('month').format('YYYY-MM-DD');

        try {
            // 0. Cargar configuración de firmas
            const { data: configData } = await supabase
                .from('accounting_config')
                .select('*')
                .eq('org_id', 'default')
                .maybeSingle();
            
            if (configData) {
                setReportConfig({
                    proprietor_name:  configData.proprietor_name,
                    proprietor_title: configData.proprietor_title,
                    accountant_name:  configData.accountant_name,
                    accountant_title: configData.accountant_title,
                    accountant_reg:   configData.accountant_reg,
                });
            }

            // 1. Ventas del POS
            const { data: sales } = await supabase
                .from('sales_invoices')
                .select('total_amount, iva_amount, status')
                .gte('invoice_date', startStr)
                .lte('invoice_date', endStr);
            const ventasPos = (sales || []).reduce((a, s) => {
                const isAnulado = s.status?.toLowerCase() === 'anulado' || s.status?.toLowerCase() === 'annulled' || s.status === 'A';
                if (isAnulado) return a;
                return a + (Number(s.total_amount) - Number(s.iva_amount));
            }, 0);

            // 2. Planilla del período (Desde empleados activos para garantizar autorelleno)
            const { data: employees } = await supabase
                .from('payroll_employees')
                .select('*')
                .eq('is_active', true)
                .eq('org_id', 'default');

            // Clasificación Esquema 6-6-3 (Alineado con reporte de Contadora febrero)
            const allEmp   = (employees || []);
            const cocinas  = allEmp.filter(e => /cocin|prepar/i.test((e.position || '').toLowerCase()));
            const meseros  = allEmp.filter(e => /meser|service|mozo|anfitr|bart/i.test((e.position || '').toLowerCase()));
            const cevichs  = allEmp.filter(e => /cevich/i.test((e.position || '').toLowerCase()));
            const others   = allEmp.filter(e => {
                const p = (e.position || '').toLowerCase();
                const isDirect  = /cocin|prepar/i.test(p);
                const isService = /meser|service|mozo|anfitr|bart/i.test(p);
                const isCevich  = /cevich/i.test(p);
                return !isDirect && !isService && !isCevich;
            });

            // MOD (6): 5 Cocineras + 1 Preparador
            const modGroup = cocinas; 
            // MOI (6): 5 Meseros + 1er Cevichero
            const moiGroup = [...meseros, ...(cevichs.slice(0, 1))];
            // Adm (3): Aux Admin + Jardinero + 2do Cevichero
            const admGroup = [...others, ...(cevichs.slice(1, 2))];

            const modVal   = Math.round(modGroup.reduce((a, e) => a + Number(e.base_salary || 0), 0) * 100) / 100;
            const moiVal   = Math.round(moiGroup.reduce((a, e) => a + Number(e.base_salary || 0), 0) * 100) / 100;
            const admVal   = Math.round(admGroup.reduce((a, e) => a + Number(e.base_salary || 0), 0) * 100) / 100;
            const nProd    = modGroup.length + moiGroup.length;
            const nAdm     = admGroup.length;

            const auto: Record<string, number> = {
                '411006': ventasPos,
                '511002': modVal,
                '521002': moiVal,
                '521004': Math.round((modVal + moiVal) * 0.1067 * 100) / 100, // IGSS Patronal (estimado)
                '521005': Math.round((modVal + moiVal) * 0.02 * 100) / 100,   // IRTRA + INTECAP (estimado)
                '521006': nProd * 250, 
                '711001': admVal,
                '711010': nAdm * 250,
                '711011': Math.round(admVal * 0.1067 * 100) / 100,
                '711013': Math.round(admVal * 0.02 * 100) / 100,
            };

            // 2B. Integración con Auditoría SAT (IDP y Gastos Clasificados)
            let equipoVal = 0, mobiliarioVal = 0;
            try {
                const { data: satData } = await supabase
                    .from('historico_auditoria_sat')
                    .select('monto_base_imponible, idp_monto, cuenta_contable, clasificacion_compra, subcategoria_contable')
                    .eq('periodo_fiscal_anio', anio)
                    .eq('periodo_fiscal_mes', mes);
                
                let totalIdp = 0;
                (satData || []).forEach((r: any) => {
                    const monto = Number(r.monto_base_imponible || 0);
                    const idp   = Number(r.idp_monto || 0);
                    const code  = (r.cuenta_contable || '').trim();
                    const sub   = (r.subcategoria_contable || '').toUpperCase();
                    const classif = (r.clasificacion_compra || '').toUpperCase();

                    totalIdp += idp;

                    // Si hay un código de cuenta contable válido en SAT, lo jalamos automáticamente
                    if (code && /^[0-9]+$/.test(code)) {
                        auto[code] = (auto[code] || 0) + monto;
                    }

                    // Procesar Activos Fijos para el Balance
                    if (classif === 'ACTIVO_FIJO') {
                        if (sub === 'EQUIPO_COCINA') equipoVal += monto;
                        if (sub === 'MOBILIARIO')    mobiliarioVal += monto;
                    }
                });

                if (totalIdp > 0) auto['714008'] = totalIdp;

            } catch (err) {
                console.error('Error al jalar datos de SAT:', err);
            }

            // Arrendamientos desde cost_items (si existe la tabla)
            try {
                const { data: costItems } = await supabase
                    .from('cost_items')
                    .select('amount')
                    .ilike('category', '%alquiler%')
                    .gte('date', startStr)
                    .lte('date', endStr);
                const arrendVal = (costItems || []).reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
                if (arrendVal > 0) auto['712018'] = arrendVal;
            } catch { /* tabla cost_items no existe aún — queda como manual */ }

            setAutoValues(auto);

            // 3. Datos guardados en accounting_entries
            const { data: saved } = await supabase
                .from('accounting_entries')
                .select('*')
                .eq('periodo_mes', mes)
                .eq('periodo_anio', anio);

            const savedMap: Record<string, number> = {};
            (saved || []).forEach(e => { savedMap[e.codigo_cuenta] = Number(e.monto); });

            // 4. Merge: guardado tiene prioridad sobre automático
            const merged: Record<string, number> = { ...auto };
            Object.keys(savedMap).forEach(k => { merged[k] = savedMap[k]; });
            setEntries(merged);

            // 5. ACTIVO CIRCULANTE — Caja y Banco desde cash_flow
            const { data: cfRows } = await supabase
                .from('cash_flow')
                .select('entry_amount, exit_amount, category')
                .gte('operation_date', startStr)
                .lte('operation_date', endStr);
            const cajaVal  = (cfRows || []).filter((r: any) => r.category === 'efectivo')
                .reduce((a: number, r: any) => a + Number(r.entry_amount || 0) - Number(r.exit_amount || 0), 0);
            const bancoVal = (cfRows || []).filter((r: any) => r.category === 'banco')
                .reduce((a: number, r: any) => a + Number(r.entry_amount || 0) - Number(r.exit_amount || 0), 0);

            // 6. PASIVO — CxP proveedores desde purchase_invoices
            const { data: pendingPurch } = await supabase
                .from('purchase_invoices')
                .select('total_amount')
                .eq('status', 'pending');
            const cxpVal = (pendingPurch || []).reduce((a: number, p: any) => a + Number(p.total_amount || 0), 0);

            // 7. PASIVO — IGSS por pagar: primero tax_declarations, luego cálculo
            let igssVal = 0;
            try {
                const { data: taxRows } = await supabase
                    .from('tax_declarations')
                    .select('amount_due')
                    .eq('tax_type', 'IGSS')
                    .eq('period_label', month);
                igssVal = (taxRows || []).reduce((a: number, t: any) => a + Number(t.amount_due || 0), 0);
            } catch { /* tabla no existe */ }
            
            // Fallback: si no hay declaraciones guardadas, calcular 17.5% (Total que se ve en Planilla)
            if (igssVal === 0 && (modVal + moiVal + admVal) > 0) {
                igssVal = Math.round((modVal + moiVal + admVal) * 0.175 * 100) / 100;
            }

            // 8. PASIVO — Prestaciones por pagar (provisión mensual acumulada)
            const totalPlanilla = modVal + moiVal + admVal;
            const prestacionesVal = Math.round(totalPlanilla * 0.2916 * 100) / 100;

            // 9. PASIVO — IVA por pagar desde módulo IVA
            let ivaVal = 0;
            try {
                const { data: ivaRows } = await supabase
                    .from('iva_declarations')
                    .select('debito_fiscal, credito_fiscal')
                    .eq('periodo_mes', mes)
                    .eq('periodo_anio', anio);
                (ivaRows || []).forEach((r: any) => {
                    ivaVal += Number(r.debito_fiscal || 0) - Number(r.credito_fiscal || 0);
                });
                if (ivaVal < 0) ivaVal = 0; // crédito > débito = crédito a favor, no deuda
            } catch { /* módulo IVA no conectado aún */ }

            // 10. PATRIMONIO — Utilidades acumuladas de periodos anteriores
            let utilAcumVal = 0;
            try {
                // Buscar todas las entradas de utilidad guardadas en periodos < actual
                const { data: prevPeriods } = await supabase
                    .from('accounting_entries')
                    .select('monto, periodo_mes, periodo_anio')
                    .eq('codigo_cuenta', 'utilidad_ejercicio')
                    .or(`periodo_anio.lt.${anio},and(periodo_anio.eq.${anio},periodo_mes.lt.${mes})`);
                utilAcumVal = (prevPeriods || []).reduce((a: number, r: any) => a + Number(r.monto || 0), 0);
            } catch { /* no hay registros históricos */ }

            // 11. Balance guardado (tiene prioridad sobre automáticos)
            const balanceSaved: Record<string, number> = {};
            (saved || []).filter((e: any) => e.seccion === 'balance').forEach((e: any) => {
                balanceSaved[e.codigo_cuenta] = Number(e.monto);
            });

            setBalanceData({
                caja:          balanceSaved['caja']          ?? (cajaVal       || 0),
                banco:         balanceSaved['banco']         ?? (bancoVal      || 0),
                inventario:    balanceSaved['inventario']    ?? (savedMap['511001'] || 0),
                cxc:           balanceSaved['cxc']           ?? 0,
                equipo_cocina: balanceSaved['equipo_cocina'] ?? (equipoVal     || 0),
                mobiliario:    balanceSaved['mobiliario']    ?? (mobiliarioVal || 0),
                depreciacion:  balanceSaved['depreciacion']  ?? 0,
                cxp:           balanceSaved['cxp']           ?? (cxpVal        || 0),
                igss_pagar:    balanceSaved['igss_pagar']    ?? (igssVal       || 0),
                prestaciones:  balanceSaved['prestaciones']  ?? (prestacionesVal || 0),
                capital:       balanceSaved['capital']       ?? 0,
                util_acum:     balanceSaved['util_acum']     ?? (utilAcumVal   || 0),
                // IVA e ISR NO se guardan en balance — son calculados automáticos
                iva_pagar:     ivaVal,
            });


        } catch (err) {
            console.error('TabEstadosFinancieros loadData error:', err);
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Guardar datos manuales ────────────────────────────────────────────
    const saveData = async () => {
        setSaving(true);
        const [anio, mes] = month.split('-').map(Number);

        // Payload Estado de Resultados
        const erPayload = Object.entries(entries).map(([code, monto]) => ({
            org_id:        'default',
            periodo_mes:   mes,
            periodo_anio:  anio,
            codigo_cuenta: code,
            nombre_cuenta: code,
            seccion:       'estado_resultados',
            monto:         monto,
            fuente:        autoValues[code] !== undefined ? 'automatico' : 'manual',
        }));

        // Payload Balance General
        const balPayload = Object.entries(balanceData).map(([code, monto]) => ({
            org_id:        'default',
            periodo_mes:   mes,
            periodo_anio:  anio,
            codigo_cuenta: code,
            nombre_cuenta: code,
            seccion:       'balance',
            monto:         monto,
            fuente:        'manual',
        }));

        try {
            await supabase.from('accounting_entries').upsert(
                [...erPayload, ...balPayload],
                { onConflict: 'org_id, periodo_mes, periodo_anio, codigo_cuenta' }
            );

            // Guardar configuración de firmas
            await supabase.from('accounting_config').upsert({
                org_id: 'default',
                ...reportConfig,
                updated_at: new Date().toISOString()
            }, { onConflict: 'org_id' });

            await loadData();
        } catch (err) {
            console.error('saveData error:', err);
        } finally {
            setSaving(false);
        }
    };

    const setEntry   = (code: string, val: number) => setEntries(p => ({ ...p, [code]: val }));
    const setBalance = (code: string, val: number) => setBalanceData(p => ({ ...p, [code]: val }));

    // ── Exportar PDF ─────────────────────────────────────────────────────
    const exportarPDF = () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        const [anio, mes] = month.split('-').map(Number);
        const primerDia   = dayjs(month + '-01').startOf('month').format('DD');
        const ultimoDia   = dayjs(month + '-01').endOf('month').format('DD');
        const mesAnio     = dayjs(month + '-01').locale('es').format('MMMM YYYY').toUpperCase();
        const hoy         = dayjs().locale('es').format('DD [de] MMMM [de] YYYY');
        const L           = 20;   // margen izquierdo
        const W           = 172;  // ancho del contenido
        const R           = L + W; // borde derecho
        let y             = 18;

        const fQ = (n: number) => {
            const abs = Math.abs(n).toLocaleString('es-GT', { minimumFractionDigits: 2 });
            return n < 0 ? `(Q ${abs})` : `Q ${abs}`;
        };

        const checkPageBreak = (neededSpace: number) => {
            if (y + neededSpace > 260) {
                doc.addPage();
                y = 20;
            }
        };

        const t = (text: string, x: number, yy: number, size = 9, bold = false, align: 'left'|'right'|'center' = 'left') => {
            doc.setFontSize(size);
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            doc.text(text, x, yy, { align });
        };

        const fila = (cod: string, nombre: string, monto: number, nivel = 0, negrita = false) => {
            checkPageBreak(6);
            const x = L + nivel * 7;
            const label = cod ? `${cod}  ${nombre}` : nombre;
            t(label, x, y, 8.5, negrita);
            t(fQ(monto), R, y, 8.5, negrita, 'right');
            y += 5.2;
        };

        const subtotalRow = (nombre: string, monto: number) => {
            checkPageBreak(8);
            doc.setLineWidth(0.15);
            doc.line(R - 45, y - 3, R, y - 3); // Línea arríba del texto
            t(nombre, L + 7, y, 8.5, true);
            t(fQ(monto), R, y, 8.5, true, 'right');
            y += 6.5;
        };

        const totalRow = (nombre: string, monto: number) => {
            checkPageBreak(8);
            doc.setLineWidth(0.4);
            doc.line(L, y - 3, R, y - 3); // Línea arriba del texto (en jsPDF el punto Y del texto es en la base de la fuente)
            t(nombre, L, y, 9, true);
            t(fQ(monto), R, y, 9, true, 'right');
            y += 7;
        };

        const seccionHeader = (titulo: string) => {
            checkPageBreak(12);
            y += 2;
            doc.setFillColor(240, 242, 245);
            doc.rect(L, y - 4, W, 6, 'F');
            t(titulo, L + 2, y, 8.5, true);
            y += 5;
        };

        const subgrupoHeader = (titulo: string) => {
            checkPageBreak(8);
            t(titulo, L + 2, y, 8, true);
            y += 5;
        };

        // ── ENCABEZADO ───────────────────────────────────────────────────
        t('ESTADO DE RESULTADOS', L + W / 2, y, 14, true, 'center');           y += 6;
        t('NIT: 9188766-6', L + W / 2, y, 9, false, 'center');                 y += 5;
        t('Cevicheria y Restaurante Las Palmas, S.A.', L + W / 2, y, 9, true, 'center'); y += 5;
        t(`PERIODO: DEL ${primerDia} AL ${ultimoDia} DE ${mesAnio}`, L + W / 2, y, 9, false, 'center'); y += 5;
        t('CIFRAS EXPRESADAS EN QUETZALES', L + W / 2, y, 7.5, false, 'center'); y += 6;
        doc.setLineWidth(0.6);
        doc.line(L, y, R, y);
        doc.setLineWidth(0.2);
        doc.line(L, y + 1.2, R, y + 1.2);
        y += 7;

        // ── Valores del periodo ───────────────────────────────────────────
        const en = (c: string) => Number(entries[c] || 0);
        const V    = en('411006');
        const MP   = en('511001'); const MOD  = en('511002'); const subCP = MP + MOD;
        const MOI  = en('521002'); const IGSS = en('521004'); const IRTRA = en('521005');
        const BONF = en('521006'); const FLT  = en('521011');
        const subGF = MOI + IGSS + IRTRA + BONF + FLT;
        const totProd = subCP + subGF;
        const BEB  = en('612001'); const costoVT = totProd + BEB;
        const SA   = en('711001'); const BA   = en('711010');
        const CA   = en('711011'); const IA   = en('711013'); const subPers = SA + BA + CA + IA;
        const CMB  = en('712002'); const COM  = en('712003'); const LMP = en('712007');
        const MNT  = en('712012'); const STC  = en('712015'); const ARR = en('712018');
        const CMI  = en('712019'); const INS  = en('712023'); const UTN = en('712024');
        const SEG  = en('712025'); const TEL  = en('712028'); const EMP = en('712032');
        const subAdm = CMB+COM+LMP+MNT+STC+ARR+CMI+INS+UTN+SEG+TEL+EMP;
        const IDP  = en('714008');
        const GAS  = en('715004'); const AIV  = en('715006'); const subOtros = GAS + AIV;
        const totGO = subPers + subAdm + IDP + subOtros;
        const cgT   = costoVT + totGO;
        const util  = V - cgT;

        // ── SECCIÓN 1 — INGRESOS ─────────────────────────────────────────
        seccionHeader('SECCIÓN 1 — INGRESOS NETOS');
        fila('411006', 'Ventas Gravadas', V, 1);
        subtotalRow('INGRESOS NETOS', V);

        // ── SECCIÓN 2 — COSTO DE PRODUCCIÓN ─────────────────────────────
        seccionHeader('SECCIÓN 2 — COSTO DE PRODUCCIÓN');
        subgrupoHeader('2A — COSTO PRIMO');
        fila('511001', 'Compras de Materia Prima Directa', MP, 2);
        fila('511002', 'Mano de Obra Directa', MOD, 2);
        subtotalRow('SUBTOTAL COSTO PRIMO', subCP);

        subgrupoHeader('2B — GASTOS DE FABRICACIÓN');
        fila('521002', 'Mano de Obra Indirecta', MOI, 2);
        fila('521004', 'Cuota Patronal IGSS cp', IGSS, 2);
        fila('521005', 'Cuota Patronal IRTRA e INTECAP cp', IRTRA, 2);
        fila('521006', 'Bonificación Incentivo cp', BONF, 2);
        fila('521011', 'Fletes sobre Materia Prima', FLT, 2);
        subtotalRow('SUBTOTAL GASTOS DE FABRICACIÓN', subGF);
        totalRow('TOTAL COSTO DE PRODUCCIÓN', totProd);

        // ── SECCIÓN 3 — COSTO DE VENTAS ─────────────────────────────────
        seccionHeader('SECCIÓN 3 — COSTO DE VENTAS');
        fila('612001', 'Compras de Mercaderías (bebidas)', BEB, 1);
        subtotalRow('SUBTOTAL COSTO DE VENTAS', BEB);
        totalRow('COSTO DE VENTAS TOTAL', costoVT);

        // ── SECCIÓN 4 — GASTOS DE OPERACIÓN ─────────────────────────────
        seccionHeader('SECCIÓN 4 — GASTOS DE OPERACIÓN');
        subgrupoHeader('4A — GASTOS DE PERSONAL');
        fila('711001', 'Sueldos de Administración', SA, 2);
        fila('711010', 'Bonificación Incentivo Administración', BA, 2);
        fila('711011', 'Cuotas Patronales Administración', CA, 2);
        fila('711013', 'Cuota Patronal IRTRA e INTECAP Admon', IA, 2);
        subtotalRow('SUBTOTAL GASTOS DE PERSONAL', subPers);

        subgrupoHeader('4B — GASTOS DE ADMINISTRACIÓN');
        fila('712002', 'Combustibles y Lubricantes', CMB, 2);
        fila('712003', 'Comunicaciones', COM, 2);
        fila('712007', 'Gastos de Limpieza', LMP, 2);
        fila('712012', 'Reparación y Mantenimiento', MNT, 2);
        fila('712015', 'Servicios Técnicos', STC, 2);
        fila('712018', 'Arrendamientos', ARR, 2);
        fila('712019', 'Comisión Sobre Liquidación', CMI, 2);
        fila('712023', 'Insumos Varios', INS, 2);
        fila('712024', 'Utensilios de Cocina Gasto', UTN, 2);
        fila('712025', 'Servicio de Seguridad', SEG, 2);
        fila('712028', 'Servicios Telefónicos', TEL, 2);
        fila('712032', 'Material de Empaque', EMP, 2);
        subtotalRow('SUBTOTAL GASTOS DE ADMINISTRACIÓN', subAdm);

        subgrupoHeader('4C — IMPUESTOS PAGADOS');
        fila('714008', 'IDP (Impuesto Derivados del Petróleo)', IDP, 2);
        subtotalRow('SUBTOTAL IMPUESTOS PAGADOS', IDP);

        subgrupoHeader('4D — OTROS GASTOS');
        fila('715004', 'Gas Propano', GAS, 2);
        fila('715006', 'Aproximaciones de IVA', AIV, 2);
        subtotalRow('SUBTOTAL OTROS GASTOS', subOtros);
        totalRow('TOTAL GASTOS DE OPERACIÓN', totGO);

        // ── LÍNEAS FINALES ──────────────────────────────────────────────
        y += 3;
        totalRow('COSTOS Y GASTOS TOTAL', cgT);

        // Doble línea separadora antes de UTILIDAD
        checkPageBreak(25);
        doc.setLineWidth(0.6);
        doc.line(L, y, R, y);
        doc.setLineWidth(0.2);
        doc.line(L, y + 1.5, R, y + 1.5);
        y += 8;

        t('UTILIDAD DEL EJERCICIO', L, y, 12, true);
        const signoUtil = util < 0 ? '-' : '';
        t(
            `${signoUtil}Q ${Math.abs(util).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
            R, y, 12, true, 'right'
        );
        y += 12;

        // ── PIE DE PÁGINA ────────────────────────────────────────────────
        checkPageBreak(30);
        const yPie = y + 10;
        doc.setLineWidth(0.3);
        doc.line(L, yPie, L + 70, yPie);
        doc.line(L + 100, yPie, R, yPie);
        
        t(reportConfig.proprietor_name, L, yPie + 5, 8, true);
        t(reportConfig.accountant_name, R, yPie + 5, 8, true, 'right');
        
        t(reportConfig.proprietor_title, L, yPie + 10, 7.5);
        t(reportConfig.accountant_title, R, yPie + 10, 7.5, false, 'right');
        
        t(reportConfig.accountant_reg, L, yPie + 18, 7.5);
        t(`Guatemala, ${hoy}`, R, yPie + 18, 7.5, false, 'right');

        const archivo = `EstadoResultados_LasPalmas_${mes.toString().padStart(2,'0')}_${anio}.pdf`;
        doc.save(archivo);
    };



    // ── Cálculos Estado de Resultados ─────────────────────────────────────
    const e = entries;
    const g = (code: string) => Number(e[code] || 0);

    const ventas        = g('411006');

    // Sección 2A — Costo Primo
    const matPrima      = g('511001');
    const mod           = g('511002');
    const subtotalCP    = matPrima + mod;

    // Sección 2B — Gastos Fabricación
    const moi           = g('521002');
    const igssCP        = g('521004');
    const irtraCP       = g('521005');
    const bonifCP       = g('521006');
    const fletes        = g('521011');
    const subtotalGF    = moi + igssCP + irtraCP + bonifCP + fletes;

    const totalCostoProd = subtotalCP + subtotalGF;

    // Sección 3 — Costo de Ventas
    const bebidas       = g('612001');
    const costoVentasTotal = totalCostoProd + bebidas;

    // Sección 4A — Gastos Personal
    const sueldosAdm    = g('711001');
    const bonifAdm      = g('711010');
    const cuotasAdm     = g('711011');
    const irtraAdm      = g('711013');
    const subtotalPersonal = sueldosAdm + bonifAdm + cuotasAdm + irtraAdm;

    // Sección 4B — Gastos Admin
    const comb          = g('712002');
    const comun         = g('712003');
    const limpieza      = g('712007');
    const mant          = g('712012');
    const servTec       = g('712015');
    const arrend        = g('712018');
    const comision      = g('712019');
    const insumos       = g('712023');
    const utensilios    = g('712024');
    const seguridad     = g('712025');
    const telefono      = g('712028');
    const empaque       = g('712032');
    const subtotalAdmin = comb + comun + limpieza + mant + servTec + arrend + comision + insumos + utensilios + seguridad + telefono + empaque;

    // Sección 4C — Impuestos
    const idp           = g('714008');

    // Sección 4D — Otros
    const gas           = g('715004');
    const aproxIva      = g('715006');
    const subtotalOtros = gas + aproxIva;

    const totalGastosOp = subtotalPersonal + subtotalAdmin + idp + subtotalOtros;
    const costosGastosTotal = costoVentasTotal + totalGastosOp;
    const utilidad      = ventas - costosGastosTotal;

    // ── Punto de Equilibrio ────────────────────────────────────────────────
    const gastosFijosPE = moi + igssCP + irtraCP + bonifCP + sueldosAdm + bonifAdm + cuotasAdm + irtraAdm + arrend + servTec + seguridad + comun + telefono;
    const gastosVarPE   = matPrima + bebidas + comb + limpieza + mant + insumos + utensilios + empaque + idp + gas;
    const pctVar        = ventas > 0 ? gastosVarPE / ventas : 0;
    const peCalc        = (ventas > 0 && pctVar < 1 && gastosFijosPE > 0)
        ? gastosFijosPE / (1 - pctVar)
        : 0;
    // NUNCA mostrar PE mayor a ventas × 10 (evita valores absurdos con datos incompletos)
    const PE            = peCalc > 0 && peCalc > ventas * 10 ? 0 : peCalc;

    // ── Balance General ───────────────────────────────────────────────────
    const b             = balanceData;
    const gb            = (code: string) => Number(b[code] || 0);

    const totalActCir   = gb('caja') + gb('banco') + gb('inventario') + gb('cxc');
    const totalActFijo  = gb('equipo_cocina') + gb('mobiliario') - gb('depreciacion');
    const totalActivos  = totalActCir + totalActFijo;

    // ISR e IVA estimados
    const isrAuto       = Math.max(0, utilidad * 0.05);
    const ivaBalance    = gb('iva_pagar');

    const totalPasCir   = gb('cxp') + gb('igss_pagar') + isrAuto + ivaBalance + gb('prestaciones');
    const totalPasivos  = totalPasCir;

    const totalPatrimonio = gb('capital') + gb('util_acum') + utilidad;
    const totalPasPatr  = totalPasivos + totalPatrimonio;
    const diffBalance   = totalActivos - totalPasPatr;

    // ── KPIs (se calculan últimos, después de tener todo disponible) ───────
    const noData        = ventas === 0;
    const foodCostPct   = (ventas === 0 || matPrima === 0)    ? null : (matPrima / ventas) * 100;
    const costoPrimoPct = (ventas === 0 || subtotalCP === 0)   ? null : (subtotalCP / ventas) * 100;
    const gastosFijosPctKPI = (ventas === 0 || gastosFijosPE === 0) ? null : (gastosFijosPE / ventas) * 100;
    const gastosFijosPct = gastosFijosPctKPI;
    const margenOpPct   = ventas === 0 ? null : (utilidad / ventas) * 100;
    const margenNetoPct = ventas === 0 ? null : ((utilidad - isrAuto - ivaBalance) / ventas) * 100;

    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className="h-full overflow-hidden flex flex-col bg-[#f0f2f5] font-sans text-[#1a202c]">

            {/* ── Toolbar ── */}
            <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Tabs de periodo */}
                    <div className="flex rounded-md overflow-hidden border border-slate-200 text-[10px] font-black uppercase">
                        {(['mes', 'trimestre', 'año'] as PeriodView[]).map(p => (
                            <button key={p}
                                onClick={() => setPeriodView(p)}
                                className={`px-4 py-2 transition-colors ${periodView === p ? 'bg-[#1e6091] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                                {p}
                            </button>
                        ))}
                    </div>

                    <input
                        type="month"
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className="border border-slate-200 rounded px-3 py-2 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-[#1e6091]/30"
                    />

                    <button onClick={loadData}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        {loading ? <Loader2 size={15} className="animate-spin text-[#1e6091]" /> : <RefreshCw size={15} />}
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowDataPanel(p => !p)}
                        className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                        {showDataPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        Ingresar Datos
                    </button>

                    <button
                        onClick={saveData}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-[#1e6091] hover:bg-[#174f7a] text-white text-[10px] font-black uppercase rounded-lg transition-colors shadow-sm">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Guardar Periodo
                    </button>
                    <button
                        onClick={exportarPDF}
                        className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-lg transition-colors shadow-sm">
                        <FileText size={13} />
                        Exportar — Formato Contadora
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* ── Panel de Ingreso de Datos Manuales (colapsable) ── */}
                {showDataPanel && (
                    <div className="bg-white border-b border-slate-200 px-8 py-6">
                        <div className="max-w-5xl mx-auto">
                            <h3 className="text-[11px] font-black uppercase text-[#1e6091] tracking-widest mb-1">
                                Datos del periodo — {dayjs(month + '-01').format('MMMM YYYY')}
                            </h3>
                            <p className="text-[10px] text-slate-400 mb-6">
                                Ingresa los montos que no vienen automáticamente del sistema
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                {MANUAL_ACCOUNTS.map(acc => {
                                    const val = g(acc.code);
                                    const hasData = val > 0;
                                    return (
                                        <div key={acc.code} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="shrink-0">
                                                {hasData
                                                    ? <CheckCircle2 size={14} className="text-emerald-500" />
                                                    : <Circle size={14} className="text-slate-300" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate">{acc.code}</p>
                                                <p className="text-[10px] font-bold text-slate-700 truncate">{acc.name}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="text-[10px] text-slate-400 font-bold">Q</span>
                                                <input
                                                    type="number"
                                                    value={val || ''}
                                                    onChange={ev => setEntry(acc.code, Number(ev.target.value))}
                                                    placeholder="0.00"
                                                    className="w-24 text-right text-[11px] font-black border border-slate-200 rounded px-2 py-1 outline-none focus:border-[#1e6091] bg-white"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ── Configuración de Firmas en el Reporte ── */}
                            <div className="mt-8 pt-8 border-t border-slate-100">
                                <h3 className="text-[11px] font-black uppercase text-[#1e6091] tracking-widest mb-1">
                                    Firmas y Metadatos del Reporte
                                </h3>
                                <p className="text-[10px] text-slate-400 mb-6">
                                    Configura los nombres y cargos que aparecen al pie del PDF
                                </p>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <p className="text-[9px] font-black text-slate-500 uppercase border-b border-slate-50 pb-1">Representante Legal</p>
                                        <FormField label="Nombre del Propietario">
                                            <input type="text" value={reportConfig.proprietor_name} onChange={e => setReportConfig(p => ({...p, proprietor_name: e.target.value}))} className="input-std" />
                                        </FormField>
                                        <FormField label="Cargo / Título">
                                            <input type="text" value={reportConfig.proprietor_title} onChange={e => setReportConfig(p => ({...p, proprietor_title: e.target.value}))} className="input-std" />
                                        </FormField>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-[9px] font-black text-slate-500 uppercase border-b border-slate-50 pb-1">Contador Autorizado</p>
                                        <FormField label="Nombre del Contador">
                                            <input type="text" value={reportConfig.accountant_name} onChange={e => setReportConfig(p => ({...p, accountant_name: e.target.value}))} className="input-std" />
                                        </FormField>
                                        <FormField label="Cargo / Título">
                                            <input type="text" value={reportConfig.accountant_title} onChange={e => setReportConfig(p => ({...p, accountant_title: e.target.value}))} className="input-std" />
                                        </FormField>
                                        <FormField label="Registro SAT / Colegiado">
                                            <input type="text" value={reportConfig.accountant_reg} onChange={e => setReportConfig(p => ({...p, accountant_reg: e.target.value}))} className="input-std" />
                                        </FormField>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={saveData}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-[#1e6091] hover:bg-[#174f7a] text-white text-[10px] font-black uppercase rounded-lg transition-colors shadow-sm">
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    Guardar datos del periodo
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-8">
                    <div className="max-w-[1280px] mx-auto space-y-8">

                        {/* ══════════════════════════════════════════════════
                            SECCIÓN A — ESTADO DE RESULTADOS
                        ══════════════════════════════════════════════════ */}
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">

                            {/* Encabezado azul */}
                            <div className="bg-[#1e6091] px-6 py-3">
                                <h2 className="text-white font-black text-[13px] uppercase tracking-wide">
                                    Estado de Resultados
                                </h2>
                                <p className="text-[#a8d0f0] text-[10px] font-bold uppercase tracking-wider mt-0.5">
                                    Restaurante Las Palmas — {dayjs(month + '-01').format('MMMM YYYY')}
                                </p>
                            </div>

                            {/* Cuerpo en dos columnas */}
                            <div className="grid grid-cols-12">

                                {/* ── Columna Izquierda: Estado de Resultados ── */}
                                <div className="col-span-8 p-8 border-r border-slate-100 space-y-8">

                                    {/* ── INGRESOS ── */}
                                    <section>
                                        <SectionHeader label="Ingresos Netos" />
                                        {ventas > 0 ? (
                                            <StatRow label="411006 Ventas Gravadas" val={ventas} indent={0} isAuto />
                                        ) : (
                                            <div className="flex justify-between items-center py-1 text-[11px]">
                                                <span className="text-slate-700 font-medium flex items-center gap-2">
                                                    411006 Ventas Gravadas
                                                    <span className="text-[7px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">sin datos POS</span>
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-slate-400 font-bold">Q</span>
                                                    <input
                                                        type="number"
                                                        value={g('411006') || ''}
                                                        onChange={ev => setEntry('411006', Number(ev.target.value))}
                                                        placeholder="0.00"
                                                        className="w-32 text-right font-bold border-b border-[#1e6091] outline-none bg-transparent text-slate-900 tabular-nums"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </section>

                                    {/* ── COSTO DE VENTAS ── */}
                                    <section>
                                        <SectionHeader label="Costo de Ventas" />

                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-4">
                                            Costo Primo
                                        </p>
                                        <StatRow label="Materia prima" val={matPrima} indent={1} />
                                        <StatRow label="Mano de obra directa (con prest.)" val={mod} indent={1} isAuto={!!autoValues['511002']} />
                                        <SubtotalRow label="Total costo primo" val={subtotalCP} />

                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-5">
                                            Gastos de Fabricación
                                        </p>
                                        <StatRow label="Mano de obra indirecta" val={moi} indent={1} isAuto={!!autoValues['521002']} />
                                        <StatRow label="Cuota Patronal IGSS cp" val={igssCP} indent={1} isAuto />
                                        <StatRow label="Cuota Patronal IRTRA e INTECAP cp" val={irtraCP} indent={1} isAuto />
                                        <StatRow label="Bonificación Incentivo cp" val={bonifCP} indent={1} isAuto />
                                        <StatRow label="Fletes sobre Materia Prima" val={fletes} indent={1} />
                                        <SubtotalRow label="Total gastos de fabricación" val={subtotalGF} />

                                        <TotalRow label="Total Costo de Producción" val={totalCostoProd} />

                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-5">
                                            Costo de Ventas (bebidas)
                                        </p>
                                        <StatRow label="Compras de Mercaderías (bebidas)" val={bebidas} indent={1} />
                                        <SubtotalRow label="Subtotal Costo de Ventas" val={bebidas} />

                                        <div className="mt-3 flex justify-between items-center border-t-2 border-slate-900 pt-3">
                                            <span className="text-[11px] font-black uppercase">Margen bruto</span>
                                            <div className="flex items-center gap-6">
                                                {!noData && <span className="text-[9px] font-bold text-slate-400 italic">{fmtPct((ventas - costoVentasTotal) / ventas * 100)}</span>}
                                                <span className="text-[13px] font-black">{fmtQ(ventas - costoVentasTotal)}</span>
                                            </div>
                                        </div>
                                    </section>

                                    {/* ── GASTOS OPERATIVOS ── */}
                                    <section>
                                        <SectionHeader label="Gastos Operativos" />

                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-4">
                                            Gastos de Personal
                                        </p>
                                        <StatRow label="Sueldos de Administración" val={sueldosAdm} indent={1} isAuto={!!autoValues['711001']} />
                                        <StatRow label="Bonificación Incentivo Administración" val={bonifAdm} indent={1} isAuto />
                                        <StatRow label="Cuotas Patronales Administración" val={cuotasAdm} indent={1} isAuto />
                                        <StatRow label="Cuota Patronal IRTRA e INTECAP Admon" val={irtraAdm} indent={1} isAuto />
                                        <SubtotalRow label="Total gastos de personal" val={subtotalPersonal} />

                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-5">
                                            Gastos de Administración
                                        </p>
                                        <StatRow label="Combustibles y Lubricantes" val={comb} indent={1} />
                                        <StatRow label="Comunicaciones" val={comun} indent={1} />
                                        <StatRow label="Gastos de Limpieza" val={limpieza} indent={1} />
                                        <StatRow label="Reparación y Mantenimiento" val={mant} indent={1} />
                                        <StatRow label="Servicios Técnicos" val={servTec} indent={1} />
                                        <StatRow label="Arrendamientos" val={arrend} indent={1} />
                                        <StatRow label="Comisión Sobre Liquidación" val={comision} indent={1} />
                                        <StatRow label="Insumos Varios" val={insumos} indent={1} />
                                        <StatRow label="Utensilios de Cocina Gasto" val={utensilios} indent={1} />
                                        <StatRow label="Servicio de Seguridad" val={seguridad} indent={1} />
                                        <StatRow label="Servicios Telefónicos" val={telefono} indent={1} />
                                        <StatRow label="Material de Empaque" val={empaque} indent={1} />
                                        <SubtotalRow label="Total gastos de administración" val={subtotalAdmin} />

                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-5">
                                            Impuestos Pagados
                                        </p>
                                        <StatRow label="IDP (Impuesto Derivados del Petróleo)" val={idp} indent={1} />
                                        <SubtotalRow label="Total impuestos" val={idp} />

                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-5">
                                            Otros Gastos
                                        </p>
                                        <StatRow label="Gas Propano" val={gas} indent={1} />
                                        <StatRow label="Aproximaciones de IVA" val={aproxIva} indent={1} />
                                        <SubtotalRow label="Total otros gastos" val={subtotalOtros} />

                                        <TotalRow label="Total Gastos de Operación" val={totalGastosOp} />
                                    </section>

                                    {/* ── LÍNEAS FINALES ── */}
                                    <section className="space-y-3 pt-4 border-t border-slate-200">
                                        <div className="flex justify-between items-center text-[11px] font-black uppercase">
                                            <span>Costos y Gastos Total</span>
                                            <span>{fmtQ(costosGastosTotal)}</span>
                                        </div>
                                        <div className="flex justify-between items-end border-t-2 border-slate-900 pt-4">
                                            <span className="text-[13px] font-black uppercase tracking-widest">Utilidad del Ejercicio</span>
                                            <div className="flex items-baseline gap-5">
                                                {!noData && (
                                                    <span className="text-[9px] font-bold text-slate-400 italic">
                                                        {fmtPct(utilidad / ventas * 100)}
                                                    </span>
                                                )}
                                                <span className={`text-[22px] font-black ${utilidad >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                                                    {fmtQ(utilidad)}
                                                </span>
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                {/* ── Columna Derecha: Indicadores ── */}
                                <div className="col-span-4 p-8 bg-[#fbfcfd]">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-8">
                                        Indicadores Clave
                                    </p>

                                    <div className="space-y-8">
                                        <KPIBar
                                            label="Food Cost %"
                                            val={foodCostPct}
                                            target={35}
                                            legendLow="Verde < 35%"
                                            legendMid="Amarillo 35-45%"
                                            legendHigh="Rojo > 45%"
                                        />
                                        <KPIBar
                                            label="Costo Primo %"
                                            val={costoPrimoPct}
                                            target={55}
                                            legendLow="Verde < 55%"
                                            legendMid="Amarillo 55-65%"
                                            legendHigh="Rojo > 65%"
                                        />
                                        <KPISimple label="Gastos Fijos %" val={gastosFijosPctKPI} />
                                        <div className="pt-2 border-t border-slate-100" />
                                        <KPISimple label="Margen Operativo %" val={margenOpPct} bold />
                                        <KPISimple label="Margen Neto %" val={margenNetoPct} bold />
                                    </div>

                                    <div className="mt-12 pt-8 border-t border-slate-100">
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-3">
                                            Punto de Equilibrio
                                        </p>
                                        {ventas === 0 ? (
                                            <p className="text-[22px] font-black">{fmtQ(0)}</p>
                                        ) : gastosFijosPE === 0 && gastosVarPE === 0 ? (
                                            <p className="text-[11px] text-slate-400 font-bold">
                                                Ingresa datos para calcular
                                            </p>
                                        ) : (
                                            <>
                                                <p className="text-[22px] font-black">{fmtQ(PE)}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                                                    Ventas necesarias para no perder
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ══════════════════════════════════════════════════
                            SECCIÓN B — BALANCE GENERAL
                        ══════════════════════════════════════════════════ */}
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">

                            {/* Encabezado azul */}
                            <div className="bg-[#1e6091] px-6 py-3 flex items-center justify-between">
                                <div>
                                    <h2 className="text-white font-black text-[13px] uppercase tracking-wide">
                                        Sección B — Balance General
                                    </h2>
                                    <p className="text-[#a8d0f0] text-[10px] font-bold mt-0.5">
                                        Ingresa valores manuales · Impuestos se calculan automáticamente
                                    </p>
                                </div>
                                {/* Badge de cuadre */}
                                {Math.abs(diffBalance) < 0.5 ? (
                                    <span className="px-3 py-1 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-full">
                                        Balance cuadrado
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-red-500 text-white text-[9px] font-black uppercase rounded-full">
                                        Dif. {fmtQ(diffBalance)}
                                    </span>
                                )}
                            </div>

                            {/* Cuerpo en 3 columnas */}
                            <div className="grid grid-cols-3 divide-x divide-slate-100 p-8 gap-8">

                                {/* Activos */}
                                <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-6">Activos</p>

                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-3">Activo Circulante</p>
                                    {['caja', 'banco', 'inventario', 'cxc'].map(code => (
                                        <BalanceInput
                                            key={code}
                                            label={BALANCE_ACCOUNTS.find(a => a.code === code)?.name || code}
                                            val={gb(code)}
                                            onChange={v => setBalance(code, v)}
                                        />
                                    ))}
                                    <BalanceLine label="Total Activo Circulante" val={totalActCir} />

                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-3 mt-6">Activo Fijo</p>
                                    {['equipo_cocina', 'mobiliario', 'depreciacion'].map(code => (
                                        <BalanceInput
                                            key={code}
                                            label={BALANCE_ACCOUNTS.find(a => a.code === code)?.name || code}
                                            val={gb(code)}
                                            onChange={v => setBalance(code, v)}
                                        />
                                    ))}
                                    <BalanceLine label="Total Activo Fijo" val={totalActFijo} />

                                    <div className="mt-4 pt-4 border-t-2 border-slate-900 flex justify-between items-center">
                                        <span className="text-[11px] font-black uppercase">Total Activos</span>
                                        <span className="text-[13px] font-black">{fmtQ(totalActivos)}</span>
                                    </div>
                                </div>

                                {/* Pasivos */}
                                <div className="px-8">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-6">Pasivos</p>

                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-3">Pasivo Circulante</p>
                                    {['cxp', 'igss_pagar', 'prestaciones'].map(code => (
                                        <BalanceInput
                                            key={code}
                                            label={BALANCE_ACCOUNTS.find(a => a.code === code)?.name || code}
                                            val={gb(code)}
                                            onChange={v => setBalance(code, v)}
                                        />
                                    ))}
                                    <BalanceAutoLine label="ISR por pagar (auto)" val={isrAuto} />
                                    <BalanceAutoLine label="IVA por pagar (auto)" val={ivaBalance} />
                                    <BalanceLine label="Total Pasivo Circulante" val={totalPasCir} />

                                    <div className="mt-4 pt-4 border-t-2 border-slate-900 flex justify-between items-center">
                                        <span className="text-[11px] font-black uppercase">Total Pasivos</span>
                                        <span className="text-[13px] font-black">{fmtQ(totalPasivos)}</span>
                                    </div>
                                </div>

                                {/* Patrimonio */}
                                <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-6">Patrimonio</p>

                                    {['capital', 'util_acum'].map(code => (
                                        <BalanceInput
                                            key={code}
                                            label={BALANCE_ACCOUNTS.find(a => a.code === code)?.name || code}
                                            val={gb(code)}
                                            onChange={v => setBalance(code, v)}
                                        />
                                    ))}
                                    <BalanceAutoLine label="Utilidad del periodo (auto)" val={utilidad} />
                                    <BalanceLine label="Total Patrimonio" val={totalPatrimonio} />

                                    <div className="mt-4 pt-4 border-t-2 border-slate-900 flex justify-between items-center">
                                        <span className="text-[11px] font-black uppercase">Total Pasivo + Patrimonio</span>
                                        <span className="text-[13px] font-black">{fmtQ(totalPasPatr)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const SectionHeader = ({ label }: { label: string }) => (
    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2">
        {label}
    </p>
);

const StatRow = ({ label, val, indent, isAuto }: { label: string; val: number; indent: number; isAuto?: boolean }) => (
    <div className={`flex justify-between items-center py-1 text-[11px] ${indent > 0 ? 'pl-4' : ''}`}>
        <span className="text-slate-700 font-medium flex items-center gap-2">
            {label}
            {isAuto && (
                <span className="text-[7px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-wide">auto</span>
            )}
        </span>
        <span className="font-bold tabular-nums">{fmtQ(val)}</span>
    </div>
);

const SubtotalRow = ({ label, val }: { label: string; val: number }) => (
    <div className="flex justify-between items-center py-2 mt-1 border-t border-slate-100 text-[11px] font-bold">
        <span>{label}</span>
        <span className="tabular-nums">{fmtQ(val)}</span>
    </div>
);

const TotalRow = ({ label, val }: { label: string; val: number }) => (
    <div className="flex justify-between items-center py-2 mt-2 border-t-2 border-slate-300 text-[12px] font-black uppercase">
        <span>{label}</span>
        <span className="tabular-nums">{fmtQ(val)}</span>
    </div>
);

const KPIBar = ({ label, val, target, legendLow, legendMid, legendHigh }: any) => {
    const noData = val === null;
    const pct    = noData ? 0 : Math.min(val, 100);
    const color  = noData ? 'bg-slate-200' : val > target + 10 ? 'bg-red-500' : val > target ? 'bg-amber-400' : 'bg-emerald-500';

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <span className="text-[9px] font-black uppercase tracking-tight text-slate-900">{label}</span>
                <span className="text-[13px] font-black">
                    {noData ? '—' : fmtPct(val)}
                </span>
            </div>
            <div className="bg-slate-100 h-1.5 w-full rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[7px] font-bold text-slate-400 italic">
                {legendLow} / {legendMid} / {legendHigh}
            </p>
        </div>
    );
};

const KPISimple = ({ label, val, bold }: { label: string; val: number | null; bold?: boolean }) => (
    <div className="flex justify-between items-center">
        <span className={`text-[9px] font-black uppercase tracking-tight ${bold ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
        <span className={`text-[13px] font-black ${bold ? 'text-slate-900' : 'text-slate-500'}`}>
            {val === null ? '—' : fmtPct(val)}
        </span>
    </div>
);

const BalanceInput = ({ label, val, onChange }: { key?: string; label: string; val: number; onChange: (v: number) => void }) => (
    <div className="flex justify-between items-center py-1.5 text-[11px]">
        <span className="text-slate-600 font-medium">{label}</span>
        <input
            type="number"
            value={val || ''}
            onChange={e => onChange(Number(e.target.value))}
            placeholder="0"
            className="w-28 text-right font-bold border-b border-slate-200 outline-none focus:border-[#1e6091] bg-transparent text-slate-900 tabular-nums"
        />
    </div>
);

const BalanceAutoLine = ({ label, val }: { label: string; val: number }) => (
    <div className="flex justify-between items-center py-1.5 text-[11px]">
        <span className="text-slate-500 font-medium flex items-center gap-1.5">
            {label}
            <span className="text-[7px] font-black text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded uppercase">auto</span>
        </span>
        <span className="font-bold tabular-nums text-slate-700">{fmtQ(val)}</span>
    </div>
);

const BalanceLine = ({ label, val }: { label: string; val: number }) => (
    <div className="flex justify-between items-center py-2 mt-1 border-t border-slate-100 text-[11px] font-bold">
        <span>{label}</span>
        <span className="tabular-nums">{fmtQ(val)}</span>
    </div>
);

const FormField: React.FC<{ label: string; colSpan?: number; children: React.ReactNode }> = ({ label, colSpan = 1, children }) => (
    <div style={{ gridColumn: `span ${colSpan}` }}>
        <label className="block text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">{label} :</label>
        {children}
    </div>
);

// Inyectar estilos para los inputs de configuración
if (typeof document !== 'undefined' && !document.getElementById('accounting-std-styles')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'accounting-std-styles';
    styleTag.innerHTML = `
      .input-std { 
        width: 100%; 
        border: 1px solid #e2e8f0; 
        border-radius: 6px; 
        padding: 6px 10px; 
        font-size: 11px; 
        font-weight: 700; 
        outline: none; 
        color: #000000; 
        background-color: #ffffff !important;
      } 
      .input-std:focus { 
        border-color: #1e6091 !important; 
        box-shadow: 0 0 0 2px rgba(30, 96, 145, 0.1);
      }
    `;
    document.head.appendChild(styleTag);
}
