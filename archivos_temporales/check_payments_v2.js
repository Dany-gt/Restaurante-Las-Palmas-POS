
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrderPayments() {
    console.log('Checking order_payments rows...');
    const { data, error } = await supabase
        .from('order_payments')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${data.length} rows in order_payments.`);
        if (data.length > 0) {
            console.log('Example row:', data[0]);
        }
    }

    console.log('Checking invoices for order payments...');
    const { data: iData } = await supabase.from('invoices').select('*').limit(1);
    console.log('Invoice columns:', Object.keys(iData?.[0] || {}));
}

checkOrderPayments();
