const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data: cols, error } = await supabase.rpc('get_schema_columns', { table_name: 'product_branch_prices' });
    if (error) {
        console.log("Error finding columns via rpc");
        // Alternative table check
        const { data: pbp } = await supabase.from('product_branch_prices').select('*').limit(1);
        console.log("product_branch_prices sample:", pbp);
        
        const { data: inv } = await supabase.from('inventory_item_branches').select('*').limit(1);
        console.log("inventory_item_branches sample:", inv);
    } else {
        console.log(cols);
    }
}
run();
