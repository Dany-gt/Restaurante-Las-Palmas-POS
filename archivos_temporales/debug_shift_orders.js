const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkShiftOrders() {
    const { data: shifts } = await supabase.from('shifts').select('*').eq('status', 'OPEN');
    console.log('Open Shifts:', JSON.stringify(shifts, null, 2));

    if (!shifts || shifts.length === 0) return;

    const shift = shifts[0];
    const { data: orders } = await supabase
        .from('orders')
        .select('id, waiter_id, status, created_at, order_number')
        .gte('created_at', shift.start_time);

    console.log(`Orders since shift start (${shift.start_time}):`, JSON.stringify(orders, null, 2));
}

checkShiftOrders();
