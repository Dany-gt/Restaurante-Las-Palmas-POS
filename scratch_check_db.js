const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

// Path to .env.local
const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- PLATILLOS ---');
    const { data, error } = await supabase.from('platillos').select('*').limit(1);
    if (error) console.log('Error platillos:', error.message);
    else console.log('Platillos keys:', Object.keys(data[0] || {}));

    console.log('--- PRODUCTS ---');
    const { data: d2, error: e2 } = await supabase.from('products').select('*').limit(1);
    if (e2) console.log('Error products:', e2.message);
    else console.log('Products keys:', Object.keys(d2[0] || {}));

    console.log('--- PRODUCTOS (Insumos) ---');
    const { data: d3, error: e3 } = await supabase.from('productos').select('*').limit(1);
    if (e3) console.log('Error productos:', e3.message);
    else console.log('Productos keys:', Object.keys(d3[0] || {}));
}

check();
