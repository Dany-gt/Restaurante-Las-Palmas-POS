const SUPABASE_URL = 'https://cofdsbczmrkriohlgyct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function fix() {
    console.log('⛽ Refinando Auditoría de Combustibles (IDP)...');

    try {
        // 1. Obtener registros de Auditoría con IDP sospechoso (No son giro COMBUSTIBLE)
        const resAudit = await fetch(`${SUPABASE_URL}/rest/v1/historico_auditoria_sat?idp_monto=gt.0&emisor_giro=neq.COMBUSTIBLE&select=*`, { headers });
        const suspected = await resAudit.json();

        console.log(`📋 ${suspected.length} registros sospechosos encontrados.`);

        let auditUpdated = 0;
        let piUpdated = 0;

        for (const rec of suspected) {
            // Verificar si el IDP es realmente un error por "GAS" o similar
            // Para UNISUPER y otros supermercados, forzamos a 0 si no es combustible real
            
            const total = rec.monto_total;
            const affectsIVA = rec.afecta_credito_fiscal;
            
            // Recalcular base e IVA sin IDP
            const base = affectsIVA ? total / 1.12 : total;
            const iva = affectsIVA ? (total / 1.12 * 0.12) : 0;

            console.log(`🔧 Corrigiendo: ${rec.emisor_nombre} (Q${total}) -> Eliminando IDP (Q${rec.idp_monto})`);

            // 3. Actualizar historico_auditoria_sat
            const patchAudit = await fetch(`${SUPABASE_URL}/rest/v1/historico_auditoria_sat?id=eq.${rec.id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    idp_monto: 0,
                    iva_credito_fiscal: Number(iva.toFixed(2)),
                    iva_monto: Number(iva.toFixed(2)),
                    monto_base_imponible: Number(base.toFixed(2)),
                    cuenta_contable: '5101',
                    cuenta_contable_nombre: 'Materia prima y suministros',
                    categoria_gasto: 'MATERIA_PRIMA',
                    alertas: rec.alertas.filter(a => !a.includes('IDP'))
                })
            });
            if (patchAudit.ok) auditUpdated++;

            // 4. Actualizar purchase_invoices si existe
            const patchPI = await fetch(`${SUPABASE_URL}/rest/v1/purchase_invoices?fel_uuid=eq.${encodeURIComponent(rec.uuid_dte)}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    iva_amount: Number(iva.toFixed(2)),
                    net_amount: Number(base.toFixed(2))
                })
            });
            if (patchPI.ok) piUpdated++;
        }

        console.log(`✨ Refinamiento completado. Auditoría: ${auditUpdated}, Compras: ${piUpdated}.`);
    } catch (e) {
        console.error('❌ Error en el refinamiento:', e.message);
    }
}

fix();
