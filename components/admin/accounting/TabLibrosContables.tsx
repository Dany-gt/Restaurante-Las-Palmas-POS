import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import {
    BookOpen, BarChart2, Scale, RefreshCw, Loader2,
    Printer, Download, AlertCircle, Filter, Zap, CheckCircle2, Save
} from 'lucide-react';
import { activityLogService } from '../../../services/ActivityLogService';

dayjs.locale('es');

// ─── DATOS EMPRESA ───────────────────────────────────────────────────────────
const EMPRESA = {
    nombre: 'CEVICHERIA Y RESTAURANTE LAS PALMAS, SOCIEDAD ANÓNIMA',
    corto:  'Las Palmas S.A.',
    nit:    '9188766-6',
};

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const IVA_FACTOR        = 12 / 112;
const IGSS_PATRONAL     = 0.1067;
const PRESTACIONES_RATE = 4 * (1 / 12);

// ─── CATÁLOGO DE CUENTAS ─────────────────────────────────────────────────────
const CUENTAS: Record<string, { nombre: string; tipo: 'ACTIVO'|'PASIVO'|'PATRIMONIO'|'INGRESO'|'COSTO'|'GASTO' }> = {
    '1101': { nombre: 'Caja',                    tipo: 'ACTIVO'     },
    '1102': { nombre: 'Bancos',                  tipo: 'ACTIVO'     },
    '1103': { nombre: 'Cuentas por cobrar',      tipo: 'ACTIVO'     },
    '1104': { nombre: 'Inventarios',             tipo: 'ACTIVO'     },
    '1201': { nombre: 'Equipo de cocina',        tipo: 'ACTIVO'     },
    '1202': { nombre: 'Mobiliario y equipo',     tipo: 'ACTIVO'     },
    '1203': { nombre: 'Vehículos',               tipo: 'ACTIVO'     },
    '1204': { nombre: 'Equipo de cómputo',       tipo: 'ACTIVO'     },
    '1205': { nombre: 'Depreciación acumulada',  tipo: 'ACTIVO'     },
    '2101': { nombre: 'Proveedores',             tipo: 'PASIVO'     },
    '2102': { nombre: 'IGSS por pagar',          tipo: 'PASIVO'     },
    '2103': { nombre: 'ISR por pagar',           tipo: 'PASIVO'     },
    '2104': { nombre: 'IVA por pagar',           tipo: 'PASIVO'     },
    '2105': { nombre: 'Prestaciones por pagar',  tipo: 'PASIVO'     },
    '2106': { nombre: 'Préstamos bancarios',     tipo: 'PASIVO'     },
    '3101': { nombre: 'Capital social',          tipo: 'PATRIMONIO' },
    '3102': { nombre: 'Utilidades retenidas',    tipo: 'PATRIMONIO' },
    '3103': { nombre: 'Utilidad del ejercicio',  tipo: 'PATRIMONIO' },
    '4101': { nombre: 'Ventas gravadas',         tipo: 'INGRESO'    },
    '4102': { nombre: 'Ventas exentas',          tipo: 'INGRESO'    },
    '4103': { nombre: 'Otros ingresos',          tipo: 'INGRESO'    },
    '5101': { nombre: 'Materia prima',           tipo: 'COSTO'      },
    '5102': { nombre: 'MOD (M.O. Directa)',      tipo: 'COSTO'      },
    '5103': { nombre: 'MOI (M.O. Indirecta)',    tipo: 'COSTO'      },
    '5104': { nombre: 'Cuotas patronales IGSS',  tipo: 'COSTO'      },
    '5105': { nombre: 'Bonificaciones',          tipo: 'COSTO'      },
    '5106': { nombre: 'Fletes',                  tipo: 'COSTO'      },
    '7101': { nombre: 'Sueldos administrativos', tipo: 'GASTO'      },
    '7102': { nombre: 'Cuotas administrativas',  tipo: 'GASTO'      },
    '7103': { nombre: 'Arrendamiento',           tipo: 'GASTO'      },
    '7104': { nombre: 'Combustibles',            tipo: 'GASTO'      },
    '7105': { nombre: 'Limpieza',                tipo: 'GASTO'      },
    '7106': { nombre: 'Mantenimiento',           tipo: 'GASTO'      },
    '7107': { nombre: 'Comunicaciones',          tipo: 'GASTO'      },
    '7108': { nombre: 'Seguridad',               tipo: 'GASTO'      },
    '7109': { nombre: 'Gas propano',             tipo: 'GASTO'      },
    '7110': { nombre: 'IDP',                     tipo: 'GASTO'      },
    '7111': { nombre: 'Material de empaque',     tipo: 'GASTO'      },
    '7112': { nombre: 'Insumos varios',          tipo: 'GASTO'      },
    '7113': { nombre: 'Otros gastos',            tipo: 'GASTO'      },
};

const GASTO_MAP: Record<string, string> = {
    'Pago alquiler': '7103', 'Servicios (luz/agua)': '7106', 'Gastos varios': '7113',
    'Combustibles': '7104',  'Comunicaciones': '7107',        'Limpieza': '7105',
    'Mantenimiento': '7106', 'Seguridad': '7108',             'Gas propano': '7109',
    'IDP': '7110',           'Material de empaque': '7111',   'Insumos varios': '7112',
};

// ─── TIPOS ───────────────────────────────────────────────────────────────────
interface AsientoLine { tipo: 'DEBE'|'HABER'; cuenta: string; concepto: string; parcial?: number; monto: number; }
interface Asiento {
    numero: number; fecha: string; descripcion: string;
    tipoAsiento: 'VENTAS'|'COMPRAS'|'PLANILLA'|'IGSS'|'IVA'|'GASTO'|'MANUAL';
    lineas: AsientoLine[]; cuadrado: boolean;
}
interface LedgerAccount {
    cuenta: string; nombre: string; tipo: string;
    totalDebe: number; totalHaber: number; saldo: number;
    movimientos: { asiento: number; fecha: string; desc: string; debe: number; haber: number; saldo: number }[];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmtQ   = (n: number) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

const TIPO_COLORS: Record<string, string> = {
    VENTAS:  'bg-emerald-100 text-emerald-800', COMPRAS: 'bg-blue-100 text-blue-800',
    PLANILLA:'bg-indigo-100 text-indigo-800',   IGSS:    'bg-orange-100 text-orange-800',
    IVA:     'bg-purple-100 text-purple-800',   GASTO:   'bg-rose-100 text-rose-800',
    MANUAL:  'bg-slate-100 text-slate-700',
};

// ─── PDF HELPERS ─────────────────────────────────────────────────────────────
const legalHeader = (titulo: string, mes: string) => `
  <div style="text-align:center;border-bottom:3px double #000;padding-bottom:8px;margin-bottom:12px">
    <div style="font-size:14px;font-weight:bold;letter-spacing:2px">${titulo}</div>
    <div style="font-size:11px;margin-top:4px">${EMPRESA.nombre}</div>
    <div style="font-size:10px">NIT: ${EMPRESA.nit} &nbsp;|&nbsp; Periodo: ${dayjs(mes+'-01').format('MMMM YYYY').toUpperCase()}</div>
  </div>`;

type BookTab = 'diario' | 'mayor' | 'balanza';

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export const TabLibrosContables: React.FC<{ accentColor: string }> = () => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const [month, setMonth]       = useState(dayjs().format('YYYY-MM'));
    const [loading, setLoading]   = useState(false);
    const [saving, setSaving]     = useState(false);
    const [toast, setToast]       = useState<{ msg: string; type: 'ok'|'err'} | null>(null);
    const [bookTab, setBookTab]   = useState<BookTab>('diario');
    const [asientos, setAsientos] = useState<Asiento[]>([]);
    const [dbInfo, setDbInfo]     = useState<{ count: number; at: string } | null>(null);

    // Filtros Libro Diario
    const [filtFecha, setFiltFecha]   = useState('');
    const [filtCuenta, setFiltCuenta] = useState('');
    const [filtTipo, setFiltTipo]     = useState('');
    const [selectedMayor, setSelectedMayor] = useState<string | null>(null);

    const showToast = (msg: string, type: 'ok'|'err' = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    // ─── 1. CARGAR DESDE journal_entries (Supabase) ───────────────────────
    const cargarDesdeDB = useCallback(async () => {
        setLoading(true);
        const [yr, mo] = month.split('-').map(Number);

        const { data: entries } = await supabase
            .from('journal_entries')
            .select('*, journal_lines(*)')
            .eq('org_id', 'default')
            .eq('periodo_anio', yr)
            .eq('periodo_mes', mo)
            .order('asiento_numero');

        if (entries && entries.length > 0) {
            const rebuilt: Asiento[] = entries.map((e: any) => {
                const lineas: AsientoLine[] = (e.journal_lines || []).map((l: any) => ({
                    tipo:    l.debe > 0 ? 'DEBE' : 'HABER',
                    cuenta:  l.cuenta_codigo,
                    concepto:l.descripcion || '',
                    monto:   l.debe > 0 ? Number(l.debe) : Number(l.haber),
                }));
                const td = round2(lineas.filter(l=>l.tipo==='DEBE').reduce((a,l)=>a+l.monto,0));
                const th = round2(lineas.filter(l=>l.tipo==='HABER').reduce((a,l)=>a+l.monto,0));
                return {
                    numero:       e.asiento_numero,
                    fecha:        e.fecha,
                    descripcion:  e.descripcion,
                    tipoAsiento:  (e.tipo_asiento?.toUpperCase() || 'MANUAL') as Asiento['tipoAsiento'],
                    lineas,
                    cuadrado:     Math.abs(td - th) < 0.05,
                };
            });
            setAsientos(rebuilt);
            setDbInfo({ count: entries.length, at: entries[0].created_at || '' });
        } else {
            setAsientos([]);
            setDbInfo(null);
        }
        setLoading(false);
    }, [month]);

    useEffect(() => { cargarDesdeDB(); }, [cargarDesdeDB]);

    // ─── 2. BUILD ASIENTOS (desde fuentes de datos del sistema) ──────────
    const buildAsientosLocal = async (): Promise<Asiento[]> => {
        const start = dayjs(month + '-01').startOf('month').format('YYYY-MM-DD');
        const end   = dayjs(month + '-01').endOf('month').format('YYYY-MM-DD');
        const result: Asiento[] = [];
        let num = 1;

        // — ASIENTO 1: VENTAS DIARIAS —
        const { data: ordenes } = await supabase.from('orders')
            .select('created_at,total,payment_method').eq('status','completado')
            .gte('created_at',start+'T00:00:00').lte('created_at',end+'T23:59:59');

        if (ordenes?.length) {
            const byDay: Record<string,{ef:number;tar:number}> = {};
            ordenes.forEach((o:any)=>{
                const d=o.created_at.slice(0,10);
                if (!byDay[d]) byDay[d]={ef:0,tar:0};
                String(o.payment_method||'').toLowerCase().includes('tarjeta')
                    ? (byDay[d].tar+=Number(o.total)||0)
                    : (byDay[d].ef+=Number(o.total)||0);
            });
            Object.entries(byDay).sort().forEach(([d,t])=>{
                const total=t.ef+t.tar, iva=round2(total*IVA_FACTOR), neta=round2(total-iva);
                const lineas:AsientoLine[]=[];
                if (t.ef>0){const i=round2(t.ef*IVA_FACTOR);lineas.push({tipo:'DEBE',cuenta:'1101',concepto:'Caja — efectivo',parcial:round2(t.ef-i),monto:round2(t.ef-i)},{tipo:'DEBE',cuenta:'2104',concepto:'IVA cobrado efectivo',parcial:i,monto:i});}
                if (t.tar>0){const i=round2(t.tar*IVA_FACTOR),r=round2(t.tar*0.0175);lineas.push({tipo:'DEBE',cuenta:'1102',concepto:'Bancos — Neonet neto',parcial:round2(t.tar-i-r),monto:round2(t.tar-i-r)},{tipo:'DEBE',cuenta:'1103',concepto:'Retención Neonet',parcial:r,monto:r},{tipo:'DEBE',cuenta:'2104',concepto:'IVA cobrado tarjeta',parcial:i,monto:i});}
                lineas.push({tipo:'HABER',cuenta:'4101',concepto:'Ventas gravadas',monto:neta},{tipo:'HABER',cuenta:'2104',concepto:'IVA débito fiscal',monto:iva});
                const td=round2(lineas.filter(l=>l.tipo==='DEBE').reduce((a,l)=>a+l.monto,0));
                const th=round2(lineas.filter(l=>l.tipo==='HABER').reduce((a,l)=>a+l.monto,0));
                result.push({numero:num++,fecha:d,descripcion:`Ventas del día ${dayjs(d).format('DD/MM/YYYY')}`,tipoAsiento:'VENTAS',lineas,cuadrado:Math.abs(td-th)<0.02});
            });
        }

        // — ASIENTO 2: COMPRAS SAT —
        const { data: compras } = await supabase.from('historico_auditoria_sat')
            .select('fecha_emision,proveedor_nombre,numero_autorizacion,monto_total')
            .eq('tipo','recibida').gte('fecha_emision',start).lte('fecha_emision',end);
        compras?.forEach((c:any)=>{
            const tot=Number(c.monto_total)||0; if(!tot) return;
            const iva=round2(tot*IVA_FACTOR),costo=round2(tot-iva),f=c.numero_autorizacion?.slice(-8)||'—';
            result.push({numero:num++,fecha:c.fecha_emision,tipoAsiento:'COMPRAS',cuadrado:true,
                descripcion:`Compra ${c.proveedor_nombre||'Proveedor'} fact. ${f}`,
                lineas:[{tipo:'DEBE',cuenta:'5101',concepto:`MP — ${c.proveedor_nombre||'Proveedor'}`,parcial:costo,monto:costo},{tipo:'DEBE',cuenta:'2104',concepto:'IVA crédito fiscal',parcial:iva,monto:iva},{tipo:'HABER',cuenta:'2101',concepto:`Fact. ${f}`,monto:tot}]});
        });

        // — ASIENTO 3: PLANILLA —
        const { data: emps } = await supabase.from('payroll_employees')
            .select('base_salary,department').eq('org_id','default').eq('is_active',true);
        if (emps?.length){
            const bruto=emps.reduce((a:number,e:any)=>a+Number(e.base_salary||0),0);
            const igssL=round2(bruto*0.0483),igssP=round2(bruto*IGSS_PATRONAL),prest=round2(bruto*PRESTACIONES_RATE),bonos=emps.length*250;
            const cocina=emps.filter((e:any)=>['Cocina','Servicio','Meseros','Kitchen'].includes(e.department));
            const admin=emps.filter((e:any)=>!['Cocina','Servicio','Meseros','Kitchen'].includes(e.department));
            const mod=round2(cocina.reduce((a:number,e:any)=>a+e.base_salary*0.7,0));
            const moi=round2(cocina.reduce((a:number,e:any)=>a+e.base_salary*0.3,0));
            const adm=round2(admin.reduce((a:number,e:any)=>a+e.base_salary,0));
            const cd=dayjs(month+'-01').endOf('month').format('YYYY-MM-DD');
            const lineas:AsientoLine[]=[
                ...(mod>0?[{tipo:'DEBE' as const,cuenta:'5102',concepto:'MOD — Cocina',parcial:mod,monto:mod}]:[]),
                ...(moi>0?[{tipo:'DEBE' as const,cuenta:'5103',concepto:'MOI — Cocina',parcial:moi,monto:moi}]:[]),
                ...(adm>0?[{tipo:'DEBE' as const,cuenta:'7101',concepto:'Sueldos admin',parcial:adm,monto:adm}]:[]),
                {tipo:'DEBE',cuenta:'5104',concepto:'IGSS patronal',parcial:igssP,monto:igssP},
                {tipo:'DEBE',cuenta:'5105',concepto:`Bonificación (${emps.length})`,parcial:bonos,monto:bonos},
                {tipo:'DEBE',cuenta:'2105',concepto:'Provisión prestaciones',parcial:prest,monto:prest},
                {tipo:'HABER',cuenta:'2102',concepto:'IGSS por pagar',monto:round2(igssP+igssL)},
                {tipo:'HABER',cuenta:'2105',concepto:'Prestaciones',monto:prest},
                {tipo:'HABER',cuenta:'1102',concepto:'Bancos — neto planilla',monto:round2(bruto-igssL+bonos)},
            ];
            const td=round2(lineas.filter(l=>l.tipo==='DEBE').reduce((a,l)=>a+l.monto,0));
            const th=round2(lineas.filter(l=>l.tipo==='HABER').reduce((a,l)=>a+l.monto,0));
            result.push({numero:num++,fecha:cd,tipoAsiento:'PLANILLA',cuadrado:Math.abs(td-th)<0.02,
                descripcion:`Planilla ${dayjs(month+'-01').format('MMMM YYYY')} — ${emps.length} empleados`,lineas});
        }

        // — ASIENTO 4: PAGO IGSS —
        const {data:igss}=await supabase.from('tax_declarations').select('amount_paid,payment_date')
            .eq('org_id','default').eq('tax_type','IGSS').eq('period_label',month).maybeSingle();
        if(igss&&Number(igss.amount_paid)>0){
            const m=Number(igss.amount_paid);
            result.push({numero:num++,fecha:igss.payment_date||dayjs(month+'-01').date(20).format('YYYY-MM-DD'),
                descripcion:`Pago IGSS ${dayjs(month+'-01').format('MMMM YYYY')}`,tipoAsiento:'IGSS',cuadrado:true,
                lineas:[{tipo:'DEBE',cuenta:'2102',concepto:'IGSS por pagar',monto:m},{tipo:'HABER',cuenta:'1102',concepto:'Bancos — Pago IGSS',monto:m}]});
        }

        // — ASIENTO 5: PAGO IVA —
        const {data:iva2}=await supabase.from('tax_declarations').select('amount_paid,payment_date')
            .eq('org_id','default').eq('tax_type','IVA').eq('period_label',month).maybeSingle();
        if(iva2&&Number(iva2.amount_paid)>0){
            const m=Number(iva2.amount_paid);
            result.push({numero:num++,fecha:iva2.payment_date||dayjs(month+'-01').date(15).format('YYYY-MM-DD'),
                descripcion:`Pago IVA ${month} SAT`,tipoAsiento:'IVA',cuadrado:true,
                lineas:[{tipo:'DEBE',cuenta:'2104',concepto:'IVA por pagar',monto:m},{tipo:'HABER',cuenta:'1102',concepto:'Bancos — Pago IVA SAT',monto:m}]});
        }

        // — ASIENTO 6: GASTOS OPERATIVOS —
        const {data:gastos}=await supabase.from('cash_flow').select('*').eq('org_id','default').eq('flow_type','exit')
            .gte('flow_date',start).lte('flow_date',end)
            .not('category','in','("Pago planilla","Pago IGSS","Compras materia prima")');
        gastos?.forEach((g:any)=>{
            const tot=Number(g.exit_amount)||0; if(!tot) return;
            const iva3=round2(tot*IVA_FACTOR),sinIva=round2(tot-iva3),cta=GASTO_MAP[g.category]||'7113',hab=g.category==='Pago alquiler'?'2101':'1102';
            result.push({numero:num++,fecha:g.flow_date,tipoAsiento:'GASTO',cuadrado:true,
                descripcion:`Gasto ${g.category} — ${dayjs(g.flow_date).format('DD/MM')}`,
                lineas:[{tipo:'DEBE',cuenta:cta,concepto:`${g.category}: ${g.concept||''}`.trim(),parcial:sinIva,monto:sinIva},{tipo:'DEBE',cuenta:'2104',concepto:'IVA crédito',parcial:iva3,monto:iva3},{tipo:'HABER',cuenta:hab,concepto:hab==='2101'?'Proveedores':'Bancos',monto:tot}]});
        });

        result.sort((a,b)=>a.fecha.localeCompare(b.fecha));
        result.forEach((a,i)=>a.numero=i+1);
        return result;
    };

    // ─── 3. GENERAR Y GUARDAR EN SUPABASE ────────────────────────────────
    const generarYGuardar = async () => {
        setSaving(true);
        try {
            const [yr, mo] = month.split('-').map(Number);
            const nuevos = await buildAsientosLocal();

            // Borrar entradas existentes del periodo
            await supabase.from('journal_entries')
                .delete().eq('org_id','default').eq('periodo_anio',yr).eq('periodo_mes',mo);

            // Insertar nuevos asientos con sus líneas
            for (const as of nuevos) {
                const { data: entry, error: entryErr } = await supabase
                    .from('journal_entries')
                    .insert({
                        org_id: 'default',
                        asiento_numero: as.numero,
                        fecha: as.fecha,
                        descripcion: as.descripcion,
                        tipo_asiento: as.tipoAsiento.toLowerCase(),
                        creado_automatico: true,
                        periodo_mes: mo,
                        periodo_anio: yr,
                    })
                    .select('id')
                    .single();

                if (entryErr || !entry) continue;

                const lines = as.lineas.map(l => ({
                    journal_entry_id: entry.id,
                    cuenta_codigo: l.cuenta,
                    cuenta_nombre: CUENTAS[l.cuenta]?.nombre || l.cuenta,
                    debe:  l.tipo === 'DEBE'  ? l.monto : 0,
                    haber: l.tipo === 'HABER' ? l.monto : 0,
                    descripcion: l.concepto,
                }));
                await supabase.from('journal_lines').insert(lines);
            }

            if (currentUser) {
                activityLogService.logFinancial({
                    user: currentUser,
                    module: 'CONTABILIDAD',
                    action: 'ASIENTO_CONTABLE_CREADO' as any,
                    severity: 'INFO',
                    entity_id: `LIBROS_${month}`,
                    entity_type: 'ASIENTO_LOTE',
                    details: {
                        periodo: month,
                        cantidad_asientos: nuevos.length,
                        generacion_automatica: true,
                        descripcion: `Generación automática de libro diario para ${dayjs(month+'-01').format('MMMM YYYY')}`
                    }
                });
            }

            setAsientos(nuevos);
            setDbInfo({ count: nuevos.length, at: new Date().toISOString() });
            showToast(`✓ ${nuevos.length} asientos generados para ${dayjs(month+'-01').format('MMMM YYYY')}`, 'ok');
        } catch (err: any) {
            showToast(`Error: ${err.message}`, 'err');
        }
        setSaving(false);
    };

    // ─── LIBRO MAYOR ──────────────────────────────────────────────────────
    const ledger = useMemo((): LedgerAccount[] => {
        const map: Record<string, LedgerAccount> = {};
        const ensure = (cod: string) => {
            if (!map[cod]) {
                const c = CUENTAS[cod];
                map[cod] = { cuenta:cod, nombre:c?.nombre||cod, tipo:c?.tipo||'?', totalDebe:0, totalHaber:0, saldo:0, movimientos:[] };
            }
        };
        asientos.forEach(as => {
            as.lineas.forEach(l => {
                ensure(l.cuenta);
                if (l.tipo==='DEBE') { map[l.cuenta].totalDebe+=l.monto; map[l.cuenta].saldo+=l.monto; }
                else                 { map[l.cuenta].totalHaber+=l.monto; map[l.cuenta].saldo-=l.monto; }
                map[l.cuenta].movimientos.push({ asiento:as.numero, fecha:as.fecha, desc:as.descripcion,
                    debe:l.tipo==='DEBE'?l.monto:0, haber:l.tipo==='HABER'?l.monto:0, saldo:map[l.cuenta].saldo });
            });
        });
        return Object.values(map).sort((a,b)=>a.cuenta.localeCompare(b.cuenta));
    }, [asientos]);

    // ─── BALANZA ──────────────────────────────────────────────────────────
    const balanza = useMemo(() => ledger.map(l => ({
        cuenta:l.cuenta, nombre:l.nombre, tipo:l.tipo,
        saldoDeudor:   l.saldo>0 ? round2(l.saldo) : 0,
        saldoAcreedor: l.saldo<0 ? round2(Math.abs(l.saldo)) : 0,
    })), [ledger]);
    const sumDeudor   = round2(balanza.reduce((a,r)=>a+r.saldoDeudor,0));
    const sumAcreedor = round2(balanza.reduce((a,r)=>a+r.saldoAcreedor,0));
    const cuadrado    = Math.abs(sumDeudor-sumAcreedor)<0.05;

    // ─── FILTROS DIARIO ───────────────────────────────────────────────────
    const lineasFlat = useMemo(()=>{
        const rows: { asientoNum:number; tipoAs:string; fecha:string; cuenta:string; nombreCuenta:string; concepto:string; parcial:number; debe:number; haber:number }[] = [];
        asientos.forEach(as => {
            as.lineas.forEach(l => {
                rows.push({ asientoNum:as.numero, tipoAs:as.tipoAsiento, fecha:as.fecha,
                    cuenta:l.cuenta, nombreCuenta:CUENTAS[l.cuenta]?.nombre||l.cuenta,
                    concepto:l.concepto, parcial:l.parcial||0,
                    debe:l.tipo==='DEBE'?l.monto:0, haber:l.tipo==='HABER'?l.monto:0 });
            });
        });
        return rows;
    }, [asientos]);

    const lineasFiltradas = useMemo(()=>lineasFlat.filter(r=>{
        if (filtFecha  && !r.fecha.includes(filtFecha))     return false;
        if (filtCuenta && !r.cuenta.startsWith(filtCuenta)) return false;
        if (filtTipo   && r.tipoAs!==filtTipo)              return false;
        return true;
    }), [lineasFlat, filtFecha, filtCuenta, filtTipo]);

    const byFecha = useMemo(()=>{
        const map: Record<string,typeof lineasFiltradas> = {};
        lineasFiltradas.forEach(r=>{ if(!map[r.fecha]) map[r.fecha]=[]; map[r.fecha].push(r); });
        return Object.entries(map).sort();
    }, [lineasFiltradas]);

    const totalDebe  = round2(lineasFiltradas.reduce((a,r)=>a+r.debe,0));
    const totalHaber = round2(lineasFiltradas.reduce((a,r)=>a+r.haber,0));
    const cuadraDiario = Math.abs(totalDebe-totalHaber)<0.05;

    // ─── PDF EXPORTS ──────────────────────────────────────────────────────
    const printDiario = () => {
        const w=window.open('','_blank'); if(!w) return;
        const byDia: Record<string,typeof lineasFiltradas>={};
        lineasFiltradas.forEach(r=>{if(!byDia[r.fecha])byDia[r.fecha]=[];byDia[r.fecha].push(r);});
        let gD=0,gH=0,rn=0;
        let html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Libro Diario</title>
            <style>@page{size:letter landscape;margin:1.5cm}body{font-family:'Courier New',monospace;font-size:8px}
            table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:3px 5px;font-size:7px;border:1px solid #ccc}
            td{padding:2px 5px;border:1px solid #ddd}.day{background:#f0f0f0;font-weight:bold}
            .sub{background:#e8f5e9;font-weight:bold}.grand{background:#1e3a5f;color:#fff;font-weight:bold}</style>
        </head><body>${legalHeader('LIBRO DIARIO',month)}<table>
        <thead><tr><th>N°</th><th>Fecha</th><th>Tipo</th><th>Código</th><th>Cuenta</th><th>Concepto</th>
        <th style="text-align:right">Parcial</th><th style="text-align:right">Debe</th><th style="text-align:right">Haber</th></tr></thead><tbody>`;
        Object.entries(byDia).sort().forEach(([d,fs])=>{
            const dD=fs.reduce((a,f)=>a+f.debe,0),dH=fs.reduce((a,f)=>a+f.haber,0);
            gD+=dD;gH+=dH;
            html+=`<tr class="day"><td colspan="9">── ${dayjs(d).format('dddd DD [de] MMMM [de] YYYY').toUpperCase()} ──</td></tr>`;
            fs.forEach(f=>{
                rn++;
                const eh=f.haber>0;
                html+=`<tr><td style="text-align:center">${rn}</td><td>${dayjs(f.fecha).format('DD/MM/YYYY')}</td>
                <td>${f.tipoAs}</td><td style="${eh?'padding-left:14px':''}color:#1e3a5f;font-weight:bold">${f.cuenta}</td>
                <td style="${eh?'padding-left:14px':''}">${f.nombreCuenta}</td><td style="${eh?'padding-left:14px':''}">${f.concepto}</td>
                <td style="text-align:right">${f.parcial?fmtQ(f.parcial):''}</td>
                <td style="text-align:right;color:#065f46">${f.debe?fmtQ(f.debe):''}</td>
                <td style="text-align:right;color:#991b1b">${f.haber?fmtQ(f.haber):''}</td></tr>`;
            });
            html+=`<tr class="sub"><td colspan="6" style="text-align:right">Subtotal ${dayjs(d).format('DD/MM')}</td>
            <td></td><td style="text-align:right">${fmtQ(dD)}</td><td style="text-align:right">${fmtQ(dH)}</td></tr>`;
        });
        html+=`<tr class="grand"><td colspan="6" style="text-align:right">TOTALES DEL PERIODO</td>
        <td></td><td style="text-align:right">${fmtQ(gD)}</td><td style="text-align:right">${fmtQ(gH)}</td>
        </tr></tbody></table><div style="margin-top:12px;text-align:right;font-size:7px">Página 1 — Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}</div>
        </body></html>`;
        w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),400);
    };

    const printMayor = () => {
        const w=window.open('','_blank'); if(!w) return;
        let html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Libro Mayor</title>
        <style>@page{size:letter portrait;margin:1.5cm}body{font-family:'Courier New',monospace;font-size:8px}
        .folio{border:2px solid #000;padding:6px;margin-bottom:4px}.ft{font-size:11px;font-weight:bold;text-transform:uppercase}
        table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:3px 5px;font-size:7px}
        td{padding:2px 5px;border-bottom:1px solid #ddd}.sf{background:#f0f0f0;font-weight:bold}.pb{page-break-before:always}</style>
        </head><body>${legalHeader('LIBRO MAYOR',month)}`;
        ledger.forEach((c,i)=>{
            if(i>0) html+='<div class="pb"></div>';
            html+=`<div class="folio"><div class="ft">CUENTA: ${c.cuenta} — ${c.nombre}</div>
            <div style="font-size:9px">Tipo: ${c.tipo} | Folio N° ${i+1}</div></div>
            <table><thead><tr><th>Fecha</th><th>Ref.</th><th>Concepto</th>
            <th style="text-align:right">Debe</th><th style="text-align:right">Haber</th><th style="text-align:right">Saldo</th></tr></thead><tbody>`;
            c.movimientos.forEach(m=>{
                html+=`<tr><td>${dayjs(m.fecha).format('DD/MM/YYYY')}</td><td>As.#${m.asiento}</td><td>${m.desc}</td>
                <td style="text-align:right;color:#065f46">${m.debe?fmtQ(m.debe):''}</td>
                <td style="text-align:right;color:#991b1b">${m.haber?fmtQ(m.haber):''}</td>
                <td style="text-align:right">${fmtQ(Math.abs(m.saldo))} ${m.saldo>=0?'D':'A'}</td></tr>`;
            });
            html+=`<tr class="sf"><td colspan="3" style="text-align:right">SALDO FINAL</td>
            <td style="text-align:right">${fmtQ(c.totalDebe)}</td><td style="text-align:right">${fmtQ(c.totalHaber)}</td>
            <td style="text-align:right;font-size:10px">${fmtQ(Math.abs(c.saldo))} ${c.saldo>=0?'DEUDOR':'ACREEDOR'}</td></tr>
            </tbody></table>`;
        });
        html+='</body></html>';
        w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),400);
    };

    const exportBalanzaCSV = () => {
        const rows = ['Código,Nombre,Tipo,Saldo Deudor,Saldo Acreedor',
            ...balanza.map(r=>`${r.cuenta},"${r.nombre}",${r.tipo},${r.saldoDeudor.toFixed(2)},${r.saldoAcreedor.toFixed(2)}`),
            `,,TOTALES,${sumDeudor.toFixed(2)},${sumAcreedor.toFixed(2)}`
        ].join('\n');
        const url = URL.createObjectURL(new Blob(['\ufeff'+rows],{type:'text/csv;charset=utf-8'}));
        const a=document.createElement('a'); a.href=url; a.download=`Balanza_${month}.csv`; a.click();
    };

    const mayorSel = ledger.find(c=>c.cuenta===selectedMayor);

    const SUB_TABS = [
        {id:'diario' as BookTab, label:'Libro Diario',      icon:<BookOpen size={13}/>},
        {id:'mayor'  as BookTab, label:'Libro Mayor',       icon:<BarChart2 size={13}/>},
        {id:'balanza'as BookTab, label:'Balanza de Saldos', icon:<Scale size={13}/>},
    ];

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar text-gray-900">

            {/* ── Toast ─────────────────────────────────────────────── */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 px-5 py-2.5 rounded-xl shadow-2xl text-white text-[11px] font-black uppercase tracking-widest transition-all animate-in slide-in-from-top-4
                    ${toast.type==='ok'?'bg-emerald-600':'bg-red-600'}`}>
                    {toast.type==='ok'?<CheckCircle2 size={14}/>:<AlertCircle size={14}/>}
                    {toast.msg}
                </div>
            )}

            {/* ── Barra Superior ─────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Periodo:</label>
                    <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-1.5 text-[11px] font-bold bg-white"/>
                    <button onClick={cargarDesdeDB} className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
                        <RefreshCw size={13}/>
                    </button>
                    {loading && <Loader2 size={14} className="animate-spin text-teal-500"/>}
                    {dbInfo && (
                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                            <Save size={10} className="text-emerald-600"/>
                            <span className="text-[9px] font-black text-emerald-700 uppercase">{dbInfo.count} asientos en BD</span>
                        </div>
                    )}
                </div>

                {/* Botones de acción */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={generarYGuardar} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase rounded-lg shadow-lg transition-all disabled:opacity-60 active:scale-95">
                        {saving ? <Loader2 size={13} className="animate-spin"/> : <Zap size={13}/>}
                        Generar Asientos Automáticos
                    </button>
                    <button onClick={printDiario}
                        className="flex items-center gap-1 px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white text-[10px] font-black uppercase rounded-lg transition-all">
                        <Printer size={12}/> PDF Diario
                    </button>
                    <button onClick={printMayor}
                        className="flex items-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-black uppercase rounded-lg transition-all">
                        <Printer size={12}/> PDF Mayor
                    </button>
                    <button onClick={exportBalanzaCSV}
                        className="flex items-center gap-1 px-3 py-2 border-2 border-slate-300 hover:bg-slate-50 text-slate-700 text-[10px] font-black uppercase rounded-lg transition-all">
                        <Download size={12}/> Balanza CSV
                    </button>
                </div>
            </div>

            {/* ── Sub-tabs ──────────────────────────────────────────── */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {SUB_TABS.map(t=>(
                    <button key={t.id} onClick={()=>setBookTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all
                            ${bookTab===t.id?'bg-white text-slate-900 shadow-sm':'text-slate-400 hover:text-slate-600'}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* Sin datos */}
            {asientos.length===0 && !loading && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-[10px] font-bold text-amber-800">
                    <AlertCircle size={16} className="shrink-0"/>
                    <div>
                        <p className="font-black">Sin asientos para este periodo.</p>
                        <p className="mt-0.5">Haz clic en <strong>Generar Asientos Automáticos</strong> para leer ventas, compras y planilla del sistema y guardarlos en la base de datos.</p>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                LIBRO DIARIO
            ════════════════════════════════════════════════════════ */}
            {bookTab==='diario' && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-[#106ebe] px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <BookOpen size={14}/> LIBRO DIARIO — {dayjs(month+'-01').format('MMMM YYYY').toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${cuadraDiario?'bg-emerald-500':'bg-red-500'} text-white`}>
                            {cuadraDiario?'✓ CUADRA':'⚠ DESCUADRE'}
                        </span>
                    </div>

                    {/* Filtros */}
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                        <Filter size={12} className="text-slate-400"/>
                        <label className="text-[9px] font-black text-slate-400 uppercase">Filtros:</label>
                        <input type="date" value={filtFecha} onChange={e=>setFiltFecha(e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1 text-[10px] font-bold bg-white"/>
                        <input type="text" maxLength={4} value={filtCuenta} onChange={e=>setFiltCuenta(e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1 text-[10px] font-bold bg-white w-20" placeholder="Cuenta"/>
                        <select value={filtTipo} onChange={e=>setFiltTipo(e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1 text-[10px] font-bold bg-white">
                            <option value="">Todos los tipos</option>
                            {['VENTAS','COMPRAS','PLANILLA','IGSS','IVA','GASTO'].map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                        {(filtFecha||filtCuenta||filtTipo) && (
                            <button onClick={()=>{setFiltFecha('');setFiltCuenta('');setFiltTipo('');}}
                                className="text-[9px] font-black text-red-500 uppercase hover:underline">✕ Limpiar</button>
                        )}
                        <span className="ml-auto text-[9px] font-bold text-slate-400">{lineasFiltradas.length} líneas</span>
                    </div>

                    <div className="overflow-x-auto max-h-[620px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-[10px] min-w-[900px]">
                            <thead className="bg-slate-50 text-[8px] font-black text-slate-500 uppercase tracking-widest sticky top-0 border-b border-slate-200">
                                <tr>
                                    <th className="px-3 py-2 w-8">N°</th>
                                    <th className="px-3 py-2 w-20">Fecha</th>
                                    <th className="px-3 py-2 w-14">Tipo</th>
                                    <th className="px-3 py-2 w-14">Código</th>
                                    <th className="px-3 py-2">Cuenta</th>
                                    <th className="px-3 py-2">Descripción</th>
                                    <th className="px-3 py-2 text-right w-24">Parcial</th>
                                    <th className="px-3 py-2 text-right w-28">Debe</th>
                                    <th className="px-3 py-2 text-right w-28">Haber</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {byFecha.length===0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Sin datos. Haz clic en "Generar Asientos Automáticos".</td></tr>}
                                {byFecha.map(([dia,filas])=>{
                                    const dD=round2(filas.reduce((a,f)=>a+f.debe,0));
                                    const dH=round2(filas.reduce((a,f)=>a+f.haber,0));
                                    let li=0;
                                    return (
                                        <React.Fragment key={dia}>
                                            <tr className="bg-slate-100 border-t-2 border-slate-300">
                                                <td colSpan={9} className="px-3 py-1.5 text-[9px] font-black text-slate-600 uppercase">
                                                    {dayjs(dia).format('dddd DD [de] MMMM [de] YYYY').toUpperCase()}
                                                </td>
                                            </tr>
                                            {filas.map((f,fi)=>{
                                                li++;
                                                const eh=f.haber>0;
                                                return (
                                                    <tr key={fi} className={`hover:bg-teal-50/30 ${eh?'bg-slate-50/40':'bg-white'}`}>
                                                        <td className="px-3 py-1.5 text-slate-400 font-mono text-[8px] text-center">{li}</td>
                                                        <td className="px-3 py-1.5 font-mono text-slate-500">{dayjs(f.fecha).format('DD/MM/YYYY')}</td>
                                                        <td className="px-3 py-1.5">
                                                            <span className={`px-1.5 py-0.5 rounded text-[6px] font-black uppercase ${TIPO_COLORS[f.tipoAs]||'bg-slate-100 text-slate-600'}`}>{f.tipoAs}</span>
                                                        </td>
                                                        <td className={`px-3 py-1.5 font-black font-mono ${eh?'text-slate-500 pl-7':'text-[#106ebe]'}`}>{f.cuenta}</td>
                                                        <td className={`px-3 py-1.5 font-bold text-slate-800 ${eh?'pl-5':''}`}>{f.nombreCuenta}</td>
                                                        <td className="px-3 py-1.5 text-slate-400 text-[9px] max-w-[200px] truncate">{f.concepto}</td>
                                                        <td className="px-3 py-1.5 text-right text-slate-500">{f.parcial?fmtQ(f.parcial):'—'}</td>
                                                        <td className="px-3 py-1.5 text-right font-black text-emerald-700">{f.debe?fmtQ(f.debe):'—'}</td>
                                                        <td className="px-3 py-1.5 text-right font-black text-red-600">{f.haber?fmtQ(f.haber):'—'}</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr className="bg-emerald-50/60 border-b-2 border-emerald-200">
                                                <td colSpan={6} className="px-3 py-1 text-right text-[8px] font-black text-slate-600 uppercase">Subtotal {dayjs(dia).format('DD/MM')}</td>
                                                <td className="px-3 py-1"></td>
                                                <td className="px-3 py-1 text-right font-black text-emerald-700 text-[9px]">{fmtQ(dD)}</td>
                                                <td className="px-3 py-1 text-right font-black text-red-600 text-[9px]">{fmtQ(dH)}</td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                            <tfoot className="sticky bottom-0">
                                <tr className="bg-slate-800 text-white text-[9px] font-black">
                                    <td colSpan={6} className="px-3 py-2 uppercase tracking-widest">Total Periodo — Debe = Haber</td>
                                    <td></td>
                                    <td className="px-3 py-2 text-right">{fmtQ(totalDebe)}</td>
                                    <td className="px-3 py-2 text-right">{fmtQ(totalHaber)}</td>
                                </tr>
                                <tr className={cuadraDiario?'bg-emerald-700':'bg-red-700'}>
                                    <td colSpan={9} className="px-3 py-1 text-center text-white text-[8px] font-black uppercase">
                                        {cuadraDiario
                                            ? `✓ CUADRADO — Total Debe ${fmtQ(totalDebe)} = Total Haber ${fmtQ(totalHaber)}`
                                            : `⚠ DESCUADRE — Diferencia de ${fmtQ(Math.abs(totalDebe-totalHaber))}`}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                LIBRO MAYOR
            ════════════════════════════════════════════════════════ */}
            {bookTab==='mayor' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="bg-[#106ebe] px-4 py-3">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <BarChart2 size={14}/> Cuentas Activas
                            </span>
                        </div>
                        <div className="max-h-[680px] overflow-y-auto custom-scrollbar divide-y divide-slate-50">
                            {ledger.length===0 && <p className="text-[10px] text-slate-400 text-center py-10">Sin movimientos</p>}
                            {ledger.map(c=>(
                                <button key={c.cuenta} onClick={()=>setSelectedMayor(c.cuenta)}
                                    className={`w-full flex items-center justify-between p-3 hover:bg-slate-50 text-left
                                        ${selectedMayor===c.cuenta?'bg-blue-50 border-l-4 border-[#106ebe]':''}`}>
                                    <div>
                                        <div className="text-[7px] font-black text-slate-400 uppercase">{c.cuenta}</div>
                                        <div className="text-[10px] font-black text-slate-800">{c.nombre}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-[9px] font-black ${c.saldo>=0?'text-emerald-700':'text-red-600'}`}>{fmtQ(Math.abs(c.saldo))}</div>
                                        <div className="text-[7px] text-slate-400">{c.saldo>=0?'Deudor':'Acreedor'}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        {mayorSel ? (
                            <>
                                <div className="border-b-2 border-slate-800 px-5 py-4 bg-slate-50">
                                    <div className="text-[8px] font-black text-slate-400 uppercase">{EMPRESA.nombre} · NIT {EMPRESA.nit} · {dayjs(month+'-01').format('MMMM YYYY').toUpperCase()}</div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <div>
                                            <div className="text-[9px] font-black text-slate-500 uppercase">Cuenta</div>
                                            <div className="text-[15px] font-black text-slate-900 uppercase">{mayorSel.cuenta} — {mayorSel.nombre}</div>
                                        </div>
                                        <div className="flex gap-6">
                                            <div className="text-center">
                                                <div className="text-[8px] font-black text-slate-400 uppercase">Total Débitos</div>
                                                <div className="text-[13px] font-black text-emerald-700">{fmtQ(mayorSel.totalDebe)}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[8px] font-black text-slate-400 uppercase">Total Créditos</div>
                                                <div className="text-[13px] font-black text-red-600">{fmtQ(mayorSel.totalHaber)}</div>
                                            </div>
                                            <div className="text-center border-l border-slate-200 pl-6">
                                                <div className="text-[8px] font-black text-slate-400 uppercase">Saldo Final</div>
                                                <div className={`text-[15px] font-black ${mayorSel.saldo>=0?'text-slate-900':'text-amber-700'}`}>{fmtQ(Math.abs(mayorSel.saldo))}</div>
                                                <div className={`text-[8px] font-black uppercase ${mayorSel.saldo>=0?'text-emerald-600':'text-amber-600'}`}>{mayorSel.saldo>=0?'DEUDOR':'ACREEDOR'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left text-[10px]">
                                        <thead className="bg-slate-800 text-white text-[8px] font-black uppercase sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 w-24">Fecha</th>
                                                <th className="px-4 py-2 w-16">Referencia</th>
                                                <th className="px-4 py-2">Concepto</th>
                                                <th className="px-4 py-2 text-right w-28">Debe</th>
                                                <th className="px-4 py-2 text-right w-28">Haber</th>
                                                <th className="px-4 py-2 text-right w-28">Saldo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {mayorSel.movimientos.map((m,i)=>(
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2.5 font-mono text-slate-500">{dayjs(m.fecha).format('DD/MM/YYYY')}</td>
                                                    <td className="px-4 py-2.5 font-mono text-[9px] text-[#106ebe] font-black">As.#{m.asiento}</td>
                                                    <td className="px-4 py-2.5 text-slate-700 font-bold text-[9px] max-w-[260px] truncate">{m.desc}</td>
                                                    <td className="px-4 py-2.5 text-right font-black text-emerald-700">{m.debe?fmtQ(m.debe):'—'}</td>
                                                    <td className="px-4 py-2.5 text-right font-black text-red-600">{m.haber?fmtQ(m.haber):'—'}</td>
                                                    <td className={`px-4 py-2.5 text-right font-black ${m.saldo>=0?'text-slate-800':'text-amber-700'}`}>
                                                        {fmtQ(Math.abs(m.saldo))} <span className="text-[8px] opacity-50">{m.saldo>=0?'D':'A'}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-100 border-t-2 border-slate-800">
                                            <tr>
                                                <td colSpan={3} className="px-4 py-2.5 text-[9px] font-black uppercase text-slate-600 text-right">SALDO FINAL</td>
                                                <td className="px-4 py-2.5 text-right font-black text-emerald-700">{fmtQ(mayorSel.totalDebe)}</td>
                                                <td className="px-4 py-2.5 text-right font-black text-red-600">{fmtQ(mayorSel.totalHaber)}</td>
                                                <td className={`px-4 py-2.5 text-right text-[12px] font-black ${mayorSel.saldo>=0?'text-slate-900':'text-amber-700'}`}>
                                                    {fmtQ(Math.abs(mayorSel.saldo))} {mayorSel.saldo>=0?'D':'A'}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-80 text-center opacity-30">
                                <BarChart2 size={56} className="text-slate-200 mb-4"/>
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Selecciona una cuenta del panel izquierdo</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                BALANZA DE SALDOS
            ════════════════════════════════════════════════════════ */}
            {bookTab==='balanza' && (
                <div className="space-y-4">
                    <div className={`flex items-center gap-4 px-6 py-4 rounded-xl border-2 ${cuadrado?'bg-emerald-50 border-emerald-500 text-emerald-800':'bg-red-50 border-red-500 text-red-800'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xl shadow-lg shrink-0 ${cuadrado?'bg-emerald-500':'bg-red-500'}`}>●</div>
                        <div>
                            <p className="text-[13px] font-black uppercase tracking-wide">
                                {cuadrado ? '● VERDE — CUADRE CONTABLE CORRECTO' : '● ROJO — DESCUADRE CONTABLE DETECTADO'}
                            </p>
                            <p className="text-[10px] font-bold mt-0.5">
                                {cuadrado
                                    ? `Saldo Deudor ${fmtQ(sumDeudor)} = Saldo Acreedor ${fmtQ(sumAcreedor)} — Partida doble OK`
                                    : `Diferencia de ${fmtQ(Math.abs(sumDeudor-sumAcreedor))} — Revisar asientos descuadrados`}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="bg-[#106ebe] px-4 py-3 flex items-center justify-between">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Scale size={14}/> BALANZA DE COMPROBACIÓN — {dayjs(month+'-01').format('MMMM YYYY').toUpperCase()}
                            </span>
                            <span className="text-white/60 text-[9px] font-bold">NIT {EMPRESA.nit}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[10px]">
                                <thead className="bg-slate-800 text-white text-[8px] font-black uppercase tracking-widest">
                                    <tr>
                                        <th className="px-4 py-2 w-16">Código</th>
                                        <th className="px-4 py-2">Nombre de Cuenta</th>
                                        <th className="px-4 py-2 w-24">Tipo</th>
                                        <th className="px-4 py-2 text-right w-32 bg-emerald-900">Saldo Deudor</th>
                                        <th className="px-4 py-2 text-right w-32 bg-red-900">Saldo Acreedor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {balanza.length===0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Sin datos para este periodo</td></tr>}
                                    {balanza.map((r,i)=>(
                                        <tr key={r.cuenta} className={`hover:bg-slate-50 ${i%2===0?'bg-white':'bg-slate-50/30'}`}>
                                            <td className="px-4 py-2.5 font-mono font-black text-[#106ebe] text-[11px]">{r.cuenta}</td>
                                            <td className="px-4 py-2.5 font-bold text-slate-800">{r.nombre}</td>
                                            <td className="px-4 py-2.5">
                                                <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase
                                                    ${r.tipo==='ACTIVO'?'bg-emerald-100 text-emerald-800':r.tipo==='PASIVO'?'bg-red-100 text-red-800':
                                                      r.tipo==='PATRIMONIO'?'bg-purple-100 text-purple-800':r.tipo==='INGRESO'?'bg-blue-100 text-blue-800':
                                                      r.tipo==='COSTO'?'bg-orange-100 text-orange-800':'bg-slate-100 text-slate-600'}`}>{r.tipo}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-black text-emerald-700 bg-emerald-50/20">{r.saldoDeudor>0?fmtQ(r.saldoDeudor):'—'}</td>
                                            <td className="px-4 py-2.5 text-right font-black text-red-600 bg-red-50/20">{r.saldoAcreedor>0?fmtQ(r.saldoAcreedor):'—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-800 text-white font-black">
                                        <td colSpan={3} className="px-4 py-3 text-[9px] uppercase tracking-widest">TOTALES</td>
                                        <td className="px-4 py-3 text-right text-[12px] text-emerald-400">{fmtQ(sumDeudor)}</td>
                                        <td className="px-4 py-3 text-right text-[12px] text-red-400">{fmtQ(sumAcreedor)}</td>
                                    </tr>
                                    <tr className={cuadrado?'bg-emerald-700':'bg-red-700'}>
                                        <td colSpan={5} className="px-4 py-2 text-center text-white text-[9px] font-black uppercase tracking-widest">
                                            {cuadrado
                                                ? `● VERDE — Saldo Deudor ${fmtQ(sumDeudor)} = Saldo Acreedor ${fmtQ(sumAcreedor)} — ✓ Cuadre correcto`
                                                : `● ROJO — Diferencia ${fmtQ(Math.abs(sumDeudor-sumAcreedor))} — Revisar asientos`}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="p-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-3">
                            {(['ACTIVO','PASIVO','PATRIMONIO','INGRESO','COSTO','GASTO'] as const).map(tipo=>{
                                const rows=balanza.filter(r=>r.tipo===tipo);
                                const total=rows.reduce((a,r)=>a+r.saldoDeudor-r.saldoAcreedor,0);
                                const cm: Record<string,string>={ACTIVO:'border-emerald-300 bg-emerald-50',PASIVO:'border-red-300 bg-red-50',PATRIMONIO:'border-purple-300 bg-purple-50',INGRESO:'border-blue-300 bg-blue-50',COSTO:'border-orange-300 bg-orange-50',GASTO:'border-slate-200 bg-slate-50'};
                                return (
                                    <div key={tipo} className={`p-3 rounded-xl border-2 ${cm[tipo]}`}>
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{tipo}</p>
                                        <p className="text-[13px] font-black text-slate-900">{fmtQ(Math.abs(total))}</p>
                                        <p className="text-[8px] text-slate-400">{rows.length} cuenta(s)</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
