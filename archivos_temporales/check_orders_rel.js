const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRelationships() {
    try {
        const { data: d1, error: e1 } = await supabase.from('orders').select('id, tables!table_id(id)').limit(1);
        console.log('Result with tables!table_id:', !!d1, e1?.message);
    } catch (e) {
        console.error(e);
    }
}

checkRelationships();
