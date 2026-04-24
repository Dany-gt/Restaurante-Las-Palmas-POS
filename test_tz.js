const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing URL or KEY in .env.local", { url, key });
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, order_number')
        .eq('order_number', 293)
        .single();
    if (error) {
        console.error(error);
    } else {
        console.log("DB Data:", data);
        console.log("Date object:", new Date(data.created_at).toString());
        console.log("UTC String:", new Date(data.created_at).toUTCString());
        console.log("toLocaleString:", new Date(data.created_at).toLocaleString('es-GT'));
    }
}
run();
