
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log('--- Checking productos ---');
    const { data: p, error: pe } = await supabase.from('productos').select('*').limit(1);
    console.log('productos error:', pe);
    console.log('productos sample:', p);

    console.log('--- Checking inventory_items ---');
    const { data: i, error: ie } = await supabase.from('inventory_items').select('*').limit(1);
    console.log('inventory_items error:', ie);
    console.log('inventory_items sample:', i);
}

checkTables();
