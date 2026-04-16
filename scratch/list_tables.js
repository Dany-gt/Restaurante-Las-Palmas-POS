
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function listTables() {
    const { data, error } = await s.rpc('get_tables'); // Some DBs have this
    if (error) {
        // Fallback: try to query common names
        const tables = ['productos', 'produccion', 'materia_prima', 'insumos', 'inventory_items', 'products', 'categories', 'inventory_categories'];
        for (const t of tables) {
            const { count, error: e } = await s.from(t).select('*', { count: 'exact', head: true });
            console.log(`Table ${t}: ${count} rows (Error: ${e?.message || 'none'})`);
        }
    } else {
        console.log(data);
    }
}
listTables();
