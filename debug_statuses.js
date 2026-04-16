const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkAllOrders() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('status');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const counts = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
    }, {});

    console.log('Status Counts:', JSON.stringify(counts, null, 2));

    const { data: openOrders } = await supabase
        .from('orders')
        .select('id, waiter_id, status, order_number')
        .not('status', 'in', '("completed","cancelled")');

    console.log('Open Orders (any non-terminal status):', JSON.stringify(openOrders, null, 2));
}

checkAllOrders();
