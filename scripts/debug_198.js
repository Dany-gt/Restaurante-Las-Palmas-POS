const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugOrder() {
    console.log('Searching for Order #217...');

    // 1. Search in orders
    const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .or('order_number.eq.217');

    console.log('Orders found in "orders" table:', orderData?.length || 0);
    if (orderData && orderData.length > 0) {
        console.log('Order Details:', JSON.stringify(orderData, null, 2));

        // 2. Search for items and invoices
        for (const order of orderData) {
            const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id);
            console.log(`Items for order ${order.id}: ${items?.length || 0}`);

            const { data: invoices } = await supabase.from('invoices').select('*').eq('order_id', order.id);
            console.log(`Invoices for order ${order.id}:`, JSON.stringify(invoices, null, 2));
        }
    } else {
        console.log('No order found with number 217 as INT.');
    }

    // 4. Search in invoices table directly for anything matching 217
    const { data: invMatches } = await supabase.from('invoices').select('*, orders(*)').or('document_number.ilike.%217%,customer_name.ilike.%217%');
    console.log('Invoices matching "217" in doc or name:', invMatches?.length || 0);
    if (invMatches && invMatches.length > 0) {
        console.log('Invoice Matches:', JSON.stringify(invMatches, null, 2));
    }
}

debugOrder().catch(console.error);
