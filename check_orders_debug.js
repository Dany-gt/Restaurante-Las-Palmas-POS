const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'service-role-key-needed-for-sql';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('payment_method, total, invoice_uuid')
        .eq('status', 'completed')
        .gte('created_at', '2026-04-01')
        .lte('created_at', '2026-04-30T23:59:59');
    
    if (error) {
        console.error(error);
        return;
    }
    
    const summary = data.reduce((acc, o) => {
        const pm = (o.payment_method || 'null').toLowerCase();
        acc[pm] = (acc[pm] || 0) + Number(o.total || 0);
        if (!o.invoice_uuid) acc[`${pm}_no_uuid`] = (acc[`${pm}_no_uuid`] || 0) + Number(o.total || 0);
        return acc;
    }, {});
    
    console.log(JSON.stringify(summary, null, 2));
}

checkOrders();
