
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cofdsbczmrkriohlgyct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
    console.log('--- Checking ALL Active Orders (Pending/Preparing/Ready) ---');
    const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, branch_id, customer_name')
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching orders:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No active orders found in the database with status pending/preparing/ready.');
    } else {
        console.table(data);
    }

    console.log('\n--- Checking Branches ---');
    const { data: branches } = await supabase.from('branches').select('id, name');
    console.table(branches);

    // Let's also check if there are orders with OTHER statuses to see what branch they belong to
    console.log('\n--- Checking 5 most recent orders (Any status) ---');
    const { data: recent } = await supabase
        .from('orders')
        .select('id, order_number, status, branch_id, customer_name')
        .order('created_at', { ascending: false })
        .limit(5);
    console.table(recent);
}

checkOrders();
