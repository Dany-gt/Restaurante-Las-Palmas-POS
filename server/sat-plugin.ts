import type { Plugin } from 'vite';
import { spawn } from 'child_process';
import path from 'path';
import { parseAuditDTE } from '../utils/satAuditParser';

// ═══════════════════════════════════════════════════════════
// Categorías idénticas a TabCompras.tsx
// ═══════════════════════════════════════════════════════════
const CATEGORIES = [
    'Materia prima cocina', 'Materia prima cevichería', 'Materia prima bebidas',
    'Gas y energía', 'Limpieza y desechables', 'Mantenimiento',
    'Servicios profesionales', 'Otros'
];

function autoCategorize(name: string): string {
    const s = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/gas|electric|energuate|eegsa|tropig|z-gas|empresa elec|solar|energi|metropolitano/.test(s)) return 'Gas y energía';
    if (/platic|desechable|limpieza|detergent|jabon|bolsa|quimic|higienico|servilleta|dollarcity/.test(s)) return 'Limpieza y desechables';
    if (/bebid|pepsi|coca|cerveza|brava|gallito|agua pura|hielo|licor|ron |aguas|vodka|jarabe|licores/.test(s)) return 'Materia prima bebidas';
    if (/ceviche|marisco|camaron|pescado|concha|ostra|marina/.test(s)) return 'Materia prima cevichería';
    if (/ferreter|pintur|vidrio|mader|taller|mantenim|herramient|reparacion|repuest|tecnico/.test(s)) return 'Mantenimiento';
    if (/contad|auditor|abogad|notari|asesor|seguridad|consultor|oficin|servicios prof/.test(s)) return 'Servicios profesionales';
    if (/pollo|carne|carnicer|embutid|huevo|pan |tortilla|verdur|frut|abarrot|distribuidor|walmart|paiz|unisuper|la torre|supermerca|aliment|lacteo|queso|harina|montana|asociadas|avicola/.test(s)) return 'Materia prima cocina';
    return 'Otros';
}

// ═══════════════════════════════════════════════════════════
// Ejecutar el script Python de forma segura (stdin/stdout)
// ═══════════════════════════════════════════════════════════
function runPythonBridge(params: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(process.cwd(), 'server', 'sat_bridge.py');
        const proc = spawn('python', [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 600_000 // 10 minutos máximo para procesos masivos (Marzo/Diciembre)
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');

        proc.stdout.on('data', (data: string) => { stdout += data; });
        proc.stderr.on('data', (data: string) => { stderr += data; });

        proc.on('error', (err: Error) => {
            if (err.message.includes('ENOENT')) {
                reject(new Error('Python no está instalado o no se encuentra en el PATH del sistema. Instale Python 3.7+ y reinicie.'));
            } else {
                reject(new Error(`Error ejecutando Python: ${err.message}`));
            }
        });

        proc.on('close', (code: number) => {
            if (code !== 0 && !stdout.trim()) {
                reject(new Error(stderr || `Python terminó con código ${code}`));
                return;
            }
            try {
                const result = JSON.parse(stdout.trim());
                resolve(result);
            } catch (e) {
                reject(new Error(`Respuesta inválida del script SAT. stdout: ${stdout.substring(0, 200)}`));
            }
        });

        // Enviar parámetros por stdin (más seguro que argumentos de línea de comandos)
        proc.stdin.write(JSON.stringify(params));
        proc.stdin.end();
    });
}

// ═══════════════════════════════════════════════════════════
// Categorización inteligente con Gemini AI (batch)
// ═══════════════════════════════════════════════════════════
async function geminiCategorize(invoices: any[], indices: number[], geminiKey: string): Promise<void> {
    if (indices.length === 0 || !geminiKey) return;

    try {
        const descriptions = indices.map(i =>
            `${invoices[i].nombre_emisor} (${invoices[i].nombre_comercial || 'S/N'})`
        ).join('\n');

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Eres un clasificador de gastos para un restaurante en Guatemala.
Para cada proveedor listado abajo, asigna EXACTAMENTE UNA categoría de esta lista:
${CATEGORIES.join(', ')}

Proveedores a clasificar:
${descriptions}

IMPORTANTE: Responde ÚNICAMENTE con un JSON array de strings. Cada string debe ser el nombre exacto de una categoría de la lista. El array debe tener ${indices.length} elementos, uno por proveedor, en el mismo orden.
Ejemplo de respuesta: ["Gas y energía", "Materia prima cocina", "Otros"]`
                        }]
                    }],
                    generationConfig: { temperature: 0.1 }
                })
            }
        );

        if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const match = text.match(/\[[\s\S]*?\]/);
            if (match) {
                const categories: string[] = JSON.parse(match[0]);
                indices.forEach((invIdx, j) => {
                    if (categories[j] && CATEGORIES.includes(categories[j])) {
                        invoices[invIdx].category = categories[j];
                    }
                });
            }
        }
    } catch (e) {
        // Si Gemini falla, las facturas mantienen la categoría 'Otros' del regex
        console.warn('[SAT-SYNC] Gemini categorization failed:', e);
    }
}

// ═══════════════════════════════════════════════════════════
// Insertar facturas en Supabase via REST API
// ═══════════════════════════════════════════════════════════
async function insertToSupabase(
    invoices: any[],
    supabaseUrl: string,
    supabaseKey: string,
    tipo: 'recibida' | 'emitida' = 'recibida'
): Promise<{ imported: number; skipped: number; errors: number; summary: any }> {
    let imported = 0, skipped = 0, errors = 0;
    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
    };

    const tableName = tipo === 'emitida' ? 'sales_invoices' : 'purchase_invoices';
    
    // Acumuladores para el resumen del lote
    const summary = {
        periodo: invoices.length > 0 ? `${new Date(invoices[0].fecha).toLocaleString('es-GT', { month: 'long', year: 'numeric' })}` : 'N/A',
        total_documentos: invoices.length,
        por_tipo: {} as any,
        credito_fiscal_total: 0,
        credito_fiscal_no_deducible: 0,
        credito_fiscal_neto: 0,
        notas_credito_aplicar: 0,
        credito_fiscal_declarar: 0,
        idp_total_no_deducible: 0,
        isr_retenciones_enterar: 0,
        total_compras_brutas: 0,
        activos_fijos_detectados: 0,
        valor_activos_fijos: 0,
        documentos_revision_manual: 0,
        por_giro: {} as any,
        alertas_criticas: [] as string[]
    };

    // ── ACUMULADORES (BULK SYNC) ──
    const auditRecords: any[] = [];
    const opRecords: any[] = [];

    invoices.forEach((inv) => {
        try {
            // ── PASO AUDITORÍA ──
            const audit = parseAuditDTE(inv);
            
            // Actualizar Resumen
            summary.por_tipo[audit.tipo_dte] = (summary.por_tipo[audit.tipo_dte] || 0) + 1;
            summary.total_compras_brutas += audit.monto_total;
            
            if (audit.afecta_credito_fiscal) {
                if (audit.tipo_dte === 'NCRE') summary.notas_credito_aplicar -= audit.iva_monto;
                else summary.credito_fiscal_total += audit.iva_monto;
            }

            // Preparar Record Auditoría
            auditRecords.push({
                org_id: 'default',
                uuid_dte: audit.uuid,
                serie: audit.serie,
                numero: audit.numero,
                tipo_dte: audit.tipo_dte || (tipo === 'emitida' ? 'FACT' : 'DOC'),
                tipo_dte_descripcion: audit.tipo_dte_descripcion,
                fecha_emision: audit.fecha_emision,
                estado: audit.estado,
                emisor_nit: audit.emisor_nit,
                emisor_nombre: audit.emisor_nombre,
                receptor_nit: audit.receptor_nit,
                receptor_nombre: audit.receptor_nombre,
                monto_total: audit.monto_total,
                iva_monto: audit.iva_monto,
                iva_credito_fiscal: audit.iva_credito_fiscal,
                idp_monto: audit.idp_monto,
                impuesto_bebidas_alcoh: audit.impuesto_bebidas_alcoh,
                impuesto_bebidas_no_alcoh: audit.impuesto_bebidas_no_alcoh,
                isr_retenido: audit.isr_retenido,
                iva_retenido: audit.iva_retenido,
                items: audit.items,
                clasificacion_compra: audit.clasificacion_compra,
                categoria_gasto: audit.categoria_gasto,
                periodo_fiscal_mes: audit.periodo_fiscal_mes,
                periodo_fiscal_anio: audit.periodo_fiscal_anio,
                procesado_fecha: new Date().toISOString(),
                procesado_por: "Turbo Bulk Sync v3",
                xml_origen: audit.xml_origen
            });

            // Preparar Record Tabla Operativa
            const opBody: any = {
                org_id: 'default',
                invoice_date: inv.fecha || new Date().toISOString().split('T')[0],
                invoice_number: inv.serie && inv.numero ? `${inv.serie}-${inv.numero}` : (inv.uuid || '').slice(0, 12),
                description: `Turbo Sync SAT: ${inv.nombre_emisor}`,
                total_amount: audit.monto_total,
                iva_amount: audit.iva_credito_fiscal,
                net_amount: audit.monto_base_imponible,
                category: audit.categoria_gasto || (tipo === 'emitida' ? 'Ventas' : 'Otros'),
                fel_uuid: inv.uuid,
                items: inv.items || []
            };

            if (tipo === 'emitida') {
                opBody.customer_nit = inv.nit_emisor;
                opBody.customer_name = inv.nombre_emisor;
                opBody.status = audit.estado === 'ANULADO' ? 'annulled' : 'paid';
                opBody.tipo_dte = audit.tipo_dte || 'FACT';
            } else {
                opBody.supplier_nit = inv.nit_emisor;
                opBody.supplier_name = inv.nombre_emisor;
                opBody.tipo_dte = audit.tipo_dte;
                opBody.idp_monto = audit.idp_monto || 0;
                opBody.impuesto_bebidas_alcoh = audit.impuesto_bebidas_alcoh || 0;
                opBody.impuesto_bebidas_no_alcoh = audit.impuesto_bebidas_no_alcoh || 0;
                opBody.iva_retenido = audit.iva_retenido || 0;
                opBody.isr_retenido = audit.isr_retenido || 0;
                opBody.payment_status = 'paid';
            }
            opRecords.push(opBody);

        } catch (e) {
            console.error(`[TURBO-SYNC] Error preparando factura:`, e);
            errors++;
        }
    });

    // ── EJECUCIÓN BULK UPSERT (SOLO 2 LLAMADAS DE RED) ──
    try {
        if (auditRecords.length > 0) {
            const resAudit = await fetch(`${supabaseUrl}/rest/v1/historico_auditoria_sat?on_conflict=uuid_dte`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify(auditRecords)
            });
            if (!resAudit.ok) {
                const errText = await resAudit.text();
                console.error(`[TURBO-SYNC] Error insertando en auditoría: ${errText}`);
                errors += auditRecords.length;
            }
        }

        if (opRecords.length > 0) {
            const res = await fetch(`${supabaseUrl}/rest/v1/${tableName}?on_conflict=fel_uuid`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify(opRecords)
            });

            if (res.ok || res.status === 201 || res.status === 204) {
                imported = opRecords.length;
            } else {
                const errText = await res.text();
                console.error(`[TURBO-SYNC] Error insertando en ${tableName}: ${errText}`);
                errors += opRecords.length;
            }
        }
    } catch (e) {
        console.error(`[TURBO-SYNC] Error en Bulk Upsert:`, e);
        errors += opRecords.length + auditRecords.length;
    }

    // Cálculos finales del resumen
    summary.credito_fiscal_neto = summary.credito_fiscal_total;
    summary.credito_fiscal_declarar = summary.credito_fiscal_neto + summary.notas_credito_aplicar;

    return { imported, skipped, errors, summary };
}

// ═══════════════════════════════════════════════════════════
// PLUGIN DE VITE — Middleware /api/sat-sync
// ═══════════════════════════════════════════════════════════
export function satProxyPlugin(): Plugin {
    return {
        name: 'sat-proxy',
        configureServer(server) {
            server.middlewares.use('/api/sat-sync', async (req, res) => {
                // Solo POST
                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Método no permitido' }));
                    return;
                }

                // Leer body
                let body = '';
                for await (const chunk of req) {
                    body += chunk;
                }

                try {
                    const params = JSON.parse(body);
                    const {
                        username, password, dateStart, dateEnd,
                        supabaseUrl, supabaseKey, geminiKey, tipo = 'recibida',
                        action = 'sync'
                    } = params;

                    if (!username || !password || !dateStart || !dateEnd) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Faltan campos obligatorios: username, password, dateStart, dateEnd' }));
                        return;
                    }

                    // ── CASO ESPECIAL: Descarga de PDF de Retención ──
                    if (action === 'retenciones_pdf') {
                        console.log(`[SAT-SYNC] Descargando PDF de Retención ${params.numero}...`);
                        const satResult = await runPythonBridge(params);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(satResult));
                        return;
                    }

                    // ── PASO 1: Ejecutar Python Bridge ──
                    console.log(`[SAT-SYNC] Conectando con la SAT (Modo: ${tipo}${params.onlyRetenciones ? ' - EXCLUSIVO RETENCIONES' : ''})...`);
                    const satResult = await runPythonBridge({ 
                        username, password, dateStart, dateEnd, tipo, 
                        onlyRetenciones: params.onlyRetenciones 
                    });

                    if (!satResult.success) {
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: satResult.error }));
                        return;
                    }

                    const invoices = satResult.invoices || [];
                    console.log(`[SAT-SYNC] ${invoices.length} facturas ${tipo} obtenidas de la SAT`);

                    if (invoices.length === 0) {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({
                            success: true, total: 0, imported: 0, skipped: 0, errors: 0,
                            message: 'No se encontraron facturas en el rango de fechas seleccionado.'
                        }));
                        return;
                    }

                    // ── PASO 2: Categorización (Regex + Gemini AI) SOLO para Compras ──
                    if (tipo === 'recibida') {
                        const uncategorized: number[] = [];
                        for (let i = 0; i < invoices.length; i++) {
                            const searchText = `${invoices[i].nombre_emisor} ${invoices[i].nombre_comercial || ''}`;
                            const cat = autoCategorize(searchText);
                            invoices[i].category = cat;
                            if (cat === 'Otros') uncategorized.push(i);
                        }

                        console.log(`[SAT-SYNC] Regex categorizó ${invoices.length - uncategorized.length}/${invoices.length} facturas. ${uncategorized.length} pendientes para Gemini.`);

                        if (uncategorized.length > 0 && geminiKey) {
                            await geminiCategorize(invoices, uncategorized, geminiKey);
                            const stillOtros = invoices.filter((inv: any) => inv.category === 'Otros').length;
                            console.log(`[SAT-SYNC] Después de Gemini: ${stillOtros} facturas quedaron como "Otros"`);
                        }
                    } else {
                        // Es Emitida (Venta), forzar categoría Ventas
                        invoices.forEach((inv: any) => { inv.category = 'Venta Facturada'; });
                    }

                    // ── PASO 3: Insertar en Supabase ──
                    let imported = 0, skipped = 0, errors = 0;
                    if (supabaseUrl && supabaseKey) {
                        const result = await insertToSupabase(invoices, supabaseUrl, supabaseKey, tipo);
                        imported = result.imported;
                        skipped = result.skipped;
                        errors = result.errors;
                        // @ts-ignore
                        const batchSummary = result.summary;
                        console.log(`[SAT-SYNC] Auditoría completada. Crédito Fiscal Neto: Q${batchSummary.credito_fiscal_neto}`);
                        
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({
                            success: true,
                            total: invoices.length,
                            imported,
                            skipped,
                            errors,
                            resumen_lote: batchSummary,
                            details: invoices.map((inv: any) => ({
                                nombre: inv.nombre_emisor,
                                total: inv.total,
                                categoria: inv.category,
                                uuid: inv.uuid
                            }))
                        }));
                        return;
                    }

                    // ── RESPUESTA ──
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        success: true,
                        total: invoices.length,
                        imported,
                        skipped,
                        errors,
                        details: invoices.map((inv: any) => ({
                            nombre: inv.nombre_emisor,
                            total: inv.total,
                            categoria: inv.category,
                            uuid: inv.uuid
                        }))
                    }));

                } catch (e: any) {
                    console.error('[SAT-SYNC] Error:', e.message);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
        }
    };
}
