
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cofdsbczmrkriohlgyct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrderDetails() {
    console.log('--- Inspecting Order #271 Items ---');
    const { data: orders } = await supabase.from('orders').select('id').eq('order_number', 271);

    if (!orders || orders.length === 0) {
        console.log('Order #271 not found.');
        return;
    }

    const orderId = orders[0].id;
    const { data: items, error } = await supabase
        .from('order_items')
        .select(`
            id, 
            product_id, 
            status, 
            products(name, kitchen_station_id, categories(name))
        `)
        .eq('order_id', orderId);

    if (error) {
        console.error('Error fetching items:', error);
        return;
    }

    console.log('Items for Order #271:');
    items.forEach(i => {
        console.log(`- Product: ${i.products?.name}`);
        console.log(`  Station ID: ${i.products?.kitchen_station_id}`);
        console.log(`  Category: ${i.products?.categories?.name}`);
    });

    console.log('\n--- Checking Available Stations ---');
    const { data: stations } = await supabase.from('kitchen_stations').select('id, name');
    console.table(stations);
}

checkOrderDetails();
