const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

(async () => {
    console.log("Fetching latest invoices...");
    let { data: latestInvoices, error: invError } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
        
    console.log("Invoices error:", invError);
    console.log("Latest invoices:", latestInvoices);
    
    console.log("\nFetching latest orders...");
    let { data: latestOrders, error: ordError } = await supabase
        .from('orders')
        .select('id, created_at, status, total, is_contingency')
        .order('created_at', { ascending: false })
        .limit(5);
        
    console.log("Orders error:", ordError);
    console.log("Latest orders:", latestOrders);
})();
