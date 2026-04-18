const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://cofdsbczmrkriohlgyct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    // Verificar categorías de la tabla 'categories' con section='VENTA' (usadas en el sidebar de menú)
    const { data: ventas } = await supabase.from('categories').select('id, name, parent_id, section').eq('section', 'VENTA').order('name');
    console.log('=== categories (section=VENTA) ===');
    console.log('Total:', ventas?.length);
    ventas?.forEach(c => console.log(`  ${c.parent_id ? '  └─ ' : '▶ '} [parent: ${c.parent_id || 'RAÍZ'}] ${c.name}`));

    // Verificar si hay categorías con hijos
    const parents = ventas?.filter(c => ventas.some(x => x.parent_id === c.id));
    console.log('\nCategorías con hijos:', parents?.map(p => p.name));
}
check();
