const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

(async () => {
    const start = '2026-03-30T00:00:00.000Z'; // wider range to be safe
    const end = '2026-04-01T23:59:59.999Z';
    
    // Test invoices
    let { data: allInvoices, error: invError } = await supabase
        .from('invoices')
        .select('*, orders!inner(*)')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });
        
    console.log("Invoices error:", invError);
    console.log("Invoices count:", allInvoices ? allInvoices.length : 0);
    
    // Test orders marked as contingency
    let { data: contingencyOrders, error: ordError } = await supabase
        .from('orders')
        .select('*')
        .eq('is_contingency', true)
        .gte('created_at', start)
        .lte('created_at', end);
        
    console.log("Orders error:", ordError);
    console.log("Contingency orders count:", contingencyOrders ? contingencyOrders.length : 0);
    
    if (allInvoices) {
        const invoiceContingency = allInvoices.filter(inv =>
            !inv.uuid ||
            inv.uuid === '' ||
            inv.series === 'CONT' ||
            (inv.document_number && inv.document_number.includes('PEND'))
        );
        console.log("Invoice contingency count:", invoiceContingency.length);
    }
})();
