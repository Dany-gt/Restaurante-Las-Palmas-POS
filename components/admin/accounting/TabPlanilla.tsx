import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabase';
import { RefreshCw, Loader2, CheckCircle2, Clock, Plus, Trash2, Save, X } from 'lucide-react';
import dayjs from 'dayjs';
import { calcularImpuestosLaborales } from '../../../utils/igssCalculator';
import { registrarAuditoria } from '../../../services/auditService';

const SALARIO_MINIMO = 3816.90; // Salario mínimo vigente para actividades no agrícolas 2026

const fmtQ = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Tasas se manejan ahora vía utils/igssCalculator.ts
const BONO_FIX = 250;

interface Employee {
    id: string;
    full_name: string;
    position: string;
    department: string;
    base_salary: number;
    is_active: boolean;
}

interface PayrollRow extends Employee {
    igssLaboral: number;
    bonificacion: number;
    otherDed: number;
    horasExtras: number;     // horas extras de la quincena
    pagoHorasExtras: number; // monto calculado
    horaExtraNote?: string;  // Nota explicativa (ej: Semana Santa)
    liquidoPagar: number;
}

export const TabPlanilla: React.FC<{ accentColor: string }> = ({ accentColor }) => {
    const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [igssStatus, setIgssStatus] = useState<'pending' | 'paid'>('pending');
    const [showAddEmp, setShowAddEmp] = useState(false);
    const [newEmp, setNewEmp] = useState({ full_name: '', position: '', department: '', base_salary: 3816.90 });
    const [saving, setSaving] = useState(false);
    const [receiptEmployee, setReceiptEmployee] = useState<PayrollRow | null>(null);
    const [quincena, setQuincena] = useState<1 | 2>(1);
    // Horas extras por empleado id (en memoria, se reinician al cambiar quincena)
    const [overtimeMap, setOvertimeMap] = useState<Record<string, number>>({});

    const setOvertime = (id: string, hours: number) =>
        setOvertimeMap(prev => ({ ...prev, [id]: hours }));

    const [overtimeNotesMap, setOvertimeNotesMap] = useState<Record<string, string>>({});
    const [payrollRecords, setPayrollRecords] = useState<any[]>([]);

    const fetchRecords = useCallback(async () => {
        const { data } = await supabase
            .from('payroll_quincena_records')
            .select('*')
            .eq('org_id', 'default')
            .eq('period_label', month);
        setPayrollRecords(data || []);
    }, [month]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('payroll_employees')
            .select('*')
            .eq('org_id', 'default')
            .eq('is_active', true)
            .order('full_name');
        setEmployees(data || []);

        await fetchRecords();

        const { data: igssDecl } = await supabase
            .from('tax_declarations')
            .select('status')
            .eq('org_id', 'default')
            .eq('tax_type', 'IGSS')
            .eq('period_label', month)
            .maybeSingle();
        setIgssStatus(igssDecl?.status === 'paid' ? 'paid' : 'pending');
        setLoading(false);
    }, [month, fetchRecords]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const savePayrollRecord = async (empId: string, hours: number, note: string) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;

        const devengadoTotal = emp.base_salary/2 + (hours * (emp.base_salary/240*1.5));
        const calc = calcularImpuestosLaborales(devengadoTotal, SALARIO_MINIMO/2); // Base quincenal

        await supabase.from('payroll_quincena_records').upsert({
            org_id: 'default',
            employee_id: empId,
            period_label: month,
            quincena: quincena,
            overtime_hours: hours,
            overtime_note: note,
            base_salary_at_time: emp.base_salary,
            igss_deduction_at_time: calc.cuotaLaboral,
            bono_incentivo_at_time: quincena === 2 ? 250 : 0
        }, { onConflict: 'employee_id,period_label,quincena' });

        fetchRecords();
    };

    // Build rows — incluye horas extras
    const rows: PayrollRow[] = employees.map(e => {
        const tarifaHora      = e.base_salary / 240;          // salario mensual / 240 horas
        const tarifaHE        = tarifaHora * 1.5;             // 1.5x según Código Trabajo GT
        const record = payrollRecords.find(r => r.employee_id === e.id && r.quincena === quincena);
        const horasExtras     = record?.overtime_hours || 0;
        const pagoHorasExtras = horasExtras * tarifaHE;
        const horaExtraNote   = record?.overtime_note || '';

        // IGSS aplica sobre salario base + horas extras
        const devengadoRow = (e.base_salary/2 + pagoHorasExtras);
        const calc = calcularImpuestosLaborales(devengadoRow, SALARIO_MINIMO/2); 
        const igssLaboral = calc.cuotaLaboral;

        return {
            ...e,
            igssLaboral,
            bonificacion: quincena === 2 ? 250 : 0,
            otherDed: 0,
            horasExtras,
            pagoHorasExtras,
            horaExtraNote,
            liquidoPagar: (e.base_salary/2) + pagoHorasExtras - igssLaboral + (quincena === 2 ? 250 : 0),
        };
    });

    const totals = rows.reduce((a, r) => ({
        salarios: a.salarios + r.base_salary,
        igssLab:  a.igssLab  + r.igssLaboral,
        bonos:    a.bonos    + r.bonificacion,
        horasExt: a.horasExt + r.pagoHorasExtras,
        liquido:  a.liquido  + r.liquidoPagar,
    }), { salarios: 0, igssLab: 0, bonos: 0, horasExt: 0, liquido: 0 });

    // ── CÁLCULO MENSUAL CONSOLIDADO (PARA RESUMEN IGSS) ───────────────────────
    // Buscamos consolidar lo devengado por cada empleado en TODO el mes (Ambas quincenas)
    const monthlyConsolidated = employees.map(e => {
        const tarifaHora = e.base_salary / 240;
        const tarifaHE   = tarifaHora * 1.5;
        
        // Sumamos horas extras de ambos registros (Q1 y Q2) si existen
        const recordsMes = payrollRecords.filter(r => r.employee_id === e.id);
        const totalHE_Month = recordsMes.reduce((a, r) => a + (Number(r.overtime_hours) || 0), 0);
        const totalPagoHE_Month = totalHE_Month * tarifaHE;
        
        // El devengado mensual total es Sueldo Base + Horas Extras del mes
        const devengadoMensual = e.base_salary + totalPagoHE_Month;
        
        // Usamos la utilidad oficial para el cálculo patronal sobre el total devengado
        const calc = calcularImpuestosLaborales(devengadoMensual, SALARIO_MINIMO);
        
        // También sumamos las retenciones laborales reales guardadas en DB para exactitud
        const retencionesRealesMes = recordsMes.reduce((a, r) => a + (Number(r.igss_deduction_at_time) || 0), 0);
        
        return {
            calc,
            retencionesRealesMes
        };
    });

    const igssPatronal = monthlyConsolidated.reduce((a, m) => a + m.calc.cuotaPatronalIGSS, 0);
    const intecap      = monthlyConsolidated.reduce((a, m) => a + m.calc.cuotaPatronalINTECAP, 0);
    const irtra        = monthlyConsolidated.reduce((a, m) => a + m.calc.cuotaPatronalIRTRA, 0);
    const totalRetLabMes = monthlyConsolidated.reduce((a, m) => a + m.calc.cuotaLaboral, 0);
    
    // El total a pagar al IGSS incluye patronal del mes + laboral del mes
    const totalIGSS = igssPatronal + intecap + irtra + totalRetLabMes;

    // Provisiones
    const aguinaldo   = totals.salarios / 12;
    const bono14      = totals.salarios / 12;
    const vacaciones  = totals.salarios / 24;
    const indemniz    = totals.salarios / 12;
    const totalProv   = aguinaldo + bono14 + vacaciones + indemniz;
    const currentMonthNum = dayjs(month + '-01').month() + 1;
    const acumProv    = totalProv * currentMonthNum;

    const markIGSSPaid = async () => {
        setSaving(true);
        await supabase.from('tax_declarations').upsert({
            org_id: 'default',
            tax_type: 'IGSS',
            period_label: month,
            period_start: dayjs(month + '-01').startOf('month').format('YYYY-MM-DD'),
            period_end:   dayjs(month + '-01').endOf('month').format('YYYY-MM-DD'),
            amount_due:   totalIGSS,
            amount_paid:  totalIGSS,
            due_date:     dayjs(month + '-01').date(20).format('YYYY-MM-DD'),
            payment_date: dayjs().format('YYYY-MM-DD'),
            status: 'paid',
        }, { onConflict: 'org_id,tax_type,period_label' });
        setIgssStatus('paid');
        setSaving(false);
    };

    const addEmployee = async () => {
        setSaving(true);
        const { data, error } = await supabase.from('payroll_employees').insert({ ...newEmp, org_id: 'default', is_active: true }).select().single();
        
        if (!error && data) {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
            if (currentUser) {
                await registrarAuditoria({
                    modulo: 'PLANILLA',
                    accion: 'EMPLEADO_INGRESADO',
                    accion_descripcion: `Ingreso de nuevo colaborador: ${newEmp.full_name}`,
                    entidad_id: data.id,
                    entidad_tipo: 'empleado',
                    entidad_nombre: newEmp.full_name,
                    valores_nuevos: {
                        nombre: newEmp.full_name,
                        cargo: newEmp.position,
                        departamento: newEmp.department,
                        salario: newEmp.base_salary,
                        fecha_inicio: dayjs().format('YYYY-MM-DD')
                    },
                    impacto_financiero: {
                        monto_total: newEmp.base_salary,
                        impacto_mensual_estimado: `Aumento en nómina mensual de base: Q${newEmp.base_salary}`
                    }
                }, currentUser);
            }
        }
        
        setShowAddEmp(false);
        setNewEmp({ full_name: '', position: '', department: '', base_salary: 3816.90 });
        fetchData();
        setSaving(false);
    };

    const deactivateEmployee = async (id: string, nombre: string) => {
        await supabase.from('payroll_employees').update({ is_active: false }).eq('id', id);
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (currentUser) {
            await registrarAuditoria({
                modulo: 'PLANILLA',
                accion: 'EMPLEADO_DADO_BAJA',
                accion_descripcion: `Baja de empleado: ${nombre}`,
                entidad_id: id,
                entidad_tipo: 'empleado',
                entidad_nombre: nombre,
                valores_nuevos: {
                    motivo_baja: 'Inactivación manual desde el panel admin',
                    fecha_baja: dayjs().format('YYYY-MM-DD')
                }
            }, currentUser);
        }
        
        fetchData();
    };

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar text-gray-900">
            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <label className="text-[9px] font-semibold uppercase text-slate-500 tracking-widest self-center">Periodo:</label>
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                        className="bg-white border border-slate-200 rounded px-3 py-1.5 text-[11px] font-medium outline-none focus:border-indigo-500 shadow-sm" />
                    
                    <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>

                    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                        {([1, 2] as const).map(q => (
                            <button key={q} onClick={() => setQuincena(q)}
                                className={`px-3 py-1 text-[9px] font-semibold uppercase rounded-md transition-all ${quincena === q ? 'bg-[#106ebe] text-white shadow-sm' : 'text-black hover:bg-white'}`}>
                                {q === 1 ? '1ª Quincena' : '2ª Quincena'}
                            </button>
                        ))}
                    </div>
                    
                    <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
                </div>
                <button onClick={() => setShowAddEmp(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#106ebe] hover:bg-blue-800 text-white text-[10px] font-semibold uppercase rounded transition-all">
                    <Plus size={12} /> Agregar Empleado
                </button>
            </div>

            {/* SECCIÓN A — Planilla */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-[#106ebe] px-4 py-3">
                    <span className="text-[10px] font-semibold text-white uppercase tracking-widest">Sección A — Planilla Mensual ({rows.length} empleados)</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px]">
                        <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-semibold text-black uppercase tracking-wider">
                            <tr>
                                <th className="px-3 py-2">#</th>
                                <th className="px-3 py-2">Empleado</th>
                                <th className="px-3 py-2">Cargo</th>
                                <th className="px-3 py-2">Depto.</th>
                                <th className="px-3 py-2 text-right">Salario Base</th>
                                <th className="px-3 py-2 text-right">IGSS Lab. (4.83%)</th>
                                <th className="px-3 py-2 text-right">Bonificación</th>
                                <th className="px-3 py-2 text-right">Horas Extras</th>
                                <th className="px-3 py-2 text-right text-black">Líquido a Pagar</th>
                                <th className="px-3 py-2">Recibo</th>
                                <th className="px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {rows.map((r, i) => (
                                <tr key={r.id} className="hover:bg-slate-50 transition-colors text-black">
                                    <td className="px-3 py-2 font-medium">{i + 1}</td>
                                    <td className="px-3 py-2 font-semibold text-black max-w-[160px] truncate">{r.full_name}</td>
                                    <td className="px-3 py-2">{r.position}</td>
                                    <td className="px-3 py-2">{r.department}</td>
                                    <td className="px-3 py-2 text-right">
                                        <SalaryCell
                                            employeeId={r.id}
                                            value={r.base_salary}
                                            onSaved={fetchData}
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-red-600">-{fmtQ(r.igssLaboral)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-emerald-600">+{fmtQ(r.bonificacion)}</td>
                                    <td className="px-3 py-2 text-right">
                                        <OvertimeCell
                                            hours={r.horasExtras}
                                            pay={r.pagoHorasExtras}
                                            note={r.horaExtraNote || ''}
                                            onCommit={(h, n) => savePayrollRecord(r.id, h, n)}
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold text-black">{fmtQ(r.liquidoPagar)}</td>
                                    <td className="px-3 py-2">
                                        <button
                                            onClick={() => { setReceiptEmployee(r); setQuincena(1); }}
                                            className="flex items-center gap-1 px-2 py-1 bg-[#106ebe] hover:bg-black text-white text-[8px] font-semibold uppercase rounded transition-all whitespace-nowrap">
                                            🖨 Recibo
                                        </button>
                                    </td>
                                    <td className="px-3 py-2">
                                        <button onClick={() => deactivateEmployee(r.id, r.full_name)} className="p-1 hover:text-red-500 text-slate-300 transition-colors"><Trash2 size={11} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-emerald-50 border-t-2 border-emerald-200 text-black">
                            <tr>
                                <td colSpan={4} className="px-3 py-3 text-[10px] font-semibold uppercase">TOTALES</td>
                                <td className="px-3 py-3 text-right font-semibold text-[11px]">{fmtQ(totals.salarios)}</td>
                                <td className="px-3 py-3 text-right font-semibold text-[11px] text-red-700">-{fmtQ(totals.igssLab)}</td>
                                <td className="px-3 py-3 text-right font-semibold text-[11px] text-emerald-700">+{fmtQ(totals.bonos)}</td>
                                <td className="px-3 py-3 text-right font-semibold text-[11px] text-orange-700">+{fmtQ(totals.horasExt)}</td>
                                <td className="px-3 py-3 text-right font-semibold text-[13px]">{fmtQ(totals.liquido)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SECCIÓN B — Cuotas Patronales IGSS */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-[#106ebe] px-4 py-3 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-white uppercase tracking-widest">Resumen de Planilla (Formulario DR-001-2)</span>
                    {igssStatus === 'paid' && <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-300 uppercase"><CheckCircle2 size={10} />Planilla Aceptada</span>}
                </div>
                    <div className="p-4 space-y-4">
                        <div className="space-y-1.5">
                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1 border-b border-slate-100 pb-1">1. Montos que debe pagar el patrono</p>
                            <PatRow label="IGSS (Cuota Patronal 10.67%)" value={igssPatronal} />
                            <PatRow label="INTECAP (1.00%)" value={intecap} />
                            <PatRow label="IRTRA (1.00%)" value={irtra} />
                        </div>

                        <div className="space-y-1.5">
                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1 border-b border-slate-100 pb-1">2. Montos que debe pagar el afiliado</p>
                            <PatRow label="IGSS (Cuota Afiliado 4.83%)" value={totalRetLabMes} />
                        </div>
                        
                        <div className="border-t-2 border-[#106ebe] mt-2 pt-3 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-semibold text-black uppercase tracking-tighter">Monto total a pagar</p>
                                <p className="text-xl font-semibold text-black">{fmtQ(totalIGSS)}</p>
                                <p className="text-[9px] font-medium text-[#106ebe] uppercase tracking-widest mt-0.5">(Patrono + Afiliados)</p>
                                <p className="text-[8px] font-medium text-slate-400 mt-1 uppercase">Límite: día 20 del mes</p>
                            </div>
                            {igssStatus === 'pending' && (
                                <button onClick={markIGSSPaid} disabled={saving}
                                    className="flex items-center gap-1 px-3 py-2 bg-[#106ebe] hover:bg-blue-800 text-white text-[9px] font-semibold uppercase rounded transition-all">
                                    {saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                    Marcar Pagado
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* SECCIÓN C — Provisiones */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-[#106ebe] px-4 py-3">
                        <span className="text-[10px] font-semibold text-white uppercase tracking-widest">Sección C — Provisiones Mensuales</span>
                    </div>
                    <div className="p-4 space-y-2">
                        {[
                            { label: 'Aguinaldo (Salario ÷ 12)', value: aguinaldo },
                            { label: 'Bono 14 (Salario ÷ 12)', value: bono14 },
                            { label: 'Vacaciones (Salario ÷ 24)', value: vacaciones },
                            { label: 'Indemnización (Salario ÷ 12)', value: indemniz },
                        ].map((p, i) => <PatRow key={i} label={p.label} value={p.value} />)}
                        <div className="border-t-2 border-indigo-200 mt-2 pt-3">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-semibold text-black uppercase">Total Provisión Mensual</p>
                                <p className="text-[14px] font-semibold text-black">{fmtQ(totalProv)}</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-black">Acumulado del Año ({currentMonthNum} meses)</p>
                                <p className="text-[12px] font-semibold text-black">{fmtQ(acumProv)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN D — Historial de Pagos IGSS */}
            <IGSSHistory totalIGSS={totalIGSS} year={dayjs(month + '-01').year()} />

            {/* Modal Recibo Quincenal */}
            {receiptEmployee && (
                <PayStubModal
                    employee={receiptEmployee}
                    month={month}
                    quincena={quincena}
                    onQuincenaChange={setQuincena}
                    onClose={() => setReceiptEmployee(null)}
                />
            )}

            {showAddEmp && (
                <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200">
                        <div className="bg-[#106ebe] px-5 py-3 flex items-center justify-between rounded-t-xl">
                            <span className="text-[11px] font-semibold text-white uppercase">Nuevo Empleado</span>
                            <button onClick={() => setShowAddEmp(false)} className="text-white/60 hover:text-white"><X size={16} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            {([
                                { label: 'Nombre Completo', key: 'full_name', type: 'text' },
                                { label: 'Cargo', key: 'position', type: 'text' },
                                { label: 'Departamento', key: 'department', type: 'text' },
                                { label: 'Salario Base (Q)', key: 'base_salary', type: 'number' },
                            ] as { label: string; key: keyof typeof newEmp; type: string }[]).map(f => (
                                <div key={f.key}>
                                    <label className="block text-[9px] font-semibold uppercase text-slate-500 tracking-widest mb-1">{f.label}</label>
                                    <input type={f.type} value={newEmp[f.key]}
                                        onChange={e => setNewEmp(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                                        className="w-full border border-slate-200 rounded px-3 py-2 text-[11px] font-medium outline-none focus:border-emerald-500" />
                                </div>
                            ))}
                        </div>
                        <div className="px-5 pb-5 flex justify-end gap-2">
                            <button onClick={() => setShowAddEmp(false)} className="px-4 py-2 text-[10px] font-semibold uppercase text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                            <button onClick={addEmployee} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-[#106ebe] text-white text-[10px] font-semibold uppercase rounded hover:bg-blue-800 transition-all">
                                <Save size={12} /> Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PatRow: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="flex items-center justify-between py-1">
        <span className="text-[10px] font-semibold text-black">{label}</span>
        <span className="text-[11px] font-semibold text-black tabular-nums">{fmtQ(value)}</span>
    </div>
);

// ── Celda de salario editable inline ──────────────────────────────────────
const SalaryCell: React.FC<{ employeeId: string; value: number; onSaved: () => void }> = ({ employeeId, value, onSaved }) => {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value.toString());
    const [saving, setSaving] = React.useState(false);

    const commit = async () => {
        const num = parseFloat(draft);
        if (isNaN(num) || num <= 0) { setDraft(value.toString()); setEditing(false); return; }
        if (num === value) { setEditing(false); return; }
        setSaving(true);
        await supabase.from('payroll_employees').update({ base_salary: num }).eq('id', employeeId);
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (currentUser) {
            await registrarAuditoria({
                modulo: 'PLANILLA',
                accion: 'SALARIO_ACTUALIZADO',
                accion_descripcion: `Actualización de salario base de Q${value} a Q${num}`,
                entidad_id: employeeId,
                entidad_tipo: 'empleado',
                valores_anteriores: { salario: value },
                valores_nuevos: { salario: num },
                impacto_financiero: {
                    monto_total: Math.abs(num - value),
                    impacto_mensual_estimado: `${num > value ? 'Incremento' : 'Reducción'} nominal de Q${Math.abs(num - value)} mensual`
                }
            }, currentUser);
        }

        setSaving(false);
        setEditing(false);
        onSaved();
    };

    if (editing) {
        return (
            <input
                type="number"
                value={draft}
                autoFocus
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value.toString()); setEditing(false); } }}
                className="w-28 text-right border-2 border-emerald-500 rounded px-2 py-0.5 text-[11px] font-semibold text-gray-900 bg-white outline-none focus:ring-2 focus:ring-emerald-300"
            />
        );
    }

    return (
        <button
            onClick={() => { setDraft(value.toString()); setEditing(true); }}
            title="Clic para editar salario"
            className="group flex items-center justify-end gap-1 w-full"
            disabled={saving}
        >
            <span className="text-[11px] font-semibold font-mono text-black tabular-nums group-hover:text-emerald-700 transition-colors">
                {saving ? '...' : fmtQ(value)}
            </span>
            <span className="text-[8px] text-slate-300 group-hover:text-emerald-500 transition-colors">✎</span>
        </button>
    );
};


// ── Celda de horas extras editable inline ────────────────────────────────
const OvertimeCell: React.FC<{
    hours: number;
    pay: number;
    note: string;
    onCommit: (h: number, n: string) => void;
}> = ({ hours, pay, note, onCommit }) => {
    const [editing, setEditing] = React.useState(false);
    const [draftHours, setDraftHours] = React.useState(hours.toString());
    const [draftNote, setDraftNote] = React.useState(note);

    const handleCommit = () => {
        const h = Math.max(0, parseFloat(draftHours) || 0);
        onCommit(h, draftNote);
        setEditing(false);
    };

    if (editing) {
        return (
            <div className="flex flex-col gap-1 w-32 ml-auto p-1 bg-white border-2 border-orange-400 rounded shadow-lg z-20 relative">
                <input
                    type="number" min={0} step={0.5} value={draftHours} autoFocus
                    onChange={e => setDraftHours(e.target.value)}
                    placeholder="Horas"
                    className="w-full text-right border border-orange-200 rounded px-2 py-0.5 text-[11px] font-semibold"
                />
                <input
                    type="text" value={draftNote}
                    onChange={e => setDraftNote(e.target.value)}
                    placeholder="Nota (ej: Semana Santa)"
                    className="w-full border border-slate-200 rounded px-2 py-0.5 text-[10px] font-medium outline-none focus:border-indigo-400"
                    onKeyDown={e => { if (e.key === 'Enter') handleCommit(); if (e.key === 'Escape') setEditing(false); }}
                />
                <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing(false)} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[8px] rounded uppercase font-semibold">X</button>
                    <button onClick={handleCommit} className="px-1.5 py-0.5 bg-emerald-600 text-white text-[8px] rounded uppercase font-semibold">✔ Guardar</button>
                </div>
            </div>
        );
    }

    return (
        <button onClick={() => { setDraftHours(hours.toString()); setDraftNote(note); setEditing(true); }}
            title="Clic para ingresar horas y nota"
            className="group flex flex-col items-end w-full min-h-[40px] justify-center">
            <span className={`text-[11px] font-semibold tabular-nums transition-colors ${hours > 0 ? 'text-orange-600 group-hover:text-orange-800' : 'text-slate-300 group-hover:text-orange-400'}`}>
                {hours > 0 ? `${hours}h` : '+ Horas Extras'}{hours > 0 && <span className="text-slate-300"> ✎</span>}
            </span>
            {hours > 0 && note && <span className="text-[8px] font-medium text-slate-500 italic max-w-[100px] truncate">{note}</span>}
            {hours > 0 && <span className="text-[8px] font-semibold text-orange-500 tabular-nums">{fmtQ(pay)}</span>}
        </button>
    );
};

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const IGSSHistory: React.FC<{ totalIGSS: number; year: number }> = ({ totalIGSS, year }) => {
    const [history, setHistory] = React.useState<any[]>([]);

    React.useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('tax_declarations')
                .select('period_label, amount_due, amount_paid, payment_date, status')
                .eq('org_id', 'default')
                .eq('tax_type', 'IGSS')
                .gte('period_label', `${year}-01`)
                .lte('period_label', `${year}-12`);
            setHistory(data || []);
        };
        load();
    }, [year]);

    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-[#106ebe] px-4 py-3">
                <span className="text-[10px] font-semibold text-white uppercase tracking-widest">Sección D — Historial de Pagos IGSS {year}</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px]">
                    <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-semibold text-black uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-2">Mes</th>
                            <th className="px-4 py-2 text-right">Monto IGSS</th>
                            <th className="px-4 py-2">Fecha Pago</th>
                            <th className="px-4 py-2">Estado</th>
                            <th className="px-4 py-2">Comprobante</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {MONTH_NAMES.map((mName, mi) => {
                            const key = `${year}-${String(mi + 1).padStart(2, '0')}`;
                            const rec = history.find(h => h.period_label === key);
                            const isPast = new Date() > new Date(`${year}-${String(mi + 1).padStart(2, '0')}-20`);
                            return (
                                <tr key={mi} className={`hover:bg-slate-50 text-black ${rec?.status === 'paid' ? '' : isPast ? 'bg-red-50/30' : ''}`}>
                                    <td className="px-4 py-2.5 font-semibold">{mName}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold">{fmtQ(rec?.amount_due || totalIGSS)}</td>
                                    <td className="px-4 py-2.5 text-black">{rec?.payment_date ? dayjs(rec.payment_date).format('DD/MM/YYYY') : '—'}</td>
                                    <td className="px-4 py-2.5">
                                        {rec?.status === 'paid'
                                            ? <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-semibold uppercase rounded-full">Pagado</span>
                                            : isPast
                                                ? <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[8px] font-semibold uppercase rounded-full">Vencido</span>
                                                : <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-semibold uppercase rounded-full">Pendiente</span>
                                        }
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-400 text-[9px]">—</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════
// MODAL RECIBO QUINCENAL
// ═══════════════════════════════════════════════════════════
interface PayStubProps {
    employee: PayrollRow;
    month: string;
    quincena: 1 | 2;
    onQuincenaChange: (q: 1 | 2) => void;
    onClose: () => void;
}

const PayStubModal: React.FC<PayStubProps> = ({ employee, month, quincena, onQuincenaChange, onClose }) => {
    // Add states for strictly editable fields
    const [editableDept, setEditableDept] = React.useState(employee.department || 'LAS PALMAS');
    const [editableBonQ, setEditableBonQ] = React.useState(quincena === 2 ? 250 : 0);
    const [bankLine1, setBankLine1] = React.useState('Realizado a través de transferencia bancaria');
    const [bankLine2, setBankLine2] = React.useState('Banco Internacional cuenta: 8100525935');

    // Sync bonus with quincena change
    React.useEffect(() => {
        setEditableBonQ(quincena === 2 ? 250 : 0);
    }, [quincena]);

    const m = dayjs(month + '-01');
    const periodoLabel = quincena === 1
        ? `1ª Quincena — ${m.format('MMMM YYYY')} (01 – 15)`
        : `2ª Quincena — ${m.format('MMMM YYYY')} (16 – ${m.endOf('month').date()})`;

    // Cálculos quincenal
    const salarioQ        = employee.base_salary / 2;
    const igssQ           = employee.igssLaboral / 2;
    const bonQ            = editableBonQ;
    const horasExtrasQ    = employee.horasExtras || 0;
    const pagoHEQ         = employee.pagoHorasExtras || 0;
    const extraNoteQ      = employee.horaExtraNote || '';
    const liquidoQ        = salarioQ - igssQ + bonQ + pagoHEQ;
    const hoy             = dayjs().format('DD [de] MMMM [de] YYYY');

    const handlePrint = () => {
        const printDiv = document.getElementById('pay-stub-print');
        if (!printDiv) return;

        // Force inputs attributes to sync values for outerHTML capturing
        const inputs = printDiv.querySelectorAll('input');
        inputs.forEach(i => {
            i.setAttribute('value', i.value);
            i.style.borderBottom = 'none'; // Clear the helper dashed line for print
        });

        const printContent = printDiv.outerHTML;
        const w = window.open('', '_blank', 'width=1100,height=800');
        if (!w) return;
        w.document.write(`
            <html>
            <head>
                <title>Recibo de Salario — ${employee.full_name}</title>
                <style>
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    @media print {
                        body { margin: 0; padding: 20px; }
                        @page { size: letter portrait; margin: 1cm; }
                    }
                    input { border: none !important; outline: none !important; background: transparent !important; }
                    input[type=number]::-webkit-inner-spin-button, 
                    input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                </style>
            </head>
            <body>
                ${printContent}
            </body>
            </html>
        `);
        w.document.close();
        setTimeout(() => { 
            w.print(); 
            // restore dash line
            inputs.forEach(i => i.style.borderBottom = '1px dashed #ccc');
        }, 400);
    };

    return (
        <div className="fixed inset-0 z-[600] bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl border border-slate-200">
                {/* Modal Header */}
                <div className="bg-[#106ebe] px-5 py-3 flex items-center justify-between rounded-t-xl no-print">
                    <div>
                        <p className="text-[11px] font-semibold text-white uppercase tracking-widest">Recibo de Salario Quincenal</p>
                        <p className="text-[9px] text-white/50 mt-0.5">{employee.full_name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[9px] text-emerald-200 font-medium uppercase tracking-widest mr-4">✎ Hay campos editables en esta vista</span>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 bg-white text-[#106ebe] text-[10px] font-semibold uppercase rounded hover:bg-slate-100 transition-all">
                            IMPRIMIR RECIBO
                        </button>
                        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors"><X size={16} /></button>
                    </div>
                </div>

                {/* Quincena selector */}
                <div className="flex gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50 no-print">
                    <label className="text-[9px] font-semibold uppercase text-slate-500 tracking-widest self-center">Quincena:</label>
                    {([1, 2] as const).map(q => (
                        <button key={q} onClick={() => onQuincenaChange(q)}
                            className={`px-4 py-1.5 text-[10px] font-semibold uppercase rounded transition-all ${quincena === q ? 'bg-[#106ebe] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                            {q === 1 ? '1ª — Días 1 al 15' : `2ª — Días 16 al ${m.endOf('month').date()}`}
                        </button>
                    ))}
                </div>

                {/* Receipt Preview */}
                <div className="p-4 bg-white overflow-hidden flex justify-center">
                    <div id="pay-stub-print" style={{ padding: '20px 40px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px', color: '#000', backgroundColor: '#fff', width: '100%', maxWidth: '800px', margin: '0 auto', boxSizing: 'border-box' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '12px', marginBottom: '2px' }}>RECIBO DE PAGO DE SALARIO</div>
                            <div style={{ fontSize: '12px', marginBottom: '2px' }}>CEVICHERIA Y RESTAURANTE LAS PALMAS SOCIEDAD ANONIMA</div>
                            <div style={{ fontSize: '11px', marginBottom: '10px' }}>CORRESPONDIENTE A LA {quincena === 1 ? 'PRIMERA' : 'SEGUNDA'} QUINCENA DE {m.format('MMMM YYYY').toUpperCase()}</div>
                        </div>

                        <table style={{ borderCollapse: 'collapse', marginBottom: '40px', width: '100%' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '90px', padding: '2px 0' }}>NOMBRE:</td>
                                    <td style={{ padding: '2px 0' }}>
                                        <span style={{ backgroundColor: '#aaccff', padding: '2px 8px', display: 'inline-block', minWidth: '350px' }}>
                                            {employee.full_name.toUpperCase()}
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '2px 0' }}>CEVICHERIA:</td>
                                    <td style={{ padding: '2px 0', paddingLeft: '8px' }}>
                                        <input 
                                            value={editableDept} 
                                            onChange={e => setEditableDept(e.target.value.toUpperCase())}
                                            style={{ border: 'none', borderBottom: '1px dashed #ccc', background: 'transparent', width: '250px', outline: 'none', font: 'inherit', color: 'inherit', padding: 0 }}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '2px 0' }}>SALARIO:</td>
                                    <td style={{ padding: '2px 0', paddingLeft: '8px' }}>Q {employee.base_salary.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tbody>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                            <tbody>
                                <tr>
                                    {/* Left Column */}
                                    <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '40px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ padding: '2px 0' }}>SALARIO:</td>
                                                    <td style={{ textAlign: 'center', width: '30px' }}>Q</td>
                                                    <td style={{ textAlign: 'right', padding: '2px 0', width: '70px' }}>{salarioQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '2px 0' }}>BONIFICACIÓN:</td>
                                                    <td style={{ textAlign: 'center' }}>Q</td>
                                                    <td style={{ textAlign: 'right', padding: '2px 0' }}>
                                                        <input 
                                                            type="number"
                                                            value={editableBonQ} 
                                                            onChange={e => setEditableBonQ(Number(e.target.value) || 0)}
                                                            style={{ border: 'none', borderBottom: '1px dashed #ccc', background: 'transparent', width: '60px', outline: 'none', font: 'inherit', color: 'inherit', padding: 0, textAlign: 'right' }}
                                                        />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '2px 0' }}>COMISIÓN:</td>
                                                    <td style={{ textAlign: 'center' }}>Q</td>
                                                    <td style={{ textAlign: 'right', padding: '2px 0' }}>-</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '2px 0' }}>HORAS EXTRAS:</td>
                                                    <td style={{ textAlign: 'center' }}>Q</td>
                                                    <td style={{ textAlign: 'right', padding: '2px 0' }}>{pagoHEQ > 0 ? pagoHEQ.toLocaleString('es-GT', { minimumFractionDigits: 2 }) : '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '2px 0' }}>TOTAL:</td>
                                                    <td style={{ textAlign: 'center' }}>Q</td>
                                                    <td style={{ textAlign: 'right', padding: '2px 0' }}>{(salarioQ + bonQ + pagoHEQ).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                    
                                    {/* Right Column */}
                                    <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '40px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                <tr>
                                                    <td colSpan={3} style={{ padding: '2px 0' }}>DESCUENTOS:</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '2px 0' }}>(-) IGSS</td>
                                                    <td style={{ textAlign: 'center', width: '30px' }}>Q</td>
                                                    <td style={{ textAlign: 'right', padding: '2px 0', width: '70px' }}>{igssQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '2px 0' }}>VALES:</td>
                                                    <td style={{ textAlign: 'center' }}>Q</td>
                                                    <td style={{ textAlign: 'right', padding: '2px 0' }}>-</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '2px 0' }}>TOTAL:</td>
                                                    <td style={{ textAlign: 'center' }}>Q</td>
                                                    <td style={{ textAlign: 'right', padding: '2px 0' }}>{igssQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', marginBottom: '20px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ verticalAlign: 'bottom', fontSize: '10px' }}>
                                        <div style={{ marginBottom: '4px' }}>
                                            <input 
                                                value={bankLine1} 
                                                onChange={e => setBankLine1(e.target.value)}
                                                style={{ border: 'none', borderBottom: '1px dashed #ccc', background: 'transparent', width: '350px', outline: 'none', font: 'inherit', color: 'inherit', padding: 0 }}
                                            />
                                        </div>
                                        <div>
                                            <input 
                                                value={bankLine2} 
                                                onChange={e => setBankLine2(e.target.value)}
                                                style={{ border: 'none', borderBottom: '1px dashed #ccc', background: 'transparent', width: '350px', outline: 'none', font: 'inherit', color: 'inherit', padding: 0 }}
                                            />
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right', verticalAlign: 'bottom' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '15px' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '13px', textDecoration: 'underline' }}>LIQUIDO</span>
                                            <div style={{ backgroundColor: '#aaccff', padding: '4px 12px', display: 'flex', gap: '20px', fontWeight: 'bold', fontSize: '13px' }}>
                                                <span>Q</span>
                                                <span>{liquidoQ.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '40px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '45%', textAlign: 'center', verticalAlign: 'bottom' }}>
                                        <div style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>NOMBRE RECIBE</div>
                                    </td>
                                    <td style={{ width: '10%' }}></td>
                                    <td style={{ width: '45%', textAlign: 'center', verticalAlign: 'bottom' }}>
                                        <div style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>FIRMA</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StubRow: React.FC<{ label: string; type: 'ingreso' | 'deduccion'; value: number }> = ({ label, type, value }) => (
    <tr className="hover:bg-slate-50">
        <td className="px-5 py-2.5 font-medium text-[#0f172a] text-[10px]">{label}</td>
        <td className="px-5 py-2.5 text-center">
            <span className={`px-2 py-0.5 text-[8px] font-semibold uppercase rounded-full ${type === 'ingreso' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {type === 'ingreso' ? '+ Ingreso' : '− Deducción'}
            </span>
        </td>
        <td className={`px-5 py-2.5 text-right font-semibold tabular-nums text-[11px] ${type === 'ingreso' ? 'text-emerald-700' : 'text-red-600'}`}>
            {type === 'deduccion' ? '-' : ''}{fmtQ(value)}
        </td>
    </tr>
);
