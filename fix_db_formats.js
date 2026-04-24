const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDB() {
    console.log("Cleaning and formatting statuses in Supabase...");

    // 1. Estandarizar Anuladas (Purchases)
    const { error: e1 } = await supabase.rpc('execute_sql', { 
        query: `UPDATE purchase_invoices SET status = 'annulled' WHERE status IN ('Anulado', 'anulado', 'A') OR description ILIKE '%ANULAD%';`
    });
    // Si no tenemos funcion execute_sql, usamos metodos nativos
    
    // Purchases: status -> annulled
    const { data: pAnnulled } = await supabase.from('purchase_invoices')
        .select('id, status, description');
    
    let pUpdates = 0;
    for (const p of (pAnnulled || [])) {
        if (p.status === 'Anulado' || p.status === 'A' || p.status === 'anulado' || (p.description && p.description.toLowerCase().includes('anulad'))) {
            await supabase.from('purchase_invoices').update({ status: 'annulled' }).eq('id', p.id);
            pUpdates++;
        }
    }
    console.log(`Updated ${pUpdates} purchase invoices to annulled state.`);

    // Sales: status -> annulled
    const { data: sAnnulled } = await supabase.from('sales_invoices')
        .select('id, status, description');
    let sUpdates = 0;
    for (const s of (sAnnulled || [])) {
        if (s.status === 'Anulado' || s.status === 'A' || s.status === 'anulado' || (s.description && s.description.toLowerCase().includes('anulad'))) {
            await supabase.from('sales_invoices').update({ status: 'annulled' }).eq('id', s.id);
            sUpdates++;
        }
    }
    console.log(`Updated ${sUpdates} sales invoices to annulled state.`);

    // 2. Corregir Tipos (Purchases)
    const { data: pItems } = await supabase.from('purchase_invoices').select('id, description, tipo_dte');
    let dtUpdates = 0;
    for (const p of (pItems || [])) {
        if (!p.description) continue;
        const desc = p.description.toUpperCase();
        let correctType = null;
        if (desc.includes('NCRE')) correctType = 'NCRE';
        else if (desc.includes('FPEQ')) correctType = 'FPEQ';
        else if (desc.includes('FCAM')) correctType = 'FCAM';
        else if (desc.includes('NABN')) correctType = 'NABN';
        else if (desc.includes('FESP')) correctType = 'FESP';
        
        if (correctType && p.tipo_dte !== correctType) {
            await supabase.from('purchase_invoices').update({ tipo_dte: correctType }).eq('id', p.id);
            dtUpdates++;
        }
    }
    console.log(`Updated ${dtUpdates} purchase DTE types based on description.`);

    // 3. Corregir Tipos (Sales)
    const { data: sItems } = await supabase.from('sales_invoices').select('id, description, tipo_dte');
    let stUpdates = 0;
    for (const s of (sItems || [])) {
        if (!s.description) continue;
        const desc = s.description.toUpperCase();
        let correctType = null;
        if (desc.includes('NCRE')) correctType = 'NCRE';
        else if (desc.includes('FPEQ')) correctType = 'FPEQ';
        else if (desc.includes('FCAM')) correctType = 'FCAM';
        else if (desc.includes('NABN')) correctType = 'NABN';
        
        if (correctType && s.tipo_dte !== correctType) {
            await supabase.from('sales_invoices').update({ tipo_dte: correctType }).eq('id', s.id);
            stUpdates++;
        }
    }
    console.log(`Updated ${stUpdates} sales DTE types based on description.`);

    console.log("Database clean completed!");
}

cleanDB();
