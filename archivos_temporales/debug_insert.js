const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectSchema() {
    console.log('--- Inspecting group_items columns ---');
    const { data, error } = await supabase.from('group_items').select('*').limit(1);

    if (error) {
        console.error('Select failed:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        console.log('No data found in group_items to inspect columns.');
    }
}

inspectSchema();
