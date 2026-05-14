
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportSchema() {
    console.log('Querying information_schema for order_payments...');
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'order_payments' });

    // If RPC doesn't exist, we'll try a direct select if we have permissions, 
    // but usually rpc is needed for information_schema.
    // Let's try select from a system view if possible, or just guess.

    const { data: cols, error: err } = await supabase.from('order_payments').select('*').limit(0);
    if (err) {
        console.error('Error selecting from order_payments:', err.message);
    } else {
        console.log('order_payments found.');
    }
}

exportSchema();
