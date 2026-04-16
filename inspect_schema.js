
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectOrdersTable() {
    console.log('Inspecting orders table columns...');
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        if (data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
        } else {
            console.log('No orders found to inspect columns.');
        }
    }

    console.log('Checking for order_payments table...');
    const { data: pData, error: pError } = await supabase
        .from('order_payments')
        .select('*')
        .limit(1);

    if (pError) {
        console.log('order_payments table likely does NOT exist or error:', pError.message);
    } else {
        console.log('order_payments table exists! Columns:', Object.keys(pData[0] || {}));
    }
}

inspectOrdersTable();
