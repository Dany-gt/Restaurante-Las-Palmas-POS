const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('inventory_items').select('*').limit(1);
    console.log('Sample Item:', data);

    // Check column types using a direct SQL query via RPC or if possible
    const { data: cols, error: err2 } = await supabase.rpc('get_column_info', { t_name: 'inventory_items' });
    if (err2) {
        // Fallback: try to see if we can get it from information_schema
        const { data: schema, error: err3 } = await supabase.from('information_schema.columns')
            .select('column_name, data_type, numeric_precision, numeric_scale')
            .eq('table_name', 'inventory_items');
        console.log('Columns:', schema || err3);
    } else {
        console.log('Columns:', cols);
    }
}

check();
