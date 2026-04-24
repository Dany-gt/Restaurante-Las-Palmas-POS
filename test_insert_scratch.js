const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables manually without relying on node_modules resolution paths failing
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

async function testInsert() {
    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    };

    try {
        const res = await fetch(supabaseUrl + '/rest/v1/purchase_invoices?select=*&limit=1', {
            method: 'GET',
            headers
        });
        
        const data = await res.json();
        console.log('Columns in inventory_purchases:', Object.keys(data[0] || {}).join(', '));
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

testInsert();
