const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("--- COMPRAS (RECIBIDAS) ---");
    const { data: p } = await supabase.from('purchase_invoices').select('invoice_number, tipo_dte, status, description, supplier_name').gte('invoice_date', '2026-04-01');
    for (let c of p || []) {
        if (c.tipo_dte !== 'FACT' || c.status !== 'pending' && c.status !== 'paid') {
            console.log(`COMPRA DIFERENTE: ${c.supplier_name} -> Tipo: ${c.tipo_dte}, Status: ${c.status}`);
        }
    }
    console.log(`Verificadas ${p?.length} compras.`);

    console.log("\n--- VENTAS (EMITIDAS) ---");
    const { data: s } = await supabase.from('sales_invoices').select('invoice_number, tipo_dte, status, description').gte('invoice_date', '2026-04-01');
    let diffSales = 0;
    for (let c of s || []) {
        if (c.tipo_dte !== 'FACT' || c.status !== 'paid' && c.status !== 'pending') {
            diffSales++;
        }
    }
    console.log(`Verificadas ${s?.length} ventas. Ventas diferentes a FACT/paid: ${diffSales}`);

    console.log("\n--- AUDIT TABLE ---");
    const { data: a } = await supabase.from('historico_auditoria_sat').select('estado, tipo_dte, emisor_nombre').gte('fecha_emision', '2026-04-01');
    let diffAudit = 0;
    for (let c of a || []) {
        if (c.estado !== 'VIGENTE' || c.tipo_dte !== 'FACT') {
            console.log(`AUDIT DIFERENTE: ${c.emisor_nombre} -> Tipo: ${c.tipo_dte}, Estado: ${c.estado}`);
            diffAudit++;
        }
    }
    console.log(`Verificados ${a?.length} audits. Diferentes: ${diffAudit}`);
}

check();
