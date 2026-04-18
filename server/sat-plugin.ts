import type { Plugin } from 'vite';
import { spawn } from 'child_process';
import path from 'path';
import { parseAuditDTE } from '../utils/satAuditParser';

// ═══════════════════════════════════════════════════════════
// Configuración Global y Pool de IA
// ═══════════════════════════════════════════════════════════

const CATEGORIES = [
    'Materia prima cocina', 'Materia prima cevichería', 'Materia prima bebidas',
    'Gas y energía', 'Limpieza y desechables', 'Mantenimiento',
    'Servicios profesionales', 'Otros'
];

/**
 * Llama al pool de llaves configurado con rotación y fallback de modelos.
 * NO USA BACKTICKS para evitar errores de compilación local.
 */
async function callAIPool(prompt: string, model: string = 'gemini-2.0-flash', temperature: number = 0.7, keys: string[] = []): Promise<string> {
    if (keys.length === 0) return '';

    const modelsToTry = [model];
    if (model === 'gemini-2.0-flash') {
        modelsToTry.push('gemini-1.5-flash', 'gemini-flash-latest');
    }

    let lastError = '';
    for (const currentModel of modelsToTry) {
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            try {
                const response = await fetch(
                    'https://generativelanguage.googleapis.com/v1beta/models/' + currentModel + ':generateContent?key=' + key,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature }
                        })
                    }
                );

                const data = await response.json();
                if (response.ok) {
                    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                } else {
                    lastError = data.error?.message || 'Error desconocido';
                    console.warn('[AI-POOL] Falló ' + currentModel + ' (llave ' + (i + 1) + '): ' + lastError);
                }
            } catch (e: any) {
                lastError = e.message;
                console.warn('[AI-POOL] Error red ' + currentModel + ': ' + e.message);
            }
        }
    }
    return '';
}

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

function runPythonBridge(params: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(process.cwd(), 'server', 'sat_bridge.py');
        const proc = spawn('python', [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 600000 
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');
        proc.stdout.on('data', (data: string) => { stdout += data; });
        proc.stderr.on('data', (data: string) => { stderr += data; });

        proc.on('error', (err: Error) => {
            if (err.message.indexOf('ENOENT') !== -1) {
                reject(new Error('Python no está instalado o no se encuentra en el PATH.'));
            } else {
                reject(new Error('Error ejecutando Python: ' + err.message));
            }
        });

        proc.on('close', (code: number) => {
            if (code !== 0 && !stdout.trim()) {
                reject(new Error(stderr || 'Python termino con codigo ' + code));
                return;
            }
            try {
                const result = JSON.parse(stdout.trim());
                resolve(result);
            } catch (e) {
                reject(new Error('Respuesta invalida del script SAT.'));
            }
        });

        proc.stdin.write(JSON.stringify(params));
        proc.stdin.end();
    });
}

// ═══════════════════════════════════════════════════════════
// Categorización inteligente con Gemini AI (batch)
// ═══════════════════════════════════════════════════════════
async function geminiCategorize(invoices: any[], indices: number[], keys: string[]): Promise<void> {
    if (indices.length === 0 || keys.length === 0) return;

    const descriptions = indices.map(i =>
        (invoices[i].nombre_emisor || 'PROVEEDOR') + ' (' + (invoices[i].nombre_comercial || 'S/N') + ')'
    ).join('\n');

    const prompt = 'Eres un clasificador de gastos para un restaurante en Guatemala.\n' +
        'Para cada proveedor listado abajo, asigna EXACTAMENTE UNA categoría de esta lista:\n' +
        CATEGORIES.join(', ') + '\n\n' +
        'Proveedores a clasificar:\n' +
        descriptions + '\n\n' +
        'IMPORTANTE: Responde ÚNICAMENTE con un JSON array de strings. El array debe tener ' + indices.length + ' elementos.';

    const aiText = await callAIPool(prompt, 'gemini-2.0-flash', 0.1, keys);
    if (!aiText) return;

    try {
        const match = aiText.match(/\[[\s\S]*?\]/);
        if (match) {
            const categories: string[] = JSON.parse(match[0]);
            indices.forEach((invIdx, j) => {
                if (categories[j] && CATEGORIES.includes(categories[j])) {
                    invoices[invIdx].category = categories[j];
                }
            });
        }
    } catch (e) {
        console.warn('[SAT-SYNC] Error parseando respuesta de Gemini:', e);
    }
}

// ═══════════════════════════════════════════════════════════
// Supabase Bulk Insert
// ═══════════════════════════════════════════════════════════
async function insertToSupabase(invoices: any[], supabaseUrl: string, supabaseKey: string, tipo: string): Promise<any> {
    let imported = 0, skipped = 0, errors = 0;
    const headers = {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    };

    const tableName = tipo === 'emitida' ? 'sales_invoices' : 'purchase_invoices';
    const auditRecords: any[] = [];
    const opRecords: any[] = [];

    invoices.forEach(inv => {
        try {
            const audit: any = parseAuditDTE(inv, tipo);
            const auditBody: any = {
                org_id: 'default',
                uuid_dte: audit.uuid,
                serie: audit.serie,
                numero: audit.numero,
                fecha_emision: audit.fecha_emision,
                fecha_certificacion: audit.fecha_certificacion,
                nit_emisor: audit.nit_emisor,
                nombre_emisor: audit.nombre_emisor,
                nit_receptor: audit.nit_receptor,
                nombre_receptor: audit.nombre_receptor,
                estado: audit.estado,
                moneda: audit.moneda,
                monto_total: audit.monto_total,
                monto_base_imponible: audit.monto_base_imponible,
                iva_monto: audit.iva_monto,
                iva_credito_fiscal: audit.iva_credito_fiscal,
                idp_monto: audit.idp_monto,
                isr_retenido: audit.isr_retenido || 0,
                items: audit.items,
                clasificacion_compra: audit.clasificacion_compra,
                categoria_gasto: audit.categoria_gasto,
                regimen_tributario: audit.regimen_tributario,
                anulado_fecha: audit.anulado_fecha,
                procesado_fecha: new Date().toISOString(),
                procesado_por: "Turbo Bulk Sync v3",
                xml_origen: audit.xml_origen
            };

            auditRecords.push(auditBody);

            const opBody: any = {
                org_id: 'default',
                invoice_date: inv.fecha || new Date().toISOString().split('T')[0],
                invoice_number: (inv.serie && inv.numero) ? (inv.serie + '-' + inv.numero) : (inv.uuid || '').slice(0, 12),
                description: 'Turbo Sync SAT: ' + inv.nombre_emisor,
                total_amount: audit.monto_total,
                iva_amount: audit.iva_credito_fiscal,
                net_amount: audit.monto_base_imponible,
                category: inv.category || audit.categoria_gasto || (tipo === 'emitida' ? 'Venta Facturada' : 'Otros'),
                fel_uuid: inv.uuid,
                items: inv.items || []
            };

            if (tipo === 'emitida') {
                opBody.customer_nit = inv.nit_emisor;
                opBody.customer_name = inv.nombre_emisor;
                opBody.status = audit.estado === 'ANULADO' ? 'annulled' : 'paid';
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
        } catch (e) { errors++; }
    });

    try {
        if (auditRecords.length > 0) {
            await fetch(supabaseUrl + '/rest/v1/historico_auditoria_sat?on_conflict=uuid_dte', {
                method: 'POST', headers, body: JSON.stringify(auditRecords)
            });
        }
        if (opRecords.length > 0) {
            const res = await fetch(supabaseUrl + '/rest/v1/' + tableName + '?on_conflict=fel_uuid', {
                method: 'POST', headers, body: JSON.stringify(opRecords)
            });
            if (res.ok) {
                imported = opRecords.length;
            } else {
                const errText = await res.text();
                console.error('[SAT-SYNC] Supabase Insert Error (' + tableName + '):', errText);
                errors += opRecords.length;
            }
        }
    } catch (e: any) {
        console.error('[SAT-SYNC] Catch Insert Error:', e);
        errors += opRecords.length;
    }

    return { imported, skipped, errors, summary: { credito_fiscal_neto: 0 } };
}

// ═══════════════════════════════════════════════════════════
// PLUGIN DE VITE
// ═══════════════════════════════════════════════════════════
export function satProxyPlugin(env: Record<string, string> = {}): Plugin {
    const getAIKeys = () => {
        const keys = [
            process.env.GOOGLE_API_KEY || env.GOOGLE_API_KEY,
            process.env.GOOGLE_API_KEY_2 || env.GOOGLE_API_KEY_2 || process.env.VITE_GEMINI_API_KEY,
            process.env.GOOGLE_API_KEY_3 || env.GOOGLE_API_KEY_3,
            process.env.GOOGLE_API_KEY_4 || env.GOOGLE_API_KEY_4
        ].filter(k => k && k.startsWith('AQ.'));
        return Array.from(new Set(keys));
    };

    return {
        name: 'sat-proxy',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url?.startsWith('/api/ai/generate')) {
                    let body = '';
                    for await (const chunk of req) { body += chunk; }
                    try {
                        const { model, prompt, temperature } = JSON.parse(body);
                        const keys = getAIKeys();
                        const text = await callAIPool(prompt, model, temperature, keys);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: !!text, text }));
                    } catch (e) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: 'Error AI Proxy' }));
                    }
                    return;
                }
                next();
            });

            server.middlewares.use('/api/sat-sync', async (req, res) => {
                if (req.method !== 'POST') return next();
                let body = '';
                for await (const chunk of req) { body += chunk; }
                try {
                    const params = JSON.parse(body);
                    const { username, password, dateStart, dateEnd, supabaseUrl, supabaseKey, tipo = 'recibida', action = 'sync' } = params;

                    if (action === 'retenciones_pdf') {
                        const result = await runPythonBridge(params);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(result));
                        return;
                    }

                    const satResult = await runPythonBridge({ username, password, dateStart, dateEnd, tipo });
                    if (!satResult.success) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: satResult.error }));
                        return;
                    }

                    const invoices = satResult.invoices || [];
                    if (tipo === 'recibida') {
                        const uncategorized: number[] = [];
                        invoices.forEach((inv: any, i: number) => {
                            inv.category = autoCategorize(inv.nombre_emisor + ' ' + (inv.nombre_comercial || ''));
                            if (inv.category === 'Otros') uncategorized.push(i);
                        });
                        if (uncategorized.length > 0) {
                            await geminiCategorize(invoices, uncategorized, getAIKeys());
                        }
                    }

                    const result = await insertToSupabase(invoices, supabaseUrl, supabaseKey, tipo);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, ...result, total: invoices.length }));
                } catch (e: any) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
        }
    };
}
