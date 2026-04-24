const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

(async () => {
    let { data: latestInvoices } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2);
        
    console.dir(latestInvoices, { depth: null });
    
    let { data: latestOrders } = await supabase
        .from('orders')
        .select('id, order_number, created_at, status, total, is_contingency, updated_at')
        .order('updated_at', { ascending: false })
        .limit(3);
        
    console.log("Latest orders by updated_at:", latestOrders);
})();
