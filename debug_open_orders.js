const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkOpenOrders() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, waiter_id, status, order_number')
        .in('status', ['pending', 'preparing', 'ready']);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Open Orders:', JSON.stringify(orders, null, 2));

    const { data: profiles } = await supabase.from('profiles').select('id, name');
    console.log('Profiles:', JSON.stringify(profiles, null, 2));
}

checkOpenOrders();
