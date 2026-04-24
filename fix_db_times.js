require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function run() {
    // 1. Get orders where creating time is way off. Let's just fix today's orders
    const { data: todayOrders, error } = await supabase
        .from('orders')
        .select(`id, created_at, order_items(created_at)`);

    if (error) { console.error(error); return; }

    let count = 0;
    for (const order of todayOrders) {
        if (!order.order_items || order.order_items.length === 0) continue;

        // Let's see if order created_at differs a lot from the first order_item
        const orderTime = new Date(order.created_at).getTime();
        const firstItemTimeStr = order.order_items[0].created_at;
        const firstItemTime = new Date(firstItemTimeStr).getTime();

        // Because of the 6 hr glitch, orderTime will be about 6 hrs ahead of firstItemTime
        // (6 hours = 21600000 ms)
        const diffMs = orderTime - firstItemTime;
        if (diffMs > 5 * 60 * 60 * 1000) { // e.g., > 5 hours diff
            console.log(`Fixing order ${order.id}. Order time: ${order.created_at}, Item time: ${firstItemTimeStr}`);

            // Fix it!
            const { error: updErr } = await supabase
                .from('orders')
                .update({ created_at: firstItemTimeStr })
                .eq('id', order.id);

            if (updErr) {
                console.error("Failed to update:", updErr);
            } else {
                count++;
            }
        }
    }
    console.log(`Fixed ${count} orders`);
}

run();
