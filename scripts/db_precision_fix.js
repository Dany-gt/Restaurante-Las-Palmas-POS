const SUPABASE_URL = 'https://cofdsbczmrkriohlgyct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function repair() {
    console.log('🧹 Limpiando precisión decimal en la base de datos...');

    try {
        // 1. Reparar purchase_invoices
        const resPI = await fetch(`${SUPABASE_URL}/rest/v1/purchase_invoices?select=id,total_amount,iva_amount,net_amount`, { headers });
        const piRecords = await resPI.json();
        for (const r of piRecords) {
            const rt = parseFloat(Number(r.total_amount).toFixed(2));
            const ri = parseFloat(Number(r.iva_amount).toFixed(2));
            const rn = parseFloat(Number(r.net_amount).toFixed(2));
            
            if (rt !== Number(r.total_amount) || ri !== Number(r.iva_amount) || rn !== Number(r.net_amount)) {
                await fetch(`${SUPABASE_URL}/rest/v1/purchase_invoices?id=eq.${r.id}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ total_amount: rt, iva_amount: ri, net_amount: rn })
                });
            }
        }

        // 2. Reparar historico_auditoria_sat
        const resAudit = await fetch(`${SUPABASE_URL}/rest/v1/historico_auditoria_sat?select=id,monto_total,iva_monto,idp_monto,monto_base_imponible`, { headers });
        const auditRecords = await resAudit.json();
        for (const r of auditRecords) {
            const rt = parseFloat(Number(r.monto_total).toFixed(2));
            const ri = parseFloat(Number(r.iva_monto).toFixed(2));
            const ridp = parseFloat(Number(r.idp_monto).toFixed(2));
            const rb = parseFloat(Number(r.monto_base_imponible).toFixed(2));
            
            if (rt !== Number(r.monto_total) || ri !== Number(r.iva_monto) || ridp !== Number(r.idp_monto) || rb !== Number(r.monto_base_imponible)) {
                await fetch(`${SUPABASE_URL}/rest/v1/historico_auditoria_sat?id=eq.${r.id}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ monto_total: rt, iva_monto: ri, idp_monto: ridp, monto_base_imponible: rb })
                });
            }
        }

        console.log('✨ Base de datos saneada con éxito.');
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

repair();
