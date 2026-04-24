require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase credentials in env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    const { data: currentOrders, error } = await supabase
        .from('orders')
        .select('id, items:order_items(id)')
        .eq('table_id', '224af8ff-a0bc-4389-9b97-15af2bb5f84d') // Example table id from DB
        .eq('status', 'pending');

    console.log("Error:", error);
    console.log("Data shape:", JSON.stringify(currentOrders, null, 2));
}

testQuery();
