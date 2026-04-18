const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://cofdsbczmrkriohlgyct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema() {
    // Inspeccionar tabla products (platillos)
    console.log('=== TABLA: products (platillos) ===');
    const { data: p1, error: e1 } = await supabase.from('products').select('*').limit(1);
    if (e1) console.error('Error:', e1.message);
    else if (p1 && p1.length > 0) console.log('Columnas:', JSON.stringify(Object.keys(p1[0]), null, 2));
    else console.log('(tabla vacía, no se pueden ver columnas)');

    // Inspeccionar tabla productos (insumos)
    console.log('\n=== TABLA: productos (insumos) ===');
    const { data: p2, error: e2 } = await supabase.from('productos').select('*').limit(1);
    if (e2) console.error('Error:', e2.message);
    else if (p2 && p2.length > 0) console.log('Columnas:', JSON.stringify(Object.keys(p2[0]), null, 2));
    else console.log('(tabla vacía, no se pueden ver columnas)');
    
    // Ver un platillo de ejemplo con todas sus columnas
    console.log('\n=== Muestra completa de un platillo ===');
    const { data: platillo } = await supabase.from('products').select('*').limit(1).single();
    if (platillo) console.log(JSON.stringify(platillo, null, 2));
}

inspectSchema();
