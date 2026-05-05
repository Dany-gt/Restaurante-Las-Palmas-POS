import { spawn } from 'child_process';
import path from 'path';
import { parseAuditDTE, parseAuditXML } from '../utils/satAuditParser';

// ═══════════════════════════════════════════════════════════
// Funciones de Apoyo
// ═══════════════════════════════════════════════════════════

async function insertToSupabase(invoices: any[], supabaseUrl: string, supabaseKey: string, tipo: string, username: string): Promise<any> {
    let imported = 0, skipped = 0, errors = 0, lastError = '';
    const headers = { 
        'apikey': supabaseKey, 
        'Authorization': 'Bearer ' + supabaseKey, 
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    };

    // SOPORTE PARA PLURAL/SINGULAR
    const cleanTipo = tipo.toLowerCase().trim();
    const tableName = (cleanTipo === 'emitida' || cleanTipo === 'emitidas' || cleanTipo === 'ventas') 
                    ? 'sales_invoices' 
                    : 'purchase_invoices';
    
    console.log(`[SAT-DB] Destino detectado: ${tableName} (Tipo original: ${tipo})`);
    
    const opRecords: any[] = [];

    for (let rawInv of invoices) {
        // A veces Python devuelve el objeto dentro de una propiedad 'data' o similar
        const inv = rawInv.data || rawInv; 
        
        // Probamos todos los nombres posibles para el UUID
        const currentUuid = inv.uuid || inv.fel_uuid || inv.NumeroAutorizacion || inv.NumeroDocumento || inv.id;
        const currentXml = inv.xml_content || inv.xmlContent || inv.xml;

        try {
            let audit: any;
            if (currentXml && currentXml.includes('<?xml')) {
                console.log(`[SAT-TRACE] Procesando XML: ${currentUuid}...`);
                audit = await parseAuditXML(currentXml);
            } else {
                console.log(`[SAT-TRACE] Usando datos base para: ${currentUuid}`);
                audit = parseAuditDTE(inv);
            }
            
            const opBody: any = {
                org_id: inv.org_id || 'default',
                invoice_date: audit.fecha_emision || audit.fecha || inv.fechaEmision || new Date().toISOString().split('T')[0],
                invoice_number: (audit.serie && audit.numero) ? (audit.serie + '-' + audit.numero) : (currentUuid || '').slice(0, 8),
                description: audit.emisor_nombre || audit.nombre_emisor || inv.nombreEmisor || inv.nombre_emisor || 'Factura SAT',
                total_amount: Number(audit.monto_total || audit.total || inv.total || 0),
                iva_amount: Number(audit.iva_monto || inv.montoIva || 0),
                net_amount: Number(audit.monto_base_imponible || 0),
                category: inv.category || (cleanTipo.includes('emit') || cleanTipo.includes('venta') ? 'Ventas' : 'Compras'),
                fel_uuid: audit.uuid || currentUuid,
                status: (audit.estado === 'ANULADO' || audit.estado === 'annulled') ? 'annulled' : 'paid',
                idp_monto: Number(audit.idp_monto || 0),
                iva_retenido: Number(audit.iva_retenido || 0),
                isr_retenido: Number(audit.isr_retenido || 0),
                tipo_dte: audit.tipo_dte || inv.tipoDocumento || 'FACT',
                // ▼ ITEMS: Prioridad 1 = XML parser (audit.items), Prioridad 2 = Python regex (inv.items)
                items: (() => {
                    // Los items del XML parser (TypeScript) con tipo completo
                    if (Array.isArray(audit.items) && audit.items.length > 0) {
                        return audit.items.map((it: any) => ({
                            cantidad: it.cantidad || 1,
                            descripcion: it.descripcion || 'S/D',
                            precio_unitario: it.precio_unitario || 0,
                            total: it.precio_total || it.total || 0
                        }));
                    }
                    // Fallback: los items que Python ya extrajo del XML con Regex
                    if (Array.isArray(inv.items) && inv.items.length > 0) {
                        return inv.items;
                    }
                    // Fallback 2: detalles (nombre alternativo)
                    if (Array.isArray(inv.detalles) && inv.detalles.length > 0) {
                        return inv.detalles;
                    }
                    return [];
                })()
            };

            if (tableName === 'purchase_invoices') {
                opBody.supplier_nit = audit.emisor_nit || audit.nit_emisor || inv.nit_emisor || inv.nitEmisor;
                opBody.supplier_name = audit.emisor_nombre || audit.nombre_emisor || inv.nombre_emisor || inv.nombreEmisor;
            } else {
                opBody.customer_nit = audit.receptor_nit || audit.nit_receptor || inv.nit_receptor;
                opBody.customer_name = audit.receptor_nombre || audit.nombre_receptor || inv.nombre_receptor;
            }

            console.log(`[SAT-ITEMS] ${opBody.fel_uuid?.slice(0,8)} → ${opBody.items?.length || 0} productos | Total: Q${opBody.total_amount}`);

            if (!opBody.fel_uuid) throw new Error("Falta UUID");
            opRecords.push(opBody);

        } catch (e: any) {
            console.error(`[SAT-TRACE-FAIL] Fallo en factura:`, e.message);
            lastError = `Fallo en análisis: ${e.message}`;
            errors++;
        }
    }

    try {
        if (opRecords.length > 0) {
            // ══ DIAGNÓSTICO: Ver exactamente qué se envía a Supabase ══
            const firstRec = opRecords[0];
            console.log(`\n[SAT-DIAGNOSTIC] ══════════════════════════════════`);
            console.log(`[SAT-DIAGNOSTIC] Tabla destino: ${tableName}`);
            console.log(`[SAT-DIAGNOSTIC] Total registros a guardar: ${opRecords.length}`);
            console.log(`[SAT-DIAGNOSTIC] Primer registro:`);
            console.log(`  UUID:        ${firstRec.fel_uuid}`);
            console.log(`  Descripción: ${firstRec.description}`);
            console.log(`  Total:       Q${firstRec.total_amount}`);
            console.log(`  Items count: ${firstRec.items?.length || 0}`);
            if (firstRec.items?.length > 0) {
                console.log(`  Items[0]:    ${JSON.stringify(firstRec.items[0])}`);
            }
            console.log(`[SAT-DIAGNOSTIC] Columnas enviadas: ${Object.keys(firstRec).join(', ')}`);
            console.log(`[SAT-DIAGNOSTIC] ══════════════════════════════════\n`);

            const res = await fetch(supabaseUrl + '/rest/v1/' + tableName + '?on_conflict=fel_uuid', {
                method: 'POST', headers, body: JSON.stringify(opRecords)
            });
            if (res.ok) {
                imported = opRecords.length;
                console.log(`[SAT-DB] ✅ ¡Éxito! ${imported} registros guardados en ${tableName}.`);
            } else {
                const errBody = await res.text();
                lastError = `DB (${res.status}): ${errBody}`;
                console.error(`[SAT-DB-REJECT] Supabase dice:`, errBody);
                errors += opRecords.length;
            }
        }
    } catch (e: any) {
        lastError = `Conexión: ${e.message}`;
        console.error("[SAT-DB-CRIT] Error de conexión:", e);
        errors += opRecords.length;
    }

    return { imported, errors, lastError };
}

// ═══════════════════════════════════════════════════════════
// Plugin de Vite
// ═══════════════════════════════════════════════════════════

export function satProxyPlugin() {
    return {
        name: 'sat-proxy-plugin',
        configureServer(server: any) {
            console.log('\x1b[32m[SAT-INFO] Canal de Sincronización SAT Activado\x1b[0m');
            
            server.middlewares.use(async (req: any, res: any, next: any) => {
                // DETALLES O SINCRONIZACIÓN
                const isSync = req.url.startsWith('/api/sat/sync');
                const isDetail = req.url.startsWith('/api/sat/detail');

                if ((isSync || isDetail) && req.method === 'POST') {
                    let body = '';
                    req.on('data', (chunk: any) => body += chunk.toString());
                    req.on('end', async () => {
                        try {
                            const params = JSON.parse(body);
                            const pythonPath = 'python';
                            const bridgePath = path.join(process.cwd(), 'server', 'sat_bridge.py');

                            const py = spawn(pythonPath, [bridgePath]);
                            let stdout = '';
                            let stderr = '';

                            py.stdin.write(body);
                            py.stdin.end();

                            py.stdout.on('data', (data) => stdout += data.toString());
                            py.stderr.on('data', (data) => stderr += data.toString());

                            py.on('close', async (code) => {
                                res.setHeader('Content-Type', 'application/json');
                                
                                if (code !== 0) {
                                    res.writeHead(500);
                                    return res.end(JSON.stringify({ success: false, error: stderr || 'Error en Python' }));
                                }

                                try {
                                    if (stdout.length < 10) {
                                        console.error("[SAT-ERROR] Python mandó respuesta vacía o muy corta:", stdout);
                                    }
                                    const satResult = JSON.parse(stdout.trim());
                                    
                                    if (satResult.success && satResult.invoices?.length > 0) {
                                        console.log(`[SAT-DEBUG] Procesando ${satResult.invoices.length} facturas recibidas de Python`);
                                    }

                                    // Si es solo detalle, devolvemos directo lo que diga Python
                                    if (isDetail) {
                                        res.writeHead(200);
                                        return res.end(JSON.stringify(satResult));
                                    }

                                    // Si es sincronización, guardamos en DB antes de responder
                                    if (!satResult.success) {
                                        res.writeHead(200);
                                        return res.end(JSON.stringify(satResult));
                                    }

                                    const dbResult = await insertToSupabase(
                                        satResult.invoices || [], 
                                        params.supabaseUrl, 
                                        params.supabaseKey, 
                                        params.tipo,
                                        params.username
                                    );

                                    res.writeHead(200);
                                    res.end(JSON.stringify({
                                        success: true,
                                        ...dbResult,
                                        total: satResult.total
                                    }));
                                } catch (e) {
                                    res.writeHead(500);
                                    res.end(JSON.stringify({ success: false, error: 'Error procesando respuesta de la SAT' }));
                                }
                            });
                        } catch (e) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ success: false, error: 'Cuerpo de petición inválido' }));
                        }
                    });
                } else {
                    next();
                }
            });
        }
    };
}
